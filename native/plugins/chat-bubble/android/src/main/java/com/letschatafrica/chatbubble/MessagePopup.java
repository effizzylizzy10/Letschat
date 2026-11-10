package com.letschatafrica.chatbubble;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputType;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.util.LruCache;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.view.animation.AccelerateInterpolator;
import android.view.animation.DecelerateInterpolator;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.Locale;

/**
 * The Letschat message card, in the exact colours of the LetsChat Africa chat screen: a dark header band (round photo, sender name, and on
 * the right a thin divider with "1 of N" over the previous / next arrows, which step through the waiting messages), a middle area on the
 * black and white LetsChat Africa doodle wallpaper (client/wallpaper-dark.webp on the website: it is downloaded once, saved in the app's
 * private files and drawn behind the card; until it is there, or if it cannot be loaded, the middle is plain black) holding the received
 * message bubble with its time, the bubble of the reply just sent and the reply pill with the teal send button, and a dark bottom band
 * with Open chat / Close.
 * A tap anywhere outside the card minimizes it back into the chat head (the waiting messages are kept).
 * The call, video and three-dot buttons, the Photo / Gallery / Emoji / More tiles and Minimize are built but hidden (GONE): to show one
 * again, remove its setVisibility(View.GONE) line in build(). The smiley in the reply box still opens the emoji strip.
 * Messages that arrive while the app is not on screen are queued and announced by a toast on the floating chat head. The card
 * stays closed until the person taps the chat head: the head then grows into the card (expandFrom). Close shrinks the card back into
 * the head and clears the queue, Open chat opens Letschat on that chat, sending a reply posts it to the Letschat server and removes
 * that chat's messages from the card.
 */
final class MessagePopup {

    /** One message shown in the pop-up. */
    static final class Item {
        final String id;
        final String chatId;
        final String title;
        final String avatar;
        final String text;
        final String replyName;
        final String replyText;
        /** When the message reached the phone (shown as the time next to the message). */
        final long at;

        Item(String id, String chatId, String title, String avatar, String text, String replyName, String replyText) {
            this.id = id == null ? "" : id;
            this.chatId = chatId == null ? "" : chatId;
            this.title = title == null ? "" : title;
            this.avatar = avatar == null ? "" : avatar;
            this.text = text == null ? "" : text;
            this.replyName = replyName == null ? "" : replyName;
            this.replyText = replyText == null ? "" : replyText;
            this.at = System.currentTimeMillis();
        }
    }

    private static final int MAX_ITEMS = 200;
    private static final int MAX_SEEN = 600;
    // The colours below were read from the LetsChat Africa chat screen itself.
    /** Chat background: black (the doodle wallpaper is drawn over it). */
    private static final int C_CARD = 0xFF000000;
    /** Header and bottom bar: the dark navy-black of the chat header. */
    private static final int C_BAND = 0xFF0A0B10;
    /** Received bubble. */
    private static final int C_RECV = 0xFF1F2C34;
    /** Sent bubble (dark green). */
    private static final int C_SENT = 0xFF005C4D;
    /** The round send button (the teal of the mic button). */
    private static final int C_BTN = 0xFF35D1BB;
    /** The icon on the teal send button. */
    private static final int C_BTN_ICON = 0xFF0A0B10;
    /** Quick tiles and dropdown. */
    private static final int C_TILE = 0xFF1E2432;
    /** Reply pill (the message box colour). */
    private static final int C_PILL = 0xFF1E2432;
    /** Text and hint colours inside the reply pill. */
    private static final int C_PILL_TEXT = 0xFFFFFFFF;
    private static final int C_PILL_HINT = 0xFF848A98;
    private static final int C_PILL_ICON = 0xFFB4BECA;
    /** Header and bottom bar icons (arrows, Open chat, Close). */
    private static final int C_ICON = 0xFFB4BEC8;
    private static final int C_GREEN = 0xFF35D1BB;
    /** Time under a received message. */
    private static final int C_MUTED = 0xFFB0BAC3;
    /** Time under a sent message. */
    private static final int C_SENT_TIME = 0xFFA4C8C8;
    /** The glowing edge of the card: teal to dark green. */
    private static final int C_EDGE1 = 0xFF35D1BB;
    private static final int C_EDGE2 = 0xFF005C4D;
    /** The line between the middle and the bottom bar, and the divider in the header. */
    private static final int C_LINE = 0xFF1E2432;
    /** Size the card has while it is "inside" the chat head: it grows from this to full size and shrinks back to it. */
    private static final float SHRUNK = 0.12f;
    private static final String[] EMOJIS = { "😀", "😂", "😍", "😘", "👍", "🙏", "😢", "😮", "🔥", "❤️", "🎉", "😎" };
    /** The doodle wallpaper of the card: the file client/wallpaper-dark.webp of the website (the same black and white doodle as the chat screen). */
    private static final String WALL_URL = "https://letschat-taupe.vercel.app/wallpaper-dark.webp";
    private static final String WALL_FILE = "popup-wall.webp";

    private static MessagePopup instance;

    static synchronized MessagePopup get(Context context) {
        if (instance == null) instance = new MessagePopup(context.getApplicationContext());
        return instance;
    }

    /** Queues the message and shows a toast on the chat head, unless the person turned the floating bubble off or the overlay permission is missing. */
    static void notifyMessage(Context context, Item item) {
        Context app = context.getApplicationContext();
        if (!BubbleController.get(app).isEnabled() || !Settings.canDrawOverlays(app)) return;
        get(app).push(item);
    }

    private final Context ctx;
    private final WindowManager wm;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final float density;
    private final ArrayList<Item> items = new ArrayList<>();
    private final HashSet<String> seen = new HashSet<>();
    private final LinkedList<String> seenOrder = new LinkedList<>();
    private final LruCache<String, Bitmap> avatars = new LruCache<>(12);
    private int index = 0;
    private boolean sending = false;
    /** True while the card shrinks back into the chat head. */
    private boolean collapsing = false;
    /** Screen position of the chat head's centre when the card was opened: the card grows from and shrinks to this point. */
    private int originX = -1;
    private int originY = -1;
    /** The doodle wallpaper, once it is loaded (kept for the next cards). */
    private Bitmap wallpaper;
    private boolean wallLoading = false;

    private LinearLayout root;
    private WindowManager.LayoutParams lp;
    private ImageView avatarView;
    private String avatarUrl = "";
    private TextView nameView;
    private TextView counterView;
    /** The "1 of N" text and the previous / next arrows in the header. */
    private TextView navCount;
    private View navPrev;
    private View navNext;
    private TextView prevBtn;
    private TextView nextBtn;
    private LinearLayout menuPanel;
    private HorizontalScrollView emojiStrip;
    private LinearLayout quoteBox;
    private TextView quoteWho;
    private TextView quoteText;
    private TextView msgView;
    private TextView timeView;
    private LinearLayout sentRow;
    private TextView sentView;
    private TextView sentTime;
    private EditText input;
    private View actionBtn;

