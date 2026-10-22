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
  nba:   { path: "basketball/nba", label: "NBA", re: /\b(nba|basketball)\b/i },
};
// when the question names no league, these are checked (and searched for the team named)
const DEFAULT = ["epl", "ucl", "laliga", "seriea", "bund", "ligue1", "uel"];

// STRONG words are about sport on their own; WEAK words ("results", "score", "won") only count when a league or a team from today's data is named,
// so "my exam results" or "what is the score of my loan" are left alone.
const STRONG = /\b(live ?scores?|who won|kick ?off|full ?time|half ?time|league table|standings?|fixtures?|playing (today|tonight|now)|(matches|games) (today|tonight))\b/i;
const WEAK = /\b(scores?|results?|table|log|points|win|won|lost|lose|draw|drew|beat|match|matches|game|games|playing|played|today|tonight|yesterday|now|live|next|latest)\b/i;
const TABLEY = /\b(table|standings?|log|top of the league|points|who is leading|who'?s leading|position)\b/i;

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
  return { leagues: leagues.length ? leagues : DEFAULT, named: leagues.length > 0, strong, table: TABLEY.test(t), text: normName(t) };
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
  const word = (name) => normName(name).split(" ").some((w) => w.length > 4 && !NOISE.has(w) && t.includes(w));
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

// main entry: returns plain-text notes for the AI prompt, or "" when nothing could be fetched
async function notes(req) {
  if (!req) return "";
  try {
    const lists = await Promise.all(req.leagues.map((k) => league(k).catch(() => [])));
    let events = lists.flat();
    const sections = [];
    const mine = req.named ? [] : teamHits(events, req.text);
    let asked;
    if (req.named) asked = events;
    else if (mine.length) asked = mine;
    else if (req.strong) { const lv = events.filter((e) => e.state === "in"); asked = lv.length ? lv : events.filter((e) => e.key === (events[0] || {}).key); }
    else {
      // a weak word with no league or team named: only a clear sports question ("score" + "match") gets a "not found" note; anything else is ignored
      const sporty = (req.text.match(/\b(score|scores|match|matches|game|games|won|lost|beat|played|playing|result|results|fixture|league|cup)\b/g) || []).length;
      if (sporty < 2 || /\b(exam|test|school|loan|credit|grade|class|quiz)\b/.test(req.text)) return "";
      return "LIVE SCORES (checked " + hm(Date.now()) + " " + TZ_NOTE + "): no match for the team or league in this question was found in the last 5 days or the next 3 days (" + req.leagues.map((k) => LEAGUES[k].label).join(", ") + "). Say this plainly, do not guess a score from memory, ask them to check the spelling or name the league, and mention " + BBC + ".";
    }
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
    if (!sections.length) return "";
    return "LIVE SCORES (data fetched " + hm(Date.now()) + " " + TZ_NOTE + "; times are " + TZ_NOTE + "; also check " + BBC + "):\n" + sections.join("\n\n");
  } catch (e) { return ""; }
}

module.exports = { detect, notes, status, league, parseEvents, teamHits, LEAGUES };
