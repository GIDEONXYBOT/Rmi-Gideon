# Auto-Update System Guide

## How It Works

Your app now has a complete auto-update system with three components:

### 1. **UpdateService** (`frontend/src/services/updateService.js`)
Service that checks GitHub for new versions and manages update state.

**Key features:**
- Checks GitHub Releases API every 1 hour (configurable)
- Uses semantic versioning to compare versions (1.0.0 vs 1.0.1)
- Stores update info in browser localStorage for persistence
- Detects new APK downloads
- Manages download state and progress

**Versions checked against:**
- Current: 1.0.0 (defined in getAppVersion())
- Latest: Fetched from https://api.github.com/repos/GIDEONXYBOT/Rmi-Gideon/releases/latest

**Storage keys:**
- `lastVersionCheck` - Timestamp of last version check
- `updateAvailable` - JSON object with update info when new version found

### 2. **UpdateNotification** (`frontend/src/components/UpdateNotification.jsx`)
React component that displays the update UI to users.

**Features:**
- Auto-loads UpdateService on mount
- Checks for updates immediately on app load
- Re-checks every 1 hour automatically
- Shows notification when update available
- Displays version number and message
- Download button initiates APK download
- Later button dismisses notification
- Styled notification at bottom-right of screen

**User flow:**
1. App loads → UpdateNotification component mounts
2. UpdateService checks GitHub API
3. If new version: notification appears
4. User clicks "Download Update" → APK downloads
5. User opens APK → prompted to install
6. Update complete!

### 3. **Integration** in `frontend/src/main.jsx`
UpdateNotification added to main app component render tree.

**Location:** Placed after `<UpdateStatus />` component so it's always available globally.

---

## Release Process (For You)

### Making a New Release

When you want to release a new version (e.g., 1.0.1):

**Step 1: Update Version Numbers**
```bash
# Update these 4 files to new version (1.0.1):
# - package.json
# - frontend/package.json  
# - frontend/src/services/updateService.js (getAppVersion return value)
# - android/config.xml
```

**Step 2: Commit & Tag**
```bash
git add package.json frontend/package.json frontend/src/services/updateService.js android/config.xml
git commit -m "Bump version to 1.0.1"

git tag -a v1.0.1 -m "Release v1.0.1"
git push
git push --tags
```

**Step 3: Automated Process**
✅ GitHub Actions automatically:
1. Detects tag v1.0.1
2. Builds React frontend
3. Builds Android APK
4. Signs APK with keystore
5. Uploads to GitHub Releases
6. Creates release entry

**Result:** APK available at:
`https://github.com/GIDEONXYBOT/Rmi-Gideon/releases/download/v1.0.1/RMI-Teller-Report.apk`

---

## User Experience

### For App Users

**Scenario 1: App is Open (Active)**
- App checks for updates every 1 hour
- If new version available:
  - "App Update Available" notification appears
  - Shows new version: "1.0.1"
  - User can click "Download Update"
  - APK downloads to phone (or directly opens installer)
  - User confirms installation
  - New version replaces old version

**Scenario 2: App is Closed (Not Running)**
- No automatic updates (web app, not background service)
- Next time user opens app:
  - App checks immediately for updates
  - Shows notification if new version available
  - User can download and update

**Scenario 3: Manual Check**
- Open browser DevTools Console
- Run: `updateService.checkForUpdates(true)`
- Forces immediate check regardless of interval

---

## Version Comparison Logic

UpdateService uses **semantic versioning:**

```javascript
// Examples of version comparisons:
1.0.0 < 1.0.1  ✅ Update needed
1.0.0 < 1.1.0  ✅ Update needed
1.0.0 < 2.0.0  ✅ Update needed
1.0.1 > 1.0.0  ✅ Update available
1.0.0 = 1.0.0  ❌ No update needed
```

**Algorithm:**
1. Split both versions by '.'
2. Compare major.minor.patch as numbers (not strings)
3. If remote > current → update available

---

## Configuration

### Check Interval
**Edit:** `frontend/src/services/updateService.js`

```javascript
// Line 5
const VERSION_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
// Change to:
const VERSION_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
```

### GitHub Repository
**Edit:** `frontend/src/services/updateService.js`

```javascript
// Line 6
const GITHUB_API = 'https://api.github.com/repos/GIDEONXYBOT/Rmi-Gideon/releases/latest';
// Change if you fork or rename repo:
const GITHUB_API = 'https://api.github.com/repos/YOUR-USERNAME/YOUR-REPO/releases/latest';
```

### Current Version
**Edit:** `frontend/src/services/updateService.js`

```javascript
// Line 22
getAppVersion() {
  return '1.0.0'; // Update this to match package.json version
}
```

---

## Testing Auto-Update

### Test 1: Check Update Detection
```javascript
// In browser DevTools Console:
import { UpdateService } from './services/updateService.js';
const svc = new UpdateService();
await svc.checkForUpdates(true);
console.log(svc.latestVersion);    // Should show latest release
console.log(svc.updateAvailable);  // true or false
console.log(svc.downloadUrl);      // APK download URL
```

### Test 2: Simulate Update Available
```javascript
// In browser DevTools Console:
// Set a version as if user has older version
localStorage.setItem('updateAvailable', JSON.stringify({
  version: '1.0.1',
  downloadUrl: 'https://github.com/GIDEONXYBOT/Rmi-Gideon/releases/download/v1.0.1/RMI-Teller-Report.apk',
  message: 'New version available!'
}));
// Refresh page - notification should appear
location.reload();
```

