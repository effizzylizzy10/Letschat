# android-src

Android files that are laid over the project Capacitor generates (`native/android` is not stored in git).
`apply.sh` runs right after `npx cap add android`:

- `res/` is copied into `android/app/src/main/res/` (notification icon `ic_stat_letschat`).
- `patch_manifest.py` adds the app permissions (camera, microphone, location, notifications, boot, foreground service, overlay, battery) and the intent filters that open email sign-in links in the app.
- `apply.sh` also sets `versionCode` (100 + the GitHub run number) and `versionName` so every build installs as an update.

The two Capacitor plugins in `../plugins/` bring their own Java code, services and manifest entries, so nothing else needs editing by hand.
Change the host names in `patch_manifest.py` if your website or Firebase project address changes.
