package com.letschatafrica.backgroundservice;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "BackgroundService",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class BackgroundServicePlugin extends Plugin {

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

    private boolean ignoring() {
        Context ctx = getContext();
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }
}
