"use strict";
/*
 * Letschat friend-suggestion pushes (Facebook-style), sent through the existing push system.
 *
 * Every few hours each person who has the Android app (or a browser) registered for push gets a small batch of notifications:
 *     "Ada, you have a new friend suggestion: Pretty Chidi"      (with that person's profile photo as the big picture)
 * They arrive even when the app is closed, because they go through Firebase Cloud Messaging like new-message pushes do.
 *
 * Who is suggested: people the viewer has no private chat with yet, not blocked either way, never the same person twice in a row.
 * People with a profile photo come first (the photo is served by the public /api/users/:id/avatar route).
 *
 * server.js reaches this file through ONE line that patch-suggest.js adds automatically (see PUSH-SUGGEST.md).
 * It reuses server.js's own readDB, deliverPush, canPush, avatarUrl and isBlockedEither, so nothing is duplicated.
 *
 * Render > Environment (all optional):
 *   SUGGEST_PUSH=off            switch the feature off
 *   PUBLIC_URL=https://...      the server's public address (Render sets RENDER_EXTERNAL_URL itself, which is used when this is empty)
 *   SUGGEST_EVERY_HOURS=24      hours between batches for one person
 *   SUGGEST_PER_BURST=3         notifications in one batch
 *   SUGGEST_FROM_HOUR=9         only send between these local hours (09:00 ...
 *   SUGGEST_TO_HOUR=21          ... to 21:00)
 *   SUGGEST_TZ_OFFSET=1         hours from UTC for those local hours (Nigeria = 1)
 *   SUGGEST_CHECK_MIN=30        how often the server looks for people who are due
 *   SUGGEST_MAX_PER_RUN=200     most people handled in one look
 *   SUGGEST_TEST_USERNAME=me    send ONLY to this person (username, display name or email) for testing
 *   SUGGEST_RUN_NOW=1           with SUGGEST_TEST_USERNAME: send one batch 20 seconds after the server starts, ignoring the time window
 */
const fs = require("fs");
const path = require("path");

const HOUR = 3600 * 1000;
const STATE_FILE = path.join(__dirname, "data", "suggest-state.json");
const num = (v, d) => { const n = Number(v); return v !== undefined && v !== "" && Number.isFinite(n) ? n : d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ctx = null;
let running = false;
const lastBurst = new Map(); // viewer id -> time of their last batch
const seen = new Map();      // viewer id -> ids already suggested to them (newest last)

function cfg() {
  return {
    on: String(process.env.SUGGEST_PUSH || "on").toLowerCase() !== "off",
    everyHours: Math.max(1, num(process.env.SUGGEST_EVERY_HOURS, 24)),
    burst: Math.min(8, Math.max(1, Math.floor(num(process.env.SUGGEST_PER_BURST, 3)))),
    from: num(process.env.SUGGEST_FROM_HOUR, 9),
    to: num(process.env.SUGGEST_TO_HOUR, 21),
    tz: num(process.env.SUGGEST_TZ_OFFSET, 1),
    checkMin: Math.max(5, num(process.env.SUGGEST_CHECK_MIN, 30)),
    perRun: Math.max(1, Math.floor(num(process.env.SUGGEST_MAX_PER_RUN, 200))),
    testUser: String(process.env.SUGGEST_TEST_USERNAME || "").trim().replace(/^@/, "").toLowerCase(),
    base: String(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, ""),
  };
}

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    for (const [k, v] of Object.entries(s.lastBurst || {})) lastBurst.set(k, Number(v) || 0);
    for (const [k, v] of Object.entries(s.seen || {})) if (Array.isArray(v)) seen.set(k, v.slice(-200));
  } catch (e) { /* first run: nothing saved yet */ }
}
function saveState() {
  try {
    const out = { lastBurst: {}, seen: {} };
    for (const [k, v] of lastBurst) out.lastBurst[k] = v;
    for (const [k, v] of seen) out.seen[k] = v.slice(-200);
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(out));
  } catch (e) { /* best effort: on a free Render disk this resets on restart, which only means a fresh batch may arrive sooner */ }
}

const fullName = (u) => String((u && (u.name || u.username)) || "").trim().slice(0, 40);
const firstName = (u) => fullName(u).split(/\s+/)[0] || "there";
// the test person may be given by username, display name or email
const isTest = (u, c) => !!u && [u.username, u.name, u.email].some((x) => String(x || "").trim().toLowerCase() === c.testUser);
const pushable = (u) => (Array.isArray(u && u.pushSubs) ? u.pushSubs : []).filter((s) => s && s.endpoint && ctx.canPush(s));

