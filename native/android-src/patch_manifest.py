import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()

PERMISSIONS = [
    "INTERNET",
    "CAMERA",
    "RECORD_AUDIO",
    "MODIFY_AUDIO_SETTINGS",
    "POST_NOTIFICATIONS",
    "ACCESS_FINE_LOCATION",
    "ACCESS_COARSE_LOCATION",
    "VIBRATE",
    "WAKE_LOCK",
    "RECEIVE_BOOT_COMPLETED",
    "FOREGROUND_SERVICE",
    "FOREGROUND_SERVICE_REMOTE_MESSAGING",
    "SYSTEM_ALERT_WINDOW",
    "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
]

add = ""
for p in PERMISSIONS:
    if "android.permission." + p not in s:
        add += '    <uses-permission android:name="android.permission.%s" />\n' % p
if add:
    assert "</manifest>" in s, "no </manifest> in AndroidManifest.xml"
    s = s.replace("</manifest>", add + "</manifest>", 1)

# Open email sign-in links (Firebase) and links to the website inside the app
FILTERS = """
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="letschatafrica-1df0c.firebaseapp.com" android:pathPrefix="/__/auth/" />
            </intent-filter>
            <intent-filter>
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
