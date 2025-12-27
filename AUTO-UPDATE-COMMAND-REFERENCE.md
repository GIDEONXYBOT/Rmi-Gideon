# 🔧 Auto-Update System - Command Reference

## Quick Command Guide

Copy-paste these commands to get started.

---

## Step 1: Create Signing Keystore (5 minutes)

### Windows (PowerShell as Administrator)

```powershell
# Open PowerShell and run:
$KEYTOOL = "C:\Program Files\Java\jdk-17\bin\keytool.exe"
& $KEYTOOL -genkey -v -keystore signing-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release-key -storetype JKS
```

**When prompted, enter:**
```
Enter keystore password: [your password - remember this!]
Re-enter new password: [same password]
What is your first and last name? John Doe (or your name)
What is the name of your organizational unit? Development
What is the name of your organization? RMI (or your company)
What is the name of your City or Locality? Your City
What is the name of your State or Province? Your State
What is the two-letter country code? US
Is CN=John Doe, OU=Development, O=RMI, L=Your City, ST=Your State, C=US correct? yes
Enter key password for <release-key>: [same password as keystore]
Re-enter new password: [same password]
```

**Result:** `signing-key.jks` file created in current directory

### macOS/Linux (Terminal)

```bash
keytool -genkey -v -keystore signing-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias release-key \
  -storetype JKS
```

---

## Step 2: Encode Keystore to Base64 (2 minutes)

### Windows (PowerShell)

```powershell
# Make sure signing-key.jks is in current directory
# Then run:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("signing-key.jks")) | Set-Clipboard

# Output is now copied to clipboard
# Go to GitHub and paste it in KEYSTORE_BASE64 secret
```

### macOS

```bash
cat signing-key.jks | base64 | pbcopy
# Output copied to clipboard
```

### Linux

```bash
cat signing-key.jks | base64
# Copy the output manually
```

---

## Step 3: Add GitHub Repository Secrets (5 minutes)

### Web UI Method (Easiest)

1. Go to: https://github.com/GIDEONXYBOT/Rmi-Gideon/settings/secrets/actions

2. Click "New repository secret" button 4 times and add:

**Secret 1: KEYSTORE_BASE64**
- Name: `KEYSTORE_BASE64`
- Value: [Paste the base64 output from Step 2]
- Click "Add secret"

**Secret 2: KEYSTORE_PASSWORD**
- Name: `KEYSTORE_PASSWORD`
- Value: [Your keystore password from Step 1]
- Click "Add secret"

**Secret 3: KEY_ALIAS**
- Name: `KEY_ALIAS`
- Value: `release-key`
- Click "Add secret"

**Secret 4: KEY_PASSWORD**
- Name: `KEY_PASSWORD`
- Value: [Your key password from Step 1]
- Click "Add secret"

### Using GitHub CLI (Alternative)

```bash
gh secret set KEYSTORE_BASE64 --body "$(cat signing-key.jks | base64)"
gh secret set KEYSTORE_PASSWORD --body "your-password"
gh secret set KEY_ALIAS --body "release-key"
gh secret set KEY_PASSWORD --body "your-password"
```

---

## Step 4: Create First Release Tag (2 minutes)

### Using Git Commands

```bash
# Go to your project directory
cd c:\Users\Gideon\OneDrive\Desktop\rmi-teller-report

# Create tag
git tag -a v1.0.0 -m "Initial APK Release - Auto-update system enabled"

# Push tag to GitHub
git push origin v1.0.0
```

### Verify Tag Was Pushed

```bash
# List all tags
git tag -l

# Should show: v1.0.0
```

---

## Step 5: Monitor Build (5-10 minutes)

### Check GitHub Actions Status

```bash
# Open browser to your Actions tab
# https://github.com/GIDEONXYBOT/Rmi-Gideon/actions

# Look for "Build and Release APK" workflow
# Watch for green checkmark ✅
```

### Using GitHub CLI

