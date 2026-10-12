// Letschat Creator: a simple tool that appears only when you are signed in as the creator.
(function () {
  var CFG = window.LETSCHAT_CONFIG || {}, API = CFG.API_URL || "", LOGO = "icons/icon-192.png";
  function session() { try { return JSON.parse(localStorage.getItem("letschat-africa:session")) || null; } catch (e) { return null; } }
  function call(path, method, body) {
    var s = session();
    return fetch(API + "/api/v1" + path, { method: method || "GET", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (s && s.token) }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "Something went wrong"); return j; }); });
  }
  function el(tag, css, text, attrs) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; for (var k in (attrs || {})) n.setAttribute(k, attrs[k]); return n; }
  var BG = "#0E1217", CARD = "#161B22", LINE = "#262E3A", TX = "#F5F7FA", MU = "#8A94A3", GREEN = "#1E8677", RED = "#FF6B6B";
  var fab, panel;
  function btn(label, color, fn) { var b = el("button", "background:" + color + ";color:#fff;border:0;border-radius:18px;padding:8px 14px;font:600 13px Inter,system-ui,sans-serif;cursor:pointer", label); b.onclick = fn; return b; }
  function field(multi, ph) { var f = el(multi ? "textarea" : "input", "width:100%;box-sizing:border-box;background:" + CARD + ";border:1px solid " + LINE + ";border-radius:12px;padding:11px 14px;color:" + TX + ";font:15px Inter,system-ui,sans-serif;outline:none;margin-bottom:8px;" + (multi ? "min-height:120px;resize:vertical" : "")); f.placeholder = ph || ""; return f; }

  function open() {
    if (panel) return;
    panel = el("div", "position:fixed;inset:0;z-index:99999;background:" + BG + ";color:" + TX + ";font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0);padding-bottom:env(safe-area-inset-bottom,0)");
    var head = el("div", "display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid " + LINE);
    var img = el("img", "width:34px;height:34px;border-radius:9px", null, { src: LOGO, alt: "Letschat" });
    var t = el("div", "flex:1"); t.appendChild(el("div", "font:700 17px Sora,Inter,sans-serif", "Letschat Creator")); t.appendChild(el("div", "font-size:12px;color:" + MU, "Signed in as letschatafrica"));
    var x = btn("Close", LINE, close);
    head.append(img, t, x);
    var tabs = el("div", "display:flex;gap:8px;padding:10px 16px 0"), body = el("div", "flex:1;overflow:auto;padding:12px 16px");
    var views = { Broadcast: broadcast, Members: members, Rules: rules }, tabBtns = {};
    Object.keys(views).forEach(function (k) {
      var b = el("button", "flex:1;padding:9px;border-radius:12px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;border:1px solid " + LINE, k);
      b.onclick = function () { Object.keys(tabBtns).forEach(function (n) { tabBtns[n].style.background = n === k ? GREEN : CARD; tabBtns[n].style.color = TX; }); body.textContent = ""; views[k](body); };
      tabBtns[k] = b; tabs.appendChild(b);
    });
    panel.append(head, tabs, body); document.body.appendChild(panel); tabBtns.Broadcast.onclick();
  }
  function close() { if (panel) { panel.remove(); panel = null; } }
  function note(host) { var n = el("div", "font-size:13px;margin:8px 0;min-height:18px"); host.appendChild(n); return function (m, bad) { n.textContent = m; n.style.color = bad ? RED : "#7BD8B5"; }; }

  function broadcast(host) {
    host.appendChild(el("p", "color:" + MU + ";font-size:13px;margin:0 0 10px", "Sends a message from you to every member's inbox, plus a notification. You can paste YouTube links here; only you are allowed to share them."));
    var f = field(true, "Write your broadcast message"), say = null;
    host.appendChild(f); say = note(host);
    host.appendChild(btn("Send to all members", GREEN, function () {
      if (!f.value.trim()) return say("Write a message first", true);
      if (!confirm("Send this to ALL members?")) return;
      say("Sending...");
      call("/creator/broadcast", "POST", { text: f.value.trim() }).then(function (d) { f.value = ""; say("Sent to " + d.sent + " member" + (d.sent === 1 ? "" : "s")); }).catch(function (e) { say(e.message, true); });
    }));
  }
  function members(host) {
    var q = field(false, "Search by name, phone or email"), list = el("div"), timer, say;
    host.appendChild(q); say = note(host); host.appendChild(list);
    function row(u) {
      var r = el("div", "display:flex;align-items:center;gap:10px;background:" + CARD + ";border:1px solid " + LINE + ";border-radius:14px;padding:10px 12px;margin-bottom:8px");
      var info = el("div", "flex:1;min-width:0"); info.appendChild(el("div", "font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", (u.name || "Member") + (u.suspended ? "  (blocked)" : "")));
      info.appendChild(el("div", "font-size:12px;color:" + MU, u.email || u.phone || ""));
      r.appendChild(info);
      if (!u.creator) r.appendChild(btn(u.suspended ? "Unblock" : "Block", u.suspended ? GREEN : RED, function () {
        if (!u.suspended && !confirm("Block " + u.name + "? They will be logged out and can't use Letschat until you unblock them.")) return;
        call("/creator/users/" + u.id + "/" + (u.suspended ? "unsuspend" : "suspend"), "POST").then(function (d) { u.suspended = d.user.suspended; r.replaceWith(row(u)); }).catch(function (e) { say(e.message, true); });
      }));
      return r;
    }
    function load() { call("/creator/users?q=" + encodeURIComponent(q.value)).then(function (d) { list.textContent = ""; (d.users || []).forEach(function (u) { list.appendChild(row(u)); }); if (!(d.users || []).length) list.textContent = "No members found"; }).catch(function (e) { say(e.message, true); }); }
    q.oninput = function () { clearTimeout(timer); timer = setTimeout(load, 300); }; load();
  }
  function rules(host) {
    host.appendChild(el("p", "color:" + MU + ";font-size:13px;margin:0 0 10px", "The rules and guidelines every member can read. Block members who break them from the Members tab."));
    var f = field(true, "Loading..."), say; f.style.minHeight = "220px"; host.appendChild(f); say = note(host);
    call("/rules").then(function (d) { f.value = d.rules; }).catch(function (e) { say(e.message, true); });
    host.appendChild(btn("Save rules", GREEN, function () { call("/creator/rules", "PUT", { rules: f.value }).then(function () { say("Rules saved"); }).catch(function (e) { say(e.message, true); }); }));
  }

  function sync() {
    var s = session(), isC = !!(s && s.token && s.user && s.user.creator);
    if (isC && !fab) {
      fab = el("button", "position:fixed;right:14px;bottom:calc(88px + env(safe-area-inset-bottom,0));z-index:9999;display:flex;align-items:center;gap:8px;background:" + CARD + ";color:" + TX + ";border:1px solid " + GREEN + ";border-radius:26px;padding:6px 14px 6px 6px;font:600 13px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.4)");
      fab.appendChild(el("img", "width:30px;height:30px;border-radius:50%", null, { src: LOGO, alt: "" })); fab.appendChild(document.createTextNode("Letschat Creator"));
      fab.onclick = open; document.body.appendChild(fab);
    } else if (!isC && fab) { fab.remove(); fab = null; close(); }
  }
  setInterval(sync, 2000); sync();
})();
