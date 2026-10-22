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
  "football and world sports: latest results, transfers and predictions",
  "technology and artificial intelligence: latest news and updates",
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

// ---- extra constants: chat skills the bot learns (built-in versions work offline; the online version improves them every few days) ----
const SKILL_TOPICS = [
  "Nigerian Pidgin English: common phrases and how to reply naturally",
  "Yoruba, Igbo and Hausa greetings and everyday phrases",
  "comforting someone who is sad, stressed or heartbroken",
  "handling rude or angry people calmly and respectfully",
  "friendly small talk, banter and light humour with emojis",
  "Nigerian slang and young people's chat slang",
  "helpful customer-care style replies",
  "congratulating and celebrating people",
  "motivating and encouraging people",
  "explaining complex things simply to beginners",
  "polite refusals and setting boundaries",
  "chatting about football and sports like a fan",
  "giving relationship and life advice responsibly",
  "business and sales conversation etiquette in Nigeria",
  "telling short clean jokes and riddles",
];
const BUILTIN_SKILLS = {
  "Nigerian Pidgin English: common phrases and how to reply naturally": "If the user writes Pidgin, reply in light Pidgin: 'How far?' 'I dey fine, you nko?' 'No wahala' (no problem) 'Abeg' (please) 'Wetin dey happen?' (what is happening) 'E don do' (enough) 'I hear you' 'Sharp sharp' (quickly) 'Oga/Madam' (respectful address). Keep it friendly, never mock.",
  "Yoruba, Igbo and Hausa greetings and everyday phrases": "Yoruba: 'Ẹ kú àárọ̀' good morning, 'Ẹ ṣé' thank you. Igbo: 'Ndewo' hello, 'Daalụ' thank you. Hausa: 'Sannu' hello, 'Na gode' thank you, 'Ina kwana' good morning. Greet back in the user's language, then continue in the language they use or in English.",
  "comforting someone who is sad, stressed or heartbroken": "First acknowledge the feeling in one warm line ('I'm sorry, that sounds really hard'). Do not rush to fix. Ask one gentle question. Offer one small practical step only after they feel heard. Encourage talking to someone they trust if it feels heavy.",
  "handling rude or angry people calmly and respectfully": "Stay calm, never insult back. Name their frustration ('I can see this is annoying'). Apologise for the part that was truly your mistake. Ask what outcome they want and move to solving it. If abuse continues, politely say you will gladly help when they are ready.",
  "friendly small talk, banter and light humour with emojis": "Match their energy. Use short messages, a playful remark and at most one or two emojis. Ask a light follow-up question to keep the chat going. Jokes should be kind and never about tribe, religion, looks or tragedy.",
  "Nigerian slang and young people's chat slang": "Common: 'gist' (chat/news), 'jollof' (rice, also arguments), 'japa' (emigrate), 'sapa' (broke), 'wahala' (trouble), 'omo' (wow/child), 'no cap' (honestly), 'Naija no dey carry last'. Use slang lightly and only when the user does, so it never feels forced.",
  "helpful customer-care style replies": "Greet, restate the problem to show you understood, give the answer or the next step clearly, and ask if they need anything else. Be patient and polite, never blame the user.",
  "congratulating and celebrating people": "React with real excitement ('Congratulations! 🎉 That is amazing'), ask how it feels or how it happened, and affirm their effort.",
  "motivating and encouraging people": "Be honest and warm: acknowledge the struggle, remind them of progress made, suggest one small next step, and avoid empty slogans.",
  "explaining complex things simply to beginners": "Start with a one-sentence plain definition, then an everyday example, then the steps. Avoid jargon or explain it at once. Check understanding at the end.",
  "polite refusals and setting boundaries": "Say no kindly and clearly, give a short reason, offer an alternative if possible. Never lecture. Never share or ask for passwords, OTPs, PINs or card details.",
  "chatting about football and sports like a fan": "Show enthusiasm, use current facts from the news notes, give balanced opinions, and ask who they support. Never invent scores or transfers.",
  "giving relationship and life advice responsibly": "Listen first, offer balanced options rather than orders, respect the person's choices and culture, and suggest a counsellor or trusted elder for serious matters.",
  "business and sales conversation etiquette in Nigeria": "Greet warmly ('Good morning ma/sir'), be clear about price, delivery and payment, never pressure, and keep promises. Warn about fake payment alerts and advance-fee scams.",
  "telling short clean jokes and riddles": "Keep jokes short, clean and kind. Example: 'Why did the phone go to school? To get smarter 😄'. Offer another one if they laugh.",
};
// ---- self-study curriculum (v20): the robot studies these subjects by itself, a few a day, and keeps a study note for each ----
// "live" subjects are refreshed every 8 hours (results, form, new AI releases); history subjects are re-checked every 30 days.
const S = (t, live) => ({ t, live: !!live });
const STUDY = {
  sports: { label: "Sports history, records and predictions", items: [
    S("history of football: origins, laws, key eras and tactical revolutions"),
    S("FIFA World Cup history: every tournament, winners, finals, records and legends"),
    S("Africa Cup of Nations history: every winner, records and greatest African players"),
    S("Nigeria Super Eagles history: golden generations, AFCON and World Cup runs, key players and coaches"),
    S("English Premier League history: champions, records, rivalries and iconic seasons"),
    S("UEFA Champions League and European Cup history: winners, legendary finals and records"),
    S("La Liga, Serie A, Bundesliga and Ligue 1 history: champions, great clubs and records"),
    S("African club football history: CAF Champions League, NPFL and African stars in Europe"),
    S("Ballon d'Or history: all winners, debates and records; Messi, Ronaldo and the greats"),
    S("greatest football managers and coaching styles through history"),
    S("NBA history: dynasties, champions, legends and records"),
    S("Olympic Games history and Nigeria's Olympic medals and heroes"),
    S("athletics and sprinting history: world records and legends"),
    S("boxing history: heavyweight champions, great fights and Nigerian boxers"),
    S("tennis history: Grand Slam winners, rivalries and records"),
    S("Formula 1 history: champions, teams, records and great races"),
    S("cricket, rugby and golf majors: history, champions and records in brief"),
    S("how football analysts predict results: form, head-to-head, injuries, home advantage, expected goals and why upsets happen"),
    S("this week's football results, league tables and form: Premier League, Champions League, La Liga, Serie A, Bundesliga", true),
    S("Super Eagles and African football latest: fixtures, squad news, qualifiers and results", true),
    S("NBA, Formula 1, tennis, boxing and athletics latest results and upcoming events", true),
    S("football transfer market latest news and confirmed deals", true),
    S("big football matches coming up in the next few days: form guide, head-to-head and balanced predictions with rough probabilities", true),
  ] },
  tech: { label: "Technology and artificial intelligence", items: [
    S("history of artificial intelligence: from Turing to deep learning to large language models"),
    S("how large language models and chatbots work in plain words, and their limits"),
    S("the main AI companies and model families: OpenAI, Anthropic, Google, Meta, xAI, Mistral, DeepSeek"),
    S("AI tools for everyday work, students, creators and small businesses"),
    S("AI safety, regulation and ethics around the world and in Africa"),
    S("AI chips and hardware: Nvidia, GPUs, TPUs and the semiconductor supply chain"),
    S("history of the internet, the web and mobile phones; how smartphones evolved"),
    S("how operating systems, cloud computing and data centres work"),
    S("programming languages and software development trends, including AI coding tools"),
    S("cybersecurity: common attacks, scams and how people protect themselves"),
    S("fintech and mobile money in Africa: Paystack, Flutterwave, M-Pesa, Opay and others"),
    S("African tech startups and ecosystems: Nigeria, Kenya, South Africa, Egypt, Ghana"),
    S("robotics, drones and automation"),
    S("electric vehicles, batteries and clean energy technology"),
    S("space technology: SpaceX, Starlink, satellites and African space programmes"),
    S("quantum computing, explained honestly"),
    S("blockchain and crypto explained honestly, with the risks and scams"),
    S("open-source AI and how people run AI on their own phones and computers"),
    S("AI in education, health and farming in Africa"),
    S("social media platforms, algorithms and creator economy"),
    S("AR, VR, wearables and gaming technology"),
    S("data privacy laws, including Nigeria's data protection law"),
    S("latest AI model releases, company announcements and research breakthroughs this week", true),
    S("latest technology, gadget and software launches this week", true),
    S("Africa tech and startup funding news this week", true),
    S("latest cybersecurity incidents, data breaches and new scams this week", true),
  ] },
};
const PREDICT = /\b(predict(?:ion|ions|ed)?|forecast|who (?:will|go|wan|is going to|is likely to) win|odds|score prediction|who (?:wins|win)|expected to win)\b/i;
const PIDGIN = /\b(abeg|wetin|how far|na so|dey|wahala|oga|sha|abi|no be|i no|una|sef|wey|comot|chop|naija|gist me|oya)\b/i;
const CHAT_ONLY_CMD = /^\s*(?:please\s+)?(?:learn|research|study|dig(?:\s+deep)?\s+into|find\s+out|source\s+for|keep\s+(?:researching|learning))\s+(?:everything\s+|all\s+|more\s+)?(?:about\s+|on\s+|into\s+)?(.{3,120}?)[.!]?\s*$/i;
const now = () => Date.now();
// research runs 5 times a day at fixed Lagos hours (change with BOT_RESEARCH_HOURS="6,10,14,18,22")
const HOURS = (process.env.BOT_RESEARCH_HOURS || "6,10,14,18,22").split(",").map((x) => parseInt(x, 10)).filter((x) => x >= 0 && x < 24).sort((a, b) => a - b);
const lagosHour = () => new Date(Date.now() + 36e5).getUTCHours();
// the most recent scheduled slot that has already started today, e.g. "2026-10-14#10" ("" before the first slot)
const currentSlot = () => { const h = lagosHour(), past = HOURS.filter((x) => x <= h); return past.length ? new Date(Date.now() + 36e5).toISOString().slice(0, 10) + "#" + past[past.length - 1] : ""; };
const dayStr = () => new Date(Date.now() + 36e5).toISOString().slice(0, 10); // Lagos date
const lagosNow = () => new Date(Date.now() + 36e5).toISOString().replace("T", " ").slice(0, 16) + " (Lagos time)";
const jacc = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };

