import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AiTypingIndicator({ projectName }) {
  return (
    <div className="ai-message-row assistant-row typing-row">
      <div className="ai-avatar avatar-assistant">
        <Sparkles size={16} />
      </div>
      <div className="ai-bubble-container">
        <div className="ai-bubble-meta">
          <span className="ai-bubble-author">CraveToBuild AI</span>
          <span className="ai-bubble-time">Analyzing...</span>
        </div>
        <div className="ai-bubble ai-bubble-assistant ai-typing-bubble">
          <div className="ai-typing-dots">
            <span className="dot dot-1"></span>
            <span className="dot dot-2"></span>
            <span className="dot dot-3"></span>
          </div>
          <span className="ai-typing-label">
            Analyzing {projectName || 'site'} data & permissions…
          </span>
        </div>
      </div>
    </div>
  );
}

