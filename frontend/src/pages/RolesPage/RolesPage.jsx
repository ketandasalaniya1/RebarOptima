import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Shield, Plus, Edit3, Trash2, Users, ChevronDown, ChevronRight, Save, X, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { rolesApi, permissionsApi } from '../../utils/api';
import './RolesPage.css';

const MODULE_LABELS = {
  overview: 'Overview / Dashboard',
  inventory: 'Inventory',
  optimizer: 'Run Optimizer',
  history: 'Batch History',
  ledger: 'Ledger & Orders',
  scrapSales: 'Scrap Sales',
  settings: 'Settings',
  users: 'User Management',
  roles: 'Roles & Permissions'
};

const FEATURE_LABELS = {
  view: 'View', inward: 'Add / Inward', create: 'Create', edit: 'Edit',
  delete: 'Delete', export: 'Export'
};

const DATA_SCOPE_OPTIONS = [
  { value: 'organization', label: 'Entire Organization' },
  { value: 'project', label: 'Assigned Projects Only' },
  { value: 'own', label: 'Own Data Only' }
];

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [expandedRole, setExpandedRole] = useState(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formScope, setFormScope] = useState('organization');
  const [formPermissions, setFormPermissions] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        rolesApi.getRoles(),
        permissionsApi.getModules().catch(() => ({}))
      ]);
      setRoles(r || []);
      setModules(m || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingRole(null);
    setFormName('');
    setFormDesc('');
    setFormScope('organization');
    // Initialize all permissions to false
    const perms = {};
    for (const mod of Object.keys(modules)) {
      perms[mod] = {};
      for (const feat of Object.keys(modules[mod]?.features || {})) {
        perms[mod][feat] = false;
      }
    }
    setFormPermissions(perms);
    setShowForm(true);
    setError('');
  };

  const openEditForm = (role) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormDesc(role.description || '');
    setFormScope(role.dataScope || 'organization');
    // Load existing permissions
    const perms = {};
    for (const mod of Object.keys(modules)) {
      perms[mod] = {};
      for (const feat of Object.keys(modules[mod]?.features || {})) {
        perms[mod][feat] = role.permissions?.[mod]?.[feat] === true;
      }
    }
    setFormPermissions(perms);
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!formName.trim()) { setError('Role name is required'); return; }
    setError('');
    try {
      const dto = { name: formName.trim(), description: formDesc, permissions: formPermissions, dataScope: formScope };
      if (editingRole) {
        await rolesApi.updateRole(editingRole.id || editingRole._id, dto);
        setSuccess('Role updated successfully');
      } else {
        await rolesApi.createRole(dto);
        setSuccess('Role created successfully');
      }
      setShowForm(false);
      setEditingRole(null);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (role) => {
    if (!confirm(`Deactivate role "${role.name}"? Users assigned to this role will need to be reassigned.`)) return;
    try {
      await rolesApi.deleteRole(role.id || role._id);
      setSuccess('Role deactivated');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleModuleAll = (mod, value) => {
    setFormPermissions(prev => {
      const updated = { ...prev };
      updated[mod] = { ...updated[mod] };
      for (const feat of Object.keys(modules[mod]?.features || {})) {
        updated[mod][feat] = value;
      }
      return updated;
    });
  };

  const toggleFeature = (mod, feat) => {
    setFormPermissions(prev => {
      const updated = { ...prev };
      updated[mod] = { ...updated[mod], [feat]: !updated[mod]?.[feat] };
      return updated;
    });
  };

  if (loading) {
    return <div className="roles-page"><div className="roles-loading"><div className="roles-spinner"></div><p>Loading roles...</p></div></div>;
  }

  return (
    <div className="roles-page">
      <div className="roles-header">
        <div className="roles-title-section">
          <Shield size={22} className="roles-title-icon" />
          <div>
            <h2>Roles & Permissions</h2>
            <p>Manage access control for your organization</p>
          </div>
        </div>
        {!showForm && (
          <button className="roles-create-btn" onClick={openCreateForm}>
            <Plus size={16} /> Create Custom Role
          </button>
        )}
      </div>

      {error && <div className="roles-error"><AlertTriangle size={14} /> {error}</div>}
      {success && <div className="roles-success">{success}</div>}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="roles-form-card">
          <div className="roles-form-header">
            <h3>{editingRole ? 'Edit Role' : 'Create New Role'}</h3>
            <button className="roles-close-btn" onClick={() => { setShowForm(false); setEditingRole(null); }}><X size={18} /></button>
          </div>

          <div className="roles-form-body">
            <div className="roles-form-row">
              <div className="roles-field">
                <label>Role Name *</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Site Supervisor" />
              </div>
              <div className="roles-field">
                <label>Data Scope</label>
                <select value={formScope} onChange={e => setFormScope(e.target.value)}>
                  {DATA_SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="roles-field">
              <label>Description</label>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Brief description of this role" />
            </div>

            <div className="roles-permissions-matrix">
              <h4>Permission Matrix</h4>
              {Object.entries(modules).map(([modKey, modDef]) => {
                const features = modDef.features || {};
                const allEnabled = Object.keys(features).every(f => formPermissions[modKey]?.[f]);
                const anyEnabled = Object.keys(features).some(f => formPermissions[modKey]?.[f]);
                return (
                  <div key={modKey} className="roles-module-block">
                    <div className="roles-module-header">
                      <button
                        className={`roles-module-toggle ${allEnabled ? 'on' : anyEnabled ? 'partial' : 'off'}`}
                        onClick={() => toggleModuleAll(modKey, !allEnabled)}
                      >
                        {allEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <span className="roles-module-name">{MODULE_LABELS[modKey] || modKey}</span>
                    </div>
                    <div className="roles-features-row">
                      {Object.entries(features).map(([featKey, featLabel]) => (
                        <label key={featKey} className={`roles-feature-check ${formPermissions[modKey]?.[featKey] ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={!!formPermissions[modKey]?.[featKey]}
                            onChange={() => toggleFeature(modKey, featKey)}
                          />
                          <span>{FEATURE_LABELS[featKey] || featLabel}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="roles-form-actions">
              <button className="roles-cancel-btn" onClick={() => { setShowForm(false); setEditingRole(null); }}>Cancel</button>
              <button className="roles-save-btn" onClick={handleSave}><Save size={14} /> {editingRole ? 'Update Role' : 'Create Role'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Roles List */}
      {!showForm && (
        <div className="roles-list">
          {roles.map(role => {
            const isExpanded = expandedRole === (role.id || role._id);
            return (
              <div key={role.id || role._id} className={`roles-card ${isExpanded ? 'expanded' : ''}`}>
                <div className="roles-card-header" onClick={() => setExpandedRole(isExpanded ? null : (role.id || role._id))}>
                  <div className="roles-card-left">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div>
                      <span className="roles-name">{role.name}</span>
                      {role.isSystem && <span className="roles-system-badge">System</span>}
                    </div>
                  </div>
                  <div className="roles-card-right">
                    <span className="roles-user-count"><Users size={14} /> {role.userCount ?? 0} users</span>
                    <span className="roles-scope-badge">{role.dataScope || 'organization'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="roles-card-body">
                    {role.description && <p className="roles-desc">{role.description}</p>}
                    <div className="roles-perm-grid">
                      {Object.entries(role.permissions || {}).map(([mod, feats]) => (
                        <div key={mod} className="roles-perm-module">
                          <span className="roles-perm-mod-name">{MODULE_LABELS[mod] || mod}</span>
                          <div className="roles-perm-feats">
                            {Object.entries(feats).map(([feat, allowed]) => (
                              <span key={feat} className={`roles-perm-feat ${allowed ? 'allowed' : 'denied'}`}>
                                {FEATURE_LABELS[feat] || feat}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!role.isSystem && (
                      <div className="roles-card-actions">
                        <button className="roles-edit-btn" onClick={(e) => { e.stopPropagation(); openEditForm(role); }}>
                          <Edit3 size={14} /> Edit
                        </button>
                        <button className="roles-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(role); }}>
                          <Trash2 size={14} /> Deactivate
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {roles.length === 0 && <div className="roles-empty">No roles found. Create your first custom role.</div>}
        </div>
      )}
    </div>
  );
}
