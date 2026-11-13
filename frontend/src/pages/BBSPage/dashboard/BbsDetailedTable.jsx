import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import ShapeThumbnail from '../workspaces/common/ShapeThumbnail';
import RuleBadge from '../workspaces/common/RuleBadge';

export default function BbsDetailedTable({
  records = [],
  onNavigateToMember
}) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('memberMark');
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  // Table search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r => (
      (r.memberMark || '').toLowerCase().includes(q) ||
      (r.blockName || '').toLowerCase().includes(q) ||
      (r.floorName || '').toLowerCase().includes(q) ||
      (r.memberType || '').toLowerCase().includes(q) ||
      (r.barMark || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.shapeCode || '').toLowerCase().includes(q) ||
      String(r.diameter).includes(q)
    ));
  }, [records, search]);

  // Column sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let vA = a[sortField];
      let vB = b[sortField];

      if (typeof vA === 'string') vA = vA.toLowerCase();
      if (typeof vB === 'string') vB = vB.toLowerCase();

      if (vA < vB) return sortDir === 'asc' ? -1 : 1;
      if (vA > vB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, validPage, pageSize]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="bbs-sort-icon-idle" />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="bbs-sort-icon-active" />
      : <ArrowDown size={12} className="bbs-sort-icon-active" />;
  };

  return (
    <div className="bbs-detailed-table-container">
      {/* TABLE CONTROLS BAR */}
      <div className="bbs-table-controls-bar">
        <div className="bbs-table-title-area">
          <h3 className="bbs-section-title">Detailed Filtered Bar Bending Schedule</h3>
          <span className="bbs-table-count-pill">{records.length} Bar Pieces</span>
        </div>

        <div className="bbs-table-actions-area">
          <div className="bbs-table-search-input-wrap">
            <Search size={14} className="bbs-table-search-icon" />
            <input
              type="text"
              placeholder="Search table (Member, Mark, Dia, Shape)..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="bbs-table-search-field"
            />
          </div>

          <div className="bbs-table-page-size-wrap">
            <span className="bbs-table-label">Show:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bbs-table-select"
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bbs-table-scroll-container">
        <table className="bbs-detailed-data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('memberMark')} className="sortable">
                <span>Member ID</span> {renderSortIcon('memberMark')}
              </th>
              <th onClick={() => handleSort('memberType')} className="sortable">
                <span>Type</span> {renderSortIcon('memberType')}
              </th>
              <th onClick={() => handleSort('blockName')} className="sortable">
                <span>Block</span> {renderSortIcon('blockName')}
              </th>
              <th onClick={() => handleSort('floorName')} className="sortable">
                <span>Floor</span> {renderSortIcon('floorName')}
              </th>
              <th onClick={() => handleSort('barMark')} className="sortable text-center">
                <span>Mark</span> {renderSortIcon('barMark')}
              </th>
              <th className="text-center">Shape</th>
              <th>Description</th>
              <th onClick={() => handleSort('diameter')} className="sortable text-center">
                <span>Dia</span> {renderSortIcon('diameter')}
              </th>
              <th onClick={() => handleSort('quantity')} className="sortable text-center">
                <span>Qty</span> {renderSortIcon('quantity')}
              </th>
              <th onClick={() => handleSort('cutLength')} className="sortable text-right">
                <span>Cut (mm)</span> {renderSortIcon('cutLength')}
              </th>
              <th onClick={() => handleSort('totalLengthM')} className="sortable text-right">
                <span>Tot L (m)</span> {renderSortIcon('totalLengthM')}
              </th>
              <th onClick={() => handleSort('unitWeight')} className="sortable text-right">
                <span>Unit (kg/m)</span> {renderSortIcon('unitWeight')}
              </th>
              <th onClick={() => handleSort('totalWeightKg')} className="sortable text-right">
                <span>Tot Wt (kg)</span> {renderSortIcon('totalWeightKg')}
              </th>
              <th>Rule Class</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(row => (
              <tr key={row.uniqueKey || `${row.memberId}_${row.barMark}_${row.diameter}`}>
                <td className="font-bold">
                  {onNavigateToMember ? (
                    <button
                      className="bbs-table-member-link"
                      onClick={() => onNavigateToMember(row.rawMember)}
                      title="Open in Detailing Workspace"
                    >
                      {row.memberMark}
                    </button>
                  ) : (
                    row.memberMark
                  )}
                </td>
                <td><span className="bbs-badge-type">{row.memberType}</span></td>
                <td>{row.blockName}</td>
                <td>{row.floorName}</td>
                <td className="text-center font-bold">{row.barMark}</td>
                <td className="text-center">
                  <div className="bbs-shape-cell">
                    <ShapeThumbnail shapeCode={row.shapeCode} diameter={row.diameter} size={36} />
                    <span className="bbs-shape-code-label">{row.shapeCode}</span>
                  </div>
                </td>
                <td className="bbs-desc-cell">{row.description}</td>
                <td className="text-center font-bold">Ø{row.diameter}</td>
                <td className="text-center">{row.quantity}</td>
                <td className="text-right">{Math.round(row.cutLength)}</td>
                <td className="text-right">{row.totalLengthM.toFixed(2)}</td>
                <td className="text-right">{row.unitWeight.toFixed(3)}</td>
                <td className="text-right font-bold text-accent">{row.totalWeightKg.toFixed(2)}</td>
                <td>
                  <RuleBadge classification={row.ruleClassification} source={row.ruleSource} />
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={14} className="bbs-table-empty-row">
                  No scheduled rebar records match the active filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION BAR */}
      <div className="bbs-table-pagination-bar">
        <div className="bbs-pagination-info">
          Showing {sorted.length === 0 ? 0 : (validPage - 1) * pageSize + 1} to {Math.min(validPage * pageSize, sorted.length)} of {sorted.length} records
        </div>

        <div className="bbs-pagination-buttons">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={validPage <= 1}
            className="bbs-page-btn"
            title="First page"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={validPage <= 1}
            className="bbs-page-btn"
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          <span className="bbs-page-current">
            Page {validPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={validPage >= totalPages}
            className="bbs-page-btn"
            title="Next page"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={validPage >= totalPages}
            className="bbs-page-btn"
            title="Last page"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

