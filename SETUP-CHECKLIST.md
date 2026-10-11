# Letschat setup checklist

## 1. Firebase (console.firebase.google.com > letschatafrica)
- [ ] Authentication > Sign-in method: **Email/Password** = Enabled (also Google / Phone if you use them)
- [ ] Authentication > Settings > Authorized domains: add your website domain (Netlify/Vercel) and the Render domain
- [ ] Authentication > Templates: set Sender name "Letschat Africa" and a Reply-to address on the Verification and Password reset templates
- [ ] SMTP is optional; the built-in sender works

## 2. Render (server)
- [ ] Replace `server/client/server.js` with the new version
- [ ] Add the variables from `server/client/.env.example` (JWT_SECRET, CREATOR_EMAILS, CLIENT_ORIGIN, Supabase keys)
- [ ] Redeploy, then open `/health` or the site to wake it

## 3. Website (Netlify/Vercel)
- [ ] Replace `client/app.js`, `client/app.jsx`, `client/sw.js`
- [ ] Redeploy; open the app twice (the first open shows the saved copy while the new one downloads)
- [ ] Optional: fill `SUPPORT_EMAIL` / `SUPPORT_WHATSAPP` in `client/config.js`

## 4. Test
1. Create account with email + password, verify via the email link
2. Log out and log in again
3. Forgot password sends a reset email (check spam)
4. Sign in as the creator email: verified badge shows; `/api/creator/users` works with your token

## Security
- Change any password that was shared in chat or screenshots
- Never commit `.env` or service-account keys; keep the repo private