module.exports = function makeBot({ readDB, writeDB, isCreator, KB, News, Scores, Greet, nanoid }) {
  // ---------- developer training, research reports and learned chat skills (inside the creator's user record, so they survive restarts with Supabase) ----------
  const emptyLab = () => ({ instructions: [], facts: [], topics: [], learned: [], digests: [], reports: {}, skills: {}, study: {}, lastRun: 0, runs: 0, skillsAt: 0 });
  function labOf(db) {
    const u = db.users.find((x) => isCreator(x));
    if (!u) return { u: null, lab: emptyLab() };
    if (!u.botLab) u.botLab = emptyLab();
    for (const k of ["instructions", "facts", "topics", "learned", "digests"]) if (!Array.isArray(u.botLab[k])) u.botLab[k] = [];
    for (const k of ["reports", "skills", "study"]) if (!u.botLab[k] || typeof u.botLab[k] !== "object") u.botLab[k] = {};
    return { u, lab: u.botLab };
  }
  const chatOf = (u) => { if (!Array.isArray(u.botChat)) u.botChat = []; return u.botChat; };
  const tkey = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
  const tokens = (t) => KB.tokens(t);
  const sentences = (txt) => String(txt || "").split(/(?<=[.!?])\s+|\n+/).map((x) => x.replace(/^[-•\s]+/, "").trim()).filter((x) => x.length > 25 && x.length < 400);
  // what the robot knows from the creator's notes, its own research reports and its daily learning
  const knowledgeOf = (lab, question) => {
    const rep = Object.values(lab.reports).flatMap((r) => sentences(r.text).slice(0, 40).map((x) => "[" + r.topic + "] " + x));
    const study = Object.values(lab.study || {}).flatMap((r) => sentences(r.text).slice(0, 45).map((x) => "[" + clip(r.topic, 50) + "] " + x));
    return KB.topFacts(question, [...lab.facts, ...lab.learned, ...rep, ...study], 7);
  };

  // ---------- chat skills ----------
  function skillsFor(lab, text, emotion) {
    const t = String(text || "").toLowerCase();
    const want = [];
    if (PIDGIN.test(t)) want.push("Nigerian Pidgin");
    if (/\b(ẹ kú|ndewo|sannu|daal|na gode|ẹ ṣé|ina kwana|bawo)\b/i.test(t)) want.push("Yoruba, Igbo");
    if (emotion === "sad") want.push("comforting");
    if (emotion === "angry") want.push("rude or angry");
    if (emotion === "happy") want.push("congratulating");
    if (emotion === "grateful") want.push("friendly small talk");
    if (/\b(football|chelsea|arsenal|liverpool|match|league|super eagles|goal)\b/.test(t)) want.push("football");
    if (/\b(joke|funny|riddle|make me laugh)\b/.test(t)) want.push("jokes");
    if (/\b(relationship|girlfriend|boyfriend|marriage|crush|dating)\b/.test(t)) want.push("relationship");
    if (/\b(price|sell|buy|customer|order|delivery|business)\b/.test(t)) want.push("business", "customer-care");
    if (/\b(explain|what is|how does|teach|learn)\b/.test(t)) want.push("explaining complex");
    if (/\b(slang|gist|wetin|wahala|japa|sapa)\b/.test(t)) want.push("slang");
    if (!want.length) want.push("small talk");
    const out = [];
    for (const topic of SKILL_TOPICS) {
      if (!want.some((w) => topic.toLowerCase().includes(w.toLowerCase()))) continue;
      const learned = lab.skills[tkey(topic)];
      out.push(topic + ": " + (learned && learned.text ? learned.text : BUILTIN_SKILLS[topic] || ""));
      if (out.length >= 2) break;
    }
    return out;
  }

  // ---------- a reply ----------
  function system(lab, emotion, skills, pidgin) {
    return "You are LetsChat AI, the built-in AI assistant of Letschat Africa, a chat app used across Africa (mostly Nigeria), built by the developer Abdullahi Salawu. Right now it is " + lagosNow() + ". " +
      "CAPABILITY: you are a full-power text AI, as capable as the best AI assistants. You can answer any question, explain and teach, write and edit (messages, emails, posts, captions, essays, stories, poems, speeches, business plans), summarise, translate, solve maths and logic, write, explain and debug code, analyse and compare products, plan, brainstorm, give advice, role-play and simply chat. Never say you cannot do something that text can do. Do the task fully. " +
      "ACCURACY: do research for every factual question. Use the NEWS NOTES, WEB NOTES, APP INFO and FACTS below and any search you can run. Anything that changes with time (news, scores, prices, who holds an office, dates, exchange rates) must come from those notes or a search result, never from memory. If you could not confirm something, say so plainly and say what you did find. Never invent facts, numbers, quotes, links or sources. The NEWS NOTES and WEB NOTES (when present) were researched just now for this exact question: build the answer from them, compare the sources, and if they disagree, look thin or look outdated say so instead of guessing. Lead with the direct answer, then the key details. Medical, legal and money decisions: give solid general information and recommend a qualified professional for the decision. " +
      "STYLE: sound like a real, warm person: natural words, contractions, feelings that fit (happy for good news, caring when someone is sad, patient when confused, calm when someone is rude). Use emojis only where they fit (one or two at most, often none). Match the user's language and style" + (pidgin ? " (the user writes Nigerian Pidgin, so answer in friendly Pidgin)" : " (English, Pidgin, Hausa, Yoruba, Igbo, French...)") + ". Casual chat: short messages. A real question or task: give a complete, well organised answer of whatever length it needs (plain numbered steps or dashes are fine). " +
      "RESPECT: treat everybody with respect; never insult, mock or judge; stay calm and kind with rude people and politely set a boundary. " +
      "TEACHING, PRODUCTS, MONEY: when teaching a skill give a clear step-by-step path with a first small task. For a product say what it is, who it suits, honest pros and cons and cheaper alternatives, no hype. For making money give legitimate, realistic options with steps, effort and risks, never guaranteed income, and warn about scams (double-your-money, Ponzi, fake investments, advance-fee fraud). Never ask for or accept passwords, OTPs, PINs or card details. " +
      "LIVE SCORES: when a LIVE SCORES block is present, it is the freshest data (fetched seconds ago). Report scores, live minute, full-time results, upcoming kick-offs and tables from it exactly, say when the data was fetched, and never contradict it from memory. If the team or match asked about is not in it, say you could not confirm it. " +
      "NEWS: for news, gist, gossip, trending, crime or sports questions use the NEWS NOTES: name the story, the source and how recent it is, give a short summary, and add the link when it helps. Treat reports as reports, not proven facts; for crime, scandal and tragedy be factual and respectful, no gloating, no graphic detail, and never accuse a named person beyond what the sources say. " +
      "SPORTS AND TECH: you have studied sports history (football, NBA, athletics, boxing, F1, tennis, Olympics, Nigeria and Africa) and technology and AI; use the FACTS and NEWS NOTES, give dates and names, and say when you are unsure or when something may have changed. PREDICTIONS: when asked who will win or what will happen, reason from form, head-to-head, injuries, home advantage and the notes, give a lean with rough probabilities (for example 50 percent home win, 25 percent draw, 25 percent away win), say plainly that nobody can know, that upsets are common, and never present a prediction as a sure thing or encourage betting or stakes. " +
      "LINKS: only include a URL that appears in the notes below; write it plainly, no markdown. " +
      "FORMAT: plain text only, no markdown symbols (no **, #, backticks except for code the user asked for). For casual chat you may send two or three short separate messages with a blank line between them. " +
      "REACTION: if the user's last message deserves an emoji reaction (thanks, good news, a joke, kind words, sadness) begin with a first line like [react:🙏]; otherwise leave it out. " +
      (emotion ? "The user's last message seems " + emotion + ". " : "") +
      (skills.length ? "CHAT SKILLS you have learned (use what fits): " + skills.join(" || ") + " " : "") +
      (lab.instructions.length ? "DEVELOPER INSTRUCTIONS (always follow): " + lab.instructions.slice(0, 25).join(" | ") : "");
  }

  function shape(raw, allowed) {
    let t = String(raw || "").replace(/\r/g, "").trim(), react = "";
    const m = /^\s*\[react:\s*([^\]\s]{1,8})\s*\]\s*/i.exec(t);
    if (m) { react = m[1]; t = t.slice(m[0].length); }
    t = t.replace(/^\s*(ai|letschat ai|assistant)\s*:\s*/i, "").replace(/\*\*|__/g, "").replace(/^#+\s*/gm, "").replace(/^\s*[*•]\s+/gm, "- ").replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 $2");
    t = t.replace(/https?:\/\/[^\s)>"']+/g, (u) => { const c = u.replace(/[.,;!?]+$/, ""); return allowed.some((a) => c.startsWith(a) || a.startsWith(c)) ? u : ""; }).replace(/[ \t]+\n/g, "\n").trim();
    let parts;
    if (t.length > 450 || /```/.test(t)) parts = [clip(t, 6000)];            // a real answer stays in one message
    else { parts = t.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean); if (parts.length > 3) parts = [parts[0], parts[1], parts.slice(2).join("\n")]; }
    return { parts, react };
  }
  const clipLong = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n) : s; };

  function offline(text, emotion, app, mine, web, newsItems, liveScores) {
    const t = text.trim(), pid = PIDGIN.test(t);
    // no AI engine answered: live scores and greeting requests still work from the data and the built-in message bank
    if (liveScores) return ["Here are the latest scores I found:", liveScores.replace(/^LIVE SCORES \([^)]*\):\n?/, "")];
    try { const g = Greet && Greet.detect(t); if (g) return [Greet.fromBank(g.category, g.name)]; } catch (e) { /* carry on */ }
    if (/^(hi+|hello+|hey+|yo|sup|wassup|what'?s up|good (morning|afternoon|evening))\b/i.test(t) && t.length < 40)
      return [pid ? pick(["Hey! How far? 👋", "Oga/Madam, good to see you! Wetin I fit do for you today?"]) : pick(["Hey! 👋 Good to see you. How can I help today?", "Hello there! 😊 What's on your mind?", "Hi! Nice to hear from you. What can I help you with?"])];
    if (pid && t.length < 40 && /\b(how far|how you dey|wetin dey|wetin dey happen|oga|abeg)\b/i.test(t) && !/\?.{12,}/.test(t)) return [pick(["I dey fine o! 😄 You nko? Wetin I fit do for you?", "No wahala, I dey here! Wetin dey sup? 👋"])];
    if (/^(how are you|how are u|how far|how you dey)\b/i.test(t)) return [pid ? "I dey fine o! 😄 You nko? Wetin dey happen?" : pick(["I'm doing great, thanks for asking! 😊 How are you?", "Doing well o! How about you? What can I do for you today?"])];
    if (/^(who are you|what are you|your name)\b/i.test(t) || /\bwho (made|built|created) you\b/i.test(t)) return ["I'm LetsChat AI, the assistant inside Letschat Africa. 🤖 The developer Abdullahi Salawu built the app.", "I can answer questions, explain how the app works, share Nigerian news and football updates, teach skills and give honest ideas on making money. What would you like to start with?"];
    if (/\b(joke|make me laugh|funny)\b/i.test(t)) return [pick(["Why did the phone go to school? To get smarter 😄", "Why was the computer cold? It left its Windows open! 😂", "I told my phone I needed space, so it opened a new tab. 😄"]), "Want another one?"];
    if (/^(thanks?|thank you|thx)\b/i.test(t) || (emotion === "grateful" && t.length < 50)) return [pick(["You're most welcome! 😊 Anything else I can help with?", "Anytime! I'm glad that helped. 🙏", "My pleasure! Just ask if you need more."])];
    if (/^(bye|goodbye|see you|good night)\b/i.test(t)) return [pick(["Take care! 👋 Come back anytime.", "Bye for now! Have a lovely day. 😊"])];
    if (/\b(good night|sleep well)\b/i.test(t)) return ["Good night! 🌙 Sleep well and see you tomorrow."];
    if (/\b(i love you|love you)\b/i.test(t)) return ["Aww, that's kind of you! 😊 I'm an AI so I can't love you back the way a person would, but I'm always happy to chat with you."];
    if (/\b(are you (a )?(human|real|robot|bot))\b/i.test(t)) return ["I'm an AI assistant, not a human. 🤖 But I try to chat like a friend and I'll always be honest about that."];
    if (/\b(what can you do|help me|your features)\b/i.test(t) && t.length < 60) return ["I can answer questions, explain how Letschat works, share Nigerian news, gist, gossip and football, teach you skills, explain products and suggest honest ways to make money. 😊", "Just ask me anything!"];
    if (ABUSE.test(t) || emotion === "angry") return [pid ? "I hear you o, and I'm sorry if I vex you. 🙏" : "I hear that you're frustrated, and I'm sorry if I let you down. 🙏", "Tell me what you need and I'll do my best to help, calmly and respectfully."];
    if (emotion === "sad") return ["I'm really sorry you're going through this. 🤗 You don't have to carry it alone.", "Do you want to tell me a bit more about what happened? I'm listening. If it feels heavy, please talk to someone you trust too."];
    if (emotion === "happy") return [pick(["That's wonderful news! 🎉 I'm so happy for you.", "Congratulations! 🎉 You deserve it. Tell me more!"])];
    if (newsItems && newsItems.length) return ["Here's what I found just now:", newsItems.slice(0, 5).map((x, i) => (i + 1) + ". " + x.title + " (" + x.src + (x.time ? ", " + News.when(x.time) : "") + ")" + (x.link ? "\n" + x.link : "")).join("\n")];
    if (app.length) return [app[0], app[1] ? app[1] : "Does that help, or should I explain it step by step?"].filter(Boolean);
    if (mine.length) return [clip(mine[0], 500), mine[1] ? clip(mine[1], 300) : "Want me to explain more?"];
    if (web && web.text) return [pick(["Good question. Here's what I found: ", "Sure, here's what I found: ", "Okay, so "]) + web.text, "I'm not 100% sure this covers everything, so tell me if you want me to look deeper."];
    if (MONEY.test(t)) return ["Great question, and I'll be honest with you: there's no magic trick, but there are real ways. 💡",
      "Ideas that work for many people: freelancing a skill (writing, design, video editing, social media management), selling products people already buy (food, fashion, phone accessories), offering a local service, tutoring, or building an online audience and earning from it.",
      "Tell me what skills you have and how much time and money you can start with, and I'll suggest a simple plan. And run from anything that promises to double your money. 🚫"];
    if (LEARN.test(t)) return ["I'd love to teach you! 😊 Which skill do you want to learn?", "Tell me your current level (beginner or not) and how much time you have each day, and I'll give you a simple step-by-step plan with a first small task."];
    return [pick(["I want to give you a good answer, so can you tell me a little more about what you need? 😊", "Hmm, I'm not fully sure I got that. Could you say it in a different way?"]), "I can help with using Letschat, general questions, Nigerian news and football, learning skills, products and ways to make money."];
  }

  // a weak model sometimes just repeats the question: refuse that and ask the next AI
  const echoGuard = (user, text) => {
    const recent = chatOf(user).filter((m) => m.from === "me").slice(-6).map((m) => tokens(m.text)).concat([tokens(text)]);
    return (out) => { const o = tokens(out); return out.trim().length > 1 && !recent.some((r) => r.length && jacc(o, r) > 0.7); };
  };

  // ---------- research for every question, immediately ----------
  const NO_RESEARCH = /^\s*(write|draft|compose|rewrite|translate|proofread|fix|debug|code|generate|create|make me|summari[sz]e|paraphrase)\b/i;
  function needsResearch(t) {
    t = String(t || "").trim();
    if (t.length < 6 || (CHITCHAT.test(t) && t.length < 40) || SHARING_SECRET.test(t) || NO_RESEARCH.test(t)) return false;
    return true; // v24: every real question (anything that is not chit-chat, a secret, or a pure writing/code task) is researched live
  }
  // asks every free source at once (weather, rates, dictionary, Wikipedia, DuckDuckGo and, for time-sensitive questions, news) so the AI answers from fresh, cross-checked notes
  async function researchNow(t) {
    const q = KB.scrub(t) || String(t), R = { web: [], news: [], sources: [] };
    const newsy = true; // v24: always add fresh news + a "latest" search, so answers use the newest information
    const qs = newsy ? [q, "latest " + q] : [q];
    const addSrc = (x) => { if (x && !R.sources.includes(x)) R.sources.push(x); };
    await Promise.all([
      ...qs.map(async (x) => { const rs = await withTimeout(KB.lookupAll(x).catch(() => []), 8000); for (const r of rs || []) if (r && r.text && !R.web.some((w) => w.text === r.text)) { R.web.push(r); (r.sources || []).forEach(addSrc); } }),
      ...(newsy ? qs.map(async (x) => { const n = await withTimeout(News.search(x, 6).catch(() => []), 8000); for (const it of n || []) if (!R.news.some((y) => y.title === it.title)) { R.news.push(it); addSrc(it.src); } }) : []),
    ]);
    R.web = R.web.slice(0, 4); R.news = R.news.slice(0, 8);
    return R;
  }

  async function reply(db, user, text, opts) {
    const t = String(text || "").trim().slice(0, 8000);
    const { lab } = labOf(db);
    const emotion = detectEmotion(t), pidgin = PIDGIN.test(t);
    let react = reactionFor(t);
    if (SHARING_SECRET.test(t)) return { parts: ["Please be careful, 🙏 don't share passwords, PINs, OTPs, card or account numbers with anyone, not even me.", "I can't use them and nobody on Letschat should ask you for them. How else can I help?"], react: "" };
    // the creator can tell it to learn a topic: it researches it broadly now and keeps itself updated every day
    const cmd = opts && opts.creator && CHAT_ONLY_CMD.exec(t);
    if (cmd && !/\b(you|your|yourself)\b/i.test(cmd[1])) {
      const topic = cmd[1].replace(/\s+/g, " ").trim();
      try { trainAdd("topic", topic); } catch (e) { /* no creator record: still research it once */ researchTopic(topic); }
      return { parts: ["On it! 🔎 I'm researching \"" + topic + "\" broadly now: the basics, the latest news, key facts, opportunities and risks.", "I'll send you a full report here in a few minutes, and I'll keep updating myself on it every day and tell you what changes."], react: "👍" };
    }
    const app = appMatches(t, 3), mine = knowledgeOf(lab, t), skills = skillsFor(lab, t, emotion);
    let cachedHit = null;
    { // a question it already answered well before (and nobody has marked wrong) is kept as a fallback for when every AI engine and online source fails
      const a0 = autoOf(lab);
      if (a0.on && a0.inApp && !(opts && opts.creator && CHAT_ONLY_CMD.test(t)) && !CHITCHAT.test(t) && KB.isQuestion(t) && !TIME_SENSITIVE.test(t) && !PERSONAL.test(t) && learnable(t)) {
        const hit = qaFind(a0, t);
        if (hit && hit.n >= 2) cachedHit = hit; // only a fallback now: every real question is researched fresh first
      }
    }
    const researchP = (!app.length && needsResearch(t)) ? researchNow(t) : Promise.resolve(null); // research starts immediately, in parallel
    const scoreReq = Scores ? Scores.detect(t) : null; // score / fixture / table question: fetch live data now
    const scoresP = scoreReq ? withTimeout(Scores.notes(scoreReq).catch(() => ""), 7000) : Promise.resolve("");
    const cats = News.detect(t);
    const wantsPredict = PREDICT.test(t) && /\b(match|game|league|cup|final|fixture|vs|versus|win|team|club|football|nba|f1|fight|season|title)\b/i.test(t);
    if (wantsPredict && !cats.includes("sports")) cats.push("sports");
    let newsItems = [], web = null;
    const chitchat = CHITCHAT.test(t) && t.length < 40;
    if (cats.length) { const lists = await Promise.all(cats.map((c) => News.top(c, 6))); const seen = new Set(); newsItems = lists.flat().filter((x) => !seen.has(x.title) && seen.add(x.title)).slice(0, 10); }
    else if (!chitchat && KB.isQuestion(t) && /\b(who|what happened|why did|is it true|latest|today|yesterday|this week|just|arrested|died|dead|won|lost|score|price of)\b/i.test(t)) newsItems = await News.search(t, 5).catch(() => []);
    if (wantsPredict) { const extra = await News.search(t.replace(/\b(predict(ion|ions)?|forecast|who (will|go|wan) win|odds)\b/gi, " "), 5).catch(() => []); const seen2 = new Set(newsItems.map((x) => x.title)); newsItems = [...newsItems, ...extra.filter((x) => !seen2.has(x.title))].slice(0, 12); }
    const liveScores = (await scoresP) || "";
    let greetNote = ""; try { greetNote = Greet ? Greet.notes(Greet.detect(t)) : ""; } catch (e) { /* optional */ }
    const R = await researchP;
    if (R) {
      const seenN = new Set(newsItems.map((x) => x.title));
      newsItems = [...newsItems, ...R.news.filter((x) => !seenN.has(x.title))].slice(0, 12);
      if (R.web.length) web = { text: R.web.map((w) => w.text).join(" || "), sources: [...new Set(R.web.flatMap((w) => w.sources || []))].filter(Boolean) };
    }
    const ctxBase = (app.length ? "APP INFO:\n- " + app.join("\n- ") + "\n" : "") + (mine.length ? "FACTS FROM THE DEVELOPER, DAILY RESEARCH AND REPORTS:\n- " + mine.join("\n- ") + "\n" : "") + (greetNote ? greetNote + "\n" : "") + (liveScores ? liveScores + "\n" : "") + (newsItems.length ? "NEWS NOTES (" + (cats.length ? cats.map((c) => News.labels()[c]).join(", ") : "search results") + "):\n" + News.notes(newsItems) + "\n" : "") + (web ? "WEB NOTES (" + (web.sources || []).join(", ") + ") researched just now for this question: " + web.text + "\n" : "") + (APP_URL() ? "APP LINK: " + APP_URL() + "\n" : "");
    const hist = chatOf(user).slice(-14).filter((m) => !m.digest && m.text).filter((m, i, a) => m.from === "me" || !a.some((x) => x.from === "me" && jacc(tokens(x.text), tokens(m.text)) > 0.7)).map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: String(m.text).slice(0, 700) }));
    const myHint = meHint(user); if (myHint) skills.push(myHint);
    const accept = echoGuard(user, t);
    let parts = null, by = "", sources = [];
    const finish = (r, ctx) => {
      const allowed = [...urlsIn(ctx), ...urlsIn(lab.facts.join(" ")), ...urlsIn(lab.learned.join(" "))];
      const s = shape(r.text, allowed);
      if (!s.parts.length) return false;
      parts = s.parts; if (s.react) react = s.react; by = r.by; sources = r.links || [];
      return true;
    };
    if (KB.llmReady() && !chitchat) {
      // 1) real Gemini with Google Search: it researches the question itself
      const gMsgs = [{ role: "system", content: system(lab, emotion, skills, pidgin) + "\n\n" + (ctxBase || "(no extra notes; search the web yourself)") }, ...hist, { role: "user", content: t }];
      const g = await KB.geminiSearch(gMsgs, { max: 8000, temp: 0.6, timeout: 28000, accept });
      if (g) finish(g, ctxBase);
      if (g && sources.length && parts.length) { const names = [...new Set(sources.map((x) => x.title).filter(Boolean))].slice(0, 3); if (names.length && !/\bsources?:/i.test(parts[parts.length - 1])) parts[parts.length - 1] += "\n\nSources: " + names.join(", "); }
    }
    if (!parts && KB.llmReady()) {
      // 2) the other AIs in order (Gemini, Groq, ...) with notes gathered from the free online sources
      let ctx = ctxBase;
      if (!web && !chitchat && !app.length) { try { web = await withTimeout(KB.lookup(t), 9000); } catch (e) { web = null; } if (web) ctx += "WEB NOTES (" + (web.sources || []).join(", ") + "): " + web.text + "\n"; }
      const messages = [{ role: "system", content: system(lab, emotion, skills, pidgin) + "\n\n" + (ctx || "(no notes for this message)") }, ...hist, { role: "user", content: KB.scrub(t) || t }];
      const r = await KB.chat(messages, { max: 8000, temp: 0.6, timeout: 25000, budget: 70000, accept });
      if (r) finish(r, ctx);
    }
    if (parts && R && !/\bsources?:/i.test(parts.join("\n"))) { const names = R.sources.filter(Boolean).slice(0, 3); if (names.length) parts[parts.length - 1] += "\n\nSources: " + names.join(", "); }
    let fromCache = false;
    if (!parts && cachedHit && !web && !newsItems.length) { parts = [cachedHit.a]; fromCache = true; }
    if (!parts) {
      if (!web && !chitchat && !app.length && !newsItems.length && wantsWeb(t)) { try { web = await Promise.race([KB.lookup(t), new Promise((r) => setTimeout(() => r(null), 8000))]); } catch (e) { web = null; } }
      parts = offline(t, emotion, app, mine, web, newsItems, liveScores);
      if (web && web.sources && web.sources.length) parts[parts.length - 1] += "\n(Source: " + web.sources.join(", ") + ")";
    }
    return { parts: parts.map((p) => clipLong(p, 6000)), react: react || "", by, ...(fromCache ? { cached: true } : {}) };
  }
  const wantsWeb = (t) => !CHITCHAT.test(t.trim()) && (KB.isQuestion(t) || t.length > 30) && !SHARING_SECRET.test(t);
  function appMatches(text, n) {
    const qt = tokens(text);
    return APP_FACTS.map((f) => ({ f, s: tokens(f).filter((w) => qt.includes(w)).length })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, n || 3).map((x) => x.f);
  }

  // one user message in, saved history out
  async function chat(userId, text) {
    const db0 = readDB(), u0 = db0.users.find((x) => x.id === userId);
    if (!u0) throw new Error("Not found");
    const out = await reply(db0, u0, text, { creator: isCreator(u0) });
    const db = readDB(), u = db.users.find((x) => x.id === userId) || u0, h = chatOf(u), t0 = now();
    h.push({ id: nanoid(8), from: "me", text: String(text).trim().slice(0, 8000), t: t0, ...(out.react ? { reaction: out.react } : {}) });
    out.parts.forEach((p, i) => h.push({ id: nanoid(8), from: "ai", text: p, t: t0 + i + 1 }));
    if (h.length > 80) u.botChat = h.slice(-80);
    try { observe(db, u, String(text).trim(), out); } catch (e) { console.error("observe failed:", e.message); }
    writeDB(db);
    return out;
  }
  const history = (userId) => { const u = readDB().users.find((x) => x.id === userId); return u ? chatOf(u).slice(-60) : []; };
  const clear = (userId) => { const db = readDB(), u = db.users.find((x) => x.id === userId); if (u) { u.botChat = []; writeDB(db); } };
  function deliver(text) { // post a message from the robot into the creator's AI chat
    const db = readDB(), { u } = labOf(db);
    if (!u) return false;
    chatOf(u).push({ id: nanoid(8), from: "ai", digest: true, text: clipLong(text, 6000), t: now() });
    if (u.botChat.length > 80) u.botChat = u.botChat.slice(-80);
    writeDB(db); return true;
  }


  // ---------- auto-learning (v18): online, in-app and offline ----------
  // ONLINE : every 30 min it studies what people asked and could not get an answer to, and researches questions many people ask.
  // IN-APP : it learns from each person's OWN chat with the robot (style, language, interests) and from 👍/👎. Private chats between people are never read here.
  // OFFLINE: phones download a small "knowledge pack" and answer from it with no internet; questions asked offline are sent back when the phone reconnects.
  // Everything is scrubbed first: no links, emails, numbers, passwords, money talk or names are learned. Nothing is "trained into" a model; it is saved notes and answers.
  const AUTO_DEFAULT = { on: true, online: true, inApp: true, offline: true };
  const TIME_SENSITIVE = /\b(predict\w*|forecast|who will win|today|tonight|now|latest|current|currently|news|score|scores|price|prices|rate|rates|weather|yesterday|tomorrow|this (week|month|year)|live|breaking|trending|who is the (president|governor|ceo)|exchange)\b/i;
  const PERSONAL = /\b(my|mine|me|myself|i am|i'm|im|we|our|us)\b/i;
  function autoOf(lab) {
    if (!lab.auto || typeof lab.auto !== "object") lab.auto = {};
    const a = lab.auto;
    for (const k of Object.keys(AUTO_DEFAULT)) if (typeof a[k] !== "boolean") a[k] = AUTO_DEFAULT[k];
    if (!a.counts || typeof a.counts !== "object") a.counts = {};
    for (const k of ["gaps", "qa", "topicsAuto"]) if (!Array.isArray(a[k])) a[k] = [];
    if (!a.stats || typeof a.stats !== "object") a.stats = { ticks: 0, gapsLearned: 0, promoted: 0, qaHits: 0, up: 0, down: 0, synced: 0, lastTick: 0, promotedDay: "", promotedToday: 0 };
    return a;
  }
  const learnable = (t) => {
    t = String(t || "").trim();
    if (t.length < 8 || t.length > 200) return false;
    if (SHARING_SECRET.test(t) || ABUSE.test(t)) return false;
    if (/https?:\/\/|www\.|\S+@\S+\.\S+|\d{6,}/i.test(t)) return false;
    if (/\b(password|passcode|otp|pin|cvv|bvn|nin|card|account number|secret|token|seed phrase)\b/i.test(t)) return false;
    return true;
  };
  const qaAnswerOk = (a) => a && a.length > 20 && !/https?:\/\/|@\S+\.\S+|\d{8,}/i.test(a) && !/\b(i could not|i can't|i cannot|not sure|i don't know|sorry)\b/i.test(a);
  const qaFind = (a, q) => {
    const qt = tokens(q); if (qt.length < 2) return null;
    let best = null, bs = 0;
    for (const e of a.qa) { const s = jacc(qt, tokens(e.q)); if (s > bs) { bs = s; best = e; } }
    return best && bs >= 0.72 ? best : null;
  };
  // the robot's own memory of the person it is chatting with (stored in that person's record, shown to them, erasable)
  const meOf = (u) => { if (!u.botMe || typeof u.botMe !== "object") u.botMe = { on: true, n: 0, pidgin: 0, short: 0, emoji: 0, topics: {} }; if (!u.botMe.topics) u.botMe.topics = {}; return u.botMe; };
  function learnMe(u, text) {
    const me = meOf(u); if (me.on === false) return;
    me.n++; if (PIDGIN.test(text)) me.pidgin++; if (text.length < 40) me.short++; if (/\p{Extended_Pictographic}/u.test(text)) me.emoji++;
    if (learnable(text)) { const tk = tokens(text).filter((w) => w.length > 4).slice(0, 3); for (const w of tk) me.topics[w] = (me.topics[w] || 0) + 1; }
    const keys = Object.keys(me.topics); if (keys.length > 40) for (const k of keys.sort((x, y) => me.topics[x] - me.topics[y]).slice(0, keys.length - 40)) delete me.topics[k];
  }
  const meSummary = (u) => { const me = meOf(u), n = Math.max(me.n, 1); return { on: me.on !== false, messages: me.n, pidgin: me.n >= 3 && me.pidgin / n > 0.3, shortStyle: me.n >= 3 && me.short / n > 0.6, emojis: me.n >= 3 && me.emoji / n > 0.3, topics: Object.entries(me.topics).filter(([, c]) => c >= 2).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([w]) => w) }; };
  const meHint = (u) => { const m = meSummary(u); if (!m.on || m.messages < 3) return ""; const bits = []; if (m.pidgin) bits.push("this person often writes Nigerian Pidgin, so reply in light Pidgin"); if (m.shortStyle) bits.push("they like short messages"); if (m.emojis) bits.push("they enjoy emojis"); if (m.topics.length) bits.push("topics they care about: " + m.topics.join(", ")); return bits.length ? "WHAT YOU LEARNED ABOUT THIS PERSON FROM THEIR OWN CHATS WITH YOU (use gently, never mention it): " + bits.join("; ") + ". " : ""; };
  // called after every robot chat turn
  function observe(db, u, text, out) {
    const { lab } = labOf(db), a = autoOf(lab);
    if (!a.on || !a.inApp) return;
    learnMe(u, text);
    if (!learnable(text) || CHITCHAT.test(text.trim()) || !KB.isQuestion(text)) return;
    const k = tkey(text); if (!k) return;
    a.counts[k] = a.counts[k] ? { ...a.counts[k], n: a.counts[k].n + 1, t: now() } : { q: clip(text, 160), n: 1, t: now() };
    const ck = Object.keys(a.counts); if (ck.length > 300) for (const x of ck.sort((p, q) => a.counts[p].t - a.counts[q].t).slice(0, ck.length - 300)) delete a.counts[x];
    const fell = !out.by && !out.cached;
    if (fell && !a.gaps.some((g) => g.k === k)) { a.gaps.push({ k, q: clip(text, 160), t: now() }); if (a.gaps.length > 40) a.gaps.shift(); }
    const joined = out.parts.join("\n");
    if (out.by && !out.cached && !TIME_SENSITIVE.test(text) && !PERSONAL.test(text) && qaAnswerOk(joined) && !qaFind(a, text)) {
      a.qa.push({ k, q: clip(text, 160), a: clip(joined, 500), n: 1, t: now(), by: out.by });
      if (a.qa.length > 150) a.qa.sort((p, q) => (q.n - p.n) || (q.t - p.t)), a.qa.length = 120;
    }
  }
  function feedback(userId, q, ans, up) {
    const db = readDB(), { lab } = labOf(db), a = autoOf(lab);
    if (!a.on || !a.inApp) return false;
    q = String(q || "").slice(0, 200); ans = String(ans || "").slice(0, 600);
    if (!learnable(q)) return false;
    const k = tkey(q), e = a.qa.find((x) => x.k === k) || qaFind(a, q);
    if (up) {
      a.stats.up++;
      if (e) e.n += 2;
      else if (!TIME_SENSITIVE.test(q) && !PERSONAL.test(q) && qaAnswerOk(ans)) a.qa.push({ k, q: clip(q, 160), a: clip(ans, 500), n: 2, t: now(), by: "liked" });
    } else {
      a.stats.down++;
      if (e) a.qa.splice(a.qa.indexOf(e), 1);
      if (!a.gaps.some((g) => g.k === k)) a.gaps.push({ k, q: clip(q, 160), t: now(), bad: true });
      if (a.gaps.length > 40) a.gaps.shift();
    }
    writeDB(db); return true;
  }
  // one pass of online learning (also run by the creator's "Run auto-learn now")
  let ticking = false;
  async function autoTick() {
    if (ticking) return null; ticking = true;
    try {
      const db0 = readDB(), { u, lab } = labOf(db0); if (!u) return null;
      const a0 = autoOf(lab); if (!a0.on || !a0.online) return null;
      // 1) questions the robot could not answer: look them up on free online sources and keep what it finds
      const gaps = a0.gaps.slice(0, 3), done = [];
      for (const g of gaps) {
        const [w, n] = await Promise.all([withTimeout(KB.lookup(g.q).catch(() => null), 10000), withTimeout(News.search(g.q, 2).catch(() => []), 10000)]);
        const bits = []; if (w && w.text) bits.push(clip(w.text, 230)); (n || []).slice(0, 1).forEach((x) => bits.push(x.title + " (" + x.src + ")"));
        done.push({ g, text: bits.join(" | ") });
      }
      // 2) questions many people asked: research them properly (at most 2 a day, with AI if a key is set)
      const db1 = readDB(), { lab: lab1 } = labOf(db1), a1 = autoOf(lab1);
      if (a1.stats.promotedDay !== dayStr()) { a1.stats.promotedDay = dayStr(); a1.stats.promotedToday = 0; }
      const hot = Object.values(a1.counts).filter((c) => c.n >= 3 && !TIME_SENSITIVE.test(c.q) && !a1.topicsAuto.some((x) => tkey(x) === tkey(c.q))).sort((x, y) => y.n - x.n)[0];
      let promote = null;
      if (hot && a1.stats.promotedToday < 2 && KB.llmReady()) { promote = hot.q; a1.topicsAuto.push(promote); if (a1.topicsAuto.length > 15) a1.topicsAuto.shift(); a1.stats.promotedToday++; a1.stats.promoted++; }
      for (const d of done) {
        const gi = a1.gaps.findIndex((x) => x.k === d.g.k); if (gi >= 0) a1.gaps.splice(gi, 1);
        if (d.text) { lab1.learned = ["Learned from a question people asked (" + d.g.q + "): " + d.text, ...lab1.learned].slice(0, 60); a1.stats.gapsLearned++; }
      }
      const cut = now() - 14 * DAY; a1.qa = a1.qa.filter((x) => x.t > cut || x.n >= 3);
      for (const k of Object.keys(a1.counts)) if (a1.counts[k].t < now() - 30 * DAY) delete a1.counts[k];
      a1.stats.ticks++; a1.stats.lastTick = now();
      writeDB(db1);
      if (promote) await researchTopic(promote, { quiet: true });
      try { await learnSkills(); } catch (e) { /* optional */ }
      try { await studyTick(); } catch (e) { console.error("study tick failed:", e.message); }
      return true;
    } catch (e) { console.error("auto-learn failed:", e.message); return null; } finally { ticking = false; }
  }
  // ---------- self-study: sports history/predictions/news and technology/AI ----------
  const studyKey = (track, topic) => track + ":" + tkey(topic);
  function nextStudy(lab, lastTrack) {
    let best = null, bs = -Infinity; const t0 = now();
    for (const track of Object.keys(STUDY)) for (const it of STUDY[track].items) {
      const rec = (lab.study || {})[studyKey(track, it.t)], every = it.live ? 8 * 36e5 : 30 * DAY, age = rec ? t0 - rec.t : Infinity;
      if (age < every) continue;
      const score = (rec ? age / every : 1e6) + (it.live ? 0.6 : 0) + (track === lastTrack ? -0.4 : 0) + Math.random() * 0.1;
      if (score > bs) { bs = score; best = { track, item: it }; }
    }
    return best;
  }
  let studying = false;
  async function studyTopic(track, item) {
    const topic = item.t;
    const qs = await planQueries(topic, item.live ? 4 : 5);
    const found = [], sources = new Set();
    await Promise.all(qs.map(async (q) => {
      const [r, n] = await Promise.all([withTimeout(KB.lookup(q).catch(() => null), 10000), withTimeout(News.search(q, item.live ? 4 : 2).catch(() => []), 10000)]);
      if (r && r.text) { found.push("- (" + q + ") " + clip(r.text, 450)); (r.sources || []).forEach((x) => sources.add(x)); }
      (n || []).forEach((x) => { found.push("- NEWS: " + x.title + " (" + x.src + ", " + News.when(x.time) + ")"); sources.add(x.src); });
    }));
    if (item.live) { const cat = track === "tech" ? ["tech", "ai"] : ["sports", "sportsworld"]; for (const c of cat) (await News.top(c, 6).catch(() => [])).forEach((x) => found.push("- NEWS: " + x.title + " (" + x.src + ", " + News.when(x.time) + ")")); }
    const raw = found.join("\n").slice(0, 9000);
    let text = null, by = "sources";
    if (KB.llmReady()) {
      const guide = track === "sports"
        ? (item.live ? "Write the CURRENT picture: latest results, tables or standings, form, injuries and upcoming fixtures. If it is about predictions give for each match a lean with rough probabilities (home win, draw, away win), the reasons, and say these are estimates, not certainties and not betting advice. "
          : "Write a complete, accurate study note: key dates, winners, records, legends, turning points and Nigerian or African connections. Mark any fact you are not sure about. ")
        : (item.live ? "Write what is NEW this week: names, products, companies, numbers and why it matters, with the date or how recent each item is. " : "Write a complete, accurate study note: how it works or what happened, key names and dates, the current state, and honest limits or risks. ");
      const r = await llmAsk("You are the study assistant of LetsChat AI, a chat assistant for users in Africa (mostly Nigeria). Study the topic using the NOTES and a web search if you can. " + guide + "Plain text only, no markdown symbols, under 450 words, short labelled paragraphs, include a final line 'SOURCES:' with the sources you used. Never invent facts, scores or dates: leave out what you cannot confirm.",
        "TOPIC: " + topic + "\nTODAY: " + lagosNow() + "\n\nNOTES:\n" + (raw || "(no notes, search the web yourself)"), { max: 1700 });
      if (r) { text = r.text.replace(/\*\*|__|^#+\s*/gm, ""); by = r.by; if (r.links) r.links.forEach((l) => sources.add(l.title || "")); }
    }
    if (!text && raw) text = "STUDY NOTES: " + topic.toUpperCase() + "\n" + raw.replace(/- NEWS: /g, "- News: ");
    if (!text) return false;
    const db = readDB(), { u, lab } = labOf(db); if (!u) return false;
    lab.study[studyKey(track, topic)] = { track, topic, live: !!item.live, text: clip(text, 3600), t: now(), by, sources: [...sources].filter(Boolean).slice(0, 8) };
    const a = autoOf(lab); a.stats.studyLast = track; a.stats.studyLastTopic = clip(topic, 80); a.stats.studyLastT = now();
    if (a.stats.studyDay !== dayStr()) { a.stats.studyDay = dayStr(); a.stats.studyToday = 0; }
    a.stats.studyToday++; a.stats.studied = (a.stats.studied || 0) + 1;
    writeDB(db); return true;
  }
  async function studyTick() {
    if (studying) return 0; studying = true; let n = 0;
    try {
      const limit = Math.max(1, parseInt(process.env.BOT_STUDY_PER_DAY || "24", 10) || 24), per = KB.llmReady() ? 1 : 2;
      for (let i = 0; i < per; i++) {
        const { u, lab } = labOf(readDB()); if (!u) break;
        const a = autoOf(lab); if (!a.on || !a.online) break;
        if (a.stats.studyDay === dayStr() && (a.stats.studyToday || 0) >= limit) break;
        const pick = nextStudy(lab, a.stats.studyLast); if (!pick) break;
        if (await studyTopic(pick.track, pick.item).catch((e) => { console.error("study failed:", e.message); return false; })) n++; else break;
      }
    } finally { studying = false; }
    return n;
  }
  function studyView() {
    const { lab } = labOf(readDB()), a = autoOf(lab), out = { today: (a.stats.studyDay === dayStr() ? a.stats.studyToday : 0) || 0, limit: Math.max(1, parseInt(process.env.BOT_STUDY_PER_DAY || "24", 10) || 24), last: a.stats.studyLastTopic || "", lastT: a.stats.studyLastT || 0 };
    for (const track of Object.keys(STUDY)) { const items = STUDY[track].items; out[track] = { label: STUDY[track].label, total: items.length, done: items.filter((it) => (lab.study || {})[studyKey(track, it.t)]).length }; }
    return out;
  }
  // the knowledge pack a phone saves so the robot still answers with no internet
  async function pack(userId) {
    const db = readDB(), { lab } = labOf(db), a = autoOf(lab), u = db.users.find((x) => x.id === userId);
    if (!a.on || !a.offline) return { off: true };
    const studyNotes = Object.values(lab.study || {}).flatMap((r) => sentences(r.text).slice(0, 3).map((x) => "[" + clip(r.topic, 40) + "] " + x));
    const notes = [...lab.facts, ...lab.learned, ...studyNotes].map((x) => clip(String(x).replace(/https?:\/\/\S+/g, "").trim(), 260)).filter((x) => x.length > 20).slice(0, 110);
    const qa = a.qa.slice().sort((x, y) => (y.n - x.n) || (y.t - x.t)).slice(0, 80).map((x) => ({ q: x.q, a: clip(x.a, 480) }));
    const skills = {}; for (const t of SKILL_TOPICS) { const l = lab.skills[tkey(t)]; skills[t] = clip((l && l.text) || BUILTIN_SKILLS[t] || "", 420); }
    let news = []; try { const lists = await Promise.all(["latest", "sports", "ai", "tech"].map((c) => withTimeout(News.top(c, 5).catch(() => []), 4000))); news = lists.flat().filter(Boolean).slice(0, 14).map((x) => x.title + " (" + x.src + ")"); } catch (e) { /* optional */ }
    const body = { app: APP_FACTS, notes, qa, news, me: u ? meSummary(u) : null, t: now() };
    let h = 0; const j = JSON.stringify({ ...body, t: 0 }); for (let i = 0; i < j.length; i++) h = (h * 31 + j.charCodeAt(i)) | 0;
    return { ...body, v: String(h >>> 0), skills };
  }
  // questions asked on the phone while it was offline: answer them for real now (a few per call)
  async function sync(userId, items) {
    const out = [];
    const list = (Array.isArray(items) ? items : []).map((x) => String((x && x.text) || "").trim().slice(0, 300)).filter(Boolean).slice(0, 3);
    for (const text of list) { try { await chat(userId, text); out.push(text); } catch (e) { break; } }
    if (out.length) { const db = readDB(), { lab } = labOf(db), a = autoOf(lab); a.stats.synced += out.length; writeDB(db); }
    return { done: out.length };
  }
  const meGet = (userId) => { const u = readDB().users.find((x) => x.id === userId); return u ? meSummary(u) : null; };
  function meSet(userId, on) { const db = readDB(), u = db.users.find((x) => x.id === userId); if (!u) return null; meOf(u).on = !!on; writeDB(db); return meSummary(u); }
  function meErase(userId) { const db = readDB(), u = db.users.find((x) => x.id === userId); if (!u) return null; const was = meOf(u).on !== false; u.botMe = { on: was, n: 0, pidgin: 0, short: 0, emoji: 0, topics: {} }; writeDB(db); return meSummary(u); }
  function autoView() {
    const { lab } = labOf(readDB()), a = autoOf(lab);
    return { on: a.on, online: a.online, inApp: a.inApp, offline: a.offline, asked: Object.keys(a.counts).length, hot: Object.values(a.counts).filter((c) => c.n >= 3).length, gaps: a.gaps.length, answers: a.qa.length, autoTopics: a.topicsAuto.slice(), stats: a.stats, study: studyView() };
  }
  function autoSet(patch) {
    const db = readDB(), { u, lab } = labOf(db); if (!u) throw new Error("Creator account not found");
    const a = autoOf(lab); for (const k of Object.keys(AUTO_DEFAULT)) if (typeof (patch || {})[k] === "boolean") a[k] = patch[k];
    writeDB(db); return autoView();
  }

  // ---------- research ----------
  let running = 0;
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  const llmAsk = async (system, user, opt) => { // the best available AI: Gemini with search first, then the others
    const msgs = [{ role: "system", content: system }, { role: "user", content: user }];
    const g = await KB.geminiSearch(msgs, { max: (opt && opt.max) || 1400, temp: 0.3, timeout: 45000 });
    if (g) return g;
    return KB.chat(msgs, { max: (opt && opt.max) || 1400, temp: 0.3, timeout: 40000, budget: 80000 });
  };
  async function planQueries(topic, n) {
    const base = [topic, "latest news " + topic, topic + " trends", topic + " facts and history", topic + " Nigeria Africa", topic + " opportunities and risks"].slice(0, n || 6);
    if (!KB.llmReady()) return base;
    const r = await KB.chat([{ role: "system", content: "You plan web research. Reply with exactly " + (n || 6) + " short search queries (3 to 8 words each), one per line, no numbering, that together cover the basics, key facts, history, the newest developments, Nigeria and Africa, opportunities and risks." }, { role: "user", content: "Topic: " + topic }], { max: 140, temp: 0.4, timeout: 15000 });
    const qs = r ? r.text.split("\n").map((x) => x.replace(/^[\s\d.\-•*]+/, "").trim()).filter((x) => x.length > 3).slice(0, n || 6) : [];
    return qs.length ? qs : base;
  }
  // broad research on one topic: many searches + news + AI synthesis; keeps a report that updates every day
  async function researchTopic(topic, opt) {
    topic = String(topic || "").trim().slice(0, 120); if (!topic) return null;
    running++;
    try {
      const { lab } = labOf(readDB()), key = tkey(topic), prev = lab.reports[key];
      const qs = await planQueries(topic, 6);
      const found = [], sources = new Set();
      await Promise.all(qs.map(async (q) => {
        const [r, n] = await Promise.all([withTimeout(KB.lookup(q).catch(() => null), 10000), withTimeout(News.search(q, 3).catch(() => []), 10000)]);
        if (r && r.text) { found.push("- (" + q + ") " + clip(r.text, 450)); (r.sources || []).forEach((s) => sources.add(s)); }
        (n || []).forEach((x) => { found.push("- NEWS: " + x.title + " (" + x.src + ", " + News.when(x.time) + ")"); sources.add(x.src); });
      }));
      const raw = found.join("\n").slice(0, 9000);
      let text = null, by = "sources";
      if (KB.llmReady()) {
        const r = await llmAsk("You are the research analyst of Letschat Africa (a chat app with an AI assistant, a Market, status updates and groups for users in Africa). Research the topic thoroughly: search the web yourself as well as using the NOTES. Write a report for the creator in plain text, no markdown symbols, with these headings in capitals, each followed by short lines: WHAT'S NEW SINCE LAST UPDATE (up to 5 lines; if there is no previous report say 'First report'), THE BASICS, KEY FACTS AND NUMBERS, LATEST DEVELOPMENTS, WHY IT MATTERS FOR LETSCHAT AND ITS USERS, OPPORTUNITIES AND RISKS, NOT SURE (what could not be confirmed). Never invent facts; say when sources are thin.",
          "TOPIC: " + topic + "\nTODAY: " + lagosNow() + (prev ? "\n\nPREVIOUS REPORT (" + new Date(prev.t).toISOString().slice(0, 10) + "):\n" + clip(prev.text, 2500) : "") + "\n\nNOTES:\n" + (raw || "(none found)"), { max: 1600 });
        if (r) { text = r.text.replace(/\*\*|__|^#+\s*/gm, ""); by = r.by; if (r.links) r.links.forEach((l) => sources.add(l.title || "")); }
      }
      if (!text) text = raw ? "WHAT I FOUND ON " + topic.toUpperCase() + "\n" + raw.replace(/- NEWS: /g, "- News: ") : "I could not reach online sources for \"" + topic + "\" right now. I will try again tomorrow.";
      const rep = { topic, text: clip(text, 6000), t: now(), by, sources: [...sources].filter(Boolean).slice(0, 10), prevText: prev ? prev.text : "" };
      const db = readDB(), { u, lab: lab2 } = labOf(db);
      if (u) {
        lab2.reports[key] = rep;
        const keys = Object.keys(lab2.reports); if (keys.length > 25) delete lab2.reports[keys.sort((a, b) => lab2.reports[a].t - lab2.reports[b].t)[0]];
        lab2.learned = [...sentences(rep.text).slice(0, 4).map((x) => "Research " + dayStr() + " (" + topic + "): " + clip(x, 230)), ...lab2.learned.filter((x) => !x.includes("(" + topic + "):"))].slice(0, 60);
        writeDB(db);
      }
      if (!opt || !opt.quiet) deliver("Research report: " + topic + " 🔎\n\n" + rep.text + (rep.sources.length ? "\n\nSources: " + rep.sources.join(", ") : ""));
      return rep;
    } catch (e) { console.error("topic research failed:", e.message); return null; } finally { running--; }
  }
  async function research() { // the daily run: general digest + Nigerian news + every topic the developer gave it + chat skills
    if (running) return null;
    running++;
    try {
      const { lab } = labOf(readDB());
      const topics = DEFAULT_TOPICS.slice(0, 8);
      try { await KB.loadNews(true); } catch (e) { /* optional */ }
      try { await News.refresh(); } catch (e) { /* optional */ }
      const notes = [], sources = new Set();
      for (const topic of topics) {
        const qs = await planQueries(topic, 3), found = [];
        for (const q of qs) { const r = await withTimeout(KB.lookup(q).catch(() => null), 10000); if (r && r.text && !found.some((f) => f.text === r.text)) { found.push({ q, text: r.text }); (r.sources || []).forEach((s) => sources.add(s)); } }
        if (found.length) notes.push({ topic, found });
      }
      const ng = {};
      for (const c of Object.keys(News.CATS)) ng[c] = (await News.top(c, 4)).map((x) => x.title + " (" + x.src + ")");
      const raw = notes.map((n) => "TOPIC: " + n.topic + "\n" + n.found.map((f) => "- (" + f.q + ") " + clip(f.text, 420)).join("\n")).join("\n\n") + "\n\nNEWS TODAY (Nigeria, sports, technology, AI):\n" + Object.entries(ng).map(([c, l]) => c.toUpperCase() + ":\n" + l.map((x) => "- " + x).join("\n")).join("\n");
      let text = null, by = "sources";
      if (KB.llmReady() && raw) {
        const r = await llmAsk("You are the research analyst of Letschat Africa (a chat app with an AI assistant, a Market, status updates and groups, for users in Africa). Using the NOTES and a web search of your own, write today's briefing for the creator in plain text, no markdown symbols. Headings in capitals each followed by short lines: WHAT'S NEW (up to 6), NIGERIA TODAY (news, gist, trending, sports in a few lines), WHAT IT MEANS FOR LETSCHAT, IDEAS TO TEACH USERS (skills and honest ways to earn), RISKS AND SCAMS TO WARN ABOUT, SUGGESTED ACTIONS FOR THE DEVELOPER (3 to 5), NOT SURE. Never invent facts.", "TODAY: " + lagosNow() + "\n\nNOTES:\n" + raw.slice(0, 9000), { max: 1500 });
        if (r) { text = r.text.replace(/\*\*|__|^#+\s*/gm, ""); by = r.by; }
      }
      if (!text) text = raw;
      const day = dayStr();
      const digest = { id: nanoid(8), t: now(), day, title: "Research " + day + " " + String(lagosHour()).padStart(2, "0") + ":00", text: clip(text, 5000), topics, sources: [...sources].slice(0, 12), by };
      const db = readDB(), { u, lab: lab2 } = labOf(db);
      if (!u) return digest;
      lab2.digests.unshift(digest); lab2.digests = lab2.digests.slice(0, 20);
      lab2.learned = [...notes.map((n) => "Research " + day + " (" + n.topic + "): " + clip(n.found[0].text, 230)), ...lab2.learned.filter((x) => !x.startsWith("Research " + day))].slice(0, 60);
      lab2.lastRun = now(); lab2.runs = (lab2.runs || 0) + 1; lab2.lastSlot = currentSlot();
      writeDB(db);
      // the developer's topics: re-research each one and report what changed
      const changed = [];
      const autoT = autoOf(lab).on && autoOf(lab).online ? autoOf(lab).topicsAuto.slice(-4) : [];
      for (const topic of [...(lab.topics || []).slice(0, 10), ...autoT.filter((x) => !(lab.topics || []).some((y) => tkey(y) === tkey(x)))]) {
        const rep = await researchTopic(topic, { quiet: true });
        if (rep) { const m = /WHAT'?S NEW SINCE LAST UPDATE\s*([\s\S]*?)(?:\n[A-Z][A-Z' ,&]{6,}\n|$)/.exec(rep.text); changed.push(topic.toUpperCase() + "\n" + clip((m ? m[1] : rep.text).trim(), 600)); }
      }
      // one message per run: the general briefing, then what changed on the developer's topics
      const hh = String(lagosHour()).padStart(2, "0") + ":00";
      deliver("Research update " + hh + " 🔎\n\n" + clip(digest.text, 3500) + (changed.length ? "\n\nYOUR TOPICS 📌\n\n" + changed.join("\n\n") : "") + (digest.sources.length ? "\n\nSources: " + digest.sources.join(", ") : ""));
      await learnSkills().catch((e) => console.error("skills learning failed:", e.message));
      return digest;
    } catch (e) { console.error("daily research failed:", e.message); return null; } finally { running--; }
  }
  // it teaches itself how to chat: every few days it studies each conversation skill online and rewrites its playbook
  async function learnSkills(force) {
    if (!KB.llmReady()) return 0;
    const db0 = readDB(), { u, lab } = labOf(db0); if (!u) return 0;
    if (!force && now() - (lab.skillsAt || 0) < 2 * DAY) return 0;
    const order = SKILL_TOPICS.slice().sort((a, b) => ((lab.skills[tkey(a)] || {}).t || 0) - ((lab.skills[tkey(b)] || {}).t || 0)).slice(0, 5);
    let n = 0;
    for (const topic of order) {
      const r = await llmAsk("You teach a chat assistant how to talk with people in Nigeria and across Africa. Write a compact playbook in plain text, max 90 words: the key tips and two or three short example replies. Be accurate about languages and culture, kind, never stereotyping.", "Skill: " + topic, { max: 260 });
      if (r && r.text && r.text.length > 40) { const db = readDB(), x = labOf(db); x.lab.skills[tkey(topic)] = { topic, text: clip(r.text.replace(/\*\*|__|^#+\s*/gm, ""), 700), t: now() }; x.lab.skillsAt = now(); writeDB(db); n++; }
    }
    return n;
  }
  let started = false;
  function start() {
    if (started) return; started = true;
    // every 10 minutes: if a research slot has started and not been done yet, run it (so a restart or a sleeping server catches up)
    const check = () => { try { const { u, lab } = labOf(readDB()); if (!u || running) return; const slot = currentSlot(); if (slot && lab.lastSlot !== slot) research(); else learnSkills(); } catch (e) { console.error("research check failed:", e.message); } };
    const a = setInterval(check, 10 * 60 * 1000), b = setTimeout(check, 90 * 1000);
    if (a.unref) a.unref(); if (b.unref) b.unref();
    const c = setInterval(() => { autoTick(); }, 30 * 60 * 1000), d = setTimeout(() => { autoTick(); }, 5 * 60 * 1000); // v18 auto-learn pass
    if (c.unref) c.unref(); if (d.unref) d.unref();
  }

  // ---------- developer training ----------
  const KINDS = { instruction: "instructions", fact: "facts", topic: "topics" };
  function trainView() {
    const { lab } = labOf(readDB());
    return { llm: KB.llmReady(), providers: (KB.stats().ai || []), instructions: lab.instructions, facts: lab.facts, topics: lab.topics, defaultTopics: DEFAULT_TOPICS, learned: lab.learned, lastRun: lab.lastRun || 0, runs: lab.runs || 0, running: running > 0, schedule: HOURS.map((h) => String(h).padStart(2, "0") + ":00"),
      digests: lab.digests.slice(0, 7).map((d) => ({ id: d.id, t: d.t, title: d.title, text: d.text, sources: d.sources })),
      reports: lab.topics.map((tp) => { const r = lab.reports[tkey(tp)]; return { topic: tp, t: r ? r.t : 0, text: r ? r.text : "", sources: r ? r.sources : [] }; }),
      skills: SKILL_TOPICS.map((tp) => { const s = lab.skills[tkey(tp)]; return { topic: tp, learned: !!s, t: s ? s.t : 0 }; }), news: News.stats(), auto: autoView() };
  }
  function trainAdd(kind, text) {
    const key = KINDS[kind], t = String(text || "").replace(/\s+/g, " ").trim().slice(0, kind === "topic" ? 120 : 700);
    if (!key || !t) throw new Error("Type something first");
    const db = readDB(), { u, lab } = labOf(db);
    if (!u) throw new Error("Creator account not found");
    if (!lab[key].some((x) => tkey(x) === tkey(t) && kind === "topic") && !lab[key].includes(t)) lab[key].push(t);
    if (lab[key].length > (key === "topics" ? 20 : 120)) lab[key].shift();
    writeDB(db);
    if (kind === "topic") setTimeout(() => researchTopic(t), 50); // starts researching at once and sends the report to your AI chat
  }
  function trainRemove(kind, index) {
    const key = KINDS[kind] || (kind === "learned" ? "learned" : null);
    if (!key) throw new Error("Unknown list");
    const db = readDB(), { u, lab } = labOf(db);
    if (!u) throw new Error("Creator account not found");
    const i = Number(index);
    if (i >= 0 && i < lab[key].length) { const gone = lab[key].splice(i, 1)[0]; if (kind === "topic") delete lab.reports[tkey(gone)]; }
    writeDB(db);
  }
  return { studyTick, pack, sync, feedback, autoTick, autoView, autoSet, meGet, meSet, meErase, chat, history, clear, research, researchTopic: (t) => { setTimeout(() => researchTopic(t), 50); }, learnSkills, start, trainView, trainAdd, trainRemove, _reply: reply, _shape: shape };
};
