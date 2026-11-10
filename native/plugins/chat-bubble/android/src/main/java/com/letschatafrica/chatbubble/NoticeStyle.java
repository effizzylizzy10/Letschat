package com.letschatafrica.chatbubble;

import android.app.Notification;
import android.app.Person;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.util.Log;
import android.util.LruCache;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Gives the message notification the Facebook Lite look: the sender's profile photo as a small ROUND picture on the left, the sender's
 * name on top and the message under it (several new messages from one person are listed one under the other).
 *
 * MessagePoller reaches this class by name (reflection) and inside a try/catch, so a missing class, a photo that cannot be downloaded or any
 * other problem only leaves the plain notification: nothing here can stop a message alert. It runs on the checker's own thread, so the
 * photo download never blocks the screen. Photos are kept in a small cache, so the same person's photo is downloaded once.
 *
 * Android 9 and newer (API 28) draw a messaging-style notification with the person's picture round on the left. Older phones get the
 * round picture as the notification's large icon.
 */
final class NoticeStyle {

    private static final String TAG = "LetschatNotice";
    private static final int SIZE = 192;
    private static final LruCache<String, Bitmap> CACHE = new LruCache<String, Bitmap>(16);

    private NoticeStyle() {}

    /** Called by MessagePoller.postNotice (by name). texts: the new messages to list, oldest first. */
    static void apply(Context ctx, Notification.Builder b, String title, String avatarUrl, String[] texts) {
        Bitmap round = null;
        try {
            round = avatar(avatarUrl);
        } catch (Throwable e) {
            Log.w(TAG, "profile photo not used: " + e);
        }
        if (Build.VERSION.SDK_INT >= 28 && texts != null && texts.length > 0) {
            Person.Builder pb = new Person.Builder().setName(title == null || title.isEmpty() ? "Letschat" : title);
            if (round != null) pb.setIcon(Icon.createWithBitmap(round));
            Person who = pb.build();
            Notification.MessagingStyle style = new Notification.MessagingStyle(new Person.Builder().setName("You").build());
            long now = System.currentTimeMillis();
            for (int i = 0; i < texts.length; i++) {
                style.addMessage(texts[i], now - (texts.length - i) * 1000L, who);
            }
            b.setStyle(style);
        } else if (round != null) {
            b.setLargeIcon(round);
        }
    }

    /** The person's profile photo cut into a circle, or null when there is none or it cannot be downloaded. */
    private static Bitmap avatar(String url) throws Exception {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return null;
        Bitmap hit = CACHE.get(url);
        if (hit != null) return hit;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(4000);
            c.setReadTimeout(6000);
            if (c.getResponseCode() != 200) return null;
            InputStream in = c.getInputStream();
            Bitmap src;
            try {
                src = BitmapFactory.decodeStream(in);
            } finally {
                in.close();
            }
            if (src == null) return null;
            Bitmap round = circle(src);
            CACHE.put(url, round);
            return round;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static Bitmap circle(Bitmap src) {
        int side = Math.min(src.getWidth(), src.getHeight());
        Bitmap square = Bitmap.createBitmap(src, (src.getWidth() - side) / 2, (src.getHeight() - side) / 2, side, side);
        Bitmap scaled = Bitmap.createScaledBitmap(square, SIZE, SIZE, true);
        Bitmap out = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        canvas.drawCircle(SIZE / 2f, SIZE / 2f, SIZE / 2f, paint);
        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(scaled, 0, 0, paint);
        return out;
    }
}
