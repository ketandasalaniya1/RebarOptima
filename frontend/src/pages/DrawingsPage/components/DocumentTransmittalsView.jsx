import React, { useState } from 'react';
import {
  Send,
  Printer,
  Plus,
  FileText,
  Calendar,
  Users,
  CheckCircle2,
  X
} from 'lucide-react';

export default function DocumentTransmittalsView({
  transmittals,
  projects,
  availableDrawings,
  preselectedDrawingIds = [],
  onCreateTransmittal
}) {
  const [showIssueModal, setShowIssueModal] = useState(preselectedDrawingIds.length > 0);
  const [selectedSlip, setSelectedSlip] = useState(null);

  const [formData, setFormData] = useState({
    projectId: projects[0]?._id || '',
    transmittalNumber: `TR-${new Date().getFullYear()}-010`,
    purpose: 'For Construction',
    issueDate: new Date().toISOString().split('T')[0],
    recipientsText: 'Site Team (Contractor), Project Manager (PMO)',
    selectedDrawingIds: preselectedDrawingIds.length > 0 ? preselectedDrawingIds : (availableDrawings?.slice(0, 3).map(d => d._id) || []),
    notes: 'Issued drawings for ground floor structural execution and perimeter works.'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleToggleDrawing = (id) => {
    if (formData.selectedDrawingIds.includes(id)) {
      setFormData({
        ...formData,
        selectedDrawingIds: formData.selectedDrawingIds.filter(i => i !== id)
      });
    } else {
      setFormData({
        ...formData,
        selectedDrawingIds: [...formData.selectedDrawingIds, id]
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.projectId || formData.selectedDrawingIds.length === 0) {
      alert('Please select a project and at least one drawing.');
      return;
    }
    setSubmitting(true);
    try {
      const selectedDrawings = (availableDrawings || []).filter(d => formData.selectedDrawingIds.includes(d._id));
      const recipients = formData.recipientsText.split(',').map(r => ({
        name: r.trim(),
        organization: 'Project Team',
        role: 'Recipient'
      }));

      const payload = {
        projectId: formData.projectId,
        transmittalNumber: formData.transmittalNumber,
        purpose: formData.purpose,
        issueDate: formData.issueDate,
        recipients,
        notes: formData.notes,
        items: selectedDrawings.map(d => ({
          drawingId: d._id,
          drawingNumber: d.drawingNumber,
          title: d.title,
          revisionNumber: d.currentRevisionNumber || 'R00',
          status: d.currentStatus || 'Approved'
        }))
      };

      await onCreateTransmittal(payload);
      setShowIssueModal(false);
    } catch (err) {
      alert('Error creating transmittal: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Top Header Bar ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Document Transmittals
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Formal traceable issue records. Exact revision numbers are locked at time of transmittal issue.
          </p>
        </div>

        <button className="dw-btn-primary" onClick={() => setShowIssueModal(true)}>
          <Plus size={15} /> + Issue Transmittal
        </button>
      </div>

      {/* ── Transmittals Table (Screenshot 5 Panel 7) ────────────────────── */}
      <div className="drawings-table-container">
        <table className="drawings-table">
          <thead>
            <tr>
              <th>Transmittal No.</th>
              <th>Project</th>
              <th>Purpose</th>
              <th>Issue Date</th>
              <th>Issued By</th>
              <th>Recipients</th>
              <th>Items</th>
              <th style={{ textAlign: 'right' }}>Slip</th>
            </tr>
          </thead>
          <tbody>
            {(!transmittals || transmittals.length === 0) ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  No transmittals issued yet. Click "+ Issue Transmittal" to create the first record.
                </td>
              </tr>
            ) : (
              transmittals.map((t) => (
                <tr key={t._id} onClick={() => setSelectedSlip(t)}>
                  <td>
                    <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>
                      {t.transmittalNumber}
                    </strong>
                  </td>
                  <td>{t.projectName}</td>
                  <td>
                    <span className="dw-status-badge dw-status-under-review">
                      {t.purpose}
                    </span>
                  </td>
                  <td>{t.issueDate}</td>
                  <td>{t.issuedByName}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {t.recipients?.map((r) => r.name).join(', ')}
                  </td>
                  <td>
                    <span className="dw-rev-badge">
                      {t.items?.length || 0} Drawings
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="dw-btn-secondary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSlip(t);
                      }}
                    >
                      <Printer size={13} /> View Slip
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Issue Transmittal Dialog matching Screenshot 5 Panel 7 ──────── */}
      {showIssueModal && (
        <div className="dw-modal-overlay" onClick={() => setShowIssueModal(false)}>
          <div className="dw-modal-card large" onClick={(e) => e.stopPropagation()}>
            <div className="dw-modal-header">
              <div className="dw-modal-title">Issue Transmittal / Formal Document Release</div>
              <button className="dw-btn-secondary" style={{ padding: '0.2rem' }} onClick={() => setShowIssueModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="dw-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div className="dw-form-group">
                    <label className="dw-form-label">Project *</label>
                    <select
                      className="dw-form-select"
                      required
                      value={formData.projectId}
                      onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    >
                      {(projects || []).map(p => (
                        <option key={p._id} value={p._id}>{p.projectName} ({p.projectCode})</option>
                      ))}
                    </select>
                  </div>

                  <div className="dw-form-group">
                    <label className="dw-form-label">Transmittal Number *</label>
                    <input
                      type="text"
                      className="dw-form-input"
                      required
                      value={formData.transmittalNumber}
                      onChange={(e) => setFormData({ ...formData, transmittalNumber: e.target.value })}
                    />
                  </div>

                  <div className="dw-form-group">
                    <label className="dw-form-label">Purpose *</label>
                    <select
                      className="dw-form-select"
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    >
                      <option value="For Construction">For Construction</option>
                      <option value="For Approval">For Approval</option>
                      <option value="For Information">For Information</option>
                      <option value="As-Built">As-Built</option>
                      <option value="Tender">Tender</option>
                    </select>
                  </div>
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Recipients (comma separated)</label>
                  <input
                    type="text"
                    className="dw-form-input"
                    placeholder="e.g. Site Team, Project Manager, Consultant"
                    value={formData.recipientsText}
                    onChange={(e) => setFormData({ ...formData, recipientsText: e.target.value })}
                  />
                </div>

                {/* Drawings Multi-Select Table with exact pinned revision */}
                <div className="dw-form-group">
                  <label className="dw-form-label">
                    Select Drawings to Transmit ({formData.selectedDrawingIds.length} selected)
                  </label>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '6px' }}>
                    <table className="drawings-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '30px' }}></th>
                          <th>Drawing No.</th>
                          <th>Title</th>
                          <th>Revision</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(availableDrawings || []).map((dw) => (
                          <tr key={dw._id} onClick={() => handleToggleDrawing(dw._id)}>
                            <td>
                              <input
                                type="checkbox"
                                checked={formData.selectedDrawingIds.includes(dw._id)}
                                onChange={() => handleToggleDrawing(dw._id)}
                              />
                            </td>
                            <td><strong style={{ fontFamily: 'monospace' }}>{dw.drawingNumber}</strong></td>
                            <td>{dw.title}</td>
                            <td>
                              <span className="dw-rev-badge">
                                {dw.currentRevisionNumber || 'R00'}
                              </span>
                            </td>
                            <td>
                              <span className={`dw-status-badge ${dw.currentStatus === 'Approved' ? 'dw-status-approved' : 'dw-status-under-review'}`}>
                                {dw.currentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Transmittal Remarks / Notes</label>
                  <textarea
                    rows={2}
                    className="dw-form-textarea"
                    placeholder="Issued for immediate site reinforcement works and foundation inspection..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="dw-modal-footer">
                <button type="button" className="dw-btn-secondary" onClick={() => setShowIssueModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="dw-btn-primary" disabled={submitting}>
                  {submitting ? 'Creating Transmittal...' : 'Create Transmittal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Printable Transmittal Slip Modal ─────────────────────────────── */}
      {selectedSlip && (
        <div className="dw-modal-overlay" onClick={() => setSelectedSlip(null)}>
          <div className="dw-modal-card large" onClick={(e) => e.stopPropagation()}>
            <div className="dw-modal-header">
              <div className="dw-modal-title">Formal Transmittal Slip — {selectedSlip.transmittalNumber}</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="dw-btn-primary" style={{ padding: '0.25rem 0.65rem' }} onClick={() => window.print()}>
                  <Printer size={14} /> Print
                </button>
                <button className="dw-btn-secondary" style={{ padding: '0.2rem' }} onClick={() => setSelectedSlip(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="dw-modal-body" style={{ background: '#ffffff', color: '#0f172a', padding: '2rem' }}>
              {/* Slip Letterhead Header */}
              <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>REBAROPTIMA</h1>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
                    Document Control &amp; Quality Engineering Directorate
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7' }}>{selectedSlip.transmittalNumber}</div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>Date: {selectedSlip.issueDate}</div>
                </div>
              </div>

              {/* Project & Purpose Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <div>
                  <strong>Project:</strong> {selectedSlip.projectName} ({selectedSlip.projectCode})<br />
                  <strong>Issued By:</strong> {selectedSlip.issuedByName}<br />
                  <strong>Purpose:</strong> <span style={{ fontWeight: 700, color: '#0284c7' }}>{selectedSlip.purpose}</span>
                </div>
                <div>
                  <strong>Recipients:</strong><br />
                  {selectedSlip.recipients?.map((r, i) => (
                    <div key={i}>• {r.name} ({r.role || 'Recipient'})</div>
                  ))}
                </div>
              </div>

              {/* Transmitted Drawings Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Item #</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Drawing Number</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Revision</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSlip.items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>{item.drawingNumber}</td>
                      <td style={{ padding: '0.5rem' }}>{item.title}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700 }}>{item.revisionNumber}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedSlip.notes && (
                <div style={{ fontSize: '0.82rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
                  <strong>Remarks:</strong> {selectedSlip.notes}
                </div>
              )}

              {/* Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.8rem' }}>
                <div>
                  <div style={{ borderBottom: '1px solid #94a3b8', height: '35px', marginBottom: '0.35rem' }}></div>
                  <span>Issued By: {selectedSlip.issuedByName}</span>
                </div>
                <div>
                  <div style={{ borderBottom: '1px solid #94a3b8', height: '35px', marginBottom: '0.35rem' }}></div>
                  <span>Received &amp; Acknowledged By (Sign &amp; Date)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
