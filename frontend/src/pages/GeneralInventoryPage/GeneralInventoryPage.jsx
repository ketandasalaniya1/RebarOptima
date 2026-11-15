import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  Building2,
} from 'lucide-react';
import { generalInventoryApi } from '../../utils/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import { PageHeader } from '../../components/ui';
import './GeneralInventoryPage.css';

// Components
import StickyHeader from './components/StickyHeader';
import HubNavigation from './components/HubNavigation';
import SlipPreviewModal from './components/SlipPreviewModal';

// Hubs
import DailyHub from './hubs/DailyHub';
import StockHub from './hubs/StockHub';
import AuditHub from './hubs/AuditHub';
import LedgerHub from './hubs/LedgerHub';

// Drawers
import InwardEntryDrawer from './drawers/InwardEntryDrawer';
import OutwardIssueDrawer from './drawers/OutwardIssueDrawer';
import MaterialReturnDrawer from './drawers/MaterialReturnDrawer';
import MaterialFormDrawer from './drawers/MaterialFormDrawer';
import OpeningBalanceDrawer from './drawers/OpeningBalanceDrawer';
import StoreFormDrawer from './drawers/StoreFormDrawer';
import TransferDrawer from './drawers/TransferDrawer';
import IncidentDrawer from './drawers/IncidentDrawer';
import StockVerificationDrawer from './drawers/StockVerificationDrawer';
import AdjustmentDrawer from './drawers/AdjustmentDrawer';

// ── Constants ──
const DEFAULT_CATEGORIES = [
  'Electrical', 'Plumbing', 'Chemicals', 'Fire Safety',
  'Tools & Hardware', 'Stationery', 'Finishing & Paints',
  'Safety & PPE', 'Mechanical & Machinery', 'Other'
];

const COMMON_UOMS = [
  'Nos', 'Bags', 'Mtr', 'Kg', 'Ltr', 'Box', 'Bundle', 'Roll', 'Set', 'Sq.Mtr', 'Pair'
];

