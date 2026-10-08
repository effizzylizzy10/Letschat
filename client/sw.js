// Letschat Africa service worker
// - Opens the app instantly from the device (stale-while-revalidate): you see the saved version at once and
//   the newest version is fetched quietly in the background, so a deploy shows up the next time you open the app.
// - Keeps the pinned library files (React, Firebase, Socket.IO) on the device so they never hit the network again.
// - Never touches API / socket traffic (other origins, /socket.io, POSTs, audio/video range requests).
const CACHE = "letschat-shell-v15"; // bump this (v14, v15...) to force every device to drop the old copy
const LIBS = "letschat-libs-v1";    // pinned versions never change, so this cache is kept across updates
const SHELL = ["./", "./index.html", "./app.js", "./config.js", "./push.js", "./reactions.js", "./manifest.json"];
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== LIBS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// only keep complete, successful responses (a 206 partial or an error page must never be stored)
const storable = (res) => res && res.status === 200 && (res.type === "basic" || res.type === "cors");

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                    // sends, uploads, etc.
  if (req.headers.has("range")) return;                // audio/video seeking goes straight to the network
  const url = new URL(req.url);

  // pinned libraries: cache first, forever
  if (url.origin !== self.location.origin) {
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
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow(url);
    })
  );
});
