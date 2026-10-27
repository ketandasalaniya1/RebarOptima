import React, { useState, useRef } from 'react';
import SimpleDrawingViewer from './SimpleDrawingViewer';
import PDFViewer from './PDFViewer';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Download,
  Upload,
  UploadCloud,
  FileCheck,
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  Send,
  User,
  Tag,
  Calendar,
  X,
  Layers,
  Eye
} from 'lucide-react';

export default function DrawingDetailsView({
  drawingData,
  onBack,
  onUploadRevision,
  onSubmitForReview,
  onRecordReview,
  onRecordDecision,
  onPublishRevision,
  onIssueTransmittal
}) {
  const { drawing, currentRevision, revisions, reviews, approvals, transmittals, activities } = drawingData || {};

  const [activeMetaTab, setActiveMetaTab] = useState('details'); // 'details' | 'revisions' | 'reviews' | 'transmittals' | 'activity'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    changeDescription: '',
    changeReason: ''
  });
  const [selectedRevFile, setSelectedRevFile] = useState(null);
  const [revFileData, setRevFileData] = useState(null);
  const [isDraggingRev, setIsDraggingRev] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState('auto'); // 'auto' | 'blueprint'
  const revFileInputRef = useRef(null);

  const rev = currentRevision || revisions?.[0];
  const fileExt = (rev?.fileType || rev?.fileName?.split('.').pop() || 'svg').toLowerCase();
  const isCad = fileExt === 'dwg' || fileExt === 'dxf';
  const isPdf = fileExt === 'pdf';
  const isImage = fileExt === 'png' || fileExt === 'jpg' || fileExt === 'jpeg';

  if (!drawing) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
        No drawing selected. <button className="dw-btn-secondary" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  const handleZoom = (delta) => {
    setZoomLevel((prev) => Math.min(2.5, Math.max(0.6, Number((prev + delta).toFixed(2)))));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleRevFileSelect = (file) => {
    if (!file) return;
    setSelectedRevFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setRevFileData(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRevDrop = (e) => {
    e.preventDefault();
    setIsDraggingRev(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleRevFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadDrawing = () => {
    if (!drawing) return;
    const rev = currentRevision || revisions?.[0];
    const fileName = rev?.fileName || `${drawing.drawingNumber}.svg`;

    if (rev?.fileData) {
      const link = document.createElement('a');
      link.href = rev.fileData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const svgElement = document.querySelector('.drawings-svg-container svg');
      if (svgElement) {
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${drawing.drawingNumber}_${rev?.revisionNumber || 'R00'}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.changeDescription) return;
    setUploading(true);
    try {
      const payload = {
        ...uploadForm,
        fileData: revFileData || '',
        fileName: selectedRevFile ? selectedRevFile.name : '',
        fileSize: selectedRevFile ? selectedRevFile.size : 0,
        fileType: selectedRevFile ? selectedRevFile.name.split('.').pop()?.toLowerCase() : 'pdf'
      };
      await onUploadRevision(drawing._id, payload);
      setShowUploadModal(false);
      setUploadForm({ changeDescription: '', changeReason: '' });
      setSelectedRevFile(null);
      setRevFileData(null);
    } catch (err) {
      alert('Error uploading revision: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const statusClass =
    drawing.currentStatus === 'Approved'
      ? 'dw-status-approved'
      : drawing.currentStatus === 'Under Review'
      ? 'dw-status-under-review'
      : drawing.currentStatus === 'Pending Approval'
      ? 'dw-status-pending-approval'
      : drawing.currentStatus === 'Changes Requested'
      ? 'dw-status-changes-requested'
      : 'dw-status-draft';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Top Workspace Header (Screenshot 5 Panel 4) ──────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--card-bg, #111a2e)',
          border: '1px solid var(--card-border, #1e293b)',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="dw-btn-secondary" style={{ padding: '0.35rem 0.65rem' }} onClick={onBack}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {drawing.drawingNumber} — {drawing.title}
              </span>
              <span className="dw-rev-badge">
                {currentRevision?.revisionNumber || drawing.currentRevisionNumber || 'R00'}
              </span>
              <span className={`dw-status-badge ${statusClass}`}>
                {drawing.currentStatus}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              {drawing.projectName} • {drawing.disciplineName} • {drawing.drawingType}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button className="dw-btn-secondary" onClick={() => onIssueTransmittal([drawing._id])}>
            <Send size={15} /> Issue Transmittal
          </button>
          <button className="dw-btn-primary" onClick={() => setShowUploadModal(true)}>
            <Upload size={15} /> Upload Revision
          </button>
        </div>
      </div>

      {/* ── Center Split: Vector CAD Canvas Preview + Metadata Tabs Panel ─── */}
      <div className="drawings-details-workspace">
        {/* Left: Interactive Architectural CAD Vector / PDF / Blueprint Viewer */}
        <div className="drawings-canvas-card">
          {/* Toolbar matching Screenshot 4 & 5 */}
          <div className="drawings-canvas-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span>Sheet 1 of 1</span>
              <span>•</span>
              <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                {rev?.fileName || `${drawing.drawingNumber}.${fileExt}`}
              </span>
              <span className="dw-file-badge" style={{ fontSize: '0.65rem' }}>
                {fileExt.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {/* View Mode Switcher */}
              <div style={{ display: 'flex', gap: '0.2rem', marginRight: '0.35rem' }}>
                <button
                  type="button"
                  className={
                    (viewMode === 'cad' || (viewMode === 'auto' && isCad))
                      ? 'dw-btn-primary'
                      : 'dw-btn-secondary'
                  }
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  onClick={() => setViewMode('cad')}
                  title="AutoCAD DWG/DXF 2D Wireframe Viewer"
                >
                  AutoCAD Viewer
                </button>
                <button
                  type="button"
                  className={
                    (viewMode === 'pdf' || (viewMode === 'auto' && isPdf))
                      ? 'dw-btn-primary'
                      : 'dw-btn-secondary'
                  }
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  onClick={() => setViewMode('pdf')}
                  title="Vector PDF Drawing Sheet Viewer"
                >
                  PDF Viewer
                </button>
                <button
                  type="button"
                  className={
                    (viewMode === 'blueprint' || (viewMode === 'auto' && !isCad && !isPdf))
                      ? 'dw-btn-primary'
                      : 'dw-btn-secondary'
                  }
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  onClick={() => setViewMode('blueprint')}
                  title="Schematic Blueprint View"
                >
                  Blueprint
                </button>
              </div>

              {/* Pan/Zoom controls when in blueprint or image mode */}
              {(viewMode === 'blueprint' || (viewMode === 'auto' && !isCad && !isPdf)) && (
                <>
                  <button className="dw-btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleZoom(-0.1)} title="Zoom Out">
                    <ZoomOut size={14} />
                  </button>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '45px', textAlign: 'center' }}>
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button className="dw-btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleZoom(0.1)} title="Zoom In">
                    <ZoomIn size={14} />
                  </button>
                  <button className="dw-btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={handleRotate} title="Rotate 90°">
                    <RotateCw size={14} />
                  </button>
                  <button
                    className="dw-btn-secondary"
                    style={{ padding: '0.25rem 0.5rem' }}
                    onClick={() => { setZoomLevel(1); setRotation(0); }}
                    title="Reset View"
                  >
                    Fit
                  </button>
                </>
              )}

              <button
                className="dw-btn-secondary"
                style={{ padding: '0.25rem 0.5rem', color: '#38bdf8' }}
                onClick={handleDownloadDrawing}
                title="Download Drawing File"
              >
                <Download size={14} /> Download
              </button>
            </div>
          </div>

          {/* Interactive Viewport: CAD / PDF / Image / Vector Blueprint */}
          {(viewMode === 'cad' || (viewMode === 'auto' && isCad)) ? (
            <div style={{ flex: 1, minHeight: '560px', width: '100%', position: 'relative' }}>
              <SimpleDrawingViewer
                drawingData={drawingData}
                onBack={onBack}
              />
            </div>
          ) : (viewMode === 'pdf' || (viewMode === 'auto' && isPdf)) ? (
            <div style={{ flex: 1, minHeight: '560px', width: '100%', position: 'relative' }}>
              <PDFViewer
                fileData={rev?.fileData}
                fileName={rev?.fileName || `${drawing.drawingNumber}.pdf`}
              />
            </div>
          ) : (
            <div className="drawings-canvas-viewport">
              <div
                className="drawings-svg-container"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center'
                }}
              >
                {viewMode === 'auto' && isImage && rev?.fileData ? (
                  <img
                    src={rev.fileData}
                    alt={drawing.title}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '540px',
                      borderRadius: '6px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  /* Scalable Vector SVG Architectural Floor Plan Blueprint */
                  <svg
                    width="720"
                    height="520"
                    viewBox="0 0 800 600"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ background: '#0f172a', borderRadius: '6px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                  >
                    <defs>
                      <pattern id="cadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="800" height="600" fill="url(#cadGrid)" />

                    {/* Outer Perimeter Footprint */}
                    <rect x="70" y="50" width="660" height="490" fill="none" stroke="#38bdf8" strokeWidth="3" />
                    <rect x="76" y="56" width="648" height="478" fill="none" stroke="#0284c7" strokeWidth="1" />

                    {/* Column Grids */}
                    <line x1="70" y1="30" x2="70" y2="560" stroke="#64748b" strokeWidth="1" strokeDasharray="5" />
                    <line x1="260" y1="30" x2="260" y2="560" stroke="#64748b" strokeWidth="1" strokeDasharray="5" />
                    <line x1="510" y1="30" x2="510" y2="560" stroke="#64748b" strokeWidth="1" strokeDasharray="5" />
                    <line x1="730" y1="30" x2="730" y2="560" stroke="#64748b" strokeWidth="1" strokeDasharray="5" />

                    {/* Grid Markers */}
                    <circle cx="70" cy="22" r="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="70" y="26" fontSize="10" fontWeight="bold" fill="#38bdf8" textAnchor="middle" fontFamily="sans-serif">A</text>
                    <circle cx="260" cy="22" r="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="260" y="26" fontSize="10" fontWeight="bold" fill="#38bdf8" textAnchor="middle" fontFamily="sans-serif">B</text>
                    <circle cx="510" cy="22" r="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="510" y="26" fontSize="10" fontWeight="bold" fill="#38bdf8" textAnchor="middle" fontFamily="sans-serif">C</text>
                    <circle cx="730" cy="22" r="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="730" y="26" fontSize="10" fontWeight="bold" fill="#38bdf8" textAnchor="middle" fontFamily="sans-serif">D</text>

                    {/* Reinforced Columns */}
                    <rect x="62" y="42" width="16" height="16" fill="#10b981" stroke="#059669" />
                    <rect x="252" y="42" width="16" height="16" fill="#10b981" stroke="#059669" />
                    <rect x="502" y="42" width="16" height="16" fill="#10b981" stroke="#059669" />
                    <rect x="722" y="42" width="16" height="16" fill="#10b981" stroke="#059669" />
                    <rect x="62" y="532" width="16" height="16" fill="#10b981" stroke="#059669" />
                    <rect x="252" y="532" width="16" height="16" fill="#10b981" stroke="#059669" />
                    <rect x="502" y="532" width="16" height="16" fill="#10b981" stroke="#059669" />
                    <rect x="722" y="532" width="16" height="16" fill="#10b981" stroke="#059669" />

                    {/* Rooms */}
                    <rect x="90" y="70" width="320" height="250" fill="rgba(56,189,248,0.06)" stroke="#0284c7" strokeWidth="2" />
                    <text x="250" y="180" fontSize="15" fontWeight="bold" fill="#f8fafc" textAnchor="middle" fontFamily="sans-serif">
                      {drawing.title.toUpperCase()}
                    </text>
                    <text x="250" y="205" fontSize="11" fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif">
                      SCALE 1:100 • REVISION {drawing.currentRevisionNumber || 'R00'}
                    </text>

                    {/* Balcony Deck */}
                    <rect x="90" y="340" width="320" height="180" fill="rgba(16,185,129,0.06)" stroke="#059669" strokeWidth="2" strokeDasharray="6" />
                    <text x="250" y="435" fontSize="13" fontWeight="bold" fill="#34d399" textAnchor="middle" fontFamily="sans-serif">
                      OUTDOOR PODIUM / AMENITY DECK
                    </text>

                    {/* Lift Lobby & Core */}
                    <rect x="430" y="70" width="280" height="280" fill="rgba(168,85,247,0.05)" stroke="#9333ea" strokeWidth="2" />
                    <text x="570" y="195" fontSize="14" fontWeight="bold" fill="#c084fc" textAnchor="middle" fontFamily="sans-serif">
                      CORE LOBBY &amp; STAIRWELL
                    </text>
                    <text x="570" y="220" fontSize="11" fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif">
                      FIRE RATED 2-HR BARRIER
                    </text>

                    {/* Services & Electrical Shafts */}
                    <rect x="430" y="370" width="280" height="150" fill="rgba(245,158,11,0.05)" stroke="#d97706" strokeWidth="2" />
                    <text x="570" y="445" fontSize="13" fontWeight="bold" fill="#fbbf24" textAnchor="middle" fontFamily="sans-serif">
                      ELECTRICAL &amp; MEPF SHAFTS
                    </text>

                    {/* Title Block matching Screenshot 4 */}
                    <rect x="460" y="515" width="265" height="30" fill="#111a2e" stroke="#38bdf8" strokeWidth="1" />
                    <text x="592" y="534" fontSize="10" fill="#f8fafc" textAnchor="middle" fontFamily="monospace">
                      REBAROPTIMA DRAWING REGISTER • {drawing.drawingNumber}
                    </text>
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Metadata Panel with 5 Tabs (Screenshot 5 Panel 4) */}
        <div className="drawings-meta-panel">
          <div className="drawings-meta-tabs">
            <button
              className={`drawings-meta-tab-btn ${activeMetaTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveMetaTab('details')}
            >
              Details
            </button>
            <button
              className={`drawings-meta-tab-btn ${activeMetaTab === 'revisions' ? 'active' : ''}`}
              onClick={() => setActiveMetaTab('revisions')}
            >
              Revisions ({revisions?.length || 1})
            </button>
            <button
              className={`drawings-meta-tab-btn ${activeMetaTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveMetaTab('reviews')}
            >
              Reviews ({reviews?.length || 0})
            </button>
            <button
              className={`drawings-meta-tab-btn ${activeMetaTab === 'transmittals' ? 'active' : ''}`}
              onClick={() => setActiveMetaTab('transmittals')}
            >
              Transmittals
            </button>
            <button
              className={`drawings-meta-tab-btn ${activeMetaTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveMetaTab('activity')}
            >
              Activity
            </button>
          </div>

          <div className="drawings-meta-content">
            {/* Tab: Details */}
            {activeMetaTab === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Drawing Number</div>
                  <div className="drawings-detail-value" style={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                    {drawing.drawingNumber}
                  </div>
                </div>

                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Title</div>
                  <div className="drawings-detail-value">{drawing.title}</div>
                </div>

                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Project</div>
                  <div className="drawings-detail-value">{drawing.projectName} ({drawing.projectCode})</div>
                </div>

                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Discipline</div>
                  <div className="drawings-detail-value">{drawing.disciplineName}</div>
                </div>

                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Drawing Type</div>
                  <div className="drawings-detail-value">{drawing.drawingType}</div>
                </div>

                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Current Revision</div>
                  <div className="drawings-detail-value">
                    <span className="dw-rev-badge">{currentRevision?.revisionNumber || 'R00'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                      ({drawing.currentStatus})
                    </span>
                  </div>
                </div>

                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Description / Scope</div>
                  <div className="drawings-detail-value" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {drawing.description || 'General arrangement drawing for site execution.'}
                  </div>
                </div>

                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Tags</div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {(drawing.tags || ['GA', 'Floor Plan', 'Architectural']).map((t, idx) => (
                      <span key={idx} className="drawings-badge-tag">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Assigned Document Controller</div>
                  <div className="drawings-detail-value">{drawing.assignedControllerName || 'Rahul Singh'}</div>
                </div>

                <div className="drawings-detail-group">
                  <div className="drawings-detail-label">Created At</div>
                  <div className="drawings-detail-value">
                    {new Date(drawing.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Revisions */}
            {activeMetaTab === 'revisions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(revisions || []).map((rev) => (
                  <div
                    key={rev._id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '6px',
                      padding: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span className={`dw-rev-badge ${rev.isSuperseded ? 'superseded' : ''}`}>
                        {rev.revisionNumber}
                      </span>
                      <span className={`dw-status-badge ${rev.workflowStatus === 'Approved' ? 'dw-status-approved' : rev.isSuperseded ? 'dw-status-superseded' : 'dw-status-under-review'}`}>
                        {rev.workflowStatus}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      {rev.changeDescription}
                    </div>

                    <div style={{ fontSize: '0.7rem', color: 'var(--text-label)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>By {rev.uploadedByName}</span>
                      <span>{new Date(rev.uploadedAt || rev.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Reviews */}
            {activeMetaTab === 'reviews' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(!reviews || reviews.length === 0) ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                    No formal review assignments recorded for this revision.
                  </div>
                ) : (
                  reviews.map((r) => (
                    <div
                      key={r._id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '6px',
                        padding: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <strong style={{ fontSize: '0.82rem' }}>{r.reviewerName}</strong>
                        <span className={`dw-status-badge ${r.status === 'Reviewed' ? 'dw-status-approved' : 'dw-status-pending-approval'}`}>
                          {r.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {r.reviewerRole} • {r.isMandatory ? 'Mandatory' : 'Optional'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                        &ldquo;{r.comments || 'Pending reviewer feedback'}&rdquo;
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Transmittals */}
            {activeMetaTab === 'transmittals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(!transmittals || transmittals.length === 0) ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                    This drawing has not yet been issued on a formal transmittal.
                  </div>
                ) : (
                  transmittals.map((t) => (
                    <div
                      key={t._id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '6px',
                        padding: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <strong style={{ color: '#38bdf8', fontSize: '0.82rem' }}>{t.transmittalNumber}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-label)' }}>{t.issueDate}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Purpose: <strong>{t.purpose}</strong>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-label)', marginTop: '0.25rem' }}>
                        Recipients: {t.recipients?.map(r => r.name).join(', ')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Activity */}
            {activeMetaTab === 'activity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {(activities || []).map((act, idx) => (
                  <div
                    key={act._id || idx}
                    style={{
                      fontSize: '0.76rem',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderLeft: '3px solid #38bdf8'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{act.title}</div>
                    <div style={{ color: 'var(--text-secondary)', margin: '0.15rem 0' }}>{act.description}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-label)' }}>
                      By {act.performedByName} • {new Date(act.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Upload New Revision Modal ────────────────────────────────────── */}
      {showUploadModal && (
        <div className="dw-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="dw-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dw-modal-header">
              <div className="dw-modal-title">
                Upload New Revision for {drawing.drawingNumber}
              </div>
              <button className="dw-btn-secondary" style={{ padding: '0.2rem' }} onClick={() => setShowUploadModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div className="dw-modal-body">
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.78rem', color: '#38bdf8' }}>
                  ℹ️ Immutable Revision Rule: Uploading a new revision does NOT overwrite previous files. Previous revisions (R00, R01) remain preserved with their exact audit trail.
                </div>

                {/* ── Revision File Dropzone ── */}
                <div className="dw-form-group">
                  <label className="dw-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>New Revision Drawing File</span>
                    <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>PDF, DWG, DXF, PNG, SVG</span>
                  </label>

                  <input
                    type="file"
                    ref={revFileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.svg,.ifc,.zip"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleRevFileSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {!selectedRevFile ? (
                    <div
                      className={`dw-file-dropzone ${isDraggingRev ? 'active' : ''}`}
                      onClick={() => revFileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingRev(true); }}
                      onDragLeave={() => setIsDraggingRev(false)}
                      onDrop={handleRevDrop}
                    >
                      <UploadCloud size={28} color="#38bdf8" />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                          Click to browse or drop new sheet revision here
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          PDF, CAD (.dwg, .dxf), Vector (.svg), Image
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="dw-file-card">
                      <div className="dw-file-info">
                        <FileCheck size={22} color="#10b981" />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedRevFile.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {(selectedRevFile.size / (1024 * 1024)).toFixed(2)} MB • Checksum SHA-256 Calculated
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="dw-file-badge">
                          {selectedRevFile.name.split('.').pop()?.toUpperCase()}
                        </span>
                        <button
                          type="button"
                          className="dw-btn-secondary"
                          style={{ padding: '0.25rem 0.5rem' }}
                          onClick={() => { setSelectedRevFile(null); setRevFileData(null); }}
                          title="Remove attached file"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Change Description (Changelog) *</label>
                  <textarea
                    rows={3}
                    className="dw-form-textarea"
                    placeholder="e.g. Adjusted ceiling heights to 2.7m for better airflow, updated window specifications..."
                    required
                    value={uploadForm.changeDescription}
                    onChange={(e) => setUploadForm({ ...uploadForm, changeDescription: e.target.value })}
                  />
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Change Reason / Technical Rationale</label>
                  <input
                    type="text"
                    className="dw-form-input"
                    placeholder="e.g. Structural and MEP coordination clash resolution"
                    value={uploadForm.changeReason}
                    onChange={(e) => setUploadForm({ ...uploadForm, changeReason: e.target.value })}
                  />
                </div>
              </div>

              <div className="dw-modal-footer">
                <button type="button" className="dw-btn-secondary" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="dw-btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading & Calculating Checksum...' : 'Commit Immutable Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
