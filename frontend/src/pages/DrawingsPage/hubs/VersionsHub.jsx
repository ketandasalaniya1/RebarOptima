import React, { useState, useEffect } from 'react';
import {
  Plus,
  Download,
  Eye,
  GitCompare,
  Clock,
  CheckCircle2,
  FileText,
  Upload,
  Edit2,
  Check,
  Search,
} from 'lucide-react';
import { drawingsApi } from '../../../utils/drawingsApi';

export default function VersionsHub({
  drawings = [],
  selectedDrawingId = null,
  onSelectDrawing,
  onOpenNewRevision,
  onViewDrawing,
  onDownloadDrawing,
  onCompareVersions,
  onRefresh,
}) {
  const [activeDrawing, setActiveDrawing] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [editingNoteRevId, setEditingNoteRevId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Find and set active drawing
  useEffect(() => {
    if (!drawings.length) return;
    const target = drawings.find((d) => (d._id || d.id) === selectedDrawingId) || drawings[0];
    if (target) {
      setActiveDrawing(target);
    }
  }, [drawings, selectedDrawingId]);

  // Fetch full details and revisions for active drawing
  useEffect(() => {
    if (!activeDrawing?._id && !activeDrawing?.id) return;
    const dId = activeDrawing._id || activeDrawing.id;

    setLoadingRevisions(true);
    drawingsApi
      .getDrawingDetail(dId)
      .then((detail) => {
        if (detail?.revisions && Array.isArray(detail.revisions)) {
          // Sort newest first
          const sorted = [...detail.revisions].sort(
            (a, b) => new Date(b.createdAt || b.uploadedAt || 0) - new Date(a.createdAt || a.uploadedAt || 0)
          );
          setRevisions(sorted);
        } else {
          setRevisions([]);
        }
      })
      .catch((err) => {
        console.warn('Failed to load drawing revisions:', err);
      })
      .finally(() => {
        setLoadingRevisions(false);
      });
  }, [activeDrawing]);

  // Handle Make Current
  const handleMakeCurrent = async (rev) => {
    if (!window.confirm(`Make ${rev.revisionNumber} the current version for ${activeDrawing.drawingNumber}?`)) {
      return;
    }
    const dId = activeDrawing._id || activeDrawing.id;
    try {
      await drawingsApi.makeRevisionCurrent(dId, rev._id || rev.id);
      onRefresh?.();
      // Re-fetch detail
      const detail = await drawingsApi.getDrawingDetail(dId);
      if (detail?.revisions) {
        setRevisions(
          [...detail.revisions].sort(
            (a, b) => new Date(b.createdAt || b.uploadedAt || 0) - new Date(a.createdAt || a.uploadedAt || 0)
          )
        );
      }
    } catch (err) {
      alert(`Failed to set revision as current: ${err.message}`);
    }
  };

  // Handle Save Note
  const handleSaveNote = async (rev) => {
    const dId = activeDrawing._id || activeDrawing.id;
    try {
      await drawingsApi.updateRevision(dId, rev._id || rev.id, {
        changeDescription: editingNoteText,
      });
      setEditingNoteRevId(null);
      // Update local state
      setRevisions((prev) =>
        prev.map((r) => ((r._id || r.id) === (rev._id || rev.id) ? { ...r, changeDescription: editingNoteText } : r))
      );
    } catch (err) {
      alert(`Failed to update note: ${err.message}`);
    }
  };

  // Filter left list by search
  const filteredDrawings = (drawings || []).filter((d) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      (d.drawingNumber || '').toLowerCase().includes(term) ||
      (d.title || '').toLowerCase().includes(term)
    );
  });

  const currentRevNum = activeDrawing?.currentRevisionNumber || 'R00';
  const nextRevNum = currentRevNum
    ? `R${String(parseInt(currentRevNum.replace(/\D/g, '') || 0, 10) + 1).padStart(2, '0')}`
    : 'R01';

  // Format date helper
  const formatDateStr = (dateVal) => {
    if (!dateVal) return 'Unknown';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getRelativeTime = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffDays = Math.round((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    const weeks = Math.round(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  };

  return (
    <div className="drawings-hub-container">
      <div className="versions-layout">
        {/* Left Column: Drawing Picker */}
        <div className="versions-left-list">
          <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: "var(--text-label)", letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            PICK A DRAWING
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: "var(--text-label)" }} />
            <input
              type="text"
              placeholder="Search drawings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '34px',
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: '6px',
                padding: '0 0.5rem 0 2rem',
                color: "var(--text-primary)",
                fontSize: '0.75rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {filteredDrawings.map((dw) => {
              const dwId = dw._id || dw.id;
              const isSelected = (activeDrawing?._id || activeDrawing?.id) === dwId;

              return (
                <div
                  key={dwId}
                  className={`versions-drawing-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setActiveDrawing(dw);
                    onSelectDrawing?.(dwId);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: "var(--text-primary)" }}>
                      {dw.drawingNumber}
                    </div>
                    <span className="drawings-rev-badge" style={{ fontSize: '0.6875rem', padding: '0.15rem 0.4rem' }}>
                      {dw.currentRevisionNumber || 'R00'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: "var(--text-secondary)",
                      marginTop: '2px',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {dw.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Drawing & Versions Timeline */}
        {activeDrawing ? (
          <div className="versions-right-panel">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: "var(--text-label)", fontWeight: 600 }}>
                  {activeDrawing.blockName || 'Block A'} · {activeDrawing.level || 'Ground'} · {activeDrawing.disciplineCode || 'Structural'}
                </div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: "var(--text-primary)", margin: '4px 0 2px' }}>
                  {activeDrawing.drawingNumber}
                </h1>
                <div style={{ fontSize: '0.9375rem', color: "var(--text-secondary)" }}>{activeDrawing.title}</div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="drawings-big-btn-primary"
                  style={{ minHeight: '44px', padding: '0 1.25rem', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={() =>
                    onOpenNewRevision({
                      drawingNumber: activeDrawing.drawingNumber,
                      title: activeDrawing.title,
                      disciplineCode: activeDrawing.disciplineCode,
                      blockName: activeDrawing.blockName,
                      level: activeDrawing.level,
                      existingDrawing: activeDrawing,
                    })
                  }
                >
                  <Plus size={16} />
                  <span>+ Add new revision</span>
                </button>

                <button
                  type="button"
                  className="drawings-row-btn"
                  style={{ minHeight: '44px', padding: '0 1rem' }}
                  onClick={() => onDownloadDrawing(activeDrawing)}
                >
                  <Download size={15} />
                  <span>Download current</span>
                </button>
              </div>
            </div>

            {/* 4 Stat Chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', margin: '1.25rem 0' }}>
              <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: "var(--text-label)", textTransform: 'uppercase' }}>
                  Versions
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: "var(--text-primary)", marginTop: '2px' }}>
                  {revisions.length || 1}
                </div>
              </div>

              <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: "var(--text-label)", textTransform: 'uppercase' }}>
                  Current
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: "var(--accent)", marginTop: '2px' }}>
                  {currentRevNum}
                </div>
              </div>

              <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: "var(--text-label)", textTransform: 'uppercase' }}>
                  First issued
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: "var(--text-primary)", marginTop: '4px' }}>
                  {formatDateStr(revisions[revisions.length - 1]?.createdAt || activeDrawing.createdAt)}
                </div>
              </div>

              <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: "var(--text-label)", textTransform: 'uppercase' }}>
                  Last updated
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: "var(--text-primary)", marginTop: '4px' }}>
                  {getRelativeTime(activeDrawing.updatedAt)}
                </div>
              </div>
            </div>

            {/* Drop Strip for Next Revision */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px dashed #10b981',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                margin: '1.25rem 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Upload size={20} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: '0.8125rem', color: "var(--text-secondary)" }}>
                  Drop the next file here to create <strong>{nextRevNum}</strong>. You will add a short note on what changed, and today&apos;s date is saved with it.
                </span>
              </div>
              <button
                type="button"
                className="drawings-row-btn"
                style={{
                  minHeight: '36px',
                  borderColor: '#10b981',
                  color: "var(--accent)",
                  background: 'rgba(16, 185, 129, 0.1)',
                  fontWeight: 700,
                }}
                onClick={() =>
                  onOpenNewRevision({
                    drawingNumber: activeDrawing.drawingNumber,
                    title: activeDrawing.title,
                    disciplineCode: activeDrawing.disciplineCode,
                    blockName: activeDrawing.blockName,
                    level: activeDrawing.level,
                    existingDrawing: activeDrawing,
                  })
                }
              >
                Choose file
              </button>
            </div>

            {/* Version Timeline */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Version timeline
                </h3>
                <span style={{ fontSize: '0.75rem', color: "var(--text-label)" }}>
                  Newest first. Green lines show what changed in that version.
                </span>
              </div>

              {loadingRevisions ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: "var(--text-secondary)" }}>
                  Loading revisions...
                </div>
              ) : (
                <div className="versions-timeline-line">
                  {revisions.map((rev, idx) => {
                    const isCurrent = rev.isCurrent || rev.revisionNumber === currentRevNum || idx === 0;
                    const dateFormatted = formatDateStr(rev.createdAt || rev.uploadedAt);
                    const relTime = getRelativeTime(rev.createdAt || rev.uploadedAt);
                    const author = rev.uploadedByName || 'Structural Consultant';
                    const prevRev = revisions[idx + 1];

                    return (
                      <div
                        key={rev._id || rev.id || idx}
                        style={{ position: 'relative', marginBottom: '2rem', display: 'flex', gap: '1.25rem' }}
                      >
                        {/* Node */}
                        <div className={`versions-timeline-node ${isCurrent ? 'current' : ''}`} />

                        {/* Date Left Column */}
                        <div style={{ width: '110px', flexShrink: 0, paddingTop: '8px' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: "var(--text-primary)" }}>
                            {dateFormatted}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: "var(--text-label)" }}>{relTime}</div>
                        </div>

                        {/* Card Right */}
                        <div
                          style={{
                            flex: 1,
                            background: "var(--card-bg)",
                            border: `1px solid ${isCurrent ? '#10b981' : '#1e293b'}`,
                            borderRadius: '12px',
                            padding: '1.25rem',
                            display: 'flex',
                            gap: '1.25rem',
                          }}
                        >
                          {/* Mini CAD / Schematic Preview Thumbnail */}
                          <div
                            style={{
                              width: '140px',
                              height: '90px',
                              background: "var(--main-bg)",
                              border: "1px solid var(--card-border)",
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            <svg width="100%" height="100%" viewBox="0 0 100 60" style={{ opacity: 0.6 }}>
                              <line x1="10" y1="10" x2="90" y2="10" stroke="#334155" strokeWidth="1" />
                              <line x1="10" y1="30" x2="90" y2="30" stroke="#334155" strokeWidth="1" />
                              <line x1="10" y1="50" x2="90" y2="50" stroke="#334155" strokeWidth="1" />
                              <line x1="20" y1="5" x2="20" y2="55" stroke="#334155" strokeWidth="1" />
                              <line x1="50" y1="5" x2="50" y2="55" stroke="#334155" strokeWidth="1" />
                              <line x1="80" y1="5" x2="80" y2="55" stroke="#334155" strokeWidth="1" />
                              {/* Changed area highlighted in green */}
                              <rect x="25" y="15" width="20" height="10" fill="none" stroke="#10b981" strokeWidth="1.5" />
                            </svg>
                          </div>

                          {/* Info & Actions */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="drawings-rev-badge">{rev.revisionNumber}</span>
                                <span
                                  className={`drawings-status-badge ${isCurrent ? 'drawings-status-gfc' : ''}`}
                                  style={{
                                    background: isCurrent ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
                                    color: isCurrent ? '#10b981' : '#94a3b8',
                                  }}
                                >
                                  {isCurrent ? 'Current' : 'Superseded'}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: "var(--text-label)" }}>by {author}</span>
                              </div>
                            </div>

                            {/* Note Text */}
                            {editingNoteRevId === (rev._id || rev.id) ? (
                              <div style={{ margin: '0.5rem 0' }}>
                                <textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  style={{
                                    width: '100%',
                                    minHeight: '60px',
                                    background: "var(--card-bg)",
                                    border: '1px solid #10b981',
                                    borderRadius: '6px',
                                    padding: '0.5rem',
                                    color: "var(--text-primary)",
                                    fontSize: '0.8125rem',
                                    fontFamily: 'inherit',
                                  }}
                                />
                                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveNote(rev)}
                                    className="drawings-row-btn"
                                    style={{ minHeight: '32px', color: "var(--accent)" }}
                                  >
                                    <Check size={14} /> Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoteRevId(null)}
                                    className="drawings-row-btn"
                                    style={{ minHeight: '32px' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.8125rem', color: "var(--text-primary)", margin: '0.35rem 0 0.5rem', lineHeight: 1.4 }}>
                                {rev.changeDescription || 'Drawing issued for construction.'}
                              </div>
                            )}

                            {/* Change Tags */}
                            {rev.changeTags && rev.changeTags.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                {rev.changeTags.map((tag, tIdx) => (
                                  <span
                                    key={tIdx}
                                    style={{
                                      background: "var(--input-bg)",
                                      color: "var(--text-secondary)",
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '4px',
                                      fontSize: '0.6875rem',
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="drawings-row-btn"
                                style={{ minHeight: '36px' }}
                                onClick={() => onViewDrawing(activeDrawing, rev)}
                              >
                                <Eye size={14} />
                                <span>View</span>
                              </button>

                              {prevRev && (
                                <button
                                  type="button"
                                  className="drawings-row-btn"
                                  style={{ minHeight: '36px' }}
                                  onClick={() => onCompareVersions?.(rev, prevRev, activeDrawing, revisions)}
                                >
                                  <GitCompare size={14} />
                                  <span>Compare with {prevRev.revisionNumber}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="drawings-row-btn"
                                style={{ minHeight: '36px' }}
                                onClick={() => onDownloadDrawing({ ...activeDrawing, ...rev })}
                              >
                                <Download size={14} />
                                <span>Download</span>
                              </button>

                              {!isCurrent && (
                                <button
                                  type="button"
                                  className="drawings-row-btn"
                                  style={{
                                    minHeight: '36px',
                                    borderColor: '#f59e0b',
                                    color: '#f59e0b',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                  }}
                                  onClick={() => handleMakeCurrent(rev)}
                                >
                                  <span>Make current</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="drawings-row-btn"
                                style={{ minHeight: '36px', background: 'none', border: 'none', color: "var(--text-label)" }}
                                onClick={() => {
                                  setEditingNoteRevId(rev._id || rev.id);
                                  setEditingNoteText(rev.changeDescription || '');
                                }}
                              >
                                <Edit2 size={13} />
                                <span>Edit note</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: "var(--text-secondary)" }}>
            No drawing selected.
          </div>
        )}
      </div>
    </div>
  );
}

