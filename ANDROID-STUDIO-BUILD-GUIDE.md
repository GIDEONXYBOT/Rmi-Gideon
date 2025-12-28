# Build APK with Android Studio - Complete Guide

## Overview
Using Android Studio is the easiest way to build, test, and sign the APK. It handles all the complexity for you.

## Prerequisites

### 1. Install Android Studio
- Download: https://developer.android.com/studio
- Install it (default settings are fine)
- Launch Android Studio

### 2. Install Required SDKs
When you first open Android Studio, it will ask to install SDKs:
- Click "Install" and wait for SDK installation to complete
- This installs Android SDK, Gradle, and build tools automatically

### 3. Build the Frontend First
```bash
cd frontend
npm run build
cd ..
```

This creates `frontend/dist` folder with the built app.

## Step-by-Step Build Process

### Step 1: Open the Android Project in Android Studio

1. **Launch Android Studio**
2. Click **File → Open** (or **Open Recent Project**)
3. Navigate to and select the `android/platforms/android` folder
   - Path: `c:\Users\Gideon\OneDrive\Desktop\rmi-teller-report\android\platforms\android`
4. Click **OK** and wait for Gradle to sync (takes 1-2 minutes on first load)
   - You'll see: "Gradle sync in progress..."
   - Wait for it to complete ✅

### Step 2: Copy Frontend Build to Android Project

Before building, copy the frontend dist to the Cordova www folder:

```bash
# In PowerShell/Command Prompt, run:
cd c:\Users\Gideon\OneDrive\Desktop\rmi-teller-report
xcopy /E /I frontend\dist android\www
```

### Step 3: Build the APK

#### Option A: Build Unsigned APK (for testing on your device)

1. In Android Studio, go to **Build → Build Bundle(s) / APK(s) → Build APK**
2. Wait for the build to complete (takes 2-5 minutes)
3. You'll see success message: "APK(s) generated successfully"
4. Unsigned APK location:
   ```
   android/platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk
   ```

#### Option B: Build & Sign APK (for Play Store / Distribution)

1. Go to **Build → Generate Signed Bundle / APK**
2. Choose **APK** option
3. Click **Create new** to create a new keystore:
   - **Key store path**: Browse and create `c:\Users\Gideon\OneDrive\Desktop\rmi-teller-report\signing-key.jks`
   - **Password**: Create a strong password (save it!)
   - **Key alias**: `rmi-key`
   - **Key password**: Same as above
   - **Validity**: 10000 days
   - **Certificate info**: Fill in your details
4. Click **Create** 
5. Select the keystore and enter passwords
6. Click **Next** → Select **release** build variant
7. Click **Finish**
8. Wait for signing to complete
9. Signed APK location:
   ```
   android/platforms/android/app/build/outputs/apk/release/app-release.apk
   ```

### Step 4: Install APK on Your Android Phone

**Option A: Via Android Studio (Connected USB)**
1. Connect Android phone via USB
2. Enable **Developer Mode** on phone:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Back → Developer Options → Enable "USB Debugging"
3. In Android Studio, click **Run 'app'** or **Shift+F10**
4. Select your connected device
5. App will install and launch automatically

**Option B: Via ADB Command Line**
```bash
adb install -r "android\platforms\android\app\build\outputs\apk\release\app-release-unsigned.apk"
```

**Option C: Share the APK file**
1. Locate the APK file at the path shown above
2. Copy it to your phone (USB, email, cloud drive, etc.)
3. On phone, tap the APK file to install
4. Confirm installation

## Troubleshooting

### "Gradle sync failed"
- Close Android Studio
- Delete: `android/platforms/android/.gradle` folder
- Reopen Android Studio and wait for fresh sync

### "SDK not found"
- Go to **File → Settings → Appearance & Behavior → System Settings → Android SDK**
- Click **Edit** next to SDK Location
- Let Android Studio download missing SDKs

### "Build failed: com.android.builder.internal..."
- This usually means missing SDK components
- Go to **Tools → SDK Manager** 
- Install **SDK Platform** for Android 12 or higher
- Install **Build-Tools** version (latest)
- Click **Apply** and **OK**

### APK file not created
- Check the **Build → Analyze APK** menu to see what went wrong
- Check **View → Tool Windows → Build** for error messages

## Quick Repeat Build

For subsequent builds:
1. Copy frontend dist: `xcopy /E /I frontend\dist android\www`
2. In Android Studio: **Build → Generate Signed Bundle / APK** (remembers your keystore)
3. Enter password when prompted
4. Click **Finish**

## Best Practices

✅ **Always test on a real device** before release
✅ **Keep your keystore file safe** (`signing-key.jks`) - you need it for app updates
✅ **Increment version number** in `android/config.xml` for each release
✅ **Test on multiple Android versions** if possible

## Next Steps

After building:
- ✅ Install on phone and test features
- ✅ Test socket.io connection and real-time updates
- ✅ Once working well, you can upload to Google Play Store

---

**Need help?** Check the original `APK-BUILD-GUIDE.md` or feel free to ask!
