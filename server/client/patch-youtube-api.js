"use strict";
/*
 * Adds ONE line to server.js so it starts youtube-api.js (YouTube search, trending and video details; see YOUTUBE-LINKS-API.md).
 * Same idea as patch-link-preview.js and patch-suggest.js: runs by itself after `npm install` (postinstall) and before `npm start`
 * (prestart), so Render needs no new settings. Safe to run many times: if the line is already there it does nothing.
 * It never fails the build: if server.js changed so much that the anchor is gone, it only prints a warning and the rest of the
 * server keeps working (YouTube links, previews and the in-app player do not need this file).
 */
const fs = require("fs");
const path = require("path");
try {
  const file = path.join(__dirname, "server.js");
  if (!fs.existsSync(file)) { console.log("[youtube] server.js not found next to patch-youtube-api.js: nothing to do"); process.exit(0); }
  const src = fs.readFileSync(file, "utf8");
  if (src.indexOf("require(\"./youtube-api\")") !== -1) { console.log("[youtube] server.js is already hooked"); process.exit(0); }
  const anchor = "const previewCache = new Map();";
  const at = src.indexOf(anchor);
  if (at < 0) { console.warn("[youtube] could not find the previewCache line in server.js: YouTube search NOT hooked (see YOUTUBE-LINKS-API.md)"); process.exit(0); }
  const hook = (at > 0 && src[at - 1] !== "\n" ? "\n" : "") +
    "// YouTube search, trending and video details (added by patch-youtube-api.js; needs YOUTUBE_API_KEY, see YOUTUBE-LINKS-API.md)\n" +
    "try { require(\"./youtube-api\").attach(app, { authMiddleware, rateLimit }); } catch (e) { console.warn(\"[youtube] not started: \" + e.message); }\n";
  fs.writeFileSync(file, src.slice(0, at) + hook + src.slice(at));
  console.log("[youtube] server.js hooked: YouTube search will start with the server");
} catch (e) {
  console.warn("[youtube] patch skipped: " + e.message);
}
process.exit(0);
