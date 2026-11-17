import React, { useState, useEffect } from 'react';
import { X, Scale, AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';
import { activityTrackerApi } from '../../../utils/activityTrackerApi';

export default function WeightageModal({
  isOpen,
  onClose,
  parentActivity,
  childActivities = [],
  onSuccess,
}) {
  const [weights, setWeights] = useState({});
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !childActivities.length) return;
    const initial = {};
    childActivities.forEach((c) => {
      initial[c._id] = typeof c.weightage === 'number' ? c.weightage : 0;
    });
    setWeights(initial);
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setReason('');
    setError('');
  }, [isOpen, childActivities]);

  if (!isOpen || !parentActivity) return null;

  const totalSum = Math.round(
    Object.values(weights).reduce((acc, v) => acc + (parseFloat(v) || 0), 0) * 100
  ) / 100;

  const isExact100 = Math.abs(totalSum - 100.0) < 0.01;

  const handleWeightChange = (childId, val) => {
    const num = parseFloat(val);
    setWeights((prev) => ({
      ...prev,
      [childId]: isNaN(num) ? 0 : Math.max(0, Math.min(100, num)),
    }));
  };

  const handleDistributeEvenly = () => {
    if (!childActivities.length) return;
    const n = childActivities.length;
    const base = Math.floor((100 / n) * 100) / 100;
    const remainder = Math.round((100 - base * n) * 100) / 100;

    const updated = {};
    childActivities.forEach((c, idx) => {
      updated[c._id] = idx === 0 ? Math.round((base + remainder) * 100) / 100 : base;
    });
    setWeights(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isExact100) {
      setError(`Weights must sum to exactly 100.00%. Current sum: ${totalSum.toFixed(2)}%`);
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for updating the weightage distribution.');
      return;
    }

    const payloadWeights = childActivities.map((c) => ({
      childActivityId: c._id,
      weightage: parseFloat(weights[c._id]) || 0,
    }));

    setSubmitting(true);
    try {
      await activityTrackerApi.saveWeightages(parentActivity._id, {
        effectiveFrom,
        reason: reason.trim(),
        weights: payloadWeights,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update weightages');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ro-act-modal-overlay" onClick={onClose}>
      <div className="ro-act-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="ro-act-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="ro-act-icon-badge" style={{ width: '34px', height: '34px' }}>
              <Scale size={18} />
            </div>
            <div>
              <h3 className="ro-act-modal-title">Manage Child Weightages</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {parentActivity.name} (Code: {parentActivity.code || 'L1'})
              </div>
            </div>
          </div>
          <button type="button" className="ro-act-btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="ro-act-modal-body">
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

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--main-bg)',
                border: '1px solid var(--card-border)',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Weightage Sum</div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: '800',
                    color: isExact100 ? '#10b981' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isExact100 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  {totalSum.toFixed(2)}%
                </div>
              </div>
              <button
                type="button"
                className="ro-act-btn ro-act-btn-secondary"
                onClick={handleDistributeEvenly}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                <Wand2 size={14} /> Distribute Evenly
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px',
                  gap: '12px',
                  padding: '6px 10px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                }}
              >
                <span>Child Activity</span>
                <span style={{ textAlign: 'right' }}>Weight (%)</span>
              </div>

              {childActivities.map((child) => (
                <div
                  key={child._id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--main-bg)',
                    border: '1px solid var(--card-border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {child.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Code: {child.code || 'L2'} • Progress: {child.currentProgress || 0}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="ro-form-input"
                      style={{ textAlign: 'right', fontWeight: '600' }}
                      value={weights[child._id] ?? ''}
                      onChange={(e) => handleWeightChange(child._id, e.target.value)}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '6px' }}>
              <div className="ro-form-group">
                <label className="ro-form-label">Effective From *</label>
                <input
                  type="date"
                  className="ro-form-input"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                />
              </div>
              <div className="ro-form-group">
                <label className="ro-form-label">Version History Policy</label>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', paddingTop: '8px' }}>
                  Historic reports prior to this date retain previous weights.
                </div>
              </div>
            </div>

            <div className="ro-form-group">
              <label className="ro-form-label">Reason for Weightage Update *</label>
              <textarea
                rows={2}
                className="ro-form-textarea"
                placeholder="e.g., Structural re-engineering increased column reinforcement scope..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
              disabled={submitting || !isExact100}
            >
              {submitting ? 'Applying Weights...' : 'Apply Weightages'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

