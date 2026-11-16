import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import {
  LayoutGrid, List, Search, Plus, Filter, Phone, MessageSquare,
  ArrowRight, Ban, Eye, Download, Settings2, SlidersHorizontal,
  ChevronDown, ChevronUp, Check, AlertCircle, Clock, Building,
  DollarSign, User, Shield, HelpCircle, X, Lock, CheckCircle2
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { formatShortINR, formatINR } from '../../../utils/money';
import { Input, Select, Textarea } from '../../../components/ui';

export const DEFAULT_PIPELINE_STAGES = [
  { id: 'new', name: 'New enquiry', order: 1, color: "var(--accent)", is_won: false, is_lost: false },
  { id: 'contacted', name: 'Contacted', order: 2, color: '#6366f1', is_won: false, is_lost: false },
  { id: 'site_visit', name: 'Site visit', order: 3, color: '#8b5cf6', is_won: false, is_lost: false },
  { id: 'negotiation', name: 'Negotiation', order: 4, color: '#f59e0b', is_won: false, is_lost: false },
  { id: 'hold', name: 'Hold', order: 5, color: '#eab308', is_won: false, is_lost: false },
  { id: 'booked', name: 'Booked', order: 6, color: '#16a34a', is_won: true, is_lost: false },
  { id: 'lost', name: 'Lost', order: 7, color: '#ef4444', is_won: false, is_lost: true }
];

export default function LeadsBoard({
  leads = [],
  customers = [],
  projects = [],
  selectedProjectId,
  initialViewMode = 'table',
  onSelectLead,
  onOpenAddLead,
  onUpdateLeadStage,
  onConvertToBooking,
  onRefreshData
}) {
  // View mode: 'table' (Leads) or 'kanban' (Pipeline)
  const [viewMode, setViewMode] = useState(initialViewMode === 'kanban' ? 'kanban' : 'table');

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode === 'kanban' ? 'kanban' : 'table');
    }
  }, [initialViewMode]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [activeProjectTab, setActiveProjectTab] = useState(selectedProjectId || 'all');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'all' | 'won' | 'lost'
  const [sourceFilter, setSourceFilter] = useState('all');

  // Pagination & Column Virtualization States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [colLimits, setColLimits] = useState({});

  // Reset pagination when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchTerm, activeProjectTab, statusFilter, sourceFilter]);

  // Configured Pipeline Stages
  const [stages, setStages] = useState(DEFAULT_PIPELINE_STAGES);
  const [loadingStages, setLoadingStages] = useState(false);

  // Card Customisation Settings (Persisted in localStorage)
  const [cardCustomization, setCardCustomization] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_card_customization');
      if (saved) return JSON.parse(saved);
    } catch { }
    return {
      showBudget: true,
      showSource: true,
      showNextFollowup: true,
      showPhone: true,
      showSalesRep: true
    };
  });

  const [showCustomiseModal, setShowCustomiseModal] = useState(false);
  const [showEditStagesModal, setShowEditStagesModal] = useState(false);
  const [editStagesDraft, setEditStagesDraft] = useState([]);
  const [savingStages, setSavingStages] = useState(false);

  // Drag and drop state
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStageId, setDragOverStageId] = useState(null);

  // Mandatory Lost Dialog State
  const [lostDialogLead, setLostDialogLead] = useState(null);
  const [lostReasonInput, setLostReasonInput] = useState('');
  const [lostReasonCategory, setLostReasonCategory] = useState('');

  // Hold Confirmation State
  const [holdDialogLead, setHoldDialogLead] = useState(null);
  const [holdHoursInput, setHoldHoursInput] = useState(48);

  // Fetch configured stages from server
  useEffect(() => {
    const fetchStages = async () => {
      setLoadingStages(true);
      try {
        const res = await crmApi.getPipelineStages({
          projectId: activeProjectTab !== 'all' ? activeProjectTab : undefined
        });
        if (Array.isArray(res) && res.length > 0) {
          setStages(res.sort((a, b) => (a.order || 0) - (b.order || 0)));
        } else {
          setStages(DEFAULT_PIPELINE_STAGES);
        }
      } catch (err) {
        console.warn('Failed to load pipeline stages:', err);
        setStages(DEFAULT_PIPELINE_STAGES);
      } finally {
        setLoadingStages(false);
      }
    };
    fetchStages();
  }, [activeProjectTab]);

  // Save Card Customization
  const handleSaveCardCustomization = (newSettings) => {
    setCardCustomization(newSettings);
    try {
      localStorage.setItem('crm_card_customization', JSON.stringify(newSettings));
    } catch { }
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // 1. Project Filter
      if (activeProjectTab !== 'all') {
        const leadProj = String(lead.projectId?._id || lead.projectId || '');
        if (leadProj && leadProj !== String(activeProjectTab)) return false;
      }

      // 2. Status Filter
      const stageLower = (lead.stage || '').toLowerCase();
      const isWon = stageLower.includes('booked') || stageLower.includes('won');
      const isLost = stageLower.includes('lost');
      const isActive = !isWon && !isLost;

      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'won' && !isWon) return false;
      if (statusFilter === 'lost' && !isLost) return false;

      // 3. Source Filter
      if (sourceFilter !== 'all') {
        if (lead.leadSource !== sourceFilter) return false;
      }

      // 4. Search Filter (Using deferred search term for non-blocking UI)
      if (deferredSearchTerm && deferredSearchTerm.trim()) {
        const term = deferredSearchTerm.toLowerCase().trim();
        const name = (lead.customerName || lead.fullName || '').toLowerCase();
        const phone = (lead.customerPhone || lead.phone || '');
        const project = (lead.projectName || '').toLowerCase();
        const unit = (lead.unitCode || '').toLowerCase();
        const tags = Array.isArray(lead.tags) ? lead.tags.join(' ').toLowerCase() : '';
        const interest = (lead.interest || lead.preferredPropertyType || '').toLowerCase();

        return (
          name.includes(term) ||
          phone.includes(term) ||
          project.includes(term) ||
          unit.includes(term) ||
          tags.includes(term) ||
          interest.includes(term)
        );
      }

      return true;
    });
  }, [leads, activeProjectTab, statusFilter, sourceFilter, deferredSearchTerm]);

