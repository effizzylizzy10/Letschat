// Letschat phonebook helper (plain JS, loads after device.js).
// 1. In the Android app: with the person's OK, reads the phonebook and checks which numbers are on Letschat (no need to pick contacts by hand).
//    In the browser the phonebook can only be opened through the contact picker, so the saved list is just re-checked quietly.
// 2. Chats search: contacts from the phonebook that are registered on Letschat show up under the search box, tap to chat.
// The phonebook list and the matches are kept on this device only (same storage the "From your phonebook" screen uses).
(function () {
  var API = (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.API_URL) || "";
  var KEY_BOOK = "letschat-africa:phonebook", KEY_MATCH = "letschat-africa:phonebookMatches";
  var CONSENT = "lc-contacts-auto", ASKED = "lc-contacts-asked", LASTSYNC = "lc-contacts-last";
  var EVERY = 6 * 3600 * 1000, MAX_BOOK = 5000, CHUNK = 200;
  var DIAL = { NG: "234", GH: "233", KE: "254", ZA: "27", DZ: "213", AO: "244", BJ: "229", BW: "267", BF: "226", BI: "257", CM: "237", CV: "238", CF: "236", TD: "235", KM: "269", CG: "242", CD: "243", CI: "225", DJ: "253", EG: "20", GQ: "240", ER: "291", SZ: "268", ET: "251", GA: "241", GM: "220", GN: "224", GW: "245", LS: "266", LR: "231", LY: "218", MG: "261", MW: "265", ML: "223", MR: "222", MU: "230", MA: "212", MZ: "258", NA: "264", NE: "227", RW: "250", ST: "239", SN: "221", SC: "248", SL: "232", SO: "252", SS: "211", SD: "249", TZ: "255", TG: "228", TN: "216", UG: "256", ZM: "260", ZW: "263", GB: "44", US: "1", CA: "1", AE: "971", FR: "33", DE: "49", IN: "91" };

  function session() { try { return JSON.parse(localStorage.getItem("letschat-africa:session")) || null; } catch (e) { return null; } }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function getJSON(k, f) { try { var r = localStorage.getItem(k); return r === null ? f : JSON.parse(r); } catch (e) { return f; } }
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  function native() { var c = window.Capacitor; return c && c.Plugins && c.Plugins.LetschatNative ? c.Plugins.LetschatNative : null; }
  function unwrap(j) { return j && j.data && typeof j.data === "object" ? j.data : (j || {}); }

  // same rules as the "From your phonebook" screen: everything becomes digits with the country code
  function toIntl(raw) {
    var t = String(raw || "").trim(), d = t.replace(/\D/g, "");
    if (t.charAt(0) === "+") return d;
    if (d.indexOf("00") === 0) return d.slice(2);
    var dial = DIAL[ls("lc-country") || "NG"] || "234";
    if (d.charAt(0) === "0") return dial + d.slice(1);
    if (d.indexOf(dial) === 0 && d.length >= dial.length + 8) return d;
    return dial + d;
  }

  // ---- ask the server which of these numbers are registered (in small groups) ----
  function matchPhones(phones) {
    var s = session(), found = {}, i = 0;
    if (!s || !s.token || !phones.length) return Promise.resolve(found);
    function next() {
      if (i >= phones.length) return Promise.resolve(found);
      var part = phones.slice(i, i + CHUNK); i += CHUNK;
      return fetch(API + "/api/v1/users/match", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token }, body: JSON.stringify({ phones: part }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error("match failed");
          var m = unwrap(j).matches || {};
          for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) found[k] = m[k];
          return next();
        }); });
    }
    return next();
  }
  function saveMatches(book, found) { // exactly the numbers in the list: registered ones keep their profile
    var out = {};
    book.forEach(function (e) { if (found[e.phone]) out[e.phone] = found[e.phone]; });
    try { localStorage.setItem(KEY_MATCH, JSON.stringify(out)); } catch (e) {}
    return out;
  }

  // ---- 1a. Android app: read the whole phonebook (with consent) ----
  function readNativeContacts() {
    var p = native();
    return p.getContacts().then(function (r) {
      var list = (r && r.contacts) || [], seen = {}, out = [];
      list.forEach(function (c) {
        var phone = toIntl(c.tel);
        if (phone.length < 8 || phone.length > 15 || seen[phone]) return;
        seen[phone] = 1; out.push({ name: c.name || "+" + phone, phone: phone });
      });
      return out.slice(0, MAX_BOOK);
    });
  }
  function syncNative(force) {
    var s = session();
    if (!native() || !s || !s.token || ls(CONSENT) !== "1") return Promise.resolve();
    var last = parseInt(ls(LASTSYNC) || "0", 10);
    if (!force && last && Date.now() - last < EVERY) return Promise.resolve();
    return readNativeContacts().then(function (fromPhone) {
      if (!fromPhone.length) return;
      var old = getJSON(KEY_BOOK, []), byPhone = {};
      old.forEach(function (e) { byPhone[e.phone] = e; });
      fromPhone.forEach(function (e) { byPhone[e.phone] = e; }); // names from the phone win
      var book = Object.keys(byPhone).map(function (k) { return byPhone[k]; }).slice(0, MAX_BOOK);
      try { localStorage.setItem(KEY_BOOK, JSON.stringify(book)); } catch (e) {}
      return matchPhones(book.map(function (e) { return e.phone; })).then(function (found) {
        saveMatches(book, found); lsSet(LASTSYNC, String(Date.now()));
      });
    }).catch(function () {});
  }
  // ---- 1b. browser: nothing can be read silently, so only re-check the list the person already saved ----
  function refreshSaved() {
    var s = session(), last = parseInt(ls(LASTSYNC) || "0", 10);
    if (!s || !s.token || native()) return Promise.resolve();
    if (last && Date.now() - last < EVERY) return Promise.resolve();
    var book = getJSON(KEY_BOOK, []);
    if (!book.length) return Promise.resolve();
    return matchPhones(book.map(function (e) { return e.phone; })).then(function (found) { saveMatches(book, found); lsSet(LASTSYNC, String(Date.now())); }).catch(function () {});
  }

  function consentCard() {
    if (document.getElementById("lc-contacts-card") || document.getElementById("lc-perm-card")) return;
    var card = el("div", "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:100001;max-width:460px;margin:0 auto;background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 12px 40px rgba(0,0,0,.55)");
    card.id = "lc-contacts-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Find friends from your phonebook");
    card.appendChild(el("div", "font:700 16px Sora,Inter,sans-serif;margin-bottom:6px", "Find friends from your phonebook"));
    card.appendChild(el("div", "font-size:13.5px;line-height:1.45;color:#C5CEDA;margin-bottom:6px", "Letschat can check your phonebook and show which of your contacts are already on Letschat Africa, at the top of the list. Your contacts' phone numbers are sent to our server only to find matches, and your list stays on this phone."));
    var row = el("div", "display:flex;gap:8px;margin-top:10px");
    function b(label, primary, fn) { var n = el("button", "flex:1;border:0;border-radius:20px;padding:11px 0;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;background:" + (primary ? "#35D0BA" : "#262E3A") + ";color:" + (primary ? "#0E1116" : "#F5F7FA"), label); n.onclick = function () { card.remove(); fn(); }; return n; }
    row.appendChild(b("Not now", false, function () { lsSet(ASKED, String(Date.now() + 7 * 86400000)); }));
    row.appendChild(b("Allow", true, function () { lsSet(CONSENT, "1"); lsSet(ASKED, "done"); syncNative(true); }));
    card.appendChild(row); document.body.appendChild(card);
  }
  function maybeAsk() {
    var a = ls(ASKED);
    if (!native() || ls(CONSENT) === "1" || a === "done" || (a && parseInt(a, 10) > Date.now())) return;
    consentCard();
  }

  // ---- 2. Chats search: registered phonebook contacts under the search box ----
  var SEARCH_PLACEHOLDER = "Search chats and groups", panel = null, boundInput = null;
  function hits(q) {
    var needle = q.trim().toLowerCase(), digits = q.replace(/\D/g, ""), m = getJSON(KEY_MATCH, {}), book = getJSON(KEY_BOOK, []), out = [];
    if (!needle) return out;
    for (var i = 0; i < book.length && out.length < 5; i++) {
      var e = book[i], u = m[e.phone];
      if (!u) continue; // only people who are registered
      var nick = String(u.username || u.nickname || ""), shown = String(e.name || u.name || "");
      if (shown.toLowerCase().indexOf(needle) >= 0 || String(u.name || "").toLowerCase().indexOf(needle) >= 0 || nick.toLowerCase().indexOf(needle.replace(/^@/, "")) >= 0 || (digits.length >= 3 && e.phone.indexOf(digits) >= 0)) out.push({ e: e, u: u });
    }
    return out;
  }
  function closePanel() { if (panel) { panel.remove(); panel = null; } }
  function openChat(h) {
    closePanel();
    // the app already knows how to open a chat from a nickname, email or phone number (same path as tapping an email in a chat)
    try { window.dispatchEvent(new CustomEvent("lc-open-email", { detail: { email: (h.u.username ? "@" + h.u.username : h.e.phone) } })); } catch (x) { return; }
    setTimeout(function () { var b = document.querySelector('button[aria-label="Close search"]'); if (b) b.click(); }, 200);
  }
  function renderPanel(input) {
    var list = hits(input.value || "");
    if (!list.length) return closePanel();
    var box = input.parentElement ? input.parentElement.getBoundingClientRect() : input.getBoundingClientRect();
    if (!panel) { panel = el("div", ""); panel.id = "lc-contact-hits"; document.body.appendChild(panel); }
    panel.style.cssText = "position:fixed;left:12px;right:12px;top:" + Math.round(box.bottom + 8) + "px;z-index:100000;max-width:460px;margin:0 auto;max-height:40vh;overflow:auto;background:#161B22;border:1px solid #262E3A;border-radius:14px;padding:6px 0;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 10px 30px rgba(0,0,0,.5)";
    panel.textContent = "";
    panel.appendChild(el("div", "font-size:11.5px;font-weight:600;color:#8A96A5;text-transform:uppercase;letter-spacing:.6px;padding:6px 14px 4px", "Contacts on Letschat"));
    list.forEach(function (h) {
      var row = el("div", "display:flex;align-items:center;gap:12px;padding:8px 14px;cursor:pointer");
      var av;
      if (h.u.avatar) { av = el("img", "width:38px;height:38px;border-radius:50%;object-fit:cover;flex:none"); av.src = h.u.avatar; av.alt = ""; }
      else av = el("div", "width:38px;height:38px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:" + (h.u.color || "#35D0BA") + ";color:#0E1116;font:700 14px Sora,Inter,sans-serif", h.u.initials || String(h.e.name || "?").charAt(0).toUpperCase());
      var info = el("div", "flex:1;min-width:0");
      info.appendChild(el("div", "font:600 15px Sora,Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis", h.e.name || h.u.name));
      info.appendChild(el("div", "font-size:12.5px;color:#8891A0", h.u.username ? "@" + h.u.username : "+" + h.e.phone));
      var go = el("span", "flex:none;border-radius:14px;padding:5px 12px;background:#262E3A;font:600 13px Inter,system-ui,sans-serif", "Chat");
      row.appendChild(av); row.appendChild(info); row.appendChild(go);
      row.onclick = function () { openChat(h); };
      panel.appendChild(row);
    });
  }
  function bind() {
    var input = document.querySelector('input[placeholder="' + SEARCH_PLACEHOLDER + '"]');
    if (!input) { if (boundInput) { boundInput = null; closePanel(); } return; }
    if (input === boundInput) return;
    boundInput = input;
    input.addEventListener("input", function () { renderPanel(input); });
  }
  function startWatching() {
    var t = null;
    try { new MutationObserver(function () { if (t) return; t = setTimeout(function () { t = null; bind(); }, 150); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { setInterval(bind, 1500); }
    bind();
  }

  window.LetschatContacts = { sync: function () { return syncNative(true); }, refresh: refreshSaved };
  if (document.body) startWatching(); else document.addEventListener("DOMContentLoaded", startWatching);
  // when signed in: ask once (Android app), then keep the match list fresh
  var tries = 0, poll = setInterval(function () {
    if (++tries > 60) return clearInterval(poll);
    var s = session();
    if (!s || !s.token || document.hidden) return;
    clearInterval(poll);
    setTimeout(function () { maybeAsk(); syncNative(false); refreshSaved(); }, 9000);
  }, 3000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && ls(CONSENT) === "1") syncNative(false); });
})();