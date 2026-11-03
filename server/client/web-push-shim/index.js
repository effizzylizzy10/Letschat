"use strict";
/*
 * Letschat instant push for the Android app, iPhone/iPad and browsers (all through Firebase Cloud Messaging), plus classic browser Web Push.
 *
 * server.js keeps calling webpush.sendNotification({ endpoint, keys }, payload, options) exactly as before. This file is installed under the
 * name "web-push" (see package.json: "web-push": "file:web-push-shim") and the real library is installed as "web-push-real".
 * Two channels, each independent of the other:
 *   - Classic browser Web Push (VAPID): an old-style browser subscription goes straight to the real web-push.
 *     It never touches Firebase, and it works with no Firebase settings at all. Only this channel uses the VAPID keys.
 *   - Firebase (FCM): the Android app, the iOS app AND the browser (push.js) register their Firebase token through the SAME /api/push/subscribe
 *     route, using an endpoint that starts with FCM_PREFIX followed by the token. FCM_PREFIX is a marker, not a real web address: nothing is
 *     ever requested from it. The server uses it only to tell "Firebase token" from "browser push address". It must stay identical in
 *     server.js, client/push.js and letschat-native-bridge.js. FCM never needs VAPID keys.
 *     One message carries Android settings, iOS (APNs) settings and Web settings; each device uses its own.
 * So who gets a push, when (app in the background only), the message preview and group choices all keep using the existing server logic.
 *
 * A payload may also carry:
 *   "image"  a public https link: the notification then shows that picture (friend suggestions, see suggest-push.js)
 *   "call"   true for a ringing call: short lifetime (a call that is 45 s old is no longer ringing), never merged with another alert
 *   "badge"  a number: the unread count shown on the app icon (iOS badge, Android notification count)
 *   "type"   a short text such as "message", "group", "call" (passed to the app as data)
 * Without them nothing changes.
 *
 * Reliability (v2):
 *   - temporary Firebase problems (internal error, server unavailable, network) are retried up to 3 times with a short pause
 *   - the same alert for the same device within 4 seconds is sent once (stops double notifications when an event is processed twice)
 *   - a token Firebase says is no longer valid is reported as 410, so server.js removes it from the account
 *
 * Needs one Render environment variable for the Firebase channel: FIREBASE_SERVICE_ACCOUNT = the service-account JSON (pasted as is, or
 * base64 of it). Without it, Firebase pushes are off (503) and everything else keeps working.
 *
 * Secrets: the service-account JSON (private key included) is never printed. Log lines carry only the project id and a redacted reason.
 * Send results are logged too (success, or the Firebase error code) with only the last 6 characters of the device token.
 */
let real = null;
try { real = require("web-push-real"); } catch (e) { console.warn("[push] web-push-real is not installed: browser push is off, app push can still work"); }

const FCM_PREFIX = "https://fcm-token.letschat.invalid/";
const CHANNEL_ID = "letschat_push"; // created by the Android app (letschat-native-bridge.js)
const APP_NAME = "letschat-fcm"; // own Firebase app: never clashes with the sign-in one

const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // a message alert is kept for a day if the phone is off
const CALL_TTL_MS = 45 * 1000;              // a ringing call is useless after 45 seconds
const DEDUPE_MS = 4000;
const RETRY_DELAYS_MS = [400, 1500];        // pauses before the 2nd and 3rd attempt
const RETRY_CODES = new Set([
  "messaging/internal-error", "messaging/server-unavailable", "messaging/unavailable",
  "app/network-error", "messaging/network-error", "messaging/timeout",
]);

