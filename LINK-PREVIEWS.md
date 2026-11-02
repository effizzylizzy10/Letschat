# Link previews (YouTube and other links)

When someone sends a link in a chat, the app shows a small card under the message with a picture, a title and a line of text. This is "link previews v2". The card is made by the server, so **no new APK and no website redeploy is needed**: the Android app loads your website and API, and the new cards appear after the server (Render) is redeployed.

## What you will see
- **YouTube** links (watch, youtu.be, Shorts, live, playlists, music.youtube.com): the video title, the channel name and the thumbnail. Tapping the card still plays the video inside Letschat (`client/ytplayer.js`), including a link with a start time such as `?t=42`. No YouTube API key is needed (it uses YouTube's free oEmbed service). If YouTube cannot be reached, a card with the thumbnail and the words "YouTube video" is shown. A video that was removed or is private gets no card.
- **Vimeo, TikTok video, Spotify and SoundCloud** links: the same kind of card from their own oEmbed service.
- **Any other website**: title, description and picture from the page's Open Graph / Twitter / normal tags. Pages in other text encodings (accents, Arabic, Chinese...) are read correctly, and picture addresses starting with `http://` are upgraded to `https://` because the Android app does not show plain `http` pictures.
- **A link straight to a picture or a PDF**: a simple card with the file name.
- **No card** for login pages, cookie-consent pages and "checking your browser" pages (they only show a wrong title), and for pages that need a sign-in such as most Facebook and Instagram posts.

Good results are kept for 6 hours and failures for 2 minutes, so a site that was slow once is tried again soon.

## Where the code is
- `server/client/link-preview.js`: the whole feature. It answers `GET /api/v1/link-preview?url=...` with `{ preview: { url, title, description, image, site } }`, the same shape as before, so the app code is unchanged.
- `server/client/patch-link-preview.js`: adds one line to `server.js` that starts the module, the same way `patch-suggest.js` does for friend suggestions. It runs by itself after `npm install` and before `npm start`, so Render needs no new setting, and running it again does nothing. The older built-in preview route stays in `server.js` as a fallback: if the module cannot start, the server logs `[link-preview] not started: ...` and keeps working as before.
- `server/client/link-preview.test.js`: automatic checks. Run `cd server/client && npm run test:link-preview` (needs Node 18 or newer, no internet).

## How to check it is on
In the Render logs after a deploy, look for `[link-preview] server.js hooked` (first deploy only) and `[link-preview] v2 active`. Then send yourself a YouTube link in a chat: the card shows the video title and thumbnail.

## Safety
Only the server contacts the other site, never the phone, so the site cannot see who is reading the chat. The server refuses private and internal addresses at the moment it connects (this also covers redirects and DNS tricks), refuses logins in the address and unusual ports, stops reading a page after its `</head>` or 300 KB, and gives up after 8 seconds. The route still needs a signed-in user and is limited to 40 requests a minute per address.

## Limits
- TikTok short links (`vm.tiktok.com`) and pages behind a login get no card.
- This does not search YouTube. A YouTube search-and-share feature would need a free YouTube Data API key; ask if you want it.

## Switching it off
Delete `server/client/link-preview.js` (the server then uses the older preview route), or remove `node patch-link-preview.js` from the `postinstall` and `prestart` lines in `server/client/package.json`.
