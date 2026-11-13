import React from 'react';
import { Filter, X, CheckSquare, Square, Search, Layers, LayoutGrid, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

const MEMBER_TYPE_OPTIONS = [
  { id: 'COLUMN', label: 'Columns', matches: ['COLUMN', 'PEDESTAL'] },
  { id: 'BEAM', label: 'Beams', matches: ['BEAM', 'TIE BEAM', 'PLINTH BEAM'] },
  { id: 'SLAB', label: 'Slabs', matches: ['SLAB', 'GRADE SLAB'] },
  { id: 'FOOTING', label: 'Footings', matches: ['FOOTING', 'ISOLATED FOOTING', 'COMBINED FOOTING', 'RAFT'] },
  { id: 'RETAINING_WALL', label: 'Retaining Walls', matches: ['RETAINING WALL', 'SHEAR WALL', 'WALL'] }
];

export default function BbsFilterSidebar({
  blocks = [],
  levels = [],
  members = [],
  selectedBlocks = new Set(),
  onToggleBlock,
  onSelectAllBlocks,
  onClearBlocks,

  selectedLevels = new Set(),
  onToggleLevel,
  onSelectAllLevels,
  onClearLevels,

  selectedMemberTypes = new Set(),
  onToggleMemberType,
  onSelectAllMemberTypes,
  onClearMemberTypes,

  selectedMemberIds = new Set(),
  onToggleMemberId,
  onSelectAllMemberIds,
  onClearMemberIds,

  memberSearchQuery = '',
  onMemberSearchChange,

  onClearAllFilters,
  hasActiveFilters,

  isOpen = true,
  onCloseMobile
}) {
  // Calculated members map and helpers
  const calculatedMembers = members.filter(m => m.activeRevision && String(m.activeRevision).trim() !== '');

  // 1. Available Levels dynamically filtered by selected blocks (or all if none selected)
  const availableLevels = selectedBlocks.size > 0
    ? levels.filter(l => selectedBlocks.has(String(l.blockId)))
    : levels;

  // 2. Available Member options dynamically filtered by upstream selections (Block, Level, Member Type)
  const availableMembers = calculatedMembers.filter(m => {
    if (selectedBlocks.size > 0 && !selectedBlocks.has(String(m.blockId))) return false;
    if (selectedLevels.size > 0 && !selectedLevels.has(String(m.levelId))) return false;
    if (selectedMemberTypes.size > 0) {
      const typeKey = (m.memberType || '').toUpperCase();
      const matchesActive = Array.from(selectedMemberTypes).some(activeType => {
        const opt = MEMBER_TYPE_OPTIONS.find(o => o.id === activeType);
        return opt && opt.matches.some(pattern => typeKey.includes(pattern));
      });
      if (!matchesActive) return false;
    }
    return true;
  });

  // Search filtered member list
  const searchFilteredMembers = memberSearchQuery.trim()
    ? availableMembers.filter(m => {
        const q = memberSearchQuery.toLowerCase();
        return (
          (m.displayId || '').toLowerCase().includes(q) ||
          (m.memberType || '').toLowerCase().includes(q)
        );
      })
    : availableMembers;

  return (
    <aside className={`bbs-summary-sidebar ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="bbs-sidebar-header">
        <div className="bbs-sidebar-title">
          <Filter size={16} />
          <span>Filters</span>
        </div>
        {hasActiveFilters && (
          <button className="bbs-sidebar-clear-all" onClick={onClearAllFilters} title="Clear all active filters">
            Clear All
          </button>
        )}
      </div>

      <div className="bbs-sidebar-scroll">
        {/* 1. BLOCK FILTER */}
        <div className="bbs-filter-group">
          <div className="bbs-filter-group-header">
            <span className="bbs-filter-label">1. Block / Building</span>
            <div className="bbs-filter-actions">
              <button onClick={onSelectAllBlocks} className="bbs-filter-link">All</button>
              <span className="bbs-filter-divider">|</span>
              <button onClick={onClearBlocks} className="bbs-filter-link">None</button>
            </div>
          </div>
          <div className="bbs-filter-options-list">
            {blocks.map(block => {
              const bId = String(block._id || block.id);
              const isChecked = selectedBlocks.has(bId);
              const count = calculatedMembers.filter(m => String(m.blockId) === bId).length;

              return (
                <label key={bId} className={`bbs-filter-checkbox-item ${isChecked ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleBlock(bId)}
                  />
                  <span className="bbs-filter-opt-name">{block.name}</span>
                  <span className="bbs-filter-badge">{count}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 2. FLOOR / LEVEL FILTER */}
        <div className="bbs-filter-group">
          <div className="bbs-filter-group-header">
            <span className="bbs-filter-label">2. Floor / Level</span>
            <div className="bbs-filter-actions">
              <button onClick={() => onSelectAllLevels(availableLevels.map(l => String(l._id || l.id)))} className="bbs-filter-link">All</button>
              <span className="bbs-filter-divider">|</span>
              <button onClick={onClearLevels} className="bbs-filter-link">None</button>
            </div>
          </div>
          <div className="bbs-filter-options-list">
            {availableLevels.map(level => {
              const lId = String(level._id || level.id);
              const isChecked = selectedLevels.has(lId);
              const count = calculatedMembers.filter(m => String(m.levelId) === lId).length;

              return (
                <label key={lId} className={`bbs-filter-checkbox-item ${isChecked ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleLevel(lId)}
                  />
                  <span className="bbs-filter-opt-name">{level.name}</span>
                  <span className="bbs-filter-badge">{count}</span>
                </label>
              );
            })}
            {availableLevels.length === 0 && (
              <div className="bbs-filter-empty-hint">No levels for selected blocks</div>
            )}
          </div>
        </div>

        {/* 3. STRUCTURAL MEMBER TYPE FILTER */}
        <div className="bbs-filter-group">
          <div className="bbs-filter-group-header">
            <span className="bbs-filter-label">3. Member Type</span>
            <div className="bbs-filter-actions">
              <button onClick={onSelectAllMemberTypes} className="bbs-filter-link">All</button>
              <span className="bbs-filter-divider">|</span>
              <button onClick={onClearMemberTypes} className="bbs-filter-link">None</button>
            </div>
          </div>
          <div className="bbs-filter-options-list">
            {MEMBER_TYPE_OPTIONS.map(opt => {
              const isChecked = selectedMemberTypes.has(opt.id);
              const count = calculatedMembers.filter(m => {
                const typeKey = (m.memberType || '').toUpperCase();
                return opt.matches.some(p => typeKey.includes(p));
              }).length;

              return (
                <label key={opt.id} className={`bbs-filter-checkbox-item ${isChecked ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleMemberType(opt.id)}
                  />
                  <span className="bbs-filter-opt-name">{opt.label}</span>
                  <span className="bbs-filter-badge">{count}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 4. INDIVIDUAL MEMBER FILTER */}
        <div className="bbs-filter-group">
          <div className="bbs-filter-group-header">
            <span className="bbs-filter-label">4. Specific Members</span>
            <div className="bbs-filter-actions">
              <button 
                onClick={() => onSelectAllMemberIds(searchFilteredMembers.map(m => String(m._id || m.id)))} 
                className="bbs-filter-link"
              >
                All
              </button>
              <span className="bbs-filter-divider">|</span>
              <button onClick={onClearMemberIds} className="bbs-filter-link">None</button>
            </div>
          </div>

          <div className="bbs-filter-search-box">
            <Search size={14} className="bbs-filter-search-icon" />
            <input
              type="text"
              placeholder="Search member ID..."
              value={memberSearchQuery}
              onChange={e => onMemberSearchChange(e.target.value)}
              className="bbs-filter-search-input"
            />
            {memberSearchQuery && (
              <button onClick={() => onMemberSearchChange('')} className="bbs-filter-search-clear">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="bbs-filter-options-list bbs-members-sublist">
            {searchFilteredMembers.map(m => {
              const mId = String(m._id || m.id);
              const isChecked = selectedMemberIds.has(mId);
              const blk = blocks.find(b => String(b._id || b.id) === String(m.blockId));
              const lvl = levels.find(l => String(l._id || l.id) === String(m.levelId));

              return (
                <label key={mId} className={`bbs-filter-checkbox-item member-item ${isChecked ? 'selected' : ''}`} title={`${m.displayId || 'Member'} (${blk?.name || 'Block'} • ${lvl?.name || 'Floor'})`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleMemberId(mId)}
                  />
                  <div className="bbs-member-option-content">
                    <span className="bbs-filter-opt-name font-bold">{m.displayId || 'M1'}</span>
                    <span className="bbs-member-option-sub">
                      {blk?.name ? `${blk.name} • ` : ''}{lvl?.name || ''}
                    </span>
                  </div>
                  <span className="bbs-member-type-pill">{m.memberType || 'Member'}</span>
                </label>
              );
            })}
            {searchFilteredMembers.length === 0 && (
              <div className="bbs-filter-empty-hint">No calculated members match criteria</div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

