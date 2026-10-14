# Letschat AI (assistant + group moderator)

## Where it is in the app
- **Tools > AI assistant**: on/off switch right in the list, tap the row for details (what it learned, "Reply when I am offline", erase).
- **Message box**: the old "Suggestions" button is now **AI**. Tap it to switch the AI on/off and see replies it suggests from what it learned.
- **Group info > AI moderator** (admin): switch on, type the group rules (one per line), optional banned words.
- **Group notices (automatic)**: adding someone shows "<admin> added <name>", joining by invite link shows "<name> joined using the group invite link", leaving shows "<name> left". The AI assistant and moderator ignore these notices.
- **Status editor**: the crop button opens a WhatsApp-style crop screen (drag the box, drag an edge or corner, Cancel / rotate / Done at the bottom).
- **Verified badge**: uses `client/icons/verified.png` (the blue tick).
- **Status > ⋮ > Reshare to my status**: puts someone else's update on your own status with a ↻ "Reshared from <name>" label (always the first person who posted it).

## How it works (all on the Render server, plain JavaScript, no outside AI service)
- Turning the assistant on studies the person's last ~600 direct-chat messages, then keeps learning from every message.
- It learns: how they reply to what people say (reply patterns), their greetings/thanks/bye wording, tone (length, emojis, lowercase), topics.
- It never learns or answers anything that looks like money, passwords, codes, phone/account numbers or links, and never keeps a reply that contains the other person's name.
- While the person is offline it answers direct chats (and group messages that @mention them). Replies start with "AI:", are limited (1 per 45 s, 6 per chat per 6 h) and never answer an AI/auto message.
- Group moderator checks automatically: links, ads/spam, insults, adult words, flooding/repeats, all-caps, and any quoted word after "no"/"do not" or any banned word.
  Rules it cannot check are still shown to members as reminders.
- Violation 1 and 2: the AI posts a warning with an @mention. Violation 3: the person is removed and cannot rejoin by link.
  Only the admin adding them again (or "Allow back" in AI moderator) lets them back. The admin is never moderated.

## Deploy
1. Render: replace `server/client/server.js`, redeploy. (No new variables or database tables: data is stored inside the existing user/conversation/message rows.)
2. Website: replace everything in `client/` (app.js, sw.js, vercel.json), redeploy, open the app twice.

## Note
`client/app.jsx` is older than `client/app.js` (the compiled file already has features, such as swipe-to-archive, that app.jsx does not). Do not regenerate app.js from app.jsx.

## LetsChat AI robot (Chats tab, above the pencil)
Files: `server/client/bot.js` (brain), routes in `server.js` (`/api/bot/chat`, `/api/creator/bot/*`), screen in `client/app.js` (AiBotScreen, AiTrainPanel), images `client/icons/ai-bot.png` and `ai-bot-128.png`.
- **Answers**: app questions come from a built-in Letschat knowledge list (edit `APP_FACTS` in bot.js); other questions use the developer's notes, what it learned from daily research, and online sources (Wikipedia, DuckDuckGo, news, weather, exchange rates...).
- **Human style**: short messages, typing dots before each one, feelings (happy, caring, calm), a few emojis, emoji reactions on your message (thanks, good news, jokes, sadness), links only when they come from its notes. Respectful with everyone; never asks for passwords/OTPs/PINs; warns about scams.
- **Teaches and advises**: step-by-step skill plans, honest product explanations, realistic money-making ideas with risks (no guaranteed income promises).
- **Free AI key (recommended)**: add one of `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` in Render > Environment. With a key the replies are fully conversational and more accurate. Without a key it still works from the app knowledge, your notes and online sources, with built-in friendly wording.
- **Daily research**: about every 23 hours (first run ~90 seconds after the server starts) it researches 6 default topics plus yours (AI, Africa messaging/social trends, mobile money, making money online, startups, scams/cybersecurity), builds a digest and posts it in the creator's LetsChat AI chat. It also keeps short learned notes that it uses in later answers. The creator account must exist (`CREATOR_EMAILS`).
- **Train (creator only)**: open the AI chat, tap **Train**. Tabs: Instructions (behaviour), Knowledge (facts and links), Topics (extra research subjects), Research (what it learned, past digests, "Run research now").
- Typing: in normal chats, when the AI answers for an offline person, the other side sees "typing…" first.
- Limits: online sources are free and fairly shallow; the "deep" analysis is much better with an AI key. Research notes and training live in the creator's user record (survive restarts with Supabase).
- Deploy: replace `client/` and `server/client/` (server.js, knowledge.js, new bot.js), redeploy.

