/* Letschat native glue. Injected by the ChatBubble plugin into the Letschat website inside the Android app only.
   It does four things:
   1. starts the background service once a person is signed in (and stops it on sign-out),
   2. listens to the live chat connection and shows the message pop-up when a message arrives while the app is in the background
      (the floating chat head itself is put on screen by the native plugin as soon as the app is minimized or closed),
   3. asks, at most once a week each, for "display over other apps" (straight to Android's switch, no extra question) and "ignore battery optimisation",
   4. adds the "Floating chat bubble" switch to Settings > Notifications (the bubble shows the sender's photo, a red unread badge
      and, now, the WhatsApp-style message pop-up with the message, reply box, Close and View). On by default; the choice is kept in localStorage "letschat-native:bubble".
   The pop-up follows the same rules as the website's own alerts and the server's push alerts: no pop-up for "X joined the group" notices,
   muted chats, people you blocked, groups when "Group messages" is off, or the big Chat Room unless the message @mentions or replies to you;
   "Show message preview" off hides the message text. If anything needed for those rules cannot be read, the pop-up is shown (a pop-up too many beats a missed message). */
(function () {
  if (window.__lcNativeBridge) return;
  if (!/(^|\.)(letschat-taupe\.vercel\.app|letschatafric\.netlify\.app)$/.test(location.hostname)) return;
  var C = window.Capacitor;
  if (!C || !C.Plugins) return;
  var BG = C.Plugins.BackgroundService, BB = C.Plugins.ChatBubble, APP = C.Plugins.App;
  if (!BG && !BB) return;
  window.__lcNativeBridge = true;

  var SESSION_KEY = "letschat-africa:session";
  var NOTIFS_KEY = "letschat-africa:notifs";   // Settings > Notifications of the website (this device)
  var CONVS_KEY = "letschat-africa:convCache"; // the chat list the website saved last time
  var ASK_KEY = "letschat-native:asked:";
  var unread = 0, background = false, serviceOn = false;
  var BUBBLE_KEY = "letschat-native:bubble";
  function noop() {}

  function bubbleOn() { try { return localStorage.getItem(BUBBLE_KEY) !== "0"; } catch (e) { return true; } }
  function apiBase() { return String((window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.API_URL) || "").replace(/\/+$/, ""); }
  function photoUrl(p) { return p && String(p).charAt(0) === "/" ? apiBase() + p : (p || ""); }
  if (BB && BB.setEnabled) BB.setEnabled({ enabled: bubbleOn() }).catch(noop);

  function session() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } }
  function loggedIn() { var s = session(); return !!(s && s.token); }
  function myId() {
    var s = session();
    if (!s) return null;
    return (s.user && (s.user.id || s.user._id)) || s.userId || s.id || null;
  }
  function askedRecently(k) {
    try { return Date.now() - (+localStorage.getItem(ASK_KEY + k) || 0) < 7 * 864e5; } catch (e) { return false; }
  }
  function markAsked(k) { try { localStorage.setItem(ASK_KEY + k, String(Date.now())); } catch (e) {} }

  // Opens Android's "Display over other apps" screen right away (one switch to turn on, no question first).
  function offerOverlay() {
    if (!BB || !bubbleOn() || askedRecently("overlay")) return;
    BB.checkOverlayPermission().then(function (r) {
      if (r && r.granted) return;
      markAsked("overlay");
      BB.requestOverlayPermission().catch(noop);
    }).catch(noop);
  }
  function offerBattery() {
    if (!BG || askedRecently("battery")) return;
    BG.isIgnoringBatteryOptimizations().then(function (r) {
      if (r && r.ignoring) return;
      markAsked("battery");
      if (window.confirm("Keep Letschat connected when the app is closed? Android will ask you to allow it.")) BG.requestIgnoreBatteryOptimizations().catch(noop);
    }).catch(noop);
  }

  // Hands the sign-in to the native side so the chat head can pop up for new messages while the app is closed.
  var sentTok = null;
  function sendSession() {
    if (!BB || !BB.setSession) return;
    var s = session(), tok = s && s.token ? String(s.token) : "";
    var p = notifPrefs(), sig = tok + "|" + p.preview + "|" + p.groups; // sent again when "Show message preview" or "Group messages" is changed
    if (sig === sentTok) return;
    sentTok = sig;
    BB.setSession({ token: tok, apiUrl: apiBase(), userId: String(myId() || ""), preview: p.preview, groups: p.groups }).catch(function () { sentTok = null; });
  }

  function syncService() {
    sendSession();
    if (!BG) return;
    var li = loggedIn();
    if (li && !serviceOn) {
      serviceOn = true;
      BG.start({ title: "Letschat Africa", text: "Connected. Tap to open." }).then(function () {
        setTimeout(offerOverlay, 1500);
        setTimeout(offerBattery, 40000);
      }).catch(function () { serviceOn = false; });
    } else if (!li && serviceOn) {
      serviceOn = false;
      unread = 0;
      BG.stop().catch(noop);
      if (BB) BB.hide().catch(noop);
    }
  }
  setInterval(syncService, 5000);
  syncService();

  function field(o, names) {
    for (var i = 0; i < names.length; i++) if (o && o[names[i]] != null && o[names[i]] !== "") return o[names[i]];
    return null;
  }
  // ---- the rules (same as the website's own alerts and the server's push alerts) ----
  // "Settings > Notifications" of the website: both switches are on unless the person turned them off.
  function notifPrefs() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(NOTIFS_KEY)); } catch (e) {}
    return { preview: !(o && o.preview === false), groups: !(o && o.groups === false) };
  }
  // What the website's saved chat list says about a chat: group or not, the Chat Room or not, its name and photo, who the members are.
  function chatInfo(id) {
    try {
      var c = JSON.parse(localStorage.getItem(CONVS_KEY)), list = c && c.list;
      for (var i = 0; list && i < list.length; i++) {
        var x = list[i];
        if (!x || String(x.id) !== id) continue;
        var info = { group: !!x.isGroup, room: !!x.chatRoom, title: "", photo: "", names: {} };
        if (x.isGroup) {
          info.title = x.name || "";
          (x.members || []).forEach(function (u) { if (u && u.id) info.names[u.id] = u.name || ""; });
        } else if (x.other) {
          info.title = x.other.name || "";
          info.photo = x.other.avatar || "";
        }
        return info;
      }
    } catch (e) {}
    return { group: false, room: false, title: "", photo: "", names: {} };
  }
  // "mention" when the message @mentions me, "reply" when it replies to one of mine, else "".
  function addressedTo(m, me) {
    if (!me) return "";
    var men = m.mentions;
    if (men && men.length) for (var i = 0; i < men.length; i++) if (String(men[i]) === String(me)) return "mention";
    var rt = m.replyTo;
    return rt && typeof rt === "object" && rt.senderId && String(rt.senderId) === String(me) ? "reply" : "";
  }
  // Muted chats and blocked people are kept on the server (per account). Read at most once a minute; when that fails, nothing is hidden.
  var quiet = { at: 0, muted: {}, blocked: {}, waiting: null };
  function isQuiet(chat, sid) {
    var until = quiet.muted[chat];
    if (until !== undefined && (until === 0 || until > Date.now())) return true;
    return !!(sid && quiet.blocked[sid]);
  }
  function quietCheck(chat, sid, cb) {
    var s = session();
    if (!s || !s.token || typeof fetch !== "function") return cb(true);
    if (Date.now() - quiet.at < 60000) return cb(!isQuiet(chat, sid));
    var queued = function () { cb(!isQuiet(chat, sid)); };
    if (quiet.waiting) { quiet.waiting.push(queued); return; }
    quiet.waiting = [queued];
    var finish = function () {
      var w = quiet.waiting;
      if (!w) return;
      quiet.waiting = null;
      for (var i = 0; i < w.length; i++) { try { w[i](); } catch (e) {} }
    };
    setTimeout(finish, 4000); // a slow or hung request must never swallow messages
    try {
      fetch(apiBase() + "/api/v1/me/settings", { headers: { Authorization: "Bearer " + s.token } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var d = j && (j.data || j);
          if (!d) return;
          quiet.muted = d.muted || {};
          quiet.blocked = {};
          (d.blocked || []).forEach(function (u) { if (u && u.id) quiet.blocked[u.id] = 1; });
          quiet.at = Date.now();
        })
        .catch(noop)
        .then(finish);
    } catch (e) { finish(); }
  }

  function onEvent(name, m) {
    if (name !== "message:new" || !m || typeof m !== "object" || !background || !BB || !bubbleOn()) return;
    if (m.system) return; // "Amaka joined the group" and the like: the website gives no alert for these either
    var sender = field(m, ["sender", "from", "user"]);
    var sid = field(m, ["senderId", "sender_id", "fromId", "userId"]) || (sender && typeof sender === "object" ? field(sender, ["id", "_id"]) : sender);
    var me = myId();
    if (me && sid && String(sid) === String(me)) return; // my own message
    var chat = String(field(m, ["conversationId", "convoId", "convId", "chatId"]) || (m.conversation && field(m.conversation, ["id", "_id"])) || "");
    var info = chatInfo(chat), prefs = notifPrefs(), toMe = addressedTo(m, me);
    if (info.group && !prefs.groups) return; // "Group messages" is switched off
    if (info.room && !toMe) return;          // the big Chat Room: only messages that @mention or reply to me
    quietCheck(chat, sid ? String(sid) : "", function (ok) {
      if (!ok || !background) return; // a muted chat, a blocked person, or Letschat is back on screen already
      var photo = (sender && typeof sender === "object" ? field(sender, ["avatar", "photo", "picture", "image"]) : null) || field(m, ["senderAvatar", "avatar"]) || info.photo;
      if (!photo && sid && apiBase()) photo = "/api/v1/users/" + encodeURIComponent(String(sid)) + "/avatar";
      var title = field(m, ["senderName", "fromName"]) || (sender && typeof sender === "object" ? field(sender, ["name", "displayName", "username"]) : null) || info.title || "Letschat";
      var text = prefs.preview
        ? field(m, ["text", "body", "content", "caption"]) || (m.type && m.type !== "text" ? "[" + m.type + "]" : "New message")
        : (toMe === "mention" ? "Mentioned you" : toMe === "reply" ? "Replied to you" : "New message");
      var who = info.group && sid ? info.names[String(sid)] : "";
      if (who && title !== who) text = who + ": " + text; // in a group: who wrote it
      var rt = prefs.preview && m.replyTo && typeof m.replyTo === "object" ? m.replyTo : null;
      var replyName = rt ? (me && rt.senderId && String(rt.senderId) === String(me) ? "You" : (rt.name || "")) : "";
      unread++;
      BB.show({
        count: unread, title: String(title), text: String(text).slice(0, 500), chatId: String(chat), avatar: photoUrl(photo),
        messageId: m.id ? String(m.id) : "", replyName: String(replyName), replyText: rt && rt.text ? String(rt.text).slice(0, 140) : ""
      }).catch(noop);
    });
  }

  // The app keeps its Socket.IO connections in io.managers: attach to each one once.
  function hookSockets() {
    try {
      var io = window.io;
      if (!io || !io.managers) return;
      Object.keys(io.managers).forEach(function (k) {
        var nsps = io.managers[k] && io.managers[k].nsps;
        if (!nsps) return;
        Object.keys(nsps).forEach(function (n) {
          var s = nsps[n];
          if (!s || s.__lcHooked || !s.onAny) return;
          s.__lcHooked = true;
          s.onAny(onEvent);
        });
      });
    } catch (e) {}
  }
  setInterval(hookSockets, 2500);
  hookSockets();

  // ---- "Floating chat bubble" switch in Settings > Notifications ----
  // The page is a React app we do not edit, so the row is added next to "Show message preview" with the same look.
  function findRow() {
    try {
      var t = document.evaluate("//div[normalize-space(text())='Show message preview']", document, null, 9, null).singleNodeValue;
      var row = t && t.parentElement && t.parentElement.parentElement;
      return row && row.querySelector("button[role=switch]") ? row : null;
    } catch (e) { return null; }
  }
  function paintSwitch(btn, on) {
    btn.setAttribute("aria-checked", on ? "true" : "false");
    btn.style.background = on ? "#35D0BA" : "#2B3544";
    var knob = btn.querySelector("span");
    if (knob) knob.style.left = on ? "22px" : "3px";
  }
  function addSettingRow() {
    if (!BB || document.querySelector("[data-lc-bubble-row]")) return;
    var src = findRow();
    if (!src) return;
    var row = src.cloneNode(true);
    row.setAttribute("data-lc-bubble-row", "1");
    var box = row.firstElementChild;
    if (box && box.children.length > 1) {
      box.children[0].textContent = "Floating chat bubble";
      box.children[1].textContent = "Show the sender's photo and message in a bubble over other apps when a message arrives.";
    }
    var btn = row.querySelector("button[role=switch]");
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    paintSwitch(btn, bubbleOn());
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var on = !bubbleOn();
      try { localStorage.setItem(BUBBLE_KEY, on ? "1" : "0"); } catch (e) {}
      paintSwitch(btn, on);
      BB.setEnabled({ enabled: on }).catch(noop);
      if (!on) { unread = 0; BB.hide().catch(noop); return; }
      BB.checkOverlayPermission().then(function (r) {
        if (!r || !r.granted) BB.requestOverlayPermission().catch(noop); // opens Android's "Display over other apps" screen
      }).catch(noop);
    });
    src.parentNode.insertBefore(row, src.nextSibling);
  }
  var settingsTimer = null;
  try {
    new MutationObserver(function () {
      if (settingsTimer) return;
      settingsTimer = setTimeout(function () { settingsTimer = null; addSettingRow(); }, 300);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  addSettingRow();

  function setActive(active) {
    background = !active;
    if (active) {
      unread = 0;
      if (BB) BB.hide().catch(noop);
    }
  }
  try { if (APP && APP.addListener) APP.addListener("appStateChange", function (s) { setActive(!!(s && s.isActive)); }); } catch (e) {}
  try { if (BB && BB.addListener) {
    BB.addListener("appState", function (s) { setActive(!!(s && s.active)); });
    // "View" in the message pop-up: open that chat (the app reads ?open=<conversation id> after the page loads)
    BB.addListener("bubbleTapped", function (d) {
      unread = 0;
      var id = d && d.chatId ? String(d.chatId) : "";
      if (id) { try { location.assign(location.origin + "/?open=" + encodeURIComponent(id)); } catch (e) {} }
    });
  } } catch (e) {}
  document.addEventListener("visibilitychange", function () { if (!document.hidden) setActive(true); });
})();
