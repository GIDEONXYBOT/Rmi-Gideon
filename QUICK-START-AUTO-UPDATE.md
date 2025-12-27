# 🚀 Auto-Update System - QUICK START

## What You Got

Your RMI Teller Report app now has a **complete auto-update system**. Users can:
- 📱 See notifications when updates are available
- ⬇️ Download APK with one click
- 🔄 Get updates without Play Store
- 🤖 Automatically check GitHub every hour

---

## TL;DR (If you're in a hurry)

### 3 Things To Do Now:

**1️⃣ Create Keystore (5 min)**
```powershell
# Copy-paste in PowerShell:
$KEYTOOL = "C:\Program Files\Java\jdk-17\bin\keytool.exe"
& $KEYTOOL -genkey -v -keystore signing-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release-key -storetype JKS

# When prompted, enter passwords and info (can skip most)
```

**2️⃣ Add GitHub Secrets (5 min)**
- Go: https://github.com/GIDEONXYBOT/Rmi-Gideon/settings/secrets/actions
- Add 4 new secrets:
  - `KEYSTORE_BASE64` → Copy output of:
    ```powershell
    [Convert]::ToBase64String([IO.File]::ReadAllBytes("signing-key.jks")) | Set-Clipboard
    ```
  - `KEYSTORE_PASSWORD` → Your keystore password
  - `KEY_ALIAS` → `release-key`
  - `KEY_PASSWORD` → Your key password

**3️⃣ Create First Release (2 min)**
```bash
git tag -a v1.0.0 -m "Initial APK Release"
git push origin v1.0.0
```

Then **wait 5-10 minutes** and check:
- GitHub → Actions tab (watch build)
- GitHub → Releases tab (see APK)

### That's it! 🎉

---

## How It Works (Simple Version)

### For Users
1. User opens app
2. App checks GitHub for new versions (every 1 hour)
3. If new version: notification appears
4. User clicks "Download" → APK downloads
5. User opens APK → app updates
✓ Done!

### For You (Developer)
1. Make code changes
2. Update version number (in 4 files)
3. `git tag v1.0.1 && git push --tags`
4. GitHub Actions automatically builds APK
5. Users get notification about v1.0.1
✓ Done!

---

## Files Changed

| What | File | Change |
|------|------|--------|
| 🆕 Version Checker | `frontend/src/services/updateService.js` | New file (175 lines) |
| 🆕 Update UI | `frontend/src/components/UpdateNotification.jsx` | New file (90 lines) |
| 🆕 Auto-Builder | `.github/workflows/build-apk-release.yml` | New file (CI/CD) |
| ⚠️ Main App | `frontend/src/main.jsx` | 2 lines added |
| ⚠️ Package Ver | `frontend/package.json` | Version → 1.0.0 |

---

## Release Checklist (Next Release)

When you want to release v1.0.1:

```markdown
- [ ] Update version in 4 files to 1.0.1:
      - package.json
      - frontend/package.json
      - frontend/src/services/updateService.js (line 22)
      - android/config.xml
- [ ] Commit: git commit -am "Bump to v1.0.1"
- [ ] Tag: git tag -a v1.0.1 -m "Release v1.0.1"
- [ ] Push: git push && git push --tags
- [ ] Wait for build (5-10 min)
- [ ] Verify APK in Releases tab
- [ ] Test on phone
✓ Users get notification automatically
```

---

## Test Update Notification

**To see it in action:**

```javascript
// Open DevTools Console (F12) and paste:
localStorage.removeItem('lastVersionCheck');
location.reload();

// Wait 5 seconds - notification should appear
```

Or manually trigger:
```javascript
// In Console:
import { UpdateService } from './services/updateService.js';
const svc = new UpdateService();
await svc.checkForUpdates(true);
```

---

## Status Check

### ✅ Already Done
- UpdateService created ✓
- UpdateNotification component created ✓
- GitHub Actions workflow created ✓
- Components integrated ✓
- Version numbers synced ✓

### ⏳ Next Steps
1. Create keystore
2. Add GitHub secrets
3. Push v1.0.0 tag
4. Verify build in Actions
5. Test on phone

### 🎯 Your Immediate Action
👉 **Do the "3 Things To Do Now" section above** ☝️

---

## Command Reference

### Create keystore (Windows PowerShell)
```powershell
$KEYTOOL = "C:\Program Files\Java\jdk-17\bin\keytool.exe"
& $KEYTOOL -genkey -v -keystore signing-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release-key -storetype JKS
```

