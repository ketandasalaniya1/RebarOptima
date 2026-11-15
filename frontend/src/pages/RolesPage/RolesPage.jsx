import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Shield, Users, Plus, Edit3, Trash2, Copy, AlertCircle, CheckCircle2,
  Globe, Building2, User, ChevronLeft, ArrowRight, UserPlus, Mail, Phone
} from 'lucide-react';
import { rolesApi, permissionsApi, usersApi } from '../../utils/api';
import GovernanceHeader from '../../components/Shared/GovernanceHeader';
import RoleList from './components/RoleList';
import RoleDrawer from './components/RoleDrawer';
import AssignMemberDrawer from './components/AssignMemberDrawer';
import PermissionMatrix from './components/PermissionMatrix';
import { TableSkeleton, useDelayedSkeleton } from '../../components/ui';
import {
  emptyPermissionsFromModules,
  permissionsFromRole,
  isModuleEnabled,
  toggleModule,
  toggleFeature,
  scopeLabel,
  deepClonePermissions,
  permissionsEqual,
  uniqueCustomRoleName,
  ensureViewForEnabledModules,
} from './permissionMatrix';
import './RolesPage.css';

function roleIdOf(role) {
  return role?.id || role?._id;
}

function userDisplayName(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || 'User';
}

function userRoleId(user) {
  const rid = user.roleId;
  if (!rid) return null;
  return typeof rid === 'object' ? String(rid._id || rid.id || rid) : String(rid);
}

/**
 * Redesigned Enterprise Roles & Permissions Page (/roles)
 * - Shared Governance Header (Users | Roles & Permissions | Activity Logs)
 * - Split View Layout (Left: Roles list, Right: Detail & Permissions Matrix)
 * - Granular Permissions Matrix with Module toggles and feature pills
 * - System Role Guard with "Duplicate & Customize" workflow
 * - Slide-over Drawers for Role Creation, Editing, and Member Assignment
 */
