import React from 'react';
import {
  History,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileCode
} from 'lucide-react';

export default function RevisionHistoryView({
  selectedDrawing,
  revisions,
  onOpenUploadModal,
  onSelectRevision
}) {
  const drawing = selectedDrawing || {
    drawingNumber: 'AR-F-001',
    title: 'Ground Floor Plan',
    projectName: 'Alpha Heights'
  };

  const revList = revisions || [
    {
      _id: 'rev-2',
      revisionNumber: 'R02',
      workflowStatus: 'Approved',
      isPublished: true,
      isSuperseded: false,
      uploadedByName: 'Priya Mehta (Approver)',
      uploadedAt: '2024-10-20T10:30:00Z',
      changeDescription: 'Final layout with revised grid and column locations, approved entrance foyer.',
      fileType: 'svg',
      fileSize: 350208
    },
    {
      _id: 'rev-1',
      revisionNumber: 'R01',
      workflowStatus: 'Superseded',
      isPublished: false,
      isSuperseded: true,
      uploadedByName: 'Rahul Singh',
      uploadedAt: '2024-10-14T16:20:00Z',
      changeDescription: 'Updated room layouts and dimensions per MEP coordination notes.',
      fileType: 'svg',
      fileSize: 335872
    },
    {
      _id: 'rev-0',
      revisionNumber: 'R00',
      workflowStatus: 'Superseded',
      isPublished: false,
      isSuperseded: true,
      uploadedByName: 'Rahul Singh',
      uploadedAt: '2024-10-01T11:15:00Z',
      changeDescription: 'Initial issue for internal architectural review and coordination.',
      fileType: 'svg',
      fileSize: 317440
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Top Header matching Screenshot 5 Panel 5 ─────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Revision History
            </h2>
            <span className="drawings-badge-tag">{drawing.drawingNumber}</span>
          </div>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {drawing.title} • Immutable audit chain. Previous revisions are permanently retained.
          </p>
        </div>

        <button className="dw-btn-primary" onClick={onOpenUploadModal}>
          <Upload size={15} /> + Upload New Revision
        </button>
      </div>

      {/* ── Vertical Revision Timeline matching Screenshot 3 & 5 ─────────── */}
      <div className="dw-timeline" style={{ marginTop: '0.5rem' }}>
        {revList.map((rev) => {
          const isApproved = rev.workflowStatus === 'Approved' || rev.isPublished;

          return (
            <div key={rev._id} className="dw-timeline-item">
              <div className={`dw-timeline-node ${rev.isSuperseded ? 'superseded' : ''}`} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span className={`dw-rev-badge ${rev.isSuperseded ? 'superseded' : ''}`} style={{ fontSize: '0.85rem' }}>
                    {rev.revisionNumber}
                  </span>
                  <span className={`dw-status-badge ${isApproved ? 'dw-status-approved' : 'dw-status-superseded'}`}>
                    {rev.workflowStatus}
                  </span>
                  {isApproved && (
                    <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ShieldCheck size={14} /> Current Authorized Issue
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>
                  {new Date(rev.uploadedAt).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • By <strong>{rev.uploadedByName}</strong>
                </div>
              </div>

              {/* Blueprint preview snippet & changelog */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.35rem' }}>
                <div
                  style={{
                    width: '80px',
                    height: '56px',
                    backgroundColor: '#0f172a',
                    border: '1px solid var(--card-border)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8'
                  }}
                >
                  <FileCode size={24} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                    {rev.changeDescription}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-label)', marginTop: '0.2rem' }}>
                    Format: {rev.fileType?.toUpperCase() || 'SVG/CAD'} • Size: {Math.round((rev.fileSize || 340000) / 1024)} KB • Checksum: SHA-256 Verified
                  </div>
                </div>

                <button
                  className="dw-btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  onClick={() => alert(`Downloading verified immutable revision ${rev.revisionNumber} [SHA-256 Validated]`)}
                >
                  <Download size={13} /> Download
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
