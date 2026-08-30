import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, Search, Filter, Download, RefreshCw, Eye, Shield, 
  Calendar, ArrowRight, User, AlertTriangle, CheckCircle, Clock,
  FileSpreadsheet, Sparkles, Layers, Box, Cpu, FileText, Settings, 
  UserCheck, Sliders, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { activityLogsApi, usersApi } from '../../utils/api';
import './ActivityLogsPage.css';

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [dateRange, setDateRange] = useState('all'); // all, today, 7days, 30days
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Stats & Pagination from server
  const [stats, setStats] = useState({
    totalLogs: 0,
    todayCount: 0,
    activeUsersCount: 0,
    criticalCount: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  });

  // Selected Log for detail modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [usersList, setUsersList] = useState([]);

  // Load available users for filter dropdown
  useEffect(() => {
    usersApi.getUsers()
      .then(data => {
        if (Array.isArray(data)) setUsersList(data);
      })
      .catch(() => {});
  }, []);

  // Fetch logs whenever filters or page changes
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      let startDate = null;
      let endDate = null;

      const now = new Date();
      if (dateRange === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        startDate = start.toISOString();
      } else if (dateRange === '7days') {
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        startDate = start.toISOString();
      } else if (dateRange === '30days') {
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        startDate = start.toISOString();
      }

      const res = await activityLogsApi.getLogs({
        page: currentPage,
        limit: pageSize,
        search: searchQuery.trim() || undefined,
        module: selectedModule !== 'all' ? selectedModule : undefined,
        action: selectedAction !== 'all' ? selectedAction : undefined,
        userId: selectedUser !== 'all' ? selectedUser : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });

      if (res && res.logs) {
        setLogs(res.logs);
        if (res.pagination) setPagination(res.pagination);
        if (res.stats) setStats(res.stats);
      } else if (Array.isArray(res)) {
        setLogs(res);
      }
    } catch (err) {
      console.error('Failed to load activity logs:', err);
      setError(err.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage, selectedModule, selectedAction, selectedUser, dateRange]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchLogs();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      let startDate = null;
      if (dateRange === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        startDate = start.toISOString();
      } else if (dateRange === '7days') {
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        startDate = start.toISOString();
      } else if (dateRange === '30days') {
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        startDate = start.toISOString();
      }

      await activityLogsApi.exportLogs({
        search: searchQuery.trim() || undefined,
        module: selectedModule !== 'all' ? selectedModule : undefined,
        action: selectedAction !== 'all' ? selectedAction : undefined,
        userId: selectedUser !== 'all' ? selectedUser : undefined,
        startDate: startDate || undefined
      });
    } catch (err) {
      alert('Error exporting logs: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const getModuleBadge = (module) => {
    switch (module?.toLowerCase()) {
      case 'inventory':
        return { label: 'Inventory', icon: <Box size={13} />, className: 'module-inventory' };
      case 'optimizer':
        return { label: 'Optimizer', icon: <Cpu size={13} />, className: 'module-optimizer' };
      case 'history':
        return { label: 'Batches', icon: <Layers size={13} />, className: 'module-history' };
      case 'scrapsales':
        return { label: 'Scrap Sales', icon: <FileSpreadsheet size={13} />, className: 'module-scrap' };
      case 'ledger':
        return { label: 'Ledger', icon: <FileText size={13} />, className: 'module-ledger' };
      case 'users':
        return { label: 'Users', icon: <UserCheck size={13} />, className: 'module-users' };
      case 'roles':
        return { label: 'Roles', icon: <Shield size={13} />, className: 'module-roles' };
      case 'settings':
        return { label: 'Settings', icon: <Settings size={13} />, className: 'module-settings' };
      case 'auth':
        return { label: 'Auth / Session', icon: <Clock size={13} />, className: 'module-auth' };
      default:
        return { label: module || 'General', icon: <History size={13} />, className: 'module-default' };
    }
  };

  const getActionBadgeClass = (action = '') => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('DEACTIVATE')) return 'action-danger';
    if (act.includes('INWARD') || act.includes('CREATE') || act.includes('SIGNUP') || act.includes('ACTIVATE')) return 'action-success';
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('CHANGE')) return 'action-warning';
    if (act.includes('SIGNIN') || act.includes('LOGIN')) return 'action-info';
    return 'action-neutral';
  };

  const getRoleBadgeClass = (role = '') => {
    const r = (role || '').toLowerCase();
    if (r.includes('admin') || r.includes('owner')) return 'role-admin';
    if (r.includes('manager')) return 'role-manager';
    if (r.includes('engineer')) return 'role-engineer';
    if (r.includes('supervisor')) return 'role-supervisor';
    if (r.includes('store') || r.includes('keeper')) return 'role-store';
    if (r.includes('accountant')) return 'role-accountant';
    return 'role-default';
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return { formatted: '—', relative: '' };
    const date = new Date(dateStr);
    const formatted = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = '';
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = 'Yesterday';
    else relative = `${diffDays}d ago`;

    return { formatted, relative };
  };

  // Helper to convert any raw log into clean, friendly, plain English description
  const formatPlainDescription = (log) => {
    if (!log) return '';
    const action = (log.action || '').toUpperCase();
    const { actorName, actorRole, newValue, previousValue, description } = log;

    // If description is already human-written and not a placeholder/empty
    if (description && !description.includes('No description provided') && !description.includes('undefined') && !description.includes('null') && !description.includes('on platformusers') && !description.includes('on subscriptions') && !description.includes('on companies')) {
      return description;
    }

    switch (action) {
      case 'SUBSCRIPTION_ASSIGNED':
        return `Assigned subscription plan to company account`;
      case 'SUBSCRIPTION_UPDATED':
        return `Updated company subscription plan settings`;
      case 'COMPANY_STATUS_CHANGED':
        return `Updated company account status to "${newValue?.status || 'Active'}"`;
      case 'SIGNUP':
        return `Created company organization account "${newValue?.companyName || ''}" and joined as Administrator`;
      case 'USER_SIGNIN':
        return `${actorName || 'User'} (${actorRole || 'Member'}) logged into RebarOptima`;
      case 'DEVELOPER_LOGIN':
        return `Platform Developer logged into the management portal`;
      case 'INVENTORY_INWARD':
        if (newValue?.diameter) {
          return `Added inward stock: ${newValue.quantity || 0} bars of ${newValue.diameter}mm (${Number(newValue.weightInKgs || 0).toFixed(1)} kg)${newValue.brandName ? ` - ${newValue.brandName}` : ''}`;
        }
        return `Added new steel stock into inventory`;
      case 'INVENTORY_UPDATE':
        if (previousValue?.quantity !== undefined && newValue?.quantity !== undefined) {
          return `Updated bar stock from ${previousValue.quantity} pcs to ${newValue.quantity} pcs (${Number(newValue.weightInKgs || 0).toFixed(1)} kg)`;
        }
        return `Updated steel inventory quantity and weight`;
      case 'INVENTORY_DELETE':
        if (previousValue?.diameter) {
          return `Deleted ${previousValue.diameter}mm stock item (${previousValue.quantity || 0} pcs, ${Number(previousValue.weightInKgs || 0).toFixed(1)} kg) from inventory`;
        }
        return `Deleted stock item from inventory`;
      case 'BATCH_CREATED':
        return `Executed cutting batch "${newValue?.batchName || 'Cutting Batch'}" and deducted steel stock`;
      case 'BATCH_UPDATED':
        return `Renamed cutting batch to "${newValue?.batchName || 'Cutting Batch'}"`;
      case 'BATCH_DELETED':
        return `Deleted cutting batch "${previousValue?.batchName || 'Cutting Batch'}"`;
      case 'SCRAP_SALE_CREATED':
        if (newValue?.buyer && newValue?.weight) {
          const rev = Number(newValue.revenue || (newValue.weight * (newValue.pricePerKg || 0))).toLocaleString();
          return `Sold ${newValue.weight} kg scrap steel to "${newValue.buyer}" for ₹${rev}`;
        }
        return `Recorded new scrap steel sale`;
      case 'SCRAP_SALE_UPDATED':
        return `Updated scrap sale record for buyer "${newValue?.buyer || 'Buyer'}"`;
      case 'SCRAP_SALE_DELETED':
        return `Deleted scrap sale record (${previousValue?.weight || 0} kg sold to "${previousValue?.buyer || 'Buyer'}")`;
      case 'SCRAP_RULES_UPDATED':
        return `Updated scrap length threshold settings for rebar cuts`;
      case 'USER_CREATED':
        return `Added new team member ${newValue?.email || ''} as ${newValue?.role || 'User'}`;
      case 'USER_UPDATED':
        return `Updated profile and permissions for team member`;
      case 'USER_STATUS_CHANGED':
      case 'USER_ACTIVATED':
        return `Activated team member account`;
      case 'USER_DEACTIVATED':
        return `Deactivated team member account`;
      case 'ROLE_CREATED':
        return `Created new company role "${newValue?.name || 'Custom Role'}"`;
      case 'ROLE_UPDATED':
        return `Updated permissions for role "${newValue?.name || previousValue?.name || 'Role'}"`;
      case 'ROLE_DELETED':
        return `Deactivated role "${previousValue?.name || 'Role'}"`;
      case 'FIRM_HARD_DELETED':
        return `Permanently removed organization records`;
      default:
        return `${action.replace(/_/g, ' ').toLowerCase()} on ${log.module || 'system'}`;
    }
  };

  // Helper to format user display details cleanly
  const getActorDisplay = (log) => {
    if (log.actorType === 'developer') {
      return {
        name: log.actorName || 'Platform Support',
        email: log.actorEmail || 'platform@rebaroptima.com',
        role: 'Platform Support',
        initials: 'PS'
      };
    }
    const rawName = log.actorName;
    const isGeneric = !rawName || rawName === 'Unknown User' || rawName === 'System / User' || rawName === 'System / Unknown';
    const name = isGeneric 
      ? (log.actorEmail ? log.actorEmail.split('@')[0] : 'System Admin')
      : rawName;
    const email = log.actorEmail || 'system';
    const role = log.actorRole || 'Admin';
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SA';

    return { name, email, role, initials };
  };

  return (
    <div className="activity-logs-container">
      {/* Header Banner */}
      <div className="activity-header">
        <div className="activity-header-left">
          <div className="activity-title-wrapper">
            <div className="activity-icon-bubble">
              <Shield className="activity-shield-icon" size={24} />
            </div>
            <div>
              <h1 className="activity-page-title">Company Activity Logs & Audit Trail</h1>
              <p className="activity-page-subtitle">
                Clear plain-English history of who made changes, their role, timestamp, and exact details in your company.
              </p>
            </div>
          </div>
        </div>

        <div className="activity-header-actions">
          <button 
            className="btn-activity-secondary" 
            onClick={fetchLogs} 
            disabled={loading}
            title="Refresh Logs"
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
          <button 
            className="btn-activity-primary" 
            onClick={handleExportCSV} 
            disabled={exporting || logs.length === 0}
            title="Download CSV Audit Record"
          >
            <Download size={16} />
            <span>{exporting ? 'Exporting...' : 'Export Audit CSV'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="activity-kpi-grid">
        <div className="activity-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Total Movements</span>
            <span className="kpi-icon-pill icon-purple"><History size={16} /></span>
          </div>
          <div className="kpi-card-value">{stats.totalLogs.toLocaleString()}</div>
          <div className="kpi-card-footnote">Overall historical records</div>
        </div>

        <div className="activity-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Actions Today</span>
            <span className="kpi-icon-pill icon-emerald"><Sparkles size={16} /></span>
          </div>
          <div className="kpi-card-value">{stats.todayCount.toLocaleString()}</div>
          <div className="kpi-card-footnote">Recorded since 12:00 AM</div>
        </div>

        <div className="activity-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Active Contributors</span>
            <span className="kpi-icon-pill icon-blue"><UserCheck size={16} /></span>
          </div>
          <div className="kpi-card-value">{stats.activeUsersCount.toLocaleString()}</div>
          <div className="kpi-card-footnote">Unique team members</div>
        </div>

        <div className="activity-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Critical Events</span>
            <span className="kpi-icon-pill icon-amber"><AlertTriangle size={16} /></span>
          </div>
          <div className="kpi-card-value">{stats.criticalCount.toLocaleString()}</div>
          <div className="kpi-card-footnote">Deletions & security changes</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="activity-filter-toolbar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by user, description, role, or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="activity-search-input"
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-selects-group">
          {/* Module Filter */}
          <div className="filter-item">
            <label>Module:</label>
            <select 
              value={selectedModule} 
              onChange={(e) => { setSelectedModule(e.target.value); setCurrentPage(1); }}
              className="activity-select"
            >
              <option value="all">All Modules</option>
              <option value="inventory">Inventory</option>
              <option value="optimizer">Optimizer</option>
              <option value="history">Batch History</option>
              <option value="scrapSales">Scrap Sales</option>
              <option value="users">Users</option>
              <option value="roles">Roles</option>
              <option value="settings">Settings</option>
              <option value="auth">Authentication</option>
            </select>
          </div>

          {/* User Filter */}
          <div className="filter-item">
            <label>Member:</label>
            <select 
              value={selectedUser} 
              onChange={(e) => { setSelectedUser(e.target.value); setCurrentPage(1); }}
              className="activity-select"
            >
              <option value="all">All Users</option>
              {usersList.map(u => (
                <option key={u.id || u._id} value={u.id || u._id}>
                  {u.firstName} {u.lastName} ({u.roleName || u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Presets */}
          <div className="filter-item">
            <label>Timeframe:</label>
            <select 
              value={dateRange} 
              onChange={(e) => { setDateRange(e.target.value); setCurrentPage(1); }}
              className="activity-select"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / Feed Section */}
      <div className="activity-table-wrapper">
        {loading ? (
          <div className="activity-state-box">
            <div className="activity-spinner" />
            <p>Loading activity audit records...</p>
          </div>
        ) : error ? (
          <div className="activity-state-box error">
            <AlertTriangle size={32} className="error-icon" />
            <p className="error-msg">{error}</p>
            <button className="btn-activity-secondary" onClick={fetchLogs}>Try Again</button>
          </div>
        ) : logs.length === 0 ? (
          <div className="activity-state-box empty">
            <Shield size={36} className="empty-shield" />
            <h3>No Activity Records Found</h3>
            <p>There are no movements matching your current filters. Every change made by team members will be clearly recorded here in plain English.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="activity-table">
              <thead>
                <tr>
                  <th style={{ width: '175px' }}>Date & Time</th>
                  <th style={{ width: '220px' }}>Responsible User</th>
                  <th style={{ width: '120px' }}>Role</th>
                  <th style={{ width: '130px' }}>Module</th>
                  <th style={{ width: '140px' }}>Action</th>
                  <th>Change Description (Plain English)</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const modBadge = getModuleBadge(log.module);
                  const timeInfo = formatTimestamp(log.timestamp);
                  const actor = getActorDisplay(log);
                  const plainDescription = formatPlainDescription(log);

                  return (
                    <tr key={log.id || log._id} className="activity-row">
                      <td className="col-timestamp">
                        <div className="time-primary">{timeInfo.formatted}</div>
                        <div className="time-relative">{timeInfo.relative}</div>
                      </td>
                      
                      <td className="col-user">
                        <div className="user-cell-wrapper">
                          <div className="user-avatar-badge">{actor.initials}</div>
                          <div className="user-details">
                            <span className="user-name">{actor.name}</span>
                            <span className="user-email">{actor.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="col-role">
                        <span className={`role-badge ${getRoleBadgeClass(actor.role)}`}>
                          {actor.role}
                        </span>
                      </td>

                      <td className="col-module">
                        <span className={`module-badge ${modBadge.className}`}>
                          {modBadge.icon}
                          <span>{modBadge.label}</span>
                        </span>
                      </td>

                      <td className="col-action">
                        <span className={`action-badge ${getActionBadgeClass(log.action)}`}>
                          {log.action?.replace(/_/g, ' ') || 'ACTION'}
                        </span>
                      </td>

                      <td className="col-description">
                        <div className="plain-description-box" title={plainDescription}>
                          {plainDescription}
                        </div>
                      </td>

                      <td className="col-inspect" style={{ textAlign: 'center' }}>
                        {(log.previousValue || log.newValue) ? (
                          <button 
                            className="btn-inspect" 
                            onClick={() => setSelectedLog({ ...log, formattedDesc: plainDescription, actor })}
                            title="View Change Snapshot"
                          >
                            <Eye size={15} />
                          </button>
                        ) : (
                          <span className="no-diff-dash">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && pagination.totalPages > 1 && (
          <div className="activity-pagination">
            <div className="pagination-info">
              Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, pagination.total)}</strong> of <strong>{pagination.total}</strong> events
            </div>
            <div className="pagination-controls">
              <button 
                className="btn-page" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>
              <div className="page-indicator">
                Page {currentPage} of {pagination.totalPages}
              </div>
              <button 
                className="btn-page" 
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage >= pagination.totalPages}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details & Diff Modal */}
      {selectedLog && (
        <div className="activity-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="activity-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Shield size={20} className="modal-shield" />
                <h3>Change Snapshot Details</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedLog(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Event Metadata Banner */}
              <div className="modal-meta-grid">
                <div className="meta-card">
                  <span className="meta-label">Responsible User:</span>
                  <span className="meta-value">{selectedLog.actor?.name || selectedLog.actorName} ({selectedLog.actor?.email || selectedLog.actorEmail})</span>
                </div>
                <div className="meta-card">
                  <span className="meta-label">Role:</span>
                  <span className="meta-value role-highlight">{selectedLog.actor?.role || selectedLog.actorRole}</span>
                </div>
                <div className="meta-card">
                  <span className="meta-label">Date & Time:</span>
                  <span className="meta-value">{formatTimestamp(selectedLog.timestamp).formatted}</span>
                </div>
                <div className="meta-card">
                  <span className="meta-label">Action:</span>
                  <span className="meta-value code-highlight">{selectedLog.action?.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div className="modal-description-box">
                <strong>Plain English Change Summary:</strong>
                <p>{selectedLog.formattedDesc || selectedLog.description}</p>
              </div>

              {/* Before vs After Diff Section */}
              <div className="diff-comparison-grid">
                {selectedLog.previousValue && (
                  <div className="diff-card previous-card">
                    <div className="diff-card-title">
                      <span className="diff-tag previous">PREVIOUS STATE (BEFORE)</span>
                    </div>
                    <pre className="diff-json-view">
                      {JSON.stringify(selectedLog.previousValue, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.newValue && (
                  <div className="diff-card new-card">
                    <div className="diff-card-title">
                      <span className="diff-tag new">NEW STATE (AFTER)</span>
                    </div>
                    <pre className="diff-json-view">
                      {JSON.stringify(selectedLog.newValue, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-activity-secondary" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
