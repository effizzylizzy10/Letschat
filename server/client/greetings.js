"use strict";
// Greetings for LetsChat: love, friendship, prayer, consoling, birthday, good morning/night, get well, congratulations, thanks, sorry, encouragement.
// 1) the AI writes a fresh, personal message for the category (and the person's name, language and length);
// 2) if every AI engine is down it picks from the built-in bank below, so the feature always works offline from any API.
// Routes: GET /api/greetings/categories, POST /api/greetings/generate. The AI chats also use detect()/notes() so "write a birthday message for Ada" is answered in the right style.

const CATS = [
  { id: "goodmorning", label: "Good morning", emoji: "🌅", brief: "a warm good morning message that starts their day with hope" },
  { id: "goodnight", label: "Good night", emoji: "🌙", brief: "a gentle good night message wishing them peaceful rest" },
  { id: "love", label: "Love", emoji: "❤️", brief: "a sincere, romantic love message that is sweet and not cheesy" },
  { id: "friendship", label: "Friendship", emoji: "🤝", brief: "a warm message to a friend that says how much the friendship means" },
  { id: "prayer", label: "Prayer", emoji: "🙏", brief: "a gentle, hopeful prayer or blessing for them, kind and inclusive, no strict denomination unless the sender asks" },
  { id: "consoling", label: "Consoling", emoji: "🕊️", brief: "a comforting message for someone who is hurting or grieving: gentle, honest, no clichés like 'everything happens for a reason', offers to be there" },
  { id: "encouragement", label: "Encouragement", emoji: "💪", brief: "an uplifting message that gives them strength to keep going" },
  { id: "birthday", label: "Birthday", emoji: "🎂", brief: "a joyful birthday wish with a personal touch" },
  { id: "getwell", label: "Get well", emoji: "🌿", brief: "a caring get-well-soon message for someone who is unwell" },
  { id: "congrats", label: "Congratulations", emoji: "🎉", brief: "an excited congratulations message celebrating their win" },
  { id: "thanks", label: "Thank you", emoji: "🙌", brief: "a heartfelt thank-you message" },
  { id: "sorry", label: "Sorry", emoji: "🥺", brief: "a sincere apology that takes responsibility and asks to make it right" },
  { id: "anniversary", label: "Anniversary", emoji: "💍", brief: "a loving anniversary message celebrating the years together" },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));

