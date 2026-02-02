// Minimal ESC/POS builder for 58mm receipts
// Note: Use ASCII-safe characters for widest compatibility (avoid ₱; use PHP)

function textToBytes(str = "") {
  // Replace peso with 'PHP '
  const safe = str.replace(/₱/g, "PHP ");
  const bytes = [];
  for (let i = 0; i < safe.length; i++) {
    const code = safe.charCodeAt(i);
    bytes.push(code & 0xff); // naive ASCII, works for basic chars
  }
  return bytes;
}

export function buildTellerReceipt58({
  orgName = "RMI Teller Report",
  tellerName = "",
  dateStr = new Date().toLocaleString(),
  systemBalance = 0,
  cashOnHand = 0,
  d = { d1000: 0, d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coins: 0 },
  over = 0,
  short = 0,
}) {
  const bytes = [];
  const write = (...arr) => bytes.push(...arr);
  const lf = () => write(0x0a);

  const setAlign = (n) => write(0x1b, 0x61, n & 0x02); // 0 left,1 center,2 right
  const init = () => write(0x1b, 0x40);
  const boldOn = () => write(0x1b, 0x45, 0x01);
  const boldOff = () => write(0x1b, 0x45, 0x00);
  const dblOn = () => write(0x1d, 0x21, 0x11);
  const dblOff = () => write(0x1d, 0x21, 0x00);
  const line = () => {
    write(...textToBytes("--------------------------------")); lf();
  };
  const print = (s = "") => { write(...textToBytes(s)); lf(); };
  const padTable = (col1 = "", col2 = "", col3 = "") => {
    const c1 = String(col1).padEnd(10);
    const c2 = String(col2).padStart(6);
    const c3 = String(col3).padStart(12);
    return c1 + c2 + c3;
  };
  const padField = (label = "", value = "") => {
    const total = 32;
    const spaces = Math.max(1, total - label.length - value.length);
    return label + " ".repeat(spaces) + value;
  };

  init();
  setAlign(1); boldOn(); dblOn();
  print(orgName.toUpperCase());
  dblOff(); boldOff();
  lf();
  
  // Header section
  setAlign(0);
  print(padField("SV:", ""));
  print(padField("TELLER:", (tellerName || "").toUpperCase()));
  print(padField("DATE:", dateStr));
  print(padField("SYSTEM BALANCE:", Number(systemBalance).toLocaleString()));
  print(padField("CASH ON HAND:", Number(cashOnHand).toLocaleString()));
  print(padField("OVER:", over ? Number(over).toLocaleString() : "0"));
  print(padField("SHORT:", short ? Number(short).toLocaleString() : "0"));
  lf();
  
  // Denomination table header
  setAlign(1); boldOn();
  print("DENOMINATION");
  boldOff(); setAlign(0);
  print(padTable("", "PCS", "TOTAL"));
  line();
  
  // Denomination rows
  const d1000Count = Number(d.d1000 || 0);
  const d500Count = Number(d.d500 || 0);
  const d200Count = Number(d.d200 || 0);
  const d100Count = Number(d.d100 || 0);
  const d50Count = Number(d.d50 || 0);
  const d20Count = Number(d.d20 || 0);
  const coinsValue = Number(d.coins || 0);
  
  print(padTable("1000x", d1000Count.toString(), (d1000Count * 1000).toLocaleString()));
  print(padTable("500x", d500Count.toString(), (d500Count * 500).toLocaleString()));
  print(padTable("200x", d200Count.toString(), (d200Count * 200).toLocaleString()));
  print(padTable("100x", d100Count.toString(), (d100Count * 100).toLocaleString()));
  print(padTable("50x", d50Count.toString(), (d50Count * 50).toLocaleString()));
  print(padTable("20x", d20Count.toString(), (d20Count * 20).toLocaleString()));
  print(padTable("COINS", "", coinsValue.toLocaleString()));
  line();
  print(padTable("TOTAL", "", Number(cashOnHand).toLocaleString()));
  
  lf();
  setAlign(1); print("Thank you"); setAlign(0);

  // Feed and (optional) cut
  write(0x1b, 0x64, 0x04); // feed 4 lines
  write(0x1d, 0x56, 0x00); // full cut (ignored if no cutter)

  return new Uint8Array(bytes);
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}

