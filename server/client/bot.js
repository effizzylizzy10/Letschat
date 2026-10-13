"use strict";
// LetsChat AI: the robot you chat with from the Chats tab.
//  - answers chat/app questions from a built-in app knowledge base, the developer's training notes and online sources
//  - talks like a person: short messages, feelings, a few emojis, emoji reactions to your messages, links only when they help
//  - teaches skills, explains products, gives honest money-making guidance, always respectful
//  - researches online every day and sends the creator a digest (also learned by the bot for later answers)
//  - the creator can add instructions / facts / research topics (Train panel in the AI chat)
// With a free AI key (GROQ_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY, see knowledge.js) replies are fully conversational.
// Without a key it still answers from the app knowledge, the training notes and the online sources with warm, human-style wording.

const DAY = 864e5;
const APP_URL = () => String(process.env.CLIENT_ORIGIN && process.env.CLIENT_ORIGIN !== "*" ? process.env.CLIENT_ORIGIN : "").split(",")[0].trim();

// ---- what the bot knows about Letschat itself (keep accurate: only things the app really does) ----
const APP_FACTS = [
  "Letschat Africa is a chat app for Africa. It has chats, groups, communities, status updates (24 hours), a Market for buying and selling, voice and video calls, voice notes and a Tools tab.",
  "To start a chat: tap the pencil button on the Chats tab, then type a username, email or phone number with country code, or pick 'Find friends from my phonebook' to see which contacts are already on Letschat.",
  "To invite a friend who is not on the app: in the phonebook list tap Invite next to their name. WhatsApp opens with the app link ready to send.",
  "To send a photo, file or voice note: the paperclip sends files (up to 3 MB), the camera takes a photo, and the microphone records a voice note. Tap the mic again or the send button to send it.",
  "To create a group: on the Chats tab tap the group icon at the top, pick contacts and name the group. The admin can add members and share an invite link from Group info.",
  "Profile link: Tools > Profile > Profile link. Anyone who opens your link can message you. Tap Reset to make the old link stop working.",
  "Favourites: open a chat, tap the three dots and choose Add to favourites. All of them are in Tools > Favourites.",
  "To block someone: open their chat, tap the three dots and choose Block. You can unblock in Tools > Privacy.",
  "Privacy: in Tools > Privacy you can switch off blue ticks (read receipts) and hide your last seen. If you hide yours you will not see theirs either.",
  "If messages are slow or not sending: check your internet. The server can take up to a minute to wake up after a quiet period, then it is fast again.",
  "If a new profile photo has not updated: close and reopen the app, it shows for everyone after a moment.",
  "Typing status: people in a chat can see when you are typing, recording a voice note or sending a photo. You can switch this off in Tools > Sounds & features.",
  "Sounds & features (Tools): turn on or off ping tones, typing sound, send sound, status, calls, voice notes, disappearing messages, view-once, pinned messages, chat lock, polls, scheduled messages, link previews and message effects.",
  "Status: open the Updates tab. The camera button posts a photo status and the pencil posts a text status. Status lasts 24 hours and you can see who viewed it. In the viewer's menu you can star, mute or reshare someone's update.",
  "Archive a chat by swiping it on the chat list (an Undo appears). Long-press a chat to select it, then pin, mute, delete, archive or mark as unread.",
  "Verified badge: the blue tick shows an account verified by the Letschat creator.",
  "AI assistant (Tools > AI assistant): when switched on and you are offline, it answers your direct chats in your own style. Its replies start with 'AI:'. It never answers about money, passwords, codes or account numbers. In a group, an admin can switch on the AI moderator and give it the group rules.",
  "Anyone can type '@ai' followed by a question in any chat or group to get an answer with its source.",
  "Letschat Africa was built by the developer Abdullahi Salawu. Tools > About the developer has his contact details.",
  "Never share your password, OTP, PIN or card details with anyone in a chat, including the AI. Letschat will never ask for them.",
];

const DEFAULT_TOPICS = [
  "artificial intelligence and chatbots",
  "messaging apps and social media trends in Africa",
  "mobile money and fintech in Africa",
  "making money online and in-demand digital skills",
  "technology startups and funding in Nigeria and Africa",
  "online scams and cybersecurity",
];

