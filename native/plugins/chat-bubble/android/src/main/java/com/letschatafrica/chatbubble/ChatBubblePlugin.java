package com.letschatafrica.chatbubble;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "ChatBubble")
public class ChatBubblePlugin extends Plugin {

    private static final String BRIDGE_ASSET = "letschat-native-bridge.js";
    private BubbleController controller;
    private String bridgeJs;

    @Override
    public void load() {
        controller = BubbleController.get(getContext());
        MessagePoller.ensureRunning(getContext()); // the sign-in token from last time may already be stored
        controller.setListener(chatId -> {
            JSObject data = new JSObject();
            data.put("chatId", chatId == null ? "" : chatId);
            notifyListeners("bubbleTapped", data, true);
        });
        // Add the native glue script (starts the service after login, shows the bubble) to every page the app loads.
        try {
            getBridge().addWebViewListener(
                new WebViewListener() {
                    @Override
                    public void onPageLoaded(WebView webView) {
                        injectBridge(webView);
                    }
                }
            );
        } catch (Throwable ignored) {
            // the bubble still works when the website calls the plugin itself
        }
    }

    private void injectBridge(WebView webView) {
        try {
            if (bridgeJs == null) {
                try (InputStream in = getContext().getAssets().open(BRIDGE_ASSET); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    bridgeJs = new String(out.toByteArray(), StandardCharsets.UTF_8);
                }
            }
            webView.evaluateJavascript(bridgeJs, null);
        } catch (Exception ignored) {}
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        MessagePoller.setForeground(false);
        JSObject data = new JSObject();
        data.put("active", false);
        notifyListeners("appState", data);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        MessagePoller.setForeground(true);
        controller.hide(); // the bubble is only for when Letschat is not on screen
        JSObject data = new JSObject();
        data.put("active", true);
        notifyListeners("appState", data);
    }

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", Settings.canDrawOverlays(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Context ctx = getContext();
        if (!Settings.canDrawOverlays(ctx)) {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } catch (Exception e) {
                call.reject("Could not open the overlay settings: " + e.getMessage());
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", Settings.canDrawOverlays(ctx));
        call.resolve(ret);
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (!Settings.canDrawOverlays(getContext())) {
            call.reject("Overlay permission not granted");
            return;
        }
        MessagePoller.noteSocketShow();
        controller.show(call.getInt("count", 0), call.getString("title", ""), call.getString("text", ""), call.getString("chatId", ""), call.getString("avatar", ""));
        call.resolve();
    }

    /** The in-app setting "Floating chat bubble": turns the bubble on or off (on by default). */
    @PluginMethod
    public void setEnabled(PluginCall call) {
        controller.setEnabled(Boolean.TRUE.equals(call.getBoolean("enabled", true)));
        call.resolve();
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", controller.isEnabled());
        call.resolve(ret);
    }

    /** The page hands over the sign-in so new messages can be found while the app is closed. An empty token (sign-out) stops it. */
    @PluginMethod
    public void setSession(PluginCall call) {
        MessagePoller.setSession(getContext(), call.getString("token", ""), call.getString("apiUrl", ""), call.getString("userId", ""));
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        controller.hide();
        call.resolve();
    }
}
