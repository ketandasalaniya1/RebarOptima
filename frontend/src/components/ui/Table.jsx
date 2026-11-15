import React from 'react';
import './ui.css';

export default function Table({
  columns = [],
  data = [],
  keyField = 'id',
  loading = false,
  emptyText = 'No records found',
  onRowClick,
  className = '',
}) {
  return (
    <div className={`ro-table-container ${className}`}>
      <table className="ro-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  textAlign: col.align || 'left',
                  width: col.width,
                  minWidth: col.minWidth,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="ro-skeleton" style={{ height: '36px', width: '100%' }} />
                  ))}
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: 'center', padding: '36px', color: 'var(--text-label)' }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={row[keyField] || rowIndex}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={col.key || colIndex}
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {col.render ? col.render(row[col.key], row, rowIndex) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

