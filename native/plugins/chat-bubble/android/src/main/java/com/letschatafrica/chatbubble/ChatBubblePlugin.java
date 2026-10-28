package com.letschatafrica.chatbubble;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

@CapacitorPlugin(
    name = "ChatBubble",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" }),
        @Permission(
            alias = "media",
            strings = {
                "android.permission.READ_MEDIA_IMAGES",
                "android.permission.READ_MEDIA_VIDEO",
                "android.permission.READ_MEDIA_AUDIO",
                "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"
            }
        ),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
        @Permission(alias = "nearby", strings = { "android.permission.BLUETOOTH_CONNECT" })
    }
)
public class ChatBubblePlugin extends Plugin {

    private static final String BRIDGE_ASSET = "letschat-native-bridge.js";
    /** The chat head appears this long after Letschat leaves the screen (a short pause such as a file picker never shows it). */
    private static final long HEAD_DELAY_MS = 700;
    /** Used when the page does not report its server address. */
    private static final String DEFAULT_API = "https://letschat-9tw4.onrender.com";
    /**
     * Reads the sign-in straight out of the page's own storage (no help from the page's scripts needed) and answers it as a small JSON text.
     * An empty answer means nobody is signed in.
     */
    private static final String READ_SESSION_JS =
        "(function(){try{var s=JSON.parse(localStorage.getItem('letschat-africa:session'));"
            + "var t=s&&s.token?String(s.token):'';if(!t)return '';"
            + "var u=(s.user&&(s.user.id||s.user._id))||s.userId||s.id||'';"
            + "var a=(window.LETSCHAT_CONFIG&&window.LETSCHAT_CONFIG.API_URL)||'';"
            + "return JSON.stringify({t:t,a:String(a),u:String(u)});}catch(e){return '';}})()";
    private BubbleController controller;
    private String bridgeJs;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean resumed = false;
    private volatile boolean rendererLost = false;
    private long lastRecover = 0;

    /** Shows the floating chat head (just the Letschat photo, no message) once the app is minimized or closed. */
    private final Runnable showHead = new Runnable() {
        @Override
        public void run() {
            if (resumed || controller == null) return;
            controller.show(0, "", "", "", "");
        }
    };

