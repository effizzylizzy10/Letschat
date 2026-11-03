package com.letschatafrica.chatbubble;
import android.content.Context;
import java.util.*;
/** Test stand-in: records what the poller asked to show (same Item shape as the real MessagePopup). */
final class MessagePopup {
    static final List<Item> SHOWN = Collections.synchronizedList(new ArrayList<Item>());
    static final class Item {
        final String id, chatId, title, avatar, text, replyName, replyText;
        Item(String id, String chatId, String title, String avatar, String text, String replyName, String replyText) {
            this.id = id; this.chatId = chatId; this.title = title; this.avatar = avatar; this.text = text; this.replyName = replyName; this.replyText = replyText;
        }
    }
    static void notifyMessage(Context context, Item item) { SHOWN.add(item); }
}
