"use strict";
/*
 * Letschat YouTube API (see YOUTUBE-LINKS-API.md): search, trending and video details from the official YouTube Data API v3.
 * The key stays on the server (YOUTUBE_API_KEY in Render > Environment); the phone only ever talks to Letschat.
 *
 * Routes (the person must be signed in; /api/v1/... and /api/... both work):
 *   GET /api/v1/youtube/status                          -> { enabled, region }
 *   GET /api/v1/youtube/search?q=words[&pageToken=..]   -> { items: [video], nextPageToken }
 *   GET /api/v1/youtube/trending[?region=NG]            -> { region, items: [video] }
 *   GET /api/v1/youtube/video?id=ID[,ID...]             -> { items: [video] }   (works without a key too: title and picture only)
 * video = { id, title, channel, thumb, duration, views, badge, published }   badge is "LIVE", "UPCOMING" or ""
 *
 * Google's free allowance is small: about 100 searches a day for the whole app, and about 10,000 other lookups a day. So the same
 * search is answered from memory for an hour, trending for 30 minutes and a video for 6 hours, only embeddable videos are offered,
 * and after a "quota exceeded" answer search rests for 15 minutes (trending and video details keep working: they are counted apart).
 * Without a key every route except /video answers "not set up" and /status says enabled:false; the rest of Letschat is not affected.
 */
const https = require("https");

const API_HOST = "www.googleapis.com";
const OEMBED_HOST = "www.youtube.com";
const TOTAL_MS = 8000;
const MAX_BYTES = 700000;
const PAGE_SIZE = 12;
const SEARCH_TTL = 60 * 60 * 1000;
const LIST_TTL = 30 * 60 * 1000;
const VIDEO_TTL = 6 * 60 * 60 * 1000;
const MISS_TTL = 10 * 60 * 1000;
const COOLDOWN_MS = 15 * 60 * 1000;
const CACHE_MAX = 400;
const ITEM_MAX = 2000;
const ID_RE = /^[\w-]{11}$/;
const TOKEN_RE = /^[\w-]{1,120}$/;
const REGION_RE = /^[A-Za-z]{2}$/;
const PARTS = "snippet,contentDetails,statistics,status";

class YtError extends Error {
  constructor(code, message) { super(message); this.name = "YtError"; this.code = code; }
}

// ---- talking to Google (fixed hosts only) ----
// o = { lib, host, port, timeout } for tests; normally everything is default
function makeFetcher(o) {
  o = o || {};
  const lib = o.lib || https;
  return function fetchJson(host, path) {
    return new Promise((resolve, reject) => {
      let done = false, timer = null;
      const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); fn(v); } };
      const options = { host: o.host || host, path, headers: { Accept: "application/json", "User-Agent": "LetschatYouTube/1.0" } };
      if (o.port) options.port = o.port;
      const req = lib.get(options, (res) => {
        const chunks = []; let size = 0;
        res.on("data", (c) => {
          size += c.length;
          if (size > MAX_BYTES) { res.destroy(); return finish(reject, new YtError("unavailable", "answer too large")); }
          chunks.push(c);
        });
        res.on("end", () => {
          let body = null;
          try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { body = null; }
          finish(resolve, { status: res.statusCode || 0, body });
        });
        res.on("error", () => finish(reject, new YtError("unavailable", "read error")));
      });
      timer = setTimeout(() => { req.destroy(); finish(reject, new YtError("unavailable", "timeout")); }, o.timeout || TOTAL_MS);
      req.on("error", (e) => finish(reject, new YtError("unavailable", String((e && e.code) || "network"))));
    });
  };
}

// Google's error answer -> one of our codes: quota, key, bad_request, unavailable
function googleError(status, body) {
  const e = body && body.error;
  const list = e && Array.isArray(e.errors) ? e.errors : [];
  const why = list.map((x) => String((x && x.reason) || "")).join(" ") + " " + String((e && e.status) || "") + " " + String((e && e.message) || "").slice(0, 160);
  if (status === 429 || /quotaExceeded|dailyLimitExceeded|rateLimitExceeded|userRateLimitExceeded|RESOURCE_EXHAUSTED/i.test(why)) return new YtError("quota", "YouTube limit reached");
  if (status === 401 || status === 403 || /keyInvalid|API key not valid|API_KEY_INVALID|accessNotConfigured|SERVICE_DISABLED|PERMISSION_DENIED|ipRefererBlocked|keyExpired|forbidden/i.test(why)) return new YtError("key", "YouTube key problem");
  if (status === 400) return new YtError("bad_request", "YouTube did not accept that request");
  return new YtError("unavailable", "YouTube is not answering right now");
}

