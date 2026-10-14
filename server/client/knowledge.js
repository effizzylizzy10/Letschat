"use strict";
// Letschat AI knowledge engine: sources answers online by itself, learns from every question, refreshes itself.
//
// Free sources, no key needed: Wikipedia, DuckDuckGo instant answers, Open-Meteo (weather), open.er-api.com (exchange rates),
// dictionaryapi.dev (definitions), BBC / custom RSS feeds (news). Local: maths, date and time.
// Optional free AI key (any ONE of these in Render > Environment makes answers read naturally):
//   GROQ_API_KEY (console.groq.com, free, no card)   GEMINI_API_KEY (aistudio.google.com, free)   OPENROUTER_API_KEY (":free" models)
//   or AI_API_KEY + AI_BASE_URL + AI_MODEL for any OpenAI-compatible service. Models can be changed with GROQ_MODEL / GEMINI_MODEL / OPENROUTER_MODEL.
// Without any key it still answers, straight from the sources above (retrieval only).
// Only the cleaned question text goes outside: phone numbers, emails, links and long digit strings are removed first.
const fs = require("fs");
const path = require("path");

const E = process.env;
// Keys are read ONLY from environment variables (Render > Environment). Never paste keys into source code.
const KEY = (n) => E[n];
const FILE = path.join(__dirname, "data", "ai-knowledge.json");
const DAY = 864e5, HOUR = 36e5;
const TTL = { wiki: 7 * DAY, ddg: 2 * DAY, weather: 3 * HOUR, fx: 6 * HOUR, dict: 30 * DAY, news: 3 * HOUR, ans: 12 * HOUR };
const MAX_ENTRIES = 400;
const UA = "LetschatAI/1.0";

let store = { entries: {}, asked: {}, news: { t: 0, items: [] }, fx: { t: 0, rates: null }, stats: { answered: 0, online: 0, cached: 0, llm: 0, refreshed: 0, learnedAt: 0 } };
try { const j = JSON.parse(fs.readFileSync(FILE, "utf-8")); if (j && j.entries) store = { ...store, ...j, stats: { ...store.stats, ...(j.stats || {}) } }; } catch (e) { /* first run */ }
let saveT = null;
function save() {
  if (saveT) return;
  saveT = setTimeout(() => {
    saveT = null;
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(store)); } catch (e) { /* read-only disk: knowledge simply rebuilds */ }
  }, 3000);
  if (saveT.unref) saveT.unref();
}

