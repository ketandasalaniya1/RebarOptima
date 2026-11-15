import React, { useState, useEffect, useCallback } from 'react';
import {
  History, Download, RefreshCw, AlertTriangle, CheckCircle2,
  Users, Activity, ShieldAlert, Clock, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { activityLogsApi, usersApi } from '../../utils/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import GovernanceHeader from '../../components/Shared/GovernanceHeader';
import LogRow from './components/LogRow';
import DiffDrawer from './components/DiffDrawer';
import LogFilters from './components/LogFilters';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './ActivityLogsPage.css';

/**
 * Redesigned Enterprise Activity Logs & Forensic Audit Trail (/activity-logs)
 * - Shared Governance Header (Users | Roles & Permissions | Activity Logs)
 * - 4 Top Metric KPI Tiles (Total Events, Today, Active Users, Critical Operations)
 * - Multi-attribute Filter Toolbar (Search, Module, Action, User, Date Range, Export)
 * - Right-Side Slide-Over Diff Drawer with Field-by-Field Visual Changes (No raw JSON)
 * - Modern Desktop Table + Mobile Cards with >= 44px tap targets
 */
export default function ActivityLogsPage() {
  const { projectId: activeProjectId, projectEpoch } = useActiveProject();
  const [logs, setLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [dateRange, setDateRange] = useState('all'); // 'all' | 'today' | '7days' | '30days'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Stats & Pagination
  const [stats, setStats] = useState({
    totalLogs: 0,
    todayCount: 0,
    activeUsersCount: 0,
    criticalCount: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  // Selected Log for Diff Drawer
  const [selectedLog, setSelectedLog] = useState(null);

  // Load available users for filter
  useEffect(() => {
    usersApi
      .getUsers()
      .then((data) => {
        if (Array.isArray(data)) setUsersList(data);
      })
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let startDate = null;
      let endDate = null;

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
        projectId: activeProjectId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (res && res.logs) {
        setLogs(res.logs);
        if (res.pagination) setPagination(res.pagination);
        if (res.stats) setStats(res.stats);
      } else if (Array.isArray(res)) {
        setLogs(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    searchQuery,
    selectedModule,
    selectedAction,
    selectedUser,
    dateRange,
    activeProjectId,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, projectEpoch]);

  // Handle Debounced Search Reset Page
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

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
        startDate: startDate || undefined,
      });
      setSuccess('Audit logs exported successfully');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Error exporting logs: ' + err.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="activity-logs-container">
      {/* ── SHARED GOVERNANCE HEADER ── */}
      <GovernanceHeader
        activeTab="activity-logs"
        title="Access & Governance"
        subtitle="Manage team members, roles, granular permissions, and security audit logs"
      />

      {/* ── TOAST NOTIFICATIONS ── */}
      {error && (
        <div className="activity-toast error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="toast-close-btn" aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="activity-toast success" role="status">
          <CheckCircle2 size={16} />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess('')} className="toast-close-btn" aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 4 KPI METRIC TILES ── */}
      <div className="activity-kpi-grid">
        <div className="activity-kpi-card">
          <div className="kpi-icon-box total">
            <History size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Events</span>
            <span className="kpi-value">{stats.totalLogs}</span>
          </div>
        </div>

        <div className="activity-kpi-card">
          <div className="kpi-icon-box today">
            <Activity size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Actions Today</span>
            <span className="kpi-value">{stats.todayCount}</span>
          </div>
        </div>

        <div className="activity-kpi-card">
          <div className="kpi-icon-box users">
            <Users size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Active Users</span>
            <span className="kpi-value">{stats.activeUsersCount}</span>
          </div>
        </div>

        <div className="activity-kpi-card">
          <div className="kpi-icon-box critical">
            <ShieldAlert size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Critical Actions</span>
            <span className="kpi-value">{stats.criticalCount}</span>
          </div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <LogFilters
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedModule={selectedModule}
        onModuleChange={(val) => {
          setSelectedModule(val);
          setCurrentPage(1);
        }}
        selectedAction={selectedAction}
        onActionChange={(val) => {
          setSelectedAction(val);
          setCurrentPage(1);
        }}
        selectedUser={selectedUser}
        onUserChange={(val) => {
          setSelectedUser(val);
          setCurrentPage(1);
        }}
        dateRange={dateRange}
        onDateRangeChange={(val) => {
          setDateRange(val);
          setCurrentPage(1);
        }}
        usersList={usersList}
        onRefresh={fetchLogs}
        onExportCsv={handleExportCSV}
        exporting={exporting}
      />

      {/* ── AUDIT LOG LIST (DESKTOP TABLE) ── */}
      <div className="activity-desktop-table-card">
        {loading ? (
          <div style={{ padding: '48px 0' }}>
            <LoadingSpinner message="Querying security audit logs..." minHeight="200px" />
          </div>
        ) : (
          <div className="ro-table-scroll">
            <table className="activity-table">
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>User / Staff</th>
                  <th style={{ width: '38%' }}>Action & Description</th>
                  <th style={{ width: '14%' }}>Module</th>
                  <th style={{ width: '12%' }}>Action Type</th>
                  <th style={{ width: '12%' }}>Timestamp</th>
                  <th style={{ width: '6%', textAlign: 'right' }}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <LogRow
                    key={log._id || log.id}
                    log={log}
                    onInspect={setSelectedLog}
                    mode="table-row"
                  />
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="6" className="activity-empty-cell">
                      <div className="activity-empty-state">
                        <History size={32} className="empty-icon" />
                        <h4>No audit events found</h4>
                        <p>No activity logs match your selected filter criteria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Desktop Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="activity-pagination-bar">
            <div className="pagination-text">
              Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> to{' '}
              <strong>{Math.min(currentPage * pageSize, pagination.total)}</strong> of{' '}
              <strong>{pagination.total}</strong> records
            </div>
            <div className="pagination-buttons">
              <button
                type="button"
                className="ro-btn ro-btn--secondary ro-btn--sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="pagination-indicator">
                Page {currentPage} of {pagination.totalPages}
              </span>
              <button
                type="button"
                className="ro-btn ro-btn--secondary ro-btn--sm"
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage >= pagination.totalPages}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── AUDIT LOG LIST (MOBILE CARDS STACK) ── */}
      <div className="activity-mobile-stack">
        {loading ? (
          <LoadingSpinner message="Querying security audit logs..." minHeight="200px" />
        ) : (
          <>
            {logs.map((log) => (
              <LogRow
                key={log._id || log.id}
                log={log}
                onInspect={setSelectedLog}
                mode="mobile-card"
              />
            ))}
            {logs.length === 0 && (
              <div className="activity-empty-state mobile">
                <History size={32} className="empty-icon" />
                <h4>No audit events found</h4>
                <p>Try adjusting your search or filters.</p>
              </div>
            )}
            {pagination.totalPages > 1 && (
              <div className="activity-pagination-bar mobile">
                <button
                  type="button"
                  className="ro-btn ro-btn--secondary ro-btn--sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="pagination-indicator">
                  {currentPage} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="ro-btn ro-btn--secondary ro-btn--sm"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage >= pagination.totalPages}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FIELD-BY-FIELD DIFF DRAWER ── */}
      <DiffDrawer
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        log={selectedLog}
      />
    </div>
  );
}
