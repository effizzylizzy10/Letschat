# Letschat native Android app (Capacitor)

A real Android app (not a PWA/TWA install). It loads https://letschat-taupe.vercel.app/ so every website deploy updates the app
too (no new APK needed). Change the address in `capacitor.config.json` > `server.url` if your site moves.

Build with GitHub: Actions > "Build native Android APK (Capacitor)" > Run workflow > download `Letschat-native-apk` from Artifacts.
The `native/android` folder is created by the build and is not stored in the repo.
