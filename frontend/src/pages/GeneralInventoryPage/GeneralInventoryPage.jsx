import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Warehouse,
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  RotateCcw,
  ClipboardCheck,
  AlertTriangle,
  FileText,
  Printer,
  Download,
  Building2,
  Store,
  RefreshCw,
  Package,
  Layers,
  X,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  User,
  MapPin,
  Tag
} from 'lucide-react';
import { generalInventoryApi } from '../../utils/api';
import './GeneralInventoryPage.css';

const DEFAULT_CATEGORIES = [
  'Electrical',
  'Plumbing',
  'Chemicals',
  'Fire Safety',
  'Tools & Hardware',
  'Stationery',
  'Finishing & Paints',
  'Safety & PPE',
  'Mechanical & Machinery',
  'Other'
];

const COMMON_UOMS = [
  'Nos',
  'Bags',
  'Mtr',
  'Kg',
  'Ltr',
  'Box',
  'Bundle',
  'Roll',
  'Set',
  'Sq.Mtr',
  'Pair'
];

export default function GeneralInventoryPage() {
  const user = useSelector((state) => state.auth.user);

  // Active Context
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(''); // '' means All Stores

  // Sub-Navigation Tabs: 'overview' | 'materials' | 'inward' | 'outward' | 'returns' | 'transfers' | 'audit' | 'reports'
  const [activeTab, setActiveTab] = useState('overview');

  // Loading & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Domain Data States
  const [materials, setMaterials] = useState([]);
  const [inwardEntries, setInwardEntries] = useState([]);
  const [outwardEntries, setOutwardEntries] = useState([]);
  const [returnsEntries, setReturnsEntries] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [eligibleOutward, setEligibleOutward] = useState([]);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Active Modals
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingMaterial, setOpeningMaterial] = useState(null);

  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showOutwardModal, setShowOutwardModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  // Slip Printing / Detail View
  const [activeSlip, setActiveSlip] = useState(null); // { type: 'INWARD'|'OUTWARD', data: any }

  // Reports Tab States
  const [reportType, setReportType] = useState('store-wise-stock');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Audit sub-tab: 'verification' | 'adjustments' | 'incidents'
  const [auditSubTab, setAuditSubTab] = useState('verification');

  // Form States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', code: '', description: '', address: '' });
  const [storeForm, setStoreForm] = useState({ name: '', code: '', location: '' });
  const [materialForm, setMaterialForm] = useState({
    name: '',
    category: 'Electrical',
    subcategory: '',
    uom: 'Nos',
    lowStockThreshold: 5,
    materialCode: '',
    brandOrModel: '',
    sizeOrSpec: '',
    description: '',
    preferredVendor: '',
    remarks: ''
  });

  const [openingForm, setOpeningForm] = useState({ storeId: '', quantity: 0, remarks: '' });

  // Inward Multi-Item Form
  const [inwardForm, setInwardForm] = useState({
    storeId: '',
    receiptDate: new Date().toISOString().split('T')[0],
    vendorName: '',
    vendorContact: '',
    vendorChallanNumber: '',
    invoiceNumber: '',
    remarks: '',
    items: [
      { materialId: '', receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, rejectedQuantity: 0, unitPrice: 0, remarks: '' }
    ]
  });

  // Outward Form
  const [outwardForm, setOutwardForm] = useState({
    storeId: '',
    issueDateTime: new Date().toISOString().slice(0, 16),
    materialId: '',
    quantity: 1,
    personReceiving: '',
    agency: '',
    isAgencyNA: false,
    location: '',
    purpose: '',
    returnClassification: 'non-returnable',
    expectedReturnDate: '',
    remarks: ''
  });

  // Return Form
  const [returnForm, setReturnForm] = useState({
    storeId: '',
    outwardId: '',
    returnType: 'BORROWED',
    returnDate: new Date().toISOString().split('T')[0],
    returnedByPerson: '',
    acceptedQuantity: 1,
    damagedQuantity: 0,
    missingQuantity: 0,
    remarks: ''
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState({
    sourceStoreId: '',
    destinationStoreId: '',
    materialId: '',
    quantity: 1,
    transferDate: new Date().toISOString().split('T')[0],
    reference: '',
    remarks: ''
  });

  // Verification Form
  const [verificationForm, setVerificationForm] = useState({
    storeId: '',
    materialId: '',
    physicalQuantity: 0,
    verificationDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Adjustment Form
  const [adjustmentForm, setAdjustmentForm] = useState({
    storeId: '',
    materialId: '',
    adjustmentType: 'ADD',
    quantity: 1,
    reason: '',
    verificationId: ''
  });

  // Incident Form
  const [incidentForm, setIncidentForm] = useState({
    storeId: '',
    incidentType: 'Missing',
    materialId: '',
    quantity: 1,
    date: new Date().toISOString().split('T')[0],
    description: '',
    reportedBy: ''
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. INITIAL LOAD & PROJECT CONTEXT
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const res = await generalInventoryApi.getProjects();
      const list = res.data || [];
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId((prev) => {
          if (prev && list.some((p) => (p.id || p._id) === prev)) return prev;
          return list[0].id || list[0]._id;
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error fetching projects');
    } finally {
      setIsLoading(false);
    }
  };

  // When selected project changes, load stores and module data
  useEffect(() => {
    if (!selectedProjectId) {
      setStores([]);
      setSelectedStoreId('');
      setMaterials([]);
      return;
    }
    loadStoresAndData();
  }, [selectedProjectId]);

  const loadStoresAndData = async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [storesRes, materialsRes] = await Promise.all([
        generalInventoryApi.getStores(selectedProjectId),
        generalInventoryApi.getMaterials(selectedProjectId, { storeId: selectedStoreId })
      ]);

      const storeList = storesRes.data || [];
      setStores(storeList);

      // Auto-select first store if none selected
      if (!selectedStoreId && storeList.length > 0) {
        // keep selectedStoreId as '' (All stores) or default store
      }

      setMaterials(materialsRes.data || []);
      refreshActiveTabData();
    } catch (err) {
      setErrorMsg(err.message || 'Error loading inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch tab data when tab or store selection changes
  useEffect(() => {
    if (selectedProjectId) {
      refreshActiveTabData();
    }
  }, [activeTab, selectedStoreId]);

  const refreshActiveTabData = async () => {
    if (!selectedProjectId) return;
    try {
      if (activeTab === 'overview' || activeTab === 'materials') {
        const res = await generalInventoryApi.getMaterials(selectedProjectId, { storeId: selectedStoreId });
        setMaterials(res.data || []);
      } else if (activeTab === 'inward') {
        const res = await generalInventoryApi.getInwardEntries(selectedProjectId, { storeId: selectedStoreId });
        setInwardEntries(res.data || []);
      } else if (activeTab === 'outward') {
        const res = await generalInventoryApi.getOutwardEntries(selectedProjectId, { storeId: selectedStoreId });
        setOutwardEntries(res.data || []);
      } else if (activeTab === 'returns') {
        const [retRes, eligRes] = await Promise.all([
          generalInventoryApi.getReturns(selectedProjectId, { storeId: selectedStoreId }),
          generalInventoryApi.getEligibleReturnable(selectedProjectId, selectedStoreId)
        ]);
        setReturnsEntries(retRes.data || []);
        setEligibleOutward(eligRes.data || []);
      } else if (activeTab === 'transfers') {
        const res = await generalInventoryApi.getTransfers(selectedProjectId);
        setTransfers(res.data || []);
      } else if (activeTab === 'audit') {
        const [verRes, adjRes, incRes] = await Promise.all([
          generalInventoryApi.getVerifications(selectedProjectId, selectedStoreId),
          generalInventoryApi.getAdjustments(selectedProjectId, selectedStoreId),
          generalInventoryApi.getIncidents(selectedProjectId, { storeId: selectedStoreId })
        ]);
        setVerifications(verRes.data || []);
        setAdjustments(adjRes.data || []);
        setIncidents(incRes.data || []);
      } else if (activeTab === 'reports') {
        loadReportData(reportType);
      }
    } catch (err) {
      console.warn('Tab refresh error:', err);
    }
  };

  const loadReportData = async (type) => {
    if (!selectedProjectId) return;
    setReportLoading(true);
    try {
      const res = await generalInventoryApi.getReport(selectedProjectId, type, { storeId: selectedStoreId });
      setReportData(res.data || null);
    } catch (err) {
      setErrorMsg(err.message || 'Error generating report');
    } finally {
      setReportLoading(false);
    }
  };

  // Auto-clear success message after 4s
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. METRICS & COMPUTED VALUES
  // ──────────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalMaterials = materials.length;
    let normalCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    materials.forEach((m) => {
      if (m.status === 'OUT_OF_STOCK') outOfStockCount++;
      else if (m.status === 'LOW_STOCK') lowStockCount++;
      else normalCount++;
    });

    return { totalMaterials, normalCount, lowStockCount, outOfStockCount };
  }, [materials]);

  // Overdue Borrowed Items Count
  const overdueBorrowedCount = useMemo(() => {
    const now = new Date();
    return outwardEntries.filter((o) => {
      if (o.returnClassification === 'returnable' && o.outstandingQuantity > 0 && o.expectedReturnDate) {
        return new Date(o.expectedReturnDate) < now;
      }
      return false;
    }).length;
  }, [outwardEntries]);

  // Filtered Materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesSearch =
        !searchQuery ||
        m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.materialCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.brandOrModel?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = !categoryFilter || m.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [materials, searchQuery, categoryFilter]);

  // Active Project & Store Names
  const activeProject = projects.find((p) => (p.id || p._id) === selectedProjectId);
  const activeStore = stores.find((s) => (s.id || s._id) === selectedStoreId);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ACTION HANDLERS
  // ──────────────────────────────────────────────────────────────────────────

  // Create Project
  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await generalInventoryApi.createProject(projectForm);
      setSuccessMsg(`Project "${projectForm.name}" created successfully.`);
      setShowProjectModal(false);
      setProjectForm({ name: '', code: '', description: '', address: '' });
      await loadProjects();
      if (res.data?.id) setSelectedProjectId(res.data.id);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create project');
    }
  };

  // Create Store
  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    try {
      const res = await generalInventoryApi.createStore(selectedProjectId, storeForm);
      setSuccessMsg(`Store "${storeForm.name}" created successfully.`);
      setShowStoreModal(false);
      setStoreForm({ name: '', code: '', location: '' });
      await loadStoresAndData();
      if (res.data?.id) setSelectedStoreId(res.data.id);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create store');
    }
  };

  // Create / Update Material
  const handleSaveMaterial = async (e, forceDuplicate = false) => {
    if (e) e.preventDefault();
    if (!selectedProjectId) {
      setErrorMsg('Please select or create a project before registering materials.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      if (editingMaterial) {
        await generalInventoryApi.updateMaterial(selectedProjectId, editingMaterial.id || editingMaterial._id, materialForm);
        setSuccessMsg(`Material "${materialForm.name}" updated successfully.`);
      } else {
        const payload = { ...materialForm, forceDuplicateConfirmed: forceDuplicate };
        const res = await generalInventoryApi.createMaterial(selectedProjectId, payload);

        if (res.isDuplicateWarning) {
          setDuplicateWarning(res);
          return;
        }
        setSuccessMsg(`Material "${materialForm.name}" registered successfully.`);
      }

      setShowMaterialModal(false);
      setEditingMaterial(null);
      setDuplicateWarning(null);
      setMaterialForm({
        name: '',
        category: 'Electrical',
        subcategory: '',
        uom: 'Nos',
        lowStockThreshold: 5,
        materialCode: '',
        brandOrModel: '',
        sizeOrSpec: '',
        description: '',
        preferredVendor: '',
        remarks: ''
      });
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save material');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Deactivate Material
  const handleDeactivateMaterial = async (mat) => {
    const isDeactivating = mat.isActive !== false;
    const confirmText = isDeactivating
      ? `Are you sure you want to deactivate "${mat.name}"? Historical stock transactions will be preserved.`
      : `Reactivate "${mat.name}"?`;

    if (!window.confirm(confirmText)) return;

    try {
      if (isDeactivating) {
        const res = await generalInventoryApi.deleteMaterial(selectedProjectId, mat.id || mat._id);
        setSuccessMsg(res.message || 'Material deactivated.');
      } else {
        await generalInventoryApi.updateMaterial(selectedProjectId, mat.id || mat._id, { isActive: true });
        setSuccessMsg(`Material "${mat.name}" reactivated.`);
      }
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Operation failed');
    }
  };

  // Set Explicit Opening Balance
  const handleSaveOpeningBalance = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || !openingMaterial) return;

    try {
      await generalInventoryApi.setOpeningBalance(selectedProjectId, {
        storeId: openingForm.storeId || stores[0]?.id || stores[0]?._id,
        materialId: openingMaterial.id || openingMaterial._id,
        quantity: Number(openingForm.quantity),
        remarks: openingForm.remarks
      });
      setSuccessMsg(`Opening balance for "${openingMaterial.name}" set to ${openingForm.quantity} ${openingMaterial.uom}.`);
      setShowOpeningModal(false);
      setOpeningMaterial(null);
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to set opening balance');
    }
  };

  // Record Inward Receipt
  const handleSaveInward = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    // Filter valid items
    const validItems = inwardForm.items.filter((it) => it.materialId && (Number(it.receivedQuantity) > 0 || Number(it.acceptedQuantity) > 0));
    if (validItems.length === 0) {
      setErrorMsg('Please select at least one material with received quantity.');
      return;
    }

    try {
      const payload = {
        ...inwardForm,
        storeId: inwardForm.storeId || stores[0]?.id || stores[0]?._id,
        items: validItems
      };
      const res = await generalInventoryApi.createInwardEntry(selectedProjectId, payload);
      setSuccessMsg(`Inward entry ${res.data?.inwardNumber || ''} posted successfully.`);
      setShowInwardModal(false);
      resetInwardForm();
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record inward receipt');
    }
  };

  const resetInwardForm = () => {
    setInwardForm({
      storeId: stores[0]?.id || stores[0]?._id || '',
      receiptDate: new Date().toISOString().split('T')[0],
      vendorName: '',
      vendorContact: '',
      vendorChallanNumber: '',
      invoiceNumber: '',
      remarks: '',
      items: [{ materialId: '', receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, rejectedQuantity: 0, unitPrice: 0, remarks: '' }]
    });
  };

  // Record Outward Issue
  const handleSaveOutward = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    try {
      const payload = {
        ...outwardForm,
        storeId: outwardForm.storeId || stores[0]?.id || stores[0]?._id,
        agency: outwardForm.isAgencyNA ? 'Not Applicable' : outwardForm.agency
      };
      const res = await generalInventoryApi.createOutwardEntry(selectedProjectId, payload);
      setSuccessMsg(`Outward issue ${res.data?.outwardNumber || ''} posted successfully.`);
      setShowOutwardModal(false);
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to issue material');
    }
  };

  // Record Return
  const handleSaveReturn = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    try {
      const res = await generalInventoryApi.createReturn(selectedProjectId, returnForm);
      setSuccessMsg(`Return ${res.data?.returnNumber || ''} recorded successfully.`);
      setShowReturnModal(false);
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record return');
    }
  };

  // Record Inter-Store Transfer
  const handleSaveTransfer = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    if (transferForm.sourceStoreId === transferForm.destinationStoreId) {
      setErrorMsg('Source and destination stores must be different.');
      return;
    }

    try {
      const res = await generalInventoryApi.createTransfer(selectedProjectId, transferForm);
      setSuccessMsg(`Transfer ${res.data?.transferNumber || ''} processed successfully.`);
      setShowTransferModal(false);
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Transfer failed');
    }
  };

  // Record Physical Verification
  const handleSaveVerification = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    try {
      await generalInventoryApi.createVerification(selectedProjectId, {
        ...verificationForm,
        storeId: verificationForm.storeId || stores[0]?.id || stores[0]?._id
      });
      setSuccessMsg('Physical stock verification recorded.');
      setShowVerificationModal(false);
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Verification audit failed');
    }
  };

  // Record Stock Adjustment
  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    try {
      const res = await generalInventoryApi.createAdjustment(selectedProjectId, {
        ...adjustmentForm,
        storeId: adjustmentForm.storeId || stores[0]?.id || stores[0]?._id
      });
      setSuccessMsg(`Authorized Adjustment ${res.data?.adjustmentNumber || ''} completed.`);
      setShowAdjustmentModal(false);
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Adjustment failed');
    }
  };

  // Record Incident
  const handleSaveIncident = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    try {
      const res = await generalInventoryApi.reportIncident(selectedProjectId, {
        ...incidentForm,
        storeId: incidentForm.storeId || stores[0]?.id || stores[0]?._id,
        reportedBy: incidentForm.reportedBy || user?.firstName || 'Store User'
      });
      setSuccessMsg(`Incident ${res.data?.incidentNumber || ''} reported. Stock remains intact until formal adjustment.`);
      setShowIncidentModal(false);
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to report incident');
    }
  };

  // CSV Export Helper
  const exportToCSV = (filename, rows) => {
    if (!rows || rows.length === 0) {
      alert('No data available to export.');
      return;
    }
    const headers = Object.keys(rows[0]).filter((k) => k !== '_id' && k !== 'id' && typeof rows[0][k] !== 'object');
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const val = row[h] !== undefined && row[h] !== null ? String(row[h]).replace(/"/g, '""') : '';
              return `"${val}"`;
            })
            .join(',')
        )
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 4. RENDER MODALS
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="gi-container">
      {/* ── Context & Navigation Header ── */}
      <div className="gi-header">
        <div className="gi-title-area">
          <div className="gi-title-icon">
            <Warehouse size={24} />
          </div>
          <div>
            <h1>General Inventory</h1>
            <p>Storekeeper register, project-wise stock, traceable inward/outward & returns</p>
          </div>
        </div>

        <div className="gi-context-selectors">
          {/* Project Selector */}
          <div className="gi-select-group">
            <Building2 size={16} color="var(--accent)" />
            <label>Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={isLoading || projects.length === 0}
            >
              {projects.length === 0 && <option value="">No Project (Click + to add)</option>}
              {projects.map((p) => (
                <option key={p.id || p._id} value={p.id || p._id}>
                  {p.name} {p.code ? `(${p.code})` : ''}
                </option>
              ))}
            </select>
            <button className="gi-btn-sm" onClick={() => setShowProjectModal(true)} title="Add New Project">
              <Plus size={14} />
            </button>
          </div>

          {/* Store Selector */}
          <div className="gi-select-group">
            <Store size={16} color="var(--accent)" />
            <label>Store</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              disabled={isLoading || stores.length === 0}
            >
              <option value="">All Project Stores ({stores.length})</option>
              {stores.map((s) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.name} {s.isDefault ? '(Main)' : ''}
                </option>
              ))}
            </select>
            <button
              className="gi-btn-sm"
              onClick={() => {
                setStoreForm({ name: '', code: '', location: activeProject?.address || '' });
                setShowStoreModal(true);
              }}
              title="Add New Store to Project"
            >
              <Plus size={14} />
            </button>
          </div>

          <button className="gi-btn-sm" onClick={loadStoresAndData} title="Refresh Live Inventory Data">
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ── System Feedback Alerts ── */}
      {errorMsg && (
        <div className="gi-alert-banner danger">
          <div className="gi-alert-content">
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
          <button className="gi-modal-close" onClick={() => setErrorMsg('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="gi-alert-banner" style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)', color: '#047857' }}>
          <div className="gi-alert-content">
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
          <button className="gi-modal-close" onClick={() => setSuccessMsg('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── No Project Alert Banner ── */}
      {projects.length === 0 && !isLoading && (
        <div className="gi-alert-banner warning">
          <div className="gi-alert-content">
            <Building2 size={20} />
            <span>
              <strong>Welcome to General Inventory:</strong> No construction project is selected yet. Click to create or load your project.
            </span>
          </div>
          <button className="gi-btn-sm" onClick={() => setShowProjectModal(true)}>
            + Create New Project
          </button>
        </div>
      )}

      {/* ── Overdue Tools Alert Banner ── */}
      {overdueBorrowedCount > 0 && (
        <div className="gi-alert-banner danger">
          <div className="gi-alert-content">
            <ShieldAlert size={20} />
            <span>
              <strong>ATTENTION:</strong> {overdueBorrowedCount} returnable tool(s)/asset(s) are past their expected return date!
            </span>
          </div>
          <button className="gi-btn-sm" onClick={() => setActiveTab('returns')} style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#b91c1c' }}>
            Inspect Overdue Items
          </button>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      <div className="gi-kpi-grid">
        <div className="gi-kpi-card">
          <div className="gi-kpi-icon primary">
            <Package size={24} />
          </div>
          <div className="gi-kpi-info">
            <span className="gi-kpi-label">Registered Materials</span>
            <span className="gi-kpi-value">{kpis.totalMaterials}</span>
          </div>
        </div>

        <div className="gi-kpi-card">
          <div className="gi-kpi-icon success">
            <CheckCircle2 size={24} />
          </div>
          <div className="gi-kpi-info">
            <span className="gi-kpi-label">Normal Stock</span>
            <span className="gi-kpi-value">{kpis.normalCount}</span>
          </div>
        </div>

        <div className="gi-kpi-card">
          <div className="gi-kpi-icon warning">
            <AlertTriangle size={24} />
          </div>
          <div className="gi-kpi-info">
            <span className="gi-kpi-label">Low-Stock Alert</span>
            <span className="gi-kpi-value">{kpis.lowStockCount}</span>
          </div>
        </div>

        <div className="gi-kpi-card">
          <div className="gi-kpi-icon danger">
            <Clock size={24} />
          </div>
          <div className="gi-kpi-info">
            <span className="gi-kpi-label">Out of Stock</span>
            <span className="gi-kpi-value">{kpis.outOfStockCount}</span>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="gi-tabs-container">
        <button className={`gi-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <Layers size={16} />
          <span>Stock Overview</span>
        </button>

        <button className={`gi-tab-btn ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
          <Tag size={16} />
          <span>Material Register</span>
        </button>

        <button className={`gi-tab-btn ${activeTab === 'inward' ? 'active' : ''}`} onClick={() => setActiveTab('inward')}>
          <ArrowDownLeft size={16} />
          <span>Inward Goods (GRN)</span>
        </button>

        <button className={`gi-tab-btn ${activeTab === 'outward' ? 'active' : ''}`} onClick={() => setActiveTab('outward')}>
          <ArrowUpRight size={16} />
          <span>Outward Issues</span>
        </button>

        <button className={`gi-tab-btn ${activeTab === 'returns' ? 'active' : ''}`} onClick={() => setActiveTab('returns')}>
          <RotateCcw size={16} />
          <span>Returns & Borrowed</span>
          {overdueBorrowedCount > 0 && <span className="gi-tab-badge">{overdueBorrowedCount}</span>}
        </button>

        <button className={`gi-tab-btn ${activeTab === 'transfers' ? 'active' : ''}`} onClick={() => setActiveTab('transfers')}>
          <ArrowRightLeft size={16} />
          <span>Store Transfers</span>
        </button>

        <button className={`gi-tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
          <ClipboardCheck size={16} />
          <span>Audit & Incidents</span>
        </button>

        <button className={`gi-tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
          <FileText size={16} />
          <span>Reports & Ledger</span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 1: STOCK OVERVIEW
         ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="gi-workspace">
          <div className="gi-toolbar">
            <div className="gi-toolbar-left">
              <div className="gi-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search material name, code, category, brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select className="gi-filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All Categories</option>
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="gi-toolbar-right">
              <button
                className="gi-btn-secondary"
                onClick={() => {
                  resetInwardForm();
                  setShowInwardModal(true);
                }}
              >
                <ArrowDownLeft size={16} />
                <span>Inward Entry</span>
              </button>

              <button
                className="gi-btn-secondary"
                onClick={() => {
                  setOutwardForm({
                    storeId: selectedStoreId || stores[0]?.id || stores[0]?._id || '',
                    issueDateTime: new Date().toISOString().slice(0, 16),
                    materialId: materials[0]?.id || materials[0]?._id || '',
                    quantity: 1,
                    personReceiving: '',
                    agency: '',
                    isAgencyNA: false,
                    location: '',
                    purpose: '',
                    returnClassification: 'non-returnable',
                    expectedReturnDate: '',
                    remarks: ''
                  });
                  setShowOutwardModal(true);
                }}
              >
                <ArrowUpRight size={16} />
                <span>Issue Outward</span>
              </button>

              <button
                className="gi-btn-primary"
                onClick={() => {
                  setEditingMaterial(null);
                  setDuplicateWarning(null);
                  setMaterialForm({
                    name: '',
                    category: 'Electrical',
                    subcategory: '',
                    uom: 'Nos',
                    lowStockThreshold: 5,
                    materialCode: '',
                    brandOrModel: '',
                    sizeOrSpec: '',
                    description: '',
                    preferredVendor: '',
                    remarks: ''
                  });
                  setShowMaterialModal(true);
                }}
              >
                <Plus size={16} />
                <span>New Material</span>
              </button>
            </div>
          </div>

          <div className="gi-table-card">
            <div className="gi-table-wrapper">
              <table className="gi-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Category</th>
                    <th>Specification / Brand</th>
                    <th>Current Balance</th>
                    <th>Threshold</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="gi-empty-state">
                          <Package size={40} />
                          <h3>No Materials Found</h3>
                          <p>
                            {searchQuery || categoryFilter
                              ? 'No materials match the filter criteria.'
                              : 'Create materials to start tracking stock across project stores.'}
                          </p>
                          <button
                            className="gi-btn-primary"
                            onClick={() => {
                              setEditingMaterial(null);
                              setShowMaterialModal(true);
                            }}
                          >
                            <Plus size={16} />
                            <span>Register First Material</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((m) => (
                      <tr key={m.id || m._id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{m.name}</div>
                          {m.materialCode && <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>Code: {m.materialCode}</div>}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{m.category}</span>
                          {m.subcategory && <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{m.subcategory}</div>}
                        </td>
                        <td>
                          <div>{m.sizeOrSpec || 'Standard'}</div>
                          {m.brandOrModel && <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>Brand: {m.brandOrModel}</div>}
                        </td>
                        <td>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                            {m.currentStock} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-label)' }}>{m.uom}</span>
                          </div>
                        </td>
                        <td>
                          {m.lowStockThreshold} {m.uom}
                        </td>
                        <td>
                          {m.status === 'OUT_OF_STOCK' ? (
                            <span className="gi-badge out">Out of Stock</span>
                          ) : m.status === 'LOW_STOCK' ? (
                            <span className="gi-badge low">Low Stock</span>
                          ) : (
                            <span className="gi-badge normal">Normal</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button
                              className="gi-btn-sm"
                              title="Set Opening Balance"
                              onClick={() => {
                                setOpeningMaterial(m);
                                setOpeningForm({
                                  storeId: selectedStoreId || stores[0]?.id || stores[0]?._id || '',
                                  quantity: m.currentStock || 0,
                                  remarks: ''
                                });
                                setShowOpeningModal(true);
                              }}
                            >
                              Opening
                            </button>
                            <button
                              className="gi-btn-sm"
                              title="Quick Inward"
                              onClick={() => {
                                resetInwardForm();
                                setInwardForm((prev) => ({
                                  ...prev,
                                  storeId: selectedStoreId || stores[0]?.id || stores[0]?._id || '',
                                  items: [{ materialId: m.id || m._id, receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, rejectedQuantity: 0, unitPrice: 0, remarks: '' }]
                                }));
                                setShowInwardModal(true);
                              }}
                            >
                              + Inward
                            </button>
                            <button
                              className="gi-btn-sm"
                              title="Quick Issue"
                              onClick={() => {
                                setOutwardForm({
                                  storeId: selectedStoreId || stores[0]?.id || stores[0]?._id || '',
                                  issueDateTime: new Date().toISOString().slice(0, 16),
                                  materialId: m.id || m._id,
                                  quantity: 1,
                                  personReceiving: '',
                                  agency: '',
                                  isAgencyNA: false,
                                  location: '',
                                  purpose: '',
                                  returnClassification: 'non-returnable',
                                  expectedReturnDate: '',
                                  remarks: ''
                                });
                                setShowOutwardModal(true);
                              }}
                            >
                              - Issue
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 2: MATERIAL REGISTER
         ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'materials' && (
        <div className="gi-workspace">
          <div className="gi-toolbar">
            <div className="gi-toolbar-left">
              <div className="gi-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Filter registered materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select className="gi-filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All Categories</option>
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="gi-toolbar-right">
              <button
                className="gi-btn-primary"
                onClick={() => {
                  setEditingMaterial(null);
                  setDuplicateWarning(null);
                  setMaterialForm({
                    name: '',
                    category: 'Electrical',
                    subcategory: '',
                    uom: 'Nos',
                    lowStockThreshold: 5,
                    materialCode: '',
                    brandOrModel: '',
                    sizeOrSpec: '',
                    description: '',
                    preferredVendor: '',
                    remarks: ''
                  });
                  setShowMaterialModal(true);
                }}
              >
                <Plus size={16} />
                <span>Register Material</span>
              </button>
            </div>
          </div>

          <div className="gi-table-card">
            <div className="gi-table-wrapper">
              <table className="gi-table">
                <thead>
                  <tr>
                    <th>Material Name & Code</th>
                    <th>Category & Subcategory</th>
                    <th>Unit (UOM)</th>
                    <th>Low Threshold</th>
                    <th>Specification / Brand</th>
                    <th>Preferred Vendor</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem' }}>
                        No material records found.
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((m) => (
                      <tr key={m.id || m._id} style={{ opacity: m.isActive === false ? 0.65 : 1 }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{m.materialCode || 'No Code'}</div>
                        </td>
                        <td>
                          <div>{m.category}</div>
                          {m.subcategory && <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{m.subcategory}</div>}
                        </td>
                        <td>
                          <strong>{m.uom}</strong>
                        </td>
                        <td>
                          {m.lowStockThreshold} {m.uom}
                        </td>
                        <td>
                          <div>{m.sizeOrSpec || 'Standard'}</div>
                          {m.brandOrModel && <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{m.brandOrModel}</div>}
                        </td>
                        <td>{m.preferredVendor || '—'}</td>
                        <td>
                          {m.isActive !== false ? (
                            <span className="gi-badge normal">Active</span>
                          ) : (
                            <span className="gi-badge non-returnable">Deactivated</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              className="gi-btn-sm"
                              onClick={() => {
                                setEditingMaterial(m);
                                setMaterialForm({
                                  name: m.name || '',
                                  category: m.category || 'Electrical',
                                  subcategory: m.subcategory || '',
                                  uom: m.uom || 'Nos',
                                  lowStockThreshold: m.lowStockThreshold ?? 5,
                                  materialCode: m.materialCode || '',
                                  brandOrModel: m.brandOrModel || '',
                                  sizeOrSpec: m.sizeOrSpec || '',
                                  description: m.description || '',
                                  preferredVendor: m.preferredVendor || '',
                                  remarks: m.remarks || ''
                                });
                                setShowMaterialModal(true);
                              }}
                              title="Edit Material"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>

                            <button
                              className="gi-btn-sm"
                              onClick={() => handleDeactivateMaterial(m)}
                              title={m.isActive !== false ? 'Deactivate (Preserve History)' : 'Reactivate'}
                              style={{ color: m.isActive !== false ? '#ef4444' : '#10b981' }}
                            >
                              {m.isActive !== false ? <Trash2 size={13} /> : <CheckCircle2 size={13} />}
                              <span>{m.isActive !== false ? 'Deactivate' : 'Reactivate'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 3: INWARD RECEIPTS
         ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'inward' && (
        <div className="gi-workspace">
          <div className="gi-toolbar">
            <div className="gi-toolbar-left">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Inward Goods Receipts (GRN Register)
              </h3>
            </div>

            <div className="gi-toolbar-right">
              <button
                className="gi-btn-primary"
                onClick={() => {
                  resetInwardForm();
                  setShowInwardModal(true);
                }}
              >
                <Plus size={16} />
                <span>New Inward Delivery</span>
              </button>
            </div>
          </div>

          <div className="gi-table-card">
            <div className="gi-table-wrapper">
              <table className="gi-table">
                <thead>
                  <tr>
                    <th>Inward Entry #</th>
                    <th>Receipt Date</th>
                    <th>Vendor Name</th>
                    <th>Vendor Challan #</th>
                    <th>Bill / Invoice #</th>
                    <th>Materials Received</th>
                    <th>Received By</th>
                    <th style={{ textAlign: 'right' }}>Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {inwardEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem' }}>
                        No inward goods receipts recorded yet.
                      </td>
                    </tr>
                  ) : (
                    inwardEntries.map((inw) => (
                      <tr key={inw.id || inw._id}>
                        <td>
                          <strong style={{ color: 'var(--accent)' }}>{inw.inwardNumber}</strong>
                        </td>
                        <td>{inw.receiptDate ? new Date(inw.receiptDate).toLocaleDateString() : '—'}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{inw.vendorName}</div>
                          {inw.vendorContact && <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{inw.vendorContact}</div>}
                        </td>
                        <td>{inw.vendorChallanNumber}</td>
                        <td>{inw.invoiceNumber || '—'}</td>
                        <td>
                          {(inw.items || []).map((it, idx) => (
                            <div key={idx} style={{ fontSize: '0.825rem' }}>
                              • {it.materialName}: <strong>{it.acceptedQuantity}</strong> {it.uom} accepted
                              {it.damagedQuantity > 0 && <span style={{ color: '#f59e0b' }}> ({it.damagedQuantity} damaged)</span>}
                              {it.rejectedQuantity > 0 && <span style={{ color: '#ef4444' }}> ({it.rejectedQuantity} rejected)</span>}
                            </div>
                          ))}
                        </td>
                        <td>{inw.receivedBy?.name || 'Store Keeper'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="gi-btn-sm"
                            onClick={() => setActiveSlip({ type: 'INWARD', data: inw })}
                            title="Print Goods Receipt Slip"
                          >
                            <Printer size={13} />
                            <span>Slip</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 4: OUTWARD ISSUES
         ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'outward' && (
        <div className="gi-workspace">
          <div className="gi-toolbar">
            <div className="gi-toolbar-left">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Outward Material Issues Register
              </h3>
            </div>

            <div className="gi-toolbar-right">
              <button
                className="gi-btn-primary"
                onClick={() => {
                  setOutwardForm({
                    storeId: selectedStoreId || stores[0]?.id || stores[0]?._id || '',
                    issueDateTime: new Date().toISOString().slice(0, 16),
                    materialId: materials[0]?.id || materials[0]?._id || '',
                    quantity: 1,
                    personReceiving: '',
                    agency: '',
                    isAgencyNA: false,
                    location: '',
                    purpose: '',
                    returnClassification: 'non-returnable',
                    expectedReturnDate: '',
                    remarks: ''
                  });
                  setShowOutwardModal(true);
                }}
              >
                <Plus size={16} />
                <span>New Outward Issue</span>
              </button>
            </div>
          </div>

          <div className="gi-table-card">
            <div className="gi-table-wrapper">
              <table className="gi-table">
                <thead>
                  <tr>
                    <th>Outward #</th>
                    <th>Date & Time</th>
                    <th>Material Issued</th>
                    <th>Issued To</th>
                    <th>Agency</th>
                    <th>Location / Purpose</th>
                    <th>Classification</th>
                    <th>Return Status</th>
                    <th style={{ textAlign: 'right' }}>Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {outwardEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem' }}>
                        No outward material issues recorded yet.
                      </td>
                    </tr>
                  ) : (
                    outwardEntries.map((out) => {
                      const isReturnable = out.returnClassification === 'returnable';
                      const isOverdue =
                        isReturnable && out.outstandingQuantity > 0 && out.expectedReturnDate && new Date(out.expectedReturnDate) < new Date();

                      return (
                        <tr key={out.id || out._id}>
                          <td>
                            <strong style={{ color: 'var(--accent)' }}>{out.outwardNumber}</strong>
                          </td>
                          <td>{out.issueDateTime ? new Date(out.issueDateTime).toLocaleString() : '—'}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{out.materialName}</div>
                            <div>
                              <strong>{out.quantity}</strong> {out.uom}
                            </div>
                          </td>
                          <td>
                            <div>{out.personReceiving}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>Issued by: {out.issuedBy?.name}</div>
                          </td>
                          <td>{out.agency || 'Not Applicable'}</td>
                          <td>
                            <div>{out.location}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{out.purpose}</div>
                          </td>
                          <td>
                            {isReturnable ? (
                              <span className="gi-badge returnable">Returnable</span>
                            ) : (
                              <span className="gi-badge non-returnable">Non-Returnable</span>
                            )}
                          </td>
                          <td>
                            {isReturnable ? (
                              <div>
                                {out.outstandingQuantity === 0 ? (
                                  <span className="gi-badge normal">Fully Returned</span>
                                ) : isOverdue ? (
                                  <span className="gi-badge overdue">
                                    Overdue ({out.outstandingQuantity} {out.uom})
                                  </span>
                                ) : (
                                  <span className="gi-badge low">
                                    Borrowed: {out.outstandingQuantity} {out.uom}
                                  </span>
                                )}
                                {out.expectedReturnDate && (
                                  <div style={{ fontSize: '0.725rem', color: isOverdue ? '#ef4444' : 'var(--text-label)' }}>
                                    Due: {new Date(out.expectedReturnDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Consumable</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="gi-btn-sm"
                              onClick={() => setActiveSlip({ type: 'OUTWARD', data: out })}
                              title="Print Outward Slip"
                            >
                              <Printer size={13} />
                              <span>Slip</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 5: MATERIAL RETURNS
         ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'returns' && (
        <div className="gi-workspace">
          <div className="gi-toolbar">
            <div className="gi-toolbar-left">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Material Returns & Borrowed Item Tracking
              </h3>
            </div>

            <div className="gi-toolbar-right">
              <button
                className="gi-btn-primary"
                onClick={() => {
                  if (eligibleOutward.length === 0) {
                    alert('No outstanding outward issues available to record a return against.');
                    return;
                  }
                  const firstElig = eligibleOutward[0];
                  setReturnForm({
                    storeId: firstElig.storeId || stores[0]?.id || stores[0]?._id,
                    outwardId: firstElig.id || firstElig._id,
                    returnType: firstElig.returnClassification === 'returnable' ? 'BORROWED' : 'UNUSED',
                    returnDate: new Date().toISOString().split('T')[0],
                    returnedByPerson: firstElig.personReceiving || '',
                    acceptedQuantity: firstElig.outstandingQuantity || 1,
                    damagedQuantity: 0,
                    missingQuantity: 0,
                    remarks: ''
                  });
                  setShowReturnModal(true);
                }}
              >
                <RotateCcw size={16} />
                <span>Record Return</span>
              </button>
            </div>
          </div>

          <div className="gi-table-card">
            <div className="gi-table-wrapper">
              <table className="gi-table">
                <thead>
                  <tr>
                    <th>Return Ref #</th>
                    <th>Return Date</th>
                    <th>Outward Reference</th>
                    <th>Material</th>
                    <th>Type</th>
                    <th>Accepted (Usable)</th>
                    <th>Damaged / Missing</th>
                    <th>Returned By</th>
                    <th>Received By</th>
                  </tr>
                </thead>
                <tbody>
                  {returnsEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem' }}>
                        No material returns logged yet.
                      </td>
                    </tr>
                  ) : (
                    returnsEntries.map((ret) => (
                      <tr key={ret.id || ret._id}>
                        <td>
                          <strong style={{ color: 'var(--accent)' }}>{ret.returnNumber}</strong>
                        </td>
                        <td>{ret.returnDate ? new Date(ret.returnDate).toLocaleDateString() : '—'}</td>
                        <td>
                          <strong>{ret.outwardNumber}</strong>
                        </td>
                        <td>{ret.materialName}</td>
                        <td>
                          {ret.returnType === 'BORROWED' ? (
                            <span className="gi-badge returnable">Borrowed Tool Return</span>
                          ) : (
                            <span className="gi-badge normal">Unused Consumable Return</span>
                          )}
                        </td>
                        <td>
                          <strong style={{ color: '#10b981' }}>{ret.acceptedQuantity}</strong> {ret.uom}
                        </td>
                        <td>
                          {ret.damagedQuantity > 0 && <span style={{ color: '#f59e0b' }}>{ret.damagedQuantity} damaged </span>}
                          {ret.missingQuantity > 0 && <span style={{ color: '#ef4444' }}>{ret.missingQuantity} missing</span>}
                          {ret.damagedQuantity === 0 && ret.missingQuantity === 0 && '—'}
                        </td>
                        <td>{ret.returnedByPerson}</td>
                        <td>{ret.receivedBy?.name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 6: STORE TRANSFERS
         ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'transfers' && (
        <div className="gi-workspace">
          <div className="gi-toolbar">
            <div className="gi-toolbar-left">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Inter-Store Transfers (Within Same Project Only)
              </h3>
            </div>

            <div className="gi-toolbar-right">
              <button
                className="gi-btn-primary"
                onClick={() => {
                  if (stores.length < 2) {
                    alert('At least two stores are required in this project to perform an inter-store transfer.');
                    return;
                  }
                  setTransferForm({
                    sourceStoreId: stores[0]?.id || stores[0]?._id,
                    destinationStoreId: stores[1]?.id || stores[1]?._id,
                    materialId: materials[0]?.id || materials[0]?._id || '',
                    quantity: 1,
                    transferDate: new Date().toISOString().split('T')[0],
                    reference: '',
                    remarks: ''
                  });
                  setShowTransferModal(true);
                }}
              >
                <ArrowRightLeft size={16} />
                <span>New Store Transfer</span>
              </button>
            </div>
          </div>

          <div className="gi-table-card">
            <div className="gi-table-wrapper">
              <table className="gi-table">
                <thead>
                  <tr>
                    <th>Transfer Ref #</th>
                    <th>Date</th>
                    <th>Source Store</th>
                    <th>Destination Store</th>
                    <th>Material</th>
                    <th>Quantity</th>
                    <th>Responsible User</th>
                    <th>Transfer Ref / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem' }}>
                        No inter-store transfers recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((trf) => (
                      <tr key={trf.id || trf._id}>
                        <td>
                          <strong style={{ color: 'var(--accent)' }}>{trf.transferNumber}</strong>
                        </td>
                        <td>{trf.transferDate ? new Date(trf.transferDate).toLocaleDateString() : '—'}</td>
                        <td>
                          <span className="gi-badge out">{trf.sourceStoreName}</span>
                        </td>
                        <td>
                          <span className="gi-badge normal">{trf.destinationStoreName}</span>
                        </td>
                        <td>{trf.materialName}</td>
                        <td>
                          <strong>{trf.quantity}</strong> {trf.uom}
                        </td>
                        <td>{trf.responsibleUser?.name}</td>
                        <td>{trf.reference || trf.remarks || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 7: AUDIT, VERIFICATION & INCIDENTS
         ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="gi-workspace">
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
            <button
              className={`gi-btn-sm ${auditSubTab === 'verification' ? 'active' : ''}`}
              style={{ background: auditSubTab === 'verification' ? 'rgba(5, 150, 105, 0.15)' : 'transparent' }}
              onClick={() => setAuditSubTab('verification')}
            >
              1. Physical Stock Verification Audit
            </button>
            <button
              className={`gi-btn-sm ${auditSubTab === 'adjustments' ? 'active' : ''}`}
              style={{ background: auditSubTab === 'adjustments' ? 'rgba(5, 150, 105, 0.15)' : 'transparent' }}
              onClick={() => setAuditSubTab('adjustments')}
            >
              2. Authorized Stock Adjustments
            </button>
            <button
              className={`gi-btn-sm ${auditSubTab === 'incidents' ? 'active' : ''}`}
              style={{ background: auditSubTab === 'incidents' ? 'rgba(5, 150, 105, 0.15)' : 'transparent' }}
              onClick={() => setAuditSubTab('incidents')}
            >
              3. Incident Log (Missing / Theft / Damage)
            </button>
          </div>

          {/* Sub-tab 1: Physical Verification */}
          {auditSubTab === 'verification' && (
            <div>
              <div className="gi-toolbar" style={{ marginBottom: '1rem' }}>
                <div className="gi-toolbar-left">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Record physical warehouse counts against system book stock. Discrepancies do not silently overwrite the ledger.
                  </span>
                </div>
                <div className="gi-toolbar-right">
                  <button
                    className="gi-btn-primary"
                    onClick={() => {
                      setVerificationForm({
                        storeId: selectedStoreId || stores[0]?.id || stores[0]?._id || '',
                        materialId: materials[0]?.id || materials[0]?._id || '',
                        physicalQuantity: 0,
                        verificationDate: new Date().toISOString().split('T')[0],
                        remarks: ''
                      });
                      setShowVerificationModal(true);
                    }}
                  >
                    <Plus size={16} />
                    <span>New Physical Count</span>
                  </button>
                </div>
              </div>

              <div className="gi-table-card">
                <div className="gi-table-wrapper">
                  <table className="gi-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Material</th>
                        <th>System Qty</th>
                        <th>Physical Count</th>
                        <th>Discrepancy (Diff)</th>
                        <th>Auditor</th>
                        <th>Adjustment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifications.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem' }}>
                            No physical count verifications logged yet.
                          </td>
                        </tr>
                      ) : (
                        verifications.map((v) => (
                          <tr key={v.id || v._id}>
                            <td>{v.verificationDate ? new Date(v.verificationDate).toLocaleDateString() : '—'}</td>
                            <td>{v.materialName}</td>
                            <td>
                              {v.systemQuantity} {v.uom}
                            </td>
                            <td>
                              <strong>
                                {v.physicalQuantity} {v.uom}
                              </strong>
                            </td>
                            <td>
                              {v.difference === 0 ? (
                                <span className="gi-badge normal">Matched (0)</span>
                              ) : v.difference > 0 ? (
                                <span className="gi-badge low">
                                  +{v.difference} {v.uom} (Surplus)
                                </span>
                              ) : (
                                <span className="gi-badge out">
                                  {v.difference} {v.uom} (Deficit)
                                </span>
                              )}
                            </td>
                            <td>{v.responsibleUser?.name}</td>
                            <td>
                              {v.adjustmentCreated ? (
                                <span className="gi-badge normal">Adjustment Committed</span>
                              ) : v.difference !== 0 ? (
                                <button
                                  className="gi-btn-sm"
                                  onClick={() => {
                                    setAdjustmentForm({
                                      storeId: v.storeId,
                                      materialId: v.materialId,
                                      adjustmentType: v.difference > 0 ? 'ADD' : 'DEDUCT',
                                      quantity: Math.abs(v.difference),
                                      reason: `Correction against Physical Verification dated ${new Date(v.verificationDate).toLocaleDateString()}`,
                                      verificationId: v.id || v._id
                                    });
                                    setShowAdjustmentModal(true);
                                  }}
                                  style={{ color: 'var(--accent)' }}
                                >
                                  Post Adjustment
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No Adjustment Needed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Stock Adjustments */}
          {auditSubTab === 'adjustments' && (
            <div>
              <div className="gi-toolbar" style={{ marginBottom: '1rem' }}>
                <div className="gi-toolbar-left">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Authorized traceable stock adjustments. Requires mandatory reason and records who and when.
                  </span>
                </div>
                <div className="gi-toolbar-right">
                  <button
                    className="gi-btn-primary"
                    onClick={() => {
                      setAdjustmentForm({
                        storeId: selectedStoreId || stores[0]?.id || stores[0]?._id || '',
                        materialId: materials[0]?.id || materials[0]?._id || '',
                        adjustmentType: 'ADD',
                        quantity: 1,
                        reason: '',
                        verificationId: ''
                      });
                      setShowAdjustmentModal(true);
                    }}
                  >
                    <Plus size={16} />
                    <span>New Stock Adjustment</span>
                  </button>
                </div>
              </div>

              <div className="gi-table-card">
                <div className="gi-table-wrapper">
                  <table className="gi-table">
                    <thead>
                      <tr>
                        <th>Adjustment Ref #</th>
                        <th>Date</th>
                        <th>Material</th>
                        <th>Type</th>
                        <th>Quantity Adjusted</th>
                        <th>Reason</th>
                        <th>Authorized By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem' }}>
                            No authorized stock adjustments recorded.
                          </td>
                        </tr>
                      ) : (
                        adjustments.map((a) => (
                          <tr key={a.id || a._id}>
                            <td>
                              <strong style={{ color: 'var(--accent)' }}>{a.adjustmentNumber}</strong>
                            </td>
                            <td>{a.adjustmentDate ? new Date(a.adjustmentDate).toLocaleDateString() : '—'}</td>
                            <td>{a.materialName}</td>
                            <td>
                              {a.adjustmentType === 'ADD' ? (
                                <span className="gi-badge normal">+ ADD Stock</span>
                              ) : (
                                <span className="gi-badge out">- DEDUCT Stock</span>
                              )}
                            </td>
                            <td>
                              <strong>{a.quantity}</strong> {a.uom}
                            </td>
                            <td>{a.reason}</td>
                            <td>{a.authorizedBy?.name}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Incidents Log */}
          {auditSubTab === 'incidents' && (
            <div>
              <div className="gi-toolbar" style={{ marginBottom: '1rem' }}>
                <div className="gi-toolbar-left">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Incident reporting for Missing, Suspected Theft, Damaged, or Loss. Notice: Reporting logs the event and does NOT deduct stock.
                  </span>
                </div>
                <div className="gi-toolbar-right">
                  <button
                    className="gi-btn-primary"
                    onClick={() => {
                      setIncidentForm({
                        storeId: selectedStoreId || stores[0]?.id || stores[0]?._id || '',
                        incidentType: 'Missing',
                        materialId: materials[0]?.id || materials[0]?._id || '',
                        quantity: 1,
                        date: new Date().toISOString().split('T')[0],
                        description: '',
                        reportedBy: user?.firstName || 'Store User'
                      });
                      setShowIncidentModal(true);
                    }}
                  >
                    <Plus size={16} />
                    <span>Report Incident</span>
                  </button>
                </div>
              </div>

              <div className="gi-table-card">
                <div className="gi-table-wrapper">
                  <table className="gi-table">
                    <thead>
                      <tr>
                        <th>Incident #</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Material</th>
                        <th>Quantity Affected</th>
                        <th>Description</th>
                        <th>Reported By</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem' }}>
                            No incidents reported.
                          </td>
                        </tr>
                      ) : (
                        incidents.map((inc) => (
                          <tr key={inc.id || inc._id}>
                            <td>
                              <strong style={{ color: '#ef4444' }}>{inc.incidentNumber}</strong>
                            </td>
                            <td>{inc.date ? new Date(inc.date).toLocaleDateString() : '—'}</td>
                            <td>
                              <span className="gi-badge out">{inc.incidentType}</span>
                            </td>
                            <td>{inc.materialName || 'N/A'}</td>
                            <td>
                              {inc.quantity !== undefined ? (
                                <strong>
                                  {inc.quantity} {inc.uom || ''}
                                </strong>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>{inc.description}</td>
                            <td>{inc.reportedBy}</td>
                            <td>
                              <span className="gi-badge low">{inc.status}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          TAB 8: REPORTS & MATERIAL LEDGER
         ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="gi-workspace">
          <div className="gi-toolbar">
            <div className="gi-toolbar-left">
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Report:</label>
              <select
                className="gi-filter-select"
                value={reportType}
                onChange={(e) => {
                  setReportType(e.target.value);
                  loadReportData(e.target.value);
                }}
              >
                <option value="store-wise-stock">1. Current Store-Wise Stock Balances</option>
                <option value="inward-register">2. Inward Goods Receipt Register</option>
                <option value="outward-register">3. Outward Material Issue Register</option>
                <option value="material-ledger">4. General Material Movement Ledger</option>
                <option value="low-stock">5. Critical Low-Stock & Out-of-Stock Alert Register</option>
                <option value="overdue-borrowed">6. Outstanding & Overdue Borrowed Items</option>
                <option value="vendor-wise-inward">7. Vendor-Wise Inward Summary</option>
                <option value="agency-wise-outward">8. Agency-Wise Outward Summary</option>
                <option value="discrepancies">9. Physical Stock Audit Discrepancies</option>
                <option value="incidents">10. Missing, Theft, Damage & Loss Incidents</option>
              </select>
            </div>

            <div className="gi-toolbar-right">
              <button
                className="gi-btn-secondary"
                onClick={() => exportToCSV(`General_Inventory_${reportType}`, reportData?.rows || [])}
                disabled={!reportData?.rows?.length}
              >
                <Download size={15} />
                <span>Export CSV / Excel</span>
              </button>

              <button className="gi-btn-primary" onClick={() => window.print()} disabled={!reportData?.rows?.length}>
                <Printer size={15} />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          <div className="gi-table-card">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--card-border)', background: 'var(--main-bg)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {reportData?.title || 'Report Output'}
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Project: {activeProject?.name || 'All'} | Store: {activeStore?.name || 'All Stores'} | Generated:{' '}
                {new Date().toLocaleString()}
              </div>
            </div>

            <div className="gi-table-wrapper">
              {reportLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Generating report data...
                </div>
              ) : !reportData?.rows || reportData.rows.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No records found matching the report criteria.
                </div>
              ) : (
                <table className="gi-table">
                  <thead>
                    <tr>
                      {Object.keys(reportData.rows[0])
                        .filter((k) => k !== '_id' && k !== 'id' && typeof reportData.rows[0][k] !== 'object')
                        .map((key) => (
                          <th key={key}>{key.replace(/([A-Z])/g, ' $1')}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((row, rIdx) => {
                      const keys = Object.keys(row).filter((k) => k !== '_id' && k !== 'id' && typeof row[k] !== 'object');
                      return (
                        <tr key={rIdx}>
                          {keys.map((k) => (
                            <td key={k}>
                              {row[k] === 'NORMAL' ? (
                                <span className="gi-badge normal">Normal</span>
                              ) : row[k] === 'LOW_STOCK' ? (
                                <span className="gi-badge low">Low Stock</span>
                              ) : row[k] === 'OUT_OF_STOCK' ? (
                                <span className="gi-badge out">Out of Stock</span>
                              ) : (
                                String(row[k] !== undefined && row[k] !== null ? row[k] : '—')
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          MODALS & DIALOGS
         ────────────────────────────────────────────────────────────────────── */}

      {/* 1. Project Modal */}
      {showProjectModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal">
            <div className="gi-modal-header">
              <h2>Create Inventory Project</h2>
              <button className="gi-modal-close" onClick={() => setShowProjectModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="gi-modal-body">
                <div className="gi-form-group">
                  <label>Project Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metro Tower Phase 1"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  />
                </div>
                <div className="gi-form-group">
                  <label>Project Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. MTR-P1"
                    value={projectForm.code}
                    onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                  />
                </div>
                <div className="gi-form-group">
                  <label>Site Address / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Sector 62, Expressway"
                    value={projectForm.address}
                    onChange={(e) => setProjectForm({ ...projectForm, address: e.target.value })}
                  />
                </div>
                <div className="gi-form-group">
                  <label>Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Project details..."
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowProjectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Store Modal */}
      {showStoreModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal">
            <div className="gi-modal-header">
              <h2>Add Store to Project ({activeProject?.name})</h2>
              <button className="gi-modal-close" onClick={() => setShowStoreModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateStore}>
              <div className="gi-modal-body">
                <div className="gi-form-group">
                  <label>Store Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Site Store A, Electrical Yard"
                    value={storeForm.name}
                    onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                  />
                </div>
                <div className="gi-form-group">
                  <label>Store Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. STR-A"
                    value={storeForm.code}
                    onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
                  />
                </div>
                <div className="gi-form-group">
                  <label>Physical Location within Site</label>
                  <input
                    type="text"
                    placeholder="e.g. Behind Tower B Basement"
                    value={storeForm.location}
                    onChange={(e) => setStoreForm({ ...storeForm, location: e.target.value })}
                  />
                </div>
              </div>
              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowStoreModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Add Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Material Register Modal */}
      {showMaterialModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal lg">
            <div className="gi-modal-header">
              <h2>{editingMaterial ? 'Edit Material Record' : 'Register New Material'}</h2>
              <button className="gi-modal-close" onClick={() => setShowMaterialModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => handleSaveMaterial(e, false)}>
              <div className="gi-modal-body">
                {duplicateWarning && (
                  <div className="gi-alert-banner" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b', color: '#b45309' }}>
                    <div className="gi-alert-content">
                      <AlertTriangle size={18} />
                      <div>
                        <strong>Possible Duplicate Warning:</strong> {duplicateWarning.message}
                        <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          If this is a legitimate distinct material, click "Confirm & Create Anyway" below.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {projects.length === 0 && (
                  <div className="gi-alert-banner danger" style={{ margin: '0 0 1rem 0' }}>
                    <div className="gi-alert-content">
                      <AlertTriangle size={18} />
                      <span>No project found. Please create a project first before registering materials.</span>
                    </div>
                    <button
                      type="button"
                      className="gi-btn-sm"
                      onClick={() => {
                        setShowMaterialModal(false);
                        setShowProjectModal(true);
                      }}
                    >
                      + Create Project
                    </button>
                  </div>
                )}

                <div className="gi-form-grid">
                  <div className="gi-form-group">
                    <label>Project *</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      required
                      disabled={editingMaterial !== null}
                    >
                      {projects.length === 0 && <option value="">No Project Available</option>}
                      {projects.map((p) => (
                        <option key={p.id || p._id} value={p.id || p._id}>
                          {p.name} {p.code ? `(${p.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Material Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PVC Conduit Pipe 25mm, Safety Helmet"
                      value={materialForm.name}
                      onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Category *</label>
                    <select
                      value={materialForm.category}
                      onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                    >
                      {DEFAULT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Unit of Measurement (UOM) *</label>
                    <select
                      value={materialForm.uom}
                      onChange={(e) => setMaterialForm({ ...materialForm, uom: e.target.value })}
                    >
                      {COMMON_UOMS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Low-Stock Threshold *</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={materialForm.lowStockThreshold}
                      onChange={(e) => setMaterialForm({ ...materialForm, lowStockThreshold: Number(e.target.value) })}
                    />
                    <span className="gi-form-hint">Alert triggers when stock drops to or below this amount.</span>
                  </div>

                  <div className="gi-form-group">
                    <label>Material Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. ELE-001"
                      value={materialForm.materialCode}
                      onChange={(e) => setMaterialForm({ ...materialForm, materialCode: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Subcategory (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Cables & Wires, Adhesives"
                      value={materialForm.subcategory}
                      onChange={(e) => setMaterialForm({ ...materialForm, subcategory: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Size / Specification (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 25mm Heavy Duty, 2.5 sq mm"
                      value={materialForm.sizeOrSpec}
                      onChange={(e) => setMaterialForm({ ...materialForm, sizeOrSpec: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Brand / Model (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Polycab, Supreme, Bosch"
                      value={materialForm.brandOrModel}
                      onChange={(e) => setMaterialForm({ ...materialForm, brandOrModel: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group full-width">
                    <label>Preferred Vendor (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Electrical Suppliers"
                      value={materialForm.preferredVendor}
                      onChange={(e) => setMaterialForm({ ...materialForm, preferredVendor: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group full-width">
                    <label>Description / Technical Remarks</label>
                    <textarea
                      rows={2}
                      placeholder="Any storage guidelines or specs..."
                      value={materialForm.remarks}
                      onChange={(e) => setMaterialForm({ ...materialForm, remarks: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowMaterialModal(false)}>
                  Cancel
                </button>
                {duplicateWarning ? (
                  <button type="button" className="gi-btn-primary" onClick={() => handleSaveMaterial(null, true)}>
                    Confirm & Create Anyway
                  </button>
                ) : (
                  <button type="submit" className="gi-btn-primary" disabled={!selectedProjectId || isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingMaterial ? 'Update Material' : 'Save Material'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Set Opening Balance Modal */}
      {showOpeningModal && openingMaterial && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal">
            <div className="gi-modal-header">
              <h2>Set Opening Balance: {openingMaterial.name}</h2>
              <button className="gi-modal-close" onClick={() => setShowOpeningModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveOpeningBalance}>
              <div className="gi-modal-body">
                <div className="gi-form-group">
                  <label>Store Location</label>
                  <select
                    value={openingForm.storeId}
                    onChange={(e) => setOpeningForm({ ...openingForm, storeId: e.target.value })}
                  >
                    {stores.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="gi-form-group">
                  <label>Opening Stock Quantity ({openingMaterial.uom}) *</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={openingForm.quantity}
                    onChange={(e) => setOpeningForm({ ...openingForm, quantity: Number(e.target.value) })}
                  />
                  <span className="gi-form-hint">
                    Initial stock balance is recorded into the transaction ledger under your name.
                  </span>
                </div>

                <div className="gi-form-group">
                  <label>Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Initial inventory takeover count"
                    value={openingForm.remarks}
                    onChange={(e) => setOpeningForm({ ...openingForm, remarks: e.target.value })}
                  />
                </div>
              </div>
              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowOpeningModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Save Opening Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Inward Goods Receipt Modal */}
      {showInwardModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal lg">
            <div className="gi-modal-header">
              <h2>New Inward Delivery (Goods Receipt Note)</h2>
              <button className="gi-modal-close" onClick={() => setShowInwardModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveInward}>
              <div className="gi-modal-body">
                <div className="gi-form-grid">
                  <div className="gi-form-group">
                    <label>Store Location *</label>
                    <select
                      value={inwardForm.storeId}
                      onChange={(e) => setInwardForm({ ...inwardForm, storeId: e.target.value })}
                    >
                      {stores.map((s) => (
                        <option key={s.id || s._id} value={s.id || s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Receipt Date *</label>
                    <input
                      type="date"
                      required
                      value={inwardForm.receiptDate}
                      onChange={(e) => setInwardForm({ ...inwardForm, receiptDate: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Vendor / Supplier Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Premier Hardware & Electricals"
                      value={inwardForm.vendorName}
                      onChange={(e) => setInwardForm({ ...inwardForm, vendorName: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Vendor Challan # *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CH-89210"
                      value={inwardForm.vendorChallanNumber}
                      onChange={(e) => setInwardForm({ ...inwardForm, vendorChallanNumber: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Invoice / Bill # (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026-44"
                      value={inwardForm.invoiceNumber}
                      onChange={(e) => setInwardForm({ ...inwardForm, invoiceNumber: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Remarks</label>
                    <input
                      type="text"
                      placeholder="e.g. Received in good condition"
                      value={inwardForm.remarks}
                      onChange={(e) => setInwardForm({ ...inwardForm, remarks: e.target.value })}
                    />
                  </div>
                </div>

                {/* Line items table */}
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Materials Received
                    </label>
                    <button
                      type="button"
                      className="gi-btn-sm"
                      onClick={() =>
                        setInwardForm({
                          ...inwardForm,
                          items: [
                            ...inwardForm.items,
                            { materialId: '', receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, rejectedQuantity: 0, unitPrice: 0, remarks: '' }
                          ]
                        })
                      }
                    >
                      <Plus size={14} /> Add Line Item
                    </button>
                  </div>

                  <div className="gi-items-editor">
                    <table>
                      <thead>
                        <tr>
                          <th>Material *</th>
                          <th>Received Qty</th>
                          <th>Accepted Qty *</th>
                          <th>Damaged</th>
                          <th>Rejected</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {inwardForm.items.map((it, idx) => (
                          <tr key={idx}>
                            <td>
                              <select
                                required
                                value={it.materialId}
                                onChange={(e) => {
                                  const updated = [...inwardForm.items];
                                  updated[idx].materialId = e.target.value;
                                  setInwardForm({ ...inwardForm, items: updated });
                                }}
                              >
                                <option value="">Select Material...</option>
                                {materials.map((m) => (
                                  <option key={m.id || m._id} value={m.id || m._id}>
                                    {m.name} ({m.uom})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={it.receivedQuantity}
                                onChange={(e) => {
                                  const updated = [...inwardForm.items];
                                  const val = Number(e.target.value);
                                  updated[idx].receivedQuantity = val;
                                  if (updated[idx].acceptedQuantity === 0) {
                                    updated[idx].acceptedQuantity = val;
                                  }
                                  setInwardForm({ ...inwardForm, items: updated });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                required
                                value={it.acceptedQuantity}
                                onChange={(e) => {
                                  const updated = [...inwardForm.items];
                                  updated[idx].acceptedQuantity = Number(e.target.value);
                                  setInwardForm({ ...inwardForm, items: updated });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={it.damagedQuantity}
                                onChange={(e) => {
                                  const updated = [...inwardForm.items];
                                  updated[idx].damagedQuantity = Number(e.target.value);
                                  setInwardForm({ ...inwardForm, items: updated });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={it.rejectedQuantity}
                                onChange={(e) => {
                                  const updated = [...inwardForm.items];
                                  updated[idx].rejectedQuantity = Number(e.target.value);
                                  setInwardForm({ ...inwardForm, items: updated });
                                }}
                              />
                            </td>
                            <td>
                              {inwardForm.items.length > 1 && (
                                <button
                                  type="button"
                                  className="gi-modal-close"
                                  onClick={() => {
                                    const updated = inwardForm.items.filter((_, i) => i !== idx);
                                    setInwardForm({ ...inwardForm, items: updated });
                                  }}
                                >
                                  <Trash2 size={14} color="#ef4444" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <span className="gi-form-hint" style={{ display: 'block', marginTop: '0.4rem' }}>
                    Note: Only <strong>accepted quantities</strong> increase available stock. Damaged & rejected quantities are kept in quarantine.
                  </span>
                </div>
              </div>

              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowInwardModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Post Inward Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Outward Material Issue Modal */}
      {showOutwardModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal lg">
            <div className="gi-modal-header">
              <h2>Record Outward Material Issue</h2>
              <button className="gi-modal-close" onClick={() => setShowOutwardModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveOutward}>
              <div className="gi-modal-body">
                <div className="gi-form-grid">
                  <div className="gi-form-group">
                    <label>Store Location *</label>
                    <select
                      value={outwardForm.storeId}
                      onChange={(e) => setOutwardForm({ ...outwardForm, storeId: e.target.value })}
                    >
                      {stores.map((s) => (
                        <option key={s.id || s._id} value={s.id || s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Issue Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={outwardForm.issueDateTime}
                      onChange={(e) => setOutwardForm({ ...outwardForm, issueDateTime: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Material to Issue *</label>
                    <select
                      required
                      value={outwardForm.materialId}
                      onChange={(e) => setOutwardForm({ ...outwardForm, materialId: e.target.value })}
                    >
                      <option value="">Select Material...</option>
                      {materials.map((m) => (
                        <option key={m.id || m._id} value={m.id || m._id}>
                          {m.name} (Available: {m.currentStock} {m.uom})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Quantity to Issue *</label>
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      required
                      value={outwardForm.quantity}
                      onChange={(e) => setOutwardForm({ ...outwardForm, quantity: Number(e.target.value) })}
                    />
                    {outwardForm.materialId && (
                      <span className="gi-form-hint">
                        Available Stock:{' '}
                        <strong>
                          {materials.find((m) => (m.id || m._id) === outwardForm.materialId)?.currentStock || 0}{' '}
                          {materials.find((m) => (m.id || m._id) === outwardForm.materialId)?.uom}
                        </strong>
                      </span>
                    )}
                  </div>

                  <div className="gi-form-group">
                    <label>Person Receiving (Issued To) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar (Electrician)"
                      value={outwardForm.personReceiving}
                      onChange={(e) => setOutwardForm({ ...outwardForm, personReceiving: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Agency / Contractor</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="e.g. Shiva Electricals"
                        disabled={outwardForm.isAgencyNA}
                        value={outwardForm.agency}
                        onChange={(e) => setOutwardForm({ ...outwardForm, agency: e.target.value })}
                      />
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={outwardForm.isAgencyNA}
                          onChange={(e) => setOutwardForm({ ...outwardForm, isAgencyNA: e.target.checked, agency: e.target.checked ? 'Not Applicable' : '' })}
                        />
                        N/A
                      </label>
                    </div>
                  </div>

                  <div className="gi-form-group">
                    <label>Work Location (Block, Floor, Flat) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tower B - 4th Floor Slab"
                      value={outwardForm.location}
                      onChange={(e) => setOutwardForm({ ...outwardForm, location: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Purpose *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Conduit fixing for lighting"
                      value={outwardForm.purpose}
                      onChange={(e) => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Return Classification *</label>
                    <select
                      value={outwardForm.returnClassification}
                      onChange={(e) => setOutwardForm({ ...outwardForm, returnClassification: e.target.value })}
                    >
                      <option value="non-returnable">Non-Returnable (Consumable / Built-in)</option>
                      <option value="returnable">Returnable (Tool / Equipment / Borrowed)</option>
                    </select>
                  </div>

                  {outwardForm.returnClassification === 'returnable' && (
                    <div className="gi-form-group">
                      <label>Expected Return Date *</label>
                      <input
                        type="date"
                        required
                        value={outwardForm.expectedReturnDate}
                        onChange={(e) => setOutwardForm({ ...outwardForm, expectedReturnDate: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="gi-form-group full-width">
                    <label>Remarks</label>
                    <input
                      type="text"
                      placeholder="Special instructions or notes..."
                      value={outwardForm.remarks}
                      onChange={(e) => setOutwardForm({ ...outwardForm, remarks: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowOutwardModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Confirm & Issue Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Record Return Modal */}
      {showReturnModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal">
            <div className="gi-modal-header">
              <h2>Record Material Return</h2>
              <button className="gi-modal-close" onClick={() => setShowReturnModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveReturn}>
              <div className="gi-modal-body">
                <div className="gi-form-group">
                  <label>Select Original Outward Issue *</label>
                  <select
                    required
                    value={returnForm.outwardId}
                    onChange={(e) => {
                      const sel = eligibleOutward.find((o) => (o.id || o._id) === e.target.value);
                      if (sel) {
                        setReturnForm({
                          ...returnForm,
                          outwardId: e.target.value,
                          returnType: sel.returnClassification === 'returnable' ? 'BORROWED' : 'UNUSED',
                          returnedByPerson: sel.personReceiving || '',
                          acceptedQuantity: sel.outstandingQuantity || 1
                        });
                      }
                    }}
                  >
                    {eligibleOutward.map((o) => (
                      <option key={o.id || o._id} value={o.id || o._id}>
                        {o.outwardNumber} — {o.materialName} (Outstanding: {o.outstandingQuantity} {o.uom}) — To:{' '}
                        {o.personReceiving}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="gi-form-group">
                  <label>Return Type *</label>
                  <select
                    value={returnForm.returnType}
                    onChange={(e) => setReturnForm({ ...returnForm, returnType: e.target.value })}
                  >
                    <option value="BORROWED">Borrowed Item Return (Tools / Assets)</option>
                    <option value="UNUSED">Unused Consumable Return (Returned to store)</option>
                  </select>
                </div>

                <div className="gi-form-group">
                  <label>Person Returning *</label>
                  <input
                    type="text"
                    required
                    value={returnForm.returnedByPerson}
                    onChange={(e) => setReturnForm({ ...returnForm, returnedByPerson: e.target.value })}
                  />
                </div>

                <div className="gi-form-grid">
                  <div className="gi-form-group">
                    <label>Accepted Quantity (Usable, Adds to stock) *</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      required
                      value={returnForm.acceptedQuantity}
                      onChange={(e) => setReturnForm({ ...returnForm, acceptedQuantity: Number(e.target.value) })}
                    />
                  </div>

                  <div className="gi-form-group">
                    <label>Damaged Quantity (Separate Quarantine)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={returnForm.damagedQuantity}
                      onChange={(e) => setReturnForm({ ...returnForm, damagedQuantity: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="gi-form-group">
                  <label>Missing Quantity</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={returnForm.missingQuantity}
                    onChange={(e) => setReturnForm({ ...returnForm, missingQuantity: Number(e.target.value) })}
                  />
                </div>

                <div className="gi-form-group">
                  <label>Remarks</label>
                  <input
                    type="text"
                    placeholder="Condition notes..."
                    value={returnForm.remarks}
                    onChange={(e) => setReturnForm({ ...returnForm, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowReturnModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Confirm Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Inter-Store Transfer Modal */}
      {showTransferModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal">
            <div className="gi-modal-header">
              <h2>Inter-Store Material Transfer</h2>
              <button className="gi-modal-close" onClick={() => setShowTransferModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTransfer}>
              <div className="gi-modal-body">
                <div className="gi-form-grid">
                  <div className="gi-form-group">
                    <label>Source Store (From) *</label>
                    <select
                      value={transferForm.sourceStoreId}
                      onChange={(e) => setTransferForm({ ...transferForm, sourceStoreId: e.target.value })}
                    >
                      {stores.map((s) => (
                        <option key={s.id || s._id} value={s.id || s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Destination Store (To) *</label>
                    <select
                      value={transferForm.destinationStoreId}
                      onChange={(e) => setTransferForm({ ...transferForm, destinationStoreId: e.target.value })}
                    >
                      {stores
                        .filter((s) => (s.id || s._id) !== transferForm.sourceStoreId)
                        .map((s) => (
                          <option key={s.id || s._id} value={s.id || s._id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="gi-form-group">
                  <label>Material to Transfer *</label>
                  <select
                    required
                    value={transferForm.materialId}
                    onChange={(e) => setTransferForm({ ...transferForm, materialId: e.target.value })}
                  >
                    <option value="">Select Material...</option>
                    {materials.map((m) => (
                      <option key={m.id || m._id} value={m.id || m._id}>
                        {m.name} ({m.uom})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="gi-form-group">
                  <label>Quantity to Transfer *</label>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    required
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
                  />
                </div>

                <div className="gi-form-group">
                  <label>Transfer Reference / Chalan #</label>
                  <input
                    type="text"
                    placeholder="e.g. TRF-GATE-01"
                    value={transferForm.reference}
                    onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })}
                  />
                </div>

                <div className="gi-form-group">
                  <label>Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Replenishment for Tower C site store"
                    value={transferForm.remarks}
                    onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Process Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Physical Verification Audit Modal */}
      {showVerificationModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal">
            <div className="gi-modal-header">
              <h2>Record Physical Stock Verification</h2>
              <button className="gi-modal-close" onClick={() => setShowVerificationModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveVerification}>
              <div className="gi-modal-body">
                <div className="gi-form-group">
                  <label>Store Location</label>
                  <select
                    value={verificationForm.storeId}
                    onChange={(e) => setVerificationForm({ ...verificationForm, storeId: e.target.value })}
                  >
                    {stores.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="gi-form-group">
                  <label>Material *</label>
                  <select
                    required
                    value={verificationForm.materialId}
                    onChange={(e) => setVerificationForm({ ...verificationForm, materialId: e.target.value })}
                  >
                    <option value="">Select Material...</option>
                    {materials.map((m) => (
                      <option key={m.id || m._id} value={m.id || m._id}>
                        {m.name} (Book Stock: {m.currentStock} {m.uom})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="gi-form-group">
                  <label>Physical Counted Quantity *</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={verificationForm.physicalQuantity}
                    onChange={(e) => setVerificationForm({ ...verificationForm, physicalQuantity: Number(e.target.value) })}
                  />
                </div>

                <div className="gi-form-group">
                  <label>Audit Date</label>
                  <input
                    type="date"
                    required
                    value={verificationForm.verificationDate}
                    onChange={(e) => setVerificationForm({ ...verificationForm, verificationDate: e.target.value })}
                  />
                </div>

                <div className="gi-form-group">
                  <label>Auditor Remarks</label>
                  <textarea
                    rows={2}
                    placeholder="Explanation of any variance found..."
                    value={verificationForm.remarks}
                    onChange={(e) => setVerificationForm({ ...verificationForm, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowVerificationModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Log Audit Count
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Stock Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal">
            <div className="gi-modal-header">
              <h2>Post Traceable Stock Adjustment</h2>
              <button className="gi-modal-close" onClick={() => setShowAdjustmentModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveAdjustment}>
              <div className="gi-modal-body">
                <div className="gi-form-group">
                  <label>Store Location</label>
                  <select
                    value={adjustmentForm.storeId}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, storeId: e.target.value })}
                  >
                    {stores.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="gi-form-group">
                  <label>Material *</label>
                  <select
                    required
                    value={adjustmentForm.materialId}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, materialId: e.target.value })}
                  >
                    <option value="">Select Material...</option>
                    {materials.map((m) => (
                      <option key={m.id || m._id} value={m.id || m._id}>
                        {m.name} (Current: {m.currentStock} {m.uom})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="gi-form-grid">
                  <div className="gi-form-group">
                    <label>Adjustment Type *</label>
                    <select
                      value={adjustmentForm.adjustmentType}
                      onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value })}
                    >
                      <option value="ADD">+ ADD Stock (Found / Surplus Correction)</option>
                      <option value="DEDUCT">- DEDUCT Stock (Confirmed Loss / Write-off)</option>
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Adjustment Quantity *</label>
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      required
                      value={adjustmentForm.quantity}
                      onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="gi-form-group">
                  <label>Reason for Adjustment (Mandatory) *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Provide full operational justification for this adjustment..."
                    value={adjustmentForm.reason}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  />
                </div>
              </div>

              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowAdjustmentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. Incident Reporting Modal */}
      {showIncidentModal && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal">
            <div className="gi-modal-header">
              <h2>Report Loss / Damage Incident</h2>
              <button className="gi-modal-close" onClick={() => setShowIncidentModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveIncident}>
              <div className="gi-modal-body">
                <div className="gi-alert-banner" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#1d4ed8' }}>
                  <div className="gi-alert-content">
                    <span>
                      Notice: Reporting an incident logs the occurrence for security and audit. It will <strong>NOT</strong> automatically deduct stock.
                    </span>
                  </div>
                </div>

                <div className="gi-form-grid">
                  <div className="gi-form-group">
                    <label>Incident Type *</label>
                    <select
                      value={incidentForm.incidentType}
                      onChange={(e) => setIncidentForm({ ...incidentForm, incidentType: e.target.value })}
                    >
                      <option value="Missing">Missing</option>
                      <option value="Suspected Theft">Suspected Theft</option>
                      <option value="Damaged">Damaged at Site</option>
                      <option value="Other Loss">Other Loss</option>
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Incident Date *</label>
                    <input
                      type="date"
                      required
                      value={incidentForm.date}
                      onChange={(e) => setIncidentForm({ ...incidentForm, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="gi-form-grid">
                  <div className="gi-form-group">
                    <label>Material Involved</label>
                    <select
                      value={incidentForm.materialId}
                      onChange={(e) => setIncidentForm({ ...incidentForm, materialId: e.target.value })}
                    >
                      <option value="">Select Material (Optional)...</option>
                      {materials.map((m) => (
                        <option key={m.id || m._id} value={m.id || m._id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gi-form-group">
                    <label>Estimated Quantity Affected</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={incidentForm.quantity}
                      onChange={(e) => setIncidentForm({ ...incidentForm, quantity: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="gi-form-group">
                  <label>Detailed Incident Description *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe what occurred, where, and when..."
                    value={incidentForm.description}
                    onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  />
                </div>

                <div className="gi-form-group">
                  <label>Reported By (Person Name) *</label>
                  <input
                    type="text"
                    required
                    value={incidentForm.reportedBy}
                    onChange={(e) => setIncidentForm({ ...incidentForm, reportedBy: e.target.value })}
                  />
                </div>
              </div>

              <div className="gi-modal-footer">
                <button type="button" className="gi-btn-secondary" onClick={() => setShowIncidentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="gi-btn-primary">
                  Submit Incident Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 12. Slip Print View Modal */}
      {activeSlip && (
        <div className="gi-modal-backdrop">
          <div className="gi-modal lg">
            <div className="gi-modal-header no-print">
              <h2>{activeSlip.type === 'INWARD' ? 'Goods Receipt Note Slip' : 'Material Issue Slip'}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="gi-btn-primary" onClick={() => window.print()}>
                  <Printer size={15} /> Print Slip
                </button>
                <button className="gi-modal-close" onClick={() => setActiveSlip(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="gi-modal-body" style={{ background: '#f8fafc' }}>
              <div className="gi-slip-container">
                <div className="gi-slip-header">
                  <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>REBAROPTIMA</h1>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>General Construction Inventory System</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {activeSlip.type === 'INWARD' ? activeSlip.data.inwardNumber : activeSlip.data.outwardNumber}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Date:{' '}
                      {activeSlip.type === 'INWARD'
                        ? new Date(activeSlip.data.receiptDate).toLocaleDateString()
                        : new Date(activeSlip.data.issueDateTime).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="gi-slip-meta-grid">
                  <div>
                    <strong>Project:</strong> {activeProject?.name || 'Standard Project'}
                  </div>
                  <div>
                    <strong>Store:</strong> {activeSlip.data.storeName || 'Main Store'}
                  </div>
                  {activeSlip.type === 'INWARD' ? (
                    <>
                      <div>
                        <strong>Vendor:</strong> {activeSlip.data.vendorName}
                      </div>
                      <div>
                        <strong>Challan #:</strong> {activeSlip.data.vendorChallanNumber}
                      </div>
                      <div>
                        <strong>Invoice #:</strong> {activeSlip.data.invoiceNumber || 'N/A'}
                      </div>
                      <div>
                        <strong>Received By:</strong> {activeSlip.data.receivedBy?.name}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>Issued To:</strong> {activeSlip.data.personReceiving}
                      </div>
                      <div>
                        <strong>Agency:</strong> {activeSlip.data.agency || 'Not Applicable'}
                      </div>
                      <div>
                        <strong>Location:</strong> {activeSlip.data.location}
                      </div>
                      <div>
                        <strong>Purpose:</strong> {activeSlip.data.purpose}
                      </div>
                      <div>
                        <strong>Classification:</strong> {activeSlip.data.returnClassification}
                      </div>
                      {activeSlip.data.expectedReturnDate && (
                        <div>
                          <strong>Expected Return:</strong> {new Date(activeSlip.data.expectedReturnDate).toLocaleDateString()}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <table className="gi-slip-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Material Description</th>
                      <th>Quantity</th>
                      <th>UOM</th>
                      {activeSlip.type === 'INWARD' && <th>Status</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeSlip.type === 'INWARD' ? (
                      (activeSlip.data.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{it.materialName}</td>
                          <td>{it.acceptedQuantity}</td>
                          <td>{it.uom}</td>
                          <td>
                            Accepted: {it.acceptedQuantity}
                            {it.damagedQuantity > 0 && ` | Damaged: ${it.damagedQuantity}`}
                            {it.rejectedQuantity > 0 && ` | Rejected: ${it.rejectedQuantity}`}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td>1</td>
                        <td>{activeSlip.data.materialName}</td>
                        <td>{activeSlip.data.quantity}</td>
                        <td>{activeSlip.data.uom}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {activeSlip.data.remarks && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>Remarks:</strong> {activeSlip.data.remarks}
                  </div>
                )}

                <div className="gi-slip-signatures">
                  <div className="gi-sign-box">
                    <div>Issued / Received By</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {activeSlip.type === 'INWARD' ? activeSlip.data.receivedBy?.name : activeSlip.data.issuedBy?.name}
                    </div>
                  </div>
                  <div className="gi-sign-box">
                    <div>Store Incharge / Authorized Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
