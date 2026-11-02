"use strict";
/*
 * Letschat link previews v2 (see LINK-PREVIEWS.md).
 * Answers GET /api/link-preview?url=... (and /api/v1/link-preview) with { preview: { url, title, description, image, site } | null },
 * the same shape the app already shows, so no app update or new APK is needed.
 *
 *  - YouTube, Vimeo, TikTok, Spotify and SoundCloud links use the site's own free oEmbed service (no API key). That is far more
 *    reliable than reading their web pages. YouTube falls back to the video thumbnail if oEmbed cannot be reached.
 *  - Every other link: the server fetches the page and reads its Open Graph / Twitter / standard tags (any text encoding).
 *  - Direct links to pictures and PDFs get a simple card. Login, consent and "checking your browser" pages get no card.
 *  - Only the server contacts the site, never the phone. Private and internal addresses are refused when connecting, so redirects
 *    and DNS tricks cannot reach them. Pages are size and time limited. Good results are cached 6 hours, failures 2 minutes.
 */
const http = require("http");
const https = require("https");
const dns = require("dns");
const net = require("net");

const UA = "Mozilla/5.0 (compatible; LetschatLinkPreview/2.0; +https://letschat-taupe.vercel.app)";
const TOTAL_MS = 8000; // the whole lookup, redirects included
const MAX_HOPS = 4;
const MAX_HTML = 300000;
const MAX_JSON = 100000;
const OK_TTL = 6 * 3600 * 1000;
const MISS_TTL = 2 * 60 * 1000;
const CACHE_MAX = 1000;
const OK_PORTS = new Set(["", "80", "443", "8080", "8443"]);
const IMAGE_RE = /^image\/(png|jpe?g|gif|webp|avif|bmp)\b/i;
const WALL_RE = /(^|\/)(login|log-in|signin|sign-in|checkpoint|consent|authwall)(\/|$|\.)/i;
const BAD_TITLE_RE = /^(just a moment|attention required|access denied|403 forbidden|404 not found|are you a robot|please wait|one moment|checking your browser)/i;
const PAGE_ACCEPT = "text/html,application/xhtml+xml;q=0.9,image/*;q=0.5,application/pdf;q=0.5,*/*;q=0.1";

// ---- safety: which addresses the server may connect to ----
const blocked = new net.BlockList();
for (const [a, p] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4]]) blocked.addSubnet(a, p, "ipv4");
for (const [a, p] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96], ["2002::", 16]]) blocked.addSubnet(a, p, "ipv6");

function isBlockedAddress(addr) {
  const a = String(addr || "").replace(/^\[|\]$/g, "").split("%")[0];
  const kind = net.isIP(a);
  if (!kind) return true;
  return blocked.check(a, kind === 4 ? "ipv4" : "ipv6"); // IPv4-mapped IPv6 (::ffff:10.0.0.1) is checked as IPv4 too
}
function makeLookup(allowPrivate) {
  return function safeLookup(hostname, opts, cb) {
    if (typeof opts === "function") { cb = opts; opts = {}; }
    dns.lookup(hostname, { all: true }, (err, addrs) => {
      if (err) return cb(err);
      if (!addrs.length || (!allowPrivate && addrs.some((x) => isBlockedAddress(x.address)))) return cb(new Error("blocked address"));
      if (opts && opts.all) return cb(null, addrs);
      cb(null, addrs[0].address, addrs[0].family);
    });
  };
}

