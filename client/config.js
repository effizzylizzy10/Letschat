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

// ---- Chats / Updates tabs: the floating buttons slide into the big button before the tab changes (like WhatsApp) ----
// Chats: the LetsChat AI robot slides down into the new-chat pencil button, THEN the next tab opens.
// Updates: the small text-status pencil slides down into the camera button, THEN the next tab opens.
// Coming back to Chats / Updates the small button slides out of the big one again (the big one grows back a little).
// Speed and easing are measured from the WhatsApp recording: about 140 ms in, 170 ms out, ease-in-out, 68 px. The tab opens 150 ms after the tap.
// It is drawn with the Web Animations API (element.animate), so it stays visible when the phone has "remove animations" on
// (the app switches every CSS animation and transition off in that case). Tiny screens (lc-small) and browsers without element.animate
// simply change tab at once, as before. To obey "remove animations" too, add  matchMedia("(prefers-reduced-motion: reduce)").matches  to can().
(function () {
  var EXIT_MS = 140, ENTER_MS = 170, POP_MS = 150, HOLD_MS = 150;
  var EASE = "cubic-bezier(.42,0,.58,1)", POP_EASE = "cubic-bezier(.2,.8,.2,1)";
  var MINI = 'button[aria-label="Chat with LetsChat AI"], button[aria-label="Text status"]';   // the little button of each tab
  var lastTap = 0;     // when a tab was last tapped (or Back pressed): only a screen that opens right after that gets the slide-out
  var pending = null;  // while the little button slides in: { origin, target, mini, main, anims, timer }

  // the camera button must stay in front of the pencil while the pencil slides behind it (the Chats pencil button already is)
  try {
    var css = document.createElement("style");
    css.setAttribute("data-lc", "fabtabs");
    css.textContent = 'button[aria-label="Text status"]+button{position:relative}';
    (document.head || document.documentElement).appendChild(css);
  } catch (e) {}

  function can() { return !!(Element.prototype.animate && !document.documentElement.classList.contains("lc-small")); }
  function mainOf(mini) { var n = mini.nextElementSibling; while (n && n.tagName !== "BUTTON") n = n.nextElementSibling; return n; }
  // where the big button sits compared with the little one (the little one slides until the two are centred on each other); 68 px straight down by default
  function toMain(mini, main) {
    var x = 0, y = 68;
    try {
      if (main && main.offsetParent === mini.offsetParent) {
        x = (main.offsetLeft + main.offsetWidth / 2) - (mini.offsetLeft + mini.offsetWidth / 2);
        y = (main.offsetTop + main.offsetHeight / 2) - (mini.offsetTop + mini.offsetHeight / 2);
      }
    } catch (e) {}
    return "translate(" + x + "px," + y + "px)";
  }

  // leaving: the little button slides down behind the big one (it only fades in the last moment, to hide its glow)
  function slideIn(mini, main) {
    var anims = [];
    try {
      mini.style.pointerEvents = "none"; if (main) main.style.pointerEvents = "none";
      anims.push(mini.animate([{ opacity: 1, offset: 0.85 }, { transform: toMain(mini, main), opacity: 0, offset: 1 }], { duration: EXIT_MS, easing: EASE, fill: "forwards" }));
    } catch (e) {}
    return anims;
  }
  // arriving: the little button slides up out from behind the big one, which grows back from 82 %
  function slideOut(mini) {
    var main = mainOf(mini);
    try {
      mini.animate([{ transform: toMain(mini, main), opacity: 0, offset: 0 }, { opacity: 1, offset: 0.3 }, { transform: "translate(0px,0px)", opacity: 1, offset: 1 }], { duration: ENTER_MS, easing: EASE, fill: "backwards" });
      if (main) main.animate([{ transform: "scale(0.82)" }, { transform: "scale(1)" }], { duration: POP_MS, easing: POP_EASE, fill: "backwards" });
    } catch (e) {}
  }

  // the little button has slid in: now let the tab change happen
  function finish() {
    var p = pending; pending = null;
    if (!p || !p.target) return;
    var t = p.target;
    try { t.__lcFabPass = true; t.click(); } catch (e) {}
    setTimeout(function () { t.__lcFabPass = false; }, 0);
  }
  // the tab we were still on was tapped again: slide the little button back out and stay
  function cancel() {
    var p = pending; pending = null;
    if (!p) return;
    clearTimeout(p.timer);
    for (var i = 0; i < p.anims.length; i++) {
      (function (a) { try { a.onfinish = function () { a.cancel(); }; a.reverse(); } catch (e) {} })(p.anims[i]);
    }
    try { p.mini.style.pointerEvents = ""; if (p.main) p.main.style.pointerEvents = ""; } catch (e) {}
  }

  // tab taps
  document.addEventListener("click", function (e) {
    var tab = e.target && e.target.closest && e.target.closest(".lc-tab");
    if (!tab) return;
    try {
      if (tab.__lcFabPass) { tab.__lcFabPass = false; lastTap = Date.now(); return; }   // our own tap, sent after the slide-in
      if (pending) {                                    // the little button is already sliding in
        e.stopPropagation(); e.preventDefault();
        if (tab === pending.origin) cancel();           // the tab we are still on: stay
        else pending.target = tab;                      // another tab: go there instead
        return;
      }
      lastTap = Date.now();
      if (tab.classList.contains("on") || !can()) return;
      var mini = document.querySelector(MINI);
      if (!mini || !mini.getClientRects().length) return;   // this tab has no floating button: change tab at once
      var main = mainOf(mini), anims = slideIn(mini, main);
      pending = { origin: document.querySelector(".lc-tab.on"), target: tab, mini: mini, main: main, anims: anims, timer: setTimeout(finish, HOLD_MS) };
      e.stopPropagation(); e.preventDefault();          // hold the tab change until the little button has slid in
    } catch (err) {}
  }, true);

  // Android Back from Calls / Updates / ... to Chats: the tab changes at once, but the little button still slides out
  window.addEventListener("popstate", function () {
    try {
      var on = document.querySelector(".lc-tab.on"), first = document.querySelector(".lc-tab");
      if (on && first && on !== first) lastTap = Date.now();
    } catch (e) {}
  }, true);

  // a screen with a little button was just added right after a tab tap: slide the button out of the big one
  function arrived(node) {
    if (node.nodeType !== 1 || Date.now() - lastTap > 800) return;
    var mini = node.matches && node.matches(MINI) ? node : (node.querySelector && node.querySelector(MINI));
    if (!mini || mini.__lcSeen || !can()) return;
    mini.__lcSeen = true;
    slideOut(mini);
  }
  function start() {
    try {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) for (var j = 0; j < list[i].addedNodes.length; j++) arrived(list[i].addedNodes[j]);
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
