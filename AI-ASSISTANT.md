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
