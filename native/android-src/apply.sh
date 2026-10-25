#!/usr/bin/env bash
# Run from anywhere, after `npx cap add android` (it finds the native/ folder itself).
set -euo pipefail
cd "$(dirname "$0")/.."

MANIFEST=android/app/src/main/AndroidManifest.xml
[ -f "$MANIFEST" ] || { echo "android/ not found. Run 'npx cap add android' first."; exit 1; }

echo "Copying android-src/res into the Android project"
mkdir -p android/app/src/main/res
cp -R android-src/res/. android/app/src/main/res/

echo "Patching AndroidManifest.xml"
python3 android-src/patch_manifest.py "$MANIFEST"

echo "Done. Permissions and filters now in the manifest:"
grep -E "uses-permission|<data " "$MANIFEST" || true
