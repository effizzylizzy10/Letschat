/* Letschat native glue. Injected by the ChatBubble plugin into the Letschat website inside the Android app only.
   It does six things:
   1. starts the background service once a person is signed in (and stops it on sign-out),
   2. listens to the live chat connection and shows the message pop-up when a message arrives while the app is in the background
      (the floating chat head itself is put on screen by the native plugin as soon as the app is minimized or closed),
   3. asks, at most once a week each, for "display over other apps" (straight to Android's switch, no extra question) and "ignore battery optimisation",
      and on Tecno / Infinix / itel phones, once, to open the phone's Auto-start screen (those phones close background apps unless allowed there),
   4. adds the "Floating chat bubble" switch to Settings > Notifications (the bubble shows the sender's photo, a red unread badge
      and, now, the WhatsApp-style message pop-up with the message, reply box, Close and View). On by default; the choice is kept in localStorage "letschat-native:bubble".
   5. makes the "Push notifications" and "Background alerts" switches work inside the app. The website only knows browser web-push, which the
      Android WebView does not have (it showed "Not supported in this browser"), so here those two switches drive the phone's own
      notifications and the background service instead.
   6. INSTANT PUSH: registers this phone with Firebase Cloud Messaging and gives the token to the Letschat server through the same
      /push/subscribe route the website uses (endpoint = FCM_PREFIX + token; the server's web-push shim sends those through Firebase).
      Messages then arrive within a second or two even when the app is closed. Needs google-services.json in the build; without it
      registration fails quietly and the 8-second checker keeps working.
   Tapping the chat head with no message waiting opens Letschat on the Calls tab (see openCallsTab). */
