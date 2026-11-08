/* Letschat: "Email link not opening?" helper (loaded by index.html).
 *
 * The problem: the sign-in email from Firebase points to https://<project>.firebaseapp.com/__/auth/action?...
 *   - Android 12 and newer opens that link in Chrome unless the Letschat app is verified for that website, and
 *   - some phones and networks cannot open firebaseapp.com at all (Chrome says "refused to connect", ERR_CONNECTION_REFUSED).
 * Signing in never needs that page: the app only needs the code that is inside the link.
 *
 * What this does: while the sign-in screen says "We sent a sign-in link to ...", a small button offers
 * "Email link not opening? Paste it here". The person copies the link from the email (press and hold the link, Copy link address),
 * pastes it, and Letschat opens its own address with the same code, ?apiKey=...&oobCode=...&mode=signIn&lang=en
 * (the same address client/index.html builds when the Android app receives the link). The app already finishes the sign-in by itself
 * for such an address (client/app.jsx, the "isSignInWithEmailLink" effect), using the email it saved when the link was requested.
 * Nothing here talks to Firebase or to any server.
 *
 * Plain ES5 on purpose (old phones). Every entry point is wrapped, so nothing in here can break the page.
 * If the wording of the "link sent" screen ever changes, update MARK below (app.jsx: subs.linksent); the button then just stays hidden.
 */
