// Letschat compatibility layer: lets the app run on older phones (old Android WebView / Chrome, iOS 12-14).
// Loads first, is plain ES5, and does nothing on modern phones.
(function () {
  "use strict";
  var w = window, d = document;

  // 1. Browsers that are too old to run the app at all: show a clear message instead of a blank screen
  var ok = !!(w.Promise && w.fetch && w.Symbol && w.Map && w.Set && Object.assign && Array.prototype.includes && Array.from);
  if (!ok) {
    w.__lcTooOld = true;
    var show = function () {
      var b = d.getElementById("boot");
      if (b) b.innerHTML = '<h1 style="font:700 20px sans-serif;color:#F5F7FA;margin:0 0 8px">Letschat Africa</h1><p style="margin:0 0 8px">Your phone browser is too old to run Letschat.</p><p style="margin:0">Please update Chrome or your Android System WebView from Google Play, then open this page again.</p>';
    };
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", show); else show();
    return;
  }

  // 2. Small gaps: Array/String helpers some older WebViews miss
  if (!Array.prototype.flat) Object.defineProperty(Array.prototype, "flat", { configurable: true, writable: true, value: function (depth) {
    var dep = depth === undefined ? 1 : Number(depth), out = [];
    (function f(a, n) { for (var i = 0; i < a.length; i++) { if (Array.isArray(a[i]) && n > 0) f(a[i], n - 1); else out.push(a[i]); } })(this, dep);
    return out;
  } });
  if (!Object.fromEntries) Object.fromEntries = function (it) { var o = {}; Array.from(it).forEach(function (e) { o[e[0]] = e[1]; }); return o; };
  if (!String.prototype.replaceAll) String.prototype.replaceAll = function (s, r) { return s instanceof RegExp ? this.replace(s, r) : this.split(s).join(r); };
  if (!Array.prototype.at) Object.defineProperty(Array.prototype, "at", { configurable: true, writable: true, value: function (i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return this[i]; } });
  if (!Object.entries) Object.entries = function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }); };
  if (!Object.values) Object.values = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };
  if (!String.prototype.padStart) String.prototype.padStart = function (n, p) { var s = String(this), f = p === undefined ? " " : String(p); if (!f) return s; var out = ""; while (out.length + s.length < n) out += f; return out.slice(0, Math.max(0, n - s.length)) + s; };
  if (!String.prototype.padEnd) String.prototype.padEnd = function (n, p) { var s = String(this), f = p === undefined ? " " : String(p); if (!f) return s; var out = ""; while (out.length + s.length < n) out += f; return s + out.slice(0, Math.max(0, n - s.length)); };
  if (w.Node && !("isConnected" in Node.prototype)) Object.defineProperty(Node.prototype, "isConnected", { configurable: true, get: function () { return d.documentElement.contains(this); } });
  if (!Array.prototype.flatMap) Object.defineProperty(Array.prototype, "flatMap", { configurable: true, writable: true, value: function (f, t) { return Array.prototype.concat.apply([], this.map(f, t)); } });
  if (w.Promise && !Promise.prototype.finally) Promise.prototype.finally = function (f) { var P = this.constructor || Promise; return this.then(function (v) { return P.resolve(f()).then(function () { return v; }); }, function (e) { return P.resolve(f()).then(function () { throw e; }); }); };
  // Blob.text() / arrayBuffer() are missing before Safari 14
  if (w.Blob && w.FileReader) {
    if (!Blob.prototype.arrayBuffer) Blob.prototype.arrayBuffer = function () { var b = this; return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; r.readAsArrayBuffer(b); }); };
    if (!Blob.prototype.text) Blob.prototype.text = function () { var b = this; return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; r.readAsText(b); }); };
  }
  if (!w.requestAnimationFrame) w.requestAnimationFrame = function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
  if (!w.cancelAnimationFrame) w.cancelAnimationFrame = clearTimeout;
  // matchMedia().addEventListener("change") is missing before Safari 14 / Chrome 50
  if (w.matchMedia) {
    try {
      var probe = w.matchMedia("all");
      if (!probe.addEventListener && probe.addListener) {
        var proto = Object.getPrototypeOf(probe);
        proto.addEventListener = function (t, f) { if (t === "change") this.addListener(f); };
        proto.removeEventListener = function (t, f) { if (t === "change") this.removeListener(f); };
      }
    } catch (e) {}
  }
  if (!w.CSS) w.CSS = {};
  if (!w.CSS.supports) w.CSS.supports = function () { return false; };

  // 3. Real viewport height: --lc-vh follows the visible screen on phones without "dvh" (address bar, keyboard)
  var supportsDvh = false;
  try { supportsDvh = w.CSS.supports("height", "100dvh"); } catch (e) {}
  if (!supportsDvh) {
    var setVh = function () {
      var h = (w.visualViewport && w.visualViewport.height) || w.innerHeight;
      d.documentElement.style.setProperty("--lc-vh", h + "px");
      var shell = d.querySelector(".app-shell"); if (shell) shell.style.height = h + "px";
    };
    setVh();
    w.addEventListener("resize", setVh);
    w.addEventListener("orientationchange", function () { setTimeout(setVh, 250); });
    if (w.visualViewport) w.visualViewport.addEventListener("resize", setVh);
    d.addEventListener("DOMContentLoaded", setVh);
  }

  // 4. Flexbox "gap": missing before Chrome 84 / Safari 14.1 (all older layouts would squash together).
  //    Where it is missing, the gap is rebuilt with margins on the children.
  function flexGapWorks() {
    try {
      var f = d.createElement("div");
      f.style.cssText = "display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden";
      f.appendChild(d.createElement("div")); f.appendChild(d.createElement("div"));
      (d.body || d.documentElement).appendChild(f);
      var ok2 = f.scrollHeight === 1;
      f.parentNode.removeChild(f);
      return ok2;
    } catch (e) { return true; }
  }
  function startGapShim() {
    if (w.__lcForceGapShim !== true && flexGapWorks()) return;
    var px = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };
    function put(st, prop, val) { if (st[prop] !== val) st[prop] = val; } // only write real changes (no observer loop)
    function fix(el) {
      var s = el.style; if (!s) return;
      var cs = s.display === "flex" || s.display === "inline-flex";
      if (!cs) return;
      var gap = s.gap || s.gridGap || "", cm = /lcgap-(\d+)/.exec(s.counterIncrement || "");
      if (!gap && cm) gap = cm[1] + "px"; // old browsers drop "gap"; the app also writes it as a counter name they keep
      var parts = gap.split(/\s+/);
      var rowGap = px(s.rowGap || parts[0]), colGap = px(s.columnGap || parts[1] || parts[0]);
      if (!rowGap && !colGap) return;
      var col = s.flexDirection === "column" || s.flexDirection === "column-reverse";
      var wrap = s.flexWrap === "wrap" || s.flexWrap === "wrap-reverse";
      var kids = el.children;
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i], ks = k.style; if (!ks) continue;
        if (wrap) { put(ks, "marginRight", colGap + "px"); put(ks, "marginBottom", rowGap + "px"); }
        else if (i > 0) { if (col) put(ks, "marginTop", rowGap + "px"); else put(ks, "marginLeft", colGap + "px"); }
        else { if (col) put(ks, "marginTop", ""); else put(ks, "marginLeft", ""); }
      }
      if (wrap && !el.__lcWrapFixed) { el.__lcWrapFixed = 1; s.marginRight = (px(s.marginRight) - colGap) + "px"; s.marginBottom = (px(s.marginBottom) - rowGap) + "px"; }
    }
    var queue = [], timer = 0;
    function run() {
      timer = 0; var list = queue; queue = [];
      for (var i = 0; i < list.length; i++) {
        var n = list[i]; if (!n.isConnected) continue;
        fix(n);
        if (n.parentNode && n.parentNode.nodeType === 1) fix(n.parentNode);
        var all = n.querySelectorAll ? n.querySelectorAll('[style*="gap"]') : [];
        for (var j = 0; j < all.length; j++) fix(all[j]);
      }
    }
    function push(n) { if (n && n.nodeType === 1) queue.push(n); }
    function begin() {
      push(d.body); run();
      new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) {
          var m = ms[i];
          if (m.type === "attributes") push(m.target);
          else { push(m.target); for (var j = 0; j < m.addedNodes.length; j++) push(m.addedNodes[j]); }
        }
        if (queue.length && !timer) timer = w.requestAnimationFrame(run);
      }).observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    }
    if (d.body) begin(); else d.addEventListener("DOMContentLoaded", begin);
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", startGapShim); else startGapShim();

  // 5. aspect-ratio: missing before Chrome 88 / Safari 15 (iPhone 6 to iPhone 12 on old iOS: game boards, photo grids,
  //    status tiles would collapse). The app tags those elements with a harmless counter-reset name (lcar-W-H); height is rebuilt from the width.
  function startRatioShim() {
    var works = false;
    try { works = w.CSS.supports("aspect-ratio", "1 / 1"); } catch (e) {}
    if (w.__lcForceRatioShim !== true && works) return;
    function fixR(el) {
      var m = el.style && /lcar-(\d+)-(\d+)/.exec(el.style.counterReset || ""); if (!m) return;
      var a = parseFloat(m[1]), b = parseFloat(m[2]);
      if (!a || !b) return;
      var wd = el.offsetWidth; if (!wd) return;
      var h = Math.round(wd * b / a) + "px";
      if (el.style.height !== h) el.style.height = h;
    }
    var timer = 0;
    function all() { timer = 0; var l = d.querySelectorAll('[style*="lcar-"]'); for (var i = 0; i < l.length; i++) fixR(l[i]); }
    function sched() { if (!timer) timer = w.requestAnimationFrame(all); }
    function begin() {
      all();
      new MutationObserver(sched).observe(d.body, { childList: true, subtree: true });
      w.addEventListener("resize", sched); w.addEventListener("orientationchange", function () { setTimeout(sched, 250); });
      w.addEventListener("load", sched);
    }
    if (d.body) begin(); else d.addEventListener("DOMContentLoaded", begin);
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", startRatioShim); else startRatioShim();

  // 6. Very small screens (keypad / feature phones, 128 to 320 px wide): no scaling tricks. The app simply reflows at the real
  //    screen width. This only sets size classes on <html>; responsive.css does the compact layout and switches off all
  //    animations and effects (lc-small <= 320 px, lc-tiny <= 240 px, lc-micro <= 176 px).
  function applySmall() {
    var W = w.innerWidth || d.documentElement.clientWidth;
    var root = d.documentElement, cls = root.className.replace(/\blc-(small|tiny|micro)\b/g, "").replace(/\s+/g, " ").replace(/^ | $/g, "");
    if (W && W <= 320) cls += (cls ? " " : "") + "lc-small" + (W <= 240 ? " lc-tiny" : "") + (W <= 176 ? " lc-micro" : "");
    if (root.className !== cls) root.className = cls;
  }
  applySmall();
  w.addEventListener("resize", applySmall);
  w.addEventListener("orientationchange", function () { setTimeout(applySmall, 250); });
  d.addEventListener("DOMContentLoaded", applySmall);

  // 7. Keypad phones (KaiOS, Nokia, Opera Mini style): arrow keys move between buttons and fields, Enter taps,
  //    soft-left / Escape / Backspace (outside a text field) go back or close.
  var keypad = w.__lcForceKeypad === true || /KaiOS|Series40|Series60|Nokia|Opera Mini|MIDP|UCWEB|NetFront/i.test(navigator.userAgent) ||
    ((w.innerWidth || 999) <= 320 && !("ontouchstart" in w) && !(w.matchMedia && w.matchMedia("(pointer:coarse)").matches));
  if (keypad) {
    var focusCss = d.createElement("style");
    focusCss.textContent = "html.lc-keypad *:focus{outline:2px solid #35D0BA!important;outline-offset:1px!important}";
    (d.head || d.documentElement).appendChild(focusCss);
    d.documentElement.className += " lc-keypad";
    var FOC = 'button:not([disabled]),a[href],input:not([type=hidden]):not([disabled]),textarea:not([disabled]),select:not([disabled]),[role=button],[role=tab],[tabindex]:not([tabindex="-1"])';
    var visible = function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > -2000 && r.top < 4000 && (e.offsetParent !== null || getComputedStyle(e).position === "fixed"); };
    var textual = function (e) { return e && /^(INPUT|TEXTAREA)$/.test(e.tagName) && !/^(button|checkbox|radio|submit|file|range)$/i.test(e.type || ""); };
    var tap = function (sel) { var l = d.querySelectorAll(sel); for (var i = l.length - 1; i >= 0; i--) if (visible(l[i])) { l[i].click(); return true; } return false; };
    d.addEventListener("keydown", function (e) {
      var k = e.key, a = d.activeElement, dir = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r", Up: "u", Down: "d", Left: "l", Right: "r" }[k];
      if (k === "SoftLeft" || k === "Escape" || (k === "Backspace" && !textual(a) && !(a && a.isContentEditable))) {
        if (tap('[aria-label="Back"],[aria-label^="Back "],[aria-label="Close"],[aria-label^="Close "],[aria-label="Cancel"]')) e.preventDefault();
        return;
      }
      if (k === "SoftRight" && a && a.click) { /* soft-right: act like Enter on the focused item */ a.click(); e.preventDefault(); return; }
      if (!dir) return;
      if (textual(a) && a.tagName === "INPUT" && (dir === "l" || dir === "r")) return; // keep caret keys inside fields
      if (a && a.tagName === "TEXTAREA" && (dir === "l" || dir === "r")) return;
      var cur = a && a !== d.body ? a.getBoundingClientRect() : null, list = d.querySelectorAll(FOC), best = null, bestScore = 1e9;
      var cx = cur ? cur.left + cur.width / 2 : (dir === "r" ? 0 : w.innerWidth / 2), cy = cur ? cur.top + cur.height / 2 : (dir === "d" ? 0 : w.innerHeight / 2);
      for (var i = 0; i < list.length; i++) {
        var c = list[i]; if (c === a || !visible(c)) continue;
        var r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, dx = x - cx, dy = y - cy;
        var ok = dir === "d" ? dy > 2 : dir === "u" ? dy < -2 : dir === "r" ? dx > 2 : dx < -2;
        if (!ok) continue;
        var main = (dir === "d" || dir === "u") ? Math.abs(dy) : Math.abs(dx), cross = (dir === "d" || dir === "u") ? Math.abs(dx) : Math.abs(dy);
        var sc = main + cross * 2.5;
        if (sc < bestScore) { bestScore = sc; best = c; }
      }
      if (best) { e.preventDefault(); try { best.focus(); } catch (x) {} try { best.scrollIntoView({ block: "nearest" }); } catch (x2) { try { best.scrollIntoView(false); } catch (x3) {} } }
      else if (!cur && list.length) { e.preventDefault(); list[0].focus(); }
    }, true);
    // first arrow press with nothing focused picks the first control; Enter on a focused div-button taps it
    d.addEventListener("keydown", function (e) {
      var a = d.activeElement;
      if (e.key === "Enter" && a && a !== d.body && !textual(a) && a.tagName !== "BUTTON" && a.tagName !== "A" && a.tagName !== "TEXTAREA" && !a.getAttribute("data-lc-kb") && a.click) { e.preventDefault(); a.click(); }
    }, true);
  }
})();

