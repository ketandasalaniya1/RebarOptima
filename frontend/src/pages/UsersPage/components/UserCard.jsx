import React from 'react';
import { Mail, Phone, Shield, Building2, Edit3, UserX, UserCheck, Calendar, Clock } from 'lucide-react';
import './UserCard.css';

/**
 * Responsive User Item Component
 * - Renders as desktop table row or mobile card
 * - Avatar initials with green activity indicator
 * - Role chip and assigned project pills
 * - Touch targets >= 44px
 */
export default function UserCard({
  user,
  isSelf,
  allProjects = [],
  onEdit,
  onRequestToggleStatus,
  mode = 'table-row', // 'table-row' | 'mobile-card'
}) {
  const isActive = user.isActive !== false;
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';

  // Resolve assigned project names
  const assignedProjectIds = (user.assignedProjects || []).map(String);
  const matchedProjects = allProjects.filter((p) =>
    assignedProjectIds.includes(String(p._id || p.id))
  );

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  // Last active heuristic: if active in system, show Recent or date
  const lastActiveText = isActive ? 'Active recently' : 'Inactive';

  if (mode === 'mobile-card') {
    return (
      <div className={`user-mobile-card ${!isActive ? 'is-inactive' : ''}`}>
        <div className="umc-top-row">
          <div className="umc-avatar-wrap">
            <div className="umc-avatar">{initials}</div>
            <span
              className={`umc-status-dot ${isActive ? 'online' : 'offline'}`}
              title={isActive ? 'Active Member' : 'Deactivated Member'}
            />
          </div>

          <div className="umc-title-box">
            <div className="umc-name-row">
              <span className="umc-name">
                {user.firstName} {user.lastName}
              </span>
              {isSelf && <span className="umc-self-pill">You</span>}
            </div>
            <div className="umc-email"><Mail size={12} /> {user.email}</div>
          </div>

          <div className="umc-status-pill-box">
            <span className={`umc-badge ${isActive ? 'active' : 'inactive'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="umc-meta-section">
          <div className="umc-meta-row">
            <span className="umc-role-chip">
              <Shield size={12} />
              {user.roleName || user.role || 'Member'}
            </span>
            {user.mobileNumber && (
              <span className="umc-phone"><Phone size={12} /> {user.mobileNumber}</span>
            )}
          </div>

          {matchedProjects.length > 0 && (
            <div className="umc-projects-tray">
              {matchedProjects.slice(0, 3).map((p) => (
                <span key={p._id || p.id} className="umc-proj-pill">
                  <Building2 size={11} /> {p.name}
                </span>
              ))}
              {matchedProjects.length > 3 && (
                <span className="umc-proj-pill more">
                  +{matchedProjects.length - 3} more
                </span>
              )}
            </div>
          )}

          <div className="umc-timestamp-row">
            <span className="umc-joined"><Calendar size={12} /> Joined {joinedDate}</span>
            <span className="umc-last-login"><Clock size={12} /> {lastActiveText}</span>
          </div>
        </div>

        <div className="umc-actions-row">
          <button
            type="button"
            className="umc-btn edit"
            onClick={() => onEdit(user)}
            aria-label={`Edit ${user.firstName} ${user.lastName}`}
          >
            <Edit3 size={15} /> Edit
          </button>
          <button
            type="button"
            className={`umc-btn ${isActive ? 'danger' : 'success'}`}
            onClick={() => onRequestToggleStatus(user)}
            disabled={isSelf}
            title={isSelf ? 'You cannot deactivate your own account' : undefined}
            aria-label={isActive ? `Deactivate ${user.firstName}` : `Reactivate ${user.firstName}`}
          >
            {isActive ? <UserX size={15} /> : <UserCheck size={15} />}
            {isActive ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      </div>
    );
  }

  // Desktop Table Row
  return (
    <tr className={`user-table-row ${!isActive ? 'is-inactive-row' : ''}`}>
      {/* 1. Member Profile */}
      <td className="utr-member-cell">
        <div className="utr-avatar-wrap">
          <div className="utr-avatar">{initials}</div>
          <span
            className={`utr-status-dot ${isActive ? 'online' : 'offline'}`}
            title={isActive ? 'Active Member' : 'Deactivated'}
          />
        </div>
        <div className="utr-member-info">
          <div className="utr-name-row">
            <span className="utr-name">
              {user.firstName} {user.lastName}
            </span>
            {isSelf && <span className="utr-self-pill">You</span>}
          </div>
          <div className="utr-email">
            <Mail size={12} />
            <span>{user.email}</span>
          </div>
          {user.mobileNumber && (
            <div className="utr-phone">
              <Phone size={11} />
              <span>{user.mobileNumber}</span>
            </div>
          )}
        </div>
      </td>

      {/* 2. Role */}
      <td className="utr-role-cell">
        <span className="utr-role-chip">
          <Shield size={13} />
          <span>{user.roleName || user.role || 'Member'}</span>
        </span>
      </td>

      {/* 3. Assigned Projects */}
      <td className="utr-projects-cell">
        <div className="utr-projects-wrap">
          {matchedProjects.length === 0 ? (
            <span className="utr-no-projects">No projects assigned</span>
          ) : (
            <>
              {matchedProjects.slice(0, 2).map((p) => (
                <span key={p._id || p.id} className="utr-proj-pill" title={p.name}>
                  <Building2 size={11} />
                  <span className="utr-proj-text">{p.name}</span>
                </span>
              ))}
              {matchedProjects.length > 2 && (
                <span
                  className="utr-proj-pill more"
                  title={matchedProjects.slice(2).map((p) => p.name).join(', ')}
                >
                  +{matchedProjects.length - 2} more
                </span>
              )}
            </>
          )}
        </div>
      </td>

      {/* 4. Status Badge */}
      <td className="utr-status-cell">
        <span className={`utr-status-badge ${isActive ? 'active' : 'inactive'}`}>
          <span className="utr-badge-dot" />
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </td>

      {/* 5. Last Activity / Joined */}
      <td className="utr-joined-cell">
        <div className="utr-date-info">
          <span className="utr-activity-text">{lastActiveText}</span>
          <span className="utr-date-sub">Joined {joinedDate}</span>
        </div>
      </td>

      {/* 6. Action Buttons (min 44px tap target) */}
      <td className="utr-actions-cell">
        <div className="utr-actions-group">
          <button
            type="button"
            className="utr-action-btn edit"
            onClick={() => onEdit(user)}
            title="Edit User Details"
            aria-label={`Edit ${user.firstName} ${user.lastName}`}
          >
            <Edit3 size={16} />
          </button>

          <button
            type="button"
            className={`utr-action-btn ${isActive ? 'deactivate' : 'reactivate'}`}
            onClick={() => onRequestToggleStatus(user)}
            disabled={isSelf}
            title={
              isSelf
                ? 'You cannot deactivate your own account'
                : (isActive ? 'Deactivate User' : 'Reactivate User')
            }
            aria-label={isActive ? `Deactivate ${user.firstName}` : `Reactivate ${user.firstName}`}
          >
            {isActive ? <UserX size={16} /> : <UserCheck size={16} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

