#!/usr/bin/env bash
# Self-test for tools/check-published-apks.sh. The guard must:
#   0. PASS the real published APKs in client/ (positive control)
#   1. REJECT a copy re-signed with a throwaway "Android Debug" key (the "App not installed" cause)
#   2. REJECT a copy re-signed with some other key
# Nothing here is published; the re-signed copies live in a temp folder and are deleted at the end.
# Needs env: ANDROID_HOME, EXPECTED_SHA256. Run from the repository root.
set -uo pipefail

BT_ROOT="${ANDROID_HOME:?ANDROID_HOME is not set}/build-tools"
BT="$BT_ROOT/$(ls "$BT_ROOT" | sort -V | tail -1)"
GUARD="$PWD/tools/check-published-apks.sh"
SRC="client/Letschat.apk"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
FAIL=0

[ -s "$SRC" ] || { echo "::error::$SRC is missing, so there is nothing to test with."; exit 1; }

resign() { # $1 = certificate name (DN), $2 = output APK
  local ks="$T/test-key.jks"
  rm -f "$ks"
  keytool -genkeypair -keystore "$ks" -storepass android -keypass android -alias test \
    -keyalg RSA -keysize 2048 -validity 3650 -dname "$1" > /dev/null 2>&1 || return 1
  cp "$SRC" "$T/unsigned.apk"
  zip -q -d "$T/unsigned.apk" 'META-INF/*' || return 1
  "$BT/zipalign" -f 4 "$T/unsigned.apk" "$T/aligned.apk" || return 1
  "$BT/apksigner" sign --ks "$ks" --ks-pass pass:android --key-pass pass:android \
    --out "$2" "$T/aligned.apk" || return 1
}

run_guard() { # $1 = APK to place as client/Letschat.apk in an empty folder; prints the guard output
  local d
  d="$(mktemp -d "$T/run.XXXXXX")"
  mkdir -p "$d/client"
  cp "$1" "$d/client/Letschat.apk"
  ( cd "$d" && env -u BASE_REF bash "$GUARD" ) 2>&1 | sed -E 's/^::error [^:]*::/   (guard says) /'
  return "${PIPESTATUS[0]}"
}

echo "=== 0. Positive control: the real published APKs must pass ==="
env -u BASE_REF bash "$GUARD" > "$T/pos.txt" 2>&1
RC=$?
if [ "$RC" -eq 0 ]; then echo "OK: guard passed the published APKs."; else cat "$T/pos.txt"; echo "::error::The guard rejected the real published APKs."; FAIL=1; fi

echo
echo "=== 1. A debug-signed copy must be rejected ==="
if resign "CN=Android Debug,O=Android,C=US" "$T/debug.apk"; then
  OUT="$(run_guard "$T/debug.apk")"; RC=$?
  printf '%s\n' "$OUT"
  if [ "$RC" -ne 0 ] && printf '%s' "$OUT" | grep -q 'Android Debug key'; then
    echo "OK: debug-signed copy was blocked for the right reason."
  else
    echo "::error::The guard did NOT block a debug-signed APK (exit $RC)."; FAIL=1
  fi
else
  echo "::error::Could not build the debug-signed test copy."; FAIL=1
fi

echo
echo "=== 2. A copy signed with some other key must be rejected ==="
if resign "CN=Someone Else,O=Test,C=US" "$T/other.apk"; then
  OUT="$(run_guard "$T/other.apk")"; RC=$?
  printf '%s\n' "$OUT"
  if [ "$RC" -ne 0 ] && printf '%s' "$OUT" | grep -q 'other than the Letschat key'; then
    echo "OK: wrong-key copy was blocked for the right reason."
  else
    echo "::error::The guard did NOT block a wrong-key APK (exit $RC)."; FAIL=1
  fi
else
  echo "::error::Could not build the wrong-key test copy."; FAIL=1
fi

echo
if [ "$FAIL" -eq 0 ]; then echo "Self-test passed: the guard passes good APKs and blocks debug-signed and wrong-key ones."; else echo "Self-test FAILED."; exit 1; fi
