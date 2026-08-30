# Loop — Android (APK) build

This folder wraps the same web app (in `www/`) into a real Android project
using [Capacitor](https://capacitorjs.com/). I can't produce a finished
`.apk` binary myself — building one requires the Android SDK and Gradle,
which need to run on a machine with them installed. This folder has
everything set up so that process is short once you're on that machine.

You have two options. **Option A is much easier and needs no Android
Studio at all.**

---

## Option A — PWABuilder (no local setup, ~5 minutes)

Since Loop is already a valid PWA (it has `manifest.json` + `sw.js`), you
can skip this whole folder and generate a signed APK/AAB straight from your
deployed Netlify URL:

1. Deploy the client to Netlify first (see the other zip / main README).
2. Go to **https://www.pwabuilder.com**
3. Enter your Netlify URL and click **Start**
4. Click **Package for stores** → **Android**
5. Download the generated APK (or AAB, for Play Store submission)

This uses the same manifest and icons already in `www/`. It's the fastest
path to an installable APK.

---

## Option B — Build it yourself with Capacitor (full control)

Use this if you want to customize native behavior later (push
notifications, native icons/splash — already scaffolded in `assets/` — app
permissions, etc).

### Prerequisites (install these first)
- [Node.js](https://nodejs.org) 18+
- [Android Studio](https://developer.android.com/studio) (includes the
  Android SDK) — open it once after installing so it finishes its own setup
- A Java JDK 17 (Android Studio can install one for you during setup)

### Steps

```bash
cd loop-android
npm install

# This generates the android/ folder (not included here — it's
# machine-specific and regenerated fresh each time)
npx cap add android

# Copies www/ into the native project
npx cap sync android

# Generates all the native icon sizes + splash screen from assets/
npx @capacitor/assets generate --android

npx cap sync android
```

Then either:

**Build from Android Studio (recommended first time):**
```bash
npx cap open android
```
Android Studio opens. Once Gradle finishes syncing (first time takes a
few minutes), go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
The finished file appears at
`android/app/build/outputs/apk/debug/app-debug.apk` — copy that to your
phone and install it (you'll need to allow "install from unknown sources"
the first time).

**Or build from the command line, no Android Studio UI needed:**
```bash
cd android
./gradlew assembleDebug
```
Same output path as above.

### Signing for release (Play Store)

The debug APK above is fine to install directly on a phone for testing.
Publishing to the Play Store requires a **signed release build** — Android
Studio's **Build → Generate Signed Bundle / APK** wizard walks you through
creating a signing key the first time. Keep that keystore file somewhere
safe; you need the same one for every future update.

### If the app opens to a blank screen

Confirm `www/config.js` points at your **deployed** server (not
`localhost` — that only works on the same machine as the server itself).
The native WebView needs real internet URLs for both `API_URL` and
`SOCKET_URL`.
