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

// Self-updating cache name: the service worker's cache version is stamped with a hash of the shipped files, so every deploy that changes
// anything makes phones fetch the new copy (no more forgetting to bump the version number by hand).
try {
  const crypto = require("crypto"), h = crypto.createHash("sha1");
  for (const f of ["index.html", "app.js", "config.js", "push.js", "reactions.js", "live.js", "offline.js", "responsive.js", "responsive.css", "compat.js", "device.js", "polyfills.js", "manifest.json", "sw.js"]) {
    const fp = path.join(out, f); if (fs.existsSync(fp)) h.update(fs.readFileSync(fp));
  }
  const swp = path.join(out, "sw.js"), sw = fs.readFileSync(swp, "utf8"), tag = h.digest("hex").slice(0, 8);
  if (/var VERSION = "letschat-shell-[^"]*";/.test(sw)) { fs.writeFileSync(swp, sw.replace(/var VERSION = "letschat-shell-[^"]*";/, 'var VERSION = "letschat-shell-' + tag + '";')); console.log("Service worker cache version: letschat-shell-" + tag); }
} catch (e) { console.log("Could not stamp the service worker version: " + e.message); }

(async () => {
  let terser = null;
  try { terser = require("terser"); } catch (e) { console.log("terser not installed: shipping JavaScript unminified"); }
  // Old-phone support: rewrite modern syntax (async/await, classes, spread, destructuring...) to ES5 with TypeScript so the
  // app runs on Android 4.4+ WebView and iOS 10+. If TypeScript fails, esbuild (ES2015) is the fallback; if that also
  // fails, the original file is shipped, so a deploy never breaks.
  let ts = null, esbuild = null;
  try { ts = require("typescript"); } catch (e) { console.log("typescript not installed: using esbuild (ES2015) for older phones"); }
  try { esbuild = require("esbuild"); } catch (e) { if (!ts) console.log("esbuild not installed: skipping old-phone transpile"); }
  for (const f of ["app.js", "push.js", "reactions.js", "live.js", "offline.js", "config.js", "device.js", "compat.js", "responsive.js", "sw.js"]) {
    const file = path.join(out, f);
    if (!fs.existsSync(file)) continue;
    if (f === "app.js") { // v24: keep a modern copy for modern phones (smaller, no ES5 helpers); the ES5 build below becomes app.legacy.js
      const modernSrc = fs.readFileSync(file, "utf8");
      try {
        let code = modernSrc;
        if (terser) { const m = await terser.minify(modernSrc, { compress: { passes: 1 }, mangle: true, format: { comments: false }, ecma: 2017 }); if (m.code) code = m.code; }
        new Function(code);
        fs.writeFileSync(path.join(out, "app.modern.tmp"), code);
      } catch (e) { console.log("Could not build the modern app.js: " + e.message); }
    }
    if (f !== "compat.js" && f !== "responsive.js" && f !== "sw.js") {
      const src = fs.readFileSync(file, "utf8");
      let done = false;
      if (ts) {
        try {
          const r = ts.transpileModule(src, { fileName: f, compilerOptions: { target: ts.ScriptTarget.ES5, allowJs: true, downlevelIteration: true, module: ts.ModuleKind.None, removeComments: true, ignoreDeprecations: "6.0" }, reportDiagnostics: false });
          new Function(r.outputText); // must still parse
          if (/\b(const|let)\s|=>|\basync\b/.test(r.outputText.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`/g, ""))) throw new Error("ES5 output still has modern syntax");
          fs.writeFileSync(file, r.outputText); done = true;
          console.log("Transpiled " + f + " to ES5");
        } catch (e) { console.log("TypeScript could not transpile " + f + " (" + String(e.message).split("\n")[0] + ")"); }
      }
      if (!done && esbuild) {
        try {
          const r = esbuild.transformSync(src, { target: ["es2015"], loader: "js", legalComments: "none" });
          new Function(r.code);
          fs.writeFileSync(file, r.code);
          console.log("Transpiled " + f + " to ES2015");
        } catch (e) { console.log("Could not transpile " + f + " (" + String(e.message).split("\n")[0] + "): shipping it as is"); }
      }
    }
    if (!terser) continue;
    try {
      const src = fs.readFileSync(file, "utf8");
      const res = await terser.minify(src, { compress: { passes: 1 }, mangle: true, format: { comments: false } });
      if (!res.code || res.code.length < src.length * 0.3) throw new Error("suspicious output");
      new Function(res.code); // must still parse
      fs.writeFileSync(file, res.code);
      console.log("Minified " + f + ": " + Math.round(src.length / 1024) + " KB -> " + Math.round(res.code.length / 1024) + " KB");
    } catch (e) { console.log("Could not minify " + f + " (" + e.message + "): shipping it as is"); }
  }
  // swap: the ES5 build -> app.legacy.js, the modern build -> app.js
  try {
    const tmp = path.join(out, "app.modern.tmp");
    if (fs.existsSync(tmp)) { fs.renameSync(path.join(out, "app.js"), path.join(out, "app.legacy.js")); fs.renameSync(tmp, path.join(out, "app.js")); console.log("app.js = modern build, app.legacy.js = ES5 build"); }
  } catch (e) { console.log("Could not swap app builds: " + e.message); }
})();
