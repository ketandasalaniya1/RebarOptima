import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Users, Plus, Edit3, Shield, Mail, CheckCircle, XCircle, Search, Save, X, AlertTriangle } from 'lucide-react';
import { usersApi, rolesApi } from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './UsersPage.css';

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoleId, setFormRoleId] = useState('');
  const [formMobile, setFormMobile] = useState('');
  
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Confirmation modal state
  const [confirmAction, setConfirmAction] = useState(null);
  
  // Current user info to prevent self-deactivation
  const currentUser = useSelector(state => state.auth.user);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        usersApi.getUsers(),
        rolesApi.getRoles()
      ]);
      setUsers(u || []);
      setRoles(r || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormFirstName('');
    setFormLastName('');
    setFormPassword('');
    setFormRoleId('');
    setFormMobile('');
    setShowForm(true);
    setError('');
  };

  const openEditForm = (user) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormFirstName(user.firstName);
    setFormLastName(user.lastName);
    setFormPassword(''); // Password not required for edit
    setFormRoleId(user.roleId || '');
    setFormMobile(user.mobileNumber || '');
    setShowForm(true);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formFirstName || !formLastName || !formRoleId) {
      setError('Name and Role are required');
      return;
    }
    if (!editingUser && (!formEmail || !formPassword)) {
      setError('Email and Password are required for new users');
      return;
    }

    setError('');
    try {
      if (editingUser) {
        await usersApi.updateUser(editingUser.id || editingUser._id, {
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          roleId: formRoleId,
          mobileNumber: formMobile.trim()
        });
        setSuccess('User updated successfully');
      } else {
        await usersApi.createUser({
          email: formEmail.trim(),
          password: formPassword,
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          roleId: formRoleId,
          mobileNumber: formMobile.trim()
        });
        setSuccess('User created successfully');
      }
      setShowForm(false);
      setEditingUser(null);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const requestToggleUserStatus = (user) => {
    const userId = String(user.id || user._id);
    const currentId = String(currentUser?.id || '');
    if (userId === currentId) {
      setError('You cannot deactivate your own account');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    const newStatus = user.isActive === false ? true : false;
    const action = newStatus ? 'reactivate' : 'deactivate';
    
    setConfirmAction({ user, newStatus, action });
  };

  const executeToggleUserStatus = async () => {
    if (!confirmAction) return;
    const { user, newStatus, action } = confirmAction;
    setConfirmAction(null);
    
    try {
      await usersApi.updateUserStatus(user.id || user._id, newStatus);
      setSuccess(`User ${action}d successfully`);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = `${u.firstName} ${u.lastName} ${u.email} ${u.roleName}`.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    const isActive = u.isActive !== false;
    if (statusFilter === 'active') return isActive;
    if (statusFilter === 'inactive') return !isActive;
    return true;
  });

  if (loading) {
    return <LoadingSpinner message="Loading users & access controls..." minHeight="65vh" />;
  }

  return (
    <div className="users-page">
      <div className="users-header">
        <div className="users-title-section">
          <Users size={22} className="users-title-icon" />
          <div>
            <h2>User Management</h2>
            <p>Manage team members and role assignments</p>
          </div>
        </div>
        {!showForm && (
          <button className="users-create-btn" onClick={openCreateForm}>
            <Plus size={16} /> Add Team Member
          </button>
        )}
      </div>

      {error && <div className="users-error"><AlertTriangle size={14} /> {error}</div>}
      {success && <div className="users-success"><CheckCircle size={14} /> {success}</div>}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="users-form-card">
          <div className="users-form-header">
            <h3>{editingUser ? 'Edit Team Member' : 'Add Team Member'}</h3>
            <button className="users-close-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
          </div>
          <form onSubmit={handleSave} className="users-form-body">
            <div className="users-form-row">
              <div className="users-field">
                <label>First Name *</label>
                <input required value={formFirstName} onChange={e => setFormFirstName(e.target.value)} placeholder="e.g. John" />
              </div>
              <div className="users-field">
                <label>Last Name *</label>
                <input required value={formLastName} onChange={e => setFormLastName(e.target.value)} placeholder="e.g. Doe" />
              </div>
            </div>

            <div className="users-form-row">
              <div className="users-field">
                <label>Email Address {editingUser ? '' : '*'}</label>
                <input 
                  type="email" 
                  required={!editingUser} 
                  disabled={!!editingUser}
                  value={formEmail} 
                  onChange={e => setFormEmail(e.target.value)} 
                  placeholder="john.doe@example.com" 
                  className={editingUser ? 'disabled' : ''}
                />
                {editingUser && <span className="users-field-hint">Email cannot be changed</span>}
              </div>
              <div className="users-field">
                <label>Mobile Number</label>
                <input type="tel" value={formMobile} onChange={e => setFormMobile(e.target.value)} placeholder="+1 234 567 8900" />
              </div>
            </div>

            <div className="users-form-row">
              <div className="users-field">
                <label>Assign Role *</label>
                <select required value={formRoleId} onChange={e => setFormRoleId(e.target.value)}>
                  <option value="">-- Select Role --</option>
                  {roles.map(r => <option key={r.id || r._id} value={r.id || r._id}>{r.name} {r.isSystem ? '(System)' : ''}</option>)}
                </select>
              </div>
              {!editingUser && (
                <div className="users-field">
                  <label>Initial Password *</label>
                  <input type="password" required value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="••••••••" />
                </div>
              )}
            </div>

            <div className="users-form-actions">
              <button type="button" className="users-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="users-save-btn">
                <Save size={14} /> {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      {!showForm && (
        <div className="users-list-container">
          <div className="users-toolbar">
            <div className="users-search">
              <Search size={16} />
              <input 
                placeholder="Search by name, email, or role..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
            <div className="users-stats" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  background: 'var(--card-bg, rgba(255,255,255,0.05))',
                  color: 'var(--text-main, #fff)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Members ({users.length})</option>
                <option value="active">Active ({users.filter(u => u.isActive !== false).length})</option>
                <option value="inactive">Deactivated ({users.filter(u => u.isActive === false).length})</option>
              </select>
            </div>
          </div>

          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th className="actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const isSelf = user.id === currentUser?.id || user._id === currentUser?.id;
                  const isActive = user.isActive !== false;
                  
                  return (
                    <tr key={user.id || user._id} className={!isActive ? 'inactive-row' : ''}>
                      <td>
                        <div className="user-name-col">
                          <div className="user-avatar">
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="user-fullname">{user.firstName} {user.lastName} {isSelf && <span className="you-badge">You</span>}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="user-contact">
                          <span className="user-email"><Mail size={12} /> {user.email}</span>
                        </div>
                      </td>
                      <td>
                        <div className="user-role-badge">
                          <Shield size={12} /> {user.roleName || user.role}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${isActive ? 'active' : 'inactive'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="users-muted">{new Date(user.createdAt).toLocaleDateString('en-GB')}</td>
                      <td className="actions-cell">
                        <div className="users-action-group">
                          <button 
                            className="users-icon-btn edit" 
                            onClick={() => openEditForm(user)}
                            title="Edit User"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            className={`users-icon-btn ${isActive ? 'danger' : 'success'}`} 
                            onClick={() => requestToggleUserStatus(user)}
                            title={isActive ? 'Deactivate User' : 'Activate User'}
                            disabled={isSelf}
                          >
                            {isActive ? <XCircle size={16} /> : <CheckCircle size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="users-empty">
                      No team members found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="users-confirm-overlay" onClick={() => setConfirmAction(null)}>
          <div className="users-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="users-confirm-icon">
              {confirmAction.action === 'deactivate' ? <XCircle size={36} /> : <CheckCircle size={36} />}
            </div>
            <h3>{confirmAction.action === 'deactivate' ? 'Deactivate User' : 'Reactivate User'}</h3>
            <p>
              Are you sure you want to <strong>{confirmAction.action}</strong>{' '}
              <strong>{confirmAction.user.firstName} {confirmAction.user.lastName}</strong>?
              {confirmAction.action === 'deactivate' && (
                <span className="users-confirm-warning">This user will no longer be able to log in.</span>
              )}
            </p>
            <div className="users-confirm-actions">
              <button className="users-cancel-btn" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button 
                className={confirmAction.action === 'deactivate' ? 'users-confirm-danger-btn' : 'users-confirm-success-btn'}
                onClick={executeToggleUserStatus}
              >
                {confirmAction.action === 'deactivate' ? 'Yes, Deactivate' : 'Yes, Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
