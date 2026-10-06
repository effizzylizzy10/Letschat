// Letschat Africa server -- realtime chat backend
//
// Storage: a single JSON file (data/db.json). Fine for a small demo / two
// people testing on real phones. Swap `readDB`/`writeDB` for a real database
// (Postgres, Mongo, etc.) later without touching the routes or socket logic.
//
// Auth: Firebase Authentication (phone SMS code + Google). The browser signs in
// with Firebase, sends us the Firebase ID token, we verify it and issue our own
// session JWT. Needs env vars: FIREBASE_PROJECT_ID and JWT_SECRET.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { nanoid } = require("nanoid");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");

if (!process.env.FIREBASE_PROJECT_ID) console.warn("WARNING: set FIREBASE_PROJECT_ID, sign-in will fail without it.");
admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID }); // used only to verify sign-in tokens

// Storage is Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
// otherwise a local JSON file (testing only, lost on every restart on Render).
const USE_DB = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = USE_DB
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;
if (!USE_DB) console.warn("WARNING: Supabase not configured, using a local file. Data is lost whenever the host restarts.");

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
if (JWT_SECRET === "dev-secret-change-me") console.warn("WARNING: set JWT_SECRET in your environment variables!");
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const DB_PATH = path.join(__dirname, "data", "db.json");

// ---- storage ----
// Supabase mode: everything is loaded into memory at startup (routes stay fast and
// synchronous) and every change is saved to Postgres right after (write-through).
// Each row is { id, data jsonb }. Correct for a single server instance (Render).
const COLLECTIONS = ["users", "conversations", "messages", "listings"];
let marketReady = true; // false if the lc_listings table has not been created yet
const table = (c) => "lc_" + c;
let cache = null;
const saved = new Map(); // "collection/id" -> JSON last written
let flushChain = Promise.resolve();

function emptyDB() { return { users: [], conversations: [], messages: [], listings: [] }; }
function fileRead() {
  if (!fs.existsSync(DB_PATH)) return emptyDB();
  try { return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch { return emptyDB(); }
}
function fileWrite(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function persist() {
  for (const c of COLLECTIONS) {
    if (c === "listings" && !marketReady) continue;
    const changed = [];
    for (const item of cache[c] || []) {
      const key = c + "/" + item.id;
      const json = JSON.stringify(item);
      if (saved.get(key) !== json) changed.push({ key, json, row: { id: item.id, data: item } });
    }
    for (let i = 0; i < changed.length; i += 100) {
      const chunk = changed.slice(i, i + 100);
      const { error } = await supabase.from(table(c)).upsert(chunk.map((o) => o.row));
      if (error) throw new Error(error.message);
      for (const o of chunk) saved.set(o.key, o.json);
    }
  }
  // listings are cleared every 24h: delete their rows too, otherwise they would come back on restart
  if (marketReady) {
    const live = new Set((cache.listings || []).map((l) => l.id));
    const gone = [...saved.keys()].filter((k) => k.startsWith("listings/") && !live.has(k.slice(9)));
    for (let i = 0; i < gone.length; i += 100) {
      const chunk = gone.slice(i, i + 100);
      const { error } = await supabase.from(table("listings")).delete().in("id", chunk.map((k) => k.slice(9)));
      if (error) throw new Error(error.message);
      for (const k of chunk) saved.delete(k);
    }
  }
}

async function initDB() {
  if (!USE_DB) return;
  cache = emptyDB();
  for (const c of COLLECTIONS) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table(c)).select("id,data").order("id").range(from, from + 999);
      if (error && c === "listings") { marketReady = false; console.warn("Table lc_listings not found: Market is off until you create it."); break; }
      if (error) throw new Error(`Could not read ${table(c)}: ${error.message} (did you run schema.sql?)`);
      for (const r of data) { cache[c].push(r.data); saved.set(c + "/" + r.id, JSON.stringify(r.data)); }
      if (data.length < 1000) break;
    }
  }
  cache.messages.sort((a, b) => a.time - b.time);
  if (COLLECTIONS.every((c) => cache[c].length === 0) && fs.existsSync(DB_PATH)) {
    cache = fileRead();
    await persist();
    console.log("Imported data/db.json into Supabase");
  }
  console.log(`Supabase ready: ${cache.users.length} users, ${cache.conversations.length} conversations, ${cache.messages.length} messages`);
}

