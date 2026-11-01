import React from 'react';
import { X, Check, CheckCheck, Info, Clock, User } from 'lucide-react';

export default function MessageInfoModal({
  isOpen,
  onClose,
  message,
  conversation,
  candidates = [],
  currentUserId,
}) {
  if (!isOpen || !message) return null;

  const isMine = String(message.senderId) === String(currentUserId);
  const isGroup = conversation?.type === 'group' || conversation?.type === 'project_group';

  // Format timestamp helper
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
  };

  // Helper to find candidate profile
  const getCandidate = (userId) => {
    return candidates.find((c) => String(c.id || c._id) === String(userId));
  };

  // Group read/delivered receipts
  const readByList = (message.readBy || []).filter(
    (r) => String(r.userId) !== String(message.senderId)
  );

  const deliveredToList = (message.deliveredTo || []).filter(
    (d) => String(d.userId) !== String(message.senderId) && !readByList.some((r) => String(r.userId) === String(d.userId))
  );

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal chat-msg-info-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="chat-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600 }}>
            <Info size={18} color="#53bdeb" /> Message info
          </div>
          <button type="button" className="chat-icon-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="chat-modal-body" style={{ padding: '16px' }}>
          {/* Message Preview Bubble */}
          <div className="chat-info-msg-preview-wrap">
            <div className={`chat-msg-bubble ${isMine ? 'sent-preview' : 'received-preview'}`}>
              {message.content && (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '14px' }}>
                  {message.content}
                </div>
              )}
              {message.attachments && message.attachments.length > 0 && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#94a3b8' }}>
                  📎 {message.attachments.map((a) => a.name).join(', ')}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '4px',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginTop: '6px',
                }}
              >
                <span>{new Date(message.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {isMine && (
                  <span>
                    {readByList.length > 0 ? (
                      <CheckCheck size={14} className="chat-tick-read" />
                    ) : (message.deliveredTo || []).length > 1 ? (
                      <CheckCheck size={14} />
                    ) : (
                      <Check size={14} />
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Breakdown Section (WhatsApp Web Style) */}
          <div className="chat-info-sections">
            {/* 1. READ BY */}
            <div className="chat-info-section">
              <div className="chat-info-section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCheck size={16} className="chat-tick-read" />
                  <span className="chat-info-section-title">Read</span>
                </div>
                {readByList.length > 0 && (
                  <span className="chat-info-badge">{readByList.length}</span>
                )}
              </div>

              {readByList.length === 0 ? (
                <div className="chat-info-empty-row">
                  <Clock size={13} color="#64748b" /> Not read yet
                </div>
              ) : (
                <div className="chat-info-receipts-list">
                  {readByList.map((r, i) => {
                    const c = getCandidate(r.userId);
                    const name = c?.name || `Colleague ${String(r.userId).substring(0, 6)}`;
                    const role = c?.role;
                    return (
                      <div key={i} className="chat-info-receipt-row">
                        <div className="chat-info-user">
                          <div className="chat-user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                            {c?.avatar ? <img src={c.avatar} alt={name} /> : name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="chat-info-user-name">{name}</div>
                            {role && <div className="chat-info-user-role">{role}</div>}
                          </div>
                        </div>
                        <div className="chat-info-time">{formatDateTime(r.readAt)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. DELIVERED TO */}
            <div className="chat-info-section">
              <div className="chat-info-section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCheck size={16} color="#94a3b8" />
                  <span className="chat-info-section-title">Delivered</span>
                </div>
                {deliveredToList.length > 0 && (
                  <span className="chat-info-badge">{deliveredToList.length}</span>
                )}
              </div>

              {deliveredToList.length === 0 ? (
                <div className="chat-info-empty-row">
                  {readByList.length > 0 ? 'All recipients have read this message' : 'Pending delivery to recipient'}
                </div>
              ) : (
                <div className="chat-info-receipts-list">
                  {deliveredToList.map((d, i) => {
                    const c = getCandidate(d.userId);
                    const name = c?.name || `Colleague ${String(d.userId).substring(0, 6)}`;
                    const role = c?.role;
                    return (
                      <div key={i} className="chat-info-receipt-row">
                        <div className="chat-info-user">
                          <div className="chat-user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                            {c?.avatar ? <img src={c.avatar} alt={name} /> : name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="chat-info-user-name">{name}</div>
                            {role && <div className="chat-info-user-role">{role}</div>}
                          </div>
                        </div>
                        <div className="chat-info-time">{formatDateTime(d.deliveredAt)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. REACTIONS BREAKDOWN (IF ANY) */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="chat-info-section">
                <div className="chat-info-section-header">
                  <span className="chat-info-section-title">Reactions</span>
                  <span className="chat-info-badge">{message.reactions.length}</span>
                </div>
                <div className="chat-info-receipts-list">
                  {message.reactions.map((r, i) => {
                    const c = getCandidate(r.userId);
                    const name = r.userName || c?.name || 'Colleague';
                    return (
                      <div key={i} className="chat-info-receipt-row">
                        <div className="chat-info-user">
                          <span style={{ fontSize: '18px', marginRight: '6px' }}>{r.emoji}</span>
                          <span className="chat-info-user-name">{name}</span>
                        </div>
                        <div className="chat-info-time">
                          {r.addedAt ? formatDateTime(r.addedAt) : 'Just now'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="chat-modal-footer">
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              color: '#c9d1d9',
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
