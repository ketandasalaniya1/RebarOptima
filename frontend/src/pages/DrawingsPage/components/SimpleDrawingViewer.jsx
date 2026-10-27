import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Download,
  ArrowLeft,
  FileText,
  Eye,
  AlertCircle,
  FileImage,
  RefreshCw,
  Expand,
  Shrink
} from 'lucide-react';
import PDFViewer from './PDFViewer';
import CADViewer from './CADViewer';
import { AcApDocManager } from '@mlightcad/cad-simple-viewer';

export default function SimpleDrawingViewer({ drawingData, onBack }) {
  const { drawing, currentRevision, revisions } = drawingData || {};
  const rev = currentRevision || revisions?.[0];

  const fileExt = (
    rev?.fileType ||
    rev?.fileName?.split('.').pop() ||
    drawing?.fileType ||
    'png'
  ).toLowerCase();

  const isPdf = fileExt === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp'].includes(fileExt);
  const isCadFile = ['dwg', 'dxf'].includes(fileExt);

  // Pan & Zoom States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Reset View to Center & 100%
  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // Zoom Handler
  const handleZoom = (delta) => {
    setZoom((prev) => {
      const next = Number((prev + delta).toFixed(2));
      return Math.min(5, Math.max(0.2, next));
    });
  };

  // Rotate Handler (90 degrees clockwise)
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Mouse Wheel Zoom
  const handleWheel = (e) => {
    if (!isImage) return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    handleZoom(zoomFactor);
  };

  // Pan / Drag Handlers
  const handleMouseDown = (e) => {
    if (!isImage) return;
    // Only primary mouse button
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double Click toggles Fit / 200% zoom
  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      handleResetView();
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Download File Handler
  const handleDownload = () => {
    if (!drawing) return;
    const fileName = rev?.fileName || `${drawing.drawingNumber || 'drawing'}.${fileExt}`;

    if (rev?.fileData) {
      const link = document.createElement('a');
      link.href = rev.fileData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert('Drawing file content is not available for download.');
    }
  };

  if (!drawing) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
        <p>No drawing selected.</p>
        <button
          className="dw-btn-secondary"
          onClick={onBack}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
        >
          <ArrowLeft size={16} /> Back to Drawings
        </button>
      </div>
    );
  }

  const drawingNumber = drawing.drawingNumber || 'DWG-001';
  const drawingTitle = drawing.title || 'Untitled Drawing';
  const projectName = drawing.projectName || 'General Project';
  const fileData = rev?.fileData || drawing.fileData;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 140px)',
        minHeight: '600px',
        backgroundColor: '#0b1120',
        borderRadius: '10px',
        border: '1px solid #1e293b',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* ── Top Viewer Header Bar ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 1.25rem',
          backgroundColor: '#111a2e',
          borderBottom: '1px solid #1e293b',
          zIndex: 10,
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        {/* Left: Back button + Title info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            onClick={onBack}
            className="dw-btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              borderRadius: '6px',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              cursor: 'pointer'
            }}
            title="Return to Drawing List"
          >
            <ArrowLeft size={16} />
            <span>Back to Drawings</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                {drawingTitle}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}
              >
                {drawingNumber}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  textTransform: 'uppercase'
                }}
              >
                {fileExt}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
              Project: <span style={{ color: '#94a3b8' }}>{projectName}</span>
              {rev?.fileName && (
                <>
                  {' '}• File: <span style={{ color: '#94a3b8' }}>{rev.fileName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Viewing Controls (Zoom, Rotate, Fit, Download) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {isImage && (
            <>
              {/* Zoom Out */}
              <button
                type="button"
                onClick={() => handleZoom(-0.2)}
                title="Zoom Out"
                style={{
                  padding: '0.4rem 0.6rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ZoomOut size={16} />
              </button>

              {/* Zoom Level Indicator / Reset */}
              <button
                type="button"
                onClick={handleResetView}
                title="Click to reset zoom to 100%"
                style={{
                  padding: '0.4rem 0.65rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  minWidth: '55px',
                  textAlign: 'center'
                }}
              >
                {Math.round(zoom * 100)}%
              </button>

              {/* Zoom In */}
              <button
                type="button"
                onClick={() => handleZoom(0.2)}
                title="Zoom In"
                style={{
                  padding: '0.4rem 0.6rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ZoomIn size={16} />
              </button>

              {/* Rotate 90 deg */}
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90° Clockwise"
                style={{
                  padding: '0.4rem 0.6rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <RotateCw size={16} />
              </button>

              {/* Fit / Reset */}
              <button
                type="button"
                onClick={handleResetView}
                title="Fit to Screen"
                style={{
                  padding: '0.4rem 0.65rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.78rem'
                }}
              >
                <Maximize2 size={15} />
                <span>Fit</span>
              </button>
            </>
          )}

          {/* Fit button for DWG files */}
          {isCadFile && (
            <button
              type="button"
              onClick={() => {
                try {
                  window.dispatchEvent(new Event('resize'));
                  const inst = AcApDocManager?.tryGetInstance?.() || AcApDocManager?.instance;
                  inst?.curView?.zoomToFitDrawing?.();
                } catch (e) {
                  console.warn('CAD zoomToFit notice:', e);
                }
              }}
              title="Fit CAD Drawing to Screen"
              style={{
                padding: '0.4rem 0.65rem',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#38bdf8',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.78rem'
              }}
            >
              <Maximize2 size={15} />
              <span>Fit</span>
            </button>
          )}

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
            style={{
              padding: '0.4rem 0.6rem',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isFullscreen ? <Shrink size={16} /> : <Expand size={16} />}
          </button>

          {/* Download Original File */}
          <button
            type="button"
            onClick={handleDownload}
            title="Download Drawing File"
            style={{
              padding: '0.4rem 0.85rem',
              backgroundColor: '#0284c7',
              border: '1px solid #0369a1',
              color: '#ffffff',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <Download size={15} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* ── Main Drawing Viewport (Images / PDFs / DWG CAD Vector View) ────── */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#090d16',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isImage ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Case 1: PDF Document Viewer */}
        {isPdf ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <PDFViewer fileData={fileData} fileName={rev?.fileName || `${drawingNumber}.pdf`} />
          </div>
        ) : isImage && fileData ? (
          /* Case 2: Crisp Image Viewer (PNG, JPG, SVG, WebP) with Pan & Zoom */
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '96%',
              maxHeight: '96%'
            }}
          >
            <img
              ref={imageRef}
              src={fileData}
              alt={drawingTitle}
              draggable={false}
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '4px',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
            />
          </div>
        ) : isCadFile && fileData ? (
          /* Case 3: Actual DWG / DXF Drawing Viewer (Clean vector rendering, no ribbons) */
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <CADViewer
              fileData={fileData}
              fileName={rev?.fileName || `${drawingNumber}.${fileExt}`}
            />
          </div>
        ) : (
          /* Case 4: Drawing has no uploaded file data yet */
          <div
            style={{
              textAlign: 'center',
              padding: '2.5rem',
              maxWidth: '480px',
              backgroundColor: '#111a2e',
              border: '1px solid #1e293b',
              borderRadius: '10px'
            }}
          >
            <FileImage size={40} color="#64748b" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.4rem' }}>
              No Image File Uploaded Yet
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              This drawing record does not have an attached image or PDF sheet.
            </p>
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.82rem'
              }}
            >
              <ArrowLeft size={14} style={{ marginRight: '0.35rem' }} /> Return to Drawings
            </button>
          </div>
        )}

        {/* Floating Pan & Zoom Hint at bottom right */}
        {(isImage || isCadFile) && fileData && (
          <div
            style={{
              position: 'absolute',
              bottom: '14px',
              right: '16px',
              backgroundColor: 'rgba(17, 26, 46, 0.85)',
              backdropFilter: 'blur(6px)',
              border: '1px solid #1e293b',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.72rem',
              color: '#64748b',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              zIndex: 20
            }}
          >
            <span>Drag to Pan</span>
            <span>•</span>
            <span>Scroll to Zoom</span>
            {isCadFile && <span>• DWG Drawing View</span>}
          </div>
        )}
      </div>
    </div>
  );
}