```bash
# Check workflow status
gh run list --workflow build-apk-release.yml

# View specific run
gh run view [run-id]

# Stream logs
gh run view [run-id] --log
```

---

## Step 6: Verify Release (2 minutes)

### Check GitHub Releases

```bash
# Open browser
# https://github.com/GIDEONXYBOT/Rmi-Gideon/releases

# Should see: v1.0.0 with RMI-Teller-Report.apk attached
```

### Using GitHub CLI

```bash
# List releases
gh release list

# View specific release
gh release view v1.0.0

# Download APK
gh release download v1.0.0 --pattern "*.apk"
```

---

## Future Releases (v1.0.1+)

### Quick Release Process

```bash
# 1. Edit 4 version files (change 1.0.0 → 1.0.1):
#    - package.json
#    - frontend/package.json
#    - frontend/src/services/updateService.js (line 22)
#    - android/config.xml

# 2. Commit
git add package.json frontend/package.json frontend/src/services/updateService.js android/config.xml
git commit -m "Bump to v1.0.1"

# 3. Tag
git tag -a v1.0.1 -m "Release v1.0.1"

# 4. Push (everything auto-builds)
git push && git push --tags

# Done! APK auto-builds in 5-10 minutes
```

---

## Testing Commands

### Test Local Build

```bash
# Build APK locally
npm run build:apk

# APK location:
# c:\Users\Gideon\OneDrive\Desktop\rmi-teller-report\android\platforms\android\app\build\outputs\apk\release\
```

### Test Update Notification (Browser)

```javascript
// Open DevTools Console (F12) and paste:

// Clear cache and reload
localStorage.removeItem('lastVersionCheck');
location.reload();

// Wait 5 seconds - notification should appear

// Or manually set update available:
localStorage.setItem('updateAvailable', JSON.stringify({
  version: '1.0.1',
  downloadUrl: 'https://github.com/GIDEONXYBOT/Rmi-Gideon/releases/download/v1.0.1/RMI-Teller-Report.apk',
  message: 'New version available!'
}));
location.reload();
```

### Check Version Comparison

```javascript
// In DevTools Console:
import { UpdateService } from './services/updateService.js';
const svc = new UpdateService();
console.log(svc.isNewerVersion('1.0.1', '1.0.0')); // Should be true
console.log(svc.isNewerVersion('1.0.0', '1.0.0')); // Should be false
```

### Test API Connection

```javascript
// In DevTools Console:
fetch('https://api.github.com/repos/GIDEONXYBOT/Rmi-Gideon/releases/latest')
  .then(r => r.json())
  .then(d => {
    console.log('Latest:', d.tag_name);
    console.log('URL:', d.assets[0].browser_download_url);
  });
```

---

## Useful Git Commands

### Tag Management

```bash
# List all tags
git tag -l

# Create annotated tag
git tag -a v1.0.1 -m "Release message"

# Create lightweight tag
git tag v1.0.1

# Delete local tag
git tag -d v1.0.1

# Delete remote tag
git push origin --delete v1.0.1

# Rename tag
git tag new-tag old-tag
git tag -d old-tag
git push origin new-tag :old-tag
```

### Push Commands

```bash
# Push all commits
git push

# Push all tags
git push --tags

# Push specific tag
git push origin v1.0.0

# Push everything
git push && git push --tags
```

---

## GitHub CLI Commands

### Installation (if needed)

```bash
# Windows (via Chocolatey)
choco install gh

# Windows (via scoop)
scoop install gh

# macOS
brew install gh

# Linux
curl -fsSLo gh.deb https://github.com/cli/cli/releases/download/v2.0.0/gh_2.0.0_linux_amd64.deb
sudo apt install ./gh.deb
```

### Useful Commands

```bash
# Login
gh auth login

# List releases
gh release list

# View release
gh release view v1.0.0

# Download release
gh release download v1.0.0

# Create release
gh release create v1.0.1 RMI-Teller-Report.apk --title "Version 1.0.1"

# Upload asset to release
gh release upload v1.0.1 RMI-Teller-Report.apk

# Delete release
gh release delete v1.0.1 -y
```

