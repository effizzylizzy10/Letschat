"use strict";
/*
 * Letschat notification API (added by patch-notifications.js, which hooks this file into server.js; see NOTIFICATIONS.md).
 *
 * It uses the existing database (each user record gets two small fields: notifPrefs and notifications) and the existing sign-in
 * (authMiddleware). Every route works only on the signed-in person's own data; nothing here can read another account.
 *
 * Routes (all need "Authorization: Bearer <token>"):
 *   GET    /api/notifications?limit=30&before=<time>&unread=1   history, newest first
 *   GET    /api/notifications/unread-count                      { count }   (use it for the app badge)
 *   POST   /api/notifications/read          { id } or { tag }   mark one, or every alert of one chat, as read (call it when a chat is opened)
 *   POST   /api/notifications/read-all                          mark all as read
 *   DELETE /api/notifications/:id                               delete one
 *   DELETE /api/notifications                                   delete all
 *   GET    /api/notifications/preferences                       the person's settings (same on every device)
 *   PUT    /api/notifications/preferences                       change settings (only the keys sent are changed)
 *   POST   /api/notifications/test                              send a test alert to this person's own devices
 *   GET    /api/push/status                                     which channels the server can send on (no secrets)
 *   GET    /api/push/devices                                    this person's registered devices (token never shown in full)
 *   DELETE /api/push/devices/:id                                forget one device
 * Device registration stays at the existing POST /api/push/subscribe and POST /api/push/unsubscribe.
 *
 * Besides the routes, attach() wraps the server's own deliverPush() so that ONE place:
 *   - keeps the notification history and the unread count (and passes the count on as the app-icon badge),
 *   - applies the person's settings (all, calls, missed calls, messages, groups, suggestions, preview, quiet hours),
 *   - sends a device token only to the account that registered it most recently. If someone logs out and another person logs in on the
 *     same phone, the earlier account loses that device on the next push, so messages never reach the wrong person.
 * Nothing in this file throws into server.js: on any internal problem the original push is sent unchanged.
 */
const crypto = require("crypto");

const MAX_HISTORY = 200;
const DEDUPE_MS = 8000;
const BOOL_KEYS = ["all", "messages", "groups", "calls", "missedCalls", "friendRequests", "mentions", "reactions", "live", "gifts", "suggestions", "sound", "vibration", "preview", "chatHeads"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[a-f0-9]{16}$/;

function defaultPrefs() {
  const p = {};
  for (const k of BOOL_KEYS) p[k] = true;
  p.quietHours = { enabled: false, start: "22:00", end: "07:00", utcOffsetMinutes: 0, allowCalls: true };
  return p;
}

function prefsOf(user) {
  const base = defaultPrefs();
  const s = user && user.notifPrefs;
  if (!s || typeof s !== "object") return base;
  for (const k of BOOL_KEYS) if (typeof s[k] === "boolean") base[k] = s[k];
  const q = s.quietHours;
  if (q && typeof q === "object") {
    if (typeof q.enabled === "boolean") base.quietHours.enabled = q.enabled;
    if (HHMM.test(q.start)) base.quietHours.start = q.start;
    if (HHMM.test(q.end)) base.quietHours.end = q.end;
    if (Number.isInteger(q.utcOffsetMinutes) && Math.abs(q.utcOffsetMinutes) <= 840) base.quietHours.utcOffsetMinutes = q.utcOffsetMinutes;
    if (typeof q.allowCalls === "boolean") base.quietHours.allowCalls = q.allowCalls;
  }
  return base;
}

// takes only known keys with the right type; everything else is ignored
function mergePrefs(current, input) {
  const next = prefsOf({ notifPrefs: current });
  if (!input || typeof input !== "object") return { prefs: next, error: "Send a JSON object" };
  for (const k of BOOL_KEYS) {
    if (input[k] === undefined) continue;
    if (typeof input[k] !== "boolean") return { error: k + " must be true or false" };
    next[k] = input[k];
  }
  const q = input.quietHours;
  if (q !== undefined) {
    if (!q || typeof q !== "object") return { error: "quietHours must be an object" };
    if (q.enabled !== undefined) { if (typeof q.enabled !== "boolean") return { error: "quietHours.enabled must be true or false" }; next.quietHours.enabled = q.enabled; }
    if (q.start !== undefined) { if (!HHMM.test(q.start)) return { error: "quietHours.start must look like 22:00" }; next.quietHours.start = q.start; }
    if (q.end !== undefined) { if (!HHMM.test(q.end)) return { error: "quietHours.end must look like 07:00" }; next.quietHours.end = q.end; }
    if (q.utcOffsetMinutes !== undefined) {
      if (!Number.isInteger(q.utcOffsetMinutes) || Math.abs(q.utcOffsetMinutes) > 840) return { error: "quietHours.utcOffsetMinutes must be a whole number between -840 and 840" };
      next.quietHours.utcOffsetMinutes = q.utcOffsetMinutes;
    }
    if (q.allowCalls !== undefined) { if (typeof q.allowCalls !== "boolean") return { error: "quietHours.allowCalls must be true or false" }; next.quietHours.allowCalls = q.allowCalls; }
  }
  return { prefs: next };
}

function toMinutes(hhmm) { return parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3), 10); }
function inQuietHours(q, now) {
  if (!q || !q.enabled) return false;
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  const local = (((utc + q.utcOffsetMinutes) % 1440) + 1440) % 1440;
  const a = toMinutes(q.start), b = toMinutes(q.end);
  if (a === b) return false;
  return a < b ? local >= a && local < b : local >= a || local < b; // 22:00 to 07:00 crosses midnight
}

