import React, { useState } from 'react';
import { Plus, CheckCircle2, AlertCircle, ShieldAlert, FileCheck, ClipboardList } from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

export default function PmQualityView({ project, tasks, inspections, onRefreshInspections }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    taskId: '',
    inspectionName: '',
    inspectorName: '',
    inspectionDate: new Date().toISOString().split('T')[0],
    outcome: 'PASSED',
    defectDescription: '',
    checklistText: 'Rebar diameter and spacing verified\nCover blocks verified\nLap lengths and staggering checked\nCleanliness of formwork verified'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRecordInspection = async (e) => {
    e.preventDefault();
    if (!formData.taskId || !formData.inspectionName.trim()) return;

    try {
      setIsSubmitting(true);
      const items = formData.checklistText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map(item => ({
          item,
          passed: formData.outcome === 'PASSED',
          remarks: 'Verified on site'
        }));

      await pmApi.recordInspection(project._id, {
        taskId: formData.taskId,
        inspectionName: formData.inspectionName.trim(),
        inspectorName: formData.inspectorName.trim() || 'QA Inspector',
        inspectionDate: formData.inspectionDate,
        outcome: formData.outcome,
        defectDescription: formData.defectDescription.trim(),
        checklistItems: items
      });

      setIsOpen(false);
      onRefreshInspections();
    } catch (err) {
      alert(err.message || 'Failed to record inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pm-quality-container">
      {/* TOOLBAR */}
      <div className="pm-toolbar">
        <div>
          <h3>Quality Assurance & Inspection Records</h3>
          <p className="pm-subtext">Manage pre-pour checklists, structural inspections, defect records, and sign-offs.</p>
        </div>
        <button className="pm-btn pm-btn-primary" onClick={() => setIsOpen(true)}>
          <Plus size={16} />
          <span>Conduct Inspection</span>
        </button>
      </div>

      {/* INSPECTIONS TABLE */}
      <div className="pm-card pm-table-card">
        <div className="pm-table-scroll">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Inspection Name</th>
                <th>Activity / WBS</th>
                <th>QA Inspector</th>
                <th>Checklist Summary</th>
                <th>Outcome</th>
                <th>Defects / Rework Notes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pm-empty-td">No QA inspections recorded yet for this project.</td>
                </tr>
              ) : (
                inspections.map(i => {
                  const t = tasks.find(x => x._id === i.taskId);
                  return (
                    <tr key={i._id}>
                      <td><strong>{i.inspectionDate}</strong></td>
                      <td><span className="pm-font-medium">{i.inspectionName}</span></td>
                      <td>{t ? `${t.wbsCode} - ${t.name}` : i.taskId}</td>
                      <td>{i.inspectorName}</td>
                      <td>
                        <span className="pm-subtext-sm">
                          {i.checklistItems ? `${i.checklistItems.filter(c => c.passed).length} / ${i.checklistItems.length} Passed` : '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`pm-badge ${i.outcome === 'PASSED' ? 'pm-badge-success' : 'pm-badge-danger'}`}>
                          {i.outcome}
                        </span>
                      </td>
                      <td>{i.defectDescription || 'None (Zero Defects)'}</td>
                      <td>
                        <span className={`pm-badge ${i.status === 'RESOLVED' ? 'pm-badge-subtle' : 'pm-badge-warning'}`}>
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {isOpen && (
        <div className="pm-modal-overlay">
          <div className="pm-modal-content">
            <div className="pm-modal-header">
              <h4>Record Quality Inspection</h4>
              <button className="pm-icon-btn" onClick={() => setIsOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleRecordInspection}>
              <div className="pm-modal-body pm-form-grid">
                <div className="pm-form-group pm-col-span-2">
                  <label>Select Activity *</label>
                  <select
                    required
                    value={formData.taskId}
                    onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
                  >
                    <option value="">-- Choose Task --</option>
                    {tasks.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.wbsCode} - {t.name} {t.requiresInspection ? '★ (QA Gate Required)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pm-form-group">
                  <label>Inspection Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pre-Pouring Raft Rebar Check"
                    value={formData.inspectionName}
                    onChange={(e) => setFormData({ ...formData, inspectionName: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Inspector Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Er. Rajesh Varma (QA Lead)"
                    value={formData.inspectorName}
                    onChange={(e) => setFormData({ ...formData, inspectorName: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Inspection Date</label>
                  <input
                    type="date"
                    value={formData.inspectionDate}
                    onChange={(e) => setFormData({ ...formData, inspectionDate: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Inspection Outcome *</label>
                  <select
                    value={formData.outcome}
                    onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                  >
                    <option value="PASSED">Passed (Approved for Next Phase)</option>
                    <option value="REWORK_REQUIRED">Rework Required (Conditional)</option>
                    <option value="FAILED">Failed (Stop Work)</option>
                  </select>
                </div>

                <div className="pm-form-group pm-col-span-2">
                  <label>Checklist Items (one per line)</label>
                  <textarea
                    rows={4}
                    value={formData.checklistText}
                    onChange={(e) => setFormData({ ...formData, checklistText: e.target.value })}
                  />
                </div>

                {formData.outcome !== 'PASSED' && (
                  <div className="pm-form-group pm-col-span-2">
                    <label>Defect Description / Rework Instructions *</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Specify non-compliance, corrective action required..."
                      value={formData.defectDescription}
                      onChange={(e) => setFormData({ ...formData, defectDescription: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="pm-modal-footer">
                <button type="button" className="pm-btn pm-btn-ghost" onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="pm-btn pm-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Submit QA Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
