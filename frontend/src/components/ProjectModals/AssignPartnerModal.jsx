import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, UserCheck, Search, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { projectsApi, usersApi } from '../../utils/api';
import { updateProjectInList, closeAssignPartnerModal } from '../../store/slices/projectSlice';
import './AssignPartnerModal.css';

export default function AssignPartnerModal() {
  const dispatch = useDispatch();
  const project = useSelector((state) => state.project.assignPartnerModalProject);

  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!project) return;

    // Pre-populate assigned IDs
    const currentAssigned = (project.assignedPartnerAdminIds || []).map(String);
    setSelectedUserIds(currentAssigned);

    // Fetch company users
    setLoading(true);
    usersApi.getUsers()
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setApiError(err.message || 'Failed to load company users.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [project]);

  if (!project) return null;

  const handleToggleUser = (userId) => {
    setSelectedUserIds((prev) => {
      const strId = String(userId);
      if (prev.includes(strId)) {
        return prev.filter((id) => id !== strId);
      } else {
        return [...prev, strId];
      }
    });
  };

  const handleSave = async () => {
    setApiError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const projId = project._id || project.id;
      const updated = await projectsApi.assignPartnerAdmins(projId, selectedUserIds);
      dispatch(updateProjectInList(updated));
      setSuccessMsg('Project Partner Admin assignments saved successfully!');
      setTimeout(() => {
        dispatch(closeAssignPartnerModal());
      }, 800);
    } catch (err) {
      setApiError(err.message || 'Failed to save partner assignments.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    return fullName.includes(q) || email.includes(q) || role.includes(q);
  });

  return (
    <div className="assign-modal-backdrop" onClick={() => dispatch(closeAssignPartnerModal())}>
      <div className="assign-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="apm-header">
          <div className="apm-header-left">
            <div className="apm-icon-box">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="apm-title">Assign Project Partner Admin</h2>
              <p className="apm-subtitle">
                Project: <strong>{project.name}</strong> • Grant project-level access
              </p>
            </div>
          </div>
          <button
            type="button"
            className="apm-close-btn"
            onClick={() => dispatch(closeAssignPartnerModal())}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="apm-body">
          {apiError && (
            <div className="apm-alert apm-alert-error">
              <AlertCircle size={15} />
              <span>{apiError}</span>
            </div>
          )}
          {successMsg && (
            <div className="apm-alert apm-alert-success">
              <CheckCircle size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="apm-search-row">
            <Search size={15} className="apm-search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apm-search-input"
            />
          </div>

          <div className="apm-users-list">
            {loading ? (
              <div className="apm-loading">
                <Loader2 size={24} className="apm-spinner" />
                <span>Loading users...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="apm-empty">
                <span>No matching users found in company directory.</span>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const uId = String(u._id || u.id);
                const isAssigned = selectedUserIds.includes(uId);
                const isPartnerAdminRole = (u.role || '').toUpperCase() === 'PROJECT_PARTNER_ADMIN';

                return (
                  <div
                    key={uId}
                    className={`apm-user-item ${isAssigned ? 'assigned' : ''}`}
                    onClick={() => handleToggleUser(uId)}
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => handleToggleUser(uId)}
                      className="apm-checkbox"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="apm-user-details">
                      <div className="apm-user-top">
                        <span className="apm-user-name">
                          {u.firstName} {u.lastName}
                        </span>
                        <span className={`apm-role-badge ${isPartnerAdminRole ? 'role-partner' : ''}`}>
                          {u.roleName || u.role || 'User'}
                        </span>
                      </div>
                      <span className="apm-user-email">{u.email}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="apm-footer">
          <span className="apm-selected-count">
            Selected: <strong>{selectedUserIds.length}</strong> Partner Admin(s)
          </span>
          <div className="apm-footer-actions">
            <button
              type="button"
              className="apm-btn-secondary"
              onClick={() => dispatch(closeAssignPartnerModal())}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="apm-btn-primary"
              onClick={handleSave}
              disabled={submitting || loading}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="apm-spinner" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Assignments</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
