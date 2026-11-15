import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Filter,
  Tag,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  X,
  RotateCcw,
  ShieldCheck,
  Clock,
  AlertCircle
} from 'lucide-react';

export default function FilterChips({
  datePreset,
  onApplyDatePreset,
  startDate,
  endDate,
  onCustomDateChange,
  typeFilter,
  onTypeChange,
  categoryFilter,
  onCategoryChange,
  personFilter,
  onPersonChange,
  statusFilter = 'ALL',
  onStatusChange,
  categories = [],
  persons = [],
  totalEntries = 0,
  onClearAll
}) {
  const [activePopover, setActivePopover] = useState(null); // 'date' | 'type' | 'category' | 'person' | 'status' | null
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const containerRef = useRef(null);

  // Close popover on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Compute active filters count
  const activeCount = [
    datePreset !== 'all' || (startDate && endDate),
    typeFilter !== 'ALL',
    categoryFilter !== 'ALL',
    Boolean(personFilter),
    statusFilter !== 'ALL'
  ].filter(Boolean).length;

  const togglePopover = (name) => {
    setActivePopover(prev => (prev === name ? null : name));
  };

  // Date label display
  const getDateLabel = () => {
    if (datePreset === 'today') return 'Today';
    if (datePreset === 'yesterday') return 'Yesterday';
    if (datePreset === 'week') return 'This Week';
    if (datePreset === 'month') return 'This Month';
    if (datePreset === 'custom' && startDate && endDate) return `${startDate} → ${endDate}`;
    return 'All Time';
  };

  return (
    <div className="pc-filter-chips-container" ref={containerRef}>
      {/* Mobile Filter Button */}
      <button
        type="button"
        className="pc-mobile-filter-trigger"
        onClick={() => setIsMobileSheetOpen(true)}
      >
        <Filter size={15} />
        <span>Filters</span>
        {activeCount > 0 && <span className="pc-filter-count-badge">{activeCount}</span>}
      </button>

      {/* Desktop Filter Chips Bar */}
      <div className="pc-desktop-filter-chips">
        {/* Date Filter Chip */}
        <div className="pc-chip-popover-anchor">
          <button
            type="button"
            className={`pc-filter-chip ${datePreset !== 'all' ? 'pc-chip-active' : ''}`}
            onClick={() => togglePopover('date')}
            aria-expanded={activePopover === 'date'}
          >
            <Calendar size={14} />
            <span>Date: <strong>{getDateLabel()}</strong></span>
            <ChevronDown size={13} className={`pc-chevron ${activePopover === 'date' ? 'open' : ''}`} />
          </button>

          {activePopover === 'date' && (
            <div className="pc-popover-panel pc-date-popover">
              <div className="pc-popover-header">
                <span>Date Range</span>
                <button type="button" onClick={() => setActivePopover(null)}><X size={14} /></button>
              </div>
              <div className="pc-preset-grid">
                {['all', 'today', 'yesterday', 'week', 'month'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`pc-preset-btn ${datePreset === preset ? 'active' : ''}`}
                    onClick={() => {
                      onApplyDatePreset(preset);
                      setActivePopover(null);
                    }}
                  >
                    {preset === 'all' && 'All Time'}
                    {preset === 'today' && 'Today'}
                    {preset === 'yesterday' && 'Yesterday'}
                    {preset === 'week' && 'This Week'}
                    {preset === 'month' && 'This Month'}
                  </button>
                ))}
              </div>
              <div className="pc-custom-date-section">
                <span className="pc-popover-subhead">Custom Range</span>
                <div className="pc-date-inputs-row">
                  <input
                    type="date"
                    className="pc-input-sm"
                    value={startDate}
                    onChange={(e) => onCustomDateChange(e.target.value, endDate)}
                  />
                  <span className="pc-text-muted">to</span>
                  <input
                    type="date"
                    className="pc-input-sm"
                    value={endDate}
                    onChange={(e) => onCustomDateChange(startDate, e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Type Filter Chip */}
        <div className="pc-chip-popover-anchor">
          <button
            type="button"
            className={`pc-filter-chip ${typeFilter !== 'ALL' ? 'pc-chip-active' : ''}`}
            onClick={() => togglePopover('type')}
            aria-expanded={activePopover === 'type'}
          >
            {typeFilter === 'CREDIT' ? (
              <ArrowDownLeft size={14} className="pc-text-success" />
            ) : typeFilter === 'DEBIT' ? (
              <ArrowUpRight size={14} className="pc-text-danger" />
            ) : (
              <Filter size={14} />
            )}
            <span>
              Type:{' '}
              <strong>
                {typeFilter === 'CREDIT' ? 'Received' : typeFilter === 'DEBIT' ? 'Expenses' : 'All'}
              </strong>
            </span>
            <ChevronDown size={13} className={`pc-chevron ${activePopover === 'type' ? 'open' : ''}`} />
          </button>

          {activePopover === 'type' && (
            <div className="pc-popover-panel pc-type-popover">
              <div className="pc-popover-header">
                <span>Entry Type</span>
                <button type="button" onClick={() => setActivePopover(null)}><X size={14} /></button>
              </div>
              <div className="pc-type-options-list">
                <button
                  type="button"
                  className={`pc-type-opt ${typeFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => {
                    onTypeChange('ALL');
                    setActivePopover(null);
                  }}
                >
                  <span>All Entries</span>
                </button>
                <button
                  type="button"
                  className={`pc-type-opt pc-type-opt-credit ${typeFilter === 'CREDIT' ? 'active' : ''}`}
                  onClick={() => {
                    onTypeChange('CREDIT');
                    setActivePopover(null);
                  }}
                >
                  <ArrowDownLeft size={15} />
                  <span>Money Received (Credit)</span>
                </button>
                <button
                  type="button"
                  className={`pc-type-opt pc-type-opt-debit ${typeFilter === 'DEBIT' ? 'active' : ''}`}
                  onClick={() => {
                    onTypeChange('DEBIT');
                    setActivePopover(null);
                  }}
                >
                  <ArrowUpRight size={15} />
                  <span>Site Expenses (Debit)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Audit Status Filter Chip (Phase 2) */}
        <div className="pc-chip-popover-anchor">
          <button
            type="button"
            className={`pc-filter-chip ${statusFilter !== 'ALL' ? 'pc-chip-active' : ''}`}
            onClick={() => togglePopover('status')}
            aria-expanded={activePopover === 'status'}
          >
            <ShieldCheck size={14} />
            <span>
              Status:{' '}
              <strong>
                {statusFilter === 'VERIFIED'
                  ? 'Verified'
                  : statusFilter === 'PENDING'
                    ? 'Pending'
                    : statusFilter === 'REJECTED'
                      ? 'Rejected'
                      : 'All'}
              </strong>
            </span>
            <ChevronDown size={13} className={`pc-chevron ${activePopover === 'status' ? 'open' : ''}`} />
          </button>

          {activePopover === 'status' && (
            <div className="pc-popover-panel pc-type-popover">
              <div className="pc-popover-header">
                <span>Audit & Verification Status</span>
                <button type="button" onClick={() => setActivePopover(null)}><X size={14} /></button>
              </div>
              <div className="pc-type-options-list">
                <button
                  type="button"
                  className={`pc-type-opt ${statusFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => {
                    if (onStatusChange) onStatusChange('ALL');
                    setActivePopover(null);
                  }}
                >
                  <span>All Statuses</span>
                </button>
                <button
                  type="button"
                  className={`pc-type-opt ${statusFilter === 'PENDING' ? 'active' : ''}`}
                  onClick={() => {
                    if (onStatusChange) onStatusChange('PENDING');
                    setActivePopover(null);
                  }}
                >
                  <Clock size={15} className="pc-text-warning" />
                  <span>Pending Verification</span>
                </button>
                <button
                  type="button"
                  className={`pc-type-opt ${statusFilter === 'VERIFIED' ? 'active' : ''}`}
                  onClick={() => {
                    if (onStatusChange) onStatusChange('VERIFIED');
                    setActivePopover(null);
                  }}
                >
                  <ShieldCheck size={15} className="pc-text-success" />
                  <span>Verified (Approved)</span>
                </button>
                <button
                  type="button"
                  className={`pc-type-opt ${statusFilter === 'REJECTED' ? 'active' : ''}`}
                  onClick={() => {
                    if (onStatusChange) onStatusChange('REJECTED');
                    setActivePopover(null);
                  }}
                >
                  <AlertCircle size={15} className="pc-text-danger" />
                  <span>Rejected</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Category Filter Chip */}
        <div className="pc-chip-popover-anchor">
          <button
            type="button"
            className={`pc-filter-chip ${categoryFilter !== 'ALL' ? 'pc-chip-active' : ''}`}
            onClick={() => togglePopover('category')}
            aria-expanded={activePopover === 'category'}
          >
            <Tag size={14} />
            <span>Category: <strong>{categoryFilter === 'ALL' ? 'All' : categoryFilter}</strong></span>
            <ChevronDown size={13} className={`pc-chevron ${activePopover === 'category' ? 'open' : ''}`} />
          </button>

          {activePopover === 'category' && (
            <div className="pc-popover-panel pc-cat-popover">
              <div className="pc-popover-header">
                <span>Filter by Category</span>
                <button type="button" onClick={() => setActivePopover(null)}><X size={14} /></button>
              </div>
              <div className="pc-cat-options-scroll">
                <button
                  type="button"
                  className={`pc-cat-opt ${categoryFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => {
                    onCategoryChange('ALL');
                    setActivePopover(null);
                  }}
                >
                  All Categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id || c.name}
                    type="button"
                    className={`pc-cat-opt ${categoryFilter === c.name ? 'active' : ''}`}
                    onClick={() => {
                      onCategoryChange(c.name);
                      setActivePopover(null);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Person Filter Chip */}
        <div className="pc-chip-popover-anchor">
          <button
            type="button"
            className={`pc-filter-chip ${personFilter ? 'pc-chip-active' : ''}`}
            onClick={() => togglePopover('person')}
            aria-expanded={activePopover === 'person'}
          >
            <Users size={14} />
            <span>Person: <strong>{personFilter || 'All'}</strong></span>
            <ChevronDown size={13} className={`pc-chevron ${activePopover === 'person' ? 'open' : ''}`} />
          </button>

          {activePopover === 'person' && (
            <div className="pc-popover-panel pc-person-popover">
              <div className="pc-popover-header">
                <span>Filter by Person</span>
                <button type="button" onClick={() => setActivePopover(null)}><X size={14} /></button>
              </div>
              <div className="pc-cat-options-scroll">
                <button
                  type="button"
                  className={`pc-cat-opt ${!personFilter ? 'active' : ''}`}
                  onClick={() => {
                    onPersonChange('');
                    setActivePopover(null);
                  }}
                >
                  All Persons
                </button>
                {persons.map((p) => (
                  <button
                    key={p.id || p.name}
                    type="button"
                    className={`pc-cat-opt ${personFilter === p.name ? 'active' : ''}`}
                    onClick={() => {
                      onPersonChange(p.name);
                      setActivePopover(null);
                    }}
                  >
                    {p.name} {p.roleOrTitle ? `(${p.roleOrTitle})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clear All Button */}
        {activeCount > 0 && (
          <button
            type="button"
            className="pc-btn-clear-filters"
            onClick={onClearAll}
            title="Reset all filters"
          >
            <RotateCcw size={13} />
            <span>Clear ({activeCount})</span>
          </button>
        )}
      </div>

      {/* Mobile Bottom Sheet Filters Modal */}
      {isMobileSheetOpen && (
        <div
          className="pc-modal-backdrop pc-mobile-sheet-backdrop"
          onClick={() => setIsMobileSheetOpen(false)}
        >
          <div className="pc-mobile-sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="pc-mobile-sheet-header">
              <div className="pc-mobile-sheet-title">
                <Filter size={18} />
                <h3>Filter Ledger</h3>
              </div>
              <button
                type="button"
                className="pc-btn-close"
                onClick={() => setIsMobileSheetOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="pc-mobile-sheet-body">
              {/* Date Presets */}
              <div className="pc-sheet-section">
                <label className="pc-sheet-label">Date Range</label>
                <div className="pc-preset-grid">
                  {['all', 'today', 'yesterday', 'week', 'month'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`pc-preset-btn ${datePreset === preset ? 'active' : ''}`}
                      onClick={() => onApplyDatePreset(preset)}
                    >
                      {preset === 'all' && 'All Time'}
                      {preset === 'today' && 'Today'}
                      {preset === 'yesterday' && 'Yesterday'}
                      {preset === 'week' && 'This Week'}
                      {preset === 'month' && 'This Month'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="pc-sheet-section">
                <label className="pc-sheet-label">Verification Status</label>
                <div className="pc-type-options-list">
                  <button
                    type="button"
                    className={`pc-type-opt ${statusFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => onStatusChange && onStatusChange('ALL')}
                  >
                    All Statuses
                  </button>
                  <button
                    type="button"
                    className={`pc-type-opt ${statusFilter === 'PENDING' ? 'active' : ''}`}
                    onClick={() => onStatusChange && onStatusChange('PENDING')}
                  >
                    <Clock size={15} />
                    <span>Pending Verification</span>
                  </button>
                  <button
                    type="button"
                    className={`pc-type-opt ${statusFilter === 'VERIFIED' ? 'active' : ''}`}
                    onClick={() => onStatusChange && onStatusChange('VERIFIED')}
                  >
                    <ShieldCheck size={15} />
                    <span>Verified</span>
                  </button>
                  <button
                    type="button"
                    className={`pc-type-opt ${statusFilter === 'REJECTED' ? 'active' : ''}`}
                    onClick={() => onStatusChange && onStatusChange('REJECTED')}
                  >
                    <AlertCircle size={15} />
                    <span>Rejected</span>
                  </button>
                </div>
              </div>

              {/* Type Filter */}
              <div className="pc-sheet-section">
                <label className="pc-sheet-label">Transaction Type</label>
                <div className="pc-type-options-list">
                  <button
                    type="button"
                    className={`pc-type-opt ${typeFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => onTypeChange('ALL')}
                  >
                    All Entries
                  </button>
                  <button
                    type="button"
                    className={`pc-type-opt pc-type-opt-credit ${typeFilter === 'CREDIT' ? 'active' : ''}`}
                    onClick={() => onTypeChange('CREDIT')}
                  >
                    <ArrowDownLeft size={15} />
                    <span>Received (Credit)</span>
                  </button>
                  <button
                    type="button"
                    className={`pc-type-opt pc-type-opt-debit ${typeFilter === 'DEBIT' ? 'active' : ''}`}
                    onClick={() => onTypeChange('DEBIT')}
                  >
                    <ArrowUpRight size={15} />
                    <span>Expenses (Debit)</span>
                  </button>
                </div>
              </div>

              {/* Category Filter */}
              <div className="pc-sheet-section">
                <label className="pc-sheet-label">Category</label>
                <select
                  className="pc-input"
                  value={categoryFilter}
                  onChange={(e) => onCategoryChange(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Person Filter */}
              <div className="pc-sheet-section">
                <label className="pc-sheet-label">Person / Provider</label>
                <select
                  className="pc-input"
                  value={personFilter}
                  onChange={(e) => onPersonChange(e.target.value)}
                >
                  <option value="">All Persons</option>
                  {persons.map((p) => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.name} {p.roleOrTitle ? `(${p.roleOrTitle})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pc-mobile-sheet-footer">
              <button
                type="button"
                className="pc-btn-secondary"
                onClick={() => {
                  onClearAll();
                  setIsMobileSheetOpen(false);
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="pc-btn-primary"
                onClick={() => setIsMobileSheetOpen(false)}
              >
                Show {totalEntries} Entries
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