// ---------- helpers ----------
async function getRaw(url, ms, headers) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 6000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": UA, Accept: "application/json, text/xml, */*", ...(headers || {}) } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function getJson(url, ms, headers) { return JSON.parse(await getRaw(url, ms, headers)); }
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
const enc = encodeURIComponent;
const STOP = new Set("a an the is are was were be am i you he she it we they me my your our their to of in on at for with and or but so if this that these those do does did have has had will would can could should just please pls what who whom whose when where why how which tell about explain give".split(" "));
const tokens = (t) => [...new Set(String(t || "").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\u00C0-\uFFFF\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
const norm = (q) => tokens(q).sort().join(" ");

// remove anything personal before a question leaves the server
function scrub(q) {
  return String(q || "").replace(/https?:\/\/\S+/gi, " ").replace(/\S+@\S+\.\S+/g, " ").replace(/\+?\d[\d\s\-()]{6,}\d/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}
function isQuestion(t) {
  const s = String(t || "").trim();
  if (s.length < 4 || s.length > 300) return false;
  return /\?\s*$/.test(s) || /^(what|who|whom|when|where|why|how|which|is|are|do|does|did|can|could|define|meaning of|tell me|explain|convert|weather|price|rate|how much|how many|any|do you)\b/i.test(s);
}

// ---------- local answers ----------
function localAnswer(q) {
  const s = q.trim().toLowerCase().replace(/[?=]+$/, "");
  const now = new Date();
  if (/\b(what('?s| is) the )?(time|date|day)\b.*\b(now|today|is it)\b|^what (time|day|date) is it\b|^(today'?s )?date$/.test(s)) {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", dateStyle: "full", timeStyle: "short" }).format(now);
    return { text: "It is " + f + " (Lagos time).", sources: [], kind: "local" };
  }
  const m = s.replace(/^(what('?s| is)|calculate|calc|solve|compute)\s+/, "").replace(/,/g, "").replace(/\bx\b/g, "*").replace(/\^/g, "**").replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, "($1/100)*$2");
  if (/^[\d\s+\-*/().%e]+$/.test(m) && /\d\s*[-+*/%]|\*\*/.test(m) && m.length < 60) {
    try { const v = Function('"use strict";return (' + m + ")")(); if (typeof v === "number" && isFinite(v)) return { text: s.replace(/^(what('?s| is)|calculate|calc|solve|compute)\s+/, "") + " = " + Math.round(v * 1e8) / 1e8, sources: [], kind: "local" }; } catch (e) { /* not maths */ }
  }
  return null;
}

// ---------- online sources ----------
const WCODE = { 0: "clear sky", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 80: "rain showers", 81: "rain showers", 82: "heavy showers", 95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with hail" };
async function weather(q) {
  const m = /\b(?:weather|temperature|forecast|rain(?:ing)?|hot|cold)\b.*?\b(?:in|at|for|of)\s+([a-z .'-]{2,40})/i.exec(q) || /([a-z .'-]{2,40})\s+weather\b/i.exec(q);
  if (!m) return null;
  const place = m[1].replace(/\b(today|now|tomorrow|please|pls|like|right)\b.*$/i, "").trim();
  if (!place) return null;
  const g = await getJson("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=" + enc(place));
  const p = g.results && g.results[0]; if (!p) return null;
  const w = await getJson("https://api.open-meteo.com/v1/forecast?latitude=" + p.latitude + "&longitude=" + p.longitude + "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1");
  const c = w.current, d = w.daily;
  return { text: "Weather in " + p.name + (p.country ? ", " + p.country : "") + ": " + Math.round(c.temperature_2m) + "°C now, " + (WCODE[c.weather_code] || "mixed conditions") + ", humidity " + c.relative_humidity_2m + "%. Today " + Math.round(d.temperature_2m_min[0]) + "–" + Math.round(d.temperature_2m_max[0]) + "°C, chance of rain " + (d.precipitation_probability_max[0] ?? "?") + "%.", sources: ["open-meteo.com"], kind: "weather" };
}
const CUR = { naira: "NGN", ngn: "NGN", dollar: "USD", dollars: "USD", usd: "USD", pound: "GBP", pounds: "GBP", gbp: "GBP", euro: "EUR", euros: "EUR", eur: "EUR", cedi: "GHS", cedis: "GHS", ghs: "GHS", rand: "ZAR", zar: "ZAR", kes: "KES", ksh: "KES", cad: "CAD", cfa: "XOF", xof: "XOF", yuan: "CNY", cny: "CNY", inr: "INR", rupee: "INR", rupees: "INR", aed: "AED", dirham: "AED" };
async function fx(q) {
  const m = /(?:(\d[\d,]*(?:\.\d+)?)\s*)?\b([a-z]{3,7})\b\s+(?:to|in|into|=)\s+\b([a-z]{3,7})\b/i.exec(q);
  if (!m || !CUR[m[2].toLowerCase()] || !CUR[m[3].toLowerCase()]) return null;
  const from = CUR[m[2].toLowerCase()], to = CUR[m[3].toLowerCase()], amt = m[1] ? Number(m[1].replace(/,/g, "")) : 1;
  if (!store.fx.rates || Date.now() - store.fx.t > TTL.fx) { const j = await getJson("https://open.er-api.com/v6/latest/USD"); if (j && j.rates) store.fx = { t: Date.now(), rates: j.rates }; }
  const r = store.fx.rates; if (!r || !r[from] || !r[to]) return null;
  const v = (amt * r[to]) / r[from];
  return { text: amt.toLocaleString("en-US") + " " + from + " ≈ " + v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 4 : 2 }) + " " + to + " (market rate; banks and parallel market can differ).", sources: ["open.er-api.com"], kind: "fx" };
}
async function define(q) {
  const m = /^(?:define|meaning of|what does)\s+"?([a-z-]{2,30})"?(?:\s+mean)?\s*\??$/i.exec(q.trim()) || /^what is the meaning of\s+"?([a-z-]{2,30})"?\s*\??$/i.exec(q.trim());
  if (!m) return null;
  const j = await getJson("https://api.dictionaryapi.dev/api/v2/entries/en/" + enc(m[1].toLowerCase()));
  const mean = j && j[0] && j[0].meanings && j[0].meanings[0]; if (!mean) return null;
  return { text: m[1] + " (" + mean.partOfSpeech + "): " + clip(mean.definitions[0].definition, 220), sources: ["dictionaryapi.dev"], kind: "dict" };
}
const FEEDS = () => (E.AI_FEEDS ? E.AI_FEEDS.split(",").map((x) => x.trim()).filter(Boolean) : ["https://feeds.bbci.co.uk/news/world/africa/rss.xml", "https://feeds.bbci.co.uk/news/world/rss.xml"]);
const unCdata = (s) => String(s || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
async function loadNews(force) {
  if (!force && store.news.items.length && Date.now() - store.news.t < TTL.news) return store.news.items;
  const out = [];
  for (const url of FEEDS()) {
    try {
      const xml = await getRaw(url, 7000);
      let host = ""; try { host = new URL(url).hostname; } catch (e) { /* ignore */ }
      for (const it of (xml.match(/<item[\s\S]*?<\/item>/g) || []).slice(0, 6)) {
        const t = unCdata((/<title>([\s\S]*?)<\/title>/.exec(it) || [])[1]), d = unCdata((/<description>([\s\S]*?)<\/description>/.exec(it) || [])[1]);
        if (t && !out.some((o) => o.t === clip(t, 140))) out.push({ t: clip(t, 140), d: clip(d, 160), src: host });
      }
    } catch (e) { /* feed down: skip */ }
  }
  if (out.length) store.news = { t: Date.now(), items: out.slice(0, 24) };
  save();
  return store.news.items;
}
async function news(q) {
  if (!/\b(news|headlines?|latest|happening|breaking)\b/i.test(q)) return null;
  const items = await loadNews(false); if (!items.length) return null;
  const want = tokens(q).filter((w) => !/^(news|headlines?|latest|happening|breaking|today|now)$/.test(w));
  let pick = want.length ? items.filter((i) => want.some((w) => (i.t + " " + i.d).toLowerCase().includes(w))) : [];
  if (!pick.length) pick = items;
  return { text: "Latest headlines: " + pick.slice(0, 3).map((i, n) => (n + 1) + ") " + i.t).join(" "), sources: [...new Set(pick.slice(0, 3).map((i) => i.src))], kind: "news" };
}
function subject(q) {
  return q.replace(/[?!.]+$/, "").replace(/^(hey |hi |please |pls )+/i, "").replace(/^(what('?s| is| are| was| were)|who('?s| is| was| are)|when (is|was|did)|where (is|was)|tell me (about|more about)|explain|define|describe|how does|how do|why (is|does|are)|do you know)\s+(about |the |a |an )?/i, "").trim();
}
const safe = (p) => p.catch(() => null);
// ---------- pick the sentence that answers the question ----------
// A Wikipedia / DuckDuckGo summary is a whole paragraph. When no AI is available the reply must be the ONE sentence that matches what was asked
// ("when was Lagos founded" -> the sentence with the founding year), not the first lines of the article.
const stem = (w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w);
const SYN = ["founded established created started formed began founder built", "born birth birthday", "died death dead killed", "invented inventor discovered developed", "capital seat",
  "population inhabitants residents populated people", "located situated lies border bordered", "president leader head governor ruler minister", "largest biggest size area large", "language languages spoken speak",
  "currency money", "famous known notable", "won win winner champion champions awarded award received prize", "member members join joined", "independence independent", "meaning means refers stands"].map((g) => g.split(" ").map(stem));
const MONTH = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
function sentences(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=["“(\[]?[A-Z0-9])/), out = [];
  for (const s of raw) {
    const prev = out[out.length - 1];
    // "J. R. R. Tolkien", "U.S. Army", "St. Mary", "Dr. Who": a full stop after an initial or abbreviation is not the end of a sentence
    if (prev && /(?:\b[A-Z]|\b(?:St|Mr|Mrs|Ms|Dr|Prof|Jr|Sr|vs|ca|No|Mt|Inc|Ltd|Co|Gen|Col|Lt|Rev|Fr|approx|etc))\.$/.test(prev)) out[out.length - 1] = prev + " " + s; else out.push(s);
  }
  return out.filter((s) => s.length > 1);
}
// text: the summary, question: what the person asked, title: the article title (its words say little about WHAT is wanted, so they count less)
function pickSentence(text, question, title) {
  const ss = sentences(text); if (!ss.length) return clip(text, 520);
  const q = String(question || ""), cleanTitle = String(title || "").replace(/\s*\(.*?\)\s*$/, "").trim();
  const titleT = new Set(tokens(cleanTitle).map(stem));
  const want = tokens(q).map(stem).filter((w) => !titleT.has(w));
  const lead = () => clip(ss.slice(0, 2).join(" "), 520);
  // "what is X" / "who is X" / "tell me about X": the definition is the first sentence(s)
  if (!want.length || ss.length === 1) return lead();
  const when = /\b(when|what year|which year|what date|date|born|died|founded|established|how old|age)\b/i.test(q);
  const count = /\b(how many|how much|population|number of|size|area|height|length|tall|long|big|largest|cost|price|distance|percent|percentage)\b/i.test(q);
  const where = /\b(where|located|location|capital)\b/i.test(q);
  const who = /\bwho\b/i.test(q);
  let best = -1, bestScore = 0;
  ss.forEach((s, i) => {
    const st = new Set(tokens(s).map(stem));
    let sc = 0;
    for (const w of want) {
      if (st.has(w)) sc += 2;
      else { const g = SYN.find((x) => x.includes(w)); if (g && g.some((x) => st.has(x))) sc += 1.2; }
    }
    if (!sc) return; // shares nothing with what was asked: never chosen on intent alone
    for (const w of titleT) if (st.has(w)) sc += 0.3;
    if (when && (/\b(1[0-9]{3}|20[0-9]{2})\b/.test(s) || MONTH.test(s))) sc += 2;
    if (count && /\d/.test(s)) sc += 2;
    if (where && /\b(located|situated|lies|capital|border\w*|city|country|state|north|south|east|west|coast|region)\b/i.test(s)) sc += 1.5;
    if (who && /\b(is|was|by|led|founded|founder|president|known|served)\b/.test(s) && /\s[A-Z][a-z]+/.test(s)) sc += 1;
    sc += 0.25 / (i + 1); // on a tie the earlier sentence is the better one
    if (sc > bestScore) { bestScore = sc; best = i; }
  });
  if (best < 0 || bestScore < 1.2) return lead();
  let out = ss[best];
  // a sentence that starts with He / She / It cannot stand alone: name the subject
  if (best > 0 && cleanTitle) out = out.replace(/^(He|She|It|They)\b/, cleanTitle).replace(/^(His|Her|Its|Their)\b/, cleanTitle + "'s");
  if (out.length < 60 && ss[best + 1]) out += " " + ss[best + 1];
  return clip(out, 520);
}
async function ddg(q, asked) {
  const j = await getJson("https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&no_redirect=1&q=" + enc(q));
  const t = j.Answer || j.AbstractText || ((j.RelatedTopics || []).find((x) => x && x.Text) || {}).Text;
  if (!t) return null;
  return { text: clip(t, 450), focus: pickSentence(t, asked || q, j.Heading), sources: [String(j.AbstractURL || "duckduckgo.com").replace(/^https?:\/\//, "").split("/")[0]], kind: "ddg" };
}
async function wiki(q) {
  const subj = subject(q); if (subj.length < 2) return null;
  const s = await getJson("https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=" + enc(subj));
  const hit = s.query && s.query.search && s.query.search[0]; if (!hit) return null;
  const [sum, lead] = await Promise.all([
    getJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + enc(hit.title.replace(/ /g, "_"))),
    safe(getJson("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&origin=*&titles=" + enc(hit.title))), // the whole intro, so there are more sentences to choose from
  ]);
  if (!sum.extract || sum.type === "disambiguation") return null;
  const pg = lead && lead.query && lead.query.pages ? Object.values(lead.query.pages)[0] : null;
  const full = pg && pg.extract && pg.extract.length > sum.extract.length ? pg.extract.slice(0, 4000) : sum.extract;
  return { text: clip(sum.extract, 520), focus: pickSentence(full, q, hit.title), sources: ["en.wikipedia.org"], kind: "wiki" };
}
// one lookup for any question: the most specific source first, then general search in parallel
async function lookup(question) {
  const q = scrub(question); if (q.length < 3) return null;
  const loc = localAnswer(q); if (loc) return loc;
  for (const fn of [weather, fx, define, news]) { const r = await safe(fn(q)); if (r) return r; }
  const [a, b] = await Promise.all([safe(ddg(subject(q) || q, q)), safe(wiki(q))]);
  return a && a.kind === "ddg" && (b ? a.text.length >= 60 : true) ? a : b || a;
}

// every source that has something for the question, so the answer can be cross-checked (specific source first; otherwise DuckDuckGo AND Wikipedia together)
async function lookupAll(question) {
  const q = scrub(question); if (q.length < 3) return [];
  const loc = localAnswer(q); if (loc) return [loc];
  for (const fn of [weather, fx, define]) { const r = await safe(fn(q)); if (r) return [r]; }
  const [n, a, b] = await Promise.all([safe(news(q)), safe(ddg(subject(q) || q, q)), safe(wiki(q))]);
  return [n, b, a].filter(Boolean);
}

// ---------- free AI (optional) ----------
// Free AI providers (OpenAI-compatible chat/completions). Each one is used only when its key is set in Render > Environment; they are tried in order and
// a provider that is out of quota or down is skipped for a few minutes, so one failing key never slows the robot down.
//   GEMINI_API_KEY  OPENAI_API_KEY  ANTHROPIC_API_KEY  GROQ_API_KEY  OPENROUTER_API_KEY (+ _2, _3 = separate free quotas)  HF_API_KEY  SAMBANOVA_API_KEY
//   GITHUB_MODELS_TOKEN  COHERE_API_KEY  CLOUDFLARE_API_KEY + CLOUDFLARE_ACCOUNT_ID  REQUESTY_API_KEY  TOGETHER_API_KEY   or AI_API_KEY + AI_BASE_URL + AI_MODEL (any OpenAI-compatible)
// Models can be changed with <NAME>_MODEL (e.g. GROQ_MODEL).
function providers() {
  const p = [], add = (n, url, key, model) => { if (key && url) p.push({ n, url, key, model }); };
  const list = (envModel, defaults) => (envModel ? [envModel] : defaults); // <NAME>_MODEL in Render replaces the built-in list
  // Same providers, models and fallback order as the Smart Tech AI app: Gemini, ChatGPT and Claude first, then the free tiers that refresh, paid ones last.
  add("gemini", "https://generativelanguage.googleapis.com/v1beta/openai", KEY("GEMINI_API_KEY"), list(E.GEMINI_MODEL, ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest"]));
  add("openai", "https://api.openai.com/v1", KEY("OPENAI_API_KEY"), list(E.OPENAI_MODEL, ["gpt-5.4-nano", "gpt-5.4-mini", "gpt-4o-mini"])); // OpenAI / ChatGPT
  add("anthropic", "https://api.anthropic.com/v1", KEY("ANTHROPIC_API_KEY"), list(E.ANTHROPIC_MODEL, ["claude-haiku-4-5-20251001", "claude-sonnet-5-5"])); // Claude (OpenAI-compatible endpoint)
  add("groq", "https://api.groq.com/openai/v1", KEY("GROQ_API_KEY"), list(E.GROQ_MODEL, ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile"]));
  const orModels = list(E.OPENROUTER_MODEL, ["openrouter/free", "openai/gpt-oss-120b:free", "openai/gpt-oss-20b:free"]); // openrouter/free picks a working free model by itself
  add("openrouter", "https://openrouter.ai/api/v1", KEY("OPENROUTER_API_KEY"), orModels);
  add("openrouter2", "https://openrouter.ai/api/v1", KEY("OPENROUTER_API_KEY_2"), orModels);
  add("openrouter3", "https://openrouter.ai/api/v1", KEY("OPENROUTER_API_KEY_3"), orModels);
  add("huggingface", "https://router.huggingface.co/v1", KEY("HF_API_KEY"), list(E.HF_MODEL, ["meta-llama/Llama-3.3-70B-Instruct"]));
  add("sambanova", "https://api.sambanova.ai/v1", KEY("SAMBANOVA_API_KEY"), list(E.SAMBANOVA_MODEL, ["Meta-Llama-3.3-70B-Instruct", "gpt-oss-120b"]));
  add("github", "https://models.github.ai/inference", KEY("GITHUB_MODELS_TOKEN"), list(E.GITHUB_MODEL, ["openai/gpt-4.1-mini"])); // GitHub Models (token with the "models" permission)
  add("cohere", "https://api.cohere.ai/compatibility/v1", KEY("COHERE_API_KEY"), list(E.COHERE_MODEL, ["command-a-03-2025", "command-a-plus-05-2026"]));
  if (KEY("CLOUDFLARE_API_KEY") && KEY("CLOUDFLARE_ACCOUNT_ID")) add("cloudflare", "https://api.cloudflare.com/client/v4/accounts/" + KEY("CLOUDFLARE_ACCOUNT_ID") + "/ai/v1", KEY("CLOUDFLARE_API_KEY"), list(E.CLOUDFLARE_MODEL, ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"]));
  add("requesty", "https://router.requesty.ai/v1", KEY("REQUESTY_API_KEY"), list(E.REQUESTY_MODEL, ["openai/gpt-4o-mini"])); // aggregator
  add("together", "https://api.together.xyz/v1", KEY("TOGETHER_API_KEY"), list(E.TOGETHER_MODEL, ["meta-llama/Llama-3.3-70B-Instruct-Turbo"]));
  add("xai", "https://api.x.ai/v1", E.XAI_API_KEY, list(E.XAI_MODEL, ["grok-4", "grok-3-mini", "grok-3"])); // optional: xAI Grok (set XAI_API_KEY)
  add("deepseek", "https://api.deepseek.com/v1", E.DEEPSEEK_API_KEY, E.DEEPSEEK_MODEL || "deepseek-chat"); // DeepSeek (set DEEPSEEK_API_KEY)
  add("mistral", "https://api.mistral.ai/v1", E.MISTRAL_API_KEY, E.MISTRAL_MODEL || "mistral-small-latest"); // Mistral (set MISTRAL_API_KEY)
  add("custom", E.AI_BASE_URL, E.AI_API_KEY, E.AI_MODEL || "default");
  // AI_PRIMARY=openai (or gemini, anthropic, groq...) tries that provider first
  const first = String(E.AI_PRIMARY || "").trim().toLowerCase(), i = p.findIndex((x) => x.n === first);
  if (i > 0) p.unshift(p.splice(i, 1)[0]);
  return p;
}
const llmReady = () => providers().length > 0;
const cooldown = new Map(); // provider name -> time until it is tried again after a failure
const lastErrors = {}; // provider name -> { at, error } (the real reason the last call failed, shown in /api/creator/ai-status)
const noteErr = (n, msg) => { lastErrors[n] = { at: new Date().toISOString(), error: String(msg).slice(0, 300) }; console.error("[ai]", n, "failed:", String(msg).slice(0, 300)); };
// Google's newer "AQ." keys must go in x-goog-api-key ALONE (a Bearer header is read as an OAuth token and rejected)
const chatAuth = (p) => p.n === "gemini" ? (/^AQ\./.test(p.key) ? { "x-goog-api-key": p.key } : { Authorization: "Bearer " + p.key, "x-goog-api-key": p.key })
  : p.n === "anthropic" ? { Authorization: "Bearer " + p.key, "x-api-key": p.key, "anthropic-version": "2023-06-01" } : { Authorization: "Bearer " + p.key };
// OpenAI's gpt-5 / o-series models take max_completion_tokens, ignore a custom temperature, and spend part of the budget on reasoning
function chatBody(p, model, messages, opt) {
  const max = (opt && opt.max) || 300, temperature = opt && opt.temp != null ? opt.temp : 0.3;
  if (p.n === "openai" && /^(gpt-5|o\d)/.test(model)) return { model, messages, max_completion_tokens: Math.max(max * 4, 1000) };
  if (p.n === "openai") return { model, messages, max_completion_tokens: max, temperature };
  return { model, messages, max_tokens: max, temperature };
}
// ---------- keep every provider online by itself ----------
// A background monitor checks each provider's key with a free request (GET /models, costs no tokens) at start-up and every 5 minutes, so a provider that
// was down comes back into use on its own. Providers that are known to be working are tried first; one that is down is tried last, never dropped.
const health = {}; // provider name -> { ok: true|false|null, status, detail, at }
const markHealth = (n, ok, status, detail) => { health[n] = { ok, status: status || null, detail: detail || "", at: new Date().toISOString() }; };
async function probe(p) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(p.url.replace(/\/$/, "") + "/models", { signal: ctl.signal, headers: chatAuth(p) });
    if (r.ok) markHealth(p.n, true, r.status, "online");
    else if (r.status === 401 || r.status === 403) markHealth(p.n, false, r.status, "key rejected");
    else if (r.status === 404 || r.status === 405) { if (!health[p.n]) markHealth(p.n, null, r.status, "no model list; checked on first use"); } // provider has no /models: real calls decide
    else markHealth(p.n, false, r.status, "provider busy or down; will retry");
  } catch (e) { markHealth(p.n, false, 0, e && e.name === "AbortError" ? "timeout" : "unreachable"); } finally { clearTimeout(t); }
}
async function checkAll() { await Promise.all(providers().map((p) => probe(p).catch(() => {}))); for (const p of providers()) if (health[p.n] && health[p.n].ok === true && (cooldown.get(p.n) || 0) > Date.now() && /timeout|unreachable|5\d\d/.test((lastErrors[p.n] || {}).error || "")) cooldown.delete(p.n); } // back online: lift a cool-down that came from an outage
const rank = (p) => (health[p.n] && health[p.n].ok === false ? 1 : 0);
async function chat(messages, opt) {
  const t0 = Date.now(), budget = (opt && opt.budget) || 45000;
  for (const p of providers().map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map((o) => o.x)) {
    if (Date.now() - t0 > budget) break;
    if ((cooldown.get(p.n) || 0) > Date.now()) continue;
    const models = Array.isArray(p.model) ? p.model : [p.model];
    let providerDown = false;
    for (const model of models) {
      if (providerDown || Date.now() - t0 > budget) break;
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), (opt && opt.timeout) || 14000);
      try {
        const r = await fetch(p.url.replace(/\/$/, "") + "/chat/completions", {
          method: "POST", signal: ctl.signal,
          headers: { "Content-Type": "application/json", ...chatAuth(p) },
          body: JSON.stringify(chatBody(p, model, messages, opt)),
        });
        if (!r.ok) {
          let body = ""; try { body = (await r.text()).slice(0, 250); } catch (e) {}
          noteErr(p.n + ":" + model, "HTTP " + r.status + " " + body);
          if (r.status === 401 || r.status === 403) markHealth(p.n, false, r.status, "key rejected");
          if (r.status === 400 || r.status === 404) continue; // wrong/retired model name: try the next model of the same provider
          providerDown = true; // bad key, quota, outage: skip this provider for a while
          cooldown.set(p.n, Date.now() + (r.status === 429 || r.status === 402 ? 5 * 60 * 1000 : r.status === 401 || r.status === 403 ? 30 * 60 * 1000 : 60 * 1000));
          continue;
        }
        const j = await r.json(), txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (txt && txt.trim()) {
          if (opt && opt.accept && !opt.accept(txt.trim())) continue; // a weak model echoed the question or answered with nonsense: ask the next AI
          delete lastErrors[p.n + ":" + model]; lastErrors[p.n] = { at: new Date().toISOString(), ok: true, model }; markHealth(p.n, true, 200, "online");
          return { text: txt.trim(), by: p.n };
        }
        noteErr(p.n + ":" + model, "empty reply");
      } catch (e) {
        noteErr(p.n + ":" + model, (e && e.name === "AbortError" ? "timeout" : (e && e.message) || e));
        providerDown = true; cooldown.set(p.n, Date.now() + 30 * 1000);
      } finally { clearTimeout(t); }
    }
  }
  return null;
}
const aiStatus = () => ({ providers: providers().map((p) => ({ name: p.n, models: [].concat(p.model), coolingDown: (cooldown.get(p.n) || 0) > Date.now(), online: health[p.n] ? health[p.n].ok : null, health: health[p.n] || null })), lastErrors });

// Real Gemini with Google Search grounding (the native Gemini API, not the compatibility endpoint): it searches the web by itself for every question and returns the sources it used.
async function geminiSearch(messages, opt) {
  const key = KEY("GEMINI_API_KEY"); if (!key || (cooldown.get("gemini-search") || 0) > Date.now()) return null;
  const model = E.GEMINI_MODEL || "gemini-2.5-flash";
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] }));
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), (opt && opt.timeout) || 25000);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
      method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: (opt && opt.max) || 1500, temperature: opt && opt.temp != null ? opt.temp : 0.5 } }),
    });
    if (!r.ok) { cooldown.set("gemini-search", Date.now() + (r.status === 429 ? 10 : r.status === 401 || r.status === 403 ? 60 : 3) * 60 * 1000); return null; }
    const j = await r.json(), c = j.candidates && j.candidates[0];
    const text = c && c.content && c.content.parts ? c.content.parts.map((x) => x.text || "").join("").trim() : "";
    if (!text || (opt && opt.accept && !opt.accept(text))) return null;
    const links = ((c.groundingMetadata || {}).groundingChunks || []).map((g) => g.web && g.web.uri ? { uri: g.web.uri, title: g.web.title || "" } : null).filter(Boolean);
    return { text, by: "gemini+search", links: links.slice(0, 6) };
  } catch (e) { cooldown.set("gemini-search", Date.now() + 2 * 60 * 1000); return null; } finally { clearTimeout(t); }
}

