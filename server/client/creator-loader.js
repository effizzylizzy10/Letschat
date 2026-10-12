// Letschat Creator features, applied on top of server.js at startup (no change to server.js itself).
// If any anchor below is not found (e.g. server.js changed), nothing is patched and the server runs as before.
const fs = require("fs");
const path = require("path");
const Module = require("module");

const file = path.join(__dirname, "server.js");
const original = fs.readFileSync(file, "utf8");

const NEW_ROUTES = `
// ---- Letschat Creator: broadcast, rules (added by creator-loader.js) ----
const DEFAULT_RULES = "1. Be respectful to everyone.\\n2. No hate speech, harassment or threats.\\n3. No spam, scams or fake accounts.\\n4. No adult or violent content.\\n5. Only the creator may share YouTube links.\\nBreaking these rules can get your account blocked.";
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
  for (const u of db.users.slice(0, 5000)) {
    if (u.id === me.id || u.suspended || (u.blocked || []).includes(me.id)) continue;
    const convo = ensureDM(db, me.id, u.id);
    const live = userSockets.get(u.id);
    const message = { id: nanoid(14), conversationId: convo.id, senderId: me.id, text, time: Date.now(), read: false, broadcast: true, ...(live && live.size ? { delivered: true } : {}) };
    db.messages.push(message); convo.updatedAt = Date.now(); sent.push([convo, message]); n++;
  }
  writeDB(db);
  for (const [convo, message] of sent) {
    io.to("conv:" + convo.id).emit("message:new", stripViewOnce(message));
    try { pushMessage(db, convo, message, me.id); } catch (e) { /* push is best effort */ }
  }
  res.json({ sent: n });
});
`;

const YT = 'const YT_RE = /(?:youtube\\.com|youtu\\.be|youtube-nocookie\\.com)/i; // only the creator may share YouTube links\nconst YT_MSG = "Only the creator can share YouTube links";\n';

const patches = [
  // 1. members see the creator as "letschatafrica"
  ["    creator: isCreator(u),\n    name: u.name,", '    creator: isCreator(u),\n    name: isCreator(u) ? "letschatafrica" : u.name,'],
  ["verified: isVerified(u), name: u.name, initials: u.initials,", 'verified: isVerified(u), name: isCreator(u) ? "letschatafrica" : u.name, initials: isCreator(u) ? "LA" : u.initials,'],
  // 2. YouTube links are creator-only (chat, scheduled, edited, status)
  ["const isVerified = (u) =>", YT + "const isVerified = (u) =>"],
  ["    const db = readDB();\n    const convo = db.conversations.find((c) => c.id === conversationId);\n    if (!convo || !convo.participantIds.includes(userId)) {\n      if (ack)",
   "    const db = readDB();\n    if (YT_RE.test(String(text || \"\")) && !isCreator(db.users.find((u) => u.id === userId))) return fail(YT_MSG);\n    const convo = db.conversations.find((c) => c.id === conversationId);\n    if (!convo || !convo.participantIds.includes(userId)) {\n      if (ack)"],
  ['    if (!convo || !me || !convo.participantIds.includes(userId)) return fail("Conversation not found");',
   '    if (!convo || !me || !convo.participantIds.includes(userId)) return fail("Conversation not found");\n    if (YT_RE.test(t) && !isCreator(me)) return fail(YT_MSG);'],
  ['    if (!t) return fail("Message text required");',
   '    if (!t) return fail("Message text required");\n    if (YT_RE.test(t) && !isCreator(db.users.find((u) => u.id === userId))) return fail(YT_MSG);'],
  ['  if (!text && !photo) return res.status(400).json({ error: "Add some text or a photo" });',
   '  if (!text && !photo) return res.status(400).json({ error: "Add some text or a photo" });\n  if (YT_RE.test(text) && !isCreator(req.user)) return res.status(400).json({ error: YT_MSG });'],
  // 3. the creator's status posts are visible to every member
  ["function canSeeStatusItem(db, viewerId, s) { // contacts, plus anyone (or any group member) the post tags\n",
   "function canSeeStatusItem(db, viewerId, s) { // contacts, plus anyone (or any group member) the post tags\n  { const ow = db.users.find((u) => u.id === s.userId), vw = db.users.find((u) => u.id === viewerId); if (ow && vw && isCreator(ow) && !isBlockedEither(vw, ow)) return true; } // creator posts reach everyone\n"],
  // 4. new routes
  ["const AVATAR_RE = /^data:image", NEW_ROUTES + "\nconst AVATAR_RE = /^data:image"],
];

let src = original, ok = true;
for (const [from, to] of patches) {
  const first = src.indexOf(from);
  if (first < 0 || src.indexOf(from, first + 1) >= 0) { ok = false; console.error("creator-loader: anchor not found exactly once, running server.js unpatched:\n  " + from.slice(0, 80).replace(/\n/g, "\\n")); break; }
  src = src.slice(0, first) + to + src.slice(first + from.length);
}
if (ok) { try { new Function(src.replace(/^#!.*/, "").replace(/require\(/g, "(0,String)(")); } catch (e) { if (!(e instanceof ReferenceError)) { ok = false; console.error("creator-loader: patched code did not parse, running unpatched: " + e.message); } } }
if (ok) console.log("creator-loader: creator features enabled");

const m = new Module(file, module.parent);
m.filename = file;
m.paths = Module._nodeModulePaths(__dirname);
m._compile(ok ? src : original, file);
