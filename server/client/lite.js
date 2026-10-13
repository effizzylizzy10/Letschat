// Letschat Lite: plain HTML pages for browsers that cannot run JavaScript
// (Opera Mini extreme / mini mode, basic keypad phones, UC mini, any "no script" browser).
// Mounted at /lite by server.js. Only forms and links: no scripts, no images, no web fonts, a few hundred bytes of CSS.
//
//   /lite              chat list (or the sign-in page)
//   /lite/c/:id        one chat: write box on top, newest messages first
//   /lite/new          start a chat with a username, phone number or email
//   Sign-in is email + password, checked with Firebase's sign-in service by the server.
//   Phone-number-only accounts have no password, so they must sign in once in the full app and set an email login there.

const FIREBASE_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyBclbDUzqSszcj205NKxczMCNJ2qPi6Q3g"; // same public web key as client/config.js
const SITE = process.env.LITE_REFERER || "https://letschatafric.netlify.app/"; // sent so a "website restricted" Firebase key still accepts the server
const COOKIE = "lc_lite";
const PAGE = 25;          // messages per page
const LIST_MAX = 40;      // chats shown on the list

module.exports = function mountLite(d) {
  const { express, admin, readDB, writeDB, nanoid, rateLimit, publicUser, firebaseSignIn, handleSend, findByContact, joinUserToRoom, announceRead, NOT_FOUND_MSG, verifyToken } = d;
  const app = d.getApp();
  const router = express.Router();

  // ---------- small helpers ----------
  const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const nl = (t) => esc(t).replace(/\r?\n/g, "<br>");
  const clip = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
  function ago(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return "now";
    if (s < 3600) return Math.round(s / 60) + "m";
    if (s < 86400) return Math.round(s / 3600) + "h";
    return Math.round(s / 86400) + "d";
  }
  function cookies(req) {
    const out = {};
    String(req.headers.cookie || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
    return out;
  }
  function setCookie(req, res, value, maxAge) {
    const secure = req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0] === "https";
    res.setHeader("Set-Cookie", COOKIE + "=" + encodeURIComponent(value) + "; Path=/lite; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + (secure ? "; Secure" : ""));
  }
  const CSS = "body{font:15px/1.35 Arial,Helvetica,sans-serif;margin:0;padding:6px;background:#fff;color:#111}" +
    "a{color:#00695c}h1,h2{font-size:17px;margin:2px 0 6px}h1{font-size:18px}" +
    ".bar{border-bottom:2px solid #00695c;padding-bottom:5px;margin-bottom:6px}.bar a,.bar button{margin-right:8px}" +
    ".row{border-bottom:1px solid #ccc;padding:5px 0}.me{background:#e8f5f2;padding:5px 4px}.msg{border-bottom:1px solid #ccc;padding:5px 0;word-wrap:break-word}" +
    ".s{color:#555;font-size:12px}.err{background:#fde8e8;border:1px solid #c33;padding:4px;margin:4px 0}.ok{background:#e8f5f2;border:1px solid #00695c;padding:4px;margin:4px 0}" +
    "input,textarea{width:96%;font:15px Arial,sans-serif;margin:2px 0 6px;padding:3px;box-sizing:border-box}input[type=submit],button{width:auto;padding:4px 10px}" +
    "button.l{background:none;border:0;color:#00695c;text-decoration:underline;padding:0;font:inherit}";

  function page(res, title, inner, extraHead) {
    res.status(200);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + " - Letschat Lite</title><style>" + CSS + "</style>" + (extraHead || "") + "</head><body>" + inner + "</body></html>");
  }
  const bar = (right) => '<div class="bar"><b>Letschat Lite</b> ' + (right || "") + "</div>";
  const navBar = () => bar('<a href="/lite">Chats</a><a href="/lite/new">New chat</a><form method="post" action="/lite/logout" style="display:inline"><button class="l" type="submit">Log out</button></form>');
  const notice = (q) => (q.err ? '<div class="err">' + esc(clip(q.err, 160)) + "</div>" : q.ok ? '<div class="ok">' + esc(clip(q.ok, 160)) + "</div>" : "");
  const back = (res, to, kind, msg) => res.redirect(303, to + (to.indexOf("?") >= 0 ? "&" : "?") + kind + "=" + encodeURIComponent(msg));

  // ---------- who is asking ----------
  function me(req) { const t = cookies(req)[COOKIE]; return t ? verifyToken(t) : null; }
  function needLogin(req, res, next) {
    const u = me(req);
    if (!u) return res.redirect(303, "/lite");
    req.user = u;
    next();
  }

  router.use(express.urlencoded({ extended: false, limit: "64kb" }));

  // ---------- sign in / sign up (email + password through Firebase's REST service) ----------
  const FRIENDLY = {
    EMAIL_NOT_FOUND: "No account with that email. Use Create account below.", INVALID_PASSWORD: "Wrong email or password.", INVALID_LOGIN_CREDENTIALS: "Wrong email or password.",
    USER_DISABLED: "This account has been disabled.", TOO_MANY_ATTEMPTS_TRY_LATER: "Too many tries. Wait a few minutes and try again.",
    EMAIL_EXISTS: "That email already has an account. Sign in instead.", WEAK_PASSWORD: "Password is too short (use 6 or more characters).", INVALID_EMAIL: "That email does not look right.",
    OPERATION_NOT_ALLOWED: "Email sign-in is switched off for this app.",
  };
  async function firebaseRest(kind, email, password) {
    const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:" + kind + "?key=" + encodeURIComponent(FIREBASE_KEY), {
      method: "POST", headers: { "Content-Type": "application/json", Referer: SITE },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.idToken) {
      const code = String((j.error && j.error.message) || "").split(" ")[0];
      const e = new Error(FRIENDLY[code] || "Could not sign in. Please try again."); e.code = code; throw e;
    }
    return j.idToken;
  }
  async function auth(kind, req, res) {
    const email = String(req.body.email || "").trim().toLowerCase().slice(0, 200);
    const password = String(req.body.password || "").slice(0, 200);
    const name = String(req.body.name || "").trim().slice(0, 60);
    const fail = (m, tab) => back(res, "/lite", "err", m);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(FRIENDLY.INVALID_EMAIL);
    if (!password) return fail("Enter your password.");
    if (kind === "signUp" && !name) return fail("Enter your name.");
    try {
      const idToken = await firebaseRest(kind, email, password);
      const decoded = await admin.auth().verifyIdToken(idToken);
      const out = firebaseSignIn(decoded, name);
      if (out.status !== 200) return fail(out.body.newUser ? "Enter your name to create the account." : out.body.error || "Could not sign in.");
      setCookie(req, res, out.body.token, 60 * 60 * 24 * 90);
      res.redirect(303, "/lite");
    } catch (e) {
      console.warn("lite " + kind + " failed:", e.code || e.message);
      fail(e.code ? e.message : "Could not sign in. Please try again.");
    }
  }
  const authLimit = rateLimit({ windowMs: 60000, max: 12 });
  router.post("/login", authLimit, (req, res) => auth("signInWithPassword", req, res));
  router.post("/register", authLimit, (req, res) => auth("signUp", req, res));
  router.post("/logout", (req, res) => { setCookie(req, res, "", 0); res.redirect(303, "/lite"); });

  function loginPage(req, res) {
    page(res, "Sign in", bar() + notice(req.query) +
      "<h2>Sign in</h2>" +
      '<form method="post" action="/lite/login">Email<br><input type="email" name="email" autocomplete="email">Password<br><input type="password" name="password" autocomplete="current-password"><input type="submit" value="Sign in"></form>' +
      "<h2>Create account</h2>" +
      '<form method="post" action="/lite/register">Your name<br><input name="name" maxlength="60">Email<br><input type="email" name="email">Password (6+ characters)<br><input type="password" name="password"><input type="submit" value="Create account"></form>' +
      '<p class="s">This is the simple version of Letschat. Photos, calls, voice notes and games need the full app. Signed up by phone number only? Add an email login in the full app first.</p><p class="s"><a href="' + SITE + '?full=1">Open the full app</a></p>');
  }

  // ---------- chat list ----------
  function convoName(db, c, uid) {
    if (c.isGroup) return c.name || "Group";
    const other = db.users.find((u) => u.id === c.participantIds.find((id) => id !== uid));
    return other ? publicUser(other).name : "Unknown";
  }
  function preview(db, m, uid) {
    if (!m) return "No messages yet";
    if (m.deleted) return "(deleted message)";
    const who = m.senderId === uid ? "You: " : "";
    const t = m.audio ? "[Voice note]" : m.file ? (String(m.file.mime || "").indexOf("image/") === 0 ? "[Photo]" : "[File]") : m.poll ? "[Poll] " + m.poll.question : m.text;
    return who + clip(t, 60);
  }
  router.get("/", (req, res) => {
    const u = me(req);
    if (!u) return loginPage(req, res);
    const db = readDB();
    const rows = db.conversations.filter((c) => c.participantIds.includes(u.id));
    const last = new Map(), unread = new Map();
    const mine = new Set(rows.map((c) => c.id));
    for (const m of db.messages) {
      if (!mine.has(m.conversationId)) continue;
      last.set(m.conversationId, m);
      if (m.senderId !== u.id && !m.deleted && (rows.find((c) => c.id === m.conversationId).isGroup ? !(m.readBy || []).includes(u.id) : !m.read)) unread.set(m.conversationId, (unread.get(m.conversationId) || 0) + 1);
    }
    rows.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    const list = rows.slice(0, LIST_MAX).map((c) => {
      const n = unread.get(c.id) || 0, m = last.get(c.id);
      return '<div class="row"><a href="/lite/c/' + esc(c.id) + '"><b>' + esc(clip(convoName(db, c, u.id), 40)) + "</b></a>" + (n ? " <b>(" + n + " new)</b>" : "") +
        (m ? ' <span class="s">' + ago(m.time) + "</span>" : "") + '<br><span class="s">' + esc(preview(db, m, u.id)) + "</span></div>";
    }).join("");
    page(res, "Chats", navBar() + notice(req.query) + "<h2>Chats</h2>" + (list || "<p>No chats yet. Use New chat to start one.</p>") + (rows.length > LIST_MAX ? '<p class="s">Showing the latest ' + LIST_MAX + " chats.</p>" : ""));
  });

  // ---------- one chat: write box first, then newest messages first ----------
  router.get("/c/:id", needLogin, (req, res) => {
    const db = readDB();
    const c = db.conversations.find((x) => x.id === req.params.id);
    if (!c || !c.participantIds.includes(req.user.id)) return back(res, "/lite", "err", "Chat not found.");
    const uid = req.user.id;
    // mark what you are reading as read (same as opening the chat in the app)
    const newlyRead = []; let changed = false;
    for (const m of db.messages) {
      if (m.conversationId !== c.id || m.senderId === uid) continue;
      if (c.isGroup) { if (!(m.readBy || (m.readBy = [])).includes(uid)) { m.readBy.push(uid); (m.readTimes || (m.readTimes = {}))[uid] = Date.now(); changed = true; newlyRead.push(m.id); } }
      else if (!m.read) { m.read = true; m.readAt = Date.now(); changed = true; newlyRead.push(m.id); }
    }
    if (changed) { writeDB(db); try { announceRead(db, c, uid, newlyRead); } catch (e) {} }
    const before = Number(req.query.before) || Infinity;
    const all = db.messages.filter((m) => m.conversationId === c.id && m.time < before);
    const page_ = all.slice(-PAGE).reverse(); // newest first
    const msgs = page_.map((m) => {
      const mineMsg = m.senderId === uid;
      const su = db.users.find((x) => x.id === m.senderId);
      const who = mineMsg ? "You" : su ? publicUser(su).name : "Former member";
      let body;
      if (m.deleted) body = "<i>(message deleted)</i>";
      else if (m.audio) body = "<i>[Voice note: open the full app to listen]</i>";
      else if (m.file) body = "<i>[" + (String(m.file.mime || "").indexOf("image/") === 0 ? "Photo" : "File: " + esc(clip(m.file.name, 40))) + "]</i>" + (m.text && m.text.charAt(0) !== "📷" && m.text.charAt(0) !== "📎" ? "<br>" + nl(m.text) : "");
      else if (m.poll) body = "<i>[Poll]</i> " + nl(m.poll.question);
      else body = nl(m.text);
      const quote = m.replyTo && !m.deleted ? '<div class="s">&gt; ' + esc(clip(m.replyTo.name, 20)) + ": " + esc(clip(m.replyTo.text, 60)) + "</div>" : "";
      return '<div class="' + (mineMsg ? "msg me" : "msg") + '"><b>' + esc(clip(who, 30)) + '</b> <span class="s">' + ago(m.time) + "</span>" + quote + "<br>" + body + "</div>";
    }).join("");
    const older = all.length > PAGE && page_.length ? '<p><a href="/lite/c/' + esc(c.id) + "?before=" + page_[page_.length - 1].time + '">Older messages</a></p>' : "";
    const auto = req.query.auto === "1";
    const self = "/lite/c/" + esc(c.id);
    const head = auto && !req.query.before ? '<meta http-equiv="refresh" content="25;url=' + self + '?auto=1">' : "";
    page(res, convoName(db, c, uid),
      navBar() + "<h1>" + esc(clip(convoName(db, c, uid), 40)) + "</h1>" + notice(req.query) +
      '<form method="post" action="' + self + '/send"><textarea name="text" rows="3" maxlength="4000"></textarea><input type="submit" value="Send"></form>' +
      '<p class="s"><a href="' + self + '">Refresh</a> | ' + (auto ? '<a href="' + self + '">Auto-refresh is ON (every 25s): turn off</a>' : '<a href="' + self + '?auto=1">Turn on auto-refresh</a>') + "</p>" +
      (msgs || "<p>No messages yet. Say hello.</p>") + older, head);
  });

  router.post("/c/:id/send", needLogin, rateLimit({ windowMs: 60000, max: 60 }), (req, res) => {
    const id = req.params.id, to = "/lite/c/" + encodeURIComponent(id);
    const text = String(req.body.text || "").replace(/\r\n/g, "\n").trim();
    if (!text) return back(res, to, "err", "Type a message first.");
    handleSend(req.user.id, { conversationId: id, text: text.slice(0, 4000) }, (r) => {
      if (r && r.error) return back(res, to, "err", r.error);
      res.redirect(303, to);
    });
  });

  // ---------- start a chat ----------
  router.get("/new", needLogin, (req, res) => {
    page(res, "New chat", navBar() + notice(req.query) + "<h2>New chat</h2>" +
      '<form method="post" action="/lite/new">Username, phone number (with country code) or email of the person<br><input name="q" maxlength="120"><input type="submit" value="Open chat"></form>');
  });
  router.post("/new", needLogin, rateLimit({ windowMs: 60000, max: 20 }), (req, res) => {
    const db = readDB();
    const q = String(req.body.q || "").trim();
    if (!q) return back(res, "/lite/new", "err", "Enter who you want to chat with.");
    const other = findByContact(db, q);
    if (!other) return back(res, "/lite/new", "err", NOT_FOUND_MSG);
    if (other.id === req.user.id) return back(res, "/lite/new", "err", "That's you.");
    let convo = db.conversations.find((c) => !c.isGroup && c.participantIds.includes(req.user.id) && c.participantIds.includes(other.id));
    if (!convo) {
      convo = { id: nanoid(12), participantIds: [req.user.id, other.id], createdAt: Date.now(), updatedAt: Date.now() };
      db.conversations.push(convo);
      writeDB(db);
      try { joinUserToRoom(other.id, "conv:" + convo.id); } catch (e) {}
    }
    res.redirect(303, "/lite/c/" + encodeURIComponent(convo.id));
  });

  app.use("/lite", router);
};