function readDB() { return USE_DB ? cache : fileRead(); }
function writeDB(db) {
  if (!USE_DB) return fileWrite(db);
  cache = db;
  flushChain = flushChain.then(persist).catch((e) => console.error("Supabase save failed:", e.message));
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}
function findByPhone(db, phone) {
  return phone ? db.users.find((u) => u.phone && normalizePhone(u.phone) === phone) : null;
}
function findByPhoneOrEmail(db, query) {
  const q = String(query || "").trim();
  return q.includes("@") ? db.users.find((u) => u.email === q.toLowerCase()) : findByPhone(db, normalizePhone(q));
}
function initials(name) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
// Uploaded photos are stored as data URLs but sent to clients as a small cacheable
// URL (served by /api/users/:id/avatar). The ?v= part changes whenever the photo does.
function avatarUrl(u) {
  if (!u.avatar) return null;
  if (u.avatar.startsWith("data:image/")) return `/api/v1/users/${u.id}/avatar?v=${u.avatarVersion || 1}`;
  return u.avatar; // e.g. a Google profile photo link
}
// Blue verification badge: set VERIFIED_USERS on the server to a comma-separated list of emails,
// phone numbers (with country code) or user ids, e.g. VERIFIED_USERS=you@gmail.com,2348012345678
const VERIFIED_LIST = (process.env.VERIFIED_USERS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const isVerified = (u) => !!u && VERIFIED_LIST.some((v) => v === String(u.id).toLowerCase() || (u.email && v === String(u.email).toLowerCase()) || (!v.includes("@") && u.phone && v.replace(/\D/g, "") && v.replace(/\D/g, "") === normalizePhone(u.phone)));
function publicUser(u) {
  return {
    id: u.id,
    verified: isVerified(u),
    name: u.name,
    phone: u.phone || null, email: u.email || null,
    about: u.about,
    initials: u.initials,
    color: u.color,
    avatar: avatarUrl(u),
  };
}
// Group members only see each other's name/photo/about, never phone numbers or emails.
const memberView = (u, withContact) => (u ? { id: u.id, verified: isVerified(u), name: u.name, initials: u.initials, color: u.color, avatar: avatarUrl(u), about: u.about, ...(withContact ? { phone: u.phone || null, email: u.email || null } : {}) } : null);
function groupView(db, c, uid) {
  const msgs = db.messages.filter((m) => m.conversationId === c.id);
  return {
    id: c.id, isGroup: true, name: c.name, adminId: c.adminId, description: c.description || "",
    avatar: c.avatar ? `/api/v1/groups/${c.id}/avatar?v=${c.avatarVersion || 1}` : null,
    dmRequests: (c.dmRequests || []).filter((r) => (c.adminId === uid ? r.status === "pending" : r.from === uid)),
    members: c.participantIds.map((id) => memberView(db.users.find((u) => u.id === id), c.adminId === uid)).filter(Boolean),
    inviteCode: c.adminId === uid ? c.inviteCode : undefined, // only the admin ever receives the link
    lastMessage: lite(msgs[msgs.length - 1]) || null,
    unread: msgs.filter((m) => m.senderId !== uid && !(m.readBy || []).includes(uid)).length,
    updatedAt: c.updatedAt || c.createdAt,
  };
}
// Chat lists only need a preview, never the audio/file bytes.
function lite(m) {
  if (!m || (!m.audio && !m.file)) return m;
  const { audio, file, ...rest } = m;
  return { ...rest, ...(audio ? { hasAudio: true } : {}), ...(file ? { file: { name: file.name, mime: file.mime, size: file.size } } : {}) };
}
// A sender only sees "read" ticks if both sides keep read receipts on.
function receiptView(db, m, viewer, convo) {
  if (!m || m.senderId !== viewer.id) return m;
  const on = (id) => { const u = db.users.find((x) => x.id === id); return !!u && privacyOf(u).readReceipts; };
  if (!privacyOf(viewer).readReceipts) return { ...m, read: false, readBy: [] };
  if (convo && convo.isGroup) return { ...m, readBy: (m.readBy || []).filter(on) };
  const otherId = convo && convo.participantIds.find((id) => id !== viewer.id);
  return otherId && !on(otherId) ? { ...m, read: false } : m;
}
const PALETTE = ["#35D0BA", "#F2B84B", "#8B7CF6", "#FF6B5D", "#5B6673", "#4FA8E0"];
function colorFor(id) {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return PALETTE[sum % PALETTE.length];
}


const app = express();
app.use(cors({ origin: CLIENT_ORIGIN === "*" ? "*" : CLIENT_ORIGIN.split(",") }));
app.use(express.json({ limit: "10mb" })); // Increased for larger avatar images


// =====================================================================
// Standard API layer
//  - Canonical base path: /api/v1  (the old /api/... paths still work)
//  - Every response: { success: true, data } or { success: false, error: { code, message } }
//  - Every response carries an X-Request-Id header; rate limits send X-RateLimit-* headers
// =====================================================================
app.set("trust proxy", 1);
const API_VERSION = "1.0.0";
const ERROR_CODES = { 400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 413: "PAYLOAD_TOO_LARGE", 429: "RATE_LIMITED" };

app.use((req, res, next) => {
  if (req.url.startsWith("/api/v1")) req.url = "/api" + req.url.slice("/api/v1".length);
  next();
});
// Profile photos: plain image response, registered before the JSON wrapper and rate
// limiter so a chat list full of avatars never trips the limit. Browsers cache it.
app.get("/api/users/:id/avatar", (req, res) => {
  const u = readDB().users.find((x) => x.id === req.params.id);
  const m = u && u.avatar && /^data:(image\/(?:jpeg|png));base64,(.+)$/s.exec(u.avatar);
  if (!m) return res.status(404).type("text/plain").send("No photo");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.type(m[1]).send(Buffer.from(m[2], "base64"));
});

function sendImage(res, dataUrl) {
  const m = dataUrl && /^data:(image\/(?:jpeg|png));base64,(.+)$/s.exec(dataUrl);
  if (!m) return res.status(404).type("text/plain").send("No photo");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.type(m[1]).send(Buffer.from(m[2], "base64"));
}
app.get("/api/groups/:id/avatar", (req, res) => sendImage(res, (readDB().conversations.find((x) => x.id === req.params.id) || {}).avatar));
app.get("/api/market/:id/photo", (req, res) => sendImage(res, (listingsOf(readDB()).find((x) => x.id === req.params.id && !x.removed) || {}).photo));

app.use("/api", (req, res, next) => {
  res.setHeader("X-Request-Id", nanoid(10));
  const send = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400) return send({ success: true, data: body });
    const b = body || {};
    const code = b.newUser ? "NAME_REQUIRED" : ERROR_CODES[res.statusCode] || "INTERNAL_ERROR";
    return send({ success: false, error: { code, message: b.error || "Request failed" } });
  };
  next();
});

