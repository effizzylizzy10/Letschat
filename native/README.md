# Letschat native Android app (Capacitor 8)

A real Android app (not a PWA/TWA install). It loads https://letschat-taupe.vercel.app/ so every website deploy updates the app
too (no new APK needed). Change the address in `capacitor.config.json` > `server.url` if your site moves.

## What is in this folder
- `package.json`: Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/cli` all `^8.0.0`; needs Node 22+ and JDK 21).
- `plugins/background-service` (v8.0.0): keeps the app alive with a foreground service (`remoteMessaging` type, no Android 15 time limit) and restarts it after a reboot or an app update.
- `plugins/chat-bubble` (v8.0.0): a draggable floating Letschat bubble over other apps, with an unread badge. Every new message shows a toast (sender and message) next to the bubble. Tap the bubble (or its toast) and it grows into the WhatsApp-style message card with reply box, Close and View; Close shrinks the card back into the bubble. With no message waiting, a tap opens the app on its Calls tab. Drag it to the bottom of the screen to dismiss it. It also injects `letschat-native-bridge.js`, which starts the service after login and shows the bubble when a message arrives while the app is in the background. The website itself is not changed. It also runs the one-time permission set-up (see below) and posts the background message notifications.
- `android-src/`: Android files added on top of the generated `native/android` project (permissions, sign-in link filters, notification icon, version number). See `android-src/README.md`.
- `tests/`: offline checks for the alert logic (no phone or server needed). See `tests/README.md`.

## Which messages give an alert
Two paths feed the same alerts (a message that arrives on both is shown once):
- the live chat connection, through `letschat-native-bridge.js`, while the page is still alive in the background (chat head pop-up);
- `MessagePoller` (native Java), which asks the server for the chat list every 8 seconds while the app is not on screen, so the alert also works when the live connection is gone or the app was closed. `ChatBubblePlugin` hands it the saved sign-in (and the two notification switches) straight from the page's storage whenever the page loads, Letschat is opened, and Letschat is minimised, so it does not depend on the page's own script.

**Background alert (notification):** every new message that passes the rules below posts a normal Android notification (sound, vibration, pops up on screen, text hidden on the lock screen). It works without "Display over other apps" and with the Floating chat bubble switched off. Tapping it opens Letschat on that chat, and the notifications disappear when Letschat is opened. The chat head pop-up is shown as well when the bubble is on and "Display over other apps" is allowed.

Both follow the same rules as the website's own alerts and the server's push alerts:
- no alert for your own messages (sent from another device), deleted messages, or system notices ("Amaka joined the group");
- no alert for a chat you muted, or for a person you blocked;
- no alert for groups while "Group messages" is off in Settings > Notifications;
- in the big Chat Room, only for messages that @mention you or reply to you;
- with "Show message preview" off, the alert says "New message" (or "Mentioned you" / "Replied to you") instead of showing the text.
If the mute/block list cannot be read at that moment, the alert is shown anyway (one too many beats a missed message).

### What the checker is doing (log only)
The chat head only ever shows real messages. What the checker decides, and its problems, are written to the Android log under the tag `LetschatPoller` (`adb logcat -s LetschatPoller`):

| Log line | Meaning and what to do |
|---|---|
| `status: watching N chats for new messages` | All good: the checker is running and has your chat list. |
| `status: not signed in` / `not running (no sign-in received yet)` | The checker has no sign-in. Open Letschat, sign in, minimise again. |
| `status: the server refused your sign-in` | The saved sign-in is no longer accepted. Sign out and in again. |
| `status: cannot reach the server right now (...)` | No internet, or the server is asleep (free hosting sleeps when idle). The reason in brackets helps: `UnknownHostException` = no internet. |
| `status: the server answered, but not with a chat list` | The server is up but answered something unexpected (for example an error page while it wakes up). |
| `status: new message ignored: it looks like it was sent by you` | The app thinks the new message is yours (user id mismatch or a message you sent elsewhere). |
| `notifications are switched off for Letschat in the phone settings` | Turn notifications on for Letschat in the phone's app settings. |
| `chat is muted: no alert` | The chat is muted, as intended. |

## Build
GitHub: Actions > "Build native Android APK (Capacitor 8)" > Run workflow. About 10 minutes later the APK is under **Artifacts** at the bottom
of the finished run (`Letschat-apk`, a .zip with `Letschat.apk` inside).
The `native/android` folder is created by the build and is not stored in the repo.

### Signing (one-time setup, needed for the APK to install over the app you already have)
Android only installs an update when the new APK has the **same signing key** and a **higher version number** than the installed app.
The workflow raises the version number by itself on every run (`100 + run number`). The key you provide once, as two repository secrets:

1. On GitHub: this repository > Settings > Secrets and variables > Actions > **Repository secrets** > New repository secret.
2. `ANDROID_KEYSTORE_B64` = the whole text inside `keystore.base64.txt`; `ANDROID_KEYSTORE_PASSWORD` = the key password from `signing-info.txt` (alias `letschat`).
3. Run the workflow. Its first step (`tools/check-signing.sh`) checks the key: its SHA-256 fingerprint must match `EXPECTED_SHA256` at the top of the workflow (the key the installed app was signed with). It **stops at once with an explanation** if a secret is missing or the key is wrong, instead of building an APK that Android would refuse. After the build, the last signing step checks the certificate of the finished APK again and prints it in the log (`APK certificate SHA-256`).

This repository is public: the secrets are safe (only the workflow can read them), but never commit `*.keystore`, `*.jks`, `keystore.base64.txt` or `signing-info.txt` (the root `.gitignore` blocks them). Keep a private backup of the keystore: if the key is lost, people must uninstall the app once before they can install an update.

If the original key is lost, a new key works too, but everybody has to uninstall the old app once (saved login is lost); after that updates install normally. Put the new keystore in the two secrets and replace `EXPECTED_SHA256` in the workflow with the new key's fingerprint.

Local build: `cd native && npm install && npx cap add android && bash android-src/apply.sh && npx cap sync android`, then open `native/android` in Android Studio Otter (2025.2.1) or newer.

## First run on the phone: one-time "allow permissions" set-up
1. Sign in. The background service starts and shows a small "Connected" notification.
2. Letschat asks one question: "Allow permissions now? You only do this once." Tap OK.
3. Android shows its allow dialogs one after another: camera, microphone, contacts, notifications, location, photos and files, nearby devices. (Android always shows one dialog per permission group; an app cannot switch them all on with a single tap.)
4. Android opens "Display over other apps" (for the chat bubble): switch it on and go back.
5. Android asks to ignore battery optimisation: allow it so the connection is not cut when the app is closed.
6. If anything is still off, Letschat offers to open the phone's own app permission settings for Letschat (Settings > Apps > Letschat > Permissions) so you can switch the rest on in one place.

After this the set-up never runs again (it is remembered in the app). If you tap "Cancel" at step 2, Letschat waits a week before asking again. The weekly reminders for "display over other apps" and battery optimisation stay as a safety net. People who finished the set-up before contacts was added are asked for contacts once, on their next sign-in.

## If something does not work
- **"App not installed" when installing the APK.** Almost always a signing-key mismatch: the app on the phone was made with another key (an earlier debug build, or a build made before the secrets were set). Uninstall Letschat once, then install the new APK; builds signed with the Letschat key update normally from then on. The last signing step of the workflow run prints the certificate fingerprint of the APK you downloaded.
- **No alert for a new message.** Check, in this order: Letschat is signed in; notifications are allowed for Letschat (and the "New messages" channel is not silenced) in the phone's settings; battery optimisation is switched off for Letschat; the chat is not muted, is not the big Chat Room (only @mentions and replies there), and "Group messages" is on in Settings > Notifications for groups. For the chat head pop-up also: "Display over other apps" is allowed and "Floating chat bubble" is on. With a phone connected, `adb logcat -s LetschatPoller` shows every decision the checker makes ("announcing 1 message(s) from Bob", "chat is muted: no alert", "server refused the sign-in token", ...).

## Limits you should know
- Android does not let any app open itself after install. The service starts after the first manual open, and again after every reboot and app update.
- Phones with aggressive battery managers (Tecno, Infinix, Xiaomi, Oppo) may need "Autostart" switched on for Letschat in the phone's settings.
- A new message reaches the alert within about 8 seconds when the live connection is down (the checker's interval); with the connection up the chat head pop-up is immediate.
- This is not Firebase push. The alerts come from the in-app checker while the background service is alive; if the phone's battery manager kills the app, nothing arrives until it is opened again. True push needs `google-services.json` in the build plus push-token storage and sending on the server.
