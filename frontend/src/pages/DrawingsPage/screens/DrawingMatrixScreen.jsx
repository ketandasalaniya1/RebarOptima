import React, { useState } from 'react';
import './DrawingMatrixScreen.css';
import { useGetDrawingMatrixQuery, useGetBlocksQuery } from '../../../store/api/drawingsApi';
import { Check, X, Minus } from 'lucide-react';

const STANDARD_DISCIPLINES = [
  { code: 'all', name: 'All Disciplines' },
  { code: 'ARCH', name: 'Architectural' },
  { code: 'STR', name: 'Structural' },
  { code: 'MEPF', name: 'MEPF' },
  { code: 'MECH', name: 'Mechanical' },
  { code: 'ELEC', name: 'Electrical' },
  { code: 'PLUMB', name: 'Plumbing' },
  { code: 'FIRE', name: 'Fire Fighting' },
  { code: 'LAND', name: 'Landscape' },
  { code: 'INT', name: 'Interior' },
  { code: 'CIVIL', name: 'Civil' }
];

export default function DrawingMatrixScreen({
  activeProject,
  onSelectDrawing,
  onEmptyCellClick
}) {
  const projectId = activeProject?._id || activeProject?.id;

  const [selectedBlock, setSelectedBlock] = useState('all');
  const [selectedDiscipline, setSelectedDiscipline] = useState('all');

  const { data: blocks = [] } = useGetBlocksQuery(projectId, { skip: !projectId });

  const { data, isLoading } = useGetDrawingMatrixQuery({
    projectId: projectId || undefined,
    blockId: selectedBlock !== 'all' ? selectedBlock : undefined,
    disciplineId: selectedDiscipline !== 'all' ? selectedDiscipline : undefined
  }, {
    skip: !projectId
  });

  const levels = data?.levels || ['B2', 'B1', 'G', 'L1', 'L2', 'L3', 'L4', 'L5', 'Terrace', 'General'];
  const rows = data?.rows || [];

  const renderCellContent = (cell) => {
    if (!cell) {
      return <span className="ro-cell-dash">—</span>;
    }

    const st = String(cell.status || '').toUpperCase();
    if (st === 'APPROVED' || st === 'CURRENT' || st === 'PUBLISHED') {
      return (
        <span className="ro-cell-check" title={`${cell.drawingNumber} (${cell.version}) - Current`}>
          <Check size={16} strokeWidth={3} />
        </span>
      );
    }
    if (st === 'IN_REVIEW' || st === 'UNDER_REVIEW' || st === 'PENDING_APPROVAL' || st === 'REVIEW') {
      return (
        <span className="ro-cell-review" title={`${cell.drawingNumber} (${cell.version}) - In Review`} />
      );
    }
    if (st === 'REJECTED' || st === 'DECLINED') {
      return (
        <span className="ro-cell-rejected" title={`${cell.drawingNumber} (${cell.version}) - Rejected`}>
          <X size={15} strokeWidth={2.5} />
        </span>
      );
    }
    return (
      <span className="ro-cell-check" style={{ color: '#64748b' }} title={`${cell.drawingNumber} - ${cell.status}`}>
        ✓
      </span>
    );
  };

  return (
    <div className="ro-matrix-screen">
      {/* Header & Legend */}
      <div className="ro-matrix-header">
        <h2 className="ro-matrix-title">Drawing Matrix View (Quick Access)</h2>

        <div className="ro-matrix-legend">
          <div className="ro-legend-item">
            <span className="ro-legend-icon-check">✓</span>
            <span>Has Drawing</span>
          </div>
          <div className="ro-legend-item">
            <span className="ro-legend-icon-dash">—</span>
            <span>No Drawing</span>
          </div>
          <div className="ro-legend-item">
            <span className="ro-legend-icon-review" />
            <span>In Review</span>
          </div>
          <div className="ro-legend-item">
            <span className="ro-legend-icon-rejected">✕</span>
            <span>Rejected</span>
          </div>
        </div>
      </div>

      {/* Top Filter Row */}
      <div className="ro-matrix-filters-row">
        <div className="ro-matrix-filter-item">
          <label htmlFor="matrix-block-select">Block:</label>
          <select
            id="matrix-block-select"
            className="ro-filter-select"
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(e.target.value)}
          >
            <option value="all">All Blocks</option>
            {blocks.map((b) => (
              <option key={b._id || b.name} value={b.name || b._id}>
                {b.name || b.blockName}
              </option>
            ))}
          </select>
        </div>

        <div className="ro-matrix-filter-item">
          <label htmlFor="matrix-disc-select">Discipline:</label>
          <select
            id="matrix-disc-select"
            className="ro-filter-select"
            value={selectedDiscipline}
            onChange={(e) => setSelectedDiscipline(e.target.value)}
          >
            {STANDARD_DISCIPLINES.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="ro-matrix-container">
        <table className="ro-matrix-table">
          <thead>
            <tr>
              <th className="sticky-col-1">Drawing No.</th>
              <th className="sticky-col-2">Title</th>
              {levels.map((lvl) => (
                <th key={lvl}>{lvl}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={levels.length + 2} style={{ padding: '40px', color: 'var(--text-label, #64748b)' }}>
                  Loading Drawing Matrix...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={levels.length + 2} style={{ padding: '40px', color: 'var(--text-label, #64748b)' }}>
                  No matrix records found.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={`${row.drawingNumber}-${idx}`}>
                  <td className="sticky-col-1">{row.drawingNumber}</td>
                  <td className="sticky-col-2">{row.title}</td>
                  {levels.map((lvl) => {
                    const cell = row.cells ? row.cells[lvl] : null;
                    return (
                      <td
                        key={lvl}
                        className="ro-matrix-cell"
                        onClick={() => {
                          if (cell && onSelectDrawing) {
                            onSelectDrawing(cell);
                          } else if (!cell && onEmptyCellClick) {
                            onEmptyCellClick(row, lvl);
                          }
                        }}
                      >
                        {renderCellContent(cell)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

