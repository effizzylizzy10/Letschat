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
const COLLECTIONS = ["users", "conversations", "messages", "listings", "statuses"];
const EPHEMERAL = ["listings", "statuses"]; // cleared after 24h; their tables are optional until created
const ready = { listings: true, statuses: true }; // false if lc_listings / lc_statuses has not been created yet
let marketReady = true; // (kept for the market code below; mirrors ready.listings)
const table = (c) => "lc_" + c;
let cache = null;
const saved = new Map(); // "collection/id" -> JSON last written
let flushChain = Promise.resolve();

function emptyDB() { return { users: [], conversations: [], messages: [], listings: [], statuses: [] }; }
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
    if (ready[c] === false) continue;
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
  // listings and statuses are cleared every 24h: delete their rows too, otherwise they would come back on restart
  for (const c of EPHEMERAL) {
    if (ready[c] === false) continue;
    const live = new Set((cache[c] || []).map((l) => l.id));
    const prefix = c + "/";
    const gone = [...saved.keys()].filter((k) => k.startsWith(prefix) && !live.has(k.slice(prefix.length)));
    for (let i = 0; i < gone.length; i += 100) {
      const chunk = gone.slice(i, i + 100);
      const { error } = await supabase.from(table(c)).delete().in("id", chunk.map((k) => k.slice(prefix.length)));
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
      if (error && EPHEMERAL.includes(c)) { ready[c] = false; if (c === "listings") marketReady = false; console.warn(`Table ${table(c)} not found: ${c === "listings" ? "Market" : "Status"} is off until you create it.`); break; }
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
// Usernames: 3-20 characters, a-z 0-9 _ . and at least one letter (so they can never be mistaken for a phone number).
const USERNAME_RE = /^(?=.*[a-z])[a-z0-9_.]{3,20}$/;
const normalizeUsername = (s) => String(s || "").trim().replace(/^@/, "").toLowerCase();
function findByUsername(db, name) {
  const n = normalizeUsername(name);
  return n ? db.users.find((u) => u.username === n) : null;
}
// "@john" or "john_k" -> username, "a@b.com" -> email, digits -> phone number
function findByContact(db, query) {
  const q = String(query || "").trim();
  if (q.startsWith("@")) return findByUsername(db, q);
  if (q.includes("@")) return db.users.find((u) => u.email === q.toLowerCase());
  if (/[a-z]/i.test(q)) return findByUsername(db, q);
  return findByPhone(db, normalizePhone(q));
}
const NOT_FOUND_MSG = "No Letschat Africa user with that username, phone number or email";
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
    username: u.username || null,
    about: u.about,
    initials: u.initials,
    color: u.color,
    avatar: avatarUrl(u),
  };
}
// Group members only see each other's name/photo/about, never phone numbers or emails.
const memberView = (u, withContact) => (u ? { id: u.id, verified: isVerified(u), name: u.name, initials: u.initials, color: u.color, avatar: avatarUrl(u), about: u.about, username: u.username || null, ...(withContact ? { phone: u.phone || null, email: u.email || null } : {}) } : null);
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
app.get("/api/status/:id/photo", (req, res) => sendImage(res, (statusesOf(readDB()).find((x) => x.id === req.params.id) || {}).photo));
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
  const { name, about, avatar, username } = req.body;

  // validate everything first so a bad request changes nothing
  if (name !== undefined) {
    const n = String(name).trim();
    if (!n || n.length > 60) return res.status(400).json({ error: "Name must be 1 to 60 characters" });
  }
  if (typeof about === "string" && about.length > 139) {
    return res.status(400).json({ error: "About must be 139 characters or fewer" });
  }
  let newUsername; // undefined = unchanged, "" = remove
  if (username !== undefined && username !== null) {
    newUsername = normalizeUsername(username);
    if (newUsername && !USERNAME_RE.test(newUsername)) return res.status(400).json({ error: "Username must be 3 to 20 characters: letters, numbers, _ or . (at least one letter)" });
    if (newUsername && db.users.some((u) => u.id !== user.id && u.username === newUsername)) return res.status(409).json({ error: "That username is already taken" });
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
  if (newUsername !== undefined) { if (newUsername) user.username = newUsername; else delete user.username; }
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
  const q = req.query.q || req.query.phone;
  if (!q) return res.status(400).json({ error: "q query param required (username, phone number or email)" });
  const db = readDB();
  const user = findByContact(db, q);
  if (!user) return res.status(404).json({ error: NOT_FOUND_MSG });
  if (user.id === req.user.id) return res.status(400).json({ error: "That's you" });
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
    : byId ? db.users.find((u) => u.id === req.body.userId) : findByContact(db, req.body.phone || req.body.q || req.body.username);
  if (!other) return res.status(404).json({ error: NOT_FOUND_MSG });
  if (other.id === req.user.id) return res.status(400).json({ error: "That's you" });

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
  const since = Number(req.query.since) || 0; // ?since=<ms>: the first `limit` messages from that moment on (jump to an old search result)
  const older = all.filter((m) => m.time < before);
  const page = since ? all.filter((m) => m.time >= since).slice(0, limit) : older.slice(-limit);
  res.json({ messages: page.map((m) => receiptView(db, m, req.user, convo)), hasMore: since ? all.some((m) => m.time < since) : older.length > page.length });
});

