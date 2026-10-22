"use strict";
// Live sports scores for LetsChat AI: live games, today's fixtures, recent results and league tables.
// Source: ESPN's public scoreboard JSON (free, no key). A league that is down is skipped, so the AI says "I could not confirm"
// instead of guessing. Cached 45 s while a game is live and 5 min otherwise, so many users asking at once cost one request.
// BBC Sport has no public scores API (its pages are for browsers), so the notes link to BBC's scores page as the second place to check.
const BASE = "https://site.api.espn.com/apis/site/v2/sports/";
const BASE_V2 = "https://site.api.espn.com/apis/v2/sports/";
const BBC = "https://www.bbc.com/sport/football/scores-fixtures";

// key -> ESPN path, label, words people use for it
const LEAGUES = {
  epl:   { path: "soccer/eng.1", label: "Premier League", sdb: "4328", re: /\b(premier league|epl|english premier)\b/i, table: true },
  ucl:   { path: "soccer/uefa.champions", label: "Champions League", sdb: "4480", re: /\b(champions league|ucl)\b/i },
  uel:   { path: "soccer/uefa.europa", label: "Europa League", sdb: "4481", re: /\b(europa league|uel)\b/i },
  laliga:{ path: "soccer/esp.1", label: "La Liga", sdb: "4335", re: /\b(la ?liga|spanish league)\b/i, table: true },
  seriea:{ path: "soccer/ita.1", label: "Serie A", sdb: "4332", re: /\b(serie a|italian league)\b/i, table: true },
  bund:  { path: "soccer/ger.1", label: "Bundesliga", sdb: "4331", re: /\b(bundesliga|german league)\b/i, table: true },
  ligue1:{ path: "soccer/fra.1", label: "Ligue 1", sdb: "4334", re: /\b(ligue 1|french league)\b/i, table: true },
  facup: { path: "soccer/eng.fa", label: "FA Cup", re: /\b(fa cup)\b/i },
  carabao:{ path: "soccer/eng.league_cup", label: "Carabao Cup", re: /\b(carabao|league cup|efl cup)\b/i },
  afcon: { path: "soccer/caf.nations", label: "Africa Cup of Nations", re: /\b(afcon|africa cup of nations|africa cup)\b/i },
  wcq:   { path: "soccer/fifa.worldq.caf", label: "World Cup qualifiers (CAF)", re: /\b(world cup qualifier|wcq|qualifiers?|super eagles)\b/i },
  wc:    { path: "soccer/fifa.world", label: "World Cup", re: /\b(world cup)\b/i },
  mls:   { path: "soccer/usa.1", label: "MLS", re: /\b(mls)\b/i },
  uecl:  { path: "soccer/uefa.europa.conf", label: "Conference League", re: /\b(conference league|uecl)\b/i },
  ned:   { path: "soccer/ned.1", label: "Eredivisie", re: /\b(eredivisie|dutch league)\b/i, table: true },
  por:   { path: "soccer/por.1", label: "Primeira Liga", re: /\b(primeira liga|portuguese league|liga portugal)\b/i, table: true },
  tur:   { path: "soccer/tur.1", label: "Super Lig", re: /\b(super lig|turkish league)\b/i, table: true },
  nba:   { path: "basketball/nba", label: "NBA", re: /\b(nba|basketball)\b/i },
};
// when the question names no league, these are checked (and searched for the team named)
const DEFAULT = ["epl", "ucl", "uel", "uecl", "laliga", "seriea", "bund", "ligue1", "ned", "por", "tur"];

