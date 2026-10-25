package com.letschatafrica.chatbubble;

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
import android.text.TextUtils;
import android.util.LruCache;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.view.animation.OvershootInterpolator;
import android.widget.TextView;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Draws the floating Letschat chat head in its own overlay window: the sender's round photo with a red unread badge and a
 * blue speech bubble showing the message (like Messenger). It is drawn in its own overlay window (no extra service needed: the background
 * service keeps the process alive). Drag to move, it snaps to the left or right edge, tap opens the app,
 * drop it in the bottom part of the screen to dismiss it until the next message.
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
            // the speech bubble shows the message itself (the sender is the photo next to it)
            String line = (text == null || text.isEmpty()) ? (title == null ? "" : title) : text;
            ui.removeCallbacks(hidePreviewTask);
            if (!line.isEmpty()) {
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
        preview.setTypeface(Typeface.DEFAULT_BOLD);
        preview.setMaxLines(3);
        preview.setEllipsize(TextUtils.TruncateAt.END);
        preview.setMaxWidth(dp(220));
        preview.setPadding(dp(14), dp(9), dp(14), dp(9));
        GradientDrawable previewBg = new GradientDrawable();
        previewBg.setColor(BUBBLE_BLUE);
        previewBg.setCornerRadius(dp(18));
        preview.setBackground(previewBg);
        preview.setVisibility(View.GONE);

        // small diamond that makes the speech bubble point at the photo
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
        hideTarget();
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

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            if (row == null) return false;
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    ui.removeCallbacks(hidePreviewTask);
                    setPreviewVisible(false);
                    // from here the position is measured from the left edge while dragging
                    lp.gravity = Gravity.TOP | Gravity.START;
                    lp.x = onRight ? screenW() - dp(56) : 0;
                    updateLayoutSafe();
                    startX = lp.x;
                    startY = lp.y;
                    touchX = e.getRawX();
                    touchY = e.getRawY();
                    moved = false;
                    inDismissZone = false;
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    float dx = e.getRawX() - touchX;
                    float dy = e.getRawY() - touchY;
                    if (!moved && Math.abs(dx) < dp(6) && Math.abs(dy) < dp(6)) return true;
                    moved = true;
                    lp.x = Math.max(0, Math.min(screenW() - dp(56), (int) (startX + dx)));
                    lp.y = clampY((int) (startY + dy));
                    updateLayoutSafe();
                    showTarget();
                    inDismissZone = overTarget(e.getRawX(), e.getRawY());
                    // stays fully visible while dragged (only a little bigger over the X)
                    holder.setAlpha(1f);
                    holder.setScaleX(inDismissZone ? 1.2f : 1f);
                    holder.setScaleY(inDismissZone ? 1.2f : 1f);
                    return true;
                }
                case MotionEvent.ACTION_UP:
                    hideTarget();
                    holder.setAlpha(1f);
                    holder.setScaleX(1f);
                    holder.setScaleY(1f);
                    if (!moved) {
                        openApp();
                    } else if (inDismissZone) {
                        removeView();
                    } else {
                        snapToEdge();
                    }
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    hideTarget();
                    holder.setAlpha(1f);
                    holder.setScaleX(1f);
                    holder.setScaleY(1f);
                    snapToEdge();
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

    private void snapToEdge() {
        if (row == null) return;
        onRight = (lp.x + dp(28)) > screenW() / 2;
        lp.gravity = Gravity.TOP | (onRight ? Gravity.END : Gravity.START);
        lp.x = 0;
        lp.y = clampY(lp.y);
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("right", onRight).putInt("y", lp.y).apply();
        arrange();
        try {
            wm.updateViewLayout(row, lp);
        } catch (RuntimeException ignored) {}
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
    }

    /** True while the finger is over the X; the X turns red and grows. */
    private boolean overTarget(float rawX, float rawY) {
        if (xTarget == null || xTarget.getWidth() == 0) return false;
        int[] loc = new int[2];
        xTarget.getLocationOnScreen(loc);
        float cx = loc[0] + xTarget.getWidth() / 2f;
        float cy = loc[1] + xTarget.getHeight() / 2f;
        float dx = rawX - cx;
        float dy = rawY - cy;
        float reach = dp(56);
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
