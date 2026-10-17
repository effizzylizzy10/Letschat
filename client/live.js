// Letschat Live (plain JS, loads after the app like reactions.js): Go Live, Live Meeting with a join code, live comments,
// gifts, live stickers and emojis, reactions on comments, replies and @mentions.
// The app mounts window.LetschatLive.Screen once (see the "live" tab in app.js). Video is peer-to-peer WebRTC through the
// server's live:* events (server/client/live.js).
(function () {
  if (!window.React) return;
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useCallback = React.useCallback;
  var ICE = (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.ICE_SERVERS) || [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
  var C = { bg: "#0B0F16", card: "#161B22", line: "#262E3A", text: "#F5F7FA", dim: "#9BA7B4", teal: "#35D0BA", red: "#FF3B5C", purple: "#7C5CFF" };
  var STICKERS = [["fire", "\uD83D\uDD25"], ["100", "\uD83D\uDCAF"], ["heart", "\uD83D\uDC96"], ["laugh", "\uD83D\uDE02"], ["crown", "\uD83D\uDC51"], ["wow", "WOW!"], ["panda", "\uD83D\uDC3C"], ["clap", "\uD83D\uDC4F"], ["love", "\u2764\uFE0F"], ["rocket", "\uD83D\uDE80"], ["gg", "GG"]];
  var GIFTS = [["rose", "\uD83C\uDF39", "Rose"], ["car", "\uD83D\uDE97", "Car"], ["crown", "\uD83D\uDC51", "Crown"], ["bear", "\uD83E\uDDF8", "Bear"], ["star", "\u2B50", "Star"], ["diamond", "\uD83D\uDC8E", "Diamond"], ["heart", "\uD83D\uDC96", "Heart"], ["rocket", "\uD83D\uDE80", "Rocket"]];
  var EMOJIS = ["\uD83D\uDC4D", "\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83D\uDE22", "\uD83D\uDE21", "\uD83D\uDD25", "\uD83D\uDCAF", "\uD83D\uDC4F", "\uD83C\uDF89", "\uD83D\uDE0D", "\uD83D\uDE4C"];
  // Video effects. Phones that support canvas filters get all of them; others get the pixel-based ones (no Soft).
  var EFFECTS = [["none", "Normal", ""], ["bw", "B&W", "grayscale(1) contrast(1.1)"], ["sepia", "Sepia", "sepia(.9)"], ["warm", "Warm", "sepia(.35) saturate(1.3) hue-rotate(-10deg)"], ["cool", "Cool", "hue-rotate(25deg) saturate(1.15) brightness(1.05)"],
    ["vivid", "Vivid", "saturate(1.8) contrast(1.1)"], ["vintage", "Vintage", "sepia(.6) contrast(.9) brightness(1.1)"], ["soft", "Soft", "blur(2px) brightness(1.1) saturate(1.1)"], ["neon", "Neon", "invert(1) hue-rotate(180deg) saturate(2)"]];
  var FILTER_OK = (function () { try { var c = document.createElement("canvas").getContext("2d"); c.filter = "grayscale(1)"; return c.filter === "grayscale(1)"; } catch (e) { return false; } })();
  var CAN_PIPE = (function () { try { return typeof document.createElement("canvas").captureStream === "function"; } catch (e) { return false; } })();
  var EFFECT_LIST = FILTER_OK ? EFFECTS : EFFECTS.filter(function (e) { return e[0] !== "soft"; });
  var SCREEN_OK = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  var clamp = function (v) { return v < 0 ? 0 : v > 255 ? 255 : v; };
  function pixelFx(d, name) {
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2], gr, avg;
      if (name === "bw") { gr = 0.3 * r + 0.59 * g + 0.11 * b; r = g = b = clamp((gr - 128) * 1.1 + 128); }
      else if (name === "sepia" || name === "vintage") { var k = name === "sepia" ? 0.9 : 0.6, sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b; r = r + (sr - r) * k; g = g + (sg - g) * k; b = b + (sb - b) * k; if (name === "vintage") { r *= 1.08; g *= 1.08; b *= 1.08; } }
      else if (name === "warm") { r *= 1.1; b *= 0.9; }
      else if (name === "cool") { r *= 0.9; b *= 1.1; }
      else if (name === "vivid") { avg = (r + g + b) / 3; r = avg + (r - avg) * 1.7; g = avg + (g - avg) * 1.7; b = avg + (b - avg) * 1.7; }
      else if (name === "neon") { r = 255 - r; g = 255 - g; b = 255 - b; avg = (r + g + b) / 3; r = avg + (r - avg) * 2; g = avg + (g - avg) * 2; b = avg + (b - avg) * 2; }
      d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
    }
  }
  var glyph = function (list, key) { for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][1]; return key; };

  // animations (skipped when the phone asks for reduced motion)
  (function css() {
    if (document.getElementById("lc-live-css")) return;
    var s = document.createElement("style"); s.id = "lc-live-css";
    s.textContent = "@keyframes lcFloat{0%{transform:translateY(0) scale(.7);opacity:0}15%{opacity:1}100%{transform:translateY(-260px) scale(1.25);opacity:0}}" +
      "@keyframes lcGift{0%{transform:scale(.4);opacity:0}15%{transform:scale(1.1);opacity:1}80%{opacity:1}100%{transform:scale(1);opacity:0}}" +
      "@keyframes lcBubble{0%{transform:translate(0,0) scale(.5);opacity:0}12%{opacity:var(--lc-o,.5)}50%{transform:translate(var(--lc-dx,-14px),-45vh) scale(1)}100%{transform:translate(calc(var(--lc-dx,-14px) * -1),-95vh) scale(1.15);opacity:0}}" +
      "@media (prefers-reduced-motion:reduce){.lc-bubble{display:none!important}}" +
      "@keyframes lcPulse{0%,100%{opacity:1}50%{opacity:.45}}" +
      "@media (prefers-reduced-motion:reduce){.lc-fx,.lc-gift,.lc-pulse{animation:none!important}}";
    document.head.appendChild(s);
  })();

  var sock = function () { return window.__lcSocket && window.__lcSocket(); };
  var busyElsewhere = function () { return !!((window.__lcCallBusy && window.__lcCallBusy()) || (window.__lcGroupBusy && window.__lcGroupBusy())); };
  var btn = function (bg, color, extra) { return Object.assign({ background: bg, color: color, border: "none", borderRadius: 14, padding: "12px 14px", fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }, extra || {}); };
  var round = function (bg, size) { return { width: size, height: size, borderRadius: size, background: bg, border: "none", color: C.text, fontSize: size * 0.42, lineHeight: size + "px", padding: 0, cursor: "pointer", flexShrink: 0, textAlign: "center" }; };
  var shareLink = function (code) { try { return location.origin + location.pathname + "?live=" + code; } catch (e) { return code; } };

  function Avatar(p) {
    var u = p.user || {}, s = p.size || 30;
    var api = ((window.LETSCHAT_CONFIG || {}).API_URL || "").replace(/\/$/, "");
    var src = u.avatar ? (/^https?:/.test(u.avatar) ? u.avatar : api + u.avatar) : null;
    return h("div", { style: { width: s, height: s, borderRadius: s, background: u.color || "#2B3544", color: "#0E1116", fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: s * 0.4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 } },
      src ? h("img", { src: src, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } }) : (u.initials || "?"));
  }
  function Name(p) { var u = p.user || {}; return h("span", { style: { fontWeight: 700 } }, u.name || "", u.verified ? h("img", { src: "icons/verified.png", alt: "verified", style: { width: 13, height: 13, marginLeft: 3, verticalAlign: "-2px" } }) : null); }

  function VideoEl(p) {
    return h("video", { autoPlay: true, playsInline: true, muted: !!p.muted, style: Object.assign({ width: "100%", height: "100%", objectFit: "cover", background: "#000", transform: p.mirror ? "scaleX(-1)" : "none" }, p.style || {}),
      ref: function (el) { if (el && p.stream && el.srcObject !== p.stream) { el.srcObject = p.stream; var pr = el.play && el.play(); if (pr && pr.catch) pr.catch(function () {}); } } });
  }

  // ---------------------------------------------------------------- the live room (video + chat + gifts + stickers)
  function Room(p) {
    var info = p.info, me = p.me, socket = p.socket;
    var code = info.code, kind = info.kind;
    var st = useState(function () { return { chat: info.chat || [], viewers: info.viewers || 1, gifts: info.gifts || 0, hostId: info.hostId, host: info.host, media: info.media, pinned: info.pinned || null }; }), S = st[0], setS = st[1];
    var rs = useState({}), remotes = rs[0], setRemotes = rs[1];                 // userId -> MediaStream
    var ps = useState(function () { var m = {}; (info.peers || []).forEach(function (u) { if (u) m[u.id] = u; }); if (info.host) m[info.host.id] = info.host; return m; }), people = ps[0], setPeople = ps[1];
    var ls = useState(null), local = ls[0], setLocal = ls[1];
    var mc = useState({ mic: true, cam: true }), mediaState = mc[0], setMedia = mc[1];
    var fx = useState([]), floaters = fx[0], setFloaters = fx[1];
    var gb = useState([]), gifts = gb[0], setGifts = gb[1];
    var tx = useState(""), text = tx[0], setText = tx[1];
    var rp = useState(null), replyTo = rp[0], setReplyTo = rp[1];
    var sl = useState(null), picked = sl[0], setPicked = sl[1];                   // comment selected for react/reply
    var pn = useState(null), panel = pn[0], setPanel = pn[1];                     // null | "stickers" | "gifts" | "emoji"
    var cs = useState(kind === "live"), chatOpen = cs[0], setChatOpen = cs[1];
    var ts = useState(""), toast = ts[0], setToast = ts[1];
    var pcs = useRef({}), pend = useRef({}), localRef = useRef(null), inputRef = useRef(null), logRef = useRef(null), fxId = useRef(0), alive = useRef(true);
    var isHost = S.hostId === me.id;
    var canPin = isHost || !!me.creator;
    var bubbles = useRef(null);
    if (!bubbles.current) { var pal = [[124,92,255],[53,208,186],[255,107,157],[255,212,59],[77,171,247],[255,146,43],[105,219,124]]; bubbles.current = []; for (var bi = 0; bi < 12; bi++) { var c = pal[bi % pal.length], sz = 18 + Math.round(Math.random() * 36); bubbles.current.push({ id: bi, c: c, size: sz, right: Math.round(Math.random() * 70), dur: 5 + Math.random() * 5, delay: -Math.random() * 10, dx: Math.round((Math.random() * 40 - 20)), o: (0.3 + Math.random() * 0.3).toFixed(2) }); } }
    var flash = function (t) { setToast(t); setTimeout(function () { if (alive.current) setToast(""); }, 2600); };

    // ---- WebRTC ----
    function addRemote(uid, stream) { setRemotes(function (r) { var n = Object.assign({}, r); n[uid] = stream; return n; }); }
    function closePeer(uid) { var pc = pcs.current[uid]; if (pc) { try { pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null; pc.close(); } catch (e) {} } delete pcs.current[uid]; delete pend.current[uid]; setRemotes(function (r) { if (!r[uid]) return r; var n = Object.assign({}, r); delete n[uid]; return n; }); }
    function makePc(uid, sendLocal, recvOnly) {
      closePeer(uid);
      var pc = new RTCPeerConnection({ iceServers: ICE });
      pcs.current[uid] = pc;
      pc.onicecandidate = function (e) { if (e.candidate) socket.emit("live:signal", { code: code, to: uid, data: { candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate } }); };
      pc.ontrack = function (e) { var s = (e.streams && e.streams[0]) || null; if (!s) { s = new MediaStream(); s.addTrack(e.track); } addRemote(uid, s); };
      pc.onconnectionstatechange = function () { if (pc.connectionState === "failed") { try { pc.restartIce && pc.restartIce(); } catch (e) {} } };
      if (sendLocal && localRef.current) localRef.current.getTracks().forEach(function (t) { pc.addTrack(t, localRef.current); });
      if (recvOnly) { try { pc.addTransceiver("video", { direction: "recvonly" }); pc.addTransceiver("audio", { direction: "recvonly" }); } catch (e) {} }
      return pc;
    }
    function offerTo(uid, sendLocal, recvOnly) {
      var pc = makePc(uid, sendLocal, recvOnly);
      return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { socket.emit("live:signal", { code: code, to: uid, data: { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } } }); }).catch(function () { closePeer(uid); });
    }
    function flushCands(uid) { var pc = pcs.current[uid], q = pend.current[uid] || []; pend.current[uid] = []; q.forEach(function (c) { try { pc.addIceCandidate(c); } catch (e) {} }); }
    function onSignal(m) {
      if (!m || m.code !== code) return;
      var uid = m.from, d = m.data || {};
      if (d.sdp && d.sdp.type === "offer") {
        var pc = makePc(uid, true, false);
        pc.setRemoteDescription(d.sdp).then(function () { flushCands(uid); return pc.createAnswer(); }).then(function (a) { return pc.setLocalDescription(a); })
          .then(function () { socket.emit("live:signal", { code: code, to: uid, data: { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } } }); }).catch(function () { closePeer(uid); });
      } else if (d.sdp && d.sdp.type === "answer") {
        var pc2 = pcs.current[uid]; if (pc2) pc2.setRemoteDescription(d.sdp).then(function () { flushCands(uid); }).catch(function () {});
      } else if (d.candidate) {
        var pc3 = pcs.current[uid];
        if (pc3 && pc3.remoteDescription && pc3.remoteDescription.type) { try { pc3.addIceCandidate(d.candidate); } catch (e) {} } else { (pend.current[uid] = pend.current[uid] || []).push(d.candidate); }
      }
    }

    // ---- your video: camera (with an effect), a picture instead of the camera, or video off ----
    var vm = useState("camera"), vmode = vm[0], setVmode = vm[1];
    var fe = useState("none"), fxName = fe[0], setFxName = fe[1];
    var vp = useState(false), vpanel = vp[0], setVpanel = vp[1];
    var sh = useState(function () { var m = {}; (info.sharing || []).forEach(function (id) { m[id] = true; }); return m; }), sharing = sh[0], setSharing = sh[1];
    var prevLook = useRef({ mode: "camera", fx: "none" });
    var td = useState({ tool: "pen", color: "#FF3B5C", size: 5 }), teach = td[0], setTeach = td[1];
    var annRef = useRef({ strokes: [], cur: null, laser: [] });
    var camRef = useRef({ video: null, audio: null }), pipe = useRef(null), imgRef = useRef(null), fileRef = useRef(null), modeRef = useRef({ mode: "camera", fx: "none" });

    function ensurePipe() {
      if (pipe.current) return pipe.current;
      var cv = document.createElement("canvas"); cv.width = 360; cv.height = 480;
      var P = { cv: cv, cx: cv.getContext("2d"), vid: document.createElement("video"), timer: null, track: null, src: null, rate: 0 };
      P.vid.muted = true; P.vid.setAttribute("playsinline", ""); P.vid.playsInline = true;
      var st = cv.captureStream(20); P.track = st.getVideoTracks()[0];
      pipe.current = P; return P;
    }
    // teaching marks (pen, highlighter, arrow, box, text, laser) are drawn into the picture, so everyone sees them, even people who join late
    function drawAnn(cx, cv) {
      var A = annRef.current, W = cv.width, k = W / 1280, now = Date.now(), all = A.strokes.concat(A.cur ? [A.cur] : []);
      all.forEach(function (st) {
        var pts = st.pts, lw = Math.max(2, st.size * k), a = pts[0], b = pts[pts.length - 1];
        cx.save(); cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = st.color; cx.fillStyle = st.color; cx.lineWidth = lw;
        var X = function (pt) { return pt[0] * cv.width; }, Y = function (pt) { return pt[1] * cv.height; };
        if (st.tool === "pen" || st.tool === "hl") {
          if (st.tool === "hl") { cx.globalAlpha = 0.35; cx.lineWidth = lw * 4; cx.lineCap = "butt"; }
          cx.beginPath(); cx.moveTo(X(a), Y(a)); for (var i = 1; i < pts.length; i++) cx.lineTo(X(pts[i]), Y(pts[i])); if (pts.length === 1) cx.lineTo(X(a) + 0.1, Y(a)); cx.stroke();
        } else if (st.tool === "arrow") {
          var x1 = X(a), y1 = Y(a), x2 = X(b), y2 = Y(b), ang = Math.atan2(y2 - y1, x2 - x1), hd = Math.max(12 * k, lw * 3.2);
          cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
          cx.beginPath(); cx.moveTo(x2, y2); cx.lineTo(x2 - hd * Math.cos(ang - 0.45), y2 - hd * Math.sin(ang - 0.45)); cx.lineTo(x2 - hd * Math.cos(ang + 0.45), y2 - hd * Math.sin(ang + 0.45)); cx.closePath(); cx.fill();
        } else if (st.tool === "box") {
          cx.strokeRect(Math.min(X(a), X(b)), Math.min(Y(a), Y(b)), Math.abs(X(b) - X(a)), Math.abs(Y(b) - Y(a)));
        } else if (st.tool === "text") {
          var fs = Math.round((18 + st.size * 2.2) * k); cx.font = "700 " + fs + "px Inter, Arial, sans-serif"; cx.textBaseline = "top"; cx.lineWidth = Math.max(3, fs / 6); cx.strokeStyle = "rgba(0,0,0,.85)"; cx.strokeText(st.text, X(a), Y(a)); cx.fillText(st.text, X(a), Y(a));
        }
        cx.restore();
      });
      A.laser = A.laser.filter(function (t) { return now - t.t < 900; });
      A.laser.forEach(function (t, i) {
        var age = (now - t.t) / 900, r = (i === A.laser.length - 1 ? 11 : 7 * (1 - age) + 2) * k * 1.4;
        cx.save(); cx.globalAlpha = Math.max(0.1, 1 - age); cx.fillStyle = "#FF2D55"; cx.shadowColor = "#FF2D55"; cx.shadowBlur = 18 * k; cx.beginPath(); cx.arc(t.x * cv.width, t.y * cv.height, r, 0, Math.PI * 2); cx.fill(); cx.restore();
      });
    }
    function drawFrame() {
      var P = pipe.current; if (!P) return;
      var m = modeRef.current, cx = P.cx, cv = P.cv, css = "", def = null;
      for (var i = 0; i < EFFECTS.length; i++) if (EFFECTS[i][0] === m.fx) def = EFFECTS[i];
      var fx = def && def[0] !== "none" ? def : null;
      if (fx && FILTER_OK) css = fx[2];
      var cover = function (img, iw, ih) { var W = cv.width, H = cv.height, sc = Math.max(W / iw, H / ih), dw = iw * sc, dh = ih * sc; cx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh); };
      var drew = false;
      cx.save();
      if (m.mode === "screen" && camRef.current.screen && P.vid.readyState >= 2 && P.vid.videoWidth) {
        var sw = P.vid.videoWidth, sh2 = P.vid.videoHeight, ssc = Math.min(1, 1280 / sw, 1280 / sh2), SW = Math.round(sw * ssc), SH = Math.round(sh2 * ssc);
        if (cv.width !== SW || cv.height !== SH) { cv.width = SW; cv.height = SH; }
        cx.drawImage(P.vid, 0, 0, SW, SH); drawAnn(cx, cv); drew = true;
      } else if (m.mode === "camera" && camRef.current.video && P.vid.readyState >= 2 && P.vid.videoWidth) {
        var vw = P.vid.videoWidth, vh = P.vid.videoHeight, sc = 480 / Math.max(vw, vh), W = Math.round(vw * sc), H = Math.round(vh * sc);
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        cx.filter = css || "none"; cx.drawImage(P.vid, 0, 0, W, H); cx.filter = "none"; drew = true;
      } else if (m.mode === "image" && imgRef.current) {
        cx.fillStyle = "#000"; cx.fillRect(0, 0, cv.width, cv.height);
        cx.filter = css || "none"; cover(imgRef.current, imgRef.current.naturalWidth || 1, imgRef.current.naturalHeight || 1); cx.filter = "none"; drew = true;
      }
      if (drew && fx && !FILTER_OK && m.mode !== "screen") { try { var im = cx.getImageData(0, 0, cv.width, cv.height); pixelFx(im.data, fx[0]); cx.putImageData(im, 0, 0); } catch (e) {} }
      if (!drew) { // no camera and no picture: a clean card with your initials, so others still see who you are
        var W2 = cv.width, H2 = cv.height; cx.fillStyle = "#1B2330"; cx.fillRect(0, 0, W2, H2);
        var rad = Math.min(W2, H2) * 0.2; cx.fillStyle = me.color || "#35D0BA"; cx.beginPath(); cx.arc(W2 / 2, H2 / 2 - rad * 0.2, rad, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = "#0E1116"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.font = "700 " + Math.round(rad * 0.85) + "px Sora, Arial, sans-serif"; cx.fillText(me.initials || "?", W2 / 2, H2 / 2 - rad * 0.2);
        cx.fillStyle = "#9BA7B4"; cx.font = "600 " + Math.round(rad * 0.3) + "px Inter, Arial, sans-serif"; cx.fillText(m.mode === "off" ? "Video is off" : (me.name || ""), W2 / 2, H2 / 2 + rad * 1.25);
      }
      cx.restore();
    }
    function videoSender(pc) {
      var ts = pc.getTransceivers(), i;
      for (i = 0; i < ts.length; i++) { var t = ts[i]; if (t.sender && ((t.sender.track && t.sender.track.kind === "video") || (t.receiver && t.receiver.track && t.receiver.track.kind === "video"))) return t.sender; }
      return null;
    }
    // pick what is actually sent (camera as it is, or the canvas carrying an effect / picture / card) and swap it into every call
    function refreshOut() {
      var m = modeRef.current, cam = camRef.current, P = null, screenOn = m.mode === "screen" && !!cam.screen, srcT = screenOn ? cam.screen : cam.video, track = srcT, usePipe = CAN_PIPE && (screenOn || m.mode !== "camera" || m.fx !== "none" || !cam.video);
      if (usePipe) {
        P = ensurePipe();
        if (srcT && P.src !== srcT) { P.src = srcT; P.vid.srcObject = new MediaStream([srcT]); var pr = P.vid.play(); if (pr && pr.catch) pr.catch(function () {}); }
        if (!srcT) { P.src = null; P.vid.srcObject = null; }
        var rate = screenOn ? 66 : m.mode === "camera" && cam.video ? (FILTER_OK ? 50 : 70) : 150;
        if (P.rate !== rate) { clearInterval(P.timer); P.rate = rate; P.timer = setInterval(drawFrame, rate); }
        drawFrame(); track = P.track;
      } else if (pipe.current && pipe.current.timer) { clearInterval(pipe.current.timer); pipe.current.timer = null; pipe.current.rate = 0; }
      var out = localRef.current || new MediaStream();
      out.getVideoTracks().forEach(function (t) { if (t !== track) out.removeTrack(t); });
      if (track && out.getVideoTracks().indexOf(track) < 0) out.addTrack(track);
      localRef.current = out;
      Object.keys(pcs.current).forEach(function (uid) { var snd = videoSender(pcs.current[uid]); if (snd && track) { try { snd.replaceTrack(track); } catch (e) {} } });
      if (!CAN_PIPE && m.mode === "off" && cam.video) cam.video.enabled = false; // very old browsers: black frame instead of the card
      setLocal(new MediaStream(out.getTracks()));
    }
    function setLook(mode, fx) {
      var cur = modeRef.current, nm = mode || cur.mode, nf = fx == null ? cur.fx : fx;
      if (nm === "screen" && fx != null && !mode) nm = cur.mode; // picking an effect while sharing keeps sharing
      if (cur.mode === "screen" && nm !== "screen") { if (camRef.current.screen) { camRef.current.screen.onended = null; camRef.current.screen.stop(); camRef.current.screen = null; } socket.emit("live:share", { code: code, on: false }); annRef.current = { strokes: [], cur: null, laser: [] }; }
      modeRef.current = { mode: nm, fx: nf }; setVmode(nm); setFxName(nf);
      var ensureCam = Promise.resolve();
      if (nm === "camera" && !camRef.current.video && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        ensureCam = navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } }).then(function (st) { if (!alive.current) { st.getTracks().forEach(function (t) { t.stop(); }); return; } camRef.current.video = st.getVideoTracks()[0]; }).catch(function () { flash("Camera is blocked or busy."); });
      if (nm !== "camera" && camRef.current.video && nm === "off") { camRef.current.video.stop(); camRef.current.video = null; } // really release the camera
      ensureCam.then(function () { if (alive.current) refreshOut(); });
    }
    function stopScreen() {
      if (modeRef.current.mode !== "screen") return;
      var pv = prevLook.current; setLook(pv.mode === "screen" ? "camera" : pv.mode, pv.fx);
    }
    function startScreen() {
      if (modeRef.current.mode === "screen") return stopScreen();
      if (!SCREEN_OK) return flash("Screen sharing is not available on this phone or browser.");
      navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 24 } }, audio: false }).then(function (st) {
        if (!alive.current) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
        var tr = st.getVideoTracks()[0]; if (!tr) return;
        prevLook.current = { mode: modeRef.current.mode, fx: modeRef.current.fx };
        camRef.current.screen = tr; tr.onended = function () { stopScreen(); };
        modeRef.current = { mode: "screen", fx: modeRef.current.fx }; setVmode("screen");
        socket.emit("live:share", { code: code, on: true });
        refreshOut(); setVpanel(false); if (isHost) flash("Teaching tools are on: draw, point and highlight for everyone.");
      }).catch(function (e) { if (e && e.name !== "NotAllowedError" && e.name !== "AbortError") flash("Could not share your screen."); });
    }
    // pointer drawing on top of your own shared-screen preview
    function annPoint(e) {
      var el = e.currentTarget, r = el.getBoundingClientRect(), cv = pipe.current && pipe.current.cv; if (!cv) return null;
      var sc = Math.min(r.width / cv.width, r.height / cv.height), w = cv.width * sc, hh = cv.height * sc, ox = (r.width - w) / 2, oy = (r.height - hh) / 2;
      var nx = (e.clientX - r.left - ox) / w, ny = (e.clientY - r.top - oy) / hh;
      return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))];
    }
    function eraseAt(pt) {
      var A = annRef.current;
      A.strokes = A.strokes.filter(function (st) {
        var pts = st.pts.slice(); if (st.tool === "box") { var a = st.pts[0], b = st.pts[st.pts.length - 1]; pts = [a, b, [a[0], b[1]], [b[0], a[1]], [(a[0] + b[0]) / 2, a[1]], [(a[0] + b[0]) / 2, b[1]], [a[0], (a[1] + b[1]) / 2], [b[0], (a[1] + b[1]) / 2]]; }
        if (st.tool === "arrow") { var a2 = st.pts[0], b2 = st.pts[st.pts.length - 1]; pts = [a2, b2, [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2]]; }
        if (st.tool === "text") pts = [st.pts[0], [st.pts[0][0] + 0.04, st.pts[0][1] + 0.02], [st.pts[0][0] + 0.09, st.pts[0][1] + 0.02]];
        return !pts.some(function (q) { return Math.abs(q[0] - pt[0]) < 0.035 && Math.abs(q[1] - pt[1]) < 0.035; });
      });
    }
    function annDown(e) {
      var pt = annPoint(e); if (!pt) return; var A = annRef.current, t = teach.tool;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
      if (t === "text") { var tx = window.prompt("Text to show on the screen"); if (tx && tx.trim()) A.strokes.push({ tool: "text", color: teach.color, size: teach.size, pts: [pt], text: tx.trim().slice(0, 80) }); return; }
      if (t === "laser") { A.laser.push({ x: pt[0], y: pt[1], t: Date.now() }); A.laserDown = true; return; }
      if (t === "erase") { A.erasing = true; eraseAt(pt); return; }
      A.cur = { tool: t, color: teach.color, size: teach.size, pts: [pt] };
    }
    function annMove(e) {
      var A = annRef.current, pt = annPoint(e); if (!pt) return;
      if (A.laserDown) { A.laser.push({ x: pt[0], y: pt[1], t: Date.now() }); if (A.laser.length > 40) A.laser.shift(); return; }
      if (A.erasing) return eraseAt(pt);
      if (!A.cur) return;
      if (A.cur.tool === "arrow" || A.cur.tool === "box") A.cur.pts = [A.cur.pts[0], pt]; else A.cur.pts.push(pt);
    }
    function annUp() { var A = annRef.current; A.laserDown = false; A.erasing = false; if (A.cur) { A.strokes.push(A.cur); if (A.strokes.length > 200) A.strokes.shift(); A.cur = null; } }
    function pickImage(file) {
      if (!file) return;
      if (!/^image\//.test(file.type)) return flash("Choose a picture file.");
      if (file.size > 8 * 1024 * 1024) return flash("Choose a picture under 8 MB.");
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { imgRef.current = img; URL.revokeObjectURL(url); setLook("image"); };
      img.onerror = function () { URL.revokeObjectURL(url); flash("Could not open that picture."); };
      img.src = url;
    }

    // ---- start: camera first, then connect to the other people ----
    useEffect(function () {
      alive.current = true;
      var cancelled = false;
      function wantMedia() { return kind === "meeting" ? (S.media !== false) : isHost; }
      function getMedia() {
        if (!wantMedia() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(null);
        var wantVideo = info.video !== false;
        return navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false })
          .catch(function () { return navigator.mediaDevices.getUserMedia({ audio: true }).catch(function () { return null; }); });
      }
      getMedia().then(function (stream) {
        if (cancelled) { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        if (stream) {
          var out = new MediaStream();
          camRef.current.audio = stream.getAudioTracks()[0] || null; camRef.current.video = stream.getVideoTracks()[0] || null;
          if (camRef.current.audio) out.addTrack(camRef.current.audio);
          localRef.current = out;
          refreshOut();
        } else if (wantMedia() && CAN_PIPE) { localRef.current = new MediaStream(); refreshOut(); } // blocked camera and mic: others still see your card
        if (!stream && wantMedia()) flash("Camera or microphone is blocked. You can still use chat.");
        if (kind === "meeting") (info.peers || []).forEach(function (u) { if (u && u.id !== me.id) offerTo(u.id, true, false); });
        else if (!isHost && info.media) offerTo(info.hostId, false, true);
      });
      return function () { cancelled = true; alive.current = false; Object.keys(pcs.current).forEach(closePeer); var cr = camRef.current; if (cr.screen) { cr.screen.onended = null; cr.screen.stop(); } if (cr.video) cr.video.stop(); if (cr.audio) cr.audio.stop(); if (pipe.current) { clearInterval(pipe.current.timer); try { pipe.current.track && pipe.current.track.stop(); } catch (e) {} pipe.current = null; } if (localRef.current) localRef.current.getTracks().forEach(function (t) { t.stop(); }); localRef.current = null; };
    }, []); // eslint-disable-line

    // ---- socket events ----
    useEffect(function () {
      var onJoined = function (m) { if (m.code !== code) return; setPeople(function (x) { var n = Object.assign({}, x); n[m.user.id] = m.user; return n; }); if (kind === "live") setS(function (s) { return Object.assign({}, s); }); };
      var onLeft = function (m) { if (m.code !== code) return; closePeer(m.userId); if (m.host) setS(function (s) { return Object.assign({}, s, { hostId: m.host }); }); };
      var onCount = function (m) { if (m.code === code) setS(function (s) { return Object.assign({}, s, { viewers: m.viewers, gifts: m.gifts }); }); };
      var onChat = function (m) {
        if (m.code !== code) return;
        setPeople(function (x) { if (x[m.msg.user.id]) return x; var n = Object.assign({}, x); n[m.msg.user.id] = m.msg.user; return n; });
        setS(function (s) { return Object.assign({}, s, { chat: s.chat.concat([m.msg]).slice(-80) }); });
      };
      var onPinned = function (m) { if (m.code === code) setS(function (s) { return Object.assign({}, s, { pinned: m.pinned || null }); }); };
      var onMsgReact = function (m) { if (m.code !== code) return; setS(function (s) { return Object.assign({}, s, { chat: s.chat.map(function (c) { return c.id === m.msgId ? Object.assign({}, c, { reactions: m.reactions }) : c; }) }); }); };
      var onFx = function (m) {
        if (m.code !== code) return;
        if (m.kind === "gift") { var gid = ++fxId.current; setGifts(function (g) { return g.concat([{ id: gid, glyph: glyph(GIFTS, m.value), user: m.user }]).slice(-3); }); setTimeout(function () { setGifts(function (g) { return g.filter(function (x) { return x.id !== gid; }); }); }, 3000); }
        var id = ++fxId.current, g = m.kind === "sticker" ? glyph(STICKERS, m.value) : m.kind === "gift" ? glyph(GIFTS, m.value) : m.value;
        setFloaters(function (f) { return f.concat([{ id: id, g: g, x: 8 + Math.random() * 70, big: m.kind !== "emoji" }]).slice(-14); });
        setTimeout(function () { setFloaters(function (f) { return f.filter(function (x) { return x.id !== id; }); }); }, 2700);
      };
      var onShare = function (m) { if (m.code !== code) return; setSharing(function (x) { var n = Object.assign({}, x); if (m.on) n[m.userId] = true; else delete n[m.userId]; return n; }); };
      var onMention = function (m) { if (m.code === code) flash(m.from + " mentioned you"); };
      var onEnded = function (m) { if (m.code === code) p.onClose(m.reason || "This live has ended"); };
      var onReconnect = function () { // network came back: take the seat again and rebuild the video links
        socket.emit("live:join", { code: code }, function (r) {
          if (!r || r.error) return p.onClose((r && r.error) || "This live has ended");
          Object.keys(pcs.current).forEach(closePeer);
          setS(function (s) { return Object.assign({}, s, { viewers: r.viewers, gifts: r.gifts, hostId: r.hostId, chat: r.chat || s.chat, pinned: r.pinned || null }); });
          if (kind === "meeting") (r.peers || []).forEach(function (u) { if (u && u.id !== me.id) offerTo(u.id, true, false); });
          else if (r.hostId !== me.id && r.media) offerTo(r.hostId, false, true);
        });
      };
      var evs = { "live:joined": onJoined, "live:left": onLeft, "live:count": onCount, "live:chat": onChat, "live:msgreact": onMsgReact, "live:pinned": onPinned, "live:fx": onFx, "live:mention": onMention, "live:share": onShare, "live:ended": onEnded, "live:signal": onSignal };
      for (var k in evs) socket.on(k, evs[k]);
      var firstConnect = true;
      var onConn = function () { if (firstConnect) { firstConnect = false; return; } onReconnect(); };
      socket.on("connect", onConn); if (socket.connected) firstConnect = false;
      return function () { for (var k in evs) socket.off(k, evs[k]); socket.off("connect", onConn); };
    }, []); // eslint-disable-line

    useEffect(function () { var el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [S.chat.length, chatOpen]);

    // ---- actions ----
    function send() {
      var t = text.trim(); if (!t) return;
      var ids = [], seen = {};
      (t.match(/@[^\s@]+/g) || []).forEach(function (tok) { var hnd = tok.slice(1).toLowerCase(); Object.keys(people).forEach(function (id) { var u = people[id]; if (u && id !== me.id && !seen[id] && String(u.name || "").replace(/\s+/g, "").toLowerCase() === hnd) { seen[id] = 1; ids.push(id); } }); });
      socket.emit("live:chat", { code: code, text: t, replyTo: replyTo ? { id: replyTo.id } : null, mentions: ids }, function (r) { if (r && r.error) flash(r.error); });
      setText(""); setReplyTo(null); setPicked(null);
    }
    var fxSend = function (kindName, value) { socket.emit("live:fx", { code: code, kind: kindName, value: value }, function (r) { if (r && r.error) flash(r.error); }); };
    var pinMsg = function (m) { socket.emit("live:pin", { code: code, msgId: m ? m.id : null }, function (r) { if (r && r.error) flash(r.error); }); setPicked(null); };
    var reactMsg = function (m, e) { socket.emit("live:msgreact", { code: code, msgId: m.id, emoji: e }); setPicked(null); };
    var toggleMic = function () { var s = localRef.current; if (!s) return; var on = !mediaState.mic; s.getAudioTracks().forEach(function (t) { t.enabled = on; }); setMedia(Object.assign({}, mediaState, { mic: on })); };
    var toggleCam = function () { setLook(modeRef.current.mode === "off" ? "camera" : "off"); };
    var leave = function () { socket.emit(isHost && kind === "live" ? "live:end" : "live:leave", { code: code }); p.onClose(""); };
    var copy = function (t, msg) { try { navigator.clipboard.writeText(t).then(function () { flash(msg); }, function () { flash(t); }); } catch (e) { flash(t); } };
    var share = function () { var link = shareLink(code), msg = "Join my " + (kind === "meeting" ? "meeting" : "live") + " on Letschat. Code: " + code; if (navigator.share) navigator.share({ title: "Letschat Live", text: msg, url: link }).catch(function () {}); else copy(msg + " " + link, "Invite copied"); };
    var addAt = function () { setText(function (t) { return t + (t && !/\s$/.test(t) ? " @" : "@"); }); if (inputRef.current) inputRef.current.focus(); };

    // @ suggestions: who is already known in this room
    var tokenM = /(?:^|\s)@([^\s@]*)$/.exec(text), sugg = [];
    if (tokenM) { var q = tokenM[1].toLowerCase(); sugg = Object.keys(people).map(function (id) { return people[id]; }).filter(function (u) { return u && u.id !== me.id && String(u.name || "").replace(/\s+/g, "").toLowerCase().indexOf(q) === 0; }).slice(0, 5); }
    var pickMention = function (u) { setText(text.replace(/@[^\s@]*$/, "@" + String(u.name || "").replace(/\s+/g, "") + " ")); if (inputRef.current) inputRef.current.focus(); };

    // ---- render ----
    var renderText = function (t, mentions) { return String(t).split(/(@[^\s@]+)/g).map(function (part, i) { return /^@[^\s@]+$/.test(part) ? h("span", { key: i, style: { color: C.teal, fontWeight: 700 } }, part) : part; }); };
    var chips = function (m) {
      var r = m.reactions || {}, counts = {}, order = [];
      Object.keys(r).forEach(function (u) { var e = r[u]; if (!counts[e]) { counts[e] = 0; order.push(e); } counts[e]++; });
      if (!order.length) return null;
      return h("div", { style: { display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" } }, order.map(function (e) { return h("button", { key: e, onClick: function () { reactMsg(m, e); }, style: { background: r[me.id] === e ? "rgba(53,208,186,.3)" : "rgba(255,255,255,.14)", border: "none", borderRadius: 999, padding: "1px 7px", color: C.text, fontSize: 12.5, cursor: "pointer" } }, e + (counts[e] > 1 ? " " + counts[e] : "")); }));
    };
    var comment = function (m) {
      var sel = picked && picked.id === m.id, mentionedMe = (m.mentions || []).indexOf(me.id) >= 0;
      return h("div", { key: m.id, style: { marginBottom: 7 } },
        h("div", { onClick: function () { setPicked(sel ? null : m); }, onDoubleClick: function () { reactMsg(m, "\u2764\uFE0F"); },
          style: { display: "flex", gap: 8, alignItems: "flex-start", background: mentionedMe ? "rgba(53,208,186,.2)" : "rgba(0,0,0,.38)", borderRadius: 14, padding: "6px 10px 6px 6px", maxWidth: "92%", width: "fit-content", cursor: "pointer", border: sel ? "1px solid " + C.teal : "1px solid transparent" } },
          h(Avatar, { user: m.user, size: 28 }),
          h("div", { style: { minWidth: 0, fontFamily: "Inter, sans-serif", fontSize: 13.5, color: C.text, lineHeight: 1.35, wordBreak: "break-word" } },
            m.reply && h("div", { style: { borderLeft: "2px solid " + C.teal, paddingLeft: 6, marginBottom: 3, color: C.dim, fontSize: 12 } }, "Reply to ", m.reply.name, ": ", m.reply.text),
            h("span", { style: { color: C.dim } }, h(Name, { user: m.user }), " "),
            m.gift ? h("span", null, "sent a gift ", h("span", { style: { fontSize: 18 } }, glyph(GIFTS, m.gift))) : renderText(m.text),
            chips(m))),
        sel && h("div", { style: { display: "flex", gap: 2, alignItems: "center", marginTop: 4, background: "#1E2530", border: "1px solid #2B3544", borderRadius: 999, padding: "4px 8px", width: "fit-content", maxWidth: "100%", overflowX: "auto" } },
          EMOJIS.slice(0, 7).map(function (e) { return h("button", { key: e, onClick: function () { reactMsg(m, e); }, style: { background: "none", border: "none", fontSize: 22, padding: "0 3px", cursor: "pointer" } }, e); }),
          h("button", { onClick: function () { setReplyTo(m); setPicked(null); if (inputRef.current) inputRef.current.focus(); }, style: { background: C.teal, color: "#0E1116", border: "none", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 12.5, marginLeft: 4, cursor: "pointer", flexShrink: 0 } }, "Reply"),
          canPin && h("button", { onClick: function () { pinMsg(S.pinned && S.pinned.id === m.id ? null : m); }, style: { background: "#FFD43B", color: "#0E1116", border: "none", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 12.5, marginLeft: 4, cursor: "pointer", flexShrink: 0 } }, S.pinned && S.pinned.id === m.id ? "Unpin" : "\uD83D\uDCCC Pin")));
    };

    var teaching = isHost && vmode === "screen" && CAN_PIPE;
    var drawLayer = teaching && teach.tool !== "none" ? h("div", { onPointerDown: annDown, onPointerMove: annMove, onPointerUp: annUp, onPointerCancel: annUp, style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 4, touchAction: "none", cursor: teach.tool === "laser" ? "none" : "crosshair" } }) : null;
    var hostStream = isHost ? local : remotes[S.hostId];
    var tiles = [];
    if (kind === "meeting") {
      tiles.push({ id: me.id, user: me, stream: local, mine: true });
      Object.keys(remotes).forEach(function (id) { tiles.push({ id: id, user: people[id] || { name: "Guest" }, stream: remotes[id] }); });
    }
    var cols = tiles.length <= 1 ? 1 : 2;
    var stage = kind === "live"
      ? h("div", { style: { position: "absolute", inset: 0, background: "#000" } },
          drawLayer,
          hostStream ? h(VideoEl, { stream: hostStream, muted: isHost, mirror: isHost && vmode === "camera", style: (isHost ? vmode === "screen" : sharing[S.hostId]) ? { objectFit: "contain" } : {} }) : h("div", { style: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: C.dim, fontFamily: "Inter, sans-serif", textAlign: "center", padding: 24 } },
            h(Avatar, { user: S.host, size: 84 }),
            h("div", { style: { color: C.text, fontWeight: 700, fontSize: 17 } }, S.host && S.host.name),
            h("div", null, S.media === false ? "The video is full right now. You are in the chat and can still send gifts and stickers." : isHost ? "Starting your camera\u2026" : "Connecting to the live\u2026")))
      : h("div", { style: { position: "absolute", left: 0, right: 0, top: 58, bottom: chatOpen ? "46%" : 150, display: "grid", gridTemplateColumns: "repeat(" + cols + ",1fr)", gap: 6, padding: 6, background: "#000" } },
          tiles.map(function (t) {
            return h("div", { key: t.id, style: { position: "relative", borderRadius: 14, overflow: "hidden", background: "#1B2330", minHeight: 0, gridColumn: (t.mine ? vmode === "screen" : sharing[t.id]) ? "1 / -1" : "auto" } },
              t.mine && drawLayer,
              t.stream ? h(VideoEl, { stream: t.stream, muted: !!t.mine, mirror: !!t.mine && vmode === "camera", style: (t.mine ? vmode === "screen" : sharing[t.id]) ? { objectFit: "contain" } : {} }) : h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, h(Avatar, { user: t.user, size: 64 })),
              h("div", { style: { position: "absolute", left: 8, bottom: 6, background: "rgba(0,0,0,.55)", color: C.text, borderRadius: 8, padding: "2px 8px", fontFamily: "Inter, sans-serif", fontSize: 12.5 } }, t.mine ? "You" : (t.user.name || "Guest"), t.id === S.hostId ? " \uD83D\uDC51" : ""));
          }));

    var panelItems = panel === "stickers" ? STICKERS.map(function (s) { return [s[0], s[1]]; }) : panel === "gifts" ? GIFTS : panel === "emoji" ? EMOJIS.map(function (e) { return [e, e]; }) : [];
    var onPanelPick = function (it) { if (panel === "stickers") fxSend("sticker", it[0]); else if (panel === "gifts") { fxSend("gift", it[0]); setPanel(null); } else fxSend("emoji", it[0]); };

    return h("div", { style: { position: "fixed", inset: 0, zIndex: 95, background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Inter, sans-serif" } },
      stage,
      // top bar
      h("div", { style: { position: "relative", zIndex: 5, display: "flex", alignItems: "center", gap: 8, padding: "calc(10px + env(safe-area-inset-top,0px)) 10px 8px", background: "linear-gradient(rgba(0,0,0,.7),rgba(0,0,0,0))" } },
        h(Avatar, { user: S.host, size: 36 }),
        h("div", { style: { minWidth: 0, flex: 1, color: C.text } }, h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, info.title), h("div", { style: { fontSize: 12, color: C.dim } }, S.host && S.host.name)),
        h("span", { className: "lc-pulse", style: { background: C.red, color: "#fff", borderRadius: 8, padding: "3px 9px", fontWeight: 800, fontSize: 12, animation: "lcPulse 1.6s infinite" } }, kind === "meeting" ? "MEETING" : "LIVE"),
        h("span", { style: { background: "rgba(0,0,0,.55)", color: C.text, borderRadius: 999, padding: "4px 10px", fontSize: 13, fontWeight: 700 } }, "\uD83D\uDC41 " + S.viewers),
        h("button", { "aria-label": "Leave", onClick: leave, style: round("rgba(0,0,0,.55)", 34) }, "\u2715")),
      // join code strip
      h("div", { style: { position: "relative", zIndex: 5, display: "flex", gap: 6, padding: "0 10px", alignItems: "center" } },
        kind === "meeting" && h("button", { onClick: function () { copy(code, "Code copied"); }, style: { background: "rgba(124,92,255,.85)", color: "#fff", border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 800, letterSpacing: 2, fontSize: 13, cursor: "pointer" } }, "Code " + code + "  \u29C9"),
        kind === "meeting" && h("button", { onClick: share, style: { background: "rgba(0,0,0,.55)", color: C.text, border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" } }, "Invite"),
        S.gifts > 0 && h("span", { style: { color: C.text, fontSize: 12.5, background: "rgba(0,0,0,.55)", borderRadius: 999, padding: "5px 10px" } }, "\uD83C\uDF81 " + S.gifts)),
      // floating emojis / stickers
      h("div", { style: { position: "absolute", right: 0, bottom: 150, width: "55%", height: 280, pointerEvents: "none", zIndex: 6, overflow: "hidden" } },
        floaters.map(function (f) { return h("div", { key: f.id, className: "lc-fx", style: { position: "absolute", bottom: 0, left: f.x + "%", fontSize: f.big ? 46 : 32, fontWeight: 900, color: "#FFD43B", textShadow: "0 2px 8px rgba(0,0,0,.6)", animation: "lcFloat 2.6s ease-out forwards" } }, f.g); })),
      // colourful see-through bubbles rising on the right side (Go Live only)
      kind === "live" && h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, top: 70, bottom: 150, width: "38%", pointerEvents: "none", zIndex: 4, overflow: "hidden" } },
        bubbles.current.map(function (b) { var rgb = b.c.join(","); return h("span", { key: b.id, className: "lc-bubble", style: { position: "absolute", bottom: -60, right: b.right + "%", width: b.size, height: b.size, borderRadius: "50%", background: "radial-gradient(circle at 30% 28%, rgba(255,255,255,.55), rgba(" + rgb + ",.28) 45%, rgba(" + rgb + ",.12) 100%)", border: "1px solid rgba(" + rgb + ",.55)", boxShadow: "inset 0 0 8px rgba(255,255,255,.25), 0 0 10px rgba(" + rgb + ",.25)", "--lc-dx": b.dx + "px", "--lc-o": b.o, opacity: 0, animation: "lcBubble " + b.dur.toFixed(1) + "s linear " + b.delay.toFixed(1) + "s infinite" } }); })),
      // gift banners
      h("div", { style: { position: "absolute", left: 0, right: 0, top: "30%", zIndex: 7, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 } },
        gifts.map(function (g) { return h("div", { key: g.id, className: "lc-gift", style: { background: "rgba(124,92,255,.9)", color: "#fff", borderRadius: 999, padding: "8px 18px", display: "flex", alignItems: "center", gap: 10, fontWeight: 700, animation: "lcGift 3s ease forwards" } }, h("span", { style: { fontSize: 38 } }, g.glyph), h("span", null, (g.user && g.user.name) + " sent a gift!")); })),
      toast && h("div", { style: { position: "absolute", left: 16, right: 16, top: 110, zIndex: 9, background: "#1E2530", color: C.text, border: "1px solid #2B3544", borderRadius: 12, padding: "10px 14px", textAlign: "center", fontSize: 13.5 } }, toast),
      h("div", { style: { flex: 1 } }),
      // pinned message (set by the host), shown on top of the chat
      S.pinned && h("div", { style: { position: "relative", zIndex: 6, margin: "0 10px 6px", display: "flex", alignItems: "center", gap: 8, background: "rgba(30,37,48,.92)", border: "1px solid #FFD43B", borderRadius: 12, padding: "6px 8px" } },
        h("span", { style: { fontSize: 16 } }, "\uD83D\uDCCC"),
        h("div", { style: { minWidth: 0, flex: 1, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.text, lineHeight: 1.35, wordBreak: "break-word", maxHeight: 64, overflowY: "auto" } },
          h("div", { style: { color: "#FFD43B", fontSize: 11.5, fontWeight: 700 } }, "Pinned by ", S.pinned.by || "host", " \u00B7 ", S.pinned.user && S.pinned.user.name),
          S.pinned.gift ? h("span", null, "sent a gift ", glyph(GIFTS, S.pinned.gift)) : renderText(S.pinned.text)),
        canPin && h("button", { "aria-label": "Unpin message", onClick: function () { pinMsg(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 16, cursor: "pointer", flexShrink: 0 } }, "\u2715")),
      // comments
      chatOpen && h("div", { ref: logRef, style: { position: "relative", zIndex: 5, maxHeight: kind === "meeting" ? "40%" : "34%", overflowY: "auto", padding: "0 10px 6px", background: kind === "meeting" ? C.bg : "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.45))", WebkitOverflowScrolling: "touch" } },
        S.chat.length ? S.chat.map(comment) : h("div", { style: { color: C.dim, fontSize: 13, padding: "6px 4px" } }, "No comments yet. Say hi \uD83D\uDC4B")),
      // sticker / gift / emoji tray
      panel && h("div", { style: { position: "relative", zIndex: 8, background: C.card, borderTop: "1px solid " + C.line, padding: "8px 8px 6px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", color: C.dim, fontSize: 12.5, padding: "0 4px 4px" } }, h("span", null, panel === "gifts" ? "Send a gift (free, to show support)" : panel === "stickers" ? "Live stickers" : "Live emojis"), h("button", { onClick: function () { setPanel(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 18, cursor: "pointer" } }, "\u2715")),
        h("div", { style: { display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 } }, panelItems.map(function (it) { return h("button", { key: it[0], onClick: function () { onPanelPick(it); }, style: { background: "#1E2530", border: "1px solid #2B3544", borderRadius: 12, minWidth: 58, height: 58, color: "#FFD43B", fontSize: it[1].length > 2 && it[1].indexOf("\uD83C") < 0 && it[1].indexOf("\uD83D") < 0 && it[1].indexOf("\uD83E") < 0 ? 15 : 28, fontWeight: 900, cursor: "pointer", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 } }, it[1], panel === "gifts" && h("span", { style: { fontSize: 10, color: C.dim, fontWeight: 600 } }, it[2])); }))),
      // @ suggestions + reply bar
      sugg.length > 0 && h("div", { style: { position: "relative", zIndex: 8, background: C.card, borderTop: "1px solid " + C.line, display: "flex", gap: 6, padding: "6px 10px", overflowX: "auto" } }, sugg.map(function (u) { return h("button", { key: u.id, onClick: function () { pickMention(u); }, style: { display: "flex", alignItems: "center", gap: 6, background: "#1E2530", border: "1px solid #2B3544", borderRadius: 999, padding: "4px 10px 4px 4px", color: C.text, fontSize: 13, cursor: "pointer", flexShrink: 0 } }, h(Avatar, { user: u, size: 22 }), u.name); })),
      replyTo && h("div", { style: { position: "relative", zIndex: 8, background: C.card, borderTop: "1px solid " + C.line, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, color: C.dim, fontSize: 12.5 } }, h("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, "Replying to ", h("b", { style: { color: C.text } }, replyTo.user.name), ": ", replyTo.text || "a gift"), h("button", { onClick: function () { setReplyTo(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 16, cursor: "pointer" } }, "\u2715")),
      // message bar
      h("div", { style: { position: "relative", zIndex: 8, display: "flex", gap: 6, alignItems: "center", padding: "8px 10px", background: C.card, borderTop: "1px solid " + C.line } },
        kind === "meeting" && h("button", { "aria-label": "Show or hide chat", onClick: function () { setChatOpen(!chatOpen); }, style: round(chatOpen ? C.teal : "#2B3544", 38) }, "\uD83D\uDCAC"),
        h("button", { "aria-label": "Mention someone", onClick: addAt, style: Object.assign(round("#2B3544", 38), { fontWeight: 800, color: C.teal }) }, "@"),
        h("input", { ref: inputRef, value: text, maxLength: 300, placeholder: "Type a message\u2026", onChange: function (e) { setText(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") send(); }, style: { flex: 1, minWidth: 0, background: "#0E1218", border: "1px solid #2B3544", borderRadius: 999, color: C.text, padding: "10px 14px", fontSize: 14.5, outline: "none" } }),
        text.trim() ? h("button", { "aria-label": "Send", onClick: send, style: round(C.teal, 38) }, "\u27A4") : null,
        h("button", { "aria-label": "Live emojis", onClick: function () { setPanel(panel === "emoji" ? null : "emoji"); }, style: round(panel === "emoji" ? C.teal : "#2B3544", 38) }, "\uD83D\uDE0A"),
        h("button", { "aria-label": "Live stickers", onClick: function () { setPanel(panel === "stickers" ? null : "stickers"); }, style: round(panel === "stickers" ? C.teal : "#2B3544", 38) }, "\uD83D\uDD25"),
        h("button", { "aria-label": "Send a gift", onClick: function () { setPanel(panel === "gifts" ? null : "gifts"); }, style: round(panel === "gifts" ? C.purple : "#2B3544", 38) }, "\uD83C\uDF81")),
      // teaching tools: only the person who started the meeting (or the live), while their screen is shared
      teaching && h("div", { style: { position: "relative", zIndex: 9, background: C.card, borderTop: "1px solid " + C.line, padding: "8px 10px 6px" } },
        h("div", { style: { display: "flex", gap: 5, overflowX: "auto", paddingBottom: 6, alignItems: "center" } },
          [["none", "\uD83D\uDC46", "Mouse"], ["pen", "\u270F\uFE0F", "Pen"], ["hl", "\uD83D\uDD8D\uFE0F", "Highlight"], ["arrow", "\u27A1\uFE0F", "Arrow"], ["box", "\u25AD", "Box"], ["text", "T", "Text"], ["laser", "\uD83D\uDD34", "Laser"], ["erase", "\uD83E\uDDFD", "Erase"]].map(function (t) {
            var on = teach.tool === t[0];
            return h("button", { key: t[0], "aria-label": t[2], title: t[2], onClick: function () { setTeach(Object.assign({}, teach, { tool: t[0] })); }, style: { flexShrink: 0, minWidth: 54, padding: "5px 6px", borderRadius: 12, border: "1px solid " + (on ? C.teal : "#2B3544"), background: on ? "rgba(53,208,186,.18)" : "#1E2530", color: C.text, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 } }, h("span", { style: { fontSize: 18, fontWeight: 800, lineHeight: "20px" } }, t[1]), h("span", { style: { fontSize: 10.5, color: on ? C.teal : C.dim } }, t[2]));
          })),
        h("div", { style: { display: "flex", gap: 8, alignItems: "center", overflowX: "auto" } },
          ["#FF3B5C", "#FFD43B", "#35D0BA", "#4DA3FF", "#FFFFFF", "#111111"].map(function (c) { return h("button", { key: c, "aria-label": "Colour " + c, onClick: function () { setTeach(Object.assign({}, teach, { color: c })); }, style: { flexShrink: 0, width: 26, height: 26, borderRadius: 26, background: c, border: teach.color === c ? "3px solid " + C.teal : "2px solid #2B3544", cursor: "pointer", padding: 0 } }); }),
          [["S", 3], ["M", 5], ["L", 9]].map(function (z) { var on = teach.size === z[1]; return h("button", { key: z[0], onClick: function () { setTeach(Object.assign({}, teach, { size: z[1] })); }, style: { flexShrink: 0, width: 30, height: 30, borderRadius: 10, border: "1px solid " + (on ? C.teal : "#2B3544"), background: on ? "rgba(53,208,186,.18)" : "#1E2530", color: C.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" } }, z[0]); }),
          h("button", { onClick: function () { var A = annRef.current; A.strokes.pop(); }, style: { flexShrink: 0, padding: "6px 12px", borderRadius: 10, border: "1px solid #2B3544", background: "#1E2530", color: C.text, fontWeight: 600, fontSize: 12.5, cursor: "pointer" } }, "\u21B6 Undo"),
          h("button", { onClick: function () { annRef.current.strokes = []; annRef.current.cur = null; }, style: { flexShrink: 0, padding: "6px 12px", borderRadius: 10, border: "1px solid #5A2A36", background: "#2A1B20", color: "#FFB3C0", fontWeight: 600, fontSize: 12.5, cursor: "pointer" } }, "Clear"))),
      // your video sheet: camera / picture / off, plus effects
      vpanel && (isHost || kind === "meeting") && h("div", { style: { position: "relative", zIndex: 9, background: C.card, borderTop: "1px solid " + C.line, padding: "10px 12px 8px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } }, h("span", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 14.5, color: C.text } }, "Your video"), h("button", { "aria-label": "Close", onClick: function () { setVpanel(false); }, style: { background: "none", border: "none", color: C.dim, fontSize: 18, cursor: "pointer" } }, "\u2715")),
        h("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
          [["camera", "\uD83D\uDCF7 Camera"], ["image", "\uD83D\uDDBC Picture"], ["off", "\uD83D\uDEAB Off"]].map(function (o) {
            var on = vmode === o[0], disabled = o[0] === "image" && !CAN_PIPE;
            return h("button", { key: o[0], disabled: disabled, onClick: function () { if (o[0] === "image") { if (imgRef.current && vmode !== "image") setLook("image"); else if (fileRef.current) fileRef.current.click(); } else setLook(o[0]); }, style: { flex: 1, padding: "9px 4px", borderRadius: 12, border: "1px solid " + (on ? C.teal : "#2B3544"), background: on ? "rgba(53,208,186,.16)" : "#1E2530", color: on ? C.teal : C.text, fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: disabled ? 0.4 : 1 } }, o[1]);
          })),
        h("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ""; pickImage(f); } }),
        vmode === "image" && h("button", { onClick: function () { if (fileRef.current) fileRef.current.click(); }, style: { background: "none", border: "none", color: C.teal, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "0 0 8px" } }, "Choose a different picture"),
        CAN_PIPE ? h("div", { style: { opacity: vmode === "off" ? 0.4 : 1 } },
          h("div", { style: { color: C.dim, fontSize: 12, marginBottom: 4 } }, "Effects"),
          h("div", { style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 } }, EFFECT_LIST.map(function (e) {
            var on = fxName === e[0];
            return h("button", { key: e[0], disabled: vmode === "off", onClick: function () { setLook(null, e[0]); }, style: { flexShrink: 0, padding: "8px 14px", borderRadius: 999, border: "1px solid " + (on ? C.purple : "#2B3544"), background: on ? "rgba(124,92,255,.25)" : "#1E2530", color: C.text, fontWeight: on ? 700 : 500, fontSize: 13, cursor: "pointer" } }, e[1]);
          })))
          : h("div", { style: { color: C.dim, fontSize: 12.5 } }, "Effects and pictures are not supported on this phone or browser. You can still turn your video off.")),
      // call controls (host / meeting members)
      (isHost || kind === "meeting") && h("div", { style: { position: "relative", zIndex: 8, display: "flex", justifyContent: "center", gap: 18, padding: "8px 10px calc(12px + env(safe-area-inset-bottom,0px))", background: C.card } },
        h("button", { "aria-label": mediaState.mic ? "Mute" : "Unmute", onClick: toggleMic, style: round(mediaState.mic ? "#2B3544" : "#F5F7FA", 46) }, mediaState.mic ? "\uD83C\uDF99" : "\uD83D\uDD07"),
        info.video !== false && h("button", { "aria-label": vmode === "off" ? "Turn video on" : "Turn video off", onClick: toggleCam, style: round(vmode === "off" ? "#F5F7FA" : "#2B3544", 46) }, vmode === "off" ? "\uD83D\uDEAB" : "\uD83D\uDCF7"),
        SCREEN_OK && info.video !== false && h("button", { "aria-label": vmode === "screen" ? "Stop sharing screen" : "Share screen", onClick: startScreen, style: round(vmode === "screen" ? C.teal : "#2B3544", 46) }, "\uD83D\uDDA5"),
        info.video !== false && h("button", { "aria-label": "Video effects and picture", onClick: function () { setVpanel(!vpanel); setPanel(null); }, style: round(vpanel || fxName !== "none" || vmode === "image" ? C.purple : "#2B3544", 46) }, "\u2728"),
        h("button", { "aria-label": "Leave", onClick: leave, style: round(C.red, 46) }, "\u260E")));
  }

  // ---------------------------------------------------------------- the Live tab (lobby)
  function Screen(p) {
    var me = p.me;
    var rs = useState(null), room = rs[0], setRoom = rs[1];
    var ls = useState([]), lives = ls[0], setLives = ls[1];
    var cs = useState(function () { try { return (new URLSearchParams(location.search).get("live") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); } catch (e) { return ""; } }), codeIn = cs[0], setCodeIn = cs[1];
    var ms = useState(""), msg = ms[0], setMsg = ms[1];
    var bs = useState(false), busy = bs[0], setBusy = bs[1];
    var ts = useState(""), title = ts[0], setTitle = ts[1];
    var as = useState(null), alertLive = as[0], setAlert = as[1];   // "X is live" banner
    var ss = useState(null), sk = ss[0], setSk = ss[1];

    // follow the app's socket (it is replaced after a sign-in) and listen for "someone in my chats went live"
    useEffect(function () { var t = setInterval(function () { var s = sock(); if (s !== sk) setSk(s || null); }, 1000); return function () { clearInterval(t); }; }, [sk]);
    useEffect(function () {
      if (!sk) return;
      var onStarted = function (m) {
        if (!m || !m.host || m.host.id === me.id) return;
        setAlert(m);
        try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(m.host.name + " is live now", { body: m.title || "Tap to watch", tag: "live-" + m.code }); } catch (e) {}
        setTimeout(function () { setAlert(function (a) { return a && a.code === m.code ? null : a; }); }, 15000);
      };
      var onEnded = function (m) { setAlert(function (a) { return a && m && a.code === m.code ? null : a; }); };
      sk.on("live:started", onStarted); sk.on("live:ended", onEnded);
      return function () { sk.off("live:started", onStarted); sk.off("live:ended", onEnded); };
    }, [sk, me.id]);

    useEffect(function () { window.__lcLiveBusy = function () { return !!room; }; return function () { window.__lcLiveBusy = null; }; }, [room]);
    useEffect(function () {
      if (!p.active || room) return;
      var stop = false;
      function load() { var s = sock(); if (!s) return; s.emit("live:list", function (r) { if (!stop && r && r.lives) setLives(r.lives); }); }
      load(); var t = setInterval(load, 6000);
      return function () { stop = true; clearInterval(t); };
    }, [p.active, !!room]);

    function enter(emitName, payload) {
      var s = sock();
      if (!s || !s.connected) return setMsg("Not connected yet. Try again in a moment.");
      if (busyElsewhere()) return setMsg("Finish your call first, then come back.");
      setBusy(true); setMsg("");
      s.emit(emitName, payload, function (r) {
        if (!r || r.error) { setBusy(false); return setMsg((r && r.error) || "Could not connect"); }
        if (emitName === "live:start") { // creator gets the room straight away: join it as host to receive the same data shape
          s.emit("live:join", { code: r.code }, function (j) { setBusy(false); if (!j || j.error) return setMsg((j && j.error) || "Could not start"); setRoom(Object.assign({}, j, { title: r.title })); });
        } else { setBusy(false); setRoom(r); }
      });
    }
    var goLive = function () { enter("live:start", { kind: "live", title: title, video: true }); };
    var meeting = function () { enter("live:start", { kind: "meeting", title: title || "Live Meeting", video: true }); };
    var joinCode = function (c) { var v = (c || codeIn).toUpperCase().replace(/[^A-Z0-9]/g, ""); if (v.length < 4) return setMsg("Enter the meeting code from the host"); enter("live:join", { code: v, manual: !c }); };
    var watch = function (code) { setAlert(null); enter("live:join", { code: code }); };
    var close = function (reason) { setRoom(null); if (reason) setMsg(reason); };

    var s0 = sock();
    var lobby = h("div", { style: { height: "100%", overflowY: "auto", background: C.bg, color: C.text, fontFamily: "Inter, sans-serif", padding: "14px 14px 24px", WebkitOverflowScrolling: "touch" } },
      h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 800, fontSize: 24 } }, "Live"),
      h("div", { style: { color: C.dim, fontSize: 13.5, margin: "2px 0 14px" } }, "Real people. Real conversations. Live."),
      msg && h("div", { role: "alert", style: { background: "#2A1B20", border: "1px solid #5A2A36", color: "#FFB3C0", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, marginBottom: 12 } }, msg),
      h("input", { value: title, maxLength: 60, placeholder: "Title (optional), for example Good Vibes Live", onChange: function (e) { setTitle(e.target.value); }, style: { width: "100%", boxSizing: "border-box", background: C.card, border: "1px solid " + C.line, borderRadius: 12, color: C.text, padding: "11px 12px", fontSize: 14.5, outline: "none", marginBottom: 10 } }),
      h("div", { style: { display: "flex", gap: 10, marginBottom: 14 } },
        h("button", { disabled: busy, onClick: goLive, style: btn("linear-gradient(135deg,#7C5CFF,#C04CFF)", "#fff", { flex: 1, opacity: busy ? 0.6 : 1 }) }, "\uD83C\uDFA5  Go Live"),
        h("button", { disabled: busy, onClick: meeting, style: btn("#17B8A6", "#06201C", { flex: 1, opacity: busy ? 0.6 : 1 }) }, "\uD83D\uDC65  Live Meeting")),
      h("div", { style: { background: C.card, border: "1px solid " + C.line, borderRadius: 16, padding: 12, marginBottom: 16 } },
        h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 15 } }, "Join Live Meeting with Code"),
        h("div", { style: { color: C.dim, fontSize: 12.5, margin: "2px 0 8px" } }, "Get the meeting code from the host and join instantly."),
        h("input", { value: codeIn, maxLength: 8, placeholder: "AB12CD", autoCapitalize: "characters", onChange: function (e) { setCodeIn(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); }, onKeyDown: function (e) { if (e.key === "Enter") joinCode(); }, style: { width: "100%", boxSizing: "border-box", background: "#0E1218", border: "1px solid #2B3544", borderRadius: 12, color: C.text, padding: "12px", fontSize: 18, letterSpacing: 4, textAlign: "center", fontWeight: 700, outline: "none", marginBottom: 8 } }),
        h("button", { disabled: busy, onClick: function () { joinCode(); }, style: btn(C.purple, "#fff", { width: "100%", opacity: busy ? 0.6 : 1 }) }, "Join Now \u2192")),
      h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 8 } }, "People online going live"),
      lives.length === 0 ? h("div", { style: { color: C.dim, fontSize: 13.5, padding: "18px 0", textAlign: "center" } }, s0 ? "Nobody is live right now. Be the first!" : "Connecting\u2026")
        : lives.map(function (l) {
          return h("button", { key: l.code, onClick: function () { joinCode(l.code); }, style: { display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: 10, marginBottom: 8, color: C.text, cursor: "pointer" } },
            h(Avatar, { user: l.host, size: 44 }),
            h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, l.title), h("div", { style: { color: C.dim, fontSize: 12.5 } }, h(Name, { user: l.host }))),
            h("span", { style: { background: C.red, color: "#fff", borderRadius: 7, padding: "2px 7px", fontSize: 11, fontWeight: 800 } }, "LIVE"),
            h("span", { style: { color: C.dim, fontSize: 12.5 } }, "\uD83D\uDC41 " + l.viewers));
        }),
      h("div", { style: { color: "#5B6673", fontSize: 11.5, marginTop: 14, lineHeight: 1.5 } }, "When you go live, the people in your chats are notified. Gifts are free virtual gifts to show support. Meetings fit up to 6 people on video. Live videos show video to the first 8 viewers; everyone else can still comment and send gifts."));

    var banner = alertLive && !room ? h("div", { role: "alert", style: { position: "fixed", left: 10, right: 10, top: "calc(10px + env(safe-area-inset-top,0px))", zIndex: 94, display: "flex", alignItems: "center", gap: 10, background: "#1E2530", border: "1px solid " + C.purple, borderRadius: 16, padding: "10px 12px", color: C.text, fontFamily: "Inter, sans-serif", boxShadow: "0 10px 28px rgba(0,0,0,.5)" } },
      h(Avatar, { user: alertLive.host, size: 40 }),
      h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, (alertLive.host.name || "Someone") + " is live now"), h("div", { style: { color: C.dim, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, alertLive.title)),
      h("button", { onClick: function () { watch(alertLive.code); }, style: btn(C.purple, "#fff", { padding: "8px 14px", fontSize: 13.5 }) }, "Watch"),
      h("button", { "aria-label": "Dismiss", onClick: function () { setAlert(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 18, cursor: "pointer" } }, "\u2715")) : null;
    return h(React.Fragment, null,
      banner,
      p.active ? lobby : null,
      room ? h(Room, { key: room.code, info: room, me: me, socket: sock(), onClose: close }) : null);
  }

  window.LetschatLive = { Screen: Screen, version: 1 };
})();