function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || now - h.start > windowMs) { h = { start: now, count: 0 }; hits.set(req.ip, h); }
    h.count++;
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - h.count));
    if (h.count > max) {
      res.setHeader("Retry-After", Math.ceil((h.start + windowMs - now) / 1000));
      return res.status(429).json({ error: "Too many requests. Slow down and try again shortly." });
    }
    next();
  };
}
app.use("/api", rateLimit({ windowMs: 60000, max: 300 }));
app.use("/api/auth", rateLimit({ windowMs: 60000, max: 20 }));

app.get("/api", (req, res) => res.json({ name: "Letschat Africa API", version: API_VERSION, base: "/api/v1", docs: "/api/v1/openapi.json" }));
app.get("/api/openapi.json", (req, res) => {
  try { res.type("json").send(fs.readFileSync(path.join(__dirname, "openapi.json"), "utf-8")); }
  catch { res.status(404).json({ error: "openapi.json not found" }); }
});

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "90d" });
}
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = readDB();
    const user = db.users.find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: "Unknown user" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true, storage: USE_DB ? "supabase" : "file", version: API_VERSION, uptime: Math.round(process.uptime()) }));

app.post("/api/auth/firebase", async (req, res) => {
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(String(req.body.idToken || ""));
  } catch (e) {
    console.error("Firebase token check failed:", e.message);
    return res.status(401).json({ error: "Sign-in could not be verified. Please try again." });
  }
  const phone = decoded.phone_number ? normalizePhone(decoded.phone_number) : null;
  const email = decoded.email && decoded.email_verified ? decoded.email.toLowerCase() : null;

  const db = readDB();
  let user =
    db.users.find((u) => u.firebaseUid === decoded.uid) ||
    findByPhone(db, phone) ||
    (email && db.users.find((u) => u.email === email)) ||
    null;

  if (!user) {
    const name = String(decoded.name || req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Name required for new accounts", newUser: true });
    user = {
      id: nanoid(10),
      firebaseUid: decoded.uid,
      phone,
      email,
      name,
      about: "Hey there! I'm using Letschat Africa.",
      initials: initials(name),
      color: colorFor(decoded.uid),
      avatar: decoded.picture || null,
      createdAt: Date.now(),
    };
    db.users.push(user);
    writeDB(db);
  } else {
    let changed = false;
    if (!user.firebaseUid) { user.firebaseUid = decoded.uid; changed = true; }
    if (phone && !user.phone) { user.phone = phone; changed = true; }
    if (email && !user.email) { user.email = email; changed = true; }
    if (changed) writeDB(db);
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

const AVATAR_RE = /^data:image\/(jpeg|png);base64,/;
function looksLikeImage(dataUrl) {
  // check the real file signature, not just the label the browser gave it
  const head = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1, dataUrl.indexOf(",") + 17), "base64");
  const jpg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  return jpg || png;
}

app.patch("/api/me", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { name, about, avatar } = req.body;

  // validate everything first so a bad request changes nothing
  if (name !== undefined) {
    const n = String(name).trim();
    if (!n || n.length > 60) return res.status(400).json({ error: "Name must be 1 to 60 characters" });
  }
  if (typeof about === "string" && about.length > 139) {
    return res.status(400).json({ error: "About must be 139 characters or fewer" });
  }
  const newPhoto = typeof avatar === "string" && avatar.startsWith("data:");
  if (newPhoto) {
    if (!AVATAR_RE.test(avatar) || !looksLikeImage(avatar)) return res.status(400).json({ error: "Profile photo must be a JPG or PNG image" });
    if (avatar.length > 1500000) return res.status(400).json({ error: "Profile photo is too large (max about 1 MB)" });
  }

  if (name) {
    user.name = String(name).trim();
    user.initials = initials(user.name);
  }
  if (typeof about === "string") user.about = about.trim();
  if (newPhoto) { user.avatar = avatar; user.avatarVersion = Date.now(); }
  else if (avatar === null) { user.avatar = null; user.avatarVersion = Date.now(); }
  // any other avatar value (e.g. the unchanged photo link) is ignored
  writeDB(db);

  const pub = publicUser(user);
  io.emit("user:update", pub); // lets the people you chat with see the new photo right away
  res.json({ user: pub });
});

