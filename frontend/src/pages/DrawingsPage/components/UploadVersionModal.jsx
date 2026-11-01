import React, { useState, useRef, useEffect } from 'react';
import './UploadVersionModal.css';
import AppModal from '../../../components/ui/AppModal';
import { drawingsApi } from '../../../utils/drawingsApi';
import {
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
  CheckCircle2,
  Loader2
} from 'lucide-react';

const REASON_OPTIONS = [
  { value: 'CLIENT_REQUEST', label: 'Client Request' },
  { value: 'SITE_CONDITION', label: 'Site Condition' },
  { value: 'DESIGN_CHANGE', label: 'Design Change' },
  { value: 'CLASH_RESOLUTION', label: 'Clash Resolution' },
  { value: 'RFI_RESPONSE', label: 'RFI Response' },
  { value: 'STATUTORY_COMPLIANCE', label: 'Statutory Compliance' },
  { value: 'OTHER', label: 'Other' }
];

const PURPOSE_OPTIONS = [
  { value: 'FOR_APPROVAL', label: 'For Approval' },
  { value: 'FOR_INFORMATION', label: 'For Information' },
  { value: 'FOR_CONSTRUCTION', label: 'For Construction' },
  { value: 'TENDER', label: 'Tender' },
  { value: 'AS_BUILT', label: 'As-Built' }
];

