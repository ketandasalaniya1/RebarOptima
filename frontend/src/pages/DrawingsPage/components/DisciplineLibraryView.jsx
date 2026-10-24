import React, { useState } from 'react';
import {
  Layers,
  FileText,
  Plus,
  Palette,
  Check,
  X
} from 'lucide-react';

export default function DisciplineLibraryView({
  disciplines,
  onSelectDiscipline,
  onCreateDiscipline
}) {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    color: '#3b82f6',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const PRESET_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#64748b', '#ef4444'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name) return;
    setSubmitting(true);
    try {
      await onCreateDiscipline(formData);
      setShowModal(false);
      setFormData({ code: '', name: '', color: '#3b82f6', description: '' });
    } catch (err) {
      alert('Error creating discipline: ' + err.message);
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
            Discipline Library &amp; Classification
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Standard hierarchy: Internal Project → Discipline → Drawing → Revision.
          </p>
        </div>
        <button className="dw-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> + Configure Discipline
        </button>
      </div>

      {/* Discipline Folder Grid matching Screenshot 1 & 5 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {(disciplines || []).map((disc) => (
          <div
            key={disc._id || disc.code}
            className="drawings-card-box"
            style={{
              cursor: 'pointer',
              borderLeft: `4px solid ${disc.color || '#3b82f6'}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'transform 0.15s ease'
            }}
            onClick={() => onSelectDiscipline(disc)}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: `${disc.color || '#3b82f6'}22`,
                    color: disc.color || '#38bdf8'
                  }}
                >
                  {disc.code}
                </span>
                {disc.isDefault && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-label)' }}>Standard</span>
                )}
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                {disc.name}
              </h3>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-label)', margin: 0, lineHeight: 1.4 }}>
                {disc.description || `${disc.name} engineering drawings, revisions, and site transmittals.`}
              </p>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-primary)' }}>
                <FileText size={15} color={disc.color || '#38bdf8'} />
                <strong>{disc.drawingCount || 0}</strong> Registered Drawings
              </span>
              <button
                className="dw-btn-secondary"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDiscipline(disc);
                }}
              >
                Browse ➔
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Configure Discipline Modal */}
      {showModal && (
        <div className="dw-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dw-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dw-modal-header">
              <div className="dw-modal-title">Configure New Discipline</div>
              <button className="dw-btn-secondary" style={{ padding: '0.2rem' }} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="dw-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem' }}>
                  <div className="dw-form-group">
                    <label className="dw-form-label">Code *</label>
                    <input
                      type="text"
                      className="dw-form-input"
                      placeholder="e.g. ELEC"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="dw-form-group">
                    <label className="dw-form-label">Discipline Name *</label>
                    <input
                      type="text"
                      className="dw-form-input"
                      placeholder="e.g. Electrical Engineering"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Color Accent</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {PRESET_COLORS.map((c) => (
                      <div
                        key={c}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: c,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: formData.color === c ? '2px solid #ffffff' : 'none'
                        }}
                        onClick={() => setFormData({ ...formData, color: c })}
                      >
                        {formData.color === c && <Check size={14} color="#ffffff" />}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Description / Scope</label>
                  <textarea
                    rows={2}
                    className="dw-form-textarea"
                    placeholder="Electrical distribution layouts, transformer yards, LT panels..."
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
                  {submitting ? 'Saving...' : 'Add Discipline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
