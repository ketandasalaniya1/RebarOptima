import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  WifiOff,
  CloudUpload
} from 'lucide-react';
import { pettyCashApi } from '../../utils/api';
import { formatINR } from '../../utils/money';
import {
  enqueueOfflineTransaction,
  getOfflineQueue,
  syncOfflineQueue
} from '../../utils/offlineQueue';

// Split Modular Components
import HeaderBar from './components/HeaderBar';
import BalanceSummary from './components/BalanceSummary';
import FilterChips from './components/FilterChips';
import ProviderRail from './components/ProviderRail';
import StatementTable from './components/StatementTable';
import TransactionCard from './components/TransactionCard';
import TransactionDrawer from './components/TransactionDrawer';
import EntryDrawer from './components/EntryDrawer';
import Lightbox from './components/Lightbox';
import SettingsModal from './components/SettingsModal';
import NewSiteModal from './components/NewSiteModal';

import './PettyCashPage.css';

export default function PettyCashPage() {
  // ── LOGGED IN USER CONTEXT ────────────────────────────────────────────────
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  // ── URL PARAMS INITIALIZATION ─────────────────────────────────────────────
  const initialParams = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const sp = new URLSearchParams(window.location.search);
    return {
      site: sp.get('site') || '',
      from: sp.get('from') || '',
      to: sp.get('to') || '',
      type: sp.get('type') || 'ALL',
      category: sp.get('category') || 'ALL',
      person: sp.get('person') || '',
      status: sp.get('status') || 'ALL'
    };
  }, []);

  // ── SITES & ACTIVE STATE ──────────────────────────────────────────────────
  const [sites, setSites] = useState([]);
  const [selectedSiteName, setSelectedSiteName] = useState(initialParams.site || '');
  const [isLoadingSites, setIsLoadingSites] = useState(false);

  // ── TRANSACTIONS & REPORT DATA ────────────────────────────────────────────
  const [reportData, setReportData] = useState({
    openingBalance: 0,
    totalCredits: 0,
    totalDebits: 0,
    closingBalance: 0,
    count: 0,
    transactions: [],
    personCreditBreakdown: []
  });
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── FILTER STATES ─────────────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState(() => {
    if (initialParams.from && initialParams.to) return 'custom';
    return 'all';
  });
  const [startDate, setStartDate] = useState(initialParams.from || '');
  const [endDate, setEndDate] = useState(initialParams.to || '');
  const [typeFilter, setTypeFilter] = useState(initialParams.type || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState(initialParams.category || 'ALL');
  const [personFilter, setPersonFilter] = useState(initialParams.person || '');
  const [statusFilter, setStatusFilter] = useState(initialParams.status || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ── PERSONS & CATEGORIES MASTER ───────────────────────────────────────────
  const [persons, setPersons] = useState([]);
  const [categories, setCategories] = useState([]);

  // ── DRAWERS & MODALS STATE ────────────────────────────────────────────────
  const [entryDrawerMode, setEntryDrawerMode] = useState(null); // 'CREDIT' | 'DEBIT' | null
  const [selectedTransaction, setSelectedTransaction] = useState(null); // for detail drawer
  const [lightboxPhotos, setLightboxPhotos] = useState(null); // array of photo objects or null
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNewSiteModal, setShowNewSiteModal] = useState(false);

  // ── UNDO TOAST STATE ──────────────────────────────────────────────────────
  const [undoToast, setUndoToast] = useState(null); // { id, description, amount, type, countdown }
  const undoTimerRef = useRef(null);

  // ── OFFLINE QUEUE & NETWORK STATE ─────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [offlineQueueCount, setOfflineQueueCount] = useState(() => getOfflineQueue().length);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // Monitor Network Connectivity & Auto-Sync Offline Queue
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerOfflineSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check for pending offline items
    if (navigator.onLine && getOfflineQueue().length > 0) {
      triggerOfflineSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerOfflineSync = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncingOffline(true);
    try {
      const res = await syncOfflineQueue(pettyCashApi.createTransaction);
      const remaining = getOfflineQueue().length;
      setOfflineQueueCount(remaining);

      if (res.synced > 0) {
        setSuccessMsg(`Synced ${res.synced} offline ${res.synced === 1 ? 'entry' : 'entries'} to server!`);
        loadTransactions();
        loadSites();
      }
    } catch (err) {
      console.warn('Error during offline sync:', err);
    } finally {
      setIsSyncingOffline(false);
    }
  };

  // ── SYNC URL SEARCH PARAMS ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams();
    if (selectedSiteName) sp.set('site', selectedSiteName);
    if (startDate) sp.set('from', startDate);
    if (endDate) sp.set('to', endDate);
    if (typeFilter && typeFilter !== 'ALL') sp.set('type', typeFilter);
    if (categoryFilter && categoryFilter !== 'ALL') sp.set('category', categoryFilter);
    if (personFilter) sp.set('person', personFilter);
    if (statusFilter && statusFilter !== 'ALL') sp.set('status', statusFilter);

    const newQuery = sp.toString();
    const newRelativePathQuery = window.location.pathname + (newQuery ? `?${newQuery}` : '');
    window.history.replaceState(null, '', newRelativePathQuery);
  }, [selectedSiteName, startDate, endDate, typeFilter, categoryFilter, personFilter, statusFilter]);

  // ── GLOBAL KEYBOARD SHORTCUTS (R & E) ──────────────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
        return;
      }
      if (entryDrawerMode || showSettingsModal || showNewSiteModal || lightboxPhotos || selectedTransaction) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setEntryDrawerMode('CREDIT');
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setEntryDrawerMode('DEBIT');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [entryDrawerMode, showSettingsModal, showNewSiteModal, lightboxPhotos, selectedTransaction]);

  // ── INITIAL DATA LOADING ──────────────────────────────────────────────────
  useEffect(() => {
    loadSites();
    loadCategories();
    loadPersons();
  }, []);

  // When selected site or filters change, load transactions
  useEffect(() => {
    if (selectedSiteName) {
      loadTransactions();
    }
  }, [selectedSiteName, startDate, endDate, typeFilter, categoryFilter, personFilter, statusFilter]);

  // ── AUTO-DISMISS SUCCESS BANNER ───────────────────────────────────────────
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // ── API HANDLERS ──────────────────────────────────────────────────────────
  const loadSites = async () => {
    setIsLoadingSites(true);
    try {
      const res = await pettyCashApi.getSites();
      if (res?.success && Array.isArray(res.data)) {
        setSites(res.data);
        if (res.data.length > 0) {
          setSelectedSiteName((prev) => {
            if (prev && res.data.some((s) => s.name === prev)) return prev;
            return res.data[0].name;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
      setErrorMsg('Failed to load construction sites');
    } finally {
      setIsLoadingSites(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await pettyCashApi.getCategories();
      if (res?.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadPersons = async () => {
    try {
      const res = await pettyCashApi.getPersons();
      if (res?.success && Array.isArray(res.data)) {
        setPersons(res.data);
      }
    } catch (err) {
      console.error('Error loading persons:', err);
    }
  };

  const loadTransactions = async () => {
    if (!selectedSiteName) return;
    setIsLoadingTransactions(true);
    setErrorMsg('');
    try {
      const params = { siteName: selectedSiteName };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (typeFilter && typeFilter !== 'ALL') params.type = typeFilter;
      if (categoryFilter && categoryFilter !== 'ALL') params.category = categoryFilter;
      if (personFilter) params.personName = personFilter;
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;

      const res = await pettyCashApi.getTransactions(params);
      if (res?.success && res.data) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
      setErrorMsg(err.message || 'Error fetching transactions');
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // ── DATE PRESETS ──────────────────────────────────────────────────────────
  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const str = formatDate(today);
      setStartDate(str);
      setEndDate(str);
    } else if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const str = formatDate(yest);
      setStartDate(str);
      setEndDate(str);
    } else if (preset === 'week') {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (preset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    }
  };

  const handleCustomDateChange = (from, to) => {
    setStartDate(from);
    setEndDate(to);
    setDatePreset('custom');
  };

  const handleClearAllFilters = () => {
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setTypeFilter('ALL');
    setCategoryFilter('ALL');
    setPersonFilter('');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

  // ── CREATE TRANSACTION HANDLER (WITH OFFLINE FALLBACK) ────────────────────
  const handleCreateTransaction = async (payload, saveAndAddAnother) => {
    // If offline, enqueue locally
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineTransaction(payload);
      setOfflineQueueCount(getOfflineQueue().length);
      setSuccessMsg(`Offline: Entry stored locally. Will sync automatically when connected!`);
      if (!saveAndAddAnother) setEntryDrawerMode(null);
      return true;
    }

    try {
      const res = await pettyCashApi.createTransaction(payload);
      if (res?.success && res.data) {
        const createdId = res.data.id || res.data._id;
        const voucher = res.data.voucherNo || '';

        // Show Undo Toast for 5 seconds
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        setUndoToast({
          id: createdId,
          description: payload.description,
          amount: payload.amount,
          type: payload.type,
          voucherNo: voucher,
          secondsLeft: 5
        });

        undoTimerRef.current = setInterval(() => {
          setUndoToast((prev) => {
            if (!prev || prev.secondsLeft <= 1) {
              clearInterval(undoTimerRef.current);
              return null;
            }
            return { ...prev, secondsLeft: prev.secondsLeft - 1 };
          });
        }, 1000);

        setSuccessMsg(
          `${payload.type === 'CREDIT' ? 'Money In' : 'Expense'} of ${formatINR(payload.amount)} saved!${voucher ? ` Voucher: ${voucher}` : ''}`
        );

        if (!saveAndAddAnother) {
          setEntryDrawerMode(null);
        }

        // Refresh ledger & live site balance
        loadTransactions();
        loadSites();
        if (payload.type === 'CREDIT') loadPersons();

        return true;
      } else {
        alert(res?.message || 'Failed to save transaction');
        return false;
      }
    } catch (err) {
      console.warn('Network error while saving transaction, enqueuing offline:', err);
      // Fallback: Save to offline queue
      enqueueOfflineTransaction(payload);
      setOfflineQueueCount(getOfflineQueue().length);
      setSuccessMsg(`Network error: Entry safely stored locally. Will sync when reconnected!`);
      if (!saveAndAddAnother) setEntryDrawerMode(null);
      return true;
    }
  };

  // ── UPDATE AUDIT & VERIFICATION STATUS ────────────────────────────────────
  const handleUpdateStatus = async (id, newStatus, rejectionReason = '') => {
    try {
      const res = await pettyCashApi.updateStatus(id, {
        status: newStatus,
        rejectionReason
      });

      if (res?.success) {
        setSuccessMsg(`Voucher status updated to ${newStatus}`);

        // Update selected transaction drawer state in real time
        setSelectedTransaction((prev) => {
          if (!prev || (prev.id !== id && prev._id !== id)) return prev;
          return {
            ...prev,
            status: newStatus,
            rejectionReason: rejectionReason || '',
            verifiedByName: currentUser?.name || currentUser?.email || 'Admin',
            verifiedAt: new Date().toISOString()
          };
        });

        loadTransactions();
      } else {
        alert(res?.message || 'Failed to update voucher status');
      }
    } catch (err) {
      alert(err.message || 'Error updating voucher status');
    }
  };

  // ── UNDO TRANSACTION HANDLER ──────────────────────────────────────────────
  const handleUndoTransaction = async () => {
    if (!undoToast?.id) return;
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);

    const txId = undoToast.id;
    setUndoToast(null);

    try {
      const res = await pettyCashApi.deleteTransaction(txId);
      if (res?.success) {
        setSuccessMsg('Entry successfully undone');
        loadTransactions();
        loadSites();
      } else {
        alert(res?.message || 'Failed to undo transaction');
      }
    } catch (err) {
      alert(err.message || 'Error undoing transaction');
    }
  };

  // ── DELETE TRANSACTION HANDLER ────────────────────────────────────────────
  const handleDeleteTransaction = async (id, description, amount) => {
    if (!window.confirm(`Delete "${description}" (${formatINR(amount)})? This will update the site balance.`)) {
      return;
    }

    try {
      const res = await pettyCashApi.deleteTransaction(id);
      if (res?.success) {
        setSuccessMsg('Entry deleted successfully');
        loadTransactions();
        loadSites();
      } else {
        alert(res?.message || 'Failed to delete transaction');
      }
    } catch (err) {
      alert(err.message || 'Error deleting transaction');
    }
  };

  // ── SETTINGS API HANDLERS ─────────────────────────────────────────────────
  const handleAddCategory = async (name, subcategories) => {
    try {
      const res = await pettyCashApi.createCategory({ name, subcategories });
      if (res?.success) {
        loadCategories();
      } else {
        alert(res?.message || 'Could not add category');
      }
    } catch (err) {
      alert(err.message || 'Error adding category');
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Delete this category? Existing transactions will retain their category name.')) return;
    try {
      await pettyCashApi.deleteCategory(catId);
      loadCategories();
    } catch (err) {
      alert(err.message || 'Error deleting category');
    }
  };

  const handleAddPerson = async (personForm) => {
    try {
      const res = await pettyCashApi.createPerson(personForm);
      if (res?.success) {
        loadPersons();
      } else {
        alert(res?.message || 'Could not add person');
      }
    } catch (err) {
      alert(err.message || 'Error adding person');
    }
  };

  const handleDeletePerson = async (personId) => {
    if (!window.confirm('Remove this person from the quick dropdown?')) return;
    try {
      await pettyCashApi.deletePerson(personId);
      loadPersons();
    } catch (err) {
      alert(err.message || 'Error removing person');
    }
  };

  const handleCreateSite = async (newSiteData) => {
    try {
      const res = await pettyCashApi.createSite(newSiteData);
      if (res?.success) {
        setSuccessMsg(`Site "${newSiteData.name}" created!`);
        await loadSites();
        setSelectedSiteName(newSiteData.name.trim());
      } else {
        alert(res?.message || 'Could not create site');
      }
    } catch (err) {
      alert(err.message || 'Error creating site');
    }
  };

  // ── EXPORT CSV STATEMENT (WITH VOUCHER NUMBERS & AUDIT STATUS) ────────────
  const handleExportCSV = () => {
    if (!filteredLedger || filteredLedger.length === 0) {
      alert('No transactions to export for this view.');
      return;
    }

    const headers = [
      'Voucher No',
      'Date',
      'Type',
      'Status',
      'Amount',
      'Category',
      'Subcategory',
      'Person',
      'Description',
      'Receipts Count'
    ];

    const rows = filteredLedger.map((tx) => [
      `"${tx.voucherNo || '—'}"`,
      `"${tx.date || ''}"`,
      `"${tx.type || ''}"`,
      `"${tx.status || 'VERIFIED'}"`,
      tx.amount || 0,
      `"${(tx.category || '').replace(/"/g, '""')}"`,
      `"${(tx.subcategory || '').replace(/"/g, '""')}"`,
      `"${(tx.personName || '').replace(/"/g, '""')}"`,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      tx.photos?.length || 0
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateTag = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `petty_cash_${selectedSiteName.replace(/\s+/g, '_')}_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── COMPUTED ACTIVE SITE STATS ────────────────────────────────────────────
  const currentSiteStats = useMemo(() => {
    return (
      sites.find((s) => s.name === selectedSiteName) || {
        name: selectedSiteName,
        currentBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        transactionCount: 0
      }
    );
  }, [sites, selectedSiteName]);

  // Client-side text search filter
  const filteredLedger = useMemo(() => {
    if (!searchQuery.trim()) return reportData.transactions;
    const q = searchQuery.toLowerCase();
    return reportData.transactions.filter(
      (tx) =>
        (tx.voucherNo || '').toLowerCase().includes(q) ||
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.category || '').toLowerCase().includes(q) ||
        (tx.subcategory || '').toLowerCase().includes(q) ||
        (tx.personName || '').toLowerCase().includes(q) ||
        String(tx.amount).includes(q)
    );
  }, [reportData.transactions, searchQuery]);

  return (
    <div className="pc-page-wrapper">
      {/* ── STICKY TOP HEADER BAR ─────────────────────────────────────────── */}
      <HeaderBar
        sites={sites}
        selectedSiteName={selectedSiteName}
        onSelectSite={setSelectedSiteName}
        currentBalance={currentSiteStats.currentBalance}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenNewSite={() => setShowNewSiteModal(true)}
        onOpenCredit={() => setEntryDrawerMode('CREDIT')}
        onOpenDebit={() => setEntryDrawerMode('DEBIT')}
        onExport={handleExportCSV}
        isLoadingSites={isLoadingSites}
      />

      {/* ── OFFLINE STATUS BANNER ──────────────────────────────────────────── */}
      {(!isOnline || offlineQueueCount > 0) && (
        <div className="pc-offline-banner">
          <div className="pc-offline-banner-left">
            <WifiOff size={16} />
            <span>
              {!isOnline
                ? `You are working offline (${offlineQueueCount} ${offlineQueueCount === 1 ? 'entry' : 'entries'} queued).`
                : `${offlineQueueCount} offline ${offlineQueueCount === 1 ? 'entry' : 'entries'} pending sync.`}
            </span>
          </div>
          {isOnline && (
            <button
              type="button"
              className="pc-btn-sync-offline"
              onClick={triggerOfflineSync}
              disabled={isSyncingOffline}
            >
              <CloudUpload size={14} className={isSyncingOffline ? 'pc-spin' : ''} />
              <span>{isSyncingOffline ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}
        </div>
      )}

      {/* ── NOTIFICATIONS & FEEDBACK ───────────────────────────────────────── */}
      {successMsg && (
        <div className="pc-alert-banner pc-alert-success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
          <button type="button" className="pc-alert-close" onClick={() => setSuccessMsg('')}>×</button>
        </div>
      )}

      {errorMsg && (
        <div className="pc-alert-banner pc-alert-danger">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
          <button type="button" className="pc-btn-retry" onClick={loadTransactions}>
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
          <button type="button" className="pc-alert-close" onClick={() => setErrorMsg('')}>×</button>
        </div>
      )}

      {/* ── MAIN CONTENT CONTAINER ────────────────────────────────────────── */}
      <main className="pc-main-container">
        {/* 1. Single Hero Balance & Compact Equation Strip */}
        <BalanceSummary
          siteName={selectedSiteName}
          currentBalance={currentSiteStats.currentBalance}
          openingBalance={reportData.openingBalance}
          totalCredits={reportData.totalCredits}
          totalDebits={reportData.totalDebits}
          closingBalance={reportData.closingBalance}
          transactionCount={reportData.count}
          isLoading={isLoadingTransactions && !reportData.transactions.length}
        />

        {/* 2. Horizontal Money Providers Rail */}
        <ProviderRail
          providers={reportData.personCreditBreakdown}
          selectedPerson={personFilter}
          onSelectPerson={setPersonFilter}
        />

        {/* 3. Popover Filter Chips (with Status Filter) */}
        <FilterChips
          datePreset={datePreset}
          onApplyDatePreset={applyDatePreset}
          startDate={startDate}
          endDate={endDate}
          onCustomDateChange={handleCustomDateChange}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          personFilter={personFilter}
          onPersonChange={setPersonFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          categories={categories}
          persons={persons}
          totalEntries={filteredLedger.length}
          onClearAll={handleClearAllFilters}
        />

        {/* 4. Desktop Passbook Table (Visible on desktop >= 768px) */}
        <div className="pc-desktop-view-wrap">
          <StatementTable
            transactions={filteredLedger}
            openingBalance={reportData.openingBalance}
            onSelectTransaction={(tx) => setSelectedTransaction(tx)}
            onOpenPhotos={(photos, idx = 0) => {
              setLightboxPhotos(photos);
              setLightboxInitialIndex(idx);
            }}
            onDeleteTransaction={handleDeleteTransaction}
            isLoading={isLoadingTransactions}
            onOpenCredit={() => setEntryDrawerMode('CREDIT')}
            onOpenDebit={() => setEntryDrawerMode('DEBIT')}
          />
        </div>

        {/* 5. Mobile Day-Grouped Cards (Visible on mobile < 768px) */}
        <div className="pc-mobile-view-wrap">
          <TransactionCard
            transactions={filteredLedger}
            onSelectTransaction={(tx) => setSelectedTransaction(tx)}
            onOpenPhotos={(photos, idx = 0) => {
              setLightboxPhotos(photos);
              setLightboxInitialIndex(idx);
            }}
            onOpenCredit={() => setEntryDrawerMode('CREDIT')}
            onOpenDebit={() => setEntryDrawerMode('DEBIT')}
            isLoading={isLoadingTransactions}
          />
        </div>
      </main>

      {/* ── FIXED MOBILE BOTTOM ACTION BAR (< 768px) ───────────────────────── */}
      <aside className="pc-mobile-fixed-bottom-bar">
        <button
          type="button"
          className="pc-mobile-btn-action pc-mobile-btn-credit"
          onClick={() => setEntryDrawerMode('CREDIT')}
          aria-label="Money Received"
        >
          <ArrowDownLeft size={20} />
          <span>Money Received</span>
        </button>

        <button
          type="button"
          className="pc-mobile-btn-action pc-mobile-btn-debit"
          onClick={() => setEntryDrawerMode('DEBIT')}
          aria-label="Record Expense"
        >
          <ArrowUpRight size={20} />
          <span>Expense</span>
        </button>
      </aside>

      {/* ── UNDO TOAST NOTIFICATION ───────────────────────────────────────── */}
      {undoToast && (
        <div className="pc-undo-toast" role="alert">
          <div className="pc-undo-toast-info">
            <CheckCircle2 size={16} className="pc-text-success" />
            <span>
              Saved {undoToast.type === 'CREDIT' ? 'Money In' : 'Expense'}{' '}
              {undoToast.voucherNo ? `[${undoToast.voucherNo}] ` : ''}({formatINR(undoToast.amount)})
            </span>
          </div>
          <button
            type="button"
            className="pc-btn-undo"
            onClick={handleUndoTransaction}
          >
            <RotateCcw size={14} />
            <span>Undo ({undoToast.secondsLeft}s)</span>
          </button>
        </div>
      )}

      {/* ── ADD ENTRY DRAWER (CREDIT & DEBIT) ──────────────────────────────── */}
      <EntryDrawer
        isOpen={Boolean(entryDrawerMode)}
        mode={entryDrawerMode || 'DEBIT'}
        siteName={selectedSiteName}
        currentBalance={currentSiteStats.currentBalance}
        categories={categories}
        persons={persons}
        currentUser={currentUser}
        onClose={() => setEntryDrawerMode(null)}
        onSubmit={handleCreateTransaction}
      />

      {/* ── TRANSACTION DETAIL DRAWER (480px on desktop) ───────────────────── */}
      <TransactionDrawer
        isOpen={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onDelete={handleDeleteTransaction}
        onOpenPhotos={(photos, idx = 0) => {
          setLightboxPhotos(photos);
          setLightboxInitialIndex(idx);
        }}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* ── LIGHTBOX PHOTO VIEWER ─────────────────────────────────────────── */}
      {lightboxPhotos && (
        <Lightbox
          photos={lightboxPhotos}
          initialIndex={lightboxInitialIndex}
          onClose={() => setLightboxPhotos(null)}
        />
      )}

      {/* ── SETTINGS MODAL ────────────────────────────────────────────────── */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        categories={categories}
        persons={persons}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onAddPerson={handleAddPerson}
        onDeletePerson={handleDeletePerson}
      />

      {/* ── NEW SITE MODAL ────────────────────────────────────────────────── */}
      <NewSiteModal
        isOpen={showNewSiteModal}
        onClose={() => setShowNewSiteModal(false)}
        onCreateSite={handleCreateSite}
      />
    </div>
  );
}
