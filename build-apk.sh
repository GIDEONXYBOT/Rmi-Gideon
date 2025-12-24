#!/bin/bash
# Build RMI Teller Report APK

echo "🔨 Building RMI Teller Report APK..."
echo ""

# Step 1: Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Frontend build failed!"
  exit 1
fi
cd ..

# Step 2: Copy to Cordova www
echo "📁 Copying frontend to Cordova..."
rm -rf android/www
cp -r frontend/dist android/www

# Step 3: Build APK
echo "🚀 Building APK with Cordova..."
cd android
cordova build android --release

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ APK build successful!"
  echo "📍 APK location: android/platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk"
  echo ""
  echo "📝 To sign the APK, you'll need:"
  echo "   1. A keystore file"
  echo "   2. Run: jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore <keystore> app-release-unsigned.apk <alias>"
  echo "   3. Run: zipalign 4 app-release-unsigned.apk app-release-signed.apk"
else
  echo "❌ APK build failed!"
  exit 1
fi
