import React from 'react';
import { AlertTriangle, CheckCircle2, Shield, Mail, Building2, UserX, UserCheck } from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import './ConfirmStatusDrawer.css';

/**
 * Slide-Over Confirmation Drawer for User Deactivation & Reactivation
 */
export default function ConfirmStatusDrawer({
  isOpen,
  onClose,
  user,
  action = 'deactivate',
  onConfirm,
  loading = false,
}) {
  if (!user) return null;

  const isDeactivate = action === 'deactivate';
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';

  const footer = (
    <div className="csd-footer-actions">
      <button
        type="button"
        className="ro-btn ro-btn--secondary"
        onClick={onClose}
        disabled={loading}
      >
        Cancel
      </button>
      <button
        type="button"
        className={`ro-btn ${isDeactivate ? 'ro-btn--danger' : 'ro-btn--primary'}`}
        onClick={onConfirm}
        disabled={loading}
      >
        {loading
          ? (isDeactivate ? 'Deactivating...' : 'Reactivating...')
          : (isDeactivate ? 'Yes, Deactivate User' : 'Yes, Reactivate User')}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isDeactivate ? 'Deactivate Team Member' : 'Reactivate Team Member'}
      subtitle={`Confirm security access changes for ${user.firstName} ${user.lastName}`}
      icon={isDeactivate ? <UserX size={18} /> : <UserCheck size={18} />}
      width="460px"
      footer={footer}
    >
      <div className="csd-content">
        {/* User Card Summary */}
        <div className="csd-user-summary">
          <div className="csd-avatar">{initials}</div>
          <div className="csd-user-details">
            <h4 className="csd-user-name">{user.firstName} {user.lastName}</h4>
            <div className="csd-meta-row">
              <span className="csd-meta-item"><Mail size={12} /> {user.email}</span>
              <span className="csd-meta-item"><Shield size={12} /> {user.roleName || user.role}</span>
            </div>
            {Array.isArray(user.assignedProjects) && user.assignedProjects.length > 0 && (
              <div className="csd-meta-row">
                <span className="csd-meta-item">
                  <Building2 size={12} /> {user.assignedProjects.length} Assigned Project(s)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Security Impact Notice */}
        {isDeactivate ? (
          <div className="csd-notice warning">
            <div className="csd-notice-icon">
              <AlertTriangle size={18} />
            </div>
            <div className="csd-notice-body">
              <div className="csd-notice-title">Immediate Access Revocation</div>
              <ul className="csd-notice-list">
                <li>This user will immediately be blocked from logging into the platform.</li>
                <li>All active sessions on mobile or web will be invalidated.</li>
                <li><strong>Data safety:</strong> No project records, BBS schedules, or audit logs will be deleted.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="csd-notice success">
            <div className="csd-notice-icon">
              <CheckCircle2 size={18} />
            </div>
            <div className="csd-notice-body">
              <div className="csd-notice-title">Restore Account Access</div>
              <ul className="csd-notice-list">
                <li>This user will regain immediate access to log into the application.</li>
                <li>Their role (<strong>{user.roleName || user.role}</strong>) and project permissions will be restored.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