export function tryPrintRawBT(bytes) {
  const b64 = bytesToBase64(bytes);
  // RawBT deep link, supported by RawBT app on Android
  const url = `rawbt:base64,${b64}`;
  // Open via window.open for better compatibility
  const w = window.open(url, "_blank");
  return !!w;
}

// USB Thermal Printer Support (for Electron/Desktop)
export async function tryPrintUSB(bytes, printerName = null) {
  if (!window?.electronAPI?.printESCPOS) {
    console.warn("USB printing not available - electronAPI.printESCPOS not found");
    return false;
  }

  try {
    const result = await window.electronAPI.printESCPOS(bytes, printerName);
    return result.success;
  } catch (error) {
    console.error("USB print failed:", error);
    return false;
  }
}

// Enhanced Bluetooth Printer Detection and Connection
export class BluetoothPrinterManager {
  constructor() {
    this.connectedDevice = null;
    this.connectedCharacteristic = null;
    this.isConnected = false;
    this.availablePrinters = [];
  }

  // Scan for Bluetooth printers
  async scanPrinters() {
    try {
      console.log("🔍 Scanning for Bluetooth printers...");

      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth API not supported");
      }

      // Request device with ESC/POS printer services
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Common ESC/POS service
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Another common service
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'  // Generic serial service
        ]
      });

      if (device) {
        this.availablePrinters.push({
          device,
          name: device.name || 'Unknown Printer',
          id: device.id
        });

        console.log("✅ Found Bluetooth printer:", device.name);
        return this.availablePrinters;
      }
    } catch (error) {
      console.error("❌ Bluetooth scan failed:", error);
      throw error;
    }
  }

  // Connect to a specific Bluetooth printer
  async connectToPrinter(printer) {
    try {
      console.log("🔗 Connecting to Bluetooth printer:", printer.name);

      // If printer object doesn't have device (from paired printers list), try to get it
      let device = printer.device;
      
      if (!device) {
        // Device not in memory - need to re-request it
        console.log("📱 Device not in memory, requesting Bluetooth device again...");
        
        // Try to get device by ID if available
        if (printer.id) {
          try {
            const devices = await navigator.bluetooth.getAvailability();
            if (!devices) {
              throw new Error("Bluetooth not available");
            }
            
            // Request the device again - this will show user selection
            device = await navigator.bluetooth.requestDevice({
              acceptAllDevices: true,
              optionalServices: [
                '000018f0-0000-1000-8000-00805f9b34fb',
                '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
              ]
            });
            
            if (!device) {
              throw new Error("Device selection cancelled");
            }
          } catch (err) {
            throw new Error(`Failed to get device: ${err.message}`);
          }
        } else {
          throw new Error("Cannot reconnect: no device reference or ID available. Please scan again.");
        }
      }

      if (!device || !device.gatt) {
        throw new Error("Invalid device object - missing GATT");
      }

      // Ensure GATT connection is established
      if (!device.gatt.connected) {
        console.log("📡 GATT not connected, establishing connection...");
        await device.gatt.connect();
      }

      this.connectedDevice = device;
      console.log("✅ Connected to Bluetooth device");

      // Discover services and characteristics with retry logic
      let services;
      try {
        services = await device.gatt.getPrimaryServices();
      } catch (err) {
        if (err.message.includes("GATT Server is disconnected")) {
          console.warn("⚠️ GATT server disconnected, reconnecting...");
          try {
            // Ensure proper disconnect
            if (device.gatt.connected) {
              device.gatt.disconnect();
              // Wait a bit for disconnect to complete
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Now reconnect
            console.log("🔄 Attempting to reconnect to GATT...");
            await device.gatt.connect();
            console.log("✅ GATT reconnected");
            
            // Retry getting services
            services = await device.gatt.getPrimaryServices();
            console.log("✅ Services retrieved after reconnection");
          } catch (reconnectErr) {
            console.error("❌ Failed to recover GATT connection:", reconnectErr);
            throw new Error(`GATT reconnection failed: ${reconnectErr.message}`);
          }
        } else {
          throw err;
        }
      }

      for (let service of services) {
        try {
          const characteristics = await service.getCharacteristics();

          for (let char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              console.log("✅ Found writable characteristic:", char.uuid);
              this.connectedCharacteristic = char;
              this.isConnected = true;
              return true;
            }
          }
        } catch (charError) {
          console.log("❌ Error checking characteristics:", charError.message);
        }
      }

      throw new Error("No writable characteristics found");
    } catch (error) {
      console.error("❌ Bluetooth connection failed:", error);
      this.isConnected = false;
      throw error;
    }
  }

  // Print data to connected Bluetooth printer
  async printToConnectedPrinter(bytes) {
    if (!this.isConnected || !this.connectedCharacteristic) {
      throw new Error("No Bluetooth printer connected");
    }

    try {
      console.log("🖨️ Sending data to Bluetooth printer...");

      // Check if GATT connection is still alive
      if (this.connectedDevice && !this.connectedDevice.gatt.connected) {
        console.warn("⚠️ GATT connection lost, attempting to reconnect...");
        try {
          await this.connectedDevice.gatt.connect();
          console.log("✅ Reconnected to GATT server");
        } catch (reconnectErr) {
          console.error("❌ Failed to reconnect:", reconnectErr);
          this.isConnected = false;
          throw new Error("Printer disconnected and cannot reconnect");
        }
      }

      // Send data in chunks
      const chunkSize = 20;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        
        try {
          await this.connectedCharacteristic.writeValue(chunk);
        } catch (writeErr) {
          if (writeErr.message.includes("GATT Server is disconnected")) {
            console.warn("⚠️ GATT disconnected during write, attempting reconnection...");
            // Try to reconnect and resume
            if (this.connectedDevice) {
              try {
                // Disconnect first if still connected
                if (this.connectedDevice.gatt.connected) {
                  this.connectedDevice.gatt.disconnect();
                  // Wait for disconnect
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // Reconnect
                console.log("🔄 Attempting to reconnect during print...");
                await this.connectedDevice.gatt.connect();
                console.log("✅ Reconnected, retrying chunk...");
                
                // Retry this chunk
                await this.connectedCharacteristic.writeValue(chunk);
                console.log("✅ Chunk sent successfully after reconnection");
              } catch (err) {
                console.error("❌ Failed to recover connection during print:", err);
                this.isConnected = false;
                throw new Error("Printer connection lost during printing - cannot recover");
              }
            } else {
              throw new Error("No device reference available for reconnection");
            }
          } else {
            throw writeErr;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log("✅ Data sent to Bluetooth printer");
      return true;
    } catch (error) {
      console.error("❌ Bluetooth print failed:", error);
      this.isConnected = false;
      throw error;
    }
  }

  // Disconnect from current printer
  async disconnect() {
    if (this.connectedDevice && this.connectedDevice.gatt.connected) {
      try {
        this.connectedDevice.gatt.disconnect();
        console.log("🔌 Disconnected from Bluetooth printer");
      } catch (error) {
        console.warn("Error disconnecting:", error);
      }
    }

    this.connectedDevice = null;
    this.connectedCharacteristic = null;
    this.isConnected = false;
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectedPrinter: this.connectedDevice ? {
        name: this.connectedDevice.name,
        id: this.connectedDevice.id
      } : null,
      availablePrinters: this.availablePrinters.length
    };
  }
}

// Global Bluetooth printer manager instance
export const bluetoothPrinterManager = new BluetoothPrinterManager();

// Enhanced smart printing function with USB and Bluetooth support
export async function smartPrintWithAllOptions(receiptData, receiptType = 'teller') {
  const bytes = receiptType === 'salary'
    ? buildSalaryReceipt58(receiptData)
    : buildTellerReceipt58(receiptData);

  console.log("🖨️ Starting enhanced smart print process...");

  // Method 1: Try Bluetooth printing (if connected)
  if (bluetoothPrinterManager.isConnected) {
    try {
      console.log("🔗 Attempting Bluetooth print to connected device...");
      await bluetoothPrinterManager.printToConnectedPrinter(bytes);
      return { success: true, method: 'bluetooth', message: 'Printed via Bluetooth' };
    } catch (bluetoothError) {
      console.log("❌ Bluetooth print failed:", bluetoothError.message);
    }
  }

  // Method 2: Try USB thermal printing (for desktop)
  if (window?.electronAPI?.printESCPOS) {
    try {
      console.log("🔌 Attempting USB thermal print...");
      const usbSuccess = await tryPrintUSB(bytes);
      if (usbSuccess) {
        return { success: true, method: 'usb', message: 'Printed via USB thermal printer' };
      }
    } catch (usbError) {
      console.log("❌ USB print failed:", usbError.message);
    }
  }

  // Method 3: Try RawBT app (for mobile)
  try {
    console.log("📱 Attempting RawBT mobile print...");
    if (tryPrintRawBT(bytes)) {
      return { success: true, method: 'rawbt', message: 'Print sent to RawBT app' };
    }
  } catch (rawbtError) {
    console.log("❌ RawBT print failed:", rawbtError.message);
  }

  // Method 4: Try Electron HTML printing (fallback)
  if (window?.electronAPI?.printHTML) {
    try {
      console.log("🖨️ Attempting Electron HTML print...");
      // Generate HTML version for fallback
      const html = receiptType === 'salary'
        ? generateSalaryHTML(receiptData)
        : generateTellerHTML(receiptData);

      await window.electronAPI.printHTML(html);
      return { success: true, method: 'electron-html', message: 'Printed via system printer' };
    } catch (htmlError) {
      console.log("❌ Electron HTML print failed:", htmlError.message);
    }
  }

  // Method 5: Browser print dialog (last resort)
  try {
    console.log("🌐 Using browser print dialog...");
    const html = receiptType === 'salary'
      ? generateSalaryHTML(receiptData)
      : generateTellerHTML(receiptData);

    const win = window.open("", "_blank", "width=320,height=540");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();

      // Wait a bit for the document to load, then trigger print
      setTimeout(() => {
        win.print();
        // Close the window after printing (optional)
        setTimeout(() => {
          win.close();
        }, 1000);
      }, 250);

      return { success: true, method: 'browser', message: 'Browser print dialog opened' };
    }
  } catch (browserError) {
    console.log("❌ Browser print failed:", browserError.message);
  }

  return { success: false, method: 'none', message: 'All printing methods failed' };
}

