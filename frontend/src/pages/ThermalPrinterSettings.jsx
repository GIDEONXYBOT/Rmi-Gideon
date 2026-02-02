import React, { useState, useEffect, useContext } from 'react';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { bluetoothPrinterManager } from '../utils/escpos';
import { Bluetooth, Loader2, Wifi, WifiOff, Trash2, Plus, CheckCircle, AlertCircle } from 'lucide-react';

export default function ThermalPrinterSettings() {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';

  const [isScanning, setIsScanning] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState(bluetoothPrinterManager.getStatus());
  const [pairedPrinters, setPairedPrinters] = useState(() => {
    const saved = localStorage.getItem('pairedBluetoothPrinters');
    return saved ? JSON.parse(saved) : [];
  });

  // Check Web Bluetooth API support
  const [bluetoothSupported] = useState(() => {
    return !!navigator.bluetooth;
  });

  // Detect device and browser
  const [deviceInfo] = useState(() => {
    const ua = navigator.userAgent;
    return {
      isAndroid: /Android/.test(ua),
      isIOS: /iPhone|iPad|iPod/.test(ua),
      isChrome: /Chrome/.test(ua),
      isEdge: /Edg/.test(ua),
      isFirefox: /Firefox/.test(ua),
      isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
      isWindows: /Windows/.test(ua),
      isMac: /Macintosh/.test(ua),
    };
  });

  // Helper function to get browser support status
  const getSupportedBrowsers = () => {
    const browsers = [];
    if (deviceInfo.isAndroid) {
      browsers.push({ name: 'Chrome 56+', supported: true });
      browsers.push({ name: 'Firefox 55+', supported: true });
      browsers.push({ name: 'Edge', supported: true });
      browsers.push({ name: 'Samsung Internet', supported: true });
    } else if (deviceInfo.isIOS) {
      browsers.push({ name: 'Safari 13+ (pairing required)', supported: true });
      browsers.push({ name: 'Chrome', supported: false });
      browsers.push({ name: 'Firefox', supported: false });
    } else if (deviceInfo.isWindows || deviceInfo.isMac) {
      browsers.push({ name: 'Chrome 56+', supported: true });
      browsers.push({ name: 'Edge 79+', supported: true });
      browsers.push({ name: 'Firefox', supported: false });
    }
    return browsers;
  };

  const getDeviceType = () => {
    if (deviceInfo.isAndroid) return 'Android Device';
    if (deviceInfo.isIOS) return 'iOS Device';
    if (deviceInfo.isWindows) return 'Windows PC';
    if (deviceInfo.isMac) return 'Mac';
    return 'Unknown Device';
  };

  const getCurrentBrowser = () => {
    if (deviceInfo.isChrome) return 'Chrome';
    if (deviceInfo.isEdge) return 'Edge';
    if (deviceInfo.isFirefox) return 'Firefox';
    if (deviceInfo.isSafari) return 'Safari';
    return 'Unknown Browser';
  };

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setBluetoothStatus(bluetoothPrinterManager.getStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-connect to last connected printer on page load
  useEffect(() => {
    const autoConnect = async () => {
      if (!bluetoothSupported || pairedPrinters.length === 0) return;

      // Try to get the last connected printer from status
      const currentStatus = bluetoothPrinterManager.getStatus();
      if (currentStatus.isConnected) {
        // Already connected
        return;
      }

      // Try to connect to the first paired printer
      const lastPrinter = pairedPrinters[0];
      if (lastPrinter) {
        try {
          console.log(`Auto-connecting to paired printer: ${lastPrinter.name}`);
          await bluetoothPrinterManager.connectToPrinter(lastPrinter);
          setBluetoothStatus(bluetoothPrinterManager.getStatus());
          showToast({ 
            type: 'success', 
            message: `Auto-connected to ${lastPrinter.name}` 
          });
        } catch (error) {
          console.log(`Auto-connect failed (device may be out of range): ${error.message}`);
          // Don't show error toast - device might be offline
        }
      }
    };

    // Small delay to allow component to fully mount
    const timer = setTimeout(autoConnect, 500);
    return () => clearTimeout(timer);
  }, [bluetoothSupported, pairedPrinters, showToast]);

  // Save paired printers to localStorage
  useEffect(() => {
    localStorage.setItem('pairedBluetoothPrinters', JSON.stringify(pairedPrinters));
  }, [pairedPrinters]);

  const scanForPrinters = async () => {
    if (!bluetoothSupported) {
      showToast({ 
        type: 'error', 
        message: 'Web Bluetooth API not supported on this browser/device' 
      });
      return;
    }

    setIsScanning(true);
    setAvailablePrinters([]);
    showToast({ type: 'info', message: 'Scanning for Bluetooth printers...' });

    try {
      const printers = await bluetoothPrinterManager.scanPrinters();
      setAvailablePrinters(printers);

      if (printers.length === 0) {
        showToast({ type: 'warning', message: 'No Bluetooth printers found' });
      } else {
        showToast({ type: 'success', message: `Found ${printers.length} printer(s)` });
      }
    } catch (error) {
      console.error('Scan error:', error);
      showToast({ type: 'error', message: 'Scan failed: ' + error.message });
    } finally {
      setIsScanning(false);
    }
  };

  const connectToPrinter = async (printer) => {
    setConnecting(true);
    showToast({ type: 'info', message: `Connecting to ${printer.name}...` });

    try {
      await bluetoothPrinterManager.connectToPrinter(printer);
      setBluetoothStatus(bluetoothPrinterManager.getStatus());

      // Add to paired printers if not already there
      const alreadyPaired = pairedPrinters.some(p => p.id === printer.id);
      if (!alreadyPaired) {
        setPairedPrinters([...pairedPrinters, {
          id: printer.id,
          name: printer.name,
          connectedAt: new Date().toISOString()
        }]);
      }

      showToast({ type: 'success', message: `Connected to ${printer.name}` });
      setAvailablePrinters([]); // Clear scan results after connection
    } catch (error) {
      console.error('Connection error:', error);
      showToast({ type: 'error', message: 'Connection failed: ' + error.message });
    } finally {
      setConnecting(false);
    }
  };

  const disconnectPrinter = async () => {
    try {
      await bluetoothPrinterManager.disconnect();
      setBluetoothStatus(bluetoothPrinterManager.getStatus());
      showToast({ type: 'success', message: 'Disconnected from printer' });
    } catch (error) {
      console.error('Disconnect error:', error);
      showToast({ type: 'error', message: 'Disconnect failed: ' + error.message });
    }
  };

  const removePairedPrinter = (printerId) => {
    setPairedPrinters(pairedPrinters.filter(p => p.id !== printerId));
    showToast({ type: 'success', message: 'Printer removed from paired list' });
  };

  const testPrint = async () => {
    if (!bluetoothStatus.isConnected) {
      showToast({ type: 'error', message: 'No printer connected' });
      return;
    }

    try {
      // Create a simple test receipt
      const bytes = [];
      const write = (...arr) => bytes.push(...arr);
      const lf = () => write(0x0a);
      const textToBytes = (str) => {
        const safe = str.replace(/₱/g, "PHP ");
        const result = [];
        for (let i = 0; i < safe.length; i++) {
          result.push(safe.charCodeAt(i) & 0xff);
        }
        return result;
      };

      // Initialize printer
      write(0x1b, 0x40);
      write(0x1b, 0x61, 0x01); // Center align
      write(0x1b, 0x45, 0x01); // Bold on

      write(...textToBytes("THERMAL PRINTER TEST"));
      lf();
      write(...textToBytes("✓ Connection Successful"));
      lf();
      lf();

      write(0x1b, 0x45, 0x00); // Bold off
      write(...textToBytes("Date: " + new Date().toLocaleString()));
      lf();
      lf();

      write(0x1b, 0x61, 0x00); // Left align
      write(...textToBytes("Test print completed successfully."));
      lf();
      write(...textToBytes("Your thermal printer is ready!"));
      lf();
      lf();

      // Feed and cut
      write(0x1b, 0x64, 0x03); // Feed 3 lines
      write(0x1d, 0x56, 0x00); // Full cut

      await bluetoothPrinterManager.printToConnectedPrinter(new Uint8Array(bytes));
      showToast({ type: 'success', message: 'Test print sent successfully!' });
    } catch (error) {
      console.error('Test print error:', error);
      showToast({ type: 'error', message: 'Test print failed: ' + error.message });
    }
  };

  return (
    <div className={`min-h-screen p-4 md:p-8 ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Show unsupported browser UI if Web Bluetooth API not available */}
      {!bluetoothSupported && (
        <div className={`max-w-4xl mx-auto rounded-lg shadow-lg ${dark ? 'bg-gray-800' : 'bg-white'} p-6`}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle size={32} className="text-red-600" />
            <div>
              <h1 className={`text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                Bluetooth Not Supported
              </h1>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                Your current browser/device doesn't support Web Bluetooth API
              </p>
            </div>
          </div>

          {/* Device & Browser Info */}
          <div className={`mb-6 p-4 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <h2 className={`font-semibold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
              Your Setup
            </h2>
            <p className={`text-sm mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              <span className="font-semibold">Device:</span> {getDeviceType()}
            </p>
            <p className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              <span className="font-semibold">Browser:</span> {getCurrentBrowser()}
            </p>
          </div>

          {/* Supported Browsers */}
          <div className={`mb-6 p-4 rounded-lg border-2 ${
            dark ? 'border-blue-700 bg-blue-900/20' : 'border-blue-300 bg-blue-50'
          }`}>
            <h2 className={`font-semibold mb-3 ${dark ? 'text-blue-300' : 'text-blue-800'}`}>
              ✓ Supported Browsers on {getDeviceType()}
            </h2>
            <ul className={`space-y-2 text-sm ${dark ? 'text-blue-200' : 'text-blue-700'}`}>
              {getSupportedBrowsers().map((browser, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  {browser.supported ? (
                    <>
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                      <span>{browser.name}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} className="text-gray-400 flex-shrink-0" />
                      <span className="line-through opacity-60">{browser.name}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div className={`mb-6 p-4 rounded-lg border-2 ${
            dark ? 'border-green-700 bg-green-900/20' : 'border-green-300 bg-green-50'
          }`}>
            <h2 className={`font-semibold mb-3 ${dark ? 'text-green-300' : 'text-green-800'}`}>
              📱 How to Fix This
            </h2>
            <ul className={`space-y-2 text-sm ${dark ? 'text-green-200' : 'text-green-700'}`}>
              {deviceInfo.isAndroid && (
                <>
                  <li>✓ Use Chrome, Firefox, Edge, or Samsung Internet</li>
                  <li>✓ Enable Bluetooth on your Android device</li>
                  <li>✓ Grant location and Bluetooth permissions to the app</li>
                  <li>✓ Ensure your printer is in pairing mode</li>
                </>
              )}
              {deviceInfo.isIOS && (
                <>
                  <li>✓ Use Safari 13+ (pairing via iOS Settings required)</li>
                  <li>✓ Go to Settings → Bluetooth to pair printer first</li>
                  <li>✓ Then use this app to connect</li>
                  <li>✓ Note: Chrome and Firefox don't support Bluetooth on iOS</li>
                </>
              )}
              {(deviceInfo.isWindows || deviceInfo.isMac) && (
                <>
                  <li>✓ Use Chrome 56+ or Edge 79+</li>
                  <li>✓ Enable Bluetooth on your computer</li>
                  <li>✓ Ensure printer is paired in system settings first</li>
                  <li>✓ Firefox doesn't support Web Bluetooth API</li>
                </>
              )}
            </ul>
          </div>

          {/* Additional Info */}
          <div className={`p-4 rounded-lg border ${
            dark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
          }`}>
            <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
              <span className="font-semibold">What is Web Bluetooth API?</span> It's a web standard that allows 
              websites to communicate directly with Bluetooth devices. Not all browsers support it yet. 
              For more info: <a href="https://web.dev/bluetooth/" target="_blank" rel="noopener noreferrer" 
              className="text-blue-600 hover:underline">web.dev/bluetooth</a>
            </p>
          </div>
        </div>
      )}

      {/* Main content shown only when Bluetooth is supported */}
      {bluetoothSupported && (
      <div className={`max-w-4xl mx-auto rounded-lg shadow-lg ${dark ? 'bg-gray-800' : 'bg-white'} p-6`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Bluetooth size={32} className="text-blue-600" />
          <div>
            <h1 className={`text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
              Thermal Printer Settings
            </h1>
            <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
              Search, connect, and manage Bluetooth thermal printers
            </p>
          </div>
        </div>

        {/* Current Connection Status */}
        <div className={`mb-6 p-4 rounded-lg border-2 ${
          bluetoothStatus.isConnected
            ? dark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-300'
            : dark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {bluetoothStatus.isConnected ? (
                <>
                  <CheckCircle size={24} className="text-green-600" />
                  <div>
                    <p className={`font-semibold ${dark ? 'text-green-300' : 'text-green-700'}`}>
                      Connected
                    </p>
                    <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {bluetoothStatus.connectedPrinter?.name}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff size={24} className={dark ? 'text-gray-500' : 'text-gray-400'} />
                  <div>
                    <p className={`font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Not Connected
                    </p>
                    <p className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-600'}`}>
                      Scan and select a printer to connect
                    </p>
                  </div>
                </>
              )}
            </div>
            {bluetoothStatus.isConnected && (
              <button
                onClick={disconnectPrinter}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={scanForPrinters}
            disabled={isScanning}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition flex-1 ${
              isScanning
                ? 'bg-gray-500 text-white cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isScanning ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Plus size={18} />
                Scan for Printers
              </>
            )}
          </button>

          {bluetoothStatus.isConnected && (
            <button
              onClick={testPrint}
              disabled={connecting}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition flex-1 ${
                connecting
                  ? 'bg-gray-500 text-white cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {connecting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Printing...
                </>
              ) : (
                <>
                  <Wifi size={18} />
                  Test Print
                </>
              )}
            </button>
          )}
        </div>

        {/* Available Printers */}
        {availablePrinters.length > 0 && (
          <div className="mb-6">
            <h2 className={`text-xl font-bold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
              Available Printers ({availablePrinters.length})
            </h2>
            <div className="space-y-2">
              {availablePrinters.map((printer) => (
                <div
                  key={printer.id}
                  className={`p-4 rounded-lg border-2 flex items-center justify-between transition ${
                    dark
                      ? 'bg-gray-700 border-gray-600 hover:border-blue-500'
                      : 'bg-white border-gray-300 hover:border-blue-500'
                  }`}
                >
                  <div>
                    <p className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
                      {printer.name || 'Unknown Device'}
                    </p>
                    <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                      ID: {printer.id}
                    </p>
                  </div>
                  <button
                    onClick={() => connectToPrinter(printer)}
                    disabled={connecting}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      connecting
                        ? 'bg-gray-500 text-white cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {connecting ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paired Printers History */}
        {pairedPrinters.length > 0 && (
          <div>
            <h2 className={`text-xl font-bold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
              Paired Printers ({pairedPrinters.length})
            </h2>
            <div className="space-y-2">
              {pairedPrinters.map((printer) => {
                const isConnected = bluetoothStatus.connectedPrinter?.id === printer.id;
                return (
                  <div
                    key={printer.id}
                    className={`p-4 rounded-lg border-2 flex items-center justify-between gap-3 ${
                      isConnected
                        ? dark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-300'
                        : dark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isConnected && <CheckCircle size={20} className="text-green-600 flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
                          {printer.name}
                        </p>
                        <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {isConnected
                            ? 'Currently connected ✓'
                            : `Paired on ${new Date(printer.connectedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {isConnected ? (
                        <button
                          onClick={disconnectPrinter}
                          className={`px-3 py-1 rounded-lg transition text-sm font-semibold ${
                            dark
                              ? 'bg-red-700 hover:bg-red-600 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                          title="Disconnect from this printer"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => connectToPrinter(printer)}
                          disabled={connecting}
                          className={`px-3 py-1 rounded-lg transition text-sm font-semibold ${
                            connecting
                              ? 'bg-gray-500 text-white cursor-not-allowed'
                              : dark
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                          title="Reconnect to this printer"
                        >
                          {connecting ? 'Connecting...' : 'Connect'}
                        </button>
                      )}
                      <button
                        onClick={() => removePairedPrinter(printer.id)}
                        className={`p-2 rounded-lg transition ${
                          dark
                            ? 'hover:bg-red-900/20 text-red-400 hover:text-red-300'
                            : 'hover:bg-red-100 text-red-600 hover:text-red-700'
                        }`}
                        title="Remove from paired list"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {availablePrinters.length === 0 && pairedPrinters.length === 0 && (
          <div className={`p-8 text-center rounded-lg border-2 border-dashed ${
            dark ? 'border-gray-700 bg-gray-700/50' : 'border-gray-300 bg-gray-50'
          }`}>
            <AlertCircle size={48} className={`mx-auto mb-4 ${dark ? 'text-gray-500' : 'text-gray-400'}`} />
            <p className={`text-lg font-semibold mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              No printers found
            </p>
            <p className={`text-sm mb-4 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
              Click "Scan for Printers" to find available Bluetooth thermal printers
            </p>
            <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-500'}`}>
              Make sure your printer is turned on and in pairing mode
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className={`mt-6 p-4 rounded-lg border ${
          dark ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-300'
        }`}>
          <p className={`text-sm font-semibold mb-2 ${dark ? 'text-blue-300' : 'text-blue-800'}`}>
            💡 Tip: Thermal Printer Support
          </p>
          <ul className={`text-xs space-y-1 ${dark ? 'text-blue-200' : 'text-blue-700'}`}>
            <li>✓ Requires Bluetooth 4.0+ thermal printer (58mm ESC/POS compatible)</li>
            <li>✓ Works on Android 6.0+, iOS 13+, Chrome 56+, Safari 13+</li>
            <li>✓ Use the Test Print to verify your connection</li>
            <li>✓ Paired printers are saved for easy reconnection</li>
          </ul>
        </div>
      </div>
      )}
    </div>
  );
}
