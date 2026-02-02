import React, { Fragment, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { Loader2, ChevronLeft, ChevronRight, Calendar, Printer, HardDrive, Settings2, CheckSquare, Square, Copy } from 'lucide-react';
import { tryPrintRawBT, buildSalaryReceipt58, smartPrintWithAllOptions, bluetoothPrinterManager } from '../utils/escpos';

export default function TellerSalaryCalculation() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';

  const [tellers, setTellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]);
  const [weekStart, setWeekStart] = useState(null);
  const [weekEnd, setWeekEnd] = useState(null);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(
    localStorage.getItem('autoPrintEnabled') === 'true'
  );

  // Bluetooth printer state
  const [bluetoothPrinters, setBluetoothPrinters] = useState([]);
  const [bluetoothStatus, setBluetoothStatus] = useState(bluetoothPrinterManager.getStatus());
  const [noBSalarDays, setNoBSalaryDays] = useState(() => {
    const saved = localStorage.getItem('noBSalarDays');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedTellers, setSelectedTellers] = useState({});
  const dayLabels = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' }
  ];
  const baseSalaryAmount = 450;
  const baseWeeklySum = baseSalaryAmount * dayLabels.length;
  const sumOver = (overObj = {}) =>
    dayLabels.reduce((sum, { key }) => sum + (overObj[key] || 0), 0);
  const formatCurrency = (value) => `₱${value.toFixed(2)}`;
  const getWeekRangeLabel = () => {
    if (weekStart && weekEnd) {
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return 'Week overview';
  };

  // Toggle base salary for a specific teller/day - DEFAULT is TO INCLUDE, toggle to exclude
  const toggleBaseSalaryDay = (tellerId, dayKey) => {
    const key = `${tellerId}-${dayKey}`;
    setNoBSalaryDays(prev => ({
      ...prev,
      [key]: !prev[key]  // true = excluded, false/undefined = included
    }));
  };

  // Toggle teller selection for batch printing
  const toggleTellerSelection = (tellerId) => {
    setSelectedTellers(prev => ({
      ...prev,
      [tellerId]: !prev[tellerId]
    }));
  };

  // Select/Deselect all tellers
  const toggleSelectAll = () => {
    const allSelected = tellers.length > 0 && Object.keys(selectedTellers).length === tellers.length;
    if (allSelected) {
      setSelectedTellers({});
    } else {
      const newSelection = {};
      tellers.forEach(t => {
        newSelection[t.id] = true;
      });
      setSelectedTellers(newSelection);
    }
  };

  const buildPrintHtml = (teller, dailyOver) => {
    const weekLabel = getWeekRangeLabel();
    
    // Calculate base salary and short amounts considering excluded days
    let totalBaseSalary = 0;
    let totalShort = 0;
    const printableRows = dayLabels
      .map(({ key, label }) => {
        const overAmount = dailyOver[key] || 0;
        const shortAmount = (teller.short && teller.short[key]) || 0;
        const noBSalaryKey = `${teller.id}-${key}`;
        const isExcluded = noBSalarDays[noBSalaryKey];  // true = excluded, false/undefined = included
        const baseSalaryForDay = !isExcluded ? baseSalaryAmount : 0;  // Include if NOT excluded
        totalBaseSalary += baseSalaryForDay;
        totalShort += shortAmount;
        return `<div class="row">
  <span class="col-day">${label}</span>
  <span class="col-over">${formatCurrency(overAmount)}</span>
  <span class="col-short">${formatCurrency(shortAmount)}</span>
  <span class="col-base">${formatCurrency(baseSalaryForDay)}</span>
</div>`;
      })
      .join('');

    const totalOver = sumOver(dailyOver);
    const totalCompensationPrint = totalBaseSalary + totalOver - totalShort;

    const html = `<!doctype html>
<html>
<head>
  <title>${teller.name} - Teller Report</title>
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
    * { box-sizing: border-box; }
    body { 
      font-family: 'Courier New', monospace; 
      padding: 8px; 
      margin: 0; 
      width: 220px; 
      font-size: 11px;
      line-height: 1.3;
    }
    h2 { 
      margin: 0 0 2px; 
      font-size: 14px; 
      font-weight: bold;
      text-align: center;
      page-break-after: avoid;
    }
    p { 
      margin: 1px 0; 
      font-size: 10px; 
      text-align: center;
      page-break-after: avoid;
    }
    .row { 
      display: flex; 
      justify-content: space-between; 
      margin: 2px 0; 
      font-size: 11px;
      font-family: 'Courier New', monospace;
      page-break-inside: avoid;
    }
    .col-day { flex: 0 0 25px; font-weight: 600; }
    .col-over { flex: 0.8; text-align: right; padding-right: 4px; }
    .col-short { flex: 0.8; text-align: right; padding-right: 4px; }
    .col-base { flex: 0.9; text-align: right; }
    .divider { 
      border-top: 1px solid #000; 
      margin: 4px 0;
      page-break-inside: avoid;
    }
    .section-divider {
      border-top: 1px dashed #000;
      margin: 4px 0;
      page-break-inside: avoid;
    }
    .header-section {
      page-break-after: avoid;
      margin-bottom: 3px;
    }
    .daily-section {
      margin: 2px 0;
    }
    .summary-section {
      page-break-inside: avoid;
      margin-top: 2px;
    }
    .signature { 
      margin-top: 8px; 
      font-size: 9px;
      page-break-inside: avoid;
    }
    .signature-line { 
      border-top: 1px solid #000; 
      margin-top: 4px; 
      padding-top: 2px;
      height: 12px;
    }
    .total-row {
      font-weight: bold;
      border-top: 1px solid #000;
      padding-top: 2px;
      margin-top: 4px;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="header-section">
    <h2>${teller.name}</h2>
    <p>ID: ${teller.id}</p>
    <p>${weekLabel}</p>
  </div>
  <div class="section-divider"></div>
  <div style="font-size: 9px; display: flex; justify-content: space-between; margin-bottom: 2px; page-break-after: avoid; font-weight: bold;">
    <span style="flex: 0 0 25px;">Day</span>
    <span style="flex: 0.8; text-align: right; padding-right: 4px;">Over</span>
    <span style="flex: 0.8; text-align: right; padding-right: 4px;">Short</span>
    <span style="flex: 0.9; text-align: right;">Base</span>
  </div>
  <div class="daily-section">
    ${printableRows}
  </div>
  <div class="divider"></div>
  <div class="summary-section">
    <div class="row">
      <span class="col-day" style="font-weight: bold;">OVER:</span>
      <span class="col-over" style="font-weight: bold;">${formatCurrency(totalOver)}</span>
      <span class="col-short"></span>
      <span class="col-base"></span>
    </div>
    <div class="row">
      <span class="col-day" style="font-weight: bold;">SHORT:</span>
      <span class="col-over"></span>
      <span class="col-short" style="font-weight: bold;">${formatCurrency(totalShort)}</span>
      <span class="col-base"></span>
    </div>
    <div class="row total-row">
      <span class="col-day" style="font-weight: bold;">TOTAL:</span>
      <span class="col-over"></span>
      <span class="col-short"></span>
      <span class="col-base" style="font-weight: bold;">${formatCurrency(totalCompensationPrint)}</span>
    </div>
  </div>
  <div class="signature">
    <p style="font-size: 9px;">Prepared by: _________________</p>
    <p style="font-size: 9px;">Date: _________________</p>
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

    return html;
  };

  const previewPrintInBrowser = (html) => {
    const printWindow = window.open('', '_blank', 'width=340,height=640');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const copyReportToClipboard = (teller) => {
    const dailyOver = teller.over || {};
    const weekLabel = getWeekRangeLabel();
    
    // Calculate base salary considering excluded days
    let totalBaseSalary = 0;
    const reportLines = [
      `RMI TELLER REPORT`,
      `==================`,
      `Teller: ${teller.name}`,
      `ID: ${teller.id}`,
      `Period: ${weekLabel}`,
      ``,
      `Day         Over Amount      Short         Base Salary`,
      `---         -----------      -----         -----------`
    ];
    
    dayLabels.forEach(({ key, label }) => {
      const overAmount = dailyOver[key] || 0;
      const shortAmount = (teller.short && teller.short[key]) || 0;
      const noBSalaryKey = `${teller.id}-${key}`;
      const isIncluded = noBSalarDays[noBSalaryKey];
      const baseSalaryForDay = isIncluded ? baseSalaryAmount : 0;
      totalBaseSalary += baseSalaryForDay;
      
      const dayLine = `${label.padEnd(11)}${formatCurrency(overAmount).padStart(15)}${formatCurrency(shortAmount).padStart(15)}${formatCurrency(baseSalaryForDay).padStart(16)}`;
      reportLines.push(dayLine);
    });
    
    const totalOver = sumOver(dailyOver);
    const totalCompensationPrint = totalBaseSalary + totalOver;
    
    reportLines.push(`---         -----------      -----------`);
    reportLines.push(`OVER Total${formatCurrency(totalOver).padStart(30)}`);
    reportLines.push(`BASE Total${formatCurrency(totalBaseSalary).padStart(30)}`);
    reportLines.push(`TOTAL COMP${formatCurrency(totalCompensationPrint).padStart(30)}`);
    
    const reportText = reportLines.join('\n');
    navigator.clipboard.writeText(reportText).then(() => {
      showToast({ type: 'success', message: 'Report copied to clipboard!' });
    }).catch(() => {
      showToast({ type: 'error', message: 'Failed to copy report' });
    });
  };

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handlePrint = async (teller) => {
    const dailyOver = teller.over || {};
    const weekLabel = getWeekRangeLabel();
    const isMobile = isMobileDevice();

    // Calculate salary data
    let totalBaseSalary = 0;
    let totalShort = 0;
    const dailyData = dayLabels.map(({ key, label }) => {
      const overAmount = dailyOver[key] || 0;
      const shortAmount = (teller.short && teller.short[key]) || 0;
      const noBSalaryKey = `${teller.id}-${key}`;
      const isIncluded = noBSalarDays[noBSalaryKey];
      const baseSalaryForDay = isIncluded ? baseSalaryAmount : 0;
      totalBaseSalary += baseSalaryForDay;
      totalShort += shortAmount;
      return {
        day: label,
        over: overAmount,
        short: shortAmount,
        base: baseSalaryForDay
      };
    });

    const totalOver = sumOver(dailyOver);
    const totalCompensation = totalBaseSalary + totalOver - totalShort;

    // Prepare receipt data
    const receiptData = {
      orgName: settings?.systemName || "RMI Teller Report",
      tellerName: teller.name || "",
      tellerId: teller.id?.toString() || "",
      weekLabel,
      dailyData,
      totalOver,
      totalShort,
      totalBase: totalBaseSalary,
      totalCompensation,
      dateStr: new Date().toLocaleString(),
    };

    try {
      // Mobile: Prioritize Bluetooth thermal printer
      if (isMobile) {
        console.log('📱 Mobile device detected - attempting Bluetooth thermal print');
        const bluetoothStatus = bluetoothPrinterManager.getStatus();
        
        if (bluetoothStatus.isConnected && bluetoothStatus.connectedPrinter) {
          // Connected Bluetooth printer - print directly
          console.log('📟 Sending to connected Bluetooth printer:', bluetoothStatus.connectedPrinter.name);
          const receiptBytes = buildSalaryReceipt58(receiptData);
          
          try {
            await bluetoothPrinterManager.printToConnectedPrinter(receiptBytes);
            showToast({ type: 'success', message: `✅ Printed to ${bluetoothStatus.connectedPrinter.name}` });
            return;
          } catch (err) {
            console.error('❌ Bluetooth print failed:', err);
            showToast({ type: 'warning', message: 'Bluetooth printer connection lost. Opening dialog...' });
          }
        } else {
          // No connected printer - offer to scan
          console.log('🔍 No Bluetooth printer connected. Prompting to scan...');
          showToast({ type: 'info', message: 'No Bluetooth printer connected. Opening printer selection...' });
          
          try {
            const printers = await bluetoothPrinterManager.scanPrinters();
            if (printers.length > 0) {
              const printer = printers[0];
              console.log('🔗 Connecting to scanned printer:', printer.name);
              await bluetoothPrinterManager.connectToPrinter(printer);
              
              // Now print
              const receiptBytes = buildSalaryReceipt58(receiptData);
              await bluetoothPrinterManager.printToConnectedPrinter(receiptBytes);
              showToast({ type: 'success', message: `✅ Printed to ${printer.name}` });
              return;
            }
          } catch (scanErr) {
            console.warn('⚠️ Bluetooth scan cancelled or failed:', scanErr.message);
          }
        }
        
        // If Bluetooth fails on mobile, fall back to browser print
        console.log('⚠️ Bluetooth unavailable, opening browser print dialog');
        showToast({ type: 'info', message: 'Using browser print. Select a Bluetooth printer from the print dialog.' });
        openBrowserPrint(teller, dailyOver);
      } else {
        // Desktop: Check for USB printer first
        console.log('🖥️ Desktop device detected');
        const bluetoothStatus = bluetoothPrinterManager.getStatus();
        
        if (bluetoothStatus.isConnected) {
          // Bluetooth connected on desktop
          const receiptBytes = buildSalaryReceipt58(receiptData);
          await bluetoothPrinterManager.printToConnectedPrinter(receiptBytes);
          showToast({ type: 'success', message: `✅ Printed to ${bluetoothStatus.connectedPrinter.name}` });
          return;
        }
        
        if (autoPrintEnabled && selectedPrinter) {
          // Use USB printer via Electron if available
          console.log('🖨️ Printing to USB printer:', selectedPrinter.name);
          try {
            await window.electronAPI?.printSalaryReceipt(receiptData, selectedPrinter.name);
            showToast({ type: 'success', message: 'Sent to printer: ' + selectedPrinter.name });
            return;
          } catch (err) {
            console.warn('⚠️ USB print failed:', err);
          }
        }
        
        // Fall back to browser print
        openBrowserPrint(teller, dailyOver);
      }
    } catch (error) {
      console.error('Print error:', error);
      showToast({ type: 'error', message: 'Print error: ' + error.message });
      openBrowserPrint(teller, dailyOver);
    }
  };

  const openBrowserPrint = (teller, dailyOver) => {
    const html = buildPrintHtml(teller, dailyOver);
    const printWindow = window.open('', '_blank', 'width=400,height=800');
    
    if (!printWindow) {
      showToast({ type: 'error', message: 'Failed to open print window. Check popup blocker.' });
      return;
    }
    
    try {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
      
      showToast({ type: 'success', message: 'Print dialog opened. Select A4 or Thermal printer.' });
    } catch (error) {
      console.error('Browser print error:', error);
      showToast({ type: 'error', message: 'Print failed: ' + error.message });
      printWindow.close();
    }
  };

  const handleBatchPrint = () => {
    const html = buildA4BatchPrintHtml();
    if (!html) return;

    const printWindow = window.open('', '_blank', 'width=960,height=1280');
    if (!printWindow) {
      showToast({ type: 'error', message: 'Failed to open print window. Please check your popup blocker.' });
      return;
    }
    
    try {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      
      // Trigger print dialog after content loads
      setTimeout(() => {
        printWindow.print();
        showToast({ type: 'success', message: 'Print dialog opened for A4 batch printing.' });
      }, 500);
    } catch (error) {
      console.error('Print error:', error);
      showToast({ type: 'error', message: 'Print failed: ' + error.message });
      printWindow.close();
    }
  };

  const buildA4BatchPrintHtml = () => {
    const weekLabel = getWeekRangeLabel();
    const selectedTellerIds = Object.keys(selectedTellers).filter(id => selectedTellers[id]);

    if (selectedTellerIds.length === 0) {
      showToast({ type: 'error', message: 'No tellers selected for batch printing' });
      return null;
    }

    // Get selected tellers data
    const selectedTellersData = tellers.filter(teller => selectedTellerIds.includes(teller.id.toString()));

    // Group tellers into pages (6 per page)
    const tellersPerPage = 6;
    const pages = [];
    for (let i = 0; i < selectedTellersData.length; i += tellersPerPage) {
      pages.push(selectedTellersData.slice(i, i + tellersPerPage));
    }

    const pageHtml = pages.map((pageTellers, pageIndex) => {
      const tellerCards = pageTellers.map(teller => {
        const dailyOver = teller.over || {};

        // Calculate salary data for this teller
        let totalBaseSalary = 0;
        const dailyData = dayLabels.map(({ key, label }) => {
          const overAmount = dailyOver[key] || 0;
          const noBSalaryKey = `${teller.id}-${key}`;
          const isIncluded = noBSalarDays[noBSalaryKey];
          const baseSalaryForDay = isIncluded ? baseSalaryAmount : 0;
          totalBaseSalary += baseSalaryForDay;
          return { day: label, over: overAmount, base: baseSalaryForDay };
        });

        const totalOver = sumOver(dailyOver);
        const totalCompensation = totalBaseSalary + totalOver;

        return `
          <div class="teller-card">
            <div class="card-header">
              <div class="header-content">
                <h3 class="teller-name">${teller.name}</h3>
                <p class="teller-id">Teller ID: ${teller.id}</p>
              </div>
            </div>
            <div class="card-content">
              <div class="base-salary-section">
                <div class="section-header">
                  <span class="section-title">Base Salary</span>
                  <span class="section-amount">₱${baseSalaryAmount.toFixed(2)}</span>
                </div>
              </div>
              <div class="daily-over-section">
                <h4 class="section-title-daily">Daily Over (Cash) - Click to toggle base salary per day</h4>
                <div class="daily-grid-header">
                  <span>Day</span>
                  <span>Over</span>
                  <span>Base Salary</span>
                  <span class="text-center">Include?</span>
                </div>
                <div class="daily-rows">
                  ${dailyData.map(row => {
                    const dayKey = dayLabels.find(d => d.label === row.day)?.key;
                    const noBSalaryKey = `${teller.id}-${dayKey}`;
                    const isExcluded = noBSalarDays[noBSalaryKey];  // true = excluded
                    return `
                      <div class="daily-row ${isExcluded ? 'excluded' : 'included'}">
                        <span class="day-label">${row.day}</span>
                        <span class="over-amount ${row.over > 0 ? 'positive' : row.over < 0 ? 'negative' : 'zero'}">₱${row.over.toFixed(2)}</span>
                        <span class="base-amount ${!isExcluded ? 'included' : 'excluded'}">₱${!isExcluded ? row.base.toFixed(2) : '0.00'}</span>
                        <span class="include-status">${!isExcluded ? 'YES' : 'NO'}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
              <div class="weekly-total-section">
                <div class="total-row">
                  <span class="total-label">Weekly Over Total</span>
                  <span class="total-amount ${totalOver > 0 ? 'positive' : totalOver < 0 ? 'negative' : 'zero'}">₱${totalOver.toFixed(2)}</span>
                </div>
              </div>
              <div class="compensation-section">
                <div class="compensation-header">Total Compensation</div>
                <div class="compensation-amount">₱${totalCompensation.toFixed(2)}</div>
                <p class="compensation-breakdown">
                  Base (${dailyData.filter(row => {
                    const dayKey = dayLabels.find(d => d.label === row.day)?.key;
                    const noBSalaryKey = `${teller.id}-${dayKey}`;
                    return !noBSalarDays[noBSalaryKey];  // Count if NOT excluded
                  }).length} days × ₱${baseSalaryAmount}) ₱${dailyData.reduce((sum, row) => {
                    const dayKey = dayLabels.find(d => d.label === row.day)?.key;
                    const noBSalaryKey = `${teller.id}-${dayKey}`;
                    return sum + (!noBSalarDays[noBSalaryKey] ? row.base : 0);  // Add if NOT excluded
                  }, 0).toFixed(2)} + Over ₱${totalOver.toFixed(2)}
                </p>
              </div>
              <div class="signature-section">
                <div class="signature-row">
                  <span>Prepared By</span>
                  <div class="signature-line"></div>
                </div>
                <div class="signature-row">
                  <span>Supervisor Signature</span>
                  <div class="signature-line"></div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="page" ${pageIndex > 0 ? 'style="page-break-before: always;"' : ''}>
          <div class="page-header">
            <h1>RMI Teller Salary Reports</h1>
            <div class="week-info">${weekLabel}</div>
            <div class="page-info">Page ${pageIndex + 1} of ${pages.length}</div>
          </div>
          <div class="tellers-grid">
            ${tellerCards}
          </div>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Batch Teller Salary Reports</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 15mm;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', sans-serif;
      font-size: 10px;
      line-height: 1.2;
      margin: 0;
      padding: 0;
      color: #000;
    }

    .page {
      width: 100%;
      min-height: 270mm;
      padding: 10mm;
    }

    .page-header {
      text-align: center;
      margin-bottom: 15mm;
      border-bottom: 2px solid #000;
      padding-bottom: 5mm;
    }

    .page-header h1 {
      font-size: 18px;
      font-weight: bold;
      margin: 0 0 3mm 0;
    }

    .week-info {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 2mm;
    }

    .page-info {
      font-size: 10px;
      color: #666;
    }

    .tellers-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12mm;
      margin-top: 10mm;
    }

    .teller-card {
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      background: white;
      border: 1px solid #e5e7eb;
    }

    .card-header {
      background: linear-gradient(to right, #4f46e5, #4338ca);
      padding: 12px;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .teller-name {
      font-size: 14px;
      font-weight: bold;
      color: white;
      margin: 0;
    }

    .teller-id {
      font-size: 10px;
      color: #e0e7ff;
      margin: 0;
    }

    .card-content {
      padding: 12px;
    }

    .base-salary-section {
      background: #f9fafb;
      padding: 8px;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #374151;
    }

    .section-amount {
      font-size: 14px;
      font-weight: bold;
      color: #4f46e5;
    }

    .daily-over-section {
      margin-bottom: 12px;
    }

    .section-title-daily {
      font-size: 10px;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .daily-grid-header {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 4px;
      font-size: 9px;
      font-weight: 600;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }

    .daily-rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .daily-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 4px;
      align-items: center;
      padding: 4px;
      border-radius: 4px;
      font-size: 9px;
    }

    .daily-row.included {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }

    .daily-row.excluded {
      background: white;
      border: 1px solid #e5e7eb;
    }

    .day-label {
      font-weight: 500;
      color: #374151;
    }

    .over-amount.positive {
      color: #16a34a;
      font-weight: 600;
    }

    .over-amount.negative {
      color: #dc2626;
      font-weight: 600;
    }

    .over-amount.zero {
      color: #6b7280;
    }

    .base-amount.included {
      color: #16a34a;
      font-weight: 600;
    }

    .base-amount.excluded {
      color: #6b7280;
      text-decoration: line-through;
    }

    .include-status {
      text-align: center;
      font-weight: 600;
      color: #374151;
    }

    .weekly-total-section {
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
      margin-bottom: 12px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .total-label {
      font-weight: 600;
      color: #374151;
      font-size: 11px;
    }

    .total-amount.positive {
      font-size: 16px;
      font-weight: bold;
      color: #16a34a;
    }

    .total-amount.negative {
      font-size: 16px;
      font-weight: bold;
      color: #dc2626;
    }

    .total-amount.zero {
      font-size: 16px;
      font-weight: bold;
      color: #6b7280;
    }

    .compensation-section {
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      padding: 8px;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    .compensation-header {
      font-size: 10px;
      font-weight: 600;
      color: #4338ca;
      margin-bottom: 4px;
    }

    .compensation-amount {
      font-size: 18px;
      font-weight: bold;
      color: #4f46e5;
      margin-bottom: 4px;
    }

    .compensation-breakdown {
      font-size: 8px;
      color: #6366f1;
      margin: 0;
      line-height: 1.2;
    }

    .signature-section {
      border-top: 1px dashed #9ca3af;
      padding-top: 8px;
      font-size: 9px;
      color: #6b7280;
    }

    .signature-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .signature-line {
      border-top: 1px dashed #9ca3af;
      flex: 1;
      margin-left: 8px;
      height: 16px;
    }
  </style>
</head>
<body>
  ${pageHtml}
</body>
</html>`;

    return html;
  };

  const fetchAvailablePrinters = async () => {
    if (!window?.electronAPI?.getAvailablePrinters) {
      console.warn('Electron API not available for getting printers');
      return;
    }
    try {
      const printers = await window.electronAPI.getAvailablePrinters();
      setAvailablePrinters(printers || []);
      
      // Restore previously selected printer if available
      const savedPrinterName = localStorage.getItem('selectedPrinterName');
      if (savedPrinterName) {
        const savedPrinter = printers.find(p => p.name === savedPrinterName);
        if (savedPrinter) {
          setSelectedPrinter(savedPrinter);
        } else if (printers.length > 0) {
          setSelectedPrinter(printers[0]);
        }
      } else if (printers.length > 0) {
        // Auto-select thermal printer if found
        const thermalPrinter = printers.find(p => 
          p.name.toLowerCase().includes('58') || 
          p.name.toLowerCase().includes('thermal') || 
          p.name.toLowerCase().includes('receipt') ||
          p.name.toLowerCase().includes('xprinter')
        );
        setSelectedPrinter(thermalPrinter || printers[0]);
      }
    } catch (err) {
      console.error('Error fetching printers:', err);
    }
  };

  const handleSelectPrinter = (printer) => {
    setSelectedPrinter(printer);
    localStorage.setItem('selectedPrinterName', printer.name);
    showToast({ type: 'success', message: `Printer set to: ${printer.name}` });
  };

  const toggleAutoPrint = (enabled) => {
    setAutoPrintEnabled(enabled);
    localStorage.setItem('autoPrintEnabled', enabled.toString());
    showToast({ 
      type: 'info', 
      message: enabled ? 'Auto-print enabled' : 'Auto-print disabled' 
    });
  };

  // Bluetooth printer functions
  const scanBluetoothPrinters = async () => {
    try {
      showToast({ type: 'info', message: 'Scanning for Bluetooth printers...' });
      const printers = await bluetoothPrinterManager.scanPrinters();
      setBluetoothPrinters(printers);
      setBluetoothStatus(bluetoothPrinterManager.getStatus());
      showToast({ type: 'success', message: `Found ${printers.length} Bluetooth device(s)` });
    } catch (error) {
      console.error('Bluetooth scan failed:', error);
      showToast({ type: 'error', message: 'Bluetooth scan failed: ' + error.message });
    }
  };

  const connectToBluetoothPrinter = async (printer) => {
    try {
      showToast({ type: 'info', message: `Connecting to ${printer.name}...` });
      await bluetoothPrinterManager.connectToPrinter(printer);
      setBluetoothStatus(bluetoothPrinterManager.getStatus());
      showToast({ type: 'success', message: `Connected to ${printer.name}` });
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      showToast({ type: 'error', message: 'Connection failed: ' + error.message });
    }
  };

  const disconnectBluetoothPrinter = async () => {
    try {
      await bluetoothPrinterManager.disconnect();
      setBluetoothStatus(bluetoothPrinterManager.getStatus());
      showToast({ type: 'success', message: 'Bluetooth printer disconnected' });
    } catch (error) {
      console.error('Disconnect failed:', error);
      showToast({ type: 'error', message: 'Disconnect failed: ' + error.message });
    }
  };

  // Check if user is super_admin or supervisor
  const isSuperAdminOrSupervisor = user?.role === 'super_admin' || user?.role === 'supervisor';

  // Persist base salary toggle state to localStorage
  useEffect(() => {
    localStorage.setItem('noBSalarDays', JSON.stringify(noBSalarDays));
  }, [noBSalarDays]);

  useEffect(() => {
    if (!isSuperAdminOrSupervisor) {
      showToast({ type: 'error', message: 'Access denied. Only superadmin and supervisors can view this page.' });
      return;
    }
    fetchTellerSalaryData();
    fetchAvailablePrinters();
  }, [selectedWeek, isSuperAdminOrSupervisor]);

  const fetchTellerSalaryData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Get the week start (Monday) - using local time, not UTC
      const date = new Date(selectedWeek);
      const dayOfWeek = date.getDay();
      const diffToMonday = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const start = new Date(date.setDate(diffToMonday));
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // Sunday

      setWeekStart(start);
      setWeekEnd(end);

      // Format dates as YYYY-MM-DD using local time (not UTC)
      const formatLocalDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const response = await axios.get(
        `${getApiUrl()}/api/teller-salary-calculation`,
        {
          params: {
            weekStart: formatLocalDate(start),
            weekEnd: formatLocalDate(end),
            supervisorId: user?.role === 'supervisor' ? user?.id : undefined
          },
          headers
        }
      );

      setTellers(response.data?.tellers || []);
    } catch (err) {
      console.error('Error fetching teller salary data:', err);
      showToast({ type: 'error', message: 'Failed to load teller salary data' });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    const date = new Date(selectedWeek);
    date.setDate(date.getDate() - 7);
    setSelectedWeek(date.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const date = new Date(selectedWeek);
    date.setDate(date.getDate() + 7);
    setSelectedWeek(date.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedWeek(new Date().toISOString().split('T')[0]);
  };

  if (!isSuperAdminOrSupervisor) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${dark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-sm opacity-70">You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            Teller Salary Calculation
          </h1>
          <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
            Weekly overtime and salary summary
          </p>
        </div>

        {/* Week Navigation */}
        <div className={`mb-6 p-4 rounded-lg ${dark ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousWeek}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                title="Previous week"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleToday}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
              >
                This Week
              </button>
              <button
                onClick={handleNextWeek}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                title="Next week"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={18} />
              <input
                type="date"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${
                  dark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div className={`text-sm font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {weekStart && weekEnd && (
                <>
                  {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </>
              )}
            </div>

            {/* Printer Settings Button */}
            <button
              onClick={() => setShowPrinterSettings(!showPrinterSettings)}
              className={`p-2 rounded-lg transition flex items-center gap-2 text-sm font-semibold ${
                showPrinterSettings
                  ? 'bg-indigo-600 text-white'
                  : dark
                  ? 'hover:bg-gray-700 text-gray-300'
                  : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="Printer settings"
            >
              <Settings2 size={18} />
              {selectedPrinter && <span className="hidden sm:inline">{selectedPrinter.name}</span>}
            </button>

            {/* Batch Print Button */}
            {tellers.length > 0 && Object.keys(selectedTellers).length > 0 && (
              <button
                onClick={handleBatchPrint}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                title="Print selected tellers on A4 paper (6 per page)"
              >
                <Printer size={18} />
                <span>Print A4 ({Object.keys(selectedTellers).length})</span>
              </button>
            )}
          </div>

          {/* Printer Settings Panel */}
          {showPrinterSettings && (
            <div className={`mt-4 p-4 rounded-lg border-2 border-indigo-600 ${dark ? 'bg-gray-700' : 'bg-indigo-50'}`}>
              <h3 className={`font-semibold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
                <HardDrive size={18} className="inline mr-2" />
                Printer Settings
              </h3>

              {/* USB Printer Section */}
              <div className="mb-6">
                <h4 className={`font-medium mb-2 ${dark ? 'text-gray-200' : 'text-gray-800'}`}>
                  USB Printers (Desktop)
                </h4>
                
                {availablePrinters.length === 0 ? (
                  <div className={`text-sm p-2 rounded ${dark ? 'bg-gray-600 text-gray-300' : 'bg-white text-gray-600'}`}>
                    No USB printers found. Please connect a USB printer.
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {availablePrinters.map((printer) => (
                      <button
                        key={printer.name}
                        onClick={() => handleSelectPrinter(printer)}
                        className={`w-full p-3 rounded-lg text-left transition flex items-center gap-3 ${
                          selectedPrinter?.name === printer.name
                            ? 'bg-indigo-600 text-white'
                            : dark
                            ? 'bg-gray-600 hover:bg-gray-500 text-gray-100'
                            : 'bg-white hover:bg-gray-100 text-gray-900 border'
                        }`}
                      >
                        <HardDrive size={16} />
                        <div>
                          <div className="font-semibold text-sm">{printer.name}</div>
                          {printer.isDefault && (
                            <div className="text-xs opacity-70">(Default Printer)</div>
                          )}
                        </div>
                        {selectedPrinter?.name === printer.name && (
                          <div className="ml-auto">✓</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bluetooth Printer Section */}
              <div className="mb-6">
                <h4 className={`font-medium mb-2 ${dark ? 'text-gray-200' : 'text-gray-800'}`}>
                  Bluetooth Printers (Mobile)
                </h4>

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={scanBluetoothPrinters}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition flex items-center gap-2"
                  >
                    🔍 Scan Bluetooth
                  </button>
                  
                  {bluetoothStatus.isConnected && (
                    <button
                      onClick={disconnectBluetoothPrinter}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition"
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                {bluetoothStatus.isConnected ? (
                  <div className={`p-3 rounded-lg ${dark ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="font-semibold">Connected to {bluetoothStatus.connectedPrinter?.name}</span>
                    </div>
                  </div>
                ) : bluetoothPrinters.length > 0 ? (
                  <div className="space-y-2">
                    {bluetoothPrinters.map((printer) => (
                      <button
                        key={printer.id}
                        onClick={() => connectToBluetoothPrinter(printer)}
                        className={`w-full p-3 rounded-lg text-left transition flex items-center gap-3 ${
                          dark
                            ? 'bg-gray-600 hover:bg-gray-500 text-gray-100'
                            : 'bg-white hover:bg-gray-100 text-gray-900 border'
                        }`}
                      >
                        📡
                        <div>
                          <div className="font-semibold text-sm">{printer.name}</div>
                          <div className="text-xs opacity-70">Bluetooth Device</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={`text-sm p-2 rounded ${dark ? 'bg-gray-600 text-gray-300' : 'bg-white text-gray-600'}`}>
                    No Bluetooth printers found. Click "Scan Bluetooth" to search for devices.
                  </div>
                )}
              </div>

              <div className={`p-3 rounded-lg border ${dark ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'} mt-3`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrintEnabled}
                    onChange={(e) => toggleAutoPrint(e.target.checked)}
                    className="rounded"
                  />
                  <span className={`text-sm font-medium ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
                    Auto-print when button clicked
                  </span>
                </label>
                <p className={`text-xs mt-2 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                  When enabled, clicking print will directly send to the selected printer without showing a preview.
                </p>
              </div>

              <button
                onClick={() => setShowPrinterSettings(false)}
                className="w-full mt-3 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition text-sm"
              >
                Close Settings
              </button>
            </div>
          )}
        </div>

        {/* Teller Cards Grid */}
        <div>
          {tellers.length > 0 && (
            <div className="mb-4 flex gap-2">
              <button
                onClick={toggleSelectAll}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  tellers.length > 0 && Object.keys(selectedTellers).length === tellers.length
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : dark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                {tellers.length > 0 && Object.keys(selectedTellers).length === tellers.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
              {Object.keys(selectedTellers).length > 0 && (
                <span className={`px-4 py-2 rounded-lg font-semibold ${dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-900'}`}>
                  {Object.keys(selectedTellers).length} selected
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tellers.length === 0 ? (
            <div className={`col-span-full p-8 rounded-lg text-center ${dark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
              <p>No tellers found for this week</p>
            </div>
          ) : (
            tellers.map((teller) => {
              const dailyOver = teller.over || {};
              const dailyShort = teller.short || {};
              const totalOver = sumOver(dailyOver);
              const totalShort = sumOver(dailyShort);
              const baseSalary = baseSalaryAmount;
              
              // Auto-select base salary for days with over or short
              const includedDaysCount = dayLabels.filter(({ key }) => {
                const noBSalaryKey = `${teller.id}-${key}`;
                // By default, include base salary unless explicitly excluded (noBSalarDays[key] = true)
                const isExcluded = noBSalarDays[noBSalaryKey];
                return !isExcluded;  // Return true if NOT excluded
              }).length;
              const adjustedBaseWeeklySum = baseSalaryAmount * includedDaysCount;
              // Total compensation = Base + Over - Short
              const totalCompensation = adjustedBaseWeeklySum + totalOver - totalShort;

              return (
                <div
                  key={teller.id}
                  className={`rounded-xl shadow-lg overflow-hidden transition transform hover:shadow-xl ${
                    dark ? 'bg-gray-800' : 'bg-white'
                  }`}
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4">
                    <div className="flex justify-between items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleTellerSelection(teller.id)}
                        className="flex-shrink-0 mt-0.5 text-white hover:opacity-80 transition"
                        title="Select for batch print"
                      >
                        {selectedTellers[teller.id] ? (
                          <CheckSquare size={20} />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>
                      <div>
                        <h3 className="text-lg font-bold text-white">{teller.name}</h3>
                        <p className="text-indigo-100 text-sm">Teller ID: {teller.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrint(teller)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-white text-xs font-semibold transition flex-shrink-0"
                      >
                        <Printer size={14} />
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={() => copyReportToClipboard(teller)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-white text-xs font-semibold transition flex-shrink-0"
                        title="Copy report to clipboard"
                      >
                        <Copy size={14} />
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    {/* Base Salary */}
                    <div className={`mb-4 p-3 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Base Salary
                        </span>
                        <span className="text-lg font-bold text-indigo-600">
                          ₱{baseSalary.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Daily Over */}
                    <div className="mb-4">
                      <h4 className={`text-sm font-semibold mb-3 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Daily Over (Cash) - Click to toggle base salary per day
                      </h4>
                      <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b pb-2">
                        <span>Day</span>
                        <span>Over</span>
                        <span>Short</span>
                        <span>Base Salary</span>
                        <span className="text-center">Include?</span>
                      </div>
                      <div className="space-y-2 mt-3">
                        {dayLabels.map(({ key, label }) => {
                          const overAmount = dailyOver[key] || 0;
                          const shortAmount = (teller.short && teller.short[key]) || 0;
                          const tellerId = teller.id;
                          const noBSalaryKey = `${tellerId}-${key}`;
                          const hasOverOrShort = overAmount > 0 || shortAmount > 0;
                          // If there's over or short, auto-include base salary; otherwise use saved preference
                          const isIncluded = hasOverOrShort || noBSalarDays[noBSalaryKey];
                          const baseSalaryForDay = isIncluded ? baseSalaryAmount : 0;
                          
                          return (
                            <div key={key} className={`grid grid-cols-5 gap-2 items-center p-2 rounded ${
                              !isIncluded 
                                ? dark ? 'bg-gray-800' : 'bg-white' 
                                : dark ? 'bg-green-900/20' : 'bg-green-50'
                            } border ${!isIncluded ? dark ? 'border-gray-700' : 'border-gray-200' : 'border-green-300'}`}>
                              <div className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</div>
                              <div className={`text-sm font-semibold ${
                                overAmount > 0 ? 'text-green-600' : overAmount < 0 ? 'text-red-600' : dark ? 'text-gray-500' : 'text-gray-400'
                              }`}>₱{overAmount.toFixed(2)}</div>
                              <div className={`text-sm font-semibold ${
                                shortAmount > 0 ? 'text-orange-600' : dark ? 'text-gray-500' : 'text-gray-400'
                              }`}>₱{shortAmount.toFixed(2)}</div>
                              <div className={`text-sm font-semibold ${isIncluded ? 'text-green-600' : dark ? 'text-gray-500' : 'text-gray-400 line-through'}`}>
                                ₱{baseSalaryForDay.toFixed(2)}
                              </div>
                              <button
                                onClick={() => toggleBaseSalaryDay(tellerId, key)}
                                className={`px-2 py-1 rounded text-xs font-semibold transition ${
                                  isIncluded
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : dark
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                                }`}
                                title={isIncluded ? 'Click to exclude base salary' : 'Click to include base salary'}
                                disabled={hasOverOrShort}
                              >
                                {isIncluded ? 'YES' : 'NO'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weekly Total Over and Short */}
                    <div className={`pt-3 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Weekly Over Total
                        </span>
                        <span className={`text-lg font-bold ${totalOver > 0 ? 'text-green-600' : totalOver < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          ₱{totalOver.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Weekly Short Total
                        </span>
                        <span className={`text-lg font-bold ${totalShort > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                          ₱{totalShort.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className={`font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Net (Over - Short)
                        </span>
                        <span className={`text-lg font-bold ${(totalOver - totalShort) > 0 ? 'text-green-600' : (totalOver - totalShort) < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          ₱{(totalOver - totalShort).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Total Compensation */}
                    <div className={`mt-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700`}>
                      <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
                        Total Compensation
                      </div>
                        <div className="text-2xl font-bold text-indigo-600">
                          ₱{totalCompensation.toFixed(2)}
                        </div>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                          Base ({includedDaysCount} days × ₱{baseSalaryAmount}) ₱{adjustedBaseWeeklySum.toFixed(2)} + Over ₱{totalOver.toFixed(2)} - Short ₱{totalShort.toFixed(2)}
                        </p>
                    </div>
                    <div className="mt-4 border-t border-dashed border-gray-400 pt-3 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>Prepared By</span>
                        <div className="border-t border-dashed border-gray-400 w-32" />
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span>Supervisor Signature</span>
                        <div className="border-t border-dashed border-gray-400 w-32" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Summary Stats */}
        {tellers.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Total Tellers</p>
              <p className="text-3xl font-bold text-indigo-600">{tellers.length}</p>
            </div>
            
            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Weekly Base Salary (Each)</p>
              <p className="text-3xl font-bold text-green-600">₱{baseWeeklySum.toFixed(2)}</p>
            </div>

            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Total Weekly Over</p>
              <p className="text-3xl font-bold text-green-600">
                ₱{tellers.reduce((sum, t) => sum + sumOver(t.over), 0).toFixed(2)}
              </p>
            </div>

            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Avg Weekly Over</p>
              <p className="text-3xl font-bold text-purple-600">
                ₱{(tellers.length > 0 ? tellers.reduce((sum, t) => sum + sumOver(t.over), 0) / tellers.length : 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
