const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printHTML: (html, printer) => ipcRenderer.invoke('print-html', html, printer),
  getAvailablePrinters: () => ipcRenderer.invoke('get-printers')
});
