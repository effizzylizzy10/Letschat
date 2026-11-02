"use strict";
/*
 * Adds ONE line to server.js so it starts notifications-api.js (notification history, unread count, settings, devices, test push; see NOTIFICATIONS.md).
 * Runs by itself after `npm install` (postinstall) and before `npm start` (prestart), so Render needs no new settings.
 * Safe to run many times: if the line is already there it does nothing.
 * It never fails the build: if server.js changed so much that the anchor is gone, it only prints a warning.
 */
const fs = require("fs");
const path = require("path");
try {
  const file = path.join(__dirname, "server.js");
  if (!fs.existsSync(file)) { console.log("[notif] server.js not found next to patch-notifications.js: nothing to do"); process.exit(0); }
  const src = fs.readFileSync(file, "utf8");
  if (src.indexOf("notifications-api") !== -1) { console.log("[notif] server.js is already hooked"); process.exit(0); }
  const anchor = "server.listen(PORT, \"0.0.0.0\"";
  const at = src.indexOf(anchor);
  if (at < 0) { console.warn("[notif] could not find the server.listen line in server.js: notification API NOT hooked (see NOTIFICATIONS.md)"); process.exit(0); }
  const hook = "// Notification API: history, unread count, settings, devices, test push (added by patch-notifications.js)\n" +
    "try { require(\"./notifications-api\").attach({ app, authMiddleware, readDB: () => readDB(), writeDB: (d) => writeDB(d), canPush: (s) => canPush(s), getDeliverPush: () => deliverPush, setDeliverPush: (fn) => { deliverPush = fn; } }); } catch (e) { console.warn(\"[notif] notification API not started: \" + e.message); }\n";
  fs.writeFileSync(file, src.slice(0, at) + hook + src.slice(at));
  console.log("[notif] server.js hooked: the notification API will start with the server");
} catch (e) {
  console.warn("[notif] patch skipped: " + e.message);
}
process.exit(0);