// ---- fetching ----
// Resolves { status, headers, url, body } for the final (non-redirect) answer, whatever its status. Rejects on network trouble.
function request(urlStr, o) {
  o = o || {};
  const deadline = o.deadline || Date.now() + TOTAL_MS;
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch (e) { return reject(new Error("bad url")); }
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return reject(new Error("bad url"));
    if (!o.allowPrivate && !OK_PORTS.has(u.port)) return reject(new Error("bad port"));
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (!o.allowPrivate) {
      if (/^localhost$|\.(local|internal|localdomain|localhost)$/i.test(host)) return reject(new Error("blocked address"));
      if (net.isIP(host) && isBlockedAddress(host)) return reject(new Error("blocked address"));
    }
    const left = deadline - Date.now();
    if (left <= 0) return reject(new Error("timeout"));
    let done = false, timer;
    const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); fn(v); } };
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(u, { lookup: makeLookup(!!o.allowPrivate), headers: { "User-Agent": UA, Accept: o.accept || "*/*", "Accept-Language": "en" } }, (res) => {
      const code = res.statusCode || 0, headers = res.headers;
      if (code >= 300 && code < 400 && headers.location) {
        res.resume();
        clearTimeout(timer); // the next hop keeps the shared deadline
        if ((o.hops || 0) >= MAX_HOPS) return finish(reject, new Error("too many redirects"));
        let next; try { next = new URL(headers.location, u).href; } catch (e) { return finish(reject, new Error("bad redirect")); }
        return request(next, Object.assign({}, o, { hops: (o.hops || 0) + 1, deadline })).then((r) => finish(resolve, r), (e) => finish(reject, e));
      }
      const result = (body) => ({ status: code, headers, url: u.href, body });
      if (o.skipBody && o.skipBody(code, headers)) { res.on("error", () => {}); res.destroy(); return finish(resolve, result(Buffer.alloc(0))); }
      const chunks = []; let size = 0;
      res.on("data", (chunk) => {
        if (done) return;
        chunks.push(chunk); size += chunk.length;
        let stop = size >= (o.maxBytes || MAX_HTML);
        if (!stop && o.stopAtHead) stop = /<\/head\s*>/i.test(Buffer.concat(chunks.slice(-2)).toString("latin1"));
        if (stop) { res.destroy(); finish(resolve, result(Buffer.concat(chunks))); }
      });
      res.on("end", () => finish(resolve, result(Buffer.concat(chunks))));
      res.on("error", () => (chunks.length ? finish(resolve, result(Buffer.concat(chunks))) : finish(reject, new Error("read error"))));
    });
    timer = setTimeout(() => { req.destroy(); finish(reject, new Error("timeout")); }, left);
    req.on("error", (e) => finish(reject, e));
  });
}

// ---- reading text ----
function charsetOf(headers, buf) {
  let m = /charset\s*=\s*["']?([\w.:-]+)/i.exec(String(headers["content-type"] || ""));
  if (!m) {
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return "utf-8";
    if (buf[0] === 0xFF && buf[1] === 0xFE) return "utf-16le";
    if (buf[0] === 0xFE && buf[1] === 0xFF) return "utf-16be";
    m = /<meta[^>]+charset\s*=\s*["']?\s*([\w.:-]+)/i.exec(buf.subarray(0, 4096).toString("latin1"));
  }
  return m ? m[1].toLowerCase() : "utf-8";
}
function decode(buf, headers) {
  try { return new TextDecoder(charsetOf(headers || {}, buf)).decode(buf); } catch (e) { return buf.toString("utf8"); }
}
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "\u2026", ndash: "\u2013", mdash: "\u2014", lsquo: "\u2018", rsquo: "\u2019",
  ldquo: "\u201C", rdquo: "\u201D", copy: "\u00A9", reg: "\u00AE", trade: "\u2122", middot: "\u00B7", bull: "\u2022", euro: "\u20AC", pound: "\u00A3", laquo: "\u00AB", raquo: "\u00BB" };
function decodeEntities(t) {
  return String(t == null ? "" : t).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 && !(n >= 0xD800 && n <= 0xDFFF) ? String.fromCodePoint(n) : m;
    }
    const r = NAMED[e.toLowerCase()];
    return r !== undefined ? r : m;
  }).replace(/[\u0000-\u001F\u007F\s]+/g, " ").trim();
}
function attr(tag, name) {
  const m = new RegExp("[\\s\"']" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'>]+))", "i").exec(tag);
  return m ? (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]) : null;
}
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
function fileName(u) { try { return decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "").slice(0, 100); } catch (e) { return ""; } }
// A picture address the app can show: absolute, https only (the Android app blocks plain http pictures)
function absoluteImage(src, base) {
  if (!src) return "";
  try { const u = new URL(src, base); if (u.protocol === "http:") u.protocol = "https:"; return u.protocol === "https:" ? u.href : ""; } catch (e) { return ""; }
}