// ---- search: keyword suggestions + matching messages from your chats and groups ----
// Only text messages in conversations you are in are searched (voice notes, photos, files and deleted messages are skipped).
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'\u2019_-]*/gu;
function searchMessages(db, userId, rawQuery) {
  const raw = String(rawQuery || "").trim().toLowerCase().slice(0, 100);
  const tokens = raw.split(/\s+/).filter(Boolean).slice(0, 6);
  if (!tokens.length) return { query: "", suggestions: [], results: [] };
  const mine = new Set(db.conversations.filter((c) => c.participantIds.includes(userId)).map((c) => c.id));
  const last = tokens[tokens.length - 1], head = tokens.slice(0, -1);
  const prefix = new Map(), inside = new Map(); // word -> how many messages use it
  const hits = [];
  for (const m of db.messages) {
    if (!mine.has(m.conversationId) || m.deleted || m.audio || m.file || typeof m.text !== "string") continue;
    const low = m.text.toLowerCase();
    if (tokens.every((t) => low.includes(t))) hits.push(m);
    if (head.length && !head.every((t) => low.includes(t))) continue;
    const seen = new Set();
    for (const w of low.match(WORD_RE) || []) {
      const word = w.replace(/['\u2019_-]+$/, "");
      if (word.length < 2 || word === last || seen.has(word) || !word.includes(last)) continue;
      seen.add(word);
      const bucket = word.startsWith(last) ? prefix : last.length >= 3 ? inside : null;
      if (bucket) bucket.set(word, (bucket.get(word) || 0) + 1);
    }
  }
  const rank = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1));
  const suggestions = [...rank(prefix), ...rank(inside)].slice(0, 8).map(([word, count]) => ({ text: [...head, word].join(" "), count }));
  const results = hits.sort((a, b) => b.time - a.time).slice(0, 50)
    .map((m) => ({ id: m.id, conversationId: m.conversationId, senderId: m.senderId, mine: m.senderId === userId, time: m.time, text: m.text.slice(0, 500) }));
  return { query: raw, suggestions, results };
}
app.get("/api/search", authMiddleware, (req, res) => res.json(searchMessages(readDB(), req.user.id, req.query.q)));

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
  const ident = req.body.phone || req.body.q || req.body.username;
  if (ident) {
    const u = findByContact(db, ident);
    if (!u) return res.status(404).json({ error: NOT_FOUND_MSG });
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
setTimeout(() => { try { const db = readDB(); const a = purgeExpiredListings(db), b = purgeExpiredStatuses(db); if (a || b) writeDB(db); } catch (e) {} }, 10000).unref();
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

// ---- status: photo or text updates that disappear after 24 hours, visible to the people you chat with ----
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;
function purgeExpiredStatuses(db) {
  const list = db.statuses || (db.statuses = []);
  const cutoff = Date.now() - STATUS_TTL_MS;
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].time < cutoff) { list.splice(i, 1); n++; }
  return n;
}
function statusesOf(db) { purgeExpiredStatuses(db); return db.statuses; }
setInterval(() => {
  try { const db = readDB(); if (purgeExpiredStatuses(db)) writeDB(db); } catch (e) { console.error("Status cleanup failed:", e.message); }
}, 60 * 60 * 1000).unref();
const isBlockedEither = (a, b) => !!a && !!b && ((a.blocked || []).includes(b.id) || (b.blocked || []).includes(a.id));
function canSeeStatus(db, viewerId, ownerId) { // people with a private chat in common, and nobody who is blocked either way
  if (viewerId === ownerId) return true;
  if (!db.conversations.some((c) => !c.isGroup && c.participantIds.includes(viewerId) && c.participantIds.includes(ownerId))) return false;
  return !isBlockedEither(db.users.find((u) => u.id === viewerId), db.users.find((u) => u.id === ownerId));
}
const statusItem = (s, me) => ({ id: s.id, text: s.text || "", bg: s.bg || "#1E8677", photo: s.photo ? `/api/v1/status/${s.id}/photo?v=${s.time}` : null, time: s.time,
  seen: (s.viewedBy || []).includes(me), ...(s.userId === me ? { views: (s.viewedBy || []).length } : {}) });
