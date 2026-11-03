#!/usr/bin/env bash
# Smoke test on a RUNNING Android emulator: install the APK, open the app three ways (first start, return from Home,
# start after force-stop) and fail if the app crashes, freezes (ANR) or is not running. Saves a screenshot and the log of each step.
# Usage: bash tools/emulator-smoke-test.sh <apk> <api-level> [results-folder] [previous-apk]
# It cannot prove the app looks right: look at the screenshots. It does catch install failures and crashes on that Android version.
#
# Update check: when the APK under test is called Letschat.apk and client/Letschat.apk exists (the file people download today),
# that older file is installed first and the new one is installed over it, the way a real phone updates. Android answers
# "App not installed" when the new file has another signing key or a lower versionCode, so a build like that fails here, with
# the reason, before any phone meets it. A fourth argument names a different previous APK.
#
# Slow-emulator tolerance: a virtual phone on a busy CI machine can be slow to show the app or can kill it for memory.
# A step that finds the app "not running" or "not responding" is given one more chance (wait, start again, check again).
# A real crash (FATAL EXCEPTION of the app) still fails at once.
set -u
APK="${1:?apk path}"
API="${2:?api level}"
OUT="${3:-emulator-results}"
PREV="${4:-}"
if [ -z "$PREV" ] && [ "$(basename "$APK")" = "Letschat.apk" ] && [ -s client/Letschat.apk ]; then PREV="client/Letschat.apk"; fi
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
# wait until the package manager answers (on some versions boot_completed arrives before it is ready)
for i in $(seq 1 30); do
  adb shell pm path android 2>/dev/null | tr -d '\r' | grep -q "package:" && break
  sleep 2
done
adb shell input keyevent 82 >/dev/null 2>&1 || true   # unlock the screen
sleep 3

# ---- install ----
FLAGS="-r"
[ "$API" -ge 23 ] && FLAGS="-r -g"                      # -g grants the permissions up front (Android 6 and newer only)

install_apk() {  # apk, result-file ; tries up to 3 times (a freshly booted phone sometimes drops the first install)
  local n
  for n in 1 2 3; do
    if adb install $FLAGS "$1" > "$2" 2>&1 && grep -q Success "$2"; then return 0; fi
    # a real rejection (signing key, versionCode, ...) will not change on a retry
    if grep -qE "INSTALL_FAILED_(UPDATE_INCOMPATIBLE|VERSION_DOWNGRADE|NO_MATCHING_ABIS|OLDER_SDK|INVALID_APK)" "$2"; then return 1; fi
    sleep 10
  done
  return 1
}

UPDATE=""
if [ -n "$PREV" ] && [ -s "$PREV" ] && ! cmp -s "$PREV" "$APK"; then
  # first put the APK people can download today on the phone, so the next install is a real update
  if install_apk "$PREV" "$OUT/install-previous.txt"; then
    UPDATE=" over the published $PREV"
  else
    say "the published $PREV could not be installed first (update check skipped): $(tr -d '\r' < "$OUT/install-previous.txt" | tail -n 1)"
  fi
fi
if install_apk "$APK" "$OUT/install.txt"; then
  ok "APK installed${UPDATE:+ as an update}${UPDATE}"
else
  cat "$OUT/install.txt"
  if [ -n "$UPDATE" ]; then
    fail "the new APK would not install${UPDATE}, so phones that already have the published app would see \"App not installed\": $(tr -d '\r' < "$OUT/install.txt" | tail -n 2 | tr '\n' ' ')"
  else
    fail "APK did not install: $(tr -d '\r' < "$OUT/install.txt" | tail -n 2 | tr '\n' ' ')"
  fi
  exit 1
fi

# the app counts as running if pidof, ps -A or ps lists it; checked for up to 20 seconds
is_running_once() {
  [ -n "$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')" ] && return 0
  (adb shell ps -A 2>/dev/null; adb shell ps 2>/dev/null) | tr -d '\r' | grep -q "$PKG"
}
is_running() {
  local n
  for n in 1 2 3 4 5 6 7 8 9 10; do
    is_running_once && return 0
    sleep 2
  done
  return 1
}
shot()       { adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null || true; }
launch()     { adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1; }

# verdict for one look at the log: prints crash | anr | stopped | ok
verdict() {  # name
  adb logcat -d > "$OUT/logcat-$1.txt" 2>&1
  if grep -A6 "FATAL EXCEPTION" "$OUT/logcat-$1.txt" | grep -q "$PKG"; then echo crash
  elif grep -q "ANR in $PKG" "$OUT/logcat-$1.txt"; then echo anr
  elif ! is_running; then echo stopped
  else echo ok
  fi
}

check_step() {  # name, seconds to wait
  sleep "$2"
  shot "$1"
  local v
  v=$(verdict "$1")
  if [ "$v" = "anr" ] || [ "$v" = "stopped" ]; then
    # one more chance: a slow or low-memory emulator can drop or stall the app without it being a bug in the app
    say "$1: first look says '$v'; waiting and starting the app once more before judging"
    sleep 20
    launch
    sleep 25
    shot "$1-retry"
    v=$(verdict "$1")
  fi
  case "$v" in
    crash)
      fail "$1: the app crashed (see logcat-$1.txt)"
      grep -A12 "FATAL EXCEPTION" "$OUT/logcat-$1.txt" | head -n 30
      ;;
    anr)     fail "$1: the app stopped responding (ANR)" ;;
    stopped) fail "$1: the app is not running" ;;
    *)       ok "$1: app is running, no crash" ;;
  esac
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
