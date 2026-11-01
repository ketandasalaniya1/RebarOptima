import React, { useState } from 'react';
import { X, Search, Users, User, Send, Check } from 'lucide-react';

export default function ForwardModal({
  isOpen,
  onClose,
  message,
  conversations = [],
  onForwardMessage,
}) {
  const [search, setSearch] = useState('');
  const [selectedConvIds, setSelectedConvIds] = useState([]);
  const [sending, setSending] = useState(false);

  if (!isOpen || !message) return null;

  const filteredConversations = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (c.displayName || c.name || '').toLowerCase();
    return name.includes(q);
  });

  const toggleSelect = (convId) => {
    setSelectedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const handleSend = async () => {
    if (selectedConvIds.length === 0 || sending) return;
    setSending(true);
    try {
      await onForwardMessage(message, selectedConvIds);
      setSelectedConvIds([]);
      onClose();
    } catch (err) {
      alert(`Could not forward message: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal chat-forward-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chat-modal-header">
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
            Forward message to...
          </div>
          <button type="button" className="chat-icon-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div className="chat-search-input-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search chats and groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="chat-modal-body" style={{ padding: '8px 0', maxHeight: '320px' }}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No chats or groups found matching "{search}".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredConversations.map((conv) => {
                const cId = conv.id || conv._id;
                const isSelected = selectedConvIds.includes(cId);
                const isGroup = conv.type === 'group' || conv.type === 'project_group';

                return (
                  <div
                    key={cId}
                    className={`chat-forward-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelect(cId)}
                  >
                    <div className="chat-user-avatar" style={{ width: '38px', height: '38px', fontSize: '14px' }}>
                      {conv.displayAvatar ? (
                        <img src={conv.displayAvatar} alt={conv.displayName} />
                      ) : isGroup ? (
                        <Users size={18} />
                      ) : (
                        conv.displayName?.charAt(0) || <User size={18} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#f1f5f9' }}>
                          {conv.displayName || conv.name || 'Chat'}
                        </span>
                        {isGroup && (
                          <span style={{ fontSize: '10px', background: '#1f2937', color: '#94a3b8', padding: '1px 5px', borderRadius: '4px' }}>
                            Group
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv.lastMessage?.contentSnippet || 'No messages yet'}
                      </div>
                    </div>

                    <div className={`chat-forward-checkbox ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <Check size={14} color="#fff" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="chat-modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Forwarding: "{message.content ? message.content.substring(0, 50) : (message.attachments?.[0]?.name || 'Attachment')}"
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#21262d',
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
              type="button"
              onClick={handleSend}
              disabled={selectedConvIds.length === 0 || sending}
              style={{
                background: selectedConvIds.length > 0 ? '#238636' : '#21262d',
                border: 'none',
                color: selectedConvIds.length > 0 ? '#fff' : '#64748b',
                padding: '6px 16px',
                borderRadius: '6px',
                cursor: selectedConvIds.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Send size={14} /> Send {selectedConvIds.length > 0 && `(${selectedConvIds.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
