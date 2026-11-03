// Letschat Africa: web push helper (plain JS, loads before the app).
// The app uses it from Tools > Notifications > "Push notifications".
// Browser push now goes through Firebase Cloud Messaging (FCM), the same channel as the Android app. If this browser cannot use Firebase
// (old browser, Firebase blocked, or the token request fails) it quietly falls back to the classic VAPID web push used before.
(function () {
  var API = (window.LETSCHAT_CONFIG || {}).API_URL;
  var FCM_PREFIX = "https://fcm-token.letschat.invalid/"; // same pseudo-endpoint prefix the Android app and the server use
  var FCM_KEY = "letschat-africa:fcm-web-token";
  var current = null; // socket of the logged-in session

  function token() { try { var s = JSON.parse(localStorage.getItem("letschat-africa:session")); return s && s.token; } catch (e) { return null; } }
  function prefs() { try { return JSON.parse(localStorage.getItem("letschat-africa:notifs")) || {}; } catch (e) { return {}; } }
  function storedFcm() { try { return localStorage.getItem(FCM_KEY) || null; } catch (e) { return null; } }
  function storeFcm(t) { try { if (t) localStorage.setItem(FCM_KEY, t); else localStorage.removeItem(FCM_KEY); } catch (e) {} }
  function noop() {}
  function call(path, method, body, auth) {
    var h = { "Content-Type": "application/json" };
    if (auth) h.Authorization = "Bearer " + token();
    return fetch(API + "/api/v1" + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.success === false) throw new Error((j.error && j.error.message) || "Request failed");
        return j.data;
      }); });
  }
  function toKey(b64) {
    var pad = "=".repeat((4 - (b64.length % 4)) % 4), raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  function supported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function standalone() { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true; }
  function registration() {
    return navigator.serviceWorker.getRegistration().then(function (r) {
      return r || navigator.serviceWorker.register("./sw.js");
    }).then(function () { return navigator.serviceWorker.ready; });
  }

  // ---- classic browser push (VAPID): used as the fallback ----
  function send(sub) {
    var p = prefs();
    return call("/push/subscribe", "POST", { subscription: sub.toJSON(), preview: p.preview !== false, groups: p.groups !== false }, true);
  }

  // ---- Firebase Cloud Messaging for the browser ----
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.crossOrigin = "anonymous";
      s.onload = resolve; s.onerror = function () { reject(new Error("could not load " + src)); };
      document.head.appendChild(s);
    });
  }
  var fcmApp = null;
  // resolves to a Firebase messaging object, or null when this browser cannot use Firebase messaging
  function fcm() {
    var fb = window.firebase, cfg = (window.LETSCHAT_CONFIG || {}).FIREBASE;
    if (!fb || !fb.SDK_VERSION || parseInt(fb.SDK_VERSION, 10) < 9 || !cfg || !cfg.appId) return Promise.resolve(null);
    var ready = fb.messaging ? Promise.resolve() : loadScript("https://www.gstatic.com/firebasejs/" + fb.SDK_VERSION + "/firebase-messaging-compat.js");
    return ready.then(function () {
      if (!fb.messaging || !fb.messaging.isSupported || !fb.messaging.isSupported()) return null;
      if (!fcmApp) {
        var c = {}; for (var k in cfg) c[k] = cfg[k];
        // messaging needs the sender id, which is the project number inside the appId ("1:<number>:web:...")
        if (!c.messagingSenderId) c.messagingSenderId = String(c.appId).split(":")[1];
        try { fcmApp = fb.app("letschat-push"); } catch (e) { fcmApp = fb.initializeApp(c, "letschat-push"); }
      }
      return fcmApp.messaging();
    }).catch(function () { return null; });
  }
  // this device's Firebase token, using the app's own service worker (sw.js shows the notification); null when unavailable
  function fcmToken(reg) {
    return fcm().then(function (m) {
      if (!m) return null;
      return m.getToken({ serviceWorkerRegistration: reg }).then(function (t) { return t || null; });
    });
  }
  function sendFcm(t) {
    var p = prefs();
    return call("/push/subscribe", "POST", {
      subscription: { endpoint: FCM_PREFIX + t, keys: { p256dh: "fcm", auth: "fcm" } },
      preview: p.preview !== false, groups: p.groups !== false
    }, true);
  }
  function forget(endpoint) { return endpoint ? call("/push/unsubscribe", "POST", { endpoint: endpoint }, true).catch(noop) : Promise.resolve(); }

  // "unsupported" | "needs-install" | "denied" | "unavailable" | "off" | "on"
  function status() {
    if (!supported()) return Promise.resolve(isIOS() && !standalone() ? "needs-install" : "unsupported");
    if (Notification.permission === "denied") return Promise.resolve("denied");
    return registration().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (sub && Notification.permission === "granted") return "on";
      return call("/push/key", "GET").then(function () { return "off"; }, function () { return "unavailable"; });
    }).catch(function () { return "unsupported"; });
  }

  function enableVapid(reg) {
    return call("/push/key", "GET").then(function (r) {
      var key = toKey(r.key);
      return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).catch(function () {
        // an old subscription made with a different key: replace it
        return reg.pushManager.getSubscription().then(function (old) { return old ? old.unsubscribe() : null; })
          .then(function () { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); });
      });
    }).then(send);
  }

  function enable() {
    if (!supported()) return Promise.reject(new Error("Not supported in this browser"));
    return Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings.");
      return registration();
    }).then(function (reg) {
      var oldEndpoint = null;
      return reg.pushManager.getSubscription().then(function (old) { oldEndpoint = old && old.endpoint; }).catch(noop)
        .then(function () { return fcmToken(reg); })
        .then(function (t) {
          if (!t) throw new Error("no firebase token");
          return sendFcm(t).then(function () {
            storeFcm(t);
            // the browser now pushes through Firebase: drop the old classic subscription on the server so one message is not shown twice
            return oldEndpoint && oldEndpoint.indexOf(FCM_PREFIX) !== 0 ? forget(oldEndpoint) : null;
          });
        })
        .catch(function () { return enableVapid(reg); }); // Firebase not possible here: classic web push as before
    });
  }

  function disable() {
    var t = storedFcm();
    return registration().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      var work = Promise.resolve();
      if (t) {
        storeFcm(null);
        work = forget(FCM_PREFIX + t).then(function () { return fcm(); }).then(function (m) { return m ? m.deleteToken().catch(noop) : null; }).catch(noop);
      }
      return work.then(function () {
        return reg2(sub);
      });
    });
    function reg2(sub) {
      if (!sub) return null;
      var endpoint = sub.endpoint;
      return sub.unsubscribe().catch(noop).then(function () { return endpoint.indexOf(FCM_PREFIX) === 0 ? null : forget(endpoint); });
    }
  }

  // quietly keep the server's copy of this device's subscription fresh (and its preview/group choices)
  function sync() {
    if (!supported() || Notification.permission !== "granted" || !token()) return;
    registration().then(function (reg) {
      var saved = storedFcm();
      if (saved) {
        // Firebase tokens can change: fetch the current one and tell the server if it did
        return fcmToken(reg).then(function (t) {
          if (!t) return null;
          return sendFcm(t).then(function () {
            storeFcm(t);
            return t !== saved ? forget(FCM_PREFIX + saved) : null;
          });
        });
      }
      return reg.pushManager.getSubscription().then(function (sub) { if (sub && sub.endpoint.indexOf(FCM_PREFIX) !== 0) return send(sub); });
    }).catch(noop);
  }

  // called by the app after it connects its socket: tells the server when the app is in the background
  function watch(socket) {
    current = socket;
    var report = function () { if (current && current.connected) current.emit("app:visible", !document.hidden); };
    socket.on("connect", report);
    report();
    sync();
  }
  document.addEventListener("visibilitychange", function () { if (current && current.connected) current.emit("app:visible", !document.hidden); });

  window.LetschatPush = { status: status, enable: enable, disable: disable, watch: watch, sync: sync };
})();
