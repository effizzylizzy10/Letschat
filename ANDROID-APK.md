# Letschat for Android (APK)

The APK is a thin Android shell (a Trusted Web Activity) around the live website, so it always opens the newest Letschat and needs no updates from the Play Store for normal changes. It has no browser address bar, supports push notifications and location sharing (location delegation is switched on in `android/twa-manifest.json`).

The signing key and its SHA-256 fingerprint are already set up: `client/.well-known/assetlinks.json` (and `client/assetlinks.json`) contain the fingerprint of the key in the separate private zip `Letschat-android-signing-KEEP-PRIVATE.zip`. Never publish that zip, and keep a backup: if the key is lost, people must uninstall the app before they can install an update.

## Easiest way: PWABuilder (no coding, no GitHub)
1. Open https://www.pwabuilder.com and enter your website address.
2. Package for Stores > Android > choose "Other Android (APK)".
3. Package ID `com.letschatafrica.app`. Under signing, choose "Use mine" and upload `letschat.keystore` (alias `letschat`, password in `signing-info.txt`). Turn on Location delegation and Notification delegation.
4. Download the zip, take the `.apk` inside, rename it `Letschat.apk`.

## Automatic way: GitHub Actions
1. Put this project in a PRIVATE GitHub repository.
2. Settings > Secrets and variables > Actions > New repository secret: `ANDROID_KEYSTORE_B64` (the text in `keystore.base64.txt`) and `ANDROID_KEYSTORE_PASSWORD` (the password in `signing-info.txt`).
3. Actions tab > "Build Android APK" > Run workflow. After about 10 minutes download `Letschat-apk` from Artifacts and unzip it to get `Letschat.apk`.
The workflow has not been run yet, so the first run may need a small fix; PWABuilder above is the fallback.

## Publish the APK
Copy `Letschat.apk` into the `client/` folder (next to `index.html`) and redeploy the website. The file is then at `https://YOUR-SITE/Letschat.apk`, and on Android phones the app's "Install app" button (Tools, and the sign-in page) shows a Download app button. Until the file exists, Android phones only see the normal browser install steps.

## What people will see
Android warns about any app installed from a file instead of Google Play: they may have to allow their browser to "install unknown apps", and Play Protect may show a warning. This is normal and cannot be removed in code; only publishing on Google Play (see PLAY-STORE.md) avoids it.

## Changing the website address
If your site is not `letschat-taupe.vercel.app`, change `host`, `iconUrl`, `maskableIconUrl`, `webManifestUrl` and `fullScopeUrl` in `android/twa-manifest.json` and rebuild. Raise `appVersionCode` by 1 for every new APK you publish.
