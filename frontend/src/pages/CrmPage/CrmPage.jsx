import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  LayoutDashboard, Calendar, CheckSquare, CalendarDays, Users,
  Kanban, Building2, FileText, Upload, Clock,
  Plus, Search, RefreshCw, X, ChevronDown, Play,
  Building, AlertCircle
} from 'lucide-react';
import { crmApi } from '../../utils/crmApi';
import { setView } from '../../store/slices/routingSlice';
import { useActiveProject } from '../../hooks/useActiveProject';
import { Input, Select } from '../../components/ui';

// Modular Split Components
import TodayScreen from './components/TodayScreen';
import LeadsBoard from './components/LeadsBoard';
import InventoryGrid from './components/InventoryGrid';
import FollowupsView from './components/FollowupsView';
import ImportLeadsView from './components/ImportLeadsView';
import MoneyList from './components/MoneyList';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import QuickAddLead from './components/QuickAddLead';
import Customer360 from './components/Customer360';
import UnitSheet from './components/UnitSheet';
import BookingWizard from './components/BookingWizard';
import PaymentForm from './components/PaymentForm';
import ReceiptView from './components/ReceiptView';
import WhatsAppQuote from './components/WhatsAppQuote';
import GuidedFollowupModal from './components/GuidedFollowupModal';
import TemplatesView from './components/TemplatesView';
import TasksView from './components/TasksView';
import CalendarView from './components/CalendarView';

import './CrmPage.css';

