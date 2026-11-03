package android.content;
import java.util.*;
public class Context {
    public static final int MODE_PRIVATE = 0;
    public static final String NOTIFICATION_SERVICE = "notification";
    public final Map<String, String> store = Collections.synchronizedMap(new HashMap<String, String>());
    public final android.app.NotificationManager nm = new android.app.NotificationManager();
    public Context getApplicationContext() { return this; }
    public Object getSystemService(String name) { return NOTIFICATION_SERVICE.equals(name) ? nm : null; }
    public android.content.pm.PackageManager getPackageManager() { return new android.content.pm.PackageManager(); }
    public String getPackageName() { return "com.letschatafrica.app"; }
    public android.content.res.Resources getResources() { return new android.content.res.Resources(); }
    public SharedPreferences getSharedPreferences(String name, int mode) {
        final Map<String, String> m = store;
        return new SharedPreferences() {
            public String getString(String k, String d) { String v = m.get(k); return v == null ? d : v; }
            public boolean getBoolean(String k, boolean d) { String v = m.get(k); return v == null ? d : Boolean.parseBoolean(v); }
            public Editor edit() {
                return new Editor() {
                    public Editor putString(String k, String v) { m.put(k, v); return this; }
                    public Editor putBoolean(String k, boolean v) { m.put(k, String.valueOf(v)); return this; }
                    public Editor remove(String k) { m.remove(k); return this; }
                    public void apply() { }
                };
            }
        };
    }
}
