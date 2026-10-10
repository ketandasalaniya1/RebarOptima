import React, { useState } from 'react';
import {
  FlaskConical,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Scale,
  Layers,
  Copy,
  Printer,
  FileCheck,
  GitBranch,
  Edit3,
  Check,
  Building2,
  Truck,
  Droplets,
  AlertTriangle,
  Info,
  ChevronRight,
  TrendingDown,
  X
} from 'lucide-react';

export default function RecipeDetailModal({
  isOpen,
  onClose,
  recipe,
  onApproveRecipe,
  onForkVersion,
  onEditRecipe,
  onSubmitForReview
}) {
  const [activeTab, setActiveTab] = useState('proportions'); // 'proportions' | 'batch' | 'compliance' | 'versions'
  const [batchVolumeM3, setBatchVolumeM3] = useState(6.0); // Standard transit mixer 6 m³
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !recipe) return null;

  const activeVer = recipe.activeVersionDetails || (recipe.versions && recipe.versions[recipe.versions.length - 1]);
  const status = activeVer?.approvalStatus || 'DRAFT';
  const limits = activeVer?.engineeringLimits || {};
  const ingredients = activeVer?.ingredients || [];

  const handleCopyCode = () => {
    if (recipe.recipeCode) {
      navigator.clipboard.writeText(recipe.recipeCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Live Calculations
  const pureCement = ingredients
    .filter(i => i.category === 'CEMENT')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const scmTotal = ingredients
    .filter(i => i.category === 'SUPPLEMENTARY_CEMENTITIOUS')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const fineAgg = ingredients
    .filter(i => i.category === 'FINE_AGGREGATE')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const coarseAgg = ingredients
    .filter(i => i.category === 'COARSE_AGGREGATE')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const freeWater = ingredients
    .filter(i => i.category === 'WATER')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const admixtures = ingredients
    .filter(i => i.category === 'CHEMICAL_ADMIXTURE')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const totalBinder = pureCement + scmTotal;
  const totalAggregates = fineAgg + coarseAgg;
  const totalMass = totalBinder + totalAggregates + freeWater + admixtures;

  const wcVal = activeVer?.calculatedWaterCementRatio ?? (pureCement > 0 ? freeWater / pureCement : null);
  const wcmVal = activeVer?.calculatedWaterCementitiousRatio ?? (totalBinder > 0 ? freeWater / totalBinder : null);

  const coarsePercent = totalAggregates > 0 ? Math.round((coarseAgg / totalAggregates) * 100) : 0;
  const finePercent = totalAggregates > 0 ? 100 - coarsePercent : 0;
  const admixDosagePercent = totalBinder > 0 ? ((admixtures / totalBinder) * 100).toFixed(2) : '0.00';

  // Compliance checks
  const maxWC = limits.maxWaterCementRatio || 0.45;
  const minCement = limits.minCementContentKgPerM3 || 300;
  const maxBinder = limits.maxTotalCementitiousKgPerM3 || 450;

  const isWcCompliant = wcVal !== null ? wcVal <= maxWC : true;
  const isMinCementCompliant = pureCement >= minCement;
  const isMaxBinderCompliant = totalBinder <= maxBinder;

  const getStatusBadge = (st) => {
    switch (st) {
      case 'APPROVED':
        return (
          <span className="recipe-status-pill approved">
            <CheckCircle2 size={13} /> Approved
          </span>
        );
      case 'SUBMITTED_FOR_REVIEW':
        return (
          <span className="recipe-status-pill review">
            <Clock size={13} /> Under Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="recipe-status-pill rejected">
            <XCircle size={13} /> Rejected
          </span>
        );
      case 'SUPERSEDED':
        return (
          <span className="recipe-status-pill superseded">
            <GitBranch size={13} /> Superseded
          </span>
        );
      default:
        return (
          <span className="recipe-status-pill draft">
            <Edit3 size={13} /> Draft
          </span>
        );
    }
  };

  const getGradeTheme = (g) => {
    if (g === 'M10' || g === 'M15' || g === 'M20') return 'grade-blue';
    if (g === 'M25' || g === 'M30') return 'grade-teal';
    if (g === 'M35' || g === 'M40') return 'grade-purple';
    return 'grade-amber';
  };

  return (
    <div className="casting-modal-backdrop" onClick={onClose}>
      <div
        className="casting-modal large recipe-detail-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '980px' }}
      >
        {/* Modal Header */}
        <div className="recipe-detail-header">
          <div className="recipe-detail-header-left">
            <div className={`recipe-grade-badge-large ${getGradeTheme(recipe.grade)}`}>
              <FlaskConical size={20} />
              <span>{recipe.grade}</span>
            </div>
            <div>
              <div className="recipe-header-title-row">
                <h2 className="recipe-detail-title">{recipe.displayName}</h2>
                <div className="recipe-code-chip" onClick={handleCopyCode} title="Click to copy recipe code">
                  <code>{recipe.recipeCode}</code>
                  {copiedCode ? <Check size={13} color="#2dd4bf" /> : <Copy size={13} />}
                </div>
                {getStatusBadge(status)}
                <span className="recipe-version-tag">v{activeVer?.versionNumber || '1.0'}</span>
              </div>
              <p className="recipe-detail-subtitle">
                {recipe.description || 'Concrete mix design specification for structural elements.'}
              </p>
            </div>
          </div>

          <div className="recipe-detail-header-actions">
            <button className="btn-secondary-dark" onClick={handlePrint} title="Print Mix Design Certificate">
              <Printer size={15} /> Print Spec
            </button>
            <button className="casting-modal-close" onClick={onClose} title="Close modal">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Engineering Key Metrics Ribbon */}
        <div className="recipe-kpi-ribbon">
          <div className="recipe-kpi-item">
            <span className="recipe-kpi-label">w/c Ratio</span>
            <span className={`recipe-kpi-value ${!isWcCompliant ? 'danger' : 'success'}`}>
              {wcVal !== null ? wcVal.toFixed(3) : 'N/A'}
            </span>
            <span className="recipe-kpi-sub">Max {maxWC.toFixed(2)}</span>
          </div>

          <div className="recipe-kpi-item">
            <span className="recipe-kpi-label">w/cm (Binder)</span>
            <span className="recipe-kpi-value">
              {wcmVal !== null ? wcmVal.toFixed(3) : 'N/A'}
            </span>
            <span className="recipe-kpi-sub">Total Cementitious</span>
          </div>

          <div className="recipe-kpi-item">
            <span className="recipe-kpi-label">Total Binder</span>
            <span className={`recipe-kpi-value ${!isMaxBinderCompliant ? 'danger' : ''}`}>
              {totalBinder} <small>kg/m³</small>
            </span>
            <span className="recipe-kpi-sub">OPC {pureCement} + SCM {scmTotal}</span>
          </div>

          <div className="recipe-kpi-item">
            <span className="recipe-kpi-label">Target Slump</span>
            <span className="recipe-kpi-value highlight">
              {limits.targetSlumpMinMm || 120} - {limits.targetSlumpMaxMm || 150} <small>mm</small>
            </span>
            <span className="recipe-kpi-sub">Pumpable Workability</span>
          </div>

          <div className="recipe-kpi-item">
            <span className="recipe-kpi-label">Mix Type</span>
            <span className="recipe-kpi-value mix-type">
              {activeVer?.mixType === 'RMC_PROCUREMENT' ? (
                <>
                  <Truck size={14} /> RMC
                </>
              ) : (
                <>
                  <Building2 size={14} /> Site Batch
                </>
              )}
            </span>
            <span className="recipe-kpi-sub">{activeVer?.rmcVendorName || 'In-House Batch Plant'}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="recipe-detail-tabs">
          <button
            className={`recipe-nav-tab ${activeTab === 'proportions' ? 'active' : ''}`}
            onClick={() => setActiveTab('proportions')}
          >
            <Layers size={15} /> Proportions (1.0 m³)
          </button>
          <button
            className={`recipe-nav-tab ${activeTab === 'batch' ? 'active' : ''}`}
            onClick={() => setActiveTab('batch')}
          >
            <Scale size={15} /> Transit Mixer Batch Scaler
          </button>
          <button
            className={`recipe-nav-tab ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveTab('compliance')}
          >
            <ShieldCheck size={15} /> IS 456 & 10262 Compliance
          </button>
          <button
            className={`recipe-nav-tab ${activeTab === 'versions' ? 'active' : ''}`}
            onClick={() => setActiveTab('versions')}
          >
            <GitBranch size={15} /> Version History ({recipe.versions?.length || 1})
          </button>
        </div>

        {/* Tab 1: Proportions per 1.0 m3 */}
        {activeTab === 'proportions' && (
          <div className="recipe-tab-content">
            {/* Visual Mix Breakdown Bar */}
            <div className="recipe-visual-bar-card">
              <div className="recipe-visual-bar-title">
                <span>Material Volumetric Distribution (Approx. {totalMass.toFixed(0)} kg/m³)</span>
                <span className="recipe-ratio-split">
                  Coarse:Fine Ratio = {coarsePercent}:{finePercent} | Admix Dosage = {admixDosagePercent}%
                </span>
              </div>
              <div className="recipe-stacked-bar">
                <div
                  className="bar-seg cement"
                  style={{ width: `${(pureCement / totalMass) * 100}%` }}
                  title={`OPC Cement: ${pureCement} kg/m³`}
                />
                {scmTotal > 0 && (
                  <div
                    className="bar-seg scm"
                    style={{ width: `${(scmTotal / totalMass) * 100}%` }}
                    title={`SCM (Fly Ash/GGBS): ${scmTotal} kg/m³`}
                  />
                )}
                <div
                  className="bar-seg sand"
                  style={{ width: `${(fineAgg / totalMass) * 100}%` }}
                  title={`Fine Aggregate: ${fineAgg} kg/m³`}
                />
                <div
                  className="bar-seg coarse"
                  style={{ width: `${(coarseAgg / totalMass) * 100}%` }}
                  title={`Coarse Aggregate: ${coarseAgg} kg/m³`}
                />
                <div
                  className="bar-seg water"
                  style={{ width: `${(freeWater / totalMass) * 100}%` }}
                  title={`Mixing Water: ${freeWater} L/m³`}
                />
                {admixtures > 0 && (
                  <div
                    className="bar-seg admix"
                    style={{ width: `${Math.max((admixtures / totalMass) * 100, 1.5)}%` }}
                    title={`Admixtures: ${admixtures} kg/m³`}
                  />
                )}
              </div>
              <div className="recipe-stacked-legend">
                <span className="legend-item"><span className="legend-dot cement" /> Cement ({pureCement}kg)</span>
                {scmTotal > 0 && <span className="legend-item"><span className="legend-dot scm" /> SCM ({scmTotal}kg)</span>}
                <span className="legend-item"><span className="legend-dot sand" /> Sand ({fineAgg}kg)</span>
                <span className="legend-item"><span className="legend-dot coarse" /> Coarse ({coarseAgg}kg)</span>
                <span className="legend-item"><span className="legend-dot water" /> Water ({freeWater}L)</span>
                {admixtures > 0 && <span className="legend-item"><span className="legend-dot admix" /> Admixture ({admixtures}kg)</span>}
              </div>
            </div>

            {/* Ingredients Table */}
            <div className="casting-table-container">
              <table className="casting-table">
                <thead>
                  <tr>
                    <th>Material / SKU</th>
                    <th>Standard Specification</th>
                    <th>Category</th>
                    <th>Qty / m³</th>
                    <th>Display Unit</th>
                    <th>Moisture / Abs.</th>
                    <th>Wastage %</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, idx) => (
                    <tr key={ing.ingredientId || idx}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                          {ing.name}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                          {ing.materialIdentifier}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                        {ing.specificationStandard || 'Standard'}
                      </td>
                      <td>
                        <span className="ingredient-category-pill">
                          {ing.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: '0.95rem', color: '#2dd4bf', fontFamily: 'monospace' }}>
                          {ing.quantityPerM3}
                        </strong>{' '}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                          {ing.baseUnit}
                        </span>
                      </td>
                      <td>
                        {ing.category === 'CEMENT' ? (
                          <span style={{ fontWeight: 600, color: '#60a5fa' }}>
                            {(ing.quantityPerM3 / 50).toFixed(2)} Bags (50kg)
                          </span>
                        ) : ing.category === 'FINE_AGGREGATE' || ing.category === 'COARSE_AGGREGATE' ? (
                          <span>{(ing.quantityPerM3 / 1000).toFixed(3)} MT</span>
                        ) : (
                          <span>{ing.quantityPerM3} {ing.displayUnit || ing.baseUnit}</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {ing.waterAbsorptionPercent ? `Abs: ${ing.waterAbsorptionPercent}%` : ''}
                        {ing.moistureCorrectionPercent ? ` | Moist: ${ing.moistureCorrectionPercent}%` : '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>
                          {ing.wastageAllowancePercent || 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Transit Mixer Batch Scaler */}
        {activeTab === 'batch' && (
          <div className="recipe-tab-content">
            <div className="batch-scaler-top">
              <div className="batch-scaler-prompt">
                <Scale size={20} className="batch-icon" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary, #f8fafc)' }}>
                    Transit Mixer / Site Batch Scaling Calculator
                  </h4>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    Enter the target pour volume or truck capacity to see exact batching weights with wastage.
                  </p>
                </div>
              </div>

              <div className="batch-volume-picker">
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Batch Capacity:</span>
                {[1.0, 6.0, 7.0, 8.0].map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`batch-preset-btn ${batchVolumeM3 === v ? 'active' : ''}`}
                    onClick={() => setBatchVolumeM3(v)}
                  >
                    {v} m³
                  </button>
                ))}
                <div className="batch-input-wrap">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="500"
                    value={batchVolumeM3}
                    onChange={(e) => setBatchVolumeM3(Math.max(0.1, parseFloat(e.target.value) || 1))}
                    className="casting-input"
                    style={{ width: '80px', padding: '0.4rem 0.6rem' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>m³</span>
                </div>
              </div>
            </div>

            {/* Batch Table */}
            <div className="casting-table-container">
              <table className="casting-table">
                <thead>
                  <tr>
                    <th>Material Component</th>
                    <th>Unit / Form</th>
                    <th>1 m³ Rate</th>
                    <th>Batch Net Qty ({batchVolumeM3} m³)</th>
                    <th>Wastage Allowance</th>
                    <th>Total Batch Qty To Weigh</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, idx) => {
                    const netQty = (Number(ing.quantityPerM3) || 0) * batchVolumeM3;
                    const wastage = ing.wastageAllowancePercent || 0;
                    const grossQty = netQty * (1 + wastage / 100);

                    return (
                      <tr key={idx}>
                        <td>
                          <strong>{ing.name}</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                            {ing.category}
                          </span>
                        </td>
                        <td>{ing.baseUnit}</td>
                        <td style={{ fontFamily: 'monospace' }}>{ing.quantityPerM3}</td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {netQty.toFixed(1)} {ing.baseUnit}
                          </span>
                          {ing.category === 'CEMENT' && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#60a5fa' }}>
                              ≈ {Math.ceil(netQty / 50)} bags
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ color: wastage > 0 ? '#fbbf24' : '#94a3b8', fontSize: '0.8rem' }}>
                            +{wastage}% ({(grossQty - netQty).toFixed(1)})
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '1rem', color: '#2dd4bf', fontFamily: 'monospace' }}>
                            {grossQty.toFixed(1)} {ing.baseUnit}
                          </strong>
                          {ing.category === 'CEMENT' && (
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>
                              = {Math.ceil(grossQty / 50)} Bags (50kg)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: IS 456 & 10262 Compliance Check */}
        {activeTab === 'compliance' && (
          <div className="recipe-tab-content">
            <div className="compliance-cards-grid">
              <div className={`compliance-card ${isWcCompliant ? 'pass' : 'fail'}`}>
                <div className="compliance-card-header">
                  <div className="compliance-status-icon">
                    {isWcCompliant ? <CheckCircle2 size={18} color="#2dd4bf" /> : <AlertTriangle size={18} color="#ef4444" />}
                  </div>
                  <div>
                    <h5 className="compliance-title">Water-Cement Ratio (w/c)</h5>
                    <span className="compliance-standard">IS 456:2000 Table 5 Limit</span>
                  </div>
                </div>
                <div className="compliance-body">
                  <div className="compliance-stat-row">
                    <span>Calculated Value:</span>
                    <strong>{wcVal !== null ? wcVal.toFixed(3) : 'N/A'}</strong>
                  </div>
                  <div className="compliance-stat-row">
                    <span>Max Allowed Limit:</span>
                    <span>{maxWC.toFixed(2)}</span>
                  </div>
                  <p className="compliance-note">
                    {isWcCompliant
                      ? 'w/c ratio satisfies durability requirements for severe/moderate exposure.'
                      : 'w/c ratio exceeds maximum permissible limit. Risk of honeycombing and reduced strength.'}
                  </p>
                </div>
              </div>

              <div className={`compliance-card ${isMinCementCompliant ? 'pass' : 'fail'}`}>
                <div className="compliance-card-header">
                  <div className="compliance-status-icon">
                    {isMinCementCompliant ? <CheckCircle2 size={18} color="#2dd4bf" /> : <AlertTriangle size={18} color="#ef4444" />}
                  </div>
                  <div>
                    <h5 className="compliance-title">Minimum Cement Content</h5>
                    <span className="compliance-standard">IS 456:2000 Cl. 8.2.4</span>
                  </div>
                </div>
                <div className="compliance-body">
                  <div className="compliance-stat-row">
                    <span>Actual Pure Cement:</span>
                    <strong>{pureCement} kg/m³</strong>
                  </div>
                  <div className="compliance-stat-row">
                    <span>Mandatory Minimum:</span>
                    <span>{minCement} kg/m³</span>
                  </div>
                  <p className="compliance-note">
                    {isMinCementCompliant
                      ? 'Cement content satisfies structural durability threshold.'
                      : 'Cement content falls below mandatory minimum for this grade.'}
                  </p>
                </div>
              </div>

              <div className={`compliance-card ${isMaxBinderCompliant ? 'pass' : 'fail'}`}>
                <div className="compliance-card-header">
                  <div className="compliance-status-icon">
                    {isMaxBinderCompliant ? <CheckCircle2 size={18} color="#2dd4bf" /> : <AlertTriangle size={18} color="#ef4444" />}
                  </div>
                  <div>
                    <h5 className="compliance-title">Maximum Binder Upper Limit</h5>
                    <span className="compliance-standard">IS 456:2000 Cl. 8.2.4.2 (Thermal Shrinkage)</span>
                  </div>
                </div>
                <div className="compliance-body">
                  <div className="compliance-stat-row">
                    <span>Total Cementitious:</span>
                    <strong>{totalBinder} kg/m³</strong>
                  </div>
                  <div className="compliance-stat-row">
                    <span>Maximum Permissible:</span>
                    <span>{maxBinder} kg/m³</span>
                  </div>
                  <p className="compliance-note">
                    {isMaxBinderCompliant
                      ? 'Cementitious content is within safe thermal shrinkage & hydration limit.'
                      : 'Binder exceeds 450 kg/m³. Risk of excessive heat of hydration and thermal cracking.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Maker-Checker Sign-off Details */}
            {activeVer?.approvalHistory && activeVer.approvalHistory.length > 0 && (
              <div className="recipe-approval-audit-box">
                <h5 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)' }}>
                  Technical Review & Quality Audit Trail
                </h5>
                <div className="audit-timeline">
                  {activeVer.approvalHistory.map((item, i) => (
                    <div key={i} className="audit-timeline-item">
                      <div className={`audit-badge ${item.status === 'APPROVED' ? 'approved' : 'rejected'}`}>
                        {item.status === 'APPROVED' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      </div>
                      <div className="audit-info">
                        <div className="audit-top">
                          <strong>{item.status}</strong> by <span>{item.reviewedByName || 'Technical Reviewer'}</span>
                          <span className="audit-date">{item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : ''}</span>
                        </div>
                        {item.remarks && <p className="audit-remarks">"{item.remarks}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Version History */}
        {activeTab === 'versions' && (
          <div className="recipe-tab-content">
            <div className="version-history-list">
              {(recipe.versions || []).map((ver, idx) => (
                <div
                  key={idx}
                  className={`version-history-card ${ver.versionNumber === activeVer?.versionNumber ? 'active' : ''}`}
                >
                  <div className="version-card-left">
                    <div className="version-number-tag">
                      v{ver.versionNumber}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>
                          {ver.versionNotes || `Revision ${ver.versionNumber}`}
                        </strong>
                        {getStatusBadge(ver.approvalStatus)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.2rem' }}>
                        Created on {ver.createdAt ? new Date(ver.createdAt).toLocaleDateString() : 'N/A'}{' '}
                        {ver.submittedBy?.name && `by ${ver.submittedBy.name}`}
                      </div>
                    </div>
                  </div>

                  <div className="version-card-right">
                    <div className="version-metrics-mini">
                      <span>w/c: <strong>{ver.calculatedWaterCementRatio ? ver.calculatedWaterCementRatio.toFixed(3) : 'N/A'}</strong></span>
                      <span>Ingredients: <strong>{ver.ingredients?.length || 0}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="recipe-detail-footer">
          <div className="recipe-footer-left">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Last updated {activeVer?.updatedAt ? new Date(activeVer.updatedAt).toLocaleDateString() : 'recently'}
            </span>
          </div>

          <div className="recipe-footer-right">
            {status === 'DRAFT' && (
              <button
                className="btn-primary-teal"
                onClick={() => {
                  if (onSubmitForReview) onSubmitForReview(recipe, activeVer?.versionNumber);
                  onClose();
                }}
              >
                <Clock size={15} /> Submit for Review
              </button>
            )}

            {status === 'SUBMITTED_FOR_REVIEW' && (
              <button
                className="btn-primary-teal"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
                onClick={() => {
                  onClose();
                  if (onApproveRecipe) onApproveRecipe(recipe, activeVer?.versionNumber);
                }}
              >
                <ShieldCheck size={15} /> Technical Review / Sign-off
              </button>
            )}

            {status === 'APPROVED' && (
              <button
                className="btn-secondary-dark"
                onClick={() => {
                  onClose();
                  if (onForkVersion) onForkVersion(recipe);
                }}
              >
                <GitBranch size={15} /> Fork v+1 Revision
              </button>
            )}

            <button
              className="btn-secondary-dark"
              onClick={() => {
                onClose();
                if (onEditRecipe) onEditRecipe(recipe);
              }}
            >
              <Edit3 size={15} /> Edit Recipe
            </button>

            <button className="btn-secondary-dark" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
