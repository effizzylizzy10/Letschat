package com.letschatafrica.chatbubble;

import android.content.Context;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Runs the real MessagePoller loop against a fake Letschat server and checks what it would show. */
public class Harness {
    static final Object LOCK = new Object();
    static class Msg { String id = "", sender, text; long time; String mentions; String replySender; boolean deleted; boolean system; }
    static class Chat {
        String id, kind, name, otherId, otherName; boolean room;
        List<Msg> msgs = new ArrayList<Msg>();
        List<String[]> members = new ArrayList<String[]>();
    }
    static final Map<String, Chat> chats = new LinkedHashMap<String, Chat>();
    static String settings = "{\"muted\":{\"dmM\":0},\"blocked\":[{\"id\":\"blk\",\"name\":\"Blocked Guy\"}]}";
    static int settingsStatus = 200;
    static long clock = 1700000000000L;
    static final List<String> requests = Collections.synchronizedList(new ArrayList<String>());
    static int failures = 0;

    static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
    static String msgJson(Msg m) {
        StringBuilder sb = new StringBuilder("{");
        if (!m.id.isEmpty()) sb.append("\"id\":").append(q(m.id)).append(',');
        sb.append("\"senderId\":").append(q(m.sender)).append(",\"text\":").append(q(m.text)).append(",\"time\":").append(m.time).append(",\"read\":false");
        if (m.mentions != null) sb.append(",\"mentions\":[").append(q(m.mentions)).append(']');
        if (m.replySender != null) sb.append(",\"replyTo\":{\"id\":\"old\",\"senderId\":").append(q(m.replySender)).append(",\"name\":\"Someone\",\"text\":\"earlier\"}");
        if (m.deleted) sb.append(",\"deleted\":true");
        if (m.system) sb.append(",\"system\":true");
        return sb.append('}').toString();
    }
    static String chatJson(Chat c) {
        StringBuilder sb = new StringBuilder("{\"id\":").append(q(c.id));
        if (c.kind.equals("dm")) {
            sb.append(",\"other\":{\"id\":").append(q(c.otherId)).append(",\"name\":").append(q(c.otherName)).append(",\"avatar\":\"/api/users/").append(c.otherId).append("/avatar?v=1\"}");
        } else {
            sb.append(",\"isGroup\":true,\"name\":").append(q(c.name)).append(",\"avatar\":null,\"members\":[");
            for (int i = 0; i < c.members.size(); i++) { if (i > 0) sb.append(','); sb.append("{\"id\":").append(q(c.members.get(i)[0])).append(",\"name\":").append(q(c.members.get(i)[1])).append('}'); }
            sb.append(']');
            if (c.room) sb.append(",\"chatRoom\":true,\"memberCount\":3");
        }
        sb.append(",\"lastMessage\":").append(c.msgs.isEmpty() ? "null" : msgJson(c.msgs.get(c.msgs.size() - 1)));
        return sb.append(",\"unread\":0}").toString();
    }
    static Chat dm(String id, String otherId, String otherName) { Chat c = new Chat(); c.id = id; c.kind = "dm"; c.otherId = otherId; c.otherName = otherName; chats.put(id, c); return c; }
    static Chat group(String id, String name, boolean room, String... members) {
        Chat c = new Chat(); c.id = id; c.kind = "group"; c.name = name; c.room = room;
        for (int i = 0; i + 1 < members.length; i += 2) c.members.add(new String[] { members[i], members[i + 1] });
        chats.put(id, c); return c;
    }
    static Msg add(String chat, String id, String sender, String text) { synchronized (LOCK) { return addLocked(chat, id, sender, text); } }
    static Msg addLocked(String chat, String id, String sender, String text) {
        Msg m = new Msg(); m.id = id; m.sender = sender; m.text = text; m.time = (clock += 1000);
        chats.get(chat).msgs.add(m); return m;
    }