// 7. Video fixes (Samsung / Android WebView / Safari): blank video frames, autoplay blocked, unsupported formats.
(function () {
  "use strict";
  var w = window, d = document;
  if (!d.addEventListener || !d.querySelectorAll) return;

  function retryOnTap(v) {
    if (v.__lcTap) return; v.__lcTap = 1;
    var go = function () {
      d.removeEventListener("click", go, true); d.removeEventListener("touchend", go, true); v.__lcTap = 0;
      try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    };
    d.addEventListener("click", go, true); d.addEventListener("touchend", go, true);
  }
  function tryPlay(v) {
    try { var p = v.play(); if (p && p.catch) p.catch(function () { retryOnTap(v); }); } catch (e) {}
  }
  function showFallback(v) {
    if (v.__lcFb || !v.parentNode) return;
    var src = v.currentSrc || v.src; if (!src || v.srcObject) return;
    v.__lcFb = 1;
    var box = d.createElement("div");
    box.setAttribute("style", "font:13px/1.4 sans-serif;color:#B9C2CC;background:#11161C;border-radius:10px;padding:10px 12px;margin-top:6px;text-align:center");
    box.appendChild(d.createTextNode("This video can't play on this device. "));
    var a = d.createElement("a");
    a.href = src; a.setAttribute("download", "video"); a.target = "_blank"; a.rel = "noopener";
    a.style.color = "#35D0BA"; a.appendChild(d.createTextNode("Download it"));
    box.appendChild(a);
    v.parentNode.insertBefore(box, v.nextSibling);
  }
  function prep(v) {
    if (v.__lcv) return; v.__lcv = 1;
    try { v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", ""); } catch (e) {}
    // React sets "muted" as a property only; Safari/iOS needs the attribute for muted autoplay
    try { if (v.muted) v.setAttribute("muted", ""); } catch (e) {}
    v.addEventListener("loadedmetadata", function () {
      try {
        if (v.srcObject) { tryPlay(v); return; }
        // Force the first frame to paint (otherwise some Android WebViews and Safari show black until played)
        if (v.paused && !v.poster && v.currentTime === 0 && v.duration > 0) v.currentTime = 0.001;
        if (v.autoplay && v.paused) tryPlay(v);
      } catch (e) {}
    });
    v.addEventListener("error", function () { showFallback(v); });
    if (v.srcObject && v.readyState >= 1) tryPlay(v);
  }
  function scan(n) {
    if (!n || n.nodeType !== 1) return;
    if (n.tagName === "VIDEO") prep(n);
    var l = n.querySelectorAll ? n.querySelectorAll("video") : [];
    for (var i = 0; i < l.length; i++) prep(l[i]);
  }
  function start() {
    scan(d.documentElement);
    if (w.MutationObserver) {
      new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) scan(ms[i].addedNodes[j]);
      }).observe(d.documentElement, { childList: true, subtree: true });
    }
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start); else start();
})();