// STRONG words are about sport on their own; WEAK words ("results", "score", "won") only count when a league or a team from today's data is named,
// so "my exam results" or "what is the score of my loan" are left alone.
const STRONG = /\b(live ?scores?|who won|kick ?off|full ?time|half ?time|league table|standings?|fixtures?|playing (today|tonight|now)|(matches|games) (today|tonight))\b/i;
const WEAK = /\b(scores?|vs|versus|results?|table|log|points|win|won|lost|lose|draw|drew|beat|match|matches|game|games|playing|played|today|tonight|yesterday|now|live|next|latest)\b/i;
const TABLEY = /\b(table|standings?|log|top of the league|points|who is leading|who'?s leading|position)\b/i;

let HELP = { KB: null, News: null };
function attach(h) { HELP = Object.assign(HELP, h || {}); }

const cache = new Map(); // url -> { t, ttl, data }
const errs = new Map(); // url -> last error text (shown by status(), and logged once a minute)
let lastLog = 0;
async function getJSON(url, ms) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < hit.ttl) return hit.data;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 7000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 LetschatAI/1.0", Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    const live = JSON.stringify(data).includes('"state":"in"');
    cache.set(url, { t: Date.now(), ttl: live ? 45e3 : 5 * 60e3, data });
    if (cache.size > 80) cache.delete(cache.keys().next().value);
    errs.delete(url);
    return data;
  } catch (e) {
    const why = (e && e.name === "AbortError") ? "timed out" : (e && e.message) || String(e);
    errs.set(url, why);
    if (Date.now() - lastLog > 60000) { lastLog = Date.now(); console.error("scores: could not fetch " + url + " (" + why + ")" + (typeof fetch !== "function" ? ". This Node version has no fetch: use Node 18 or newer" : "")); }
    return hit ? hit.data : null; // an older copy is better than nothing
  } finally { clearTimeout(timer); }
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
function range() { // 5 days back to 3 days ahead, so "yesterday's result", "last weekend" and "tomorrow's fixture" all work
  const now = Date.now(), a = new Date(now - 2 * 864e5), b = new Date(now + 2 * 864e5);
  return "?dates=" + ymd(a) + "-" + ymd(b) + "&limit=100";
}

