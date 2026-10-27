import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Calendar,
  Filter,
  Search,
  Camera,
  Image as ImageIcon,
  X,
  Trash2,
  Settings as SettingsIcon,
  Users,
  Tag,
  Building2,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  FolderPlus,
  ChevronDown
} from 'lucide-react';
import { pettyCashApi } from '../../utils/api';
import './PettyCashPage.css';

export default function PettyCashPage() {
  // ── SITES & ACTIVE STATE ──────────────────────────────────────────────────
  const [sites, setSites] = useState([]);
  const [selectedSiteName, setSelectedSiteName] = useState('');
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
  const [datePreset, setDatePreset] = useState('all'); // 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'CREDIT' | 'DEBIT'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [personFilter, setPersonFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── PERSONS & CATEGORIES MASTER ───────────────────────────────────────────
  const [persons, setPersons] = useState([]);
  const [categories, setCategories] = useState([]);

  // ── MODALS STATE ──────────────────────────────────────────────────────────
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showDebitModal, setShowDebitModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNewSiteModal, setShowNewSiteModal] = useState(false);
  const [activePhotoViewer, setActivePhotoViewer] = useState(null); // array of photo objects or single photo

  // ── FORM STATES ───────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Credit Form (Money Received)
  const [creditForm, setCreditForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    personName: '',
    isCustomPerson: false,
    customPersonName: '',
    category: 'Opening Balance',
    subcategory: '',
    description: '',
    photos: []
  });

  // Debit Form (Site Expense)
  const [debitForm, setDebitForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    personName: '', // Employee name
    category: '',
    subcategory: '',
    description: '',
    photos: []
  });

  // New Site Form
  const [newSiteForm, setNewSiteForm] = useState({ name: '', code: '', location: '' });

  // Settings Modal Tabs: 'categories' | 'persons'
  const [settingsTab, setSettingsTab] = useState('categories');
  const [newCatName, setNewCatName] = useState('');
  const [newSubcatInput, setNewSubcatInput] = useState('');
  const [newPersonForm, setNewPersonForm] = useState({ name: '', roleOrTitle: '', phone: '' });

  const fileInputCreditRef = useRef(null);
  const fileInputDebitRef = useRef(null);

  // Auto-dismiss feedback message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Initial load: Fetch sites, categories, persons
  useEffect(() => {
    loadSites();
    loadCategories();
    loadPersons();
  }, []);

  // When selected site or date filters change, load transactions
  useEffect(() => {
    if (selectedSiteName) {
      loadTransactions();
    }
  }, [selectedSiteName, startDate, endDate, typeFilter, categoryFilter, personFilter]);

  // ── API CALLS ─────────────────────────────────────────────────────────────
  const loadSites = async () => {
    setIsLoadingSites(true);
    try {
      const res = await pettyCashApi.getSites();
      if (res?.success && Array.isArray(res.data)) {
        setSites(res.data);
        if (res.data.length > 0) {
          setSelectedSiteName(prev => {
            if (prev && res.data.some(s => s.name === prev)) return prev;
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
        if (res.data.length > 0 && !debitForm.category) {
          // Default debit form category to the second category (usually material/supplies)
          const nonOpening = res.data.find(c => c.name !== 'Opening Balance') || res.data[0];
          setDebitForm(prev => ({ ...prev, category: nonOpening.name }));
        }
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
      const params = {
        siteName: selectedSiteName
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (typeFilter && typeFilter !== 'ALL') params.type = typeFilter;
      if (categoryFilter && categoryFilter !== 'ALL') params.category = categoryFilter;
      if (personFilter) params.personName = personFilter;

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

  // ── DATE PRESET HANDLER ───────────────────────────────────────────────────
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
      start.setDate(today.getDate() - today.getDay()); // Sunday or start of week
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (preset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    }
  };

  // ── PHOTO CONVERSION (BASE64) ─────────────────────────────────────────────
  const handlePhotoUpload = (e, formType) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      // Basic size validation (< 8MB per photo)
      if (file.size > 8 * 1024 * 1024) {
        alert(`File ${file.name} is larger than 8MB. Please choose a smaller photo.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target.result;
        const photoObj = {
          dataUrl,
          name: file.name || 'receipt.jpg',
          size: file.size
        };

        if (formType === 'CREDIT') {
          setCreditForm(prev => ({
            ...prev,
            photos: [...prev.photos, photoObj]
          }));
        } else {
          setDebitForm(prev => ({
            ...prev,
            photos: [...prev.photos, photoObj]
          }));
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const removePhoto = (index, formType) => {
    if (formType === 'CREDIT') {
      setCreditForm(prev => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index)
      }));
    } else {
      setDebitForm(prev => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index)
      }));
    }
  };

  // ── SUBMIT CREDIT ENTRY ───────────────────────────────────────────────────
  const handleSubmitCredit = async (e) => {
    e.preventDefault();
    const finalPerson = creditForm.isCustomPerson ? creditForm.customPersonName.trim() : creditForm.personName.trim();
    if (!finalPerson) {
      alert('Please specify the person who provided the money.');
      return;
    }
    if (!creditForm.amount || Number(creditForm.amount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        siteName: selectedSiteName,
        type: 'CREDIT',
        date: creditForm.date,
        amount: Number(creditForm.amount),
        personName: finalPerson,
        category: creditForm.category || 'Money Received',
        subcategory: creditForm.subcategory || '',
        description: creditForm.description || `Received from ${finalPerson}`,
        photos: creditForm.photos
      };

      const res = await pettyCashApi.createTransaction(payload);
      if (res?.success) {
        setSuccessMsg(`₹${payload.amount.toLocaleString('en-IN')} received into ${selectedSiteName} successfully!`);
        setShowCreditModal(false);
        // Reset form
        setCreditForm({
          date: new Date().toISOString().split('T')[0],
          amount: '',
          personName: '',
          isCustomPerson: false,
          customPersonName: '',
          category: 'Opening Balance',
          subcategory: '',
          description: '',
          photos: []
        });
        loadTransactions();
        loadSites(); // refresh site balance card
        loadPersons(); // refresh persons list
      } else {
        alert(res?.message || 'Failed to save credit entry');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error recording credit entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── SUBMIT DEBIT ENTRY ────────────────────────────────────────────────────
  const handleSubmitDebit = async (e) => {
    e.preventDefault();
    if (!debitForm.personName.trim()) {
      alert('Please specify the employee name who handled/incurred this expense.');
      return;
    }
    if (!debitForm.amount || Number(debitForm.amount) <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }
    if (!debitForm.description.trim()) {
      alert('Please enter an expense description.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        siteName: selectedSiteName,
        type: 'DEBIT',
        date: debitForm.date,
        amount: Number(debitForm.amount),
        personName: debitForm.personName.trim(),
        category: debitForm.category || 'General Expense',
        subcategory: debitForm.subcategory || '',
        description: debitForm.description.trim(),
        photos: debitForm.photos
      };

      const res = await pettyCashApi.createTransaction(payload);
      if (res?.success) {
        setSuccessMsg(`Expense of ₹${payload.amount.toLocaleString('en-IN')} recorded successfully!`);
        setShowDebitModal(false);
        // Reset form
        setDebitForm(prev => ({
          ...prev,
          amount: '',
          personName: '',
          subcategory: '',
          description: '',
          photos: []
        }));
        loadTransactions();
        loadSites(); // refresh site balance card
      } else {
        alert(res?.message || 'Failed to record expense');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error recording expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── DELETE TRANSACTION ────────────────────────────────────────────────────
  const handleDeleteTransaction = async (id, description, amount) => {
    if (!window.confirm(`Are you sure you want to delete "${description}" (₹${amount})? This will update the balance.`)) {
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

  // ── CREATE NEW SITE ───────────────────────────────────────────────────────
  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!newSiteForm.name.trim()) return;

    try {
      const res = await pettyCashApi.createSite(newSiteForm);
      if (res?.success) {
        setSuccessMsg(`Site "${newSiteForm.name}" created!`);
        setNewSiteForm({ name: '', code: '', location: '' });
        setShowNewSiteModal(false);
        await loadSites();
        setSelectedSiteName(newSiteForm.name.trim());
      } else {
        alert(res?.message || 'Could not create site');
      }
    } catch (err) {
      alert(err.message || 'Error creating site');
    }
  };

  // ── ADD CATEGORY / SUBCATEGORY ────────────────────────────────────────────
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const subcats = newSubcatInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const res = await pettyCashApi.createCategory({
        name: newCatName.trim(),
        subcategories: subcats
      });
      if (res?.success) {
        setNewCatName('');
        setNewSubcatInput('');
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

  // ── ADD REUSABLE PERSON ───────────────────────────────────────────────────
  const handleAddPerson = async (e) => {
    e.preventDefault();
    if (!newPersonForm.name.trim()) return;

    try {
      const res = await pettyCashApi.createPerson(newPersonForm);
      if (res?.success) {
        setNewPersonForm({ name: '', roleOrTitle: '', phone: '' });
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

  // ── CURRENT ACTIVE SITE STATS ─────────────────────────────────────────────
  const currentSiteStats = useMemo(() => {
    return sites.find(s => s.name === selectedSiteName) || {
      name: selectedSiteName,
      currentBalance: 0,
      totalCredits: 0,
      totalDebits: 0,
      transactionCount: 0
    };
  }, [sites, selectedSiteName]);

  // Available subcategories for credit & debit forms
  const creditSubcategories = useMemo(() => {
    const cat = categories.find(c => c.name === creditForm.category);
    return cat?.subcategories || [];
  }, [categories, creditForm.category]);

  const debitSubcategories = useMemo(() => {
    const cat = categories.find(c => c.name === debitForm.category);
    return cat?.subcategories || [];
  }, [categories, debitForm.category]);

  // Client-side text search within currently loaded transactions
  const filteredLedger = useMemo(() => {
    if (!searchQuery.trim()) return reportData.transactions;
    const q = searchQuery.toLowerCase();
    return reportData.transactions.filter(tx =>
      (tx.description || '').toLowerCase().includes(q) ||
      (tx.category || '').toLowerCase().includes(q) ||
      (tx.subcategory || '').toLowerCase().includes(q) ||
      (tx.personName || '').toLowerCase().includes(q) ||
      String(tx.amount).includes(q)
    );
  }, [reportData.transactions, searchQuery]);

  return (
    <div className="petty-cash-container">
      {/* ── TOP HEADER & SITE SELECTOR ──────────────────────────────────────── */}
      <header className="petty-cash-header">
        <div className="header-left">
          <div className="header-icon-badge">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="header-title">Site Petty Cash & Expenses</h1>
            <p className="header-subtitle">
              Daily site cash ledger, receipts, photo bills & balances
            </p>
          </div>
        </div>

        <div className="header-right">
          <div className="site-selector-box">
            <Building2 size={16} className="text-muted" />
            <span className="site-selector-label">Site:</span>
            <select
              id="active-site-select"
              className="site-select-input"
              value={selectedSiteName}
              onChange={(e) => setSelectedSiteName(e.target.value)}
              disabled={isLoadingSites || sites.length === 0}
            >
              {sites.map(s => (
                <option key={s.id || s.name} value={s.name}>
                  {s.name} {s.code ? `(${s.code})` : ''} — Bal: ₹{Number(s.currentBalance || 0).toLocaleString('en-IN')}
                </option>
              ))}
            </select>
            <button
              className="btn-icon"
              title="Add New Construction Site"
              onClick={() => setShowNewSiteModal(true)}
            >
              <Plus size={16} />
            </button>
          </div>

          <button
            className="btn-secondary"
            onClick={() => setShowSettingsModal(true)}
            title="Manage Categories and Money Providers"
          >
            <SettingsIcon size={16} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* ── NOTIFICATIONS / FEEDBACK ────────────────────────────────────────── */}
      {successMsg && (
        <div className="alert-banner alert-success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
          <button className="alert-close-btn" onClick={() => setSuccessMsg('')}>×</button>
        </div>
      )}
      {errorMsg && (
        <div className="alert-banner alert-danger">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
          <button className="alert-close-btn" onClick={() => setErrorMsg('')}>×</button>
        </div>
      )}

      {/* ── HERO BANNER: LIVE REMAINING BALANCE & QUICK ACTIONS ──────────────── */}
      <section className="balance-hero-card">
        <div className="hero-balance-main">
          <span className="hero-balance-label">Current Site Cash Balance</span>
          <div className="hero-balance-figure-row">
            <span className={`hero-balance-figure ${currentSiteStats.currentBalance < 0 ? 'text-danger' : 'text-success'}`}>
              ₹{Number(currentSiteStats.currentBalance || 0).toLocaleString('en-IN')}
            </span>
            <span className="hero-site-tag">
              <Building2 size={14} />
              {selectedSiteName || 'Site'}
            </span>
          </div>
          <div className="hero-balance-meta">
            <span>Total Inward: ₹{Number(currentSiteStats.totalCredits || 0).toLocaleString('en-IN')}</span>
            <span className="meta-separator">•</span>
            <span>Total Expenses: ₹{Number(currentSiteStats.totalDebits || 0).toLocaleString('en-IN')}</span>
            <span className="meta-separator">•</span>
            <span>{currentSiteStats.transactionCount || 0} Total Entries</span>
          </div>
        </div>

        <div className="hero-actions">
          <button
            id="btn-record-credit"
            className="btn-action btn-credit"
            onClick={() => setShowCreditModal(true)}
          >
            <ArrowDownLeft size={20} />
            <div className="btn-action-text">
              <span className="btn-action-main">+ Money Received</span>
              <span className="btn-action-sub">Record Cash Inflow (Credit)</span>
            </div>
          </button>

          <button
            id="btn-record-debit"
            className="btn-action btn-debit"
            onClick={() => setShowDebitModal(true)}
          >
            <ArrowUpRight size={20} />
            <div className="btn-action-text">
              <span className="btn-action-main">+ Site Expense</span>
              <span className="btn-action-sub">Record Expense (Debit)</span>
            </div>
          </button>
        </div>
      </section>

      {/* ── FILTER & REPORTING CONTROLS BAR ─────────────────────────────────── */}
      <section className="filter-controls-panel">
        <div className="filter-row-top">
          {/* Quick Date Presets */}
          <div className="date-presets-group">
            <button
              className={`preset-pill ${datePreset === 'all' ? 'active' : ''}`}
              onClick={() => applyDatePreset('all')}
            >
              All Time
            </button>
            <button
              className={`preset-pill ${datePreset === 'today' ? 'active' : ''}`}
              onClick={() => applyDatePreset('today')}
            >
              Today
            </button>
            <button
              className={`preset-pill ${datePreset === 'yesterday' ? 'active' : ''}`}
              onClick={() => applyDatePreset('yesterday')}
            >
              Yesterday
            </button>
            <button
              className={`preset-pill ${datePreset === 'week' ? 'active' : ''}`}
              onClick={() => applyDatePreset('week')}
            >
              This Week
            </button>
            <button
              className={`preset-pill ${datePreset === 'month' ? 'active' : ''}`}
              onClick={() => applyDatePreset('month')}
            >
              This Month
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="custom-date-range">
            <Calendar size={15} className="text-muted" />
            <input
              type="date"
              className="date-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
              title="Start Date"
            />
            <span className="date-range-sep">to</span>
            <input
              type="date"
              className="date-input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
              title="End Date"
            />
          </div>
        </div>

        <div className="filter-row-bottom">
          {/* Entry Type Toggle */}
          <div className="type-filter-group">
            <button
              className={`type-filter-btn ${typeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setTypeFilter('ALL')}
            >
              All Entries
            </button>
            <button
              className={`type-filter-btn credit-type ${typeFilter === 'CREDIT' ? 'active' : ''}`}
              onClick={() => setTypeFilter('CREDIT')}
            >
              <ArrowDownLeft size={14} />
              Received (Credit)
            </button>
            <button
              className={`type-filter-btn debit-type ${typeFilter === 'DEBIT' ? 'active' : ''}`}
              onClick={() => setTypeFilter('DEBIT')}
            >
              <ArrowUpRight size={14} />
              Expenses (Debit)
            </button>
          </div>

          {/* Category Dropdown */}
          <div className="dropdown-filter-box">
            <Tag size={14} className="text-muted" />
            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Person Dropdown */}
          <div className="dropdown-filter-box">
            <Users size={14} className="text-muted" />
            <select
              className="filter-select"
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
            >
              <option value="">All Persons / Providers</option>
              {persons.map(p => (
                <option key={p.id || p.name} value={p.name}>{p.name} {p.roleOrTitle ? `(${p.roleOrTitle})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Quick Search */}
          <div className="search-box">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder="Search description, bills..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>
        </div>
      </section>

      {/* ── WHATSAPP-STYLE STATEMENT SUMMARY STRIP ─────────────────────────── */}
      <section className="statement-summary-strip">
        <div className="summary-pill-card">
          <span className="summary-pill-label">Opening Balance</span>
          <span className="summary-pill-value text-muted">
            ₹{Number(reportData.openingBalance || 0).toLocaleString('en-IN')}
          </span>
          <span className="summary-pill-hint">Brought forward from past</span>
        </div>

        <div className="summary-operator">+</div>

        <div className="summary-pill-card">
          <span className="summary-pill-label">Money Received</span>
          <span className="summary-pill-value text-success">
            ₹{Number(reportData.totalCredits || 0).toLocaleString('en-IN')}
          </span>
          <span className="summary-pill-hint">Total Credits</span>
        </div>

        <div className="summary-operator">−</div>

        <div className="summary-pill-card">
          <span className="summary-pill-label">Total Expenses</span>
          <span className="summary-pill-value text-danger">
            ₹{Number(reportData.totalDebits || 0).toLocaleString('en-IN')}
          </span>
          <span className="summary-pill-hint">Total Debits</span>
        </div>

        <div className="summary-operator">=</div>

        <div className="summary-pill-card closing-card">
          <span className="summary-pill-label">Closing Balance</span>
          <span className={`summary-pill-value font-bold ${reportData.closingBalance < 0 ? 'text-danger' : 'text-success'}`}>
            ₹{Number(reportData.closingBalance || 0).toLocaleString('en-IN')}
          </span>
          <span className="summary-pill-hint">Carry forward to next day</span>
        </div>
      </section>

      {/* ── PERSON-WISE CREDIT TOTALS SUMMARY PANEL ─────────────────────────── */}
      {reportData.personCreditBreakdown && reportData.personCreditBreakdown.length > 0 && (
        <section className="person-credit-summary-section">
          <div className="section-title-row">
            <div className="section-title-left">
              <Users size={16} className="text-accent" />
              <h3 className="section-title">Money Providers Summary</h3>
              <span className="badge-count">{reportData.personCreditBreakdown.length}</span>
            </div>
            {personFilter && (
              <button
                className="btn-text-clear"
                onClick={() => setPersonFilter('')}
              >
                Clear Person Filter (Showing {personFilter})
              </button>
            )}
          </div>

          <div className="person-cards-grid">
            {reportData.personCreditBreakdown.map((p, idx) => (
              <div
                key={p.personName || idx}
                className={`person-summary-card ${personFilter === p.personName ? 'active-person' : ''}`}
                onClick={() => setPersonFilter(prev => prev === p.personName ? '' : p.personName)}
                title="Click to filter statement by this person"
              >
                <div className="person-card-top">
                  <span className="person-name">{p.personName}</span>
                  <span className="person-count">{p.count} entries</span>
                </div>
                <div className="person-card-amt">
                  ₹{Number(p.totalAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TRANSACTIONS STATEMENT / PASSBOOK TABLE ────────────────────────── */}
      <section className="transactions-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-title">Petty Cash Statement</h3>
            <span className="table-subtitle">
              Showing {filteredLedger.length} of {reportData.count || 0} entries for {selectedSiteName}
            </span>
          </div>

          <button
            className="btn-refresh"
            onClick={loadTransactions}
            disabled={isLoadingTransactions}
            title="Refresh Transactions"
          >
            <RefreshCw size={14} className={isLoadingTransactions ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {isLoadingTransactions ? (
          <div className="loading-state">
            <RefreshCw size={24} className="spin text-accent" />
            <p>Loading site statement...</p>
          </div>
        ) : filteredLedger.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-box">
              <Wallet size={36} className="text-muted" />
            </div>
            <h4>No Petty Cash Entries Found</h4>
            <p className="text-muted">
              {startDate || endDate || typeFilter !== 'ALL' || categoryFilter !== 'ALL' || personFilter || searchQuery
                ? 'No transactions matched the selected filters. Try adjusting your dates or filters.'
                : `There are no transactions recorded for ${selectedSiteName} yet. Start by recording cash received or an expense.`}
            </p>
            <div className="empty-state-actions">
              <button className="btn-action btn-credit" onClick={() => setShowCreditModal(true)}>
                <ArrowDownLeft size={16} />
                <span>+ Record Money Received</span>
              </button>
              <button className="btn-action btn-debit" onClick={() => setShowDebitModal(true)}>
                <ArrowUpRight size={16} />
                <span>+ Record Site Expense</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="statement-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Date</th>
                  <th style={{ width: '130px' }}>Type</th>
                  <th>Category & Details</th>
                  <th>Person / Employee</th>
                  <th style={{ width: '110px' }}>Bills / Photos</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '60px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map((tx) => (
                  <tr key={tx.id || tx._id} className={tx.type === 'CREDIT' ? 'row-credit' : 'row-debit'}>
                    <td className="cell-date">
                      <span className="date-badge">{tx.date}</span>
                    </td>
                    <td>
                      {tx.type === 'CREDIT' ? (
                        <span className="type-badge badge-credit">
                          <ArrowDownLeft size={13} />
                          Received
                        </span>
                      ) : (
                        <span className="type-badge badge-debit">
                          <ArrowUpRight size={13} />
                          Expense
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="desc-main">{tx.description}</div>
                      <div className="category-meta">
                        <span className="category-tag">{tx.category}</span>
                        {tx.subcategory && (
                          <span className="subcategory-tag">{tx.subcategory}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="person-row">
                        <Users size={14} className="text-muted" />
                        <span className="person-title">
                          {tx.personName}
                        </span>
                      </div>
                      <span className="person-role-hint">
                        {tx.type === 'CREDIT' ? 'Money Provider' : 'Spent By Employee'}
                      </span>
                    </td>
                    <td>
                      {tx.photos && tx.photos.length > 0 ? (
                        <button
                          className="photos-pill-btn"
                          onClick={() => setActivePhotoViewer(tx.photos)}
                          title="Click to view attached bills/photos"
                        >
                          <Camera size={13} />
                          <span>{tx.photos.length} {tx.photos.length === 1 ? 'Photo' : 'Photos'}</span>
                        </button>
                      ) : (
                        <span className="no-photos-hint">—</span>
                      )}
                    </td>
                    <td className="cell-amount">
                      <span className={`amount-text ${tx.type === 'CREDIT' ? 'text-success' : 'text-danger'}`}>
                        {tx.type === 'CREDIT' ? '+' : '−'} ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="cell-actions">
                      <button
                        className="btn-trash"
                        title="Delete transaction"
                        onClick={() => handleDeleteTransaction(tx.id || tx._id, tx.description, tx.amount)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── MODAL: RECORD CREDIT ENTRY (MONEY RECEIVED) ──────────────────────── */}
      {showCreditModal && (
        <div className="modal-overlay" onClick={() => setShowCreditModal(false)}>
          <div className="modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header header-credit-bg">
              <div className="modal-title-row">
                <ArrowDownLeft size={20} className="text-success" />
                <h3>Record Money Received (Credit)</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowCreditModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmitCredit} className="modal-form">
              <div className="form-info-banner">
                Recording inward cash received into <strong>{selectedSiteName}</strong> petty cash box.
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Date Received <span className="req">*</span></label>
                  <input
                    type="date"
                    required
                    className="form-control"
                    value={creditForm.date}
                    onChange={(e) => setCreditForm({ ...creditForm, date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Amount (₹) <span className="req">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="e.g. 10000"
                    className="form-control font-bold"
                    value={creditForm.amount}
                    onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                  />
                </div>
              </div>

              {/* Person Who Provided Money */}
              <div className="form-group">
                <div className="label-with-action">
                  <label>Person Who Provided Money <span className="req">*</span></label>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setCreditForm(prev => ({ ...prev, isCustomPerson: !prev.isCustomPerson }))}
                  >
                    {creditForm.isCustomPerson ? '← Select from list' : '+ Enter new person name'}
                  </button>
                </div>

                {creditForm.isCustomPerson ? (
                  <input
                    type="text"
                    required
                    placeholder="Enter full name of person (e.g. Ketan Dasalaniya)"
                    className="form-control"
                    value={creditForm.customPersonName}
                    onChange={(e) => setCreditForm({ ...creditForm, customPersonName: e.target.value })}
                  />
                ) : (
                  <select
                    required
                    className="form-control"
                    value={creditForm.personName}
                    onChange={(e) => setCreditForm({ ...creditForm, personName: e.target.value })}
                  >
                    <option value="">-- Select Person --</option>
                    {persons.map(p => (
                      <option key={p.id || p.name} value={p.name}>
                        {p.name} {p.roleOrTitle ? `(${p.roleOrTitle})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Category & Subcategory */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Category <span className="req">*</span></label>
                  <select
                    required
                    className="form-control"
                    value={creditForm.category}
                    onChange={(e) => setCreditForm({ ...creditForm, category: e.target.value, subcategory: '' })}
                  >
                    {categories.map(c => (
                      <option key={c.id || c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Subcategory (Optional)</label>
                  {creditSubcategories.length > 0 ? (
                    <select
                      className="form-control"
                      value={creditForm.subcategory}
                      onChange={(e) => setCreditForm({ ...creditForm, subcategory: e.target.value })}
                    >
                      <option value="">-- Select Subcategory --</option>
                      {creditSubcategories.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. Bank Cash, Partner Fund"
                      className="form-control"
                      value={creditForm.subcategory}
                      onChange={(e) => setCreditForm({ ...creditForm, subcategory: e.target.value })}
                    />
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Description / Remarks <span className="req">*</span></label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Cash received for weekly labor and binding wire purchase"
                  className="form-control"
                  value={creditForm.description}
                  onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })}
                />
              </div>

              {/* Photo Attachments */}
              <div className="form-group">
                <label>Voucher / Cash Receipt Photographs</label>
                <div className="photo-upload-zone">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    ref={fileInputCreditRef}
                    style={{ display: 'none' }}
                    onChange={(e) => handlePhotoUpload(e, 'CREDIT')}
                  />

                  <div className="upload-buttons-row">
                    <button
                      type="button"
                      className="btn-upload-trigger"
                      onClick={() => fileInputCreditRef.current?.click()}
                    >
                      <Camera size={16} />
                      <span>Take Photo / Choose Images</span>
                    </button>
                    <span className="upload-tip">Supports camera capture & gallery files</span>
                  </div>

                  {creditForm.photos.length > 0 && (
                    <div className="photo-preview-grid">
                      {creditForm.photos.map((p, idx) => (
                        <div key={idx} className="preview-thumb-box">
                          <img src={p.dataUrl} alt={p.name || 'preview'} className="preview-thumb" />
                          <button
                            type="button"
                            className="remove-thumb-btn"
                            onClick={() => removePhoto(idx, 'CREDIT')}
                            title="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary btn-save-credit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording...' : 'Record Money Received'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RECORD DEBIT ENTRY (SITE EXPENSE) ─────────────────────────── */}
      {showDebitModal && (
        <div className="modal-overlay" onClick={() => setShowDebitModal(false)}>
          <div className="modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header header-debit-bg">
              <div className="modal-title-row">
                <ArrowUpRight size={20} className="text-danger" />
                <h3>Record Site Expense (Debit)</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowDebitModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmitDebit} className="modal-form">
              <div className="form-info-banner">
                Recording actual expense incurred at <strong>{selectedSiteName}</strong>.
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Date of Expense <span className="req">*</span></label>
                  <input
                    type="date"
                    required
                    className="form-control"
                    value={debitForm.date}
                    onChange={(e) => setDebitForm({ ...debitForm, date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Amount (₹) <span className="req">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="e.g. 1500"
                    className="form-control font-bold"
                    value={debitForm.amount}
                    onChange={(e) => setDebitForm({ ...debitForm, amount: e.target.value })}
                  />
                </div>
              </div>

              {/* Employee Name */}
              <div className="form-group">
                <label>Employee Name (Who Handled Expense) <span className="req">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Site Supervisor / Driver Raju"
                  className="form-control"
                  value={debitForm.personName}
                  onChange={(e) => setDebitForm({ ...debitForm, personName: e.target.value })}
                />
              </div>

              {/* Category & Subcategory */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Category <span className="req">*</span></label>
                  <select
                    required
                    className="form-control"
                    value={debitForm.category}
                    onChange={(e) => setDebitForm({ ...debitForm, category: e.target.value, subcategory: '' })}
                  >
                    {categories.filter(c => c.name !== 'Opening Balance').map(c => (
                      <option key={c.id || c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Subcategory (Optional)</label>
                  {debitSubcategories.length > 0 ? (
                    <select
                      className="form-control"
                      value={debitForm.subcategory}
                      onChange={(e) => setDebitForm({ ...debitForm, subcategory: e.target.value })}
                    >
                      <option value="">-- Select Subcategory --</option>
                      {debitSubcategories.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. Hardware, Auto Fare"
                      className="form-control"
                      value={debitForm.subcategory}
                      onChange={(e) => setDebitForm({ ...debitForm, subcategory: e.target.value })}
                    />
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Expense Description / Bill Details <span className="req">*</span></label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Purchased 2 rolls binding wire & 1kg nails from local hardware shop"
                  className="form-control"
                  value={debitForm.description}
                  onChange={(e) => setDebitForm({ ...debitForm, description: e.target.value })}
                />
              </div>

              {/* Photo Attachments (Bill / Material photo) */}
              <div className="form-group">
                <label>Attach Bill / Receipt / Material Photographs</label>
                <div className="photo-upload-zone">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    ref={fileInputDebitRef}
                    style={{ display: 'none' }}
                    onChange={(e) => handlePhotoUpload(e, 'DEBIT')}
                  />

                  <div className="upload-buttons-row">
                    <button
                      type="button"
                      className="btn-upload-trigger"
                      onClick={() => fileInputDebitRef.current?.click()}
                    >
                      <Camera size={16} />
                      <span>Capture Bill / Receipt Photo</span>
                    </button>
                    <span className="upload-tip">Multiple photos supported</span>
                  </div>

                  {debitForm.photos.length > 0 && (
                    <div className="photo-preview-grid">
                      {debitForm.photos.map((p, idx) => (
                        <div key={idx} className="preview-thumb-box">
                          <img src={p.dataUrl} alt={p.name || 'bill'} className="preview-thumb" />
                          <button
                            type="button"
                            className="remove-thumb-btn"
                            onClick={() => removePhoto(idx, 'DEBIT')}
                            title="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDebitModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary btn-save-debit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MANAGE CATEGORIES & MONEY PROVIDERS ───────────────────────── */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <SettingsIcon size={20} className="text-accent" />
                <h3>Petty Cash Settings</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>

            <div className="settings-nav-tabs">
              <button
                className={`settings-nav-btn ${settingsTab === 'categories' ? 'active' : ''}`}
                onClick={() => setSettingsTab('categories')}
              >
                <Tag size={16} />
                <span>Categories & Subcategories</span>
              </button>
              <button
                className={`settings-nav-btn ${settingsTab === 'persons' ? 'active' : ''}`}
                onClick={() => setSettingsTab('persons')}
              >
                <Users size={16} />
                <span>Money Providers (Persons)</span>
              </button>
            </div>

            <div className="modal-body settings-modal-body">
              {settingsTab === 'categories' ? (
                <div>
                  <form onSubmit={handleAddCategory} className="settings-add-form">
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label>Category Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Safety & Equipment"
                          className="form-control"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Subcategories (Comma separated)</label>
                        <input
                          type="text"
                          placeholder="e.g. Helmets, Boots, Gloves"
                          className="form-control"
                          value={newSubcatInput}
                          onChange={(e) => setNewSubcatInput(e.target.value)}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary btn-sm">
                      <Plus size={14} />
                      <span>Add Category</span>
                    </button>
                  </form>

                  <div className="settings-items-list">
                    <h4>Configured Categories ({categories.length})</h4>
                    <div className="category-items-grid">
                      {categories.map(c => (
                        <div key={c.id || c.name} className="category-card-item">
                          <div className="cat-card-header">
                            <span className="cat-card-title">{c.name}</span>
                            <button
                              className="btn-trash-sm"
                              onClick={() => handleDeleteCategory(c.id)}
                              title="Delete category"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          {c.subcategories && c.subcategories.length > 0 ? (
                            <div className="cat-subcategories-chips">
                              {c.subcategories.map((sub, i) => (
                                <span key={i} className="subcat-chip">{sub}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '11px' }}>No subcategories</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <form onSubmit={handleAddPerson} className="settings-add-form">
                    <div className="form-grid-3">
                      <div className="form-group">
                        <label>Person Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ramesh Patel"
                          className="form-control"
                          value={newPersonForm.name}
                          onChange={(e) => setNewPersonForm({ ...newPersonForm, name: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Role / Designation (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Director, Client, Partner"
                          className="form-control"
                          value={newPersonForm.roleOrTitle}
                          onChange={(e) => setNewPersonForm({ ...newPersonForm, roleOrTitle: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Phone Number (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. 9876543210"
                          className="form-control"
                          value={newPersonForm.phone}
                          onChange={(e) => setNewPersonForm({ ...newPersonForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary btn-sm">
                      <Plus size={14} />
                      <span>Add Person</span>
                    </button>
                  </form>

                  <div className="settings-items-list">
                    <h4>Reusable Money Providers List ({persons.length})</h4>
                    <div className="persons-items-table">
                      {persons.map(p => (
                        <div key={p.id || p.name} className="person-row-item">
                          <div className="person-row-info">
                            <span className="person-row-name">{p.name}</span>
                            {p.roleOrTitle && (
                              <span className="person-row-tag">{p.roleOrTitle}</span>
                            )}
                            {p.phone && (
                              <span className="person-row-phone">{p.phone}</span>
                            )}
                          </div>
                          <button
                            className="btn-trash-sm"
                            onClick={() => handleDeletePerson(p.id)}
                            title="Remove person"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE NEW CONSTRUCTION SITE ──────────────────────────────── */}
      {showNewSiteModal && (
        <div className="modal-overlay" onClick={() => setShowNewSiteModal(false)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <FolderPlus size={18} className="text-accent" />
                <h3>Add Construction Site</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowNewSiteModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateSite} className="modal-form">
              <div className="form-group">
                <label>Site / Project Name <span className="req">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Skyrise Tower Site"
                  className="form-control"
                  value={newSiteForm.name}
                  onChange={(e) => setNewSiteForm({ ...newSiteForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Site Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SK-01"
                  className="form-control"
                  value={newSiteForm.code}
                  onChange={(e) => setNewSiteForm({ ...newSiteForm, code: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Site Location / Address (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Sector 18, Gandhinagar"
                  className="form-control"
                  value={newSiteForm.location}
                  onChange={(e) => setNewSiteForm({ ...newSiteForm, location: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowNewSiteModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX: PHOTO / RECEIPT VIEWER ─────────────────────────────────── */}
      {activePhotoViewer && (
        <div className="modal-overlay lightbox-overlay" onClick={() => setActivePhotoViewer(null)}>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <h4>Attached Receipts & Photographs ({activePhotoViewer.length})</h4>
              <button className="modal-close-btn" onClick={() => setActivePhotoViewer(null)}>×</button>
            </div>
            <div className="lightbox-content">
              {activePhotoViewer.map((photo, i) => (
                <div key={i} className="lightbox-item">
                  <img src={photo.dataUrl || photo.url} alt={photo.name || 'receipt'} className="lightbox-image" />
                  <div className="lightbox-caption">
                    <span>{photo.name || `Photo #${i + 1}`}</span>
                    <a
                      href={photo.dataUrl || photo.url}
                      download={photo.name || `receipt_${i + 1}.jpg`}
                      className="download-link"
                    >
                      <Download size={14} /> Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
