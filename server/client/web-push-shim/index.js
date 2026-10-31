"use strict";
/*
 * Letschat instant push for the Android app.
 *
 * server.js keeps calling webpush.sendNotification({ endpoint, keys }, payload, options) exactly as before. This file is installed under the
 * name "web-push" (see package.json: "web-push": "file:web-push-shim") and the real library is installed as "web-push-real".
 * Two channels, each independent of the other:
 *   - Browser Web Push (VAPID): a normal browser subscription goes straight to the real web-push (nothing changes for the website).
 *     It never touches Firebase, and it works with no Firebase settings at all.
 *   - Android app (FCM): the app registers its Firebase token through the SAME /push/subscribe route, using an endpoint that starts with
 *     FCM_PREFIX followed by the token. Those are sent through Firebase Cloud Messaging here instead. This never needs VAPID keys.
 * So who gets a push, when (app in the background only), the message preview and group choices all keep using the existing server logic.
 *
 * Needs one Render environment variable for the Android channel: FIREBASE_SERVICE_ACCOUNT = the service-account JSON (pasted as is, or
 * base64 of it). Without it, app pushes are off (503) and everything else keeps working.
 *
 * Secrets: the service-account JSON (private key included) is never printed. Log lines carry only the project id and a redacted reason.
 * Send results are logged too (success, or the Firebase error code) with only the last 6 characters of the device token.
 */
let real = null;
try { real = require("web-push-real"); } catch (e) { console.warn("[push] web-push-real is not installed: browser push is off, Android app push can still work"); }

const FCM_PREFIX = "https://fcm-token.letschat.invalid/";
const CHANNEL_ID = "letschat_push"; // created by the Android app (letschat-native-bridge.js)
const APP_NAME = "letschat-fcm"; // own Firebase app: never clashes with the sign-in one

let messaging = null;
let tried = false;

// a log-safe version of an error message: the secrets (and anything long enough to be key material) are removed
function redact(message, secrets) {
  let m = String(message == null ? "" : message);
  for (const s of secrets || []) { if (typeof s === "string" && s.length >= 6) m = m.split(s).join("[redacted]"); }
  m = m.replace(/-----BEGIN [A-Z ]+-----[\s\S]*?(-----END [A-Z ]+-----|$)/g, "[redacted key]");
  m = m.replace(/[A-Za-z0-9+\/=_-]{40,}/g, "[redacted]");
  return m.slice(0, 160);
}

function getMessaging() {
  if (tried) return messaging;
  tried = true;
  let raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) {
    console.warn("[fcm] FIREBASE_SERVICE_ACCOUNT is not set: Android app pushes are off");
    return null;
  }
  let sa = null;
  const secrets = [raw];
  try {
    if (raw.charAt(0) !== "{") { raw = Buffer.from(raw, "base64").toString("utf8"); secrets.push(raw); }
    sa = JSON.parse(raw);
  } catch (e) {
    // JSON.parse messages can quote part of the text it was given, so say nothing about the content
    console.warn("[fcm] FIREBASE_SERVICE_ACCOUNT is not valid JSON (or base64 of JSON): Android app pushes are off");
    return null;
  }
  try {
    if (!sa || typeof sa !== "object") throw new Error("not an object");
    secrets.push(sa.private_key, sa.private_key_id, sa.client_email, sa.client_id);
    const admin = require("firebase-admin");
    let app = null;
    try { app = admin.app(APP_NAME); } catch (e) { app = null; } // reuse it if it already exists
    if (!app) app = admin.initializeApp({ credential: admin.credential.cert(sa) }, APP_NAME);
    messaging = admin.messaging(app);
    console.log("[fcm] Firebase Cloud Messaging ready for project " + (sa.project_id || "?"));
  } catch (e) {
    console.warn("[fcm] could not start Firebase Cloud Messaging: " + redact(e && e.message, secrets));
    messaging = null;
  }
  return messaging;
}

// true when the Android channel can send (checked once; needs only FIREBASE_SERVICE_ACCOUNT, never the VAPID keys)
function fcmEnabled() { return !!getMessaging(); }
function isFcmEndpoint(ep) { return typeof ep === "string" && ep.indexOf(FCM_PREFIX) === 0; }

function fail(message, statusCode) {
  const e = new Error(message);
  e.statusCode = statusCode; // server.js removes a subscription when it sees 404 or 410
  return e;
}

function sendFcm(token, payload) {
  const m = getMessaging();
  if (!m) { console.warn("[fcm] push skipped: Firebase Cloud Messaging is not set up on the server"); return Promise.reject(fail("Firebase Cloud Messaging is not set up on the server", 503)); }
  let p = {};
  try { p = JSON.parse(typeof payload === "string" ? payload : String(payload || "{}")) || {}; } catch (e) { p = {}; }
  const tag = String(p.tag || "");
  const tail = String(token || "").slice(-6); // log-safe: never the whole token
  const note = { channelId: CHANNEL_ID, sound: "default", defaultVibrateTimings: true };
  if (tag) note.tag = tag; // same chat = same notification (it updates instead of piling up)
  const message = {
    token,
    notification: { title: String(p.title || "Letschat Africa").slice(0, 120), body: String(p.body || "New message").slice(0, 300) },
    data: { tag, chatId: tag.indexOf("conv-") === 0 ? tag.slice(5) : "", url: String(p.url || "./") },
    android: { priority: "high", ttl: 86400000, notification: note },
  };
  let sent;
  try { sent = m.send(message); } catch (err) { sent = Promise.reject(err); }
  return Promise.resolve(sent).then((id) => {
    console.log("[fcm] sent ok tag=" + (tag || "-") + " device=..." + tail);
    return id;
  }, (err) => {
    const code = (err && err.code) || "";
    const gone = code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
    const clean = String(code).replace(/[^a-z0-9\/-]/gi, "") || "failed";
    // only the Firebase error code is reported, never the raw message
    console.warn("[fcm] send failed: " + clean + " device=..." + tail + (gone ? " (token removed)" : ""));
    throw fail("FCM: " + clean, gone ? 410 : 502);
  });
}

function sendNotification(subscription, payload, options) {
  const ep = subscription && subscription.endpoint;
  if (isFcmEndpoint(ep)) return sendFcm(ep.slice(FCM_PREFIX.length), payload);
  if (!real) return Promise.reject(fail("Browser push is not available on the server", 503));
  return real.sendNotification.apply(real, arguments);
}

module.exports = Object.assign({}, real || {}, { sendNotification, FCM_PREFIX, fcmEnabled, isFcmEndpoint });
