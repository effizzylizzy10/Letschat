"use strict";
// Run with:  node --test youtube-api.test.js   (Node 18 or newer; no network and no YouTube key needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const Y = require("./youtube-api");

const KEY = "SECRET-KEY-123";
const V1 = "dQw4w9WgXcQ", V2 = "9bZkp7q19f0", V3 = "kJQP7kiw5Fk";

// A fake Google: routes = [[regexForHostAndPath, response | Error | function(path)]]
function fakeGoogle(routes) {
  const calls = [];
  const fn = async (host, path) => {
    calls.push({ host, path });
    for (const [re, resp] of routes) {
      if (!re.test(host + path)) continue;
      if (resp instanceof Error) throw resp;
      return Object.assign({ status: 200, body: {} }, typeof resp === "function" ? resp(path) : resp);
    }
    throw new Error("unexpected request " + host + path);
  };
  fn.calls = calls;
  return fn;
}
const searchBody = (ids, next) => ({
  nextPageToken: next,
  items: ids.map((id) => ({ id: { kind: "youtube#video", videoId: id }, snippet: { title: "Tom &amp; Jerry &#39;" + id + "&#39;", channelTitle: "Chan &amp; Co", publishedAt: "2020-01-02T03:04:05Z", liveBroadcastContent: "none" } })),
});
const videoItem = (id, extra) => Object.assign({
  id, snippet: { title: "Video " + id, channelTitle: "Channel", publishedAt: "2020-01-02T03:04:05Z", liveBroadcastContent: "none" },
  contentDetails: { duration: "PT3M33S" }, statistics: { viewCount: "1234567" }, status: { embeddable: true, privacyStatus: "public" },
}, extra || {});
const googleError = (status, reason, message) => ({ status, body: { error: { code: status, message: message || "error", errors: [{ reason }] } } });
const SEARCH = /googleapis\.com\/youtube\/v3\/search\?/, VIDEOS = /googleapis\.com\/youtube\/v3\/videos\?/, OEMBED = /youtube\.com\/oembed\?/;

function quiet(fn) { // keeps the test output clean: the module logs one line when it starts or meets trouble
  const log = console.log, warn = console.warn, lines = [];
  console.log = () => {}; console.warn = (m) => lines.push(String(m));
  const done = () => { console.log = log; console.warn = warn; };
  try { const r = fn(); if (r && r.then) return r.then((v) => { done(); return [v, lines]; }, (e) => { done(); throw e; }); done(); return [r, lines]; }
  catch (e) { done(); throw e; }
}

test("durations and view counts are short and readable", () => {
  const d = [["PT3M33S", "3:33"], ["PT1H2M3S", "1:02:03"], ["PT45S", "0:45"], ["PT1H", "1:00:00"], ["P1DT1H", "25:00:00"], ["P0D", ""], ["PT0S", ""], ["", ""], ["nonsense", ""], [undefined, ""]];
  for (const [i, o] of d) assert.equal(Y.formatDuration(i), o, String(i));
  const v = [["1", "1 view"], ["0", "0 views"], ["999", "999 views"], ["1000", "1K views"], ["1234", "1.2K views"], ["15500", "16K views"], ["1234567", "1.2M views"],
    ["25000000", "25M views"], ["3200000000", "3.2B views"], ["", ""], [undefined, ""], ["abc", ""], ["-5", ""]];
  for (const [i, o] of v) assert.equal(Y.formatViews(i), o, String(i));
});

test("a video answer becomes the small shape the app uses", () => {
  const m = Y.mapVideo(videoItem(V1, { snippet: { title: "Tom &amp; Jerry &quot;live&quot; &#39;x&#39;", channelTitle: "A &lt;b&gt;", liveBroadcastContent: "none", publishedAt: "2020-01-02T03:04:05Z" } }));
  assert.deepEqual(m, { id: V1, title: "Tom & Jerry \"live\" 'x'", channel: "A <b>", thumb: "https://i.ytimg.com/vi/" + V1 + "/mqdefault.jpg", duration: "3:33", views: "1.2M views", badge: "", published: "2020-01-02T03:04:05Z" });
  const live = Y.mapVideo(videoItem(V1, { snippet: { title: "t", channelTitle: "c", liveBroadcastContent: "live" } }));
  assert.equal(live.badge, "LIVE"); assert.equal(live.duration, ""); assert.equal(live.views, "");
  assert.equal(Y.mapVideo(videoItem(V1, { snippet: { title: "t", channelTitle: "c", liveBroadcastContent: "upcoming" } })).badge, "UPCOMING");
  assert.equal(Y.mapVideo(videoItem(V1, { status: { embeddable: false } })), null, "a video that cannot be embedded cannot play in the app");
  assert.equal(Y.mapVideo(videoItem(V1, { status: { privacyStatus: "private" } })), null);
  assert.equal(Y.mapVideo(videoItem("short")), null);
  assert.equal(Y.mapVideo(null), null);
  assert.equal(Y.mapVideo(videoItem(V1, { statistics: {} })).views, "", "hidden view counts stay empty");
});

