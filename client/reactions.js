// Letschat Africa: emoji reactions on messages (plain JS, loads before the app).
// The app calls chips() under each message bubble, bar() when a message is selected, and useLive() once per chat.
(function () {
  var h = React.createElement, useState = React.useState;
  var QUICK = ["\uD83D\uDC4D", "\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83D\uDE22", "\uD83D\uDE4F"]; // 👍 ❤️ 😂 😮 😢 🙏
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

  // the emojis under a bubble, with a count when more than one person used the same one
  function Chips(p) {
    var r = p.m.reactions || {}, counts = {}, order = [];
    Object.keys(r).forEach(function (u) { var e = r[u]; if (!counts[e]) { counts[e] = 0; order.push(e); } counts[e]++; });
    return h("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 } },
      order.map(function (e) {
        var on = r[p.myId] === e;
        return h("button", { key: e, "aria-label": e + " " + counts[e], onClick: function () { p.onReact(p.m, e); },
          style: { display: "flex", alignItems: "center", gap: 3, background: "rgba(14,17,22,0.55)", border: on ? "1px solid #35D0BA" : "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "1px 7px", cursor: "pointer", color: "#F5F7FA", fontFamily: "Inter", fontSize: 12.5, lineHeight: "20px" } },
          h("span", { style: { fontSize: 14 } }, e), counts[e] > 1 && h("span", null, counts[e]));
      }));
  }

  function bar(m, myId, onReact) { return !m || m.deleted ? null : h(Bar, { m: m, myId: myId, onReact: onReact }); }
  function chips(m, myId, onReact) { return !m || m.deleted || !m.reactions || !Object.keys(m.reactions).length ? null : h(Chips, { m: m, myId: myId, onReact: onReact }); }

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

  window.LCReactions = { bar: bar, chips: chips, useLive: useLive };
})();
