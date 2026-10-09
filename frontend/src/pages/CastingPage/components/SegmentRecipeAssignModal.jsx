import React, { useState } from 'react';

export default function SegmentRecipeAssignModal({
  isOpen,
  onClose,
  event,
  recipes = [],
  onSaveBindings,
  onGenerateMRS
}) {
  const [bindings, setBindings] = useState(() => {
    return (event?.segments || []).map(seg => ({
      segmentId: seg.segmentId,
      segmentName: seg.segmentName,
      grade: seg.grade || 'M25',
      plannedVolumeM3: seg.plannedVolumeM3,
      recipeId: seg.recipeBinding?.recipeId || '',
      versionNumber: seg.recipeBinding?.versionNumber || '',
      appliedWastagePercent: seg.recipeBinding?.appliedWastagePercent ?? 1.5
    }));
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !event) return null;

  // Filter approved recipes only
  const approvedRecipes = recipes.filter(r => r.activeApprovedVersion);

  const handleRecipeChange = (segIdx, recipeId) => {
    const selected = approvedRecipes.find(r => r._id === recipeId);
    const updated = [...bindings];
    if (selected) {
      updated[segIdx].recipeId = selected._id;
      updated[segIdx].versionNumber = selected.activeApprovedVersion;
      updated[segIdx].grade = selected.grade;
    } else {
      updated[segIdx].recipeId = '';
      updated[segIdx].versionNumber = '';
    }
    setBindings(updated);
  };

  const handleWastageChange = (segIdx, wastage) => {
    const updated = [...bindings];
    updated[segIdx].appliedWastagePercent = Number(wastage);
    setBindings(updated);
  };

  const handleSaveOnly = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await onSaveBindings(event._id, bindings);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save recipe bindings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndGenerate = async () => {
    // Check all segments have recipes
    const missing = bindings.some(b => !b.recipeId || !b.versionNumber);
    if (missing) {
      setErrorMsg('All segments must have an assigned approved mix recipe before generating the Material Requirement Sheet');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      await onSaveBindings(event._id, bindings);
      await onGenerateMRS(event._id, 'Generated from Segment Recipe Assignment');
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate Material Requirement Sheet');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="casting-modal-overlay">
      <div className="casting-modal" style={{ maxWidth: '850px' }}>
        <div className="casting-modal-header">
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
            Assign Mix Recipes: {event.title} ({event.eventNumber})
          </h2>
          <button className="casting-modal-close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', margin: '1rem 1.5rem 0', borderRadius: '6px', fontSize: '0.9rem' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <div style={{ padding: '1.5rem' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
            Each pour segment in this event can reference its own approved concrete mix recipe. Match the member design grade with the corresponding mix design.
          </p>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '1.5rem' }}>
            <table className="casting-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Segment Name</th>
                  <th>Volume (m³)</th>
                  <th>Assigned Mix Recipe *</th>
                  <th>Recipe Grade</th>
                  <th>Version</th>
                  <th>Wastage %</th>
                </tr>
              </thead>
              <tbody>
                {bindings.map((b, idx) => {
                  const selectedRec = approvedRecipes.find(r => r._id === b.recipeId);
                  return (
                    <tr key={b.segmentId || idx}>
                      <td><strong>{b.segmentName}</strong></td>
                      <td>{b.plannedVolumeM3} m³</td>
                      <td>
                        <select
                          className="casting-select"
                          style={{ fontSize: '0.8rem', minWidth: '180px' }}
                          value={b.recipeId}
                          onChange={e => handleRecipeChange(idx, e.target.value)}
                          required
                        >
                          <option value="">-- Select Approved Recipe --</option>
                          {approvedRecipes.map(r => (
                            <option key={r._id} value={r._id}>
                              [{r.grade}] {r.recipeCode} - {r.displayName} (v{r.activeApprovedVersion})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {selectedRec ? (
                          <span className="casting-badge casting-badge-info">{selectedRec.grade}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        {b.versionNumber ? `v${b.versionNumber}` : '—'}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          className="casting-input"
                          style={{ width: '65px', fontSize: '0.8rem', padding: '0.25rem' }}
                          value={b.appliedWastagePercent}
                          onChange={e => handleWastageChange(idx, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="casting-modal-footer" style={{ padding: 0, display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="casting-btn casting-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="casting-btn casting-btn-secondary"
                onClick={handleSaveOnly}
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save Bindings Only'}
              </button>
              <button
                type="button"
                className="casting-btn casting-btn-primary"
                onClick={handleSaveAndGenerate}
                disabled={saving}
              >
                {saving ? 'Processing...' : '⚡ Save & Generate Material Sheet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