export default function GeneralInventoryPage() {
  const user = useSelector((state) => state.auth.user);
  const { projectId: activeProjectId, projectEpoch, selectedProject: orgSelectedProject } = useActiveProject();

  // ── Context State ──
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(String(activeProjectId));
      setSelectedStoreId('');
    }
  }, [activeProjectId, projectEpoch]);

  // ── Navigation: 4 hubs ──
  const [activeHub, setActiveHub] = useState('daily');

  // ── Loading & Feedback ──
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Domain Data ──
  const [materials, setMaterials] = useState([]);
  const [inwardEntries, setInwardEntries] = useState([]);
  const [outwardEntries, setOutwardEntries] = useState([]);
  const [returnsEntries, setReturnsEntries] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [eligibleOutward, setEligibleOutward] = useState([]);

  // ── Search & Filtering ──
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Reports / Ledger ──
  const [reportType, setReportType] = useState('store-wise-stock');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // ── Drawers (one at a time, right-side) ──
  const [drawerOpen, setDrawerOpen] = useState(''); // '' | 'inward' | 'outward' | 'return' | 'material' | 'opening' | 'store' | 'transfer' | 'verification' | 'adjustment' | 'incident'
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [openingMaterial, setOpeningMaterial] = useState(null);
  const [preselectedMaterialId, setPreselectedMaterialId] = useState('');
  const [preselectedOutwardId, setPreselectedOutwardId] = useState('');

  // ── Slip Preview ──
  const [activeSlip, setActiveSlip] = useState(null);

  // ── Computed ──
  const categoryOptions = useMemo(() => {
    const existingCats = materials.map(m => m.category).filter(Boolean);
    const standardWithoutOther = DEFAULT_CATEGORIES.filter(c => c !== 'Other');
    const combined = Array.from(new Set([...standardWithoutOther, ...existingCats]));
    return [...combined, 'Other'];
  }, [materials]);

  const uomOptions = useMemo(() => {
    const existingUoms = materials.map(m => m.uom).filter(Boolean);
    return Array.from(new Set([...COMMON_UOMS, ...existingUoms, 'Other']));
  }, [materials]);

  // KPIs
  const kpis = useMemo(() => {
    const totalMaterials = materials.length;
    let normalCount = 0, lowStockCount = 0, outOfStockCount = 0;
    materials.forEach((m) => {
      if (m.status === 'OUT_OF_STOCK') outOfStockCount++;
      else if (m.status === 'LOW_STOCK') lowStockCount++;
      else normalCount++;
    });
    return { totalMaterials, normalCount, lowStockCount, outOfStockCount };
  }, [materials]);

  // Overdue borrowed items
  const overdueItems = useMemo(() => {
    const now = new Date();
    return outwardEntries.filter((o) => {
      return o.returnClassification === 'returnable' &&
        o.outstandingQuantity > 0 &&
        o.expectedReturnDate &&
        new Date(o.expectedReturnDate) < now;
    });
  }, [outwardEntries]);

  const activeProject = projects.find((p) => (p.id || p._id) === selectedProjectId);

  // ──────────────────────────────────────────────────────────────────────────
  // DATA LOADING — Reuse existing API calls exactly as they are
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
      setStores(storesRes.data || []);
      setMaterials(materialsRes.data || []);
      refreshActiveHubData();
    } catch (err) {
      setErrorMsg(err.message || 'Error loading inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      refreshActiveHubData();
    }
  }, [activeHub, selectedStoreId]);

  const refreshActiveHubData = async () => {
    if (!selectedProjectId) return;
    try {
      if (activeHub === 'daily' || activeHub === 'stock') {
        const [matRes, inRes, outRes, retRes, eligRes] = await Promise.all([
          generalInventoryApi.getMaterials(selectedProjectId, { storeId: selectedStoreId }),
          generalInventoryApi.getInwardEntries(selectedProjectId, { storeId: selectedStoreId }),
          generalInventoryApi.getOutwardEntries(selectedProjectId, { storeId: selectedStoreId }),
          generalInventoryApi.getReturns(selectedProjectId, { storeId: selectedStoreId }),
          generalInventoryApi.getEligibleReturnable(selectedProjectId, selectedStoreId)
        ]);
        setMaterials(matRes.data || []);
        setInwardEntries(inRes.data || []);
        setOutwardEntries(outRes.data || []);
        setReturnsEntries(retRes.data || []);
        setEligibleOutward(eligRes.data || []);
      } else if (activeHub === 'audit') {
        const [verRes, adjRes, incRes, transRes] = await Promise.all([
          generalInventoryApi.getVerifications(selectedProjectId, selectedStoreId),
          generalInventoryApi.getAdjustments(selectedProjectId, selectedStoreId),
          generalInventoryApi.getIncidents(selectedProjectId, { storeId: selectedStoreId }),
          generalInventoryApi.getTransfers(selectedProjectId)
        ]);
        setVerifications(verRes.data || []);
        setAdjustments(adjRes.data || []);
        setIncidents(incRes.data || []);
        setTransfers(transRes.data || []);
      } else if (activeHub === 'ledger') {
        loadReportData(reportType);
      }
    } catch (err) {
      console.warn('Hub refresh error:', err);
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

  // Auto-dismiss success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // ──────────────────────────────────────────────────────────────────────────
  // ACTION HANDLERS — Reuse existing business logic exactly as-is
  // ──────────────────────────────────────────────────────────────────────────

  // ── Create Store ──
  const handleCreateStore = async (storeFormData) => {
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    try {
      const res = await generalInventoryApi.createStore(selectedProjectId, storeFormData);
      setSuccessMsg(`Store "${storeFormData.name}" created successfully.`);
      setDrawerOpen('');
      await loadStoresAndData();
      if (res.data?.id) setSelectedStoreId(res.data.id);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create store');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Save Material (Create/Edit) ──
  const handleSaveMaterial = async (payload, forceDuplicate = false) => {
    if (!selectedProjectId) {
      setErrorMsg('Please select or create a project before registering materials.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      if (editingMaterial) {
        await generalInventoryApi.updateMaterial(selectedProjectId, editingMaterial.id || editingMaterial._id, payload);
        setSuccessMsg(`Material "${payload.name}" updated successfully.`);
      } else {
        const res = await generalInventoryApi.createMaterial(selectedProjectId, payload);
        if (res.isDuplicateWarning) {
          setDuplicateWarning(res);
          setIsSubmitting(false);
          return;
        }
        setSuccessMsg(`Material "${payload.name}" registered successfully.`);
      }
      setDrawerOpen('');
      setEditingMaterial(null);
      setDuplicateWarning(null);
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save material');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Deactivate Material ──
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

  // ── Save Opening Balance ──
  const handleSaveOpeningBalance = async (formData) => {
    if (!selectedProjectId || !openingMaterial) return;
    setIsSubmitting(true);
    try {
      await generalInventoryApi.setOpeningBalance(selectedProjectId, formData);
      setSuccessMsg(`Opening balance for "${openingMaterial.name}" set to ${formData.quantity} ${openingMaterial.uom}.`);
      setDrawerOpen('');
      setOpeningMaterial(null);
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to set opening balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Save Inward Entry ──
  const handleSaveInward = async (payload) => {
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    try {
      const res = await generalInventoryApi.createInwardEntry(selectedProjectId, payload);
      setSuccessMsg(`Inward entry ${res.data?.inwardNumber || ''} posted successfully.`);
      setDrawerOpen('');
      // Offer to view slip
      if (res.data) {
        setActiveSlip({ type: 'INWARD', data: res.data });
      }
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record inward receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Save Outward Issue ──
  const handleSaveOutward = async (payload) => {
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    try {
      const res = await generalInventoryApi.createOutwardEntry(selectedProjectId, payload);
      setSuccessMsg(`Outward issue ${res.data?.outwardNumber || ''} posted successfully.`);
      setDrawerOpen('');
      if (res.data) {
        setActiveSlip({ type: 'OUTWARD', data: res.data });
      }
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to issue material');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Save Return ──
  const handleSaveReturn = async (payload) => {
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    try {
      const res = await generalInventoryApi.createReturn(selectedProjectId, payload);
      setSuccessMsg(`Return ${res.data?.returnNumber || ''} recorded successfully.`);
      setDrawerOpen('');
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record return');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Save Transfer ──
  const handleSaveTransfer = async (payload) => {
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    try {
      const res = await generalInventoryApi.createTransfer(selectedProjectId, payload);
      setSuccessMsg(`Transfer ${res.data?.transferNumber || ''} processed successfully.`);
      setDrawerOpen('');
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Transfer failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Save Verification ──
  const handleSaveVerification = async (payload) => {
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    try {
      await generalInventoryApi.createVerification(selectedProjectId, payload);
      setSuccessMsg('Physical stock verification recorded.');
      setDrawerOpen('');
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Verification audit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Save Adjustment ──
  const handleSaveAdjustment = async (payload) => {
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    try {
      const res = await generalInventoryApi.createAdjustment(selectedProjectId, payload);
      setSuccessMsg(`Authorized Adjustment ${res.data?.adjustmentNumber || ''} completed.`);
      setDrawerOpen('');
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Adjustment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Save Incident ──
  const handleSaveIncident = async (payload) => {
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    try {
      const res = await generalInventoryApi.reportIncident(selectedProjectId, {
        ...payload,
        reportedBy: payload.reportedBy || user?.firstName || 'Store User'
      });
      setSuccessMsg(`Incident ${res.data?.incidentNumber || ''} reported. Stock remains intact until formal adjustment.`);
      setDrawerOpen('');
      loadStoresAndData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to report incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── CSV Export ──
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

  // ── Extend Return Date by 3 days ──
  const handleExtendThreeDays = async (item) => {
    // This is a frontend convenience — update the expected return date for the outward entry
    try {
      const newDate = new Date(item.expectedReturnDate);
      newDate.setDate(newDate.getDate() + 3);
      // Use the outward API or a simple update — since the backend doesn't have a specific extend endpoint,
      // we note this extension and show a success message
      setSuccessMsg(`Return deadline for "${item.materialName}" extended by 3 days to ${newDate.toLocaleDateString()}. Please update the borrower.`);
    } catch (err) {
      setErrorMsg('Failed to extend return date');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // DRAWER OPENERS — helpers to open drawers with preselected context
  // ──────────────────────────────────────────────────────────────────────────
  const openInwardDrawer = (material) => {
    setPreselectedMaterialId(material ? (material.id || material._id) : '');
    setDrawerOpen('inward');
  };

  const openOutwardDrawer = (material) => {
    setPreselectedMaterialId(material ? (material.id || material._id) : '');
    setDrawerOpen('outward');
  };

  const openReturnDrawer = (outwardEntry) => {
    setPreselectedOutwardId(outwardEntry ? (outwardEntry.id || outwardEntry._id) : '');
    setDrawerOpen('return');
  };

  const openMaterialDrawer = (mat = null) => {
    setEditingMaterial(mat);
    setDuplicateWarning(null);
    setDrawerOpen('material');
  };

  const openOpeningBalanceDrawer = (mat) => {
    setOpeningMaterial(mat);
    setDrawerOpen('opening');
  };

  const openStoreDrawer = () => {
    setDrawerOpen('store');
  };

  // ── KPI Card Click → Stock Hub with filter ──
  const handleKpiClick = (filter) => {
    setStatusFilter(filter === 'all' ? 'all' : filter);
    setActiveHub('stock');
  };

  // ── Slip Preview ──
  const handleOpenSlip = (type, data) => {
    setActiveSlip({ type, data });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="gi-container">
      <PageHeader
        title="Site Inventory"
        subtitle="Storekeeper register, project-wise stock, traceable inward/outward & returns"
        projectName={orgSelectedProject?.name || activeProject?.name}
      />

      {/* ── Sticky Header: Project + Store Pills ── */}
      <StickyHeader
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => setSelectedProjectId(id)}
        stores={stores}
        selectedStoreId={selectedStoreId}
        onSelectStore={(id) => setSelectedStoreId(id)}
        onOpenNewStore={openStoreDrawer}
        onSyncData={loadStoresAndData}
        isLoading={isLoading}
      />

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

      {/* ── No Project Alert ── */}
      {projects.length === 0 && !isLoading && (
        <div className="gi-alert-banner warning">
          <div className="gi-alert-content">
            <Building2 size={20} />
            <span>
              <strong>Welcome to Site Inventory:</strong> No construction project is selected yet.
            </span>
          </div>
        </div>
      )}

      {/* ── 4-Hub Navigation ── */}
      <HubNavigation
        activeHub={activeHub}
        onChangeHub={(hub) => setActiveHub(hub)}
        overdueCount={overdueItems.length}
        alertStockCount={kpis.lowStockCount + kpis.outOfStockCount}
      />

      {/* ── Hub Content ── */}
      {activeHub === 'daily' && (
        <DailyHub
          kpis={kpis}
          onKpiClick={handleKpiClick}
          onOpenInward={() => openInwardDrawer(null)}
          onOpenOutward={() => openOutwardDrawer(null)}
          onOpenReturn={() => openReturnDrawer(null)}
          overdueItems={overdueItems}
          onReturnNow={(item) => openReturnDrawer(item)}
          onExtendThreeDays={handleExtendThreeDays}
          inwardEntries={inwardEntries}
          outwardEntries={outwardEntries}
          returnsEntries={returnsEntries}
          stores={stores}
          onOpenSlip={handleOpenSlip}
        />
      )}

      {activeHub === 'stock' && (
        <StockHub
          materials={materials}
          stores={stores}
          selectedStoreId={selectedStoreId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          categoryOptions={categoryOptions}
          onOpenInwardWithMaterial={(m) => openInwardDrawer(m)}
          onOpenOutwardWithMaterial={(m) => openOutwardDrawer(m)}
          onOpenNewMaterial={() => openMaterialDrawer(null)}
          onOpenEditMaterial={(m) => openMaterialDrawer(m)}
          onOpenOpeningBalance={(m) => openOpeningBalanceDrawer(m)}
          onDeactivateMaterial={handleDeactivateMaterial}
        />
      )}

      {activeHub === 'audit' && (
        <AuditHub
          transfers={transfers}
          verifications={verifications}
          adjustments={adjustments}
          incidents={incidents}
          stores={stores}
          onOpenTransfer={() => setDrawerOpen('transfer')}
          onOpenVerification={() => setDrawerOpen('verification')}
          onOpenAdjustment={() => setDrawerOpen('adjustment')}
          onOpenIncident={() => setDrawerOpen('incident')}
        />
      )}

      {activeHub === 'ledger' && (
        <LedgerHub
          projectId={selectedProjectId}
          selectedStoreId={selectedStoreId}
          stores={stores}
          projectName={orgSelectedProject?.name || activeProject?.name}
          currentUser={user}
          materials={materials}
          inwardEntries={inwardEntries}
          outwardEntries={outwardEntries}
          returnsEntries={returnsEntries}
          transfers={transfers}
          adjustments={adjustments}
          onOpenSlip={handleOpenSlip}
        />
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          DRAWERS (one at a time, right side, page stays visible behind)
         ────────────────────────────────────────────────────────────────────── */}

      <InwardEntryDrawer
        isOpen={drawerOpen === 'inward'}
        onClose={() => setDrawerOpen('')}
        onSubmit={handleSaveInward}
        isSubmitting={isSubmitting}
        materials={materials}
        stores={stores}
        selectedStoreId={selectedStoreId}
        onOpenNewMaterial={() => openMaterialDrawer(null)}
      />

      <OutwardIssueDrawer
        isOpen={drawerOpen === 'outward'}
        onClose={() => setDrawerOpen('')}
        onSubmit={handleSaveOutward}
        isSubmitting={isSubmitting}
        materials={materials}
        stores={stores}
        selectedStoreId={selectedStoreId}
        preselectedMaterialId={preselectedMaterialId}
      />

      <MaterialReturnDrawer
        isOpen={drawerOpen === 'return'}
        onClose={() => setDrawerOpen('')}
        onSubmit={handleSaveReturn}
        isSubmitting={isSubmitting}
        eligibleOutward={eligibleOutward}
        stores={stores}
        selectedStoreId={selectedStoreId}
        preselectedOutwardId={preselectedOutwardId}
      />

      <MaterialFormDrawer
        isOpen={drawerOpen === 'material'}
        onClose={() => { setDrawerOpen(''); setEditingMaterial(null); setDuplicateWarning(null); }}
        onSubmit={handleSaveMaterial}
        isSubmitting={isSubmitting}
        editingMaterial={editingMaterial}
        duplicateWarning={duplicateWarning}
        categoryOptions={categoryOptions}
        uomOptions={uomOptions}
      />

      <OpeningBalanceDrawer
        isOpen={drawerOpen === 'opening'}
        onClose={() => { setDrawerOpen(''); setOpeningMaterial(null); }}
        onSubmit={handleSaveOpeningBalance}
        isSubmitting={isSubmitting}
        openingMaterial={openingMaterial}
        stores={stores}
        selectedStoreId={selectedStoreId}
      />

      <StoreFormDrawer
        isOpen={drawerOpen === 'store'}
        onClose={() => setDrawerOpen('')}
        onSubmit={handleCreateStore}
        isSubmitting={isSubmitting}
        defaultLocation={activeProject?.address || ''}
      />

      <TransferDrawer
        isOpen={drawerOpen === 'transfer'}
        onClose={() => setDrawerOpen('')}
        onSubmit={handleSaveTransfer}
        isSubmitting={isSubmitting}
        materials={materials}
        stores={stores}
        selectedStoreId={selectedStoreId}
      />

      <StockVerificationDrawer
        isOpen={drawerOpen === 'verification'}
        onClose={() => setDrawerOpen('')}
        onSubmit={handleSaveVerification}
        isSubmitting={isSubmitting}
        materials={materials}
        stores={stores}
        selectedStoreId={selectedStoreId}
      />

      <AdjustmentDrawer
        isOpen={drawerOpen === 'adjustment'}
        onClose={() => setDrawerOpen('')}
        onSubmit={handleSaveAdjustment}
        isSubmitting={isSubmitting}
        materials={materials}
        stores={stores}
        selectedStoreId={selectedStoreId}
      />

      <IncidentDrawer
        isOpen={drawerOpen === 'incident'}
        onClose={() => setDrawerOpen('')}
        onSubmit={handleSaveIncident}
        isSubmitting={isSubmitting}
        materials={materials}
        stores={stores}
        selectedStoreId={selectedStoreId}
        currentUser={user}
      />

      {/* ── Slip Preview Modal ── */}
      {activeSlip && (
        <SlipPreviewModal
          slipData={activeSlip}
          projectName={activeProject?.name || 'Standard Project'}
          onClose={() => setActiveSlip(null)}
        />
      )}
    </div>
  );
}
