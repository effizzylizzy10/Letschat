# android-src

Android files that are laid over the project Capacitor generates (`native/android` is not stored in git).
`apply.sh` runs right after `npx cap add android`:

- `res/` is copied into `android/app/src/main/res/` (notification icon `ic_stat_letschat`).
- `patch_manifest.py` adds the app permissions (camera, microphone, location, notifications, boot, foreground service, overlay, battery) and the intent filters that open email sign-in links in the app.
- `make_icons.py` puts the LA logo (from `client/icons`) on the app: launcher icons for old and new Android versions (square, round and adaptive) and the start-up pictures. `apply.sh` runs it by itself and installs Pillow if it is missing. It works on a copy of the `res` folder, so if anything goes wrong the build simply continues with Capacitor's default pictures.

The two Capacitor plugins in `../plugins/` bring their own Java code, services and manifest entries, so nothing else needs editing by hand.
Change the host names in `patch_manifest.py` if your website or Firebase project address changes.
