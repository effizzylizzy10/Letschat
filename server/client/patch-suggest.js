"use strict";
/*
 * Adds ONE line to server.js so it starts suggest-push.js. Runs by itself after `npm install` (postinstall) and before `npm start` (prestart),
 * so Render needs no new settings. Safe to run many times: if the line is already there it does nothing.
 * It never fails the build: if server.js changed so much that the anchor is gone, it only prints a warning.
 */
const fs = require("fs");
const path = require("path");
try {
  const file = path.join(__dirname, "server.js");
  if (!fs.existsSync(file)) { console.log("[suggest] server.js not found next to patch-suggest.js: nothing to do"); process.exit(0); }
  const src = fs.readFileSync(file, "utf8");
  if (src.indexOf("suggest-push") !== -1) { console.log("[suggest] server.js is already hooked"); process.exit(0); }
  const anchor = "function readDB() { return USE_DB ? cache : fileRead(); }";
  const at = src.indexOf(anchor);
  if (at < 0) { console.warn("[suggest] could not find the readDB line in server.js: friend suggestions NOT hooked (see PUSH-SUGGEST.md)"); process.exit(0); }
  const hook = "\n// Friend-suggestion pushes (added by patch-suggest.js)\n" +
    "try { require(\"./suggest-push\").attach({ readDB: () => readDB(), deliverPush: (...a) => deliverPush(...a), canPush: (s) => canPush(s), avatarUrl: (u) => avatarUrl(u), isBlockedEither: (a, b) => isBlockedEither(a, b) }); } catch (e) { console.warn(\"[suggest] not started: \" + e.message); }";
  fs.writeFileSync(file, src.slice(0, at + anchor.length) + hook + src.slice(at + anchor.length));
  console.log("[suggest] server.js hooked: friend-suggestion pushes will start with the server");
} catch (e) {
  console.warn("[suggest] patch skipped: " + e.message);
}
process.exit(0);