// Helper functions to generate HTML for fallback printing
function generateTellerHTML(data) {
  // Generate HTML for teller receipt (similar to existing code)
  return `<!DOCTYPE html>
<html>
<head>
  <title>Teller Receipt</title>
  <style>
    body { font-family: monospace; font-size: 12px; width: 220px; margin: 0; padding: 8px; }
    .center { text-align: center; }
    .line { border-top: 1px dashed #000; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="center"><strong>${data.orgName}</strong></div>
  <div class="center">TELLER REPORT</div>
  <div class="line"></div>
  <div>Teller: ${data.tellerName}</div>
  <div>Date: ${data.dateStr}</div>
  <div>System Balance: ₱${data.systemBalance?.toLocaleString()}</div>
  <div>Cash on Hand: ₱${data.cashOnHand?.toLocaleString()}</div>
  <div class="line"></div>
  <div>Thank you</div>
</body>
</html>`;
}

function generateSalaryHTML(data) {
  // Generate HTML for salary receipt with proper pagination
  return `<!DOCTYPE html>
<html>
<head>
  <title>Salary Receipt</title>
  <style>
    @media print {
      @page {
        size: 58mm auto;
        margin: 4mm;
      }
      body {
        width: 50mm; /* Content width for 58mm paper minus margins */
        margin: 0;
        padding: 2mm;
      }
    }
    body {
      font-family: monospace;
      font-size: 11px;
      width: 220px;
      margin: 0;
      padding: 8px;
      line-height: 1.2;
    }
    .center { text-align: center; }
    .line {
      border-top: 1px dashed #000;
      margin: 4px 0;
      page-break-inside: avoid;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      page-break-inside: avoid;
    }
    .header-section {
      page-break-after: avoid;
      margin-bottom: 4px;
    }
    .daily-data {
      margin: 4px 0;
    }
    .daily-row {
      page-break-inside: avoid;
      margin: 2px 0;
    }
    .summary-section {
      page-break-inside: avoid;
      margin-top: 4px;
    }
    .footer-section {
      page-break-inside: avoid;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header-section">
    <div class="center"><strong>${data.orgName}</strong></div>
    <div class="center">TELLER SALARY REPORT</div>
    <div class="line"></div>
    <div>Teller: ${data.tellerName}</div>
    <div>ID: ${data.tellerId}</div>
    <div>Week: ${data.weekLabel}</div>
    <div>Date: ${data.dateStr}</div>
  </div>
  <div class="line"></div>
  <div class="daily-data">
    ${data.dailyData?.map(row => `<div class="daily-row row"><span>${row.day}</span><span>₱${row.over?.toFixed(2)}</span><span>₱${row.base?.toFixed(2)}</span></div>`).join('')}
  </div>
  <div class="line"></div>
  <div class="summary-section">
    <div class="row"><span><strong>TOTAL:</strong></span><span></span><span><strong>₱${data.totalCompensation?.toFixed(2)}</strong></span></div>
  </div>
  <div class="line"></div>
  <div class="footer-section">
    <div>Prepared by: ___________________</div>
    <div class="center">Thank you</div>
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;
}

export function buildSalaryReceipt58({
  orgName = "RMI Teller Report",
  tellerName = "",
  tellerId = "",
  weekLabel = "",
  dailyData = [], // Array of {day: string, over: number, short: number, base: number}
  totalOver = 0,
  totalShort = 0,
  totalBase = 0,
  totalCompensation = 0,
  dateStr = new Date().toLocaleString(),
}) {
  const bytes = [];
  const write = (...arr) => bytes.push(...arr);
  const lf = () => write(0x0a);

  const setAlign = (n) => write(0x1b, 0x61, n & 0x02); // 0 left,1 center,2 right
  const init = () => write(0x1b, 0x40);
  const boldOn = () => write(0x1b, 0x45, 0x01);
  const boldOff = () => write(0x1b, 0x45, 0x00);
  const line = () => {
    write(...textToBytes("--------------------------------")); lf();
  };
  const print = (s = "") => { write(...textToBytes(s)); lf(); };
  const padSalaryRow = (day = "", over = "", short = "", base = "") => {
    const d = String(day).padEnd(4);
    const o = String(over).padStart(8);
    const s = String(short).padStart(7);
    const b = String(base).padStart(9);
    return d + o + s + b;
  };

  init();
  setAlign(1); boldOn();
  print(orgName.toUpperCase());
  print("TELLER SALARY REPORT");
  boldOff(); setAlign(0);
  lf();

  // Header info
  print(`TELLER: ${tellerName.toUpperCase()}`);
  print(`ID: ${tellerId}`);
  print(`WEEK: ${weekLabel}`);
  print(`DATE: ${dateStr}`);
  lf();

  // Table header
  setAlign(0);
  print(padSalaryRow("DAY", "OVER", "SHORT", "BASE"));
  line();

  // Daily rows
  dailyData.forEach(row => {
    const overStr = row.over ? `PHP${Number(row.over).toFixed(0)}` : "PHP0";
    const shortStr = row.short ? `PHP${Number(row.short).toFixed(0)}` : "PHP0";
    const baseStr = row.base ? `PHP${Number(row.base).toFixed(0)}` : "PHP0";
    print(padSalaryRow(row.day, overStr, shortStr, baseStr));
  });

  line();

  // Totals
  boldOn();
  const totalOverStr = `PHP${Number(totalOver).toFixed(0)}`;
  const totalShortStr = `PHP${Number(totalShort).toFixed(0)}`;
  const totalBaseStr = `PHP${Number(totalBase).toFixed(0)}`;
  const totalCompStr = `PHP${Number(totalCompensation).toFixed(0)}`;
  
  print(padSalaryRow("OVER", totalOverStr, "", ""));
  print(padSalaryRow("SHORT", "", totalShortStr, ""));
  print(padSalaryRow("TOTAL", "", "", totalCompStr));
  boldOff();

  lf();
  setAlign(1);
  print("Prepared by: __________________");
  lf();
  print("Thank you");

  // Feed and cut
  write(0x1b, 0x64, 0x04); // feed 4 lines
  write(0x1d, 0x56, 0x00); // full cut

  return new Uint8Array(bytes);
}