app.get("/api/status", authMiddleware, (req, res) => {
  const db = readDB();
  const me = req.user.id;
  const live = statusesOf(db).slice().sort((a, b) => a.time - b.time);
  const mine = live.filter((s) => s.userId === me).map((s) => statusItem(s, me));
  const byUser = new Map();
  for (const s of live) if (s.userId !== me && canSeeStatus(db, me, s.userId)) { if (!byUser.has(s.userId)) byUser.set(s.userId, []); byUser.get(s.userId).push(s); }
  const feed = [...byUser.entries()].map(([uid, list]) => ({ user: memberView(db.users.find((u) => u.id === uid)), items: list.map((s) => statusItem(s, me)), latest: list[list.length - 1].time }))
    .filter((g) => g.user)
    .map((g) => ({ ...g, allSeen: g.items.every((i) => i.seen) }))
    .sort((a, b) => (a.allSeen - b.allSeen) || (b.latest - a.latest));
  res.json({ mine, feed });
});
app.post("/api/status", authMiddleware, (req, res) => {
  if (USE_DB && ready.statuses === false) return res.status(503).json({ error: "Status storage is not set up on the server yet" });
  const db = readDB();
  const text = String((req.body && req.body.text) || "").trim();
  const photo = req.body && req.body.photo;
  const bg = /^#[0-9a-f]{6}$/i.test(String((req.body && req.body.bg) || "")) ? req.body.bg : "#1E8677";
  if (!text && !photo) return res.status(400).json({ error: "Add some text or a photo" });
  if ([...text].length > 300) return res.status(400).json({ error: "Status text can be up to 300 characters" });
  if (photo && (typeof photo !== "string" || !AVATAR_RE.test(photo) || !looksLikeImage(photo) || photo.length > 1500000)) return res.status(400).json({ error: "Photo must be a JPG or PNG under about 1 MB" });
  const list = statusesOf(db);
  if (list.filter((s) => s.userId === req.user.id).length >= 30) return res.status(400).json({ error: "You can have up to 30 status updates at a time" });
  const s = { id: nanoid(14), userId: req.user.id, text, bg, photo: photo || null, time: Date.now(), viewedBy: [] };
  list.push(s);
  writeDB(db);
  res.json({ status: statusItem(s, req.user.id) });
});
app.post("/api/status/:id/view", authMiddleware, (req, res) => {
  const db = readDB();
  const s = statusesOf(db).find((x) => x.id === req.params.id);
  if (!s || !canSeeStatus(db, req.user.id, s.userId)) return res.status(404).json({ error: "Status not found. It may have expired." });
  if (s.userId !== req.user.id && !(s.viewedBy || (s.viewedBy = [])).includes(req.user.id)) { s.viewedBy.push(req.user.id); writeDB(db); }
  res.json({ ok: true });
});
app.delete("/api/status/:id", authMiddleware, (req, res) => {
  const db = readDB();
  const list = statusesOf(db);
  const i = list.findIndex((x) => x.id === req.params.id && x.userId === req.user.id);
  if (i < 0) return res.status(404).json({ error: "Status not found" });
  list.splice(i, 1);
  writeDB(db);
  res.json({ ok: true });
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

// ---- voice / video calls: the server only introduces the two phones (signalling); audio and video flow peer to peer (WebRTC) ----
const activeCalls = new Map(); // callId -> { id, from, to, conversationId, video, state, timer }
const userCall = new Map();    // userId -> callId they are in
const RING_MS = 45000;
function endCall(callId, reason) {
  const c = activeCalls.get(callId);
  if (!c) return;
  clearTimeout(c.timer);
  activeCalls.delete(callId);
  if (userCall.get(c.from) === callId) userCall.delete(c.from);
  if (userCall.get(c.to) === callId) userCall.delete(c.to);
  for (const id of [c.from, c.to]) io.to(`user:${id}`).emit("call:ended", { callId, reason });
}
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

// ===================== GAMES HUB (matchmaking, invites, rooms, rankings) =====================
// Rules are shared word-for-word with the client (GAME_RULES in app.jsx) so both sides agree.
const LUDO_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
const SNL_JUMPS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100, 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
const GAME_RULES = {
  ttt: {
    init: () => Array(9).fill(null),
    moves: (s) => s.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0),
    play: (s, m, p) => { const n = s.slice(); n[m] = p; return n; },
    win: (s) => {
      for (const l of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])
        if (s[l[0]] != null && s[l[0]] === s[l[1]] && s[l[1]] === s[l[2]]) return { p: s[l[0]], line: l };
      return null;
    },
  },
  c4: {
    init: () => Array(42).fill(null),
    moves: (s) => [0,1,2,3,4,5,6].filter((c) => s[c] == null),
    play: (s, c, p) => { const n = s.slice(); for (let r = 5; r >= 0; r--) if (n[r * 7 + c] == null) { n[r * 7 + c] = p; break; } return n; },
    win: (s) => {
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
        const p = s[r * 7 + c]; if (p == null) continue;
        for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
          const line = [];
          for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || s[rr * 7 + cc] !== p) break; line.push(rr * 7 + cc); }
          if (line.length === 4) return { p, line };
        }
      }
      return null;
    },
  },
  ludo: {
    // 2 players, 4 pieces each. Piece position: -1 base, 0..50 ring, 51..55 home column, 56 finished.
    init: () => ({ t: [[-1,-1,-1,-1],[-1,-1,-1,-1]], d: null, last: 0, nx: 0 }),
    can: (s, p, i) => { const r = s.t[p][i], d = s.d; if (r === 56 || d == null) return false; if (r === -1) return d === 6; return r + d <= 56; },
    moves: (s, p) => (s.nx !== p ? [] : s.d == null ? [-1] : [0,1,2,3].filter((i) => GAME_RULES.ludo.can(s, p, i))),
    play: (s, m, p, rnd) => {
      const t = s.t.map((a) => a.slice());
      if (m === -1) {
        const d = 1 + Math.floor(rnd() * 6), ns = { t, d, last: d, nx: p };
        if (![0,1,2,3].some((i) => GAME_RULES.ludo.can(ns, p, i))) { ns.d = null; ns.nx = 1 - p; }
        return ns;
      }
      const d = s.d, r = t[p][m], nr = r === -1 ? 0 : r + d; let extra = d === 6; t[p][m] = nr;
      if (nr <= 50) { const a = (p * 26 + nr) % 52; if (!LUDO_SAFE.includes(a)) { const q = 1 - p; t[q].forEach((qr, j) => { if (qr >= 0 && qr <= 50 && (q * 26 + qr) % 52 === a) { t[q][j] = -1; extra = true; } }); } }
      if (nr === 56) extra = true;
      return { t, d: null, last: d, nx: extra ? p : 1 - p };
    },
    win: (s) => { for (const p of [0, 1]) if (s.t[p].every((r) => r === 56)) return { p, line: null }; return null; },
    next: (s) => s.nx,
    draw: () => false,
  },
  snl: {
    // Snakes & Ladders, 2 players, squares 1..100 (0 = not started). Exact roll needed to finish on 100.
    init: () => ({ p: [0, 0], last: 0, nx: 0, ev: 0 }),
    moves: (s, p) => (s.nx === p ? [-1] : []),
    play: (s, m, p, rnd) => {
      const d = 1 + Math.floor(rnd() * 6), pos = s.p.slice(); let np = pos[p] + d; if (np > 100) np = pos[p];
      const jump = SNL_JUMPS[np], ev = jump ? (jump > np ? 1 : -1) : 0; if (jump) np = jump; pos[p] = np;
      return { p: pos, last: d, nx: d === 6 && np !== 100 ? p : 1 - p, ev };
    },
    win: (s) => { for (const p of [0, 1]) if (s.p[p] === 100) return { p, line: null }; return null; },
    next: (s) => s.nx,
    draw: () => false,
  },
};
const GAME_IDS = Object.keys(GAME_RULES);
const COUNTRY_PREFIX = [["234","NG"],["233","GH"],["254","KE"],["255","TZ"],["256","UG"],["27","ZA"],["20","EG"],["44","GB"],["1","US"]];
const countryOf = (u) => { const d = String(u.phone || "").replace(/\D/g, ""); const hit = COUNTRY_PREFIX.find(([p]) => d.startsWith(p)); return hit ? hit[1] : ""; };

