// Letschat for Windows: a small desktop window around the live Letschat website (same idea as the Android compatible app).
// The app itself is the website, so every site update reaches the Windows app at once; this file only opens the window, keeps
// it safe (the site cannot reach the computer's files or programs) and sends outside links to the normal browser.
// Built into Letschat-Setup.exe by .github/workflows/build-windows-exe.yml (see desktop/README.md).
const { app, BrowserWindow, shell, session, Menu } = require("electron");

// Keep this the same as UPDATE_URL in client/config.js.
const SITE = "https://letschat-taupe.vercel.app/";
const HOST = new URL(SITE).host;
// Sign-in popups (Google / Firebase) must open inside the app, everything else outside goes to the default browser.
const POPUP_OK = /^(accounts\.google\.com|[a-z0-9-]+\.firebaseapp\.com)$/i;
// What the website may ask the computer for, and only when it is the Letschat site asking.
const PERMISSIONS = ["media", "notifications", "geolocation", "fullscreen", "clipboard-sanitized-write", "display-capture"];

app.setAppUserModelId("com.letschatafrica.desktop");

if (!app.requestSingleInstanceLock()) {
  app.quit(); // a second copy just focuses the first one (see "second-instance" below)
}

let win = null;

function offlinePage() {
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Letschat</title></head>' +
    '<body style="margin:0;padding:48px 24px;background:#0E1116;color:#F5F7FA;font:16px/1.5 Segoe UI,Arial,sans-serif;text-align:center">' +
    '<h1 style="font-size:22px">Letschat</h1><p>Letschat cannot connect right now.</p><p>Check your internet connection, then try again.</p>' +
    '<p><a href="' + SITE + '" style="display:inline-block;padding:10px 22px;border-radius:20px;background:#35D0BA;color:#0E1116;text-decoration:none;font-weight:600">Try again</a></p>' +
    '<script>window.addEventListener("online",function(){location.href="' + SITE + '"});</script></body></html>';
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 360,
    minHeight: 480,
    backgroundColor: "#0E1116",
    autoHideMenuBar: true,
    title: "Letschat",
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true }
  });
  Menu.setApplicationMenu(null);

  // The site tells apart the Windows app from a browser by this name (no "Electron" in it, so sign-in pages treat it like Chrome).
  const wc = win.webContents;
  wc.setUserAgent(wc.getUserAgent().replace(/\sElectron\/\S+/, "").replace(/\s+letschat-desktop\/\S+/i, "") + " LetschatDesktop");

  // links that open a new window
  wc.setWindowOpenHandler(({ url }) => {
    let u;
    try { u = new URL(url); } catch (e) { return { action: "deny" }; }
    if (u.host === HOST || POPUP_OK.test(u.hostname)) return { action: "allow" };
    if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:" || u.protocol === "tel:") shell.openExternal(url);
    return { action: "deny" };
  });
  // links that would replace the Letschat page itself
  wc.on("will-navigate", (event, url) => {
    let u;
    try { u = new URL(url); } catch (e) { event.preventDefault(); return; }
    if (u.protocol === "data:" || u.host === HOST || POPUP_OK.test(u.hostname)) return;
    event.preventDefault();
    if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:" || u.protocol === "tel:") shell.openExternal(url);
  });
  // no connection: friendly page with a Try again button
  wc.on("did-fail-load", (event, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadURL(offlinePage()); // -3 = cancelled by a redirect, not a failure
  });

  win.loadURL(SITE);
  win.on("closed", () => { win = null; });
}

app.whenReady().then(() => {
  // camera, microphone, notifications and location: only for the Letschat site
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    let host = "";
    try { host = new URL(details.requestingUrl).host; } catch (e) {}
    callback(host === HOST && PERMISSIONS.indexOf(permission) >= 0);
  });
  createWindow();
  app.on("activate", () => { if (!win) createWindow(); });
});

app.on("second-instance", () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.on("window-all-closed", () => { app.quit(); });
