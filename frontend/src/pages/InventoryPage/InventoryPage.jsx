import { useState, useEffect } from 'react'
import { inventoryApi } from '../../utils/api'
import {
  Package,
  Settings,
  PlusSquare,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  List,
  Plus,
  Trash2,
  TrendingDown,
  DollarSign,
  Pencil,
  X,
  Save
} from 'lucide-react'
import './InventoryPage.css'

export default function InventoryPage() {
  // Tab states: 'list' | 'inward' | 'rules' | 'scrapsales'
  const [activeTab, setActiveTab] = useState('list')
  const [inventory, setInventory] = useState({ standardStock: [], remnantsStock: [] })
  const [scrapRules, setScrapRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Inward Multi-Diameter Voucher Form State
  const [voucherRows, setVoucherRows] = useState([
    { id: Date.now(), diameter: 8, weightInTons: '', pricePerTonWithoutGst: '', gstAmount: 0, totalPriceWithGst: 0, brandName: '', vendorName: '' }
  ])

  // Scrap Sales Portal State
  const [scrapSales, setScrapSales] = useState([
    { id: 1, date: '2026-07-01', buyer: 'Mittal Steel Scrap Corp', weight: 450, pricePerKg: 22, revenue: 9900 },
    { id: 2, date: '2026-07-10', buyer: 'Hariom Scrap Buyers', weight: 1200, pricePerKg: 24, revenue: 28800 }
  ])

  const [scrapSaleForm, setScrapSaleForm] = useState({
    date: new Date().toISOString().split('T')[0],
    buyer: '',
    weight: '',
    pricePerKg: ''
  })

  // Edit state for Scrap Sales History
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    date: '',
    buyer: '',
    weight: '',
    pricePerKg: ''
  })
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmDeleteStockId, setConfirmDeleteStockId] = useState(null)
  const [focusedDropdown, setFocusedDropdown] = useState(null)

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

  // Multi-Diameter Voucher handlers
  const handleAddVoucherRow = () => {
    setVoucherRows(prev => [
      ...prev,
      { id: Date.now(), diameter: 8, weightInTons: '', pricePerTonWithoutGst: '', gstAmount: 0, totalPriceWithGst: 0, brandName: '', vendorName: '' }
    ])
  }

  const handleDeleteVoucherRow = (id) => {
    if (voucherRows.length === 1) return
    setVoucherRows(prev => prev.filter(row => row.id !== id))
  }

  const handleVoucherRowChange = (id, field, value) => {
    setVoucherRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const updated = { ...row, [field]: value }

      const tons = parseFloat(updated.weightInTons) || 0
      const price = parseFloat(updated.pricePerTonWithoutGst) || 0

      updated.gstAmount = Math.round(tons * price * 0.18 * 100) / 100
      updated.totalPriceWithGst = Math.round(tons * price * 1.18 * 100) / 100
      return updated
    }))
  }

  const handleVoucherSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setActionLoading(true)

    try {
      for (const row of voucherRows) {
        const tons = parseFloat(row.weightInTons) || 0
        const price = parseFloat(row.pricePerTonWithoutGst) || 0
        if (tons <= 0 || price <= 0) {
          throw new Error('Please fill in valid weights and prices for all rows in the voucher.')
        }

        const singleWeight = getSingleBarWeight(row.diameter, 12000)
        const weightInKgs = tons * 1000
        const quantity = Math.round(weightInKgs / singleWeight)
        const costPerKg = (price * 1.18) / 1000 // Rs. including 18% GST

        await inventoryApi.inward({
          diameter: Number(row.diameter),
          quantity,
          weightInKgs,
          costPerKg,
          typeOfBar: 'TMT500',
          brandName: row.brandName || '',
          vendorName: row.vendorName || '',
        })
      }

      setSuccess('Voucher inward entry recorded successfully!')
      setVoucherRows([
        { id: Date.now(), diameter: 8, weightInTons: '', pricePerTonWithoutGst: '', gstAmount: 0, totalPriceWithGst: 0, brandName: '', vendorName: '' }
      ])
      
      const invData = await inventoryApi.getInventory()
      setInventory(invData)

      setTimeout(() => {
        setActiveTab('list')
        setSuccess('')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to submit voucher inward entry.')
    } finally {
      setActionLoading(false)
    }
  }

  // Scrap rules changes
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

  const handleDeleteStockItem = (id) => {
    setConfirmDeleteStockId(id)
  }

  const handleConfirmDeleteStock = async (id) => {
    setError('')
    try {
      await inventoryApi.deleteStockItem(id)
      setInventory(prev => ({
        ...prev,
        standardStock: prev.standardStock.filter(item => item._id !== id)
      }))
      setConfirmDeleteStockId(null)
      setSuccess('Stock entry deleted.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.message || 'Failed to delete stock entry.')
    }
  }

  const handleCancelDeleteStock = () => {
    setConfirmDeleteStockId(null)
  }

  // Scrap sales portal submission
  const handleScrapSaleSubmit = (e) => {
    e.preventDefault()
    const weight = parseFloat(scrapSaleForm.weight) || 0
    const price = parseFloat(scrapSaleForm.pricePerKg) || 0
    if (weight <= 0 || price <= 0 || !scrapSaleForm.buyer.trim()) return

    const revenue = weight * price
    setScrapSales(prev => [
      ...prev,
      {
        id: Date.now(),
        date: scrapSaleForm.date,
        buyer: scrapSaleForm.buyer,
        weight,
        pricePerKg: price,
        revenue
      }
    ])
    setSuccess('Scrap sale recorded successfully!')
    setScrapSaleForm({
      date: new Date().toISOString().split('T')[0],
      buyer: '',
      weight: '',
      pricePerKg: ''
    })
    setTimeout(() => setSuccess(''), 1500)
  }

  // Edit Scrap Sale handlers
  const handleEditSale = (sale) => {
    setEditingId(sale.id)
    setEditForm({
      date: sale.date,
      buyer: sale.buyer,
      weight: String(sale.weight),
      pricePerKg: String(sale.pricePerKg)
    })
  }

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveEdit = () => {
    const weight = parseFloat(editForm.weight) || 0
    const price = parseFloat(editForm.pricePerKg) || 0
    if (weight <= 0 || price <= 0 || !editForm.buyer.trim()) {
      setError('Please fill in all fields with valid values.')
      return
    }
    setScrapSales(prev => prev.map(s =>
      s.id === editingId
        ? { ...s, date: editForm.date, buyer: editForm.buyer, weight, pricePerKg: price, revenue: weight * price }
        : s
    ))
    setEditingId(null)
    setSuccess('Scrap sale entry updated successfully!')
    setTimeout(() => setSuccess(''), 1500)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setError('')
  }

  const handleDeleteSale = (id) => {
    setConfirmDeleteId(id)
  }

  const handleConfirmDelete = (id) => {
    setScrapSales(prev => prev.filter(s => s.id !== id))
    setConfirmDeleteId(null)
    setSuccess('Scrap sale entry deleted.')
    setTimeout(() => setSuccess(''), 1500)
  }

  const handleCancelDelete = () => {
    setConfirmDeleteId(null)
  }

  // Calculations for Scrap Sales Portal
  const totalScrapSoldWeight = scrapSales.reduce((sum, s) => sum + s.weight, 0)
  const totalScrapRevenue = scrapSales.reduce((sum, s) => sum + s.revenue, 0)
  
  // Average purchase price including GST is ₹60/kg for estimations
  const estPurchasePriceWithGst = 60
  const totalScrapLossDifferential = scrapSales.reduce((sum, s) => {
    const loss = (estPurchasePriceWithGst - s.pricePerKg) * s.weight
    return sum + loss
  }, 0)

  if (loading) {
    return (
      <div className="inventory-page loading-state">
        <div className="loader"></div>
        <p>Loading steel bar inventory...</p>
      </div>
    )
  }

  const uniqueBrands = Array.from(new Set([
    ...(inventory.standardStock || []).map(item => item.brandName),
    ...(inventory.remnantsStock || []).map(item => item.brandName)
  ].map(b => b ? b.trim() : '').filter(Boolean)));

  const uniqueVendors = Array.from(new Set([
    ...(inventory.standardStock || []).map(item => item.vendorName),
    ...(inventory.remnantsStock || []).map(item => item.vendorName)
  ].map(v => v ? v.trim() : '').filter(Boolean)));

  const getFilteredBrands = (val) => {
    const term = (val || '').toLowerCase().trim();
    if (!term) return uniqueBrands;
    return uniqueBrands.filter(b => b.toLowerCase().includes(term));
  };

  const getFilteredVendors = (val) => {
    const term = (val || '').toLowerCase().trim();
    if (!term) return uniqueVendors;
    return uniqueVendors.filter(v => v.toLowerCase().includes(term));
  };

  const handleSelectSuggestion = (rowId, field, value) => {
    handleVoucherRowChange(rowId, field, value);
    setFocusedDropdown(null);
  };

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
            <PlusSquare size={16} /> Voucher Inward
          </button>
          <button 
            className={`tab-btn ${activeTab === 'scrapsales' ? 'active' : ''}`}
            onClick={() => setActiveTab('scrapsales')}
          >
            <DollarSign size={16} /> Scrap Sales
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
                      <th>Cost (per kg with GST)</th>
                      <th>Type</th>
                      <th>Brand</th>
                      <th>Vendor</th>
                      <th>Inward Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.standardStock.map((item) => (
                      <tr key={item._id}>
                        <td className="font-bold">{item.diameter} mm</td>
                        <td>{(item.length / 1000).toFixed(1)} m</td>
                        <td className="font-bold">{item.quantity}</td>
                        <td>{Math.round(item.weightInKgs).toLocaleString()} kg</td>
                        <td>₹{item.costPerKg?.toFixed(2)}</td>
                        <td>{item.typeOfBar || '-'}</td>
                        <td>{item.brandName || '-'}</td>
                        <td>{item.vendorName || '-'}</td>
                        <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}</td>
                        <td>
                          {confirmDeleteStockId === item._id ? (
                            <div className="sale-delete-confirm">
                              <span className="delete-confirm-text">Delete?</span>
                              <button
                                className="confirm-delete-btn"
                                onClick={() => handleConfirmDeleteStock(item._id)}
                              >
                                Yes
                              </button>
                              <button
                                className="cancel-delete-btn"
                                onClick={handleCancelDeleteStock}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              className="delete-row-btn"
                              title="Delete this stock entry"
                              onClick={() => handleDeleteStockItem(item._id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
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
              <Sparkles size={18} color="#059669" style={{ marginRight: '6px' }} /> Reusable Remnants Stock
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

      {/* Tab: Multi-Diameter Inward Voucher */}
      {activeTab === 'inward' && (
        <div className="card inward-form-card">
          <div className="voucher-header">
            <div>
              <h3 className="form-card-title">Multi-Diameter Inward Voucher Entry</h3>
              <p className="form-card-subtitle">
                Log multiple diameters delivered in the truck. Weight must be entered in **Tons** (1 Ton = 1000 kg). Pricing fields assume price without GST; 18% GST is automatically calculated.
              </p>
            </div>
            <button className="add-voucher-row-btn" onClick={handleAddVoucherRow}>
              <Plus size={14} /> Add Row
            </button>
          </div>

          <form onSubmit={handleVoucherSubmit} className="inward-form">
            <div className="table-responsive">
              <table className="voucher-entry-table">
                <thead>
                  <tr>
                    <th>Diameter</th>
                    <th>Weight (Tons)</th>
                    <th>Price/Ton (Without GST)</th>
                    <th>GST Amount (18%)</th>
                    <th>Total Price (With GST)</th>
                    <th>Brand Name</th>
                    <th>Vendor Name</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherRows.map((row, idx) => (
                    <tr key={row.id}>
                      <td>
                        <select
                          value={row.diameter}
                          onChange={(e) => handleVoucherRowChange(row.id, 'diameter', Number(e.target.value))}
                          className="voucher-select"
                        >
                          {[8, 10, 12, 16, 20, 25, 32].map(d => (
                            <option key={d} value={d}>{d} mm</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="e.g. 2.5"
                          value={row.weightInTons}
                          onChange={(e) => handleVoucherRowChange(row.id, 'weightInTons', e.target.value)}
                          className="voucher-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          required
                          placeholder="e.g. 52000"
                          value={row.pricePerTonWithoutGst}
                          onChange={(e) => handleVoucherRowChange(row.id, 'pricePerTonWithoutGst', e.target.value)}
                          className="voucher-input"
                        />
                      </td>
                      <td>
                        <span className="gst-preview">₹{row.gstAmount.toLocaleString('en-IN')}</span>
                      </td>
                      <td>
                        <span className="total-preview font-bold">₹{row.totalPriceWithGst.toLocaleString('en-IN')}</span>
                      </td>
                      <td style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Brand name"
                          value={row.brandName}
                          onChange={(e) => handleVoucherRowChange(row.id, 'brandName', e.target.value)}
                          onFocus={() => setFocusedDropdown({ id: row.id, field: 'brandName' })}
                          onBlur={() => setFocusedDropdown(null)}
                          className="voucher-input"
                          autoComplete="off"
                        />
                        {focusedDropdown?.id === row.id && focusedDropdown?.field === 'brandName' && (
                          <div className={`custom-dropdown-menu ${idx > 0 ? 'open-upward' : ''}`}>
                            {getFilteredBrands(row.brandName).length > 0 ? (
                              getFilteredBrands(row.brandName).map(brand => (
                                <div
                                  key={brand}
                                  className="custom-dropdown-item"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectSuggestion(row.id, 'brandName', brand);
                                  }}
                                >
                                  {brand}
                                </div>
                              ))
                            ) : (
                              <div className="custom-dropdown-no-item">No brands found</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Vendor name"
                          value={row.vendorName}
                          onChange={(e) => handleVoucherRowChange(row.id, 'vendorName', e.target.value)}
                          onFocus={() => setFocusedDropdown({ id: row.id, field: 'vendorName' })}
                          onBlur={() => setFocusedDropdown(null)}
                          className="voucher-input"
                          autoComplete="off"
                        />
                        {focusedDropdown?.id === row.id && focusedDropdown?.field === 'vendorName' && (
                          <div className={`custom-dropdown-menu ${idx > 0 ? 'open-upward' : ''}`}>
                            {getFilteredVendors(row.vendorName).length > 0 ? (
                              getFilteredVendors(row.vendorName).map(vendor => (
                                <div
                                  key={vendor}
                                  className="custom-dropdown-item"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectSuggestion(row.id, 'vendorName', vendor);
                                  }}
                                >
                                  {vendor}
                                </div>
                              ))
                            ) : (
                              <div className="custom-dropdown-no-item">No vendors found</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="col-actions">
                        <button 
                          type="button" 
                          className="delete-row-btn"
                          onClick={() => handleDeleteVoucherRow(row.id)}
                          disabled={voucherRows.length === 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button type="submit" disabled={actionLoading} className="submit-inward-btn">
              {actionLoading ? 'Recording Voucher Entry...' : 'Submit Inward Voucher'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Scrap Sales Portal */}
      {activeTab === 'scrapsales' && (
        <div className="scrap-sales-portal">
          {/* Analytical summary cards */}
          <div className="scrap-analytics-row">
            <div className="card scrap-stat-panel">
              <div className="stat-info">
                <span className="stat-lbl">Total Scrap Weight Sold</span>
                <span className="stat-val">{totalScrapSoldWeight.toLocaleString()} <span className="unit-small">kg</span></span>
              </div>
              <div className="stat-icon-wrapper green"><TrendingDown size={20} /></div>
            </div>
            <div className="card scrap-stat-panel">
              <div className="stat-info">
                <span className="stat-lbl">Total Revenue Retrieved</span>
                <span className="stat-val text-green">₹{totalScrapRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="stat-icon-wrapper green"><Plus size={20} /></div>
            </div>
            <div className="card scrap-stat-panel">
              <div className="stat-info">
                <span className="stat-lbl">Lost Material Capital</span>
                <span className="stat-val text-red">₹{totalScrapLossDifferential.toLocaleString('en-IN')}</span>
              </div>
              <div className="stat-icon-wrapper red"><Trash2 size={20} /></div>
            </div>
          </div>

          <div className="scrap-portal-grid">
            {/* Log Sales form */}
            <div className="card scrap-form-card">
              <h3 className="form-card-title">Record Scrap Sale</h3>
              <p className="form-card-subtitle">Log transactions when scrap material is cleared and sold to buyers.</p>

              <form onSubmit={handleScrapSaleSubmit} className="scrap-sale-form">
                <div className="form-group">
                  <label>Transaction Date</label>
                  <input
                    type="date"
                    required
                    value={scrapSaleForm.date}
                    onChange={(e) => setScrapSaleForm(prev => ({ ...prev, date: e.target.value }))}
                    className="inward-input"
                  />
                </div>
                <div className="form-group">
                  <label>Scrap Buyer / Factory</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mittal Steel Scrap Buyers"
                    value={scrapSaleForm.buyer}
                    onChange={(e) => setScrapSaleForm(prev => ({ ...prev, buyer: e.target.value }))}
                    className="inward-input"
                  />
                </div>
                <div className="form-group">
                  <label>Weight Sold (Kgs)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500"
                    value={scrapSaleForm.weight}
                    onChange={(e) => setScrapSaleForm(prev => ({ ...prev, weight: e.target.value }))}
                    className="inward-input"
                  />
                </div>
                <div className="form-group">
                  <label>Selling Price per Kg (₹)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 22.5"
                    value={scrapSaleForm.pricePerKg}
                    onChange={(e) => setScrapSaleForm(prev => ({ ...prev, pricePerKg: e.target.value }))}
                    className="inward-input"
                  />
                </div>

                <button type="submit" className="submit-inward-btn">Record Scrap Transaction</button>
              </form>
            </div>

            {/* Sales ledger list */}
            <div className="card scrap-history-card">
              <h3 className="form-card-title">Scrap Sales History</h3>
              <p className="form-card-subtitle">Detailed ledger of scrap cleared from site.</p>

              <div className="table-responsive">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Buyer</th>
                      <th>Weight</th>
                      <th>Rate / Kg</th>
                      <th>Total Earned</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapSales.map((sale) => (
                      <tr key={sale.id}>
                        <td>{new Date(sale.date).toLocaleDateString('en-GB')}</td>
                        <td className="font-bold">{sale.buyer}</td>
                        <td>{sale.weight} kg</td>
                        <td>₹{sale.pricePerKg}</td>
                        <td className="font-bold text-green">₹{sale.revenue.toLocaleString('en-IN')}</td>
                        <td>
                          {confirmDeleteId === sale.id ? (
                            <div className="sale-delete-confirm">
                              <span className="delete-confirm-text">Delete?</span>
                              <button
                                className="confirm-delete-btn"
                                onClick={() => handleConfirmDelete(sale.id)}
                              >
                                Yes
                              </button>
                              <button
                                className="cancel-delete-btn"
                                onClick={handleCancelDelete}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="sale-action-btns">
                              <button
                                className="edit-sale-btn"
                                title="Edit this entry"
                                onClick={() => handleEditSale(sale)}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                className="delete-row-btn"
                                title="Delete this entry"
                                onClick={() => handleDeleteSale(sale.id)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Edit Modal */}
            {editingId !== null && (
              <div className="edit-modal-overlay" onClick={handleCancelEdit}>
                <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="edit-modal-header">
                    <h4 className="edit-modal-title"><Pencil size={15} /> Edit Scrap Sale Entry</h4>
                    <button className="edit-modal-close" onClick={handleCancelEdit}><X size={16} /></button>
                  </div>

                  <div className="edit-modal-body">
                    <div className="form-group">
                      <label>Transaction Date</label>
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => handleEditFormChange('date', e.target.value)}
                        className="inward-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Scrap Buyer / Factory</label>
                      <input
                        type="text"
                        placeholder="e.g. Mittal Steel Scrap Buyers"
                        value={editForm.buyer}
                        onChange={(e) => handleEditFormChange('buyer', e.target.value)}
                        className="inward-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Weight Sold (Kgs)</label>
                      <input
                        type="number"
                        placeholder="e.g. 500"
                        value={editForm.weight}
                        onChange={(e) => handleEditFormChange('weight', e.target.value)}
                        className="inward-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Selling Price per Kg (₹)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 22.5"
                        value={editForm.pricePerKg}
                        onChange={(e) => handleEditFormChange('pricePerKg', e.target.value)}
                        className="inward-input"
                      />
                    </div>

                    {editForm.weight && editForm.pricePerKg && (
                      <div className="edit-preview-total">
                        <span>Preview Total:</span>
                        <strong>₹{((parseFloat(editForm.weight) || 0) * (parseFloat(editForm.pricePerKg) || 0)).toLocaleString('en-IN')}</strong>
                      </div>
                    )}
                  </div>

                  <div className="edit-modal-footer">
                    <button className="edit-cancel-btn" onClick={handleCancelEdit}>
                      <X size={14} /> Cancel
                    </button>
                    <button className="edit-save-btn" onClick={handleSaveEdit}>
                      <Save size={14} /> Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
