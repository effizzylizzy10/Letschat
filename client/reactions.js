// Letschat Africa: emoji reactions on messages (plain JS, loads before the app).
// The app calls chips() under each message bubble, bar() when a message is selected, and useLive() once per chat.
(function () {
  var h = React.createElement, useState = React.useState;
  var QUICK = ["\uD83D\uDC4D", "\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83D\uDE22", "\uD83D\uDE4F", "\u261D\uFE0F"]; // 👍 ❤️ 😂 😮 😢 🙏 ☝️
  var MORE = ["\uD83D\uDD25", "\uD83D\uDE0D", "\uD83C\uDF89", "\uD83D\uDC4F", "\uD83D\uDE05", "\uD83D\uDE21", "\uD83E\uDD14", "\uD83D\uDE2D", "\uD83D\uDCAF", "\uD83D\uDE4C", "\uD83D\uDE0E", "\uD83E\uDD1D",
    "\uD83D\uDC4E", "\uD83D\uDE18", "\uD83E\uDD73", "\uD83D\uDE01", "\uD83D\uDE34", "\uD83E\uDD2F", "\uD83D\uDC94", "\u2728", "\uD83D\uDC40", "\uD83E\uDD23", "\uD83D\uDE07", "\uD83D\uDCAA"];

  // the little row of emojis shown when you select a message
  function Bar(p) {
    var more = useState(false), open = more[0], setOpen = more[1];
    var mine = (p.m.reactions || {})[p.myId];
    var btn = function (e) {
      var on = e === mine;
      return h("button", { key: e, "aria-label": "React " + e, onClick: function () { p.onReact(p.m, e); },
        style: { background: on ? "rgba(53,208,186,0.22)" : "none", border: on ? "1px solid #35D0BA" : "1px solid transparent", borderRadius: 999, width: 40, height: 40, fontSize: 22, lineHeight: "36px", cursor: "pointer", padding: 0, flexShrink: 0 } }, e);
    };
    return h("div", { style: { background: "#10141B", borderBottom: "1px solid #1B212B", padding: "6px 10px", flexShrink: 0 } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4 } },
        QUICK.map(btn),
        h("button", { "aria-label": open ? "Fewer emojis" : "More emojis", onClick: function () { setOpen(!open); },
          style: { background: "#1E2530", border: "1px solid #2B3544", borderRadius: 999, width: 36, height: 36, color: "#9BA7B4", fontSize: 18, cursor: "pointer", padding: 0, flexShrink: 0 } }, open ? "\u2212" : "+")),
      open && h("div", { style: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2, marginTop: 4 } }, MORE.map(btn)));
  }


  // The floating pill that appears right above (or below) the selected message: 7 quick emojis and a "+" for the full list.
  function Pill(p) {
    var more = useState(false), open = more[0], setOpen = more[1];
    var mineReact = (p.m.reactions || {})[p.myId];
    var pick = function (e) { setOpen(false); p.onReact(p.m, e); };
    var btn = function (e, size) {
      var on = e === mineReact;
      return h("button", { key: e, "aria-label": "React " + e, onClick: function () { pick(e); },
        style: { background: on ? "rgba(53,208,186,0.28)" : "none", border: "none", borderRadius: 999, width: size, height: size, fontSize: size - 12, lineHeight: size + "px", cursor: "pointer", padding: 0, flexShrink: 1, minWidth: 0, flexBasis: size } }, e);
    };
    var all = QUICK.concat(MORE);
    return h("div", { "data-lcpill": "1", style: Object.assign({ position: "absolute", zIndex: 30, display: "flex", justifyContent: p.mine ? "flex-end" : "flex-start", left: 8, right: 8, pointerEvents: "none" }, p.below ? { top: "100%", marginTop: -2 } : { bottom: "100%", marginBottom: -2 }) },
      h("div", { style: { pointerEvents: "auto", maxWidth: "100%", display: "flex", alignItems: "center", gap: 2, background: "#1E2530", border: "1px solid #2B3544", borderRadius: 999, padding: "6px 8px", boxShadow: "0 8px 26px rgba(0,0,0,0.55)" } },
        QUICK.map(function (e) { return btn(e, 40); }),
        h("button", { "aria-label": "More emojis", onClick: function () { setOpen(true); },
          style: { background: "#3A4452", border: "none", borderRadius: 999, width: 36, height: 36, color: "#F5F7FA", fontSize: 24, lineHeight: "34px", cursor: "pointer", padding: 0, flexShrink: 0, marginLeft: 2 } }, "+")),
      open && h("div", { "data-lcpill": "1", onClick: function () { setOpen(false); }, style: { position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", pointerEvents: "auto" } },
        h("div", { onClick: function (e) { e.stopPropagation(); }, style: { width: "100%", background: "#161B22", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "14px 12px 22px", borderTop: "1px solid #262E3A", maxHeight: "60%", overflowY: "auto" } },
          h("div", { style: { fontFamily: "Sora, Inter, sans-serif", fontWeight: 700, fontSize: 15, color: "#F5F7FA", margin: "0 6px 8px" } }, "React with…"),
          h("div", { style: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2 } }, all.map(function (e) { return btn(e, 46); })))));
  }

  // the emojis on a bubble, with a count when more than one person used the same one.
  // Received messages: pills sit on the bottom-left edge of the bubble. Sent messages: plain emojis, no pill.
  function Chips(p) {
    var r = p.m.reactions || {}, counts = {}, order = [];
    Object.keys(r).forEach(function (u) { var e = r[u]; if (!counts[e]) { counts[e] = 0; order.push(e); } counts[e]++; });
    var mine = !!p.mine;
    var items = order.map(function (e) {
      var on = r[p.myId] === e;
      return h("button", { key: e, "aria-label": e + " " + counts[e], onClick: function () { p.onReact(p.m, e); },
        style: mine
          ? { display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", padding: 0, cursor: "pointer", color: "#F5F7FA", fontFamily: "Inter", fontSize: 12.5, lineHeight: "20px" }
          : { display: "flex", alignItems: "center", gap: 3, background: "#10141B", border: on ? "1px solid #35D0BA" : "1px solid #2B3544", borderRadius: 999, padding: "1px 7px", cursor: "pointer", color: "#F5F7FA", fontFamily: "Inter", fontSize: 12.5, lineHeight: "20px" } },
        h("span", { style: { fontSize: 14 } }, e), counts[e] > 1 && h("span", null, counts[e]));
    });
    return h("div", { style: mine
      ? { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }
      : { position: "absolute", left: 8, bottom: -14, display: "flex", gap: 4, zIndex: 1 } }, items);
  }

  function has(m) { return !!m && !m.deleted && !!m.reactions && Object.keys(m.reactions).length > 0; }

  function pill(m, myId, onReact, mine, below) { return !m || m.deleted ? null : h(Pill, { m: m, myId: myId, onReact: onReact, mine: !!mine, below: !!below }); }
  function bar(m, myId, onReact) { return !m || m.deleted ? null : h(Bar, { m: m, myId: myId, onReact: onReact }); }
  function chips(m, myId, onReact, mine) { return has(m) ? h(Chips, { m: m, myId: myId, onReact: onReact, mine: mine }) : null; }

  // applies reactions other people (or you, on another device) add while the chat is open
  function useLive(socket, convId, setMsgs) {
    React.useEffect(function () {
      if (!socket) return;
      var on = function (d) {
        if (!d || d.conversationId !== convId) return;
        setMsgs(function (prev) { return prev.map(function (x) { return x.id === d.messageId ? Object.assign({}, x, { reactions: d.reactions }) : x; }); });
      };
      socket.on("message:reaction", on);
      return function () { socket.off("message:reaction", on); };
    }, [socket, convId]);
  }

  window.LCReactions = { pill: pill, bar: bar, chips: chips, has: has, useLive: useLive };
})();
