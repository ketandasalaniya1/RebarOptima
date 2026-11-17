import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, History, AlertTriangle } from 'lucide-react';
import { activityTrackerApi } from '../../../utils/activityTrackerApi';

export default function CorrectionModal({
  isOpen,
  onClose,
  dailyUpdate,
  activityName,
  onSuccess,
}) {
  const [progress, setProgress] = useState(0);
  const [workDone, setWorkDone] = useState('');
  const [isDelayed, setIsDelayed] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !dailyUpdate) return;
    setProgress(typeof dailyUpdate.progress === 'number' ? dailyUpdate.progress : 0);
    setWorkDone(dailyUpdate.workDone || '');
    setIsDelayed(!!dailyUpdate.isDelayed);
    setDelayReason(dailyUpdate.delayReason || '');
    setCorrectionReason('');
    setError('');
  }, [isOpen, dailyUpdate]);

  if (!isOpen || !dailyUpdate) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!correctionReason.trim()) {
      setError('A mandatory reason for this correction is required for the audit log.');
      return;
    }

    setSubmitting(true);
    try {
      await activityTrackerApi.correctDailyUpdate(dailyUpdate._id, {
        progress: parseFloat(progress),
        workDone: workDone.trim(),
        isDelayed,
        delayReason: isDelayed ? delayReason.trim() : undefined,
        correctionReason: correctionReason.trim(),
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to apply update correction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ro-act-modal-overlay" onClick={onClose}>
      <div className="ro-act-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="ro-act-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="ro-act-icon-badge" style={{ width: '34px', height: '34px', background: '#d97706' }}>
              <History size={18} />
            </div>
            <div>
              <h3 className="ro-act-modal-title">Authorized Progress Correction</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {activityName || 'Activity'} • Logged Date: {dailyUpdate.updateDate}
              </div>
            </div>
          </div>
          <button type="button" className="ro-act-btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="ro-act-modal-body">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                border: '1px solid rgba(217, 119, 6, 0.25)',
                color: '#d97706',
                fontSize: '12px',
              }}
            >
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Immutable Audit Trail Notice:</strong> Every modification to historical daily updates
                preserves the original value, records the modifying supervisor, and timestamps the correction reason.
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--main-bg)',
                  border: '1px solid var(--card-border)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Original Progress</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {dailyUpdate.progress}%
                </div>
              </div>

              <div className="ro-form-group">
                <label className="ro-form-label">Corrected Progress (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="ro-form-input"
                  style={{ fontWeight: '700', fontSize: '16px' }}
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="ro-form-group">
              <label className="ro-form-label">Corrected Work Summary *</label>
              <textarea
                rows={3}
                className="ro-form-textarea"
                value={workDone}
                onChange={(e) => setWorkDone(e.target.value)}
                required
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--main-bg)',
                border: '1px solid var(--card-border)',
              }}
            >
              <input
                type="checkbox"
                id="corrDelay"
                checked={isDelayed}
                onChange={(e) => setIsDelayed(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#ef4444', cursor: 'pointer' }}
              />
              <label htmlFor="corrDelay" style={{ fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Flag Site Obstruction / Delay for this date
              </label>
            </div>

            {isDelayed && (
              <div className="ro-form-group">
                <label className="ro-form-label">Delay Root Cause *</label>
                <input
                  type="text"
                  className="ro-form-input"
                  placeholder="e.g., Concrete pump mechanical breakdown..."
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="ro-form-group">
              <label className="ro-form-label">Mandatory Correction Justification *</label>
              <textarea
                rows={2}
                className="ro-form-textarea"
                placeholder="State why this record is being modified (e.g., Data entry typo by site junior, verified by PM)..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="ro-act-modal-footer">
            <button
              type="button"
              className="ro-act-btn ro-act-btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ro-act-btn ro-act-btn-primary"
              disabled={submitting}
              style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}
            >
              {submitting ? 'Auditing & Saving...' : 'Confirm Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

