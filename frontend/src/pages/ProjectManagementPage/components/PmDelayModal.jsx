import React, { useState } from 'react';
import { AlertTriangle, Clock, ArrowRight, ShieldCheck, CheckCircle2, X } from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

export default function PmDelayModal({ isOpen, onClose, projectId, tasks, onDelayApplied }) {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [delayDays, setDelayDays] = useState(3);
  const [category, setCategory] = useState('MATERIAL_SHORTAGE');
  const [reason, setReason] = useState('');
  const [recoveryAction, setRecoveryAction] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handlePreviewSimulation = async () => {
    if (!selectedTaskId) {
      setError('Please select an affected task');
      return;
    }
    if (!delayDays || delayDays <= 0) {
      setError('Delay days must be at least 1');
      return;
    }

    try {
      setError(null);
      setIsSimulating(true);
      const res = await pmApi.previewDelay(projectId, {
        taskId: selectedTaskId,
        delayDays: Number(delayDays)
      });
      if (res?.data) {
        setSimulation(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to simulate delay');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApplyReschedule = async () => {
    if (!reason.trim()) {
      setError('Please provide a delay reason / explanation for the audit record');
      return;
    }

    try {
      setError(null);
      setIsApplying(true);
      await pmApi.recordDelay(projectId, {
        taskId: selectedTaskId,
        delayDays: Number(delayDays),
        category,
        reason: reason.trim(),
        recoveryAction: recoveryAction.trim(),
        delayStartDate: new Date().toISOString().split('T')[0]
      });

      onDelayApplied();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to apply schedule update');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="pm-modal-overlay">
      <div className="pm-modal-content pm-delay-modal">
        <div className="pm-modal-header">
          <div className="pm-modal-title">
            <Clock size={20} className="pm-text-warning" />
            <span>Record Delay & Downstream CPM Rescheduling</span>
          </div>
          <button className="pm-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="pm-modal-body">
          {error && <div className="pm-error-banner">{error}</div>}

          <div className="pm-form-grid">
            <div className="pm-form-group">
              <label>Affected Task *</label>
              <select
                value={selectedTaskId}
                onChange={(e) => {
                  setSelectedTaskId(e.target.value);
                  setSimulation(null);
                }}
              >
                <option value="">-- Select Task --</option>
                {tasks.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.wbsCode} - {t.name} {t.isCritical ? '🔴 (Critical)' : `(Float: ${t.totalFloatDays ?? 0}d)`}
                  </option>
                ))}
              </select>
            </div>

            <div className="pm-form-group">
              <label>Delay Duration (Working Days) *</label>
              <input
                type="number"
                min="1"
                max="180"
                value={delayDays}
                onChange={(e) => {
                  setDelayDays(e.target.value);
                  setSimulation(null);
                }}
              />
            </div>

            <div className="pm-form-group">
              <label>Delay Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="MATERIAL_SHORTAGE">Material Shortage / Delivery Slip</option>
                <option value="LABOUR_SHORTAGE">Labour Shortage / Subcontractor Absenteeism</option>
                <option value="EQUIPMENT_FAILURE">Equipment / Crane Breakdown</option>
                <option value="WEATHER">Inclement Weather / Flooding</option>
                <option value="DESIGN_CLARIFICATION">RFI / Design Clarification Delay</option>
                <option value="QUALITY_REWORK">Quality Rejection / Rework</option>
                <option value="SITE_ACCESS">Site Access / Civil Blocker</option>
                <option value="CLIENT_APPROVAL">Consultant / Authority Approval</option>
                <option value="OTHER">Other Reason</option>
              </select>
            </div>

            <div className="pm-form-group">
              <label>Delay Explanation & Root Cause *</label>
              <textarea
                placeholder="State the root cause and why the activity cannot proceed on original schedule..."
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="pm-form-group pm-col-span-2">
              <label>Mitigation & Recovery Action Plan</label>
              <input
                type="text"
                placeholder="e.g. Deploy 2nd shift of steel fixers, overlap MEP rough-in by 2 days..."
                value={recoveryAction}
                onChange={(e) => setRecoveryAction(e.target.value)}
              />
            </div>
          </div>

          <div className="pm-modal-actions-row">
            <button
              className="pm-btn pm-btn-secondary"
              onClick={handlePreviewSimulation}
              disabled={isSimulating || !selectedTaskId}
            >
              <Clock size={16} />
              {isSimulating ? 'Simulating CPM...' : 'Preview Downstream Impact'}
            </button>
          </div>

          {/* SIMULATION RESULT PREVIEW CARD */}
          {simulation && (
            <div className="pm-simulation-card">
              <div className="pm-simulation-header">
                <AlertTriangle size={18} className={simulation.projectDelayDays > 0 ? 'pm-text-danger' : 'pm-text-warning'} />
                <h4>CPM Downstream Impact Preview</h4>
              </div>

              <div className="pm-simulation-stats">
                <div className="pm-stat-box">
                  <span className="pm-stat-lbl">Project Completion Slip</span>
                  <span className={`pm-stat-val ${simulation.projectDelayDays > 0 ? 'pm-text-danger' : 'pm-text-success'}`}>
                    {simulation.projectDelayDays > 0 ? `+${simulation.projectDelayDays} Days Slip` : '0 Days (Absorbed by Float)'}
                  </span>
                </div>
                <div className="pm-stat-box">
                  <span className="pm-stat-lbl">Original Project Finish</span>
                  <span className="pm-stat-val">{simulation.originalProjectForecastFinish}</span>
                </div>
                <div className="pm-stat-box">
                  <span className="pm-stat-lbl">Revised Project Finish</span>
                  <span className="pm-stat-val pm-text-warning">{simulation.revisedProjectForecastFinish}</span>
                </div>
                <div className="pm-stat-box">
                  <span className="pm-stat-lbl">Downstream Tasks Shifted</span>
                  <span className="pm-stat-val">{simulation.tasksAffectedCount} Activities</span>
                </div>
              </div>

              {simulation.affectedTasks.length > 0 && (
                <div className="pm-affected-tasks-table">
                  <h5>Affected Downstream Tasks:</h5>
                  <div className="pm-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Task Name</th>
                          <th>Original Finish</th>
                          <th>Revised Finish</th>
                          <th>Slip</th>
                          <th>Float Consumed</th>
                          <th>Critical Path Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simulation.affectedTasks.map((t, idx) => (
                          <tr key={idx}>
                            <td className="pm-font-medium">{t.taskName}</td>
                            <td>{t.originalForecastFinish}</td>
                            <td className="pm-text-warning">{t.revisedForecastFinish}</td>
                            <td>+{t.slipDays}d</td>
                            <td>{t.floatConsumedDays}d</td>
                            <td>
                              {t.becameCritical ? (
                                <span className="pm-badge pm-badge-danger">Became Critical</span>
                              ) : (
                                <span className="pm-badge pm-badge-subtle">Absorbed Float</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pm-baseline-notice">
                <ShieldCheck size={16} />
                <span>
                  <strong>Baseline Protection:</strong> The approved contractual baseline will remain intact. Only the dynamic forecast schedule and affected dependencies will shift.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="pm-modal-footer">
          <button className="pm-btn pm-btn-ghost" onClick={onClose} disabled={isApplying}>
            Cancel
          </button>
          <button
            className="pm-btn pm-btn-danger"
            onClick={handleApplyReschedule}
            disabled={!simulation || isApplying}
          >
            <CheckCircle2 size={16} />
            {isApplying ? 'Applying Schedule Changes...' : 'Authorize & Apply Rescheduling'}
          </button>
        </div>
      </div>
    </div>
  );
}
