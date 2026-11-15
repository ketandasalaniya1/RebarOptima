import React from 'react';
import {
  Wallet,
  Building2,
  Settings as SettingsIcon,
  Search,
  Download,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  FolderPlus
} from 'lucide-react';
import { formatINR } from '../../../utils/money';

export default function HeaderBar({
  sites = [],
  selectedSiteName,
  onSelectSite,
  currentBalance = 0,
  searchQuery,
  onSearchChange,
  onOpenSettings,
  onOpenNewSite,
  onOpenCredit,
  onOpenDebit,
  onExport,
  isLoadingSites = false
}) {
  return (
    <header className="pc-header-bar">
      <div className="pc-header-top-row">
        {/* Brand / Title */}
        <div className="pc-header-brand">
          <div className="pc-header-icon-badge">
            <Wallet size={20} />
          </div>
          <div className="pc-header-titles">
            <h1 className="pc-header-title">Site Petty Cash</h1>
            <span className="pc-header-subtitle">Daily Cash Ledger & Vouchers</span>
          </div>
        </div>

        {/* Site Switcher */}
        <div className="pc-site-switcher-box">
          <Building2 size={16} className="pc-site-icon" />
          <select
            id="pc-active-site-select"
            className="pc-site-select"
            value={selectedSiteName}
            onChange={(e) => onSelectSite(e.target.value)}
            disabled={isLoadingSites || sites.length === 0}
            aria-label="Select construction site"
          >
            {sites.map((s) => (
              <option key={s.id || s.name} value={s.name}>
                {s.name} {s.code ? `(${s.code})` : ''} — Bal: {formatINR(s.currentBalance || 0)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pc-btn-icon-ghost"
            title="Add New Construction Site"
            aria-label="Add New Construction Site"
            onClick={onOpenNewSite}
          >
            <FolderPlus size={16} />
          </button>
        </div>

        {/* Desktop Search Bar */}
        <div className="pc-header-search-wrap">
          <Search size={15} className="pc-search-icon" />
          <input
            type="text"
            placeholder="Search entries, bills, persons..."
            className="pc-header-search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="pc-search-clear-btn"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Header Right Actions */}
        <div className="pc-header-right-actions">
          <button
            type="button"
            className="pc-btn-secondary pc-btn-export"
            onClick={onExport}
            title="Export CSV / Print statement"
            aria-label="Export statement"
          >
            <Download size={15} />
            <span className="pc-hide-sm">Export</span>
          </button>

          <button
            type="button"
            className="pc-btn-secondary pc-btn-settings"
            onClick={onOpenSettings}
            title="Settings: Categories & Providers"
            aria-label="Petty Cash Settings"
          >
            <SettingsIcon size={15} />
            <span className="pc-hide-sm">Settings</span>
          </button>

          {/* Quick CTA Buttons (Desktop) */}
          <button
            type="button"
            className="pc-btn-action-header pc-btn-credit-hdr"
            onClick={onOpenCredit}
            title="Record Money Received (Shortcut: R)"
            aria-label="Record Money Received"
          >
            <ArrowDownLeft size={16} />
            <span>Money Received</span>
            <kbd className="pc-kbd-shortcut pc-hide-md">R</kbd>
          </button>

          <button
            type="button"
            className="pc-btn-action-header pc-btn-debit-hdr"
            onClick={onOpenDebit}
            title="Record Expense (Shortcut: E)"
            aria-label="Record Expense"
          >
            <ArrowUpRight size={16} />
            <span>Expense</span>
            <kbd className="pc-kbd-shortcut pc-hide-md">E</kbd>
          </button>
        </div>
      </div>
    </header>
  );
}

