import React from 'react';
import './ui.css';

const TONE_MAP = {
  active: 'success',
  approved: 'success',
  completed: 'success',
  success: 'success',
  pending: 'warning',
  held: 'warning',
  warning: 'warning',
  overdue: 'danger',
  rejected: 'danger',
  inactive: 'danger',
  danger: 'danger',
  planned: 'info',
  draft: 'neutral',
  info: 'info',
  neutral: 'neutral',
};

export default function StatusBadge({ status, tone, children, className = '' }) {
  const key = String(tone || status || 'neutral').toLowerCase().replace(/\s+/g, '');
  const mapped = TONE_MAP[key] || 'neutral';
  const label = children || status || '—';

  return (
    <span className={`ro-badge ro-badge--${mapped}${className ? ` ${className}` : ''}`}>
      {label}
    </span>
  );
}