// ---- shareable profile link: ?chat=CODE opens a direct message with the owner ----
// The code is separate from the user id, so the id is never exposed and the owner can reset the link.
function ensureProfileCode(db, user) {
  if (!user.profileCode) { user.profileCode = nanoid(16); writeDB(db); }
  return user.profileCode;
}
app.get("/api/me/profile-link", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  res.json({ code: ensureProfileCode(db, user) });
});
app.post("/api/me/profile-link/reset", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  user.profileCode = nanoid(16); // old link stops working immediately
  writeDB(db);
  res.json({ code: user.profileCode });
});
// ---- favourites, privacy and blocked contacts (stored on the user, so they follow the account to any device) ----
const privacyOf = (u) => ({ readReceipts: !(u.privacy && u.privacy.readReceipts === false), lastSeen: u.privacy && u.privacy.lastSeen === "nobody" ? "nobody" : "everyone" });
const hidesPresence = (u) => !!u && privacyOf(u).lastSeen === "nobody";
function settingsView(db, u) {
  return {
    favorites: (u.favorites || []).filter((id) => db.conversations.some((c) => c.id === id && c.participantIds.includes(u.id))),
    privacy: privacyOf(u),
    blocked: (u.blocked || []).map((id) => db.users.find((x) => x.id === id)).filter(Boolean).map(publicUser),
  };
}
function sendPresenceFor(user) { // tell everyone the user's new visibility right away
  if (hidesPresence(user)) io.emit("presence:update", { userId: user.id, online: false });
  else if (userSockets.has(user.id)) io.emit("presence:update", { userId: user.id, online: true });
  else if (lastSeen.has(user.id)) io.emit("presence:update", { userId: user.id, online: false, lastSeen: lastSeen.get(user.id) });
}
app.get("/api/me/settings", authMiddleware, (req, res) => res.json(settingsView(readDB(), req.user)));
app.patch("/api/me/settings", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  const p = (req.body && req.body.privacy) || {};
  if (p.readReceipts !== undefined && typeof p.readReceipts !== "boolean") return res.status(400).json({ error: "readReceipts must be true or false" });
  if (p.lastSeen !== undefined && !["everyone", "nobody"].includes(p.lastSeen)) return res.status(400).json({ error: "lastSeen must be everyone or nobody" });
  user.privacy = { ...privacyOf(user), ...(p.readReceipts !== undefined ? { readReceipts: p.readReceipts } : {}), ...(p.lastSeen !== undefined ? { lastSeen: p.lastSeen } : {}) };
  writeDB(db);
  if (p.lastSeen !== undefined) sendPresenceFor(user);
  res.json(settingsView(db, user));
});
app.post("/api/me/favorites", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  const { conversationId, favorite } = req.body || {};
  const c = db.conversations.find((x) => x.id === conversationId);
  if (!c || !c.participantIds.includes(user.id)) return res.status(404).json({ error: "Conversation not found" });
  const set = new Set(user.favorites || []);
  if (favorite === false) set.delete(c.id); else set.add(c.id);
  user.favorites = [...set];
  writeDB(db);
  res.json(settingsView(db, user));
});
app.post("/api/me/blocked", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  const { userId, blocked } = req.body || {};
  if (!userId || userId === user.id || !db.users.some((u) => u.id === userId)) return res.status(400).json({ error: "Choose a valid contact" });
  const set = new Set(user.blocked || []);
  if (blocked === false) set.delete(userId); else set.add(userId);
  user.blocked = [...set];
  writeDB(db);
  res.json(settingsView(db, user));
});

app.get("/api/users/profile/:code", authMiddleware, (req, res) => {
  const user = readDB().users.find((u) => u.profileCode && u.profileCode === req.params.code);
  if (!user) return res.status(404).json({ error: "This profile link is invalid or has been reset" });
  res.json({ user: memberView(user, false), self: user.id === req.user.id });
});

// Phonebook discovery: the client sends the numbers the person chose to share, we answer with the ones that are registered.
app.post("/api/users/match", authMiddleware, (req, res) => {
  const list = Array.isArray(req.body && req.body.phones) ? req.body.phones.slice(0, 1000) : [];
  const db = readDB();
  const byDigits = new Map();
  for (const u of db.users) { const d = normalizePhone(u.phone); if (d && u.id !== req.user.id) byDigits.set(d, u); }
  const matches = {};
  for (const raw of list) {
    const d = normalizePhone(raw).replace(/^00/, "");
    if (d.length < 7 || d.length > 15) continue;
    let u = byDigits.get(d);
    if (!u && d.startsWith("0")) { // local format (0813...) -> compare with the end of the international number
      const tail = d.slice(1);
      for (const [k, v] of byDigits) if (k.length > tail.length && k.endsWith(tail)) { u = v; break; }
    }
    if (u) matches[String(raw)] = publicUser(u);
  }
  res.json({ matches });
});
app.get("/api/users/lookup", authMiddleware, (req, res) => {
  if (!req.query.phone) return res.status(400).json({ error: "phone query param required" });
  const db = readDB();
  const user = findByPhoneOrEmail(db, req.query.phone);
  if (!user) return res.status(404).json({ error: "No Letschat Africa user with that phone number" });
  if (user.id === req.user.id) return res.status(400).json({ error: "That's your own number" });
  res.json({ user: publicUser(user) });
});

