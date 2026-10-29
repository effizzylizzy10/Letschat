#!/usr/bin/env bash
# Smoke test on a RUNNING Android emulator: install the APK, open the app three ways (first start, return from Home,
# start after force-stop) and fail if the app crashes, freezes (ANR) or is not running. Saves a screenshot and the log of each step.
# Usage: bash tools/emulator-smoke-test.sh <apk> <api-level> [results-folder]
# It cannot prove the app looks right: look at the screenshots. It does catch install failures and crashes on that Android version.
set -u
APK="${1:?apk path}"
API="${2:?api level}"
OUT="${3:-emulator-results}"
PKG=com.letschatafrica.app
mkdir -p "$OUT"
FAIL=0
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

say()  { echo "[android $API] $*"; }
fail() { echo "::error title=Android $API::$*"; echo "- FAIL: $*" >> "$SUMMARY"; FAIL=1; }
ok()   { echo "- ok: $*" >> "$SUMMARY"; say "$*"; }

echo "### Android API $API" >> "$SUMMARY"

adb wait-for-device
for i in $(seq 1 90); do
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
  sleep 2
done
adb shell input keyevent 82 >/dev/null 2>&1 || true   # unlock the screen
sleep 3

# ---- install ----
FLAGS="-r"
[ "$API" -ge 23 ] && FLAGS="-r -g"                      # -g grants the permissions up front (Android 6 and newer only)
if adb install $FLAGS "$APK" > "$OUT/install.txt" 2>&1 && grep -q Success "$OUT/install.txt"; then
  ok "APK installed"
else
  cat "$OUT/install.txt"
  fail "APK did not install: $(tr -d '\r' < "$OUT/install.txt" | tail -n 2 | tr '\n' ' ')"
  exit 1
fi

is_running() { (adb shell ps -A 2>/dev/null; adb shell ps 2>/dev/null) | tr -d '\r' | grep -q "$PKG"; }
shot()       { adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null || true; }
launch()     { adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1; }

check_step() {  # name, seconds to wait
  sleep "$2"
  shot "$1"
  adb logcat -d > "$OUT/logcat-$1.txt" 2>&1
  if grep -A6 "FATAL EXCEPTION" "$OUT/logcat-$1.txt" | grep -q "$PKG"; then
    fail "$1: the app crashed (see logcat-$1.txt)"
    grep -A12 "FATAL EXCEPTION" "$OUT/logcat-$1.txt" | head -n 30
  elif grep -q "ANR in $PKG" "$OUT/logcat-$1.txt"; then
    fail "$1: the app stopped responding (ANR)"
  elif ! is_running; then
    fail "$1: the app is not running"
  else
    ok "$1: app is running, no crash"
  fi
}

# ---- 1. first start ----
adb logcat -c
launch
check_step 1-first-start 45

# ---- 2. back to Home and open again ----
adb logcat -c
adb shell input keyevent KEYCODE_HOME
sleep 5
launch
check_step 2-return-from-home 15

# ---- 3. force-stop and start again ----
adb logcat -c
adb shell am force-stop "$PKG"
sleep 3
launch
check_step 3-start-after-stop 30

adb shell getprop ro.build.version.release | tr -d '\r' > "$OUT/android-version.txt" || true
say "done (exit $FAIL)"
exit "$FAIL"
