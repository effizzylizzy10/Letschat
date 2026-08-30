// Letschat Africa server -- realtime chat backend
//
// Storage: a single JSON file (data/db.json). Fine for a small demo / two
// people testing on real phones. Swap `readDB`/`writeDB` for a real database
// (Postgres, Mongo, etc.) later without touching the routes or socket logic.
//
// Auth: identity is just a phone number + display name -- there's no real
// SMS provider wired up, so "verification" is client-side only. Anyone who
// knows a phone number can currently register it. Fine for testing with a
// friend; add a real OTP provider (e.g. Twilio Verify) before trusting this
// with strangers.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { nanoid } = require("nanoid");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const DB_PATH = path.join(__dirname, "data", "db.json");

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { users: [], conversations: [], messages: [] };
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return { users: [], conversations: [], messages: [] };
  }
}
function writeDB(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
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
  return { id: u.id, name: u.name, phone: u.phone, about: u.about, initials: u.initials, color: u.color };
}
const PALETTE = ["#35D0BA", "#F2B84B", "#8B7CF6", "#FF6B5D", "#5B6673", "#4FA8E0"];
function colorFor(id) {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return PALETTE[sum % PALETTE.length];
}

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN === "*" ? "*" : CLIENT_ORIGIN.split(",") }));
app.use(express.json());

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

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/auth/register-or-login", (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const name = (req.body.name || "").trim();
  if (!phone) return res.status(400).json({ error: "Phone number required" });

  const db = readDB();
  let user = db.users.find((u) => u.phone === phone);

  if (!user) {
    if (!name) return res.status(400).json({ error: "Name required for new accounts", newUser: true });
    user = {
      id: nanoid(10),
      phone,
      name,
      about: "Hey there! I'm using Letschat Africa.",
      initials: initials(name),
      color: colorFor(phone),
      createdAt: Date.now(),
    };
    db.users.push(user);
    writeDB(db);
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch("/api/me", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (req.body.name) {
    user.name = String(req.body.name).trim();
    user.initials = initials(user.name);
  }
  if (typeof req.body.about === "string") user.about = req.body.about.trim();
  writeDB(db);
  res.json({ user: publicUser(user) });
});

app.get("/api/users/lookup", authMiddleware, (req, res) => {
  const phone = normalizePhone(req.query.phone);
  if (!phone) return res.status(400).json({ error: "phone query param required" });
  const db = readDB();
  const user = db.users.find((u) => u.phone === phone);
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
  const phone = normalizePhone(req.body.phone);
  const db = readDB();
  const other = db.users.find((u) => u.phone === phone);
  if (!other) return res.status(404).json({ error: "No Letschat Africa user with that phone number" });
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
  const msgs = db.messages.filter((m) => m.conversationId === req.params.id);
  let changed = false;
  for (const m of msgs) {
    if (m.senderId !== req.user.id && !m.read) {
      m.read = true;
      changed = true;
    }
  }
  if (changed) writeDB(db);
  res.json({ messages: msgs });
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
    if (!text || !text.trim()) return;
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

server.listen(PORT, () => {
  console.log(`Letschat Africa server listening on http://localhost:${PORT}`);
});
