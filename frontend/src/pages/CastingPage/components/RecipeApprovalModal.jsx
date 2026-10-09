import React, { useState } from 'react';

export default function RecipeApprovalModal({
  isOpen,
  onClose,
  recipe,
  versionNumber,
  onApprove,
  onReject
}) {
  const [remarks, setRemarks] = useState('Technically approved for structural casting');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !recipe) return null;

  const version = recipe.versions?.find(v => v.versionNumber === versionNumber) || recipe.activeVersionDetails;

  const handleApprove = async () => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await onApprove(recipe._id, version.versionNumber, remarks);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setErrorMsg('Rejection remarks are mandatory');
      return;
    }
    setActionLoading(true);
    setErrorMsg('');
    try {
      await onReject(recipe._id, version.versionNumber, rejectReason.trim());
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="casting-modal-overlay">
      <div className="casting-modal" style={{ maxWidth: '750px' }}>
        <div className="casting-modal-header">
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
            Technical Review: {recipe.displayName} ({recipe.recipeCode})
          </h2>
          <button className="casting-modal-close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', margin: '1rem 1.5rem 0', borderRadius: '6px', fontSize: '0.9rem' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <div style={{ padding: '1.5rem' }}>
          {/* Header Summary Card */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b' }}>Grade:</span>
                <strong style={{ display: 'block', fontSize: '1rem', color: '#1e293b' }}>{recipe.grade}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Version:</span>
                <strong style={{ display: 'block', fontSize: '1rem', color: '#1e293b' }}>v{version?.versionNumber}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>w/c Ratio:</span>
                <strong style={{ display: 'block', fontSize: '1rem', color: '#1e293b' }}>
                  {version?.calculatedWaterCementRatio !== null && version?.calculatedWaterCementRatio !== undefined
                    ? version.calculatedWaterCementRatio.toFixed(3)
                    : 'N/A'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>w/cm Ratio:</span>
                <strong style={{ display: 'block', fontSize: '1rem', color: '#1e293b' }}>
                  {version?.calculatedWaterCementitiousRatio !== null && version?.calculatedWaterCementitiousRatio !== undefined
                    ? version.calculatedWaterCementitiousRatio.toFixed(3)
                    : 'N/A'}
                </strong>
              </div>
            </div>
            {version?.submittedBy && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                Submitted by: <strong>{version.submittedBy.name}</strong> on {new Date(version.submittedBy.date).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Ingredients Table */}
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Ingredient Proportions (per m³)</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '1.25rem' }}>
            <table className="casting-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Material SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Rate / m³</th>
                  <th>Display Qty</th>
                </tr>
              </thead>
              <tbody>
                {(version?.ingredients || []).map((ing, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace' }}>{ing.materialIdentifier}</td>
                    <td>{ing.name}</td>
                    <td>{ing.category}</td>
                    <td>{ing.quantityPerM3} {ing.baseUnit}</td>
                    <td><strong>{ing.quantityPerM3} {ing.displayUnit}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Maker-Checker Remarks Section */}
          {!isRejectMode ? (
            <div>
              <label className="casting-label">Approval Remarks / Sign-off Comments</label>
              <textarea
                className="casting-textarea"
                rows={2}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Enter technical approval remarks..."
              />
            </div>
          ) : (
            <div>
              <label className="casting-label" style={{ color: '#dc2626' }}>Mandatory Rejection Remarks *</label>
              <textarea
                className="casting-textarea"
                rows={2}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this mix design is rejected (e.g. Slump out of specification, w/c ratio too high)..."
                required
              />
            </div>
          )}

          <div className="casting-modal-footer" style={{ padding: 0, marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="casting-btn casting-btn-secondary"
              onClick={() => setIsRejectMode(!isRejectMode)}
            >
              {isRejectMode ? '↩️ Switch to Approval Mode' : '❌ Switch to Reject Mode'}
            </button>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="casting-btn casting-btn-secondary" onClick={onClose} disabled={actionLoading}>
                Cancel
              </button>

              {!isRejectMode ? (
                <button
                  type="button"
                  className="casting-btn casting-btn-primary"
                  style={{ background: '#059669' }}
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Approving...' : '✅ Approve Mix Design'}
                </button>
              ) : (
                <button
                  type="button"
                  className="casting-btn casting-btn-danger"
                  onClick={handleReject}
                  disabled={actionLoading || !rejectReason.trim()}
                >
                  {actionLoading ? 'Rejecting...' : '🚫 Confirm Rejection'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
