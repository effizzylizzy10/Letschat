// Runs before build.js (npm run build). Downloads the five libraries the app needs (React, ReactDOM, Firebase app + auth, Socket.IO) into
// client/vendor/ so the app loads them from its own site: they are then part of the saved offline copy on every device, and a blocked or slow
// CDN can no longer stop the app from opening. If ANY download fails or looks wrong, nothing is changed and the app keeps using the CDN links
// exactly as before, so a deploy never breaks. build.js reads vendor/manifest.json to switch index.html and sw.js over.
const fs = require("fs");
const path = require("path");
const LIBS = [
  ["https://unpkg.com/react@18.3.1/umd/react.production.min.js", "react.production.min.js", /React/],
  ["https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js", "react-dom.production.min.js", /ReactDOM|react-dom/],
  ["https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js", "firebase-app-compat.js", /firebase/i],
  ["https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js", "firebase-auth-compat.js", /firebase/i],
  ["https://cdn.socket.io/4.7.5/socket.io.min.js", "socket.io.min.js", /socket/i]
];
const dir = path.join(__dirname, "vendor");
fs.rmSync(dir, { recursive: true, force: true });
(async () => {
  try {
    if (typeof fetch !== "function") throw new Error("Node 18+ is needed for fetch");
    fs.mkdirSync(dir, { recursive: true });
    const files = [];
    for (const [url, name, must] of LIBS) {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(url + " answered " + res.status);
      const text = await res.text();
      if (text.length < 5000 || !must.test(text) || /^\s*<(!doctype|html)/i.test(text)) throw new Error(url + " does not look like the library");
      fs.writeFileSync(path.join(dir, name), text);
      files.push({ url, name, bytes: text.length });
    }
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ ok: true, files }));
    console.log("Vendored " + files.length + " libraries into client/vendor (offline-safe)");
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Could not vendor the libraries (" + e.message + "): the app keeps using the CDN links");
  }
})();
