import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Users, Plus, Search, Filter, Shield, AlertCircle, CheckCircle2,
  Building2, UserCheck, UserX, RefreshCw, X
} from 'lucide-react';
import { usersApi, rolesApi } from '../../utils/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import GovernanceHeader from '../../components/Shared/GovernanceHeader';
import UserCard from './components/UserCard';
import UserDrawer from './components/UserDrawer';
import ConfirmStatusDrawer from './components/ConfirmStatusDrawer';
import { TableSkeleton, useDelayedSkeleton } from '../../components/ui';
import './UsersPage.css';

/**
 * Redesigned Enterprise User Management Page (/users)
 * - Shared Governance Header (Users | Roles & Permissions | Activity Logs)
 * - Top KPI Summary Cards (Total Members, Active, Deactivated, Active Project Members)
 * - Right-Side Slide-Over Drawers (Add/Edit User, Deactivation/Reactivation)
 * - Modern Table (Desktop) + Touch-friendly Cards (Mobile) with >= 44px tap targets
 * - Complete 100% Feature Parity with existing APIs and authorization rules
 */
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [filterByActiveProject, setFilterByActiveProject] = useState(false);

  // Drawer state
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Confirmation Drawer state
  const [confirmTarget, setConfirmTarget] = useState(null); // { user, action, newStatus }
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Context & Redux state
  const currentUser = useSelector((state) => state.auth.user);
  const orgProjects = useSelector((state) => state.project.projects || []);
  const { projectId: activeProjectId, selectedProject } = useActiveProject();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [u, r] = await Promise.all([
        usersApi.getUsers(),
        rolesApi.getRoles(),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setRoles(Array.isArray(r) ? r : []);
    } catch (err) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toast Auto-Dismiss
  const showToast = (message, isError = false) => {
    if (isError) {
      setError(message);
      setTimeout(() => setError(''), 4000);
    } else {
      setSuccess(message);
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  // Open Create Drawer
  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsUserDrawerOpen(true);
  };

  // Open Edit Drawer
  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setIsUserDrawerOpen(true);
  };

  // Save User (Create or Edit)
  const handleSaveUser = async (formData) => {
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        const userId = editingUser.id || editingUser._id;
        await usersApi.updateUser(userId, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          roleId: formData.roleId,
          mobileNumber: formData.mobileNumber,
          assignedProjects: formData.assignedProjects,
        });
        showToast(`User ${formData.firstName} updated successfully`);
      } else {
        await usersApi.createUser({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          roleId: formData.roleId,
          mobileNumber: formData.mobileNumber,
          assignedProjects: formData.assignedProjects,
        });
        showToast(
          formData.accessMethod === 'invite'
            ? `User ${formData.firstName} provisioned & invite link prepared`
            : `User ${formData.firstName} created successfully`
        );
      }

      setIsUserDrawerOpen(false);
      setEditingUser(null);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to save user', true);
    } finally {
      setSaving(false);
    }
  };

  // Request Deactivate / Reactivate
  const handleRequestToggleStatus = (user) => {
    const userId = String(user.id || user._id);
    const currentId = String(currentUser?.id || currentUser?._id || '');
    if (userId === currentId) {
      showToast('You cannot deactivate your own account', true);
      return;
    }

    const newStatus = user.isActive === false;
    const action = newStatus ? 'reactivate' : 'deactivate';
    setConfirmTarget({ user, action, newStatus });
  };

  // Confirm Status Toggle
  const handleConfirmToggleStatus = async () => {
    if (!confirmTarget) return;
    const { user, newStatus, action } = confirmTarget;
    setConfirmLoading(true);

    try {
      const userId = user.id || user._id;
      await usersApi.updateUserStatus(userId, newStatus);
      showToast(`User ${user.firstName} ${action}d successfully`);
      setConfirmTarget(null);
      await loadData();
    } catch (err) {
      showToast(err.message || `Failed to ${action} user`, true);
    } finally {
      setConfirmLoading(false);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const searchStr = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''} ${u.roleName || u.role || ''}`.toLowerCase();
        if (!searchStr.includes(q)) return false;
      }

      // 2. Status Filter
      const isActive = u.isActive !== false;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;

      // 3. Active Project Filter
      if (filterByActiveProject && activeProjectId) {
        const assigned = (u.assignedProjects || []).map(String);
        if (!assigned.includes(String(activeProjectId))) return false;
      }

      return true;
    });
  }, [users, search, statusFilter, filterByActiveProject, activeProjectId]);

  // KPI Metrics
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.isActive !== false).length;
  const inactiveCount = totalCount - activeCount;
  const activeProjUsersCount = activeProjectId
    ? users.filter((u) => (u.assignedProjects || []).map(String).includes(String(activeProjectId))).length
    : 0;

  const showSkeleton = useDelayedSkeleton(loading);
  if (showSkeleton) {
    return <div className="users-page-container"><TableSkeleton rows={6} cols={6} /></div>;
  }
  if (loading) return null;

  const headerActions = (
    <button
      type="button"
      className="ro-btn ro-btn--primary"
      onClick={handleOpenCreate}
    >
      <Plus size={16} /> Add Team Member
    </button>
  );

  return (
    <div className="users-page-container">
      {/* ── SHARED GOVERNANCE HEADER ── */}
      <GovernanceHeader
        activeTab="users"
        title="Access & Governance"
        subtitle="Manage team members, roles, granular permissions, and security audit logs"
        actions={headerActions}
      />

      {/* ── TOAST NOTIFICATIONS ── */}
      {error && (
        <div className="users-toast error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="toast-close-btn" aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="users-toast success" role="status">
          <CheckCircle2 size={16} />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess('')} className="toast-close-btn" aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── KPI TILES ── */}
      <div className="users-kpi-grid">
        <div className="users-kpi-card">
          <div className="kpi-icon-box users">
            <Users size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Members</span>
            <span className="kpi-value">{totalCount}</span>
          </div>
        </div>

        <div className="users-kpi-card">
          <div className="kpi-icon-box active">
            <UserCheck size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Active Accounts</span>
            <span className="kpi-value">{activeCount}</span>
          </div>
        </div>

        <div className="users-kpi-card">
          <div className="kpi-icon-box inactive">
            <UserX size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Deactivated</span>
            <span className="kpi-value">{inactiveCount}</span>
          </div>
        </div>

        {selectedProject && (
          <div className="users-kpi-card">
            <div className="kpi-icon-box project">
              <Building2 size={18} />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">{selectedProject.name}</span>
              <span className="kpi-value">{activeProjUsersCount} Assigned</span>
            </div>
          </div>
        )}
      </div>

      {/* ── TOOLBAR: SEARCH, FILTERS, & STATS ── */}
      <div className="users-toolbar-card">
        <div className="users-search-box">
          <Search size={16} className="users-search-icon" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="users-search-input"
          />
          {search && (
            <button
              type="button"
              className="users-search-clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="users-filters-row">
          {/* Active project filter checkbox */}
          {activeProjectId && (
            <label className="users-checkbox-filter">
              <input
                type="checkbox"
                checked={filterByActiveProject}
                onChange={(e) => setFilterByActiveProject(e.target.checked)}
              />
              <span>In active project ({selectedProject?.name || 'Project'})</span>
            </label>
          )}

          {/* Status selector */}
          <div className="users-status-select-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="users-status-select"
            >
              <option value="all">All Statuses ({totalCount})</option>
              <option value="active">Active ({activeCount})</option>
              <option value="inactive">Deactivated ({inactiveCount})</option>
            </select>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            className="users-refresh-btn"
            onClick={loadData}
            title="Refresh list"
            aria-label="Refresh user list"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── DESKTOP TABLE VIEW ── */}
      <div className="users-desktop-table-card">
        <div className="ro-table-scroll">
          <table className="users-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Team Member</th>
                <th style={{ width: '18%' }}>Role</th>
                <th style={{ width: '22%' }}>Assigned Projects</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '10%' }}>Activity</th>
                <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSelf = String(u.id || u._id) === String(currentUser?.id || currentUser?._id);
                return (
                  <UserCard
                    key={u.id || u._id}
                    user={u}
                    isSelf={isSelf}
                    allProjects={orgProjects}
                    onEdit={handleOpenEdit}
                    onRequestToggleStatus={handleRequestToggleStatus}
                    mode="table-row"
                  />
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="6" className="users-empty-cell">
                    <div className="users-empty-state">
                      <Users size={32} className="empty-icon" />
                      <h4>No team members found</h4>
                      <p>
                        {search || statusFilter !== 'all' || filterByActiveProject
                          ? 'No users match your active filters or search keyword.'
                          : 'No team members provisioned yet in this company.'}
                      </p>
                      {(search || statusFilter !== 'all' || filterByActiveProject) && (
                        <button
                          type="button"
                          className="ro-btn ro-btn--secondary ro-btn--sm"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('all');
                            setFilterByActiveProject(false);
                          }}
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MOBILE CARDS VIEW ── */}
      <div className="users-mobile-cards-stack">
        {filteredUsers.map((u) => {
          const isSelf = String(u.id || u._id) === String(currentUser?.id || currentUser?._id);
          return (
            <UserCard
              key={u.id || u._id}
              user={u}
              isSelf={isSelf}
              allProjects={orgProjects}
              onEdit={handleOpenEdit}
              onRequestToggleStatus={handleRequestToggleStatus}
              mode="mobile-card"
            />
          );
        })}
        {filteredUsers.length === 0 && (
          <div className="users-empty-state mobile">
            <Users size={32} className="empty-icon" />
            <h4>No team members found</h4>
            <p>Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* ── USER CREATE & EDIT DRAWER ── */}
      <UserDrawer
        isOpen={isUserDrawerOpen}
        onClose={() => {
          setIsUserDrawerOpen(false);
          setEditingUser(null);
        }}
        editingUser={editingUser}
        roles={roles}
        projects={orgProjects}
        activeProjectId={activeProjectId}
        onSave={handleSaveUser}
        saving={saving}
        apiError={error}
      />

      {/* ── DEACTIVATE / REACTIVATE CONFIRMATION DRAWER ── */}
      <ConfirmStatusDrawer
        isOpen={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        user={confirmTarget?.user}
        action={confirmTarget?.action}
        onConfirm={handleConfirmToggleStatus}
        loading={confirmLoading}
      />
    </div>
  );
}