// a public https address for the person's photo, or null when they have none (notification images must be public https links)
function imageOf(u, base) {
  let a = null;
  try { a = ctx.avatarUrl(u); } catch (e) { a = null; }
  if (!a) return null;
  if (/^https:\/\//i.test(a)) return a;
  a = a.replace(/^\/api\/v1\//, "/api/"); // the plain /api/users/:id/avatar route is public and needs no sign-in
  if (a.charAt(0) === "/" && /^https:\/\//i.test(base)) return base + a;
  return null;
}

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; }
  return x;
}

function partnersMap(db) { // who already has a private chat with whom
  const m = new Map();
  for (const c of db.conversations || []) {
    if (!c || c.isGroup || !Array.isArray(c.participantIds)) continue;
    for (const a of c.participantIds) {
      if (!m.has(a)) m.set(a, new Set());
      for (const b of c.participantIds) if (b !== a) m.get(a).add(b);
    }
  }
  return m;
}

function pick(viewer, db, partners, c) {
  const mine = partners.get(viewer.id) || new Set();
  const build = () => {
    const done = new Set(seen.get(viewer.id) || []);
    return (db.users || []).filter((u) => u && u.id && u.id !== viewer.id && !mine.has(u.id) && !done.has(u.id) &&
      !u.isBot && !u.bot && fullName(u) && !ctx.isBlockedEither(viewer, u));
  };
  let pool = build();
  if (!pool.length && (seen.get(viewer.id) || []).length) { seen.delete(viewer.id); pool = build(); } // everyone was shown once: start over
  const withPhoto = shuffle(pool.filter((u) => imageOf(u, c.base)));
  const rest = shuffle(pool.filter((u) => !imageOf(u, c.base)));
  return withPhoto.concat(rest).slice(0, c.burst);
}

function inWindow(c) {
  const h = (new Date().getUTCHours() + Math.floor(c.tz) + 24) % 24;
  return h >= c.from && h < c.to;
}

async function run(force) {
  if (running || !ctx) return;
  running = true;
  try {
    const c = cfg();
    if (!c.on) return;
    if (!force && !inWindow(c)) return;
    const db = ctx.readDB();
    if (!db || !Array.isArray(db.users)) return;
    const now = Date.now();
    const partners = partnersMap(db);
    const due = db.users
      .filter((u) => u && u.id && pushable(u).length &&
        (!c.testUser || isTest(u, c)) &&
        (force || now - (lastBurst.get(u.id) || 0) >= c.everyHours * HOUR))
      .sort((a, b) => (lastBurst.get(a.id) || 0) - (lastBurst.get(b.id) || 0))
      .slice(0, c.perRun);
    if (force || due.length) { // say what was found, so a quiet run can be explained from the Render logs
      const withPush = db.users.filter((u) => u && u.id && pushable(u).length).length;
      const target = c.testUser ? db.users.find((u) => isTest(u, c)) : null;
      const names = db.users.filter((u) => u && u.id && pushable(u).length).map((u) => u.username || u.name || "?").slice(0, 10).join(", ");
      console.log("[suggest] check: " + db.users.length + " users, " + withPush + " with a push device" +
        (c.testUser ? "; test user " + (target ? "found, " + (Array.isArray(target.pushSubs) ? target.pushSubs.length : 0) + " push device(s) registered, " + pushable(target).length + " usable" : "NOT found; users with a push device: " + (names || "none")) : "") +
        "; " + due.length + " due");
    }
    let people = 0, notes = 0;
    for (const v of due) {
      const picks = pick(v, db, partners, c);
      lastBurst.set(v.id, Date.now()); // even with nobody to suggest, so the next look does not scan them again straight away
      if (!picks.length) continue;
      let any = false;
      for (const u of picks) {
        const payload = {
          title: "Letschat Africa",
          body: firstName(v) + ", you have a new friend suggestion: " + fullName(u),
          tag: "suggest-" + u.id, // one notification per suggested person, so they stack like Facebook's
          url: "./",
          suggest: true,
        };
        const img = imageOf(u, c.base);
        if (img) payload.image = img;
        let ok = false;
        for (const sub of pushable(v)) {
          if (await ctx.deliverPush(v.id, sub, payload, { TTL: 12 * 3600, urgency: "normal" })) ok = true;
        }
        if (ok) {
          notes++; any = true;
          const list = seen.get(v.id) || [];
          list.push(u.id);
          seen.set(v.id, list.slice(-200));
        }
        await sleep(1500); // a short gap so each one shows up as its own notification
      }
      if (any) people++;
    }
    if (due.length) { console.log("[suggest] " + notes + " friend suggestions sent to " + people + " people (" + due.length + " were due)"); saveState(); }
  } catch (e) {
    console.warn("[suggest] run failed: " + (e && e.message));
  } finally {
    running = false;
  }
}

function attach(context) {
  if (ctx) return; // already started
  ctx = context;
  loadState();
  const c = cfg();
  if (!c.on) { console.log("[suggest] friend-suggestion pushes are off (SUGGEST_PUSH=off)"); return; }
  if (!c.base) console.warn("[suggest] no PUBLIC_URL / RENDER_EXTERNAL_URL: suggestions will be sent without the profile photo");
  console.log("[suggest] friend-suggestion pushes on: " + c.burst + " per batch, every " + c.everyHours + " h, between " + c.from + ":00 and " + c.to + ":00 (UTC" + (c.tz >= 0 ? "+" : "") + c.tz + ")" + (c.testUser ? ", TEST MODE for " + c.testUser : ""));
  const first = setTimeout(() => run(false), 90 * 1000);
  if (first.unref) first.unref();
  const every = setInterval(() => run(false), c.checkMin * 60 * 1000);
  if (every.unref) every.unref();
  if (c.testUser && String(process.env.SUGGEST_RUN_NOW || "") === "1") {
    console.log("[suggest] test batch for " + c.testUser + " will be sent in 20 seconds");
    const t = setTimeout(() => run(true), 20 * 1000);
    if (t.unref) t.unref();
  } else if (c.testUser) {
    console.log("[suggest] test user is set but SUGGEST_RUN_NOW is not 1, so no test batch will be sent");
  }
}

module.exports = { attach, run };