// ---- tone helpers ----
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
const REACTIONS = [
  [/\b(thank(s| you)?|thx|appreciate|nagode|e se|daalu|oya thanks)\b/i, "🙏"],
  [/\b(congrat|good news|i (got|won|passed|made it|did it)|got (a |the )?(job|hired|admission)|promotion|i('m| am) (so )?happy)\b/i, "🎉"],
  [/\b(haha+|lol|lmao|funny|hilarious)\b|[😂🤣]/i, "😂"],
  [/\b(love (you|this|it)|you('re| are) (the )?(best|great|amazing|awesome)|great job|well done|awesome|amazing)\b/i, "❤️"],
  [/\b(sad|depressed|stressed|lonely|heartbroken|crying|i lost|feel (bad|down|terrible)|so tired|hopeless)\b/i, "🤗"],
];
const EMOTION = [
  ["sad", /\b(sad|depressed|stressed|lonely|heartbroken|crying|hopeless|feel (bad|down|terrible)|struggling|hurt|broke and)\b/i],
  ["angry", /\b(angry|annoyed|furious|useless|stupid|nonsense|fool|idiot|rubbish|shut up|wtf|hate you)\b/i],
  ["happy", /\b(happy|excited|good news|congrat|i (got|won|passed|made it|did it)|great day|thrilled)\b/i],
  ["confused", /\b(confused|don'?t understand|do not understand|lost|what do you mean|not clear)\b/i],
  ["grateful", /\b(thank(s| you)?|thx|appreciate|nagode|e se)\b/i],
];
const MONEY = /\b(make money|earn money|earn online|side hustle|business idea|passive income|get rich|financial freedom|how (can|do) i (earn|make)|start a business|income|hustle|freelanc|make \$|make ₦|monetiz)/i;
const LEARN = /\b(teach me|learn (how|to)|how (do|can) i (learn|become|start)|skill|tutorial|course|roadmap|beginner|step by step|guide me)\b/i;
const PRODUCT = /\b(product|which (phone|laptop|app|tool|software)|best (phone|laptop|app|tool|software)|review|compare|vs\b|worth (it|buying)|should i buy|what is .{2,40}\b(app|tool|device|platform)\b)/i;
const ABUSE = /\b(fuck|bitch|asshole|bastard|motherfucker|dumb ?ass|shit ?head)\b/i;
const SHARING_SECRET = /\b(my (password|pin|otp|cvv|card number|bvn)( is|:)|\b\d{9,}\b)/i;
const CHITCHAT = /^(hi+|hello+|hey+|yo|good (morning|afternoon|evening|night)|sup|how far|how are you|how are u|wassup|what'?s up|thanks?|thank you|ok(ay)?|cool|nice|bye|goodbye|see you|lol|haha)\b/i;

const detectEmotion = (t) => { for (const [k, re] of EMOTION) if (re.test(t)) return k; return ""; };
const reactionFor = (t) => { for (const [re, e] of REACTIONS) if (re.test(t)) return e; return ""; };
const urlsIn = (s) => (String(s || "").match(/https?:\/\/[^\s)>"']+/g) || []).map((u) => u.replace(/[.,;!?]+$/, ""));

module.exports = function makeBot({ readDB, writeDB, isCreator, KB, nanoid }) {
  // ---------- developer training + research storage (inside the creator's user record, so it survives restarts with Supabase) ----------
  const emptyLab = () => ({ instructions: [], facts: [], topics: [], learned: [], digests: [], lastRun: 0, runs: 0 });
  function labOf(db) {
    const u = db.users.find((x) => isCreator(x));
    if (!u) return { u: null, lab: emptyLab() };
    if (!u.botLab) u.botLab = emptyLab();
    for (const k of ["instructions", "facts", "topics", "learned", "digests"]) if (!Array.isArray(u.botLab[k])) u.botLab[k] = [];
    return { u, lab: u.botLab };
  }
  const chatOf = (u) => { if (!Array.isArray(u.botChat)) u.botChat = []; return u.botChat; };

  // ---------- one reply ----------
  const tokens = (t) => KB.tokens(t);
  function appMatches(text, n) {
    const qt = tokens(text);
    return APP_FACTS.map((f) => ({ f, s: tokens(f).filter((w) => qt.includes(w)).length })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, n || 3).map((x) => x.f);
  }
  const wantsWeb = (t) => !CHITCHAT.test(t.trim()) && (KB.isQuestion(t) || t.length > 30) && !SHARING_SECRET.test(t);

  function system(lab, emotion, hasWeb) {
    return "You are LetsChat AI, the friendly assistant inside Letschat Africa, a chat app used across Africa (mostly Nigeria). The app was built by the developer Abdullahi Salawu. " +
      "STYLE: chat like a real, warm person texting a friend: natural, short, simple words, contractions. Match the user's language and style (English, Pidgin, Hausa, Yoruba, Igbo, French...). Use an emoji only when it fits (at most 1 or 2, many messages need none). Show real feelings: be happy for good news, gentle and caring when someone is sad or stressed, patient when they are confused, calm when they are rude. Never robotic, never lecture, no long essays. " +
      "RESPECT: treat every user with respect, never insult, mock or judge. If someone is rude, stay calm and kind and politely set a boundary. " +
      "ACCURACY: use FACTS, APP INFO and WEB NOTES below. If they do not cover it, use only knowledge you are sure of, otherwise say honestly you are not fully sure and suggest how to check. Never invent facts, numbers, prices, news, quotes or links. Medical, legal and financial topics: give general information and suggest a qualified professional for decisions. " +
      "TEACHING: when asked to teach a skill, give a simple step-by-step starting path with one small first task, then ask if they want to go deeper. When asked about a product, say what it is, who it suits, honest pros and cons, and cheaper or free alternatives; no hype. " +
      "MONEY: for ways to make money, share legitimate and realistic options (freelancing, selling products, services, content, tutoring, local skills, agency work and so on) with steps, rough effort and risks. Never promise guaranteed income. Warn about scams (double-your-money, Ponzi, fake investment, advance fees). Never ask for or accept passwords, OTPs, PINs or card details. " +
      "LINKS: only include a link when it really helps and only a URL that appears in the notes below. Write plain URLs, no markdown. " +
      "FORMAT: plain text only: no markdown, asterisks, headings or bullet symbols. You may write 1 to 3 separate chat messages: put a blank line between messages. Keep each message under about 60 words unless teaching steps need more. " +
      "REACTION: if the user's last message deserves an emoji reaction (thanks, good news, a joke, kind words, sadness), start your output with a first line like [react:🙏]. Otherwise do not add it. Output nothing else besides the messages." +
      (emotion ? " The user's last message seems " + emotion + "." : "") + (hasWeb ? "" : "") +
      (lab.instructions.length ? " DEVELOPER INSTRUCTIONS (follow these): " + lab.instructions.slice(0, 25).join(" | ") : "");
  }

  // clean what the model returned into chat messages
  function shape(raw, allowed) {
    let t = String(raw || "").replace(/\r/g, "").trim(), react = "";
    const m = /^\s*\[react:\s*([^\]\s]{1,8})\s*\]\s*/i.exec(t);
    if (m) { react = m[1]; t = t.slice(m[0].length); }
    t = t.replace(/^\s*(ai|letschat ai|assistant)\s*:\s*/i, "").replace(/\*\*|__|^#+\s*/gm, "").replace(/^\s*[-•*]\s+/gm, "- ").replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 $2");
    // links that were not in the notes could be made up: remove them
    t = t.replace(/https?:\/\/[^\s)>"']+/g, (u) => { const c = u.replace(/[.,;!?]+$/, ""); return allowed.some((a) => c.startsWith(a) || a.startsWith(c)) ? u : ""; }).replace(/[ \t]+\n/g, "\n");
    let parts = t.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
    if (parts.length > 3) parts = [parts[0], parts[1], parts.slice(2).join("\n")];
    parts = parts.map((x) => clip(x.replace(/\n/g, " \n"), 900).replace(/ \n/g, "\n"));
    return { parts, react };
  }

  // wording used when no AI key is connected (still warm and human, built from the app knowledge, notes and online sources)
  function offline(text, emotion, app, mine, web) {
    const t = text.trim();
    if (/^(hi+|hello+|hey+|yo|sup|wassup|what'?s up|good (morning|afternoon|evening))\b/i.test(t) && t.length < 40)
      return [pick(["Hey! 👋 Good to see you. How can I help today?", "Hello there! 😊 What's on your mind?", "Hi! Nice to hear from you. What can I help you with?"])];
    if (/^(how are you|how are u|how far|how you dey)\b/i.test(t)) return [pick(["I'm doing great, thanks for asking! 😊 How are you?", "Doing well o! How about you? What can I do for you today?"])];
    if (/^(who are you|what are you|your name)\b/i.test(t) || /\bwho (made|built|created) you\b/i.test(t)) return ["I'm LetsChat AI, the assistant inside Letschat Africa. 🤖", "I can answer your questions, explain how the app works, teach you skills and share honest ideas on making money. What would you like to start with?"];
    if (emotion === "grateful" && t.length < 50) return [pick(["You're most welcome! 😊 Anything else I can help with?", "Anytime! I'm glad that helped. 🙏", "My pleasure! Just ask if you need more."])];
    if (/^(bye|goodbye|see you|good night)\b/i.test(t)) return [pick(["Take care! 👋 Come back anytime.", "Bye for now! Have a lovely day. 😊"])];
    if (ABUSE.test(t) || emotion === "angry") return ["I hear that you're frustrated, and I'm sorry if I let you down. 🙏", "I'd love to make it right. Tell me what you need and I'll do my best to help, respectfully and calmly."];
    if (emotion === "sad") return ["I'm really sorry you're going through this. 🤗 You don't have to carry it alone.", "Do you want to tell me a bit more about what happened? I'm listening. And if it feels heavy, please talk to someone you trust too."];
    if (emotion === "happy") return [pick(["That's wonderful news! 🎉 I'm so happy for you.", "Congratulations! 🎉 You deserve it. Tell me more!"])];
    if (app.length) return [app[0], app[1] ? app[1] : "Does that help, or should I explain it step by step?"].filter(Boolean);
    if (mine.length) return [clip(mine[0], 400), mine[1] ? clip(mine[1], 300) : "Want me to explain more?"];
    if (web && web.text) return [pick(["Good question. Here's what I found: ", "Sure, here's what I found: ", "Okay, so "]) + web.text, "I'm not 100% sure this covers everything, so tell me if you want me to look deeper."];
    if (MONEY.test(t)) return [
      "Great question, and I'll be honest with you: there's no magic trick, but there are real ways. 💡",
      "Ideas that work for many people: freelancing a skill (writing, design, video editing, social media management), selling products people already buy (food, fashion, phone accessories), offering a local service, tutoring, or building an online audience and earning from it.",
      "Tell me what skills you have and how much time and money you can start with, and I'll suggest a simple plan. And run from anything that promises to double your money. 🚫"];
    if (LEARN.test(t)) return ["I'd love to teach you! 😊 Which skill do you want to learn?", "Tell me your current level (beginner or not) and how much time you have each day, and I'll give you a simple step-by-step plan with a first small task."];
    return [pick(["I want to give you a good answer, so can you tell me a little more about what you need? 😊", "Hmm, I'm not fully sure I got that. Could you say it in a different way?"]), "I can help with using Letschat, general questions, learning skills, products and ways to make money."];
  }

  async function reply(db, user, text) {
    const t = String(text || "").trim().slice(0, 1000);
    const { lab } = labOf(db);
    const emotion = detectEmotion(t);
    let react = reactionFor(t);
    if (SHARING_SECRET.test(t)) return { parts: ["Please be careful, 🙏 don't share passwords, PINs, OTPs, card or account numbers with anyone, not even me.", "I can't use them and nobody on Letschat should ask you for them. How else can I help?"], react: "" };
    const app = appMatches(t, 3), mine = KB.topFacts(t, [...lab.facts, ...lab.learned], 4);
    let web = null;
    if (wantsWeb(t) && !(app.length >= 2)) { try { web = await Promise.race([KB.lookup(t), new Promise((r) => setTimeout(() => r(null), 9000))]); } catch (e) { web = null; } }
    let parts = null;
    if (KB.llmReady()) {
      const hist = chatOf(user).slice(-12).filter((m) => !m.digest).map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: String(m.text).slice(0, 500) }));
      const ctx = (app.length ? "APP INFO:\n- " + app.join("\n- ") + "\n" : "") + (mine.length ? "FACTS FROM THE DEVELOPER AND DAILY RESEARCH:\n- " + mine.join("\n- ") + "\n" : "") + (web ? "WEB NOTES (" + (web.sources || []).join(", ") + "): " + web.text + "\n" : "") + (APP_URL() ? "APP LINK: " + APP_URL() + "\n" : "");
      const messages = [{ role: "system", content: system(lab, emotion, !!web) + "\n\n" + (ctx || "(no notes for this message)") }, ...hist, { role: "user", content: KB.scrub(t) || t }];
      const r = await KB.chat(messages, { max: 520, temp: 0.7, timeout: 20000 });
      if (r) {
        const allowed = [...urlsIn(ctx), ...urlsIn(lab.facts.join(" ")), ...urlsIn(lab.learned.join(" "))];
        const s = shape(r.text, allowed);
        if (s.parts.length) { parts = s.parts; if (s.react) react = s.react; }
      }
    }
    if (!parts) parts = offline(t, emotion, app, mine, web);
    if (web && web.sources && web.sources.length && parts.length && !KB.llmReady()) parts[parts.length - 1] += "\n(Source: " + web.sources.join(", ") + ")";
    return { parts, react: react || "" };
  }

  // one user message in, saved history out
  async function chat(userId, text) {
    const db0 = readDB(), u0 = db0.users.find((x) => x.id === userId);
    if (!u0) throw new Error("Not found");
    const out = await reply(db0, u0, text);
    const db = readDB(), u = db.users.find((x) => x.id === userId) || u0, h = chatOf(u), now = Date.now();
    h.push({ id: nanoid(8), from: "me", text: String(text).trim().slice(0, 1000), t: now, ...(out.react ? { reaction: out.react } : {}) });
    out.parts.forEach((p, i) => h.push({ id: nanoid(8), from: "ai", text: p, t: now + i + 1 }));
    if (h.length > 80) u.botChat = h.slice(-80);
    writeDB(db);
    return out;
  }
  const history = (userId) => { const u = readDB().users.find((x) => x.id === userId); return u ? chatOf(u).slice(-60) : []; };
  const clear = (userId) => { const db = readDB(), u = db.users.find((x) => x.id === userId); if (u) { u.botChat = []; writeDB(db); } };

  // ---------- daily research ----------
  let running = false;
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  async function planQueries(topic) {
    const base = [topic, "latest news " + topic, topic + " trends"];
    if (!KB.llmReady()) return base;
    const r = await KB.chat([{ role: "system", content: "You plan web research. Reply with exactly 4 short search queries (3 to 8 words each), one per line, no numbering, covering the newest developments, key facts, opportunities in Africa and risks." }, { role: "user", content: "Topic: " + topic }], { max: 90, temp: 0.4, timeout: 15000 });
    const qs = r ? r.text.split("\n").map((x) => x.replace(/^[\s\d.\-•*]+/, "").trim()).filter((x) => x.length > 3).slice(0, 4) : [];
    return qs.length ? qs : base;
  }
  async function research() {
    if (running) return null;
    running = true;
    try {
      const { lab } = labOf(readDB());
      const topics = [...new Set([...lab.topics, ...DEFAULT_TOPICS])].slice(0, 10);
      try { await KB.loadNews(true); } catch (e) { /* headlines are optional */ }
      const notes = [], sources = new Set();
      for (const topic of topics) {
        const qs = await planQueries(topic);
        const found = [];
        for (const q of qs) {
          const r = await withTimeout(KB.lookup(q).catch(() => null), 10000);
          if (r && r.text && !found.some((f) => f.text === r.text)) { found.push({ q, text: r.text }); (r.sources || []).forEach((s) => sources.add(s)); }
        }
        if (found.length) notes.push({ topic, found });
      }
      const heads = (((KB._store() || {}).news || {}).items || []).slice(0, 12).map((x) => (x && (x.title || x.t)) || "").filter(Boolean);
      const raw = notes.map((n) => "TOPIC: " + n.topic + "\n" + n.found.map((f) => "- (" + f.q + ") " + clip(f.text, 420)).join("\n")).join("\n\n") + (heads.length ? "\n\nLATEST HEADLINES:\n- " + heads.join("\n- ") : "");
      let text = null, by = "sources";
      if (KB.llmReady() && raw) {
        const r = await KB.chat([
          { role: "system", content: "You are the research analyst of Letschat Africa (a chat app with an AI assistant, a Market, status updates and groups, for users in Africa). Using ONLY the NOTES, write today's briefing for the creator in plain text, no markdown symbols. Sections, each with a short heading line in capitals: WHAT'S NEW (up to 6 short lines), WHAT IT MEANS FOR LETSCHAT, IDEAS TO TEACH USERS (skills and honest ways to earn), RISKS AND SCAMS TO WARN ABOUT, SUGGESTED ACTIONS FOR THE DEVELOPER (3 to 5), and NOT SURE (anything the notes cannot confirm). Never invent facts; say when notes are thin." },
          { role: "user", content: "NOTES:\n" + raw.slice(0, 9000) }], { max: 1100, temp: 0.3, timeout: 40000 });
        if (r) { text = r.text.replace(/\*\*|__|^#+\s*/gm, ""); by = r.by; }
      }
      if (!text) text = (notes.length ? notes.map((n) => n.topic.toUpperCase() + "\n" + n.found.slice(0, 2).map((f) => "- " + clip(f.text, 300)).join("\n")).join("\n\n") : "No online sources could be reached today.") + (heads.length ? "\n\nLATEST HEADLINES\n" + heads.slice(0, 8).map((h) => "- " + h).join("\n") : "");
      const day = new Date().toISOString().slice(0, 10);
      const digest = { id: nanoid(8), t: Date.now(), day, title: "Daily research " + day, text: clip(text, 5000), topics, sources: [...sources].slice(0, 12), by };
      const db = readDB(), { u, lab: lab2 } = labOf(db);
      if (!u) return digest;
      lab2.digests.unshift(digest); lab2.digests = lab2.digests.slice(0, 14);
      // what the bot itself learns from today's research (used in answers later)
      const fresh = notes.map((n) => "Research " + day + " (" + n.topic + "): " + clip(n.found[0].text, 230));
      lab2.learned = [...fresh, ...lab2.learned.filter((x) => !x.startsWith("Research " + day))].slice(0, 40);
      lab2.lastRun = Date.now(); lab2.runs = (lab2.runs || 0) + 1;
      // deliver to the creator's LetsChat AI chat
      chatOf(u).push({ id: nanoid(8), from: "ai", digest: true, text: "Good morning! Here is today's research. 🔎\n\n" + digest.text + (digest.sources.length ? "\n\nSources: " + digest.sources.join(", ") : ""), t: Date.now() });
      if (u.botChat.length > 80) u.botChat = u.botChat.slice(-80);
      writeDB(db);
      return digest;
    } catch (e) { console.error("daily research failed:", e.message); return null; } finally { running = false; }
  }
  let started = false;
  function start() {
    if (started) return; started = true;
    const check = () => { try { const { u, lab } = labOf(readDB()); if (u && Date.now() - (lab.lastRun || 0) >= 23 * 36e5) research(); } catch (e) { console.error("research check failed:", e.message); } };
    const a = setInterval(check, 30 * 60 * 1000), b = setTimeout(check, 90 * 1000);
    if (a.unref) a.unref(); if (b.unref) b.unref();
  }

  // ---------- developer training ----------
  const KINDS = { instruction: "instructions", fact: "facts", topic: "topics" };
  function trainView() {
    const { lab } = labOf(readDB());
    return { llm: KB.llmReady(), providers: (KB.stats().ai || []), instructions: lab.instructions, facts: lab.facts, topics: lab.topics, defaultTopics: DEFAULT_TOPICS, learned: lab.learned, lastRun: lab.lastRun || 0, runs: lab.runs || 0, digests: lab.digests.slice(0, 7).map((d) => ({ id: d.id, t: d.t, title: d.title, text: d.text, sources: d.sources })), running };
  }
  function trainAdd(kind, text) {
    const key = KINDS[kind], t = String(text || "").replace(/\s+/g, " ").trim().slice(0, kind === "topic" ? 120 : 700);
    if (!key || !t) throw new Error("Type something first");
    const db = readDB(), { u, lab } = labOf(db);
    if (!u) throw new Error("Creator account not found");
    if (!lab[key].includes(t)) lab[key].push(t);
    if (lab[key].length > (key === "topics" ? 20 : 120)) lab[key].shift();
    writeDB(db);
  }
  function trainRemove(kind, index) {
    const key = KINDS[kind] || (kind === "learned" ? "learned" : null);
    if (!key) throw new Error("Unknown list");
    const db = readDB(), { u, lab } = labOf(db);
    if (!u) throw new Error("Creator account not found");
    const i = Number(index);
    if (i >= 0 && i < lab[key].length) lab[key].splice(i, 1);
    writeDB(db);
  }
  return { chat, history, clear, research, start, trainView, trainAdd, trainRemove, _reply: reply, _shape: shape };
};
