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
if add:
    assert "</manifest>" in s, "no </manifest> in AndroidManifest.xml"
    s = s.replace("</manifest>", add + "</manifest>", 1)

# Open email sign-in links (Firebase) and links to the website inside the app.
# autoVerify="true" makes Android check https://letschat-taupe.vercel.app/.well-known/assetlinks.json at install time,
# so Letschat links open straight in the app (verified App Links) instead of asking or opening Chrome.
FILTERS = """
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="letschatafrica-1df0c.firebaseapp.com" android:pathPrefix="/__/auth/" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="letschat-taupe.vercel.app" />
            </intent-filter>
"""
if "letschatafrica-1df0c.firebaseapp.com" not in s:
    assert "</activity>" in s, "no </activity> in AndroidManifest.xml"
    s = s.replace("</activity>", FILTERS + "        </activity>", 1)

if 'android:launchMode="singleTask"' not in s:
    print("WARNING: MainActivity is not singleTask; the chat bubble may open a second copy of the app")

open(path, "w", encoding="utf-8").write(s)
print("AndroidManifest.xml patched")
