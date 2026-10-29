#!/usr/bin/env bash
# Runs the real publish guard (tools/check-published-apks.sh) on every version of every client/*.apk ever committed,
# oldest first, and lists which ones it would have blocked. Informational only: always exits 0.
# Needs env: ANDROID_HOME, EXPECTED_SHA256. Run from the repository root with full history (fetch-depth: 0).
set -uo pipefail

BT_ROOT="${ANDROID_HOME:?ANDROID_HOME is not set}/build-tools"
BT="$BT_ROOT/$(ls "$BT_ROOT" | sort -V | tail -1)"
GUARD="$PWD/tools/check-published-apks.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
SUM="${GITHUB_STEP_SUMMARY:-/dev/null}"
TOTAL=0
BLOCKED=0

{
  echo "### APK history scan (the real publish guard, run on every committed version)"
  echo
  echo "| Date | Commit | File | Signer | versionCode | Guard |"
  echo "|---|---|---|---|---|---|"
} >> "$SUM"

while read -r C DATE; do
  [ -n "$C" ] || continue
  while read -r F; do
    [ -n "$F" ] || continue
    TOTAL=$((TOTAL + 1))
    NAME="$(basename "$F")"
    D="$T/$TOTAL"
    mkdir -p "$D/client"
    if ! git show "$C:$F" > "$D/client/$NAME" 2>/dev/null; then continue; fi

    RES="$(cd "$D" && env -u BASE_REF bash "$GUARD" 2>&1)"
    RC=$?
    SIGNER="$(printf '%s\n' "$RES" | grep -m1 '^Signer:' | sed -E 's/.*certificate DN: *//; s/^(CN=[^,]*).*/\1/')"
    [ -n "$SIGNER" ] || SIGNER="unreadable"
    VCODE="$("$BT/aapt" dump badging "$D/client/$NAME" 2>/dev/null | grep -m1 '^package:' | grep -oE "versionCode='[0-9]+'" | tr -dc '0-9')"
    [ -n "$VCODE" ] || VCODE="?"

    if [ "$RC" -eq 0 ]; then
      VERDICT="pass"
    else
      BLOCKED=$((BLOCKED + 1))
      WHY="$(printf '%s\n' "$RES" | grep -m1 '^::error' | sed -E 's/^::error [^:]*:://' | tr '|' '/')"
      VERDICT="BLOCKED: ${WHY:-see log}"
    fi

    SHORT="$(printf '%.7s' "$C")"
    echo "[$DATE $SHORT] $F  signer=$SIGNER versionCode=$VCODE  ->  $VERDICT"
    echo "| $DATE | \`$SHORT\` | \`$F\` | $SIGNER | $VCODE | $VERDICT |" >> "$SUM"
  done < <(git diff-tree --root --no-commit-id --name-only -r --diff-filter=AM "$C" -- 'client/*.apk' | grep -E '^client/[^/]+\.apk$')
done < <(git log --reverse --format='%H %cs' -- 'client/*.apk')

echo
echo "Scanned $TOTAL committed APK version(s); the guard would have blocked $BLOCKED."
{
  echo
  echo "Scanned **$TOTAL** committed APK version(s). The guard would have blocked **$BLOCKED**."
  if [ "$BLOCKED" -gt 0 ]; then echo "Phones that installed a blocked version may answer \"App not installed\" to updates until Letschat is uninstalled once."; fi
} >> "$SUM"
exit 0
