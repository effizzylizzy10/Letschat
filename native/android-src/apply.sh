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

# Version number that goes up with every build, so Android installs the new APK as an UPDATE over the installed app
# (same package + same signing key + higher versionCode = chats and settings are kept; a lower or equal code is refused).
# In GitHub Actions the run number counts up by itself; elsewhere the current time in minutes does.
GRADLE=android/app/build.gradle
if [ -f "$GRADLE" ]; then
  if [ -n "${GITHUB_RUN_NUMBER:-}" ]; then
    CODE=$((100 + GITHUB_RUN_NUMBER))
    NAME="1.0.${GITHUB_RUN_NUMBER}"
  else
    CODE=$(( $(date +%s) / 60 - 29000000 ))
    NAME="1.0.${CODE}"
  fi
  sed -i -E "s/versionCode[ =]+[0-9]+/versionCode ${CODE}/; s/versionName[ =]+\"[^\"]*\"/versionName \"${NAME}\"/" "$GRADLE"
  grep -q "versionCode ${CODE}" "$GRADLE" || { echo "Could not set versionCode in $GRADLE"; exit 1; }
  echo "App version set to ${NAME} (versionCode ${CODE})"
fi

# Faster, steadier Gradle builds (only added once)
GP=android/gradle.properties
if [ -f "$GP" ] && ! grep -q "letschat-build-tuning" "$GP"; then
  printf '\n# letschat-build-tuning\norg.gradle.parallel=true\norg.gradle.caching=true\norg.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8\n' >> "$GP"
  echo "Gradle build tuning added"
fi
