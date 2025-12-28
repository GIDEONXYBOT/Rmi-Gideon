const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
let autoUpdater = null;
let mainWindow = null;  // Global mainWindow variable
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
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 820,
      minWidth: 940,
      minHeight: 680,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        enableRemoteModule: false
      }
    });

    mainWindow.once('ready-to-show', () => {
      console.log('✅ Window ready to show');
      mainWindow.show();
      mainWindow.focus();
      // Open DevTools in development for debugging
      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    });

    // Fallback: force show if ready-to-show doesn't fire within 3 seconds
    const showTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) {
        console.log('⚠️ Forcing window show (ready-to-show timeout)');
        mainWindow.show();
        mainWindow.focus();
      }
    }, 3000);

    // Clear timeout when window is finally shown
    mainWindow.once('show', () => {
      clearTimeout(showTimeout);
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      console.log('Main window closed');
    });

    // Handle any errors during page load
    mainWindow.webContents.on('crashed', () => {
      console.error('❌ App crashed!');
      dialog.showErrorBox('Error', 'Application crashed. Please restart.');
    });

    const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    if (fs.existsSync(distPath)) {
      console.log('📂 Loading from local dist:', distPath);
      mainWindow.loadFile(distPath, { hash: 'admin/dashboard' });
    } else {
      console.log('🌐 Loading from remote URL');
      mainWindow.loadURL('https://rmi.gideonbot.xyz/#/admin/dashboard');
    }

    // Log any errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('❌ Failed to load:', errorCode, errorDescription);
    });

    // Setup updater for this window
    setupUpdater(mainWindow);
  } catch (err) {
    console.error('❌ Error creating window:', err);
    process.exit(1);
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
        // Try to find 58mm thermal printer (common names: "58mm", "Thermal", "Receipt", etc.)
        const thermalKeywords = ['58', 'thermal', 'receipt', 'tsc', 'xprinter', 'deli', 'esc', 'pos', 'label'];
        let thermalPrinter = printers.find(p => 
          thermalKeywords.some(keyword => p.name.toLowerCase().includes(keyword))
        );
        
        // Fallback: use default printer if available
        if (!thermalPrinter) {
          console.warn('⚠️  No thermal printer found, using default printer');
          thermalPrinter = printers.find(p => p.isDefault);
        }
        
        // Last resort: use first printer
        if (!thermalPrinter && printers.length > 0) {
          console.warn('⚠️  Using first available printer');
          thermalPrinter = printers[0];
        }
        
        deviceName = thermalPrinter?.name || '';
        console.log(`🖨️  Printing to: ${deviceName || '(system default)'}`);
      }

      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: deviceName,
          pageSize: 'A6', // 58mm width approximation
          margins: {
            marginType: 'none'
          }
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
          deviceName: '',
          pageSize: 'A6'
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

