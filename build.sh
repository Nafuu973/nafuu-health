#!/usr/bin/env bash
# Compile Nafuu Health sans Gradle : aapt2, javac, d8, zipalign, apksigner.
# Prérequis : JDK 17+ et un SDK Android avec platforms;android-35 et build-tools;35.0.0.
set -euo pipefail

SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-35/android.jar"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/app"
OUT="$HERE/build"
KS="${NAFUU_KEYSTORE:-$HERE/../nafuu-health-release.jks}"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"

rm -rf "$OUT" && mkdir -p "$OUT/classes" "$OUT/gen" "$OUT/assets"
# La version web (docs/) est la source de l'interface : on la copie dans l'APK.
cp -r "$HERE/docs" "$OUT/assets/www"
rm -f "$OUT/assets/www/sw.js" "$OUT/assets/www/manifest.webmanifest"

"$BT/aapt2" compile --dir "$APP/res" -o "$OUT/res.zip"
"$BT/aapt2" link -I "$JAR" --manifest "$APP/AndroidManifest.xml" -A "$OUT/assets" \
  --min-sdk-version 26 --target-sdk-version 35 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --java "$OUT/gen" -o "$OUT/base.apk" "$OUT/res.zip"

javac -Xlint:-options --release 11 -classpath "$JAR" \
  -d "$OUT/classes" $(find "$APP/src" "$OUT/gen" -name '*.java')
"$BT/d8" --release --min-api 26 --lib "$JAR" --output "$OUT" $(find "$OUT/classes" -name '*.class')

cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT" && zip -q -j unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KS" ]; then
  echo "Clé de signature absente : création de $KS"
  keytool -genkeypair -keystore "$KS" -alias nafuu -keyalg RSA -keysize 4096 -validity 10000 \
    -dname "CN=Nafuu Health" -storepass:env NAFUU_KS_PASS -keypass:env NAFUU_KS_PASS
fi
"$BT/apksigner" sign --ks "$KS" --ks-key-alias nafuu --ks-pass env:NAFUU_KS_PASS --key-pass env:NAFUU_KS_PASS \
  --v2-signing-enabled true --v3-signing-enabled true --out "$OUT/nafuu-health.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT/nafuu-health.apk" | head -5
echo "APK : $OUT/nafuu-health.apk"
