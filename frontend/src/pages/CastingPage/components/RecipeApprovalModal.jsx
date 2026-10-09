import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FlaskConical,
  Layers,
  FileCheck,
  Info,
  Clock,
  User,
  Calendar,
  Check
} from 'lucide-react';

export default function RecipeApprovalModal({
  isOpen,
  onClose,
  recipe,
  versionNumber,
  onApprove,
  onReject
}) {
  const [remarks, setRemarks] = useState('Technically approved for structural casting. Complies with IS 456 / IS 10262 durability specifications.');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !recipe) return null;

  const version = recipe.versions?.find((v) => v.versionNumber === versionNumber) || recipe.activeVersionDetails || (recipe.versions && recipe.versions[0]);
  const ingredients = version?.ingredients || [];
  const limits = version?.engineeringLimits || {};

  // Ratios & Calculations
  const pureCement = ingredients
    .filter((i) => i.category === 'CEMENT')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const scmTotal = ingredients
    .filter((i) => i.category === 'SUPPLEMENTARY_CEMENTITIOUS')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const fineAgg = ingredients
    .filter((i) => i.category === 'FINE_AGGREGATE')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const coarseAgg = ingredients
    .filter((i) => i.category === 'COARSE_AGGREGATE')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const freeWater = ingredients
    .filter((i) => i.category === 'WATER')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const totalBinder = pureCement + scmTotal;
  const totalAggregates = fineAgg + coarseAgg;
  const wcVal = version?.calculatedWaterCementRatio ?? (pureCement > 0 ? freeWater / pureCement : null);
  const wcmVal = version?.calculatedWaterCementitiousRatio ?? (totalBinder > 0 ? freeWater / totalBinder : null);

  const maxWC = limits.maxWaterCementRatio || 0.45;
  const minCement = limits.minCementContentKgPerM3 || 300;
  const maxBinder = limits.maxTotalCementitiousKgPerM3 || 450;

  const isWcPass = wcVal !== null ? wcVal <= maxWC : true;
  const isMinCementPass = pureCement >= minCement;
  const isMaxBinderPass = totalBinder <= maxBinder;

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
      setErrorMsg('Rejection remarks explaining non-conformance are mandatory.');
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
    <div className="casting-modal-backdrop" onClick={onClose}>
      <div
        className="casting-modal large recipe-approval-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px' }}
      >
        {/* Header */}
        <div className="recipe-approval-header">
          <div className="recipe-approval-title-wrap">
            <div className={`approval-header-icon ${isRejectMode ? 'reject' : 'approve'}`}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="approval-modal-title">
                Technical Review & QA Sign-Off: {recipe.displayName}
              </h2>
              <div className="approval-meta-row">
                <code>{recipe.recipeCode}</code>
                <span className="approval-grade-pill">{recipe.grade}</span>
                <span className="approval-ver-pill">v{version?.versionNumber || '1.0'}</span>
                {version?.submittedBy && (
                  <span className="approval-submitter-text">
                    <User size={12} /> {version.submittedBy.name} ({new Date(version.submittedBy.date).toLocaleDateString()})
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="casting-modal-close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && (
          <div className="recipe-error-banner" style={{ margin: '1rem 1.5rem 0' }}>
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="recipe-approval-body">
          {/* Engineering Compliance Summary Cards */}
          <div className="approval-checkpoint-grid">
            <div className={`approval-checkpoint ${isWcPass ? 'pass' : 'fail'}`}>
              <div className="checkpoint-icon">
                {isWcPass ? <CheckCircle2 size={16} color="#2dd4bf" /> : <AlertTriangle size={16} color="#ef4444" />}
              </div>
              <div className="checkpoint-info">
                <span className="checkpoint-lbl">w/c Ratio</span>
                <strong className="checkpoint-val">{wcVal ? wcVal.toFixed(3) : 'N/A'}</strong>
                <span className="checkpoint-sub">Max allowed {maxWC.toFixed(2)}</span>
              </div>
            </div>

            <div className={`approval-checkpoint ${isMinCementPass ? 'pass' : 'fail'}`}>
              <div className="checkpoint-icon">
                {isMinCementPass ? <CheckCircle2 size={16} color="#2dd4bf" /> : <AlertTriangle size={16} color="#ef4444" />}
              </div>
              <div className="checkpoint-info">
                <span className="checkpoint-lbl">Pure Cement</span>
                <strong className="checkpoint-val">{pureCement} kg</strong>
                <span className="checkpoint-sub">Min required {minCement} kg</span>
              </div>
            </div>

            <div className={`approval-checkpoint ${isMaxBinderPass ? 'pass' : 'fail'}`}>
              <div className="checkpoint-icon">
                {isMaxBinderPass ? <CheckCircle2 size={16} color="#2dd4bf" /> : <AlertTriangle size={16} color="#ef4444" />}
              </div>
              <div className="checkpoint-info">
                <span className="checkpoint-lbl">Total Binder</span>
                <strong className="checkpoint-val">{totalBinder} kg</strong>
                <span className="checkpoint-sub">Upper limit {maxBinder} kg</span>
              </div>
            </div>

            <div className="approval-checkpoint pass">
              <div className="checkpoint-icon">
                <CheckCircle2 size={16} color="#2dd4bf" />
              </div>
              <div className="checkpoint-info">
                <span className="checkpoint-lbl">Target Slump</span>
                <strong className="checkpoint-val">{limits.targetSlumpMinMm || 120}-{limits.targetSlumpMaxMm || 150} mm</strong>
                <span className="checkpoint-sub">Pumpable Workability</span>
              </div>
            </div>
          </div>

          {/* Proportions Quick Table */}
          <div className="approval-table-section">
            <h4 className="approval-section-title">
              <Layers size={14} /> Mix Proportions per 1.0 m³ Concrete
            </h4>
            <div className="casting-table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              <table className="casting-table">
                <thead>
                  <tr>
                    <th>Material Name</th>
                    <th>Identifier</th>
                    <th>Category</th>
                    <th>Rate / m³</th>
                    <th>Equivalent Display Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, idx) => (
                    <tr key={idx}>
                      <td><strong>{ing.name}</strong></td>
                      <td><code>{ing.materialIdentifier}</code></td>
                      <td>
                        <span className="ingredient-category-pill">
                          {ing.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#2dd4bf' }}>{ing.quantityPerM3}</strong> {ing.baseUnit}
                      </td>
                      <td>
                        {ing.category === 'CEMENT' ? (
                          <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                            {(ing.quantityPerM3 / 50).toFixed(2)} Bags (50kg)
                          </span>
                        ) : (
                          <span>{ing.quantityPerM3} {ing.displayUnit || ing.baseUnit}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maker-Checker Sign-off Input */}
          {!isRejectMode ? (
            <div className="approval-signoff-box">
              <div className="signoff-box-header">
                <label className="form-label" style={{ margin: 0 }}>
                  Quality Sign-Off & Approval Remarks
                </label>
                <span className="signoff-stamp-preview">
                  <Check size={12} /> Digital Approval Stamp
                </span>
              </div>
              <textarea
                className="form-input"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter technical QA remarks for the structural engineering log..."
              />
            </div>
          ) : (
            <div className="approval-signoff-box reject">
              <div className="signoff-box-header">
                <label className="form-label" style={{ margin: 0, color: '#f87171' }}>
                  Mandatory Rejection Remarks & Corrective Actions *
                </label>
              </div>
              <textarea
                className="form-input"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain the technical reasons for rejection (e.g., Slump target exceeds safe envelope, insufficient cement content, coarse aggregate gap grading)..."
                required
              />
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="recipe-approval-footer">
          <button
            type="button"
            className="btn-secondary-dark"
            onClick={() => {
              setIsRejectMode(!isRejectMode);
              setErrorMsg('');
            }}
          >
            {isRejectMode ? '↩️ Switch to Approval Mode' : '❌ Switch to Rejection Mode'}
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-secondary-dark"
              onClick={onClose}
              disabled={actionLoading}
            >
              Cancel
            </button>

            {!isRejectMode ? (
              <button
                type="button"
                className="btn-primary-teal"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
                onClick={handleApprove}
                disabled={actionLoading}
              >
                <ShieldCheck size={15} />
                {actionLoading ? 'Approving...' : '✅ Approve Mix Design'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-icon-danger"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 }}
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
              >
                <XCircle size={15} />
                {actionLoading ? 'Rejecting...' : '🚫 Confirm Rejection'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
