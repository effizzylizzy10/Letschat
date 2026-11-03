# Letschat for Android (APK)

> **Current app:** the Android app is now built as a native Capacitor app by GitHub Actions (see `native/README.md`: build, signing, which messages give a toast, troubleshooting). It uses the same package name (`com.letschatafrica.app`) and must be signed with the same key as the older Trusted Web Activity described below, so it installs over it as an update. The PWABuilder steps below are the older way and stay as a fallback.

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

The "APK publish guard" workflow (`.github/workflows/apk-publish-guard.yml`, script `tools/check-published-apks.sh`) checks every `client/*.apk` on pull requests and pushes. It blocks a file that is signed with an "Android Debug" key or any key other than the Letschat key, has another package ID, is debuggable, or changed without a higher `versionCode` than the published one. Run it from the Actions tab (Run workflow) to check the APKs that are in the repository now.

## What people will see
Android warns about any app installed from a file instead of Google Play: they may have to allow their browser to "install unknown apps", and Play Protect may show a warning. This is normal and cannot be removed in code; only publishing on Google Play (see PLAY-STORE.md) avoids it.

## If Android says "App not installed" (Infinix, Tecno, itel and every other phone)
Android prints the same words for several problems. Check the APK files first (run "APK publish guard"), then the phone:
1. An older Letschat is still on the phone with another signing key, or with a HIGHER version number than the file being installed (Android never installs a lower `versionCode` over a higher one). The most common cause of a different key: early website APKs (24 and 25 Oct 2026) were signed with a throwaway "Android Debug" key, and Android never lets a different key update over an installed app. Fix: save the person's backup first, then hold the Letschat icon, App info, Uninstall, and open the file again. Uninstalling removes the app's local data, and people may have to sign in again.
2. The download was cut short or handled badly by the browser (this happens with some data-saving and built-in browsers). Fix: download again in Chrome. `Letschat.apk` is about 4 MB; a file of a few KB is not the app.
3. The phone is nearly out of storage, or "Install unknown apps" is not allowed for the browser that downloaded the file.

Phones that still have one of the two early test copies (24 and 25 Oct 2026, version 1, debug key) cannot be updated by any new file. Those copies open this website, so `client/device.js` (section 5f) shows them a card once in a while: uninstall once, then download again from the site. The card appears only when the app proves it is an early copy (the app plugin reports a build below 100, or a Capacitor app with no Letschat plugins and without the `LetschatApp` browser marker). The real app (version 101 and higher), the Android 5-6 file and normal browsers never see it. It was tested with simulated phones, not on a real phone.

Keep `client/Letschat.apk` at the newest build: an APK from an older run put on top of a newer one is refused by phones that already took the newer one. `tools/emulator-smoke-test.sh` now installs the published `client/Letschat.apk` first and the new build over it, so a build that phones would refuse as an update fails in "Test APK on Android emulators" with the reason.

Heads-up for 2027: Google is introducing developer verification for apps installed outside Google Play. Enforcement started on 30 September 2026 in Brazil, Indonesia, Singapore and Thailand and is planned to reach all certified Android phones from 2027. Register `com.letschatafrica.app` in the Android Developer Console before then (https://developer.android.com/developer-verification/guides).

## Changing the website address
If your site is not `letschat-taupe.vercel.app`, change `host`, `iconUrl`, `maskableIconUrl`, `webManifestUrl` and `fullScopeUrl` in `android/twa-manifest.json` and rebuild the TWA (raise `appVersionCode` by 1 for every new APK you publish). For the native app, change `server.url` in `native/capacitor.config.json` instead.