// what kind of alert is this? (only used for history and settings; unknown kinds are always allowed)
function classify(p) {
  const tag = String(p.tag || ""), text = String(p.title || "") + " " + String(p.body || "");
  if (p.type) return String(p.type).slice(0, 30);
  if (p.call) return "call";
  if (/missed (voice |video )?call/i.test(text)) return "missedCall";
  if (p.suggest) return "suggestion";
  if (p.ai) return "ai";
  if (/^(group|grp)-/i.test(tag) || p.group === true || p.isGroup === true) return "group";
  if (/friend request/i.test(text)) return "friendRequest";
  if (/mentioned you/i.test(text)) return "mention";
  if (/reacted/i.test(text)) return "reaction";
  if (tag.indexOf("conv-") === 0) return "message";
  return "other";
}

// the settings key that switches this kind off (null = no switch for it)
function switchFor(type) {
  switch (type) {
    case "message": return "messages";
    case "group": return "groups";
    case "call": return "calls";
    case "missedCall": return "missedCalls";
    case "suggestion": return "suggestions";
    case "friendRequest": return "friendRequests";
    case "mention": return "mentions";
    case "reaction": return "reactions";
    case "live": return "live";
    case "gift": return "gifts";
    default: return null;
  }
}

function unreadOf(user) { return (user.notifications || []).reduce((n, x) => n + (x.read ? 0 : 1), 0); }
function newId() { return crypto.randomBytes(8).toString("hex"); }
function deviceId(endpoint) { return crypto.createHash("sha1").update(String(endpoint)).digest("hex").slice(0, 12); }

