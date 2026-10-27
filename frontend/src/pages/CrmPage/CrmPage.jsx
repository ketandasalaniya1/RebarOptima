import React, { useState, useEffect } from 'react';
import {
  Building2, Users, Target, LayoutGrid, Calendar, CheckSquare,
  FileText, CreditCard, BarChart3, Settings as SettingsIcon,
  Search, Plus, Filter, Phone, Mail, Clock, DollarSign,
  ChevronRight, ArrowRight, AlertCircle, CheckCircle, X,
  Printer, RefreshCw, Eye, Sparkles, Building, UserCheck,
  MessageSquare, Send, Share2, Download, ChevronLeft,
  GripVertical, FileSpreadsheet, MapPin
} from 'lucide-react';
import { crmApi } from '../../utils/crmApi';
import { useActiveProject } from '../../hooks/useActiveProject';
import { PageHeader } from '../../components/ui';
import './CrmPage.css';

// ── 2D ARCHITECTURAL FLOOR PLAN BLUEPRINT VECTOR COMPONENT (SCREENSHOTS 1 & 2) ──
function FloorPlanBlueprint({ unit }) {
  const config = (unit?.configuration || '2BHK').toUpperCase();
  const is1Bhk = config.includes('1');
  const is3Bhk = config.includes('3');
  const is4Bhk = config.includes('4') || config.includes('PENTHOUSE');

  return (
    <svg viewBox="0 0 520 280" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', borderRadius: '8px' }}>
      <defs>
        <pattern id="cadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.75" />
        </pattern>
      </defs>
      {/* CAD Paper Background */}
      <rect width="520" height="280" fill="#f8fafc" />
      <rect width="520" height="280" fill="url(#cadGrid)" />

      {/* Outer Structural Perimeter Walls */}
      <rect x="20" y="20" width="480" height="240" fill="#ffffff" stroke="#1e293b" strokeWidth="4" rx="3" />

      {/* Room 1: Living & Dining Grand Salon */}
      <rect x="25" y="25" width="260" height="135" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
      <text x="155" y="75" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="800" letterSpacing="0.03em">LIVING & DINING SALON</text>
      <text x="155" y="94" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">6.2m × 4.4m (294 SQ.FT)</text>
      {/* Sofa L-Sectional */}
      <rect x="40" y="40" width="35" height="75" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      <rect x="75" y="80" width="55" height="35" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      {/* Coffee Table */}
      <rect x="90" y="52" width="36" height="22" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

      {/* Balcony / Sky Deck (Matching Screenshot 1 & 2) */}
      <rect x="285" y="25" width="210" height="55" fill="#ecfdf5" stroke="#059669" strokeWidth="2" strokeDasharray="5 3" />
      <text x="390" y="50" textAnchor="middle" fill="#047857" fontSize="11" fontWeight="800">🌿 PANORAMIC BALCONY DECK</text>
      <text x="390" y="65" textAnchor="middle" fill="#059669" fontSize="9" fontWeight="600">4.8m × 1.6m • Sky View</text>
      <line x1="300" y1="28" x2="300" y2="78" stroke="#059669" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="480" y1="28" x2="480" y2="78" stroke="#059669" strokeWidth="1" strokeDasharray="3 3" />

      {/* Room 2: Master Suite */}
      <rect x="285" y="80" width="210" height="110" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
      <text x="390" y="125" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="800">MASTER BEDROOM</text>
      <text x="390" y="142" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">4.4m × 3.8m (180 SQ.FT)</text>
      {/* King Bed with Pillows */}
      <rect x="360" y="92" width="60" height="60" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      <rect x="365" y="96" width="22" height="14" rx="2" fill="#f1f5f9" />
      <rect x="393" y="96" width="22" height="14" rx="2" fill="#f1f5f9" />

      {/* Master En-Suite Bathroom */}
      <rect x="375" y="190" width="120" height="70" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
      <text x="435" y="222" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="800">EN-SUITE BATH</text>
      <text x="435" y="238" textAnchor="middle" fill="#64748b" fontSize="9">2.6m × 1.8m</text>
      <circle cx="470" cy="245" r="12" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

      {/* Modular Kitchen & Utility */}
      <rect x="25" y="160" width="145" height="100" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
      <text x="97" y="202" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="800">MODULAR KITCHEN</text>
      <text x="97" y="218" textAnchor="middle" fill="#64748b" fontSize="9">3.4m × 2.6m</text>
      <path d="M 30 165 L 160 165 L 160 190 L 60 190 L 60 255 L 30 255 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="45" cy="178" r="6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="140" cy="178" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

      {/* Secondary Bedroom / Guest Bedroom */}
      <rect x="170" y="160" width="205" height="100" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
      <text x="272" y="202" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="800">
        {is1Bhk ? 'HOME OFFICE / FOYER' : (is3Bhk || is4Bhk ? 'BEDROOM 2 (DELUXE)' : 'GUEST BEDROOM')}
      </text>
      <text x="272" y="218" textAnchor="middle" fill="#64748b" fontSize="9">3.8m × 3.2m</text>
      {!is1Bhk && (
        <rect x="245" y="222" width="55" height="34" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      )}

      {/* Door Swing Arcs */}
      <path d="M 285 110 A 25 25 0 0 1 310 135" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 2" />
      <path d="M 170 185 A 25 25 0 0 1 195 210" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 2" />
      <path d="M 375 210 A 20 20 0 0 1 395 230" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 2" />

      {/* CAD Title Block Badge */}
      <rect x="35" y="32" width="145" height="24" rx="4" fill="#0f172a" />
      <text x="107" y="48" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="800" letterSpacing="0.04em">
        {unit?.unitCode ? `UNIT ${unit.unitCode}` : 'ARCHITECTURAL LAYOUT'} • {unit?.configuration || '2BHK'}
      </text>
    </svg>
  );
}

