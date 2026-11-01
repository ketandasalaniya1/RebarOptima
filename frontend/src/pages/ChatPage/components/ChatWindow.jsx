import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Users,
  ChevronLeft,
  Info,
  Lock,
  Search,
  ArrowDown,
  X,
  Pin,
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import MessageInfoModal from './MessageInfoModal';
import { chatApi } from '../../../utils/api';

export default function ChatWindow({
  activeConversation,
  messages,
  currentUserId,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  typingUser,
  onReactMessage,
  onEditMessage,
  onDeleteMessage,
  onOpenGroupInfo,
  onBackToSidebar,
  isMobileHidden,
  onForward,
  onTogglePinMessage,
  onToggleStarMessage,
}) {
  const [replyingTo, setReplyingTo] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false);
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const isNearBottomRef = useRef(true);

  // Smooth scroll to replied or pinned message and highlight with a flash
  const handleScrollToMessage = (messageId) => {
    if (!messageId) return;
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('chat-msg-highlight-flash');
      void el.offsetWidth; // trigger DOM reflow to restart animation
      el.classList.add('chat-msg-highlight-flash');
      setTimeout(() => {
        el.classList.remove('chat-msg-highlight-flash');
      }, 1600);
    }
  };

  // Load candidate profiles for Message Info
  useEffect(() => {
    let isMounted = true;
    chatApi.getCandidates()
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setCandidates(res.data);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [activeConversation?._id || activeConversation?.id]);

  const checkIfNearBottom = () => {
    if (!containerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollHeight - scrollTop - clientHeight < 150;
  };

  const handleScroll = () => {
    const nearBottom = checkIfNearBottom();
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setHasNewMessagesBelow(false);
    }
  };

  // Scroll to bottom helper
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setHasNewMessagesBelow(false);
  };

  // Intelligent scroll on new messages
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const isMyMsg = String(lastMsg?.senderId) === String(currentUserId);

    if (isNearBottomRef.current || isMyMsg) {
      scrollToBottom('smooth');
    } else {
      setHasNewMessagesBelow(true);
    }
  }, [messages]);

  // Initial conversation scroll to bottom
  useEffect(() => {
    scrollToBottom('auto');
  }, [activeConversation?._id || activeConversation?.id]);

  if (!activeConversation) {
    return (
      <section className={`chat-window ${isMobileHidden ? 'mobile-hidden' : ''}`}>
        <div className="chat-empty-state">
          <div className="chat-empty-icon-wrap">
            <MessageSquare size={36} />
          </div>
          <h2 className="chat-empty-title">Rebar Optima Project Communication</h2>
          <p className="chat-empty-desc">
            Direct & group messaging for site engineers, project managers, and contractors.
            Real-time chat, instant media sharing, voice notes, and push alerts.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px' }}>
            <Lock size={14} color="#22c55e" /> Encrypted multi-tenant SaaS communication
          </div>
        </div>
      </section>
    );
  }

  const isGroup = activeConversation.type === 'group' || activeConversation.type === 'project_group';
  const pinnedIds = activeConversation.pinnedMessageIds || [];
  const latestPinnedId = pinnedIds.length > 0 ? pinnedIds[pinnedIds.length - 1] : null;
  const pinnedMsg = latestPinnedId
    ? messages.find((m) => String(m._id || m.id) === String(latestPinnedId))
    : null;

  const groupMembers = isGroup && Array.isArray(activeConversation.memberIds)
    ? candidates.filter((c) =>
        activeConversation.memberIds.some((mId) => String(mId) === String(c.id || c._id))
      )
    : candidates;

  // Group messages by date
  const renderMessagesWithDateHeaders = () => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? messages.filter(
          (m) =>
            (m.content || '').toLowerCase().includes(query) ||
            (m.attachments || []).some((a) => (a.name || '').toLowerCase().includes(query))
        )
      : messages;

    if (query && filtered.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8b949e', fontSize: '13px' }}>
          No messages matching "{searchQuery}" found in this conversation.
        </div>
      );
    }

    let lastDate = '';
    return filtered.map((m) => {
      const msgDate = new Date(m.createdAt || Date.now()).toLocaleDateString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const showHeader = msgDate !== lastDate;
      lastDate = msgDate;

      const msgId = m._id || m.id;
      const isPinned = Boolean(pinnedIds.some((pId) => String(pId) === String(msgId)));
      const isStarred = Boolean((m.starredBy || []).some((uid) => String(uid) === String(currentUserId)));

      return (
        <React.Fragment key={msgId}>
          {showHeader && <div className="chat-date-separator">{msgDate}</div>}
          <MessageBubble
            message={m}
            currentUserId={currentUserId}
            isPinned={isPinned}
            isStarred={isStarred}
            onTogglePin={onTogglePinMessage}
            onToggleStar={onToggleStarMessage}
            onScrollToMessage={handleScrollToMessage}
            onReply={(msg) => setReplyingTo(msg)}
            onReact={onReactMessage}
            onEdit={onEditMessage}
            onDelete={onDeleteMessage}
            onShowInfo={(msg) => setSelectedMessageForInfo(msg)}
            onForward={onForward}
          />
        </React.Fragment>
      );
    });
  };

  return (
    <section className={`chat-window ${isMobileHidden ? 'mobile-hidden' : ''}`}>
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-left" onClick={isGroup ? onOpenGroupInfo : undefined}>
          <button
            type="button"
            className="chat-back-mobile"
            onClick={(e) => {
              e.stopPropagation();
              onBackToSidebar();
            }}
          >
            <ChevronLeft size={24} />
          </button>

          <div className="chat-user-avatar">
            {activeConversation.displayAvatar ? (
              <img src={activeConversation.displayAvatar} alt={activeConversation.displayName} />
            ) : isGroup ? (
              <Users size={18} />
            ) : (
              activeConversation.displayName?.charAt(0) || 'U'
            )}
            {activeConversation.isOnline && !isGroup && <div className="chat-online-dot"></div>}
          </div>

          <div>
            <div className="chat-header-title">
              {activeConversation.displayName || activeConversation.name || 'Chat'}
            </div>
            <div
              className={`chat-header-status ${
                activeConversation.isOnline ? '' : 'offline'
              }`}
            >
              {typingUser
                ? `${typingUser} is typing...`
                : isGroup
                ? `${(activeConversation.memberIds || []).length} participants`
                : activeConversation.isOnline
                ? 'online'
                : 'offline'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="chat-icon-btn"
            onClick={() => {
              setShowSearch((prev) => !prev);
              if (showSearch) setSearchQuery('');
            }}
            title="Search Messages"
          >
            <Search size={18} />
          </button>
          {isGroup && (
            <button
              type="button"
              className="chat-icon-btn"
              onClick={onOpenGroupInfo}
              title="Group Information"
            >
              <Info size={18} />
            </button>
          )}
        </div>
      </header>

      {/* In-Chat Message Search Bar */}
      {showSearch && (
        <div style={{
          padding: '8px 16px',
          background: '#0d1117',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Search size={15} color="#8b949e" />
          <input
            type="text"
            placeholder="Search within this chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f0f6fc',
              fontSize: '13px'
            }}
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              className="chat-icon-btn"
              style={{ width: '22px', height: '22px', padding: 0 }}
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* WhatsApp Pinned Message Banner */}
      {pinnedMsg && (
        <div
          className="chat-pinned-message-banner"
          onClick={() => handleScrollToMessage(pinnedMsg._id || pinnedMsg.id)}
          title="Click to jump to pinned message"
        >
          <div className="chat-pinned-banner-content">
            <Pin size={15} className="chat-pinned-icon" />
            <div className="chat-pinned-text-wrap">
              <span className="chat-pinned-sender">
                {pinnedMsg.senderName || 'Pinned Message'}:
              </span>
              <span className="chat-pinned-snippet">
                {pinnedMsg.content || (pinnedMsg.attachments?.length ? '📎 Attachment' : 'Pinned message')}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="chat-pinned-unpin-btn"
            title="Unpin message"
            onClick={(e) => {
              e.stopPropagation();
              if (onTogglePinMessage) {
                onTogglePinMessage(pinnedMsg._id || pinnedMsg.id);
              }
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Message List */}
      <div
        className="chat-messages-container"
        ref={containerRef}
        onScroll={handleScroll}
        style={{ position: 'relative' }}
      >
        {renderMessagesWithDateHeaders()}

        {/* Live typing presence indicator */}
        {typingUser && (
          <div className="chat-typing-bubble">
            <span style={{ color: '#22c55e' }}>●</span> {typingUser} is typing...
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Floating New Messages Indicator */}
        {hasNewMessagesBelow && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            style={{
              position: 'sticky',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              background: '#238636',
              color: '#ffffff',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              cursor: 'pointer'
            }}
          >
            <ArrowDown size={14} /> New messages below
          </button>
        )}
      </div>

      {/* Message Composer */}
      <MessageComposer
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        isGroup={isGroup}
        groupMembers={groupMembers}
      />

      {/* WhatsApp-style Message Info Modal */}
      <MessageInfoModal
        isOpen={Boolean(selectedMessageForInfo)}
        onClose={() => setSelectedMessageForInfo(null)}
        message={selectedMessageForInfo}
        conversation={activeConversation}
        candidates={candidates}
        currentUserId={currentUserId}
      />
    </section>
  );
}