// USB ESC/POS printing for thermal printers
const printESCPOS = async (bytes, printerName = null) => {
  const { SerialPort } = require('serialport');
  const usb = require('usb');

  try {
    console.log('🔌 Attempting USB ESC/POS print...');

    // Find USB thermal printer
    const devices = usb.getDeviceList();
    let thermalPrinter = null;

    // Common thermal printer USB IDs (you may need to add more)
    const thermalPrinterIds = [
      { vendorId: 0x04b8, productId: 0x0202 }, // Epson
      { vendorId: 0x0471, productId: 0x0055 }, // Philips
      { vendorId: 0x0493, productId: 0x8760 }, // Samsung
      { vendorId: 0x0fe6, productId: 0x811e }, // ICS
      { vendorId: 0x1a86, productId: 0x7584 }, // CH340 common in thermal printers
      { vendorId: 0x067b, productId: 0x2303 }, // Prolific
    ];

    for (const device of devices) {
      const deviceId = { vendorId: device.deviceDescriptor.idVendor, productId: device.deviceDescriptor.idProduct };
      if (thermalPrinterIds.some(id => id.vendorId === deviceId.vendorId && id.productId === deviceId.productId)) {
        thermalPrinter = device;
        console.log(`✅ Found thermal printer: ${deviceId.vendorId}:${deviceId.productId}`);
        break;
      }
    }

    if (!thermalPrinter) {
      // Try to find by common serial ports (COM ports on Windows)
      const ports = await SerialPort.list();
      const thermalPorts = ports.filter(port =>
        port.manufacturer && (
          port.manufacturer.toLowerCase().includes('thermal') ||
          port.manufacturer.toLowerCase().includes('printer') ||
          port.manufacturer.toLowerCase().includes('epson') ||
          port.manufacturer.toLowerCase().includes('star') ||
          port.manufacturer.toLowerCase().includes('citizen')
        )
      );

      if (thermalPorts.length > 0) {
        const port = new SerialPort({
          path: thermalPorts[0].path,
          baudRate: 9600, // Common baud rate for thermal printers
          dataBits: 8,
          parity: 'none',
          stopBits: 1,
          autoOpen: false
        });

        await new Promise((resolve, reject) => {
          port.open((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        console.log(`✅ Connected to thermal printer on ${thermalPorts[0].path}`);

        // Send ESC/POS data
        await new Promise((resolve, reject) => {
          port.write(Buffer.from(bytes), (err) => {
            if (err) reject(err);
            else {
              // Wait a bit for data to be sent
              setTimeout(() => {
                port.close((err) => {
                  if (err) console.warn('Warning closing port:', err);
                  resolve();
                });
              }, 100);
            }
          });
        });

        console.log('✅ ESC/POS data sent to USB thermal printer');
        return { success: true };
      }

      throw new Error('No USB thermal printer found');
    }

    // If we found a USB device, try to communicate with it
    thermalPrinter.open();

    // Find the correct interface (usually interface 0 for printers)
    const interface = thermalPrinter.interface(0);
    if (interface.isKernelDriverActive()) {
      interface.detachKernelDriver();
    }
    interface.claim();

    // Find bulk out endpoint
    const endpoint = interface.endpoints.find(ep => ep.direction === 'out' && ep.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK);

    if (endpoint) {
      // Send data in chunks
      const chunkSize = 64; // USB bulk transfer size
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        await new Promise((resolve, reject) => {
          endpoint.transfer(Buffer.from(chunk), (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      console.log('✅ ESC/POS data sent to USB thermal printer');
      interface.release(true);
      thermalPrinter.close();
      return { success: true };
    } else {
      interface.release(true);
      thermalPrinter.close();
      throw new Error('No suitable USB endpoint found');
    }

  } catch (error) {
    console.error('❌ USB ESC/POS print failed:', error);
    return { success: false, error: error.message };
  }
};

ipcMain.handle('print-escpos', async (_, bytes, printerName) => {
  return printESCPOS(bytes, printerName);
});

// Configure auto-updater (only if available)
if (autoUpdater && !isDev) {
  console.log('🔄 Setting up auto-updater...');
  
  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.warn('⚠️ Initial update check failed:', err.message);
  });
  
  autoUpdater.on('update-available', (info) => {
    console.log('📦 Update available:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available.`,
      detail: 'The app will download and install the update automatically.',
      buttons: ['OK']
    }).catch(err => console.error('Dialog error:', err));
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded and ready to install.',
      detail: 'The app will restart to apply the changes.',
      buttons: ['Restart Now', 'Later']
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    }).catch(err => console.error('Dialog error:', err));
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ Update error:', err);
  });
} else {
  console.log('⚠️ Auto-updater disabled (dev mode or not available)');
}

// Auto-updater setup
const setupUpdater = (window) => {
  if (!autoUpdater) {
    console.log('❌ electron-updater not available');
    return;
  }

  console.log('🔧 Configuring updater for main window...');

  // Check for updates on app start
  autoUpdater.checkForUpdates().catch(err => {
    console.warn('⚠️ Update check failed:', err.message);
  });

  // Check for updates automatically every 10 minutes
  setInterval(() => {
    console.log('🔍 Auto-checking for updates...');
    autoUpdater.checkForUpdates().catch(err => {
      console.warn('⚠️ Auto-update check failed:', err.message);
    });
  }, 10 * 60 * 1000);

  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
    window.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('📦 Update available:', info.version);
    window.webContents.send('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('✅ App is up to date');
    window.webContents.send('update-status', { status: 'not-available' });
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ Update error:', err);
    window.webContents.send('update-status', { status: 'error', error: err.message });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`📥 Download progress: ${Math.round(progressObj.percent)}%`);
    window.webContents.send('update-status', { 
      status: 'downloading', 
      percent: Math.round(progressObj.percent) 
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded, ready to install');
    window.webContents.send('update-status', { status: 'ready', version: info.version });
  });
};

// IPC handlers for updates
ipcMain.handle('check-for-update', async () => {
  if (!autoUpdater) return { success: false, message: 'Updater not available' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateAvailable: result.updateInfo !== null };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-update', async () => {
  if (!autoUpdater) return { success: false };
  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Create application menu with Help menu
const createMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('trigger-update-check');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Developer Tools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About RMI Teller Report',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About RMI Teller Report',
              message: 'RMI Teller Report',
              detail: `Version: ${app.getVersion()}\n\nManage and calculate teller salaries efficiently.`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.whenReady().then(() => {
  console.log('🚀 App ready, creating window...');
  createMenu();
  createWindow();
}).catch(err => {
  console.error('❌ App error:', err);
  process.exit(1);
});

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
