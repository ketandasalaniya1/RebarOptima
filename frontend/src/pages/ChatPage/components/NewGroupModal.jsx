import React, { useState, useEffect } from 'react';
import { X, Users, Check, RefreshCw } from 'lucide-react';
import { chatApi } from '../../../utils/api';

export default function NewGroupModal({ isOpen, onClose, onGroupCreated, projectId }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCandidates();
      setTitle('');
      setDescription('');
      setSelectedIds([]);
    }
  }, [isOpen, projectId]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const res = await chatApi.getCandidates('', projectId);
      if (res.success) {
        setCandidates(res.data || []);
      }
    } catch (err) {
      console.warn('Failed to load colleagues:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await chatApi.createGroupChat({
        title: title.trim(),
        description: description.trim(),
        memberUserIds: selectedIds,
        projectId: projectId || 'all',
        type: 'group',
      });
      if (res.success) {
        onGroupCreated(res.data);
        onClose();
      }
    } catch (err) {
      alert(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 }}>
            <Users size={18} color="#22c55e" /> Create Project Group
          </div>
          <button className="chat-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Group Subject / Name
              </label>
              <input
                type="text"
                placeholder="e.g. Tower B Rebar Fixing Team"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Group Description (Optional)
              </label>
              <input
                type="text"
                placeholder="Purpose of this channel..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <div style={{ padding: '8px 20px', background: '#111722', fontSize: '12px', color: '#8b949e', fontWeight: 600 }}>
            Select Members ({selectedIds.length} selected)
          </div>

          <div className="chat-modal-body" style={{ padding: '8px 0' }}>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw className="spin" size={20} style={{ marginBottom: '6px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>Loading colleagues...</p>
              </div>
            ) : (
              candidates.map((u) => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleSelect(u.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 20px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                      background: isSelected ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        border: isSelected ? '1px solid #22c55e' : '1px solid #4b5563',
                        background: isSelected ? '#22c55e' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0b0e14',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                    <div className="chat-user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                      {u.avatar ? <img src={u.avatar} alt={u.name} /> : u.name?.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '13px' }}>{u.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>{u.role || u.email}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="chat-modal-footer">
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid #30363d',
                color: '#c9d1d9',
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              style={{
                background: '#22c55e',
                color: '#0b0e14',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
