package com.letschatafrica.chatbubble;

import android.app.Notification;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Looper;
import android.util.Log;
import android.util.LruCache;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Gives Letschat's message notification the Facebook look:
 *  - the sender's photo as a round picture beside the text (the notification's large icon; Samsung phones draw it on the left),
 *  - the same photo as the picture on the right of the notification (big when the notification is pulled open),
 *  - the app name and small icon in the Letschat colour, with the time next to the name.
 * Someone without a photo gets the same coloured letter picture the chat head uses.
 *
 * Used by MessagePoller.postNotice. Nothing in here can break a notification: every failure just leaves the plain one.
 * The photo is downloaded here, so this must run on a worker thread (the message checker's thread is one); on the main thread only
 * photos that are already in the cache are used.
 * A message that is longer than one short line (or several messages at once) keeps the "pull open to read it all" text instead of the
 * picture on the right, because a notification can show only one of the two. The round photo is there either way.
 */
final class NoticeLook {

    private static final String TAG = "LetschatPoller";

    /** Colour of the app name and the small icon in the notification header (Facebook uses its blue, Letschat its green). */
    static final int ACCENT = 0xFF21C063;

    /** Size of the round photo, in pixels. */
    private static final int ROUND_PX = 192;
    /** Longest side of the picture, in pixels. */
    private static final int PICTURE_PX = 640;
    /** A message up to this many characters (one line) gets the picture on the right; a longer one keeps its full text. */
    private static final int SHORT_TEXT = 40;
    /** Biggest photo that is downloaded. */
    private static final int MAX_BYTES = 4 * 1024 * 1024;
    /** A downloaded photo is reused this long, so a changed profile picture shows up within minutes. */
    private static final long KEEP_MS = 15 * 60 * 1000L;
    /** After a photo failed to load it is not tried again for this long, so one dead link cannot slow down every alert. */
    private static final long RETRY_MS = 60 * 1000L;

    private static final class Photo {
        final Bitmap bitmap;
        final long at;

        Photo(Bitmap bitmap, long at) {
            this.bitmap = bitmap;
            this.at = at;
        }
    }

    private static final LruCache<String, Photo> PHOTOS = new LruCache<>(16);
    private static final Map<String, Long> FAILED = new HashMap<>();

    private NoticeLook() {}

    /**
     * Dresses the notification that is being built. title is the chat's name, photoUrl the sender's (or group's) photo, lines the
     * message text (several messages are separated by new lines). Never throws.
     */
    static void dress(Notification.Builder b, String title, String photoUrl, String lines) {
        if (b == null) return;
        try {
            b.setColor(ACCENT);
            b.setShowWhen(true);
            b.setWhen(System.currentTimeMillis());
        } catch (Throwable t) {
            Log.w(TAG, "notification colour and time skipped: " + t);
        }
        try {
            String name = title == null ? "" : title.trim();
            String text = lines == null ? "" : lines.trim();
            Bitmap picture = photo(photoUrl);
            if (picture == null) picture = letterTile(name);
            b.setLargeIcon(round(picture, ROUND_PX));
            if (!text.isEmpty() && text.length() <= SHORT_TEXT && text.indexOf('\n') < 0) {
                b.setStyle(new Notification.BigPictureStyle()
                        .bigPicture(picture)
                        .bigLargeIcon((Bitmap) null)
                        .setBigContentTitle(name.isEmpty() ? "Letschat" : name)
                        .setSummaryText(text));
            }
        } catch (Throwable t) {
            Log.w(TAG, "notification photo skipped: " + t);
        }
    }

    // ---- the photo ----

    /** The photo at this address, or null when there is none (or it cannot be loaded right now). */
    private static Bitmap photo(String url) {
        if (url == null || url.isEmpty()) return null;
        long now = System.currentTimeMillis();
        Photo hit = PHOTOS.get(url);
        if (hit != null && now - hit.at < KEEP_MS) return hit.bitmap;
        Bitmap old = hit == null ? null : hit.bitmap; // an old copy is better than none
        if (Looper.myLooper() == Looper.getMainLooper()) return old; // no network on the main thread
        synchronized (FAILED) {
            Long failedAt = FAILED.get(url);
            if (failedAt != null && now - failedAt < RETRY_MS) return old;
        }
        Bitmap fresh = fetch(url);
        if (fresh != null) {
            PHOTOS.put(url, new Photo(fresh, System.currentTimeMillis()));
            return fresh;
        }
        synchronized (FAILED) {
            if (FAILED.size() > 64) FAILED.clear();
            FAILED.put(url, System.currentTimeMillis());
        }
        return old;
    }

    /** Downloads and shrinks a photo; null on any problem (no connection, not a picture, too big, ...). */
    private static Bitmap fetch(String url) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(3500);
            c.setReadTimeout(4500);
            c.setRequestProperty("Accept", "image/*");
            if (c.getResponseCode() != 200) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            InputStream in = c.getInputStream();
            try {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    if (out.size() > MAX_BYTES) return null; // not a profile photo
                }
            } finally {
                in.close();
            }
            byte[] data = out.toByteArray();
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null; // not a picture Android can read (for example an SVG)
            int sample = 1;
            while (bounds.outWidth / (sample * 2) >= PICTURE_PX && bounds.outHeight / (sample * 2) >= PICTURE_PX) sample *= 2;
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = sample;
            Bitmap decoded = BitmapFactory.decodeByteArray(data, 0, data.length, opts);
            return decoded == null ? null : fit(decoded, PICTURE_PX);
        } catch (Throwable e) {
            Log.w(TAG, "notification photo not loaded: " + e);
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** The picture scaled down so that its longest side is at most maxSide pixels (a smaller picture is returned as it is). */
    private static Bitmap fit(Bitmap src, int maxSide) {
        int w = src.getWidth();
        int h = src.getHeight();
        int longest = Math.max(w, h);
        if (longest <= maxSide) return src;
        float scale = (float) maxSide / longest;
        return Bitmap.createScaledBitmap(src, Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)), true);
    }

    // ---- drawing ----

    /** The middle of the picture cut into a circle, size x size pixels (transparent corners). */
    private static Bitmap round(Bitmap src, int size) {
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        BitmapShader shader = new BitmapShader(src, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
        float scale = Math.max((float) size / src.getWidth(), (float) size / src.getHeight());
        Matrix m = new Matrix();
        m.setScale(scale, scale);
        m.postTranslate((size - src.getWidth() * scale) / 2f, (size - src.getHeight() * scale) / 2f);
        shader.setLocalMatrix(m);
        p.setShader(shader);
        cv.drawCircle(size / 2f, size / 2f, size / 2f, p);
        return out;
    }

    /** A coloured square with the first letter of the name: the same look (and colours) as the letter circle in the chat head pop-up. */
    private static Bitmap letterTile(String name) {
        int size = 512;
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) n = "L";
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        int[] palette = { 0xFF35D0BA, 0xFF7C6CF0, 0xFFF2B84B, 0xFFE8618C, 0xFF3FA9F5, 0xFF21C063 };
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(palette[(n.hashCode() & 0x7fffffff) % palette.length]);
        cv.drawRect(0, 0, size, size, p);
        p.setColor(Color.WHITE);
        p.setTypeface(Typeface.DEFAULT_BOLD);
        p.setTextSize(size * 0.46f);
        p.setTextAlign(Paint.Align.CENTER);
        String letter = n.substring(0, n.offsetByCodePoints(0, 1)).toUpperCase(Locale.ROOT);
        cv.drawText(letter, size / 2f, size / 2f - (p.descent() + p.ascent()) / 2f, p);
        return bmp;
    }
}