test("search words and video ids are cleaned up", () => {
  assert.equal(Y.normalizeQuery("  Afro\tbeats \n mix  "), "Afro beats mix");
  assert.equal(Y.normalizeQuery(["a b", "c"]), "a b");
  assert.equal(Y.normalizeQuery(undefined), "");
  assert.equal(Y.normalizeQuery("x".repeat(300)).length, 100);
  assert.deepEqual(Y.parseIds(V1 + "," + V2 + ",bad," + V1 + " , "), [V1, V2]);
  assert.deepEqual(Y.parseIds([V1, V2]), [V1, V2]);
  assert.deepEqual(Y.parseIds(undefined), []);
  assert.equal(Y.parseIds(Array.from({ length: 30 }, (_, i) => "abcdefghi" + (i < 10 ? "0" : "") + i).join(",")).length, 20);
});

test("without a key nothing is called and search says it is not set up", async () => {
  const net = fakeGoogle([]);
  const yt = Y.createYouTube({ key: "", fetchJson: net });
  assert.equal(yt.enabled(), false);
  await assert.rejects(() => yt.search("afrobeats"), (e) => e.code === "not_configured");
  await assert.rejects(() => yt.trending("NG"), (e) => e.code === "not_configured");
  assert.equal(net.calls.length, 0);
});

test("search: asks for embeddable videos, adds the details, hides the key", async () => {
  const net = fakeGoogle([[SEARCH, { body: searchBody([V1, V2], "CAwQAA") }], [VIDEOS, { body: { items: [videoItem(V1), videoItem(V2)] } }]]);
  const yt = Y.createYouTube({ key: KEY, fetchJson: net, region: "ng" });
  const r = await yt.search("  afrobeats   mix ");
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].id, V1); assert.equal(r.items[0].duration, "3:33"); assert.equal(r.items[0].views, "1.2M views");
  assert.equal(r.nextPageToken, "CAwQAA");
  const s = net.calls[0].path;
  assert.equal(net.calls[0].host, "www.googleapis.com");
  for (const part of ["type=video", "videoEmbeddable=true", "videoSyndicated=true", "regionCode=NG", "q=afrobeats%20mix", "safeSearch=moderate", "maxResults=12", "key=" + KEY]) assert.ok(s.includes(part), part + " in " + s);
  assert.ok(net.calls[1].path.includes("id=" + V1 + "%2C" + V2) && net.calls[1].path.includes("part=snippet%2CcontentDetails%2Cstatistics%2Cstatus"));
  assert.ok(!JSON.stringify(r).includes(KEY), "the key never reaches the answer");
});

test("search: the same words are answered from memory, other words and other pages are not", async () => {
  const net = fakeGoogle([[SEARCH, { body: searchBody([V1], "NEXT1") }], [VIDEOS, { body: { items: [videoItem(V1)] } }]]);
  const yt = Y.createYouTube({ key: KEY, fetchJson: net });
  await yt.search("afrobeats mix");
  const n = net.calls.length;
  await yt.search("AFROBEATS   Mix");
  assert.equal(net.calls.length, n, "same words, different spelling of spaces and capitals: no new call");
  await yt.search("afrobeats mix", { pageToken: "NEXT1" });
  assert.ok(net.calls.length > n, "another page is a new question");
  assert.ok(net.calls.some((c) => c.path.includes("pageToken=NEXT1")));
  const m = net.calls.length;
  await yt.search("something else");
  assert.ok(net.calls.length > m);
});

