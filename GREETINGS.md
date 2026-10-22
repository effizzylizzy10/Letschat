# Greetings (love, friendship, prayer, consoling...)

New: `server/client/greetings.js`. Edited: `server.js`, `bot.js`, `app.jsx`, `app.js`.

- In any chat: paperclip > **Greeting**. Pick a type (good morning, good night, love, friendship, prayer, consoling, encouragement, birthday, get well, congratulations, thank you, sorry, anniversary), optional name, short/medium/long. The AI writes it; edit it, tap **Another** for a new one, **Use message** to put it in the message box.
- The AI writes fresh messages through your existing AI engines (Gemini, Groq...). If all are down it uses the built-in bank (4 messages per type) so the feature never breaks. No extra API or key is needed.
- The AI chats also understand requests like "write a birthday message for Ada" or "send a prayer for my friend" and answer in the right style.
- Routes: `GET /api/v1/greetings/categories`, `POST /api/v1/greetings/generate` (15 per minute per user).
- Add or edit types and bank messages in `CATS` and `BANK` in greetings.js, and the chips in `LC_GREETS` in app.jsx/app.js.