// Title, description, picture and site name of an HTML page; null when it has neither title nor description.
function parseHtml(html, pageUrl) {
  const head = String(html || "").slice(0, 250000), meta = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const k = attr(tag, "property") || attr(tag, "name"), c = attr(tag, "content");
    if (k && c !== null) { const key = k.toLowerCase(); if (!(key in meta)) meta[key] = decodeEntities(c); }
  }
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const title = (meta["og:title"] || meta["twitter:title"] || (t && decodeEntities(t[1])) || "").slice(0, 140);
  const description = (meta["og:description"] || meta["twitter:description"] || meta.description || "").slice(0, 240);
  let image = meta["og:image:secure_url"] || meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || meta["twitter:image:src"] || "";
  if (!image) {
    const link = (head.match(/<link\b[^>]*>/gi) || []).find((x) => /\brel\s*=\s*["']?image_src\b/i.test(x));
    if (link) image = decodeEntities(attr(link, "href") || "");
  }
  const site = (meta["og:site_name"] || hostOf(pageUrl)).slice(0, 60);
  return title || description ? { url: pageUrl, title, description, image: absoluteImage(image, pageUrl), site } : null;
}

// ---- sites with a free oEmbed service ----
const YT_HOST = /^(?:(?:www|m|music)\.)?(?:youtube\.com|youtube-nocookie\.com)$/i;
function youtubeTarget(u) {
  const host = u.hostname.toLowerCase(), path = u.pathname.split("/").filter(Boolean);
  let id = "";
  if (host === "youtu.be") id = path[0] || "";
  else if (YT_HOST.test(host)) {
    const first = path[0] || "";
    if (first === "watch") id = u.searchParams.get("v") || "";
    else if (first === "shorts" || first === "embed" || first === "live" || first === "v") id = path[1] || "";
    else if (first === "playlist") { const l = u.searchParams.get("list") || ""; return /^[\w-]{10,60}$/.test(l) ? { target: "https://www.youtube.com/playlist?list=" + l } : null; }
    else return null; // channels, search, the home page...
  } else return null;
  return /^[\w-]{11}$/.test(id) ? { target: "https://www.youtube.com/watch?v=" + id, id } : null;
}
function vimeoTarget(u) {
  const host = u.hostname.toLowerCase().replace(/^www\./, ""), path = u.pathname.split("/").filter(Boolean);
  if (host === "vimeo.com") { const id = path.find((p) => /^\d{5,12}$/.test(p)); return id ? { target: "https://vimeo.com/" + id } : null; }
  if (host === "player.vimeo.com" && path[0] === "video" && /^\d{5,12}$/.test(path[1] || "")) return { target: "https://vimeo.com/" + path[1] };
  return null;
}
function tiktokTarget(u) {
  const m = /^\/@([\w.-]{1,40})\/video\/(\d{8,25})\/?$/.exec(u.pathname);
  return m && /^(?:(?:www|m)\.)?tiktok\.com$/i.test(u.hostname) ? { target: "https://www.tiktok.com/@" + m[1] + "/video/" + m[2] } : null;
}
function spotifyTarget(u) {
  const m = /^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,30})\/?$/.exec(u.pathname);
  return m && u.hostname.toLowerCase() === "open.spotify.com" ? { target: "https://open.spotify.com/" + m[1] + "/" + m[2] } : null;
}
function soundcloudTarget(u) {
  const path = u.pathname.split("/").filter(Boolean);
  const ok = /^(?:(?:www|m)\.)?soundcloud\.com$/i.test(u.hostname) && path.length >= 2 && path.length <= 4 &&
    !["discover", "stream", "you", "search", "upload", "pages", "charts", "popular"].includes(path[0].toLowerCase());
  return ok ? { target: "https://soundcloud.com/" + path.join("/") } : null;
}
const PROVIDERS = [
  { key: "youtube", site: "YouTube", base: "https://www.youtube.com/oembed", extra: "format=json", match: youtubeTarget,
    fallback: (raw, t) => (t.id ? { url: raw, title: "YouTube video", description: "", image: "https://i.ytimg.com/vi/" + t.id + "/hqdefault.jpg", site: "YouTube" } : null) },
  { key: "vimeo", site: "Vimeo", base: "https://vimeo.com/api/oembed.json", extra: "", match: vimeoTarget },
  { key: "tiktok", site: "TikTok", base: "https://www.tiktok.com/oembed", extra: "", match: tiktokTarget },
  { key: "spotify", site: "Spotify", base: "https://open.spotify.com/oembed", extra: "", match: spotifyTarget },
  { key: "soundcloud", site: "SoundCloud", base: "https://soundcloud.com/oembed", extra: "format=json", match: soundcloudTarget },
];
function matchProvider(raw) {
  let u; try { u = new URL(raw); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  for (const prov of PROVIDERS) { const t = prov.match(u); if (t) return { prov, t }; }
  return null;
}
function oembedUrl(prov, target, base) {
  return (base || prov.base) + "?" + (prov.extra ? prov.extra + "&" : "") + "url=" + encodeURIComponent(target);
}
function fromOembed(prov, raw, j, t) {
  if (!j || typeof j !== "object") return null;
  const title = decodeEntities(typeof j.title === "string" ? j.title : "").slice(0, 140);
  if (!title) return null;
  const author = decodeEntities(typeof j.author_name === "string" ? j.author_name : "").slice(0, 80);
  let image = typeof j.thumbnail_url === "string" ? absoluteImage(j.thumbnail_url, raw) : "";
  if (!image && t.id) image = "https://i.ytimg.com/vi/" + t.id + "/hqdefault.jpg";
  return { url: raw, title, description: author, image, site: prov.site };
}

// ---- the previewer ----
// opts (all optional, mostly for tests): allowPrivate, endpoints { youtube: baseUrl, ... }, request (replacement for the network function)
function createPreviewer(opts) {
  opts = opts || {};
  const net_ = opts.request || request;
  const cache = new Map(), inflight = new Map();
  const remember = (raw, data) => {
    cache.delete(raw);
    cache.set(raw, { at: Date.now(), ttl: data ? OK_TTL : MISS_TTL, data });
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  };

  async function page(raw) {
    const r = await net_(raw, { accept: PAGE_ACCEPT, maxBytes: MAX_HTML, stopAtHead: true, allowPrivate: opts.allowPrivate,
      skipBody: (code, h) => code >= 200 && code < 300 && !/html/i.test(String(h["content-type"] || "")) });
    if (r.status < 200 || r.status >= 300) return null;
    const type = String(r.headers["content-type"] || ""), final = new URL(r.url);
    if (/^(consent|accounts)\./i.test(final.hostname) || WALL_RE.test(final.pathname)) return null;
    if (IMAGE_RE.test(type)) return { url: r.url, title: fileName(final) || hostOf(r.url), description: "", image: absoluteImage(r.url, r.url), site: hostOf(r.url) };
    if (/application\/pdf/i.test(type)) return { url: r.url, title: fileName(final) || "PDF document", description: "PDF document", image: "", site: hostOf(r.url) };
    if (!/html/i.test(type)) return null;
    const p = parseHtml(decode(r.body, r.headers), r.url);
    return p && !BAD_TITLE_RE.test(p.title) ? p : null;
  }

  async function build(raw) {
    const m = matchProvider(raw);
    let gone = false;
    if (m) {
      try {
        const r = await net_(oembedUrl(m.prov, m.t.target, opts.endpoints && opts.endpoints[m.prov.key]), { accept: "application/json", maxBytes: MAX_JSON, allowPrivate: opts.allowPrivate });
        if (r.status === 200) { const p = fromOembed(m.prov, raw, JSON.parse(decode(r.body, r.headers)), m.t); if (p) return p; }
        else if (r.status === 404) gone = true; // removed or private: no card
      } catch (e) { /* oEmbed unreachable or not JSON: read the page itself */ }
    }
    if (gone) return null;
    let p = null;
    try { p = await page(raw); } catch (e) { p = null; }
    return p || (m && m.prov.fallback ? m.prov.fallback(raw, m.t) : null);
  }

  function preview(raw) {
    const hit = cache.get(raw);
    if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.data);
    if (inflight.has(raw)) return inflight.get(raw);
    const p = build(raw).catch(() => null).then((data) => { remember(raw, data); return data; }).finally(() => inflight.delete(raw));
    inflight.set(raw, p);
    return p;
  }
  return { preview };
}

// Registers the route. deps = { authMiddleware, rateLimit } from server.js
function attach(app, deps, opts) {
  const previewer = createPreviewer(opts);
  const limiter = deps.rateLimit({ windowMs: 60000, max: 40 });
  app.get(["/api/link-preview", "/api/v1/link-preview"], deps.authMiddleware, limiter, async (req, res) => {
    const raw = String(req.query.url || "").trim().slice(0, 2000);
    if (!/^https?:\/\/[^\s]+$/i.test(raw)) return res.status(400).json({ error: "A web link is required" });
    let data = null;
    try { data = await previewer.preview(raw); } catch (e) { data = null; }
    res.set("Cache-Control", "private, max-age=300");
    res.json({ preview: data || null });
  });
  console.log("[link-preview] v2 active: YouTube/Vimeo/TikTok/Spotify/SoundCloud cards and safer page previews");
}

module.exports = { attach, createPreviewer, parseHtml, matchProvider, isBlockedAddress, makeLookup, decodeEntities, request };
