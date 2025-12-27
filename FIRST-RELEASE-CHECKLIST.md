# First Release Checklist (v1.0.0)

Complete this checklist to publish your first APK release.

## Pre-Release Steps

### 1. Create Signing Keystore
- [ ] Open PowerShell (Windows) or Terminal (Mac/Linux)
- [ ] Run keytool command to generate `signing-key.jks`
- [ ] Save keystore password securely
- [ ] Save key alias: `release-key`

**Windows Command:**
```powershell
$KEYTOOL = "C:\Program Files\Java\jdk-17\bin\keytool.exe"
& $KEYTOOL -genkey -v -keystore signing-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release-key -storetype JKS
```

### 2. Add GitHub Secrets
- [ ] Go to GitHub repo Settings
- [ ] Click Secrets and variables → Actions
- [ ] Add `KEYSTORE_BASE64` (base64-encoded keystore file)
- [ ] Add `KEYSTORE_PASSWORD`
- [ ] Add `KEY_ALIAS` (set to: `release-key`)
- [ ] Add `KEY_PASSWORD`

**To encode keystore to base64:**
```powershell
# Windows
[Convert]::ToBase64String([IO.File]::ReadAllBytes("signing-key.jks")) | Set-Clipboard
# Then paste into KEYSTORE_BASE64 secret
```

### 3. Verify Version Numbers
- [ ] Check `package.json` version is 1.0.0
- [ ] Check `frontend/package.json` version is 1.0.0
- [ ] Check `updateService.js` getAppVersion() returns "1.0.0"
- [ ] Check `android/config.xml` version="1.0.0"

**File Locations:**
- `package.json` (root)
- `frontend/package.json`
- `frontend/src/services/updateService.js`
- `android/config.xml`

## Creating the Release

### 4. Commit Version Updates
```bash
git add package.json frontend/package.json frontend/src/services/updateService.js android/config.xml
git commit -m "Prepare v1.0.0 release"
git push
```

### 5. Create Git Tag
```bash
git tag -a v1.0.0 -m "Release v1.0.0 - Initial APK Release"
git push origin v1.0.0
```

### 6. Monitor Build
- [ ] Go to GitHub → Actions tab
- [ ] Look for workflow: "Build APK Release"
- [ ] Wait for build to complete (takes 5-10 minutes)
- [ ] Check for green checkmark ✅

**What the build does:**
1. Builds React frontend (npm run build)
2. Copies to Cordova www folder
3. Builds Android APK
4. Signs with your keystore
5. Uploads to Releases

### 7. Verify Release
- [ ] Go to GitHub → Releases
- [ ] Should see "v1.0.0" release
- [ ] Should have `RMI-Teller-Report.apk` asset
- [ ] Verify APK file size > 30MB

## Testing the Release

### 8. Download & Test APK
- [ ] Download APK from release
- [ ] Transfer to Android phone
- [ ] Install (may need to enable "Unknown Sources")
- [ ] Open app and test core features

### 9. Test Auto-Update Feature
- [ ] Open app
- [ ] Wait for UpdateNotification to load
- [ ] Should show current version (1.0.0)
- [ ] Check browser console: `localStorage.getItem('updateAvailable')`

**Or manually test:**
1. Open browser DevTools Console
2. Paste: `localStorage.setItem('updateAvailable', JSON.stringify({version: '1.0.1', downloadUrl: 'https://...'}))`
3. Refresh app
4. Should show update notification

## Post-Release

### 10. Update Release Notes (Optional)
- [ ] Go to GitHub Releases
- [ ] Click Edit on v1.0.0
- [ ] Add release notes with features/fixes
- [ ] Publish

**Example notes:**
```markdown
## RMI Teller Report v1.0.0

### Features
- ✨ Fight leaderboard with real-time updates
- 🏆 Player rankings and statistics
- 📱 Mobile-optimized interface
- 🔄 Automatic app updates

### What's New
- Initial public release
- Direct APK downloads from GitHub

### Installation
Download `RMI-Teller-Report.apk` and install on Android device.

### Known Issues
None reported yet!
```

### 11. Share Release Link
- [ ] Copy release URL: `https://github.com/GIDEONXYBOT/Rmi-Gideon/releases/tag/v1.0.0`
- [ ] Share in Discord, WhatsApp, etc.
- [ ] Add to website/documentation

**Download link:** 
```
https://github.com/GIDEONXYBOT/Rmi-Gideon/releases/download/v1.0.0/RMI-Teller-Report.apk
```

## Troubleshooting

### Build Failed
- [ ] Check Actions logs for error
- [ ] Verify all GitHub secrets are set
- [ ] Try local build: `npm run build:apk`

### APK Not Uploading
- [ ] Check workflow permissions
- [ ] Verify APK exists in build output
- [ ] Check Actions logs for upload step

### Can't Install on Phone
- [ ] Enable "Unknown sources" in phone Settings
- [ ] Try transferring via USB and installing manually
- [ ] Check APK file isn't corrupted

### Update Notification Not Showing
- [ ] Check localStorage: `localStorage.getItem('lastVersionCheck')`
- [ ] Force check in console: `localStorage.removeItem('lastVersionCheck')`
- [ ] Refresh app and wait 5 seconds

## Success Checklist ✅

- [ ] Git tag created and pushed
- [ ] GitHub Actions build succeeded
- [ ] APK uploaded to release
- [ ] APK downloaded and installed on phone
- [ ] App runs without errors
- [ ] Update notification system works
- [ ] Release notes added
- [ ] Link shared with team

## Next Release (v1.0.1+)

For future releases:

1. Make code changes
2. Update version numbers:
   ```bash
   # Update all version files
   # package.json, frontend/package.json, updateService.js, config.xml
   ```
3. Commit: `git commit -am "Bump to v1.0.1"`
4. Tag: `git tag v1.0.1 && git push --tags`
5. Done! APK auto-builds and uploads

---

**Need help?**
- Check `GITHUB-RELEASES-SETUP.md` for detailed instructions
- Review `APK-BUILD-GUIDE.md` for build troubleshooting
- Check GitHub Actions logs for build errors
