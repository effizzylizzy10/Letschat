# Letschat native Android app (Capacitor 8)

A real Android app (not a PWA/TWA install). It loads https://letschat-taupe.vercel.app/ so every website deploy updates the app
too (no new APK needed). Change the address in `capacitor.config.json` > `server.url` if your site moves.

## What is in this folder
- `package.json`: Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/cli` all `^8.0.0`; needs Node 22+ and JDK 21).
- `plugins/background-service` (v8.0.0): keeps the app alive with a foreground service (`remoteMessaging` type, no Android 15 time limit) and restarts it after a reboot or an app update.
- `plugins/chat-bubble` (v8.0.0): a draggable floating Letschat bubble over other apps, with an unread badge. Every new message shows a toast (sender and message) next to the bubble. Tap the bubble (or its toast) and it grows into the WhatsApp-style message card with reply box, Close and View; Close shrinks the card back into the bubble. With no message waiting, a tap opens the app. Drag it to the bottom of the screen to dismiss it. It also injects `letschat-native-bridge.js`, which starts the service after login and shows the bubble when a message arrives while the app is in the background. The website itself is not changed. It also runs the one-time permission set-up (see below) and posts the background message notifications.
- `android-src/`: Android files added on top of the generated `native/android` project (permissions, sign-in link filters, notification icon). See `android-src/README.md`.

## Build
GitHub: Actions > "Build native Android APK (Capacitor 8)" > Run workflow > download `Letschat-apk` from Artifacts.
The `native/android` folder is created by the build and is not stored in the repo.

Local build: `cd native && npm install && npx cap add android && bash android-src/apply.sh && npx cap sync android`, then open `native/android` in Android Studio Otter (2025.2.1) or newer.

## First run on the phone: one-time "allow permissions" set-up
1. Sign in. The background service starts and shows a small "Connected" notification.
2. Letschat asks one question: "Allow permissions now? You only do this once." Tap OK.
3. Android shows its allow dialogs one after another: camera, microphone, contacts, notifications, location, photos and files, nearby devices. (Android always shows one dialog per permission group; an app cannot switch them all on with a single tap.)
4. Android opens "Display over other apps" (for the chat bubble): switch it on and go back.
5. Android asks to ignore battery optimisation: allow it so the connection is not cut when the app is closed.
6. If anything is still off, Letschat offers to open the phone's own app permission settings for Letschat (Settings > Apps > Letschat > Permissions) so you can switch the rest on in one place.

After this the set-up never runs again (it is remembered in the app). If you tap "Cancel" at step 2, Letschat waits a week before asking again. The weekly reminders for "display over other apps" and battery optimisation stay as a safety net. People who finished the set-up before contacts was added are asked for contacts once, on their next sign-in.

## Background message alerts
While Letschat is closed or in the background, every new message from a chat that is not muted shows a normal Android notification (sound, vibration, pops up on screen). It works without "Display over other apps" and with the Floating chat bubble switched off. Tapping it opens Letschat on that chat; the notifications disappear when Letschat is opened. The chat head pop-up is shown as well when the bubble is on and "Display over other apps" is allowed.

## Limits you should know
- Android does not let any app open itself after install. The service starts after the first manual open, and again after every reboot and app update.
- Phones with aggressive battery managers (Tecno, Infinix, Xiaomi, Oppo) may need "Autostart" switched on for Letschat in the phone's settings.
- The alerts come from the in-app checker (about every 8 seconds) while the background service is alive. This is not Firebase push: if the phone's battery manager kills the app, nothing arrives until it is opened again. True push needs `google-services.json` plus token storage and sending on the server.
