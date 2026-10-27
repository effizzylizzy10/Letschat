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
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
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
import java.util.Random;

/**
 * The Letschat message card, in the neon "doodle" style: a black card covered with white doodles (stars, hearts, chat bubbles,
 * pencils, laptops), a glowing green header pill with the sender's round photo, name and "1 of N" with round previous / next
 * arrows, the little boy, the Letschat Africa logo and the girl, the message in a dark green bubble (with its time and the double
 * tick), a glowing reply pill (smiley, "Type a message...") with the green mic / send button, and the glowing Close and View buttons.
 * Messages that arrive while the app is not on screen are queued and announced by a toast on the floating chat head. The card
 * stays closed until the person taps the chat head: the head then grows into the card (expandFrom). Close shrinks the card back
 * into the head and clears the queue, View opens Letschat on that chat, sending a reply posts it to the Letschat server and removes
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
        /** When the message reached the phone (shown as the time under the message). */
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
    /** The black of the card. */
    private static final int C_CARD = 0xFF05070A;
    /** The bright neon green of the glowing borders. */
    private static final int C_NEON = 0xFF2BFF77;
    private static final int C_GREEN = 0xFF21C063;
    private static final int C_PANEL = 0xFF08130F;
    private static final int C_BUBBLE = 0xFF0F3D33;
    private static final int C_MUTED = 0xFF9FB7AC;
    /** Size the card has while it is "inside" the chat head: it grows from this to full size and shrinks back to it. */
    private static final float SHRUNK = 0.12f;

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

    private LinearLayout root;
    private WindowManager.LayoutParams lp;
    private ImageView avatarView;
    private String avatarUrl = "";
    private TextView nameView;
    private TextView counterView;
    private TextView prevBtn;
    private TextView nextBtn;
    private LinearLayout quoteBox;
    private TextView quoteWho;
    private TextView quoteText;
    private TextView msgView;
    private TextView timeView;
    private EditText input;
    private ActionButton actionBtn;

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

    /** Close, or the last waiting message was answered: the card shrinks back into the chat head, which then pops up again. */
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

        final int glowH = dp(5);

        root = new LinearLayout(ctx);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(8), dp(8), dp(8), dp(8));
        root.setBackground(new Doodle(density));

        // header pill: photo, name | "1 of N" and round arrows
        LinearLayout header = new LinearLayout(ctx);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(11), dp(8), dp(11), dp(8));
        header.setBackground(new Neon(C_PANEL, 0, C_NEON, dp(36), dp(2), glowH, false, density));

        avatarView = new ImageView(ctx);
        avatarUrl = "";
        avatarView.setScaleType(ImageView.ScaleType.CENTER_CROP);
        avatarView.setPadding(dp(3), dp(3), dp(3), dp(3));
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(0xFF0B1512);
        ring.setStroke(dp(3), C_NEON);
        avatarView.setBackground(ring);
        avatarView.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        avatarView.setClipToOutline(true);
        header.addView(avatarView, new LinearLayout.LayoutParams(dp(58), dp(58)));

        nameView = new TextView(ctx);
        nameView.setTextColor(Color.WHITE);
        nameView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        nameView.setTypeface(Typeface.DEFAULT_BOLD);
        nameView.setSingleLine(true);
        nameView.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        nl.leftMargin = dp(10);
        nl.rightMargin = dp(6);
        header.addView(nameView, nl);

        View divider = new View(ctx);
        divider.setBackgroundColor(0xFF4A5A55);
        LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(dp(1), dp(48));
        dl.rightMargin = dp(8);
        header.addView(divider, dl);

        LinearLayout nav = new LinearLayout(ctx);
        nav.setOrientation(LinearLayout.VERTICAL);
        nav.setGravity(Gravity.CENTER_HORIZONTAL);
        counterView = new TextView(ctx);
        counterView.setTextColor(Color.WHITE);
        counterView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        counterView.setTypeface(Typeface.DEFAULT_BOLD);
        counterView.setGravity(Gravity.CENTER);
        nav.addView(counterView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        LinearLayout arrows = new LinearLayout(ctx);
        arrows.setOrientation(LinearLayout.HORIZONTAL);
        prevBtn = arrow("‹");
        nextBtn = arrow("›");
        prevBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (index > 0) {
                    index--;
                    refresh();
                }
            }
        });
        nextBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (index < items.size() - 1) {
                    index++;
                    refresh();
                }
            }
        });
        LinearLayout.LayoutParams pa = new LinearLayout.LayoutParams(dp(38), dp(38));
        LinearLayout.LayoutParams na = new LinearLayout.LayoutParams(dp(38), dp(38));
        na.leftMargin = dp(6);
        arrows.addView(prevBtn, pa);
        arrows.addView(nextBtn, na);
        nav.addView(arrows, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        header.addView(nav, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(header, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // the little pictures: the boy, the Letschat Africa logo and the girl
        FrameLayout stickers = new FrameLayout(ctx);
        Bitmap boy = PopupArt.boy();
        Bitmap logo = PopupArt.logo();
        Bitmap girl = PopupArt.girl();
        if (boy != null) stickers.addView(sticker(boy), new FrameLayout.LayoutParams(dp(46), dp(58), Gravity.START | Gravity.BOTTOM));
        if (logo != null) stickers.addView(sticker(logo), new FrameLayout.LayoutParams(dp(72), dp(74), Gravity.CENTER));
        if (girl != null) stickers.addView(sticker(girl), new FrameLayout.LayoutParams(dp(44), dp(58), Gravity.END | Gravity.TOP));
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(76));
        sl.topMargin = dp(2);
        root.addView(stickers, sl);

        // the message bubble: (quoted message,) the message, its time and the double tick
        LinearLayout bubble = new LinearLayout(ctx);
        bubble.setOrientation(LinearLayout.VERTICAL);
        bubble.setPadding(dp(16), dp(10), dp(18), dp(8));
        bubble.setMinimumWidth(dp(150));
        bubble.setBackground(new Neon(C_BUBBLE, 0, 0xFF1F9E5A, dp(24), dp(2), dp(3), true, density));

        quoteBox = new LinearLayout(ctx);
        quoteBox.setOrientation(LinearLayout.HORIZONTAL);
        GradientDrawable quoteBg = new GradientDrawable();
        quoteBg.setColor(0x55000000);
        quoteBg.setCornerRadius(dp(10));
        quoteBox.setBackground(quoteBg);
        View bar = new View(ctx);
        bar.setBackgroundColor(C_NEON);
        quoteBox.addView(bar, new LinearLayout.LayoutParams(dp(4), LinearLayout.LayoutParams.MATCH_PARENT));
        LinearLayout quoteCol = new LinearLayout(ctx);
        quoteCol.setOrientation(LinearLayout.VERTICAL);
        quoteCol.setPadding(dp(10), dp(6), dp(10), dp(6));
        quoteWho = new TextView(ctx);
        quoteWho.setTextColor(C_NEON);
        quoteWho.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        quoteWho.setTypeface(Typeface.DEFAULT_BOLD);
        quoteWho.setSingleLine(true);
        quoteWho.setEllipsize(TextUtils.TruncateAt.END);
        quoteText = new TextView(ctx);
        quoteText.setTextColor(0xFFC5D2CB);
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

        msgView = new TextView(ctx);
        msgView.setTextColor(Color.WHITE);
        msgView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        msgView.setTypeface(Typeface.DEFAULT_BOLD);
        msgView.setGravity(Gravity.START);
        msgView.setMaxLines(6);
        msgView.setEllipsize(TextUtils.TruncateAt.END);
        bubble.addView(msgView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout meta = new LinearLayout(ctx);
        meta.setOrientation(LinearLayout.HORIZONTAL);
        meta.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        timeView = new TextView(ctx);
        timeView.setTextColor(C_MUTED);
        timeView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        meta.addView(timeView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        TextView ticks = new TextView(ctx);
        ticks.setText("✓✓");
        ticks.setTextColor(C_NEON);
        ticks.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        ticks.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams tkl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tkl.leftMargin = dp(6);
        meta.addView(ticks, tkl);
        bubble.addView(meta, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bl.gravity = Gravity.END;
        bl.leftMargin = dp(30);
        bl.rightMargin = dp(6);
        bl.bottomMargin = dp(8);
        root.addView(bubble, bl);

        // reply row: [smiley  text box] (green mic / send)
        LinearLayout replyRow = new LinearLayout(ctx);
        replyRow.setOrientation(LinearLayout.HORIZONTAL);
        replyRow.setGravity(Gravity.CENTER_VERTICAL);

        LinearLayout pill = new LinearLayout(ctx);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setPadding(dp(8), dp(6), dp(8), dp(6));
        pill.setBackground(new Neon(0xFF0A1512, 0, C_NEON, dp(32), dp(2), glowH, false, density));

        TextView emoji = new TextView(ctx);
        emoji.setText("☺");
        emoji.setTextColor(Color.WHITE);
        emoji.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        emoji.setGravity(Gravity.CENTER);
        emoji.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                focusInput();
            }
        });
        pill.addView(emoji, new LinearLayout.LayoutParams(dp(46), dp(46)));

        input = new EditText(ctx);
        input.setBackgroundColor(Color.TRANSPARENT);
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(C_MUTED);
        input.setHint("Type a message...");
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setMaxLines(3);
        input.setPadding(dp(4), dp(8), dp(12), dp(8));
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
                if (actionBtn != null) actionBtn.setSend(s != null && s.toString().trim().length() > 0);
            }
        });
        pill.addView(input, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        replyRow.addView(pill, new LinearLayout.LayoutParams(0, dp(66), 1f));

        actionBtn = new ActionButton(ctx, density);
        actionBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (input.getText().toString().trim().length() > 0) sendReply();
                else openCurrentChat(); // voice notes are recorded in the app itself
            }
        });
        LinearLayout.LayoutParams al = new LinearLayout.LayoutParams(dp(70), dp(70));
        al.leftMargin = dp(2);
        replyRow.addView(actionBtn, al);
        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rl.topMargin = dp(2);
        root.addView(replyRow, rl);

        // Close | View
        LinearLayout buttons = new LinearLayout(ctx);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.CENTER_VERTICAL);
        buttons.setPadding(dp(8), dp(6), dp(8), dp(6));
        buttons.setBackground(new Neon(0xFF08100D, 0, 0xFF1A8F52, dp(36), dp(2), dp(3), false, density));
        LinearLayout close = neonButton("Close", false);
        close.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                items.clear(); // Close forgets the waiting messages; the card shrinks back into the chat head
                index = 0;
                collapseToHead();
            }
        });
        LinearLayout view = neonButton("View", true);
        view.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openCurrentChat();
            }
        });
        View vline = new View(ctx);
        vline.setBackgroundColor(0xFF3A4A44);
        buttons.addView(close, new LinearLayout.LayoutParams(0, dp(58), 1f));
        LinearLayout.LayoutParams vl = new LinearLayout.LayoutParams(dp(1), dp(46));
        vl.leftMargin = dp(4);
        vl.rightMargin = dp(4);
        buttons.addView(vline, vl);
        buttons.addView(view, new LinearLayout.LayoutParams(0, dp(58), 1f));
        LinearLayout.LayoutParams btl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btl.topMargin = dp(2);
        root.addView(buttons, btl);

        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        int width = Math.min(screenW() - dp(8), dp(520));
        lp = new WindowManager.LayoutParams(
            width,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
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

    private ImageView sticker(Bitmap b) {
        ImageView iv = new ImageView(ctx);
        iv.setImageBitmap(b);
        iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
        return iv;
    }

    /** A round glowing previous / next button. */
    private TextView arrow(String glyph) {
        TextView t = new TextView(ctx);
        t.setText(glyph);
        t.setTextColor(C_NEON);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        t.setIncludeFontPadding(false);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(0xFF0F2A1F);
        bg.setStroke(dp(2), 0xFF1F9E5A);
        t.setBackground(bg);
        return t;
    }

    /** The Close (dark, glowing border) and View (bright green) buttons, each with its round icon. */
    private LinearLayout neonButton(String label, boolean primary) {
        LinearLayout b = new LinearLayout(ctx);
        b.setOrientation(LinearLayout.HORIZONTAL);
        b.setGravity(Gravity.CENTER);
        if (primary) b.setBackground(new Neon(0xFF3DEB7C, 0xFF14AA4C, 0xFF9BFFBF, dp(29), dp(2), dp(4), false, density));
        else b.setBackground(new Neon(0xFF0B1F18, 0, C_NEON, dp(29), dp(2), dp(4), false, density));
        IconView icon = new IconView(ctx, primary ? IconView.EYE : IconView.CLOSE, density);
        b.addView(icon, new LinearLayout.LayoutParams(dp(34), dp(34)));
        TextView t = new TextView(ctx);
        t.setText(label);
        t.setTextColor(primary ? 0xFF04140A : Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 21);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tl.leftMargin = dp(10);
        b.addView(t, tl);
        return b;
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
        counterView.setText((index + 1) + " of " + items.size());
        prevBtn.setAlpha(index > 0 ? 1f : 0.35f);
        nextBtn.setAlpha(index < items.size() - 1 ? 1f : 0.35f);
        nameView.setText(it.title.isEmpty() ? "Letschat" : it.title);
        setAvatar(it.avatar, it.title);
        if (it.replyText.isEmpty()) {
            quoteBox.setVisibility(View.GONE);
        } else {
            quoteBox.setVisibility(View.VISIBLE);
            quoteWho.setText(it.replyName.isEmpty() ? "You" : it.replyName);
            quoteText.setText(it.replyText);
        }
        msgView.setText(it.text.isEmpty() ? "New message" : it.text);
        try {
            timeView.setText(new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date(it.at)));
        } catch (RuntimeException e) {
            timeView.setText("");
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
                        Toast.makeText(ctx, "Sent", Toast.LENGTH_SHORT).show();
                        if (input != null) input.setText("");
                        hideKeyboard();
                        Iterator<Item> iter = items.iterator();
                        while (iter.hasNext()) {
                            if (chat.equals(iter.next().chatId)) iter.remove(); // that chat is answered
                        }
                        if (index > items.size() - 1) index = items.size() - 1;
                        if (items.isEmpty()) collapseToHead(); // nothing left to answer: the card shrinks back into the chat head
                        else refresh();
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
        prevBtn = null;
        nextBtn = null;
        quoteBox = null;
        quoteWho = null;
        quoteText = null;
        msgView = null;
        timeView = null;
        input = null;
        actionBtn = null;
        sending = false;
        collapsing = false;
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
        int[] palette = { 0xFF35D0BA, 0xFF7C6CF0, 0xFFF2B84B, 0xFFE8618C, 0xFF3FA9F5, 0xFF21C063 };
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

    // ---- drawing helpers: the glowing rounded panels and the doodle background ----

    /**
     * A rounded panel with a neon-green glowing border: soft wider strokes of the same colour drawn outside the sharp border make the glow.
     * The glow is drawn inside the view's own bounds (the panel is inset by the glow size), so the views using it keep a little padding.
     * With fill2 set the panel is a vertical gradient; with tail a small speech-bubble tail sticks out of the bottom right corner.
     */
    private static final class Neon extends Drawable {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF r = new RectF();
        private final Path tailPath = new Path();
        private final int fill;
        private final int fill2;
        private final int stroke;
        private final float radius;
        private final float strokeW;
        private final float glow;
        private final boolean tail;
        private final float unit;

        Neon(int fill, int fill2, int stroke, float radius, float strokeW, float glow, boolean tail, float unit) {
            this.fill = fill;
            this.fill2 = fill2;
            this.stroke = stroke;
            this.radius = radius;
            this.strokeW = strokeW;
            this.glow = glow;
            this.tail = tail;
            this.unit = unit;
        }

        @Override
        public void draw(Canvas c) {
            Rect b = getBounds();
            if (b.width() <= 0 || b.height() <= 0) return;
            r.set(b.left + glow, b.top + glow, b.right - glow, b.bottom - glow);
            float rad = Math.min(radius, Math.min(r.width(), r.height()) / 2f);
            p.setShader(null);
            p.setStyle(Paint.Style.STROKE);
            if (glow > 0f) {
                int[] alphas = { 22, 40, 70 };
                for (int i = 0; i < 3; i++) {
                    p.setColor((stroke & 0x00FFFFFF) | (alphas[i] << 24));
                    p.setStrokeWidth(strokeW + glow * 2f * (3 - i) / 3f);
                    c.drawRoundRect(r, rad, rad, p);
                }
            }
            p.setStyle(Paint.Style.FILL);
            if (fill2 != 0) p.setShader(new LinearGradient(0f, r.top, 0f, r.bottom, fill, fill2, Shader.TileMode.CLAMP));
            else p.setColor(fill);
            c.drawRoundRect(r, rad, rad, p);
            p.setShader(null);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(strokeW);
            p.setColor(stroke);
            c.drawRoundRect(r, rad, rad, p);
            if (tail) {
                float t = unit;
                tailPath.reset();
                tailPath.moveTo(r.right - 26f * t, r.bottom - 1f * t);
                tailPath.lineTo(b.right - 0.5f * t, b.bottom - 0.5f * t);
                tailPath.lineTo(r.right - 1f * t, r.bottom - 24f * t);
                tailPath.close();
                p.setStyle(Paint.Style.FILL);
                p.setColor(fill);
                c.drawPath(tailPath, p);
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeWidth(strokeW);
                p.setColor(stroke);
                p.setStrokeJoin(Paint.Join.ROUND);
                tailPath.reset();
                tailPath.moveTo(r.right - 26f * t, r.bottom);
                tailPath.lineTo(b.right - 0.5f * t, b.bottom - 0.5f * t);
                tailPath.lineTo(r.right, r.bottom - 24f * t);
                c.drawPath(tailPath, p);
            }
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

    /**
     * The card's background: black with white doodles (stars, hearts, chat bubbles, pencils, laptops, sparkles) like the Letschat Africa
     * sticker wallpaper. Every doodle is drawn from a fixed number for its grid cell, so the pattern never moves or flickers when the card
     * grows or shrinks.
     */
    private static final class Doodle extends Drawable {
        private final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint fillP = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final Path clip = new Path();
        private final RectF rf = new RectF();
        private final float u;

        Doodle(float unit) {
            u = unit;
            line.setStyle(Paint.Style.STROKE);
            line.setStrokeWidth(1.4f * unit);
            line.setStrokeCap(Paint.Cap.ROUND);
            line.setStrokeJoin(Paint.Join.ROUND);
            line.setColor(0xEBFFFFFF);
            fillP.setStyle(Paint.Style.FILL);
        }

        @Override
        public void draw(Canvas c) {
            Rect b = getBounds();
            if (b.width() <= 0 || b.height() <= 0) return;
            float cs = 40f * u;
            rf.set(b);
            clip.reset();
            clip.addRoundRect(rf, 20f * u, 20f * u, Path.Direction.CW);
            c.save();
            c.clipPath(clip);
            fillP.setColor(C_CARD);
            c.drawRect(rf, fillP);
            int cols = (int) Math.ceil(b.width() / cs);
            int rows = (int) Math.ceil(b.height() / cs);
            for (int row = 0; row < rows; row++) {
                for (int col = 0; col < cols; col++) {
                    Random rnd = new Random(row * 131L + col * 7919L + 17L);
                    int kind = rnd.nextInt(10);
                    float cx = b.left + (col + 0.5f) * cs + (rnd.nextFloat() - 0.5f) * cs * 0.45f;
                    float cy = b.top + (row + 0.5f) * cs + (rnd.nextFloat() - 0.5f) * cs * 0.45f;
                    float rot = (rnd.nextFloat() - 0.5f) * 60f;
                    float r = cs * (0.26f + rnd.nextFloat() * 0.1f);
                    boolean tinted = rnd.nextBoolean();
                    c.save();
                    c.translate(cx, cy);
                    c.rotate(rot);
                    switch (kind) {
                        case 0:
                        case 1:
                            star(c, r);
                            break;
                        case 2:
                            heart(c, r, tinted);
                            break;
                        case 3:
                        case 4:
                            bubble(c, r);
                            break;
                        case 5:
                            pencil(c, r, tinted);
                            break;
                        case 6:
                            laptop(c, r);
                            break;
                        case 7:
                            sparkle(c, r);
                            break;
                        case 8:
                            c.drawCircle(0f, 0f, r * 0.35f, line);
                            break;
                        default:
                            break; // an empty cell
                    }
                    c.restore();
                }
            }
            c.restore();
            // thin glowing edge of the whole card
            line.setColor(0x802BFF77);
            line.setStrokeWidth(1.5f * u);
            c.drawRoundRect(rf.left + u, rf.top + u, rf.right - u, rf.bottom - u, 19f * u, 19f * u, line);
            line.setColor(0xEBFFFFFF);
            line.setStrokeWidth(1.4f * u);
        }

        private void star(Canvas c, float r) {
            path.reset();
            for (int i = 0; i < 10; i++) {
                double a = -Math.PI / 2 + i * Math.PI / 5;
                float rr = (i % 2 == 0) ? r : r * 0.45f;
                float x = (float) (Math.cos(a) * rr);
                float y = (float) (Math.sin(a) * rr);
                if (i == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            path.close();
            c.drawPath(path, line);
        }

        private void heart(Canvas c, float r, boolean red) {
            path.reset();
            path.moveTo(0f, r);
            path.cubicTo(-r * 1.2f, r * 0.1f, -r * 0.9f, -r * 0.8f, 0f, -r * 0.35f);
            path.cubicTo(r * 0.9f, -r * 0.8f, r * 1.2f, r * 0.1f, 0f, r);
            path.close();
            fillP.setColor(0xFFE53935);
            if (red) c.drawPath(path, fillP);
            c.drawPath(path, line);
        }

        private void bubble(Canvas c, float r) {
            rf.set(-r * 1.1f, -r * 0.75f, r * 1.1f, r * 0.6f);
            c.drawRoundRect(rf, r * 0.45f, r * 0.45f, line);
            path.reset();
            path.moveTo(-r * 0.5f, r * 0.6f);
            path.lineTo(-r * 0.8f, r * 1.0f);
            path.lineTo(-r * 0.1f, r * 0.6f);
            c.drawPath(path, line);
            fillP.setColor(0xEBFFFFFF);
            for (int i = -1; i <= 1; i++) c.drawCircle(i * r * 0.5f, -r * 0.08f, r * 0.1f, fillP);
        }

        private void pencil(Canvas c, float r, boolean yellow) {
            path.reset();
            path.moveTo(-r * 1.2f, -r * 0.28f);
            path.lineTo(r * 0.7f, -r * 0.28f);
            path.lineTo(r * 1.2f, 0f);
            path.lineTo(r * 0.7f, r * 0.28f);
            path.lineTo(-r * 1.2f, r * 0.28f);
            path.close();
            fillP.setColor(0xFFF2B84B);
            if (yellow) c.drawPath(path, fillP);
            c.drawPath(path, line);
            c.drawLine(r * 0.7f, -r * 0.28f, r * 0.7f, r * 0.28f, line);
        }

        private void laptop(Canvas c, float r) {
            rf.set(-r, -r * 0.8f, r, r * 0.35f);
            c.drawRoundRect(rf, r * 0.12f, r * 0.12f, line);
            path.reset();
            path.moveTo(-r * 1.2f, r * 0.55f);
            path.lineTo(r * 1.2f, r * 0.55f);
            path.lineTo(r * 1.35f, r * 0.85f);
            path.lineTo(-r * 1.35f, r * 0.85f);
            path.close();
            c.drawPath(path, line);
        }

        private void sparkle(Canvas c, float r) {
            for (int i = 0; i < 3; i++) {
                double a = -Math.PI / 2 + (i - 1) * 0.55;
                c.drawLine((float) (Math.cos(a) * r * 0.5f), (float) (Math.sin(a) * r * 0.5f), (float) (Math.cos(a) * r), (float) (Math.sin(a) * r), line);
            }
        }

        @Override
        public void setAlpha(int alpha) {}

        @Override
        public void setColorFilter(ColorFilter cf) {}

        @Override
        public int getOpacity() {
            return PixelFormat.OPAQUE;
        }
    }

    // ---- the round icons on the Close and View buttons ----

    private static final class IconView extends View {
        static final int CLOSE = 0;
        static final int EYE = 1;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final int kind;
        private final float unit;

        IconView(Context c, int kind, float unit) {
            super(c);
            this.kind = kind;
            this.unit = unit;
        }

        @Override
        protected void onDraw(Canvas cv) {
            float w = getWidth();
            float h = getHeight();
            float s = Math.min(w, h);
            float cx = w / 2f;
            float cy = h / 2f;
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2.2f * unit);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
            paint.setColor(Color.WHITE);
            cv.drawCircle(cx, cy, s / 2f - 1.6f * unit, paint);
            if (kind == CLOSE) {
                float d = s * 0.17f;
                cv.drawLine(cx - d, cy - d, cx + d, cy + d, paint);
                cv.drawLine(cx + d, cy - d, cx - d, cy + d, paint);
            } else {
                float ew = s * 0.27f;
                path.reset();
                path.moveTo(cx - ew, cy);
                path.quadTo(cx, cy - s * 0.3f, cx + ew, cy);
                path.quadTo(cx, cy + s * 0.3f, cx - ew, cy);
                cv.drawPath(path, paint);
                paint.setStyle(Paint.Style.FILL);
                cv.drawCircle(cx, cy, s * 0.085f, paint);
            }
        }
    }

    // ---- the green round button: microphone, or a send arrow once there is text ----

    private static final class ActionButton extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final float unit;
        private boolean send = false;

        ActionButton(Context c, float unit) {
            super(c);
            this.unit = unit;
        }

        void setSend(boolean on) {
            if (send != on) {
                send = on;
                invalidate();
            }
        }

        @Override
        protected void onDraw(Canvas cv) {
            float w = getWidth();
            float h = getHeight();
            float s = Math.min(w, h);
            float cx = w / 2f;
            float cy = h / 2f;
            float glow = 5f * unit;
            float rad = s / 2f - glow;
            // glow
            paint.setShader(null);
            paint.setStyle(Paint.Style.STROKE);
            int[] alphas = { 22, 40, 70 };
            for (int i = 0; i < 3; i++) {
                paint.setColor((C_NEON & 0x00FFFFFF) | (alphas[i] << 24));
                paint.setStrokeWidth(2f * unit + glow * 2f * (3 - i) / 3f);
                cv.drawCircle(cx, cy, rad, paint);
            }
            // green body
            paint.setStyle(Paint.Style.FILL);
            paint.setShader(new LinearGradient(0f, cy - rad, 0f, cy + rad, 0xFF3DEB7C, 0xFF12A650, Shader.TileMode.CLAMP));
            cv.drawCircle(cx, cy, rad, paint);
            paint.setShader(null);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2f * unit);
            paint.setColor(C_NEON);
            cv.drawCircle(cx, cy, rad, paint);
            // white microphone or send arrow
            paint.setColor(Color.WHITE);
            if (send) {
                paint.setStyle(Paint.Style.FILL);
                path.reset();
                path.moveTo(cx - 0.17f * s, cy - 0.2f * s);
                path.lineTo(cx + 0.22f * s, cy);
                path.lineTo(cx - 0.17f * s, cy + 0.2f * s);
                path.lineTo(cx - 0.09f * s, cy);
                path.close();
                cv.drawPath(path, paint);
            } else {
                paint.setStyle(Paint.Style.FILL);
                RectF body = new RectF(cx - 0.09f * s, cy - 0.27f * s, cx + 0.09f * s, cy + 0.06f * s);
                cv.drawRoundRect(body, 0.09f * s, 0.09f * s, paint);
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(0.05f * s);
                paint.setStrokeCap(Paint.Cap.ROUND);
                RectF arc = new RectF(cx - 0.16f * s, cy - 0.16f * s, cx + 0.16f * s, cy + 0.16f * s);
                cv.drawArc(arc, 0f, 180f, false, paint);
                cv.drawLine(cx, cy + 0.16f * s, cx, cy + 0.25f * s, paint);
                cv.drawLine(cx - 0.07f * s, cy + 0.25f * s, cx + 0.07f * s, cy + 0.25f * s, paint);
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
