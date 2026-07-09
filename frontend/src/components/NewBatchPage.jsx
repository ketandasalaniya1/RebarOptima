import { useState, useRef, useEffect } from 'react'
import './NewBatchPage.css'
import { solve1DCSP } from '../utils/optimizer'
import topAdStrip from '../assets/top_ad _strip.jpeg'
import bottomAdStrip from '../assets/bottom_ad_strip.jpeg'
import {
  X,
  Zap,
  BarChart3,
  Download,
  AlertCircle,
  Upload
} from 'lucide-react'

const initialStock = [
  { id: 1, diameter: '8', length: '12000', quantity: '1000' },
]

const initialParts = [
  { id: 1, diameter: '8', length: '', quantity: '', label: '' },
]

// ponytail: shared hook for add-row-on-Tab logic across both tables
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

  // Clear error when rows change
  useEffect(() => {
    setError(null)
  }, [stock.rows, parts.rows])



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
      // split by comma, semicolon or tab
      const cols = line.split(/[,\t;]/).map(c => c.trim())
      if (cols.length >= 2) {
        const diameter = cols[0] || '12'
        const length = cols[1] || ''
        const quantity = cols[2] || ''
        const label = cols[3] || ''

        // validation: skip header row if length is not a number
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
        // If the first row is the default blank row, remove it
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
    <div className="optimizer-page">
      {/* Top Ad Strip */}
      <div className="top-ad-strip-container">
        <a href="https://cravorasolutions.com/" target="_blank" rel="noopener noreferrer">
          <img src={topAdStrip} alt="Advertisement" className="top-ad-strip-img" />
        </a>
      </div>

      {/* Available Stock */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Available Stock</h2>
          <button className="add-row-btn" onClick={() => stock.addRow()}>+ Add Row</button>
        </div>

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
                      className="form-select"
                      value={row.diameter}
                      onChange={(e) => stock.updateRow(row.id, 'diameter', e.target.value)}
                      ref={i === stock.rows.length - 1 ? stock.firstFieldRef : undefined}
                    >
                      <option>8</option>
                      <option>10</option>
                      <option>12</option>
                      <option>16</option>
                      <option>20</option>
                      <option>25</option>
                      <option>32</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      value={row.length}
                      onChange={(e) => stock.updateRow(row.id, 'length', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      value={row.quantity}
                      onChange={(e) => stock.updateRow(row.id, 'quantity', e.target.value)}
                      onKeyDown={(e) => stock.handleLastFieldKeyDown(e, i === stock.rows.length - 1)}
                    />
                  </td>
                  <td className="col-actions">
                    <button className="delete-btn" onClick={() => stock.deleteRow(row.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>



      {/* Required Parts */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Required Parts</h2>
          <div className="actions-header-row">
            <button className="import-row-btn" onClick={() => setShowImportModal(true)}>
              <Upload size={13} style={{ marginRight: '4px' }} /> Import CSV
            </button>
            <button className="add-row-btn" onClick={() => parts.addRow()}>+ Add Row</button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>Diameter (mm)</th>
                <th>Length (mm)</th>
                <th>Quantity</th>
                <th>Label</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parts.rows.map((row, i) => (
                <tr key={row.id}>
                  <td className="col-num">{i + 1}</td>
                  <td>
                    <select
                      className="form-select"
                      value={row.diameter}
                      onChange={(e) => parts.updateRow(row.id, 'diameter', e.target.value)}
                      ref={i === parts.rows.length - 1 ? parts.firstFieldRef : undefined}
                    >
                      <option>8</option>
                      <option>10</option>
                      <option>12</option>
                      <option>16</option>
                      <option>20</option>
                      <option>25</option>
                      <option>32</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      value={row.length}
                      onChange={(e) => parts.updateRow(row.id, 'length', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      value={row.quantity}
                      onChange={(e) => parts.updateRow(row.id, 'quantity', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="text"
                      value={row.label}
                      onChange={(e) => parts.updateRow(row.id, 'label', e.target.value)}
                      onKeyDown={(e) => parts.handleLastFieldKeyDown(e, i === parts.rows.length - 1)}
                      placeholder="Optional"
                    />
                  </td>
                  <td className="col-actions">
                    <button className="delete-btn" onClick={() => parts.deleteRow(row.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="modal-backdrop">
          <div className="modal-content card">
            <div className="modal-header">
              <h3 className="modal-title">Bulk CSV Import</h3>
              <button className="close-modal-btn" onClick={() => setShowImportModal(false)}>
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
              const data = solve1DCSP(stock.rows, parts.rows, {});
              onOptimize(data);
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          RUN OPTIMIZATION
        </button>
      </div>

      {/* Bottom Ad Strip (Mobile View Only) */}
      <div className="bottom-ad-strip-container">
        <a href="https://cravorasolutions.com/" target="_blank" rel="noopener noreferrer">
          <img src={bottomAdStrip} alt="Advertisement" className="bottom-ad-strip-img" />
        </a>
      </div>

      {/* Premium Educational Landing Section */}
      <section className="card landing-info-section">
        <h3 className="landing-section-title">Linear Cut List Optimization</h3>
        <p className="landing-section-subtitle">
          RebarOptima solves the One-Dimensional Cutting Stock Problem (1D-CSP) for rebars, steel sections, pipes, and linear materials using advanced Operations Research optimization algorithms.
        </p>

        <div className="landing-grid-features">
          <div className="landing-feature-card">
            <div className="feature-icon-circle">
              <Zap size={18} color="var(--accent)" />
            </div>
            <h4 className="feature-title">Minimize Scrap Waste</h4>
            <p className="feature-desc">
              Reduce steel wastage from double digits to less than 1.5% with layouts mathematically guaranteed to maximize stock yield.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="feature-icon-circle">
              <BarChart3 size={18} color="var(--accent)" />
            </div>
            <h4 className="feature-title">Real-time Analytics</h4>
            <p className="feature-desc">
              Track overall utilization percentages, exact cut layouts visualizer, and total waste remnants calculations instantly.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="feature-icon-circle">
              <Download size={18} color="var(--accent)" />
            </div>
            <h4 className="feature-title">Direct Reports Export</h4>
            <p className="feature-desc">
              Download clean A4 portrait-friendly PDF lists or generate formatted spreadsheet CSV files with one single click.
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
