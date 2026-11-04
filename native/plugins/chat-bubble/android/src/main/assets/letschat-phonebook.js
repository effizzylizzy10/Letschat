/* Letschat phonebook for the Android app. Injected by the Phonebook plugin into the Letschat website inside the app only.

   The website's "Find friends from my phonebook" reads contacts with the browser's Contact Picker (navigator.contacts.select). Android's
   WebView, which the app is built on, does not have it, so the button could never read a contact. This script adds the same calls
   (navigator.contacts.getProperties / select and window.ContactsManager), so the website itself does not change:
   1. Contacts permission: asked when the person taps the button (Android's own allow dialog).
   2. When Android will not show that dialog any more (refused for good), the phone's app settings are offered AT MOST ONCE A WEEK and never
      twice in one run of the app; every other tap only shows a short note. Refusing the dialog itself never triggers the settings question.
   3. The plugin reads the phonebook (names and phone numbers only) and a full-screen chooser shows it, with search. Only the contacts the
      person taps are handed to the website.
   4. Android's Back button closes the chooser. While it is open it uses one history entry that the page's own scripts never see (the popstate
      is swallowed), and the entry is given back BEFORE the page is told the result, so the page's own navigation is not disturbed.
   5. Cancel, Back and a refused permission all end with an empty list, like the browser's picker when it is dismissed. */
