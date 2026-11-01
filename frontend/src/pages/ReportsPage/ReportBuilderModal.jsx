import React, { useState } from 'react';
import {
  X,
  FileText,
  Eye,
  Download,
  Camera,
  ChevronDown,
  ChevronUp,
  Square,
} from 'lucide-react';
import { Button } from '../../components/ui';

export default function ReportBuilderModal({
  isOpen,
  onClose,
  projects = [],
  activeProjectId,
  onPreview,
  onGeneratePdf,
  loading = false,
}) {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [reportMode, setReportMode] = useState('detailed'); // 'detailed' | 'summary'
  const [preset, setPreset] = useState('7days');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || 'all');
  const [includePhotos, setIncludePhotos] = useState(false);

  // Sections selection
  const [sections, setSections] = useState({
    tasksAndProgress: true,
    issues: true,
    inventory: true,
    grn: true,
    materialIssued: true,
    siteTransfer: true,
    attendance: true,
    payables: true,
  });

  // Accordion open/close state
  const [openSections, setOpenSections] = useState({
    operational: true,
    inventory: true,
    manpower: true,
  });

  const toggleSectionGroup = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePresetChange = (p) => {
    setPreset(p);
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start = end;

    if (p === 'today') {
      start = end;
    } else if (p === '7days') {
      start = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    } else if (p === '15days') {
      start = new Date(now.getTime() - 15 * 86400000).toISOString().split('T')[0];
    }
    setStartDate(start);
    setEndDate(end);
  };

  const toggleSection = (key) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllSections = (val) => {
    setSections({
      tasksAndProgress: val,
      issues: val,
      inventory: val,
      grn: val,
      materialIssued: val,
      siteTransfer: val,
      attendance: val,
      payables: val,
    });
  };

  const getPayload = () => ({
    reportMode,
    preset,
    startDate,
    endDate,
    sections,
    filters: {
      projectId: selectedProjectId,
    },
    includePhotos,
  });

  const selectedCount = Object.values(sections).filter(Boolean).length;

  return (
    <div className="rep-modal-overlay">
      <div className="rep-modal-dialog">
        {/* Modal Header */}
        <div className="rep-modal-header">
          <div className="rep-modal-header-left">
            <div className="rep-modal-icon-badge">
              <FileText size={20} />
            </div>
            <div>
              <div className="rep-modal-title">Download Operational Progress Report</div>
              <div className="rep-modal-subtitle">
                Configure duration, modules, and export level for your project
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rep-modal-close-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="rep-modal-body">
          {/* 1. Report Mode (Detailed vs Summary) */}
          <div className="rep-form-group">
            <label className="rep-form-label">Report Format</label>
            <div className="rep-mode-grid">
              <div
                className={`rep-mode-card ${reportMode === 'detailed' ? 'active' : ''}`}
                onClick={() => setReportMode('detailed')}
              >
                <div className="rep-radio-dot">
                  {reportMode === 'detailed' && <div className="rep-radio-dot-inner" />}
                </div>
                <div>
                  <div className="rep-mode-title">Detailed Report</div>
                  <div className="rep-mode-desc">
                    Individual records, daily transaction tables, worker muster, and remarks
                  </div>
                </div>
              </div>

              <div
                className={`rep-mode-card ${reportMode === 'summary' ? 'active' : ''}`}
                onClick={() => setReportMode('summary')}
              >
                <div className="rep-radio-dot">
                  {reportMode === 'summary' && <div className="rep-radio-dot-inner" />}
                </div>
                <div>
                  <div className="rep-mode-title">Summary Report</div>
                  <div className="rep-mode-desc">
                    High-level totals, progress %, stock balances, and executive KPI scorecards
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Duration Selection */}
          <div className="rep-form-group">
            <label className="rep-form-label">Duration</label>
            <div className="rep-presets-grid">
              {[
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: '15days', label: '15 Days' },
                { id: 'custom', label: 'Specific Date' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handlePresetChange(opt.id)}
                  className={`rep-preset-btn ${preset === opt.id ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="rep-form-row">
              <div className="rep-form-group">
                <label className="rep-form-label">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPreset('custom');
                  }}
                  className="rep-input"
                />
              </div>
              <div className="rep-form-group">
                <label className="rep-form-label">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPreset('custom');
                  }}
                  className="rep-input"
                />
              </div>
            </div>
          </div>

          {/* 3. Project Filter */}
          <div className="rep-form-group">
            <label className="rep-form-label">Project Scope</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rep-select"
            >
              <option value="all">All Projects (Corporate Overview)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.code ? `(${p.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Include Photos Toggle */}
          <div className="rep-toggle-box">
            <div className="rep-toggle-left">
              <Camera size={18} color="var(--text-secondary)" />
              <div>
                <div className="rep-toggle-title">Include Photos</div>
                <div className="rep-toggle-desc">
                  Embed incident attachments and photographic site evidence (max 25 photos)
                </div>
              </div>
            </div>
            <label className="rep-switch">
              <input
                type="checkbox"
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
              />
              <span className="rep-slider"></span>
            </label>
          </div>

          {/* 5. Configurable Report Sections */}
          <div className="rep-form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="rep-form-label" style={{ margin: 0 }}>
                Select Report Sections ({selectedCount} of 8 selected)
              </label>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                <button
                  type="button"
                  onClick={() => selectAllSections(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Select All
                </button>
                <span style={{ color: 'var(--text-label)' }}>|</span>
                <button
                  type="button"
                  onClick={() => selectAllSections(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Group 1: Execution & Progress */}
            <div className="rep-accordion-group">
              <button
                type="button"
                onClick={() => toggleSectionGroup('operational')}
                className="rep-accordion-header"
              >
                <span>Site Execution & Quality</span>
                {openSections.operational ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {openSections.operational && (
                <div className="rep-accordion-content">
                  <label className="rep-checkbox-row">
                    <input
                      type="checkbox"
                      checked={sections.tasksAndProgress}
                      onChange={() => toggleSection('tasksAndProgress')}
                      className="rep-checkbox"
                    />
                    <span>Task & CPM Progress (Schedule milestones, % progress, dates, workers)</span>
                  </label>
                  <label className="rep-checkbox-row">
                    <input
                      type="checkbox"
                      checked={sections.issues}
                      onChange={() => toggleSection('issues')}
                      className="rep-checkbox"
                    />
                    <span>Issues & Incidents (Missing, damaged, theft, investigation status)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Group 2: Materials & Inventory */}
            <div className="rep-accordion-group">
              <button
                type="button"
                onClick={() => toggleSectionGroup('inventory')}
                className="rep-accordion-header"
              >
                <span>Materials & Warehouse</span>
                {openSections.inventory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {openSections.inventory && (
                <div className="rep-accordion-content">
                  <label className="rep-checkbox-row">
                    <input
                      type="checkbox"
                      checked={sections.inventory}
                      onChange={() => toggleSection('inventory')}
                      className="rep-checkbox"
                    />
                    <span>Inventory Stock Balances (Active stock, threshold alerts)</span>
                  </label>
                  <label className="rep-checkbox-row">
                    <input
                      type="checkbox"
                      checked={sections.grn}
                      onChange={() => toggleSection('grn')}
                      className="rep-checkbox"
                    />
                    <span>GRN (Goods Receipt Notes & Inward vendor challans)</span>
                  </label>
                  <label className="rep-checkbox-row">
                    <input
                      type="checkbox"
                      checked={sections.materialIssued}
                      onChange={() => toggleSection('materialIssued')}
                      className="rep-checkbox"
                    />
                    <span>Material Issued (Outward issues & consumable tracking)</span>
                  </label>
                  <label className="rep-checkbox-row">
                    <input
                      type="checkbox"
                      checked={sections.siteTransfer}
                      onChange={() => toggleSection('siteTransfer')}
                      className="rep-checkbox"
                    />
                    <span>Site & Store Transfers (Inter-store dispatch log)</span>
                  </label>
                  <div style={{ paddingTop: '6px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="rep-disabled-row">
                      <Square size={13} />
                      <span>Indent Requisitions (Requires Procurement Module)</span>
                    </div>
                    <div className="rep-disabled-row">
                      <Square size={13} />
                      <span>Purchase Orders (Requires Procurement Module)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Group 3: Manpower & Payables */}
            <div className="rep-accordion-group">
              <button
                type="button"
                onClick={() => toggleSectionGroup('manpower')}
                className="rep-accordion-header"
              >
                <span>Manpower & Payables</span>
                {openSections.manpower ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {openSections.manpower && (
                <div className="rep-accordion-content">
                  <label className="rep-checkbox-row">
                    <input
                      type="checkbox"
                      checked={sections.attendance}
                      onChange={() => toggleSection('attendance')}
                      className="rep-checkbox"
                    />
                    <span>Attendance (Company Labour, Contractor Labour, Workforce Gangs)</span>
                  </label>
                  <label className="rep-checkbox-row">
                    <input
                      type="checkbox"
                      checked={sections.payables}
                      onChange={() => toggleSection('payables')}
                      className="rep-checkbox"
                    />
                    <span>Payables & Expenses (Petty cash debits, credits, and site vouchers)</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="rep-modal-footer">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>

          <div className="rep-modal-footer-actions">
            <Button
              variant="secondary"
              onClick={() => onPreview(getPayload())}
              disabled={loading || selectedCount === 0}
            >
              <Eye size={16} />
              Preview Report
            </Button>

            <Button
              variant="primary"
              onClick={() => onGeneratePdf(getPayload())}
              disabled={loading || selectedCount === 0}
            >
              <Download size={16} />
              {loading ? 'Generating...' : 'Download PDF Report'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
