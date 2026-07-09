import './ResultsPage.css'
import html2pdf from 'html2pdf.js'
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
  FileSpreadsheet
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

export default function ResultsPage({ data, onBack }) {
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

  // Group layouts by diameter for wastage and utilization in kg
  const diaWeightSummaryMap = {};
  layouts.forEach(l => {
    const dia = l.diameter || '12';
    if (!diaWeightSummaryMap[dia]) {
      diaWeightSummaryMap[dia] = {
        diameter: dia,
        totalStockLength: 0,
        totalPartsLength: 0
      };
    }
    diaWeightSummaryMap[dia].totalStockLength += l.stockLength * l.repetition;
    const layoutPartsLength = l.parts.reduce((sum, p) => sum + p.length, 0);
    diaWeightSummaryMap[dia].totalPartsLength += layoutPartsLength * l.repetition;
  });

  const diaWeightSummary = Object.values(diaWeightSummaryMap)
    .map(d => {
      const diaNum = parseFloat(d.diameter);
      const weightPerMeter = Math.round(((diaNum * diaNum) / 162) * 100) / 100;
      const totalStockKg = (d.totalStockLength / 1000) * weightPerMeter;
      const utilisationKg = (d.totalPartsLength / 1000) * weightPerMeter;
      const wastageKg = Math.max(0, totalStockKg - utilisationKg);
      const wastagePercent = totalStockKg > 0 ? (wastageKg / totalStockKg) * 100 : 0;
      const utilisationPercent = totalStockKg > 0 ? (utilisationKg / totalStockKg) * 100 : 0;
      return {
        diameter: d.diameter,
        totalStockKg,
        utilisationKg,
        wastageKg,
        wastagePercent,
        utilisationPercent
      };
    })
    .sort((a, b) => parseFloat(a.diameter) - parseFloat(b.diameter));

  const totalStockKgSum = diaWeightSummary.reduce((sum, d) => sum + d.totalStockKg, 0);
  const totalUtilisationKgSum = diaWeightSummary.reduce((sum, d) => sum + d.utilisationKg, 0);
  const totalWastageKgSum = Math.max(0, totalStockKgSum - totalUtilisationKgSum);
  const totalWastagePercent = totalStockKgSum > 0 ? (totalWastageKgSum / totalStockKgSum) * 100 : 0;

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
      margin: [15, 10, 15, 10],
      filename: 'rebar_optima_report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        windowWidth: 794
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
          <span className="meta-v">{new Date().toLocaleString()}</span>
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
                  <tr key={idx} style={s.isVirtual ? { background: '#fff5f5' } : {}}>
                    <td>
                      {s.diameter}
                      {s.isVirtual && (
                        <span style={{ color: '#d93025', fontSize: '10px', marginLeft: '6px', fontWeight: 'bold' }}>
                          (Unavailable)
                        </span>
                      )}
                    </td>
                    <td>{(s.length / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td style={s.isVirtual ? { color: '#d93025', fontWeight: 'bold' } : {}}>{s.quantity}</td>
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
                  <th>Wastage (kg)</th>
                  <th>Wastage (%)</th>
                </tr>
              </thead>
              <tbody>
                {diaWeightSummary.map((s, idx) => (
                  <tr key={idx}>
                    <td>{s.diameter} mm</td>
                    <td>{s.totalStockKg.toFixed(2)}</td>
                    <td>{s.utilisationKg.toFixed(2)}</td>
                    <td className="text-orange font-bold">{s.wastageKg.toFixed(2)}</td>
                    <td>{s.wastagePercent.toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>TOTAL</td>
                  <td>{totalStockKgSum.toFixed(2)}</td>
                  <td>{totalUtilisationKgSum.toFixed(2)}</td>
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
            className={`card layout-card-new ${layout.isVirtual ? 'layout-virtual-card' : ''} ${(index + 1) % 5 === 0 ? 'pdf-page-break' : ''}`}
            style={layout.isVirtual ? { borderLeft: '4px solid #d93025', background: '#fff9f9' } : {}}
          >
            <div className="layout-grid-new">

              {/* Left Panel */}
              <div className="layout-left-panel">
                <div className="layout-avatar-id" style={layout.isVirtual ? { background: '#fce8e6', color: '#a51d24' } : {}}>{layout.id}</div>
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
                      <span className="detail-val" style={layout.isVirtual ? { color: '#d93025' } : {}}>
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
                      const partsLen = layout.parts.reduce((sum, p) => sum + p.length, 0);
                      const remnantLen = layout.stockLength - partsLen;
                      const wastePercent = (remnantLen / layout.stockLength) * 100;
                      if (wastePercent > 0.1) {
                        const getRemnantText = (rLen, wPercent) => {
                          if (wPercent >= 22) return `Waste / Remnant: ${rLen.toLocaleString()} mm`;
                          if (wPercent >= 12) return `Remnant: ${rLen.toLocaleString()} mm`;
                          if (wPercent >= 6) return rLen.toLocaleString();
                          return '';
                        };
                        return (
                          <div
                            className="bar-segment remnant-segment"
                            style={{ width: `${wastePercent}%` }}
                            title={`Waste / Remnant: ${remnantLen.toLocaleString()} mm`}
                          >
                            {getRemnantText(remnantLen, wastePercent)}
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
                  <span className="right-stat-val text-dark">{layout.waste.toLocaleString()} mm</span>
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

      {/* Brand signature (visible on print only) */}
      <div className="print-footer print-only">
        <span>© 2026-2027 RebarOptima. All rights reserved.</span>
        <span>Generated by RebarOptima Cut Optimizer</span>
      </div>
    </div>
  );
}
