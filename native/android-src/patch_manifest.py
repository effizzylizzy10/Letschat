import re
import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()

PERMISSIONS = [
    # network
    "INTERNET",
    "ACCESS_NETWORK_STATE",
    "ACCESS_WIFI_STATE",
    # calls, voice notes, video, status camera
    "CAMERA",
    "RECORD_AUDIO",
    "MODIFY_AUDIO_SETTINGS",
    "BLUETOOTH_CONNECT",          # route call audio to a Bluetooth headset (Android 12+)
    # photos, videos and audio the person attaches or saves
    "READ_MEDIA_IMAGES",
    "READ_MEDIA_VIDEO",
    "READ_MEDIA_AUDIO",
    "READ_MEDIA_VISUAL_USER_SELECTED",   # "select photos" choice on Android 14+
    ("READ_EXTERNAL_STORAGE", 32),        # older Android versions only
    ("WRITE_EXTERNAL_STORAGE", 28),       # saving files on Android 9 and older
    # phonebook: finding which of the person's contacts are on Letschat
    "READ_CONTACTS",
    # notifications, location sharing, haptics
    "POST_NOTIFICATIONS",
    "ACCESS_FINE_LOCATION",
    "ACCESS_COARSE_LOCATION",
    "VIBRATE",
    # staying connected in the background
    "WAKE_LOCK",
    "RECEIVE_BOOT_COMPLETED",
    "FOREGROUND_SERVICE",
    "FOREGROUND_SERVICE_REMOTE_MESSAGING",
    "SYSTEM_ALERT_WINDOW",
    "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
]

# Hardware the app can use but does not need: without these lines Google Play hides the app from phones/tablets lacking it
FEATURES = ["android.hardware.camera", "android.hardware.camera.autofocus", "android.hardware.microphone",
            "android.hardware.location", "android.hardware.location.gps", "android.hardware.bluetooth",
            "android.hardware.touchscreen"]

add = ""
for p in PERMISSIONS:
    name, max_sdk = (p, None) if isinstance(p, str) else p
    if 'android.permission.%s"' % name not in s:
        extra = ' android:maxSdkVersion="%d"' % max_sdk if max_sdk else ""
        add += '    <uses-permission android:name="android.permission.%s"%s />\n' % (name, extra)
for f in FEATURES:
    if 'android:name="%s"' % f not in s:
        add += '    <uses-feature android:name="%s" android:required="false" />\n' % f

# Android 11+ hides other apps from an app unless it asks. Letschat hands links to the phone's browsers (Custom Tabs, "Open with"),
# so it asks to see the apps that can open a web link.
if "<queries>" not in s:
    add += """    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="http" />
        </intent>
    </queries>
"""

if add:
    assert "</manifest>" in s, "no </manifest> in AndroidManifest.xml"
    s = s.replace("</manifest>", add + "</manifest>", 1)

# Links that open in the app:
# 1. email sign-in links (Firebase): https://letschatafrica-1df0c.firebaseapp.com/__/auth/action (and /__/auth/links).
#    VERIFIED (autoVerify="true"). Android 12 and newer hands a web link to an app only when the app is verified for that website;
#    an unverified link goes to the default browser instead. That is why the sign-in email opened Chrome and not Letschat on those
#    phones, and Chrome could not always reach firebaseapp.com (ERR_CONNECTION_REFUSED). If Android cannot verify the website, the
#    filter simply stays unverified and the link opens in the browser as before, so this cannot make anything worse.
#    Only the two email-link paths are claimed: /__/auth/handler (the Google sign-in pop-up) has to stay in the browser.
#    client/linkhelp.js is the fallback for phones where the link still does not open (the person pastes the link into Letschat).
# 2. links to Letschat's own site (not verified, so the "Open with" list can be offered for them)
# 3. ANY web link (http/https, any site, e.g. storybookcreator.netlify.app): Letschat shows up in Android's "Open with" list next to
#    Chrome, Firefox, Opera and the other browsers, and the person picks. This one is not verified on purpose: a verified
#    link would open straight in the app and skip the list. (Android 12+ only offers an app for websites it is verified for,
#    so on those phones this filter has no effect.) The page script in client/index.html opens Letschat pages inside the app
#    and every other site in an in-app browser tab, and ignores anything it cannot read, so a link can never close the app.
FIREBASE_FILTER = """
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="letschatafrica-1df0c.firebaseapp.com" android:pathPrefix="/__/auth/action" />
                <data android:scheme="https" android:host="letschatafrica-1df0c.firebaseapp.com" android:pathPrefix="/__/auth/links" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="letschat-taupe.vercel.app" />
            </intent-filter>
"""
OPEN_ALL_FILTER = """
            <!-- letschat-open-all-links -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="http" />
                <data android:scheme="https" />
            </intent-filter>
"""

FIREBASE_HOST = "letschatafrica-1df0c.firebaseapp.com"
SITE_HOST = "letschat-taupe.vercel.app"


def set_auto_verify(text, host, on):
    """Switch android:autoVerify on or off for the intent-filter that holds this host. The filter is found by its host name, so a manifest
    that an older version of this script already patched (with the other setting) ends up right as well."""
    for m in re.finditer(r"<intent-filter\b([^>]*)>(.*?)</intent-filter>", text, re.S):
        if 'android:host="%s"' % host not in m.group(2):
            continue
        attrs = re.sub(r'\s*android:autoVerify="[^"]*"', "", m.group(1))
        if on:
            attrs += ' android:autoVerify="true"'
        return text[:m.start()] + "<intent-filter%s>%s</intent-filter>" % (attrs, m.group(2)) + text[m.end():]
    return text


new_filters = ""
if FIREBASE_HOST not in s:
    new_filters += FIREBASE_FILTER
if "letschat-open-all-links" not in s:
    new_filters += OPEN_ALL_FILTER
if new_filters:
    assert "</activity>" in s, "no </activity> in AndroidManifest.xml"
    s = s.replace("</activity>", new_filters + "        </activity>", 1)

# the sign-in email link: verified (opens in the app on Android 12+); Letschat's own website: not verified (see the notes above)
s = set_auto_verify(s, FIREBASE_HOST, True)
s = set_auto_verify(s, SITE_HOST, False)

if 'android:launchMode="singleTask"' not in s:
    print("WARNING: MainActivity is not singleTask; the chat bubble may open a second copy of the app")

open(path, "w", encoding="utf-8").write(s)
print("AndroidManifest.xml patched")