// Paginated leads slice for ultra-fast table rendering (50 per page instead of 7,000)
const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
const paginatedLeads = useMemo(() => {
  const start = (currentPage - 1) * pageSize;
  return filteredLeads.slice(start, start + pageSize);
}, [filteredLeads, currentPage, pageSize]);

// Aggregate Stats
const stats = useMemo(() => {
  let total = leads.length;
  let active = 0;
  let openValue = 0;

  leads.forEach(l => {
    const stageLower = (l.stage || '').toLowerCase();
    const isWon = stageLower.includes('booked') || stageLower.includes('won');
    const isLost = stageLower.includes('lost');
    if (!isWon && !isLost) {
      active++;
      openValue += (Number(l.budget) || 0);
    }
  });

  return { total, active, openValue };
}, [leads]);

// Distinct Sources for filter dropdown
const distinctSources = useMemo(() => {
  const s = new Set();
  leads.forEach(l => {
    if (l.leadSource) s.add(l.leadSource);
  });
  return Array.from(s);
}, [leads]);

// CSV Export Handler
const handleExportCsv = () => {
  if (filteredLeads.length === 0) {
    alert('No leads to export.');
    return;
  }

  const headers = [
    'Lead Name',
    'Phone',
    'Project',
    'Stage',
    'Typology',
    'Budget (INR)',
    'Lead Source',
    'Next Follow-up',
    'Sales Rep',
    'Notes'
  ];

  const rows = filteredLeads.map(l => [
    `"${(l.customerName || l.fullName || '').replace(/"/g, '""')}"`,
    `"${(l.customerPhone || l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.projectName || '').replace(/"/g, '""')}"`,
    `"${(l.stage || '').replace(/"/g, '""')}"`,
    `"${(l.interest || l.preferredPropertyType || '').replace(/"/g, '""')}"`,
    l.budget || 0,
    `"${(l.leadSource || '').replace(/"/g, '""')}"`,
    `"${l.next_followup_at || l.nextFollowUpDate || ''}"`,
    `"${(l.assignedSalespersonName || 'Sales Team').replace(/"/g, '""')}"`,
    `"${(l.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ── DRAG AND DROP HANDLERS ────────────────────────────────────────────────
const handleDragStart = (e, lead) => {
  setDraggedLead(lead);
  e.dataTransfer.setData('text/plain', lead._id);
  e.dataTransfer.effectAllowed = 'move';
};

const handleDragOver = (e, stageId) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (dragOverStageId !== stageId) {
    setDragOverStageId(stageId);
  }
};

const handleDragLeave = (e, stageId) => {
  if (dragOverStageId === stageId) {
    setDragOverStageId(null);
  }
};

const handleDrop = async (e, targetStage) => {
  e.preventDefault();
  setDragOverStageId(null);
  if (!draggedLead) return;

  const currentStageName = draggedLead.stage || '';
  if (currentStageName === targetStage.name) {
    setDraggedLead(null);
    return;
  }

  const stageNameLower = targetStage.name.toLowerCase();

  // 1. Drop into 'Hold' -> triggers 48h hold flow
  if (stageNameLower.includes('hold')) {
    setHoldDialogLead(draggedLead);
    setDraggedLead(null);
    return;
  }

  // 2. Drop into 'Booked' -> triggers booking wizard
  if (targetStage.is_won || stageNameLower.includes('booked')) {
    if (onConvertToBooking) {
      onConvertToBooking(draggedLead);
    }
    setDraggedLead(null);
    return;
  }

  // 3. Drop into 'Lost' -> mandatory lost reason dialog
  if (targetStage.is_lost || stageNameLower.includes('lost')) {
    setLostDialogLead(draggedLead);
    setDraggedLead(null);
    return;
  }

  // Normal stage advance
  try {
    await onUpdateLeadStage(draggedLead._id, targetStage.name);
  } catch (err) {
    alert('Failed to update lead stage: ' + err.message);
  } finally {
    setDraggedLead(null);
  }
};

// Confirm Lost Reason
const handleConfirmLost = async () => {
  if (!lostDialogLead || !lostReasonCategory) {
    alert('Please select a mandatory lost reason category.');
    return;
  }
  const finalReason = lostReasonInput.trim()
    ? `${lostReasonCategory}: ${lostReasonInput.trim()}`
    : lostReasonCategory;

  try {
    await onUpdateLeadStage(lostDialogLead._id, 'Lost', finalReason);
    setLostDialogLead(null);
    setLostReasonCategory('');
    setLostReasonInput('');
  } catch (err) {
    alert('Failed to mark lead as lost: ' + err.message);
  }
};

// Confirm Hold
const handleConfirmHold = async () => {
  if (!holdDialogLead) return;
  try {
    if (holdDialogLead.unitId) {
      await crmApi.reserveUnit(holdDialogLead.unitId, {
        holdHours: holdHoursInput || 48,
        notes: `Hold executed from pipeline card for ${holdDialogLead.customerName}`
      });
    }
    await onUpdateLeadStage(holdDialogLead._id, 'Hold');
    setHoldDialogLead(null);
  } catch (err) {
    alert('Hold error: ' + err.message);
  }
};

// Open Edit Stages Modal
const handleOpenEditStages = () => {
  setEditStagesDraft(JSON.parse(JSON.stringify(stages)));
  setShowEditStagesModal(true);
};

// Save Pipeline Stages
const handleSaveStages = async () => {
  setSavingStages(true);
  try {
    const sanitized = editStagesDraft.map((st, idx) => ({
      ...st,
      order: idx + 1,
      name: st.name.trim() || `Stage ${idx + 1}`
    }));
    await crmApi.updatePipelineStages({
      projectId: activeProjectTab !== 'all' ? activeProjectTab : undefined,
      stages: sanitized
    });
    setStages(sanitized);
    setShowEditStagesModal(false);
  } catch (err) {
    alert('Failed to save pipeline stages: ' + err.message);
  } finally {
    setSavingStages(false);
  }
};

return (
  <div className="crm-leads-screen" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {/* ── 1. TOP PIPELINE PROJECT TABS STRIP ────────────────────────────── */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      overflowX: 'auto',
      paddingBottom: '4px',
      borderBottom: "1px solid var(--card-border)"
    }}>
      <button
        type="button"
        onClick={() => setActiveProjectTab('all')}
        style={{
          padding: '6px 14px',
          borderRadius: '8px',
          border: 'none',
          background: activeProjectTab === 'all' ? '#38bdf8' : '#1e293b',
          color: activeProjectTab === 'all' ? '#0f172a' : 'var(--text-secondary)',
          fontSize: '0.82rem',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <span>All Projects</span>
        <span style={{
          background: activeProjectTab === 'all' ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.08)',
          padding: '1px 6px',
          borderRadius: '10px',
          fontSize: '0.72rem'
        }}>
          {leads.length}
        </span>
      </button>

      {projects.map(p => {
        const pId = String(p._id || p.id);
        const pCount = leads.filter(l => String(l.projectId?._id || l.projectId || '') === pId).length;
        const isSelected = activeProjectTab === pId;

        return (
          <button
            key={pId}
            type="button"
            onClick={() => setActiveProjectTab(pId)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: isSelected ? '#38bdf8' : '#1e293b',
              color: isSelected ? '#0f172a' : 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: isSelected ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{p.name}</span>
            <span style={{
              background: isSelected ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.08)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.72rem'
            }}>
              {pCount}
            </span>
          </button>
        );
      })}
    </div>

    {/* ── 2. METRICS & CONTROL HEADER ──────────────────────────────────── */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Left: Headline Metric */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: "var(--text-primary)", letterSpacing: '-0.2px' }}>
            {stats.total} total · <span style={{ color: "var(--accent)" }}>{stats.active} active</span>
            {stats.openValue > 0 && (
              <span style={{ fontSize: '0.88rem', color: '#34d399', fontWeight: 600, marginLeft: '8px' }}>
                • ₹{formatShortINR(stats.openValue)} open value
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.76rem', color: "var(--text-secondary)" }}>
            Real estate sales funnel &amp; buyer inquiries
          </div>
        </div>
      </div>

      {/* Right: Search, Filter, View Mode, Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Search box */}
        <div style={{
          position: 'relative',
          background: "var(--input-bg)",
          borderRadius: '8px',
          border: "1px solid var(--card-border)",
          padding: '4px 8px 4px 28px',
          display: 'flex',
          alignItems: 'center',
          width: '200px'
        }}>
          <Search size={14} color="var(--text-secondary)" style={{ position: 'absolute', left: '8px' }} />
          <Input
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: "var(--text-primary)", fontSize: '0.8rem', width: '100%', outline: 'none' }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer', padding: 0 }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status Tabs */}
        <div style={{ display: 'flex', background: "var(--input-bg)", borderRadius: '8px', padding: '2px', border: "1px solid var(--card-border)" }}>
          {[
            { key: 'active', label: 'Active' },
            { key: 'all', label: 'All' },
            { key: 'won', label: 'Won' },
            { key: 'lost', label: 'Lost' }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: statusFilter === tab.key ? '#38bdf8' : 'transparent',
                color: statusFilter === tab.key ? '#0f172a' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: statusFilter === tab.key ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Lead Source Filter */}
        {distinctSources.length > 0 && (
          <Select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              background: "var(--input-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: '8px',
              color: "var(--text-primary)",
              fontSize: '0.78rem'
            }}
          >
            <option value="all">All Sources</option>
            {distinctSources.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        )}

        {/* View Mode Toggle (Table / Board) */}
        <div style={{ display: 'flex', background: "var(--input-bg)", borderRadius: '8px', padding: '2px', border: "1px solid var(--card-border)" }}>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              padding: '5px 8px',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'table' ? '#38bdf8' : 'transparent',
              color: viewMode === 'table' ? '#0f172a' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
            title="Table View"
          >
            <List size={14} /> Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            style={{
              padding: '5px 8px',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'kanban' ? '#38bdf8' : 'transparent',
              color: viewMode === 'kanban' ? '#0f172a' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
            title="Kanban Pipeline Board"
          >
            <LayoutGrid size={14} /> Board
          </button>
        </div>

        {/* Customise Cards (for Kanban view) */}
        {viewMode === 'kanban' && (
          <button
            type="button"
            onClick={() => setShowCustomiseModal(true)}
            style={{
              padding: '6px 10px',
              background: "var(--input-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: '8px',
              color: "var(--text-primary)",
              cursor: 'pointer',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Customise card details"
          >
            <SlidersHorizontal size={13} /> Customise cards
          </button>
        )}

        {/* Edit Stages */}
        {viewMode === 'kanban' && (
          <button
            type="button"
            onClick={handleOpenEditStages}
            style={{
              padding: '6px 10px',
              background: "var(--input-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: '8px',
              color: "var(--text-primary)",
              cursor: 'pointer',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Configure Kanban stages"
          >
            <Settings2 size={13} /> Edit stages
          </button>
        )}

        {/* Export CSV */}
        <button
          type="button"
          onClick={handleExportCsv}
          style={{
            padding: '6px 10px',
            background: "var(--input-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: '8px',
            color: "var(--text-primary)",
            cursor: 'pointer',
            fontSize: '0.76rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Download CSV"
        >
          <Download size={13} /> Export CSV
        </button>

        {/* Primary CTA: Add Lead */}
        <button
          type="button"
          onClick={onOpenAddLead}
          style={{
            padding: '6px 14px',
            background: "var(--accent)",
            border: 'none',
            borderRadius: '8px',
            color: '#0f172a',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Plus size={15} /> Add Lead
        </button>
      </div>
    </div>

    {/* ── 3. VIEW MODE RENDER: TABLE OR KANBAN ─────────────────────────── */}
    {viewMode === 'table' ? (
      /* ══════════════════════════════════════════════════════════════════════
         TABLE VIEW
         ══════════════════════════════════════════════════════════════════════ */
      <div style={{
        background: "var(--card-bg)",
        borderRadius: '12px',
        border: "1px solid var(--card-border)",
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: "var(--input-bg)", color: "var(--text-secondary)", borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Lead</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Project &amp; Stage</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Interested In</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Budget</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Source</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Next Follow-up</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.map(lead => {
                const name = lead.customerName || lead.fullName || 'Unnamed Lead';
                    const phone = lead.customerPhone || lead.phone || '';
                    const cleanPhone = phone.replace(/[^\d]/g, '');
                    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'LD';

                    // Overdue check
                    const followUpDate = lead.next_followup_at || lead.nextFollowUpDate;
                    const isOverdue = followUpDate && new Date(followUpDate) < new Date();

                    // Stage styling
                    const stageObj = stages.find(s => s.name.toLowerCase() === (lead.stage || '').toLowerCase());
                    const stageColor = stageObj?.color || '#38bdf8';

                    return (
                      <tr
                        key={lead._id}
                        onClick={() => onSelectLead(lead)}
                        style={{
                          borderBottom: "1px solid var(--card-border)",
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Lead Identity */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: "var(--input-bg)",
                              color: "var(--accent)",
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              flexShrink: 0
                            }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{name}</div>
                              <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)" }}>{phone}</div>
                            </div>
                          </div>
                        </td>

                        {/* Project & Stage */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{lead.projectName || 'General Inquiry'}</div>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: `${stageColor}22`,
                            color: stageColor,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            marginTop: '3px'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: stageColor }} />
                            {lead.stage || 'New'}
                          </span>
                        </td>

                        {/* Typology */}
                        <td style={{ padding: '10px 14px', color: "var(--text-secondary)" }}>
                          {lead.interest || lead.preferredPropertyType || '2BHK'}
                        </td>

                        {/* Budget */}
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#34d399' }}>
                          {lead.budget ? `₹${formatShortINR(lead.budget)}` : 'Flexible'}
                        </td>

                        {/* Source */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: "var(--input-bg)",
                            color: "var(--text-secondary)",
                            fontSize: '0.72rem',
                            border: "1px solid var(--card-border)"
                          }}>
                            {lead.leadSource || 'Direct'}
                          </span>
                        </td>

                        {/* Next Follow-up */}
                        <td style={{ padding: '10px 14px' }}>
                          {followUpDate ? (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isOverdue ? '#ef4444' : 'var(--text-secondary)',
                              fontWeight: isOverdue ? 700 : 500,
                              fontSize: '0.76rem'
                            }}>
                              <Clock size={12} />
                              <span>
                                {new Date(followUpDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                {isOverdue && ' (Overdue)'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.74rem' }}>No date set</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {phone && (
                              <>
                                <a
                                  href={`tel:${phone}`}
                                  style={{
                                    padding: '5px',
                                    background: "var(--input-bg)",
                                    border: "1px solid var(--card-border)",
                                    borderRadius: '6px',
                                    color: "var(--accent)",
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title="Call lead"
                                >
                                  <Phone size={13} />
                                </a>
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    padding: '5px',
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    border: '1px solid #22c55e',
                                    borderRadius: '6px',
                                    color: '#22c55e',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title="WhatsApp chat"
                                >
                                  <MessageSquare size={13} />
                                </a>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectLead(lead)}
                              style={{
                                padding: '4px 8px',
                                background: "var(--input-bg)",
                                border: 'none',
                                borderRadius: '6px',
                                color: "var(--text-primary)",
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Dossier
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }

                {
                  filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: "var(--text-secondary)" }}>
                        <Building size={36} color="#334155" style={{ margin: '0 auto 10px' }} />
                        <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>No leads match current filters</div>
                        <div style={{ fontSize: '0.76rem', marginTop: '4px' }}>Click "+ Add Lead" above to register a prospective buyer.</div>
                      </td>
                    </tr>
                  )
                }
              </tbody>
          </table>
        </div>

        {/* ── PAGINATION TOOLBAR ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: "var(--card-bg)",
          borderTop: "1px solid var(--card-border)",
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.82rem',
          color: "var(--text-secondary)"
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Showing</span>
            <strong style={{ color: "var(--text-primary)" }}>
              {filteredLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>
            <span>–</span>
            <strong style={{ color: "var(--text-primary)" }}>
              {Math.min(currentPage * pageSize, filteredLeads.length)}
            </strong>
            <span>of</span>
            <strong style={{ color: "var(--accent)" }}>{filteredLeads.length.toLocaleString()}</strong>
            <span>leads</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Rows per page:</span>
              <Select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--card-border)",
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </Select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: "1px solid var(--card-border)",
                  background: currentPage <= 1 ? 'transparent' : '#1e293b',
                  color: currentPage <= 1 ? '#475569' : '#f8fafc',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
                title="First page"
              >
                « First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage <= 1}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: "1px solid var(--card-border)",
                  background: currentPage <= 1 ? 'transparent' : '#1e293b',
                  color: currentPage <= 1 ? '#475569' : '#f8fafc',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
              >
                ‹ Prev
              </button>
              <span style={{ padding: '0 8px', color: "var(--text-secondary)", fontWeight: 600, fontSize: '0.8rem' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: "1px solid var(--card-border)",
                  background: currentPage >= totalPages ? 'transparent' : '#1e293b',
                  color: currentPage >= totalPages ? '#475569' : '#f8fafc',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: "1px solid var(--card-border)",
                  background: currentPage >= totalPages ? 'transparent' : '#1e293b',
                  color: currentPage >= totalPages ? '#475569' : '#f8fafc',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
                title="Last page"
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : (
      /* ══════════════════════════════════════════════════════════════════════
         KANBAN PIPELINE BOARD VIEW
         ══════════════════════════════════════════════════════════════════════ */
      <div className="crm-kanban-board" style={{
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '16px',
        minHeight: 'calc(100vh - 280px)'
      }}>
        {stages.map(col => {
          const colLeads = filteredLeads.filter(l => (l.stage || '').toLowerCase() === col.name.toLowerCase());
          const colBudgetSum = colLeads.reduce((sum, l) => sum + (Number(l.budget) || 0), 0);
          const isDragOver = dragOverStageId === col.id;
          const colLimit = colLimits[col.id || col.name] || 30;
          const visibleColLeads = colLeads.slice(0, colLimit);
          const hasMoreCards = colLeads.length > visibleColLeads.length;

          return (
            <div
              key={col.id || col.name}
              className={`crm-kanban-column ${isDragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col)}
              style={{
                flex: '0 0 290px',
                background: isDragOver ? 'rgba(56, 189, 248, 0.08)' : '#0f172a',
                border: isDragOver ? '2px dashed #38bdf8' : '1px solid #1e293b',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 280px)',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Column Header */}
              <div style={{
                padding: '12px 14px',
                borderBottom: "1px solid var(--card-border)",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color || '#38bdf8' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: "var(--text-primary)" }}>
                    {col.name}
                  </span>
                  <span style={{
                    background: "var(--input-bg)",
                    color: "var(--text-secondary)",
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px'
                  }}>
                    {colLeads.length}
                  </span>
                </div>
                {colBudgetSum > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                    ₹{formatShortINR(colBudgetSum)}
                  </span>
                )}
              </div>

              {/* Cards List Slot */}
              <div style={{
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                overflowY: 'auto',
                flex: 1
              }}>
                {visibleColLeads.map(lead => {
                  const name = lead.customerName || lead.fullName || 'Unnamed Lead';
                      const phone = lead.customerPhone || lead.phone || '';
                      const cleanPhone = phone.replace(/[^\d]/g, '');
                      const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'LD';

                      const followUpDate = lead.next_followup_at || lead.nextFollowUpDate;
                      const isOverdue = followUpDate && new Date(followUpDate) < new Date();
                      const isBeingDragged = draggedLead?._id === lead._id;

                      return (
                        <div
                          key={lead._id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, lead)}
                          onClick={() => onSelectLead(lead)}
                          className={`crm-kanban-card ${isBeingDragged ? 'dragging' : ''}`}
                          style={{
                            background: "var(--input-bg)",
                            border: "1px solid var(--card-border)",
                            borderRadius: '8px',
                            padding: '12px',
                            cursor: 'grab',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            opacity: isBeingDragged ? 0.4 : 1,
                            transition: 'transform 0.15s ease, border-color 0.15s ease'
                          }}
                        >
                          {/* Top: Name, Typology & Action Menu */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: "var(--input-bg)",
                                color: "var(--accent)",
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                flexShrink: 0
                              }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: "var(--text-primary)" }}>{name}</div>
                                <div style={{ fontSize: '0.72rem', color: "var(--text-secondary)" }}>{lead.projectName || 'General Inquiry'}</div>
                              </div>
                            </div>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: "var(--card-bg)",
                              color: "var(--text-secondary)",
                              fontSize: '0.68rem',
                              fontWeight: 600
                            }}>
                              {lead.interest || lead.preferredPropertyType || '2BHK'}
                            </span>
                          </div>

                          {/* Middle: Optional Customized Fields */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', fontSize: '0.72rem' }}>
                            {cardCustomization.showBudget && lead.budget && (
                              <span style={{ color: '#34d399', fontWeight: 700 }}>
                                ₹{formatShortINR(lead.budget)}
                              </span>
                            )}

                            {cardCustomization.showSource && lead.leadSource && (
                              <span style={{ padding: '1px 6px', background: "var(--card-bg)", borderRadius: '4px', color: "var(--text-secondary)" }}>
                                {lead.leadSource}
                              </span>
                            )}

                            {cardCustomization.showSalesRep && lead.assignedSalespersonName && (
                              <span style={{ color: '#64748b' }}>
                                • {lead.assignedSalespersonName}
                              </span>
                            )}
                          </div>

                          {/* Follow-up reminder strip */}
                          {cardCustomization.showNextFollowup && followUpDate && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.72rem',
                              color: isOverdue ? '#ef4444' : 'var(--text-secondary)',
                              fontWeight: isOverdue ? 700 : 500,
                              background: isOverdue ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                              padding: isOverdue ? '2px 6px' : '0',
                              borderRadius: '4px'
                            }}>
                              <Clock size={11} />
                              <span>
                                {new Date(followUpDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                {isOverdue && ' (Overdue)'}
                              </span>
                            </div>
                          )}

                          {/* Footer Communication Strip */}
                          {cardCustomization.showPhone && phone && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingTop: '6px',
                                borderTop: '1px solid #334155',
                                marginTop: '2px'
                              }}
                            >
                              <span style={{ fontSize: '0.72rem', color: "var(--text-secondary)" }}>{phone}</span>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <a
                                  href={`tel:${phone}`}
                                  style={{
                                    padding: '4px 6px',
                                    background: "var(--card-bg)",
                                    borderRadius: '4px',
                                    color: "var(--accent)",
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                  title="Call"
                                >
                                  <Phone size={11} />
                                </a>
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    padding: '4px 6px',
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    borderRadius: '4px',
                                    color: '#22c55e',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                  title="WhatsApp"
                                >
                                  <MessageSquare size={11} />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {
                    hasMoreCards && (
                      <button
                        type="button"
                        onClick={() => setColLimits(prev => ({
                          ...prev,
                          [col.id || col.name]: (prev[col.id || col.name] || 30) + 30
                        }))}
                        style={{
                          padding: '8px 12px',
                          background: "var(--input-bg)",
                          border: '1px dashed #38bdf8',
                          borderRadius: '6px',
                          color: "var(--accent)",
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'center',
                          marginTop: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        + Load 30 more ({colLeads.length - visibleColLeads.length} remaining)
                      </button>
                    )
                  }

                  {
                    colLeads.length === 0 && (
                      <div style={{
                        textAlign: 'center',
                        padding: '24px 12px',
                        color: '#64748b',
                        fontSize: '0.75rem',
                        border: '1px dashed #1e293b',
                        borderRadius: '8px'
                      }}>
                        Drop lead here
                      </div>
                    )
                  }
                </div>
            </div>
          );
        })}
      </div>
    )}

    {/* ── 4. CUSTOMISE CARDS MODAL ─────────────────────────────────────── */}
    {showCustomiseModal && (
      <div className="crm-modal-overlay" onClick={() => setShowCustomiseModal(false)}>
        <div className="crm-modal-container" onClick={e => e.stopPropagation()} style={{
          background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '14px', width: '100%', maxWidth: '380px', padding: '20px', color: "var(--text-primary)"
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <SlidersHorizontal size={16} color="var(--accent)" /> Customise Kanban Cards
            </h3>
            <button type="button" onClick={() => setShowCustomiseModal(false)} style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { key: 'showBudget', label: 'Show Budget & Open Value' },
              { key: 'showSource', label: 'Show Lead Source badge' },
              { key: 'showNextFollowup', label: 'Show Next Follow-up & Overdue badge' },
              { key: 'showPhone', label: 'Show Phone & Call/WhatsApp buttons' },
              { key: 'showSalesRep', label: 'Show Assigned Sales Rep' }
            ].map(item => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', cursor: 'pointer' }}>
                <Input
                  type="checkbox"
                  checked={cardCustomization[item.key]}
                  onChange={e => handleSaveCardCustomization({
                    ...cardCustomization,
                    [item.key]: e.target.checked
                  })}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowCustomiseModal(false)}
              style={{ padding: '6px 14px', background: "var(--accent)", color: "var(--accent-contrast)", border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── 5. EDIT STAGES MODAL ─────────────────────────────────────────── */}
    {showEditStagesModal && (
      <div className="crm-modal-overlay" onClick={() => setShowEditStagesModal(false)}>
        <div className="crm-modal-container" onClick={e => e.stopPropagation()} style={{
          background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', width: '100%', maxWidth: '540px', padding: '20px', color: "var(--text-primary)", maxHeight: '85vh', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Configure Pipeline Stages</h3>
              <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)" }}>Rename, reorder, or customize stage colors</div>
            </div>
            <button type="button" onClick={() => setShowEditStagesModal(false)} style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          {/* Stages List */}
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {editStagesDraft.map((st, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: "var(--input-bg)",
                padding: '8px 10px',
                borderRadius: '8px',
                border: "1px solid var(--card-border)"
              }}>
                {/* Color Picker */}
                <Input
                  type="color"
                  value={st.color || '#38bdf8'}
                  onChange={e => {
                    const updated = [...editStagesDraft];
                    updated[idx].color = e.target.value;
                    setEditStagesDraft(updated);
                  }}
                  style={{ width: '26px', height: '26px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  title="Change stage color"
                />

                {/* Stage Name */}
                <Input
                  type="text"
                  value={st.name}
                  onChange={e => {
                    const updated = [...editStagesDraft];
                    updated[idx].name = e.target.value;
                    setEditStagesDraft(updated);
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                    borderRadius: '6px',
                    color: "var(--text-primary)",
                    fontSize: '0.82rem'
                  }}
                />

                {/* Reorder Up / Down */}
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => {
                    const updated = [...editStagesDraft];
                    const temp = updated[idx - 1];
                    updated[idx - 1] = updated[idx];
                    updated[idx] = temp;
                    setEditStagesDraft(updated);
                  }}
                  style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: idx === 0 ? '#475569' : '#f8fafc', borderRadius: '4px', padding: '3px 6px', cursor: idx === 0 ? 'default' : 'pointer' }}
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  disabled={idx === editStagesDraft.length - 1}
                  onClick={() => {
                    const updated = [...editStagesDraft];
                    const temp = updated[idx + 1];
                    updated[idx + 1] = updated[idx];
                    updated[idx] = temp;
                    setEditStagesDraft(updated);
                  }}
                  style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: idx === editStagesDraft.length - 1 ? '#475569' : '#f8fafc', borderRadius: '4px', padding: '3px 6px', cursor: idx === editStagesDraft.length - 1 ? 'default' : 'pointer' }}
                >
                  <ChevronDown size={12} />
                </button>

                {/* Delete (if non-core) */}
                {!['hold', 'booked', 'lost'].includes(st.id) && (
                  <button
                    type="button"
                    onClick={() => setEditStagesDraft(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    title="Remove stage"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Custom Stage */}
          <div style={{ marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setEditStagesDraft(prev => [
                ...prev,
                {
                  id: `custom_${Date.now()}`,
                  name: 'New Custom Stage',
                  order: prev.length + 1,
                  color: '#6366f1',
                  is_won: false,
                  is_lost: false
                }
              ])}
              style={{ padding: '6px 12px', background: "var(--input-bg)", border: '1px dashed #334155', borderRadius: '6px', color: "var(--accent)", fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, width: '100%' }}
            >
              + Add Stage
            </button>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', paddingTop: '10px', borderTop: "1px solid var(--card-border)" }}>
            <button
              type="button"
              onClick={() => setShowEditStagesModal(false)}
              style={{ padding: '6px 14px', background: "var(--input-bg)", color: "var(--text-primary)", border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingStages}
              onClick={handleSaveStages}
              style={{ padding: '6px 16px', background: "var(--accent)", color: "var(--accent-contrast)", border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {savingStages ? 'Saving...' : 'Save Stages'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── 6. MANDATORY LOST REASON DIALOG ──────────────────────────────── */}
    {lostDialogLead && (
      <div className="crm-modal-overlay" onClick={() => setLostDialogLead(null)}>
        <div className="crm-modal-container" onClick={e => e.stopPropagation()} style={{
          background: "var(--card-bg)", border: '1px solid #ef4444', borderRadius: '14px', width: '100%', maxWidth: '420px', padding: '20px', color: "var(--text-primary)"
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 700, fontSize: '1rem' }}>
              <Ban size={18} /> Mark Lead as Lost
            </div>
            <button type="button" onClick={() => setLostDialogLead(null)} style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          <p style={{ fontSize: '0.82rem', color: "var(--text-secondary)", margin: '0 0 12px' }}>
            Please record why <strong>{lostDialogLead.customerName || lostDialogLead.fullName}</strong> was marked Lost (mandatory for analytics):
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.74rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Primary Reason Category *</label>
              <Select
                value={lostReasonCategory}
                onChange={e => setLostReasonCategory(e.target.value)}
                style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.82rem' }}
              >
                <option value="">Select reason...</option>
                <option value="Budget Mismatch">Budget Mismatch</option>
                <option value="Location / Micro-market Dislike">Location / Micro-market Dislike</option>
                <option value="Bought Competitor Project">Bought Competitor Project</option>
                <option value="Home Loan Rejected">Home Loan Pre-approval Rejected</option>
                <option value="Postponed Decision (6+ mo)">Postponed Decision (6+ months)</option>
                <option value="Unreachable / Invalid Contact">Unreachable / Invalid Contact</option>
                <option value="Looking for Ready Possession">Looking for Ready Possession</option>
                <option value="Other">Other</option>
              </Select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Additional Feedback / Context</label>
              <Textarea
                rows={2}
                placeholder="e.g. Purchased in Godrej Woods instead due to immediate possession."
                value={lostReasonInput}
                onChange={e => setLostReasonInput(e.target.value)}
                style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setLostDialogLead(null)}
              style={{ padding: '6px 12px', background: "var(--input-bg)", color: "var(--text-primary)", border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!lostReasonCategory}
              onClick={handleConfirmLost}
              style={{ padding: '6px 16px', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Confirm Lost
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── 7. HOLD CONFIRMATION DIALOG ──────────────────────────────────── */}
    {holdDialogLead && (
      <div className="crm-modal-overlay" onClick={() => setHoldDialogLead(null)}>
        <div className="crm-modal-container" onClick={e => e.stopPropagation()} style={{
          background: "var(--card-bg)", border: '1px solid #eab308', borderRadius: '14px', width: '100%', maxWidth: '420px', padding: '20px', color: "var(--text-primary)"
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#eab308', fontWeight: 700, fontSize: '1rem' }}>
              <Lock size={18} /> Place Unit on Hold (48h Atomic Hold)
            </div>
            <button type="button" onClick={() => setHoldDialogLead(null)} style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          <p style={{ fontSize: '0.82rem', color: "var(--text-secondary)", margin: '0 0 12px' }}>
            Place unit reservation for <strong>{holdDialogLead.customerName || holdDialogLead.fullName}</strong>.
            Units on hold automatically expire after 48 hours unless converted or released.
          </p>

          <div>
            <label style={{ fontSize: '0.74rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Hold Duration (Hours)</label>
            <Select
              value={holdHoursInput}
              onChange={e => setHoldHoursInput(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.82rem' }}
            >
              <option value={24}>24 Hours</option>
              <option value={48}>48 Hours (Standard)</option>
              <option value={72}>72 Hours</option>
            </Select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setHoldDialogLead(null)}
              style={{ padding: '6px 12px', background: "var(--input-bg)", color: "var(--text-primary)", border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmHold}
              style={{ padding: '6px 16px', background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Execute 48h Hold
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}

