/* Letschat native glue. Injected by the ChatBubble plugin into the Letschat website inside the Android app only.
   This bridge handles native background service, floating chat bubbles, Android notification preferences
   and Firebase Cloud Messaging registration.
*/
(function () {
  if (window.__lcNativeBridge) return;
  if (!/(^|\.)(letschat-taupe\.vercel\.app|letschatafric\.netlify\.app)$/.test(location.hostname)) return;

  var C = window.Capacitor;
  if (!C || !C.Plugins) return;

  var BG = C.Plugins.BackgroundService;
  var BB = C.Plugins.ChatBubble;
  var APP = C.Plugins.App;
  var PN = C.Plugins.PushNotifications;

  if (!BG && !BB) return;
  window.__lcNativeBridge = true;

  var SESSION_KEY = "letschat-africa:session";
  var ASK_KEY = "letschat-native:asked:";
  var unread = 0;
  var background = false;
  var serviceOn = false;
  var serviceStartedOnce = false;

  var BUBBLE_KEY = "letschat-native:bubble";
  var ALERTS_KEY = "letschat-native:alerts";
  var BGSERVICE_KEY = "letschat-native:bgservice";
  var FCM_TOKEN_KEY = "letschat-native:fcmtoken";

  // This prefix MUST match server/client/web-push-shim/index.js.
  var FCM_PREFIX = "https://fcm-token.letschat.invalid/";

  function noop() {}

  function bubbleOn() {
    try {
      return localStorage.getItem(BUBBLE_KEY) !== "0";
    } catch (e) {
      return true;
    }
  }

  function alertsPref() {
    try {
      return localStorage.getItem(ALERTS_KEY) !== "0";
    } catch (e) {
      return true;
    }
  }

  function bgWanted() {
    try {
      return localStorage.getItem(BGSERVICE_KEY) !== "0";
    } catch (e) {
      return true;
    }
  }

  function setPref(k, on) {
    try {
      localStorage.setItem(k, on ? "1" : "0");
    } catch (e) {}
  }

  function apiBase() {
    return String(
      (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.API_URL) || ""
    ).replace(/\/+$/, "");
  }

  function photoUrl(p) {
    return p && String(p).charAt(0) === "/"
      ? apiBase() + p
      : (p || "");
  }

  if (BB && BB.setEnabled) {
    BB.setEnabled({ enabled: bubbleOn() }).catch(noop);
  }

  if (BB && BB.setAlerts) {
    BB.setAlerts({ enabled: alertsPref() }).catch(noop);
  }

  function session() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;
    }
  }

  function loggedIn() {
    var s = session();
    return !!(s && s.token);
  }

  function myId() {
    var s = session();
    if (!s) return null;

    return (
      (s.user && (s.user.id || s.user._id)) ||
      s.userId ||
      s.id ||
      null
    );
  }

  function askedRecently(k) {
    try {
      return Date.now() -
        (+localStorage.getItem(ASK_KEY + k) || 0) < 7 * 864e5;
    } catch (e) {
      return false;
    }
  }

  function markAsked(k) {
    try {
      localStorage.setItem(ASK_KEY + k, String(Date.now()));
    } catch (e) {}
  }

  // Android overlay permission.
  function offerOverlay() {
    if (!BB || !bubbleOn() || askedRecently("overlay")) return;

    BB.checkOverlayPermission().then(function (r) {
      if (r && r.granted) return;

      markAsked("overlay");
      BB.requestOverlayPermission().catch(noop);
    }).catch(noop);
  }

  // Android battery optimisation.
  function offerBattery() {
    if (!BG || askedRecently("battery")) return;

    BG.isIgnoringBatteryOptimizations().then(function (r) {
      if (r && r.ignoring) return;

      markAsked("battery");

      if (window.confirm(
        "Keep Letschat connected when the app is closed? Android will ask you to allow it."
      )) {
        BG.requestIgnoreBatteryOptimizations().catch(noop);
      }
    }).catch(noop);
  }

  // Tecno, Infinix and itel auto-start support.
  var OEM_DONE_KEY = "letschat-native:oem-done";

  function offerOem() {
    if (!BG || !BG.getOemInfo || !BG.openAutostartSettings) return;

    try {
      if (
        localStorage.getItem(OEM_DONE_KEY) === "1" ||
        Date.now() - (+localStorage.getItem(ASK_KEY + "oem") || 0) <
          30 * 864e5
      ) {
        return;
      }
    } catch (e) {
      return;
    }

    BG.getOemInfo().then(function (r) {
      if (!r || !r.transsion) return;

      markAsked("oem");

      if (window.confirm(
        "Your phone may close Letschat in the background, so you could miss messages. Open the phone's Auto-start settings now and switch Letschat ON?"
      )) {
        try {
          localStorage.setItem(OEM_DONE_KEY, "1");
        } catch (e) {}

        BG.openAutostartSettings().catch(noop);
      }
    }).catch(noop);
  }

  // Send login session to the native plugin.
  var sentTok = null;

  function sendSession() {
    if (!BB || !BB.setSession) return;

    var s = session();
    var tok = s && s.token ? String(s.token) : "";

    if (tok === sentTok) return;

    sentTok = tok;

    BB.setSession({
      token: tok,
      apiUrl: apiBase(),
      userId: String(myId() || "")
    }).catch(function () {
      sentTok = null;
    });
  }

  // --------------------------------------------------
  // FIREBASE CLOUD MESSAGING
  // --------------------------------------------------

  var fcmToken = null;
  var fcmSentKey = "";
  var fcmStarted = false;

  try {
    fcmToken = localStorage.getItem(FCM_TOKEN_KEY) || null;
  } catch (e) {}

  /*
   * IMPORTANT FIX:
   *
   * Backend routes are:
   * POST /api/push/subscribe
   * POST /api/push/unsubscribe
   *
   * They are NOT:
   * /api/v1/push/subscribe
   * /api/v1/push/unsubscribe
   */

  function pushApi(path, body) {
    var s = session();
    var base = apiBase();

    if (!s || !s.token || !base) {
      return Promise.reject(new Error("Not signed in or API URL missing"));
    }

    // Correct backend URL: API_BASE + /api + /push/subscribe
    var url = base + "/api" + path;

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + s.token
      },
      body: JSON.stringify(body)
    });
  }

  function notifPrefs() {
    try {
      return JSON.parse(
        localStorage.getItem("letschat-africa:notifs")
      ) || {};
    } catch (e) {
      return {};
    }
  }

  // Register this Android device's Firebase token with Letschat.
  function sendFcm() {
    if (!fcmToken || !loggedIn() || !alertsPref()) return;

    var key =
      fcmToken + "|" +
      String((session() || {}).token || "").slice(-16);

    if (fcmSentKey === key) return;

    fcmSentKey = key;

    var p = notifPrefs();

    pushApi("/push/subscribe", {
      subscription: {
        endpoint: FCM_PREFIX + fcmToken,
        keys: {
          p256dh: "fcm",
          auth: "fcm"
        }
      },
      preview: p.preview !== false,
      groups: p.groups !== false
    }).then(function (r) {
      if (!r.ok) {
        fcmSentKey = "";
      }
    }).catch(function () {
      fcmSentKey = "";
    });
  }

  // Remove this device's Firebase registration.
  function unsubscribeFcm() {
    fcmSentKey = "";

    if (!fcmToken || !loggedIn()) return;

    pushApi("/push/unsubscribe", {
      endpoint: FCM_PREFIX + fcmToken
    }).catch(noop);
  }

  // Start Firebase registration.
  function setupFcm() {
    if (
      !PN ||
      fcmStarted ||
      !alertsPref() ||
      !loggedIn()
    ) {
      return;
    }

    fcmStarted = true;

    function go() {
      PN.register().catch(function () {
        fcmStarted = false;
      });
    }

    try {
      PN.createChannel({
        id: "letschat_push",
        name: "Letschat messages",
        description: "Alerts for new Letschat messages",
        importance: 5,
        visibility: 0,
        vibration: true
      }).catch(noop);
    } catch (e) {}

    PN.checkPermissions().then(function (r) {
      var st = r && r.receive;

      if (st === "granted") {
        return go();
      }

      if (
        st === "prompt" ||
        st === "prompt-with-rationale"
      ) {
        return PN.requestPermissions().then(function (x) {
          if (x && x.receive === "granted") {
            go();
          } else {
            fcmStarted = false;
          }
        });
      }

      fcmStarted = false;
    }).catch(function () {
      fcmStarted = false;
    });
  }

  // Firebase registration listeners.
  try {
    if (PN && PN.addListener) {

      PN.addListener("registration", function (t) {
        if (!t || !t.value) return;

        fcmToken = String(t.value);

        try {
          localStorage.setItem(FCM_TOKEN_KEY, fcmToken);
        } catch (e) {}

        fcmSentKey = "";
        sendFcm();
      });

      PN.addListener("registrationError", function () {
        fcmStarted = false;
      });

      // Tapping a notification opens the related conversation.
      PN.addListener(
        "pushNotificationActionPerformed",
        function (a) {
          var d = a && a.notification && a.notification.data;
          var id = d && d.chatId ? String(d.chatId) : "";

          if (id) {
            try {
              location.assign(
                location.origin + "/?open=" + encodeURIComponent(id)
              );
            } catch (e) {}
          }
        }
      );
    }
  } catch (e) {}

  // --------------------------------------------------
  // BACKGROUND SERVICE
  // --------------------------------------------------

  function syncService() {
    sendSession();

    if (!BG) return;

    var li = loggedIn();

    if (li && !serviceOn && bgWanted()) {
      serviceOn = true;

      BG.start({
        title: "Letschat Africa",
        text: "Connected. Tap to open."
      }).then(function () {
        serviceStartedOnce = true;

        setTimeout(offerOverlay, 1500);
        setTimeout(offerBattery, 40000);
        setTimeout(offerOem, 70000);
        setTimeout(setupFcm, 800);

      }).catch(function () {
        serviceOn = false;
      });

    } else if (!li && serviceOn) {
      serviceOn = false;
      unread = 0;

      BG.stop().catch(noop);

      if (BB) {
        BB.hide().catch(noop);
      }
    }

    if (li && (serviceStartedOnce || !bgWanted())) {
      setupFcm();
    }

    if (!li) {
      fcmStarted = false;
    }

    sendFcm();
  }

  setInterval(syncService, 5000);
  syncService();

  // --------------------------------------------------
  // MESSAGE HANDLING
  // --------------------------------------------------

  function field(o, names) {
    for (var i = 0; i < names.length; i++) {
      if (
        o &&
        o[names[i]] != null &&
        o[names[i]] !== ""
      ) {
        return o[names[i]];
      }
    }

    return null;
  }

  function onEvent(name, m) {
    if (
      name !== "message:new" ||
      !m ||
      typeof m !== "object" ||
      !background ||
      !BB ||
      !bubbleOn()
    ) {
      return;
    }

    var sender = field(m, ["sender", "from", "user"]);

    var sid =
      field(m, ["senderId", "sender_id", "fromId", "userId"]) ||
      (
        sender && typeof sender === "object"
          ? field(sender, ["id", "_id"])
          : sender
      );

    var me = myId();

    if (me && sid && String(sid) === String(me)) {
      return;
    }

    var photo =
      (
        sender && typeof sender === "object"
          ? field(sender, ["avatar", "photo", "picture", "image"])
          : null
      ) ||
      field(m, ["senderAvatar", "avatar"]);

    if (!photo && sid && apiBase()) {
      photo =
