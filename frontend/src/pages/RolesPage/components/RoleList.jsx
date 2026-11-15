import React, { useState, useMemo } from 'react';
import { Shield, Users, Plus, Search, Check, Sparkles } from 'lucide-react';
import './RoleList.css';

/**
 * Left-side Role List Panel
 * - System roles with shield badges
 * - Custom company roles
 * - User count indicators
 * - Quick search & "+ Create Role" button
 */
export default function RoleList({
  roles = [],
  selectedRoleId,
  onSelectRole,
  onCreateRole,
}) {
  const [search, setSearch] = useState('');

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.toLowerCase();
    return roles.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    );
  }, [roles, search]);

  const systemRoles = useMemo(
    () => filteredRoles.filter((r) => r.isSystem),
    [filteredRoles]
  );

  const customRoles = useMemo(
    () => filteredRoles.filter((r) => !r.isSystem),
    [filteredRoles]
  );

  const roleIdOf = (r) => String(r.id || r._id);

  return (
    <aside className="role-list-sidebar" aria-label="Roles list">
      <div className="rl-header">
        <div className="rl-title-row">
          <h3 className="rl-title">Roles & Templates</h3>
          <span className="rl-count-pill">{roles.length} Total</span>
        </div>
        <button
          type="button"
          className="ro-btn ro-btn--primary ro-btn--sm rl-create-btn"
          onClick={onCreateRole}
        >
          <Plus size={14} /> Create Role
        </button>
      </div>

      {/* Role Search */}
      {roles.length > 4 && (
        <div className="rl-search-wrap">
          <Search size={14} className="rl-search-icon" />
          <input
            type="text"
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rl-search-input"
          />
        </div>
      )}

      <div className="rl-scrollable-list">
        {/* System Roles Group */}
        {systemRoles.length > 0 && (
          <div className="rl-group">
            <div className="rl-group-label">
              <Shield size={12} />
              <span>System Defaults ({systemRoles.length})</span>
            </div>
            <div className="rl-items">
              {systemRoles.map((role) => {
                const isSelected = selectedRoleId && roleIdOf(role) === String(selectedRoleId);
                return (
                  <button
                    key={roleIdOf(role)}
                    type="button"
                    className={`rl-item ${isSelected ? 'active' : ''}`}
                    onClick={() => onSelectRole(role)}
                  >
                    <div className="rl-item-icon system">
                      <Shield size={15} />
                    </div>
                    <div className="rl-item-text">
                      <div className="rl-item-name-row">
                        <span className="rl-item-name">{role.name}</span>
                      </div>
                      <span className="rl-item-desc">
                        {role.description || 'Pre-configured standard template'}
                      </span>
                    </div>
                    <div className="rl-item-badge" title={`${role.userCount || 0} active user(s)`}>
                      <Users size={12} />
                      <span>{role.userCount ?? 0}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Company Roles Group */}
        <div className="rl-group">
          <div className="rl-group-label">
            <Sparkles size={12} />
            <span>Custom Roles ({customRoles.length})</span>
          </div>
          {customRoles.length === 0 ? (
            <div className="rl-empty-custom">
              No custom roles created yet. Duplicate any system role or create a new one.
            </div>
          ) : (
            <div className="rl-items">
              {customRoles.map((role) => {
                const isSelected = selectedRoleId && roleIdOf(role) === String(selectedRoleId);
                return (
                  <button
                    key={roleIdOf(role)}
                    type="button"
                    className={`rl-item ${isSelected ? 'active' : ''}`}
                    onClick={() => onSelectRole(role)}
                  >
                    <div className="rl-item-icon custom">
                      <Users size={15} />
                    </div>
                    <div className="rl-item-text">
                      <div className="rl-item-name-row">
                        <span className="rl-item-name">{role.name}</span>
                        <span className="rl-custom-tag">Custom</span>
                      </div>
                      <span className="rl-item-desc">
                        {role.description || 'Custom tailored role'}
                      </span>
                    </div>
                    <div className="rl-item-badge" title={`${role.userCount || 0} active user(s)`}>
                      <Users size={12} />
                      <span>{role.userCount ?? 0}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

