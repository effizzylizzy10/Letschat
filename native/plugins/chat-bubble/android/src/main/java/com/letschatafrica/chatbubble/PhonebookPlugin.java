package com.letschatafrica.chatbubble;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.ContactsContract;
import android.webkit.WebView;
import com.getcapacitor.JSArray;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Phonebook for the Letschat website inside the app. Android's WebView has no Contact Picker (navigator.contacts.select), so
 * the website's "Find friends from my phonebook" button could never read a contact. This plugin:
 *  1. injects letschat-phonebook.js (adds navigator.contacts and window.ContactsManager) into every page the app loads,
 *  2. asks for the Contacts permission when the button is tapped (readContacts) and reads names and phone numbers only.
 * The chooser itself (search, tick contacts, Back button) is drawn by the script in the page.
 * A refused permission never crashes anything: the answer is just granted=false.
 */
@CapacitorPlugin(
    name = "Phonebook",
    permissions = { @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS }) }
)
public class PhonebookPlugin extends Plugin {

    private static final String ASSET = "letschat-phonebook.js";
    private static final String PREFS = "letschat_phonebook";
    private static final String ASKED = "asked";
    private String script;

    @Override
    public void load() {
        try {
            getBridge().addWebViewListener(
                new WebViewListener() {
                    @Override
                    public void onPageLoaded(WebView webView) {
                        inject(webView);
                    }
                }
            );
        } catch (Throwable ignored) {
            // the website can still call the plugin itself
        }
    }

    private void inject(WebView webView) {
        try {
            if (script == null) {
                try (InputStream in = getContext().getAssets().open(ASSET); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    script = new String(out.toByteArray(), StandardCharsets.UTF_8);
                }
            }
            webView.evaluateJavascript(script, null);
        } catch (Throwable ignored) {}
    }

    private boolean allowed() {
        return getContext().checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** True when Android will still show its allow dialog (or has never been asked). */
    private boolean canStillAsk() {
        try {
            Activity a = getActivity();
            return a == null || a.shouldShowRequestPermissionRationale(Manifest.permission.READ_CONTACTS);
        } catch (Throwable t) {
            return true;
        }
    }

    private void answerDenied(PluginCall call, boolean blocked) {
        JSObject ret = new JSObject();
        ret.put("granted", false);
        ret.put("blocked", blocked);
        ret.put("contacts", new JSArray());
        call.resolve(ret);
    }

    /**
     * Answers {granted, blocked, contacts:[{name, tel:[..]}]}.
     * blocked=true means Android will not show its allow dialog any more (refused for good): the page may then offer the app settings.
     * Refusing the dialog itself answers granted=false, blocked=false.
     */
    @PluginMethod
    public void readContacts(PluginCall call) {
        if (allowed()) {
            loadContacts(call);
            return;
        }
        boolean asked = prefs().getBoolean(ASKED, false);
        if (asked && !canStillAsk()) {
            answerDenied(call, true);
            return;
        }
        prefs().edit().putBoolean(ASKED, true).apply();
        requestPermissionForAlias("contacts", call, "contactsPermissionDone");
    }

    @PermissionCallback
    private void contactsPermissionDone(PluginCall call) {
        if (allowed()) {
            loadContacts(call);
            return;
        }
        answerDenied(call, false);
    }

    private static final class Entry {
        String name = "";
        final ArrayList<String> tel = new ArrayList<>();
        final HashSet<String> seen = new HashSet<>();
    }

    private void loadContacts(final PluginCall call) {
        new Thread(() -> {
            Cursor c = null;
            try {
                Map<Long, Entry> map = new LinkedHashMap<>();
                c = getContext().getContentResolver().query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    new String[] {
                        ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                        ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                        ContactsContract.CommonDataKinds.Phone.NUMBER
                    },
                    null,
                    null,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " COLLATE NOCASE ASC"
                );
                if (c != null) {
                    while (c.moveToNext()) {
                        long id = c.getLong(0);
                        String name = c.getString(1);
                        String number = c.getString(2);
                        if (number == null) continue;
                        number = number.trim();
                        if (number.isEmpty()) continue;
                        Entry e = map.get(id);
                        if (e == null) {
                            e = new Entry();
                            map.put(id, e);
                        }
                        if (e.name.isEmpty() && name != null) e.name = name.trim();
                        String key = number.replaceAll("[^0-9]", "");
                        if (key.isEmpty()) key = number;
                        if (e.seen.add(key)) e.tel.add(number);
                    }
                }
                JSArray list = new JSArray();
                for (Entry e : map.values()) {
                    if (e.tel.isEmpty()) continue;
                    JSObject o = new JSObject();
                    o.put("name", e.name);
                    JSArray tels = new JSArray();
                    for (String t : e.tel) tels.put(t);
                    o.put("tel", tels);
                    list.put(o);
                }
                JSObject ret = new JSObject();
                ret.put("granted", true);
                ret.put("blocked", false);
                ret.put("contacts", list);
                call.resolve(ret);
            } catch (Throwable t) {
                call.reject("Could not read the contacts: " + t.getMessage());
            } finally {
                try {
                    if (c != null) c.close();
                } catch (Throwable ignored) {}
            }
        }).start();
    }
}
