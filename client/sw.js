// Letschat Africa service worker (v57: safer install, adaptive timeout on slow networks, better offline page, self-updating cache name)
// Built for: modern phones, iPhone Safari, Phoenix and other Chromium forks, old Android / KaiOS keypad phones.
// - Page and app code: network-first with a short timeout (new deploys show at once; a slow or missing connection uses the
//   saved copy, and a friendly offline page shows if nothing is saved yet). "Navigation preload" starts the page request
//   while the worker wakes up, so repeat opens are faster.
// - Pinned libraries (React, Firebase, Socket.IO, also from the backup hosts) and Google Fonts: saved on the device for good.
// - Photos from the API: saved on the device, trimmed to a limit.
// - LITE mode (keypad phones and screens up to 320 px; the page registers "sw.js?lite=1"): skips sounds, wallpapers and fonts,
//   keeps fewer photos, so it uses little storage and little data.
// - Never touches the API, sockets, Lite pages (/lite), sends, uploads or audio/video range requests.
// - Syntax stays simple on purpose (no optional catch binding, no async/await): old browsers must still be able to parse it.
var VERSION = "letschat-shell-v64"; // bump (v57, v58...) to make every device drop its old copy
var CACHE = VERSION;
var IMGS = "letschat-images-v1";    // profile, status and market photos
var LIBS = "letschat-libs-v1";      // pinned library versions never change, so this cache is kept across updates
var FONTS = "letschat-fonts-v1";    // Google Fonts files
var LITE = /[?&]lite=1/.test(self.location.search);
var MAX_IMAGES = LITE ? 60 : 400;

// SHELL = the files the app cannot start without (install fails if one is missing, so the old working version stays). EXTRAS = nice to have: a missing
// icon, sound or picture never blocks an update.
var SHELL = ["./", "./index.html", "./app.js", "./config.js", "./polyfills.js", "./compat.js", "./responsive.js", "./responsive.css", "./device.js", "./manifest.json"];
if (!LITE) SHELL.push("./push.js", "./reactions.js");
var EXTRAS = ["./icons/icon-192.png", "./icons/ai-bot-128.png"].concat(LITE ? [] : ["./icons/icon-512.png", "./icons/ai-bot.png", "./swoosh.mp3", "./typing.wav", "./wallpaper-dark.webp", "./wallpaper-color.webp"]);

// On a slow or data-saving connection the saved copy is shown sooner (the fresh copy still downloads and is saved for next time).
function waitMs() {
  try {
    var n = self.navigator && self.navigator.connection;
    if (n && (n.saveData || /(^|-)2g$/.test(n.effectiveType || ""))) return 1500;
    if (n && n.effectiveType === "3g") return 2500;
  } catch (e) {}
  return 3500;
}

// Third-party files whose URL contains an exact version number: safe to keep forever.
var PINNED = [
  /^https:\/\/unpkg\.com\/react(-dom)?@\d+\.\d+\.\d+\//,
  /^https:\/\/www\.gstatic\.com\/firebasejs\/\d+\.\d+\.\d+\//,
  /^https:\/\/cdn\.socket\.io\/\d+\.\d+\.\d+\//,
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/(react|react-dom|socket\.io-client|firebase)@\d+\.\d+\.\d+\//,
  /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(react|react-dom|socket\.io|firebase)\/\d+\.\d+\.\d+\//
];
var FONT_CSS = /^https:\/\/fonts\.googleapis\.com\//;
var FONT_FILE = /^https:\/\/fonts\.gstatic\.com\//;

// the app's own code and small config files: always try the network first
var FRESH = /\/(app|config|push|reactions|responsive|compat|device)\.(js|css)$|\/manifest\.json$/;

// photos served by the API (versioned URLs)
var IMAGE_API = /\/api\/(?:v1\/)?(?:users\/[^/]+\/avatar|groups\/[^/]+\/avatar|status\/[^/]+\/photo|market\/[^/]+\/photo|catalog\/[^/]+\/[^/]+\/photo)/;

var OFFLINE_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Letschat Africa</title></head>' +
  '<body style="margin:0;padding:24px;background:#05070A;color:#E6EDF3;font:16px/1.4 Arial,sans-serif;text-align:center"><h1 style="font-size:20px">Letschat Africa</h1>' +
  '<p>You are offline and the app is not saved on this phone yet.</p><p>Connect to the internet and open it once. After that it opens even without a connection.</p>' +
  '<p><a href="./" style="display:inline-block;padding:10px 18px;border-radius:20px;background:#35D0BA;color:#05070A;text-decoration:none;font-weight:bold">Try again</a></p>' +
  '<script>window.addEventListener("online",function(){location.reload()});</script></body></html>';
function offlinePage() { return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }); }

