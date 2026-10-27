import React, { useState } from 'react';
import { Plus, Trash2, Edit2, CheckCircle2, Clock, ShieldAlert, Flag, Search, Filter } from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

export default function PmTasksView({ project, tasks, onRefreshTasks, onOpenDelayModal }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    wbsCode: '',
    durationDays: 5,
    plannedQty: 100,
    unit: 'm3',
    plannedCost: 500000,
    assignedRole: 'Site Engineer',
    priority: 'MEDIUM',
    isMilestone: false,
    requiresInspection: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || (t.wbsCode && t.wbsCode.includes(searchTerm));
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsSubmitting(true);
      await pmApi.createTask(project._id, {
        name: formData.name.trim(),
        wbsCode: formData.wbsCode.trim() || `1.${tasks.length + 1}`,
        durationDays: Number(formData.durationDays) || 1,
        plannedQty: Number(formData.plannedQty) || 0,
        unit: formData.unit,
        plannedCost: Number(formData.plannedCost) || 0,
        assignedRole: formData.assignedRole,
        priority: formData.priority,
        isMilestone: !!formData.isMilestone,
        requiresInspection: !!formData.requiresInspection
      });

      setIsCreateOpen(false);
      setFormData({
        name: '',
        wbsCode: '',
        durationDays: 5,
        plannedQty: 100,
        unit: 'm3',
        plannedCost: 500000,
        assignedRole: 'Site Engineer',
        priority: 'MEDIUM',
        isMilestone: false,
        requiresInspection: false
      });
      onRefreshTasks();
    } catch (err) {
      alert(err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await pmApi.updateTask(taskId, { status: newStatus });
      onRefreshTasks();
    } catch (err) {
      alert(err.message || 'Failed to update task status');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this activity and its dependencies?')) return;
    try {
      await pmApi.deleteTask(taskId);
      onRefreshTasks();
    } catch (err) {
      alert(err.message || 'Failed to delete task');
    }
  };

  return (
    <div className="pm-tasks-container">
      {/* HEADER & FILTERS */}
      <div className="pm-tasks-toolbar">
        <div className="pm-search-wrap">
          <Search size={16} className="pm-search-icon" />
          <input
            type="text"
            placeholder="Search by activity name or WBS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="pm-toolbar-actions">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
            <option value="UNDER_INSPECTION">Under Inspection</option>
          </select>

          <button className="pm-btn pm-btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} />
            <span>Add Activity</span>
          </button>
        </div>
      </div>

      {/* TASKS TABLE */}
      <div className="pm-card pm-table-card">
        <div className="pm-table-scroll">
          <table className="pm-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>Activity Description</th>
                <th>Assigned Role</th>
                <th>Duration</th>
                <th>Forecast Dates</th>
                <th>Float</th>
                <th>Quantities (Accepted / Planned)</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="pm-empty-td">No activities matching current filter.</td>
                </tr>
              ) : (
                filteredTasks.map(t => (
                  <tr key={t._id} className={t.isCritical ? 'pm-tr-critical' : ''}>
                    <td className="pm-font-mono">{t.wbsCode}</td>
                    <td>
                      <div className="pm-task-name-cell">
                        {t.isMilestone ? <Flag size={14} className="pm-milestone-flag" /> : null}
                        <span className="pm-font-medium">{t.name}</span>
                        {t.requiresInspection && (
                          <span className="pm-mini-tag pm-tag-qa" title="Mandatory QA Inspection Gate">QA Gate</span>
                        )}
                      </div>
                    </td>
                    <td>{t.assignedRole || 'Site Engineer'}</td>
                    <td>{t.durationDays}d</td>
                    <td>
                      <span className="pm-date-small">{t.forecastStart} → {t.forecastFinish}</span>
                    </td>
                    <td>
                      {t.isCritical ? (
                        <span className="pm-badge pm-badge-danger">0d (Critical)</span>
                      ) : (
                        <span className="pm-badge pm-badge-subtle">{t.totalFloatDays ?? 0}d</span>
                      )}
                    </td>
                    <td>
                      {t.plannedQty ? `${t.acceptedQty || 0} / ${t.plannedQty} ${t.unit}` : '—'}
                    </td>
                    <td>
                      <div className="pm-progress-inline">
                        <span>{t.progressPercentage || 0}%</span>
                        <div className="pm-progress-track">
                          <div
                            className="pm-progress-bar"
                            style={{ width: `${Math.min(100, t.progressPercentage || 0)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="pm-status-select"
                        value={t.status}
                        onChange={(e) => handleStatusChange(t._id, e.target.value)}
                      >
                        <option value="NOT_STARTED">Not Started</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="BLOCKED">Blocked</option>
                        <option value="UNDER_INSPECTION">Under Inspection</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </td>
                    <td>
                      <div className="pm-actions-cell">
                        <button
                          className="pm-icon-btn pm-btn-del"
                          title="Delete Activity"
                          onClick={() => handleDeleteTask(t._id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE TASK MODAL */}
      {isCreateOpen && (
        <div className="pm-modal-overlay">
          <div className="pm-modal-content">
            <div className="pm-modal-header">
              <h4>Create New Project Activity / Task</h4>
              <button className="pm-icon-btn" onClick={() => setIsCreateOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="pm-modal-body pm-form-grid">
                <div className="pm-form-group pm-col-span-2">
                  <label>Activity Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Raft Bottom Rebar Mat Fixing"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>WBS Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 1.3"
                    value={formData.wbsCode}
                    onChange={(e) => setFormData({ ...formData, wbsCode: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Working Duration (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Planned Quantity</label>
                  <input
                    type="number"
                    value={formData.plannedQty}
                    onChange={(e) => setFormData({ ...formData, plannedQty: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Unit of Measure</label>
                  <input
                    type="text"
                    placeholder="MT, m3, m2, etc."
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Assigned Trade / Role</label>
                  <input
                    type="text"
                    value={formData.assignedRole}
                    onChange={(e) => setFormData({ ...formData, assignedRole: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Estimated Cost (INR)</label>
                  <input
                    type="number"
                    value={formData.plannedCost}
                    onChange={(e) => setFormData({ ...formData, plannedCost: e.target.value })}
                  />
                </div>

                <div className="pm-form-group pm-col-span-2 pm-flex-checkboxes">
                  <label className="pm-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isMilestone}
                      onChange={(e) => setFormData({ ...formData, isMilestone: e.target.checked })}
                    />
                    <span>Is Key Milestone (0 duration event)</span>
                  </label>

                  <label className="pm-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.requiresInspection}
                      onChange={(e) => setFormData({ ...formData, requiresInspection: e.target.checked })}
                    />
                    <span>Requires QA Inspection before acceptance</span>
                  </label>
                </div>
              </div>

              <div className="pm-modal-footer">
                <button type="button" className="pm-btn pm-btn-ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="pm-btn pm-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