// {name}, at the start is dropped (and the next letter capitalised) when no name is given
const BANK = {
  goodmorning: [
    "{name}, good morning! May today open doors you did not expect and bring you good news. ☀️",
    "Good morning, {name}! A new day, a new chance. Go gently, go bravely, and know I am rooting for you. 🌅",
    "{name}, rise and shine! May your day be full of small wins and big smiles.",
    "Good morning! Wishing you peace in your heart and favour in everything you do today. 🌞",
  ],
  goodnight: [
    "{name}, good night. Let go of today, you did enough. Sleep well and wake up refreshed. 🌙",
    "Good night, {name}. May your sleep be deep and your dreams be kind. 🌟",
    "{name}, rest easy tonight. Tomorrow is a fresh page. Sweet dreams!",
    "Good night! Thank you for today. Sleep peacefully, I am thinking of you. 💤",
  ],
  love: [
    "{name}, you are the best part of my day. Every moment with you feels like home. ❤️",
    "I did not know how much I could love someone until you. Thank you for being mine, {name}.",
    "{name}, you make ordinary days feel special. I love you more than words can say. 💕",
    "Whatever tomorrow brings, I want to face it with you, {name}. You are my person. 💖",
  ],
  friendship: [
    "{name}, thank you for being the kind of friend who stays. I am grateful for you every day. 🤝",
    "Life is better with you in it, {name}. Thanks for the laughs, the honesty and the loyalty.",
    "{name}, you have been there through it all. I hope you know I will always be there for you too.",
    "To a true friend: distance or busy days, you are always close to my heart. 💛",
  ],
  prayer: [
    "{name}, I am praying for you today. May you feel peace that surpasses understanding and strength for what lies ahead. 🙏",
    "May God's grace carry you, {name}. May He guide your steps, calm your worries and bless the work of your hands.",
    "Lord, wrap {name} in Your love today. Give wisdom where it is needed, comfort where there is pain, and joy that lasts. Amen.",
    "{name}, you are not alone. I am lifting you up in prayer and asking for good things to find you. 🕊️",
  ],
  consoling: [
    "{name}, I am so sorry for what you are going through. There are no perfect words, but I am here, for a call, a chat or just silence. 🕊️",
    "My heart is with you, {name}. Take all the time you need. You do not have to be strong right now, and you do not have to go through this alone.",
    "{name}, I am thinking of you and holding you in my prayers. Please let me help in any way, even with small things like a meal or a visit.",
    "Grief is the price of love, and your love was real. I am here for you, {name}, today and in the days ahead.",
  ],
  encouragement: [
    "{name}, you are stronger than you think and further along than you feel. Keep going, I believe in you. 💪",
    "Tough days do not last, {name}, but tough people do. One step at a time, you will get there.",
    "{name}, do not give up now. Your breakthrough may be closer than it looks. 🌟",
    "I have seen what you are made of, {name}. This challenge does not stand a chance.",
  ],
  birthday: [
    "Happy birthday, {name}! 🎂 May this new year bring you good health, joy and everything your heart desires.",
    "{name}, happy birthday! Thank you for being you. Wishing you love, laughter and plenty of cake! 🎉",
    "Another year wiser and more blessed, {name}! Happy birthday, may all your wishes come true. 🥳",
    "Happy birthday, {name}! May God bless you with long life, peace and prosperity. 🎁",
  ],
  getwell: [
    "{name}, get well soon! Rest, drink water and take all the time you need to heal. 🌿",
    "Thinking of you, {name}. Wishing you a quick and full recovery. Let me know if you need anything.",
    "{name}, may you feel better with each passing day. I am praying for your speedy recovery. 🙏",
    "Sending you healing thoughts and a big virtual hug, {name}. Get well soon! 🤗",
  ],
  congrats: [
    "Congratulations, {name}! 🎉 You worked hard for this and you deserve every bit of it.",
    "{name}, congratulations! So proud of you. This is only the beginning. 🏆",
    "Well done, {name}! Your hard work paid off. Celebrate big today! 🥳",
    "Huge congratulations, {name}! May this success open even bigger doors for you.",
  ],
  thanks: [
    "{name}, thank you so much. I truly appreciate everything you did for me. 🙌",
    "I am grateful for you, {name}. Your kindness meant more than you know.",
    "{name}, thank you for being there when I needed you. I will not forget it. 💛",
    "Thank you, {name}! You made a real difference. God bless you.",
  ],
  sorry: [
    "{name}, I am sorry. I was wrong and I take responsibility. I value you and want to make it right. 🥺",
    "I am truly sorry for hurting you, {name}. You deserve better from me, and I will do better.",
    "{name}, please forgive me. I did not mean to hurt you, and I am sorry it did. Can we talk?",
    "I owe you an apology, {name}. I am sorry, and I hope we can move forward together.",
  ],
  anniversary: [
    "Happy anniversary, {name}! Thank you for every year, every laugh and every hard day we faced together. 💍",
    "{name}, happy anniversary! I love you more today than the day we started. ❤️",
    "Another year with you, {name}, and I would choose you again every time. Happy anniversary! 🥂",
    "Happy anniversary to my favourite person. Here is to many more years, {name}. 💕",
  ],
};

