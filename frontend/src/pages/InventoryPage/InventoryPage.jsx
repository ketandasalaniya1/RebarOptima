import { useState, useEffect } from 'react'
import { inventoryApi } from '../../utils/api'
import {
  Package,
  Settings,
  PlusSquare,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  List
} from 'lucide-react'
import './InventoryPage.css'

export default function InventoryPage() {
  // Tab states: 'list' | 'inward' | 'rules'
  const [activeTab, setActiveTab] = useState('list')
  const [inventory, setInventory] = useState({ standardStock: [], remnantsStock: [] })
  const [scrapRules, setScrapRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Inward Form State
  const [inwardForm, setInwardForm] = useState({
    diameter: 12,
    quantity: '',
    weightInKgs: '',
    costPerKg: '',
    typeOfBar: 'TMT500',
    brandName: '',
    vendorName: '',
  })

  // Load inventory and rules on mount
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      setError('')
      const [invData, rulesData] = await Promise.all([
        inventoryApi.getInventory(),
        inventoryApi.getScrapRules()
      ])
      setInventory(invData)
      setScrapRules(rulesData)
    } catch (err) {
      setError(err.message || 'Failed to fetch inventory data.')
    } finally {
      setLoading(false)
    }
  }

  // Single bar weight calculation helper
  const getSingleBarWeight = (dia, lengthMm = 12000) => {
    return (lengthMm / 1000) * ((dia * dia) / 162)
  }

  // Inward Form Change Handlers with Auto-Conversion
  const handleInwardChange = (field, val) => {
    setInwardForm(prev => {
      const updated = { ...prev, [field]: val }
      
      const dia = Number(updated.diameter)
      const singleWeight = getSingleBarWeight(dia, 12000)

      if (field === 'weightInKgs') {
        // Convert weight to quantity
        const weight = parseFloat(val) || 0
        updated.quantity = weight > 0 ? String(Math.round(weight / singleWeight)) : ''
      } else if (field === 'quantity') {
        // Convert quantity to weight
        const qty = parseInt(val, 10) || 0
        updated.weightInKgs = qty > 0 ? String(Math.round(qty * singleWeight * 100) / 100) : ''
      } else if (field === 'diameter') {
        // Recompute weight if quantity exists
        const qty = parseInt(updated.quantity, 10) || 0
        if (qty > 0) {
          updated.weightInKgs = String(Math.round(qty * singleWeight * 100) / 100)
        }
      }
      return updated
    })
  }

  const handleInwardSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setActionLoading(true)

    try {
      const qty = parseInt(inwardForm.quantity) || 0
      const weight = parseFloat(inwardForm.weightInKgs) || 0
      const cost = parseFloat(inwardForm.costPerKg) || 0

      if (qty <= 0 || weight <= 0 || cost <= 0) {
        throw new Error('Please fill in quantity, weight, and cost per kg with values greater than zero.')
      }

      await inventoryApi.inward({
        diameter: Number(inwardForm.diameter),
        quantity: qty,
        weightInKgs: weight,
        costPerKg: cost,
        typeOfBar: inwardForm.typeOfBar,
        brandName: inwardForm.brandName,
        vendorName: inwardForm.vendorName,
      })

      setSuccess('Inward entry recorded successfully!')
      // Reset form
      setInwardForm({
        diameter: 12,
        quantity: '',
        weightInKgs: '',
        costPerKg: '',
        typeOfBar: 'TMT500',
        brandName: '',
        vendorName: '',
      })
      // Refresh inventory data
      const invData = await inventoryApi.getInventory()
      setInventory(invData)
      
      // Navigate back to list tab after a brief delay
      setTimeout(() => {
        setActiveTab('list')
        setSuccess('')
      }, 1500)

    } catch (err) {
      setError(err.message || 'Failed to submit inward entry.')
    } finally {
      setActionLoading(false)
    }
  }

  // Scrap Rules Form Change Handlers
  const handleRuleChange = (idx, value) => {
    setScrapRules(prev => {
      const updated = [...prev]
      updated[idx].scrapLengthThreshold = parseInt(value) || 0
      return updated
    })
  }

  const handleSaveRules = async () => {
    setError('')
    setSuccess('')
    setActionLoading(true)
    try {
      const updatedRules = await inventoryApi.updateScrapRules(scrapRules)
      setScrapRules(updatedRules)
      setSuccess('Scrap rules updated successfully!')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.message || 'Failed to save scrap rules.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="inventory-page loading-state">
        <div className="loader"></div>
        <p>Loading steel bar inventory...</p>
      </div>
    )
  }

  return (
    <div className="inventory-page">
      <div className="inventory-header-row">
        <div>
          <h1 className="inventory-title">Inventory Stock</h1>
          <p className="inventory-subtitle">Manage standard rebar stock, remnants, and scrap thresholds.</p>
        </div>
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <List size={16} /> Stock List
          </button>
          <button 
            className={`tab-btn ${activeTab === 'inward' ? 'active' : ''}`}
            onClick={() => setActiveTab('inward')}
          >
            <PlusSquare size={16} /> Inward Entry
          </button>
          <button 
            className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            <Settings size={16} /> Scrap Rules
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Tab: Stock List */}
      {activeTab === 'list' && (
        <div className="stock-list-container">
          {/* Standard Stock Section */}
          <section className="card stock-section">
            <h3 className="section-title">
              <Package size={18} style={{ marginRight: '6px' }} /> Standard Bar Stock
            </h3>
            {inventory.standardStock.length === 0 ? (
              <div className="empty-stock-state">
                <p>No standard stock items found in inventory. Add stock using the Inward Entry tab.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Diameter</th>
                      <th>Length</th>
                      <th>Qty (Bars)</th>
                      <th>Total Weight (kg)</th>
                      <th>Cost (per kg)</th>
                      <th>Type</th>
                      <th>Brand</th>
                      <th>Vendor</th>
                      <th>Inward Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.standardStock.map((item) => (
                      <tr key={item._id}>
                        <td className="font-bold">{item.diameter} mm</td>
                        <td>{(item.length / 1000).toFixed(1)} m</td>
                        <td className="font-bold">{item.quantity}</td>
                        <td>{Math.round(item.weightInKgs).toLocaleString()} kg</td>
                        <td>Rs. {item.costPerKg}</td>
                        <td>{item.typeOfBar || '-'}</td>
                        <td>{item.brandName || '-'}</td>
                        <td>{item.vendorName || '-'}</td>
                        <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Remnants Stock Section */}
          <section className="card stock-section remnant-card">
            <h3 className="section-title">
              <Sparkles size={18} color="#3ac0e8" style={{ marginRight: '6px' }} /> Reusable Remnants Stock
            </h3>
            <p className="remnant-disclaimer">
              These are reusable remnants generated automatically from previous cutting optimizations. They are prioritised first in next optimizations.
            </p>
            {inventory.remnantsStock.length === 0 ? (
              <div className="empty-stock-state">
                <p>No remnants currently available in stock. Run optimization to generate remnants.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Diameter</th>
                      <th>Length</th>
                      <th>Qty (Remnants)</th>
                      <th>Total Weight (kg)</th>
                      <th>Original Type</th>
                      <th>Original Brand</th>
                      <th>Original Vendor</th>
                      <th>Generated Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.remnantsStock.map((item) => (
                      <tr key={item._id}>
                        <td className="font-bold text-cyan">{item.diameter} mm</td>
                        <td className="font-bold">{item.length.toLocaleString()} mm</td>
                        <td className="font-bold">{item.quantity}</td>
                        <td>{Math.round(item.weightInKgs).toLocaleString()} kg</td>
                        <td>{item.typeOfBar || '-'}</td>
                        <td>{item.brandName || '-'}</td>
                        <td>{item.vendorName || '-'}</td>
                        <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab: Inward Entry */}
      {activeTab === 'inward' && (
        <div className="card inward-form-card">
          <h3 className="form-card-title">Manual Stock Inward Entry</h3>
          <p className="form-card-subtitle">
            Purchased standard bars (standard length 12m/12000mm) entry. Fill quantity in Bars or total Weight in Kgs to auto-convert.
          </p>

          <form onSubmit={handleInwardSubmit} className="inward-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Diameter of Bar (mm)</label>
                <select
                  value={inwardForm.diameter}
                  onChange={(e) => handleInwardChange('diameter', Number(e.target.value))}
                  className="inward-input"
                >
                  {[8, 10, 12, 16, 20, 25, 32].map(d => (
                    <option key={d} value={d}>{d} mm</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Weight of Bars (Kgs)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Enter total weight in Kgs"
                  value={inwardForm.weightInKgs}
                  onChange={(e) => handleInwardChange('weightInKgs', e.target.value)}
                  className="inward-input animate-input"
                />
              </div>

              <div className="form-group animate-highlight">
                <label>Quantity (Number of Bars)</label>
                <input
                  type="number"
                  placeholder="Computed automatically from Weight"
                  value={inwardForm.quantity}
                  onChange={(e) => handleInwardChange('quantity', e.target.value)}
                  className="inward-input font-bold"
                />
              </div>

              <div className="form-group">
                <label>Cost per Kg (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 55"
                  required
                  value={inwardForm.costPerKg}
                  onChange={(e) => handleInwardChange('costPerKg', e.target.value)}
                  className="inward-input"
                />
              </div>

              <div className="form-group">
                <label>Type of Bar</label>
                <select
                  value={inwardForm.typeOfBar}
                  onChange={(e) => handleInwardChange('typeOfBar', e.target.value)}
                  className="inward-input"
                >
                  <option value="TMT500">TMT 500</option>
                  <option value="TMT500D">TMT 500D</option>
                  <option value="TMT550">TMT 550</option>
                  <option value="TMT550D">TMT 550D</option>
                  <option value="Plain">Plain Bar</option>
                </select>
              </div>

              <div className="form-group">
                <label>Brand Name</label>
                <input
                  type="text"
                  placeholder="e.g. VikrantTMT"
                  value={inwardForm.brandName}
                  onChange={(e) => handleInwardChange('brandName', e.target.value)}
                  className="inward-input"
                />
              </div>

              <div className="form-group">
                <label>Vendor Name</label>
                <input
                  type="text"
                  placeholder="e.g. KalyanTraders"
                  value={inwardForm.vendorName}
                  onChange={(e) => handleInwardChange('vendorName', e.target.value)}
                  className="inward-input"
                />
              </div>
            </div>

            <button type="submit" disabled={actionLoading} className="submit-inward-btn">
              {actionLoading ? 'Recording Entry...' : 'Record Inward Entry'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Scrap Rules */}
      {activeTab === 'rules' && (
        <div className="card rules-card">
          <h3 className="rules-card-title">Reusable Remnant & Scrap Rules</h3>
          <p className="rules-card-subtitle">
            Configure the threshold length for each diameter. Leftover pieces shorter than this length go to **Scrap/Waste** (logged). Leftover pieces greater than or equal to this length are saved as **Reusable Remnants** to be used first in future optimizations.
          </p>

          <div className="rules-grid">
            <div className="rules-header-row">
              <span className="col-lbl">Diameter (mm)</span>
              <span className="col-lbl">Reusable Remnant Threshold Length (mm)</span>
            </div>
            {scrapRules.map((rule, idx) => (
              <div key={rule._id || rule.diameter} className="rules-row">
                <span className="rule-dia">{rule.diameter} mm</span>
                <div className="rule-input-wrapper">
                  <input
                    type="number"
                    value={rule.scrapLengthThreshold}
                    onChange={(e) => handleRuleChange(idx, e.target.value)}
                    className="rule-input"
                    min="100"
                    max="6000"
                  />
                  <span className="unit-label">mm</span>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleSaveRules} 
            disabled={actionLoading} 
            className="save-rules-btn"
          >
            {actionLoading ? 'Saving Rules...' : 'Save Scrap Rules'}
          </button>
        </div>
      )}
    </div>
  )
}
