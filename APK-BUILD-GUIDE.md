# APK Build Guide for RMI Teller Report

## Prerequisites

### 1. Java Development Kit (JDK)
Required for building Android apps.

**Windows:**
- Download from: https://www.oracle.com/java/technologies/downloads/
- Install JDK 17 or later
- Set `JAVA_HOME` environment variable to JDK installation path

**Verify installation:**
```bash
java -version
javac -version
```

### 2. Android SDK
Required for Cordova to build the APK.

**Option A: Install Android Studio** (Easiest)
- Download: https://developer.android.com/studio
- Install Android Studio
- SDK and tools will be included
- Note the SDK location (usually `C:\Users\YourName\AppData\Local\Android\Sdk`)

**Option B: Install Command Line Tools**
- Download from: https://developer.android.com/tools/releases/cmdline-tools
- Extract and set `ANDROID_SDK_ROOT` environment variable

**Verify:**
```bash
echo %ANDROID_SDK_ROOT%
```

### 3. Gradle
Usually included with Android SDK. Verify:
```bash
gradle -v
```

## Build Steps

### Quick Build (Windows)
Simply run:
```bash
build-apk.bat
```

### Manual Build

1. **Build the frontend:**
```bash
cd frontend
npm run build
cd ..
```

2. **Copy frontend to Cordova:**
```bash
xcopy /E /I frontend\dist android\www
```

3. **Build APK:**
```bash
cd android
cordova build android --release
cd ..
```

## Output

Unsigned APK location:
```
android/platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## Signing the APK (Required for Play Store)

### Using Android Studio (Easiest)
1. Open Android Studio
2. Select **Build** → **Generate Signed Bundle / APK**
3. Follow the wizard
4. Choose **APK** option
5. Select your keystore or create a new one
6. Complete the signing process

### Using Command Line

1. **Create a keystore** (first time only):
```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

2. **Sign the APK:**
```bash
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 ^
  -keystore my-release-key.jks ^
  android\platforms\android\app\build\outputs\apk\release\app-release-unsigned.apk ^
  my-key-alias
```

3. **Optimize the APK:**
```bash
zipalign -v 4 android\platforms\android\app\build\outputs\apk\release\app-release-unsigned.apk ^
  app-release-signed.apk
```

The final APK will be `app-release-signed.apk`

## Troubleshooting

### "ANDROID_SDK_ROOT not set"
Set environment variable:
```bash
set ANDROID_SDK_ROOT=C:\Users\YourName\AppData\Local\Android\Sdk
```

### "Could not find gradle"
Android SDK might not be installed properly. Download and install Android Studio.

### Build fails with gradle errors
Try cleaning:
```bash
cd android
cordova clean android
cordova build android --release
cd ..
```

### Frontend changes not in APK
Make sure to rebuild frontend and copy to www:
```bash
cd frontend
npm run build
cd ..
xcopy /E /I frontend\dist android\www
```

## After Build

**Unsigned APK** (for testing):
- Can be installed on dev devices
- Cannot be published to Play Store

**Signed APK** (for Play Store):
- Required for Google Play Store
- Keep keystore file safe!
- Can be used for future updates

## Testing

To install APK on a device/emulator:
```bash
adb install app-release-signed.apk
```

Or use Android Studio's Device Manager to install.

## Key Files
- `build-apk.bat` - Windows build script
- `build-apk.sh` - Linux/Mac build script  
- `android/` - Cordova project directory
- `android/config.xml` - App configuration

## Support

For issues with Cordova: https://cordova.apache.org/
For Android SDK: https://developer.android.com/
