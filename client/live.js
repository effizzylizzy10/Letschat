// Letschat Live (plain JS, loads after the app like reactions.js): Go Live, Live Meeting with a join code, live comments,
// gifts, live stickers and emojis, reactions on comments, replies and @mentions.
// The app mounts window.LetschatLive.Screen once (see the "live" tab in app.js). Video is peer-to-peer WebRTC through the
// server's live:* events (server/client/live.js).
(function () {
  if (!window.React) return;
  window.LETSCHAT_LIVE_BUILD = "livefix14"; // lets you confirm which live.js a phone is running (open the site, then type LETSCHAT_LIVE_BUILD in the console, or search /live.js for livefix11)
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useCallback = React.useCallback;
  var ICE = (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.ICE_SERVERS) || [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
  var C = { bg: "#0B0F16", card: "#161B22", line: "#262E3A", text: "#F5F7FA", dim: "#9BA7B4", teal: "#35D0BA", red: "#FF3B5C", purple: "#7C5CFF" };
  var STICKERS = [["fire", "\uD83D\uDD25"], ["100", "\uD83D\uDCAF"], ["heart", "\uD83D\uDC96"], ["laugh", "\uD83D\uDE02"], ["crown", "\uD83D\uDC51"], ["wow", "WOW!"], ["panda", "\uD83D\uDC3C"], ["clap", "\uD83D\uDC4F"], ["love", "\u2764\uFE0F"], ["rocket", "\uD83D\uDE80"], ["gg", "GG"], ["angry", "\uD83D\uDE21"], ["cry", "\uD83D\uDE2D"], ["party", "\uD83E\uDD73"], ["kiss", "\uD83D\uDE18"]];
  // [id, glyph, name, tier]: tier 1 = small (floats up), 2 = big animation in the middle, 3 = full-screen show
  var GIFTS = [["rose", "\uD83C\uDF39", "Rose", 1], ["handheart", "\uD83E\uDD32", "Hand Heart", 2], ["lightning", "\u26A1", "Lightning", 1], ["doughnut", "\uD83C\uDF69", "Doughnut", 1], ["heart", "\uD83D\uDC96", "Heart", 1], ["star", "\u2B50", "Star", 1], ["icecream", "\uD83C\uDF66", "Ice Cream", 1], ["coffee", "\u2615", "Coffee", 1],
    ["bear", "\uD83E\uDDF8", "Bear", 2], ["crown", "\uD83D\uDC51", "Crown", 2], ["diamond", "\uD83D\uDC8E", "Diamond", 2], ["car", "\uD83D\uDE97", "Car", 2], ["rocket", "\uD83D\uDE80", "Rocket", 2], ["trophy", "\uD83C\uDFC6", "Trophy", 2], ["ring", "\uD83D\uDC8D", "Ring", 2], ["moneybag", "\uD83D\uDCB0", "Money Bag", 2],
    ["lion", "\uD83E\uDD81", "Lion", 3], ["castle", "\uD83C\uDFF0", "Castle", 3], ["jet", "\u2708\uFE0F", "Jet", 3], ["fireworks", "\uD83C\uDF86", "Fireworks", 3], ["dragon", "\uD83D\uDC09", "Dragon", 3], ["ship", "\uD83D\uDEA2", "Ship", 3], ["galaxy", "\uD83C\uDF0C", "Galaxy", 3]];
  var LAYOUTS = [["side", "Host + guests"], ["grid", "Gallery"], ["spot", "Spotlight"]]; // meeting video templates
  var EMOJIS = ["\uD83D\uDC4D", "\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83D\uDE22", "\uD83D\uDE21", "\uD83D\uDD25", "\uD83D\uDCAF", "\uD83D\uDC4F", "\uD83C\uDF89", "\uD83D\uDE0D", "\uD83D\uDE4C"];
  // Video effects. Phones that support canvas filters get all of them; others get the pixel-based ones (no Soft).
  var EFFECTS = [["none", "Normal", ""], ["bw", "B&W", "grayscale(1) contrast(1.1)"], ["sepia", "Sepia", "sepia(.9)"], ["warm", "Warm", "sepia(.35) saturate(1.3) hue-rotate(-10deg)"], ["cool", "Cool", "hue-rotate(25deg) saturate(1.15) brightness(1.05)"],
    ["vivid", "Vivid", "saturate(1.8) contrast(1.1)"], ["vintage", "Vintage", "sepia(.6) contrast(.9) brightness(1.1)"], ["soft", "Soft", "blur(2px) brightness(1.1) saturate(1.1)"], ["neon", "Neon", "invert(1) hue-rotate(180deg) saturate(2)"]];
  var FILTER_OK = (function () { try { var c = document.createElement("canvas").getContext("2d"); c.filter = "grayscale(1)"; return c.filter === "grayscale(1)"; } catch (e) { return false; } })();
  var CAN_PIPE = (function () { try { return typeof document.createElement("canvas").captureStream === "function"; } catch (e) { return false; } })();
  var EFFECT_LIST = FILTER_OK ? EFFECTS : EFFECTS.filter(function (e) { return e[0] !== "soft"; });
  // sharper video: sets the most data each sender may send (a clear picture needs this, not just a big camera size)
  function tuneSender(pc, maxVideo) {
    try {
      pc.getSenders().forEach(function (s) {
        if (!s.track || !s.getParameters) return;
        var p = s.getParameters();
        if (!p.encodings || !p.encodings.length) p.encodings = [{}];
        p.encodings[0].maxBitrate = s.track.kind === "video" ? maxVideo : 128000;
        if (s.track.kind === "video") { p.degradationPreference = "balanced"; try { s.track.contentHint = "motion"; } catch (e) {} }
        s.setParameters(p).catch(function () {});
      });
    } catch (e) {}
  }
  var SCREEN_OK = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  var clamp = function (v) { return v < 0 ? 0 : v > 255 ? 255 : v; };
  function pixelFx(d, name) {
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2], gr, avg;
      if (name === "bw") { gr = 0.3 * r + 0.59 * g + 0.11 * b; r = g = b = clamp((gr - 128) * 1.1 + 128); }
      else if (name === "sepia" || name === "vintage") { var k = name === "sepia" ? 0.9 : 0.6, sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b; r = r + (sr - r) * k; g = g + (sg - g) * k; b = b + (sb - b) * k; if (name === "vintage") { r *= 1.08; g *= 1.08; b *= 1.08; } }
      else if (name === "warm") { r *= 1.1; b *= 0.9; }
      else if (name === "cool") { r *= 0.9; b *= 1.1; }
      else if (name === "vivid") { avg = (r + g + b) / 3; r = avg + (r - avg) * 1.7; g = avg + (g - avg) * 1.7; b = avg + (b - avg) * 1.7; }
      else if (name === "neon") { r = 255 - r; g = 255 - g; b = 255 - b; avg = (r + g + b) / 3; r = avg + (r - avg) * 2; g = avg + (g - avg) * 2; b = avg + (b - avg) * 2; }
      d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
    }
  }
  var giftDef = function (id) { for (var i = 0; i < GIFTS.length; i++) if (GIFTS[i][0] === id) return GIFTS[i]; return null; };
  var fmt = function (n) { n = n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(n); };
  var giftArt = function (id, size) {
    var gd = giftDef(id), g = gd ? gd[1] : id;
    if (id === "handheart") return h("span", { style: { display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1, height: size, width: size } }, h("span", { style: { fontSize: size * 0.58, marginBottom: -size * 0.12, position: "relative", zIndex: 1 } }, "\uD83D\uDC99"), h("span", { style: { fontSize: size * 0.7 } }, g));
    return g;
  };
  var glyph = function (list, key) { for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][1]; return key; };

  // ---- icons for the Go Live screen (inline SVG, so they look the same on every phone) ----
  var ICON_PATHS = {
    share: "M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z",
    heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    gift: "M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z",
    person: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    cam: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z",
    people: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
    eye: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
  };
  function Ico(name, size, color) { return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, "aria-hidden": "true", focusable: "false", style: { display: "block", flexShrink: 0 } }, h("path", { d: ICON_PATHS[name] })); }
  function ChatIco(size, color) { return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", focusable: "false", style: { display: "block", flexShrink: 0 } }, h("path", { d: "M5 3.5h14a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 5 3.5z", stroke: color, strokeWidth: 1.8, strokeLinejoin: "round" }), [8, 12, 16].map(function (x) { return h("circle", { key: x, cx: x, cy: 10.5, r: 1.5, fill: color }); })); }
  function HeartOutline(size, color) { return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", focusable: "false", style: { display: "block", flexShrink: 0 } }, h("path", { d: ICON_PATHS.heart, stroke: color, strokeWidth: 2, strokeLinejoin: "round" })); }
  function MoreIco(size, color) { return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, "aria-hidden": "true", focusable: "false", style: { display: "block" } }, [5, 12, 19].map(function (y) { return h("circle", { key: y, cx: 12, cy: y, r: 2 }); })); }
  function SmileIco(size, color) { return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", focusable: "false", style: { display: "block" } }, h("circle", { cx: 12, cy: 12, r: 9.5, stroke: color, strokeWidth: 1.8 }), h("circle", { cx: 9, cy: 10, r: 1.2, fill: color }), h("circle", { cx: 15, cy: 10, r: 1.2, fill: color }), h("path", { d: "M7.8 14.2c1 1.8 2.5 2.7 4.2 2.7s3.2-.9 4.2-2.7", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" })); }
  function RecIco(size, bg) { return h("svg", { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", style: { display: "block" } }, h("rect", { x: 1, y: 1, width: 22, height: 22, rx: 6, fill: bg }), h("g", { transform: "translate(5.2 5.2) scale(.6)", fill: "#fff" }, h("path", { d: ICON_PATHS.cam }))); }

  // animations (skipped when the phone asks for reduced motion)
  (function css() {
    if (document.getElementById("lc-live-css")) return;
    var s = document.createElement("style"); s.id = "lc-live-css";
    s.textContent = "@keyframes lcBigFloat{0%{transform:translateY(0) scale(.2);opacity:0}10%{transform:translateY(-24px) scale(1.3);opacity:1}22%{transform:translateY(-34px) scale(1)}80%{transform:translateY(-150px) scale(1);opacity:1}100%{transform:translateY(-230px) scale(1.05);opacity:0}}@keyframes lcFloat{0%{transform:translateY(0) scale(.7);opacity:0}15%{opacity:1}100%{transform:translateY(-260px) scale(1.25);opacity:0}}" +
      "@keyframes lcGift{0%{transform:scale(.4);opacity:0}15%{transform:scale(1.1);opacity:1}80%{opacity:1}100%{transform:scale(1);opacity:0}}" +
      "@keyframes lcBubble{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:var(--lc-o,.5)}50%{transform:translate(var(--lc-dx,-14px),-45vh) scale(1)}100%{transform:translate(calc(var(--lc-dx,-14px) * -1),-95vh) scale(1.15);opacity:0}}" +
      "@media (prefers-reduced-motion:reduce){.lc-bubble{display:none!important}}" +
      "@keyframes lcPulse{0%,100%{opacity:1}50%{opacity:.45}}" +
      "@media (prefers-reduced-motion:reduce){.lc-fx,.lc-gift,.lc-pulse{animation:none!important}.lc-anim,.lc-anim:after{animation:none!important}.lc-anim:after{display:none}}" +
      ".lc-anim{display:inline-block;position:relative;transform-origin:50% 60%;animation:lcPop2 1s ease-in-out infinite}" +
      "@keyframes lcPop2{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}" +
      "@keyframes lcWow{0%,100%{transform:scale(1) rotate(0)}25%{transform:scale(1.22) rotate(-9deg)}55%{transform:scale(1.1) rotate(8deg)}80%{transform:scale(1.15) rotate(-4deg)}}" +
      "@keyframes lcFlame{0%,100%{transform:scale(1,1) skewX(0);filter:drop-shadow(0 0 6px #ff7a00)}25%{transform:scale(.92,1.15) skewX(5deg)}50%{transform:scale(1.05,.95) skewX(-4deg);filter:drop-shadow(0 0 12px #ffb300)}75%{transform:scale(.95,1.12) skewX(3deg)}}" +
      "@keyframes lcBeat{0%,60%,100%{transform:scale(1)}15%{transform:scale(1.2)}30%{transform:scale(1)}45%{transform:scale(1.25)}}" +
      "@keyframes lcShake{0%,100%{transform:translateY(0) rotate(0)}20%{transform:translateY(-6px) rotate(-12deg)}40%{transform:translateY(0) rotate(10deg)}60%{transform:translateY(-6px) rotate(-10deg)}80%{transform:translateY(0) rotate(8deg)}}" +
      "@keyframes lcSpinY{0%{transform:rotateY(0) translateY(0)}50%{transform:rotateY(180deg) translateY(-8px)}100%{transform:rotateY(360deg) translateY(0)}}" +
      "@keyframes lcWiggle{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}" +
      "@keyframes lcClap{0%,100%{transform:scale(1,1) rotate(-8deg)}50%{transform:scale(.8,1.15) rotate(8deg)}}" +
      "@keyframes lcRocket{0%,100%{transform:translate(0,0) rotate(-4deg)}25%{transform:translate(3px,-5px) rotate(3deg)}50%{transform:translate(-2px,-9px) rotate(-3deg)}75%{transform:translate(3px,-4px) rotate(4deg)}}" +
      "@keyframes lcAngry{0%,100%{transform:translateX(0) scale(1.12);filter:drop-shadow(0 0 8px #ff1744)}25%{transform:translateX(-5px) scale(1.12)}75%{transform:translateX(5px) scale(1.12)}}" +
      "@keyframes lcCry{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(5px) rotate(3deg)}}" +
      "@keyframes lcTear{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(0,46px);opacity:0}}" +
      "@keyframes lcSpinJump{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-12px) rotate(180deg) scale(1.2)}}" +
      ".lc-a-wow{animation:lcWow .9s ease-in-out infinite}.lc-a-fire{animation:lcFlame .5s ease-in-out infinite}.lc-a-100{animation:lcPop2 .55s ease-in-out infinite}" +
      ".lc-a-heart,.lc-a-love{animation:lcBeat .9s ease-in-out infinite}.lc-a-laugh{animation:lcShake .6s ease-in-out infinite}.lc-a-crown{animation:lcSpinY 1.6s linear infinite}" +
      ".lc-a-panda{animation:lcWiggle .6s ease-in-out infinite}.lc-a-clap{animation:lcClap .35s ease-in-out infinite}.lc-a-rocket{animation:lcRocket .4s linear infinite}" +
      ".lc-a-gg{animation:lcWow 1.1s ease-in-out infinite}.lc-a-angry{animation:lcAngry .22s linear infinite}.lc-a-cry{animation:lcCry 1s ease-in-out infinite}" +
      ".lc-a-cry:after{content:'\\1F4A7';position:absolute;left:62%;top:70%;font-size:.45em;animation:lcTear 1s ease-in infinite}" +
      ".lc-a-party{animation:lcSpinJump 1s ease-in-out infinite}.lc-a-kiss{animation:lcBeat 1.1s ease-in-out infinite}";
    document.head.appendChild(s);
  })();

  var sock = function () { return window.__lcSocket && window.__lcSocket(); };
  var busyElsewhere = function () { return !!((window.__lcCallBusy && window.__lcCallBusy()) || (window.__lcGroupBusy && window.__lcGroupBusy())); };
  var btn = function (bg, color, extra) { return Object.assign({ background: bg, color: color, border: "none", borderRadius: 14, padding: "12px 14px", fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }, extra || {}); };
  var round = function (bg, size) { return { width: size, height: size, borderRadius: size, background: bg, border: "none", color: C.text, fontSize: size * 0.42, lineHeight: size + "px", padding: 0, cursor: "pointer", flexShrink: 0, textAlign: "center" }; };
  var shareLink = function (code) { try { return location.origin + location.pathname + "?live=" + code; } catch (e) { return code; } };

  function Avatar(p) {
    var u = p.user || {}, s = p.size || 30;
    var api = ((window.LETSCHAT_CONFIG || {}).API_URL || "").replace(/\/$/, "");
    var src = u.avatar ? (/^https?:/.test(u.avatar) ? u.avatar : api + u.avatar) : null;
    return h("div", { style: { width: s, height: s, borderRadius: s, background: u.color || "#2B3544", color: "#0E1116", fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: s * 0.4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 } },
      src ? h("img", { src: src, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } }) : (u.initials || "?"));
  }
  function Name(p) { var u = p.user || {}; return h("span", { style: { fontWeight: 700 } }, u.name || "", u.verified ? h("img", { src: "icons/verified.png", alt: "verified", style: { width: 13, height: 13, marginLeft: 3, verticalAlign: "-2px" } }) : null); }

  function VideoEl(p) {
    return h("video", { "data-lcrec": "1", autoPlay: true, playsInline: true, muted: !!p.muted, style: Object.assign({ width: "100%", height: "100%", objectFit: "cover", background: "#000", transform: p.mirror ? "scaleX(-1)" : "none" }, p.style || {}),
      ref: function (el) { if (el && p.stream && el.srcObject !== p.stream) { el.srcObject = p.stream; var pr = el.play && el.play(); if (pr && pr.catch) pr.catch(function () {}); } } });
  }

  (function css2() {
    if (document.getElementById("lc-live-css2")) return;
    var s2 = document.createElement("style"); s2.id = "lc-live-css2";
    s2.textContent = "@keyframes lcToastIn{0%{transform:translateX(-120%);opacity:0}60%{transform:translateX(6px);opacity:1}100%{transform:translateX(0);opacity:1}}" +
      "@keyframes lcToastR{0%{transform:translateX(120%);opacity:0}60%{transform:translateX(-6px);opacity:1}100%{transform:translateX(0);opacity:1}}" +
      "@keyframes lcToastUp{0%{transform:translateY(14px);opacity:0}100%{transform:translateY(0);opacity:1}}" +
      "@keyframes lcComboPop{0%{transform:scale(2.4);opacity:.2}60%{transform:scale(.9)}100%{transform:scale(1);opacity:1}}" +
      "@keyframes lcBigGift{0%{transform:translateY(60px) scale(.2);opacity:0}14%{transform:translateY(0) scale(1.15);opacity:1}28%{transform:scale(.97)}42%{transform:scale(1.07)}80%{transform:scale(1);opacity:1}100%{transform:translateY(-34px) scale(.9);opacity:0}}" +
      "@keyframes lcSpark{0%{transform:scale(0) rotate(0);opacity:0}30%{opacity:1}100%{transform:scale(1.5) rotate(160deg);opacity:0}}" +
      "@keyframes lcFlash{0%{opacity:0}15%{opacity:1}100%{opacity:0}}" +
      "@keyframes lcSpin{to{transform:rotate(360deg)}}" +
      "@media (prefers-reduced-motion:reduce){.lc-toast,.lc-combo,.lc-big,.lc-spark{animation:none!important}}";
    document.head.appendChild(s2);
  })();

  // ---------------------------------------------------------------- the live room (video + chat + gifts + stickers)
  // ---- Recording: saves what you see (and hear) in this live or meeting as a video file on your phone ----
  // A hidden canvas redraws the on-screen video(s) 15 times a second and the audio of every video is mixed, so the file keeps working when the
  // picture changes (camera, effects, screen share, people joining). Nothing is uploaded: the file goes to the phone's Downloads.
  var REC_OK = (function () { try { return CAN_PIPE && typeof window.MediaRecorder === "function"; } catch (e) { return false; } })();
  function recMime() { var l = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]; for (var i = 0; i < l.length; i++) { try { if (MediaRecorder.isTypeSupported(l[i])) return l[i]; } catch (e) {} } return ""; }
  // ---- Face effects: hat, crown, glasses, shades, beard, moustache, beer that follow your face ----
  // Tracking: MediaPipe Face Landmarker (files in vendor/face/ work offline, otherwise it is fetched once and saved), else the phone's own FaceDetector.
  // The items are drawn onto the picture before it is sent, so viewers and recordings see them.
  var FACE_ITEMS = [["tophat", "Top hat", "\uD83C\uDFA9"], ["party", "Party hat", "\uD83E\uDD73"], ["crown", "Crown", "\uD83D\uDC51"], ["glasses", "Glasses", "\uD83D\uDC53"], ["shades", "Shades", "\uD83D\uDE0E"], ["beard", "Beard", "\uD83E\uDDD4"], ["stache", "Moustache", "\uD83D\uDC68"], ["beer", "Beer", "\uD83C\uDF7A"]];
  var FACE_CFG = (window.LETSCHAT_CONFIG || {}).FACE || {};
  var FACE_BASE = FACE_CFG.BASE || "vendor/face/";
  var FACE_CDN = FACE_CFG.CDN || "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  var FACE_MODEL_CDN = FACE_CFG.MODEL || "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  var FACE_MP = (function () { try { new Function("return import('data:text/javascript,')"); return typeof WebAssembly === "object"; } catch (e) { return false; } })();
  var FACE_NATIVE = typeof window.FaceDetector === "function";
  var faceDet = null, faceLoading = null;
  function isKeypad() { try { return /lc-keypad/.test(document.documentElement.className) || Math.min(window.innerWidth || 999, window.innerHeight || 999) <= 320; } catch (e) { return false; } }
  function faceCapable() { return CAN_PIPE && (FACE_MP || FACE_NATIVE) && !isKeypad(); }
  function absUrl(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }
  function withTimeout(pr, ms) { return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error("timeout")); }, ms); pr.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); }); }); }
  // a face as the rest of the code sees it: pixel position of the eye centre, eye distance u, tilt, and local heights (in eye-distances, y down)
  function mpPose(pts, vw, vh) {
    function P(i) { return { x: pts[i].x * vw, y: pts[i].y * vh }; }
    function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    var e1 = mid(P(33), P(133)), e2 = mid(P(263), P(362)); if (e1.x > e2.x) { var t = e1; e1 = e2; e2 = t; }
    return build(mid(e1, e2), e1, e2, P(10), P(152), P(1), mid(P(13), P(14)), P(234), P(454));
  }
  function build(c, e1, e2, top, chin, nose, mouth, cl, cr) {
    var dx = e2.x - e1.x, dy = e2.y - e1.y, u = Math.sqrt(dx * dx + dy * dy); if (!(u > 4)) return null;
    var roll = Math.atan2(dy, dx), co = Math.cos(roll), si = Math.sin(roll);
    function ly(q) { return (-(q.x - c.x) * si + (q.y - c.y) * co) / u; }
    var fw = cl && cr ? Math.sqrt(Math.pow(cr.x - cl.x, 2) + Math.pow(cr.y - cl.y, 2)) / u : 2.2;
    return { cx: c.x, cy: c.y, u: u, roll: roll, fw: Math.max(1.4, Math.min(3.2, fw)), ft: ly(top), ch: ly(chin), ny: ly(nose), my: ly(mouth) };
  }
  function nativePose(f) {
    var bb = f.boundingBox, eyes = [], nose = null, mouth = null;
    (f.landmarks || []).forEach(function (l) { var xs = 0, ys = 0, n = (l.locations || []).length; if (!n) return; l.locations.forEach(function (p) { xs += p.x; ys += p.y; }); var q = { x: xs / n, y: ys / n }; if (l.type === "eye") eyes.push(q); else if (l.type === "nose") nose = q; else if (l.type === "mouth") mouth = q; });
    if (eyes.length < 2) return null; eyes.sort(function (a, b) { return a.x - b.x; });
    var e1 = eyes[0], e2 = eyes[1], c = { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 }, u = Math.sqrt(Math.pow(e2.x - e1.x, 2) + Math.pow(e2.y - e1.y, 2)); if (!(u > 4)) return null;
    var bx = bb.x, by = bb.y, bw = bb.width, bh = bb.height;
    return build(c, e1, e2, { x: c.x, y: by + bh * 0.02 }, { x: c.x, y: by + bh }, nose || { x: c.x, y: c.y + u * 0.62 }, mouth || { x: c.x, y: c.y + u * 1.0 }, { x: bx, y: c.y }, { x: bx + bw, y: c.y });
  }
  function loadMP() {
    var imp = new Function("u", "return import(u)");
    function attempt(mjs, wasm, model) {
      return imp(absUrl(mjs)).then(function (M) {
        return M.FilesetResolver.forVisionTasks(absUrl(wasm)).then(function (fs) {
          var mk = function (d) { return M.FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: absUrl(model), delegate: d }, runningMode: "VIDEO", numFaces: 1 }); };
          return mk("GPU").catch(function () { return mk("CPU"); });
        });
      });
    }
    return withTimeout(attempt(FACE_BASE + "vision_bundle.mjs", FACE_BASE + "wasm", FACE_BASE + "face_landmarker.task").catch(function () { return attempt(FACE_CDN + "/vision_bundle.mjs", FACE_CDN + "/wasm", FACE_MODEL_CDN); }), 30000).then(function (lm) {
      var lastTs = 0;
      return { kind: "mp", detect: function (v) { var ts = Math.max(lastTs + 1, Math.round(performance.now())); lastTs = ts; var r = lm.detectForVideo(v, ts), q = r && r.faceLandmarks && r.faceLandmarks[0]; return q ? mpPose(q, v.videoWidth, v.videoHeight) : null; } };
    });
  }
  function loadNative() {
    return new Promise(function (res, rej) {
      if (!FACE_NATIVE) return rej(new Error("none"));
      try { var d = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); res({ kind: "native", detect: function (v) { return d.detect(v).then(function (a) { return a && a[0] ? nativePose(a[0]) : null; }); } }); } catch (e) { rej(e); }
    });
  }
  function loadFace() {
    if (faceDet) return Promise.resolve(faceDet);
    if (faceLoading) return faceLoading;
    faceLoading = (FACE_MP ? loadMP().catch(function () { return loadNative(); }) : loadNative()).then(function (d) { faceDet = d; faceLoading = null; return d; }, function (e) { faceLoading = null; throw e; });
    return faceLoading;
  }
  // drawing: everything is in "eye-distance" units with the origin between the eyes, rotated with the head
  function poly(cx, pts) { cx.beginPath(); cx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]); cx.closePath(); }
  function ell(cx, x, y, rx, ry) { cx.save(); cx.translate(x, y); cx.scale(rx, ry); cx.beginPath(); cx.arc(0, 0, 1, 0, Math.PI * 2); cx.restore(); }
  function drawFaceFx(cx, f, items) {
    var w = f.fw, by = f.ft + 0.1;
    cx.save(); cx.translate(f.cx, f.cy); cx.rotate(f.roll); cx.scale(f.u, f.u); cx.lineJoin = "round"; cx.lineCap = "round";
    if (items.indexOf("beard") >= 0) {
      var o = [[-w * .48, f.my - .75], [-w * .5, f.ch - .2], [-w * .3, f.ch + .15], [0, f.ch + .3], [w * .3, f.ch + .15], [w * .5, f.ch - .2], [w * .48, f.my - .75], [w * .34, f.my - .35], [w * .18, f.my - .2], [0, f.my - .3], [-w * .18, f.my - .2], [-w * .34, f.my - .35]];
      cx.beginPath(); o.forEach(function (q, i) { i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1]); }); cx.closePath();
      for (var a = 0; a < 16; a++) { var t = a / 16 * Math.PI * 2, qx = Math.cos(t) * .34, qy = f.my + .03 + Math.sin(t) * .12; a ? cx.lineTo(qx, qy) : cx.moveTo(qx, qy); } cx.closePath();
      cx.fillStyle = "#3b2a20"; cx.globalAlpha = .96; try { cx.fill("evenodd"); } catch (e) { cx.fill(); } cx.globalAlpha = 1;
    }
    if (items.indexOf("stache") >= 0) {
      var m = (f.ny + f.my) / 2 - .02; cx.fillStyle = "#2a1d16";
      [1, -1].forEach(function (sg) { cx.beginPath(); cx.moveTo(0, m - .02); cx.quadraticCurveTo(sg * .22, m - .16, sg * .52, m); cx.quadraticCurveTo(sg * .46, m + .22, sg * .22, m + .14); cx.quadraticCurveTo(sg * .08, m + .12, 0, m + .1); cx.closePath(); cx.fill(); });
    }
    if (items.indexOf("glasses") >= 0) {
      cx.lineWidth = .07; cx.strokeStyle = "#1c1c22"; cx.fillStyle = "rgba(190,225,255,.14)";
      [-.5, .5].forEach(function (x) { ell(cx, x, 0, .46, .42); cx.fill(); cx.stroke(); });
      cx.beginPath(); cx.moveTo(-.06, -.05); cx.quadraticCurveTo(0, -.14, .06, -.05); cx.stroke();
      [-1, 1].forEach(function (sg) { cx.beginPath(); cx.moveTo(sg * .96, -.06); cx.lineTo(sg * w * .52, -.04); cx.stroke(); });
    }
    if (items.indexOf("shades") >= 0) {
      cx.fillStyle = "rgba(10,10,14,.94)"; cx.strokeStyle = "#050507"; cx.lineWidth = .06;
      [-.5, .5].forEach(function (x) { ell(cx, x, .02, .52, .4); cx.fill(); cx.stroke(); });
      cx.fillRect(-.1, -.12, .2, .07);
      cx.strokeStyle = "rgba(255,255,255,.35)"; cx.lineWidth = .05; [-.5, .5].forEach(function (x) { cx.beginPath(); cx.arc(x, .02, .3, Math.PI * 1.1, Math.PI * 1.4); cx.stroke(); });
      cx.strokeStyle = "#050507"; cx.lineWidth = .07; [-1, 1].forEach(function (sg) { cx.beginPath(); cx.moveTo(sg * 1.02, -.08); cx.lineTo(sg * w * .52, -.04); cx.stroke(); });
    }
    if (items.indexOf("beer") >= 0) {
      var bx = w * .62, bt = f.ch - .45, bw = .55, bh = .75;
      cx.lineWidth = .08; cx.strokeStyle = "#d8dde3"; cx.beginPath(); cx.arc(bx + bw + .05, bt + bh * .5, .22, -Math.PI / 2, Math.PI / 2); cx.stroke();
      var g = cx.createLinearGradient(0, bt, 0, bt + bh); g.addColorStop(0, "#ffc83d"); g.addColorStop(1, "#d98a0a"); cx.fillStyle = g; cx.fillRect(bx, bt, bw, bh);
      cx.fillStyle = "rgba(255,255,255,.22)"; cx.fillRect(bx + .08, bt + .12, .07, bh - .24);
      cx.fillStyle = "#fffdf5"; [[.1, 0, .17], [.28, -.04, .2], [.46, 0, .17]].forEach(function (c) { cx.beginPath(); cx.arc(bx + c[0] + .05, bt + c[1], c[2], 0, Math.PI * 2); cx.fill(); });
    }
    if (items.indexOf("tophat") >= 0) {
      cx.fillStyle = "#17171c"; cx.fillRect(-w * .4, by - 1.05, w * .8, 1.05); ell(cx, 0, by - 1.05, w * .4, .12); cx.fill();
      cx.fillStyle = "#c0392b"; cx.fillRect(-w * .4, by - .3, w * .8, .2);
      cx.fillStyle = "#17171c"; ell(cx, 0, by, w * .74, .17); cx.fill();
    } else if (items.indexOf("party") >= 0) {
      cx.save(); poly(cx, [[0, by - 1.35], [-w * .4, by + .05], [w * .4, by + .05]]); cx.fillStyle = "#ff4d8d"; cx.fill(); cx.clip();
      cx.fillStyle = "#ffd43b"; [[-.7, .16], [-.2, .16], [.3, .16]].forEach(function (b) { cx.fillRect(-w, by + b[0], w * 2, b[1]); }); cx.restore();
      cx.fillStyle = "#ffd43b"; cx.beginPath(); cx.arc(0, by - 1.35, .13, 0, Math.PI * 2); cx.fill();
    } else if (items.indexOf("crown") >= 0) {
      var hw = w * .42, bb = by + .1; poly(cx, [[-hw, bb], [-hw, bb - .6], [-hw * .5, bb - .32], [0, bb - .7], [hw * .5, bb - .32], [hw, bb - .6], [hw, bb]]);
      var gg = cx.createLinearGradient(0, bb - .7, 0, bb); gg.addColorStop(0, "#ffe27a"); gg.addColorStop(1, "#d9a300"); cx.fillStyle = gg; cx.fill(); cx.strokeStyle = "#a87b00"; cx.lineWidth = .04; cx.stroke();
      [[-hw * .5, "#ff3b5c"], [0, "#35d0ba"], [hw * .5, "#7c5cff"]].forEach(function (j) { cx.fillStyle = j[1]; cx.beginPath(); cx.arc(j[0], bb - .14, .07, 0, Math.PI * 2); cx.fill(); });
    }
    cx.restore();
  }
  // The video effects people see on top of the picture (stickers, emojis, gift banners, bubbles, pinned message, comments) are separate layers,
  // so they are painted onto the recording canvas too. They are drawn from their start time so they move the same way as on screen.
  function rrect(cx, x, y, w, h2, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h2, r); cx.arcTo(x + w, y + h2, x, y + h2, r); cx.arcTo(x, y + h2, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
  function fitText(cx, t, max) { t = String(t || ""); while (t.length > 1 && cx.measureText(t).width > max) t = t.slice(0, -2) + "\u2026"; return t; }
  function drawOverlay(cx, W, H, ov, isMeeting) {
    if (!ov) return;
    var now = Date.now(), k = Math.max(0.5, Math.min(W, H) / 540), i;
    var emojiFont = "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
    cx.save(); cx.textAlign = "center"; cx.textBaseline = "middle";
    if (!isMeeting && ov.bubbles) { // rising see-through bubbles on the right (Go Live only)
      ov.bubbles.forEach(function (b, bi) {
        var dur = 7000 + (bi % 5) * 1200, ph = ((now + bi * 900) % dur) / dur, r = (b.size || 24) * k / 2, rgb = (b.c || [124, 92, 255]).join(",");
        var x = W - (b.right || 5) / 100 * W * 0.38 - r - W * 0.02, y = H * 0.85 - ph * H * 0.7;
        var g = cx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(0.45, "rgba(" + rgb + ",.28)"); g.addColorStop(1, "rgba(" + rgb + ",.12)");
        cx.globalAlpha = Math.sin(ph * Math.PI) * 0.9; cx.fillStyle = g; cx.strokeStyle = "rgba(" + rgb + ",.55)"; cx.lineWidth = 1; cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill(); cx.stroke();
      });
      cx.globalAlpha = 1;
    }
    (ov.floaters || []).forEach(function (f) { // stickers and emojis floating up
      var age = (now - (f.t || now)) / 2700; if (age < 0 || age > 1) return;
      var wide = f.g.length > 2 && f.g.indexOf("\uD83D") < 0 && f.g.indexOf("\uD83E") < 0 && f.g.indexOf("\uD83C") < 0;
      var size = (f.big ? (wide ? 64 : 120) : 40) * k * 0.9, left = (f.big ? 20 + (f.x - 8) * 0.5 : 45 + f.x * 0.5) / 100;
      var baseY = f.big ? H * 0.84 - H * 0.12 : H - 150 * k - 30 * k, rise = f.big ? 0 : age * 300 * k;
      var pop = f.big ? 1 + 0.12 * Math.sin(age * Math.PI * 6) : 1;
      cx.save(); cx.globalAlpha = age > 0.75 ? Math.max(0, (1 - age) / 0.25) : Math.min(1, age * 8);
      cx.translate(left * W, baseY - rise); cx.scale(pop, pop); cx.font = "900 " + size + "px " + (wide ? "Sora, Arial, sans-serif" : emojiFont);
      if (wide) { cx.fillStyle = "#FFD43B"; cx.shadowColor = "rgba(0,0,0,.65)"; cx.shadowBlur = 12 * k; }
      cx.fillText(f.g, 0, 0); cx.restore();
    });
    (ov.gifts || []).forEach(function (g, gi) { // gift banner
      var age = (now - (g.t || now)) / 3000; if (age < 0 || age > 1) return;
      var label = ((g.user && g.user.name) || "Someone") + " sent a gift!", fs = 20 * k;
      cx.save(); cx.globalAlpha = age > 0.8 ? (1 - age) / 0.2 : Math.min(1, age * 6); cx.font = "700 " + fs + "px Inter, Arial, sans-serif";
      var tw = cx.measureText(label).width, bw = Math.min(W - 20, tw + 90 * k), bh = 56 * k, bx = (W - bw) / 2, by = H * 0.3 + gi * (bh + 8 * k);
      cx.fillStyle = "rgba(124,92,255,.9)"; rrect(cx, bx, by, bw, bh, bh / 2); cx.fill();
      cx.font = (34 * k) + "px " + emojiFont; cx.textAlign = "left"; cx.fillText(g.glyph, bx + 14 * k, by + bh / 2);
      cx.font = "700 " + fs + "px Inter, Arial, sans-serif"; cx.fillStyle = "#fff"; cx.fillText(fitText(cx, label, bw - 76 * k), bx + 62 * k, by + bh / 2); cx.restore();
    });
    if (!isMeeting) { // pinned message, then the latest comments at the bottom
      cx.textAlign = "left"; var y = H - 16 * k, fs2 = 15 * k, lh = fs2 * 1.9;
      cx.font = "600 " + fs2 + "px Inter, Arial, sans-serif";
      (ov.chat || []).slice(-4).reverse().forEach(function (m) {
        var who = (m.user && m.user.name) || "", txt = m.gift ? "sent a gift" : (m.text || ""); if (!txt && !who) return;
        var line = who + "  " + txt; line = fitText(cx, line, W * 0.7); var tw = cx.measureText(line).width + 20 * k;
        cx.fillStyle = "rgba(0,0,0,.5)"; rrect(cx, 12 * k, y - lh + 4 * k, tw, lh - 6 * k, 12 * k); cx.fill();
        cx.fillStyle = "#fff"; cx.fillText(line, 22 * k, y - lh / 2 + 1 * k); y -= lh;
      });
      if (ov.pinned) {
        var pt = "\uD83D\uDCCC " + ((ov.pinned.user && ov.pinned.user.name) || "") + ": " + (ov.pinned.gift ? "gift" : (ov.pinned.text || "")); pt = fitText(cx, pt, W - 50 * k);
        cx.fillStyle = "rgba(30,37,48,.92)"; rrect(cx, 12 * k, 64 * k, W - 24 * k, 34 * k, 12 * k); cx.fill(); cx.strokeStyle = "#FFD43B"; cx.lineWidth = 1; cx.stroke();
        cx.fillStyle = "#fff"; cx.fillText(pt, 22 * k, 81 * k);
      }
    }
    cx.restore();
  }
  function startRecorder(isMeeting, onDone, getOv) {
    var vids = function () { return [].slice.call(document.querySelectorAll("video[data-lcrec]")).filter(function (v) { return v.srcObject && v.videoWidth; }); };
    var cv = document.createElement("canvas"), cx = cv.getContext("2d"), first = vids()[0];
    var W = 1280, H = 720;
    if (!isMeeting && first) { var k = Math.min(1, 1280 / Math.max(first.videoWidth, first.videoHeight)); W = Math.max(2, Math.round(first.videoWidth * k / 2) * 2); H = Math.max(2, Math.round(first.videoHeight * k / 2) * 2); }
    cv.width = W; cv.height = H;
    var AC = window.AudioContext || window.webkitAudioContext, ac = null, dest = null, wired = {};
    try { if (AC) { ac = new AC(); dest = ac.createMediaStreamDestination(); if (ac.resume) ac.resume(); } } catch (e) { ac = null; dest = null; }
    function wire() {
      if (!ac) return;
      [].slice.call(document.querySelectorAll("video[data-lcrec]")).forEach(function (v) {
        var st = v.srcObject; if (!st || !st.getAudioTracks || !st.getAudioTracks().length) return;
        var id = st.id + ":" + st.getAudioTracks()[0].id; if (wired[id]) return;
        try { ac.createMediaStreamSource(st).connect(dest); wired[id] = 1; } catch (e) {}
      });
    }
    function draw() {
      cx.fillStyle = "#000"; cx.fillRect(0, 0, W, H);
      var list = vids(); if (!list.length) { try { if (getOv) drawOverlay(cx, W, H, getOv(), isMeeting); } catch (e) {} return; }
      var n = isMeeting ? list.length : 1, cols = n <= 1 ? 1 : 2, rows = Math.ceil(n / cols), cw = W / cols, ch = H / rows;
      for (var i = 0; i < n; i++) {
        var v = list[i], x = (i % cols) * cw, y = Math.floor(i / cols) * ch, sc = Math.min(cw / v.videoWidth, ch / v.videoHeight), dw = v.videoWidth * sc, dh = v.videoHeight * sc;
        try { cx.drawImage(v, x + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh); } catch (e) {}
      }
      try { if (getOv) drawOverlay(cx, W, H, getOv(), isMeeting); } catch (e) {}
    }
    var out = cv.captureStream(15);
    if (dest) dest.stream.getAudioTracks().forEach(function (t) { out.addTrack(t); });
    var mime = recMime(), rec, chunks = [], timer, stopped = false;
    try { rec = new MediaRecorder(out, mime ? { mimeType: mime, videoBitsPerSecond: 1200000 } : { videoBitsPerSecond: 1200000 }); } catch (e) { try { rec = new MediaRecorder(out); } catch (e2) { return null; } }
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      clearInterval(timer); out.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); try { ac && ac.close(); } catch (e) {}
      var type = rec.mimeType || mime || "video/webm";
      onDone(chunks.length ? new Blob(chunks, { type: type }) : null, /mp4/.test(type) ? "mp4" : "webm");
    };
    wire(); draw();
    timer = setInterval(draw, 66);
    var wt = setInterval(function () { if (stopped) clearInterval(wt); else wire(); }, 1500);
    rec.start(1000);
    return { stop: function () { if (stopped) return; stopped = true; clearInterval(wt); try { rec.state !== "inactive" && rec.stop(); } catch (e) { onDone(null, "webm"); } } };
  }
  function saveBlob(blob, name) {
    var a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; a.style.display = "none"; document.body.appendChild(a); a.click();
    setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 60000);
  }

  // ---- Sticker sounds + animations ----
  // Every sticker (and live emoji) moves and makes its own sound. The sounds are made on the phone with the Web Audio API (no sound files
  // to download, nothing to license, works offline). "Wow" and "GG" are spoken by the phone's voice when it has one. Reduced-motion phones
  // get no animation; the speaker button in the sticker panel turns sounds off (remembered on this phone).
  var EMO_KEY = { "👍": "pop", "❤️": "heart", "😂": "laugh", "😮": "wow", "😢": "cry", "😡": "angry", "🔥": "fire", "💯": "100", "👏": "clap", "🎉": "party", "😍": "love", "🙌": "clap" };
  var sfxOn = function () { try { return localStorage.getItem("lcLiveSfx") !== "off"; } catch (e) { return true; } };
  var ACX = null, lastSfx = {}, sfxCount = [];
  function actx() { try { if (!ACX) { var A = window.AudioContext || window.webkitAudioContext; if (A) ACX = new A(); } if (ACX && ACX.state === "suspended" && ACX.resume) ACX.resume(); } catch (e) { ACX = null; } return ACX; }
  function speak(text, pitch, rate) { try { var u = new SpeechSynthesisUtterance(text); u.pitch = pitch; u.rate = rate; u.volume = 1; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); return true; } catch (e) { return false; } }
  var SFX = (function () {
    function env(c, g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d); }
    function tone(c, out, t, f0, f1, d, type, v, filt, vib) {
      var o = c.createOscillator(), g = c.createGain(), n = o; o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + d);
      if (vib) { var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib[0]; lg.gain.value = vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + 0.05); }
      env(c, g, t, 0.012, d, v || 0.3);
      if (filt) { var f = c.createBiquadFilter(); f.type = filt[0]; f.frequency.value = filt[1]; f.Q.value = filt[2] || 1; o.connect(f); f.connect(g); } else o.connect(g);
      g.connect(out); o.start(t); o.stop(t + d + 0.05);
    }
    function noise(c, out, t, d, v, ft, f0, f1, q) {
      var len = Math.max(1, Math.floor(c.sampleRate * d)), buf = c.createBuffer(1, len, c.sampleRate), a = buf.getChannelData(0); for (var i = 0; i < len; i++) a[i] = Math.random() * 2 - 1;
      var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); src.buffer = buf; f.type = ft; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + d);
      env(c, g, t, Math.min(0.03, d / 3), d, v); src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + d + 0.05);
    }
    return {
      pop: function (c, o, t) { tone(c, o, t, 500, 900, 0.09, "sine", 0.4); },
      fire: function (c, o, t) { noise(c, o, t, 1.1, 0.5, "bandpass", 500, 2200, 0.9); for (var i = 0; i < 7; i++) noise(c, o, t + 0.1 + Math.random() * 0.9, 0.04, 0.5, "highpass", 3000, 3000, 1); },
      "100": function (c, o, t) { tone(c, o, t, 880, 0, 0.14, "triangle", 0.35); tone(c, o, t + 0.1, 1175, 0, 0.14, "triangle", 0.35); tone(c, o, t + 0.2, 1760, 0, 0.5, "triangle", 0.35); tone(c, o, t + 0.2, 3520, 0, 0.35, "sine", 0.1); },
      heart: function (c, o, t) { tone(c, o, t, 660, 0, 0.3, "sine", 0.35); tone(c, o, t + 0.13, 880, 0, 0.35, "sine", 0.3); tone(c, o, t + 0.26, 1320, 0, 0.5, "sine", 0.2); },
      laugh: function (c, o, t) { for (var i = 0; i < 5; i++) { tone(c, o, t + i * 0.17, 330 - i * 22, 250 - i * 22, 0.13, "sawtooth", 0.2 - i * 0.02, ["bandpass", 1000, 2.5]); noise(c, o, t + i * 0.17, 0.05, 0.12, "highpass", 2500, 2500, 1); } },
      crown: function (c, o, t) { tone(c, o, t, 523, 0, 0.16, "sawtooth", 0.22, ["lowpass", 2400, 1]); tone(c, o, t + 0.15, 659, 0, 0.16, "sawtooth", 0.22, ["lowpass", 2400, 1]); tone(c, o, t + 0.3, 784, 0, 0.7, "sawtooth", 0.25, ["lowpass", 2600, 1]); tone(c, o, t + 0.3, 1568, 0, 0.5, "triangle", 0.1); },
      wow: function (c, o, t) { if (window.speechSynthesis && window.SpeechSynthesisUtterance && speak("Wow!", 1.5, 0.85)) return; tone(c, o, t, 240, 420, 0.35, "sawtooth", 0.3, ["bandpass", 900, 3], [7, 12]); tone(c, o, t + 0.3, 420, 210, 0.5, "sawtooth", 0.3, ["bandpass", 700, 3], [7, 12]); },
      panda: function (c, o, t) { tone(c, o, t, 900, 1600, 0.09, "sine", 0.35); tone(c, o, t + 0.13, 1000, 1700, 0.09, "sine", 0.35); tone(c, o, t + 0.28, 1400, 800, 0.16, "sine", 0.3); },
      clap: function (c, o, t) { var x = 0; for (var i = 0; i < 9; i++) { noise(c, o, t + x, 0.06, 0.55 - i * 0.03, "bandpass", 1500 + Math.random() * 800, 1500, 0.7); x += 0.05 + Math.random() * 0.06; } },
      love: function (c, o, t) { tone(c, o, t, 90, 50, 0.16, "sine", 0.7); tone(c, o, t + 0.22, 90, 50, 0.18, "sine", 0.7); tone(c, o, t + 0.5, 988, 0, 0.3, "sine", 0.25); tone(c, o, t + 0.62, 1319, 0, 0.5, "sine", 0.22); },
      rocket: function (c, o, t) { noise(c, o, t, 1.5, 0.55, "lowpass", 200, 3500, 0.7); tone(c, o, t, 70, 380, 1.5, "sawtooth", 0.18, ["lowpass", 700, 1]); },
      gg: function (c, o, t) { tone(c, o, t, 1047, 0, 0.9, "triangle", 0.25); tone(c, o, t, 2093, 0, 0.6, "sine", 0.08); if (window.speechSynthesis && window.SpeechSynthesisUtterance) speak("Good game!", 1.1, 0.95); },
      angry: function (c, o, t) { var os = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter();
        os.type = "sawtooth"; os.frequency.setValueAtTime(140, t); os.frequency.exponentialRampToValueAtTime(65, t + 0.9); l.type = "square"; l.frequency.value = 28; lg.gain.value = 0.25; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
        l.connect(lg); lg.connect(g.gain); f.type = "lowpass"; f.frequency.value = 650; os.connect(f); f.connect(g); g.connect(o); os.start(t); l.start(t); os.stop(t + 1.05); l.stop(t + 1.05); noise(c, o, t, 0.25, 0.3, "bandpass", 700, 300, 1); },
      cry: function (c, o, t) { for (var i = 0; i < 3; i++) tone(c, o, t + i * 0.42, 560 - i * 30, 360 - i * 30, 0.36, "triangle", 0.4 - i * 0.07, ["bandpass", 850, 2], [9, 18]); noise(c, o, t + 1.25, 0.18, 0.12, "bandpass", 1800, 900, 2); },
      party: function (c, o, t) { noise(c, o, t, 0.12, 0.6, "highpass", 1500, 800, 1); [523, 659, 784, 1047].forEach(function (f, i) { tone(c, o, t + 0.1 + i * 0.09, f, 0, 0.2, "square", 0.12, ["lowpass", 3000, 1]); }); noise(c, o, t + 0.5, 0.7, 0.2, "highpass", 5000, 7000, 1); },
      join: function (c, o, t) { tone(c, o, t, 660, 0, 0.12, "sine", 0.3); tone(c, o, t + 0.1, 990, 0, 0.25, "sine", 0.3); },
      leave: function (c, o, t) { tone(c, o, t, 700, 0, 0.12, "sine", 0.25); tone(c, o, t + 0.1, 440, 0, 0.25, "sine", 0.25); },
      msg: function (c, o, t) { tone(c, o, t, 1200, 900, 0.07, "sine", 0.18); },
      mention: function (c, o, t) { tone(c, o, t, 1047, 0, 0.14, "triangle", 0.35); tone(c, o, t + 0.14, 1319, 0, 0.14, "triangle", 0.35); tone(c, o, t + 0.28, 1568, 0, 0.4, "triangle", 0.35); },
      pin: function (c, o, t) { noise(c, o, t, 0.03, 0.4, "highpass", 2500, 2500, 1); tone(c, o, t + 0.03, 1760, 0, 0.35, "sine", 0.3); },
      share: function (c, o, t) { noise(c, o, t, 0.4, 0.3, "bandpass", 500, 2500, 1.2); tone(c, o, t + 0.3, 1175, 0, 0.2, "sine", 0.25); },
      gift: function (c, o, t) { [784, 988, 1175, 1568, 1976].forEach(function (f, i) { tone(c, o, t + i * 0.07, f, 0, 0.35, "triangle", 0.25); }); tone(c, o, t + 0.4, 2637, 0, 0.5, "sine", 0.15); noise(c, o, t + 0.35, 0.5, 0.12, "highpass", 6000, 8000, 1); },
      end: function (c, o, t) { [784, 659, 523, 392].forEach(function (f, i) { tone(c, o, t + i * 0.16, f, 0, 0.3, "sine", 0.3); }); },
      kiss: function (c, o, t) { noise(c, o, t, 0.06, 0.25, "lowpass", 600, 600, 1); tone(c, o, t + 0.03, 1300, 650, 0.1, "sine", 0.4); }
    };
  })();
  function playSfx(key) {
    if (!sfxOn() || !SFX[key]) return;
    var now = Date.now(); if (lastSfx[key] && now - lastSfx[key] < 350) return; lastSfx[key] = now;
    sfxCount = sfxCount.filter(function (x) { return now - x < 1000; }); if (sfxCount.length >= 3) return; sfxCount.push(now); // a burst of taps never turns into noise
    var c = actx(); if (!c) return;
    try { var out = c.createGain(); out.gain.value = 0.9; out.connect(c.destination); SFX[key](c, out, c.currentTime + 0.01); } catch (e) {}
  }
  var animKey = function (kind, value) { return kind === "sticker" ? value : kind === "emoji" ? (EMO_KEY[value] || "pop") : "crown"; };
  var anim = function (k, g) { return h("span", { className: "lc-anim lc-a-" + k }, g); };

  function Room(p) {
    var info = p.info, me = p.me, socket = p.socket;
    var code = info.code, kind = info.kind;
    var st = useState(function () { return { chat: info.chat || [], viewers: info.viewers || 1, gifts: info.gifts || 0, hostId: info.hostId, host: info.host, media: info.media, pinned: info.pinned || null }; }), S = st[0], setS = st[1];
    var rs = useState({}), remotes = rs[0], setRemotes = rs[1];                 // userId -> MediaStream
    var ps = useState(function () { var m = {}; (info.peers || []).forEach(function (u) { if (u) m[u.id] = u; }); if (info.host) m[info.host.id] = info.host; return m; }), people = ps[0], setPeople = ps[1];
    var ls = useState(null), local = ls[0], setLocal = ls[1];
    var mc = useState({ mic: true, cam: true }), mediaState = mc[0], setMedia = mc[1];
    var fx = useState([]), floaters = fx[0], setFloaters = fx[1];
    var gb = useState([]), gifts = gb[0], setGifts = gb[1];
    var cbs = useState([]), combos = cbs[0], setCombos = cbs[1];                  // gift combo toasts (Rose x18)
    var bgs = useState(null), bigGift = bgs[0], setBigGift = bgs[1];              // big gift animation in the middle
    var mns = useState(0), mostN = mns[0], setMostN = mns[1];                      // re-draws "Most sent"
    var lks = useState(0), likes = lks[0], setLikes = lks[1];                      // hearts received while you are here
    var sgs = useState("rose"), selGift = sgs[0], setSelGift = sgs[1];            // gift picked in the tray
    var jns = useState(""), joinNote = jns[0], setJoinNote = jns[1];
    var fcs = useState("user"), facing = fcs[0], setFacing = fcs[1];               // "user" = front, "environment" = back
    var shs = useState(false), shareOpen = shs[0], setShareOpen = shs[1];          // share menu on the right (Send link / Save)
    var cmx = useState(false), cmtOpen = cmx[0], setCmtOpen = cmx[1];              // message bar is hidden until the message icon is tapped (Go Live)
    var lkx = useState(0), likeFx = lkx[0], setLikeFx = lkx[1];                    // colour the heart only right after a like
    var gfx = useState(0), giftFx = gfx[0], setGiftFx = gfx[1];                    // colour the gift only right after a gift
    var svx = useState(function () { try { return localStorage.getItem("lcSave:" + (info.host && info.host.id)) === "1"; } catch (e) { return false; } }), saved = svx[0], setSaved = svx[1];
    var lys = useState(function () { try { var v = parseInt(localStorage.getItem("lcLiveLayout"), 10); return v >= 0 && v < LAYOUTS.length ? v : 0; } catch (e) { return 0; } }), layoutIdx = lys[0], setLayoutIdx = lys[1];
    var fls = useState(function () { try { return localStorage.getItem("lcFollow:" + (info.host && info.host.id)) === "1"; } catch (e) { return false; } }), following = fls[0], setFollowing = fls[1];
    var lastGift = useRef(0), lastLike = useRef(0), tally = useRef(null);
    if (!tally.current) { tally.current = {}; (info.chat || []).forEach(function (m) { if (m && m.gift && m.user) { var t0 = tally.current[m.user.id] || (tally.current[m.user.id] = { name: m.user.name, n: 0 }); t0.n++; } }); }
    var tx = useState(""), text = tx[0], setText = tx[1];
    var rp = useState(null), replyTo = rp[0], setReplyTo = rp[1];
    var sl = useState(null), picked = sl[0], setPicked = sl[1];                   // comment selected for react/reply
    var pn = useState(null), panel = pn[0], setPanel = pn[1];                     // null | "stickers" | "gifts" | "emoji"
    var cs = useState(kind === "live"), chatOpen = cs[0], setChatOpen = cs[1];
    var ts = useState(""), toast = ts[0], setToast = ts[1];
    var lkt = useState(""), likeToast = lkt[0], setLikeToast = lkt[1];                // "Liked!" card
    var fwt = useState(""), followToast = fwt[0], setFollowToast = fwt[1];            // "New follower" card
    var mnu = useState(false), menuOpen = mnu[0], setMenuOpen = mnu[1];               // three dot menu
    var prf = useState(false), profOpen = prf[0], setProfOpen = prf[1];               // false | "profile" | "people"
    var jls = useState([]), joinLog = jls[0], setJoinLog = jls[1];                    // "X joined the live" rows in the comments
    var likeTimer = useRef(0), followTimer = useRef(0);
    var showLikeToast = function (name) { setLikeToast(name); clearTimeout(likeTimer.current); likeTimer.current = setTimeout(function () { setLikeToast(""); }, 2600); };
    var showFollowToast = function (name) { setFollowToast(name); clearTimeout(followTimer.current); followTimer.current = setTimeout(function () { setFollowToast(""); }, 4200); };
    var pcs = useRef({}), pend = useRef({}), localRef = useRef(null), inputRef = useRef(null), logRef = useRef(null), fxId = useRef(0), alive = useRef(true);
    var isHost = S.hostId === me.id;
    var canPin = isHost || !!me.creator;
    var tk = kind === "live"; // Go Live uses the TikTok-style layout
    var bubbles = useRef(null);
    if (!bubbles.current) { var pal = [[124,92,255],[53,208,186],[255,107,157],[255,212,59],[77,171,247],[255,146,43],[105,219,124]]; bubbles.current = []; for (var bi = 0; bi < 12; bi++) { var c = pal[bi % pal.length], sz = 18 + Math.round(Math.random() * 36); bubbles.current.push({ id: bi, c: c, size: sz, right: Math.round(Math.random() * 70), dur: 5 + Math.random() * 5, delay: -Math.random() * 10, dx: Math.round((Math.random() * 40 - 20)), o: (0.3 + Math.random() * 0.3).toFixed(2) }); } }
    var flash = function (t) { setToast(t); setTimeout(function () { if (alive.current) setToast(""); }, 2600); };

    // ---- recording (host, and everyone in a meeting) ----
    var sxs = useState(0), sfxN = sxs[0], setSfxN = sxs[1]; // re-draws the speaker button
    var rcs = useState(null), recSec = rcs[0], setRecSec = rcs[1], recRef = useRef(null), recTick = useRef(null);
    var ovRef = useRef(null);
    ovRef.current = { floaters: floaters, gifts: gifts, chat: (typeof S !== "undefined" && S && S.chat) || [], pinned: (typeof S !== "undefined" && S && S.pinned) || null, bubbles: bubbles.current }; // read by the recorder
    var stopRec = function () { if (recRef.current) { recRef.current.stop(); recRef.current = null; } clearInterval(recTick.current); if (alive.current) setRecSec(null); };
    var startRec = function () {
      if (recRef.current) return stopRec();
      var r = startRecorder(kind === "meeting", function (blob, ext) {
        if (!blob) { if (alive.current) flash("Nothing was recorded."); return; }
        var d = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };
        saveBlob(blob, "letschat-" + kind + "-" + code + "-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + "." + ext);
        if (alive.current) flash("Recording saved to your phone (" + Math.max(1, Math.round(blob.size / 1048576)) + " MB)");
      }, function () { return ovRef.current; });
      if (!r) return flash("Recording is not supported on this phone or browser.");
      recRef.current = r; setRecSec(0);
      var t0 = Date.now(); recTick.current = setInterval(function () { if (alive.current) setRecSec(Math.floor((Date.now() - t0) / 1000)); }, 1000);
      flash("Recording started. Only you can see this; tap again to stop and save.");
    };
    useEffect(function () { return function () { if (recRef.current) { recRef.current.stop(); recRef.current = null; } clearInterval(recTick.current); }; }, []);
    var recLabel = recSec == null ? "\u23FA" : Math.floor(recSec / 60) + ":" + (recSec % 60 < 10 ? "0" : "") + (recSec % 60);

    // ---- WebRTC ----
    function addRemote(uid, stream) { setRemotes(function (r) { var n = Object.assign({}, r); n[uid] = stream; return n; }); }
    function closePeer(uid) { var pc = pcs.current[uid]; if (pc) { try { pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null; pc.close(); } catch (e) {} } delete pcs.current[uid]; delete pend.current[uid]; setRemotes(function (r) { if (!r[uid]) return r; var n = Object.assign({}, r); delete n[uid]; return n; }); }
    function makePc(uid, sendLocal, recvOnly) {
      var early = pend.current[uid] || []; // candidates that came in before the offer must survive closePeer
      closePeer(uid);
      pend.current[uid] = early;
      var pc = new RTCPeerConnection({ iceServers: ICE });
      pcs.current[uid] = pc;
      pc.onicecandidate = function (e) { if (e.candidate) socket.emit("live:signal", { code: code, to: uid, data: { candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate } }); };
      pc.ontrack = function (e) { var s = (e.streams && e.streams[0]) || null; if (!s) { s = new MediaStream(); s.addTrack(e.track); } addRemote(uid, s); };
      pc.onconnectionstatechange = function () { if (pc.connectionState === "failed") { try { pc.restartIce && pc.restartIce(); } catch (e) {} } };
      if (sendLocal && localRef.current) localRef.current.getTracks().forEach(function (t) { pc.addTrack(t, localRef.current); });
      tuneSender(pc, 1500000);
      if (recvOnly || (sendLocal && !pc.getSenders().length)) { try { pc.addTransceiver("video", { direction: "recvonly" }); pc.addTransceiver("audio", { direction: "recvonly" }); } catch (e) {} }
      return pc;
    }
    function offerTo(uid, sendLocal, recvOnly) {
      var pc = makePc(uid, sendLocal, recvOnly);
      return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { socket.emit("live:signal", { code: code, to: uid, data: { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } } }); }).catch(function () { closePeer(uid); });
    }
    function flushCands(uid) { var pc = pcs.current[uid], q = pend.current[uid] || []; pend.current[uid] = []; q.forEach(function (c) { try { pc.addIceCandidate(c); } catch (e) {} }); }
    function onSignal(m) {
      if (!m || m.code !== code) return;
      var uid = m.from, d = m.data || {};
      if (d.sdp && d.sdp.type === "offer") {
        var pc = makePc(uid, true, false);
        pc.setRemoteDescription(d.sdp).then(function () { flushCands(uid); return pc.createAnswer(); }).then(function (a) { return pc.setLocalDescription(a); })
          .then(function () { socket.emit("live:signal", { code: code, to: uid, data: { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } } }); }).catch(function () { closePeer(uid); });
      } else if (d.sdp && d.sdp.type === "answer") {
        var pc2 = pcs.current[uid]; if (pc2) pc2.setRemoteDescription(d.sdp).then(function () { flushCands(uid); }).catch(function () {});
      } else if (d.candidate) {
        var pc3 = pcs.current[uid];
        if (pc3 && pc3.remoteDescription && pc3.remoteDescription.type) { try { pc3.addIceCandidate(d.candidate); } catch (e) {} } else { (pend.current[uid] = pend.current[uid] || []).push(d.candidate); }
      }
    }

    // ---- your video: camera (with an effect), a picture instead of the camera, or video off ----
    var vm = useState("camera"), vmode = vm[0], setVmode = vm[1];
    var fe = useState("none"), fxName = fe[0], setFxName = fe[1];
    var vp = useState(false), vpanel = vp[0], setVpanel = vp[1];
    var sh = useState(function () { var m = {}; (info.sharing || []).forEach(function (id) { m[id] = true; }); return m; }), sharing = sh[0], setSharing = sh[1];
    var prevLook = useRef({ mode: "camera", fx: "none" });
    var td = useState({ tool: "pen", color: "#FF3B5C", size: 5 }), teach = td[0], setTeach = td[1];
    var tlo = useState(false), toolsOpen = tlo[0], setToolsOpen = tlo[1]; // drawing tools (pen, highlight, laser, torch...) live inside a Tools button
    var annRef = useRef({ strokes: [], cur: null, laser: [] });
    var camRef = useRef({ video: null, audio: null }), pipe = useRef(null), imgRef = useRef(null), fileRef = useRef(null), modeRef = useRef({ mode: "camera", fx: "none" });

    var faceRef = useRef([]), fcs = useState([]), faceSet = fcs[0], setFaceSet = fcs[1], fms = useState(""), faceMsg = fms[0], setFaceMsg = fms[1];
    function stopFaceLoop() { var P = pipe.current; if (P && P.ftimer) { clearInterval(P.ftimer); P.ftimer = null; } if (P) { P.face = null; P.faceT = 0; } }
    function startFaceLoop() {
      var P = ensurePipe(); if (P.ftimer) return;
      P.ftimer = setInterval(function () {
        if (P.fbusy || !faceDet || !alive.current || modeRef.current.mode !== "camera" || !faceRef.current.length || P.vid.readyState < 2 || !P.vid.videoWidth) return;
        P.fbusy = true;
        var r; try { r = faceDet.detect(P.vid); } catch (e) { r = null; }
        Promise.resolve(r).then(function (pose) { P.fbusy = false; if (pose) { var c = P.face; if (c && Date.now() - P.faceT < 600) { ["cx", "cy", "u", "roll", "fw", "ft", "ch", "ny", "my"].forEach(function (k) { pose[k] = c[k] + (pose[k] - c[k]) * 0.6; }); } P.face = pose; P.faceT = Date.now(); } }, function () { P.fbusy = false; });
      }, faceDet && faceDet.kind === "mp" ? 90 : 130);
    }
    function toggleFace(id) {
      var cur = faceRef.current.slice(), i = cur.indexOf(id);
      if (id === "none") cur = []; else if (i >= 0) cur.splice(i, 1); else cur.push(id);
      var hats = ["tophat", "party", "crown"], eyesW = ["glasses", "shades"]; // one hat and one pair of eyewear at a time
      [hats, eyesW].forEach(function (grp) { if (grp.indexOf(id) >= 0 && i < 0) cur = cur.filter(function (x) { return x === id || grp.indexOf(x) < 0; }); });
      faceRef.current = cur; setFaceSet(cur);
      if (!cur.length) { stopFaceLoop(); setFaceMsg(""); refreshOut(); return; }
      if (modeRef.current.mode !== "camera") setLook("camera");
      refreshOut();
      if (faceDet) { setFaceMsg(""); startFaceLoop(); return; }
      setFaceMsg("Loading face tracking\u2026 (needs internet the first time)");
      loadFace().then(function () { if (!alive.current) return; setFaceMsg(""); if (faceRef.current.length) startFaceLoop(); }, function () { if (!alive.current) return; faceRef.current = []; setFaceSet([]); setFaceMsg("Face tracking could not load. Connect to the internet once, or add the face files (see FACE.md)."); refreshOut(); });
    }
    useEffect(function () { return function () { stopFaceLoop(); }; }, []); // eslint-disable-line
    function ensurePipe() {
      if (pipe.current) return pipe.current;
      var cv = document.createElement("canvas"); cv.width = 360; cv.height = 480;
      var P = { cv: cv, cx: cv.getContext("2d"), vid: document.createElement("video"), timer: null, track: null, src: null, rate: 0, face: null, faceT: 0, ftimer: null, fbusy: false };
      P.vid.muted = true; P.vid.setAttribute("playsinline", ""); P.vid.playsInline = true;
      var st = cv.captureStream(20); P.track = st.getVideoTracks()[0];
      pipe.current = P; return P;
    }
    // teaching marks (pen, highlighter, arrow, box, text, laser) are drawn into the picture, so everyone sees them, even people who join late
    function drawAnn(cx, cv) {
      var A = annRef.current, W = cv.width, k = W / 1280, now = Date.now(), all = A.strokes.concat(A.cur ? [A.cur] : []);
      all.forEach(function (st) {
        var pts = st.pts, lw = Math.max(2, st.size * k), a = pts[0], b = pts[pts.length - 1];
        cx.save(); cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = st.color; cx.fillStyle = st.color; cx.lineWidth = lw;
        var X = function (pt) { return pt[0] * cv.width; }, Y = function (pt) { return pt[1] * cv.height; };
        if (st.tool === "pen" || st.tool === "hl") {
          if (st.tool === "hl") { cx.globalAlpha = 0.35; cx.lineWidth = lw * 4; cx.lineCap = "butt"; }
          cx.beginPath(); cx.moveTo(X(a), Y(a)); for (var i = 1; i < pts.length; i++) cx.lineTo(X(pts[i]), Y(pts[i])); if (pts.length === 1) cx.lineTo(X(a) + 0.1, Y(a)); cx.stroke();
        } else if (st.tool === "arrow") {
          var x1 = X(a), y1 = Y(a), x2 = X(b), y2 = Y(b), ang = Math.atan2(y2 - y1, x2 - x1), hd = Math.max(12 * k, lw * 3.2);
          cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
          cx.beginPath(); cx.moveTo(x2, y2); cx.lineTo(x2 - hd * Math.cos(ang - 0.45), y2 - hd * Math.sin(ang - 0.45)); cx.lineTo(x2 - hd * Math.cos(ang + 0.45), y2 - hd * Math.sin(ang + 0.45)); cx.closePath(); cx.fill();
        } else if (st.tool === "box") {
          cx.strokeRect(Math.min(X(a), X(b)), Math.min(Y(a), Y(b)), Math.abs(X(b) - X(a)), Math.abs(Y(b) - Y(a)));
        } else if (st.tool === "text") {
          var fs = Math.round((18 + st.size * 2.2) * k); cx.font = "700 " + fs + "px Inter, Arial, sans-serif"; cx.textBaseline = "top"; cx.lineWidth = Math.max(3, fs / 6); cx.strokeStyle = "rgba(0,0,0,.85)"; cx.strokeText(st.text, X(a), Y(a)); cx.fillText(st.text, X(a), Y(a));
        }
        cx.restore();
      });
      A.laser = A.laser.filter(function (t) { return now - t.t < 900; });
      A.laser.forEach(function (t, i) {
        var age = (now - t.t) / 900, r = (i === A.laser.length - 1 ? 11 : 7 * (1 - age) + 2) * k * 1.4;
        cx.save(); cx.globalAlpha = Math.max(0.1, 1 - age); cx.fillStyle = "#FF2D55"; cx.shadowColor = "#FF2D55"; cx.shadowBlur = 18 * k; cx.beginPath(); cx.arc(t.x * cv.width, t.y * cv.height, r, 0, Math.PI * 2); cx.fill(); cx.restore();
      });
      if (A.torch) { // torch: a small white dot at the exact pointer spot; nothing else on the screen is dimmed
        var tx = A.torch.x * cv.width, ty = A.torch.y * cv.height, tr = Math.max(4, Math.round(Math.min(cv.width, cv.height) * 0.012));
        cx.save(); cx.beginPath(); cx.arc(tx, ty, tr, 0, Math.PI * 2); cx.fillStyle = "#FFFFFF"; cx.shadowColor = "rgba(0,0,0,0.6)"; cx.shadowBlur = 4 * (cv.width / 1280); cx.fill(); cx.restore();
      }
    }
    function drawFrame() {
      var P = pipe.current; if (!P) return;
      var m = modeRef.current, cx = P.cx, cv = P.cv, css = "", def = null;
      for (var i = 0; i < EFFECTS.length; i++) if (EFFECTS[i][0] === m.fx) def = EFFECTS[i];
      var fx = def && def[0] !== "none" ? def : null;
      if (fx && FILTER_OK) css = fx[2];
      var cover = function (img, iw, ih) { var W = cv.width, H = cv.height, sc = Math.max(W / iw, H / ih), dw = iw * sc, dh = ih * sc; cx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh); };
      var drew = false;
      cx.save();
      if (m.mode === "screen" && camRef.current.screen && P.vid.readyState >= 2 && P.vid.videoWidth) {
        var sw = P.vid.videoWidth, sh2 = P.vid.videoHeight, ssc = Math.min(1, 1280 / sw, 1280 / sh2), SW = Math.round(sw * ssc), SH = Math.round(sh2 * ssc);
        if (cv.width !== SW || cv.height !== SH) { cv.width = SW; cv.height = SH; }
        cx.drawImage(P.vid, 0, 0, SW, SH); drawAnn(cx, cv); drew = true;
      } else if (m.mode === "camera" && camRef.current.video && P.vid.readyState >= 2 && P.vid.videoWidth) {
        var vw = P.vid.videoWidth, vh = P.vid.videoHeight, sc = 480 / Math.max(vw, vh), W = Math.round(vw * sc), H = Math.round(vh * sc);
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        cx.filter = css || "none"; cx.drawImage(P.vid, 0, 0, W, H); cx.filter = "none"; drew = true;
      } else if (m.mode === "image" && imgRef.current) {
        cx.fillStyle = "#000"; cx.fillRect(0, 0, cv.width, cv.height);
        cx.filter = css || "none"; cover(imgRef.current, imgRef.current.naturalWidth || 1, imgRef.current.naturalHeight || 1); cx.filter = "none"; drew = true;
      }
      if (drew && fx && !FILTER_OK && m.mode !== "screen") { try { var im = cx.getImageData(0, 0, cv.width, cv.height); pixelFx(im.data, fx[0]); cx.putImageData(im, 0, 0); } catch (e) {} }
      if (drew && m.mode === "camera" && P.face && faceRef.current.length && Date.now() - P.faceT < 700 && P.vid.videoWidth) { try { var fk = cv.width / P.vid.videoWidth, f0 = P.face; drawFaceFx(cx, { cx: f0.cx * fk, cy: f0.cy * fk, u: f0.u * fk, roll: f0.roll, fw: f0.fw, ft: f0.ft, ch: f0.ch, ny: f0.ny, my: f0.my }, faceRef.current); } catch (e) {} } // face items go on after the colour effect so they keep their own colours
      if (!drew) { // no camera and no picture: a clean card with your initials, so others still see who you are
        var W2 = cv.width, H2 = cv.height; cx.fillStyle = "#1B2330"; cx.fillRect(0, 0, W2, H2);
        var rad = Math.min(W2, H2) * 0.2; cx.fillStyle = me.color || "#35D0BA"; cx.beginPath(); cx.arc(W2 / 2, H2 / 2 - rad * 0.2, rad, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = "#0E1116"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.font = "700 " + Math.round(rad * 0.85) + "px Sora, Arial, sans-serif"; cx.fillText(me.initials || "?", W2 / 2, H2 / 2 - rad * 0.2);
        cx.fillStyle = "#9BA7B4"; cx.font = "600 " + Math.round(rad * 0.3) + "px Inter, Arial, sans-serif"; cx.fillText(m.mode === "off" ? "Video is off" : (me.name || ""), W2 / 2, H2 / 2 + rad * 1.25);
      }
      cx.restore();
    }
    function videoSender(pc) {
      var ts = pc.getTransceivers(), i;
      for (i = 0; i < ts.length; i++) { var t = ts[i]; if (t.sender && ((t.sender.track && t.sender.track.kind === "video") || (t.receiver && t.receiver.track && t.receiver.track.kind === "video"))) return t.sender; }
      return null;
    }
    // pick what is actually sent (camera as it is, or the canvas carrying an effect / picture / card) and swap it into every call
    function refreshOut() {
      var m = modeRef.current, cam = camRef.current, P = null, screenOn = m.mode === "screen" && !!cam.screen, srcT = screenOn ? cam.screen : cam.video, track = srcT, usePipe = CAN_PIPE && (screenOn || m.mode !== "camera" || m.fx !== "none" || faceRef.current.length > 0 || !cam.video);
      if (usePipe) {
        P = ensurePipe();
        if (srcT && P.src !== srcT) { P.src = srcT; P.vid.srcObject = new MediaStream([srcT]); var pr = P.vid.play(); if (pr && pr.catch) pr.catch(function () {}); }
        if (!srcT) { P.src = null; P.vid.srcObject = null; }
        var rate = screenOn ? 66 : m.mode === "camera" && cam.video ? (FILTER_OK ? 50 : 70) : 150;
        if (P.rate !== rate) { clearInterval(P.timer); P.rate = rate; P.timer = setInterval(drawFrame, rate); }
        drawFrame(); track = P.track;
      } else if (pipe.current && pipe.current.timer) { clearInterval(pipe.current.timer); pipe.current.timer = null; pipe.current.rate = 0; }
      var out = localRef.current || new MediaStream();
      out.getVideoTracks().forEach(function (t) { if (t !== track) out.removeTrack(t); });
      if (track && out.getVideoTracks().indexOf(track) < 0) out.addTrack(track);
      localRef.current = out;
      Object.keys(pcs.current).forEach(function (uid) { var snd = videoSender(pcs.current[uid]); if (snd && track) { try { snd.replaceTrack(track); } catch (e) {} } });
      if (!CAN_PIPE && m.mode === "off" && cam.video) cam.video.enabled = false; // very old browsers: black frame instead of the card
      setLocal(new MediaStream(out.getTracks()));
    }
    function setLook(mode, fx) {
      var cur = modeRef.current, nm = mode || cur.mode, nf = fx == null ? cur.fx : fx;
      if (nm === "screen" && fx != null && !mode) nm = cur.mode; // picking an effect while sharing keeps sharing
      if (cur.mode === "screen" && nm !== "screen") { if (camRef.current.screen) { camRef.current.screen.onended = null; camRef.current.screen.stop(); camRef.current.screen = null; } socket.emit("live:share", { code: code, on: false }); annRef.current = { strokes: [], cur: null, laser: [] }; }
      modeRef.current = { mode: nm, fx: nf }; setVmode(nm); setFxName(nf);
      var ensureCam = Promise.resolve();
      if (nm === "camera" && !camRef.current.video && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        ensureCam = navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } }).then(function (st) { if (!alive.current) { st.getTracks().forEach(function (t) { t.stop(); }); return; } camRef.current.video = st.getVideoTracks()[0]; }).catch(function () { flash("Camera is blocked or busy."); });
      if (nm !== "camera" && camRef.current.video && nm === "off") { camRef.current.video.stop(); camRef.current.video = null; } // really release the camera
      ensureCam.then(function () { if (alive.current) refreshOut(); });
    }
    function stopScreen() {
      if (modeRef.current.mode !== "screen") return;
      var pv = prevLook.current; setLook(pv.mode === "screen" ? "camera" : pv.mode, pv.fx);
    }
    function startScreen() {
      if (modeRef.current.mode === "screen") return stopScreen();
      if (!SCREEN_OK) return flash("Screen sharing is not available on this phone or browser.");
      navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 24 } }, audio: false }).then(function (st) {
        if (!alive.current) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
        var tr = st.getVideoTracks()[0]; if (!tr) return;
        prevLook.current = { mode: modeRef.current.mode, fx: modeRef.current.fx };
        camRef.current.screen = tr; tr.onended = function () { stopScreen(); };
        modeRef.current = { mode: "screen", fx: modeRef.current.fx }; setVmode("screen");
        socket.emit("live:share", { code: code, on: true });
        refreshOut(); setVpanel(false); if (isHost) flash("Teaching tools are on: draw, point and highlight for everyone.");
      }).catch(function (e) { if (e && e.name !== "NotAllowedError" && e.name !== "AbortError") flash("Could not share your screen."); });
    }
    // pointer drawing on top of your own shared-screen preview
    function annPoint(e) {
      var el = e.currentTarget, r = el.getBoundingClientRect(), cv = pipe.current && pipe.current.cv; if (!cv) return null;
      var sc = Math.min(r.width / cv.width, r.height / cv.height), w = cv.width * sc, hh = cv.height * sc, ox = (r.width - w) / 2, oy = (r.height - hh) / 2;
      var nx = (e.clientX - r.left - ox) / w, ny = (e.clientY - r.top - oy) / hh;
      return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))];
    }
    function eraseAt(pt) {
      var A = annRef.current;
      A.strokes = A.strokes.filter(function (st) {
        var pts = st.pts.slice(); if (st.tool === "box") { var a = st.pts[0], b = st.pts[st.pts.length - 1]; pts = [a, b, [a[0], b[1]], [b[0], a[1]], [(a[0] + b[0]) / 2, a[1]], [(a[0] + b[0]) / 2, b[1]], [a[0], (a[1] + b[1]) / 2], [b[0], (a[1] + b[1]) / 2]]; }
        if (st.tool === "arrow") { var a2 = st.pts[0], b2 = st.pts[st.pts.length - 1]; pts = [a2, b2, [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2]]; }
        if (st.tool === "text") pts = [st.pts[0], [st.pts[0][0] + 0.04, st.pts[0][1] + 0.02], [st.pts[0][0] + 0.09, st.pts[0][1] + 0.02]];
        return !pts.some(function (q) { return Math.abs(q[0] - pt[0]) < 0.035 && Math.abs(q[1] - pt[1]) < 0.035; });
      });
    }
    function annDown(e) {
      var pt = annPoint(e); if (!pt) return; var A = annRef.current, t = teach.tool;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
      if (t === "text") { var tx = window.prompt("Text to show on the screen"); if (tx && tx.trim()) A.strokes.push({ tool: "text", color: teach.color, size: teach.size, pts: [pt], text: tx.trim().slice(0, 80) }); return; }
      if (t === "laser") { A.laser.push({ x: pt[0], y: pt[1], t: Date.now() }); A.laserDown = true; return; }
      if (t === "torch" && kind === "meeting") { A.torch = { x: pt[0], y: pt[1] }; A.torchDown = true; return; }
      if (t === "erase") { A.erasing = true; eraseAt(pt); return; }
      A.cur = { tool: t, color: teach.color, size: teach.size, pts: [pt] };
    }
    function annMove(e) {
      var A = annRef.current, pt = annPoint(e); if (!pt) return;
      if (A.laserDown) { A.laser.push({ x: pt[0], y: pt[1], t: Date.now() }); if (A.laser.length > 40) A.laser.shift(); return; }
      if (A.torchDown) { A.torch = { x: pt[0], y: pt[1] }; return; }
      if (A.erasing) return eraseAt(pt);
      if (!A.cur) return;
      if (A.cur.tool === "arrow" || A.cur.tool === "box") A.cur.pts = [A.cur.pts[0], pt]; else A.cur.pts.push(pt);
    }
    function annUp() { var A = annRef.current; A.laserDown = false; A.torchDown = false; A.erasing = false; if (A.cur) { A.strokes.push(A.cur); if (A.strokes.length > 200) A.strokes.shift(); A.cur = null; } }
    function pickImage(file) {
      if (!file) return;
      if (!/^image\//.test(file.type)) return flash("Choose a picture file.");
      if (file.size > 8 * 1024 * 1024) return flash("Choose a picture under 8 MB.");
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { imgRef.current = img; URL.revokeObjectURL(url); setLook("image"); };
      img.onerror = function () { URL.revokeObjectURL(url); flash("Could not open that picture."); };
      img.src = url;
    }

    // ---- start: camera first, then connect to the other people ----
    useEffect(function () {
      alive.current = true;
      var cancelled = false;
      function wantMedia() { return kind === "meeting" ? (S.media !== false) : isHost; }
      function getMedia() {
        if (!wantMedia() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(null);
        var wantVideo = info.video !== false;
        return navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } : false })
          .catch(function () { return navigator.mediaDevices.getUserMedia({ audio: true }).catch(function () { return null; }); });
      }
      getMedia().then(function (stream) {
        if (cancelled) { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        if (stream) {
          var out = new MediaStream();
          camRef.current.audio = stream.getAudioTracks()[0] || null; camRef.current.video = stream.getVideoTracks()[0] || null;
          if (camRef.current.audio) out.addTrack(camRef.current.audio);
          localRef.current = out;
          refreshOut();
        } else if (wantMedia() && CAN_PIPE) { localRef.current = new MediaStream(); refreshOut(); } // blocked camera and mic: others still see your card
        if (!stream && wantMedia()) flash("Camera or microphone is blocked. You can still use chat.");
        if (kind === "meeting") (info.peers || []).forEach(function (u) { if (u && u.id !== me.id) offerTo(u.id, true, false); });
        else if (!isHost && info.media) offerTo(info.hostId, false, true);
      });
      return function () { cancelled = true; alive.current = false; Object.keys(pcs.current).forEach(closePeer); var cr = camRef.current; if (cr.screen) { cr.screen.onended = null; cr.screen.stop(); } if (cr.video) cr.video.stop(); if (cr.audio) cr.audio.stop(); if (pipe.current) { clearInterval(pipe.current.timer); try { pipe.current.track && pipe.current.track.stop(); } catch (e) {} pipe.current = null; } if (localRef.current) localRef.current.getTracks().forEach(function (t) { t.stop(); }); localRef.current = null; };
    }, []); // eslint-disable-line

    // closing the tab or page also closes your seat, so a live never stays behind on the server
    useEffect(function () { var bye = function () { try { socket.emit(isHost && kind === "live" ? "live:end" : "live:leave", { code: code }); } catch (e) {} }; window.addEventListener("pagehide", bye); return function () { window.removeEventListener("pagehide", bye); }; }, []); // eslint-disable-line
    // ---- socket events ----
    useEffect(function () {
      var iHost = !!(info.host && info.host.id === me.id), loud = kind === "meeting" || iHost; // join / leave sounds: meetings, and the host of a live
      var onJoined = function (m) { if (m.code !== code) return; if (kind === "live" && m.user && m.user.id !== me.id) { var jn = m.user.name || "Someone"; setJoinNote(jn); setJoinLog(function (l) { return l.concat([{ id: "j" + Date.now() + "_" + m.user.id, sys: true, user: m.user, at: Date.now() }]).slice(-12); }); setTimeout(function () { setJoinNote(function (c) { return c === jn ? "" : c; }); }, 3500); } if (loud && m.user && m.user.id !== me.id) playSfx("join"); setPeople(function (x) { var n = Object.assign({}, x); n[m.user.id] = m.user; return n; }); if (kind === "live") setS(function (s) { return Object.assign({}, s); }); };
      var onLeft = function (m) { if (m.code !== code) return; if (loud && m.userId !== me.id) playSfx("leave"); closePeer(m.userId); setPeople(function (x) { if (!x[m.userId]) return x; var n = Object.assign({}, x); delete n[m.userId]; return n; }); if (m.host) setS(function (s) { return Object.assign({}, s, { hostId: m.host }); }); };
      var onCount = function (m) { if (m.code === code) setS(function (s) { return Object.assign({}, s, { viewers: m.viewers, gifts: m.gifts }); }); };
      var onChat = function (m) {
        if (m.code !== code) return;
        if (m.msg && m.msg.user && m.msg.user.id !== me.id && !m.msg.gift) playSfx("msg");
        setPeople(function (x) { if (x[m.msg.user.id]) return x; var n = Object.assign({}, x); n[m.msg.user.id] = m.msg.user; return n; });
        setS(function (s) { return Object.assign({}, s, { chat: s.chat.concat([m.msg]).slice(-80) }); });
      };
      var onPinned = function (m) { if (m.code === code && m.pinned) playSfx("pin"); if (m.code === code) setS(function (s) { return Object.assign({}, s, { pinned: m.pinned || null }); }); };
      var onMsgReact = function (m) { if (m.code !== code) return; setS(function (s) { return Object.assign({}, s, { chat: s.chat.map(function (c) { return c.id === m.msgId ? Object.assign({}, c, { reactions: m.reactions }) : c; }) }); }); };
      var onFx = function (m) {
        if (m.code !== code) return;
        var gdef = m.kind === "gift" ? giftDef(m.value) : null;
        if (m.kind === "gift" && m.user) {
          var now = Date.now(), ckey = m.user.id + ":" + m.value;
          var tl = tally.current[m.user.id] || (tally.current[m.user.id] = { name: m.user.name, n: 0 }); tl.n++; setMostN(function (x) { return x + 1; });
          setCombos(function (cs) { var found = false, nx = cs.map(function (c) { if (c.key === ckey && now - c.t < 6000) { found = true; return Object.assign({}, c, { n: c.n + 1, t: now }); } return c; }); if (!found) nx.push({ key: ckey, id: m.value, user: m.user, n: 1, t: now }); return nx.slice(-3); });
          setTimeout(function () { setCombos(function (cs) { return cs.filter(function (c) { return Date.now() - c.t < 4400; }); }); }, 4600);
          if (gdef && gdef[3] >= 2) { var bid = ++fxId.current, tier = gdef[3]; setBigGift({ id: bid, gift: m.value, user: m.user, tier: tier }); setTimeout(function () { setBigGift(function (b) { return b && b.id === bid ? null : b; }); }, tier === 3 ? 4300 : 3100); }
        }
        if ((m.kind === "emoji" && m.value === "\u2764\uFE0F") || (m.kind === "sticker" && (m.value === "heart" || m.value === "love"))) { setLikes(function (n) { return n + 1; }); if (m.user && m.user.id !== me.id) showLikeToast(m.user.name || "Someone"); }
        if (gdef && gdef[3] >= 2) { playSfx("gift"); return; } // the big animation plays instead of the small floating gift
        var id = ++fxId.current, g = m.kind === "sticker" ? glyph(STICKERS, m.value) : m.kind === "gift" ? glyph(GIFTS, m.value) : m.value;
        var ak = animKey(m.kind, m.value); if (!(kind === "meeting" && m.kind === "emoji")) playSfx(m.kind === "gift" ? "gift" : ak); // no emoji sounds in meetings (they still animate)
        setFloaters(function (f) { return f.concat([{ id: id, t: Date.now(), g: g, k: m.kind === "gift" ? "pop" : ak, x: 8 + Math.random() * 70, big: m.kind !== "emoji" }]).slice(-14); });
        setTimeout(function () { setFloaters(function (f) { return f.filter(function (x) { return x.id !== id; }); }); }, 2700);
      };
      var onShare = function (m) { if (m.code !== code) return; if (m.on && m.userId !== me.id) playSfx("share"); setSharing(function (x) { var n = Object.assign({}, x); if (m.on) n[m.userId] = true; else delete n[m.userId]; return n; }); };
      var onMention = function (m) { if (m.code === code) playSfx("mention"); if (m.code === code) flash(m.from + " mentioned you"); };
      var onEnded = function (m) { if (m.code === code) playSfx("end"); if (m.code === code) p.onClose(m.reason || "This live has ended"); };
      var onReconnect = function () { // network came back: take the seat again and rebuild the video links
        socket.emit("live:join", { code: code }, function (r) {
          if (!r || r.error) return p.onClose((r && r.error) || "This live has ended");
          Object.keys(pcs.current).forEach(closePeer);
          setS(function (s) { return Object.assign({}, s, { viewers: r.viewers, gifts: r.gifts, hostId: r.hostId, chat: r.chat || s.chat, pinned: r.pinned || null }); });
          if (kind === "meeting") (r.peers || []).forEach(function (u) { if (u && u.id !== me.id) offerTo(u.id, true, false); });
          else if (r.hostId !== me.id && r.media) offerTo(r.hostId, false, true);
        });
      };
      var onFollowed = function (m) { if (m.code !== code || !iHost || !m.user || m.user.id === me.id) return; showFollowToast(m.user.name || "Someone"); };
      var evs = { "live:followed": onFollowed, "live:joined": onJoined, "live:left": onLeft, "live:count": onCount, "live:chat": onChat, "live:msgreact": onMsgReact, "live:pinned": onPinned, "live:fx": onFx, "live:mention": onMention, "live:share": onShare, "live:ended": onEnded, "live:signal": onSignal };
      for (var k in evs) socket.on(k, evs[k]);
      var firstConnect = true;
      var onConn = function () { if (firstConnect) { firstConnect = false; return; } onReconnect(); };
      socket.on("connect", onConn); if (socket.connected) firstConnect = false;
      return function () { for (var k in evs) socket.off(k, evs[k]); socket.off("connect", onConn); };
    }, []); // eslint-disable-line

    useEffect(function () { var el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [S.chat.length, chatOpen, joinLog.length]);

    // ---- actions ----
    function send() {
      var t = text.trim(); if (!t) return;
      var ids = [], seen = {};
      (t.match(/@[^\s@]+/g) || []).forEach(function (tok) { var hnd = tok.slice(1).toLowerCase(); Object.keys(people).forEach(function (id) { var u = people[id]; if (u && id !== me.id && !seen[id] && String(u.name || "").replace(/\s+/g, "").toLowerCase() === hnd) { seen[id] = 1; ids.push(id); } }); });
      socket.emit("live:chat", { code: code, text: t, replyTo: replyTo ? { id: replyTo.id } : null, mentions: ids }, function (r) { if (r && r.error) flash(r.error); });
      setText(""); setReplyTo(null); setPicked(null);
    }
    var sendGift = function () { var now = Date.now(); if (now - lastGift.current < 300) return; lastGift.current = now; setGiftFx(now); setTimeout(function () { setGiftFx(0); }, 1100); fxSend("gift", selGift); };
    var sendLike = function () { var now = Date.now(); if (now - lastLike.current < 220) return; lastLike.current = now; setLikeFx(now); setTimeout(function () { setLikeFx(0); }, 1100); fxSend("emoji", "\u2764\uFE0F"); showLikeToast("__me"); };
    var toggleComments = function () { var v = !cmtOpen; setCmtOpen(v); if (v) setTimeout(function () { if (inputRef.current) inputRef.current.focus(); }, 60); };
    var toggleSave = function () { var v = !saved; setSaved(v); try { localStorage.setItem("lcSave:" + (S.host && S.host.id), v ? "1" : "0"); } catch (e) {} flash(v ? "Saved on this phone" : "Removed from saved"); };
    var toggleFollow = function () {
      var before = following, v = !before; setFollowing(v);
      try { localStorage.setItem("lcFollow:" + (S.host && S.host.id), v ? "1" : "0"); } catch (e) {}
      var sess = null; try { sess = JSON.parse(localStorage.getItem("letschat-africa:session") || "null"); } catch (e) {}
      var hid = S.host && S.host.id, hname = (S.host && S.host.name) || "this host";
      if (!sess || !sess.token || !hid || hid === me.id) return flash(v ? "You follow " + hname : "Unfollowed");
      var base = (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.API_URL) || "";
      fetch(base + "/api/me/follow/" + hid, { method: "POST", headers: { Authorization: "Bearer " + sess.token } })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && typeof d.following === "boolean") setFollowing(d.following); if (d && d.following) { try { socket.emit("live:followed", { code: code }); } catch (e) {} } flash(d && d.following ? "You follow " + hname : "Unfollowed"); })
        .catch(function () { setFollowing(before); flash("Couldn't update follow. Check your connection."); });
    };
    var fxSend = function (kindName, value) { socket.emit("live:fx", { code: code, kind: kindName, value: value }, function (r) { if (r && r.error) flash(r.error); }); };
    var pinMsg = function (m) { socket.emit("live:pin", { code: code, msgId: m ? m.id : null }, function (r) { if (r && r.error) flash(r.error); }); setPicked(null); };
    var reactMsg = function (m, e) { socket.emit("live:msgreact", { code: code, msgId: m.id, emoji: e }); setPicked(null); };
    var toggleMic = function () { var s = localRef.current; if (!s) return; var on = !mediaState.mic; s.getAudioTracks().forEach(function (t) { t.enabled = on; }); setMedia(Object.assign({}, mediaState, { mic: on })); };
    var toggleCam = function () { setLook(modeRef.current.mode === "off" ? "camera" : "off"); };
    var leave = function () { socket.emit(isHost && kind === "live" ? "live:end" : "live:leave", { code: code }); p.onClose(""); };
    var copy = function (t, msg) { try { navigator.clipboard.writeText(t).then(function () { flash(msg); }, function () { flash(t); }); } catch (e) { flash(t); } };
    var flipCam = function () {
      var next = facingRef_(facing) === "user" ? "environment" : "user";
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return flash("Camera switching is not available on this phone.");
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: next }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false }).then(function (st) {
        var nt = st.getVideoTracks()[0];
        if (!nt) return;
        if (!alive.current) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
        var old = camRef.current.video;
        camRef.current.video = nt;
        if (old && old !== nt) { try { old.stop(); } catch (e) {} }
        setFacing(next);
        if (typeof refreshOut === "function") refreshOut();
      }).catch(function () { flash(next === "environment" ? "Back camera is not available on this phone." : "Front camera is not available on this phone."); });
    };
    var facingRef_ = function (f) { return f; };
    var reshareLive = function () { var link = shareLink(code), msg = "Watch " + ((S.host && S.host.name) || "this live") + " live on Letschat. Code: " + code; if (navigator.share) navigator.share({ title: "Letschat Live", text: msg, url: link }).catch(function () {}); else copy(msg + " " + link, "Reshare link copied"); };
    var share = function () { var link = shareLink(code), msg = "Join my " + (kind === "meeting" ? "meeting" : "live") + " on Letschat. Code: " + code; if (navigator.share) navigator.share({ title: "Letschat Live", text: msg, url: link }).catch(function () {}); else copy(msg + " " + link, "Invite copied"); };
    var addAt = function () { setText(function (t) { return t + (t && !/\s$/.test(t) ? " @" : "@"); }); if (inputRef.current) inputRef.current.focus(); };

    // @ suggestions: who is already known in this room
    var tokenM = /(?:^|\s)@([^\s@]*)$/.exec(text), sugg = [];
    if (tokenM) { var q = tokenM[1].toLowerCase(); sugg = Object.keys(people).map(function (id) { return people[id]; }).filter(function (u) { return u && u.id !== me.id && String(u.name || "").replace(/\s+/g, "").toLowerCase().indexOf(q) === 0; }).slice(0, 5); }
    var pickMention = function (u) { setText(text.replace(/@[^\s@]*$/, "@" + String(u.name || "").replace(/\s+/g, "") + " ")); if (inputRef.current) inputRef.current.focus(); };

    // ---- render ----
    var renderText = function (t, mentions) { return String(t).split(/(@[^\s@]+)/g).map(function (part, i) { return /^@[^\s@]+$/.test(part) ? h("span", { key: i, style: { color: C.teal, fontWeight: 700 } }, part) : part; }); };
    var chips = function (m) {
      var r = m.reactions || {}, counts = {}, order = [];
      Object.keys(r).forEach(function (u) { var e = r[u]; if (!counts[e]) { counts[e] = 0; order.push(e); } counts[e]++; });
      if (!order.length) return null;
      return h("div", { style: { display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" } }, order.map(function (e) { return h("button", { key: e, onClick: function () { reactMsg(m, e); }, style: { background: r[me.id] === e ? "rgba(53,208,186,.3)" : "rgba(255,255,255,.14)", border: "none", borderRadius: 999, padding: "1px 7px", color: C.text, fontSize: 12.5, cursor: "pointer" } }, e + (counts[e] > 1 ? " " + counts[e] : "")); }));
    };
    var comment = function (m) {
      var sel = picked && picked.id === m.id, mentionedMe = (m.mentions || []).indexOf(me.id) >= 0;
      return h("div", { key: m.id, style: { marginBottom: tk ? 10 : 7 } },
        h("div", { onClick: function () { setPicked(sel ? null : m); }, onDoubleClick: function () { reactMsg(m, "\u2764\uFE0F"); },
          style: tk ? { display: "flex", gap: 10, alignItems: "center", background: sel ? "rgba(255,255,255,.14)" : mentionedMe ? "rgba(53,208,186,.22)" : "transparent", borderRadius: 14, padding: "2px 8px 2px 2px", maxWidth: "100%", width: "fit-content", cursor: "pointer", textShadow: "0 1px 5px rgba(0,0,0,.75)" } : { display: "flex", gap: 8, alignItems: "flex-start", background: mentionedMe ? "rgba(53,208,186,.2)" : "rgba(0,0,0,.38)", borderRadius: 14, padding: "6px 10px 6px 6px", maxWidth: "92%", width: "fit-content", cursor: "pointer", border: sel ? "1px solid " + C.teal : "1px solid transparent" } },
          h(Avatar, { user: m.user, size: tk ? 40 : 28 }),
          h("div", { style: { minWidth: 0, fontFamily: "Inter, sans-serif", fontSize: tk ? 14.5 : 13.5, color: C.text, lineHeight: 1.35, wordBreak: "break-word" } },
            m.reply && h("div", { style: { borderLeft: "2px solid " + C.teal, paddingLeft: 6, marginBottom: 3, color: C.dim, fontSize: 12 } }, "Reply to ", m.reply.name, ": ", m.reply.text),
            h("span", { style: tk ? { display: "block", color: "#fff", fontSize: 14.5 } : { color: C.dim } }, h(Name, { user: m.user }), tk ? null : " "),
            m.gift ? h("span", null, "sent " + ((giftDef(m.gift) && giftDef(m.gift)[2]) || "a gift") + " ", h("span", { style: { fontSize: 18 } }, giftArt(m.gift, 18)), m._n > 1 ? h("b", { style: { color: "#FFD43B", fontStyle: "italic" } }, " \u00D7" + m._n) : null) : renderText(m.text),
            chips(m))),
        sel && h("div", { style: { display: "flex", gap: 2, alignItems: "center", marginTop: 4, background: "#1E2530", border: "1px solid #2B3544", borderRadius: 999, padding: "4px 8px", width: "fit-content", maxWidth: "100%", overflowX: "auto" } },
          EMOJIS.slice(0, 7).map(function (e) { return h("button", { key: e, onClick: function () { reactMsg(m, e); }, style: { background: "none", border: "none", fontSize: 22, padding: "0 3px", cursor: "pointer" } }, e); }),
          h("button", { onClick: function () { setReplyTo(m); setPicked(null); if (inputRef.current) inputRef.current.focus(); }, style: { background: C.teal, color: "#0E1116", border: "none", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 12.5, marginLeft: 4, cursor: "pointer", flexShrink: 0 } }, "Reply"),
          canPin && h("button", { onClick: function () { pinMsg(S.pinned && S.pinned.id === m.id ? null : m); }, style: { background: "#FFD43B", color: "#0E1116", border: "none", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 12.5, marginLeft: 4, cursor: "pointer", flexShrink: 0 } }, S.pinned && S.pinned.id === m.id ? "Unpin" : "\uD83D\uDCCC Pin")));
    };

    var teaching = isHost && vmode === "screen" && CAN_PIPE;
    var drawLayer = teaching && toolsOpen && teach.tool !== "none" ? h("div", { onPointerDown: annDown, onPointerMove: annMove, onPointerUp: annUp, onPointerCancel: annUp, style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 4, touchAction: "none", cursor: teach.tool === "laser" ? "none" : "crosshair" } }) : null;
    var hostStream = isHost ? local : remotes[S.hostId];
    var tiles = [];
    if (kind === "meeting") {
      tiles.push({ id: me.id, user: me, stream: local, mine: true });
      Object.keys(remotes).forEach(function (id) { tiles.push({ id: id, user: people[id] || { name: "Guest" }, stream: remotes[id] }); });
    }
    tiles.sort(function (x, y) { return (x.id === S.hostId ? 0 : 1) - (y.id === S.hostId ? 0 : 1); }); // host first
    var isShareTile = function (t) { return t.mine ? vmode === "screen" : !!sharing[t.id]; };
    var tileEl = function (t, extra) {
      var contain = isShareTile(t);
      return h("div", { key: t.id, style: Object.assign({ position: "relative", borderRadius: 14, overflow: "hidden", background: "#1B2330", minHeight: 0 }, extra || {}) },
        t.mine && drawLayer,
        t.stream ? h(VideoEl, { stream: t.stream, muted: !!t.mine, mirror: !!t.mine && vmode === "camera" && facing === "user", style: contain ? { objectFit: "contain" } : {} }) : h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, h(Avatar, { user: t.user, size: 64 })),
        h("div", { style: { position: "absolute", left: 8, bottom: 6, background: "rgba(0,0,0,.55)", color: C.text, borderRadius: 8, padding: "2px 8px", fontFamily: "Inter, sans-serif", fontSize: 12.5 } }, t.mine ? "You" : (t.user.name || "Guest"), t.id === S.hostId ? " \uD83D\uDC51" : ""));
    };
    var sharer = null; tiles.forEach(function (t) { if (!sharer && isShareTile(t)) sharer = t; });
    var lay = sharer ? "spot" : LAYOUTS[layoutIdx][0], mainT = sharer || tiles[0], others = tiles.filter(function (t) { return t !== mainT; });
    var stageBox = { position: "absolute", left: 0, right: 0, top: 58, bottom: chatOpen ? "46%" : 150, padding: 6, background: "#000" };
    var meetingStage = null;
    if (kind !== "live") {
      if (tiles.length <= 1) meetingStage = h("div", { style: Object.assign({ display: "grid", gridTemplateColumns: "1fr" }, stageBox) }, tiles.map(function (t) { return tileEl(t); }));
      else if (lay === "grid") meetingStage = h("div", { style: Object.assign({ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }, stageBox) }, tiles.map(function (t) { return tileEl(t); }));
      else if (lay === "side") meetingStage = h("div", { style: Object.assign({ display: "grid", gridTemplateColumns: "1.45fr 1fr", gridTemplateRows: "repeat(" + others.length + ",minmax(0,1fr))", gap: 6 }, stageBox) }, tileEl(mainT, { gridRow: "1 / span " + others.length, gridColumn: 1 }), others.map(function (t) { return tileEl(t, { gridColumn: 2 }); }));
      else meetingStage = h("div", { style: stageBox }, h("div", { style: { position: "absolute", inset: 6, display: "flex" } }, tileEl(mainT, { flex: 1 })),
        h("div", { style: { position: "absolute", top: 14, right: 14, width: "30%", display: "flex", flexDirection: "column", gap: 6, maxHeight: "calc(100% - 28px)", overflowY: "auto", zIndex: 3 } }, others.map(function (t) { return tileEl(t, { height: 104, flexShrink: 0, border: "1px solid rgba(255,255,255,.25)" }); })));
    }
    var layoutChip = kind === "meeting" ? h("button", { onClick: function () { var n = (layoutIdx + 1) % LAYOUTS.length; setLayoutIdx(n); try { localStorage.setItem("lcLiveLayout", String(n)); } catch (e) {} }, style: { background: "rgba(0,0,0,.55)", color: C.text, border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" } }, "\u25A6 " + (sharer ? "Spotlight" : LAYOUTS[layoutIdx][1]) + " " + Math.max(1, tiles.length) + "/6") : null;
    var guestIds = kind === "live" ? Object.keys(people).filter(function (id) { return id !== S.hostId && people[id]; }) : [];
    var guestMode = kind === "live" && guestIds.length > 0;
    var guestShown = guestIds.slice(0, 6), guestMore = guestIds.length - guestShown.length;
    var guestStage = !guestMode ? null : h("div", { style: { position: "absolute", left: 0, right: 0, top: "calc(64px + env(safe-area-inset-top,0px))", bottom: "calc(" + ((window.innerHeight || 700) < 700 ? "26%" : "30%") + " + 74px + env(safe-area-inset-bottom,0px))", background: "#000", padding: "6px 10px 6px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" } },
      // host card on top: crown badge, number 1, name and tick
      h("div", { style: { position: "relative", flex: "1 1 46%", minHeight: 0, borderRadius: 20, overflow: "hidden", background: "#1B2330", border: "1px solid rgba(255,255,255,.14)" } },
        drawLayer,
        hostStream ? h(VideoEl, { stream: hostStream, muted: isHost, mirror: isHost && vmode === "camera" && facing === "user", style: (isHost ? vmode === "screen" : sharing[S.hostId]) ? { objectFit: "contain" } : {} }) : h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, h(Avatar, { user: S.host, size: 84 })),
        h("span", { style: { position: "absolute", left: 8, top: 8, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.55)", borderRadius: 999, padding: "3px 12px 3px 4px", color: "#fff", fontWeight: 800, fontSize: 14 } }, h("span", { style: { width: 24, height: 24, borderRadius: 24, background: "#FFC21A", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 } }, "\uD83D\uDC51"), "Host"),
        h("span", { style: { position: "absolute", right: 8, top: 8, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,.55)", borderRadius: 999, padding: "4px 11px", color: "#fff", fontWeight: 800, fontSize: 14 } }, Ico("person", 14, "#fff"), "1"),
        h("div", { style: { position: "absolute", left: 8, bottom: 8, display: "inline-flex", alignItems: "center", gap: 7, color: "#fff", fontWeight: 800, fontSize: 15, textShadow: "0 1px 6px rgba(0,0,0,.7)" } }, h(Avatar, { user: S.host, size: 30 }), (S.host && S.host.name) || "", S.host && S.host.verified ? h("img", { src: "icons/verified.png", alt: "verified", style: { width: 16, height: 16 } }) : null),
        !isHost && h("button", { onClick: toggleFollow, style: { position: "absolute", right: 8, bottom: 8, background: following ? "rgba(255,255,255,.22)" : "#FF2D55", color: "#fff", border: "none", borderRadius: 999, padding: "6px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" } }, following ? "Following" : "Follow")),
      // invited users who joined, in a grid like the design: number, picture or video, name, mic
      h("div", { style: { flex: "1 1 54%", minHeight: 0, marginRight: ((window.innerHeight || 700) < 700 ? 48 : 58) + 22, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gridAutoRows: "minmax(0,1fr)", gap: 8, overflow: "hidden" } },
        guestShown.map(function (id, i) {
          var u = people[id], mine = id === me.id, st = mine ? local : remotes[id];
          return h("div", { key: id, style: { position: "relative", borderRadius: 16, overflow: "hidden", background: "linear-gradient(160deg,#2A2F6B,#1B2330)", border: "1px solid rgba(255,255,255,.12)", minHeight: 0 } },
            st ? h(VideoEl, { stream: st, muted: !!mine, mirror: !!mine && vmode === "camera" && facing === "user", style: {} }) : h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, h(Avatar, { user: u, size: 52 })),
            h("span", { style: { position: "absolute", left: 6, top: 6, display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,.55)", borderRadius: 999, padding: "2px 9px", color: "#fff", fontWeight: 800, fontSize: 12.5 } }, Ico("person", 12, "#fff"), String(i + 2)),
            h("div", { style: { position: "absolute", left: 5, right: 5, bottom: 5, display: "flex", alignItems: "center", gap: 5 } },
              h(Avatar, { user: u, size: 22 }),
              h("span", { style: { flex: 1, minWidth: 0, color: "#fff", fontWeight: 700, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 4px rgba(0,0,0,.8)" } }, mine ? "You" : (u.name || "Guest")),
              h("span", { style: { width: 22, height: 22, borderRadius: 22, background: "rgba(0,0,0,.55)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 } }, "\uD83C\uDF99")));
        }),
        guestMore > 0 ? h("button", { "aria-label": "See everyone", onClick: function () { setProfOpen("people"); }, style: { borderRadius: 16, border: "1px solid rgba(255,255,255,.12)", background: "#1B2330", color: "#fff", fontWeight: 800, fontSize: 18, cursor: "pointer" } }, "+" + guestMore) : null));
    var stage = guestMode ? guestStage : kind === "live"
      ? h("div", { style: { position: "absolute", left: 0, right: 0, top: 0, bottom: "calc(74px + env(safe-area-inset-bottom,0px))", background: "#000" } },
          drawLayer,
          hostStream ? h(VideoEl, { stream: hostStream, muted: isHost, mirror: isHost && vmode === "camera" && facing === "user", style: (isHost ? vmode === "screen" : sharing[S.hostId]) ? { objectFit: "contain" } : {} }) : h("div", { style: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: C.dim, fontFamily: "Inter, sans-serif", textAlign: "center", padding: 24 } },
            h(Avatar, { user: S.host, size: 84 }),
            h("div", { style: { color: C.text, fontWeight: 700, fontSize: 17 } }, S.host && S.host.name),
            h("div", null, S.media === false ? "The video is full right now. You are in the chat and can still send gifts and stickers." : isHost ? "Starting your camera\u2026" : "Connecting to the live\u2026")))
      : meetingStage;

    var panelItems = panel === "stickers" ? STICKERS.map(function (s) { return [s[0], s[1]]; }) : panel === "gifts" ? GIFTS : panel === "emoji" ? EMOJIS.map(function (e) { return [e, e]; }) : [];
    var idle = tk ? "rgba(255,255,255,.2)" : "#2B3544";
    var onPanelPick = function (it) { if (panel === "stickers") fxSend("sticker", it[0]); else if (panel === "gifts") { fxSend("gift", it[0]); setPanel(null); } else fxSend("emoji", it[0]); };

    var viewerFaces = Object.keys(people).filter(function (id) { return id !== S.hostId; }).slice(0, 3);
    var chipS = { background: "rgba(0,0,0,.42)", color: "#fff", borderRadius: 999, padding: "5px 11px", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", border: "none", flexShrink: 0 };
    var topTK = h("div", { style: { position: "relative", zIndex: 5, display: "flex", alignItems: "center", gap: 8, padding: "calc(10px + env(safe-area-inset-top,0px)) 10px 6px", background: "linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,0))" } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.42)", borderRadius: 999, padding: "4px 6px 4px 4px", minWidth: 0, maxWidth: "58%" } },
        h(Avatar, { user: S.host, size: 36 }),
        h("div", { style: { minWidth: 0, color: C.text } }, h("div", { style: { fontSize: 11.5, color: "#E6EAF0" } }, "\u2764\uFE0F " + fmt(likes))),
        !isHost && h("button", { onClick: toggleFollow, style: { background: following ? "rgba(255,255,255,.22)" : "#FE2C55", color: "#fff", border: "none", borderRadius: 999, padding: "7px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0 } }, following ? "Following" : "+ Follow")),
      h("div", { style: { flex: 1 } }),
      viewerFaces.length > 0 && h("div", { style: { display: "flex" } }, viewerFaces.map(function (id, i) { return h("span", { key: id, style: { marginLeft: i ? -10 : 0, border: "2px solid rgba(0,0,0,.6)", borderRadius: "50%", display: "inline-flex" } }, h(Avatar, { user: people[id], size: 26 })); })),
      h("span", { style: { background: "rgba(0,0,0,.45)", color: C.text, borderRadius: 999, padding: "5px 10px", fontSize: 13, fontWeight: 700 } }, fmt(S.viewers)),
      h("button", { "aria-label": "Leave", onClick: leave, style: round("rgba(0,0,0,.45)", 32) }, "\u2715"));
    var chipTK = h("div", { style: { position: "relative", zIndex: 5, display: "flex", gap: 6, padding: "0 10px", alignItems: "center", overflowX: "auto" } },
      h("span", { className: "lc-pulse", style: { background: C.red, color: "#fff", borderRadius: 6, padding: "4px 9px", fontWeight: 800, fontSize: 11.5, animation: "lcPulse 1.6s infinite", flexShrink: 0 } }, "LIVE"),
      S.viewers >= 5 && h("span", { style: Object.assign({}, chipS, { color: "#FFB020" }) }, "\uD83D\uDD25 Popular LIVE"),
      S.gifts > 0 && h("span", { style: chipS }, "\uD83C\uDF81 " + fmt(S.gifts)),
      info.title && info.title !== "Live now" && h("span", { style: Object.assign({}, chipS, { overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }) }, info.title));
    var topBar = tk ? topTK : (
      h("div", { style: { position: "relative", zIndex: 5, display: "flex", alignItems: "center", gap: 8, padding: "calc(10px + env(safe-area-inset-top,0px)) 10px 8px", background: "linear-gradient(rgba(0,0,0,.7),rgba(0,0,0,0))" } },
        h(Avatar, { user: S.host, size: 36 }),
        h("div", { style: { minWidth: 0, flex: 1, color: C.text } }, h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, info.title), h("div", { style: { fontSize: 12, color: C.dim } }, S.host && S.host.name)),
        h("span", { className: "lc-pulse", style: { background: C.red, color: "#fff", borderRadius: 8, padding: "3px 9px", fontWeight: 800, fontSize: 12, animation: "lcPulse 1.6s infinite" } }, kind === "meeting" ? "MEETING" : "LIVE"),
        h("span", { style: { background: "rgba(0,0,0,.55)", color: C.text, borderRadius: 999, padding: "4px 10px", fontSize: 13, fontWeight: 700 } }, "\uD83D\uDC41 " + S.viewers),
        h("button", { "aria-label": "Leave", onClick: leave, style: round("rgba(0,0,0,.55)", 34) }, "\u2715"))
    );
    var chipRow = tk ? chipTK : (
      h("div", { style: { position: "relative", zIndex: 5, display: "flex", gap: 6, padding: "0 10px", alignItems: "center" } },
        kind === "meeting" && h("button", { onClick: function () { copy(code, "Code copied"); }, style: { background: "rgba(124,92,255,.85)", color: "#fff", border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 800, letterSpacing: 2, fontSize: 13, cursor: "pointer" } }, "Code " + code + "  \u29C9"),
        kind === "meeting" && h("button", { onClick: share, style: { background: "rgba(0,0,0,.55)", color: C.text, border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" } }, "Invite"),
        S.gifts > 0 && h("span", { style: { color: C.text, fontSize: 12.5, background: "rgba(0,0,0,.55)", borderRadius: 999, padding: "5px 10px" } }, "\uD83C\uDF81 " + S.gifts),
        layoutChip)
    );
    var railBtn = function (icon, label, onClick, aria, on) { return h("button", { "aria-label": aria, onClick: onClick, style: { background: "none", border: "none", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,.6)" } }, h("span", { style: { fontSize: 30, lineHeight: "34px", filter: on ? "drop-shadow(0 2px 6px rgba(255,60,100,.7))" : "grayscale(1) brightness(1.9) drop-shadow(0 2px 4px rgba(0,0,0,.5))" } }, icon), label != null && h("span", null, label)); };
    var likeOn = Date.now() - likeFx < 1100, giftOn = Date.now() - giftFx < 1100;
    var railEl = tk ? h("div", { style: { position: "absolute", right: 8, bottom: isHost ? 120 : 60, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 } },
      !isHost && h("div", { style: { position: "relative", marginBottom: 6 } }, h(Avatar, { user: S.host, size: 46 }), !following && h("button", { "aria-label": "Follow", onClick: toggleFollow, style: { position: "absolute", left: 11, bottom: -9, width: 24, height: 24, borderRadius: 24, background: "#FE2C55", color: "#fff", border: "2px solid #0B0F16", fontWeight: 800, fontSize: 15, lineHeight: "17px", padding: 0, cursor: "pointer" } }, "+")),
      railBtn(likeOn ? "\u2764\uFE0F" : "\uD83E\uDD0D", fmt(likes), sendLike, "Like", likeOn),
      railBtn("\uD83D\uDCAC", fmt(S.chat.length), toggleComments, "Comments", cmtOpen),
      shareOpen && h("div", { style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" } },
        h("button", { onClick: function () { setShareOpen(false); share(); }, style: { background: "rgba(0,0,0,.55)", color: "#fff", border: "none", borderRadius: 999, padding: "7px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" } }, "Send link"),
        h("button", { onClick: function () { toggleSave(); setShareOpen(false); }, style: { background: saved ? "#FFD43B" : "rgba(0,0,0,.55)", color: saved ? "#111" : "#fff", border: "none", borderRadius: 999, padding: "7px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" } }, saved ? "Saved \u2713" : "Save")),
      railBtn("\u2197\uFE0F", "Share", function () { setShareOpen(!shareOpen); }, "Share", shareOpen),
      !isHost && railBtn("\uD83D\uDD01", "Reshare", reshareLive, "Reshare", false),
      h("div", { style: { width: 44, height: 44, borderRadius: 44, border: "3px solid #1B2330", overflow: "hidden", animation: "lcSpin 6s linear infinite", marginTop: 4 } }, h(Avatar, { user: S.host, size: 38 }))) : null;
    var comboEl = h("div", { style: { position: "absolute", left: 10, top: tk ? "calc(336px + env(safe-area-inset-top,0px))" : "38%", zIndex: 7, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 8 } },
      combos.map(function (c) { var gd = giftDef(c.id); return h("div", { key: c.key, className: "lc-toast", style: { display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(90deg,rgba(0,0,0,.6),rgba(0,0,0,.25))", borderRadius: 999, padding: "4px 14px 4px 4px", animation: "lcToastIn .35s ease-out" } },
        h(Avatar, { user: c.user, size: 34 }),
        h("div", { style: { color: "#fff", fontSize: 12.5, lineHeight: 1.2, maxWidth: 110 } }, h("div", { style: { fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.user && c.user.name), h("div", { style: { color: "#E6EAF0", fontSize: 11.5 } }, "sent " + (gd ? gd[2] : "a gift"))),
        h("span", { style: { fontSize: 32, lineHeight: 1 } }, giftArt(c.id, 32)),
        c.n > 1 && h("span", { key: c.n, className: "lc-combo", style: { fontSize: 26, fontWeight: 900, fontStyle: "italic", color: "#FFD43B", textShadow: "0 2px 8px rgba(0,0,0,.6)", animation: "lcComboPop .3s ease-out" } }, "\u00D7" + c.n)); }));
    var bigGd = bigGift ? giftDef(bigGift.gift) : null, bigSz = bigGift && bigGift.tier === 3 ? 170 : 130;
    var bigEl = bigGift ? h("div", { key: bigGift.id, style: { position: "absolute", left: 0, right: 0, top: "24%", height: "36%", zIndex: 7, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
      bigGift.tier === 3 && h("div", { className: "lc-big", style: { position: "fixed", inset: 0, background: "radial-gradient(circle at 50% 45%,rgba(255,215,64,.38),rgba(124,92,255,.2) 55%,rgba(0,0,0,0))", animation: "lcFlash 2.6s ease-out forwards" } }),
      [[12, 8, 0], [78, 14, .25], [20, 64, .5], [70, 60, .15], [48, 2, .4]].map(function (sp, i) { return h("span", { key: i, className: "lc-spark", style: { position: "absolute", left: sp[0] + "%", top: sp[1] + "%", fontSize: 26, animation: "lcSpark 1.6s ease-out " + sp[2] + "s infinite" } }, "\u2728"); }),
      h("div", { className: "lc-big", style: { fontSize: bigSz, lineHeight: 1, filter: "drop-shadow(0 8px 24px rgba(255,120,200,.6))", animation: "lcBigGift " + (bigGift.tier === 3 ? "4.2" : "3") + "s ease-in-out forwards" } }, giftArt(bigGift.gift, bigSz)),
      h("div", { className: "lc-big", style: { marginTop: 8, color: "#fff", fontWeight: 800, fontSize: 16, textShadow: "0 2px 10px rgba(0,0,0,.7)", animation: "lcBigGift " + (bigGift.tier === 3 ? "4.2" : "3") + "s ease-in-out forwards" } }, ((bigGift.user && bigGift.user.name) || "Someone") + " sent " + (bigGd ? bigGd[2] : "a gift"))) : null;
    var mostSent = null; Object.keys(tally.current).forEach(function (id) { var t1 = tally.current[id]; if (!mostSent || t1.n > mostSent.n) mostSent = t1; });
    var feed = []; S.chat.forEach(function (m) { var last = feed[feed.length - 1]; if (m.gift && last && last.gift === m.gift && last.user && m.user && last.user.id === m.user.id) feed[feed.length - 1] = Object.assign({}, m, { _n: (last._n || 1) + 1 }); else feed.push(m); });
    if (tk && joinLog.length) feed = feed.concat(joinLog).sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    var sysRow = function (j) { return h("div", { key: j.id, style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, textShadow: "0 1px 5px rgba(0,0,0,.75)" } }, h("span", { style: { width: 38, height: 38, borderRadius: 38, background: "#1E2530", border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, Ico("person", 22, "#fff")), h("span", { style: { color: "#fff", fontWeight: 700, fontSize: 14.5 } }, ((j.user && j.user.name) || "Someone") + " joined the live")); };
    var giftGrid = h("div", null,
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, maxHeight: 204, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 } },
        GIFTS.map(function (it) { var on = selGift === it[0]; return h("button", { key: it[0], onClick: function () { setSelGift(it[0]); }, style: { position: "relative", background: on ? "rgba(254,44,85,.16)" : "#1E2530", border: "1px solid " + (on ? "#FE2C55" : "#2B3544"), borderRadius: 12, padding: "8px 2px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: C.text } },
          it[3] === 3 && h("span", { style: { position: "absolute", top: 3, right: 5, fontSize: 9, fontWeight: 800, color: "#FFD43B" } }, "BIG"),
          h("span", { style: { fontSize: 30, lineHeight: "36px" } }, giftArt(it[0], 30)), h("span", { style: { fontSize: 11.5, fontWeight: 600 } }, it[2]), h("span", { style: { fontSize: 10, color: C.dim } }, "Free")); })),
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, gap: 8 } }, h("span", { style: { color: C.dim, fontSize: 12 } }, "Tap Send again and again for a combo"),
        h("button", { onClick: sendGift, style: { background: "linear-gradient(135deg,#FF4D8D,#FF8A3D)", color: "#fff", border: "none", borderRadius: 999, padding: "9px 24px", fontWeight: 800, fontSize: 14, cursor: "pointer", flexShrink: 0 } }, "Send " + (giftDef(selGift) ? giftDef(selGift)[2] : ""))));

    // ---------------------------------------------------------------- Go Live screen, laid out like the design:
    // LIVE + viewers + three dot menu, host profile + Follow, follower toast, record buttons on the left, Share / Like / Message / Gift / Profile
    // on the right, comments, "Add a comment..." with quick emojis, and the bottom bar.
    var tkNav = null, tkSheet = null, tkExtra = null, tkInput = null;
    var short = (window.innerHeight || 700) < 700;
    if (tk) {
      var RED = "#FF2D55", DARK = "rgba(20,24,32,.82)", RING = "1px solid rgba(255,255,255,.12)", SAFE = "env(safe-area-inset-bottom,0px)", SAFE_T = "env(safe-area-inset-top,0px)", NAVH = 74;
      var RB = short ? 48 : 58, RG = short ? 10 : 12;
      var circ = function (inner, onClick, aria, size, bg, bd, extra) { return h("button", { "aria-label": aria, onClick: onClick, style: Object.assign({ position: "relative", width: size, height: size, borderRadius: size, background: bg, border: bd, padding: 0, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }, extra || {}) }, inner); };
      var recTap = REC_OK ? startRec : function () { flash("Recording is not supported on this phone or browser."); };
      var camTap = isHost ? toggleCam : function () { flash("Only the host can turn the live video on or off."); };
      var focusComment = function () { setPanel(null); if (inputRef.current) inputRef.current.focus(); };
      var openGifts = function () { setPanel(panel === "gifts" ? null : "gifts"); };
      var hostName = (S.host && S.host.name) || "";
      var chatN = S.chat.length > 99 ? "99+" : String(S.chat.length);

      // top: LIVE, viewers, menu, then the host profile with Follow
      topBar = h("div", { style: { position: "relative", zIndex: 5, background: "linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,0))", paddingBottom: 6 } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "calc(12px + " + SAFE_T + ") 12px 0" } },
          h("span", { style: { display: "inline-flex", alignItems: "center", gap: 7, background: RED, color: "#fff", borderRadius: 999, padding: "8px 16px", fontWeight: 800, fontSize: 15, letterSpacing: 0.3 } }, h("span", { className: "lc-pulse", style: { width: 9, height: 9, borderRadius: 9, background: "#fff", animation: "lcPulse 1.6s infinite" } }), "LIVE"),
          h("button", { "aria-label": "People in this live", onClick: function () { setProfOpen("people"); }, style: { display: "inline-flex", alignItems: "center", gap: 7, background: DARK, border: RING, color: "#fff", borderRadius: 999, padding: "7px 14px", fontWeight: 700, fontSize: 15, cursor: "pointer" } }, Ico("eye", 18, "#fff"), fmt(S.viewers)),
          viewerFaces.length > 0 && h("button", { "aria-label": "People in this live", onClick: function () { setProfOpen("people"); }, style: { display: "inline-flex", background: "none", border: "none", padding: 0, cursor: "pointer" } }, viewerFaces.map(function (id, i) { return h("span", { key: id, style: { marginLeft: i ? -10 : 0, border: "2px solid rgba(0,0,0,.6)", borderRadius: "50%", display: "inline-flex" } }, h(Avatar, { user: people[id], size: 30 })); })),
          h("div", { style: { flex: 1 } }),
          h("button", { "aria-label": "More options", onClick: function () { setMenuOpen(true); }, style: { background: "none", border: "none", padding: 8, cursor: "pointer", display: "flex" } }, MoreIco(26, "#fff"))),
        guestMode ? null : h("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "14px 12px 0" } },
          h("button", { "aria-label": "Host profile", onClick: function () { setProfOpen("profile"); }, style: { background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: "50%", boxShadow: "0 0 0 2px rgba(255,255,255,.85)", display: "flex" } }, h(Avatar, { user: S.host, size: 64 })),
          h("div", { style: { minWidth: 0 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 6, color: "#fff", fontWeight: 700, fontSize: 18, textShadow: "0 1px 6px rgba(0,0,0,.6)" } },
              h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 } }, hostName),
              S.host && S.host.verified ? h("img", { src: "icons/verified.png", alt: "verified", style: { width: 18, height: 18 } }) : null),
            !isHost && h("button", { onClick: toggleFollow, style: { marginTop: 6, background: following ? "rgba(255,255,255,.22)" : RED, color: "#fff", border: "none", borderRadius: 999, padding: "7px 26px", fontWeight: 700, fontSize: 15, cursor: "pointer" } }, following ? "Following" : "Follow"))));
      chipRow = null;

      // right column: Share, Like (with count), Message (with badge), Gift, Profile
      var railBottom = "calc(" + (NAVH + 10) + "px + " + SAFE + ")";
      railEl = h("div", { style: { position: "absolute", right: 12, bottom: railBottom, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: RG } },
        circ(Ico("share", RB * 0.48, RED), share, "Share", RB, DARK, RING),
        circ([h("span", { key: "i", style: { display: "flex", transform: likeOn ? "scale(1.25)" : "none", transition: "transform .15s" } }, Ico("heart", RB * 0.44, RED)), h("span", { key: "n", style: { fontSize: 11.5, fontWeight: 700, marginTop: 1, lineHeight: 1 } }, fmt(likes))], sendLike, "Like", RB, DARK, RING),
        circ([ChatIco(RB * 0.5, "#fff"), S.chat.length > 0 ? h("span", { key: "b", style: { position: "absolute", top: -5, right: -4, minWidth: 22, height: 22, borderRadius: 11, background: RED, color: "#fff", fontSize: 12.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", boxSizing: "border-box", border: "2px solid #0B0F16" } }, chatN) : null], focusComment, "Messages", RB, DARK, RING),
        circ(Ico("gift", RB * 0.5, RED), openGifts, "Gift", RB, DARK, RING),
        circ(Ico("person", RB * 0.5, "#fff"), function () { setProfOpen("profile"); }, "Profile", RB, DARK, RING));

      // left column: screen record, live video; plus the follower and like cards
      var leftBtns = h("div", { style: { position: "absolute", left: 12, top: "calc(" + (short ? 160 : 196) + "px + " + SAFE_T + ")", zIndex: 6, display: "flex", flexDirection: "column", gap: short ? 8 : 12 } },
        circ(recSec == null ? Ico("cam", 28, "#fff") : h("span", { style: { fontSize: 13, fontWeight: 800 } }, recLabel), recTap, recSec == null ? "Screen record" : "Stop recording", RB, recSec == null ? DARK : RED, RING));
      var followEl = followToast ? h("div", { key: "f" + followToast, className: "lc-toast", style: { position: "absolute", right: 12, top: "calc(84px + " + SAFE_T + ")", zIndex: 7, display: "flex", alignItems: "center", gap: 10, background: "rgba(20,24,32,.92)", border: RING, borderRadius: 18, padding: "8px 12px 8px 10px", minWidth: 150, maxWidth: "calc(100% - 232px)", animation: "lcToastR .35s ease-out" } },
        Ico("person", 26, "#fff"),
        h("div", { style: { color: "#fff", minWidth: 0 } }, h("div", { style: { fontWeight: 700, fontSize: 14 } }, "New follower"), h("div", { style: { fontSize: 12, color: "#E6EAF0", lineHeight: 1.25, wordBreak: "break-word" } }, followToast + " just followed you!"))) : null;
      var likeEl = likeToast ? h("div", { key: "l" + likeToast, className: "lc-toast", style: { position: "absolute", right: 12 + RB + 10, bottom: "calc(" + (NAVH + 10 + 3 * (RB + RG) + Math.round(RB / 2) - 28) + "px + " + SAFE + ")", zIndex: 7, display: "flex", alignItems: "center", gap: 10, background: "rgba(20,24,32,.92)", border: RING, borderRadius: 18, padding: "9px 16px 9px 12px", maxWidth: "62%", animation: "lcToastUp .25s ease-out" } },
        Ico("heart", 26, RED),
        h("div", { style: { color: "#fff", minWidth: 0 } }, h("div", { style: { fontWeight: 700, fontSize: 15 } }, "Liked!"), h("div", { style: { fontSize: 12.5, color: "#E6EAF0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, likeToast === "__me" ? "You liked this live" : isHost ? "You got a like from " + likeToast : likeToast + " liked this live"))) : null;
      tkExtra = h(React.Fragment, null, panel ? null : leftBtns, followEl, likeEl);

      // comment box (sits where the old bottom panel was)
      tkInput = null;
      // bottom bar
      tkNav = h("div", { style: { position: "relative", zIndex: 9, minHeight: "calc(" + NAVH + "px + " + SAFE + ")", boxSizing: "border-box", display: "flex", alignItems: "flex-start", padding: "10px 12px 0", background: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.6))" } },
        h("div", { style: { flex: 1, display: "flex", alignItems: "center", background: DARK, border: "none", outline: "none", boxShadow: "none", borderRadius: 999, height: 52, padding: "0 8px 0 18px" } },
          h("input", { ref: inputRef, value: text, maxLength: 300, placeholder: "Add a comment\u2026", onChange: function (e) { setText(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") send(); }, style: { flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 16 } }),
          text.trim()
            ? h("button", { "aria-label": "Send", onClick: send, style: round(RED, 36) }, "\u27A4")
            : h("button", { "aria-label": "Emojis and stickers", onClick: function () { setPanel(panel === "emoji" || panel === "stickers" ? null : "emoji"); }, style: { background: "none", border: "none", padding: 6, display: "flex", cursor: "pointer" } }, SmileIco(30, "#fff"))));

      // three dot menu and the profile / viewers sheet
      var menuItems = [];
      if (isHost) {
        menuItems.push([mediaState.mic ? "\uD83C\uDF99  Mute microphone" : "\uD83D\uDD07  Unmute microphone", toggleMic]);
        if (info.video !== false) {
          menuItems.push(["\uD83D\uDD04  Flip camera", flipCam, vmode === "off" || vmode === "screen"]);
          menuItems.push([vmode === "screen" ? "\uD83D\uDDA5  Stop sharing screen" : "\uD83D\uDDA5  Share screen", startScreen]);
          menuItems.push(["\u2728  Video effects and picture", function () { setVpanel(true); setPanel(null); }]);
          if (faceCapable()) menuItems.push(["\uD83D\uDE03  Face tracker", function () { setVpanel(true); setPanel(null); }]);
        }
        if (teaching) menuItems.push(["\uD83E\uDDF0  Drawing tools", function () { setToolsOpen(!toolsOpen); }]);
      }
      menuItems.push(["\u2197\uFE0F  Share invite link", share]);
      menuItems.push([saved ? "\u2714  Remove from saved" : "\uD83D\uDD16  Save this live", toggleSave]);
      if (!isHost) menuItems.push(["\uD83D\uDD01  Reshare", reshareLive]);
      menuItems.push([isHost ? "\u260E  End live" : "\uD83D\uDEAA  Leave live", leave, false, true]);
      var closeSheets = function () { setMenuOpen(false); setProfOpen(false); };
      var stat = function (n, label) { return h("div", { key: label, style: { flex: 1, textAlign: "center" } }, h("div", { style: { color: "#fff", fontWeight: 800, fontSize: 18 } }, n), h("div", { style: { color: C.dim, fontSize: 12 } }, label)); };
      var peopleIds = Object.keys(people);
      tkSheet = (menuOpen || profOpen) ? h("div", { style: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, background: menuOpen ? "transparent" : "rgba(0,0,0,.5)" }, onClick: closeSheets },
        menuOpen ? h("div", { onClick: function (e) { e.stopPropagation(); }, style: { position: "absolute", right: 12, top: "calc(56px + " + SAFE_T + ")", minWidth: 240, maxHeight: "70%", overflowY: "auto", background: "#1B212B", border: "1px solid #2B3544", borderRadius: 16, padding: 6, boxShadow: "0 12px 32px rgba(0,0,0,.55)" } },
          menuItems.map(function (it, i) { var dis = !!it[2], danger = !!it[3]; return h("button", { key: i, disabled: dis, onClick: function () { setMenuOpen(false); it[1](); }, style: { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderTop: danger ? "1px solid #2B3544" : "none", color: danger ? "#FF6B84" : C.text, fontSize: 15, fontWeight: danger ? 700 : 500, padding: "12px 14px", cursor: "pointer", opacity: dis ? 0.4 : 1, whiteSpace: "nowrap" } }, it[0]); }))
        : h("div", { onClick: function (e) { e.stopPropagation(); }, style: { position: "absolute", left: 0, right: 0, bottom: "calc(" + NAVH + "px + " + SAFE + ")", background: "#161B22", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "18px 16px 18px", maxHeight: "62%", overflowY: "auto" } },
          profOpen === "people"
            ? h("div", null, h("div", { style: { color: "#fff", fontWeight: 800, fontSize: 17, marginBottom: 12 } }, "In this live (" + fmt(Math.max(S.viewers, peopleIds.length)) + ")"),
                peopleIds.sort(function (x, y) { return x === S.hostId ? -1 : y === S.hostId ? 1 : 0; }).map(function (id) { var u = people[id]; if (!u) return null; return h("div", { key: id, style: { display: "flex", alignItems: "center", gap: 12, padding: "7px 0" } }, h(Avatar, { user: u, size: 40 }), h("div", { style: { color: "#fff", fontSize: 15, flex: 1, minWidth: 0 } }, h(Name, { user: u }), id === me.id ? " (you)" : ""), id === S.hostId ? h("span", { style: { background: RED, color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 800 } }, "HOST") : null); }),
                peopleIds.length <= 1 ? h("div", { style: { color: C.dim, fontSize: 13.5, textAlign: "center", padding: "14px 0 4px" } }, "Nobody else has joined yet.", h("div", null, h("button", { onClick: function () { closeSheets(); share(); }, style: { marginTop: 10, background: RED, color: "#fff", border: "none", borderRadius: 999, padding: "10px 22px", fontWeight: 800, fontSize: 14.5, cursor: "pointer" } }, "Invite people"))) : null)
            : h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 } },
                h(Avatar, { user: S.host, size: 76 }),
                h("div", { style: { color: "#fff", fontWeight: 800, fontSize: 19, display: "flex", alignItems: "center", gap: 6 } }, hostName, S.host && S.host.verified ? h("img", { src: "icons/verified.png", alt: "verified", style: { width: 18, height: 18 } }) : null),
                h("div", { style: { display: "flex", width: "100%", margin: "6px 0" } }, stat(fmt(S.viewers), "Watching"), stat(fmt(likes), "Likes"), stat(fmt(S.gifts), "Gifts")),
                !isHost && h("button", { onClick: toggleFollow, style: { width: "100%", background: following ? "rgba(255,255,255,.14)" : RED, color: "#fff", border: "none", borderRadius: 999, padding: "12px", fontWeight: 800, fontSize: 15.5, cursor: "pointer" } }, following ? "Following" : "Follow")))) : null;
    }
    return h("div", { style: { position: "fixed", inset: 0, zIndex: 95, background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Inter, sans-serif" } },
      stage,
      topBar,
      chipRow,
      railEl,
      tkExtra,
      comboEl,
      bigEl,
      // floating emojis / stickers
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 150, height: 380, pointerEvents: "none", zIndex: 6, overflow: "hidden" } },
        floaters.map(function (f) { var wide = f.g.length > 2 && f.g.indexOf("\uD83D") < 0 && f.g.indexOf("\uD83E") < 0 && f.g.indexOf("\uD83C") < 0; /* WOW! / GG are text */ return h("div", { key: f.id, className: "lc-fx", style: { position: "absolute", bottom: f.big ? "16%" : 0, left: (f.big ? 20 + (f.x - 8) * 0.5 : 45 + f.x * 0.5) + "%", fontSize: f.big ? (wide ? 64 : 120) : 40, lineHeight: 1.1, fontWeight: 900, color: "#FFD43B", textShadow: "0 3px 12px rgba(0,0,0,.65)", animation: (f.big ? "lcBigFloat" : "lcFloat") + " 2.6s ease-out forwards" } }, anim(f.k, f.g)); })),
      // colourful see-through bubbles rising on the right side (Go Live only)
      kind === "live" && !tk && h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, top: 70, bottom: 150, width: "38%", pointerEvents: "none", zIndex: 4, overflow: "hidden" } },
        bubbles.current.map(function (b) { var rgb = b.c.join(","); return h("span", { key: b.id, className: "lc-bubble", style: { position: "absolute", bottom: -60, right: b.right + "%", width: b.size, height: b.size, borderRadius: "50%", background: "radial-gradient(circle at 30% 28%, rgba(255,255,255,.55), rgba(" + rgb + ",.28) 45%, rgba(" + rgb + ",.12) 100%)", border: "1px solid rgba(" + rgb + ",.55)", boxShadow: "inset 0 0 8px rgba(255,255,255,.25), 0 0 10px rgba(" + rgb + ",.25)", "--lc-dx": b.dx + "px", "--lc-o": b.o, opacity: 0, animation: "lcBubble " + b.dur.toFixed(1) + "s linear " + b.delay.toFixed(1) + "s infinite" } }); })),
      toast && h("div", { style: { position: "absolute", left: 16, right: 16, top: tk ? "calc(142px + env(safe-area-inset-top,0px))" : 110, zIndex: 9, background: "#1E2530", color: C.text, border: "1px solid #2B3544", borderRadius: 12, padding: "10px 14px", textAlign: "center", fontSize: 13.5 } }, toast),
      h("div", { style: { flex: 1 } }),
      false && tk && joinNote && h("div", { style: { position: "relative", zIndex: 6, margin: "0 10px 4px", display: "flex" } }, h("span", { style: { background: "linear-gradient(90deg,#6C4DFF,#4D7CFF)", color: "#fff", borderRadius: 999, padding: "4px 12px", fontSize: 12.5, fontWeight: 700 } }, "\uD83D\uDC4B " + joinNote + " joined")),
      false && tk && mostSent && h("div", { style: { position: "relative", zIndex: 6, margin: "0 10px 4px", display: "flex" } }, h("span", { style: { background: "rgba(0,0,0,.42)", color: "#fff", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 700, maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "Most sent ", h("span", { style: { color: "#FFD43B" } }, mostSent.name), h("b", { style: { fontStyle: "italic", color: "#FFD43B", marginLeft: 6 } }, "\u00D7" + mostSent.n))),
      // pinned message (set by the host), shown on top of the chat
      S.pinned && h("div", { style: { position: "relative", zIndex: 6, margin: "0 10px 6px", display: "flex", alignItems: "center", gap: 8, background: "rgba(30,37,48,.92)", border: "1px solid #FFD43B", borderRadius: 12, padding: "6px 8px" } },
        h("span", { style: { fontSize: 16 } }, "\uD83D\uDCCC"),
        h("div", { style: { minWidth: 0, flex: 1, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.text, lineHeight: 1.35, wordBreak: "break-word", maxHeight: 64, overflowY: "auto" } },
          h("div", { style: { color: "#FFD43B", fontSize: 11.5, fontWeight: 700 } }, "Pinned by ", S.pinned.by || "host", " \u00B7 ", S.pinned.user && S.pinned.user.name),
          S.pinned.gift ? h("span", null, "sent a gift ", glyph(GIFTS, S.pinned.gift)) : renderText(S.pinned.text)),
        canPin && h("button", { "aria-label": "Unpin message", onClick: function () { pinMsg(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 16, cursor: "pointer", flexShrink: 0 } }, "\u2715")),
      // comments
      chatOpen && h("div", { ref: logRef, style: { position: "relative", zIndex: 5, maxHeight: kind === "meeting" ? "40%" : (tk ? (short ? "22%" : "30%") : "34%"), overflowY: "auto", padding: tk ? "0 84px 6px 12px" : "0 10px 6px", background: kind === "meeting" ? C.bg : "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.45))", WebkitOverflowScrolling: "touch", WebkitMaskImage: tk ? "linear-gradient(transparent, #000 24%)" : undefined, maskImage: tk ? "linear-gradient(transparent, #000 24%)" : undefined } },
        feed.length ? feed.map(function (m) { return m.sys ? sysRow(m) : comment(m); }) : h("div", { style: { color: C.dim, fontSize: 13, padding: "6px 4px" } }, "No comments yet. Say hi \uD83D\uDC4B")),
      // sticker / gift / emoji tray
      panel && h("div", { style: { position: "relative", zIndex: 8, background: C.card, borderTop: "1px solid " + C.line, padding: "8px 8px 6px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", color: C.dim, fontSize: 12.5, padding: "0 4px 4px" } }, tk && panel !== "gifts" ? h("span", { style: { display: "flex", gap: 6 } }, [["emoji", "Emojis"], ["stickers", "Stickers"]].map(function (t) { var on = panel === t[0]; return h("button", { key: t[0], onClick: function () { setPanel(t[0]); }, style: { background: on ? "rgba(255,45,85,.2)" : "none", border: "1px solid " + (on ? "#FF2D55" : "#2B3544"), color: on ? "#fff" : C.dim, borderRadius: 999, padding: "4px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" } }, t[1]); })) : h("span", null, panel === "gifts" ? "Gifts (free, to show support)" : panel === "stickers" ? "Live stickers" : "Live emojis"), panel !== "gifts" && h("button", { "aria-label": sfxOn() ? "Turn sticker sounds off" : "Turn sticker sounds on", onClick: function () { try { localStorage.setItem("lcLiveSfx", sfxOn() ? "off" : "on"); } catch (e) {} if (sfxOn()) playSfx("pop"); setSfxN(sfxN + 1); }, style: { background: "none", border: "none", color: C.dim, fontSize: 17, cursor: "pointer", marginLeft: "auto", marginRight: 10 } }, sfxOn() ? "\uD83D\uDD0A" : "\uD83D\uDD07"), h("button", { onClick: function () { setPanel(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 18, cursor: "pointer" } }, "\u2715")),
        panel === "gifts" ? giftGrid : h("div", { style: { display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 } }, panelItems.map(function (it) { return h("button", { key: it[0], onClick: function () { onPanelPick(it); }, style: { background: "#1E2530", border: "1px solid #2B3544", borderRadius: 12, minWidth: 58, height: 58, color: "#FFD43B", fontSize: it[1].length > 2 && it[1].indexOf("\uD83C") < 0 && it[1].indexOf("\uD83D") < 0 && it[1].indexOf("\uD83E") < 0 ? 15 : 28, fontWeight: 900, cursor: "pointer", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 } }, panel === "gifts" ? it[1] : anim(panel === "stickers" ? it[0] : (EMO_KEY[it[0]] || "pop"), it[1]), panel === "gifts" && h("span", { style: { fontSize: 10, color: C.dim, fontWeight: 600 } }, it[2])); }))),
      // @ suggestions + reply bar
      sugg.length > 0 && h("div", { style: { position: "relative", zIndex: 8, background: C.card, borderTop: "1px solid " + C.line, display: "flex", gap: 6, padding: "6px 10px", overflowX: "auto" } }, sugg.map(function (u) { return h("button", { key: u.id, onClick: function () { pickMention(u); }, style: { display: "flex", alignItems: "center", gap: 6, background: "#1E2530", border: "1px solid #2B3544", borderRadius: 999, padding: "4px 10px 4px 4px", color: C.text, fontSize: 13, cursor: "pointer", flexShrink: 0 } }, h(Avatar, { user: u, size: 22 }), u.name); })),
      replyTo && h("div", { style: { position: "relative", zIndex: 8, background: C.card, borderTop: "1px solid " + C.line, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, color: C.dim, fontSize: 12.5 } }, h("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, "Replying to ", h("b", { style: { color: C.text } }, replyTo.user.name), ": ", replyTo.text || "a gift"), h("button", { onClick: function () { setReplyTo(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 16, cursor: "pointer" } }, "\u2715")),
      // message bar
      tk && tkInput,
      !tk && h("div", { style: { position: "relative", zIndex: 8, display: "flex", gap: 6, alignItems: "center", padding: "8px 10px", background: tk ? "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.55))" : C.card, borderTop: tk ? "none" : "1px solid " + C.line } },
        kind === "meeting" && h("button", { "aria-label": "Show or hide chat", onClick: function () { setChatOpen(!chatOpen); }, style: round(chatOpen ? C.teal : idle, 38) }, "\uD83D\uDCAC"),
        h("button", { "aria-label": "Mention someone", onClick: addAt, style: Object.assign(round(idle, 38), { fontWeight: 800, color: C.teal }) }, "@"),
        h("input", { ref: inputRef, value: text, maxLength: 300, placeholder: tk ? "Add comment\u2026" : "Type a message\u2026", onChange: function (e) { setText(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") send(); }, style: { flex: 1, minWidth: 0, background: tk ? "rgba(255,255,255,.16)" : "#0E1218", border: tk ? "none" : "1px solid #2B3544", borderRadius: 999, color: C.text, padding: "10px 14px", fontSize: 14.5, outline: "none" } }),
        text.trim() ? h("button", { "aria-label": "Send", onClick: send, style: round(C.teal, 38) }, "\u27A4") : null,
        h("button", { "aria-label": "Live emojis", onClick: function () { setPanel(panel === "emoji" ? null : "emoji"); }, style: round(panel === "emoji" ? C.teal : idle, 38) }, "\uD83D\uDE0A"),
        h("button", { "aria-label": "Live stickers", onClick: function () { setPanel(panel === "stickers" ? null : "stickers"); }, style: round(panel === "stickers" ? C.teal : idle, 38) }, "\uD83D\uDD25"),
        h("button", { "aria-label": "Send a gift", onClick: function () { setPanel(panel === "gifts" ? null : "gifts"); }, style: tk ? round(giftOn ? "linear-gradient(135deg,#FF4D8D,#FF8A3D)" : idle, 38) : round(panel === "gifts" ? C.purple : idle, 38) }, h("span", { style: { filter: tk && !giftOn ? "grayscale(1) brightness(1.8)" : "none" } }, "\uD83C\uDF81"))),
      // teaching tools: only the person who started the meeting (or the live), while their screen is shared
      teaching && toolsOpen && h("div", { style: { position: "relative", zIndex: 9, background: C.card, borderTop: "1px solid " + C.line, padding: "8px 10px 6px" } },
        h("div", { style: { display: "flex", gap: 5, overflowX: "auto", paddingBottom: 6, alignItems: "center" } },
          [["none", "\uD83D\uDC46", "Mouse"], ["pen", "\u270F\uFE0F", "Pen"], ["hl", "\uD83D\uDD8D\uFE0F", "Highlight"], ["arrow", "\u27A1\uFE0F", "Arrow"], ["box", "\u25AD", "Box"], ["text", "T", "Text"], ["laser", "\uD83D\uDD34", "Laser"], ...(kind === "meeting" ? [["torch", "\uD83D\uDD26", "Torch"]] : []), ["erase", "\uD83E\uDDFD", "Erase"]].map(function (t) {
            var on = teach.tool === t[0];
            return h("button", { key: t[0], "aria-label": t[2], title: t[2], onClick: function () { setTeach(Object.assign({}, teach, { tool: t[0] })); }, style: { flexShrink: 0, minWidth: 54, padding: "5px 6px", borderRadius: 12, border: "1px solid " + (on ? C.teal : "#2B3544"), background: on ? "rgba(53,208,186,.18)" : "#1E2530", color: C.text, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 } }, h("span", { style: { fontSize: 18, fontWeight: 800, lineHeight: "20px" } }, t[1]), h("span", { style: { fontSize: 10.5, color: on ? C.teal : C.dim } }, t[2]));
          })),
        h("div", { style: { display: "flex", gap: 8, alignItems: "center", overflowX: "auto" } },
          ["#FF3B5C", "#FFD43B", "#35D0BA", "#4DA3FF", "#FFFFFF", "#111111"].map(function (c) { return h("button", { key: c, "aria-label": "Colour " + c, onClick: function () { setTeach(Object.assign({}, teach, { color: c })); }, style: { flexShrink: 0, width: 26, height: 26, borderRadius: 26, background: c, border: teach.color === c ? "3px solid " + C.teal : "2px solid #2B3544", cursor: "pointer", padding: 0 } }); }),
          [["S", 3], ["M", 5], ["L", 9]].map(function (z) { var on = teach.size === z[1]; return h("button", { key: z[0], onClick: function () { setTeach(Object.assign({}, teach, { size: z[1] })); }, style: { flexShrink: 0, width: 30, height: 30, borderRadius: 10, border: "1px solid " + (on ? C.teal : "#2B3544"), background: on ? "rgba(53,208,186,.18)" : "#1E2530", color: C.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" } }, z[0]); }),
          h("button", { onClick: function () { var A = annRef.current; A.strokes.pop(); }, style: { flexShrink: 0, padding: "6px 12px", borderRadius: 10, border: "1px solid #2B3544", background: "#1E2530", color: C.text, fontWeight: 600, fontSize: 12.5, cursor: "pointer" } }, "\u21B6 Undo"),
          h("button", { onClick: function () { annRef.current.strokes = []; annRef.current.cur = null; annRef.current.torch = null; }, style: { flexShrink: 0, padding: "6px 12px", borderRadius: 10, border: "1px solid #5A2A36", background: "#2A1B20", color: "#FFB3C0", fontWeight: 600, fontSize: 12.5, cursor: "pointer" } }, "Clear"))),
      // your video sheet: camera / picture / off, plus effects
      vpanel && (isHost || kind === "meeting") && h("div", { style: { position: "relative", zIndex: 9, background: C.card, borderTop: "1px solid " + C.line, padding: "10px 12px 8px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } }, h("span", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 14.5, color: C.text } }, "Your video"), h("button", { "aria-label": "Close", onClick: function () { setVpanel(false); }, style: { background: "none", border: "none", color: C.dim, fontSize: 18, cursor: "pointer" } }, "\u2715")),
        h("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
          [["camera", "\uD83D\uDCF7 Camera"], ["image", "\uD83D\uDDBC Picture"], ["off", "\uD83D\uDEAB Off"]].map(function (o) {
            var on = vmode === o[0], disabled = o[0] === "image" && !CAN_PIPE;
            return h("button", { key: o[0], disabled: disabled, onClick: function () { if (o[0] === "image") { if (imgRef.current && vmode !== "image") setLook("image"); else if (fileRef.current) fileRef.current.click(); } else setLook(o[0]); }, style: { flex: 1, padding: "9px 4px", borderRadius: 12, border: "1px solid " + (on ? C.teal : "#2B3544"), background: on ? "rgba(53,208,186,.16)" : "#1E2530", color: on ? C.teal : C.text, fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: disabled ? 0.4 : 1 } }, o[1]);
          })),
        h("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ""; pickImage(f); } }),
        vmode === "image" && h("button", { onClick: function () { if (fileRef.current) fileRef.current.click(); }, style: { background: "none", border: "none", color: C.teal, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "0 0 8px" } }, "Choose a different picture"),
        CAN_PIPE ? h("div", { style: { opacity: vmode === "off" ? 0.4 : 1 } },
          h("div", { style: { color: C.dim, fontSize: 12, marginBottom: 4 } }, "Effects"),
          h("div", { style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 } }, EFFECT_LIST.map(function (e) {
            var on = fxName === e[0];
            return h("button", { key: e[0], disabled: vmode === "off", onClick: function () { setLook(null, e[0]); }, style: { flexShrink: 0, padding: "8px 14px", borderRadius: 999, border: "1px solid " + (on ? C.purple : "#2B3544"), background: on ? "rgba(124,92,255,.25)" : "#1E2530", color: C.text, fontWeight: on ? 700 : 500, fontSize: 13, cursor: "pointer" } }, e[1]);
          })))
          : h("div", { style: { color: C.dim, fontSize: 12.5 } }, "Effects and pictures are not supported on this phone or browser. You can still turn your video off."),
        faceCapable() && kind !== "meeting" && h("div", { style: { opacity: vmode === "off" || vmode === "screen" ? 0.4 : 1, marginTop: 8 } },
          h("div", { style: { color: C.dim, fontSize: 12, marginBottom: 4 } }, "Face effects (follow your face)"),
          h("div", { style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 } }, [["none", "None", "\u2715"]].concat(FACE_ITEMS).map(function (e) {
            var on = e[0] === "none" ? !faceSet.length : faceSet.indexOf(e[0]) >= 0;
            return h("button", { key: e[0], disabled: vmode === "off" || vmode === "screen", "aria-label": e[1], onClick: function () { toggleFace(e[0]); }, style: { flexShrink: 0, padding: "6px 10px", borderRadius: 14, border: "1px solid " + (on ? C.purple : "#2B3544"), background: on ? "rgba(124,92,255,.25)" : "#1E2530", color: C.text, fontWeight: on ? 700 : 500, fontSize: 11.5, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 58 } }, h("span", { style: { fontSize: 22, lineHeight: 1 } }, e[2]), e[1]);
          })),
          faceMsg && h("div", { style: { color: C.dim, fontSize: 12, paddingTop: 4 } }, faceMsg))),
      // call controls (host / meeting members)
      ((isHost && !tk) || kind === "meeting") && h("div", { style: { position: "relative", zIndex: 8, display: "flex", justifyContent: "center", gap: 12, padding: "8px 10px calc(12px + env(safe-area-inset-bottom,0px))", background: C.card } },
        h("button", { "aria-label": mediaState.mic ? "Mute" : "Unmute", onClick: toggleMic, style: round(mediaState.mic ? "#2B3544" : "#F5F7FA", 46) }, mediaState.mic ? "\uD83C\uDF99" : "\uD83D\uDD07"),
        info.video !== false && h("button", { "aria-label": vmode === "off" ? "Turn video on" : "Turn video off", onClick: toggleCam, style: round(vmode === "off" ? "#F5F7FA" : "#2B3544", 46) }, vmode === "off" ? "\uD83D\uDEAB" : "\uD83D\uDCF7"),
        info.video !== false && h("button", { "aria-label": vmode === "screen" ? "Stop sharing screen" : "Share screen", onClick: startScreen, style: round(vmode === "screen" ? C.teal : "#2B3544", 46) }, "\uD83D\uDDA5"),
        info.video !== false && h("button", { "aria-label": facing === "user" ? "Switch to back camera" : "Switch to front camera", title: facing === "user" ? "Back camera" : "Front camera", onClick: flipCam, disabled: vmode === "off" || vmode === "screen", style: Object.assign(round(facing === "environment" ? C.teal : "#2B3544", 46), { opacity: vmode === "off" || vmode === "screen" ? 0.4 : 1 }) }, "\uD83D\uDD04"),
        REC_OK && info.video !== false && h("button", { "aria-label": recSec == null ? "Record video" : "Stop recording", title: recSec == null ? "Record" : "Stop and save", onClick: startRec, style: Object.assign(round(recSec == null ? "#2B3544" : C.red, 46), recSec == null ? { color: C.red } : { fontSize: 12, fontWeight: 800, lineHeight: "46px" }) }, recLabel),
        kind === "live" && isHost && faceCapable() && h("button", { "aria-label": "Face tracker", title: "Face tracker", onClick: function () { setVpanel(!vpanel); setPanel(null); }, style: round(vpanel ? C.purple : "#2B3544", 46) }, "\uD83D\uDE03"),
        info.video !== false && h("button", { "aria-label": "Video effects and picture", onClick: function () { setVpanel(!vpanel); setPanel(null); }, style: round(vpanel || fxName !== "none" || vmode === "image" ? C.purple : "#2B3544", 46) }, "\u2728"),
        teaching && h("button", { "aria-label": "Drawing tools", title: "Drawing tools", onClick: function () { setToolsOpen(!toolsOpen); }, style: round(toolsOpen ? C.purple : "#2B3544", 46) }, "\uD83E\uDDF0"),
        h("button", { "aria-label": "Leave", onClick: leave, style: round(C.red, 46) }, "\u260E")),
      tkNav,
      tkSheet);
  }

  // ---------------------------------------------------------------- the Live tab (lobby)
  function Screen(p) {
    var me = p.me;
    var rs = useState(null), room = rs[0], setRoom = rs[1];
    var ls = useState([]), lives = ls[0], setLives = ls[1];
    var cs = useState(function () { try { return (new URLSearchParams(location.search).get("live") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); } catch (e) { return ""; } }), codeIn = cs[0], setCodeIn = cs[1];
    var ms = useState(""), msg = ms[0], setMsg = ms[1];
    var bs = useState(false), busy = bs[0], setBusy = bs[1];
    var ts = useState(""), title = ts[0], setTitle = ts[1];
    var as = useState(null), alertLive = as[0], setAlert = as[1];   // "X is live" banner
    var ss = useState(null), sk = ss[0], setSk = ss[1];

    // follow the app's socket (it is replaced after a sign-in) and listen for "someone in my chats went live"
    useEffect(function () { var t = setInterval(function () { var s = sock(); if (s !== sk) setSk(s || null); }, 1000); return function () { clearInterval(t); }; }, [sk]);
    useEffect(function () {
      if (!sk) return;
      var onStarted = function (m) {
        if (!m || !m.host || m.host.id === me.id) return;
        setAlert(m);
        try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(m.host.name + " is live now", { body: m.title || "Tap to watch", tag: "live-" + m.code }); } catch (e) {}
        setTimeout(function () { setAlert(function (a) { return a && a.code === m.code ? null : a; }); }, 15000);
      };
      var onEnded = function (m) { setAlert(function (a) { return a && m && a.code === m.code ? null : a; }); };
      sk.on("live:started", onStarted); sk.on("live:ended", onEnded);
      return function () { sk.off("live:started", onStarted); sk.off("live:ended", onEnded); };
    }, [sk, me.id]);

    useEffect(function () { window.__lcLiveBusy = function () { return !!room; }; return function () { window.__lcLiveBusy = null; }; }, [room]);
    useEffect(function () {
      if (!p.active || room) return;
      var stop = false;
      function load() { var s = sock(); if (!s) return; s.emit("live:list", function (r) { if (!stop && r && r.lives) setLives(r.lives); }); }
      load(); var t = setInterval(load, 6000);
      return function () { stop = true; clearInterval(t); };
    }, [p.active, !!room]);

    // a reply that never comes (sleeping server, dropped connection) used to leave the buttons dimmed and dead forever: give up after 15 s
    function ackOnce(cb) { var done = false, t = setTimeout(function () { if (!done) { done = true; cb(null); } }, 15000); return function (r) { if (done) return; done = true; clearTimeout(t); cb(r); }; }
    var NO_REPLY = "No answer from the server. Check your internet and try again.";
    function enter(emitName, payload, retried) {
      var s = sock();
      if (!s || !s.connected) return setMsg("Not connected yet. Try again in a moment.");
      if (busyElsewhere()) return setMsg("Finish your call first, then come back.");
      setBusy(true); setMsg("");
      s.emit(emitName, payload, ackOnce(function (r) {
        if (r && r.error && /already in/i.test(r.error) && !retried) { // a seat from a live that never closed: close it here, then try again once
          try { s.emit("live:reset", {}, function () {}); if (r.code) s.emit("live:leave", { code: r.code }, function () {}); } catch (e) {}
          return setTimeout(function () { enter(emitName, payload, true); }, 800);
        }
        if (!r || r.error) { setBusy(false); return setMsg((r && r.error) || NO_REPLY); }
        if (emitName === "live:start") { // creator gets the room straight away: join it as host to receive the same data shape
          s.emit("live:join", { code: r.code }, ackOnce(function (j) { setBusy(false); if (!j || j.error) return setMsg((j && j.error) || NO_REPLY); setRoom(Object.assign({}, j, { title: r.title })); }));
        } else { setBusy(false); setRoom(r); }
      }));
    }
    useEffect(function () { if (!busy || !sk) return; var off = function () { setBusy(false); setMsg("Connection lost. Try again."); }; sk.on("disconnect", off); return function () { sk.off("disconnect", off); }; }, [busy, sk]);
    var goLive = function () { enter("live:start", { kind: "live", title: title, video: true }); };
    var meeting = function () { enter("live:start", { kind: "meeting", title: title || "Live Meeting", video: true }); };
    var joinCode = function (c) { var v = (c || codeIn).toUpperCase().replace(/[^A-Z0-9]/g, ""); if (v.length < 4) return setMsg("Enter the meeting code from the host"); enter("live:join", { code: v, manual: !c }); };
    var watch = function (code) { setAlert(null); enter("live:join", { code: code }); };
    var close = function (reason) { setRoom(null); if (reason) setMsg(reason); };

    var s0 = sock();
    var lobby = h("div", { style: { height: "100%", overflowY: "auto", background: C.bg, color: C.text, fontFamily: "Inter, sans-serif", padding: "14px 14px 24px", WebkitOverflowScrolling: "touch" } },
      h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 800, fontSize: 24 } }, "Live"),
      h("div", { style: { color: C.dim, fontSize: 13.5, margin: "2px 0 14px" } }, "Real people. Real conversations. Live."),
      msg && h("div", { role: "alert", style: { background: "#2A1B20", border: "1px solid #5A2A36", color: "#FFB3C0", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, marginBottom: 12 } }, msg),
      h("input", { value: title, maxLength: 60, placeholder: "Title (optional), for example Good Vibes Live", onChange: function (e) { setTitle(e.target.value); }, style: { width: "100%", boxSizing: "border-box", background: C.card, border: "1px solid " + C.line, borderRadius: 12, color: C.text, padding: "11px 12px", fontSize: 14.5, outline: "none", marginBottom: 10 } }),
      h("div", { style: { display: "flex", gap: 10, marginBottom: 14 } },
        h("button", { disabled: busy, onClick: goLive, style: btn("linear-gradient(135deg,#7C5CFF,#C04CFF)", "#fff", { flex: 1, opacity: busy ? 0.6 : 1 }) }, "\uD83C\uDFA5  Go Live"),
        h("button", { disabled: busy, onClick: meeting, style: btn("#17B8A6", "#06201C", { flex: 1, opacity: busy ? 0.6 : 1 }) }, "\uD83D\uDC65  Live Meeting")),
      h("div", { style: { background: C.card, border: "1px solid " + C.line, borderRadius: 16, padding: 12, marginBottom: 16 } },
        h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 15 } }, "Join Live Meeting with Code"),
        h("div", { style: { color: C.dim, fontSize: 12.5, margin: "2px 0 8px" } }, "Get the meeting code from the host and join instantly."),
        h("input", { value: codeIn, maxLength: 8, placeholder: "AB12CD", autoCapitalize: "characters", onChange: function (e) { setCodeIn(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); }, onKeyDown: function (e) { if (e.key === "Enter") joinCode(); }, style: { width: "100%", boxSizing: "border-box", background: "#0E1218", border: "1px solid #2B3544", borderRadius: 12, color: C.text, padding: "12px", fontSize: 18, letterSpacing: 4, textAlign: "center", fontWeight: 700, outline: "none", marginBottom: 8 } }),
        h("button", { disabled: busy, onClick: function () { joinCode(); }, style: btn(C.purple, "#fff", { width: "100%", opacity: busy ? 0.6 : 1 }) }, "Join Now \u2192")),
      h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 8 } }, "People online going live"),
      lives.length === 0 ? h("div", { style: { color: C.dim, fontSize: 13.5, padding: "18px 0", textAlign: "center" } }, s0 ? "Nobody is live right now. Be the first!" : "Connecting\u2026")
        : lives.map(function (l) {
          return h("button", { key: l.code, onClick: function () { joinCode(l.code); }, style: { display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: 10, marginBottom: 8, color: C.text, cursor: "pointer" } },
            h(Avatar, { user: l.host, size: 44 }),
            h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, l.title), h("div", { style: { color: C.dim, fontSize: 12.5 } }, h(Name, { user: l.host }))),
            h("span", { style: { background: C.red, color: "#fff", borderRadius: 7, padding: "2px 7px", fontSize: 11, fontWeight: 800 } }, "LIVE"),
            h("span", { style: { color: C.dim, fontSize: 12.5 } }, "\uD83D\uDC41 " + l.viewers));
        }),
      h("div", { style: { color: "#5B6673", fontSize: 11.5, marginTop: 14, lineHeight: 1.5 } }, "When you go live, the people in your chats are notified. Gifts are free virtual gifts to show support. Meetings fit up to 6 people on video. Live videos show video to the first 8 viewers; everyone else can still comment and send gifts."));

    var banner = alertLive && !room ? h("div", { role: "alert", style: { position: "fixed", left: 10, right: 10, top: "calc(10px + env(safe-area-inset-top,0px))", zIndex: 94, display: "flex", alignItems: "center", gap: 10, background: "#1E2530", border: "1px solid " + C.purple, borderRadius: 16, padding: "10px 12px", color: C.text, fontFamily: "Inter, sans-serif", boxShadow: "0 10px 28px rgba(0,0,0,.5)" } },
      h(Avatar, { user: alertLive.host, size: 40 }),
      h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, (alertLive.host.name || "Someone") + " is live now"), h("div", { style: { color: C.dim, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, alertLive.title)),
      h("button", { onClick: function () { watch(alertLive.code); }, style: btn(C.purple, "#fff", { padding: "8px 14px", fontSize: 13.5 }) }, "Watch"),
      h("button", { "aria-label": "Dismiss", onClick: function () { setAlert(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 18, cursor: "pointer" } }, "\u2715")) : null;
    return h(React.Fragment, null,
      banner,
      p.active ? lobby : null,
      room ? h(Room, { key: room.code, info: room, me: me, socket: sock(), onClose: close }) : null);
  }

  window.LetschatLive = { Screen: Screen, version: 1 };
})();
