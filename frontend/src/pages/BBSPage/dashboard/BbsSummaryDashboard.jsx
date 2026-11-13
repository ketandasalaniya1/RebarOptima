import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setView } from '../../../store/slices/routingSlice';
import { bbsApi } from '../bbsApi';
import { exportSummaryToPdf } from './summaryPdfExport';
import { exportSummaryToExcel, exportSummaryToCsv } from './summaryExcelExport';
import { pushBbsToCuttingOptimizer } from '../workspaces/common/optimizerBridge';
import BbsFilterSidebar from './BbsFilterSidebar';
import BbsKpiCards from './BbsKpiCards';
import BbsAnalyticsSection from './BbsAnalyticsSection';
import BbsDetailedTable from './BbsDetailedTable';
import LoadingSpinner from '../../../components/LoadingSpinner/LoadingSpinner';
import { FileText, Download, Scissors, RefreshCw, X, ArrowLeft, BarChart3, AlertCircle } from 'lucide-react';
import './BbsSummaryDashboard.css';

const MEMBER_TYPE_MAP = {
  COLUMN: { label: 'Column', matches: ['COLUMN', 'PEDESTAL'] },
  BEAM: { label: 'Beam', matches: ['BEAM', 'TIE BEAM', 'PLINTH BEAM'] },
  SLAB: { label: 'Slab', matches: ['SLAB', 'GRADE SLAB'] },
  FOOTING: { label: 'Footing', matches: ['FOOTING', 'ISOLATED FOOTING', 'COMBINED FOOTING', 'RAFT'] },
  RETAINING_WALL: { label: 'Retaining Wall', matches: ['RETAINING WALL', 'SHEAR WALL', 'WALL'] }
};

