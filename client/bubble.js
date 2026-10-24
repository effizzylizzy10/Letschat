// Letschat chat bubble (plain JS, loads after device.js). Android app only.
// A small floating Letschat bubble shows over other apps when you leave Letschat (like a chat head). Tap it to come back, drag it to move it,
// drop it at the bottom of the screen to turn it off. It shows how many unread messages there were the last time the app looked.
// The bubble itself is drawn by the native app (see native/android-src); this file asks for the permission and adds the Tools switch.
(function () {
  var API = (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.API_URL) || "";
  var PREF = "lc-bubble-asked";
  function plug() { var c = window.Capacitor; return c && c.Plugins && c.Plugins.LetschatNative ? c.Plugins.LetschatNative : null; }
  if (!plug()) return; // normal browsers and the old APK have no native part: nothing to do

  function session() { try { return JSON.parse(localStorage.getItem("letschat-africa:session")) || null; } catch (e) { return null; } }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  var toastEl;
  function toast(msg, ms) {
    if (toastEl) toastEl.remove();
    toastEl = el("div", "position:fixed;left:0;right:0;margin:0 auto;width:max-content;max-width:90%;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:100001;background:#161B22;color:#F5F7FA;border:1px solid #262E3A;border-radius:20px;padding:10px 16px;font:500 14px Inter,system-ui,sans-serif", msg);
    document.body.appendChild(toastEl);
    var t = toastEl; setTimeout(function () { if (t.parentNode) t.remove(); }, ms || 3000);
  }
  function card(id, title, lines, buttons) {
    if (document.getElementById(id)) return;
    var c = el("div", "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:100001;max-width:460px;margin:0 auto;background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 12px 40px rgba(0,0,0,.55)");
    c.id = id; c.setAttribute("role", "dialog"); c.setAttribute("aria-label", title);
    c.appendChild(el("div", "font:700 16px Sora,Inter,sans-serif;margin-bottom:6px", title));
    lines.forEach(function (t) { c.appendChild(el("div", "font-size:13.5px;line-height:1.45;color:#C5CEDA;margin-bottom:6px", t)); });
    var row = el("div", "display:flex;gap:8px;margin-top:10px");
    buttons.forEach(function (b) {
      var n = el("button", "flex:1;border:0;border-radius:20px;padding:11px 0;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;background:" + (b.primary ? "#35D0BA" : "#262E3A") + ";color:" + (b.primary ? "#0E1116" : "#F5F7FA"), b.label);
      n.onclick = function () { c.remove(); try { b.fn && b.fn(); } catch (e) {} };
      row.appendChild(n);
    });
    c.appendChild(row); document.body.appendChild(c);
  }

  // ---- state ----
  function status() { return plug().bubbleStatus().then(function (s) { return { overlay: !!(s && s.overlay), enabled: !!(s && s.enabled) }; }, function () { return { overlay: false, enabled: false }; }); }
  function turnOn() {
    return plug().setBubble({ enabled: true }).then(function () { toast("Chat bubble is on. It shows when you leave Letschat.", 4000); pushUnread(); refreshRow(); });
  }
  function turnOff() {
    return plug().setBubble({ enabled: false }).then(function () { toast("Chat bubble is off", 2500); refreshRow(); });
  }
  // waits (up to 3 minutes) for the person to allow "Display over other apps" in the phone settings, then switches the bubble on
  function waitForPermission() {
    var n = 0, t = setInterval(function () {
      if (++n > 90) return clearInterval(t);
      status().then(function (s) { if (s.overlay) { clearInterval(t); turnOn(); } });
    }, 2000);
  }
  function enable() {
    return status().then(function (s) {
      if (s.overlay) return turnOn();
      card("lc-bubble-perm", "Allow the chat bubble",
        ["Android needs your OK to show the bubble over other apps. Tap Open settings, switch on “Allow display over other apps” for Letschat, then come back."],
        [{ label: "Not now" }, { label: "Open settings", primary: true, fn: function () { plug().requestOverlay().then(waitForPermission, function () { toast("Could not open settings. Open Settings > Apps > Letschat > Display over other apps.", 5000); }); } }]);
    });
  }

  // ---- unread count for the bubble badge ----
  function unwrap(j) { return j && j.data && typeof j.data === "object" ? j.data : (j || {}); }
  function pushUnread() {
    var s = session();
    if (!s || !s.token) return;
    fetch(API + "/api/v1/conversations", { headers: { Authorization: "Bearer " + s.token } })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) {
        var list = unwrap(j).conversations || [], n = 0;
        for (var i = 0; i < list.length; i++) n += list[i].unread > 0 ? list[i].unread : 0;
        return plug().setUnread({ count: n });
      }).catch(function () {});
  }
  setInterval(function () { if (!document.hidden) pushUnread(); }, 25000);
  // coming back: refresh; leaving: the native side starts the bubble with the last count, and this updates it if the page is still running
  document.addEventListener("visibilitychange", function () { setTimeout(pushUnread, document.hidden ? 0 : 2000); });

  // ---- Tools > "Chat bubble" switch (added under "Restore from backup" when the Tools screen is open) ----
  var rowOn = false;
  function findTitle(text) {
    var nodes = document.querySelectorAll("div");
    for (var i = 0; i < nodes.length; i++) if (nodes[i].children.length === 0 && nodes[i].textContent === text) return nodes[i];
    return null;
  }
  function refreshRow() {
    var row = document.querySelector("[data-lc-bubble-row]");
    if (!row) return;
    status().then(function (s) {
      rowOn = s.enabled && s.overlay;
      var d = row.querySelectorAll("div"), sub = d[d.length - 1];
      if (sub) sub.textContent = rowOn ? "On · floats over other apps when you leave Letschat" : "Off · tap to show a floating bubble over other apps";
    });
  }
  function addRow() {
    if (document.querySelector("[data-lc-bubble-row]")) return;
    var title = findTitle("Restore from backup");
    if (!title || !title.parentElement || !title.parentElement.parentElement) return;
    var src = title.parentElement.parentElement;
    if (!src.parentElement) return;
    var row = src.cloneNode(true);
    row.setAttribute("data-lc-bubble-row", "1");
    row.removeAttribute("aria-hidden");
    var d = row.querySelectorAll("div"), hasTitle = null;
    for (var i = 0; i < d.length; i++) if (d[i].children.length === 0 && d[i].textContent === "Restore from backup") hasTitle = d[i];
    if (!hasTitle) return;
    hasTitle.textContent = "Chat bubble";
    row.onclick = function () { status().then(function (s) { if (s.enabled && s.overlay) turnOff(); else enable(); }); };
    src.parentElement.insertBefore(row, src.nextSibling);
    refreshRow();
  }
  var addTimer = null;
  function startWatching() {
    function later() { if (addTimer) return; addTimer = setTimeout(function () { addTimer = null; addRow(); }, 500); } // the page changes a lot: look at most twice a second
    try { new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); } catch (e) { setInterval(addRow, 1500); }
    addRow();
  }
  if (document.body) startWatching(); else document.addEventListener("DOMContentLoaded", startWatching);

  // ---- ask once, a little after sign-in (never at the same time as another card) ----
  var tries = 0, poll = setInterval(function () {
    if (++tries > 80) return clearInterval(poll);
    var s = session();
    if (!s || !s.token || document.hidden || tries < 12) return;
    if (document.getElementById("lc-perm-card") || document.getElementById("lc-contacts-card") || document.getElementById("lc-ka-card")) return;
    clearInterval(poll);
    var a = ls(PREF);
    if (a === "done" || (a && parseInt(a, 10) > Date.now())) return;
    status().then(function (st) {
      if (st.enabled) return;
      card("lc-bubble-card", "Chat bubble",
        ["Show a small Letschat bubble over other apps when you leave Letschat. Tap it to jump back to your chats, drag it where you like, or drop it at the bottom of the screen to remove it."],
        [{ label: "Not now", fn: function () { lsSet(PREF, String(Date.now() + 7 * 86400000)); } }, { label: "Turn on", primary: true, fn: function () { lsSet(PREF, "done"); enable(); } }]);
    });
  }, 4000);
  window.LetschatBubble = { enable: enable, disable: turnOff, status: status };
})();