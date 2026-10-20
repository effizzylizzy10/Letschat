// Point these at your deployed server (see server/README section in the
// repo README). For local testing with the server running on your machine,
// the localhost defaults work as long as your phone and computer are on the
// same Wi-Fi and you swap "localhost" for your computer's LAN IP.
window.LETSCHAT_CONFIG = {
  // Paste these from Firebase console > Project settings > Your apps > Web app
  FIREBASE: {
    apiKey: "AIzaSyBclbDUzqSszcj205NKxczMCNJ2qPi6Q3g",
    authDomain: "letschatafrica-1df0c.firebaseapp.com",
    projectId: "letschatafrica-1df0c",
    appId: "1:94043215929:web:bd78737d35864a578f95e8",
  },
  API_URL: "https://letschat-9tw4.onrender.com",
  SOCKET_URL: "https://letschat-9tw4.onrender.com",
  // Help screen > Contact us. Fill in at least one so people can reach you (WhatsApp number with country code, digits only).
  // The "Click Here" button on the Update Available screen opens this link (it is never shown on screen).
  // Put your APK / Play Store / website link here. Before opening it the app clears its saved copy so the newest version loads.
  UPDATE_URL: "https://letschatafrican.netlify.app/",
  SUPPORT_WHATSAPP: "",
  SUPPORT_EMAIL: "",
  // Video/voice calls and Letschat Live: ICE servers. STUN is free and always on. TURN helps people on strict mobile networks connect.
  // WITHOUT TURN, two phones on different mobile networks (MTN, Airtel, Glo, 9mobile) often cannot send video to each other: the other
  // person's tile stays blank. Pick ONE way to add TURN:
  //  (A) easiest: make a free account at https://dashboard.metered.ca/signup, create an app, then paste its credentials link below:
  //      TURN_API_URL: "https://YOUR-APP.metered.live/api/v1/turn/credentials?apiKey=YOUR-API-KEY"
  //  (B) or fill the three TURN fields from any TURN provider; leave them empty to use STUN only.
  TURN_API_URL: "",
  TURN_URLS: ["turn:global.relay.metered.ca:80", "turn:global.relay.metered.ca:80?transport=tcp", "turn:global.relay.metered.ca:443", "turns:global.relay.metered.ca:443?transport=tcp"],       // example: ["turn:YOUR-HOST:80", "turn:YOUR-HOST:443", "turns:YOUR-HOST:443?transport=tcp"]
  TURN_USERNAME: "8f215cb15677689cf70bd4cd",
  TURN_CREDENTIAL: "yVfMcYXCv+P9+A7N",
};
// Builds ICE_SERVERS from the fields above (app.js and live.js read window.LETSCHAT_CONFIG.ICE_SERVERS).
(function (c) {
  var ice = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "stun:stun.relay.metered.ca:80" }];
  if (c.TURN_URLS && c.TURN_URLS.length && c.TURN_USERNAME && c.TURN_CREDENTIAL) ice.push({ urls: c.TURN_URLS, username: c.TURN_USERNAME, credential: c.TURN_CREDENTIAL });
  if (!c.ICE_SERVERS) c.ICE_SERVERS = ice;
})(window.LETSCHAT_CONFIG);

// ---- Video fixes for Letschat Live and calls (livefix16) ----
// 1) Relay: every new video connection gets the TURN servers (from TURN_API_URL or the TURN_* fields, or a free public relay as a last resort),
//    so video reaches people on strict mobile networks instead of showing a blank tile.
// 2) Autoplay: a video that the phone refuses to start with sound is started muted and un-muted on the next tap, instead of staying black.
(function (c) {
  var Native = window.RTCPeerConnection || window.webkitRTCPeerConnection;
  var fetched = [];                                   // TURN servers returned by TURN_API_URL
  var own = !!(c.TURN_URLS && c.TURN_URLS.length && c.TURN_USERNAME && c.TURN_CREDENTIAL);
  // free public relay: only used when no TURN of your own is set up (shared, may be slow or limited; set up TURN_API_URL for steady results)
  var shared = [{ urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" }];
  var keyOf = function (s) { return [].concat(s && s.urls ? s.urls : []).join("|"); };
  function servers(base) {
    var out = [], seen = {}, all = (base || []).concat(fetched, own || fetched.length ? [] : shared);
    for (var i = 0; i < all.length; i++) { var s = all[i], k = keyOf(s); if (!s || !k || seen[k]) continue; seen[k] = 1; out.push(s); }
    return out;
  }
  if (Native && !Native.__lcRelay) {
    var Wrapped = function (cfg, opts) {
      var conf = {}, k;
      for (k in (cfg || {})) conf[k] = cfg[k];
      conf.iceServers = servers(conf.iceServers && conf.iceServers.length ? conf.iceServers : (c.ICE_SERVERS || []));
      return opts === undefined ? new Native(conf) : new Native(conf, opts);
    };
    Wrapped.prototype = Native.prototype;
    if (Native.generateCertificate) Wrapped.generateCertificate = function () { return Native.generateCertificate.apply(Native, arguments); };
    Wrapped.__lcRelay = true;
    window.RTCPeerConnection = Wrapped;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = Wrapped;
  }
  if (c.TURN_API_URL && window.fetch) {
    var load = function () {
      fetch(c.TURN_API_URL).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
        if (list && !Array.isArray(list) && Array.isArray(list.iceServers)) list = list.iceServers;
        if (Array.isArray(list)) fetched = list.filter(function (s) { return s && s.urls; });
      }).catch(function () {});
    };
    load();
    setInterval(load, 6 * 60 * 60 * 1000);              // credentials are refreshed while the app stays open
  }

  // videos (live, meetings, calls) that were blocked from starting: start them muted, then un-mute on the next tap
  function unmuteOnTap(v) {
    if (v.__lcTap) return; v.__lcTap = true;
    var go = function () {
      document.removeEventListener("pointerdown", go, true); document.removeEventListener("touchstart", go, true); document.removeEventListener("click", go, true);
      v.__lcTap = false;
      try { v.muted = false; var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    };
    document.addEventListener("pointerdown", go, true); document.addEventListener("touchstart", go, true); document.addEventListener("click", go, true);
  }
  setInterval(function () {
    try {
      if (document.hidden) return;
      var vs = document.querySelectorAll("video[data-lcrec]");
      for (var i = 0; i < vs.length; i++) {
        (function (v) {
          if (!v.srcObject || !v.paused) return;
          var p = v.play();
          if (p && p.catch) p.catch(function () {
            if (v.muted) return;
            v.muted = true;
            var p2 = v.play(); if (p2 && p2.catch) p2.catch(function () {});
            unmuteOnTap(v);
          });
        })(vs[i]);
      }
    } catch (e) {}
  }, 1000);
})(window.LETSCHAT_CONFIG);