---

## Quick Reference Table

| Task | Command | Time |
|------|---------|------|
| Create keystore | `keytool -genkey...` | 5 min |
| Encode keystore | `[Convert]::ToBase64String...` | 1 min |
| Add secrets | GitHub web UI | 3 min |
| Create tag | `git tag -a v1.0.0...` | 1 min |
| Push tag | `git push origin v1.0.0` | 1 min |
| Wait for build | Monitor Actions | 5-10 min |
| Verify release | GitHub Releases tab | 1 min |
| **Total** | | **~17 min** |

---

## Troubleshooting Commands

### Check Java Installation

```bash
# Find Java
where java

# Check version
java -version
```

### Check Android SDK

```bash
# Check Android SDK path
echo %ANDROID_SDK_ROOT%

# Or set it
setx ANDROID_SDK_ROOT "C:\Users\%USERNAME%\AppData\Local\Android\Sdk"
```

### Check Cordova

```bash
# Install Cordova
npm install -g cordova

# Check version
cordova --version
```

### Test Git

```bash
# Check Git config
git config --list

# Check remote
git remote -v

# Verify tag exists locally
git tag -l | grep v1.0.0
```

---

## Environment Variables (if needed)

### Windows (PowerShell)

```powershell
# Check ANDROID_SDK_ROOT
$env:ANDROID_SDK_ROOT

# Set ANDROID_SDK_ROOT
$env:ANDROID_SDK_ROOT = "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"

# Make permanent
[System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk", "User")
```

### macOS/Linux

```bash
# Check ANDROID_SDK_ROOT
echo $ANDROID_SDK_ROOT

# Set temporarily
export ANDROID_SDK_ROOT=~/Android/Sdk

# Make permanent (add to ~/.bash_profile or ~/.zshrc)
echo 'export ANDROID_SDK_ROOT=$HOME/Android/Sdk' >> ~/.bash_profile
source ~/.bash_profile
```

---

## Emergency Commands

### Recover from Failed Build

```bash
# Clean and rebuild
rm -rf android/platforms/android/app/build
npm run build:apk
```

### Reset to Last Known Good

```bash
# Check Git status
git status

# Reset to last commit
git reset --hard HEAD

# Or reset to specific commit
git reset --hard [commit-hash]
```

### Restore Keystore

```bash
# If keystore is lost, generate new one
# See Step 1 above

# Then update GitHub secrets with new KEYSTORE_BASE64
```

---

## Performance Tuning

### Faster Builds

```bash
# Use Gradle daemon
gradlew build --parallel

# Cache dependencies
npm install --prefer-offline
```

### Clear Cache

```bash
# Clear npm cache
npm cache clean --force

# Clear Gradle cache
gradlew clean

# Clear build
rm -rf android/platforms/android/app/build
```

---

## Documentation Links

| Command | Docs |
|---------|------|
| keytool | https://docs.oracle.com/en/java/javase/17/docs/specs/man/keytool.html |
| git | https://git-scm.com/docs |
| GitHub Actions | https://docs.github.com/en/actions |
| Cordova | https://cordova.apache.org/docs/en/latest/ |
| Android | https://developer.android.com/docs |

---

## Summary

### Complete Setup in 3 Commands

```powershell
# Command 1: Create keystore
$KEYTOOL = "C:\Program Files\Java\jdk-17\bin\keytool.exe"
& $KEYTOOL -genkey -v -keystore signing-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release-key -storetype JKS

# [Then add secrets in GitHub web UI]

# Command 2: Create tag
git tag -a v1.0.0 -m "Initial APK Release"

# Command 3: Push tag
git push origin v1.0.0

# [Done! APK auto-builds in 5-10 minutes]
```

---

## Next Action

👉 **Copy the commands above and run them in order!**

**Start with:** Step 1 - Create Signing Keystore

Expected total time: **~30 minutes to complete setup and test**
