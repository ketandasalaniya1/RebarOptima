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
      { length: 4500, qty: 1, color: '#f28e8e' },
      { length: 1200, qty: 1, color: '#f7e1a1' },
      { length: 950, qty: 1, color: '#a6e2a6' },
      { length: 760, qty: 7, color: '#a0e1e1' },
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
      { length: 4500, qty: 1, color: '#f28e8e' },
      { length: 1200, qty: 1, color: '#f7e1a1' },
      { length: 950, qty: 5, color: '#a6e2a6' },
      { length: 760, qty: 2, color: '#a0e1e1' },
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
      { length: 4500, qty: 2, color: '#f28e8e' },
      { length: 1200, qty: 1, color: '#f7e1a1' },
      { length: 950, qty: 1, color: '#a6e2a6' },
      { length: 760, qty: 1, color: '#a0e1e1' },
    ],
    cutsCount: 5,
    waste: '40 mm (0.33%)',
    utilization: 99.67,
  },
  {
    id: 'D',
    repetition: 3,
    stockLength: 12000,
    parts: [
      { length: 4500, qty: 1, color: '#f28e8e' },
      { length: 1200, qty: 4, color: '#f7e1a1' },
      { length: 950, qty: 2, color: '#a6e2a6' },
      { length: 760, qty: 1, color: '#a0e1e1' },
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
      { length: 4500, qty: 2, color: '#f28e8e' },
      { length: 1200, qty: 1, color: '#f7e1a1' },
      { length: 950, qty: 1, color: '#a6e2a6' },
      { length: 760, qty: 1, color: '#a0e1e1' },
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
      { length: 4500, qty: 1, color: '#f28e8e' },
      { length: 1200, qty: 3, color: '#f7e1a1' },
      { length: 950, qty: 4, color: '#a6e2a6' },
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
      { length: 950, qty: 3, color: '#a6e2a6' },
      { length: 760, qty: 3, color: '#a0e1e1' },
    ],
    cutsCount: 6,
    waste: '6,870 mm (57.25%)',
    utilization: 42.75,
  },
]

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
    const opt = {
      margin: [10, 10, 10, 10],
      filename: 'rebar_optima_report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      ignoreElements: (el) => el.classList.contains('no-print')
    };

    html2pdf().set(opt).from(element).save();
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
          <span className="meta-v">{summary.totalPartsLength.toLocaleString()} mm</span>
        </div>
        <div>
          <span className="meta-lbl">Units</span>
          <span className="meta-v">Metric (mm)</span>
        </div>
      </div>

      {/* Top Summary Cards (4 Cards) */}
      <div className="top-cards-grid">
        <div className="card summary-icon-card">
          <div className="card-info">
            <span className="stat-label">Total Parts (Quantity)</span>
            <span className="stat-value">{summary.totalPartsLength.toLocaleString()} <span className="stat-sub">({totalPartsQty})</span></span>
          </div>
          <div className="card-icon">
            <Package size={20} color="var(--accent)" />
          </div>
        </div>

        <div className="card summary-icon-card">
          <div className="card-info">
            <span className="stat-label">Used Stock Length</span>
            <span className="stat-value">{summary.totalUsedStockLength.toLocaleString()} <span className="stat-unit">mm</span></span>
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
        {/* Required Stocks */}
        <div className="card table-card">
          <h3 className="table-card-heading">Required Stocks</h3>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Diameter (mm)</th>
                <th>Stock Length (mm)</th>
                <th>Quantity (Bars)</th>
                <th>Total Length (mm)</th>
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
                  <td>{s.length.toLocaleString()}</td>
                  <td style={s.isVirtual ? { color: '#d93025', fontWeight: 'bold' } : {}}>{s.quantity}</td>
                  <td>{(s.length * s.quantity).toLocaleString()}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={2}>TOTAL</td>
                <td>{totalBarsUsed}</td>
                <td>{summary.totalUsedStockLength.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary Table */}
        <div className="card table-card">
          <h3 className="table-card-heading">Summary</h3>
          <table className="info-summary-table">
            <tbody>
              <tr>
                <td>Total parts length (Quantity)</td>
                <td className="text-right font-bold">{summary.totalPartsLength.toLocaleString()} mm ({totalPartsQty})</td>
              </tr>
              <tr>
                <td>Used stocks total length (Yield)</td>
                <td className="text-right font-bold text-green">{summary.totalUsedStockLength.toLocaleString()} mm ({summary.avgUtilization.toFixed(3)}%)</td>
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
                <td className="text-right font-bold text-orange">{summary.totalRemnant.toLocaleString()} mm ({(100 - summary.avgUtilization).toFixed(3)}%)</td>
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

        {layouts.map((layout) => (
          <div
            key={layout.id}
            className={`card layout-card-new ${layout.isVirtual ? 'layout-virtual-card' : ''}`}
            style={layout.isVirtual ? { borderLeft: '4px solid #d93025', background: '#fff9f9' } : {}}
          >
            <div className="layout-grid-new">

              {/* Left Panel */}
              <div className="layout-left-panel">
                <div className="layout-avatar-id" style={layout.isVirtual ? { background: '#fce8e6', color: '#a51d24' } : {}}>{layout.id}</div>
                <div className="layout-rep-meta">
                  <span className="layout-rep-val">{layout.repetition}x</span>
                  <span className="layout-rep-label">Repetition</span>
                </div>
                <div className="layout-stock-meta">
                  <span className="layout-stock-val">{layout.diameter || '12'} mm</span>
                  <span className="layout-stock-label">Diameter</span>
                </div>
                <div className="layout-stock-meta">
                  <span className="layout-stock-val" style={layout.isVirtual ? { color: '#d93025', fontWeight: 'bold' } : {}}>{layout.stockLength.toLocaleString()} mm</span>
                  <span className="layout-stock-label">{layout.isVirtual ? 'Stock (Unavailable)' : 'Stock Length'}</span>
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
                            backgroundColor: p.color
                          }}
                        >
                          {p.length}
                        </div>
                      );
                    })}
                    {/* Waste / Remnant Segment */}
                    {(() => {
                      const partsLen = layout.parts.reduce((sum, p) => sum + p.length, 0);
                      const remnantLen = layout.stockLength - partsLen;
                      const wastePercent = (remnantLen / layout.stockLength) * 100;
                      if (wastePercent > 0.1) {
                        return (
                          <div
                            className="bar-segment remnant-segment"
                            style={{ width: `${wastePercent}%` }}
                          >
                            Waste / Remnant<br />{remnantLen.toLocaleString()} mm
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
