# Letschat notifications: server API and how to check it

## What runs where
- **Sending:** `server.js` calls `deliverPush()`. `web-push-shim/index.js` sends through Firebase (Android, iOS, Firebase web) or classic Web Push (VAPID browsers).
- **Settings, history, device guard:** `notifications-api.js` wraps `deliverPush()` so every alert is recorded, checked against the person's settings, and sent only to the account that registered the device last.
- **Hook:** `patch-notifications.js` adds one line to `server.js` on `npm install` and `npm start` (same pattern as `patch-suggest.js`). Look for `[notif] notification API ready` in the Render logs.

## Routes (all need `Authorization: Bearer <token>`; each works only on the signed-in person's own data)
| Route | What it does |
|---|---|
| `GET /api/notifications?limit=30&before=<time>&unread=1` | History, newest first. Returns `items`, `nextBefore`, `unread`. |
| `GET /api/notifications/unread-count` | `{ count }` for the app badge. |
| `POST /api/notifications/read` `{ id }` or `{ tag }` | Mark one alert, or all alerts of one chat (`tag` is `conv-<chatId>`), as read. Call it when a chat is opened. |
| `POST /api/notifications/read-all` | Mark everything as read. |
| `DELETE /api/notifications/:id` | Delete one. |
| `DELETE /api/notifications` | Delete all. |
| `GET /api/notifications/preferences` | The person's settings, the same on every device. |
| `PUT /api/notifications/preferences` | Change settings (send only the keys to change). |
| `POST /api/notifications/test` | Send a test alert to the person's own devices. |
| `GET /api/push/status` | `{ firebase, webPush, devices }`: which channels the server can send on. No secrets. |
| `GET /api/push/devices` | Registered devices (token shown only as its last 6 characters). |
| `DELETE /api/push/devices/:id` | Forget one device. |

Device registration stays at the existing `POST /api/push/subscribe` and `POST /api/push/unsubscribe`.

## Settings keys
`all, messages, groups, calls, missedCalls, friendRequests, mentions, reactions, live, gifts, suggestions, sound, vibration, preview, chatHeads` (true/false, default true) and
`quietHours: { enabled, start "22:00", end "07:00", utcOffsetMinutes (e.g. 60 for Lagos), allowCalls }`.

What the server enforces today: `all`, `messages`, `groups`, `calls`, `missedCalls`, `suggestions`, `friendRequests`, `mentions`, `reactions`, `preview`, quiet hours (calls pass if `allowCalls`), and `sound`/`vibration` on iPhone and browsers.
What the app itself must apply: `sound` and `vibration` on Android 8+ (they belong to the notification channel), and `chatHeads` (the floating bubble). The server stores and returns them.
Alert kinds are recognised from the push payload (`call`, "missed call", `conv-` tags, and so on). An alert the server cannot classify is always allowed.

## Check list (run on real phones; nothing here has been tested on a device)
1. Render logs show `[fcm] Firebase Cloud Messaging ready` and `[notif] notification API ready`.
2. `GET /api/push/status` returns `firebase: true`.
3. Sign in on the phone, allow notifications, call `POST /api/notifications/test`: the phone shows an alert with the app open, minimised, closed and locked.
4. Sign out, sign in as a different person on the same phone, send a message to the first person: the phone must NOT show it.
5. Turn `messages` off with `PUT /api/notifications/preferences`: no new message alerts; calls still ring.
6. Set quiet hours to cover now: no alerts except calls.
7. Two devices on one account: both get the alert; `GET /api/push/devices` lists both.
