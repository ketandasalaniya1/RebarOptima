import { useState, useRef, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import './NewBatchPage.css'
import { inventoryApi, batchesApi } from '../../utils/api'
import { useActiveProject } from '../../hooks/useActiveProject'
import { PageHeader, TableSkeleton, useDelayedSkeleton } from '../../components/ui'
import SteelHeader from '../../components/Shared/SteelHeader'
import PredefinedCutsModal from './components/PredefinedCutsModal'
import InwardVoucherDrawer from '../InventoryPage/components/InwardVoucherDrawer'
import ScrapRulesDrawer from '../InventoryPage/components/ScrapRulesDrawer'
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
  TrendingUp,
  Tag,
  FileSpreadsheet,
  Zap,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Scissors,
  Package
} from 'lucide-react'

const STANDARD_DIAMETERS = [8, 10, 12, 16, 20, 25, 32]

const getSingleBarWeight = (dia, lengthMm = 12000) => {
  const d = Number(dia)
  const l = Number(lengthMm) / 1000
  return ((d * d) / 162) * l
}

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

  const firstFieldRef = useRef(null)
  useEffect(() => {
    if (focusNew.current && firstFieldRef.current) {
      firstFieldRef.current.focus()
      focusNew.current = false
    }
  }, [rows])

  return { rows, setRows, addRow, deleteRow, updateRow, handleLastFieldKeyDown, firstFieldRef }
}

