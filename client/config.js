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

// ---- Tab icon morph (fabmorph1) ----
// Switching to the Updates tab: the pencil button turns into the green camera button (the pencil spins away, the camera spins in).
// Switching back to the Chats tab: the camera turns back into the pencil. Uses the Web Animations API, so it stays visible even when the
// phone has "remove animations" on, and it only plays right after a tab tap (never on app start, search or scrolling).
(function () {
  var clickAt = 0;
  var PENCIL = '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
  var CAMERA = '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>';
  function icon(inner, color, size) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">' + inner + '</svg>';
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest(".lc-tab")) clickAt = Date.now();
  }, true);

  // btn: the round button. ghost: the old icon that spins away. The button's own icon spins in. glow: colour of the ring that pulses out.
  function morph(btn, ghostHtml, bgFrom, bgTo, glow) {
    if (!btn.animate || btn.__lcMorphing) return;
    btn.__lcMorphing = true;
    var ms = 1000, ease = "cubic-bezier(.2,.8,.2,1)";
    var prevPos = btn.style.position;
    if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
    var ghost = document.createElement("span");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none";
    ghost.innerHTML = ghostHtml;
    btn.appendChild(ghost);
    var kids = [].slice.call(btn.children).filter(function (k) { return k !== ghost; });
    // new icon: hidden for the first part, then spins in and overshoots
    kids.forEach(function (k) {
      k.animate([
        { transform: "rotate(-220deg) scale(0)", opacity: 0, offset: 0 },
        { transform: "rotate(-220deg) scale(0)", opacity: 0, offset: 0.35 },
        { transform: "rotate(10deg) scale(1.3)", opacity: 1, offset: 0.75 },
        { transform: "rotate(0deg) scale(1)", opacity: 1, offset: 1 }
      ], { duration: ms, easing: ease });
    });
    // old icon: spins away and shrinks
    var a = ghost.animate([
      { transform: "rotate(0deg) scale(1)", opacity: 1, offset: 0 },
      { transform: "rotate(220deg) scale(1.2)", opacity: 1, offset: 0.3 },
      { transform: "rotate(260deg) scale(0)", opacity: 0, offset: 0.55 },
      { transform: "rotate(260deg) scale(0)", opacity: 0, offset: 1 }
    ], { duration: ms, easing: "ease-in-out", fill: "forwards" });
    // the button: squeezes, grows, changes colour and sends out a ring
    btn.animate([
      { backgroundColor: bgFrom, transform: "scale(.82)", offset: 0 },
      { backgroundColor: bgFrom, transform: "scale(1.2)", offset: 0.45 },
      { backgroundColor: bgTo, transform: "scale(1)", offset: 1 }
    ], { duration: ms, easing: ease });
    btn.animate([
      { boxShadow: "0 0 0 0 " + glow, offset: 0 },
      { boxShadow: "0 0 0 22px rgba(0,0,0,0)", offset: 1 }
    ], { duration: ms * 0.8, delay: ms * 0.3, easing: "ease-out" });
    a.onfinish = a.oncancel = function () {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      btn.style.position = prevPos;
      btn.__lcMorphing = false;
    };
  }

  function check(el) {
    if (el.nodeType !== 1 || Date.now() - clickAt > 1500) return;
    if (document.documentElement.classList.contains("lc-small")) return; // small keypad phones: no effects
    var q = el.matches && el.matches('button[aria-label="Add status"]') ? el : el.querySelector && el.querySelector('button[aria-label="Add status"]');
    if (q && !q.__lcSeen) { q.__lcSeen = true; morph(q, icon(PENCIL, "#06210F", 28), "#35D0BA", "#21C063", "rgba(33,192,99,.55)"); }
    var p = el.querySelector && el.querySelector('button > svg > path[d="M12 20h9"]');
    var b = p && p.closest("button");
    if (b && b.style.bottom === "78px" && !b.__lcSeen) { b.__lcSeen = true; morph(b, icon(CAMERA, "#0E1116", 24), "#21C063", "#35D0BA", "rgba(53,208,186,.55)"); }
  }
  function start() {
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) check(ms[i].addedNodes[j]);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
