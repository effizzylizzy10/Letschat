// Runs the real bridge script in a fake page and checks what it would show / hand to the native side.
const fs = require("fs");
const vm = require("vm");
const file = process.argv[2];
const src = fs.readFileSync(file, "utf8");
let failures = 0;
const check = (name, ok, extra) => { console.log((ok ? "PASS  " : "FAIL  ") + name + (ok ? "" : "  " + (extra || ""))); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makePage(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.storage || {});
  const shown = [], sessions = [], fetches = [];
  const listeners = {};
  let settingsDelay = opts.settingsDelay || 0;
  let settingsOk = opts.settingsOk !== false;
  let settingsBody = opts.settings || { muted: {}, blocked: [] };
  const BB = {
    setEnabled: () => Promise.resolve(), hide: () => Promise.resolve(),
    checkOverlayPermission: () => Promise.resolve({ granted: true }), requestOverlayPermission: () => Promise.resolve({}),
    setSession: (o) => { sessions.push(o); return Promise.resolve(); },
    show: (o) => { shown.push(o); return Promise.resolve(); },
    addListener: (n, f) => { listeners[n] = f; },
  };
  const BG = { start: () => Promise.resolve(), stop: () => Promise.resolve(), isIgnoringBatteryOptimizations: () => Promise.resolve({ ignoring: true }), requestIgnoreBatteryOptimizations: () => Promise.resolve() };
  const sockHandlers = [];
  const socket = { __lcHooked: false, onAny: (f) => sockHandlers.push(f) };
  const timers = [];
  const win = {
    Capacitor: { Plugins: { ChatBubble: BB, BackgroundService: BG, App: { addListener: (n, f) => { listeners["app:" + n] = f; } } } },
    LETSCHAT_CONFIG: { API_URL: "https://api.example.test/" },
    io: { managers: { m1: { nsps: { "/": socket } } } },
    confirm: () => false,
  };
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  const ctx = {
    window: win, location: { hostname: "letschat-taupe.vercel.app", origin: "https://letschat-taupe.vercel.app", assign: () => {} },
    localStorage, console, JSON, Date, Math, String, Object, Array, Promise, encodeURIComponent,
    document: { documentElement: {}, evaluate: () => ({ singleNodeValue: null }), querySelector: () => null, hidden: false, addEventListener: () => {} },
    MutationObserver: function () { this.observe = () => {}; },
    setInterval: (f, ms) => { timers.push(f); return timers.length; }, // the page's own timers are driven by hand below
    setTimeout: (f, ms) => setTimeout(f, ms),
    fetch: (url, init) => {
      fetches.push({ url, init });
      return new Promise((resolve, reject) => setTimeout(() => {
        if (!settingsOk) return reject(new Error("offline"));
        resolve({ ok: true, json: () => Promise.resolve({ success: true, data: settingsBody }) });
      }, settingsDelay));
    },
  };
  win.window = win; win.localStorage = localStorage; win.document = ctx.document; win.location = ctx.location; win.fetch = ctx.fetch;
  Object.keys(ctx).forEach((k) => { if (!(k in win)) win[k] = ctx[k]; });
  vm.createContext(ctx);
  ctx.window = ctx; ctx.Capacitor = win.Capacitor; ctx.LETSCHAT_CONFIG = win.LETSCHAT_CONFIG; ctx.io = win.io; ctx.confirm = win.confirm;
  vm.runInContext(src, ctx);
  const page = {
    shown, sessions, fetches, store, listeners,
    tick: () => timers.forEach((f) => { try { f(); } catch (e) { console.log("timer error", e); } }),
    // a socket event while the app is in the background
    emit: (m) => sockHandlers.forEach((f) => f("message:new", m)),
    background: () => listeners["app:appStateChange"] && listeners["app:appStateChange"]({ isActive: false }),
    foreground: () => listeners["app:appStateChange"] && listeners["app:appStateChange"]({ isActive: true }),
    setSettings: (b) => { settingsBody = b; }, setSettingsOk: (v) => { settingsOk = v; }, setSettingsDelay: (v) => { settingsDelay = v; },
  };
  return page;
}