    static void send(HttpExchange ex, int code, String body) throws IOException {
        byte[] b = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json");
        ex.sendResponseHeaders(code, b.length);
        OutputStream os = ex.getResponseBody(); os.write(b); os.close();
    }

    static void check(String name, boolean ok) { System.out.println((ok ? "PASS  " : "FAIL  ") + name); if (!ok) failures++; }
    static void pause(long ms) { try { Thread.sleep(ms); } catch (InterruptedException e) { } }
    static List<MessagePopup.Item> shown() { synchronized (MessagePopup.SHOWN) { return new ArrayList<MessagePopup.Item>(MessagePopup.SHOWN); } }
    static void clear() { MessagePopup.SHOWN.clear(); }
    static List<String> texts() { List<String> out = new ArrayList<String>(); for (MessagePopup.Item i : shown()) out.add(i.title + " | " + i.text); return out; }
    /** How many "Letschat check: ..." status toasts (the temporary diagnostics on the chat head) contain this text. */
    static int statusCount(String part) {
        int n = 0;
        synchronized (BubbleController.STATUS) { for (String s : BubbleController.STATUS) if (s.startsWith("Letschat check | ") && s.contains(part)) n++; }
        return n;
    }
    static boolean statusHas(String part) { return statusCount(part) > 0; }
    static void clearStatus() { BubbleController.STATUS.clear(); }

