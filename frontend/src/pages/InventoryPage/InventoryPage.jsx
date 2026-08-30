import { useState, useEffect, useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import { inventoryApi, batchesApi } from '../../utils/api'
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
  Save,
  Scale,
  Download,
  Search,
  Calendar,
  FileText,
  Layers,
  Scissors,
  Target,
  Calculator,
  Recycle,
  Wand2,
  RotateCcw
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner'
import './InventoryPage.css'

const STANDARD_DIAMETERS = [8, 10, 12, 16, 20, 25, 32]

const createDefaultVoucherRows = () => {
  return STANDARD_DIAMETERS.map((dia, idx) => ({
    id: Date.now() + idx,
    diameter: dia,
    weightInTons: '',
    pricePerTonWithoutGst: '',
    gstAmount: 0,
    totalPriceWithGst: 0,
    brandName: '',
    vendorName: ''
  }))
}

export default function InventoryPage() {
  const user = useSelector((state) => state.auth.user)
  // Tab states: 'list' | 'inward' | 'rules' | 'scrapsales' | 'batchscrap'
  const [activeTab, setActiveTab] = useState('list')
  const [inventory, setInventory] = useState({ standardStock: [], remnantsStock: [] })
  const [scrapRules, setScrapRules] = useState([])
  const [batchScrapRecords, setBatchScrapRecords] = useState([])
  const [scrapSearchQuery, setScrapSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Inward Multi-Diameter Voucher Form State (pre-populated with each standard diameter)
  const [voucherRows, setVoucherRows] = useState(createDefaultVoucherRows)

  // Scrap Sales Portal State
  const [scrapSales, setScrapSales] = useState([])
  const [ledgerHistory, setLedgerHistory] = useState([])

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
  const [editingRemnantId, setEditingRemnantId] = useState(null)
  const [editRemnantQty, setEditRemnantQty] = useState('')
  const [confirmDeleteRemnantId, setConfirmDeleteRemnantId] = useState(null)
  const [editingStockId, setEditingStockId] = useState(null)
  const [editStockQty, setEditStockQty] = useState('')
  const [focusedDropdown, setFocusedDropdown] = useState(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // Interactive filtering & sorting for Remnants & Standard Stock
  const [remnantFilterDia, setRemnantFilterDia] = useState('ALL')
  const [remnantSearch, setRemnantSearch] = useState('')
  const [remnantLengthCategory, setRemnantLengthCategory] = useState('ALL') // 'ALL' | 'SHORT' (<1m) | 'MEDIUM' (1-3m) | 'LONG' (>3m)
  const [remnantSortBy, setRemnantSortBy] = useState('length-asc') // 'length-asc' | 'length-desc' | 'qty-desc' | 'weight-desc'
  const [standardSearch, setStandardSearch] = useState('')
  const [standardFilterDia, setStandardFilterDia] = useState('ALL')

  // Load inventory and rules on mount
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      setError('')
      const [invData, rulesData, salesData, scrapRecordsData, ledgerData] = await Promise.all([
        inventoryApi.getInventory(),
        inventoryApi.getScrapRules(),
        inventoryApi.getScrapSales(),
        batchesApi.getScrapRecords().catch(() => []),
        inventoryApi.getLedger().catch(() => [])
      ])
      setInventory(invData)
      setScrapRules(rulesData)
      setScrapSales(salesData)
      setBatchScrapRecords(scrapRecordsData || [])
      setLedgerHistory(ledgerData || [])
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

  // Diawise and total summary calculations for Standard Bar Stock
  const standardDiaSummary = useMemo(() => {
    const summary = {}
    let grandTotalWeight = 0
    let grandTotalQty = 0

    ;(inventory.standardStock || []).forEach((item) => {
      const dia = Number(item.diameter)
      if (!summary[dia]) {
        summary[dia] = { diameter: dia, totalWeight: 0, totalQty: 0 }
      }
      summary[dia].totalWeight += Number(item.weightInKgs) || 0
      summary[dia].totalQty += Number(item.quantity) || 0
      grandTotalWeight += Number(item.weightInKgs) || 0
      grandTotalQty += Number(item.quantity) || 0
    })

    const standardDias = [8, 10, 12, 16, 20, 25, 32]
    const presentDias = Object.keys(summary).map(Number)
    const allDias = Array.from(new Set([...standardDias, ...presentDias])).sort((a, b) => a - b)

    const items = allDias.map((dia) => ({
      diameter: dia,
      totalWeight: summary[dia]?.totalWeight || 0,
      totalQty: summary[dia]?.totalQty || 0,
      hasStock: !!summary[dia] && summary[dia].totalQty > 0
    }))

    const inStockCount = items.filter((i) => i.hasStock).length

    return { items, grandTotalWeight, grandTotalQty, inStockCount }
  }, [inventory.standardStock])

  // Diawise and total summary calculations for Reusable Remnants Stock
  const remnantsDiaSummary = useMemo(() => {
    const summary = {}
    let grandTotalWeight = 0
    let grandTotalQty = 0

    ;(inventory.remnantsStock || []).forEach((item) => {
      const dia = Number(item.diameter)
      if (!summary[dia]) {
        summary[dia] = { diameter: dia, totalWeight: 0, totalQty: 0 }
      }
      summary[dia].totalWeight += Number(item.weightInKgs) || 0
      summary[dia].totalQty += Number(item.quantity) || 0
      grandTotalWeight += Number(item.weightInKgs) || 0
      grandTotalQty += Number(item.quantity) || 0
    })

    const standardDias = [8, 10, 12, 16, 20, 25, 32]
    const presentDias = Object.keys(summary).map(Number)
    const allDias = Array.from(new Set([...standardDias, ...presentDias])).sort((a, b) => a - b)

    const items = allDias.map((dia) => ({
      diameter: dia,
      totalWeight: summary[dia]?.totalWeight || 0,
      totalQty: summary[dia]?.totalQty || 0,
      hasStock: !!summary[dia] && summary[dia].totalQty > 0
    }))

    const inStockCount = items.filter((i) => i.hasStock).length

    return { items, grandTotalWeight, grandTotalQty, inStockCount }
  }, [inventory.remnantsStock])

  // Overall Inventory KPI Metrics
  const totalYardWeight = useMemo(() => {
    return standardDiaSummary.grandTotalWeight + remnantsDiaSummary.grandTotalWeight
  }, [standardDiaSummary, remnantsDiaSummary])

  const totalYardValuation = useMemo(() => {
    const stdCost = (inventory.standardStock || []).reduce((sum, item) => sum + ((item.weightInKgs || 0) * (item.costPerKg || 60)), 0)
    const remCost = remnantsDiaSummary.grandTotalWeight * 55
    return stdCost + remCost
  }, [inventory.standardStock, remnantsDiaSummary])

  const remnantWeightPct = totalYardWeight > 0 ? ((remnantsDiaSummary.grandTotalWeight / totalYardWeight) * 100).toFixed(1) : 0

  // Filtered Standard Stock
  const filteredStandardStock = useMemo(() => {
    let list = inventory.standardStock || []
    if (standardFilterDia !== 'ALL') {
      list = list.filter(s => Number(s.diameter) === Number(standardFilterDia))
    }
    if (standardSearch.trim()) {
      const q = standardSearch.toLowerCase().trim()
      list = list.filter(s =>
        `${s.diameter}mm ${s.brandName || ''} ${s.vendorName || ''}`.toLowerCase().includes(q)
      )
    }
    return list
  }, [inventory.standardStock, standardFilterDia, standardSearch])

  // Filtered & Sorted Remnants Stock
  const filteredRemnants = useMemo(() => {
    let list = inventory.remnantsStock || []
    if (remnantFilterDia !== 'ALL') {
      list = list.filter(r => Number(r.diameter) === Number(remnantFilterDia))
    }
    if (remnantLengthCategory === 'SHORT') {
      list = list.filter(r => Number(r.length) < 1000)
    } else if (remnantLengthCategory === 'MEDIUM') {
      list = list.filter(r => Number(r.length) >= 1000 && Number(r.length) <= 3000)
    } else if (remnantLengthCategory === 'LONG') {
      list = list.filter(r => Number(r.length) > 3000)
    }
    if (remnantSearch.trim()) {
      const q = remnantSearch.toLowerCase().trim()
      list = list.filter(r => 
        `${r.diameter}mm ${r.length} ${r.brandName || ''} ${r.vendorName || ''}`.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (remnantSortBy === 'length-asc') return Number(a.length) - Number(b.length)
      if (remnantSortBy === 'length-desc') return Number(b.length) - Number(a.length)
      if (remnantSortBy === 'qty-desc') return (Number(b.quantity) || 0) - (Number(a.quantity) || 0)
      if (remnantSortBy === 'weight-desc') return (Number(b.weightInKgs) || 0) - (Number(a.weightInKgs) || 0)
      return 0
    })
  }, [inventory.remnantsStock, remnantFilterDia, remnantLengthCategory, remnantSearch, remnantSortBy])

  // Smart Remnant Clearance & Cut Matcher State
  const [showRemnantMatcher, setShowRemnantMatcher] = useState(false)
  const [matcherDia, setMatcherDia] = useState(8)
  const [matcherTargetLength, setMatcherTargetLength] = useState(300)
  const [matcherTargetQty, setMatcherTargetQty] = useState('')

  // Dynamic Remnant Clearance & Links Calculation
  const remnantMatchAnalysis = useMemo(() => {
    const targetL = Number(matcherTargetLength) || 0
    const targetDia = Number(matcherDia) || 8
    const reqQty = matcherTargetQty ? Number(matcherTargetQty) : null

    if (targetL <= 0) return { items: [], totalPieces: 0, totalRemnantsUsed: 0, totalWeightCleared: 0, totalScrapWeight: 0, avgYield: 0 }

    const matchingRemnants = (inventory.remnantsStock || [])
      .filter(r => (targetDia === 0 || Number(r.diameter) === targetDia) && Number(r.length) >= targetL)
      .sort((a, b) => Number(a.length) - Number(b.length))

    let accumulatedPieces = 0
    let totalRemnantsUsed = 0
    let totalLengthCleared = 0
    let totalUsableLength = 0
    let totalScrapLength = 0
    let totalWeightCleared = 0
    let totalScrapWeight = 0

    const matchedItems = []

    for (const rem of matchingRemnants) {
      if (reqQty !== null && accumulatedPieces >= reqQty) break

      const len = Number(rem.length)
      const dia = Number(rem.diameter)
      const availQty = Number(rem.quantity) || 1
      const pcsPerBar = Math.floor(len / targetL)
      if (pcsPerBar <= 0) continue

      let barsToUse = availQty
      if (reqQty !== null) {
        const remainingNeeded = reqQty - accumulatedPieces
        barsToUse = Math.min(availQty, Math.ceil(remainingNeeded / pcsPerBar))
      }

      const extractedPcs = barsToUse * pcsPerBar
      const usedL = extractedPcs * targetL
      const barScrap = len - (pcsPerBar * targetL)
      const totScrap = barScrap * barsToUse
      const barYield = ((pcsPerBar * targetL) / len) * 100
      const barWeight = ((len * barsToUse) / 1000) * ((dia * dia) / 162)
      const scrapWt = (totScrap / 1000) * ((dia * dia) / 162)

      accumulatedPieces += extractedPcs
      totalRemnantsUsed += barsToUse
      totalLengthCleared += len * barsToUse
      totalUsableLength += usedL
      totalScrapLength += totScrap
      totalWeightCleared += barWeight
      totalScrapWeight += scrapWt

      matchedItems.push({
        id: rem._id,
        diameter: dia,
        remnantLength: len,
        availableQty: availQty,
        barsUsed: barsToUse,
        pcsPerBar,
        extractedPieces: extractedPcs,
        scrapPerBar: barScrap,
        totalScrap: totScrap,
        barYield,
        weightCleared: barWeight,
        scrapWeight: scrapWt,
        brandName: rem.brandName || '',
        vendorName: rem.vendorName || ''
      })
    }

    const avgYield = totalLengthCleared > 0 ? (totalUsableLength / totalLengthCleared) * 100 : 0

    return {
      items: matchedItems,
      totalPieces: accumulatedPieces,
      totalRemnantsUsed,
      totalWeightCleared,
      totalScrapWeight,
      avgYield
    }
  }, [inventory.remnantsStock, matcherDia, matcherTargetLength, matcherTargetQty])

  // Multi-Diameter Voucher handlers
  const handleAddVoucherRow = () => {
    setVoucherRows(prev => [
      ...prev,
      { id: Date.now(), diameter: 8, weightInTons: '', pricePerTonWithoutGst: '', gstAmount: 0, totalPriceWithGst: 0, brandName: '', vendorName: '' }
    ])
  }

  const handleResetAllDiameters = () => {
    setVoucherRows(createDefaultVoucherRows())
  }

  const handleApplyBrandVendorToAll = () => {
    const firstWithBrand = voucherRows.find(r => r.brandName?.trim())?.brandName || '';
    const firstWithVendor = voucherRows.find(r => r.vendorName?.trim())?.vendorName || '';
    if (!firstWithBrand && !firstWithVendor) return;
    setVoucherRows(prev => prev.map(r => ({
      ...r,
      brandName: r.brandName?.trim() ? r.brandName : firstWithBrand,
      vendorName: r.vendorName?.trim() ? r.vendorName : firstWithVendor
    })));
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
      // Filter only rows that have weight or price entered
      const filledRows = voucherRows.filter(row => {
        const tons = parseFloat(row.weightInTons) || 0;
        const price = parseFloat(row.pricePerTonWithoutGst) || 0;
        return tons > 0 || price > 0 || (row.brandName && row.brandName.trim() !== '') || (row.vendorName && row.vendorName.trim() !== '');
      });

      if (filledRows.length === 0) {
        throw new Error('Please enter Weight (Tons) and Price/Ton for at least one diameter.')
      }

      for (const row of filledRows) {
        const tons = parseFloat(row.weightInTons) || 0
        const price = parseFloat(row.pricePerTonWithoutGst) || 0
        if (tons <= 0 || price <= 0) {
          throw new Error(`Please provide both valid Weight and Price for diameter ${row.diameter} mm.`)
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

      // Persist newly submitted brands and vendors to company-specific localStorage for future instant suggestions
      try {
        const companyKey = user?.companyId ? String(user.companyId) : (user?.companyName ? String(user.companyName) : 'default_company');
        const newBrands = filledRows.map(r => r.brandName?.trim()).filter(Boolean);
        const newVendors = filledRows.map(r => r.vendorName?.trim()).filter(Boolean);
        if (newBrands.length > 0) {
          const storedB = JSON.parse(localStorage.getItem(`rebar_recent_brands_${companyKey}`) || '[]');
          localStorage.setItem(`rebar_recent_brands_${companyKey}`, JSON.stringify(Array.from(new Set([...newBrands, ...storedB])).slice(0, 50)));
        }
        if (newVendors.length > 0) {
          const storedV = JSON.parse(localStorage.getItem(`rebar_recent_vendors_${companyKey}`) || '[]');
          localStorage.setItem(`rebar_recent_vendors_${companyKey}`, JSON.stringify(Array.from(new Set([...newVendors, ...storedV])).slice(0, 50)));
        }
        // Clean up legacy unscoped keys
        localStorage.removeItem('rebar_recent_brands');
        localStorage.removeItem('rebar_recent_vendors');
      } catch (e) {
        console.error('Failed to save recent suggestions', e);
      }

      setSuccess(`Voucher inward entry recorded successfully for ${filledRows.length} diameter${filledRows.length > 1 ? 's' : ''}!`)
      setVoucherRows(createDefaultVoucherRows())
      
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
      updated[idx] = {
        ...updated[idx],
        scrapLengthThreshold: value === '' ? '' : value
      }
      return updated
    })
  }

  const handleSaveRules = async () => {
    setError('')
    setSuccess('')
    setActionLoading(true)
    try {
      const sanitizedRules = scrapRules.map(r => ({
        ...r,
        scrapLengthThreshold: r.scrapLengthThreshold === '' || isNaN(Number(r.scrapLengthThreshold))
          ? 1000 
          : Math.max(100, Math.min(12000, Number(r.scrapLengthThreshold)))
      }))
      const updatedRules = await inventoryApi.updateScrapRules(sanitizedRules)
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

  const handleEditStock = (item) => {
    setEditingStockId(item._id)
    setEditStockQty(item.quantity)
  }

  const handleCancelStockEdit = () => {
    setEditingStockId(null)
    setEditStockQty('')
  }

  const handleSaveStockEdit = async (id) => {
    setError('')
    setSuccess('')
    const newQty = parseInt(editStockQty)
    if (isNaN(newQty) || newQty < 0) {
      setError('Quantity must be a non-negative number.')
      return
    }

    try {
      setActionLoading(true)
      const result = await inventoryApi.updateStockItem(id, newQty)
      
      setInventory(prev => {
        if (newQty === 0 || result.deleted) {
          return {
            ...prev,
            standardStock: prev.standardStock.filter(item => item._id !== id)
          }
        }
        return {
          ...prev,
          standardStock: prev.standardStock.map(item => 
            item._id === id ? { ...item, quantity: result.quantity, weightInKgs: result.weightInKgs } : item
          )
        }
      })

      setEditingStockId(null)
      setEditStockQty('')
      setSuccess('Stock updated successfully.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.message || 'Failed to update stock.')
    } finally {
      setActionLoading(false)
    }
  }

  // Remnants Delete and Edit handlers
  const handleDeleteRemnant = (id) => {
    setConfirmDeleteRemnantId(id)
  }

  const handleConfirmDeleteRemnant = async (id) => {
    setError('')
    try {
      await inventoryApi.deleteStockItem(id)
      setInventory(prev => ({
        ...prev,
        remnantsStock: prev.remnantsStock.filter(item => item._id !== id)
      }))
      setConfirmDeleteRemnantId(null)
      setSuccess('Remnant stock entry deleted.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.message || 'Failed to delete remnant stock entry.')
    }
  }

  const handleCancelDeleteRemnant = () => {
    setConfirmDeleteRemnantId(null)
  }

  const handleEditRemnant = (item) => {
    setEditingRemnantId(item._id)
    setEditRemnantQty(item.quantity)
  }

  const handleCancelRemnantEdit = () => {
    setEditingRemnantId(null)
    setEditRemnantQty('')
  }

  const handleSaveRemnantEdit = async (id) => {
    setError('')
    setSuccess('')
    const newQty = parseInt(editRemnantQty)
    if (isNaN(newQty) || newQty < 0) {
      setError('Quantity must be a non-negative number.')
      return
    }

    try {
      setActionLoading(true)
      const result = await inventoryApi.updateStockItem(id, newQty)
      
      setInventory(prev => {
        if (newQty === 0 || result.deleted) {
          return {
            ...prev,
            remnantsStock: prev.remnantsStock.filter(item => item._id !== id)
          }
        }
        return {
          ...prev,
          remnantsStock: prev.remnantsStock.map(item => 
            item._id === id ? { ...item, quantity: result.quantity, weightInKgs: result.weightInKgs } : item
          )
        }
      })

      setEditingRemnantId(null)
      setEditRemnantQty('')
      setSuccess('Remnant stock updated successfully.')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.message || 'Failed to update remnant stock.')
    } finally {
      setActionLoading(false)
    }
  }

  // Scrap sales portal submission
  const handleScrapSaleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const weight = parseFloat(scrapSaleForm.weight) || 0
    const price = parseFloat(scrapSaleForm.pricePerKg) || 0
    if (weight <= 0 || price <= 0 || !scrapSaleForm.buyer.trim()) return

    try {
      setActionLoading(true)
      const newSale = await inventoryApi.createScrapSale({
        date: scrapSaleForm.date,
        buyer: scrapSaleForm.buyer,
        weight,
        pricePerKg: price
      })
      setScrapSales(prev => [newSale, ...prev])
      setSuccess('Scrap sale recorded successfully!')
      setScrapSaleForm({
        date: new Date().toISOString().split('T')[0],
        buyer: '',
        weight: '',
        pricePerKg: ''
      })
      setTimeout(() => setSuccess(''), 1500)
    } catch (err) {
      setError(err.message || 'Failed to record scrap transaction.')
    } finally {
      setActionLoading(false)
    }
  }

  // Edit Scrap Sale handlers
  const handleEditSale = (sale) => {
    setEditingId(sale._id)
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

  const handleSaveEdit = async () => {
    setError('')
    setSuccess('')
    const weight = parseFloat(editForm.weight) || 0
    const price = parseFloat(editForm.pricePerKg) || 0
    if (weight <= 0 || price <= 0 || !editForm.buyer.trim()) {
      setError('Please fill in all fields with valid values.')
      return
    }

    try {
      setActionLoading(true)
      const updated = await inventoryApi.updateScrapSale(editingId, {
        date: editForm.date,
        buyer: editForm.buyer,
        weight,
        pricePerKg: price
      })
      setScrapSales(prev => prev.map(s => s._id === editingId ? updated : s))
      setEditingId(null)
      setSuccess('Scrap sale entry updated successfully!')
      setTimeout(() => setSuccess(''), 1500)
    } catch (err) {
      setError(err.message || 'Failed to update scrap sale.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setError('')
  }

  const handleDeleteSale = (id) => {
    setConfirmDeleteId(id)
  }

  const handleConfirmDelete = async (id) => {
    setError('')
    try {
      await inventoryApi.deleteScrapSale(id)
      setScrapSales(prev => prev.filter(s => s._id !== id))
      setConfirmDeleteId(null)
      setSuccess('Scrap sale entry deleted.')
      setTimeout(() => setSuccess(''), 1500)
    } catch (err) {
      setError(err.message || 'Failed to delete scrap sale.')
    }
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

  // Company-Scoped Brand suggestions from company ledger history, active stock, and company localStorage
  const uniqueBrands = useMemo(() => {
    const companyKey = user?.companyId ? String(user.companyId) : (user?.companyName ? String(user.companyName) : 'default_company');
    let fromStorage = [];
    try {
      fromStorage = JSON.parse(localStorage.getItem(`rebar_recent_brands_${companyKey}`) || '[]');
    } catch {
      fromStorage = [];
    }

    const fromLedger = (ledgerHistory || []).map(item => item.brandName);
    const fromStock = (inventory.standardStock || []).map(item => item.brandName);
    const fromRemnants = (inventory.remnantsStock || []).map(item => item.brandName);
    const fromCurrentVoucher = (voucherRows || []).map(row => row.brandName);

    const combined = [
      ...fromStorage,
      ...fromLedger,
      ...fromStock,
      ...fromRemnants,
      ...fromCurrentVoucher
    ];

    return Array.from(new Set(combined.map(b => (b ? b.trim() : '')).filter(Boolean)));
  }, [inventory, ledgerHistory, voucherRows, user?.companyId, user?.companyName]);

  // Company-Scoped Vendor suggestions from company ledger history, active stock, and company localStorage
  const uniqueVendors = useMemo(() => {
    const companyKey = user?.companyId ? String(user.companyId) : (user?.companyName ? String(user.companyName) : 'default_company');
    let fromStorage = [];
    try {
      fromStorage = JSON.parse(localStorage.getItem(`rebar_recent_vendors_${companyKey}`) || '[]');
    } catch {
      fromStorage = [];
    }

    const fromLedger = (ledgerHistory || []).map(item => item.vendorName);
    const fromStock = (inventory.standardStock || []).map(item => item.vendorName);
    const fromRemnants = (inventory.remnantsStock || []).map(item => item.vendorName);
    const fromCurrentVoucher = (voucherRows || []).map(row => row.vendorName);

    const combined = [
      ...fromStorage,
      ...fromLedger,
      ...fromStock,
      ...fromRemnants,
      ...fromCurrentVoucher
    ];

    return Array.from(new Set(combined.map(v => (v ? v.trim() : '')).filter(Boolean)));
  }, [inventory, ledgerHistory, voucherRows, user?.companyId, user?.companyName]);

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

  const blurTimeoutRef = useRef(null);

  const openDropdown = (rowId, field) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setFocusedDropdown({ id: rowId, field });
    setHighlightedIndex(-1);
  };

  const closeDropdownDelayed = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      setFocusedDropdown(null);
      setHighlightedIndex(-1);
    }, 250);
  };

  const scrollDropdownItemIntoView = () => {
    setTimeout(() => {
      const activeItem = document.querySelector('.custom-dropdown-item.is-highlighted');
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  };

  const handleDropdownKeyDown = (e, rowId, field, suggestions) => {
    if (!focusedDropdown || focusedDropdown.id !== rowId || focusedDropdown.field !== field) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        openDropdown(rowId, field);
        setHighlightedIndex(0);
        scrollDropdownItemIntoView();
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setHighlightedIndex((prev) => {
        const next = prev < suggestions.length - 1 ? prev + 1 : 0;
        scrollDropdownItemIntoView();
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : suggestions.length - 1;
        scrollDropdownItemIntoView();
        return next;
      });
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(rowId, field, suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      setFocusedDropdown(null);
      setHighlightedIndex(-1);
    }
  };

  const handleSelectSuggestion = (rowId, field, value) => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    handleVoucherRowChange(rowId, field, value);
    setFocusedDropdown(null);
    setHighlightedIndex(-1);
  };

  return (
    <div className="inventory-page">
      <div className="inventory-header-row">
        <div>
          <h1 className="inventory-title">Inventory Stock</h1>
          <p className="inventory-subtitle">Manage standard rebar stock, voucher entries, batch scrap history, and scrap sales.</p>
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
            className={`tab-btn ${activeTab === 'batchscrap' ? 'active' : ''}`}
            onClick={() => setActiveTab('batchscrap')}
          >
            <Scale size={16} /> Batch Scrap Records
          </button>
          <button 
            className={`tab-btn ${activeTab === 'scrapsales' ? 'active' : ''}`}
            onClick={() => setActiveTab('scrapsales')}
          >
            <DollarSign size={16} /> Scrap Sales
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
          {/* Executive Hero KPI Cards */}
          <div className="inventory-hero-grid">
            <div className="card hero-stat-card primary">
              <div className="hero-stat-content">
                <span className="hero-stat-label">Total Available Yard Stock</span>
                <div className="hero-stat-main">
                  <span className="hero-stat-number">{(totalYardWeight / 1000).toFixed(2)}</span>
                  <span className="hero-stat-unit">MT</span>
                </div>
                <span className="hero-stat-sub">
                  {Math.round(totalYardWeight).toLocaleString('en-IN')} kg • {remnantWeightPct}% Remnants
                </span>
              </div>
              <div className="hero-stat-icon bg-emerald">
                <Package size={22} />
              </div>
            </div>

            <div className="card hero-stat-card">
              <div className="hero-stat-content">
                <span className="hero-stat-label">Prime Standard Bars (12m)</span>
                <div className="hero-stat-main">
                  <span className="hero-stat-number">{(standardDiaSummary.grandTotalWeight / 1000).toFixed(2)}</span>
                  <span className="hero-stat-unit">MT</span>
                </div>
                <span className="hero-stat-sub">
                  {standardDiaSummary.grandTotalQty.toLocaleString('en-IN')} full length bars in stock
                </span>
              </div>
              <div className="hero-stat-icon bg-blue">
                <Layers size={22} />
              </div>
            </div>

            <div className="card hero-stat-card">
              <div className="hero-stat-content">
                <span className="hero-stat-label">Reusable Remnants Yield</span>
                <div className="hero-stat-main">
                  <span className="hero-stat-number">{(remnantsDiaSummary.grandTotalWeight / 1000).toFixed(2)}</span>
                  <span className="hero-stat-unit">MT</span>
                </div>
                <span className="hero-stat-sub text-emerald">
                  {remnantsDiaSummary.grandTotalQty.toLocaleString('en-IN')} offcut pieces saved
                </span>
              </div>
              <div className="hero-stat-icon bg-cyan">
                <Sparkles size={22} />
              </div>
            </div>

            <div className="card hero-stat-card">
              <div className="hero-stat-content">
                <span className="hero-stat-label">Estimated Inventory Asset Value</span>
                <div className="hero-stat-main">
                  <span className="hero-stat-number">₹{Math.round(totalYardValuation).toLocaleString('en-IN')}</span>
                </div>
                <span className="hero-stat-sub">
                  Live procurement valuation
                </span>
              </div>
              <div className="hero-stat-icon bg-purple">
                <DollarSign size={22} />
              </div>
            </div>
          </div>

          {/* Standard Stock Section */}
          <section className="card stock-section">
            <div className="section-header-row">
              <div className="section-title-group">
                <h3 className="section-title">
                  <Package size={18} className="text-blue" style={{ marginRight: '8px' }} /> Standard Bar Stock (12.0m Prime)
                </h3>
                <span className="section-badge-pill">
                  {standardDiaSummary.inStockCount} Diameters Available
                </span>
              </div>

              <div className="section-header-stats">
                <div className="search-box standard-search-box">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search brand, vendor, dia..."
                    value={standardSearch}
                    onChange={(e) => setStandardSearch(e.target.value)}
                    className="search-input"
                  />
                  {standardSearch && (
                    <button className="search-clear-btn" onClick={() => setStandardSearch('')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
                <button
                  className="btn-quick-inward"
                  onClick={() => setActiveTab('inward')}
                  title="Record new inward delivery"
                >
                  <Plus size={14} /> Add Inward
                </button>
              </div>
            </div>

            {/* Diawise Summary Cards for Standard Stock */}
            <div className="dia-summary-container">
              <div className="dia-cards-grid">
                {standardDiaSummary.items.map((item) => (
                  <div
                    key={item.diameter}
                    className={`dia-stat-card ${item.hasStock ? 'has-stock' : 'no-stock'} ${standardFilterDia === String(item.diameter) ? 'active-filter' : ''}`}
                    onClick={() => setStandardFilterDia(prev => prev === String(item.diameter) ? 'ALL' : String(item.diameter))}
                    title={`Click to filter Ø ${item.diameter} mm`}
                  >
                    <div className="dia-card-top">
                      <span className="dia-badge standard-dia-badge">Ø {item.diameter} mm</span>
                      <span className="dia-qty-label">
                        {item.hasStock ? `${item.totalQty} bars` : '0 bars'}
                      </span>
                    </div>
                    <div className="dia-card-main">
                      <span className="dia-weight-number">
                        {Math.round(item.totalWeight).toLocaleString()}
                      </span>
                      <span className="dia-weight-unit">kg</span>
                    </div>
                    {item.totalWeight >= 1000 ? (
                      <div className="dia-ton-label">{(item.totalWeight / 1000).toFixed(2)} MT</div>
                    ) : (
                      <div className="dia-ton-label muted">{item.hasStock ? 'In Stock' : 'Out of Stock'}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {filteredStandardStock.length === 0 ? (
              <div className="empty-stock-state">
                <p>No standard stock items found matching your filters. Add stock using Voucher Inward.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th style={{ width: '110px' }}>Diameter</th>
                      <th style={{ width: '100px' }}>Length</th>
                      <th style={{ width: '110px' }}>Qty (Bars)</th>
                      <th style={{ width: '130px' }}>Total Weight</th>
                      <th style={{ width: '130px' }}>Cost / kg (w/ GST)</th>
                      <th>Brand</th>
                      <th>Vendor</th>
                      <th style={{ width: '120px' }}>Inward Date</th>
                      <th style={{ width: '90px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStandardStock.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <span className="dia-pill-badge dia-pill-standard">Ø {item.diameter} mm</span>
                        </td>
                        <td>
                          <span className="length-badge">{(item.length / 1000).toFixed(1)} m</span>
                        </td>
                        <td className="font-bold">
                          {editingStockId === item._id ? (
                            <input
                              type="number"
                              min="0"
                              value={editStockQty}
                              onChange={(e) => setEditStockQty(e.target.value)}
                              className="inline-qty-input"
                            />
                          ) : (
                            <span className="qty-highlight">{item.quantity.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="font-bold text-emerald">
                          {Math.round(item.weightInKgs).toLocaleString('en-IN')} kg
                        </td>
                        <td>₹{item.costPerKg?.toFixed(2) || '0.00'}</td>
                        <td>
                          <span className="brand-tag">{item.brandName || '—'}</span>
                        </td>
                        <td>
                          <span className="vendor-tag">{item.vendorName || '—'}</span>
                        </td>
                        <td>
                          <span className="date-tag">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                          </span>
                        </td>
                        <td>
                          {editingStockId === item._id ? (
                            <div className="sale-action-btns">
                              <button
                                className="edit-sale-btn"
                                title="Save changes"
                                onClick={() => handleSaveStockEdit(item._id)}
                                style={{ color: '#10b981' }}
                              >
                                <Save size={14} />
                              </button>
                              <button
                                className="delete-row-btn"
                                title="Cancel edit"
                                onClick={handleCancelStockEdit}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : confirmDeleteStockId === item._id ? (
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
                            <div className="sale-action-btns">
                              <button
                                className="edit-sale-btn"
                                title="Edit quantity"
                                onClick={() => handleEditStock(item)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="delete-row-btn"
                                title="Delete this stock entry"
                                onClick={() => handleDeleteStockItem(item._id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
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
            <div className="section-header-row">
              <div className="section-title-group">
                <h3 className="section-title">
                  <Sparkles size={18} className="text-cyan" style={{ marginRight: '8px' }} /> Reusable Remnants Stock
                </h3>
                <span className="section-badge-pill remnant">
                  {remnantsDiaSummary.grandTotalQty.toLocaleString('en-IN')} Offcuts ({Math.round(remnantsDiaSummary.grandTotalWeight).toLocaleString('en-IN')} kg)
                </span>
              </div>

              <div className="section-header-stats">
                <button
                  className={`btn-matcher-toggle ${showRemnantMatcher ? 'active' : ''}`}
                  onClick={() => setShowRemnantMatcher(!showRemnantMatcher)}
                  title="Match remnant stock with target cut lengths"
                >
                  <Recycle size={15} /> Remnant Clearance Matcher
                </button>
              </div>
            </div>

            {/* Smart Remnant Clearance Matcher Panel */}
            {showRemnantMatcher && (
              <div className="remnant-matcher-panel">
                <div className="matcher-header">
                  <div className="matcher-header-title">
                    <Recycle size={20} className="text-emerald" />
                    <div>
                      <h4>Smart Remnant Clearance & Takeout Matcher</h4>
                      <p>Enter required cut length to discover total possible pieces extractable from current remnant offcuts.</p>
                    </div>
                  </div>
                  <button className="matcher-close-btn" onClick={() => setShowRemnantMatcher(false)}>
                    <X size={16} />
                  </button>
                </div>

                <div className="matcher-controls-row">
                  <div className="matcher-input-group">
                    <label>Target Diameter</label>
                    <select
                      value={matcherDia}
                      onChange={(e) => setMatcherDia(Number(e.target.value))}
                      className="matcher-select"
                    >
                      <option value={0}>All Diameters</option>
                      {[8, 10, 12, 16, 20, 25, 32].map(d => (
                        <option key={d} value={d}>{d} mm</option>
                      ))}
                    </select>
                  </div>

                  <div className="matcher-input-group flex-2">
                    <label>Required Cut Length (mm)</label>
                    <div className="input-with-presets">
                      <input
                        type="number"
                        min="50"
                        step="10"
                        value={matcherTargetLength}
                        onChange={(e) => setMatcherTargetLength(e.target.value)}
                        placeholder="e.g. 300"
                        className="matcher-input"
                      />
                      <div className="quick-presets-chips">
                        <button type="button" className={`preset-chip ${Number(matcherTargetLength) === 300 ? 'active' : ''}`} onClick={() => setMatcherTargetLength(300)}>300 mm</button>
                        <button type="button" className={`preset-chip ${Number(matcherTargetLength) === 450 ? 'active' : ''}`} onClick={() => setMatcherTargetLength(450)}>450 mm</button>
                        <button type="button" className={`preset-chip ${Number(matcherTargetLength) === 600 ? 'active' : ''}`} onClick={() => setMatcherTargetLength(600)}>600 mm</button>
                        <button type="button" className={`preset-chip ${Number(matcherTargetLength) === 800 ? 'active' : ''}`} onClick={() => setMatcherTargetLength(800)}>800 mm</button>
                        <button type="button" className={`preset-chip ${Number(matcherTargetLength) === 1000 ? 'active' : ''}`} onClick={() => setMatcherTargetLength(1000)}>1,000 mm</button>
                      </div>
                    </div>
                  </div>

                  <div className="matcher-input-group">
                    <label>Target Qty Needed (Optional)</label>
                    <input
                      type="number"
                      min="1"
                      value={matcherTargetQty}
                      onChange={(e) => setMatcherTargetQty(e.target.value)}
                      placeholder="Max Possible"
                      className="matcher-input"
                    />
                  </div>
                </div>

                {/* KPI Summary Tiles */}
                <div className="matcher-results-grid">
                  <div className="matcher-kpi-card highlight-green">
                    <span className="kpi-lbl">Total Extractable Pieces</span>
                    <span className="kpi-val">{remnantMatchAnalysis.totalPieces.toLocaleString()} <span className="kpi-unit">pieces</span></span>
                    <span className="kpi-sub">@ {matcherTargetLength} mm cut length</span>
                  </div>

                  <div className="matcher-kpi-card highlight-blue">
                    <span className="kpi-lbl">Steel Cleared from Yard</span>
                    <span className="kpi-val">{Math.round(remnantMatchAnalysis.totalWeightCleared).toLocaleString()} <span className="kpi-unit">kg</span></span>
                    <span className="kpi-sub">{remnantMatchAnalysis.totalRemnantsUsed} remnant bars consumed</span>
                  </div>

                  <div className="matcher-kpi-card highlight-purple">
                    <span className="kpi-lbl">Clearance Yield</span>
                    <span className="kpi-val">{remnantMatchAnalysis.avgYield.toFixed(1)}%</span>
                    <span className="kpi-sub">Utilization efficiency</span>
                  </div>

                  <div className="matcher-kpi-card highlight-orange">
                    <span className="kpi-lbl">Leftover Scrap</span>
                    <span className="kpi-val">{Math.round(remnantMatchAnalysis.totalScrapWeight).toLocaleString()} <span className="kpi-unit">kg</span></span>
                    <span className="kpi-sub">Offcut remainder</span>
                  </div>
                </div>

                {/* Match Breakdown Schedule Table */}
                {remnantMatchAnalysis.items.length > 0 ? (
                  <div className="matcher-schedule-container">
                    <h5 className="schedule-heading">
                      <Scissors size={14} /> Recommended Remnant Takeout & Cutting Schedule
                    </h5>
                    <div className="table-responsive">
                      <table className="matcher-table">
                        <thead>
                          <tr>
                            <th>Diameter</th>
                            <th>Remnant Length</th>
                            <th>Available</th>
                            <th>Bars to Use</th>
                            <th>Yield / Bar</th>
                            <th>Total Pieces</th>
                            <th>Scrap / Bar</th>
                            <th>Yield %</th>
                            <th>Weight Cleared</th>
                          </tr>
                        </thead>
                        <tbody>
                          {remnantMatchAnalysis.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="font-bold">Ø {item.diameter} mm</td>
                              <td className="font-bold">{item.remnantLength.toLocaleString()} mm</td>
                              <td>{item.availableQty} bars</td>
                              <td className="font-bold text-emerald">{item.barsUsed} bars</td>
                              <td className="font-bold">{item.pcsPerBar} pcs</td>
                              <td className="font-bold text-emerald">+{item.extractedPieces} pcs</td>
                              <td className="text-secondary">{item.scrapPerBar} mm</td>
                              <td>
                                <span className={`yield-pill ${item.barYield >= 90 ? 'high' : 'med'}`}>
                                  {item.barYield.toFixed(1)}%
                                </span>
                              </td>
                              <td className="font-bold">{item.weightCleared.toFixed(1)} kg</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="matcher-empty-state">
                    <p>No remnants in stock with length ≥ {matcherTargetLength} mm for Ø {matcherDia === 0 ? 'All' : matcherDia} mm.</p>
                  </div>
                )}
              </div>
            )}

            {/* Diawise Summary Cards for Reusable Remnants Stock */}
            <div className="dia-summary-container">
              <div className="dia-cards-grid">
                {remnantsDiaSummary.items.map((item) => (
                  <div
                    key={item.diameter}
                    className={`dia-stat-card remnant-card-style ${item.hasStock ? 'has-stock' : 'no-stock'} ${remnantFilterDia === String(item.diameter) ? 'active-filter' : ''}`}
                    onClick={() => setRemnantFilterDia(prev => prev === String(item.diameter) ? 'ALL' : String(item.diameter))}
                    title={`Click to filter Ø ${item.diameter} mm`}
                  >
                    <div className="dia-card-top">
                      <span className="dia-badge remnant-dia-badge">Ø {item.diameter} mm</span>
                      <span className="dia-qty-label remnant-qty">
                        {item.hasStock ? `${item.totalQty} offcuts` : '0 offcuts'}
                      </span>
                    </div>
                    <div className="dia-card-main">
                      <span className="dia-weight-number remnant-text">
                        {Math.round(item.totalWeight).toLocaleString()}
                      </span>
                      <span className="dia-weight-unit">kg</span>
                    </div>
                    {item.totalWeight >= 1000 ? (
                      <div className="dia-ton-label remnant-ton">{(item.totalWeight / 1000).toFixed(2)} MT</div>
                    ) : (
                      <div className="dia-ton-label muted">{item.hasStock ? 'Ready for reuse' : 'None in stock'}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Remnant Control Bar: Filter Tabs, Range Chips & Search */}
            <div className="remnant-toolbar">
              <div className="remnant-filter-pills-row">
                <span className="toolbar-label">Diameter:</span>
                <button
                  className={`filter-badge ${remnantFilterDia === 'ALL' ? 'active' : ''}`}
                  onClick={() => setRemnantFilterDia('ALL')}
                >
                  All ({inventory.remnantsStock.length})
                </button>
                {remnantsDiaSummary.items.filter(i => i.hasStock).map(i => (
                  <button
                    key={i.diameter}
                    className={`filter-badge ${remnantFilterDia === String(i.diameter) ? 'active' : ''}`}
                    onClick={() => setRemnantFilterDia(String(i.diameter))}
                  >
                    Ø {i.diameter} mm ({i.totalQty})
                  </button>
                ))}
              </div>

              <div className="remnant-toolbar-right">
                <div className="length-preset-group">
                  <span className="toolbar-label">Length:</span>
                  <button
                    className={`filter-chip-btn ${remnantLengthCategory === 'ALL' ? 'active' : ''}`}
                    onClick={() => setRemnantLengthCategory('ALL')}
                  >
                    All
                  </button>
                  <button
                    className={`filter-chip-btn ${remnantLengthCategory === 'SHORT' ? 'active' : ''}`}
                    onClick={() => setRemnantLengthCategory('SHORT')}
                    title="Length < 1000 mm"
                  >
                    &lt;1m
                  </button>
                  <button
                    className={`filter-chip-btn ${remnantLengthCategory === 'MEDIUM' ? 'active' : ''}`}
                    onClick={() => setRemnantLengthCategory('MEDIUM')}
                    title="Length 1000mm - 3000mm"
                  >
                    1m–3m
                  </button>
                  <button
                    className={`filter-chip-btn ${remnantLengthCategory === 'LONG' ? 'active' : ''}`}
                    onClick={() => setRemnantLengthCategory('LONG')}
                    title="Length > 3000mm"
                  >
                    &gt;3m
                  </button>
                </div>

                <div className="search-box">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search length, brand..."
                    value={remnantSearch}
                    onChange={(e) => setRemnantSearch(e.target.value)}
                    className="search-input"
                  />
                  {remnantSearch && (
                    <button className="search-clear-btn" onClick={() => setRemnantSearch('')}>
                      <X size={12} />
                    </button>
                  )}
                </div>

                <select
                  value={remnantSortBy}
                  onChange={(e) => setRemnantSortBy(e.target.value)}
                  className="remnant-sort-select"
                >
                  <option value="length-asc">Length: Short to Long</option>
                  <option value="length-desc">Length: Long to Short</option>
                  <option value="qty-desc">Quantity: High to Low</option>
                  <option value="weight-desc">Weight: High to Low</option>
                </select>
              </div>
            </div>

            {filteredRemnants.length === 0 ? (
              <div className="empty-stock-state">
                <p>No remnants found matching the selected filters. Change filter or run optimization.</p>
              </div>
            ) : (
              <div className="remnants-scrollable-container">
                <table className="inventory-table remnants-table">
                  <thead>
                    <tr>
                      <th style={{ width: '120px' }}>Diameter</th>
                      <th style={{ width: '140px' }}>Length</th>
                      <th style={{ width: '140px' }}>Qty (Offcuts)</th>
                      <th style={{ width: '140px' }}>Total Weight</th>
                      <th style={{ width: '130px' }}>Generated Date</th>
                      <th style={{ width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRemnants.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <span className={`dia-pill-badge ${item.diameter === 8 ? 'dia-8' : item.diameter === 10 ? 'dia-10' : item.diameter === 12 ? 'dia-12' : 'dia-default'}`}>
                            Ø {item.diameter} mm
                          </span>
                        </td>
                        <td>
                          <span className="font-bold">{item.length.toLocaleString()} mm</span>
                        </td>
                        <td className="font-bold">
                          {editingRemnantId === item._id ? (
                            <input
                              type="number"
                              min="0"
                              value={editRemnantQty}
                              onChange={(e) => setEditRemnantQty(e.target.value)}
                              className="inline-qty-input"
                            />
                          ) : (
                            <span className="remnant-qty-tag">{item.quantity} offcuts</span>
                          )}
                        </td>
                        <td>
                          <span className="font-bold text-cyan">
                            {Math.round(item.weightInKgs).toLocaleString('en-IN')} kg
                          </span>
                        </td>
                        <td>
                          <span className="date-tag">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                          </span>
                        </td>
                        <td>
                          {editingRemnantId === item._id ? (
                            <div className="sale-action-btns">
                              <button
                                className="edit-sale-btn"
                                title="Save changes"
                                onClick={() => handleSaveRemnantEdit(item._id)}
                                style={{ color: '#10b981' }}
                              >
                                <Save size={14} />
                              </button>
                              <button
                                className="delete-row-btn"
                                title="Cancel edit"
                                onClick={handleCancelRemnantEdit}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : confirmDeleteRemnantId === item._id ? (
                            <div className="sale-delete-confirm">
                              <span className="delete-confirm-text">Delete?</span>
                              <button
                                className="confirm-delete-btn"
                                onClick={() => handleConfirmDeleteRemnant(item._id)}
                              >
                                Yes
                              </button>
                              <button
                                className="cancel-delete-btn"
                                onClick={handleCancelDeleteRemnant}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="sale-action-btns">
                              <button
                                className="edit-sale-btn"
                                title="Edit quantity"
                                onClick={() => handleEditRemnant(item)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="delete-row-btn"
                                title="Delete this remnant"
                                onClick={() => handleDeleteRemnant(item._id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filteredRemnants.length > 0 && (
              <div className="remnant-table-footer">
                <span>
                  Showing <strong>{filteredRemnants.length}</strong> cut lengths (<strong>{filteredRemnants.reduce((s, i) => s + (i.quantity || 0), 0).toLocaleString()}</strong> pieces • <strong>{Math.round(filteredRemnants.reduce((s, i) => s + (i.weightInKgs || 0), 0)).toLocaleString()} kg</strong>)
                </span>
                {(remnantFilterDia !== 'ALL' || remnantLengthCategory !== 'ALL' || remnantSearch) && (
                  <button
                    className="btn-reset-remnant-filters"
                    onClick={() => { setRemnantFilterDia('ALL'); setRemnantLengthCategory('ALL'); setRemnantSearch(''); }}
                  >
                    Reset Filters
                  </button>
                )}
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
                Pre-filled with all standard diameters (8mm – 32mm). Enter weight &amp; pricing for delivered diameters (1 Ton = 1000 kg).
              </p>
            </div>
            <div className="voucher-actions-group">
              <button 
                type="button" 
                className="add-voucher-row-btn secondary-btn" 
                onClick={handleResetAllDiameters} 
                title="Reset to all standard diameters (8mm - 32mm)"
              >
                <RotateCcw size={14} /> All Diameters (8–32mm)
              </button>
              <button 
                type="button" 
                className="add-voucher-row-btn secondary-btn" 
                onClick={handleApplyBrandVendorToAll} 
                title="Copy brand & vendor to all rows"
              >
                <Sparkles size={14} /> Apply Brand/Vendor to All
              </button>
              <button type="button" className="add-voucher-row-btn" onClick={handleAddVoucherRow}>
                <Plus size={14} /> Add Row
              </button>
            </div>
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
                          onChange={(e) => {
                            handleVoucherRowChange(row.id, 'brandName', e.target.value);
                            openDropdown(row.id, 'brandName');
                          }}
                          onFocus={() => openDropdown(row.id, 'brandName')}
                          onClick={() => openDropdown(row.id, 'brandName')}
                          onMouseDown={() => {
                            if (blurTimeoutRef.current) {
                              clearTimeout(blurTimeoutRef.current);
                              blurTimeoutRef.current = null;
                            }
                          }}
                          onBlur={closeDropdownDelayed}
                          onKeyDown={(e) => handleDropdownKeyDown(e, row.id, 'brandName', getFilteredBrands(row.brandName))}
                          className="voucher-input"
                          autoComplete="off"
                        />
                        {focusedDropdown?.id === row.id && focusedDropdown?.field === 'brandName' && (
                          <div className={`custom-dropdown-menu ${voucherRows.length >= 4 && idx >= voucherRows.length - 2 ? 'open-upward' : ''}`}>
                            {getFilteredBrands(row.brandName).length > 0 ? (
                              getFilteredBrands(row.brandName).map((brand, bIdx) => (
                                <div
                                  key={brand}
                                  className={`custom-dropdown-item ${highlightedIndex === bIdx ? 'is-highlighted' : ''}`}
                                  onMouseEnter={() => setHighlightedIndex(bIdx)}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectSuggestion(row.id, 'brandName', brand);
                                  }}
                                >
                                  {brand}
                                </div>
                              ))
                            ) : (
                              <div className="custom-dropdown-no-item">
                                {row.brandName ? 'No matching company brand' : 'Type to add brand (saved for your company)'}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Vendor name"
                          value={row.vendorName}
                          onChange={(e) => {
                            handleVoucherRowChange(row.id, 'vendorName', e.target.value);
                            openDropdown(row.id, 'vendorName');
                          }}
                          onFocus={() => openDropdown(row.id, 'vendorName')}
                          onClick={() => openDropdown(row.id, 'vendorName')}
                          onMouseDown={() => {
                            if (blurTimeoutRef.current) {
                              clearTimeout(blurTimeoutRef.current);
                              blurTimeoutRef.current = null;
                            }
                          }}
                          onBlur={closeDropdownDelayed}
                          onKeyDown={(e) => handleDropdownKeyDown(e, row.id, 'vendorName', getFilteredVendors(row.vendorName))}
                          className="voucher-input"
                          autoComplete="off"
                        />
                        {focusedDropdown?.id === row.id && focusedDropdown?.field === 'vendorName' && (
                          <div className={`custom-dropdown-menu ${voucherRows.length >= 4 && idx >= voucherRows.length - 2 ? 'open-upward' : ''}`}>
                            {getFilteredVendors(row.vendorName).length > 0 ? (
                              getFilteredVendors(row.vendorName).map((vendor, vIdx) => (
                                <div
                                  key={vendor}
                                  className={`custom-dropdown-item ${highlightedIndex === vIdx ? 'is-highlighted' : ''}`}
                                  onMouseEnter={() => setHighlightedIndex(vIdx)}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectSuggestion(row.id, 'vendorName', vendor);
                                  }}
                                >
                                  {vendor}
                                </div>
                              ))
                            ) : (
                              <div className="custom-dropdown-no-item">
                                {row.vendorName ? 'No matching company vendor' : 'Type to add vendor (saved for your company)'}
                              </div>
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
              <p className="form-card-subtitle">
                Detailed ledger of scrap cleared from site for {user?.companyName || 'Firm'}{user?.projectName ? ` (${user.projectName})` : ''}.
              </p>

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
                    {scrapSales.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                          No scrap sales recorded for {user?.companyName || 'this firm'}{user?.projectName ? ` (${user.projectName})` : ''} yet.
                        </td>
                      </tr>
                    ) : (
                      scrapSales.map((sale) => (
                        <tr key={sale._id}>
                          <td>{new Date(sale.date).toLocaleDateString('en-GB')}</td>
                          <td className="font-bold">{sale.buyer}</td>
                          <td>{sale.weight} kg</td>
                          <td>₹{sale.pricePerKg}</td>
                          <td className="font-bold text-green">₹{sale.revenue.toLocaleString('en-IN')}</td>
                          <td>
                            {confirmDeleteId === sale._id ? (
                              <div className="sale-delete-confirm">
                                <span className="delete-confirm-text">Delete?</span>
                                <button
                                  className="confirm-delete-btn"
                                  onClick={() => handleConfirmDelete(sale._id)}
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
                                  onClick={() => handleDeleteSale(sale._id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
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

      {/* Tab: Batch Scrap Records */}
      {activeTab === 'batchscrap' && (
        <div className="batch-scrap-container card">
          <div className="batch-scrap-header">
            <div>
              <h3 className="section-title">
                <Scale size={20} style={{ marginRight: '8px', color: '#ef4444' }} /> Datewise Batch Scrap Records
              </h3>
              <p className="section-subtitle">
                Every batch committed automatically logs date, time, total scrap quantity (kg), and diameter breakdown.
              </p>
            </div>
            <button 
              className="export-csv-btn"
              onClick={() => {
                if (batchScrapRecords.length === 0) return;
                const headers = ['Date & Time', 'Batch ID', 'Batch Name', 'Total Scrap (kg)', 'Total Remnant (kg)', 'Avg Utilization (%)', 'Diameter Breakdown'];
                const filtered = batchScrapRecords.filter(r => 
                  r.batchName.toLowerCase().includes(scrapSearchQuery.toLowerCase()) ||
                  (r.diameterBreakdown || []).some(d => `${d.diameter}mm`.includes(scrapSearchQuery))
                );
                const rows = filtered.map(r => {
                  const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB') : 'N/A';
                  const breakdownStr = (r.diameterBreakdown || []).map(d => `${d.diameter}mm: ${d.scrapKg}kg (${d.pieces} pcs)`).join(' | ') || 'N/A';
                  return [
                    `"${dateStr}"`,
                    `"${r.batchId}"`,
                    `"${r.batchName}"`,
                    r.totalScrapKg,
                    r.totalRemnantKg,
                    `${r.avgUtilization}%`,
                    `"${breakdownStr}"`
                  ].join(',');
                });
                const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `batch_scrap_records_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download size={15} style={{ marginRight: '6px' }} /> Export CSV
            </button>
          </div>

          {/* Summary Stat Cards */}
          <div className="batch-scrap-summary-cards">
            <div className="scrap-stat-card card-red">
              <span className="stat-label">Total Batch Scrap</span>
              <span className="stat-value">
                {batchScrapRecords.reduce((sum, r) => sum + (r.totalScrapKg || 0), 0).toFixed(2)} <small>kg</small>
              </span>
              <span className="stat-desc">Accumulated across all committed batches</span>
            </div>

            <div className="scrap-stat-card card-blue">
              <span className="stat-label">Total Batches Recorded</span>
              <span className="stat-value">{batchScrapRecords.length}</span>
              <span className="stat-desc">Batches with committed stock & scrap logs</span>
            </div>

            <div className="scrap-stat-card card-orange">
              <span className="stat-label">Avg Scrap per Batch</span>
              <span className="stat-value">
                {batchScrapRecords.length > 0 
                  ? (batchScrapRecords.reduce((sum, r) => sum + (r.totalScrapKg || 0), 0) / batchScrapRecords.length).toFixed(2)
                  : '0.00'} <small>kg</small>
              </span>
              <span className="stat-desc">Average scrap generated per optimization</span>
            </div>
          </div>

          {/* Search Filter */}
          <div className="scrap-search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by Batch Name or Diameter (e.g. 12mm)..."
              value={scrapSearchQuery}
              onChange={(e) => setScrapSearchQuery(e.target.value)}
              className="scrap-search-input"
            />
          </div>

          {/* Datewise Table */}
          {batchScrapRecords.length === 0 ? (
            <div className="empty-stock-state">
              <Layers size={40} color="var(--text-label)" />
              <p>No batch scrap records found. Commit optimization batches to record scrap datewise.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="stock-table scrap-records-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Batch Name / ID</th>
                    <th>Total Scrap (kg)</th>
                    <th>Scrap Breakdown by Diameter</th>
                    <th>Remnants (kg)</th>
                    <th>Utilization</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batchScrapRecords
                    .filter(r => 
                      r.batchName.toLowerCase().includes(scrapSearchQuery.toLowerCase()) ||
                      (r.diameterBreakdown || []).some(d => `${d.diameter}mm`.includes(scrapSearchQuery))
                    )
                    .map((record) => {
                      const formattedDate = record.createdAt 
                        ? `${new Date(record.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'N/A';

                      return (
                        <tr key={record.batchId}>
                          <td className="date-cell">
                            <Calendar size={13} style={{ marginRight: '4px', opacity: 0.7 }} />
                            {formattedDate}
                          </td>
                          <td className="font-bold batch-name-cell">
                            <FileText size={14} style={{ marginRight: '6px', color: '#6366f1' }} />
                            {record.batchName}
                          </td>
                          <td className="scrap-weight-cell">
                            <span className="scrap-badge">
                              {record.totalScrapKg.toFixed(2)} kg
                            </span>
                          </td>
                          <td>
                            {record.diameterBreakdown && record.diameterBreakdown.length > 0 ? (
                              <div className="dia-chip-group">
                                {record.diameterBreakdown.map(d => (
                                  <span key={d.diameter} className="dia-scrap-chip">
                                    <strong>{d.diameter}mm:</strong> {d.scrapKg.toFixed(2)} kg <small>({d.pieces} pcs)</small>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted">No scrap</span>
                            )}
                          </td>
                          <td>
                            {record.totalRemnantKg > 0 ? (
                              <span className="remnant-text">{record.totalRemnantKg.toFixed(2)} kg</span>
                            ) : (
                              <span className="text-muted">0.00 kg</span>
                            )}
                          </td>
                          <td>
                            <span className="utilization-pill">
                              {record.avgUtilization ? `${record.avgUtilization.toFixed(1)}%` : 'N/A'}
                            </span>
                          </td>
                          <td>
                            <span className="saved-badge">
                              Saved Datewise
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