test("search: two people asking at the same moment share one call", async () => {
  let release; const gate = new Promise((r) => { release = r; });
  let searches = 0;
  const net = async (host, path) => {
    if (/search\?/.test(path)) { searches++; await gate; return { status: 200, body: searchBody([V1]) }; }
    return { status: 200, body: { items: [videoItem(V1)] } };
  };
  const yt = Y.createYouTube({ key: KEY, fetchJson: net });
  const a = yt.search("same words"), b = yt.search("same words");
  release();
  const [x, y] = await Promise.all([a, b]);
  assert.equal(searches, 1);
  assert.deepEqual(x, y);
});

test("search: videos that cannot be embedded are left out, and results survive a failing details call", async () => {
  let net = fakeGoogle([[SEARCH, { body: searchBody([V1, V2, V3]) }], [VIDEOS, { body: { items: [videoItem(V1), videoItem(V2, { status: { embeddable: false } }), videoItem(V3)] } }]]);
  let r = await Y.createYouTube({ key: KEY, fetchJson: net }).search("a");
  assert.deepEqual(r.items.map((x) => x.id), [V1, V3]);
  net = fakeGoogle([[SEARCH, { body: searchBody([V1, V2]) }], [VIDEOS, { status: 500, body: { error: { code: 500 } } }]]);
  r = await Y.createYouTube({ key: KEY, fetchJson: net }).search("b");
  assert.deepEqual(r.items.map((x) => x.id), [V1, V2], "plain search results are still shown");
  assert.equal(r.items[0].title, "Tom & Jerry '" + V1 + "'");
  assert.equal(r.items[0].duration, "");
});

test("search: bad input is refused before Google is asked", async () => {
  const net = fakeGoogle([]);
  const yt = Y.createYouTube({ key: KEY, fetchJson: net });
  await assert.rejects(() => yt.search(""), (e) => e.code === "bad_request");
  await assert.rejects(() => yt.search("   "), (e) => e.code === "bad_request");
  await assert.rejects(() => yt.search("ok", { pageToken: "bad token!" }), (e) => e.code === "bad_request");
  assert.equal(net.calls.length, 0);
});

test("a used-up search allowance rests search for a while, but trending and details keep working", async () => {
  const clock = { t: 1000000 };
  const net = fakeGoogle([[SEARCH, googleError(403, "quotaExceeded")], [VIDEOS, (p) => ({ body: { items: [videoItem(V1)] } })]]);
  const [yt, lines] = await quiet(async () => {
    const y = Y.createYouTube({ key: KEY, fetchJson: net, now: () => clock.t });
    await assert.rejects(() => y.search("first"), (e) => e.code === "quota");
    const n = net.calls.length;
    await assert.rejects(() => y.search("second words"), (e) => e.code === "quota");
    assert.equal(net.calls.length, n, "no call to Google while resting");
    assert.equal((await y.trending("NG")).items.length, 1, "trending is counted apart");
    clock.t += 16 * 60 * 1000;
    await assert.rejects(() => y.search("third"), (e) => e.code === "quota");
    assert.ok(net.calls.length > n, "after the rest it asks again");
    return y;
  });
  assert.equal(lines.length, 2, "one log line for the first trouble and one after the rest, not one per request: " + lines.join(" | "));
  assert.match(lines[0], /quota/); assert.ok(!lines[0].includes(KEY));
  assert.ok(yt);
});

test("a wrong or switched-off key is reported as a key problem and never printed", async () => {
  for (const [status, reason] of [[400, "keyInvalid"], [403, "accessNotConfigured"], [403, "ipRefererBlocked"], [403, "forbidden"], [401, ""]]) {
    const net = fakeGoogle([[/./, googleError(status, reason, "API key not valid. Please pass a valid API key.")]]);
    const [err, lines] = await quiet(() => Y.createYouTube({ key: KEY, fetchJson: net }).search("x").then(() => null, (e) => e));
    assert.ok(err && err.code === "key", status + " " + reason + " -> " + (err && err.code));
    assert.ok(!err.message.includes(KEY));
    assert.equal(lines.length, 1);
    assert.match(lines[0], /check YOUTUBE_API_KEY/); assert.ok(!lines[0].includes(KEY));
  }
});

