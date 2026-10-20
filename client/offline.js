// Letschat Africa: offline layer (loaded before app.js; plain ES5 on purpose so old phones can parse it).
//
// 1. window.LCOffline  - a small device-side store (IndexedDB, falling back to memory) used to
//      * keep the last good answer of every read request (chat list, messages, status, market...) so the app opens and browses with no network
//      * keep the OUTBOX: messages written while offline (or on a very poor line) that must survive a reload / closed app
// 2. window.LCOutbox   - sends queued messages one by one, in order, whenever the live connection is up. Every message carries a
//      clientId, which the server uses to ignore a repeat, so a lost acknowledgement can never produce a double message.
// 3. A thin status pill ("Offline", "3 messages waiting to send") that sits above everything and never blocks a tap.
(function (w) {
  "use strict";
  if (w.LCOffline) return;
  var d = w.document;

  // ---------------------------------------------------------------- tiny helpers
  function fire(name, detail) {
    try {
      var ev;
      if (typeof w.CustomEvent === "function") ev = new w.CustomEvent(name, { detail: detail });
      else { ev = d.createEvent("CustomEvent"); ev.initCustomEvent(name, false, false, detail); }
      w.dispatchEvent(ev);
    } catch (e) {}
  }
  function noop() {}

  // ---------------------------------------------------------------- key/value store: IndexedDB first, memory as a safety net
  var DB_NAME = "letschat-offline", STORE = "kv";
  var mem = {};                 // used when IndexedDB is missing / blocked (private mode on some old browsers)
  var dbp = null;               // promise of the open database, or null when unavailable

  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      try {
        var idb = w.indexedDB;
        if (!idb) return resolve(null);
        var req = idb.open(DB_NAME, 1), settled = false;
        var timer = setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, 4000);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "k" });
        };
        req.onsuccess = function () { if (settled) { try { req.result.close(); } catch (e) {} return; } settled = true; clearTimeout(timer); resolve(req.result); };
        req.onerror = function () { if (!settled) { settled = true; clearTimeout(timer); resolve(null); } };
        req.onblocked = function () { if (!settled) { settled = true; clearTimeout(timer); resolve(null); } };
      } catch (e) { resolve(null); }
    });
    return dbp;
  }

  function kvGet(k) {
    return openDb().then(function (db) {
      if (!db) return mem[k] === undefined ? undefined : mem[k];
      return new Promise(function (resolve) {
        try {
          var r = db.transaction(STORE, "readonly").objectStore(STORE).get(k);
          r.onsuccess = function () { resolve(r.result ? r.result.v : undefined); };
          r.onerror = function () { resolve(undefined); };
        } catch (e) { resolve(undefined); }
      });
    });
  }
  function kvSet(k, v) {
    return openDb().then(function (db) {
      if (!db) { mem[k] = v; return true; }
      return new Promise(function (resolve) {
        try {
          var t = db.transaction(STORE, "readwrite");
          t.objectStore(STORE).put({ k: k, v: v, t: Date.now() });
          t.oncomplete = function () { resolve(true); };
          t.onerror = t.onabort = function () { mem[k] = v; resolve(false); }; // quota full: keep it in memory for this session at least
        } catch (e) { mem[k] = v; resolve(false); }
      });
    });
  }
  function kvDel(k) {
    return openDb().then(function (db) {
      if (!db) { delete mem[k]; return true; }
      return new Promise(function (resolve) {
        try {
          var t = db.transaction(STORE, "readwrite");
          t.objectStore(STORE).delete(k);
          t.oncomplete = function () { resolve(true); };
          t.onerror = t.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }
  // all rows whose key starts with prefix: [{k, v, t}]
  function kvRows(prefix) {
    return openDb().then(function (db) {
      if (!db) { var o = []; for (var k in mem) if (k.indexOf(prefix) === 0) o.push({ k: k, v: mem[k], t: 0 }); return o; }
      return new Promise(function (resolve) {
        var rows = [];
        try {
          var req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
          req.onsuccess = function () {
            var c = req.result;
            if (!c) return resolve(rows);
            if (c.key.indexOf(prefix) === 0) rows.push(c.value);
            c.continue();
          };
          req.onerror = function () { resolve(rows); };
        } catch (e) { resolve(rows); }
      });
    });
  }

  // ---------------------------------------------------------------- read cache (last good answer of GET requests)
  var MAX_ENTRIES = 300, MAX_BYTES = 6000000, writes = 0;

  // chat lists must never carry whole voice notes / big photos into the cache
  function slim(path, data) {
    try {
      if (!data || typeof data !== "object" || !/\/messages(\?|$)/.test(path) || !data.messages) return data;
      var out = {}, k;
      for (k in data) out[k] = data[k];
      out.messages = data.messages.map(function (m) {
        if (!m || (!m.audio && !(m.file && m.file.data))) return m;
        var c = {}, p;
        for (p in m) c[p] = m[p];
        if (typeof c.audio === "string" && c.audio.length > 0) { delete c.audio; c.hasAudio = true; }
        if (c.file && typeof c.file.data === "string" && c.file.data.length > 350000) c.file = { name: c.file.name, mime: c.file.mime, size: c.file.size };
        return c;
      });
      return out;
    } catch (e) { return data; }
  }

  function trim() {
    kvRows("c:").then(function (rows) {
      if (rows.length <= MAX_ENTRIES) return;
      rows.sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
      var extra = rows.slice(0, rows.length - MAX_ENTRIES), i;
      for (i = 0; i < extra.length; i++) kvDel(extra[i].k);
    });
  }

  var Cache = {
    get: function (key) {
      return kvGet("c:" + key).then(function (s) {
        if (typeof s !== "string") return null;
        try { return { v: JSON.parse(s) }; } catch (e) { return null; }
      }, function () { return null; });
    },
    set: function (key, value, path) {
      var s;
      try { s = JSON.stringify(slim(path || key, value)); } catch (e) { return Promise.resolve(false); }
      if (!s || s.length > MAX_BYTES) return Promise.resolve(false);
      if (++writes % 15 === 0) setTimeout(trim, 1500);
      return kvSet("c:" + key, s);
    },
    // wipe everything that belongs to the signed-in person (sign out)
    clearAll: function () {
      return kvRows("c:").then(function (rows) { return Promise.all(rows.map(function (r) { return kvDel(r.k); })); })
        .then(function () { return kvRows("ob:"); })
        .then(function (rows) { Outbox.items = []; return Promise.all(rows.map(function (r) { return kvDel(r.k); })); })
        .then(function () { Outbox.changed(); });
    }
  };

  // ---------------------------------------------------------------- outbox
  var Outbox = {
    items: [],        // oldest first: { id, conversationId, payload, time, failed, error, preview, rid, snap }
    socket: null,
    uid: "",          // the signed-in person: a queued message is only ever sent by the account that wrote it
    ready: null,
    busy: false,
    cur: null,
    fails: 0,
    timer: 0,

    init: function () {
      if (Outbox.ready) return Outbox.ready;
      Outbox.ready = kvRows("ob:").then(function (rows) {
        var seen = {}, i;
        for (i = 0; i < Outbox.items.length; i++) seen[Outbox.items[i].id] = 1;
        var loaded = [];
        for (i = 0; i < rows.length; i++) { var it = rows[i].v; if (it && it.id && !seen[it.id]) loaded.push(it); }
        Outbox.items = Outbox.items.concat(loaded).sort(function (a, b) { return a.time - b.time; });
        Outbox.changed();
      }, noop);
      return Outbox.ready;
    },
    changed: function () { fire("lc:outbox", { kind: "count", count: Outbox.pendingCount() }); Pill.update(); },
    pendingCount: function () { var n = 0, i; for (i = 0; i < Outbox.items.length; i++) if (!Outbox.items[i].failed && Outbox.mine(Outbox.items[i])) n++; return n; },
    forConversation: function (cid) { return Outbox.items.filter(function (x) { return x.conversationId === cid && Outbox.mine(x); }); },

    // item: { id, conversationId, payload, preview, rid, snap }. payload is exactly what "message:send" takes (clientId is added here).
    enqueue: function (item) {
      item.time = item.time || Date.now();
      item.uid = Outbox.uid;
      item.payload.clientId = item.id;
      Outbox.items.push(item);
      kvSet("ob:" + item.id, item);
      Outbox.changed();
      Outbox.init().then(Outbox.flush);
    },
    remove: function (id) {
      var i;
      for (i = 0; i < Outbox.items.length; i++) if (Outbox.items[i].id === id) { Outbox.items.splice(i, 1); break; }
      kvDel("ob:" + id);
      Outbox.changed();
    },
    retry: function (id) {
      var i, it;
      for (i = 0; i < Outbox.items.length; i++) if (Outbox.items[i].id === id) it = Outbox.items[i];
      if (!it) return;
      it.failed = false; it.error = "";
      kvSet("ob:" + id, it);
      Outbox.fails = 0;
      Outbox.changed();
      Outbox.flush();
    },
    bind: function (socket, uid) {
      Outbox.socket = socket;
      Outbox.uid = uid || "";
      Outbox.init().then(function () {
        if (socket.connected) Outbox.flush();
        socket.on("connect", function () { Outbox.fails = 0; Outbox.flush(); });
        socket.on("disconnect", function () { if (Outbox.cur) Outbox.cur(null, true); Pill.update(); });
        socket.on("connect", Pill.update);
        socket.on("connect_error", Pill.update);
      });
    },
    mine: function (it) { return !it.uid || !Outbox.uid || it.uid === Outbox.uid; },
    nextPending: function () { var i; for (i = 0; i < Outbox.items.length; i++) if (!Outbox.items[i].failed && Outbox.mine(Outbox.items[i])) return Outbox.items[i]; return null; },
    later: function () {
      clearTimeout(Outbox.timer);
      var ms = Math.min(60000, 3000 * Math.pow(2, Math.min(Outbox.fails, 5)));
      Outbox.timer = setTimeout(Outbox.flush, ms);
    },
    flush: function () {
      var s = Outbox.socket;
      if (Outbox.busy || !s) return;
      if (!Outbox.ready) { Outbox.init().then(Outbox.flush); return; }
      var it = Outbox.nextPending();
      if (!it) return;
      if (!s.connected || (w.navigator && w.navigator.onLine === false)) return; // "connect" / "online" call flush again
      Outbox.busy = true;
      var p = it.payload, size = (p.file && p.file.data ? p.file.data.length : 0) + (typeof p.audio === "string" ? p.audio.length : 0);
      var wait = Math.min(180000, Math.max(15000, size / 3)), done = false, t;
      function finish(ack, timedOut) {
        if (done) return;
        done = true; clearTimeout(t); Outbox.busy = false; Outbox.cur = null;
        if (timedOut) { Outbox.fails++; Outbox.later(); return; } // still queued: the same clientId is sent again, the server drops a repeat
        Outbox.fails = 0;
        if (ack && ack.error) {
          it.failed = true; it.error = String(ack.error);
          kvSet("ob:" + it.id, it);
          fire("lc:outbox", { kind: "failed", id: it.id, conversationId: it.conversationId, error: it.error });
          Outbox.changed();
        } else {
          Outbox.remove(it.id);
          fire("lc:outbox", { kind: "sent", id: it.id, conversationId: it.conversationId, message: ack && ack.message });
        }
        setTimeout(Outbox.flush, 0);
      }
      Outbox.cur = finish;
      t = setTimeout(function () { finish(null, true); }, wait);
      try { s.emit("message:send", p, function (ack) { finish(ack || {}); }); }
      catch (e) { finish(null, true); }
    }
  };

  // ---------------------------------------------------------------- status pill
  var Pill = {
    el: null, tick: 0, downSince: 0,
    text: function () {
      var off = w.navigator && w.navigator.onLine === false, n = Outbox.pendingCount(), s = Outbox.socket;
      var waiting = n ? (n === 1 ? "1 message waiting to send" : n + " messages waiting to send") : "";
      if (off) return "Offline" + (waiting ? " · " + waiting : " · showing saved chats");
      if (s && !s.connected) {
        if (!Pill.downSince) Pill.downSince = Date.now();
        if (Date.now() - Pill.downSince > 6000) return "Weak connection · reconnecting" + (waiting ? " · " + waiting : "");
      } else Pill.downSince = 0;
      return waiting ? "Sending " + waiting.replace(" waiting to send", "") + "…" : "";
    },
    update: function () {
      if (!d.body) return;
      var msg = Pill.text();
      // the open chat shows its own "waiting for network" strip: do not say it twice
      if (msg && d.querySelector(".lc-strip")) msg = "";
      if (!msg) { if (Pill.el && Pill.el.parentNode) Pill.el.parentNode.removeChild(Pill.el); Pill.el = null; if (Pill.tick) { clearInterval(Pill.tick); Pill.tick = 0; } return; }
      if (!Pill.el) {
        var e = d.createElement("div");
        e.setAttribute("role", "status");
        e.style.cssText = "position:fixed;left:50%;top:calc(4px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:100000;max-width:92%;padding:4px 12px;border-radius:12px;background:rgba(42,33,16,.94);color:#F2B84B;font:12px/1.3 Inter,Arial,sans-serif;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
        d.body.appendChild(e);
        Pill.el = e;
      }
      if (Pill.el.textContent !== msg) Pill.el.textContent = msg;
      if (!Pill.tick) Pill.tick = setInterval(Pill.update, 2000); // re-check while visible (connection state, chat strip)
    }
  };
  w.addEventListener("online", function () { Pill.update(); Outbox.fails = 0; Outbox.flush(); });
  w.addEventListener("offline", Pill.update);
  w.addEventListener("focus", function () { Outbox.flush(); });
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", Pill.update); else Pill.update();

  // ask the browser not to throw the saved chats away when the phone is low on space (best effort, never prompts)
  try { if (w.navigator && w.navigator.storage && w.navigator.storage.persist) w.navigator.storage.persist(); } catch (e) {}

  w.LCOffline = Cache;
  w.LCOutbox = Outbox;
  Outbox.init();
})(window);
