import React, { useState, useEffect } from 'react';
import { X, Users, Shield, Calendar, Info, UserPlus, UserMinus, LogOut } from 'lucide-react';
import { chatApi } from '../../../utils/api';
import { Select } from '../../../components/ui';

export default function GroupInfoModal({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onConversationUpdated,
  onLeaveGroup,
}) {
  const [candidates, setCandidates] = useState([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const convId = conversation?._id || conversation?.id;
  const isAdmin = (conversation?.adminIds || []).includes(currentUserId);

  useEffect(() => {
    if (isOpen) {
      loadCandidates();
    }
  }, [isOpen]);

  const loadCandidates = async () => {
    try {
      const res = await chatApi.getDirectCandidates();
      if (res.success && res.data) {
        setCandidates(res.data);
      }
    } catch (err) {
      console.warn('Could not load candidates for group:', err);
    }
  };

  if (!isOpen || !conversation) return null;

  // Filter candidates not already in group
  const nonMembers = candidates.filter(
    (c) => !(conversation.memberIds || []).includes(c.id)
  );

  const handleAddMember = async () => {
    if (!selectedUserToAdd) return;
    setLoadingAction(true);
    try {
      const res = await chatApi.addGroupMember(convId, selectedUserToAdd);
      if (res.success) {
        setSelectedUserToAdd('');
        setIsAdding(false);
        if (onConversationUpdated) onConversationUpdated(res.data);
      }
    } catch (err) {
      alert(`Could not add member: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member from the group?')) return;
    setLoadingAction(true);
    try {
      const res = await chatApi.removeGroupMember(convId, memberId);
      if (res.success) {
        if (onConversationUpdated) onConversationUpdated(res.data);
      }
    } catch (err) {
      alert(`Could not remove member: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    setLoadingAction(true);
    try {
      const res = await chatApi.leaveGroup(convId);
      if (res.success) {
        onClose();
        if (onLeaveGroup) onLeaveGroup(convId);
      }
    } catch (err) {
      alert(`Could not leave group: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 }}>
            <Info size={18} color="var(--info-text)" /> Group Details
          </div>
          <button className="chat-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="chat-modal-body">
          <div style={{ textAlign: 'center', padding: '16px 0', borderBottom: '1px solid var(--card-border)' }}>
            <div
              className="chat-user-avatar"
              style={{ width: '64px', height: '64px', fontSize: '24px', margin: '0 auto 12px auto' }}
            >
              <Users size={32} />
            </div>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>{conversation.name || 'Project Group'}</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
              {conversation.description || 'No description provided'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', color: 'var(--text-secondary)', fontSize: '11px' }}>
              <Calendar size={12} /> Created on {new Date(conversation.createdAt || Date.now()).toLocaleDateString()}
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Participants ({(conversation.memberIds || []).length})
              </span>
              {isAdmin && !isAdding && nonMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--info-text)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <UserPlus size={13} /> Add Member
                </button>
              )}
            </div>

            {/* Admin Add Member Row */}
            {isAdding && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', background: 'var(--main-bg)', padding: '8px', borderRadius: '6px' }}>
                <Select
                  value={selectedUserToAdd}
                  onChange={(e) => setSelectedUserToAdd(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--text-primary)',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  <option value="">Select colleague...</option>
                  {nonMembers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.role || 'Member'})
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!selectedUserToAdd || loadingAction}
                  style={{
                    background: 'var(--accent)',
                    border: 'none',
                    color: 'var(--accent-contrast)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  style={{
                    background: 'var(--card-border)',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {(conversation.memberIds || []).map((mId, index) => {
                const memberIsAdmin = (conversation.adminIds || []).includes(mId);
                const isCurrent = String(mId) === String(currentUserId);
                const matchedContact = candidates.find((c) => c.id === mId);
                const memberName = matchedContact?.name || (isCurrent ? 'You' : `Member ${mId.substring(0, 8)}...`);

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--main-bg)',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="chat-user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                        {memberName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {memberName} {isCurrent && <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>(You)</span>}
                        </div>
                        {matchedContact?.role && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{matchedContact.role}</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {memberIsAdmin && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--accent-subtle)',
                            color: 'var(--accent)',
                            border: '1px solid var(--accent)',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          <Shield size={10} /> Admin
                        </span>
                      )}

                      {isAdmin && !memberIsAdmin && !isCurrent && (
                        <button
                          type="button"
                          className="chat-icon-btn"
                          title="Remove from group"
                          onClick={() => handleRemoveMember(mId)}
                          style={{ color: 'var(--danger-text)', padding: '4px' }}
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="chat-modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={handleLeaveGroup}
            disabled={loadingAction}
            style={{
              background: 'transparent',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger-text)',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={13} /> Leave Group
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-secondary)',
              padding: '6px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
