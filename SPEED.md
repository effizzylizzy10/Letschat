# Speed upgrades (all free)

| What | Where | Effect |
|---|---|---|
| App split out of index.html (910 KB -> 8 KB page) | `tools/split-app.js`, `client/app.js` | Boot screen shows instantly; app downloads in parallel and is cached separately |
| Scripts deferred, preconnect and preload hints | `client/index.html` | No more blank screen while 5 CDN scripts download one by one |
| Fonts load without blocking | `client/index.html` | Text appears at once |
| Server wake-up ping on open | `client/index.html` | Free Render server starts waking the moment the page opens |
| Service worker: open from device, refresh in background | `client/sw.js` | Repeat opens are near-instant, work offline |
| React/Firebase/Socket.IO cached on device for good | `client/sw.js` | No network needed for libraries after the first visit |
| Brotli/gzip for API replies (JSON ~95% smaller) | `server/client/compress.js` | Chat lists and messages arrive much faster on mobile data |
| WebSocket-first connection | `client/app.jsx`, `client/app.js` | Skips the slow long-polling handshake (falls back automatically) |
| Lazy images | `client/app.jsx`, `client/app.js` | Off-screen photos load later |
| Smaller wallpapers (217 KB -> 170 KB) | `client/*.webp` | Faster chat background |
| Cache headers | `client/vercel.json` | Media cached a week; sw.js always fresh |
| Keep-warm pinger | `.github/workflows/keep-warm.yml` | Server stays awake (needs the repo on GitHub) |

## Things to know
- **After you regenerate `client/index.html` from `app.jsx`, run `node tools/split-app.js`** to move the app out again.
- A new deploy now appears the *second* time the app is opened (the first open shows the saved copy while the new one downloads). To force it, bump `CACHE` in `client/sw.js`.
- `vercel.json` sits in `client/`, so it applies if your Vercel project's Root Directory is `client`.