## AI engines (keys)
`knowledge.js` now supports 9 free providers, each switched on by its own variable in Render > Environment: `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` (+ `_2`, `_3`), `TOGETHER_API_KEY`, `HF_API_KEY`, `SAMBANOVA_API_KEY`, `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID`. They are tried in order; a provider that is out of quota or rejects the key is skipped for 10-60 minutes, so replies stay fast. Keys are never stored in the code. Train panel shows which engines are connected.

## Service worker (client/sw.js)
- Install is safer: only the files the app cannot start without block an install; icons, sounds and pictures are best-effort, so a missing one never stops an update.
- Slow connections: on 2G / data saver / 3G the saved copy is shown after 1.5 s / 2.5 s instead of 3.5 s (fresh copy still downloads for next time).
- Offline page has a Try again button and reloads by itself when the phone comes back online.
- `build.js` stamps the cache name with a hash of the shipped files, so every changed deploy updates phones without manually bumping the version.
- Notifications for AI-written replies show the robot icon. The app can send the worker `get-version` (answer on the message port) or `clear-app-cache`.
- Robot images are saved for offline use.

## v15: full-power robot, Nigerian news, topic research, self-taught chat skills
- **Order of AIs**: Gemini first (the real Gemini with Google Search, so it researches every question itself), then Groq, xAI Grok (only if `XAI_API_KEY` is set), OpenRouter x3, Together, Hugging Face, SambaNova, Cloudflare. A provider that fails or just repeats the question is skipped. The robot is told it can do everything a text AI can (write, code, translate, explain, plan, chat), and answers real questions in full length.
- **Research for every question**: factual and time-sensitive questions use live news notes and web sources; it says when it could not confirm something.
- **Nigerian news** (`news.js`, refreshed every 30 min): latest, gist (jist), gossip, trending, dark (crime, scams, scandal) and sports/football, from Nigerian papers and blogs plus Google News. Ask for "naija gist", "gossip", "football news"...; it shares the story names, sources and links.
- **AI assistant replies even when you are online/away/offline**: Tools > AI assistant > "Reply even when I am online" (on by default for the creator account).
- **Train > Topics**: add a topic (or tell the robot "learn everything about X" in its chat). It researches it broadly at once, sends a full report to your AI chat, re-researches every day and sends "what changed". Train > Research shows reports, learned chat skills and the news feed status.
- **Chat skills**: it keeps 15 conversation skills (Pidgin, Yoruba/Igbo/Hausa, comforting, calming angry people, banter, slang, customer care, football talk...). Built-in versions work offline; every ~2 days it studies them online and rewrites them. They are used automatically when the message fits.
- Deploy: replace `client/` and `server/client/` (new `news.js`), redeploy.

## Research schedule (v16)
Research now runs 5 times a day at 06:00, 10:00, 14:00, 18:00 and 22:00 Lagos time (change with `BOT_RESEARCH_HOURS`, e.g. `7,11,15,19,23`). Each run refreshes the Nigerian news, does the general briefing, re-researches every topic you added and sends ONE message to your AI chat ("Research update 14:00") with what is new. A server that was asleep at a slot catches up within 10 minutes of waking. Chat-skill learning still runs about every 2 days.
Free AI quotas: 5 runs x (6 general topics + your topics) uses many AI calls. If you add many topics and notice answers failing late in the day, add more provider keys or reduce topics.

## Waking the server (v17)
- The app pings the server the instant it opens (service worker first, then the page), again every time you come back to the app, and shows "Waking up the server..." if it takes more than 3 s.
- To stop it sleeping at all: free Render sleeps after 15 min without traffic, and a free service has 750 hours a month, enough to stay awake 24/7. Add a free monitor at uptimerobot.com (HTTP, every 5 minutes) on `https://letschat-9tw4.onrender.com/api/v1/health`. The GitHub keep-warm now runs every 5 minutes too (GitHub may delay runs, so use both). Render's paid Starter plan never sleeps.

