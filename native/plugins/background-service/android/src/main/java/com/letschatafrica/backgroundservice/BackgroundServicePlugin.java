package com.letschatafrica.backgroundservice;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(
    name = "BackgroundService",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class BackgroundServicePlugin extends Plugin {

    static final String MESSAGE_CHANNEL = "letschat_messages";
    private static final Set<Integer> shown = ConcurrentHashMap.newKeySet();

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationsCallback");
            return;
        }
        startNow(call);
    }

    // The service also works when notifications are refused (Android just hides the "Connected" notification).
    @PermissionCallback
    private void notificationsCallback(PluginCall call) {
        startNow(call);
    }

    private void startNow(PluginCall call) {
        Context ctx = getContext();
        try {
            SharedPreferences.Editor ed = ctx.getSharedPreferences(LetschatBackgroundService.PREFS, Context.MODE_PRIVATE).edit();
            ed.putBoolean("enabled", true);
            if (call.getString("title") != null) ed.putString("title", call.getString("title"));
            if (call.getString("text") != null) ed.putString("text", call.getString("text"));
            ed.apply();
            ContextCompat.startForegroundService(ctx, new Intent(ctx, LetschatBackgroundService.class));
            JSObject ret = new JSObject();
            ret.put("running", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not start the background service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(LetschatBackgroundService.PREFS, Context.MODE_PRIVATE).edit().putBoolean("enabled", false).apply();
        ctx.stopService(new Intent(ctx, LetschatBackgroundService.class));
        JSObject ret = new JSObject();
        ret.put("running", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", LetschatBackgroundService.running);
        call.resolve(ret);
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context ctx = getContext();
        if (!ignoring()) {
            try {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } catch (Exception e) {
                call.reject("Could not open the battery settings: " + e.getMessage());
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring());
        call.resolve(ret);
    }

    // ---- Tecno / Infinix / itel (Transsion: HiOS, XOS) close background apps unless they are allowed in "Auto-start" (Phone Master) ----

    private static boolean isTranssion() {
        String m = (Build.MANUFACTURER == null ? "" : Build.MANUFACTURER).trim().toLowerCase(Locale.ROOT);
        String b = (Build.BRAND == null ? "" : Build.BRAND).trim().toLowerCase(Locale.ROOT);
        String[] names = { "tecno", "infinix", "itel" };
        for (String n : names) {
            if (m.equals(n) || b.equals(n)) return true;
        }
        return m.contains("transsion") || b.contains("transsion");
    }

    @PluginMethod
    public void getOemInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        ret.put("brand", Build.BRAND == null ? "" : Build.BRAND);
        ret.put("transsion", isTranssion());
        call.resolve(ret);
    }

    // Opens the phone maker's Auto-start screen when this phone has it; otherwise this app's own settings page (Battery / App launch live there).
    // Every attempt is wrapped: a screen that does not exist on this firmware just moves on to the next choice and never crashes the app.
    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        String[][] targets = isTranssion()
            ? new String[][] { { "com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity" } }
            : new String[][] {};
        for (String[] t : targets) {
            try {
                Intent i = new Intent();
                i.setComponent(new ComponentName(t[0], t[1]));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                ret.put("opened", "autostart");
                call.resolve(ret);
                return;
            } catch (Exception ignored) {
                // not on this firmware version: try the next choice
            }
        }
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            ret.put("opened", "app-settings");
        } catch (Exception e) {
            ret.put("opened", "none");
        }
        call.resolve(ret);
    }

    // ---- Message alerts (with sound), shown by the phone itself so they work when the app is closed or in the background ----

    private boolean notificationsAllowed() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    private String refusedState() {
        if (Build.VERSION.SDK_INT >= 33) {
            PermissionState st = getPermissionState("notifications");
            if (st == PermissionState.PROMPT || st == PermissionState.PROMPT_WITH_RATIONALE) return "prompt";
        }
        return "denied";
    }

    private void resolveNotificationState(PluginCall call) {
        boolean on = notificationsAllowed();
        JSObject ret = new JSObject();
        ret.put("enabled", on);
        ret.put("state", on ? "granted" : refusedState());
        call.resolve(ret);
    }

    @PluginMethod
    public void areNotificationsEnabled(PluginCall call) {
        resolveNotificationState(call);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (notificationsAllowed()) {
            resolveNotificationState(call);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.DENIED) {
            requestPermissionForAlias("notifications", call, "messagePermissionCallback");
            return;
        }
        // already refused (or switched off in Android settings): open this app's notification settings
        try {
            Context ctx = getContext();
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception ignored) {}
        resolveNotificationState(call);
    }

    @PermissionCallback
    private void messagePermissionCallback(PluginCall call) {
        resolveNotificationState(call);
    }

    private void ensureMessageChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(MESSAGE_CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(MESSAGE_CHANNEL, "Letschat messages", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("New message alerts");
        ch.enableVibration(true);
        ch.setShowBadge(true);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), attrs);
        nm.createNotificationChannel(ch);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void showMessage(PluginCall call) {
        Context ctx = getContext();
        if (!notificationsAllowed()) {
            call.reject("Notifications are not allowed for Letschat on this phone.");
            return;
        }
        try {
            String title = call.getString("title", "Letschat Africa");
            String body = call.getString("body", "New message");
            String tag = call.getString("tag", "");
            ensureMessageChannel(ctx);
            Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            PendingIntent pi = null;
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                pi = PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            }
            int icon = ctx.getResources().getIdentifier("ic_stat_letschat", "drawable", ctx.getPackageName());
            if (icon == 0) icon = android.R.drawable.stat_notify_chat;
            int id = 5000 + Math.abs(tag.hashCode() % 50000); // same chat = same notification (it updates instead of piling up)
            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, MESSAGE_CHANNEL)
                .setSmallIcon(icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pi);
            NotificationManagerCompat.from(ctx).notify(id, b.build());
            shown.add(id);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not show the alert: " + e.getMessage());
        }
    }

    private void cancelShown() {
        try {
            NotificationManagerCompat nm = NotificationManagerCompat.from(getContext());
            for (Integer id : shown) nm.cancel(id);
            shown.clear();
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void clearMessages(PluginCall call) {
        cancelShown();
        call.resolve();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        cancelShown(); // the person is back in the app: old alerts are no longer needed
    }

    private boolean ignoring() {
        Context ctx = getContext();
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }
}
