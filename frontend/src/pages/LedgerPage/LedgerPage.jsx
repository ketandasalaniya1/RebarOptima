import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { inventoryApi, batchesApi } from '../../utils/api';
import html2pdf from 'html2pdf.js';
import { 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  BookOpen, 
  ClipboardCheck, 
  Calendar, 
  Filter, 
  Search,
  PackagePlus,
  Scale,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  X,
  FileDown,
  AlertCircle,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ListFilter,
  DollarSign,
  PieChart,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './LedgerPage.css';

export default function LedgerPage() {
  const user = useSelector((state) => state.auth.user);
  
  // Tab states: 'ledger' | 'inward-cost' | 'orders' | 'requests'
  const [activeTab, setActiveTab] = useState('ledger'); 
  const [ledger, setLedger] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // Filter Drawer & Filter States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [groupByBatch, setGroupByBatch] = useState(true);
  const [expandedBatches, setExpandedBatches] = useState({});
  const [ledgerFilter, setLedgerFilter] = useState('ALL'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDiameter, setFilterDiameter] = useState('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterReqStatus, setFilterReqStatus] = useState('ALL');

  const toggleBatchExpand = (batchId) => {
    setExpandedBatches(prev => ({
      ...prev,
      [batchId]: !prev[batchId]
    }));
  };

  // Order Requests State
  const [requests, setRequests] = useState([
    { id: 1, date: '2026-07-12 10:30', site: 'Sector-62 Site', requester: 'Amit Sharma (Engineer)', diameter: 12, quantity: 150, status: 'Pending', approver: '', approvedQuantity: 150 },
    { id: 2, date: '2026-07-14 09:15', site: 'Noida Site', requester: 'Amit Sharma (Engineer)', diameter: 16, quantity: 80, status: 'Approved', approver: 'Ketan (Owner)', approvedQuantity: 75 }
  ]);

  const [requestForm, setRequestForm] = useState({
    diameter: 12,
    quantity: '',
    site: user?.companyName ? `${user.companyName} Site` : 'Builder Site'
  });

  const [editQtyMap, setEditQtyMap] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError('');
      const [ledgerData, ordersData] = await Promise.all([
        inventoryApi.getLedger(),
        batchesApi.getHistory()
      ]);
      setLedger(ledgerData || []);
      setOrders(ordersData || []);
    } catch (err) {
      setError(err.message || 'Failed to load ledger data.');
    } finally {
      setLoading(false);
    }
  }

  // Active Filter Count calculation
  const getActiveFilterCount = () => {
    let count = 0;
    if (activeTab === 'ledger' || activeTab === 'inward-cost') {
      if (ledgerFilter !== 'ALL' && activeTab === 'ledger') count++;
      if (filterDiameter !== 'ALL') count++;
      if (filterStartDate) count++;
      if (filterEndDate) count++;
      if (filterVendor) count++;
    } else if (activeTab === 'orders') {
      if (filterStartDate) count++;
      if (filterEndDate) count++;
    } else if (activeTab === 'requests') {
      if (filterReqStatus !== 'ALL') count++;
      if (filterDiameter !== 'ALL') count++;
      if (filterStartDate) count++;
      if (filterEndDate) count++;
    }
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  const handleResetFilters = () => {
    setLedgerFilter('ALL');
    setFilterDiameter('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterVendor('');
    setFilterReqStatus('ALL');
    setSearchQuery('');
  };

  const isDateInRange = (dateStr) => {
    if (!filterStartDate && !filterEndDate) return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return true;
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      start.setHours(0, 0, 0, 0);
      if (date < start) return false;
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
    return true;
  };

  // Quick Preset Date Helpers for Inward Reports
  const setDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'ALL') {
      setFilterStartDate('');
      setFilterEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = now.toISOString().slice(0, 10);
      setFilterStartDate(todayStr);
      setFilterEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      setFilterStartDate(firstDay);
      setFilterEndDate(lastDay);
    } else if (preset === 'LAST_30_DAYS') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      setFilterStartDate(past30.toISOString().slice(0, 10));
      setFilterEndDate(now.toISOString().slice(0, 10));
    }
  };

  // Calculate Ledger Summary Metrics (in kg)
  const totalInwardKg = ledger
    .filter(t => t.type === 'INWARD')
    .reduce((sum, t) => sum + (t.weightInKgs || 0), 0);
  
  const totalConsumedKg = ledger
    .filter(t => t.type === 'OUTWARD')
    .reduce((sum, t) => sum + (t.weightInKgs || 0), 0);

  const totalRemnantsKg = ledger
    .filter(t => t.type === 'REMNANT')
    .reduce((sum, t) => sum + (t.weightInKgs || 0), 0);

  const netLiveStockKg = Math.max(0, totalInwardKg - totalConsumedKg + totalRemnantsKg);

  // Filtered Ledger List
  const filteredLedger = ledger.filter(item => {
    const matchesFilter = ledgerFilter === 'ALL' || item.type === ledgerFilter;
    const matchesDia = filterDiameter === 'ALL' || Number(item.diameter) === Number(filterDiameter);
    const matchesDate = isDateInRange(item.createdAt);
    const matchesVendor = !filterVendor || 
      (item.vendorName && item.vendorName.toLowerCase().includes(filterVendor.toLowerCase())) ||
      (item.brandName && item.brandName.toLowerCase().includes(filterVendor.toLowerCase()));
    const itemSearchStr = `${item.brandName || ''} ${item.vendorName || ''} ${item.referenceName || ''} ${item.diameter}mm ${item.type || ''}`.toLowerCase();
    const matchesSearch = !searchQuery || itemSearchStr.includes(searchQuery.toLowerCase());
    return matchesFilter && matchesDia && matchesDate && matchesVendor && matchesSearch;
  });

  // Dedicated Inward Items and Cost Analytics
  const inwardItems = useMemo(() => {
    return ledger.filter(t => {
      const isType = t.type === 'INWARD';
      const matchesDia = filterDiameter === 'ALL' || Number(t.diameter) === Number(filterDiameter);
      const matchesDate = isDateInRange(t.createdAt);
      const matchesVendor = !filterVendor || 
        (t.vendorName && t.vendorName.toLowerCase().includes(filterVendor.toLowerCase())) ||
        (t.brandName && t.brandName.toLowerCase().includes(filterVendor.toLowerCase()));
      const itemSearchStr = `${t.brandName || ''} ${t.vendorName || ''} ${t.referenceName || ''} ${t.diameter}mm`.toLowerCase();
      const matchesSearch = !searchQuery || itemSearchStr.includes(searchQuery.toLowerCase());
      return isType && matchesDia && matchesDate && matchesVendor && matchesSearch;
    });
  }, [ledger, filterDiameter, filterStartDate, filterEndDate, filterVendor, searchQuery]);

  const inwardTotalWeight = useMemo(() => {
    return inwardItems.reduce((sum, item) => sum + (item.weightInKgs || 0), 0);
  }, [inwardItems]);

  const inwardTotalCost = useMemo(() => {
    return inwardItems.reduce((sum, item) => sum + ((item.weightInKgs || 0) * (item.costPerKg || 0)), 0);
  }, [inwardItems]);

  const inwardTotalBars = useMemo(() => {
    return inwardItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [inwardItems]);

  const inwardAvgRatePerKg = inwardTotalWeight > 0 ? (inwardTotalCost / inwardTotalWeight) : 0;

  // Diameter-wise Inward & Cost Breakdown
  const diameterBreakdown = useMemo(() => {
    const map = {};
    [8, 10, 12, 16, 20, 25, 32].forEach(d => {
      map[d] = { diameter: d, weight: 0, cost: 0, bars: 0, entries: 0 };
    });

    inwardItems.forEach(item => {
      const d = item.diameter || 12;
      if (!map[d]) {
        map[d] = { diameter: d, weight: 0, cost: 0, bars: 0, entries: 0 };
      }
      const wt = item.weightInKgs || 0;
      const cst = wt * (item.costPerKg || 0);
      map[d].weight += wt;
      map[d].cost += cst;
      map[d].bars += (item.quantity || 0);
      map[d].entries += 1;
    });

    return Object.values(map).filter(d => d.entries > 0 || inwardItems.length === 0);
  }, [inwardItems]);

  // Vendor-wise Inward & Procurement Share Breakdown
  const vendorBreakdown = useMemo(() => {
    const map = {};
    inwardItems.forEach(item => {
      const vName = item.vendorName || item.brandName || 'Standard Supplier';
      if (!map[vName]) {
        map[vName] = { vendor: vName, weight: 0, cost: 0, bars: 0, entries: 0 };
      }
      const wt = item.weightInKgs || 0;
      const cst = wt * (item.costPerKg || 0);
      map[vName].weight += wt;
      map[vName].cost += cst;
      map[vName].bars += (item.quantity || 0);
      map[vName].entries += 1;
    });
    return Object.values(map);
  }, [inwardItems]);

  // Group ledger entries by batch when enabled
  const groupedLedger = useMemo(() => {
    if (!groupByBatch) {
      return filteredLedger.map(item => ({ isGroup: false, data: item }));
    }

    const result = [];
    const batchGroupMap = new Map();

    filteredLedger.forEach(item => {
      // Determine if item is part of a cutting optimization batch (outward, remnant, scrap or batch reference)
      const isBatchOutward = item.type === 'OUTWARD' || item.type === 'REMNANT' || item.type === 'SCRAP';
      const isNamedBatch = item.referenceName && item.referenceName !== 'Manual Inward Entry' && !item.referenceName.toLowerCase().includes('manual');

      if (isBatchOutward || (isNamedBatch && item.type !== 'INWARD')) {
        const batchName = item.referenceName || 'Cutting Batch';
        const dateKey = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 16) : 'same-time';
        const groupKey = `${batchName}__${dateKey}`;

        if (!batchGroupMap.has(groupKey)) {
          const newGroup = {
            isGroup: true,
            id: groupKey,
            batchName: batchName,
            createdAt: item.createdAt,
            items: [],
            totalOutwardWeight: 0,
            totalOutwardQty: 0,
            totalRemnantWeight: 0,
            totalRemnantQty: 0,
            totalScrapWeight: 0,
            totalScrapQty: 0,
            diameters: new Set(),
            brandNames: new Set(),
            vendorNames: new Set()
          };
          batchGroupMap.set(groupKey, newGroup);
          result.push(newGroup);
        }

        const group = batchGroupMap.get(groupKey);
        group.items.push(item);
        if (item.type === 'OUTWARD') {
          group.totalOutwardWeight += (item.weightInKgs || 0);
          group.totalOutwardQty += (item.quantity || 0);
        } else if (item.type === 'REMNANT') {
          group.totalRemnantWeight += (item.weightInKgs || 0);
          group.totalRemnantQty += (item.quantity || 0);
        } else if (item.type === 'SCRAP') {
          group.totalScrapWeight += (item.weightInKgs || 0);
          group.totalScrapQty += (item.quantity || 0);
        }
        if (item.diameter) group.diameters.add(item.diameter);
        if (item.brandName) group.brandNames.add(item.brandName);
        if (item.vendorName) group.vendorNames.add(item.vendorName);
      } else {
        // Regular inward entry or standalone entry
        result.push({ isGroup: false, data: item });
      }
    });

    return result;
  }, [filteredLedger, groupByBatch]);

  const toggleAllBatches = () => {
    const areSomeExpanded = Object.values(expandedBatches).some(Boolean);
    if (areSomeExpanded) {
      setExpandedBatches({});
    } else {
      const all = {};
      groupedLedger.forEach(item => {
        if (item.isGroup) all[item.id] = true;
      });
      setExpandedBatches(all);
    }
  };

  // Filtered Orders List
  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchQuery || order.batchName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = isDateInRange(order.createdAt);
    return matchesSearch && matchesDate;
  });

  // Filtered Requests List
  const filteredRequests = requests.filter(req => {
    const matchesStatus = filterReqStatus === 'ALL' || req.status.toLowerCase() === filterReqStatus.toLowerCase();
    const matchesDia = filterDiameter === 'ALL' || Number(req.diameter) === Number(filterDiameter);
    const reqSearchStr = `${req.requester || ''} ${req.site || ''} ${req.diameter}mm ${req.status || ''}`.toLowerCase();
    const matchesSearch = !searchQuery || reqSearchStr.includes(searchQuery.toLowerCase());
    return matchesStatus && matchesDia && matchesSearch;
  });

  // Print Report Handler
  const handlePrintReport = async () => {
    setIsPrinting(true);
    const reportElem = document.getElementById('ledger-print-report-container');
    if (!reportElem) {
      setIsPrinting(false);
      return;
    }

    reportElem.classList.remove('no-screen');

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `ledger_procurement_report_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        windowWidth: 850
      },
      pagebreak: { mode: ['css', 'legacy'], after: '.pdf-page-break' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    try {
      await html2pdf().set(opt).from(reportElem).save();
      setSuccess('Ledger report exported successfully as PDF!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      window.print();
    } finally {
      reportElem.classList.add('no-screen');
      setIsPrinting(false);
    }
  };

  // Engineer Request Submission
  const handleRequestSubmit = (e) => {
    e.preventDefault();
    const qty = parseInt(requestForm.quantity) || 0;
    if (qty <= 0) return;

    const newReq = {
      id: Date.now(),
      date: new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }),
      site: requestForm.site,
      requester: `${user?.firstName || 'User'} (${user?.role || 'Staff'})`,
      diameter: Number(requestForm.diameter),
      quantity: qty,
      status: 'Pending',
      approver: '',
      approvedQuantity: qty
    };

    setRequests(prev => [newReq, ...prev]);
    setRequestForm(prev => ({ ...prev, quantity: '' }));
    setSuccess('Steel order request submitted successfully!');
    setTimeout(() => setSuccess(''), 1500);
  };

  // Owner/Admin approval & editing
  const handleApprove = (id) => {
    const editVal = editQtyMap[id];
    setRequests(prev => prev.map(req => {
      if (req.id !== id) return req;
      const finalQty = editVal !== undefined ? (parseInt(editVal) || 0) : req.quantity;
      return {
        ...req,
        status: 'Approved',
        approver: `${user?.firstName || 'User'} (${user?.role || 'Admin'})`,
        approvedQuantity: finalQty
      };
    }));
    setSuccess('Order request approved successfully!');
    setTimeout(() => setSuccess(''), 1500);
  };

  const handleReject = (id) => {
    setRequests(prev => prev.map(req => {
      if (req.id !== id) return req;
      return {
        ...req,
        status: 'Rejected',
        approver: `${user?.firstName || 'User'} (${user?.role || 'Admin'})`,
        approvedQuantity: 0
      };
    }));
    setSuccess('Order request rejected.');
    setTimeout(() => setSuccess(''), 1500);
  };

  const handleEditQtyChange = (id, val) => {
    setEditQtyMap(prev => ({ ...prev, [id]: val }));
  };

  if (loading) {
    return <LoadingSpinner message="Loading material ledger & procurement logs..." minHeight="65vh" />;
  }

  return (
    <div className="ledger-page">
      {/* Page Header */}
      <div className="ledger-header-row">
        <div className="header-title-block">
          <h1 className="ledger-title">Ledger & Procurement</h1>
          <p className="ledger-subtitle">Track material ledger logs, optimization batches, and site purchase requests.</p>
        </div>
        
        <div className="header-controls-block">
          <div className="tab-buttons">
            <button 
              className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => { setActiveTab('ledger'); setSearchQuery(''); }}
            >
              <BookOpen size={15} />
              <span>Audit Ledger</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'inward-cost' ? 'active' : ''}`}
              onClick={() => { setActiveTab('inward-cost'); setSearchQuery(''); }}
            >
              <DollarSign size={15} />
              <span>Inward Cost Report</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => { setActiveTab('orders'); setSearchQuery(''); }}
            >
              <ClipboardCheck size={15} />
              <span>Batch Orders</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => { setActiveTab('requests'); setSearchQuery(''); }}
            >
              <Clock size={15} />
              <span>Order Requests</span>
            </button>
          </div>

          <div className="header-actions-group">
            <button 
              className="btn-print-action"
              onClick={handlePrintReport}
              disabled={isPrinting}
              title="Print or export PDF report"
            >
              <Printer size={15} />
              <span>{isPrinting ? 'Exporting...' : 'Print Report'}</span>
            </button>
          </div>
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

      {/* TAB 1: Audit Ledger */}
      {activeTab === 'ledger' && (
        <>
          {/* Summary Cards */}
          <div className="ledger-stats-grid">
            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Inward Deliveries</span>
                <span className="mini-val">{totalInwardKg.toLocaleString()} <span className="u">kg</span></span>
              </div>
              <div className="mini-icon inward"><TrendingUp size={20} /></div>
            </div>
            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Consumed Optimization Weight</span>
                <span className="mini-val text-orange">{totalConsumedKg.toLocaleString()} <span className="u">kg</span></span>
              </div>
              <div className="mini-icon outward"><TrendingDown size={20} /></div>
            </div>
            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Recovered Remnants Yield</span>
                <span className="mini-val text-green">{totalRemnantsKg.toLocaleString()} <span className="u">kg</span></span>
              </div>
              <div className="mini-icon remnants"><Sparkles size={20} /></div>
            </div>
            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Current Warehouse Valuation</span>
                <span className="mini-val">₹{(netLiveStockKg * 60).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="mini-icon stock"><Scale size={20} /></div>
            </div>
          </div>

          {/* Ledger table card */}
          <div className="card table-card">
            <div className="table-header">
              <div className="filters-row">
                <button 
                  className={`filter-badge ${ledgerFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setLedgerFilter('ALL')}
                >
                  All Logs ({ledger.length})
                </button>
                <button 
                  className={`filter-badge ${ledgerFilter === 'INWARD' ? 'active' : ''}`}
                  onClick={() => setLedgerFilter('INWARD')}
                >
                  Inwards
                </button>
                <button 
                  className={`filter-badge ${ledgerFilter === 'OUTWARD' ? 'active' : ''}`}
                  onClick={() => setLedgerFilter('OUTWARD')}
                >
                  Outwards
                </button>
                <button 
                  className={`filter-badge ${ledgerFilter === 'REMNANT' ? 'active' : ''}`}
                  onClick={() => setLedgerFilter('REMNANT')}
                >
                  Remnants
                </button>
                <button 
                  className={`filter-badge ${ledgerFilter === 'SCRAP' ? 'active' : ''}`}
                  onClick={() => setLedgerFilter('SCRAP')}
                >
                  Scraps
                </button>
              </div>

              <div className="table-header-right">
                <div className="search-box">
                  <Search size={14} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search brand, vendor, dia..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>

                <button 
                  className={`btn-table-filter ${isFilterOpen || activeFilterCount > 0 ? 'active' : ''}`}
                  onClick={() => setIsFilterOpen(prev => !prev)}
                  title="Toggle filter controls"
                >
                  <Filter size={14} />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="filter-count-badge">{activeFilterCount}</span>
                  )}
                </button>

                <button 
                  className={`btn-table-toggle-group ${groupByBatch ? 'active' : ''}`}
                  onClick={() => setGroupByBatch(prev => !prev)}
                  title={groupByBatch ? "Switch to Flat View" : "Group outward items by Batch"}
                >
                  <Layers size={14} />
                  <span>{groupByBatch ? 'Batch Grouped' : 'Flat List'}</span>
                </button>

                {groupByBatch && (
                  <button 
                    className="btn-table-action-subtle"
                    onClick={toggleAllBatches}
                    title="Expand or collapse all batches"
                  >
                    <ChevronsUpDown size={14} />
                    <span>{Object.values(expandedBatches).some(Boolean) ? 'Collapse All' : 'Expand All'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Expandable Filter Panel inside Table Card */}
            {isFilterOpen && (
              <div className="table-filter-drawer">
                <div className="filter-drawer-header">
                  <div className="filter-header-title">
                    <SlidersHorizontal size={15} />
                    <span>Filter Logs by Date, Diameter & Vendor</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button className="btn-reset-filters" onClick={handleResetFilters}>
                      <RotateCcw size={12} />
                      <span>Reset All</span>
                    </button>
                  )}
                </div>

                <div className="filter-controls-grid">
                  {/* Date Range Start */}
                  <div className="filter-field">
                    <label>From Date</label>
                    <input 
                      type="date" 
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="filter-input"
                    />
                  </div>

                  {/* Date Range End */}
                  <div className="filter-field">
                    <label>To Date</label>
                    <input 
                      type="date" 
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="filter-input"
                    />
                  </div>

                  {/* Diameter Filter */}
                  <div className="filter-field">
                    <label>Diameter</label>
                    <select 
                      value={filterDiameter}
                      onChange={(e) => setFilterDiameter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="ALL">All Diameters</option>
                      {[8, 10, 12, 16, 20, 25, 32].map(d => (
                        <option key={d} value={d}>{d} mm</option>
                      ))}
                    </select>
                  </div>

                  {/* Type Filter */}
                  <div className="filter-field">
                    <label>Transaction Type</label>
                    <select 
                      value={ledgerFilter}
                      onChange={(e) => setLedgerFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="ALL">All Transaction Types</option>
                      <option value="INWARD">Inwards (Stock Addition)</option>
                      <option value="OUTWARD">Outwards (Consumed)</option>
                      <option value="REMNANT">Remnants (Yield)</option>
                      <option value="SCRAP">Scraps (Waste)</option>
                    </select>
                  </div>

                  {/* Vendor / Brand Filter */}
                  <div className="filter-field">
                    <label>Vendor / Brand</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Tata, Jindal, Sai Traders"
                      value={filterVendor}
                      onChange={(e) => setFilterVendor(e.target.value)}
                      className="filter-input"
                    />
                  </div>
                </div>

                {/* Active filter chips */}
                {activeFilterCount > 0 && (
                  <div className="active-chips-row">
                    <span className="active-chips-label">Active Filters:</span>
                    {filterStartDate && (
                      <span className="filter-chip">
                        From: {filterStartDate}
                        <button onClick={() => setFilterStartDate('')}><X size={12} /></button>
                      </span>
                    )}
                    {filterEndDate && (
                      <span className="filter-chip">
                        To: {filterEndDate}
                        <button onClick={() => setFilterEndDate('')}><X size={12} /></button>
                      </span>
                    )}
                    {filterDiameter !== 'ALL' && (
                      <span className="filter-chip">
                        Dia: {filterDiameter}mm
                        <button onClick={() => setFilterDiameter('ALL')}><X size={12} /></button>
                      </span>
                    )}
                    {ledgerFilter !== 'ALL' && (
                      <span className="filter-chip">
                        Type: {ledgerFilter}
                        <button onClick={() => setLedgerFilter('ALL')}><X size={12} /></button>
                      </span>
                    )}
                    {filterVendor && (
                      <span className="filter-chip">
                        Vendor: {filterVendor}
                        <button onClick={() => setFilterVendor('')}><X size={12} /></button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Diameter</th>
                    <th>Length</th>
                    <th>Qty (Bars)</th>
                    <th>Weight</th>
                    <th>Cost (per kg)</th>
                    <th>Reference / Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedLedger.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        No ledger transactions found matching the applied filters.
                      </td>
                    </tr>
                  ) : (
                    groupedLedger.map((row) => {
                      if (row.isGroup) {
                        const isExpanded = !!expandedBatches[row.id];
                        const diaList = Array.from(row.diameters).sort((a, b) => a - b);
                        const vendors = Array.from(row.vendorNames).filter(Boolean);
                        const brands = Array.from(row.brandNames).filter(Boolean);

                        return (
                          <React.Fragment key={row.id}>
                            <tr 
                              className={`ledger-batch-row ${isExpanded ? 'expanded' : ''}`}
                              onClick={() => toggleBatchExpand(row.id)}
                            >
                              <td className="ledger-date-col">
                                <div className="date-with-toggle">
                                  <button 
                                    className={`batch-chevron-btn ${isExpanded ? 'open' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); toggleBatchExpand(row.id); }}
                                    title={isExpanded ? 'Collapse batch entries' : 'Expand batch entries'}
                                  >
                                    <ChevronRight size={15} />
                                  </button>
                                  <Calendar size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                  {new Date(row.createdAt).toLocaleString('en-GB')}
                                </div>
                              </td>
                              <td>
                                <div className="batch-badge-pill">
                                  <Layers size={13} />
                                  <span>BATCH OUTWARD</span>
                                  <span className="batch-sub-count">{row.items.length} logs</span>
                                </div>
                              </td>
                              <td className="font-bold">
                                {diaList.length > 0 ? diaList.map(d => `${d} mm`).join(', ') : '-'}
                              </td>
                              <td>
                                <span className="batch-summary-tag">Batch Run</span>
                              </td>
                              <td className="font-bold">
                                {row.totalOutwardQty} bars
                                {row.totalRemnantQty > 0 && (
                                  <span className="text-secondary" style={{ fontSize: '11px', display: 'block', fontWeight: 500 }}>
                                    (+{row.totalRemnantQty} rem)
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="font-bold text-orange">{Math.round(row.totalOutwardWeight).toLocaleString()} kg</span>
                                {row.totalRemnantWeight > 0 && (
                                  <span className="text-green" style={{ fontSize: '11px', display: 'block', fontWeight: 600 }}>
                                    +{Math.round(row.totalRemnantWeight)} kg rem
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="text-secondary" style={{ fontSize: '12px' }}>
                                  ₹{row.items[0]?.costPerKg?.toFixed(2) || '0.00'}
                                </span>
                              </td>
                              <td>
                                <div className="vendor-ref-cell">
                                  <span className="font-bold text-accent">{row.batchName}</span>
                                  <span className="text-secondary" style={{ fontSize: '11px' }}>
                                    {vendors.join(', ') || brands.join(', ') || 'Cutting Optimization'}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Nested Subitems Table Row */}
                            {isExpanded && (
                              <tr className="batch-expanded-row">
                                <td colSpan="8" className="batch-expanded-container-td">
                                  <div className="batch-subitems-wrapper">
                                    <div className="batch-subitems-header">
                                      <div className="subitems-title">
                                        <Layers size={14} className="text-accent" />
                                        <span>Individual Bar Entries for <strong>{row.batchName}</strong> ({row.items.length} records)</span>
                                      </div>
                                      <div className="subitems-meta">
                                        <span>Outward: <strong>{Math.round(row.totalOutwardWeight)} kg</strong></span>
                                        <span>•</span>
                                        <span>Remnants: <strong>{Math.round(row.totalRemnantWeight)} kg</strong></span>
                                        {row.totalScrapWeight > 0 && (
                                          <>
                                            <span>•</span>
                                            <span>Scraps: <strong>{Math.round(row.totalScrapWeight)} kg</strong></span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <table className="batch-nested-table">
                                      <thead>
                                        <tr>
                                          <th style={{ width: '40px' }}>#</th>
                                          <th>Type</th>
                                          <th>Diameter</th>
                                          <th>Length</th>
                                          <th>Quantity</th>
                                          <th>Weight (kg)</th>
                                          <th>Cost/kg</th>
                                          <th>Brand / Vendor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {row.items.map((subItem, sIdx) => (
                                          <tr key={subItem._id || sIdx} className={`nested-row-${subItem.type.toLowerCase()}`}>
                                            <td className="nested-idx">{sIdx + 1}</td>
                                            <td>
                                              <span className={`ledger-type-badge ${subItem.type.toLowerCase()}`}>
                                                {subItem.type}
                                              </span>
                                            </td>
                                            <td className="font-bold">{subItem.diameter} mm</td>
                                            <td>{(subItem.length / 1000).toFixed(1)} m</td>
                                            <td className="font-bold">{subItem.quantity}</td>
                                            <td>{Math.round(subItem.weightInKgs).toLocaleString()} kg</td>
                                            <td>₹{subItem.costPerKg?.toFixed(2) || '0.00'}</td>
                                            <td>
                                              <div className="vendor-ref-cell">
                                                <span>{subItem.brandName || subItem.vendorName || '-'}</span>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      }

                      // Standalone single transaction row (e.g. Inward)
                      const item = row.data;
                      return (
                        <tr key={item._id}>
                          <td className="ledger-date-col">
                            <div className="date-with-toggle">
                              <span className="batch-chevron-placeholder" />
                              <Calendar size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              {new Date(item.createdAt).toLocaleString('en-GB')}
                            </div>
                          </td>
                          <td>
                            <span className={`ledger-type-badge ${item.type.toLowerCase()}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="font-bold">{item.diameter} mm</td>
                          <td>{(item.length / 1000).toFixed(1)} m</td>
                          <td className="font-bold">{item.quantity}</td>
                          <td>{Math.round(item.weightInKgs).toLocaleString()} kg</td>
                          <td>₹{item.costPerKg?.toFixed(2)}</td>
                          <td>
                            <div className="vendor-ref-cell">
                              <span className="font-bold">{item.vendorName || '-'}</span>
                              <span className="text-secondary" style={{ fontSize: '11px' }}>
                                {item.brandName ? `Brand: ${item.brandName}` : ''}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: Customized Steel Inward & Procurement Cost Report */}
      {activeTab === 'inward-cost' && (
        <div className="inward-report-portal">
          {/* Inward KPI Metric Cards */}
          <div className="ledger-stats-grid">
            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Total Steel Inward Weight</span>
                <span className="mini-val text-green">{inwardTotalWeight.toLocaleString()} <span className="u">kg</span></span>
                <span className="text-secondary" style={{ fontSize: '11.5px', marginTop: '2px' }}>
                  {(inwardTotalWeight / 1000).toFixed(2)} Metric Tons
                </span>
              </div>
              <div className="mini-icon inward"><TrendingUp size={22} /></div>
            </div>

            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Total Inward Procurement Cost</span>
                <span className="mini-val text-accent">₹{inwardTotalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                <span className="text-secondary" style={{ fontSize: '11.5px', marginTop: '2px' }}>
                  Total Invoiced Expenditure
                </span>
              </div>
              <div className="mini-icon stock"><DollarSign size={22} /></div>
            </div>

            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Weighted Avg Procurement Rate</span>
                <span className="mini-val">₹{inwardAvgRatePerKg.toFixed(2)} <span className="u">/ kg</span></span>
                <span className="text-secondary" style={{ fontSize: '11.5px', marginTop: '2px' }}>
                  ₹{Math.round(inwardAvgRatePerKg * 1000).toLocaleString('en-IN')} / Ton
                </span>
              </div>
              <div className="mini-icon outward"><Scale size={22} /></div>
            </div>

            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Inward Volume & Deliveries</span>
                <span className="mini-val">{inwardTotalBars.toLocaleString()} <span className="u">bars</span></span>
                <span className="text-secondary" style={{ fontSize: '11.5px', marginTop: '2px' }}>
                  Across {inwardItems.length} verified deliveries
                </span>
              </div>
              <div className="mini-icon remnants"><PackagePlus size={22} /></div>
            </div>
          </div>

          {/* Inward Customizer Toolbar & Filters Card */}
          <div className="card table-card">
            <div className="inward-customizer-bar">
              <div className="preset-date-pills">
                <span className="preset-label">Period Presets:</span>
                <button 
                  className={`filter-badge ${!filterStartDate && !filterEndDate ? 'active' : ''}`}
                  onClick={() => setDatePreset('ALL')}
                >
                  All Time
                </button>
                <button 
                  className="filter-badge"
                  onClick={() => setDatePreset('THIS_MONTH')}
                >
                  This Month
                </button>
                <button 
                  className="filter-badge"
                  onClick={() => setDatePreset('LAST_30_DAYS')}
                >
                  Last 30 Days
                </button>
                <button 
                  className="filter-badge"
                  onClick={() => setDatePreset('TODAY')}
                >
                  Today
                </button>
              </div>

              <div className="table-header-right">
                <div className="search-box">
                  <Search size={14} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search vendor, brand, dia..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>

                <button 
                  className={`btn-table-filter ${isFilterOpen || activeFilterCount > 0 ? 'active' : ''}`}
                  onClick={() => setIsFilterOpen(prev => !prev)}
                  title="Toggle filter controls"
                >
                  <Filter size={14} />
                  <span>Custom Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="filter-count-badge">{activeFilterCount}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Expandable Filter for Inward Report */}
            {isFilterOpen && (
              <div className="table-filter-drawer">
                <div className="filter-drawer-header">
                  <div className="filter-header-title">
                    <SlidersHorizontal size={15} />
                    <span>Customize Inward Date Range, Diameter & Supplier</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button className="btn-reset-filters" onClick={handleResetFilters}>
                      <RotateCcw size={12} />
                      <span>Reset All</span>
                    </button>
                  )}
                </div>

                <div className="filter-controls-grid">
                  <div className="filter-field">
                    <label>From Date</label>
                    <input 
                      type="date" 
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="filter-input"
                    />
                  </div>
                  <div className="filter-field">
                    <label>To Date</label>
                    <input 
                      type="date" 
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="filter-input"
                    />
                  </div>
                  <div className="filter-field">
                    <label>Diameter</label>
                    <select 
                      value={filterDiameter}
                      onChange={(e) => setFilterDiameter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="ALL">All Diameters</option>
                      {[8, 10, 12, 16, 20, 25, 32].map(d => (
                        <option key={d} value={d}>{d} mm</option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label>Supplier / Brand</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Tata, Jindal, Sai Traders"
                      value={filterVendor}
                      onChange={(e) => setFilterVendor(e.target.value)}
                      className="filter-input"
                    />
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <div className="active-chips-row">
                    <span className="active-chips-label">Active Filters:</span>
                    {filterStartDate && (
                      <span className="filter-chip">
                        From: {filterStartDate}
                        <button onClick={() => setFilterStartDate('')}><X size={12} /></button>
                      </span>
                    )}
                    {filterEndDate && (
                      <span className="filter-chip">
                        To: {filterEndDate}
                        <button onClick={() => setFilterEndDate('')}><X size={12} /></button>
                      </span>
                    )}
                    {filterDiameter !== 'ALL' && (
                      <span className="filter-chip">
                        Dia: {filterDiameter}mm
                        <button onClick={() => setFilterDiameter('ALL')}><X size={12} /></button>
                      </span>
                    )}
                    {filterVendor && (
                      <span className="filter-chip">
                        Supplier: {filterVendor}
                        <button onClick={() => setFilterVendor('')}><X size={12} /></button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dual Inward Breakdown Matrices: Diameter & Vendor */}
          <div className="inward-matrices-grid">
            {/* Diameter-wise Matrix Card */}
            <div className="card matrix-card">
              <div className="matrix-card-header">
                <div className="matrix-title">
                  <BarChart3 size={17} className="text-green" />
                  <span>Diameter-wise Inward & Cost Breakdown</span>
                </div>
                <span className="matrix-subtitle">Weight & Procurement Spend by Bar Size</span>
              </div>

              <div className="table-responsive">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>Diameter</th>
                      <th>Bars</th>
                      <th>Weight (kg)</th>
                      <th>Total Cost (₹)</th>
                      <th>Avg Rate</th>
                      <th>Weight Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diameterBreakdown.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>No diameter records found</td></tr>
                    ) : (
                      diameterBreakdown.map(d => {
                        const pct = inwardTotalWeight > 0 ? ((d.weight / inwardTotalWeight) * 100).toFixed(1) : 0;
                        const avgRate = d.weight > 0 ? (d.cost / d.weight).toFixed(2) : '0.00';
                        return (
                          <tr key={d.diameter}>
                            <td className="font-bold">{d.diameter} mm</td>
                            <td>{d.bars.toLocaleString()}</td>
                            <td className="font-bold">{Math.round(d.weight).toLocaleString()} kg</td>
                            <td className="font-bold text-accent">₹{Math.round(d.cost).toLocaleString('en-IN')}</td>
                            <td>₹{avgRate}/kg</td>
                            <td>
                              <div className="progress-cell">
                                <div className="mini-progress-bar-container">
                                  <div className="mini-progress-bar" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="pct-text">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vendor / Supplier Procurement Matrix Card */}
            <div className="card matrix-card">
              <div className="matrix-card-header">
                <div className="matrix-title">
                  <PieChart size={17} className="text-orange" />
                  <span>Supplier & Vendor Procurement Share</span>
                </div>
                <span className="matrix-subtitle">Vendor supply volume, invoice values & rates</span>
              </div>

              <div className="table-responsive">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>Supplier / Brand</th>
                      <th>Deliveries</th>
                      <th>Weight (Tons)</th>
                      <th>Total Spend (₹)</th>
                      <th>Avg Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorBreakdown.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>No vendor records found</td></tr>
                    ) : (
                      vendorBreakdown.map(v => {
                        const avgRate = v.weight > 0 ? (v.cost / v.weight).toFixed(2) : '0.00';
                        return (
                          <tr key={v.vendor}>
                            <td className="font-bold">{v.vendor}</td>
                            <td>{v.entries} receipts</td>
                            <td className="font-bold">{(v.weight / 1000).toFixed(2)} T <span className="text-secondary" style={{ fontSize: '11px' }}>({Math.round(v.weight).toLocaleString()} kg)</span></td>
                            <td className="font-bold text-accent">₹{Math.round(v.cost).toLocaleString('en-IN')}</td>
                            <td>₹{avgRate}/kg</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Itemized Inward Delivery Receipts Ledger */}
          <div className="card table-card" style={{ marginTop: '22px' }}>
            <div className="table-header">
              <h3 className="table-card-heading">
                <FileSpreadsheet size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Itemized Steel Inward Receipts ({inwardItems.length} deliveries)
              </h3>
            </div>

            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Diameter</th>
                    <th>Length</th>
                    <th>Qty (Bars)</th>
                    <th>Total Weight</th>
                    <th>Rate (₹/kg)</th>
                    <th>Total Inward Cost</th>
                    <th>Vendor / Brand</th>
                    <th>Reference / Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {inwardItems.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        No steel inward deliveries found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    inwardItems.map((item, idx) => {
                      const itemCost = (item.weightInKgs || 0) * (item.costPerKg || 0);
                      return (
                        <tr key={item._id || idx}>
                          <td className="ledger-date-col">
                            <Calendar size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            {new Date(item.createdAt).toLocaleString('en-GB')}
                          </td>
                          <td className="font-bold">{item.diameter} mm</td>
                          <td>{(item.length / 1000).toFixed(1)} m</td>
                          <td className="font-bold">{item.quantity}</td>
                          <td className="font-bold text-green">{Math.round(item.weightInKgs).toLocaleString()} kg</td>
                          <td>₹{item.costPerKg?.toFixed(2) || '0.00'}</td>
                          <td className="font-bold text-accent">₹{Math.round(itemCost).toLocaleString('en-IN')}</td>
                          <td>
                            <div className="vendor-ref-cell">
                              <span className="font-bold">{item.vendorName || '-'}</span>
                              <span className="text-secondary" style={{ fontSize: '11px' }}>{item.brandName ? `Brand: ${item.brandName}` : ''}</span>
                            </div>
                          </td>
                          <td>
                            <span className="batch-summary-tag">{item.referenceName || 'Manual Inward'}</span>
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

      {/* TAB 3: Batch Orders */}
      {activeTab === 'orders' && (
        <div className="card table-card">
          <div className="table-header">
            <h3 className="table-card-heading">Processed Batches Summary</h3>
            <div className="table-header-right">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search batch name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              <button 
                className={`btn-table-filter ${isFilterOpen || activeFilterCount > 0 ? 'active' : ''}`}
                onClick={() => setIsFilterOpen(prev => !prev)}
                title="Toggle filter controls"
              >
                <Filter size={14} />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="filter-count-badge">{activeFilterCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* Expandable Filter for Orders */}
          {isFilterOpen && (
            <div className="table-filter-drawer">
              <div className="filter-drawer-header">
                <div className="filter-header-title">
                  <SlidersHorizontal size={15} />
                  <span>Filter Batches by Date Range</span>
                </div>
                {activeFilterCount > 0 && (
                  <button className="btn-reset-filters" onClick={handleResetFilters}>
                    <RotateCcw size={12} />
                    <span>Reset All</span>
                  </button>
                )}
              </div>

              <div className="filter-controls-grid">
                <div className="filter-field">
                  <label>From Date</label>
                  <input 
                    type="date" 
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-field">
                  <label>To Date</label>
                  <input 
                    type="date" 
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="filter-input"
                  />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="active-chips-row">
                  <span className="active-chips-label">Active Filters:</span>
                  {filterStartDate && (
                    <span className="filter-chip">
                      From: {filterStartDate}
                      <button onClick={() => setFilterStartDate('')}><X size={12} /></button>
                    </span>
                  )}
                  {filterEndDate && (
                    <span className="filter-chip">
                      To: {filterEndDate}
                      <button onClick={() => setFilterEndDate('')}><X size={12} /></button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="empty-state">
              <p>No processed optimization batches found matching query.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Commit Date</th>
                    <th>Batch Identifier</th>
                    <th>Required Length</th>
                    <th>Yield Stock</th>
                    <th>Scrap Waste</th>
                    <th>Remnants Saved</th>
                    <th>Avg. Utilization</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const date = new Date(order.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });

                    const totalBars = order.layouts?.reduce((sum, l) => sum + Number(l.repetition), 0) || 0;
                    const totalParts = order.layouts?.reduce((sum, l) => {
                      const partsCount = l.parts?.length || (l.stockLength > l.waste ? 1 : 0);
                      return sum + (partsCount * Number(l.repetition));
                    }, 0) || 0;

                    return (
                      <tr key={order._id}>
                        <td className="ledger-date-col">
                          <Calendar size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {date}
                        </td>
                        <td className="font-bold">{order.batchName}</td>
                        <td>
                          {(order.summary.totalPartsLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                          <div className="text-secondary" style={{ fontSize: '11px' }}>({totalParts} cuts)</div>
                        </td>
                        <td>
                          {(order.summary.totalUsedStockLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                          <div className="text-secondary" style={{ fontSize: '11px' }}>({totalBars} bars)</div>
                        </td>
                        <td className="text-danger font-bold">
                          {order.summary.totalScrapKg?.toFixed(2)} kg
                        </td>
                        <td className="text-cyan font-bold">
                          {order.summary.totalRemnantKg?.toFixed(2)} kg
                        </td>
                        <td>
                          <div className="order-util-cell">
                            <span className="font-bold text-green">{order.summary.avgUtilization?.toFixed(2)}%</span>
                            <div className="mini-progress-bar-container">
                              <div className="mini-progress-bar" style={{ width: `${order.summary.avgUtilization}%` }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="order-status-badge badge-completed">Processed</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Order Requests */}
      {activeTab === 'requests' && (
        <div className="requests-portal">
          <div className="requests-grid">
            {/* Left Column: Engineer request creation form */}
            <div className="card request-form-card">
              <h3 className="table-card-heading">Raise Steel Order Request</h3>
              <p className="form-card-subtitle">Required for on-site material procurement requests. Subject to Owner/Admin approvals.</p>

              <form onSubmit={handleRequestSubmit} className="request-form">
                <div className="form-group">
                  <label>Project / Site Location</label>
                  <input
                    type="text"
                    required
                    value={requestForm.site}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, site: e.target.value }))}
                    className="voucher-input"
                  />
                </div>

                <div className="form-group">
                  <label>Diameter of Steel Bar (mm)</label>
                  <select
                    value={requestForm.diameter}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, diameter: Number(e.target.value) }))}
                    className="voucher-select"
                  >
                    {[8, 10, 12, 16, 20, 25, 32].map(d => (
                      <option key={d} value={d}>{d} mm</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Required Quantity (Bars)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 150"
                    value={requestForm.quantity}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="voucher-input"
                  />
                </div>

                <button type="submit" className="submit-inward-btn">
                  Submit Request
                </button>
              </form>
            </div>

            {/* Right Column: Approvals list */}
            <div className="card requests-history-card">
              <h3 className="table-card-heading">Order Requests Ledger</h3>
              <p className="form-card-subtitle">Approval status and procurement authorization history logs.</p>

              <div className="table-responsive">
                <table className="requests-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Requester / Site</th>
                      <th>Dia</th>
                      <th>Requested</th>
                      <th>Approved Qty</th>
                      <th>Status</th>
                      <th>Approved By</th>
                      {user?.role !== 'ENGINEER' && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                          No procurement requests found matching the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((req) => {
                        const isPending = req.status === 'Pending';
                        const isApproved = req.status === 'Approved';
                        const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

                        return (
                          <tr key={req.id}>
                            <td>{req.date}</td>
                            <td>
                              <div className="font-bold">{req.requester}</div>
                              <div className="text-secondary" style={{ fontSize: '11px' }}>{req.site}</div>
                            </td>
                            <td className="font-bold">{req.diameter} mm</td>
                            <td>{req.quantity}</td>
                            <td>
                              {isPending && isOwnerAdmin ? (
                                <input
                                  type="number"
                                  className="voucher-input edit-qty-input"
                                  style={{ maxWidth: '80px', padding: '4px 8px' }}
                                  defaultValue={req.quantity}
                                  onChange={(e) => handleEditQtyChange(req.id, e.target.value)}
                                />
                              ) : (
                                <span className="font-bold">{req.approvedQuantity}</span>
                              )}
                            </td>
                            <td>
                              <span className={`order-status-badge badge-${req.status.toLowerCase()}`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="text-secondary">{req.approver || '-'}</td>
                            {user?.role !== 'ENGINEER' && (
                              <td>
                                {isPending ? (
                                  <div className="action-buttons-flex">
                                    <button 
                                      className="btn-approve" 
                                      onClick={() => handleApprove(req.id)}
                                      title="Approve request"
                                    >
                                      <CheckCircle2 size={14} />
                                    </button>
                                    <button 
                                      className="btn-reject" 
                                      onClick={() => handleReject(req.id)}
                                      title="Reject request"
                                    >
                                      <XCircle size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-secondary">-</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable PDF Report Template */}
      <div id="ledger-print-report-container" className="ledger-print-template no-screen">
        {/* Printable Header */}
        <div className="print-report-header">
          <div className="print-brand-row">
            <div>
              <h1 className="print-app-title">RebarOptima</h1>
              <div className="print-app-subtitle">Cutting Optimization & Steel Inventory Management System</div>
            </div>
            <div className="print-meta-right">
              <div className="print-badge-type">
                {activeTab === 'inward-cost' 
                  ? 'STEEL INWARD & PROCUREMENT COST REPORT' 
                  : activeTab === 'ledger' 
                  ? 'MATERIAL AUDIT LEDGER' 
                  : activeTab === 'orders' 
                  ? 'BATCH ORDERS REPORT' 
                  : 'PROCUREMENT REQUESTS REPORT'}
              </div>
              <div className="print-meta-item">Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
          </div>

          <div className="print-org-details">
            <div><strong>Company / Firm:</strong> {user?.companyName || 'Standard Engineering Firm'}</div>
            <div><strong>Generated By:</strong> {user?.firstName} {user?.lastName} ({user?.role || 'Administrator'})</div>
            <div><strong>Project / Site:</strong> {user?.projectName || 'Main Site Facility'}</div>
            <div>
              <strong>Applied Filters:</strong>{' '}
              {activeFilterCount === 0 
                ? 'All Records (No filters applied)' 
                : `${filterDiameter !== 'ALL' ? `Dia: ${filterDiameter}mm | ` : ''}${filterStartDate ? `From: ${filterStartDate} | ` : ''}${filterEndDate ? `To: ${filterEndDate} | ` : ''}${filterVendor ? `Supplier: ${filterVendor}` : ''}`}
            </div>
          </div>
        </div>

        {/* Specialized Inward & Cost Print Summary */}
        {activeTab === 'inward-cost' ? (
          <>
            {/* KPI Summary for Inward Cost */}
            <div className="print-kpi-grid">
              <div className="print-kpi-box">
                <span className="print-kpi-lbl">Total Steel Inward Tonnage</span>
                <span className="print-kpi-val">{inwardTotalWeight.toLocaleString()} kg ({(inwardTotalWeight / 1000).toFixed(2)} T)</span>
              </div>
              <div className="print-kpi-box">
                <span className="print-kpi-lbl">Total Inward Procurement Cost</span>
                <span className="print-kpi-val">₹{inwardTotalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="print-kpi-box">
                <span className="print-kpi-lbl">Weighted Avg Rate / kg</span>
                <span className="print-kpi-val">₹{inwardAvgRatePerKg.toFixed(2)} / kg</span>
              </div>
              <div className="print-kpi-box">
                <span className="print-kpi-lbl">Total Inward Bars</span>
                <span className="print-kpi-val">{inwardTotalBars.toLocaleString()} Bars ({inwardItems.length} Deliveries)</span>
              </div>
            </div>

            {/* Diameter-wise Inward Matrix */}
            <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '16px 0 8px 0', textTransform: 'uppercase' }}>
              1. Diameter-wise Inward & Cost Breakdown
            </h3>
            <table className="print-data-table" style={{ marginBottom: '18px' }}>
              <thead>
                <tr>
                  <th>Diameter</th>
                  <th>Bars (Qty)</th>
                  <th>Weight (kg)</th>
                  <th>Weight (Tons)</th>
                  <th>Total Cost (₹)</th>
                  <th>Avg Rate (₹/kg)</th>
                  <th>Weight Share</th>
                </tr>
              </thead>
              <tbody>
                {diameterBreakdown.map(d => {
                  const pct = inwardTotalWeight > 0 ? ((d.weight / inwardTotalWeight) * 100).toFixed(1) : 0;
                  const avgR = d.weight > 0 ? (d.cost / d.weight).toFixed(2) : '0.00';
                  return (
                    <tr key={d.diameter}>
                      <td><strong>{d.diameter} mm</strong></td>
                      <td>{d.bars.toLocaleString()}</td>
                      <td>{Math.round(d.weight).toLocaleString()} kg</td>
                      <td>{(d.weight / 1000).toFixed(2)} T</td>
                      <td>₹{Math.round(d.cost).toLocaleString('en-IN')}</td>
                      <td>₹{avgR}</td>
                      <td>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Vendor Supply Matrix */}
            <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '16px 0 8px 0', textTransform: 'uppercase' }}>
              2. Supplier / Vendor Supply & Value Matrix
            </h3>
            <table className="print-data-table" style={{ marginBottom: '18px' }}>
              <thead>
                <tr>
                  <th>Supplier / Brand</th>
                  <th>Receipts</th>
                  <th>Weight (kg)</th>
                  <th>Tonnage (T)</th>
                  <th>Total Spend (₹)</th>
                  <th>Avg Rate (₹/kg)</th>
                </tr>
              </thead>
              <tbody>
                {vendorBreakdown.map(v => (
                  <tr key={v.vendor}>
                    <td><strong>{v.vendor}</strong></td>
                    <td>{v.entries} deliveries</td>
                    <td>{Math.round(v.weight).toLocaleString()} kg</td>
                    <td>{(v.weight / 1000).toFixed(2)} T</td>
                    <td>₹{Math.round(v.cost).toLocaleString('en-IN')}</td>
                    <td>₹{(v.weight > 0 ? (v.cost / v.weight).toFixed(2) : '0.00')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Itemized Delivery Receipts Log */}
            <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '16px 0 8px 0', textTransform: 'uppercase' }}>
              3. Itemized Delivery Vouchers Log
            </h3>
            <table className="print-data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Diameter</th>
                  <th>Length</th>
                  <th>Bars</th>
                  <th>Weight (kg)</th>
                  <th>Rate/kg</th>
                  <th>Total Cost (₹)</th>
                  <th>Supplier / Brand</th>
                </tr>
              </thead>
              <tbody>
                {inwardItems.map((item, idx) => (
                  <tr key={item._id || idx}>
                    <td>{new Date(item.createdAt).toLocaleString('en-GB')}</td>
                    <td>{item.diameter} mm</td>
                    <td>{(item.length / 1000).toFixed(1)} m</td>
                    <td>{item.quantity}</td>
                    <td>{Math.round(item.weightInKgs).toLocaleString()}</td>
                    <td>₹{item.costPerKg?.toFixed(2)}</td>
                    <td><strong>₹{Math.round((item.weightInKgs || 0) * (item.costPerKg || 0)).toLocaleString('en-IN')}</strong></td>
                    <td>{item.vendorName || item.brandName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            {/* Standard KPI Summary */}
            <div className="print-kpi-grid">
              <div className="print-kpi-box">
                <span className="print-kpi-lbl">Total Inward Stock</span>
                <span className="print-kpi-val">{totalInwardKg.toLocaleString()} kg</span>
              </div>
              <div className="print-kpi-box">
                <span className="print-kpi-lbl">Total Consumed Weight</span>
                <span className="print-kpi-val">{totalConsumedKg.toLocaleString()} kg</span>
              </div>
              <div className="print-kpi-box">
                <span className="print-kpi-lbl">Recovered Remnants Yield</span>
                <span className="print-kpi-val">{totalRemnantsKg.toLocaleString()} kg</span>
              </div>
              <div className="print-kpi-box">
                <span className="print-kpi-lbl">Net Stock Valuation</span>
                <span className="print-kpi-val">₹{(netLiveStockKg * 60).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Print Table based on active tab */}
            {activeTab === 'ledger' && (
              <table className="print-data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Diameter</th>
                    <th>Length</th>
                    <th>Qty</th>
                    <th>Weight (kg)</th>
                    <th>Cost/kg</th>
                    <th>Vendor / Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((item, idx) => (
                    <tr key={item._id || idx}>
                      <td>{new Date(item.createdAt).toLocaleString('en-GB')}</td>
                      <td><strong>{item.type}</strong></td>
                      <td>{item.diameter} mm</td>
                      <td>{(item.length / 1000).toFixed(1)} m</td>
                      <td>{item.quantity}</td>
                      <td>{Math.round(item.weightInKgs).toLocaleString()}</td>
                      <td>₹{item.costPerKg?.toFixed(2)}</td>
                      <td>{item.vendorName || item.brandName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'orders' && (
              <table className="print-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Batch Name</th>
                    <th>Required Length</th>
                    <th>Yield Stock</th>
                    <th>Scrap (kg)</th>
                    <th>Remnant (kg)</th>
                    <th>Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, idx) => (
                    <tr key={order._id || idx}>
                      <td>{new Date(order.createdAt).toLocaleDateString('en-GB')}</td>
                      <td><strong>{order.batchName}</strong></td>
                      <td>{(order.summary.totalPartsLength / 1000).toFixed(1)} m</td>
                      <td>{(order.summary.totalUsedStockLength / 1000).toFixed(1)} m</td>
                      <td>{order.summary.totalScrapKg?.toFixed(2)} kg</td>
                      <td>{order.summary.totalRemnantKg?.toFixed(2)} kg</td>
                      <td>{order.summary.avgUtilization?.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'requests' && (
              <table className="print-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Requester</th>
                    <th>Site Location</th>
                    <th>Diameter</th>
                    <th>Requested Qty</th>
                    <th>Approved Qty</th>
                    <th>Status</th>
                    <th>Approver</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, idx) => (
                    <tr key={req.id || idx}>
                      <td>{req.date}</td>
                      <td>{req.requester}</td>
                      <td>{req.site}</td>
                      <td>{req.diameter} mm</td>
                      <td>{req.quantity} bars</td>
                      <td>{req.approvedQuantity} bars</td>
                      <td><strong>{req.status}</strong></td>
                      <td>{req.approver || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Printable Sign-off Footer */}
        <div className="print-signatures-row">
          <div className="print-sign-box">
            <div className="print-sign-line"></div>
            <div>Prepared By: {user?.firstName} {user?.lastName}</div>
          </div>
          <div className="print-sign-box">
            <div className="print-sign-line"></div>
            <div>Procurement & Site Incharge</div>
          </div>
          <div className="print-sign-box">
            <div className="print-sign-line"></div>
            <div>Finance & Accounts Approval</div>
          </div>
        </div>
      </div>
    </div>
  );
}
