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
        JSObject data = new JSObject();
        data.put("active", false);
        notifyListeners("appState", data);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
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
        controller.show(call.getInt("count", 0), call.getString("title", ""), call.getString("text", ""), call.getString("chatId", ""));
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        controller.hide();
        call.resolve();
    }
}
