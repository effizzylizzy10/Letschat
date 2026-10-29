package android.app;
import java.util.*;
public class NotificationManager {
    public static final int IMPORTANCE_HIGH = 4;
    /** The person can switch notifications off for Letschat in the phone's settings. */
    public static volatile boolean ENABLED = true;
    public final Map<String, NotificationChannel> channels = new HashMap<String, NotificationChannel>();
    public final List<Notification> posted = Collections.synchronizedList(new ArrayList<Notification>());
    public final List<Integer> cancelled = Collections.synchronizedList(new ArrayList<Integer>());
    public NotificationChannel getNotificationChannel(String id) { return channels.get(id); }
    public void createNotificationChannel(NotificationChannel c) { channels.put(c.id, c); }
    public boolean areNotificationsEnabled() { return ENABLED; }
    public void notify(int id, Notification n) { posted.add(n); }
    public void cancel(int id) { cancelled.add(id); }
}
