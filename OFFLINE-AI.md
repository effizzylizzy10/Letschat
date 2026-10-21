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