const norm = (s) => String(s || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function fromBank(cat, name, skip) {
  const list = BANK[cat] || BANK.goodmorning;
  let pick = list[Math.floor(Math.random() * list.length)];
  if (skip && list.length > 1) { let n = 0; while (pick === skip && n++ < 6) pick = list[Math.floor(Math.random() * list.length)]; }
  name = norm(name).slice(0, 40);
  if (name) return pick.replace(/\{name\}/g, name);
  return cap(pick.replace(/\{name\},?\s*/g, ""));
}

const LEN = { short: "1 to 2 short sentences", medium: "2 to 4 sentences", long: "a heartfelt message of 5 to 7 sentences" };
function promptFor(cat, name, length, lang, extra) {
  const c = CAT[cat] || CAT.goodmorning;
  return "Write " + c.brief + (name ? ", for a person called " + name : "") + ". Length: " + (LEN[length] || LEN.medium) + ". "
    + (lang ? "Write it in " + lang + ". " : "Write it in the same language as these instructions unless the sender asked for another. ")
    + (extra ? "Sender's note: " + extra + ". " : "")
    + "Sound like a real person texting someone they care about: natural, warm, specific, not a greeting-card cliché. Use at most 2 emojis. Reply with ONLY the message text, no quotes, no title, no explanation.";
}

// make(KB): returns async generate({ category, name, length, lang, note, avoid }) -> { text, by }
function maker(KB) {
  return async function generate(o) {
    const cat = CAT[o.category] ? o.category : "goodmorning";
    const name = norm(o.name).slice(0, 40);
    const length = LEN[o.length] ? o.length : "medium";
    const lang = norm(o.lang).slice(0, 30);
    const note = norm(o.note).slice(0, 160);
    try {
      if (KB && KB.llmReady && KB.llmReady()) {
        const out = await KB.chat([
          { role: "system", content: "You write short personal messages for people to send to someone they care about. Never include links, phone numbers or requests for money. Plain text only." },
          { role: "user", content: promptFor(cat, name, length, lang, note) },
        ], { max: 500, temp: 0.9, timeout: 15000, budget: 20000 });
        const text = out && out.text ? norm(out.text).replace(/^["“']+|["”']+$/g, "").slice(0, 900) : "";
        if (text.length >= 8 && !/https?:\/\//i.test(text)) return { text, by: out.by || "ai" };
      }
    } catch (e) { /* fall back to the bank */ }
    return { text: fromBank(cat, name, o.avoid), by: "bank" };
  };
}

// ---- the AI chats: is this message asking for a greeting? ----
const ASK = /\b(write|send|give|make|compose|draft|create|need|want|help me with|any|suggest)\b[^.?!]{0,60}\b(message|messages|wish|wishes|greeting|greetings|prayer|poem|text|note|card|caption|condolence|condolences)\b|\b(good morning|good night|happy birthday|happy anniversary|get well|congratulat\w+|condolences?|consol\w+|comfort)\b[^.?!]{0,40}\b(message|wish|text|for|to)\b/i;
const MAP = [
  ["consoling", /\b(condolence|condolences|consol\w+|comfort\w*|grief|grieving|lost (his|her|their|my)|passed away|sympath\w+|sorry for (his|her|your|their) loss|bereave\w*)\b/i],
  ["prayer", /\b(prayer|pray|blessing|bless|scripture)\b/i],
  ["getwell", /\b(get well|recover\w*|sick|unwell|hospital)\b/i],
  ["birthday", /\b(birthday|bday|b-day)\b/i],
  ["anniversary", /\b(anniversary)\b/i],
  ["congrats", /\b(congrat\w*|promotion|graduat\w*|new job|well done)\b/i],
  ["sorry", /\b(sorry|apolog\w+|forgive)\b/i],
  ["thanks", /\b(thank you|thanks|appreciat\w+|gratitude)\b/i],
  ["goodnight", /\b(good ?night|sleep well|sweet dreams)\b/i],
  ["goodmorning", /\b(good ?morning)\b/i],
  ["love", /\b(love|romantic|girlfriend|boyfriend|wife|husband|crush|sweetheart|babe|darling|miss you)\b/i],
  ["friendship", /\b(friend|friendship|bestie|buddy|bro)\b/i],
  ["encouragement", /\b(encourag\w+|motivat\w+|cheer up|inspire|keep going|strength)\b/i],
];
function detect(text) {
  const t = String(text || "");
  if (t.length < 6 || t.length > 400 || !ASK.test(t)) return null;
  const hit = MAP.find(([, re]) => re.test(t));
  if (!hit) return null;
  const m = /\b(?:for|to)\s+(?:my\s+\w+\s+|our\s+\w+\s+|the\s+)?([A-Z][a-zA-Z'-]{1,20})\b/.exec(t);
  return { category: hit[0], name: m ? m[1] : "" };
}
// system-prompt notes: what the person asked for plus two example messages for style
function notes(req) {
  if (!req) return "";
  const c = CAT[req.category];
  return "GREETING REQUEST: the person wants " + c.brief + (req.name ? " for " + req.name : "") + ". Write the message itself, ready to copy and send, in their language, 2 to 4 sentences unless they asked for more or less, at most 2 emojis. Offer one short alternative version only if it helps. Style examples (do not copy them):\n- "
    + fromBank(req.category, req.name || "") + "\n- " + fromBank(req.category, req.name || "");
}

function setup(app, { authMiddleware, KB }) {
  const generate = maker(KB), log = new Map();
  app.get(["/api/greetings/categories", "/api/v1/greetings/categories"], authMiddleware, (req, res) => res.json({ categories: CATS.map(({ id, label, emoji }) => ({ id, label, emoji })), ai: !!(KB && KB.llmReady && KB.llmReady()) }));
  app.post(["/api/greetings/generate", "/api/v1/greetings/generate"], authMiddleware, async (req, res) => {
    const now = Date.now(), arr = (log.get(req.user.id) || []).filter((t) => now - t < 60000);
    if (arr.length >= 15) return res.status(429).json({ error: "Too many requests, wait a moment" });
    arr.push(now); log.set(req.user.id, arr);
    if (log.size > 5000) log.delete(log.keys().next().value);
    const b = req.body || {};
    if (!CAT[b.category]) return res.status(400).json({ error: "Pick a message type" });
    res.json(await generate({ category: b.category, name: b.name, length: b.length, lang: b.lang, note: b.note, avoid: norm(b.avoid) }));
  });
}

module.exports = { setup, detect, notes, fromBank, CATS };
