package com.letschatafrica.chatbubble;

import android.content.Context;
import android.content.SharedPreferences;
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
 * every few seconds while the app is not on screen and pops the chat head up when an unread count goes up.
 * The web page hands over the sign-in token with ChatBubble.setSession (see letschat-native-bridge.js).
 */
public final class MessagePoller {

    private static final String PREFS = "letschat_chat_bubble";
    private static final long FIRST_WAIT_MS = 2500;
    private static final long INTERVAL_MS = 15000;
    /** A message the live connection already showed a moment ago is not shown a second time. */
    private static final long SOCKET_QUIET_MS = 45000;

    private static volatile Thread worker;
    private static volatile boolean foreground = false;
    private static volatile long lastSocketShow = 0;
    private static Context appCtx;

    private MessagePoller() {}

    /** Called by the page after sign-in (token) and after sign-out (empty token). */
    public static synchronized void setSession(Context ctx, String token, String apiUrl, String userId) {
        Context app = ctx.getApplicationContext();
        SharedPreferences.Editor ed = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (token == null || token.isEmpty()) {
            ed.remove("token").remove("apiUrl").remove("userId").apply();
            stop();
            return;
        }
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
                } catch (Throwable ignored) {}
            }
        }, "letschat-message-poller");
        t.setDaemon(true);
        worker = t;
        t.start();
    }

    static synchronized void stop() {
        Thread w = worker;
        worker = null;
        if (w != null) w.interrupt();
    }

    /** True while Letschat is on screen (the page itself shows messages then). */
    static void setForeground(boolean on) {
        foreground = on;
    }

    /** The live connection just showed the chat head for a message. */
    static void noteSocketShow() {
        lastSocketShow = System.currentTimeMillis();
    }

    private static void loop() {
        final Thread self = Thread.currentThread();
        Map<String, Integer> seen = null;
        long wait = FIRST_WAIT_MS;
        while (worker == self) {
            try {
                Thread.sleep(wait);
            } catch (InterruptedException e) {
                return;
            }
            wait = INTERVAL_MS;
            if (worker != self) return;
            if (foreground) {
                seen = null; // when the app goes to the background again, start counting from then
                continue;
            }
            try {
                Context ctx = appCtx;
                if (ctx == null) return;
                SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                String token = sp.getString("token", "");
                String api = sp.getString("apiUrl", "");
                if (token.isEmpty() || api.isEmpty()) return;
                if (!sp.getBoolean("enabled", true)) {
                    seen = null;
                    continue;
                }
                while (api.endsWith("/")) api = api.substring(0, api.length() - 1);
                String body = get(api + "/api/v1/conversations", token);
                if (body == null) continue; // no network right now: try again next time
                if (body.isEmpty()) return; // sign-in expired: wait for the page to send a new token
                JSONArray list = new JSONObject(body).optJSONArray("conversations");
                if (list == null) continue;
                Map<String, Integer> now = new HashMap<>();
                int total = 0;
                int bestGain = 0;
                JSONObject best = null;
                for (int i = 0; i < list.length(); i++) {
                    JSONObject c = list.optJSONObject(i);
                    if (c == null) continue;
                    String id = str(c, "id");
                    if (id.isEmpty()) continue;
                    int unread = c.optInt("unread", 0);
                    boolean muted = c.optBoolean("muted", false);
                    now.put(id, unread);
                    if (muted) continue;
                    total += unread;
                    if (seen != null) {
                        Integer before = seen.get(id);
                        int gain = unread - (before == null ? 0 : before);
                        if (gain > bestGain) {
                            bestGain = gain;
                            best = c;
                        }
                    }
                }
                seen = now;
                if (best != null && total > 0 && System.currentTimeMillis() - lastSocketShow > SOCKET_QUIET_MS) {
                    present(ctx, api, token, best, bestGain, sp.getString("userId", ""));
                }
            } catch (Throwable ignored) {
                // a bad answer from the server (or any other failure): try again next time, never crash the app
            }
        }
    }

    /** Shows the new messages of one chat in the WhatsApp-style pop-up (one page per message, "1 of N"). */
    private static void present(Context ctx, String api, String token, JSONObject c, int gain, String myId) {
        String chatId = str(c, "id");
        JSONObject other = c.optJSONObject("other");
        boolean group = c.optBoolean("isGroup", false);
        String title = group ? str(c, "name") : str(other, "name");
        if (title.isEmpty()) title = "Letschat";
        String photo = group ? str(c, "avatar") : str(other, "avatar");
        if (photo.startsWith("/")) photo = api + photo;

        List<MessagePopup.Item> items = new ArrayList<>();
        try {
            int want = Math.max(1, Math.min(gain, 15));
            String body = get(api + "/api/v1/conversations/" + URLEncoder.encode(chatId, "UTF-8") + "/messages?peek=1&limit=" + (want + 4), token);
            if (body != null && !body.isEmpty()) {
                JSONArray arr = new JSONObject(body).optJSONArray("messages");
                List<JSONObject> picked = new ArrayList<>();
                if (arr != null) {
                    for (int i = arr.length() - 1; i >= 0 && picked.size() < want; i--) {
                        JSONObject m = arr.optJSONObject(i);
                        if (m == null) continue;
                        if (!myId.isEmpty() && myId.equals(str(m, "senderId"))) continue; // my own message
                        picked.add(0, m);
                    }
                }
                for (JSONObject m : picked) items.add(toItem(m, chatId, title, photo, group, myId));
            }
        } catch (Exception ignored) {
            // fall back to the last message below
        }
        if (items.isEmpty()) {
            JSONObject last = c.optJSONObject("lastMessage");
            if (last != null) items.add(toItem(last, chatId, title, photo, group, myId));
        }
        for (MessagePopup.Item it : items) MessagePopup.notifyMessage(ctx, it);
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
            if (code != 200) return null;
            InputStream in = c.getInputStream();
            BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            return sb.toString();
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }
}
