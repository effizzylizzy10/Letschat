/* Letschat native glue. Injected by the ChatBubble plugin into the Letschat website inside the Android app only.
   It does eight things:
   1. starts the background service once a person is signed in (and stops it on sign-out),
   2. listens to the live chat connection and shows the message pop-up when a message arrives while the app is in the background
      (the floating chat head itself is put on screen by the native plugin as soon as the app is minimized or closed),
   3. ONE TIME after the first sign-in: "Allow permissions" set-up. One question, then Android's allow dialogs for camera, microphone,
      contacts, notifications, location, photos/files and nearby devices come one after another, then "display over other apps" and
      "ignore battery optimisation", and at the end (only if something is still off) the phone's own app-permission settings page for Letschat.
      After that it never asks again as a set-up; the weekly reminders below only remain as a safety net for the two special switches.
      People who finished the set-up before contacts was added are asked for contacts once, on their next sign-in (offerContacts),
   4. asks, at most once a week each, for "display over other apps" (straight to Android's switch, no extra question) and "ignore battery optimisation",
      and on Tecno / Infinix / itel phones, once, to open the phone's Auto-start screen (those phones close background apps unless allowed there),
   5. adds the "Floating chat bubble" switch to Settings > Notifications (the bubble shows the sender's photo, a red unread badge
      and, now, the WhatsApp-style message pop-up with the message, reply box, Close and View). On by default; the choice is kept in localStorage "letschat-native:bubble".
      Skipped when the website already shows its own "Chat head (floating bubble)" switch.
   6. makes the "Push notifications" and "Background alerts" switches work inside the app. The website only knows browser web-push, which the
      Android WebView does not have (it showed "Not supported in this browser"), so here those two switches drive the phone's own
      notifications and the background service instead. Rows are found by their title text whatever tags the page uses.
   7. INSTANT PUSH: registers this phone with Firebase Cloud Messaging and gives the token to the Letschat server through the same
      /push/subscribe route the website uses (endpoint = FCM_PREFIX + token; the server's web-push shim sends those through Firebase).
      Messages then arrive within a second or two even when the app is closed. Needs google-services.json in the build; without it
      registration fails quietly and the 8-second checker keeps working.
      The registration carries app:true, so the server knows this person has the app and sends their alerts to the app only (not also to Chrome).
   8. applies the alert rules to the pop-up: no pop-up for "X joined the group" notices, muted chats, people you blocked, groups when
      "Group messages" is off, or the big Chat Room unless the message @mentions or replies to you; "Show message preview" off hides the
      message text. If anything needed for those rules cannot be read, the pop-up is shown (a pop-up too many beats a missed message).
   Tapping the chat head with no message waiting opens Letschat on the Calls tab (see openCallsTab).

   PLUGIN ACCESS: the site is loaded from a web address, so Capacitor does not always put the native plugins on window.Capacitor.Plugins
   (that list only holds plugins the website's own code registered). This script therefore talks to the native plugins directly through
   Capacitor's nativePromise / nativeCallback, and uses Capacitor.Plugins only when a plugin is already there. */
