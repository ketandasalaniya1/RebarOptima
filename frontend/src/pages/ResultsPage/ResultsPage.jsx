import React, { useState, useEffect } from 'react'
import './ResultsPage.css'
import html2pdf from 'html2pdf.js'
import { batchesApi, inventoryApi } from '../../utils/api'
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  Package,
  TrendingUp,
  ClipboardList,
  Scissors,
  PieChart,
  Trash2,
  BarChart3,
  FileDown,
  FileSpreadsheet,
  Recycle,
  Tag,
  X
} from 'lucide-react'


const mockLayouts = [
  {
    id: 'A',
    repetition: 8,
    stockLength: 12000,
    parts: [
      { length: 4500, color: '#36454F' },
      { length: 1200, color: '#71797E' },
      { length: 950, color: '#708090' },
      { length: 760, color: '#808080' },
      { length: 760, color: '#808080' },
      { length: 760, color: '#808080' },
      { length: 760, color: '#808080' },
      { length: 760, color: '#808080' },
      { length: 760, color: '#808080' },
      { length: 760, color: '#808080' },
    ],
    cutsCount: 10,
    waste: '30 mm (0.25%)',
    utilization: 99.75,
  },
  {
    id: 'B',
    repetition: 2,
    stockLength: 12000,
    parts: [
      { length: 4500, color: '#36454F' },
      { length: 1200, color: '#71797E' },
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
      { length: 760, color: '#808080' },
      { length: 760, color: '#808080' },
    ],
    cutsCount: 9,
    waste: '30 mm (0.25%)',
    utilization: 99.75,
  },
  {
    id: 'C',
    repetition: 15,
    stockLength: 12000,
    parts: [
      { length: 4500, color: '#36454F' },
      { length: 4500, color: '#36454F' },
      { length: 1200, color: '#71797E' },
      { length: 950, color: '#708090' },
      { length: 760, color: '#808080' },
    ],
    cutsCount: 5,
    waste: '90 mm (0.75%)',
    utilization: 99.25,
  },
  {
    id: 'D',
    repetition: 3,
    stockLength: 12000,
    parts: [
      { length: 4500, color: '#36454F' },
      { length: 1200, color: '#71797E' },
      { length: 1200, color: '#71797E' },
      { length: 1200, color: '#71797E' },
      { length: 1200, color: '#71797E' },
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
      { length: 760, color: '#808080' },
    ],
    cutsCount: 8,
    waste: '40 mm (0.33%)',
    utilization: 99.67,
  },
  {
    id: 'E',
    repetition: 17,
    stockLength: 12000,
    parts: [
      { length: 4500, color: '#36454F' },
      { length: 4500, color: '#36454F' },
      { length: 1200, color: '#71797E' },
      { length: 950, color: '#708090' },
      { length: 760, color: '#808080' },
    ],
    cutsCount: 5,
    waste: '90 mm (0.75%)',
    utilization: 99.25,
  },
  {
    id: 'F',
    repetition: 1,
    stockLength: 12000,
    parts: [
      { length: 4500, color: '#36454F' },
      { length: 1200, color: '#71797E' },
      { length: 1200, color: '#71797E' },
      { length: 1200, color: '#71797E' },
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
    ],
    cutsCount: 8,
    waste: '100 mm (0.83%)',
    utilization: 99.17,
  },
  {
    id: 'G',
    repetition: 1,
    stockLength: 12000,
    parts: [
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
      { length: 950, color: '#708090' },
      { length: 760, color: '#808080' },
      { length: 760, color: '#808080' },
      { length: 760, color: '#808080' },
    ],
    cutsCount: 6,
    waste: '6,870 mm (57.25%)',
    utilization: 42.75,
  },
];

const getTextStyle = (hex) => {
  if (!hex || hex.startsWith('var')) return {};
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 135
    ? { color: '#ffffff' }
    : { color: '#111827' };
};

