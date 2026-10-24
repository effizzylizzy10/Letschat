// Letschat on-device backups (plain JS, loads right after device.js).
// - Tools > "Back up to device" now keeps a copy INSIDE the app's own storage on this phone (IndexedDB) and also saves a file.
// - A backup is made automatically about once a day while the app is open, so a recent copy is always on the device. The newest 3 are kept.
// - Tools > "Restore from backup" lists the backups stored on this device (and still lets you choose a file).
// Backups are tied to the signed-in account and never leave the device unless the person saves the file elsewhere.
(function () {
  var API = (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.API_URL) || "";
  var DB_NAME = "letschat-backups", STORE = "backups", KEEP = 3, EVERY = 24 * 3600 * 1000, LAST = "lc-backup-last-auto";
  var running = false;

  function session() { try { return JSON.parse(localStorage.getItem("letschat-africa:session")) || null; } catch (e) { return null; } }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  var toastEl;
  function toast(msg, ms) {
    if (toastEl) toastEl.remove();
    toastEl = el("div", "position:fixed;left:0;right:0;margin:0 auto;width:max-content;max-width:90%;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:100001;background:#161B22;color:#F5F7FA;border:1px solid #262E3A;border-radius:20px;padding:10px 16px;font:500 14px Inter,system-ui,sans-serif", msg);
    document.body.appendChild(toastEl);
    var t = toastEl; setTimeout(function () { if (t.parentNode) t.remove(); }, ms || 2500);
  }
  function unwrap(j) { return j && j.data && typeof j.data === "object" ? j.data : (j || {}); } // the server wraps answers as { success, data }
  function api(path) {
    var s = session();
    return fetch(API + "/api/v1" + path, { headers: { Authorization: "Bearer " + (s && s.token) } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "Request failed"); return unwrap(j); }); });
  }

  // ---- IndexedDB: a tiny store of finished backups ----
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("This browser cannot store backups on the device"));
      var rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = function () { var d = rq.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" }); };
      rq.onsuccess = function () { resolve(rq.result); };
      rq.onerror = function () { reject(rq.error || new Error("Storage is not available")); };
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(STORE, mode), out = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : undefined); };
        t.onerror = t.onabort = function () { reject(t.error || new Error("Storage error")); };
      });
    });
  }
  function listAll() { return tx("readonly", function (st) { return st.getAll(); }).then(function (a) { return (a || []).sort(function (x, y) { return y.id - x.id; }); }); }
  function listMine() { var s = session(), uid = s && s.user && s.user.id; return listAll().then(function (a) { return a.filter(function (b) { return b.userId === uid; }); }); }
  function put(rec) { return tx("readwrite", function (st) { return st.put(rec); }); }
  function del(id) { return tx("readwrite", function (st) { return st.delete(id); }); }
  function prune() { // keep the newest KEEP backups of the signed-in account
    return listMine().then(function (a) { return Promise.all(a.slice(KEEP).map(function (b) { return del(b.id); })); }).catch(function () {});
  }

  // ---- make a backup (a Blob holding the same JSON file format as before, so old and new files restore the same way) ----
  function build(progress) {
    var s = session();
    return api("/conversations").then(function (d) {
      var list = d.conversations || [], parts = ['{"app":"Letschat Africa","exportedAt":' + JSON.stringify(new Date().toISOString()) + ',"user":' + JSON.stringify({ id: s.user && s.user.id, name: s.user && s.user.name }) + ',"conversations":['];
      var total = 0, i = 0;
      function nextChat() {
        if (i >= list.length) { parts.push("]}"); return Promise.resolve({ blob: new Blob(parts, { type: "application/json" }), chats: list.length, messages: total }); }
        var c = list[i], msgs = [], before = null, guard = 0;
        function page() {
          return api("/conversations/" + c.id + "/messages?limit=500" + (before ? "&before=" + before : "")).then(function (r) {
            var p = r.messages || [];
            if (!p.length) return;
            msgs = p.concat(msgs); before = p[0].time;
            if (r.hasMore && guard++ < 200) return page();
          });
        }
        return page().then(function () {
          total += msgs.length;
          parts.push((i ? "," : "") + JSON.stringify({ id: c.id, name: c.name || (c.other && c.other.name) || "", isGroup: !!c.isGroup, messages: msgs }));
          i++; if (progress) progress(i, list.length);
          return nextChat();
        });
      }
      return nextChat();
    });
  }
  function saveRecord(res) {
    var s = session();
    var rec = { id: Date.now(), userId: s.user && s.user.id, at: new Date().toISOString(), chats: res.chats, messages: res.messages, size: res.blob.size, blob: res.blob };
    return put(rec).then(prune).then(function () { return rec; });
  }
  function saveFile(blob, at) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "letschat-backup-" + String(at || new Date().toISOString()).slice(0, 10) + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  }

  // manual: Tools > Back up to device
  function run() {
    var s = session();
    if (!s || !s.token) return toast("Sign in first");
    if (running) return;
    running = true; toast("Backing up...", 60000);
    return build(function (n, t) { toast("Backing up " + n + " of " + t, 60000); }).then(function (res) {
      return saveRecord(res).then(function (rec) {
        lsSet(LAST + ":" + (s.user && s.user.id), String(Date.now()));
        saveFile(res.blob, rec.at);
        toast("Backup saved on this device (" + res.chats + " chats, " + res.messages + " messages)", 4500);
      }, function () { // storage refused (private mode / full): the file copy still works
        saveFile(res.blob);
        toast("Backup file saved to your device", 4000);
      });
    }).catch(function (e) { toast("Backup failed: " + e.message, 4500); }).then(function () { running = false; });
  }

  // automatic: about once a day, quietly, only while the app is open and online
  function auto() {
    var s = session();
    if (!s || !s.token || running || document.hidden || navigator.onLine === false) return;
    var last = parseInt(ls(LAST + ":" + (s.user && s.user.id)) || "0", 10);
    if (last && Date.now() - last < EVERY) return;
    running = true;
    build().then(saveRecord).then(function (rec) {
      lsSet(LAST + ":" + (s.user && s.user.id), String(Date.now()));
      toast("Chats backed up on this device (" + rec.chats + " chats)", 3500);
    }).catch(function () { /* quiet: try again later */ }).then(function () { running = false; });
  }
  setTimeout(auto, 45000);
  setInterval(auto, 30 * 60 * 1000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) setTimeout(auto, 4000); });

  // ---- restore ----
  function restoreData(data) {
    var s = session();
    if (!data || data.app !== "Letschat Africa" || !Array.isArray(data.conversations)) return Promise.reject(new Error("Not a Letschat backup"));
    var restored = 0, skipped = 0, total = 0, done = 0, ci = 0;
    data.conversations.forEach(function (c) { total += (c.messages || []).length; });
    function chat() {
      if (ci >= data.conversations.length) return Promise.resolve();
      var c = data.conversations[ci++], all = c.messages || [], msgs = all.filter(function (m) { return m && m.senderId === s.user.id; });
      done += all.length - msgs.length; skipped += all.length - msgs.length;
      var batches = [], batch = [], size = 0;
      for (var j = 0; j < msgs.length; j++) {
        var len = JSON.stringify(msgs[j]).length;
        if (batch.length >= 300 || (batch.length && size + len >= 3000000)) { batches.push(batch); batch = []; size = 0; }
        batch.push(msgs[j]); size += len;
      }
      if (batch.length) batches.push(batch);
      var bi = 0;
      function send() {
        if (bi >= batches.length) return Promise.resolve();
        var b = batches[bi++];
        return fetch(API + "/api/v1/me/restore", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token }, body: JSON.stringify({ conversations: [{ id: c.id, isGroup: !!c.isGroup, messages: b }] }) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (out) {
            if (!r.ok) throw new Error((out.error && (out.error.message || out.error)) || "Restore failed");
            var o = unwrap(out);
            restored += o.restored || 0; skipped += o.skipped || 0; done += b.length;
            toast("Restoring " + Math.min(done, total) + " of " + total, 120000);
            return send();
          }); });
      }
      return send().then(chat);
    }
    return chat().then(function () { return { restored: restored, skipped: skipped }; });
  }
  function restoreFrom(blobOrFile) {
    var s = session();
    if (!s || !s.token) return toast("Sign in first");
    if (running) return;
    running = true; toast("Restoring...", 120000);
    new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(new Error("Could not read the backup")); }; fr.readAsText(blobOrFile); })
      .then(function (txt) { return restoreData(JSON.parse(txt)); })
      .then(function (r) { toast("Restored " + r.restored + " message" + (r.restored === 1 ? "" : "s") + (r.skipped ? " (" + r.skipped + " skipped)" : "") + ". Reopen your chats to see them.", 6000); })
      .catch(function (e) { toast("Restore failed: " + e.message, 4500); })
      .then(function () { running = false; });
  }
  function pickFile() {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,application/json"; inp.style.display = "none";
    inp.onchange = function () { var f = inp.files && inp.files[0]; inp.remove(); if (f) restoreFrom(f); };
    document.body.appendChild(inp); inp.click();
  }
  function when(iso) { try { return new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return String(iso).slice(0, 16).replace("T", " "); } }
  function mb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

  // the restore card: backups stored on this device first, then "Choose a file"
  function restore() {
    var s = session();
    if (!s || !s.token) return toast("Sign in first");
    if (document.getElementById("lc-restore-card")) return;
    var card = el("div", "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:100001;max-width:460px;margin:0 auto;max-height:70vh;overflow:auto;background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 12px 40px rgba(0,0,0,.55)");
    card.id = "lc-restore-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Restore from backup");
    function btn(label, primary, fn, extra) {
      var b = el("button", "border:0;border-radius:20px;padding:9px 14px;font:600 13.5px Inter,system-ui,sans-serif;cursor:pointer;background:" + (primary ? "#35D0BA" : "#262E3A") + ";color:" + (primary ? "#0E1116" : "#F5F7FA") + (extra || ""), label);
      b.onclick = fn; return b;
    }
    function render(items, note) {
      card.textContent = "";
      card.appendChild(el("div", "font:700 16px Sora,Inter,sans-serif;margin-bottom:4px", "Restore from backup"));
      card.appendChild(el("div", "font-size:13px;color:#8891A0;margin-bottom:10px", note || (items.length ? "Backups saved on this device:" : "No backups on this device yet. Tap Back up to device in Tools, or choose a backup file.")));
      items.forEach(function (b) {
        var row = el("div", "display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid #1E2530");
        var info = el("div", "flex:1;min-width:0");
        info.appendChild(el("div", "font-weight:600;font-size:14px", when(b.at)));
        info.appendChild(el("div", "font-size:12px;color:#8891A0", b.chats + " chats · " + b.messages + " messages · " + mb(b.size)));
        row.appendChild(info);
        row.appendChild(btn("Restore", true, function () { card.remove(); restoreFrom(b.blob); }));
        row.appendChild(btn("File", false, function () { saveFile(b.blob, b.at); }));
        row.appendChild(btn("×", false, function () { del(b.id).then(function () { return listMine(); }).then(function (a) { render(a); }, function () {}); }, ";padding:9px 11px"));
        card.appendChild(row);
      });
      var foot = el("div", "display:flex;gap:8px;margin-top:12px");
      var f1 = btn("Choose a file…", false, function () { card.remove(); pickFile(); }); f1.style.flex = "1";
      var f2 = btn("Close", true, function () { card.remove(); }); f2.style.flex = "1";
      foot.appendChild(f1); foot.appendChild(f2); card.appendChild(foot);
    }
    document.body.appendChild(card);
    listMine().then(function (a) { render(a); }, function () { render([], "Backups on this device are not available in this browser. You can still choose a backup file."); });
  }

  // replace the older file-only versions from device.js (same names, so the Tools buttons just work)
  window.LetschatBackup = { run: run, restore: restore, auto: auto, list: listMine };
})();