const gQueue = new Map();   // userId -> { game, since }   (looking for an opponent)
const gPlaying = new Map(); // userId -> roomId
const gRooms = new Map();   // roomId -> room
const gInvites = new Map(); // inviteId -> { from, to, game, at }
const gRecent = [];         // recent finished games for the lobby

const gStatsOf = (db, id) => { db.gameStats = db.gameStats || {}; return (db.gameStats[id] = db.gameStats[id] || { xp: 0, w: 0, l: 0, d: 0, streak: 0, best: 0, fav: {} }); };
const gLevel = (xp) => Math.floor(xp / 100) + 1;
function gCard(db, id) {
  const u = db.users.find((x) => x.id === id); if (!u) return null;
  const s = gStatsOf(db, id);
  const fav = Object.entries(s.fav).sort((a, b) => b[1] - a[1])[0];
  const status = gPlaying.has(id) ? "playing" : gQueue.has(id) ? "looking" : userSockets.has(id) ? "online" : "offline";
  return { ...publicUser(u), phone: null, email: null, country: countryOf(u), level: gLevel(s.xp), xp: s.xp, w: s.w, l: s.l, d: s.d, streak: s.streak, best: s.best, fav: fav ? fav[0] : null, status, looking: gQueue.has(id) ? gQueue.get(id).game : null };
}
function gRecord(userId, game, result, pvp, level) {
  const db = readDB(); const s = gStatsOf(db, userId);
  const gain = pvp ? { w: 30, d: 10, l: 5 }[result] : { w: 8 + 4 * (level || 0), d: 3, l: 1 }[result];
  s.xp += gain; s[result] += 1; s.fav[game] = (s.fav[game] || 0) + 1;
  if (result === "w") { s.streak += 1; s.best = Math.max(s.best, s.streak); } else if (result === "l") s.streak = 0;
  db.gameLog = db.gameLog || []; db.gameLog.push({ u: userId, t: Date.now(), r: result, p: pvp ? 1 : 0, x: gain });
  if (db.gameLog.length > 6000) db.gameLog.splice(0, db.gameLog.length - 6000);
  writeDB(db); return { gain, xp: s.xp, level: gLevel(s.xp), streak: s.streak };
}
function gStart(game, a, b) {
  const db = readDB(); const id = nanoid(10);
  const players = Math.random() < 0.5 ? [a, b] : [b, a];
  const room = { id, game, players, turn: 0, state: GAME_RULES[game].init(), over: false, rematch: new Set(), score: [0, 0], chat: [] };
  gRooms.set(id, room); for (const p of players) { gPlaying.set(p, id); gQueue.delete(p); }
  const cards = players.map((p) => gCard(db, p));
  players.forEach((p, i) => io.to(`user:${p}`).emit("game:start", { room: id, game, you: i, players: cards, turn: 0, state: room.state, score: room.score }));
  return room;
}
function gFinish(room, winnerIdx) {
  room.over = true;
  const [a, b] = room.players; const out = {};
  if (winnerIdx < 0) { out[a] = gRecord(a, room.game, "d", true); out[b] = gRecord(b, room.game, "d", true); }
  else { room.score[winnerIdx] += 1; const w = room.players[winnerIdx], l = room.players[1 - winnerIdx]; out[w] = gRecord(w, room.game, "w", true); out[l] = gRecord(l, room.game, "l", true); }
  gRecent.unshift({ game: room.game, a, b, w: winnerIdx < 0 ? null : room.players[winnerIdx], t: Date.now() }); gRecent.length = Math.min(gRecent.length, 20);
  return out;
}
function gLeave(userId) {
  const rid = gPlaying.get(userId); gQueue.delete(userId); if (!rid) return;
  const room = gRooms.get(rid); gPlaying.delete(userId); if (!room) return;
  const idx = room.players.indexOf(userId), other = room.players[1 - idx];
  if (!room.over) { const rec = gFinish(room, 1 - idx); io.to(`user:${other}`).emit("game:over", { room: rid, winner: 1 - idx, line: null, forfeit: true, score: room.score, reward: rec[other], result: "w" }); }
  io.to(`user:${other}`).emit("game:left", { room: rid });
  gPlaying.delete(other); gRooms.delete(rid);
}
function registerGames(socket) {
  const me = socket.userId; const ack = (f, v) => { if (typeof f === "function") f(v); };
  socket.on("game:lobby", (f) => {
    const db = readDB(); const ids = db.users.map((u) => u.id).filter((id) => id !== me && (userSockets.has(id) || gPlaying.has(id)));
    ack(f, { players: ids.map((id) => gCard(db, id)).filter(Boolean), recent: gRecent.slice(0, 8).map((r) => ({ ...r, aName: (db.users.find((u) => u.id === r.a) || {}).name, bName: (db.users.find((u) => u.id === r.b) || {}).name })), me: gCard(db, me) });
  });
  socket.on("game:find", ({ game } = {}, f) => {
    if (!GAME_RULES[game] || gPlaying.has(me)) return ack(f, { ok: false });
    for (const [id, q] of gQueue) if (id !== me && q.game === game) { gStart(game, id, me); return ack(f, { ok: true, matched: true }); }
    gQueue.set(me, { game, since: Date.now() }); ack(f, { ok: true, matched: false });
  });
  socket.on("game:cancel", () => gQueue.delete(me));
  socket.on("game:invite", ({ to, game, kind } = {}, f) => {
    if (!GAME_RULES[game] || !to || to === me || !userSockets.has(to) || gPlaying.has(to) || gPlaying.has(me)) return ack(f, { ok: false, reason: gPlaying.has(to) ? "busy" : "offline" });
    const id = nanoid(8); gInvites.set(id, { from: me, to, game, at: Date.now() });
    setTimeout(() => { const iv = gInvites.get(id); if (iv) { gInvites.delete(id); io.to(`user:${iv.from}`).emit("game:invite-expired", { id }); } }, 120000);
    const db = readDB(); io.to(`user:${to}`).emit("game:invite", { id, game, kind: kind === "challenge" ? "challenge" : "invite", from: gCard(db, me) }); ack(f, { ok: true, id });
  });
  socket.on("game:respond", ({ id, accept } = {}) => {
    const iv = gInvites.get(id); if (!iv || iv.to !== me) return; gInvites.delete(id);
    if (!accept) return void io.to(`user:${iv.from}`).emit("game:declined", { id, by: gCard(readDB(), me) });
    if (gPlaying.has(iv.from) || gPlaying.has(me)) return;
    io.to(`user:${iv.from}`).emit("game:accepted", { id, by: gCard(readDB(), me) }); gStart(iv.game, iv.from, me);
  });
  socket.on("game:move", ({ room: rid, move } = {}) => {
    const room = gRooms.get(rid); if (!room || room.over) return;
    const idx = room.players.indexOf(me); if (idx !== room.turn) return;
    const R = GAME_RULES[room.game]; if (!R.moves(room.state, idx).includes(move)) return;
    room.state = R.play(room.state, move, idx, Math.random);
    const w = R.win(room.state); const full = R.draw ? R.draw(room.state) : R.moves(room.state).length === 0;
    if (w || full) {
      const rec = gFinish(room, w ? w.p : -1);
      room.players.forEach((p, i) => { io.to(`user:${p}`).emit("game:move", { room: rid, state: room.state, turn: -1, last: move, by: idx }); io.to(`user:${p}`).emit("game:over", { room: rid, winner: w ? w.p : -1, line: w ? w.line : null, score: room.score, reward: rec[p], result: w ? (w.p === i ? "w" : "l") : "d" }); });
    } else { room.turn = R.next ? R.next(room.state) : 1 - idx; room.players.forEach((p) => io.to(`user:${p}`).emit("game:move", { room: rid, state: room.state, turn: room.turn, last: move, by: idx, next: room.players[room.turn] })); }
  });
  const relay = (ev) => socket.on(ev, ({ room: rid, text, emoji } = {}) => {
    const room = gRooms.get(rid); if (!room || !room.players.includes(me)) return;
    const body = ev === "game:chat" ? String(text || "").slice(0, 300) : String(emoji || "").slice(0, 8); if (!body) return;
    room.players.forEach((p) => io.to(`user:${p}`).emit(ev, { room: rid, from: me, text: body, emoji: body, at: Date.now() }));
  });
  relay("game:chat"); relay("game:react");
  socket.on("game:rematch", ({ room: rid } = {}) => {
    const room = gRooms.get(rid); if (!room || !room.over || !room.players.includes(me)) return;
    room.rematch.add(me); const other = room.players.find((p) => p !== me);
    if (room.rematch.size < 2) return void io.to(`user:${other}`).emit("game:rematch-request", { room: rid, from: gCard(readDB(), me) });
    room.state = GAME_RULES[room.game].init(); room.players.reverse(); room.score.reverse(); room.turn = 0; room.over = false; room.rematch.clear();
    const cards = room.players.map((p) => gCard(readDB(), p));
    room.players.forEach((p, i) => io.to(`user:${p}`).emit("game:start", { room: rid, game: room.game, you: i, players: cards, turn: 0, state: room.state, score: room.score, rematch: true }));
  });
  socket.on("game:leave", () => gLeave(me));
  socket.on("game:solo", ({ game, level, result } = {}, f) => {
    if (!GAME_RULES[game] || !["w", "l", "d"].includes(result)) return;
    ack(f, gRecord(me, game, result, false, Math.max(0, Math.min(3, Number(level) || 0))));
  });
  socket.on("game:board", ({ period } = {}, f) => {
    const db = readDB(); const span = { day: 864e5, week: 6048e5, month: 2592e6 }[period] || 864e5; const since = Date.now() - span; const tally = {};
    for (const e of db.gameLog || []) if (e.t >= since && e.p) { const t = (tally[e.u] = tally[e.u] || { w: 0, l: 0, d: 0, xp: 0 }); t[e.r] += 1; t.xp += e.x; }
    const rows = Object.entries(tally).sort((a, b) => b[1].w - a[1].w || b[1].xp - a[1].xp).slice(0, 20).map(([id, t], i) => ({ rank: i + 1, ...t, user: gCard(db, id) })).filter((r) => r.user);
    ack(f, { rows, me: gCard(db, me) });
  });
  socket.on("disconnect", () => { if (!userSockets.has(me)) gLeave(me); });
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

  // ---- edit / delete your own messages (everyone in the chat sees the change live) ----
  // Delete works any time. Text edits are allowed for EDIT_WINDOW_MS after sending (0 = no limit).
  const EDIT_WINDOW_MS = 15 * 60 * 1000;
  const ownMessage = (messageId, fail) => {
    const db = readDB();
    const m = db.messages.find((x) => x.id === messageId);
    const convo = m && db.conversations.find((c) => c.id === m.conversationId);
    if (!m || !convo || !convo.participantIds.includes(userId)) { fail("Message not found"); return null; }
    if (m.senderId !== userId) { fail("You can only change your own messages"); return null; }
    return { db, m };
  };
  socket.on("message:edit", ({ messageId, text } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const o = ownMessage(messageId, fail); if (!o) return;
    const { db, m } = o;
    if (m.deleted) return fail("This message was deleted");
    if (m.audio || m.file) return fail("Only text messages can be edited");
    if (EDIT_WINDOW_MS && Date.now() - m.time > EDIT_WINDOW_MS) return fail("Messages can only be edited for 15 minutes after sending");
    const t = String(text || "").trim();
    if (!t) return fail("Message text required");
    if (t.length > 4000) return fail("Message is too long (max 4000 characters)");
    if (t !== m.text) {
      m.text = t; m.edited = true; m.editedAt = Date.now();
      writeDB(db);
      io.to(`conv:${m.conversationId}`).emit("message:updated", m);
    }
    if (typeof ack === "function") ack({ message: m });
  });
  socket.on("message:delete", ({ messageId } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const o = ownMessage(messageId, fail); if (!o) return;
    const { db, m } = o;
    if (!m.deleted) {
      // keep the row (so the chat shows "This message was deleted") but drop the content, audio and file bytes for good
      delete m.audio; delete m.duration; delete m.file; delete m.edited; delete m.editedAt;
      m.text = "🚫 This message was deleted"; m.deleted = true; m.deletedAt = Date.now();
      writeDB(db);
      io.to(`conv:${m.conversationId}`).emit("message:updated", m);
    }
    if (typeof ack === "function") ack({ message: m });
  });

  socket.on("call:invite", ({ to, conversationId, video } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const db = readDB();
    const convo = db.conversations.find((c) => c.id === conversationId && !c.isGroup && c.participantIds.includes(userId) && c.participantIds.includes(to));
    const me = db.users.find((u) => u.id === userId), other = db.users.find((u) => u.id === to);
    if (!convo || !other || to === userId) return fail("You can only call people you chat with");
    if ((me.blocked || []).includes(to)) return fail("You blocked this contact. Unblock them to call.");
    if ((other.blocked || []).includes(userId)) return fail("This call couldn't be connected.");
    if (userCall.has(userId)) return fail("You are already in a call");
    const first = String(other.name || "They").split(" ")[0];
    if (!userSockets.has(to)) return fail(first + " is offline right now");
    if (userCall.has(to)) return fail(first + " is on another call");
    const id = nanoid(12);
    const call = { id, from: userId, to, conversationId, video: !!video, state: "ringing", timer: setTimeout(() => endCall(id, "missed"), RING_MS) };
    activeCalls.set(id, call);
    userCall.set(userId, id);
    userCall.set(to, id);
    io.to(`user:${to}`).emit("call:incoming", { callId: id, conversationId, video: !!video, from: memberView(me) });
    if (typeof ack === "function") ack({ callId: id });
  });
  socket.on("call:answer", ({ callId, accept, reason } = {}) => {
    const c = activeCalls.get(callId);
    if (!c || c.to !== userId || c.state !== "ringing") return;
    if (!accept) return endCall(callId, reason === "unavailable" ? "unavailable" : "declined");
    c.state = "active";
    clearTimeout(c.timer);
    io.to(`user:${c.from}`).emit("call:accepted", { callId });
  });
  socket.on("call:signal", ({ callId, data } = {}) => {
    const c = activeCalls.get(callId);
    if (!c || (c.from !== userId && c.to !== userId) || !data || typeof data !== "object") return;
    if (JSON.stringify(data).length > 20000) return;
    io.to(`user:${c.from === userId ? c.to : c.from}`).emit("call:signal", { callId, data });
  });
  socket.on("call:end", ({ callId } = {}) => {
    const c = activeCalls.get(callId);
    if (c && (c.from === userId || c.to === userId)) endCall(callId, "ended");
  });

  registerGames(socket);

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
        if (userCall.has(userId)) endCall(userCall.get(userId), "failed");
        if (!hidesPresence(readDB().users.find((u) => u.id === userId))) io.emit("presence:update", { userId, online: false, lastSeen: lastSeen.get(userId) });
      }
    }
  });
});

initDB()
  .then(() => server.listen(PORT, () => console.log(`Letschat Africa server listening on port ${PORT}`)))
  .catch((e) => { console.error("Could not start (database error):", e); process.exit(1); });
