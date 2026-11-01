import { io } from 'socket.io-client';

let socket = null;
const listeners = new Map();

function getSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  return apiUrl.replace(/\/api\/?$/, '');
}

export function initChatSocket() {
  const token = sessionStorage.getItem('accessToken');
  if (!token) return null;

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(getSocketUrl(), {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('⚡ Chat Socket connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('Chat Socket connection error:', err.message);
  });

  // Re-attach registered listeners
  listeners.forEach((callbacks, event) => {
    callbacks.forEach((cb) => socket.on(event, cb));
  });

  return socket;
}

export function getChatSocket() {
  if (!socket || !socket.connected) {
    return initChatSocket();
  }
  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinConversation(conversationId) {
  const s = getChatSocket();
  if (s && conversationId) {
    s.emit('join_conversation', conversationId);
  }
}

export function leaveConversation(conversationId) {
  const s = getChatSocket();
  if (s && conversationId) {
    s.emit('leave_conversation', conversationId);
  }
}

export function sendSocketMessage(payload) {
  return new Promise((resolve, reject) => {
    const s = getChatSocket();
    if (!s) {
      return reject(new Error('Socket not connected'));
    }
    s.emit('send_message', payload, (response) => {
      if (response?.success) {
        resolve(response.message);
      } else {
        reject(new Error(response?.error || 'Failed to send message'));
      }
    });
  });
}

export function startTyping(conversationId) {
  const s = getChatSocket();
  if (s && conversationId) {
    s.emit('typing_start', { conversationId });
  }
}

export function stopTyping(conversationId) {
  const s = getChatSocket();
  if (s && conversationId) {
    s.emit('typing_stop', { conversationId });
  }
}

export function markConversationRead(conversationId) {
  const s = getChatSocket();
  if (s && conversationId) {
    s.emit('mark_read', { conversationId });
  }
}

export function markConversationDelivered(conversationId) {
  const s = getChatSocket();
  if (s && conversationId) {
    s.emit('mark_delivered', { conversationId });
  }
}

export function toggleMessageReaction(conversationId, messageId, emoji) {
  const s = getChatSocket();
  if (s) {
    s.emit('toggle_reaction', { conversationId, messageId, emoji });
  }
}

export function editSocketMessage(conversationId, messageId, newText) {
  const s = getChatSocket();
  if (s) {
    s.emit('edit_message', { conversationId, messageId, newText });
  }
}

export function deleteSocketMessage(conversationId, messageId, deleteType = 'everyone') {
  const s = getChatSocket();
  if (s) {
    s.emit('delete_message', { conversationId, messageId, deleteType });
  }
}

export function onChatEvent(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  if (socket) {
    socket.on(event, callback);
  }

  // Return unsubscribe function
  return () => {
    if (listeners.has(event)) {
      listeners.get(event).delete(callback);
    }
    if (socket) {
      socket.off(event, callback);
    }
  };
}
