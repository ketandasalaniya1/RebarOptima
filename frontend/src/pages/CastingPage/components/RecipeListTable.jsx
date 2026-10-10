import React, { useState } from 'react';
import {
  FlaskConical,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  GitBranch,
  Layers,
  LayoutGrid,
  ListFilter,
  Truck,
  Building2,
  ExternalLink,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  FileSpreadsheet,
  X
} from 'lucide-react';

export default function RecipeListTable({
  recipes = [],
  loading = false,
  onRefresh,
  onCreateNew,
  onViewRecipe,
  onApproveRecipe,
  onForkVersion
}) {
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedMixType, setSelectedMixType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  const grades = ['ALL', 'M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M60', 'CUSTOM'];

  // Filter recipes
  const filtered = recipes.filter((r) => {
    const activeVer = r.activeVersionDetails || (r.versions && r.versions[r.versions.length - 1]);
    const status = activeVer?.approvalStatus || 'DRAFT';
    const mixType = activeVer?.mixType || 'SITE_BATCHING';

    if (selectedGrade !== 'ALL' && r.grade !== selectedGrade) return false;
    if (selectedStatus !== 'ALL' && status !== selectedStatus) return false;
    if (selectedMixType !== 'ALL' && mixType !== selectedMixType) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const codeMatch = r.recipeCode?.toLowerCase().includes(term);
      const nameMatch = r.displayName?.toLowerCase().includes(term);
      const descMatch = r.description?.toLowerCase().includes(term);
      const vendorMatch = activeVer?.rmcVendorName?.toLowerCase().includes(term);
      if (!codeMatch && !nameMatch && !descMatch && !vendorMatch) return false;
    }
    return true;
  });

  // Calculate Summary Statistics
  const totalRecipes = recipes.length;
  const approvedRecipes = recipes.filter(
    (r) => (r.activeVersionDetails?.approvalStatus || r.versions?.[0]?.approvalStatus) === 'APPROVED'
  ).length;
  const reviewPending = recipes.filter(
    (r) => (r.activeVersionDetails?.approvalStatus || r.versions?.[0]?.approvalStatus) === 'SUBMITTED_FOR_REVIEW'
  ).length;
  const draftRecipes = recipes.filter(
    (r) => (r.activeVersionDetails?.approvalStatus || r.versions?.[0]?.approvalStatus) === 'DRAFT'
  ).length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="recipe-status-pill approved">
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'SUBMITTED_FOR_REVIEW':
        return (
          <span className="recipe-status-pill review">
            <Clock size={12} /> Under Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="recipe-status-pill rejected">
            <XCircle size={12} /> Rejected
          </span>
        );
      case 'SUPERSEDED':
        return (
          <span className="recipe-status-pill superseded">
            <GitBranch size={12} /> Superseded
          </span>
        );
      default:
        return (
          <span className="recipe-status-pill draft">
            <FlaskConical size={12} /> Draft
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
    <div className="recipe-dashboard-container">
      {/* Top Engineering Summary Cards */}
      <div className="recipe-stats-row">
        <div className="recipe-stat-card">
          <div className="recipe-stat-icon-wrap teal">
            <FlaskConical size={20} />
          </div>
          <div className="recipe-stat-text">
            <span className="recipe-stat-num">{totalRecipes}</span>
            <span className="recipe-stat-lbl">Total Mix Recipes</span>
          </div>
        </div>

        <div className="recipe-stat-card">
          <div className="recipe-stat-icon-wrap green">
            <CheckCircle2 size={20} />
          </div>
          <div className="recipe-stat-text">
            <span className="recipe-stat-num">{approvedRecipes}</span>
            <span className="recipe-stat-lbl">Approved & Active</span>
          </div>
        </div>

        <div className="recipe-stat-card">
          <div className="recipe-stat-icon-wrap amber">
            <Clock size={20} />
          </div>
          <div className="recipe-stat-text">
            <span className="recipe-stat-num">{reviewPending}</span>
            <span className="recipe-stat-lbl">Pending Review</span>
          </div>
        </div>

        <div className="recipe-stat-card">
          <div className="recipe-stat-icon-wrap blue">
            <Layers size={20} />
          </div>
          <div className="recipe-stat-text">
            <span className="recipe-stat-num">{draftRecipes}</span>
            <span className="recipe-stat-lbl">Draft Designs</span>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="recipe-main-panel">
        {/* Header & Controls */}
        <div className="recipe-panel-header">
          <div>
            <h2 className="recipe-panel-title">Concrete Mix Design Library</h2>
            <p className="recipe-panel-subtitle">
              Engineering mix designs, IS 10262 batch proportions, and technical sign-offs
            </p>
          </div>

          <div className="recipe-panel-actions">
            <button
              className="btn-secondary-dark"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh Recipe Library"
            >
              <RefreshCw size={15} className={loading ? 'spinning-icon' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button className="btn-primary-teal" onClick={onCreateNew}>
              <Plus size={16} />
              <span>Create Mix Recipe</span>
            </button>
          </div>
        </div>

        {/* Filters and View Switcher Toolbar */}
        <div className="recipe-toolbar">
          <div className="recipe-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="recipe-search-input"
              placeholder="Search by code (e.g. REC-M25), name, or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="search-clear-btn" onClick={() => setSearchTerm('')} title="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="recipe-filter-group">
            {/* Grade Filter */}
            <div className="recipe-filter-item">
              <span className="filter-lbl">Grade:</span>
              <select
                className="casting-select filter-select"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
              >
                {grades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="recipe-filter-item">
              <span className="filter-lbl">Status:</span>
              <select
                className="casting-select filter-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="APPROVED">Approved</option>
                <option value="SUBMITTED_FOR_REVIEW">Under Review</option>
                <option value="DRAFT">Draft</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {/* Mix Type Filter */}
            <div className="recipe-filter-item">
              <span className="filter-lbl">Mix Type:</span>
              <select
                className="casting-select filter-select"
                value={selectedMixType}
                onChange={(e) => setSelectedMixType(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="SITE_BATCHING">Site Batching</option>
                <option value="RMC_PROCUREMENT">RMC Ready-Mix</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="recipe-view-toggle">
              <button
                className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid Cards View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Data Table View"
              >
                <FileSpreadsheet size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="recipe-quick-chips">
          <button
            className={`quick-chip ${selectedStatus === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('ALL')}
          >
            All Recipes ({recipes.length})
          </button>
          <button
            className={`quick-chip ${selectedStatus === 'APPROVED' ? 'active approved' : ''}`}
            onClick={() => setSelectedStatus('APPROVED')}
          >
            <CheckCircle2 size={13} /> Approved ({approvedRecipes})
          </button>
          <button
            className={`quick-chip ${selectedStatus === 'SUBMITTED_FOR_REVIEW' ? 'active review' : ''}`}
            onClick={() => setSelectedStatus('SUBMITTED_FOR_REVIEW')}
          >
            <Clock size={13} /> Under Review ({reviewPending})
          </button>
          <button
            className={`quick-chip ${selectedStatus === 'DRAFT' ? 'active draft' : ''}`}
            onClick={() => setSelectedStatus('DRAFT')}
          >
            Draft ({draftRecipes})
          </button>
        </div>

        {/* Body Content */}
        {filtered.length === 0 ? (
          <div className="recipe-empty-state">
            <div className="recipe-empty-icon">
              <FlaskConical size={36} />
            </div>
            <h3 className="recipe-empty-title">No Mix Recipes Found</h3>
            <p className="recipe-empty-desc">
              {searchTerm || selectedGrade !== 'ALL' || selectedStatus !== 'ALL'
                ? 'No recipes match your current filters. Try resetting the search or filter settings.'
                : 'Define your first concrete mix design proportions per IS 10262 standard.'}
            </p>
            <button className="btn-primary-teal" onClick={onCreateNew}>
              <Plus size={16} /> Create Mix Recipe
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Visual Cards Grid (Bento Grid) */
          <div className="recipe-grid">
            {filtered.map((recipe) => {
              const activeVer = recipe.activeVersionDetails || (recipe.versions && recipe.versions[recipe.versions.length - 1]);
              const status = activeVer?.approvalStatus || 'DRAFT';
              const ingredients = activeVer?.ingredients || [];
              const limits = activeVer?.engineeringLimits || {};

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
              const totalAgg = fineAgg + coarseAgg;
              const totalMass = totalBinder + totalAgg + freeWater;

              const wcVal = activeVer?.calculatedWaterCementRatio ?? (pureCement > 0 ? freeWater / pureCement : null);
              const wcmVal = activeVer?.calculatedWaterCementitiousRatio ?? (totalBinder > 0 ? freeWater / totalBinder : null);

              return (
                <div
                  key={recipe._id || recipe.recipeCode}
                  className="recipe-card"
                  onClick={() => onViewRecipe(recipe)}
                >
                  {/* Card Header */}
                  <div className="recipe-card-header">
                    <div className="recipe-card-header-left">
                      <div className={`recipe-grade-badge ${getGradeTheme(recipe.grade)}`}>
                        {recipe.grade}
                      </div>
                      <div>
                        <div className="recipe-card-code">
                          <code>{recipe.recipeCode}</code>
                        </div>
                        <h4 className="recipe-card-name" title={recipe.displayName}>
                          {recipe.displayName}
                        </h4>
                      </div>
                    </div>
                    <div>
                      {getStatusBadge(status)}
                    </div>
                  </div>

                  {/* Card Details / Tag Row */}
                  <div className="recipe-card-tags">
                    <span className="recipe-card-type-tag">
                      {activeVer?.mixType === 'RMC_PROCUREMENT' ? (
                        <>
                          <Truck size={12} /> RMC Bulk
                        </>
                      ) : (
                        <>
                          <Building2 size={12} /> Site Batch
                        </>
                      )}
                    </span>
                    <span className="recipe-card-version">v{activeVer?.versionNumber || '1.0'}</span>
                    <span className="recipe-card-slump">
                      Slump: {limits.targetSlumpMinMm || 120}-{limits.targetSlumpMaxMm || 150}mm
                    </span>
                  </div>

                  {/* Key Ratios HUD */}
                  <div className="recipe-card-ratios">
                    <div className="ratio-box">
                      <span className="ratio-lbl">w/c Ratio</span>
                      <strong className={`ratio-val ${wcVal && wcVal > 0.45 ? 'warn' : 'good'}`}>
                        {wcVal !== null ? wcVal.toFixed(3) : '—'}
                      </strong>
                    </div>

                    <div className="ratio-box">
                      <span className="ratio-lbl">w/cm (Binder)</span>
                      <strong className="ratio-val">
                        {wcmVal !== null ? wcmVal.toFixed(3) : '—'}
                      </strong>
                    </div>

                    <div className="ratio-box">
                      <span className="ratio-lbl">Total Binder</span>
                      <strong className="ratio-val">
                        {totalBinder} <small>kg/m³</small>
                      </strong>
                    </div>
                  </div>

                  {/* Visual Proportions Mini Bar */}
                  {totalMass > 0 && (
                    <div className="recipe-mini-bar-wrap">
                      <div className="recipe-mini-bar">
                        <div
                          className="seg-cement"
                          style={{ width: `${(pureCement / totalMass) * 100}%` }}
                          title={`Cement: ${pureCement} kg`}
                        />
                        {scmTotal > 0 && (
                          <div
                            className="seg-scm"
                            style={{ width: `${(scmTotal / totalMass) * 100}%` }}
                            title={`SCM: ${scmTotal} kg`}
                          />
                        )}
                        <div
                          className="seg-sand"
                          style={{ width: `${(fineAgg / totalMass) * 100}%` }}
                          title={`Sand: ${fineAgg} kg`}
                        />
                        <div
                          className="seg-coarse"
                          style={{ width: `${(coarseAgg / totalMass) * 100}%` }}
                          title={`Coarse: ${coarseAgg} kg`}
                        />
                        <div
                          className="seg-water"
                          style={{ width: `${(freeWater / totalMass) * 100}%` }}
                          title={`Water: ${freeWater} L`}
                        />
                      </div>
                      <div className="recipe-mini-bar-labels">
                        <span>Cem {pureCement}kg</span>
                        <span>Agg {totalAgg}kg</span>
                        <span>Wtr {freeWater}L</span>
                      </div>
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div className="recipe-card-footer" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="recipe-card-btn view"
                      onClick={() => onViewRecipe(recipe)}
                      title="Inspect mix proportions & batch sheet"
                    >
                      <Eye size={13} /> View Spec
                    </button>

                    {status === 'SUBMITTED_FOR_REVIEW' && (
                      <button
                        className="recipe-card-btn approve"
                        onClick={() => onApproveRecipe(recipe, activeVer?.versionNumber)}
                        title="Review and sign off"
                      >
                        <ShieldCheck size={13} /> Review
                      </button>
                    )}

                    {status === 'APPROVED' && (
                      <button
                        className="recipe-card-btn fork"
                        onClick={() => onForkVersion(recipe)}
                        title="Fork a new revision"
                      >
                        <GitBranch size={13} /> Fork v+1
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Detailed Engineering Table View */
          <div className="casting-table-container">
            <table className="casting-table recipe-data-table">
              <thead>
                <tr>
                  <th>Recipe Code</th>
                  <th>Grade</th>
                  <th>Display Name</th>
                  <th>Mix Type</th>
                  <th>Active Ver.</th>
                  <th>w/c Ratio</th>
                  <th>w/cm Ratio</th>
                  <th>Binder (kg/m³)</th>
                  <th>Target Slump</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((recipe) => {
                  const activeVer = recipe.activeVersionDetails || (recipe.versions && recipe.versions[recipe.versions.length - 1]);
                  const status = activeVer?.approvalStatus || 'DRAFT';
                  const limits = activeVer?.engineeringLimits || {};
                  const ingredients = activeVer?.ingredients || [];

                  const pureCement = ingredients
                    .filter((i) => i.category === 'CEMENT')
                    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);
                  const scmTotal = ingredients
                    .filter((i) => i.category === 'SUPPLEMENTARY_CEMENTITIOUS')
                    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);
                  const totalBinder = pureCement + scmTotal;

                  const wcVal = activeVer?.calculatedWaterCementRatio;
                  const wcmVal = activeVer?.calculatedWaterCementitiousRatio;

                  return (
                    <tr
                      key={recipe._id || recipe.recipeCode}
                      className="recipe-table-row"
                      onClick={() => onViewRecipe(recipe)}
                    >
                      <td>
                        <strong className="recipe-code-text">
                          {recipe.recipeCode}
                        </strong>
                      </td>
                      <td>
                        <span className={`recipe-grade-badge-sm ${getGradeTheme(recipe.grade)}`}>
                          {recipe.grade}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                          {recipe.displayName}
                        </div>
                        {recipe.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                            {recipe.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="recipe-table-type">
                          {activeVer?.mixType === 'RMC_PROCUREMENT' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Truck size={12} /> RMC
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Building2 size={12} /> Site Batch
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className="recipe-table-ver">v{activeVer?.versionNumber || '1.0'}</span>
                      </td>
                      <td>
                        {wcVal !== null && wcVal !== undefined ? (
                          <strong style={{ color: wcVal > 0.45 ? '#f87171' : '#2dd4bf' }}>
                            {wcVal.toFixed(3)}
                          </strong>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        {wcmVal !== null && wcmVal !== undefined ? (
                          <strong>{wcmVal.toFixed(3)}</strong>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span>{totalBinder} kg</span>
                      </td>
                      <td>
                        <span>{limits.targetSlumpMinMm || 120}-{limits.targetSlumpMaxMm || 150} mm</span>
                      </td>
                      <td>{getStatusBadge(status)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions-cell">
                          <button
                            className="btn-secondary-dark action-btn-mini"
                            onClick={() => onViewRecipe(recipe)}
                            title="View / Inspect"
                          >
                            <Eye size={12} /> View
                          </button>
                          {status === 'SUBMITTED_FOR_REVIEW' && (
                            <button
                              className="btn-primary-teal action-btn-mini approve"
                              onClick={() => onApproveRecipe(recipe, activeVer?.versionNumber)}
                              title="Sign-off"
                            >
                              <ShieldCheck size={12} /> Sign-off
                            </button>
                          )}
                          {status === 'APPROVED' && (
                            <button
                              className="btn-secondary-dark action-btn-mini"
                              onClick={() => onForkVersion(recipe)}
                              title="Fork v+1"
                            >
                              <GitBranch size={12} /> Fork
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