### Test 3: Test Download Function
```javascript
// In browser DevTools Console:
const url = 'https://github.com/GIDEONXYBOT/Rmi-Gideon/releases/download/v1.0.0/RMI-Teller-Report.apk';
const a = document.createElement('a');
a.href = url;
a.download = 'RMI-Teller-Report.apk';
a.click();
// APK should start downloading
```

---

## Troubleshooting

### Update notification not appearing
1. Check browser console for errors
2. Verify GitHub repository is public
3. Try force check:
   ```javascript
   localStorage.removeItem('lastVersionCheck');
   location.reload();
   ```
4. Wait a few seconds after app loads

### Version comparison not working
1. Check version format is correct: X.Y.Z (e.g., 1.0.0)
2. Ensure all files have matching versions
3. Check browser console: `localStorage.getItem('updateAvailable')`

### APK download not starting
1. Check GitHub release exists and has APK asset
2. Verify CORS headers (GitHub should allow it)
3. Try direct link: `https://github.com/.../releases/download/v1.0.0/RMI-Teller-Report.apk`
4. Check Downloads folder on phone/computer

### Release action failing in GitHub
1. Go to GitHub → Actions → Build APK Release
2. Click failed workflow
3. Scroll to failed step
4. Common issues:
   - Missing GitHub secrets (KEYSTORE_BASE64, etc.)
   - Invalid keystore format
   - APK build errors (check step logs)

---

## Next Steps

### Before First Release
1. ✅ Create keystore file (signing-key.jks)
2. ✅ Add GitHub repository secrets
3. ✅ Test locally: `npm run build:apk`
4. ✅ Verify APK is signed

### Release Process
1. Update version numbers to 1.0.0+
2. Git tag: `git tag v1.0.0 && git push --tags`
3. GitHub Actions builds automatically
4. APK appears in Releases within 5-10 minutes
5. Users see notification and can download

### Monitoring Updates
- ✅ Check GitHub Actions for build status
- ✅ Verify APK appears in Releases
- ✅ Test update notification works
- ✅ Share download link with users

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│         RMI Teller Report App (React)           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  main.jsx (Entry Point)                  │  │
│  │  - Renders all components                │  │
│  │  - Includes <UpdateNotification />       │  │
│  └──────────────────────────────────────────┘  │
│                      ▲                          │
│                      │                          │
│  ┌──────────────────────────────────────────┐  │
│  │  UpdateNotification Component            │  │
│  │  - Displays notification UI              │  │
│  │  - Shows version and download button     │  │
│  │  - Calls UpdateService methods           │  │
│  └──────────────────────────────────────────┘  │
│                      ▲                          │
│                      │ uses                     │
│  ┌──────────────────────────────────────────┐  │
│  │  UpdateService                           │  │
│  │  - Checks GitHub API every 1 hour        │  │
│  │  - Compares versions                     │  │
│  │  - Stores update info in localStorage    │  │
│  └──────────────────────────────────────────┘  │
│                      ▲                          │
│                      │ fetches                  │
└──────────────────────┼──────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  GitHub Releases API         │
        │  api.github.com/repos/...    │
        │  /releases/latest            │
        └──────────────────────────────┘
                       ▲
                       │ publishes
        ┌──────────────────────────────┐
        │  GitHub Actions CI/CD        │
        │  (build-apk-release.yml)     │
        │  - Builds on git tags        │
        │  - Signs APK                 │
        │  - Creates release           │
        │  - Uploads APK asset         │
        └──────────────────────────────┘
                       ▲
                       │ triggered by
        ┌──────────────────────────────┐
        │  git tag v1.0.1              │
        │  git push --tags             │
        └──────────────────────────────┘
```

---

## Quick Reference

| Task | Command | Time |
|------|---------|------|
| Create keystore | `keytool -genkey -v -keystore signing-key.jks ...` | 2 min |
| Add GitHub secrets | Manual in web UI | 5 min |
| Release new version | `git tag v1.0.1 && git push --tags` | 1 min |
| Build completes | Automatic via Actions | 5-10 min |
| Users get notification | Automatic via UpdateService | 1-2 hours |
| User downloads APK | Click notification | 2-5 min |

---

## Files Involved

| File | Purpose | Modified |
|------|---------|----------|
| `frontend/src/services/updateService.js` | Version checking logic | ✅ Created |
| `frontend/src/components/UpdateNotification.jsx` | Update UI component | ✅ Created |
| `frontend/src/main.jsx` | App entry point | ✅ Added import + component |
| `.github/workflows/build-apk-release.yml` | GitHub Actions workflow | ✅ Created |
| `android/config.xml` | Android version config | ⏳ Update on release |
| `package.json` | Root version | ⏳ Update on release |
| `frontend/package.json` | Frontend version | ✅ Updated to 1.0.0 |
| `signing-key.jks` | Android signing keystore | ⏳ Create with keytool |

---

**Need help?** Check:
- `GITHUB-RELEASES-SETUP.md` - Setup instructions
- `FIRST-RELEASE-CHECKLIST.md` - Step-by-step release checklist
- `APK-BUILD-GUIDE.md` - Troubleshooting
