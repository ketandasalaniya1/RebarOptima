import React from 'react';
import { Search, X, RefreshCw, Download, Filter } from 'lucide-react';
import './LogFilters.css';
import { Input, Select } from '../../../components/ui';

const MODULE_OPTIONS = [
  { value: 'all', label: 'All Modules' },
  { value: 'inventory', label: 'Steel Inventory' },
  { value: 'optimizer', label: 'Cut Optimizer' },
  { value: 'history', label: 'Batch History' },
  { value: 'ledger', label: 'Material Ledger' },
  { value: 'users', label: 'User Management' },
  { value: 'roles', label: 'Roles & Permissions' },
  { value: 'crm', label: 'Real Estate CRM' },
  { value: 'drawings', label: 'Drawings & Blueprints' },
  { value: 'pettyCash', label: 'Petty Cash' },
  { value: 'generalInventory', label: 'Site Inventory' },
  { value: 'auth', label: 'Auth & Login' },
];

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete / Deactivate' },
  { value: 'INWARD', label: 'Inward' },
  { value: 'SIGNIN', label: 'Sign In' },
  { value: 'REVERSE', label: 'Payment Reverse' },
];

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
];

/**
 * Filter Toolbar for Activity Logs
 */
export default function LogFilters({
  searchQuery,
  onSearchChange,
  selectedModule,
  onModuleChange,
  selectedAction,
  onActionChange,
  selectedUser,
  onUserChange,
  dateRange,
  onDateRangeChange,
  usersList = [],
  onRefresh,
  onExportCsv,
  exporting = false,
}) {
  return (
    <div className="log-filters-container">
      {/* Search Input */}
      <div className="lf-search-wrap">
        <Search size={15} className="lf-search-icon" />
        <Input
          type="text"
          placeholder="Search by action, user name, email, or keywords..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="lf-search-input"
        />
        {searchQuery && (
          <button
            type="button"
            className="lf-search-clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Dropdown Filters */}
      <div className="lf-dropdowns-row">
        {/* Module Filter */}
        <Select
          value={selectedModule}
          onChange={(e) => onModuleChange(e.target.value)}
          className="lf-select"
        >
          {MODULE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>

        {/* Action Filter */}
        <Select
          value={selectedAction}
          onChange={(e) => onActionChange(e.target.value)}
          className="lf-select"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>

        {/* User Filter */}
        <Select
          value={selectedUser}
          onChange={(e) => onUserChange(e.target.value)}
          className="lf-select"
        >
          <option value="all">All Team Members</option>
          {usersList.map((u) => {
            const uid = String(u.id || u._id);
            return (
              <option key={uid} value={uid}>
                {u.firstName} {u.lastName} ({u.roleName || u.role || 'Member'})
              </option>
            );
          })}
        </Select>

        {/* Date Range Filter */}
        <Select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value)}
          className="lf-select"
        >
          {DATE_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>

        {/* Refresh Button */}
        <button
          type="button"
          className="lf-action-btn"
          onClick={onRefresh}
          title="Refresh Logs"
          aria-label="Refresh activity logs"
        >
          <RefreshCw size={15} />
        </button>

        {/* Export CSV Button */}
        <button
          type="button"
          className="ro-btn ro-btn--secondary ro-btn--sm lf-export-btn"
          onClick={onExportCsv}
          disabled={exporting}
        >
          <Download size={14} />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>
    </div>
  );
}