export default function CrmPage({ subView }) {
  const dispatch = useDispatch();
  const { projectId: activeProjectId, projectEpoch } = useActiveProject();

  // Screen State synced from routing subView prop:
  // 'dashboard' | 'today' | 'leads' | 'pipeline' | 'tasks' | 'calendar' | 'followups' | 'inventory' | 'templates' | 'import'
  const mapSubViewToScreen = (view) => {
    if (!view) return 'today';
    if (view === 'crm-dashboard') return 'dashboard';
    if (view === 'crm-today' || view === 'crm') return 'today';
    if (view === 'crm-leads') return 'leads';
    if (view === 'crm-pipeline') return 'pipeline';
    if (view === 'crm-tasks') return 'tasks';
    if (view === 'crm-calendar') return 'calendar';
    if (view === 'crm-followups') return 'followups';
    if (view === 'crm-inventory') return 'inventory';
    if (view === 'crm-templates') return 'templates';
    if (view === 'crm-import') return 'import';
    const params = new URLSearchParams(window.location.search);
    const sp = params.get('screen');
    return sp || 'today';
  };

  const [activeScreen, setActiveScreen] = useState(() => mapSubViewToScreen(subView));
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId ? String(activeProjectId) : '');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshEpoch, setRefreshEpoch] = useState(0);

  // Sync when subView prop changes from main navigation
  useEffect(() => {
    if (subView) {
      setActiveScreen(mapSubViewToScreen(subView));
    }
  }, [subView]);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Today Summary & Stat Store
  const [todaySummary, setTodaySummary] = useState(null);

  // Core Data Stores
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [units, setUnits] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Active Modals & Slide-over Drawers
  const [showQuickAddLead, setShowQuickAddLead] = useState(false);
  const [showGuidedFollowupQueue, setShowGuidedFollowupQueue] = useState(false);
  const [activeFollowupQueue, setActiveFollowupQueue] = useState([]);
  const [selectedCustomerFor360, setSelectedCustomerFor360] = useState(null);
  const [selectedUnitForSheet, setSelectedUnitForSheet] = useState(null);
  const [bookingWizardContext, setBookingWizardContext] = useState(null); // { unit, customer }
  const [paymentFormBooking, setPaymentFormBooking] = useState(null);
  const [activeReceipt, setActiveReceipt] = useState(null); // { payment, booking }
  const [activeWhatsAppQuoteUnit, setActiveWhatsAppQuoteUnit] = useState(null);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  // Switch screen handler synced with Redux central navigation
  const switchScreen = useCallback((newScreen) => {
    setActiveScreen(newScreen);
    const targetView = 'crm-' + newScreen;
    dispatch(setView(targetView));
  }, [dispatch]);

  // Update selectedProjectId when active project from navbar changes
  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(String(activeProjectId));
    }
  }, [activeProjectId, projectEpoch]);

  // Load Projects List
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await crmApi.getProjects();
        const list = Array.isArray(res) ? res : res?.data || [];
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(String(list[0]._id));
        }
      } catch (err) {
        console.warn('Failed to load CRM projects:', err);
      }
    };
    fetchProjects();
  }, []);

  // Load Today Summary & CRM Data
  const loadCrmData = useCallback(async () => {
    setLoading(true);
    try {
      const projId = selectedProjectId || undefined;
      const [todayRes, leadsRes, custRes, unitsRes, bookRes, payRes, taskRes, tmplRes, blocksRes, floorsRes] = await Promise.allSettled([
        crmApi.getTodaySummary({ projectId: projId }),
        crmApi.getLeads({ projectId: projId }),
        crmApi.getCustomers({ projectId: projId }),
        crmApi.getUnits({ projectId: projId }),
        crmApi.getBookings({ projectId: projId }),
        crmApi.getPayments(),
        crmApi.getTasks(),
        crmApi.getTemplates(),
        projId ? crmApi.getBlocks(projId) : Promise.resolve([]),
        projId ? crmApi.getFloors({ projectId: projId }) : Promise.resolve([])
      ]);

      if (todayRes.status === 'fulfilled') setTodaySummary(todayRes.value);
      if (leadsRes.status === 'fulfilled') setLeads(Array.isArray(leadsRes.value) ? leadsRes.value : leadsRes.value?.data || []);
      if (custRes.status === 'fulfilled') setCustomers(Array.isArray(custRes.value) ? custRes.value : custRes.value?.data || []);
      if (unitsRes.status === 'fulfilled') setUnits(Array.isArray(unitsRes.value) ? unitsRes.value : unitsRes.value?.data || []);
      if (bookRes.status === 'fulfilled') setBookings(Array.isArray(bookRes.value) ? bookRes.value : bookRes.value?.data || []);
      if (payRes.status === 'fulfilled') setPayments(Array.isArray(payRes.value) ? payRes.value : payRes.value?.data || []);
      if (taskRes.status === 'fulfilled') setTasks(Array.isArray(taskRes.value) ? taskRes.value : taskRes.value?.data || []);
      if (tmplRes.status === 'fulfilled') setTemplates(Array.isArray(tmplRes.value) ? tmplRes.value : tmplRes.value?.data || []);
      if (blocksRes.status === 'fulfilled') setBlocks(Array.isArray(blocksRes.value) ? blocksRes.value : blocksRes.value?.data || []);
      if (floorsRes.status === 'fulfilled') setFloors(Array.isArray(floorsRes.value) ? floorsRes.value : floorsRes.value?.data || []);
    } catch (err) {
      console.warn('Error loading CRM data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadCrmData();
  }, [loadCrmData, refreshEpoch]);

  // Debounced Global Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await crmApi.search(searchQuery.trim());
        setSearchResults(res);
        setShowSearchDropdown(true);
      } catch (err) {
        console.warn('Global search error:', err);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── ACTION HANDLERS ───────────────────────────────────────────────────────

  // Launch Guided Follow-up Workflow with overdue records first
  const handleStartFollowups = async () => {
    try {
      const res = await crmApi.getFollowups({ projectId: selectedProjectId || undefined });
      const list = res.followups || [];
      if (list.length > 0) {
        setActiveFollowupQueue(list);
      } else {
        // Fallback to todaySummary groups or active leads
        const overdue = todaySummary?.leadFollowupGroups?.overdue || [];
        const dueToday = todaySummary?.leadFollowupGroups?.dueToday || [];
        const combined = [...overdue, ...dueToday];
        setActiveFollowupQueue(combined.length > 0 ? combined : leads.filter(l => !['Booked', 'Lost'].includes(l.stage)));
      }
      setShowGuidedFollowupQueue(true);
    } catch (err) {
      console.warn('Error starting followups:', err);
      // Fallback
      const overdue = todaySummary?.leadFollowupGroups?.overdue || [];
      const dueToday = todaySummary?.leadFollowupGroups?.dueToday || [];
      const combined = [...overdue, ...dueToday];
      setActiveFollowupQueue(combined.length > 0 ? combined : leads.filter(l => !['Booked', 'Lost'].includes(l.stage)));
      setShowGuidedFollowupQueue(true);
    }
  };

  const handleToggleTask = async (taskId) => {
    try {
      await crmApi.toggleTask(taskId);
      setRefreshEpoch(prev => prev + 1);
    } catch (err) {
      alert('Failed to toggle task: ' + err.message);
    }
  };

  const handleHoldUnit = async (unitId, hours = 48) => {
    try {
      await crmApi.reserveUnit(unitId, {
        holdHours: hours,
        notes: `Reserved for 48h hold`
      });
      setRefreshEpoch(prev => prev + 1);
      if (selectedUnitForSheet && selectedUnitForSheet._id === unitId) {
        setSelectedUnitForSheet(prev => ({
          ...prev,
          availabilityStatus: 'Hold',
          effectiveStatus: 'Hold',
          holdExpiresAt: new Date(Date.now() + hours * 3600 * 1000).toISOString()
        }));
      }
    } catch (err) {
      alert('Hold error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleReleaseUnit = async (unitId) => {
    if (!window.confirm('Release this unit back to Available status?')) return;
    try {
      await crmApi.releaseUnit(unitId);
      setRefreshEpoch(prev => prev + 1);
      if (selectedUnitForSheet && selectedUnitForSheet._id === unitId) {
        setSelectedUnitForSheet(prev => ({
          ...prev,
          availabilityStatus: 'Available',
          effectiveStatus: 'Available',
          holdExpiresAt: null
        }));
      }
    } catch (err) {
      alert('Release error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleBlockUnit = async (unitId, reason) => {
    try {
      await crmApi.blockUnit(unitId, { reason });
      setRefreshEpoch(prev => prev + 1);
    } catch (err) {
      alert('Block error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleUnblockUnit = async (unitId) => {
    try {
      await crmApi.unblockUnit(unitId);
      setRefreshEpoch(prev => prev + 1);
    } catch (err) {
      alert('Unblock error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This will release the unit back to Available.')) return;
    try {
      await crmApi.cancelBooking(bookingId);
      setRefreshEpoch(prev => prev + 1);
    } catch (err) {
      alert('Cancellation failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleReversePayment = async (paymentId) => {
    if (!window.confirm('Reverse this transaction? An audit record will be logged.')) return;
    try {
      await crmApi.reversePayment(paymentId);
      setRefreshEpoch(prev => prev + 1);
    } catch (err) {
      alert('Reversal failed: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="crm-unified-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, minHeight: '100%', background: 'var(--main-bg)' }}>
      {/* ── TOP UTILITY STRIP (Project switcher, Global search, Refresh, Add lead) ── */}
      <header className="crm-top-bar" style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--card-border)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Project Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--card-border)',
                padding: '6px 30px 6px 12px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                appearance: 'none'
              }}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </Select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '10px', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
          </div>
        </div>

        {/* Global Search + Refresh + Hero Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-label)' }} />
            <Input
              type="text"
              placeholder="Search phone, buyer, unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchDropdown(true)}
              style={{
                padding: '6px 12px 6px 30px',
                borderRadius: '8px',
                border: '1px solid var(--card-border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                width: '190px'
              }}
            />
            {showSearchDropdown && searchResults && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '110%',
                width: '320px',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '8px',
                padding: '10px',
                boxShadow: 'var(--shadow-modal)',
                zIndex: 250,
                maxHeight: '340px',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  <span>Search Results</span>
                  <button type="button" onClick={() => setShowSearchDropdown(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={13} />
                  </button>
                </div>
                {searchResults.customers?.map(c => (
                  <div
                    key={c._id}
                    onClick={() => { setSelectedCustomerFor360(c); setShowSearchDropdown(false); }}
                    style={{ padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', background: 'var(--input-bg)', marginBottom: '5px', fontSize: '0.82rem' }}
                  >
                    <strong style={{ color: 'var(--text-primary)' }}>{c.fullName}</strong> • <span style={{ color: 'var(--accent)' }}>{c.phone}</span>
                  </div>
                ))}
                {searchResults.units?.map(u => (
                  <div
                    key={u._id}
                    onClick={() => { setSelectedUnitForSheet(u); setShowSearchDropdown(false); }}
                    style={{ padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', background: 'var(--input-bg)', marginBottom: '5px', fontSize: '0.82rem' }}
                  >
                    Unit <strong style={{ color: 'var(--accent)' }}>{u.unitCode || u.unitNumber}</strong> • {u.configuration}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setRefreshEpoch(prev => prev + 1)}
            style={{
              padding: '7px',
              borderRadius: '8px',
              border: '1px solid var(--card-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="Refresh CRM Data"
          >
            <RefreshCw size={14} className={loading ? 'crm-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleStartFollowups}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Play size={14} fill="currentColor" /> Start follow-ups
          </button>

          <button
            type="button"
            onClick={() => setShowQuickAddLead(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer'
            }}
          >
            <Plus size={15} /> Add lead
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT VIEWPORT ───────────────────────────────────────────── */}
      <main className="crm-main-viewport" style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {/* Dashboard View */}
        {activeScreen === 'dashboard' && (
          <ReportsView
            summary={todaySummary}
            pipeline={leads}
            bookings={bookings}
            customers={customers}
            projects={projects}
            selectedProjectId={selectedProjectId}
          />
        )}

        {/* Today Screen (5-section Daily Briefing) */}
        {activeScreen === 'today' && (
          <TodayScreen
            summary={todaySummary}
            onStartFollowups={handleStartFollowups}
            onAddLead={() => setShowQuickAddLead(true)}
            onSelectLead={(lead) => {
              const matchedCustomer = customers.find(c => c._id === lead.customerId) || lead.customer || lead;
              setSelectedCustomerFor360(matchedCustomer);
            }}
            onToggleTask={handleToggleTask}
            onAddTask={() => setShowNewTaskModal(true)}
            onAddAppointment={() => setShowNewAppointmentModal(true)}
            onExtendHold={(unitId, hrs) => handleHoldUnit(unitId, hrs)}
            onReleaseHold={(unitId) => handleReleaseUnit(unitId)}
            onSwitchScreen={switchScreen}
          />
        )}

        {/* Leads Table & Pipeline Views */}
        {['leads', 'pipeline'].includes(activeScreen) && (
          <LeadsBoard
            leads={leads}
            customers={customers}
            projects={projects}
            selectedProjectId={selectedProjectId}
            initialViewMode={activeScreen === 'pipeline' ? 'kanban' : 'table'}
            onSelectLead={(lead) => setSelectedCustomerFor360(lead)}
            onOpenAddLead={() => setShowQuickAddLead(true)}
            onUpdateLeadStage={async (leadId, newStage, lostReason) => {
              await crmApi.updateLeadStage(leadId, { stage: newStage, ...(lostReason ? { lostReason } : {}) });
              setRefreshEpoch(prev => prev + 1);
            }}
            onConvertToBooking={(customer) => setBookingWizardContext({ customer })}
          />
        )}

        {/* Tasks View */}
        {activeScreen === 'tasks' && (
          <TasksView
            leads={leads}
            projects={projects}
            units={units}
            bookings={bookings}
            onRefreshData={() => setRefreshEpoch(prev => prev + 1)}
          />
        )}

        {/* Calendar View */}
        {activeScreen === 'calendar' && (
          <CalendarView
            projects={projects}
            leads={leads}
            onOpenNewAppointment={() => setShowNewAppointmentModal(true)}
            onRefreshData={() => setRefreshEpoch(prev => prev + 1)}
          />
        )}

        {/* Dedicated Follow-ups View */}
        {activeScreen === 'followups' && (
          <FollowupsView
            selectedProjectId={selectedProjectId}
            onStartFollowups={handleStartFollowups}
            onSelectLead={(lead) => {
              const matchedCustomer = customers.find(c => c._id === lead.customerId) || lead;
              setSelectedCustomerFor360(matchedCustomer);
            }}
            onRefreshData={() => setRefreshEpoch(prev => prev + 1)}
          />
        )}

        {/* Unit Inventory View (Upgraded with Matrix & Table Listing) */}
        {activeScreen === 'inventory' && (
          <InventoryGrid
            units={units}
            projects={projects}
            blocks={blocks}
            floors={floors}
            selectedProjectId={selectedProjectId}
            onSelectProject={(pId) => setSelectedProjectId(pId)}
            onSelectUnit={(unit) => setSelectedUnitForSheet(unit)}
            onHoldUnit={handleHoldUnit}
            onReleaseHold={handleReleaseUnit}
            onBlockUnit={handleBlockUnit}
            onUnblockUnit={handleUnblockUnit}
            onOpenBooking={(unit) => setBookingWizardContext({ unit })}
            onRefreshData={() => setRefreshEpoch(prev => prev + 1)}
          />
        )}

        {/* Templates View */}
        {activeScreen === 'templates' && (
          <TemplatesView />
        )}

        {/* Import Leads View (Upgraded 6-Step Pipeline) */}
        {activeScreen === 'import' && (
          <ImportLeadsView
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSwitchScreen={switchScreen}
            onRefreshData={() => setRefreshEpoch(prev => prev + 1)}
          />
        )}
      </main>

      {/* ── MODALS & DRAWERS ────────────────────────────────────────────────── */}
      {showQuickAddLead && (
        <QuickAddLead
          projects={projects}
          defaultProjectId={selectedProjectId}
          onClose={() => setShowQuickAddLead(false)}
          onLeadCreated={() => setRefreshEpoch(prev => prev + 1)}
        />
      )}

      {/* Guided Follow-up Queue Modal */}
      {showGuidedFollowupQueue && (
        <GuidedFollowupModal
          leads={activeFollowupQueue}
          templates={templates}
          onClose={() => setShowGuidedFollowupQueue(false)}
          onFollowupLogged={(lead, outcome) => {
            setRefreshEpoch(prev => prev + 1);
          }}
          onOpenHoldOrBooking={(lead) => {
            setShowGuidedFollowupQueue(false);
            const matchedCustomer = customers.find(c => c._id === lead.customerId) || lead;
            setBookingWizardContext({ customer: matchedCustomer });
          }}
        />
      )}

      {selectedCustomerFor360 && (
        <Customer360
          customer={selectedCustomerFor360}
          onClose={() => setSelectedCustomerFor360(null)}
          onUpdateStage={async (stage, reason) => {
            if (selectedCustomerFor360._id) {
              await crmApi.updateLeadStage(selectedCustomerFor360._id, { stage, ...(reason ? { lostReason: reason } : {}) });
              setRefreshEpoch(prev => prev + 1);
            }
          }}
          onScheduleVisit={async (custId, data) => {
            await crmApi.scheduleVisit(data);
            setRefreshEpoch(prev => prev + 1);
          }}
          onLogActivity={async (custId, activity) => {
            await crmApi.addCustomerActivity(custId, activity);
            setRefreshEpoch(prev => prev + 1);
          }}
          onOpenBookingWizard={(customer) => {
            setSelectedCustomerFor360(null);
            setBookingWizardContext({ customer });
          }}
        />
      )}

      {selectedUnitForSheet && (
        <UnitSheet
          unit={selectedUnitForSheet}
          customers={customers}
          onClose={() => setSelectedUnitForSheet(null)}
          onHoldUnit={handleHoldUnit}
          onReleaseHold={handleReleaseUnit}
          onBlockUnit={handleBlockUnit}
          onUnblockUnit={handleUnblockUnit}
          onOpenWhatsAppQuote={(unit) => setActiveWhatsAppQuoteUnit(unit)}
          onOpenBooking={(unit) => {
            setSelectedUnitForSheet(null);
            setBookingWizardContext({ unit });
          }}
        />
      )}

      {bookingWizardContext && (
        <BookingWizard
          initialUnit={bookingWizardContext.unit}
          initialCustomer={bookingWizardContext.customer}
          customers={customers}
          units={units}
          projects={projects}
          onClose={() => setBookingWizardContext(null)}
          onBookingCreated={() => {
            setBookingWizardContext(null);
            setRefreshEpoch(prev => prev + 1);
          }}
        />
      )}

      {paymentFormBooking && (
        <PaymentForm
          booking={paymentFormBooking}
          onClose={() => setPaymentFormBooking(null)}
          onPaymentRecorded={(payment) => {
            setPaymentFormBooking(null);
            setRefreshEpoch(prev => prev + 1);
            if (payment) setActiveReceipt({ payment, booking: paymentFormBooking });
          }}
        />
      )}

      {activeReceipt && (
        <ReceiptView
          payment={activeReceipt.payment}
          booking={activeReceipt.booking}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {activeWhatsAppQuoteUnit && (
        <WhatsAppQuote
          unit={activeWhatsAppQuoteUnit}
          customers={customers}
          onClose={() => setActiveWhatsAppQuoteUnit(null)}
        />
      )}

      {showNewAppointmentModal && (
        <NewAppointmentModal
          projects={projects}
          leads={leads}
          onClose={() => setShowNewAppointmentModal(false)}
          onCreated={() => setRefreshEpoch(prev => prev + 1)}
        />
      )}

      {showNewTaskModal && (
        <NewTaskModal
          leads={leads}
          onClose={() => setShowNewTaskModal(false)}
          onCreated={() => setRefreshEpoch(prev => prev + 1)}
        />

      )}
    </div>
  );
}

// ── LOCAL MODAL HELPERS ───────────────────────────────────────────────────────

function NewAppointmentModal({ projects, leads, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('site_visit');
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });
  const [location, setLocation] = useState('Site Experience Centre');
  const [leadId, setLeadId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const selectedLead = leads.find(l => l._id === leadId);
      await crmApi.createAppointment({
        title: title.trim(),
        type,
        start,
        location,
        leadId: selectedLead?._id || undefined,
        customerId: selectedLead?.customerId || undefined,
        customerName: selectedLead?.customerName || undefined,
        customerPhone: selectedLead?.customerPhone || undefined,
        projectId: selectedLead?.projectId || (projects[0]?._id) || undefined
      });
      onCreated();
      onClose();
    } catch (err) {
      alert('Error scheduling appointment: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '14px', width: '100%', maxWidth: '440px', padding: '20px', color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Schedule Appointment</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title *</label>
            <Input
              type="text"
              required
              placeholder="e.g. Site Walkthrough - Vikram"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Type</label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ width: '100%', padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              >
                <option value="site_visit">Site Visit</option>
                <option value="meeting">Meeting</option>
                <option value="call">Call</option>
                <option value="registration">Registration</option>
                <option value="handover">Handover</option>
              </Select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Date &amp; Time</label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                style={{ width: '100%', padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Location</label>
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Associated Lead (Optional)</label>
            <Select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            >
              <option value="">None</option>
              {leads.map(l => (
                <option key={l._id} value={l._id}>{l.customerName} ({l.projectName || 'Lead'})</option>
              ))}
            </Select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', background: 'var(--accent)', color: 'var(--accent-contrast)', border: 'none', fontWeight: 700, cursor: 'pointer' }}
          >
            {submitting ? 'Scheduling...' : 'Confirm Appointment'}
          </button>
        </form>
      </div>
    </div>
  );
}

function NewTaskModal({ leads, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [dueDateTime, setDueDateTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 4);
    return d.toISOString().slice(0, 16);
  });
  const [leadId, setLeadId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const selectedLead = leads.find(l => l._id === leadId);
      await crmApi.createTask({
        title: title.trim(),
        priority,
        dueDateTime,
        customerId: selectedLead?.customerId || undefined,
        customerName: selectedLead?.customerName || undefined,
        unitCode: selectedLead?.unitCode || undefined
      });
      onCreated();
      onClose();
    } catch (err) {
      alert('Error creating task: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '14px', width: '100%', maxWidth: '420px', padding: '20px', color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>+ Add Task</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Task Title *</label>
            <Input
              type="text"
              required
              placeholder="e.g. Call regarding loan sanction letter"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Priority</label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ width: '100%', padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              >
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Due Date &amp; Time</label>
              <Input
                type="datetime-local"
                value={dueDateTime}
                onChange={(e) => setDueDateTime(e.target.value)}
                style={{ width: '100%', padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Linked Lead (Optional)</label>
            <Select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            >
              <option value="">None</option>
              {leads.map(l => (
                <option key={l._id} value={l._id}>{l.customerName} ({l.projectName || 'Lead'})</option>
              ))}
            </Select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', background: 'var(--accent)', color: 'var(--accent-contrast)', border: 'none', fontWeight: 700, cursor: 'pointer' }}
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </form>
      </div>
    </div>
  );
}
