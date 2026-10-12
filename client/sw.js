// Letschat Africa service worker
// - App code (index, app.js, config...) is network-first with a short timeout: new deploys show up right away,
//   and a slow or missing connection falls back to the saved copy so the app still opens instantly offline.
// - Icons, sounds and wallpapers open instantly from the device and refresh quietly in the background.
// - Keeps the pinned library files (React, Firebase, Socket.IO) on the device so they never hit the network again.
// - Never touches API / socket traffic (other origins, /socket.io, POSTs, audio/video range requests).
const CACHE = "letschat-shell-v51"; // bump this (v14, v15...) to force every device to drop the old copy
const IMGS = "letschat-images-v1"; // profile, status and market photos saved on the device
const LIBS = "letschat-libs-v1";    // pinned versions never change, so this cache is kept across updates
const SHELL = ["./", "./index.html", "./app.js", "./config.js", "./push.js", "./reactions.js", "./device.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"];
const EXTRAS = ["./swoosh.mp3", "./typing.wav", "./wallpaper-dark.webp", "./wallpaper-color.webp"]; // best effort, never blocks install
// Third-party files whose URL contains an exact version number: safe to cache forever.
const PINNED = [
  /^https:\/\/unpkg\.com\/react(-dom)?@\d+\.\d+\.\d+\//,
  /^https:\/\/www\.gstatic\.com\/firebasejs\/\d+\.\d+\.\d+\//,
  /^https:\/\/cdn\.socket\.io\/\d+\.\d+\.\d+\//,
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(SHELL).then(() => Promise.all(EXTRAS.map((u) => c.add(u).catch(() => {}))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== LIBS && k !== IMGS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// only keep complete, successful responses (a 206 partial or an error page must never be stored)
const storable = (res) => res && res.status === 200 && (res.type === "basic" || res.type === "cors");

// the app's own code: ask the network first, but use the saved copy if it takes longer than `ms` or fails
const FRESH = /\/(app|config|push|reactions)\.js$|\/manifest\.json$/;
function networkFirst(req, c, key, ms) {
  return new Promise((resolve) => {
    let done = false;
    const saved = () => c.match(key, { ignoreSearch: true });
    const timer = setTimeout(() => saved().then((hit) => { if (hit && !done) { done = true; resolve(hit); } }), ms);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (storable(res)) c.put(key, res.clone());
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      saved().then((hit) => { if (!done) { done = true; resolve(hit || c.match("./index.html")); } });
    });
  });
}

// photos served by the API (versioned URLs): keep them on the device so they show instantly and offline
const IMAGE_API = /\/api\/(?:v1\/)?(?:users\/[^/]+\/avatar|groups\/[^/]+\/avatar|status\/[^/]+\/photo|market\/[^/]+\/photo|catalog\/[^/]+\/[^/]+\/photo)/;
function trimCache(c, max) { return c.keys().then((ks) => ks.length > max ? Promise.all(ks.slice(0, ks.length - max).map((k) => c.delete(k))) : null); }
function cachedImage(req) {
  return caches.open(IMGS).then((c) => c.match(req.url).then((hit) => hit || fetch(req.url, { mode: "cors", credentials: "omit" }).then((res) => {
    if (storable(res)) c.put(req.url, res.clone()).then(() => trimCache(c, 400));
    return res;
  }).catch(() => fetch(req))));
}

// lets the page ask a waiting update to take over
self.addEventListener("message", (e) => { if (e.data === "skip-waiting") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                    // sends, uploads, etc.
  if (req.headers.has("range")) return;                // audio/video seeking goes straight to the network
  const url = new URL(req.url);

  // pinned libraries: cache first, forever
  if (url.origin !== self.location.origin) {
    if (req.destination === "image" && IMAGE_API.test(req.url)) { e.respondWith(cachedImage(req)); return; }
    if (!PINNED.some((re) => re.test(req.url))) return; // Render API, fonts, Firebase calls: leave alone
    e.respondWith(
      caches.open(LIBS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (storable(res)) c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  if (url.pathname.startsWith("/socket.io")) return;   // realtime

  // our own files: show the saved copy now, refresh it in the background
  e.respondWith(
    caches.open(CACHE).then((c) => {
      const isPage = req.mode === "navigate";
      if (isPage || FRESH.test(url.pathname) || url.pathname.endsWith("/index.html")) return networkFirst(req, c, isPage ? "./index.html" : req, 3500);
      // ?chat=... / ?join=... links must still open the app, so match the page without its query string
      return c.match(isPage ? "./index.html" : req, { ignoreSearch: true }).then((hit) => {
        const refresh = fetch(req).then((res) => {
          if (storable(res)) c.put(isPage ? "./index.html" : req, res.clone());
          return res;
        });
        if (hit) { refresh.catch(() => {}); return hit; }  // saved copy now; the update lands for next time
        return refresh.catch(() => c.match("./index.html"));
      });
    })
  );
});

// ---- Web push: show a notification even when the app is closed ----
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Letschat Africa", {
    body: d.body || "New message",
    tag: d.tag || "letschat",       // same chat = one notification, updated
    renotify: true,
    requireInteraction: !!d.call,                          // a call alert stays on screen until it is tapped or dismissed
    vibrate: d.call ? [400, 200, 400, 200, 400] : undefined,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { url: d.url || "./" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) {
        return c.focus().then((w) => { if (w && url !== "./" && "navigate" in w) return w.navigate(url).catch(() => w); return w; });
      }
      return self.clients.openWindow(url);
    })
  );
});
