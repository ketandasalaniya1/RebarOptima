import React, { useState, useEffect, useRef } from 'react';
import './DataTable.css';
import StatusPill from './StatusPill';
import RoleGate from '../RoleGate';
import { MoreVertical, Upload, History, Send, Download, Trash2, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

export default function DataTable({
  drawings = [],
  isLoading = false,
  pagination = { page: 1, total: 0, totalPages: 1 },
  onPageChange,
  onViewDrawing,
  onUploadVersion,
  onVersionHistory,
  onReviewDrawing,
  onCreateTransmittal,
  onDownloadDrawing,
  onVoidDrawing,
  onBulkTransmittal,
  onBulkDownload
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [openKebabId, setOpenKebabId] = useState(null);
  const kebabRef = useRef(null);

  // Close kebab dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (kebabRef.current && !kebabRef.current.contains(event.target)) {
        setOpenKebabId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(drawings.map((d) => String(d._id)));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = drawings.length > 0 && selectedIds.size === drawings.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < drawings.length;

  const formatDate = (rawDate) => {
    if (!rawDate) return '—';
    try {
      const d = new Date(rawDate);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(rawDate);
    }
  };

  return (
    <div className="ro-table-container">
      <div className="ro-table-scroll-wrapper">
        <table className="ro-drawings-table">
          <thead>
            <tr>
              <th className="ro-col-checkbox">
                <input
                  type="checkbox"
                  className="ro-checkbox-input"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={handleSelectAll}
                  aria-label="Select all drawings"
                />
              </th>
              <th>Drawing No.</th>
              <th>Title</th>
              <th>Current Version</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th>Updated By</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Loading Skeletons
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="ro-skeleton-row">
                  <td className="ro-col-checkbox">
                    <div className="ro-skeleton-line" style={{ width: '16px', margin: '0 auto' }} />
                  </td>
                  <td><div className="ro-skeleton-line" style={{ width: '90px' }} /></td>
                  <td><div className="ro-skeleton-line" style={{ width: '180px' }} /></td>
                  <td><div className="ro-skeleton-line" style={{ width: '40px' }} /></td>
                  <td><div className="ro-skeleton-line" style={{ width: '70px' }} /></td>
                  <td><div className="ro-skeleton-line" style={{ width: '80px' }} /></td>
                  <td><div className="ro-skeleton-line" style={{ width: '90px' }} /></td>
                  <td style={{ textAlign: 'right' }}><div className="ro-skeleton-line" style={{ width: '60px', marginLeft: 'auto' }} /></td>
                </tr>
              ))
            ) : drawings.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-label, #64748b)' }}>
                  <FileSpreadsheet size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>No Drawings Found</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>Try adjusting your filters or upload a new drawing.</div>
                </td>
              </tr>
            ) : (
              drawings.map((dw) => {
                const id = String(dw._id);
                const isSelected = selectedIds.has(id);
                const isKebabOpen = openKebabId === id;

                return (
                  <tr key={id} className={isSelected ? 'selected-row' : ''}>
                    <td className="ro-col-checkbox">
                      <input
                        type="checkbox"
                        className="ro-checkbox-input"
                        checked={isSelected}
                        onChange={() => handleSelectRow(id)}
                        aria-label={`Select drawing ${dw.drawingNumber}`}
                      />
                    </td>
                    <td>
                      <span className="ro-drawing-no">{dw.drawingNumber || '—'}</span>
                    </td>
                    <td>
                      <span className="ro-drawing-title">{dw.title || 'Untitled'}</span>
                    </td>
                    <td>
                      <span className="ro-version-tag">
                        {dw.currentRevisionNumber ? `v${dw.currentRevisionNumber.replace(/^R0*/i, '') || '1'}` : 'v1'}
                      </span>
                    </td>
                    <td>
                      <StatusPill status={dw.currentStatus} />
                    </td>
                    <td style={{ color: 'var(--text-secondary, #475569)' }}>
                      {formatDate(dw.updatedAt || dw.createdAt)}
                    </td>
                    <td style={{ color: 'var(--text-secondary, #475569)' }}>
                      {dw.updatedBy || dw.createdBy || dw.uploadedByName || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="ro-actions-cell" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="ro-btn-view-action"
                          onClick={() => onViewDrawing && onViewDrawing(dw)}
                        >
                          View
                        </button>

                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className={`ro-btn-kebab ${isKebabOpen ? 'active' : ''}`}
                            onClick={() => setOpenKebabId(isKebabOpen ? null : id)}
                            aria-label="More options"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {isKebabOpen && (
                            <div className="ro-kebab-menu" ref={kebabRef}>
                              {['IN_REVIEW', 'UNDER REVIEW', 'PENDING APPROVAL', 'UNDER_REVIEW'].includes(String(dw.currentStatus || '').toUpperCase()) && (
                                <RoleGate permission="drawing:approve">
                                  <button
                                    type="button"
                                    className="ro-kebab-item"
                                    style={{ color: '#059669', fontWeight: 600 }}
                                    onClick={() => {
                                      setOpenKebabId(null);
                                      onReviewDrawing && onReviewDrawing(dw);
                                    }}
                                  >
                                    <CheckCircle2 size={14} />
                                    <span>Review / Approve</span>
                                  </button>
                                </RoleGate>
                              )}

                              <RoleGate permission="drawing:upload">
                                <button
                                  type="button"
                                  className="ro-kebab-item"
                                  onClick={() => {
                                    setOpenKebabId(null);
                                    onUploadVersion && onUploadVersion(dw);
                                  }}
                                >
                                  <Upload size={14} />
                                  <span>Upload New Version</span>
                                </button>
                              </RoleGate>

                              <button
                                type="button"
                                className="ro-kebab-item"
                                onClick={() => {
                                  setOpenKebabId(null);
                                  onVersionHistory && onVersionHistory(dw);
                                }}
                              >
                                <History size={14} />
                                <span>Version History</span>
                              </button>

                              <RoleGate permission="drawing:distribute">
                                <button
                                  type="button"
                                  className="ro-kebab-item"
                                  onClick={() => {
                                    setOpenKebabId(null);
                                    onCreateTransmittal && onCreateTransmittal(dw);
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
                                  setOpenKebabId(null);
                                  onDownloadDrawing && onDownloadDrawing(dw);
                                }}
                              >
                                <Download size={14} />
                                <span>Download</span>
                              </button>

                              <RoleGate permission="drawing:void">
                                <button
                                  type="button"
                                  className="ro-kebab-item danger"
                                  onClick={() => {
                                    setOpenKebabId(null);
                                    onVoidDrawing && onVoidDrawing(dw);
                                  }}
                                >
                                  <Trash2 size={14} />
                                  <span>Void</span>
                                </button>
                              </RoleGate>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="ro-bulk-bar">
          <span className="ro-bulk-count">{selectedIds.size} Drawing{selectedIds.size > 1 ? 's' : ''} Selected</span>
          <div className="ro-bulk-actions">
            <RoleGate permission="drawing:distribute">
              <button
                type="button"
                className="ro-bulk-btn primary"
                onClick={() => onBulkTransmittal && onBulkTransmittal(Array.from(selectedIds))}
              >
                Create Transmittal ({selectedIds.size})
              </button>
            </RoleGate>
            <button
              type="button"
              className="ro-bulk-btn"
              onClick={() => onBulkDownload && onBulkDownload(Array.from(selectedIds))}
            >
              Download ({selectedIds.size})
            </button>
            <button
              type="button"
              className="ro-bulk-btn"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {pagination && pagination.totalPages > 1 && (
        <div className="ro-pagination-bar">
          <span>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="ro-pagination-btn"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange && onPageChange(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="ro-pagination-btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange && onPageChange(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