    /** Hands the page's sign-in to the background checker (see pushSessionFromPage). */
    private final Runnable pushSession = new Runnable() {
        @Override
        public void run() {
            pushSessionFromPage();
        }
    };

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
                        // the page has just loaded: a few seconds later (when it has restored the sign-in) hand it to the checker
                        mainHandler.postDelayed(pushSession, 3000);
                    }

                    /**
                     * Android kills the page's renderer process when the phone is short of memory (very common while the app sits
                     * in the background). Capacitor's default answer is "not handled", which makes Android kill the whole app and
                     * show "Letschat Africa keeps stopping". Answering "handled" keeps the app (and its background service) alive;
                     * the page is then rebuilt, right away when Letschat is on screen, otherwise the next time it is opened.
                     */
                    @Override
                    public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                        rendererLost = true;
                        if (resumed) mainHandler.post(ChatBubblePlugin.this::recoverPage);
                        return true;
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

    /**
     * "Letschat check: not running (no sign-in received yet)" fix. The checker that finds new messages while the app is minimised can
     * only run when it has the sign-in token. Until now the page's own script had to pass it over, and when that script did not run (or
     * ran before the sign-in was saved) the checker never started. Here the app itself asks the page for the saved sign-in and
     * hands it to the checker, so it starts whenever a person is signed in: after the page loads, when Letschat is opened again,
     * and the moment it is minimised. Nothing happens when nobody is signed in.
     */
    private void pushSessionFromPage() {
        try {
            if (getBridge() == null) return;
            final WebView wv = getBridge().getWebView();
            if (wv == null) return;
            wv.evaluateJavascript(READ_SESSION_JS, value -> {
                try {
                    if (value == null || value.equals("null")) return;
                    Object o = new JSONTokener(value).nextValue(); // the answer arrives as a quoted text
                    if (!(o instanceof String)) return;
                    String text = (String) o;
                    if (text.isEmpty()) return; // nobody is signed in
                    JSONObject j = new JSONObject(text);
                    String token = j.optString("t", "");
                    if (token.isEmpty()) return;
                    String api = j.optString("a", "");
                    if (api.isEmpty()) api = DEFAULT_API;
                    MessagePoller.setSession(getContext(), token, api, j.optString("u", ""));
                } catch (Throwable ignored) {}
            });
        } catch (Throwable ignored) {}
    }

    /** Rebuilds the page after its renderer process was lost (the old WebView can no longer be used). */
    private void recoverPage() {
        if (!rendererLost) return;
        long now = System.currentTimeMillis();
        if (now - lastRecover < 3000) return; // never loop
        Activity a = getActivity();
        if (a == null || a.isFinishing()) return;
        lastRecover = now;
        rendererLost = false;
        try {
            a.recreate();
        } catch (Throwable ignored) {}
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        resumed = false;
        pushSessionFromPage(); // the page is still alive right now: make sure the checker has the sign-in before it is needed
        MessagePoller.setForeground(false);
        // minimized or closed: put the chat head on screen by itself (nothing to switch on)
        mainHandler.removeCallbacks(showHead);
        mainHandler.postDelayed(showHead, HEAD_DELAY_MS);
        JSObject data = new JSObject();
        data.put("active", false);
        notifyListeners("appState", data);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        resumed = true;
        mainHandler.removeCallbacks(showHead);
        MessagePoller.setForeground(true);
        if (rendererLost) mainHandler.post(this::recoverPage);
        controller.hide(); // the bubble and the message pop-up are only for when Letschat is not on screen
        // the person is looking at Letschat (signed in or just signed in): hand the sign-in to the checker
        mainHandler.removeCallbacks(pushSession);
        mainHandler.postDelayed(pushSession, 1500);
        mainHandler.postDelayed(pushSession, 8000);
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

    // ------------------------------------------------------------------------------------------------------------------
    // One-time "allow all permissions" setup (driven by letschat-native-bridge.js, see runPermissionSetup there)
    // ------------------------------------------------------------------------------------------------------------------

    private boolean has(String permission) {
        return getContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean ignoringBatteryOptimizations() {
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        } catch (Throwable t) {
            return false;
        }
    }

    /** The permission groups (aliases above) that still need to be allowed on this phone's Android version. */
    private List<String> missingAliases() {
        List<String> a = new ArrayList<>();
        int sdk = Build.VERSION.SDK_INT;
        if (!has(Manifest.permission.CAMERA)) a.add("camera");
        if (!has(Manifest.permission.RECORD_AUDIO)) a.add("microphone");
        if (!has(Manifest.permission.ACCESS_FINE_LOCATION) && !has(Manifest.permission.ACCESS_COARSE_LOCATION)) a.add("location");
        if (sdk >= 33) {
            if (!has("android.permission.POST_NOTIFICATIONS")) a.add("notifications");
            boolean visualOk =
                (has("android.permission.READ_MEDIA_IMAGES") && has("android.permission.READ_MEDIA_VIDEO"))
                    || (sdk >= 34 && has("android.permission.READ_MEDIA_VISUAL_USER_SELECTED")); // "select photos" choice
            if (!(visualOk && has("android.permission.READ_MEDIA_AUDIO"))) a.add("media");
        } else if (!has(Manifest.permission.READ_EXTERNAL_STORAGE)) {
            a.add("storage");
        }
        if (sdk >= 31 && !has("android.permission.BLUETOOTH_CONNECT")) a.add("nearby");
        return a;
    }

    private JSObject permissionStatus() {
        List<String> missing = missingAliases();
        boolean overlay = Settings.canDrawOverlays(getContext());
        boolean battery = ignoringBatteryOptimizations();
        JSONArray list = new JSONArray();
        for (String m : missing) list.put(m);
        JSObject ret = new JSObject();
        ret.put("runtimeGranted", missing.isEmpty());
        ret.put("missing", list);
        ret.put("overlay", overlay);
        ret.put("battery", battery);
        ret.put("allGranted", missing.isEmpty() && overlay && battery);
        return ret;
    }

    /** Which of everything Letschat needs is already allowed: camera, microphone, location, notifications, photos, nearby devices, overlay, battery. */
    @PluginMethod
    public void checkAllPermissions(PluginCall call) {
        call.resolve(permissionStatus());
    }

    /** Asks for every missing runtime permission in one go (Android shows its allow dialogs one after another, nothing else to tap in between). */
    @PluginMethod
    public void requestRuntimePermissions(PluginCall call) {
        List<String> missing = missingAliases();
        if (missing.isEmpty()) {
            call.resolve(permissionStatus());
            return;
        }
        requestPermissionForAliases(missing.toArray(new String[0]), call, "runtimePermissionsDone");
    }

    @PermissionCallback
    private void runtimePermissionsDone(PluginCall call) {
        call.resolve(permissionStatus());
    }

    /**
     * Opens the phone's own "App permissions" page for Letschat (Settings > Apps > Letschat > Permissions) so anything still switched off
     * can be turned on there. Some phones open the permission list directly, the others open the app info page where "Permissions" is one tap.
     */
    @PluginMethod
    public void openAppPermissionSettings(PluginCall call) {
        Context ctx = getContext();
        String pkg = ctx.getPackageName();
        try {
            Intent i = new Intent("android.intent.action.MANAGE_APP_PERMISSIONS");
            i.putExtra("android.intent.extra.PACKAGE_NAME", pkg);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.resolve();
            return;
        } catch (Throwable ignored) {
            // this phone has no direct permission list: fall back to the app info page
        }
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the app permission settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (!Settings.canDrawOverlays(getContext())) {
            call.reject("Overlay permission not granted");
            return;
        }
        MessagePoller.noteSocketShow();
        // the WhatsApp-style message pop-up (the chat head itself comes up by itself when the app is minimized or closed)
        MessagePopup.notifyMessage(
            getContext(),
            new MessagePopup.Item(
                call.getString("messageId", ""),
                call.getString("chatId", ""),
                call.getString("title", ""),
                call.getString("avatar", ""),
                call.getString("text", ""),
                call.getString("replyName", ""),
                call.getString("replyText", "")
            )
        );
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
