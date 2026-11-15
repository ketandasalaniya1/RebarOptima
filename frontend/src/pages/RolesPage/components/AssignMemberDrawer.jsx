import React, { useState, useMemo } from 'react';
import { UserPlus, Search, Mail, Shield, Check } from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import './AssignMemberDrawer.css';

/**
 * Slide-over Drawer to Assign Existing Team Members to Role
 */
export default function AssignMemberDrawer({
  isOpen,
  onClose,
  role,
  assignableUsers = [],
  onAssignMember,
  assigning = false,
}) {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return assignableUsers;
    const q = search.toLowerCase();
    return assignableUsers.filter((u) => {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [assignableUsers, search]);

  const handleAssign = () => {
    if (!selectedUserId) return;
    onAssignMember(selectedUserId);
  };

  const footer = (
    <div className="amd-footer-actions">
      <button
        type="button"
        className="ro-btn ro-btn--secondary"
        onClick={onClose}
        disabled={assigning}
      >
        Cancel
      </button>
      <button
        type="button"
        className="ro-btn ro-btn--primary"
        onClick={handleAssign}
        disabled={!selectedUserId || assigning}
      >
        <UserPlus size={15} />
        {assigning ? 'Assigning...' : 'Assign to Role'}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Member to ${role?.name || 'Role'}`}
      subtitle="Select an active team member to grant this role's permissions"
      icon={<UserPlus size={18} />}
      width="480px"
      footer={footer}
    >
      <div className="amd-body">
        {/* Search Input */}
        <div className="amd-search-box">
          <Search size={14} className="amd-search-icon" />
          <input
            type="text"
            placeholder="Search member by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="amd-search-input"
          />
        </div>

        {/* Member Selectable List */}
        <div className="amd-list">
          {filteredUsers.map((u) => {
            const uid = String(u.id || u._id);
            const isSelected = selectedUserId === uid;
            const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || 'U';

            return (
              <div
                key={uid}
                className={`amd-user-row ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedUserId(uid)}
              >
                <div className="amd-avatar">{initials}</div>
                <div className="amd-user-details">
                  <span className="amd-user-name">{u.firstName} {u.lastName}</span>
                  <span className="amd-user-meta"><Mail size={11} /> {u.email}</span>
                  <span className="amd-user-current-role">
                    <Shield size={11} /> Current: {u.roleName || u.role || 'Member'}
                  </span>
                </div>
                <div className="amd-radio-pill">
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </div>
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="amd-empty">
              {search
                ? `No available members found matching "${search}"`
                : 'All active members are already assigned to this role.'}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