// 8. Live video calls / meetings: keep stream videos playing (hidden-then-shown videos, late tracks, autoplay blocks)
(function () {
  "use strict";
  var d = document;
  if (!d.querySelectorAll || !window.MediaStream) return;
  setInterval(function () {
    if (d.hidden) return;
    var l = d.querySelectorAll("video"), i, v, s;
    for (i = 0; i < l.length; i++) {
      v = l[i]; s = v.srcObject;
      if (!s || !s.active || !v.paused || v.ended) continue;
      try { v.setAttribute("playsinline", ""); var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
  }, 1200);
})();

// 9. Keep the screen awake during calls and lives. Battery saver makes the browser refuse the Screen Wake Lock (and drop it when the screen
//    is turned off and on), so this asks again when the app comes back, on a timer, and after the lock is released. Returns a stop function.
(function () {
  var w = window, d = document;
  w.lcKeepAwake = function () {
    var lock = null, dead = false, busy = false, timer = 0;
    function get() {
      if (dead || busy || d.hidden || !navigator.wakeLock || !navigator.wakeLock.request) return;
      if (lock && !lock.released) return;
      busy = true;
      try {
        navigator.wakeLock.request("screen").then(function (l) {
          busy = false;
          if (dead) { try { l.release(); } catch (e) {} return; }
          lock = l; try { l.addEventListener("release", function () { if (lock === l) lock = null; }); } catch (e) {}
        }, function () { busy = false; });
      } catch (e) { busy = false; }
    }
    function vis() { if (!d.hidden) get(); }
    d.addEventListener("visibilitychange", vis); w.addEventListener("focus", vis); w.addEventListener("pageshow", vis);
    get(); timer = setInterval(get, 15000);
    return function () {
      dead = true; clearInterval(timer);
      d.removeEventListener("visibilitychange", vis); w.removeEventListener("focus", vis); w.removeEventListener("pageshow", vis);
      try { if (lock) lock.release(); } catch (e) {} lock = null;
    };
  };
})();

// 10. "Keep Letschat running" tip. A web app cannot switch off Android's battery restriction by itself (only the person can, in Settings), so
//     after sign-in this shows a small card once: why it matters and the exact steps for the phone brand. "Remind me later" asks again in 7 days,
//     "Don't show again" never. It also asks the browser to keep the app's saved data safe. window.lcShowBatteryHelp() opens the card on demand.
(function () {
  var w = window, d = document, K = "letschat-bs-tip", ua = navigator.userAgent || "";
  if (!/Android/i.test(ua)) return;
  var model = ua;
  try { if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) navigator.userAgentData.getHighEntropyValues(["model"]).then(function (v) { if (v && v.model) model = v.model + " " + ua; }, function () {}); } catch (e) {}
  function st() { try { return JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch (e) { return {}; } }
  function put(o) { try { localStorage.setItem(K, JSON.stringify(o)); } catch (e) {} }
  function signedIn() { try { return !!localStorage.getItem("letschat-africa:session"); } catch (e) { return false; } }
  function busy() { try { return !!((w.__lcCallBusy && w.__lcCallBusy()) || (w.__lcGroupBusy && w.__lcGroupBusy()) || (w.__lcLiveBusy && w.__lcLiveBusy())); } catch (e) { return false; } }
  function steps() {
    var m = model, base = ["Press and hold the Letschat icon, tap App info (or open Settings, Apps, Letschat).", "Tap Battery.", "Choose Unrestricted (some phones say No restrictions, Don't optimise or Allow background activity)."];
    var extra = "";
    if (/SM-|Samsung/i.test(m)) extra = "Samsung: also open Settings, Battery, Background usage limits, Never auto sleeping apps, and add Letschat.";
    else if (/Xiaomi|Redmi|POCO|\bMI \d|M\d{4}[A-Z0-9]+/i.test(m)) extra = "Xiaomi / Redmi / POCO: in App info choose Battery saver, No restrictions, then turn on Autostart.";
    else if (/TECNO|Infinix|itel/i.test(m)) extra = "Tecno / Infinix / itel: open Phone Master (or Settings, Apps, App launch), allow Auto-start for Letschat, and lock Letschat in the recent apps list.";
    else if (/OPPO|CPH\d|RMX|realme|vivo|\bV\d{4}/i.test(m)) extra = "Oppo / Realme / Vivo: in App info turn on Auto-launch and Allow background activity.";
    else if (/HUAWEI|HONOR|\bHONOR/i.test(m)) extra = "Huawei / Honor: open App launch, set Letschat to Manage manually and turn on all three switches.";
    return { base: base, extra: extra };
  }
  function show(force) {
    if (d.getElementById("lc-bs-tip") || d.getElementById("lc-update")) return;
    var o = d.createElement("div"); o.id = "lc-bs-tip"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Keep Letschat running");
    o.style.cssText = "position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147482000;max-width:460px;margin:0 auto;background:#161B22;color:#F5F7FA;border:1px solid #35D0BA;border-radius:18px;padding:14px 14px 12px;font-family:Inter,Arial,sans-serif;box-shadow:0 10px 36px rgba(0,0,0,.6)";
    function el(tag, css, text) { var e = d.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; return e; }
    o.appendChild(el("div", "font-family:Sora,Inter,Arial,sans-serif;font-weight:700;font-size:15.5px;margin-bottom:4px", "Keep Letschat running in the background"));
    o.appendChild(el("div", "font-size:13px;color:#9BA7B4;line-height:1.45;margin-bottom:8px", "Battery saver can stop messages, calls and live alerts from reaching you. Allow Letschat to run without battery limits (only you can do this in your phone settings):"));
    var sp = steps(), ol = el("ol", "margin:0 0 8px;padding-left:20px;font-size:13px;line-height:1.5;color:#E3E8EE");
    for (var i = 0; i < sp.base.length; i++) ol.appendChild(el("li", "", sp.base[i]));
    o.appendChild(ol);
    if (sp.extra) o.appendChild(el("div", "font-size:12.5px;color:#35D0BA;line-height:1.45;margin-bottom:8px", sp.extra));
    var row = el("div", "display:flex;gap:8px;flex-wrap:wrap");
    function btn(label, bg, color, fn) { var b = el("button", "flex:1;min-width:96px;padding:10px 8px;border-radius:12px;border:0;background:" + bg + ";color:" + color + ";font-weight:700;font-size:13px;cursor:pointer", label); b.type = "button"; b.onclick = function () { try { o.parentNode.removeChild(o); } catch (e) {} fn(); }; return b; }
    row.appendChild(btn("Done", "#35D0BA", "#0E1116", function () { put({ never: true, done: true }); }));
    row.appendChild(btn("Remind me later", "#2B3544", "#F5F7FA", function () { put({ until: new Date().getTime() + 7 * 86400000 }); }));
    row.appendChild(btn("Don't show again", "#1E2530", "#9BA7B4", function () { put({ never: true }); }));
    o.appendChild(row); d.body.appendChild(o);
  }
  w.lcShowBatteryHelp = function () { show(true); };
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  var tries = 0;
  function check() {
    if (++tries > 12) return;
    var s = st();
    if (s.never) return;
    if (s.until && new Date().getTime() < s.until) return;
    if (signedIn() && !d.hidden && !busy()) { show(false); return; }
    setTimeout(check, 30000);
  }
  setTimeout(check, 25000);
})();
