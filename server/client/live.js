// Letschat Live: live video, live meetings with a join code, live comments, gifts, stickers, emoji, message reactions, replies and @mentions.
// Plain Node, no new dependencies. Rooms live in memory (a live ends when its host leaves), nothing is written to the database.
//
// Video is peer-to-peer (WebRTC) through the signalling below. That keeps the server free and light, but every sender
// uploads one copy per viewer, so the number of people who can WATCH WITH VIDEO is capped (see LIMITS). Everyone else
// beyond the cap still joins: they see the live chat, gifts, stickers and the viewer count. To go bigger later, swap the
// "live:signal" relay for a media server (LiveKit / mediasoup); the rest of this file stays the same.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I so codes are easy to read out
const LIMITS = { meeting: 6, liveVideoViewers: 8, chatKeep: 80, textMax: 300, titleMax: 60 };
const GIFTS = ["rose", "car", "crown", "bear", "star", "diamond", "heart", "rocket"];
const STICKERS = ["fire", "100", "heart", "laugh", "crown", "wow", "panda", "clap", "love", "rocket", "gg"];
const EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F621}", "\u{1F525}", "\u{1F4AF}", "\u{1F44F}", "\u{1F389}", "\u{1F60D}", "\u{1F64C}"];

module.exports = function setupLive(ctx) {
  const { io, readDB, memberView, nanoid, isCreator } = ctx;
  const notifiedAt = new Map(); // hostId -> when their chats were last told (one alert per 10 minutes at most)
  const rooms = new Map();      // code -> room
  const userRoom = new Map();   // userId -> code
  const lastAct = new Map();    // `${userId}:${kind}` -> timestamp (simple flood guard)

  const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, n);
  const throttle = (uid, kind, ms) => { const k = uid + ":" + kind, now = Date.now(); if (now - (lastAct.get(k) || 0) < ms) return false; lastAct.set(k, now); return true; };
  const newCode = () => { for (let i = 0; i < 50; i++) { let c = ""; for (let j = 0; j < 6; j++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; if (!rooms.has(c)) return c; } return nanoid(6).toUpperCase(); };
  const view = (id) => memberView(readDB().users.find((u) => u.id === id));
  const emitRoom = (room, ev, payload, exceptId) => { for (const id of room.members.keys()) if (id !== exceptId) io.to("user:" + id).emit(ev, payload); };
  const count = (room) => room.members.size;
  const publicRoom = (room) => ({ code: room.code, kind: room.kind, title: room.title, video: room.video, host: view(room.host), viewers: count(room), started: room.started, gifts: room.giftCount });
  const tellCount = (room) => emitRoom(room, "live:count", { code: room.code, viewers: count(room), gifts: room.giftCount });

  // Everyone who shares a chat with the host (people and groups; not the all-users Chat Room) is told when a live starts.
  function tellChatMembers(room) {
    try {
      const now = Date.now();
      if (now - (notifiedAt.get(room.host) || 0) < 10 * 60 * 1000) return;
      notifiedAt.set(room.host, now);
      const db = readDB(), host = db.users.find((u) => u.id === room.host);
      if (!host) return;
      const hostView = memberView(host), payload = { code: room.code, title: room.title, host: hostView };
      const shared = new Map(); // userId -> [conversation ids shared with the host]
      for (const c of db.conversations) {
        if (c.chatRoom || !(c.participantIds || []).includes(room.host)) continue;
        for (const pid of c.participantIds) if (pid !== room.host) { if (!shared.has(pid)) shared.set(pid, []); shared.get(pid).push(c.id); }
      }
      for (const [pid, convIds] of shared) {
        const u = db.users.find((x) => x.id === pid);
        if (!u || (u.blocked || []).includes(room.host) || (host.blocked || []).includes(pid)) continue;
        const muted = ctx.mutedOf ? ctx.mutedOf(db, u) : {};
        if (convIds.every((id) => muted[id] !== undefined)) continue; // they muted every chat they share with the host
        io.to("user:" + pid).emit("live:started", payload);
        if (ctx.pushLive && !(ctx.userIsActive && ctx.userIsActive(pid))) ctx.pushLive(pid, hostView, room.title, "live-" + room.code);
      }
    } catch (e) { console.error("live notify failed", e.message); }
  }
  function dropFromRoom(userId, code, reason) {
    const room = rooms.get(code || userRoom.get(userId));
    if (!room || !room.members.has(userId)) return;
    room.members.delete(userId);
    if (room.sharing && room.sharing.delete(userId)) emitRoom(room, "live:share", { code: room.code, userId, on: false });
    if (userRoom.get(userId) === room.code) userRoom.delete(userId);
    if (room.kind === "live" && userId === room.host) return endRoom(room, "The host ended the live");
    if (room.kind === "meeting" && userId === room.host && room.members.size) room.host = [...room.members.keys()][0]; // meeting carries on with the next person as host
    if (!room.members.size) { rooms.delete(room.code); return; }
    emitRoom(room, "live:left", { code: room.code, userId, host: room.host });
    tellCount(room);
  }
  function endRoom(room, reason) {
    for (const id of room.members.keys()) { io.to("user:" + id).emit("live:ended", { code: room.code, reason: reason || "This live has ended" }); if (userRoom.get(id) === room.code) userRoom.delete(id); }
    rooms.delete(room.code);
  }

  return {
    // called once per socket connection from server.js
    attach(socket) {
      const userId = socket.userId;
      const ack = (cb, v) => { if (typeof cb === "function") cb(v); };

      socket.on("live:list", (cb) => ack(cb, { lives: [...rooms.values()].filter((r) => r.kind === "live").sort((a, b) => count(b) - count(a)).slice(0, 50).map(publicRoom) }));

      socket.on("live:start", ({ title, kind, video } = {}, cb) => {
        const me = readDB().users.find((u) => u.id === userId);
        if (!me) return ack(cb, { error: "Sign in again" });
        if (userRoom.has(userId)) return ack(cb, { error: "You are already in a live. Leave it first.", code: userRoom.get(userId) });
        const k = kind === "meeting" ? "meeting" : "live";
        const room = { code: newCode(), kind: k, title: clean(title, LIMITS.titleMax) || (k === "meeting" ? "Live Meeting" : "Live now"), video: video !== false, host: userId, started: Date.now(), members: new Map([[userId, { at: Date.now(), media: true }]]), chat: [], banned: new Set(), giftCount: 0, sharing: new Set() };
        rooms.set(room.code, room); userRoom.set(userId, room.code);
        ack(cb, { code: room.code, kind: k, title: room.title, host: view(userId) });
        if (k === "live") tellChatMembers(room);
      });

      socket.on("live:join", ({ code, manual } = {}, cb) => {
        code = clean(code, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
        const room = rooms.get(code);
        if (!room) return ack(cb, { error: "No live found for that code. Check it and try again." });
        if (manual && room.kind === "live") return ack(cb, { error: "Codes are for Live Meetings. To watch a live, pick it from the list." });
        if (room.banned.has(userId)) return ack(cb, { error: "The host removed you from this live" });
        if (userRoom.has(userId) && userRoom.get(userId) !== code) return ack(cb, { error: "You are already in another live. Leave it first." });
        if (room.members.has(userId) && userId !== room.host) dropFromRoom(userId, code); // reconnecting: clear the old seat first (the host keeps the room open)
        if (!rooms.has(code)) return ack(cb, { error: "This live has ended" });
        let media = true;
        if (room.kind === "meeting") { if ([...room.members.values()].filter((m) => m.media).length >= LIMITS.meeting) return ack(cb, { error: "This meeting is full (" + LIMITS.meeting + " people at most)" }); }
        else { const watchers = [...room.members.entries()].filter(([id, m]) => id !== room.host && m.media).length; media = watchers < LIMITS.liveVideoViewers; }
        const me = view(userId); if (!me) return ack(cb, { error: "Sign in again" });
        const peers = room.kind === "meeting" ? [...room.members.keys()].filter((id) => room.members.get(id).media).map(view).filter(Boolean) : [view(room.host)];
        room.members.set(userId, { at: Date.now(), media });
        userRoom.set(userId, code);
        emitRoom(room, "live:joined", { code, user: me, media }, userId);
        tellCount(room);
        ack(cb, { code, kind: room.kind, title: room.title, video: room.video, host: view(room.host), hostId: room.host, media, peers, viewers: count(room), gifts: room.giftCount, sharing: [...room.sharing], chat: room.chat.slice(-30), started: room.started, isHost: userId === room.host });
      });

      socket.on("live:leave", ({ code } = {}) => dropFromRoom(userId, clean(code, 8).toUpperCase()));

      socket.on("live:end", ({ code } = {}) => { // the host, or the creator account as moderator
        const room = rooms.get(clean(code, 8).toUpperCase());
        if (!room) return;
        const me = readDB().users.find((u) => u.id === userId);
        if (userId === room.host) return endRoom(room, "The host ended the live");
        if (isCreator && isCreator(me)) endRoom(room, "This live was ended by Letschat Africa");
      });

      socket.on("live:kick", ({ code, userId: target } = {}) => {
        const room = rooms.get(clean(code, 8).toUpperCase());
        const me = readDB().users.find((u) => u.id === userId);
        if (!room || !target || target === room.host || !room.members.has(target)) return;
        if (userId !== room.host && !(isCreator && isCreator(me))) return;
        room.banned.add(target);
        io.to("user:" + target).emit("live:ended", { code: room.code, reason: "The host removed you from this live" });
        dropFromRoom(target, room.code);
      });

      // WebRTC offers, answers and ICE candidates go from one person to one person inside the same room
      socket.on("live:signal", ({ code, to, data } = {}) => {
        const room = rooms.get(clean(code, 8).toUpperCase());
        if (!room || !room.members.has(userId) || !room.members.has(to) || !data || typeof data !== "object") return;
        if (JSON.stringify(data).length > 20000) return;
        io.to("user:" + to).emit("live:signal", { code: room.code, from: userId, data });
      });

      // screen sharing: only the host of a live, or anyone in a meeting; everybody else is told so the picture is shown whole
      socket.on("live:share", ({ code, on } = {}) => {
        const room = rooms.get(clean(code, 8).toUpperCase());
        if (!room || !room.members.has(userId) || !(room.kind === "meeting" || userId === room.host)) return;
        if (on) room.sharing.add(userId); else room.sharing.delete(userId);
        emitRoom(room, "live:share", { code: room.code, userId, on: !!on }, userId);
      });

      // comments, with optional reply-to and @mentions
      socket.on("live:chat", ({ code, text, replyTo, mentions } = {}, cb) => {
        const room = rooms.get(clean(code, 8).toUpperCase());
        if (!room || !room.members.has(userId)) return ack(cb, { error: "Join the live first" });
        const t = clean(text, LIMITS.textMax);
        if (!t) return;
        if (!throttle(userId, "chat", 350)) return ack(cb, { error: "Slow down a little" });
        const me = view(userId);
        const ment = (Array.isArray(mentions) ? mentions : []).filter((id) => typeof id === "string" && room.members.has(id)).slice(0, 5);
        let reply = null;
        if (replyTo && replyTo.id) { const orig = room.chat.find((m) => m.id === replyTo.id); if (orig) reply = { id: orig.id, name: orig.user.name, text: orig.text ? orig.text.slice(0, 60) : (orig.gift ? "a gift" : "") }; }
        const msg = { id: nanoid(8), at: Date.now(), user: { id: me.id, name: me.name, initials: me.initials, color: me.color, avatar: me.avatar, verified: me.verified }, text: t, reply, mentions: ment, reactions: {} };
        room.chat.push(msg); if (room.chat.length > LIMITS.chatKeep) room.chat.shift();
        emitRoom(room, "live:chat", { code: room.code, msg });
        for (const id of ment) if (id !== userId) io.to("user:" + id).emit("live:mention", { code: room.code, from: me.name, text: t.slice(0, 80), title: room.title });
        ack(cb, { ok: true, id: msg.id });
      });

      // react to one comment (one emoji per person, tap the same one again to remove it)
      socket.on("live:msgreact", ({ code, msgId, emoji } = {}) => {
        const room = rooms.get(clean(code, 8).toUpperCase());
        if (!room || !room.members.has(userId) || !EMOJIS.includes(emoji) || !throttle(userId, "mr", 150)) return;
        const m = room.chat.find((x) => x.id === msgId); if (!m) return;
        if (m.reactions[userId] === emoji) delete m.reactions[userId]; else m.reactions[userId] = emoji;
        emitRoom(room, "live:msgreact", { code: room.code, msgId, reactions: m.reactions });
      });

      // floating emoji, live stickers and gifts
      socket.on("live:fx", ({ code, kind, value } = {}, cb) => {
        const room = rooms.get(clean(code, 8).toUpperCase());
        if (!room || !room.members.has(userId)) return;
        const ok = kind === "emoji" ? EMOJIS.includes(value) : kind === "sticker" ? STICKERS.includes(value) : kind === "gift" ? GIFTS.includes(value) : false;
        if (!ok) return ack(cb, { error: "That one is not available" });
        if (!throttle(userId, "fx", kind === "gift" ? 700 : 180)) return ack(cb, { error: "Slow down a little" });
        const me = view(userId);
        const user = { id: me.id, name: me.name, initials: me.initials, color: me.color, avatar: me.avatar };
        if (kind === "gift") {
          room.giftCount++;
          const msg = { id: nanoid(8), at: Date.now(), user: Object.assign({ verified: me.verified }, user), text: "", gift: value, reactions: {} };
          room.chat.push(msg); if (room.chat.length > LIMITS.chatKeep) room.chat.shift();
          emitRoom(room, "live:chat", { code: room.code, msg });
        }
        emitRoom(room, "live:fx", { code: room.code, kind, value, user });
        if (kind === "gift") tellCount(room);
        ack(cb, { ok: true });
      });

      socket.on("disconnect", () => {
        // only drop the seat when this was the user's last connection (a quick reconnect keeps the live)
        setTimeout(() => { try { if (!(ctx.userSockets && ctx.userSockets.has(userId))) dropFromRoom(userId); } catch (e) {} }, 8000);
      });
    },
    stats: () => ({ rooms: rooms.size }),
    LIMITS, GIFTS, STICKERS, EMOJIS,
  };
};
