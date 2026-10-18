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

  // 2. one-time access setup after the app is installed: storage, camera, microphone
  function askAccess() {
    return persist().then(function () {
      var md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) return;
      return md.getUserMedia({ audio: true, video: true })
        .catch(function () { return md.getUserMedia({ audio: true }); })
        .then(function (s) { s.getTracks().forEach(function (t) { t.stop(); }); })
        .catch(function () {});
    });
  }
  function showSetup() {
    var card = el("div", "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:100001;background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;animation:lcFadeUp .25s ease-out");
    card.appendChild(el("div", "font:700 16px Sora,Inter,sans-serif;margin-bottom:4px", "Allow access"));
    card.appendChild(el("div", "font-size:13px;color:#8891A0;margin-bottom:12px", "Camera, microphone and storage"));
    var row = el("div", "display:flex;gap:8px");
    function btn(label, bg, color, fn) { var b = el("button", "flex:1;border:0;border-radius:20px;padding:11px 0;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;background:" + bg + ";color:" + color, label); b.onclick = fn; return b; }
    function finish() { try { localStorage.setItem(ASKED, "1"); } catch (e) {} card.remove(); }
    row.appendChild(btn("Later", "#262E3A", "#F5F7FA", finish));
    row.appendChild(btn("Allow", "#35D0BA", "#0E1116", function () { askAccess().then(finish, finish); }));
    card.appendChild(row); document.body.appendChild(card);
  }
  window.addEventListener("appinstalled", function () { try { localStorage.removeItem(ASKED); } catch (e) {} });
  var tries = 0, poll = setInterval(function () {
    if (++tries > 60) return clearInterval(poll);
    var s = session();
    if (!standalone() || !s || !s.token || document.hidden) return;
    clearInterval(poll);
    try { if (localStorage.getItem(ASKED)) return; } catch (e) { return; }
    showSetup();
  }, 3000);

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
