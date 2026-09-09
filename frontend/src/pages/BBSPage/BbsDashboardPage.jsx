import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  ChevronDown, ChevronLeft, Plus, Download,
  FileSpreadsheet, Scissors, Weight, Box, Users2, TrendingUp,
} from 'lucide-react';
import { bbsApi } from '../../utils/api';
import {
  setDashboardData, setLoading, setError, setActiveMember,
} from '../../store/slices/bbsSlice';
import { setView } from '../../store/slices/routingSlice';
import './BbsDashboardPage.css';

export default function BbsDashboardPage() {
  const dispatch = useDispatch();
  const { activeProjectId, activeProject, blocks, levels, members, kpis, loading } = useSelector(s => s.bbs);

  const [expandedLevels, setExpandedLevels] = useState({});
  const [expandedBlocks, setExpandedBlocks] = useState({});

  useEffect(() => {
    if (activeProjectId) {
      loadMatrix();
    }
  }, [activeProjectId]);

  const loadMatrix = async () => {
    try {
      dispatch(setLoading(true));
      const data = await bbsApi.getDashboardMatrix(activeProjectId);
      dispatch(setDashboardData(data));
    } catch (err) {
      dispatch(setError(err.message));
    }
  };

  const toggleLevel = (levelId) => {
    setExpandedLevels(prev => ({ ...prev, [levelId]: !prev[levelId] }));
  };

  const toggleBlock = (blockId) => {
    setExpandedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const getMembersForCell = (blockId, levelId) => {
    return members.filter(m =>
      m.block_id === blockId && m.level_id === levelId
    );
  };

  const getCellAggregates = (blockId, levelId) => {
    const cellMembers = getMembersForCell(blockId, levelId);
    if (cellMembers.length === 0) return null;
    const totalWeight = cellMembers.reduce((s, m) => s + (m.total_steel_weight || 0), 0);
    const totalVolume = cellMembers.reduce((s, m) => s + (m.concrete_volume || 0), 0);
    return {
      weight: Math.round(totalWeight * 100) / 100,
      volume: Math.round(totalVolume * 1000) / 1000,
      count: cellMembers.length,
    };
  };

  const handleAddMember = (blockId, levelId) => {
    // Store context and navigate to wizard
    sessionStorage.setItem('bbs_wizard_context', JSON.stringify({
      projectId: activeProjectId,
      blockId,
      levelId,
      concreteGrades: activeProject?.defaultConcreteGrades || { footing: 'M25', column: 'M25', beam: 'M25', slab: 'M25' },
      steelGrade: activeProject?.defaultSteelGrade || 'Fe500',
    }));
    dispatch(setView('bbs-wizard'));
  };

  const handleOpenMember = (member) => {
    dispatch(setActiveMember(member));
    sessionStorage.setItem('bbs_wizard_context', JSON.stringify({
      projectId: activeProjectId,
      blockId: member.block_id,
      levelId: member.level_id,
      memberId: member._id,
      concreteGrade: member.concrete_grade,
      steelGrade: member.steel_grade,
    }));
    dispatch(setView('bbs-wizard'));
  };

  const handleExportMTO = () => {
    dispatch(setView('bbs-reports'));
  };

  // ── No project selected ──────────────────
  if (!activeProjectId) {
    return (
      <div className="bbs-dashboard-page">
        <div className="bbs-no-project">
          <h2>No Project Selected</h2>
          <p>Go to the Project Configurator to select or create a project first.</p>
          <button onClick={() => dispatch(setView('bbs-projects'))}>
            Open Project Configurator
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bbs-dashboard-page">
      {/* Back button */}
      <button className="bbs-dash-back-btn" onClick={() => dispatch(setView('bbs-projects'))}>
        <ChevronLeft size={16} /> Back to Projects
      </button>

      {/* Header */}
      <div className="bbs-dash-header">
        <div className="bbs-dash-header-left">
          <h1>{activeProject?.name || 'BBS Matrix'}</h1>
          <p>Interactive overview — Blocks (columns) × Levels (rows). Click any cell to manage members.</p>
        </div>
        <div className="bbs-dash-toolbar">
          <button className="bbs-toolbar-btn" onClick={handleExportMTO}>
            <FileSpreadsheet size={16} /> Reports & MTO
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="bbs-kpi-row">
        <div className="bbs-kpi-card steel">
          <div className="bbs-kpi-label">Total Steel</div>
          <div className="bbs-kpi-value">
            {kpis.totalSteelWeightMT || 0}
            <span className="bbs-kpi-unit">MT</span>
          </div>
          <div className="bbs-kpi-sub">{Math.round(kpis.totalSteelWeight || 0).toLocaleString()} kg</div>
        </div>

        <div className="bbs-kpi-card concrete">
          <div className="bbs-kpi-label">Concrete Volume</div>
          <div className="bbs-kpi-value">
            {kpis.totalConcreteVolume || 0}
            <span className="bbs-kpi-unit">m³</span>
          </div>
        </div>

        <div className="bbs-kpi-card members">
          <div className="bbs-kpi-label">Structural Members</div>
          <div className="bbs-kpi-value">{kpis.totalMembers || 0}</div>
          <div className="bbs-kpi-sub">
            {kpis.calculatedMembers || 0} calculated · {kpis.remainingMembers || 0} remaining
          </div>
        </div>

        <div className="bbs-kpi-card progress">
          <div className="bbs-kpi-label">Calculation Progress</div>
          <div className="bbs-kpi-value">
            {kpis.progressPercent || 0}
            <span className="bbs-kpi-unit">%</span>
          </div>
          <div className="bbs-progress-bar-bg">
            <div
              className="bbs-progress-bar-fill"
              style={{ width: `${kpis.progressPercent || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Matrix Grid */}
      {blocks.length === 0 ? (
        <div className="bbs-no-project" style={{ padding: '3rem' }}>
          <h2>Dashboard Not Ready</h2>
          <p>No Blocks defined yet. Go to the Project Configurator to add them.</p>
          <button onClick={() => dispatch(setView('bbs-projects'))}>
            Open Configurator
          </button>
        </div>
      ) : (
        <div className="bbs-accordion-container" style={{ marginTop: '1.5rem' }}>
          {blocks.map(block => {
            const blockLevels = levels.filter(l => l.block_id === block._id);
            return (
              <div key={block._id} className="bbs-accordion-block">
                <div 
                  className="bbs-accordion-block-header" 
                  onClick={() => toggleBlock(block._id)}
                >
                  <ChevronDown className={`bbs-accordion-chevron ${expandedBlocks[block._id] ? 'open' : ''}`} size={16} />
                  <span style={{ flex: 1, fontWeight: 600 }}>{block.name}</span>
                </div>
                {expandedBlocks[block._id] && (
                  <div className="bbs-accordion-block-body">
                    {blockLevels.length === 0 ? (
                      <div className="bbs-no-levels-msg" style={{ padding: '1rem', color: 'var(--text-muted)' }}>No levels defined for this block.</div>
                    ) : (
                      blockLevels.map(level => {
                        const agg = getCellAggregates(block._id, level._id);
                        const isLevelExpanded = expandedLevels[level._id];
                        return (
                          <div key={level._id} className="bbs-accordion-level">
                            <div 
                              className="bbs-accordion-level-header"
                              onClick={() => toggleLevel(level._id)}
                            >
                              <ChevronDown className={`bbs-accordion-chevron ${isLevelExpanded ? 'open' : ''}`} size={14} />
                              <Layers size={14} style={{ marginRight: '0.5rem', color: 'var(--text-muted)' }} /> 
                              <span style={{ flex: 1 }}>{level.name}</span>
                              
                              {agg ? (
                                <div className="bbs-cell-data" style={{ marginRight: '1rem' }}>
                                  <span className="bbs-cell-weight">{agg.weight} kg</span>
                                  <span className="bbs-cell-volume">{agg.volume} m³ · {agg.count} mbr</span>
                                </div>
                              ) : null}

                              <button
                                className="bbs-add-member-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddMember(block._id, level._id);
                                }}
                              >
                                <Plus size={12} /> Add Member
                              </button>
                            </div>

                            {isLevelExpanded && (
                              <div className="bbs-accordion-level-body" style={{ padding: '0.75rem 1rem 0.75rem 2rem', background: 'var(--bg-primary)' }}>
                                <div className="bbs-member-list">
                                  {getMembersForCell(block._id, level._id).map(m => (
                                    <div
                                      key={m._id}
                                      className="bbs-member-chip"
                                      onClick={() => handleOpenMember(m)}
                                    >
                                      <span className={`bbs-member-status ${m.status === 'Calculated' ? 'calculated' : 'remaining'}`} />
                                      <span className="bbs-member-chip-id">{m.member_id}</span>
                                      <span className="bbs-member-chip-weight">
                                        {Math.round((m.total_steel_weight || 0) * 100) / 100} kg
                                      </span>
                                    </div>
                                  ))}
                                  {getMembersForCell(block._id, level._id).length === 0 && (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No members added yet.</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
