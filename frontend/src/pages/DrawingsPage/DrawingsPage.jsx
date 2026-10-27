import React, { useState, useEffect, useRef } from 'react';
import './DrawingsPage.css';
import { drawingsApi } from '../../utils/drawingsApi';
import SimpleDrawingViewer from './components/SimpleDrawingViewer';
import {
  Search,
  Upload,
  RefreshCw,
  Folder,
  FileImage,
  Eye,
  Download,
  X,
  Layers2,
  FileText,
  Calendar,
  Grid,
  List,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function DrawingsPage() {
  const [loading, setLoading] = useState(true);
  const [drawings, setDrawings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [disciplines, setDisciplines] = useState([]);

  // Selected Drawing to View
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [selectedDrawingDetail, setSelectedDrawingDetail] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [viewLayout, setViewLayout] = useState('grid'); // 'grid' | 'table'

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFileData, setUploadFileData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    drawingNumber: '',
    projectId: '',
    disciplineId: '',
    newProjectName: ''
  });

  const fileInputRef = useRef(null);

  // Load All Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [dwsRes, prjsRes, discsRes] = await Promise.all([
        drawingsApi.getDrawings().catch(() => ({ drawings: [] })),
        drawingsApi.getProjects().catch(() => []),
        drawingsApi.getDisciplines().catch(() => [])
      ]);

      const loadedDrawings = dwsRes.drawings || [];
      setDrawings(loadedDrawings);
      setProjects(prjsRes || []);
      setDisciplines(discsRes || []);

      // Pre-populate default project in upload form
      if (prjsRes && prjsRes.length > 0 && !uploadForm.projectId) {
        setUploadForm((prev) => ({
          ...prev,
          projectId: prjsRes[0]._id,
          disciplineId: discsRes?.[0]?._id || ''
        }));
      }
    } catch (err) {
      console.error('Error loading drawings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open Drawing in Simple Viewer
  const handleOpenDrawing = async (dw) => {
    setSelectedDrawing(dw);
    try {
      const detail = await drawingsApi.getDrawingDetail(dw._id);
      setSelectedDrawingDetail(detail);
    } catch (err) {
      console.error('Failed to load drawing detail:', err);
      // Fallback: construct detail from list item
      setSelectedDrawingDetail({
        drawing: dw,
        currentRevision: {
          fileData: dw.fileData,
          fileName: dw.fileName || `${dw.drawingNumber}.png`,
          fileType: dw.fileType || 'png'
        }
      });
    }
  };

  // Close Viewer
  const handleCloseViewer = () => {
    setSelectedDrawing(null);
    setSelectedDrawingDetail(null);
  };

  // Quick Download from List
  const handleDownloadFile = (e, dw) => {
    e.stopPropagation();
    if (dw.fileData) {
      const link = document.createElement('a');
      link.href = dw.fileData;
      link.download = dw.fileName || `${dw.drawingNumber || 'drawing'}.${dw.fileType || 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Fetch details then download
      drawingsApi.getDrawingDetail(dw._id).then((detail) => {
        const rev = detail.currentRevision || detail.revisions?.[0];
        if (rev?.fileData) {
          const link = document.createElement('a');
          link.href = rev.fileData;
          link.download = rev.fileName || `${dw.drawingNumber}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          alert('Drawing file content is not available.');
        }
      });
    }
  };

  // Filter Drawings
  const filteredDrawings = drawings.filter((dw) => {
    if (projectFilter !== 'all' && String(dw.projectId) !== String(projectFilter)) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const matchNo = dw.drawingNumber?.toLowerCase().includes(term);
      const matchTitle = dw.title?.toLowerCase().includes(term);
      const matchProject = dw.projectName?.toLowerCase().includes(term);
      if (!matchNo && !matchTitle && !matchProject) return false;
    }
    return true;
  });

  // Handle File Selection in Upload Modal
  const handleFileSelect = (file) => {
    if (!file) return;
    setUploadFile(file);
    setUploadError('');

    // Auto-populate Title if empty
    if (!uploadForm.title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setUploadForm((prev) => ({ ...prev, title: cleanName }));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadFileData(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Handle Upload Submit
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile && !uploadFileData) {
      setUploadError('Please select a drawing image or PDF file to upload.');
      return;
    }
    if (!uploadForm.title.trim()) {
      setUploadError('Please enter a drawing title.');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      let activeProjectId = uploadForm.projectId;

      // Create new project if user selected new project
      if (activeProjectId === 'new' && uploadForm.newProjectName.trim()) {
        const code = uploadForm.newProjectName.substring(0, 3).toUpperCase();
        const newProj = await drawingsApi.createProject({
          projectName: uploadForm.newProjectName.trim(),
          projectCode: code,
          location: 'Site Location',
          status: 'Active'
        });
        activeProjectId = newProj._id;
        await loadData();
      } else if (!activeProjectId && projects.length > 0) {
        activeProjectId = projects[0]._id;
      }

      const activeDisciplineId =
        uploadForm.disciplineId || (disciplines.length > 0 ? disciplines[0]._id : undefined);

      const fileExt = (uploadFile?.name.split('.').pop() || 'png').toLowerCase();

      const payload = {
        title: uploadForm.title.trim(),
        drawingNumber: uploadForm.drawingNumber.trim() || undefined,
        projectId: activeProjectId,
        disciplineId: activeDisciplineId,
        drawingType: 'General Arrangement',
        initialChangeDescription: 'Initial drawing upload',
        fileData: uploadFileData,
        fileName: uploadFile ? uploadFile.name : `drawing.${fileExt}`,
        fileSize: uploadFile ? uploadFile.size : 0,
        fileType: fileExt
      };

      const res = await drawingsApi.createDrawing(payload);
      await loadData();

      // Reset Form & Close Modal
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadFileData(null);
      setUploadForm({
        title: '',
        drawingNumber: '',
        projectId: projects[0]?._id || '',
        disciplineId: disciplines[0]?._id || '',
        newProjectName: ''
      });

      // Automatically open uploaded drawing in simple viewer!
      if (res?._id) {
        const detail = await drawingsApi.getDrawingDetail(res._id);
        setSelectedDrawing(detail.drawing || res);
        setSelectedDrawingDetail(detail);
      }
    } catch (err) {
      console.error('Upload drawing error:', err);
      setUploadError(err.message || 'Failed to upload drawing. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER 1: SIMPLE VIEWER MODE
  // ─────────────────────────────────────────────────────────────────────────
  if (selectedDrawingDetail) {
    return (
      <div className="drawings-module-root" style={{ padding: '1rem' }}>
        <SimpleDrawingViewer
          drawingData={selectedDrawingDetail}
          onBack={handleCloseViewer}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER 2: DRAWING GALLERY & UPLOAD WORKSPACE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="drawings-module-root">
      {/* ── Clean Top Header Bar ────────────────────────────────────────── */}
      <div className="drawings-top-header">
        <div className="drawings-brand-section">
          <div className="drawings-module-title">
            <Layers2 size={22} color="#38bdf8" />
            <span>Drawing &amp; Files</span>
          </div>
          <span className="drawings-badge-tag">Image &amp; PDF Viewer</span>
        </div>

        {/* Search Bar */}
        <div className="drawings-header-search">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search drawings by name or number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Right Actions */}
        <div className="drawings-header-actions">
          <button
            className="dw-btn-secondary"
            style={{ padding: '0.45rem 0.75rem', gap: '0.4rem' }}
            onClick={loadData}
            title="Refresh Drawings"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="dw-btn-primary"
            style={{ padding: '0.45rem 1rem', gap: '0.45rem', fontWeight: 600 }}
            onClick={() => {
              setUploadError('');
              setShowUploadModal(true);
            }}
          >
            <Upload size={15} />
            <span>Upload Drawing</span>
          </button>
        </div>
      </div>

      {/* ── Subheader Controls Bar (Project Filter & View Toggles) ──────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#111a2e',
          borderBottom: '1px solid #1e293b',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        {/* Project Selector Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Project:</span>
          <button
            onClick={() => setProjectFilter('all')}
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: projectFilter === 'all' ? '#0284c7' : '#1e293b',
              color: projectFilter === 'all' ? '#ffffff' : '#94a3b8',
              border: '1px solid ' + (projectFilter === 'all' ? '#0369a1' : '#334155'),
              cursor: 'pointer'
            }}
          >
            All Projects ({drawings.length})
          </button>

          {projects.map((prj) => {
            const count = drawings.filter((d) => String(d.projectId) === String(prj._id)).length;
            const isSelected = String(projectFilter) === String(prj._id);
            return (
              <button
                key={prj._id}
                onClick={() => setProjectFilter(prj._id)}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: isSelected ? '#0284c7' : '#1e293b',
                  color: isSelected ? '#ffffff' : '#94a3b8',
                  border: '1px solid ' + (isSelected ? '#0369a1' : '#334155'),
                  cursor: 'pointer'
                }}
              >
                {prj.projectName} ({count})
              </button>
            );
          })}
        </div>

        {/* View Layout Switcher (Grid vs Table) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', marginRight: '0.4rem' }}>
            {filteredDrawings.length} {filteredDrawings.length === 1 ? 'drawing' : 'drawings'}
          </span>
          <button
            onClick={() => setViewLayout('grid')}
            title="Grid View"
            style={{
              padding: '0.35rem 0.55rem',
              borderRadius: '6px',
              backgroundColor: viewLayout === 'grid' ? '#1e293b' : 'transparent',
              color: viewLayout === 'grid' ? '#38bdf8' : '#64748b',
              border: '1px solid ' + (viewLayout === 'grid' ? '#334155' : 'transparent'),
              cursor: 'pointer'
            }}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewLayout('table')}
            title="Table View"
            style={{
              padding: '0.35rem 0.55rem',
              borderRadius: '6px',
              backgroundColor: viewLayout === 'table' ? '#1e293b' : 'transparent',
              color: viewLayout === 'table' ? '#38bdf8' : '#64748b',
              border: '1px solid ' + (viewLayout === 'table' ? '#334155' : 'transparent'),
              cursor: 'pointer'
            }}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* ── Main Workspace Body ─────────────────────────────────────────── */}
      <div className="drawings-viewport">
        {loading && drawings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 1rem', color: '#38bdf8' }} />
            <p style={{ fontSize: '0.9rem' }}>Loading drawings...</p>
          </div>
        ) : filteredDrawings.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              backgroundColor: '#111a2e',
              border: '1px dashed #334155',
              borderRadius: '12px',
              maxWidth: '560px',
              margin: '2rem auto'
            }}
          >
            <FileImage size={48} color="#64748b" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
              No Drawings Found
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              {searchTerm || projectFilter !== 'all'
                ? 'No drawings match your search or filter criteria. Try clearing filters.'
                : 'Upload your structural, architectural, or beam drawings as image (PNG/JPG) or PDF to view them instantly.'}
            </p>
            <button
              className="dw-btn-primary"
              onClick={() => setShowUploadModal(true)}
              style={{ margin: '0 auto', padding: '0.55rem 1.25rem', gap: '0.5rem' }}
            >
              <Upload size={16} />
              <span>Upload Drawing</span>
            </button>
          </div>
        ) : viewLayout === 'grid' ? (
          /* ── GRID CARDS VIEW ──────────────────────────────────────────── */
          <div className="dw-gallery-grid">
            {filteredDrawings.map((dw) => {
              const fileExt = (dw.fileType || dw.fileName?.split('.').pop() || 'png').toLowerCase();
              const isImg = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(fileExt);
              const isPdf = fileExt === 'pdf';

              return (
                <div
                  key={dw._id}
                  className="dw-drawing-card"
                  onClick={() => handleOpenDrawing(dw)}
                  title={`Click to open ${dw.title} in viewer`}
                >
                  {/* Card Thumbnail Box */}
                  <div className="dw-card-preview">
                    {isImg && dw.fileData ? (
                      <img src={dw.fileData} alt={dw.title} loading="lazy" />
                    ) : isPdf ? (
                      <div style={{ textAlign: 'center', color: '#38bdf8' }}>
                        <FileText size={40} style={{ margin: '0 auto 0.4rem', opacity: 0.85 }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                          PDF DRAWING SHEET
                        </span>
                      </div>
                    ) : (fileExt === 'dwg' || fileExt === 'dxf') ? (
                      <div style={{ textAlign: 'center', color: '#38bdf8' }}>
                        <Layers2 size={40} style={{ margin: '0 auto 0.4rem', opacity: 0.85 }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                          AUTOCAD DWG DRAWING
                        </span>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <FileImage size={40} style={{ margin: '0 auto 0.4rem', opacity: 0.7 }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                          {fileExt.toUpperCase()} FILE
                        </span>
                      </div>
                    )}

                    {/* Hover Overlay Button */}
                    <div className="dw-card-overlay">
                      <button
                        type="button"
                        className="dw-btn-primary"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', gap: '0.35rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDrawing(dw);
                        }}
                      >
                        <Eye size={14} /> Open Viewer
                      </button>
                      <button
                        type="button"
                        className="dw-btn-secondary"
                        style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem' }}
                        onClick={(e) => handleDownloadFile(e, dw)}
                        title="Download File"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="dw-card-body">
                    <div className="dw-card-header">
                      <span className="dw-card-title">{dw.title}</span>
                      <span className="dw-file-badge">{fileExt}</span>
                    </div>

                    <div className="dw-card-project">
                      <Folder size={12} />
                      <span>{dw.projectName || 'General Project'}</span>
                    </div>

                    <div className="dw-card-footer">
                      <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
                        {dw.drawingNumber}
                      </span>
                      <span>
                        {dw.updatedAt ? new Date(dw.updatedAt).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── TABLE LIST VIEW ─────────────────────────────────────────── */
          <div
            style={{
              backgroundColor: '#111a2e',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid #1e293b', color: '#64748b' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Drawing No</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Title</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Project</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Format</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrawings.map((dw) => {
                  const fileExt = (dw.fileType || dw.fileName?.split('.').pop() || 'png').toLowerCase();
                  return (
                    <tr
                      key={dw._id}
                      onClick={() => handleOpenDrawing(dw)}
                      style={{
                        borderBottom: '1px solid rgba(30, 41, 59, 0.5)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
                        {dw.drawingNumber}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                        {dw.title}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>
                        {dw.projectName || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className="dw-file-badge">{fileExt}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {dw.updatedAt ? new Date(dw.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="dw-btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', gap: '0.3rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawing(dw);
                            }}
                          >
                            <Eye size={13} /> View
                          </button>
                          <button
                            type="button"
                            className="dw-btn-secondary"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={(e) => handleDownloadFile(e, dw)}
                            title="Download File"
                          >
                            <Download size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Upload Drawing Modal ─────────────────────────────────────────── */}
      {showUploadModal && (
        <div className="dw-modal-backdrop" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="dw-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="dw-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                  Upload New Drawing
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !uploading && setShowUploadModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.2rem'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUploadSubmit}>
              <div className="dw-modal-body">
                {uploadError && (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <AlertCircle size={15} />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* File Dropzone */}
                <div>
                  <label className="dw-form-label" style={{ marginBottom: '0.35rem', display: 'block' }}>
                    Select Drawing Image or PDF File *
                  </label>
                  <div
                    className="dw-file-dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,.gif,.dwg,.dxf"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileSelect(e.target.files[0])}
                    />

                    {uploadFileData ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                        {uploadFile?.type.startsWith('image/') || uploadFile?.name.match(/\.(png|jpg|jpeg|webp|svg)$/i) ? (
                          <img
                            src={uploadFileData}
                            alt="Preview"
                            style={{
                              width: '64px',
                              height: '64px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              border: '1px solid #334155'
                            }}
                          />
                        ) : uploadFile?.name.match(/\.(dwg|dxf)$/i) ? (
                          <div
                            style={{
                              width: '64px',
                              height: '64px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#38bdf8'
                            }}
                          >
                            <Layers2 size={32} />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '64px',
                              height: '64px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#38bdf8'
                            }}
                          >
                            <FileText size={32} />
                          </div>
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {uploadFile?.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                            {Math.round((uploadFile?.size || 0) / 1024)} KB • Click to change file
                          </div>
                        </div>
                        <CheckCircle2 size={20} color="#10b981" />
                      </div>
                    ) : (
                      <>
                        <Upload size={28} color="#38bdf8" />
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                            Click to browse or drag &amp; drop
                          </span>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                            Supports PNG, JPG, JPEG, WebP, SVG, PDF, and AutoCAD DWG/DXF drawings
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Drawing Title */}
                <div>
                  <label className="dw-form-label" style={{ marginBottom: '0.35rem', display: 'block' }}>
                    Drawing Title *
                  </label>
                  <input
                    type="text"
                    className="dw-form-input"
                    placeholder="e.g. First Floor Beam Layout"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    required
                  />
                </div>

                {/* Project Selection */}
                <div>
                  <label className="dw-form-label" style={{ marginBottom: '0.35rem', display: 'block' }}>
                    Project *
                  </label>
                  <select
                    className="dw-form-select"
                    value={uploadForm.projectId}
                    onChange={(e) => setUploadForm({ ...uploadForm, projectId: e.target.value })}
                  >
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.projectName} ({p.projectCode})
                      </option>
                    ))}
                    <option value="new">+ Create New Project...</option>
                  </select>

                  {uploadForm.projectId === 'new' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        className="dw-form-input"
                        placeholder="Enter new project name (e.g. Horizon Towers)"
                        value={uploadForm.newProjectName}
                        onChange={(e) => setUploadForm({ ...uploadForm, newProjectName: e.target.value })}
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Drawing Number (Optional) */}
                <div>
                  <label className="dw-form-label" style={{ marginBottom: '0.35rem', display: 'block' }}>
                    Drawing Number (Optional)
                  </label>
                  <input
                    type="text"
                    className="dw-form-input"
                    placeholder="e.g. DWG-001 (Leave blank to auto-generate)"
                    value={uploadForm.drawingNumber}
                    onChange={(e) => setUploadForm({ ...uploadForm, drawingNumber: e.target.value })}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="dw-modal-footer">
                <button
                  type="button"
                  className="dw-btn-secondary"
                  disabled={uploading}
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dw-btn-primary"
                  disabled={uploading}
                  style={{ gap: '0.4rem' }}
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Upload &amp; View Drawing</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
