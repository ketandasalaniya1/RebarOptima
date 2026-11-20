import React, { useMemo } from 'react';
import {
  Shield, Clock, User, ArrowRight, CheckCircle2, AlertTriangle, FileText, X
} from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import './DiffDrawer.css';

function formatVal(val) {
  if (val === null || val === undefined) return <span className="diff-val-empty">None</span>;
  if (typeof val === 'boolean') return val ? 'True' : 'False';
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="diff-val-empty">Empty list</span>;
    return val.map((item, idx) => (
      <span key={idx} className="diff-array-item">
        {typeof item === 'object' ? JSON.stringify(item) : String(item)}
      </span>
    ));
  }
  if (typeof val === 'object') {
    return (
      <div className="diff-nested-obj">
        {Object.entries(val).map(([k, v]) => (
          <div key={k} className="diff-obj-entry">
            <strong>{k}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </div>
        ))}
      </div>
    );
  }
  return String(val);
}

/**
 * Slide-Over Drawer with Field-by-Field Visual Diff
 * - Replaces raw JSON with clear Old Value (red strikethrough) vs New Value (green)
 */
export default function DiffDrawer({
  isOpen,
  onClose,
  log,
}) {
  const actorName = log?.actor?.name || log?.actorName || 'User';
  const actorEmail = log?.actor?.email || log?.actorEmail || '';
  const actorRole = log?.actor?.role || log?.actorRole || 'Staff';

  const formattedDate = log?.timestamp
    ? new Date(log.timestamp).toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '—';

  // Compute field-by-field diffs
  const fieldDiffs = useMemo(() => {
    if (!log) return [];
    const prev = log.previousValue && typeof log.previousValue === 'object' ? log.previousValue : null;
    const next = log.newValue && typeof log.newValue === 'object' ? log.newValue : null;

    if (!prev && !next) return [];

    // Filter out internal metadata fields like _id, passwordHash, __v
    const IGNORE_FIELDS = new Set(['_id', 'passwordHash', '__v', 'companyId']);

    if (prev && next) {
      const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]))
        .filter((k) => !IGNORE_FIELDS.has(k));

      return allKeys
        .filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]))
        .map((k) => ({
          field: k,
          type: 'changed',
          oldVal: prev[k],
          newVal: next[k],
        }));
    }

    if (next && !prev) {
      return Object.keys(next)
        .filter((k) => !IGNORE_FIELDS.has(k))
        .map((k) => ({
          field: k,
          type: 'added',
          oldVal: null,
          newVal: next[k],
        }));
    }

    if (prev && !next) {
      return Object.keys(prev)
        .filter((k) => !IGNORE_FIELDS.has(k))
        .map((k) => ({
          field: k,
          type: 'removed',
          oldVal: prev[k],
          newVal: null,
        }));
    }

    return [];
  }, [log]);

  if (!log) return null;

  const footer = (
    <div className="dd-footer">
      <button type="button" className="ro-btn ro-btn--secondary" onClick={onClose}>
        Close
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Event Snapshot"
      subtitle={`Detailed field comparison for ${log.action?.replace(/_/g, ' ') || 'event'}`}
      icon={<Shield size={18} />}
      width="560px"
      footer={footer}
    >
      <div className="dd-content">
        {/* Event Actor & Timestamp Metadata */}
        <div className="dd-meta-grid">
          <div className="dd-meta-card">
            <span className="dd-meta-label">Responsible User</span>
            <span className="dd-meta-val primary">{actorName}</span>
            {actorEmail && <span className="dd-meta-sub">{actorEmail}</span>}
          </div>

          <div className="dd-meta-card">
            <span className="dd-meta-label">Role</span>
            <span className="dd-meta-val role-pill">{actorRole}</span>
          </div>

          <div className="dd-meta-card">
            <span className="dd-meta-label">Timestamp</span>
            <span className="dd-meta-val date-val"><Clock size={12} /> {formattedDate}</span>
          </div>

          <div className="dd-meta-card">
            <span className="dd-meta-label">Action & Module</span>
            <span className="dd-meta-val action-pill">
              {log.action?.replace(/_/g, ' ')} ({log.module || 'General'})
            </span>
          </div>
        </div>

        {/* Plain English Summary */}
        <div className="dd-summary-box">
          <div className="dd-summary-header">
            <FileText size={15} />
            <span>Summary Description</span>
          </div>
          <p className="dd-summary-text">{log.formattedDesc || log.description}</p>
        </div>

        {/* Field-by-Field Diff Table */}
        <div className="dd-diff-section">
          <div className="dd-diff-header">
            <span className="dd-diff-title">Field-by-Field Changes</span>
            <span className="dd-diff-count">({fieldDiffs.length} fields modified)</span>
          </div>

          {fieldDiffs.length > 0 ? (
            <div className="dd-diff-list">
              {fieldDiffs.map((diff) => (
                <div key={diff.field} className={`dd-diff-row ${diff.type}`}>
                  <div className="dd-field-header">
                    <span className="dd-field-name">{diff.field}</span>
                    <span className={`dd-diff-tag ${diff.type}`}>{diff.type}</span>
                  </div>

                  <div className="dd-diff-values">
                    {diff.type !== 'added' && (
                      <div className="dd-val-box old" title="Previous Value">
                        <span className="dd-val-label">Old</span>
                        <div className="dd-val-text strikethrough">{formatVal(diff.oldVal)}</div>
                      </div>
                    )}

                    {diff.type === 'changed' && (
                      <div className="dd-diff-arrow">
                        <ArrowRight size={14} />
                      </div>
                    )}

                    {diff.type !== 'removed' && (
                      <div className="dd-val-box new" title="New Value">
                        <span className="dd-val-label">New</span>
                        <div className="dd-val-text">{formatVal(diff.newVal)}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dd-diff-empty">
              No state modification snapshot recorded for this specific event.
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

