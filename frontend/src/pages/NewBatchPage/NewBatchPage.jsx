import { useState, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import './NewBatchPage.css'
import { solve1DCSP } from '../../utils/optimizer'
import { inventoryApi, batchesApi } from '../../utils/api'
import {
  X,
  AlertCircle,
  Upload,
  ChevronDown,
  ChevronUp,
  Settings,
  Plus,
  Eye,
  EyeOff,
  History,
  TrendingUp
} from 'lucide-react'

const initialStock = [
  { id: 1, diameter: '12', length: '12000', quantity: '10' },
]

const initialParts = [
  { id: 1, diameter: '12', length: '', quantity: '', label: '' },
]

// shared hook for add-row-on-Tab logic across both tables
function useTableRows(initial, defaults) {
  const [rows, setRows] = useState(initial)
  const focusNew = useRef(false)

  const addRow = (overrides = {}) => {
    focusNew.current = true
    setRows(prev => {
      const maxId = prev.reduce((max, r) => (r.id > max ? r.id : max), 0)
      return [...prev, { id: maxId + 1, ...defaults(prev), ...overrides }]
    })
  }

  const deleteRow = (id) => setRows(prev => prev.filter(r => r.id !== id))

  const updateRow = (id, field, value) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))

  const handleLastFieldKeyDown = (e, isLastRow) => {
    if ((e.key === 'Tab' && !e.shiftKey && isLastRow) || e.key === 'Enter') {
      e.preventDefault()
      addRow()
    }
  }

  // callback ref for first field of last row
  const firstFieldRef = (el) => {
    if (el && focusNew.current) {
      el.focus()
      focusNew.current = false
    }
  }

  return { rows, setRows, addRow, deleteRow, updateRow, handleLastFieldKeyDown, firstFieldRef }
}

