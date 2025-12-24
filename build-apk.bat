@echo off
REM Build RMI Teller Report APK

echo.
echo 🔨 Building RMI Teller Report APK...
echo.

REM Step 1: Build frontend
echo 📦 Building frontend...
cd frontend
call npm run build
if errorlevel 1 (
  echo ❌ Frontend build failed!
  exit /b 1
)
cd ..

REM Step 2: Copy to Cordova www
echo 📁 Copying frontend to Cordova...
if exist android\www rmdir /s /q android\www
xcopy /E /I frontend\dist android\www

REM Step 3: Build APK
echo 🚀 Building APK with Cordova...
cd android
call cordova build android --release

if errorlevel 1 (
  echo ❌ APK build failed!
  cd ..
  exit /b 1
)

echo.
echo ✅ APK build successful!
echo 📍 APK location: android\platforms\android\app\build\outputs\apk\release\app-release-unsigned.apk
echo.
echo 📝 Next steps:
echo    1. Install Android Studio
echo    2. Use Android Studio to sign the APK, OR
echo    3. Use jarsigner and zipalign tools (requires Java Development Kit)
echo.

cd ..
pause
