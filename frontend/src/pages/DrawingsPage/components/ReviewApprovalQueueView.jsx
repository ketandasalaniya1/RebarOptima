import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  FileCheck,
  MessageSquare,
  ShieldCheck,
  X
} from 'lucide-react';

export default function ReviewApprovalQueueView({
  selectedDrawing,
  onRecordDecision,
  onRecordReview
}) {
  const drawing = selectedDrawing || {
    _id: 'sample-dw',
    drawingNumber: 'AR-F-001',
    title: 'Ground Floor Plan',
    currentRevisionNumber: 'R02',
    currentStatus: 'Pending Approval'
  };

  const [activeWorkflowTab, setActiveWorkflowTab] = useState('workflow'); // 'workflow' | 'reviewers' | 'comments' | 'history'
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState('Approved'); // 'Approved' | 'Changes Requested' | 'Rejected'
  const [decisionNotes, setDecisionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Stepper definition
  const STEPS = [
    { id: 'Draft', label: 'Draft', stepNum: 1 },
    { id: 'Under Review', label: 'Under Review', stepNum: 2 },
    { id: 'Changes Requested', label: 'Changes Requested', stepNum: 3 },
    { id: 'Pending Approval', label: 'Pending Approval', stepNum: 4 },
    { id: 'Approved', label: 'Approved', stepNum: 5 }
  ];

  const currentStatus = drawing.currentStatus || 'Pending Approval';
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStatus);

  const reviewers = [
    {
      id: 'rev-1',
      name: 'Anil Kumar',
      role: 'Structural Reviewer',
      status: 'Reviewed',
      comments: 'Grid layout matches structural model and column locations verified.',
      reviewedAt: '2024-10-20 11:00 AM'
    },
    {
      id: 'rev-2',
      name: 'Priya Desai',
      role: 'Design Reviewer',
      status: 'Reviewed',
      comments: 'Minor architectural notes addressed in entrance foyer. Approved for construction issue.',
      reviewedAt: '2024-10-20 11:30 AM'
    }
  ];

  const handleOpenDecision = (type) => {
    setDecisionType(type);
    setDecisionNotes('');
    setShowDecisionModal(true);
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (onRecordDecision) {
        await onRecordDecision(drawing._id, drawing.currentRevisionId || 'rev-sample', {
          decision: decisionType,
          comments: decisionNotes
        });
      }
      setShowDecisionModal(false);
      alert(`Decision recorded successfully: ${decisionType}`);
    } catch (err) {
      alert('Error recording approval decision: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Top Header matching Screenshot 5 Panel 6 ─────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Review &amp; Approval Workflow
            </h2>
            <span className="drawings-badge-tag">{drawing.drawingNumber}</span>
            <span className="dw-rev-badge">{drawing.currentRevisionNumber || 'R02'}</span>
          </div>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Formal gateway: All mandatory peer reviews must be logged before final release decision.
          </p>
        </div>

        {/* Action Decision Buttons */}
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button
            className="dw-btn-secondary"
            style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            onClick={() => handleOpenDecision('Changes Requested')}
          >
            <AlertTriangle size={15} /> Request Changes
          </button>
          <button
            className="dw-btn-primary"
            style={{ background: '#059669', borderColor: '#047857' }}
            onClick={() => handleOpenDecision('Approved')}
          >
            <CheckCircle2 size={15} /> Approve Revision
          </button>
        </div>
      </div>

      {/* ── Workflow Stepper Card (Screenshot 5 Panel 6) ─────────────────── */}
      <div className="drawings-card-box">
        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            className={`drawings-tab-btn ${activeWorkflowTab === 'workflow' ? 'active' : ''}`}
            onClick={() => setActiveWorkflowTab('workflow')}
          >
            Workflow
          </button>
          <button
            className={`drawings-tab-btn ${activeWorkflowTab === 'reviewers' ? 'active' : ''}`}
            onClick={() => setActiveWorkflowTab('reviewers')}
          >
            Reviewers (2)
          </button>
          <button
            className={`drawings-tab-btn ${activeWorkflowTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveWorkflowTab('comments')}
          >
            Comments &amp; Markups
          </button>
          <button
            className={`drawings-tab-btn ${activeWorkflowTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveWorkflowTab('history')}
          >
            Audit Trail
          </button>
        </div>

        {/* 5-Step Progress Stepper */}
        <div className="dw-workflow-stepper">
          {STEPS.map((s, idx) => {
            const isCompleted = idx < (currentStepIndex !== -1 ? currentStepIndex : 3);
            const isActive = s.id === currentStatus;

            return (
              <div
                key={s.id}
                className={`dw-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                <div className="dw-step-circle">
                  {isCompleted ? '✓' : s.stepNum}
                </div>
                <span className="dw-step-label">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Current Status Callout */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '6px',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Current Status:</span>
            <span className="dw-status-badge dw-status-pending-approval">
              {currentStatus}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginLeft: '0.5rem' }}>
              All reviews completed. Awaiting final approver release decision.
            </span>
          </div>

          <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <ShieldCheck size={14} /> Mandatory Review Rule Met
          </span>
        </div>

        {/* Reviewers List matching Screenshot 5 Panel 6 */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-label)', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
            Reviewers &amp; Recommendations
          </div>

          <div className="drawings-table-container">
            <table className="drawings-table">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Comments</th>
                  <th>Reviewed At</th>
                </tr>
              </thead>
              <tbody>
                {reviewers.map((r) => (
                  <tr key={r.id}>
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
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#38bdf8'
                          }}
                        >
                          {r.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <strong>{r.name}</strong>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.role}</td>
                    <td>
                      <span className="dw-status-badge dw-status-approved">
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{r.comments}</td>
                    <td style={{ fontSize: '0.74rem', color: 'var(--text-label)' }}>{r.reviewedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Decision Modal (Approve or Request Changes) ───────────────────── */}
      {showDecisionModal && (
        <div className="dw-modal-overlay" onClick={() => setShowDecisionModal(false)}>
          <div className="dw-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dw-modal-header">
              <div className="dw-modal-title">
                {decisionType === 'Approved' ? 'Record Formal Approval' : 'Request Changes for Revision'}
              </div>
              <button className="dw-btn-secondary" style={{ padding: '0.2rem' }} onClick={() => setShowDecisionModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDecisionSubmit}>
              <div className="dw-modal-body">
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Recording decision for <strong>{drawing.drawingNumber}</strong> (Revision {drawing.currentRevisionNumber || 'R02'}).
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Decision Outcome</label>
                  <select
                    className="dw-form-select"
                    value={decisionType}
                    onChange={(e) => setDecisionType(e.target.value)}
                  >
                    <option value="Approved">Approved (Ready for Publication)</option>
                    <option value="Changes Requested">Changes Requested (Requires New Revision Draft)</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Approver Remarks / Instructions *</label>
                  <textarea
                    rows={3}
                    className="dw-form-textarea"
                    placeholder="Enter formal approval remarks or specific items requiring correction..."
                    required
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="dw-modal-footer">
                <button type="button" className="dw-btn-secondary" onClick={() => setShowDecisionModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dw-btn-primary"
                  style={decisionType === 'Approved' ? { background: '#059669', borderColor: '#047857' } : { background: '#dc2626', borderColor: '#b91c1c' }}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : `Confirm ${decisionType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
