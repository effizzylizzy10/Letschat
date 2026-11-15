"use strict";
/*
 * Whoever has the Letschat app gets their alerts in the app only, not also in Chrome (or any other browser).
 * "The app" means any of the three Android builds: the native app (Capacitor), the legacy app (older Android WebView build) and the
 * PWA APK (the older Trusted Web Activity).
 *
 * How it works:
 *   1. When a device registers for push (/api/push/subscribe), the server remembers whether the request came from an app:
 *        - the native app sends app:true;
 *        - the legacy WebView app is recognised by its user agent ("wv") or by the X-Requested-With header (its package name);
 *        - the PWA APK sends apk:true (client/push.js notices it was opened from the app: document.referrer is android-app://...).
 *      This no longer depends on the Firebase channel: a classic web-push registration from an app counts too.
 *   2. deliverPush(): if the person has at least one working app device, their browser devices are skipped. Every kind of alert goes through
 *      deliverPush (messages, calls, posts, friend suggestions, announcements), so one change covers them all.
 *   People without the app keep getting browser alerts exactly as before. If the app is uninstalled, Firebase reports its token as dead on the
 *   next alert, the server removes it, and browser alerts start again by themselves.
 *
 * Runs by itself after `npm install` (postinstall) and before `npm start` (prestart), next to patch-suggest.js and patch-post-notify.js.
 * Safe to run many times, and it never fails the build: if server.js changed so much that an anchor is gone, it only prints a warning.
 */
const fs = require("fs");
const path = require("path");
try {
  const file = path.join(__dirname, "server.js");
  if (!fs.existsSync(file)) { console.log("[app-only-push] server.js not found: nothing to do"); process.exit(0); }
  let src = fs.readFileSync(file, "utf8");
  if (src.indexOf("browserPushHeldForApp") !== -1) { console.log("[app-only-push] server.js is already patched"); process.exit(0); }

  const commentAnchor = "// send one push; resolves true when sent, false when not (a dead device, 404/410, is removed). Never rejects.";
  const guardLine = "if (!webpush || !canPush(sub)) return Promise.resolve(false);";
  const saveLine = "subs.push({ endpoint: entry.endpoint, keys: entry.keys, preview: req.body.preview !== false, groups: req.body.groups !== false, time: Date.now() });";
  if (src.indexOf(commentAnchor) < 0 || src.indexOf(guardLine) < 0 || src.indexOf(saveLine) < 0) {
    console.warn("[app-only-push] could not find the push code in server.js: app-only notifications NOT applied");
    process.exit(0);
  }

  const helper =
    "// App marker (added by patch-app-only-push.js): native app sends app:true, PWA APK sends apk:true, the legacy WebView app has \"wv\" in its\n" +
    "// user agent or its package name in X-Requested-With\n" +
    "function isAppRequest(req) {\n" +
    "  try {\n" +
    "    if (req.body && (req.body.app === true || req.body.apk === true)) return true;\n" +
    "    if (String((req.headers && req.headers[\"x-requested-with\"]) || \"\") === \"com.letschatafrica.app\") return true;\n" +
    "    return /;\\s*wv\\)/i.test(String((req.headers && req.headers[\"user-agent\"]) || \"\"));\n" +
    "  } catch (e) { return false; }\n" +
    "}\n" +
    "// Whoever has a working app device gets alerts in the app only: their browser devices are skipped.\n" +
    "function browserPushHeldForApp(userId, sub) {\n" +
    "  try {\n" +
    "    if (!sub || sub.app === true) return false;\n" +
    "    const u = readDB().users.find((x) => x.id === userId);\n" +
    "    return !!(u && (u.pushSubs || []).some((x) => x && x.app === true && x.endpoint !== sub.endpoint && canPush(x)));\n" +
    "  } catch (e) { return false; }\n" +
    "}\n";
  const newGuard = "if (!webpush || !canPush(sub) || browserPushHeldForApp(userId, sub)) return Promise.resolve(false);";
  const newSave = "subs.push({ endpoint: entry.endpoint, keys: entry.keys, preview: req.body.preview !== false, groups: req.body.groups !== false, app: isAppRequest(req), time: Date.now() });";

  src = src.replace(commentAnchor, () => helper + commentAnchor).replace(guardLine, () => newGuard).replace(saveLine, () => newSave);
  fs.writeFileSync(file, src);
  console.log("[app-only-push] server.js patched: people with the app (native, legacy or PWA APK) now get alerts in the app only");
} catch (e) {
  console.warn("[app-only-push] patch skipped: " + e.message);
}
process.exit(0);
