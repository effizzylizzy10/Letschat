// Static site: no bundling needed. Copy the files the browser loads into dist/.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "dist");
const skip = new Set(["dist", "node_modules", "scripts", ".netlify", "package.json", "package-lock.json", "vercel.json", "netlify.toml", "app.jsx"]);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const name of fs.readdirSync(root)) {
  if (skip.has(name) || name.startsWith(".")) continue;
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
console.log("Copied static files to dist/");
