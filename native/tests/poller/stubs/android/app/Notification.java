package android.app;
public class Notification {
    public static final String CATEGORY_MESSAGE = "msg";
    public static final int PRIORITY_HIGH = 1, VISIBILITY_PRIVATE = 0, DEFAULT_ALL = -1;
    public String title = "", text = "", bigText = "";
    public int icon;
    public static class Style { }
    public static class BigTextStyle extends Style { String t = ""; public BigTextStyle bigText(CharSequence c) { t = String.valueOf(c); return this; } }
    public static class Builder {
        private final Notification n = new Notification();
        public Builder(android.content.Context c) { }
        public Builder(android.content.Context c, String channel) { }
        public Builder setSmallIcon(int i) { n.icon = i; return this; }
        public Builder setContentTitle(CharSequence c) { n.title = String.valueOf(c); return this; }
        public Builder setContentText(CharSequence c) { n.text = String.valueOf(c); return this; }
        public Builder setAutoCancel(boolean b) { return this; }
        public Builder setStyle(Style s) { if (s instanceof BigTextStyle) n.bigText = ((BigTextStyle) s).t; return this; }
        public Builder setCategory(String c) { return this; }
        public Builder setPriority(int p) { return this; }
        public Builder setDefaults(int d) { return this; }
        public Builder setContentIntent(PendingIntent p) { return this; }
        public Notification build() { return n; }
    }
}
