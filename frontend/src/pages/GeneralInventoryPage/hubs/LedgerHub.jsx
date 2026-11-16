import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  ArrowRightLeft,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  Clock,
  ChevronDown
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { generalInventoryApi } from '../../../utils/api';
import { Input, Select } from '../../../components/ui';

export default function LedgerHub({
  projectId = '',
  selectedStoreId = '',
  stores = [],
  projectName = 'Standard Project',
  currentUser,
  materials = [],
  inwardEntries = [],
  outwardEntries = [],
  returnsEntries = [],
  transfers = [],
  adjustments = [],
  onOpenSlip
}) {
  // View Mode: 'ledger' (Live Transaction Timeline) vs 'reports' (Stock Audit Reports)
  const [viewMode, setViewMode] = useState('ledger');

  // Ledger Filter Pills: 'ALL' | 'INWARD' | 'OUTWARD' | 'RETURN' | 'TRANSFER' | 'ADJUSTMENT'
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Date Range Presets: 'all' | 'today' | '7days' | 'month' | 'custom'
  const [datePreset, setDatePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Search Query
  const [searchQuery, setSearchQuery] = useState('');

  // Backend Ledger Data & Loading
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Specialized Reports Mode State
  const [reportType, setReportType] = useState('store-wise-stock');
  const [reportData, setReportData] = useState(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const pdfPrintRef = useRef(null);

  // Store lookup map
  const storeMap = useMemo(() => {
    const map = {};
    stores.forEach((s) => {
      map[s.id || s._id] = s.name;
    });
    return map;
  }, [stores]);

  // Load backend ledger when projectId or storeId changes
  useEffect(() => {
    if (projectId) {
      loadBackendLedger();
    }
  }, [projectId, selectedStoreId]);

  const loadBackendLedger = async () => {
    if (!projectId) return;
    setIsLoadingLedger(true);
    try {
      const res = await generalInventoryApi.getLedger(projectId, {
        storeId: selectedStoreId || undefined
      });
      setLedgerEntries(res.data || []);
    } catch (err) {
      console.warn('Backend ledger fetch fallback:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // Compile unified ledger list: If backend ledger entries exist, use them;
  // otherwise assemble from domain states (inwardEntries, outwardEntries, returnsEntries, transfers, adjustments)
  const unifiedTransactions = useMemo(() => {
    if (ledgerEntries && ledgerEntries.length > 0) {
      return ledgerEntries.map((tx) => {
        const typeStr = (tx.transactionType || tx.referenceType || 'INWARD').toUpperCase();
        let normalizedType = 'INWARD';
        if (typeStr.includes('OUT') || typeStr.includes('ISSUE')) normalizedType = 'OUTWARD';
        else if (typeStr.includes('RET')) normalizedType = 'RETURN';
        else if (typeStr.includes('TRANS')) normalizedType = 'TRANSFER';
        else if (typeStr.includes('ADJ') || typeStr.includes('OPEN')) normalizedType = 'ADJUSTMENT';

        return {
          id: tx._id || tx.id || `tx_${Math.random()}`,
          date: tx.date || tx.createdAt,
          type: normalizedType,
          rawType: tx.transactionType,
          referenceNumber: tx.referenceNumber || 'TXN',
          materialName: tx.materialName || 'Material',
          quantity: tx.quantity ?? 0,
          balanceAfter: tx.balanceAfter,
          uom: tx.uom || 'Nos',
          storeName: storeMap[tx.storeId] || tx.storeName || 'Godown',
          performedBy: tx.performedBy?.name || 'Store User',
          remarks: tx.remarks || '',
          rawData: tx
        };
      });
    }

    // Fallback: assemble from real-time domain states
    const list = [];

    inwardEntries.forEach((it) => {
      const itemsList = it.items || [];
      itemsList.forEach((i, idx) => {
        list.push({
          id: `in_${it.id || it._id}_${idx}`,
          date: it.receiptDate || it.createdAt,
          type: 'INWARD',
          rawType: 'INWARD (GRN)',
          referenceNumber: it.inwardNumber || 'GRN',
          materialName: i.materialName,
          quantity: i.acceptedQuantity ?? i.receivedQuantity ?? 0,
          uom: i.uom || 'Nos',
          storeName: storeMap[it.storeId] || 'Main Godown',
          performedBy: it.vendorName ? `Vendor: ${it.vendorName}` : it.receivedBy?.name || 'Receiver',
          remarks: i.remarks || it.remarks || '',
          rawData: it
        });
      });
    });

    outwardEntries.forEach((out) => {
      list.push({
        id: `out_${out.id || out._id}`,
        date: out.issueDateTime || out.createdAt,
        type: 'OUTWARD',
        rawType: out.returnClassification === 'returnable' ? 'TOOL BORROWED' : 'MATERIAL ISSUE',
        referenceNumber: out.outwardNumber || 'OUT',
        materialName: out.materialName,
        quantity: out.quantity ?? 0,
        uom: out.uom || 'Nos',
        storeName: storeMap[out.storeId] || 'Main Godown',
        performedBy: `To: ${out.personReceiving}${out.agency && out.agency !== 'Not Applicable' ? ` (${out.agency})` : ''}`,
        remarks: out.remarks || out.purpose || '',
        rawData: out
      });
    });

    returnsEntries.forEach((ret) => {
      list.push({
        id: `ret_${ret.id || ret._id}`,
        date: ret.returnDate || ret.createdAt,
        type: 'RETURN',
        rawType: 'RETURN',
        referenceNumber: ret.returnNumber || 'RET',
        materialName: ret.materialName || 'Returned Item',
        quantity: ret.acceptedQuantity ?? 1,
        uom: ret.uom || 'Nos',
        storeName: storeMap[ret.storeId] || 'Main Godown',
        performedBy: `By: ${ret.returnedByPerson || 'Site Staff'}`,
        remarks: ret.remarks || '',
        rawData: ret
      });
    });

    transfers.forEach((tr) => {
      list.push({
        id: `tr_${tr.id || tr._id}`,
        date: tr.transferDate || tr.createdAt,
        type: 'TRANSFER',
        rawType: 'STORE TRANSFER',
        referenceNumber: tr.transferNumber || 'TR',
        materialName: tr.materialName || 'Transferred Item',
        quantity: tr.quantity ?? 1,
        uom: tr.uom || 'Nos',
        storeName: `${tr.sourceStoreName || 'Source'} → ${tr.destinationStoreName || 'Dest'}`,
        performedBy: tr.reference || 'Store Transfer',
        remarks: tr.remarks || '',
        rawData: tr
      });
    });

    adjustments.forEach((adj) => {
      list.push({
        id: `adj_${adj.id || adj._id}`,
        date: adj.createdAt || new Date(),
        type: 'ADJUSTMENT',
        rawType: adj.adjustmentType === 'ADD' ? '+ ADJUSTMENT' : '− ADJUSTMENT',
        referenceNumber: adj.adjustmentNumber || 'ADJ',
        materialName: adj.materialName,
        quantity: adj.quantity ?? 0,
        uom: adj.uom || 'Nos',
        storeName: storeMap[adj.storeId] || 'Godown',
        performedBy: adj.authorizedBy?.name || 'Project Manager',
        remarks: adj.reason || '',
        rawData: adj
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ledgerEntries, inwardEntries, outwardEntries, returnsEntries, transfers, adjustments, storeMap]);

  // Date preset handler
  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  // Filtered transactions based on type, search query, and date range
  const filteredTransactions = useMemo(() => {
    return unifiedTransactions.filter((tx) => {
      // Type filter
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;

      // Date range filter
      if (startDate) {
        const txDate = new Date(tx.date).toISOString().split('T')[0];
        if (txDate < startDate) return false;
      }
      if (endDate) {
        const txDate = new Date(tx.date).toISOString().split('T')[0];
        if (txDate > endDate) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matMatch = (tx.materialName || '').toLowerCase().includes(q);
        const refMatch = (tx.referenceNumber || '').toLowerCase().includes(q);
        const partyMatch = (tx.performedBy || '').toLowerCase().includes(q);
        const storeMatch = (tx.storeName || '').toLowerCase().includes(q);
        const remarkMatch = (tx.remarks || '').toLowerCase().includes(q);
        if (!matMatch && !refMatch && !partyMatch && !storeMatch && !remarkMatch) return false;
      }

      return true;
    });
  }, [unifiedTransactions, typeFilter, startDate, endDate, searchQuery]);

  // Summary statistics
  const summaryKpis = useMemo(() => {
    let inwardCount = 0;
    let outwardCount = 0;
    let returnCount = 0;
    let transferCount = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'INWARD') inwardCount++;
      else if (tx.type === 'OUTWARD') outwardCount++;
      else if (tx.type === 'RETURN') returnCount++;
      else if (tx.type === 'TRANSFER' || tx.type === 'ADJUSTMENT') transferCount++;
    });

    return {
      total: filteredTransactions.length,
      inwardCount,
      outwardCount,
      otherCount: returnCount + transferCount
    };
  }, [filteredTransactions]);

  // Load Specialized Report data (Mode B)
  const loadSpecializedReport = async (type) => {
    if (!projectId) return;
    setIsReportLoading(true);
    try {
      const res = await generalInventoryApi.getReport(projectId, type, {
        storeId: selectedStoreId || undefined
      });
      setReportData(res.data || null);
    } catch (err) {
      console.warn('Report load error:', err);
    } finally {
      setIsReportLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'reports') {
      loadSpecializedReport(reportType);
    }
  }, [viewMode, reportType, selectedStoreId]);

  // ──────────────────────────────────────────────────────────────────────────
  // EXPORT TO EXCEL (.xlsx / .csv with UTF-8 BOM for Microsoft Excel)
  // ──────────────────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const activeRows = viewMode === 'ledger' ? filteredTransactions : reportData?.rows || [];
    if (!activeRows || activeRows.length === 0) {
      alert('No ledger records available to export.');
      return;
    }

    let csvContent = '';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `RebarOptima_${viewMode === 'ledger' ? 'Material_Ledger' : reportType}_${dateStr}`;

    if (viewMode === 'ledger') {
      const headers = ['Date', 'Reference #', 'Type', 'Material', 'Quantity', 'Unit (UOM)', 'Store / Godown', 'Party / Performed By', 'Remarks / Legal Reason'];
      csvContent = headers.join(',') + '\n';

      activeRows.forEach((r) => {
        const row = [
          `"${r.date ? new Date(r.date).toLocaleDateString() : ''}"`,
          `"${r.referenceNumber || ''}"`,
          `"${r.type || ''}"`,
          `"${(r.materialName || '').replace(/"/g, '""')}"`,
          r.quantity ?? '',
          `"${r.uom || ''}"`,
          `"${(r.storeName || '').replace(/"/g, '""')}"`,
          `"${(r.performedBy || '').replace(/"/g, '""')}"`,
          `"${(r.remarks || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(',') + '\n';
      });
    } else {
      // Specialized report rows
      const keys = Object.keys(activeRows[0]).filter((k) => k !== '_id' && k !== 'id' && typeof activeRows[0][k] !== 'object');
      csvContent = keys.map((k) => `"${k}"`).join(',') + '\n';

      activeRows.forEach((r) => {
        const row = keys.map((k) => {
          const val = r[k] !== undefined && r[k] !== null ? String(r[k]).replace(/"/g, '""') : '';
          return `"${val}"`;
        });
        csvContent += row.join(',') + '\n';
      });
    }

    // UTF-8 BOM for MS Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // EXPORT TO PDF (.pdf via html2pdf.js)
  // ──────────────────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!pdfPrintRef.current) return;
    setIsExportingPdf(true);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `RebarOptima_Material_Ledger_${dateStr}.pdf`;

    const opt = {
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false
      },
      pagebreak: { mode: ['css', 'legacy'] },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    try {
      await html2pdf().set(opt).from(pdfPrintRef.current).save();
    } catch (err) {
      console.error('PDF export failed, using browser print fallback:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="gi-ledger-container">
      {/* ── 1. Top Mode Switcher Bar & Export Actions ── */}
      <div className="gi-ledger-top-bar">
        <div className="gi-ledger-modes">
          <button
            type="button"
            className={`gi-mode-tab ${viewMode === 'ledger' ? 'active' : ''}`}
            onClick={() => setViewMode('ledger')}
          >
            <Clock size={16} />
            <span>Material Movement Ledger</span>
            <span className="gi-mode-badge">{filteredTransactions.length}</span>
          </button>

          <button
            type="button"
            className={`gi-mode-tab ${viewMode === 'reports' ? 'active' : ''}`}
            onClick={() => setViewMode('reports')}
          >
            <FileText size={16} />
            <span>Inventory Audit Reports</span>
          </button>
        </div>

        {/* Export Buttons */}
        <div className="gi-ledger-export-actions">
          <button
            type="button"
            className="gi-btn-export excel"
            onClick={handleExportExcel}
            title="Download formatted spreadsheet for MS Excel / Sheets"
          >
            <FileSpreadsheet size={15} />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            className="gi-btn-export pdf"
            onClick={handleExportPDF}
            disabled={isExportingPdf}
            title="Download official branded PDF report"
          >
            <Download size={15} className={isExportingPdf ? 'spin' : ''} />
            <span>{isExportingPdf ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>

          <button
            type="button"
            className="gi-btn-export print"
            onClick={() => window.print()}
            title="Direct print"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ── 2. Summary KPI Ribbon (At-A-Glance for User) ── */}
      <div className="gi-ledger-kpi-ribbon">
        <div className="gi-ledger-kpi-chip">
          <span className="gi-kpi-chip-label">Total Transactions</span>
          <strong className="gi-kpi-chip-val">{summaryKpis.total}</strong>
        </div>
        <div className="gi-ledger-kpi-chip inward">
          <span className="gi-kpi-chip-label">Goods Inward (GRN)</span>
          <strong className="gi-kpi-chip-val text-green">{summaryKpis.inwardCount}</strong>
        </div>
        <div className="gi-ledger-kpi-chip outward">
          <span className="gi-kpi-chip-label">Site Issues (Outward)</span>
          <strong className="gi-kpi-chip-val text-blue">{summaryKpis.outwardCount}</strong>
        </div>
        <div className="gi-ledger-kpi-chip other">
          <span className="gi-kpi-chip-label">Returns & Adjustments</span>
          <strong className="gi-kpi-chip-val text-purple">{summaryKpis.otherCount}</strong>
        </div>
      </div>

      {/* ── MODE A: LIVE MATERIAL LEDGER TIMELINE ── */}
      {viewMode === 'ledger' && (
        <div className="gi-ledger-main-view">
          {/* Filter & Search Toolbar */}
          <div className="gi-ledger-filter-toolbar">
            {/* Search Input */}
            <div className="gi-ledger-search-box">
              <Search size={16} />
              <Input
                type="text"
                placeholder="Search by material, slip #, vendor, worker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Date Range Presets */}
            <div className="gi-date-presets-bar">
              <button
                type="button"
                className={`gi-date-preset-btn ${datePreset === 'all' ? 'active' : ''}`}
                onClick={() => handleDatePreset('all')}
              >
                All Time
              </button>
              <button
                type="button"
                className={`gi-date-preset-btn ${datePreset === 'today' ? 'active' : ''}`}
                onClick={() => handleDatePreset('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={`gi-date-preset-btn ${datePreset === '7days' ? 'active' : ''}`}
                onClick={() => handleDatePreset('7days')}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                className={`gi-date-preset-btn ${datePreset === 'month' ? 'active' : ''}`}
                onClick={() => handleDatePreset('month')}
              >
                This Month
              </button>
            </div>

            {/* Custom Date Pickers */}
            <div className="gi-date-range-inputs">
              <div className="gi-date-input-group">
                <span className="gi-date-sublabel">From:</span>
                <Input
                  type="date"
                  className="gi-date-picker"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                />
              </div>
              <div className="gi-date-input-group">
                <span className="gi-date-sublabel">To:</span>
                <Input
                  type="date"
                  className="gi-date-picker"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                />
              </div>
            </div>
          </div>

          {/* Transaction Type Filter Pills */}
          <div className="gi-ledger-pills-row">
            <span className="gi-pills-row-label">Transaction Type:</span>
            <div className="gi-pills-scroll">
              <button
                type="button"
                className={`gi-filter-pill ${typeFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTypeFilter('ALL')}
              >
                All Movements ({unifiedTransactions.length})
              </button>

              <button
                type="button"
                className={`gi-filter-pill inward ${typeFilter === 'INWARD' ? 'active' : ''}`}
                onClick={() => setTypeFilter('INWARD')}
              >
                <ArrowDownLeft size={13} />
                <span>+ Inward (GRN)</span>
              </button>

              <button
                type="button"
                className={`gi-filter-pill outward ${typeFilter === 'OUTWARD' ? 'active' : ''}`}
                onClick={() => setTypeFilter('OUTWARD')}
              >
                <ArrowUpRight size={13} />
                <span>− Outward Issues</span>
              </button>

              <button
                type="button"
                className={`gi-filter-pill return ${typeFilter === 'RETURN' ? 'active' : ''}`}
                onClick={() => setTypeFilter('RETURN')}
              >
                <RotateCcw size={13} />
                <span>↩ Returns</span>
              </button>

              <button
                type="button"
                className={`gi-filter-pill transfer ${typeFilter === 'TRANSFER' ? 'active' : ''}`}
                onClick={() => setTypeFilter('TRANSFER')}
              >
                <ArrowRightLeft size={13} />
                <span>Transfers</span>
              </button>

              <button
                type="button"
                className={`gi-filter-pill adjustment ${typeFilter === 'ADJUSTMENT' ? 'active' : ''}`}
                onClick={() => setTypeFilter('ADJUSTMENT')}
              >
                <RefreshCw size={13} />
                <span>Adjustments</span>
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="gi-table-card">
            <div className="gi-table-wrapper">
              {isLoadingLedger ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                  <div>Loading live ledger records...</div>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="gi-empty-state">
                  <FileText size={40} />
                  <h3>No Transactions Found</h3>
                  <p>
                    {searchQuery || typeFilter !== 'ALL' || startDate || endDate
                      ? 'No records match the current filters. Try resetting the search or date range.'
                      : 'No stock movements recorded yet. Receipts and issues will appear here automatically.'}
                  </p>
                </div>
              ) : (
                <table className="gi-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref Slip #</th>
                      <th>Movement Type</th>
                      <th>Material Item</th>
                      <th>Qty Change</th>
                      <th>Godown / Store</th>
                      <th>Party / Contractor</th>
                      <th>Legal Notes / Remarks</th>
                      <th style={{ textAlign: 'right' }}>Slip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => {
                      const isPositive = tx.type === 'INWARD' || tx.type === 'RETURN' || (tx.type === 'ADJUSTMENT' && tx.rawType?.includes('ADD'));

                      return (
                        <tr key={tx.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {tx.date ? new Date(tx.date).toLocaleDateString() : '—'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-label)' }}>
                              {tx.date ? new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--accent)' }}>{tx.referenceNumber}</strong>
                          </td>
                          <td>
                            <span className={`gi-activity-type-pill ${tx.type.toLowerCase()}`}>
                              {tx.rawType || tx.type}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--text-primary)' }}>{tx.materialName}</strong>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isPositive ? '#059669' : '#dc2626' }}>
                              {isPositive ? `+${tx.quantity}` : `−${tx.quantity}`}
                            </span>{' '}
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>{tx.uom}</span>
                            {tx.balanceAfter !== undefined && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-label)' }}>
                                Bal: {tx.balanceAfter} {tx.uom}
                              </div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {tx.storeName}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{tx.performedBy}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                              {tx.remarks || '—'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="gi-btn-sm"
                              onClick={() => onOpenSlip && onOpenSlip(tx.type, tx.rawData || tx)}
                              title="View & Print Official Slip"
                            >
                              <Printer size={13} />
                              <span>Slip</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODE B: SPECIALIZED INVENTORY REPORTS ── */}
      {viewMode === 'reports' && (
        <div className="gi-ledger-reports-view">
          <div className="gi-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="gi-toolbar-left" style={{ gap: '0.5rem' }}>
              <Select
                className="gi-filter-select"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="store-wise-stock">Store-Wise Stock Balances</option>
                <option value="low-stock">Critical Low-Stock & Reorder Register</option>
                <option value="overdue-borrowed">Outstanding & Overdue Borrowed Tools</option>
                <option value="inward-register">Inward Goods Receipt Register</option>
                <option value="outward-register">Outward Material Issue Register</option>
                <option value="vendor-wise-inward">Vendor-Wise Inward Deliveries</option>
              </Select>

              <button
                type="button"
                className="gi-btn-sm"
                onClick={() => loadSpecializedReport(reportType)}
                disabled={isReportLoading}
              >
                <RefreshCw size={13} className={isReportLoading ? 'spin' : ''} />
                <span>Regenerate</span>
              </button>
            </div>
          </div>

          <div className="gi-table-card">
            <div className="gi-table-wrapper">
              {isReportLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                  <div>Generating inventory report...</div>
                </div>
              ) : !reportData || !reportData.rows || reportData.rows.length === 0 ? (
                <div className="gi-empty-state">
                  <FileText size={40} />
                  <h3>No Report Records</h3>
                  <p>Select a report filter above to load data.</p>
                </div>
              ) : (
                <table className="gi-table">
                  <thead>
                    <tr>
                      {Object.keys(reportData.rows[0])
                        .filter((k) => k !== '_id' && k !== 'id' && typeof reportData.rows[0][k] !== 'object')
                        .map((header) => (
                          <th key={header} style={{ textTransform: 'capitalize' }}>
                            {header.replace(/([A-Z])/g, ' $1')}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((row, idx) => {
                      const keys = Object.keys(row).filter((k) => k !== '_id' && k !== 'id' && typeof row[k] !== 'object');
                      return (
                        <tr key={idx}>
                          {keys.map((k) => (
                            <td key={k}>{row[k] !== undefined && row[k] !== null ? String(row[k]) : '—'}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          HIDDEN PRINT / PDF CONTAINER (Formatted for html2pdf.js export)
         ────────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'none' }}>
        <div ref={pdfPrintRef} className="gi-pdf-document">
          {/* Header */}
          <div className="gi-pdf-header">
            <div>
              <h1 className="gi-pdf-title">REBAROPTIMA</h1>
              <div className="gi-pdf-subtitle">Site Inventory & Material Movement Ledger</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="gi-pdf-meta"><strong>Project:</strong> {projectName}</div>
              <div className="gi-pdf-meta"><strong>Date Generated:</strong> {new Date().toLocaleString()}</div>
              <div className="gi-pdf-meta"><strong>Total Records:</strong> {filteredTransactions.length}</div>
            </div>
          </div>

          {/* Summary Strip */}
          <div className="gi-pdf-summary-grid">
            <div><strong>Inward (GRN):</strong> {summaryKpis.inwardCount}</div>
            <div><strong>Outward Issues:</strong> {summaryKpis.outwardCount}</div>
            <div><strong>Returns & Adjustments:</strong> {summaryKpis.otherCount}</div>
          </div>

          {/* Table */}
          <table className="gi-pdf-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Slip #</th>
                <th>Type</th>
                <th>Material</th>
                <th>Qty</th>
                <th>Store</th>
                <th>Party / Issued To</th>
                <th>Legal Notes / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx, idx) => (
                <tr key={idx}>
                  <td>{tx.date ? new Date(tx.date).toLocaleDateString() : ''}</td>
                  <td>{tx.referenceNumber}</td>
                  <td>{tx.type}</td>
                  <td>{tx.materialName}</td>
                  <td>{tx.quantity} {tx.uom}</td>
                  <td>{tx.storeName}</td>
                  <td>{tx.performedBy}</td>
                  <td>{tx.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signatures */}
          <div className="gi-pdf-signatures">
            <div className="gi-pdf-sign-box">
              <div>Prepared By (Storekeeper)</div>
              <div style={{ fontSize: '10px', marginTop: '4px' }}>
                {currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : 'Store Incharge'}
              </div>
            </div>
            <div className="gi-pdf-sign-box">
              <div>Verified By (Site Engineer)</div>
            </div>
            <div className="gi-pdf-sign-box">
              <div>Authorized By (Project Manager)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