test("network trouble and server errors become 'unavailable'", async () => {
  const [a] = await quiet(() => Y.createYouTube({ key: KEY, fetchJson: fakeGoogle([[/./, new Error("ECONNRESET")]]) }).search("x").then(() => null, (e) => e));
  assert.equal(a.code, "unavailable");
  const [b] = await quiet(() => Y.createYouTube({ key: KEY, fetchJson: fakeGoogle([[/./, { status: 503, body: null }]]) }).search("y").then(() => null, (e) => e));
  assert.equal(b.code, "unavailable");
  const [c] = await quiet(() => Y.createYouTube({ key: KEY, fetchJson: fakeGoogle([[/./, { status: 200, body: null }]]) }).search("z").then(() => null, (e) => e));
  assert.equal(c.code, "unavailable", "an answer that is not JSON");
});

test("trending: shows popular videos for the country, remembers them, and falls back for a country YouTube does not know", async () => {
  const net = fakeGoogle([[VIDEOS, (p) => (/regionCode=ZZ/.test(p) ? googleError(400, "invalidRegionCode") : { body: { items: [videoItem(V1), videoItem(V2, { status: { embeddable: false } })] } })]]);
  const yt = Y.createYouTube({ key: KEY, fetchJson: net });
  const r = await yt.trending("ng");
  assert.equal(r.region, "NG"); assert.deepEqual(r.items.map((x) => x.id), [V1]);
  assert.ok(net.calls[0].path.includes("chart=mostPopular") && net.calls[0].path.includes("regionCode=NG"));
  const n = net.calls.length;
  await yt.trending("NG");
  assert.equal(net.calls.length, n, "second look comes from memory");
  const [odd] = await quiet(() => yt.trending("ZZ"));
  assert.equal(odd.region, "NG", "unknown country: the default is shown");
  assert.equal((await yt.trending("x1")).region, "NG", "not a country code: the default is used");
  assert.equal((await Y.createYouTube({ key: KEY, fetchJson: net, region: "KE" }).trending()).region, "KE", "YOUTUBE_REGION changes the default");
});

test("video details: many ids in one call, remembered, and videos that are gone are not asked about again soon", async () => {
  const clock = { t: 5000000 };
  const net = fakeGoogle([[VIDEOS, (p) => ({ body: { items: [videoItem(V1), videoItem(V2)] } })]]);
  const yt = Y.createYouTube({ key: KEY, fetchJson: net, now: () => clock.t });
  const a = await yt.videos([V1, V2, V3, V1, "bad"]);
  assert.deepEqual(a.map((x) => x.id), [V1, V2], "V3 was not returned by YouTube");
  assert.equal(net.calls.length, 1);
  assert.ok(net.calls[0].path.includes("id=" + V1 + "%2C" + V2 + "%2C" + V3));
  await yt.videos([V1, V2, V3]);
  assert.equal(net.calls.length, 1, "all three answered from memory, the missing one too");
  clock.t += 11 * 60 * 1000;
  await yt.videos([V1, V3]);
  assert.equal(net.calls.length, 2, "the missing one is asked again after 10 minutes");
  assert.ok(net.calls[1].path.includes("id=" + V3) && !net.calls[1].path.includes(V1));
});

