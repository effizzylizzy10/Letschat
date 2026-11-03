package android.provider;
public class Settings { public static volatile boolean OVERLAY = true; public static boolean canDrawOverlays(android.content.Context c) { return OVERLAY; } }
