#!/usr/bin/env bash
# Installs and smoke-tests an APK on the Android emulator that is already running.
# Called by .github/workflows/test-apk-android-8-16.yml:
#   bash tools/emulator-smoke-test.sh <apk file> <api level> <Android version name>
#
# What it does, in order (a FAIL turns the run red, a WARN is only a note):
#   1. installs the APK
#   2. opens it after a fresh install (no permissions given) and checks that it stays open
#   3. gives the permissions and "Display over other apps", presses Home (the chat head is drawn) and checks that it survives
#   4. opens it again from the background and presses Back
#   5. force-stops it and starts it cold
#   6. best effort: starts the background service as a foreground service (needs a rooted test emulator, which these are)
# It never signs in, so it cannot tell whether messages, calls or alerts work. That needs a real phone.
# Screenshots and logs go to emulator-results/android-<version>/ and the workflow uploads them.

APK="${1:-}"
API="${2:-?}"
NAME="${3:-$API}"
PKG="com.letschatafrica.app"
SVC="com.letschatafrica.backgroundservice.LetschatBackgroundService"
DIR="${GITHUB_WORKSPACE:-$PWD}/emulator-results/android-${NAME}"
STEPS="$DIR/steps.txt"
WARNINGS=0
ANR_SEEN=0
WEBVIEW=""
mkdir -p "$DIR"

say()  { printf '%s\n' "$*" | tee -a "$STEPS"; }
shot() { adb exec-out screencap -p > "$DIR/$1.png" 2>/dev/null || true; }

