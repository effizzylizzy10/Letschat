# Letschat for Android (APK)

> **Current app:** the Android app is now built as a native Capacitor app by GitHub Actions (see `native/README.md`: build, signing, which messages give an alert, permissions, troubleshooting). It uses the same package name (`com.letschatafrica.app`) and must be signed with the same key as the older Trusted Web Activity described below, so it installs over it as an update. The PWABuilder steps below are the older way and stay as a fallback.

The older APK is a thin Android shell (a Trusted Web Activity) around the live website, so it always opens the newest Letschat and needs no updates from the Play Store for normal changes. It has no browser address bar, supports push notifications and location sharing (location delegation is switched on in `android/twa-manifest.json`).

The signing key and its SHA-256 fingerprint are already set up: `client/.well-known/assetlinks.json` (and `client/assetlinks.json`) contain the fingerprint of the key in the separate private zip `Letschat-android-signing-KEEP-PRIVATE.zip`. Never publish that zip, and keep a backup: if the key is lost, people must uninstall the app before they can install an update.

## Automatic way: GitHub Actions (builds the native app)
1. Settings > Secrets and variables > Actions > **Repository secrets** > New repository secret: `ANDROID_KEYSTORE_B64` (the text in `keystore.base64.txt`) and `ANDROID_KEYSTORE_PASSWORD` (the password in `signing-info.txt`, key alias `letschat`). The repository is public: secrets stay private, but never commit the keystore or those two files to git (the root `.gitignore` blocks them).
2. Actions tab > "Build native Android APK (Capacitor 8)" > Run workflow. After about 10 minutes open the run, download `Letschat-apk` from Artifacts (at the bottom of the run page) and unzip it to get `Letschat.apk`.
3. If a secret is missing or the key is not the Letschat key, the run stops at its first step and the error message explains why, instead of building an APK that Android would refuse to install over your current app ("App not installed"). What to do about a lost key is in `native/README.md`.

## Easiest way for the older TWA: PWABuilder (no coding, no GitHub)
1. Open https://www.pwabuilder.com and enter your website address.
2. Package for Stores > Android > choose "Other Android (APK)".
3. Package ID `com.letschatafrica.app`. Under signing, choose "Use mine" and upload `letschat.keystore` (alias `letschat`, password in `signing-info.txt`). Turn on Location delegation and Notification delegation.
4. Download the zip, take the `.apk` inside, rename it `Letschat.apk`.

## Publish the APK
Copy `Letschat.apk` into the `client/` folder (next to `index.html`) and redeploy the website. The file is then at `https://YOUR-SITE/Letschat.apk`, and on Android phones the app's "Install app" button (Tools, and the sign-in page) shows a Download app button. Until the file exists, Android phones only see the normal browser install steps.

## What people will see
Android warns about any app installed from a file instead of Google Play: they may have to allow their browser to "install unknown apps", and Play Protect may show a warning. This is normal and cannot be removed in code; only publishing on Google Play (see PLAY-STORE.md) avoids it.

## Changing the website address
If your site is not `letschat-taupe.vercel.app`, change `host`, `iconUrl`, `maskableIconUrl`, `webManifestUrl` and `fullScopeUrl` in `android/twa-manifest.json` and rebuild the TWA (raise `appVersionCode` by 1 for every new APK you publish). For the native app, change `server.url` in `native/capacitor.config.json` instead.
