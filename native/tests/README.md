# Tests for the alert logic

These check which messages give an alert (and what it says) and how the one-time permission set-up behaves, without a phone or a server:

- `poller/`: runs the real `MessagePoller.java` loop against a fake Letschat server (answers shaped like the real `/api/v1` routes: the
  `{success, data}` envelope, chat list with `lastMessage`, messages with `peek=1`, `me/settings` with muted chats and blocked people).
  Android classes (`android.*`) and `org.json` are small stand-ins in `poller/stubs/`; `MessagePopup.java` here only records what would be shown on the chat head, and the notification manager stand-in records the notifications that would be posted (and cleared).
- `plugin/`: runs `READ_SESSION_JS`, the little script `ChatBubblePlugin.java` runs inside the page to read the saved sign-in (and the two
  notification switches) for the checker. A mistake there would stop the checker from ever starting.
- `bridge/`: runs the real `letschat-native-bridge.js` in a fake page (fake `localStorage`, socket, `fetch` and ChatBubble plugin), including the one-time permission set-up and the one-time contacts question.

Run them with `bash native/tests/run.sh` (needs a JDK 17+ and Node 18+; takes about 40 seconds because the tests wait for real timers).
They are not run by GitHub Actions. Run them after changing `MessagePoller.java`, `ChatBubblePlugin.java` or `letschat-native-bridge.js`.
The stand-ins mirror the Android calls the code uses; they cannot prove the code compiles against the real Android SDK (the APK build does that).
