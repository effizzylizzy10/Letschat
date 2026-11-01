/* Letschat: in-app YouTube player.
 * Every YouTube link (youtube.com/watch, youtu.be, /shorts/, /live/, /embed/, music.youtube.com, playlists) opens in a player
 * inside Letschat instead of leaving the app (browser or YouTube app).
 *
 * How it works (no change to app.js needed):
 *  1. A capture-phase click listener on the document catches taps on any <a href> that points to YouTube.
 *  2. window.open() and the Capacitor Browser plugin are wrapped, so links opened from code also play in the app.
 *  3. The player is a full-screen overlay with the official YouTube embed (youtube-nocookie.com). Android Back, the Escape
 *     key and the X button close it. "Open in YouTube" is always shown for videos whose owner blocked embedding.
 * Old-phone friendly: plain ES5, no libraries.
 */
(function () {
  "use strict";
  if (window.__lcYtInstalled) return;
  window.__lcYtInstalled = true;

  var ID_RE = /^[A-Za-z0-9_-]{6,15}$/;
  var LIST_RE = /^[A-Za-z0-9_-]{10,60}$/;
  var overlay = null, pushed = false, prevOverflow = "";

  // "1h2m3s", "90s" or "90" -> seconds
  function toSeconds(v) {
    if (!v) return 0;
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    var m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(v);
    if (!m) return 0;
    return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
  }

  // Returns { id, list, start, shorts, url } for a YouTube link, or null for anything else.
  function parse(href) {
    if (!href || typeof href !== "string") return null;
    var u;
    try { u = new URL(href, location.href); } catch (e) { return null; }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    var host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "").replace(/^music\./, "");
    var id = "", shorts = false, path = u.pathname.split("/").filter(Boolean);
    var list = u.searchParams.get("list") || "";
    if (host === "youtu.be") {
      id = path[0] || "";
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      var first = path[0] || "";
      if (first === "watch") id = u.searchParams.get("v") || "";
      else if (first === "shorts") { id = path[1] || ""; shorts = true; }
      else if (first === "embed" || first === "live" || first === "v") id = path[1] || "";
      else if (first === "playlist") id = "";
      else return null; // channels, search, home page etc. are not videos: leave them alone
    } else {
      return null;
    }
    if (id && !ID_RE.test(id)) id = "";
    if (list && !LIST_RE.test(list)) list = "";
    if (!id && !list) return null;
    var start = toSeconds(u.searchParams.get("t") || u.searchParams.get("start") || (u.hash || "").replace(/^#t=/, ""));
    return { id: id, list: list, start: start, shorts: shorts, url: u.href };
  }

  function embedSrc(v) {
    var q = "autoplay=1&playsinline=1&rel=0&modestbranding=1";
    if (v.start) q += "&start=" + v.start;
    if (v.id) {
      if (v.list) q += "&list=" + encodeURIComponent(v.list);
      return "https://www.youtube-nocookie.com/embed/" + v.id + "?" + q;
    }
    return "https://www.youtube-nocookie.com/embed/videoseries?list=" + encodeURIComponent(v.list) + "&" + q;
  }

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text) n.textContent = text;
    return n;
  }

  function close(fromPop) {
    if (!overlay) return;
    var o = overlay; overlay = null;
    try { var f = o.querySelector("iframe"); if (f) f.src = "about:blank"; } catch (e) {} // stops the sound at once
    if (o.parentNode) o.parentNode.removeChild(o);
    document.documentElement.style.overflow = prevOverflow;
    document.removeEventListener("keydown", onKey, true);
    if (pushed && !fromPop) { pushed = false; try { history.back(); } catch (e) {} }
    else pushed = false;
  }

  function onKey(e) { if (e.key === "Escape" || e.keyCode === 27) { e.preventDefault(); e.stopPropagation(); close(); } }

  function open(v) {
    if (!document.body) return false;
    if (overlay) close(true);
    var o = el("div", "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147482000;background:rgba(5,7,10,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);-webkit-user-select:none;user-select:none");
    o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "YouTube video player");
    o.id = "lc-yt-player";

    var bar = el("div", "width:100%;max-width:960px;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;box-sizing:border-box;flex:none");
    var title = el("div", "font:600 14px Sora,Inter,Arial,sans-serif;color:#F5F7FA", "YouTube");
    var x = el("button", "width:40px;height:40px;border:0;border-radius:50%;background:#1B2B33;color:#F5F7FA;font:700 20px/1 Arial,sans-serif;cursor:pointer;padding:0", "\u2715");
    x.type = "button"; x.setAttribute("aria-label", "Close video");
    x.onclick = function (e) { e.preventDefault(); close(); };
    bar.appendChild(title); bar.appendChild(x);

    // 16:9 for normal videos, tall for Shorts; always fits the screen
    var box = el("div", "position:relative;background:#000;flex:none;width:100%;max-width:960px;" +
      (v.shorts ? "height:min(78vh,calc(100vw * 16 / 9));max-width:min(100vw,calc(78vh * 9 / 16));" : "aspect-ratio:16/9;max-height:70vh;"));
    var f = document.createElement("iframe");
    f.src = embedSrc(v);
    f.title = "YouTube video";
    f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
    f.setAttribute("allowfullscreen", "");
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    f.setAttribute("frameborder", "0");
    f.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;border:0;background:#000";
    box.appendChild(f);

    var foot = el("div", "width:100%;max-width:960px;padding:12px;box-sizing:border-box;text-align:center;flex:none");
    var a = el("a", "display:inline-block;padding:10px 16px;border-radius:10px;background:#1B2B33;color:#35D0BA;font:600 13px Inter,Arial,sans-serif;text-decoration:none", "Video not playing? Open in YouTube");
    a.href = v.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.setAttribute("data-lc-yt-skip", "1"); // this one link really leaves the app
    foot.appendChild(a);

    o.appendChild(bar); o.appendChild(box); o.appendChild(foot);
    // tapping the dark area outside the player closes it
    o.addEventListener("click", function (e) { if (e.target === o) close(); });

    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.appendChild(o);
    overlay = o;
    document.addEventListener("keydown", onKey, true);
    // Android Back / browser Back closes the player first, not the screen behind it
    try { history.pushState({ lcYt: 1 }, ""); pushed = true; } catch (e) { pushed = false; }
    try { x.focus(); } catch (e) {}
    return true;
  }

  window.addEventListener("popstate", function () { if (overlay) { pushed = false; close(true); } });

  // 1. taps on links (capture phase: runs before the app's own handlers)
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented && !overlay) { /* the app already handled it; still ours to take over below */ }
    if (e.button && e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest("a[href]");
    if (!a || a.getAttribute("data-lc-yt-skip")) return;
    var v = parse(a.href);
    if (!v) return;
    if (open(v)) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
  }, true);

  // 2. links opened from code
  var realOpen = window.open;
  window.open = function (url) {
    var v = typeof url === "string" ? parse(url) : null;
    if (v && open(v)) return null;
    return realOpen.apply(window, arguments);
  };
  try {
    var B = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
    if (B && typeof B.open === "function") {
      var realB = B.open.bind(B);
      B.open = function (opts) {
        var v = opts && opts.url ? parse(opts.url) : null;
        if (v && open(v)) return Promise.resolve();
        return realB(opts);
      };
    }
  } catch (err) {}

  // small public helper, e.g. window.lcPlayYouTube("https://youtu.be/xxxx") from other scripts
  window.lcPlayYouTube = function (url) { var v = parse(url); return v ? open(v) : false; };
  window.lcParseYouTube = parse;
})();
