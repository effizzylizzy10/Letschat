#!/usr/bin/env bash
# Opens the finished, signed Letschat.apk and checks it. Exits with an error (so no artifact is uploaded) if anything is wrong.
# Checks: file exists, valid v2/v3 signature, certificate = Letschat key, package ID, versionCode/versionName
# (same numbers apply.sh set from the run number), minSdk >= 24, targetSdk >= 35, not debuggable,
# no mandatory camera/microphone/location/Bluetooth hardware, and the injected native bridge script parses as valid JavaScript
# (a truncated bridge once shipped and silently killed the push / background switches). Prints only public information.
#
# Used from build-native-apk.yml, after the "Build, then sign" step:
#   - name: Validate the finished APK
#     run: bash tools/validate-apk.sh
# Needs env: EXPECTED_SHA256 (already set in that workflow), plus the standard GITHUB_* / RUNNER_TEMP / ANDROID_HOME.
set -euo pipefail

BT="${ANDROID_HOME:?ANDROID_HOME is not set}/build-tools/36.0.0"
APK="${GITHUB_WORKSPACE:?}/Letschat.apk"
TMP="${RUNNER_TEMP:-/tmp}"
RUN="${GITHUB_RUN_NUMBER:?GITHUB_RUN_NUMBER is not set}"
EXPECTED="${EXPECTED_SHA256:?EXPECTED_SHA256 is not set}"

fail() { echo "::error title=APK validation failed::$1"; exit 1; }
norm() { printf '%s' "$1" | tr -d ': \r\n' | tr 'a-f' 'A-F'; }

[ -s "$APK" ] || fail "Letschat.apk is missing or empty."
echo "APK size: $(stat -c %s "$APK") bytes"

# 1. Signature
"$BT/apksigner" verify --verbose --print-certs "$APK" > "$TMP/verify.txt" 2>&1 \
  || { cat "$TMP/verify.txt"; fail "apksigner could not verify the APK."; }
grep -Eq "Verified using v[23] scheme .*: true" "$TMP/verify.txt" || fail "APK is not signed with the v2 or v3 signature scheme."
GOT=$(grep -i "SHA-256" "$TMP/verify.txt" | head -1 | sed 's/.*digest:[[:space:]]*//')
[ "$(norm "$GOT")" = "$(norm "$EXPECTED")" ] || fail "Certificate fingerprint does not match the Letschat key."

# 2. Identity, version, SDK levels (read from the APK itself)
# The "package:" line looks like: package: name='...' versionCode='..' versionName='..' compileSdkVersionCodename='..'
# so every value is read with a pattern anchored to its own field (a loose pattern picked up compileSdkVersionCodename).
"$BT/aapt" dump badging "$APK" > "$TMP/badging.txt"
PKGLINE=$(grep -m1 '^package:' "$TMP/badging.txt")
PKG=$(printf '%s\n' "$PKGLINE" | sed -E "s/^package: name='([^']*)'.*/\1/")
VCODE=$(printf '%s\n' "$PKGLINE" | sed -E "s/.* versionCode='([0-9]+)'.*/\1/")
VNAME=$(printf '%s\n' "$PKGLINE" | sed -E "s/.* versionName='([^']*)'.*/\1/")
MINSDK=$(grep -m1 '^sdkVersion:' "$TMP/badging.txt" | sed -E "s/.*'([0-9]+)'.*/\1/")
TARGET=$(grep -m1 '^targetSdkVersion:' "$TMP/badging.txt" | sed -E "s/.*'([0-9]+)'.*/\1/")
echo "package=$PKG versionCode=$VCODE versionName=$VNAME minSdk=$MINSDK targetSdk=$TARGET"

[ "$PKG" = "com.letschatafrica.app" ] || fail "Package ID is '$PKG', expected com.letschatafrica.app (a different ID would not update the installed app)."
[ "$VCODE" = "$((100 + RUN))" ] || fail "versionCode is '$VCODE', expected $((100 + RUN))."
[ "$VNAME" = "1.0.${RUN}" ] || fail "versionName is '$VNAME', expected 1.0.${RUN}."
[ -n "$MINSDK" ] && [ "$MINSDK" -ge 24 ] || fail "minSdk is '$MINSDK'; Capacitor 8 needs 24 or higher."
[ -n "$TARGET" ] && [ "$TARGET" -ge 35 ] || fail "targetSdk is '$TARGET'; expected 35 or higher."

# 3. Not a debug build; no mandatory hardware (otherwise Google Play hides the app from phones without it)
if grep -q '^application-debuggable' "$TMP/badging.txt"; then fail "APK is marked debuggable."; fi
if grep -Eq "^uses-feature:'android\.hardware\.(camera|microphone|location|bluetooth)" "$TMP/badging.txt"; then
  fail "Camera, microphone, location or Bluetooth is declared as required hardware."
fi

# 3b. The injected native bridge must exist and be valid JavaScript, and must contain its last function (a cut-off file fails here).
BR="$TMP/letschat-native-bridge.js"
unzip -p "$APK" assets/letschat-native-bridge.js > "$BR" 2>/dev/null || fail "assets/letschat-native-bridge.js is missing from the APK."
[ -s "$BR" ] || fail "assets/letschat-native-bridge.js is empty."
if ! node --check "$BR" 2> "$TMP/bridge-check.txt"; then
  cat "$TMP/bridge-check.txt"
  fail "letschat-native-bridge.js has a JavaScript syntax error (the push, background and bubble switches would not work)."
fi
grep -q "bubbleTapped" "$BR" || fail "letschat-native-bridge.js looks cut off (the bubbleTapped handler at its end is missing)."
grep -q "FCM_PREFIX" "$BR" || fail "letschat-native-bridge.js has no Firebase push code."
echo "Native bridge script: valid."

# 4. Report
{
  echo "### Letschat APK validation"
  echo "- Package: \`$PKG\`"
  echo "- versionCode / versionName: \`$VCODE\` / \`$VNAME\` (Android Settings > Apps > Letschat > App info shows this version, so you can tell which build is installed)"
  echo "- minSdk / targetSdk: \`$MINSDK\` / \`$TARGET\`"
  echo "- Certificate SHA-256: \`$GOT\`"
  echo "- Native bridge script: valid JavaScript"
  echo "- Native library ABIs: \`$(unzip -Z1 "$APK" | grep '^lib/' | cut -d/ -f2 | sort -u | tr '\n' ' ' || true)\` (empty means none)"
  echo "- Permissions:"
  grep '^uses-permission' "$TMP/badging.txt" | sed -E "s/.*name='([^']*)'.*/  - \`\1\`/" || true
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "APK validation passed."
