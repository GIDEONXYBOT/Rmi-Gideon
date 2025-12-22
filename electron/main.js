const { app, BrowserWindow, ipcMain, dialog } = require('electron');
let autoUpdater = null;
try {
  const updater = require('electron-updater');
  autoUpdater = updater.autoUpdater;
} catch (err) {
  console.warn('electron-updater not available, auto-updates disabled');
}
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV !== 'production';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 940,
    minHeight: 680,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath, { hash: 'admin/dashboard' });
  } else {
    mainWindow.loadURL('https://rmi.gideonbot.xyz/#/admin/dashboard');
  }
};

const printHtml = async (html, selectedPrinter) => {
  const printWindow = new BrowserWindow({
    width: 340,
    height: 660,
    show: false
  });

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  return new Promise((resolve) => {
    // Get available printers
    printWindow.webContents.getPrinters().then((printers) => {
      console.log('📱 Available printers:', printers.map(p => p.name));
      
      let deviceName = '';
      
      // Use selected printer if provided
      if (selectedPrinter && selectedPrinter.name) {
        deviceName = selectedPrinter.name;
        console.log(`🖨️  Using selected printer: ${deviceName}`);
      } else {
        // Try to find 58mm thermal printer (common names: "58mm", "Thermal", "Receipt")
        let thermalPrinter = printers.find(p => 
          p.name.toLowerCase().includes('58') || 
          p.name.toLowerCase().includes('thermal') || 
          p.name.toLowerCase().includes('receipt') ||
          p.name.toLowerCase().includes('tsc') ||
          p.name.toLowerCase().includes('xprinter')
        );
        
        // Fallback: use default printer if available
        if (!thermalPrinter) {
          console.warn('⚠️  No 58mm thermal printer found, using default printer');
          thermalPrinter = printers.find(p => p.isDefault);
        }
        
        deviceName = thermalPrinter?.name || '';
        console.log(`🖨️  Printing to: ${deviceName || '(default printer)'}`);
      }

      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: deviceName,
          pageSize: 'A6' // 58mm width approximation
        },
        (success, failureReason) => {
          if (success) {
            console.log('✅ Print sent to thermal printer');
          } else {
            console.error('❌ Print failed:', failureReason);
          }
          printWindow.close();
          resolve({ success, failureReason });
        }
      );
    }).catch(err => {
      console.error('Error getting printers:', err);
      // Fallback: just try to print anyway
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: ''
        },
        (success, failureReason) => {
          printWindow.close();
          resolve({ success, failureReason });
        }
      );
    });
  });
};

const getAvailablePrinters = async () => {
  const printWindow = new BrowserWindow({
    width: 300,
    height: 300,
    show: false
  });

  try {
    await printWindow.loadURL('about:blank');
    const printers = await printWindow.webContents.getPrinters();
    printWindow.close();
    
    console.log('📱 Retrieved printers:', printers.map(p => ({ name: p.name, isDefault: p.isDefault })));
    return printers;
  } catch (err) {
    console.error('Error getting printers:', err);
    printWindow.close();
    return [];
  }
};

ipcMain.handle('print-html', async (_, html, selectedPrinter) => {
  return printHtml(html, selectedPrinter);
});

ipcMain.handle('get-printers', async () => {
  return getAvailablePrinters();
});

// Configure auto-updater (only if available)
if (autoUpdater && !isDev) {
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'A new version of RMI Teller Report is available.',
      detail: 'The app will download and install the update automatically.',
      buttons: ['OK']
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The app will restart to apply the changes.',
      buttons: ['Restart Now', 'Later']
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
