import React, { useState } from 'react';
import { Plus, CheckCircle2, Clock, Users, Wrench, FileText, CheckSquare } from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

export default function PmDailyProgressView({ project, tasks, dprs, onRefreshDprs }) {
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [formData, setFormData] = useState({
    taskId: '',
    reportDate: new Date().toISOString().split('T')[0],
    shift: 'DAY',
    supervisorName: '',
    plannedQty: 0,
    completedQty: 0,
    acceptedQty: 0,
    unit: 'MT',
    labourCount: 12,
    actualLabourHours: 96,
    remarks: '',
    equipmentUsed: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTaskSelect = (taskId) => {
    const t = tasks.find(x => x._id === taskId);
    setFormData(prev => ({
      ...prev,
      taskId,
      unit: t?.unit || 'Units',
      plannedQty: t?.plannedQty || 0
    }));
  };

  const handleSubmitDpr = async (e) => {
    e.preventDefault();
    if (!formData.taskId) {
      alert('Please select an activity');
      return;
    }

    try {
      setIsSubmitting(true);
      await pmApi.submitDpr(project._id, {
        ...formData,
        plannedQty: Number(formData.plannedQty) || 0,
        completedQty: Number(formData.completedQty) || 0,
        acceptedQty: Number(formData.acceptedQty) || Number(formData.completedQty) || 0,
        labourCount: Number(formData.labourCount) || 1,
        actualLabourHours: Number(formData.actualLabourHours) || 8,
        equipmentUsed: formData.equipmentUsed ? formData.equipmentUsed.split(',').map(s => s.trim()) : []
      });

      setIsSubmitOpen(false);
      onRefreshDprs();
    } catch (err) {
      alert(err.message || 'Failed to submit DPR');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveDpr = async (dprId) => {
    try {
      await pmApi.approveDpr(dprId);
      onRefreshDprs();
    } catch (err) {
      alert(err.message || 'Failed to approve DPR');
    }
  };

  return (
    <div className="pm-dpr-container">
      {/* TOOLBAR */}
      <div className="pm-toolbar">
        <div>
          <h3>Daily Site Progress Reports (DPR)</h3>
          <p className="pm-subtext">Record daily quantities, labour deployed, hours, and supervisor sign-offs.</p>
        </div>
        <button className="pm-btn pm-btn-primary" onClick={() => setIsSubmitOpen(true)}>
          <Plus size={16} />
          <span>New Daily Report</span>
        </button>
      </div>

      {/* DPR TABLE */}
      <div className="pm-card pm-table-card">
        <div className="pm-table-scroll">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Date & Shift</th>
                <th>Activity / Task</th>
                <th>Supervisor</th>
                <th>Quantity Reported</th>
                <th>Accepted Qty</th>
                <th>Labour Count</th>
                <th>Hours</th>
                <th>Remarks</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {dprs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="pm-empty-td">No daily progress reports recorded yet for this project.</td>
                </tr>
              ) : (
                dprs.map(r => {
                  const t = tasks.find(x => x._id === r.taskId);
                  return (
                    <tr key={r._id}>
                      <td>
                        <strong>{r.reportDate}</strong>
                        <div className="pm-subtext-sm">{r.shift} Shift</div>
                      </td>
                      <td>
                        <span className="pm-font-medium">{t ? `${t.wbsCode} - ${t.name}` : r.taskId}</span>
                      </td>
                      <td>{r.supervisorName}</td>
                      <td>
                        <strong>{r.completedQty}</strong> {r.unit}
                      </td>
                      <td className="pm-text-success">
                        <strong>{r.acceptedQty}</strong> {r.unit}
                      </td>
                      <td>{r.labourCount} workers</td>
                      <td>{r.actualLabourHours} hrs</td>
                      <td className="pm-remarks-col">{r.remarks || '—'}</td>
                      <td>
                        <span className={`pm-badge ${r.status === 'APPROVED' ? 'pm-badge-success' : 'pm-badge-warning'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {r.status === 'SUBMITTED' ? (
                          <button
                            className="pm-btn pm-btn-sm pm-btn-primary"
                            onClick={() => handleApproveDpr(r._id)}
                          >
                            <CheckSquare size={14} />
                            <span>Approve & Credit</span>
                          </button>
                        ) : (
                          <span className="pm-text-label pm-text-sm">Verified</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUBMIT DPR MODAL */}
      {isSubmitOpen && (
        <div className="pm-modal-overlay">
          <div className="pm-modal-content">
            <div className="pm-modal-header">
              <h4>Submit Daily Progress Report (DPR)</h4>
              <button className="pm-icon-btn" onClick={() => setIsSubmitOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitDpr}>
              <div className="pm-modal-body pm-form-grid">
                <div className="pm-form-group pm-col-span-2">
                  <label>Select Activity *</label>
                  <select
                    required
                    value={formData.taskId}
                    onChange={(e) => handleTaskSelect(e.target.value)}
                  >
                    <option value="">-- Choose Task --</option>
                    {tasks.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.wbsCode} - {t.name} (Planned: {t.plannedQty || 0} {t.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pm-form-group">
                  <label>Report Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.reportDate}
                    onChange={(e) => setFormData({ ...formData, reportDate: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Shift</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                  >
                    <option value="DAY">Day Shift</option>
                    <option value="NIGHT">Night Shift</option>
                    <option value="GENERAL">General Shift</option>
                  </select>
                </div>

                <div className="pm-form-group">
                  <label>Reporting Supervisor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suresh Patel"
                    value={formData.supervisorName}
                    onChange={(e) => setFormData({ ...formData, supervisorName: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Completed Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.completedQty}
                    onChange={(e) => setFormData({
                      ...formData,
                      completedQty: e.target.value,
                      acceptedQty: e.target.value
                    })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Accepted Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.acceptedQty}
                    onChange={(e) => setFormData({ ...formData, acceptedQty: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Unit of Measure</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Labour Deployed (Headcount)</label>
                  <input
                    type="number"
                    value={formData.labourCount}
                    onChange={(e) => setFormData({ ...formData, labourCount: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Total Actual Labour Hours</label>
                  <input
                    type="number"
                    value={formData.actualLabourHours}
                    onChange={(e) => setFormData({ ...formData, actualLabourHours: e.target.value })}
                  />
                </div>

                <div className="pm-form-group pm-col-span-2">
                  <label>Equipment & Machinery Deployed</label>
                  <input
                    type="text"
                    placeholder="e.g. Tower Crane #1, Concrete Pump, Bending Machine (comma-separated)"
                    value={formData.equipmentUsed}
                    onChange={(e) => setFormData({ ...formData, equipmentUsed: e.target.value })}
                  />
                </div>

                <div className="pm-form-group pm-col-span-2">
                  <label>Supervisor Remarks / Site Conditions</label>
                  <textarea
                    rows={2}
                    placeholder="Weather, quality notes, challenges, inspection sign-off..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="pm-modal-footer">
                <button type="button" className="pm-btn pm-btn-ghost" onClick={() => setIsSubmitOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="pm-btn pm-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Daily Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