### Encode keystore to base64
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("signing-key.jks")) | Set-Clipboard
# Paste into KEYSTORE_BASE64 secret
```

### Release new version
```bash
# Edit version in 4 files first!
git commit -am "Bump to v1.0.1"
git tag -a v1.0.1 -m "Version 1.0.1"
git push && git push --tags
```

### Check local build
```bash
npm run build:apk
# APK appears in: android/platforms/android/app/build/outputs/apk/release/
```

### Check GitHub Actions
```
https://github.com/GIDEONXYBOT/Rmi-Gideon/actions
# Look for "Build and Release APK" workflow
```

### Check releases
```
https://github.com/GIDEONXYBOT/Rmi-Gideon/releases
# Download APK from here
```

---

## Visual Workflow

```
Developer
├─ Edit code
├─ Update version (1.0.0 → 1.0.1)
├─ git commit
└─ git tag v1.0.1 && git push --tags
   │
   └──→ GitHub Actions
       ├─ Build frontend
       ├─ Build APK
       ├─ Sign APK
       └─ Upload to Releases
          │
          └──→ GitHub Releases
              └─ RMI-Teller-Report.apk (v1.0.1)
                 │
                 └──→ User's App
                     ├─ Checks GitHub every 1 hour
                     ├─ Finds v1.0.1
                     └─ Shows notification
                        │
                        └──→ User clicks Download
                            ├─ APK downloads
                            ├─ Opens APK
                            └─ App updates to v1.0.1
```

---

## FAQ

**Q: How often does app check?**
A: Every 1 hour (configurable in updateService.js)

**Q: Can users turn off notifications?**
A: Not yet, could be added

**Q: How much data does it use?**
A: ~1KB per check (very minimal)

**Q: What if GitHub is down?**
A: Check fails silently, next check in 1 hour

**Q: Does APK need to be signed?**
A: Yes, workflow does this automatically with your keystore

**Q: Can I test without GitHub?**
A: Yes, build locally: `npm run build:apk`

**Q: How long is APK?**
A: ~50MB (depends on your code)

**Q: What if I forgot to update a version file?**
A: UpdateService might show wrong version, but build still works

---

## Troubleshooting

### GitHub Actions build failed
→ Check Actions logs for specific error
→ Verify KEYSTORE_BASE64 secret is set
→ Try local build: `npm run build:apk`

### Update notification not showing
→ Clear localStorage: `localStorage.clear()`
→ Refresh app
→ Check browser console for errors

### APK won't install
→ Enable "Unknown sources" in phone settings
→ Try different download method
→ Check phone storage space

### Can't encode keystore
→ Make sure signing-key.jks is in current directory
→ Check file permissions
→ Try: `certutil -encode signing-key.jks keystore.b64`

---

## Full Documentation

For detailed info, see these files:

| File | When to Read |
|------|--------------|
| [FIRST-RELEASE-CHECKLIST.md](FIRST-RELEASE-CHECKLIST.md) | Before first release |
| [GITHUB-RELEASES-SETUP.md](GITHUB-RELEASES-SETUP.md) | Detailed setup help |
| [AUTO-UPDATE-SYSTEM.md](AUTO-UPDATE-SYSTEM.md) | How system works |
| [AUTO-UPDATE-COMPLETE.md](AUTO-UPDATE-COMPLETE.md) | Status & next steps |
| [UPDATE-NOTIFICATION-UI.md](UPDATE-NOTIFICATION-UI.md) | What users see |
| [WHAT-CHANGED-AUTO-UPDATE.md](WHAT-CHANGED-AUTO-UPDATE.md) | What was modified |
| [APK-BUILD-GUIDE.md](APK-BUILD-GUIDE.md) | Build troubleshooting |

---

## Your Next Step

👉 **Do this RIGHT NOW:**

1. Open PowerShell
2. Copy-paste the keystore command (Section 1 above)
3. Wait for it to complete
4. Add GitHub secrets (Section 2)
5. Run release tag command (Section 3)
6. Watch the magic happen! ✨

**Estimated time: 15 minutes**

---

## Summary

✅ Your app has auto-update capability
✅ GitHub Actions builds automatically
✅ Users get notified of new versions
✅ One-click download in app
✅ No Play Store needed

🎉 **You're ready to release!**

---

**Questions?** Check the documentation files above.
**Problems?** Check the Troubleshooting section.
**Ready to go?** Follow the "Your Next Step" section!
