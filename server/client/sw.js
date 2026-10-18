// Letschat Africa service worker (v69: instant start from the saved app, background refresh, early server wake-up, fully offline-safe:
//   React / Firebase / Socket.IO are saved at install time, so the very first offline open boots; offline.js keeps chats and queued messages)
// Built for: modern phones, iPhone Safari, Phoenix and other Chromium forks, old Android / KaiOS keypad phones.
// - Page and app code: served from the device at once (no waiting for the network), then refreshed in the background. Every deploy
//   changes this file (build.js stamps a hash into VERSION), which downloads the new copy and shows the "updated, tap to refresh" button.
//   "Navigation preload" starts the page request while the worker wakes up, so the refresh is not delayed. If nothing is saved yet the
//   network is used, and a friendly offline page shows when there is no connection.
// - The sleeping free server is woken the moment the worker sees the app open (and again on push / periodic sync / when the app asks).
// - Pinned libraries (React, Firebase, Socket.IO, also from the backup hosts) and Google Fonts: saved on the device for good.
// - Photos from the API: saved on the device, trimmed to a limit.
// - LITE mode (keypad phones and screens up to 320 px; the page registers "sw.js?lite=1"): skips sounds, wallpapers and fonts,
//   keeps fewer photos, so it uses little storage and little data.
// - Never touches the API, sockets, Lite pages (/lite), sends, uploads or audio/video range requests.
// - Syntax stays simple on purpose (no optional catch binding, no async/await): old browsers must still be able to parse it.
var VERSION = "letschat-shell-v72"; // bump (v57, v58...) to make every device drop its old copy
var CACHE = VERSION;
var IMGS = "letschat-images-v1";    // profile, status and market photos
var LIBS = "letschat-libs-v1";      // pinned library versions never change, so this cache is kept across updates
var FONTS = "letschat-fonts-v1";    // Google Fonts files
var SHARE = "letschat-share-v1";    // text, links and files received from the phone's Share menu, kept until the app picks them up
var LITE = /[?&]lite=1/.test(self.location.search);
var MAX_IMAGES = LITE ? 60 : 400;

// SHELL = the files the app cannot start without (install fails if one is missing, so the old working version stays). EXTRAS = nice to have: a missing
// icon, sound or picture never blocks an update.
var SHELL = ["./", "./index.html", "./app.js", "./config.js", "./polyfills.js", "./compat.js", "./responsive.js", "./responsive.css", "./device.js", "./offline.js", "./manifest.json"];
if (!LITE) SHELL.push("./push.js", "./reactions.js", "./live.js");
var EXTRAS = ["./app.legacy.js", "./icons/icon-192.png", "./icons/ai-bot-128.png", "./icons/update-banner.jpg", "./icons/chat-room.jpg"].concat(LITE ? [] : ["./icons/icon-512.png", "./icons/ai-bot.png", "./swoosh.mp3", "./typing.wav", "./wallpaper-dark.webp", "./wallpaper-color.webp"]);

// Third-party files whose URL contains an exact version number: safe to keep forever.
var PINNED = [
  /^https:\/\/unpkg\.com\/react(-dom)?@\d+\.\d+\.\d+\//,
  /^https:\/\/www\.gstatic\.com\/firebasejs\/\d+\.\d+\.\d+\//,
  /^https:\/\/cdn\.socket\.io\/\d+\.\d+\.\d+\//,
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/(react|react-dom|socket\.io-client|firebase)@\d+\.\d+\.\d+\//,
  /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(react|react-dom|socket\.io|firebase)\/\d+\.\d+\.\d+\//,
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@\d+\.\d+\.\d+\//,          // face tracking code (Live face effects), saved after first use
  /^https:\/\/storage\.googleapis\.com\/mediapipe-models\/face_landmarker\//                      // face tracking model
];
// The exact library files index.html loads. They are saved when the worker installs (not only when first used), because the very first page
// load happens BEFORE the worker controls the page: without this, going offline right after the first visit would leave the app without React.
var LIB_URLS = [
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://cdn.socket.io/4.7.5/socket.io.min.js"
];
var FONT_CSS = /^https:\/\/fonts\.googleapis\.com\//;
var FONT_FILE = /^https:\/\/fonts\.gstatic\.com\//;

// the app's own code and small config files: saved copy first (instant), refreshed in the background
var FRESH = /\/(app|app\.legacy|config|push|reactions|live|offline|responsive|compat|device|polyfills)\.(js|css)$|\/manifest\.json$/;