export default function NewBatchPage({ onOptimize, editParams, clearEditParams }) {
  const settingsState = useSelector((state) => state.settings)
  const { user } = useSelector((state) => state.auth)

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

  const [batchName, setBatchName] = useState(() => `Batch #${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`)
  const [error, setError] = useState(null)
  const [optimizing, setOptimizing] = useState(false)
  const [isStockExpanded, setIsStockExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [recentBatches, setRecentBatches] = useState([])
  const [isRemnantClearance, setIsRemnantClearance] = useState(false)
  const hasCustomStockRef = useRef(false)

  // Guided Stepper State (CHANGE 5: 1 Add parts -> 2 Check stock -> 3 Settings -> 4 Run)
  const [activeStep, setActiveStep] = useState(1)

  // Cutting parameters & margins
  const [kerf, setKerf] = useState(settingsState.defaultKerf)
  const [trimMargin, setTrimMargin] = useState(settingsState.defaultTrimMargin)
  const [remnantThreshold, setRemnantThreshold] = useState(1000)

  // Scrap Rules Drawer State (CHANGE 2)
  const [isScrapRulesDrawerOpen, setIsScrapRulesDrawerOpen] = useState(false)
  const [scrapRules, setScrapRules] = useState([])
  const [scrapRulesLoading, setScrapRulesLoading] = useState(false)

  // Stock Check & Blocker State (CHANGE 3)
  const [stockBlocker, setStockBlocker] = useState(null)
  const [bypassStockWarning, setBypassStockWarning] = useState(false)

  // Inward Voucher Drawer State (for "+ Add {dia} mm stock" action)
  const [isInwardDrawerOpen, setIsInwardDrawerOpen] = useState(false)
  const [voucherRows, setVoucherRows] = useState(() => createDefaultVoucherRows())
  const [inwardActionLoading, setInwardActionLoading] = useState(false)
  const [inwardError, setInwardError] = useState('')
  const [inwardSuccess, setInwardSuccess] = useState('')

  // Sync state if settings change
  useEffect(() => {
    setKerf(settingsState.defaultKerf)
    setTrimMargin(settingsState.defaultTrimMargin)
  }, [settingsState])

  // Clear error and stock blocker when parts change
  useEffect(() => {
    setError(null)
    setStockBlocker(null)
    setBypassStockWarning(false)
  }, [parts.rows])

  // Fetch scrap rules from server
  useEffect(() => {
    async function loadScrapRules() {
      try {
        const rules = await inventoryApi.getScrapRules()
        if (Array.isArray(rules) && rules.length > 0) {
          setScrapRules(rules)
          setRemnantThreshold(Number(rules[0].scrapLengthThreshold) || 1000)
        }
      } catch (err) {
        console.warn('Could not load scrap rules, using 1000mm default', err)
      }
    }
    loadScrapRules()
  }, [])

  // Load parameters for editing batch or pushing from BBS / Remnant Clearance
  useEffect(() => {
    let payload = null;
    if (editParams) {
      payload = editParams;
      clearEditParams();
    } else {
      const storedPayload = sessionStorage.getItem('bbs_optimizer_payload');
      if (storedPayload) {
        payload = JSON.parse(storedPayload);
        sessionStorage.removeItem('bbs_optimizer_payload'); // consume it
      }
    }

    if (payload) {
      if (payload.batchName) {
        setBatchName(payload.batchName)
      }
      if (payload.inputStock && payload.inputStock.length > 0) {
        hasCustomStockRef.current = true
        stock.setRows(payload.inputStock.map((s, idx) => ({
          id: idx + 1,
          diameter: String(s.diameter || '12'),
          length: String(s.length || '12000'),
          quantity: String(s.quantity ?? ''),
          isRemnant: !!s.isRemnant,
          costPerKg: s.costPerKg || 0
        })))
      }
      if (payload.requiredParts && payload.requiredParts.length > 0) {
        parts.setRows(payload.requiredParts.map((p, idx) => ({
          id: idx + 1,
          diameter: String(p.diameter || '12'),
          length: String(p.length || ''),
          quantity: String(p.quantity || ''),
          label: String(p.label || '')
        })))
      }
      if (payload.settings) {
        if (payload.settings.kerf !== undefined) setKerf(payload.settings.kerf)
        if (payload.settings.trimMargin !== undefined) setTrimMargin(payload.settings.trimMargin)
        if (payload.settings.remnantThreshold !== undefined) setRemnantThreshold(payload.settings.remnantThreshold)
      }
      if (payload.isRemnantClearance) {
        setIsRemnantClearance(true)
      }
    }
  }, [editParams])

  const { projectId, projectEpoch, isStale } = useActiveProject()

  // Reset custom stock override lock when project changes
  useEffect(() => {
    hasCustomStockRef.current = false
    setIsRemnantClearance(false)
  }, [projectId])

  // Load stock items and remnants, plus batches history for active project
  useEffect(() => {
    if (!projectId) return
    const epochAtStart = projectEpoch
    async function loadStockAndBatches() {
      try {
        const [stockData, batchesData] = await Promise.all([
          inventoryApi.getInventory(projectId),
          batchesApi.getHistory(projectId)
        ])
        if (isStale(epochAtStart)) return

        const combined = []
        let index = 1

        const sortedStandard = [...(stockData.standardStock || [])].sort((a, b) => Number(b.length) - Number(a.length))
        const sortedRemnants = [...(stockData.remnantsStock || [])].sort((a, b) => Number(a.length) - Number(b.length))

        sortedStandard.forEach(s => {
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

        sortedRemnants.forEach(s => {
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

        if (combined.length > 0 && !hasCustomStockRef.current) {
          stock.setRows(combined)
        }

        setRecentBatches(batchesData.slice(0, 5))
      } catch (err) {
        console.error('Failed to load stock or batch history:', err)
      }
    }
    loadStockAndBatches()
  }, [projectId, projectEpoch])

  // Reload Live Yard Stock from Database (Additive shortcut)
  const handleReloadLiveStock = async () => {
    if (!projectId) return;
    try {
      const stockData = await inventoryApi.getInventory(projectId);
      const combined = [];
      let index = 1;
      const sortedStandard = [...(stockData.standardStock || [])].sort((a, b) => Number(b.length) - Number(a.length));
      const sortedRemnants = [...(stockData.remnantsStock || [])].sort((a, b) => Number(a.length) - Number(b.length));

      sortedStandard.forEach(s => {
        combined.push({
          id: index++,
          dbId: s._id,
          diameter: String(s.diameter),
          length: String(s.length),
          quantity: String(s.quantity),
          isRemnant: false,
          costPerKg: s.costPerKg || 0
        });
      });

      sortedRemnants.forEach(s => {
        combined.push({
          id: index++,
          dbId: s._id,
          diameter: String(s.diameter),
          length: String(s.length),
          quantity: String(s.quantity),
          isRemnant: true,
          costPerKg: s.costPerKg || 0
        });
      });

      if (combined.length > 0) {
        stock.setRows(combined);
        setIsStockExpanded(true);
      }
    } catch (e) {
      console.error('Failed to reload live stock', e);
    }
  };

  // Draft persistence across tab switches
  useEffect(() => {
    try {
      const draft = {
        batchName,
        partsRows: parts.rows,
        stockRows: stock.rows,
        kerf,
        trimMargin,
        remnantThreshold,
        timestamp: Date.now()
      };
      sessionStorage.setItem('rebar_batch_draft', JSON.stringify(draft));
    } catch (e) {
      console.warn('Could not persist draft to sessionStorage', e);
    }
  }, [batchName, parts.rows, stock.rows, kerf, trimMargin, remnantThreshold]);

  // Restore draft on mount if available
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('rebar_batch_draft');
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && Date.now() - draft.timestamp < 1000 * 60 * 60 * 2) {
          if (draft.batchName) setBatchName(draft.batchName);
          if (draft.kerf !== undefined) setKerf(draft.kerf);
          if (draft.trimMargin !== undefined) setTrimMargin(draft.trimMargin);
          if (draft.remnantThreshold !== undefined) setRemnantThreshold(draft.remnantThreshold);
          if (draft.partsRows && draft.partsRows.length > 0 && (!parts.rows[0].length || parts.rows.length === 1)) {
            parts.setRows(draft.partsRows);
          }
        }
      }
    } catch (e) {
      console.warn('Could not restore draft from sessionStorage', e);
    }
  }, []);

  // CSV & Predefined Cuts Modal states
  const [showPredefinedModal, setShowPredefinedModal] = useState(false)
  const [predefinedModalTab, setPredefinedModalTab] = useState('library')

  const handleApplyPredefinedParts = (cutItems) => {
    if (!cutItems || cutItems.length === 0) return

    const currentMaxId = parts.rows.reduce((max, r) => (r.id > max ? r.id : max), 0)
    let tempId = currentMaxId + 1

    const newRows = cutItems.map((item) => ({
      id: tempId++,
      diameter: String(item.diameter || '12'),
      length: String(item.length || ''),
      quantity: String(item.quantity || '1'),
      label: String(item.label || item.groupName || ''),
    }))

    parts.setRows((prev) => {
      if (
        prev.length === 1 &&
        (!prev[0].length || prev[0].length === '') &&
        (!prev[0].quantity || prev[0].quantity === '')
      ) {
        return newRows
      }
      return [...prev, ...newRows]
    })
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHANGE 3: STOCK AVAILABILITY CHECKER
  // ═══════════════════════════════════════════════════════════════════
  const checkStockAvailability = () => {
    const validParts = parts.rows.filter(r => Number(r.length) > 0 && Number(r.quantity) > 0);
    if (validParts.length === 0) {
      return { ok: false, error: 'Please enter at least one required cut part.' };
    }

    // Group demanded cuts by diameter
    const demandByDia = {};
    validParts.forEach(p => {
      const dia = Number(p.diameter);
      const length = Number(p.length);
      const qty = Number(p.quantity);
      if (!demandByDia[dia]) {
        demandByDia[dia] = { dia, totalLength: 0, totalPieces: 0 };
      }
      demandByDia[dia].totalLength += (length * qty);
      demandByDia[dia].totalPieces += qty;
    });

    const stockByDia = {};
    stock.rows.forEach(s => {
      const dia = Number(s.diameter);
      const qty = s.quantity === '' ? Infinity : (Number(s.quantity) || 0);
      const length = Number(s.length) || 12000;
      if (!stockByDia[dia]) {
        stockByDia[dia] = { totalBars: 0, totalLength: 0, isUnlimited: false };
      }
      if (qty === Infinity) {
        stockByDia[dia].isUnlimited = true;
      } else {
        stockByDia[dia].totalBars += qty;
        stockByDia[dia].totalLength += (qty * length);
      }
    });

    // Check for zero stock first
    for (const dia of Object.keys(demandByDia).map(Number)) {
      const available = stockByDia[dia];
      if (!available || (!available.isUnlimited && available.totalBars <= 0 && available.totalLength <= 0)) {
        return {
          ok: false,
          type: 'NO_STOCK',
          diameter: dia,
          message: `No ${dia} mm steel in stock in yard inventory.`
        };
      }
    }

    // Check for insufficient stock (approximate bars needed = ceil(totalLength / 12000))
    for (const dia of Object.keys(demandByDia).map(Number)) {
      const demand = demandByDia[dia];
      const available = stockByDia[dia];
      if (available && !available.isUnlimited) {
        const neededBars = Math.ceil(demand.totalLength / 12000);
        if (available.totalBars < neededBars) {
          const deficit = neededBars - available.totalBars;
          return {
            ok: false,
            type: 'INSUFFICIENT_STOCK',
            diameter: dia,
            neededBars,
            availableBars: available.totalBars,
            deficitBars: deficit,
            message: `Need ${neededBars} bars of Ø ${dia} mm, have ${available.totalBars} in stock (deficit of ${deficit} bars).`
          };
        }
      }
    }

    return { ok: true };
  };

  // Open Inward Voucher pre-filled with missing diameter
  const handleOpenInwardForDia = (dia) => {
    setVoucherRows([
      {
        id: 1,
        diameter: Number(dia),
        weightInTons: '2.5',
        pricePerTonWithoutGst: '',
        gstAmount: 0,
        totalPriceWithGst: 0,
        brandName: '',
        vendorName: ''
      },
      ...STANDARD_DIAMETERS.filter(d => d !== Number(dia)).map((d, idx) => ({
        id: idx + 2,
        diameter: d,
        weightInTons: '',
        pricePerTonWithoutGst: '',
        gstAmount: 0,
        totalPriceWithGst: 0,
        brandName: '',
        vendorName: ''
      }))
    ]);
    setIsInwardDrawerOpen(true);
  };

  // Handle Inward voucher submission inside Optimizer
  const handleInwardVoucherSubmit = async () => {
    setInwardActionLoading(true);
    setInwardError('');
    setInwardSuccess('');
    try {
      const filled = voucherRows.filter(r => parseFloat(r.weightInTons) > 0);
      if (filled.length === 0) {
        throw new Error('Please enter valid Weight (Tons) for at least one diameter.');
      }
      for (const row of filled) {
        const tons = parseFloat(row.weightInTons);
        const singleWeight = getSingleBarWeight(row.diameter, 12000);
        const weightInKgs = tons * 1000;
        const quantity = Math.round(weightInKgs / singleWeight);

        await inventoryApi.inward({
          projectId: projectId || undefined,
          diameter: Number(row.diameter),
          quantity,
          weightInKgs,
          costPerKg: 0,
          typeOfBar: 'TMT500',
          brandName: row.brandName || '',
          vendorName: row.vendorName || '',
        });
      }
      setInwardSuccess('Stock added successfully to yard inventory!');
      await handleReloadLiveStock();
      setStockBlocker(null);
      setTimeout(() => {
        setIsInwardDrawerOpen(false);
        setInwardSuccess('');
      }, 1200);
    } catch (err) {
      setInwardError(err.message || 'Failed to submit inward stock.');
    } finally {
      setInwardActionLoading(false);
    }
  };

  // Handle Scrap Rules save from Optimizer (CHANGE 2)
  const handleSaveScrapRules = async () => {
    setScrapRulesLoading(true);
    try {
      const sanitized = scrapRules.map(r => ({
        ...r,
        scrapLengthThreshold: r.scrapLengthThreshold === '' || isNaN(Number(r.scrapLengthThreshold))
          ? 1000
          : Math.max(100, Math.min(12000, Number(r.scrapLengthThreshold)))
      }));
      const updated = await inventoryApi.updateScrapRules(sanitized);
      setScrapRules(updated);
      if (updated.length > 0) {
        setRemnantThreshold(Number(updated[0].scrapLengthThreshold) || 1000);
      }
      setIsScrapRulesDrawerOpen(false);
    } catch (e) {
      console.error('Failed to save scrap rules', e);
    } finally {
      setScrapRulesLoading(false);
    }
  };

  const handleRunOptimization = async () => {
    setError(null);

    // CHANGE 3: Run stock check before starting
    const stockStatus = checkStockAvailability();
    if (!stockStatus.ok) {
      if (stockStatus.type === 'NO_STOCK') {
        setStockBlocker(stockStatus);
        setActiveStep(2);
        return;
      }
      if (stockStatus.type === 'INSUFFICIENT_STOCK' && !bypassStockWarning) {
        setStockBlocker(stockStatus);
        setActiveStep(2);
        return;
      }
      if (stockStatus.error) {
        setError(stockStatus.error);
        return;
      }
    }

    setOptimizing(true);
    try {
      const data = await batchesApi.optimize({
        stockRows: stock.rows,
        partsRows: parts.rows,
        options: { kerf, trimMargin, remnantThreshold }
      });
      data.batchName = batchName;
      data.inputStock = stock.rows;
      data.requiredParts = parts.rows;
      data.settings = { kerf, trimMargin, remnantThreshold };
      onOptimize(data);
    } catch (err) {
      setError(err.message || 'Failed to run optimization on server.');
    } finally {
      setOptimizing(false);
    }
  };

  // Step completion flags
  const hasValidParts = useMemo(() => {
    return parts.rows.some(r => Number(r.length) > 0 && Number(r.quantity) > 0);
  }, [parts.rows]);

  const isStockValid = useMemo(() => {
    return hasValidParts && !stockBlocker;
  }, [hasValidParts, stockBlocker]);

  const isSettingsValid = kerf >= 0 && trimMargin >= 0;

  return (
    <div className="optimizer-container-grid">
      <SteelHeader
        activeTab="inputs"
        title="Run Cutting Optimizer"
        subtitle="1D linear rebar optimization with remnant clearance and waste reduction algorithms."
      />

      {/* Left Column: Optimization input form */}
      <div className="optimizer-left-main">
        <div className="optimizer-page">

          {/* CHANGE 5: Guided Stepper Flow */}
          <div className="optimizer-stepper-container">
            <button
              type="button"
              className={`optimizer-step-node ${activeStep === 1 ? 'is-active' : ''} ${hasValidParts ? 'is-valid' : ''}`}
              onClick={() => setActiveStep(1)}
              title="Step 1: Enter cut pieces"
            >
              <div className="step-node-number">{hasValidParts ? <CheckCircle2 size={14} /> : '1'}</div>
              <span className="step-node-title">1. Add Parts</span>
            </button>
            <span className="step-separator-arrow">→</span>

            <button
              type="button"
              className={`optimizer-step-node ${activeStep === 2 ? 'is-active' : ''} ${isStockValid ? 'is-valid' : ''}`}
              onClick={() => setActiveStep(2)}
              title="Step 2: Check yard stock availability"
            >
              <div className="step-node-number">{isStockValid ? <CheckCircle2 size={14} /> : '2'}</div>
              <span className="step-node-title">2. Check Stock</span>
            </button>
            <span className="step-separator-arrow">→</span>

            <button
              type="button"
              className={`optimizer-step-node ${activeStep === 3 ? 'is-active' : ''} ${isSettingsValid ? 'is-valid' : ''}`}
              onClick={() => setActiveStep(3)}
              title="Step 3: Blade kerf, trim margin, and scrap rules"
            >
              <div className="step-node-number">{isSettingsValid ? <CheckCircle2 size={14} /> : '3'}</div>
              <span className="step-node-title">3. Settings</span>
            </button>
            <span className="step-separator-arrow">→</span>

            <button
              type="button"
              className={`optimizer-step-node ${activeStep === 4 ? 'is-active' : ''}`}
              onClick={() => setActiveStep(4)}
              title="Step 4: Run optimization"
            >
              <div className="step-node-number">4</div>
              <span className="step-node-title">4. Run Optimizer</span>
            </button>
          </div>

          {/* CHANGE 3: Stock Blocker / Warning Banner */}
          {stockBlocker && (
            <div className={`stock-blocker-banner ${stockBlocker.type === 'NO_STOCK' ? 'danger' : 'warning'}`}>
              <div className="stock-blocker-left">
                <ShieldAlert size={20} />
                <div className="stock-blocker-msg">
                  {stockBlocker.message}
                </div>
              </div>
              <div className="stock-blocker-actions">
                <button
                  type="button"
                  className="btn-stock-add-inward"
                  onClick={() => handleOpenInwardForDia(stockBlocker.diameter)}
                >
                  <Plus size={14} /> Add {stockBlocker.diameter} mm Stock
                </button>
                {stockBlocker.type === 'INSUFFICIENT_STOCK' && (
                  <button
                    type="button"
                    className="btn-stock-run-anyway"
                    onClick={() => {
                      setBypassStockWarning(true);
                      setStockBlocker(null);
                      handleRunOptimization();
                    }}
                  >
                    Run anyway with available stock
                  </button>
                )}
              </div>
            </div>
          )}

          {isRemnantClearance && (
            <div className="remnant-clearance-badge-card">
              <div className="remnant-badge-left">
                <Zap size={16} className="text-emerald" />
                <div>
                  <strong>Remnant Clearance Optimization Mode:</strong> Loaded {stock.rows.length} remnant offcut bar group{stock.rows.length !== 1 ? 's' : ''} and {parts.rows.length} required cut item{parts.rows.length !== 1 ? 's' : ''} from yard inventory.
                </div>
              </div>
              <button
                type="button"
                className="btn-dismiss-remnant-mode"
                onClick={() => setIsRemnantClearance(false)}
                title="Dismiss notice"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
             STEP 1: REQUIRED CUT PARTS
             ═══════════════════════════════════════════════════════════════════ */}
          {(activeStep === 1 || activeStep === 4) && (
            <section className="card parts-section-card">
              <div className="section-header">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <h2 className="section-title">
                    <Scissors size={15} style={{ marginRight: '6px', color: 'var(--accent)' }} />
                    Step 1: Required Cut Parts
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-label)' }}>
                    ({parts.rows.filter(r => r.length && r.quantity).length} specified)
                  </span>
                </div>
                <div className="actions-header-row">
                  <button
                    type="button"
                    className="manage-csv-btn"
                    title="Manage predefined steel cutting data (saved library, edit, delete, and import)"
                    onClick={() => {
                      setPredefinedModalTab('library')
                      setShowPredefinedModal(true)
                    }}
                  >
                    <FileSpreadsheet size={14} /> Manage CSV Cuts
                  </button>
                  <button type="button" className="add-row-btn" onClick={() => parts.addRow()}>
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
                      <th>Required Cut Length (mm)</th>
                      <th>Quantity (pcs)</th>
                      <th>Member / Part Label (Optional)</th>
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
                            placeholder="e.g. Beam-B1"
                            onKeyDown={(e) => parts.handleLastFieldKeyDown(e, i === parts.rows.length - 1)}
                          />
                        </td>
                        <td className="col-actions">
                          <button
                            className="delete-btn"
                            onClick={() => parts.deleteRow(row.id)}
                            disabled={parts.rows.length === 1}
                            title="Delete row"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '11.5px', color: 'var(--text-label)' }}>
                <span>Keyboard shortcut: Press <kbd style={{ padding: '1px 5px', background: 'var(--main-bg)', border: '1px solid var(--card-border)', borderRadius: '3px' }}>Tab</kbd> or <kbd style={{ padding: '1px 5px', background: 'var(--main-bg)', border: '1px solid var(--card-border)', borderRadius: '3px' }}>Enter</kbd> in label to add row.</span>
              </div>

              {activeStep === 1 && (
                <div className="step-nav-footer">
                  <div></div>
                  <button
                    type="button"
                    className="btn-step-nav primary"
                    onClick={() => setActiveStep(2)}
                    disabled={!hasValidParts}
                  >
                    Next: Check Stock <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
             STEP 2: CHECK YARD STOCK
             ═══════════════════════════════════════════════════════════════════ */}
          {(activeStep === 2 || activeStep === 4) && (
            <section className="card stock-section-card">
              <div className="section-header">
                <div className="title-with-toggle">
                  <h2 className="section-title">
                    <Package size={15} style={{ marginRight: '6px', color: 'var(--accent)' }} />
                    Step 2: Check Live Yard Stock & Overrides
                  </h2>
                </div>
                <div className="header-actions">
                  <button
                    type="button"
                    className="toggle-stock-btn"
                    onClick={handleReloadLiveStock}
                    title="Reload live stock bundles and remnants from yard inventory"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RefreshCw size={13} /> Reload Live Yard Stock
                  </button>
                  <button
                    type="button"
                    className="toggle-stock-btn"
                    onClick={() => setIsStockExpanded(!isStockExpanded)}
                  >
                    {isStockExpanded ? (
                      <>Hide Manual Stock <ChevronUp size={15} /></>
                    ) : (
                      <>Show Manual Stock Inputs <ChevronDown size={15} /></>
                    )}
                  </button>
                  {isStockExpanded && (
                    <button className="add-row-btn" onClick={() => stock.addRow()}>
                      <Plus size={14} /> Add Stock Row
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
                        <th>Available Length (mm)</th>
                        <th>Stock Quantity</th>
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
                              placeholder="Blank = Unlimited"
                              onKeyDown={(e) => stock.handleLastFieldKeyDown(e, i === stock.rows.length - 1)}
                            />
                          </td>
                          <td className="col-actions">
                            <button className="delete-btn" onClick={() => stock.deleteRow(row.id)} title="Delete row">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="stock-collapsed-hint" style={{ fontSize: '12.5px', color: 'var(--text-secondary)', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} style={{ color: 'var(--success-text)' }} />
                  <span><strong>Live inventory active:</strong> Standard 12.0m bars and reusable offcuts are loaded directly from your database yard.</span>
                </div>
              )}

              {activeStep === 2 && (
                <div className="step-nav-footer">
                  <button
                    type="button"
                    className="btn-step-nav secondary"
                    onClick={() => setActiveStep(1)}
                  >
                    <ArrowLeft size={14} /> Back to Parts
                  </button>
                  <button
                    type="button"
                    className="btn-step-nav primary"
                    onClick={() => setActiveStep(3)}
                  >
                    Next: Settings & Rules <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
             STEP 3: SETTINGS & SCRAP RULES (CHANGE 2: GEAR ICON)
             ═══════════════════════════════════════════════════════════════════ */}
          {(activeStep === 3 || activeStep === 4) && (
            <section className="card batch-name-card">
              <div className="section-header">
                <div className="title-with-toggle">
                  <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={15} color="var(--accent)" /> Step 3: Batch Identification & Settings
                  </h2>
                </div>
                {/* CHANGE 2: Scrap Rules Gear Button */}
                <button
                  type="button"
                  className="btn-scrap-rules-gear"
                  onClick={() => setIsScrapRulesDrawerOpen(true)}
                  title="Configure scrap classification rules & remnant threshold"
                >
                  <Settings size={13} />
                  <span>Scrap Rules (Min {remnantThreshold}mm)</span>
                </button>
              </div>

              <div className="batch-name-input-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="adv-lbl" style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Batch Name / Job Reference</label>
                <input
                  type="text"
                  className="form-input"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g. Slab A - Ground Floor"
                />
              </div>

              <div className="cutting-params-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Kerf / Blade Cut Loss (mm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={kerf}
                    onFocus={(e) => {
                      if (e.target.value === '0') e.target.select();
                    }}
                    onChange={(e) => setKerf(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    onBlur={() => {
                      if (kerf === '') setKerf(0);
                    }}
                    min="0"
                    placeholder="e.g. 5"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-label)' }}>Saw kerf loss per cut.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>End Trim Margin (mm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={trimMargin}
                    onFocus={(e) => {
                      if (e.target.value === '0') e.target.select();
                    }}
                    onChange={(e) => setTrimMargin(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    onBlur={() => {
                      if (trimMargin === '') setTrimMargin(0);
                    }}
                    min="0"
                    placeholder="e.g. 25"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-label)' }}>Discarded from stock ends.</span>
                </div>

                {/* Min Offcut Remnant Threshold with Gear Button */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Min Remnant Threshold (mm)</label>
                    <button
                      type="button"
                      onClick={() => setIsScrapRulesDrawerOpen(true)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent, #059669)', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
                      title="Open Scrap Rules"
                    >
                      <Settings size={12} />
                    </button>
                  </div>
                  <input
                    type="number"
                    className="form-input"
                    value={remnantThreshold}
                    onChange={(e) => setRemnantThreshold(e.target.value === '' ? '' : Math.max(100, Number(e.target.value)))}
                    min="100"
                    placeholder="e.g. 1000"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-label)' }}>Cuts &lt; this length are scrap.</span>
                </div>
              </div>

              {activeStep === 3 && (
                <div className="step-nav-footer">
                  <button
                    type="button"
                    className="btn-step-nav secondary"
                    onClick={() => setActiveStep(2)}
                  >
                    <ArrowLeft size={14} /> Back to Stock
                  </button>
                  <button
                    type="button"
                    className="btn-step-nav primary"
                    onClick={() => setActiveStep(4)}
                  >
                    Next: Review & Run <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </section>
          )}

          {error && (
            <div className="error-alert-banner">
              <AlertCircle size={20} className="error-alert-icon" />
              <div className="error-alert-text">{error}</div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
             STEP 4: RUN OPTIMIZATION
             ═══════════════════════════════════════════════════════════════════ */}
          {activeStep === 4 && (
            <div className="card optimize-run-card" style={{ padding: '20px 24px', borderRadius: '10px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--card-border, #e2e8f0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                    Ready to Calculate Optimal Cutting Plan
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {parts.rows.filter(r => r.length && r.quantity).length} cut parts defined. Kerf loss: {kerf}mm • Trim: {trimMargin}mm • Remnants: &gt;={remnantThreshold}mm.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-optimize"
                  disabled={optimizing || !hasValidParts}
                  onClick={handleRunOptimization}
                  style={{ minWidth: '220px' }}
                >
                  {optimizing ? (
                    'Calculating Cutting Plan...'
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Zap size={16} /> Calculate Cutting Plan
                    </span>
                  )}
                </button>
              </div>

              <div className="step-nav-footer" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-step-nav secondary"
                  onClick={() => setActiveStep(3)}
                >
                  <ArrowLeft size={14} /> Back to Settings
                </button>
                <div></div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom Section: Recent Optimizations */}
      <div className="recent-optimizations-section">
        <div className="card recent-batches-card">
          <div className="card-header-row">
            <div className="header-title-group">
              <History size={18} className="section-header-icon" />
              <h3 className="section-main-title">Recent Optimizations</h3>
            </div>
            <p className="section-main-desc">Previously saved batch runs. Click to restore parameters.</p>
          </div>

          {recentBatches.length === 0 ? (
            <div className="sidebar-empty-state">
              <p>No recent batches found.</p>
            </div>
          ) : (
            <div className="recent-batches-grid">
              {recentBatches.map((b) => {
                const totalBars = b.layouts?.reduce((sum, l) => sum + Number(l.repetition), 0) || 0;
                return (
                  <div key={b._id} className="batch-grid-item" onClick={() => onOptimize(b)}>
                    <div className="batch-item-header">
                      <span className="batch-item-name">{b.batchName}</span>
                      <span className="batch-item-date">
                        {new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="batch-item-body">
                      <div className="batch-metric">
                        <span className="metric-val">{b.summary?.avgUtilization?.toFixed(1)}%</span>
                        <span className="metric-lbl">Avg Utilization</span>
                      </div>
                      <div className="batch-vertical-divider"></div>
                      <div className="batch-metric">
                        <span className="metric-val">{totalBars}</span>
                        <span className="metric-lbl">Bars Used</span>
                      </div>
                    </div>
                    <div className="batch-item-footer">
                      <span className="restore-hint-btn">Restore Optimization</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Predefined Cuts CSV Modal */}
      <PredefinedCutsModal
        isOpen={showPredefinedModal}
        onClose={() => setShowPredefinedModal(false)}
        activeTab={predefinedModalTab}
        setActiveTab={setPredefinedModalTab}
        onApplyParts={handleApplyPredefinedParts}
      />

      {/* CHANGE 2: Scrap Rules Drawer */}
      <ScrapRulesDrawer
        isOpen={isScrapRulesDrawerOpen}
        onClose={() => setIsScrapRulesDrawerOpen(false)}
        scrapRules={scrapRules}
        handleRuleChange={(idx, val) => {
          setScrapRules(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], scrapLengthThreshold: val };
            return updated;
          });
        }}
        handleSaveRules={handleSaveScrapRules}
        actionLoading={scrapRulesLoading}
        onSaveSuccess={(newThreshold) => {
          setRemnantThreshold(newThreshold);
        }}
      />

      {/* CHANGE 3: Inward Delivery Drawer (opens when stock is missing) */}
      <InwardVoucherDrawer
        isOpen={isInwardDrawerOpen}
        onClose={() => setIsInwardDrawerOpen(false)}
        voucherRows={voucherRows}
        handleVoucherRowChange={(id, field, val) => {
          setVoucherRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
        }}
        handleAddVoucherRow={() => {
          setVoucherRows(prev => [
            ...prev,
            {
              id: Date.now(),
              diameter: 12,
              weightInTons: '',
              pricePerTonWithoutGst: '',
              gstAmount: 0,
              totalPriceWithGst: 0,
              brandName: '',
              vendorName: ''
            }
          ]);
        }}
        handleDeleteVoucherRow={(id) => {
          setVoucherRows(prev => prev.filter(r => r.id !== id));
        }}
        handleResetAllDiameters={() => {
          setVoucherRows(createDefaultVoucherRows());
        }}
        handleApplyBrandVendorToAll={() => {
          if (voucherRows.length > 0) {
            const first = voucherRows[0];
            setVoucherRows(prev => prev.map(r => ({
              ...r,
              brandName: first.brandName,
              vendorName: first.vendorName
            })));
          }
        }}
        handleVoucherSubmit={handleInwardVoucherSubmit}
        actionLoading={inwardActionLoading}
        error={inwardError}
        success={inwardSuccess}
        openDropdown={() => {}}
        closeDropdownDelayed={() => {}}
        focusedDropdown={null}
        highlightedIndex={-1}
        setHighlightedIndex={() => {}}
        handleSelectSuggestion={() => {}}
        handleDropdownKeyDown={() => {}}
        getFilteredBrands={() => []}
        getFilteredVendors={() => []}
        blurTimeoutRef={{ current: null }}
      />
    </div>
  )
}
