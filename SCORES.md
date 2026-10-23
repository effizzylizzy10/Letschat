# Live sports scores for LetsChat AI

Files changed: `server/client/scores.js` (new), `server/client/bot.js`, `server/client/server.js`.

- Source: ESPN public scoreboard/standings JSON (free, no key). BBC Sport and premierleague.com have no public scores API, so the AI notes link to BBC's scores page as a second place to check.
- Leagues: Premier League, Champions/Europa League, La Liga, Serie A, Bundesliga, Ligue 1, FA/Carabao Cup, AFCON, CAF World Cup qualifiers, World Cup, MLS, NBA. Add more in `LEAGUES` in scores.js (ESPN path + words people use).
- Window: 5 days back to 3 days ahead. Cache: 45 s while a match is live, 5 min otherwise.
- Both the main LetsChat AI robot (bot.js) and the plain AI page (/api/bot/chat) receive the notes when a message is about scores, fixtures, results or a table. The AI is told to use only those notes and to say "could not confirm" if the team is not in them.
- Nothing to configure. If ESPN is down the AI answers from news headlines as before.
- To use a paid feed later (API-Football, Sportmonks), replace `league()` in scores.js; the rest stays the same.
- Backup source: if ESPN returns nothing for a league, TheSportsDB (free test key) supplies results and fixtures for the week (not minute-by-minute live).
- Health check: open `https://YOUR-SERVER/api/v1/scores/status` in a browser. It shows the Node version, whether ESPN answered (or the error), and sample matches. Fetch errors are also written to the server log as "scores: could not fetch ...".

## Automatic web fallback (added)
- Order: ESPN live feed > TheSportsDB (results/fixtures) > **web check** > Google News headlines. The web check uses your existing Gemini key with Google Search, which reads live-score sites (BBC Sport, ESPN, Flashscore, Sofascore, LiveScore), news and blogs. It runs only when the feeds do not have the team or match asked about. Cached 90 s.
- Typos in team names are tolerated ("renes" finds Rennes, "mlmanchester united" finds Manchester United).
- More leagues: Conference League, Eredivisie, Primeira Liga, Super Lig are checked by default.
- If nothing is found anywhere, the AI is told to say so plainly and point to BBC Sport instead of guessing.

## Day-aware fix (latest)
- General questions ("today's live score", "yesterday's results", "tomorrow's fixtures") now check every league in the list, not only the first one. Before, a question with no team or league named could come back empty and the AI said it could not confirm.
- Days and times are shown in Africa/Lagos time (WAT). Each answer lists LIVE NOW, then the day's RESULTS and FIXTURES, or RECENT RESULTS and UPCOMING when that day has none.
- The web check runs only when the feeds cannot answer, so general questions no longer trigger a search each time.
- Duplicate matches from two feeds are shown once.