app.get("/api/conversations", authMiddleware, (req, res) => {
  const db = readDB();
  const mine = db.conversations.filter((c) => c.participantIds.includes(req.user.id));
  const enriched = mine
    .map((c) => {
      if (c.isGroup) return groupView(db, c, req.user.id);
      const otherId = c.participantIds.find((id) => id !== req.user.id);
      const other = db.users.find((u) => u.id === otherId);
      const msgs = db.messages.filter((m) => m.conversationId === c.id);
      const last = msgs[msgs.length - 1] || null;
      return {
        id: c.id,
        other: other ? publicUser(other) : { id: otherId, name: "Unknown", initials: "?", color: "#5B6673" },
        lastMessage: lite(last),
        unread: msgs.filter((m) => m.senderId !== req.user.id && !m.read).length,
        updatedAt: c.updatedAt || c.createdAt,
      };
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  res.json({ conversations: enriched });
});

app.post("/api/conversations", authMiddleware, (req, res) => {
  const db = readDB();
  const byCode = !!req.body.profileCode; // the owner shared this link, so no group/listing check is needed
  const byId = !byCode && !!req.body.userId;
  const other = byCode
    ? db.users.find((u) => u.profileCode && u.profileCode === String(req.body.profileCode))
    : byId ? db.users.find((u) => u.id === req.body.userId) : findByPhoneOrEmail(db, req.body.phone);
  if (!other) return res.status(404).json({ error: "No Letschat Africa user with that phone number or email" });
  if (other.id === req.user.id) return res.status(400).json({ error: "That's your own number" });

  let convo = db.conversations.find(
    (c) => !c.isGroup && c.participantIds.includes(req.user.id) && c.participantIds.includes(other.id)
  );
  if (!convo && byId && !canDM(db, req.user.id, other.id)) return res.status(403).json({ error: "Ask the group admin to approve a private chat first" });
  if (!convo) {
    convo = {
      id: nanoid(12),
      participantIds: [req.user.id, other.id],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.conversations.push(convo);
    writeDB(db);
    joinUserToRoom(other.id, `conv:${convo.id}`);
  }
  res.json({ conversation: { id: convo.id, other: publicUser(other) } });
});

app.get("/api/conversations/:id/messages", authMiddleware, (req, res) => {
  const db = readDB();
  const convo = db.conversations.find((c) => c.id === req.params.id);
  if (!convo || !convo.participantIds.includes(req.user.id)) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  const all = db.messages.filter((m) => m.conversationId === req.params.id);
  let changed = false;
  for (const m of all) {
    if (m.senderId === req.user.id) continue;
    if (convo.isGroup) {
      if (!(m.readBy || (m.readBy = [])).includes(req.user.id)) { m.readBy.push(req.user.id); changed = true; }
    } else if (!m.read) { m.read = true; changed = true; }
  }
  if (changed) writeDB(db);
  // pagination: ?limit=1..500 (default 200) and ?before=<timestamp ms> for older pages
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
  const before = Number(req.query.before) || Infinity;
  const older = all.filter((m) => m.time < before);
  const page = older.slice(-limit);
  res.json({ messages: page.map((m) => receiptView(db, m, req.user, convo)), hasMore: older.length > page.length });
});

// ---- group chats: creator is admin; admin adds registered users or shares an invite link ----
const MAX_GROUP = 256;
function groupEvent(c, event) { // put every member's sockets in the room and tell them to refresh
  for (const id of c.participantIds) { joinUserToRoom(id, `conv:${c.id}`); io.to(`user:${id}`).emit(event, { id: c.id }); }
}
function adminGroup(req, res) { // returns the group if the caller is its admin, else sends the error
  const db = readDB();
  const c = db.conversations.find((x) => x.id === req.params.id);
  if (!c || !c.isGroup || !c.participantIds.includes(req.user.id)) { res.status(404).json({ error: "Group not found" }); return null; }
  if (c.adminId !== req.user.id) { res.status(403).json({ error: "Only the group admin can do that" }); return null; }
  return { db, c };
}
app.post("/api/conversations/group", authMiddleware, (req, res) => {
  const db = readDB();
  const name = String(req.body.name || "").trim();
  if (!name || name.length > 60) return res.status(400).json({ error: "Group name must be 1 to 60 characters" });
  const ids = [...new Set(Array.isArray(req.body.memberIds) ? req.body.memberIds : [])]
    .filter((id) => id !== req.user.id && db.users.some((u) => u.id === id)).slice(0, MAX_GROUP - 1);
  const c = { id: nanoid(12), isGroup: true, name, adminId: req.user.id, inviteCode: nanoid(16),
    participantIds: [req.user.id, ...ids], createdAt: Date.now(), updatedAt: Date.now() };
  db.conversations.push(c);
  writeDB(db);
  groupEvent(c, "conversation:added");
  res.json({ conversation: groupView(db, c, req.user.id) });
});
app.post("/api/conversations/:id/members", authMiddleware, (req, res) => {
  const g = adminGroup(req, res); if (!g) return;
  const { db, c } = g;
  const want = (Array.isArray(req.body.userIds) ? req.body.userIds : []).filter((id) => db.users.some((u) => u.id === id));
  if (req.body.phone) {
    const u = findByPhoneOrEmail(db, req.body.phone);
    if (!u) return res.status(404).json({ error: "No Letschat Africa user with that phone number or email" });
    want.push(u.id);
  }
  const fresh = [...new Set(want)].filter((id) => !c.participantIds.includes(id));
  if (!fresh.length) return res.status(400).json({ error: "Already in the group" });
  if (c.participantIds.length + fresh.length > MAX_GROUP) return res.status(400).json({ error: `A group can have up to ${MAX_GROUP} people` });
  c.participantIds.push(...fresh);
  c.updatedAt = Date.now();
  writeDB(db);
  groupEvent(c, "conversation:update");
  res.json({ conversation: groupView(db, c, req.user.id) });
});
app.post("/api/conversations/:id/invite/reset", authMiddleware, (req, res) => {
  const g = adminGroup(req, res); if (!g) return;
  g.c.inviteCode = nanoid(16); // old link stops working immediately
  writeDB(g.db);
  res.json({ conversation: groupView(g.db, g.c, req.user.id) });
});
app.patch("/api/conversations/:id", authMiddleware, (req, res) => {
  const g = adminGroup(req, res); if (!g) return;
  const { db, c } = g;
  const { name, description, avatar } = req.body;
  if (name !== undefined && (!String(name).trim() || String(name).trim().length > 60)) return res.status(400).json({ error: "Group name must be 1 to 60 characters" });
  if (description !== undefined && String(description).length > 300) return res.status(400).json({ error: "Description must be 300 characters or fewer" });
  const photo = typeof avatar === "string" && avatar.startsWith("data:");
  if (photo && (!AVATAR_RE.test(avatar) || !looksLikeImage(avatar) || avatar.length > 1500000)) return res.status(400).json({ error: "Group photo must be a JPG or PNG under about 1 MB" });
  if (name !== undefined) c.name = String(name).trim();
  if (description !== undefined) c.description = String(description).trim();
  if (photo) { c.avatar = avatar; c.avatarVersion = Date.now(); } else if (avatar === null) { c.avatar = null; c.avatarVersion = Date.now(); }
  writeDB(db);
  groupEvent(c, "conversation:update");
  res.json({ conversation: groupView(db, c, req.user.id) });
});
function ensureDM(db, a, b) {
  let convo = db.conversations.find((x) => !x.isGroup && x.participantIds.includes(a) && x.participantIds.includes(b));
  if (!convo) { convo = { id: nanoid(12), participantIds: [a, b], createdAt: Date.now(), updatedAt: Date.now() }; db.conversations.push(convo); }
  for (const id of [a, b]) { joinUserToRoom(id, `conv:${convo.id}`); io.to(`user:${id}`).emit("conversation:added", { id: convo.id }); }
  return convo;
}
// Members need the admin's approval to start a private chat; the admin (or anyone messaging the admin) does not.
app.post("/api/conversations/:id/dm-requests", authMiddleware, (req, res) => {
  const db = readDB();
  const c = db.conversations.find((x) => x.id === req.params.id);
  const to = String(req.body.toId || "");
  if (!c || !c.isGroup || !c.participantIds.includes(req.user.id) || !c.participantIds.includes(to) || to === req.user.id) return res.status(404).json({ error: "Member not found in this group" });
  const reqs = c.dmRequests || (c.dmRequests = []);
  if (c.adminId === req.user.id || c.adminId === to) { ensureDM(db, req.user.id, to); writeDB(db); return res.json({ conversation: groupView(db, c, req.user.id) }); }
  if (reqs.some((r) => r.status === "pending" && r.from === req.user.id && r.to === to)) return res.status(400).json({ error: "Request already sent" });
  reqs.push({ id: nanoid(8), from: req.user.id, to, status: "pending", time: Date.now() });
  writeDB(db);
  io.to(`user:${c.adminId}`).emit("conversation:update", { id: c.id });
  res.json({ conversation: groupView(db, c, req.user.id) });
});
app.post("/api/conversations/:id/dm-requests/:rid", authMiddleware, (req, res) => {
  const g = adminGroup(req, res); if (!g) return;
  const { db, c } = g;
  const r = (c.dmRequests || []).find((x) => x.id === req.params.rid && x.status === "pending");
  if (!r) return res.status(404).json({ error: "Request not found" });
  r.status = req.body.approve ? "approved" : "declined";
  if (req.body.approve) ensureDM(db, r.from, r.to);
  writeDB(db);
  io.to(`user:${r.from}`).emit("conversation:update", { id: c.id });
  res.json({ conversation: groupView(db, c, req.user.id) });
});

// ---- market: anyone can post products; buyers message the seller in-app ----
// Market posts are cleared 24 hours after they were posted.
const LISTING_TTL_MS = 24 * 60 * 60 * 1000;
function purgeExpiredListings(db) {
  const list = db.listings || (db.listings = []);
  const cutoff = Date.now() - LISTING_TTL_MS;
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].time < cutoff) { list.splice(i, 1); n++; }
  return n;
}
function listingsOf(db) { purgeExpiredListings(db); return db.listings; }
// hourly sweep so expired posts are also removed from storage (and Supabase), not just hidden
setInterval(() => {
  try { const db = readDB(); if (purgeExpiredListings(db)) writeDB(db); } catch (e) { console.error("Market cleanup failed:", e.message); }
}, 60 * 60 * 1000).unref();
setTimeout(() => { try { const db = readDB(); if (purgeExpiredListings(db)) writeDB(db); } catch (e) {} }, 10000).unref();
function canDM(db, me, other) { // messaging by user id: sellers with a live listing, or a group admin
  if (listingsOf(db).some((l) => !l.removed && l.sellerId === other)) return true;
  return db.conversations.some((c) => c.isGroup && c.participantIds.includes(me) && c.participantIds.includes(other) && (c.adminId === me || c.adminId === other));
}
const listingView = (l, db) => ({ id: l.id, title: l.title, description: l.description, price: l.price, sold: !!l.sold, time: l.time,
  photo: l.photo ? `/api/v1/market/${l.id}/photo?v=${l.time}` : null, seller: sellerView(db, l.sellerId), commentCount: (l.comments || []).length });
// seller star ratings live on the seller's user record: { raterId: { stars, time } }
const ratingOf = (u) => { const r = Object.values((u && u.ratings) || {}); const n = r.length; return { avg: n ? Math.round((r.reduce((a, x) => a + x.stars, 0) / n) * 10) / 10 : 0, count: n }; };
// Better-rated sellers float to the top. Bayesian average: a seller with no ratings starts at a neutral 3.0,
// so a few good ratings lift them up and a few bad ones push them down. Ties go to the newest post.
function sellerScore(db, id) { const r = ratingOf(db.users.find((x) => x.id === id)); return (r.avg * r.count + 3 * 3) / (r.count + 3); }
function sellerView(db, id) { const u = db.users.find((x) => x.id === id); const v = memberView(u); return v && { ...v, rating: ratingOf(u) }; }
app.get("/api/market", authMiddleware, (req, res) => {
  const db = readDB();
  const q = String(req.query.q || "").trim().toLowerCase();
  const items = listingsOf(db).filter((l) => !l.removed && (!q || (l.title + " " + l.description).toLowerCase().includes(q))).sort((a, b) => (sellerScore(db, b.sellerId) - sellerScore(db, a.sellerId)) || b.time - a.time).slice(0, 100);
  res.json({ listings: items.map((l) => listingView(l, db)) });
});
app.post("/api/market", authMiddleware, (req, res) => {
  if (USE_DB && !marketReady) return res.status(503).json({ error: "Market storage is not set up on the server yet" });
  const db = readDB();
  const title = String(req.body.title || "").trim(), description = String(req.body.description || "").trim(), price = String(req.body.price || "").trim(), photo = req.body.photo;
  if (!title || title.length > 80) return res.status(400).json({ error: "Title must be 1 to 80 characters" });
  if (!price || price.length > 30) return res.status(400).json({ error: "Add a price (up to 30 characters, e.g. N5,000)" });
  if (description.length > 1000) return res.status(400).json({ error: "Description must be 1000 characters or fewer" });
  if (photo && (typeof photo !== "string" || !AVATAR_RE.test(photo) || !looksLikeImage(photo) || photo.length > 1500000)) return res.status(400).json({ error: "Photo must be a JPG or PNG under about 1 MB" });
  const l = { id: nanoid(10), sellerId: req.user.id, title, description, price, photo: photo || null, time: Date.now() };
  listingsOf(db).push(l);
  writeDB(db);
  res.json({ listing: listingView(l, db) });
});
function ownListing(req, res) {
  const db = readDB();
  const l = listingsOf(db).find((x) => x.id === req.params.id && !x.removed);
  if (!l || l.sellerId !== req.user.id) { res.status(404).json({ error: "Listing not found" }); return null; }
  return { db, l };
}
app.post("/api/market/:id/sold", authMiddleware, (req, res) => { const o = ownListing(req, res); if (!o) return; o.l.sold = !o.l.sold; writeDB(o.db); res.json({ listing: listingView(o.l, o.db) }); });
app.delete("/api/market/:id", authMiddleware, (req, res) => { const o = ownListing(req, res); if (!o) return; o.l.removed = true; writeDB(o.db); res.json({ ok: true }); });

// ---- seller ratings and product comments (comments live on the listing, so they go when the post expires) ----
function liveListing(req, res) {
  const db = readDB();
  const l = listingsOf(db).find((x) => x.id === req.params.id && !x.removed);
  if (!l) { res.status(404).json({ error: "Product not found. It may have expired." }); return null; }
  return { db, l };
}
const commentViews = (db, l, uid) => (l.comments || []).map((c) => ({ id: c.id, text: c.text, time: c.time, mine: c.userId === uid, canDelete: c.userId === uid || l.sellerId === uid, author: memberView(db.users.find((u) => u.id === c.userId)) }));
app.get("/api/market/:id/comments", authMiddleware, (req, res) => {
  const o = liveListing(req, res); if (!o) return;
  res.json({ comments: commentViews(o.db, o.l, req.user.id) });
});
app.post("/api/market/:id/comments", authMiddleware, (req, res) => {
  const o = liveListing(req, res); if (!o) return;
  const text = String(req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "Write a comment first" });
  if ([...text].length > 500) return res.status(400).json({ error: "Comments can be up to 500 characters" });
  o.l.comments = o.l.comments || [];
  if (o.l.comments.length >= 200) return res.status(400).json({ error: "This product has reached its comment limit" });
  o.l.comments.push({ id: nanoid(8), userId: req.user.id, text, time: Date.now() });
  writeDB(o.db);
  res.json({ comments: commentViews(o.db, o.l, req.user.id) });
});
app.delete("/api/market/:id/comments/:cid", authMiddleware, (req, res) => {
  const o = liveListing(req, res); if (!o) return;
  const c = (o.l.comments || []).find((x) => x.id === req.params.cid);
  if (!c) return res.status(404).json({ error: "Comment not found" });
  if (c.userId !== req.user.id && o.l.sellerId !== req.user.id) return res.status(403).json({ error: "You can only delete your own comments" });
  o.l.comments = o.l.comments.filter((x) => x.id !== c.id);
  writeDB(o.db);
  res.json({ comments: commentViews(o.db, o.l, req.user.id) });
});
app.get("/api/market/seller/:sid/rating", authMiddleware, (req, res) => {
  const u = readDB().users.find((x) => x.id === req.params.sid);
  if (!u) return res.status(404).json({ error: "Seller not found" });
  const mine = u.ratings && u.ratings[req.user.id];
  res.json({ ...ratingOf(u), mine: mine ? mine.stars : 0 });
});
app.post("/api/market/seller/:sid/rate", authMiddleware, (req, res) => {
  const db = readDB();
  const u = db.users.find((x) => x.id === req.params.sid);
  if (!u) return res.status(404).json({ error: "Seller not found" });
  if (u.id === req.user.id) return res.status(400).json({ error: "You can't rate yourself" });
  const stars = Number(req.body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: "Choose 1 to 5 stars" });
  u.ratings = { ...(u.ratings || {}), [req.user.id]: { stars, time: Date.now() } };
  writeDB(db);
  res.json({ ...ratingOf(u), mine: stars });
});

