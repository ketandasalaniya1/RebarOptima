import React, { useState, useEffect } from 'react';
import { X, Search, User, MessageSquare, RefreshCw } from 'lucide-react';
import { chatApi } from '../../../utils/api';

export default function NewChatModal({ isOpen, onClose, onSelectContact, projectId }) {
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadCandidates();
    }
  }, [isOpen, search, projectId]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const res = await chatApi.getCandidates(search, projectId);
      if (res.success) {
        setCandidates(res.data || []);
      }
    } catch (err) {
      console.warn('Failed to load colleagues:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 }}>
            <MessageSquare size={18} color="#22c55e" /> New Direct Chat
          </div>
          <button className="chat-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div className="chat-search-input-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search colleagues by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="chat-modal-body" style={{ padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw className="spin" size={20} style={{ marginBottom: '6px' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>Loading colleagues...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No colleagues found in this project.
            </div>
          ) : (
            candidates.map((u) => (
              <div
                key={u.id}
                onClick={() => onSelectContact(u)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="chat-user-avatar">
                  {u.avatar ? <img src={u.avatar} alt={u.name} /> : u.name?.charAt(0) || <User size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '13px' }}>{u.name}</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>{u.role || u.email}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