(function () {
  if (window.__lcNativeBridge) return;
  if (!/(^|\.)(letschat-taupe\.vercel\.app|letschatafric\.netlify\.app)$/.test(location.hostname)) return;
  var C = window.Capacitor;
  if (!C || !C.Plugins) return;
  var BG = C.Plugins.BackgroundService, BB = C.Plugins.ChatBubble, APP = C.Plugins.App, PN = C.Plugins.PushNotifications;
  if (!BG && !BB) return;
  window.__lcNativeBridge = true;

  var SESSION_KEY = "letschat-africa:session";
  var ASK_KEY = "letschat-native:asked:";
  var unread = 0, background = false, serviceOn = false, serviceStartedOnce = false;
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

  // Hands the sign-in to the native side so the chat head can pop up for new messages while the app is closed.
  var sentTok = null;
  function sendSession() {
    if (!BB || !BB.setSession) return;
    var s = session(), tok = s && s.token ? String(s.token) : "";
    if (tok === sentTok) return;
    sentTok = tok;
    BB.setSession({ token: tok, apiUrl: apiBase(), userId: String(myId() || "") }).catch(function () { sentTok = null; });
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
  function notifPrefs() { try { return JSON.parse(localStorage.getItem("letschat-africa:notifs")) || {}; } catch (e) { return {}; } }
  // Gives the server this phone's Firebase token (again after every sign-in). The server then pushes new messages to it.
  function sendFcm() {
    if (!fcmToken || !loggedIn() || !alertsPref()) return;
    var key = fcmToken + "|" + String((session() || {}).token || "").slice(-16);
    if (fcmSentKey === key) return;
    fcmSentKey = key;
    var p = notifPrefs();
    pushApi("/push/subscribe", {
      subscription: { endpoint: FCM_PREFIX + fcmToken, keys: { p256dh: "fcm", auth: "fcm" } },
      preview: p.preview !== false,
      groups: p.groups !== false
    }).then(function (r) { if (!r.ok) fcmSentKey = ""; }).catch(function () { fcmSentKey = ""; });
  }
  function unsubscribeFcm() {
    fcmSentKey = "";
    if (!fcmToken || !loggedIn()) return;
    pushApi("/push/unsubscribe", { endpoint: FCM_PREFIX + fcmToken }).catch(noop);
  }
  // Creates the sound + vibration channel, asks for the notification permission when needed, then registers with Firebase.
  function setupFcm() {
    if (!PN || fcmStarted || !alertsPref() || !loggedIn()) return;
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
      BG.start({ title: "Letschat Africa", text: "Connected. Tap to open." }).then(function () {
        serviceStartedOnce = true;
        setTimeout(offerOverlay, 1500);
        setTimeout(offerBattery, 40000);
        setTimeout(offerOem, 70000);
        setTimeout(setupFcm, 800); // after the notification permission question of the service, never at the same time
      }).catch(function () { serviceOn = false; });
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
  function onEvent(name, m) {
    if (name !== "message:new" || !m || typeof m !== "object" || !background || !BB || !bubbleOn()) return;
    var sender = field(m, ["sender", "from", "user"]);
    var sid = field(m, ["senderId", "sender_id", "fromId", "userId"]) || (sender && typeof sender === "object" ? field(sender, ["id", "_id"]) : sender);
    var me = myId();
    if (me && sid && String(sid) === String(me)) return; // my own message
    var photo = (sender && typeof sender === "object" ? field(sender, ["avatar", "photo", "picture", "image"]) : null) || field(m, ["senderAvatar", "avatar"]);
    if (!photo && sid && apiBase()) photo = "/api/v1/users/" + encodeURIComponent(String(sid)) + "/avatar";
    var title = field(m, ["senderName", "fromName"]) || (sender && typeof sender === "object" ? field(sender, ["name", "displayName", "username"]) : null) || "Letschat";
    var text = field(m, ["text", "body", "content", "caption"]) || (m.type && m.type !== "text" ? "[" + m.type + "]" : "New message");
    var chat = field(m, ["conversationId", "convoId", "convId", "chatId"]) || (m.conversation && field(m.conversation, ["id", "_id"])) || "";
    var rt = m.replyTo && typeof m.replyTo === "object" ? m.replyTo : null;
    var replyName = rt ? (me && rt.senderId && String(rt.senderId) === String(me) ? "You" : (rt.name || "")) : "";
    unread++;
    BB.show({
      count: unread, title: String(title), text: String(text).slice(0, 500), chatId: String(chat), avatar: photoUrl(photo),
      messageId: m.id ? String(m.id) : "", replyName: String(replyName), replyText: rt && rt.text ? String(rt.text).slice(0, 140) : ""
    }).catch(noop);
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
  // The page is a React app we do not edit, so rows are found by their title and changed in place with the same look.
  function rowByTitle(title) {
    try {
      var t = document.evaluate("//div[normalize-space(text())='" + title + "']", document, null, 9, null).singleNodeValue;
      var row = t && t.parentElement && t.parentElement.parentElement;
      return row && row.querySelector("button[role=switch]") ? row : null;
    } catch (e) { return null; }
  }
  function findRow() { return rowByTitle("Show message preview"); }
  function paintSwitch(btn, on) {
    var v = on ? "true" : "false";
    if (btn.getAttribute("aria-checked") !== v) btn.setAttribute("aria-checked", v);
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

  // "Push notifications" and "Background alerts" said "Not supported in this browser" and could not be switched on: the website only
  // knows browser web-push, which the Android WebView does not have. Inside the app they now control the phone's own alerts.
  function setText(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }
  function fixNativeRow(title, desc, isOn, onClick) {
    var row = rowByTitle(title);
    if (!row) return;
    var box = row.firstElementChild;
    if (box && box.children.length > 1) {
      setText(box.children[1], desc);
      if (box.children[1].style && box.children[1].style.color) box.children[1].style.color = ""; // the orange warning colour
    }
    var btn = row.querySelector("button[role=switch]");
    if (!btn) return;
    if (btn.disabled) btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    if (!btn.__lcNative) {
      btn.__lcNative = true;
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        onClick(btn);
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
    if (active) {
      unread = 0;
      if (BB) BB.hide().catch(noop);
    }
  }
  try { if (APP && APP.addListener) APP.addListener("appStateChange", function (s) { setActive(!!(s && s.isActive)); }); } catch (e) {}
  try { if (BB && BB.addListener) {
    BB.addListener("appState", function (s) { setActive(!!(s && s.active)); });
    // "View" in the message pop-up: open that chat (the app reads ?open=<conversation id> after the page loads).
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
