// Free response compression (Brotli / gzip) with no extra packages: uses Node's built-in zlib.
// Chat lists and message pages are JSON, which shrinks to roughly 10-20% of its size, so they arrive much
// faster on slow mobile data. Images, audio and tiny replies are left alone.
//
// Use:  app.use(require("./compress")());      (put it before your routes)
const zlib = require("zlib");

const TEXTY = /json|text\/|javascript|xml|svg/i;

module.exports = function compress({ threshold = 1024 } = {}) {
  return function compressMiddleware(req, res, next) {
    if (req.method === "HEAD") return next();
    const accept = String(req.headers["accept-encoding"] || "");
    const enc = /\bbr\b/.test(accept) ? "br" : /\bgzip\b/.test(accept) ? "gzip" : null;
    if (!enc) return next();

    const write = res.write, end = res.end;
    const chunks = [];
    let mode = null; // null = undecided, "pass" = send untouched, "buffer" = collecting to compress

    const restore = () => { res.write = write; res.end = end; };
    const decide = () => {
      const type = String(res.getHeader("Content-Type") || "");
      const len = Number(res.getHeader("Content-Length"));
      const skip = !TEXTY.test(type) || res.getHeader("Content-Encoding") || res.statusCode === 204 || res.statusCode === 304 || (len > 0 && len < threshold);
      mode = skip ? "pass" : "buffer";
      if (mode === "buffer") { if (res.vary) res.vary("Accept-Encoding"); else res.setHeader("Vary", "Accept-Encoding"); }
      else restore();
    };
    const toBuf = (c, e) => (Buffer.isBuffer(c) ? c : Buffer.from(c, typeof e === "string" ? e : "utf8"));

    res.write = function (chunk, encoding, cb) {
      if (mode === null) decide();
      if (mode === "pass") return write.apply(res, arguments);
      if (chunk) chunks.push(toBuf(chunk, encoding));
      const done = typeof encoding === "function" ? encoding : cb;
      if (typeof done === "function") done();
      return true;
    };

    res.end = function (chunk, encoding, cb) {
      if (typeof chunk === "function") { cb = chunk; chunk = null; encoding = null; }
      else if (typeof encoding === "function") { cb = encoding; encoding = null; }
      if (mode === null) decide();
      if (mode === "pass") return end.call(res, chunk, encoding, cb);
      restore();
      if (chunk) chunks.push(toBuf(chunk, encoding));
      const body = Buffer.concat(chunks);
      if (body.length < threshold) { res.setHeader("Content-Length", body.length); return end.call(res, body, cb); }
      const done = (err, out) => {
        if (err || !out || out.length >= body.length) { res.setHeader("Content-Length", body.length); return end.call(res, body, cb); }
        res.setHeader("Content-Encoding", enc);
        res.setHeader("Content-Length", out.length);
        end.call(res, out, cb);
      };
      if (enc === "br") zlib.brotliCompress(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } }, done);
      else zlib.gzip(body, { level: 6 }, done);
      return res;
    };
    next();
  };
};
