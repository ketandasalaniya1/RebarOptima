import React from 'react';
import {
  Eye, Clock, Box, Cpu, Layers, FileSpreadsheet, FileText,
  UserCheck, Shield, Settings, AlertCircle
} from 'lucide-react';
import './LogRow.css';

export function getModuleBadge(module) {
  switch (module?.toLowerCase()) {
    case 'inventory':
      return { label: 'Inventory', icon: <Box size={12} />, className: 'mod-inventory' };
    case 'optimizer':
      return { label: 'Optimizer', icon: <Cpu size={12} />, className: 'mod-optimizer' };
    case 'history':
      return { label: 'Batches', icon: <Layers size={12} />, className: 'mod-history' };
    case 'scrapsales':
      return { label: 'Scrap Sales', icon: <FileSpreadsheet size={12} />, className: 'mod-scrap' };
    case 'ledger':
      return { label: 'Ledger', icon: <FileText size={12} />, className: 'mod-ledger' };
    case 'users':
      return { label: 'Users', icon: <UserCheck size={12} />, className: 'mod-users' };
    case 'roles':
      return { label: 'Roles', icon: <Shield size={12} />, className: 'mod-roles' };
    case 'crm':
      return { label: 'CRM', icon: <FileText size={12} />, className: 'mod-crm' };
    case 'drawings':
      return { label: 'Drawings', icon: <FileText size={12} />, className: 'mod-drawings' };
    case 'settings':
      return { label: 'Settings', icon: <Settings size={12} />, className: 'mod-settings' };
    case 'auth':
      return { label: 'Auth / Session', icon: <Clock size={12} />, className: 'mod-auth' };
    default:
      return { label: module || 'General', icon: <Shield size={12} />, className: 'mod-default' };
  }
}

export function getActionBadge(action = '') {
  const act = action.toUpperCase();
  if (act.includes('DELETE') || act.includes('DEACTIVATE') || act.includes('REVERSE')) {
    return { label: action.replace(/_/g, ' '), className: 'act-critical', isCritical: true };
  }
  if (act.includes('CREATE') || act.includes('INWARD') || act.includes('SIGNUP') || act.includes('ACTIVATE')) {
    return { label: action.replace(/_/g, ' '), className: 'act-create', isCritical: false };
  }
  if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('CHANGE')) {
    return { label: action.replace(/_/g, ' '), className: 'act-update', isCritical: false };
  }
  if (act.includes('SIGNIN') || act.includes('LOGIN')) {
    return { label: action.replace(/_/g, ' '), className: 'act-auth', isCritical: false };
  }
  return { label: action.replace(/_/g, ' '), className: 'act-neutral', isCritical: false };
}

export function formatLogTime(dateStr) {
  if (!dateStr) return { formatted: '—', relative: '—' };
  const date = new Date(dateStr);
  const formatted = date.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative = '';
  if (diffMins < 1) relative = 'Just now';
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours < 24) relative = `${diffHours}h ago`;
  else if (diffDays === 1) relative = 'Yesterday';
  else relative = `${diffDays}d ago`;

  return { formatted, relative };
}

/**
 * Log Row Component (Desktop Row & Mobile Card)
 */
export default function LogRow({
  log,
  onInspect,
  mode = 'table-row',
}) {
  const actorName = log.actor?.name || log.actorName || 'User';
  const actorRole = log.actor?.role || log.actorRole || 'Staff';
  const initials = actorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  const modBadge = getModuleBadge(log.module);
  const actBadge = getActionBadge(log.action);
  const timeInfo = formatLogTime(log.timestamp);
  const hasDiff = Boolean(log.previousValue || log.newValue);

  if (mode === 'mobile-card') {
    return (
      <div className={`log-mobile-card ${actBadge.isCritical ? 'is-critical-event' : ''}`}>
        <div className="lmc-header">
          <div className="lmc-actor-wrap">
            <div className="lmc-avatar">{initials}</div>
            <div className="lmc-actor-text">
              <span className="lmc-name">{actorName}</span>
              <span className="lmc-role">{actorRole}</span>
            </div>
          </div>
          <span className="lmc-time" title={timeInfo.formatted}>
            <Clock size={11} /> {timeInfo.relative}
          </span>
        </div>

        <p className="lmc-desc">{log.formattedDesc || log.description}</p>

        <div className="lmc-badges-row">
          <span className={`lmc-badge ${modBadge.className}`}>
            {modBadge.icon} {modBadge.label}
          </span>
          <span className={`lmc-badge ${actBadge.className}`}>
            {actBadge.label}
          </span>
        </div>

        {hasDiff && (
          <button
            type="button"
            className="lmc-inspect-btn"
            onClick={() => onInspect(log)}
          >
            <Eye size={15} /> Inspect Field Changes
          </button>
        )}
      </div>
    );
  }

  // Desktop Table Row
  return (
    <tr className={`log-table-row ${actBadge.isCritical ? 'is-critical-row' : ''}`}>
      {/* 1. Actor */}
      <td className="ltr-actor-cell">
        <div className="ltr-actor-box">
          <div className="ltr-avatar">{initials}</div>
          <div className="ltr-actor-info">
            <span className="ltr-name">{actorName}</span>
            <span className="ltr-role">{actorRole}</span>
          </div>
        </div>
      </td>

      {/* 2. Description */}
      <td className="ltr-desc-cell">
        <span className="ltr-desc-text">
          {log.formattedDesc || log.description}
        </span>
      </td>

      {/* 3. Module */}
      <td className="ltr-module-cell">
        <span className={`ltr-mod-pill ${modBadge.className}`}>
          {modBadge.icon}
          <span>{modBadge.label}</span>
        </span>
      </td>

      {/* 4. Action */}
      <td className="ltr-action-cell">
        <span className={`ltr-act-pill ${actBadge.className}`}>
          {actBadge.isCritical && <AlertCircle size={11} />}
          <span>{actBadge.label}</span>
        </span>
      </td>

      {/* 5. Time */}
      <td className="ltr-time-cell">
        <div className="ltr-time-box" title={timeInfo.formatted}>
          <span className="ltr-time-rel">{timeInfo.relative}</span>
          <span className="ltr-time-abs">{timeInfo.formatted}</span>
        </div>
      </td>

      {/* 6. Inspect Action */}
      <td className="ltr-inspect-cell">
        {hasDiff ? (
          <button
            type="button"
            className="ltr-inspect-btn"
            onClick={() => onInspect(log)}
            title="Inspect Field Diff"
            aria-label="Inspect change snapshot"
          >
            <Eye size={16} />
          </button>
        ) : (
          <span className="ltr-no-diff">—</span>
        )}
      </td>
    </tr>
  );
}

