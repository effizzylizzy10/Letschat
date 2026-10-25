# Letschat native Android app (Capacitor 8)

A real Android app (not a PWA/TWA install). It loads https://letschat-taupe.vercel.app/ so every website deploy updates the app
too (no new APK needed). Change the address in `capacitor.config.json` > `server.url` if your site moves.

## What is in this folder
- `package.json`: Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/cli` all `^8.0.0`; needs Node 22+ and JDK 21).
- `plugins/background-service` (v8.0.0): keeps the app alive with a foreground service (`remoteMessaging` type, no Android 15 time limit) and restarts it after a reboot or an app update.
- `plugins/chat-bubble` (v8.0.0): a draggable floating Letschat bubble over other apps, with an unread badge and a short message preview. Tap it to open the app. Drag it to the bottom of the screen to dismiss it. It also injects `letschat-native-bridge.js`, which starts the service after login and shows the bubble when a message arrives while the app is in the background. The website itself is not changed.
- `android-src/`: Android files added on top of the generated `native/android` project (permissions, sign-in link filters, notification icon). See `android-src/README.md`.

## Build
GitHub: Actions > "Build native Android APK (Capacitor 8)" > Run workflow > download `Letschat-apk` from Artifacts.
The `native/android` folder is created by the build and is not stored in the repo.

Local build: `cd native && npm install && npx cap add android && bash android-src/apply.sh && npx cap sync android`, then open `native/android` in Android Studio Otter (2025.2.1) or newer.

## First run on the phone
1. Sign in. The background service starts and shows a small "Connected" notification (allow notifications when asked).
2. Android asks to "Display over other apps": allow it for the chat bubble.
3. Android asks to ignore battery optimisation: allow it so the connection is not cut when the app is closed.

## Limits you should know
- Android does not let any app open itself after install. The service starts after the first manual open, and again after every reboot and app update.
- Phones with aggressive battery managers (Tecno, Infinix, Xiaomi, Oppo) may need "Autostart" switched on for Letschat in the phone's settings.
- The bubble appears when the live chat connection receives a message. Messages sent while the connection is down arrive through normal web push or on next open.
