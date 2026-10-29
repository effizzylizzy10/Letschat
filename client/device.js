// Letschat device features: keep data on the device, one-time access setup, chat backup, self-healing.
(function () {
  var API = (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.API_URL) || "";
  var ASKED = "lc-access-asked";
  function session() { try { return JSON.parse(localStorage.getItem("letschat-africa:session")) || null; } catch (e) { return null; } }
  function standalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true || /LetschatApp/.test(navigator.userAgent); }
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  var toastEl;
  function toast(msg, ms) {
    if (toastEl) toastEl.remove();
    toastEl = el("div", "position:fixed;left:0;right:0;margin:0 auto;width:max-content;max-width:90%;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:100001;background:#161B22;color:#F5F7FA;border:1px solid #262E3A;border-radius:20px;padding:10px 16px;font:500 14px Inter,system-ui,sans-serif;animation:lcFadeUp .2s ease-out", msg);
    document.body.appendChild(toastEl);
    var t = toastEl; setTimeout(function () { if (t.parentNode) t.remove(); }, ms || 2500);
  }

  // 1. ask the browser to keep this app's saved data (images, cache) instead of clearing it when space runs low
  function persist() { try { return navigator.storage && navigator.storage.persist ? navigator.storage.persist() : Promise.resolve(false); } catch (e) { return Promise.resolve(false); } }
  persist();

  // 2. permissions the app needs to run smoothly (notifications, camera, microphone, storage).
  // The app asks once after sign-in, in one card, and ONLY for what is still missing: when everything is already allowed there is no prompt at all.
  var SNOOZE = "lc-perm-snooze", PROMPTED = "lc-perm-prompted";
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function queryPerm(name) {
    try { if (navigator.permissions && navigator.permissions.query) return navigator.permissions.query({ name: name }).then(function (r) { return r.state; }, function () { return "unknown"; }); } catch (e) {}
    return Promise.resolve("unknown");
  }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  // each item: state is "granted" | "denied" | "prompt" (the browser will ask) | "unknown" (this browser cannot tell) | "na" (not available here)
  function permissionStates() {
    var notif = "na";
    if ("Notification" in window && !(isIOS() && !standalone())) notif = Notification.permission === "default" ? "prompt" : Notification.permission;
    var hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    var hasGeo = !!navigator.geolocation;
    return Promise.all([hasMedia ? queryPerm("camera") : "na", hasMedia ? queryPerm("microphone") : "na", hasGeo ? queryPerm("geolocation") : "na"]).then(function (r) {
      return { notifications: notif, camera: r[0], microphone: r[1], location: r[2] };
    });
  }
  var LABELS = {
    notifications: ["Notifications", "new messages and incoming calls"],
    camera: ["Camera", "video calls, photos and Go Live"],
    microphone: ["Microphone", "voice notes and calls"],
    location: ["Location", "sharing your location and finding people nearby"]
  };
  function missingFrom(st) {
    var out = [];
    Object.keys(LABELS).forEach(function (k) {
      // "unknown" (older browsers cannot report camera/microphone): ask only the first time, never again
      if (st[k] === "prompt" || (st[k] === "unknown" && !ls(PROMPTED))) out.push(k);
    });
    return out;
  }
  function requestAll(missing) {
    var steps = [];
    if (missing.indexOf("notifications") >= 0) {
      steps.push(function () {
        if (window.LetschatPush && window.LetschatPush.enable) return window.LetschatPush.enable().catch(function () {});
        // old Safari / Firefox use a callback instead of a promise: support both
        return new Promise(function (done) {
          try { var r = Notification.requestPermission(function () { done(); }); if (r && r.then) r.then(function () { done(); }, function () { done(); }); } catch (e) { done(); }
          setTimeout(done, 60000);
        });
      });
    }
    if (missing.indexOf("location") >= 0) {
      steps.push(function () {
        return new Promise(function (done) {
          try { navigator.geolocation.getCurrentPosition(function () { done(); }, function () { done(); }, { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 }); } catch (e) { done(); }
          setTimeout(done, 25000);
        });
      });
    }
    var cam = missing.indexOf("camera") >= 0, mic = missing.indexOf("microphone") >= 0;
    if (cam || mic) {
      steps.push(function () {
        var md = navigator.mediaDevices;
        var stop = function (s) { if (s) s.getTracks().forEach(function (t) { t.stop(); }); };
        return md.getUserMedia({ audio: mic, video: cam })
          .catch(function () { return cam && mic ? md.getUserMedia({ audio: true }) : null; }) // camera refused: still try the microphone
          .then(stop, function () {});
      });
    }
    steps.push(function () { return persist(); });
    return steps.reduce(function (p, fn) { return p.then(function () { return fn(); }).catch(function () {}); }, Promise.resolve());
  }
  function showPermissionCard(missing, denied) {
    if (document.getElementById("lc-perm-card")) return;
    var card = el("div", "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:100001;background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 12px 40px rgba(0,0,0,.55)");
    card.id = "lc-perm-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Allow permissions");
    card.appendChild(el("div", "font:700 16px Sora,Inter,sans-serif;margin-bottom:4px", "Allow permissions"));
    card.appendChild(el("div", "font-size:13px;color:#8891A0;margin-bottom:10px", "Letschat needs these to run smoothly:"));
    missing.forEach(function (k) {
      var row = el("div", "display:flex;gap:8px;align-items:baseline;margin:0 0 6px;font-size:14px");
      row.appendChild(el("span", "font-weight:600;color:#35D0BA", LABELS[k][0]));
      row.appendChild(el("span", "color:#C5CEDA", "for " + LABELS[k][1]));
      card.appendChild(row);
    });
    if (denied.length) card.appendChild(el("div", "font-size:12px;color:#B9A25A;margin:4px 0 0", denied.map(function (k) { return LABELS[k][0]; }).join(", ") + " blocked: turn on in your phone's app settings."));
    var row = el("div", "display:flex;gap:8px;margin-top:12px");
    function btn(label, bg, color, fn) { var b = el("button", "flex:1;border:0;border-radius:20px;padding:11px 0;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;background:" + bg + ";color:" + color, label); b.onclick = fn; return b; }
    function close() { card.remove(); }
    row.appendChild(btn("Later", "#262E3A", "#F5F7FA", function () { lsSet(SNOOZE, String(Date.now() + 24 * 3600 * 1000)); close(); }));
    row.appendChild(btn("Allow", "#35D0BA", "#0E1116", function () {
      lsSet(PROMPTED, "1"); close();
      requestAll(missing).then(function () { lsSet(PROMPTED, "1"); });
    }));
    card.appendChild(row); document.body.appendChild(card);
  }
  function checkPermissions() {
    var until = parseInt(ls(SNOOZE) || "0", 10);
    if (until && Date.now() < until) return Promise.resolve();
    return permissionStates().then(function (st) {
      var missing = missingFrom(st);
      if (!missing.length) return; // everything needed is already allowed (or blocked): no prompt
      var denied = Object.keys(LABELS).filter(function (k) { return st[k] === "denied"; });
      showPermissionCard(missing, denied);
    }).catch(function () {});
  }
  var tries = 0, poll = setInterval(function () {
    if (++tries > 60) return clearInterval(poll);
    var s = session();
    if (!s || !s.token || document.hidden) return;
    clearInterval(poll);
    checkPermissions();
  }, 2500);

  // 3. back up chats to a file on this device
  function api(path) {
    var s = session();
    return fetch(API + "/api/v1" + path, { headers: { Authorization: "Bearer " + (s && s.token) } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "Request failed"); return j; }); });
  }
  var running = false;
  async function run() {
    var s = session();
    if (!s || !s.token) return toast("Sign in first");
    if (running) return;
    running = true; toast("Backing up...", 60000);
    try {
      var list = (await api("/conversations")).conversations || [];
      var parts = ['{"app":"Letschat Africa","exportedAt":' + JSON.stringify(new Date().toISOString()) + ',"user":' + JSON.stringify({ id: s.user && s.user.id, name: s.user && s.user.name }) + ',"conversations":['];
      for (var i = 0; i < list.length; i++) {
        var c = list[i], msgs = [], before = null, more = true, guard = 0;
        while (more && guard++ < 200) {
          var d = await api("/conversations/" + c.id + "/messages?limit=500" + (before ? "&before=" + before : ""));
          var page = d.messages || [];
          if (!page.length) break;
          msgs = page.concat(msgs); before = page[0].time; more = !!d.hasMore;
        }
        parts.push((i ? "," : "") + JSON.stringify({ id: c.id, name: c.name || (c.other && c.other.name) || "", isGroup: !!c.isGroup, messages: msgs }));
        toast("Backing up " + (i + 1) + " of " + list.length, 60000);
      }
      parts.push("]}");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(parts, { type: "application/json" }));
      a.download = "letschat-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
      toast("Backup saved to your device", 3500);
    } catch (e) { toast("Backup failed: " + e.message, 4000); } finally { running = false; }
  }
  // restore: pick a backup file and send it back to the server in small batches
  function restore() {
    var s = session();
    if (!s || !s.token) return toast("Sign in first");
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,application/json"; inp.style.display = "none";
    inp.onchange = async function () {
      var file = inp.files && inp.files[0]; inp.remove();
      if (!file || running) return;
      running = true; toast("Restoring...", 120000);
      try {
        var data = JSON.parse(await file.text());
        if (!data || data.app !== "Letschat Africa" || !Array.isArray(data.conversations)) throw new Error("Not a Letschat backup");
        var restored = 0, skipped = 0, total = 0;
        data.conversations.forEach(function (c) { total += (c.messages || []).length; });
        var done = 0;
        for (var i = 0; i < data.conversations.length; i++) {
          var c = data.conversations[i], msgs = (c.messages || []).filter(function (m) { return m && m.senderId === s.user.id; });
          done += (c.messages || []).length - msgs.length; skipped += (c.messages || []).length - msgs.length;
          var batch = [], size = 0;
          for (var j = 0; j <= msgs.length; j++) {
            var m = msgs[j], len = m ? JSON.stringify(m).length : 0;
            if (m && batch.length < 300 && size + len < 3000000) { batch.push(m); size += len; continue; }
            if (batch.length) {
              var r = await fetch(API + "/api/v1/me/restore", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token }, body: JSON.stringify({ conversations: [{ id: c.id, isGroup: !!c.isGroup, messages: batch }] }) });
              var out = await r.json().catch(function () { return {}; });
              if (!r.ok) throw new Error((out.error && (out.error.message || out.error)) || "Restore failed");
              restored += out.restored || 0; skipped += out.skipped || 0; done += batch.length;
              toast("Restoring " + Math.min(done, total) + " of " + total, 120000);
            }
            batch = m ? [m] : []; size = len;
          }
        }
        toast("Restored " + restored + " message" + (restored === 1 ? "" : "s") + (skipped ? " (" + skipped + " skipped)" : "") + ". Reopen your chats to see them.", 6000);
      } catch (e) { toast("Restore failed: " + e.message, 4500); } finally { running = false; }
    };
    document.body.appendChild(inp); inp.click();
  }
  window.LetschatBackup = { run: run, restore: restore };

  // delete my account (profile, chats and messages are removed from the server)
  window.LetschatAccount = {
    remove: function () {
      var s = session();
      if (!s || !s.token) return;
      if (!window.confirm("Delete your account? Your profile, chats and messages will be removed for good.")) return;
      if (window.prompt("Type DELETE to confirm") !== "DELETE") return toast("Cancelled");
      fetch(API + "/api/v1/me", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token }, body: JSON.stringify({ confirm: "DELETE" }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "Could not delete"); }); })
        .then(function () { try { localStorage.removeItem("letschat-africa:session"); } catch (e) {} window.location.reload(); })
        .catch(function (e) { toast("Delete failed: " + e.message, 4000); });
    }
  };

  // 5. keep Letschat running: stay alive in the background, do not close by accident, start together with the browser / computer
  // 5a. hold a Web Lock for as long as the app is open: browsers do not freeze or discard a page that holds one (best effort, the phone can still stop apps to save battery)
  try { if (navigator.locks && navigator.locks.request) navigator.locks.request("letschat-keepalive", function () { return new Promise(function () {}); }).catch(function () {}); } catch (e) {}
  // 5b. installed app: pressing Back at the very first screen no longer closes it by mistake; press Back twice within 2.5 s to leave
  if (standalone()) {
    try {
      history.pushState({ lcRoot: 1 }, "");
      var lastBack = 0;
      window.addEventListener("popstate", function (e) {
        var st = e.state || history.state;
        if (st && (st.lcRoot || st.lcBack)) return; // the app's own screens / panels
        if (Date.now() - lastBack < 2500) { lastBack = 0; history.back(); return; } // second quick press: really leave
        lastBack = Date.now();
        try { history.pushState({ lcRoot: 1 }, ""); } catch (x) {}
        toast("Press back again to exit", 2200);
      });
    } catch (e) {}
  }
  // 5c. help cards: start the app with the computer (installed desktop app only)
  function isDesktop() { return !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) && !(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function infoCard(id, title, lines, buttons) {
    if (document.getElementById(id) || document.getElementById("lc-perm-card")) return;
    var card = el("div", "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:100001;max-width:460px;margin:0 auto;background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 12px 40px rgba(0,0,0,.55)");
    card.id = id; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", title);
    card.appendChild(el("div", "font:700 16px Sora,Inter,sans-serif;margin-bottom:6px", title));
    lines.forEach(function (t) { card.appendChild(el("div", "font-size:13.5px;line-height:1.45;color:#C5CEDA;margin-bottom:6px", t)); });
    var row = el("div", "display:flex;gap:8px;margin-top:10px");
    buttons.forEach(function (b) {
      var n = el("button", "flex:1;border:0;border-radius:20px;padding:11px 0;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;background:" + (b.primary ? "#35D0BA" : "#262E3A") + ";color:" + (b.primary ? "#0E1116" : "#F5F7FA"), b.label);
      n.onclick = function () { card.remove(); try { b.fn && b.fn(); } catch (e) {} };
      row.appendChild(n);
    });
    card.appendChild(row); document.body.appendChild(card);
  }
  function snoozed(k) { var u = parseInt(ls(k) || "0", 10); return u && Date.now() < u; }
  function snooze(k, days) { lsSet(k, String(Date.now() + days * 86400000)); }
  function keepRunningHelp() {
    if (!session()) return;
    // The automatic "Install Letschat" web (PWA) card is switched off: people are no longer prompted to install the web app.
    // On Android the real app file comes from the "Letschat for Android" bar at the top of the page.
    if (!standalone()) return;
    // installed on a computer (Chrome / Edge): the person turns on "start when I sign in" once
    if (isDesktop() && !ls("lc-ka-autostart") && !snoozed("lc-ka-autostart-later") && /chrome|edg/i.test(navigator.userAgent)) {
      infoCard("lc-ka-card", "Start Letschat with your computer", ["Open about://apps in the browser, right-click Letschat and choose \u201cStart app when you sign in\u201d. Letschat then opens by itself every time you sign in to your computer."],
        [{ label: "Later", fn: function () { snooze("lc-ka-autostart-later", 7); } }, { label: "Done", primary: true, fn: function () { lsSet("lc-ka-autostart", "1"); } }]);
    }
  }
  var kaTries = 0, kaPoll = setInterval(function () {
    if (++kaTries > 80) return clearInterval(kaPoll);
    if (!session() || document.hidden || kaTries < 8) return; // wait until signed in and the permission card had its turn
    if (document.getElementById("lc-perm-card")) return;
    clearInterval(kaPoll); keepRunningHelp();
  }, 4000);
  window.LetschatKeepAlive = { help: keepRunningHelp };

  // 5d. install on Android and iPhone: one-tap install where the browser allows it, clear steps everywhere else
  function inAppBrowser() { return /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|MicroMessenger|; wv\)|WhatsApp/i.test(navigator.userAgent); }
  // which browser is this? (used to show the exact install steps for it)
  function browserKind() {
    var ua = navigator.userAgent;
    if (/Opera Mini/i.test(ua)) return "operamini";
    if (/OPR\/|OPT\/|Opera/i.test(ua)) return "opera";
    if (/SamsungBrowser/i.test(ua)) return "samsung";
    if (/Firefox|FxiOS/i.test(ua)) return "firefox";
    if (/EdgA|EdgiOS|Edg\//i.test(ua)) return "edge";
    if (/CriOS|Chrome|Chromium/i.test(ua)) return "chrome";
    return "safari";
  }
  function installGuide() {
    var steps, b = browserKind(), android = /android/i.test(navigator.userAgent);
    if (inAppBrowser()) steps = ["This page is open inside another app. Tap the three dots (or the Share icon), choose Open in browser (Chrome on Android, Safari on iPhone), then tap Install again."];
    else if (isIOS()) {
      steps = b === "safari"
        ? ["1. Tap the Share button (the square with an arrow, at the bottom or top of the screen).", "2. Scroll down and tap Add to Home Screen.", "3. Tap Add. Letschat now opens like a normal app."]
        : ["1. Tap the Share button (the square with an arrow) in the address bar, or open the \u22EF menu and choose Share.", "2. Tap Add to Home Screen, then Add. Letschat now opens like a normal app.", "No Add to Home Screen option? Open this page in Safari and try again."];
      steps.push("iPhone and iPad do not use APK files: Add to Home Screen is the iPhone app.");
    } else if (android && b === "operamini") steps = ["Opera Mini saves data by not running full apps, so Letschat works best in Chrome, Firefox or the full Opera browser.", "Open this page in one of them and tap Install, or download the Letschat app file (APK) with the Download app button."];
    else if (android && b === "opera") steps = ["1. Tap the menu (three dots or the Opera icon).", "2. Tap Add to or Home screen, then Add.", "Or open this page in Chrome and tap Install."];
    else if (android && b === "firefox") steps = ["1. Tap the three dots menu in Firefox.", "2. Tap Install (or Add app to Home screen).", "3. Tap Add. Letschat now opens like a normal app."];
    else if (android && b === "samsung") steps = ["1. Tap the menu (three lines) in Samsung Internet.", "2. Tap Add page to, then Home screen (or Install).", "3. Tap Add."];
    else if (android) steps = ["1. Tap the three dots menu at the top right of Chrome.", "2. Tap Install app (or Add to Home screen).", "3. Tap Install. Letschat now opens like a normal app.", "Using another browser? Open this page in Chrome and try again."];
    else if (b === "safari") steps = ["In Safari on a Mac, choose File, then Add to Dock. Letschat then opens like a normal app."];
    else if (b === "firefox") steps = ["Firefox on a computer cannot install web apps. Open Letschat in Chrome or Edge and use the install icon at the right end of the address bar, or keep it open in a pinned tab."];
    else steps = ["Click the install icon at the right end of the address bar, or open the browser menu and choose Install Letschat."];
    infoCard("lc-install-guide", "Install Letschat", steps, [{ label: "Done", primary: true }]);
  }
  // Install check for phones without developer tools: open the site with ?installdebug=1 at the end of the address and wait 6 seconds.
  // It says whether Chrome fired its one-tap install event and, if not, which requirement is missing.
  if (/[?&]installdebug=1/.test(location.search)) setTimeout(function () {
    var out = [], pend = [];
    out.push(window.__lcInstall ? "Chrome install event: READY (one-tap install works)" : "Chrome install event: NOT fired");
    out.push(standalone() ? "Running as the installed app (Chrome does not offer install here)." : "Running in the browser.");
    out.push(location.protocol === "https:" ? "HTTPS: ok" : "HTTPS: MISSING (install needs https)");
    out.push("serviceWorker.controller: " + (navigator.serviceWorker && navigator.serviceWorker.controller ? "ok" : "none yet (reload once)"));
    pend.push(fetch("./manifest.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (m) {
      out.push("manifest: ok (" + (m.name || "no name") + ", display " + m.display + ")");
      return Promise.all((m.icons || []).map(function (i) {
        var u = new URL(i.src, location.href).href;
        return fetch(u, { method: "HEAD", cache: "no-store" }).then(function (r) { out.push("icon " + i.sizes + (i.purpose ? " " + i.purpose : "") + ": " + (r.ok && /image/.test(r.headers.get("content-type") || "") ? "ok" : "BROKEN (" + r.status + ")")); }, function () { out.push("icon " + i.sizes + ": BROKEN"); });
      }));
    }, function () { out.push("manifest: BROKEN (cannot load manifest.json)"); }));
    Promise.all(pend).then(function () { infoCard("lc-install-debug", "Install check", out, [{ label: "Close", primary: true }]); });
  }, 6000);
  window.addEventListener("appinstalled", function () { toast("Letschat installed", 3000); });
  // Android app files (see ANDROID-APK.md and ANDROID-COMPATIBILITY.md). The right file depends on the Android version:
  //   Android 7 and newer (API 24+)  -> Letschat.apk         (native Capacitor 8 app)
  //   Android 5 and 6 (API 21-23)    -> Letschat-legacy.apk  (Trusted Web Activity build, minSdk 21)
  //   Android 4.4 and older          -> no APK, browser install only
  // Android 5 and 6 phones run a Chrome that predates the frozen "Android 10" user agent, so the version in it is the real one.
  // The download button only shows when the file really exists on the site.
  function androidMajor() { var m = /Android[ \/](\d+)/i.exec(navigator.userAgent); return m ? parseInt(m[1], 10) : 0; }
  function apkName() {
    var v = androidMajor();
    if (!v) return "Letschat.apk"; // version not shown in the user agent: assume a modern phone
    if (v < 5) return "";
    return v < 7 ? "Letschat-legacy.apk" : "Letschat.apk";
  }
  function apkAvailable() {
    var f = apkName();
    if (!f) return Promise.resolve(false);
    try {
      return fetch("./" + f, { method: "HEAD", cache: "no-store" }).then(function (r) {
        return r.ok && !/text\/html/i.test(r.headers.get("content-type") || "");
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  function downloadApk() {
    var f = apkName() || "Letschat.apk";
    var a = document.createElement("a"); a.href = "./" + f; a.download = f; a.style.display = "none";
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1500);
    toast("Downloading Letschat. Open the file when it finishes.", 6000);
  }
  function browserInstall() {
    var p = window.__lcInstall;
    if (p && p.prompt) {
      window.__lcInstall = null;
      try { p.prompt(); if (p.userChoice) p.userChoice.then(function (c) { if (c && c.outcome === "dismissed") snooze("lc-ka-install", 3); }, function () {}); return; } catch (e) {}
    }
    installGuide();
  }
  window.LetschatInstall = {
    installed: function () { return standalone(); },
    install: function () {
      if (standalone()) return toast("Letschat is already installed", 2500);
      // Android: only the real app file (Letschat.apk, or Letschat-legacy.apk on Android 5-6). The web (PWA) install is no longer offered here.
      if (/android/i.test(navigator.userAgent) && !inAppBrowser()) {
        return apkAvailable().then(function (ok) {
          if (!ok) return toast("The Android app file is not available yet. Please try again later.", 4500);
          infoCard("lc-install-guide", "Get the Letschat app for Android",
            ["Tap Download app, then open the file. If Android says installs are blocked, tap Settings, allow your browser to install apps, then come back and tap Download again.",
             "Android may warn that the app is from an unknown source. That is normal for apps outside Google Play: tap Install anyway."],
            [{ label: "Cancel" }, { label: "Download app", primary: true, fn: downloadApk }]);
        });
      }
      // Other devices (computer, iPhone): the browser's own install, only when the person taps Install
      browserInstall();
    }
  };

  // 5e. "Letschat for Android" bar at the top of the page (light blue strip, logo, Download button, X), like GitHub's "GitHub Mobile for Android" bar.
  // Android phones only, not inside the installed app, not inside other apps' browsers. X hides it for 7 days; Download opens the install prompt / APK card.
  function androidBar() {
    var ios = isIOS();
    if (!(/android/i.test(navigator.userAgent) || ios) || standalone() || inAppBrowser() || snoozed("lc-android-bar") || document.getElementById("lc-android-bar")) return;
    var bar = el("div", "position:fixed;top:0;left:0;right:0;height:52px;z-index:100000;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:0 10px 0 12px;background:#DDF4FF;border-bottom:1px solid #9BD0F5;color:#1F2328;font:500 15px Inter,Arial,sans-serif;");
    bar.id = "lc-android-bar";
    var logo = el("img", "width:26px;height:26px;border-radius:7px;flex:none;");
    logo.src = "icons/favicon-48.png?v=2"; logo.alt = "";
    var label = el("span", "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;", ios ? "Letschat for iPhone" : "Letschat for Android");
    var go = el("button", "flex:none;height:36px;padding:0 16px;border-radius:8px;border:1px solid #D0D7DE;background:#F6F8FA;color:#1F2328;font:600 15px Inter,Arial,sans-serif;cursor:pointer;", ios ? "Install" : "Download");
    var x = el("button", "flex:none;width:36px;height:36px;border:0;background:transparent;color:#0969DA;font:400 26px/1 Arial,sans-serif;cursor:pointer;", "\u00D7");
    x.setAttribute("aria-label", "Close");
    function hide() { bar.remove(); document.documentElement.style.removeProperty("--lc-bar"); }
    go.onclick = function () { hide(); snooze("lc-android-bar", 3); if (window.LetschatInstall) window.LetschatInstall.install(); };
    x.onclick = function () { hide(); snooze("lc-android-bar", 7); };
    bar.appendChild(logo); bar.appendChild(label); bar.appendChild(go); bar.appendChild(x);
    // push the app down so the bar does not cover its header
    if (!document.getElementById("lc-bar-style")) {
      var st = el("style"); st.id = "lc-bar-style";
      st.textContent = ".app-shell{top:var(--lc-bar,0px)!important;height:calc(100vh - var(--lc-bar,0px))!important;height:calc(100dvh - var(--lc-bar,0px))!important}";
      document.head.appendChild(st);
    }
    document.documentElement.style.setProperty("--lc-bar", "52px");
    document.body.appendChild(bar);
  }
  setTimeout(androidBar, 2500);

  // 4. keep the app running: if the app never finished starting, reload once (and again when the connection returns)
  function stuck() { var b = document.getElementById("boot"); return !!(b && document.body.contains(b)); }
  function heal() {
    if (!stuck() || !navigator.onLine) return;
    try { if (sessionStorage.getItem("lc-heal")) return; sessionStorage.setItem("lc-heal", "1"); } catch (e) {}
    window.location.reload();
  }
  setTimeout(heal, 25000);
  window.addEventListener("online", function () { setTimeout(heal, 1500); });
})();
