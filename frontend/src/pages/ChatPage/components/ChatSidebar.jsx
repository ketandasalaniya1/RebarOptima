import React, { useState } from 'react';
import {
  Users,
  Search,
  Bell,
  User,
  Plus,
  Pin,
} from 'lucide-react';
import { getPushPermission, subscribeToPushNotifications } from '../../../utils/pushNotifications';

export default function ChatSidebar({
  conversations,
  activeConvId,
  onSelectConversation,
  onOpenNewChat,
  onOpenNewGroup,
  currentUser,
  currentProjectName,
  isMobileHidden,
  onTogglePinConversation,
}) {
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread' | 'groups' | 'direct'
  const [pushStatus, setPushStatus] = useState(getPushPermission());

  React.useEffect(() => {
    if (getPushPermission() === 'granted') {
      subscribeToPushNotifications().catch(() => {});
    }
  }, []);

  const handleEnablePush = async () => {
    try {
      await subscribeToPushNotifications();
      setPushStatus('granted');
    } catch (err) {
      alert(`Could not enable notifications: ${err.message}`);
    }
  };

  // Filter conversations & sort pinned chats to top
  const filtered = conversations
    .filter((c) => {
      // 1. Tab filter
      if (filterTab === 'unread' && (!c.unreadCount || c.unreadCount === 0)) return false;
      if (filterTab === 'groups' && c.type !== 'group' && c.type !== 'project_group') return false;
      if (filterTab === 'direct' && c.type !== 'direct') return false;

      // 2. Search query filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (c.displayName || c.name || '').toLowerCase().includes(q);
        const matchSnippet = (c.lastMessage?.contentSnippet || '').toLowerCase().includes(q);
        return matchName || matchSnippet;
      }
      return true;
    })
    .sort((a, b) => {
      const aPin = a.isPinned ? 1 : 0;
      const bPin = b.isPinned ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin; // pinned first
      const aTime = new Date(a.lastMessage?.createdAt || a.updatedAt || 0).getTime();
      const bTime = new Date(b.lastMessage?.createdAt || b.updatedAt || 0).getTime();
      return bTime - aTime;
    });

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === d.toDateString();
    if (isYesterday) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside className={`chat-sidebar ${isMobileHidden ? 'mobile-hidden' : ''}`}>
      {/* Header */}
      <div className="chat-sidebar-header">
        <div className="chat-sidebar-user">
          <div className="chat-user-avatar">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} />
            ) : (
              currentUser?.name?.charAt(0) || <User size={18} />
            )}
            <div className="chat-online-dot"></div>
          </div>
          <div className="chat-user-info-text">
            <span className="chat-user-name">{currentUser?.name || 'Project Team'}</span>
            <span className="chat-user-role">
              {currentProjectName ? `📍 ${currentProjectName}` : 'All Projects'}
            </span>
          </div>
        </div>

        <div className="chat-sidebar-actions">
          <button
            type="button"
            className="chat-icon-btn"
            onClick={onOpenNewChat}
            title="Start New Direct Chat"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            className="chat-icon-btn"
            onClick={onOpenNewGroup}
            title="Create Project Group"
          >
            <Users size={18} />
          </button>
        </div>
      </div>

      {/* Push Notification Opt-in Banner */}
      {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
        <div className="chat-push-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1' }}>
            <Bell size={14} color="#38bdf8" />
            <span>Enable background notifications?</span>
          </div>
          <button
            type="button"
            className="chat-push-banner-btn"
            onClick={handleEnablePush}
          >
            Enable
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="chat-search-wrap">
        <div className="chat-search-input-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="chat-filter-pills">
        <button
          type="button"
          className={`chat-filter-pill ${filterTab === 'all' ? 'active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`chat-filter-pill ${filterTab === 'unread' ? 'active' : ''}`}
          onClick={() => setFilterTab('unread')}
        >
          Unread
        </button>
        <button
          type="button"
          className={`chat-filter-pill ${filterTab === 'direct' ? 'active' : ''}`}
          onClick={() => setFilterTab('direct')}
        >
          Direct
        </button>
        <button
          type="button"
          className={`chat-filter-pill ${filterTab === 'groups' ? 'active' : ''}`}
          onClick={() => setFilterTab('groups')}
        >
          Groups
        </button>
      </div>

      {/* Conversation List */}
      <div className="chat-conv-list">
        {filtered.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No conversations found. Click "+" to start a new direct chat or create a team group.
          </div>
        ) : (
          filtered.map((c) => {
            const isActive = String(c.id || c._id) === String(activeConvId);
            const isGroup = c.type === 'group' || c.type === 'project_group';

            return (
              <div
                key={c.id || c._id}
                className={`chat-conv-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectConversation(c)}
              >
                <div className="chat-user-avatar">
                  {c.displayAvatar ? (
                    <img src={c.displayAvatar} alt={c.displayName} />
                  ) : isGroup ? (
                    <Users size={18} />
                  ) : (
                    c.displayName?.charAt(0) || <User size={18} />
                  )}
                  {c.isOnline && !isGroup && <div className="chat-online-dot"></div>}
                </div>

                <div className="chat-conv-details">
                  <div className="chat-conv-top-row">
                    <span className="chat-conv-name">
                      {c.isPinned && (
                        <Pin
                          size={13}
                          fill="#22c55e"
                          color="#22c55e"
                          style={{ marginRight: '5px', verticalAlign: '-1px', display: 'inline-block' }}
                          title="Pinned chat"
                        />
                      )}
                      {c.displayName || c.name || 'Conversation'}
                    </span>
                    <span className="chat-conv-time">
                      {formatTime(c.lastMessage?.createdAt || c.updatedAt)}
                    </span>
                  </div>

                  <div className="chat-conv-bottom-row">
                    <span className="chat-conv-snippet">
                      {c.lastMessage?.contentSnippet || 'No messages yet'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="chat-conv-pin-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onTogglePinConversation) onTogglePinConversation(c.id || c._id);
                        }}
                        title={c.isPinned ? "Unpin chat" : "Pin chat"}
                      >
                        <Pin size={13} fill={c.isPinned ? "#22c55e" : "none"} color={c.isPinned ? "#22c55e" : "#64748b"} />
                      </button>
                      {Boolean(c.unreadCount && c.unreadCount > 0) && (
                        <span className="chat-unread-badge">{c.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
