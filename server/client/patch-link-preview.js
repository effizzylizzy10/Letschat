"use strict";
/*
 * Adds ONE line to server.js so it starts link-preview.js (YouTube/Vimeo/TikTok/Spotify/SoundCloud cards and safer page previews).
 * Same idea as patch-suggest.js: runs by itself after `npm install` (postinstall) and before `npm start` (prestart), so Render needs
 * no new settings. Safe to run many times: if the line is already there it does nothing.
 * It never fails the build: if server.js changed so much that the anchor is gone, it only prints a warning and the older built-in
 * preview route keeps working.
 */
const fs = require("fs");
const path = require("path");
try {
  const file = path.join(__dirname, "server.js");
  if (!fs.existsSync(file)) { console.log("[link-preview] server.js not found next to patch-link-preview.js: nothing to do"); process.exit(0); }
  const src = fs.readFileSync(file, "utf8");
  if (src.indexOf("require(\"./link-preview\")") !== -1) { console.log("[link-preview] server.js is already hooked"); process.exit(0); }
  const anchor = "const previewCache = new Map();";
  const at = src.indexOf(anchor);
  if (at < 0) { console.warn("[link-preview] could not find the previewCache line in server.js: link previews v2 NOT hooked (see LINK-PREVIEWS.md)"); process.exit(0); }
  const hook = (at > 0 && src[at - 1] !== "\n" ? "\n" : "") +
    "// Link previews v2: YouTube/Vimeo/TikTok/Spotify/SoundCloud cards and safer page previews (added by patch-link-preview.js; the older route below stays as a fallback)\n" +
    "try { require(\"./link-preview\").attach(app, { authMiddleware, rateLimit }); } catch (e) { console.warn(\"[link-preview] not started: \" + e.message); }\n";
  fs.writeFileSync(file, src.slice(0, at) + hook + src.slice(at));
  console.log("[link-preview] server.js hooked: link previews v2 will start with the server");
} catch (e) {
  console.warn("[link-preview] patch skipped: " + e.message);
}
process.exit(0);
