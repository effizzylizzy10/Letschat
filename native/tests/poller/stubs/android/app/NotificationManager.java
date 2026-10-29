package android.app;
import java.util.*;
public class NotificationManager {
    public static final int IMPORTANCE_HIGH = 4;
    public final Map<String, NotificationChannel> channels = new HashMap<String, NotificationChannel>();
    public final List<Notification> posted = Collections.synchronizedList(new ArrayList<Notification>());
    public NotificationChannel getNotificationChannel(String id) { return channels.get(id); }
    public void createNotificationChannel(NotificationChannel c) { channels.put(c.id, c); }
    public void notify(int id, Notification n) { posted.add(n); }
}