// ---------- the answer pipeline ----------
function topFacts(question, facts, n) {
  const qt = tokens(question);
  return (facts || []).map((f) => ({ f, s: tokens(f).filter((w) => qt.includes(w)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n || 6).map((x) => x.f);
}
function remember(question, res) {
  const k = norm(question); if (!k) return;
  store.asked[k] = { q: clip(scrub(question), 120), n: ((store.asked[k] || {}).n || 0) + 1, t: Date.now() };
  if (res && res.text && res.kind) {
    const old = store.entries[k] || {};
    store.entries[k] = { q: clip(scrub(question), 120), text: res.text, sources: res.sources || [], kind: res.kind, t: Date.now(), n: (old.n || 0) + 1 };
  }
  const keys = Object.keys(store.entries);
  if (keys.length > MAX_ENTRIES) { keys.sort((a, b) => (store.entries[a].n - store.entries[b].n) || (store.entries[a].t - store.entries[b].t)); for (const x of keys.slice(0, keys.length - MAX_ENTRIES + 40)) delete store.entries[x]; }
  const ak = Object.keys(store.asked);
  if (ak.length > 1500) { ak.sort((a, b) => store.asked[a].n - store.asked[b].n); for (const x of ak.slice(0, 300)) delete store.asked[x]; }
  store.stats.learnedAt = Date.now();
  save();
}
// ctx: { facts: [strings the person/business told it or it learned from their profile], instructions: [strings], persona: "name", online: true/false }
async function answer(question, ctx) {
  ctx = ctx || {};
  const q = String(question || "").trim(); if (q.length < 2) return null;
  const mine = topFacts(q, ctx.facts, 6);
  const k = norm(q), hit = store.entries[k];
  // reuse what it already learned online (only when the question is not about the person's own business facts)
  if (!mine.length && hit && Date.now() - hit.t < (TTL[hit.kind] || TTL.ans) && !providers().length) { hit.n++; store.stats.cached++; store.stats.answered++; save(); return { text: hit.text, sources: hit.sources, via: "learned" }; }
  let web = null;
  if (ctx.online !== false && !(mine.length >= 2 && /\b(price|cost|how much|address|located|open|hours|available|do you (sell|have|offer))\b/i.test(q))) {
    web = hit && Date.now() - hit.t < (TTL[hit.kind] || TTL.ans) ? hit : await lookup(q);
    if (web) store.stats.online++;
  }
  let out = null;
  if (llmReady()) {
    const sys = "You are Letschat AI" + (ctx.persona ? ", the assistant of " + ctx.persona : "") + ", inside a chat app used mainly in Africa (Nigeria). Be kind, polite and humble. Answer in plain text, at most 3 short sentences, no markdown. " +
      "Use the FACTS and WEB NOTES below. If they do not cover the question, say you are not fully sure" + (ctx.persona ? " and that " + ctx.persona + " will confirm" : "") + ". Never invent prices, availability, addresses or phone numbers. Never ask for or share passwords, codes or bank details." +
      ((ctx.instructions || []).length ? " Owner instructions: " + ctx.instructions.slice(0, 12).join(" | ") : "");
    const body = (mine.length ? "FACTS:\n- " + mine.join("\n- ") + "\n" : "") + (web ? "WEB NOTES (" + (web.sources || []).join(", ") + "): " + web.text + "\n" : "") + "QUESTION: " + scrub(q);
    let r = null;
    try { r = await chat([{ role: "system", content: sys }, { role: "user", content: body }], { max: 260 }); } catch (e) { noteErr("chat", e && e.message || e); }
    if (!r) console.error("[ai] every provider failed for this question; see lastErrors in aiStatus()");
    if (r) { out = { text: r.text, sources: web ? web.sources || [] : [], via: r.by }; store.stats.llm++; }
  }
  if (!out) {
    if (mine.length) out = { text: clip(mine.slice(0, 2).map((x) => x.replace(/^(Item|Market item|About|Owner name|Learned online \([^)]*\)): /, "").replace(/ - price /, ", price ")).join(". ").replace(/\.\./g, "."), 360), sources: [], via: "knowledge" };
    else if (web) out = { text: web.text, sources: web.sources || [], via: web.kind };
  }
  if (!out) {
    remember(q, null);
    // never leave the person with a dead end: say honestly that this could not be confirmed
    return { text: "I could not confirm that right now" + (ctx.persona ? ", but " + ctx.persona + " will be able to help you" : ". Please try again shortly or ask in a different way") + ".", sources: [], via: "fallback" };
  }
  store.stats.answered++;
  remember(q, web && !mine.length ? web : null);
  return out;
}

// ---------- self-learning loop: it keeps itself fed ----------
async function refresh() {
  try {
    await loadNews(true); // always pull fresh headlines
    const top = Object.keys(store.asked).sort((a, b) => store.asked[b].n - store.asked[a].n).slice(0, 12);
    for (const k of top) {
      const e = store.entries[k], need = !e || Date.now() - e.t > (TTL[e.kind] || TTL.ans) * 0.8;
      if (!need) continue;
      const r = await lookup(store.asked[k].q); // popular questions are re-sourced so the next answer is fresh and instant
      if (r) { store.entries[k] = { q: store.asked[k].q, text: r.text, sources: r.sources, kind: r.kind, t: Date.now(), n: (e && e.n) || 1 }; store.stats.refreshed++; }
    }
    for (const k of Object.keys(store.entries)) { const e = store.entries[k]; if (e.n <= 1 && Date.now() - e.t > 14 * DAY) delete store.entries[k]; } // forget one-off questions
    store.stats.learnedAt = Date.now();
    save();
  } catch (e) { console.error("knowledge refresh failed:", e.message); }
}
let started = false;
function start() {
  if (started) return; started = true;
  const h = setInterval(checkAll, 5 * 60 * 1000), h0 = setTimeout(checkAll, 3000); // keep all AI providers checked and online
  if (h.unref) h.unref(); if (h0.unref) h0.unref();
  const a = setInterval(refresh, 45 * 60 * 1000), b = setTimeout(refresh, 20000);
  if (a.unref) a.unref(); if (b.unref) b.unref();
}
function stats() {
  return {
    ...store.stats, entries: Object.keys(store.entries).length, topics: Object.keys(store.asked).length, headlines: store.news.items.length,
    ai: providers().map((p) => p.n), top: Object.values(store.asked).sort((a, b) => b.n - a.n).slice(0, 10).map((x) => ({ q: x.q, n: x.n })),
  };
}
module.exports = { checkAll, pickSentence, geminiSearch, answer, lookup, lookupAll, loadNews, refresh, start, stats, llmReady, aiStatus, isQuestion, scrub, tokens, topFacts, chat, _store: () => store };