(function () {
  if (window.__lcPhonebook) return;
  if (!/(^|\.)(letschat-taupe\.vercel\.app|letschatafric\.netlify\.app)$/.test(location.hostname)) return;
  var C = window.Capacitor, nav = window.navigator;
  if (!C || !nav) return;
  if (nav.contacts && typeof nav.contacts.select === "function") return; // a browser that has the real picker

  // A handle for a native plugin (the page does not always have it on window.Capacitor.Plugins, see letschat-native-bridge.js).
  function plug(name) {
    var P = C.Plugins && C.Plugins[name];
    if (P) return P;
    if (typeof C.nativePromise !== "function" || typeof Proxy !== "function") return null;
    var cache = {};
    return new Proxy({}, {
      get: function (_, m) {
        if (typeof m !== "string" || m === "then") return undefined;
        if (!cache[m]) cache[m] = function (o) { return C.nativePromise(name, m, o || {}); };
        return cache[m];
      }
    });
  }
  var PB = plug("Phonebook");
  if (!PB) return;
  window.__lcPhonebook = true;

  function noop() {}
  var SETTINGS_KEY = "letschat-native:contacts-settings-asked";
  var settingsShownThisRun = false;
  var busy = false, active = null, swallow = 0, swallowDone = null;

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  // A short note at the bottom of the screen (3 seconds).
  function note(msg) {
    try {
      var n = el("div", "position:fixed;left:16px;right:16px;bottom:90px;z-index:2147483100;padding:12px 14px;border-radius:12px;background:#1d2733;color:#fff;font:14px/1.35 sans-serif;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.4);", msg);
      document.body.appendChild(n);
      setTimeout(function () { try { n.remove(); } catch (e) {} }, 3000);
    } catch (e) {}
  }

  // Android will not show its allow dialog any more: offer the app settings at most once a week, never twice in one run.
  function offerSettings() {
    var okToAsk = !settingsShownThisRun;
    try { if (okToAsk) okToAsk = Date.now() - (+localStorage.getItem(SETTINGS_KEY) || 0) > 7 * 864e5; } catch (e) { okToAsk = false; }
    if (!okToAsk) { note("Allow Contacts for Letschat in your phone's app settings to use this."); return; }
    settingsShownThisRun = true;
    try { localStorage.setItem(SETTINGS_KEY, String(Date.now())); } catch (e) {}
    if (window.confirm("Letschat needs permission to read your contacts. Open the app settings so you can switch it on?")) {
      var BB = plug("ChatBubble");
      if (BB && BB.openAppPermissionSettings) BB.openAppPermissionSettings().catch(noop);
    }
  }

  // Back button: the chooser owns one history entry. A popstate for it never reaches the page's own scripts.
  window.addEventListener("popstate", function (ev) {
    if (swallow > 0) {
      swallow--;
      ev.stopImmediatePropagation();
      var cb = swallowDone;
      swallowDone = null;
      if (cb) cb();
      return;
    }
    if (active) {
      ev.stopImmediatePropagation();
      active.back();
    }
  }, true);

  function chooser(list, multiple) {
    return new Promise(function (resolve) {
      var finished = false, pushed = false, selected = {}, count = 0;
      var BTN = "border:0;border-radius:10px;padding:9px 14px;font:600 15px sans-serif;background:#2B3544;color:#fff;";
      var root = el("div", "position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;display:flex;flex-direction:column;background:#0f1620;color:#fff;font:16px/1.3 sans-serif;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);");
      var bar = el("div", "display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2B3544;");
      var cancel = el("button", BTN, "Cancel");
      var title = el("div", "flex:1;text-align:center;font-weight:600;", multiple ? "Choose contacts" : "Choose a contact");
      var ok = multiple ? el("button", BTN + "background:#35D0BA;color:#06201c;", "Done") : el("div", "width:72px;");
      bar.appendChild(cancel); bar.appendChild(title); bar.appendChild(ok);
      var search = el("input", "margin:10px 12px;padding:11px 12px;border-radius:10px;border:1px solid #2B3544;background:#17202c;color:#fff;font:16px sans-serif;outline:none;");
      search.type = "search";
      search.placeholder = "Search name or number";
      var listEl = el("div", "flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;");
      root.appendChild(bar); root.appendChild(search); root.appendChild(listEl);

      function picked() {
        var out = [];
        for (var i = 0; i < list.length; i++) if (selected[i]) out.push(list[i]);
        return out;
      }
      function finish(result, entryGone) {
        if (finished) return;
        finished = true;
        active = null;
        try { root.remove(); } catch (e) {}
        if (entryGone || !pushed) { resolve(result); return; }
        // give the history entry back BEFORE the page is told the result
        var settled = false;
        function go() { if (settled) return; settled = true; resolve(result); }
        swallow++;
        swallowDone = go;
        try { history.back(); } catch (e) { swallow = Math.max(0, swallow - 1); swallowDone = null; go(); return; }
        setTimeout(function () {
          if (!settled) { swallow = Math.max(0, swallow - 1); swallowDone = null; go(); }
        }, 800);
      }

      function row(i) {
        var c = list[i];
        var r = el("div", "display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #1d2733;");
        var txt = el("div", "flex:1;min-width:0;");
        txt.appendChild(el("div", "font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;", c.name || c.tel[0]));
        var more = c.tel.length > 1 ? "  (+" + (c.tel.length - 1) + " more)" : "";
        txt.appendChild(el("div", "font-size:13px;color:#9aa7b8;", c.tel[0] + more));
        r.appendChild(txt);
        var mark = null;
        if (multiple) {
          mark = el("div", "width:24px;height:24px;border-radius:12px;border:2px solid #4a5a70;text-align:center;line-height:20px;font-weight:700;color:#06201c;", "");
          if (selected[i]) { mark.style.background = "#35D0BA"; mark.style.borderColor = "#35D0BA"; mark.textContent = "\u2713"; }
          r.appendChild(mark);
        }
        r.addEventListener("click", function () {
          if (!multiple) { finish([c], false); return; }
          if (selected[i]) { delete selected[i]; count--; } else { selected[i] = true; count++; }
          mark.style.background = selected[i] ? "#35D0BA" : "";
          mark.style.borderColor = selected[i] ? "#35D0BA" : "#4a5a70";
          mark.textContent = selected[i] ? "\u2713" : "";
          ok.textContent = count ? "Done (" + count + ")" : "Done";
        });
        return r;
      }

      var LIMIT = 300;
      function render() {
        var q = search.value.trim().toLowerCase(), qd = q.replace(/\D/g, "");
        listEl.textContent = "";
        var shown = 0, more = false;
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          if (q && c._n.indexOf(q) < 0 && !(qd && c._d.indexOf(qd) >= 0)) continue;
          if (shown >= LIMIT) { more = true; break; }
          listEl.appendChild(row(i));
          shown++;
        }
        if (!shown) listEl.appendChild(el("div", "padding:24px;text-align:center;color:#9aa7b8;", "No contacts found"));
        else if (more) listEl.appendChild(el("div", "padding:16px;text-align:center;color:#9aa7b8;font-size:13px;", "Keep typing to narrow the list"));
      }
      search.addEventListener("input", render);
      cancel.addEventListener("click", function () { finish([], false); });
      if (multiple) ok.addEventListener("click", function () { finish(picked(), false); });

      active = { back: function () { finish([], true); } }; // Back button: the entry is already gone
      try { history.pushState({ lcPhonebook: 1 }, ""); pushed = true; } catch (e) { pushed = false; }
      render();
      document.body.appendChild(root);
    });
  }

  function prepare(raw) {
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var c = raw[i];
      if (!c || !c.tel || !c.tel.length) continue;
      var name = String(c.name || "");
      var tel = [];
      for (var j = 0; j < c.tel.length; j++) tel.push(String(c.tel[j]));
      out.push({ name: name, tel: tel, _n: name.toLowerCase(), _d: tel.join(" ").replace(/\D/g, "") });
    }
    return out;
  }

  // Same shape as the browser's picker: only the properties that were asked for.
  function toPicker(c, props) {
    var o = {};
    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      if (p === "name") o.name = [c.name || c.tel[0]];
      else if (p === "tel") o.tel = c.tel.slice();
      else o[p] = [];
    }
    return o;
  }

  function select(props, opts) {
    if (!Array.isArray(props) || !props.length) return Promise.reject(new TypeError("At least one contact property must be requested."));
    if (busy || active) return Promise.reject(new Error("A contact picker is already open."));
    busy = true;
    var multiple = !!(opts && opts.multiple);
    return PB.readContacts().then(function (r) {
      if (!r || !r.granted) {
        if (r && r.blocked) offerSettings(); // only when Android shows no dialog any more
        return [];
      }
      var list = prepare(r.contacts || []);
      if (!list.length) { note("No contacts with a phone number were found."); return []; }
      return chooser(list, multiple).then(function (sel) {
        return sel.map(function (c) { return toPicker(c, props); });
      });
    }, function () {
      note("Could not read your contacts.");
      return [];
    }).then(function (v) { busy = false; return v; }, function () { busy = false; return []; });
  }

  function ContactsManager() {}
  ContactsManager.prototype.getProperties = function () { return Promise.resolve(["name", "tel"]); };
  ContactsManager.prototype.select = function (props, opts) { return select(props, opts); };
  var mgr = new ContactsManager();
  try {
    Object.defineProperty(nav, "contacts", { value: mgr, configurable: true });
  } catch (e) {
    try { nav.contacts = mgr; } catch (e2) {}
  }
  try { window.ContactsManager = ContactsManager; } catch (e) {}
})();
