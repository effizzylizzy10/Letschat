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
- **Face effects:** hats, glasses, beard, moustache and beer that follow your face (see FACE.md).
- **Effects:** Normal, B&W, Sepia, Warm, Cool, Vivid, Vintage, Soft, Neon. The effect is applied before sending, so everyone sees it. Browsers without canvas filters get all of these except Soft; browsers that cannot process video at all only get video on/off.
- Camera with no effect is sent as-is (no extra CPU use).

## Share screen
- **Live (host) and Live Meeting (everyone):** a screen button in the controls row (or the same stop button) shares the screen instead of the camera; stopping returns to the previous camera/picture/effect. In meetings the sharing tile spans the full row and is shown whole (not cropped). Viewers of a live cannot share.
- **Normal 1:1 and group video calls:** a Share button appears in the call controls once the call is connected. Voice-only calls do not get it.
- Needs the browser's screen capture (`getDisplayMedia`). Desktop Chrome, Edge, Firefox and Safari have it; most phone browsers (including iPhone Safari and Android Chrome) do not, so the button is hidden there.

## Teaching tools
While the person who started the meeting (or the live) is sharing their screen, a toolbar appears above the controls: Mouse, Pen, Highlight, Arrow, Box, Text, Laser pointer, Erase, 6 colours, 3 sizes, Undo and Clear. The marks are drawn into the shared picture itself, so every member sees them (including people who join late) with no extra setup. Marks clear when sharing stops. If the host leaves a meeting, the next person becomes host and gets the tools.
Normal 1:1 and group calls have screen share but not these tools yet.

## Pinned message and bubbles
- **Pin:** the host (in a meeting, whoever is host now) and the creator account can select a comment and tap Pin. The message shows at the top of the chat for everyone, including people who join later. Tap Unpin (or the x on the banner) to remove it. Server events: `live:pin` / `live:pinned`.
- **Bubbles:** in Go Live, colourful see-through bubbles keep floating up the right side of the screen. They are skipped when the phone asks for reduced motion.
- Files: `client/live.js` and `server/client/live.js` only. Deploy the server first, then the client.

Update: the Room and Live tabs were removed from the bottom bar. Both are still reachable from the icons at the top of the Chats screen (people icon = Room, video icon = Live).

## Recording
- A round red record button sits in the controls row (host of a Go Live, and everyone in a Live Meeting). Tap to start (it shows the time), tap again to stop. The video is saved to the phone's Downloads (`letschat-live-CODE-date.webm`, or `.mp4` on iPhone). Nothing is uploaded.
- It records what you see and hear: the host's picture (live), or the grid of everyone (meeting), plus all voices. Effects, screen share and people joining are kept.
- Leaving the live while recording also saves the file. Only the person who tapped Record knows; others are not told, so ask people before recording a meeting.
- Stickers, emojis, gift banners, bubbles, the pinned message and the latest comments (Go Live) are painted into the recording too.
- Needs MediaRecorder and canvas capture (all current Chrome, Edge, Firefox, Samsung Internet and Safari 14.5+); otherwise the button is hidden. Files grow about 9 MB per minute.
- Files: `client/live.js` only.

## Animated stickers with sound
- Every live sticker and live emoji now moves (wow wobbles, fire flickers, angry shakes with a red glow, crying bobs with falling tears, hearts beat, clap claps, rocket shakes, crown spins, party jumps...) in the picker and when it floats up the screen. Phones set to reduce motion get no animation.
- Each one also has its own sound, played for everyone in the live: laugh = "ha ha ha", angry = growl, cry = sobbing "wah wah", clap = applause, fire = crackle, rocket = whoosh, party = pop + fanfare, crown = royal notes, panda = squeaks, kiss = smooch, 100 = ding, heart/love = chime/heartbeat. **Wow** and **GG** are spoken ("Wow!", "Good game!") by the phone's voice, with a made-up "waow" if the phone has no voice.
- Sounds are made on the phone (Web Audio), so there are no files to add. The speaker button in the sticker / emoji panel turns them off on that phone. At most 3 sounds a second play, so tap-spamming stays pleasant.
- New stickers: Angry, Crying, Party, Kiss. **The server must be redeployed (Render)** because it keeps the list of allowed stickers (`server/client/live.js`), then the client.
- The Status editor's stickers are flattened into the photo, so they cannot move or make sound.

## Big stickers and event sounds
- Stickers now pop in big (about 120 px, text stickers like WOW! 64 px) in the middle of the screen, then float up and fade. Live emojis stay smaller. To change the size edit `fontSize: f.big ? (wide ? 64 : 120) : 40` in `client/live.js`.
- Live event sounds (same speaker button turns all of them off): someone joins / leaves (meetings, and the host of a live), a new comment, you are @mentioned, a message is pinned, someone starts sharing their screen, a gift (sparkle), and the live ending.

Update: emoji no longer play a sound in Live Meetings (they still animate). Stickers, gifts and the other event sounds are unchanged.