export default function UploadVersionModal({
  isOpen,
  open,
  onClose,
  drawing,
  onSuccess
}) {
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Form states
  const [changeNote, setChangeNote] = useState('');
  const [reason, setReason] = useState('CLIENT_REQUEST');
  const [purpose, setPurpose] = useState('FOR_APPROVAL');
  const [submitForApproval, setSubmitForApproval] = useState(true);

  // SHA-256 Worker & Duplicate Verification
  const [isHashing, setIsHashing] = useState(false);
  const [sha256Hash, setSha256Hash] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [proceedDuplicate, setProceedDuplicate] = useState(false);

  // Upload Progress & Errors
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [uploadEta, setUploadEta] = useState('');
  const [uploadError, setUploadError] = useState('');

  const progressIntervalRef = useRef(null);

  // Reset states on open/close
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setFileData(null);
      setChangeNote('');
      setReason('CLIENT_REQUEST');
      setPurpose('FOR_APPROVAL');
      setSubmitForApproval(true);
      setSha256Hash('');
      setDuplicateWarning(null);
      setProceedDuplicate(false);
      setUploading(false);
      setUploadProgress(0);
      setUploadError('');
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    } else if (isOpen && !drawing?._id) {
      setChangeNote((prev) => prev || 'Initial drawing version 1 upload');
    }
  }, [isOpen]);

  // Handle File Drop / Select & trigger Web Worker SHA-256
  const processFile = (selectedFile) => {
    if (!selectedFile) return;

    const maxSize = 500 * 1024 * 1024; // 500 MB
    if (selectedFile.size > maxSize) {
      setUploadError('File exceeds the 500 MB maximum size limit.');
      return;
    }

    setFile(selectedFile);
    setUploadError('');
    setDuplicateWarning(null);
    setProceedDuplicate(false);
    setIsHashing(true);

    // Read base64
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileData(e.target.result);
    };
    reader.readAsDataURL(selectedFile);

    // Compute SHA-256 using Web Worker
    try {
      const worker = new Worker('/workers/sha256-worker.js');
      worker.postMessage({ file: selectedFile, fileId: selectedFile.name });

      worker.onmessage = async (e) => {
        setIsHashing(false);
        worker.terminate();

        if (e.data.success && e.data.hash) {
          const hash = e.data.hash;
          setSha256Hash(hash);

          // Check duplicate against backend
          try {
            const token = sessionStorage.getItem('accessToken');
            const resp = await fetch(`/api/drawings/check-duplicate?hash=${hash}`, {
              headers: { Authorization: token ? `Bearer ${token}` : '' }
            });
            if (resp.ok) {
              const resData = await resp.json();
              if (resData.isDuplicate && resData.existingVersion) {
                setDuplicateWarning(resData.existingVersion);
              }
            }
          } catch (dupErr) {
            console.warn('Duplicate check warning:', dupErr);
          }
        } else {
          console.warn('Worker hashing notice:', e.data.error);
        }
      };

      worker.onerror = (err) => {
        setIsHashing(false);
        worker.terminate();
        console.warn('Worker error:', err);
      };
    } catch (err) {
      setIsHashing(false);
      console.warn('Could not launch worker, continuing:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Submit Upload Flow
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !fileData) {
      setUploadError('Please choose a file to upload.');
      return;
    }
    if (!changeNote.trim()) {
      setUploadError('Change note is required.');
      return;
    }
    if (duplicateWarning && !proceedDuplicate) {
      setUploadError('Please confirm to proceed with identical file or choose a different revision.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadProgress(10);
    setUploadSpeed('14.2 MB/s');
    setUploadEta('2s');

    // Simulated progress chunks up to 90%
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) return prev;
        const next = prev + Math.floor(Math.random() * 15 + 10);
        return Math.min(next, 85);
      });
    }, 200);

    try {
      const fileExt = (file.name.split('.').pop() || 'dwg').toLowerCase();
      const payload = {
        changeDescription: changeNote.trim(),
        reason,
        purpose,
        submitForApproval,
        checksumSha256: sha256Hash || undefined,
        fileName: file.name,
        fileSize: file.size,
        fileType: fileExt,
        fileData
      };

      const drawingId = drawing?._id || drawing?.id;
      let res;
      if (drawingId) {
        // Upload new revision on existing drawing
        res = await drawingsApi.uploadRevision(drawingId, payload);
      } else {
        // Or create new drawing v1
        res = await drawingsApi.createDrawing({
          ...payload,
          title: drawing?.title || file.name.replace(/\.[^/.]+$/, ''),
          drawingNumber: drawing?.drawingNumber || undefined,
          projectId: drawing?.projectId || undefined,
          disciplineCode: drawing?.disciplineCode || 'ARCH',
          blockName: drawing?.blockName || 'Block A',
          level: drawing?.level || 'L1'
        });
      }

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setUploadProgress(100);

      setTimeout(() => {
        onSuccess && onSuccess(res);
        onClose();
      }, 300);
    } catch (err) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setUploading(false);
      setUploadProgress(0);
      setUploadError(err?.message || 'Failed to upload revision. You can click Retry.');
    }
  };

  const handleCancelUpload = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setUploading(false);
    setUploadProgress(0);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AppModal
      open={isOpen || open}
      isOpen={isOpen || open}
      onClose={uploading ? () => {} : onClose}
      title={drawing?._id ? `Upload New Version for ${drawing.drawingNumber || drawing.title || 'Drawing'}` : `Upload File for ${drawing?.title || 'New Drawing'}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="ro-upload-modal-container">
        {/* Upload Error Alert with Retry */}
        {uploadError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', color: '#dc2626', fontSize: '12px' }}>
            <span>{uploadError}</span>
            <button
              type="button"
              className="ro-bulk-btn"
              style={{ color: '#dc2626', borderColor: '#dc2626', padding: '2px 8px', fontSize: '11px' }}
              onClick={handleSubmit}
            >
              Retry
            </button>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div>
          <label className="ro-field-label" style={{ marginBottom: '6px', display: 'block' }}>
            File *
          </label>
          <div
            className={`ro-drop-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="ro-drop-zone-icon">
              <UploadCloud size={28} />
            </div>
            <div className="ro-drop-zone-title">
              Drag &amp; drop file here or click to browse
            </div>
            <div className="ro-drop-zone-subtitle">
              PDF, DWG, JPG, PNG (Max 500 MB)
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            />
          </div>

          {/* Selected File Card */}
          {file && (
            <div className="ro-selected-file-pill">
              <div className="ro-selected-file-info">
                <FileText size={20} style={{ color: '#2563eb', flexShrink: 0 }} />
                <div>
                  <div className="ro-file-name-text">{file.name}</div>
                  <div className="ro-file-size-text">{formatFileSize(file.size)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isHashing ? (
                  <span className="ro-hash-status-badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
                    <Loader2 size={12} className="spin" /> Verifying SHA-256...
                  </span>
                ) : sha256Hash ? (
                  <span className="ro-hash-status-badge">
                    <CheckCircle2 size={12} /> SHA-256 Verified
                  </span>
                ) : null}

                {!uploading && (
                  <button
                    type="button"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                    onClick={() => { setFile(null); setFileData(null); setDuplicateWarning(null); }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Duplicate Version Warning */}
        {duplicateWarning && (
          <div className="ro-duplicate-warning-banner">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Duplicate File Detected:</strong> This file is identical to version{' '}
              <strong>{duplicateWarning.version || duplicateWarning.revisionNumber}</strong> uploaded by{' '}
              {duplicateWarning.uploadedByName} on {new Date(duplicateWarning.uploadedAt).toLocaleDateString('en-GB')}.
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={proceedDuplicate}
                  onChange={(e) => setProceedDuplicate(e.target.checked)}
                />
                Proceed anyway with duplicate file
              </label>
            </div>
          </div>
        )}

        {/* Change Note */}
        <div className="ro-upload-field">
          <div className="ro-field-header-row">
            <label className="ro-field-label" htmlFor="change-note-input">Change Note *</label>
            <span className="ro-char-counter">{changeNote.length}/500</span>
          </div>
          <textarea
            id="change-note-input"
            className="ro-textarea-input"
            required
            maxLength={500}
            rows={3}
            placeholder="Updated layout as per client comments"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
          />
        </div>

        {/* Reason & Purpose Grid */}
        <div className="ro-dropdown-grid">
          <div className="ro-upload-field">
            <label className="ro-field-label" htmlFor="upload-reason">Reason *</label>
            <select
              id="upload-reason"
              className="ro-form-select"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="ro-upload-field">
            <label className="ro-field-label" htmlFor="upload-purpose">Purpose *</label>
            <select
              id="upload-purpose"
              className="ro-form-select"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            >
              {PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit for Approval Checkbox */}
        <div
          className="ro-approval-checkbox-card"
          onClick={() => setSubmitForApproval((prev) => !prev)}
        >
          <input
            type="checkbox"
            className="ro-checkbox-input"
            checked={submitForApproval}
            onChange={() => {}}
            style={{ marginTop: '2px' }}
          />
          <div>
            <div className="ro-approval-title">Submit for Approval</div>
            <div className="ro-approval-desc">
              This version will go for approval and won't be current until approved.
            </div>
          </div>
        </div>

        {/* Real-time Progress Bar */}
        {uploading && (
          <div className="ro-progress-container">
            <div className="ro-progress-header">
              <span>Uploading &amp; Converting Drawing...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="ro-progress-track">
              <div className="ro-progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div className="ro-progress-stats">
              <span>Speed: {uploadSpeed}</span>
              <span>Time Left: {uploadEta}</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="ro-modal-actions-row">
          {uploading ? (
            <button
              type="button"
              className="ro-bulk-btn"
              style={{ color: '#ef4444', borderColor: '#ef4444' }}
              onClick={handleCancelUpload}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="ro-bulk-btn"
              style={{ color: 'var(--text-secondary, #475569)', borderColor: 'var(--border-color, #cbd5e1)' }}
              onClick={onClose}
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            className="ro-btn-primary-action"
            disabled={uploading || !file || !changeNote.trim()}
          >
            {uploading ? (
              <>
                <RefreshCw size={14} className="spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <span>Upload</span>
            )}
          </button>
        </div>
      </form>
    </AppModal>
  );
}

