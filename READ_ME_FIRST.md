# Before you deploy

Open `config.js` in this folder and set both URLs to your deployed server
(see the main repo's README for how to deploy the server on Render):

```js
window.LOOP_CONFIG = {
  API_URL: "https://your-loop-server.onrender.com",
  SOCKET_URL: "https://your-loop-server.onrender.com",
};
```

Then deploy this whole folder:

1. Go to https://app.netlify.com/drop
2. Drag this folder (or this zip) onto the page
3. You'll get a live URL like `https://random-name-123.netlify.app`
4. Go back to your server's environment variables and set
   `CLIENT_ORIGIN` to that Netlify URL, then redeploy the server so it
   accepts requests from it

Open the Netlify URL on a phone → Share/menu → "Add to Home Screen" /
"Install app" to get it as a home-screen app.
