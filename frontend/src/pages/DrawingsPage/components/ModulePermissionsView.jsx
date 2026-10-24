import React, { useState } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Mail,
  X
} from 'lucide-react';

export default function ModulePermissionsView({
  users,
  disciplines,
  onCreateUser
}) {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    userName: '',
    userEmail: '',
    role: 'reviewer',
    assignedDisciplines: []
  });
  const [submitting, setSubmitting] = useState(false);

  const ROLES_INFO = [
    { role: 'admin', label: 'Module Administrator', desc: 'Full configuration, numbering rules, user assignment and audit oversight.' },
    { role: 'controller', label: 'Document Controller', desc: 'Drawing register administration, transmittal issuance, and publication.' },
    { role: 'uploader', label: 'Drawing Uploader', desc: 'Upload drafts and submit revisions with change descriptions.' },
    { role: 'reviewer', label: 'Reviewer', desc: 'Examine assigned drawings, record review remarks and verify compliance.' },
    { role: 'approver', label: 'Approver', desc: 'Authoritative decision-maker for formal approval or change requests.' },
    { role: 'readonly', label: 'Read-Only User', desc: 'Search, view, and download authorized published drawings.' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userName || !formData.userEmail) return;
    setSubmitting(true);
    try {
      await onCreateUser(formData);
      setShowModal(false);
      setFormData({ userName: '', userEmail: '', role: 'reviewer', assignedDisciplines: [] });
    } catch (err) {
      alert('Error creating user: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Top Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Module Users &amp; Permissions (RBAC)
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Strict role-based access control. Backend enforced security across all drawing actions.
          </p>
        </div>

        <button className="dw-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> + Add Module User
        </button>
      </div>

      {/* ── Role Definition Cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
        {ROLES_INFO.map((r) => (
          <div
            key={r.role}
            style={{
              background: 'var(--card-bg, #111a2e)',
              border: '1px solid var(--card-border, #1e293b)',
              borderRadius: '8px',
              padding: '0.85rem 1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
              <Shield size={16} color="#38bdf8" />
              <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{r.label}</strong>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {r.desc}
            </p>
          </div>
        ))}
      </div>

      {/* ── Active Memberships Table ─────────────────────────────────────── */}
      <div className="drawings-table-container">
        <table className="drawings-table">
          <thead>
            <tr>
              <th>User Name</th>
              <th>Email</th>
              <th>Assigned Module Role</th>
              <th>Status</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {(!users || users.length === 0) ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No module-specific users registered yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u._id || u.userEmail}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#38bdf8'
                        }}
                      >
                        {u.userName?.charAt(0) || 'U'}
                      </div>
                      <strong>{u.userName}</strong>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{u.userEmail}</td>
                  <td>
                    <span className="drawings-badge-tag">
                      {u.role?.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className="dw-status-badge dw-status-approved">
                      {u.status || 'Active'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>
                    {new Date(u.createdAt || Date.now()).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── + Add User Modal ────────────────────────────────────────────── */}
      {showModal && (
        <div className="dw-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dw-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dw-modal-header">
              <div className="dw-modal-title">Assign Module User Permission</div>
              <button className="dw-btn-secondary" style={{ padding: '0.2rem' }} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="dw-modal-body">
                <div className="dw-form-group">
                  <label className="dw-form-label">Full Name *</label>
                  <input
                    type="text"
                    className="dw-form-input"
                    placeholder="e.g. Priya Mehta"
                    required
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  />
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Work Email *</label>
                  <input
                    type="email"
                    className="dw-form-input"
                    placeholder="e.g. priya.mehta@rebaroptima.com"
                    required
                    value={formData.userEmail}
                    onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                  />
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Module Role *</label>
                  <select
                    className="dw-form-select"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="admin">Module Administrator</option>
                    <option value="controller">Document Controller</option>
                    <option value="approver">Approver</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="uploader">Drawing Uploader</option>
                    <option value="readonly">Read-Only User</option>
                  </select>
                </div>
              </div>

              <div className="dw-modal-footer">
                <button type="button" className="dw-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="dw-btn-primary" disabled={submitting}>
                  {submitting ? 'Assigning...' : 'Assign Permission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
