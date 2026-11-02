"use strict";
// Run with:  node --test link-preview.test.js   (Node 18 or newer; no network needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const dns = require("dns");
const LP = require("./link-preview");

function serve(t, handler) {
  return new Promise((resolve) => {
    const hits = { n: 0 };
    const srv = http.createServer((req, res) => { hits.n++; res.on("error", () => {}); handler(req, res); });
    srv.listen(0, "127.0.0.1", () => {
      t.after(() => { if (srv.closeAllConnections) srv.closeAllConnections(); srv.close(); });
      resolve({ hits, base: "http://127.0.0.1:" + srv.address().port });
    });
  });
}
// A fake network: routes = [[regexForUrl, response | Error | function(url)]]
function fakeNet(routes) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    for (const [re, resp] of routes) {
      if (!re.test(url)) continue;
      if (resp instanceof Error) throw resp;
      return Object.assign({ status: 200, headers: { "content-type": "application/json" }, url, body: Buffer.alloc(0) }, typeof resp === "function" ? resp(url) : resp);
    }
    throw new Error("unexpected request " + url);
  };
  fn.calls = calls;
  return fn;
}
const json = (o, status) => ({ status: status || 200, body: Buffer.from(JSON.stringify(o)) });
const html = (s, url) => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: Buffer.from(s), url });

test("private and internal addresses are blocked, public ones are not", () => {
  for (const a of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd12::1", "fe80::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "not-an-ip", ""]) assert.equal(LP.isBlockedAddress(a), true, a);
  for (const a of ["8.8.8.8", "142.250.80.46", "2001:4860:4860::8888", "::ffff:808:808"]) assert.equal(LP.isBlockedAddress(a), false, a);
});

test("a name that resolves to a private address is refused when connecting", async () => {
  const real = dns.lookup;
  dns.lookup = (h, o, cb) => cb(null, [{ address: "10.0.0.5", family: 4 }]);
  try {
    const err = await new Promise((r) => LP.makeLookup(false)("evil.example", { all: true }, (e) => r(e)));
    assert.match(err.message, /blocked/);
    const ok = await new Promise((r) => LP.makeLookup(true)("evil.example", { all: true }, (e, a) => r(a)));
    assert.equal(ok[0].address, "10.0.0.5");
  } finally { dns.lookup = real; }
});

test("YouTube links in every common form", () => {
  const id = "dQw4w9WgXcQ";
  for (const u of ["https://www.youtube.com/watch?v=" + id, "https://youtu.be/" + id + "?t=42", "https://m.youtube.com/watch?v=" + id + "&list=PLabcdefghij",
    "https://music.youtube.com/watch?v=" + id, "https://www.youtube.com/shorts/" + id, "https://www.youtube.com/live/" + id,
    "https://www.youtube.com/embed/" + id, "https://www.youtube-nocookie.com/embed/" + id]) {
    const m = LP.matchProvider(u);
    assert.ok(m && m.prov.key === "youtube", u);
    assert.equal(m.t.target, "https://www.youtube.com/watch?v=" + id, u);
  }
  assert.equal(LP.matchProvider("https://www.youtube.com/playlist?list=PLabcdefghijk").t.target, "https://www.youtube.com/playlist?list=PLabcdefghijk");
  for (const u of ["https://www.youtube.com/@somechannel", "https://www.youtube.com/results?search_query=x", "https://www.youtube.com/watch?v=short",
    "https://example.com/watch?v=" + id, "ftp://youtu.be/" + id, "nonsense"]) assert.equal(LP.matchProvider(u), null, u);
});

