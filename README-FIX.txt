Letschat Live: blank video for invited users (livefix16)

FILES (upload to the same paths in your GitHub repo, replacing the old ones)
  client/config.js            <- TURN relay support + video recovery   (Netlify / Vercel)
  server/client/live.js       <- late joiners now see everyone already in a Go Live   (Render)

DEPLOY ORDER
  1. server/client/live.js  (Render redeploys)
  2. client/config.js       (Netlify redeploys; people will see the "Update available" page once)

IMPORTANT: make video work on mobile data (do this once)
  1. Sign up free at https://dashboard.metered.ca/signup and create an app.
  2. Open the TURN credentials link of that app. It looks like:
       https://YOUR-APP.metered.live/api/v1/turn/credentials?apiKey=YOUR-API-KEY
  3. Paste it in client/config.js:   TURN_API_URL: "https://YOUR-APP.metered.live/api/v1/turn/credentials?apiKey=YOUR-API-KEY",
  4. Commit. Done. Without it, a shared free relay is tried, which may be slow or limited.
