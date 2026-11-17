import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Search,
  MessageSquare,
  Building2,
  AlertCircle,
  Menu,
  X,
  ChevronDown,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { aiAssistantApi } from '../../utils/aiAssistantApi';
import { setSelectedProject } from '../../store/slices/projectSlice';
import AiMessageItem from './components/AiMessageItem';
import AiSuggestedPrompts from './components/AiSuggestedPrompts';
import AiTypingIndicator from './components/AiTypingIndicator';
import './AiAssistantPage.css';

export default function AiAssistantPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const selectedProject = useSelector((state) => state.project.selectedProject);
  const projects = useSelector((state) => state.project.projects || []);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const currentProjectId = selectedProject?.id || selectedProject?._id || 'default';
  const currentProjectName = selectedProject?.name || selectedProject?.projectName || 'Active Project';
  const userRole = user?.role || 'Team Member';

  // 1. Initial Load: Fetch conversations and suggested prompts
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        setIsInitializing(true);
        setError('');

        const [promptsRes, convsRes] = await Promise.allSettled([
          aiAssistantApi.getSuggestedPrompts(),
          aiAssistantApi.getConversations(currentProjectId),
        ]);

        if (isMounted) {
          if (promptsRes.status === 'fulfilled' && promptsRes.value?.data) {
            setSuggestedPrompts(promptsRes.value.data);
          }
          if (convsRes.status === 'fulfilled' && convsRes.value?.data) {
            const convList = convsRes.value.data;
            setConversations(convList);
            if (convList.length > 0) {
              setActiveConversationId(convList[0]._id);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Initialization error:', err);
          setError('Failed to load conversations. Please retry.');
        }
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [currentProjectId]);

  // 2. Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const fetchMsgs = async () => {
      try {
        const res = await aiAssistantApi.getMessages(activeConversationId);
        if (isMounted && res?.data) {
          setMessages(res.data);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to load messages:', err);
        }
      }
    };

    fetchMsgs();
    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  // 3. Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // 4. Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputValue]);

  // Handle New Conversation
  const handleNewConversation = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await aiAssistantApi.createConversation(currentProjectId, 'New Conversation');
      if (res?.data) {
        setConversations((prev) => [res.data, ...prev]);
        setActiveConversationId(res.data._id);
        setMessages([]);
        setIsSidebarOpenMobile(false);
      }
    } catch (err) {
      setError('Could not start a new conversation.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (promptToSend) => {
    const text = (promptToSend || inputValue).trim();
    if (!text || isLoading) return;

    setError('');
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let targetConvId = activeConversationId;

    try {
      setIsLoading(true);

      // If no active conversation exists, create one first
      if (!targetConvId) {
        const createRes = await aiAssistantApi.createConversation(
          currentProjectId,
          text.slice(0, 45) + (text.length > 45 ? '…' : '')
        );
        if (createRes?.data) {
          targetConvId = createRes.data._id;
          setActiveConversationId(targetConvId);
          setConversations((prev) => [createRes.data, ...prev]);
        } else {
          throw new Error('Failed to create session');
        }
      }

      // Optimistic user message preview
      const tempUserMsg = {
        _id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      // Call API
      const res = await aiAssistantApi.sendMessage(targetConvId, text, currentProjectId);

      if (res?.data) {
        const { userMessage, assistantMessage, conversationTitle } = res.data;

        // Replace temp message with server confirmed messages
        setMessages((prev) => [
          ...prev.filter((m) => m._id !== tempUserMsg._id),
          userMessage,
          assistantMessage,
        ]);

        // Update title in conversation list if renamed
        if (conversationTitle) {
          setConversations((prev) =>
            prev.map((c) =>
              c._id === targetConvId
                ? { ...c, title: conversationTitle, lastMessageAt: new Date().toISOString() }
                : c
            )
          );
        }
      }
    } catch (err) {
      console.error('Send message error:', err);
      setError(err?.message || 'Failed to generate AI response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Key Down (Enter vs Shift+Enter)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle Delete Conversation
  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      setIsDeletingId(convId);
      await aiAssistantApi.deleteConversation(convId);
      const remaining = conversations.filter((c) => c._id !== convId);
      setConversations(remaining);
      if (activeConversationId === convId) {
        setActiveConversationId(remaining.length > 0 ? remaining[0]._id : null);
        setMessages([]);
      }
    } catch (err) {
      setError('Failed to delete conversation.');
    } finally {
      setIsDeletingId(null);
    }
  };

  // Handle Project Change
  const handleProjectSelect = (e) => {
    const pId = e.target.value;
    const found = projects.find((p) => String(p.id || p._id) === String(pId));
    if (found) {
      dispatch(setSelectedProject(found));
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeConversation = conversations.find((c) => c._id === activeConversationId);

  return (
    <div className="ai-assistant-page">
      {/* 1. Left Sidebar: Conversation History */}
      <aside className={`ai-sidebar ${isSidebarOpenMobile ? 'mobile-open' : ''}`}>
        <div className="ai-sidebar-top">
          <div className="ai-sidebar-brand">
            <div className="ai-sidebar-icon-box">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="ai-brand-title">CraveToBuild AI</span>
              <span className="ai-brand-sub">Construction Assistant</span>
            </div>
          </div>
          <button
            type="button"
            className="ai-sidebar-close-mobile"
            onClick={() => setIsSidebarOpenMobile(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="ai-sidebar-action">
          <button
            type="button"
            className="ai-btn-new-chat"
            onClick={handleNewConversation}
            disabled={isLoading}
          >
            <Plus size={16} />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Search */}
        <div className="ai-sidebar-search">
          <Search size={14} className="ai-search-icon" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ai-search-input"
          />
        </div>

        {/* Conversation List */}
        <div className="ai-conversation-list">
          {isInitializing ? (
            <div className="ai-sidebar-loading">
              <RefreshCw size={16} className="spin-icon" />
              <span>Loading sessions…</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="ai-sidebar-empty">
              <MessageSquare size={24} className="ai-muted-icon" />
              <p>No conversations yet</p>
              <button
                type="button"
                className="ai-link-btn"
                onClick={handleNewConversation}
              >
                Start a session
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv._id === activeConversationId;
              return (
                <div
                  key={conv._id}
                  className={`ai-conversation-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveConversationId(conv._id);
                    setIsSidebarOpenMobile(false);
                  }}
                >
                  <MessageSquare size={16} className="ai-conv-icon" />
                  <span className="ai-conv-title" title={conv.title}>
                    {conv.title || 'Untitled Session'}
                  </span>
                  <button
                    type="button"
                    className="ai-btn-delete-conv"
                    onClick={(e) => handleDeleteConversation(e, conv._id)}
                    title="Delete conversation"
                    disabled={isDeletingId === conv._id}
                    aria-label="Delete session"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Security Scope */}
        <div className="ai-sidebar-footer">
          <div className="ai-security-pill">
            <ShieldCheck size={14} />
            <span>Role: <strong>{userRole}</strong></span>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {isSidebarOpenMobile && (
        <div
          className="ai-sidebar-backdrop"
          onClick={() => setIsSidebarOpenMobile(false)}
        />
      )}

      {/* 2. Main Chat Area */}
      <main className="ai-chat-viewport">
        {/* Top Header */}
        <header className="ai-chat-header">
          <div className="ai-header-left">
            <button
              type="button"
              className="ai-btn-menu-mobile"
              onClick={() => setIsSidebarOpenMobile(true)}
              aria-label="Toggle history menu"
            >
              <Menu size={20} />
            </button>
            <div className="ai-header-meta">
              <h1 className="ai-header-title">
                {activeConversation?.title || 'AI Construction Assistant'}
              </h1>
              <div className="ai-header-project-badge">
                <Building2 size={13} />
                <span>{currentProjectName}</span>
              </div>
            </div>
          </div>

          <div className="ai-header-right">
            {/* Project Switcher */}
            {projects.length > 1 && (
              <div className="ai-project-select-wrapper">
                <select
                  value={currentProjectId}
                  onChange={handleProjectSelect}
                  className="ai-project-select"
                  aria-label="Select active project"
                >
                  {projects.map((p) => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.name || p.projectName}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="ai-select-arrow" />
              </div>
            )}

            <button
              type="button"
              className="ai-btn-header-new"
              onClick={handleNewConversation}
              title="New Conversation"
              aria-label="Start new conversation"
            >
              <Plus size={16} />
              <span className="hide-mobile">New Chat</span>
            </button>
          </div>
        </header>

        {/* Error Notice */}
        {error && (
          <div className="ai-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button
              type="button"
              className="ai-error-dismiss"
              onClick={() => setError('')}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Message Viewport */}
        <div className="ai-messages-container">
          {messages.length === 0 && !isLoading ? (
            <AiSuggestedPrompts
              prompts={suggestedPrompts}
              userRole={userRole}
              projectName={currentProjectName}
              onSelectPrompt={handleSendMessage}
            />
          ) : (
            <div className="ai-message-list">
              {messages.map((msg, index) => (
                <AiMessageItem
                  key={msg._id || index}
                  message={msg}
                  user={user}
                  onRetry={() => handleSendMessage(msg.content)}
                  isLast={index === messages.length - 1}
                />
              ))}

              {isLoading && (
                <AiTypingIndicator projectName={currentProjectName} />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input Composer */}
        <footer className="ai-composer-wrapper">
          <div className="ai-composer-box">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask CraveToBuild AI about ${currentProjectName}…`}
              className="ai-composer-input"
              disabled={isLoading}
              aria-label="Message input"
            />
            <button
              type="button"
              className="ai-btn-send"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="ai-composer-footer-hints">
            <span>
              <strong>Enter</strong> to send • <strong>Shift + Enter</strong> for newline
            </span>
            <span className="ai-dot-sep">•</span>
            <span>Scoped to <strong>{currentProjectName}</strong> under <strong>{userRole}</strong> permissions</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

