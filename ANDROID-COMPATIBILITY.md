# Android versions and APK files

Letschat Africa ships two Android packages with the SAME package ID (`com.letschatafrica.app`) and the SAME signing key.
The website (`client/device.js`) offers the right one by Android version.

| Android version | API | File | How it is built | Status |
|---|---|---|---|---|
| 7.0 and newer | 24+ | `Letschat.apk` | `build-native-apk.yml` (Capacitor 8, JDK 21, SDK 36) | Existing build, unchanged |
| 5.0 to 6.0.1 | 21-23 | `Letschat-legacy.apk` | `build-apk.yml` (Bubblewrap Trusted Web Activity, minSdk 21) | Configured, NOT yet built or run on a device |
| 4.4 and older | 19 and older | none | none | Browser / PWA only (see COMPATIBILITY.md) |

## Why two builds
Capacitor 8 sets minSdk 24 (`tools/validate-apk.sh` also enforces 24), and the two in-repo plugins
(`native/plugins/*/android/build.gradle`) default to 24 and JDK 21. Lowering that would break the build or crash on
Android 5-6, so the native app is left alone. The repository already had a Trusted Web Activity definition with
`minSdkVersion: 21` (`android/twa-manifest.json`); it is kept as the Android 5-6 build instead of replacing anything.

## What the legacy (TWA) build can and cannot do
- It opens the live website full-screen in Chrome (Trusted Web Activity). If Chrome is missing or too old it falls back to Custom Tabs.
- It has NO floating chat bubble and NO foreground background service: those are Capacitor plugins that need API 24+.
  Message alerts depend on web push from Chrome.
- Camera, microphone, calls, notifications and location are whatever Chrome on that phone supports.
- Digital Asset Links (`client/.well-known/assetlinks.json`) already contain the Letschat key, so the address bar is hidden once verified.

## Known risks on Android 5-6 (verify on a real phone)
1. TLS roots: Android 5-7.0 phones have an old system certificate store and may not trust newer certificate chains
   (for example Let's Encrypt roots) used by the website or the Render server. Test `https://letschat-taupe.vercel.app`
   and the API host on an Android 5 or 6 device or emulator. If it fails, the secure fix is a certificate chained to a
   root those phones already trust. Never turn certificate checks off.
2. Chrome updates: Google stops updating Chrome on old Android versions, so the web app must keep working on that
   frozen Chrome. `client/build.js`, `polyfills.js` and `compat.js` already target this (see COMPATIBILITY.md).
3. Bubblewrap SDK support: whether the current Bubblewrap/androidbrowserhelper still builds with minSdk 21 is verified
   by the first run of `build-apk.yml`, which fails with a clear message if it does not.

## Build it
1. Copy `tools/staging/build-apk.yml` to `.github/workflows/build-apk.yml` (the connection used to prepare this change could not write into `.github/workflows`).
2. Actions > "Build legacy Android APK (Android 5-6, Trusted Web Activity)" > Run workflow.
3. Download `Letschat-legacy-apk` from Artifacts, unzip, get `Letschat-legacy.apk`.
4. The build fails early if the signing secrets are missing or are not the Letschat key, and after building it checks
   package ID, signature, versionCode, minSdk 21 and the debuggable flag (`tools/validate-legacy-apk.sh`).
5. Put `Letschat-legacy.apk` next to `Letschat.apk` in `client/` and redeploy the website.

Both APKs are signed with the release key and are meant for device testing first. They are not a Google Play release.

## What has and has not been tested
- Done: reading every Android config file, workflow and script in the repository.
- NOT done (this change was prepared without a build machine): running either workflow, building any APK, or testing on an emulator or phone for any Android version.
- Nothing here claims Android 5, 6 or any other version works until the workflow runs and a device test passes.
