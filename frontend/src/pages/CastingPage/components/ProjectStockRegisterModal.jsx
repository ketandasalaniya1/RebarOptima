import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Package, Plus, FileText, ArrowDownLeft, ArrowUpRight, 
  RotateCcw, AlertCircle, CheckCircle2, Truck, Calendar, 
  Layers, Search, Building2, Scale, Sparkles, Filter, 
  Clock, PackageOpen, RefreshCw, Trash2, ArrowRight
} from 'lucide-react';
import { castingApi } from '../castingApi';

export default function ProjectStockRegisterModal({
  isOpen,
  onClose,
  projectId,
  projectName
}) {
  if (!isOpen || !projectId) return null;

  const [activeTab, setActiveTab] = useState('balances'); // 'balances' | 'inward' | 'ledger'
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [stockBalances, setStockBalances] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);

  // Search & Filter state
  const [balanceSearch, setBalanceSearch] = useState('');
  const [balanceCategory, setBalanceCategory] = useState('ALL');
  const [ledgerFilter, setLedgerFilter] = useState('ALL');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Inward Form State
  const [inwardSubmitting, setInwardSubmitting] = useState(false);
  const [deliveryChallanNumber, setDeliveryChallanNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  
  // Inward Items (multi-line)
  const [inwardItems, setInwardItems] = useState([
    {
      materialIdentifier: 'OPC_53',
      specificationStandard: 'IS 269:2015',
      name: 'OPC 53 Grade Cement',
      category: 'CEMENT',
      receivedQuantity: 10,
      receivedUnit: 'METRIC_TONNE',
      canonicalTargetUnit: 'KG',
      specificGravity: null,
      batchNumber: ''
    }
  ]);

  useEffect(() => {
    loadData();
  }, [projectId, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      if (activeTab === 'balances') {
        const res = await castingApi.getProjectStock(projectId);
        setStockBalances(res?.data || []);
      } else if (activeTab === 'ledger') {
        const res = await castingApi.getStockLedger(projectId);
        setLedgerEntries(res?.data || []);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInwardLine = () => {
    setInwardItems(prev => [
      ...prev,
      {
        materialIdentifier: 'FINE_AGG_ZONE2',
        specificationStandard: 'IS 383:2016',
        name: 'Manufactured Sand (Zone II)',
        category: 'FINE_AGGREGATE',
        receivedQuantity: 20,
        receivedUnit: 'METRIC_TONNE',
        canonicalTargetUnit: 'KG',
        specificGravity: null,
        batchNumber: ''
      }
    ]);
  };

  const handleRemoveInwardLine = (idx) => {
    if (inwardItems.length <= 1) return;
    setInwardItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateInwardLine = (idx, field, val) => {
    const updated = [...inwardItems];
    updated[idx][field] = val;
    setInwardItems(updated);
  };

  const handleQuickInward = (material) => {
    setInwardItems([
      {
        materialIdentifier: material.materialIdentifier,
        specificationStandard: material.specificationStandard || 'IS 269:2015',
        name: material.name,
        category: material.category || 'CEMENT',
        receivedQuantity: 10,
        receivedUnit: 'METRIC_TONNE',
        canonicalTargetUnit: material.canonicalUnit || 'KG',
        specificGravity: null,
        batchNumber: ''
      }
    ]);
    setActiveTab('inward');
  };

  // Helper for live canonical conversion calculation preview
  const calculateCanonicalPreview = (qty, unit) => {
    const val = Number(qty) || 0;
    if (unit === 'METRIC_TONNE') {
      return `${(val * 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG`;
    }
    if (unit === 'BAGS_50KG') {
      return `${(val * 50).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG`;
    }
    if (unit === 'KG') {
      return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG`;
    }
    if (unit === 'LITERS') {
      return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
    }
    if (unit === 'M3') {
      return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`;
    }
    return `${val} ${unit}`;
  };

  const handleRecordInward = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!deliveryChallanNumber.trim()) {
      setErrorMsg('Delivery Challan / GRN number is required.');
      return;
    }
    if (!supplierName.trim()) {
      setErrorMsg('Supplier name is required.');
      return;
    }

    setInwardSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        deliveryChallanNumber: deliveryChallanNumber.trim(),
        supplierName: supplierName.trim(),
        truckNumber: truckNumber.trim(),
        receivedDate,
        remarks: remarks.trim(),
        items: inwardItems.map(item => ({
          materialIdentifier: item.materialIdentifier,
          specificationStandard: item.specificationStandard,
          name: item.name,
          category: item.category,
          receivedQuantity: Number(item.receivedQuantity),
          receivedUnit: item.receivedUnit,
          canonicalTargetUnit: item.canonicalTargetUnit,
          specificGravity: item.specificGravity ? Number(item.specificGravity) : undefined,
          batchNumber: item.batchNumber
        }))
      };

      const res = await castingApi.recordStockInward(projectId, payload);
      setSuccessMsg(`Material inward recorded successfully! Receipt: ${res?.data?.receiptNumber || deliveryChallanNumber}`);
      
      // Reset form
      setDeliveryChallanNumber('');
      setSupplierName('');
      setTruckNumber('');
      setRemarks('');
      
      setTimeout(() => {
        setActiveTab('balances');
        loadData();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record stock inward');
    } finally {
      setInwardSubmitting(false);
    }
  };

  // Filtered Balances
  const filteredBalances = useMemo(() => {
    return stockBalances.filter(st => {
      const matchSearch = !balanceSearch || 
        st.name?.toLowerCase().includes(balanceSearch.toLowerCase()) ||
        st.materialIdentifier?.toLowerCase().includes(balanceSearch.toLowerCase()) ||
        st.specificationStandard?.toLowerCase().includes(balanceSearch.toLowerCase());
      
      const matchCat = balanceCategory === 'ALL' || st.category === balanceCategory;
      return matchSearch && matchCat;
    });
  }, [stockBalances, balanceSearch, balanceCategory]);

  // Aggregate stats
  const totalStockKg = useMemo(() => {
    return stockBalances.reduce((sum, item) => {
      if (item.canonicalUnit === 'KG') return sum + (Number(item.currentBalance) || 0);
      return sum;
    }, 0);
  }, [stockBalances]);

  const uniqueCategories = useMemo(() => {
    return new Set(stockBalances.map(s => s.category)).size;
  }, [stockBalances]);

  // Filtered Ledger
  const filteredLedger = useMemo(() => {
    return ledgerEntries.filter(entry => {
      const matchSearch = !ledgerSearch || 
        entry.name?.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        entry.operationKey?.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        entry.materialIdentifier?.toLowerCase().includes(ledgerSearch.toLowerCase());

      if (ledgerFilter === 'INWARD') {
        return matchSearch && entry.transactionType === 'STOCK_INWARD';
      }
      if (ledgerFilter === 'OUTWARD') {
        return matchSearch && entry.transactionType === 'CASTING_CONSUMPTION_OUTWARD';
      }
      if (ledgerFilter === 'REVERSAL') {
        return matchSearch && entry.transactionType === 'CASTING_REVERSAL';
      }
      return matchSearch;
    });
  }, [ledgerEntries, ledgerFilter, ledgerSearch]);

  const getCategoryTagClass = (category) => {
    switch (category) {
      case 'CEMENT': return 'stock-cat-tag cement';
      case 'FINE_AGGREGATE': return 'stock-cat-tag fine-agg';
      case 'COARSE_AGGREGATE': return 'stock-cat-tag coarse-agg';
      case 'ADMIXTURE': return 'stock-cat-tag admixture';
      case 'FLY_ASH': return 'stock-cat-tag fly-ash';
      default: return 'stock-cat-tag';
    }
  };

  return (
    <div className="casting-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="casting-modal stock-register-modal" onClick={e => e.stopPropagation()}>
        
        {/* MODAL HEADER */}
        <div className="casting-modal-header" style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--card-border, #243046)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className="casting-icon-badge" style={{ width: '42px', height: '42px', borderRadius: '10px' }}>
              <Package size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 className="casting-modal-title" style={{ fontSize: '1.2rem', fontWeight: 700 }}>Project Material Stock Register</h3>
                <span className="stock-modal-badge">
                  <Building2 size={13} />
                  {projectName || projectId}
                </span>
              </div>
              <div className="stock-modal-header-meta">
                <span>Direct on-site inventory, goods receipts (GRN) & consumption ledger</span>
              </div>
            </div>
          </div>
          <button className="casting-modal-close" onClick={onClose} title="Close Modal">
            <X size={20} />
          </button>
        </div>

        {/* CAPSULE TAB NAVIGATION BAR */}
        <div style={{ padding: '0.85rem 1.75rem', borderBottom: '1px solid var(--card-border, #243046)', background: 'var(--main-bg, #0f172a)' }}>
          <div className="casting-nav-tabs" style={{ margin: 0 }}>
            <button
              type="button"
              className={`casting-nav-tab ${activeTab === 'balances' ? 'active' : ''}`}
              onClick={() => setActiveTab('balances')}
            >
              <Layers size={15} />
              Current Balances
              <span className="casting-tab-count">{stockBalances.length}</span>
            </button>

            <button
              type="button"
              className={`casting-nav-tab ${activeTab === 'inward' ? 'active' : ''}`}
              onClick={() => setActiveTab('inward')}
            >
              <Truck size={15} />
              Record Inward (GRN)
            </button>

            <button
              type="button"
              className={`casting-nav-tab ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setActiveTab('ledger')}
            >
              <Clock size={15} />
              Movement Ledger
              <span className="casting-tab-count">{ledgerEntries.length}</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="casting-modal-body" style={{ maxHeight: '68vh', overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
          
          {errorMsg && (
            <div className="casting-alert-banner danger" style={{ margin: '0 0 1rem 0' }}>
              <AlertCircle size={18} />
              <div style={{ fontSize: '0.85rem' }}>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="casting-alert-banner success" style={{ margin: '0 0 1rem 0' }}>
              <CheckCircle2 size={18} />
              <div style={{ fontSize: '0.85rem' }}>{successMsg}</div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: CURRENT STOCK BALANCES */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'balances' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-secondary, #94a3b8)' }}>
                <RefreshCw size={28} className="spinning" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.7 }} />
                Loading project inventory balances...
              </div>
            ) : stockBalances.length === 0 ? (
              <div className="stock-empty-state">
                <div className="stock-empty-icon">
                  <PackageOpen size={28} />
                </div>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary, #f8fafc)' }}>No Materials in Project Inventory</h4>
                <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary, #94a3b8)', maxWidth: '420px', lineHeight: 1.5 }}>
                  No stock has been received on this project site yet. Inward cement, aggregates, or admixtures to begin tracking pour consumption.
                </p>
                <button
                  type="button"
                  className="stock-btn-primary"
                  onClick={() => setActiveTab('inward')}
                  style={{ marginTop: '0.5rem' }}
                >
                  <Plus size={15} /> Record Initial Material Inward (GRN)
                </button>
              </div>
            ) : (
              <div>
                {/* Mini Stat Cards */}
                <div className="stock-stats-row">
                  <div className="stock-stat-mini">
                    <div className="stock-stat-mini-icon emerald">
                      <Package size={18} />
                    </div>
                    <div>
                      <div className="stock-stat-mini-val">{stockBalances.length}</div>
                      <div className="stock-stat-mini-lbl">Tracked Materials</div>
                    </div>
                  </div>

                  <div className="stock-stat-mini">
                    <div className="stock-stat-mini-icon blue">
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="stock-stat-mini-val">{uniqueCategories}</div>
                      <div className="stock-stat-mini-lbl">Categories</div>
                    </div>
                  </div>

                  <div className="stock-stat-mini">
                    <div className="stock-stat-mini-icon amber">
                      <Scale size={18} />
                    </div>
                    <div>
                      <div className="stock-stat-mini-val">
                        {totalStockKg > 0 ? `${(totalStockKg / 1000).toFixed(2)} MT` : `${stockBalances.length} Items`}
                      </div>
                      <div className="stock-stat-mini-lbl">Total Solid Stock</div>
                    </div>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="stock-toolbar">
                  {/* Category Pills */}
                  <div className="stock-filter-pills">
                    {['ALL', 'CEMENT', 'FINE_AGGREGATE', 'COARSE_AGGREGATE', 'ADMIXTURE', 'FLY_ASH'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`stock-filter-pill ${balanceCategory === cat ? 'active' : ''}`}
                        onClick={() => setBalanceCategory(cat)}
                      >
                        {cat === 'ALL' ? 'All Materials' : cat.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  {/* Search and Inward Button */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div className="stock-input-wrapper" style={{ width: '200px' }}>
                      <Search size={14} className="stock-input-icon" />
                      <input
                        type="text"
                        placeholder="Search stock..."
                        value={balanceSearch}
                        onChange={(e) => setBalanceSearch(e.target.value)}
                        className="stock-input"
                        style={{ height: '36px', fontSize: '0.8rem' }}
                      />
                    </div>
                    <button
                      type="button"
                      className="stock-btn-primary"
                      onClick={() => setActiveTab('inward')}
                      style={{ height: '36px', fontSize: '0.8rem', padding: '0 14px' }}
                    >
                      <Plus size={14} /> New Inward
                    </button>
                  </div>
                </div>

                {/* Balances Table */}
                <div className="casting-table-wrapper" style={{ background: 'var(--main-bg, #0f172a)', border: '1px solid var(--card-border, #243046)', borderRadius: '10px' }}>
                  <table className="casting-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Material & Specification</th>
                        <th style={{ textAlign: 'left' }}>Category</th>
                        <th style={{ textAlign: 'right' }}>Current Balance</th>
                        <th style={{ textAlign: 'center' }}>Last Movement</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBalances.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #94a3b8)' }}>
                            No materials matched your filter.
                          </td>
                        </tr>
                      ) : (
                        filteredBalances.map((st, idx) => (
                          <tr key={st._id || idx}>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>{st.name}</div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                                <code>{st.materialIdentifier}</code> &bull; {st.specificationStandard || 'Standard Specification'}
                              </div>
                            </td>
                            <td>
                              <span className={getCategoryTagClass(st.category)}>
                                {st.category?.replace('_', ' ')}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>
                                {Number(st.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary, #94a3b8)', marginLeft: '4px' }}>
                                  {st.canonicalUnit}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                              {st.updatedAt ? new Date(st.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Initial'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="stock-btn-secondary"
                                onClick={() => handleQuickInward(st)}
                                style={{ fontSize: '0.725rem', padding: '4px 10px', height: '28px' }}
                                title="Record new GRN for this specific material"
                              >
                                <Plus size={12} /> Inward Stock
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: RECORD MATERIAL INWARD (GRN) */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'inward' && (
            <form id="stock-inward-form" onSubmit={handleRecordInward}>
              {/* Consignment Metadata Card */}
              <div className="stock-grn-card">
                <div className="stock-grn-header">
                  <FileText size={16} color="#10b981" />
                  Delivery & Consignment Information
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="stock-field-label">
                      Challan / GRN # <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="stock-input-wrapper">
                      <FileText size={14} className="stock-input-icon" />
                      <input
                        type="text"
                        required
                        className="stock-input"
                        value={deliveryChallanNumber}
                        onChange={(e) => setDeliveryChallanNumber(e.target.value)}
                        placeholder="e.g. DC-2026-9812"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="stock-field-label">
                      Supplier / Vendor <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="stock-input-wrapper">
                      <Building2 size={14} className="stock-input-icon" />
                      <input
                        type="text"
                        required
                        className="stock-input"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        placeholder="e.g. UltraTech Cement Ltd."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="stock-field-label">
                      Truck / Vehicle #
                    </label>
                    <div className="stock-input-wrapper">
                      <Truck size={14} className="stock-input-icon" />
                      <input
                        type="text"
                        className="stock-input"
                        value={truckNumber}
                        onChange={(e) => setTruckNumber(e.target.value)}
                        placeholder="e.g. GJ-01-AB-1234"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="stock-field-label">
                      Receipt Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="stock-input-wrapper">
                      <Calendar size={14} className="stock-input-icon" />
                      <input
                        type="date"
                        required
                        className="stock-input"
                        value={receivedDate}
                        onChange={(e) => setReceivedDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivered Materials Line Items */}
              <div className="stock-grn-card" style={{ marginBottom: '1.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div className="stock-grn-header" style={{ margin: 0, padding: 0, border: 'none' }}>
                    <Layers size={16} color="#10b981" />
                    Material Consignments & Batches
                    <span className="stock-modal-badge" style={{ fontSize: '0.7rem', padding: '1px 7px' }}>
                      {inwardItems.length} lines
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddInwardLine}
                    className="stock-add-line-btn"
                  >
                    <Plus size={13} /> Add Material Line
                  </button>
                </div>

                <div className="casting-table-wrapper" style={{ overflowX: 'auto', background: 'var(--card-bg, #1a2234)', borderRadius: '8px', border: '1px solid var(--card-border, #243046)' }}>
                  <table className="casting-table" style={{ width: '100%', fontSize: '0.825rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', minWidth: '260px' }}>Material & Standard</th>
                        <th style={{ textAlign: 'right', minWidth: '130px' }}>Received Quantity</th>
                        <th style={{ textAlign: 'left', minWidth: '170px' }}>Delivery Unit</th>
                        <th style={{ textAlign: 'left', minWidth: '170px' }}>Conversion Preview</th>
                        <th style={{ textAlign: 'left', minWidth: '140px' }}>Batch / Mill #</th>
                        <th style={{ textAlign: 'center', width: '48px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {inwardItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <select
                              className="stock-field-select"
                              value={item.materialIdentifier}
                              onChange={(e) => {
                                const id = e.target.value;
                                let name = 'Material';
                                let cat = 'CEMENT';
                                let std = 'IS 269:2015';
                                let unit = 'KG';
                                if (id === 'OPC_53') { name = 'OPC 53 Grade Cement'; cat = 'CEMENT'; std = 'IS 269:2015'; unit = 'KG'; }
                                if (id === 'PPC') { name = 'Portland Pozzolana Cement'; cat = 'CEMENT'; std = 'IS 1489:2015'; unit = 'KG'; }
                                if (id === 'FINE_AGG_ZONE2') { name = 'Manufactured Sand (Zone II)'; cat = 'FINE_AGGREGATE'; std = 'IS 383:2016'; unit = 'KG'; }
                                if (id === 'COARSE_AGG_20MM') { name = 'Crushed Stone 20mm'; cat = 'COARSE_AGGREGATE'; std = 'IS 383:2016'; unit = 'KG'; }
                                if (id === 'COARSE_AGG_10MM') { name = 'Crushed Stone 10mm'; cat = 'COARSE_AGGREGATE'; std = 'IS 383:2016'; unit = 'KG'; }
                                if (id === 'ADMIXTURE_PCE') { name = 'Polycarboxylate Ether Superplasticizer'; cat = 'ADMIXTURE'; std = 'IS 9103:1999'; unit = 'LITERS'; }
                                if (id === 'FLY_ASH_CLASS_F') { name = 'Pulverized Fuel Ash (Fly Ash)'; cat = 'FLY_ASH'; std = 'IS 3812:2013'; unit = 'KG'; }
                                
                                const updated = [...inwardItems];
                                updated[idx].materialIdentifier = id;
                                updated[idx].name = name;
                                updated[idx].category = cat;
                                updated[idx].specificationStandard = std;
                                updated[idx].canonicalTargetUnit = unit;
                                setInwardItems(updated);
                              }}
                              style={{ width: '100%', height: '38px', fontSize: '0.825rem' }}
                            >
                              <optgroup label="Cement & Cementitious">
                                <option value="OPC_53">OPC 53 Grade Cement (IS 269)</option>
                                <option value="PPC">Portland Pozzolana Cement (IS 1489)</option>
                                <option value="FLY_ASH_CLASS_F">Fly Ash Class F (IS 3812)</option>
                              </optgroup>
                              <optgroup label="Aggregates">
                                <option value="FINE_AGG_ZONE2">Manufactured Sand Zone II (IS 383)</option>
                                <option value="COARSE_AGG_20MM">Crushed Stone 20mm (IS 383)</option>
                                <option value="COARSE_AGG_10MM">Crushed Stone 10mm (IS 383)</option>
                              </optgroup>
                              <optgroup label="Chemical Admixtures">
                                <option value="ADMIXTURE_PCE">PCE Superplasticizer (IS 9103)</option>
                              </optgroup>
                            </select>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                              Standard: <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{item.specificationStandard}</strong>
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              className="stock-input"
                              value={item.receivedQuantity}
                              onChange={(e) => handleUpdateInwardLine(idx, 'receivedQuantity', e.target.value)}
                              style={{ width: '100%', textAlign: 'right', fontSize: '0.875rem', fontWeight: 700, height: '38px' }}
                            />
                          </td>

                          <td>
                            <select
                              className="stock-field-select"
                              value={item.receivedUnit}
                              onChange={(e) => handleUpdateInwardLine(idx, 'receivedUnit', e.target.value)}
                              style={{ width: '100%', height: '38px', fontSize: '0.825rem' }}
                            >
                              <option value="METRIC_TONNE">Metric Tonne (MT)</option>
                              <option value="BAGS_50KG">Bags (50 KG)</option>
                              <option value="KG">Kilograms (KG)</option>
                              <option value="LITERS">Liters (L)</option>
                              <option value="M3">Cubic Meter (m³)</option>
                            </select>
                          </td>

                          <td>
                            <div className="stock-conversion-badge">
                              <Sparkles size={12} />
                              = {calculateCanonicalPreview(item.receivedQuantity, item.receivedUnit)}
                            </div>
                          </td>

                          <td>
                            <input
                              type="text"
                              className="stock-input"
                              value={item.batchNumber}
                              onChange={(e) => handleUpdateInwardLine(idx, 'batchNumber', e.target.value)}
                              placeholder="Batch / Mill #"
                              style={{ width: '100%', height: '38px', fontSize: '0.8rem' }}
                            />
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveInwardLine(idx)}
                              disabled={inwardItems.length <= 1}
                              className="stock-trash-btn"
                              title={inwardItems.length <= 1 ? "At least one item required" : "Remove line"}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks Field */}
              <div>
                <label className="stock-field-label">
                  Remarks / Gate Pass Inspection Notes
                </label>
                <input
                  type="text"
                  className="stock-input"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Weighbridge gross verified, manufacturer test certificate attached, unloaded in Silo #2"
                  style={{ width: '100%', height: '38px' }}
                />
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: STOCK MOVEMENT LEDGER */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'ledger' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-secondary, #94a3b8)' }}>
                <RefreshCw size={28} className="spinning" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.7 }} />
                Loading stock ledger transactions...
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="stock-empty-state">
                <div className="stock-empty-icon">
                  <Clock size={28} />
                </div>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary, #f8fafc)' }}>No Transaction Ledger History</h4>
                <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary, #94a3b8)', maxWidth: '420px', lineHeight: 1.5 }}>
                  Every inward receipt (GRN) and casting pour consumption automatically records a non-destructive audit entry here.
                </p>
              </div>
            ) : (
              <div>
                {/* Ledger Toolbar */}
                <div className="stock-toolbar">
                  <div className="stock-filter-pills">
                    {[
                      { id: 'ALL', label: 'All Movements' },
                      { id: 'INWARD', label: 'Inwards (GRN)' },
                      { id: 'OUTWARD', label: 'Pour Consumptions' },
                      { id: 'REVERSAL', label: 'Reversals' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className={`stock-filter-pill ${ledgerFilter === f.id ? 'active' : ''}`}
                        onClick={() => setLedgerFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="stock-input-wrapper" style={{ width: '220px' }}>
                    <Search size={14} className="stock-input-icon" />
                    <input
                      type="text"
                      placeholder="Search transactions..."
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      className="stock-input"
                      style={{ height: '36px', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="casting-table-wrapper" style={{ background: 'var(--main-bg, #0f172a)', border: '1px solid var(--card-border, #243046)', borderRadius: '10px' }}>
                  <table className="casting-table" style={{ width: '100%', fontSize: '0.825rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Date & Timestamp</th>
                        <th style={{ textAlign: 'left' }}>Transaction Type</th>
                        <th style={{ textAlign: 'left' }}>Material</th>
                        <th style={{ textAlign: 'right' }}>Net Quantity</th>
                        <th style={{ textAlign: 'left' }}>Reference / Operation Key</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLedger.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #94a3b8)' }}>
                            No transactions matched your search.
                          </td>
                        </tr>
                      ) : (
                        filteredLedger.map((entry, idx) => {
                          const isInward = entry.transactionType === 'STOCK_INWARD';
                          const isReversal = entry.transactionType === 'CASTING_REVERSAL';
                          const isOutward = entry.transactionType === 'CASTING_CONSUMPTION_OUTWARD';

                          return (
                            <tr key={entry._id || idx}>
                              <td style={{ color: 'var(--text-secondary, #94a3b8)', whiteSpace: 'nowrap' }}>
                                {new Date(entry.createdAt).toLocaleString(undefined, { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td>
                                <span style={{
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.725rem',
                                  fontWeight: 600,
                                  background: isInward 
                                    ? 'rgba(34, 197, 94, 0.12)' 
                                    : (isReversal ? 'rgba(234, 179, 8, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                                  color: isInward 
                                    ? '#4ade80' 
                                    : (isReversal ? '#facc15' : '#f87171'),
                                  border: `1px solid ${isInward ? 'rgba(34, 197, 94, 0.25)' : (isReversal ? 'rgba(234, 179, 8, 0.25)' : 'rgba(239, 68, 68, 0.25)')}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {isInward && <ArrowDownLeft size={13} />}
                                  {isReversal && <RotateCcw size={13} />}
                                  {isOutward && <ArrowUpRight size={13} />}
                                  {isInward ? 'STOCK INWARD (GRN)' : (isReversal ? 'REVERSAL' : 'POUR CONSUMPTION')}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>{entry.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)' }}>
                                  <code>{entry.materialIdentifier}</code>
                                </div>
                              </td>
                              <td style={{ 
                                textAlign: 'right', 
                                fontWeight: 700, 
                                fontSize: '0.9rem',
                                color: isInward ? '#4ade80' : (isReversal ? '#facc15' : '#f87171')
                              }}>
                                {isInward || isReversal ? `+${Number(entry.canonicalQuantity).toLocaleString()}` : `-${Number(entry.canonicalQuantity).toLocaleString()}`} {entry.canonicalUnit}
                              </td>
                              <td style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.75rem' }}>
                                <code style={{ color: 'var(--text-primary, #f8fafc)' }}>{entry.operationKey}</code>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>

        {/* MODAL FOOTER (Streamlined Single Action Bar) */}
        <div className="casting-modal-footer" style={{ padding: '1rem 1.75rem', background: 'var(--main-bg, #0f172a)', borderTop: '1px solid var(--card-border, #243046)' }}>
          {activeTab === 'inward' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button 
                type="button" 
                className="stock-btn-secondary" 
                onClick={() => setActiveTab('balances')}
                disabled={inwardSubmitting}
              >
                Back to Balances
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="stock-btn-secondary" 
                  onClick={onClose}
                  disabled={inwardSubmitting}
                >
                  Close
                </button>
                <button
                  type="submit"
                  form="stock-inward-form"
                  className="stock-btn-primary"
                  disabled={inwardSubmitting}
                >
                  {inwardSubmitting ? (
                    <>
                      <RefreshCw size={15} className="spinning" /> Posting GRN...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Post Material Inward (GRN)
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button className="stock-btn-secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