    public static void main(String[] args) throws Exception {
        HttpServer srv = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        srv.createContext("/", new HttpHandler() {
            public void handle(HttpExchange ex) throws IOException {
                String path = ex.getRequestURI().getPath();
                String qs = ex.getRequestURI().getRawQuery();
                requests.add(path + (qs == null ? "" : "?" + qs));
                if (!"Bearer tok123".equals(ex.getRequestHeaders().getFirst("Authorization"))) { send(ex, 401, "{\"success\":false}"); return; }
                synchronized (LOCK) {
                    if (path.equals("/api/v1/conversations")) {
                        StringBuilder sb = new StringBuilder("[");
                        boolean first = true;
                        for (Chat c : chats.values()) { if (!first) sb.append(','); first = false; sb.append(chatJson(c)); }
                        sb.append(']');
                        send(ex, 200, "{\"success\":true,\"data\":{\"conversations\":" + sb + "}}");
                    } else if (path.matches("/api/v1/conversations/[^/]+/messages")) {
                        Chat c = chats.get(path.split("/")[4]);
                        if (c == null) { send(ex, 404, "{\"success\":false}"); return; }
                        StringBuilder sb = new StringBuilder("[");
                        for (int i = 0; i < c.msgs.size(); i++) { if (i > 0) sb.append(','); sb.append(msgJson(c.msgs.get(i))); }
                        sb.append(']');
                        send(ex, 200, "{\"success\":true,\"data\":{\"messages\":" + sb + ",\"peek\":true,\"hasMore\":false}}");
                    } else if (path.equals("/api/v1/me/settings")) {
                        send(ex, settingsStatus, "{\"success\":true,\"data\":" + settings + "}");
                    } else send(ex, 404, "{\"success\":false}");
                }
            }
        });
        srv.start();
        String api = "http://127.0.0.1:" + srv.getAddress().getPort();

        // starting data
        synchronized (LOCK) {
            dm("dm1", "bob", "Bob"); addLocked("dm1", "b1", "bob", "hi");
            dm("dm2", "cara", "Cara"); addLocked("dm2", "c1", "cara", "yo"); addLocked("dm2", "c2", "me", "ok");
            group("grp", "Family", false, "me", "Me", "dan", "Dan", "finn", "Finn"); addLocked("grp", "g1", "dan", "welcome");
            group("room", "Chat Room", true, "me", "Me", "eve", "Eve", "dan", "Dan"); addLocked("room", "r1", "eve", "hello room");
            dm("dmM", "mia", "Mia"); addLocked("dmM", "mm1", "mia", "hey");
            dm("dmE", "zed", "Zed");   // no messages yet
            dm("dmN", "nia", "Nia"); addLocked("dmN", "", "nia", "no id one");   // a server that sends no message ids
        }

        Context ctx = new Context();
        ctx.getSharedPreferences("letschat_chat_bubble", 0).edit().putString("token", "tok123").putString("apiUrl", api + "/").putString("userId", "me").apply();
        MessagePoller.ensureRunning(ctx);

        // 1. nothing is shown for what was already there
        pause(900);
        check("baseline: existing messages give no toast", shown().isEmpty());
        check("baseline: it asked for the chat list", requests.contains("/api/v1/conversations"));
        check("baseline: the status toast says it is watching 7 chats (and that one has no message id)", statusHas("watching 7 chats for new messages (1 chats have a last message without an id"));

        // 2. a new direct message
        add("dm1", "b2", "bob", "Are you there?");
        pause(700);
        List<MessagePopup.Item> s = shown();
        check("dm: exactly one toast", s.size() == 1);
        if (s.size() == 1) {
            check("dm: title is the sender, text is the message", s.get(0).title.equals("Bob") && s.get(0).text.equals("Are you there?"));
            check("dm: chat id and message id passed on", s.get(0).chatId.equals("dm1") && s.get(0).id.equals("b2"));
            check("dm: avatar url is made absolute", s.get(0).avatar.equals(api + "/api/users/bob/avatar?v=1"));
        }
        check("dm: it read the messages with peek=1 (does not mark them read)", requests.contains("/api/v1/conversations/dm1/messages?peek=1&limit=15"));
        clear();

        // 3. two group messages in one go: both shown, with the sender's name
        synchronized (LOCK) { addLocked("grp", "g2", "dan", "Dinner at 8"); addLocked("grp", "g3", "finn", "I am coming"); }
        pause(700);
        check("group: two toasts in order, with names", texts().equals(Arrays.asList("Family | Dan: Dinner at 8", "Family | Finn: I am coming")));
        clear();

        // 4. a muted chat stays quiet
        add("dmM", "mm2", "mia", "ping");
        pause(700);
        check("muted chat: no toast", shown().isEmpty());
        check("muted chat: the settings were read", requests.contains("/api/v1/me/settings"));
        clear();

        // 5. Chat Room: quiet unless mentioned or replied to
        add("room", "r2", "eve", "anyone here?");
        pause(700);
        check("chat room: plain message gives no toast", shown().isEmpty());
        int before = requests.size();
        Msg r3 = add("room", "r3", "eve", "@me look at this"); r3.mentions = "me";
        pause(700);
        check("chat room: a message that @mentions me gives a toast", texts().equals(Arrays.asList("Chat Room | Eve: @me look at this")));
        clear();
        Msg r4 = add("room", "r4", "dan", "replying to you"); r4.replySender = "me";
        pause(700);
        check("chat room: a reply to me gives a toast, with the quote", shown().size() == 1 && shown().get(0).replyName.equals("You") && shown().get(0).replyText.equals("earlier"));
        clear();

        // 6. my own message from another device
        add("dm2", "c3", "me", "typed on my laptop");
        pause(700);
        check("own message from another device: no toast", shown().isEmpty());
        check("own message from another device: the status toast says it looks like it was sent by me", statusHas("new message ignored: it looks like it was sent by you."));

        // 7. blocked person in a group
        add("grp", "g4", "blk", "spam spam");
        pause(700);
        check("blocked person: no toast", shown().isEmpty());

        // 8. newest message vanished (expired): an older one is last now
        synchronized (LOCK) { List<Msg> l = chats.get("dm1").msgs; l.remove(l.size() - 1); }
        pause(700);
        check("expired newest message: no toast for the older one", shown().isEmpty());

        // 9. a message with no id on the server side
        add("dmN", "", "nia", "second without id");
        pause(700);
        check("server without message ids: still detected", texts().equals(Arrays.asList("Nia | second without id")));
        clear();

        // 10. first message in an empty chat
        add("dmE", "z1", "zed", "first ever");
        pause(700);
        check("first message of an empty chat: toast", texts().equals(Arrays.asList("Zed | first ever")));
        clear();

        // 11. settings cannot be read: fail open (a toast too many beats a missed message)
        settingsStatus = 500;
        add("dmM", "mm3", "mia", "again");
        pause(700);
        check("settings unreadable: muted chat still toasts (fail open)", texts().equals(Arrays.asList("Mia | again")));
        settingsStatus = 200;
        clear();

        // 12. deleted last message: nothing
        Msg d = add("dm1", "b5", "bob", "oops"); d.deleted = true;
        pause(700);
        check("deleted message: no toast", shown().isEmpty());

        // 13. overlay permission off: a normal notification, with a count for several messages
        android.provider.Settings.OVERLAY = false;
        android.content.res.Resources.STAT_ICON = 777;
        synchronized (LOCK) { addLocked("dm1", "b6", "bob", "one"); addLocked("dm1", "b7", "bob", "two"); }
        pause(700);
        check("overlay off: no chat-head toast", shown().isEmpty());
        List<android.app.Notification> posted = ctx.nm.posted;
        check("overlay off: one notification posted", posted.size() == 1);
        if (posted.size() == 1) {
            check("overlay off: title is the sender", posted.get(0).title.equals("Bob"));
            check("overlay off: text is the newest message plus a count", posted.get(0).text.equals("two  (+1 more)"));
            check("overlay off: uses the Letschat status icon when the build has one", posted.get(0).icon == 777);
        }
        check("overlay off: channel created once", ctx.nm.channels.size() == 1);
        android.content.res.Resources.STAT_ICON = 0;
        add("dm1", "b8", "bob", "three");
        pause(700);
        check("overlay off: second notification falls back to Android's chat icon", ctx.nm.posted.size() == 2 && ctx.nm.posted.get(1).icon == 17301647);
        android.provider.Settings.OVERLAY = true;

        // 14. the app comes to the front: nothing is polled; back to the background: counting starts again from then (no old toasts)
        MessagePoller.setForeground(true);
        pause(400);
        add("dm1", "b9", "bob", "while the app is open");
        int reqs = requests.size();
        pause(700);
        check("foreground: the poller does not ask the server", requests.size() == reqs);
        MessagePoller.setForeground(false);
        pause(700);
        check("back to background: the message seen on screen is not toasted again", shown().isEmpty());
        add("dm1", "b10", "bob", "after leaving");
        pause(700);
        check("back to background: a newer message is toasted", texts().equals(Arrays.asList("Bob | after leaving")));
        clear();

        // 15. the person turns the bubble off: silence, and no polling
        ctx.getSharedPreferences("letschat_chat_bubble", 0).edit().putBoolean("enabled", false).apply();
        pause(400);
        add("dm1", "b11", "bob", "bubble is off");
        pause(700);
        check("bubble switched off: no toast", shown().isEmpty());
        check("bubble switched off: the status toast says the Floating chat bubble setting is OFF", statusHas("the Floating chat bubble setting is OFF."));
        ctx.getSharedPreferences("letschat_chat_bubble", 0).edit().putBoolean("enabled", true).apply();
        pause(700);
        add("dm1", "b12", "bob", "bubble is on again");
        pause(700);
        check("bubble switched on again: counting restarts, new message toasts", texts().equals(Arrays.asList("Bob | bubble is on again")));
        clear();

        // 16. system notices ("Finn joined the group") never toast
        synchronized (LOCK) { Msg sm = addLocked("grp", "s1", "system", "Finn joined the group"); sm.system = true; }
        pause(700);
        check("system message: no toast", shown().isEmpty());

        // 17. "Group messages" switched off in Settings > Notifications: groups are quiet, direct messages are not
        MessagePoller.setPrefs(ctx, true, false);
        pause(400);
        add("grp", "g5", "dan", "group text while groups are off");
        add("dm1", "b13", "bob", "direct text while groups are off");
        pause(700);
        check("groups off: group message gives no toast, direct message does", texts().equals(Arrays.asList("Bob | direct text while groups are off")));
        clear();
        MessagePoller.setPrefs(ctx, true, true);

        // 18. "Show message preview" switched off: the text is hidden, mentions and replies are still hinted
        MessagePoller.setPrefs(ctx, false, true);
        pause(400);
        Msg p1; synchronized (LOCK) { p1 = addLocked("dm1", "b14", "bob", "my secret"); p1.replySender = "me"; }
        pause(700);
        check("preview off: a reply shows 'Replied to you' and no quote", shown().size() == 1 && shown().get(0).text.equals("Replied to you") && shown().get(0).replyText.isEmpty() && shown().get(0).replyName.isEmpty());
        clear();
        Msg p2; synchronized (LOCK) { p2 = addLocked("grp", "g6", "dan", "private plan"); p2.mentions = "me"; }
        pause(700);
        check("preview off: a mention in a group shows who and 'Mentioned you'", texts().equals(Arrays.asList("Family | Dan: Mentioned you")));
        clear();
        add("dm1", "b15", "bob", "another secret");
        pause(700);
        check("preview off: a plain message shows 'New message', never the text", texts().equals(Arrays.asList("Bob | New message")));
        clear();
        MessagePoller.setPrefs(ctx, true, true);
        pause(400);
        add("dm1", "b16", "bob", "visible again");
        pause(700);
        check("preview back on: the text shows again", texts().equals(Arrays.asList("Bob | visible again")));
        clear();

        // 19. the checker's own problems are told on the chat head ("Letschat check: ..."); none of them is a message toast
        clearStatus();
        ctx.getSharedPreferences("letschat_chat_bubble", 0).edit().putString("apiUrl", "http://127.0.0.1:1").apply(); // nothing listens there
        pause(700);
        check("status toast: server not reachable", statusHas("cannot reach the server right now ("));
        ctx.getSharedPreferences("letschat_chat_bubble", 0).edit().putString("apiUrl", api + "/").apply();
        pause(500);
        clearStatus();
        ctx.getSharedPreferences("letschat_chat_bubble", 0).edit().putString("token", "wrong-token").apply();
        pause(700);
        check("status toast: the server refused the sign-in", statusHas("the server refused your sign-in. Open Letschat, sign out and in again."));
        MessagePoller.stop(); // after a refusal the checker waits a minute; start a new one
        clearStatus();
        ctx.getSharedPreferences("letschat_chat_bubble", 0).edit().putString("token", "tok123").apply();
        MessagePoller.ensureRunning(ctx);
        ctx.getSharedPreferences("letschat_chat_bubble", 0).edit().remove("token").apply(); // signed out before the first check
        pause(700);
        check("status toast: not signed in", statusHas("not signed in. Open Letschat and sign in."));
        check("not signed in: the checker ended, no message toast", shown().isEmpty());
        clearStatus();
        MessagePoller.setForeground(true);
        MessagePoller.setForeground(false); // the app is minimised while no checker runs
        pause(500);
        check("status toast: the checker is not running", statusCount("not running (no sign-in received yet)") == 1);
        MessagePoller.setForeground(true);
        MessagePoller.setForeground(false);
        pause(500);
        check("status toast: the same text is not repeated within a minute", statusCount("not running (no sign-in received yet)") == 1);
        check("status toasts never use the message pop-up", shown().isEmpty());

        System.out.println();
        for (String l : new ArrayList<String>(android.util.Log.LINES)) System.out.println("  log " + l);
        MessagePoller.stop();
        srv.stop(0);
        System.out.println(failures == 0 ? "\nALL CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
        System.exit(failures == 0 ? 0 : 1);
    }
}
