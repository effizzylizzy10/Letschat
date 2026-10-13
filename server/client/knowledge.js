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
async function ddg(q) {
  const j = await getJson("https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&no_redirect=1&q=" + enc(q));
  const t = j.Answer || j.AbstractText || ((j.RelatedTopics || []).find((x) => x && x.Text) || {}).Text;
  if (!t) return null;
  return { text: clip(t, 450), sources: [String(j.AbstractURL || "duckduckgo.com").replace(/^https?:\/\//, "").split("/")[0]], kind: "ddg" };
}
async function wiki(q) {
  const subj = subject(q); if (subj.length < 2) return null;
  const s = await getJson("https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=" + enc(subj));
  const hit = s.query && s.query.search && s.query.search[0]; if (!hit) return null;
  const sum = await getJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + enc(hit.title.replace(/ /g, "_")));
  if (!sum.extract || sum.type === "disambiguation") return null;
  return { text: clip(sum.extract, 520), sources: ["en.wikipedia.org"], kind: "wiki" };
}
const safe = (p) => p.catch(() => null);
// one lookup for any question: the most specific source first, then general search in parallel
async function lookup(question) {
  const q = scrub(question); if (q.length < 3) return null;
  const loc = localAnswer(q); if (loc) return loc;
  for (const fn of [weather, fx, define, news]) { const r = await safe(fn(q)); if (r) return r; }
  const [a, b] = await Promise.all([safe(ddg(subject(q) || q)), safe(wiki(q))]);
  return a && a.kind === "ddg" && (b ? a.text.length >= 60 : true) ? a : b || a;
}

// ---------- free AI (optional) ----------
// Free AI providers (OpenAI-compatible chat/completions). Each one is used only when its key is set in Render > Environment; they are tried in order and
// a provider that is out of quota or down is skipped for a few minutes, so one failing key never slows the robot down.
//   GEMINI_API_KEY  GROQ_API_KEY  OPENROUTER_API_KEY (+ OPENROUTER_API_KEY_2, OPENROUTER_API_KEY_3 = separate free quotas)
//   TOGETHER_API_KEY  HF_API_KEY  SAMBANOVA_API_KEY  CLOUDFLARE_API_KEY + CLOUDFLARE_ACCOUNT_ID   or AI_API_KEY + AI_BASE_URL + AI_MODEL (any OpenAI-compatible)
// Models can be changed with <NAME>_MODEL (e.g. GROQ_MODEL).
function providers() {
  const p = [], add = (n, url, key, model) => { if (key && url) p.push({ n, url, key, model }); };
  add("custom", E.AI_BASE_URL, E.AI_API_KEY, E.AI_MODEL || "default");
  add("gemini", "https://generativelanguage.googleapis.com/v1beta/openai", E.GEMINI_API_KEY, E.GEMINI_MODEL || "gemini-2.5-flash");
  add("groq", "https://api.groq.com/openai/v1", E.GROQ_API_KEY, E.GROQ_MODEL || "llama-3.1-8b-instant");
  add("openrouter", "https://openrouter.ai/api/v1", E.OPENROUTER_API_KEY, E.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free");
  add("openrouter2", "https://openrouter.ai/api/v1", E.OPENROUTER_API_KEY_2, E.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free");
  add("openrouter3", "https://openrouter.ai/api/v1", E.OPENROUTER_API_KEY_3, E.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free");
  add("together", "https://api.together.xyz/v1", E.TOGETHER_API_KEY, E.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free");
  add("huggingface", "https://router.huggingface.co/v1", E.HF_API_KEY, E.HF_MODEL || "Qwen/Qwen2.5-72B-Instruct");
  add("sambanova", "https://api.sambanova.ai/v1", E.SAMBANOVA_API_KEY, E.SAMBANOVA_MODEL || "Meta-Llama-3.3-70B-Instruct");
  if (E.CLOUDFLARE_API_KEY && E.CLOUDFLARE_ACCOUNT_ID) add("cloudflare", "https://api.cloudflare.com/client/v4/accounts/" + E.CLOUDFLARE_ACCOUNT_ID + "/ai/v1", E.CLOUDFLARE_API_KEY, E.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct");
  return p;
}
const llmReady = () => providers().length > 0;
const cooldown = new Map(); // provider name -> time until it is tried again after a failure
async function chat(messages, opt) {
  const t0 = Date.now(), budget = (opt && opt.budget) || 45000;
  for (const p of providers()) {
    if (Date.now() - t0 > budget) break;
    if ((cooldown.get(p.n) || 0) > Date.now()) continue;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), (opt && opt.timeout) || 14000);
    try {
      const r = await fetch(p.url.replace(/\/$/, "") + "/chat/completions", {
        method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.key, ...(p.n === "gemini" ? { "x-goog-api-key": p.key } : {}) },
        body: JSON.stringify({ model: p.model, messages, max_tokens: (opt && opt.max) || 300, temperature: opt && opt.temp != null ? opt.temp : 0.3 }),
      });
      if (!r.ok) { cooldown.set(p.n, Date.now() + (r.status === 429 || r.status === 402 ? 10 * 60 * 1000 : r.status === 401 || r.status === 403 ? 60 * 60 * 1000 : 2 * 60 * 1000)); throw new Error("HTTP " + r.status); }
      const j = await r.json(), txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (txt && txt.trim()) return { text: txt.trim(), by: p.n };
    } catch (e) { if (!cooldown.get(p.n) || cooldown.get(p.n) < Date.now()) cooldown.set(p.n, Date.now() + 60 * 1000); /* try the next provider */ } finally { clearTimeout(t); }
  }
  return null;
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
    const r = await chat([{ role: "system", content: sys }, { role: "user", content: body }], { max: 260 });
    if (r) { out = { text: r.text, sources: web ? web.sources || [] : [], via: r.by }; store.stats.llm++; }
  }
  if (!out) {
    if (mine.length) out = { text: clip(mine.slice(0, 2).map((x) => x.replace(/^(Item|Market item|About|Owner name|Learned online \([^)]*\)): /, "").replace(/ - price /, ", price ")).join(". ").replace(/\.\./g, "."), 360), sources: [], via: "knowledge" };
    else if (web) out = { text: web.text, sources: web.sources || [], via: web.kind };
  }
  if (!out) { remember(q, null); return null; }
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
  const a = setInterval(refresh, 45 * 60 * 1000), b = setTimeout(refresh, 20000);
  if (a.unref) a.unref(); if (b.unref) b.unref();
}
function stats() {
  return {
    ...store.stats, entries: Object.keys(store.entries).length, topics: Object.keys(store.asked).length, headlines: store.news.items.length,
    ai: providers().map((p) => p.n), top: Object.values(store.asked).sort((a, b) => b.n - a.n).slice(0, 10).map((x) => ({ q: x.q, n: x.n })),
  };
}
module.exports = { answer, lookup, loadNews, refresh, start, stats, llmReady, isQuestion, scrub, tokens, topFacts, chat, _store: () => store };
