# GitHub Releases & Auto-Update Setup Guide

## Overview
This guide sets up:
1. **Automated APK builds** - GitHub Actions automatically builds APK on every tag
2. **Auto-update notifications** - App checks for updates and notifies users
3. **Direct downloads** - Users can download APK directly from GitHub releases

## Step 1: Create Signing Keystore

### Windows (PowerShell):
```powershell
$KEYTOOL = "C:\Program Files\Java\jdk-17\bin\keytool.exe"

& $KEYTOOL -genkey -v -keystore signing-key.jks `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -alias release-key `
  -storetype JKS

# When prompted, enter:
# - Password for keystore
# - Same password for key
# - Your name, organization, etc.
```

### macOS/Linux:
```bash
keytool -genkey -v -keystore signing-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias release-key \
  -storetype JKS
```

**Save these values:**
- Keystore path: `signing-key.jks`
- Keystore password: `[your password]`
- Key alias: `release-key`
- Key password: `[your password]`

## Step 2: Add Secrets to GitHub

1. Go to your GitHub repo: https://github.com/GIDEONXYBOT/Rmi-Gideon
2. Settings → Secrets and variables → Actions
3. Click "New repository secret" and add:

**Create each secret:**

### KEYSTORE_BASE64
Encode your keystore file to base64:

**Windows:**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("signing-key.jks")) | Set-Clipboard
```

**macOS/Linux:**
```bash
cat signing-key.jks | base64 | pbcopy  # macOS
cat signing-key.jks | base64          # Linux (copy output)
```

Then paste into GitHub secret.

### KEYSTORE_PASSWORD
Your keystore password

### KEY_ALIAS
`release-key` (from step 1)

### KEY_PASSWORD
Your key password

## Step 3: Create a Release

The workflow triggers on tags. To create a release:

```bash
# Bump version in frontend/package.json and main.jsx
# Then tag and push:
git tag -a v1.0.1 -m "Version 1.0.1 - Bug fixes"
git push origin v1.0.1
```

Or use GitHub UI:
1. Go to Releases
2. Click "Create a new release"
3. Tag: `v1.0.1`
4. Title: `RMI Teller Report v1.0.1`
5. Publish

## Step 4: GitHub Actions Workflow

The workflow file (`.github/workflows/build-apk-release.yml`) will:
1. ✅ Check out code
2. ✅ Set up Java & Android SDK
3. ✅ Build frontend
4. ✅ Copy to Cordova
5. ✅ Build APK
6. ✅ Sign APK with your keystore
7. ✅ Upload to GitHub Releases

**Status:** Check Actions tab to see build progress

## Step 5: Auto-Update in App

The app automatically:
- ✅ Checks GitHub releases every 1 hour
- ✅ Compares versions
- ✅ Shows notification when update available
- ✅ User can download directly

**Update notification shows:**
- 🚀 "App Update Available"
- Version number
- "Download Update" button
- "Later" button to dismiss

## How Users Get Updates

### Option 1: In-App (Easiest)
- App shows notification
- User clicks "Download Update"
- APK downloads automatically
- User opens file and installs

### Option 2: Direct from GitHub
- Go to releases: https://github.com/GIDEONXYBOT/Rmi-Gideon/releases
- Download latest `.apk` file
- Install on phone

### Option 3: From Website
Add download button to your web app:
```html
<a href="https://github.com/GIDEONXYBOT/Rmi-Gideon/releases/latest">
  📱 Download Mobile App
</a>
```

## Version Management

Keep versions in sync:

1. **package.json** (root):
```json
{
  "version": "1.0.1"
}
```

2. **frontend/package.json**:
```json
{
  "version": "1.0.1"
}
```

3. **updateService.js** - Update `getAppVersion()`:
```javascript
getAppVersion() {
  return '1.0.1';
}
```

4. **android/config.xml** - Update version:
```xml
<widget id="com.rmi.tellerreport" version="1.0.1">
```

## Release Workflow

**Every time you want to release:**

1. Update all version files to new version
2. Commit: `git commit -am "Bump to v1.0.1"`
3. Tag: `git tag -a v1.0.1 -m "Release v1.0.1"`
4. Push: `git push && git push --tags`
5. GitHub Actions automatically builds and uploads APK
6. Check Actions tab for build status
7. Release appears in Releases tab

## Testing Auto-Update

**To test the update notification locally:**

1. Change version in `updateService.js` to lower version (e.g., "0.9.0")
2. Build frontend: `npm run build`
3. Open app in browser
4. Check browser console - should see update notification
5. Click "Download Update" to test download

## Troubleshooting

### Build fails with "KEYSTORE not found"
- Check secrets are set correctly in GitHub
- Verify KEYSTORE_BASE64 is properly encoded
- Test locally: `keytool -list -v -keystore signing-key.jks`

### APK not uploading to release
- Check GitHub token has "repo" and "workflow" permissions
- Verify APK file path in workflow
- Check Actions logs for errors

### Update notification not showing
- Check browser console for errors
- Verify GitHub API is accessible
- Check localStorage for `lastVersionCheck`
- Try force check: `updateService.checkForUpdates(true)`

### Can't download APK on phone
- Verify APK is uploaded to release
- Check file is named correctly (`.apk` extension)
- Try downloading via GitHub web interface first

## Security Notes

⚠️ **Keep your keystore safe!**
- Don't commit `signing-key.jks` to git
- Don't share it publicly
- Store backup in secure location
- If compromised, regenerate and update GitHub secrets

✅ **Best practices:**
- Use GitHub Secrets (never put passwords in code)
- Keep keystore password strong
- Rotate keys periodically
- Use separate keys for testing vs production

## Useful Commands

```bash
# Test local build
npm run build:apk

# List keystore info
keytool -list -v -keystore signing-key.jks

# Check signed APK
jarsigner -verify -verbose app-release-signed.apk

# View release info (GitHub CLI)
gh release view v1.0.1

# Delete a release (GitHub CLI)
gh release delete v1.0.1 -y
```

## Next Steps

1. ✅ Create keystore file
2. ✅ Add GitHub secrets
3. ✅ Make a test release (v0.1.0)
4. ✅ Verify APK builds and uploads
5. ✅ Test auto-update notification
6. ✅ Announce to users!

For help: Check GitHub Actions logs or GitHub Issues
