"use strict";
/*
 * One message = one notification, even when the same phone is subscribed from several web addresses.
 *
 * Cause: every web address (the live site AND each Vercel preview deployment, e.g. letschat-git-<branch>-<team>.vercel.app or
 * letschat-<hash>-<team>.vercel.app) is its own site to Chrome, so each one gets its own push subscription. The server stored them all
 * (up to 5 per person) and sent every message to every one of them: the same chat message showed 2-3 times.
 *
 * What this patch does to server.js:
 *   1. /api/push/subscribe now remembers the web address (Origin) and the device (User-Agent) of each subscription, and a new subscription
 *      from the same address on the same device replaces the old one.
 *   2. pickPushSubs(user): every sender (messages, groups, statuses, calls, live, announcements) now goes through it. It keeps ALL
 *      Android-app (FCM) devices and ONE browser subscription per device: the live site is preferred over a preview deployment, then the
 *      newest. A second real device (e.g. a PC) still gets its own alert, because it has a different User-Agent.
 *   Subscriptions saved before this patch have no device mark: they are treated as one device (the newest wins) until the app is opened again.
 *
 * Runs after `npm install` (postinstall) and before `npm start` (prestart), after patch-app-only-push.js.
 * Safe to run many times, and it never fails the build: if an anchor is gone it only prints a warning.
 */
const fs = require("fs");
const path = require("path");
try {
  const file = path.join(__dirname, "server.js");
  if (!fs.existsSync(file)) { console.log("[dedupe-push] server.js not found: nothing to do"); process.exit(0); }
  let src = fs.readFileSync(file, "utf8");
  if (src.indexOf("pickPushSubs") !== -1) { console.log("[dedupe-push] server.js is already patched"); process.exit(0); }

  const commentAnchor = "// send one push; resolves true when sent, false when not (a dead device, 404/410, is removed). Never rejects.";
  const oldFilter = "const subs = (user.pushSubs || []).filter((x) => x.endpoint !== entry.endpoint);";
  const pushStart = "subs.push({ endpoint: entry.endpoint, keys: entry.keys,";
  if (src.indexOf(commentAnchor) < 0 || src.indexOf(oldFilter) < 0 || src.indexOf(pushStart) < 0) {
    console.warn("[dedupe-push] could not find the push code in server.js: duplicate-alert fix NOT applied");
    process.exit(0);
  }

  const helper =
    "// One browser subscription per device (added by patch-dedupe-push.js): preview deployments and old subscriptions no longer send twins\n" +
    "function isPreviewOrigin(o) { return /^https:\\/\\/[a-z0-9]+-[a-z0-9]+-[a-z0-9-]+\\.vercel\\.app$/i.test(String(o || \"\")); }\n" +
    "function deviceKey(sub) { return String((sub && sub.ua) || \"\").slice(0, 160); }\n" +
    "function pickPushSubs(u) {\n" +
    "  const all = (u && u.pushSubs) || [];\n" +
    "  const out = all.filter(isFcmSub), best = new Map();\n" +
    "  for (const sub of all) {\n" +
    "    if (isFcmSub(sub)) continue;\n" +
    "    const k = deviceKey(sub), cur = best.get(k);\n" +
    "    if (!cur) { best.set(k, sub); continue; }\n" +
    "    const rank = (x) => (isPreviewOrigin(x.origin) ? 0 : 1);\n" +
    "    if (rank(sub) > rank(cur) || (rank(sub) === rank(cur) && (sub.time || 0) >= (cur.time || 0))) best.set(k, sub);\n" +
    "  }\n" +
    "  return out.concat([...best.values()]);\n" +
    "}\n";
  const newFilter =
    "const origin = String(req.headers.origin || \"\").slice(0, 200), ua = String(req.headers[\"user-agent\"] || \"\").slice(0, 160);\n" +
    "  const subs = (user.pushSubs || []).filter((x) => x.endpoint !== entry.endpoint && (isFcmSub(entry) || isFcmSub(x) || x.origin !== origin || deviceKey(x) !== ua));";

  src = src.replace(commentAnchor, () => helper + commentAnchor)
           .replace(oldFilter, () => newFilter)
           .replace(pushStart, () => pushStart + " origin, ua,")
           .split("for (const sub of (u.pushSubs || [])) {").join("for (const sub of pickPushSubs(u)) {")
           .split("for (const sub of u.pushSubs) {").join("for (const sub of pickPushSubs(u)) {");
  fs.writeFileSync(file, src);
  console.log("[dedupe-push] server.js patched: one notification per device");
} catch (e) {
  console.warn("[dedupe-push] patch skipped: " + e.message);
}
process.exit(0);