export default function CrmPage() {
  const { projectId: activeProjectId, projectEpoch, selectedProject } = useActiveProject();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  useEffect(() => {
    if (activeProjectId) setSelectedProjectId(String(activeProjectId));
  }, [activeProjectId, projectEpoch]);
  const [searchResults, setSearchResults] = useState(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState(null);

  // Customers Data
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer360, setSelectedCustomer360] = useState(null);
  const [c360ActiveSubTab, setC360ActiveSubTab] = useState('interests');

  // Leads & Pipeline Data (with JIRA Drag & Drop)
  const [leads, setLeads] = useState([]);
  const [pipelineStats, setPipelineStats] = useState(null);
  const [pipelineViewMode, setPipelineViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // Units & Inventory Data (Profitbase Chessboard)
  const [units, setUnits] = useState([]);
  const [selectedUnitProfile, setSelectedUnitProfile] = useState(null); // Darshan's Unit Wise Profile
  const [unitViewMode, setUnitViewMode] = useState('chessboard'); // 'chessboard' | 'grid' | 'table'
  const [chessboardFilters, setChessboardFilters] = useState({
    tower: 'all',
    priceMin: '',
    priceMax: '',
    areaMin: '',
    areaMax: '',
    floorMin: '',
    floorMax: '',
    rooms: 'all',
    status: 'all'
  });
  const [inspectedUnit, setInspectedUnit] = useState(null);
  const [inspectedUnitProfile, setInspectedUnitProfile] = useState(null);

  // Leaf360 3-Column Profile State (Screenshot 4)
  const [composerType, setComposerType] = useState('Note'); // 'Note' | 'Email' | 'WhatsApp' | 'Call'
  const [composerText, setComposerText] = useState('');
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

  // Visits & Tasks Data
  const [siteVisits, setSiteVisits] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskFilter, setTaskFilter] = useState('all'); // 'all' | 'today' | 'overdue'

  // Bookings Data
  const [bookings, setBookings] = useState([]);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);

  // Payments & Receipts Data
  const [payments, setPayments] = useState([]);
  const [printableReceipt, setPrintableReceipt] = useState(null);

  // Reports & Analytics Data
  const [salespersonStats, setSalespersonStats] = useState([]);

  // Settings Data
  const [crmSettings, setCrmSettings] = useState(null);

  // Modal States
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showScheduleVisitModal, setShowScheduleVisitModal] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

  // Form States & Duplicate Warnings
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [customerFormData, setCustomerFormData] = useState({
    fullName: '', phone: '', email: '', leadSource: 'Website',
    budgetMin: '', budgetMax: '', preferredPropertyType: '2BHK', notes: ''
  });
  const [leadFormData, setLeadFormData] = useState({
    customerId: '', projectId: '', unitId: '', stage: 'New',
    budget: '', priority: 'Medium', notes: ''
  });
  const [visitFormData, setVisitFormData] = useState({
    customerId: '', projectId: '', unitId: '', visitDateTime: '', notes: ''
  });
  const [bookingFormData, setBookingFormData] = useState({
    customerId: '', projectId: '', unitId: '', agreementPrice: '',
    discountAmount: 0, taxAmount: 0, bookingDepositRequired: '', notes: ''
  });
  const [paymentFormData, setPaymentFormData] = useState({
    bookingId: '', amount: '', paymentMethod: 'Bank Transfer (NEFT/RTGS)',
    transactionReference: '', receiptNotes: ''
  });

  // Load Initial Workspace Data
  useEffect(() => {
    loadProjects();
  }, []);

  // Reload CRM views whenever tab or active project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    if (activeTab === 'dashboard') loadDashboard();
    if (activeTab === 'customers') loadCustomers();
    if (activeTab === 'pipeline') loadPipeline();
    if (activeTab === 'inventory') loadInventory();
    if (activeTab === 'visits-tasks') { loadVisits(); loadTasks(); }
    if (activeTab === 'bookings') loadBookings();
    if (activeTab === 'payments') loadPayments();
    if (activeTab === 'reports') loadReports();
    if (activeTab === 'settings') loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedProjectId, projectEpoch]);

  const loadProjects = async () => {
    try {
      const res = await crmApi.getProjects();
      setProjects(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Could not load projects:', err);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getDashboardAnalytics({ projectId: selectedProjectId });
      setDashboardData(res);
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getCustomers({ search: customerSearch });
      setCustomers(res.data || []);
    } catch (err) {
      console.warn('Customers load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPipeline = async () => {
    setLoading(true);
    try {
      const [leadsRes, statsRes] = await Promise.all([
        crmApi.getLeads({ projectId: selectedProjectId }),
        crmApi.getPipelineStats({ projectId: selectedProjectId })
      ]);
      setLeads(Array.isArray(leadsRes) ? leadsRes : []);
      setPipelineStats(statsRes);
    } catch (err) {
      console.warn('Pipeline load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getUnits({ projectId: selectedProjectId });
      const loaded = Array.isArray(res) ? res : [];
      setUnits(loaded);
      if (loaded.length > 0) {
        handleSelectChessboardUnit(loaded[0]);
      }
    } catch (err) {
      console.warn('Inventory load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVisits = async () => {
    try {
      const res = await crmApi.getVisits({ projectId: selectedProjectId });
      setSiteVisits(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Visits load error:', err);
    }
  };

  const loadTasks = async () => {
    try {
      const res = await crmApi.getTasks();
      setTasks(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Tasks load error:', err);
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getBookings({ projectId: selectedProjectId });
      setBookings(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Bookings load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getPayments();
      setPayments(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Payments load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const [dash, reps] = await Promise.all([
        crmApi.getDashboardAnalytics({ projectId: selectedProjectId }),
        crmApi.getSalespersonStats()
      ]);
      setDashboardData(dash);
      setSalespersonStats(Array.isArray(reps) ? reps : []);
    } catch (err) {
      console.warn('Reports load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await crmApi.getSettings();
      setCrmSettings(res);
    } catch (err) {
      console.warn('Settings load error:', err);
    }
  };

  // Seed Enterprise Sample Real Estate Data
  const handleSeedDemoData = async () => {
    if (!window.confirm('Initialize enterprise demo data (Projects, Units, Rahul Shah multi-interest profile, and booking)?')) return;
    setLoading(true);
    try {
      await crmApi.seedSampleData();
      await loadProjects();
      await loadDashboard();
      alert('Enterprise demo dataset loaded successfully!');
    } catch (err) {
      alert('Seeding error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Global Search Handler
  const handleGlobalSearch = async (val) => {
    setGlobalSearchTerm(val);
    if (!val || val.length < 2) {
      setSearchResults(null);
      setShowSearchDropdown(false);
      return;
    }
    try {
      const res = await crmApi.search(val);
      setSearchResults(res);
      setShowSearchDropdown(true);
    } catch (err) {
      console.warn('Search error:', err);
    }
  };

  // Customer 360 Opener
  const openCustomer360 = async (customerId) => {
    try {
      const res = await crmApi.getCustomer360(customerId);
      setSelectedCustomer360(res);
      setC360ActiveSubTab('interests');
    } catch (err) {
      alert('Error fetching customer profile: ' + err.message);
    }
  };

  // Unit-Wise Profile Opener (Satisfies Darshan's diagram!)
  const openUnitProfile = async (unitId) => {
    try {
      const res = await crmApi.getUnitProfile(unitId);
      setSelectedUnitProfile(res);
    } catch (err) {
      alert('Error fetching unit-wise profile: ' + err.message);
    }
  };

  // Profitbase Chessboard Unit Inspector Opener
  const handleSelectChessboardUnit = async (u) => {
    if (!u) return;
    setInspectedUnit(u);
    try {
      const profile = await crmApi.getUnitProfile(u._id);
      setInspectedUnitProfile(profile);
    } catch (err) {
      console.warn('Could not load unit profile for inspection:', err);
    }
  };

  // Export Units Matrix to Excel (CSV Format)
  const handleExportUnitsToExcel = (listToExport) => {
    const dataList = listToExport && listToExport.length > 0 ? listToExport : units;
    if (!dataList || dataList.length === 0) {
      alert('No units match the filter criteria to export.');
      return;
    }
    const headers = [
      'Unit Code', 'Project', 'Tower / Section', 'Floor', 'Unit No',
      'Configuration', 'Carpet Area (sq.ft)', 'Saleable Area (sq.ft)',
      'Base Price (INR)', 'Asking Price (INR)', 'Status', 'Facing'
    ];
    const rows = dataList.map(u => [
      `"${u.unitCode || ''}"`,
      `"${u.projectName || ''}"`,
      `"${u.buildingTower || u.sectionName || ''}"`,
      u.floorNumber || '',
      u.unitNumber || '',
      `"${u.configuration || ''}"`,
      u.carpetAreaSqFt || 0,
      u.saleableAreaSqFt || 0,
      u.basePrice || 0,
      u.askingPrice || 0,
      `"${u.effectiveStatus || u.availabilityStatus || 'Available'}"`,
      `"${u.facing || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Real_Estate_Units_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JIRA-Style Draggable Kanban Handlers
  const handleDragStart = (e, lead) => {
    e.dataTransfer.setData('text/plain', lead._id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLead(lead);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, stageName) => {
    e.preventDefault();
    setDragOverStage(stageName);
  };

  const handleDragLeave = (e, stageName) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverStage === stageName) {
      setDragOverStage(null);
    }
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDragOverStage(null);
    const leadId = e.dataTransfer.getData('text/plain') || draggedLead?._id;
    if (!leadId) return;

    const lead = leads.find(l => l._id === leadId);
    if (!lead || (lead.stage || 'New') === targetStage) {
      setDraggedLead(null);
      return;
    }

    // 1. Snappy optimistic UI update (matching JIRA)
    setLeads(prevLeads =>
      prevLeads.map(l => l._id === leadId ? { ...l, stage: targetStage } : l)
    );
    setDraggedLead(null);

    // 2. Persist to backend and sync pipeline stats
    try {
      await crmApi.updateLeadStage(leadId, { stage: targetStage });
      const statsRes = await crmApi.getPipelineStats({ projectId: selectedProjectId });
      setPipelineStats(statsRes);
    } catch (err) {
      console.error('Drag stage update error:', err);
      alert('Failed to update stage: ' + err.message);
      loadPipeline(); // Rollback
    }
  };

  // Leaf360 Activity Composer Submit Handler (Screenshot 4)
  const handleComposerSubmit = async (e) => {
    e.preventDefault();
    if (!composerText.trim() || !selectedCustomer360) return;
    setComposerSubmitting(true);
    try {
      await crmApi.addCustomerActivity(selectedCustomer360.customer._id, {
        activityType: composerType,
        title: `${composerType}: ${composerText.trim().substring(0, 45)}`,
        description: composerText.trim()
      });
      setComposerText('');
      const refreshed = await crmApi.getCustomer360(selectedCustomer360.customer._id);
      setSelectedCustomer360(refreshed);
    } catch (err) {
      alert('Failed to log activity: ' + err.message);
    } finally {
      setComposerSubmitting(false);
    }
  };

  // Leaf360 Customer Navigation (Previous / Next)
  const handleBrowseCustomer = (delta) => {
    if (!customers || customers.length === 0 || !selectedCustomer360) return;
    const currentIdx = customers.findIndex(c => c._id === selectedCustomer360.customer._id);
    let nextIdx = (currentIdx + delta + customers.length) % customers.length;
    openCustomer360(customers[nextIdx]._id);
  };

  // Printable Receipt Opener
  const openPrintableReceipt = async (transactionId) => {
    try {
      const res = await crmApi.getReceipt(transactionId);
      setPrintableReceipt(res);
    } catch (err) {
      alert('Error loading receipt: ' + err.message);
    }
  };

  // Customer Duplicate Check on Phone Blur
  const handlePhoneBlur = async () => {
    if (!customerFormData.phone || customerFormData.phone.length < 10) return;
    try {
      const dup = await crmApi.checkDuplicate({ phone: customerFormData.phone, email: customerFormData.email });
      if (dup.isDuplicate) {
        setDuplicateWarning(dup.reason);
      } else {
        setDuplicateWarning(null);
      }
    } catch {}
  };

  // Create Customer Form Submit
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createCustomer(customerFormData);
      setShowAddCustomerModal(false);
      setCustomerFormData({
        fullName: '', phone: '', email: '', leadSource: 'Website',
        budgetMin: '', budgetMax: '', preferredPropertyType: '2BHK', notes: ''
      });
      setDuplicateWarning(null);
      loadCustomers();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  // Create Lead Form Submit
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!leadFormData.customerId || !leadFormData.projectId) {
      alert('Please select both Customer and Project.');
      return;
    }
    try {
      await crmApi.addCustomerInterest(leadFormData.customerId, leadFormData);
      setShowAddLeadModal(false);
      loadPipeline();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  // Advance Pipeline Stage
  const handleAdvanceStage = async (leadId, newStage) => {
    try {
      await crmApi.updateLeadStage(leadId, { stage: newStage });
      loadPipeline();
      if (selectedCustomer360) {
        openCustomer360(selectedCustomer360.customer._id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Quick Task Complete
  const handleCompleteTask = async (taskId) => {
    try {
      await crmApi.completeTask(taskId, { notes: 'Task marked completed via dashboard' });
      loadTasks();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  // Create Booking Submit
  const handleCreateBooking = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createBooking(bookingFormData);
      setShowNewBookingModal(false);
      loadBookings();
      loadInventory();
      loadDashboard();
    } catch (err) {
      alert('Booking creation failed: ' + err.message);
    }
  };

  // Record Payment Submit
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await crmApi.recordPayment(paymentFormData);
      setShowRecordPaymentModal(false);
      loadPayments();
      loadBookings();
      loadDashboard();
      if (res && res._id) {
        openPrintableReceipt(res._id);
      }
    } catch (err) {
      alert('Payment posting failed: ' + err.message);
    }
  };

  return (
    <div className="crm-container">
      <PageHeader
        title="Real Estate CRM"
        subtitle="Customers, unit pipelines, bookings, and collections"
        projectName={selectedProject?.name}
      />
      <div className="crm-header-bar">
        <div className="crm-header-actions" style={{ width: '100%' }}>
          <div className="crm-search-box">
            <Search size={16} className="crm-search-icon" />
            <input
              type="text"
              placeholder="Search customer, unit (e.g. A-1203), booking..."
              value={globalSearchTerm}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              onFocus={() => globalSearchTerm.length >= 2 && setShowSearchDropdown(true)}
              aria-label="Search CRM"
            />
            {showSearchDropdown && searchResults && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: '8px', zIndex: 50, padding: '0.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--card-border)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>SEARCH RESULTS</span>
                  <button onClick={() => setShowSearchDropdown(false)} style={{ background: 'none', border: 'none', color: 'var(--text-label)', cursor: 'pointer' }}><X size={14} /></button>
                </div>
                {searchResults.customers?.map(c => (
                  <div key={c._id} onClick={() => { openCustomer360(c._id); setShowSearchDropdown(false); }} style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem', borderRadius: '4px' }} className="crm-search-item">
                    👤 <strong>{c.fullName}</strong> — {c.phone} ({c.customerCode})
                  </div>
                ))}
                {searchResults.units?.map(u => (
                  <div key={u._id} onClick={() => { openUnitProfile(u._id); setShowSearchDropdown(false); }} style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem', borderRadius: '4px' }}>
                    🏢 Unit <strong>{u.unitCode}</strong> — {u.projectName} ({u.availabilityStatus})
                  </div>
                ))}
                {searchResults.bookings?.map(b => (
                  <div key={b._id} onClick={() => { setActiveTab('bookings'); setShowSearchDropdown(false); }} style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem', borderRadius: '4px' }}>
                    📑 Booking <strong>{b.bookingReference}</strong> — {b.customerName} (Unit {b.unitCode})
                  </div>
                ))}
                {searchResults.customers?.length === 0 && searchResults.units?.length === 0 && searchResults.bookings?.length === 0 && (
                  <div style={{ padding: '0.6rem', fontSize: '0.8rem', color: 'var(--text-label)', textAlign: 'center' }}>No records found</div>
                )}
              </div>
            )}
          </div>

          {/* Project Filter */}
          <select
            className="crm-select-filter"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>

          {/* Quick Create Buttons */}
          <button className="crm-btn-primary" onClick={() => setShowAddCustomerModal(true)}>
            <Plus size={16} /> New Customer
          </button>
          <button className="crm-btn-secondary" onClick={() => setShowAddLeadModal(true)}>
            <Target size={16} /> New Lead
          </button>
          <button className="crm-btn-secondary" onClick={handleSeedDemoData} title="Seed Rahul Shah & Demo Real Estate Data">
            <Sparkles size={16} color="var(--accent)" /> Load Demo Data
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ────────────────────────────────────────────────── */}
      <div className="crm-nav-tabs">
        <button className={`crm-tab-button ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutGrid size={16} /> Overview
        </button>
        <button className={`crm-tab-button ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
          <Users size={16} /> Customers <span className="crm-tab-badge">{dashboardData?.kpis?.totalCustomers || customers.length || 0}</span>
        </button>
        <button className={`crm-tab-button ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')}>
          <Target size={16} /> Leads & Pipeline <span className="crm-tab-badge">{leads.length}</span>
        </button>
        <button className={`crm-tab-button ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
          <Building size={16} /> Units & Availability <span className="crm-tab-badge">{dashboardData?.inventory?.total || units.length || 0}</span>
        </button>
        <button className={`crm-tab-button ${activeTab === 'visits-tasks' ? 'active' : ''}`} onClick={() => setActiveTab('visits-tasks')}>
          <CheckSquare size={16} /> Site Visits & Tasks
          {dashboardData?.kpis?.overdueFollowUps > 0 && (
            <span className="crm-tab-badge danger">{dashboardData.kpis.overdueFollowUps} overdue</span>
          )}
        </button>
        <button className={`crm-tab-button ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>
          <FileText size={16} /> Bookings <span className="crm-tab-badge">{bookings.length}</span>
        </button>
        <button className={`crm-tab-button ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
          <CreditCard size={16} /> Payments & Receipts <span className="crm-tab-badge">{payments.length}</span>
        </button>
        <button className={`crm-tab-button ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
          <BarChart3 size={16} /> Reports & Analytics
        </button>
        <button className={`crm-tab-button ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <SettingsIcon size={16} /> CRM Settings
        </button>
      </div>

      {/* ── TAB 1: EXECUTIVE DASHBOARD ─────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div>
          {/* KPI Section */}
          <div className="crm-kpi-grid">
            <div className="crm-kpi-card">
              <div className="crm-kpi-header">
                <span className="crm-kpi-title">Total Customers</span>
                <div className="crm-kpi-icon-wrap"><Users size={16} color="var(--accent)" /></div>
              </div>
              <div className="crm-kpi-value">{dashboardData?.kpis?.totalCustomers ?? 0}</div>
              <div className="crm-kpi-subtitle">Active customer directory</div>
            </div>

            <div className="crm-kpi-card">
              <div className="crm-kpi-header">
                <span className="crm-kpi-title">New Enquiries</span>
                <div className="crm-kpi-icon-wrap"><Target size={16} color="#60a5fa" /></div>
              </div>
              <div className="crm-kpi-value">{dashboardData?.kpis?.newLeads ?? 0}</div>
              <div className="crm-kpi-subtitle">Inbound this month</div>
            </div>

            <div className="crm-kpi-card">
              <div className="crm-kpi-header">
                <span className="crm-kpi-title">Site Visits Scheduled</span>
                <div className="crm-kpi-icon-wrap"><Calendar size={16} color="#fbbf24" /></div>
              </div>
              <div className="crm-kpi-value">{dashboardData?.kpis?.siteVisitsScheduled ?? 0}</div>
              <div className="crm-kpi-subtitle">Upcoming walkthroughs</div>
            </div>

            <div className="crm-kpi-card">
              <div className="crm-kpi-header">
                <span className="crm-kpi-title">Tasks Due Today</span>
                <div className="crm-kpi-icon-wrap"><Clock size={16} color="#c084fc" /></div>
              </div>
              <div className="crm-kpi-value">{dashboardData?.kpis?.followUpsDueToday ?? 0}</div>
              <div className="crm-kpi-subtitle">
                {dashboardData?.kpis?.overdueFollowUps > 0 ? (
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{dashboardData.kpis.overdueFollowUps} Overdue</span>
                ) : 'All follow-ups on track'}
              </div>
            </div>

            <div className="crm-kpi-card">
              <div className="crm-kpi-header">
                <span className="crm-kpi-title">Confirmed Bookings</span>
                <div className="crm-kpi-icon-wrap"><CheckCircle size={16} color="#10b981" /></div>
              </div>
              <div className="crm-kpi-value">{dashboardData?.kpis?.confirmedBookings ?? 0}</div>
              <div className="crm-kpi-subtitle">Units allocated & booked</div>
            </div>

            <div className="crm-kpi-card">
              <div className="crm-kpi-header">
                <span className="crm-kpi-title">Total Booking Value</span>
                <div className="crm-kpi-icon-wrap"><DollarSign size={16} color="#10b981" /></div>
              </div>
              <div className="crm-kpi-value">₹{(dashboardData?.kpis?.totalBookingValue || 0).toLocaleString()}</div>
              <div className="crm-kpi-subtitle">Agreed net sales contract value</div>
            </div>

            <div className="crm-kpi-card">
              <div className="crm-kpi-header">
                <span className="crm-kpi-title">Payments Collected</span>
                <div className="crm-kpi-icon-wrap"><CreditCard size={16} color="#34d399" /></div>
              </div>
              <div className="crm-kpi-value">₹{(dashboardData?.kpis?.paymentsCollected || 0).toLocaleString()}</div>
              <div className="crm-kpi-subtitle">Verified receipts received</div>
            </div>

            <div className="crm-kpi-card">
              <div className="crm-kpi-header">
                <span className="crm-kpi-title">Outstanding Receivables</span>
                <div className="crm-kpi-icon-wrap"><AlertCircle size={16} color="#f59e0b" /></div>
              </div>
              <div className="crm-kpi-value">₹{(dashboardData?.kpis?.outstandingReceivables || 0).toLocaleString()}</div>
              <div className="crm-kpi-subtitle">Balance due across installments</div>
            </div>
          </div>

          {/* Section Grid: Pipeline Funnel & Inventory Summary */}
          <div className="crm-section-grid">
            <div className="crm-card">
              <div className="crm-card-header">
                <span className="crm-card-title"><Target size={18} /> Lead Pipeline Stage Distribution</span>
                <button className="crm-btn-secondary" onClick={() => setActiveTab('pipeline')}>View Kanban Board <ArrowRight size={14} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.8rem', padding: '0.5rem 0' }}>
                {Object.entries(dashboardData?.pipeline || {}).map(([stage, count]) => (
                  <div key={stage} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{stage}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="crm-card">
              <div className="crm-card-header">
                <span className="crm-card-title"><Building size={18} /> Inventory Availability</span>
                <button className="crm-btn-secondary" onClick={() => setActiveTab('inventory')}>Unit Matrix</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--card-border)' }}>
                  <span>🟢 Available for Booking</span>
                  <strong>{dashboardData?.inventory?.available ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--card-border)' }}>
                  <span>🟡 Temporarily Held</span>
                  <strong>{dashboardData?.inventory?.held ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--card-border)' }}>
                  <span>🔵 Formally Reserved</span>
                  <strong>{dashboardData?.inventory?.reserved ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--card-border)' }}>
                  <span>🟣 Confirmed Booked</span>
                  <strong>{dashboardData?.inventory?.booked ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0' }}>
                  <span>⚪ Blocked / Management Hold</span>
                  <strong>{dashboardData?.inventory?.blocked ?? 0}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Sales Activities & Quick Actions */}
          <div className="crm-card">
            <div className="crm-card-header">
              <span className="crm-card-title"><Clock size={18} /> Real-Time CRM Activity Trail</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-label)' }}>System Audit Log Verified</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {(dashboardData?.recentActivities || []).map((act, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.4rem 0' }}>
                  <div style={{ marginTop: '3px' }}><div className="crm-badge-dot" style={{ background: 'var(--accent)' }} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{act.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{act.description}</div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-label)' }}>
                    {new Date(act.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: CUSTOMERS DIRECTORY & CUSTOMER 360 ──────────────────────── */}
      {activeTab === 'customers' && (
        <div className="crm-card">
          <div className="crm-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="crm-card-title"><Users size={18} /> Customer Master Directory</span>
              <div className="crm-search-box" style={{ minWidth: '220px' }}>
                <Search size={14} className="crm-search-icon" />
                <input
                  type="text"
                  placeholder="Filter customers by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyUp={(e) => e.key === 'Enter' && loadCustomers()}
                />
              </div>
            </div>
            <button className="crm-btn-primary" onClick={() => setShowAddCustomerModal(true)}>
              <Plus size={16} /> Add Customer Profile
            </button>
          </div>

          <div className="crm-table-container">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Customer Name</th>
                  <th>Contact Info</th>
                  <th>Lead Source</th>
                  <th>Assigned Salesperson</th>
                  <th>Active Interests</th>
                  <th>Bookings</th>
                  <th>Total Value</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id} className="crm-table-row-clickable" onClick={() => openCustomer360(c._id)}>
                    <td><span style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.customerCode}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.fullName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{c.city || 'Location N/A'}</div>
                    </td>
                    <td>
                      <div>📞 {c.phone}</div>
                      {c.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>✉️ {c.email}</div>}
                    </td>
                    <td><span className="crm-badge crm-badge-stage-contacted">{c.leadSource || 'Direct'}</span></td>
                    <td>{c.assignedSalespersonName || 'Sales Team'}</td>
                    <td>
                      <span className="crm-badge" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        {c.activeInterestsCount || 0} active ({c.totalInterestsCount || 0} total)
                      </span>
                    </td>
                    <td>
                      {c.bookingsCount > 0 ? (
                        <span className="crm-badge crm-badge-stage-booked">{c.bookingsCount} Booked</span>
                      ) : (
                        <span style={{ color: 'var(--text-label)' }}>0</span>
                      )}
                    </td>
                    <td>
                      <strong>₹{(c.totalBookingValue || 0).toLocaleString()}</strong>
                    </td>
                    <td>
                      <button className="crm-btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }} onClick={(e) => { e.stopPropagation(); openCustomer360(c._id); }}>
                        <Eye size={13} /> View 360
                      </button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-label)' }}>
                      No customers found. Click "+ Add Customer Profile" or "Load Demo Data".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: LEADS & SALES PIPELINE (KANBAN) ─────────────────────────── */}
      {activeTab === 'pipeline' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Showing unit interest enquiries. Each card represents a unique customer-to-unit opportunity with independent stage tracking.
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--accent)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sparkles size={13} />
                <strong>JIRA-Style Drag & Drop Enabled:</strong> Drag cards between columns to change stages seamlessly.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className={`crm-btn-secondary ${pipelineViewMode === 'kanban' ? 'active' : ''}`} onClick={() => setPipelineViewMode('kanban')}>
                Kanban View
              </button>
              <button className={`crm-btn-secondary ${pipelineViewMode === 'table' ? 'active' : ''}`} onClick={() => setPipelineViewMode('table')}>
                Table View
              </button>
              <button className="crm-btn-primary" onClick={() => setShowAddLeadModal(true)}>
                <Plus size={16} /> New Lead Enquiry
              </button>
            </div>
          </div>

          {pipelineViewMode === 'kanban' ? (
            <div className="crm-kanban-board">
              {[
                'New', 'Contacted', 'Qualified', 'Visit Scheduled',
                'Visited', 'Negotiation', 'Booked', 'Lost', 'On Hold'
              ].map((stageName) => {
                const stageLeads = leads.filter(l => (l.stage || 'New') === stageName);
                const isDragTarget = dragOverStage === stageName;
                return (
                  <div
                    key={stageName}
                    className={`crm-kanban-column ${isDragTarget ? 'drag-over' : ''}`}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, stageName)}
                    onDragLeave={(e) => handleDragLeave(e, stageName)}
                    onDrop={(e) => handleDrop(e, stageName)}
                  >
                    <div className="crm-kanban-column-header">
                      <span className="crm-kanban-column-title">
                        <span className="crm-badge-dot" style={{ background: stageName === 'Booked' ? '#10b981' : (stageName === 'Lost' ? '#ef4444' : 'var(--accent)') }} />
                        {stageName}
                      </span>
                      <span className="crm-kanban-column-count">{stageLeads.length}</span>
                    </div>

                    <div className="crm-kanban-cards-list">
                      {stageLeads.map((lead) => {
                        const isBeingDragged = draggedLead?._id === lead._id;
                        return (
                          <div
                            key={lead._id}
                            className={`crm-kanban-card ${isBeingDragged ? 'dragging' : ''}`}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, lead)}
                            onDragEnd={handleDragEnd}
                            onClick={() => openCustomer360(lead.customerId)}
                          >
                            <div className="crm-kanban-card-top">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <GripVertical size={13} style={{ color: 'var(--text-label)', cursor: 'grab' }} />
                                <span className="crm-kanban-card-name">{lead.customerName}</span>
                              </div>
                              <span className="crm-badge" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                                {lead.priority || 'Medium'}
                              </span>
                            </div>
                            <div className="crm-kanban-card-project">
                              🏢 {lead.projectName} {lead.unitCode ? `— Unit ${lead.unitCode}` : ''}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                              📞 {lead.customerPhone}
                            </div>
                            {lead.notes && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-label)', fontStyle: 'italic', marginBottom: '0.4rem' }}>
                                "{lead.notes.substring(0, 50)}{lead.notes.length > 50 ? '...' : ''}"
                              </div>
                            )}

                            <div className="crm-kanban-card-meta">
                              <span>Budget:</span>
                              <span className="crm-kanban-card-budget">₹{(lead.budget || 0).toLocaleString()}</span>
                            </div>

                            {/* Quick stage mover */}
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                              {stageName !== 'Booked' && (
                                <button
                                  className="crm-btn-secondary"
                                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextStages = ['New', 'Contacted', 'Qualified', 'Visit Scheduled', 'Visited', 'Negotiation', 'Booked'];
                                    const currentIdx = nextStages.indexOf(stageName);
                                    const next = nextStages[currentIdx + 1] || 'Booked';
                                    handleAdvanceStage(lead._id, next);
                                  }}
                                >
                                  Advance ➔
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {stageLeads.length === 0 && (
                        <div style={{ padding: '1.25rem 0.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-label)', border: isDragTarget ? '1px dashed var(--accent)' : 'none', borderRadius: '6px' }}>
                          {isDragTarget ? 'Drop here to move lead' : `No leads in ${stageName}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="crm-table-container">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Project</th>
                    <th>Unit Code</th>
                    <th>Stage</th>
                    <th>Priority</th>
                    <th>Budget</th>
                    <th>Salesperson</th>
                    <th>Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead._id} className="crm-table-row-clickable" onClick={() => openCustomer360(lead.customerId)}>
                      <td>
                        <strong>{lead.customerName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{lead.customerPhone}</div>
                      </td>
                      <td>{lead.projectName}</td>
                      <td><strong>{lead.unitCode || 'General Project Enquiry'}</strong></td>
                      <td>
                        <span className={`crm-badge crm-badge-stage-${(lead.stage || 'new').toLowerCase().replace(/\s+/g, '')}`}>
                          {lead.stage}
                        </span>
                      </td>
                      <td>{lead.priority}</td>
                      <td>₹{(lead.budget || 0).toLocaleString()}</td>
                      <td>{lead.assignedSalespersonName || 'Unassigned'}</td>
                      <td>
                        <button className="crm-btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); openCustomer360(lead.customerId); }}>
                          Open 360
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: PROJECTS & UNIT INVENTORY (PROFITBASE CHESSBOARD MATRIX) ──── */}
      {activeTab === 'inventory' && (() => {
        // Filtered units based on chessboard filters
        const filteredUnits = units.filter(u => {
          if (selectedProjectId && u.projectId && String(u.projectId) !== String(selectedProjectId)) return false;
          if (chessboardFilters.tower !== 'all') {
            const t = (u.buildingTower || u.sectionName || '').toLowerCase();
            if (!t.includes(chessboardFilters.tower.toLowerCase())) return false;
          }
          const price = u.askingPrice || u.basePrice || 0;
          if (chessboardFilters.priceMin && price < Number(chessboardFilters.priceMin)) return false;
          if (chessboardFilters.priceMax && price > Number(chessboardFilters.priceMax)) return false;

          const area = u.carpetAreaSqFt || 0;
          if (chessboardFilters.areaMin && area < Number(chessboardFilters.areaMin)) return false;
          if (chessboardFilters.areaMax && area > Number(chessboardFilters.areaMax)) return false;

          const floor = u.floorNumber || 0;
          if (chessboardFilters.floorMin && floor < Number(chessboardFilters.floorMin)) return false;
          if (chessboardFilters.floorMax && floor > Number(chessboardFilters.floorMax)) return false;

          if (chessboardFilters.rooms !== 'all') {
            const cfg = (u.configuration || '').toUpperCase();
            if (chessboardFilters.rooms === '4+') {
              if (!cfg.includes('4') && !cfg.includes('5') && !cfg.includes('PENTHOUSE')) return false;
            } else {
              if (!cfg.includes(`${chessboardFilters.rooms}BHK`) && !cfg.includes(`${chessboardFilters.rooms} BHK`)) return false;
            }
          }

          if (chessboardFilters.status !== 'all') {
            const st = (u.effectiveStatus || u.availabilityStatus || 'available').toLowerCase();
            if (st !== chessboardFilters.status.toLowerCase()) return false;
          }
          return true;
        });

        // Determine sections / towers present
        const rawSections = Array.from(new Set(units.map(u => u.sectionName || u.buildingTower || 'Tower A'))).sort();
        const displaySections = rawSections.length > 0 ? rawSections : ['Section 1 (Tower A)', 'Section 2 (Tower B)'];

        // Distinct floors descending from max down to min (e.g. 14 down to 1)
        const maxF = Math.max(...units.map(u => u.floorNumber || 1), 14);
        const minF = Math.min(...units.map(u => u.floorNumber || 1), 1);
        const floorsList = [];
        for (let f = maxF; f >= minF; f--) {
          floorsList.push(f);
        }

        const unitPositions = [1, 2, 3, 4];
        const activeInspected = inspectedUnit || (units.length > 0 ? units[0] : null);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Top Filter & View Control Toolbar (Screenshots 1 & 2) */}
            <div className="crm-chessboard-toolbar">
              <div className="crm-chessboard-filters-row">
                {/* Project Selector */}
                <div className="crm-filter-group-mini">
                  <label>PROJECT</label>
                  <select
                    className="crm-select-filter"
                    style={{ minWidth: '150px', padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">All Projects</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Section / Tower Selector */}
                <div className="crm-filter-group-mini">
                  <label>TOWER / SECTION</label>
                  <select
                    className="crm-select-filter"
                    style={{ minWidth: '130px', padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                    value={chessboardFilters.tower}
                    onChange={(e) => setChessboardFilters({ ...chessboardFilters, tower: e.target.value })}
                  >
                    <option value="all">All Towers</option>
                    <option value="Tower A">Tower A / Section 1</option>
                    <option value="Tower B">Tower B / Section 2</option>
                  </select>
                </div>

                {/* Price Range */}
                <div className="crm-filter-group-mini">
                  <label>PRICE (₹)</label>
                  <div className="crm-filter-range-inputs">
                    <input
                      type="number"
                      placeholder="From"
                      value={chessboardFilters.priceMin}
                      onChange={(e) => setChessboardFilters({ ...chessboardFilters, priceMin: e.target.value })}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-label)' }}>-</span>
                    <input
                      type="number"
                      placeholder="To"
                      value={chessboardFilters.priceMax}
                      onChange={(e) => setChessboardFilters({ ...chessboardFilters, priceMax: e.target.value })}
                    />
                  </div>
                </div>

                {/* Area Range */}
                <div className="crm-filter-group-mini">
                  <label>AREA (SQ.FT)</label>
                  <div className="crm-filter-range-inputs">
                    <input
                      type="number"
                      placeholder="From"
                      value={chessboardFilters.areaMin}
                      onChange={(e) => setChessboardFilters({ ...chessboardFilters, areaMin: e.target.value })}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-label)' }}>-</span>
                    <input
                      type="number"
                      placeholder="To"
                      value={chessboardFilters.areaMax}
                      onChange={(e) => setChessboardFilters({ ...chessboardFilters, areaMax: e.target.value })}
                    />
                  </div>
                </div>

                {/* Floors Range */}
                <div className="crm-filter-group-mini">
                  <label>FLOORS</label>
                  <div className="crm-filter-range-inputs">
                    <input
                      type="number"
                      placeholder="1"
                      style={{ width: '55px' }}
                      value={chessboardFilters.floorMin}
                      onChange={(e) => setChessboardFilters({ ...chessboardFilters, floorMin: e.target.value })}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-label)' }}>-</span>
                    <input
                      type="number"
                      placeholder="14"
                      style={{ width: '55px' }}
                      value={chessboardFilters.floorMax}
                      onChange={(e) => setChessboardFilters({ ...chessboardFilters, floorMax: e.target.value })}
                    />
                  </div>
                </div>

                {/* Rooms Selector */}
                <div className="crm-filter-group-mini">
                  <label>ROOMS</label>
                  <div className="crm-rooms-pill-group">
                    {['all', '1', '2', '3', '4+'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`crm-rooms-pill ${chessboardFilters.rooms === r ? 'active' : ''}`}
                        onClick={() => setChessboardFilters({ ...chessboardFilters, rooms: r })}
                      >
                        {r === 'all' ? 'All' : r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Selector */}
                <div className="crm-filter-group-mini">
                  <label>STATUS</label>
                  <select
                    className="crm-select-filter"
                    style={{ minWidth: '115px', padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                    value={chessboardFilters.status}
                    onChange={(e) => setChessboardFilters({ ...chessboardFilters, status: e.target.value })}
                  >
                    <option value="all">All Statuses</option>
                    <option value="available">Available (Green)</option>
                    <option value="held">Held 48h (Amber)</option>
                    <option value="reserved">Reserved (Blue)</option>
                    <option value="booked">Booked (Purple)</option>
                    <option value="sold">Sold (Grey)</option>
                  </select>
                </div>

                {/* View Switcher & Excel Export */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-label)', fontWeight: 600 }}>
                    Found: <strong style={{ color: 'var(--text-primary)' }}>{filteredUnits.length}</strong>
                  </span>

                  <button
                    className={`crm-btn-secondary ${unitViewMode === 'chessboard' ? 'active' : ''}`}
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    onClick={() => setUnitViewMode('chessboard')}
                    title="Chessboard Building View"
                  >
                    <LayoutGrid size={14} /> Matrix
                  </button>
                  <button
                    className={`crm-btn-secondary ${unitViewMode === 'grid' ? 'active' : ''}`}
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    onClick={() => setUnitViewMode('grid')}
                    title="Cards Grid View"
                  >
                    Grid
                  </button>

                  <button
                    className="crm-btn-primary"
                    style={{ background: '#10b981', borderColor: '#10b981', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                    onClick={() => handleExportUnitsToExcel(filteredUnits)}
                    title="Download Excel / CSV of filtered inventory"
                  >
                    <FileSpreadsheet size={14} /> Export to Excel
                  </button>
                </div>
              </div>

              {/* Status Legend Bar (Profitbase Colors) */}
              <div className="crm-chessboard-legend-bar">
                <div className="crm-legend-items">
                  <div className="crm-legend-pill">
                    <span className="crm-legend-box-sample" style={{ background: '#10b981' }} />
                    <span>Available ({units.filter(u => (u.effectiveStatus || u.availabilityStatus) === 'Available').length})</span>
                  </div>
                  <div className="crm-legend-pill">
                    <span className="crm-legend-box-sample" style={{ background: '#f59e0b' }} />
                    <span>Held 48h ({units.filter(u => (u.effectiveStatus || u.availabilityStatus) === 'Held').length})</span>
                  </div>
                  <div className="crm-legend-pill">
                    <span className="crm-legend-box-sample" style={{ background: '#3b82f6' }} />
                    <span>Reserved ({units.filter(u => (u.effectiveStatus || u.availabilityStatus) === 'Reserved').length})</span>
                  </div>
                  <div className="crm-legend-pill">
                    <span className="crm-legend-box-sample" style={{ background: '#8b5cf6' }} />
                    <span>Booked ({units.filter(u => (u.effectiveStatus || u.availabilityStatus) === 'Booked').length})</span>
                  </div>
                  <div className="crm-legend-pill">
                    <span className="crm-legend-box-sample" style={{ background: '#64748b' }} />
                    <span>Sold / Closed ({units.filter(u => (u.effectiveStatus || u.availabilityStatus) === 'Sold').length})</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-label)' }}>
                  Click any cell to inspect 2D Floor Plan & Darshan's Unit Pipeline
                </div>
              </div>
            </div>

            {/* Split View: Left Chessboard Matrix + Right Unit Inspector (Profitbase Style) */}
            {unitViewMode === 'chessboard' ? (
              <div className="crm-chessboard-split-layout">
                {/* ── Left Column: Chessboard Canvas ─────────────────────────── */}
                <div className="crm-chessboard-grid-card">
                  <table className="crm-chessboard-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px' }} />
                        {displaySections.map((secName, sIdx) => (
                          <th key={sIdx} colSpan={unitPositions.length} className="crm-chessboard-section-th">
                            🏢 {secName}
                          </th>
                        ))}
                        <th style={{ width: '35px' }} />
                      </tr>
                      <tr>
                        <th style={{ width: '35px' }} />
                        {displaySections.map((secName, sIdx) =>
                          unitPositions.map((pos) => (
                            <th key={`${sIdx}-${pos}`} className="crm-chessboard-col-th">
                              {pos}
                            </th>
                          ))
                        )}
                        <th style={{ width: '35px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {floorsList.map((floor) => (
                        <tr key={floor}>
                          {/* Floor indicator left */}
                          <td className="crm-chessboard-floor-td">{floor}</td>

                          {/* Section columns */}
                          {displaySections.map((secName, sIdx) =>
                            unitPositions.map((pos) => {
                              // Find matching unit
                              const u = filteredUnits.find(
                                unit => unit.floorNumber === floor &&
                                (unit.sectionName === secName || unit.buildingTower === secName || (sIdx === 0 && unit.buildingTower === 'Tower A') || (sIdx === 1 && unit.buildingTower === 'Tower B')) &&
                                (unit.unitNumber === pos || unit.unitCode?.endsWith(`0${pos}`) || unit.unitCode?.endsWith(`${pos}`))
                              );

                              if (!u) {
                                return (
                                  <td key={`${sIdx}-${pos}`} style={{ padding: '2px' }}>
                                    <div
                                      style={{
                                        width: '34px',
                                        height: '32px',
                                        borderRadius: '4px',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px dashed rgba(255,255,255,0.06)'
                                      }}
                                    />
                                  </td>
                                );
                              }

                              const st = (u.effectiveStatus || u.availabilityStatus || 'available').toLowerCase();
                              const isSelected = activeInspected && activeInspected._id === u._id;
                              const roomDigit = u.configuration?.includes('1') ? '1' : (u.configuration?.includes('2') ? '2' : (u.configuration?.includes('4') ? '4' : '3'));

                              return (
                                <td key={`${sIdx}-${pos}`} style={{ padding: '2px' }}>
                                  <div
                                    className={`crm-chessboard-cell crm-cell-${st} ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleSelectChessboardUnit(u)}
                                    title={`Unit ${u.unitCode}: ${u.configuration} (${u.carpetAreaSqFt} sq.ft) - ₹${(u.askingPrice || u.basePrice || 0).toLocaleString()} [${u.effectiveStatus || u.availabilityStatus}]`}
                                  >
                                    {roomDigit}
                                  </div>
                                </td>
                              );
                            })
                          )}

                          {/* Floor indicator right */}
                          <td className="crm-chessboard-floor-td" style={{ textAlign: 'left', paddingLeft: '0.6rem' }}>{floor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Right Column: Interactive Unit Inspection Panel (Screenshots 1 & 2) ── */}
                <div className="crm-unit-inspect-panel">
                  {activeInspected ? (
                    <>
                      <div className="crm-inspect-header">
                        <div>
                          <div className="crm-inspect-unit-title">
                            Apartment № {activeInspected.unitCode}
                          </div>
                          <div className="crm-inspect-unit-specs-line">
                            {activeInspected.configuration} • {activeInspected.carpetAreaSqFt} sq.ft • Floor {activeInspected.floorNumber}
                          </div>
                        </div>
                        <span className={`crm-badge crm-badge-unit-${(activeInspected.effectiveStatus || activeInspected.availabilityStatus || 'available').toLowerCase()}`}>
                          {activeInspected.effectiveStatus || activeInspected.availabilityStatus}
                        </span>
                      </div>

                      {/* 2D Architectural CAD Blueprint Illustration */}
                      <div className="crm-floorplan-preview">
                        <FloorPlanBlueprint unit={activeInspected} />
                      </div>

                      {/* Price Box with Rate per Sq.Ft */}
                      <div className="crm-inspect-price-box">
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-label)', textTransform: 'uppercase' }}>ESTIMATED TOTAL VALUE</div>
                          <div className="crm-inspect-price-main">
                            ₹{(activeInspected.askingPrice || activeInspected.basePrice || 0).toLocaleString()}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="crm-inspect-price-rate">
                            ₹{Math.round((activeInspected.askingPrice || activeInspected.basePrice || 0) / (activeInspected.carpetAreaSqFt || 1080)).toLocaleString()} / sq.ft
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>All-inclusive base</div>
                        </div>
                      </div>

                      {/* Specifications Grid */}
                      <div className="crm-inspect-specs-grid">
                        <div className="crm-inspect-specs-item">
                          <span>TOWER / SECTION</span>
                          <span>{activeInspected.buildingTower || activeInspected.sectionName || 'Tower A'}</span>
                        </div>
                        <div className="crm-inspect-specs-item">
                          <span>FLOOR NUMBER</span>
                          <span>{activeInspected.floorNumber}th Floor</span>
                        </div>
                        <div className="crm-inspect-specs-item">
                          <span>CARPET AREA</span>
                          <span>{activeInspected.carpetAreaSqFt} sq.ft</span>
                        </div>
                        <div className="crm-inspect-specs-item">
                          <span>ORIENTATION</span>
                          <span>{activeInspected.facing || 'East Garden View'}</span>
                        </div>
                      </div>

                      {/* ── DARSHAN'S HANDWRITTEN FLOWCHART BRANCHING LOGIC ────────── */}
                      {inspectedUnitProfile?.bookingDone && inspectedUnitProfile?.bookingInfo ? (
                        /* BRANCH A: IF BOOKED */
                        <div style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', padding: '0.85rem' }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <CheckCircle size={14} /> Confirmed Allotment & Financial Ledger
                          </div>

                          <div style={{ fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                            Buyer:{' '}
                            <strong
                              style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => openCustomer360(inspectedUnitProfile.bookingInfo.customer?._id)}
                            >
                              {inspectedUnitProfile.bookingInfo.customer?.fullName}
                            </strong>{' '}
                            (Ref: {inspectedUnitProfile.bookingInfo.booking?.bookingReference})
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.75rem', marginBottom: '0.6rem' }}>
                            <div>Paid: <strong style={{ color: '#34d399' }}>₹{(inspectedUnitProfile.bookingInfo.financials?.totalReceived || 0).toLocaleString()}</strong></div>
                            <div>Pending: <strong style={{ color: '#fbbf24' }}>₹{(inspectedUnitProfile.bookingInfo.financials?.totalOutstanding || 0).toLocaleString()}</strong></div>
                          </div>

                          <button
                            className="crm-btn-primary"
                            style={{ width: '100%', fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                            onClick={() => {
                              setSelectedBookingDetail(inspectedUnitProfile.bookingInfo.booking);
                              setActiveTab('bookings');
                            }}
                          >
                            Open Master Booking Ledger
                          </button>
                        </div>
                      ) : (
                        /* BRANCH B: IF NOT BOOKED -> ACTIVE ENQUIRIES & LEAD PIPELINE */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            🎯 Active Enquiries Pipeline for Unit {activeInspected.unitCode}
                          </div>

                          {inspectedUnitProfile?.leadManagement && inspectedUnitProfile.leadManagement.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '140px', overflowY: 'auto' }}>
                              {inspectedUnitProfile.leadManagement.map((lead) => (
                                <div
                                  key={lead._id}
                                  style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid var(--card-border)',
                                    borderRadius: '6px',
                                    padding: '0.5rem 0.65rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => openCustomer360(lead.customerId)}
                                >
                                  <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{lead.customerName}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                      Stage: <span className="crm-badge" style={{ fontSize: '0.65rem' }}>{lead.stage}</span>
                                    </div>
                                  </div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    ₹{(lead.budget || 0).toLocaleString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-label)', background: 'rgba(255,255,255,0.01)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                              No active enquiries currently linked. Ready for new booking.
                            </div>
                          )}

                          {/* Action Buttons Row */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button
                              className="crm-btn-primary"
                              style={{ fontSize: '0.76rem', padding: '0.4rem 0.5rem', justifyContent: 'center' }}
                              onClick={() => {
                                setBookingFormData({
                                  ...bookingFormData,
                                  projectId: activeInspected.projectId,
                                  unitId: activeInspected._id,
                                  agreementPrice: activeInspected.askingPrice || activeInspected.basePrice
                                });
                                setShowNewBookingModal(true);
                              }}
                            >
                              <CheckCircle size={14} /> Book Unit
                            </button>

                            <button
                              className="crm-btn-secondary"
                              style={{ fontSize: '0.76rem', padding: '0.4rem 0.5rem', justifyContent: 'center' }}
                              onClick={async () => {
                                try {
                                  await crmApi.reserveUnit(activeInspected._id, { customerName: 'Priority Reserved', durationHours: 48 });
                                  alert(`Unit ${activeInspected.unitCode} reserved for 48 hours.`);
                                  loadInventory();
                                } catch (err) {
                                  alert('Reservation failed: ' + err.message);
                                }
                              }}
                            >
                              <Clock size={14} /> Hold 48h
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <button
                              className="crm-btn-secondary"
                              style={{ fontSize: '0.74rem', padding: '0.35rem 0.5rem', justifyContent: 'center' }}
                              onClick={() => {
                                setLeadFormData({
                                  ...leadFormData,
                                  projectId: activeInspected.projectId,
                                  unitId: activeInspected._id
                                });
                                setShowAddLeadModal(true);
                              }}
                            >
                              <Plus size={13} /> Log Enquiry
                            </button>

                            <button
                              className="crm-btn-secondary"
                              style={{ fontSize: '0.74rem', padding: '0.35rem 0.5rem', justifyContent: 'center' }}
                              onClick={() => {
                                setVisitFormData({
                                  ...visitFormData,
                                  projectId: activeInspected.projectId,
                                  unitId: activeInspected._id
                                });
                                setShowScheduleVisitModal(true);
                              }}
                            >
                              <Calendar size={13} /> Schedule Visit
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-label)' }}>
                      Select a unit from the matrix to inspect specifications and lead pipeline.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Alternate View: Card Grid */
              <div className="crm-card">
                <div className="crm-inventory-grid">
                  {filteredUnits.map(u => (
                    <div
                      key={u._id}
                      className={`crm-unit-cell ${(u.effectiveStatus || u.availabilityStatus || 'available').toLowerCase()}`}
                      onClick={() => handleSelectChessboardUnit(u)}
                    >
                      <div className="crm-unit-code">{u.unitCode}</div>
                      <div className="crm-unit-config">{u.buildingTower} • {u.configuration}</div>
                      <div className="crm-unit-price">₹{(u.askingPrice || u.basePrice || 0).toLocaleString()}</div>
                      <div style={{ marginTop: '0.4rem' }}>
                        <span className={`crm-badge crm-badge-unit-${(u.effectiveStatus || u.availabilityStatus || 'available').toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                          {u.effectiveStatus || u.availabilityStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── TAB 5: SITE VISITS & FOLLOW-UP TASKS ───────────────────────────── */}
      {activeTab === 'visits-tasks' && (
        <div className="crm-section-grid">
          {/* Follow-up Tasks */}
          <div className="crm-card">
            <div className="crm-card-header">
              <span className="crm-card-title"><CheckSquare size={18} /> Sales Follow-Up Tasks</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className={`crm-btn-secondary ${taskFilter === 'all' ? 'active' : ''}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => setTaskFilter('all')}>
                  All ({tasks.length})
                </button>
                <button className={`crm-btn-secondary ${taskFilter === 'today' ? 'active' : ''}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => setTaskFilter('today')}>
                  Today ({tasks.filter(t => t.isDueToday).length})
                </button>
                <button className={`crm-btn-secondary ${taskFilter === 'overdue' ? 'active' : ''}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#ef4444' }} onClick={() => setTaskFilter('overdue')}>
                  Overdue ({tasks.filter(t => t.isOverdue).length})
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {tasks
                .filter(t => {
                  if (taskFilter === 'today') return t.isDueToday;
                  if (taskFilter === 'overdue') return t.isOverdue;
                  return true;
                })
                .map(t => (
                  <div key={t._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={t.status === 'Completed'}
                        onChange={() => t.status !== 'Completed' && handleCompleteTask(t._id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', textDecoration: t.status === 'Completed' ? 'line-through' : 'none', color: t.isOverdue ? '#f87171' : 'var(--text-primary)' }}>
                          {t.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          👤 {t.customerName} • {t.taskType} • Assigned: {t.assignedToName}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="crm-badge" style={{ fontSize: '0.72rem', background: t.isOverdue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.08)', color: t.isOverdue ? '#ef4444' : 'var(--text-secondary)' }}>
                        {new Date(t.dueDateTime).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              {tasks.length === 0 && (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-label)' }}>No tasks found</div>
              )}
            </div>
          </div>

          {/* Site Visits Calendar / List */}
          <div className="crm-card">
            <div className="crm-card-header">
              <span className="crm-card-title"><Calendar size={18} /> Property Site Visits</span>
              <button className="crm-btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }} onClick={() => setShowScheduleVisitModal(true)}>
                + Schedule
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {siteVisits.map(v => (
                <div key={v._id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v.customerName}</div>
                    <span className={`crm-badge crm-badge-stage-${v.status === 'Completed' ? 'booked' : 'visitscheduled'}`}>
                      {v.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 500, marginBottom: '0.2rem' }}>
                    🏢 {v.projectName} {v.unitCode ? `— Unit ${v.unitCode}` : ''}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    📅 {new Date(v.visitDateTime).toLocaleString()} • Rep: {v.assignedSalespersonName}
                  </div>
                  {v.outcome && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-label)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                      Outcome: "{v.outcome}"
                    </div>
                  )}
                </div>
              ))}
              {siteVisits.length === 0 && (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-label)' }}>No site visits recorded</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: BOOKINGS MANAGEMENT ─────────────────────────────────────── */}
      {activeTab === 'bookings' && (
        <div className="crm-card">
          <div className="crm-card-header">
            <span className="crm-card-title"><FileText size={18} /> Master Property Bookings</span>
            <button className="crm-btn-primary" onClick={() => setShowNewBookingModal(true)}>
              <Plus size={16} /> New Unit Booking
            </button>
          </div>

          <div className="crm-table-container">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Booking Reference</th>
                  <th>Customer Name</th>
                  <th>Project & Unit</th>
                  <th>Agreement Price</th>
                  <th>Net Value</th>
                  <th>Booking Date</th>
                  <th>Status</th>
                  <th>Financials</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b._id} className="crm-table-row-clickable" onClick={() => setSelectedBookingDetail(b)}>
                    <td><strong style={{ color: 'var(--accent)' }}>{b.bookingReference}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.customerName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{b.customerPhone}</div>
                    </td>
                    <td>
                      <div>{b.projectName}</div>
                      <strong>Unit {b.unitCode}</strong>
                    </td>
                    <td>₹{Number(b.agreementPrice).toLocaleString()}</td>
                    <td><strong>₹{Number(b.netBookingValue || b.agreementPrice).toLocaleString()}</strong></td>
                    <td>{new Date(b.bookingDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`crm-badge crm-badge-stage-${b.status === 'Confirmed' ? 'booked' : (b.status === 'Cancelled' ? 'lost' : 'qualified')}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.75rem' }}>
                        Rec: <strong style={{ color: '#34d399' }}>₹{(b.financials?.totalReceived || 0).toLocaleString()}</strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>
                        Bal: ₹{(b.financials?.totalOutstanding || 0).toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <button className="crm-btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); setSelectedBookingDetail(b); }}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-label)' }}>
                      No active bookings. Click "+ New Unit Booking" or "Load Demo Data".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 7: PAYMENTS & COLLECTIONS ──────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="crm-card">
          <div className="crm-card-header">
            <span className="crm-card-title"><CreditCard size={18} /> Verified Payment Transactions & Receipts</span>
            <button className="crm-btn-primary" onClick={() => setShowRecordPaymentModal(true)}>
              <Plus size={16} /> Record Payment
            </button>
          </div>

          <div className="crm-table-container">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Txn Reference</th>
                  <th>Customer</th>
                  <th>Booking Ref</th>
                  <th>Amount</th>
                  <th>Payment Mode</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Print Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p._id}>
                    <td><strong style={{ color: '#10b981' }}>{p.receiptNumber}</strong></td>
                    <td>{p.transactionReference}</td>
                    <td><strong>{p.customerName}</strong></td>
                    <td>{p.bookingReference}</td>
                    <td><strong style={{ fontVariantNumeric: 'tabular-nums' }}>₹{Number(p.amount).toLocaleString()}</strong></td>
                    <td>{p.paymentMethod}</td>
                    <td>{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`crm-badge crm-badge-pay-${p.paymentStatus.toLowerCase().replace(/\s+/g, '')}`}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <button className="crm-btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openPrintableReceipt(p._id)}>
                        <Printer size={13} /> Print
                      </button>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-label)' }}>
                      No payments recorded. Click "+ Record Payment" to issue a receipt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 8: REPORTS & ANALYTICS ─────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div>
          <div className="crm-section-grid">
            {/* Sales Leaderboard */}
            <div className="crm-card">
              <div className="crm-card-header">
                <span className="crm-card-title"><UserCheck size={18} /> Salesperson Performance Leaderboard</span>
              </div>
              <div className="crm-table-container">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Sales Executive</th>
                      <th>Leads Assigned</th>
                      <th>Visits Completed</th>
                      <th>Units Closed</th>
                      <th>Total Value</th>
                      <th>Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salespersonStats.map((rep, idx) => (
                      <tr key={idx}>
                        <td><strong>{rep.name}</strong></td>
                        <td>{rep.leadsAssigned}</td>
                        <td>{rep.visitsConducted}</td>
                        <td><strong style={{ color: '#34d399' }}>{rep.bookingsClosed}</strong></td>
                        <td>₹{(rep.totalBookingValue || 0).toLocaleString()}</td>
                        <td><span className="crm-badge crm-badge-stage-booked">{rep.conversionRatePercent}%</span></td>
                      </tr>
                    ))}
                    {salespersonStats.length === 0 && (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-label)' }}>No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lead Sources Performance */}
            <div className="crm-card">
              <div className="crm-card-header">
                <span className="crm-card-title"><BarChart3 size={18} /> Inbound Lead Sources</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(dashboardData?.leadSources || {}).map(([src, count]) => (
                  <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--card-border)' }}>
                    <span>{src}</span>
                    <strong>{count} customers</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 9: CRM SETTINGS ─────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="crm-card">
          <div className="crm-card-header">
            <span className="crm-card-title"><SettingsIcon size={18} /> Real Estate CRM Workspace Settings</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Configured Pipeline Stages</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {(crmSettings?.pipelineStages || []).map((s, idx) => (
                  <span key={idx} className="crm-badge crm-badge-stage-qualified">{s.label || s.key}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Configured Lead Sources</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {(crmSettings?.leadSources || []).map((src, idx) => (
                  <span key={idx} className="crm-badge" style={{ background: 'rgba(255,255,255,0.06)' }}>{src}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Standard Payment Milestones</h4>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {(crmSettings?.milestoneTemplates || []).map((m, idx) => (
                  <li key={idx} style={{ marginBottom: '0.25rem' }}>{m.name} ({m.percentage}%)</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: CUSTOMER 360 PROFILE (ALL 9 TABS)
         ══════════════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: LEAF360 / FOLLOW UP BOSS 3-COLUMN ENTERPRISE CLIENT PROFILE (SCREENSHOT 4)
         ══════════════════════════════════════════════════════════════════════════ */}
      {selectedCustomer360 && (
        <div className="crm-modal-overlay" onClick={() => setSelectedCustomer360(null)}>
          <div className="crm-modal-container fullscreen" onClick={(e) => e.stopPropagation()}>
            {/* Enterprise Header Bar matching Screenshot 4 */}
            <div className="crm-modal-header" style={{ padding: '0.65rem 1.25rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  👤 People / Clients &gt;
                </span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {selectedCustomer360.customer?.fullName}
                </strong>
                <span className="crm-badge" style={{ background: 'rgba(255,255,255,0.08)', fontSize: '0.72rem' }}>
                  {selectedCustomer360.customer?.customerCode}
                </span>
              </div>

              {/* Navigation Pager "< Person X of Y >" */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <button
                    className="crm-btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => handleBrowseCustomer(-1)}
                    title="Previous Customer"
                  >
                    &lt;
                  </button>
                  <span>
                    Person {(customers.findIndex(c => c._id === selectedCustomer360.customer?._id) + 1) || 1} of {customers.length || 1}
                  </span>
                  <button
                    className="crm-btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => handleBrowseCustomer(1)}
                    title="Next Customer"
                  >
                    &gt;
                  </button>
                </div>
                <button className="crm-modal-close-btn" onClick={() => setSelectedCustomer360(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="crm-modal-body" style={{ padding: '1rem 1.25rem', overflowY: 'auto' }}>
              <div className="crm-client-3col-wrapper">
                {/* ─────────────────────────────────────────────────────────────
                   COLUMN 1: IDENTITY, CONTACT & CUSTOM FIELDS (LEFT)
                   ───────────────────────────────────────────────────────────── */}
                <div className="crm-col-identity">
                  {/* Avatar & Full Name Banner */}
                  <div className="crm-client-avatar-row">
                    <div className="crm-client-avatar-circle">
                      {selectedCustomer360.customer?.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CU'}
                    </div>
                    <div>
                      <div className="crm-client-name-title">
                        {selectedCustomer360.customer?.fullName}
                      </div>
                      <div className="crm-client-comm-tag">
                        Last Active: {selectedCustomer360.activities?.[0] ? new Date(selectedCustomer360.activities[0].createdAt).toLocaleDateString() : 'Active Now'}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Communication Chips */}
                  <div className="crm-client-contact-list">
                    <div className="crm-client-contact-item">
                      <span>📞</span>
                      <a href={`tel:${selectedCustomer360.customer?.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        {selectedCustomer360.customer?.phone}
                      </a>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-label)', marginLeft: 'auto' }}>(mobile)</span>
                    </div>
                    <div className="crm-client-contact-item">
                      <span>✉️</span>
                      <a href={`mailto:${selectedCustomer360.customer?.email}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                        {selectedCustomer360.customer?.email || 'No email registered'}
                      </a>
                    </div>
                    <div className="crm-client-contact-item" style={{ color: 'var(--text-secondary)' }}>
                      <span>🏠</span>
                      <span>{selectedCustomer360.customer?.address || 'Mumbai, Maharashtra, India'}</span>
                    </div>
                  </div>

                  {/* Section: Relationships */}
                  <div>
                    <div className="crm-client-section-heading">
                      <span>Relationships</span>
                      <button className="crm-btn-secondary" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', borderRadius: '50%' }}>+</button>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-label)', marginTop: '0.35rem' }}>
                      No relationships linked yet
                    </div>
                  </div>

                  {/* Section: Custom Fields */}
                  <div>
                    <div className="crm-client-section-heading">
                      <span>Custom Fields</span>
                      <span style={{ fontSize: '0.75rem' }}>▾</span>
                    </div>
                    <div className="crm-client-details-grid" style={{ marginTop: '0.45rem' }}>
                      <div className="crm-client-detail-row">
                        <span>PAN Card</span>
                        <span>{selectedCustomer360.customer?.panNumber || 'ABCDE1234F'}</span>
                      </div>
                      <div className="crm-client-detail-row">
                        <span>Aadhaar</span>
                        <span>{selectedCustomer360.customer?.aadhaarNumber || '•••• •••• 9821'}</span>
                      </div>
                      <div className="crm-client-detail-row">
                        <span>Customer Code</span>
                        <span>{selectedCustomer360.customer?.customerCode}</span>
                      </div>
                      <div className="crm-client-detail-row">
                        <span>Occupation</span>
                        <span>Corporate Business / IT Director</span>
                      </div>
                    </div>
                  </div>

                  {/* Section: Details */}
                  <div>
                    <div className="crm-client-section-heading">
                      <span>Pipeline Details</span>
                      <span style={{ fontSize: '0.75rem' }}>▾</span>
                    </div>
                    <div className="crm-client-details-grid" style={{ marginTop: '0.45rem' }}>
                      <div className="crm-client-detail-row">
                        <span>Lead Stage</span>
                        <span className={`crm-badge crm-badge-stage-${(selectedCustomer360.interests?.[0]?.stage || 'new').toLowerCase().replace(/\s+/g, '')}`}>
                          {selectedCustomer360.interests?.[0]?.stage || 'Hot Prospect'}
                        </span>
                      </div>
                      <div className="crm-client-detail-row">
                        <span>Lead Source</span>
                        <span>{selectedCustomer360.customer?.leadSource || 'Direct Walk-in'}</span>
                      </div>
                      <div className="crm-client-detail-row">
                        <span>Assigned Rep</span>
                        <span>{selectedCustomer360.customer?.assignedSalespersonName || 'Ketan Dasalaniya'}</span>
                      </div>
                      <div className="crm-client-detail-row">
                        <span>Max Budget</span>
                        <span style={{ color: '#34d399' }}>₹{(selectedCustomer360.interests?.[0]?.budget || 12500000).toLocaleString()}</span>
                      </div>
                      <div className="crm-client-detail-row">
                        <span>Tags</span>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          <span className="crm-badge" style={{ fontSize: '0.68rem', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399' }}>Investor</span>
                          <span className="crm-badge" style={{ fontSize: '0.68rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>High-Rise</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Background / Bio Notes */}
                  <div>
                    <div className="crm-client-section-heading">
                      <span>Background</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '0.35rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                      Looking for premium 2BHK/3BHK corner apartment with sunrise balcony and parking slot. Pre-approved for home loan up to ₹1.5 Cr with HDFC. Prefers handover within Q4 2026.
                    </div>
                  </div>
                </div>

                {/* ─────────────────────────────────────────────────────────────
                   COLUMN 2: LIVE COMPOSER & ACTIVITY STREAM (CENTER)
                   ───────────────────────────────────────────────────────────── */}
                <div className="crm-col-center">
                  {/* Screenshot 4 Composer Box */}
                  <form onSubmit={handleComposerSubmit} className="crm-composer-card">
                    <div className="crm-composer-nav">
                      <button
                        type="button"
                        className={`crm-composer-btn ${composerType === 'Note' ? 'active' : ''}`}
                        onClick={() => setComposerType('Note')}
                      >
                        📝 Create Note
                      </button>
                      <button
                        type="button"
                        className={`crm-composer-btn ${composerType === 'Email' ? 'active' : ''}`}
                        onClick={() => setComposerType('Email')}
                      >
                        ✉️ Send Email
                      </button>
                      <button
                        type="button"
                        className={`crm-composer-btn ${composerType === 'WhatsApp' ? 'active' : ''}`}
                        onClick={() => setComposerType('WhatsApp')}
                      >
                        💬 Text / WhatsApp
                      </button>
                      <button
                        type="button"
                        className={`crm-composer-btn ${composerType === 'Call' ? 'active' : ''}`}
                        onClick={() => setComposerType('Call')}
                      >
                        📞 Log Call
                      </button>
                    </div>

                    <textarea
                      rows={3}
                      className="crm-composer-textarea"
                      placeholder={
                        composerType === 'Note'
                          ? 'Add notes or type #name to notify team...'
                          : composerType === 'Email'
                          ? 'Compose client follow-up email or payment reminder...'
                          : composerType === 'Call'
                          ? 'Log phone call discussion, objections, and agreed next steps...'
                          : 'Send WhatsApp template or site visit booking confirmation...'
                      }
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                    />

                    <div className="crm-composer-footer">
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-label)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>@ Try Team Mentions</span>
                      </div>
                      <button
                        type="submit"
                        className="crm-btn-primary"
                        style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }}
                        disabled={composerSubmitting || !composerText.trim()}
                      >
                        {composerSubmitting ? 'Saving...' : `Create ${composerType}`}
                      </button>
                    </div>
                  </form>

                  {/* Feed Filter Pills Bar matching Screenshot 4 */}
                  <div className="crm-activity-filter-bar">
                    <button
                      className={`crm-activity-filter-pill ${activityFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setActivityFilter('all')}
                    >
                      All ({(selectedCustomer360.activities?.length || 0)})
                    </button>
                    <button
                      className={`crm-activity-filter-pill ${activityFilter === 'notes' ? 'active' : ''}`}
                      onClick={() => setActivityFilter('notes')}
                    >
                      📝 Notes ({selectedCustomer360.activities?.filter(a => a.activityType === 'Note').length || 0})
                    </button>
                    <button
                      className={`crm-activity-filter-pill ${activityFilter === 'emails' ? 'active' : ''}`}
                      onClick={() => setActivityFilter('emails')}
                    >
                      ✉️ Emails ({selectedCustomer360.activities?.filter(a => a.activityType === 'Email').length || 0})
                    </button>
                    <button
                      className={`crm-activity-filter-pill ${activityFilter === 'texts' ? 'active' : ''}`}
                      onClick={() => setActivityFilter('texts')}
                    >
                      💬 Texts ({selectedCustomer360.activities?.filter(a => a.activityType === 'WhatsApp' || a.activityType === 'SMS').length || 0})
                    </button>
                    <button
                      className={`crm-activity-filter-pill ${activityFilter === 'calls' ? 'active' : ''}`}
                      onClick={() => setActivityFilter('calls')}
                    >
                      📞 Calls ({selectedCustomer360.activities?.filter(a => a.activityType === 'Call').length || 0})
                    </button>
                  </div>

                  {/* Threaded Activity Stream matching Screenshot 4 */}
                  <div className="crm-feed-stream">
                    {(!selectedCustomer360.activities || selectedCustomer360.activities.length === 0) ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        No activities logged yet. Use the composer above to log the first note or call!
                      </div>
                    ) : (
                      selectedCustomer360.activities
                        .filter(act => {
                          if (activityFilter === 'all') return true;
                          if (activityFilter === 'notes') return act.activityType === 'Note';
                          if (activityFilter === 'emails') return act.activityType === 'Email';
                          if (activityFilter === 'texts') return act.activityType === 'WhatsApp' || act.activityType === 'SMS';
                          if (activityFilter === 'calls') return act.activityType === 'Call';
                          return true;
                        })
                        .map((act, idx) => (
                          <div key={idx} className="crm-feed-card">
                            <div className={`crm-feed-icon-circle ${act.activityType?.toLowerCase() || 'note'}`}>
                              {act.activityType === 'Call' ? '📞' : act.activityType === 'Email' ? '✉️' : act.activityType === 'WhatsApp' ? '💬' : '📌'}
                            </div>
                            <div className="crm-feed-content">
                              <div className="crm-feed-top">
                                <div>
                                  <span className="crm-feed-author">{act.performedByName || 'Sales Rep'}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-label)', marginLeft: '0.5rem' }}>
                                    {act.activityType} • {act.title}
                                  </span>
                                </div>
                                <span className="crm-feed-date">
                                  {new Date(act.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="crm-feed-body">
                                {act.description}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* ─────────────────────────────────────────────────────────────
                   COLUMN 3: LEAF360 MESSAGING, UNITS WIDGET & FINANCIALS (RIGHT)
                   ───────────────────────────────────────────────────────────── */}
                <div className="crm-col-widgets">
                  {/* Top Leaf360 Header Widget matching Screenshot 4 */}
                  <div className="crm-widget-card" style={{ borderTop: '3px solid var(--accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        🏢 Leaf360 - Agent &amp; Lender Sync
                      </strong>
                      <span className="crm-badge" style={{ fontSize: '0.65rem', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399' }}>Online</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.72rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.4rem', marginTop: '0.2rem' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Home</span>
                      <span>Status</span>
                      <span>Activity</span>
                      <span>Calculator</span>
                      <span>Services</span>
                    </div>

                    {/* Quick Send Message Box */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--card-border)', marginTop: '0.35rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-label)', marginBottom: '0.35rem' }}>
                        SEND MESSAGE
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(5, 150, 105, 0.08)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--accent)', marginBottom: '0.5rem' }}>
                        &ldquo;Good morning. Rahul visited Skyline Towers yesterday. He is keen on Unit B-0502 and requested the revised milestone payment schedule.&rdquo;
                      </div>
                      <button
                        className="crm-btn-primary"
                        style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setComposerType('WhatsApp');
                          setComposerText('Sent revised milestone payment schedule for Skyline Towers Unit B-0502 via WhatsApp.');
                        }}
                      >
                        Send Message / Sync
                      </button>
                    </div>
                  </div>

                  {/* Communication Metrics Widget matching Screenshot 4 */}
                  <div className="crm-widget-card">
                    <div className="crm-widget-header">
                      <div className="crm-widget-title">Activity History</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-label)', marginBottom: '0.35rem' }}>OUTBOUND COMMUNICATION</div>
                      <div className="crm-widget-counter-grid">
                        <div className="crm-counter-box">
                          <span>📞 Calls</span>
                          <span>{selectedCustomer360.activities?.filter(a => a.activityType === 'Call').length || 1}</span>
                        </div>
                        <div className="crm-counter-box">
                          <span>💬 SMS/WA</span>
                          <span>{selectedCustomer360.activities?.filter(a => a.activityType === 'WhatsApp').length || 1}</span>
                        </div>
                        <div className="crm-counter-box">
                          <span>✉️ Emails</span>
                          <span>{selectedCustomer360.activities?.filter(a => a.activityType === 'Email').length || 1}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.35rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-label)', marginBottom: '0.35rem' }}>INBOUND COMMUNICATION</div>
                      <div className="crm-widget-counter-grid">
                        <div className="crm-counter-box">
                          <span>📞 In-Call</span>
                          <span>0</span>
                        </div>
                        <div className="crm-counter-box">
                          <span>💬 Reply</span>
                          <span>1</span>
                        </div>
                        <div className="crm-counter-box">
                          <span>📍 Visits</span>
                          <span>{selectedCustomer360.siteVisits?.length || 1}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Real Estate Property Units & Pipeline Widget */}
                  <div className="crm-widget-card">
                    <div className="crm-widget-header">
                      <div className="crm-widget-title">
                        🏢 Property Interests ({selectedCustomer360.interests?.length || 0})
                      </div>
                      <button
                        className="crm-btn-secondary"
                        style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}
                        onClick={() => {
                          setLeadFormData({ ...leadFormData, customerId: selectedCustomer360.customer._id });
                          setShowAddLeadModal(true);
                        }}
                      >
                        + Link Unit
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(selectedCustomer360.interests || []).map((interest) => (
                        <div
                          key={interest._id}
                          style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '6px',
                            padding: '0.55rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>
                              {interest.unitCode || 'General Enquiry'}
                            </strong>
                            <span className={`crm-badge crm-badge-stage-${(interest.stage || 'new').toLowerCase().replace(/\s+/g, '')}`}>
                              {interest.stage}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {interest.projectName} • ₹{(interest.budget || 0).toLocaleString()}
                          </div>
                          {interest.stage !== 'Booked' && (
                            <button
                              className="crm-btn-secondary"
                              style={{ padding: '0.2rem', fontSize: '0.7rem', marginTop: '0.25rem', width: '100%' }}
                              onClick={() => {
                                const nextStages = ['New', 'Contacted', 'Qualified', 'Visit Scheduled', 'Visited', 'Negotiation', 'Booked'];
                                const currentIdx = nextStages.indexOf(interest.stage);
                                handleAdvanceStage(interest._id, nextStages[currentIdx + 1] || 'Booked');
                              }}
                            >
                              Advance Stage ➔
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financials & Bookings Card */}
                  <div className="crm-widget-card">
                    <div className="crm-widget-header">
                      <div className="crm-widget-title">
                        💳 Financials &amp; Bookings ({selectedCustomer360.bookings?.length || 0})
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-label)' }}>TOTAL RECEIVED</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#34d399' }}>
                          ₹{(selectedCustomer360.summary?.totalCollected || 0).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-label)' }}>OUTSTANDING</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b' }}>
                          ₹{(selectedCustomer360.summary?.totalOutstanding || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {selectedCustomer360.transactions && selectedCustomer360.transactions.length > 0 && (
                      <div style={{ marginTop: '0.35rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-label)', marginBottom: '0.3rem' }}>LATEST PAYMENTS</div>
                        {selectedCustomer360.transactions.slice(0, 3).map(t => (
                          <div key={t._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span>{t.receiptNumber}</span>
                            <span style={{ color: '#34d399', fontWeight: 600 }}>₹{Number(t.amount).toLocaleString()}</span>
                            <button
                              className="crm-btn-secondary"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem' }}
                              onClick={() => openPrintableReceipt(t._id)}
                            >
                              Receipt
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: UNIT-WISE PROFILE (DARSHAN'S ARCHITECTURAL SPECIFICATION)
         ══════════════════════════════════════════════════════════════════════════ */}
      {selectedUnitProfile && (
        <div className="crm-modal-overlay" onClick={() => setSelectedUnitProfile(null)}>
          <div className="crm-modal-container large" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Building2 size={24} color="var(--accent)" />
                <div>
                  <div className="crm-modal-title">
                    Unit-Wise Profile: Unit {selectedUnitProfile.unitCode}
                    <span className={`crm-badge crm-badge-unit-${(selectedUnitProfile.availabilityStatus || 'available').toLowerCase()}`} style={{ marginLeft: '0.5rem' }}>
                      {selectedUnitProfile.availabilityStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {selectedUnitProfile.unit?.projectName} • {selectedUnitProfile.unit?.buildingTower} • Floor {selectedUnitProfile.unit?.floorNumber} • {selectedUnitProfile.unit?.configuration} ({selectedUnitProfile.unit?.carpetAreaSqFt} sq.ft)
                  </div>
                </div>
              </div>
              <button className="crm-modal-close-btn" onClick={() => setSelectedUnitProfile(null)}><X size={20} /></button>
            </div>

            <div className="crm-modal-body">
              {/* Unit Specifications Card */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', padding: '0.6rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-label)' }}>UNIT NUMBER</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selectedUnitProfile.unitNumber}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', padding: '0.6rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-label)' }}>BASE PRICE</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>₹{(selectedUnitProfile.unit?.basePrice || 0).toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', padding: '0.6rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-label)' }}>ASKING PRICE</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent)' }}>₹{(selectedUnitProfile.unit?.askingPrice || 0).toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', padding: '0.6rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-label)' }}>FACING / VIEW</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedUnitProfile.unit?.facing || 'East'}</div>
                </div>
              </div>

              {/* BRANCH 1: IF BOOKING DONE -> SHOW THEIR INFO */}
              {selectedUnitProfile.bookingDone && selectedUnitProfile.bookingInfo ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle size={18} /> Booking Confirmed — Buyer & Financial Record
                    </h3>
                    <span className="crm-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                      {selectedUnitProfile.bookingInfo.booking?.bookingReference}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>CONFIRMED BUYER</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selectedUnitProfile.bookingInfo.customer?.fullName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📞 {selectedUnitProfile.bookingInfo.customer?.phone}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>NET BOOKING VALUE</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>₹{(selectedUnitProfile.bookingInfo.financials?.netBookingValue || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>TOTAL RECEIVED</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>₹{(selectedUnitProfile.bookingInfo.financials?.totalReceived || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>OUTSTANDING BALANCE</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f59e0b' }}>₹{(selectedUnitProfile.bookingInfo.financials?.totalOutstanding || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Installment Milestone Schedule Table */}
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Installment Milestones</h4>
                  <div className="crm-table-container">
                    <table className="crm-table">
                      <thead>
                        <tr>
                          <th>Milestone</th>
                          <th>%</th>
                          <th>Due Amount</th>
                          <th>Due Date</th>
                          <th>Paid Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUnitProfile.bookingInfo.schedules?.map((s, idx) => (
                          <tr key={idx}>
                            <td><strong>{s.milestoneName}</strong></td>
                            <td>{s.milestonePercentage}%</td>
                            <td>₹{Number(s.dueAmount).toLocaleString()}</td>
                            <td>{new Date(s.dueDate).toLocaleDateString()}</td>
                            <td style={{ color: '#34d399' }}>₹{Number(s.paidAmount || 0).toLocaleString()}</td>
                            <td>
                              <span className={`crm-badge crm-badge-pay-${(s.status || 'due').toLowerCase().replace(/\s+/g, '')}`}>
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* BRANCH 2: IF NOT BOOKED -> LEAD MANAGEMENT PIPELINE FOR THIS UNIT */}
              {!selectedUnitProfile.bookingDone && (
                <div style={{ background: 'rgba(59, 130, 246, 0.03)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Target size={18} color="var(--accent)" /> Active Lead Management Pipeline for Unit {selectedUnitProfile.unitCode}
                    </h3>
                    <button className="crm-btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }} onClick={() => {
                      setBookingFormData({
                        ...bookingFormData,
                        projectId: selectedUnitProfile.unit?.projectId,
                        unitId: selectedUnitProfile.unit?._id,
                        agreementPrice: selectedUnitProfile.unit?.askingPrice || selectedUnitProfile.unit?.basePrice
                      });
                      setSelectedUnitProfile(null);
                      setShowNewBookingModal(true);
                    }}>
                      Initiate Unit Booking
                    </button>
                  </div>

                  <div className="crm-table-container">
                    <table className="crm-table">
                      <thead>
                        <tr>
                          <th>Enquiring Customer</th>
                          <th>Contact</th>
                          <th>Lead Stage</th>
                          <th>Customer Budget</th>
                          <th>Assigned Salesperson</th>
                          <th>Priority</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUnitProfile.leadManagement?.map((lead) => (
                          <tr key={lead._id}>
                            <td><strong>{lead.customerName}</strong></td>
                            <td>{lead.customerPhone}</td>
                            <td>
                              <span className={`crm-badge crm-badge-stage-${(lead.stage || 'new').toLowerCase().replace(/\s+/g, '')}`}>
                                {lead.stage}
                              </span>
                            </td>
                            <td>₹{(lead.budget || 0).toLocaleString()}</td>
                            <td>{lead.assignedSalespersonName || 'Sales Rep'}</td>
                            <td>{lead.priority || 'Medium'}</td>
                            <td>
                              <button className="crm-btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={() => {
                                setSelectedUnitProfile(null);
                                openCustomer360(lead.customerId);
                              }}>
                                View 360
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!selectedUnitProfile.leadManagement || selectedUnitProfile.leadManagement.length === 0) && (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-label)' }}>
                              No active enquiries currently logged for this unit.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: PRINTABLE OFFICIAL TAX PAYMENT RECEIPT
         ══════════════════════════════════════════════════════════════════════════ */}
      {printableReceipt && (
        <div className="crm-modal-overlay" onClick={() => setPrintableReceipt(null)}>
          <div className="crm-modal-container large" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <span className="crm-modal-title"><Printer size={18} /> Official Payment Receipt</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="crm-btn-primary" onClick={() => window.print()}>
                  <Printer size={14} /> Print Receipt / Save PDF
                </button>
                <button className="crm-modal-close-btn" onClick={() => setPrintableReceipt(null)}><X size={20} /></button>
              </div>
            </div>

            <div className="crm-modal-body">
              <div className="crm-receipt-sheet">
                <div className="crm-receipt-header">
                  <div>
                    <div className="crm-receipt-company-name">{printableReceipt.company?.name || 'Prestige Metro Developers Private Limited'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Corporate HQ: 42, Executive Center, Metro Corridor</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>GSTIN: 24AAAAA0000A1Z5 • RERA Reg: PRM/KA/RERA/1251/310/PR/171015/000452</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="crm-receipt-badge">RECEIPT ACKNOWLEDGEMENT</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.4rem' }}>
                      {printableReceipt.transaction?.receiptNumber}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      Date: {new Date(printableReceipt.transaction?.paymentDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="crm-receipt-grid">
                  <div className="crm-receipt-box">
                    <h4>RECEIVED WITH THANKS FROM:</h4>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{printableReceipt.customer?.fullName}</div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>Phone: {printableReceipt.customer?.phone}</div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>Email: {printableReceipt.customer?.email || 'N/A'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>Address: {printableReceipt.customer?.address || 'Mumbai, India'}</div>
                  </div>

                  <div className="crm-receipt-box">
                    <h4>PROPERTY & BOOKING ALLOCATION:</h4>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{printableReceipt.booking?.projectName}</div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>Property Unit: <strong>Unit {printableReceipt.booking?.unitCode}</strong></div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>Booking Reference: <strong>{printableReceipt.booking?.bookingReference}</strong></div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>Agreement Value: ₹{Number(printableReceipt.booking?.agreementPrice).toLocaleString()}</div>
                  </div>
                </div>

                <table className="crm-receipt-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Payment Instrument</th>
                      <th>Transaction UTR / Cheque Ref</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Installment Payment Acknowledgement</strong>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Against Booking {printableReceipt.booking?.bookingReference} (Unit {printableReceipt.booking?.unitCode})</div>
                      </td>
                      <td>{printableReceipt.transaction?.paymentMethod}</td>
                      <td>{printableReceipt.transaction?.transactionReference}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem' }}>
                        ₹{Number(printableReceipt.transaction?.amount).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="crm-receipt-total-row">
                  <span>TOTAL AMOUNT RECEIVED:</span>
                  <span style={{ color: '#10b981' }}>₹{Number(printableReceipt.transaction?.amount).toLocaleString()}</span>
                </div>

                <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    * This is a computer-generated official receipt. Subject to realization of cheque/transfer instrument.
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '180px', borderBottom: '1px solid #0f172a', marginBottom: '0.35rem' }}></div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>Authorized Accounts Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: ADD NEW CUSTOMER PROFILE (WITH DUPLICATE WARNING)
         ══════════════════════════════════════════════════════════════════════════ */}
      {showAddCustomerModal && (
        <div className="crm-modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="crm-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <span className="crm-modal-title"><Users size={18} /> Register Customer Profile</span>
              <button className="crm-modal-close-btn" onClick={() => setShowAddCustomerModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="crm-modal-body">
                {duplicateWarning && (
                  <div className="crm-alert-warning">
                    <AlertCircle size={18} />
                    <div><strong>Duplicate Warning:</strong> {duplicateWarning}</div>
                  </div>
                )}
                <div className="crm-form-grid">
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Full Name *</label>
                    <input
                      className="crm-form-input"
                      type="text"
                      required
                      placeholder="e.g. Rahul Shah"
                      value={customerFormData.fullName}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, fullName: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Primary Phone *</label>
                    <input
                      className="crm-form-input"
                      type="tel"
                      required
                      placeholder="e.g. 9820011223"
                      value={customerFormData.phone}
                      onBlur={handlePhoneBlur}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Email Address</label>
                    <input
                      className="crm-form-input"
                      type="email"
                      placeholder="e.g. rahul@example.com"
                      value={customerFormData.email}
                      onBlur={handlePhoneBlur}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Lead Source</label>
                    <select
                      className="crm-form-select"
                      value={customerFormData.leadSource}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, leadSource: e.target.value })}
                    >
                      <option value="Website">Website Form</option>
                      <option value="Walk-in">Walk-in Direct</option>
                      <option value="Channel Partner">Channel Partner / Broker</option>
                      <option value="Referral">Customer Referral</option>
                      <option value="Social Media">Social Media Campaign</option>
                    </select>
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Property Preference</label>
                    <select
                      className="crm-form-select"
                      value={customerFormData.preferredPropertyType}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, preferredPropertyType: e.target.value })}
                    >
                      <option value="2BHK">2BHK Apartment</option>
                      <option value="3BHK">3BHK Apartment</option>
                      <option value="4BHK Penthouse">4BHK Penthouse</option>
                      <option value="Villa">Luxury Villa</option>
                    </select>
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Budget Min (₹)</label>
                    <input
                      className="crm-form-input"
                      type="number"
                      placeholder="e.g. 8000000"
                      value={customerFormData.budgetMin}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, budgetMin: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Budget Max (₹)</label>
                    <input
                      className="crm-form-input"
                      type="number"
                      placeholder="e.g. 14000000"
                      value={customerFormData.budgetMax}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, budgetMax: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Notes & Requirements</label>
                    <textarea
                      className="crm-form-textarea"
                      rows="3"
                      placeholder="Specific requirements, preferred facing, investor vs end-user..."
                      value={customerFormData.notes}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="crm-modal-footer">
                <button type="button" className="crm-btn-secondary" onClick={() => setShowAddCustomerModal(false)}>Cancel</button>
                <button type="submit" className="crm-btn-primary">Register Customer Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: ADD NEW UNIT INTEREST / LEAD ENQUIRY
         ══════════════════════════════════════════════════════════════════════════ */}
      {showAddLeadModal && (
        <div className="crm-modal-overlay" onClick={() => setShowAddLeadModal(false)}>
          <div className="crm-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <span className="crm-modal-title"><Target size={18} /> Link New Property Interest / Lead</span>
              <button className="crm-modal-close-btn" onClick={() => setShowAddLeadModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateLead}>
              <div className="crm-modal-body">
                <div className="crm-form-grid">
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Select Customer *</label>
                    <select
                      className="crm-form-select"
                      required
                      value={leadFormData.customerId}
                      onChange={(e) => setLeadFormData({ ...leadFormData, customerId: e.target.value })}
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map(c => (
                        <option key={c._id} value={c._id}>{c.fullName} ({c.phone})</option>
                      ))}
                    </select>
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Project *</label>
                    <select
                      className="crm-form-select"
                      required
                      value={leadFormData.projectId}
                      onChange={(e) => setLeadFormData({ ...leadFormData, projectId: e.target.value })}
                    >
                      <option value="">-- Choose Project --</option>
                      {projects.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Initial Pipeline Stage</label>
                    <select
                      className="crm-form-select"
                      value={leadFormData.stage}
                      onChange={(e) => setLeadFormData({ ...leadFormData, stage: e.target.value })}
                    >
                      <option value="New">New Enquiry</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Visit Scheduled">Visit Scheduled</option>
                      <option value="Negotiation">Negotiation</option>
                    </select>
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Budget (₹)</label>
                    <input
                      className="crm-form-input"
                      type="number"
                      placeholder="e.g. 12000000"
                      value={leadFormData.budget}
                      onChange={(e) => setLeadFormData({ ...leadFormData, budget: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Priority</label>
                    <select
                      className="crm-form-select"
                      value={leadFormData.priority}
                      onChange={(e) => setLeadFormData({ ...leadFormData, priority: e.target.value })}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Notes</label>
                    <textarea
                      className="crm-form-textarea"
                      rows="2"
                      placeholder="Customer requirements for this specific property enquiry..."
                      value={leadFormData.notes}
                      onChange={(e) => setLeadFormData({ ...leadFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="crm-modal-footer">
                <button type="button" className="crm-btn-secondary" onClick={() => setShowAddLeadModal(false)}>Cancel</button>
                <button type="submit" className="crm-btn-primary">Link Property Enquiry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: NEW UNIT BOOKING
         ══════════════════════════════════════════════════════════════════════════ */}
      {showNewBookingModal && (
        <div className="crm-modal-overlay" onClick={() => setShowNewBookingModal(false)}>
          <div className="crm-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <span className="crm-modal-title"><FileText size={18} /> Initiate Property Unit Booking</span>
              <button className="crm-modal-close-btn" onClick={() => setShowNewBookingModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateBooking}>
              <div className="crm-modal-body">
                <div className="crm-form-grid">
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Select Buyer *</label>
                    <select
                      className="crm-form-select"
                      required
                      value={bookingFormData.customerId}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, customerId: e.target.value })}
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map(c => (
                        <option key={c._id} value={c._id}>{c.fullName} ({c.phone})</option>
                      ))}
                    </select>
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Project *</label>
                    <select
                      className="crm-form-select"
                      required
                      value={bookingFormData.projectId}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, projectId: e.target.value })}
                    >
                      <option value="">-- Choose Project --</option>
                      {projects.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Unit to Allocate *</label>
                    <select
                      className="crm-form-select"
                      required
                      value={bookingFormData.unitId}
                      onChange={(e) => {
                        const selectedU = units.find(u => u._id === e.target.value);
                        setBookingFormData({
                          ...bookingFormData,
                          unitId: e.target.value,
                          agreementPrice: selectedU ? (selectedU.askingPrice || selectedU.basePrice) : bookingFormData.agreementPrice
                        });
                      }}
                    >
                      <option value="">-- Choose Available Unit --</option>
                      {units
                        .filter(u => !['Booked', 'Sold', 'Blocked'].includes(u.availabilityStatus))
                        .map(u => (
                          <option key={u._id} value={u._id}>{u.unitCode} — {u.configuration} (₹{u.askingPrice?.toLocaleString()})</option>
                        ))}
                    </select>
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Agreed Price (₹) *</label>
                    <input
                      className="crm-form-input"
                      type="number"
                      required
                      placeholder="e.g. 9200000"
                      value={bookingFormData.agreementPrice}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, agreementPrice: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Approved Concession / Discount (₹)</label>
                    <input
                      className="crm-form-input"
                      type="number"
                      placeholder="e.g. 200000"
                      value={bookingFormData.discountAmount}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, discountAmount: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Applicable Taxes (₹)</label>
                    <input
                      className="crm-form-input"
                      type="number"
                      placeholder="e.g. 450000"
                      value={bookingFormData.taxAmount}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, taxAmount: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Token Deposit Due (₹)</label>
                    <input
                      className="crm-form-input"
                      type="number"
                      placeholder="e.g. 920000"
                      value={bookingFormData.bookingDepositRequired}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, bookingDepositRequired: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="crm-modal-footer">
                <button type="button" className="crm-btn-secondary" onClick={() => setShowNewBookingModal(false)}>Cancel</button>
                <button type="submit" className="crm-btn-primary">Commit Unit Booking & Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: RECORD PAYMENT & ISSUE RECEIPT
         ══════════════════════════════════════════════════════════════════════════ */}
      {showRecordPaymentModal && (
        <div className="crm-modal-overlay" onClick={() => setShowRecordPaymentModal(false)}>
          <div className="crm-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <span className="crm-modal-title"><CreditCard size={18} /> Record Customer Payment</span>
              <button className="crm-modal-close-btn" onClick={() => setShowRecordPaymentModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="crm-modal-body">
                <div className="crm-form-grid">
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Select Active Booking *</label>
                    <select
                      className="crm-form-select"
                      required
                      value={paymentFormData.bookingId}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, bookingId: e.target.value })}
                    >
                      <option value="">-- Choose Booking --</option>
                      {bookings.filter(b => b.status !== 'Cancelled').map(b => (
                        <option key={b._id} value={b._id}>
                          {b.bookingReference} — {b.customerName} (Unit {b.unitCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Payment Amount (₹) *</label>
                    <input
                      className="crm-form-input"
                      type="number"
                      required
                      placeholder="e.g. 945000"
                      value={paymentFormData.amount}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group">
                    <label className="crm-form-label">Payment Method</label>
                    <select
                      className="crm-form-select"
                      value={paymentFormData.paymentMethod}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                      <option value="Cheque">Cheque</option>
                      <option value="UPI">UPI</option>
                      <option value="Demand Draft">Demand Draft</option>
                      <option value="Credit/Debit Card">Credit/Debit Card</option>
                    </select>
                  </div>
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Transaction Reference (UTR / Cheque No) *</label>
                    <input
                      className="crm-form-input"
                      type="text"
                      required
                      placeholder="e.g. HDFC9876543210"
                      value={paymentFormData.transactionReference}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, transactionReference: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Receipt Notes</label>
                    <input
                      className="crm-form-input"
                      type="text"
                      placeholder="e.g. Booking token amount in full"
                      value={paymentFormData.receiptNotes}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, receiptNotes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="crm-modal-footer">
                <button type="button" className="crm-btn-secondary" onClick={() => setShowRecordPaymentModal(false)}>Cancel</button>
                <button type="submit" className="crm-btn-primary">Post Payment & Generate Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: SCHEDULE SITE VISIT
         ══════════════════════════════════════════════════════════════════════════ */}
      {showScheduleVisitModal && (
        <div className="crm-modal-overlay" onClick={() => setShowScheduleVisitModal(false)}>
          <div className="crm-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <span className="crm-modal-title"><Calendar size={18} /> Schedule Site Walkthrough Visit</span>
              <button className="crm-modal-close-btn" onClick={() => setShowScheduleVisitModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await crmApi.scheduleVisit(visitFormData);
                setShowScheduleVisitModal(false);
                loadVisits();
                loadDashboard();
              } catch (err) {
                alert(err.message);
              }
            }}>
              <div className="crm-modal-body">
                <div className="crm-form-grid">
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Customer *</label>
                    <select
                      className="crm-form-select"
                      required
                      value={visitFormData.customerId}
                      onChange={(e) => setVisitFormData({ ...visitFormData, customerId: e.target.value })}
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map(c => (
                        <option key={c._id} value={c._id}>{c.fullName} ({c.phone})</option>
                      ))}
                    </select>
                  </div>
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Project *</label>
                    <select
                      className="crm-form-select"
                      required
                      value={visitFormData.projectId}
                      onChange={(e) => setVisitFormData({ ...visitFormData, projectId: e.target.value })}
                    >
                      <option value="">-- Choose Project --</option>
                      {projects.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Visit Date & Time *</label>
                    <input
                      className="crm-form-input"
                      type="datetime-local"
                      required
                      value={visitFormData.visitDateTime}
                      onChange={(e) => setVisitFormData({ ...visitFormData, visitDateTime: e.target.value })}
                    />
                  </div>
                  <div className="crm-form-group full-width">
                    <label className="crm-form-label">Special Notes / Family Attendance</label>
                    <input
                      className="crm-form-input"
                      type="text"
                      placeholder="e.g. Inspecting 12th & 14th floor natural light"
                      value={visitFormData.notes}
                      onChange={(e) => setVisitFormData({ ...visitFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="crm-modal-footer">
                <button type="button" className="crm-btn-secondary" onClick={() => setShowScheduleVisitModal(false)}>Cancel</button>
                <button type="submit" className="crm-btn-primary">Schedule Visit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
