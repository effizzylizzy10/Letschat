# Live sports scores for LetsChat AI

Files changed: `server/client/scores.js` (new), `server/client/bot.js`, `server/client/server.js`.

- Source: ESPN public scoreboard/standings JSON (free, no key). BBC Sport and premierleague.com have no public scores API, so the AI notes link to BBC's scores page as a second place to check.
- Leagues: Premier League, Champions/Europa League, La Liga, Serie A, Bundesliga, Ligue 1, FA/Carabao Cup, AFCON, CAF World Cup qualifiers, World Cup, MLS, NBA. Add more in `LEAGUES` in scores.js (ESPN path + words people use).
- Window: 2 days back to 2 days ahead. Cache: 45 s while a match is live, 5 min otherwise.
- Both the main LetsChat AI robot (bot.js) and the plain AI page (/api/bot/chat) receive the notes when a message is about scores, fixtures, results or a table. The AI is told to use only those notes and to say "could not confirm" if the team is not in them.
- Nothing to configure. If ESPN is down the AI answers from news headlines as before.
- To use a paid feed later (API-Football, Sportmonks), replace `league()` in scores.js; the rest stays the same.