export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [detailTab, setDetailTab] = useState('permissions'); // 'permissions' | 'members'

  // Matrix edit state
  const [formPermissions, setFormPermissions] = useState({});
  const [baselinePermissions, setBaselinePermissions] = useState({});

  // Slide-over Drawer States
  const [showNewRoleDrawer, setShowNewRoleDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showAssignDrawer, setShowAssignDrawer] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((r) => String(roleIdOf(r)) === String(selectedRoleId)) || null,
    [roles, selectedRoleId]
  );

  const isSystemRole = Boolean(selectedRole?.isSystem);

  const isDirty = useMemo(
    () => !permissionsEqual(formPermissions, baselinePermissions),
    [formPermissions, baselinePermissions]
  );

  const members = useMemo(() => {
    if (!selectedRoleId) return [];
    return users.filter((u) => String(userRoleId(u)) === String(selectedRoleId));
  }, [users, selectedRoleId]);

  const assignableUsers = useMemo(() => {
    return users
      .filter((u) => u.isActive !== false)
      .filter((u) => String(userRoleId(u)) !== String(selectedRoleId));
  }, [users, selectedRoleId]);

  const showToast = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  const loadData = useCallback(async (preferSelectedId = null) => {
    setLoading(true);
    setError('');
    try {
      const [r, m, u] = await Promise.all([
        rolesApi.getRoles(),
        permissionsApi.getModules().catch(() => ({})),
        usersApi.getUsers().catch(() => []),
      ]);
      const roleList = Array.isArray(r) ? r : [];
      setRoles(roleList);
      setModules(m && typeof m === 'object' ? m : {});
      setUsers(Array.isArray(u) ? u : []);

      // Auto-select first role if none selected or keep preference
      const targetId = preferSelectedId || selectedRoleId || (roleList[0] ? roleIdOf(roleList[0]) : null);
      if (targetId) {
        const targetRole = roleList.find((item) => String(roleIdOf(item)) === String(targetId)) || roleList[0];
        if (targetRole) {
          selectRole(targetRole, m);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to load roles', true);
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadData();
  }, []);

  const selectRole = (role, modDefs = modules) => {
    const id = roleIdOf(role);
    setSelectedRoleId(id);
    const perms = permissionsFromRole(role, modDefs);
    setFormPermissions(perms);
    setBaselinePermissions(deepClonePermissions(perms));
  };

  const handleSelectRoleWithDirtyCheck = (role) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes in the permissions matrix. Discard them and switch role?')) {
        return;
      }
    }
    selectRole(role);
  };

  // Module Toggle
  const handleModuleToggle = (modKey) => {
    if (saving) return;
    const enabled = isModuleEnabled(formPermissions[modKey]);
    setFormPermissions((prev) => toggleModule(modules, prev, modKey, !enabled));
  };

  // Feature Toggle
  const handleFeatureToggle = (modKey, featKey) => {
    if (saving) return;
    if (featKey === 'view') return;
    setFormPermissions((prev) => {
      let next = prev;
      if (!isModuleEnabled(prev[modKey])) {
        next = toggleModule(modules, prev, modKey, true);
        return {
          ...next,
          [modKey]: { ...next[modKey], [featKey]: true },
        };
      }
      return toggleFeature(modules, next, modKey, featKey);
    });
  };

  // Save Permissions Matrix Changes
  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setError('');
    try {
      const permissions = ensureViewForEnabledModules(modules, formPermissions);
      setFormPermissions(permissions);

      if (isSystemRole) {
        // System roles cannot be overwritten; duplicate as custom role
        const copyName = uniqueCustomRoleName(selectedRole.name, roles);
        const created = await rolesApi.createRole({
          name: copyName,
          description: selectedRole.description || '',
          permissions,
          dataScope: selectedRole.dataScope || 'organization',
        });
        showToast(`Saved as custom role "${copyName}" (system roles protected)`);
        await loadData(created?.id || created?._id);
      } else {
        await rolesApi.updateRole(roleIdOf(selectedRole), { permissions });
        setBaselinePermissions(deepClonePermissions(permissions));
        showToast('Permissions matrix updated successfully');
        await loadData(roleIdOf(selectedRole));
      }
    } catch (err) {
      showToast(err.message || 'Failed to update permissions', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardPermissions = () => {
    setFormPermissions(deepClonePermissions(baselinePermissions));
  };

  // Duplicate Role
  const handleDuplicateRole = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setError('');
    try {
      const copyName = uniqueCustomRoleName(selectedRole.name, roles);
      const permissions = permissionsFromRole(selectedRole, modules);
      const created = await rolesApi.createRole({
        name: copyName,
        description: selectedRole.description || '',
        permissions,
        dataScope: selectedRole.dataScope || 'organization',
      });
      showToast(`Role duplicated as "${copyName}"`);
      await loadData(created?.id || created?._id);
    } catch (err) {
      showToast(err.message || 'Failed to duplicate role', true);
    } finally {
      setSaving(false);
    }
  };

  // Create Role from Drawer
  const handleCreateRole = async (formData) => {
    setSaving(true);
    setError('');
    try {
      const permissions = emptyPermissionsFromModules(modules);
      const created = await rolesApi.createRole({
        name: formData.name,
        description: formData.description,
        permissions,
        dataScope: formData.dataScope,
      });
      setShowNewRoleDrawer(false);
      showToast(`Custom role "${formData.name}" created successfully`);
      await loadData(created?.id || created?._id);
    } catch (err) {
      showToast(err.message || 'Failed to create role', true);
    } finally {
      setSaving(false);
    }
  };

  // Edit Role Details from Drawer
  const handleSaveRoleDetails = async (formData) => {
    if (!selectedRole || isSystemRole) return;
    setSaving(true);
    setError('');
    try {
      await rolesApi.updateRole(roleIdOf(selectedRole), {
        name: formData.name,
        description: formData.description,
        dataScope: formData.dataScope,
      });
      setShowEditDrawer(false);
      showToast('Role details updated successfully');
      await loadData(roleIdOf(selectedRole));
    } catch (err) {
      showToast(err.message || 'Failed to update role details', true);
    } finally {
      setSaving(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async () => {
    if (!selectedRole || isSystemRole) return;
    if (
      !window.confirm(
        `Are you sure you want to deactivate role "${selectedRole.name}"? Users assigned to this role must be reassigned.`
      )
    ) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await rolesApi.deleteRole(roleIdOf(selectedRole));
      showToast(`Role "${selectedRole.name}" deactivated`);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete role', true);
    } finally {
      setSaving(false);
    }
  };

  // Assign Member to Role
  const handleAssignMember = async (userId) => {
    if (!userId || !selectedRoleId) return;
    setSaving(true);
    setError('');
    try {
      await usersApi.updateUser(userId, { roleId: selectedRoleId });
      setShowAssignDrawer(false);
      showToast('Team member assigned to role');
      await loadData(selectedRoleId);
    } catch (err) {
      showToast(err.message || 'Failed to assign member', true);
    } finally {
      setSaving(false);
    }
  };

  const showSkeleton = useDelayedSkeleton(loading);
  if (showSkeleton) return <TableSkeleton rows={8} cols={4} />;
  if (loading) return null;

  const headerActions = (
    <button
      type="button"
      className="ro-btn ro-btn--primary"
      onClick={() => setShowNewRoleDrawer(true)}
    >
      <Plus size={16} /> Create Role
    </button>
  );

  return (
    <div className="roles-page-container">
      {/* ── SHARED GOVERNANCE HEADER ── */}
      <GovernanceHeader
        activeTab="roles"
        title="Access & Governance"
        subtitle="Manage team members, roles, granular permissions, and security audit logs"
        actions={headerActions}
      />

      {/* ── TOAST NOTIFICATIONS ── */}
      {error && (
        <div className="roles-toast error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="roles-toast success" role="status">
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* ── MAIN SPLIT-VIEW LAYOUT ── */}
      <div className="roles-split-layout">
        {/* Left Side: Role Roster List */}
        <RoleList
          roles={roles}
          selectedRoleId={selectedRoleId}
          onSelectRole={handleSelectRoleWithDirtyCheck}
          onCreateRole={() => setShowNewRoleDrawer(true)}
        />

        {/* Right Side: Selected Role Details & Matrix */}
        <main className="roles-detail-viewport">
          {selectedRole ? (
            <div className="roles-detail-card">
              {/* Role Header Banner */}
              <div className="rd-header-bar">
                <div className="rd-title-group">
                  <div className="rd-name-row">
                    <h2 className="rd-title">{selectedRole.name}</h2>
                    {isSystemRole ? (
                      <span className="rd-badge system">
                        <Shield size={12} /> System Default
                      </span>
                    ) : (
                      <span className="rd-badge custom">
                        <Users size={12} /> Custom Role
                      </span>
                    )}
                    <span className="rd-scope-pill" title="Data Scope">
                      {selectedRole.dataScope === 'project' ? (
                        <><Building2 size={12} /> Assigned Projects</>
                      ) : selectedRole.dataScope === 'own' ? (
                        <><User size={12} /> Own Data Only</>
                      ) : (
                        <><Globe size={12} /> Entire Organization</>
                      )}
                    </span>
                  </div>
                  <p className="rd-description">
                    {selectedRole.description || 'Standard pre-configured operational role.'}
                  </p>
                </div>

                {/* Role Toolbar Actions */}
                <div className="rd-actions-group">
                  <button
                    type="button"
                    className="ro-btn ro-btn--secondary ro-btn--sm"
                    onClick={handleDuplicateRole}
                    disabled={saving}
                    title="Clone as Custom Role"
                  >
                    <Copy size={14} /> Duplicate
                  </button>

                  {!isSystemRole && (
                    <>
                      <button
                        type="button"
                        className="ro-btn ro-btn--secondary ro-btn--sm"
                        onClick={() => setShowEditDrawer(true)}
                        disabled={saving}
                        title="Edit Role Name & Scope"
                      >
                        <Edit3 size={14} /> Edit
                      </button>

                      <button
                        type="button"
                        className="ro-btn ro-btn--danger ro-btn--sm"
                        onClick={handleDeleteRole}
                        disabled={saving}
                        title="Deactivate Custom Role"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Sub-Tabs: Permissions Matrix vs Assigned Members */}
              <div className="rd-tabs-row">
                <button
                  type="button"
                  className={`rd-tab-btn ${detailTab === 'permissions' ? 'active' : ''}`}
                  onClick={() => setDetailTab('permissions')}
                >
                  <Shield size={15} /> Permissions Matrix
                </button>
                <button
                  type="button"
                  className={`rd-tab-btn ${detailTab === 'members' ? 'active' : ''}`}
                  onClick={() => setDetailTab('members')}
                >
                  <Users size={15} /> Assigned Members ({members.length})
                </button>
              </div>

              {/* TAB 1: Permissions Matrix */}
              {detailTab === 'permissions' && (
                <div className="rd-tab-pane">
                  <PermissionMatrix
                    role={selectedRole}
                    isSystemRole={isSystemRole}
                    modules={modules}
                    formPermissions={formPermissions}
                    isDirty={isDirty}
                    saving={saving}
                    onModuleToggle={handleModuleToggle}
                    onFeatureToggle={handleFeatureToggle}
                    onSave={handleSavePermissions}
                    onDiscard={handleDiscardPermissions}
                    onDuplicate={handleDuplicateRole}
                  />
                </div>
              )}

              {/* TAB 2: Assigned Members */}
              {detailTab === 'members' && (
                <div className="rd-tab-pane members-pane">
                  <div className="rd-members-header">
                    <div>
                      <h4 className="rd-members-title">Assigned Staff Members</h4>
                      <p className="rd-members-sub">
                        Team members who inherit this role's data scopes and module access.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ro-btn ro-btn--primary ro-btn--sm"
                      onClick={() => setShowAssignDrawer(true)}
                    >
                      <UserPlus size={14} /> Assign Member
                    </button>
                  </div>

                  <div className="rd-members-list">
                    {members.map((m) => {
                      const initials = `${m.firstName?.[0] || ''}${m.lastName?.[0] || ''}`.toUpperCase() || 'U';
                      return (
                        <div key={m.id || m._id} className="rd-member-card">
                          <div className="rd-member-avatar">{initials}</div>
                          <div className="rd-member-details">
                            <span className="rd-member-name">{m.firstName} {m.lastName}</span>
                            <span className="rd-member-meta"><Mail size={12} /> {m.email}</span>
                            {m.mobileNumber && (
                              <span className="rd-member-meta"><Phone size={12} /> {m.mobileNumber}</span>
                            )}
                          </div>
                          <span className={`rd-member-status ${m.isActive !== false ? 'active' : 'inactive'}`}>
                            {m.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      );
                    })}

                    {members.length === 0 && (
                      <div className="rd-empty-members">
                        <Users size={32} className="empty-icon" />
                        <h4>No team members assigned to this role yet</h4>
                        <p>Assign existing members or provision new team members under this role.</p>
                        <button
                          type="button"
                          className="ro-btn ro-btn--secondary ro-btn--sm"
                          onClick={() => setShowAssignDrawer(true)}
                        >
                          <UserPlus size={14} /> Assign Member Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="roles-empty-selection">
              <Shield size={36} className="empty-icon" />
              <h3>Select a Role to Inspect Permissions</h3>
              <p>Choose any system or custom role from the left list to review its access matrix.</p>
            </div>
          )}
        </main>
      </div>

      {/* ── DRAWERS ── */}
      {/* Create Role Drawer */}
      <RoleDrawer
        isOpen={showNewRoleDrawer}
        onClose={() => setShowNewRoleDrawer(false)}
        isEditing={false}
        onSave={handleCreateRole}
        saving={saving}
        apiError={error}
      />

      {/* Edit Role Details Drawer */}
      <RoleDrawer
        isOpen={showEditDrawer}
        onClose={() => setShowEditDrawer(false)}
        isEditing={true}
        role={selectedRole}
        onSave={handleSaveRoleDetails}
        saving={saving}
        apiError={error}
      />

      {/* Assign Member Drawer */}
      <AssignMemberDrawer
        isOpen={showAssignDrawer}
        onClose={() => setShowAssignDrawer(false)}
        role={selectedRole}
        assignableUsers={assignableUsers}
        onAssignMember={handleAssignMember}
        assigning={saving}
      />
    </div>
  );
}
