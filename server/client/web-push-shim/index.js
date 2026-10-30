"use strict";
/*
 * Letschat instant push for the Android app.
 *
 * server.js keeps calling webpush.sendNotification({ endpoint, keys }, payload, options) exactly as before. This file is installed under the
 * name "web-push" (see package.json: "web-push": "file:web-push-shim") and the real library is installed as "web-push-real".
 *   - A normal browser subscription goes straight to the real web-push (nothing changes for the website).
 *   - The Android app registers its Firebase token through the SAME /push/subscribe route, using an endpoint that starts with
 *     FCM_PREFIX followed by the token. Those are sent through Firebase Cloud Messaging here instead.
 * So who gets a push, when (app in the background only), the message preview and group choices all keep using the existing server logic.
 *
 * Needs one Render environment variable: FIREBASE_SERVICE_ACCOUNT = the service-account JSON (pasted as is, or base64 of it).
 * Without it, app pushes fail quietly (503) and everything else keeps working.
 */
const real = require("web-push-real");

const FCM_PREFIX = "https://fcm-token.letschat.invalid/";
const CHANNEL_ID = "letschat_push"; // created by the Android app (letschat-native-bridge.js)

let messaging = null;
let tried = false;

function getMessaging() {
  if (tried) return messaging;
  tried = true;
  try {
    let raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
    if (!raw) {
      console.warn("[fcm] FIREBASE_SERVICE_ACCOUNT is not set: Android app pushes are off");
      return null;
    }
    if (raw.charAt(0) !== "{") raw = Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(raw);
    const admin = require("firebase-admin");
    const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, "letschat-fcm"); // own app: never clashes with the sign-in one
    messaging = admin.messaging(app);
    console.log("[fcm] Firebase Cloud Messaging ready for project " + (sa.project_id || "?"));
  } catch (e) {
    console.warn("[fcm] could not start Firebase Cloud Messaging: " + (e && e.message));
    messaging = null;
  }
  return messaging;
}

function fail(message, statusCode) {
  const e = new Error(message);
  e.statusCode = statusCode; // server.js removes a subscription when it sees 404 or 410
  return e;
}

function sendFcm(token, payload) {
  const m = getMessaging();
  if (!m) return Promise.reject(fail("Firebase Cloud Messaging is not set up on the server", 503));
  let p = {};
  try { p = JSON.parse(typeof payload === "string" ? payload : String(payload || "{}")) || {}; } catch (e) { p = {}; }
  const tag = String(p.tag || "");
  const note = { channelId: CHANNEL_ID, sound: "default", defaultVibrateTimings: true };
  if (tag) note.tag = tag; // same chat = same notification (it updates instead of piling up)
  const message = {
    token,
    notification: { title: String(p.title || "Letschat Africa").slice(0, 120), body: String(p.body || "New message").slice(0, 300) },
    data: { tag, chatId: tag.indexOf("conv-") === 0 ? tag.slice(5) : "", url: String(p.url || "./") },
    android: { priority: "high", ttl: 86400000, notification: note },
  };
  return m.send(message).catch((err) => {
    const code = (err && err.code) || "";
    const gone = code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
    throw fail("FCM: " + (code || (err && err.message) || "failed"), gone ? 410 : 502);
  });
}

function sendNotification(subscription, payload, options) {
  const ep = subscription && subscription.endpoint;
  if (typeof ep === "string" && ep.indexOf(FCM_PREFIX) === 0) return sendFcm(ep.slice(FCM_PREFIX.length), payload);
  return real.sendNotification.apply(real, arguments);
}

module.exports = Object.assign({}, real, { sendNotification, FCM_PREFIX });
