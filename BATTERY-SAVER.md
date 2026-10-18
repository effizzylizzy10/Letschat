# Letschat in battery saver / power-saving mode

Battery saver (Android) and power-saving modes slow the processor, pause timers in the background, delay "normal" push alerts and make the browser refuse the Screen Wake Lock. What Letschat does about each:

- **Update page**: checks `version.json` whenever the app comes back to the screen (see the update fix), so it does not rely on timers or on the service worker.
- **Start-up**: `responsive.js` now waits up to 25 s per library (was 9 s) and 75 s overall (was 30 s). Giving up early on a slow phone loaded a second copy of React from the backup host and crashed the app.
- **Screen stays on in calls and lives**: `window.lcKeepAwake()` (in `compat.js`) asks for the wake lock again every 15 s, when the app returns, and after the lock is dropped. Used by voice/video calls and by the host and members of a Live / Live Meeting.
- **Push alerts**: messages, calls and announcements were already high priority; "is live now" alerts are now high priority too (server change, redeploy Render first).
- **Reconnecting**: the app already reconnects the chat connection and refreshes chats when it returns to the screen, comes online or regains focus.

Things no web app can force: a phone that kills background apps (some Xiaomi, Tecno, Infinix, Oppo phones) can still stop push alerts until the app is opened. Ask people to set Letschat to "No restrictions" / "Unrestricted" in the phone's battery settings.

## "Unrestrict" prompt
- A web app / Play Store (TWA) app **cannot switch off Android's battery restriction by itself**; only the person can, in the phone's settings. So after sign-in (25 s later, never during a call or live) Android phones get a one-time card with the exact steps for their brand (Samsung, Xiaomi, Tecno / Infinix / itel, Oppo / Realme / Vivo, Huawei / Honor, others). Buttons: Done, Remind me later (7 days), Don't show again. It lives in `client/compat.js`; `window.lcShowBatteryHelp()` opens it on demand (for example from a Help screen button).
- It also asks the browser to keep the app's saved data (`navigator.storage.persist()`).
- A real "allow without a settings visit" exists only in a native Android wrapper: add `android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` and start the `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` intent. Google Play only accepts it for apps whose core function breaks without it, so check the policy first. The Play Store build here is a Trusted Web Activity, which cannot run that intent.
