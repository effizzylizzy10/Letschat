# Letschat in the phone's Share menu

Changed files: client/manifest.json (share_target), client/sw.js (receives the share), client/app.js (opens "Send to...").
app.jsx was not changed (it is older than app.js, see AI-ASSISTANT.md).

- Android (Chrome / Edge / Samsung Internet): the app must be INSTALLED (Install app / Add to Home screen). A browser tab alone never appears
  in the Share menu. After this deploy, uninstall and reinstall once so Android re-reads the manifest.
- Sharing text, a link, photos, videos (max 3 MB), PDFs or documents opens "Send to..." so you pick chats (or your status).
- iPhone Safari does not support Web Share Target, so Letschat cannot appear in the iPhone Share menu.
- Play Store (TWA) build: rebuild the app after deploying so it picks up the new manifest.
