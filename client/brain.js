// LetsChat AI offline brain (v71).
// A small, free engine that runs on the phone itself (no server, no key, no download) so the AI robot still answers with no network.
// It answers: Letschat how-tos, maths, unit conversions, date and time, African capitals and currencies, greetings and small talk,
// and questions it already answered online before (saved on the device). Anything else is honestly marked "need a network" and is
// queued, then sent to the real AI by itself when the phone is back online.
// Public API (window.LCBrain): answer(text), remember(q, parts), loadChat(), saveChat(msgs), queue(text), takePending().
(function (w) {
  "use strict";
  var KEY_QA = "lcbrain.qa.v1", KEY_CHAT = "lcbrain.chat.v1", KEY_PEND = "lcbrain.pending.v1";
  var FACTS = ["Letschat Africa is a chat app for Africa. It has chats, groups, communities, status updates (24 hours), a Market for buying and selling, voice and video calls, voice notes and a Tools tab.", "To start a chat: tap the pencil button on the Chats tab, then type a username, email or phone number with country code, or pick 'Find friends from my phonebook' to see which contacts are already on Letschat.", "To invite a friend who is not on the app: in the phonebook list tap Invite next to their name. WhatsApp opens with the app link ready to send.", "To send a photo, file or voice note: the paperclip sends files (up to 3 MB), the camera takes a photo, and the microphone records a voice note. Tap the mic again or the send button to send it.", "To create a group: on the Chats tab tap the group icon at the top, pick contacts and name the group. The admin can add members and share an invite link from Group info.", "Profile link: Tools > Profile > Profile link. Anyone who opens your link can message you. Tap Reset to make the old link stop working.", "Favourites: open a chat, tap the three dots and choose Add to favourites. All of them are in Tools > Favourites.", "To block someone: open their chat, tap the three dots and choose Block. You can unblock in Tools > Privacy.", "Privacy: in Tools > Privacy you can switch off blue ticks (read receipts) and hide your last seen. If you hide yours you will not see theirs either.", "If messages are slow or not sending: check your internet. The server can take up to a minute to wake up after a quiet period, then it is fast again.", "If a new profile photo has not updated: close and reopen the app, it shows for everyone after a moment.", "Typing status: people in a chat can see when you are typing, recording a voice note or sending a photo. You can switch this off in Tools > Sounds & features.", "Sounds & features (Tools): turn on or off ping tones, typing sound, send sound, status, calls, voice notes, disappearing messages, view-once, pinned messages, chat lock, polls, scheduled messages, link previews and message effects.", "Status: open the Updates tab. The camera button posts a photo status and the pencil posts a text status. Status lasts 24 hours and you can see who viewed it. In the viewer's menu you can star, mute or reshare someone's update.", "Archive a chat by swiping it on the chat list (an Undo appears). Long-press a chat to select it, then pin, mute, delete, archive or mark as unread.", "Verified badge: the blue tick shows an account verified by the Letschat creator.", "AI assistant (Tools > AI assistant): when switched on and you are offline, it answers your direct chats in your own style. Its replies start with 'AI:'. It never answers about money, passwords, codes or account numbers. In a group, an admin can switch on the AI moderator and give it the group rules.", "Anyone can type '@ai' followed by a question in any chat or group to get an answer with its source.", "Letschat Africa was built by the developer Abdullahi Salawu. Tools > About the developer has his contact details.", "Never share your password, OTP, PIN or card details with anyone in a chat, including the AI. Letschat will never ask for them.", "Offline: with no network Letschat still opens, shows saved chats, and keeps messages you send in an outbox that sends by itself when the connection is back. Calls, Live, games, signing in for the first time, and posting a status or market item need a network."];

  function rd(k, d) { try { var v = w.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function wr(k, v) { try { w.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function cut(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "\u2026" : s; }
  function clip(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "\u2026" : s; }

  var STOP = " a an the is are was were be to of in on at for and or but if it its i me my you your we our they them this that these those do does did can could would should will what how why when where who which with from by as about please tell give show any some there here have has had not no yes so than then too very just".split(" ");
  function tokens(s) {
    var out = [], parts = String(s || "").toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\s]/g, " ").split(/\s+/);
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i];
      if (t.length < 3 || STOP.indexOf(t) >= 0) continue;
      if (t.length > 4 && /s$/.test(t) && !/ss$/.test(t)) t = t.slice(0, -1);
      out.push(t);
    }
    return out;
  }

  // ---------- maths (no eval: a tiny parser) ----------
  function calc(src) {
    var s = src, i = 0;
    function ws() { while (s.charAt(i) === " ") i++; }
    function num() {
      ws(); var m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]);
    }
    function prim() {
      ws();
      if (s.charAt(i) === "(") { i++; var v = expr(); ws(); if (s.charAt(i) !== ")") throw 0; i++; return v; }
      var n = num(); ws();
      if (s.charAt(i) === "%") { var rest = s.slice(i + 1).replace(/^\s+/, ""); if (!/^[\d(.]/.test(rest)) { i++; return n / 100; } }
      return n;
    }
    function un() { ws(); if (s.charAt(i) === "-") { i++; return -un(); } if (s.charAt(i) === "+") { i++; return un(); } return pw(); }
    function pw() { var b = prim(); ws(); if (s.charAt(i) === "^") { i++; return Math.pow(b, un()); } return b; }
    function term() {
      var v = un();
      for (;;) {
        ws(); var c = s.charAt(i);
        if (c === "*") { i++; v = v * un(); }
        else if (c === "/") { i++; var d = un(); if (d === 0) throw 1; v = v / d; }
        else if (c === "%") { i++; var d2 = un(); if (d2 === 0) throw 1; v = v % d2; }
        else if (c === "(") { v = v * prim(); }
        else return v;
      }
    }
    function expr() {
      var v = term();
      for (;;) { ws(); var c = s.charAt(i); if (c === "+") { i++; v += term(); } else if (c === "-") { i++; v -= term(); } else return v; }
    }
    var r = expr(); ws(); if (i < s.length) throw 0; return r;
  }
  function fmt(n) {
    if (!isFinite(n)) return String(n);
    var r = Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0) ? n.toExponential(6) : String(parseFloat(n.toPrecision(12)));
    if (/e/.test(r)) return r;
    var p = r.split("."); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); return p.join(".");
  }
  function maths(raw) {
    var t = " " + String(raw).toLowerCase() + " ";
    var pc = /(\d+(?:\.\d+)?)\s*(?:%|percent|per cent)\s*of\s*(\d[\d,]*(?:\.\d+)?)/.exec(t);
    if (pc) { var a = parseFloat(pc[1]), b = parseFloat(pc[2].replace(/,/g, "")); return fmt(a * b / 100); }
    var sq = /(?:square root of|sqrt\s*(?:of)?)\s*(\d+(?:\.\d+)?)/.exec(t);
    if (sq) return fmt(Math.sqrt(parseFloat(sq[1])));
    t = t.replace(/(\d),(\d{3})/g, "$1$2").replace(/(\d),(\d{3})/g, "$1$2")
      .replace(/\b(what is|what's|whats|calculate|compute|solve|work out|how much is|how many is|evaluate|equals?|answer)\b/g, " ")
      .replace(/\bplus\b|\band\b(?=\s*\d)/g, "+").replace(/\bminus\b|\btake away\b/g, "-")
      .replace(/\b(multiplied by|times|multiply)\b/g, "*").replace(/(\d)\s*[x\u00d7]\s*(?=[\d(])/g, "$1*")
      .replace(/\b(divided by|divide by|over)\b/g, "/").replace(/\u00f7/g, "/")
      .replace(/\bto the power of\b|\*\*/g, "^").replace(/[=?]/g, " ");
    t = t.replace(/\s+/g, " ").trim();
    if (!/^[\d\s+\-*\/().^%]+$/.test(t) || !/\d/.test(t) || !/[+\-*\/^%]/.test(t.replace(/^-/, ""))) return null;
    try { return fmt(calc(t)); } catch (e) { return e === 1 ? "undefined (you cannot divide by zero)" : null; }
  }

  // ---------- unit conversion ----------
  var U = {
    km: ["len", 1000], kilometre: ["len", 1000], kilometer: ["len", 1000], mile: ["len", 1609.344], mi: ["len", 1609.344],
    m: ["len", 1], metre: ["len", 1], meter: ["len", 1], ft: ["len", 0.3048], foot: ["len", 0.3048], feet: ["len", 0.3048],
    cm: ["len", 0.01], centimetre: ["len", 0.01], centimeter: ["len", 0.01], inch: ["len", 0.0254], inches: ["len", 0.0254], in: ["len", 0.0254],
    kg: ["mass", 1], kilogram: ["mass", 1], g: ["mass", 0.001], gram: ["mass", 0.001], lb: ["mass", 0.45359237], pound: ["mass", 0.45359237], oz: ["mass", 0.028349523],
    l: ["vol", 1], litre: ["vol", 1], liter: ["vol", 1], ml: ["vol", 0.001], gal: ["vol", 3.785411784], gallon: ["vol", 3.785411784],
    c: ["temp", "c"], celsius: ["temp", "c"], f: ["temp", "f"], fahrenheit: ["temp", "f"]
  };
  var UNAME = { len: { km: "km", m: "m", ft: "ft", cm: "cm", inch: "in", mile: "miles" }, mass: { kg: "kg", g: "g", lb: "lb", oz: "oz" }, vol: { l: "litres", ml: "ml", gal: "gallons" } };
  function unitKey(u) {
    u = u.toLowerCase().replace(/\u00b0/g, "").replace(/\.$/, "");
    if (U[u]) return u;
    var s = u.replace(/(es|s)$/, ""); if (U[s]) return s;
    s = u.replace(/s$/, ""); if (U[s]) return s;
    return null;
  }
  function pretty(k) {
    var t = U[k][0]; if (t === "temp") return U[k][1] === "c" ? "\u00b0C" : "\u00b0F";
    var canon = { kilometre: "km", kilometer: "km", metre: "m", meter: "m", centimetre: "cm", centimeter: "cm", foot: "ft", feet: "ft", inches: "inch", kilogram: "kg", gram: "g", pound: "lb", litre: "l", liter: "l", gallon: "gal", mi: "mile" };
    var base = canon[k] || k; return (UNAME[t] && UNAME[t][base]) || base;
  }
  function convert(raw) {
    var m = /(-?\d+(?:[.,]\d+)?)\s*(?:\u00b0\s*)?([a-z]+)\s*(?:to|in|into|=|as)\s*(?:\u00b0\s*)?([a-z]+)/i.exec(raw);
    if (!m) return null;
    var v = parseFloat(m[1].replace(",", ".")), a = unitKey(m[2]), b = unitKey(m[3]);
    if (!a || !b || U[a][0] !== U[b][0]) return null;
    var out;
    if (U[a][0] === "temp") {
      if (U[a][1] === U[b][1]) out = v;
      else out = U[a][1] === "c" ? v * 9 / 5 + 32 : (v - 32) * 5 / 9;
    } else out = v * U[a][1] / U[b][1];
    return fmt(v) + " " + pretty(a) + " = " + fmt(parseFloat(out.toPrecision(8))) + " " + pretty(b);
  }

  // ---------- date and time ----------
  function clock(raw) {
    var t = raw.toLowerCase(), d = new Date(), tm, dt;
    try { tm = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); dt = d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { tm = d.toTimeString().slice(0, 5); dt = d.toDateString(); }
    if (/\bwhat(?:'s| is)?\s+(?:the\s+)?(?:current\s+)?time\b|\bwhat time is it\b|\bcurrent time\b|\btime now\b/.test(t)) return "It is " + tm + " on " + dt + " (from your phone's clock).";
    if (/\bwhat(?:'s| is)?\s+(?:the\s+|today'?s\s+)?(?:current\s+)?date\b|\btoday'?s date\b|\bwhat day (?:is it|is today)\b|\bwhat(?:'s| is) today\b|\bwhich day is it\b/.test(t)) return "Today is " + dt + ".";
    return null;
  }

  // ---------- small offline knowledge ----------
  var CAPITALS = "Algeria:Algiers|Angola:Luanda|Benin:Porto-Novo|Botswana:Gaborone|Burkina Faso:Ouagadougou|Burundi:Gitega|Cabo Verde:Praia|Cameroon:Yaound\u00e9|Central African Republic:Bangui|Chad:N'Djamena|Comoros:Moroni|DR Congo:Kinshasa|Republic of the Congo:Brazzaville|Ivory Coast:Yamoussoukro|Djibouti:Djibouti|Egypt:Cairo|Equatorial Guinea:Malabo|Eritrea:Asmara|Eswatini:Mbabane|Ethiopia:Addis Ababa|Gabon:Libreville|Gambia:Banjul|Ghana:Accra|Guinea:Conakry|Guinea-Bissau:Bissau|Kenya:Nairobi|Lesotho:Maseru|Liberia:Monrovia|Libya:Tripoli|Madagascar:Antananarivo|Malawi:Lilongwe|Mali:Bamako|Mauritania:Nouakchott|Mauritius:Port Louis|Morocco:Rabat|Mozambique:Maputo|Namibia:Windhoek|Niger:Niamey|Nigeria:Abuja|Rwanda:Kigali|Senegal:Dakar|Seychelles:Victoria|Sierra Leone:Freetown|Somalia:Mogadishu|South Africa:Pretoria (executive), Cape Town (legislative), Bloemfontein (judicial)|South Sudan:Juba|Sudan:Khartoum|Tanzania:Dodoma|Togo:Lom\u00e9|Tunisia:Tunis|Uganda:Kampala|Zambia:Lusaka|Zimbabwe:Harare|United States:Washington, D.C.|United Kingdom:London|France:Paris|Germany:Berlin|China:Beijing|India:New Delhi|Japan:Tokyo|Brazil:Bras\u00edlia|Canada:Ottawa|Australia:Canberra|Russia:Moscow|Saudi Arabia:Riyadh|Turkey:Ankara|Italy:Rome|Spain:Madrid";
  var ALIAS = { "ivory coast": "cote d'ivoire|c\u00f4te d'ivoire", "united states": "usa|us|america|united states of america", "united kingdom": "uk|britain|england|great britain", "dr congo": "drc|democratic republic of the congo|congo kinshasa", "republic of the congo": "congo brazzaville|congo republic" };
  var CURRENCY = { nigeria: "naira (NGN, \u20a6)", ghana: "Ghanaian cedi (GHS)", kenya: "Kenyan shilling (KES)", "south africa": "rand (ZAR)", uganda: "Ugandan shilling (UGX)", tanzania: "Tanzanian shilling (TZS)", rwanda: "Rwandan franc (RWF)", ethiopia: "birr (ETB)", egypt: "Egyptian pound (EGP)", morocco: "dirham (MAD)", senegal: "CFA franc (XOF)", "ivory coast": "CFA franc (XOF)", cameroon: "CFA franc (XAF)", zambia: "kwacha (ZMW)", botswana: "pula (BWP)", "united states": "US dollar (USD)", "united kingdom": "pound sterling (GBP)" };
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function country(t) {
    var list = CAPITALS.split("|"), best = null;
    for (var i = 0; i < list.length; i++) {
      var p = list[i].split(":"), names = [p[0].toLowerCase()];
      if (ALIAS[names[0]]) names = names.concat(ALIAS[names[0]].split("|"));
      for (var j = 0; j < names.length; j++) {
        if (new RegExp("(^|[^a-z])" + esc(names[j]) + "($|[^a-z])").test(t) && (!best || names[j].length > best.len)) best = { name: p[0], cap: p[1], len: names[j].length };
      }
    }
    return best;
  }
  function knowledge(raw) {
    var t = raw.toLowerCase();
    if (/\bcapital\b/.test(t)) { var c = country(t); if (c) return "The capital of " + c.name + " is " + c.cap + "."; }
    if (/\b(currency|money)\b/.test(t)) { var c2 = country(t); if (c2 && CURRENCY[c2.name.toLowerCase()]) return "The currency of " + c2.name + " is the " + CURRENCY[c2.name.toLowerCase()] + "."; }
    if (/\bhow many states\b.*\bnigeria\b|\bnigeria\b.*\bhow many states\b/.test(t)) return "Nigeria has 36 states plus the Federal Capital Territory (Abuja).";
    if (/\bnigeria('s)?\b.*\b(independence|independent)\b|\b(independence|independent)\b.*\bnigeria\b/.test(t)) return "Nigeria became independent from Britain on 1 October 1960.";
    if (/\bhow many (days|months|weeks|hours|minutes) (are )?in (a |one )?(year|week|day|month|hour)\b/.test(t)) return "A year has 12 months, 52 weeks and 365 days (366 in a leap year). A week has 7 days, a day has 24 hours, an hour has 60 minutes.";
    return null;
  }

  // ---------- chat manners ----------
  var SECRET = /\b(password|passcode|otp|one[- ]time (code|password)|pin( code)?|cvv|card number|bvn|nin|seed phrase|secret code)\b/i;
  var CHIT = [
    [/^(hi+|hello+|hey+|yo|hola|good (morning|afternoon|evening)|how far|wetin dey|how you dey|sup|what'?s up|whatsup)\b[\s!.?]*$/i, ["Hello! \ud83d\udc4b I'm in offline mode right now, but I can still help with Letschat tips, maths, conversions and more.", "Hi there! No network at the moment, but ask me anything about Letschat or a quick calculation. \ud83d\ude0a"]],
    [/\bhow (are|r) (you|u)\b|\bhow('s| is) it going\b|\bhow you dey\b|\bhow body\b/i, ["I'm doing fine, thanks for asking! \ud83d\ude0a I'm running on your phone right now (offline mode). How are you?"]],
    [/\b(thank(s| you)?|thx|nagode|e se|daalu|appreciate)\b/i, ["You're welcome! \ud83d\ude4f", "Anytime! \ud83d\ude0a"]],
    [/\b(bye|goodbye|see you|later|good night|catch you)\b/i, ["Bye for now! \ud83d\udc4b", "Good night and take care! \ud83c\udf19"]],
    [/\bwho (are|r) (you|u)\b|\byour name\b|\bwhat are you\b/i, ["I'm LetsChat AI, the helper inside Letschat Africa. \ud83e\udd16 Right now I'm in offline mode, so I answer from what is saved on your phone."]],
    [/\bwho (made|created|built|developed|owns?) (you|letschat|this app)\b/i, ["Letschat Africa was built by the developer Abdullahi Salawu. Tools > About the developer has his contact details."]],
    [/\bwhat can (you|u) do\b|\bhelp me\b|\bwhat do you know\b|\bhow can you help\b/i, ["Offline I can: explain how to use Letschat (chats, groups, status, privacy, blocking...), do maths and percentages, convert units (km/miles, kg/lb, \u00b0C/\u00b0F), tell the time and date, give African capitals and currencies, and repeat answers I already gave you online. For anything else I will keep your question and answer it when you are back online."]],
    [/\b(are you|r u) (online|offline)\b|\bno (network|internet)\b/i, ["I'm in offline mode now, running on your phone. Questions I can't answer here are saved and I'll answer them as soon as you are connected."]],
    [/\b(tell|say|give) (me )?(a )?joke\b|\bmake me laugh\b/i, ["Why did the phone go to school? To get smarter! \ud83d\ude04", "I told my phone I needed space... now it says 'Storage almost full'. \ud83d\ude02", "Why was the computer cold? It left its Windows open. \ud83d\ude04"]]
  ];

  var SYN = { start: ["create", "make", "new"], make: ["create"], new: ["create"], add: ["create", "invite"], remove: ["delete", "block"], ban: ["block"], hide: ["privacy", "switch"], stop: ["switch", "block"], picture: ["photo"], pic: ["photo"], dp: ["photo", "profile"], voice: ["voice", "note"], message: ["chat"], text: ["chat", "message"], slow: ["slow"], scam: ["share", "password"], link: ["link"], seen: ["last", "tick"], tick: ["tick", "receipt"] };
  var FTOK = null, DF = {};
  function prep() {
    if (FTOK) return; FTOK = [];
    for (var i = 0; i < FACTS.length; i++) {
      var t = tokens(FACTS[i]); FTOK.push({ all: t, head: t.slice(0, 7) });
      var seen = {}; for (var j = 0; j < t.length; j++) if (!seen[t[j]]) { seen[t[j]] = 1; DF[t[j]] = (DF[t[j]] || 0) + 1; }
    }
  }
  function idf(t) { return Math.log(1 + FACTS.length / (DF[t] || 1)); }
  function appAnswer(text) {
    var q = tokens(text); if (!q.length) return null; prep();
    var scored = [];
    for (var i = 0; i < FACTS.length; i++) {
      var f = FTOK[i], hit = 0, sc = 0;
      for (var j = 0; j < q.length; j++) {
        var alts = [q[j]].concat(SYN[q[j]] || []), m = null;
        for (var k = 0; k < alts.length && !m; k++) if (f.all.indexOf(alts[k]) >= 0) m = alts[k];
        if (m) { hit++; sc += idf(m) + (f.head.indexOf(m) >= 0 ? 1.5 : 0); }
      }
      if (hit >= 2 || (q.length === 1 && hit === 1 && q[0].length > 4)) scored.push({ f: FACTS[i], s: sc });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    if (!scored.length) return null;
    var out = [scored[0].f]; if (scored[1] && scored[1].s >= scored[0].s * 0.85) out.push(scored[1].f);
    return out;
  }

  // ---------- answers saved from online use ----------
  function setOf(a) { var o = {}; for (var i = 0; i < a.length; i++) o[a[i]] = 1; return o; }
  function remember(q, parts) {
    try {
      var tk = tokens(q); if (tk.length < 2 || !parts || !parts.length) return;
      var s = String(q); if (SECRET.test(s)) return;
      var list = rd(KEY_QA, []), key = tk.slice().sort().join(" ");
      list = list.filter(function (e) { return e.k !== key; });
      list.push({ k: key, q: clip(q, 160), p: parts.map(function (x) { return cut(x, 1200); }).slice(0, 4), t: Date.now() });
      if (list.length > 80) list = list.slice(list.length - 80);
      wr(KEY_QA, list);
    } catch (e) { }
  }
  function saved(text) {
    var tk = tokens(text); if (tk.length < 2) return null;
    var a = setOf(tk), list = rd(KEY_QA, []), best = null, bs = 0;
    for (var i = 0; i < list.length; i++) {
      var b = list[i].k.split(" "), inter = 0;
      for (var j = 0; j < b.length; j++) if (a[b[j]]) inter++;
      var sc = inter / (tk.length + b.length - inter);
      if (sc > bs) { bs = sc; best = list[i]; }
    }
    return best && bs >= 0.6 ? best : null;
  }

  // ---------- queue of questions waiting for the network ----------
  function queue(text) { var l = rd(KEY_PEND, []); if (l.indexOf(text) < 0) l.push(text); wr(KEY_PEND, l.slice(-5)); }
  function takePending() { var l = rd(KEY_PEND, []); if (l.length) wr(KEY_PEND, []); return l; }

  function answer(text, opts) {
    var raw = String(text || "").trim();
    if (!raw) return { parts: ["Type a question and I'll do my best."], matched: true, by: "offline" };
    if (SECRET.test(raw) && /\b(my|is|are|this|here)\b|\d{4,}/i.test(raw)) {
      return { parts: ["Please don't share passwords, OTPs, PINs or card details with anyone in a chat, including me. Letschat will never ask for them. \ud83d\udd12"], matched: true, by: "offline" };
    }
    var r;
    for (var i = 0; i < CHIT.length; i++) if (CHIT[i][0].test(raw) && raw.length < 80) return { parts: [pick(CHIT[i][1])], matched: true, by: "offline" };
    if ((r = clock(raw))) return { parts: [r], matched: true, by: "offline" };
    if ((r = convert(raw))) return { parts: [r], matched: true, by: "offline" };
    if ((r = maths(raw))) return { parts: ["= " + r], matched: true, by: "offline" };
    if ((r = knowledge(raw))) return { parts: [r], matched: true, by: "offline" };
    var app = appAnswer(raw);
    if (app) return { parts: app, matched: true, by: "offline" };
    var s = saved(raw);
    if (s) {
      var when = ""; try { when = new Date(s.t).toLocaleDateString([], { day: "numeric", month: "short" }); } catch (e) { }
      var p = s.p.slice(); p[p.length - 1] += "\n(Saved answer from " + when + ". It may be out of date; I'll refresh it when you're online.)";
      return { parts: p, matched: true, by: "saved" };
    }
    if (!(opts && opts.noQueue)) queue(raw);
    return { parts: ["I'm offline right now, so I can't look that one up. \ud83d\udce1 I've kept your question and will answer it in full as soon as you're back online.", "Meanwhile I can help with Letschat how-tos, maths, unit conversions, the time and date, and African capitals and currencies."], matched: false, by: "offline" };
  }

  // ---------- chat history mirror (so offline chats are still there after closing the app) ----------
  function loadChat() { var l = rd(KEY_CHAT, []); return Array.isArray(l) ? l : []; }
  function saveChat(msgs) {
    try { var l = (msgs || []).slice(-60).map(function (m) { return { from: m.from, text: cut(m.text, 3000), t: m.t, id: m.id }; }); wr(KEY_CHAT, l); } catch (e) { }
  }

  // ---------- optional on-device language model (installed only when the person taps Install) ----------
  // Runs a small GGUF model with wllama (llama.cpp compiled to WebAssembly, single-thread so it needs no special headers).
  // The library and model are downloaded once; wllama keeps the model in the browser's own storage and the service worker keeps the library,
  // so it then works with no network. EDIT HERE: LITE_VER (check the latest at npmjs.com/package/@wllama/wllama) and the model list
  // (or set window.LC_LITE_MODELS in config.js). Hugging Face repo/file names must exist: open huggingface.co/<repo> to confirm.
  var LITE_VER = "2.3.5";
  var MODELS = w.LC_LITE_MODELS || [
    { id: "smollm2-135m", name: "Lite", mb: 145, repo: "HuggingFaceTB/SmolLM2-135M-Instruct-GGUF", file: "smollm2-135m-instruct-q8_0.gguf" },
    { id: "smollm2-360m", name: "Better", mb: 386, repo: "HuggingFaceTB/SmolLM2-360M-Instruct-GGUF", file: "smollm2-360m-instruct-q8_0.gguf" }
  ];
  var KEY_MODEL = "lcbrain.model.v1", KEY_HIDE = "lcbrain.hidemodel.v1";
  var SYS = "You are LetsChat AI, a friendly assistant inside the Letschat Africa app, running offline on the user's phone. Answer in at most 3 short sentences, in simple English. If you are not sure, say so. Never ask for passwords, PINs or OTPs.";
  var L = { phase: "idle", pct: 0, msg: "", subs: [], lib: null, engine: null, engineId: null, loading: null };
  function modelById(id) { for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i]; return null; }
  // several models can be installed; the biggest installed one answers
  function haveIds() { var r = rd(KEY_MODEL, []); if (!Array.isArray(r)) r = r && r.id ? [r.id] : []; return r.filter(function (id) { return !!modelById(id); }); }
  function installed() { var ids = haveIds(), best = null; for (var i = 0; i < ids.length; i++) { var m = modelById(ids[i]); if (!best || m.mb > best.mb) best = m; } return best; }
  if (installed()) L.phase = "ready";
  function snap() { return { phase: L.phase, pct: L.pct, msg: L.msg, cur: L.cur || null, have: haveIds(), model: installed(), models: MODELS, hidden: !!rd(KEY_HIDE, false) }; }
  function emit() { for (var i = 0; i < L.subs.length; i++) { try { L.subs[i](snap()); } catch (e) { } } }
  function supported() {
    if (typeof w.WebAssembly !== "object") return { ok: false, why: "This phone's browser cannot run it (no WebAssembly)." };
    try { new Function("return import('data:text/javascript,')"); } catch (e) { return { ok: false, why: "This phone's browser is too old for the offline model." }; }
    if (w.navigator && w.navigator.deviceMemory && w.navigator.deviceMemory < 1) return { ok: false, why: "This phone has too little memory for the offline model." };
    if (!w.caches && !(w.navigator && w.navigator.storage && w.navigator.storage.getDirectory)) return { ok: false, why: "This browser cannot store the model." };
    return { ok: true, why: "" };
  }
  function loadLib() {
    if (L.lib) return L.lib;
    var base = "https://cdn.jsdelivr.net/npm/@wllama/wllama@" + LITE_VER + "/esm/";
    L.lib = (new Function("u", "return import(u)"))(base + "index.js").then(function (m) {
      var W = m.Wllama || (m.default && m.default.Wllama); if (!W) throw new Error("Offline model library did not load");
      return { W: W, base: base };
    });
    L.lib.then(null, function () { L.lib = null; });
    return L.lib;
  }
  function getEngine(model, onProgress) {
    if (L.engine && L.engineId === model.id) return Promise.resolve(L.engine);
    if (L.loading && L.loading.id === model.id) return L.loading.p;
    var p = loadLib().then(function (lib) {
      var cfg = { "single-thread/wllama.wasm": lib.base + "single-thread/wllama.wasm", "multi-thread/wllama.wasm": lib.base + "multi-thread/wllama.wasm" };
      var eng = new lib.W(cfg, { allowOffline: true });
      return eng.loadModelFromHF(model.repo, model.file, { n_ctx: 1024, progressCallback: onProgress || function () { } }).then(function () { L.engine = eng; L.engineId = model.id; return eng; });
    });
    L.loading = { id: model.id, p: p };
    var clear = function () { L.loading = null; }; p.then(clear, clear);
    return p;
  }
  function freeEngine() { var e = L.engine; L.engine = null; L.engineId = null; try { if (e && e.exit) e.exit(); } catch (x) { } }
  function install(id) {
    var model = modelById(id), sup = supported();
    if (!model) return Promise.reject(new Error("Unknown model"));
    if (!sup.ok) { L.phase = "error"; L.msg = sup.why; emit(); return Promise.reject(new Error(sup.why)); }
    if (L.phase === "installing") return Promise.reject(new Error("Another download is running"));
    if (haveIds().indexOf(id) >= 0) return Promise.resolve();
    var est = w.navigator && w.navigator.storage && w.navigator.storage.estimate ? w.navigator.storage.estimate() : Promise.resolve(null);
    return est.then(function (e) { return e; }, function () { return null; }).then(function (e) {
      if (e && e.quota && e.quota - (e.usage || 0) < model.mb * 1.3 * 1048576) {
        var m = "Not enough free space on this phone for the " + model.name + " model (needs about " + Math.round(model.mb * 1.3) + " MB). Free some space and try again.";
        L.phase = haveIds().length ? "ready" : "error"; L.msg = m; emit(); throw new Error(m);
      }
      return doInstall(model, id);
    });
  }
  function doInstall(model, id) {    L.phase = "installing"; L.cur = model.name; L.pct = 0; L.msg = ""; emit();
    try { if (w.navigator.storage && w.navigator.storage.persist) w.navigator.storage.persist(); } catch (e) { }
    freeEngine();
    return getEngine(model, function (pr) {
      if (pr && pr.total) { L.pct = Math.min(99, Math.round(pr.loaded / pr.total * 100)); emit(); }
    }).then(function () {
      var ids = haveIds(); if (ids.indexOf(id) < 0) ids.push(id); wr(KEY_MODEL, ids);
      freeEngine(); L.phase = "ready"; L.pct = 100; L.msg = ""; L.cur = null; emit();
    }, function (e) {
      L.phase = haveIds().length ? "ready" : "error"; L.msg = clip(String((e && e.message) || e || "Download failed. Check your connection and try again."), 140); L.cur = null; freeEngine(); emit();
      throw e;
    });
  }
  // install every model not yet on the phone, one after the other (smallest first)
  function installAll() {
    var todo = MODELS.slice().sort(function (a, b) { return a.mb - b.mb; }).filter(function (m) { return haveIds().indexOf(m.id) < 0; });
    var chain = Promise.resolve();
    todo.forEach(function (m) { chain = chain.then(function () { return install(m.id); }); });
    return chain;
  }
  function remove() {
    var eng = L.engine; L.engine = null; L.engineId = null;
    var done = function () { try { w.localStorage.removeItem(KEY_MODEL); } catch (e) { } L.phase = "idle"; L.pct = 0; L.msg = ""; L.cur = null; emit(); };
    var steps = [];
    try { if (eng && eng.cacheManager && eng.cacheManager.clear) steps.push(eng.cacheManager.clear()); } catch (e) { }
    try { if (eng && eng.exit) steps.push(eng.exit()); } catch (e) { }
    try { if (w.caches && w.caches.keys) steps.push(w.caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return /wllama/i.test(k); }).map(function (k) { return w.caches.delete(k); })); })); } catch (e) { }
    return Promise.all(steps.map(function (p) { return Promise.resolve(p).then(null, function () { }); })).then(done, done);
  }
  function ask(text, hist) {
    var model = installed(); if (!model) return Promise.reject(new Error("No offline model installed"));
    var msgs = [{ role: "system", content: SYS }], h = (hist || []).slice(-4);
    for (var i = 0; i < h.length; i++) msgs.push({ role: h[i].from === "me" ? "user" : "assistant", content: cut(h[i].text, 400) });
    msgs.push({ role: "user", content: cut(text, 600) });
    var run = getEngine(model).then(function (eng) {
      return eng.createChatCompletion(msgs, { nPredict: 160, sampling: { temp: 0.4, top_k: 40, top_p: 0.9 } });
    }).then(function (out) {
      var t = String(out || "").replace(/<\|[^|]*\|>/g, "").trim();
      if (!t) throw new Error("Empty answer"); return t;
    });
    var limit = new Promise(function (_, rej) { setTimeout(function () { rej(new Error("The offline model took too long")); }, 120000); });
    return Promise.race([run, limit]);
  }
  var lite = {
    state: snap, supported: supported, install: install, installAll: installAll, remove: remove, ask: ask,
    ready: function () { return haveIds().length > 0; },
    hide: function () { wr(KEY_HIDE, true); emit(); },
    subscribe: function (fn) { L.subs.push(fn); return function () { L.subs = L.subs.filter(function (x) { return x !== fn; }); }; }
  };


  w.LCBrain = { answer: answer, remember: remember, loadChat: loadChat, saveChat: saveChat, queue: queue, takePending: takePending, lite: lite, version: 72 };
})(typeof window !== "undefined" ? window : this);