test("Vimeo, TikTok, Spotify and SoundCloud links", () => {
  const cases = [
    ["https://vimeo.com/123456789", "vimeo", "https://vimeo.com/123456789"],
    ["https://vimeo.com/channels/staffpicks/123456789", "vimeo", "https://vimeo.com/123456789"],
    ["https://player.vimeo.com/video/123456789?h=abc", "vimeo", "https://vimeo.com/123456789"],
    ["https://www.tiktok.com/@some.user/video/7234567890123456789?lang=en", "tiktok", "https://www.tiktok.com/@some.user/video/7234567890123456789"],
    ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x", "spotify", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"],
    ["https://open.spotify.com/intl-fr/album/1DFixLWuPkv3KT3TnV35m3", "spotify", "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3"],
    ["https://soundcloud.com/some-artist/some-track", "soundcloud", "https://soundcloud.com/some-artist/some-track"],
  ];
  for (const [u, key, target] of cases) {
    const m = LP.matchProvider(u);
    assert.ok(m && m.prov.key === key, u);
    assert.equal(m.t.target, target, u);
  }
  for (const u of ["https://soundcloud.com/discover", "https://vimeo.com/about", "https://www.tiktok.com/@user", "https://open.spotify.com/", "https://example.com/"]) {
    assert.equal(LP.matchProvider(u), null, u);
  }
});

test("page tags are read in any order, decoded, and pictures become absolute https", () => {
  const p = LP.parseHtml('<head><meta content="Fish &amp; Chips &#8211; Menu" property="og:title"><meta name="description" content=\'Fresh "food" daily\'>' +
    '<meta property="og:image" content="http://cdn.example.com/a.jpg"><meta property="og:site_name" content="Fish Shop"></head>', "https://example.com/menu");
  assert.deepEqual(p, { url: "https://example.com/menu", title: "Fish & Chips – Menu", description: 'Fresh "food" daily', image: "https://cdn.example.com/a.jpg", site: "Fish Shop" });

  const q = LP.parseHtml('<title> My  page\n</title><meta name="twitter:image" content="/img/x.png">', "https://www.example.com/a/b");
  assert.equal(q.title, "My page");
  assert.equal(q.image, "https://www.example.com/img/x.png");
  assert.equal(q.site, "example.com");

  assert.equal(LP.parseHtml('<title>x</title><meta property="og:image" content="data:image/png;base64,AAA">', "https://example.com/").image, "");
  assert.equal(LP.parseHtml("<html><head></head></html>", "https://example.com/"), null);
});

test("page previews end to end: redirects, encodings, pictures, PDFs, walls, big pages", async (t) => {
  const s = await serve(t, (req, res) => {
    const u = req.url, send = (code, type, body) => { res.writeHead(code, { "content-type": type }); res.end(body); };
    if (u === "/page") return send(200, "text/html; charset=utf-8", '<head><meta property="og:title" content="Hello"><meta property="og:description" content="A page"><meta property="og:image" content="/p.png"></head><body>' + "x".repeat(5000));
    if (u === "/go") { res.writeHead(302, { location: "/page" }); return res.end(); }
    if (u === "/loop") { res.writeHead(302, { location: "/loop" }); return res.end(); }
    if (u === "/to-login") { res.writeHead(302, { location: "/login" }); return res.end(); }
    if (u === "/login") return send(200, "text/html", "<title>Sign in</title>");
    if (u === "/latin1") return send(200, "text/html", Buffer.from('<html><head><meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1"><title>Caf\xe9 \xe0 Lagos</title></head>', "latin1"));
    if (u === "/pic.png") return send(200, "image/png", Buffer.from([137, 80, 78, 71]));
    if (u === "/My%20Doc.pdf") return send(200, "application/pdf", "%PDF-1.4");
    if (u === "/cf") return send(403, "text/html", "<title>Just a moment...</title>");
    if (u === "/cf200") return send(200, "text/html", "<title>Just a moment...</title>");
    if (u === "/zip") return send(200, "application/zip", "PK");
    if (u === "/early") { res.writeHead(200, { "content-type": "text/html" }); return res.write("<head><title>Early</title></head>"); } // never ends: we must stop at </head>
    if (u === "/huge") {
      res.writeHead(200, { "content-type": "text/html" });
      res.write('<head><meta property="og:title" content="Big"></head>');
      const chunk = "z".repeat(65536); let i = 0;
      const timer = setInterval(() => { if (i++ > 60 || res.destroyed) { clearInterval(timer); res.end(); } else res.write(chunk); }, 1);
      res.on("close", () => clearInterval(timer));
      return;
    }
    send(404, "text/html", "<title>Not here</title>");
  });
  const pv = LP.createPreviewer({ allowPrivate: true });
  const host = "127.0.0.1";

  assert.deepEqual(await pv.preview(s.base + "/page"), { url: s.base + "/page", title: "Hello", description: "A page", image: "https://" + host + s.base.slice(s.base.lastIndexOf(":")) + "/p.png", site: host });
  assert.equal((await pv.preview(s.base + "/go")).url, s.base + "/page");
  assert.equal(await pv.preview(s.base + "/loop"), null);
  assert.equal((await pv.preview(s.base + "/latin1")).title, "Café à Lagos");
  assert.deepEqual(await pv.preview(s.base + "/pic.png"), { url: s.base + "/pic.png", title: "pic.png", description: "", image: "https://" + host + s.base.slice(s.base.lastIndexOf(":")) + "/pic.png", site: host });
  const pdf = await pv.preview(s.base + "/My%20Doc.pdf");
  assert.equal(pdf.title, "My Doc.pdf");
  assert.equal(pdf.description, "PDF document");
  assert.equal(await pv.preview(s.base + "/to-login"), null);
  assert.equal(await pv.preview(s.base + "/cf"), null);
  assert.equal(await pv.preview(s.base + "/cf200"), null);
  assert.equal(await pv.preview(s.base + "/zip"), null);
  assert.equal(await pv.preview(s.base + "/missing"), null);
  assert.equal((await pv.preview(s.base + "/early")).title, "Early");
  const t0 = Date.now();
  assert.equal((await pv.preview(s.base + "/huge")).title, "Big");
  assert.ok(Date.now() - t0 < 3000, "a big page must not be read to the end");
});

