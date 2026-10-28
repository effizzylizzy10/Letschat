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
import java.util.Iterator;
import java.util.List;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Looks for new messages from inside the Android process, without the web page, so a new message can be announced while Letschat is
 * minimised or closed (the foreground service keeps this process alive). It asks the Letschat server for the conversation list
 * every few seconds while the app is not on screen and reacts when a chat's LAST MESSAGE changes and is not mine.
 * (It does not use the unread counter: the page, still alive in the background, can mark a message read at once, which would hide it.)
 * The app hands this checker the sign-in token (see ChatBubblePlugin.pushSessionFromPage and letschat-native-bridge.js).
 *
 * BACKGROUND ALERT: every new message that passes the rules below is announced with a normal Android notification (sound, vibration,
 * pops up on screen, shows on the lock screen without the text). It does not depend on "Display over other apps" or on the
 * Floating chat bubble setting. Tapping it opens Letschat on that chat. The notifications are removed again when Letschat is opened.
 * When the bubble is switched on and "Display over other apps" is allowed, the chat head pop-up is shown as well.
 *
 * The /api/v1 routes answer with an envelope {"success":true,"data":{...}}; unwrap() reads both that and a bare body.
 * Everything it decides is written to the Android log under the tag LetschatPoller (adb logcat -s LetschatPoller).
 * The old "Letschat check: ..." status toasts on the chat head are gone: the chat head only ever shows real messages. Problems
 * (not signed in, server refuses the token, no connection) are only written to the log.
 *
 * It follows the same rules as the server's own background alerts, so it is never louder than they would be:
 *  - a chat the person muted (GET /api/v1/me/settings, "muted") gives no alert;
 *  - a message from someone the person blocked gives no alert;
 *  - in the big Chat Room (every member is in it, many messages) only messages that @mention or reply to the person give an alert;
 *  - groups are quiet while "Group messages" is off, and "Show message preview" off hides the message text.
 * The mute/block list is read only at the moment something new is about to be shown, so it costs no extra requests otherwise.
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

    /** What the person asked not to be bothered by. */
    private static final class Quiet {
        final Set<String> mutedChats = new HashSet<>();
        final Set<String> blockedPeople = new HashSet<>();
        /** "Show message preview" is off in Settings > Notifications: the alert says "New message" instead of showing the text. */
        boolean hideText = false;
    }

    /**
     * Called by the page with the two switches of Settings > Notifications ("Show message preview", "Group messages"),
     * which only live in the page. Both are on unless the person turned them off.
     */
    public static void setPrefs(Context ctx, boolean preview, boolean groups) {
        ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("preview", preview).putBoolean("groups", groups).apply();
    }

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
            Context c = appCtx;
            if (c != null) clearNotices(c); // the person is looking at Letschat: the message notifications are no longer needed
        }
        if (was && !on) {
            synchronized (LOCK) {
                wake = true;
                LOCK.notifyAll();
            }
            // make sure the checker is running (it needs the stored sign-in); nothing is shown on screen about it
            Context ctx = appCtx;
            if (ctx != null) ensureRunning(ctx);
            Thread w = worker;
            if (ctx != null && (w == null || !w.isAlive())) status(ctx, "not running (no sign-in received yet). Open Letschat and sign in.");
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

    /**
     * Tells one chat's last message apart from the next: its id (the server gives every message one). A server that sends no id
     * is still handled, by time + sender + text. "" means the chat has no message yet.
     */
    private static String keyOf(JSONObject lm) {
        if (lm == null) return "";
        String id = str(lm, "id");
        if (!id.isEmpty()) return id;
        return lm.optLong("time", 0L) + "|" + str(lm, "senderId") + "|" + str(lm, "text").hashCode();
    }

    /** "mention" when the message @mentions the person, "reply" when it replies to one of theirs, else "". */
    private static String addressedTo(JSONObject m, String myId) {
        if (myId.isEmpty() || m == null) return "";
        JSONArray mentions = m.optJSONArray("mentions");
        if (mentions != null) {
            for (int i = 0; i < mentions.length(); i++) {
                if (myId.equals(mentions.optString(i, ""))) return "mention";
            }
        }
        JSONObject rt = m.optJSONObject("replyTo");
        return rt != null && myId.equals(str(rt, "senderId")) ? "reply" : "";
    }

    /** In the Chat Room only messages that @mention the person or reply to them are worth an alert (same rule as the server's alerts). */
    private static boolean addressedToMe(JSONObject m, String myId) {
        return !addressedTo(m, myId).isEmpty();
    }

    /** Whether one message should be shown to the person. */
    private static boolean wanted(JSONObject m, boolean chatRoom, String myId, Quiet quiet) {
        String sender = str(m, "senderId");
        if (!myId.isEmpty() && myId.equals(sender)) return false; // my own message
        if (m.optBoolean("deleted", false)) return false;
        if (m.optBoolean("system", false)) return false; // "Amaka joined the group" and the like: the website gives no alert for these either
        if (!sender.isEmpty() && quiet.blockedPeople.contains(sender)) return false; // someone I blocked
        return !chatRoom || addressedToMe(m, myId);
    }

    private static void loop() {
        final Thread self = Thread.currentThread();
        // what each chat's last message was at the previous check (null = not counting yet)
        Map<String, String> lastKeys = null;
        Map<String, Long> lastTimes = null;
        long wait = FIRST_WAIT_MS;
        while (worker == self) {
            if (!pause(wait)) return;
            wait = INTERVAL_MS;
            if (worker != self) return;
            if (foreground) {
                lastKeys = null; // when the app goes to the background again, start counting from then
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
                // (the Floating chat bubble setting does not stop the checker: the notification alert works with the bubble switched off)
                String myId = sp.getString("userId", "");
                boolean groupsOn = sp.getBoolean("groups", true);       // "Group messages" in Settings > Notifications
                boolean previewOn = sp.getBoolean("preview", true);     // "Show message preview"
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
                    lastKeys = null;
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
                Map<String, String> nowKeys = new HashMap<>();
                Map<String, Long> nowTimes = new HashMap<>();
                List<JSONObject> fresh = new ArrayList<>();
                List<Long> since = new ArrayList<>();
                int fromMe = 0;
                int hushed = 0;
                int noId = 0;
                for (int i = 0; i < list.length(); i++) {
                    JSONObject c = list.optJSONObject(i);
                    if (c == null) continue;
                    String id = str(c, "id");
                    if (id.isEmpty()) continue;
                    JSONObject lm = c.optJSONObject("lastMessage");
                    String key = keyOf(lm);
                    long lmTime = lm == null ? 0L : lm.optLong("time", 0L);
                    nowKeys.put(id, key);
                    nowTimes.put(id, lmTime);
                    if (lm != null && str(lm, "id").isEmpty()) noId++;
                    if (lastKeys == null || lm == null || key.isEmpty()) continue;
                    if (key.equals(lastKeys.get(id))) continue; // nothing new in this chat
                    Long before = lastTimes == null ? null : lastTimes.get(id);
                    // the newest message went away (it expired or was removed), so an OLDER one is last now: nothing new
                    if (before != null && before > 0 && lmTime > 0 && lmTime < before) continue;
                    if (!myId.isEmpty() && myId.equals(str(lm, "senderId"))) { // my own message (sent from another device)
                        fromMe++;
                        continue;
                    }
                    if (lm.optBoolean("deleted", false)) continue;
                    if (!groupsOn && c.optBoolean("isGroup", false)) continue; // "Group messages" is switched off
                    if (c.optBoolean("chatRoom", false) && !addressedToMe(lm, myId)) { // the Chat Room: only @mentions and replies
                        hushed++;
                        continue;
                    }
                    fresh.add(c);
                    since.add(before == null ? 0L : before);
                }
                if (lastKeys == null) {
                    Log.i(TAG, "started counting: " + nowKeys.size() + " chats");
                    String extra = noId > 0 ? " (" + noId + " chats have a last message without an id: checked by time and text instead)" : "";
                    status(ctx, "watching " + nowKeys.size() + " chats for new messages" + extra + ".");
                } else if (!fresh.isEmpty() || fromMe > 0 || hushed > 0) {
                    Log.i(TAG, "new: " + fresh.size() + " chats, ignored " + fromMe + " sent by me (userId " + (myId.isEmpty() ? "MISSING" : "ok") + "), " + hushed + " in the Chat Room");
                    if (fresh.isEmpty() && fromMe > 0) status(ctx, "new message ignored: it looks like it was sent by you.");
                }
                lastKeys = nowKeys;
                lastTimes = nowTimes;
                if (!fresh.isEmpty()) {
                    Quiet quiet = loadQuiet(api, token);
                    quiet.hideText = !previewOn;
                    for (int i = 0; i < fresh.size(); i++) {
                        JSONObject c = fresh.get(i);
                        if (quiet.mutedChats.contains(str(c, "id"))) {
                            Log.i(TAG, "chat is muted: no alert");
                            continue;
                        }
                        present(ctx, api, token, c, since.get(i), myId, quiet);
                    }
                }
            } catch (Throwable e) {
                // a bad answer from the server (or any other failure): try again next time, never crash the app
                Log.w(TAG, "check failed: " + e);
                Context ctx = appCtx;
                if (ctx != null) status(ctx, "check failed: " + e.getClass().getSimpleName() + ".");
            }
        }
    }

    /** The chats the person muted and the people they blocked. If that cannot be read, nothing is hidden (an alert too many beats a missed message). */
    private static Quiet loadQuiet(String api, String token) {
        Quiet q = new Quiet();
        try {
            String body = get(api + "/api/v1/me/settings", token);
            if (body == null || body.isEmpty()) return q;
            JSONObject s = unwrap(body);
            JSONObject muted = s.optJSONObject("muted"); // { chatId: untilTimestamp or 0 }, the server already left out expired mutes
            if (muted != null) {
                Iterator<String> keys = muted.keys();
                while (keys.hasNext()) q.mutedChats.add(keys.next());
            }
            JSONArray blocked = s.optJSONArray("blocked");
            if (blocked != null) {
                for (int i = 0; i < blocked.length(); i++) {
                    String id = str(blocked.optJSONObject(i), "id");
                    if (!id.isEmpty()) q.blockedPeople.add(id);
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "could not read the mute/block settings: " + e);
        }
        return q;
    }

    /** Announces the new messages of one chat: a notification always, plus the WhatsApp-style pop-up ("1 of N") when the bubble can be drawn. */
    private static void present(Context ctx, String api, String token, JSONObject c, long sinceTime, String myId, Quiet quiet) {
        String chatId = str(c, "id");
        JSONObject other = c.optJSONObject("other");
        boolean group = c.optBoolean("isGroup", false);
        boolean room = c.optBoolean("chatRoom", false);
        String title = group ? str(c, "name") : str(other, "name");
        if (title.isEmpty()) title = "Letschat";
        String photo = group ? str(c, "avatar") : str(other, "avatar");
        if (photo.startsWith("/")) photo = api + photo;

        List<MessagePopup.Item> items = new ArrayList<>();
        boolean read = false;
        try {
            String body = get(api + "/api/v1/conversations/" + URLEncoder.encode(chatId, "UTF-8") + "/messages?peek=1&limit=15", token);
            if (body != null && !body.isEmpty()) {
                JSONArray arr = unwrap(body).optJSONArray("messages");
                read = arr != null;
                List<JSONObject> picked = new ArrayList<>();
                if (arr != null) {
                    for (int i = arr.length() - 1; i >= 0 && picked.size() < 15; i--) {
                        JSONObject m = arr.optJSONObject(i);
                        if (m == null) continue;
                        long t = m.optLong("time", 0L);
                        if (sinceTime > 0 && t > 0 && t <= sinceTime) break; // older than what was already there
                        if (!wanted(m, room, myId, quiet)) continue;
                        picked.add(0, m);
                    }
                }
                for (JSONObject m : picked) items.add(toItem(m, c, chatId, title, photo, group, myId, quiet.hideText));
            }
        } catch (Exception e) {
            Log.w(TAG, "could not read the new messages: " + e);
            // fall back to the last message below
        }
        if (items.isEmpty() && !read) {
            // the messages could not be read: show the chat's last message (when it is new and wanted) so the person still hears about it
            JSONObject last = c.optJSONObject("lastMessage");
            if (last != null && wanted(last, room, myId, quiet) && (sinceTime <= 0 || last.optLong("time", 0L) > sinceTime)) {
                items.add(toItem(last, c, chatId, title, photo, group, myId, quiet.hideText));
            }
        }
        if (items.isEmpty()) {
            Log.i(TAG, "nothing to show for " + title + " (blocked, deleted, mine or not addressed to me)");
            return;
        }
        boolean bubbleOn = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", true);
        boolean canOverlay = Settings.canDrawOverlays(ctx);
        Log.i(TAG, "announcing " + items.size() + " message(s) from " + title + " (notification" + (bubbleOn && canOverlay ? " + chat head" : "") + ")");
        postNotice(ctx, title, items, chatId); // the background alert: always
        if (bubbleOn && canOverlay) {
            for (MessagePopup.Item it : items) MessagePopup.notifyMessage(ctx, it);
        }
    }

    /** The small status-bar icon: the Letschat one from the build when there is one, else Android's chat icon (same as the background service). */
    private static int smallIcon(Context ctx) {
        try {
            int icon = ctx.getResources().getIdentifier("ic_stat_letschat", "drawable", ctx.getPackageName());
            if (icon != 0) return icon;
        } catch (Throwable ignored) {
            // fall through to the built-in icon
        }
        return android.R.drawable.stat_notify_chat;
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
            if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(NOTICE_CHANNEL) == null) {
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
            String text = items.get(items.size() - 1).text;
            if (items.size() > 1) text = text + "  (+" + (items.size() - 1) + " more)";
            StringBuilder lines = new StringBuilder();
            for (int i = Math.max(0, items.size() - 5); i < items.size(); i++) {
                if (lines.length() > 0) lines.append('\n');
                lines.append(items.get(i).text);
            }
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, NOTICE_CHANNEL) : new Notification.Builder(ctx);
            b.setSmallIcon(smallIcon(ctx)).setContentTitle(title).setContentText(text).setAutoCancel(true)
                    .setStyle(new Notification.BigTextStyle().bigText(lines.toString())).setCategory(Notification.CATEGORY_MESSAGE);
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

    /** The name to put before a message in a group ("Amaka: hello"): the page's list of members knows everyone in the group. */
    private static String senderName(JSONObject m, JSONObject c) {
        String name = str(m.optJSONObject("sender"), "name"); // Chat Room messages carry their sender
        if (!name.isEmpty()) return name;
        name = str(m, "senderName");
        if (!name.isEmpty()) return name;
        String sid = str(m, "senderId");
        JSONArray members = c == null ? null : c.optJSONArray("members");
        if (members != null && !sid.isEmpty()) {
            for (int i = 0; i < members.length(); i++) {
                JSONObject u = members.optJSONObject(i);
                if (u != null && sid.equals(str(u, "id"))) return str(u, "name");
            }
        }
        return "";
    }

    private static MessagePopup.Item toItem(JSONObject m, JSONObject c, String chatId, String title, String photo, boolean group, String myId, boolean hideText) {
        String text;
        if (hideText) {
            // "Show message preview" is off: no message text, like the server's own background alerts
            String to = addressedTo(m, myId);
            text = "mention".equals(to) ? "Mentioned you" : "reply".equals(to) ? "Replied to you" : "New message";
        } else {
            // the server always writes a readable text (a voice note is "🎤 Voice note", a photo "📷 Photo"), so this only covers odd messages
            text = str(m, "text");
            if (text.isEmpty()) {
                String type = str(m, "type");
                text = (type.isEmpty() || "text".equals(type)) ? "New message" : "[" + type + "]";
            }
        }
        if (group) {
            String who = senderName(m, c);
            if (!who.isEmpty()) text = who + ": " + text;
        }
        if (text.length() > 500) text = text.substring(0, 500);
        String replyName = "";
        String replyText = "";
        JSONObject rt = hideText ? null : m.optJSONObject("replyTo");
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
