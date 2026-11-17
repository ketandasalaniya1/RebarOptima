import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Sparkles,
  X,
  Maximize2,
  Send,
  Building2,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { setView } from '../../store/slices/routingSlice';
import { aiAssistantApi } from '../../utils/aiAssistantApi';
import AiMessageItem from '../../pages/AiAssistantPage/components/AiMessageItem';
import AiTypingIndicator from '../../pages/AiAssistantPage/components/AiTypingIndicator';
import './AiAssistantWidget.css';

export default function AiAssistantWidget() {
  const dispatch = useDispatch();
  const currentView = useSelector((state) => state.routing.view);
  const user = useSelector((state) => state.auth.user);
  const selectedProject = useSelector((state) => state.project.selectedProject);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeConvId, setActiveConvId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentProjectId = selectedProject?.id || selectedProject?._id || 'default';
  const currentProjectName = selectedProject?.name || selectedProject?.projectName || 'Active Project';
  const userRole = user?.role || 'Team Member';

  // Do not show widget if user is on the dedicated full ai-assistant page
  const isAiPage = currentView === 'ai-assistant';

  // Fetch suggested prompts on mount / project change
  useEffect(() => {
    let isMounted = true;
    const fetchPrompts = async () => {
      try {
        const res = await aiAssistantApi.getSuggestedPrompts();
        if (isMounted && res?.data) {
          setSuggestedPrompts(res.data.slice(0, 3));
        }
      } catch (e) {
        // Fallback
      }
    };
    fetchPrompts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-scroll on new messages in quick widget
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleOpenFullPage = () => {
    setIsOpen(false);
    dispatch(setView('ai-assistant'));
  };

  const handleSendMessage = async (promptToSend) => {
    const text = (promptToSend || inputValue).trim();
    if (!text || isLoading) return;

    setInputValue('');
    setIsLoading(true);

    let convId = activeConvId;

    try {
      if (!convId) {
        const newConv = await aiAssistantApi.createConversation(
          currentProjectId,
          text.slice(0, 35) + '…'
        );
        if (newConv?.data?._id) {
          convId = newConv.data._id;
          setActiveConvId(convId);
        }
      }

      const tempUserMsg = {
        _id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      const res = await aiAssistantApi.sendMessage(convId, text, currentProjectId);
      if (res?.data) {
        setMessages((prev) => [
          ...prev.filter((m) => m._id !== tempUserMsg._id),
          res.data.userMessage,
          res.data.assistantMessage,
        ]);
      }
    } catch (err) {
      console.warn('Quick chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isAiPage) return null;

  return (
    <div className="ai-widget-wrapper">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          className="ai-widget-trigger"
          onClick={() => setIsOpen(true)}
          title="Ask CraveToBuild AI"
          aria-label="Open AI Assistant"
        >
          <div className="ai-trigger-icon-pulse">
            <Sparkles size={20} />
          </div>
          <span className="ai-trigger-label">AI Assistant</span>
        </button>
      )}

      {/* Flyout Quick-Chat Drawer */}
      {isOpen && (
        <div className="ai-widget-drawer">
          {/* Drawer Header */}
          <div className="ai-drawer-header">
            <div className="ai-drawer-title-group">
              <div className="ai-drawer-icon-box">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="ai-drawer-brand">CraveToBuild AI</div>
                <div className="ai-drawer-sub">
                  <Building2 size={11} />
                  <span>{currentProjectName}</span>
                </div>
              </div>
            </div>

            <div className="ai-drawer-actions">
              <button
                type="button"
                className="ai-drawer-btn"
                onClick={handleOpenFullPage}
                title="Expand to Full Page"
                aria-label="Expand to full screen"
              >
                <Maximize2 size={15} />
              </button>
              <button
                type="button"
                className="ai-drawer-btn"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                aria-label="Close assistant"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="ai-drawer-body">
            {messages.length === 0 ? (
              <div className="ai-drawer-empty">
                <div className="ai-drawer-welcome-icon">
                  <Sparkles size={24} />
                </div>
                <h4 className="ai-drawer-welcome-title">Quick AI Assistant</h4>
                <p className="ai-drawer-welcome-desc">
                  Ask questions about materials, casting logs, or labour for <strong>{currentProjectName}</strong>.
                </p>

                <div className="ai-drawer-role-pill">
                  <ShieldCheck size={13} />
                  <span>Role: <strong>{userRole}</strong></span>
                </div>

                {suggestedPrompts.length > 0 && (
                  <div className="ai-drawer-chips-list">
                    <span className="ai-chips-heading">Suggested for you:</span>
                    {suggestedPrompts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="ai-drawer-chip"
                        onClick={() => handleSendMessage(p.prompt)}
                      >
                        <span>{p.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="ai-drawer-messages">
                {messages.map((m, idx) => (
                  <AiMessageItem
                    key={m._id || idx}
                    message={m}
                    user={user}
                    onRetry={() => handleSendMessage(m.content)}
                    isLast={idx === messages.length - 1}
                  />
                ))}
                {isLoading && <AiTypingIndicator projectName={currentProjectName} />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Drawer Composer */}
          <div className="ai-drawer-footer">
            <div className="ai-drawer-input-row">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about this site…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="ai-drawer-input"
                disabled={isLoading}
              />
              <button
                type="button"
                className="ai-drawer-send-btn"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            </div>
            <div className="ai-drawer-footer-actions">
              <span className="ai-drawer-isolated-tag">
                <ShieldCheck size={11} />
                <span>Isolated to {currentProjectName}</span>
              </span>
              <button
                type="button"
                className="ai-drawer-expand-link"
                onClick={handleOpenFullPage}
              >
                Full screen ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

