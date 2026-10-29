package android.app;
public class PendingIntent {
    public static final int FLAG_UPDATE_CURRENT = 134217728, FLAG_IMMUTABLE = 67108864;
    /** The intent of the last notification tap target (to check which chat it opens). */
    public static volatile android.content.Intent LAST;
    public static PendingIntent getActivity(android.content.Context c, int code, android.content.Intent i, int flags) { LAST = i; return new PendingIntent(); }
}
