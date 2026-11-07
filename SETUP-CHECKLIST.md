# Letschat setup checklist

## 1. Firebase (console.firebase.google.com > letschatafrica)
- [ ] Authentication > Sign-in method: **Email/Password** = Enabled (also Google / Phone if you use them)
- [ ] Authentication > Settings > Authorized domains: add your website domain (Netlify/Vercel) and the Render domain
- [ ] Authentication > Templates: set Sender name "Letschat Africa" and a Reply-to address on the Verification and Password reset templates
- [ ] SMTP is optional; the built-in sender works
- [ ] Project settings > Your apps > Android app `com.letschatafrica.app`: add the SHA-256 fingerprint `F5:A5:15:F3:EA:6A:31:7B:05:9C:7F:10:7E:AE:7F:94:0B:61:95:75:58:B1:CC:57:5F:E8:07:E7:CC:FD:F7:D8` (the Letschat signing key). Firebase's email-link guide for Android asks for it

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

## 5. If the emailed sign-in link does not open (Redmi, Infinix and other Android 12+ phones)
The email link points to `https://letschatafrica-1df0c.firebaseapp.com/__/auth/action?...`
- Android 12+ gives that link to Letschat only when the app is verified for that website (`autoVerify` in `native/android-src/patch_manifest.py`). Otherwise it opens in Chrome, and on some phones and networks Chrome shows "refused to connect" (ERR_CONNECTION_REFUSED) for firebaseapp.com.
- Build the APK again after merging (Actions > Build native Android APK), then install it, so the verified link setting is in the app.
- Fallback that needs no new APK: on the "Check your email" screen tap **Email link not opening? Paste it here**, copy the link from the email (press and hold it, then Copy link address) and paste it (`client/linkhelp.js`). Open the app twice after a deploy so the phone picks up the new page.
- Optional: Authentication > Templates > pencil > Customize action URL > `https://letschat-taupe.vercel.app/`, so emails point at your own website. Firebase's help page lists only verify email, password reset and email change for this setting, so test it: request a new sign-in link and check which address it points to.

## Security
- Change any password that was shared in chat or screenshots
- Never commit `.env` or service-account keys; keep the repo private
