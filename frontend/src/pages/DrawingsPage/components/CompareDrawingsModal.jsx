import React, { useState } from 'react';
import './CompareDrawingsModal.css';
import AppModal from '../../../components/ui/AppModal';
import DxfViewerComponent from './DxfViewerComponent';
import PDFViewer from './PDFViewer';
import { GitCompare, ZoomIn, ZoomOut, Maximize2, SplitSquareVertical } from 'lucide-react';

export default function CompareDrawingsModal({
  isOpen,
  open,
  onClose,
  drawing,
  revisions = []
}) {
  if (!isOpen || !drawing) return null;

  const revList = revisions.length > 0 ? revisions : [drawing.currentRevision].filter(Boolean);

  const [leftRevId, setLeftRevId] = useState(
    revList.length > 1 ? revList[1]._id : revList[0]?._id
  );
  const [rightRevId, setRightRevId] = useState(
    revList[0]?._id
  );

  const leftRev = revList.find((r) => String(r._id) === String(leftRevId)) || revList[0];
  const rightRev = revList.find((r) => String(r._id) === String(rightRevId)) || revList[0];

  const renderContent = (rev) => {
    if (!rev) return <div style={{ color: '#94a3b8' }}>No revision selected</div>;
    const ext = (rev.fileType || rev.fileName?.split('.').pop() || 'dwg').toLowerCase();

    if (ext === 'dwg' || ext === 'dxf') {
      return (
        <DxfViewerComponent
          dxfUrl={`/api/drawings/drawings/${drawing._id}/dxf`}
          originalFileName={rev.fileName}
        />
      );
    }
    if (ext === 'pdf') {
      return (
        <PDFViewer
          fileData={rev.fileData}
          fileUrl={rev.fileUrl}
          fileName={rev.fileName}
        />
      );
    }
    if (rev.fileData) {
      return (
        <img
          src={rev.fileData}
          alt={rev.fileName}
          style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
        />
      );
    }
    return <div style={{ color: '#94a3b8' }}>Preview not available for this revision</div>;
  };

  return (
    <AppModal
      open={isOpen || open}
      isOpen={isOpen || open}
      onClose={onClose}
      title={`Compare Drawing Revisions — ${drawing?.drawingNumber || 'Drawing'}`}
      size="lg"
    >
      <div className="ro-compare-modal">
        {/* Controls Bar */}
        <div className="ro-compare-toolbar">
          <div className="ro-compare-version-selectors">
            <div className="ro-compare-select-group">
              <label>Left Version:</label>
              <select
                className="ro-filter-select"
                value={leftRevId}
                onChange={(e) => setLeftRevId(e.target.value)}
              >
                {revList.map((r) => (
                  <option key={r._id} value={r._id}>
                    v{r.revisionNumber?.replace(/^R0*/i, '') || '1'} ({r.workflowStatus || 'Draft'})
                  </option>
                ))}
              </select>
            </div>

            <GitCompare size={18} style={{ color: 'var(--accent, #059669)' }} />

            <div className="ro-compare-select-group">
              <label>Right Version:</label>
              <select
                className="ro-filter-select"
                value={rightRevId}
                onChange={(e) => setRightRevId(e.target.value)}
              >
                {revList.map((r) => (
                  <option key={r._id} value={r._id}>
                    v{r.revisionNumber?.replace(/^R0*/i, '') || '1'} ({r.workflowStatus || 'Current'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-label, #64748b)' }}>
            Side-by-side revision inspector
          </div>
        </div>

        {/* Canvases */}
        <div className="ro-compare-canvases-container">
          <div className="ro-compare-pane">
            <div className="ro-compare-pane-header">
              <span>v{leftRev?.revisionNumber?.replace(/^R0*/i, '') || '1'} (Previous)</span>
              <span>{leftRev?.fileName || 'Left'}</span>
            </div>
            <div className="ro-compare-viewport">
              {renderContent(leftRev)}
            </div>
          </div>

          <div className="ro-compare-pane">
            <div className="ro-compare-pane-header">
              <span>v{rightRev?.revisionNumber?.replace(/^R0*/i, '') || '1'} (Current / New)</span>
              <span>{rightRev?.fileName || 'Right'}</span>
            </div>
            <div className="ro-compare-viewport">
              {renderContent(rightRev)}
            </div>
          </div>
        </div>
      </div>
    </AppModal>
  );
}

