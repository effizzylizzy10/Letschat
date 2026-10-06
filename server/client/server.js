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
const COLLECTIONS = ["users", "conversations", "messages"];
const table = (c) => "lc_" + c;
let cache = null;
const saved = new Map(); // "collection/id" -> JSON last written
let flushChain = Promise.resolve();

function emptyDB() { return { users: [], conversations: [], messages: [] }; }
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
    const changed = [];
    for (const item of cache[c]) {
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
}

async function initDB() {
  if (!USE_DB) return;
  cache = emptyDB();
  for (const c of COLLECTIONS) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table(c)).select("id,data").order("id").range(from, from + 999);
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
function publicUser(u) {
  return { 
    id: u.id, 
    name: u.name, 
    phone: u.phone || null, email: u.email || null, 
    about: u.about, 
    initials: u.initials, 
    color: u.color, 
    avatar: u.avatar || null 
  };
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

app.patch("/api/me", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  
  if (req.body.name !== undefined) {
    const n = String(req.body.name).trim();
    if (!n || n.length > 60) return res.status(400).json({ error: "Name must be 1 to 60 characters" });
  }
  if (typeof req.body.about === "string" && req.body.about.length > 139) {
    return res.status(400).json({ error: "About must be 139 characters or fewer" });
  }
  if (req.body.name) {
    user.name = String(req.body.name).trim();
    user.initials = initials(user.name);
  }
  if (typeof req.body.about === "string") user.about = req.body.about.trim();
  if (typeof req.body.avatar === "string" || req.body.avatar === null) {
    user.avatar = req.body.avatar;
  }
  writeDB(db);
  res.json({ user: publicUser(user) });
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
      const otherId = c.participantIds.find((id) => id !== req.user.id);
      const other = db.users.find((u) => u.id === otherId);
      const msgs = db.messages.filter((m) => m.conversationId === c.id);
      const last = msgs[msgs.length - 1] || null;
      return {
        id: c.id,
        other: other ? publicUser(other) : { id: otherId, name: "Unknown", initials: "?", color: "#5B6673" },
        lastMessage: last,
        unread: msgs.filter((m) => m.senderId !== req.user.id && !m.read).length,
        updatedAt: c.updatedAt || c.createdAt,
      };
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  res.json({ conversations: enriched });
});

app.post("/api/conversations", authMiddleware, (req, res) => {
  const db = readDB();
  const other = findByPhoneOrEmail(db, req.body.phone);
  if (!other) return res.status(404).json({ error: "No Letschat Africa user with that phone number or email" });
  if (other.id === req.user.id) return res.status(400).json({ error: "That's your own number" });

  let convo = db.conversations.find(
    (c) => c.participantIds.includes(req.user.id) && c.participantIds.includes(other.id)
  );
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
    if (m.senderId !== req.user.id && !m.read) {
      m.read = true;
      changed = true;
    }
  }
  if (changed) writeDB(db);
  // pagination: ?limit=1..500 (default 200) and ?before=<timestamp ms> for older pages
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
  const before = Number(req.query.before) || Infinity;
  const older = all.filter((m) => m.time < before);
  const page = older.slice(-limit);
  res.json({ messages: page, hasMore: older.length > page.length });
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
  cors: { origin: CLIENT_ORIGIN === "*" ? "*" : CLIENT_ORIGIN.split(",") },
});

const userSockets = new Map();

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

  const db = readDB();
  const myConvos = db.conversations.filter((c) => c.participantIds.includes(userId));
  for (const c of myConvos) socket.join(`conv:${c.id}`);

  io.emit("presence:update", { userId, online: true });

  socket.on("message:send", ({ conversationId, text }, ack) => {
    if (!text || !text.trim()) {
      if (ack) ack({ error: "Message text required" });
      return;
    }
    if (text.length > 4000) {
      if (ack) ack({ error: "Message is too long (max 4000 characters)" });
      return;
    }
    const db = readDB();
    const convo = db.conversations.find((c) => c.id === conversationId);
    if (!convo || !convo.participantIds.includes(userId)) {
      if (ack) ack({ error: "Not a participant of this conversation" });
      return;
    }
    const message = {
      id: nanoid(14),
      conversationId,
      senderId: userId,
      text: text.trim(),
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
        io.emit("presence:update", { userId, online: false });
      }
    }
  });
});

initDB()
  .then(() => server.listen(PORT, () => console.log(`Letschat Africa server listening on port ${PORT}`)))
  .catch((e) => { console.error("Could not start (database error):", e); process.exit(1); });
