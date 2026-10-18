// Letschat Africa: web push helper (plain JS, loads before the app).
// The app uses it from Tools > Notifications > "Push notifications".
(function () {
  var API = (window.LETSCHAT_CONFIG || {}).API_URL;
  var current = null; // socket of the logged-in session

  function token() { try { var s = JSON.parse(localStorage.getItem("letschat-africa:session")); return s && s.token; } catch (e) { return null; } }
  function prefs() { try { return JSON.parse(localStorage.getItem("letschat-africa:notifs")) || {}; } catch (e) { return {}; } }
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
  function send(sub) {
    var p = prefs();
    return call("/push/subscribe", "POST", { subscription: sub.toJSON(), preview: p.preview !== false, groups: p.groups !== false }, true);
  }

  // "unsupported" | "needs-install" | "denied" | "unavailable" | "off" | "on"
  function status() {
    if (!supported()) return Promise.resolve(isIOS() && !standalone() ? "needs-install" : "unsupported");
    if (Notification.permission === "denied") return Promise.resolve("denied");
    return registration().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (sub && Notification.permission === "granted") return "on";
      return call("/push/key", "GET").then(function () { return "off"; }, function () { return "unavailable"; });
    }).catch(function () { return "unsupported"; });
  }

  function enable() {
    if (!supported()) return Promise.reject(new Error("Not supported in this browser"));
    return Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings.");
      return Promise.all([call("/push/key", "GET"), registration()]);
    }).then(function (r) {
      var key = toKey(r[0].key), reg = r[1];
      return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).catch(function () {
        // an old subscription made with a different key: replace it
        return reg.pushManager.getSubscription().then(function (old) { return old ? old.unsubscribe() : null; })
          .then(function () { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); });
      });
    }).then(send);
  }

  function disable() {
    return registration().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return null;
      var endpoint = sub.endpoint;
      return sub.unsubscribe().then(function () { return call("/push/unsubscribe", "POST", { endpoint: endpoint }, true).catch(function () {}); });
    });
  }

  // quietly keep the server's copy of this device's subscription fresh (and its preview/group choices)
  function sync() {
    if (!supported() || Notification.permission !== "granted" || !token()) return;
    registration().then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) { if (sub) return send(sub); }).catch(function () {});
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
