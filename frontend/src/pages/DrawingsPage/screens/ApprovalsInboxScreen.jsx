import React, { useState } from 'react';
import './ApprovalsInboxScreen.css';
import StatusPill from '../../../components/Drawings/StatusPill';
import ReviewApprovalModal from '../components/ReviewApprovalModal';
import { useGetDrawingsQuery } from '../../../store/api/drawingsApi';
import RoleGate from '../../../components/RoleGate';
import { ShieldCheck, Eye, CheckCircle, Search, Inbox } from 'lucide-react';

export default function ApprovalsInboxScreen({
  activeProject,
  onViewDrawing
}) {
  const projectId = activeProject?._id || activeProject?.id;

  const [searchInput, setSearchInput] = useState('');
  const [selectedDrawingForReview, setSelectedDrawingForReview] = useState(null);

  // Query only drawings that are IN_REVIEW
  const { data, isLoading, refetch } = useGetDrawingsQuery({
    projectId: projectId || undefined,
    status: 'IN_REVIEW',
    search: searchInput || undefined
  }, {
    skip: !projectId
  });

  const pendingDrawings = data?.drawings || [];

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

  return (
    <div className="ro-approvals-inbox-screen">
      {/* Header */}
      <div className="ro-approvals-header">
        <h1 className="ro-approvals-title">Drawing Approvals Inbox</h1>
        <p className="ro-approvals-subtitle">
          Review and approve pending drawing revisions submitted by the design team.
        </p>
      </div>

      {/* Filter / Search Row */}
      <div className="ro-tabs-search-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
            Pending Items: <span style={{ color: 'var(--accent, #059669)' }}>{pendingDrawings.length}</span>
          </span>
        </div>

        <div className="ro-search-box">
          <Search size={16} className="ro-search-icon" />
          <input
            type="text"
            className="ro-search-input"
            placeholder="Search by drawing number or title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {/* Approvals Table */}
      <div className="ro-table-container">
        <table className="ro-drawings-table">
          <thead>
            <tr>
              <th>Drawing No.</th>
              <th>Title</th>
              <th>Version</th>
              <th>Status</th>
              <th>Submitted By</th>
              <th>Submitted Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-label, #64748b)' }}>
                  Loading pending approvals...
                </td>
              </tr>
            ) : pendingDrawings.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-label, #64748b)' }}>
                  <Inbox size={40} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                    No Drawings Pending Approval
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    All submitted drawings and revisions are reviewed and up to date.
                  </div>
                </td>
              </tr>
            ) : (
              pendingDrawings.map((dw) => (
                <tr key={dw._id}>
                  <td>
                    <span className="ro-drawing-no">{dw.drawingNumber}</span>
                  </td>
                  <td>
                    <span className="ro-drawing-title">{dw.title}</span>
                  </td>
                  <td>
                    <span className="ro-version-tag">
                      {dw.currentRevisionNumber ? `v${dw.currentRevisionNumber.replace(/^R0*/i, '') || '1'}` : 'v1'}
                    </span>
                  </td>
                  <td>
                    <StatusPill status={dw.currentStatus || 'IN_REVIEW'} />
                  </td>
                  <td style={{ color: 'var(--text-secondary, #475569)' }}>
                    {dw.updatedBy || dw.createdBy || dw.uploadedByName || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary, #475569)' }}>
                    {formatDate(dw.updatedAt || dw.createdAt)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RoleGate permission="drawing:approve">
                        <button
                          type="button"
                          className="ro-btn-review-action"
                          onClick={() => setSelectedDrawingForReview(dw)}
                        >
                          <ShieldCheck size={14} />
                          <span>Review</span>
                        </button>
                      </RoleGate>

                      <button
                        type="button"
                        className="ro-btn-view-action"
                        onClick={() => onViewDrawing && onViewDrawing(dw)}
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Screen 4 Review / Approval Modal */}
      {selectedDrawingForReview && (
        <ReviewApprovalModal
          isOpen={Boolean(selectedDrawingForReview)}
          onClose={() => setSelectedDrawingForReview(null)}
          drawing={selectedDrawingForReview}
          onViewFile={(dw) => onViewDrawing && onViewDrawing(dw)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