test("details: without a key or with the quota used up, the free oEmbed title and picture are used", async () => {
  const oembed = (p) => (p.includes(V1) ? { body: { title: "Nice &amp; song", author_name: "Artist", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" } } : { status: 401, body: null });
  let net = fakeGoogle([[OEMBED, oembed]]);
  let list = await Y.createYouTube({ key: "", fetchJson: net }).details([V1, V2]);
  assert.deepEqual(list, [{ id: V1, title: "Nice & song", channel: "Artist", thumb: "https://i.ytimg.com/vi/" + V1 + "/mqdefault.jpg", duration: "", views: "", badge: "", published: "" }]);
  assert.equal(net.calls[0].host, "www.youtube.com");
  net = fakeGoogle([[VIDEOS, googleError(403, "quotaExceeded")], [OEMBED, oembed]]);
  const [l2] = await quiet(() => Y.createYouTube({ key: KEY, fetchJson: net }).details([V1]));
  assert.equal(l2[0].title, "Nice & song");
  net = fakeGoogle([[VIDEOS, googleError(400, "badRequest")]]);
  const [e3] = await quiet(() => Y.createYouTube({ key: KEY, fetchJson: net }).details([V1]).then(() => null, (e) => e));
  assert.equal(e3.code, "bad_request", "a request YouTube refuses is not hidden");
});

// ---- the routes ----
function fakeRes() {
  return { statusCode: 200, headers: {}, body: undefined, status(c) { this.statusCode = c; return this; }, set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; }, json(b) { this.body = b; return this; } };
}
function mount(opts) {
  const routes = {}, limits = [];
  const app = { get(paths, ...handlers) { for (const p of [].concat(paths)) routes[p] = handlers; } };
  const auth = function auth() {};
  const rateLimit = (o) => { limits.push(o); const f = function limiter() {}; f.opts = o; return f; };
  const [yt] = quiet(() => Y.attach(app, { authMiddleware: auth, rateLimit }, opts));
  return { routes, auth, limits, yt };
}
async function hit(m, path, query) {
  const h = m.routes[path], res = fakeRes();
  await h[h.length - 1]({ query: query || {} }, res);
  return res;
}

test("routes: four routes on both address styles, each behind sign-in and a rate limit", () => {
  const m = mount({ key: KEY, fetchJson: fakeGoogle([]) });
  for (const n of ["status", "search", "trending", "video"]) {
    for (const base of ["/api/youtube/", "/api/v1/youtube/"]) {
      const h = m.routes[base + n];
      assert.ok(h, base + n);
      assert.equal(h.length, 3, "sign-in check, rate limit, handler");
      assert.equal(h[0], m.auth);
      assert.equal(h[1].name, "limiter");
    }
  }
  assert.deepEqual(m.limits.map((l) => l.max).sort((a, b) => a - b), [12, 60], "search is limited harder than the rest");
});

test("routes: status, search, trending and video answer with the right shapes", async () => {
  const net = fakeGoogle([[SEARCH, { body: searchBody([V1], "NXT") }], [VIDEOS, { body: { items: [videoItem(V1)] } }]]);
  const m = mount({ key: KEY, fetchJson: net });
  let r = await hit(m, "/api/v1/youtube/status");
  assert.deepEqual(r.body, { enabled: true, region: "NG" }); assert.equal(r.statusCode, 200); assert.match(r.headers["cache-control"], /private/);
  r = await hit(m, "/api/v1/youtube/search", { q: "afrobeats" });
  assert.equal(r.body.items[0].id, V1); assert.equal(r.body.nextPageToken, "NXT");
  r = await hit(m, "/api/youtube/trending", { region: "NG" });
  assert.equal(r.body.region, "NG"); assert.equal(r.body.items.length, 1);
  r = await hit(m, "/api/v1/youtube/video", { id: V1 });
  assert.equal(r.body.items[0].title, "Video " + V1);
  r = await hit(m, "/api/v1/youtube/video", { ids: V1 + "," + V1 });
  assert.equal(r.body.items.length, 1);
});

test("routes: clear answers for every kind of trouble", async () => {
  let m = mount({ key: KEY, fetchJson: fakeGoogle([[SEARCH, googleError(403, "quotaExceeded")], [VIDEOS, { body: { items: [] } }], [OEMBED, { status: 404, body: null }]]) });
  let r = await hit(m, "/api/v1/youtube/search", {});
  assert.equal(r.statusCode, 400); assert.ok(r.body.error);
  [r] = await quiet(() => hit(m, "/api/v1/youtube/search", { q: "x" }));
  assert.equal(r.statusCode, 429); assert.equal(r.headers["retry-after"], "900"); assert.match(r.body.error, /Paste a YouTube link/);
  r = await hit(m, "/api/v1/youtube/video", {});
  assert.equal(r.statusCode, 400);
  r = await hit(m, "/api/v1/youtube/video", { id: "bad" });
  assert.equal(r.statusCode, 400);
  r = await hit(m, "/api/v1/youtube/video", { id: V3 });
  assert.equal(r.statusCode, 404);
  m = mount({ key: "", fetchJson: fakeGoogle([]) });
  r = await hit(m, "/api/v1/youtube/status");
  assert.deepEqual(r.body, { enabled: false, region: "NG" });
  r = await hit(m, "/api/v1/youtube/search", { q: "x" });
  assert.equal(r.statusCode, 501); assert.match(r.body.error, /not set up/);
  m = mount({ key: KEY, fetchJson: fakeGoogle([[/./, new Error("boom")]]) });
  [r] = await quiet(() => hit(m, "/api/v1/youtube/search", { q: "x" }));
  assert.equal(r.statusCode, 500); assert.ok(!JSON.stringify(r.body).includes("boom"));
  m = mount({ key: KEY, fetchJson: async () => { throw new TypeError("a bug"); } });
  [r] = await quiet(() => hit(m, "/api/v1/youtube/trending", {}));
  assert.equal(r.statusCode, 500, "even an unexpected error ends as a normal answer, never a crash");
});

test("routes: a video lookup works without any key", async () => {
  const m = mount({ key: "", fetchJson: fakeGoogle([[OEMBED, { body: { title: "Song", author_name: "Artist" } }]]) });
  const r = await hit(m, "/api/v1/youtube/video", { id: V1 });
  assert.equal(r.statusCode, 200); assert.equal(r.body.items[0].title, "Song"); assert.equal(r.body.items[0].channel, "Artist");
});

// ---- the real network helper, against a small local server ----
function serve(t, handler) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => { res.on("error", () => {}); handler(req, res); });
    srv.listen(0, "127.0.0.1", () => { t.after(() => { if (srv.closeAllConnections) srv.closeAllConnections(); srv.close(); }); resolve(srv.address().port); });
  });
}
test("fetcher: reads JSON answers, error answers, and survives odd ones", async (t) => {
  const seen = [];
  const port = await serve(t, (req, res) => {
    seen.push({ url: req.url, ua: req.headers["user-agent"], accept: req.headers.accept });
    if (req.url.startsWith("/ok")) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ hello: "wörld ✓" })); }
    else if (req.url.startsWith("/err")) { res.statusCode = 403; res.end(JSON.stringify({ error: { errors: [{ reason: "quotaExceeded" }] } })); }
    else if (req.url.startsWith("/html")) { res.end("<html>not json</html>"); }
    else if (req.url.startsWith("/big")) { res.write("x".repeat(400000)); res.write("x".repeat(400000)); res.end(); }
    else if (req.url.startsWith("/slow")) { /* never answers */ }
    else res.end("{}");
  });
  const f = Y.makeFetcher({ lib: http, host: "127.0.0.1", port, timeout: 400 });
  let r = await f("www.googleapis.com", "/ok?x=1");
  assert.deepEqual(r, { status: 200, body: { hello: "wörld ✓" } });
  assert.match(seen[0].ua, /Letschat/); assert.equal(seen[0].accept, "application/json");
  r = await f("www.googleapis.com", "/err");
  assert.equal(r.status, 403); assert.equal(Y.googleError(r.status, r.body).code, "quota");
  r = await f("www.googleapis.com", "/html");
  assert.deepEqual(r, { status: 200, body: null });
  await assert.rejects(() => f("www.googleapis.com", "/big"), (e) => e.code === "unavailable");
  await assert.rejects(() => f("www.googleapis.com", "/slow"), (e) => e.code === "unavailable" && /timeout/.test(e.message));
  const dead = Y.makeFetcher({ lib: http, host: "127.0.0.1", port: 1, timeout: 400 });
  await assert.rejects(() => dead("www.googleapis.com", "/x"), (e) => e.code === "unavailable");
});

test("googleError: every answer maps to one code", () => {
  const g = (s, reason, status) => Y.googleError(s, { error: { errors: reason ? [{ reason }] : [], status } }).code;
  assert.equal(g(403, "quotaExceeded"), "quota"); assert.equal(g(403, "dailyLimitExceeded"), "quota"); assert.equal(g(429), "quota"); assert.equal(g(403, "", "RESOURCE_EXHAUSTED"), "quota");
  assert.equal(g(400, "keyInvalid"), "key"); assert.equal(g(403, "accessNotConfigured"), "key"); assert.equal(g(403), "key"); assert.equal(g(401), "key");
  assert.equal(g(400, "invalidRegionCode"), "bad_request"); assert.equal(g(400, "invalidPageToken"), "bad_request");
  assert.equal(g(500), "unavailable"); assert.equal(g(503), "unavailable"); assert.equal(Y.googleError(0, null).code, "unavailable");
});
