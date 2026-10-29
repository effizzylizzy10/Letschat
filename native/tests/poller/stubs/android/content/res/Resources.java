package android.content.res;
public class Resources { public static volatile int STAT_ICON = 0; public int getIdentifier(String name, String type, String pkg) { return "ic_stat_letschat".equals(name) ? STAT_ICON : 0; } }
