package com.letschatafrica.chatbubble;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Looks for new messages from inside the Android process, without the web page, so the chat head can pop up while Letschat is
 * minimised or closed (the foreground service keeps this process alive). It asks the Letschat server for the conversation list
 * every few seconds while the app is not on screen and shows the toast when a chat's LAST MESSAGE changes and is not mine.
 * (It does not use the unread counter: the page, still alive in the background, can mark a message read at once, which would hide it.)
 * The app hands this checker the sign-in token (see ChatBubblePlugin.pushSessionFromPage and letschat-native-bridge.js).
 *
 * The /api/v1 routes answer with an envelope {"success":true,"data":{...}}; unwrap() reads both that and a bare body.
 * Everything it decides is written to the Android log under the tag LetschatPoller (adb logcat -s LetschatPoller).
 *
 * How a new message is shown (push notification fix):
 *  - "Floating chat bubble" ON and "Display over other apps" allowed: the WhatsApp-style pop-up on the chat head.
 *  - otherwise, when "Push notifications" (the alerts setting) is ON: a normal Android notification with sound and vibration.
 *    This now ALSO happens when the floating bubble is switched OFF (before, nothing was shown at all in that case).
 *  - both OFF: nothing is shown.
 *
 * Instant push (Firebase) and this checker can both fire for the same message. The notification here uses the SAME tag as the
 * server's push ("conv-<chat id>", id 0), so Android replaces one with the other instead of showing two.
 *
 * The old "Letschat check: ..." status toasts on the chat head are gone: the chat head now only ever shows real messages. Problems
 * (not signed in, server refuses the token, no connection) are only written to the log.
 */
public final class MessagePoller {

    private static final String TAG = "LetschatPoller";
    private static final String PREFS = "letschat_chat_bubble";
    /** Same channel the app creates for Firebase pushes (letschat-native-bridge.js), so both look and sound the same. */
    private static final String NOTICE_CHANNEL = "letschat_push";
    private static final long FIRST_WAIT_MS = 2500;
    private static final long INTERVAL_MS = 8000;
    /** After the server refuses the token, check again only this rarely (the page may send a fresh token meanwhile). */
    private static final long REFUSED_WAIT_MS = 60000;

    private static final Object LOCK = new Object();
    private static boolean wake = false;

    private static volatile Thread worker;
    private static volatile boolean foreground = false;
    private static Context appCtx;
    private static String lastStatus = "";
    private static long lastStatusAt = 0;

    private MessagePoller() {}

    /** The in-app "Push notifications" switch (phone alerts for new messages). On by default. */
    static void setAlerts(Context ctx, boolean on) {
        ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("alerts", on).apply();
    }

    static boolean alertsOn(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("alerts", true);
    }

    /** Called by the page after sign-in (token) and after sign-out (empty token). */
    public static synchronized void setSession(Context ctx, String token, String apiUrl, String userId) {
        Context app = ctx.getApplicationContext();
        SharedPreferences.Editor ed = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (token == null || token.isEmpty()) {
            Log.i(TAG, "signed out: poller stops");
            ed.remove("token").remove("apiUrl").remove("userId").apply();
            stop();
            return;
        }
        Log.i(TAG, "session received (api=" + apiUrl + ", userId " + (userId == null || userId.isEmpty() ? "MISSING" : "ok") + ")");
        ed.putString("token", token).putString("apiUrl", apiUrl == null ? "" : apiUrl).putString("userId", userId == null ? "" : userId).apply();
        ensureRunning(app);
    }