    private MessagePopup(Context appContext) {
        ctx = appContext;
        wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        density = ctx.getResources().getDisplayMetrics().density;
    }

    // ---- public ----

    /** True while messages are waiting for the person (main thread only). */
    boolean hasMessages() {
        return !items.isEmpty();
    }

    /** How many messages are waiting (main thread only). */
    int pendingCount() {
        return items.size();
    }

    /** True while the card is on screen (main thread only). */
    boolean isOpen() {
        return root != null;
    }

    void push(final Item item) {
        if (item == null) return;
        ui.post(new Runnable() {
            @Override
            public void run() {
                try {
                    handlePush(item);
                } catch (Throwable t) {
                    // a pop-up that cannot be drawn must never close the whole app
                    try {
                        removeView();
                        BubbleController.get(ctx).onCardClosed(0);
                    } catch (Throwable ignored) {}
                    items.clear();
                }
            }
        });
    }

    private void handlePush(Item item) {
        if (!item.id.isEmpty()) {
            if (seen.contains(item.id)) return; // the live connection and the checker can both report the same message
            seen.add(item.id);
            seenOrder.add(item.id);
            while (seenOrder.size() > MAX_SEEN) seen.remove(seenOrder.removeFirst());
        }
        if (items.size() >= MAX_ITEMS) {
            items.remove(0);
            if (index > 0) index--;
        }
        items.add(item);
        if (wallpaper == null) loadWallpaper(null); // start fetching the wallpaper while the chat head is still showing its toast
        if (root != null) {
            refresh(); // the card is already open: just update "N of M"
            return;
        }
        // The card stays closed until the person taps the chat head: the head shows a toast with this message and the waiting count.
        BubbleController.get(ctx).show(items.size(), item.title, item.text, item.chatId, item.avatar);
    }

    /** Removes the card and forgets every waiting message at once (the chat head is going away too). */
    void dismiss() {
        ui.post(new Runnable() {
            @Override
            public void run() {
                items.clear();
                index = 0;
                removeView();
            }
        });
    }

