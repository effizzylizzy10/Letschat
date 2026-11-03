package android.util;
public final class Log {
    public static final java.util.List<String> LINES = java.util.Collections.synchronizedList(new java.util.ArrayList<String>());
    private static int add(String lvl, String tag, String msg) { LINES.add(lvl + "/" + tag + ": " + msg); return 0; }
    public static int i(String tag, String msg) { return add("I", tag, msg); }
    public static int w(String tag, String msg) { return add("W", tag, msg); }
    public static int e(String tag, String msg) { return add("E", tag, msg); }
}
