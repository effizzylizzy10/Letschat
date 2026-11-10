// Letschat phone match (plain ES5, loads right after device.js).
// Detects the phone's Android version, model and CPU, then makes the "Letschat for Android" bar and the install card offer the app file
// that best matches that phone:
//   Android 7 and newer -> Letschat.apk          Android 5 and 6 -> Letschat-legacy.apk          Android 4.4 and older -> no app file (web version)
// Chrome 110+ freezes the Android number in the user agent ("Android 10"), so the real version, model and CPU come from User-Agent Client Hints.
(function () {
  var ua = navigator.userAgent || "";
  if (!/android/i.test(ua)) return; // iPhones and computers keep the existing behaviour
  function inAppBrowser() { return /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|MicroMessenger|; wv\)|WhatsApp/i.test(ua); }
  function standalone() { try { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true || /LetschatApp/.test(ua); } catch (e) { return false; } }
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  function toast(msg, ms) {
    var t = el("div", "position:fixed;left:0;right:0;margin:0 auto;width:max-content;max-width:90%;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:100002;background:#161B22;color:#F5F7FA;border:1px solid #262E3A;border-radius:20px;padding:10px 16px;font:500 14px Inter,system-ui,sans-serif", msg);
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ms || 4000);
  }

  // ---- 1. detect the phone ----
  var m = /Android[ \/](\d+)/i.exec(ua);
  var model = (function () { var r = /Android[ \d.]*;\s*([^;)]+?)(?: Build|\)|;)/i.exec(ua); var t = r ? r[1].replace(/^\s+|\s+$/g, "") : ""; return /^(K|Mobile|Tablet)$/i.test(t) ? "" : t; })();
  var DEV = { android: m ? parseInt(m[1], 10) : 0, model: model, arch: "", ready: false };
  window.LetschatDevice = DEV;
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
        if (h.architecture) DEV.arch = h.architecture + (h.bitness ? "-" + h.bitness : "");
        done();
      }, done);
    } else done();
  } catch (e) { done(); }

  // ---- 2. pick the app file ----
  function apkName() { var v = DEV.android; if (!v) return "Letschat.apk"; if (v < 5) return ""; return v < 7 ? "Letschat-legacy.apk" : "Letschat.apk"; }
  function why(f) { return f === "Letschat-legacy.apk" ? "Best match: the compatible app for Android 5 and 6 (Letschat-legacy.apk)." : "Best match: the full Letschat app for Android 7 and newer (Letschat.apk)."; }
  function phoneLine() { return "Your phone: " + (DEV.model ? DEV.model + ", " : "") + "Android " + (DEV.android || "(version not shown)") + (DEV.arch ? ", " + DEV.arch : "") + "."; }
  function available(f) {
    try { return fetch("./" + f, { method: "HEAD", cache: "no-store" }).then(function (r) { return r.ok && !/text\/html/i.test(r.headers.get("content-type") || ""); }).catch(function () { return false; }); }
    catch (e) { return Promise.resolve(false); }
  }
  function download(f) {
    var a = document.createElement("a"); a.href = "./" + f; a.download = f; a.style.display = "none";
    document.body.appendChild(a); a.click(); setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
    toast("Downloading Letschat. Open the file when it finishes.", 6000);
  }
  function card(f) {
    if (document.getElementById("lc-phone-match")) return;
    var c = el("div", "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:100001;max-width:460px;max-height:85vh;overflow-y:auto;margin:0 auto;background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 12px 40px rgba(0,0,0,.55)");
    c.id = "lc-phone-match"; c.setAttribute("role", "dialog"); c.setAttribute("aria-label", "Get the Letschat app for Android");
    c.appendChild(el("div", "font:700 16px Sora,Inter,sans-serif;margin-bottom:6px", "Get the Letschat app for Android"));
    var lines = [phoneLine() + " " + why(f),
      "Tap Download app, then open the file. If Android says installs are blocked, tap Settings, allow your browser to install apps, then come back and tap Download again.",
      "Android may warn that the app is from an unknown source. That is normal for apps outside Google Play: tap Install anyway.",
      "If Android says App not installed, an older Letschat is usually still on the phone: hold the Letschat icon, tap App info, then Uninstall, and open the downloaded file again.",
      "If the download fails or says Something went wrong, open this page in Chrome and try again."];
    for (var i = 0; i < lines.length; i++) c.appendChild(el("div", "font-size:13.5px;line-height:1.45;color:" + (i === 0 ? "#F5F7FA;font-weight:600" : "#C5CEDA") + ";margin-bottom:6px", lines[i]));
    var row = el("div", "display:flex;gap:8px;margin-top:10px");
    function btn(label, primary, fn) { var b = el("button", "flex:1;border:0;border-radius:20px;padding:11px 0;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;background:" + (primary ? "#35D0BA" : "#262E3A") + ";color:" + (primary ? "#0E1116" : "#F5F7FA"), label); b.onclick = function () { if (c.parentNode) c.parentNode.removeChild(c); if (fn) fn(); }; return b; }
    row.appendChild(btn("Cancel", false)); row.appendChild(btn("Download app", true, function () { download(f); }));
    c.appendChild(row); document.body.appendChild(c);
  }

  // ---- 3. take over the install button (the bar's Download button calls LetschatInstall.install) ----
  function hook() {
    var I = window.LetschatInstall;
    if (!I || I.__phoneMatch) return !!(I && I.__phoneMatch);
    var orig = I.install;
    I.__phoneMatch = true;
    I.install = function () {
      if (standalone() || inAppBrowser()) return orig && orig.apply(I, arguments);
      return new Promise(function (r) { whenReady(r); }).then(function () {
        var f = apkName();
        if (!f) { toast("This Android version is too old for the app file, so the web version is used instead.", 5000); return orig && orig.apply(I, arguments); }
        return available(f).then(function (ok) { if (!ok) return toast("The Android app file is not available yet. Please try again later.", 4500); card(f); });
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
})();
