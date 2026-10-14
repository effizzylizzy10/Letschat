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
const pendingDeletes = []; // { c, id }: rows removed from memory (expired messages) that must also leave Supabase

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
  while (pendingDeletes.length) { // expired disappearing messages: delete their rows so they never come back after a restart
    const batch = pendingDeletes.splice(0, 100), byC = {};
    for (const d of batch) (byC[d.c] || (byC[d.c] = [])).push(d.id);
    for (const c in byC) {
      const { error } = await supabase.from(table(c)).delete().in("id", byC[c]);
      if (error) { pendingDeletes.unshift(...byC[c].map((id) => ({ c, id }))); throw new Error(error.message); }
      for (const id of byC[c]) saved.delete(c + "/" + id);
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
// Creator/owner: set CREATOR_EMAILS on the server (comma-separated). Only an email that Firebase has
// verified (e.g. Google sign-in) can ever match, so typing someone's email is never enough.
const CREATOR_LIST = (process.env.CREATOR_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const isCreator = (u) => !!u && !!u.email && CREATOR_LIST.includes(String(u.email).toLowerCase());
const YT_RE = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i; // only the creator may share YouTube links
const YT_MSG = "Only the creator can share YouTube links";
const isVerified = (u) => !!u && (isCreator(u) || !!u.verifiedByCreator || VERIFIED_LIST.some((v) => v === String(u.id).toLowerCase() || (u.email && v === String(u.email).toLowerCase()) || (!v.includes("@") && u.phone && v.replace(/\D/g, "") && v.replace(/\D/g, "") === normalizePhone(u.phone))));
function publicUser(u) {
  return {
    id: u.id,
    verified: isVerified(u),
    creator: isCreator(u),
    name: isCreator(u) ? "letschatafrica" : u.name,
    phone: u.phone || null, email: u.email || null,
    username: u.username || null,
    about: u.about,
    initials: u.initials,
    color: u.color,
    avatar: avatarUrl(u),
    business: u.business || undefined, // optional: { category, address, hours, open } for business accounts
  };
}
// ---- which country each person is chatting from (flag on their avatar in the Chat Room only) ----
// Country comes from, strongest first: the connection (a country header from the host/CDN), the phone's time zone, the phone's language,
// and finally the country code of their phone number. Only the country is kept, never an IP address.
const GEO = require("./geo");
const GEO_RANK = { lang: 1, tz: 2, ip: 3 }, GEO_DAY = 24 * 3600 * 1000;
const userCountry = (u) => (u && (u.country || countryOf(u))) || "";
// remembers where a person is chatting from; returns true when the record changed (the caller saves the database)
function noteCountry(db, u, cc, src) {
  if (!u || !cc || !GEO_RANK[src]) return false;
  const now = Date.now(), recent = now - (u.countryAt || 0) < 3 * GEO_DAY;
  if (u.country && recent && (GEO_RANK[u.countrySrc] || 0) > GEO_RANK[src]) return false; // a weaker guess never overrides recent, better evidence
  if (u.country === cc && u.countrySrc === src && now - (u.countryAt || 0) < GEO_DAY / 2) return false; // nothing new (saves a database write)
  u.country = cc; u.countrySrc = src; u.countryAt = now;
  return true;
}
// Group members only see each other's name/photo/about, never phone numbers or emails. The Chat Room also shows each member's country.
const memberView = (u, withContact, withCountry) => (u ? { id: u.id, verified: isVerified(u), name: isCreator(u) ? "letschatafrica" : u.name, initials: isCreator(u) ? "LA" : u.initials, color: u.color, avatar: avatarUrl(u), about: u.about, username: u.username || null, ...(withContact ? { phone: u.phone || null, email: u.email || null } : {}), ...(withCountry ? { country: userCountry(u) } : {}) } : null);
// who may change a group: its admin; in the Chat Room only the creator account (CREATOR_EMAILS), nobody else
const isGroupBoss = (db, c, uid) => (c.chatRoom ? isCreator(db.users.find((u) => u.id === uid)) : c.adminId === uid);
function groupView(db, c, uid, preMsgs) {
  let msgs = preMsgs || db.messages.filter((m) => m.conversationId === c.id);
  if (c.chatRoom) msgs = msgs.filter((m) => !m.bot && !m.ai); // Chat Room: no AI messages (old ones are hidden, not deleted)
  const boss = isGroupBoss(db, c, uid); // the admin (in the Chat Room: the creator)
  return {
    id: c.id, isGroup: true, name: c.name, adminId: c.chatRoom && boss ? uid : c.adminId, description: c.description || "",
    avatar: c.avatar ? `/api/v1/groups/${c.id}/avatar?v=${c.avatarVersion || 1}` : null,
    dmRequests: (c.dmRequests || []).filter((r) => (boss ? r.status === "pending" : r.from === uid)),
    members: (c.chatRoom && c.participantIds.length > 300
      ? [...c.participantIds].sort((a, b) => (b === uid) - (a === uid) || (userSockets.has(b) ? 1 : 0) - (userSockets.has(a) ? 1 : 0)).slice(0, 300)
      : c.participantIds).map((id) => memberView(db.users.find((u) => u.id === id), boss, !!c.chatRoom)).filter(Boolean),
    ...(c.chatRoom ? { chatRoom: true, memberCount: c.participantIds.length } : {}),
    inviteCode: boss ? c.inviteCode : undefined, // only the admin ever receives the link
    disappearAfter: c.disappearAfter || 0,
    ai: !c.chatRoom && c.ai && c.ai.on ? { on: true, rules: c.ai.rules || [] } : { on: false }, // the Chat Room never has an AI moderator
    pinnedMsgs: livePins(c, msgs),
    lastMessage: lite(receiptView(db, msgs[msgs.length - 1], db.users.find((u) => u.id === uid) || { id: uid }, c)) || null,
    unread: msgs.filter((m) => m.senderId !== uid && !(m.readBy || []).includes(uid)).length,
    updatedAt: c.updatedAt || c.createdAt,
  };
}
// pinned messages (max 3 per chat): only the ones that still exist are shown, so deleted/expired messages unpin themselves
function livePins(c, msgs) {
  const pins = c.pinnedMsgs || [];
  if (!pins.length) return [];
  return pins.filter((p) => msgs.some((m) => m.id === p.id && !m.deleted));
}
// Chat lists only need a preview, never the audio/file bytes.
function lite(m) {
  if (!m || (!m.audio && !m.file)) return m;
  const { audio, file, ...rest } = m;
  return { ...rest, ...(audio ? { hasAudio: true } : {}), ...(file ? { file: { name: file.name, mime: file.mime, size: file.size } } : {}) };
}
// Tell everyone in the chat that messages were just read, so ticks turn green live (only if the reader keeps read receipts on).
function announceRead(db, convo, readerId, ids) {
  if (!ids.length) return;
  const reader = db.users.find((u) => u.id === readerId);
  if (reader && !privacyOf(reader).readReceipts) return;
  io.to(`conv:${convo.id}`).emit("message:read", { conversationId: convo.id, by: readerId, ids, at: Date.now() });
  io.to(`conv:${convo.id}`).emit("conversation:update", { id: convo.id });
}
// A sender only sees "read" ticks if both sides keep read receipts on.
function receiptView(db, m, viewer, convo) {
  if (!m || m.senderId !== viewer.id) return m;
  const on = (id) => { const u = db.users.find((x) => x.id === id); return !!u && privacyOf(u).readReceipts; };
  if (!privacyOf(viewer).readReceipts) { const { readAt, readTimes, ...rest } = m; return { ...rest, read: false, readBy: [] }; }
  if (convo && convo.isGroup) { const ok = (m.readBy || []).filter(on); const rt = {}; for (const id of ok) if (m.readTimes && m.readTimes[id]) rt[id] = m.readTimes[id]; return { ...m, readBy: ok, readTimes: rt }; }
  const otherId = convo && convo.participantIds.find((id) => id !== viewer.id);
  if (otherId && !on(otherId)) { const { readAt, ...rest } = m; return { ...rest, read: false }; }
  return m;
}
const PALETTE = ["#35D0BA", "#F2B84B", "#8B7CF6", "#FF6B5D", "#5B6673", "#4FA8E0"];
function colorFor(id) {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return PALETTE[sum % PALETTE.length];
}


const app = express();
app.use(require("./compress")()); // Brotli/gzip for JSON replies (no extra package needed)
app.use(cors({ origin: CLIENT_ORIGIN === "*" ? "*" : CLIENT_ORIGIN.split(",") }));
// gzip/brotli-style compression for JSON and text responses (chat history is mostly text, so it shrinks a lot); skipped quietly if the package is missing
try { app.use(require("compression")()); } catch (e) { console.warn("compression not installed: responses are sent uncompressed"); }
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
app.get("/api/status/:id/music", (req, res) => {
  const s = statusesOf(readDB()).find((x) => x.id === req.params.id);
  const m = s && s.music && /^data:audio\/wav;base64,(.+)$/s.exec(s.music);
  if (!m) return res.status(404).type("text/plain").send("No music");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.type("audio/wav").send(Buffer.from(m[1], "base64"));
});
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
    if (user.suspended) return res.status(403).json({ error: "This account has been suspended" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true, storage: USE_DB ? "supabase" : "file", version: API_VERSION, uptime: Math.round(process.uptime()) }));

// Turns a verified Firebase login into a Letschat user + token (shared by /api/auth/firebase and the /lite sign-in page).
function firebaseSignIn(decoded, nameFromBody) {
  const phone = decoded.phone_number ? normalizePhone(decoded.phone_number) : null;
  const email = decoded.email && decoded.email_verified ? decoded.email.toLowerCase() : null;

  const db = readDB();
  let user =
    db.users.find((u) => u.firebaseUid === decoded.uid) ||
    findByPhone(db, phone) ||
    (email && db.users.find((u) => u.email === email)) ||
    null;

  if (!user) {
    const name = String(decoded.name || nameFromBody || "").trim();
    if (!name) return { status: 400, body: { error: "Name required for new accounts", newUser: true } };
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
  if (user.suspended) return { status: 403, body: { error: "This account has been suspended" } };
  return { status: 200, body: { token: signToken(user), user: publicUser(user) } };
}

app.post("/api/auth/firebase", async (req, res) => {
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(String(req.body.idToken || ""));
  } catch (e) {
    console.error("Firebase token check failed:", e.message);
    return res.status(401).json({ error: "Sign-in could not be verified. Please try again." });
  }
  const r = firebaseSignIn(decoded, req.body.name);
  res.status(r.status).json(r.body);
});

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---- creator tools: only accounts whose Firebase-verified email is in CREATOR_EMAILS ----
function creatorOnly(req, res, next) {
  if (!isCreator(req.user)) return res.status(403).json({ error: "Creator access only" });
  next();
}
const adminView = (u) => ({ ...publicUser(u), suspended: !!u.suspended, verifiedByCreator: !!u.verifiedByCreator, createdAt: u.createdAt || null });
app.get("/api/creator/users", authMiddleware, creatorOnly, (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const users = readDB().users
    .filter((u) => !q || [u.name, u.username, u.email, u.phone].some((v) => v && String(v).toLowerCase().includes(q)))
    .slice(0, 200).map(adminView);
  res.json({ users });
});
function setUserFlag(flag, value) {
  return (req, res) => {
    const db = readDB();
    const u = db.users.find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ error: "User not found" });
    if (isCreator(u) && flag === "suspended") return res.status(400).json({ error: "You can't suspend the creator account" });
    u[flag] = value;
    writeDB(db);
    res.json({ user: adminView(u) });
  };
}
app.post("/api/creator/users/:id/suspend", authMiddleware, creatorOnly, setUserFlag("suspended", true));
app.post("/api/creator/users/:id/unsuspend", authMiddleware, creatorOnly, setUserFlag("suspended", false));
app.post("/api/creator/users/:id/verify", authMiddleware, creatorOnly, setUserFlag("verifiedByCreator", true));
app.post("/api/creator/users/:id/unverify", authMiddleware, creatorOnly, setUserFlag("verifiedByCreator", false));

// ---- creator moderation: listings + announcements ----
app.get("/api/creator/listings", authMiddleware, creatorOnly, (req, res) => {
  const db = readDB(); const q = String(req.query.q || "").toLowerCase();
  const listings = listingsOf(db)
    .filter((l) => !q || (String(l.title || "") + " " + String(l.description || "")).toLowerCase().includes(q))
    .sort((a, b) => b.time - a.time).slice(0, 100)
    .map((l) => { const s = db.users.find((u) => u.id === l.sellerId); return { id: l.id, title: l.title, price: l.price, seller: s ? s.name : "Unknown", removed: !!l.removed, time: l.time }; });
  res.json({ listings });
});
function setListingRemoved(value) {
  return (req, res) => {
    const db = readDB(); const l = listingsOf(db).find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: "Listing not found" });
    l.removed = value; writeDB(db);
    res.json({ id: l.id, removed: !!l.removed });
  };
}
app.post("/api/creator/listings/:id/remove", authMiddleware, creatorOnly, setListingRemoved(true));
app.post("/api/creator/listings/:id/restore", authMiddleware, creatorOnly, setListingRemoved(false));
// Announcement = push notification to every device that has notifications on (needs the VAPID keys on the server).
// ---- Tools > How to: YouTube videos. Only the creator can post or remove them; everybody can watch (stored in the creator's user record) ----
function ytId(url) {
  const m = /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/]|$)/i.exec(String(url || "").trim());
  return m ? m[1] : "";
}
function howtoOf(db) { const boss = db.users.find((u) => isCreator(u)); return { boss, list: boss ? (Array.isArray(boss.howto) ? boss.howto : (boss.howto = [])) : [] }; }
const howtoView = (list) => list.map((v) => ({ id: v.id, title: v.title, url: v.url, vid: v.vid, time: v.time }));
app.get("/api/howto", authMiddleware, (req, res) => res.json({ videos: howtoView(howtoOf(readDB()).list) }));
app.post("/api/creator/howto", authMiddleware, creatorOnly, (req, res) => {
  const title = String(req.body.title || "").replace(/\s+/g, " ").trim().slice(0, 80), vid = ytId(req.body.url);
  if (!title) return res.status(400).json({ error: "Type a title for the video" });
  if (!vid) return res.status(400).json({ error: "Paste a YouTube link (youtube.com or youtu.be)" });
  const db = readDB(), { boss, list } = howtoOf(db);
  if (!boss) return res.status(404).json({ error: "Creator account not found" });
  if (list.length >= 30) return res.status(400).json({ error: "You can keep up to 30 videos. Remove one first." });
  list.unshift({ id: nanoid(8), title, vid, url: "https://www.youtube.com/watch?v=" + vid, time: Date.now() });
  writeDB(db); res.json({ videos: howtoView(list) });
});
app.delete("/api/creator/howto/:id", authMiddleware, creatorOnly, (req, res) => {
  const db = readDB(), { boss, list } = howtoOf(db);
  if (!boss) return res.status(404).json({ error: "Creator account not found" });
  const i = list.findIndex((v) => v.id === req.params.id);
  if (i >= 0) { list.splice(i, 1); writeDB(db); }
  res.json({ videos: howtoView(list) });
});
app.post("/api/creator/announce", authMiddleware, creatorOnly, async (req, res) => {
  const title = String((req.body && req.body.title) || "").trim().slice(0, 80);
  const body = String((req.body && req.body.body) || "").trim().slice(0, 300);
  if (!title || !body) return res.status(400).json({ error: "Title and message are required" });
  if (!PUSH_ON) return res.status(400).json({ error: "Push notifications are not set up yet (add the VAPID keys on the server)" });
  const db = readDB(); let sent = 0, failed = 0;
  for (const u of db.users) {
    for (const sub of (u.pushSubs || [])) {
      if (sent + failed >= 500) break;
      try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title, body, tag: "announce", url: "./" }), { TTL: 86400 }); sent++; } catch (e) { failed++; }
    }
  }
  res.json({ sent, failed });
});


// ---- Letschat Creator: broadcast, rules (added by creator-loader.js) ----
const DEFAULT_RULES = "1. Be respectful to everyone.\n2. No hate speech, harassment or threats.\n3. No spam, scams or fake accounts.\n4. No adult or violent content.\n5. Only the creator may share YouTube links.\nBreaking these rules can get your account blocked.";
app.get("/api/rules", authMiddleware, (req, res) => {
  const c = readDB().users.find((u) => isCreator(u));
  res.json({ rules: (c && c.rulesText) || DEFAULT_RULES });
});
app.put("/api/creator/rules", authMiddleware, creatorOnly, (req, res) => {
  const text = String((req.body && req.body.rules) || "").trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: "Rules can't be empty" });
  const db = readDB(); const me = db.users.find((u) => u.id === req.user.id);
  me.rulesText = text; writeDB(db);
  res.json({ rules: text });
});
// In-app broadcast: lands as a chat message from the creator in every member's inbox.
app.post("/api/creator/broadcast", authMiddleware, creatorOnly, (req, res) => {
  const text = String((req.body && req.body.text) || "").trim();
  if (!text) return res.status(400).json({ error: "Write a message to broadcast" });
  if (text.length > 4000) return res.status(400).json({ error: "Broadcast is too long (max 4000 characters)" });
  const db = readDB(); const me = db.users.find((u) => u.id === req.user.id);
  const sent = []; let n = 0;
  const dm = new Map(); // existing private chats with the creator, looked up once instead of once per member
  for (const c of db.conversations) if (!c.isGroup && c.participantIds.includes(me.id)) dm.set(c.participantIds.find((x) => x !== me.id), c);
  for (const u of db.users.slice(0, 5000)) {
    if (u.id === me.id || u.suspended || (u.blocked || []).includes(me.id)) continue;
    const convo = dm.get(u.id) || ensureDM(db, me.id, u.id);
    const live = userSockets.get(u.id);
    const message = { id: nanoid(14), conversationId: convo.id, senderId: me.id, text, time: Date.now(), read: false, broadcast: true, ...(live && live.size ? { delivered: true } : {}) };
    db.messages.push(message); convo.updatedAt = Date.now(); sent.push([convo, message]); n++;
  }
  writeDB(db);
  res.json({ sent: n });
  // deliver in small batches so a big broadcast never freezes chats for everyone else
  let i = 0;
  const step = () => {
    for (const end = Math.min(i + 100, sent.length); i < end; i++) {
      const [convo, message] = sent[i];
      io.to("conv:" + convo.id).emit("message:new", stripViewOnce(message));
      try { pushMessage(db, convo, message, me.id); } catch (e) { /* push is best effort */ }
    }
    if (i < sent.length) setImmediate(step);
  };
  step();
});

// ---- restore from a backup file: puts back the messages YOU sent that are missing (never other people's words) ----
app.post("/api/me/restore", authMiddleware, rateLimit({ windowMs: 60000, max: 60 }), (req, res) => {
  const list = Array.isArray(req.body && req.body.conversations) ? req.body.conversations.slice(0, 30) : [];
  const db = readDB(); const me = req.user.id; const meUser = db.users.find((u) => u.id === me);
  const have = new Set(db.messages.map((m) => m.id));
  let restored = 0, skipped = 0;
  for (const c of list) {
    const msgs = Array.isArray(c && c.messages) ? c.messages.slice(0, 600) : [];
    let convo = db.conversations.find((x) => x.id === (c && c.id) && x.participantIds.includes(me));
    if (!convo && c && !c.isGroup) { // the private chat is gone: recreate it with the one other person in it
      const others = [...new Set(msgs.map((m) => m && m.senderId).filter((id) => id && id !== me))];
      const other = others.length === 1 ? db.users.find((u) => u.id === others[0]) : null;
      if (other && !isBlockedEither(meUser, other)) convo = ensureDM(db, me, other.id);
    }
    if (!convo || Number(convo.disappearAfter)) { skipped += msgs.length; continue; }
    for (const m of msgs) {
      const text = m ? String(m.text || "").slice(0, 15000) : "";
      if (!m || m.senderId !== me || m.deleted || !/^[\w-]{6,40}$/.test(String(m.id)) || have.has(m.id) || !text.trim() || (YT_RE.test(text) && !isCreator(meUser))) { skipped++; continue; }
      const msg = { id: m.id, conversationId: convo.id, senderId: me, text, time: Math.min(Number(m.time) || Date.now(), Date.now()), read: true, restored: true };
      const f = m.file;
      if (f && typeof f === "object" && typeof f.data === "string") {
        const mm = /^data:([\w.+-]+\/[\w.+-]+)?(?:;[\w=.+-]+)*;base64,/.exec(f.data);
        const mime = mm ? (mm[1] || "application/octet-stream").toLowerCase() : "";
        if (!mm || f.data.length > 4200000 || /^(text\/html|image\/svg|application\/xhtml|text\/javascript|application\/javascript|application\/x-msdownload)/.test(mime)) { skipped++; continue; }
        msg.file = { name: String(f.name || "file").replace(/[\\/<>:"|?*\x00-\x1f]/g, "_").slice(0, 120) || "file", mime, size: Math.max(0, Math.round(Number(f.size)) || 0), data: f.data };
      }
      if (typeof m.audio === "string" && m.audio.length <= 600000 && /^data:audio\/(webm|ogg|mp4|mpeg|wav|aac|x-m4a)(;codecs=[\w.,-]+)?;base64,/.test(m.audio)) { msg.audio = m.audio; msg.duration = Math.min(Math.round(Number(m.duration)) || 0, 120); }
      db.messages.push(msg); have.add(msg.id); restored++;
    }
  }
  if (restored) { db.messages.sort((a, b) => a.time - b.time); writeDB(db); }
  res.json({ restored, skipped });
});

// ---- delete my account (Google Play requires this): removes my profile, chats and messages ----
app.delete("/api/me", authMiddleware, rateLimit({ windowMs: 60000, max: 5 }), (req, res) => {
  if (String((req.body && req.body.confirm) || "") !== "DELETE") return res.status(400).json({ error: "Confirm the deletion" });
  const db = readDB(); const me = req.user.id;
  const user = db.users.find((u) => u.id === me);
  if (!user) return res.status(404).json({ error: "Account not found" });
  if (isCreator(user)) return res.status(400).json({ error: "The creator account can't be deleted here" });
  const removeWhere = (arr, pred, c) => { for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) { if (USE_DB && c) pendingDeletes.push({ c, id: arr[i].id }); arr.splice(i, 1); } };
  const goneConvos = new Set();
  for (const c of db.conversations) {
    if (!c.participantIds.includes(me)) continue;
    if (!c.isGroup) { goneConvos.add(c.id); continue; }
    c.participantIds = c.participantIds.filter((id) => id !== me);
    if (!c.participantIds.length) goneConvos.add(c.id); else if (c.adminId === me) c.adminId = c.participantIds[0];
  }
  removeWhere(db.messages, (m) => goneConvos.has(m.conversationId) || m.senderId === me, "messages");
  removeWhere(db.conversations, (c) => goneConvos.has(c.id), "conversations");
  removeWhere(statusesOf(db), (s) => s.userId === me);
  removeWhere(listingsOf(db), (l) => l.sellerId === me);
  removeWhere(db.users, (u) => u.id === me, "users");
  writeDB(db);
  try { io.to("user:" + me).disconnectSockets(true); } catch (e) { /* already offline */ }
  res.json({ ok: true });
});

const AVATAR_RE = /^data:image\/(jpeg|png);base64,/;
function looksLikeImage(dataUrl) {
  // check the real file signature, not just the label the browser gave it
  const head = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1, dataUrl.indexOf(",") + 17), "base64");
  const jpg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  return jpg || png;
}

