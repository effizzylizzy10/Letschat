# Letschat Live

New tab **Live** (between Calls and Updates).

- **Go Live**: host starts a live video, gets a 6-character code and an invite link. Viewers join from the list or with the code.
- **Live Meeting**: same, but everyone is on video (up to 6 people). The host role passes on if the host leaves.
- **Join Live Meeting with Code**: codes exist for meetings only. Type the code (AB12CD style) and tap Join Now. A normal live has no code; people watch it from the list or from the "is live now" alert.
- **Alerts**: when someone goes live, people who share a chat with them (people and groups, not the all-users Chat Room) get an in-app banner with Watch, and a push if the app is in the background. Muted chats, blocked users and repeat alerts within 10 minutes are skipped.
- **Chat list**: a Live video button sits beside the group icon.
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

## Your video (Go Live host and meeting members)
The controls row has a camera button (video on/off) and a sparkle button that opens "Your video":
- **Camera / Picture / Off.** Picture sends a photo from the phone instead of the camera. Off releases the camera and shows a card with the person's initials, so others still see who is there.
- **Effects:** Normal, B&W, Sepia, Warm, Cool, Vivid, Vintage, Soft, Neon. The effect is applied before sending, so everyone sees it. Browsers without canvas filters get all of these except Soft; browsers that cannot process video at all only get video on/off.
- Camera with no effect is sent as-is (no extra CPU use).

## Share screen
- **Live (host) and Live Meeting (everyone):** a screen button in the controls row (or the same stop button) shares the screen instead of the camera; stopping returns to the previous camera/picture/effect. In meetings the sharing tile spans the full row and is shown whole (not cropped). Viewers of a live cannot share.
- **Normal 1:1 and group video calls:** a Share button appears in the call controls once the call is connected. Voice-only calls do not get it.
- Needs the browser's screen capture (`getDisplayMedia`). Desktop Chrome, Edge, Firefox and Safari have it; most phone browsers (including iPhone Safari and Android Chrome) do not, so the button is hidden there.

## Teaching tools
While the person who started the meeting (or the live) is sharing their screen, a toolbar appears above the controls: Mouse, Pen, Highlight, Arrow, Box, Text, Laser pointer, Erase, 6 colours, 3 sizes, Undo and Clear. The marks are drawn into the shared picture itself, so every member sees them (including people who join late) with no extra setup. Marks clear when sharing stops. If the host leaves a meeting, the next person becomes host and gets the tools.
Normal 1:1 and group calls have screen share but not these tools yet.
