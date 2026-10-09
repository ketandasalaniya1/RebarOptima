import React, { useState } from 'react';

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
  const [searchTerm, setSearchTerm] = useState('');

  const grades = ['ALL', 'M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M60', 'CUSTOM'];

  const filtered = recipes.filter(r => {
    if (selectedGrade !== 'ALL' && r.grade !== selectedGrade) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const codeMatch = r.recipeCode?.toLowerCase().includes(term);
      const nameMatch = r.displayName?.toLowerCase().includes(term);
      if (!codeMatch && !nameMatch) return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="casting-badge casting-badge-completed">Approved</span>;
      case 'SUBMITTED_FOR_REVIEW':
        return <span className="casting-badge casting-badge-rebar">Under Review</span>;
      case 'REJECTED':
        return <span className="casting-badge casting-badge-danger">Rejected</span>;
      case 'SUPERSEDED':
        return <span className="casting-badge casting-badge-secondary">Superseded</span>;
      default:
        return <span className="casting-badge casting-badge-planned">Draft</span>;
    }
  };

  return (
    <div className="casting-panel">
      <div className="casting-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Concrete Mix Recipe Library</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)' }}>
            Manage engineering mix proportions, versions, and technical approvals
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="casting-btn casting-btn-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
          <button className="casting-btn casting-btn-primary" onClick={onCreateNew}>
            ➕ Create Mix Recipe
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', padding: '1rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <input
            type="text"
            className="casting-input"
            placeholder="Search by recipe code or mix name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary, #6b7280)' }}>Grade:</span>
          <select
            className="casting-select"
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            style={{ minWidth: '110px' }}
          >
            {grades.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="casting-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="casting-table">
          <thead>
            <tr>
              <th>Recipe Code</th>
              <th>Grade</th>
              <th>Display Name</th>
              <th>Mix Type</th>
              <th>Active Version</th>
              <th>w/c Ratio</th>
              <th>w/cm Ratio</th>
              <th>Approval Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #6b7280)' }}>
                  {loading ? 'Loading recipes...' : 'No mix recipes found. Click "Create Mix Recipe" to define your first mix.'}
                </td>
              </tr>
            ) : (
              filtered.map(recipe => {
                const activeVer = recipe.activeVersionDetails;
                const status = activeVer?.approvalStatus || 'DRAFT';
                const wcVal = activeVer?.calculatedWaterCementRatio;
                const wcmVal = activeVer?.calculatedWaterCementitiousRatio;

                return (
                  <tr key={recipe._id || recipe.recipeCode}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--primary, #3b82f6)' }}>
                        {recipe.recipeCode}
                      </strong>
                    </td>
                    <td>
                      <span className="casting-badge casting-badge-info">{recipe.grade}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{recipe.displayName}</div>
                      {recipe.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)' }}>
                          {recipe.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderRadius: '4px', background: activeVer?.mixType === 'RMC_PROCUREMENT' ? '#ede9fe' : '#e0f2fe', color: activeVer?.mixType === 'RMC_PROCUREMENT' ? '#6b21a8' : '#0369a1' }}>
                        {activeVer?.mixType === 'RMC_PROCUREMENT' ? '🚚 RMC' : '🏗️ Site Batch'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>v{activeVer?.versionNumber || '1.0'}</span>
                    </td>
                    <td>
                      {wcVal !== null && wcVal !== undefined ? (
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{wcVal.toFixed(3)}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>N/A</span>
                      )}
                    </td>
                    <td>
                      {wcmVal !== null && wcmVal !== undefined ? (
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{wcmVal.toFixed(3)}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>N/A</span>
                      )}
                    </td>
                    <td>{getStatusBadge(status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          className="casting-btn casting-btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => onViewRecipe(recipe)}
                        >
                          👁️ View / Edit
                        </button>

                        {status === 'SUBMITTED_FOR_REVIEW' && (
                          <button
                            className="casting-btn casting-btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#059669' }}
                            onClick={() => onApproveRecipe(recipe, activeVer?.versionNumber)}
                          >
                            ✅ Review / Approve
                          </button>
                        )}

                        {status === 'APPROVED' && (
                          <button
                            className="casting-btn casting-btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => onForkVersion(recipe)}
                          >
                            🔄 Fork v+1
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
