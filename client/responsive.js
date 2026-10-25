// Letschat responsive layer (plain ES5, loads right after compat.js).
// 1. tags <html> with the browser type (lc-ios, lc-safari, lc-android, lc-phoenix) so responsive.css can fit each one
// 2. keeps the app above the keyboard on iPhone Safari
// 3. starts the app only after React / Socket.IO / Firebase are present, and fetches them from backup hosts when a browser
//    (data saver, ad blocker, flaky mobile network, e.g. Phoenix) blocked the first host
(function () {
  "use strict";
  var w = window, d = document, root = d.documentElement, ua = navigator.userAgent || "";
  function add(c) { if ((" " + root.className + " ").indexOf(" " + c + " ") < 0) root.className += (root.className ? " " : "") + c; }

  // ---- 1. browser tags ----
  var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) add("lc-ios");
  if (/Android/i.test(ua)) add("lc-android");
  if (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(ua)) add("lc-safari");
  if (/Phoenix|PHX\b/i.test(ua)) add("lc-phoenix");

  // ---- lite mode: keypad phones and screens up to 320 px wide get a chat-only app (no fonts, reactions, push, extra tabs) ----
  var keypadUA = /KaiOS|Series40|Series60|Nokia|Opera Mini|MIDP|UCWEB|NetFront|JioPhone|itel/i.test(ua);
  var sd = false; try { sd = !!(navigator.connection && navigator.connection.saveData); } catch (e) {}
  var lite = keypadUA || (w.innerWidth || 999) <= 320 || sd;
  w.__lcLite = lite;
  if (lite) add("lc-lite");
  if (keypadUA) add("lc-keypad");  // only real keypad phones lose the extra tabs; small screens and Data Saver keep all of them

  // ---- Opera Mini (extreme / mini mode runs no real JavaScript, so the full app cannot work): use Letschat Lite, plain HTML pages ----
  var operaMini = /Opera Mini/i.test(ua); try { operaMini = operaMini || Object.prototype.toString.call(w.operamini) === "[object OperaMini]"; } catch (e) {}
  if (operaMini && !/[?&]full=1/.test(w.location.search)) {
    var goLite = function () { var api = (w.LETSCHAT_CONFIG && w.LETSCHAT_CONFIG.API_URL) || "https://letschat-9tw4.onrender.com"; w.location.replace(api.replace(/\/+$/, "") + "/lite"); };
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", goLite); else goLite();
    return;
  }

  // ---- 2. iPhone Safari: the keyboard does not shrink the page, so shrink the app to the visible area ----
  var vv = w.visualViewport;
  function shell() { return d.querySelector(".app-shell"); }
  var dvh = false; try { dvh = !!(w.CSS && CSS.supports && CSS.supports("height", "100dvh")); } catch (e) {}
  function fit() {
    var s = shell(); if (!s || !vv) return;
    var open = vv.height < w.innerHeight - 80;          // keyboard is up
    if (open) {
      s.style.top = vv.offsetTop + "px"; s.style.bottom = "auto"; s.style.height = vv.height + "px";
      if (w.pageYOffset) w.scrollTo(0, 0);
    } else {
      s.style.top = ""; s.style.bottom = "";
      s.style.height = dvh ? "" : (vv.height || w.innerHeight) + "px";
    }
  }
  if (ios && vv) {
    vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit);
    d.addEventListener("focusin", function () { setTimeout(fit, 120); });
    d.addEventListener("focusout", function () { setTimeout(fit, 120); });
  }

  // ---- 3. safe start ----
  if (w.__lcTooOld) return;
  var modern = false; try { modern = !!(w.CSS && CSS.supports && CSS.supports("inset", "0")); } catch (e) {}
  var JSD = "https://cdn.jsdelivr.net/npm/", CJS = "https://cdnjs.cloudflare.com/ajax/libs/";
  var FB = modern ? "10.12.2" : "8.10.1", fbFiles = modern ? ["firebase-app-compat", "firebase-auth-compat"] : ["firebase-app", "firebase-auth"];
  var LIBS = [
    { ok: function () { return !!w.React; }, sets: [[JSD + "react@18.3.1/umd/react.production.min.js"], [CJS + "react/18.3.1/umd/react.production.min.js"]] },
    { ok: function () { return !!w.ReactDOM; }, sets: [[JSD + "react-dom@18.3.1/umd/react-dom.production.min.js"], [CJS + "react-dom/18.3.1/umd/react-dom.production.min.js"]] },
    { ok: function () { return !!w.io; }, sets: [[JSD + "socket.io-client@4.7.5/dist/socket.io.min.js"], [CJS + "socket.io/4.7.5/socket.io.min.js"]] },
    { ok: function () { return !!(w.firebase && w.firebase.auth); }, sets: [
      [CJS + "firebase/" + FB + "/" + fbFiles[0] + ".min.js", CJS + "firebase/" + FB + "/" + fbFiles[1] + ".min.js"],
      [JSD + "firebase@" + FB + "/" + fbFiles[0] + ".js", JSD + "firebase@" + FB + "/" + fbFiles[1] + ".js"]
    ] }
  ];
  var usedBackup = false, started = false;

  function load(src, done) {
    var s = d.createElement("script"), t, fin = false;
    function end(ok) { if (fin) return; fin = true; clearTimeout(t); done(ok); }
    s.src = src; s.async = false; s.crossOrigin = "anonymous";
    s.onload = function () { end(true); };
    s.onerror = function () { end(false); };
    t = setTimeout(function () { end(false); }, 9000);
    (d.head || root).appendChild(s);
  }
  function loadSet(urls, i, done) { if (i >= urls.length) return done(true); load(urls[i], function (ok) { if (!ok) return done(false); loadSet(urls, i + 1, done); }); }
  function fix(lib, n, done) {
    if (lib.ok() || n >= lib.sets.length) return done();
    usedBackup = true;
    loadSet(lib.sets[n], 0, function () { fix(lib, lib.ok() ? lib.sets.length : n + 1, done); });
  }
  function fixAll(i, done) { if (i >= LIBS.length) return done(); fix(LIBS[i], 0, function () { fixAll(i + 1, done); }); }

  function inject(src) { var s = d.createElement("script"); s.src = src; s.async = false; d.body.appendChild(s); }
  function start() {
    if (started) return;
    if (!w.React || !w.ReactDOM) { // never start the app without React: explain instead of a blank crash screen
      if (w.showErr) w.showErr("Letschat could not load its React library. Check your internet connection, then tap Reload.");
      return;
    }
    started = true;
    if (usedBackup) { var b = d.getElementById("error-box"); if (b && /FAILED TO LOAD SCRIPT/.test(b.textContent || "")) { b.style.display = "none"; b.textContent = ""; } }
    if (!lite) {
      var f = d.createElement("link"); f.rel = "stylesheet"; f.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap"; d.head.appendChild(f);
      inject("push.js"); inject("reactions.js"); inject("live.js"); // optional extras: the app works without them
    }
    // modern phones get the small modern bundle; old ones the ES5 bundle (build.js makes app.legacy.js). If it is missing, app.js is used.
    if (modern) inject("app.js"); else { var L = d.createElement("script"); L.src = "app.legacy.js"; L.async = false; L.onerror = function () { inject("app.js"); }; d.body.appendChild(L); }
    inject("device.js");
    inject("brain.js"); // offline AI brain: loaded after the app starts so it never delays the first screen
  }
  function go() { fixAll(0, start); setTimeout(start, 30000); } // never wait forever: the app shows its own error if something is still missing
  // responsive.js is a deferred script, so document.readyState is already "interactive" while it runs, BEFORE the React / Firebase /
  // Socket.IO scripts listed after it in index.html. Starting now made it fetch a second copy of React from a backup host and the app
  // and ReactDOM ended up on different copies ("Cannot read properties of null (reading 'useState')"). Wait until every deferred
  // script has finished (DOMContentLoaded), and only then check which libraries are really missing.
  var went = false;
  function goOnce() { if (went) return; went = true; go(); }
  if (d.readyState === "complete") goOnce();
  else { d.addEventListener("DOMContentLoaded", goOnce); w.addEventListener("load", goOnce); }
})();