let messaging = null;
let tried = false;
const recent = new Map(); // dedupe: key -> time of the last send

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
    console.warn("[fcm] FIREBASE_SERVICE_ACCOUNT is not set: app pushes (Android / iOS / Firebase web) are off");
    return null;
  }
  let sa = null;
  const secrets = [raw];
  try {
    if (raw.charAt(0) !== "{") { raw = Buffer.from(raw, "base64").toString("utf8"); secrets.push(raw); }
    sa = JSON.parse(raw);
  } catch (e) {
    // JSON.parse messages can quote part of the text it was given, so say nothing about the content
    console.warn("[fcm] FIREBASE_SERVICE_ACCOUNT is not valid JSON (or base64 of JSON): app pushes are off");
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

// true when the Firebase channel can send (checked once; needs only FIREBASE_SERVICE_ACCOUNT, never the VAPID keys)
function fcmEnabled() { return !!getMessaging(); }
function isFcmEndpoint(ep) { return typeof ep === "string" && ep.indexOf(FCM_PREFIX) === 0; }

function fail(message, statusCode) {
  const e = new Error(message);
  e.statusCode = statusCode; // server.js removes a subscription when it sees 404 or 410
  return e;
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// true when this exact alert was already sent to this device a moment ago (calls are never merged: every ring counts)
function isDuplicate(token, p) {
  if (p.call) return false;
  const now = Date.now();
  if (recent.size > 500) { for (const [k, t] of recent) { if (now - t > DEDUPE_MS) recent.delete(k); } }
  const key = String(token).slice(-24) + "|" + String(p.tag || "") + "|" + String(p.title || "") + "|" + String(p.body || "");
  const last = recent.get(key);
  recent.set(key, now);
  return !!last && now - last < DEDUPE_MS;
}

function buildMessage(token, p) {
  const tag = String(p.tag || "");
  const isCall = !!p.call;
  const image = /^https:\/\/[^\s]{4,1000}$/i.test(String(p.image || "")) ? String(p.image) : ""; // picture shown in the notification (public https only)
  const badge = Number.isFinite(Number(p.badge)) && Number(p.badge) >= 0 ? Math.min(99999, Math.floor(Number(p.badge))) : null;
  const ttlMs = isCall ? CALL_TTL_MS : MESSAGE_TTL_MS;

  const note = { channelId: CHANNEL_ID, sound: "default", defaultVibrateTimings: true };
  if (tag) note.tag = tag; // same chat = same notification (it updates instead of piling up)
  if (image) note.imageUrl = image;
  if (badge !== null && badge > 0) note.notificationCount = badge;

  const aps = { sound: "default", "mutable-content": 1, category: isCall ? "LETSCHAT_CALL" : "LETSCHAT_MESSAGE" };
  if (tag) aps["thread-id"] = tag; // iOS groups notifications of one chat together
  if (badge !== null) aps.badge = badge;
  if (isCall) aps["interruption-level"] = "time-sensitive";

  const message = {
    token,
    notification: { title: String(p.title || "Letschat Africa").slice(0, 120), body: String(p.body || "New message").slice(0, 300) },
    // data values must be strings; call / ai let the browser's service worker keep call alerts on screen and show the robot icon
    data: {
      tag, chatId: tag.indexOf("conv-") === 0 ? tag.slice(5) : "", url: String(p.url || "./"), call: isCall ? "1" : "", ai: p.ai ? "1" : "",
      suggest: p.suggest ? "1" : "", image, type: String(p.type || (isCall ? "call" : "message")).slice(0, 40), badge: badge === null ? "" : String(badge),
    },
    android: { priority: "high", ttl: ttlMs, notification: note },
    apns: {
      headers: Object.assign({
        "apns-priority": "10",
        "apns-push-type": "alert",
        "apns-expiration": String(Math.floor((Date.now() + ttlMs) / 1000)),
      }, tag ? { "apns-collapse-id": tag.slice(0, 64) } : {}),
      payload: { aps },
    },
    webpush: { headers: { Urgency: "high", TTL: String(Math.floor(ttlMs / 1000)) } }, // Chrome: deliver now, keep it for a day (a call: 45 s)
  };
  if (image) { message.notification.imageUrl = image; message.apns.fcmOptions = { imageUrl: image }; }
  if (tag && !isCall) message.android.collapseKey = tag.slice(0, 64);
  return message;
}

// one send, with up to 3 tries for temporary Firebase / network problems
function sendWithRetry(m, message, attempt) {
  let sent;
  try { sent = m.send(message); } catch (err) { sent = Promise.reject(err); }
  return Promise.resolve(sent).catch((err) => {
    const code = (err && err.code) || "";
    if (RETRY_CODES.has(code) && attempt < RETRY_DELAYS_MS.length) {
      return wait(RETRY_DELAYS_MS[attempt]).then(() => sendWithRetry(m, message, attempt + 1));
    }
    throw err;
  });
}

function sendFcm(token, payload) {
  const m = getMessaging();
  if (!m) { console.warn("[fcm] push skipped: Firebase Cloud Messaging is not set up on the server"); return Promise.reject(fail("Firebase Cloud Messaging is not set up on the server", 503)); }
  let p = {};
  try { p = JSON.parse(typeof payload === "string" ? payload : String(payload || "{}")) || {}; } catch (e) { p = {}; }
  const tag = String(p.tag || "");
  const tail = String(token || "").slice(-6); // log-safe: never the whole token
  if (isDuplicate(token, p)) {
    console.log("[fcm] duplicate skipped tag=" + (tag || "-") + " device=..." + tail);
    return Promise.resolve("duplicate");
  }
  return sendWithRetry(m, buildMessage(token, p), 0).then((id) => {
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
