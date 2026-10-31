# Friend-suggestion and message pushes (Android app, even when closed)

## What you get
- **Friend suggestions, Facebook style.** Every day, people who have the app get a few notifications like
  "Ada, you have a new friend suggestion: Pretty Chidi", with that person's profile photo shown in the notification.
  They arrive when the app is closed. Suggested people are those you have no private chat with yet, not blocked either way, never the same person twice in a row.
- **New messages.** Already built in: `pushMessage` in `server.js` sends a push for every new message while the app is in the background or closed. Nothing new to add.

## How it works
`suggest-push.js` picks who to suggest and calls the server's own `deliverPush`. `web-push-shim/index.js` sends it through Firebase Cloud Messaging with the photo attached.
`patch-suggest.js` adds one line to `server.js` so it starts `suggest-push.js`. It runs by itself after `npm install` and before `npm start`, so you do not edit `server.js`.
Render logs show `[suggest] server.js hooked` (build) and `[suggest] friend-suggestion pushes on` (start).

## Setup (once)
1. **Render > your service > Environment** (needed for ALL pushes, not just suggestions):
   - `FIREBASE_SERVICE_ACCOUNT` = the whole service-account JSON (Firebase console > Project settings > Service accounts > Generate new private key).
   - `PUBLIC_URL` = your Render address, e.g. `https://your-service.onrender.com` (used for the profile photo link).
2. **Android app:** put `google-services.json` (Android app `com.letschatafrica.app`) at `native/android-src/google-services.json`, then run the APK build. Without it the app cannot register for instant push.
3. Redeploy on Render (Manual Deploy > Deploy latest commit). Open the app once, sign in, and allow notifications.
4. **Keep Render awake.** On Render's free plan the server sleeps after 15 minutes without visitors, and a sleeping server cannot send anything. Use a paid instance, or point a free monitor (UptimeRobot) at `https://your-service.onrender.com/health` every 5 minutes.

## Test it now (one person only)
Add these in Render > Environment, redeploy, then close the app on your phone:
- `SUGGEST_TEST_USERNAME` = your own Letschat username
- `SUGGEST_RUN_NOW` = `1`
About 20 seconds after the server starts you should get up to 3 suggestion notifications. Remove both variables afterwards.
You need at least a few other users in the app who have no chat with you yet.

## Optional settings (Render > Environment)
| Variable | Default | Meaning |
|---|---|---|
| `SUGGEST_PUSH` | on | `off` switches friend suggestions off |
| `SUGGEST_EVERY_HOURS` | 24 | hours between batches for one person |
| `SUGGEST_PER_BURST` | 3 | notifications in one batch (max 8) |
| `SUGGEST_FROM_HOUR` / `SUGGEST_TO_HOUR` | 9 / 21 | only send between these local hours |
| `SUGGEST_TZ_OFFSET` | 1 | hours from UTC for those hours (Nigeria = 1) |
| `SUGGEST_CHECK_MIN` | 30 | how often the server looks for people who are due |
| `SUGGEST_MAX_PER_RUN` | 200 | most people handled in one look |

## Limits you should know
- The photo appears as the big picture inside the notification. The small round photo on the left (as on Facebook) needs a custom Android notification service; not included.
- Browser (website) users get the text only, without the photo, until `client/sw.js` is updated to show it.
- The "already suggested" memory is saved in `data/suggest-state.json`. On Render's free disk it resets on restart, so a fresh batch can come a little sooner after a restart.
- People cannot switch suggestions off inside the app yet. They can turn off the notification channel in Android settings, or you can set `SUGGEST_PUSH=off`.
- If `server.js` is ever replaced by a new version, the hook is added again automatically at the next deploy.
