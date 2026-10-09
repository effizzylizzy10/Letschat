// Static-site "build": copies the ready-to-serve app files into dist/ for Netlify.
// (app.js is already compiled from app.jsx, so there is nothing to bundle.)
const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "dist");
const skip = new Set(["dist", "node_modules", "build.js", "package.json", "package-lock.json", "app.jsx", "vercel.json", ".gitkeep"]);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of fs.readdirSync(__dirname)) {
  if (skip.has(name)) continue;
  fs.cpSync(path.join(__dirname, name), path.join(out, name), { recursive: true });
}
console.log("Built static site into dist/:", fs.readdirSync(out).join(", "));
