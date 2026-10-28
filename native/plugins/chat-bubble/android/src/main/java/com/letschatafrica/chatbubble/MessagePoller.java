package com.letschatafrica.chatbubble;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Looks for new messages from inside the Android process, without the web page, so a new message can be announced while Letschat is
 * minimised or closed (the foreground service keeps this process alive). It asks the Letschat server for the conversation list
 * every few seconds while the app is not on screen and reacts when a chat's LAST MESSAGE changes and is not mine.
 * (It does not use the unread counter: the page, still alive in the background, can mark a message read at once, which would hide it.)
 * The web page hands over the sign-in token with ChatBubble.setSession (see letschat-native-bridge.js).
 *
 * BACKGROUND ALERT: every new message in a chat that is not muted is announced with a normal Android notification (sound, vibration,
 * pops up on screen, shows on the lock screen without the text). It does not depend on "Display over other apps" or on the
 * Floating chat bubble setting. Tapping it opens Letschat on that chat. The notifications are removed again when Letschat is opened.
 * When the bubble is switched on and "Display over other apps" is allowed, the chat head pop-up is shown as well.
 *
 * The /api/v1 routes answer with an envelope {"success":true,"data":{...}}; unwrap() reads both that and a bare body.
 * Everything it decides is written to the Android log under the tag LetschatPoller (adb logcat -s LetschatPoller).
 *
 * STATUS TOAST (temporary, for finding why a toast does not show): after the app is minimised, and whenever the checker has a problem
 * (not signed in, server refuses the token, no connection, odd answer), a toast on the chat head says so in plain words ("Letschat check: ...").
 */
public final class MessagePoller {

    private static final String TAG = "LetschatPoller";
    private static final String PREFS = "letschat_chat_bubble";
    private static final String NOTICE_CHANNEL = "letschat_new_message";
    /** Extra on the notification's intent: the chat to open (read again by ChatBubblePlugin). */
    static final String EXTRA_CHAT_ID = "letschat_chat_id";
    private static final long FIRST_WAIT_MS = 2500;
    private static final long INTERVAL_MS = 8000;
    /** After the server refuses the token, check again only this rarely (the page may send a fresh token meanwhile). */
    private static final long REFUSED_WAIT_MS = 60000;
    /** The status toast waits this long so the chat head (which appears 0.7 s after minimising) does not wipe it. */
    private static final long STATUS_DELAY_MS = 1800;

    private static final Object LOCK = new Object();
    private static boolean wake = false;

    private static volatile Thread worker;
    private static volatile boolean foreground = false;
    private static Context appCtx;
    private static String lastStatus = "";
    private static long lastStatusAt = 0;
    /** Ids of the message notifications on screen (removed when Letschat is opened). */
    private static final Set<Integer> postedNotices = new HashSet<>();

    private MessagePoller() {}

    /** Called by the page after sign-in (token) and after sign-out (empty token). */
    public static synchronized void setSession(Context ctx, String token, String apiUrl, String userId) {
        Context app = ctx.getApplicationContext();
        SharedPreferences.Editor ed = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (token == null || token.isEmpty()) {
            Log.i(TAG, "signed out: poller stops");
            ed.remove("token").remove("apiUrl").remove("userId").apply();
            stop();
            clearNotices(app);
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
        if (on) {
            Context ctx = appCtx;
            if (ctx != null) clearNotices(ctx); // the person is looking at Letschat: the message notifications are no longer needed
        }
        if (was && !on) {
            synchronized (LOCK) {
                wake = true;
                LOCK.notifyAll();
            }
            // nothing to tell the person when the poller is not running at all: say so (a few seconds after minimising)
            Context ctx = appCtx;
            Thread w = worker;
            if (ctx != null && (w == null || !w.isAlive())) status(ctx, "not running (no sign-in received yet). Open Letschat and sign in once.");
        }
    }

    /** Removes the message notifications this class posted (never the "Connected" notification of the background service). */
    private static void clearNotices(Context ctx) {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            synchronized (postedNotices) {
                Iterator<Integer> it = postedNotices.iterator();
                while (it.hasNext()) {
                    nm.cancel(it.next());
                    it.remove();
                }
            }
        } catch (Throwable ignored) {}
    }

    /** The live connection just showed the chat head for a message. (Kept for the plugin; duplicates are removed by message id in MessagePopup.) */
    static void noteSocketShow() {}

