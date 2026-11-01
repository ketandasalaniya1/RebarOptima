import React, { useState } from 'react';
import './ReviewApprovalModal.css';
import AppModal from '../../../components/ui/AppModal';
import StatusPill from '../../../components/Drawings/StatusPill';
import RoleGate from '../../../components/RoleGate';
import {
  FileText,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function ReviewApprovalModal({
  isOpen,
  open,
  onClose,
  drawing,
  revision,
  onSuccess,
  onViewFile
}) {
  const [action, setAction] = useState('Approve'); // 'Approve' | 'Reject'
  const [approvalNote, setApprovalNote] = useState('Reviewed and approved. Changes look good.');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !drawing) return null;

  const rev = revision || drawing.currentRevision || {};
  const drawingId = drawing._id || drawing.id;
  const revId = rev._id || rev.id || drawing.currentRevisionId;

  const versionTag = rev.revisionNumber ? `Version ${rev.revisionNumber.replace(/^R0*/i, '') || '1'}` : 'Version 1';
  const fileName = rev.fileName || `${drawing.drawingNumber || 'drawing'}.${rev.fileType || 'pdf'}`;

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (rawDate) => {
    if (!rawDate) return '—';
    try {
      const d = new Date(rawDate);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(rawDate);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!approvalNote.trim()) {
      setErrorMsg('Approval note is required.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const token = sessionStorage.getItem('accessToken');
      const decision = action === 'Approve' ? 'Approved' : 'Rejected';

      const cleanDrawingId = typeof drawingId === 'object' && drawingId !== null ? (drawingId.$oid || drawingId.toString()) : String(drawingId || '');
      const cleanRevId = typeof revId === 'object' && revId !== null ? (revId.$oid || revId.toString()) : String(revId || '');
      const targetRev = cleanRevId || 'current';

      const apiBase = window.location.port === '5173' ? 'http://localhost:3000/api/drawings' : '/api/drawings';
      let resp = await fetch(`${apiBase}/${cleanDrawingId}/revisions/${targetRev}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          decision,
          comments: approvalNote.trim()
        })
      });

      if (!resp.ok && resp.status === 404) {
        resp = await fetch(`/api/drawings/${cleanDrawingId}/revisions/${targetRev}/decision`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            decision,
            comments: approvalNote.trim()
          })
        });
      }

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to record ${decision} verdict`);
      }

      const resData = await resp.json();
      onSuccess && onSuccess(resData);
      onClose();
    } catch (err) {
      console.error('Decision submission error:', err);
      setErrorMsg(err.message || 'Error recording decision.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RoleGate permission="drawing:approve">
      <AppModal
        open={isOpen || open}
        isOpen={isOpen || open}
        onClose={submitting ? () => {} : onClose}
        title="Review Drawing Version"
        size="md"
      >
        <form onSubmit={handleSubmit} className="ro-review-modal">
          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderRadius: '6px', fontSize: '12px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Top Summary Card */}
          <div className="ro-review-summary-card">
            <div className="ro-review-thumb-icon">
              <FileText size={24} />
            </div>
            <div className="ro-review-header-info">
              <div className="ro-review-title-row">
                <span className="ro-review-drawing-title">
                  {drawing.drawingNumber || 'AR-L1-002'} - {drawing.title || 'Elevation - East'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="ro-version-tag">{versionTag}</span>
                  <StatusPill status={rev.workflowStatus || drawing.currentStatus || 'IN_REVIEW'} />
                </div>
              </div>
              <div className="ro-review-meta-uploader">
                Uploaded by {rev.uploadedByName || drawing.createdBy || 'Priya M.'} · {formatDate(rev.uploadedAt || rev.createdAt)}
              </div>
            </div>
          </div>

          {/* Metadata Block */}
          <div className="ro-review-meta-block">
            <div className="ro-review-meta-item full-width">
              <span className="ro-review-label">Change Note</span>
              <span className="ro-review-value" style={{ fontStyle: 'italic' }}>
                "{rev.changeDescription || 'Revised elevation as per client comments'}"
              </span>
            </div>

            <div className="ro-review-meta-item">
              <span className="ro-review-label">Reason</span>
              <span className="ro-review-value">{rev.reason || 'CLIENT_REQUEST'}</span>
            </div>

            <div className="ro-review-meta-item">
              <span className="ro-review-label">Purpose</span>
              <span className="ro-review-value">{rev.purpose || 'FOR_APPROVAL'}</span>
            </div>
          </div>

          {/* File Preview Row */}
          <div className="ro-review-file-row">
            <div className="ro-review-file-left">
              <FileText size={20} style={{ color: '#2563eb' }} />
              <div>
                <div className="ro-review-file-name">{fileName}</div>
                <div className="ro-review-file-size">{formatSize(rev.fileSize)}</div>
              </div>
            </div>

            <button
              type="button"
              className="ro-btn-view-file"
              onClick={() => {
                onClose();
                onViewFile && onViewFile(drawing);
              }}
            >
              <Eye size={14} />
              <span>View File</span>
            </button>
          </div>

          {/* "Your Action" Radio Selector */}
          <div className="ro-action-radio-group">
            <span className="ro-action-radio-title">Your Action *</span>
            <div className="ro-action-radio-options">
              <div
                className={`ro-action-radio-card ${action === 'Approve' ? 'selected-approve' : ''}`}
                onClick={() => {
                  setAction('Approve');
                  if (!approvalNote || approvalNote.includes('Rejected')) {
                    setApprovalNote('Reviewed and approved. Changes look good.');
                  }
                }}
              >
                <input
                  type="radio"
                  name="reviewAction"
                  checked={action === 'Approve'}
                  onChange={() => {}}
                  style={{ accentColor: '#10b981' }}
                />
                <span className="ro-radio-label-text" style={{ color: action === 'Approve' ? '#059669' : 'inherit' }}>
                  Approve
                </span>
              </div>

              <div
                className={`ro-action-radio-card ${action === 'Reject' ? 'selected-reject' : ''}`}
                onClick={() => {
                  setAction('Reject');
                  if (!approvalNote || approvalNote.includes('approved')) {
                    setApprovalNote('Rejected due to dimension discrepancies. Please revise.');
                  }
                }}
              >
                <input
                  type="radio"
                  name="reviewAction"
                  checked={action === 'Reject'}
                  onChange={() => {}}
                  style={{ accentColor: '#ef4444' }}
                />
                <span className="ro-radio-label-text" style={{ color: action === 'Reject' ? '#dc2626' : 'inherit' }}>
                  Reject
                </span>
              </div>
            </div>
          </div>

          {/* Approval Note Textarea */}
          <div className="ro-approval-note-box">
            <div className="ro-approval-note-header">
              <label htmlFor="approval-note-input">Approval Note *</label>
              <span className="ro-char-counter">{approvalNote.length}/500</span>
            </div>
            <textarea
              id="approval-note-input"
              required
              maxLength={500}
              rows={3}
              className="ro-textarea-input"
              placeholder="Enter remarks or approval reason..."
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
            />
          </div>

          {/* Footer Actions */}
          <div className="ro-modal-actions-row">
            <button
              type="button"
              className="ro-bulk-btn"
              style={{ color: 'var(--text-secondary, #475569)', borderColor: 'var(--border-color, #cbd5e1)' }}
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>

            {action === 'Approve' ? (
              <button
                type="submit"
                className="ro-btn-decision-approve"
                disabled={submitting || !approvalNote.trim()}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Approve Version</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="submit"
                className="ro-btn-decision-reject"
                disabled={submitting || !approvalNote.trim()}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    <span>Reject Version</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </AppModal>
    </RoleGate>
  );
}

