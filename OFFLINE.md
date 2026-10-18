# Working with no or very poor network (v69)

## What now works with no connection
- **Opens instantly offline**, even the very first time after installing: the service worker now saves React, Firebase and Socket.IO when it installs (before, they were only saved after first use, so going offline right after the first visit gave a blank "could not load React" screen).
- **Chat list, messages, status, market, settings...** open from the device. Every successful read is saved (IndexedDB) and used when there is no network, or when the line is so slow that the answer takes longer than 6 s. When the real answer finally arrives the open chat updates by itself.
- **Sending**: text, photos, files and voice notes are saved in an **outbox** on the device and sent one by one, in order, as soon as the connection is up. They survive a reload, a closed app and a phone restart. A failed one shows "Not sent" with Retry (which re-sends the same photo / voice note, not just text).
- **No double messages**: every message carries a `clientId`; the server returns the stored copy if it sees the same one again, so a lost acknowledgement on a weak line cannot post twice.
- A small pill shows "Offline", "Weak connection" or "N messages waiting to send" (hidden inside a chat, which has its own strip). The misleading "Waking up the server" bar and the 1.2 s polling no longer run while the phone is offline. Offline writes (profile edit, reactions, etc.) fail at once with "No internet connection" instead of "Failed to fetch".

## What still needs a network
Voice/video calls, Letschat Live, games, sign-in (first time), downloading media that was never opened online, posting a status / market item, editing or deleting a sent message.

## Files
- `client/offline.js` (new): device store, read cache, outbox (`window.LCOffline`, `window.LCOutbox`), status pill. Loaded before `app.js`.
- `client/app.js`: `api()` is now a cache-aware wrapper around `apiNet()`; chat screen restores queued messages and listens for `lc:outbox` / `lc:fresh` events; text, file and voice sends go through the outbox; the outbox is bound to the socket and wiped on sign-out.
- `client/sw.js` (v69): precaches the libraries, adds `offline.js` and `app.legacy.js` to the saved shell.
- `client/index.html`, `build.js`, `_headers`, `vercel.json`: load / build / serve `offline.js`.
- `server/client/server.js`: `handleSend` accepts `clientId` and de-duplicates (last 600 messages scanned).

## Deploy
Redeploy **both** the client (Netlify / Vercel) and the Render server. The client works without the server change, but then a lost acknowledgement can occasionally post a message twice.
As in the notes in `AI-ASSISTANT.md`, `client/app.jsx` is older than `app.js` and was **not** changed; do not regenerate `app.js` from it.

## Storage
Reads cache at most 160 entries (oldest dropped); inline photos over ~350 KB and voice notes are not kept in the saved message lists. The browser is asked for persistent storage so saved chats are not evicted.