    /**
     * Temporary status toast on the chat head, plus a line in the log. The same text is not repeated within a minute.
     * It waits a moment so the chat head (which comes up 0.7 s after minimising) does not hide it again.
     */
    private static void status(final Context ctx, final String text) {
        long now = System.currentTimeMillis();
        if (text.equals(lastStatus) && now - lastStatusAt < 60000) return;
        lastStatus = text;
        lastStatusAt = now;
        Log.i(TAG, "status: " + text);
        try {
            if (!Settings.canDrawOverlays(ctx)) return;
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (foreground) return; // the app is on screen again
                        BubbleController.get(ctx).show(0, "Letschat check", text, "", "");
                    } catch (Throwable ignored) {}
                }
            }, STATUS_DELAY_MS);
        } catch (Throwable ignored) {}
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
                    status(ctx, "not signed in. Open Letschat and sign in.");
                    return;
                }
                // (the Floating chat bubble setting no longer stops the checker: the notification alert works with the bubble switched off)
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
                    status(ctx, "the server refused your sign-in. Open Letschat, sign out and in again.");
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
                    Log.i(TAG, "started counting: " + nowIds.size() + " chats");
                    String extra = noId > 0 ? " (" + noId + " chats have a last message without an id!)" : "";
                    status(ctx, "watching " + nowIds.size() + " chats for new messages" + extra + ".");
                } else if (!fresh.isEmpty() || fromMe > 0) {
                    Log.i(TAG, "new: " + fresh.size() + " chats, ignored " + fromMe + " sent by me (userId " + (myId.isEmpty() ? "MISSING" : "ok") + ")");
                    if (fresh.isEmpty() && fromMe > 0) status(ctx, "new message ignored: it looks like it was sent by you.");
                }
                lastIds = nowIds;
                lastTimes = nowTimes;
                for (int i = 0; i < fresh.size(); i++) {
                    present(ctx, api, token, fresh.get(i), since.get(i), myId);
                }
            } catch (Throwable e) {
                // a bad answer from the server (or any other failure): try again next time, never crash the app
                Log.w(TAG, "check failed: " + e);
                Context ctx = appCtx;
                if (ctx != null) status(ctx, "check failed: " + e.getClass().getSimpleName() + ".");
            }
        }
    }

    /** Announces the new messages of one chat: a notification always, plus the WhatsApp-style pop-up ("1 of N") when the bubble can be drawn. */
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
            // the server said there is something new but we could not read it: still show the toast so the person knows
            items.add(new MessagePopup.Item("", chatId, title, photo, "New message", "", ""));
        }
        boolean bubbleOn = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", true);
        boolean canOverlay = Settings.canDrawOverlays(ctx);
        Log.i(TAG, "announcing " + items.size() + " message(s) from " + title + " (notification" + (bubbleOn && canOverlay ? " + chat head" : "") + ")");
        postNotice(ctx, title, items, chatId); // the background alert: always
        if (bubbleOn && canOverlay) {
            for (MessagePopup.Item it : items) MessagePopup.notifyMessage(ctx, it);
        }
    }

    /**
     * The background alert: a normal Android notification for the new message(s) of one chat (one notification per chat, updated when more
     * arrive). Sound and vibration come from the "New messages" channel; the person can change them in the phone's notification settings.
     * Tapping it opens Letschat on that chat.
     */
    private static void postNotice(Context ctx, String title, List<MessagePopup.Item> items, String chatId) {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (!nm.areNotificationsEnabled()) {
                Log.i(TAG, "notifications are switched off for Letschat in the phone settings");
                return;
            }
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(NOTICE_CHANNEL, "New messages", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Alerts for new Letschat messages while the app is closed or in the background");
                ch.enableVibration(true);
                ch.enableLights(true);
                ch.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
                nm.createNotificationChannel(ch);
            }
            Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            PendingIntent pi = null;
            if (open != null) {
                open.putExtra(EXTRA_CHAT_ID, chatId);
                open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                pi = PendingIntent.getActivity(ctx, chatId.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            }
            int small = ctx.getResources().getIdentifier("ic_stat_letschat", "drawable", ctx.getPackageName());
            if (small == 0) small = ctx.getApplicationInfo().icon;
            String last = items.get(items.size() - 1).text;
            StringBuilder lines = new StringBuilder();
            for (int i = Math.max(0, items.size() - 5); i < items.size(); i++) {
                if (lines.length() > 0) lines.append('\n');
                lines.append(items.get(i).text);
            }
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, NOTICE_CHANNEL) : new Notification.Builder(ctx);
            b.setSmallIcon(small)
                .setContentTitle(title)
                .setContentText(last)
                .setStyle(new Notification.BigTextStyle().bigText(lines.toString()))
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setAutoCancel(true);
            if (Build.VERSION.SDK_INT < 26) {
                b.setPriority(Notification.PRIORITY_HIGH);
                b.setDefaults(Notification.DEFAULT_ALL);
            }
            if (pi != null) b.setContentIntent(pi);
            int id = chatId.hashCode();
            nm.notify(id, b.build());
            synchronized (postedNotices) {
                postedNotices.add(id);
            }
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

    /** What went wrong the last time get() returned null (shown in the status toast). */
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