# one block per Android version on the run page
summary() {  # $1 = PASS or FAIL, $2 = one line
  {
    echo "### Android ${NAME} (API ${API}): $1"
    echo "- $2"
    if [ -n "$WEBVIEW" ]; then echo "- WebView on this emulator: \`$WEBVIEW\`"; fi
    echo "- Warnings: $WARNINGS"
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  say "WARN: $*"
  echo "::warning title=Android ${NAME}::$*"
}

fail() {
  say "FAIL: $*"
  echo "::error title=Android ${NAME} (API ${API})::$*"
  adb logcat -d -v threadtime > "$DIR/logcat.txt" 2>&1 || true
  shot "fail"
  summary "FAIL" "$*"
  exit 1
}

alive() {
  local p
  p=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')
  if [ -n "$p" ]; then return 0; fi
  adb shell ps -A 2>/dev/null | tr -d '\r' | grep -q " ${PKG}\$"
}

# crash = FAIL. "Not responding" is only a WARN because a free CI emulator is slow.
check_crash() {  # $1 = where we are
  adb logcat -d -v threadtime > "$DIR/logcat.txt" 2>&1 || true
  if grep -Fq "Process: ${PKG}, PID" "$DIR/logcat.txt"; then
    fail "$1: the app crashed (open logcat.txt in the results and search for FATAL EXCEPTION)"
  fi
  if grep -Fq ">>> ${PKG} <<<" "$DIR/logcat.txt"; then
    fail "$1: the app crashed in native code (open logcat.txt in the results)"
  fi
  if [ "$ANR_SEEN" = 0 ] && grep -Fq "ANR in ${PKG}" "$DIR/logcat.txt"; then
    ANR_SEEN=1
    warn "$1: Android reported the app as not responding (a slow emulator or a real freeze; see logcat.txt)"
  fi
  return 0
}

in_front() {  # $1 = where we are
  local f
  f=$(adb shell dumpsys window 2>/dev/null | tr -d '\r' | grep -E "mCurrentFocus|mFocusedApp" | head -n 2)
  printf '%s\n' "$f" >> "$STEPS"
  if ! printf '%s' "$f" | grep -Fq "$PKG"; then
    warn "$1: the Letschat window was not in front (look at the screenshot: a permission box or another window may be on top)"
  fi
}

open_app() {
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > "$DIR/monkey.txt" 2>&1
  if grep -q "No activities found" "$DIR/monkey.txt"; then
    fail "Android found no launcher screen in the app, so there is nothing to open"
  fi
}

[ -s "$APK" ] || fail "APK not found: $APK"
adb wait-for-device
say "Phone: Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r')), $(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
WEBVIEW=$(adb shell dumpsys webviewupdate 2>/dev/null | tr -d '\r' | grep -i "current webview package" | head -n 1 | sed -E 's/^[^:]*: *//')
say "WebView: ${WEBVIEW:-unknown}"

adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
adb shell input keyevent 82 >/dev/null 2>&1 || true
adb shell settings put global verifier_verify_adb_installs 0 >/dev/null 2>&1 || true
adb shell settings put global package_verifier_enable 0 >/dev/null 2>&1 || true
adb logcat -c >/dev/null 2>&1 || true

# ---- 1. install
say "1) Install"
INSTALL_OUT=$(adb install -r "$APK" 2>&1)
printf '%s\n' "$INSTALL_OUT" > "$DIR/install.txt"
if ! printf '%s\n' "$INSTALL_OUT" | grep -q "Success"; then
  fail "the APK did not install: $(printf '%s' "$INSTALL_OUT" | tail -n 2 | tr '\n' ' ')"
fi
say "Installed."
adb shell dumpsys package "$PKG" 2>/dev/null | tr -d '\r' | grep -E "versionCode=|versionName=|minSdk=|targetSdk=" | head -n 4 | sed 's/^ *//' | tee -a "$STEPS"

# ---- 2. fresh start, no permissions given
say "2) Open after a fresh install (no permissions given yet)"
open_app
sleep 30
shot "1-opened"
alive || fail "the app is not running 30 seconds after it was opened (it closed or crashed on start)"
check_crash "first start"
in_front "first start"

# ---- 3. permissions + overlay, then Home
say "3) Give permissions and 'Display over other apps', then press Home (the chat head should appear)"
for p in CAMERA RECORD_AUDIO ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS READ_MEDIA_IMAGES READ_MEDIA_VIDEO READ_MEDIA_AUDIO READ_EXTERNAL_STORAGE BLUETOOTH_CONNECT; do
  adb shell pm grant "$PKG" "android.permission.$p" >/dev/null 2>&1 || true   # a permission that does not exist on this Android version is skipped
done
adb shell appops set "$PKG" SYSTEM_ALERT_WINDOW allow >/dev/null 2>&1 || true
sleep 3
open_app   # giving some permissions restarts the app, so open it again
sleep 20
alive || fail "the app is not running after the permissions were given"
adb shell input keyevent KEYCODE_HOME
sleep 8
shot "2-home-chat-head"
alive || fail "Android closed the app after Home (it should keep running in the background)"
check_crash "after Home"
adb shell dumpsys window windows 2>/dev/null | tr -d '\r' > "$DIR/windows.txt"
if awk -v pkg="$PKG" '/^ *Window #[0-9]+ /{cur=(index($0,pkg)>0)} cur && /ty=(APPLICATION_OVERLAY|2038)/{f=1} END{exit (f ? 0 : 1)}' "$DIR/windows.txt"; then
  say "Chat head overlay window from Letschat: found (info)"
else
  say "Chat head overlay window from Letschat: not found (info only; look at 2-home-chat-head.png)"
fi

# ---- 4. back from the background, Back key
say "4) Open again from the background, then press Back"
open_app
sleep 8
alive || fail "the app is not running after opening it again"
shot "3-reopened"
in_front "reopened"
adb shell input keyevent KEYCODE_BACK
sleep 4
shot "4-after-back"
check_crash "after Back"

# ---- 5. force-stop, cold start
say "5) Force-stop, then start it cold"
adb shell am force-stop "$PKG"
sleep 3
open_app
sleep 25
alive || fail "cold start: the app is not running"
shot "5-cold-start"
check_crash "cold start"

# ---- 6. background service (best effort)
say "6) Background service (best effort)"
if adb root 2>&1 | grep -qi "cannot run as root"; then
  say "This emulator cannot give adb root, so the background service check was skipped"
else
  adb wait-for-device
  sleep 3
  adb shell am start-foreground-service -n "$PKG/$SVC" > "$DIR/service-start.txt" 2>&1
  sleep 6
  adb shell dumpsys activity services "$PKG" 2>/dev/null | tr -d '\r' > "$DIR/services.txt"
  if grep -q "isForeground=true" "$DIR/services.txt"; then
    say "Background service: running as a foreground service"
  else
    warn "the background service did not show up as a foreground service (see service-start.txt and services.txt)"
  fi
  check_crash "background service"
fi
shot "6-final"

say "RESULT: PASS (warnings: $WARNINGS)"
summary "PASS" "installed, opened, went to the background and back, cold start worked, no crash"
exit 0
