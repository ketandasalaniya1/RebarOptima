import React, { useState } from 'react';
import { Plus, DollarSign, TrendingUp, AlertTriangle, Layers, Calendar, CheckCircle2 } from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

export default function PmCostProductivityView({ project, tasks, costs, onRefreshCosts }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    taskId: '',
    category: 'MATERIAL',
    description: '',
    plannedAmount: 0,
    actualAmount: 0,
    date: new Date().toISOString().split('T')[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPlanned = costs.reduce((sum, c) => sum + (c.plannedAmount || 0), 0) || (project?.approvedBudget || 0);
  const totalActual = costs.reduce((sum, c) => sum + (c.actualAmount || 0), 0);
  const costVariance = totalPlanned - totalActual;

  const handleAddCost = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) return;

    try {
      setIsSubmitting(true);
      await pmApi.addCost(project._id, {
        taskId: formData.taskId || undefined,
        category: formData.category,
        description: formData.description.trim(),
        plannedAmount: Number(formData.plannedAmount) || 0,
        actualAmount: Number(formData.actualAmount) || 0,
        date: formData.date
      });

      setIsOpen(false);
      onRefreshCosts();
    } catch (err) {
      alert(err.message || 'Failed to record cost entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pm-cost-container">
      {/* SUMMARY KPI CARDS */}
      <div className="pm-kpi-grid">
        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-purple">
            <DollarSign size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Approved Budget</span>
            <span className="pm-kpi-value">₹{(totalPlanned / 10000000).toFixed(2)} Cr</span>
            <span className="pm-kpi-sub">Baseline budget allocation</span>
          </div>
        </div>

        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-blue">
            <TrendingUp size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Actual Cumulative Spend</span>
            <span className="pm-kpi-value">₹{(totalActual / 10000000).toFixed(2)} Cr</span>
            <span className="pm-kpi-sub">
              {totalPlanned > 0 ? `${Math.round((totalActual / totalPlanned) * 100)}% of budget utilized` : '0%'}
            </span>
          </div>
        </div>

        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-emerald">
            <CheckCircle2 size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Cost Variance</span>
            <span className={`pm-kpi-value ${costVariance >= 0 ? 'pm-text-success' : 'pm-text-danger'}`}>
              {costVariance >= 0 ? `+₹${(costVariance / 100000).toFixed(1)}L Under` : `-₹${(Math.abs(costVariance) / 100000).toFixed(1)}L Over`}
            </span>
            <span className="pm-kpi-sub">Favorable cost efficiency</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="pm-toolbar">
        <div>
          <h3>Project Financial Entries & Procurement</h3>
          <p className="pm-subtext">Record planned versus actual commercial expenses against construction activities.</p>
        </div>
        <button className="pm-btn pm-btn-primary" onClick={() => setIsOpen(true)}>
          <Plus size={16} />
          <span>Add Cost Entry</span>
        </button>
      </div>

      {/* COST ENTRIES TABLE */}
      <div className="pm-card pm-table-card">
        <div className="pm-table-scroll">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Expense Description</th>
                <th>Related Activity</th>
                <th>Planned Budget</th>
                <th>Actual Spent</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {costs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="pm-empty-td">No financial entries recorded yet for this project.</td>
                </tr>
              ) : (
                costs.map(c => {
                  const t = tasks.find(x => x._id === c.taskId);
                  const variance = (c.plannedAmount || 0) - (c.actualAmount || 0);

                  return (
                    <tr key={c._id}>
                      <td><strong>{c.date}</strong></td>
                      <td>
                        <span className="pm-badge pm-badge-subtle">{c.category}</span>
                      </td>
                      <td className="pm-font-medium">{c.description}</td>
                      <td>{t ? `${t.wbsCode} - ${t.name}` : 'Project Overall'}</td>
                      <td>₹{(c.plannedAmount || 0).toLocaleString()}</td>
                      <td><strong>₹{(c.actualAmount || 0).toLocaleString()}</strong></td>
                      <td className={variance >= 0 ? 'pm-text-success' : 'pm-text-danger'}>
                        {variance >= 0 ? `+₹${variance.toLocaleString()}` : `-₹${Math.abs(variance).toLocaleString()}`}
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
              <h4>Add Project Cost Entry</h4>
              <button className="pm-icon-btn" onClick={() => setIsOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddCost}>
              <div className="pm-modal-body pm-form-grid">
                <div className="pm-form-group">
                  <label>Cost Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="MATERIAL">Raw Material (Rebar, Concrete, Cement)</option>
                    <option value="LABOUR">Direct Site Labour Contract</option>
                    <option value="EQUIPMENT">Machinery & Plant (Crane, Pump)</option>
                    <option value="SUBCONTRACTOR">Subcontractor Package</option>
                    <option value="OVERHEAD">Site Overhead / Testing</option>
                  </select>
                </div>

                <div className="pm-form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="pm-form-group pm-col-span-2">
                  <label>Expense Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50 MT TMT Rebar delivery bill #4190"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Planned Allocation (INR)</label>
                  <input
                    type="number"
                    value={formData.plannedAmount}
                    onChange={(e) => setFormData({ ...formData, plannedAmount: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Actual Invoiced Amount (INR) *</label>
                  <input
                    type="number"
                    required
                    value={formData.actualAmount}
                    onChange={(e) => setFormData({ ...formData, actualAmount: e.target.value })}
                  />
                </div>

                <div className="pm-form-group pm-col-span-2">
                  <label>Link to Activity (Optional)</label>
                  <select
                    value={formData.taskId}
                    onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
                  >
                    <option value="">-- General Project Cost --</option>
                    {tasks.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.wbsCode} - {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pm-modal-footer">
                <button type="button" className="pm-btn pm-btn-ghost" onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="pm-btn pm-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Save Cost Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
