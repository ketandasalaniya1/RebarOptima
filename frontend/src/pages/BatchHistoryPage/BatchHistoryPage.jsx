import { useState, useEffect } from 'react'
import { batchesApi } from '../../utils/api'
import html2pdf from 'html2pdf.js'
import {
  Calendar,
  Layers,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Printer,
  Pencil,
  Trash2,
  Save,
  X,
  Scale,
  Scissors,
  FileText,
  BarChart3,
  RotateCcw,
  AlertCircle
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner'
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

export default function BatchHistoryPage({ onEditBatch }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedBatchId, setExpandedBatchId] = useState(null)

  // Edit & Delete states
  const [editingBatchId, setEditingBatchId] = useState(null)
  const [editBatchName, setEditBatchName] = useState('')
  const [confirmDeleteBatchId, setConfirmDeleteBatchId] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Print Menu states
  const [printMenuBatchId, setPrintMenuBatchId] = useState(null)
  const [printOption, setPrintOption] = useState('foreman')
  const [activePrintBatch, setActivePrintBatch] = useState(null)

  const triggerBatchPrint = (batch, mode) => {
    setPrintOption(mode)
    setActivePrintBatch(batch)
    setPrintMenuBatchId(null)
    setTimeout(() => {
      window.print()
    }, 120)
  }

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

  const handleEditBatch = (e, batch) => {
    e.stopPropagation() // Prevent toggling accordion expand
    setEditingBatchId(batch._id)
    setEditBatchName(batch.batchName)
  }

  const handleCancelBatchEdit = (e) => {
    if (e) e.stopPropagation()
    setEditingBatchId(null)
    setEditBatchName('')
  }

  const handleSaveBatchEdit = async (e, id) => {
    if (e) e.stopPropagation()
    setError('')
    setSuccess('')
    if (!editBatchName.trim()) {
      setError('Batch name cannot be empty.')
      return
    }

    try {
      setActionLoading(true)
      const updated = await batchesApi.updateBatch(id, editBatchName)
      setHistory(prev => prev.map(b => b._id === id ? { ...b, batchName: updated.batchName } : b))
      setEditingBatchId(null)
      setEditBatchName('')
      setSuccess('Batch name updated successfully!')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.message || 'Failed to update batch name.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteBatch = (e, id) => {
    e.stopPropagation()
    setConfirmDeleteBatchId(id)
  }

  const handleCancelDeleteBatch = (e) => {
    if (e) e.stopPropagation()
    setConfirmDeleteBatchId(null)
  }

  const handleConfirmDeleteBatch = async (e, id, restoreStock = false) => {
    if (e) e.stopPropagation()
    setError('')
    setSuccess('')
    try {
      setActionLoading(true)
      await batchesApi.deleteBatch(id, restoreStock)
      setHistory(prev => prev.filter(b => b._id !== id))
      setConfirmDeleteBatchId(null)
      if (restoreStock) {
        setSuccess('Batch deleted and consumed steel stock successfully restored to inventory!')
      } else {
        setSuccess('Batch optimization history log deleted successfully!')
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to delete batch entry.')
    } finally {
      setActionLoading(false)
    }
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
    return <LoadingSpinner message="Loading batch history..." minHeight="65vh" />
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

      {success && (
        <div className="alert alert-success">
          <span>{success}</span>
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
            const date = `${new Date(batch.createdAt).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}, ${new Date(batch.createdAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit'
            })}`;

            const totalBars = batch.layouts?.reduce((sum, l) => sum + Number(l.repetition), 0) || 0
            const totalParts = batch.layouts?.reduce((sum, l) => {
              const partsCount = l.parts?.length || (l.stockLength > l.waste ? 1 : 0);
              return sum + (partsCount * Number(l.repetition));
            }, 0) || 0

            return (
              <div key={batch._id} className={`card batch-history-card ${isExpanded ? 'expanded' : ''} ${printMenuBatchId === batch._id ? 'has-open-menu' : ''}`}>
                {/* Header block (Click to toggle) */}
                <div className="batch-card-header" onClick={() => toggleExpand(batch._id)}>
                  <div className="batch-meta-left" onClick={(e) => e.stopPropagation()}>
                    {editingBatchId === batch._id ? (
                      <div className="batch-rename-form">
                        <input
                          type="text"
                          value={editBatchName}
                          onChange={(e) => setEditBatchName(e.target.value)}
                          className="batch-rename-input"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveBatchEdit(e, batch._id)
                            else if (e.key === 'Escape') handleCancelBatchEdit(e)
                          }}
                        />
                        <button
                          className="batch-rename-save-btn"
                          onClick={(e) => handleSaveBatchEdit(e, batch._id)}
                          disabled={actionLoading}
                          title="Save"
                        >
                          <Save size={13} />
                        </button>
                        <button
                          className="batch-rename-cancel-btn"
                          onClick={handleCancelBatchEdit}
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="batch-name" onDoubleClick={(e) => handleEditBatch(e, batch)} title="Click edit icon or double click to rename">
                          {batch.batchName}
                          <button
                            className="btn-icon-rename"
                            onClick={(e) => handleEditBatch(e, batch)}
                            title="Rename Batch"
                            style={{ background: 'none', border: 'none', color: 'var(--text-label)', padding: '2px 4px', cursor: 'pointer', marginLeft: '6px', opacity: 0.7 }}
                          >
                            <Pencil size={12} />
                          </button>
                        </span>
                        <span className="batch-date">
                          <Calendar size={13} style={{ marginRight: '4px' }} /> {date}
                        </span>
                      </>
                    )}

                  </div>

                  <div className="batch-meta-right">
                    {/* Print Options Dropdown */}
                    <div className="print-menu-wrapper" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="btn-print-batch animate-hover" 
                        onClick={() => setPrintMenuBatchId(prev => prev === batch._id ? null : batch._id)}
                        title="Choose Print Mode & Report Layout"
                      >
                        <Printer size={13} style={{ marginRight: '4px' }} /> Print Options <ChevronDown size={11} style={{ marginLeft: '2px' }} />
                      </button>

                      {printMenuBatchId === batch._id && (
                        <div className="print-dropdown-menu">
                          <button
                            className="print-opt-item"
                            onClick={() => triggerBatchPrint(batch, 'foreman')}
                          >
                            <div className="print-opt-icon-box icon-foreman">
                              <Scissors size={15} />
                            </div>
                            <div className="print-opt-text">
                              <div className="print-opt-title">Steel Foreman Cut-Sheet</div>
                              <div className="print-opt-desc">Layouts + Stock & Wastage (Site Cutting)</div>
                            </div>
                          </button>

                          <button
                            className="print-opt-item"
                            onClick={() => triggerBatchPrint(batch, 'full')}
                          >
                            <div className="print-opt-icon-box icon-full">
                              <FileText size={15} />
                            </div>
                            <div className="print-opt-text">
                              <div className="print-opt-title">Complete Executive Report</div>
                              <div className="print-opt-desc">All KPIs, layouts, wastage & summary</div>
                            </div>
                          </button>

                          <button
                            className="print-opt-item"
                            onClick={() => triggerBatchPrint(batch, 'summary')}
                          >
                            <div className="print-opt-icon-box icon-summary">
                              <BarChart3 size={15} />
                            </div>
                            <div className="print-opt-text">
                              <div className="print-opt-title">1-Page Summary Sheet</div>
                              <div className="print-opt-desc">Yield, scrap loss & savings overview</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                    {confirmDeleteBatchId === batch._id ? (
                      <div className="batch-delete-confirm-popover" onClick={(e) => e.stopPropagation()}>
                        <div className="delete-popover-header">
                          <AlertCircle size={14} className="text-rose" />
                          <span>Delete Batch?</span>
                        </div>
                        <div className="delete-popover-options">
                          <button
                            className="delete-opt-btn btn-delete-log-only"
                            onClick={(e) => handleConfirmDeleteBatch(e, batch._id, false)}
                            disabled={actionLoading}
                            title="Deletes the report log without modifying physical yard stock"
                          >
                            <Trash2 size={12} /> Delete Report Only
                          </button>
                          <button
                            className="delete-opt-btn btn-delete-restore-stock"
                            onClick={(e) => handleConfirmDeleteBatch(e, batch._id, true)}
                            disabled={actionLoading}
                            title="Restores consumed steel bars to stock and removes generated remnants"
                          >
                            <RotateCcw size={12} /> Delete & Restore Stock
                          </button>
                          <button
                            className="delete-opt-btn btn-cancel-delete"
                            onClick={handleCancelDeleteBatch}
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button 
                          className="btn-edit-batch animate-hover"
                          onClick={() => onEditBatch(batch)}
                          title="Edit Batch optimization input parameters"
                        >
                          <Pencil size={13} style={{ marginRight: '4px' }} /> Edit Batch
                        </button>
                        <button 
                          className="btn-delete-batch animate-hover"
                          onClick={(e) => handleDeleteBatch(e, batch._id)}
                          title="Delete Batch Record"
                        >
                          <Trash2 size={13} style={{ marginRight: '4px' }} /> Delete
                        </button>
                      </>
                    )}
                    <div className="meta-pill text-green">
                      <TrendingUp size={13} /> {batch.summary?.avgUtilization?.toFixed(2)}% Util.
                    </div>
                    <div className="meta-pill text-cyan">
                      <Layers size={13} /> {totalBars} Bars Used
                    </div>
                    <div className="meta-pill text-red-scrap" title="Datewise Batch Scrap Record">
                      <Scale size={13} /> Scrap: {batch.summary?.totalScrapKg ? batch.summary.totalScrapKg.toFixed(2) : '0.00'} kg
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
              </div>
            )
          })}
        </div>
      )}

      {/* ── Native Browser A4 Printable Engine ── */}
      {activePrintBatch && (
        <div className={`batch-print-portal print-content-root print-mode-${printOption}`}>
          {/* Print Header */}
          <div className="print-header">
            <div>
              <h2 className="print-title">RebarOptima Cutting Optimization Report</h2>
              <div className="print-badge-row">
                <span className="print-batch-name">{activePrintBatch.batchName}</span>
                <span className="print-mode-indicator">
                  {printOption === 'foreman' ? '👷 Steel Foreman Cut-Sheet' : printOption === 'summary' ? '📊 1-Page Summary' : '📄 Full A4 Report'}
                </span>
              </div>
            </div>
            <div className="print-date">
              Generated: {new Date(activePrintBatch.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>

          {/* KPI Dashboard (Hidden in Foreman mode) */}
          <div className="print-kpi-grid">
            <div className="print-kpi-card">
              <span className="kpi-title">Average Utilization</span>
              <span className="kpi-data text-emerald">{activePrintBatch.summary?.avgUtilization?.toFixed(2)}%</span>
            </div>
            <div className="print-kpi-card">
              <span className="kpi-title">Total Cuts / Parts</span>
              <span className="kpi-data">{(activePrintBatch.summary?.totalPartsLength / 1000).toFixed(1)} m</span>
            </div>
            <div className="print-kpi-card">
              <span className="kpi-title">Yield Stock</span>
              <span className="kpi-data">{(activePrintBatch.summary?.totalUsedStockLength / 1000).toFixed(1)} m</span>
            </div>
            <div className="print-kpi-card">
              <span className="kpi-title">Scrap Generated</span>
              <span className="kpi-data text-rose">{activePrintBatch.summary?.totalScrapKg?.toFixed(2)} kg</span>
            </div>
            <div className="print-kpi-card">
              <span className="kpi-title">Remnants Saved</span>
              <span className="kpi-data text-cyan">{activePrintBatch.summary?.totalRemnantKg?.toFixed(2)} kg</span>
            </div>
          </div>

          {/* Cutting Layouts for Printing */}
          <div className="print-layouts-section">
            <h3 className="print-section-title">Cutting Layouts & Offcut Map</h3>
            <div className="print-layouts-list">
              {activePrintBatch.layouts?.map((rawLayout, lIdx) => {
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
                  <div key={lIdx} className="card layout-card-new print-layout-card" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <div className="layout-grid-new">
                      {/* Left Panel */}
                      <div className="layout-left-panel">
                        <div className="layout-avatar-id">{lIdx + 1}</div>
                        <div className="layout-info-stack">
                          <div className="layout-rep-info">
                            <span className="layout-rep-val">{layout.repetition}x</span>
                            <span className="layout-rep-label">Repetition</span>
                          </div>
                          <div className="layout-details-grid">
                            <div className="detail-item">
                              <span className="detail-lbl">Dia</span>
                              <span className="detail-val">{layout.diameter || '12'} mm</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-lbl">Stock</span>
                              <span className="detail-val">{layout.stockLength.toLocaleString()} mm</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle Panel Ruler */}
                      <div className="layout-middle-panel">
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
                                  <div className="bar-segment remnant-segment" style={{ width: `${wastePercent}%` }}>
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
                          <span className="right-stat-val">{layout.waste.toLocaleString()} mm</span>
                        </div>
                        <div className="right-stat-box">
                          <span className="right-stat-lbl">Yield</span>
                          <span className="right-stat-val text-green">{utilization.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
