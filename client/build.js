// Static build for Netlify: Letschat has no bundler. app.js is already compiled from app.jsx,
// so "build" just copies the site files into dist/ (Netlify publishes client/dist).
const fs = require("fs");
const path = require("path");
const SKIP = new Set(["node_modules", "dist", "package.json", "package-lock.json", "build.js", "app.jsx", "vercel.json", ".git"]);
const out = path.join(__dirname, "dist");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const name of fs.readdirSync(__dirname)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(__dirname, name), path.join(out, name), { recursive: true });
  n++;
}
if (!fs.existsSync(path.join(out, "index.html"))) { console.error("index.html missing from dist"); process.exit(1); }
console.log("Built Letschat: copied " + n + " items to client/dist");