function ignore() {}
// only keep complete, successful responses (a 206 partial or an error page must never be stored)
function storable(res) { return !!res && res.status === 200 && (res.type === "basic" || res.type === "cors"); }
function put(c, key, res) { try { return c.put(key, res).catch(ignore); } catch (e) { return Promise.resolve(); } } // full storage never breaks a request
function trimCache(c, max) { return c.keys().then(function (ks) { return ks.length > max ? Promise.all(ks.slice(0, ks.length - max).map(function (k) { return c.delete(k); })) : null; }).catch(ignore); }

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(SHELL).then(function () { return Promise.all(EXTRAS.map(function (u) { return c.add(u).catch(ignore); })); });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== LIBS && k !== IMGS && k !== FONTS; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { try { if (self.registration.navigationPreload) return self.registration.navigationPreload.enable(); } catch (err) {} })
      .then(function () { return self.clients.claim(); })
  );
});

// the app's own code: ask the network first, but use the saved copy if it takes longer than `ms` or fails
function networkFirst(e, req, c, key, ms, isPage) {
  return new Promise(function (resolve) {
    var done = false;
    function saved() { return c.match(key, { ignoreSearch: true }); }
    function fallback() {
      return saved().then(function (hit) { return hit || (isPage ? offlinePage() : Response.error()); });
    }
    var timer = setTimeout(function () { saved().then(function (hit) { if (hit && !done) { done = true; resolve(hit); } }); }, ms);
    var pre = isPage && e.preloadResponse ? e.preloadResponse : Promise.resolve(undefined);
    pre.catch(function () { return undefined; })
      .then(function (p) { return p || fetch(req); })
      .then(function (res) {
        clearTimeout(timer);
        if (storable(res)) put(c, key, res.clone());
        if (!done) { done = true; resolve(res); }
      })
      .catch(function () {
        clearTimeout(timer);
        fallback().then(function (hit) { if (!done) { done = true; resolve(hit); } });
      });
  });
}

function cachedImage(req) {
  return caches.open(IMGS).then(function (c) {
    return c.match(req.url).then(function (hit) {
      return hit || fetch(req.url, { mode: "cors", credentials: "omit" }).then(function (res) {
        if (storable(res)) put(c, req.url, res.clone()).then(function () { return trimCache(c, MAX_IMAGES); });
        return res;
      }).catch(function () { return fetch(req); });
    });
  });
}

function cacheFirst(req, name, okType) {
  return caches.open(name).then(function (c) {
    return c.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && (storable(res) || (okType && res.type === okType))) put(c, req, res.clone());
        return res;
      });
    });
  });
}
function staleWhileRevalidate(req, name) {
  return caches.open(name).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && res.status === 200) put(c, req, res.clone()); return res; });
      if (hit) { net.catch(ignore); return hit; }
      return net;
    });
  });
}

// lets the page ask a waiting update to take over
self.addEventListener("message", function (e) {
  var d = e.data;
  if (d === "skip-waiting") self.skipWaiting();
  // the app can ask which version is running (reply goes back on the message port) or clear the saved copies of its own files
  if (d === "get-version" && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION, lite: LITE });
  if (d === "clear-app-cache") e.waitUntil(caches.delete(CACHE).catch(ignore));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;                    // sends, uploads, etc.
  if (req.headers.has("range")) return;                // audio/video seeking goes straight to the network
  var url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (req.destination === "image" && IMAGE_API.test(req.url)) { e.respondWith(cachedImage(req)); return; }
    for (var i = 0; i < PINNED.length; i++) if (PINNED[i].test(req.url)) { e.respondWith(cacheFirst(req, LIBS)); return; }
    if (!LITE) {
      if (FONT_CSS.test(req.url)) { e.respondWith(staleWhileRevalidate(req, FONTS)); return; }
      if (FONT_FILE.test(req.url)) { e.respondWith(cacheFirst(req, FONTS, "opaque")); return; }
    }
    return;                                            // the API server, Firebase calls, anything else: leave alone
  }

  var p = url.pathname;
  if (p.indexOf("/socket.io") === 0 || p.indexOf("/api") === 0 || p.indexOf("/lite") === 0) return; // realtime, API, Lite pages

  var isPage = req.mode === "navigate";
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      if (isPage || FRESH.test(p) || /\/index\.html$/.test(p)) return networkFirst(e, req, c, isPage ? "./index.html" : req, waitMs(), isPage);
      // everything else of ours (icons, sounds, wallpapers, polyfills): saved copy now, refreshed in the background
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        var refresh = fetch(req).then(function (res) { if (storable(res)) put(c, req, res.clone()); return res; });
        if (hit) { refresh.catch(ignore); return hit; }
        return refresh;
      });
    })
  );
});

// ---- Web push: show a notification even when the app is closed ----
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Letschat Africa", {
    body: d.body || "New message",
    tag: d.tag || "letschat",       // same chat = one notification, updated
    renotify: true,
    requireInteraction: !!d.call,                          // a call alert stays on screen until it is tapped or dismissed
    vibrate: d.call ? [400, 200, 400, 200, 400] : undefined,
    icon: d.ai ? "icons/ai-bot-128.png" : "icons/icon-192.png", // replies written by the AI show the robot
    badge: "icons/icon-192.png",
    timestamp: Date.now(),
    data: { url: d.url || "./" }
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ("focus" in c) {
          return c.focus().then(function (w) { if (w && url !== "./" && "navigate" in w) return w.navigate(url).catch(function () { return w; }); return w; });
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