(function () {
  "use strict";
  if (window.__lcLinkHelp) return;
  window.__lcLinkHelp = true;

  var MARK = "We sent a sign-in link to";
  var pill = null, sheet = null, field = null, note = null;

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }

  function signedIn() {
    try { var s = JSON.parse(window.localStorage.getItem("letschat-africa:session")); return !!(s && s.token); } catch (e) { return false; }
  }

  function onLinkSentScreen() {
    var root = document.getElementById("root");
    return !!(root && (root.textContent || "").indexOf(MARK) !== -1);
  }

  // ---- reading the pasted link ----
  function pick(str, name) {
    var m = new RegExp("[?&#]" + name + "=([^&#\\s]*)").exec("?" + str);
    if (!m) return "";
    var v = m[1].replace(/\+/g, " ");
    try { v = decodeURIComponent(v); } catch (e) { }
    return v;
  }

  function parseOne(text) {
    var m = /https?:\/\/[^\s<>"']+/i.exec(text);
    var url = (m ? m[0] : text).replace(/^[\s<(\[]+|[\s>)\].,;]+$/g, "");
    // a link that carries the real link inside it (Firebase "links" addresses, some mail programs): open it up, at most 3 levels
    for (var i = 0; i < 3 && !/[?&#]oobCode=/.test("?" + url); i++) {
      var inner = pick(url, "link") || pick(url, "url") || pick(url, "q");
      if (!inner) break;
      url = inner;
    }
    var key = pick(url, "apiKey"), code = pick(url, "oobCode");
    var mode = pick(url, "mode") || "signIn", lang = pick(url, "lang") || "en";
    if (!key || !code) return null;
    if (mode !== "signIn" && mode !== "verifyEmail" && mode !== "resetPassword") return null; // the three kinds the app finishes by itself
    return { key: key, code: code, mode: mode, lang: lang };
  }

  function parseLink(text) {
    var s = String(text == null ? "" : text);
    return parseOne(s) || parseOne(s.replace(/\s+/g, "")); // second try: a link that a mail program split over several lines
  }

  function go(r) {
    var loc = window.location;
    var base = (loc.origin || (loc.protocol + "//" + loc.host)) + loc.pathname;
    loc.href = base + "?apiKey=" + encodeURIComponent(r.key) + "&oobCode=" + encodeURIComponent(r.code) +
      "&mode=" + encodeURIComponent(r.mode) + "&lang=" + encodeURIComponent(r.lang);
  }

  // ---- the little window ----
  function say(text, good) {
    if (!note) return;
    note.style.color = good ? "#35D0BA" : "#FF8A8A";
    note.textContent = text || "";
  }

  function submit(text) {
    var r = parseLink(text);
    if (!r) { say("That is not the sign-in link. Copy the whole link from the email and paste it here."); return; }
    say("Signing you in...", true);
    go(r);
  }

  function canRead() {
    try { return !!(navigator.clipboard && typeof navigator.clipboard.readText === "function"); } catch (e) { return false; }
  }

  function pasteFromClipboard() {
    var fail = function () { say("Could not read what you copied. Press and hold in the box, then choose Paste."); };
    try {
      navigator.clipboard.readText().then(function (t) {
        if (!field) return;
        if (parseLink(t)) { field.value = t; submit(t); }
        else say("Nothing to paste yet. Copy the sign-in link from your email first, then tap Paste.");
      }, fail);
    } catch (e) { fail(); }
  }

  function button(label, primary) {
    var b = el("button", "flex:1;min-width:0;padding:13px 10px;border-radius:12px;border:none;cursor:pointer;font:700 15px Sora,Inter,system-ui,sans-serif;" +
      (primary ? "background:#35D0BA;color:#0E1116" : "background:#1E2530;color:#F5F7FA"), label);
    b.type = "button";
    return b;
  }

  function closeSheet() {
    if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
    sheet = field = note = null;
    if (pill) pill.style.display = "";
  }

  function openSheet() {
    if (sheet) return;
    if (pill) pill.style.display = "none";
    sheet = el("div", "position:fixed;left:0;top:0;right:0;bottom:0;z-index:100002;background:rgba(0,0,0,.6);overflow-y:auto;-webkit-overflow-scrolling:touch");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Finish signing in with your email link");
    sheet.onclick = function (e) { if (e && e.target === sheet) closeSheet(); };

    var card = el("div", "box-sizing:border-box;max-width:460px;width:calc(100% - 24px);margin:16px auto;margin-top:calc(16px + env(safe-area-inset-top,0px));background:#161B22;border:1px solid #262E3A;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;color:#F5F7FA;box-shadow:0 12px 40px rgba(0,0,0,.55)");
    card.appendChild(el("div", "font:700 17px Sora,Inter,system-ui,sans-serif;margin:0 0 6px", "Finish signing in"));
    card.appendChild(el("div", "font-size:13px;line-height:1.55;color:#9BA7B4;margin:0 0 12px",
      "You do not have to open the link. Open your email, press and hold the sign-in link, choose 'Copy link address' (or 'Copy link'), then come back here and paste it below."));

    field = el("input", "display:block;width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid #262E3A;background:#0E1116;color:#F5F7FA;font:500 15px Inter,system-ui,sans-serif;outline:none;-webkit-appearance:none;-webkit-user-select:text;user-select:text");
    field.type = "text";
    field.placeholder = "Paste the link here";
    field.setAttribute("inputmode", "url");
    field.setAttribute("autocapitalize", "off");
    field.setAttribute("autocorrect", "off");
    field.setAttribute("autocomplete", "off");
    field.setAttribute("spellcheck", "false");
    field.setAttribute("aria-label", "Sign-in link from your email");
    field.onkeydown = function (e) { if (e && (e.key === "Enter" || e.keyCode === 13)) submit(field.value); };
    card.appendChild(field);

    note = el("div", "min-height:18px;font-size:13px;line-height:1.45;margin:10px 0 0;color:#FF8A8A");
    note.setAttribute("role", "status");
    card.appendChild(note);

    var row = el("div", "display:flex;gap:8px;margin-top:12px");
    if (canRead()) { var paste = button("Paste", false); paste.onclick = pasteFromClipboard; row.appendChild(paste); }
    var next = button("Continue", true);
    next.onclick = function () { submit(field ? field.value : ""); };
    row.appendChild(next);
    card.appendChild(row);

    var cancel = el("button", "display:block;width:100%;margin-top:10px;padding:8px;background:none;border:none;color:#8891A0;font:500 13px Inter,system-ui,sans-serif;cursor:pointer", "Cancel");
    cancel.type = "button";
    cancel.onclick = closeSheet;
    card.appendChild(cancel);

    sheet.appendChild(card);
    document.body.appendChild(sheet);
  }

  function makePill() {
    pill = el("button", "position:fixed;left:0;right:0;margin:0 auto;width:max-content;max-width:calc(100% - 24px);bottom:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:100001;box-sizing:border-box;padding:11px 18px;border-radius:22px;border:1px solid #262E3A;background:#161B22;color:#35D0BA;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.45);-webkit-tap-highlight-color:transparent",
      "Email link not opening? Paste it here");
    pill.type = "button";
    pill.onclick = openSheet;
    document.body.appendChild(pill);
  }

  function removeAll() {
    if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
    if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
    sheet = pill = field = note = null;
  }

  // Looked at once a second: cheap (one small storage read while signed in), and it also copes with the app drawing the screen later.
  function refresh() {
    try {
      if (!document.body) return;
      if (signedIn() || !onLinkSentScreen()) { if (pill || sheet) removeAll(); return; }
      if (!pill) makePill();
    } catch (e) { }
  }

  try {
    setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    refresh();
  } catch (e) { }
})();
