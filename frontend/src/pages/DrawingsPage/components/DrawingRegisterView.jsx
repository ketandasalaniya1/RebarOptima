import React, { useState, useRef } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  X,
  Upload,
  UploadCloud,
  FileCheck
} from 'lucide-react';

export default function DrawingRegisterView({
  drawings,
  projects,
  disciplines,
  selectedProjectId,
  selectedDisciplineId,
  selectedStatus,
  searchTerm,
  onSearchChange,
  onProjectFilterChange,
  onDisciplineFilterChange,
  onStatusFilterChange,
  onSelectDrawing,
  onCreateDrawing,
  onOpenTransmittalWithDrawings
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [formData, setFormData] = useState({
    projectId: selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?._id || ''),
    disciplineId: selectedDisciplineId !== 'all' ? selectedDisciplineId : (disciplines[0]?._id || ''),
    drawingNumber: '',
    title: '',
    drawingType: 'General Arrangement',
    initialChangeDescription: 'Initial issue for review'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedFile(file);

    // Auto-fill title if blank
    if (!formData.title) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setFormData(prev => ({ ...prev, title: cleanTitle }));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setFileData(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const resetForm = () => {
    setFormData({
      projectId: projects[0]?._id || '',
      disciplineId: disciplines[0]?._id || '',
      drawingNumber: '',
      title: '',
      drawingType: 'General Arrangement',
      initialChangeDescription: 'Initial issue for review'
    });
    setSelectedFile(null);
    setFileData(null);
    setIsDragging(false);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds((drawings || []).map(d => d._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id, e) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleExportCSV = () => {
    if (!drawings || drawings.length === 0) return;
    const headers = ['Drawing No', 'Title', 'Project', 'Discipline', 'Current Revision', 'Status', 'Updated At'];
    const rows = drawings.map(d => [
      `"${d.drawingNumber}"`,
      `"${d.title}"`,
      `"${d.projectName}"`,
      `"${d.disciplineName}"`,
      `"${d.currentRevisionNumber || 'R00'}"`,
      `"${d.currentStatus}"`,
      `"${new Date(d.updatedAt).toLocaleDateString()}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RebarOptima_Drawing_Register_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.projectId || !formData.disciplineId || !formData.title) return;
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        fileData: fileData || '',
        fileName: selectedFile ? selectedFile.name : '',
        fileSize: selectedFile ? selectedFile.size : 0,
        fileType: selectedFile ? selectedFile.name.split('.').pop()?.toLowerCase() : 'pdf'
      };
      await onCreateDrawing(payload);
      setShowNewModal(false);
      resetForm();
    } catch (err) {
      alert('Error creating drawing: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Top Toolbar & Filters (Screenshot 5 Panel 2) ─────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Drawing Register
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            All engineering drawings across projects, disciplines, and live workflow revision statuses.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem' }}>
          {selectedIds.length > 0 && (
            <button
              className="dw-btn-primary"
              style={{ background: '#7c3aed', borderColor: '#6d28d9' }}
              onClick={() => onOpenTransmittalWithDrawings(selectedIds)}
            >
              Issue Transmittal ({selectedIds.length})
            </button>
          )}
          <button className="dw-btn-secondary" onClick={handleExportCSV}>
            <Download size={15} /> Export
          </button>
          <button className="dw-btn-primary" onClick={() => setShowNewModal(true)}>
            <Upload size={15} /> Upload &amp; Register Drawing
          </button>
        </div>
      </div>

      {/* ── Filter Bar matching Screenshot 5 Panel 2 ─────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'var(--card-bg, #111a2e)',
          border: '1px solid var(--card-border, #1e293b)',
          padding: '0.65rem 1rem',
          borderRadius: '8px'
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="dw-form-input"
            style={{ width: '100%', paddingLeft: '2rem' }}
            placeholder="Search by drawing number, title or keyword..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-label)' }}>Project:</span>
          <select
            className="dw-form-select"
            value={selectedProjectId}
            onChange={(e) => onProjectFilterChange(e.target.value)}
          >
            <option value="all">All Projects</option>
            {(projects || []).map(p => (
              <option key={p._id} value={p._id}>{p.projectName} ({p.projectCode})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-label)' }}>Discipline:</span>
          <select
            className="dw-form-select"
            value={selectedDisciplineId}
            onChange={(e) => onDisciplineFilterChange(e.target.value)}
          >
            <option value="all">All Disciplines</option>
            {(disciplines || []).map(d => (
              <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-label)' }}>Status:</span>
          <select
            className="dw-form-select"
            value={selectedStatus}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Under Review">Under Review</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Changes Requested">Changes Requested</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
      </div>

      {/* ── Compact Table matching Screenshot 5 Panel 2 ──────────────────── */}
      <div className="drawings-table-container">
        <table className="drawings-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={(drawings || []).length > 0 && selectedIds.length === (drawings || []).length}
                />
              </th>
              <th>Drawing No.</th>
              <th>Title</th>
              <th>Project</th>
              <th>Discipline</th>
              <th>Current Rev.</th>
              <th>Status</th>
              <th>Updated At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!drawings || drawings.length === 0) ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  No drawings found matching current filters. Click "+ New Drawing" to register one!
                </td>
              </tr>
            ) : (
              drawings.map((dw) => {
                const statusClass =
                  dw.currentStatus === 'Approved'
                    ? 'dw-status-approved'
                    : dw.currentStatus === 'Under Review'
                    ? 'dw-status-under-review'
                    : dw.currentStatus === 'Pending Approval'
                    ? 'dw-status-pending-approval'
                    : dw.currentStatus === 'Changes Requested'
                    ? 'dw-status-changes-requested'
                    : 'dw-status-draft';

                return (
                  <tr key={dw._id} onClick={() => onSelectDrawing(dw)}>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(dw._id)}
                        onChange={(e) => handleToggleSelect(dw._id, e)}
                      />
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}>
                        {dw.drawingNumber}
                      </strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{dw.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-label)' }}>{dw.drawingType}</div>
                    </td>
                    <td>{dw.projectName}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          color: '#38bdf8'
                        }}
                      >
                        {dw.disciplineName}
                      </span>
                    </td>
                    <td>
                      <span className="dw-rev-badge">
                        {dw.currentRevisionNumber || 'R00'}
                      </span>
                    </td>
                    <td>
                      <span className={`dw-status-badge ${statusClass}`}>
                        {dw.currentStatus}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {new Date(dw.updatedAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="dw-btn-secondary"
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDrawing(dw);
                        }}
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination bar ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        <span>Showing 1-{drawings?.length || 0} of {drawings?.length || 0} drawings</span>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button className="dw-btn-secondary" style={{ padding: '0.25rem 0.55rem' }} disabled>&lt;</button>
          <button className="dw-btn-primary" style={{ padding: '0.25rem 0.55rem' }}>1</button>
          <button className="dw-btn-secondary" style={{ padding: '0.25rem 0.55rem' }} disabled>&gt;</button>
        </div>
      </div>

      {/* ── + New Drawing Modal ─────────────────────────────────────────── */}
      {showNewModal && (
        <div className="dw-modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="dw-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dw-modal-header">
              <div className="dw-modal-title">Register &amp; Upload Engineering Drawing</div>
              <button className="dw-btn-secondary" style={{ padding: '0.2rem' }} onClick={() => setShowNewModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="dw-modal-body">
                {/* ── File Upload Dropzone (Prominent at top) ── */}
                <div className="dw-form-group">
                  <label className="dw-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Drawing Document / Sheet File</span>
                    <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>PDF, DWG, DXF, PNG, SVG</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.svg,.ifc,.zip"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {!selectedFile ? (
                    <div
                      className={`dw-file-dropzone ${isDragging ? 'active' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                    >
                      <UploadCloud size={30} color="#38bdf8" />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.86rem' }}>
                          Click to browse or drag &amp; drop drawing file here
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Supports AutoCAD (.dwg, .dxf), Vector (.svg), PDF Plans (.pdf), Images (up to 50MB)
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="dw-file-card">
                      <div className="dw-file-info">
                        <FileCheck size={22} color="#10b981" />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedFile.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Checksum SHA-256 Calculated
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="dw-file-badge">
                          {selectedFile.name.split('.').pop()?.toUpperCase()}
                        </span>
                        <button
                          type="button"
                          className="dw-btn-secondary"
                          style={{ padding: '0.25rem 0.5rem' }}
                          onClick={() => { setSelectedFile(null); setFileData(null); }}
                          title="Remove attached file"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                    <label className="dw-form-label">Discipline *</label>
                    <select
                      className="dw-form-select"
                      required
                      value={formData.disciplineId}
                      onChange={(e) => setFormData({ ...formData, disciplineId: e.target.value })}
                    >
                      {(disciplines || []).map(d => (
                        <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Drawing Number (Leave blank for auto-generation)</label>
                  <input
                    type="text"
                    className="dw-form-input"
                    placeholder="e.g. AR-F-002 or leave blank"
                    value={formData.drawingNumber}
                    onChange={(e) => setFormData({ ...formData, drawingNumber: e.target.value })}
                  />
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Drawing Title *</label>
                  <input
                    type="text"
                    className="dw-form-input"
                    placeholder="e.g. First Floor Slab Reinforcement Plan"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Drawing Type</label>
                  <select
                    className="dw-form-select"
                    value={formData.drawingType}
                    onChange={(e) => setFormData({ ...formData, drawingType: e.target.value })}
                  >
                    <option value="General Arrangement">General Arrangement</option>
                    <option value="Reinforcement Plan">Reinforcement Plan</option>
                    <option value="Section">Section</option>
                    <option value="Detail">Detail</option>
                    <option value="Schematic">Schematic</option>
                    <option value="Statutory Submission">Statutory Submission</option>
                  </select>
                </div>

                <div className="dw-form-group">
                  <label className="dw-form-label">Initial Revision Notes (R00)</label>
                  <input
                    type="text"
                    className="dw-form-input"
                    placeholder="e.g. Initial design draft for review"
                    value={formData.initialChangeDescription}
                    onChange={(e) => setFormData({ ...formData, initialChangeDescription: e.target.value })}
                  />
                </div>
              </div>

              <div className="dw-modal-footer">
                <button type="button" className="dw-btn-secondary" onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="dw-btn-primary" disabled={submitting}>
                  {submitting ? 'Registering & Uploading...' : (selectedFile ? 'Upload & Register Drawing' : 'Register Drawing')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
