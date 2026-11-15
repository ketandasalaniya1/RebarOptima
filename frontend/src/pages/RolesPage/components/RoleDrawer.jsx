import React, { useState, useEffect } from 'react';
import { Shield, Save, AlertCircle, Building2, User, Globe } from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import './RoleDrawer.css';

/**
 * Slide-over Drawer for Creating or Editing Custom Roles
 */
export default function RoleDrawer({
  isOpen,
  onClose,
  isEditing = false,
  role = null,
  onSave,
  saving = false,
  apiError = '',
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [scope, setScope] = useState('organization');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && role) {
      setName(role.name || '');
      setDesc(role.description || '');
      setScope(role.dataScope || 'organization');
    } else {
      setName('');
      setDesc('');
      setScope('organization');
    }
    setLocalError('');
  }, [isOpen, isEditing, role]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');
    if (!name.trim()) {
      setLocalError('Role name is required');
      return;
    }
    onSave({
      name: name.trim(),
      description: desc.trim(),
      dataScope: scope,
    });
  };

  const footer = (
    <div className="rd-footer-actions">
      <button
        type="button"
        className="ro-btn ro-btn--secondary"
        onClick={onClose}
        disabled={saving}
      >
        Cancel
      </button>
      <button
        type="button"
        className="ro-btn ro-btn--primary"
        onClick={handleSubmit}
        disabled={saving}
      >
        <Save size={15} />
        {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Role')}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Role Details' : 'Create Custom Role'}
      subtitle={
        isEditing
          ? `Modify details and authorization scope for ${role?.name || 'role'}`
          : 'Define a tailored security role with custom permissions'
      }
      icon={<Shield size={18} />}
      width="480px"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="rd-form">
        {(localError || apiError) && (
          <div className="rd-error-banner">
            <AlertCircle size={15} />
            <span>{localError || apiError}</span>
          </div>
        )}

        <div className="rd-field">
          <label className="rd-label">Role Name *</label>
          <input
            type="text"
            required
            className="rd-input"
            placeholder="e.g. Senior Site Engineer"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="rd-field">
          <label className="rd-label">Description</label>
          <textarea
            className="rd-textarea"
            rows={3}
            placeholder="Describe what responsibilities this role handles on site or in office..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        <div className="rd-field">
          <label className="rd-label">Data Visibility Scope *</label>
          <div className="rd-scope-options">
            <label className={`rd-scope-card ${scope === 'organization' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="dataScope"
                value="organization"
                checked={scope === 'organization'}
                onChange={() => setScope('organization')}
                className="rd-radio"
              />
              <div className="rd-scope-body">
                <div className="rd-scope-head">
                  <Globe size={15} className="rd-scope-icon" />
                  <strong>Entire Organization</strong>
                </div>
                <span className="rd-scope-desc">
                  Member can access and inspect data across all company projects.
                </span>
              </div>
            </label>

            <label className={`rd-scope-card ${scope === 'project' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="dataScope"
                value="project"
                checked={scope === 'project'}
                onChange={() => setScope('project')}
                className="rd-radio"
              />
              <div className="rd-scope-body">
                <div className="rd-scope-head">
                  <Building2 size={15} className="rd-scope-icon" />
                  <strong>Assigned Projects Only</strong>
                </div>
                <span className="rd-scope-desc">
                  Member only sees records belonging to projects assigned to them.
                </span>
              </div>
            </label>

            <label className={`rd-scope-card ${scope === 'own' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="dataScope"
                value="own"
                checked={scope === 'own'}
                onChange={() => setScope('own')}
                className="rd-radio"
              />
              <div className="rd-scope-body">
                <div className="rd-scope-head">
                  <User size={15} className="rd-scope-icon" />
                  <strong>Own Data Only</strong>
                </div>
                <span className="rd-scope-desc">
                  Member only accesses records they personally created or logged.
                </span>
              </div>
            </label>
          </div>
        </div>
      </form>
    </Drawer>
  );
}

