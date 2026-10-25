package com.letschatafrica.chatbubble;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Draws the floating Letschat bubble in its own overlay window (no extra service needed: the background
 * service keeps the process alive). Drag to move, it snaps to the left or right edge, tap opens the app,
 * drop it in the bottom part of the screen to dismiss it until the next message.
 */
final class BubbleController {

    interface TapListener {
        void onTap(String chatId);
    }

    private static final String PREFS = "letschat_chat_bubble";
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
    private WindowManager.LayoutParams lp;
    private boolean onRight = true;
    private String chatId = "";

    private final Runnable hidePreviewTask = new Runnable() {
        @Override
        public void run() {
            if (preview != null) preview.setVisibility(View.GONE);
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

    void show(final int count, final String title, final String text, final String id) {
        ui.post(() -> {
            if (!Settings.canDrawOverlays(ctx)) return;
            ensureView();
            if (row == null) return;
            chatId = id == null ? "" : id;
            if (count > 0) {
                badge.setText(count > 99 ? "99+" : String.valueOf(count));
                badge.setVisibility(View.VISIBLE);
            } else {
                badge.setVisibility(View.GONE);
            }
            String line = (title == null || title.isEmpty()) ? (text == null ? "" : text) : (text == null || text.isEmpty() ? title : title + ": " + text);
            ui.removeCallbacks(hidePreviewTask);
            if (!line.isEmpty()) {
                preview.setText(line);
                preview.setVisibility(View.VISIBLE);
                ui.postDelayed(hidePreviewTask, 5000);
            } else {
                preview.setVisibility(View.GONE);
            }
        });
    }

    void hide() {
        ui.post(this::removeView);
    }

    // ---- view building ----

    private void ensureView() {
        if (row != null) return;
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        onRight = sp.getBoolean("right", true);
        int y = sp.getInt("y", dp(160));

        int size = dp(56);

        ImageView icon = new ImageView(ctx);
        try {
            icon.setImageDrawable(ctx.getPackageManager().getApplicationIcon(ctx.getPackageName()));
        } catch (Exception ignored) {}
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(0xFF0E1116);
        ring.setStroke(dp(2), 0xFF35D0BA);
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
        preview.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        preview.setMaxLines(2);
        preview.setEllipsize(TextUtils.TruncateAt.END);
        preview.setMaxWidth(dp(200));
        preview.setPadding(dp(12), dp(8), dp(12), dp(8));
        GradientDrawable previewBg = new GradientDrawable();
        previewBg.setColor(0xF01B2B33);
        previewBg.setCornerRadius(dp(16));
        preview.setBackground(previewBg);
        preview.setVisibility(View.GONE);

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
        if (onRight) {
            pl.rightMargin = gap;
            row.addView(preview, pl);
            row.addView(holder, hl);
        } else {
            pl.leftMargin = gap;
            row.addView(holder, hl);
            row.addView(preview, pl);
        }
    }

    private void removeView() {
        ui.removeCallbacks(hidePreviewTask);
        if (row != null) {
            try {
                wm.removeView(row);
            } catch (RuntimeException ignored) {}
        }
        row = null;
        holder = null;
        badge = null;
        preview = null;
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
                    preview.setVisibility(View.GONE);
                    // from here the position is measured from the left edge while dragging
                    lp.gravity = Gravity.TOP | Gravity.START;
                    lp.x = onRight ? screenW() - dp(56) : 0;
                    wm.updateViewLayout(row, lp);
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
                    wm.updateViewLayout(row, lp);
                    inDismissZone = e.getRawY() > screenH() * 0.88f;
                    holder.setAlpha(inDismissZone ? 0.5f : 1f);
                    holder.setScaleX(inDismissZone ? 1.2f : 1f);
                    holder.setScaleY(inDismissZone ? 1.2f : 1f);
                    return true;
                }
                case MotionEvent.ACTION_UP:
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

    // ---- helpers ----

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
