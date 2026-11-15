import React, { useState, useEffect } from 'react';
import { UserPlus, UserCheck, Shield, Mail, Phone, Lock, Send, KeyRound, AlertCircle, Save } from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import ProjectChipPicker from './ProjectChipPicker';
import './UserDrawer.css';

/**
 * Slide-over Drawer for Creating and Editing Team Members
 */
export default function UserDrawer({
  isOpen,
  onClose,
  editingUser,
  roles = [],
  projects = [],
  activeProjectId,
  onSave,
  saving = false,
  apiError = '',
}) {
  const isEditing = Boolean(editingUser);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [roleId, setRoleId] = useState('');
  const [accessMethod, setAccessMethod] = useState('invite'); // 'invite' | 'password'
  const [password, setPassword] = useState('');
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [localError, setLocalError] = useState('');

  // Pre-fill or reset form when drawer opens or editingUser changes
  useEffect(() => {
    if (!isOpen) return;

    if (editingUser) {
      setFirstName(editingUser.firstName || '');
      setLastName(editingUser.lastName || '');
      setEmail(editingUser.email || '');
      setMobile(editingUser.mobileNumber || '');
      setRoleId(editingUser.roleId ? String(editingUser.roleId) : '');
      setAssignedProjects((editingUser.assignedProjects || []).map(String));
      setPassword('');
      setAccessMethod('password');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setMobile('');
      // Default to first non-system or standard role if available
      const defaultRole = roles.find(r => (r.name || '').toLowerCase().includes('engineer') || (r.name || '').toLowerCase().includes('manager')) || roles[0];
      setRoleId(defaultRole ? String(defaultRole.id || defaultRole._id) : '');
      setAssignedProjects(activeProjectId ? [String(activeProjectId)] : []);
      setPassword('');
      setAccessMethod('invite');
    }
    setLocalError('');
  }, [isOpen, editingUser, roles, activeProjectId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');

    if (!firstName.trim() || !lastName.trim()) {
      setLocalError('First and last name are required');
      return;
    }

    if (!roleId) {
      setLocalError('Please assign a security role');
      return;
    }

    if (!isEditing) {
      if (!email.trim()) {
        setLocalError('Valid email address is required');
        return;
      }
      if (accessMethod === 'password' && (!password || password.length < 6)) {
        setLocalError('Password must be at least 6 characters long');
        return;
      }
    }

    let finalPassword = password;
    if (!isEditing && accessMethod === 'invite') {
      // Generate secure initial password for backend user creation
      finalPassword = `Ro!${Math.random().toString(36).slice(-8)}${Math.floor(100 + Math.random() * 900)}A#`;
    }

    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      mobileNumber: mobile.trim(),
      roleId,
      assignedProjects,
      password: finalPassword,
      accessMethod,
    });
  };

  const footer = (
    <div className="ud-footer-actions">
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
        {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Member')}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Team Member' : 'Add Team Member'}
      subtitle={
        isEditing
          ? `Update profile, role, and project scopes for ${editingUser?.firstName || 'user'}`
          : 'Provision a new team member and configure their access rights'
      }
      icon={isEditing ? <UserCheck size={18} /> : <UserPlus size={18} />}
      width="540px"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="ud-form">
        {(localError || apiError) && (
          <div className="ud-error-banner">
            <AlertCircle size={15} className="ud-error-icon" />
            <span>{localError || apiError}</span>
          </div>
        )}

        {/* Section 1: Member Identity */}
        <div className="ud-section">
          <div className="ud-section-title">Identity & Profile</div>
          
          <div className="ud-grid-2">
            <div className="ud-field">
              <label className="ud-label">First Name *</label>
              <input
                type="text"
                required
                className="ud-input"
                placeholder="e.g. John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="ud-field">
              <label className="ud-label">Last Name *</label>
              <input
                type="text"
                required
                className="ud-input"
                placeholder="e.g. Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="ud-field">
            <label className="ud-label">Email Address *</label>
            <div className="ud-input-with-icon">
              <Mail size={15} className="ud-icon-prefix" />
              <input
                type="email"
                required
                disabled={isEditing}
                className={`ud-input with-prefix ${isEditing ? 'disabled' : ''}`}
                placeholder="john.doe@cravetobuild.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {isEditing && (
              <span className="ud-hint">Email address cannot be modified once provisioned</span>
            )}
          </div>

          <div className="ud-field">
            <label className="ud-label">Mobile Number</label>
            <div className="ud-input-with-icon">
              <Phone size={15} className="ud-icon-prefix" />
              <input
                type="tel"
                className="ud-input with-prefix"
                placeholder="+91 98765 43210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Security Role */}
        <div className="ud-section">
          <div className="ud-section-title">Role & Authorization</div>

          <div className="ud-field">
            <label className="ud-label">Assigned Role *</label>
            <div className="ud-input-with-icon">
              <Shield size={15} className="ud-icon-prefix" />
              <select
                required
                className="ud-select with-prefix"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">-- Choose Role --</option>
                {roles.map((r) => {
                  const rid = String(r.id || r._id);
                  return (
                    <option key={rid} value={rid}>
                      {r.name} {r.isSystem ? '(System Default)' : '(Custom)'}
                    </option>
                  );
                })}
              </select>
            </div>
            <span className="ud-hint">
              Roles define operational capabilities (BBS, Inventory, CRM, Finances, Drawings).
            </span>
          </div>
        </div>

        {/* Section 3: Access Method (Only for new members) */}
        {!isEditing && (
          <div className="ud-section">
            <div className="ud-section-title">Access Method</div>

            <div className="ud-access-options">
              <label className={`ud-access-card ${accessMethod === 'invite' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="accessMethod"
                  value="invite"
                  checked={accessMethod === 'invite'}
                  onChange={() => setAccessMethod('invite')}
                  className="ud-radio-input"
                />
                <div className="ud-access-card-body">
                  <div className="ud-access-card-head">
                    <Send size={15} className="ud-access-icon" />
                    <strong>Send 72h Invite Link</strong>
                    <span className="ud-recommended-tag">Recommended</span>
                  </div>
                  <p className="ud-access-desc">
                    User receives an email invitation to verify identity and set their own secure password.
                  </p>
                </div>
              </label>

              <label className={`ud-access-card ${accessMethod === 'password' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="accessMethod"
                  value="password"
                  checked={accessMethod === 'password'}
                  onChange={() => setAccessMethod('password')}
                  className="ud-radio-input"
                />
                <div className="ud-access-card-body">
                  <div className="ud-access-card-head">
                    <KeyRound size={15} className="ud-access-icon" />
                    <strong>Set Temporary Password</strong>
                  </div>
                  <p className="ud-access-desc">
                    Manually define a password for immediate sign-in on site.
                  </p>
                </div>
              </label>
            </div>

            {accessMethod === 'password' && (
              <div className="ud-field" style={{ marginTop: '12px' }}>
                <label className="ud-label">Temporary Password *</label>
                <div className="ud-input-with-icon">
                  <Lock size={15} className="ud-icon-prefix" />
                  <input
                    type="password"
                    required
                    className="ud-input with-prefix"
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Project Scopes */}
        <div className="ud-section">
          <ProjectChipPicker
            projects={projects}
            selectedProjectIds={assignedProjects}
            onChange={(newIds) => setAssignedProjects(newIds)}
            activeProjectId={activeProjectId}
          />
        </div>
      </form>
    </Drawer>
  );
}