    /**
     * A tap on the chat head: the head grows into this card. (cx, cy) is the middle of the head on the screen.
     * Returns false when there is nothing to show (the caller then simply opens Letschat). Main thread only.
     */
    boolean expandFrom(int cx, int cy) {
        if (items.isEmpty()) return false;
        try {
            if (root != null) removeView(); // never two cards on screen
            index = 0;
            if (!build()) return false;
            refresh();
            if (root == null) return false;
            originX = cx;
            originY = cy;
            final View card = root;
            // the card is invisible until its first layout; then it grows out of the head's position
            card.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
                @Override
                public void onLayoutChange(View v, int left, int top, int right, int bottom, int oldLeft, int oldTop, int oldRight, int oldBottom) {
                    if (right - left <= 0 || bottom - top <= 0) return;
                    v.removeOnLayoutChangeListener(this);
                    if (v != root) return;
                    pivotAtHead(v);
                    v.setScaleX(SHRUNK);
                    v.setScaleY(SHRUNK);
                    v.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(260).setInterpolator(new DecelerateInterpolator(1.8f)).start();
                }
            });
            ui.postDelayed(new Runnable() {
                @Override
                public void run() {
                    // safety net: should the first layout never be reported, show the card anyway instead of leaving it invisible
                    if (root == card && !collapsing && card.getAlpha() == 0f) {
                        card.setAlpha(1f);
                        card.setScaleX(1f);
                        card.setScaleY(1f);
                    }
                }
            }, 700);
            BubbleController.get(ctx).onCardOpened();
            return true;
        } catch (Throwable t) {
            try {
                removeView();
            } catch (Throwable ignored) {}
            return false;
        }
    }

    /** Makes the card grow from (and shrink back to) the chat head: the pivot is the head's position, kept inside the card. */
    private void pivotAtHead(View card) {
        if (originX < 0 || originY < 0) return;
        int[] loc = new int[2];
        card.getLocationOnScreen(loc);
        float px = Math.max(0f, Math.min((float) card.getWidth(), (float) (originX - loc[0])));
        float py = Math.max(0f, Math.min((float) card.getHeight(), (float) (originY - loc[1])));
        card.setPivotX(px);
        card.setPivotY(py);
    }

    /** Minimize, a tap outside the card, Close, or the last waiting message was answered: the card shrinks back into the chat head, which then pops up again. */
    private void collapseToHead() {
        if (collapsing) return;
        final View card = root;
        hideKeyboard();
        if (card == null) {
            BubbleController.get(ctx).onCardClosed(items.size());
            return;
        }
        collapsing = true;
        card.animate().cancel();
        card.animate().alpha(0f).scaleX(SHRUNK).scaleY(SHRUNK).setDuration(200).setInterpolator(new AccelerateInterpolator(1.3f)).withEndAction(new Runnable() {
            @Override
            public void run() {
                collapsing = false;
                if (root == card) removeView();
                BubbleController.get(ctx).onCardClosed(items.size());
            }
        }).start();
    }

    /** Takes the card away without animation and gives the chat head back. */
    private void closeNow() {
        removeView();
        BubbleController.get(ctx).onCardClosed(items.size());
    }

    // ---- view building ----

    private boolean build() {
        if (root != null) return true;

        final int width = Math.min(screenW() - dp(8), dp(520));

        root = new LinearLayout(ctx);
        root.setOrientation(LinearLayout.VERTICAL);
        // extra room on top: the chat head sits over the top left corner of the card
        root.setPadding(dp(14), dp(30), dp(14), dp(8));
        final CardBg cardBg = new CardBg(density);
        root.setBackground(cardBg);
        loadWallpaper(cardBg); // the doodle wallpaper (drawn as soon as it is available)
        // a tap anywhere outside the card (the window watches outside touches) minimizes the card back into the chat head
        root.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_OUTSIDE) {
                    collapseToHead();
                    return true;
                }
                return false;
            }
        });

        // header: round photo, name, divider with "1 of N" over the previous / next arrows (call, video and three-dot menu are hidden)
        LinearLayout header = new LinearLayout(ctx);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        // the dark header band reaches from the top of the card to just under the header row
        header.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
            @Override
            public void onLayoutChange(View v, int left, int top, int right, int bottom, int oldLeft, int oldTop, int oldRight, int oldBottom) {
                cardBg.setTopBand(bottom + dp(8));
            }
        });

        avatarView = new ImageView(ctx);
        avatarUrl = "";
        avatarView.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(C_PILL);
        ring.setStroke(dp(2), C_GREEN);
        avatarView.setBackground(ring);
        avatarView.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        avatarView.setClipToOutline(true);
        header.addView(avatarView, new LinearLayout.LayoutParams(dp(46), dp(46)));

        LinearLayout names = new LinearLayout(ctx);
        names.setOrientation(LinearLayout.VERTICAL);
        nameView = new TextView(ctx);
        nameView.setTextColor(Color.WHITE);
        nameView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        nameView.setTypeface(Typeface.DEFAULT_BOLD);
        nameView.setSingleLine(true);
        nameView.setEllipsize(TextUtils.TruncateAt.END);
        names.addView(nameView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        counterView = new TextView(ctx);
        counterView.setTextColor(C_GREEN);
        counterView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        counterView.setSingleLine(true);
        counterView.setVisibility(View.GONE); // the count is now shown by the navigation on the right
        names.addView(counterView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        nl.leftMargin = dp(12);
        nl.rightMargin = dp(6);
        header.addView(names, nl);

        // navigation: thin divider, "1 of N" and the previous / next arrows underneath
        View navLine = new View(ctx);
        navLine.setBackgroundColor(C_PILL_HINT);
        LinearLayout.LayoutParams nll = new LinearLayout.LayoutParams(dp(1), dp(46));
        nll.rightMargin = dp(10);
        header.addView(navLine, nll);
        LinearLayout nav = new LinearLayout(ctx);
        nav.setOrientation(LinearLayout.VERTICAL);
        nav.setGravity(Gravity.CENTER_HORIZONTAL);
        navCount = new TextView(ctx);
        navCount.setTextColor(Color.WHITE);
        navCount.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        navCount.setSingleLine(true);
        navCount.setGravity(Gravity.CENTER);
        nav.addView(navCount, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        LinearLayout arrows = new LinearLayout(ctx);
        arrows.setOrientation(LinearLayout.HORIZONTAL);
        navPrev = glyph(Glyph.CHEV_L, C_ICON);
        tap(navPrev, new Runnable() {
            @Override
            public void run() {
                showPrev();
            }
        });
        arrows.addView(navPrev, new LinearLayout.LayoutParams(dp(44), dp(36)));
        navNext = glyph(Glyph.CHEV_R, C_ICON);
        tap(navNext, new Runnable() {
            @Override
            public void run() {
                showNext();
            }
        });
        arrows.addView(navNext, new LinearLayout.LayoutParams(dp(44), dp(36)));
        nav.addView(arrows, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        header.addView(nav, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        View call = glyph(Glyph.PHONE, C_ICON);
        tap(call, new Runnable() {
            @Override
            public void run() {
                openCurrentChat(); // calls are started inside the chat
            }
        });
        call.setVisibility(View.GONE); // hidden
        header.addView(call, new LinearLayout.LayoutParams(dp(44), dp(44)));
        View video = glyph(Glyph.VIDEO, C_ICON);
        tap(video, new Runnable() {
            @Override
            public void run() {
                openCurrentChat();
            }
        });
        video.setVisibility(View.GONE); // hidden
        header.addView(video, new LinearLayout.LayoutParams(dp(44), dp(44)));
        View dots = glyph(Glyph.DOTS_V, C_ICON);
        tap(dots, new Runnable() {
            @Override
            public void run() {
                toggleMenu();
            }
        });
        dots.setVisibility(View.GONE); // hidden
        header.addView(dots, new LinearLayout.LayoutParams(dp(40), dp(44)));
        root.addView(header, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // the dropdown under the header (three-dot button and the More tile; both are hidden for now, so it never opens)
        menuPanel = new LinearLayout(ctx);
        menuPanel.setOrientation(LinearLayout.VERTICAL);
        menuPanel.setPadding(dp(6), dp(6), dp(6), dp(6));
        menuPanel.setBackground(rounded(C_BAND, 18, C_LINE, 1));
        prevBtn = menuItem("Previous message");
        tap(prevBtn, new Runnable() {
            @Override
            public void run() {
                showPrev();
            }
        });
        menuPanel.addView(prevBtn, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
        nextBtn = menuItem("Next message");
        tap(nextBtn, new Runnable() {
            @Override
            public void run() {
                showNext();
            }
        });
        menuPanel.addView(nextBtn, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
        TextView openItem = menuItem("Open chat");
        tap(openItem, new Runnable() {
            @Override
            public void run() {
                openCurrentChat();
            }
        });
        menuPanel.addView(openItem, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
        TextView clearItem = menuItem("Clear all");
        tap(clearItem, new Runnable() {
            @Override
            public void run() {
                clearAndCollapse();
            }
        });
        menuPanel.addView(clearItem, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
        menuPanel.setVisibility(View.GONE);
        LinearLayout.LayoutParams mpl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        mpl.topMargin = dp(8);
        root.addView(menuPanel, mpl);

        // the received message: (quoted message,) the message and its time
        LinearLayout bubble = new LinearLayout(ctx);
        bubble.setOrientation(LinearLayout.VERTICAL);
        bubble.setPadding(dp(16), dp(10), dp(16), dp(10));
        bubble.setBackground(rounded(C_RECV, 22, 0, 0));

        quoteBox = new LinearLayout(ctx);
        quoteBox.setOrientation(LinearLayout.HORIZONTAL);
        quoteBox.setBackground(rounded(0x55000000, 10, 0, 0));
        View bar = new View(ctx);
        bar.setBackgroundColor(C_GREEN);
        quoteBox.addView(bar, new LinearLayout.LayoutParams(dp(4), LinearLayout.LayoutParams.MATCH_PARENT));
        LinearLayout quoteCol = new LinearLayout(ctx);
        quoteCol.setOrientation(LinearLayout.VERTICAL);
        quoteCol.setPadding(dp(10), dp(6), dp(10), dp(6));
        quoteWho = new TextView(ctx);
        quoteWho.setTextColor(C_GREEN);
        quoteWho.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        quoteWho.setTypeface(Typeface.DEFAULT_BOLD);
        quoteWho.setSingleLine(true);
        quoteWho.setEllipsize(TextUtils.TruncateAt.END);
        quoteText = new TextView(ctx);
        quoteText.setTextColor(C_MUTED);
        quoteText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        quoteText.setMaxLines(2);
        quoteText.setEllipsize(TextUtils.TruncateAt.END);
        quoteCol.addView(quoteWho);
        quoteCol.addView(quoteText);
        quoteBox.addView(quoteCol, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout.LayoutParams ql = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        ql.bottomMargin = dp(6);
        quoteBox.setVisibility(View.GONE);
        bubble.addView(quoteBox, ql);

        LinearLayout textRow = new LinearLayout(ctx);
        textRow.setOrientation(LinearLayout.HORIZONTAL);
        textRow.setGravity(Gravity.BOTTOM);
        msgView = new TextView(ctx);
        msgView.setTextColor(Color.WHITE);
        msgView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        msgView.setMaxLines(6);
        msgView.setEllipsize(TextUtils.TruncateAt.END);
        msgView.setMaxWidth(Math.max(dp(120), width - dp(150)));
        textRow.addView(msgView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        timeView = new TextView(ctx);
        timeView.setTextColor(C_MUTED);
        timeView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tl.leftMargin = dp(12);
        textRow.addView(timeView, tl);
        bubble.addView(textRow, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bl.topMargin = dp(12);
        bl.gravity = Gravity.START;
        root.addView(bubble, bl);

        // the reply just sent (shown for a moment after Send)
        sentRow = new LinearLayout(ctx);
        sentRow.setOrientation(LinearLayout.HORIZONTAL);
        sentRow.setGravity(Gravity.BOTTOM);
        sentRow.setPadding(dp(16), dp(10), dp(16), dp(10));
        sentRow.setBackground(rounded(C_SENT, 22, 0, 0));
        sentView = new TextView(ctx);
        sentView.setTextColor(Color.WHITE);
        sentView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        sentView.setMaxLines(6);
        sentView.setEllipsize(TextUtils.TruncateAt.END);
        sentView.setMaxWidth(Math.max(dp(120), width - dp(150)));
        sentRow.addView(sentView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        sentTime = new TextView(ctx);
        sentTime.setTextColor(C_SENT_TIME);
        sentTime.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        LinearLayout.LayoutParams stl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        stl.leftMargin = dp(12);
        sentRow.addView(sentTime, stl);
        sentRow.setVisibility(View.GONE);
        LinearLayout.LayoutParams srl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        srl.topMargin = dp(10);
        srl.gravity = Gravity.END;
        root.addView(sentRow, srl);

        // quick tiles: Photo, Gallery, Emoji, More (hidden)
        LinearLayout tiles = new LinearLayout(ctx);
        tiles.setOrientation(LinearLayout.HORIZONTAL);
        tiles.addView(tile(Glyph.CAMERA, C_ICON, "Photo", new Runnable() {
            @Override
            public void run() {
                openCurrentChat(); // pictures are picked inside the chat
            }
        }), tileParams(false));
        tiles.addView(tile(Glyph.GALLERY, C_ICON, "Gallery", new Runnable() {
            @Override
            public void run() {
                openCurrentChat();
            }
        }), tileParams(false));
        tiles.addView(tile(Glyph.SMILEY, C_ICON, "Emoji", new Runnable() {
            @Override
            public void run() {
                toggleEmoji();
            }
        }), tileParams(false));
        tiles.addView(tile(Glyph.DOTS_H, C_ICON, "More", new Runnable() {
            @Override
            public void run() {
                toggleMenu();
            }
        }), tileParams(true));
        tiles.setVisibility(View.GONE); // hidden
        LinearLayout.LayoutParams tsl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tsl.topMargin = dp(14);
        root.addView(tiles, tsl);

        // emoji strip (opened by the smiley in the reply box)
        emojiStrip = new HorizontalScrollView(ctx);
        emojiStrip.setHorizontalScrollBarEnabled(false);
        LinearLayout emojiRow = new LinearLayout(ctx);
        emojiRow.setOrientation(LinearLayout.HORIZONTAL);
        for (int i = 0; i < EMOJIS.length; i++) {
            final String e = EMOJIS[i];
            TextView t = new TextView(ctx);
            t.setText(e);
            t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
            t.setGravity(Gravity.CENTER);
            tap(t, new Runnable() {
                @Override
                public void run() {
                    insertEmoji(e);
                }
            });
            emojiRow.addView(t, new LinearLayout.LayoutParams(dp(48), dp(48)));
        }
        emojiStrip.addView(emojiRow);
        emojiStrip.setVisibility(View.GONE);
        LinearLayout.LayoutParams esl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        esl.topMargin = dp(8);
        root.addView(emojiStrip, esl);

        // reply row: [smiley  text box] (send)
        LinearLayout replyRow = new LinearLayout(ctx);
        replyRow.setOrientation(LinearLayout.HORIZONTAL);
        replyRow.setGravity(Gravity.CENTER_VERTICAL);

        LinearLayout pill = new LinearLayout(ctx);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(dp(14), dp(4), dp(8), dp(4));
        pill.setBackground(rounded(C_PILL, 32, 0, 0));
        View smiley = glyph(Glyph.SMILEY, C_PILL_ICON);
        tap(smiley, new Runnable() {
            @Override
            public void run() {
                toggleEmoji();
            }
        });
        pill.addView(smiley, new LinearLayout.LayoutParams(dp(42), dp(42)));

        input = new EditText(ctx);
        input.setBackgroundColor(Color.TRANSPARENT);
        input.setTextColor(C_PILL_TEXT);
        input.setHintTextColor(C_PILL_HINT);
        input.setHint("Type a message...");
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setMaxLines(3);
        input.setPadding(dp(8), dp(8), dp(12), dp(8));
        input.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_DOWN) setFocusable(true); // the window must accept the keyboard before typing
                return false;
            }
        });
        input.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {}

            @Override
            public void onTextChanged(CharSequence s, int a, int b, int c) {}

            @Override
            public void afterTextChanged(Editable s) {
                if (actionBtn != null && !sending) actionBtn.setAlpha(s != null && s.toString().trim().length() > 0 ? 1f : 0.65f);
            }
        });
        pill.addView(input, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        replyRow.addView(pill, new LinearLayout.LayoutParams(0, dp(62), 1f));

        FrameHolder send = new FrameHolder(ctx);
        GradientDrawable sendBg = new GradientDrawable();
        sendBg.setShape(GradientDrawable.OVAL);
        sendBg.setColor(C_BTN);
        send.setBackground(sendBg);
        send.addView(new Glyph(ctx, Glyph.SEND, C_BTN_ICON, density), new FrameHolder.LayoutParams(dp(58), dp(58)));
        send.setAlpha(0.65f);
        actionBtn = send;
        tap(actionBtn, new Runnable() {
            @Override
            public void run() {
                if (input != null && input.getText().toString().trim().length() > 0) sendReply();
                else focusInput();
            }
        });
        LinearLayout.LayoutParams al = new LinearLayout.LayoutParams(dp(58), dp(58));
        al.leftMargin = dp(10);
        replyRow.addView(actionBtn, al);
        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rl.topMargin = dp(12);
        root.addView(replyRow, rl);

        // bottom bar: Minimize (hidden) | Open chat | Close
        View line = new View(ctx);
        line.setBackgroundColor(C_LINE);
        LinearLayout.LayoutParams lnl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
        lnl.topMargin = dp(14);
        lnl.leftMargin = -dp(14);
        lnl.rightMargin = -dp(14);
        root.addView(line, lnl);
        // the dark bottom band starts at this line and reaches the bottom of the card
        line.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
            @Override
            public void onLayoutChange(View v, int left, int top, int right, int bottom, int oldLeft, int oldTop, int oldRight, int oldBottom) {
                cardBg.setBottomFrom(top);
            }
        });

        LinearLayout bar2 = new LinearLayout(ctx);
        bar2.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout minimize = bottomItem(Glyph.MINUS, "Minimize", new Runnable() {
            @Override
            public void run() {
                collapseToHead(); // keeps the waiting messages
            }
        });
        minimize.setVisibility(View.GONE); // hidden
        bar2.addView(minimize, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        bar2.addView(bottomItem(Glyph.OPEN, "Open chat", new Runnable() {
            @Override
            public void run() {
                openCurrentChat();
            }
        }), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        bar2.addView(bottomItem(Glyph.CLOSE, "Close", new Runnable() {
            @Override
            public void run() {
                clearAndCollapse(); // Close forgets the waiting messages
            }
        }), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        root.addView(bar2, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        lp = new WindowManager.LayoutParams(
            width,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            // FLAG_WATCH_OUTSIDE_TOUCH: the card is told about a tap outside it (the tap still reaches the app underneath)
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        );
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.y = dp(60);
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        try {
            root.setAlpha(0f); // invisible until expandFrom grows it out of the chat head
            wm.addView(root, lp);
            return true;
        } catch (RuntimeException e) {
            root = null;
            items.clear();
            return false;
        }
    }

    /** A plain frame that behaves as one tap target (the round send button). */
    private static final class FrameHolder extends android.widget.FrameLayout {
        FrameHolder(Context c) {
            super(c);
        }
    }

    private void tap(View v, final Runnable r) {
        v.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View x) {
                r.run();
            }
        });
    }

    private Glyph glyph(int kind, int color) {
        return new Glyph(ctx, kind, color, density);
    }

    private GradientDrawable rounded(int color, int radiusDp, int strokeColor, int strokeDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(radiusDp));
        if (strokeDp > 0) g.setStroke(dp(strokeDp), strokeColor);
        return g;
    }

    private TextView menuItem(String label) {
        TextView t = new TextView(ctx);
        t.setText(label);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setPadding(dp(14), 0, dp(14), 0);
        return t;
    }

    private LinearLayout.LayoutParams tileParams(boolean last) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(84), 1f);
        p.rightMargin = last ? 0 : dp(10);
        return p;
    }

    /** One of the four quick tiles: an icon over a label. */
    private LinearLayout tile(int kind, int color, String label, Runnable action) {
        LinearLayout t = new LinearLayout(ctx);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setGravity(Gravity.CENTER);
        t.setBackground(rounded(C_TILE, 20, 0, 0));
        t.addView(glyph(kind, color), new LinearLayout.LayoutParams(dp(36), dp(36)));
        TextView tv = new TextView(ctx);
        tv.setText(label);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        t.addView(tv, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        tap(t, action);
        return t;
    }

    /** One of the three bottom buttons: a round icon over a label. */
    private LinearLayout bottomItem(int kind, String label, Runnable action) {
        LinearLayout t = new LinearLayout(ctx);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setGravity(Gravity.CENTER);
        t.setPadding(0, dp(10), 0, dp(6));
        t.addView(glyph(kind, C_ICON), new LinearLayout.LayoutParams(dp(40), dp(40)));
        TextView tv = new TextView(ctx);
        tv.setText(label);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        t.addView(tv, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        tap(t, action);
        return t;
    }

    // ---- menu, emoji, navigation ----

    private void setMenu(boolean on) {
        if (menuPanel != null) menuPanel.setVisibility(on ? View.VISIBLE : View.GONE);
    }

    private void toggleMenu() {
        if (menuPanel == null) return;
        setMenu(menuPanel.getVisibility() != View.VISIBLE);
    }

    private void toggleEmoji() {
        if (emojiStrip == null) return;
        emojiStrip.setVisibility(emojiStrip.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE);
    }

    private void insertEmoji(String e) {
        if (input == null) return;
        int pos = Math.max(0, input.getSelectionStart());
        input.getText().insert(Math.min(pos, input.getText().length()), e);
    }

    /** The left arrow: the previous waiting message. */
    private void showPrev() {
        if (index > 0) {
            index--;
            refresh();
        }
        setMenu(false);
    }

    /** The right arrow: the next waiting message. */
    private void showNext() {
        if (index < items.size() - 1) {
            index++;
            refresh();
        }
        setMenu(false);
    }

    private void clearAndCollapse() {
        items.clear();
        index = 0;
        collapseToHead();
    }

    // ---- showing the current message ----

    private void refresh() {
        if (root == null || counterView == null || msgView == null) return;
        if (items.isEmpty()) {
            closeNow();
            return;
        }
        if (index < 0) index = 0;
        if (index > items.size() - 1) index = items.size() - 1;
        Item it = items.get(index);
        counterView.setText(items.size() == 1 ? "New message" : (index + 1) + " of " + items.size() + " new");
        if (navCount != null) navCount.setText((index + 1) + " of " + items.size());
        if (navPrev != null) navPrev.setAlpha(index > 0 ? 1f : 0.35f);
        if (navNext != null) navNext.setAlpha(index < items.size() - 1 ? 1f : 0.35f);
        prevBtn.setAlpha(index > 0 ? 1f : 0.4f);
        nextBtn.setAlpha(index < items.size() - 1 ? 1f : 0.4f);
        nameView.setText(it.title.isEmpty() ? "Letschat" : it.title);
        setAvatar(it.avatar, it.title);
        if (sentRow != null) sentRow.setVisibility(View.GONE);
        if (it.replyText.isEmpty()) {
            quoteBox.setVisibility(View.GONE);
        } else {
            quoteBox.setVisibility(View.VISIBLE);
            quoteWho.setText(it.replyName.isEmpty() ? "You" : it.replyName);
            quoteText.setText(it.replyText);
        }
        msgView.setText(it.text.isEmpty() ? "New message" : it.text);
        timeView.setText(clock(it.at));
    }

    private String clock(long at) {
        try {
            return new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date(at));
        } catch (RuntimeException e) {
            return "";
        }
    }

    // ---- actions ----

    private void openCurrentChat() {
        String chat = (index >= 0 && index < items.size()) ? items.get(index).chatId : "";
        hideKeyboard();
        items.clear();
        removeView();
        BubbleController.get(ctx).openChat(chat);
    }

    private void sendReply() {
        if (sending || index < 0 || index >= items.size()) return;
        final String text = input.getText().toString().trim();
        final String chat = items.get(index).chatId;
        if (text.isEmpty() || chat.isEmpty()) return;
        sending = true;
        actionBtn.setAlpha(0.5f);
        new Thread(new Runnable() {
            @Override
            public void run() {
                final boolean ok = MessagePoller.sendReply(ctx, chat, text);
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        sending = false;
                        if (actionBtn != null) actionBtn.setAlpha(1f);
                        if (!ok) {
                            Toast.makeText(ctx, "Could not send. Check your connection and try again.", Toast.LENGTH_SHORT).show();
                            return;
                        }
                        if (input != null) input.setText("");
                        hideKeyboard();
                        if (sentRow != null) {
                            // show the sent reply in a green bubble for a moment, like in a chat
                            sentView.setText(text);
                            sentTime.setText(clock(System.currentTimeMillis()));
                            sentRow.setVisibility(View.VISIBLE);
                        }
                        Iterator<Item> iter = items.iterator();
                        while (iter.hasNext()) {
                            if (chat.equals(iter.next().chatId)) iter.remove(); // that chat is answered
                        }
                        if (index > items.size() - 1) index = items.size() - 1;
                        final View card = root;
                        ui.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                if (card == null || root != card) return;
                                if (items.isEmpty()) collapseToHead(); // nothing left to answer: the card shrinks back into the chat head
                                else refresh();
                            }
                        }, 1100);
                    }
                });
            }
        }, "letschat-popup-reply").start();
    }

    // ---- keyboard ----

    private void setFocusable(boolean on) {
        if (root == null || lp == null) return;
        int f = on ? (lp.flags & ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE) : (lp.flags | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
        if (f == lp.flags) return;
        lp.flags = f;
        try {
            wm.updateViewLayout(root, lp);
        } catch (RuntimeException ignored) {}
    }

    private void focusInput() {
        if (input == null) return;
        setFocusable(true);
        input.post(new Runnable() {
            @Override
            public void run() {
                if (input == null) return;
                input.requestFocus();
                try {
                    InputMethodManager imm = (InputMethodManager) ctx.getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
                } catch (RuntimeException ignored) {}
            }
        });
    }

    private void hideKeyboard() {
        try {
            if (input != null) {
                InputMethodManager imm = (InputMethodManager) ctx.getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) imm.hideSoftInputFromWindow(input.getWindowToken(), 0);
                input.clearFocus();
            }
        } catch (RuntimeException ignored) {}
        setFocusable(false);
    }

    private void removeView() {
        if (root != null) {
            try {
                root.animate().cancel();
                wm.removeView(root);
            } catch (RuntimeException ignored) {}
        }
        root = null;
        lp = null;
        avatarView = null;
        avatarUrl = "";
        nameView = null;
        counterView = null;
        navCount = null;
        navPrev = null;
        navNext = null;
        prevBtn = null;
        nextBtn = null;
        menuPanel = null;
        emojiStrip = null;
        quoteBox = null;
        quoteWho = null;
        quoteText = null;
        msgView = null;
        timeView = null;
        sentRow = null;
        sentView = null;
        sentTime = null;
        input = null;
        actionBtn = null;
        sending = false;
        collapsing = false;
    }

    // ---- wallpaper ----

    /**
     * Gives the card the doodle wallpaper. It is kept in memory once loaded; otherwise it is read from the app's private files, or
     * downloaded once from the website and saved there. Any problem simply leaves the middle of the card plain black. bg may be null (just preload).
     */
    private void loadWallpaper(final CardBg bg) {
        if (wallpaper != null) {
            if (bg != null) bg.setWall(wallpaper);
            return;
        }
        if (wallLoading) {
            // a load is already running: the card gets the picture on the next one
            return;
        }
        wallLoading = true;
        new Thread(new Runnable() {
            @Override
            public void run() {
                Bitmap b = null;
                try {
                    File f = new File(ctx.getFilesDir(), WALL_FILE);
                    if (f.exists()) {
                        InputStream in = new FileInputStream(f);
                        try {
                            b = decodeWall(readAll(in));
                        } finally {
                            in.close();
                        }
                        if (b == null) f.delete(); // a broken copy: fetch it again next time
                    }
                    if (b == null) {
                        HttpURLConnection c = null;
                        try {
                            c = (HttpURLConnection) new URL(WALL_URL).openConnection();
                            c.setConnectTimeout(8000);
                            c.setReadTimeout(10000);
                            if (c.getResponseCode() == 200) {
                                InputStream in = c.getInputStream();
                                byte[] data;
                                try {
                                    data = readAll(in);
                                } finally {
                                    in.close();
                                }
                                b = decodeWall(data);
                                if (b != null) {
                                    FileOutputStream out = new FileOutputStream(f);
                                    try {
                                        out.write(data);
                                    } finally {
                                        out.close();
                                    }
                                }
                            }
                        } finally {
                            if (c != null) c.disconnect();
                        }
                    }
                } catch (Throwable ignored) {
                    // no wallpaper: the middle of the card stays plain black
                }
                final Bitmap fb = b;
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        wallLoading = false;
                        if (fb == null) return;
                        wallpaper = fb;
                        if (bg != null) bg.setWall(fb);
                    }
                });
            }
        }, "letschat-popup-wallpaper").start();
    }

    private static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) {
            bo.write(buf, 0, n);
            if (bo.size() > 6 * 1024 * 1024) throw new java.io.IOException("wallpaper too large");
        }
        return bo.toByteArray();
    }

    private static Bitmap decodeWall(byte[] data) {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inPreferredConfig = Bitmap.Config.RGB_565;
        return BitmapFactory.decodeByteArray(data, 0, data.length, o);
    }

    // ---- photo ----

    private void setAvatar(final String url, String name) {
        if (avatarView == null) return;
        final String u = url == null ? "" : url;
        if (u.equals(avatarUrl) && !u.isEmpty()) return;
        avatarUrl = u;
        Bitmap cached = u.isEmpty() ? null : avatars.get(u);
        if (cached != null) {
            avatarView.setImageBitmap(cached);
            return;
        }
        String n = name == null ? "" : name.trim();
        avatarView.setImageBitmap(letterBitmap(n.isEmpty() ? "L" : n));
        if (u.isEmpty()) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection c = null;
                try {
                    c = (HttpURLConnection) new URL(u).openConnection();
                    c.setConnectTimeout(6000);
                    c.setReadTimeout(6000);
                    if (c.getResponseCode() != 200) return;
                    InputStream in = c.getInputStream();
                    try {
                        final Bitmap b = BitmapFactory.decodeStream(in);
                        if (b == null) return;
                        ui.post(new Runnable() {
                            @Override
                            public void run() {
                                avatars.put(u, b);
                                if (avatarView != null && u.equals(avatarUrl)) avatarView.setImageBitmap(b);
                            }
                        });
                    } finally {
                        in.close();
                    }
                } catch (Exception ignored) {
                    // keep the letter circle
                } finally {
                    if (c != null) c.disconnect();
                }
            }
        }, "letschat-popup-photo").start();
    }

    private Bitmap letterBitmap(String name) {
        int size = dp(104);
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        int[] palette = { 0xFF005C4D, 0xFF35D1BB, 0xFF1F2C34, 0xFF2E7D6B, 0xFF3FA9F5, 0xFF21C063 };
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(palette[(name.hashCode() & 0x7fffffff) % palette.length]);
        cv.drawRect(0, 0, size, size, p);
        p.setColor(Color.WHITE);
        p.setTypeface(Typeface.DEFAULT_BOLD);
        p.setTextSize(size * 0.46f);
        p.setTextAlign(Paint.Align.CENTER);
        String letter = name.substring(0, name.offsetByCodePoints(0, 1)).toUpperCase();
        cv.drawText(letter, size / 2f, size / 2f - (p.descent() + p.ascent()) / 2f, p);
        return bmp;
    }

    // ---- drawing: the card background and the line icons ----

    /**
     * The card: black, covered by the doodle wallpaper once it is loaded (scaled to fill, cropped to the card, rounded corners), with a
     * dark band over the header at the top and over the bottom bar at the bottom (so the doodle shows in the middle), and a
     * teal double border (a thick outer line and a thinner inner one).
     */
    private static final class CardBg extends Drawable {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint bmpPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        private final RectF r = new RectF();
        private final Rect src = new Rect();
        private final Path clip = new Path();
        private final float u;
        private Bitmap wall;
        /** Where the header band ends and where the bottom band starts, measured from the top of the card in pixels (-1 = not known yet). */
        private int topBand = -1;
        private int bottomFrom = -1;

        CardBg(float unit) {
            u = unit;
        }

        void setWall(Bitmap b) {
            wall = b;
            invalidateSelf();
        }

        void setTopBand(int px) {
            if (px == topBand) return;
            topBand = px;
            invalidateSelf();
        }

        void setBottomFrom(int px) {
            if (px == bottomFrom) return;
            bottomFrom = px;
            invalidateSelf();
        }

        @Override
        public void draw(Canvas c) {
            Rect b = getBounds();
            if (b.width() <= 0 || b.height() <= 0) return;
            float rad = 28f * u;
            r.set(b.left + 2f * u, b.top + 2f * u, b.right - 2f * u, b.bottom - 2f * u);
            p.setShader(null);
            p.setStyle(Paint.Style.FILL);
            p.setColor(C_CARD);
            c.drawRoundRect(r, rad, rad, p);
            clip.reset();
            clip.addRoundRect(r, rad, rad, Path.Direction.CW);
            Bitmap w = wall;
            if (w != null && !w.isRecycled()) {
                // cover: scale the picture to fill the card and crop what sticks out, keeping the middle
                float bw = w.getWidth();
                float bh = w.getHeight();
                float scale = Math.max(r.width() / bw, r.height() / bh);
                float sw = r.width() / scale;
                float sh = r.height() / scale;
                int sx = (int) ((bw - sw) / 2f);
                int sy = (int) ((bh - sh) / 2f);
                src.set(sx, sy, (int) (sx + sw), (int) (sy + sh));
                c.save();
                c.clipPath(clip);
                c.drawBitmap(w, src, r, bmpPaint);
                c.restore();
            }
            // the header band (top) and bottom bar (bottom), clipped to the rounded card
            c.save();
            c.clipPath(clip);
            p.setStyle(Paint.Style.FILL);
            p.setColor(C_BAND);
            if (topBand > 0) c.drawRect(b.left, b.top, b.right, b.top + topBand, p);
            if (bottomFrom > 0 && bottomFrom < b.height()) c.drawRect(b.left, b.top + bottomFrom, b.right, b.bottom, p);
            c.restore();
            Shader edge = new LinearGradient(b.left, b.top, b.right, b.bottom, C_EDGE1, C_EDGE2, Shader.TileMode.CLAMP);
            p.setShader(edge);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(3f * u);
            c.drawRoundRect(r, rad, rad, p);
            r.inset(7f * u, 7f * u);
            p.setStrokeWidth(2f * u);
            p.setAlpha(150);
            c.drawRoundRect(r, rad - 7f * u, rad - 7f * u, p);
            p.setShader(null);
            p.setAlpha(255);
        }

        @Override
        public void setAlpha(int alpha) {}

        @Override
        public void setColorFilter(ColorFilter cf) {}

        @Override
        public int getOpacity() {
            return PixelFormat.TRANSLUCENT;
        }
    }

    /** The simple line icons of the card (phone, video, dots, camera, gallery, smiley, send, minimize, open, close, arrows), drawn in one colour. */
    private static final class Glyph extends View {
        static final int PHONE = 0;
        static final int VIDEO = 1;
        static final int DOTS_V = 2;
        static final int DOTS_H = 3;
        static final int CAMERA = 4;
        static final int GALLERY = 5;
        static final int SMILEY = 6;
        static final int SEND = 7;
        static final int MINUS = 8;
        static final int OPEN = 9;
        static final int CLOSE = 10;
        static final int CHEV_L = 11;
        static final int CHEV_R = 12;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final RectF rf = new RectF();
        private final int kind;
        private final int color;
        private final float unit;

        Glyph(Context c, int kind, int color, float unit) {
            super(c);
            this.kind = kind;
            this.color = color;
            this.unit = unit;
        }

        @Override
        protected void onDraw(Canvas cv) {
            float s = Math.min(getWidth(), getHeight()) * 0.78f;
            float x0 = getWidth() / 2f - s / 2f;
            float y0 = getHeight() / 2f - s / 2f;
            paint.setColor(color);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(Math.max(2f * unit, s * 0.075f));
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
            switch (kind) {
                case PHONE:
                    path.reset();
                    path.moveTo(x0 + .20f * s, y0 + .18f * s);
                    path.lineTo(x0 + .38f * s, y0 + .18f * s);
                    path.lineTo(x0 + .45f * s, y0 + .38f * s);
                    path.lineTo(x0 + .36f * s, y0 + .46f * s);
                    path.cubicTo(x0 + .40f * s, y0 + .56f * s, x0 + .44f * s, y0 + .60f * s, x0 + .54f * s, y0 + .64f * s);
                    path.lineTo(x0 + .62f * s, y0 + .55f * s);
                    path.lineTo(x0 + .82f * s, y0 + .62f * s);
                    path.lineTo(x0 + .82f * s, y0 + .80f * s);
                    path.cubicTo(x0 + .45f * s, y0 + .82f * s, x0 + .18f * s, y0 + .55f * s, x0 + .20f * s, y0 + .18f * s);
                    path.close();
                    cv.drawPath(path, paint);
                    break;
                case VIDEO:
                    rf.set(x0 + .10f * s, y0 + .28f * s, x0 + .66f * s, y0 + .72f * s);
                    cv.drawRoundRect(rf, .10f * s, .10f * s, paint);
                    path.reset();
                    path.moveTo(x0 + .70f * s, y0 + .46f * s);
                    path.lineTo(x0 + .92f * s, y0 + .32f * s);
                    path.lineTo(x0 + .92f * s, y0 + .68f * s);
                    path.lineTo(x0 + .70f * s, y0 + .54f * s);
                    path.close();
                    cv.drawPath(path, paint);
                    break;
                case DOTS_V:
                    paint.setStyle(Paint.Style.FILL);
                    for (int i = 0; i < 3; i++) cv.drawCircle(x0 + .5f * s, y0 + (.2f + .3f * i) * s, .075f * s, paint);
                    break;
                case DOTS_H:
                    paint.setStyle(Paint.Style.FILL);
                    for (int i = 0; i < 3; i++) cv.drawCircle(x0 + (.2f + .3f * i) * s, y0 + .5f * s, .075f * s, paint);
                    break;
                case CAMERA:
                    rf.set(x0 + .08f * s, y0 + .30f * s, x0 + .92f * s, y0 + .80f * s);
                    cv.drawRoundRect(rf, .10f * s, .10f * s, paint);
                    path.reset();
                    path.moveTo(x0 + .34f * s, y0 + .30f * s);
                    path.lineTo(x0 + .40f * s, y0 + .18f * s);
                    path.lineTo(x0 + .60f * s, y0 + .18f * s);
                    path.lineTo(x0 + .66f * s, y0 + .30f * s);
                    cv.drawPath(path, paint);
                    cv.drawCircle(x0 + .5f * s, y0 + .55f * s, .15f * s, paint);
                    break;
                case GALLERY:
                    rf.set(x0 + .10f * s, y0 + .12f * s, x0 + .90f * s, y0 + .88f * s);
                    cv.drawRoundRect(rf, .10f * s, .10f * s, paint);
                    cv.drawCircle(x0 + .36f * s, y0 + .38f * s, .07f * s, paint);
                    path.reset();
                    path.moveTo(x0 + .10f * s, y0 + .74f * s);
                    path.lineTo(x0 + .38f * s, y0 + .52f * s);
                    path.lineTo(x0 + .56f * s, y0 + .68f * s);
                    path.lineTo(x0 + .68f * s, y0 + .58f * s);
                    path.lineTo(x0 + .90f * s, y0 + .76f * s);
                    cv.drawPath(path, paint);
                    break;
                case SMILEY:
                    cv.drawCircle(x0 + .5f * s, y0 + .5f * s, .42f * s, paint);
                    paint.setStyle(Paint.Style.FILL);
                    cv.drawCircle(x0 + .37f * s, y0 + .42f * s, .045f * s, paint);
                    cv.drawCircle(x0 + .63f * s, y0 + .42f * s, .045f * s, paint);
                    paint.setStyle(Paint.Style.STROKE);
                    rf.set(x0 + .28f * s, y0 + .30f * s, x0 + .72f * s, y0 + .72f * s);
                    cv.drawArc(rf, 25f, 130f, false, paint);
                    break;
                case SEND:
                    path.reset();
                    path.moveTo(x0 + .90f * s, y0 + .12f * s);
                    path.lineTo(x0 + .10f * s, y0 + .46f * s);
                    path.lineTo(x0 + .42f * s, y0 + .58f * s);
                    path.lineTo(x0 + .54f * s, y0 + .90f * s);
                    path.close();
                    cv.drawPath(path, paint);
                    cv.drawLine(x0 + .42f * s, y0 + .58f * s, x0 + .90f * s, y0 + .12f * s, paint);
                    break;
                case MINUS:
                    cv.drawCircle(x0 + .5f * s, y0 + .5f * s, .44f * s, paint);
                    cv.drawLine(x0 + .30f * s, y0 + .5f * s, x0 + .70f * s, y0 + .5f * s, paint);
                    break;
                case OPEN:
                    path.reset();
                    path.moveTo(x0 + .45f * s, y0 + .22f * s);
                    path.lineTo(x0 + .28f * s, y0 + .22f * s);
                    path.quadTo(x0 + .16f * s, y0 + .22f * s, x0 + .16f * s, y0 + .34f * s);
                    path.lineTo(x0 + .16f * s, y0 + .72f * s);
                    path.quadTo(x0 + .16f * s, y0 + .84f * s, x0 + .28f * s, y0 + .84f * s);
                    path.lineTo(x0 + .66f * s, y0 + .84f * s);
                    path.quadTo(x0 + .78f * s, y0 + .84f * s, x0 + .78f * s, y0 + .72f * s);
                    path.lineTo(x0 + .78f * s, y0 + .55f * s);
                    cv.drawPath(path, paint);
                    cv.drawLine(x0 + .52f * s, y0 + .48f * s, x0 + .88f * s, y0 + .12f * s, paint);
                    path.reset();
                    path.moveTo(x0 + .62f * s, y0 + .12f * s);
                    path.lineTo(x0 + .88f * s, y0 + .12f * s);
                    path.lineTo(x0 + .88f * s, y0 + .38f * s);
                    cv.drawPath(path, paint);
                    break;
                case CHEV_L:
                    paint.setStrokeWidth(Math.max(2.5f * unit, s * 0.13f));
                    path.reset();
                    path.moveTo(x0 + .62f * s, y0 + .20f * s);
                    path.lineTo(x0 + .32f * s, y0 + .50f * s);
                    path.lineTo(x0 + .62f * s, y0 + .80f * s);
                    cv.drawPath(path, paint);
                    break;
                case CHEV_R:
                    paint.setStrokeWidth(Math.max(2.5f * unit, s * 0.13f));
                    path.reset();
                    path.moveTo(x0 + .38f * s, y0 + .20f * s);
                    path.lineTo(x0 + .68f * s, y0 + .50f * s);
                    path.lineTo(x0 + .38f * s, y0 + .80f * s);
                    cv.drawPath(path, paint);
                    break;
                default:
                    cv.drawCircle(x0 + .5f * s, y0 + .5f * s, .44f * s, paint);
                    cv.drawLine(x0 + .37f * s, y0 + .37f * s, x0 + .63f * s, y0 + .63f * s, paint);
                    cv.drawLine(x0 + .63f * s, y0 + .37f * s, x0 + .37f * s, y0 + .63f * s, paint);
                    break;
            }
        }
    }

    // ---- helpers ----

    private int screenW() {
        return ctx.getResources().getDisplayMetrics().widthPixels;
    }

    private int dp(float v) {
        return (int) (v * density + 0.5f);
    }
}
