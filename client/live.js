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
  var glyph = function (list, key) { for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][1]; return key; };

  // animations (skipped when the phone asks for reduced motion)
  (function css() {
    if (document.getElementById("lc-live-css")) return;
    var s = document.createElement("style"); s.id = "lc-live-css";
    s.textContent = "@keyframes lcFloat{0%{transform:translateY(0) scale(.7);opacity:0}15%{opacity:1}100%{transform:translateY(-260px) scale(1.25);opacity:0}}" +
      "@keyframes lcGift{0%{transform:scale(.4);opacity:0}15%{transform:scale(1.1);opacity:1}80%{opacity:1}100%{transform:scale(1);opacity:0}}" +
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
    var st = useState(function () { return { chat: info.chat || [], viewers: info.viewers || 1, gifts: info.gifts || 0, hostId: info.hostId, host: info.host, media: info.media }; }), S = st[0], setS = st[1];
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
        localRef.current = stream; setLocal(stream);
        if (!stream && wantMedia()) flash("Camera or microphone is blocked. You can still use chat.");
        if (kind === "meeting") (info.peers || []).forEach(function (u) { if (u && u.id !== me.id) offerTo(u.id, true, false); });
        else if (!isHost && info.media) offerTo(info.hostId, false, true);
      });
      return function () { cancelled = true; alive.current = false; Object.keys(pcs.current).forEach(closePeer); if (localRef.current) localRef.current.getTracks().forEach(function (t) { t.stop(); }); localRef.current = null; };
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
      var onMsgReact = function (m) { if (m.code !== code) return; setS(function (s) { return Object.assign({}, s, { chat: s.chat.map(function (c) { return c.id === m.msgId ? Object.assign({}, c, { reactions: m.reactions }) : c; }) }); }); };
      var onFx = function (m) {
        if (m.code !== code) return;
        if (m.kind === "gift") { var gid = ++fxId.current; setGifts(function (g) { return g.concat([{ id: gid, glyph: glyph(GIFTS, m.value), user: m.user }]).slice(-3); }); setTimeout(function () { setGifts(function (g) { return g.filter(function (x) { return x.id !== gid; }); }); }, 3000); }
        var id = ++fxId.current, g = m.kind === "sticker" ? glyph(STICKERS, m.value) : m.kind === "gift" ? glyph(GIFTS, m.value) : m.value;
        setFloaters(function (f) { return f.concat([{ id: id, g: g, x: 8 + Math.random() * 70, big: m.kind !== "emoji" }]).slice(-14); });
        setTimeout(function () { setFloaters(function (f) { return f.filter(function (x) { return x.id !== id; }); }); }, 2700);
      };
      var onMention = function (m) { if (m.code === code) flash(m.from + " mentioned you"); };
      var onEnded = function (m) { if (m.code === code) p.onClose(m.reason || "This live has ended"); };
      var onReconnect = function () { // network came back: take the seat again and rebuild the video links
        socket.emit("live:join", { code: code }, function (r) {
          if (!r || r.error) return p.onClose((r && r.error) || "This live has ended");
          Object.keys(pcs.current).forEach(closePeer);
          setS(function (s) { return Object.assign({}, s, { viewers: r.viewers, gifts: r.gifts, hostId: r.hostId, chat: r.chat || s.chat }); });
          if (kind === "meeting") (r.peers || []).forEach(function (u) { if (u && u.id !== me.id) offerTo(u.id, true, false); });
          else if (r.hostId !== me.id && r.media) offerTo(r.hostId, false, true);
        });
      };
      var evs = { "live:joined": onJoined, "live:left": onLeft, "live:count": onCount, "live:chat": onChat, "live:msgreact": onMsgReact, "live:fx": onFx, "live:mention": onMention, "live:ended": onEnded, "live:signal": onSignal };
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
    var reactMsg = function (m, e) { socket.emit("live:msgreact", { code: code, msgId: m.id, emoji: e }); setPicked(null); };
    var toggleMic = function () { var s = localRef.current; if (!s) return; var on = !mediaState.mic; s.getAudioTracks().forEach(function (t) { t.enabled = on; }); setMedia(Object.assign({}, mediaState, { mic: on })); };
    var toggleCam = function () { var s = localRef.current; if (!s) return; var on = !mediaState.cam; s.getVideoTracks().forEach(function (t) { t.enabled = on; }); setMedia(Object.assign({}, mediaState, { cam: on })); };
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
          h("button", { onClick: function () { setReplyTo(m); setPicked(null); if (inputRef.current) inputRef.current.focus(); }, style: { background: C.teal, color: "#0E1116", border: "none", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 12.5, marginLeft: 4, cursor: "pointer", flexShrink: 0 } }, "Reply")));
    };

    var hostStream = isHost ? local : remotes[S.hostId];
    var tiles = [];
    if (kind === "meeting") {
      tiles.push({ id: me.id, user: me, stream: local, mine: true });
      Object.keys(remotes).forEach(function (id) { tiles.push({ id: id, user: people[id] || { name: "Guest" }, stream: remotes[id] }); });
    }
    var cols = tiles.length <= 1 ? 1 : 2;
    var stage = kind === "live"
      ? h("div", { style: { position: "absolute", inset: 0, background: "#000" } },
          hostStream ? h(VideoEl, { stream: hostStream, muted: isHost, mirror: isHost }) : h("div", { style: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: C.dim, fontFamily: "Inter, sans-serif", textAlign: "center", padding: 24 } },
            h(Avatar, { user: S.host, size: 84 }),
            h("div", { style: { color: C.text, fontWeight: 700, fontSize: 17 } }, S.host && S.host.name),
            h("div", null, S.media === false ? "The video is full right now. You are in the chat and can still send gifts and stickers." : isHost ? "Starting your camera\u2026" : "Connecting to the live\u2026")))
      : h("div", { style: { position: "absolute", left: 0, right: 0, top: 58, bottom: chatOpen ? "46%" : 150, display: "grid", gridTemplateColumns: "repeat(" + cols + ",1fr)", gap: 6, padding: 6, background: "#000" } },
          tiles.map(function (t) {
            return h("div", { key: t.id, style: { position: "relative", borderRadius: 14, overflow: "hidden", background: "#1B2330", minHeight: 0 } },
              t.stream ? h(VideoEl, { stream: t.stream, muted: !!t.mine, mirror: !!t.mine }) : h("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, h(Avatar, { user: t.user, size: 64 })),
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
        h("button", { onClick: function () { copy(code, "Code copied"); }, style: { background: "rgba(124,92,255,.85)", color: "#fff", border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 800, letterSpacing: 2, fontSize: 13, cursor: "pointer" } }, "Code " + code + "  \u29C9"),
        h("button", { onClick: share, style: { background: "rgba(0,0,0,.55)", color: C.text, border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" } }, "Invite"),
        S.gifts > 0 && h("span", { style: { color: C.text, fontSize: 12.5, background: "rgba(0,0,0,.55)", borderRadius: 999, padding: "5px 10px" } }, "\uD83C\uDF81 " + S.gifts)),
      // floating emojis / stickers
      h("div", { style: { position: "absolute", right: 0, bottom: 150, width: "55%", height: 280, pointerEvents: "none", zIndex: 6, overflow: "hidden" } },
        floaters.map(function (f) { return h("div", { key: f.id, className: "lc-fx", style: { position: "absolute", bottom: 0, left: f.x + "%", fontSize: f.big ? 46 : 32, fontWeight: 900, color: "#FFD43B", textShadow: "0 2px 8px rgba(0,0,0,.6)", animation: "lcFloat 2.6s ease-out forwards" } }, f.g); })),
      // gift banners
      h("div", { style: { position: "absolute", left: 0, right: 0, top: "30%", zIndex: 7, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 } },
        gifts.map(function (g) { return h("div", { key: g.id, className: "lc-gift", style: { background: "rgba(124,92,255,.9)", color: "#fff", borderRadius: 999, padding: "8px 18px", display: "flex", alignItems: "center", gap: 10, fontWeight: 700, animation: "lcGift 3s ease forwards" } }, h("span", { style: { fontSize: 38 } }, g.glyph), h("span", null, (g.user && g.user.name) + " sent a gift!")); })),
      toast && h("div", { style: { position: "absolute", left: 16, right: 16, top: 110, zIndex: 9, background: "#1E2530", color: C.text, border: "1px solid #2B3544", borderRadius: 12, padding: "10px 14px", textAlign: "center", fontSize: 13.5 } }, toast),
      h("div", { style: { flex: 1 } }),
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
      // call controls (host / meeting members)
      (isHost || kind === "meeting") && h("div", { style: { position: "relative", zIndex: 8, display: "flex", justifyContent: "center", gap: 18, padding: "8px 10px calc(12px + env(safe-area-inset-bottom,0px))", background: C.card } },
        h("button", { "aria-label": mediaState.mic ? "Mute" : "Unmute", onClick: toggleMic, style: round(mediaState.mic ? "#2B3544" : "#F5F7FA", 46) }, mediaState.mic ? "\uD83C\uDF99" : "\uD83D\uDD07"),
        info.video !== false && h("button", { "aria-label": mediaState.cam ? "Camera off" : "Camera on", onClick: toggleCam, style: round(mediaState.cam ? "#2B3544" : "#F5F7FA", 46) }, mediaState.cam ? "\uD83D\uDCF7" : "\uD83D\uDEAB"),
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
    var joinCode = function (c) { var v = (c || codeIn).toUpperCase().replace(/[^A-Z0-9]/g, ""); if (v.length < 4) return setMsg("Enter the code from the host"); enter("live:join", { code: v }); };
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
        h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 15 } }, "Join Live with Code"),
        h("div", { style: { color: C.dim, fontSize: 12.5, margin: "2px 0 8px" } }, "Get a code from the host and join instantly."),
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
      h("div", { style: { color: "#5B6673", fontSize: 11.5, marginTop: 14, lineHeight: 1.5 } }, "Gifts are free virtual gifts to show support. Meetings fit up to 6 people on video. Live videos show video to the first 8 viewers; everyone else can still comment and send gifts."));

    return h(React.Fragment, null,
      p.active ? lobby : null,
      room ? h(Room, { key: room.code, info: room, me: me, socket: sock(), onClose: close }) : null);
  }

  window.LetschatLive = { Screen: Screen, version: 1 };
})();
