# Offline AI (v71): LetsChat AI works with no network

Free, built in, no key and no download. The robot (Chats tab) now runs a small engine on the phone when there is no network.

## What it answers offline
- Letschat how-tos (chats, groups, status, privacy, blocking, archive, profile link...)
- Maths and percentages ("15% of 2000", "(5+3)*2", "square root of 144")
- Unit conversions (km/miles, kg/lb, C/F, m/ft, litres/gallons...)
- Time and date from the phone clock
- African capitals and currencies, a few Nigeria facts
- Greetings and small talk, jokes
- Anything it already answered online before (last 80 answers, labelled "Saved answer from <date>")

## What it cannot do offline
News, weather, prices, open questions. These are kept in a queue and sent to the real AI by themselves when the phone is back online ("Back online - here is the full answer to ...").

## How it behaves
- The header shows "offline mode" instead of "online".
- Chat history is mirrored on the device, so offline chats are still there after closing the app.
- Passwords, OTPs, PINs are never answered; the robot warns instead.

## Files
- `client/brain.js` (new): the engine, `window.LCBrain`.
- `client/app.js`: `AiBotScreen` uses it when offline or when the server cannot be reached (timeouts still show "taking too long").
- `client/index.html`, `sw.js`, `build.js`, `_headers`, `vercel.json`: load, cache (installed with the app shell) and serve `brain.js`.
- No server change. Redeploy the client only. `client/app.jsx` is not changed (same rule as before: do not regenerate app.js from it).

## Edit the offline answers
App how-tos are the `FACTS` array at the top of `brain.js` (copied from `APP_FACTS` in `server/client/bot.js`). Add or fix lines there.

## Optional lite model (v72)
A strip under the robot's header offers **Install Lite (145 MB)** or **Install Better (386 MB)** (only on phones whose browser supports it). Nothing downloads until the person taps Install and confirms; it warns about mobile data. After install the strip shows "Offline AI installed · Remove".
- Order offline: built-in answers (how-tos, maths, time...) > saved online answers > the installed model > queue for when online is back. When the model answers, the reply ends with "Offline model: short answers, can be wrong."
- Engine: wllama (llama.cpp in WebAssembly, single-thread, no special headers) loaded from jsdelivr; models are SmolLM2 135M / 360M Instruct (Q8_0 GGUF) from Hugging Face. The service worker keeps the engine files, wllama keeps the model in the browser's storage.
- **Check before deploying** (I could not reach the internet to test): `LITE_VER` at the top of the lite section in `client/brain.js` must be a real version of `@wllama/wllama` (npmjs.com), and each model `repo` / `file` must exist on huggingface.co. You can change the list without editing brain.js by setting `window.LC_LITE_MODELS = [{id, name, mb, repo, file}]` in `config.js`.
- Expect slow answers on cheap phones (single-thread): a few seconds to a minute. A 120 s timeout falls back to the queue.
- `client/sw.js`: engine files cached; `brain.js` now refreshed like the other app files.

## Both models (v73)
The strip now has **Install both (531 MB)** plus a button per model, and installs them one after the other (Lite first). Both can stay on the phone; the biggest installed one (Better) answers. "Remove" deletes all installed models. Models are never bundled in the app files: they download on the phone when the person taps Install, so the zip stays small.

## Works offline on every device (v74)
- **Self-hosted libraries**: `client/vendor.js` runs before `build.js` (`npm run build`) and downloads React, ReactDOM, Firebase (app + auth) and Socket.IO into `client/vendor/`. `build.js` then points `index.html` at them and adds them to the saved app shell in `sw.js`. The whole app is now same-origin, so it opens offline even if a CDN is blocked, slow or down. If any download fails, nothing changes and the CDN links stay (a deploy never breaks). Look for "index.html and sw.js now use the self-hosted libraries" in the Netlify/Vercel build log. `vendor/` is git-ignored (made at build time).
- **Offline model safety**: hidden on phones reporting under 1 GB memory or no WebAssembly/storage; install refuses when free space is under 1.3x the model size.
- Old phones keep using the ES5 build (`app.legacy.js`), brain.js is transpiled the same way, and all storage calls are try/catch guarded.

