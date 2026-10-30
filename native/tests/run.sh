#!/usr/bin/env bash
# Runs the tests for the pieces that decide which messages give an alert:
#   - MessagePoller.java (the native message checker) against a fake Letschat server, with stand-ins for the Android classes;
#   - the script ChatBubblePlugin.java runs in the page to read the saved sign-in (READ_SESSION_JS);
#   - letschat-native-bridge.js (the script injected into the website) in a fake page.
# Needs a JDK (17 or newer: javac, java) and Node 18 or newer. Usage: bash native/tests/run.sh
# See README.md in this folder.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../plugins/chat-bubble/android/src/main"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PKG="$WORK/src/com/letschatafrica/chatbubble"
mkdir -p "$PKG" "$WORK/classes"

echo "== MessagePoller (Java) =="
cp "$SRC/java/com/letschatafrica/chatbubble/MessagePoller.java" "$PKG/"
# the test copy waits 0.15 s instead of 8 s between checks
sed -i -e 's/FIRST_WAIT_MS = 2500/FIRST_WAIT_MS = 100/' -e 's/INTERVAL_MS = 8000/INTERVAL_MS = 150/' "$PKG/MessagePoller.java"
grep -q "INTERVAL_MS = 150" "$PKG/MessagePoller.java" || { echo "Could not shorten the waits: did FIRST_WAIT_MS / INTERVAL_MS change in MessagePoller.java?"; exit 1; }
cp "$HERE/poller/MessagePopup.java" "$HERE/poller/Harness.java" "$PKG/"
find "$HERE/poller/stubs" -name '*.java' > "$WORK/stubs.txt"
find "$WORK/src" -name '*.java' > "$WORK/srcs.txt"
javac -nowarn -d "$WORK/classes" @"$WORK/stubs.txt" @"$WORK/srcs.txt"
java -cp "$WORK/classes" com.letschatafrica.chatbubble.Harness

echo
echo "== sign-in reader in ChatBubblePlugin.java =="
node "$HERE/plugin/test-read-session.js" "$SRC/java/com/letschatafrica/chatbubble/ChatBubblePlugin.java"

echo
echo "== letschat-native-bridge.js =="
node "$HERE/bridge/test-bridge.js" "$SRC/assets/letschat-native-bridge.js"