## v18: auto-learn (online, in-app, offline)
No new variables, packages or tables. Replace `client/` (app.js) and `server/client/` (bot.js, server.js), redeploy.
- **Online** (every 30 min, first pass 5 min after start): questions the robot could not answer are looked up on the free online sources and kept as learned notes. A question asked 3+ times is promoted to an "auto topic" and researched properly (max 2 a day, needs an AI key); auto topics are re-researched in the 5 daily runs (last 4 only).
- **In-app**: from each person's OWN chat with the robot it learns language (Pidgin), short/long style, emojis and interests (kept in that person's record, shown and erasable in **LetsChat AI > Learn**). Answers it gave that were not time-sensitive or personal are saved and re-used instantly when the same question comes again (only after the answer was liked or asked twice). 👍/👎 under the last answer: 👍 strengthens a saved answer, 👎 deletes it and queues the question for re-learning.
- **Offline**: the AI screen saves a "knowledge pack" (Letschat guide, creator facts, learned notes, popular answers, headlines, chat skills; ~10-60 KB) on the phone and refreshes it every 10 min while online. With no internet it answers from the pack, shows "offline", and keeps every question asked. When the phone reconnects the questions go to `/api/bot/sync`, the server answers them properly (3 per call) and the chat refreshes. The last 40 messages are also kept on the phone so the chat opens offline.
- **Creator control**: Train > Research > Auto-learn has switches All / Online / In-app / Offline, live counters and "Run auto-learn now". Everything defaults to ON.
- **Never learned**: links, emails, long numbers, passwords/PIN/OTP/card/BVN talk, insults, money-making questions' personal details, anything personal ("my…", "I am…") for shared answers. Private chats between people are never read by this feature (the older "AI assistant when I'm offline" in Tools still works as before and is opt-in per person).
- **Honest limits**: this is learning by saved notes, research and answer memory, not training a new model. Quality still depends on the AI keys; free-source lookups are shallow. Routes added: GET /api/bot/pack, POST /api/bot/sync, POST /api/bot/feedback, GET/POST /api/bot/learn, POST /api/bot/learn/erase, POST /api/creator/bot/auto, POST /api/creator/bot/auto/run.

## v19: Chat Room (everyone, auto-join, @ mentions)
- A group called **Chat Room** is created automatically (admin = the creator account). Every user is added silently the first time they come online (socket connect, or when the chat list loads), so they appear in it without doing anything. Suspended accounts are not added.
- **@ button** in the message box of every group: tap it, pick a member (type to filter) and the name is inserted. The mentioned person gets the message flagged and a push. In the Chat Room only @mentioned people get a push (everyone else is not buzzed by a busy room).
- People can leave the room; they are then not added again. The room is never deleted when it empties and shows no "joined/left" notices.
- Slow mode: one message per 1.5 s per person. For rooms over 300 members the member list sent to phones holds the 300 who are online first (the real count is `memberCount`).
- Deploy: replace `client/app.js` and `server/client/server.js`, redeploy. No new variables or tables.

## v20: self-study of sports and technology/AI (online)
- **Curriculum** (`STUDY` in bot.js): 23 sports subjects (football and World Cup/AFCON/Premier League/Champions League/other leagues history, Super Eagles, Ballon d'Or, managers, NBA, Olympics, athletics, boxing, tennis, F1, how predictions work, plus LIVE ones: this week's results and tables, Super Eagles/African football, NBA/F1/tennis/boxing results, transfers, upcoming matches with predictions) and 26 technology/AI subjects (AI history, how LLMs work, AI companies and models, AI tools, AI safety and regulation, chips, internet/phones, cloud, programming, cybersecurity, African fintech and startups, robotics, EVs, space, quantum, crypto, open-source AI, AI in Africa, social media, AR/VR, privacy law, plus LIVE ones: new AI releases this week, tech launches, Africa funding news, security incidents/scams).
- **How it studies**: each 30-minute auto-learn pass studies the most overdue subject (alternating sports and tech), with web searches, news and the AI engines, and saves a study note. History subjects are re-checked every 30 days, LIVE subjects every 8 hours. Default budget 24 subjects a day (`BOT_STUDY_PER_DAY` in Render to change; with no AI key it does 2 per pass using free sources only). The first full cycle takes about 2 days.
- **Used in answers and offline**: study notes feed every answer and the offline knowledge pack on phones (plus tech, AI and sports headlines).
- **News feeds** (`news.js`): new categories `tech` (TechCabal, Techpoint, TechCrunch, The Verge, Ars Technica, BBC Tech), `ai` (The Verge AI, VentureBeat, TechCrunch AI, Google News) and `sportsworld` (BBC Sport, ESPN, Google News). They refresh every 30 min and are asked for with words like "latest AI news", "new iPhone launch", "NBA results today". "How does AI work?" stays a normal explanation, not a headline list.
- **Predictions**: for "who will win..." the robot gathers the latest team news and form, gives a lean with rough probabilities and the reasons, says clearly nobody can know and upsets are common, and never encourages betting. Prediction answers are never served from the saved-answer cache.
- The 5 daily research digests now include sports and technology/AI (8 topics) and the headlines of every news category.
- Creator view: Train > Research > Auto-learn shows "self-study: sports x/23, tech and AI y/26 (n/24 today, last: ...)". Deploy: replace `client/app.js` and `server/client/` (bot.js, news.js, server.js), redeploy.