export default function ResultsPage({ data, onBack, onSaveSuccess }) {
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [scrapRulesMap, setScrapRulesMap] = useState({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [batchNameInput, setBatchNameInput] = useState(() => data?.batchName || `Batch #${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);

  useEffect(() => {
    if (data?.batchName) {
      setBatchNameInput(data.batchName);
    }
  }, [data?.batchName]);

  useEffect(() => {
    async function loadScrapRules() {
      try {
        const rules = await inventoryApi.getScrapRules();
        if (Array.isArray(rules)) {
          const map = {};
          rules.forEach(r => {
            map[Number(r.diameter)] = Number(r.scrapLengthThreshold);
          });
          setScrapRulesMap(map);
        }
      } catch (err) {
        console.warn('Failed to load scrap rules, defaulting to 1000mm threshold', err);
      }
    }
    loadScrapRules();
  }, []);

  const handleOpenSaveModal = () => {
    setSaveError('');
    setShowSaveModal(true);
  };

  const handleConfirmSaveBatch = async () => {
    const nameToSave = batchNameInput.trim() || `Batch #${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    setSaveLoading(true);
    setSaveError('');
    try {
      await batchesApi.commitBatch({
        batchName: nameToSave,
        inputStock: data?.inputStock || [],
        requiredParts: data?.requiredParts || [],
        layouts: layouts.map(l => ({
          repetition: l.repetition,
          diameter: l.diameter,
          stockLength: l.stockLength,
          isVirtual: !!l.isVirtual,
          dbId: l.dbId,
          waste: l.waste,
          isRemnant: !!l.isRemnant,
          parts: l.parts
        })),
        summary: {
          totalPartsLength: summary.totalPartsLength,
          totalUsedStockLength: summary.totalUsedStockLength,
          totalCutsCount: summary.totalCutsCount,
          totalRemnant: summary.totalRemnant,
          avgUtilization: summary.avgUtilization
        }
      });
      setShowSaveModal(false);
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (err) {
      setSaveError(err.message || 'Failed to save batch.');
    } finally {
      setSaveLoading(false);
    }
  };


  const layouts = (data ? data.layouts : mockLayouts).slice().sort((a, b) => parseFloat(a.diameter) - parseFloat(b.diameter));
  const summary = data ? data.summary : {
    totalPartsLength: 554480,
    totalUsedStockLength: 564000,
    totalCutsCount: 296,
    totalRemnant: 6870,
    avgUtilization: 98.312
  };

  const totalPartsQty = layouts.reduce((sum, l) => sum + (l.parts.length * l.repetition), 0);
  const totalBarsUsed = layouts.reduce((sum, l) => sum + l.repetition, 0);

  // Group layouts to show required stocks
  const requiredStocksMap = {};
  layouts.forEach(l => {
    const key = `${l.diameter}-${l.stockLength}-${l.isVirtual ? 'v' : 'r'}`;
    if (!requiredStocksMap[key]) {
      requiredStocksMap[key] = {
        diameter: l.diameter || '12',
        length: l.stockLength,
        quantity: 0,
        isVirtual: !!l.isVirtual
      };
    }
    requiredStocksMap[key].quantity += l.repetition;
  });
  const requiredStocks = Object.values(requiredStocksMap).sort((a, b) => parseFloat(a.diameter) - parseFloat(b.diameter));

  // Group layouts by diameter for wastage, remnant, scrap, and utilization in kg according to Scrap Rules
  const diaWeightSummaryMap = {};
  layouts.forEach(l => {
    const dia = l.diameter || '12';
    const diaNum = parseFloat(dia);
    if (!diaWeightSummaryMap[dia]) {
      diaWeightSummaryMap[dia] = {
        diameter: dia,
        totalStockLength: 0,
        totalPartsLength: 0,
        remnantKg: 0,
        scrapKg: 0,
        threshold: scrapRulesMap[diaNum] ?? 1000
      };
    }
    diaWeightSummaryMap[dia].threshold = scrapRulesMap[diaNum] ?? 1000;
    diaWeightSummaryMap[dia].totalStockLength += l.stockLength * l.repetition;
    
    const layoutPartsLength = l.parts.reduce((sum, p) => sum + p.length, 0);
    diaWeightSummaryMap[dia].totalPartsLength += layoutPartsLength * l.repetition;

    // Parse waste length in mm per bar
    let wasteLen = parseFloat(l.waste);
    if (isNaN(wasteLen)) {
      wasteLen = Math.max(0, l.stockLength - layoutPartsLength);
    }

    if (wasteLen > 0) {
      const weightPerMeter = (diaNum * diaNum) / 162;
      const wasteWeightKg = (wasteLen / 1000) * weightPerMeter * l.repetition;
      const threshold = diaWeightSummaryMap[dia].threshold;

      if (wasteLen >= threshold) {
        diaWeightSummaryMap[dia].remnantKg += wasteWeightKg;
      } else {
        diaWeightSummaryMap[dia].scrapKg += wasteWeightKg;
      }
    }
  });

  const diaWeightSummary = Object.values(diaWeightSummaryMap)
    .map(d => {
      const diaNum = parseFloat(d.diameter);
      const weightPerMeter = Math.round(((diaNum * diaNum) / 162) * 100) / 100;
      const totalStockKg = (d.totalStockLength / 1000) * weightPerMeter;
      const utilisationKg = (d.totalPartsLength / 1000) * weightPerMeter;
      const remnantKg = d.remnantKg;
      const scrapKg = d.scrapKg;
      const totalWastageKg = remnantKg + scrapKg;
      const wastagePercent = totalStockKg > 0 ? (totalWastageKg / totalStockKg) * 100 : 0;
      const remnantPercent = totalStockKg > 0 ? (remnantKg / totalStockKg) * 100 : 0;
      const scrapPercent = totalStockKg > 0 ? (scrapKg / totalStockKg) * 100 : 0;
      const utilisationPercent = totalStockKg > 0 ? (utilisationKg / totalStockKg) * 100 : 0;
      return {
        diameter: d.diameter,
        threshold: d.threshold,
        totalStockKg,
        utilisationKg,
        remnantKg,
        scrapKg,
        totalWastageKg,
        wastagePercent,
        remnantPercent,
        scrapPercent,
        utilisationPercent
      };
    })
    .sort((a, b) => parseFloat(a.diameter) - parseFloat(b.diameter));

  const totalStockKgSum = diaWeightSummary.reduce((sum, d) => sum + d.totalStockKg, 0);
  const totalUtilisationKgSum = diaWeightSummary.reduce((sum, d) => sum + d.utilisationKg, 0);
  const totalRemnantKgSum = diaWeightSummary.reduce((sum, d) => sum + d.remnantKg, 0);
  const totalScrapKgSum = diaWeightSummary.reduce((sum, d) => sum + d.scrapKg, 0);
  const totalWastageKgSum = totalRemnantKgSum + totalScrapKgSum;
  const totalWastagePercent = totalStockKgSum > 0 ? (totalWastageKgSum / totalStockKgSum) * 100 : 0;

  // Per-layout waste tracker: one row per layout with waste type, length, weight
  const wasteTracker = layouts.map((l, idx) => {
    const diaNum = parseFloat(l.diameter || '12');
    const threshold = scrapRulesMap[diaNum] ?? 1000;
    const partsLen = l.parts.reduce((sum, p) => sum + p.length, 0);
    let wasteLen = parseFloat(l.waste);
    if (isNaN(wasteLen)) wasteLen = Math.max(0, l.stockLength - partsLen);
    const isRemnant = wasteLen >= threshold && wasteLen > 0;
    const isScrap = !isRemnant && wasteLen > 0;
    const weightPerMeter = (diaNum * diaNum) / 162;
    const wasteWeightKg = (wasteLen / 1000) * weightPerMeter * l.repetition;
    return {
      layoutId: l.id,
      diameter: diaNum,
      repetition: l.repetition,
      cutsCount: l.cutsCount,
      stockLength: l.stockLength,
      wasteLenPerBar: wasteLen,
      totalWasteLen: wasteLen * l.repetition,
      wasteWeightKg,
      type: wasteLen === 0 ? 'none' : isRemnant ? 'remnant' : 'scrap',
      threshold,
      isVirtual: !!l.isVirtual,
    };
  });

  // Group wasteTracker by diameter for subtotals
  const wasteTrackerByDia = {};
  wasteTracker.forEach(row => {
    const key = String(row.diameter);
    if (!wasteTrackerByDia[key]) wasteTrackerByDia[key] = [];
    wasteTrackerByDia[key].push(row);
  });
  const wasteTrackerDias = Object.keys(wasteTrackerByDia).sort((a, b) => parseFloat(a) - parseFloat(b));

  const getCostPerKgForDia = (diameter) => {
    const stockItem = data?.inputStock?.find(s => String(s.diameter) === String(diameter));
    return stockItem?.costPerKg ? parseFloat(stockItem.costPerKg) : 60;
  };

  const totalRemnantsSavings = diaWeightSummary.reduce((sum, d) => {
    const costPerKg = getCostPerKgForDia(d.diameter);
    return sum + (d.remnantKg * costPerKg);
  }, 0);

  const totalScrapLossCost = diaWeightSummary.reduce((sum, d) => {
    const costPerKg = getCostPerKgForDia(d.diameter);
    return sum + (d.scrapKg * costPerKg);
  }, 0);

  const totalYieldValue = diaWeightSummary.reduce((sum, d) => {
    const costPerKg = getCostPerKgForDia(d.diameter);
    return sum + (d.utilisationKg * costPerKg);
  }, 0);

  const exportToExcel = () => {
    let csvContent = "Layout,Repetition,Diameter (mm),Stock Length (mm),Cuts,Waste (mm),Utilization (%),Status,Cut Details\n";

    layouts.forEach(layout => {
      const partsStr = layout.parts.map(p => `${p.length}mm`).join(" | ");
      const status = layout.isVirtual ? "Unavailable" : "Available";
      const row = `${layout.id},${layout.repetition},${layout.diameter || '12'},${layout.stockLength},${layout.cutsCount},${layout.waste},${layout.utilization.toFixed(2)}%,${status},"${partsStr}"`;
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "rebar_optima_cut_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const element = document.querySelector('.results-page');
    element.classList.add('print-mode');
    const opt = {
      margin: [14, 12, 16, 12],
      filename: 'rebar_optima_report.pdf',
      image: { type: 'jpeg', quality: 0.99 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        logging: false,
        windowWidth: 794,
        allowTaint: true
      },
      pagebreak: { mode: ['css', 'legacy'], after: '.pdf-page-break' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      ignoreElements: (el) => el.classList.contains('no-print')
    };

    html2pdf().set(opt).from(element).save().then(() => {
      element.classList.remove('print-mode');
    }).catch(err => {
      console.error('PDF Generation Error:', err);
      element.classList.remove('print-mode');
    });
  };

  const reportDate = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  return (
    <div className="results-page">
      {/* Top action header (hidden on print) */}
      <div className="results-actions no-print">
        <div className="actions-left">
          <button className="btn-edit-new" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Optimizations
          </button>
        </div>
        <div className="actions-right">
          {!data?._id && (
            <button
              className="btn-commit-batch"
              style={{
                background: '#2da44e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: saveLoading ? 'not-allowed' : 'pointer'
              }}
              onClick={handleOpenSaveModal}
              disabled={saveLoading}
            >
              <CheckCircle2 size={16} /> {saveLoading ? 'Saving Batch...' : 'Save & Commit Batch'}
            </button>
          )}
          <button className="btn-print-report" onClick={() => window.print()}>
            <Printer size={16} /> Print Report
          </button>
          <button className="btn-download-pdf" onClick={downloadPDF}>
            <FileDown size={16} /> Download PDF
          </button>
          <button className="btn-download-excel" onClick={exportToExcel}>
            <FileSpreadsheet size={16} /> Download Excel
          </button>
        </div>
      </div>

      {saveError && (
        <div className="error-alert-banner no-print" style={{ margin: '16px 0', background: 'rgba(232, 90, 58, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️ {saveError}</span>
        </div>
      )}

      {/* ── Professional Print Header (hidden on screen) ── */}
      <div className="print-report-header print-only">
        <div className="prh-brand">
          <div className="prh-logo">RO</div>
          <div>
            <div className="prh-title">RebarOptima</div>
            <div className="prh-subtitle">Steel Cutting Optimization Report</div>
          </div>
        </div>
        <div className="prh-meta">
          <div className="prh-meta-row"><strong>Generated:</strong> {reportDate}</div>
          <div className="prh-meta-row"><strong>Total Bars:</strong> {totalBarsUsed} bars &nbsp;|&nbsp; <strong>Layouts:</strong> {layouts.length}</div>
          <div className="prh-meta-row"><strong>Utilization:</strong> {summary.avgUtilization.toFixed(2)}% &nbsp;|&nbsp; <strong>Total Cuts:</strong> {summary.totalCutsCount}</div>
        </div>
      </div>

      {/* Main Title & Optimal Badge */}
      <div className="results-title-section">
        <h1 className="results-title">Optimization Result</h1>
        <span className="badge-optimal">
          <CheckCircle2 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Optimal
        </span>
      </div>

      {/* Metadata Row */}
      <div className="results-metadata-grid">
        <div>
          <span className="meta-lbl">Date</span>
          <span className="meta-v">{new Date().toLocaleString('en-GB')}</span>
        </div>
        <div>
          <span className="meta-lbl">Total Parts Length</span>
          <span className="meta-v">{(summary.totalPartsLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} m</span>
        </div>
        <div>
          <span className="meta-lbl">Units</span>
          <span className="meta-v">Metric (m)</span>
        </div>
      </div>

      {/* Top Summary Cards (4 Cards) */}
      <div className="top-cards-grid">
        <div className="card summary-icon-card">
          <div className="card-info">
            <span className="stat-label">Total Parts Length (Qty)</span>
            <span className="stat-value">{(summary.totalPartsLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="stat-unit">m</span> <span className="stat-sub">({totalPartsQty})</span></span>
          </div>
          <div className="card-icon">
            <Package size={20} color="var(--accent)" />
          </div>
        </div>

        <div className="card summary-icon-card">
          <div className="card-info">
            <span className="stat-label">Used Stock Length</span>
            <span className="stat-value">{(summary.totalUsedStockLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="stat-unit">m</span></span>
            <span className="stat-percentage">({summary.avgUtilization.toFixed(3)}%)</span>
          </div>
          <div className="card-icon">
            <TrendingUp size={20} color="var(--accent)" />
          </div>
        </div>

        <div className="card summary-icon-card">
          <div className="card-info">
            <span className="stat-label">Total Cutting Layouts</span>
            <span className="stat-value">{layouts.length}</span>
          </div>
          <div className="card-icon">
            <ClipboardList size={20} color="var(--accent)" />
          </div>
        </div>

        <div className="card summary-icon-card">
          <div className="card-info">
            <span className="stat-label">Total Cuts</span>
            <span className="stat-value">{summary.totalCutsCount}</span>
          </div>
          <div className="card-icon">
            <Scissors size={20} color="var(--accent)" />
          </div>
        </div>
      </div>

      {/* Financial Summary (₹) Section */}
      <div className="card financial-summary-card">
        <h3 className="financial-card-heading">Financial Summary (₹)</h3>
        <div className="financial-grid">
          <div className="financial-stat">
            <span className="fin-lbl">Total Scrap Loss Cost</span>
            <span className="fin-val text-red">₹{totalScrapLossCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span className="fin-hint">(Steel purchased material wasted)</span>
          </div>
          <div className="financial-stat">
            <span className="fin-lbl">Reused Remnants Savings</span>
            <span className="fin-val text-green">₹{totalRemnantsSavings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span className="fin-hint">(Recovered value of remnant inventory)</span>
          </div>
          <div className="financial-stat">
            <span className="fin-lbl">Est. Batch Yield Value</span>
            <span className="fin-val">₹{totalYieldValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span className="fin-hint">(Value of cut pieces in structure)</span>
          </div>
        </div>
      </div>

      {/* Tables Row: Required Stocks & Summary */}
      <div className="tables-grid">
        <div className="tables-left-col">
          {/* Required Stocks */}
          <div className="card table-card">
            <h3 className="table-card-heading">Required Stocks</h3>
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Diameter (mm)</th>
                  <th>Stock Length (m)</th>
                  <th>Quantity (Bars)</th>
                  <th>Total Length (m)</th>
                </tr>
              </thead>
              <tbody>
                {requiredStocks.map((s, idx) => (
                  <tr key={idx} className={s.isVirtual ? 'tr-virtual' : ''}>
                    <td>
                      {s.diameter}
                      {s.isVirtual && (
                        <span className="text-virtual" style={{ fontSize: '10px', marginLeft: '6px', fontWeight: 'bold' }}>
                          (Unavailable)
                        </span>
                      )}
                    </td>
                    <td>{(s.length / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className={s.isVirtual ? 'text-virtual' : ''} style={s.isVirtual ? { fontWeight: 'bold' } : {}}>{s.quantity}</td>
                    <td>{((s.length * s.quantity) / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={2}>TOTAL</td>
                  <td>{totalBarsUsed}</td>
                  <td>{(summary.totalUsedStockLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Wastage & Utilisation (dia-wise) */}
          <div className="card table-card">
            <h3 className="table-card-heading">Wastage & Utilisation (dia-wise)</h3>
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Diameter (mm)</th>
                  <th>Total Stock (kg)</th>
                  <th>Utilisation (kg)</th>
                  <th>Remnant (kg)</th>
                  <th>Scrap (kg)</th>
                  <th>Total Waste (kg)</th>
                  <th>Wastage (%)</th>
                </tr>
              </thead>
              <tbody>
                {diaWeightSummary.map((s, idx) => (
                  <tr key={idx}>
                    <td>
                      {s.diameter} mm
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>
                        Rule: ≥{s.threshold}mm
                      </span>
                    </td>
                    <td>{s.totalStockKg.toFixed(2)}</td>
                    <td>{s.utilisationKg.toFixed(2)}</td>
                    <td className="text-cyan font-bold">{s.remnantKg.toFixed(2)}</td>
                    <td className="text-red font-bold">{s.scrapKg.toFixed(2)}</td>
                    <td className="text-orange font-bold">{s.totalWastageKg.toFixed(2)}</td>
                    <td>{s.wastagePercent.toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>TOTAL</td>
                  <td>{totalStockKgSum.toFixed(2)}</td>
                  <td>{totalUtilisationKgSum.toFixed(2)}</td>
                  <td className="text-cyan">{totalRemnantKgSum.toFixed(2)}</td>
                  <td className="text-red">{totalScrapKgSum.toFixed(2)}</td>
                  <td className="text-orange">{totalWastageKgSum.toFixed(2)}</td>
                  <td>{totalWastagePercent.toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Table */}
        <div className="card table-card">
          <h3 className="table-card-heading">Summary</h3>
          <table className="info-summary-table">
            <tbody>
              <tr>
                <td>Total parts length (Quantity)</td>
                <td className="text-right font-bold">{(summary.totalPartsLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} m ({totalPartsQty})</td>
              </tr>
              <tr>
                <td>Used stocks total length (Yield)</td>
                <td className="text-right font-bold text-green">{(summary.totalUsedStockLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} m ({summary.avgUtilization.toFixed(3)}%)</td>
              </tr>
              <tr>
                <td>Total cutting layouts</td>
                <td className="text-right font-bold">{layouts.length}</td>
              </tr>
              <tr>
                <td>Total number of cuts</td>
                <td className="text-right font-bold">{summary.totalCutsCount}</td>
              </tr>
              <tr>
                <td>Total material remnant</td>
                <td className="text-right font-bold text-orange">{(summary.totalRemnant / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} m ({(100 - summary.avgUtilization).toFixed(3)}%)</td>
              </tr>
              <tr className="progress-row">
                <td>Average utilization</td>
                <td className="text-right">
                  <div className="util-progress-container">
                    <div className="util-progress-bar" style={{ width: `${summary.avgUtilization}%` }} />
                    <span className="util-progress-text">{summary.avgUtilization.toFixed(2)}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cutting Layouts Section */}
      <div className="layouts-section">
        <h2 className="layouts-heading-title">Cutting Layouts</h2>

        {layouts.map((layout, index) => (
          <div
            key={layout.id}
            className={`card layout-card-new ${layout.isVirtual ? 'layout-virtual-card layout-virtual' : ''} ${(index + 1) % 5 === 0 ? 'pdf-page-break' : ''}`}
          >
            <div className="layout-grid-new">

              {/* Left Panel */}
              <div className="layout-left-panel">
                <div className={`layout-avatar-id ${layout.isVirtual ? 'badge-virtual' : ''}`}>{layout.id}</div>
                <div className="layout-info-stack">
                  <div className="layout-rep-info">
                    <span className="layout-rep-val">{layout.repetition}x</span>
                    <span className="layout-rep-label">Repetition</span>
                  </div>
                  <div className="layout-details-grid">
                    <div className="detail-item">
                      <span className="detail-lbl">Diameter</span>
                      <span className="detail-val">{layout.diameter || '12'} mm</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-lbl">{layout.isVirtual ? 'Stock (Unavailable)' : 'Stock Length'}</span>
                      <span className={`detail-val ${layout.isVirtual ? 'text-virtual' : ''}`}>
                        {layout.stockLength.toLocaleString()} mm
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Panel with ruler */}
              <div className="layout-middle-panel">
                <div className="layout-middle-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="colors-indicator-legend">
                    {Array.from(new Set(layout.parts.map(p => p.length))).map((len, idx) => {
                      const part = layout.parts.find(p => p.length === len);
                      return (
                        <span key={idx} className="legend-item" style={{ marginRight: '8px', display: 'inline-flex', alignItems: 'center' }}>
                          <span className="legend-dot" style={{ backgroundColor: part.color, width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', marginRight: '4px' }} />
                          {len.toLocaleString()}
                        </span>
                      );
                    })}
                    {/* Wastage/Remnant pill removed from legend to save space and avoid redundancy */}
                  </div>
                  {layout.isVirtual && (
                    <span className="badge-optimal" style={{ background: '#fce8e6', color: '#a51d24', border: '1px solid #f5c2c7', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      ⚠️ STOCK UNAVAILABLE (NEEDS PURCHASE)
                    </span>
                  )}
                </div>

                <div className="visual-bar-wrapper">
                  <div className="visual-bar-ruler">
                    {layout.parts.map((p, idx) => {
                      const percent = (p.length / layout.stockLength) * 100;
                      return (
                        <div
                          key={idx}
                          className="bar-segment"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: p.color,
                            ...getTextStyle(p.color)
                          }}
                          title={`${p.length.toLocaleString()} mm`}
                        >
                          {percent >= 5.5 ? p.length.toLocaleString() : ''}
                        </div>
                      );
                    })}
                    {/* Waste / Remnant Segment */}
                    {(() => {
                      const diaNum = parseFloat(layout.diameter || '12');
                      const threshold = scrapRulesMap[diaNum] ?? 1000;
                      const partsLen = layout.parts.reduce((sum, p) => sum + p.length, 0);
                      const remnantLen = layout.stockLength - partsLen;
                      const wastePercent = (remnantLen / layout.stockLength) * 100;
                      const isRemnant = remnantLen >= threshold;
                      if (wastePercent > 0.1) {
                        const getRemnantText = (rLen, wPercent, isRem) => {
                          const label = isRem ? 'Remnant' : 'Scrap';
                          if (wPercent >= 22) return `${label}: ${rLen.toLocaleString()} mm`;
                          if (wPercent >= 12) return `${label}: ${rLen.toLocaleString()} mm`;
                          if (wPercent >= 6) return rLen.toLocaleString();
                          return '';
                        };
                        return (
                          <div
                            className={`bar-segment remnant-segment ${isRemnant ? 'is-remnant-bar' : 'is-scrap-bar'}`}
                            style={{
                              width: `${wastePercent}%`,
                              backgroundColor: isRemnant ? '#0891b2' : '#dc2626'
                            }}
                            title={`${isRemnant ? 'Reusable Remnant' : 'Scrap Waste'}: ${remnantLen.toLocaleString()} mm (Rule: ≥${threshold}mm)`}
                          >
                            {getRemnantText(remnantLen, wastePercent, isRemnant)}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Right Panel */}
              <div className="layout-right-panel">
                <div className="right-stat-box">
                  <span className="right-stat-lbl">Cuts</span>
                  <span className="right-stat-val">{layout.cutsCount}</span>
                </div>

                <div className="right-stat-box">
                  <span className="right-stat-lbl">Waste</span>
                  {(() => {
                    const diaNum = parseFloat(layout.diameter || '12');
                    const threshold = scrapRulesMap[diaNum] ?? 1000;
                    let wasteLen = parseFloat(layout.waste);
                    if (isNaN(wasteLen)) {
                      const partsLen = layout.parts.reduce((sum, p) => sum + p.length, 0);
                      wasteLen = Math.max(0, layout.stockLength - partsLen);
                    }
                    const isRemnant = wasteLen >= threshold;
                    return (
                      <span className={`right-stat-val ${isRemnant ? 'text-cyan' : 'text-red'}`}>
                        {wasteLen.toLocaleString()} mm
                        <span style={{ fontSize: '10px', display: 'block', fontWeight: 'bold', color: isRemnant ? '#0891b2' : '#dc2626' }}>
                          ({isRemnant ? 'Remnant' : 'Scrap'})
                        </span>
                      </span>
                    );
                  })()}
                </div>

                <div className="right-stat-box">
                  <span className="right-stat-lbl">Utilization</span>
                  <span className="right-stat-val text-green">{layout.utilization.toFixed(2)}%</span>
                </div>

              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Bottom Summary Indicators (4 cards) */}
      <div className="bottom-summary-grid">
        <div className="card bottom-card">
          <div className="bottom-icon circle-chart">
            <PieChart size={18} color="#2da44e" />
          </div>
          <div>
            <div className="bottom-lbl">OVERALL UTILIZATION</div>
            <div className="bottom-v text-green">{summary.avgUtilization.toFixed(2)}%</div>
          </div>
        </div>

        <div className="card bottom-card">
          <div className="bottom-icon">
            <Trash2 size={18} color="var(--accent)" />
          </div>
          <div>
            <div className="bottom-lbl">TOTAL WASTE</div>
            <div className="bottom-v text-orange">{summary.totalRemnant.toLocaleString()} mm <span className="bottom-v-sub">({(100 - summary.avgUtilization).toFixed(3)}%)</span></div>
          </div>
        </div>

        <div className="card bottom-card">
          <div className="bottom-icon">
            <BarChart3 size={18} color="var(--text-primary)" />
          </div>
          <div>
            <div className="bottom-lbl">TOTAL BARS USED</div>
            <div className="bottom-v">{totalBarsUsed}</div>
          </div>
        </div>

        <div className="card bottom-card">
          <div className="bottom-icon">
            <Scissors size={18} color="var(--text-primary)" />
          </div>
          <div>
            <div className="bottom-lbl">TOTAL CUTS</div>
            <div className="bottom-v">{summary.totalCutsCount}</div>
          </div>
        </div>
      </div>

      {/* Remnant & Scrap Tracker Table */}
      <div className="wt-card">
        {/* Card Header */}
        <div className="wt-card-header">
          <div className="wt-card-title-group">
            <div className="wt-card-icon-wrap">
              <Recycle size={20} />
            </div>
            <div>
              <h3 className="wt-card-title">Remnant &amp; Scrap Steel Tracker</h3>
              <p className="wt-card-desc">Per-layout waste breakdown — cross-reference with Layout IDs in Cutting Layouts above.</p>
            </div>
          </div>
          <div className="wt-legend-pills">
            <span className="wt-pill wt-pill-remnant">
              <span className="wt-pill-dot wt-dot-remnant" />
              Reusable Remnant
            </span>
            <span className="wt-pill wt-pill-scrap">
              <span className="wt-pill-dot wt-dot-scrap" />
              Scrap
            </span>
          </div>
        </div>

        {/* Summary stat cards */}
        <div className="wt-summary-strip">
          <div className="wt-stat-card wt-stat-remnant">
            <span className="wt-stat-val">{totalRemnantKgSum.toFixed(2)} <span className="wt-stat-unit">kg</span></span>
            <span className="wt-stat-lbl">Total Reusable Remnant</span>
          </div>
          <div className="wt-stat-card wt-stat-scrap">
            <span className="wt-stat-val">{totalScrapKgSum.toFixed(2)} <span className="wt-stat-unit">kg</span></span>
            <span className="wt-stat-lbl">Total Scrap</span>
          </div>
          <div className="wt-stat-card wt-stat-total">
            <span className="wt-stat-val">{(totalRemnantKgSum + totalScrapKgSum).toFixed(2)} <span className="wt-stat-unit">kg</span></span>
            <span className="wt-stat-lbl">Total Waste Material</span>
          </div>
          <div className="wt-stat-card wt-stat-pct">
            <span className="wt-stat-val">
              {totalStockKgSum > 0 ? ((totalRemnantKgSum / (totalRemnantKgSum + totalScrapKgSum)) * 100).toFixed(0) : 0}
              <span className="wt-stat-unit">%</span>
            </span>
            <span className="wt-stat-lbl">Waste Recovered as Remnant</span>
          </div>
        </div>

        {/* Table */}
        <div className="wt-table-wrap">
          <table className="wt-table">
            <thead>
              <tr>
                <th className="wt-th-type">Type</th>
                <th>Layout</th>
                <th>Dia</th>
                <th>Stock Length</th>
                <th>Reps</th>
                <th>Cuts</th>
                <th>Waste / Bar</th>
                <th>Total Waste Length</th>
                <th>Weight (kg)</th>
              </tr>
            </thead>
            <tbody>
              {wasteTrackerDias.map(dia => {
                const rows = wasteTrackerByDia[dia];
                const subRemnantKg = rows.filter(r => r.type === 'remnant').reduce((s, r) => s + r.wasteWeightKg, 0);
                const subScrapKg = rows.filter(r => r.type === 'scrap').reduce((s, r) => s + r.wasteWeightKg, 0);
                const subRemnantLen = rows.filter(r => r.type === 'remnant').reduce((s, r) => s + r.totalWasteLen, 0);
                const subScrapLen = rows.filter(r => r.type === 'scrap').reduce((s, r) => s + r.totalWasteLen, 0);
                return (
                  <React.Fragment key={dia}>
                    {/* Diameter group header */}
                    <tr className="wt-group-row">
                      <td colSpan={9}>
                        <div className="wt-group-inner">
                          <span className="wt-group-dia">{dia} mm</span>
                          <span className="wt-group-threshold">Remnant threshold ≥ {rows[0].threshold} mm</span>
                          {subRemnantKg > 0 && (
                            <span className="wt-group-chip wt-chip-remnant">↩ {subRemnantKg.toFixed(2)} kg remnant</span>
                          )}
                          {subScrapKg > 0 && (
                            <span className="wt-group-chip wt-chip-scrap">✕ {subScrapKg.toFixed(2)} kg scrap</span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Per-layout rows */}
                    {rows.map((row, i) => (
                      <tr
                        key={`${dia}-${i}`}
                        className={`wt-data-row wt-type-${row.type}${row.isVirtual ? ' wt-virtual' : ''}`}
                      >
                        {/* Left type indicator */}
                        <td className="wt-type-cell">
                          <span className={`wt-type-pip wt-pip-${row.type}`} />
                          {row.type === 'remnant' && <span className="wt-type-label wt-type-remnant">Remnant</span>}
                          {row.type === 'scrap' && <span className="wt-type-label wt-type-scrap">Scrap</span>}
                          {row.type === 'none' && <span className="wt-type-label wt-type-none">—</span>}
                        </td>
                        <td>
                          <span className={`wt-layout-chip wt-layout-chip-${row.type}`}>{row.layoutId}</span>
                          {row.isVirtual && <span className="wt-unavail-tag">Unavail.</span>}
                        </td>
                        <td className="wt-cell-bold">{row.diameter} mm</td>
                        <td className="wt-cell-muted">{row.stockLength.toLocaleString()} mm</td>
                        <td className="wt-cell-center">{row.repetition}</td>
                        <td className="wt-cell-center">{row.cutsCount}</td>
                        <td>
                          {row.wasteLenPerBar > 0
                            ? <span className={row.type === 'remnant' ? 'wt-val-remnant' : row.type === 'scrap' ? 'wt-val-scrap' : ''}>
                                {row.wasteLenPerBar.toLocaleString()} <span className="wt-unit">mm</span>
                              </span>
                            : <span className="wt-zero">—</span>
                          }
                        </td>
                        <td>
                          {row.totalWasteLen > 0
                            ? <span className={row.type === 'remnant' ? 'wt-val-remnant' : row.type === 'scrap' ? 'wt-val-scrap' : ''}>
                                {row.totalWasteLen.toLocaleString()} <span className="wt-unit">mm</span>
                              </span>
                            : <span className="wt-zero">—</span>
                          }
                        </td>
                        <td>
                          {row.wasteWeightKg > 0
                            ? <span className={`wt-weight ${row.type === 'remnant' ? 'wt-val-remnant' : row.type === 'scrap' ? 'wt-val-scrap' : ''}`}>
                                {row.wasteWeightKg.toFixed(3)}
                              </span>
                            : <span className="wt-zero">—</span>
                          }
                        </td>
                      </tr>
                    ))}

                    {/* Diameter subtotal */}
                    <tr className="wt-subtotal-row">
                      <td colSpan={6} className="wt-subtotal-label">Subtotal — {dia} mm</td>
                      <td colSpan={2}>
                        <div className="wt-subtotal-lens">
                          {subRemnantLen > 0 && (
                            <span className="wt-sub-chip wt-sub-remnant">{subRemnantLen.toLocaleString()} mm remnant</span>
                          )}
                          {subScrapLen > 0 && (
                            <span className="wt-sub-chip wt-sub-scrap">{subScrapLen.toLocaleString()} mm scrap</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="wt-subtotal-lens">
                          {subRemnantKg > 0 && (
                            <span className="wt-sub-chip wt-sub-remnant">{subRemnantKg.toFixed(3)} kg</span>
                          )}
                          {subScrapKg > 0 && (
                            <span className="wt-sub-chip wt-sub-scrap">{subScrapKg.toFixed(3)} kg</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Grand Total Banner */}
        <div className="wt-grand-banner">
          <div className="wt-grand-label">
            <Recycle size={16} style={{ marginRight: '6px', opacity: 0.7 }} />
            Grand Total
          </div>
          <div className="wt-grand-stats">
            <div className="wt-grand-stat">
              <span className="wt-grand-stat-val wt-grand-remnant">
                {wasteTracker.filter(r => r.type === 'remnant').reduce((s, r) => s + r.totalWasteLen, 0).toLocaleString()} mm
              </span>
              <span className="wt-grand-stat-sub">{totalRemnantKgSum.toFixed(2)} kg Remnant</span>
            </div>
            <div className="wt-grand-divider" />
            <div className="wt-grand-stat">
              <span className="wt-grand-stat-val wt-grand-scrap">
                {wasteTracker.filter(r => r.type === 'scrap').reduce((s, r) => s + r.totalWasteLen, 0).toLocaleString()} mm
              </span>
              <span className="wt-grand-stat-sub">{totalScrapKgSum.toFixed(2)} kg Scrap</span>
            </div>
            <div className="wt-grand-divider" />
            <div className="wt-grand-stat">
              <span className="wt-grand-stat-val">
                {(totalRemnantKgSum + totalScrapKgSum).toFixed(2)} kg
              </span>
              <span className="wt-grand-stat-sub">Total Waste</span>
            </div>
          </div>
        </div>
      </div>


      {/* Save & Commit Batch Modal */}
      {showSaveModal && (
        <div className="modal-backdrop no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content card" style={{ maxWidth: '480px', width: '90%', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '24px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                <Tag size={18} color="var(--accent)" /> Save & Commit Cutting Batch
              </h3>
              <button className="modal-close-btn" onClick={() => setShowSaveModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p className="modal-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Specify a reference batch name to identify this optimization in inventory deduction and history logs.
              </p>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Batch Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={batchNameInput}
                  onChange={(e) => setBatchNameInput(e.target.value)}
                  placeholder="e.g. Batch #13/08/26 - Ground Floor"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmSaveBatch();
                  }}
                  style={{ width: '100%', fontSize: '14px', padding: '10px 14px', borderRadius: '6px' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => setShowSaveModal(false)} disabled={saveLoading} style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleConfirmSaveBatch} disabled={saveLoading || !batchNameInput.trim()} style={{ background: '#2da44e', borderColor: '#2da44e', color: '#fff', padding: '8px 18px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                {saveLoading ? 'Saving...' : 'Save & Commit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brand signature (visible on print only) */}
      <div className="print-footer print-only">
        <span>© 2026-2027 RebarOptima. All rights reserved.</span>
        <span>Generated: {reportDate} &nbsp;·&nbsp; RebarOptima Cut Optimizer &nbsp;·&nbsp; Confidential</span>
      </div>
    </div>
  );
}
