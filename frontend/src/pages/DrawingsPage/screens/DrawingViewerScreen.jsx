import React, { useState, useRef, useEffect, useCallback } from 'react';
import './DrawingViewerScreen.css';
import StatusPill from '../../../components/Drawings/StatusPill';
import RoleGate from '../../../components/RoleGate';
import DxfViewerComponent from '../components/DxfViewerComponent';
import PDFViewer from '../components/PDFViewer';
import UploadVersionModal from '../components/UploadVersionModal';
import ReviewApprovalModal from '../components/ReviewApprovalModal';
import CompareDrawingsModal from '../components/CompareDrawingsModal';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Download,
  MoreVertical,
  Sidebar,
  Upload,
  Send,
  GitCompare,
  Trash2,
  FileText,
  Clock,
  Layers,
  Share2,
  AlertCircle
} from 'lucide-react';

export default function DrawingViewerScreen({
  drawingData,
  onBack,
  onUploadNewVersion,
  onCreateTransmittal,
  onDownloadDrawing,
  onCompareDrawing,
  onVoidDrawing
}) {
  const { drawing, currentRevision, revisions = [], activities: rawActivities = [] } = drawingData || {};
  const rev = currentRevision || revisions[0] || {};

  // Ensure rich activity audit log even on fresh records
  const activities = (rawActivities && rawActivities.length > 0)
    ? rawActivities
    : (revisions.length > 0
      ? revisions.map((r, idx) => ({
          _id: r._id || `rev-act-${idx}`,
          createdAt: r.createdAt || r.uploadedAt,
          action: r.isCurrent ? 'CURRENT' : r.status || 'UPLOADED',
          performedByName: r.uploadedByName || drawing?.createdBy || 'Document Team',
          description: r.changeDescription || `Revision ${r.revisionNumber || 'v' + (idx + 1)} recorded`
        }))
      : [
          {
            _id: 'init-1',
            createdAt: drawing?.createdAt || new Date().toISOString(),
            action: 'CREATED',
            performedByName: drawing?.createdBy || 'System',
            description: `Initial drawing created as ${drawing?.drawingNumber || 'v1'}`
          }
        ]);

  // Active Tab: 'viewer' | 'details' | 'history' | 'activity' | 'distributions'
  const [activeTab, setActiveTab] = useState('viewer');

  // Toolbar & Canvas States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Pan states for Image Viewer
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Actions dropdown & Modals
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowActionsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine file type
  const fileExt = (
    rev?.fileType ||
    rev?.fileName?.split('.').pop() ||
    drawing?.fileType ||
    'png'
  ).toLowerCase();

  const isPdf = fileExt === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp'].includes(fileExt);
  const isCadFile = ['dwg', 'dxf'].includes(fileExt);

  // Format Helpers
  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
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

  // Zoom handlers
  const handleZoom = (delta) => {
    setZoomLevel((prev) => {
      const next = Number((prev + delta).toFixed(2));
      return Math.min(5, Math.max(0.2, next));
    });
  };

  const handleFitView = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  // Keyboard Navigation: + / - / arrows
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '+' || e.key === '=') {
        handleZoom(0.2);
      } else if (e.key === '-' || e.key === '_') {
        handleZoom(-0.2);
      } else if (e.key === '0') {
        handleFitView();
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation((prev) => (prev + 90) % 360);
      } else if (e.key === 'ArrowRight' && currentPage < numPages) {
        setCurrentPage((p) => p + 1);
      } else if (e.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages]);

  // Image pan drag handlers
  const handleMouseDown = (e) => {
    if (!isImage || e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom at cursor for image
  const handleWheel = (e) => {
    if (!isImage) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.15 : -0.15;
    handleZoom(factor);
  };

  // Drawing title string
  const drawingTitle = `${drawing?.drawingNumber || 'AR-L1-001'} - ${drawing?.title || 'Floor Plan - Level 1'}`;
  const versionTag = rev?.revisionNumber ? `v${rev.revisionNumber.replace(/^R0*/i, '') || '1'}` : 'v1';

  return (
    <div className="ro-viewer-screen">
      {/* Header Bar matching Screen 2 */}
      <header className="ro-viewer-header">
        <div className="ro-viewer-header-left">
          <button type="button" className="ro-viewer-back-btn" onClick={onBack}>
            <ArrowLeft size={15} />
            <span>Back to Drawings</span>
          </button>

          <div className="ro-viewer-title-group">
            <h1 className="ro-viewer-drawing-title">{drawingTitle}</h1>
            <StatusPill status={drawing?.currentStatus || 'CURRENT'} />
          </div>
        </div>

        <div className="ro-viewer-header-right" ref={dropdownRef}>
          <button
            type="button"
            className="ro-viewer-actions-btn"
            onClick={() => setShowActionsDropdown((prev) => !prev)}
          >
            <span>Actions</span>
            <MoreVertical size={15} />
          </button>

          {showActionsDropdown && (
            <div className="ro-kebab-menu" style={{ top: '100%', right: 0 }}>
              <RoleGate permission="drawing:upload">
                <button
                  type="button"
                  className="ro-kebab-item"
                  onClick={() => {
                    setShowActionsDropdown(false);
                    setShowUploadModal(true);
                  }}
                >
                  <Upload size={14} />
                  <span>Upload New Version</span>
                </button>
              </RoleGate>

              <RoleGate permission="drawing:distribute">
                <button
                  type="button"
                  className="ro-kebab-item"
                  onClick={() => {
                    setShowActionsDropdown(false);
                    onCreateTransmittal && onCreateTransmittal(drawing);
                  }}
                >
                  <Send size={14} />
                  <span>Create Transmittal</span>
                </button>
              </RoleGate>

              <button
                type="button"
                className="ro-kebab-item"
                onClick={() => {
                  setShowActionsDropdown(false);
                  onDownloadDrawing && onDownloadDrawing(drawing);
                }}
              >
                <Download size={14} />
                <span>Download</span>
              </button>

              <RoleGate permission="drawing:approve">
                <button
                  type="button"
                  className="ro-kebab-item"
                  style={{ color: '#059669' }}
                  onClick={() => {
                    setShowActionsDropdown(false);
                    setShowReviewModal(true);
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>Review / Approve</span>
                </button>
              </RoleGate>

              <button
                type="button"
                className="ro-kebab-item"
                onClick={() => {
                  setShowActionsDropdown(false);
                  setShowCompareModal(true);
                }}
              >
                <GitCompare size={14} />
                <span>Compare</span>
              </button>

              <RoleGate permission="drawing:void">
                <button
                  type="button"
                  className="ro-kebab-item danger"
                  onClick={() => {
                    setShowActionsDropdown(false);
                    onVoidDrawing && onVoidDrawing(drawing);
                  }}
                >
                  <Trash2 size={14} />
                  <span>Void</span>
                </button>
              </RoleGate>
            </div>
          )}
        </div>
      </header>

      {/* Tabs Row */}
      <nav className="ro-viewer-tabs-bar" aria-label="Drawing details tabs">
        <button
          type="button"
          className={`ro-viewer-tab ${activeTab === 'viewer' ? 'active' : ''}`}
          onClick={() => setActiveTab('viewer')}
        >
          Viewer
        </button>
        <button
          type="button"
          className={`ro-viewer-tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          type="button"
          className={`ro-viewer-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Version History
        </button>
        <button
          type="button"
          className={`ro-viewer-tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity Log
        </button>
        <button
          type="button"
          className={`ro-viewer-tab ${activeTab === 'distributions' ? 'active' : ''}`}
          onClick={() => setActiveTab('distributions')}
        >
          Distributions
        </button>
      </nav>

      {/* TAB CONTENT 1: 3-PANEL VIEWER */}
      {activeTab === 'viewer' && (
        <div className="ro-viewer-workspace">
          {/* Left Vertical Thumbnail Strip */}
          <aside className={`ro-thumb-strip ${!isSidebarOpen ? 'collapsed' : ''}`}>
            {Array.from({ length: isPdf ? numPages || 1 : 1 }).map((_, idx) => {
              const pNum = idx + 1;
              const isActive = currentPage === pNum;
              return (
                <div
                  key={`thumb-${pNum}`}
                  className="ro-thumb-item"
                  onClick={() => setCurrentPage(pNum)}
                >
                  <div className={`ro-thumb-box ${isActive ? 'active' : ''}`}>
                    {isImage && rev.fileData ? (
                      <img
                        src={rev.fileData}
                        alt={`Page ${pNum}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <FileText size={28} color={isActive ? '#38bdf8' : '#64748b'} />
                    )}
                  </div>
                  <span className="ro-thumb-page-num">{pNum}</span>
                </div>
              );
            })}
          </aside>

          {/* Center Canvas Area with Top Toolbar */}
          <main className="ro-center-canvas">
            {/* Floating Toolbar */}
            <div className="ro-viewer-toolbar">
              <button
                type="button"
                className="ro-toolbar-btn"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                title="Toggle Thumbnail Strip"
              >
                <Sidebar size={16} />
              </button>

              <div className="ro-toolbar-divider" />

              {/* Page navigation */}
              <button
                type="button"
                className="ro-toolbar-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="ro-toolbar-page-indicator">
                {currentPage} / {numPages || 1}
              </span>

              <button
                type="button"
                className="ro-toolbar-btn"
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>

              <div className="ro-toolbar-divider" />

              {/* Zoom Controls */}
              <button
                type="button"
                className="ro-toolbar-btn"
                onClick={() => handleZoom(-0.2)}
                title="Zoom Out (-)"
              >
                <ZoomOut size={16} />
              </button>

              <span className="ro-toolbar-zoom-pct">
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                type="button"
                className="ro-toolbar-btn"
                onClick={() => handleZoom(0.2)}
                title="Zoom In (+)"
              >
                <ZoomIn size={16} />
              </button>

              <button
                type="button"
                className="ro-toolbar-btn"
                onClick={handleFitView}
                title="Fit to Width / Reset (0)"
              >
                <Maximize2 size={15} />
              </button>

              <button
                type="button"
                className="ro-toolbar-btn"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Rotate (R)"
              >
                <RotateCw size={15} />
              </button>

              <div className="ro-toolbar-divider" />

              <button
                type="button"
                className="ro-toolbar-btn"
                onClick={() => onDownloadDrawing && onDownloadDrawing(drawing)}
                title="Download Drawing"
              >
                <Download size={15} />
              </button>
            </div>

            {/* Viewport Canvas Routing */}
            <div
              className="ro-canvas-viewport"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              style={{ cursor: isImage ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {isCadFile ? (
                <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
                  <DxfViewerComponent
                    dxfUrl={`/api/drawings/drawings/${drawing._id}/dxf`}
                    originalFileName={rev.fileName || `${drawing.drawingNumber}.dwg`}
                    onDownloadOriginal={() => onDownloadDrawing && onDownloadDrawing(drawing)}
                  />
                </div>
              ) : isPdf ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PDFViewer
                    fileData={rev.fileData}
                    fileUrl={rev.fileUrl}
                    fileName={rev.fileName}
                  />
                </div>
              ) : isImage && rev.fileData ? (
                <img
                  src={rev.fileData}
                  alt={drawing.title}
                  draggable={false}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.12s ease',
                    maxWidth: '90%',
                    maxHeight: '90%',
                    objectFit: 'contain',
                    userSelect: 'none'
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <AlertCircle size={44} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                    Preview Not Available
                  </div>
                  <p style={{ fontSize: '12px', marginTop: '6px', maxWidth: '360px' }}>
                    This file format ({fileExt.toUpperCase()}) cannot be rendered directly in canvas. You can download the original file to view it in your CAD software.
                  </p>
                  <button
                    type="button"
                    className="ro-btn-primary-action"
                    style={{ marginTop: '16px' }}
                    onClick={() => onDownloadDrawing && onDownloadDrawing(drawing)}
                  >
                    <Download size={15} />
                    <span>Download Original</span>
                  </button>
                </div>
              )}
            </div>
          </main>

          {/* Right Current Version Panel */}
          <aside className="ro-version-panel">
            <div className="ro-version-panel-title">
              <span>Current Version</span>
              <span className="ro-version-tag">{versionTag}</span>
            </div>

            <div className="ro-meta-list">
              <div className="ro-meta-row">
                <span className="ro-meta-label">Status</span>
                <StatusPill status={drawing.currentStatus || 'CURRENT'} />
              </div>

              <div className="ro-meta-row">
                <span className="ro-meta-label">Uploaded By</span>
                <span className="ro-meta-value">{rev.uploadedByName || drawing.createdBy || 'Rakesh S.'}</span>
              </div>

              <div className="ro-meta-row">
                <span className="ro-meta-label">Uploaded At</span>
                <span className="ro-meta-value">{formatDate(rev.uploadedAt || drawing.updatedAt)}</span>
              </div>

              <div className="ro-meta-row">
                <span className="ro-meta-label">File Name</span>
                <span className="ro-meta-value" style={{ fontSize: '11px' }}>
                  {rev.fileName || `${drawing.drawingNumber}.dwg`}
                </span>
              </div>

              <div className="ro-meta-row">
                <span className="ro-meta-label">File Size</span>
                <span className="ro-meta-value">{formatSize(rev.fileSize || drawing.fileSize)}</span>
              </div>

              <div className="ro-meta-row">
                <span className="ro-meta-label">Pages</span>
                <span className="ro-meta-value">{numPages || 1}</span>
              </div>
            </div>

            {/* Change Note Quote Box */}
            <div className="ro-change-note-box">
              "{rev.changeDescription || 'Updated layout as per client comments'}"
            </div>

            <div className="ro-meta-list">
              <div className="ro-meta-row">
                <span className="ro-meta-label">Reason</span>
                <span className="ro-meta-value">{rev.reason || 'CLIENT_REQUEST'}</span>
              </div>

              <div className="ro-meta-row">
                <span className="ro-meta-label">Purpose</span>
                <span className="ro-meta-value">{rev.purpose || 'FOR_APPROVAL'}</span>
              </div>
            </div>

            <button
              type="button"
              className="ro-panel-btn-download"
              onClick={() => onDownloadDrawing && onDownloadDrawing(drawing)}
            >
              <Download size={15} />
              <span>Download</span>
            </button>

            <button
              type="button"
              className="ro-panel-link-all"
              onClick={() => setActiveTab('history')}
            >
              View All Versions
            </button>
          </aside>
        </div>
      )}

      {/* TAB CONTENT 2: DETAILS */}
      {activeTab === 'details' && (
        <div className="ro-tab-content-panel">
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '16px' }}>
            Drawing Properties &amp; Metadata
          </h2>
          <div className="ro-details-grid">
            <div className="ro-detail-card">
              <span className="ro-detail-label">Drawing Number</span>
              <span className="ro-detail-val">{drawing.drawingNumber || '—'}</span>
            </div>
            <div className="ro-detail-card">
              <span className="ro-detail-label">Title</span>
              <span className="ro-detail-val">{drawing.title || '—'}</span>
            </div>
            <div className="ro-detail-card">
              <span className="ro-detail-label">Block / Tower</span>
              <span className="ro-detail-val">{drawing.blockName || 'Block A'}</span>
            </div>
            <div className="ro-detail-card">
              <span className="ro-detail-label">Level / Floor</span>
              <span className="ro-detail-val">{drawing.level || 'L1 (Level 1)'}</span>
            </div>
            <div className="ro-detail-card">
              <span className="ro-detail-label">Discipline</span>
              <span className="ro-detail-val">{drawing.disciplineName || drawing.disciplineCode || 'Architectural'}</span>
            </div>
            <div className="ro-detail-card">
              <span className="ro-detail-label">Drawing Type</span>
              <span className="ro-detail-val">{drawing.drawingType || 'General Arrangement'}</span>
            </div>
            <div className="ro-detail-card">
              <span className="ro-detail-label">Created By</span>
              <span className="ro-detail-val">{drawing.createdBy || 'Rahul Singh'}</span>
            </div>
            <div className="ro-detail-card">
              <span className="ro-detail-label">Created Date</span>
              <span className="ro-detail-val">{formatDate(drawing.createdAt)}</span>
            </div>
            <div className="ro-detail-card">
              <span className="ro-detail-label">Last Updated</span>
              <span className="ro-detail-val">{formatDate(drawing.updatedAt)}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: VERSION HISTORY (Screen 5 Embedded) */}
      {activeTab === 'history' && (
        <div className="ro-tab-content-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              Version History
            </h2>
            <RoleGate permission="drawing:upload">
              <button
                type="button"
                className="ro-btn-primary-action"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload size={14} />
                <span>Upload New Version</span>
              </button>
            </RoleGate>
          </div>

          <div className="ro-table-container">
            <table className="ro-drawings-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Change Note</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {revisions.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No prior revisions recorded.
                    </td>
                  </tr>
                ) : (
                  revisions.map((r, i) => (
                    <tr key={r._id || `rev-${i}`}>
                      <td>
                        <span className="ro-version-tag">
                          v{r.revisionNumber ? r.revisionNumber.replace(/^R0*/i, '') : revisions.length - i}
                        </span>
                      </td>
                      <td>
                        <StatusPill status={r.workflowStatus || (i === 0 ? 'CURRENT' : 'SUPERSEDED')} />
                      </td>
                      <td style={{ maxWidth: '280px', color: 'var(--text-secondary, #475569)' }}>
                        {r.changeDescription || 'Initial issue'}
                      </td>
                      <td style={{ color: 'var(--text-secondary, #475569)' }}>
                        {r.uploadedByName || 'Rahul S.'}
                      </td>
                      <td style={{ color: 'var(--text-secondary, #475569)' }}>
                        {formatDate(r.uploadedAt || r.createdAt)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="ro-btn-view-action"
                            style={{ backgroundColor: 'rgba(5, 150, 105, 0.08)', color: '#059669', borderColor: 'rgba(5, 150, 105, 0.2)' }}
                            onClick={() => setShowCompareModal(true)}
                          >
                            Compare
                          </button>
                          <button
                            type="button"
                            className="ro-btn-view-action"
                            onClick={() => onDownloadDrawing && onDownloadDrawing(r)}
                          >
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: ACTIVITY LOG */}
      {activeTab === 'activity' && (
        <div className="ro-tab-content-panel">
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '16px' }}>
            Drawing Activity Log
          </h2>
          <div className="ro-table-container">
            <table className="ro-drawings-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Action</th>
                  <th>By</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No recorded audit events for this drawing yet.
                    </td>
                  </tr>
                ) : (
                  activities.map((act, i) => (
                    <tr key={act._id || `act-${i}`}>
                      <td style={{ color: 'var(--text-secondary, #475569)' }}>
                        {formatDate(act.createdAt)}
                      </td>
                      <td>
                        <StatusPill status={act.action} />
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                        {act.performedByName || 'Mohit P.'}
                      </td>
                      <td style={{ color: 'var(--text-secondary, #475569)' }}>
                        {act.description || act.title}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: DISTRIBUTIONS */}
      {activeTab === 'distributions' && (
        <div className="ro-tab-content-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              Drawing Distributions &amp; Transmittals
            </h2>
            <RoleGate permission="drawing:distribute">
              <button
                type="button"
                className="ro-btn-primary-action"
                onClick={() => onCreateTransmittal && onCreateTransmittal(drawing)}
              >
                <Send size={14} />
                <span>Create Transmittal</span>
              </button>
            </RoleGate>
          </div>
          <div className="ro-table-container">
            <table className="ro-drawings-table">
              <thead>
                <tr>
                  <th>Transmittal No.</th>
                  <th>To Party</th>
                  <th>Sent At</th>
                  <th>Purpose</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    This drawing has not been included in any transmittal packages yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Screen 3 Upload Modal */}
      <UploadVersionModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        drawing={drawing}
        onSuccess={(newRev) => {
          if (onUploadNewVersion) {
            onUploadNewVersion(newRev);
          } else {
            window.location.reload();
          }
        }}
      />

      {/* Screen 4 Review / Approval Modal */}
      <ReviewApprovalModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        drawing={drawing}
        revision={rev}
        onSuccess={() => {
          window.location.reload();
        }}
      />

      {/* Screen 5 Compare Versions Modal */}
      <CompareDrawingsModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        drawing={drawing}
        revisions={revisions}
      />
    </div>
  );
}

