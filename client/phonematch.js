// Letschat phone match (plain ES5, loads right after device.js).
// Scans the phone (Android version, model, CPU family and 32/64-bit, CPU cores, memory) and makes the "Letschat for Android" bar and the install card offer the best install for it.
// Order of preference, each one only if this phone is compatible AND the file really exists on the site:
//   1. Letschat.apk         full native app      (Android 7 and newer, not on light phones)
//   2. Letschat-legacy.apk  compatible app       (Android 5 and newer)
//   3. web app (PWA)        browser install      (any phone; the only choice on Android 4.4 and older)
// If the first choice is not compatible or not on the site, the next one is offered automatically ("bounces back").
// A web page cannot see whether an APK install failed on the phone, so the card also has a "Didn't install? Try ..." button for the next choice.
// Chrome 110+ freezes the Android number in the user agent ("Android 10"), so the real version, model and CPU come from User-Agent Client Hints;
// browsers without hints (Firefox, old Chrome) fall back to navigator.platform ("Linux aarch64", "Linux armv8l", "Linux x86_64"...).
// CPU note: neither APK carries native libraries or an ABI filter (see ANDROID-COMPATIBILITY.md), so the CPU family can never block an APK. It is shown on the
// card and, together with 32/64-bit, cores and memory, decides whether this is a "light" phone that gets the lighter compatible app instead of the full one.
// Windows PCs: when Letschat-Setup.exe is on the site the Install button offers it (see windowsExe below); if the file is not there, the browser's own install is used.
(function () {
  var ua = navigator.userAgent || "";
  if (!/android/i.test(ua)) { if (/Windows NT/i.test(ua)) windowsExe(); return; } // iPhones and other computers keep the existing behaviour
  function inAppBrowser() { return /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|MicroMessenger|; wv\)|WhatsApp/i.test(ua); }
  function standalone() { try { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true || /LetschatApp/.test(ua); } catch (e) { return false; } }
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  function toast(msg, ms) {
    var t = el("div", "position:fixed;left:0;right:0;margin:0 auto;width:max-content;max-width:90%;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:100002;background:#161B22;color:#F5F7FA;border:1px solid #262E3A;border-radius:20px;padding:10px 16px;font:500 14px Inter,system-ui,sans-serif", msg);
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ms || 4000);
  }

  // ---- 1. scan the phone ----
  var m = /Android[ \/](\d+)/i.exec(ua);
  var model = (function () { var r = /Android[ \d.]*;\s*([^;)]+?)(?: Build|\)|;)/i.exec(ua); var t = r ? r[1].replace(/^\s+|\s+$/g, "") : ""; return /^(K|Mobile|Tablet)$/i.test(t) ? "" : t; })();
  // family: "arm" | "x86" | "other" | "" (not known). bits: 32 | 64 | 0 (not known). ram is in GB as the browser rounds it (0.25, 0.5, 1, 2, 4, 8), 0 when not shown.
  var DEV = { android: m ? parseInt(m[1], 10) : 0, model: model, family: "", bits: 0, arch: "", ram: navigator.deviceMemory || 0, cores: navigator.hardwareConcurrency || 0, ready: false };
  window.LetschatDevice = DEV;
  // CPU from navigator.platform: "Linux aarch64" = ARM 64, "Linux armv8l" / "armv7l" = ARM 32-bit programs (even on a 64-bit chip), "Linux x86_64" = x86 64, "Linux i686" = x86 32
  (function () {
    var p = String(navigator.platform || "");
    if (/aarch64|arm64/i.test(p)) { DEV.family = "arm"; DEV.bits = 64; }
    else if (/arm|armv/i.test(p)) { DEV.family = "arm"; DEV.bits = 32; }
    else if (/x86_64|amd64/i.test(p)) { DEV.family = "x86"; DEV.bits = 64; }
    else if (/i[3-6]86|x86/i.test(p)) { DEV.family = "x86"; DEV.bits = 32; }
    else if (/mips|riscv|ppc/i.test(p)) { DEV.family = "other"; }
  })();
  var waiting = [];
  function done() { if (DEV.ready) return; DEV.ready = true; var q = waiting; waiting = []; for (var i = 0; i < q.length; i++) { try { q[i](); } catch (e) {} } }
  function whenReady(cb) { if (DEV.ready) cb(); else waiting.push(cb); }
  try {
    var u = navigator.userAgentData;
    if (u && u.getHighEntropyValues && /android/i.test(u.platform || "")) {
      setTimeout(done, 1500); // never wait longer than 1.5 s for the browser
      u.getHighEntropyValues(["platformVersion", "model", "architecture", "bitness"]).then(function (h) {
        var pv = parseInt(String(h.platformVersion || "").split(".")[0], 10);
        if (pv > 0 && pv < 40) DEV.android = pv;
        if (h.model) DEV.model = h.model;
        if (h.architecture === "arm" || h.architecture === "x86") DEV.family = h.architecture; // the browser's answer beats the platform-string guess
        if (h.bitness === "64") DEV.bits = 64; else if (h.bitness === "32") DEV.bits = 32;
        done();
      }, done);
    } else done();
  } catch (e) { done(); }
  function cpuLabel() {
    var f = DEV.family === "arm" ? "ARM" : DEV.family === "x86" ? "x86" : DEV.family === "other" ? "other CPU" : "";
    return [f, DEV.bits ? DEV.bits + "-bit" : ""].join(" ").replace(/^\s+|\s+$/g, "");
  }

  // ---- 2. work out which installs fit this phone, in order of preference ----
  // A "light" phone gets the lighter compatible app instead of the full native app (which runs a background service and the floating bubble). Light means:
  //   - 512 MB of memory or less, or
  //   - a 32-bit CPU with 2 or fewer cores and 2 GB of memory or less (when the browser shows memory), or
  //   - a 32-bit CPU with 2 or fewer cores and the memory not shown
  // The CPU family (ARM or x86) never makes a phone light: both APKs run on every CPU family.
  function lightPhone() {
    if (DEV.ram && DEV.ram < 1) return true;
    var weakCpu = DEV.bits === 32 && DEV.cores > 0 && DEV.cores <= 2;
    return weakCpu && (!DEV.ram || DEV.ram <= 2);
  }
  function lightReason() {
    if (DEV.ram && DEV.ram < 1) return "very little memory";
    return "an older 32-bit processor";
  }
  function options() {
    var v = DEV.android, o = [];
    if ((!v || v >= 7) && !lightPhone()) o.push({ id: "native", file: "Letschat.apk", name: "full app" });
    if (!v || v >= 5) o.push({ id: "legacy", file: "Letschat-legacy.apk", name: "compatible app" });
    o.push({ id: "pwa", name: "web app" });
    return o;
  }
  function phoneLine() {
    var bits = [];
    if (DEV.model) bits.push(DEV.model);
    bits.push("Android " + (DEV.android || "(version not shown)"));
    if (cpuLabel()) bits.push(cpuLabel());
    if (DEV.cores) bits.push(DEV.cores + " cores");
    if (DEV.ram) bits.push("about " + DEV.ram + " GB memory");
    return "Your phone: " + bits.join(", ") + ".";
  }
  function why(o) {
    if (o.id === "native") return "Best match: the full Letschat app for Android 7 and newer (Letschat.apk).";
    if (o.id === "legacy") return lightPhone() && (!DEV.android || DEV.android >= 7)
      ? "Best match: the lighter compatible app, because this phone has " + lightReason() + " (Letschat-legacy.apk)."
      : "Best match: the compatible app for Android 5 and 6 (Letschat-legacy.apk).";
    return "Best match: the web app, installed straight from your browser. No file to download.";
  }
  function available(f) {
    try { return fetch("./" + f, { method: "HEAD", cache: "no-store" }).then(function (r) { return r.ok && !/text\/html/i.test(r.headers.get("content-type") || ""); }).catch(function () { return false; }); }
    catch (e) { return Promise.resolve(false); }
  }
  // the compatible options whose file really exists, still in order of preference (the web app is always last)
  function resolve() {
    var ok = [];
    return options().reduce(function (p, o) {
      return p.then(function () {
        if (!o.file) { ok.push(o); return; }
        return available(o.file).then(function (a) { if (a) ok.push(o); });
      });
    }, Promise.resolve()).then(function () { return ok; });
  }

  // ---- 3. install actions and the card ----
  function download(f) {
    var a = document.createElement("a"); a.href = "./" + f; a.download = f; a.style.display = "none";
    document.body.appendChild(a); a.click(); setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
    toast("Downloading Letschat. Open the file when it finishes.", 6000);
  }
  function closeCard() { var old = document.getElementById("lc-phone-match"); if (old && old.parentNode) old.parentNode.removeChild(old); }
  function pwaInstall() {
    var p = window.__lcInstall; // Chrome's one-tap install event, kept by index.html
    if (p && p.prompt) { window.__lcInstall = null; try { p.prompt(); return; } catch (e) {} }
    showCard({ title: "Install the Letschat web app", lines: ["1. Tap the three dots menu of your browser.", "2. Tap Install app (or Add to Home screen).", "3. Tap Install. Letschat then opens like a normal app.", "Not seeing it? Open this page in Chrome and try again."], list: [{ id: "guide" }], noFallback: true });
  }
  // list = the options still to try; list[0] is the recommended one, list[1] is where "Didn't install?" goes next
  function showCard(spec) {
    closeCard();
    var list = spec.list, first = list[0], isApk = !!first.file;
    var c = el("div", "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:100001;max-width:460px;max-height:85vh;overflow-y:auto;margin:0 auto;background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 12px 40px rgba(0,0,0,.55)");
    c.id = "lc-phone-match"; c.setAttribute("role", "dialog");
    var title = spec.title || (isApk ? "Get the Letschat app for Android" : "Install Letschat");
    c.setAttribute("aria-label", title);
    c.appendChild(el("div", "font:700 16px Sora,Inter,sans-serif;margin-bottom:6px", title));
    var lines = spec.lines || (isApk
      ? [phoneLine() + " " + why(first),
         "Tap Download app, then open the file. If Android says installs are blocked, tap Settings, allow your browser to install apps, then come back and tap Download again.",
         "Android may warn that the app is from an unknown source. That is normal for apps outside Google Play: tap Install anyway.",
         "If Android says App not installed, an older Letschat is usually still on the phone: hold the Letschat icon, tap App info, then Uninstall, and open the downloaded file again.",
         "If the download fails or says Something went wrong, open this page in Chrome and try again."]
      : [phoneLine() + " " + why(first), "Tap Install web app. Letschat then opens like a normal app, with no file to download."]);
    for (var i = 0; i < lines.length; i++) c.appendChild(el("div", "font-size:13.5px;line-height:1.45;color:" + (i === 0 && !spec.lines ? "#F5F7FA;font-weight:600" : "#C5CEDA") + ";margin-bottom:6px", lines[i]));
    function btn(label, primary, fn) { var b = el("button", "flex:1;border:0;border-radius:20px;padding:11px 0;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;background:" + (primary ? "#35D0BA" : "#262E3A") + ";color:" + (primary ? "#0E1116" : "#F5F7FA"), label); b.onclick = function () { closeCard(); if (fn) fn(); }; return b; }
    var row = el("div", "display:flex;gap:8px;margin-top:10px");
    if (first.id === "guide") row.appendChild(btn("Done", true));
    else {
      row.appendChild(btn("Cancel", false));
      row.appendChild(btn(isApk ? "Download app" : "Install web app", true, function () { if (isApk) download(first.file); else pwaInstall(); }));
    }
    c.appendChild(row);
    // bounce back: the next compatible choice, for when the first one would not install
    if (!spec.noFallback && list.length > 1) {
      var next = list[1];
      var t = el("button", "display:block;width:100%;margin-top:10px;border:0;background:transparent;color:#35D0BA;font:600 13.5px Inter,system-ui,sans-serif;cursor:pointer;padding:6px 0", "Didn't install? Try the " + next.name + (next.file ? " (" + next.file + ")" : ""));
      t.onclick = function () { showCard({ list: list.slice(1) }); };
      c.appendChild(t);
    }
    document.body.appendChild(c);
  }

  // take over the install button (the bar's Download button calls LetschatInstall.install)
  function hook() {
    var I = window.LetschatInstall;
    if (!I || I.__phoneMatch) return !!(I && I.__phoneMatch);
    var orig = I.install;
    I.__phoneMatch = true;
    I.install = function () {
      if (standalone() || inAppBrowser()) return orig && orig.apply(I, arguments);
      return new Promise(function (r) { whenReady(r); }).then(resolve).then(function (list) {
        if (list[0].id === "pwa") { // no app file fits this phone (too old) or none is on the site yet: web app
          if (DEV.android && DEV.android < 5) toast("This Android version is too old for the app file, so the web version is used instead.", 5000);
          return pwaInstall();
        }
        showCard({ list: list });
      });
    };
    return true;
  }
  var tries = 0, t1 = hook() ? 0 : setInterval(function () { if (hook() || ++tries > 40) clearInterval(t1); }, 250);

  // ---- 4. show the detected version on the "Letschat for Android" bar ----
  var tries2 = 0, t2 = setInterval(function () {
    if (++tries2 > 60) return clearInterval(t2);
    var bar = document.getElementById("lc-android-bar"); if (!bar) return;
    clearInterval(t2);
    whenReady(function () {
      var span = bar.getElementsByTagName("span")[0];
      if (span && DEV.android) span.textContent = "Letschat for Android " + DEV.android;
    });
  }, 500);

  // ---- 5. Windows PC: the installer (.exe) ----
  // Runs on Windows only. When Letschat-Setup.exe is on the site, the Install button offers it, with the browser's own web app install as the second choice.
  // When the file is not on the site (or the check fails), nothing changes: the browser's own install is used, exactly as before.
  function windowsExe() {
    var F = "Letschat-Setup.exe";
    function installed() { try { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || /LetschatApp/.test(ua); } catch (e) { return false; } }
    function card(fallback) {
      var old = document.getElementById("lc-pc-install"); if (old && old.parentNode) old.parentNode.removeChild(old);
      var c = document.createElement("div");
      c.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:100001;max-width:460px;max-height:85vh;overflow-y:auto;margin:0 auto;background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 12px 40px rgba(0,0,0,.55)";
      c.id = "lc-pc-install"; c.setAttribute("role", "dialog"); c.setAttribute("aria-label", "Get Letschat for Windows");
      function add(css, text) { var n = document.createElement("div"); n.style.cssText = css; n.textContent = text; c.appendChild(n); }
      add("font:700 16px Sora,Inter,sans-serif;margin-bottom:6px", "Get Letschat for Windows");
      var lines = ["Click Download installer, then open Letschat-Setup.exe when it finishes.",
        "If Windows says it protected your PC, click More info, then Run anyway. Windows shows that for apps it does not know yet.",
        "If the installer does not start, use the web app instead: it installs from your browser and needs no file."];
      for (var i = 0; i < lines.length; i++) add("font-size:13.5px;line-height:1.45;color:#C5CEDA;margin-bottom:6px", lines[i]);
      function close() { if (c.parentNode) c.parentNode.removeChild(c); }
      function btn(label, primary, fn) { var b = document.createElement("button"); b.textContent = label; b.style.cssText = "flex:1;border:0;border-radius:20px;padding:11px 0;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;background:" + (primary ? "#35D0BA" : "#262E3A") + ";color:" + (primary ? "#0E1116" : "#F5F7FA"); b.onclick = function () { close(); if (fn) fn(); }; return b; }
      var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;margin-top:10px";
      row.appendChild(btn("Cancel", false));
      row.appendChild(btn("Download installer", true, function () {
        var a = document.createElement("a"); a.href = "./" + F; a.download = F; a.style.display = "none";
        document.body.appendChild(a); a.click(); setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
      }));
      c.appendChild(row);
      var alt = document.createElement("button"); alt.textContent = "Install the web app instead";
      alt.style.cssText = "display:block;width:100%;margin-top:10px;border:0;background:transparent;color:#35D0BA;font:600 13.5px Inter,system-ui,sans-serif;cursor:pointer;padding:6px 0";
      alt.onclick = function () { close(); if (fallback) fallback(); };
      c.appendChild(alt);
      document.body.appendChild(c);
    }
    function hookPc() {
      var I = window.LetschatInstall;
      if (!I || I.__pcMatch) return !!(I && I.__pcMatch);
      var orig = I.install;
      I.__pcMatch = true;
      I.install = function () {
        var args = arguments;
        function web() { return orig && orig.apply(I, args); }
        if (installed()) return web();
        return available(F).then(function (ok) { if (ok) card(web); else web(); });
      };
      return true;
    }
    var n = 0, t = hookPc() ? 0 : setInterval(function () { if (hookPc() || ++n > 40) clearInterval(t); }, 250);
  }
})();
