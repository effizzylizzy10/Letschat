package com.letschatafrica.chatbubble;
import android.content.Context;
import java.util.*;
/** Test stand-in: records the "Letschat check: ..." status toasts the poller puts on the chat head (same show() signature as the real BubbleController). */
final class BubbleController {
    static final List<String> STATUS = Collections.synchronizedList(new ArrayList<String>());
    private static final BubbleController ONE = new BubbleController();
    static BubbleController get(Context context) { return ONE; }
    void show(final int count, final String title, final String text, final String id, final String avatar) { STATUS.add(title + " | " + text); }
}
