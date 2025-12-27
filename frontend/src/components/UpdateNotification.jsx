import React, { useEffect, useState } from 'react';
import { updateService } from '../services/updateService';

export const UpdateNotification = () => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Check for updates when component mounts
    checkForUpdates();

    // Check every hour
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async () => {
    try {
      const hasUpdate = await updateService.checkForUpdates();
      if (hasUpdate) {
        const notification = updateService.getUpdateNotification();
        setUpdateInfo(notification);
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await updateService.downloadUpdate();
      // Close notification after download starts
      setTimeout(() => {
        setShowNotification(false);
        updateService.clearUpdate();
      }, 2000);
    } catch (error) {
      console.error('Error downloading update:', error);
      alert('Failed to download update. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDismiss = () => {
    setShowNotification(false);
  };

  if (!showNotification || !updateInfo) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 max-w-sm z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-blue-900 border border-blue-700 rounded-lg shadow-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-white font-bold flex items-center gap-2">
            <span>🚀</span>
            {updateInfo.title}
          </h3>
          <button
            onClick={handleDismiss}
            className="text-blue-300 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-blue-200 text-sm mb-4">
          {updateInfo.message}
        </p>

        <div className="text-xs text-blue-300 mb-4">
          Version {updateInfo.version} available
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-700 text-white font-medium py-2 px-4 rounded transition"
          >
            {downloading ? '📥 Downloading...' : '📥 Download Update'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white rounded transition"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
