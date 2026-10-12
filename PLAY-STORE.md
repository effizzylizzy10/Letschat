# Publishing Letschat on Google Play

Why people see "unsafe app" warnings: Android warns about any app installed outside Google Play, and about apps from
developers it does not know. No code setting removes that. The fix is to publish through Google Play.
Installing from the browser ("Install app" / "Add to Home screen") never shows that warning.

## Steps
1. Create a Google Play developer account (one-time fee) and verify your identity.
2. Make the Android package with PWABuilder.com or Bubblewrap (`play-store/twa-manifest.json` is ready). Change
   `packageId` and keep it forever.
3. Upload the `.aab` to Play Console and turn on **Play App Signing**.
4. In Play Console > App integrity, copy the **SHA-256 certificate fingerprint** into
   `client/.well-known/assetlinks.json` (replace the placeholder, and the package name if you changed it), then redeploy.
   This removes the browser address bar inside the app.
5. Store listing: app name, description, icon (512 px), feature graphic, phone screenshots.
6. App content: Privacy policy URL = `https://letschatafric.netlify.app/privacy.html`,
   account deletion URL = `https://letschatafric.netlify.app/delete-account.html`,
   Data safety form, content rating, target audience.
7. Fill `SUPPORT_EMAIL` in `client/config.js` so the policy pages show a contact email.
8. New personal developer accounts must run a closed test with testers for a set period before production. Check the
   current rule in Play Console.