(function () {
  if (window.__lcNativeBridge) return;
  if (!/(^|\.)(letschat-taupe\.vercel\.app|letschatafric\.netlify\.app)$/.test(location.hostname)) return;
  var C = window.Capacitor;
  if (!C) return;

  // A handle for a native plugin: the ready-made one when the page has it, otherwise one built on nativePromise / nativeCallback.
  function plug(name) {
    var P = C.Plugins && C.Plugins[name];
    if (P) return P;
    if (typeof C.nativePromise !== "function" || typeof Proxy !== "function") return null;
    var cache = {};
    return new Proxy({}, {
      get: function (_, m) {
        if (typeof m !== "string" || m === "then") return undefined;
        if (!cache[m]) {
          cache[m] = m === "addListener"
            ? function (ev, cb) {
                var id = C.nativeCallback(name, "addListener", { eventName: ev }, cb);
                return Promise.resolve({ remove: function () { return C.nativeCallback(name, "removeListener", { eventName: ev, callbackId: id }); } });
              }
            : function (o) { return C.nativePromise(name, m, o || {}); };
        }
        return cache[m];
      }
    });
  }
  var BG = plug("BackgroundService"), BB = plug("ChatBubble"), APP = plug("App"), PN = plug("PushNotifications");
  if (!BG && !BB) return;
  window.__lcNativeBridge = true;

  var SESSION_KEY = "letschat-africa:session";
  var NOTIFS_KEY = "letschat-africa:notifs";   // Settings > Notifications of the website (this device)
  var CONVS_KEY = "letschat-africa:convCache"; // the chat list the website saved last time
  var ASK_KEY = "letschat-native:asked:";
  var SETUP_KEY = "letschat-native:perm-setup-done";
  var CONTACTS_KEY = "letschat-native:contacts-asked";
  var unread = 0, background = false, serviceOn = false, serviceStartedOnce = false;
  var setupRunning = false, setupGate = false, waiters = [];
  var BUBBLE_KEY = "letschat-native:bubble";
  var ALERTS_KEY = "letschat-native:alerts"; // "Push notifications" switch (phone alerts), on by default
  var BGSERVICE_KEY = "letschat-native:bgservice"; // "Background alerts" switch (keep connected when closed), on by default
  var FCM_TOKEN_KEY = "letschat-native:fcmtoken";
  var FCM_PREFIX = "https://fcm-token.letschat.invalid/"; // must match web-push-shim/index.js on the server
  function noop() {}

  function bubbleOn() { try { return localStorage.getItem(BUBBLE_KEY) !== "0"; } catch (e) { return true; } }
  function alertsPref() { try { return localStorage.getItem(ALERTS_KEY) !== "0"; } catch (e) { return true; } }
  function bgWanted() { try { return localStorage.getItem(BGSERVICE_KEY) !== "0"; } catch (e) { return true; } }
  function setPref(k, on) { try { localStorage.setItem(k, on ? "1" : "0"); } catch (e) {} }
  function apiBase() { return String((window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.API_URL) || "").replace(/\/+$/, ""); }
  function photoUrl(p) { return p && String(p).charAt(0) === "/" ? apiBase() + p : (p || ""); }
  if (BB && BB.setEnabled) BB.setEnabled({ enabled: bubbleOn() }).catch(noop);
  if (BB && BB.setAlerts) BB.setAlerts({ enabled: alertsPref() }).catch(noop);

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

  // Tecno / Infinix / itel (HiOS, XOS): the phone closes apps in the background unless they are allowed in its Auto-start screen
  // (Phone Master). Asked at most once a month until the person agrees; saying yes is remembered for good. Other phones never see this.
  var OEM_DONE_KEY = "letschat-native:oem-done";
  function offerOem() {
    if (!BG || !BG.getOemInfo || !BG.openAutostartSettings) return;
    try {
      if (localStorage.getItem(OEM_DONE_KEY) === "1" || Date.now() - (+localStorage.getItem(ASK_KEY + "oem") || 0) < 30 * 864e5) return;
    } catch (e) { return; }
    BG.getOemInfo().then(function (r) {
      if (!r || !r.transsion) return;
      markAsked("oem");
      if (window.confirm("Your phone may close Letschat in the background, so you could miss messages. Open the phone's Auto-start settings now and switch Letschat ON?")) {
        try { localStorage.setItem(OEM_DONE_KEY, "1"); } catch (e) {}
        BG.openAutostartSettings().catch(noop);
      }
    }).catch(noop);
  }

  // ---- ONE-TIME "allow all permissions" set-up ----
  function setupDone() { try { return localStorage.getItem(SETUP_KEY) === "1"; } catch (e) { return false; } }
  function markSetupDone() { try { localStorage.setItem(SETUP_KEY, "1"); } catch (e) {} }
  function contactsAsked() { try { return localStorage.getItem(CONTACTS_KEY) === "1"; } catch (e) { return false; } }
  function markContactsAsked() { try { localStorage.setItem(CONTACTS_KEY, "1"); } catch (e) {} }
  // Everything Letschat needs is on (the overlay only counts while the floating bubble is switched on).
  function allOk(s) { return !!(s && s.runtimeGranted && (s.overlay || !bubbleOn()) && s.battery); }

  // Resolves once the person has gone to a phone settings screen and come back (or after 3 seconds if no screen opened).
  // It must be created BEFORE the screen is opened, so the "left the app" event cannot be missed.
  function waitForReturn() {
    return new Promise(function (resolve) {
      var left = false, finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        var i = waiters.indexOf(w);
        if (i >= 0) waiters.splice(i, 1);
        resolve();
      }
      function w(active) {
        if (!active) left = true;
        else if (left) setTimeout(finish, 400);
      }
      waiters.push(w);
      setTimeout(function () { if (!left) finish(); }, 3000);
      setTimeout(finish, 180000);
    });
  }
  function openAndWait(open) {
    var wait = waitForReturn();
    return Promise.resolve().then(open).then(function () { return wait; }, function () { return wait; });
  }

  // Order: one question -> Android's allow dialogs (camera, microphone, contacts, notifications, location, photos, nearby devices)
  // -> "display over other apps" switch -> battery question -> if anything is still off, the phone's app-permission page.
  function setupPermissions() {
    if (setupRunning || setupDone() || askedRecently("setup") || !BB || !BB.checkAllPermissions || !BB.requestRuntimePermissions) return Promise.resolve(false);
    setupRunning = true;
    return BB.checkAllPermissions().then(function (s) {
      if (allOk(s)) { markSetupDone(); markContactsAsked(); return true; }
      var ok = window.confirm(
        "Letschat needs a few permissions to work fully: camera, microphone, contacts, notifications, location, photos and files, nearby devices, " +
        "display over other apps and staying connected in the background.\n\nAllow them now? You only do this once."
      );
      if (!ok) { markAsked("setup"); markAsked("overlay"); markAsked("battery"); return false; }
      markContactsAsked(); // contacts is part of this set-up, so no separate question afterwards
      return BB.requestRuntimePermissions().catch(noop)
        .then(function () { return BB.checkOverlayPermission().catch(function () { return {}; }); })
        .then(function (o) {
          if (!bubbleOn() || (o && o.granted)) return;
          return openAndWait(function () { return BB.requestOverlayPermission(); });
        })
        .then(function () {
          if (!BG) return;
          return BG.isIgnoringBatteryOptimizations().then(function (r) {
            if (r && r.ignoring) return;
            return openAndWait(function () { return BG.requestIgnoreBatteryOptimizations(); });
          }, noop);
        })
        .then(function () { return BB.checkAllPermissions(); })
        .then(function (after) {
          markSetupDone();
          markAsked("overlay");
          markAsked("battery");
          if (allOk(after)) return true;
          if (window.confirm("Some permissions are still switched off. Open your phone's app permission settings for Letschat so you can switch them on?")) {
            return BB.openAppPermissionSettings().then(function () { return true; }, function () { return true; });
          }
          return true;
        });
    }).catch(function () { return false; }).then(function (v) { setupRunning = false; return v; });
  }

  // People who already finished the set-up before contacts existed: ask for contacts ONCE (never again, even if they say no).
  // Only contacts is requested here, nothing else is asked a second time.
  function offerContacts() {
    if (!BB || !BB.checkAllPermissions || !BB.requestPermissions || !setupDone() || contactsAsked()) return Promise.resolve();
    return BB.checkAllPermissions().then(function (s) {
      markContactsAsked();
      var missing = (s && s.missing) || [];
      if (missing.indexOf("contacts") < 0) return; // already allowed
      if (!window.confirm("Letschat would like to see your contacts so it can show which of your friends are already on Letschat.\n\nAllow it now?")) return;
      return BB.requestPermissions({ permissions: ["contacts"] });
    }).catch(noop);
  }

  // "Settings > Notifications" of the website: both switches are on unless the person turned them off.
  function notifPrefs() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(NOTIFS_KEY)); } catch (e) {}
    return { preview: !(o && o.preview === false), groups: !(o && o.groups === false) };
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

  // ---- Instant push (Firebase Cloud Messaging) ----
  var fcmToken = null, fcmSentKey = "", fcmStarted = false;
  try { fcmToken = localStorage.getItem(FCM_TOKEN_KEY) || null; } catch (e) {}
  // The server serves /api/push/subscribe (and rewrites /api/v1/* to /api/*), so the direct /api path is used.
  function pushApi(path, body) {
    var s = session();
    if (!s || !s.token || !apiBase()) return Promise.reject(new Error("not signed in"));
    return fetch(apiBase() + "/api" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token },
      body: JSON.stringify(body)
    });
  }
  // Gives the server this phone's Firebase token (again after every sign-in, and when a notification switch is changed).
  // The server then pushes new messages to it.
  function sendFcm() {
    if (!fcmToken || !loggedIn() || !alertsPref()) return;
    var p = notifPrefs();
    var key = fcmToken + "|" + String((session() || {}).token || "").slice(-16) + "|" + p.preview + "|" + p.groups;
    if (fcmSentKey === key) return;
    fcmSentKey = key;
    pushApi("/push/subscribe", {
      subscription: { endpoint: FCM_PREFIX + fcmToken, keys: { p256dh: "fcm", auth: "fcm" } },
      app: true, // tells the server this person has the app: their alerts then go to the app only, not to Chrome
      preview: p.preview,
      groups: p.groups
    }).then(function (r) { if (!r.ok) fcmSentKey = ""; }).catch(function () { fcmSentKey = ""; });
  }
  function unsubscribeFcm() {
    fcmSentKey = "";
    if (!fcmToken || !loggedIn()) return;
    pushApi("/push/unsubscribe", { endpoint: FCM_PREFIX + fcmToken }).catch(noop);
  }
  // Creates the sound + vibration channel, asks for the notification permission when needed, then registers with Firebase.
  // Never while the one-time permission set-up is running (two permission questions at once confuse Android).
  function setupFcm() {
    if (!PN || fcmStarted || setupGate || setupRunning || !alertsPref() || !loggedIn()) return;
    fcmStarted = true;
    function go() { PN.register().catch(function () { fcmStarted = false; }); }
    try {
      PN.createChannel({ id: "letschat_push", name: "Letschat messages", description: "Alerts for new Letschat messages", importance: 5, visibility: 0, vibration: true }).catch(noop);
    } catch (e) {}
    PN.checkPermissions().then(function (r) {
      var st = r && r.receive;
      if (st === "granted") return go();
      if (st === "prompt" || st === "prompt-with-rationale") {
        return PN.requestPermissions().then(function (x) { if (x && x.receive === "granted") go(); else fcmStarted = false; });
      }
      fcmStarted = false; // refused in Android settings: the Push notifications switch will open them
    }).catch(function () { fcmStarted = false; });
  }
  try {
    if (PN && PN.addListener) {
      PN.addListener("registration", function (t) {
        if (!t || !t.value) return;
        fcmToken = String(t.value);
        try { localStorage.setItem(FCM_TOKEN_KEY, fcmToken); } catch (e) {}
        fcmSentKey = "";
        sendFcm();
      });
      PN.addListener("registrationError", function () { fcmStarted = false; });
      // tapping a push opens that chat (the app reads ?open=<conversation id> after the page loads)
      PN.addListener("pushNotificationActionPerformed", function (a) {
        var d = a && a.notification && a.notification.data;
        var id = d && d.chatId ? String(d.chatId) : "";
        if (id) { try { location.assign(location.origin + "/?open=" + encodeURIComponent(id)); } catch (e) {} }
      });
    }
  } catch (e) {}

  function syncService() {
    sendSession();
    if (!BG) return;
    var li = loggedIn();
    if (li && !serviceOn && bgWanted()) {
      serviceOn = true;
      setupGate = true; // instant push waits until the one-time permission set-up is over
      BG.start({ title: "Letschat Africa", text: "Connected. Tap to open." }).then(function () {
        serviceStartedOnce = true;
        // first time: the one-time "allow all permissions" set-up (existing users: the one-time contacts question);
        // afterwards the weekly reminders for the two special switches, the Auto-start question and instant push
        setTimeout(function () {
          setupPermissions().then(offerContacts).catch(noop).then(function () {
            setupGate = false;
            offerOverlay();
            setTimeout(offerBattery, 40000);
            setTimeout(offerOem, 70000);
            setupFcm();
          });
        }, 1500);
      }).catch(function () { serviceOn = false; setupGate = false; });
    } else if (!li && serviceOn) {
      serviceOn = false;
      unread = 0;
      BG.stop().catch(noop);
      if (BB) BB.hide().catch(noop);
    }
    if (li && (serviceStartedOnce || !bgWanted())) setupFcm();
    if (!li) fcmStarted = false;
    sendFcm();
  }
  setInterval(syncService, 5000);
  syncService();

  function field(o, names) {
    for (var i = 0; i < names.length; i++) if (o && o[names[i]] != null && o[names[i]] !== "") return o[names[i]];
    return null;
  }
  // ---- the rules (same as the website's own alerts and the server's push alerts) ----
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

  // ---- Settings > Notifications ----
  // The page is a React app we do not edit, so rows are found by their title text (any tag) and changed in place with the same look.
  var SW_SEL = "button[role=switch],[role=switch],input[type=checkbox],button[aria-checked]";
  function rowByTitle(title) {
    try {
      var snap = document.evaluate("//*[not(self::script) and not(self::style) and normalize-space(text())='" + title + "']", document, null, 7, null);
      for (var i = 0; i < snap.snapshotLength; i++) {
        var t = snap.snapshotItem(i), node = t;
        for (var d = 0; d < 7 && node.parentElement; d++) {
          node = node.parentElement;
          var n = node.querySelectorAll(SW_SEL).length;
          if (n === 1) return { row: node, title: t, sw: node.querySelector(SW_SEL) };
          if (n > 1) break; // climbed past this row into the whole list
        }
      }
    } catch (e) {}
    return null;
  }
  // The small grey line under a row's title (the element after the title, inside the same row).
  function descOf(r) {
    var t = r.title;
    return (t.nextElementSibling && !t.nextElementSibling.querySelector(SW_SEL) && t.nextElementSibling) ||
      (t.parentElement && t.parentElement.nextElementSibling && !t.parentElement.nextElementSibling.querySelector(SW_SEL) && t.parentElement.nextElementSibling) || null;
  }
  function findRow() { var r = rowByTitle("Show message preview"); return r && r.row; }
  function paintSwitch(btn, on) {
    var v = on ? "true" : "false";
    if (btn.getAttribute("aria-checked") !== v) btn.setAttribute("aria-checked", v);
    btn.style.background = on ? "#35D0BA" : "#2B3544";
    var knob = btn.querySelector("span");
    if (knob) knob.style.left = on ? "22px" : "3px";
  }
  function addSettingRow() {
    if (!BB || document.querySelector("[data-lc-bubble-row]")) return;
    if (rowByTitle("Chat head (floating bubble)")) return; // the website already has its own chat head switch
    var src = findRow();
    if (!src) return;
    var row = src.cloneNode(true);
    row.setAttribute("data-lc-bubble-row", "1");
    var box = row.firstElementChild;
    if (box && box.children.length > 1) {
      box.children[0].textContent = "Floating chat bubble";
      box.children[1].textContent = "Show the sender's photo and message in a bubble over other apps when a message arrives.";
    }
    var btn = row.querySelector(SW_SEL);
    if (!btn) return;
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

  // "Push notifications" and "Background alerts" said "Not supported in this browser" and could not be switched on: the website only
  // knows browser web-push, which the Android WebView does not have. Inside the app they now control the phone's own alerts.
  function setText(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }
  function fixNativeRow(title, desc, isOn, onClick) {
    var r = rowByTitle(title);
    if (!r) return;
    var d = descOf(r);
    if (d) {
      setText(d, desc);
      if (d.style && d.style.color) d.style.color = ""; // the orange warning colour
    }
    var btn = r.sw;
    if (!btn) return;
    if (btn.disabled) btn.disabled = false;
    if (btn.removeAttribute) btn.removeAttribute("disabled");
    if (btn.getAttribute && btn.getAttribute("aria-disabled")) btn.setAttribute("aria-disabled", "false");
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.style.pointerEvents = "auto";
    if (r.row.style) { r.row.style.opacity = "1"; r.row.style.pointerEvents = "auto"; }
    if (!r.row.__lcNative) {
      r.row.__lcNative = true;
      // The whole row listens (capture phase) so a tap on the switch OR its label is handled here before the website sees it.
      r.row.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var cur = r.row.querySelector(SW_SEL);
        if (cur) onClick(cur);
      }, true);
    }
    isOn().then(function (on) { paintSwitch(btn, on); }).catch(noop);
  }
  function notifState() {
    if (!BG || !BG.areNotificationsEnabled) return Promise.resolve({ enabled: true });
    return BG.areNotificationsEnabled().catch(function () { return { enabled: true }; });
  }
  function pushRow() {
    fixNativeRow("Push notifications", "Phone alerts with sound and vibration for new messages, even when Letschat is closed.",
      function () { return notifState().then(function (s) { return !!(s && s.enabled) && alertsPref(); }); },
      function (btn) {
        notifState().then(function (s) {
          if (!s || !s.enabled) { // Android 13+: ask for the notification permission (or open Android's notification settings if it was refused)
            setPref(ALERTS_KEY, true);
            if (BB && BB.setAlerts) BB.setAlerts({ enabled: true }).catch(noop);
            if (BG && BG.requestNotificationPermission) {
              BG.requestNotificationPermission().then(function () { fcmStarted = false; setTimeout(function () { refreshRows(); setupFcm(); }, 600); }).catch(noop);
            }
            return;
          }
          var on = !alertsPref();
          setPref(ALERTS_KEY, on);
          paintSwitch(btn, on);
          if (BB && BB.setAlerts) BB.setAlerts({ enabled: on }).catch(noop);
          if (on) { fcmSentKey = ""; fcmStarted = false; setupFcm(); sendFcm(); } else { unsubscribeFcm(); }
        });
      });
  }
  function backgroundRow() {
    fixNativeRow("Background alerts", "Keep Letschat connected in the background so messages arrive when the app is closed.",
      function () { return BG && BG.isRunning ? BG.isRunning().then(function (r) { return !!(r && r.running); }) : Promise.resolve(false); },
      function (btn) {
        if (!BG) return;
        BG.isRunning().then(function (r) {
          if (r && r.running) {
            setPref(BGSERVICE_KEY, false);
            serviceOn = false;
            BG.stop().then(function () { setTimeout(refreshRows, 400); }).catch(noop);
            return;
          }
          setPref(BGSERVICE_KEY, true);
          serviceOn = true;
          BG.start({ title: "Letschat Africa", text: "Connected. Tap to open." }).then(function () {
            serviceStartedOnce = true;
            setTimeout(refreshRows, 600);
            BG.isIgnoringBatteryOptimizations().then(function (b) {
              if (!b || !b.ignoring) BG.requestIgnoreBatteryOptimizations().catch(noop); // opens Android's battery screen
            }).catch(noop);
          }).catch(function () { serviceOn = false; });
        }).catch(noop);
      });
  }
  function refreshRows() { pushRow(); backgroundRow(); }

  var settingsTimer = null;
  try {
    new MutationObserver(function () {
      if (settingsTimer) return;
      settingsTimer = setTimeout(function () { settingsTimer = null; addSettingRow(); refreshRows(); }, 300);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  addSettingRow();
  refreshRows();

  // ---- chat head tapped with no message waiting: open the Calls tab ----
  // The bottom bar belongs to the React app, so the tab is found by its name and tapped like a finger would. After a cold start the
  // bar is not there yet, so it is looked for every 300 ms for up to 15 seconds (it never runs when nobody is signed in).
  var callsTimer = null;
  function findCallsTab() {
    try {
      var tabs = document.querySelectorAll(".lc-tab");
      for (var i = 0; i < tabs.length; i++) {
        if (/^\s*calls\s*$/i.test(tabs[i].textContent || "")) return tabs[i];
      }
      var n = document.evaluate("//*[normalize-space(text())='Calls']", document, null, 9, null).singleNodeValue;
      return n ? (n.closest(".lc-tab, button, [role=tab], a") || n) : null;
    } catch (e) { return null; }
  }
  function openCallsTab() {
    if (callsTimer) clearInterval(callsTimer);
    var tries = 0;
    function attempt() {
      var t = findCallsTab();
      if (t) { clearInterval(callsTimer); callsTimer = null; try { t.click(); } catch (e) {} return true; }
      if (++tries > 50) { clearInterval(callsTimer); callsTimer = null; }
      return false;
    }
    if (attempt()) return;
    callsTimer = setInterval(attempt, 300);
  }

  function setActive(active) {
    background = !active;
    if (waiters.length) waiters.slice().forEach(function (w) { try { w(active); } catch (e) {} }); // lets the permission set-up know the person came back
    if (active) {
      unread = 0;
      if (BB) BB.hide().catch(noop);
    }
  }
  try { if (APP && APP.addListener) APP.addListener("appStateChange", function (s) { setActive(!!(s && s.isActive)); }); } catch (e) {}
  try { if (BB && BB.addListener) {
    BB.addListener("appState", function (s) { setActive(!!(s && s.active)); });
    // "View" in the message pop-up (and a tapped message notification): open that chat (the app reads ?open=<conversation id> after the page loads).
    // The head tapped with nothing waiting (no chat id, tab "calls"): open the Calls tab instead.
    BB.addListener("bubbleTapped", function (d) {
      unread = 0;
      var id = d && d.chatId ? String(d.chatId) : "";
      if (id) { try { location.assign(location.origin + "/?open=" + encodeURIComponent(id)); } catch (e) {} return; }
      if (d && d.tab === "calls") openCallsTab();
    });
  } } catch (e) {}
  document.addEventListener("visibilitychange", function () { if (!document.hidden) setActive(true); });
})();