// ---- turning YouTube's answers into the small shape the app uses ----
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function clean(t, max) {
  return String(t == null ? "" : t).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 && !(n >= 0xD800 && n <= 0xDFFF) ? String.fromCodePoint(n) : m;
    }
    const r = ENT[e.toLowerCase()];
    return r !== undefined ? r : m;
  }).replace(/[\u0000-\u001F\u007F\s]+/g, " ").trim().slice(0, max || 140);
}
// "PT1H2M3S" -> "1:02:03", "PT3M33S" -> "3:33", "P0D" (live) -> ""
function formatDuration(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(iso || ""));
  if (!m) return "";
  const h = (+m[2] || 0) + (+m[1] || 0) * 24, mi = +m[3] || 0, s = +m[4] || 0;
  if (!h && !mi && !s) return "";
  const pad = (n) => (n < 10 ? "0" : "") + n;
  return h ? h + ":" + pad(mi) + ":" + pad(s) : mi + ":" + pad(s);
}
// 1234 -> "1.2K views", 1500000 -> "1.5M views"
function formatViews(n) {
  if (n === undefined || n === null || n === "") return "";
  const v = Number(n);
  if (!isFinite(v) || v < 0) return "";
  if (v === 1) return "1 view";
  const short = (x, unit) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + unit;
  let s;
  if (v >= 1e9) s = short(v / 1e9, "B");
  else if (v >= 1e6) s = short(v / 1e6, "M");
  else if (v >= 1e3) s = short(v / 1e3, "K");
  else s = String(Math.round(v));
  return s + " views";
}
const thumbUrl = (id) => "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";
// One entry of a videos.list answer; null when it cannot be played inside the app
function mapVideo(v) {
  if (!v || typeof v.id !== "string" || !ID_RE.test(v.id)) return null;
  const sn = v.snippet || {}, cd = v.contentDetails || {}, st = v.statistics || {}, ss = v.status || {};
  if (ss.embeddable === false || ss.privacyStatus === "private") return null;
  const live = sn.liveBroadcastContent === "live", upcoming = sn.liveBroadcastContent === "upcoming";
  return {
    id: v.id,
    title: clean(sn.title, 140),
    channel: clean(sn.channelTitle, 80),
    thumb: thumbUrl(v.id),
    duration: live || upcoming ? "" : formatDuration(cd.duration),
    views: live || upcoming ? "" : formatViews(st.viewCount),
    badge: live ? "LIVE" : upcoming ? "UPCOMING" : "",
    published: typeof sn.publishedAt === "string" ? sn.publishedAt.slice(0, 30) : "",
  };
}
// A search result without the extra details (used if the details call fails)
function mapSnippet(x) {
  const id = x && x.id && x.id.videoId, sn = (x && x.snippet) || {};
  if (typeof id !== "string" || !ID_RE.test(id)) return null;
  const live = sn.liveBroadcastContent === "live", upcoming = sn.liveBroadcastContent === "upcoming";
  return { id, title: clean(sn.title, 140), channel: clean(sn.channelTitle, 80), thumb: thumbUrl(id), duration: "", views: "", badge: live ? "LIVE" : upcoming ? "UPCOMING" : "", published: typeof sn.publishedAt === "string" ? sn.publishedAt.slice(0, 30) : "" };
}
const one = (v) => (Array.isArray(v) ? v[0] : v);
function normalizeQuery(q) {
  return String(one(q) == null ? "" : one(q)).replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
function parseIds(v) {
  const raw = Array.isArray(v) ? v.join(",") : String(v == null ? "" : v);
  const out = [];
  for (const p of raw.split(",")) { const id = p.trim(); if (ID_RE.test(id) && !out.includes(id)) out.push(id); }
  return out.slice(0, 20);
}

// ---- the service ----
// opts (all optional, mostly for tests): key, region, safeSearch, fetchJson(host, path) -> { status, body }, now()
function createYouTube(opts) {
  opts = opts || {};
  const getKey = () => String(opts.key !== undefined ? opts.key : process.env.YOUTUBE_API_KEY || "").trim();
  const fetchJson = opts.fetchJson || makeFetcher();
  const now = opts.now || Date.now;
  const envRegion = String(opts.region || process.env.YOUTUBE_REGION || "");
  const defaultRegion = REGION_RE.test(envRegion) ? envRegion.toUpperCase() : "NG";
  const safeEnv = String(opts.safeSearch || process.env.YOUTUBE_SAFE_SEARCH || "").toLowerCase();
  const safe = ["none", "moderate", "strict"].includes(safeEnv) ? safeEnv : "moderate";
  const cache = new Map(), inflight = new Map(), items = new Map(), logged = new Map();
  const restUntil = { search: 0, list: 0 };

  const enabled = () => !!getKey();
  const regionOf = (r) => { r = one(r); return typeof r === "string" && REGION_RE.test(r) ? r.toUpperCase() : defaultRegion; };
  const remember = (map, k, v, max) => { map.delete(k); map.set(k, v); if (map.size > max) map.delete(map.keys().next().value); };

  // answers the same question from memory for a while; two people asking at once share one call to Google
  function cached(k, ttl, make) {
    const hit = cache.get(k);
    if (hit && now() - hit.at < ttl) return Promise.resolve(hit.data);
    if (inflight.has(k)) return inflight.get(k);
    const p = make().then((data) => { remember(cache, k, { at: now(), data }, CACHE_MAX); return data; }).finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
  }
  // one line in the log per kind of trouble every 5 minutes; never the address (it contains the key)
  function note(err, status, body) {
    const t = now();
    if (t - (logged.get(err.code) || 0) < 300000) return;
    logged.set(err.code, t);
    const e = body && body.error, first = e && Array.isArray(e.errors) ? e.errors[0] : null;
    const why = (first && first.reason) || (e && e.status) || "";
    console.warn("[youtube] " + err.code + " (HTTP " + status + (why ? ", " + why : "") + ")" +
      (err.code === "key" ? ": check YOUTUBE_API_KEY (YouTube Data API v3 must be enabled for it, and the key must not be limited to websites)" : ""));
  }
  // bucket "search" is Google's separate search allowance, "list" is everything else
  async function api(bucket, resource, params) {
    const key = getKey();
    if (!key) throw new YtError("not_configured", "YouTube search is not set up yet");
    if (restUntil[bucket] > now()) throw new YtError("quota", "YouTube limit reached");
    const qs = Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== "").map((k) => k + "=" + encodeURIComponent(params[k])).join("&");
    let r;
    try { r = await fetchJson(API_HOST, "/youtube/v3/" + resource + "?" + qs + "&key=" + encodeURIComponent(key)); }
    catch (e) { throw e instanceof YtError ? e : new YtError("unavailable", "YouTube is not answering right now"); }
    if (r && r.status >= 200 && r.status < 300 && r.body && typeof r.body === "object") return r.body;
    const err = googleError(r ? r.status : 0, r && r.body);
    if (err.code === "quota") restUntil[bucket] = now() + COOLDOWN_MS;
    note(err, r ? r.status : 0, r && r.body);
    throw err;
  }

  // details of up to 50 videos in one call; videos that cannot be played in the app are left out
  async function videos(ids) {
    const want = [];
    for (const id of ids || []) if (typeof id === "string" && ID_RE.test(id) && !want.includes(id)) want.push(id);
    const have = new Map(), missing = [];
    for (const id of want.slice(0, 50)) {
      const h = items.get(id);
      if (h && now() - h.at < h.ttl) have.set(id, h.item); else missing.push(id);
    }
    if (missing.length) {
      const body = await api("list", "videos", { part: PARTS, id: missing.join(","), maxResults: String(missing.length) });
      const got = new Map();
      for (const v of Array.isArray(body.items) ? body.items : []) { const m = mapVideo(v); if (m) got.set(m.id, m); }
      for (const id of missing) {
        const item = got.get(id) || null;
        remember(items, id, { at: now(), ttl: item ? VIDEO_TTL : MISS_TTL, item }, ITEM_MAX);
        if (item) have.set(id, item);
      }
    }
    return want.slice(0, 50).map((id) => have.get(id)).filter(Boolean);
  }

  async function search(q, o) {
    o = o || {};
    const query = normalizeQuery(q);
    if (!query) throw new YtError("bad_request", "Type something to search for");
    const page = one(o.pageToken) ? String(one(o.pageToken)) : "";
    if (page && !TOKEN_RE.test(page)) throw new YtError("bad_request", "That page of results is not available");
    const region = regionOf(o.region);
    return cached("s|" + region + "|" + query.toLowerCase() + "|" + page, SEARCH_TTL, async () => {
      const body = await api("search", "search", { part: "snippet", type: "video", q: query, maxResults: String(PAGE_SIZE), videoEmbeddable: "true", videoSyndicated: "true", safeSearch: safe, regionCode: region, pageToken: page });
      const found = (Array.isArray(body.items) ? body.items : []).filter((x) => x && x.id && typeof x.id.videoId === "string" && ID_RE.test(x.id.videoId));
      let list;
      try { list = await videos(found.map((x) => x.id.videoId)); }
      catch (e) { list = found.map(mapSnippet).filter(Boolean); } // the details are a bonus: the plain results are still useful
      const next = typeof body.nextPageToken === "string" && TOKEN_RE.test(body.nextPageToken) ? body.nextPageToken : "";
      return { items: list, nextPageToken: next };
    });
  }

  async function trending(region) {
    const r = regionOf(region);
    return cached("t|" + r, LIST_TTL, async () => {
      let used = r, body;
      try { body = await api("list", "videos", { part: PARTS, chart: "mostPopular", regionCode: r, maxResults: "20" }); }
      catch (e) {
        if (e.code !== "bad_request" || r === defaultRegion) throw e;
        used = defaultRegion; // a country YouTube does not know: show the default country instead
        body = await api("list", "videos", { part: PARTS, chart: "mostPopular", regionCode: used, maxResults: "20" });
      }
      const list = [];
      for (const v of Array.isArray(body.items) ? body.items : []) {
        const m = mapVideo(v);
        if (!m) continue;
        remember(items, m.id, { at: now(), ttl: VIDEO_TTL, item: m }, ITEM_MAX);
        list.push(m);
      }
      return { region: used, items: list };
    });
  }

  // title and picture only, from YouTube's free oEmbed service (no key, no quota)
  async function basic(ids) {
    const out = [];
    for (const id of (ids || []).slice(0, 5)) {
      try {
        const r = await fetchJson(OEMBED_HOST, "/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id));
        if (r && r.status === 200 && r.body && typeof r.body.title === "string") {
          out.push({ id, title: clean(r.body.title, 140), channel: clean(r.body.author_name, 80), thumb: thumbUrl(id), duration: "", views: "", badge: "", published: "" });
        }
      } catch (e) { /* this one is skipped */ }
    }
    return out;
  }
  // full details when a key works, otherwise (or if YouTube's quota is used up) the plain title and picture
  async function details(ids) {
    if (enabled()) {
      try { const l = await videos(ids); if (l.length) return l; }
      catch (e) { if (e.code === "bad_request") throw e; }
    }
    return basic(ids);
  }
  return { enabled, region: () => defaultRegion, search, trending, videos, details, basic };
}

// ---- routes ----
function sendError(res, e) {
  const code = e && e.code;
  if (code === "bad_request") return res.status(400).json({ error: e.message });
  if (code === "not_found") return res.status(404).json({ error: e.message });
  if (code === "quota") { res.setHeader("Retry-After", "900"); return res.status(429).json({ error: "YouTube search has reached its limit for now. Paste a YouTube link instead, or try again later." }); }
  if (code === "not_configured" || code === "key") return res.status(501).json({ error: "YouTube search is not set up yet" });
  return res.status(500).json({ error: "YouTube is not answering right now. Try again in a moment." });
}
// deps = { authMiddleware, rateLimit } from server.js; opts as for createYouTube
function attach(app, deps, opts) {
  const yt = createYouTube(opts);
  const light = deps.rateLimit({ windowMs: 60000, max: 60 });
  const heavy = deps.rateLimit({ windowMs: 60000, max: 12 });
  const route = (name, limiter, handler) => app.get(["/api/youtube/" + name, "/api/v1/youtube/" + name], deps.authMiddleware, limiter, async (req, res) => {
    try { await handler(req, res); } catch (e) { sendError(res, e); }
  });
  const reply = (res, data, seconds) => { res.set("Cache-Control", "private, max-age=" + seconds); res.json(data); };
  route("status", light, (req, res) => reply(res, { enabled: yt.enabled(), region: yt.region() }, 60));
  route("search", heavy, async (req, res) => reply(res, await yt.search(req.query.q, { pageToken: req.query.pageToken, region: req.query.region }), 300));
  route("trending", light, async (req, res) => reply(res, await yt.trending(req.query.region), 300));
  route("video", light, async (req, res) => {
    const ids = parseIds(req.query.id !== undefined ? req.query.id : req.query.ids);
    if (!ids.length) throw new YtError("bad_request", "A YouTube video id is required");
    const list = await yt.details(ids);
    if (!list.length) throw new YtError("not_found", "That video is not available");
    reply(res, { items: list }, 300);
  });
  console.log("[youtube] API ready: " + (yt.enabled() ? "search, trending and video details are on" : "no YOUTUBE_API_KEY, so search is off (links, previews and the player still work)"));
  return yt;
}

module.exports = { attach, createYouTube, makeFetcher, googleError, mapVideo, formatDuration, formatViews, normalizeQuery, parseIds, YtError };
