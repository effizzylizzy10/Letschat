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

# Letschat "LA" logo: launcher icons (every Android version) and the start-up image.
# This step can never stop the build: the script works on a copy of the res folder, and the copy only replaces the
# real one when it finished without errors. Without Pillow (or if the script fails) Capacitor's default pictures stay.
RES=android/app/src/main/res
ICONS_DIR=../client/icons
if [ -f "$ICONS_DIR/icon-512.png" ] && [ -f "$ICONS_DIR/icon-maskable-512.png" ]; then
  if ! python3 -c "import PIL" 2>/dev/null; then
    echo "Installing Pillow for the logo script"
    python3 -m pip install --quiet --disable-pip-version-check pillow >/dev/null 2>&1 \
      || python3 -m pip install --quiet --disable-pip-version-check --user pillow >/dev/null 2>&1 \
      || python3 -m pip install --quiet --disable-pip-version-check --break-system-packages pillow >/dev/null 2>&1 \
      || true
  fi
  if python3 -c "import PIL" 2>/dev/null; then
    STAGE="$(mktemp -d)"
    cp -R "$RES/." "$STAGE/"
    if python3 android-src/make_icons.py "$ICONS_DIR" "$STAGE"; then
      rm -rf "$RES"
      mkdir -p "$RES"
      cp -R "$STAGE/." "$RES/"
      echo "LA logo icons and start-up image added"
    else
      echo "WARNING: the logo script failed; the default icons stay"
    fi
    rm -rf "$STAGE"
  else
    echo "WARNING: Pillow is not available; the default icons stay"
  fi
else
  echo "Logo files not found in client/icons; the default icons stay"
fi

# Faster, steadier Gradle builds (only added once)
GP=android/gradle.properties
if [ -f "$GP" ] && ! grep -q "letschat-build-tuning" "$GP"; then
  printf '\n# letschat-build-tuning\norg.gradle.parallel=true\norg.gradle.caching=true\norg.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8\n' >> "$GP"
  echo "Gradle build tuning added"
fi
