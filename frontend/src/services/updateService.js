/**
 * Update Check Service
 * Checks GitHub releases for new app versions
 */

const VERSION_CHECK_INTERVAL = 60 * 60 * 1000; // Check every 1 hour
const GITHUB_API = 'https://api.github.com/repos/GIDEONXYBOT/Rmi-Gideon/releases/latest';

export class UpdateService {
  constructor() {
    this.currentVersion = this.getAppVersion();
    this.lastCheckTime = localStorage.getItem('lastVersionCheck') ? parseInt(localStorage.getItem('lastVersionCheck')) : 0;
    this.updateAvailable = false;
    this.latestVersion = null;
    this.downloadUrl = null;
  }

  /**
   * Get current app version from package.json
   */
  getAppVersion() {
    return '1.0.0'; // This should match your package.json version
  }

  /**
   * Compare version strings (e.g., "1.0.0" vs "1.1.0")
   */
  isNewerVersion(latestVersion) {
    const current = this.currentVersion.split('.').map(Number);
    const latest = latestVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(current.length, latest.length); i++) {
      const curr = current[i] || 0;
      const lat = latest[i] || 0;
      
      if (lat > curr) return true;
      if (curr > lat) return false;
    }
    
    return false;
  }

  /**
   * Check for updates from GitHub releases
   */
  async checkForUpdates(forceCheck = false) {
    const now = Date.now();
    
    // Skip if checked recently (unless forced)
    if (!forceCheck && (now - this.lastCheckTime) < VERSION_CHECK_INTERVAL) {
      console.log('ℹ️ Update check skipped - recently checked');
      return this.updateAvailable;
    }

    try {
      console.log('🔍 Checking for app updates...');
      
      const response = await fetch(GITHUB_API, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();
      
      // Extract version from tag (e.g., "v1.0.1" -> "1.0.1")
      const tagVersion = release.tag_name.replace(/^v/, '');
      
      console.log(`📦 Current version: ${this.currentVersion}`);
      console.log(`📦 Latest version: ${tagVersion}`);

      // Check if newer version available
      if (this.isNewerVersion(tagVersion)) {
        console.log('✅ Update available!');
        
        this.updateAvailable = true;
        this.latestVersion = tagVersion;
        
        // Find APK asset in release
        const apkAsset = release.assets.find(asset => 
          asset.name.endsWith('.apk')
        );
        
        if (apkAsset) {
          this.downloadUrl = apkAsset.browser_download_url;
          console.log('📥 Download URL:', this.downloadUrl);
          
          // Store update info
          localStorage.setItem('updateAvailable', 'true');
          localStorage.setItem('latestVersion', tagVersion);
          localStorage.setItem('downloadUrl', this.downloadUrl);
        }
      } else {
        console.log('✅ App is up to date');
        this.updateAvailable = false;
        localStorage.removeItem('updateAvailable');
      }

      // Update last check time
      localStorage.setItem('lastVersionCheck', now.toString());
      this.lastCheckTime = now;

      return this.updateAvailable;

    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      return this.updateAvailable;
    }
  }

  /**
   * Get update notification
   */
  getUpdateNotification() {
    if (!this.updateAvailable || !this.latestVersion) {
      return null;
    }

    return {
      title: 'App Update Available',
      message: `Version ${this.latestVersion} is available. Update now to get the latest features!`,
      version: this.latestVersion,
      downloadUrl: this.downloadUrl
    };
  }

  /**
   * Download update (for Android)
   */
  async downloadUpdate() {
    if (!this.downloadUrl) {
      throw new Error('No download URL available');
    }

    try {
      console.log('📥 Starting download:', this.downloadUrl);
      
      // For web: Open download link
      if (typeof window !== 'undefined') {
        const a = document.createElement('a');
        a.href = this.downloadUrl;
        a.download = `RMI-TellerReport-${this.latestVersion}.apk`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        console.log('✅ Download started');
        return true;
      }
    } catch (error) {
      console.error('❌ Error downloading update:', error);
      throw error;
    }
  }

  /**
   * Clear stored update info
   */
  clearUpdate() {
    localStorage.removeItem('updateAvailable');
    localStorage.removeItem('latestVersion');
    localStorage.removeItem('downloadUrl');
    this.updateAvailable = false;
    this.latestVersion = null;
    this.downloadUrl = null;
  }
}

// Export singleton instance
export const updateService = new UpdateService();
