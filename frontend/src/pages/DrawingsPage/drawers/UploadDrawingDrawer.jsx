import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Info, Plus } from 'lucide-react';
import { parseDrawingFilename } from '../utils/filenameParser';
import { drawingsApi } from '../../../utils/drawingsApi';

const DISCIPLINES = ['Architectural', 'Structural', 'MEPF', 'Civil', 'General'];
const BLOCKS = ['Block A', 'Block B', 'Tower 1', 'Main Tower'];
const LEVELS = [
  'Terrace',
  'Level 10',
  'Level 9',
  'Level 8',
  'Level 7',
  'Level 6',
  'Level 5',
  'Level 4',
  'Level 3',
  'Level 2',
  'Level 1',
  'Ground',
  'Basement 1',
  'Basement 2',
];

export default function UploadDrawingDrawer({
  isOpen,
  onClose,
  activeProjectId,
  initialData = null,
  onSuccess,
}) {
  const fileInputRef = useRef(null);

  // Form State
  const [files, setFiles] = useState([]);
  const [drawingNumber, setDrawingNumber] = useState('');
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('Structural');
  const [blockName, setBlockName] = useState('Block A');
  const [level, setLevel] = useState('Level 2');
  const [releaseStatus, setReleaseStatus] = useState('gfc'); // 'gfc' | 'draft'
  const [changeNote, setChangeNote] = useState('');
  const [changeTags, setChangeTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Status & duplicate detection
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [existingDrawing, setExistingDrawing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [readFromFileName, setReadFromFileName] = useState(false);

  // Initialize from initialData (e.g. from Matrix cell tap or + Rev tap)
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (initialData) {
        if (initialData.drawingNumber) setDrawingNumber(initialData.drawingNumber);
        if (initialData.title) setTitle(initialData.title);
        if (initialData.disciplineCode || initialData.discipline) {
          const d = initialData.disciplineCode || initialData.discipline;
          const match = DISCIPLINES.find((item) => item.toUpperCase().startsWith(d.toUpperCase())) || d;
          setDiscipline(match);
        }
        if (initialData.blockName || initialData.block) setBlockName(initialData.blockName || initialData.block);
        if (initialData.level) setLevel(initialData.level);
        if (initialData.existingDrawing) {
          setIsDuplicate(true);
          setExistingDrawing(initialData.existingDrawing);
        }
      } else {
        setDrawingNumber('');
        setTitle('');
        setDiscipline('Structural');
        setBlockName('Block A');
        setLevel('Level 2');
        setReleaseStatus('gfc');
        setChangeNote('');
        setChangeTags([]);
        setIsDuplicate(false);
        setExistingDrawing(null);
        setFiles([]);
        setReadFromFileName(false);
      }
    }
  }, [isOpen, initialData]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Check duplicate drawing number within project
  useEffect(() => {
    if (!drawingNumber.trim() || !activeProjectId) {
      setIsDuplicate(false);
      setExistingDrawing(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await drawingsApi.checkDuplicate({
          projectId: activeProjectId,
          drawingNumber: drawingNumber.trim(),
        });
        if (res?.exists && res?.drawing) {
          setIsDuplicate(true);
          setExistingDrawing(res.drawing);
          if (res.drawing.title && !title) setTitle(res.drawing.title);
        } else {
          setIsDuplicate(false);
          setExistingDrawing(null);
        }
      } catch (err) {
        console.warn('Duplicate check error:', err);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [drawingNumber, activeProjectId]);

  // Handle File selection
  const handleFilesAdded = (selectedFiles) => {
    if (!selectedFiles || !selectedFiles.length) return;
    const fileList = Array.from(selectedFiles);

    const newFileList = fileList.map((f) => ({
      file: f,
      name: f.name,
      size: (f.size / (1024 * 1024)).toFixed(2) + ' MB',
      ext: f.name.split('.').pop()?.toUpperCase() || 'FILE',
      ready: true,
      dataUrl: null,
    }));

    // Read first file as dataUrl
    const first = newFileList[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      first.dataUrl = e.target.result;
    };
    reader.readAsDataURL(first.file);

    setFiles((prev) => [...prev, ...newFileList]);

    // Parse metadata from filename of first file
    const parsed = parseDrawingFilename(first.name);
    if (parsed) {
      setReadFromFileName(true);
      if (parsed.drawingNumber && !drawingNumber) setDrawingNumber(parsed.drawingNumber);
      if (parsed.title && !title) setTitle(parsed.title);
      if (parsed.discipline) {
        const match = DISCIPLINES.find((d) => d.toLowerCase() === parsed.discipline.toLowerCase());
        if (match) setDiscipline(match);
      }
      if (parsed.level) {
        const match = LEVELS.find((l) => l.toLowerCase() === parsed.level.toLowerCase());
        if (match) setLevel(match);
      }
    }
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !changeTags.includes(val)) {
        setChangeTags((prev) => [...prev, val]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tag) => {
    setChangeTags((prev) => prev.filter((t) => t !== tag));
  };

  // Submit Upload
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!drawingNumber.trim()) {
      setErrorMsg('Please enter a drawing number.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Please enter a drawing title.');
      return;
    }
    if (!files.length) {
      setErrorMsg('Please attach at least one drawing file.');
      return;
    }

    setUploading(true);
    setErrorMsg('');

    try {
      const activeFile = files[0];
      let fileData = activeFile.dataUrl;

      // If dataUrl not ready, read synchronously via Promise
      if (!fileData) {
        fileData = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = (ev) => resolve(ev.target.result);
          r.readAsDataURL(activeFile.file);
        });
      }

      const fileExt = activeFile.file.name.split('.').pop()?.toLowerCase() || 'pdf';

      if (isDuplicate && existingDrawing?._id) {
        // Upload as new revision to existing drawing!
        const payload = {
          changeDescription: changeNote.trim() || 'New revision uploaded.',
          releaseStatus,
          changeTags,
          fileData,
          fileName: activeFile.file.name,
          fileSize: activeFile.file.size,
          fileType: fileExt,
        };
        await drawingsApi.uploadRevision(existingDrawing._id, payload);
      } else {
        // Create new drawing with initial revision
        const payload = {
          projectId: activeProjectId,
          drawingNumber: drawingNumber.trim(),
          title: title.trim(),
          disciplineCode: discipline.substring(0, 3).toUpperCase(),
          blockName,
          level,
          releaseStatus,
          initialChangeDescription: changeNote.trim() || 'Initial drawing creation.',
          tags: changeTags,
          fileData,
          fileName: activeFile.file.name,
          fileSize: activeFile.file.size,
          fileType: fileExt,
        };
        await drawingsApi.createDrawing(payload);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Upload error:', err);
      setErrorMsg(err.message || 'Failed to upload drawing.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const currentRevNum = existingDrawing?.currentRevisionNumber || 'R00';
  const nextRevNum = currentRevNum
    ? `R${String(parseInt(currentRevNum.replace(/\D/g, '') || 0, 10) + 1).padStart(2, '0')}`
    : 'R01';

  return (
    <div className="drawings-drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="drawings-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawings-drawer-header">
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {isDuplicate ? 'Upload new revision' : 'Upload drawing'}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: "var(--text-secondary)", margin: '4px 0 0 0' }}>
              Details are read from the file name. Change anything that is wrong.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "var(--input-bg)",
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: "var(--text-secondary)",
              cursor: 'pointer',
            }}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body Form */}
        <form onSubmit={handleSubmit} className="drawings-drawer-body">
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: "1px solid var(--danger-border)",
                color: "var(--danger-text)",
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.8125rem',
              }}
            >
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Files List / Dropzone */}
          <div style={{ marginBottom: '1.25rem' }}>
            {files.map((f, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: "var(--input-bg)",
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.5rem',
                  border: "1px solid var(--card-border)",
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      background: "var(--card-bg)",
                      color: "var(--accent)",
                      padding: '0.35rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                    }}
                  >
                    {f.ext}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.name}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: "var(--text-secondary)" }}>{f.size}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: "var(--accent)", fontSize: '0.75rem', fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  <span>Ready</span>
                </div>
              </div>
            ))}

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              multiple
              accept=".dwg,.dxf,.pdf,.png,.svg"
              onChange={(e) => handleFilesAdded(e.target.files)}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'none',
                border: 'none',
                color: "var(--accent)",
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0.25rem 0',
              }}
            >
              <Plus size={15} />
              <span>+ Add more files</span>
            </button>
          </div>

          {/* Read from filename indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: "var(--text-secondary)", letterSpacing: '0.05em' }}>
              DRAWING DETAILS
            </span>
            {readFromFileName && (
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: "var(--accent)",
                  borderRadius: '9999px',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                }}
              >
                Read from file name
              </span>
            )}
          </div>

          {/* Drawing Number */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: "var(--text-primary)", marginBottom: '0.35rem' }}>
              Drawing number
            </label>
            <input
              type="text"
              className="drawings-search-input"
              style={{ paddingLeft: '0.875rem' }}
              value={drawingNumber}
              onChange={(e) => setDrawingNumber(e.target.value)}
              placeholder="e.g. DT-STR-L02-004"
              required
            />
          </div>

          {/* Title */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: "var(--text-primary)", marginBottom: '0.35rem' }}>
              Title
            </label>
            <input
              type="text"
              className="drawings-search-input"
              style={{ paddingLeft: '0.875rem' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Slab Reinforcement Plan, Level 2"
              required
            />
          </div>

          {/* Discipline Pills */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: "var(--text-primary)", marginBottom: '0.35rem' }}>
              Discipline
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {DISCIPLINES.map((d) => {
                const active = discipline === d;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`drawings-pill-btn ${active ? 'active' : ''}`}
                    onClick={() => setDiscipline(d)}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Block Pills */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: "var(--text-primary)", marginBottom: '0.35rem' }}>
              Block
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {BLOCKS.map((b) => {
                const active = blockName === b;
                return (
                  <button
                    key={b}
                    type="button"
                    className={`drawings-pill-btn ${active ? 'active' : ''}`}
                    onClick={() => setBlockName(b)}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level Dropdown */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: "var(--text-primary)", marginBottom: '0.35rem' }}>
              Level
            </label>
            <select
              className="drawings-sort-select"
              style={{ width: '100%', height: '42px' }}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* Duplicate Banner */}
          {isDuplicate && existingDrawing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                background: 'rgba(59, 130, 246, 0.1)',
                border: "1px solid var(--info-border)",
                borderRadius: '8px',
                padding: '0.875rem',
                marginBottom: '1rem',
                fontSize: '0.8125rem',
                color: "var(--info-text)",
                lineHeight: 1.4,
              }}
            >
              <Info size={18} style={{ color: "var(--info-text)", flexShrink: 0, marginTop: '2px' }} />
              <div>
                This drawing already exists at <strong>{currentRevNum}</strong>. This upload will be saved as{' '}
                <strong style={{ color: '#ffffff' }}>{nextRevNum}</strong>. {currentRevNum} stays in the version history.
              </div>
            </div>
          )}

          {/* Release As */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: "var(--text-primary)", marginBottom: '0.35rem' }}>
              Release as
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`drawings-pill-btn ${releaseStatus === 'gfc' ? 'active' : ''}`}
                onClick={() => setReleaseStatus('gfc')}
                style={{ flex: 1, justifyContent: 'center', height: '40px' }}
              >
                ● Good for construction
              </button>
              <button
                type="button"
                className={`drawings-pill-btn ${releaseStatus === 'draft' ? 'active' : ''}`}
                onClick={() => setReleaseStatus('draft')}
                style={{ flex: 1, justifyContent: 'center', height: '40px' }}
              >
                ● Draft
              </button>
            </div>
          </div>

          {/* What changed in this revision */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: "var(--text-primary)", marginBottom: '0.35rem' }}>
              What changed in this revision?
            </label>
            <textarea
              style={{
                width: '100%',
                minHeight: '80px',
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: '8px',
                padding: '0.75rem',
                color: "var(--text-primary)",
                fontSize: '0.8125rem',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="e.g. Beam B14 depth increased and top steel added between grids C and D."
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
            />
          </div>

          {/* Change Tags */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: "var(--text-primary)", marginBottom: '0.35rem' }}>
              Change tags (press Enter)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.375rem' }}>
              {changeTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: "var(--input-bg)",
                    border: "1px solid var(--card-border)",
                    borderRadius: '4px',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                    color: "var(--text-primary)",
                  }}
                >
                  {tag}
                  <X
                    size={12}
                    style={{ cursor: 'pointer', color: "var(--text-secondary)" }}
                    onClick={() => handleRemoveTag(tag)}
                  />
                </span>
              ))}
            </div>
            <input
              type="text"
              className="drawings-search-input"
              style={{ paddingLeft: '0.875rem', height: '36px' }}
              placeholder="e.g. Balcony slab, Beam B14"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
            />
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="drawings-drawer-footer">
          <button
            type="button"
            onClick={onClose}
            className="drawings-row-btn"
            style={{ minHeight: '44px', padding: '0 1.25rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={uploading}
            className="drawings-big-btn-primary"
            style={{
              minHeight: '44px',
              padding: '0 1.5rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: uploading ? 'not-allowed' : 'pointer',
              border: 'none',
            }}
          >
            {uploading
              ? 'Saving...'
              : isDuplicate
              ? `Upload and save as ${nextRevNum}`
              : 'Upload and save as R00'}
          </button>
        </div>
      </div>
    </div>
  );
}

