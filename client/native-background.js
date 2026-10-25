// Letschat Africa: native Android app only. Starts the background service (keeps Letschat connected while the app is closed)
// when the person is signed in, and stops it on log out. In a normal browser this file does nothing.
(function () {
  var C = window.Capacitor;
  var native = /LetschatApp/.test(navigator.userAgent) || !!(C && C.isNativePlatform && C.isNativePlatform());
  if (!native) return;
  function plugin() { return C && C.Plugins && C.Plugins.BackgroundService; }
  function signedIn() { try { return !!localStorage.getItem("letschat-africa:session"); } catch (e) { return false; } }
  var state = null; // null = not decided yet, true = started, false = stopped
  function sync() {
    var P = plugin();
    if (!P) return;
    var want = signedIn();
    if (want === state) return;
    state = want;
    try {
      var r = want ? P.start({ title: "Letschat Africa", text: "Connected. Tap to open." }) : P.stop();
      if (r && r.catch) r.catch(function () { state = null; }); // try again on the next check
    } catch (e) { state = null; }
  }
  sync();
  setInterval(sync, 4000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) sync(); });
})();
