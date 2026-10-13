# Letschat AI agent (self-learning, sources answers online)

Works like the WhatsApp Business agent: you talk to it, it learns, it answers your customers when you are offline.

## What it does
- **Chat with your agent**: open `/agent.html` on your website (same login as the app). Type instructions ("Always be kind, polite and humble"), facts ("Our shop is at ..."), or ask it a question to test it. Tabs: Chat, Instructions, Knowledge. Commands: `forget <words>`, `what do you know`, `<item> is available`.
- **Learns by itself**: reads your profile, your business catalogue and your Market posts, so it already knows your items and prices. `Source for properties in Lagos` makes it research online and save the result to Knowledge.
- **Sources information online every time** (free, no key): Wikipedia, DuckDuckGo, weather (Open-Meteo), exchange rates, dictionary, news headlines (BBC feeds, add yours with `AI_FEEDS`). Date, time and maths are answered locally.
- **Feeds itself**: every question is remembered; popular topics and the news are refreshed automatically (first after 20 s, then every 45 min); one-off questions are forgotten after 14 days.
- **Answers customers** when you are offline: factual questions and questions about your items/facts are answered by the agent (starts with "AI:", shows the source). Greetings, thanks and chit-chat still use your own learned style. Money, password, code and number messages are never answered.
- **Quick checks and report**: once a day it asks "Are you currently offering <item> at <price>?" (reply yes/no in the agent chat) and reports how many chats it replied to.
- **Anyone can ask**: type `@ai <question>` (or `/ai ...`) in any chat or group and the AI answers with a source (20 per person per hour).

## Free AI engine (optional)
Add ONE of `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` (see `.env.example`) in Render > Environment and answers read naturally and follow your instructions. Free-tier limits and model names change, so models are set with `GROQ_MODEL`, `GEMINI_MODEL`, `OPENROUTER_MODEL`. If one provider is down or rate-limited it tries the next, then falls back to the plain online sources. Only the cleaned question text is sent out (phone numbers, emails and links are removed).

## Deploy
1. Render: replace `server/client/server.js`, add `server/client/knowledge.js`, redeploy (no new packages needed, Node 18+).
2. Website: add `client/agent.html`, redeploy, then open `https://<your site>/agent.html` while signed in.
3. Turn the assistant on in Tools > AI assistant (the agent only replies for you while that is on and you are offline).

## Notes
- Learned online knowledge is cached in `server/client/data/ai-knowledge.json`. On Render's free disk it resets on restart and rebuilds itself. Your instructions and facts are stored inside your user record (they survive restarts when Supabase is set up).
- The compiled `client/app.js` was not changed, so there is no button for the agent inside the app yet. Link to `/agent.html` from Tools whenever you are ready.
- I tested the code with simulated internet responses here. Please test on your deployment once, because I could not reach the real services from my workspace.
