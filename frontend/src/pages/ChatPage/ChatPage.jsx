import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { chatApi } from '../../utils/api';
import {
  initChatSocket,
  joinConversation,
  leaveConversation,
  sendSocketMessage,
  startTyping,
  stopTyping,
  markConversationRead,
  toggleMessageReaction,
  editSocketMessage,
  deleteSocketMessage,
  onChatEvent,
} from '../../utils/chatSocket';

import ChatSidebar from './components/ChatSidebar';
import ChatWindow from './components/ChatWindow';
import NewChatModal from './components/NewChatModal';
import NewGroupModal from './components/NewGroupModal';
import GroupInfoModal from './components/GroupInfoModal';
import ForwardModal from './components/ForwardModal';

import './ChatPage.css';

export default function ChatPage() {
  const authUser = useSelector((state) => state.auth?.user);
  const selectedProject = useSelector((state) => state.project?.selectedProject);
  const currentProjectId = selectedProject?._id || selectedProject?.id || localStorage.getItem('selectedProjectId') || null;
  const currentProjectName = selectedProject?.name || '';

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);

  // Modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState(null);

  // Mobile navigation state
  const [mobileView, setMobileView] = useState('sidebar'); // 'sidebar' | 'chat'

  const activeConvIdRef = useRef(null);
  activeConvIdRef.current = activeConversation?._id || activeConversation?.id;

  // Current user normalized
  const currentUserId = String(authUser?._id || authUser?.id || authUser?.sub || '');
  const currentUser = {
    id: currentUserId,
    name: `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim() || authUser?.name || authUser?.email || 'User',
    email: authUser?.email,
    avatar: authUser?.avatar,
  };

  // Sync active conversation globally so toaster knows not to pop up when viewing this chat
  useEffect(() => {
    window.__activeChatConversationId = activeConversation?._id || activeConversation?.id || null;
    return () => {
      window.__activeChatConversationId = null;
    };
  }, [activeConversation]);

  // Listen for open_chat_conversation dispatched by notification toasts
  useEffect(() => {
    const handleOpenConv = (e) => {
      const targetId = e.detail?.conversationId;
      if (!targetId) return;
      const match = conversations.find(
        (c) => String(c.id || c._id) === String(targetId)
      );
      if (match) {
        handleSelectConversation(match);
      } else {
        loadConversations().then((data) => {
          if (Array.isArray(data)) {
            const freshMatch = data.find((c) => String(c.id || c._id) === String(targetId));
            if (freshMatch) handleSelectConversation(freshMatch);
          }
        });
      }
    };

    window.addEventListener('open_chat_conversation', handleOpenConv);
    return () => window.removeEventListener('open_chat_conversation', handleOpenConv);
  }, [conversations]);

  // 1. Initial conversations load (scoped by currentProjectId)
  useEffect(() => {
    loadConversations(currentProjectId);
  }, [currentProjectId]);

  const loadConversations = async (targetProjectId = currentProjectId) => {
    try {
      const res = await chatApi.getConversations(targetProjectId);
      if (res.success && res.data) {
        setConversations(res.data);

        // If active conversation does not exist in the new project list, reset it
        if (activeConvIdRef.current) {
          const match = res.data.find(
            (c) => String(c.id || c._id) === String(activeConvIdRef.current)
          );
          if (!match) {
            setActiveConversation(null);
            setMessages([]);
          }
        }

        // Auto-select conversation from URL parameter or sessionStorage if present
        const params = new URLSearchParams(window.location.search);
        const targetConvId = params.get('conv') || sessionStorage.getItem('active_chat_conv_id');
        if (targetConvId && !activeConvIdRef.current) {
          const match = res.data.find(
            (c) => String(c.id || c._id) === String(targetConvId)
          );
          if (match) {
            sessionStorage.removeItem('active_chat_conv_id');
            handleSelectConversation(match);
          }
        }

        return res.data;
      }
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    }
    return [];
  };

  // 2. Initialize Socket.IO connection & listeners
  useEffect(() => {
    initChatSocket();

    const unsubNewMsg = onChatEvent('new_message', (msg) => {
      const activeId = activeConvIdRef.current;
      if (activeId && String(msg.conversationId) === String(activeId)) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id || m.id) === String(msg._id || msg.id))) {
            return prev;
          }
          return [...prev, msg];
        });
        markConversationRead(activeId);
      }
    });

    const unsubConvUpdated = onChatEvent('conversation_updated', ({ conversationId, lastMessage, unreadDelta }) => {
      setConversations((prev) => {
        return prev.map((c) => {
          if (String(c.id || c._id) === String(conversationId)) {
            const isActive = String(conversationId) === String(activeConvIdRef.current);
            return {
              ...c,
              lastMessage: {
                contentSnippet: lastMessage.contentSnippet || lastMessage.text || '',
                createdAt: lastMessage.createdAt || new Date(),
                senderName: lastMessage.senderName,
              },
              unreadCount: isActive ? 0 : (c.unreadCount || 0) + unreadDelta,
              updatedAt: new Date(),
            };
          }
          return c;
        }).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      });
    });

    const unsubTyping = onChatEvent('user_typing', ({ conversationId, userName }) => {
      if (String(conversationId) === String(activeConvIdRef.current)) {
        setTypingUser(userName);
      }
    });

    const unsubStopTyping = onChatEvent('user_stop_typing', ({ conversationId }) => {
      if (String(conversationId) === String(activeConvIdRef.current)) {
        setTypingUser(null);
      }
    });

    const unsubRead = onChatEvent('messages_read', ({ conversationId, userId }) => {
      if (String(conversationId) === String(activeConvIdRef.current)) {
        setMessages((prev) =>
          prev.map((m) => {
            if (String(m.senderId) === currentUserId) {
              const readBy = m.readBy || [];
              if (!readBy.some((r) => String(r.userId) === String(userId))) {
                return { ...m, readBy: [...readBy, { userId, readAt: new Date() }] };
              }
            }
            return m;
          })
        );
      }
    });

    const unsubReaction = onChatEvent('reaction_updated', ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (String(m._id || m.id) === String(messageId) ? { ...m, reactions } : m))
      );
    });

    const unsubEdited = onChatEvent('message_edited', ({ messageId, text, editedAt }) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id || m.id) === String(messageId)
            ? { ...m, content: text, isEdited: true, editedAt }
            : m
        )
      );
    });

    const unsubDeleted = onChatEvent('message_deleted', ({ messageId, deleteType }) => {
      if (deleteType === 'everyone') {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id || m.id) === String(messageId)
              ? { ...m, isDeletedForEveryone: true }
              : m
          )
        );
      } else {
        setMessages((prev) => prev.filter((m) => String(m._id || m.id) !== String(messageId)));
      }
    });

    const unsubPresence = onChatEvent('user_presence_changed', ({ userId, isOnline }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.otherUserId === String(userId)) {
            return { ...c, isOnline };
          }
          return c;
        })
      );
      setActiveConversation((prev) => {
        if (prev && prev.otherUserId === String(userId)) {
          return { ...prev, isOnline };
        }
        return prev;
      });
    });

    const unsubPinnedMsg = onChatEvent('pinned_messages_updated', ({ conversationId, pinnedMessageIds }) => {
      setActiveConversation((prev) => {
        if (prev && String(prev._id || prev.id) === String(conversationId)) {
          return { ...prev, pinnedMessageIds };
        }
        return prev;
      });
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id || c._id) === String(conversationId)
            ? { ...c, pinnedMessageIds }
            : c
        )
      );
    });

    const unsubStarred = onChatEvent('message_starred', ({ messageId, starredBy }) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id || m.id) === String(messageId) ? { ...m, starredBy } : m
        )
      );
    });

    return () => {
      unsubNewMsg();
      unsubConvUpdated();
      unsubTyping();
      unsubStopTyping();
      unsubRead();
      unsubReaction();
      unsubEdited();
      unsubDeleted();
      unsubPresence();
      unsubPinnedMsg();
      unsubStarred();
    };
  }, [currentUserId]);

  // 3. Handle selecting a conversation
  const handleSelectConversation = async (conv) => {
    const prevId = activeConvIdRef.current;
    if (prevId) {
      leaveConversation(prevId);
    }

    const convId = conv.id || conv._id;
    setActiveConversation(conv);
    setMobileView('chat');
    setTypingUser(null);

    joinConversation(convId);
    markConversationRead(convId);

    // Clear unread in sidebar locally
    setConversations((prev) =>
      prev.map((c) => (String(c.id || c._id) === String(convId) ? { ...c, unreadCount: 0 } : c))
    );

    // Fetch messages
    try {
      const res = await chatApi.getMessages(convId);
      if (res.success && res.data) {
        setMessages(res.data);
      }
    } catch (err) {
      console.warn('Failed to load messages:', err);
    }
  };

  // 4. Send Message Handler
  const handleSendMessage = async (payload) => {
    const convId = activeConversation?._id || activeConversation?.id;
    if (!convId) return;

    try {
      await sendSocketMessage({
        conversationId: convId,
        content: payload.content,
        text: payload.content,
        type: payload.type || 'text',
        attachments: payload.attachments,
        replyTo: payload.replyTo,
      });
    } catch (err) {
      // Fallback to REST API
      try {
        const res = await chatApi.sendMessage(convId, payload);
        if (res.success && res.data) {
          setMessages((prev) => [...prev, res.data]);
        }
      } catch (restErr) {
        alert('Could not deliver message: ' + restErr.message);
      }
    }
  };

  // 5. Typing Handlers
  const handleTypingStart = () => {
    const convId = activeConversation?._id || activeConversation?.id;
    if (convId) startTyping(convId);
  };

  const handleTypingStop = () => {
    const convId = activeConversation?._id || activeConversation?.id;
    if (convId) stopTyping(convId);
  };

  // 6. Reaction, Edit, Delete
  const handleReactMessage = (messageId, emoji) => {
    const convId = activeConversation?._id || activeConversation?.id;
    if (convId && messageId) {
      toggleMessageReaction(convId, messageId, emoji);
    }
  };

  const handleEditMessage = (msg) => {
    const newText = prompt('Edit your message:', msg.content);
    if (newText !== null && newText.trim() && newText.trim() !== msg.content) {
      const convId = activeConversation?._id || activeConversation?.id;
      editSocketMessage(convId, msg._id || msg.id, newText.trim());
    }
  };

  const handleDeleteMessage = (messageId) => {
    const isEveryone = window.confirm(
      'Delete message for everyone? Click OK for "Delete for everyone", or Cancel to delete just for yourself.'
    );
    const convId = activeConversation?._id || activeConversation?.id;
    deleteSocketMessage(convId, messageId, isEveryone ? 'everyone' : 'me');
  };

  // 7. Starting new Direct Chat (scoped by currentProjectId)
  const handleSelectContactForDirect = async (contact) => {
    setShowNewChatModal(false);
    try {
      const res = await chatApi.startDirectChat(contact.id, currentProjectId);
      if (res.success && res.data) {
        await loadConversations(currentProjectId);
        handleSelectConversation(res.data);
      }
    } catch (err) {
      alert('Could not start direct chat: ' + err.message);
    }
  };

  // 8. New Group Created
  const handleGroupCreated = async (newGroup) => {
    await loadConversations(currentProjectId);
    handleSelectConversation(newGroup);
  };

  // 9. Forward Message Handler (to selected chats & groups)
  const handleForwardMessage = async (msgToForward, targetConvIds) => {
    for (const convId of targetConvIds) {
      try {
        await sendSocketMessage({
          conversationId: convId,
          content: msgToForward.content || '',
          text: msgToForward.content || '',
          type: msgToForward.type || 'text',
          attachments: msgToForward.attachments || [],
        });
      } catch {
        // Fallback to REST API if socket fails
        await chatApi.sendMessage(convId, {
          content: msgToForward.content || '',
          text: msgToForward.content || '',
          type: msgToForward.type || 'text',
          attachments: msgToForward.attachments || [],
        });
      }
    }
    await loadConversations(currentProjectId);

    // If forwarded to a single chat, switch to it
    if (targetConvIds.length === 1) {
      const target = conversations.find(
        (c) => String(c.id || c._id) === String(targetConvIds[0])
      );
      if (target) {
        handleSelectConversation(target);
      }
    }
  };

  // 10. Toggle Pin Conversation (Sidebar)
  const handleTogglePinConversation = async (convId) => {
    try {
      const res = await chatApi.togglePinConversation(convId);
      if (res.success && res.data) {
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id || c._id) === String(convId)
              ? { ...c, isPinned: res.data.isPinned }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle pin conversation:', err);
    }
  };

  // 11. Toggle Pin Message in Conversation
  const handleTogglePinMessage = async (messageId) => {
    const convId = activeConversation?._id || activeConversation?.id;
    if (!convId || !messageId) return;
    try {
      const res = await chatApi.togglePinMessage(convId, messageId);
      if (res.success && res.data) {
        setActiveConversation((prev) =>
          prev ? { ...prev, pinnedMessageIds: res.data.pinnedMessageIds } : prev
        );
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id || c._id) === String(convId)
              ? { ...c, pinnedMessageIds: res.data.pinnedMessageIds }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle pin message:', err);
    }
  };

  // 12. Toggle Star Message
  const handleToggleStarMessage = async (messageId) => {
    if (!messageId) return;
    try {
      const res = await chatApi.toggleStarMessage(messageId);
      if (res.success && res.data) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id || m.id) === String(messageId)
              ? { ...m, starredBy: res.data.starredBy }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle star message:', err);
    }
  };

  return (
    <div className="chat-page-root">
      {/* Sidebar (List & Search) */}
      <ChatSidebar
        conversations={conversations}
        activeConvId={activeConversation?._id || activeConversation?.id}
        onSelectConversation={handleSelectConversation}
        onOpenNewChat={() => setShowNewChatModal(true)}
        onOpenNewGroup={() => setShowNewGroupModal(true)}
        onTogglePinConversation={handleTogglePinConversation}
        currentUser={currentUser}
        currentProjectName={currentProjectName}
        isMobileHidden={mobileView === 'chat'}
      />

      {/* Main Conversation Window */}
      <ChatWindow
        activeConversation={activeConversation}
        messages={messages}
        currentUserId={currentUserId}
        onSendMessage={handleSendMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        typingUser={typingUser}
        onReactMessage={handleReactMessage}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        onOpenGroupInfo={() => setShowGroupInfoModal(true)}
        onBackToSidebar={() => setMobileView('sidebar')}
        isMobileHidden={mobileView === 'sidebar'}
        onForward={(msg) => setForwardingMessage(msg)}
        onTogglePinMessage={handleTogglePinMessage}
        onToggleStarMessage={handleToggleStarMessage}
      />

      {/* Modals */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onSelectContact={handleSelectContactForDirect}
        projectId={currentProjectId}
      />

      <NewGroupModal
        isOpen={showNewGroupModal}
        onClose={() => setShowNewGroupModal(false)}
        onGroupCreated={handleGroupCreated}
        projectId={currentProjectId}
      />

      <GroupInfoModal
        isOpen={showGroupInfoModal}
        onClose={() => setShowGroupInfoModal(false)}
        conversation={activeConversation}
        currentUserId={currentUserId}
        onConversationUpdated={(updatedConv) => {
          setActiveConversation(updatedConv);
          loadConversations(currentProjectId);
        }}
        onLeaveGroup={() => {
          setActiveConversation(null);
          loadConversations(currentProjectId);
        }}
      />

      {/* Forward Modal */}
      <ForwardModal
        isOpen={Boolean(forwardingMessage)}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        conversations={conversations}
        onForwardMessage={handleForwardMessage}
      />
    </div>
  );
}
