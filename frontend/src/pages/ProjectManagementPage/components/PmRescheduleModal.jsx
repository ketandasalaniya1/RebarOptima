import React, { useState, useEffect } from 'react';
import { Calendar, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

export default function PmRescheduleModal({ isOpen, onClose, project, onRescheduled }) {
  const [newStartDate, setNewStartDate] = useState('');
  const [preview, setPreview] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (project?.plannedStart) {
      setNewStartDate(project.plannedStart);
      setPreview(null);
      setError(null);
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const handleSimulate = async () => {
    if (!newStartDate) {
      setError('Please select a valid new project start date.');
      return;
    }
    try {
      setIsSimulating(true);
      setError(null);
      const res = await pmApi.previewRescheduleStartDate(project._id, { newPlannedStart: newStartDate });
      setPreview(res.data);
    } catch (err) {
      setError(err.message || 'Failed to simulate project reschedule');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setIsApplying(true);
      setError(null);
      await pmApi.confirmRescheduleStartDate(project._id, { newPlannedStart: newStartDate });
      if (onRescheduled) onRescheduled();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to apply project reschedule');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="pm-modal-overlay">
      <div className="pm-modal-content pm-reschedule-modal">
        {/* HEADER */}
        <div className="pm-modal-header">
          <div className="pm-modal-title">
            <Calendar size={20} className="pm-text-accent" />
            <div>
              <h3>Reschedule Project Start Date</h3>
              <p className="pm-modal-subtitle">
                Automatic schedule recalculation honoring working calendar, dependencies, and preserving approved baseline commitments.
              </p>
            </div>
          </div>
          <button className="pm-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="pm-modal-body">
          {error && (
            <div className="pm-error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* CURRENT VS NEW START ROW */}
          <div className="pm-reschedule-inputs-grid">
            <div className="pm-form-group">
              <label>Current Planned Start Date</label>
              <input
                type="date"
                value={project.plannedStart}
                disabled
                className="pm-input-readonly"
              />
              <span className="pm-field-hint">Current project baseline anchor</span>
            </div>

            <div className="pm-form-group">
              <label>Current Forecast Finish</label>
              <input
                type="date"
                value={project.forecastFinish}
                disabled
                className="pm-input-readonly"
              />
              <span className="pm-field-hint">Calculated completion via CPM</span>
            </div>

            <div className="pm-form-group pm-form-group-highlight">
              <label>Select New Project Start Date *</label>
              <input
                type="date"
                value={newStartDate}
                onChange={(e) => {
                  setNewStartDate(e.target.value);
                  setPreview(null);
                }}
              />
              <span className="pm-field-hint">Shift all uncompleted downstream activities</span>
            </div>
          </div>

          <div className="pm-reschedule-action-bar">
            <button
              className="pm-btn pm-btn-secondary"
              onClick={handleSimulate}
              disabled={isSimulating || !newStartDate || newStartDate === project.plannedStart}
            >
              {isSimulating ? <RefreshCw size={14} className="pm-spin" /> : <Calendar size={14} />}
              <span>{isSimulating ? 'Simulating Schedule Impact...' : 'Simulate Schedule Impact'}</span>
            </button>
          </div>

          {/* SIMULATION PREVIEW */}
          {preview && (
            <div className="pm-reschedule-preview-box">
              <div className="pm-preview-stats-row">
                <div className="pm-preview-stat-card">
                  <span className="pm-stat-lbl">Calendar Shift</span>
                  <span className={`pm-stat-val ${preview.shiftCalendarDays > 0 ? 'pm-text-amber' : 'pm-text-success'}`}>
                    {preview.shiftCalendarDays >= 0 ? `+${preview.shiftCalendarDays} days` : `${preview.shiftCalendarDays} days`}
                  </span>
                  <span className="pm-stat-sub">({preview.shiftWorkingDays} working days)</span>
                </div>

                <div className="pm-preview-stat-card">
                  <span className="pm-stat-lbl">Revised Forecast Completion</span>
                  <span className={`pm-stat-val ${preview.newForecastFinish > project.baselineFinish ? 'pm-text-danger' : 'pm-text-success'}`}>
                    {preview.newForecastFinish}
                  </span>
                  <span className="pm-stat-sub">Baseline: {project.baselineFinish}</span>
                </div>

                <div className="pm-preview-stat-card">
                  <span className="pm-stat-lbl">Activities Re-aligned</span>
                  <span className="pm-stat-val pm-text-accent">{preview.tasksCount} Tasks</span>
                  <span className="pm-stat-sub">Durations 100% preserved</span>
                </div>
              </div>

              {/* INTEGRITY COMMITMENT GUARANTEE */}
              <div className="pm-guarantee-banner">
                <ShieldCheck size={18} className="pm-text-success" />
                <div>
                  <strong>Schedule Integrity Protection:</strong> Task durations, critical sequence dependencies, and original approved baseline dates remain strictly intact and immutable.
                </div>
              </div>

              {/* AFFECTED TASKS TABLE */}
              <div className="pm-preview-table-wrap">
                <h5>Schedule Movement Preview (First 8 Activities)</h5>
                <table className="pm-preview-table">
                  <thead>
                    <tr>
                      <th>WBS</th>
                      <th>Activity Description</th>
                      <th>Duration</th>
                      <th>Original Dates</th>
                      <th></th>
                      <th>Revised Dates</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.affectedTasks.slice(0, 8).map(t => (
                      <tr key={t.taskId}>
                        <td><code>{t.wbsCode}</code></td>
                        <td className="pm-task-name-cell">{t.taskName}</td>
                        <td><span className="pm-badge pm-badge-subtle">{t.durationDays}d</span></td>
                        <td><small>{t.originalForecastStart} → {t.originalForecastFinish}</small></td>
                        <td><ArrowRight size={12} className="pm-text-muted" /></td>
                        <td><strong className="pm-text-accent">{t.revisedForecastStart} → {t.revisedForecastFinish}</strong></td>
                        <td>
                          {t.isCritical && <span className="pm-badge pm-badge-danger">Critical</span>}
                          {t.isMilestone && <span className="pm-badge pm-badge-accent">Milestone</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="pm-modal-footer">
          <button className="pm-btn pm-btn-ghost" onClick={onClose} disabled={isApplying}>
            Cancel
          </button>
          <button
            className="pm-btn pm-btn-primary"
            onClick={handleConfirm}
            disabled={!preview || isApplying}
          >
            {isApplying ? <RefreshCw size={14} className="pm-spin" /> : <CheckCircle2 size={14} />}
            <span>{isApplying ? 'Applying Reschedule...' : 'Confirm & Apply Reschedule'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
