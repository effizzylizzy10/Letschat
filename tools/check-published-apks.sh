#!/usr/bin/env bash
# Publish guard: checks every APK that is committed for download from the website (client/*.apk).
# Fails if an APK is signed with a throwaway "Android Debug" key or any key other than the Letschat key,
# has the wrong package ID, is debuggable, or (when BASE_REF is set) changed without a higher versionCode.
# A debug-signed or wrong-key APK can never update an installed Letschat: phones answer "App not installed".
# Needs env: ANDROID_HOME, EXPECTED_SHA256. Optional: BASE_REF (git ref or SHA of the previous version).
set -uo pipefail

BT_ROOT="${ANDROID_HOME:?ANDROID_HOME is not set}/build-tools"
BT="$BT_ROOT/$(ls "$BT_ROOT" | sort -V | tail -1)"
EXPECTED="${EXPECTED_SHA256:?EXPECTED_SHA256 is not set}"
PKG_WANT="com.letschatafrica.app"
TMP="${RUNNER_TEMP:-/tmp}"
BASE_REF="${BASE_REF:-}"
norm() { printf '%s' "$1" | tr -d ': \r\n' | tr 'a-f' 'A-F'; }
FAILED=0
bad() { echo "::error file=$1,title=APK blocked::$2"; FAILED=1; }

version_code() { "$BT/aapt" dump badging "$1" 2>/dev/null | grep -m1 '^package:' | sed -E "s/.* versionCode='([0-9]+)'.*/\1/"; }

shopt -s nullglob
APKS=(client/*.apk)
[ ${#APKS[@]} -gt 0 ] || { echo "No APK files under client/. Nothing to check."; exit 0; }

for APK in "${APKS[@]}"; do
  echo "=== $APK ==="
  if ! "$BT/apksigner" verify --verbose --print-certs "$APK" > "$TMP/v.txt" 2>&1; then
    cat "$TMP/v.txt"; bad "$APK" "apksigner could not verify this APK."; continue
  fi
  GOT=$(grep -i 'SHA-256' "$TMP/v.txt" | head -1 | sed 's/.*digest:[[:space:]]*//')
  SUBJECT=$(grep -i 'certificate DN' "$TMP/v.txt" | head -1)
  echo "Signer: ${SUBJECT:-unknown}"; echo "SHA-256: $GOT"
  if printf '%s' "$SUBJECT" | grep -qi 'Android Debug'; then
    bad "$APK" "Signed with a throwaway Android Debug key. It can never be updated by a release build; phones show 'App not installed'."
  elif [ "$(norm "$GOT")" != "$(norm "$EXPECTED")" ]; then
    bad "$APK" "Signed with a key other than the Letschat key."
  fi

  "$BT/aapt" dump badging "$APK" > "$TMP/b.txt" 2>/dev/null
  PKG=$(grep -m1 '^package:' "$TMP/b.txt" | sed -E "s/^package: name='([^']*)'.*/\1/")
  [ "$PKG" = "$PKG_WANT" ] || bad "$APK" "Package ID is '$PKG', expected $PKG_WANT."
  if grep -q '^application-debuggable' "$TMP/b.txt"; then bad "$APK" "APK is marked debuggable."; fi

  # Only compare versions when the file actually changed since BASE_REF.
  if [ -n "$BASE_REF" ] && git cat-file -e "$BASE_REF:$APK" 2>/dev/null; then
    git show "$BASE_REF:$APK" > "$TMP/base.apk"
    if cmp -s "$TMP/base.apk" "$APK"; then
      echo "Unchanged since $BASE_REF: version comparison skipped."
    else
      NEW=$(version_code "$APK"); OLD=$(version_code "$TMP/base.apk")
      echo "versionCode: $OLD -> $NEW"
      if [ -n "$NEW" ] && [ -n "$OLD" ] && [ "$NEW" -le "$OLD" ]; then
        bad "$APK" "versionCode $NEW is not higher than the published $OLD, so phones would refuse it as an update."
      fi
    fi
  fi
done

[ "$FAILED" = 0 ] && echo "All published APKs passed." || { echo "One or more APKs were blocked."; exit 1; }
