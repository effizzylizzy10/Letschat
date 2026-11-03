package android.content;
public class Intent {
    public static final int FLAG_ACTIVITY_NEW_TASK = 268435456, FLAG_ACTIVITY_SINGLE_TOP = 536870912;
    public final java.util.Map<String, String> extras = new java.util.HashMap<String, String>();
    public Intent putExtra(String k, String v) { extras.put(k, v); return this; }
    public Intent addFlags(int f) { return this; }
}