// ESPN event -> small plain object
function parseEvents(json) {
  const out = [];
  for (const ev of (json && json.events) || []) {
    const comp = (ev.competitions || [])[0]; if (!comp) continue;
    const home = (comp.competitors || []).find((c) => c.homeAway === "home") || (comp.competitors || [])[0];
    const away = (comp.competitors || []).find((c) => c.homeAway === "away") || (comp.competitors || [])[1];
    if (!home || !away) continue;
    const st = (ev.status && ev.status.type) || {};
    out.push({
      id: ev.id,
      time: Date.parse(ev.date) || 0,
      state: st.state || "pre", // pre | in | post
      detail: st.shortDetail || st.detail || "",
      clock: (ev.status && ev.status.displayClock) || "",
      home: (home.team && (home.team.displayName || home.team.name)) || "?",
      away: (away.team && (away.team.displayName || away.team.name)) || "?",
      hs: home.score != null ? String(home.score) : "",
      as: away.score != null ? String(away.score) : "",
      completed: !!st.completed,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

// second source when ESPN gives nothing: TheSportsDB free test key (finished results and next fixtures, not minute-by-minute live)
async function sportsDb(key) {
  const L = LEAGUES[key]; if (!L || !L.sdb) return [];
  const [past, next] = await Promise.all(["eventspastleague", "eventsnextleague"].map((p) => getJSON("https://www.thesportsdb.com/api/v1/json/3/" + p + ".php?id=" + L.sdb)));
  const out = [];
  for (const ev of [...((past || {}).events || []), ...((next || {}).events || [])]) {
    const time = Date.parse((ev.dateEvent || "") + "T" + ((ev.strTime || "00:00:00").slice(0, 8)) + "Z") || Date.parse(ev.dateEvent) || 0;
    const done = ev.intHomeScore != null && ev.intHomeScore !== "" && ev.intAwayScore != null && ev.intAwayScore !== "";
    if (!ev.strHomeTeam || !ev.strAwayTeam) continue;
    if (time && Math.abs(time - Date.now()) > 5 * 864e5) continue; // only about this week
    out.push({ id: ev.idEvent, time, state: done ? "post" : "pre", detail: ev.strStatus || "", clock: "", home: ev.strHomeTeam, away: ev.strAwayTeam, hs: done ? String(ev.intHomeScore) : "", as: done ? String(ev.intAwayScore) : "", completed: done, league: L.label, key });
  }
  return out.sort((a, b) => a.time - b.time);
}

async function league(key) {
  const L = LEAGUES[key]; if (!L) return [];
  const json = await getJSON(BASE + L.path + "/scoreboard" + range());
  const ev = parseEvents(json).map((e) => ({ ...e, league: L.label, key }));
  if (ev.length) return ev;
  try { return await sportsDb(key); } catch (e) { return []; }
}

// quick health check for the owner: open /api/v1/scores/status in a browser
async function status() {
  const url = BASE + "soccer/eng.1/scoreboard" + range();
  cache.delete(url);
  const json = await getJSON(url, 9000);
  const ev = parseEvents(json);
  return { node: process.version, hasFetch: typeof fetch === "function", espnOk: !!json, espnError: errs.get(url) || null, premierLeagueMatchesInWindow: ev.length, live: ev.filter((e) => e.state === "in").length, sample: ev.slice(-3).map(line0), time: new Date().toISOString() };
}
const line0 = (e) => e.home + " " + e.hs + "-" + e.as + " " + e.away + " (" + e.state + ")";

// ---- which leagues / which team is this message about? ----
const normName = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const NOISE = new Set("fc afc cf the united city town real club sporting".split(" "));
const ALIAS = { "man utd": "manchester united", "man united": "manchester united", "man city": "manchester city", spurs: "tottenham hotspur", "newcastle": "newcastle united", wolves: "wolverhampton wanderers", "west ham": "west ham united", barca: "barcelona", madrid: "real madrid", atletico: "atletico madrid", bayern: "bayern munich", psg: "paris saint germain", inter: "inter milan", juve: "juventus", "super eagles": "nigeria" };

function detect(text) {
  const t = String(text || "");
  if (!t) return null;
  const leagues = Object.keys(LEAGUES).filter((k) => LEAGUES[k].re.test(t) && !(k === "wc" && /qualif/i.test(t)) && !(k === "wcq" && !/qualif|super eagles/i.test(t)));
  const strong = STRONG.test(t);
  if (!strong && !WEAK.test(t)) return null;
  return { leagues: leagues.length ? leagues : DEFAULT, named: leagues.length > 0, strong, table: TABLEY.test(t), text: normName(t), raw: t.slice(0, 200) };
}

function lev(a, b) { // edit distance, for typos
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function teamHits(events, text) {
  let t = " " + text + " ";
  for (const [a, b] of Object.entries(ALIAS)) if (t.includes(a)) t += " " + b + " ";
  const flat = t.replace(/ /g, "");
  // 1) the whole club name appears anywhere in the message (a typo glued to it, like "mlmanchester united", still counts)
  const full = (name) => { const n = normName(name); return n.length > 3 && (t.includes(n) || flat.includes(n.replace(/ /g, ""))); };
  const exact = events.filter((e) => full(e.home) || full(e.away));
  if (exact.length) return exact;
  // 2) otherwise a distinctive word of the club name (not "united", "city", "fc"...)
  const toks = t.split(" ").filter((x) => x.length > 3);
  const word = (name) => normName(name).split(" ").some((w) => w.length > 4 && !NOISE.has(w) && (t.includes(w) || toks.some((x) => Math.abs(x.length - w.length) <= 1 && lev(x, w) <= (w.length >= 7 ? 2 : 1))));
  return events.filter((e) => word(e.home) || word(e.away));
}

const TZ_NOTE = "UTC";
const hm = (ms) => new Date(ms).toISOString().slice(11, 16);
const day = (ms) => new Date(ms).toISOString().slice(5, 10).replace("-", "/"); // MM/DD
function line(e) {
  const when = e.state === "pre" ? "kick-off " + day(e.time) + " " + hm(e.time) + " " + TZ_NOTE
    : e.state === "in" ? "LIVE " + (e.clock || e.detail)
    : "FT " + day(e.time);
  const score = e.state === "pre" ? e.home + " vs " + e.away : e.home + " " + e.hs + "-" + e.as + " " + e.away;
  return "- [" + e.league + "] " + score + " (" + when + ")";
}

async function table(key) {
  const L = LEAGUES[key]; if (!L || !L.table) return "";
  const json = await getJSON(BASE_V2 + L.path + "/standings");
  const entries = ((((json || {}).children || [])[0] || {}).standings || {}).entries || [];
  if (!entries.length) return "";
  const stat = (e, n) => { const s = (e.stats || []).find((x) => x.name === n); return s ? s.displayValue != null ? s.displayValue : s.value : ""; };
  const rows = entries.map((e) => ({ r: Number(stat(e, "rank")) || 99, n: e.team && e.team.displayName, p: stat(e, "points"), gp: stat(e, "gamesPlayed"), gd: stat(e, "pointDifferential") }))
    .sort((a, b) => a.r - b.r).slice(0, 10);
  return L.label + " TABLE (top " + rows.length + "):\n" + rows.map((x) => x.r + ". " + x.n + " " + x.p + " pts, P" + x.gp + ", GD " + x.gd).join("\n");
}

const SPORT_WORDS = /\b(score|scores|match|matches|game|games|won|lost|beat|played|playing|result|results|fixture|league|cup|vs|versus|v)\b/g;
const NOT_SPORT = /\b(exam|test|school|loan|credit|grade|class|quiz)\b/;

// When the live feeds do not have the match (small league, cup tie, wrong spelling), read the web: Google-grounded search over live-score sites,
// news and blogs, then Google News headlines as the last resort. Cached 90 s so a busy match does not cost one search per user.
const webCache = new Map();
async function web(question) {
  const key = normName(question).slice(0, 120), hit = webCache.get(key);
  if (hit && Date.now() - hit.t < 90e3) return hit.v;
  let out = "";
  const when = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  try {
    if (HELP.KB && HELP.KB.geminiSearch) {
      const g = await HELP.KB.geminiSearch([
        { role: "system", content: "You check sports scores from live-score sites (BBC Sport, ESPN, Flashscore, Sofascore, LiveScore, official league and club sites), news and blogs. Today is " + when + ". Answer in at most 3 short lines: the two teams, the score, the status (live minute, full time, or kick-off time in UTC if not started), the competition and the date, then the site names you used. Fix obvious spelling mistakes in team names. Use only what the search shows. If you cannot find that match, reply exactly NOT FOUND." },
        { role: "user", content: question },
      ], { max: 400, temp: 0.1, timeout: 14000, accept: (x) => x.length > 8 && !/^\s*NOT FOUND/i.test(x) });
      if (g && g.text) out = "WEB CHECK (Google search of live-score sites, news and blogs, " + when + "):\n" + g.text.replace(/\n{2,}/g, "\n") + (g.links && g.links.length ? "\nSources: " + g.links.slice(0, 3).map((l) => l.title || l.uri).join("; ") : "");
    }
  } catch (e) { /* try headlines */ }
  if (!out && HELP.News && HELP.News.search) {
    try {
      const items = await HELP.News.search(question + " score", 5);
      if (items && items.length) out = "LATEST HEADLINES about this match (Google News, may include the score; read them for it):\n" + HELP.News.notes(items);
    } catch (e) { /* nothing */ }
  }
  webCache.set(key, { t: Date.now(), v: out });
  if (webCache.size > 60) webCache.delete(webCache.keys().next().value);
  return out;
}

// main entry: returns plain-text notes for the AI prompt, or "" when this is not a sports question
async function notes(req) {
  if (!req) return "";
  try {
    const lists = await Promise.all(req.leagues.map((k) => league(k).catch(() => [])));
    const events = lists.flat();
    const sections = [];
    const mine = req.named ? [] : teamHits(events, req.text);
    let asked;
    if (req.named) asked = events;
    else if (mine.length) asked = mine;
    else if (req.strong) { const lv = events.filter((e) => e.state === "in"); asked = lv.length ? lv : events.filter((e) => e.key === (events[0] || {}).key); }
    else asked = [];
    const sporty = (req.text.match(SPORT_WORDS) || []).length;
    const clearlySport = req.strong || req.named || mine.length > 0 || (sporty >= 2 && !NOT_SPORT.test(req.text));
    if (!clearlySport) return "";
    // priority: live now, then the closest-in-time results/fixtures
    const live = asked.filter((e) => e.state === "in");
    const done = asked.filter((e) => e.state === "post").slice(-8);
    const next = asked.filter((e) => e.state === "pre").slice(0, 8);
    if (live.length) sections.push("LIVE NOW:\n" + live.map(line).join("\n"));
    if (done.length) sections.push("RECENT RESULTS:\n" + done.map(line).join("\n"));
    if (next.length) sections.push("UPCOMING:\n" + next.map(line).join("\n"));
    if (req.table) {
      const keys = req.named ? req.leagues : [mine.length ? mine[0].key : "epl"];
      const tabs = (await Promise.all(keys.slice(0, 2).map((k) => table(k).catch(() => "")))).filter(Boolean);
      if (tabs.length) sections.push(tabs.join("\n"));
    }
    // the feeds did not have the team or match asked about: search the web
    const teamAsked = !req.named && !mine.length;
    let webText = "";
    if (teamAsked || !sections.length) webText = await web(req.raw || req.text);
    if (webText) sections.push(webText);
    if (!sections.length) return "LIVE SCORES (checked " + hm(Date.now()) + " " + TZ_NOTE + "): the live feeds and a web search found nothing for this match. Say so plainly, do not guess a score from memory, suggest checking the spelling or naming the league, and mention " + BBC + ".";
    return "LIVE SCORES (data fetched " + hm(Date.now()) + " " + TZ_NOTE + "; times are " + TZ_NOTE + "; also check " + BBC + "):\n" + sections.join("\n\n");
  } catch (e) { return ""; }
}

module.exports = { attach, detect, notes, status, league, parseEvents, teamHits, LEAGUES };
