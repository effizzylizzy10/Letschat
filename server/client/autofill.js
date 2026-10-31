// Letschat Africa: password manager support (autofill + "Save password?" + remember me), loaded by config.js.
// 1. Tells the browser which field is the email / username and which is the password, so Chrome, Samsung Internet, Google Password Manager
//    and other managers offer to fill them (the app builds its screens with React, so this runs again whenever a screen changes).
//    A screen with two password boxes (password + confirm) is a sign-up and gets "new-password", so the browser can suggest a strong one.
// 2. After a successful sign-in or sign-up, hands the email and password to the browser (Credential Management API), which then shows its
//    "Save password?" prompt. The password is only held in memory for a few minutes and is never sent anywhere by this file.
// Plain old-style JS on purpose, same as the other helper files: no optional chaining, no async/await.
(function () {
  "use strict";
  var SESSION_KEY = "letschat-africa:session"; // the app writes this when a sign-in / sign-up succeeds
  var typed = { id: "", pw: "", at: 0 };
  var timer = 0;

  function noop() {}
  function isPw(el) { return !!el && el.localName === "input" && (el.type === "password" || el.getAttribute("data-lc-pw") === "1"); }
  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)); }
  function plainAuto(v) { return !v || v === "off" || v === "on" || v === "nope" || v === "new-password-off"; }

  // the email / username box that belongs to this password box: the closest text-like input before it, in the same part of the screen
  function findUser(pw) {
    var inputs = document.querySelectorAll("input"), prev = null, i, el, t;
    for (i = 0; i < inputs.length; i++) {
      el = inputs[i];
      if (el === pw) break;
      t = (el.type || "text").toLowerCase();
      if ((t === "text" || t === "email" || t === "tel") && !isPw(el) && !el.disabled && !el.readOnly && visible(el)) prev = el;
    }
    if (!prev) return null;
    var box = pw, hops = 0;
    while (box && hops < 6) { if (box.contains(prev)) return prev; box = box.parentElement; hops++; }
    return null;
  }

  function apply() {
    timer = 0;
    var all = document.querySelectorAll('input[type="password"],input[data-lc-pw="1"]'), shown = [], i;
    for (i = 0; i < all.length; i++) if (visible(all[i])) shown.push(all[i]);
    if (!shown.length) return;
    var signUp = shown.length >= 2; // password + confirm password
    for (i = 0; i < shown.length; i++) {
      var pw = shown[i];
      pw.setAttribute("data-lc-pw", "1"); // stays recognised when a "show password" eye turns it into a plain text box
      var want = signUp ? "new-password" : "current-password";
      if (pw.getAttribute("autocomplete") !== want && (plainAuto(pw.getAttribute("autocomplete")) || pw.getAttribute("autocomplete") === "current-password" || pw.getAttribute("autocomplete") === "new-password")) pw.setAttribute("autocomplete", want);
      if (!pw.getAttribute("name")) pw.setAttribute("name", signUp && i > 0 ? "confirm-password" : "password");
      if (!pw.id) pw.id = "lc-pw-" + i;
      var user = findUser(pw);
      if (user) {
        if (plainAuto(user.getAttribute("autocomplete")) || user.getAttribute("autocomplete") === "email") user.setAttribute("autocomplete", "username");
        if (!user.getAttribute("name")) user.setAttribute("name", "email");
        user.setAttribute("autocapitalize", "none");
        user.setAttribute("autocorrect", "off");
        user.setAttribute("spellcheck", "false");
      }
    }
  }
  function schedule() { if (!timer) timer = setTimeout(apply, 100); }

  // remember what was typed (in memory only) so it can be offered to the browser once the sign-in works
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!isPw(el)) return;
    var user = findUser(el);
    if (el.value) typed = { id: user ? String(user.value || "").trim() : typed.id, pw: String(el.value), at: Date.now() };
  }, true);

  function offerToBrowser() {
    if (!typed.pw || !typed.id || Date.now() - typed.at > 10 * 60 * 1000) { typed = { id: "", pw: "", at: 0 }; return; }
    var t = typed;
    typed = { id: "", pw: "", at: 0 };
    try {
      if (window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
        navigator.credentials.store(new window.PasswordCredential({ id: t.id, password: t.pw, name: t.id })).catch(noop);
      }
    } catch (e) {}
  }

  // the app saves its session when sign-in / sign-up succeeds: that is the moment to offer "Save password?"
  try {
    var proto = window.Storage && Storage.prototype, orig = proto && proto.setItem;
    if (orig) {
      proto.setItem = function (k) {
        var r = orig.apply(this, arguments);
        try { if (k === SESSION_KEY && this === window.localStorage) setTimeout(offerToBrowser, 0); } catch (e) {}
        return r;
      };
    }
  } catch (e) {}

  function start() {
    apply();
    try { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
