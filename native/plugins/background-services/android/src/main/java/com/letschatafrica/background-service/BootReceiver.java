package com.letschatafrica.backgroundservice;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** Starts the background service again after a reboot or after Letschat is updated, if the person is signed in. */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) return;
        boolean wanted =
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action);
        if (!wanted) return;
        boolean enabled = context.getSharedPreferences(LetschatBackgroundService.PREFS, Context.MODE_PRIVATE).getBoolean("enabled", false);
        if (!enabled) return;
        try {
            ContextCompat.startForegroundService(context, new Intent(context, LetschatBackgroundService.class));
        } catch (Exception ignored) {
            // some phones block this until the app is opened once
        }
    }
}
