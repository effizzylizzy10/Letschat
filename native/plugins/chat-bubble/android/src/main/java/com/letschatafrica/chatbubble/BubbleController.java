package com.letschatafrica.chatbubble;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.util.LruCache;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.TextView;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Draws the floating Letschat chat head in its own overlay window: the sender's round photo with a red unread badge and a
 * blue toast next to it (the sender's name and the message, shown for a few seconds every time a new message arrives). It is drawn
 * in its own overlay window (no extra service needed: the background service keeps the process alive). Behaves like the Messenger
 * chat head: drag to move, let go and it glides to the left or right edge (a fling picks the side), and dragging it onto the X at
 * the bottom pulls it in; letting go there shrinks it away until the next message. The head is never faded: it always stays fully opaque.
 * A tap on the head (or on its toast) makes it grow into the WhatsApp-style message card (see MessagePopup) when messages are
 * waiting; the head is tucked away while the card is open and pops back when the card closes. With nothing waiting, a tap opens the app.
 */
final class BubbleController {

    interface TapListener {
        void onTap(String chatId);
    }

    private static final String PREFS = "letschat_chat_bubble";
    private static final int BUBBLE_BLUE = 0xFF1B8CF5;
    private static BubbleController instance;

    static synchronized BubbleController get(Context context) {
        if (instance == null) instance = new BubbleController(context.getApplicationContext());
        return instance;
    }

    private final Context ctx;
    private final WindowManager wm;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final float density;
    private TapListener listener;

    private LinearLayout row;
    private FrameLayout holder;
    private TextView badge;
    private TextView preview;
    private View tail;
    private ImageView avatarView;
    private String avatarUrl = "";
    private final LruCache<String, Bitmap> avatars = new LruCache<>(12);
    private WindowManager.LayoutParams lp;
    private boolean onRight = true;
    private String chatId = "";
    private FrameLayout xTarget;
    private GradientDrawable xBg;
    /** Screen centre of the X target, measured once while it is at normal size. */
    private int[] xCenter;
    /** True while a finger is on the chat head: nothing may restyle, dim or animate it meanwhile. */
    private boolean dragging = false;
    /** True while the head glides to an edge or shrinks into the X: a new message must not restyle it meanwhile. */
    private boolean snapping = false;
    /** True while the message card is open: the head is shrunk away inside it and does not catch touches. */
    private boolean expanded = false;
    private ValueAnimator snapAnim;
    /** Difference between a screen y and the overlay window's own y (the status bar), used to place the head on the X. */
    private int winOffY = 0;

    private final Runnable hidePreviewTask = new Runnable() {
        @Override
        public void run() {
            setPreviewVisible(false);
        }
    };

    private BubbleController(Context appContext) {
        ctx = appContext;
        wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
        density = ctx.getResources().getDisplayMetrics().density;
    }

    void setListener(TapListener l) {
        listener = l;
    }

    boolean isEnabled() {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", true);
    }

    void setEnabled(boolean enabled) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("enabled", enabled).apply();
        if (!enabled) hide();
    }

    void show(final int count, final String title, final String text, final String id, final String avatar) {
        ui.post(() -> {
            try {
                showNow(count, title, text, id, avatar);
            } catch (Throwable t) {
                try {
                    removeView();
                } catch (Throwable ignored) {}
            }
        });
    }

    private void showNow(final int count, final String title, final String text, final String id, final String avatar) {
        {
            if (!isEnabled() || !Settings.canDrawOverlays(ctx)) return;
            if (expanded) {
                if (MessagePopup.get(ctx).isOpen()) return; // the message card is open: the head is tucked away inside it
                restoreHead(false); // the card is gone but the head was never given back
            }
            ensureView();
            if (row == null) return;
            chatId = id == null ? "" : id;
            if (count > 0) {
                badge.setText(count > 99 ? "99+" : String.valueOf(count));
                badge.setVisibility(View.VISIBLE);
            } else {
                badge.setVisibility(View.GONE);
            }
            setAvatar(avatar, title);
            if (dragging || snapping) return; // the person is moving the head right now: never shrink, fade or re-pop it under their finger
            // the toast: the sender's name above the message
            CharSequence line = toastText(title, text);
            ui.removeCallbacks(hidePreviewTask);
            if (line.length() > 0) {
                preview.setText(line);
                boolean wasHidden = preview.getVisibility() != View.VISIBLE;
                setPreviewVisible(true);
                if (wasHidden) {
                    preview.setAlpha(0f);
                    preview.animate().alpha(1f).setDuration(180).start();
                }
                holder.setScaleX(0.7f);
                holder.setScaleY(0.7f);
                holder.animate().scaleX(1f).scaleY(1f).setDuration(260).setInterpolator(new OvershootInterpolator(2f)).start();
                ui.postDelayed(hidePreviewTask, 6000);
            } else {
                setPreviewVisible(false);
            }
        }
    }

    /** The toast text: the sender's name (small and bold) on the first line, the message below it. */
    private CharSequence toastText(String title, String text) {
        String name = title == null ? "" : title.trim();
        String msg = text == null ? "" : text.trim();
        if (name.isEmpty()) return msg;
        if (msg.isEmpty()) return name;
        SpannableStringBuilder sb = new SpannableStringBuilder(name);
        sb.setSpan(new StyleSpan(Typeface.BOLD), 0, name.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        sb.setSpan(new RelativeSizeSpan(0.85f), 0, name.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        sb.setSpan(new ForegroundColorSpan(0xFFCFE8FF), 0, name.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        sb.append('\n').append(msg);
        return sb;
    }

    void hide() {
        MessagePopup.get(ctx).dismiss(); // the message pop-up goes away together with the chat head
        ui.post(this::removeView);
    }

    /** "View" in the message pop-up: opens Letschat and tells the page which chat to show. */
    void openChat(final String id) {
        ui.post(() -> {
            chatId = id == null ? "" : id;
            openApp();
        });
    }

    // ---- tap: the head grows into the message card ----

    /** Screen position of the middle of the head (null when it is not on screen). Not affected by the head's own pop animation. */
    int[] headCenter() {
        if (row == null || holder == null || holder.getWidth() == 0) return null;
        int[] loc = new int[2];
        row.getLocationOnScreen(loc);
        return new int[] { loc[0] + holder.getLeft() + holder.getWidth() / 2, loc[1] + holder.getTop() + holder.getHeight() / 2 };
    }

    /** A tap on the head or on its toast: with waiting messages the head grows into the message card, otherwise Letschat opens. */
    private void onHeadTapped() {
        ui.removeCallbacks(hidePreviewTask);
        MessagePopup popup = MessagePopup.get(ctx);
        int[] c = headCenter();
        if (c != null && popup.hasMessages() && popup.expandFrom(c[0], c[1])) return;
        openApp();
    }

    /** The message card is opening out of the head: the head shrinks away into it (size only, never faded) and stops catching touches. */
    void onCardOpened() {
        expanded = true;
        ui.removeCallbacks(hidePreviewTask);
        if (row == null || holder == null) return;
        setPreviewVisible(false);
        holder.animate().cancel();
        holder.animate().scaleX(0f).scaleY(0f).setDuration(160).setInterpolator(new DecelerateInterpolator()).withEndAction(new Runnable() {
            @Override
            public void run() {
                if (expanded && lp != null && row != null) {
                    lp.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
                    updateLayoutSafe();
                }
            }
        }).start();
    }

    /** The message card is gone again (Close, or every waiting message was answered): the head pops back with the messages still waiting. */
    void onCardClosed(int remaining) {
        if (!expanded) return;
        if (badge != null) {
            if (remaining > 0) {
                badge.setText(remaining > 99 ? "99+" : String.valueOf(remaining));
                badge.setVisibility(View.VISIBLE);
            } else {
                badge.setVisibility(View.GONE);
            }
        }
        setPreviewVisible(false);
        restoreHead(true);
    }

    /** Gives the head back (touchable and full size), with a small pop when the card has just shrunk into it. */
    private void restoreHead(boolean pop) {
        expanded = false;
        if (row == null || holder == null || lp == null) return;
        lp.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        updateLayoutSafe();
        holder.animate().cancel();
        if (pop) {
            holder.setScaleX(0f);
            holder.setScaleY(0f);
            holder.animate().scaleX(1f).scaleY(1f).setDuration(260).setInterpolator(new OvershootInterpolator(2.4f)).start();
        } else {
            holder.setScaleX(1f);
            holder.setScaleY(1f);
        }
    }

    // ---- view building ----

    private void ensureView() {
        if (row != null) return;
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        onRight = sp.getBoolean("right", true);
        int y = sp.getInt("y", dp(160));

        int size = dp(56);

        ImageView icon = new ImageView(ctx);
        avatarView = icon;
        avatarUrl = "";
        try {
            icon.setImageDrawable(ctx.getPackageManager().getApplicationIcon(ctx.getPackageName()));
        } catch (Exception ignored) {}
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(0xFF0E1116);
        ring.setStroke(dp(2), Color.WHITE);
        icon.setBackground(ring);
        icon.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        icon.setClipToOutline(true);

        badge = new TextView(ctx);
        badge.setTextColor(Color.WHITE);
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setGravity(Gravity.CENTER);
        badge.setMinWidth(dp(20));
        badge.setPadding(dp(5), 0, dp(5), 0);
        GradientDrawable badgeBg = new GradientDrawable();
        badgeBg.setColor(0xFFE53935);
        badgeBg.setCornerRadius(dp(10));
        badge.setBackground(badgeBg);
        badge.setVisibility(View.GONE);

        holder = new FrameLayout(ctx);
        holder.addView(icon, new FrameLayout.LayoutParams(size, size));
        holder.addView(badge, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, dp(20), Gravity.TOP | Gravity.END));

        preview = new TextView(ctx);
        preview.setTextColor(Color.WHITE);
        preview.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        preview.setTypeface(Typeface.DEFAULT);
        preview.setMaxLines(3);
        preview.setEllipsize(TextUtils.TruncateAt.END);
        preview.setMaxWidth(dp(220));
        preview.setPadding(dp(14), dp(9), dp(14), dp(9));
        GradientDrawable previewBg = new GradientDrawable();
        previewBg.setColor(BUBBLE_BLUE);
        previewBg.setCornerRadius(dp(18));
        preview.setBackground(previewBg);
        preview.setVisibility(View.GONE);
        preview.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                onHeadTapped(); // tapping the toast works like tapping the head
            }
        });

        // small diamond that makes the toast point at the photo
        tail = new View(ctx);
        GradientDrawable tailBg = new GradientDrawable();
        tailBg.setColor(BUBBLE_BLUE);
        tailBg.setCornerRadius(dp(2));
        tail.setBackground(tailBg);
        tail.setRotation(45f);
        tail.setVisibility(View.GONE);

        row = new LinearLayout(ctx);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);

        holder.setOnTouchListener(new DragListener());

        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        lp = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        );
        lp.alpha = 1f; // the whole window is always fully opaque
        lp.gravity = Gravity.TOP | (onRight ? Gravity.END : Gravity.START);
        lp.x = 0;
        lp.y = clampY(y);
        arrange();
        try {
            wm.addView(row, lp);
        } catch (RuntimeException e) {
            row = null;
            holder = null;
        }
    }

    /** Preview goes on the inner side of the bubble so it never leaves the screen. */
    private void arrange() {
        row.removeAllViews();
        int gap = dp(8);
        LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        LinearLayout.LayoutParams hl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(dp(12), dp(12));
        if (onRight) {
            tl.leftMargin = -dp(8);
            tl.rightMargin = gap - dp(2);
            row.addView(preview, pl);
            row.addView(tail, tl);
            row.addView(holder, hl);
        } else {
            tl.rightMargin = -dp(8);
            tl.leftMargin = gap - dp(2);
            row.addView(holder, hl);
            row.addView(tail, tl);
            row.addView(preview, pl);
        }
    }

    private void removeView() {
        ui.removeCallbacks(hidePreviewTask);
        if (snapAnim != null) {
            snapAnim.cancel();
            snapAnim = null;
        }
        snapping = false;
        expanded = false;
        hideTarget();
        dragging = false;
        if (row != null) {
            try {
                wm.removeView(row);
            } catch (RuntimeException ignored) {}
        }
        row = null;
        holder = null;
        badge = null;
        preview = null;
        tail = null;
        avatarView = null;
        avatarUrl = "";
    }

    private void openApp() {
        Intent i = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (i != null) {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            try {
                ctx.startActivity(i);
            } catch (RuntimeException ignored) {}
        }
        if (listener != null) listener.onTap(chatId);
        removeView();
    }

    // ---- dragging ----

    private final class DragListener implements View.OnTouchListener {
        private int startX;
        private int startY;
        private float touchX;
        private float touchY;
        private boolean moved;
        private boolean inDismissZone;
        private VelocityTracker vt;

        /** Feeds the velocity tracker with screen coordinates (the window moves with the finger, so view coordinates would read as standing still). */
        private void track(MotionEvent e) {
            if (vt == null) return;
            MotionEvent c = MotionEvent.obtain(e);
            c.setLocation(e.getRawX(), e.getRawY());
            vt.addMovement(c);
            c.recycle();
        }

        private void releaseTracker() {
            if (vt != null) {
                vt.recycle();
                vt = null;
            }
        }

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            if (row == null) return false;
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN: {
                    ui.removeCallbacks(hidePreviewTask);
                    // catching the head while it is still gliding to an edge: keep it exactly where it is
                    boolean midGlide = snapping;
                    if (snapAnim != null) {
                        snapAnim.cancel();
                        snapAnim = null;
                    }
                    snapping = false;
                    dragging = true;
                    // an arrival animation (fade-in or pop) that is still running must not fight the finger
                    holder.animate().cancel();
                    if (preview != null) preview.animate().cancel();
                    holder.setAlpha(1f);
                    holder.setScaleX(1f);
                    holder.setScaleY(1f);
                    row.setAlpha(1f);
                    setPreviewVisible(false);
                    if (!midGlide) {
                        int[] loc = new int[2];
                        row.getLocationOnScreen(loc);
                        winOffY = loc[1] - lp.y;
                        // from here the position is measured from the left edge while dragging
                        lp.gravity = Gravity.TOP | Gravity.START;
                        lp.x = onRight ? screenW() - dp(56) : 0;
                        updateLayoutSafe();
                    }
                    releaseTracker();
                    vt = VelocityTracker.obtain();
                    track(e);
                    startX = lp.x;
                    startY = lp.y;
                    touchX = e.getRawX();
                    touchY = e.getRawY();
                    moved = false;
                    inDismissZone = false;
                    return true;
                }
                case MotionEvent.ACTION_MOVE: {
                    track(e);
                    float dx = e.getRawX() - touchX;
                    float dy = e.getRawY() - touchY;
                    if (!moved && Math.abs(dx) < dp(6) && Math.abs(dy) < dp(6)) return true;
                    moved = true;
                    showTarget();
                    // near the X the head is pulled into its centre (and stays there until the finger moves clearly away)
                    inDismissZone = overTarget(e.getRawX(), e.getRawY(), inDismissZone);
                    int[] c = inDismissZone ? targetCenter() : null;
                    if (c != null) {
                        lp.x = c[0] - dp(28);
                        lp.y = c[1] - dp(28) - winOffY;
                    } else {
                        lp.x = Math.max(0, Math.min(screenW() - dp(56), (int) (startX + dx)));
                        lp.y = clampY((int) (startY + dy));
                    }
                    updateLayoutSafe();
                    // stays fully visible and full size while dragged
                    holder.setAlpha(1f);
                    holder.setScaleX(1f);
                    holder.setScaleY(1f);
                    return true;
                }
                case MotionEvent.ACTION_UP: {
                    track(e);
                    dragging = false;
                    float vx = 0f;
                    float vy = 0f;
                    if (vt != null) {
                        vt.computeCurrentVelocity(1000);
                        vx = vt.getXVelocity();
                        vy = vt.getYVelocity();
                    }
                    releaseTracker();
                    if (!moved) {
                        hideTarget();
                        holder.setScaleX(1f);
                        holder.setScaleY(1f);
                        onHeadTapped(); // waiting messages: the head grows into the message card; otherwise Letschat opens
                    } else if (inDismissZone) {
                        dismissAnimated(); // the X stays on screen until the head has shrunk into it
                    } else {
                        hideTarget();
                        holder.setScaleX(1f);
                        holder.setScaleY(1f);
                        animateSnap(vx, vy);
                    }
                    return true;
                }
                case MotionEvent.ACTION_CANCEL:
                    dragging = false;
                    releaseTracker();
                    hideTarget();
                    holder.setAlpha(1f);
                    holder.setScaleX(1f);
                    holder.setScaleY(1f);
                    animateSnap(0f, 0f);
                    return true;
                default:
                    return false;
            }
        }
    }

    private void updateLayoutSafe() {
        try {
            if (row != null) wm.updateViewLayout(row, lp);
        } catch (RuntimeException ignored) {}
    }

    /**
     * Messenger-style release: the head glides to the nearest side edge (a sideways fling chooses the side) and a vertical
     * fling carries it a little further up or down. Only position and size are animated, never opacity.
     */
    private void animateSnap(float vx, float vy) {
        if (row == null) return;
        final int w = dp(56);
        final boolean right;
        if (Math.abs(vx) > dp(500)) {
            right = vx > 0;
        } else {
            right = (lp.x + w / 2) > screenW() / 2;
        }
        final int fromX = lp.x;
        final int fromY = lp.y;
        final int toX = right ? screenW() - w : 0;
        final int toY = clampY(lp.y + (int) (vy * 0.12f));
        if (snapAnim != null) snapAnim.cancel();
        snapping = true;
        final boolean[] cancelled = { false };
        final ValueAnimator a = ValueAnimator.ofFloat(0f, 1f);
        a.setDuration(260);
        a.setInterpolator(new DecelerateInterpolator(2f));
        a.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
            @Override
            public void onAnimationUpdate(ValueAnimator an) {
                if (row == null) return;
                float f = (Float) an.getAnimatedValue();
                lp.x = fromX + (int) ((toX - fromX) * f);
                lp.y = fromY + (int) ((toY - fromY) * f);
                updateLayoutSafe();
            }
        });
        a.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationCancel(Animator animation) {
                cancelled[0] = true;
            }

            @Override
            public void onAnimationEnd(Animator animation) {
                if (!cancelled[0]) finishSnap(right);
            }
        });
        snapAnim = a;
        a.start();
    }

    /** The glide has arrived: switch the window back to edge gravity, remember the spot and give the head a small landing bounce. */
    private void finishSnap(boolean right) {
        snapping = false;
        snapAnim = null;
        if (row == null) return;
        onRight = right;
        lp.gravity = Gravity.TOP | (onRight ? Gravity.END : Gravity.START);
        lp.x = 0;
        lp.y = clampY(lp.y);
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("right", onRight).putInt("y", lp.y).apply();
        arrange();
        updateLayoutSafe();
        if (holder != null) {
            holder.setScaleX(0.88f);
            holder.setScaleY(0.88f);
            holder.animate().scaleX(1f).scaleY(1f).setDuration(220).setInterpolator(new OvershootInterpolator(3f)).start();
        }
    }

    /** Dropped on the X: the head shrinks into it (size only, it is never faded), then the window goes away until the next message. */
    private void dismissAnimated() {
        final FrameLayout h = holder;
        if (h == null || row == null) {
            removeView();
            return;
        }
        snapping = true; // nothing may restyle the head while it shrinks
        h.animate().scaleX(0f).scaleY(0f).setDuration(160).setInterpolator(new DecelerateInterpolator()).withEndAction(new Runnable() {
            @Override
            public void run() {
                snapping = false;
                if (holder == h) removeView();
            }
        }).start();
    }


    // ---- the X "cancel" target that appears at the bottom while the chat head is dragged ----

    private void showTarget() {
        if (xTarget != null) return;
        TextView x = new TextView(ctx);
        x.setText("✕");
        x.setTextColor(Color.WHITE);
        x.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        x.setTypeface(Typeface.DEFAULT_BOLD);
        x.setGravity(Gravity.CENTER);
        xBg = new GradientDrawable();
        xBg.setShape(GradientDrawable.OVAL);
        xBg.setColor(0xCC1B1F27);
        xBg.setStroke(dp(2), 0x66FFFFFF);
        x.setBackground(xBg);
        FrameLayout box = new FrameLayout(ctx);
        box.addView(x, new FrameLayout.LayoutParams(dp(64), dp(64)));
        box.setAlpha(0f);
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams tp = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT
        );
        tp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        tp.y = dp(56);
        try {
            wm.addView(box, tp);
            xTarget = box;
            box.animate().alpha(1f).setDuration(150).start();
        } catch (RuntimeException e) {
            xTarget = null;
        }
    }

    private void hideTarget() {
        if (xTarget != null) {
            try {
                wm.removeView(xTarget);
            } catch (RuntimeException ignored) {}
        }
        xTarget = null;
        xBg = null;
        xCenter = null;
    }

    /** Screen centre of the X, measured while it is at normal size (null until it has been laid out). */
    private int[] targetCenter() {
        if (xTarget == null || xTarget.getWidth() == 0) return null;
        if (xCenter == null && xTarget.getScaleX() == 1f) {
            int[] loc = new int[2];
            xTarget.getLocationOnScreen(loc);
            xCenter = new int[] { loc[0] + xTarget.getWidth() / 2, loc[1] + xTarget.getHeight() / 2 };
        }
        return xCenter;
    }

    /**
     * True while the finger is near the X: the head is then pulled into the X, which turns red and grows. Once caught it stays
     * caught until the finger moves clearly away (a larger radius), so it does not flicker at the edge.
     */
    private boolean overTarget(float rawX, float rawY, boolean wasNear) {
        int[] c = targetCenter();
        if (c == null) return false;
        float dx = rawX - c[0];
        float dy = rawY - c[1];
        float reach = wasNear ? dp(76) : dp(56);
        boolean hit = dx * dx + dy * dy < reach * reach;
        if (xBg != null) xBg.setColor(hit ? 0xFFE53935 : 0xCC1B1F27);
        xTarget.setScaleX(hit ? 1.25f : 1f);
        xTarget.setScaleY(hit ? 1.25f : 1f);
        return hit;
    }

    // ---- helpers ----

    private void setPreviewVisible(boolean visible) {
        int v = visible ? View.VISIBLE : View.GONE;
        if (preview != null) preview.setVisibility(v);
        if (tail != null) tail.setVisibility(v);
    }

    /** Shows the sender's photo; until it is downloaded (or when there is none) a coloured circle with their first letter. */
    private void setAvatar(final String url, String name) {
        if (avatarView == null) return;
        final String u = url == null ? "" : url;
        if (u.equals(avatarUrl) && !u.isEmpty()) return; // same person: keep their photo
        avatarUrl = u;
        Bitmap cached = u.isEmpty() ? null : avatars.get(u);
        if (cached != null) {
            avatarView.setImageBitmap(cached);
            return;
        }
        if (name != null && !name.trim().isEmpty()) {
            avatarView.setImageBitmap(letterBitmap(name.trim()));
        }
        if (u.isEmpty()) return;
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(u).openConnection();
                c.setConnectTimeout(6000);
                c.setReadTimeout(6000);
                if (c.getResponseCode() != 200) return;
                try (InputStream in = c.getInputStream()) {
                    final Bitmap b = BitmapFactory.decodeStream(in);
                    if (b == null) return;
                    ui.post(() -> {
                        avatars.put(u, b);
                        if (avatarView != null && u.equals(avatarUrl)) avatarView.setImageBitmap(b);
                    });
                }
            } catch (Exception ignored) {
                // keep the letter circle
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }

    private Bitmap letterBitmap(String name) {
        int size = dp(112);
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

    private int clampY(int y) {
        return Math.max(0, Math.min(screenH() - dp(56) - dp(96), y));
    }

    private int screenW() {
        return ctx.getResources().getDisplayMetrics().widthPixels;
    }

    private int screenH() {
        return ctx.getResources().getDisplayMetrics().heightPixels;
    }

    private int dp(float v) {
        return (int) (v * density + 0.5f);
    }
}
