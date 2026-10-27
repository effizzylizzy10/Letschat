#!/usr/bin/env bash
# Stops the APK build early, with a plain explanation, when the Letschat signing key is missing or wrong.
# Without this the build quietly makes an APK signed with a different key, and Android refuses to install it over the app you already have.
#
# Needs two environment variables (set from the GitHub secrets):
#   KEYSTORE_B64   the text inside keystore.base64.txt
#   KEYSTORE_PASS  the key password from signing-info.txt
# Optional:
#   EXPECTED_SHA256  the fingerprint the key must have (defaults to the Letschat key)
#   KEYSTORE_OUT     where to write the decoded keystore (default: $RUNNER_TEMP/letschat.keystore)
set -u

EXPECTED_DEFAULT="F5:A5:15:F3:EA:6A:31:7B:05:9C:7F:10:7E:AE:7F:94:0B:61:95:75:58:B1:CC:57:5F:E8:07:E7:CC:FD:F7:D8"
EXPECTED="${EXPECTED_SHA256:-$EXPECTED_DEFAULT}"
OUT="${KEYSTORE_OUT:-${RUNNER_TEMP:-/tmp}/letschat.keystore}"
ALIAS="letschat"

fail() {
  echo "::error title=Signing key problem::$1"
  echo
  echo "STOPPED: $1"
  echo
  echo "Fix: open the repo on GitHub > Settings > Secrets and variables > Actions, then check:"
  echo "  ANDROID_KEYSTORE_B64      = the whole text inside keystore.base64.txt (no extra spaces or quotes)"
  echo "  ANDROID_KEYSTORE_PASSWORD = the key password from signing-info.txt"
  echo "Then run the workflow again."
  rm -f "$OUT"
  exit 1
}

norm() { printf '%s' "$1" | tr -d ': \r\n' | tr 'a-f' 'A-F'; }

[ -n "${KEYSTORE_B64:-}" ]  || fail "The secret ANDROID_KEYSTORE_B64 is missing or empty."
[ -n "${KEYSTORE_PASS:-}" ] || fail "The secret ANDROID_KEYSTORE_PASSWORD is missing or empty."

printf '%s' "$KEYSTORE_B64" | base64 -d > "$OUT" 2>/dev/null \
  || fail "ANDROID_KEYSTORE_B64 is not valid base64 text. Paste the full contents of keystore.base64.txt."
[ -s "$OUT" ] || fail "ANDROID_KEYSTORE_B64 decoded to an empty file."

LISTING=$(keytool -list -v -keystore "$OUT" -storepass "$KEYSTORE_PASS" -alias "$ALIAS" 2>&1)
if [ $? -ne 0 ]; then
  case "$LISTING" in
    *"password was incorrect"*|*"Keystore was tampered"*) fail "The password in ANDROID_KEYSTORE_PASSWORD does not open the key." ;;
    *"does not exist"*) fail "The key file opens, but it has no key named '$ALIAS'. It is not the Letschat key." ;;
    *) fail "The key file could not be opened. It may be damaged or not a keystore." ;;
  esac
fi

GOT=$(printf '%s\n' "$LISTING" | grep -i 'SHA256:' | head -1 | sed 's/.*SHA256:[[:space:]]*//')
[ -n "$GOT" ] || fail "Could not read the key fingerprint."

if [ "$(norm "$GOT")" != "$(norm "$EXPECTED")" ]; then
  fail "This key is not the Letschat key (fingerprint $GOT, expected $EXPECTED). An APK signed with it cannot be installed over the Letschat app you already have."
fi

echo "Signing key OK: fingerprint matches the Letschat key."