export default function NewBatchPage({ onOptimize }) {
  const settingsState = useSelector((state) => state.settings)
  
  const stock = useTableRows(initialStock, (prev) => ({
    diameter: prev.length ? prev[prev.length - 1].diameter : '12',
    length: '12000',
    quantity: '',
  }))
  const parts = useTableRows(initialParts, (prev) => ({
    diameter: prev.length ? prev[prev.length - 1].diameter : '12',
    length: '',
    quantity: '',
    label: '',
  }))

  const [error, setError] = useState(null)
  const [isStockExpanded, setIsStockExpanded] = useState(false)
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false)
  const [recentBatches, setRecentBatches] = useState([])
  
  const [kerf, setKerf] = useState(settingsState.defaultKerf)
  const [trimMargin, setTrimMargin] = useState(settingsState.defaultTrimMargin)

  // Sync state if settings change
  useEffect(() => {
    setKerf(settingsState.defaultKerf)
    setTrimMargin(settingsState.defaultTrimMargin)
  }, [settingsState])

  // Clear error when rows change
  useEffect(() => {
    setError(null)
  }, [stock.rows, parts.rows])

  // Load stock items and remnants, plus batches history dynamically from DB on mount
  useEffect(() => {
    async function loadStockAndBatches() {
      try {
        const [stockData, batchesData] = await Promise.all([
          inventoryApi.getInventory(),
          batchesApi.getHistory()
        ])
        
        const combined = []
        let index = 1

        stockData.standardStock.forEach(s => {
          combined.push({
            id: index++,
            dbId: s._id,
            diameter: String(s.diameter),
            length: String(s.length),
            quantity: String(s.quantity),
            isRemnant: false,
            costPerKg: s.costPerKg || 0
          })
        })

        stockData.remnantsStock.forEach(s => {
          combined.push({
            id: index++,
            dbId: s._id,
            diameter: String(s.diameter),
            length: String(s.length),
            quantity: String(s.quantity),
            isRemnant: true,
            costPerKg: s.costPerKg || 0
          })
        })

        if (combined.length > 0) {
          stock.setRows(combined)
        }

        setRecentBatches(batchesData.slice(0, 5))
      } catch (err) {
        console.error('Failed to load stock or batch history:', err)
      }
    }
    loadStockAndBatches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // CSV Import Modal states
  const [showImportModal, setShowImportModal] = useState(false)
  const [csvText, setCsvText] = useState('')

  const handleImportCSV = () => {
    if (!csvText.trim()) return

    const lines = csvText.split('\n')
    const newParts = []
    const currentMaxId = parts.rows.reduce((max, r) => (r.id > max ? r.id : max), 0)
    let tempId = currentMaxId + 1

    lines.forEach(line => {
      const cols = line.split(/[,\t;]/).map(c => c.trim())
      if (cols.length >= 2) {
        const diameter = cols[0] || '12'
        const length = cols[1] || ''
        const quantity = cols[2] || ''
        const label = cols[3] || ''

        if (isNaN(Number(length)) || length === '') return

        newParts.push({
          id: tempId++,
          diameter,
          length,
          quantity,
          label
        })
      }
    })

    if (newParts.length > 0) {
      parts.setRows(prev => {
        if (prev.length > 0 && prev[0].length === '' && prev[0].quantity === '') {
          return [...prev.slice(1), ...newParts]
        }
        return [...prev, ...newParts]
      })
    }

    setCsvText('')
    setShowImportModal(false)
  }

  return (
    <div className="optimizer-container-grid">
      {/* Left Column: Optimization input form */}
      <div className="optimizer-left-main">
        <div className="optimizer-page">
          {/* Collapsible Manual Stock Override section */}
          <section className="card stock-section-card">
            <div className="section-header">
              <div className="title-with-toggle">
                <h2 className="section-title">Manual Stock Override</h2>
                <span className="section-title-hint">(Add outside stock or simulation parameters manually)</span>
              </div>
              <div className="header-actions">
                <button 
                  className="toggle-stock-btn" 
                  onClick={() => setIsStockExpanded(!isStockExpanded)}
                >
                  {isStockExpanded ? (
                    <>Collapse Inputs <ChevronUp size={16} /></>
                  ) : (
                    <>Expand Inputs <ChevronDown size={16} /></>
                  )}
                </button>
                {isStockExpanded && (
                  <button className="add-row-btn" onClick={() => stock.addRow()}>
                    <Plus size={14} /> Add Row
                  </button>
                )}
              </div>
            </div>

            {isStockExpanded ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="col-num">#</th>
                      <th>Diameter (mm)</th>
                      <th>Length (mm)</th>
                      <th>Quantity</th>
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.rows.map((row, i) => (
                      <tr key={row.id}>
                        <td className="col-num">{i + 1}</td>
                        <td>
                          <select
                            ref={i === stock.rows.length - 1 ? stock.firstFieldRef : null}
                            className="form-select"
                            value={row.diameter}
                            onChange={(e) => stock.updateRow(row.id, 'diameter', e.target.value)}
                          >
                            {[8, 10, 12, 16, 20, 25, 32].map(d => (
                              <option key={d} value={d}>{d} mm</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="form-input"
                            type="number"
                            value={row.length}
                            onChange={(e) => stock.updateRow(row.id, 'length', e.target.value)}
                            placeholder="Length (mm)"
                          />
                        </td>
                        <td>
                          <input
                            className="form-input"
                            type="number"
                            value={row.quantity}
                            onChange={(e) => stock.updateRow(row.id, 'quantity', e.target.value)}
                            placeholder="Quantity"
                            onKeyDown={(e) => stock.handleLastFieldKeyDown(e, i === stock.rows.length - 1)}
                          />
                        </td>
                        <td className="col-actions">
                          <button className="delete-btn" onClick={() => stock.deleteRow(row.id)}>
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="stock-collapsed-hint">
                Standard stocks are pre-loaded from live database counts. (Click Expand to add custom/manual stock simulated values)
              </div>
            )}
          </section>

          {/* Advanced Settings parameters */}
          <section className="card advanced-params-card advanced-card">
            <div className="advanced-header" onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}>
              <span className="advanced-title">
                <Settings size={18} /> Advanced Parameter Settings
              </span>
              {isAdvancedExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {isAdvancedExpanded && (
              <div className="advanced-body">
                <div className="advanced-inputs-grid">
                  <div className="advanced-input-group">
                    <label className="adv-lbl">Kerf Width (mm)</label>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={kerf}
                      onChange={(e) => setKerf(Number(e.target.value))}
                    />
                    <span className="adv-hint">Blade cuts loss margin. (default: 0mm)</span>
                  </div>

                  <div className="advanced-input-group">
                    <label className="adv-lbl">Trim Margin (mm)</label>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={trimMargin}
                      onChange={(e) => setTrimMargin(Number(e.target.value))}
                    />
                    <span className="adv-hint">End waste margins. (default: 0mm)</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Required Parts */}
          <section className="card parts-section-card">
            <div className="section-header">
              <h2 className="section-title">Required Parts</h2>
              <div className="actions-header-row">
                <button className="import-row-btn" onClick={() => setShowImportModal(true)}>
                  <Upload size={14} style={{ marginRight: '4px' }} /> Import CSV
                </button>
                <button className="add-row-btn" onClick={() => parts.addRow()}>
                  <Plus size={14} /> Add Row
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="col-num">#</th>
                    <th>Diameter (mm)</th>
                    <th>Required Length (mm)</th>
                    <th>Quantity</th>
                    <th>Label (Optional)</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.rows.map((row, i) => (
                    <tr key={row.id}>
                      <td className="col-num">{i + 1}</td>
                      <td>
                        <select
                          ref={i === parts.rows.length - 1 ? parts.firstFieldRef : null}
                          className="form-select"
                          value={row.diameter}
                          onChange={(e) => parts.updateRow(row.id, 'diameter', e.target.value)}
                        >
                          {[8, 10, 12, 16, 20, 25, 32].map(d => (
                            <option key={d} value={d}>{d} mm</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="form-input"
                          type="number"
                          value={row.length}
                          onChange={(e) => parts.updateRow(row.id, 'length', e.target.value)}
                          placeholder="e.g. 3500"
                        />
                      </td>
                      <td>
                        <input
                          className="form-input"
                          type="number"
                          value={row.quantity}
                          onChange={(e) => parts.updateRow(row.id, 'quantity', e.target.value)}
                          placeholder="e.g. 5"
                        />
                      </td>
                      <td>
                        <input
                          className="form-input"
                          type="text"
                          value={row.label}
                          onChange={(e) => parts.updateRow(row.id, 'label', e.target.value)}
                          placeholder="e.g. Beams-A"
                          onKeyDown={(e) => parts.handleLastFieldKeyDown(e, i === parts.rows.length - 1)}
                        />
                      </td>
                      <td className="col-actions">
                        <button className="delete-btn" onClick={() => parts.deleteRow(row.id)}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {error && (
            <div className="error-alert-banner">
              <AlertCircle size={20} className="error-alert-icon" />
              <div className="error-alert-text">{error}</div>
            </div>
          )}

          {/* Optimize Button */}
          <div className="optimize-section">
            <button
              className="btn-optimize"
              onClick={() => {
                try {
                  const data = solve1DCSP(stock.rows, parts.rows, { kerf, trimMargin });
                  data.inputStock = stock.rows;
                  data.requiredParts = parts.rows;
                  data.settings = { kerf, trimMargin };
                  onOptimize(data);
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              RUN OPTIMIZATION
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Recent Batch History sidebar */}
      <div className="optimizer-right-sidebar">
        <div className="card recent-batches-sidebar-card">
          <div className="sidebar-header">
            <History size={16} className="sidebar-header-icon" />
            <h3 className="sidebar-title">Recent Optimizations</h3>
          </div>
          <p className="sidebar-desc">Quick look at previously committed batch summaries.</p>

          {recentBatches.length === 0 ? (
            <div className="sidebar-empty-state">
              <p>No recent batches found.</p>
            </div>
          ) : (
            <div className="sidebar-batch-list">
              {recentBatches.map((b) => {
                const totalBars = b.layouts?.reduce((sum, l) => sum + Number(l.repetition), 0) || 0;
                return (
                  <div key={b._id} className="sidebar-batch-item" onClick={() => onOptimize(b)} style={{ cursor: 'pointer' }}>
                    <div className="sidebar-batch-meta">
                      <span className="sidebar-batch-name">{b.batchName}</span>
                      <span className="sidebar-batch-date">
                        {new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                    <div className="sidebar-batch-stats">
                      <div className="sidebar-stat-chip">
                        <TrendingUp size={11} />
                        <span>{b.summary?.avgUtilization?.toFixed(1)}% Util</span>
                      </div>
                      <span className="sidebar-stat-lbl">{totalBars} Bars Used</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="modal-backdrop">
          <div className="modal-content card">
            <div className="modal-header">
              <h3 className="modal-title">Import Parts from CSV Text</h3>
              <button className="modal-close-btn" onClick={() => setShowImportModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">
                Paste columns values separated by commas in the layout below. Header row is ignored automatically.
              </p>
              <pre className="csv-format-example">
                Diameter, Length, Quantity, Label{"\n"}
                12, 2500, 32, Part A{"\n"}
                16, 4200, 15, Part B
              </pre>
              <textarea
                className="form-textarea"
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste CSV text here..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleImportCSV}>Import Data</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
