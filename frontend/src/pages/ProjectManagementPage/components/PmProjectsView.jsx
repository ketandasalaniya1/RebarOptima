import React, { useState } from 'react';
import { Plus, Building2, MapPin, Calendar, Clock, DollarSign, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

export default function PmProjectsView({ projects, selectedProjectId, onSelectProject, onRefreshProjects }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    location: '',
    projectManager: '',
    plannedStart: new Date().toISOString().split('T')[0],
    approvedBudget: 50000000,
    workingDaysPerWeek: 6
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await pmApi.createProject({
        name: formData.name.trim(),
        code: formData.code.trim() || `PRJ-${Date.now().toString().slice(-4)}`,
        description: formData.description.trim(),
        location: formData.location.trim(),
        projectManager: formData.projectManager.trim() || 'Project Manager',
        plannedStart: formData.plannedStart,
        approvedBudget: Number(formData.approvedBudget) || 0,
        calendar: {
          workingDaysPerWeek: Number(formData.workingDaysPerWeek) || 6,
          workingHoursPerDay: 8,
          holidays: []
        }
      });

      setIsCreateOpen(false);
      onRefreshProjects();
      if (res?.data?._id) {
        onSelectProject(res.data._id);
      }
    } catch (err) {
      alert(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pm-projects-container">
      {/* TOOLBAR */}
      <div className="pm-toolbar">
        <div>
          <h3>Enterprise Construction Projects</h3>
          <p className="pm-subtext">Manage active site projects, baseline commitments, and forecast schedules.</p>
        </div>
        <button className="pm-btn pm-btn-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          <span>New Project</span>
        </button>
      </div>

      {/* PROJECTS GRID */}
      <div className="pm-projects-grid">
        {projects.map(p => {
          const isSelected = p._id === selectedProjectId;
          const isDelayed = p.forecastFinish > p.baselineFinish && p.isBaselineLocked;

          return (
            <div
              key={p._id}
              className={`pm-project-card ${isSelected ? 'pm-card-active' : ''}`}
              onClick={() => onSelectProject(p._id)}
            >
              <div className="pm-project-card-top">
                <span className="pm-p-code-tag">{p.code}</span>
                <span className={`pm-badge ${p.status === 'ACTIVE' ? 'pm-badge-success' : isDelayed ? 'pm-badge-danger' : 'pm-badge-subtle'}`}>
                  {isDelayed ? 'DELAYED' : p.status}
                </span>
              </div>

              <h4 className="pm-p-name">{p.name}</h4>
              <p className="pm-p-desc">{p.description || 'No description provided.'}</p>

              <div className="pm-p-meta">
                <div className="pm-meta-line">
                  <MapPin size={14} className="pm-text-label" />
                  <span>{p.location || 'Site Location Unspecified'}</span>
                </div>
                <div className="pm-meta-line">
                  <Calendar size={14} className="pm-text-label" />
                  <span>Start: <strong>{p.plannedStart}</strong></span>
                </div>
                <div className="pm-meta-line">
                  <Clock size={14} className="pm-text-label" />
                  <span>Forecast Finish: <strong className={isDelayed ? 'pm-text-danger' : 'pm-text-success'}>{p.forecastFinish}</strong></span>
                </div>
                <div className="pm-meta-line">
                  <DollarSign size={14} className="pm-text-label" />
                  <span>Budget: <strong>₹{((p.approvedBudget || 0) / 10000000).toFixed(2)} Cr</strong></span>
                </div>
              </div>

              {/* PROGRESS BAR */}
              <div className="pm-card-progress-section">
                <div className="pm-prog-text-row">
                  <span>Progress</span>
                  <span className="pm-font-bold">{p.progressPercentage || 0}%</span>
                </div>
                <div className="pm-progress-track">
                  <div
                    className="pm-progress-bar"
                    style={{ width: `${Math.min(100, p.progressPercentage || 0)}%` }}
                  />
                </div>
              </div>

              <div className="pm-card-footer-action">
                <button className="pm-btn pm-btn-sm pm-btn-secondary pm-w-full">
                  {isSelected ? 'Currently Selected' : 'Open Project Workspace'}
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE PROJECT MODAL */}
      {isCreateOpen && (
        <div className="pm-modal-overlay">
          <div className="pm-modal-content">
            <div className="pm-modal-header">
              <h4>Create New Construction Project</h4>
              <button className="pm-icon-btn" onClick={() => setIsCreateOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="pm-modal-body pm-form-grid">
                <div className="pm-form-group pm-col-span-2">
                  <label>Project Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prestige Falcon Tower — Substructure & Frame"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Project Code</label>
                  <input
                    type="text"
                    placeholder="e.g. PRJ-TOW-02"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Project Manager / Lead Engineer</label>
                  <input
                    type="text"
                    placeholder="e.g. Er. Rajesh Varma"
                    value={formData.projectManager}
                    onChange={(e) => setFormData({ ...formData, projectManager: e.target.value })}
                  />
                </div>

                <div className="pm-form-group pm-col-span-2">
                  <label>Site Location & Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Sector 128, Expressway Corridor"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Planned Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.plannedStart}
                    onChange={(e) => setFormData({ ...formData, plannedStart: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Approved Budget (INR)</label>
                  <input
                    type="number"
                    value={formData.approvedBudget}
                    onChange={(e) => setFormData({ ...formData, approvedBudget: e.target.value })}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Work Week Schedule</label>
                  <select
                    value={formData.workingDaysPerWeek}
                    onChange={(e) => setFormData({ ...formData, workingDaysPerWeek: e.target.value })}
                  >
                    <option value={6}>6 Days / Week (Mon - Sat) — Construction Standard</option>
                    <option value={5}>5 Days / Week (Mon - Fri)</option>
                    <option value={7}>7 Days / Week (Continuous Shift)</option>
                  </select>
                </div>

                <div className="pm-form-group pm-col-span-2">
                  <label>Scope Description</label>
                  <textarea
                    rows={2}
                    placeholder="Detailed scope, structural concrete grade, milestones..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="pm-modal-footer">
                <button type="button" className="pm-btn pm-btn-ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="pm-btn pm-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating Project...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