    /** Starts the checker when a sign-in token is stored. Safe to call again and again. Also called by the background service. */
    public static synchronized void ensureRunning(Context ctx) {
        appCtx = ctx.getApplicationContext();
        SharedPreferences sp = appCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (sp.getString("token", "").isEmpty() || sp.getString("apiUrl", "").isEmpty()) return;
        Thread w = worker;
        if (w != null && w.isAlive()) return;
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    loop();
                } catch (Throwable e) {
                    Log.w(TAG, "poller stopped: " + e);
                }
            }
        }, "letschat-message-poller");
        t.setDaemon(true);
        worker = t;
        t.start();
        Log.i(TAG, "poller started");
    }

    static synchronized void stop() {
        Thread w = worker;
        worker = null;
        if (w != null) w.interrupt();
    }

    /** True while Letschat is on screen (the page itself shows messages then). Leaving the screen starts counting at once. */
    static void setForeground(boolean on) {
        boolean was = foreground;
        foreground = on;
        if (was && !on) {
            synchronized (LOCK) {
                wake = true;
                LOCK.notifyAll();
            }
            // make sure the checker is running (it needs the stored sign-in); nothing is shown on screen about it
            Context ctx = appCtx;
            if (ctx != null) ensureRunning(ctx);
        }
    }

    /** The live connection just showed the chat head for a message. (Kept for the plugin; duplicates are removed by message id in MessagePopup.) */
    static void noteSocketShow() {}

    /** Writes what the checker found to the Android log (the same text is not repeated within a minute). Nothing is shown on the chat head. */
    private static void status(final Context ctx, final String text) {
        long now = System.currentTimeMillis();
        if (text.equals(lastStatus) && now - lastStatusAt < 60000) return;
        lastStatus = text;
        lastStatusAt = now;
        Log.i(TAG, "status: " + text);
    }

    /** Sleeps up to ms, or less when setForeground(false) wakes the loop. Returns false when interrupted. */
    private static boolean pause(long ms) {
        try {
            synchronized (LOCK) {
                long end = System.currentTimeMillis() + ms;
                while (!wake) {
                    long left = end - System.currentTimeMillis();
                    if (left <= 0) break;
                    LOCK.wait(left);
                }
                wake = false;
            }
            return true;
        } catch (InterruptedException e) {
            return false;
        }
    }

    /** The server's /api/v1 answers are {"success":true,"data":{...}}; older routes answer with the bare body. */
    private static JSONObject unwrap(String body) throws Exception {
        JSONObject root = new JSONObject(body);
        JSONObject data = root.optJSONObject("data");
        return data != null ? data : root;
    }

    private static void loop() {
        final Thread self = Thread.currentThread();
        // what each chat's last message was at the previous check (null = not counting yet)
        Map<String, String> lastIds = null;
        Map<String, Long> lastTimes = null;
        long wait = FIRST_WAIT_MS;
        while (worker == self) {
            if (!pause(wait)) return;
            wait = INTERVAL_MS;
            if (worker != self) return;
            if (foreground) {
                lastIds = null; // when the app goes to the background again, start counting from then
                lastTimes = null;
                continue;
            }
            try {
                Context ctx = appCtx;
                if (ctx == null) return;
                SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                String token = sp.getString("token", "");
                String api = sp.getString("apiUrl", "");
                if (token.isEmpty() || api.isEmpty()) {
                    status(ctx, "not signed in.");
                    return;
                }
                // the floating bubble and the phone alerts are separate switches: only when BOTH are off is there nothing to show
                if (!sp.getBoolean("enabled", true) && !sp.getBoolean("alerts", true)) {
                    lastIds = null;
                    lastTimes = null;
                    status(ctx, "the Floating chat bubble and Push notifications settings are both OFF.");
                    continue;
                }
                String myId = sp.getString("userId", "");
                while (api.endsWith("/")) api = api.substring(0, api.length() - 1);
                String body = get(api + "/api/v1/conversations", token);
                if (body == null) {
                    status(ctx, "cannot reach the server right now (" + lastProblem + ").");
                    continue; // no network right now: try again next time
                }
                if (body.isEmpty()) {
                    // the server refused the token: keep the thread alive and look again slowly (a fresh token is read from storage each time)
                    Log.w(TAG, "server refused the sign-in token");
                    status(ctx, "the server refused the sign-in.");
                    lastIds = null;
                    lastTimes = null;
                    wait = REFUSED_WAIT_MS;
                    continue;
                }
                JSONArray list = unwrap(body).optJSONArray("conversations");
                if (list == null) {
                    Log.w(TAG, "no conversations array in the answer");
                    status(ctx, "the server answered, but not with a chat list.");
                    continue;
                }
                Map<String, String> nowIds = new HashMap<>();
                Map<String, Long> nowTimes = new HashMap<>();
                List<JSONObject> fresh = new ArrayList<>();
                List<Long> since = new ArrayList<>();
                int fromMe = 0;
                int noId = 0;
                for (int i = 0; i < list.length(); i++) {
                    JSONObject c = list.optJSONObject(i);
                    if (c == null) continue;
                    String id = str(c, "id");
                    if (id.isEmpty()) continue;
                    JSONObject lm = c.optJSONObject("lastMessage");
                    String lmId = str(lm, "id");
                    long lmTime = lm == null ? 0L : lm.optLong("time", 0L);
                    nowIds.put(id, lmId);
                    nowTimes.put(id, lmTime);
                    if (lm != null && lmId.isEmpty()) noId++;
                    if (lastIds == null || lm == null || lmId.isEmpty()) continue;
                    if (c.optBoolean("muted", false)) continue;
                    if (lmId.equals(lastIds.get(id))) continue; // nothing new in this chat
                    if (!myId.isEmpty() && myId.equals(str(lm, "senderId"))) { // my own message (sent from another device)
                        fromMe++;
                        continue;
                    }
                    if (lm.optBoolean("deleted", false)) continue;
                    Long before = lastTimes == null ? null : lastTimes.get(id);
                    fresh.add(c);
                    since.add(before == null ? 0L : before);
                }
                if (lastIds == null) {
                    Log.i(TAG, "started counting: " + nowIds.size() + " chats" + (noId > 0 ? " (" + noId + " chats have a last message without an id)" : ""));
                } else if (!fresh.isEmpty() || fromMe > 0) {
                    Log.i(TAG, "new: " + fresh.size() + " chats, ignored " + fromMe + " sent by me (userId " + (myId.isEmpty() ? "MISSING" : "ok") + ")");
                }
                lastIds = nowIds;
                lastTimes = nowTimes;
                for (int i = 0; i < fresh.size(); i++) {
                    present(ctx, api, token, fresh.get(i), since.get(i), myId);
                }
            } catch (Throwable e) {
                // a bad answer from the server (or any other failure): try again next time, never crash the app
                Log.w(TAG, "check failed: " + e);
            }
        }
    }

    /** Shows the new messages of one chat in the WhatsApp-style pop-up (one page per message, "1 of N"), or as a phone notification. */
    private static void present(Context ctx, String api, String token, JSONObject c, long sinceTime, String myId) {
        String chatId = str(c, "id");
        JSONObject other = c.optJSONObject("other");
        boolean group = c.optBoolean("isGroup", false);
        String title = group ? str(c, "name") : str(other, "name");
        if (title.isEmpty()) title = "Letschat";
        String photo = group ? str(c, "avatar") : str(other, "avatar");
        if (photo.startsWith("/")) photo = api + photo;

        List<MessagePopup.Item> items = new ArrayList<>();
        try {
            String body = get(api + "/api/v1/conversations/" + URLEncoder.encode(chatId, "UTF-8") + "/messages?peek=1&limit=15", token);
            if (body != null && !body.isEmpty()) {
                JSONArray arr = unwrap(body).optJSONArray("messages");
                List<JSONObject> picked = new ArrayList<>();
                if (arr != null) {
                    for (int i = arr.length() - 1; i >= 0 && picked.size() < 15; i--) {
                        JSONObject m = arr.optJSONObject(i);
                        if (m == null) continue;
                        if (!myId.isEmpty() && myId.equals(str(m, "senderId"))) continue; // my own message
                        if (m.optBoolean("deleted", false)) continue;
                        long t = m.optLong("time", 0L);
                        if (sinceTime > 0 && t > 0 && t <= sinceTime) break; // older than what was already there
                        picked.add(0, m);
                    }
                }
                for (JSONObject m : picked) items.add(toItem(m, chatId, title, photo, group, myId));
            }
        } catch (Exception e) {
            Log.w(TAG, "could not read the new messages: " + e);
            // fall back to the last message below
        }
        if (items.isEmpty()) {
            JSONObject last = c.optJSONObject("lastMessage");
            if (last != null) items.add(toItem(last, chatId, title, photo, group, myId));
        }
        if (items.isEmpty()) {
            // the server said there is something new but we could not read it: still show it so the person knows
            items.add(new MessagePopup.Item("", chatId, title, photo, "New message", "", ""));
        }
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean bubbleOn = sp.getBoolean("enabled", true);
        boolean alertsOn = sp.getBoolean("alerts", true);
        boolean canOverlay = bubbleOn && Settings.canDrawOverlays(ctx);
        Log.i(TAG, "showing " + items.size() + " message(s) from " + title + (canOverlay ? " on the chat head" : alertsOn ? " as a notification" : " (nothing: bubble not available and Push notifications OFF)"));
        if (canOverlay) {
            for (MessagePopup.Item it : items) MessagePopup.notifyMessage(ctx, it);
        } else if (alertsOn) {
            postNotice(ctx, title, items.get(items.size() - 1).text, chatId, items.size());
        }
    }

    /** A normal Android notification (sound + vibration) for a new message: used when the chat head cannot or should not be drawn. */
    private static void postNotice(Context ctx, String title, String text, String chatId, int count) {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (Build.VERSION.SDK_INT >= 24 && !nm.areNotificationsEnabled()) {
                // Android 13+: the notification permission was refused (or notifications are off for Letschat in Android settings)
                Log.w(TAG, "notifications are blocked for Letschat on this phone: cannot alert");
                return;
            }
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(NOTICE_CHANNEL, "Letschat messages", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Alerts for new Letschat messages");
                ch.enableVibration(true);
                ch.setShowBadge(true);
                nm.createNotificationChannel(ch); // creating it again is harmless
            }
            Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            PendingIntent pi = null;
            if (open != null) {
                open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                pi = PendingIntent.getActivity(ctx, chatId.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            }
            int icon = ctx.getResources().getIdentifier("ic_stat_letschat", "drawable", ctx.getPackageName());
            if (icon == 0) icon = ctx.getApplicationInfo().icon;
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, NOTICE_CHANNEL) : new Notification.Builder(ctx);
            b.setSmallIcon(icon)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setAutoCancel(true);
            if (count > 1) b.setSubText(count + " new messages");
            if (Build.VERSION.SDK_INT < 26) {
                b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
            }
            if (pi != null) b.setContentIntent(pi);
            // same tag + id 0 as the Firebase push for this chat, so the two replace each other instead of showing twice
            nm.notify("conv-" + chatId, 0, b.build());
        } catch (Throwable e) {
            Log.w(TAG, "could not post the notification: " + e);
        }
    }

    private static MessagePopup.Item toItem(JSONObject m, String chatId, String title, String photo, boolean group, String myId) {
        String text = str(m, "text");
        if (text.isEmpty()) {
            String type = str(m, "type");
            text = (type.isEmpty() || "text".equals(type)) ? "New message" : "[" + type + "]";
        }
        String who = str(m, "senderName");
        if (group && !who.isEmpty()) text = who + ": " + text;
        if (text.length() > 500) text = text.substring(0, 500);
        String replyName = "";
        String replyText = "";
        JSONObject rt = m.optJSONObject("replyTo");
        if (rt != null) {
            replyText = str(rt, "text");
            if (replyText.length() > 140) replyText = replyText.substring(0, 140);
            replyName = (!myId.isEmpty() && myId.equals(str(rt, "senderId"))) ? "You" : str(rt, "name");
        }
        return new MessagePopup.Item(str(m, "id"), chatId, title, photo, text, replyName, replyText);
    }

    /** Sends a reply written in the message pop-up. Returns true when the server accepted it. Must run off the main thread. */
    static boolean sendReply(Context ctx, String chatId, String text) {
        SharedPreferences sp = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String token = sp.getString("token", "");
        String api = sp.getString("apiUrl", "");
        if (token.isEmpty() || api.isEmpty() || chatId == null || chatId.isEmpty()) return false;
        while (api.endsWith("/")) api = api.substring(0, api.length() - 1);
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(api + "/api/v1/conversations/" + URLEncoder.encode(chatId, "UTF-8") + "/messages").openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(10000);
            c.setReadTimeout(20000);
            c.setDoOutput(true);
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setRequestProperty("Accept", "application/json");
            JSONObject body = new JSONObject();
            body.put("text", text);
            body.put("clientId", "pop-" + System.currentTimeMillis());
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            c.setFixedLengthStreamingMode(bytes.length);
            OutputStream os = c.getOutputStream();
            try {
                os.write(bytes);
            } finally {
                os.close();
            }
            int code = c.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String str(JSONObject o, String key) {
        if (o == null || o.isNull(key)) return "";
        return o.optString(key, "");
    }

    /** What went wrong the last time get() returned null (written to the log). */
    private static volatile String lastProblem = "no network";

    /** Returns the answer text, null when the network failed, or "" when the token is no longer accepted. */
    private static String get(String url, String token) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Accept", "application/json");
            int code = c.getResponseCode();
            if (code == 401 || code == 403) return "";
            if (code != 200) {
                Log.w(TAG, "HTTP " + code + " for " + url);
                lastProblem = "HTTP " + code;
                return null;
            }
            InputStream in = c.getInputStream();
            BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            return sb.toString();
        } catch (Exception e) {
            Log.w(TAG, "network error for " + url + ": " + e);
            lastProblem = e.getClass().getSimpleName();
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }
}
