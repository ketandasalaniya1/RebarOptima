import React, { useState, useMemo } from 'react';
import {
  Upload,
  History,
  Plus,
  Eye,
  Clock,
  Download,
  FileText,
  Layers,
  ArrowRight,
  FilterX,
} from 'lucide-react';
import { Select } from '../../../components/ui';

export default function DrawingsHub({
  drawings = [],
  totalCount = 0,
  facets = {},
  filters = {},
  onFilterChange,
  onOpenUpload,
  onOpenNewRevision,
  onGoToVersions,
  onViewDrawing,
  onDownloadDrawing,
  onStartFromMatrix,
  loading = false,
  onLoadMore,
  hasMore = false,
}) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [sortBy, setSortBy] = useState('updated'); // 'updated' | 'number' | 'title'

  // KPI counts
  const kpis = facets?.kpi || {
    total: totalCount || drawings.length,
    gfc: drawings.filter((d) => ['Approved', 'Good for construction', 'Published', 'Current'].includes(d.currentStatus)).length,
    draft: drawings.filter((d) => ['Draft', 'Under Review'].includes(d.currentStatus)).length,
    updatedThisWeek: 0,
  };

  // Sort drawings
  const sortedDrawings = useMemo(() => {
    const list = [...drawings];
    if (sortBy === 'number') {
      list.sort((a, b) => (a.drawingNumber || '').localeCompare(b.drawingNumber || ''));
    } else if (sortBy === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    }
    return list;
  }, [drawings, sortBy]);

  // Check if active filters exist (excluding 'all')
  const hasActiveFilters = Boolean(
    (filters.discipline && filters.discipline !== 'all') ||
    (filters.block && filters.block !== 'all') ||
    (filters.level && filters.level !== 'all') ||
    (filters.status && filters.status !== 'all') ||
    (filters.search && filters.search.trim())
  );

  const isTotalZero = totalCount === 0 && drawings.length === 0 && !hasActiveFilters;

  // Format date nicely
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return { date: 'Recently', time: '' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: 'Recently', time: '' };
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return {
        date: 'Today',
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }
    return {
      date: d.toLocaleDateString([], { day: '2-digit', month: 'short' }),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div className="drawings-hub-container">
      {/* 4 Tappable KPI Cards */}
      <div className="drawings-kpi-grid">
        {/* Total Drawings */}
        <button
          type="button"
          className={`drawings-kpi-card ${!filters.status || filters.status === 'all' ? 'selected' : ''}`}
          onClick={() => onFilterChange({ status: 'all' })}
          aria-label="Filter by all drawings"
        >
          <div className="drawings-kpi-header">
            <span className="drawings-kpi-dot" style={{ backgroundColor: "var(--accent)" }} />
            <span>Total drawings</span>
          </div>
          <div className="drawings-kpi-val">{kpis.total}</div>
          <div className="drawings-kpi-sub">Across all disciplines</div>
        </button>

        {/* Good for Construction */}
        <button
          type="button"
          className={`drawings-kpi-card ${filters.status === 'Approved' || filters.status === 'GFC' ? 'selected' : ''}`}
          onClick={() => onFilterChange({ status: filters.status === 'Approved' ? 'all' : 'Approved' })}
          aria-label="Filter by Good for construction"
        >
          <div className="drawings-kpi-header">
            <span className="drawings-kpi-dot" style={{ backgroundColor: "var(--accent)" }} />
            <span>Good for construction</span>
          </div>
          <div className="drawings-kpi-val" style={{ color: "var(--accent)" }}>
            {kpis.gfc}
          </div>
          <div className="drawings-kpi-sub">Current set for the site</div>
        </button>

        {/* Draft */}
        <button
          type="button"
          className={`drawings-kpi-card ${filters.status === 'Draft' ? 'selected' : ''}`}
          onClick={() => onFilterChange({ status: filters.status === 'Draft' ? 'all' : 'Draft' })}
          aria-label="Filter by Draft"
        >
          <div className="drawings-kpi-header">
            <span className="drawings-kpi-dot" style={{ backgroundColor: '#f59e0b' }} />
            <span>Draft</span>
          </div>
          <div className="drawings-kpi-val" style={{ color: '#f59e0b' }}>
            {kpis.draft}
          </div>
          <div className="drawings-kpi-sub">Not yet released to site</div>
        </button>

        {/* Updated this week */}
        <button
          type="button"
          className={`drawings-kpi-card ${filters.status === 'this-week' ? 'selected' : ''}`}
          onClick={() => onFilterChange({ status: filters.status === 'this-week' ? 'all' : 'this-week' })}
          aria-label="Filter by updated this week"
        >
          <div className="drawings-kpi-header">
            <span className="drawings-kpi-dot" style={{ backgroundColor: '#3b82f6' }} />
            <span>Updated this week</span>
          </div>
          <div className="drawings-kpi-val" style={{ color: '#60a5fa' }}>
            {kpis.updatedThisWeek}
          </div>
          <div className="drawings-kpi-sub">New or revised since Monday</div>
        </button>
      </div>

      {/* Action Strip: 2 Large Action Buttons (min-height 64px) + Add new revision */}
      <div className="drawings-action-strip">
        <button
          type="button"
          className="drawings-big-btn drawings-big-btn-primary"
          onClick={() => onOpenUpload()}
          aria-label="Upload drawing"
        >
          <div className="drawings-big-btn-icon">
            <Upload size={20} />
          </div>
          <div>
            <div className="drawings-big-btn-title">Upload drawing</div>
            <div className="drawings-big-btn-sub">Drop files, details fill in for you</div>
          </div>
        </button>

        <button
          type="button"
          className="drawings-big-btn drawings-big-btn-secondary"
          onClick={onGoToVersions}
          aria-label="View version history"
        >
          <div className="drawings-big-btn-icon">
            <Clock size={20} />
          </div>
          <div>
            <div className="drawings-big-btn-title">Version history</div>
            <div className="drawings-big-btn-sub">See every revision, date and note</div>
          </div>
        </button>

        <button
          type="button"
          className="drawings-big-btn drawings-big-btn-secondary"
          onClick={onOpenNewRevision}
          aria-label="Add new revision"
        >
          <div className="drawings-big-btn-icon">
            <Plus size={20} />
          </div>
          <div>
            <div className="drawings-big-btn-title">Add new revision</div>
            <div className="drawings-big-btn-sub">Upload the next version of a drawing</div>
          </div>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          EMPTY STATE 1: Zero Drawings in Project
          ───────────────────────────────────────────────────────────── */}
      {isTotalZero ? (
        <div className="drawings-empty-state-box">
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Start your drawing register
            </h2>
            <p style={{ fontSize: '0.875rem', color: "var(--text-secondary)", margin: '0.5rem 0 0 0', lineHeight: 1.5 }}>
              Drop your files and the drawing number, discipline and level are read from the file name. You check them once, then save.
            </p>

            {/* Dashed Dropzone */}
            <div className="drawings-empty-dropzone" onClick={() => onOpenUpload()}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: "var(--accent)",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <Upload size={28} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Drop drawings here
              </h3>
              <p style={{ fontSize: '0.8125rem', color: "var(--text-secondary)", margin: '0.35rem 0 1rem' }}>
                DWG, DXF, PDF, PNG or SVG. You can drop many files, or a whole folder, at once.
              </p>
              <button
                type="button"
                className="drawings-big-btn-primary"
                style={{
                  minHeight: '44px',
                  padding: '0 1.5rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenUpload();
                }}
              >
                Choose files
              </button>
            </div>

            {/* 3 Steps */}
            <div className="drawings-empty-steps">
              <div className="drawings-empty-step-card">
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: "var(--accent)", marginBottom: '4px' }}>
                  1. Drop your files
                </div>
                <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  One file or a full set. Upload progress shows per file.
                </div>
              </div>
              <div className="drawings-empty-step-card">
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: "var(--accent)", marginBottom: '4px' }}>
                  2. Check what we read
                </div>
                <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  Number, title, discipline, block, level and revision are pre-filled. Fix anything that is off.
                </div>
              </div>
              <div className="drawings-empty-step-card">
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: "var(--accent)", marginBottom: '4px' }}>
                  3. Save it
                </div>
                <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  The drawing joins the register as the current version, with its date and note.
                </div>
              </div>
            </div>

            {/* Filename Parsing Example */}
            <div className="drawings-empty-example-card">
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: "var(--text-label)", marginBottom: '0.5rem' }}>
                EXAMPLE OF WHAT IS READ FROM A FILE NAME
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: "var(--input-bg)",
                    padding: '0.3rem 0.6rem',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem',
                    color: "var(--text-primary)",
                  }}
                >
                  DT-STR-L02-004_Slab-Plan_R03.pdf
                </span>
                <span style={{ color: "var(--text-label)" }}>→</span>
                <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: "var(--accent)", padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                  Structural
                </span>
                <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                  Level 2
                </span>
                <span style={{ background: 'rgba(148, 163, 184, 0.15)', color: "var(--text-secondary)", padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                  Revision R03
                </span>
              </div>
            </div>

            {/* Secondary Option Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: '10px',
                  padding: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onClick={onStartFromMatrix}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: "var(--text-primary)", marginBottom: '2px' }}>
                  Start from the matrix
                </div>
                <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)" }}>
                  See which floors and disciplines still need drawings
                </div>
              </div>

              <div
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: '10px',
                  padding: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onClick={() => alert('Excel Register Import feature: Upload an Excel or CSV file to import drawings.')}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: "var(--text-primary)", marginBottom: '2px' }}>
                  Import an existing register
                </div>
                <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)" }}>
                  Bring in your current drawing list from Excel
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : sortedDrawings.length === 0 && hasActiveFilters ? (
        /* ─────────────────────────────────────────────────────────────
            EMPTY STATE 2: Filters Hide Everything
            ───────────────────────────────────────────────────────────── */
        <div className="drawings-empty-state-box" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <FilterX size={44} style={{ color: "var(--text-secondary)", margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            No drawings match active filters
          </h3>
          <p style={{ fontSize: '0.8125rem', color: "var(--text-secondary)", margin: '0.5rem auto 1.5rem', maxWidth: '420px' }}>
            The project has {kpis.total} drawings. Try clearing the filters or uploading a new drawing matching this criteria.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="drawings-row-btn"
              onClick={() => onFilterChange({ discipline: 'all', block: 'all', level: 'all', status: 'all', search: '' })}
            >
              Clear filters
            </button>
            <button
              type="button"
              className="drawings-big-btn-primary"
              style={{ minHeight: '44px', padding: '0 1.25rem', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              onClick={() =>
                onOpenUpload({
                  discipline: filters.discipline !== 'all' ? filters.discipline : undefined,
                  block: filters.block !== 'all' ? filters.block : undefined,
                  level: filters.level !== 'all' ? filters.level : undefined,
                })
              }
            >
              Upload drawing to this filter
            </button>
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            REGISTER TABLE & CARDS
            ───────────────────────────────────────────────────────────── */
        <>
          {/* Section Header */}
          <div className="drawings-section-header">
            <div className="drawings-section-title">
              <span>Drawing register</span>
              <span className="drawings-section-count">
                Showing {sortedDrawings.length} of {kpis.total}
              </span>
            </div>

            <div className="drawings-view-controls">
              {/* Table / Cards toggle */}
              <div className="drawings-view-toggle">
                <button
                  type="button"
                  className={`drawings-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  aria-label="Table view"
                >
                  Table
                </button>
                <button
                  type="button"
                  className={`drawings-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  aria-label="Cards view"
                >
                  Cards
                </button>
              </div>

              {/* Sort Dropdown */}
              <Select
                className="drawings-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort drawings"
              >
                <option value="updated">Sort: Recently updated</option>
                <option value="number">Sort: Drawing number</option>
                <option value="title">Sort: Title</option>
              </Select>
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' ? (
            <div className="drawings-table-wrap">
              <table className="drawings-table">
                <thead>
                  <tr>
                    <th>Drawing</th>
                    <th>Rev</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDrawings.map((dw) => {
                    const isGfc = ['Approved', 'Good for construction', 'Published', 'Current'].includes(dw.currentStatus);
                    const revNum = dw.currentRevisionNumber || 'R00';
                    const { date, time } = formatDateDisplay(dw.updatedAt);
                    const author = dw.updatedByName || dw.createdBy || 'Structural Consultant';

                    return (
                      <tr key={dw._id || dw.id}>
                        <td>
                          <div className="drawings-table-dw-no">{dw.drawingNumber}</div>
                          <div className="drawings-table-dw-title">{dw.title}</div>
                          <div className="drawings-table-dw-meta">
                            {dw.blockName || 'Block A'} · {dw.level || 'Ground'} · {dw.disciplineCode || 'Structural'}
                          </div>
                        </td>
                        <td>
                          <span className="drawings-rev-badge">{revNum}</span>
                        </td>
                        <td>
                          <span className={`drawings-status-badge ${isGfc ? 'drawings-status-gfc' : 'drawings-status-draft'}`}>
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: isGfc ? '#10b981' : '#f59e0b',
                              }}
                            />
                            <span>{isGfc ? 'Good for construction' : 'Draft'}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: '0.8125rem' }}>
                            {date} {time ? `, ${time}` : ''}
                          </div>
                          <div style={{ color: "var(--text-label)", fontSize: '0.75rem' }}>{author}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="drawings-row-actions" style={{ justifyContent: 'flex-end' }}>
                            {/* View (Opens CAD/PDF viewer) */}
                            <button
                              type="button"
                              className="drawings-row-btn drawings-row-btn-view"
                              onClick={() => onViewDrawing(dw)}
                              aria-label={`View drawing ${dw.drawingNumber}`}
                            >
                              <Eye size={15} />
                              <span>View</span>
                            </button>

                            {/* + Rev (Opens Upload Drawer in rev mode) */}
                            <button
                              type="button"
                              className="drawings-row-btn"
                              onClick={() =>
                                onOpenUpload({
                                  drawingNumber: dw.drawingNumber,
                                  title: dw.title,
                                  disciplineCode: dw.disciplineCode,
                                  blockName: dw.blockName,
                                  level: dw.level,
                                  existingDrawing: dw,
                                })
                              }
                              aria-label={`Add revision to ${dw.drawingNumber}`}
                            >
                              <span>+ Rev</span>
                            </button>

                            {/* Versions (Goes to Versions Hub with this drawing selected) */}
                            <button
                              type="button"
                              className="drawings-row-btn"
                              onClick={() => onGoToVersions(dw._id || dw.id)}
                              aria-label={`View revision history for ${dw.drawingNumber}`}
                            >
                              <Clock size={15} />
                            </button>

                            {/* Download */}
                            <button
                              type="button"
                              className="drawings-row-btn"
                              onClick={() => onDownloadDrawing(dw)}
                              aria-label={`Download drawing ${dw.drawingNumber}`}
                            >
                              <Download size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards View (default <768px or user toggle) */
            <div className="drawings-cards-grid">
              {sortedDrawings.map((dw) => {
                const isGfc = ['Approved', 'Good for construction', 'Published', 'Current'].includes(dw.currentStatus);
                const revNum = dw.currentRevisionNumber || 'R00';
                const { date, time } = formatDateDisplay(dw.updatedAt);
                const author = dw.updatedByName || dw.createdBy || 'Structural Consultant';

                return (
                  <div key={dw._id || dw.id} className="drawings-card-item">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: "var(--text-primary)" }}>
                          {dw.drawingNumber}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: "var(--text-secondary)", marginTop: '2px' }}>
                          {dw.title}
                        </div>
                      </div>
                      <span className="drawings-rev-badge">{revNum}</span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: "var(--text-label)" }}>
                      {dw.blockName || 'Block A'} · {dw.level || 'Ground'} · {dw.disciplineCode || 'Structural'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.25rem 0' }}>
                      <span className={`drawings-status-badge ${isGfc ? 'drawings-status-gfc' : 'drawings-status-draft'}`}>
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: isGfc ? '#10b981' : '#f59e0b',
                          }}
                        />
                        <span>{isGfc ? 'Good for construction' : 'Draft'}</span>
                      </span>
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: "var(--text-secondary)" }}>
                        <div>{date} {time}</div>
                        <div style={{ color: "var(--text-label)" }}>{author}</div>
                      </div>
                    </div>

                    {/* Card Actions (Each >=44px) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 44px 44px', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="drawings-row-btn drawings-row-btn-view"
                        onClick={() => onViewDrawing(dw)}
                      >
                        <Eye size={15} />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        className="drawings-row-btn"
                        onClick={() =>
                          onOpenUpload({
                            drawingNumber: dw.drawingNumber,
                            title: dw.title,
                            disciplineCode: dw.disciplineCode,
                            blockName: dw.blockName,
                            level: dw.level,
                            existingDrawing: dw,
                          })
                        }
                      >
                        + Rev
                      </button>
                      <button
                        type="button"
                        className="drawings-row-btn"
                        onClick={() => onGoToVersions(dw._id || dw.id)}
                      >
                        <Clock size={15} />
                      </button>
                      <button
                        type="button"
                        className="drawings-row-btn"
                        onClick={() => onDownloadDrawing(dw)}
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More Pagination */}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                type="button"
                className="drawings-row-btn"
                onClick={onLoadMore}
                disabled={loading}
                style={{ minHeight: '44px', padding: '0 2rem', fontWeight: 700 }}
              >
                {loading ? 'Loading more...' : 'Load more drawings'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

