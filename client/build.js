// Static build for Netlify: Letschat has no bundler. app.js is already compiled from app.jsx,
// so "build" copies the site files into dist/ (Netlify publishes client/dist) and minifies the JavaScript.
// If the minifier is unavailable or fails, the original files are shipped, so a deploy never breaks.
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
console.log("Copied " + n + " items to client/dist");

(async () => {
  let terser;
  try { terser = require("terser"); } catch (e) { console.log("terser not installed: shipping JavaScript unminified"); return; }
  for (const f of ["app.js", "push.js", "reactions.js", "config.js"]) {
    const file = path.join(out, f);
    if (!fs.existsSync(file)) continue;
    try {
      const src = fs.readFileSync(file, "utf8");
      const res = await terser.minify(src, { compress: { passes: 1 }, mangle: true, format: { comments: false } });
      if (!res.code || res.code.length < src.length * 0.3) throw new Error("suspicious output");
      new Function(res.code); // must still parse
      fs.writeFileSync(file, res.code);
      console.log("Minified " + f + ": " + Math.round(src.length / 1024) + " KB -> " + Math.round(res.code.length / 1024) + " KB");
    } catch (e) { console.log("Could not minify " + f + " (" + e.message + "): shipping it as is"); }
  }
})();
