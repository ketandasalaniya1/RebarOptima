import React, { useState } from 'react';
import { Search, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { useActiveProject } from '../../../hooks/useActiveProject';
import { Input, Select } from '../../../components/ui';

export default function StickyHeader({
  activeTab,
  onTabChange,
  filters,
  onFilterChange,
  facets,
  onRefresh,
  refreshing = false,
  lastSyncedText = 'Synced just now',
}) {
  const { selectedProject, allProjects, switchProject } = useActiveProject();
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const disciplineList = [
    { code: 'all', name: 'All', count: facets?.kpi?.total || 0 },
    ...(facets?.disciplines?.length
      ? facets.disciplines
      : [
        { code: 'ARCH', name: 'Architectural', count: 0 },
        { code: 'STR', name: 'Structural', count: 0 },
        { code: 'MEPF', name: 'MEPF', count: 0 },
      ]),
  ];

  const blockList = ['All blocks', ...(facets?.blocks?.length ? facets.blocks : ['Block A', 'Block B', 'Tower 1'])];

  const standardLevels = [
    'All Levels',
    'Terrace',
    'Level 10',
    'Level 9',
    'Level 8',
    'Level 7',
    'Level 6',
    'Level 5',
    'Level 4',
    'Level 3',
    'Level 2',
    'Level 1',
    'Ground',
    'Basement 1',
    'Basement 2',
  ];

  const projectName = selectedProject?.name || selectedProject?.projectName || 'Select Project';
  const projectType = selectedProject?.projectType || selectedProject?.type || 'Mixed-use';

  return (
    <header className="drawings-sticky-header">
      {/* Row 1: Project Selector | Search Input | Sync Status */}
      <div className="drawings-header-row1">
        {/* Project Selector Pill with Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="drawings-project-pill"
            onClick={() => setShowProjectDropdown((prev) => !prev)}
          >
            <span className="drawings-project-badge-dot" />
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{projectName}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                {projectType} · <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Active</span>
              </div>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem' }} />
          </button>

          {showProjectDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '260px',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '10px',
                padding: '0.5rem',
                boxShadow: 'var(--shadow-modal)',
                zIndex: 60,
              }}
            >
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--text-label)',
                  padding: '0.25rem 0.5rem',
                  textTransform: 'uppercase',
                }}
              >
                Switch Project
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {(allProjects || []).map((p) => {
                  const pId = p._id || p.id;
                  const isCurrent = (selectedProject?._id || selectedProject?.id) === pId;
                  return (
                    <button
                      key={pId}
                      type="button"
                      onClick={() => {
                        switchProject(pId);
                        setShowProjectDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        background: isCurrent ? 'var(--accent-subtle)' : 'transparent',
                        color: isCurrent ? 'var(--accent)' : 'var(--text-primary)',
                        fontSize: '0.8125rem',
                        fontWeight: isCurrent ? 700 : 500,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{p.name || p.projectName}</span>
                      {isCurrent && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Live Search Input */}
        <div className="drawings-search-box">
          <Search size={16} className="drawings-search-icon" />
          <Input
            type="text"
            className="drawings-search-input"
            placeholder="Search drawing number or title"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value })}
          />
        </div>

        {/* Sync Button */}
        <button
          type="button"
          className="drawings-sync-btn"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} style={{ color: 'var(--accent)' }} />
          <span>{lastSyncedText}</span>
        </button>
      </div>

      {/* Row 2: Discipline Pills | Block Pills | Compact Level Select */}
      <div className="drawings-header-row2">
        {/* Discipline Pills */}
        <div className="drawings-filter-group">
          <span className="drawings-group-label">Discipline</span>
          {disciplineList.map((d) => {
            const isAll = d.code === 'all';
            const isActive = isAll ? !filters.discipline || filters.discipline === 'all' : filters.discipline === d.code;
            return (
              <button
                key={d.code}
                type="button"
                className={`drawings-pill-btn ${isActive ? 'active' : ''}`}
                onClick={() => onFilterChange({ discipline: isAll ? 'all' : d.code })}
              >
                <span>{d.name}</span>
                {d.count !== undefined && <span className="drawings-pill-count">{d.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Block Pills */}
        <div className="drawings-filter-group">
          <span className="drawings-group-label">Block</span>
          {blockList.map((b) => {
            const isAll = b === 'All blocks';
            const isActive = isAll ? !filters.block || filters.block === 'all' : filters.block === b;
            return (
              <button
                key={b}
                type="button"
                className={`drawings-pill-btn ${isActive ? 'active' : ''}`}
                onClick={() => onFilterChange({ block: isAll ? 'all' : b })}
              >
                {b}
              </button>
            );
          })}
        </div>

        {/* Compact Level Dropdown */}
        <div className="drawings-filter-group">
          <Select
            className="drawings-level-dropdown"
            value={filters.level || 'all'}
            onChange={(e) => onFilterChange({ level: e.target.value })}
            aria-label="Filter by level"
          >
            {standardLevels.map((lvl) => (
              <option key={lvl} value={lvl === 'All Levels' ? 'all' : lvl}>
                {lvl === 'All Levels' ? 'Level: All' : lvl}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Row 3: Navigation Tabs */}
      <nav className="drawings-header-tabs" aria-label="Drawings navigation tabs">
        {[
          { id: 'drawings', label: 'Drawings' },
          { id: 'matrix', label: 'Matrix' },
          { id: 'versions', label: 'Versions' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`drawings-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
              {isActive && <div className="drawings-tab-indicator" />}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
