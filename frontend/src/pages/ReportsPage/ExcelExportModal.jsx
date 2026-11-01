import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { Button } from '../../components/ui';

export const EXCEL_REPORT_TYPES = [
  { id: 'grn', label: 'Goods Receipt Note (GRN) Extract', desc: 'Inward challans, received quantities, vendor details, and unit values' },
  { id: 'material_issued', label: 'Material Consumption (Outward Issues)', desc: 'Outward vouchers, issued materials, receiving agencies, and purposes' },
  { id: 'stock_inventory', label: 'Current Inventory & Stock Balance', desc: 'Active materials, balances, low stock thresholds, and categories' },
  { id: 'labour_attendance', label: 'Labour Attendance Extract', desc: 'Named company and contractor labour daily muster, status, and OT' },
  { id: 'contractor_workforce', label: 'Vendor / Workforce Attendance Extract', desc: 'Contractor gang headcounts, present/half-day totals, and person-days' },
  { id: 'petty_cash_expenses', label: 'Petty Cash & Site Expenses Extract', desc: 'Expense debit/credit ledgers, categories, paid-to parties, and bills' },
  { id: 'task_progress', label: 'Tasks and Schedule Progress Extract', desc: 'WBS schedule milestones, % completion, start/finish, and assigned leads' },
  { id: 'site_incidents', label: 'Site Incidents and Issues Extract', desc: 'Missing, damaged, and loss records with investigation status' },
  { id: 'site_transfers', label: 'Store & Site Transfers Extract', desc: 'Inter-store transfer log, source/destination, and authorized handlers' },
];

export default function ExcelExportModal({
  isOpen,
  onClose,
  projects = [],
  activeProjectId,
  onExport,
  loading = false,
}) {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [extractType, setExtractType] = useState('grn');
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || 'all');

  const handleExport = () => {
    onExport({
      extractType,
      projectId: selectedProjectId,
      startDate,
      endDate,
    });
  };

  const selectedTypeObj = EXCEL_REPORT_TYPES.find(t => t.id === extractType);

  return (
    <div className="rep-modal-overlay">
      <div className="rep-modal-dialog rep-modal-dialog--sm">
        {/* Header */}
        <div className="rep-modal-header">
          <div className="rep-modal-header-left">
            <div className="rep-modal-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="rep-modal-title">Export to Excel Workbook</div>
              <div className="rep-modal-subtitle">
                Download structured .xlsx datasets for spreadsheets & audits
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rep-modal-close-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="rep-modal-body">
          {/* 1. Report Type Dropdown */}
          <div className="rep-form-group">
            <label className="rep-form-label">Select Report Type</label>
            <select
              value={extractType}
              onChange={(e) => setExtractType(e.target.value)}
              className="rep-select"
            >
              {EXCEL_REPORT_TYPES.map(type => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
            {selectedTypeObj && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {selectedTypeObj.desc}
              </div>
            )}
          </div>

          {/* 2. Date Range */}
          <div className="rep-form-group">
            <label className="rep-form-label">Reporting Date Range</label>
            <div className="rep-form-row">
              <div className="rep-form-group">
                <label style={{ fontSize: '11px', color: 'var(--text-label)' }}>From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rep-input"
                />
              </div>
              <div className="rep-form-group">
                <label style={{ fontSize: '11px', color: 'var(--text-label)' }}>To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rep-input"
                />
              </div>
            </div>
          </div>

          {/* 3. Project Scope */}
          <div className="rep-form-group">
            <label className="rep-form-label">Project Scope</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rep-select"
            >
              <option value="all">All Projects (Company Aggregate)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.code ? `(${p.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="rep-modal-footer">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={handleExport}
            disabled={loading}
          >
            <Download size={16} />
            {loading ? 'Exporting...' : 'Export Excel Workbook'}
          </Button>
        </div>
      </div>
    </div>
  );
}