function attach(ctx) {
  const { app, authMiddleware, readDB, writeDB, canPush } = ctx;
  if (!app || typeof authMiddleware !== "function" || typeof readDB !== "function" || typeof writeDB !== "function") throw new Error("missing app, authMiddleware, readDB or writeDB");
  const original = ctx.getDeliverPush();
  if (typeof original !== "function") throw new Error("deliverPush not found");

  const me = (req, db) => db.users.find((u) => u.id === req.user.id);

  // ---------- owner index: a device token belongs to the account that registered it last ----------
  let owner = { at: 0, map: new Map() };
  function ownerMap(db) {
    const now = Date.now();
    if (now - owner.at < 5000) return owner.map;
    const map = new Map();
    for (const u of db.users) for (const s of (u.pushSubs || [])) {
      if (!s || !s.endpoint) continue;
      const cur = map.get(s.endpoint);
      if (!cur || (s.time || 0) > cur.time) map.set(s.endpoint, { userId: u.id, time: s.time || 0 });
    }
    let dirty = false;
    for (const u of db.users) {
      if (!u.pushSubs) continue;
      const keep = u.pushSubs.filter((s) => { const o = s && map.get(s.endpoint); return !o || o.userId === u.id; });
      if (keep.length !== u.pushSubs.length) { u.pushSubs = keep; dirty = true; }
    }
    if (dirty) { try { writeDB(db); console.log("[notif] removed a device that was registered to more than one account (kept the newest)"); } catch (e) { /* best effort */ } }
    owner = { at: now, map };
    return map;
  }

  // ---------- history ----------
  function record(db, user, p, type) {
    const list = user.notifications || (user.notifications = []);
    const now = Date.now();
    const body = String(p.body || "").slice(0, 300), tag = String(p.tag || "");
    for (let i = list.length - 1; i >= 0 && now - list[i].time < DEDUPE_MS; i--) {
      if (list[i].tag === tag && list[i].body === body && list[i].type === type) return false; // same alert, another device of the same person
    }
    list.push({
      id: newId(), type, title: String(p.title || "Letschat Africa").slice(0, 120), body, tag,
      url: String(p.url || "./").slice(0, 300), image: /^https:\/\//i.test(String(p.image || "")) ? String(p.image).slice(0, 500) : "", time: now, read: false,
    });
    if (list.length > MAX_HISTORY) user.notifications = list.slice(-MAX_HISTORY);
    return true;
  }

  // ---------- the one place every push passes through ----------
  const wrapped = function deliverPushWithSettings(userId, sub, payload, options) {
    try {
      if (!payload || typeof payload !== "object") return original(userId, sub, payload, options);
      const db = readDB();
      const user = db.users.find((u) => u.id === userId);
      if (!user) return original(userId, sub, payload, options);

      const own = ownerMap(db).get(sub && sub.endpoint);
      if (own && own.userId !== userId) return Promise.resolve(false); // this device now belongs to someone else

      const p = Object.assign({}, payload);
      const type = classify(p);
      p.type = type;
      const prefs = prefsOf(user);
      if (!prefs.preview && type !== "call") p.body = "New message";
      if (record(db, user, p, type)) { try { writeDB(db); } catch (e) { /* best effort */ } }

      if (type === "test") { p.badge = unreadOf(user); return original(userId, sub, p, options); }
      if (!prefs.all) return Promise.resolve(false);
      const key = switchFor(type);
      if (key && prefs[key] === false) return Promise.resolve(false);
      if (inQuietHours(prefs.quietHours, new Date()) && !(type === "call" && prefs.quietHours.allowCalls)) return Promise.resolve(false);

      p.badge = unreadOf(user);
      if (!prefs.sound) p.silent = true;
      if (!prefs.vibration) p.noVibrate = true;
      return original(userId, sub, p, options);
    } catch (e) {
      console.warn("[notif] settings check skipped: " + (e && e.message));
      return original(userId, sub, payload, options);
    }
  };
  ctx.setDeliverPush(wrapped);

  // ---------- routes ----------
  app.get("/api/notifications/unread-count", authMiddleware, (req, res) => {
    const u = me(req, readDB());
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json({ count: unreadOf(u) });
  });

  app.get("/api/notifications/preferences", authMiddleware, (req, res) => {
    const u = me(req, readDB());
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json({ preferences: prefsOf(u) });
  });

  app.put("/api/notifications/preferences", authMiddleware, (req, res) => {
    const db = readDB();
    const u = me(req, db);
    if (!u) return res.status(404).json({ error: "User not found" });
    const r = mergePrefs(u.notifPrefs, req.body);
    if (r.error) return res.status(400).json({ error: r.error });
    u.notifPrefs = r.prefs;
    writeDB(db);
    res.json({ preferences: r.prefs });
  });

  app.get("/api/notifications", authMiddleware, (req, res) => {
    const u = me(req, readDB());
    if (!u) return res.status(404).json({ error: "User not found" });
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const before = Number(req.query.before) || Infinity;
    const onlyUnread = req.query.unread === "1" || req.query.unread === "true";
    const all = (u.notifications || []).filter((x) => x.time < before && (!onlyUnread || !x.read)).sort((a, b) => b.time - a.time);
    const items = all.slice(0, limit);
    res.json({ items, nextBefore: all.length > limit ? items[items.length - 1].time : null, unread: unreadOf(u) });
  });

  app.post("/api/notifications/read-all", authMiddleware, (req, res) => {
    const db = readDB();
    const u = me(req, db);
    if (!u) return res.status(404).json({ error: "User not found" });
    for (const x of (u.notifications || [])) x.read = true;
    writeDB(db);
    res.json({ ok: true, count: 0 });
  });

  app.post("/api/notifications/read", authMiddleware, (req, res) => {
    const id = req.body && req.body.id, tag = req.body && req.body.tag;
    if ((id !== undefined && typeof id !== "string") || (tag !== undefined && typeof tag !== "string") || (!id && !tag)) return res.status(400).json({ error: "Send an id or a tag" });
    if (id && !ID_RE.test(id)) return res.status(400).json({ error: "Invalid id" });
    const db = readDB();
    const u = me(req, db);
    if (!u) return res.status(404).json({ error: "User not found" });
    let changed = 0;
    for (const x of (u.notifications || [])) { if (!x.read && ((id && x.id === id) || (tag && x.tag === tag))) { x.read = true; changed++; } }
    if (changed) writeDB(db);
    res.json({ ok: true, changed, count: unreadOf(u) });
  });

  app.delete("/api/notifications/:id", authMiddleware, (req, res) => {
    if (!ID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    const db = readDB();
    const u = me(req, db);
    if (!u) return res.status(404).json({ error: "User not found" });
    const before = (u.notifications || []).length;
    u.notifications = (u.notifications || []).filter((x) => x.id !== req.params.id);
    if (u.notifications.length === before) return res.status(404).json({ error: "Notification not found" });
    writeDB(db);
    res.json({ ok: true, count: unreadOf(u) });
  });

  app.delete("/api/notifications", authMiddleware, (req, res) => {
    const db = readDB();
    const u = me(req, db);
    if (!u) return res.status(404).json({ error: "User not found" });
    u.notifications = [];
    writeDB(db);
    res.json({ ok: true, count: 0 });
  });

  app.post("/api/notifications/test", authMiddleware, (req, res) => {
    const db = readDB();
    const u = me(req, db);
    if (!u) return res.status(404).json({ error: "User not found" });
    const subs = (u.pushSubs || []).filter((s) => s && s.endpoint);
    if (!subs.length) return res.status(409).json({ error: "No device is registered for push yet. Open the app on your phone, allow notifications, then try again." });
    const payload = { title: "Letschat Africa", body: "Notifications are working on this device.", tag: "test", type: "test", url: "./" };
    Promise.all(subs.map((s) => Promise.resolve(wrapped(u.id, s, payload, { TTL: 60 })).then((ok) => !!ok, () => false))).then((results) => {
      const sent = results.filter(Boolean).length;
      res.json({ ok: sent > 0, sent, devices: subs.length });
    });
  });

  app.get("/api/push/status", authMiddleware, (req, res) => {
    const u = me(req, readDB());
    let firebase = false, webPush = false;
    try { firebase = !!canPush({ endpoint: "https://fcm-token.letschat.invalid/x" }); webPush = !!canPush({ endpoint: "https://example.invalid/x" }); } catch (e) { /* unknown */ }
    res.json({ firebase, webPush, devices: u ? (u.pushSubs || []).length : 0 });
  });

  app.get("/api/push/devices", authMiddleware, (req, res) => {
    const u = me(req, readDB());
    if (!u) return res.status(404).json({ error: "User not found" });
    const devices = (u.pushSubs || []).filter((s) => s && s.endpoint).map((s) => {
      const fcm = String(s.endpoint).indexOf("https://fcm-token.letschat.invalid/") === 0;
      let where = "";
      if (!fcm) { try { where = new URL(s.endpoint).hostname; } catch (e) { where = ""; } }
      return { id: deviceId(s.endpoint), kind: fcm ? "firebase" : "web", token: fcm ? "..." + String(s.endpoint).slice(-6) : where, preview: s.preview !== false, groups: s.groups !== false, registeredAt: s.time || null };
    });
    res.json({ devices });
  });

  app.delete("/api/push/devices/:id", authMiddleware, (req, res) => {
    const db = readDB();
    const u = me(req, db);
    if (!u) return res.status(404).json({ error: "User not found" });
    const before = (u.pushSubs || []).length;
    u.pushSubs = (u.pushSubs || []).filter((s) => !s || deviceId(s.endpoint) !== req.params.id);
    if (u.pushSubs.length === before) return res.status(404).json({ error: "Device not found" });
    writeDB(db);
    res.json({ ok: true, devices: u.pushSubs.length });
  });

  console.log("[notif] notification API ready (history, unread count, settings, devices, test)");
}

module.exports = { attach, prefsOf, mergePrefs, inQuietHours, classify, defaultPrefs };
