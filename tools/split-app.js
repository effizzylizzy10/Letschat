// Moves the big inline <script> (the compiled app) out of client/index.html into client/app.js.
// Why: a 900 KB index.html must be fully downloaded and parsed before anything shows. With the app in its
// own file the page shell is tiny, the boot screen paints at once, and app.js downloads in parallel with
// React/Firebase and is cached on its own.
//
// Run it after every time you regenerate index.html from app.jsx:   node tools/split-app.js
// No dependencies. Safe to run again (it says "nothing to do" if the app is already split).
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "client");
const htmlPath = path.join(dir, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
const re = /<script>\s*\n(\/\/ AUTO-GENERATED from app\.jsx[\s\S]*?)<\/script>/;
const m = re.exec(html);
if (!m) { console.log("Nothing to do: no inline compiled app found in index.html."); process.exit(0); }
fs.writeFileSync(path.join(dir, "app.js"), m[1]);
html = html.replace(re, () => '<script defer src="app.js"></script>');
fs.writeFileSync(htmlPath, html);
console.log("Moved the app into client/app.js (" + Math.round(m[1].length / 1024) + " KB). index.html is now " + Math.round(html.length / 1024) + " KB.");
