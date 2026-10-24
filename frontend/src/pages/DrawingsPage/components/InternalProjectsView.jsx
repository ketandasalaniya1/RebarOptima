import React, { useState } from 'react';
import {
  FolderKanban,
  MapPin,
  FileText,
  Clock,
  CheckCircle2,
  Plus,
  Settings,
  X
} from 'lucide-react';

export default function InternalProjectsView({
  projects,
  onSelectProject,
  onCreateProject
}) {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    projectCode: '',
    projectName: '',
    location: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.projectCode || !formData.projectName) return;
    setSubmitting(true);
    try {
      await onCreateProject(formData);
      setShowModal(false);
      setFormData({ projectCode: '', projectName: '', location: '', description: '' });
    } catch (err) {
      alert('Error creating project: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Internal Projects Directory
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Dedicated document workspace boundaries. Every drawing belongs to an internal engineering project.
          </p>
        </div>
        <button className="dw-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> + New Internal Project
        </button>
      </div>

      {/* Projects Grid matching Screenshot 5 Panel 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {(projects || []).map((p) => (
          <div
            key={p._id}
            className="drawings-card-box"
            style={{
              cursor: 'pointer',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onClick={() => onSelectProject(p)}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                <span className="drawings-badge-tag">{p.projectCode}</span>
                <span className="dw-status-badge dw-status-approved">{p.status || 'Active'}</span>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                {p.projectName}
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                <MapPin size={14} color="#64748b" />
                <span>{p.location || 'Site Location'}</span>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-label)', margin: 0, lineHeight: 1.45, minHeight: '38px' }}>
                {p.description || 'Enterprise building and civil engineering development.'}
              </p>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-primary)' }}>
                  <FileText size={14} color="#38bdf8" /> <strong>{p.drawingCount || 0}</strong> Drawings
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b' }}>
                  <Clock size={14} /> {p.underReviewCount || 0} Review
                </span>
              </div>
              <button
                className="dw-btn-secondary"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectProject(p);
                }}
              >
                Open Register ➔
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New Project Modal */}
      {showModal && (
        <div className="dw-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dw-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dw-modal-header">
              <div className="dw-modal-title">Create Internal Engineering Project</div>
              <button className="dw-btn-secondary" style={{ padding: '0.2rem' }} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="dw-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem' }}>
                  <div className="dw-form-group">
                    <label className="dw-form-label">Project Code *</label>
                    <input
                      type="text"
                      className="dw-form-input"
                      placeholder="e.g. AH"
                      required
                      value={formData.projectCode}
                      onChange={(e) => setFormData({ ...formData, projectCode: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="dw-form-group">
                    <label className="dw-form-label">Project Name *</label>
                    <input
                      type="text"
                      className="dw-form-input"
                      placeholder="e.g. Alpha Heights Residential"
                      required
                      value={formData.projectName}
                      onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Location / Site Address</label>
                  <input
                    type="text"
                    className="dw-form-input"
                    placeholder="e.g. Sector 18 Expressway, Bangalore"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Description / Scope of Works</label>
                  <textarea
                    rows={3}
                    className="dw-form-textarea"
                    placeholder="High-rise towers, basement rebar schedules, and statutory drawings scope..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="dw-modal-footer">
                <button type="button" className="dw-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="dw-btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