// ---- business-style profile details (category, hours, description, address, links, business email) ----
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function cleanBusiness(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return { error: "Business details are not valid" };
  const text = (v, max, label) => { const t = String(v == null ? "" : v).trim(); if (t.length > max) throw new Error(label + " must be " + max + " characters or fewer"); return t; };
  try {
    const out = {};
    if (b.category !== undefined) out.category = text(b.category, 120, "Category");
    if (b.description !== undefined) out.description = text(b.description, 256, "Description");
    if (b.address !== undefined) out.address = text(b.address, 200, "Address");
    for (const k of ["website", "instagram", "facebook"]) {
      if (b[k] === undefined) continue;
      const t = text(b[k], 200, k[0].toUpperCase() + k.slice(1));
      if (/\s/.test(t)) throw new Error("The " + k + " link can't contain spaces");
      out[k] = t;
    }
    if (b.email !== undefined) {
      const t = text(b.email, 120, "Business email");
      if (t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw new Error("That business email doesn't look right");
      out.email = t;
    }
    if (b.days !== undefined) {
      if (!Array.isArray(b.days) || b.days.length !== 7) throw new Error("Opening hours must list all 7 days");
      out.days = b.days.map((d, i) => {
        const mode = d && d.mode;
        if (!["24h", "closed", "custom"].includes(mode)) throw new Error("Opening hours for " + WEEKDAYS[i] + " are not valid");
        if (mode !== "custom") return { mode };
        if (!TIME_RE.test(String(d.from)) || !TIME_RE.test(String(d.to))) throw new Error("Use a valid opening and closing time for " + WEEKDAYS[i]);
        return { mode, from: d.from, to: d.to };
      });
      const label = (d) => (d.mode === "24h" ? "Open 24 hours" : d.mode === "closed" ? "Closed" : d.from + "\u2013" + d.to);
      const parts = []; let i = 0;
      while (i < 7) { let j = i; while (j + 1 < 7 && label(out.days[j + 1]) === label(out.days[i])) j++; parts.push((j > i ? WEEKDAYS[i].slice(0, 3) + "\u2013" + WEEKDAYS[j].slice(0, 3) : WEEKDAYS[i].slice(0, 3)) + " " + label(out.days[i])); i = j + 1; }
      out.hours = parts.length === 1 && out.days[0].mode === "24h" ? "Open 24 hours" : parts.join(", ");
    }
    return { value: out };
  } catch (e) { return { error: e.message }; }
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
  let newBiz;
  if (req.body.business !== undefined && req.body.business !== null) {
    const r = cleanBusiness(req.body.business);
    if (r.error) return res.status(400).json({ error: r.error });
    newBiz = r.value;
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
  if (newBiz) { user.business = { ...(user.business || {}), ...newBiz }; if (newBiz.hours !== undefined) delete user.business.open; }
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
// muted chats: { conversationId: untilTimestampMs } where 0 means "always"
function mutedOf(db, u) {
  const out = {}, now = Date.now();
  for (const [id, until] of Object.entries(u.muted || {})) {
    if ((until === 0 || until > now) && db.conversations.some((c) => c.id === id && c.participantIds.includes(u.id))) out[id] = until;
  }
  return out;
}
// ---- business-style tools: greeting message, away message, quick replies (kept on the account) ----
const bizText = (v) => String(v == null ? "" : v).trim().slice(0, 1000);
function bizOf(u) {
  const b = (u && u.biz) || {};
  return {
    greeting: { on: !!(b.greeting && b.greeting.on), text: bizText(b.greeting && b.greeting.text) },
    away: { on: !!(b.away && b.away.on), text: bizText(b.away && b.away.text) },
    quickReplies: (Array.isArray(b.quickReplies) ? b.quickReplies : []).slice(0, 50)
      .map((q) => ({ id: String((q && q.id) || "").slice(0, 24), shortcut: String((q && q.shortcut) || "").trim().replace(/^\/+/, "").slice(0, 24), text: bizText(q && q.text) }))
      .filter((q) => q.id && q.shortcut && q.text),
  };
}
function settingsView(db, u) {
  return {
    biz: bizOf(u),
    favorites: (u.favorites || []).filter((id) => db.conversations.some((c) => c.id === id && c.participantIds.includes(u.id))),
    privacy: privacyOf(u),
    muted: mutedOf(db, u),
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
  const bz = req.body && req.body.biz;
  if (bz && typeof bz === "object") {
    const cur = bizOf(user);
    for (const k of ["greeting", "away"]) {
      if (bz[k] === undefined) continue;
      if (!bz[k] || typeof bz[k] !== "object") return res.status(400).json({ error: k + " must be an object" });
      if (bz[k].on !== undefined && typeof bz[k].on !== "boolean") return res.status(400).json({ error: k + ".on must be true or false" });
      const text = bz[k].text !== undefined ? bizText(bz[k].text) : cur[k].text;
      const on = bz[k].on !== undefined ? bz[k].on : cur[k].on;
      if (on && !text) return res.status(400).json({ error: "Write the message before turning it on" });
      cur[k] = { on, text };
    }
    if (bz.quickReplies !== undefined) {
      if (!Array.isArray(bz.quickReplies) || bz.quickReplies.length > 50) return res.status(400).json({ error: "quickReplies must be a list of up to 50" });
      cur.quickReplies = bz.quickReplies.map((q) => ({ id: String((q && q.id) || nanoid(8)).slice(0, 24), shortcut: String((q && q.shortcut) || "").trim().replace(/^\/+/, "").slice(0, 24), text: bizText(q && q.text) })).filter((q) => q.shortcut && q.text);
    }
    user.biz = { ...(user.biz || {}), ...cur };
  }
  writeDB(db);
  if (p.lastSeen !== undefined) sendPresenceFor(user);
  res.json(settingsView(db, user));
});
// ===================== WEB PUSH (alerts when the app is closed) =====================
// Needs env vars VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (and optionally VAPID_SUBJECT) on the host.
// Without them push is simply switched off and everything else works as before.
let webpush = null;
try { webpush = require("web-push"); } catch { console.warn("web-push is not installed: run `npm install` to enable push notifications."); }
const PUSH_ON = !!(webpush && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (PUSH_ON) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://letschatafric.netlify.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
else console.warn("Push notifications are OFF: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");

app.get("/api/push/key", (req, res) => {
  if (!PUSH_ON) return res.status(503).json({ error: "Push notifications are not set up on the server yet" });
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});
app.post("/api/push/subscribe", authMiddleware, (req, res) => {
  if (!PUSH_ON) return res.status(503).json({ error: "Push notifications are not set up on the server yet" });
  const s = (req.body && req.body.subscription) || {};
  const k = s.keys || {};
  if (typeof s.endpoint !== "string" || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000 || typeof k.p256dh !== "string" || typeof k.auth !== "string" || k.p256dh.length > 200 || k.auth.length > 100)
    return res.status(400).json({ error: "Invalid push subscription" });
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  const subs = (user.pushSubs || []).filter((x) => x.endpoint !== s.endpoint);
  subs.push({ endpoint: s.endpoint, keys: { p256dh: k.p256dh, auth: k.auth }, preview: req.body.preview !== false, groups: req.body.groups !== false, time: Date.now() });
  user.pushSubs = subs.slice(-5); // at most 5 devices per person
  writeDB(db);
  res.json({ ok: true });
});
app.post("/api/push/unsubscribe", authMiddleware, (req, res) => {
  const endpoint = req.body && req.body.endpoint;
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (user && user.pushSubs && typeof endpoint === "string") { user.pushSubs = user.pushSubs.filter((x) => x.endpoint !== endpoint); writeDB(db); }
  res.json({ ok: true });
});

// true when the person has the app open on screen right now (no push needed, they see it live)
function userIsActive(id) {
  for (const sid of userSockets.get(id) || []) { const s = io.sockets.sockets.get(sid); if (s && s.data.visible !== false) return true; }
  return false;
}
function pushMessage(db, convo, message, senderId) {
  if (!PUSH_ON) return;
  const sender = db.users.find((u) => u.id === senderId);
  const title = convo.isGroup ? ((sender && sender.name) || "Someone") + " \u00B7 " + (convo.name || "Group") : (sender && sender.name) || "Letschat Africa";
  for (const id of convo.participantIds) {
    if (id === senderId || userIsActive(id)) continue;
    const u = db.users.find((x) => x.id === id);
    if (!u || !(u.pushSubs || []).length || (u.blocked || []).includes(senderId)) continue;
    if (mutedOf(db, u)[convo.id] !== undefined) continue; // this chat is muted for that person
    const repliedToMe = !!(message.replyTo && message.replyTo.senderId === id);
    if (convo.chatRoom && !(message.mentions || []).includes(id) && !repliedToMe) continue; // Chat Room: only people who are @mentioned or replied to get a push
    for (const sub of u.pushSubs) {
      if (convo.isGroup && sub.groups === false) continue;
      const mentioned = (message.mentions || []).includes(id);
      const body = sub.preview === false ? (mentioned ? "Mentioned you" : repliedToMe ? "Replied to you" : "New message") : (mentioned ? "\uD83D\uDCE3 Mentioned you: " : repliedToMe ? "\u21A9\uFE0F Replied to you: " : "") + String(message.text || "New message").slice(0, 140);
      webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title, body, tag: "conv-" + convo.id, url: "./", ai: !!message.ai }), { TTL: 86400, urgency: "high" })
        .catch((err) => {
          if (err && (err.statusCode === 404 || err.statusCode === 410)) { // device unsubscribed: forget it
            const d2 = readDB(), u2 = d2.users.find((x) => x.id === id);
            if (u2 && u2.pushSubs) { u2.pushSubs = u2.pushSubs.filter((x) => x.endpoint !== sub.endpoint); writeDB(d2); }
          }
        });
    }
  }
}

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
app.post("/api/me/muted", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  const { conversationId, duration } = req.body || {};
  const c = db.conversations.find((x) => x.id === conversationId);
  if (!c || !c.participantIds.includes(user.id)) return res.status(404).json({ error: "Conversation not found" });
  const map = { ...(user.muted || {}) };
  if (duration === null || duration === undefined || duration === "off") delete map[c.id];
  else if (duration === "8h") map[c.id] = Date.now() + 8 * 3600 * 1000;
  else if (duration === "1w") map[c.id] = Date.now() + 7 * 24 * 3600 * 1000;
  else if (duration === "always") map[c.id] = 0;
  else return res.status(400).json({ error: "duration must be 8h, 1w, always or off" });
  user.muted = map;
  writeDB(db);
  res.json(settingsView(db, user));
});
// report a contact or group (stored for review)
app.post("/api/me/report", authMiddleware, (req, res) => {
  const db = readDB();
  const { userId, conversationId, reason } = req.body || {};
  const target = userId ? db.users.find((u) => u.id === userId) : null;
  const convo = conversationId ? db.conversations.find((c) => c.id === conversationId && c.participantIds.includes(req.user.id)) : null;
  if (!target && !convo) return res.status(404).json({ error: "Nothing to report" });
  if (target && target.id === req.user.id) return res.status(400).json({ error: "You can't report yourself" });
  db.reports = db.reports || [];
  db.reports.push({ id: nanoid(10), reporterId: req.user.id, userId: target ? target.id : null, conversationId: convo ? convo.id : null, reason: String(reason || "").slice(0, 300), time: Date.now() });
  if (db.reports.length > 2000) db.reports = db.reports.slice(-2000);
  writeDB(db);
  res.json({ ok: true });
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
  let roomChanged = false; try { roomChanged = joinChatRoom(db, req.user.id); } catch (e) { console.error("chat room join failed", e.message); }
  try { if (noteCountry(db, db.users.find((u) => u.id === req.user.id), GEO.fromHeaders(req.headers), "ip")) roomChanged = true; } catch (e) { console.error("country note failed", e.message); }
  if (purgeExpiredMessages(db) || roomChanged) writeDB(db);
  const mine = db.conversations.filter((c) => c.participantIds.includes(req.user.id));
  // one pass over the messages instead of one pass per chat (this endpoint runs after every incoming message)
  const mineIds = new Set(mine.map((c) => c.id)), byConv = new Map();
  for (const m of db.messages) if (mineIds.has(m.conversationId)) { let a = byConv.get(m.conversationId); if (!a) byConv.set(m.conversationId, (a = [])); a.push(m); }
  const enriched = mine
    .map((c) => {
      if (c.isGroup) return groupView(db, c, req.user.id, byConv.get(c.id) || []);
      const otherId = c.participantIds.find((id) => id !== req.user.id);
      const other = db.users.find((u) => u.id === otherId);
      const msgs = byConv.get(c.id) || [];
      const last = msgs[msgs.length - 1] || null;
      return {
        id: c.id,
        other: other ? publicUser(other) : { id: otherId, name: "Unknown", initials: "?", color: "#5B6673" },
        disappearAfter: c.disappearAfter || 0,
        pinnedMsgs: livePins(c, msgs),
        lastMessage: lite(receiptView(db, last, req.user, c)),
        unread: msgs.filter((m) => m.senderId !== req.user.id && !m.read).length,
        updatedAt: c.updatedAt || c.createdAt,
        createdAt: c.createdAt || 0,
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
  const swept = purgeExpiredMessages(db);
  const all = db.messages.filter((m) => m.conversationId === req.params.id && !(convo.chatRoom && (m.bot || m.ai))); // Chat Room: old AI messages stay hidden
  let changed = swept > 0;
  const newlyRead = [];
  for (const m of all) {
    if (m.senderId === req.user.id) continue;
    if (convo.isGroup) {
      if (!(m.readBy || (m.readBy = [])).includes(req.user.id)) { m.readBy.push(req.user.id); (m.readTimes || (m.readTimes = {}))[req.user.id] = Date.now(); changed = true; newlyRead.push(m.id); }
    } else if (!m.read) { m.read = true; m.readAt = Date.now(); changed = true; newlyRead.push(m.id); }
  }
  if (changed) writeDB(db);
  if (newlyRead.length) announceRead(db, convo, req.user.id, newlyRead);
  // pagination: ?limit=1..500 (default 200) and ?before=<timestamp ms> for older pages
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
  const before = Number(req.query.before) || Infinity;
  const since = Number(req.query.since) || 0; // ?since=<ms>: the first `limit` messages from that moment on (jump to an old search result)
  const older = all.filter((m) => m.time < before);
  const page = since ? all.filter((m) => m.time >= since).slice(0, limit) : older.slice(-limit);
  const senderCache = new Map();
  res.json({ messages: page.map((m) => roomSender(db, convo, stripViewOnce(receiptView(db, m, req.user, convo)), senderCache)), hasMore: since ? all.some((m) => m.time < since) : older.length > page.length });
});

// ---- link previews: title, description and picture of a web page that was pasted into a chat ----
// The server fetches the page (never the phone), so the sender's address is not leaked to the site. Private and internal
// addresses are refused at connect time (so redirects and DNS tricks cannot reach them), pages are size/time limited, results cached 1 hour.
const dns = require("dns");
const net = require("net");
const https = require("https");
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && ip.startsWith("192.0.0.")))) || (a === 198 && (b === 18 || b === 19));
  }
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return isPrivateIp(mapped[1]);
  return /^(fc|fd|fe[89ab])/.test(v) || v.startsWith("ff");
}
function safeLookup(hostname, opts, cb) {
  if (typeof opts === "function") { cb = opts; opts = {}; }
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return cb(new Error("blocked address"));
    if (opts && opts.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}
function fetchPage(urlStr, hops = 0) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch (e) { return reject(new Error("bad url")); }
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return reject(new Error("bad url"));
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (/^localhost$|\.(local|internal|localdomain)$/i.test(host) || (net.isIP(host) && isPrivateIp(host))) return reject(new Error("blocked address"));
    const lib = u.protocol === "https:" ? https : http;
    let done = false;
    const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); fn(v); } };
    const req = lib.get(u, { lookup: safeLookup, headers: { "User-Agent": "Mozilla/5.0 (compatible; LetschatLinkPreview/1.0)", Accept: "text/html,application/xhtml+xml", "Accept-Language": "en" } }, (res) => {
      const code = res.statusCode || 0;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        if (hops >= 3) return finish(reject, new Error("too many redirects"));
        let next; try { next = new URL(res.headers.location, u).href; } catch (e) { return finish(reject, new Error("bad redirect")); }
        return fetchPage(next, hops + 1).then((r) => finish(resolve, r), (e) => finish(reject, e));
      }
      if (code < 200 || code >= 300 || !/html/i.test(String(res.headers["content-type"] || ""))) { res.resume(); return finish(reject, new Error("not a web page")); }
      res.setEncoding("utf8");
      let html = "";
      res.on("data", (chunk) => { html += chunk; if (html.length > 300000) { res.destroy(); finish(resolve, { url: u.href, html }); } });
      res.on("end", () => finish(resolve, { url: u.href, html }));
      res.on("error", (e) => (html ? finish(resolve, { url: u.href, html }) : finish(reject, e)));
    });
    const timer = setTimeout(() => { req.destroy(); finish(reject, new Error("timeout")); }, 6000);
    req.on("error", (e) => finish(reject, e));
  });
}
const decodeEntities = (t) => String(t || "").replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
  const k = e.toLowerCase();
  if (k === "amp") return "&"; if (k === "lt") return "<"; if (k === "gt") return ">"; if (k === "quot") return '"'; if (k === "apos") return "'"; if (k === "nbsp") return " ";
  const n = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
  return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
}).replace(/\s+/g, " ").trim();
function pageMeta(html, pageUrl) {
  const head = html.slice(0, 200000), meta = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const k = /(?:property|name)\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(tag), c = /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (k && c) { const key = (k[1] || k[2]).toLowerCase(); if (!(key in meta)) meta[key] = decodeEntities(c[1] !== undefined ? c[1] : c[2]); }
  }
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const title = (meta["og:title"] || meta["twitter:title"] || (t && decodeEntities(t[1])) || "").slice(0, 140);
  const description = (meta["og:description"] || meta["twitter:description"] || meta.description || "").slice(0, 240);
  let image = meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || "";
  try { image = image ? new URL(image, pageUrl).href : ""; if (!/^https?:\/\//.test(image)) image = ""; } catch (e) { image = ""; }
  const site = (meta["og:site_name"] || new URL(pageUrl).hostname.replace(/^www\./, "")).slice(0, 60);
  return title || description ? { url: pageUrl, title, description, image, site } : null;
}
const previewCache = new Map(); // url -> { at, data }
app.get("/api/link-preview", authMiddleware, rateLimit({ windowMs: 60000, max: 40 }), async (req, res) => {
  const raw = String(req.query.url || "").trim().slice(0, 2000);
  if (!/^https?:\/\//i.test(raw)) return res.status(400).json({ error: "A web link is required" });
  const hit = previewCache.get(raw);
  if (hit && Date.now() - hit.at < 3600000) return res.json({ preview: hit.data });
  let data = null;
  try { const page = await fetchPage(raw); data = pageMeta(page.html, page.url); } catch (e) { data = null; }
  if (previewCache.size > 500) previewCache.delete(previewCache.keys().next().value);
  previewCache.set(raw, { at: Date.now(), data });
  res.json({ preview: data });
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
// ---- Chat Room (v19): one group that every user joins automatically the first time they come online ----
// People can leave (they are then not added again). Joining is silent (no "X joined" notice for hundreds of people), only @mentions send a push,
// messages are limited to one per 1.5 s per person, and the group is never deleted when it empties. The creator is its admin.
const CHAT_ROOM_ID = "chatroom-letschat", CHAT_ROOM_NAME = "Chat Room", roomLast = new Map();
function ensureChatRoom(db) {
  let c = db.conversations.find((x) => x.chatRoom);
  if (c) return { c, created: false };
  const boss = db.users.find((u) => isCreator(u));
  c = { id: CHAT_ROOM_ID, isGroup: true, chatRoom: true, name: CHAT_ROOM_NAME, adminId: boss ? boss.id : "", inviteCode: nanoid(16),
    description: "Everyone on Letschat appears here once they are online. Tap the @ button to mention a contact and chat with them right here.",
    participantIds: [], createdAt: Date.now(), updatedAt: Date.now() };
  db.conversations.push(c);
  return { c, created: true };
}
// adds the person if needed; returns true when the database changed (the caller saves it)
function joinChatRoom(db, userId) {
  const u = db.users.find((x) => x.id === userId);
  if (!u || u.suspended) return false;
  const { c, created } = ensureChatRoom(db);
  let changed = created;
  if (c.ai) { delete c.ai; changed = true; } // the Chat Room has no AI moderator (clears one that was switched on before)
  if (!c.adminId && isCreator(u)) { c.adminId = u.id; changed = true; }
  if (!c.participantIds.includes(userId) && !(c.optedOut || []).includes(userId)) { c.participantIds.push(userId); changed = true; }
  if (created) groupNotice(db, c, "Welcome to the Chat Room \uD83D\uDC4B Everyone on Letschat appears here once they are online. Tap @ to mention a contact and chat with them in this room.", { kind: "welcome" });
  return changed;
}
// Chat Room only: phones get 300 members at most, so every message also carries its sender's name and photo (nobody shows as "Former member")
function roomSender(db, convo, m, cache) {
  if (!convo || !convo.chatRoom || !m || !m.senderId) return m;
  let v = cache && cache.get(m.senderId);
  if (v === undefined) { const u = db.users.find((x) => x.id === m.senderId); v = u ? memberView(u, false, true) : null; if (cache) cache.set(m.senderId, v); }
  return v ? { ...m, sender: v } : m;
}
function adminGroup(req, res) { // returns the group if the caller is its admin, else sends the error
  const db = readDB();
  const c = db.conversations.find((x) => x.id === req.params.id);
  if (!c || !c.isGroup || !c.participantIds.includes(req.user.id)) { res.status(404).json({ error: "Group not found" }); return null; }
  if (!isGroupBoss(db, c, req.user.id)) { res.status(403).json({ error: c.chatRoom ? "Only the creator can modify the Chat Room" : "Only the group admin can do that" }); return null; }
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
  if (ids.length) { // everyone in the group sees who added the first members
    const nm = ids.map((id) => nameOf(db, id));
    groupNotice(db, c, nameOf(db, req.user.id) + " added " + (nm.length > 3 ? nm.slice(0, 3).join(", ") + " and " + (nm.length - 3) + " others" : nm.length > 1 ? nm.slice(0, -1).join(", ") + " and " + nm[nm.length - 1] : nm[0]),
      { kind: "added", actorId: req.user.id, targetIds: ids });
  }
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
  for (const id of fresh) { // admin adding someone brings back anyone the AI moderator removed
    if (c.ai) { if (c.ai.warns) delete c.ai.warns[id]; c.ai.banned = (c.ai.banned || []).filter((x) => x !== id); }
    groupNotice(db, c, nameOf(db, req.user.id) + " added " + nameOf(db, id), { kind: "added", actorId: req.user.id, targetIds: [id] });
  }
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
  if (c.chatRoom) { // Chat Room: everyone can message anyone privately, no approval (unless that person blocked you)
    const other = db.users.find((u) => u.id === to);
    if (other && (other.blocked || []).includes(req.user.id)) return res.status(403).json({ error: "This person isn't available for a private chat" });
    ensureDM(db, req.user.id, to); writeDB(db);
    return res.json({ conversation: groupView(db, c, req.user.id) });
  }
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
// ---- disappearing messages + view-once media ----
// A chat can have a timer (convo.disappearAfter, in seconds): new messages get expiresAt and are removed for good when it passes.
// View-once photos/videos are never sent to the recipient's list or live feed: they open through "message:view-once",
// which hands the bytes over once per person and then forgets them.
const DISAPPEAR_CHOICES = [0, 3600, 86400, 604800]; // off, 1 hour, 24 hours, 7 days
const VIEW_ONCE_TTL_MS = 14 * 24 * 60 * 60 * 1000;   // unopened view-once media is dropped after 14 days
function stripViewOnce(m) {
  if (!m || !m.viewOnce || !m.file || typeof m.file.data !== "string") return m;
  return { ...m, file: { name: m.file.name, mime: m.file.mime, size: m.file.size, hidden: true } };
}
function purgeExpiredMessages(db) {
  const now = Date.now(), list = db.messages, gone = [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].expiresAt && list[i].expiresAt <= now) { gone.push(list[i]); if (USE_DB) pendingDeletes.push({ c: "messages", id: list[i].id }); list.splice(i, 1); }
  if (!gone.length) return 0;
  const seen = new Set();
  for (const m of gone) {
    try { io.to(`conv:${m.conversationId}`).emit("message:expired", { conversationId: m.conversationId, messageId: m.id }); } catch (e) {}
    if (!seen.has(m.conversationId)) { seen.add(m.conversationId); try { io.to(`conv:${m.conversationId}`).emit("conversation:update", { id: m.conversationId }); } catch (e) {} }
  }
  return gone.length;
}
setInterval(() => {
  try { const db = readDB(); if (purgeExpiredMessages(db)) writeDB(db); } catch (e) { console.error("Message expiry sweep failed:", e.message); }
}, 15000).unref();
// ---- scheduled messages: send whatever has come due (every 10 seconds) ----
function sendDueScheduled() {
  const db = readDB(), now = Date.now();
  let changed = false;
  for (const u of db.users) {
    if (!u.scheduled || !u.scheduled.length) continue;
    const due = u.scheduled.filter((x) => x.sendAt <= now);
    if (!due.length) continue;
    u.scheduled = u.scheduled.filter((x) => x.sendAt > now); changed = true;
    for (const x of due) {
      const convo = db.conversations.find((c) => c.id === x.conversationId);
      if (!convo || !convo.participantIds.includes(u.id)) continue;
      if (!convo.isGroup) {
        const otherId = convo.participantIds.find((id) => id !== u.id), other = db.users.find((o) => o.id === otherId);
        if ((u.blocked || []).includes(otherId) || (other && (other.blocked || []).includes(u.id))) continue;
      }
      const t = Date.now();
      const message = { id: nanoid(14), conversationId: convo.id, senderId: u.id, text: x.text, time: t, read: false, ...(convo.disappearAfter ? { expiresAt: t + convo.disappearAfter * 1000 } : {}) };
      db.messages.push(message);
      convo.updatedAt = t;
      try { io.to(`conv:${convo.id}`).emit("message:new", message); } catch (e) {}
      try { pushMessage(db, convo, message, u.id); } catch (e) { console.error("push failed", e.message); }
    }
  }
  if (changed) writeDB(db);
}
setInterval(() => { try { sendDueScheduled(); } catch (e) { console.error("Scheduled send failed:", e.message); } }, 10000).unref();
function canDM(db, me, other) { // messaging by user id: sellers with a live listing, or a group admin
  if (listingsOf(db).some((l) => !l.removed && l.sellerId === other)) return true;
  return db.conversations.some((c) => c.isGroup && c.participantIds.includes(me) && c.participantIds.includes(other) && (c.adminId === me || c.adminId === other));
}
// ---- @tags on market posts and statuses: contacts (people you chat with) and groups you are in ----
function cleanTags(db, meId, raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const t of raw.slice(0, 10)) {
    if (!t || typeof t.id !== "string" || out.some((x) => x.id === t.id)) continue;
    if (t.type === "group") { const c = db.conversations.find((x) => x.id === t.id && x.isGroup && x.participantIds.includes(meId)); if (c) out.push({ type: "group", id: c.id }); }
    else if (t.type === "user" && t.id !== meId) { const u = db.users.find((x) => x.id === t.id); if (u && canSeeStatus(db, meId, u.id)) out.push({ type: "user", id: u.id }); }
  }
  return out;
}
function tagViews(db, tags) {
  return (tags || []).map((t) => ({ type: t.type, id: t.id, name: t.type === "group" ? (db.conversations.find((c) => c.id === t.id) || {}).name : (db.users.find((u) => u.id === t.id) || {}).name })).filter((t) => t.name);
}
function notifyTags(db, meId, tags, kind) {
  if (!tags || !tags.length) return;
  const by = (db.users.find((u) => u.id === meId) || {}).name || "Someone";
  for (const t of tags) {
    if (t.type === "user") io.to(`user:${t.id}`).emit("tagged", { kind, by });
    else { const c = db.conversations.find((x) => x.id === t.id); if (c) io.to(`conv:${c.id}`).except(`user:${meId}`).emit("tagged", { kind, by, group: c.name }); }
  }
}
const listingView = (l, db) => ({ id: l.id, title: l.title, description: l.description, price: l.price, sold: !!l.sold, time: l.time, tags: tagViews(db, l.tags),
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
  const tags = cleanTags(db, req.user.id, req.body.tags);
  const l = { id: nanoid(10), sellerId: req.user.id, title, description, price, photo: photo || null, time: Date.now(), tags };
  listingsOf(db).push(l);
  writeDB(db);
  notifyTags(db, req.user.id, tags, "market");
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
const commentViews = (db, l, uid) => (l.comments || []).map((c) => ({ id: c.id, text: c.text, time: c.time, mine: c.userId === uid, canDelete: c.userId === uid || l.sellerId === uid, author: memberView(db.users.find((u) => u.id === c.userId)), tags: tagViews(db, c.tags) }));
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
  const tags = cleanTags(o.db, req.user.id, req.body.tags);
  o.l.comments.push({ id: nanoid(8), userId: req.user.id, text, time: Date.now(), tags });
  writeDB(o.db);
  notifyTags(o.db, req.user.id, tags, "comment");
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
// ---- business catalogue: items live on the owner's profile (separate from Market) ----
const CAT_MAX = 30;
const catView = (uid, c) => ({ id: c.id, name: c.name, price: c.price || "", description: c.description || "", photo: c.photo ? `/api/v1/catalog/${uid}/${c.id}/photo?v=${c.time}` : null, time: c.time });
function catClean(body, partial) {
  const b = body || {}, out = {};
  if (!partial || b.name !== undefined) { const n = String(b.name || "").trim(); if (!n || [...n].length > 60) return { error: "Item name must be 1 to 60 characters" }; out.name = n; }
  if (b.price !== undefined) { const p = String(b.price || "").trim(); if ([...p].length > 30) return { error: "Price can be up to 30 characters" }; out.price = p; }
  if (b.description !== undefined) { const d = String(b.description || "").trim(); if ([...d].length > 500) return { error: "Description can be up to 500 characters" }; out.description = d; }
  if (b.photo !== undefined && b.photo !== null) {
    if (typeof b.photo !== "string" || !AVATAR_RE.test(b.photo) || !looksLikeImage(b.photo) || b.photo.length > 900000) return { error: "Photo must be a JPG or PNG under about 600 KB" };
    out.photo = b.photo;
  }
  return { out };
}
app.get("/api/catalog/me", authMiddleware, (req, res) => {
  const u = readDB().users.find((x) => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: "User not found" });
  const since = Date.now() - 7 * 86400000;
  res.json({ items: (u.catalog || []).map((c) => catView(u.id, c)), views: new Set((u.catalogViews || []).filter((v) => v.t >= since).map((v) => v.by)).size });
});
app.get("/api/catalog/:uid/:id/photo", (req, res) => {
  const u = readDB().users.find((x) => x.id === req.params.uid);
  sendImage(res, ((u && u.catalog) || []).find((c) => c.id === req.params.id)?.photo);
});
app.get("/api/catalog/:uid", authMiddleware, (req, res) => {
  const db = readDB();
  const owner = db.users.find((x) => x.id === req.params.uid), viewer = db.users.find((x) => x.id === req.user.id);
  if (!owner || isBlockedEither(owner, viewer)) return res.status(404).json({ error: "Catalog not found" });
  res.json({ items: (owner.catalog || []).map((c) => catView(owner.id, c)) });
});
app.post("/api/catalog/:uid/view", authMiddleware, (req, res) => {
  const db = readDB();
  const owner = db.users.find((x) => x.id === req.params.uid);
  if (!owner || owner.id === req.user.id) return res.json({ ok: true });
  const now = Date.now(), views = (owner.catalogViews || []).filter((v) => v.t >= now - 7 * 86400000);
  if (!views.some((v) => v.by === req.user.id && v.t >= now - 86400000)) views.push({ by: req.user.id, t: now });
  owner.catalogViews = views.slice(-500);
  writeDB(db);
  res.json({ ok: true });
});
app.post("/api/catalog", authMiddleware, (req, res) => {
  const db = readDB();
  const u = db.users.find((x) => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: "User not found" });
  if ((u.catalog || []).length >= CAT_MAX) return res.status(400).json({ error: `Your catalogue can hold up to ${CAT_MAX} items` });
  const r = catClean(req.body, false);
  if (r.error) return res.status(400).json({ error: r.error });
  const item = { id: nanoid(12), name: r.out.name, price: r.out.price || "", description: r.out.description || "", photo: r.out.photo || null, time: Date.now() };
  u.catalog = [item, ...(u.catalog || [])];
  writeDB(db);
  res.json({ item: catView(u.id, item) });
});
app.patch("/api/catalog/:id", authMiddleware, (req, res) => {
  const db = readDB();
  const u = db.users.find((x) => x.id === req.user.id);
  const item = u && (u.catalog || []).find((c) => c.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  const r = catClean(req.body, true);
  if (r.error) return res.status(400).json({ error: r.error });
  Object.assign(item, r.out, { time: Date.now() });
  writeDB(db);
  res.json({ item: catView(u.id, item) });
});
app.delete("/api/catalog/:id", authMiddleware, (req, res) => {
  const db = readDB();
  const u = db.users.find((x) => x.id === req.user.id);
  if (!u || !(u.catalog || []).some((c) => c.id === req.params.id)) return res.status(404).json({ error: "Item not found" });
  u.catalog = u.catalog.filter((c) => c.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

function canSeeStatusItem(db, viewerId, s) { // contacts, plus anyone (or any group member) the post tags
  { const ow = db.users.find((u) => u.id === s.userId), vw = db.users.find((u) => u.id === viewerId); if (ow && vw && isCreator(ow) && !isBlockedEither(vw, ow)) return true; } // creator posts reach everyone
  if (canSeeStatus(db, viewerId, s.userId)) return true;
  const owner = db.users.find((u) => u.id === s.userId), viewer = db.users.find((u) => u.id === viewerId);
  if (!owner || !viewer || isBlockedEither(viewer, owner)) return false;
  return (s.tags || []).some((t) => (t.type === "user" ? t.id === viewerId : db.conversations.some((c) => c.id === t.id && c.isGroup && c.participantIds.includes(viewerId))));
}
// who has viewed one of my updates (newest first), with the face/name the app shows and when they looked
const statusViewers = (db, s) => (s.viewedBy || []).map((id) => { const v = memberView(db.users.find((u) => u.id === id)); return v ? { ...v, at: (s.viewedAt || {})[id] || null } : null; })
  .filter(Boolean).sort((a, b) => (b.at || 0) - (a.at || 0));
const statusItem = (s, me, db) => ({ id: s.id, text: s.text || "", bg: s.bg || "#1E8677", photo: s.photo ? `/api/v1/status/${s.id}/photo?v=${s.time}` : null, time: s.time,
  music: s.music ? `/api/v1/status/${s.id}/music?v=${s.time}` : null, musicName: s.musicName || null, musicDur: s.musicDur || 0, tags: tagViews(db, s.tags),
  reshared: s.reshared ? { id: s.reshared.userId, name: nameOf(db, s.reshared.userId) } : null,
  seen: (s.viewedBy || []).includes(me), ...(s.userId === me ? { views: (s.viewedBy || []).length, viewers: statusViewers(db, s) } : {}) });
app.get("/api/status", authMiddleware, (req, res) => {
  const db = readDB();
  const me = req.user.id;
  const live = statusesOf(db).slice().sort((a, b) => a.time - b.time);
  const mine = live.filter((s) => s.userId === me).map((s) => statusItem(s, me, db));
  const byUser = new Map();
  for (const s of live) if (s.userId !== me && canSeeStatusItem(db, me, s)) { if (!byUser.has(s.userId)) byUser.set(s.userId, []); byUser.get(s.userId).push(s); }
  const feed = [...byUser.entries()].map(([uid, list]) => ({ user: memberView(db.users.find((u) => u.id === uid)), items: list.map((s) => statusItem(s, me, db)), latest: list[list.length - 1].time }))
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
  if (YT_RE.test(text) && !isCreator(req.user)) return res.status(400).json({ error: YT_MSG });
  if ([...text].length > 300) return res.status(400).json({ error: "Status text can be up to 300 characters" });
  if (photo && (typeof photo !== "string" || !AVATAR_RE.test(photo) || !looksLikeImage(photo) || photo.length > 1500000)) return res.status(400).json({ error: "Photo must be a JPG or PNG under about 1 MB" });
  const list = statusesOf(db);
  if (list.filter((s) => s.userId === req.user.id).length >= 30) return res.status(400).json({ error: "You can have up to 30 status updates at a time" });
  const s = { id: nanoid(14), userId: req.user.id, text, bg, photo: photo || null, time: Date.now(), viewedBy: [], tags: cleanTags(db, req.user.id, req.body && req.body.tags) };
  const mu = req.body && req.body.music;
  if (mu) { // a short trimmed clip, sent as a small mono WAV
    const okMusic = typeof mu.data === "string" && mu.data.startsWith("data:audio/wav;base64,") && mu.data.length <= 1300000 && Buffer.from(mu.data.slice(22, 38), "base64").slice(0, 4).toString("latin1") === "RIFF";
    if (!okMusic) return res.status(400).json({ error: "Music must be a short clip of up to about 15 seconds" });
    s.music = mu.data; s.musicName = String(mu.name || "Music").slice(0, 60); s.musicDur = Math.min(20, Math.max(1, Number(mu.dur) || 15));
  }
  list.push(s);
  writeDB(db);
  notifyTags(db, req.user.id, s.tags, "status");
  res.json({ status: statusItem(s, req.user.id, db) });
});
// reshare someone's update to my own status (24h like any other); it keeps a "reshared from <name>" source so viewers know
app.post("/api/status/:id/reshare", authMiddleware, (req, res) => {
  if (USE_DB && ready.statuses === false) return res.status(503).json({ error: "Status storage is not set up on the server yet" });
  const db = readDB(), me = req.user.id, list = statusesOf(db);
  const src = list.find((x) => x.id === req.params.id);
  if (!src || !canSeeStatusItem(db, me, src)) return res.status(404).json({ error: "Status not found. It may have expired." });
  const origin = src.reshared || { userId: src.userId, id: src.id }; // resharing a reshare still points to the first person
  if (src.userId === me || origin.userId === me) return res.status(400).json({ error: "You cannot reshare your own status" });
  if (list.some((x) => x.userId === me && x.reshared && x.reshared.id === origin.id)) return res.status(400).json({ error: "You already reshared this status" });
  if (list.filter((x) => x.userId === me).length >= 30) return res.status(400).json({ error: "You can have up to 30 status updates at a time" });
  const s = { id: nanoid(14), userId: me, text: src.text || "", bg: src.bg || "#1E8677", photo: src.photo || null, time: Date.now(), viewedBy: [], tags: [], reshared: { userId: origin.userId, id: origin.id } };
  if (src.music) { s.music = src.music; s.musicName = src.musicName; s.musicDur = src.musicDur; }
  list.push(s);
  writeDB(db);
  res.json({ status: statusItem(s, me, db) });
});
app.post("/api/status/:id/view", authMiddleware, (req, res) => {
  const db = readDB();
  const s = statusesOf(db).find((x) => x.id === req.params.id);
  if (!s || !canSeeStatusItem(db, req.user.id, s)) return res.status(404).json({ error: "Status not found. It may have expired." });
  if (s.userId !== req.user.id && !(s.viewedBy || (s.viewedBy = [])).includes(req.user.id)) { s.viewedBy.push(req.user.id); (s.viewedAt || (s.viewedAt = {}))[req.user.id] = Date.now(); writeDB(db); }
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
  if (!c.participantIds.includes(req.user.id) && ((c.ai && c.ai.banned) || []).includes(req.user.id)) return res.status(403).json({ error: "You were removed from this group by the AI moderator. Only the group admin can add you back." });
  res.json({ name: c.name, memberCount: c.participantIds.length, joined: c.participantIds.includes(req.user.id) });
});
app.post("/api/groups/join", authMiddleware, (req, res) => {
  const db = readDB();
  const c = db.conversations.find((x) => x.isGroup && x.inviteCode === String(req.body.code || ""));
  if (!c) return res.status(404).json({ error: "This invite link is invalid or has been reset" });
  if (!c.participantIds.includes(req.user.id)) {
    if (((c.ai && c.ai.banned) || []).includes(req.user.id)) return res.status(403).json({ error: "You were removed from this group by the AI moderator. Only the group admin can add you back." });
    if (c.participantIds.length >= MAX_GROUP) return res.status(400).json({ error: "This group is full" });
    c.participantIds.push(req.user.id);
    c.updatedAt = Date.now();
    groupNotice(db, c, nameOf(db, req.user.id) + " joined using the group invite link", { kind: "joined", via: "link", actorId: req.user.id, targetIds: [req.user.id] });
    writeDB(db);
    groupEvent(c, "conversation:update");
  }
  res.json({ conversation: groupView(db, c, req.user.id) });
});

// =====================================================================================================================
// ---- Letschat AI: self-learning chat assistant (per person) + AI group moderator (per group) + join/leave notices ----
// Everything runs on this server with plain JavaScript: no outside AI service, no extra cost, no chat text leaves the server.
// Assistant: when a person turns it on it studies THEIR OWN chats (how they reply to what people say, their greetings, tone, topics)
//   and, while they are offline, answers direct chats in their style. Every automatic reply starts with "AI:" so nobody is fooled.
//   Money / password / OTP style messages are never answered by the AI: it only says the person will reply personally.
// Moderator: the group admin feeds it the group rules. It warns rule breakers with an @mention (2 warnings), removes them on the
//   next violation, and removed people cannot rejoin by link: only the admin adding them again lets them back.
// =====================================================================================================================
const AI_MAX_PAIRS = 120;
const KB = require("./knowledge"); // online sourcing + self-learning knowledge (see AGENT-AI.md)
KB.start();
const NEWS = require("./news"); // Nigerian news, gist, gossip, trending, crime and sports feeds (see news.js)
NEWS.start();
const BOT = require("./bot")({ readDB, writeDB, isCreator, KB, News: NEWS, nanoid }); // the LetsChat AI robot you chat with from the Chats tab (see bot.js)
// BOT.start() removed: no daily research or auto-learning for the LetsChat AI page
const AI_STOP = new Set("a an the is are was were be been am i you he she it we they me my your our their to of in on at for with and or but so if this that these those do does did have has had will would can could should just please pls ok okay oh not".split(" "));
function aiTokens(t) {
  const w = String(t || "").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\u00C0-\uFFFF\s']/g, " ").split(/\s+/)
    .filter((x) => x && x.length > 1 && !AI_STOP.has(x) && !/\d{4,}/.test(x)).map((x) => x.replace(/(ing|ed|es|s)$/, "")).filter((x) => x.length > 1);
  return [...new Set(w)].slice(0, 10);
}
const AI_INTENTS = [
  ["thanks", /\b(thanks|thank you|thank u|thx|tnx|tanx|appreciate|nagode|ese)\b/i],
  ["bye", /\b(bye|goodnight|good night|see you|cya|later|ttyl|talk later)\b/i],
  ["how", /\b(how are you|how r u|how you doing|how have you been|how'?s it going|how is it going|how body|how are things|what'?s up|wassup|how you dey)\b/i],
  ["greet", /^\s*(hi|hello|hey|hiya|yo|good (morning|afternoon|evening)|how far|howdy|sup|salam|assalam\w*|asalam\w*)\b/i],
  ["when", /\b(when|what time|which time)\b/i],
  ["ask", /\?\s*$/],
];
const aiIntent = (t) => { const s = String(t || ""); for (const [n, re] of AI_INTENTS) if (re.test(s)) return n; return "other"; };
const AI_DEFAULTS = {
  greet: ["Hello 👋"], how: ["I'm fine, thank you. How are you?"], thanks: ["You're welcome 🙂"], bye: ["Bye, talk soon."],
  when: ["I'll let you know when I'm back."], ask: ["Good question. I'll get back to you when I'm back."], other: ["Got your message. I'll reply properly when I'm back."],
};
// never let the AI answer (or learn from) anything that looks like money, codes, passwords or personal numbers
const AI_SENSITIVE = /\b(otp|pin|password|passcode|cvv|bvn|nin|verification code|card number|account number|acct|send money|transfer|loan|payment|pay me|bank|wallet|crypto|bitcoin|invest\w*|urgent|emergency)\b|\b\d{6,}\b|@\w+\.\w+/i;
const AI_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const aiOf = (u) => {
  if (!u.ai || typeof u.ai !== "object") u.ai = { on: false, autoReply: true };
  const a = u.ai;
  if (!a.learn) a.learn = { pairs: [], say: {}, topics: {}, style: { n: 0, len: 0, emoji: 0, lower: 0, sig: {} }, seen: 0, sent: 0, studied: 0 };
  if (!a.replied) a.replied = {};
  return a;
};
const aiNameWords = (u) => String((u && u.name) || "").toLowerCase().split(/[^a-z0-9\u00C0-\uFFFF]+/).filter((w) => w.length >= 3);
function aiAddPair(a, incoming, reply, avoid) {
  const inc = String(incoming || "").trim(), rep = String(reply || "").trim();
  if ((avoid || []).length && String(rep).toLowerCase().split(/[^a-z0-9\u00C0-\uFFFF]+/).some((w) => avoid.includes(w))) return false; // never keep a reply that names the other person
  if (!inc || !rep || rep.length > 160 || inc.length > 300 || AI_SENSITIVE.test(inc) || AI_SENSITIVE.test(rep) || /https?:\/\//i.test(rep)) return false;
  const toks = aiTokens(inc), key = toks.length ? toks : [inc.toLowerCase().slice(0, 20)];
  const L = a.learn, kk = key.join(" ");
  const hit = L.pairs.find((p) => p.k.join(" ") === kk && p.r === rep);
  if (hit) { hit.n++; hit.t = Date.now(); } else {
    L.pairs.push({ k: key, r: rep, n: 1, t: Date.now() });
    if (L.pairs.length > AI_MAX_PAIRS) { L.pairs.sort((x, y) => (y.n - x.n) || (y.t - x.t)); L.pairs.length = AI_MAX_PAIRS; }
  }
  const it = aiIntent(inc);
  const list = (L.say[it] = L.say[it] || []);
  if (!list.includes(rep)) { list.unshift(rep); if (list.length > 5) list.length = 5; }
  return true;
}
function aiStyle(a, text) {
  const s = a.learn.style, t = String(text || "");
  s.n++; s.len += t.length;
  if (AI_EMOJI.test(t)) { s.emoji++; for (const ch of t.match(new RegExp(AI_EMOJI.source, "gu")) || []) s.sig[ch] = (s.sig[ch] || 0) + 1; }
  if (t === t.toLowerCase() && /[a-z]/.test(t)) s.lower++;
  const keys = Object.keys(s.sig); if (keys.length > 12) { keys.sort((x, y) => s.sig[y] - s.sig[x]); for (const k of keys.slice(8)) delete s.sig[k]; }
}
function aiTopics(a, text) {
  const T = a.learn.topics;
  for (const w of aiTokens(text)) if (w.length > 3) T[w] = (T[w] || 0) + 1;
  const keys = Object.keys(T);
  if (keys.length > 80) { keys.sort((x, y) => T[y] - T[x]); for (const k of keys.slice(50)) delete T[k]; }
}
const aiPlain = (m) => m && !m.deleted && !m.system && !m.auto && !m.bot && typeof m.text === "string" && !m.audio && !m.file && !m.poll && !m.viewOnce;
// study one message the owner just sent (DMs only): pair it with what they were answering
function aiLearnSent(db, convo, message, owner) {
  const a = aiOf(owner);
  if (!a.on || convo.isGroup || !aiPlain(message)) return;
  let prev = null;
  for (let i = db.messages.length - 1; i >= 0; i--) {
    const m = db.messages[i];
    if (m.id === message.id || m.conversationId !== convo.id) continue;
    if (m.senderId !== owner.id) { prev = m; break; }
    if (m.senderId === owner.id && !m.auto) break; // they already spoke last
  }
  a.learn.sent++;
  aiStyle(a, message.text);
  if (prev && aiPlain(prev) && message.time - prev.time < 30 * 60 * 1000) aiAddPair(a, prev.text, message.text, aiNameWords(db.users.find((u) => u.id === prev.senderId)));
}
// study a message that arrived for someone who has the AI on (topics only, never stored word for word)
function aiObserve(db, convo, message) {
  if (convo.isGroup || !aiPlain(message)) return;
  for (const id of convo.participantIds) {
    if (id === message.senderId) continue;
    const u = db.users.find((x) => x.id === id);
    if (!u || !u.ai || !u.ai.on) continue;
    const a = aiOf(u);
    a.learn.seen++;
    if (!AI_SENSITIVE.test(message.text)) aiTopics(a, message.text);
  }
}
// first time it is switched on: study the person's existing direct chats (their last ~600 messages)
function aiStudyHistory(db, owner) {
  const a = aiOf(owner);
  const mine = new Set(db.conversations.filter((c) => !c.isGroup && c.participantIds.includes(owner.id)).map((c) => c.id));
  const byC = new Map();
  for (const m of db.messages) if (mine.has(m.conversationId)) { let l = byC.get(m.conversationId); if (!l) byC.set(m.conversationId, (l = [])); l.push(m); }
  let budget = 600;
  for (const list of byC.values()) {
    const tail = list.slice(-Math.min(list.length, budget));
    budget -= tail.length;
    for (let i = 0; i < tail.length; i++) {
      const m = tail[i];
      if (!aiPlain(m)) continue;
      if (m.senderId === owner.id) {
        a.learn.sent++; aiStyle(a, m.text);
        const p = tail[i - 1];
        if (p && p.senderId !== owner.id && aiPlain(p) && m.time - p.time < 30 * 60 * 1000) aiAddPair(a, p.text, m.text, aiNameWords(db.users.find((u) => u.id === p.senderId)));
      } else { a.learn.seen++; if (!AI_SENSITIVE.test(m.text)) aiTopics(a, m.text); }
    }
    if (budget <= 0) break;
  }
  a.learn.studied = Date.now();
}
const aiJaccard = (x, y) => { const A = new Set(x), B = new Set(y); let i = 0; for (const t of A) if (B.has(t)) i++; const u = A.size + B.size - i; return u ? i / u : 0; };
// best replies for an incoming message: learned replies first, then the person's own wording for that kind of message, then safe defaults
function aiCandidates(owner, incoming, max) {
  const a = aiOf(owner), L = a.learn, out = [];
  const toks = aiTokens(incoming), key = toks.length ? toks : [String(incoming || "").toLowerCase().slice(0, 20)];
  const scored = L.pairs.map((p) => ({ p, s: aiJaccard(key, p.k) })).filter((x) => x.s >= 0.5).sort((x, y) => (y.s - x.s) || (y.p.n - x.p.n));
  for (const x of scored) if (!out.includes(x.p.r)) out.push(x.p.r);
  const it = aiIntent(incoming);
  for (const r of (L.say[it] || [])) if (!out.includes(r)) out.push(r);
  for (const r of AI_DEFAULTS[it] || AI_DEFAULTS.other) if (!out.includes(r)) out.push(r);
  return out.slice(0, max || 3);
}
function aiCompose(owner, incoming) {
  if (AI_SENSITIVE.test(String(incoming || ""))) return "This looks important, so " + String(owner.name || "they").split(" ")[0] + " will reply to you personally when back.";
  return aiCandidates(owner, incoming, 1)[0];
}
// "Reply even when I am online": once the AI is on it chats with people whether the owner is online, away or offline. The creator account has it on by default.
const aiAlways = (u) => !!u && !!u.ai && (u.ai.always === true || (u.ai.always === undefined && isCreator(u)));
const AI_SEND_GAP = 3 * 1000, AI_MAX_PER_WINDOW = 1000, AI_WINDOW = 6 * 60 * 60 * 1000;
// answer for an offline person who has the AI on (direct chats, and group messages that @mention them)
function aiRespond(db, convo, incoming) {
  if (incoming.auto || incoming.bot || incoming.system || !aiPlain(incoming)) return;
  const ownerIds = convo.isGroup ? (incoming.mentions || []) : convo.participantIds.filter((id) => id !== incoming.senderId);
  for (const ownerId of ownerIds) {
    const owner = db.users.find((u) => u.id === ownerId);
    if (!owner || owner.suspended || ownerId === incoming.senderId || !owner.ai || !owner.ai.on) continue;
    const a = aiOf(owner);
    if (a.autoReply === false) continue;
    const live = userSockets.get(owner.id);
    if (live && live.size && !aiAlways(owner)) continue; // they are online: they answer themselves (unless they chose "reply even when I am online")
    if ((owner.blocked || []).includes(incoming.senderId)) continue;
    const last = db.messages[db.messages.length - 1];
    if (last && last.id !== incoming.id && last.conversationId === convo.id && last.auto && last.senderId === owner.id && last.time >= incoming.time) continue; // away/greeting message already answered
    const hist = (a.replied[convo.id] || []).filter((t) => Date.now() - t < AI_WINDOW);
    if (hist.length >= AI_MAX_PER_WINDOW || (hist.length && Date.now() - hist[hist.length - 1] < AI_SEND_GAP)) { a.replied[convo.id] = hist; continue; }
    hist.push(Date.now()); a.replied[convo.id] = hist;
    if (aiAgentWants(db, owner, incoming.text)) { aiAgentReply(convo.id, incoming, owner.id).catch((e) => console.error("agent reply failed", e.message)); continue; }
    aiDelayedReply(convo.id, incoming, owner.id, "AI: " + aiCompose(owner, incoming.text)).catch((e) => console.error("ai reply failed", e.message));
  }
}

// ---- group notices: "<admin> added <name>", "<name> joined using the group invite link", "<name> left" (shown to everyone in the group) ----
function groupNotice(db, c, text, extra) {
  const m = { id: nanoid(14), conversationId: c.id, senderId: "system", system: true, text, time: Date.now(), read: true, readBy: [...c.participantIds], ...(extra || {}) };
  db.messages.push(m);
  c.updatedAt = Date.now();
  io.to(`conv:${c.id}`).emit("message:new", m);
  return m;
}
const nameOf = (db, id) => { const u = db.users.find((x) => x.id === id); return u ? (isCreator(u) ? "letschatafrica" : u.name) : "Someone"; };

// ---- AI moderator ----
const AI_NEG = /\b(no|not|don'?t|dont|do not|never|avoid|without|stop|ban\w*|forbid\w*|prohibit\w*|disallow\w*|illegal|strictly|warn\w*|remove\w*|kick\w*)\b/i;
const AI_PROMO = /\b(buy now|promo(tion)?s?|discount|dm me|inbox me|whatsapp me|contact me on|click (here|the link)|join (my|our) (channel|group)|earn \$?\d+|make money|investment|invest now|forex|crypto|airdrop|giveaway|100% (genuine|legit)|for sale|selling|order now|visit (my|our) (page|site|website))\b/i;
const AI_LINK = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|ng|io|me|ly|co|app|xyz|info|biz|link|site|online)(\/\S*)?\b/i;
const AI_RUDE = /\b(fuck\w*|shit\w*|bitch\w*|bastard|asshole|dick|pussy|idiot|stupid|moron|fool(ish)?|mumu|olodo|oloshi|ashawo|yeye|dumb|imbecile|stfu)\b/i;
const AI_ADULT = /\b(porn\w*|nudes?|nsfw|xxx|sex ?(video|tape|chat)|naked|onlyfans)\b/i;
function aiRuleSet(c) {
  const a = c.ai || {}, set = { links: false, ads: false, abuse: false, adult: false, flood: false, caps: false, words: [] };
  const words = new Set((a.words || []).map((w) => String(w).toLowerCase().trim()).filter(Boolean));
  for (const line of a.rules || []) {
    const r = String(line).toLowerCase(), neg = AI_NEG.test(r);
    for (const m of String(line).matchAll(/["\u201C\u201D'\u2018\u2019]([^"\u201C\u201D'\u2018\u2019]{2,30})["\u201C\u201D'\u2018\u2019]/g)) if (neg) words.add(m[1].toLowerCase().trim());
    if (/\b(respect\w*|polite|civil\w*|be kind|courteous)\b/.test(r)) set.abuse = true;
    if (!neg) continue;
    if (/\b(link|links|url|urls|website|websites|http|invite)\b/.test(r)) set.links = true;
    if (/\b(ad|ads|advert\w*|promo\w*|spam|selling|sell|marketing|sales?|forex|crypto|invest\w*|business)\b/.test(r)) set.ads = true;
    if (/\b(abus\w*|insult\w*|curs\w*|swear\w*|profan\w*|vulgar\w*|rude|disrespect\w*|bad words?|hate|hateful|offensive|bully\w*|harass\w*)\b/.test(r)) set.abuse = true;
    if (/\b(adult|porn\w*|nude\w*|nsfw|sexual|18\+|explicit)\b/.test(r)) set.adult = true;
    if (/\b(spam|flood\w*|repeat\w*|too many)\b/.test(r)) set.flood = true;
    if (/\b(caps|capital|shout\w*|uppercase)\b/.test(r)) set.caps = true;
  }
  set.words = [...words];
  return set;
}
const aiFlood = new Map(); // convoId:userId -> [{t, text}]
function aiCheck(set, convoId, uid, text) {
  const t = String(text || "");
  if (set.words.length) {
    const low = t.toLowerCase();
    for (const w of set.words) {
      const hit = /^[a-z0-9' ]+$/.test(w) ? new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(low) : low.includes(w);
      if (hit) return "using a banned word";
    }
  }
  if (set.adult && AI_ADULT.test(t)) return "sharing adult content";
  if (set.abuse && AI_RUDE.test(t)) return "insulting or offensive language";
  if (set.ads && (AI_PROMO.test(t) || (AI_LINK.test(t) && /\b(buy|sell|price|order|sale|offer|deal)\b/i.test(t)))) return "advertising or spam";
  if (set.links && AI_LINK.test(t)) return "sharing links";
  if (set.caps) { const letters = t.replace(/[^A-Za-z]/g, ""); if (letters.length >= 12 && letters.replace(/[^A-Z]/g, "").length / letters.length >= 0.7) return "typing in all capital letters"; }
  if (set.flood) {
    const key = convoId + ":" + uid, now = Date.now(), list = (aiFlood.get(key) || []).filter((x) => now - x.t < 120000);
    list.push({ t: now, text: t.trim().toLowerCase() }); aiFlood.set(key, list);
    if (list.filter((x) => now - x.t < 20000).length >= 8) return "sending too many messages too fast";
    if (list.filter((x) => x.text === list[list.length - 1].text).length >= 3) return "repeating the same message";
  }
  return "";
}
function aiBotSay(db, c, text, mentions) {
  return groupNotice(db, c, text, { bot: true, ...(mentions && mentions.length ? { mentions, mentionNames: mentions.map((id) => nameOf(db, id)) } : {}) });
}
function aiLog(c, entry) { const a = c.ai; a.log = [{ t: Date.now(), ...entry }, ...(a.log || [])].slice(0, 30); }
function aiModerate(db, convo, message) {
  const a = convo.ai;
  if (!convo.isGroup || !a || !a.on || message.system || message.bot || message.auto) return;
  if (message.senderId === convo.adminId) return; // the admin is never moderated
  const sender = db.users.find((u) => u.id === message.senderId);
  if (!sender || isCreator(sender)) return;
  const set = aiRuleSet(convo);
  const reason = aiCheck(set, convo.id, message.senderId, message.text);
  if (!reason) return;
  a.warns = a.warns || {}; a.warnAt = a.warnAt || {};
  if (Date.now() - (a.warnAt[message.senderId] || 0) < 15000) return; // one burst counts once
  a.warnAt[message.senderId] = Date.now();
  const n = (a.warns[message.senderId] || 0) + 1, name = nameOf(db, message.senderId);
  if (n <= 2) {
    a.warns[message.senderId] = n;
    aiLog(convo, { uid: message.senderId, name, reason, action: "warning " + n });
    aiBotSay(db, convo, n === 1
      ? "⚠️ @" + name + ", warning 1 of 2: " + reason + " is not allowed in this group. Please follow the group rules."
      : "⚠️ @" + name + ", final warning (2 of 2): " + reason + ". Any more violations and you will be removed from the group.", [message.senderId]);
    writeDB(db);
    return;
  }
  // third violation: removed, and cannot come back unless the admin adds them again
  delete a.warns[message.senderId];
  a.banned = [...new Set([...(a.banned || []), message.senderId])];
  aiLog(convo, { uid: message.senderId, name, reason, action: "removed" });
  convo.participantIds = convo.participantIds.filter((id) => id !== message.senderId);
  aiBotSay(db, convo, "🚫 @" + name + " was removed from the group by the AI moderator after 2 warnings (" + reason + "). They can only return if the admin adds them back.", [message.senderId]);
  writeDB(db);
  try { io.in(`user:${message.senderId}`).socketsLeave(`conv:${convo.id}`); } catch (e) { /* ignore */ }
  io.to(`user:${message.senderId}`).emit("conversation:update", { id: convo.id });
  groupEvent(convo, "conversation:update");
}
// one hook called after every sent message
function aiAfterSend(db, convo, message, userId) {
  if (message.system || message.bot) return;
  if (convo.chatRoom) return; // Chat Room: no AI of any kind (no @ai answers, no moderator, no assistant replies, no learning from room messages)
  const askAi = /^\s*(?:@ai|\/ai|@letschat ?ai)\b[\s:,-]*([\s\S]{2,4000})$/i.exec(String(message.text || ""));
  if (askAi && aiPlain(message)) aiPublicAsk(convo.id, message, askAi[1]).catch((e) => console.error("ai ask failed", e.message));
  if (convo.isGroup) { aiModerate(db, convo, message); }
  const sender = db.users.find((u) => u.id === userId);
  const had = sender && sender.ai && sender.ai.on;
  if (had) aiLearnSent(db, convo, message, sender);
  aiObserve(db, convo, message);
  if (had || convo.participantIds.some((id) => { const u = db.users.find((x) => x.id === id); return u && u.ai && u.ai.on; })) writeDB(db);
  aiRespond(db, convo, message);
}

// ---- routes: my assistant ----
function aiView(u) {
  const a = aiOf(u), L = a.learn;
  const topics = Object.keys(L.topics).sort((x, y) => L.topics[y] - L.topics[x]).slice(0, 10);
  const phrases = [];
  for (const k of ["greet", "how", "thanks", "bye"]) for (const r of (L.say[k] || []).slice(0, 2)) phrases.push(r);
  const st = L.style, avg = st.n ? Math.round(st.len / st.n) : 0;
  return {
    on: !!a.on, autoReply: a.autoReply !== false, always: aiAlways(u),
    learned: {
      studied: L.sent + L.seen, replies: L.sent, patterns: L.pairs.length, topics, phrases: phrases.slice(0, 6), since: L.studied || 0,
      tone: !st.n ? "Still learning" : (avg < 25 ? "short and quick" : avg < 80 ? "normal length" : "detailed") + (st.emoji / st.n > 0.25 ? ", uses emojis" : "") + (st.lower / st.n > 0.6 ? ", mostly lowercase" : ""),
    },
  };
}
app.get("/api/me/ai", authMiddleware, (req, res) => { const db = readDB(); const u = db.users.find((x) => x.id === req.user.id); res.json(aiView(u)); });
app.put("/api/me/ai", authMiddleware, (req, res) => {
  const db = readDB(), u = db.users.find((x) => x.id === req.user.id);
  const a = aiOf(u), was = !!a.on;
  if (req.body.on !== undefined) a.on = req.body.on === true;
  if (req.body.autoReply !== undefined) a.autoReply = req.body.autoReply === true;
  if (req.body.always !== undefined) a.always = req.body.always === true;
  if (a.on && !was) aiStudyHistory(db, u);
  writeDB(db);
  res.json(aiView(u));
});
app.post("/api/me/ai/reset", authMiddleware, (req, res) => {
  const db = readDB(), u = db.users.find((x) => x.id === req.user.id);
  const a = aiOf(u);
  u.ai = { on: !!a.on, autoReply: a.autoReply !== false, ...(a.always !== undefined ? { always: a.always } : {}), ...(a.agent ? { agent: a.agent } : {}) };
  aiOf(u);
  if (u.ai.on) aiStudyHistory(db, u);
  writeDB(db);
  res.json(aiView(u));
});
app.get("/api/me/ai/suggest", authMiddleware, (req, res) => {
  const db = readDB(), u = db.users.find((x) => x.id === req.user.id);
  const a = aiOf(u);
  const convo = db.conversations.find((c) => c.id === String(req.query.conversationId || ""));
  if (!a.on || !convo || !convo.participantIds.includes(u.id)) return res.json({ on: !!a.on, suggestions: [] });
  let last = null;
  for (let i = db.messages.length - 1; i >= 0; i--) { const m = db.messages[i]; if (m.conversationId === convo.id && m.senderId !== u.id && aiPlain(m)) { last = m; break; } }
  if (!last) return res.json({ on: true, suggestions: [] });
  res.json({ on: true, suggestions: AI_SENSITIVE.test(last.text) ? [] : aiCandidates(u, last.text, 4) });
});

// ---- Letschat AI agent (business-agent style) ----
// The owner chats with the agent to give it instructions and knowledge. It also feeds itself: it reads the owner's profile, business catalogue
// and Market items, sources answers online (knowledge.js), quick-checks prices, and tells the owner how many chats it handled.
const aiClip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const AI_PRIVATE = /\b(otp|pin|password|passcode|cvv|bvn|nin|verification code|card number|account number)\b|\b\d{6,}\b/i;
function aiAgent(u) {
  const a = aiOf(u);
  if (!a.agent || typeof a.agent !== "object") a.agent = {};
  const g = a.agent;
  if (!Array.isArray(g.instructions)) g.instructions = [];
  if (!Array.isArray(g.facts)) g.facts = [];
  if (!Array.isArray(g.inbox)) g.inbox = [];
  if (!Array.isArray(g.replies)) g.replies = [];
  if (!g.checks || typeof g.checks !== "object") g.checks = {};
  if (g.online === undefined) g.online = true;
  g.lastCheck = g.lastCheck || 0; g.lastDigest = g.lastDigest || 0;
  return g;
}
// everything the agent already knows without being told: profile, business catalogue, Market items, plus what the owner taught it
function aiFacts(db, u) {
  const g = aiAgent(u), f = [];
  if (u.name) f.push("Owner name: " + u.name);
  if (u.about && !/^hey there!/i.test(u.about)) f.push("About: " + aiClip(u.about, 160));
  for (const c of u.catalog || []) { if (!c.name || g.checks[c.id] === "unavailable") continue; f.push("Item: " + aiClip(c.name, 80) + (c.price ? " - price " + aiClip(c.price, 30) : "") + (c.description ? " - " + aiClip(c.description, 140) : "")); }
  for (const l of db.listings || []) if (l.sellerId === u.id && !l.removed && !l.sold && l.title) f.push("Market item: " + aiClip(l.title, 80) + (l.price ? " - price " + aiClip(l.price, 30) : "") + (l.description ? " - " + aiClip(l.description, 140) : ""));
  for (const x of g.facts) f.push(x);
  return f.slice(0, 150);
}
// should the agent (not the old canned reply) answer this incoming message?
function aiAgentWants(db, owner, text) {
  const t = String(text || "");
  if (AI_SENSITIVE.test(t) || !KB.isQuestion(t)) return false;
  if (["how", "greet", "thanks", "bye"].includes(aiIntent(t))) return false;
  if (KB.topFacts(t, aiFacts(db, owner), 3).length) return true; // it knows something about this from the owner's own items/facts
  return !/\b(you|your|yours|u|ur)\b/i.test(t); // otherwise only general-knowledge questions, not personal ones aimed at the owner
}
function aiCount(owner, convoId) { const g = aiAgent(owner); g.replies.push({ t: Date.now(), c: convoId }); if (g.replies.length > 200) g.replies = g.replies.slice(-200); }
// "typing..." for AI replies: the chat shows the typing indicator (and dots) before an AI message arrives, like a person writing it
function aiTypingStart(convoId, ownerId) {
  const emit = (on) => { try { io.to(`conv:${convoId}`).emit("typing", { conversationId: convoId, userId: ownerId, typing: on, kind: "typing" }); } catch (e) { /* sockets are optional */ } };
  const t0 = Date.now();
  emit(true);
  const iv = setInterval(() => emit(true), 4000); // the app hides the indicator after 8 s, so keep it alive while the AI is working
  return async (text) => { // call when the answer is ready: waits so the typing never looks instant, then switches it off
    const want = Math.min(4500, 1300 + String(text || "").length * 18);
    const left = want - (Date.now() - t0);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    clearInterval(iv); emit(false);
  };
}
async function aiDelayedReply(convoId, incoming, ownerId, text) {
  const done = aiTypingStart(convoId, ownerId);
  await done(text);
  const db = readDB(), owner = db.users.find((u) => u.id === ownerId), convo = db.conversations.find((c) => c.id === convoId);
  if (!owner || !convo) return;
  const live = userSockets.get(owner.id);
  if (live && live.size && !aiAlways(owner)) return; // they came back online while it was typing
  aiCount(owner, convoId);
  aiPostReply(db, convo, owner, incoming, text);
}
function aiPostReply(db, convo, owner, incoming, text) {
  const reply = { id: nanoid(14), conversationId: convo.id, senderId: owner.id, text, auto: true, ai: true, time: Date.now() + 1, read: false, ...(convo.isGroup ? { replyTo: { id: incoming.id, senderId: incoming.senderId, name: ((db.users.find((u) => u.id === incoming.senderId) || {}).name) || "Member", text: String(incoming.text).slice(0, 140) } } : {}), ...(convo.disappearAfter ? { expiresAt: Date.now() + convo.disappearAfter * 1000 } : {}) };
  db.messages.push(reply);
  convo.updatedAt = Date.now();
  writeDB(db);
  io.to(`conv:${convo.id}`).emit("message:new", reply);
  try { pushMessage(db, convo, reply, owner.id); } catch (e) { console.error("push failed", e.message); }
}
const aiTimeout = (p, ms) => Promise.race([p, new Promise((x) => setTimeout(() => x(null), ms))]);
async function aiAgentReply(convoId, incoming, ownerId) {
  let text = "", db = readDB(), owner = db.users.find((u) => u.id === ownerId);
  if (!owner) return;
  const g0 = aiAgent(owner);
  const typingDone = aiTypingStart(convoId, ownerId);
  try {
    const r = await aiTimeout(KB.answer(incoming.text, { facts: aiFacts(db, owner), instructions: g0.instructions, persona: String(owner.name || "").split(" ")[0], online: g0.online !== false }), 17000);
    if (r && r.text) text = r.text + (r.sources && r.sources.length ? " (Source: " + r.sources.join(", ") + ")" : "");
  } catch (e) { console.error("agent answer failed", e.message); }
  if (!text) text = aiCompose(owner, incoming.text);
  await typingDone(text);
  db = readDB(); owner = db.users.find((u) => u.id === ownerId);
  const convo = db.conversations.find((c) => c.id === convoId);
  if (!owner || !convo) return;
  const live = userSockets.get(owner.id);
  if (live && live.size && !aiAlways(owner)) return; // they came back online while it was looking things up

  aiCount(owner, convoId);
  aiPostReply(db, convo, owner, incoming, "AI: " + text);
}

// anyone can type "@ai <question>" (or "/ai ...") in any chat or group and get an answer sourced online
const aiAskLog = new Map();
function aiAskOk(uid) {
  const now = Date.now(), l = (aiAskLog.get(uid) || []).filter((t) => now - t < 3600000);
  /* v24: no per-person @ai cap */
  l.push(now); aiAskLog.set(uid, l); return true;
}
async function aiPublicAsk(convoId, message, question) {
  const q = aiClip(question, 4000), uid = message.senderId;
  if (!aiAskOk(uid)) return;
  let text;
  if (AI_PRIVATE.test(q)) text = "Please keep passwords, codes and personal numbers private. I can't help with those.";
  else {
    let out = null; // the LetsChat AI robot: researches the question first, then answers from the notes
    try { out = await aiTimeout(BOT._reply(readDB(), { id: uid, botChat: [] }, q, {}), 40000); } catch (e) { out = null; }
    if (out && out.parts && out.parts.length) text = out.parts.join("\n\n");
    else {
      const r = await aiTimeout(KB.answer(q, {}), 18000).catch(() => null);
      text = r && r.text ? r.text + (r.sources && r.sources.length ? "\nSource: " + r.sources.join(", ") : "") : "I couldn't find a reliable answer to that yet. Try asking it a different way.";
    }
  }
  const db = readDB(), convo = db.conversations.find((c) => c.id === convoId);
  if (!convo) return;
  aiBotSay(db, convo, "🤖 @" + nameOf(db, uid) + " " + text, [uid]);
  writeDB(db);
}

// chat between the owner and their agent
async function aiAgentChat(db, u, raw) {
  const t = aiClip(raw, 400), ref = { db, u };
  let g = aiAgent(u);
  const fresh = () => { ref.db = readDB(); ref.u = ref.db.users.find((x) => x.id === u.id) || ref.u; g = aiAgent(ref.u); return g; };
  const done = (reply, buttons) => ({ reply, buttons: buttons || [], ref });
  const addInstruction = (x) => { if (!g.instructions.includes(x)) g.instructions.push(x); if (g.instructions.length > 25) g.instructions.shift(); };
  const ask = " Is there anything else you'd like me to adjust?";
  // 1) answer to a quick check
  if (g.pending) {
    const yes = /^(yes|yeah|yep|yup|correct|still|available|ok|okay|sure)\b/i.test(t), no = /^(no|nope|sold out|not available|unavailable|out of stock|not anymore)\b/i.test(t);
    if (yes || no) {
      const p = g.pending; g.checks[p.id] = yes ? "ok" : "unavailable"; g.pending = null;
      return done(yes ? "Thank you. I'll keep sharing " + p.name + " with your customers." : "Noted. I won't offer " + p.name + " to customers until you tell me it is back. Say \"" + p.name + " is available\" any time to turn it on.");
    }
  }
  const back = /^(.{2,60}?)\s+is (?:available|back|in stock)\b/i.exec(t);
  if (back) { const it = (u.catalog || []).find((c) => c.name && c.name.toLowerCase().includes(back[1].toLowerCase())); if (it) { g.checks[it.id] = "ok"; return done("Great, " + it.name + " is back on. I'll share it with your customers again."); } }
  // 2) forget something
  const fg = /^(?:forget|remove|delete)\s+(.{2,80})$/i.exec(t);
  if (fg) {
    const w = fg[1].toLowerCase(), before = g.instructions.length + g.facts.length;
    g.instructions = g.instructions.filter((x) => !x.toLowerCase().includes(w)); g.facts = g.facts.filter((x) => !x.toLowerCase().includes(w));
    const gone = before - g.instructions.length - g.facts.length;
    return done(gone ? "Done. I removed " + gone + " item" + (gone === 1 ? "" : "s") + "." : "I couldn't find that in your instructions or knowledge.", ["Go to Instructions", "Go to Knowledge"]);
  }
  // 3) show what it knows
  if (/^(?:what do you know|show|list|view)\b/i.test(t) && /\b(know|knowledge|instructions?)\b/i.test(t)) {
    const auto = aiFacts(ref.db, ref.u).length - g.facts.length;
    return done("I have " + g.instructions.length + " instruction" + (g.instructions.length === 1 ? "" : "s") + ", " + g.facts.length + " fact" + (g.facts.length === 1 ? "" : "s") + " you taught me, and " + Math.max(0, auto) + " I learned from your profile, items and Market posts.", ["Go to Instructions", "Go to Knowledge"]);
  }
  // 4) switch online sourcing off / on
  if (/\b(don'?t|do not|stop|never)\b[^.]*\b(online|internet|web|google|search)\b/i.test(t)) { g.online = false; addInstruction(t); return done("I've updated your instructions. I'll answer only from what you've told me and what I learned from your items, and I won't look anything up online." + ask, ["Go to Instructions"]); }
  if (/\b(source|search|look ?up|use|check)\b[^.]*\b(online|internet|web)\b/i.test(t)) { g.online = true; addInstruction(t); return done("I've updated your instructions. I'll now source related information online to give your customers the most accurate answers to their questions." + ask, ["Go to Instructions"]); }
  // 5) research something and learn it ("source for properties in Lagos")
  const rs = /^(?:source|research|find|search)\s+(?:for\s+|about\s+|information (?:on|about)\s+)?(.{3,160})$/i.exec(t);
  if (rs && !/\b(always|never|be |tone|reply)\b/i.test(t)) {
    const r = await aiTimeout(KB.answer(rs[1], { online: true }), 18000).catch(() => null);
    fresh();
    if (r && r.text) {
      const fact = "Learned online (" + aiClip(rs[1], 50) + "): " + aiClip(r.text, 300);
      if (!g.facts.includes(fact)) g.facts.push(fact); if (g.facts.length > 80) g.facts.shift();
      return done(r.text + (r.sources.length ? "\n\nSource: " + r.sources.join(", ") : "") + "\n\nI added this to your Knowledge. Is there anything else you'd like me to add?", ["Go to Knowledge"]);
    }
    return done("I couldn't find reliable information on that online right now. You can type the details and I'll save them to your Knowledge.");
  }
  // 6) a question: test it the way a customer would ask
  if (KB.isQuestion(t)) {
    const r = await aiTimeout(KB.answer(t, { facts: aiFacts(ref.db, ref.u), instructions: g.instructions, persona: String(u.name || "").split(" ")[0], online: g.online !== false }), 18000).catch(() => null);
    fresh();
    return done(r && r.text ? r.text + (r.sources.length ? "\n\nSource: " + r.sources.join(", ") : "") : "I don't have a reliable answer to that yet. Tell me the answer and I'll save it to your Knowledge.", r ? [] : ["Go to Knowledge"]);
  }
  // 7) an instruction about how to behave
  if (/\b(always|never|be\s+(?:very\s+)?(?:kind|polite|humble|brief|short|formal|friendly|professional|helpful|patient)|speak|reply in|respond in|tone|do not|don'?t|avoid|ignore|greet)\b/i.test(t)) { addInstruction(t); return done("I've updated your instructions to: " + t + "." + ask, ["Go to Instructions"]); }
  // 8) anything else is a fact to learn
  if (t.length < 6) return done("Tell me a bit more so I can learn it, for example your address, opening hours or prices.");
  if (!g.facts.includes(t)) g.facts.push(t);
  if (g.facts.length > 80) g.facts.shift();
  return done("I've saved that to your Knowledge: \"" + aiClip(t, 120) + "\". Is there anything else you'd like to add?", ["Go to Knowledge"]);
}
function aiAgentView(db, u) {
  const g = aiAgent(u), a = aiOf(u), rep = g.replies.filter((r) => r.t >= Date.now() - 864e5);
  return {
    on: !!a.on, online: g.online !== false, llm: KB.llmReady(), instructions: g.instructions, facts: g.facts,
    auto: aiFacts(db, u).filter((f) => !g.facts.includes(f)).slice(0, 40), inbox: g.inbox.slice(-40),
    today: { chats: new Set(rep.map((r) => r.c)).size, replies: rep.length },
  };
}
app.get("/api/me/ai/agent", authMiddleware, (req, res) => { const db = readDB(), u = db.users.find((x) => x.id === req.user.id); res.json(aiAgentView(db, u)); });
app.post("/api/me/ai/agent", authMiddleware, async (req, res) => {
  const text = aiClip(req.body.text, 400);
  if (!text) return res.status(400).json({ error: "Type something first" });
  const db0 = readDB(), u0 = db0.users.find((x) => x.id === req.user.id);
  if (!u0) return res.status(404).json({ error: "Not found" });
  let out;
  try { out = await aiAgentChat(db0, u0, text); } catch (e) { console.error("agent chat failed", e.message); return res.status(500).json({ error: "The AI could not answer right now" }); }
  const db = readDB(), u = db.users.find((x) => x.id === req.user.id) || u0;
  // apply the changes to the freshest copy of the user (the lookup above can take a few seconds)
  if (u !== out.ref.u) { const gOld = aiAgent(out.ref.u), gNew = aiAgent(u); gNew.instructions = gOld.instructions; gNew.facts = gOld.facts; gNew.checks = gOld.checks; gNew.pending = gOld.pending || null; gNew.online = gOld.online; }
  const g = aiAgent(u);
  g.inbox.push({ from: "me", text, t: Date.now() }, { from: "ai", text: out.reply, buttons: out.buttons, t: Date.now() + 1 });
  if (g.inbox.length > 60) g.inbox = g.inbox.slice(-60);
  writeDB(db);
  res.json({ ...aiAgentView(db, u), reply: out.reply, buttons: out.buttons });
});
app.post("/api/me/ai/agent/remove", authMiddleware, (req, res) => {
  const db = readDB(), u = db.users.find((x) => x.id === req.user.id), g = aiAgent(u), i = Number(req.body.index);
  const list = req.body.kind === "instructions" ? g.instructions : req.body.kind === "facts" ? g.facts : null;
  if (list && i >= 0 && i < list.length) list.splice(i, 1);
  writeDB(db);
  res.json(aiAgentView(db, u));
});
app.get("/api/ai/ask", authMiddleware, async (req, res) => {
  if (!aiAskOk(req.user.id)) return res.status(429).json({ error: "Too many questions, wait a moment" });
  const q = aiClip(req.query.q, 300);
  if (!q || AI_PRIVATE.test(q)) return res.json({ answer: null, sources: [] });
  const r = await aiTimeout(KB.answer(q, {}), 18000).catch(() => null);
  res.json({ answer: r ? r.text : null, sources: r ? r.sources : [] });
});
// ---- LetsChat AI robot chat (every user) ----
const botLog = new Map();
const AI_PAGE_SYSTEM = "You are LetsChat AI, a helpful assistant inside the Letschat Africa chat app. Answer clearly and honestly in the language the person writes in. Keep replies short unless they ask for detail. Never ask for passwords, PINs or OTPs.";
// The LetsChat AI page is a plain chat with the AI API (Gemini, OpenAI, Grok...). No learning, training, research or notes.
app.get("/api/bot/chat", authMiddleware, (req, res) => {
  const u = readDB().users.find((x) => x.id === req.user.id);
  const h = u && Array.isArray(u.botChat) ? u.botChat.filter((m) => m && m.text && !m.digest && !m.off) : [];
  res.json({ messages: h.slice(-60).map((m) => ({ id: m.id, from: m.from, text: m.text, t: m.t })), llm: KB.llmReady() });
});
app.post("/api/bot/chat", authMiddleware, async (req, res) => {
  const text = String(req.body.text || "").trim().slice(0, 8000);
  if (!text) return res.status(400).json({ error: "Type something first" });
  if (!KB.llmReady()) return res.status(503).json({ error: "The AI is not connected yet. Add an AI API key (GEMINI_API_KEY, OPENAI_API_KEY, XAI_API_KEY...) on the server." });
  const now = Date.now(), log = (botLog.get(req.user.id) || []).filter((t) => now - t < 60000);
  log.push(now); botLog.set(req.user.id, log);
  try {
    const u0 = readDB().users.find((x) => x.id === req.user.id);
    if (!u0) return res.status(404).json({ error: "Not found" });
    const past = (Array.isArray(u0.botChat) ? u0.botChat : []).filter((m) => m && m.text && !m.digest && !m.off).slice(-12)
      .map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: String(m.text).slice(0, 2000) }));
    const out = await KB.chat([{ role: "system", content: AI_PAGE_SYSTEM }, ...past, { role: "user", content: text }], { max: 2000, temp: 0.7, timeout: 30000, budget: 80000 });
    if (!out) {
      // every AI engine failed: still answer from the free online sources (weather, news, definitions, Wikipedia...) or a friendly fallback
      let fb = null;
      try { fb = await aiTimeout(KB.lookup(text), 8000); } catch (e) {}
      const greet = /^\s*(hi+|hello+|hey+|yo|good (morning|afternoon|evening)|how far|wassup|what'?s up|sup)\b/i.test(text);
      const reply = fb && fb.text ? fb.text : greet ? "Hi! I'm LetsChat AI. How can I help you today?" : "I'm having trouble reaching my AI brain right now, so I can't answer that properly. Please try again in a minute.";
      const dbf = readDB(), uf = dbf.users.find((x) => x.id === req.user.id) || u0;
      if (fb || greet) {
        if (!Array.isArray(uf.botChat)) uf.botChat = [];
        const tf = Date.now();
        uf.botChat.push({ id: nanoid(8), from: "me", text, t: tf }, { id: nanoid(8), from: "ai", text: reply, t: tf + 1 });
        if (uf.botChat.length > 80) uf.botChat = uf.botChat.slice(-80);
        writeDB(dbf);
        return res.json({ parts: [reply], by: "fallback" });
      }
      return res.status(502).json({ error: reply });
    }
    const db = readDB(), u = db.users.find((x) => x.id === req.user.id) || u0;
    if (!Array.isArray(u.botChat)) u.botChat = [];
    const t0 = Date.now();
    u.botChat.push({ id: nanoid(8), from: "me", text, t: t0 }, { id: nanoid(8), from: "ai", text: out.text, t: t0 + 1 });
    if (u.botChat.length > 80) u.botChat = u.botChat.slice(-80);
    writeDB(db);
    res.json({ parts: [out.text], by: out.by });
  } catch (e) { console.error("bot chat failed", e.message); res.status(500).json({ error: "The AI could not answer right now" }); }
});
app.post("/api/bot/clear", authMiddleware, (req, res) => { BOT.clear(req.user.id); res.json({ ok: true }); });
app.get("/api/creator/ai-status", authMiddleware, creatorOnly, (req, res) => res.json(KB.aiStatus()));
app.get("/api/creator/ai-knowledge", authMiddleware, creatorOnly, (req, res) => res.json(KB.stats()));
// every 30 minutes: quick price checks and the "I replied in N chats" report (at most once a day each)
function aiAgentTick() {
  const db = readDB(), now = Date.now(); let changed = false;
  for (const u of db.users) {
    if (!u.ai || !u.ai.on || u.suspended) continue;
    const g = aiAgent(u), rep = g.replies.filter((r) => r.t >= now - 864e5);
    if (rep.length && now - g.lastDigest > 864e5) { const n = new Set(rep.map((r) => r.c)).size; g.inbox.push({ from: "ai", t: now, text: "I've been busy today! I replied in " + n + " conversation" + (n === 1 ? "" : "s") + " for you.", buttons: [] }); g.lastDigest = now; changed = true; }
    if (!g.pending && now - g.lastCheck > 864e5) {
      const items = (u.catalog || []).filter((c) => c.name && c.price && g.checks[c.id] !== "unavailable");
      if (items.length) { const it = items[Math.floor(Math.random() * items.length)]; g.pending = { id: it.id, name: it.name }; g.lastCheck = now; g.inbox.push({ from: "ai", t: now, text: "Quick check: Are you currently offering " + it.name + " at a regular price of " + it.price + "? I want to make sure I have the right item and price before sharing it with your customers. Reply yes or no.", buttons: [] }); changed = true; }
    }
    if (g.inbox.length > 60) g.inbox = g.inbox.slice(-60);
  }
  if (changed) writeDB(db);
}
setInterval(() => { try { aiAgentTick(); } catch (e) { console.error("agent tick failed", e.message); } }, 30 * 60 * 1000).unref();

// ---- routes: group moderator ----
const aiList = (v, max, len) => (Array.isArray(v) ? v : String(v || "").split(/[\n,]+/)).map((x) => String(x).trim().slice(0, len)).filter(Boolean).slice(0, max);
function aiGroupView(db, c, uid) {
  const a = c.ai || {}, admin = c.adminId === uid;
  return {
    on: !!a.on, rules: a.rules || [], words: admin ? (a.words || []) : [],
    ...(admin ? {
      warned: Object.keys(a.warns || {}).filter((id) => c.participantIds.includes(id)).map((id) => ({ id, name: nameOf(db, id), count: a.warns[id] })),
      removed: (a.banned || []).map((id) => ({ id, name: nameOf(db, id) })),
      log: (a.log || []).slice(0, 15),
    } : {}),
  };
}
app.get("/api/conversations/:id/ai", authMiddleware, (req, res) => {
  const db = readDB(), c = db.conversations.find((x) => x.id === req.params.id);
  if (!c || !c.isGroup || !c.participantIds.includes(req.user.id)) return res.status(404).json({ error: "Group not found" });
  if (c.chatRoom) return res.json({ on: false, rules: [], words: [] }); // no AI in the Chat Room
  res.json(aiGroupView(db, c, req.user.id));
});
app.put("/api/conversations/:id/ai", authMiddleware, (req, res) => {
  const g = adminGroup(req, res); if (!g) return;
  const { db, c } = g;
  if (c.chatRoom) return res.status(400).json({ error: "AI is not available in the Chat Room" });
  const old = c.ai || {};
  const rules = req.body.rules !== undefined ? aiList(req.body.rules, 20, 200) : (old.rules || []);
  const words = req.body.words !== undefined ? aiList(req.body.words, 50, 30) : (old.words || []);
  const on = req.body.on !== undefined ? req.body.on === true : !!old.on;
  if (on && !rules.length && !words.length) return res.status(400).json({ error: "Add at least one group rule before turning the AI moderator on" });
  const changed = JSON.stringify(rules) !== JSON.stringify(old.rules || []) || JSON.stringify(words) !== JSON.stringify(old.words || []);
  c.ai = { ...old, on, rules, words, warns: old.warns || {}, banned: old.banned || [] };
  if (on && (!old.on || changed)) aiBotSay(db, c, "AI moderator is on. Group rules:\n" + (rules.length ? rules.map((r, i) => (i + 1) + ". " + r).join("\n") : "Banned words are being watched.") + "\n\nBreaking a rule earns 2 warnings, then removal.");
  else if (!on && old.on) aiBotSay(db, c, "AI moderator is off.");
  writeDB(db);
  groupEvent(c, "conversation:update");
  res.json(aiGroupView(db, c, req.user.id));
});
app.post("/api/conversations/:id/ai/clear", authMiddleware, (req, res) => { // admin: forgive a warned or removed person
  const g = adminGroup(req, res); if (!g) return;
  const { db, c } = g, id = String(req.body.userId || "");
  if (c.chatRoom) return res.status(400).json({ error: "AI is not available in the Chat Room" });
  if (c.ai) { if (c.ai.warns) delete c.ai.warns[id]; c.ai.banned = (c.ai.banned || []).filter((x) => x !== id); }
  writeDB(db);
  res.json(aiGroupView(db, c, req.user.id));
});

// ---- routes: leave a group (everyone is told "<name> left") ----
app.post("/api/conversations/:id/leave", authMiddleware, (req, res) => {
  const db = readDB(), c = db.conversations.find((x) => x.id === req.params.id);
  if (!c || !c.isGroup || !c.participantIds.includes(req.user.id)) return res.status(404).json({ error: "Group not found" });
  const me = req.user.id, name = nameOf(db, me);
  c.participantIds = c.participantIds.filter((id) => id !== me);
  if (c.chatRoom) c.optedOut = [...new Set([...(c.optedOut || []), me])];
  if (c.ai && c.ai.warns) delete c.ai.warns[me];
  if (!c.participantIds.length && !c.chatRoom) {
    for (let i = db.messages.length - 1; i >= 0; i--) if (db.messages[i].conversationId === c.id) { if (USE_DB) pendingDeletes.push({ c: "messages", id: db.messages[i].id }); db.messages.splice(i, 1); }
    const ci = db.conversations.findIndex((x) => x.id === c.id);
    if (ci >= 0) { if (USE_DB) pendingDeletes.push({ c: "conversations", id: c.id }); db.conversations.splice(ci, 1); }
  } else {
    if (c.adminId === me && !c.chatRoom) c.adminId = c.participantIds[0];
    if (!c.chatRoom) groupNotice(db, c, name + " left", { kind: "left", actorId: me, targetIds: [me] });
  }
  writeDB(db);
  try { io.in(`user:${me}`).socketsLeave(`conv:${c.id}`); } catch (e) { /* ignore */ }
  io.to(`user:${me}`).emit("conversation:update", { id: c.id });
  if (c.participantIds.length) groupEvent(c, "conversation:update");
  res.json({ ok: true });
});
// =====================================================================================================================

// ---- Letschat Lite: plain HTML pages that work with no JavaScript (Opera Mini extreme/mini mode, keypad phones) ----
require("./lite")({
  express, jwt, admin, readDB, writeDB, nanoid, rateLimit, publicUser, firebaseSignIn, handleSend, findByContact, joinUserToRoom,
  announceRead, NOT_FOUND_MSG, JWT_SECRET, signToken, stripViewOnce, getApp: () => app,
  verifyToken: (t) => { try { const p = jwt.verify(String(t || ""), JWT_SECRET); const u = readDB().users.find((x) => x.id === p.sub); return u && !u.suspended ? u : null; } catch (e) { return null; } },
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
// Greeting message (first message from someone new) and away message (you are offline; at most once per chat every 12 hours).
const AWAY_GAP_MS = 12 * 60 * 60 * 1000;
function autoReply(db, convo, incoming) {
  if (convo.isGroup || incoming.auto) return;
  const toId = convo.participantIds.find((id) => id !== incoming.senderId);
  const owner = db.users.find((u) => u.id === toId);
  if (!owner) return;
  if ((owner.blocked || []).includes(incoming.senderId)) return;
  const biz = bizOf(owner);
  let text = "";
  const firstFromThem = db.messages.filter((m) => m.conversationId === convo.id && m.senderId === incoming.senderId && !m.auto).length === 1;
  if (biz.greeting.on && biz.greeting.text && firstFromThem && !db.messages.some((m) => m.conversationId === convo.id && m.senderId === owner.id)) text = biz.greeting.text;
  else if (biz.away.on && biz.away.text && !userSockets.has(owner.id)) {
    const sent = (owner.biz && owner.biz.awaySent) || {};
    if (!sent[convo.id] || Date.now() - sent[convo.id] > AWAY_GAP_MS) {
      text = biz.away.text;
      owner.biz = { ...(owner.biz || {}), awaySent: { ...sent, [convo.id]: Date.now() } };
    }
  }
  if (!text) return;
  const reply = { id: nanoid(14), conversationId: convo.id, senderId: owner.id, text, auto: true, time: Date.now() + 1, read: false, ...(convo.disappearAfter ? { expiresAt: Date.now() + convo.disappearAfter * 1000 } : {}) };
  db.messages.push(reply);
  convo.updatedAt = Date.now();
  writeDB(db);
  io.to(`conv:${convo.id}`).emit("message:new", reply);
  try { pushMessage(db, convo, reply, owner.id); } catch (e) { console.error("push failed", e.message); }
}
const gOnlineAt = new Map(); // userId -> last time we announced them as online in the games section

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

// ---- push alert for a call: wakes the other phone even when the app is closed (short TTL so a stale ring never shows later) ----
function pushCall(toId, fromUser, label, tag) {
  if (!PUSH_ON) return;
  const db = readDB(), u = db.users.find((x) => x.id === toId);
  if (!u || !(u.pushSubs || []).length) return;
  for (const sub of u.pushSubs) {
    webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title: (fromUser && fromUser.name) || "Letschat Africa", body: label, tag, url: "./", call: true }), { TTL: 45, urgency: "high" })
      .catch((err) => {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          const d2 = readDB(), u2 = d2.users.find((x) => x.id === toId);
          if (u2 && u2.pushSubs) { u2.pushSubs = u2.pushSubs.filter((x) => x.endpoint !== sub.endpoint); writeDB(d2); }
        }
      });
  }
}
// a 1:1 call whose other person was offline when it started: hand it over the moment they open the app
function deliverPendingCall(userId) {
  const callId = userCall.get(userId), c = callId && activeCalls.get(callId);
  if (!c || c.to !== userId || c.state !== "ringing") return;
  const send = () => {
    const cur = activeCalls.get(callId);
    if (!cur || cur.state !== "ringing" || !userSockets.has(userId)) return;
    const db = readDB(), me = db.users.find((u) => u.id === cur.from);
    io.to(`user:${userId}`).emit("call:incoming", { callId, conversationId: cur.conversationId, video: cur.video, from: memberView(me) });
    if (cur.offline) { cur.offline = false; io.to(`user:${cur.from}`).emit("call:reached", { callId }); } // caller's screen: "Connecting…" becomes "Ringing…"
  };
  setTimeout(send, 1500); // give the app a moment to finish starting before it rings
  setTimeout(send, 4500); // second try in case the first landed before the app was listening (the app ignores a repeat)
}

// ---- group voice / video calls: everyone connects to everyone (peer to peer); the server only keeps the room and passes the signals ----
const groupCalls = new Map();    // callId -> { id, conversationId, video, host, started, members: Map(userId -> joinedAt) }
const convGroupCall = new Map(); // conversationId -> callId (one live call per group)
const GC_MAX = { video: 4, voice: 8 }; // everyone sends to everyone, so video is kept small to suit mobile data
function gcView(g) {
  const db = readDB(), convo = db.conversations.find((c) => c.id === g.conversationId);
  return {
    conversationId: g.conversationId, callId: g.id, video: g.video, count: g.members.size, started: g.started, age: Date.now() - g.started,
    name: (convo && convo.name) || "Group",
    avatar: convo && convo.avatar ? `/api/v1/groups/${convo.id}/avatar?v=${convo.avatarVersion || 1}` : null,
    host: memberView(db.users.find((u) => u.id === g.host)),
  };
}
function gcTell(conversationId, g) { // tell every member of the group whether a call is running (or not any more)
  const convo = readDB().conversations.find((c) => c.id === conversationId);
  if (!convo) return;
  const st = g ? gcView(g) : { conversationId, callId: null };
  for (const id of convo.participantIds) io.to(`user:${id}`).emit("gcall:state", st);
}
function gcLeave(userId, callId) {
  const g = groupCalls.get(callId);
  if (!g || !g.members.has(userId)) return;
  g.members.delete(userId);
  if (userCall.get(userId) === callId) userCall.delete(userId);
  for (const id of g.members.keys()) io.to(`user:${id}`).emit("gcall:left", { callId, userId });
  if (g.members.size === 0) {
    groupCalls.delete(callId);
    if (convGroupCall.get(g.conversationId) === callId) convGroupCall.delete(g.conversationId);
    gcTell(g.conversationId, null);
  } else gcTell(g.conversationId, g);
}
function gcLeaveAll(userId) { for (const [id, g] of groupCalls) if (g.members.has(userId)) gcLeave(userId, id); }

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
// ---- chess engine (shared with the server) ----
const CH_N = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]], CH_K = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]], CH_B = [[-1,-1],[-1,1],[1,-1],[1,1]], CH_R = [[-1,0],[1,0],[0,-1],[0,1]];
function chKing(b, p) { return b.indexOf(6 + 8 * p); }
function chAtt(b, sq, by) {
  const r = sq >> 3, c = sq & 7, pr = by === 0 ? r + 1 : r - 1;
  for (const dc of [-1, 1]) { const cc = c + dc; if (pr >= 0 && pr < 8 && cc >= 0 && cc < 8 && b[pr * 8 + cc] === 1 + 8 * by) return true; }
  for (const [dr, dc] of CH_N) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === 2 + 8 * by) return true; }
  for (const [dr, dc] of CH_K) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === 6 + 8 * by) return true; }
  for (const [dirs, a, q] of [[CH_B, 3, 5], [CH_R, 4, 5]]) for (const [dr, dc] of dirs) {
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const v = b[rr * 8 + cc]; if (v != null) { if (v === a + 8 * by || v === q + 8 * by) return true; break; } rr += dr; cc += dc; }
  }
  return false;
}
function chPseudo(s, p) {
  const b = s.b, out = [], fwd = p === 0 ? -1 : 1, start = p === 0 ? 6 : 1, last = p === 0 ? 0 : 7;
  for (let i = 0; i < 64; i++) {
    const v = b[i]; if (v == null || (v >> 3) !== p) continue; const t = v & 7, r = i >> 3, c = i & 7;
    if (t === 1) {
      const r1 = r + fwd; if (r1 < 0 || r1 > 7) continue;
      const add = (to) => { if (r1 === last) for (let pt = 2; pt <= 5; pt++) out.push(i * 64 + to + 4096 * pt); else out.push(i * 64 + to); };
      if (b[r1 * 8 + c] == null) { add(r1 * 8 + c); if (r === start && b[(r + 2 * fwd) * 8 + c] == null) out.push(i * 64 + (r + 2 * fwd) * 8 + c); }
      for (const dc of [-1, 1]) { const cc = c + dc; if (cc < 0 || cc > 7) continue; const to = r1 * 8 + cc, o = b[to]; if ((o != null && (o >> 3) !== p) || (o == null && to === s.ep)) add(to); }
    } else if (t === 2 || t === 6) {
      for (const [dr, dc] of t === 2 ? CH_N : CH_K) { const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue; const o = b[rr * 8 + cc]; if (o == null || (o >> 3) !== p) out.push(i * 64 + rr * 8 + cc); }
    } else {
      for (const [dr, dc] of t === 3 ? CH_B : t === 4 ? CH_R : CH_B.concat(CH_R)) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const o = b[rr * 8 + cc]; if (o == null) out.push(i * 64 + rr * 8 + cc); else { if ((o >> 3) !== p) out.push(i * 64 + rr * 8 + cc); break; } rr += dr; cc += dc; }
      }
    }
  }
  const base = p === 0 ? 56 : 0, ks = base + 4;
  if (b[ks] === 6 + 8 * p && !chAtt(b, ks, 1 - p)) {
    if (s.c[p * 2] && b[base + 5] == null && b[base + 6] == null && b[base + 7] === 4 + 8 * p && !chAtt(b, base + 5, 1 - p) && !chAtt(b, base + 6, 1 - p)) out.push(ks * 64 + base + 6);
    if (s.c[p * 2 + 1] && b[base + 3] == null && b[base + 2] == null && b[base + 1] == null && b[base] === 4 + 8 * p && !chAtt(b, base + 3, 1 - p) && !chAtt(b, base + 2, 1 - p)) out.push(ks * 64 + base + 2);
  }
  return out;
}
function chApply(s, m) {
  const pt = Math.floor(m / 4096), mm = m % 4096, from = mm >> 6, to = mm & 63, b = s.b.slice(), v = b[from], p = v >> 3, t = v & 7, cap = b[to], c = s.c.slice();
  let ep = -1, reset = t === 1 || cap != null; b[from] = null; b[to] = v;
  if (t === 1) {
    if (cap == null && (from & 7) !== (to & 7)) { b[to + (p === 0 ? 8 : -8)] = null; reset = true; }
    if (Math.abs((to >> 3) - (from >> 3)) === 2) ep = (from + to) / 2;
    if (pt) b[to] = pt + 8 * p;
  }
  if (t === 6) {
    c[p * 2] = false; c[p * 2 + 1] = false;
    if (Math.abs((to & 7) - (from & 7)) === 2) { const base = from - (from & 7); if ((to & 7) === 6) { b[base + 5] = b[base + 7]; b[base + 7] = null; } else { b[base + 3] = b[base]; b[base] = null; } }
  }
  for (const sq of [from, to]) { if (sq === 63) c[0] = false; if (sq === 56) c[1] = false; if (sq === 7) c[2] = false; if (sq === 0) c[3] = false; }
  return { b, nx: 1 - p, c, ep, hm: reset ? 0 : s.hm + 1, lm: mm };
}
function chLegal(s, p) { return chPseudo(s, p).filter((m) => { const ns = chApply(s, m); return !chAtt(ns.b, chKing(ns.b, p), 1 - p); }); }
// ---- end chess engine ----

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
  checkers: {
    // Nigerian draughts on 8x8. Men step forward but capture forward AND backward, kings fly any distance, capturing is compulsory and you must take the route that captures the most pieces.
    // Captured pieces stay on the board until your move ends (and can't be jumped twice). A man is crowned only if its move ends on the far row.
    // 0/1 = player men, 2/3 = kings (owner = v % 2). Move = from * 64 + to. A multi-capture is a chain of jumps by one piece: mj = that piece, cp = pieces jumped so far this turn.
    D: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    init: () => { const b = Array(64).fill(null); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) { if (r < 3) b[r * 8 + c] = 1; else if (r > 4) b[r * 8 + c] = 0; } return { b, nx: 0, mj: -1, q: 0, cp: [] }; },
    jumps: (b, cp, i) => { // every jump the piece on square i could make now: [landing square, captured square]
      const v = b[i], p = v % 2, r0 = Math.floor(i / 8), c0 = i % 8, out = [];
      for (const [dr, dc] of GAME_RULES.checkers.D) {
        let r = r0 + dr, c = c0 + dc;
        if (v >= 2) while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] == null) { r += dr; c += dc; }
        if (r < 0 || r > 7 || c < 0 || c > 7) continue;
        const j = r * 8 + c, t = b[j]; if (t == null || t % 2 === p || cp.includes(j)) continue;
        let r2 = r + dr, c2 = c + dc;
        while (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8 && b[r2 * 8 + c2] == null) { out.push([r2 * 8 + c2, j]); if (v < 2) break; r2 += dr; c2 += dc; }
      }
      return out;
    },
    dep: (b, cp, i) => { // most further pieces this piece can still capture from square i
      const R = GAME_RULES.checkers, v = b[i]; let best = 0;
      for (const [to, x] of R.jumps(b, cp, i)) { const b2 = b.slice(); b2[to] = v; b2[i] = null; const d = 1 + R.dep(b2, cp.concat(x), to); if (d > best) best = d; }
      return best;
    },
    cap: (b, m) => { // the square jumped by move m, or -1 for a plain move
      const from = Math.floor(m / 64), to = m % 64, dr = Math.sign(Math.floor(to / 8) - Math.floor(from / 8)), dc = Math.sign((to % 8) - (from % 8)); let x = -1;
      for (let r = Math.floor(from / 8) + dr, c = (from % 8) + dc; r * 8 + c !== to; r += dr, c += dc) if (b[r * 8 + c] != null) x = r * 8 + c;
      return x;
    },
    moves: (s, p) => {
      if (s.nx !== p) return [];
      const R = GAME_RULES.checkers, cp = s.cp || [], own = s.mj >= 0 ? [s.mj] : s.b.map((v, i) => (v != null && v % 2 === p ? i : -1)).filter((i) => i >= 0);
      let best = 0, caps = [];
      for (const i of own) for (const [to, x] of R.jumps(s.b, cp, i)) {
        const b2 = s.b.slice(); b2[to] = b2[i]; b2[i] = null; const d = 1 + R.dep(b2, cp.concat(x), to);
        if (d > best) { best = d; caps = []; } if (d === best) caps.push(i * 64 + to);
      }
      if (caps.length || s.mj >= 0) return caps;
      const out = [];
      for (const i of own) {
        const v = s.b[i], r0 = Math.floor(i / 8), c0 = i % 8, dirs = v >= 2 ? R.D : p === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
        for (const [dr, dc] of dirs) { let r = r0 + dr, c = c0 + dc; while (r >= 0 && r < 8 && c >= 0 && c < 8 && s.b[r * 8 + c] == null) { out.push(i * 64 + r * 8 + c); if (v < 2) break; r += dr; c += dc; } }
      }
      return out;
    },
    play: (s, m, p) => {
      const R = GAME_RULES.checkers, b = s.b.slice(), from = Math.floor(m / 64), to = m % 64, v = b[from], cp = (s.cp || []).slice(), x = R.cap(s.b, m);
      b[from] = null; b[to] = v;
      if (x >= 0) { cp.push(x); if (R.jumps(b, cp, to).length) return { b, nx: p, mj: to, q: 0, cp }; }
      cp.forEach((i) => { b[i] = null; });
      if (v < 2 && (p === 0 ? to < 8 : to >= 56)) b[to] = v + 2;
      return { b, nx: 1 - p, mj: -1, q: x >= 0 || v < 2 ? 0 : s.q + 1, cp: [] };
    },
    win: (s) => (GAME_RULES.checkers.moves(s, s.nx).length ? null : { p: 1 - s.nx, line: null }),
    next: (s) => s.nx,
    draw: (s) => s.q >= 80,
  },
  whot: {
    // Whot, Nigerian rules, 2 players, 54 cards. Card id = shape*100 + number (shapes 0-4; Whot = 520). Move: -1 draw, id plays a card, 520 + 1000*(shape+1) plays Whot calling a shape. Add 100000 to call "Last card".
    // 1 Hold on / 8 Suspension: play again. 2 Pick two / 5 Pick three: stack the same number or draw. 14 General market: opponent picks one, you play again.
    // Last card: when you play down to ONE card you must have called it (the +100000 flag, only offered with 2 cards in hand), otherwise you pick 2 as a penalty.
    sh: (c) => Math.floor(c / 100), nm: (c) => c % 100,
    shuf: (a, rnd) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; },
    init: () => {
      const R = GAME_RULES.whot, set = { 0: [1,2,3,4,5,7,8,10,11,12,13,14], 1: [1,2,3,4,5,7,8,10,11,12,13,14], 2: [1,2,3,5,7,10,11,13,14], 3: [1,2,3,5,7,10,11,13,14], 4: [1,2,3,4,5,7,8] };
      let deck = []; for (const k in set) set[k].forEach((n) => deck.push(k * 100 + n)); for (let i = 0; i < 5; i++) deck.push(520);
      deck = R.shuf(deck, Math.random); const h = [deck.splice(0, 6), deck.splice(0, 6)]; let disc = [];
      for (;;) { const c = deck.shift(); if (R.sh(c) < 5 && ![1,2,5,8,14].includes(R.nm(c))) { disc = [c]; break; } deck.push(c); }
      return { h, deck, disc, want: -1, pend: 0, pk: 0, nx: 0, last: null, t: 0 };
    },
    ok: (s, c) => {
      const R = GAME_RULES.whot; if (s.pend > 0) return R.nm(c) === s.pk; if (R.sh(c) === 5) return true;
      const top = s.disc[s.disc.length - 1]; return s.want >= 0 ? R.sh(c) === s.want : R.sh(c) === R.sh(top) || R.nm(c) === R.nm(top);
    },
    moves: (s, p) => {
      if (s.nx !== p) return []; const R = GAME_RULES.whot, out = [-1];
      const calls = s.h[p].length === 2 ? [0, 100000] : [0];
      new Set(s.h[p]).forEach((c) => { if (!R.ok(s, c)) return; for (const f of calls) { if (R.sh(c) === 5) for (let k = 0; k < 5; k++) out.push(c + 1000 * (k + 1) + f); else out.push(c + f); } });
      return out;
    },
    take: (s, p, n, rnd) => {
      const R = GAME_RULES.whot;
      for (let i = 0; i < n; i++) { if (!s.deck.length) { const top = s.disc.pop(); s.deck = R.shuf(s.disc, rnd); s.disc = [top]; if (!s.deck.length) break; } s.h[p].push(s.deck.shift()); }
    },
    play: (s, m, p, rnd) => {
      const R = GAME_RULES.whot, ns = { ...s, h: s.h.map((a) => a.slice()), deck: s.deck.slice(), disc: s.disc.slice(), t: s.t + 1 };
      if (m === -1) { const n = s.pend > 0 ? s.pend : 1; R.take(ns, p, n, rnd); ns.pend = 0; ns.pk = 0; ns.nx = 1 - p; ns.last = { by: p, draw: n }; return ns; }
      const call = m >= 100000; if (call) m -= 100000;
      const c = m % 1000, k = Math.floor(m / 1000) - 1, n = R.nm(c); ns.h[p].splice(ns.h[p].indexOf(c), 1); ns.disc.push(c);
      ns.want = R.sh(c) === 5 ? k : -1; ns.last = { by: p, card: c, want: ns.want }; ns.nx = 1 - p;
      if (n === 2) { ns.pend = s.pend + 2; ns.pk = 2; } else if (n === 5) { ns.pend = s.pend + 3; ns.pk = 5; }
      else if (n === 1 || n === 8) ns.nx = p;
      else if (n === 14) { R.take(ns, 1 - p, 1, rnd); ns.nx = p; }
      if (ns.h[p].length === 1) { if (call) ns.last.lc = true; else { R.take(ns, p, 2, rnd); ns.last.pen = true; } }
      return ns;
    },
    win: (s) => { for (const p of [0, 1]) if (s.h[p].length === 0) return { p, line: null }; return null; },
    view: (s, i) => ({ ...s, h: s.h.map((a, j) => (j === i ? a : a.map(() => null))), deck: s.deck.map(() => 0), disc: s.disc.slice(-1) }),
    next: (s) => s.nx,
    draw: (s) => s.t > 400,
  },
  race: {
    // Turbo Racer is real-time, so it has no turns or moves. The room only carries the track seed; positions go through race:pos / race:finish.
    init: () => ({ seed: Math.floor(Math.random() * 2147483647), len: 1800 }),
    moves: () => [],
    play: (s) => s,
    win: () => null,
    next: () => 0,
    draw: () => false,
  },
  chess: {
    // Chess. Player 0 = white (starts at the bottom), player 1 = black. Piece = type + 8*owner (1 P, 2 N, 3 B, 4 R, 5 Q, 6 K). Move = from*64 + to (+ 4096 * promotion type).
    init: () => { const b = Array(64).fill(null), back = [4, 2, 3, 5, 6, 3, 2, 4]; for (let c = 0; c < 8; c++) { b[c] = back[c] + 8; b[8 + c] = 9; b[48 + c] = 1; b[56 + c] = back[c]; } return { b, nx: 0, c: [true, true, true, true], ep: -1, hm: 0, lm: null }; },
    moves: (s, p) => (s.nx === p ? chLegal(s, p) : []),
    play: (s, m) => chApply(s, m),
    win: (s) => (chLegal(s, s.nx).length === 0 && chAtt(s.b, chKing(s.b, s.nx), 1 - s.nx) ? { p: 1 - s.nx, line: null } : null),
    draw: (s) => {
      if (s.hm >= 100) return true;
      const o = []; s.b.forEach((v) => { if (v != null && (v & 7) !== 6) o.push(v & 7); });
      if (o.length === 0 || (o.length === 1 && (o[0] === 2 || o[0] === 3))) return true;
      return chLegal(s, s.nx).length === 0 && !chAtt(s.b, chKing(s.b, s.nx), 1 - s.nx);
    },
    next: (s) => s.nx,
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
const gView = (room, i) => { const R = GAME_RULES[room.game]; return R.view ? R.view(room.state, i) : room.state; };
function gStart(game, a, b) {
  const db = readDB(); const id = nanoid(10);
  const players = Math.random() < 0.5 ? [a, b] : [b, a];
  const room = { id, game, players, turn: 0, state: GAME_RULES[game].init(), over: false, rematch: new Set(), score: [0, 0], chat: [] };
  gRooms.set(id, room); for (const p of players) { gPlaying.set(p, id); gQueue.delete(p); }
  const cards = players.map((p) => gCard(db, p));
  players.forEach((p, i) => io.to(`user:${p}`).emit("game:start", { room: id, game, you: i, players: cards, turn: 0, state: gView(room, i), score: room.score }));
  if (game === "race") raceKick(room);
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
  const room = gRooms.get(rid); gPlaying.delete(userId); if (!room) return; clearTimeout(room.rt);
  const idx = room.players.indexOf(userId), other = room.players[1 - idx];
  if (!room.over) { const rec = gFinish(room, 1 - idx); io.to(`user:${other}`).emit("game:over", { room: rid, winner: 1 - idx, line: null, forfeit: true, score: room.score, reward: rec[other], result: "w" }); }
  io.to(`user:${other}`).emit("game:left", { room: rid });
  gPlaying.delete(other); gRooms.delete(rid);
}
const RACE_VMAX = 110; // fastest legal speed (m/s): boost + nitro + slipstream together top out near 95
function raceKick(room) {
  clearTimeout(room.rt); room.pos = [{ d: 0, x: 0, v: 0 }, { d: 0, x: 0, v: 0 }]; room.fin = [null, null]; room.t0 = 0;
  room.rt = setTimeout(() => {
    if (room.over || !gRooms.has(room.id)) return;
    room.t0 = Date.now(); room.players.forEach((p) => io.to(`user:${p}`).emit("race:go", { room: room.id }));
    room.rt = setTimeout(() => raceEnd(room, null), 150000); // nobody finished in 2.5 minutes: furthest car wins
  }, 3500);
}
function raceEnd(room, w) {
  if (room.over) return; clearTimeout(room.rt);
  if (w == null) { const a = room.pos[0].d, b = room.pos[1].d; w = Math.abs(a - b) < 1 ? -1 : a > b ? 0 : 1; }
  const rec = gFinish(room, w);
  room.players.forEach((p, i) => io.to(`user:${p}`).emit("game:over", { room: room.id, winner: w, line: null, score: room.score, reward: rec[p], result: w < 0 ? "d" : w === i ? "w" : "l", times: room.fin }));
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
  socket.on("game:invite", ({ to, game, kind, viaChat } = {}, f) => {
    // viaChat: the invite is a game bubble in a chat, so the friend may open it a little later (they do not have to be online right now)
    if (!GAME_RULES[game] || !to || to === me || (!viaChat && !userSockets.has(to)) || gPlaying.has(to) || gPlaying.has(me)) return ack(f, { ok: false, reason: gPlaying.has(to) ? "busy" : "offline" });
    const id = nanoid(8); gInvites.set(id, { from: me, to, game, at: Date.now() });
    setTimeout(() => { const iv = gInvites.get(id); if (iv) { gInvites.delete(id); io.to(`user:${iv.from}`).emit("game:invite-expired", { id }); } }, viaChat ? 30 * 60 * 1000 : 120000);
    const db = readDB(); io.to(`user:${to}`).emit("game:invite", { id, game, kind: kind === "challenge" ? "challenge" : "invite", from: gCard(db, me) }); ack(f, { ok: true, id });
  });
  socket.on("game:respond", ({ id, accept } = {}, f) => {
    const iv = gInvites.get(id); if (!iv || iv.to !== me) return ack(f, { ok: false, reason: "expired" });
    if (!accept) { gInvites.delete(id); ack(f, { ok: true }); return void io.to(`user:${iv.from}`).emit("game:declined", { id, by: gCard(readDB(), me) }); }
    if (!userSockets.has(iv.from)) return ack(f, { ok: false, reason: "away" }); // the sender is offline: keep the invite so they can try again
    if (gPlaying.has(iv.from) || gPlaying.has(me)) return ack(f, { ok: false, reason: "busy" });
    gInvites.delete(id); ack(f, { ok: true });
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
      room.players.forEach((p, i) => { io.to(`user:${p}`).emit("game:move", { room: rid, state: gView(room, i), turn: -1, last: move, by: idx }); io.to(`user:${p}`).emit("game:over", { room: rid, winner: w ? w.p : -1, line: w ? w.line : null, score: room.score, reward: rec[p], result: w ? (w.p === i ? "w" : "l") : "d" }); });
    } else { room.turn = R.next ? R.next(room.state) : 1 - idx; room.players.forEach((p, i) => io.to(`user:${p}`).emit("game:move", { room: rid, state: gView(room, i), turn: room.turn, last: move, by: idx, next: room.players[room.turn] })); }
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
    room.players.forEach((p, i) => io.to(`user:${p}`).emit("game:start", { room: rid, game: room.game, you: i, players: cards, turn: 0, state: gView(room, i), score: room.score, rematch: true }));
    if (room.game === "race") raceKick(room);
  });
  socket.on("race:pos", ({ room: rid, d, x, v, c, n } = {}) => {
    const room = gRooms.get(rid); if (!room || room.game !== "race" || room.over || !room.t0) return;
    const idx = room.players.indexOf(me); if (idx < 0) return;
    d = Number(d); x = Number(x); v = Number(v);
    if (!(d >= 0) || !(x >= 0) || !(v >= 0)) return;
    const el = (Date.now() - room.t0) / 1000; if (d > el * RACE_VMAX + 30) return; // faster than any car can go: ignore
    room.pos[idx] = { d, x: Math.min(3, x), v: Math.min(RACE_VMAX, v) };
    io.to(`user:${room.players[1 - idx]}`).emit("race:pos", { room: rid, d, x: Math.min(3, x), v: Math.min(RACE_VMAX, v), c: c ? 1 : 0, n: n ? 1 : 0 });
  });
  socket.on("race:finish", ({ room: rid } = {}) => {
    const room = gRooms.get(rid); if (!room || room.game !== "race" || room.over || !room.t0) return;
    const idx = room.players.indexOf(me); if (idx < 0 || room.fin[idx] != null) return;
    const el = Date.now() - room.t0;
    if (room.pos[idx].d < room.state.len - 25 || el < (room.state.len / RACE_VMAX) * 1000 - 500) return; // has not really driven the whole track
    room.fin[idx] = el; raceEnd(room, idx);
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

// Sends one message. Used by the live socket ("message:send") and by the no-JavaScript Lite pages (/lite).
function handleSend(userId, { conversationId, text, audio, duration, file, replyTo, forwarded, viewOnce, poll, mentions } = {}, ack) {
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
      if (viewOnce === true && /^(image|video)\//.test(mime)) { att.viewOnce = true; if (!/\S/.test(String(file.caption || "")) && (text === "📷 Photo" || text === "📎 " + name)) text = mime.startsWith("video/") ? "🎥 View once video" : "📷 View once photo"; }
    }

    // poll: a question with 2-6 options; people vote with "poll:vote"
    let pollData = null;
    if (poll && typeof poll === "object" && !voice && !att) {
      const q = String(poll.question || "").trim().slice(0, 200);
      const opts = (Array.isArray(poll.options) ? poll.options : []).map((o) => String(o || "").trim().slice(0, 80)).filter(Boolean).slice(0, 6);
      if (!q) return fail("Add a question for the poll");
      if (opts.length < 2) return fail("A poll needs at least 2 options");
      if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return fail("Poll options must be different");
      pollData = { question: q, multi: poll.multi === true, options: opts.map((t, i) => ({ id: "o" + i, text: t })), votes: {} };
      text = "\uD83D\uDCCA " + q;
    }
    if (!text || !text.trim()) return fail("Message text required");
    if (text.length > 15000) return fail("Message is too long (max 15000 characters)");
    const db = readDB();
    if (YT_RE.test(String(text || "")) && !isCreator(db.users.find((u) => u.id === userId))) return fail(YT_MSG);
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
    if (convo.chatRoom) { const t0 = Date.now(), log = (roomLast.get(userId) || []).filter((x) => t0 - x < 10000); if (log.length >= 12) return fail("You're sending very fast, wait a few seconds"); log.push(t0); roomLast.set(userId, log); } // free flow: up to 12 messages per 10 s
    // @mentions (groups only): only current members, never yourself, at most 20
    const mentionIds = convo.isGroup && Array.isArray(mentions) ? [...new Set(mentions.filter((id) => typeof id === "string" && id !== userId && convo.participantIds.includes(id)))].slice(0, 20) : [];
    // reply: keep a small snapshot of the quoted message so the quote still shows if the original is deleted later
    let reply = null;
    if (typeof replyTo === "string" && replyTo) {
      const orig = db.messages.find((x) => x.id === replyTo && x.conversationId === conversationId);
      if (orig && !orig.deleted) {
        const au = db.users.find((u) => u.id === orig.senderId);
        reply = {
          id: orig.id, senderId: orig.senderId, name: au ? au.name : "Former member",
          text: orig.audio ? "🎤 Voice note" : orig.file ? (String(orig.file.mime).startsWith("image/") ? "📷 Photo" : "📎 " + orig.file.name) : String(orig.text).slice(0, 140),
        };
      }
    }
    const message = {
      id: nanoid(14),
      conversationId,
      senderId: userId,
      text: text.trim(),
      ...(reply ? { replyTo: reply } : {}),
      ...(forwarded === true ? { forwarded: true } : {}),
      ...(mentionIds.length ? { mentions: mentionIds } : {}),
      ...(voice ? { audio, duration: Math.min(Math.round(Number(duration)) || 0, 120) } : {}),
      ...(att ? { file: { name: att.name, mime: att.mime, size: att.size, data: att.data } } : {}),
      ...(att && att.viewOnce ? { viewOnce: true, viewedBy: [] } : {}),
      ...(pollData ? { poll: pollData } : {}),
      time: Date.now(),
      read: false,
    };
    {
      const ttl = Number(convo.disappearAfter) || 0, now = Date.now();
      let exp = ttl ? now + ttl * 1000 : 0;
      if (message.viewOnce) exp = exp ? Math.min(exp, now + VIEW_ONCE_TTL_MS) : now + VIEW_ONCE_TTL_MS;
      if (exp) message.expiresAt = exp;
    }
    // delivered = the other person's app is online right now (groups: no ticks for this)
    if (!convo.isGroup) { const otherId = convo.participantIds.find((id) => id !== userId); const live = otherId && userSockets.get(otherId); if (live && live.size) message.delivered = true; }
    db.messages.push(message);
    convo.updatedAt = Date.now();
    writeDB(db);

    io.to(`conv:${conversationId}`).emit("message:new", roomSender(db, convo, stripViewOnce(message)));
    try { pushMessage(db, convo, message, userId); } catch (e) { console.error("push failed", e.message); }
    if (ack) ack({ message: stripViewOnce(message) });
    try { autoReply(db, convo, message); } catch (e) { console.error("auto reply failed", e.message); }
    try { aiAfterSend(db, convo, message, userId); } catch (e) { console.error("ai failed", e.message); }
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
  deliverPendingCall(userId);
  socket.on("presence:get", (ack) => { if (typeof ack === "function") ack(presenceSnapshot(userId)); });
  socket.data.visible = true;
  socket.on("app:visible", (v) => { socket.data.visible = !!v; }); // lets the server know when the app is in the background, so it sends a push instead

  const db = readDB();
  let joinedRoom = false;
  try { if (joinChatRoom(db, userId)) { writeDB(db); joinedRoom = true; } } catch (e) { console.error("chat room join failed", e.message); }
  try { if (noteCountry(db, db.users.find((u) => u.id === userId), GEO.fromHeaders(socket.handshake.headers), "ip")) writeDB(db); } catch (e) { console.error("country note failed", e.message); }
  // the app reports its time zone and language: used for the Chat Room flag when the host gives no country header
  socket.on("geo:set", ({ tz, lang } = {}) => {
    try {
      const d = readDB(), me = d.users.find((u) => u.id === userId), viaTz = GEO.fromTimezone(tz);
      if (noteCountry(d, me, viaTz || GEO.fromLanguage(lang), viaTz ? "tz" : "lang")) writeDB(d);
    } catch (e) { console.error("country report failed", e.message); }
  });
  const myConvos = db.conversations.filter((c) => c.participantIds.includes(userId));
  for (const c of myConvos) socket.join(`conv:${c.id}`);
  if (joinedRoom) io.to(`user:${userId}`).emit("conversation:added", { id: CHAT_ROOM_ID });
  // messages that were waiting for this person are delivered now: tell the senders so their ticks update
  try {
    if ((userSockets.get(userId) || new Set()).size <= 1) {
      const dmIds = new Set(myConvos.filter((c) => !c.isGroup).map((c) => c.id)), got = {};
      for (const m of db.messages) if (dmIds.has(m.conversationId) && m.senderId !== userId && !m.delivered && !m.read && !m.deleted) { m.delivered = true; (got[m.conversationId] || (got[m.conversationId] = [])).push(m.id); }
      const cids = Object.keys(got);
      if (cids.length) { writeDB(db); for (const cid of cids) io.to(`conv:${cid}`).emit("message:delivered", { conversationId: cid, ids: got[cid] }); }
    }
  } catch (e) { console.error("delivery marking failed", e.message); }

  if (!hidesPresence(db.users.find((u) => u.id === userId))) io.emit("presence:update", { userId, online: true });
  // Games: tell everyone else a player just came online (first device only, and at most once a minute per player so reconnects don't spam)
  if (userSockets.get(userId).size === 1) {
    const meU = db.users.find((u) => u.id === userId);
    const now = Date.now();
    if (meU && !hidesPresence(meU) && now - (gOnlineAt.get(userId) || 0) > 60000) {
      gOnlineAt.set(userId, now);
      socket.broadcast.emit("game:player-online", { player: { id: meU.id, name: meU.name, initials: publicUser(meU).initials, color: publicUser(meU).color, avatar: publicUser(meU).avatar } });
    }
  }

  socket.on("message:send", (data, ack) => handleSend(userId, data || {}, ack));

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
  // ---- emoji reactions: one per person per message; sending the same emoji again (or an empty one) removes it ----
  const REACTION_RE = /^[\p{Extended_Pictographic}\p{Regional_Indicator}\u200d\ufe0f\u20e3\u{1F3FB}-\u{1F3FF}]+$/u;
  socket.on("message:react", ({ messageId, emoji } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const db = readDB();
    const m = db.messages.find((x) => x.id === messageId);
    const convo = m && db.conversations.find((c) => c.id === m.conversationId);
    if (!m || !convo || !convo.participantIds.includes(userId)) return fail("Message not found");
    if (m.deleted) return fail("This message was deleted");
    if (!convo.isGroup) {
      const otherId = convo.participantIds.find((id) => id !== userId);
      const me = db.users.find((u) => u.id === userId), other = db.users.find((u) => u.id === otherId);
      if (me && (me.blocked || []).includes(otherId)) return fail("You blocked this contact. Unblock them to react.");
      if (other && (other.blocked || []).includes(userId)) return fail("This reaction couldn't be delivered.");
    }
    const map = { ...(m.reactions || {}) };
    if (emoji === null || emoji === undefined || emoji === "" || map[userId] === emoji) delete map[userId];
    else {
      if (typeof emoji !== "string" || [...emoji].length > 10 || !REACTION_RE.test(emoji)) return fail("That emoji can't be used");
      map[userId] = emoji;
    }
    if (Object.keys(map).length) m.reactions = map; else delete m.reactions;
    writeDB(db);
    const reactions = m.reactions || {};
    io.to(`conv:${convo.id}`).emit("message:reaction", { conversationId: convo.id, messageId: m.id, reactions });
    if (typeof ack === "function") ack({ reactions });
  });

  // ---- disappearing messages: set the chat timer (anyone in a private chat; only the admin in a group) ----
  socket.on("conversation:disappearing", ({ conversationId, seconds } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const db = readDB();
    const convo = db.conversations.find((c) => c.id === conversationId);
    if (!convo || !convo.participantIds.includes(userId)) return fail("Conversation not found");
    if (convo.isGroup && !isGroupBoss(db, convo, userId)) return fail(convo.chatRoom ? "Only the creator can modify the Chat Room" : "Only the group admin can change this");
    const s = Number(seconds) || 0;
    if (!DISAPPEAR_CHOICES.includes(s)) return fail("Choose a valid timer");
    if ((convo.disappearAfter || 0) !== s) {
      if (s) convo.disappearAfter = s; else delete convo.disappearAfter;
      writeDB(db);
      io.to(`conv:${convo.id}`).emit("conversation:disappearing", { conversationId: convo.id, disappearAfter: s, by: userId });
      io.to(`conv:${convo.id}`).emit("conversation:update", { id: convo.id });
    }
    if (typeof ack === "function") ack({ disappearAfter: s });
  });
  // ---- view-once: hand the photo/video to this person one time, then forget it ----
  socket.on("message:view-once", ({ messageId } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const db = readDB();
    const m = db.messages.find((x) => x.id === messageId);
    const convo = m && db.conversations.find((c) => c.id === m.conversationId);
    if (!m || !convo || !convo.participantIds.includes(userId)) return fail("Message not found");
    if (!m.viewOnce || m.deleted) return fail("This can't be opened");
    if (m.senderId === userId) return fail("You can't open your own view once media");
    if ((m.viewedBy || []).includes(userId)) return fail("You already opened this");
    if (!m.file || typeof m.file.data !== "string") return fail("This media is no longer available");
    const { data, mime, name, size } = m.file;
    (m.viewedBy || (m.viewedBy = [])).push(userId);
    const everyone = convo.participantIds.filter((id) => id !== m.senderId);
    if (everyone.every((id) => m.viewedBy.includes(id))) m.file = { name, mime, size, gone: true }; // last viewer: the bytes are deleted for good
    writeDB(db);
    io.to(`conv:${convo.id}`).emit("message:updated", stripViewOnce(m));
    if (typeof ack === "function") ack({ file: { data, mime, name } });
  });

  // ---- polls: tap an option to vote, tap it again to take the vote back (single-choice polls move your vote) ----
  socket.on("poll:vote", ({ messageId, optionId } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const db = readDB();
    const m = db.messages.find((x) => x.id === messageId);
    const convo = m && db.conversations.find((c) => c.id === m.conversationId);
    if (!m || !convo || !convo.participantIds.includes(userId)) return fail("Poll not found");
    if (!m.poll || m.deleted) return fail("Poll not found");
    if (!m.poll.options.some((o) => o.id === optionId)) return fail("Choose one of the options");
    const votes = m.poll.votes || (m.poll.votes = {});
    const had = (votes[optionId] || []).includes(userId);
    if (!m.poll.multi) for (const k of Object.keys(votes)) votes[k] = (votes[k] || []).filter((id) => id !== userId);
    if (!had) votes[optionId] = [...(votes[optionId] || []).filter((id) => id !== userId), userId];
    else votes[optionId] = (votes[optionId] || []).filter((id) => id !== userId);
    writeDB(db);
    io.to(`conv:${convo.id}`).emit("message:updated", m);
    if (typeof ack === "function") ack({ poll: m.poll });
  });
  // ---- scheduled messages: text sent later (kept on your account, so it still goes out if you are offline) ----
  const SCHEDULE_MAX_MS = 30 * 24 * 60 * 60 * 1000, SCHEDULE_MAX_PENDING = 20;
  socket.on("message:schedule", ({ conversationId, text, sendAt } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const t = String(text || "").trim(), at = Number(sendAt);
    if (!t) return fail("Type the message to schedule");
    if (t.length > 15000) return fail("Message is too long (max 15000 characters)");
    if (!at || at < Date.now() + 5000) return fail("Pick a time in the future");
    if (at > Date.now() + SCHEDULE_MAX_MS) return fail("You can schedule up to 30 days ahead");
    const db = readDB();
    const convo = db.conversations.find((c) => c.id === conversationId);
    const me = db.users.find((u) => u.id === userId);
    if (!convo || !me || !convo.participantIds.includes(userId)) return fail("Conversation not found");
    if (YT_RE.test(t) && !isCreator(me)) return fail(YT_MSG);
    if (!convo.isGroup) {
      const otherId = convo.participantIds.find((id) => id !== userId), other = db.users.find((u) => u.id === otherId);
      if ((me.blocked || []).includes(otherId)) return fail("You blocked this contact. Unblock them to send messages.");
      if (other && (other.blocked || []).includes(userId)) return fail("This message couldn't be delivered.");
    }
    me.scheduled = me.scheduled || [];
    if (me.scheduled.length >= SCHEDULE_MAX_PENDING) return fail("You can have up to 20 scheduled messages");
    const item = { id: nanoid(10), conversationId, text: t, sendAt: at, createdAt: Date.now() };
    me.scheduled.push(item);
    writeDB(db);
    if (typeof ack === "function") ack({ item });
  });
  socket.on("message:scheduled:list", ({ conversationId } = {}, ack) => {
    const me = readDB().users.find((u) => u.id === userId);
    const items = ((me && me.scheduled) || []).filter((x) => x.conversationId === conversationId).sort((a, b) => a.sendAt - b.sendAt);
    if (typeof ack === "function") ack({ items });
  });
  socket.on("message:schedule:cancel", ({ id } = {}, ack) => {
    const db = readDB(), me = db.users.find((u) => u.id === userId);
    if (me && me.scheduled && me.scheduled.some((x) => x.id === id)) { me.scheduled = me.scheduled.filter((x) => x.id !== id); writeDB(db); }
    if (typeof ack === "function") ack({ ok: true });
  });

  // ---- pin a message to the top of the chat (up to 3; the oldest pin drops off when a 4th is added) ----
  socket.on("message:pin", ({ messageId, pin } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const db = readDB();
    const m = db.messages.find((x) => x.id === messageId);
    const convo = m && db.conversations.find((c) => c.id === m.conversationId);
    if (!m || !convo || !convo.participantIds.includes(userId)) return fail("Message not found");
    if (m.deleted) return fail("This message was deleted");
    if (m.viewOnce) return fail("View once media can't be pinned");
    if (convo.chatRoom && !isGroupBoss(db, convo, userId)) return fail("Only the creator can modify the Chat Room"); // pins change what everyone sees at the top of the room
    let list = (convo.pinnedMsgs || []).filter((x) => x.id !== m.id);
    if (pin !== false) {
      const text = m.audio ? "🎤 Voice note" : m.file ? (String(m.file.mime).startsWith("image/") ? "📷 Photo" : "📎 " + m.file.name) : String(m.text || "").slice(0, 100);
      list.push({ id: m.id, senderId: m.senderId, text, at: Date.now(), by: userId });
      while (list.length > 3) list.shift();
    }
    if (list.length) convo.pinnedMsgs = list; else delete convo.pinnedMsgs;
    writeDB(db);
    io.to(`conv:${convo.id}`).emit("conversation:pinned", { conversationId: convo.id, pinnedMsgs: list, by: userId });
    io.to(`conv:${convo.id}`).emit("conversation:update", { id: convo.id });
    if (typeof ack === "function") ack({ pinnedMsgs: list });
  });
  socket.on("message:edit", ({ messageId, text } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const o = ownMessage(messageId, fail); if (!o) return;
    const { db, m } = o;
    if (m.deleted) return fail("This message was deleted");
    if (m.audio || m.file || m.poll) return fail("Only text messages can be edited");
    if (EDIT_WINDOW_MS && Date.now() - m.time > EDIT_WINDOW_MS) return fail("Messages can only be edited for 15 minutes after sending");
    const t = String(text || "").trim();
    if (!t) return fail("Message text required");
    if (YT_RE.test(t) && !isCreator(db.users.find((u) => u.id === userId))) return fail(YT_MSG);
    if (t.length > 15000) return fail("Message is too long (max 15000 characters)");
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
      delete m.audio; delete m.duration; delete m.file; delete m.poll; delete m.edited; delete m.editedAt;
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
    if (userCall.has(to)) return fail(first + " is on another call");
    // an offline person is not turned away any more: the caller hears ringing and sees "Connecting…" while their phone gets a push alert
    const offline = !userSockets.has(to);
    const id = nanoid(12);
    const call = { id, from: userId, to, conversationId, video: !!video, state: "ringing", offline, timer: setTimeout(() => endCall(id, "missed"), RING_MS) };
    activeCalls.set(id, call);
    userCall.set(userId, id);
    userCall.set(to, id);
    if (!offline) io.to(`user:${to}`).emit("call:incoming", { callId: id, conversationId, video: !!video, from: memberView(me) });
    if (offline || !userIsActive(to)) pushCall(to, me, "Incoming " + (video ? "video" : "voice") + " call", "call-" + id);
    if (typeof ack === "function") ack({ callId: id, offline });
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

  // ---- group calls ----
  socket.on("gcall:start", ({ conversationId, video } = {}, ack) => {
    const fail = (error, extra) => { if (typeof ack === "function") ack({ error, ...(extra || {}) }); };
    const db = readDB();
    const convo = db.conversations.find((c) => c.id === conversationId && c.isGroup && c.participantIds.includes(userId));
    const me = db.users.find((u) => u.id === userId);
    if (!convo || !me) return fail("You can only call groups you are in");
    if (convGroupCall.has(conversationId)) return fail("A call is already going on in this group", { joinCallId: convGroupCall.get(conversationId) });
    if (userCall.has(userId)) return fail("You are already in a call");
    const id = nanoid(12);
    const g = { id, conversationId, video: !!video, host: userId, started: Date.now(), members: new Map([[userId, Date.now()]]) };
    groupCalls.set(id, g);
    convGroupCall.set(conversationId, id);
    userCall.set(userId, id);
    const label = "Group " + (video ? "video" : "voice") + " call \u00B7 " + (convo.name || "Group");
    const payload = { callId: id, conversationId, video: !!video, groupName: convo.name || "Group", groupAvatar: convo.avatar ? `/api/v1/groups/${convo.id}/avatar?v=${convo.avatarVersion || 1}` : null, from: memberView(me) };
    for (const pid of convo.participantIds) {
      if (pid === userId) continue;
      const u = db.users.find((x) => x.id === pid);
      if (!u || (u.blocked || []).includes(userId)) continue;
      if (userSockets.has(pid)) io.to(`user:${pid}`).emit("gcall:incoming", payload);
      if (!userIsActive(pid)) pushCall(pid, me, label, "gcall-" + id);
    }
    gcTell(conversationId, g);
    if (typeof ack === "function") ack({ callId: id, video: !!video });
  });
  socket.on("gcall:join", ({ callId } = {}, ack) => {
    const fail = (error) => { if (typeof ack === "function") ack({ error }); };
    const g = groupCalls.get(callId);
    if (!g) return fail("This call has ended");
    const db = readDB();
    const convo = db.conversations.find((c) => c.id === g.conversationId && c.isGroup && c.participantIds.includes(userId));
    const me = db.users.find((u) => u.id === userId);
    if (!convo || !me) return fail("You are not in this group");
    if (g.members.has(userId)) { // same person coming back (a dropped connection): clear their old place, keep the room open
      g.members.delete(userId);
      for (const id of g.members.keys()) io.to(`user:${id}`).emit("gcall:left", { callId, userId });
    }
    const live = g;
    if (userCall.has(userId) && userCall.get(userId) !== callId) return fail("You are already in a call");
    const max = live.video ? GC_MAX.video : GC_MAX.voice;
    if (live.members.size >= max) return fail("This call is full (" + max + " people at most)");
    const peers = [...live.members.keys()].map((id) => memberView(db.users.find((u) => u.id === id))).filter(Boolean);
    live.members.set(userId, Date.now());
    userCall.set(userId, callId);
    for (const id of peers.map((p) => p.id)) io.to(`user:${id}`).emit("gcall:joined", { callId, user: memberView(me) });
    gcTell(live.conversationId, live);
    if (typeof ack === "function") ack({ callId, video: live.video, peers, started: live.started });
  });
  socket.on("gcall:signal", ({ callId, to, data } = {}) => {
    const g = groupCalls.get(callId);
    if (!g || !g.members.has(userId) || !g.members.has(to) || !data || typeof data !== "object") return;
    if (JSON.stringify(data).length > 20000) return;
    io.to(`user:${to}`).emit("gcall:signal", { callId, from: userId, data });
  });
  socket.on("gcall:leave", ({ callId } = {}) => gcLeave(userId, callId));
  socket.on("gcall:sync", (ack) => { // which of my groups have a call running right now
    if (typeof ack !== "function") return;
    const out = [];
    for (const g of groupCalls.values()) {
      const convo = readDB().conversations.find((c) => c.id === g.conversationId);
      if (convo && convo.participantIds.includes(userId)) out.push(gcView(g));
    }
    ack(out);
  });

  registerGames(socket);

  // typing = writing a message; "recording" = voice note; "photo" / "file" = sending an attachment
  const TYPING_KINDS = new Set(["typing", "recording", "photo", "file"]);
  // the open chat tells us new messages were seen (so the sender's ticks turn green)
  socket.on("messages:read", ({ conversationId } = {}) => {
    const db2 = readDB(), convo = db2.conversations.find((c) => c.id === conversationId);
    if (!convo || !convo.participantIds.includes(userId)) return;
    const ids = [];
    for (const m of db2.messages) {
      if (m.conversationId !== conversationId || m.senderId === userId || m.deleted) continue;
      if (convo.isGroup) { if (!(m.readBy || (m.readBy = [])).includes(userId)) { m.readBy.push(userId); (m.readTimes || (m.readTimes = {}))[userId] = Date.now(); ids.push(m.id); } }
      else if (!m.read) { m.read = true; m.readAt = Date.now(); ids.push(m.id); }
    }
    if (ids.length) { writeDB(db2); announceRead(db2, convo, userId, ids); }
  });
  socket.on("typing", ({ conversationId, typing, kind } = {}) => {
    if (typeof conversationId !== "string" || !socket.rooms.has(`conv:${conversationId}`)) return;
    socket.to(`conv:${conversationId}`).emit("typing", { conversationId, userId, typing: !!typing, kind: TYPING_KINDS.has(kind) ? kind : "typing" });
  });

  socket.on("disconnect", () => {
    const set = userSockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        userSockets.delete(userId);
        lastSeen.set(userId, Date.now());
        if (userCall.has(userId)) endCall(userCall.get(userId), "failed");
        gcLeaveAll(userId);
        if (!hidesPresence(readDB().users.find((u) => u.id === userId))) io.emit("presence:update", { userId, online: false, lastSeen: lastSeen.get(userId) });
      }
    }
  });
});

initDB()
  .then(() => server.listen(PORT, () => console.log(`Letschat Africa server listening on port ${PORT}`)))
  .catch((e) => { console.error("Could not start (database error):", e); process.exit(1); });