### Honest limits (no code can fix these)
- The app must be opened once online on each phone so the service worker can save it. Browsers without service-worker support (a few in-app browsers, Opera Mini, private/incognito modes) cannot open the app offline at all.
- iPhone Safari may delete saved data after about 7 days of not opening the app. Opening it once a week, or using Share > Add to Home Screen, avoids that.
- Calls, Live, games, first sign-in and posting to Status/Market always need a network.

## Optimisation pass (v75)
Measured changes only (I cannot run a phone or the live site from my workspace, so no speed timings are claimed):
- **Images, about 413 KB less**: ai-bot.png 349 KB -> 47 KB, logo-full.png 207 KB -> 135 KB, update-banner.jpg 209 KB -> 169 KB, chat-room.jpg 30 KB -> 21 KB. Same file names and pixel sizes, so no code changes. Checked side by side: the robot has slightly softer shading, the logo looks identical. Icons, wallpapers and developer.jpg were left alone because they could not shrink more than 10% safely.
- **Faster first screen**: `brain.js` (32 KB) no longer loads in the blocking script chain; `responsive.js` loads it right after the app starts. When libraries are self-hosted, the three unused preconnect tags are removed from index.html.
- **Less background work**: the game lobby refresh (every 8 s) pauses while the app is in the background or offline, and "disappears in..." timers stop re-rendering while the app is hidden.
- Already in place and kept: minify + ES5/modern split builds (needs `npm install` on the build host so terser/esbuild/typescript run; check the build log shows "Minified app.js"), service-worker caching, self-hosted libraries (v74).

### Not changed on purpose (needs testing on real phones first)
- `live.js` (167 KB, 44 KB gzipped) still loads for everyone. Loading it only when the Live tab opens would save the most, but the Live tab reads `window.LetschatLive` while rendering, so it needs a small change in app.js and a device test.
- `app.js` is one 1.1 MB file (about 281 KB gzipped before minifying). Splitting it into screens (games, calls, market) is the biggest remaining win but is a large refactor of the compiled file.
- `server/client/` is an older copy of the client inside the server folder; it is not touched.

## Qwen3 (v76)
The model list is now **Lite** (SmolLM2 135M, 145 MB) and **Qwen3** (Qwen3-0.6B, Q4_K_M, about 397 MB, from `unsloth/Qwen3-0.6B-GGUF`). Qwen3 replaces the old 360M "Better" model and is the one that answers when both are installed (`rank` field).
- Qwen3 normally "thinks" out loud before answering. The app sends `/no_think`, strips any `<think>` text, and uses Qwen's recommended settings (temp 0.7, top-p 0.8, top-k 20), so the phone only generates the short answer.
- **Install check**: after the download the app asks the model to say "OK". It is only marked installed if that works, so a model that downloads but cannot run (too little memory, unsupported file) shows an error instead of failing later in a chat. Install also refuses when free space is below 1.3x the size.
- Tested here with a stand-in engine (install, progress, no-think handling, history cleaning, empty-answer and low-space failures). **Not tested with the real engine or model**: I have no internet in my workspace.
- Before deploying, confirm on huggingface.co that `unsloth/Qwen3-0.6B-GGUF` has `Qwen3-0.6B-Q4_K_M.gguf`, and that `LITE_VER` is a real `@wllama/wllama` version. Bigger Qwen3 sizes (1.7B, about 1.1 GB at Q4) are one line in `window.LC_LITE_MODELS` but are too heavy for most phones with the single-thread engine. Qwen releases newer than Qwen3 may exist; they only work if the engine's llama.cpp supports their architecture, so test any change on a real phone first.
- `window.LC_WLLAMA_BASE` (optional) points the engine at a copy hosted on your own site.
