"use strict";
// Nigerian news for LetsChat AI: latest news, gist (jist), gossip, trending, dark/crime/scandal stories, sports and football.
// Sources: Nigerian newspapers and blogs (RSS) plus Google News searches for each category. Free, no key. A feed that is down is skipped.
// Refreshed every 30 minutes; the bot answers news questions from this fresh copy and can share the story links.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "data", "news-ng.json");
const GN = (q) => "https://news.google.com/rss/search?hl=en-NG&gl=NG&ceid=NG:en&q=" + encodeURIComponent(q);
// "dark" = the heavy side of the news: crime, scams, scandals, disasters, controversies
const CATS = {
  latest:   { label: "Latest Nigerian news", feeds: ["https://punchng.com/feed/", "https://www.vanguardngr.com/feed/", "https://guardian.ng/feed/", "https://www.premiumtimesng.com/feed", "https://www.channelstv.com/feed/", "https://dailypost.ng/feed/", GN("Nigeria latest news when:1d")] },
  gist:     { label: "Nigerian gist (jist)", feeds: ["https://www.legit.ng/rss/all.rss", "https://www.lindaikejisblog.com/feeds/posts/default?alt=rss", GN("Nigeria gist OR viral OR trending when:2d")] },
  gossip:   { label: "Nigerian gossip and entertainment", feeds: ["https://www.lindaikejisblog.com/feeds/posts/default?alt=rss", "https://www.bellanaija.com/feed/", GN("Nigeria celebrity gossip OR Nollywood OR Davido OR Wizkid when:3d")] },
  trending: { label: "Trending in Nigeria", feeds: [GN("Nigeria trending now when:1d"), GN("Nigerians react viral when:2d"), "https://www.legit.ng/rss/all.rss"] },
  dark:     { label: "Crime, scams and scandal", feeds: [GN("Nigeria crime OR murder OR kidnapping OR scandal when:2d"), GN("Nigeria fraud OR scam OR arrested OR court when:2d"), "https://dailypost.ng/feed/"] },
  tech:     { label: "Technology news (world and Africa)", feeds: ["https://techcabal.com/feed/", "https://techpoint.africa/feed/", "https://techcrunch.com/feed/", "https://www.theverge.com/rss/index.xml", "https://feeds.arstechnica.com/arstechnica/index", "https://feeds.bbci.co.uk/news/technology/rss.xml", GN("technology OR gadgets OR startups OR cybersecurity when:2d")] },
  ai:       { label: "Artificial intelligence news", feeds: ["https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "https://venturebeat.com/category/ai/feed/", "https://techcrunch.com/category/artificial-intelligence/feed/", GN("artificial intelligence OR OpenAI OR Anthropic OR Gemini OR DeepSeek OR LLM when:2d"), GN("AI model release OR AI chips OR Nvidia when:3d")] },
  sportsworld: { label: "World sport (NBA, F1, tennis, boxing, athletics, Olympics)", feeds: ["https://feeds.bbci.co.uk/sport/rss.xml", "https://www.espn.com/espn/rss/news", GN("NBA OR Formula 1 OR tennis OR boxing OR athletics OR Olympics when:2d")] },
  sports:   { label: "Sports and football", feeds: ["https://feeds.bbci.co.uk/sport/football/rss.xml", "https://www.completesports.com/feed/", GN("Super Eagles OR NPFL OR Premier League OR Champions League when:2d"), GN("football transfer news when:2d")] },
};
const MATCH = [
  ["ai", /\b(artificial intelligence|ai|chatgpt|openai|anthropic|claude|gemini|grok|llms?|machine learning|deepseek|copilot|midjourney|generative)\b/i],
  ["tech", /\b(tech|technology|gadgets?|smartphones?|iphone|android|samsung|apple|google|microsoft|nvidia|startups?|software|cyber ?security|hackers?|hacked|bitcoin|crypto|5g|starlink|electric vehicles?|robots?|quantum|semiconductors?|chips?)\b/i],
  ["sportsworld", /\b(nba|basketball|formula ?1|f1|tennis|wimbledon|boxing|ufc|mma|athletics|olympics?|cricket|rugby|golf|nfl)\b/i],
  ["dark", /\b(dark|crime|criminal|murder|kill(ed|ing)?|kidnap\w*|robber\w*|scandal|scam|fraud|arrest\w*|court|rape|cult|ritual|accident|crash|disaster|shocking|sad news|tragic|tragedy)\b/i],
  ["sports", /\b(sports?|football|soccer|super eagles|npfl|premier league|epl|la liga|champions league|chelsea|arsenal|man(chester)? (united|city)|liverpool|barcelona|real madrid|transfer|match|fixture|score|afcon|world cup|nba|boxing|ufc|tennis|athletics)\b/i],
  ["gossip", /\b(gossip|celebrity|celeb|nollywood|bbnaija|big brother|davido|wizkid|burna|rema|tems|ayra|afrobeats?|entertainment|marriage|breakup|divorce|baby mama)\b/i],
  ["gist", /\b(gist|jist|gist me|what'?s the gist|wetin dey happen|wetin dey sup|gist us|yarns?|tea)\b/i],
  ["trending", /\b(trending|trend|viral|everybody (is )?talking|hot topic|buzz)\b/i],
  ["latest", /\b(news|headlines?|latest|breaking|happening|update)\b.*\b(nigeria|naija|abuja|lagos|tinubu|npc|inec|naira|nigerian)\b|\b(nigeria|naija|nigerian)\b.*\b(news|headlines?|latest|breaking|update)\b|\bnaija news\b/i],
];
const NEWSY = /\b(news|headlines?|breaking|latest|gist|jist|gossip|trending|viral|scandal|happening|score|result|fixture|transfer|today|yesterday|this week|tonight)\b/i;

let store = { t: 0, cats: {} };
try { const j = JSON.parse(fs.readFileSync(FILE, "utf-8")); if (j && j.cats) store = j; } catch (e) { /* first run */ }
let saveT = null;
function save() {
  if (saveT) return;
  saveT = setTimeout(() => { saveT = null; try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(store)); } catch (e) { /* read-only disk: it refetches */ } }, 3000);
  if (saveT.unref) saveT.unref();
}

const unx = (s) => String(s || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;|&#8217;/g, "'").replace(/&quot;|&#8220;|&#8221;/g, '"').replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };

async function getText(url, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 LetschatAI/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
// RSS 2.0 (<item>) and Atom (<entry>)
function parse(xml, host) {
  const out = [];
  for (const it of (String(xml).match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) || []).slice(0, 12)) {
    const title = unx((/<title[^>]*>([\s\S]*?)<\/title>/.exec(it) || [])[1]);
    let link = unx((/<link[^>]*>([\s\S]*?)<\/link>/.exec(it) || [])[1]);
    if (!link) link = ((/<link[^>]*href="([^"]+)"/.exec(it) || [])[1] || "").replace(/&amp;/g, "&");
    const desc = unx((/<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/.exec(it) || [])[1]);
    const when = Date.parse(unx((/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/.exec(it) || [])[1])) || 0;
    const src = unx((/<source[^>]*>([\s\S]*?)<\/source>/.exec(it) || [])[1]) || host;
    // Google News puts "Headline - Source" in the title
    const clean = title.replace(new RegExp("\\s+-\\s+" + src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "");
    if (clean && link) out.push({ title: clip(clean, 160), desc: clip(desc.replace(/^\s*\S*\s*-\s*/, ""), 200), link, src, time: when });
  }
  return out;
}
async function fetchFeed(url) {
  let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { /* ignore */ }
  try { return parse(await getText(url), host); } catch (e) { return []; }
}
async function refreshCat(cat) {
  const lists = await Promise.all(CATS[cat].feeds.map(fetchFeed));
  const seen = new Set(), items = [];
  for (const l of lists) for (const x of l) { const k = x.title.toLowerCase().slice(0, 60); if (!seen.has(k)) { seen.add(k); items.push(x); } }
  items.sort((a, b) => (b.time || 0) - (a.time || 0));
  if (items.length) store.cats[cat] = { t: Date.now(), items: items.slice(0, 30) };
}
let refreshing = null;
async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try { for (const c of Object.keys(CATS)) await refreshCat(c); store.t = Date.now(); save(); } catch (e) { console.error("news refresh failed:", e.message); } finally { refreshing = null; }
  })();
  return refreshing;
}
let started = false;
function start() {
  if (started) return; started = true;
  const a = setInterval(refresh, 30 * 60 * 1000), b = setTimeout(refresh, 15000);
  if (a.unref) a.unref(); if (b.unref) b.unref();
}

// which news categories does this message ask for? (empty = it is not a news question)
function detect(text) {
  const t = String(text || "");
  let cats = MATCH.filter(([, re]) => re.test(t)).map(([c]) => c);
  // tech, AI and world-sport categories only answer "news" style questions, so "how does AI work?" is not turned into a headline list
  if (!/\b(news|headlines?|latest|new(est)?|updates?|launch(ed|es)?|releases?|released|announce[sd]?|breaking|today|yesterday|this week|just|happening|trending|results?|scores?|fixtures?)\b/i.test(t)) cats = cats.filter((c) => !["ai", "tech", "sportsworld"].includes(c));
  if (!cats.length && /\b(nigeria|naija|nigerian)\b/i.test(t) && NEWSY.test(t)) cats.push("latest");
  if (!cats.length && /\b(wetin dey happen|any (news|gist)|what'?s (new|happening)|gist me)\b/i.test(t)) cats.push("gist");
  return [...new Set(cats)].slice(0, 3);
}
async function top(cat, n) {
  const c = store.cats[cat];
  if (!c || Date.now() - c.t > 60 * 60 * 1000) { try { await refreshCat(cat); } catch (e) { /* use the old copy */ } }
  return ((store.cats[cat] || {}).items || []).slice(0, n || 6);
}
// free-text news search ("what happened to X"): Google News headlines for the words in the question
async function search(q, n) {
  const words = String(q || "").replace(/[^\w\s'-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  if (words.length < 3) return [];
  return (await fetchFeed(GN(words + " when:7d"))).slice(0, n || 5);
}
const when = (ms) => { if (!ms) return ""; const h = Math.round((Date.now() - ms) / 36e5); return h < 1 ? "just now" : h < 24 ? h + "h ago" : Math.round(h / 24) + "d ago"; };
// notes for the AI prompt (headline, source, age, link)
function notes(items) { return items.map((x) => "- " + x.title + " (" + x.src + (x.time ? ", " + when(x.time) : "") + ") " + x.link).join("\n"); }
const labels = () => Object.fromEntries(Object.entries(CATS).map(([k, v]) => [k, v.label]));
function stats() { return { updated: store.t, cats: Object.fromEntries(Object.keys(CATS).map((k) => [k, ((store.cats[k] || {}).items || []).length])) }; }
module.exports = { start, refresh, detect, top, search, notes, labels, stats, when, CATS };
