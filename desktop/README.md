# Letschat for Windows

A small desktop window around the live Letschat website, built with Electron into `Letschat-Setup.exe`.
The app is the website, so site updates reach it at once; `main.js` only opens the window, keeps it safe and sends outside links to the browser.

## Build it
1. Actions > "Build Windows installer (Letschat-Setup.exe)" > Run workflow (it also runs when `desktop/` changes).
2. Download the `Letschat-Setup-exe` artifact and unzip it.
3. Put `Letschat-Setup.exe` in `client/` next to `Letschat.apk` and redeploy the website.
4. The website then offers it to 64-bit Windows 10 and 11 PCs (`client/phonematch.js`). Other PCs keep the browser install.

## Good to know
- The installer is NOT code-signed, so Windows SmartScreen shows "Windows protected your PC" (More info > Run anyway). A code-signing certificate removes that.
- It installs for the current user only (no administrator needed) and adds Desktop and Start menu shortcuts.
- Windows 7, 8 and 32-bit Windows are not supported by Electron 33; they keep the browser install.
- The site address is `SITE` in `main.js`: keep it the same as `UPDATE_URL` in `client/config.js`.
- Inside the app the browser name ends in `LetschatDesktop`, so the site knows it is running in the Windows app.
- Not run on a real PC yet. Test sign-in (Google / email links), camera, microphone and notifications before sharing it.
- Electron and electron-builder are pinned to exact versions; there is no lockfile yet, so run `npm install` in `desktop/` once and commit `package-lock.json` for repeatable builds.
