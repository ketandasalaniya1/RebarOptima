import React, { useState } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  User,
  ShieldAlert,
  Database,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Building2,
  Clock,
} from 'lucide-react';
import AiMessageFormatter from './AiMessageFormatter';

export default function AiMessageItem({ message, user, onRetry, isLast }) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const isAssistant = message.role === 'assistant';
  const isAccessDenied =
    message.category === 'Access Denied' ||
    (message.content && message.content.includes('Access Denied'));

  const meta = message.metadata || {};
  const hasGroundedData = Boolean(
    meta.groundingStatus === 'verified_database' ||
    meta.projectName ||
    (meta.sources && meta.sources.length > 0)
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const userInitials = user
    ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'U'
    : 'U';

  return (
    <div className={`ai-message-row ${isAssistant ? 'assistant-row' : 'user-row'}`}>
      {/* Avatar */}
      <div
        className={`ai-avatar ${
          isAssistant
            ? isAccessDenied
              ? 'avatar-alert'
              : 'avatar-assistant'
            : 'avatar-user'
        }`}
      >
        {isAssistant ? (
          isAccessDenied ? <ShieldAlert size={16} /> : <Sparkles size={16} />
        ) : (
          <span className="avatar-initials">{userInitials}</span>
        )}
      </div>

      {/* Message Bubble Container */}
      <div className="ai-bubble-container">
        {/* Meta Bar */}
        <div className="ai-bubble-meta">
          <span className="ai-bubble-author">
            {isAssistant
              ? 'CraveToBuild AI'
              : user?.firstName
              ? `${user.firstName} ${user.lastName || ''}`.trim()
              : 'You'}
          </span>
          {isAssistant && message.category && (
            <span className={`ai-category-badge ${isAccessDenied ? 'badge-denied' : ''}`}>
              {message.category}
            </span>
          )}
          <span className="ai-bubble-time">{formatTime(message.createdAt)}</span>
        </div>

        {/* Verified Database Grounding Bar (for Assistant messages) */}
        {isAssistant && hasGroundedData && !isAccessDenied && (
          <div className="ai-grounding-banner">
            <div className="ai-grounding-header">
              <span className="ai-grounding-chip">
                <Database size={11} className="ai-grounding-icon" />
                <span>Verified Database Grounding</span>
              </span>
              {meta.projectName && (
                <span className="ai-project-chip" title="Resolved Project Context">
                  <Building2 size={11} />
                  <span>{meta.projectName}</span>
                </span>
              )}
              {meta.asOf && (
                <span className="ai-timestamp-chip" title="Data Snapshot Timestamp">
                  <Clock size={11} />
                  <span>{formatTime(meta.asOf)}</span>
                </span>
              )}
            </div>

            {/* Missing Data Warnings */}
            {meta.warnings && meta.warnings.length > 0 && (
              <div className="ai-grounding-warnings">
                {meta.warnings.map((w, idx) => (
                  <div key={idx} className="ai-warning-item">
                    <AlertTriangle size={12} className="ai-warning-icon" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Sources Toggle */}
            {meta.sources && meta.sources.length > 0 && (
              <div className="ai-sources-section">
                <button
                  type="button"
                  className="ai-sources-btn"
                  onClick={() => setShowSources((prev) => !prev)}
                  aria-expanded={showSources}
                >
                  <span>
                    {meta.sources.filter((s) => s.status === 'grounded').length} of{' '}
                    {meta.sources.length} DB collections connected
                  </span>
                  {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showSources && (
                  <div className="ai-sources-grid">
                    {meta.sources.map((s, idx) => (
                      <div
                        key={idx}
                        className={`ai-source-item source-${s.status || 'grounded'}`}
                        title={s.summary || s.collection}
                      >
                        <span className="ai-source-name">{s.module}</span>
                        <span className="ai-source-badge">
                          {s.status === 'grounded'
                            ? `${s.recordCount} docs`
                            : s.status === 'unauthorized'
                            ? 'Restricted'
                            : '0 docs'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bubble Content */}
        <div
          className={`ai-bubble ${
            isAssistant
              ? isAccessDenied
                ? 'ai-bubble-denied'
                : 'ai-bubble-assistant'
              : 'ai-bubble-user'
          }`}
        >
          {isAssistant ? (
            <AiMessageFormatter content={message.content} />
          ) : (
            <div className="ai-user-text">{message.content}</div>
          )}
        </div>

        {/* Assistant Actions Bar */}
        {isAssistant && (
          <div className="ai-actions-bar">
            <button
              type="button"
              className="ai-action-btn"
              onClick={handleCopy}
              title="Copy to clipboard"
              aria-label="Copy response"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {onRetry && isLast && (
              <button
                type="button"
                className="ai-action-btn"
                onClick={() => onRetry(message)}
                title="Regenerate response"
                aria-label="Retry response"
              >
                <RotateCcw size={14} />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

