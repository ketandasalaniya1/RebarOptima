import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  CheckCheck,
  Reply,
  Trash2,
  Edit2,
  Copy,
  FileText,
  Download,
  ChevronDown,
  Info,
  Forward,
  Pin,
  Star,
  Plus,
} from 'lucide-react';
import ReactionPickerModal from './ReactionPickerModal';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageBubble({
  message,
  currentUserId,
  isPinned = false,
  isStarred = false,
  onTogglePin,
  onToggleStar,
  onScrollToMessage,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onShowInfo,
  onForward,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const menuRef = useRef(null);
  const bubbleRef = useRef(null);

  const LONG_MSG_LIMIT = 320;

  const isMine = String(message.senderId) === String(currentUserId);
  const isDeleted = message.isDeletedForEveryone;

  // Format sent time
  const timeStr = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  // Determine read receipt ticks
  const isRead = (message.readBy || []).some(
    (r) => String(r.userId) !== String(currentUserId)
  );
  const isDelivered = (message.deliveredTo || []).some(
    (d) => String(d.userId) !== String(currentUserId)
  );

  // Group reactions by emoji
  const reactionsMap = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    setShowMenu(false);
  };

  const handleReplyAction = () => {
    onReply(message);
    setShowMenu(false);
  };

  const handleShowInfoAction = () => {
    if (onShowInfo) onShowInfo(message);
    setShowMenu(false);
  };

  const handleEditAction = () => {
    onEdit(message);
    setShowMenu(false);
  };

  const handleDeleteAction = () => {
    onDelete(message._id || message.id);
    setShowMenu(false);
  };

  const handleForwardAction = () => {
    if (onForward) {
      onForward(message);
    } else {
      handleCopy();
      alert('Message content copied to clipboard for forwarding.');
    }
    setShowMenu(false);
  };

  const hasAttachments = Boolean(message.attachments && message.attachments.length > 0);

  const handleDownloadAttachment = () => {
    if (hasAttachments) {
      const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : 'http://localhost:3000';
      message.attachments.forEach((att) => {
        const rawUrl = att.url || `/api/chat/attachments/${att.fileId}`;
        const downloadUrl = rawUrl.startsWith('http') ? rawUrl : `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = att.fileName || att.name || 'download';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }
    setShowMenu(false);
  };

  const handleContextMenu = (e) => {
    if (isDeleted) return;
    e.preventDefault();
    setShowMenu(true);
  };

  // Parse text content for @mentions and WhatsApp-style "Read more"
  const renderMessageContent = (content) => {
    if (!content) return null;
    const isLong = content.length > LONG_MSG_LIMIT;
    const textToShow = isLong && !isExpanded ? content.slice(0, LONG_MSG_LIMIT) + '... ' : content;

    // Split text by mention patterns: @all, @everyone, or @[name]
    const parts = textToShow.split(/(@all|@everyone|@[a-zA-Z0-9_]+(?:\s+[a-zA-Z0-9_]+)?)/gi);

    return (
      <div className="chat-msg-text-content" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {parts.map((part, i) => {
          if (/^@(all|everyone)$/i.test(part)) {
            return (
              <span key={i} className="chat-mention-tag mention-all">
                {part}
              </span>
            );
          }
          if (/^@[a-zA-Z0-9_]/i.test(part)) {
            return (
              <span key={i} className="chat-mention-tag">
                {part}
              </span>
            );
          }
          return part;
        })}
        {isLong && (
          <button
            type="button"
            className="chat-read-more-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
          >
            {isExpanded ? 'Read less' : 'Read more'}
          </button>
        )}
      </div>
    );
  };

  const isSystem = message.type === 'system' || message.senderId === 'system';
  if (isSystem) {
    return (
      <div className="chat-system-msg-pill">
        <span>{message.content}</span>
      </div>
    );
  }

  return (
    <div
      id={`msg-${message._id || message.id}`}
      className={`chat-msg-row ${isMine ? 'sent' : 'received'}`}
    >
      {/* Bubble Content */}
      <div
        className="chat-msg-bubble"
        ref={bubbleRef}
        onContextMenu={handleContextMenu}
      >
        {/* WhatsApp-style Dropdown Chevron Button */}
        {!isDeleted && (
          <button
            type="button"
            className="chat-bubble-menu-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            title="Message options"
          >
            <ChevronDown size={16} />
          </button>
        )}

        {/* Sender name in group */}
        {!isMine && message.senderName && (
          <div className="chat-msg-sender-name">{message.senderName}</div>
        )}

        {/* Quoted reply banner - Click scrolls to quoted message with flash highlight */}
        {message.replyTo && (
          <div
            className="chat-quoted-reply clickable"
            onClick={(e) => {
              e.stopPropagation();
              if (message.replyTo?.messageId && onScrollToMessage) {
                onScrollToMessage(message.replyTo.messageId);
              }
            }}
            title="Click to jump to replied message"
          >
            <div className="chat-quoted-sender">{message.replyTo.senderName}</div>
            <div className="chat-quoted-text">{message.replyTo.contentSnippet}</div>
          </div>
        )}

        {/* Deleted message indicator */}
        {isDeleted ? (
          <span style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '13px' }}>
            🚫 This message was deleted
          </span>
        ) : (
          <>
            {/* Attachments (Photos, Videos, Documents) */}
            {message.attachments && message.attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: message.content ? '6px' : '0' }}>
                {message.attachments.map((att, i) => {
                  const isImage = att.mimeType?.startsWith('image/');
                  const isVideo = att.mimeType?.startsWith('video/');
                  const isAudio = att.mimeType?.startsWith('audio/');
                  const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : 'http://localhost:3000';
                  const rawUrl = att.url || `/api/chat/attachments/${att.fileId}`;
                  const downloadUrl = rawUrl.startsWith('http') ? rawUrl : `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

                  if (isImage) {
                    return (
                      <a key={i} href={downloadUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={downloadUrl}
                          alt={att.name || 'Photo'}
                          className="chat-msg-image"
                        />
                      </a>
                    );
                  }

                  if (isVideo) {
                    return (
                      <div key={i} style={{ marginTop: '4px', maxWidth: '320px' }}>
                        <video controls className="chat-msg-video" style={{ width: '100%', borderRadius: '8px', maxHeight: '240px', background: '#000' }}>
                          <source src={downloadUrl} type={att.mimeType} />
                          Your browser does not support HTML5 video.
                        </video>
                      </div>
                    );
                  }

                  if (isAudio) {
                    return (
                      <audio key={i} controls className="chat-msg-audio">
                        <source src={downloadUrl} type={att.mimeType} />
                        Your browser does not support the audio element.
                      </audio>
                    );
                  }

                  // Document / Generic file
                  return (
                    <a
                      key={i}
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={att.name || 'attachment'}
                      className="chat-msg-doc"
                    >
                      <FileText size={24} color="#38bdf8" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {att.name || 'Document'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {att.sizeBytes ? `${(att.sizeBytes / 1024).toFixed(0)} KB` : 'File'}
                        </div>
                      </div>
                      <Download size={16} color="#94a3b8" />
                    </a>
                  );
                })}
              </div>
            )}

            {/* Text Content / Caption with Mentions and Read more */}
            {message.content && renderMessageContent(message.content)}
          </>
        )}

        {/* Message Meta (Timestamp + Pin + Star + Read status) */}
        <div className="chat-msg-meta">
          {message.editedAt && <span className="chat-msg-edited">edited</span>}
          {isPinned && (
            <Pin size={11} className="chat-meta-pin-icon" title="Pinned message" />
          )}
          {isStarred && (
            <Star size={11} fill="#eab308" color="#eab308" className="chat-meta-star-icon" title="Starred message" />
          )}
          <span>{timeStr}</span>
          {isMine && !isDeleted && (
            <span>
              {isRead ? (
                <CheckCheck size={14} className="chat-tick-read" />
              ) : isDelivered ? (
                <CheckCheck size={14} />
              ) : (
                <Check size={14} />
              )}
            </span>
          )}
        </div>

        {/* WhatsApp-style Dropdown Context Menu (Matches reference image) */}
        {showMenu && !isDeleted && (
          <div
            className={`chat-whatsapp-context-menu ${isMine ? 'sent-menu' : 'received-menu'}`}
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Emoji Reaction Bar on Top */}
            <div className="chat-reaction-bar-top">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="chat-top-reaction-btn"
                  onClick={() => {
                    onReact(message._id || message.id, emoji);
                    setShowMenu(false);
                  }}
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                className="chat-top-reaction-btn plus-btn"
                onClick={() => {
                  setShowReactionPicker(true);
                  setShowMenu(false);
                }}
                title="More reactions"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* 2. Vertical Action List */}
            <div className="chat-whatsapp-menu-list">
              <button
                type="button"
                className="chat-whatsapp-menu-item"
                onClick={handleShowInfoAction}
              >
                <Info size={16} className="menu-icon" />
                <span>Message info</span>
              </button>

              <button
                type="button"
                className="chat-whatsapp-menu-item"
                onClick={handleReplyAction}
              >
                <Reply size={16} className="menu-icon" />
                <span>Reply</span>
              </button>

              {/* If message has attachments, show Download option instead of Copy */}
              {hasAttachments ? (
                <button
                  type="button"
                  className="chat-whatsapp-menu-item"
                  onClick={handleDownloadAttachment}
                >
                  <Download size={16} className="menu-icon" />
                  <span>Download</span>
                </button>
              ) : (
                message.content && (
                  <button
                    type="button"
                    className="chat-whatsapp-menu-item"
                    onClick={handleCopy}
                  >
                    <Copy size={16} className="menu-icon" />
                    <span>Copy</span>
                  </button>
                )
              )}

              <button
                type="button"
                className="chat-whatsapp-menu-item"
                onClick={handleForwardAction}
              >
                <Forward size={16} className="menu-icon" />
                <span>Forward</span>
              </button>

              <button
                type="button"
                className="chat-whatsapp-menu-item"
                onClick={() => {
                  if (onTogglePin) onTogglePin(message._id || message.id);
                  setShowMenu(false);
                }}
              >
                <Pin size={16} className="menu-icon" />
                <span>{isPinned ? 'Unpin' : 'Pin'}</span>
              </button>

              <button
                type="button"
                className="chat-whatsapp-menu-item"
                onClick={() => {
                  if (onToggleStar) onToggleStar(message._id || message.id);
                  setShowMenu(false);
                }}
              >
                <Star
                  size={16}
                  className="menu-icon"
                  fill={isStarred ? '#eab308' : 'none'}
                  color={isStarred ? '#eab308' : 'currentColor'}
                />
                <span>{isStarred ? 'Unstar' : 'Star'}</span>
              </button>

              {isMine && (
                <button
                  type="button"
                  className="chat-whatsapp-menu-item"
                  onClick={handleEditAction}
                >
                  <Edit2 size={16} className="menu-icon" />
                  <span>Edit</span>
                </button>
              )}

              <button
                type="button"
                className="chat-whatsapp-menu-item danger"
                onClick={handleDeleteAction}
              >
                <Trash2 size={16} className="menu-icon" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reactions pill */}
      {Object.keys(reactionsMap).length > 0 && !isDeleted && (
        <div className="chat-reactions-pill">
          {Object.entries(reactionsMap).map(([emoji, count]) => (
            <span key={emoji} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <span>{emoji}</span>
              {count > 1 && <span style={{ fontSize: '10px', color: '#94a3b8' }}>{count}</span>}
            </span>
          ))}
        </div>
      )}

      {/* WhatsApp Web Style Emoji Reaction Picker Popup */}
      <ReactionPickerModal
        isOpen={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        onSelectEmoji={(emoji) => {
          onReact(message._id || message.id, emoji);
        }}
        placement={isMine ? 'right' : 'left'}
      />
    </div>
  );
}
