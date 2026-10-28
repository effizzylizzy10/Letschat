#!/usr/bin/env bash
# Opens the finished, signed Letschat-legacy.apk (Trusted Web Activity build for Android 5 and 6) and checks it.
# Exits with an error (so no artifact is uploaded) if anything is wrong.
# Checks: file exists, valid v2/v3 signature, certificate = Letschat key, package ID, versionCode/versionName,
# minSdk = 21, targetSdk >= 34, not debuggable, no mandatory camera/microphone/location/Bluetooth hardware.
# Prints only public information.
#
# Used from build-apk.yml after the build step. Needs env: EXPECTED_SHA256, GITHUB_WORKSPACE, GITHUB_RUN_NUMBER, ANDROID_HOME.
set -euo pipefail

BT_ROOT="${ANDROID_HOME:?ANDROID_HOME is not set}/build-tools"
BT="$BT_ROOT/$(ls "$BT_ROOT" | sort -V | tail -1)"
APK="${GITHUB_WORKSPACE:?}/Letschat-legacy.apk"
TMP="${RUNNER_TEMP:-/tmp}"
RUN="${GITHUB_RUN_NUMBER:?GITHUB_RUN_NUMBER is not set}"
EXPECTED="${EXPECTED_SHA256:?EXPECTED_SHA256 is not set}"

fail() { echo "::error title=Legacy APK validation failed::$1"; exit 1; }
norm() { printf '%s' "$1" | tr -d ': \r\n' | tr 'a-f' 'A-F'; }

[ -s "$APK" ] || fail "Letschat-legacy.apk is missing or empty."
echo "Build tools: $BT"
echo "APK size: $(stat -c %s "$APK") bytes"

# 1. Signature
"$BT/apksigner" verify --verbose --print-certs "$APK" > "$TMP/verify-legacy.txt" 2>&1 \
  || { cat "$TMP/verify-legacy.txt"; fail "apksigner could not verify the APK."; }
grep -Eq "Verified using v[23] scheme .*: true" "$TMP/verify-legacy.txt" || fail "APK is not signed with the v2 or v3 signature scheme."
GOT=$(grep -i "SHA-256" "$TMP/verify-legacy.txt" | head -1 | sed 's/.*digest:[[:space:]]*//')
[ "$(norm "$GOT")" = "$(norm "$EXPECTED")" ] || fail "Certificate fingerprint does not match the Letschat key."

# 2. Identity, version, SDK levels (read from the APK itself, each from its own field)
"$BT/aapt" dump badging "$APK" > "$TMP/badging-legacy.txt"
PKGLINE=$(grep -m1 '^package:' "$TMP/badging-legacy.txt")
PKG=$(printf '%s\n' "$PKGLINE" | sed -E "s/^package: name='([^']*)'.*/\1/")
VCODE=$(printf '%s\n' "$PKGLINE" | sed -E "s/.* versionCode='([0-9]+)'.*/\1/")
VNAME=$(printf '%s\n' "$PKGLINE" | sed -E "s/.* versionName='([^']*)'.*/\1/")
MINSDK=$(grep -m1 '^sdkVersion:' "$TMP/badging-legacy.txt" | sed -E "s/.*'([0-9]+)'.*/\1/")
TARGET=$(grep -m1 '^targetSdkVersion:' "$TMP/badging-legacy.txt" | sed -E "s/.*'([0-9]+)'.*/\1/")
echo "package=$PKG versionCode=$VCODE versionName=$VNAME minSdk=$MINSDK targetSdk=$TARGET"

[ "$PKG" = "com.letschatafrica.app" ] || fail "Package ID is '$PKG', expected com.letschatafrica.app (a different ID would not update the installed app)."
[ "$VCODE" = "$((100 + RUN))" ] || fail "versionCode is '$VCODE', expected $((100 + RUN))."
[ "$VNAME" = "1.0.${RUN}" ] || fail "versionName is '$VNAME', expected 1.0.${RUN}."
[ "$MINSDK" = "21" ] || fail "minSdk is '$MINSDK'; the legacy build must declare 21 (Android 5.0)."
[ -n "$TARGET" ] && [ "$TARGET" -ge 34 ] || fail "targetSdk is '$TARGET'; expected 34 or higher."

# 3. Not a debug build; no mandatory hardware
if grep -q '^application-debuggable' "$TMP/badging-legacy.txt"; then fail "APK is marked debuggable."; fi
if grep -Eq "^uses-feature:'android\.hardware\.(camera|microphone|location|bluetooth)" "$TMP/badging-legacy.txt"; then
  fail "Camera, microphone, location or Bluetooth is declared as required hardware."
fi

# 4. Report
{
  echo "### Letschat legacy APK validation (Android 5-6, Trusted Web Activity)"
  echo "- Package: \`$PKG\`"
  echo "- versionCode / versionName: \`$VCODE\` / \`$VNAME\`"
  echo "- minSdk / targetSdk: \`$MINSDK\` / \`$TARGET\`"
  echo "- Certificate SHA-256: \`$GOT\`"
  echo "- Permissions:"
  grep '^uses-permission' "$TMP/badging-legacy.txt" | sed -E "s/.*name='([^']*)'.*/  - \`\1\`/" || true
  echo "- This is a configuration and package check. It is NOT a runtime test on an Android 5 or 6 device."
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "Legacy APK validation passed."
