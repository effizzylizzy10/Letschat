# Speed upgrades (all free)

| What | Where | Effect |
|---|---|---|
| App split out of index.html (910 KB -> 8 KB page) | `tools/split-app.js`, `client/app.js` | Boot screen shows instantly; app downloads in parallel and is cached separately |
| Scripts deferred, preconnect and preload hints | `client/index.html` | No more blank screen while 5 CDN scripts download one by one |
| Fonts load without blocking | `client/index.html` | Text appears at once |
| Server wake-up ping on open | `client/index.html` | Free Render server starts waking the moment the page opens |
| Service worker: app code network-first (3.5 s timeout), media from device | `client/sw.js` | New deploys show at once, repeat opens stay near-instant, works offline |
| Update banner + hourly/foreground update checks | `client/index.html` | People get new versions without reloading mid-chat |
| Broadcast sends in batches of 100, chat lookup done once | `server/client/server.js` | A creator broadcast never freezes chats for other users |
| React/Firebase/Socket.IO cached on device for good | `client/sw.js` | No network needed for libraries after the first visit |
| Brotli/gzip for API replies (JSON ~95% smaller) | `server/client/compress.js` | Chat lists and messages arrive much faster on mobile data |
| WebSocket-first connection | `client/app.jsx`, `client/app.js` | Skips the slow long-polling handshake (falls back automatically) |
| Lazy images | `client/app.jsx`, `client/app.js` | Off-screen photos load later |
| Smaller wallpapers (217 KB -> 170 KB) | `client/*.webp` | Faster chat background |
| Cache headers | `client/vercel.json` | Media cached a week; sw.js always fresh |
| Keep-warm pinger | `.github/workflows/keep-warm.yml` | Server stays awake (needs the repo on GitHub) |

## Things to know
- **After you regenerate `client/index.html` from `app.jsx`, run `node tools/split-app.js`** to move the app out again.
- A new deploy now appears on the next open (app code is fetched network-first). A "Letschat was updated, tap to refresh" button shows when a new version takes over. To force every device to drop old files, bump `CACHE` in `client/sw.js`.
- `vercel.json` sits in `client/`, so it applies if your Vercel project's Root Directory is `client`.
