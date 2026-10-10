import React, { useState, useEffect } from 'react';
import { castingApi } from '../castingApi';

export default function MaterialRequirementSheetModal({
  isOpen,
  onClose,
  event,
  onRegenerateMRS
}) {
  const [activeTab, setActiveTab] = useState('consolidated');
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [mrsData, setMrsData] = useState(null);
  const [revisionsList, setRevisionsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenReason, setRegenReason] = useState('');
  const [showRegenDialog, setShowRegenDialog] = useState(false);

  useEffect(() => {
    if (isOpen && event?._id) {
      loadMRS();
    }
  }, [isOpen, event?._id, selectedRevision]);

  const loadMRS = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [mrsRes, revsRes] = await Promise.all([
        castingApi.getMRS(event._id, selectedRevision),
        castingApi.getMRSRevisions(event._id)
      ]);

      if (mrsRes.success) {
        setMrsData(mrsRes);
      }
      if (revsRes.success) {
        setRevisionsList(revsRes.data || []);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load Material Requirement Sheet');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !event) return null;

  const currentMRS = mrsData?.data;
  const isStale = mrsData?.isStale;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!currentMRS?.consolidatedTotals) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Material SKU,Material Name,Category,Total Required,Base Unit,Display Quantity,Display Unit,Inventory Status\n";

    currentMRS.consolidatedTotals.forEach(item => {
      csvContent += `"${item.materialIdentifier}","${item.name}","${item.category}",${item.totalQuantityRequired},"${item.baseUnit}",${item.displayQuantity},"${item.displayUnit}","${item.inventoryStatus}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MRS_${event.eventNumber}_R${currentMRS.revisionNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmRegenerate = async () => {
    setRegenerating(true);
    setErrorMsg('');
    try {
      await onRegenerateMRS(event._id, regenReason || 'Manual plan refresh');
      setShowRegenDialog(false);
      setRegenReason('');
      setSelectedRevision(null); // Reset to active latest
      await loadMRS();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to regenerate Material Requirement Sheet');
    } finally {
      setRegenerating(false);
    }
  };

  const getStockBadge = (status, shortage) => {
    switch (status) {
      case 'SUFFICIENT':
        return <span className="casting-badge casting-badge-completed">✓ Stock Available</span>;
      case 'SHORTAGE':
        return <span className="casting-badge casting-badge-danger">⚠️ Shortage: {shortage}</span>;
      default:
        return (
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
            ℹ️ Not Tracked in Digital Stock
          </span>
        );
    }
  };

  return (
    <div className="casting-modal-overlay">
      <div className="casting-modal" style={{ maxWidth: '1050px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="casting-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>
              Material Requirement Sheet: {event.title}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)', marginTop: '0.25rem' }}>
              Event: <strong>{event.eventNumber}</strong> | Planned Date: {event.plannedDate} | Total Volume: <strong>{event.plannedTotalVolumeM3} m³</strong>
            </div>
          </div>
          <button className="casting-modal-close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', margin: '1rem 1.5rem 0', borderRadius: '6px', fontSize: '0.9rem' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Staleness Banner */}
        {isStale && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>⚠️ Plan or Recipe Changed:</strong> The planned volumes or mix recipe bindings have been modified since this sheet was generated.
            </div>
            <button
              className="casting-btn casting-btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', background: '#d97706' }}
              onClick={() => setShowRegenDialog(true)}
            >
              🔄 Regenerate Latest Revision
            </button>
          </div>
        )}

        {/* Revision Header & Selector Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Historical Revision:</span>
            <select
              className="casting-select"
              style={{ minWidth: '180px', fontSize: '0.85rem' }}
              value={selectedRevision || currentMRS?.revisionNumber || ''}
              onChange={e => setSelectedRevision(e.target.value ? Number(e.target.value) : null)}
            >
              {revisionsList.map(rev => (
                <option key={rev.revisionNumber} value={rev.revisionNumber}>
                  Rev {rev.revisionNumber} ({rev.mrsCode}) {rev.isActive ? '★ Active' : ''}
                </option>
              ))}
            </select>
          </div>

          {currentMRS && (
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Generated by <strong>{currentMRS.generatedBy?.name}</strong> on {new Date(currentMRS.generatedAt).toLocaleString()}
              {currentMRS.changeReason && (
                <div style={{ fontStyle: 'italic', marginTop: '0.1rem' }}>"{currentMRS.changeReason}"</div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="casting-btn casting-btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handleExportCSV} disabled={!currentMRS}>
              📥 Export CSV
            </button>
            <button className="casting-btn casting-btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handlePrint} disabled={!currentMRS}>
              🖨️ Print Slip
            </button>
            <button className="casting-btn casting-btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowRegenDialog(true)}>
              ➕ New Revision
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <button
            className={`casting-btn ${activeTab === 'consolidated' ? 'casting-btn-primary' : 'casting-btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setActiveTab('consolidated')}
          >
            📦 Consolidated Bill of Materials
          </button>
          <button
            className={`casting-btn ${activeTab === 'grades' ? 'casting-btn-primary' : 'casting-btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setActiveTab('grades')}
          >
            🏷️ Grade Subtotals
          </button>
          <button
            className={`casting-btn ${activeTab === 'segments' ? 'casting-btn-primary' : 'casting-btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setActiveTab('segments')}
          >
            📋 Pour Segment Lineage
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading Material Requirement Sheet...</div>
          ) : !currentMRS ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              No Material Requirement Sheet generated yet. Click "Save & Generate Material Sheet" to compute theoretical materials.
            </div>
          ) : (
            <>
              {/* TAB 1: Consolidated Totals */}
              {activeTab === 'consolidated' && (
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table className="casting-table">
                    <thead>
                      <tr>
                        <th>Material Identifier / SKU</th>
                        <th>Material Description</th>
                        <th>Standard</th>
                        <th>Category</th>
                        <th>Total Base Quantity</th>
                        <th>Display Indent Quantity</th>
                        <th>Inventory Availability (Read-Only)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(currentMRS.consolidatedTotals || []).map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.materialIdentifier}</td>
                          <td><strong>{item.name}</strong></td>
                          <td><span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.specificationStandard}</span></td>
                          <td><span className="casting-badge casting-badge-info">{item.category}</span></td>
                          <td>{item.totalQuantityRequired} {item.baseUnit}</td>
                          <td>
                            <strong style={{ fontSize: '1rem', color: '#1e293b' }}>
                              {item.displayQuantity} {item.displayUnit}
                            </strong>
                          </td>
                          <td>{getStockBadge(item.inventoryStatus, item.shortageQuantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: Grade Subtotals */}
              {activeTab === 'grades' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {(currentMRS.gradeSubtotals || []).map((gradeGroup, gIdx) => (
                    <div key={gIdx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="casting-badge casting-badge-primary" style={{ marginRight: '0.5rem' }}>
                            Grade: {gradeGroup.grade}
                          </span>
                          <strong style={{ color: '#334155' }}>Recipe: {gradeGroup.recipeCode} (v{gradeGroup.recipeVersion})</strong>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                          Subtotal Volume: <strong>{gradeGroup.totalVolumeM3} m³</strong>
                        </div>
                      </div>

                      <table className="casting-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Material SKU</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Base Qty</th>
                            <th>Display Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gradeGroup.ingredients.map((ing, iIdx) => (
                            <tr key={iIdx}>
                              <td style={{ fontFamily: 'monospace' }}>{ing.materialIdentifier}</td>
                              <td>{ing.name}</td>
                              <td>{ing.category}</td>
                              <td>{ing.totalBaseQuantity} {ing.baseUnit}</td>
                              <td><strong>{ing.totalDisplayQuantity} {ing.displayUnit}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: Segment Lineage */}
              {activeTab === 'segments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {(currentMRS.segmentsBreakdown || []).map((seg, sIdx) => (
                    <div key={sIdx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{seg.memberName}</strong>
                          <span className="casting-badge casting-badge-info" style={{ marginLeft: '0.5rem' }}>
                            {seg.grade}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          Planned Volume: <strong>{seg.plannedVolumeM3} m³</strong> | Wastage: <strong>{seg.appliedWastagePercent}%</strong> | Recipe: {seg.recipeCode} v{seg.recipeVersion}
                        </div>
                      </div>

                      <table className="casting-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Material SKU</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Required Base Qty</th>
                            <th>Required Display Qty</th>
                            <th>Moisture Adjustment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seg.ingredients.map((ing, iIdx) => (
                            <tr key={iIdx}>
                              <td style={{ fontFamily: 'monospace' }}>{ing.materialIdentifier}</td>
                              <td>{ing.name}</td>
                              <td>{ing.category}</td>
                              <td>{ing.baseQuantity} {ing.baseUnit}</td>
                              <td><strong>{ing.displayQuantity} {ing.displayUnit}</strong></td>
                              <td>
                                {ing.moistureAdjustment?.status === 'APPLIED' ? (
                                  <span style={{ color: '#059669', fontSize: '0.75rem' }}>
                                    ✓ {ing.moistureAdjustment.notes}
                                  </span>
                                ) : ing.moistureAdjustment?.status === 'UNVERIFIED_MOISTURE_BASIS' ? (
                                  <span style={{ color: '#d97706', fontSize: '0.75rem' }}>
                                    ⚠️ {ing.moistureAdjustment.notes}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Regenerate Confirmation Dialog */}
        {showRegenDialog && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ background: '#fff', borderRadius: '8px', padding: '1.5rem', maxWidth: '500px', width: '90%' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Generate New MRS Revision</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
                This will append Revision {(revisionsList.length || 0) + 1} to the historical ledger. Previous revisions remain preserved and immutable.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label className="casting-label">Reason for Revision *</label>
                <input
                  type="text"
                  className="casting-input"
                  placeholder="e.g. Updated column pour volume / switched to summer mix"
                  value={regenReason}
                  onChange={e => setRegenReason(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="casting-btn casting-btn-secondary"
                  onClick={() => setShowRegenDialog(false)}
                  disabled={regenerating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="casting-btn casting-btn-primary"
                  onClick={handleConfirmRegenerate}
                  disabled={regenerating || !regenReason.trim()}
                >
                  {regenerating ? 'Generating...' : 'Confirm & Generate'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="casting-modal-footer">
          <button className="casting-btn casting-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
