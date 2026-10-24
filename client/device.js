// Letschat device features: keep data on the device, one-time access setup, chat backup, self-healing.
(function () {
  var API = (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.API_URL) || "";
  var ASKED = "lc-access-asked";
  function session() { try { return JSON.parse(localStorage.getItem("letschat-africa:session")) || null; } catch (e) { return null; } }
  function standalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
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
    return Promise.all([hasMedia ? queryPerm("camera") : "na", hasMedia ? queryPerm("microphone") : "na"]).then(function (r) {
      return { notifications: notif, camera: r[0], microphone: r[1] };
    });
  }
  var LABELS = {
    notifications: ["Notifications", "new messages and incoming calls"],
    camera: ["Camera", "video calls, photos and Go Live"],
    microphone: ["Microphone", "voice notes and calls"]
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
        return Notification.requestPermission().catch(function () {});
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
  // 5c. help cards: install the app (so it can run in the background) and start it with the computer
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
    if (!standalone()) {
      if (snoozed("lc-ka-install")) return;
      if (window.__lcInstall) {
        infoCard("lc-ka-card", "Install Letschat", ["Installed, Letschat opens like a normal app, keeps working in the background and keeps your message and call alerts coming."],
          [{ label: "Not now", fn: function () { snooze("lc-ka-install", 3); } },
           { label: "Install", primary: true, fn: function () { window.LetschatInstall.install(); } }]);
      } else if (isIOS()) {
        infoCard("lc-ka-card", "Install Letschat", ["Tap the Share button, then Add to Home Screen. The installed app runs in the background and gives you alerts."],
          [{ label: "Later", fn: function () { snooze("lc-ka-install", 7); } }, { label: "Got it", primary: true, fn: function () { snooze("lc-ka-install", 60); } }]);
      }
      return;
    }
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
  function installGuide() {
    var steps;
    if (inAppBrowser()) steps = ["This page is open inside another app. Tap the three dots (or the Share icon), choose Open in browser (Chrome on Android, Safari on iPhone), then tap Install again."];
    else if (isIOS()) steps = ["1. Tap the Share button (the square with an arrow, at the bottom or top of the screen).", "2. Scroll down and tap Add to Home Screen.", "3. Tap Add. Letschat now opens like a normal app.", "No Add to Home Screen option? Open this page in Safari and try again."];
    else if (/android/i.test(navigator.userAgent)) steps = ["1. Tap the three dots menu at the top right of Chrome.", "2. Tap Install app (or Add to Home screen).", "3. Tap Install. Letschat now opens like a normal app.", "Using another browser? Open this page in Chrome and try again."];
    else steps = ["Click the install icon at the right end of the address bar, or open the browser menu and choose Install Letschat."];
    infoCard("lc-install-guide", "Install Letschat", steps, [{ label: "Done", primary: true }]);
  }
  window.addEventListener("appinstalled", function () { toast("Letschat installed", 3000); });
  // Android app file: put Letschat.apk next to index.html (see ANDROID-APK.md). The download button only shows when the file really exists.
  function apkAvailable() {
    try {
      return fetch("./Letschat.apk", { method: "HEAD", cache: "no-store" }).then(function (r) {
        return r.ok && !/text\/html/i.test(r.headers.get("content-type") || "");
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  function downloadApk() {
    var a = document.createElement("a"); a.href = "./Letschat.apk"; a.download = "Letschat.apk"; a.style.display = "none";
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
      if (/android/i.test(navigator.userAgent) && !inAppBrowser()) {
        return apkAvailable().then(function (ok) {
          if (!ok) return browserInstall();
          infoCard("lc-install-guide", "Install Letschat for Android",
            ["Tap Download app, then open the file. If Android says installs are blocked, tap Settings, allow your browser to install apps, then come back and tap Download again.",
             "Android may warn that the app is from an unknown source. That is normal for apps outside Google Play: tap Install anyway."],
            [{ label: "Install from browser", fn: browserInstall }, { label: "Download app", primary: true, fn: downloadApk }]);
        });
      }
      browserInstall();
    }
  };

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
