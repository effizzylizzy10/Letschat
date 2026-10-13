# Phone compatibility

Target: iPhone 5 (iOS 10.3) up to the newest iPhone; Android 4.4 up to Android 17 (Android 4.6 does not exist: the last
4.x release was 4.4 KitKat). Screens from 128 px wide (keypad / feature phones) to tablets, portrait and landscape.

## How
- `client/build.js` converts all app JavaScript to ES5 with TypeScript (falls back to esbuild ES2015, then to the
  original files, so a deploy never breaks). Run `npm install` in `client/` before `npm run build`.
- `client/polyfills.js` (loads first): Promise, fetch (XMLHttpRequest based), Symbol, Map, Set, WeakMap, WeakSet,
  Object.assign, Array/String/Number/Math helpers, URLSearchParams, closest/matches/remove. Each only runs if missing.
- `client/compat.js`: flex `gap` and `aspect-ratio` rebuilt where missing, real viewport height without `dvh`,
  more helpers, and an "update your browser" message when a phone still cannot run the app.
- The app writes gap / aspect ratio a second way (counter-increment / counter-reset names) that old browsers keep, so the
  shims can find them. `inset` replaced by top/right/bottom/left. Firebase 8 on older phones, Firebase 10 on modern ones.

## Small and keypad phones, 128 to 320 px wide (`compat.js` section 6, `responsive.css` section 4)
- No more scaling. The app reflows at the real screen width: compact padding, nothing wider than the screen, equal-width
  bottom tabs (under 241 px only the open tab shows its name), footer and "created by" banner hidden.
- At 320 px and under ALL animations, transitions, shadows, glows, blur and masks are switched off (`html.lc-small`).
- Keypad mode turns on for KaiOS / Nokia / Opera Mini style browsers, or a screen up to 320 px wide without touch.
  Arrow keys move between buttons and fields, Enter taps, Soft-left / Escape / Backspace (outside a text box) go back or
  close, Soft-right taps the focused item, and the focused item gets a visible outline.

## Chat-only (lite) mode: keypad phones, itel / KaiOS / Opera Mini style browsers, screens up to 320 px, Data Saver on
- `responsive.js` sets `window.__lcLite` and `html.lc-lite`. In lite mode the app skips the web fonts, emoji reactions and push
  helper, and the bottom bar shows only Chats and Tools (Calls, Updates, Market and Games are hidden), so loading is lighter and the screen stays short and tidy.
- Opera Mini in "extreme / mini" mode runs no JavaScript on the phone, so no chat app can run there: use Opera Mini "high"
  mode, UC Browser, KaiOS browser or Chrome / Phoenix.
- The Netlify build (`npm run build`) must run: it converts the app to ES5, which KaiOS 2.5 (Firefox 48 engine) and old itel browsers need.

## Letschat Lite: Opera Mini extreme/mini mode and any phone with no JavaScript
- Served by the SERVER at `https://<your-server>/lite` (`server/client/lite.js`), so you must redeploy the server (Render) as well as the website.
- Plain HTML forms and links only: sign in (email + password) or create an account, chat list, a chat (write box on top, newest
  messages first, Older / Refresh / optional 25-second auto-refresh), new chat by username / phone / email, log out.
- Opera Mini is sent there automatically (`responsive.js`), and browsers with JavaScript switched off are sent there by a
  `<noscript>` redirect in `index.html`. `?full=1` on the website address keeps the full app.
- Not in Lite: calls, voice notes, photos and files (shown as [Photo] / [File] placeholders), reactions, status, Market, Games,
  push, live typing. Phone-number-only accounts have no password, so they add an email login in the full app first.
- The message-sending code is shared with the full app (`handleSend` in `server.js`), so blocks, group rules and the YouTube-link rule apply the same way.

## Service worker (`client/sw.js`, v56)
- Page and app code: network-first with a 3.5 s timeout, "navigation preload" to start the page request early, a saved copy when
  the network is slow or gone, and a friendly offline page if nothing is saved yet. Deep links (`?chat=`, `?join=`) still open offline.
- Libraries are kept on the device for good, also from the backup hosts (jsDelivr, cdnjs). Google Fonts are kept too.
- Lite mode (keypad phones, screens up to 320 px) registers `sw.js?lite=1`: no sounds, wallpapers, push helper or fonts saved,
  at most 60 photos kept (400 on normal phones). Measured here: 18 files saved on a normal phone, 11 in Lite.
- Never touches the API, sockets, `/lite` pages, sends, uploads or audio/video seeking. A full disk never breaks a request.
- Written in simple syntax (no async/await, no optional catch) so old Chrome / KaiOS browsers can still parse it. Bump `VERSION` to force a fresh start.

## Every other screen (`responsive.css`, `responsive.js`)
- iPhone Safari: fields stay at 16 px (no zoom on focus), the app shrinks above the keyboard (visualViewport), safe areas
  respected (notch, home bar, landscape), `-webkit-fill-available` height fallback for older Safari.
- Tablets / computers (820 px wide and 500 px tall or more): the app is a centred 760 px column instead of a stretched phone screen.
- Phone on its side (under 400 px tall): the banner is hidden to give the chat room.
- Phoenix browser and other Chromium forks with data saver / ad blockers: `responsive.js` starts the app only after React,
  Socket.IO and Firebase are present and fetches them from jsDelivr / cdnjs when the first host is blocked or slow.
  Phoenix is handled by feature detection (the same as old Chrome), plus an `lc-phoenix` tag on `<html>` if its user agent says so.

## Honest limits on the oldest phones
- Android 4.4: needs the Chrome app or a WebView that can reach the site over TLS 1.2. CSS grid layouts (some game
  boards and media grids) and animations may look plain. Phone-number login (Google reCAPTCHA) and camera / microphone /
  calls / voice notes / push notifications need a newer browser; chat itself and email login are the target.
- Android 4.0 to 4.3 and iOS 9 or older: best effort only, not tested, likely to show the "update your browser" message.
- iPhone 5 tops out at iOS 10.3.4: no service worker (so no offline copy or push), no camera / voice recording in the web
  app. Chats, status, market and games are the target.
- Everything above was tested by simulating missing browser features in Chromium, not on real old phones.
