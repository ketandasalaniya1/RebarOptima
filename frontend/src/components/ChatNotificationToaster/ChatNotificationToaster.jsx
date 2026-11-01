import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { setView } from '../../store/slices/routingSlice';
import { initChatSocket, onChatEvent } from '../../utils/chatSocket';
import './ChatNotificationToaster.css';

// Audio chime generator using Web Audio API (zero external assets needed)
function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Two-tone chime: High gentle ping
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    playTone(784, 0, 0.15); // G5
    playTone(1046.5, 0.08, 0.28); // C6
  } catch {
    // Silently ignore browser autoplay policies
  }
}

// Toast content component with avatar, title, snippet and click-to-open action
function MessageToastCard({ title, senderName, content, type, onClick }) {
  const initial = (senderName || 'U').charAt(0).toUpperCase();

  let bodyText = content || 'Sent a message';
  let badgeIcon = '💬';

  if (type === 'audio') {
    bodyText = '🎙️ Voice note';
    badgeIcon = '🎙️';
  } else if (type === 'image') {
    bodyText = '📷 Photo';
    badgeIcon = '📷';
  } else if (type === 'file' || type === 'pdf') {
    bodyText = '📄 Document';
    badgeIcon = '📄';
  }

  return (
    <div className="chat-toast-card" onClick={onClick}>
      <div className="chat-toast-avatar">
        <span>{initial}</span>
        <div className="chat-toast-indicator" />
      </div>
      <div className="chat-toast-details">
        <div className="chat-toast-header">
          <span className="chat-toast-title" title={title || senderName}>
            {title || senderName}
          </span>
          <span className="chat-toast-time">Just now</span>
        </div>
        <div className="chat-toast-snippet">
          <span className="chat-toast-badge-icon">{badgeIcon}</span>
          <span className="chat-toast-text">{bodyText}</span>
        </div>
        <div className="chat-toast-cta">Click to open conversation →</div>
      </div>
    </div>
  );
}

export default function ChatNotificationToaster() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth?.isAuthenticated);
  const currentView = useSelector((state) => state.routing?.view);
  const authUser = useSelector((state) => state.auth?.user);
  const currentUserId = String(authUser?._id || authUser?.id || authUser?.sub || '');

  const viewRef = useRef(currentView);
  viewRef.current = currentView;

  const userRef = useRef(currentUserId);
  userRef.current = currentUserId;

  // Initialize socket connection whenever user is authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    initChatSocket();
  }, [isAuthenticated]);

  // Listen to new_chat_message_notification event
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = onChatEvent('new_chat_message_notification', (data) => {
      if (!data) return;

      const { conversationId, conversationTitle, senderName, senderId, message } = data;

      // Ignore if user is the sender
      if (String(senderId) === String(userRef.current)) {
        return;
      }

      // Check if user is currently looking directly at this conversation inside ChatPage
      const activeConvId = window.__activeChatConversationId;
      if (viewRef.current === 'chat' && String(activeConvId) === String(conversationId)) {
        // Conversation is actively in foreground on screen, skip toast
        return;
      }

      // Play soft chime
      playChime();

      // Dispatch toast
      const toastId = `chat-msg-${conversationId}-${message?._id || message?.id || Date.now()}`;

      toast(
        <MessageToastCard
          title={conversationTitle || senderName}
          senderName={senderName}
          content={message?.content}
          type={message?.type}
          onClick={() => {
            toast.dismiss(toastId);
            // Navigate directly to conversation
            sessionStorage.setItem('active_chat_conv_id', String(conversationId));
            const newUrl = new URL(window.location.href);
            newUrl.pathname = '/chat';
            newUrl.searchParams.set('conv', String(conversationId));
            window.history.pushState({ view: 'chat' }, '', newUrl.toString());

            dispatch(setView('chat'));

            // Notify ChatPage to focus this conversation immediately
            window.dispatchEvent(
              new CustomEvent('open_chat_conversation', {
                detail: { conversationId: String(conversationId) },
              })
            );
          }}
        />,
        {
          toastId,
          position: 'top-right',
          autoClose: 5500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: 'dark',
          className: 'chat-toast-wrapper',
        }
      );
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isAuthenticated, dispatch]);

  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="dark"
      toastClassName="rebar-toast-container"
    />
  );
}
