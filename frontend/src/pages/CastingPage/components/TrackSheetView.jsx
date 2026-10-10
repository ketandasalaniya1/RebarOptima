import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, CheckCircle2, AlertTriangle, Clock, Shield, Award,
  RefreshCw, Filter, Layers, CheckSquare, ChevronRight, Check, XCircle
} from 'lucide-react';
import { castingApi } from '../castingApi';

export default function TrackSheetView({ selectedProject, blocks = [], levels = {} }) {
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [trackSheetData, setTrackSheetData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sign-off Modal
  const [showSignoffModal, setShowSignoffModal] = useState(false);
  const [signoffForm, setSignoffForm] = useState({
    stageName: 'SLAB_STRIPPING_CLEARANCE',
    signoffRole: 'PROJECT_QUALITY_MANAGER',
    signedBy: 'Er. Sandeep Patel (QA Lead)',
    formworkStrippingPermitted: true,
    curingSatisfied: true,
    cubeStrengthSatisfied: true,
    comments: 'All 28-day cube strengths conform to IS 456 Table 11; curing duration completed without uncompensated interruptions.'
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pId = selectedProject?.id || selectedProject?._id;

  // Auto-select first block and level
  useEffect(() => {
    if (blocks.length > 0 && !selectedBlockId) {
      const firstB = blocks[0]._id || blocks[0].id;
      setSelectedBlockId(firstB);
      const lvls = levels[firstB] || [];
      if (lvls.length > 0) {
        setSelectedLevelId(lvls[0]._id || lvls[0].id);
      }
    }
  }, [blocks, levels]);

  useEffect(() => {
    if (pId && selectedLevelId) {
      loadTrackSheet();
    }
  }, [pId, selectedLevelId]);

  const handleBlockChange = (bId) => {
    setSelectedBlockId(bId);
    const lvls = levels[bId] || [];
    if (lvls.length > 0) {
      setSelectedLevelId(lvls[0]._id || lvls[0].id);
    } else {
      setSelectedLevelId('');
    }
  };

  const loadTrackSheet = async () => {
    if (!pId || !selectedLevelId) return;
    setLoading(true);
    try {
      const res = await castingApi.getTrackSheet(pId, selectedLevelId);
      if (res.success && res.data) {
        setTrackSheetData(res.data);
      } else {
        setTrackSheetData(null);
      }
    } catch (err) {
      console.error('Error loading track sheet:', err);
      setTrackSheetData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignoffSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        projectId: pId,
        levelId: selectedLevelId,
        stageName: signoffForm.stageName,
        signoffRole: signoffForm.signoffRole,
        signedBy: signoffForm.signedBy,
        formworkStrippingPermitted: signoffForm.formworkStrippingPermitted,
        curingSatisfied: signoffForm.curingSatisfied,
        cubeStrengthSatisfied: signoffForm.cubeStrengthSatisfied,
        comments: signoffForm.comments
      };

      const res = await castingApi.signoffTrackSheet(payload);
      if (res.success) {
        setShowSignoffModal(false);
        await loadTrackSheet();
      } else {
        setFormError(res.error || 'Failed to submit quality sign-off');
      }
    } catch (err) {
      setFormError(err.message || 'Error executing stage-gate signoff');
    } finally {
      setSubmitting(false);
    }
  };

  const currentBlockLevels = levels[selectedBlockId] || [];
  const entries = trackSheetData?.entries || [];
  const signoffs = trackSheetData?.signoffs || [];

  return (
    <div className="track-sheet-view">
      {/* Subbar Header */}
      <div className="view-subbar">
        <div className="view-subbar-left">
          <div className="view-badge amber">
            <FileSpreadsheet size={16} /> Slab Casting Track Sheet & Quality Gate
          </div>
          <span className="view-subbar-title">Structural Segment Progress & Verification Matrix</span>
        </div>
        <div className="view-subbar-actions">
          <button 
            className="casting-btn casting-btn-secondary casting-btn-sm"
            onClick={loadTrackSheet}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Sheet
          </button>
          <button 
            className="casting-btn casting-btn-primary casting-btn-sm"
            onClick={() => {
              setFormError('');
              setShowSignoffModal(true);
            }}
            disabled={!trackSheetData || entries.length === 0}
          >
            <CheckSquare size={14} /> Stage-Gate Quality Sign-Off
          </button>
        </div>
      </div>

      {/* Filter / Location Selector */}
      <div className="curing-filter-bar">
        <div className="filter-group">
          <Layers size={14} />
          <span className="filter-label">Select Block:</span>
          <select 
            value={selectedBlockId} 
            onChange={(e) => handleBlockChange(e.target.value)}
            className="filter-select"
          >
            <option value="">-- Choose Block --</option>
            {blocks.map(b => (
              <option key={b._id || b.id} value={b._id || b.id}>{b.name || b.blockName}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Select Level / Floor:</span>
          <select 
            value={selectedLevelId} 
            onChange={(e) => setSelectedLevelId(e.target.value)}
            className="filter-select"
          >
            <option value="">-- Choose Level --</option>
            {currentBlockLevels.map(l => (
              <option key={l._id || l.id} value={l._id || l.id}>{l.name || l.levelName}</option>
            ))}
          </select>
        </div>

        <div className="filter-info">
          {entries.length} Structural Elements Tracked | {signoffs.length} Quality Sign-offs Recorded
        </div>
      </div>

      {/* Track Sheet Table */}
      <div className="track-sheet-workspace">
        {loading ? (
          <div className="loading-state-pane">
            <RefreshCw size={24} className="spin" />
            <span>Compiling track sheet from Casting, Curing & Cube records...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state-pane">
            <FileSpreadsheet size={36} className="empty-icon" />
            <p>No structural elements or segments found for this level.</p>
            <span className="text-xs text-muted">
              Ensure structural members and casting events have been defined for this level.
            </span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="quality-table track-sheet-table">
              <thead>
                <tr>
                  <th>Structural Member</th>
                  <th>Segment / Zone</th>
                  <th>Planned Vol (m³)</th>
                  <th>Pour Status</th>
                  <th>Actual Pour Details</th>
                  <th>Curing Schedule & Progress</th>
                  <th>28-Day Cube Compressive Test</th>
                  <th>Quality Stage Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((item, idx) => {
                  const isPoured = item.pourStatus === 'POURED';
                  const curingDone = item.curingStatus === 'COMPLETED';
                  const cubePass = item.cubeStatus === 'ACCEPTED' || item.cubeStatus === 'VALID';

                  return (
                    <tr key={idx}>
                      <td>
                        <strong>{item.memberCode || item.memberName}</strong>
                        <div className="text-xs text-muted">{item.memberType}</div>
                      </td>
                      <td>
                        <span className="badge-tag segment-tag">{item.segmentName || 'Main Pour'}</span>
                      </td>
                      <td>
                        <strong>{Number(item.plannedVolumeM3 || 0).toFixed(3)}</strong>
                      </td>
                      <td>
                        <span className={`status-badge ${isPoured ? 'success' : 'neutral'}`}>
                          {item.pourStatus}
                        </span>
                      </td>
                      <td>
                        {item.actualPourDate ? (
                          <div>
                            <div>{new Date(item.actualPourDate).toLocaleDateString()}</div>
                            <div className="text-xs text-muted">
                              Act: <strong>{Number(item.actualVolumeM3 || 0).toFixed(3)} m³</strong>
                            </div>
                            {item.batchNumber && (
                              <div className="text-xs text-muted">Batch: {item.batchNumber}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted text-xs">Awaiting Pour</span>
                        )}
                      </td>
                      <td>
                        <div>
                          <span className={`status-badge ${curingDone ? 'success' : item.curingStatus === 'IN_PROGRESS' ? 'warning' : 'neutral'}`}>
                            {item.curingStatus || 'NOT_SCHEDULED'}
                          </span>
                        </div>
                        {item.curingDaysCompleted !== undefined && (
                          <div className="text-xs text-muted mt-1">
                            Progress: <strong>{item.curingDaysCompleted}</strong> / {item.curingTargetDays || 7} Days
                          </div>
                        )}
                      </td>
                      <td>
                        <div>
                          <span className={`status-badge ${cubePass ? 'success' : item.cubeStatus === 'INVALID' ? 'danger' : 'neutral'}`}>
                            {item.cubeStatus || 'PENDING_POUR'}
                          </span>
                        </div>
                        {item.averageMpa ? (
                          <div className="text-xs mt-1">
                            Avg: <strong>{item.averageMpa.toFixed(2)} MPa</strong>
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {isPoured && curingDone && cubePass ? (
                          <span className="status-badge success">
                            <CheckCircle2 size={12} /> CLEAR FOR STAGE-GATE
                          </span>
                        ) : isPoured ? (
                          <span className="status-badge warning">
                            <Clock size={12} /> IN QUALITY VERIFICATION
                          </span>
                        ) : (
                          <span className="status-badge neutral">
                            PRE-POUR
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Level Quality Sign-offs Log */}
        {signoffs.length > 0 && (
          <div className="cube-section mt-4">
            <div className="section-header">
              <h4>Formal Quality Stage-Gate Clearance Sign-offs for Level</h4>
              <span className="section-tag">Audit Trail Recorded</span>
            </div>
            <div className="table-responsive">
              <table className="quality-table">
                <thead>
                  <tr>
                    <th>Sign-off Date</th>
                    <th>Stage Name</th>
                    <th>Formwork Stripping Permitted</th>
                    <th>Curing Compliance</th>
                    <th>Cube Strength Compliance</th>
                    <th>Signed By / Role</th>
                    <th>Audit Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {signoffs.map((s, idx) => (
                    <tr key={idx}>
                      <td>{new Date(s.signedAt).toLocaleDateString()}</td>
                      <td><strong>{s.stageName}</strong></td>
                      <td>
                        {s.formworkStrippingPermitted ? (
                          <span className="status-badge success"><CheckCircle2 size={12} /> PERMITTED</span>
                        ) : (
                          <span className="status-badge danger"><XCircle size={12} /> RESTRICTED</span>
                        )}
                      </td>
                      <td>
                        {s.curingSatisfied ? (
                          <span className="status-badge success"><CheckCircle2 size={12} /> SATISFIED</span>
                        ) : (
                          <span className="status-badge warning">CONDITIONAL</span>
                        )}
                      </td>
                      <td>
                        {s.cubeStrengthSatisfied ? (
                          <span className="status-badge success"><CheckCircle2 size={12} /> SATISFIED</span>
                        ) : (
                          <span className="status-badge warning">PENDING</span>
                        )}
                      </td>
                      <td>
                        <div><strong>{s.signedBy}</strong></div>
                        <div className="text-xs text-muted">{s.signoffRole}</div>
                      </td>
                      <td className="text-sm">{s.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: STAGE-GATE QUALITY SIGN-OFF */}
      {showSignoffModal && (
        <div className="modal-backdrop">
          <div className="modal-content medium">
            <div className="modal-header">
              <h3>Execute Level Quality Stage-Gate Sign-off</h3>
              <button className="btn-close" onClick={() => setShowSignoffModal(false)}>×</button>
            </div>
            <form onSubmit={handleSignoffSubmit}>
              <div className="modal-body">
                {formError && <div className="alert-banner danger">{formError}</div>}

                <div className="alert-banner info">
                  <Shield size={16} />
                  <span>
                    Executing this sign-off certifies that curing durations, moisture maintenance, and 28-day cube strength results conform to IS 456 prior to formwork stripping or next-level vertical loading.
                  </span>
                </div>

                <div className="form-group">
                  <label>Stage Clearance Gate *</label>
                  <select
                    value={signoffForm.stageName}
                    onChange={(e) => setSignoffForm({ ...signoffForm, stageName: e.target.value })}
                  >
                    <option value="SLAB_STRIPPING_CLEARANCE">Slab & Beam Formwork Stripping Clearance</option>
                    <option value="POST_CURING_STAGE_GATE">Post-Curing Final Quality Handover</option>
                    <option value="NEXT_LIFT_VERTICAL_CLEARANCE">Clearance for Next Lift / Column Staging</option>
                  </select>
                </div>

                <div className="checklist-box">
                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={signoffForm.curingSatisfied}
                      onChange={(e) => setSignoffForm({ ...signoffForm, curingSatisfied: e.target.checked })}
                    />
                    <span><strong>IS 456 Cl 13.5 Curing Requirements Met:</strong> Prescribed wet curing days completed without uncompensated dry interruptions.</span>
                  </label>

                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={signoffForm.cubeStrengthSatisfied}
                      onChange={(e) => setSignoffForm({ ...signoffForm, cubeStrengthSatisfied: e.target.checked })}
                    />
                    <span><strong>IS 456 Table 11 Compressive Strength Met:</strong> 28-day sample average meets characteristic target and individual results exceed minimum threshold.</span>
                  </label>

                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={signoffForm.formworkStrippingPermitted}
                      onChange={(e) => setSignoffForm({ ...signoffForm, formworkStrippingPermitted: e.target.checked })}
                    />
                    <span><strong>Formwork Stripping Permitted:</strong> Structural concrete has developed adequate strength to carry self-weight and construction loads per IS 456 Cl 11.3.</span>
                  </label>
                </div>

                <div className="form-row-grid mt-3">
                  <div className="form-group">
                    <label>Sign-off Role</label>
                    <select
                      value={signoffForm.signoffRole}
                      onChange={(e) => setSignoffForm({ ...signoffForm, signoffRole: e.target.value })}
                    >
                      <option value="PROJECT_QUALITY_MANAGER">Project Quality Manager / QA Lead</option>
                      <option value="SENIOR_STRUCTURAL_ENGINEER">Senior Structural Engineer</option>
                      <option value="PROJECT_DIRECTOR">Project Director</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Signing In-Charge Name *</label>
                    <input
                      type="text"
                      value={signoffForm.signedBy}
                      onChange={(e) => setSignoffForm({ ...signoffForm, signedBy: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Audit Comments & Engineering Endorsement *</label>
                  <textarea
                    rows="3"
                    value={signoffForm.comments}
                    onChange={(e) => setSignoffForm({ ...signoffForm, comments: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowSignoffModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Signing...' : 'Execute Quality Sign-off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
