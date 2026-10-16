# Letschat Live

New tab **Live** (between Calls and Updates).

- **Go Live**: host starts a live video, gets a 6-character code and an invite link. Viewers join from the list or with the code.
- **Live Meeting**: same, but everyone is on video (up to 6 people). The host role passes on if the host leaves.
- **Join Live with Code**: type the code (AB12CD style) and tap Join Now.
- In every live: comments, reply (select a comment, tap Reply), @mention (tap @ or type @name), react (select a comment, or double tap for a heart), floating emojis, live stickers, gifts (free virtual gifts, no payments), viewer count, copy/share invite.
- The creator account can end any live. The host can remove a viewer (server event `live:kick`).

## Files
- `server/client/live.js` (new) and 2 lines in `server/client/server.js` (load + `live.attach(socket)`).
- `client/live.js` (new). `client/app.js`: Live tab, mount point, and "busy" checks so calls don't ring during a live.
- `responsive.js`, `sw.js`, `build.js`: load/cache/build `live.js`. Deploy the server (Render) first, then the client (Netlify).

## Limits (peer-to-peer video)
Each sender uploads one video copy per viewer, so the first 8 viewers of a live get video, and a meeting fits 6. More people can join the chat, gifts and stickers without video. For thousands of video viewers, put a media server (LiveKit, mediasoup) behind the `live:signal` relay.
For calls across strict mobile networks, add a TURN server in `config.js` (`ICE_SERVERS`), same as for existing calls.
Live is skipped on lite/keypad screens (like reactions).
