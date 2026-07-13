import { useState, useEffect } from 'react'
import { batchesApi } from '../../utils/api'
import html2pdf from 'html2pdf.js'
import {
  Calendar,
  Layers,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Printer
} from 'lucide-react'
import './BatchHistoryPage.css'

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

export default function BatchHistoryPage() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedBatchId, setExpandedBatchId] = useState(null)

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true)
        const data = await batchesApi.getHistory()
        setHistory(data)
      } catch (err) {
        setError(err.message || 'Failed to load batch history.')
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [])

  const toggleExpand = (id) => {
    setExpandedBatchId(prev => (prev === id ? null : id))
  }

  const handlePrintBatch = (e, batch) => {
    e.stopPropagation(); // Prevent toggling accordion expand
    const element = document.getElementById(`batch-print-content-${batch._id}`);
    if (!element) return;
    
    element.classList.remove('no-screen');
    
    const opt = {
      margin: [15, 10, 15, 10],
      filename: `${batch.batchName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        windowWidth: 794
      },
      pagebreak: { mode: ['css', 'legacy'], after: '.pdf-page-break' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      element.classList.add('no-screen');
    }).catch(err => {
      console.error('PDF Generation Error:', err);
      element.classList.add('no-screen');
    });
  };

  if (loading) {
    return (
      <div className="history-page loading-state">
        <div className="loader"></div>
        <p>Loading batch history...</p>
      </div>
    )
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h1 className="history-title">Batch History</h1>
        <p className="history-subtitle">View and audit all previously committed cutting stock optimizations.</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {history.length === 0 ? (
        <div className="card empty-history-card">
          <Layers size={40} color="var(--text-label)" />
          <h3>No History Found</h3>
          <p>You haven't saved or committed any optimization batches yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((batch) => {
            const isExpanded = expandedBatchId === batch._id
            const date = new Date(batch.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })

            const totalBars = batch.layouts?.reduce((sum, l) => sum + Number(l.repetition), 0) || 0
            const totalParts = batch.layouts?.reduce((sum, l) => {
              const partsCount = l.parts?.length || (l.stockLength > l.waste ? 1 : 0);
              return sum + (partsCount * Number(l.repetition));
            }, 0) || 0

            return (
              <div key={batch._id} className={`card batch-history-card ${isExpanded ? 'expanded' : ''}`}>
                {/* Header block (Click to toggle) */}
                <div className="batch-card-header" onClick={() => toggleExpand(batch._id)}>
                  <div className="batch-meta-left">
                    <span className="batch-name">{batch.batchName}</span>
                    <span className="batch-date">
                      <Calendar size={13} style={{ marginRight: '4px' }} /> {date}
                    </span>
                  </div>

                  <div className="batch-meta-right">
                    <button 
                      className="btn-print-batch animate-hover" 
                      onClick={(e) => handlePrintBatch(e, batch)}
                      title="Print Batch Report"
                    >
                      <Printer size={13} style={{ marginRight: '4px' }} /> Print
                    </button>
                    <div className="meta-pill text-green">
                      <TrendingUp size={13} /> {batch.summary?.avgUtilization?.toFixed(2)}% Util.
                    </div>
                    <div className="meta-pill text-cyan">
                      <Layers size={13} /> {totalBars} Bars Used
                    </div>
                    <div className="expand-chevron">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details section */}
                {isExpanded && (
                  <div className="batch-card-body">
                    {/* Metrics Dashboard */}
                    <div className="batch-metrics-subgrid">
                      <div className="sub-metric-box">
                        <span className="sub-lbl">Total Parts (Qty)</span>
                        <span className="sub-val">
                          {(batch.summary.totalPartsLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m <span className="sub-unit">({totalParts})</span>
                        </span>
                      </div>
                      <div className="sub-metric-box">
                        <span className="sub-lbl">Total Stock Used</span>
                        <span className="sub-val">
                          {(batch.summary.totalUsedStockLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                        </span>
                      </div>
                      <div className="sub-metric-box">
                        <span className="sub-lbl">Scrap (Wastage)</span>
                        <span className="sub-val text-red">
                          {batch.summary.totalScrapKg?.toFixed(2)} kg
                        </span>
                      </div>
                      <div className="sub-metric-box">
                        <span className="sub-lbl">Reusable Remnants</span>
                        <span className="sub-val text-cyan">
                          {batch.summary.totalRemnantKg?.toFixed(2)} kg
                        </span>
                      </div>
                    </div>

                    {/* Layouts visualization */}
                    <div className="history-layouts-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h4 className="section-subtitle-small">Optimized Cutting Layouts</h4>
                      {batch.layouts?.map((rawLayout, lIdx) => {
                        const layout = {
                          ...rawLayout,
                          parts: rawLayout.parts && rawLayout.parts.length > 0
                            ? rawLayout.parts
                            : (rawLayout.stockLength > rawLayout.waste
                              ? [{ length: rawLayout.stockLength - rawLayout.waste, color: '#71797E', label: 'Utilized' }]
                              : [])
                        };
                        const cutsCount = layout.cutsCount ?? (layout.parts?.length > 0 ? (layout.waste > 0.1 ? layout.parts.length : layout.parts.length - 1) : 0);
                        const utilization = layout.utilization ?? (layout.parts?.length > 0 ? (layout.parts.reduce((s, p) => s + p.length, 0) / layout.stockLength) * 100 : 0);
                        
                        return (
                          <div
                            key={lIdx}
                            className={`card layout-card-new ${layout.isVirtual ? 'layout-virtual-card layout-virtual' : ''}`}
                            style={{ margin: 0 }}
                          >
                            <div className="layout-grid-new">

                              {/* Left Panel */}
                              <div className="layout-left-panel">
                                <div className={`layout-avatar-id ${layout.isVirtual ? 'badge-virtual' : ''}`}>{lIdx + 1}</div>
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
                                    {layout.parts && Array.from(new Set(layout.parts.map(p => p.length))).map((len, idx) => {
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
                                    {layout.parts?.map((p, idx) => {
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
                                      const partsLen = layout.parts?.reduce((sum, p) => sum + p.length, 0) || 0;
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
                                  <span className="right-stat-val">{cutsCount}</span>
                                </div>

                                <div className="right-stat-box">
                                  <span className="right-stat-lbl">Waste</span>
                                  <span className="right-stat-val text-dark">{layout.waste.toLocaleString()} mm</span>
                                </div>

                                <div className="right-stat-box">
                                  <span className="right-stat-lbl">Utilization</span>
                                  <span className="right-stat-val text-green">{utilization.toFixed(2)}%</span>
                                </div>

                              </div>

                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Hidden print template */}
                <div id={`batch-print-content-${batch._id}`} className="batch-print-template no-screen">
                  <div className="print-report-header" style={{ marginBottom: '24px', borderBottom: '2px solid #1a1259', paddingBottom: '16px' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a1259', margin: '0 0 6px 0' }}>RebarOptima Cutting Optimization Report</h2>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#5e578c', margin: '0 0 12px 0' }}>{batch.batchName}</h3>
                    <p style={{ fontSize: '12px', color: '#8d86b8', margin: 0 }}>Generated on: {date}</p>
                  </div>

                  {/* Summary Stats */}
                  <div className="batch-metrics-subgrid" style={{ marginBottom: '24px', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px' }}>
                    <div className="sub-metric-box">
                      <span className="sub-lbl">Total Parts (Qty)</span>
                      <span className="sub-val">
                        {(batch.summary.totalPartsLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m <span className="sub-unit">({totalParts})</span>
                      </span>
                    </div>
                    <div className="sub-metric-box">
                      <span className="sub-lbl">Total Stock Used</span>
                      <span className="sub-val">
                        {(batch.summary.totalUsedStockLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                      </span>
                    </div>
                    <div className="sub-metric-box">
                      <span className="sub-lbl">Scrap (Wastage)</span>
                      <span className="sub-val" style={{ color: '#ea4a4a', fontWeight: 'bold' }}>
                        {batch.summary.totalScrapKg?.toFixed(2)} kg
                      </span>
                    </div>
                    <div className="sub-metric-box">
                      <span className="sub-lbl">Reusable Remnants</span>
                      <span className="sub-val" style={{ color: '#17a2b8', fontWeight: 'bold' }}>
                        {batch.summary.totalRemnantKg?.toFixed(2)} kg
                      </span>
                    </div>
                    <div className="sub-metric-box">
                      <span className="sub-lbl">Avg. Utilization</span>
                      <span className="sub-val" style={{ color: '#2da44e', fontWeight: 'bold' }}>
                        {batch.summary.avgUtilization?.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Layouts List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {batch.layouts?.map((rawLayout, lIdx) => {
                      const layout = {
                        ...rawLayout,
                        parts: rawLayout.parts && rawLayout.parts.length > 0
                          ? rawLayout.parts
                          : (rawLayout.stockLength > rawLayout.waste
                            ? [{ length: rawLayout.stockLength - rawLayout.waste, color: '#71797E', label: 'Utilized' }]
                            : [])
                      };
                      const cutsCount = layout.cutsCount ?? (layout.parts?.length > 0 ? (layout.waste > 0.1 ? layout.parts.length : layout.parts.length - 1) : 0);
                      const utilization = layout.utilization ?? (layout.parts?.length > 0 ? (layout.parts.reduce((s, p) => s + p.length, 0) / layout.stockLength) * 100 : 0);
                      return (
                        <div
                          key={lIdx}
                          className={`card layout-card-new ${layout.isVirtual ? 'layout-virtual-card layout-virtual' : ''}`}
                          style={{ margin: 0, pageBreakInside: 'avoid', breakInside: 'avoid' }}
                        >
                          <div className="layout-grid-new">
                            {/* Left Panel */}
                            <div className="layout-left-panel">
                              <div className={`layout-avatar-id ${layout.isVirtual ? 'badge-virtual' : ''}`}>{lIdx + 1}</div>
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
                                  {layout.parts && Array.from(new Set(layout.parts.map(p => p.length))).map((len, idx) => {
                                    const part = layout.parts.find(p => p.length === len);
                                    return (
                                      <span key={idx} className="legend-item" style={{ marginRight: '8px', display: 'inline-flex', alignItems: 'center' }}>
                                        <span className="legend-dot" style={{ backgroundColor: part.color, width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', marginRight: '4px' }} />
                                        {len.toLocaleString()}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="visual-bar-wrapper">
                                <div className="visual-bar-ruler">
                                  {layout.parts?.map((p, idx) => {
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
                                      >
                                        {percent >= 5.5 ? p.length.toLocaleString() : ''}
                                      </div>
                                    );
                                  })}
                                  {/* Waste / Remnant Segment */}
                                  {(() => {
                                    const partsLen = layout.parts?.reduce((sum, p) => sum + p.length, 0) || 0;
                                    const remnantLen = layout.stockLength - partsLen;
                                    const wastePercent = (remnantLen / layout.stockLength) * 100;
                                    if (wastePercent > 0.1) {
                                      return (
                                        <div
                                          className="bar-segment remnant-segment"
                                          style={{ width: `${wastePercent}%` }}
                                        >
                                          {wastePercent >= 12 ? `Remnant: ${remnantLen} mm` : remnantLen}
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
                                <span className="right-stat-val">{cutsCount}</span>
                              </div>
                              <div className="right-stat-box">
                                <span className="right-stat-lbl">Waste</span>
                                <span className="right-stat-val text-dark">{layout.waste.toLocaleString()} mm</span>
                              </div>
                              <div className="right-stat-box">
                                <span className="right-stat-lbl">Utilization</span>
                                <span className="right-stat-val text-green">{utilization.toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
