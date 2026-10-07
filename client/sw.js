// Letschat Africa service worker
// - Caches the app shell so the app opens instantly and works offline.
// - Never touches API / socket traffic (other origins, /socket.io, POSTs).
const CACHE = "letschat-shell-v1"; // bump this (v2, v3...) to force an update
const SHELL = ["./", "./index.html", "./config.js", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;                    // sends, uploads, etc.
  if (url.origin !== self.location.origin) return;     // Render API, Firebase, CDNs
  if (url.pathname.startsWith("/socket.io")) return;   // realtime

  // Network first (so new deploys show up), fall back to cache when offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
