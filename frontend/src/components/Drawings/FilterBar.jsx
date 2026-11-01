import React from 'react';
import './FilterBar.css';
import RoleGate from '../RoleGate';
import { Plus, Building2 } from 'lucide-react';

const STANDARD_DISCIPLINES = [
  { code: 'all', name: 'All Disciplines' },
  { code: 'ARCH', name: 'Architectural' },
  { code: 'STR', name: 'Structural' },
  { code: 'MEPF', name: 'MEPF' },
  { code: 'MECH', name: 'Mechanical' },
  { code: 'ELEC', name: 'Electrical' },
  { code: 'PLUMB', name: 'Plumbing' },
  { code: 'FIRE', name: 'Fire Fighting' },
  { code: 'LAND', name: 'Landscape' },
  { code: 'INT', name: 'Interior' },
  { code: 'CIVIL', name: 'Civil / Infra' }
];

const STANDARD_LEVELS = [
  { code: 'all', name: 'All Levels' },
  { code: 'B2', name: 'B2 (Basement 2)' },
  { code: 'B1', name: 'B1 (Basement 1)' },
  { code: 'G', name: 'Ground Floor' },
  { code: 'L1', name: 'L1 (Level 1)' },
  { code: 'L2', name: 'L2 (Level 2)' },
  { code: 'L3', name: 'L3 (Level 3)' },
  { code: 'L4', name: 'L4 (Level 4)' },
  { code: 'L5', name: 'L5 (Level 5)' },
  { code: 'TERRACE', name: 'Terrace' },
  { code: 'GENERAL', name: 'General' }
];

export default function FilterBar({
  projectName = 'Active Project',
  blocks = [],
  selectedBlock = 'all',
  onBlockChange,
  selectedDiscipline = 'all',
  onDisciplineChange,
  selectedLevel = 'all',
  onLevelChange,
  onNewDrawingClick
}) {
  return (
    <div className="ro-filter-bar">
      <div className="ro-filter-bar-left">
        {/* Project (Read-only from active project) */}
        <div className="ro-filter-group">
          <label className="ro-filter-label">Project</label>
          <div className="ro-filter-readonly-box" title={`Active Project: ${projectName}`}>
            <Building2 size={15} style={{ color: 'var(--accent, #059669)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{projectName}</span>
          </div>
        </div>

        {/* Block */}
        <div className="ro-filter-group compact">
          <label className="ro-filter-label" htmlFor="filter-block">Block</label>
          <select
            id="filter-block"
            className="ro-filter-select"
            value={selectedBlock}
            onChange={(e) => onBlockChange && onBlockChange(e.target.value)}
          >
            <option value="all">All Blocks</option>
            {blocks && blocks.length > 0 ? (
              blocks.map((b) => (
                <option key={b._id || b.name} value={b.name || b._id}>
                  {b.name || b.blockName}
                </option>
              ))
            ) : (
              <>
                <option value="Block A">Block A</option>
                <option value="Block B">Block B</option>
                <option value="Tower 1">Tower 1</option>
              </>
            )}
          </select>
        </div>

        {/* Discipline (10 values) */}
        <div className="ro-filter-group">
          <label className="ro-filter-label" htmlFor="filter-discipline">Discipline</label>
          <select
            id="filter-discipline"
            className="ro-filter-select"
            value={selectedDiscipline}
            onChange={(e) => onDisciplineChange && onDisciplineChange(e.target.value)}
          >
            {STANDARD_DISCIPLINES.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Level / Floor */}
        <div className="ro-filter-group compact">
          <label className="ro-filter-label" htmlFor="filter-level">Level / Floor</label>
          <select
            id="filter-level"
            className="ro-filter-select"
            value={selectedLevel}
            onChange={(e) => onLevelChange && onLevelChange(e.target.value)}
          >
            {STANDARD_LEVELS.map((lvl) => (
              <option key={lvl.code} value={lvl.code}>
                {lvl.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ro-filter-bar-right">
        <RoleGate permission="drawing:upload">
          <button
            type="button"
            className="ro-btn-primary-action"
            onClick={onNewDrawingClick}
          >
            <Plus size={16} />
            <span>+ New Drawing</span>
          </button>
        </RoleGate>
      </div>
    </div>
  );
}

