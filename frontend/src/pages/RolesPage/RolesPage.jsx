import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Copy,
  Eye,
  CirclePlus,
  Pencil,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { rolesApi, permissionsApi, usersApi } from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { PageHeader, Button, AppModal, EmptyState } from '../../components/ui';
import {
  emptyPermissionsFromModules,
  permissionsFromRole,
  isModuleEnabled,
  toggleModule,
  toggleFeature,
  splitModuleFeatures,
  groupModules,
  formatRelativeTime,
  scopeLabel,
  deepClonePermissions,
  permissionsEqual,
  uniqueCustomRoleName,
  ensureViewForEnabledModules,
} from './permissionMatrix';
import './RolesPage.css';

const DATA_SCOPE_OPTIONS = [
  { value: 'organization', label: 'Entire Organization' },
  { value: 'project', label: 'Assigned Projects Only' },
  { value: 'own', label: 'Own Data Only' },
];

function roleIdOf(role) {
  return role?.id || role?._id;
}

function userIdOf(user) {
  return user?.id || user?._id;
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

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState('list'); // list | detail
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [detailTab, setDetailTab] = useState('permissions'); // permissions | members
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [openMoreMod, setOpenMoreMod] = useState(null);

  const [formPermissions, setFormPermissions] = useState({});
  const [baselinePermissions, setBaselinePermissions] = useState({});
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formScope, setFormScope] = useState('organization');

  const [showNewRole, setShowNewRole] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleScope, setNewRoleScope] = useState('organization');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignSearch, setAssignSearch] = useState('');

  const selectedRole = useMemo(
    () => roles.find((r) => String(roleIdOf(r)) === String(selectedRoleId)) || null,
    [roles, selectedRoleId]
  );

  // System roles cannot be renamed/deleted on the server; matrix stays editable and saves as a custom copy
  const isSystemRole = !!selectedRole?.isSystem;

  const isDirty = useMemo(
    () => !permissionsEqual(formPermissions, baselinePermissions),
    [formPermissions, baselinePermissions]
  );

  const moduleGroups = useMemo(() => groupModules(modules), [modules]);

  const members = useMemo(() => {
    if (!selectedRoleId) return [];
    return users.filter((u) => String(userRoleId(u)) === String(selectedRoleId));
  }, [users, selectedRoleId]);

  const assignableUsers = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    return users
      .filter((u) => u.isActive !== false)
      .filter((u) => String(userRoleId(u)) !== String(selectedRoleId))
      .filter((u) => {
        if (!q) return true;
        const hay = `${userDisplayName(u)} ${u.email || ''}`.toLowerCase();
        return hay.includes(q);
      });
  }, [users, selectedRoleId, assignSearch]);

  useEffect(() => {
    loadData();
  }, []);

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [r, m, u] = await Promise.all([
        rolesApi.getRoles(),
        permissionsApi.getModules().catch(() => ({})),
        usersApi.getUsers().catch(() => []),
      ]);
      setRoles(Array.isArray(r) ? r : []);
      setModules(m && typeof m === 'object' ? m : {});
      setUsers(Array.isArray(u) ? u : []);
    } catch (err) {
      setError(err.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const openRoleDetail = (role, tab = 'permissions') => {
    const id = roleIdOf(role);
    setSelectedRoleId(id);
    setViewMode('detail');
    setDetailTab(tab);
    setFormName(role.name || '');
    setFormDesc(role.description || '');
    setFormScope(role.dataScope || 'organization');
    const perms = permissionsFromRole(role, modules);
    setFormPermissions(perms);
    setBaselinePermissions(deepClonePermissions(perms));
    setOpenMoreMod(null);
    setError('');
  };

  const backToList = () => {
    if (isDirty) {
      if (!confirm('You have unsaved permission changes. Leave without saving?')) return;
    }
    setViewMode('list');
    setSelectedRoleId(null);
    setFormPermissions({});
    setBaselinePermissions({});
    setOpenMoreMod(null);
  };

  const handleCreateRole = async () => {
    const name = newRoleName.trim();
    if (!name) {
      setError('Role name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const permissions = emptyPermissionsFromModules(modules);
      const created = await rolesApi.createRole({
        name,
        description: newRoleDesc.trim(),
        permissions,
        dataScope: newRoleScope,
      });
      setShowNewRole(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setNewRoleScope('organization');
      flashSuccess('Role created successfully');
      const list = await rolesApi.getRoles();
      const nextRoles = Array.isArray(list) ? list : [];
      setRoles(nextRoles);
      const fresh =
        nextRoles.find((r) => String(roleIdOf(r)) === String(created?.id)) ||
        nextRoles.find((r) => r.name === name);
      if (fresh) openRoleDetail(fresh);
    } catch (err) {
      setError(err.message || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedRole || isSystemRole) return;
    if (!formName.trim()) {
      setError('Role name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await rolesApi.updateRole(roleIdOf(selectedRole), {
        name: formName.trim(),
        description: formDesc,
        dataScope: formScope,
      });
      setShowEditDetails(false);
      await loadData();
      flashSuccess('Role details updated');
    } catch (err) {
      setError(err.message || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setError('');
    try {
      const permissions = ensureViewForEnabledModules(modules, formPermissions);
      setFormPermissions(permissions);
      if (isSystemRole) {
        const copyName = uniqueCustomRoleName(selectedRole.name, roles);
        const created = await rolesApi.createRole({
          name: copyName,
          description: selectedRole.description || '',
          permissions,
          dataScope: selectedRole.dataScope || 'organization',
        });
        const list = await rolesApi.getRoles();
        const nextRoles = Array.isArray(list) ? list : [];
        setRoles(nextRoles);
        const fresh =
          nextRoles.find((r) => String(roleIdOf(r)) === String(created?.id)) ||
          nextRoles.find((r) => r.name === copyName);
        flashSuccess(`Saved as custom role "${copyName}" (system roles cannot be overwritten)`);
        if (fresh) openRoleDetail(fresh);
      } else {
        await rolesApi.updateRole(roleIdOf(selectedRole), { permissions });
        setBaselinePermissions(deepClonePermissions(permissions));
        await loadData();
        flashSuccess('Role settings updated');
      }
    } catch (err) {
      setError(err.message || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleUndoPermissions = () => {
    setFormPermissions(deepClonePermissions(baselinePermissions));
    setOpenMoreMod(null);
  };

  const handleDuplicate = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setError('');
    try {
      const baseName = `${selectedRole.name} (Copy)`;
      const permissions = permissionsFromRole(selectedRole, modules);
      const created = await rolesApi.createRole({
        name: baseName,
        description: selectedRole.description || '',
        permissions,
        dataScope: selectedRole.dataScope || 'organization',
      });
      await loadData();
      flashSuccess('Role duplicated');
      const list = await rolesApi.getRoles();
      setRoles(Array.isArray(list) ? list : []);
      const fresh =
        (Array.isArray(list) ? list : []).find((r) => String(roleIdOf(r)) === String(created?.id)) ||
        (Array.isArray(list) ? list : []).find((r) => r.name === baseName);
      if (fresh) openRoleDetail(fresh);
    } catch (err) {
      setError(err.message || 'Failed to duplicate role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole || isSystemRole) return;
    if (
      !confirm(
        `Deactivate role "${selectedRole.name}"? Users assigned to this role must be reassigned first.`
      )
    ) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await rolesApi.deleteRole(roleIdOf(selectedRole));
      flashSuccess('Role deactivated');
      setViewMode('list');
      setSelectedRoleId(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete role');
    } finally {
      setSaving(false);
    }
  };

  const handleModuleToggle = (modKey) => {
    if (saving) return;
    const enabled = isModuleEnabled(formPermissions[modKey]);
    setFormPermissions((prev) => toggleModule(modules, prev, modKey, !enabled));
  };

  const handleFeatureToggle = (modKey, featKey) => {
    if (saving) return;
    // View is controlled by the module toggle (locked when enabled)
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

  const handleAssignMember = async () => {
    if (!assignUserId || !selectedRoleId) return;
    setSaving(true);
    setError('');
    try {
      await usersApi.updateUser(assignUserId, { roleId: selectedRoleId });
      setShowAssign(false);
      setAssignUserId('');
      setAssignSearch('');
      const u = await usersApi.getUsers();
      setUsers(Array.isArray(u) ? u : []);
      await loadData();
      flashSuccess('Member assigned to role');
    } catch (err) {
      setError(err.message || 'Failed to assign member');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading custom roles & permissions..." minHeight="65vh" />;
  }

  return (
    <div className="roles-page">
      {viewMode === 'list' ? (
        <>
          <PageHeader
            title="User Roles & Permissions"
            subtitle="Use roles to organise your organisation members and customise their permissions. Assign roles from the role page or User Management."
            actions={
              <Button variant="primary" onClick={() => { setShowNewRole(true); setError(''); }}>
                <Plus size={16} /> New Role
              </Button>
            }
          />

          {error && (
            <div className="roles-error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          {success && <div className="roles-success">{success}</div>}

          <div className="roles-table-wrap">
            <table className="roles-list-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Data scope</th>
                  <th>Members</th>
                  <th>Last updated</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={roleIdOf(role)}>
                    <td>
                      <button
                        type="button"
                        className="roles-link"
                        onClick={() => openRoleDetail(role)}
                      >
                        {role.name}
                      </button>
                      {role.isSystem && <span className="roles-default-badge">Default</span>}
                    </td>
                    <td>
                      <span className="roles-scope-badge">{scopeLabel(role.dataScope)}</span>
                    </td>
                    <td>
                      <span className="roles-user-count">
                        <Users size={14} /> {role.userCount ?? 0}
                      </span>
                    </td>
                    <td className="roles-muted">{formatRelativeTime(role.updatedAt || role.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {roles.length === 0 && (
              <EmptyState
                title="No roles found"
                description="Create your first custom role to get started."
              />
            )}
          </div>
        </>
      ) : (
        selectedRole && (
          <>
            <div className="roles-detail-top">
              <button type="button" className="roles-back" onClick={backToList}>
                <ArrowLeft size={16} /> User Roles & Permissions
              </button>
              <span className="roles-crumb-sep">/</span>
              <span className="roles-crumb-current">{selectedRole.name}</span>
            </div>

            <div className="roles-detail-header">
              <div>
                <h2 className="roles-detail-title">
                  {selectedRole.name}
                  {isSystemRole && <span className="roles-default-badge">Default</span>}
                </h2>
                <p className="roles-detail-sub">
                  {selectedRole.description || 'No description'}
                </p>
              </div>
              <div className="roles-detail-actions">
                {!isSystemRole && (
                  <button
                    type="button"
                    className="roles-icon-btn"
                    title="Edit role details"
                    onClick={() => {
                      setFormName(selectedRole.name || '');
                      setFormDesc(selectedRole.description || '');
                      setFormScope(selectedRole.dataScope || 'organization');
                      setShowEditDetails(true);
                    }}
                  >
                    <Edit3 size={16} />
                  </button>
                )}
                <button
                  type="button"
                  className="roles-icon-btn"
                  title="Duplicate role"
                  onClick={handleDuplicate}
                  disabled={saving}
                >
                  <Copy size={16} />
                </button>
                {!isSystemRole && (
                  <button
                    type="button"
                    className="roles-icon-btn roles-icon-btn--danger"
                    title="Deactivate role"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {detailTab === 'members' && (
                  <Button variant="primary" onClick={() => { setShowAssign(true); setError(''); }}>
                    <Plus size={16} /> Add new member
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <div className="roles-error">
                <AlertTriangle size={14} /> {error}
              </div>
            )}
            {success && <div className="roles-success">{success}</div>}

            <div className="roles-tabs">
              <button
                type="button"
                className={`roles-tab ${detailTab === 'permissions' ? 'active' : ''}`}
                onClick={() => setDetailTab('permissions')}
              >
                Role Permissions
              </button>
              <button
                type="button"
                className={`roles-tab ${detailTab === 'members' ? 'active' : ''}`}
                onClick={() => setDetailTab('members')}
              >
                Members on this role
              </button>
            </div>

            {detailTab === 'permissions' && (
              <div className="roles-matrix-card">
                {isSystemRole && (
                  <div className="roles-readonly-banner">
                    Default system role. You can change permissions here; saving creates a custom copy because system roles cannot be overwritten.
                  </div>
                )}

                <div className="roles-matrix-scroll">
                  <table className="roles-perm-table">
                    <thead>
                      <tr>
                        <th className="roles-col-type">Permission type</th>
                        <th className="roles-col-check" title="View">
                          <Eye size={16} />
                          <span>View</span>
                        </th>
                        <th className="roles-col-check" title="Create">
                          <CirclePlus size={16} />
                          <span>Create</span>
                        </th>
                        <th className="roles-col-check" title="Edit">
                          <Pencil size={16} />
                          <span>Edit</span>
                        </th>
                        <th className="roles-col-check" title="Delete">
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </th>
                        <th className="roles-col-more">More permissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moduleGroups.map((group) => {
                        const collapsed = !!collapsedGroups[group.id];
                        return (
                          <React.Fragment key={group.id}>
                            <tr className="roles-group-row">
                              <td colSpan={6}>
                                <button
                                  type="button"
                                  className="roles-group-toggle"
                                  onClick={() =>
                                    setCollapsedGroups((prev) => ({
                                      ...prev,
                                      [group.id]: !prev[group.id],
                                    }))
                                  }
                                >
                                  {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                  <span>
                                    {group.label} ({group.modules.length})
                                  </span>
                                </button>
                              </td>
                            </tr>
                            {!collapsed &&
                              group.modules.map((modKey) => {
                                const modDef = modules[modKey] || {};
                                const features = modDef.features || {};
                                const { crud, more } = splitModuleFeatures(features);
                                const enabled = isModuleEnabled(formPermissions[modKey]);
                                const displayName = modDef.displayName || modKey;
                                const moreOnCount = more.filter((f) => formPermissions[modKey]?.[f]).length;

                                return (
                                  <tr
                                    key={modKey}
                                    className={`roles-mod-row ${enabled ? 'is-on' : 'is-off'}`}
                                  >
                                    <td className="roles-col-type">
                                      <div className="roles-mod-label">
                                        <button
                                          type="button"
                                          className={`roles-switch ${enabled ? 'on' : 'off'}`}
                                          role="switch"
                                          aria-checked={enabled}
                                          aria-label={`Enable ${displayName}`}
                                          disabled={saving}
                                          onClick={() => handleModuleToggle(modKey)}
                                        >
                                          <span className="roles-switch-knob" />
                                        </button>
                                        <span className="roles-mod-name">{displayName}</span>
                                      </div>
                                    </td>
                                    {['view', 'create', 'edit', 'delete'].map((col) => {
                                      const featKey = crud[col];
                                      const available = !!featKey;
                                      const isViewCol = col === 'view';
                                      const checked = isViewCol
                                        ? enabled && available
                                        : available && !!formPermissions[modKey]?.[featKey];
                                      const locked = isViewCol && enabled;
                                      const boxDisabled = !enabled || locked || saving;
                                      return (
                                        <td key={col} className="roles-col-check">
                                          {available ? (
                                            <label
                                              className={[
                                                'roles-checkbox',
                                                checked ? 'is-checked' : '',
                                                !enabled || saving ? 'is-disabled' : '',
                                                locked ? 'is-locked' : '',
                                              ].filter(Boolean).join(' ')}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={boxDisabled}
                                                onChange={() => {
                                                  if (isViewCol) return;
                                                  handleFeatureToggle(modKey, featKey);
                                                }}
                                              />
                                              <span className="roles-checkbox-box" />
                                            </label>
                                          ) : (
                                            <span className="roles-na">—</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="roles-col-more">
                                      {more.length === 0 ? (
                                        <span className="roles-na">—</span>
                                      ) : (
                                        <div className="roles-more-wrap">
                                          <button
                                            type="button"
                                            className="roles-more-link"
                                            disabled={!enabled || saving}
                                            onClick={() =>
                                              setOpenMoreMod((cur) => (cur === modKey ? null : modKey))
                                            }
                                          >
                                            More permissions
                                            {moreOnCount > 0 ? ` (${moreOnCount})` : ''}
                                          </button>
                                          {openMoreMod === modKey && enabled && (
                                            <div className="roles-more-panel">
                                              {more.map((featKey) => (
                                                <label key={featKey} className="roles-more-item">
                                                  <input
                                                    type="checkbox"
                                                    checked={!!formPermissions[modKey]?.[featKey]}
                                                    disabled={saving}
                                                    onChange={() => handleFeatureToggle(modKey, featKey)}
                                                  />
                                                  <span>{features[featKey] || featKey}</span>
                                                </label>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={`roles-matrix-footer ${isDirty ? 'is-dirty' : ''}`}>
                  <Button variant="secondary" onClick={handleUndoPermissions} disabled={!isDirty || saving}>
                    Undo changes
                  </Button>
                  <div className="roles-footer-center">
                    {isDirty && (
                      <span className="roles-dirty-hint">
                        <AlertTriangle size={14} />
                        {isSystemRole
                          ? 'Unsaved changes — Update will create a custom role copy'
                          : 'Unsaved permission changes'}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleSavePermissions}
                    disabled={!isDirty || saving}
                  >
                    Update Role settings
                  </Button>
                </div>
              </div>
            )}

            {detailTab === 'members' && (
              <div className="roles-members-card">
                {members.length === 0 ? (
                  <EmptyState
                    title="No Members have been assigned to this role."
                    description="Use Add new member to assign organisation users to this role."
                  />
                ) : (
                  <table className="roles-list-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Email</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((u) => (
                        <tr key={userIdOf(u)}>
                          <td>{userDisplayName(u)}</td>
                          <td className="roles-muted">{u.email}</td>
                          <td>
                            <span className={`roles-status ${u.isActive === false ? 'off' : 'on'}`}>
                              {u.isActive === false ? 'Inactive' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )
      )}

      {/* New Role */}
      <AppModal
        open={showNewRole}
        title="Add a Role"
        onClose={() => setShowNewRole(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewRole(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateRole} disabled={saving}>
              Add Role
            </Button>
          </>
        }
      >
        <div className="roles-modal-fields">
          <div className="roles-field">
            <label htmlFor="new-role-name">Role Name</label>
            <input
              id="new-role-name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Site Supervisor"
              maxLength={80}
            />
          </div>
          <div className="roles-field">
            <label htmlFor="new-role-desc">Role Description</label>
            <textarea
              id="new-role-desc"
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value.slice(0, 120))}
              placeholder="Brief description of this role"
              rows={3}
              maxLength={120}
            />
            <div className="roles-char-count">{newRoleDesc.length}/120</div>
          </div>
          <div className="roles-field">
            <label htmlFor="new-role-scope">Data Scope</label>
            <select
              id="new-role-scope"
              value={newRoleScope}
              onChange={(e) => setNewRoleScope(e.target.value)}
            >
              {DATA_SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AppModal>

      {/* Edit details */}
      <AppModal
        open={showEditDetails}
        title="Edit role details"
        onClose={() => setShowEditDetails(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditDetails(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveDetails} disabled={saving}>
              Update
            </Button>
          </>
        }
      >
        <div className="roles-modal-fields">
          <div className="roles-field">
            <label htmlFor="edit-role-name">Role Name</label>
            <input
              id="edit-role-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="roles-field">
            <label htmlFor="edit-role-desc">Role Description</label>
            <textarea
              id="edit-role-desc"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value.slice(0, 120))}
              rows={3}
              maxLength={120}
            />
            <div className="roles-char-count">{formDesc.length}/120</div>
          </div>
          <div className="roles-field">
            <label htmlFor="edit-role-scope">Data Scope</label>
            <select
              id="edit-role-scope"
              value={formScope}
              onChange={(e) => setFormScope(e.target.value)}
            >
              {DATA_SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AppModal>

      {/* Assign member */}
      <AppModal
        open={showAssign}
        title="Assign role to member"
        onClose={() => { setShowAssign(false); setAssignUserId(''); setAssignSearch(''); }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setShowAssign(false); setAssignUserId(''); setAssignSearch(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignMember}
              disabled={!assignUserId || saving}
            >
              Assign
            </Button>
          </>
        }
      >
        <div className="roles-modal-fields">
          <div className="roles-field">
            <label htmlFor="assign-search">Search members</label>
            <input
              id="assign-search"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              placeholder="Search by name or email"
            />
          </div>
          <div className="roles-assign-list">
            {assignableUsers.length === 0 && (
              <p className="roles-muted">No eligible members found.</p>
            )}
            {assignableUsers.map((u) => {
              const id = String(userIdOf(u));
              return (
                <label
                  key={id}
                  className={`roles-assign-option ${assignUserId === id ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="assign-user"
                    checked={assignUserId === id}
                    onChange={() => setAssignUserId(id)}
                  />
                  <span>
                    <strong>{userDisplayName(u)}</strong>
                    <span className="roles-muted"> {u.email}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </AppModal>
    </div>
  );
}
