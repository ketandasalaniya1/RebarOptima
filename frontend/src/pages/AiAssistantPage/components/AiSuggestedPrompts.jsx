import React from 'react';
import {
  Sparkles,
  LayoutDashboard,
  Layers,
  Shield,
  Wallet,
  Building2,
  Package,
  Home,
  CalendarRange,
  UsersRound,
  FileStack,
  Boxes,
  Ruler,
  CheckSquare,
  Warehouse,
  HardHat,
  PackagePlus,
  Scale,
  CalendarCheck2,
  Users,
  Clock,
  TrendingDown,
  DollarSign,
  FileText,
  Calendar,
  Building,
  Kanban,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

const ICON_MAP = {
  LayoutDashboard,
  Layers,
  Shield,
  Wallet,
  Building2,
  Package,
  Home,
  CalendarRange,
  UsersRound,
  FileStack,
  Boxes,
  Ruler,
  CheckSquare,
  Warehouse,
  HardHat,
  PackagePlus,
  Scale,
  CalendarCheck2,
  Users,
  Clock,
  TrendingDown,
  DollarSign,
  FileText,
  Calendar,
  Building,
  Kanban,
  Sparkles,
};

export default function AiSuggestedPrompts({ prompts = [], userRole, projectName, onSelectPrompt }) {
  const getIcon = (iconName) => {
    const IconComponent = ICON_MAP[iconName] || Sparkles;
    return <IconComponent size={20} />;
  };

  const roleDisplay = userRole
    ? userRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Team Member';

  return (
    <div className="ai-empty-welcome">
      <div className="ai-welcome-header">
        <div className="ai-welcome-badge">
          <Sparkles size={16} />
          <span>Construction Intelligence Engine</span>
        </div>
        <h2 className="ai-welcome-title">How can CraveToBuild assist you today?</h2>
        <p className="ai-welcome-subtitle">
          Ask questions about material inventory, BBS cutting schedules, concrete pours, site drawings, or labour muster rolls for <strong>{projectName || 'your site'}</strong>.
        </p>

        <div className="ai-role-context-chip">
          <ShieldCheck size={15} className="ai-shield-icon" />
          <span>Logged in as: <strong>{roleDisplay}</strong></span>
          <span className="ai-divider">•</span>
          <span>Role-Isolated & Project-Scoped</span>
        </div>
      </div>

      <div className="ai-prompts-grid">
        {prompts.map((p) => (
          <button
            key={p.id}
            type="button"
            className="ai-prompt-card"
            onClick={() => onSelectPrompt(p.prompt)}
          >
            <div className="ai-prompt-card-top">
              <div className="ai-prompt-icon-box">{getIcon(p.icon)}</div>
              <span className="ai-prompt-category">{p.category}</span>
            </div>
            <h3 className="ai-prompt-title">{p.title}</h3>
            <p className="ai-prompt-preview">{p.prompt}</p>
            <div className="ai-prompt-action">
              <span>Ask assistant</span>
              <ArrowRight size={14} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

