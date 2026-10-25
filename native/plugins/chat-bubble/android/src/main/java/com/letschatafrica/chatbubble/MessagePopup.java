package com.letschatafrica.chatbubble;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.Typeface;
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
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedList;

/**
 * The Letschat message pop-up (the same layout as the WhatsApp pop-up): a card over other apps with the sender's photo and name,
 * "1 of N" with previous / next arrows, the quoted message when the new message is a reply, the message itself, a reply box
 * (emoji key, text, green send/mic button) and the Close and View buttons.
 * Messages that arrive while the app is not on screen are queued; Close clears them, View opens Letschat on that chat,
 * sending a reply posts it to the Letschat server and removes that chat's messages from the pop-up.
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

        Item(String id, String chatId, String title, String avatar, String text, String replyName, String replyText) {
            this.id = id == null ? "" : id;
            this.chatId = chatId == null ? "" : chatId;
            this.title = title == null ? "" : title;
            this.avatar = avatar == null ? "" : avatar;
            this.text = text == null ? "" : text;
            this.replyName = replyName == null ? "" : replyName;
            this.replyText = replyText == null ? "" : replyText;
        }
    }

    private static final int MAX_ITEMS = 200;
    private static final int MAX_SEEN = 600;
    private static final int C_CARD = 0xFF0B141A;
    private static final int C_HEADER = 0xFF111B21;
    private static final int C_PILL = 0xFF1F2C34;
    private static final int C_QUOTE = 0xFF0D1C24;
    private static final int C_GREEN = 0xFF21C063;
    private static final int C_LINE = 0xFF2A3942;
    private static final int C_MUTED = 0xFF8696A0;

    private static MessagePopup instance;

    static synchronized MessagePopup get(Context context) {
        if (instance == null) instance = new MessagePopup(context.getApplicationContext());
        return instance;
    }

    /** Shows (or adds to) the pop-up, unless the person turned the floating bubble off or the overlay permission is missing. */
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
    private EditText input;
    private ActionButton actionBtn;

    private MessagePopup(Context appContext) {
        ctx = appContext;
        wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        density = ctx.getResources().getDisplayMetrics().density;
    }

    // ---- public ----

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
        if (root == null) {
            index = 0;
            build();
        }
        if (root != null) refresh();
    }

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

    // ---- view building ----

    private void build() {
        if (root != null) return;

        root = new LinearLayout(ctx);
        root.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(C_CARD);
        cardBg.setCornerRadius(dp(6));
        cardBg.setStroke(dp(1), C_LINE);
        root.setBackground(cardBg);

        // header: photo, name | "1 of N" and arrows
        LinearLayout header = new LinearLayout(ctx);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(14), dp(12), dp(10), dp(12));
        header.setBackgroundColor(C_HEADER);

        avatarView = new ImageView(ctx);
        avatarUrl = "";
        avatarView.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(0xFF1F2C34);
        avatarView.setBackground(ring);
        avatarView.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        avatarView.setClipToOutline(true);
        header.addView(avatarView, new LinearLayout.LayoutParams(dp(52), dp(52)));

        nameView = new TextView(ctx);
        nameView.setTextColor(Color.WHITE);
        nameView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        nameView.setTypeface(Typeface.DEFAULT_BOLD);
        nameView.setSingleLine(true);
        nameView.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        nl.leftMargin = dp(12);
        nl.rightMargin = dp(8);
        header.addView(nameView, nl);

        View divider = new View(ctx);
        divider.setBackgroundColor(0xFF3B4A54);
        LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(dp(1), dp(46));
        dl.rightMargin = dp(10);
        header.addView(divider, dl);

        LinearLayout nav = new LinearLayout(ctx);
        nav.setOrientation(LinearLayout.VERTICAL);
        nav.setGravity(Gravity.CENTER_HORIZONTAL);
        counterView = new TextView(ctx);
        counterView.setTextColor(Color.WHITE);
        counterView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
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
        arrows.addView(prevBtn, new LinearLayout.LayoutParams(dp(44), dp(36)));
        arrows.addView(nextBtn, new LinearLayout.LayoutParams(dp(44), dp(36)));
        nav.addView(arrows, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        header.addView(nav, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(header, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // quoted message (only when the new message is a reply)
        quoteBox = new LinearLayout(ctx);
        quoteBox.setOrientation(LinearLayout.HORIZONTAL);
        quoteBox.setBackgroundColor(C_QUOTE);
        View bar = new View(ctx);
        bar.setBackgroundColor(C_GREEN);
        quoteBox.addView(bar, new LinearLayout.LayoutParams(dp(5), LinearLayout.LayoutParams.MATCH_PARENT));
        LinearLayout quoteCol = new LinearLayout(ctx);
        quoteCol.setOrientation(LinearLayout.VERTICAL);
        quoteCol.setPadding(dp(12), dp(8), dp(12), dp(8));
        quoteWho = new TextView(ctx);
        quoteWho.setTextColor(C_GREEN);
        quoteWho.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        quoteWho.setTypeface(Typeface.DEFAULT_BOLD);
        quoteWho.setSingleLine(true);
        quoteWho.setEllipsize(TextUtils.TruncateAt.END);
        quoteText = new TextView(ctx);
        quoteText.setTextColor(0xFFB5C0C7);
        quoteText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        quoteText.setMaxLines(2);
        quoteText.setEllipsize(TextUtils.TruncateAt.END);
        quoteCol.addView(quoteWho);
        quoteCol.addView(quoteText);
        quoteBox.addView(quoteCol, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout.LayoutParams ql = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        ql.setMargins(dp(8), dp(10), dp(8), 0);
        quoteBox.setVisibility(View.GONE);
        root.addView(quoteBox, ql);

        // the message
        msgView = new TextView(ctx);
        msgView.setTextColor(Color.WHITE);
        msgView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        msgView.setGravity(Gravity.CENTER_HORIZONTAL);
        msgView.setMaxLines(6);
        msgView.setEllipsize(TextUtils.TruncateAt.END);
        msgView.setPadding(dp(16), dp(10), dp(16), dp(14));
        root.addView(msgView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // reply row: [emoji  text box] (green mic / send)
        LinearLayout replyRow = new LinearLayout(ctx);
        replyRow.setOrientation(LinearLayout.HORIZONTAL);
        replyRow.setGravity(Gravity.CENTER_VERTICAL);
        replyRow.setPadding(dp(10), 0, dp(10), dp(10));

        LinearLayout pill = new LinearLayout(ctx);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setColor(C_PILL);
        pillBg.setCornerRadius(dp(28));
        pill.setBackground(pillBg);

        TextView emoji = new TextView(ctx);
        emoji.setText("☺");
        emoji.setTextColor(C_MUTED);
        emoji.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        emoji.setGravity(Gravity.CENTER);
        emoji.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                focusInput();
            }
        });
        pill.addView(emoji, new LinearLayout.LayoutParams(dp(54), dp(54)));

        input = new EditText(ctx);
        input.setBackgroundColor(Color.TRANSPARENT);
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(C_MUTED);
        input.setHint("Reply");
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setMaxLines(3);
        input.setPadding(0, dp(8), dp(12), dp(8));
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
        replyRow.addView(pill, new LinearLayout.LayoutParams(0, dp(54), 1f));

        actionBtn = new ActionButton(ctx);
        actionBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (input.getText().toString().trim().length() > 0) sendReply();
                else openCurrentChat(); // voice notes are recorded in the app itself
            }
        });
        LinearLayout.LayoutParams al = new LinearLayout.LayoutParams(dp(56), dp(56));
        al.leftMargin = dp(8);
        replyRow.addView(actionBtn, al);
        root.addView(replyRow, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // Close | View
        View line = new View(ctx);
        line.setBackgroundColor(C_LINE);
        root.addView(line, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)));
        LinearLayout buttons = new LinearLayout(ctx);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setPadding(dp(8), dp(10), dp(8), dp(10));
        TextView close = pillButton("Close");
        close.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dismiss();
            }
        });
        TextView view = pillButton("View");
        view.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openCurrentChat();
            }
        });
        LinearLayout.LayoutParams bl1 = new LinearLayout.LayoutParams(0, dp(52), 1f);
        bl1.setMargins(dp(4), 0, dp(10), 0);
        LinearLayout.LayoutParams bl2 = new LinearLayout.LayoutParams(0, dp(52), 1f);
        bl2.setMargins(dp(10), 0, dp(4), 0);
        buttons.addView(close, bl1);
        buttons.addView(view, bl2);
        root.addView(buttons, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        int width = Math.min(screenW() - dp(16), dp(520));
        lp = new WindowManager.LayoutParams(
            width,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        );
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.y = dp(70);
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        try {
            wm.addView(root, lp);
            root.setAlpha(0f);
            root.animate().alpha(1f).setDuration(160).start();
        } catch (RuntimeException e) {
            root = null;
            items.clear();
        }
    }

    private TextView arrow(String glyph) {
        TextView t = new TextView(ctx);
        t.setText(glyph);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 34);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        t.setIncludeFontPadding(false);
        return t;
    }

    private TextView pillButton(String label) {
        TextView t = new TextView(ctx);
        t.setText(label);
        t.setTextColor(0xFF0B141A);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(C_GREEN);
        bg.setCornerRadius(dp(26));
        t.setBackground(bg);
        return t;
    }

    // ---- showing the current message ----

    private void refresh() {
        if (root == null || counterView == null || msgView == null) return;
        if (items.isEmpty()) {
            removeView();
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
                        if (items.isEmpty()) removeView();
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
        input = null;
        actionBtn = null;
        sending = false;
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

    // ---- the green round button: microphone, or a send arrow once there is text ----

    private static final class ActionButton extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private boolean send = false;

        ActionButton(Context c) {
            super(c);
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
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(C_GREEN);
            cv.drawCircle(cx, cy, s / 2f, paint);
            paint.setColor(0xFF0B141A);
            if (send) {
                path.reset();
                path.moveTo(cx - 0.17f * s, cy - 0.2f * s);
                path.lineTo(cx + 0.22f * s, cy);
                path.lineTo(cx - 0.17f * s, cy + 0.2f * s);
                path.lineTo(cx - 0.09f * s, cy);
                path.close();
                cv.drawPath(path, paint);
            } else {
                RectF body = new RectF(cx - 0.09f * s, cy - 0.26f * s, cx + 0.09f * s, cy + 0.07f * s);
                cv.drawRoundRect(body, 0.09f * s, 0.09f * s, paint);
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(0.05f * s);
                paint.setStrokeCap(Paint.Cap.ROUND);
                RectF arc = new RectF(cx - 0.16f * s, cy - 0.15f * s, cx + 0.16f * s, cy + 0.17f * s);
                cv.drawArc(arc, 0f, 180f, false, paint);
                cv.drawLine(cx, cy + 0.17f * s, cx, cy + 0.26f * s, paint);
                cv.drawLine(cx - 0.07f * s, cy + 0.26f * s, cx + 0.07f * s, cy + 0.26f * s, paint);
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
