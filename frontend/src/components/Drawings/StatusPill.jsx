import React from 'react';
import './StatusPill.css';

/**
 * Reusable StatusPill component matching RebarOptima design spec.
 * Normalizes input status to: CURRENT | IN_REVIEW | REJECTED | DRAFT | SUPERSEDED | VOID
 */
export default function StatusPill({ status, className = '' }) {
  const normalizeStatus = (raw) => {
    if (!raw) return 'DRAFT';
    const s = String(raw).toUpperCase().trim().replace(/[\s-]+/g, '_');
    if (s === 'APPROVED' || s === 'CURRENT' || s === 'PUBLISHED') return 'CURRENT';
    if (s === 'IN_REVIEW' || s === 'UNDER_REVIEW' || s === 'PENDING_APPROVAL' || s === 'REVIEW') return 'IN_REVIEW';
    if (s === 'REJECTED' || s === 'DECLINED') return 'REJECTED';
    if (s === 'SUPERSEDED' || s === 'ARCHIVED') return 'SUPERSEDED';
    if (s === 'VOID' || s === 'CANCELLED') return 'VOID';
    return 'DRAFT';
  };

  const key = normalizeStatus(status);
  const label = key.replace('_', ' ');

  return (
    <span className={`ro-status-pill status-${key.toLowerCase()} ${className}`}>
      {label}
    </span>
  );
}

