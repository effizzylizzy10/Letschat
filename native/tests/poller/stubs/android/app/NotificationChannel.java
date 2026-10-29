package android.app;
public class NotificationChannel {
    public final String id;
    public NotificationChannel(String id, CharSequence name, int importance) { this.id = id; }
    public void setDescription(String d) { }
    public void enableVibration(boolean b) { }
    public void enableLights(boolean b) { }
    public void setLockscreenVisibility(int v) { }
}