const SESSION = JSON.stringify({ token: "tok", user: { id: "me", name: "Me" } });
const CONVS = JSON.stringify({ uid: "me", list: [
  { id: "dm1", isGroup: false, other: { id: "bob", name: "Bob", avatar: "/api/users/bob/avatar?v=1" } },
  { id: "grp", isGroup: true, name: "Family", members: [{ id: "me", name: "Me" }, { id: "dan", name: "Dan" }], other: { id: "grp", name: "Family" } },
  { id: "room", isGroup: true, chatRoom: true, name: "Chat Room", members: [{ id: "eve", name: "Eve" }] },
  { id: "dmM", isGroup: false, other: { id: "mia", name: "Mia" } },
] });
const base = () => ({ "letschat-africa:session": SESSION, "letschat-africa:convCache": CONVS });

(async () => {
  // ---- 1. hands the session and the two switches to the native side
  let pg = makePage({ storage: base() });
  check("session sent with both switches on by default", pg.sessions.length === 1 && pg.sessions[0].token === "tok" && pg.sessions[0].preview === true && pg.sessions[0].groups === true && pg.sessions[0].userId === "me" && pg.sessions[0].apiUrl === "https://api.example.test", JSON.stringify(pg.sessions));
  pg.store["letschat-africa:notifs"] = JSON.stringify({ preview: false, groups: true });
  pg.tick();
  check("switch change is sent again", pg.sessions.length === 2 && pg.sessions[1].preview === false && pg.sessions[1].groups === true, JSON.stringify(pg.sessions));
  pg.tick();
  check("nothing sent again when nothing changed", pg.sessions.length === 2);

  // ---- 2. direct message: title from the saved chat list
  pg = makePage({ storage: base() });
  pg.background();
  pg.emit({ id: "m1", conversationId: "dm1", senderId: "bob", text: "hello there", time: 1 });
  await sleep(50);
  check("dm: one pop-up with the sender's name as title (not 'Letschat')", pg.shown.length === 1 && pg.shown[0].title === "Bob" && pg.shown[0].text === "hello there" && pg.shown[0].chatId === "dm1" && pg.shown[0].messageId === "m1", JSON.stringify(pg.shown));
  check("dm: avatar from the saved chat list is made absolute", pg.shown[0] && pg.shown[0].avatar === "https://api.example.test/api/users/bob/avatar?v=1", pg.shown[0] && pg.shown[0].avatar);

  // ---- 3. while the app is on screen: nothing
  pg.foreground();
  pg.emit({ id: "m2", conversationId: "dm1", senderId: "bob", text: "on screen" });
  await sleep(50);
  check("app on screen: no pop-up", pg.shown.length === 1);
  pg.background();

  // ---- 4. group message: who wrote it
  pg.emit({ id: "m3", conversationId: "grp", senderId: "dan", text: "dinner?" });
  await sleep(50);
  check("group: title is the group, text starts with who wrote it", pg.shown.length === 2 && pg.shown[1].title === "Family" && pg.shown[1].text === "Dan: dinner?", JSON.stringify(pg.shown[1]));

  // ---- 5. own message, system notice
  pg.emit({ id: "m4", conversationId: "dm1", senderId: "me", text: "from my laptop" });
  pg.emit({ id: "m5", conversationId: "grp", senderId: "system", system: true, text: "Dan joined" });
  await sleep(50);
  check("own message and system notice: no pop-up", pg.shown.length === 2);

  // ---- 6. muted chat and blocked person (read from the server once, then kept for a minute)
  pg = makePage({ storage: base(), settings: { muted: { dmM: 0 }, blocked: [{ id: "blk" }] } });
  pg.background();
  pg.emit({ id: "m6", conversationId: "dmM", senderId: "mia", text: "ping" });
  await sleep(80);
  check("muted chat: no pop-up", pg.shown.length === 0);
  check("settings read with the sign-in token", pg.fetches.length === 1 && pg.fetches[0].url === "https://api.example.test/api/v1/me/settings" && pg.fetches[0].init.headers.Authorization === "Bearer tok", JSON.stringify(pg.fetches.map((f) => f.url)));
  pg.emit({ id: "m7", conversationId: "grp", senderId: "blk", text: "spam" });
  pg.emit({ id: "m8", conversationId: "dm1", senderId: "bob", text: "normal one" });
  await sleep(80);
  check("blocked person: no pop-up, a normal message still shows", pg.shown.length === 1 && pg.shown[0].text === "normal one", JSON.stringify(pg.shown));
  check("settings are not read again within a minute", pg.fetches.length === 1, String(pg.fetches.length));

  // ---- 7. Chat Room: only mentions and replies
  pg = makePage({ storage: base() });
  pg.background();
  pg.emit({ id: "r1", conversationId: "room", senderId: "eve", text: "anyone?" });
  pg.emit({ id: "r2", conversationId: "room", senderId: "eve", text: "@Me hi", mentions: ["me"] });
  pg.emit({ id: "r3", conversationId: "room", senderId: "eve", text: "answering you", replyTo: { id: "x", senderId: "me", name: "Me", text: "my question" } });
  await sleep(80);
  check("chat room: plain message hidden, mention and reply shown", pg.shown.length === 2 && pg.shown[0].messageId === "r2" && pg.shown[1].messageId === "r3", JSON.stringify(pg.shown.map((s) => s.messageId)));
  check("chat room: the reply keeps its quote", pg.shown[1] && pg.shown[1].replyName === "You" && pg.shown[1].replyText === "my question", JSON.stringify(pg.shown[1]));

  // ---- 8. switches
  pg = makePage({ storage: Object.assign(base(), { "letschat-africa:notifs": JSON.stringify({ groups: false }) }) });
  pg.background();
  pg.emit({ id: "g1", conversationId: "grp", senderId: "dan", text: "group text" });
  pg.emit({ id: "d1", conversationId: "dm1", senderId: "bob", text: "direct text" });
  await sleep(80);
  check("'Group messages' off: group quiet, direct message shown", pg.shown.length === 1 && pg.shown[0].messageId === "d1", JSON.stringify(pg.shown.map((s) => s.messageId)));
  pg = makePage({ storage: Object.assign(base(), { "letschat-africa:notifs": JSON.stringify({ preview: false }) }) });
  pg.background();
  pg.emit({ id: "d2", conversationId: "dm1", senderId: "bob", text: "my secret", replyTo: { senderId: "me", text: "quoted secret" } });
  pg.emit({ id: "g2", conversationId: "grp", senderId: "dan", text: "private plan", mentions: ["me"] });
  await sleep(80);
  check("'Show message preview' off: no text, no quote", pg.shown.length === 2 && pg.shown[0].text === "Replied to you" && pg.shown[0].replyText === "" && /Mentioned you/.test(pg.shown[1].text) && !/secret|plan/.test(JSON.stringify(pg.shown)), JSON.stringify(pg.shown));

  // ---- 9. failures never hide a message
  pg = makePage({ storage: base(), settingsOk: false, settings: { muted: { dmM: 0 } } });
  pg.background();
  pg.emit({ id: "x1", conversationId: "dmM", senderId: "mia", text: "settings unreachable" });
  await sleep(80);
  check("settings unreachable: pop-up shown anyway", pg.shown.length === 1);
  pg = makePage({ storage: base(), settingsDelay: 6000 });
  pg.background();
  pg.emit({ id: "x2", conversationId: "dm1", senderId: "bob", text: "slow settings" });
  await sleep(4400);
  check("settings hang: pop-up shown after about 4 seconds", pg.shown.length === 1, String(pg.shown.length));
  pg = makePage({ storage: { "letschat-africa:session": SESSION } }); // no saved chat list at all (first run)
  pg.background();
  pg.emit({ id: "y1", conversationId: "newchat", senderId: "zed", text: "brand new chat" });
  await sleep(80);
  check("chat not in the saved list: still shown (title falls back)", pg.shown.length === 1 && pg.shown[0].title === "Letschat", JSON.stringify(pg.shown));
  pg = makePage({ storage: Object.assign(base(), { "letschat-africa:convCache": "not json {{" , "letschat-africa:notifs": "garbage" }) });
  pg.background();
  pg.emit({ id: "z1", conversationId: "dm1", senderId: "bob", text: "corrupt caches" });
  await sleep(80);
  check("corrupt saved data: still shown", pg.shown.length === 1);
  pg = makePage({ storage: base() });
  pg.background();
  pg.emit({ id: "w1", conversationId: "dm1", senderId: "bob", text: "app comes back before settings arrive" });
  pg.foreground();
  await sleep(120);
  check("app back on screen while waiting: no late pop-up", pg.shown.length === 0, JSON.stringify(pg.shown));

  console.log(failures === 0 ? "\nALL BRIDGE CHECKS PASSED" : "\n" + failures + " BRIDGE CHECK(S) FAILED");
  process.exit(failures ? 1 : 0);
})();
