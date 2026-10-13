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