test("private addresses, odd ports and logins in the address are refused", async (t) => {
  const s = await serve(t, (req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<title>secret</title>"); });
  const pv = LP.createPreviewer({});
  assert.equal(await pv.preview(s.base + "/"), null);
  assert.equal(await pv.preview(s.base.replace("127.0.0.1", "localhost") + "/"), null);
  assert.equal(await pv.preview("http://169.254.169.254/latest/meta-data/"), null);
  assert.equal(await pv.preview("http://[::1]:8080/"), null);
  assert.equal(await pv.preview("http://[::ffff:127.0.0.1]/"), null);
  assert.equal(await pv.preview("https://user:pw@example.com/"), null);
  assert.equal(await pv.preview("http://example.com:22/"), null);
  assert.equal(s.hits.n, 0, "the server must never have been contacted");
});

test("YouTube: title, channel and picture from oEmbed; the pasted address (with its time) is kept", async () => {
  const net_ = fakeNet([[/oembed/, json({ title: "Never Gonna Give You Up (Official Video)", author_name: "Rick Astley", thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" })]]);
  const pv = LP.createPreviewer({ request: net_, endpoints: { youtube: "http://127.0.0.1:1/oembed" } });
  const raw = "https://youtu.be/dQw4w9WgXcQ?t=42";
  assert.deepEqual(await pv.preview(raw), { url: raw, title: "Never Gonna Give You Up (Official Video)", description: "Rick Astley", image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", site: "YouTube" });
  assert.equal(net_.calls.length, 1);
  assert.equal(net_.calls[0], "http://127.0.0.1:1/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
});

test("YouTube: removed videos get no card; embedding switched off falls back to the page; unreachable falls back to the thumbnail", async () => {
  const id = "dQw4w9WgXcQ", raw = "https://www.youtube.com/watch?v=" + id;
  const gone = fakeNet([[/oembed/, { status: 404, body: Buffer.from("Not Found") }]]);
  assert.equal(await LP.createPreviewer({ request: gone }).preview(raw), null);
  assert.equal(gone.calls.length, 1, "no page request after a 404");

  const noEmbed = fakeNet([[/oembed/, { status: 401, body: Buffer.from("Unauthorized") }], [/watch/, html('<head><meta property="og:title" content="Owner blocked embeds"><meta property="og:image" content="https://i.ytimg.com/vi/x/maxres.jpg"></head>', raw)]]);
  const p1 = await LP.createPreviewer({ request: noEmbed }).preview(raw);
  assert.equal(p1.title, "Owner blocked embeds");
  assert.equal(p1.site, "youtube.com");

  const down = fakeNet([[/oembed/, new Error("ECONNRESET")], [/watch/, new Error("timeout")]]);
  assert.deepEqual(await LP.createPreviewer({ request: down }).preview(raw), { url: raw, title: "YouTube video", description: "", image: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg", site: "YouTube" });

  const consent = fakeNet([[/oembed/, { status: 500, body: Buffer.from("oops") }], [/watch/, html("<title>Before you continue</title>", "https://consent.youtube.com/m?continue=x")]]);
  assert.equal((await LP.createPreviewer({ request: consent }).preview(raw)).title, "YouTube video");
});

test("Vimeo and Spotify cards; a broken oEmbed answer falls back to the page and then to nothing", async () => {
  const net_ = fakeNet([
    [/vimeo\.com\/api\/oembed/, json({ title: "A film", author_name: "Jane", thumbnail_url: "http://i.vimeocdn.com/video/1.jpg" })],
    [/open\.spotify\.com\/oembed/, json({ title: "Song name", thumbnail_url: "https://i.scdn.co/image/x" })],
    [/soundcloud\.com\/oembed/, { status: 200, body: Buffer.from("<html>not json</html>") }],
    [/soundcloud\.com\/a\/b/, new Error("timeout")],
  ]);
  const pv = LP.createPreviewer({ request: net_ });
  assert.deepEqual(await pv.preview("https://vimeo.com/123456789"), { url: "https://vimeo.com/123456789", title: "A film", description: "Jane", image: "https://i.vimeocdn.com/video/1.jpg", site: "Vimeo" });
  assert.deepEqual(await pv.preview("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"), { url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", title: "Song name", description: "", image: "https://i.scdn.co/image/x", site: "Spotify" });
  assert.equal(await pv.preview("https://soundcloud.com/a/b"), null);
});

test("good and failed results are cached, and simultaneous requests share one fetch", async (t) => {
  const s = await serve(t, (req, res) => {
    if (req.url !== "/page") { res.writeHead(404, { "content-type": "text/html" }); return res.end("nope"); }
    setTimeout(() => { res.writeHead(200, { "content-type": "text/html" }); res.end('<head><meta property="og:title" content="Cached"></head>'); }, 30);
  });
  const pv = LP.createPreviewer({ allowPrivate: true });
  const [a, b] = await Promise.all([pv.preview(s.base + "/page"), pv.preview(s.base + "/page")]);
  assert.equal(s.hits.n, 1);
  assert.deepEqual(a, b);
  await pv.preview(s.base + "/page");
  assert.equal(s.hits.n, 1);
  assert.equal(await pv.preview(s.base + "/nope"), null);
  assert.equal(await pv.preview(s.base + "/nope"), null);
  assert.equal(s.hits.n, 2);
});

test("the route checks the link and answers { preview }", async () => {
  const routes = [], app = { get: (paths, ...h) => routes.push({ paths, h }) };
  const auth = () => {}, limiter = () => {};
  const log = console.log; console.log = () => {};
  try {
    LP.attach(app, { authMiddleware: auth, rateLimit: (cfg) => { assert.deepEqual(cfg, { windowMs: 60000, max: 40 }); return limiter; } },
      { request: async () => ({ status: 404, headers: {}, url: "", body: Buffer.alloc(0) }) });
  } finally { console.log = log; }
  assert.deepEqual(routes[0].paths, ["/api/link-preview", "/api/v1/link-preview"]);
  assert.equal(routes[0].h[0], auth);
  assert.equal(routes[0].h[1], limiter);
  const call = async (url) => {
    const out = {}, res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; }, set(k, v) { out.header = [k, v]; return this; } };
    await routes[0].h[2]({ query: { url } }, res);
    return out;
  };
  for (const bad of ["javascript:alert(1)", "", "file:///etc/passwd", "https://example.com/a b"]) assert.equal((await call(bad)).status, 400, bad);
  const ok = await call("https://example.com/");
  assert.deepEqual(ok.body, { preview: null });
  assert.deepEqual(ok.header, ["Cache-Control", "private, max-age=300"]);
});
