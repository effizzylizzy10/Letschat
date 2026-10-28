# Tests for the toast logic

These check which messages give a toast (and what the toast says) without a phone or a server:

- `poller/`: runs the real `MessagePoller.java` loop against a fake Letschat server (answers shaped like the real `/api/v1` routes: the
  `{success, data}` envelope, chat list with `lastMessage`, messages with `peek=1`, `me/settings` with muted chats and blocked people).
  Android classes (`android.*`) and `org.json` are small stand-ins in `poller/stubs/`; `MessagePopup.java` and `BubbleController.java` here only record what would be shown (message toasts and the "Letschat check: ..." status toasts).
- `plugin/`: runs `READ_SESSION_JS`, the little script `ChatBubblePlugin.java` runs inside the page to read the saved sign-in (and the two
  notification switches) for the checker. A mistake there would stop the checker from ever starting.
- `bridge/`: runs the real `letschat-native-bridge.js` in a fake page (fake `localStorage`, socket, `fetch` and ChatBubble plugin).

Run them with `bash native/tests/run.sh` (needs a JDK 17+ and Node 18+; takes about half a minute because the poller test waits for real timers).
They are not run by GitHub Actions. Run them after changing `MessagePoller.java`, `ChatBubblePlugin.java` or `letschat-native-bridge.js`.
The stand-ins mirror the Android calls the poller uses; they cannot prove the code compiles against the real Android SDK (the APK build does that).