app.get("/api/groups/invite/:code", authMiddleware, (req, res) => {
  const c = readDB().conversations.find((x) => x.isGroup && x.inviteCode === req.params.code);
  if (!c) return res.status(404).json({ error: "This invite link is invalid or has been reset" });
  res.json({ name: c.name, memberCount: c.participantIds.length, joined: c.participantIds.includes(req.user.id) });
});
app.post("/api/groups/join", authMiddleware, (req, res) => {
  const db = readDB();
  const c = db.conversations.find((x) => x.isGroup && x.inviteCode === String(req.body.code || ""));
  if (!c) return res.status(404).json({ error: "This invite link is invalid or has been reset" });
  if (!c.participantIds.includes(req.user.id)) {
    if (c.participantIds.length >= MAX_GROUP) return res.status(400).json({ error: "This group is full" });
    c.participantIds.push(req.user.id);
    c.updatedAt = Date.now();
    writeDB(db);
    groupEvent(c, "conversation:update");
  }
  res.json({ conversation: groupView(db, c, req.user.id) });
});

app.use("/api", (req, res) => res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}` }));
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Request body is not valid JSON" });
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large" });
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong on our side" });
});

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 6e6, // photos and files up to ~3 MB are sent as base64 over the socket
  cors: { origin: CLIENT_ORIGIN === "*" ? "*" : CLIENT_ORIGIN.split(",") },
});

const userSockets = new Map();
const lastSeen = new Map(); // userId -> when they last went offline (in memory)

// Online/offline for everyone who shares a chat or group with this user.
function presenceSnapshot(userId) {
  const peers = new Set();
  for (const c of readDB().conversations) {
    if (c.participantIds.includes(userId)) c.participantIds.forEach((id) => id !== userId && peers.add(id));
  }
  const online = [];
  const seen = {};
  for (const id of peers) {
    if (hidesPresence(readDB().users.find((u) => u.id === id))) continue;
    if (userSockets.has(id)) online.push(id);
    else if (lastSeen.has(id)) seen[id] = lastSeen.get(id);
  }
  return { online, lastSeen: seen };
}

function joinUserToRoom(userId, room) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  for (const socketId of sockets) {
    const s = io.sockets.sockets.get(socketId);
    if (s) s.join(room);
  }
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = jwt.verify(token, JWT_SECRET);
    const db = readDB();
    const user = db.users.find((u) => u.id === payload.sub);
    if (!user) return next(new Error("Unknown user"));
    socket.userId = user.id;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;

  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);
  socket.join(`user:${userId}`);
  socket.on("presence:get", (ack) => { if (typeof ack === "function") ack(presenceSnapshot(userId)); });

  const db = readDB();
  const myConvos = db.conversations.filter((c) => c.participantIds.includes(userId));
  for (const c of myConvos) socket.join(`conv:${c.id}`);

  if (!hidesPresence(db.users.find((u) => u.id === userId))) io.emit("presence:update", { userId, online: true });

  socket.on("message:send", ({ conversationId, text, audio, duration, file }, ack) => {
    const fail = (error) => { if (ack) ack({ error }); };
    const voice = typeof audio === "string" && audio.length <= 600000 && /^data:audio\/(webm|ogg|mp4|mpeg|wav|aac|x-m4a)(;codecs=[\w.,-]+)?;base64,/.test(audio);
    if (audio && !voice) return fail("Voice note is too long or not supported (max about 1 minute)");
    if (voice) text = "🎤 Voice note";

    // photo / file attachment (max ~3 MB). Active content types are refused so a shared file can never run in someone's browser.
    let att = null;
    if (file) {
      const okShape = typeof file === "object" && typeof file.data === "string";
      const m = okShape && /^data:([\w.+-]+\/[\w.+-]+)?(?:;[\w=.+-]+)*;base64,/.exec(file.data);
      if (!m) return fail("That file could not be read");
      if (file.data.length > 4200000) return fail("File is too large (max 3 MB)");
      const mime = (m[1] || "application/octet-stream").toLowerCase();
      if (/^(text\/html|image\/svg|application\/xhtml|text\/javascript|application\/javascript|application\/x-msdownload)/.test(mime)) return fail("That file type is not allowed");
      const name = String(file.name || "file").replace(/[\\/<>:"|?*\x00-\x1f]/g, "_").slice(0, 120) || "file";
      att = { name, mime, size: Math.max(0, Math.round(Number(file.size)) || 0), data: file.data };
      if (!text || !String(text).trim()) text = mime.startsWith("image/") ? "📷 Photo" : "📎 " + name;
    }

    if (!text || !text.trim()) return fail("Message text required");
    if (text.length > 4000) return fail("Message is too long (max 4000 characters)");
    const db = readDB();
    const convo = db.conversations.find((c) => c.id === conversationId);
    if (!convo || !convo.participantIds.includes(userId)) {
      if (ack) ack({ error: "Not a participant of this conversation" });
      return;
    }
    if (!convo.isGroup) {
      const otherId = convo.participantIds.find((id) => id !== userId);
      const me = db.users.find((u) => u.id === userId);
      const other = db.users.find((u) => u.id === otherId);
      if (me && (me.blocked || []).includes(otherId)) return fail("You blocked this contact. Unblock them to send messages.");
      if (other && (other.blocked || []).includes(userId)) return fail("This message couldn't be delivered.");
    }
    const message = {
      id: nanoid(14),
      conversationId,
      senderId: userId,
      text: text.trim(),
      ...(voice ? { audio, duration: Math.min(Math.round(Number(duration)) || 0, 120) } : {}),
      ...(att ? { file: att } : {}),
      time: Date.now(),
      read: false,
    };
    db.messages.push(message);
    convo.updatedAt = Date.now();
    writeDB(db);

    io.to(`conv:${conversationId}`).emit("message:new", message);
    if (ack) ack({ message });
  });

  socket.on("typing", ({ conversationId, typing }) => {
    socket.to(`conv:${conversationId}`).emit("typing", { conversationId, userId, typing: !!typing });
  });

  socket.on("disconnect", () => {
    const set = userSockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        userSockets.delete(userId);
        lastSeen.set(userId, Date.now());
        if (!hidesPresence(readDB().users.find((u) => u.id === userId))) io.emit("presence:update", { userId, online: false, lastSeen: lastSeen.get(userId) });
      }
    }
  });
});

initDB()
  .then(() => server.listen(PORT, () => console.log(`Letschat Africa server listening on port ${PORT}`)))
  .catch((e) => { console.error("Could not start (database error):", e); process.exit(1); });