export default function BbsSummaryDashboard({
  project,
  onNavigateToMember,
  onClose
}) {
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    project: null,
    blocks: [],
    levels: [],
    members: [],
    instances: []
  });

  // ════════════════════════════════════════════════════════════════════════════
  // FILTER STATES (E-COMMERCE MULTI-FACET FILTER ENGINE)
  // ════════════════════════════════════════════════════════════════════════════
  const [selectedBlocks, setSelectedBlocks] = useState(new Set());
  const [selectedLevels, setSelectedLevels] = useState(new Set());
  const [selectedMemberTypes, setSelectedMemberTypes] = useState(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Load project dashboard data
  const loadData = useCallback(async () => {
    const projId = project?._id || project?.id;
    if (!projId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await bbsApi.getSummaryDashboardData(projId);
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load BBS Summary Dashboard data:', err);
      setError(err.message || 'Error loading BBS Summary data');
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lookup maps
  const { blockMap, levelMap, memberMap } = useMemo(() => {
    const bMap = new Map();
    (dashboardData.blocks || []).forEach(b => bMap.set(String(b._id || b.id), b));

    const lMap = new Map();
    (dashboardData.levels || []).forEach(l => lMap.set(String(l._id || l.id), l));

    const mMap = new Map();
    (dashboardData.members || []).forEach(m => mMap.set(String(m._id || m.id), m));

    return { blockMap: bMap, levelMap: lMap, memberMap: mMap };
  }, [dashboardData]);

  // Calculated members (only members with committed active revisions)
  const calculatedMembers = useMemo(() => {
    return (dashboardData.members || []).filter(
      m => m.activeRevision && String(m.activeRevision).trim() !== ''
    );
  }, [dashboardData.members]);

  // ════════════════════════════════════════════════════════════════════════════
  // UPSTREAM / DOWNSTREAM AUTO-CASCADING INTEGRITY
  // When upstream filters change, prune invalid downstream selections
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // If selected levels belong to blocks that are no longer selected, prune them
    if (selectedBlocks.size > 0 && selectedLevels.size > 0) {
      const validLevelIds = new Set(
        (dashboardData.levels || [])
          .filter(l => selectedBlocks.has(String(l.blockId)))
          .map(l => String(l._id || l.id))
      );
      setSelectedLevels(prev => {
        const next = new Set();
        prev.forEach(id => {
          if (validLevelIds.has(id)) next.add(id);
        });
        return next.size === prev.size ? prev : next;
      });
    }
  }, [selectedBlocks, dashboardData.levels]);

  // ════════════════════════════════════════════════════════════════════════════
  // INSTANT DYNAMIC FILTER PREDICATE (Pure in-memory calculation)
  // ════════════════════════════════════════════════════════════════════════════
  const filteredMembers = useMemo(() => {
    return calculatedMembers.filter(m => {
      // 1. Block Filter
      if (selectedBlocks.size > 0 && !selectedBlocks.has(String(m.blockId))) {
        return false;
      }
      // 2. Floor / Level Filter
      if (selectedLevels.size > 0 && !selectedLevels.has(String(m.levelId))) {
        return false;
      }
      // 3. Member Type Filter
      if (selectedMemberTypes.size > 0) {
        const typeKey = (m.memberType || '').toUpperCase();
        const matchesAny = Array.from(selectedMemberTypes).some(typeId => {
          const config = MEMBER_TYPE_MAP[typeId];
          return config && config.matches.some(p => typeKey.includes(p));
        });
        if (!matchesAny) return false;
      }
      // 4. Specific Member Selection Filter
      if (selectedMemberIds.size > 0 && !selectedMemberIds.has(String(m._id || m.id))) {
        return false;
      }
      return true;
    });
  }, [calculatedMembers, selectedBlocks, selectedLevels, selectedMemberTypes, selectedMemberIds]);

  const filteredMemberIdSet = useMemo(() => {
    return new Set(filteredMembers.map(m => String(m._id || m.id)));
  }, [filteredMembers]);

  // ════════════════════════════════════════════════════════════════════════════
  // FILTERED ACTIVE REVISION INSTANCES
  // ════════════════════════════════════════════════════════════════════════════
  const filteredInstances = useMemo(() => {
    return (dashboardData.instances || []).filter(inst =>
      filteredMemberIdSet.has(String(inst.memberId))
    );
  }, [dashboardData.instances, filteredMemberIdSet]);

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY KPI METRICS
  // ════════════════════════════════════════════════════════════════════════════
  const kpis = useMemo(() => {
    const totalMembers = filteredMembers.length;
    let totalPieces = 0;
    let totalLengthM = 0;
    let totalWeightKg = 0;

    filteredInstances.forEach(inst => {
      const qty = Number(inst.quantity) || 0;
      const cut = Number(inst.cut_length) || 0;
      const len = (qty * cut) / 1000;
      const wt = Number(inst.total_weight) || 0;

      totalPieces += qty;
      totalLengthM += len;
      totalWeightKg += wt;
    });

    return {
      totalMembers,
      totalPieces,
      totalLengthM: Math.round(totalLengthM * 100) / 100,
      totalWeightKg: Math.round(totalWeightKg * 100) / 100,
      totalWeightMT: Math.round((totalWeightKg / 1000) * 1000) / 1000
    };
  }, [filteredMembers, filteredInstances]);

  // ════════════════════════════════════════════════════════════════════════════
  // ANALYTICAL SUMMARIES (A. Diameter, B. Block, C. Floor, D. Type, E. Member)
  // ════════════════════════════════════════════════════════════════════════════

  // A. Diameter-wise Summary
  const diameterSummary = useMemo(() => {
    const map = new Map();
    filteredInstances.forEach(inst => {
      const d = Number(inst.diameter || 16);
      if (!map.has(d)) {
        map.set(d, { diameter: d, pieces: 0, lengthM: 0, weightKg: 0 });
      }
      const entry = map.get(d);
      const qty = Number(inst.quantity) || 0;
      const cut = Number(inst.cut_length) || 0;
      const len = (qty * cut) / 1000;
      const wt = Number(inst.total_weight) || 0;

      entry.pieces += qty;
      entry.lengthM += len;
      entry.weightKg += wt;
    });

    const totWt = kpis.totalWeightKg || 1;
    return Array.from(map.values())
      .sort((a, b) => a.diameter - b.diameter)
      .map(entry => ({
        ...entry,
        unitWeight: Math.pow(entry.diameter, 2) / 162.28,
        weightMT: entry.weightKg / 1000,
        percentage: (entry.weightKg / totWt) * 100
      }));
  }, [filteredInstances, kpis.totalWeightKg]);

  // B. Block-wise Summary
  const blockSummary = useMemo(() => {
    const map = new Map();
    // Initialize with filtered blocks or all project blocks that have members
    filteredMembers.forEach(m => {
      const bId = String(m.blockId || 'unknown');
      if (!map.has(bId)) {
        const blk = blockMap.get(bId);
        map.set(bId, {
          id: bId,
          name: blk?.name || 'Block',
          memberCount: 0,
          pieces: 0,
          lengthM: 0,
          weightKg: 0
        });
      }
      map.get(bId).memberCount++;
    });

    filteredInstances.forEach(inst => {
      const bId = String(inst.blockId || 'unknown');
      if (map.has(bId)) {
        const entry = map.get(bId);
        const qty = Number(inst.quantity) || 0;
        const len = (qty * Number(inst.cut_length || 0)) / 1000;
        const wt = Number(inst.total_weight) || 0;
        entry.pieces += qty;
        entry.lengthM += len;
        entry.weightKg += wt;
      }
    });

    return Array.from(map.values()).map(b => ({
      ...b,
      weightMT: b.weightKg / 1000
    }));
  }, [filteredMembers, filteredInstances, blockMap]);

  // C. Floor-wise Summary
  const floorSummary = useMemo(() => {
    const map = new Map();
    filteredMembers.forEach(m => {
      const lId = String(m.levelId || 'unknown');
      if (!map.has(lId)) {
        const lvl = levelMap.get(lId);
        const blk = blockMap.get(String(m.blockId));
        map.set(lId, {
          id: lId,
          name: lvl?.name || 'Floor',
          blockName: blk?.name || 'Block',
          order: lvl?.order ?? 0,
          memberCount: 0,
          pieces: 0,
          lengthM: 0,
          weightKg: 0
        });
      }
      map.get(lId).memberCount++;
    });

    filteredInstances.forEach(inst => {
      const lId = String(inst.levelId || 'unknown');
      if (map.has(lId)) {
        const entry = map.get(lId);
        const qty = Number(inst.quantity) || 0;
        const len = (qty * Number(inst.cut_length || 0)) / 1000;
        const wt = Number(inst.total_weight) || 0;
        entry.pieces += qty;
        entry.lengthM += len;
        entry.weightKg += wt;
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.order - b.order)
      .map(f => ({
        ...f,
        weightMT: f.weightKg / 1000
      }));
  }, [filteredMembers, filteredInstances, levelMap, blockMap]);

  // D. Member Type-wise Summary
  const memberTypeSummary = useMemo(() => {
    const typeKeys = Object.keys(MEMBER_TYPE_MAP);
    const map = new Map();

    typeKeys.forEach(key => {
      map.set(key, {
        id: key,
        name: MEMBER_TYPE_MAP[key].label,
        memberCount: 0,
        pieces: 0,
        lengthM: 0,
        weightKg: 0
      });
    });

    // Helper to resolve type key
    const resolveTypeKey = (typeName) => {
      const upper = (typeName || '').toUpperCase();
      for (const [key, cfg] of Object.entries(MEMBER_TYPE_MAP)) {
        if (cfg.matches.some(p => upper.includes(p))) return key;
      }
      return 'OTHER';
    };

    filteredMembers.forEach(m => {
      const key = resolveTypeKey(m.memberType);
      if (map.has(key)) {
        map.get(key).memberCount++;
      }
    });

    filteredInstances.forEach(inst => {
      const mem = memberMap.get(String(inst.memberId));
      const key = resolveTypeKey(mem?.memberType);
      if (map.has(key)) {
        const entry = map.get(key);
        const qty = Number(inst.quantity) || 0;
        const len = (qty * Number(inst.cut_length || 0)) / 1000;
        const wt = Number(inst.total_weight) || 0;
        entry.pieces += qty;
        entry.lengthM += len;
        entry.weightKg += wt;
      }
    });

    return Array.from(map.values())
      .filter(t => t.memberCount > 0 || t.weightKg > 0)
      .map(t => ({
        ...t,
        weightMT: t.weightKg / 1000
      }));
  }, [filteredMembers, filteredInstances, memberMap]);

  // E. Member-wise Summary
  const memberSummary = useMemo(() => {
    const memberInstanceMap = new Map();
    filteredInstances.forEach(inst => {
      const mId = String(inst.memberId);
      if (!memberInstanceMap.has(mId)) {
        memberInstanceMap.set(mId, { pieces: 0, lengthM: 0, weightKg: 0 });
      }
      const agg = memberInstanceMap.get(mId);
      const qty = Number(inst.quantity) || 0;
      const len = (qty * Number(inst.cut_length || 0)) / 1000;
      const wt = Number(inst.total_weight) || 0;
      agg.pieces += qty;
      agg.lengthM += len;
      agg.weightKg += wt;
    });

    return filteredMembers.map(m => {
      const mId = String(m._id || m.id);
      const agg = memberInstanceMap.get(mId) || { pieces: 0, lengthM: 0, weightKg: 0 };
      const blk = blockMap.get(String(m.blockId));
      const lvl = levelMap.get(String(m.levelId));

      return {
        id: mId,
        memberMark: m.displayId || 'M1',
        memberType: m.memberType || 'Member',
        blockName: blk?.name || 'Block',
        floorName: lvl?.name || 'Floor',
        pieces: agg.pieces,
        lengthM: agg.lengthM,
        weightKg: agg.weightKg,
        weightMT: agg.weightKg / 1000,
        rawMember: m
      };
    });
  }, [filteredMembers, filteredInstances, blockMap, levelMap]);

  // Detailed Filtered BBS Table Records
  const detailedRecords = useMemo(() => {
    return filteredInstances.map((inst, idx) => {
      const mem = memberMap.get(String(inst.memberId));
      const blk = blockMap.get(String(inst.blockId || mem?.blockId));
      const lvl = levelMap.get(String(inst.levelId || mem?.levelId));
      const qty = Number(inst.quantity) || 0;
      const cut = Number(inst.cut_length) || 0;
      const totalL = (qty * cut) / 1000;
      const d = Number(inst.diameter) || 16;
      const unitW = Number(inst.unit_weight) || (Math.pow(d, 2) / 162.28);
      const totalW = Number(inst.total_weight) || (totalL * unitW);

      return {
        uniqueKey: `${inst.memberId}_${inst.barMark}_${d}_${idx}`,
        memberId: String(inst.memberId),
        memberMark: mem?.displayId || 'M1',
        memberType: mem?.memberType || 'Member',
        blockName: blk?.name || 'Block',
        floorName: lvl?.name || 'Floor',
        barMark: inst.barMark || String(idx + 1).padStart(2, '0'),
        description: inst.description || 'Rebar',
        shapeCode: inst.shapeCode || 'Shape 00',
        diameter: d,
        quantity: qty,
        cutLength: cut,
        totalLengthM: totalL,
        unitWeight: unitW,
        totalWeightKg: totalW,
        ruleClassification: inst.ruleClassification || 'DESIGNER_PROVIDED_VALUE',
        ruleSource: inst.ruleSource || '',
        rawMember: mem
      };
    });
  }, [filteredInstances, memberMap, blockMap, levelMap]);

  // ════════════════════════════════════════════════════════════════════════════
  // FILTER TOGGLE HANDLERS
  // ════════════════════════════════════════════════════════════════════════════
  const handleToggleBlock = (id) => {
    setSelectedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleLevel = (id) => {
    setSelectedLevels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleMemberType = (typeId) => {
    setSelectedMemberTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId); else next.add(typeId);
      return next;
    });
  };

  const handleToggleMemberId = (id) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleClearAllFilters = () => {
    setSelectedBlocks(new Set());
    setSelectedLevels(new Set());
    setSelectedMemberTypes(new Set());
    setSelectedMemberIds(new Set());
    setMemberSearchQuery('');
  };

  const hasActiveFilters =
    selectedBlocks.size > 0 ||
    selectedLevels.size > 0 ||
    selectedMemberTypes.size > 0 ||
    selectedMemberIds.size > 0 ||
    Boolean(memberSearchQuery.trim());

  // ════════════════════════════════════════════════════════════════════════════
  // EXPORT HANDLERS (EXACT CURRENTLY FILTERED DATASET)
  // ════════════════════════════════════════════════════════════════════════════
  const activeFilterInfo = {
    blocks: Array.from(selectedBlocks).map(id => blockMap.get(id)?.name || id),
    floors: Array.from(selectedLevels).map(id => levelMap.get(id)?.name || id),
    types: Array.from(selectedMemberTypes).map(t => MEMBER_TYPE_MAP[t]?.label || t),
    memberCount: selectedMemberIds.size || null
  };

  const handleExportPdf = () => {
    exportSummaryToPdf({
      project: dashboardData.project || project,
      filters: activeFilterInfo,
      kpis,
      diameterSummary,
      blockSummary,
      floorSummary,
      memberTypeSummary,
      memberSummary,
      detailedRecords
    });
  };

  const handleExportExcel = () => {
    exportSummaryToExcel({
      project: dashboardData.project || project,
      filters: activeFilterInfo,
      kpis,
      diameterSummary,
      blockSummary,
      floorSummary,
      memberTypeSummary,
      memberSummary,
      detailedRecords
    });
  };

  const handleExportCsv = () => {
    exportSummaryToCsv({
      project: dashboardData.project || project,
      detailedRecords
    });
  };

  // 1D Cutting Optimizer Bridge for Filtered Bar Pieces
  const handlePushFilteredToOptimizer = () => {
    if (detailedRecords.length === 0) {
      alert('No scheduled reinforcement items available to optimize for current filter selection.');
      return;
    }

    pushBbsToCuttingOptimizer({
      rebarItems: detailedRecords.map(r => ({
        barMark: r.barMark,
        description: `${r.memberMark}: ${r.description} (${r.shapeCode})`,
        diameter: r.diameter,
        quantity: r.quantity,
        cut_length: r.cutLength
      })),
      project: dashboardData.project || project,
      onNavigate: (targetView) => dispatch(setView(targetView))
    });
  };

  if (loading) {
    return (
      <div className="bbs-workspace-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <LoadingSpinner message="Aggregating Dynamic BBS Summary across active revisions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bbs-workspace-container" style={{ padding: '40px 20px' }}>
        <div className="bbs-validation-alert" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <AlertCircle size={20} />
          <div>
            <strong>Error loading Dynamic BBS Summary:</strong>
            <p>{error}</p>
            <button className="bbs-btn bbs-btn-secondary" onClick={loadData} style={{ marginTop: '8px' }}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bbs-workspace-container">
      {/* 1. TOP TOOLBAR & CONTROLS */}
      <div className="bbs-summary-top-toolbar">
        <div className="bbs-top-toolbar-left">
          {onClose && (
            <button className="bbs-btn bbs-btn-sm bbs-btn-secondary" onClick={onClose} title="Back to BBS Projects">
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          )}
          <BarChart3 size={20} className="text-accent" />
          <h2 className="bbs-dashboard-title">
            Dynamic BBS Summary: <span style={{ color: '#38bdf8' }}>{dashboardData.project?.name || project?.name || 'Project'}</span>
          </h2>
        </div>

        <div className="bbs-top-toolbar-actions">
          <button className="bbs-btn bbs-btn-sm bbs-btn-secondary" onClick={loadData} title="Refresh dataset from database">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="bbs-btn bbs-btn-sm bbs-btn-secondary" onClick={handleExportPdf} title="Print / Export PDF Report">
            <FileText size={14} />
            <span>Export PDF</span>
          </button>
          <button className="bbs-btn bbs-btn-sm bbs-btn-secondary" onClick={handleExportExcel} title="Download Multi-table Excel Sheet">
            <Download size={14} />
            <span>Export Excel</span>
          </button>
          <button className="bbs-btn bbs-btn-sm bbs-btn-secondary" onClick={handleExportCsv} title="Download Filtered Detailed CSV">
            <Download size={14} />
            <span>CSV</span>
          </button>
          <button className="bbs-btn bbs-btn-sm bbs-btn-primary" onClick={handlePushFilteredToOptimizer} title="Send filtered bars directly to 1D Cutting Stock solver">
            <Scissors size={14} />
            <span>Optimize Cuts ({detailedRecords.length})</span>
          </button>
        </div>
      </div>

      {/* 2. ACTIVE FILTER CHIPS ROW */}
      {hasActiveFilters && (
        <div className="bbs-filter-chips-row">
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Active Filters:</span>
          {Array.from(selectedBlocks).map(bId => (
            <span key={bId} className="bbs-filter-chip">
              Block: {blockMap.get(bId)?.name || bId}
              <button className="bbs-chip-remove" onClick={() => handleToggleBlock(bId)}><X size={12} /></button>
            </span>
          ))}

          {Array.from(selectedLevels).map(lId => (
            <span key={lId} className="bbs-filter-chip">
              Floor: {levelMap.get(lId)?.name || lId}
              <button className="bbs-chip-remove" onClick={() => handleToggleLevel(lId)}><X size={12} /></button>
            </span>
          ))}

          {Array.from(selectedMemberTypes).map(tId => (
            <span key={tId} className="bbs-filter-chip">
              Type: {MEMBER_TYPE_MAP[tId]?.label || tId}
              <button className="bbs-chip-remove" onClick={() => handleToggleMemberType(tId)}><X size={12} /></button>
            </span>
          ))}

          {selectedMemberIds.size > 0 && selectedMemberIds.size <= 3 && (
            Array.from(selectedMemberIds).map(mId => (
              <span key={mId} className="bbs-filter-chip">
                Member: {memberMap.get(mId)?.displayId || mId}
                <button className="bbs-chip-remove" onClick={() => handleToggleMemberId(mId)}><X size={12} /></button>
              </span>
            ))
          )}

          {selectedMemberIds.size > 3 && (
            <span className="bbs-filter-chip">
              {selectedMemberIds.size} Members Selected
              <button className="bbs-chip-remove" onClick={() => setSelectedMemberIds(new Set())}><X size={12} /></button>
            </span>
          )}

          <button className="bbs-sidebar-clear-all" onClick={handleClearAllFilters}>
            Clear All Filters
          </button>
        </div>
      )}

      {/* 3. MAIN DASHBOARD CONTENT (SIDEBAR + CONTENT GRID) */}
      <div className="bbs-summary-dashboard-layout">
        {/* MULTI-FACET FILTER SIDEBAR */}
        <BbsFilterSidebar
          blocks={dashboardData.blocks || []}
          levels={dashboardData.levels || []}
          members={dashboardData.members || []}
          selectedBlocks={selectedBlocks}
          onToggleBlock={handleToggleBlock}
          onSelectAllBlocks={() => setSelectedBlocks(new Set((dashboardData.blocks || []).map(b => String(b._id || b.id))))}
          onClearBlocks={() => setSelectedBlocks(new Set())}

          selectedLevels={selectedLevels}
          onToggleLevel={handleToggleLevel}
          onSelectAllLevels={(ids) => setSelectedLevels(new Set(ids))}
          onClearLevels={() => setSelectedLevels(new Set())}

          selectedMemberTypes={selectedMemberTypes}
          onToggleMemberType={handleToggleMemberType}
          onSelectAllMemberTypes={() => setSelectedMemberTypes(new Set(Object.keys(MEMBER_TYPE_MAP)))}
          onClearMemberTypes={() => setSelectedMemberTypes(new Set())}

          selectedMemberIds={selectedMemberIds}
          onToggleMemberId={handleToggleMemberId}
          onSelectAllMemberIds={(ids) => setSelectedMemberIds(new Set(ids))}
          onClearMemberIds={() => setSelectedMemberIds(new Set())}

          memberSearchQuery={memberSearchQuery}
          onMemberSearchChange={setMemberSearchQuery}

          onClearAllFilters={handleClearAllFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* MAIN SUMMARY AREA */}
        <div className="bbs-summary-main-area">
          {/* 4 KPI CARDS */}
          <BbsKpiCards
            totalMembers={kpis.totalMembers}
            totalPieces={kpis.totalPieces}
            totalWeightKg={kpis.totalWeightKg}
            totalWeightMT={kpis.totalWeightMT}
          />

          {/* 5 ANALYTICAL SUMMARY SECTION (CHARTS & TABLES) */}
          <BbsAnalyticsSection
            diameterSummary={diameterSummary}
            blockSummary={blockSummary}
            floorSummary={floorSummary}
            memberTypeSummary={memberTypeSummary}
            memberSummary={memberSummary}
            totalWeightKg={kpis.totalWeightKg}
            onNavigateToMember={onNavigateToMember}
          />

          {/* 6 DETAILED FILTERED BBS TABLE */}
          <BbsDetailedTable
            records={detailedRecords}
            onNavigateToMember={onNavigateToMember}
          />
        </div>
      </div>
    </div>
  );
}

