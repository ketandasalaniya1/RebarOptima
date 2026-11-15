import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';

const DISCIPLINES = [
  { key: 'ARCH', label: 'Architectural' },
  { key: 'STR', label: 'Structural' },
  { key: 'MEPF', label: 'MEPF' },
  { key: 'CIV', label: 'Civil' },
];

const STANDARD_LEVELS = [
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

export default function MatrixHub({
  drawings = [],
  matrixData = null,
  activeBlock = 'All blocks',
  onCellClick,
  onEmptyCellClick,
}) {
  // Normalize drawings into grid map: level -> discipline -> drawing
  const grid = useMemo(() => {
    const map = {};
    STANDARD_LEVELS.forEach((lvl) => {
      map[lvl] = {};
    });

    // Populate from drawings list
    (drawings || []).forEach((dw) => {
      // Find matching standard level
      const dwLvl = dw.level || 'Ground';
      const matchedLevel =
        STANDARD_LEVELS.find((l) => l.toLowerCase() === dwLvl.toLowerCase()) ||
        STANDARD_LEVELS.find((l) => dwLvl.toLowerCase().includes(l.toLowerCase())) ||
        (dwLvl.toUpperCase() === 'L1' || dwLvl.toUpperCase() === 'L01' ? 'Level 1' : null) ||
        (dwLvl.toUpperCase() === 'L2' || dwLvl.toUpperCase() === 'L02' ? 'Level 2' : null) ||
        (dwLvl.toUpperCase() === 'L3' || dwLvl.toUpperCase() === 'L03' ? 'Level 3' : null) ||
        (dwLvl.toUpperCase() === 'L4' || dwLvl.toUpperCase() === 'L04' ? 'Level 4' : null) ||
        (dwLvl.toUpperCase() === 'L5' || dwLvl.toUpperCase() === 'L05' ? 'Level 5' : null) ||
        (dwLvl.toUpperCase() === 'L6' || dwLvl.toUpperCase() === 'L06' ? 'Level 6' : null) ||
        (dwLvl.toUpperCase() === 'L7' || dwLvl.toUpperCase() === 'L07' ? 'Level 7' : null) ||
        (dwLvl.toUpperCase() === 'L8' || dwLvl.toUpperCase() === 'L08' ? 'Level 8' : null) ||
        (dwLvl.toUpperCase() === 'L9' || dwLvl.toUpperCase() === 'L09' ? 'Level 9' : null) ||
        (dwLvl.toUpperCase() === 'L10' ? 'Level 10' : null) ||
        (dwLvl.toUpperCase() === 'B1' ? 'Basement 1' : null) ||
        (dwLvl.toUpperCase() === 'B2' ? 'Basement 2' : null) ||
        (dwLvl.toUpperCase() === 'G' || dwLvl.toUpperCase() === 'GF' ? 'Ground' : null) ||
        (dwLvl.toUpperCase().includes('TER') ? 'Terrace' : null);

      if (matchedLevel && map[matchedLevel]) {
        const discCode = (dw.disciplineCode || 'STR').toUpperCase();
        let colKey = 'STR';
        if (discCode.includes('ARC')) colKey = 'ARCH';
        else if (discCode.includes('STR')) colKey = 'STR';
        else if (discCode.includes('MEP') || discCode.includes('ELE') || discCode.includes('PLU') || discCode.includes('HVA')) colKey = 'MEPF';
        else if (discCode.includes('CIV')) colKey = 'CIV';

        map[matchedLevel][colKey] = dw;
      }
    });

    return map;
  }, [drawings]);

  // Compute coverage per discipline
  const coverage = useMemo(() => {
    const totalLevels = STANDARD_LEVELS.length;
    const stats = {};

    DISCIPLINES.forEach((d) => {
      let filled = 0;
      STANDARD_LEVELS.forEach((lvl) => {
        if (grid[lvl]?.[d.key]) filled++;
      });
      stats[d.key] = {
        filled,
        total: totalLevels,
        pct: Math.round((filled / totalLevels) * 100),
      };
    });

    return stats;
  }, [grid]);

  return (
    <div className="drawings-hub-container">
      {/* Title & Legend Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
            Floor by discipline
          </h2>
          <p style={{ fontSize: '0.8125rem', color: "var(--text-secondary)", margin: '4px 0 0 0' }}>
            Tap an empty slot to upload. The level and discipline are already filled in.
          </p>
        </div>

        {/* Legend Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '9999px',
              padding: '0.25rem 0.625rem',
              fontSize: '0.75rem',
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: "var(--accent)" }} />
            <span>Good for construction</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '9999px',
              padding: '0.25rem 0.625rem',
              fontSize: '0.75rem',
              color: '#f59e0b',
              fontWeight: 600,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <span>Draft</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'transparent',
              border: '1px dashed #475569',
              borderRadius: '9999px',
              padding: '0.25rem 0.625rem',
              fontSize: '0.75rem',
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            <span>+ Empty slot</span>
          </div>
        </div>
      </div>

      {/* Matrix Table Grid */}
      <div className="matrix-container">
        <table className="matrix-grid-table">
          <thead>
            <tr>
              <th style={{ width: '120px', minWidth: '100px', background: 'transparent' }} />
              {DISCIPLINES.map((d) => {
                const cov = coverage[d.key];
                return (
                  <th key={d.key} className="matrix-col-header" style={{ minWidth: '190px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: "var(--text-primary)" }}>{d.label}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: "var(--text-secondary)" }}>
                        {cov.filled} of {cov.total}
                      </span>
                    </div>
                    <div className="matrix-progress-bar">
                      <div className="matrix-progress-fill" style={{ width: `${cov.pct}%` }} />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {STANDARD_LEVELS.map((lvl) => (
              <tr key={lvl}>
                <td
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    padding: '0.5rem 0.75rem',
                    verticalAlign: 'middle',
                    textAlign: 'left',
                  }}
                >
                  {lvl}
                </td>
                {DISCIPLINES.map((d) => {
                  const dw = grid[lvl]?.[d.key];
                  if (dw) {
                    const isGfc = ['Approved', 'Good for construction', 'Published', 'Current'].includes(dw.currentStatus);
                    const revStr = dw.currentRevisionNumber || 'R00';

                    return (
                      <td key={d.key}>
                        <button
                          type="button"
                          className={`matrix-cell-btn ${isGfc ? 'matrix-cell-gfc' : 'matrix-cell-draft'}`}
                          onClick={() => onCellClick(dw)}
                          aria-label={`${lvl} ${d.label} - ${isGfc ? 'GFC' : 'Draft'} ${revStr}. Tap to view versions.`}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: isGfc ? '#10b981' : '#f59e0b',
                            }}
                          />
                          <span>
                            {isGfc ? 'GFC' : 'Draft'} · {revStr}
                          </span>
                        </button>
                      </td>
                    );
                  }

                  // Empty Slot
                  return (
                    <td key={d.key}>
                      <button
                        type="button"
                        className="matrix-cell-btn matrix-cell-empty"
                        onClick={() => onEmptyCellClick(lvl, d.label, activeBlock)}
                        aria-label={`Empty slot for ${lvl} ${d.label}. Tap to upload.`}
                      >
                        <Plus size={14} />
                        <span>Upload</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footnote */}
      <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: "var(--text-label)", textAlign: 'center' }}>
        Sample data for illustration. Showing all blocks combined; pick a block above to see one building.
      </div>
    </div>
  );
}

