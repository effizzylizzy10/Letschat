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
  UPDATE_URL: "https://letschat-taupe.vercel.app/",
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

// ---- Updates tab: small pencil button <-> camera (fabmorph2) ----
// Leaving the Updates tab: the small pencil button on that screen spins and turns into a camera, then the app switches tab.
// Coming back to the Updates tab: the button shows the camera and it spins back into the pencil.
// Uses the Web Animations API, so it stays visible even when the phone has "remove animations" on.
(function () {
  var clickAt = 0;
  var PENCIL = '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
  var CAMERA = '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>';
  var SEL = 'button[aria-label="Text status"]';
  var IN = [
    { transform: "rotate(-220deg) scale(0)", opacity: 0, offset: 0 },
    { transform: "rotate(-220deg) scale(0)", opacity: 0, offset: 0.35 },
    { transform: "rotate(10deg) scale(1.3)", opacity: 1, offset: 0.75 },
    { transform: "rotate(0deg) scale(1)", opacity: 1, offset: 1 }
  ];
  var OUT = [
    { transform: "rotate(0deg) scale(1)", opacity: 1, offset: 0 },
    { transform: "rotate(220deg) scale(1.2)", opacity: 1, offset: 0.3 },
    { transform: "rotate(260deg) scale(0)", opacity: 0, offset: 0.55 },
    { transform: "rotate(260deg) scale(0)", opacity: 0, offset: 1 }
  ];
  function icon(inner, color, size) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">' + inner + '</svg>';
  }
  function small() { return document.documentElement.classList.contains("lc-small"); }

  // leaving=true: the pencil (real icon) spins out and a camera spins in. leaving=false: a camera spins out and the pencil spins in.
  function morph(btn, leaving, done) {
    var fired = false;
    function finish() { if (fired) return; fired = true; if (done) done(); }
    if (!btn.animate || btn.__lcMorphing) { finish(); return; }
    btn.__lcMorphing = true;
    var ms = leaving ? 750 : 1000, ease = "cubic-bezier(.2,.8,.2,1)";
    var prevPos = btn.style.position;
    if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
    var ghost = document.createElement("span");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none";
    ghost.innerHTML = icon(CAMERA, "#06210F", 24);
    btn.appendChild(ghost);
    var kids = [].slice.call(btn.children).filter(function (k) { return k !== ghost; });
    var bgPen = "#1F2630", bgCam = "#21C063";
    kids.forEach(function (k) {
      k.animate(leaving ? OUT : IN, { duration: ms, easing: "ease-in-out", fill: "forwards" });
    });
    var g = ghost.animate(leaving ? IN : OUT, { duration: ms, easing: "ease-in-out", fill: "forwards" });
    btn.animate([
      { backgroundColor: leaving ? bgPen : bgCam, transform: "scale(.85)", offset: 0 },
      { backgroundColor: leaving ? bgPen : bgCam, transform: "scale(1.25)", offset: 0.45 },
      { backgroundColor: leaving ? bgCam : bgPen, transform: "scale(1)", offset: 1 }
    ], { duration: ms, easing: ease, fill: leaving ? "forwards" : "none" });
    btn.animate([
      { boxShadow: "0 0 0 0 rgba(33,192,99,.6)", offset: 0 },
      { boxShadow: "0 0 0 22px rgba(0,0,0,0)", offset: 1 }
    ], { duration: ms * 0.8, delay: ms * 0.25, easing: "ease-out" });
    function cleanup() {
      try {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
        btn.getAnimations().forEach(function (a) { a.cancel(); });
        kids.forEach(function (k) { k.getAnimations().forEach(function (a) { a.cancel(); }); });
        btn.style.position = prevPos;
      } catch (e) {}
      btn.__lcMorphing = false;
    }
    g.onfinish = function () {
      finish();
      if (leaving) setTimeout(cleanup, 400); else cleanup();   // when leaving, the screen is replaced right after
    };
    setTimeout(finish, ms + 150);                                // never leave the tab stuck
  }

  // tab taps
  document.addEventListener("click", function (e) {
    var t = e.target, tab = t && t.closest && t.closest(".lc-tab");
    if (!tab) return;
    if (tab.__lcPass) { tab.__lcPass = false; clickAt = Date.now(); return; }
    clickAt = Date.now();
    var fab = document.querySelector(SEL);
    if (!fab || tab.classList.contains("on") || small() || !fab.animate || fab.__lcMorphing) return;
    e.stopPropagation(); e.preventDefault();       // hold the tab switch until the pencil has turned into the camera
    morph(fab, true, function () { tab.__lcPass = true; tab.click(); });
  }, true);

  // coming back to Updates: the small button appears right after a tab tap
  function check(el) {
    if (el.nodeType !== 1 || Date.now() - clickAt > 1500 || small()) return;
    var b = el.matches && el.matches(SEL) ? el : el.querySelector && el.querySelector(SEL);
    if (b && !b.__lcSeen) { b.__lcSeen = true; morph(b, false); }
  }
  function start() {
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) check(ms[i].addedNodes[j]);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
