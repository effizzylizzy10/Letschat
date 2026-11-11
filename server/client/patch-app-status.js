"use strict";
/*
 * Lets the website ask the server "does this person have the Android app?" so push.js can switch Chrome's notifications off by itself.
 *
 * Adds one route to server.js:   GET /api/push/app   (signed in)   ->   { app: true | false }
 *   true  = the person has at least one working app device (a push registration saved with app:true that the server can send to)
 *   false = no app device
 * It only reads; it changes nothing about who gets which alert (that is patch-app-only-push.js).
 *
 * Runs by itself after `npm install` (postinstall) and before `npm start` (prestart), AFTER patch-app-only-push.js.
 * Safe to run many times, and it never fails the build: if server.js changed so much that the anchor is gone, it only prints a warning.
 */
const fs = require("fs");
const path = require("path");
try {
  const file = path.join(__dirname, "server.js");
  if (!fs.existsSync(file)) { console.log("[app-status] server.js not found: nothing to do"); process.exit(0); }
  let src = fs.readFileSync(file, "utf8");
  if (src.indexOf("/api/push/app\"") !== -1) { console.log("[app-status] server.js is already patched"); process.exit(0); }

  const anchor = "app.post(\"/api/push/unsubscribe\", authMiddleware, (req, res) => {";
  if (src.indexOf(anchor) < 0) {
    console.warn("[app-status] could not find the push routes in server.js: /api/push/app NOT added (Chrome keeps its push on)");
    process.exit(0);
  }
  const route =
    "// Does this person have the Android app? (added by patch-app-status.js) The website uses it to switch Chrome's push off by itself.\n" +
    "app.get(\"/api/push/app\", authMiddleware, (req, res) => {\n" +
    "  try {\n" +
    "    const u = readDB().users.find((x) => x.id === req.user.id);\n" +
    "    res.json({ app: !!(u && (u.pushSubs || []).some((x) => x && x.app === true && canPush(x))) });\n" +
    "  } catch (e) { res.json({ app: false }); }\n" +
    "});\n";
  src = src.replace(anchor, () => route + anchor);
  fs.writeFileSync(file, src);
  console.log("[app-status] server.js patched: GET /api/push/app added");
} catch (e) {
  console.warn("[app-status] patch skipped: " + e.message);
}
process.exit(0);
