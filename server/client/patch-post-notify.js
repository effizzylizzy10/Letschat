"use strict";
/*
 * Gives the "someone posted a status" push the Facebook look: the poster's name as the title and "made a post" as the text,
 * with the post's photo as the big picture (when the post has one) and the poster's profile photo sent along as "icon".
 * Runs by itself after `npm install` (postinstall) and before `npm start` (prestart), next to patch-suggest.js.
 * Safe to run many times, and it never fails the build: if server.js changed so much that an anchor is gone, it only prints a warning.
 */
const fs = require("fs");
const path = require("path");
try {
  const file = path.join(__dirname, "server.js");
  if (!fs.existsSync(file)) { console.log("[post-notify] server.js not found: nothing to do"); process.exit(0); }
  let src = fs.readFileSync(file, "utf8");
  if (src.indexOf("postPushImage") !== -1) { console.log("[post-notify] server.js is already patched"); process.exit(0); }

  const fnAnchor = "function pushStatusFollowers(db, posterId, s) {";
  const bodyLine = 'const body = s.text ? String(s.text).slice(0, 90) : "Posted a photo";';
  const sendLine = 'deliverPush(u.id, sub, { title: poster.name + " posted a status", body, tag: "status-" + posterId, url: "./" }, { TTL: 3600, urgency: "normal" });';
  if (src.indexOf(fnAnchor) < 0 || src.indexOf(bodyLine) < 0 || src.indexOf(sendLine) < 0) {
    console.warn("[post-notify] could not find the status push code in server.js: post notification style NOT applied");
    process.exit(0);
  }

  const helper =
    "// public picture links for the status push (added by patch-post-notify.js): the post's photo, and the poster's profile photo as icon\n" +
    "function postPushImage(db, posterId, s) {\n" +
    "  const out = {};\n" +
    "  const base = String(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || \"\").trim().replace(/\\/+$/, \"\");\n" +
    "  if (!/^https:\\/\\//i.test(base)) return out;\n" +
    "  if (s && s.photo) out.image = base + \"/api/status/\" + s.id + \"/photo\";\n" +
    "  try {\n" +
    "    let a = avatarUrl(db.users.find((x) => x.id === posterId) || {});\n" +
    "    if (a) { a = /^https:\\/\\//i.test(a) ? a : base + String(a).replace(/^\\/api\\/v1\\//, \"/api/\"); out.icon = a; }\n" +
    "  } catch (e) { /* no profile photo: the notification just has no icon */ }\n" +
    "  return out;\n" +
    "}\n";
  const newBody = 'const body = "made a post";\n    const pics = postPushImage(db, posterId, s);';
  const newSend = 'deliverPush(u.id, sub, Object.assign({ title: poster.name, body, tag: "status-" + posterId, url: "./", type: "post" }, pics), { TTL: 3600, urgency: "normal" });';

  src = src.replace(fnAnchor, helper + fnAnchor).replace(bodyLine, newBody).replace(sendLine, newSend);
  fs.writeFileSync(file, src);
  console.log("[post-notify] server.js patched: status pushes now read \"<name> made a post\"");
} catch (e) {
  console.warn("[post-notify] patch skipped: " + e.message);
}
process.exit(0);