// photos served by the API (versioned URLs)
var IMAGE_API = /\/api\/(?:v1\/)?(?:users\/[^/]+\/(?:avatar|cover)|groups\/[^/]+\/avatar|status\/[^/]+\/photo|market\/[^/]+\/photo|catalog\/[^/]+\/[^/]+\/photo)/;

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
      // cache:"reload" skips the browser's own HTTP cache, so the saved shell is always the fresh deploy
      var fresh = function (u) { return new Request(u, { cache: "reload" }); };
      return c.addAll(SHELL.map(fresh)).then(function () { return Promise.all(EXTRAS.map(function (u) { return c.add(fresh(u)).catch(ignore); })); });
    }).then(function () {
      // libraries: a failure here never blocks the install (they are also saved the first time they are used)
      return caches.open(LIBS).then(function (lc) {
        return Promise.all(LIB_URLS.map(function (u) {
          return lc.match(u).then(function (hit) {
            if (hit) return null;
            return fetch(new Request(u, { mode: "cors", credentials: "omit" })).then(function (res) { if (storable(res)) return put(lc, u, res); }).catch(ignore);
          }).catch(ignore);
        }));
      }).catch(ignore);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== LIBS && k !== IMGS && k !== FONTS && k !== SHARE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { try { if (self.registration.navigationPreload) return self.registration.navigationPreload.enable(); } catch (err) {} })
      .then(function () { return self.clients.claim(); })
      .then(function () { wakeServer(true); })
  );
});

// the app's own code: show the saved copy straight away and refresh it in the background (first ever open: use the network).
// Navigation preload (when the browser has it) supplies the page request that was already started while this worker was waking up.
function shellFirst(e, req, c, key, isPage) {
  return c.match(key, { ignoreSearch: true }).then(function (hit) {
    var pre = isPage && e.preloadResponse ? e.preloadResponse : Promise.resolve(undefined);
    var refresh = pre.catch(function () { return undefined; })
      .then(function (p) { return p || fetch(req); })
      .then(function (res) { if (storable(res)) put(c, key, res.clone()); return res; });
    if (hit) { try { e.waitUntil(refresh.catch(ignore)); } catch (err) { refresh.catch(ignore); } return hit; }
    return refresh.catch(function () { return isPage ? offlinePage() : Response.error(); });
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
  if (d === "wake") wakeServer(true);
  // the app can ask which version is running (reply goes back on the message port) or clear the saved copies of its own files
  if (d === "get-version" && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION, lite: LITE });
  if (d === "clear-app-cache") e.waitUntil(caches.delete(CACHE).catch(ignore));
});

// Wake the server as early as possible: the worker starts before the page does, so the very first page request already pings the (free, sleeping) server.
// Change WAKE_URL if the server address changes (keep it the same as API_URL in config.js). At most one ping every 20 s unless forced.
var WAKE_URL = "https://letschat-9tw4.onrender.com/api/v1/health", lastWake = 0;
function wakeServer(force) {
  var t = Date.now();
  if (!force && t - lastWake < 20000) return Promise.resolve();
  lastWake = t;
  try { return fetch(WAKE_URL, { mode: "no-cors", cache: "no-store" }).then(ignore, ignore); } catch (err) { return Promise.resolve(); }
}
// Chrome / Edge / Android installed apps: wake (and so keep warm) the server now and then even while the app is closed
self.addEventListener("periodicsync", function (e) { if (e.tag === "keep-warm") e.waitUntil(wakeServer(true)); });

// ---- Share target: Letschat appears in the phone's Share menu (needs the app installed to the home screen) ----
// The Share menu POSTs the shared text / link / files to ./share-target. We save them in the SHARE cache and redirect to the app
// (./?share=1), which reads them back and opens the "Send to..." chooser. Files may be big, so they are stored as they are.
function handleShare(e) {
  e.respondWith(
    e.request.formData().then(function (fd) {
      var meta = { title: String(fd.get("title") || ""), text: String(fd.get("text") || ""), url: String(fd.get("url") || ""), files: [], time: Date.now() };
      return caches.open(SHARE).then(function (c) {
        return c.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return c.delete(k); })); }).then(function () {
          var list = fd.getAll("files"), puts = [];
          for (var i = 0; i < list.length && i < 10; i++) {
            var f = list[i];
            if (!f || typeof f === "string") continue;
            var key = "./__share/file/" + i;
            meta.files.push({ name: f.name || "file", type: f.type || "application/octet-stream", size: f.size || 0, key: key });
            puts.push(c.put(key, new Response(f, { headers: { "Content-Type": f.type || "application/octet-stream" } })));
          }
          return Promise.all(puts);
        }).then(function () { return c.put("./__share/meta", new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } })); });
      });
    }).catch(ignore).then(function () { return Response.redirect(new URL("./?share=1", self.registration.scope).href, 303); })
  );
}
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method === "POST" && new URL(req.url).pathname.slice(-13) === "/share-target") { handleShare(e); return; }
  if (req.method !== "GET") return;                    // sends, uploads, etc.
  if (new URL(req.url).pathname.slice(-13) === "/share-target") { e.respondWith(Response.redirect(self.registration.scope, 302)); return; } // opened by hand: just open the app
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
  if (isPage) wakeServer();
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      if (isPage) return shellFirst(e, req, c, "./index.html", true);
      if (FRESH.test(p) || /\/index\.html$/.test(p)) return shellFirst(e, req, c, req, false);
      // everything else of ours (icons, sounds, wallpapers): saved copy now, refreshed in the background
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
  wakeServer();
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
