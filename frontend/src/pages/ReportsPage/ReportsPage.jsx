import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  FileText,
  FileSpreadsheet,
  Calendar,
  Layers,
  Clock,
  AlertTriangle,
  Package,
  Users,
  Wallet,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/ui';
import { useActiveProject } from '../../hooks/useActiveProject';
import { reportsApi } from '../../utils/api';
import ReportBuilderModal from './ReportBuilderModal';
import ExcelExportModal, { EXCEL_REPORT_TYPES } from './ExcelExportModal';
import ReportPreviewModal from './ReportPreviewModal';
import './ReportsPage.css';

export default function ReportsPage() {
  const { projectId, selectedProject } = useActiveProject();

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configOptions, setConfigOptions] = useState({ projects: [], categories: [], supportedModules: {} });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isExcelOpen, setIsExcelOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Active generation state
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setError('');
    try {
      const data = await reportsApi.getConfigOptions();
      setConfigOptions(data || { projects: [], categories: [], supportedModules: {} });
    } catch (err) {
      setError(err?.message || 'Failed to initialize report configurations');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Handle Live Preview Request
  const handlePreview = async (config) => {
    setGenerating(true);
    setError('');
    setCurrentConfig(config);
    try {
      const data = await reportsApi.preview(config);
      setPreviewData(data);
      setIsPreviewOpen(true);
      setIsBuilderOpen(false);
    } catch (err) {
      setError(err?.message || 'Failed to aggregate preview data');
    } finally {
      setGenerating(false);
    }
  };

  // Handle PDF Generation
  const handleGeneratePdf = async (config) => {
    setGenerating(true);
    setError('');
    try {
      await reportsApi.downloadPdf(config);
      setSuccessMsg('PDF Report downloaded successfully.');
      setIsBuilderOpen(false);
      setIsPreviewOpen(false);
    } catch (err) {
      setError(err?.message || 'Failed to download PDF report');
    } finally {
      setGenerating(false);
    }
  };

  // Handle Excel Export
  const handleExportExcel = async (config) => {
    setGenerating(true);
    setError('');
    try {
      await reportsApi.downloadExcel(config);
      setSuccessMsg('Excel Workbook exported successfully.');
      setIsExcelOpen(false);
    } catch (err) {
      setError(err?.message || 'Failed to export Excel workbook');
    } finally {
      setGenerating(false);
    }
  };

  // Quick 1-click presets
  const handleQuickReport = (mode, preset) => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start = end;

    if (preset === 'today') {
      start = end;
    } else if (preset === '7days') {
      start = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    } else if (preset === '15days') {
      start = new Date(now.getTime() - 15 * 86400000).toISOString().split('T')[0];
    }

    const payload = {
      reportMode: mode,
      preset,
      startDate: start,
      endDate: end,
      sections: {
        tasksAndProgress: true,
        issues: true,
        inventory: true,
        grn: true,
        materialIssued: true,
        siteTransfer: true,
        attendance: true,
        payables: true,
      },
      filters: {
        projectId: projectId || 'all',
      },
      includePhotos: false,
    };

    handlePreview(payload);
  };

  return (
    <div className="rep-page">
      {/* Header */}
      <div className="rep-header">
        <div className="rep-title-group">
          <div className="rep-title-row">
            <h1 className="rep-title">Centralized Reports</h1>
            <span className="rep-project-badge">
              {selectedProject?.name || 'All Projects'}
            </span>
          </div>
          <p className="rep-subtitle">
            Generate, preview, and download comprehensive operational PDF reports or export Excel datasets
          </p>
        </div>

        <div className="rep-header-actions">
          <Button
            variant="secondary"
            onClick={() => setIsExcelOpen(true)}
          >
            <FileSpreadsheet size={16} />
            Export Excel
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsBuilderOpen(true)}
          >
            <FileText size={16} />
            Create PDF Report
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rep-banner rep-banner--error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="rep-banner-close">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="rep-banner rep-banner--ok">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="rep-banner-close">✕</button>
        </div>
      )}

      {/* Section 1: Quick Launch Generators */}
      <div className="rep-section-header">
        <div className="rep-section-title">
          <Clock size={14} /> Instant Report Generators
        </div>
      </div>

      <div className="rep-grid-3">
        {/* Card 1: Today DPR */}
        <div className="rep-instant-card">
          <div className="rep-card-top">
            <div className="rep-card-icon rep-icon--blue">
              <Clock size={20} />
            </div>
            <span className="rep-card-tag">TODAY'S OPERATIONS</span>
          </div>
          <h3 className="rep-card-title">Daily Progress Report (DPR)</h3>
          <p className="rep-card-desc">
            Complete daily record of active schedule tasks, incidents, inward material receipts, and worker attendance.
          </p>
          <div className="rep-card-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickReport('detailed', 'today')}
              disabled={generating}
            >
              Detailed DPR
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleQuickReport('summary', 'today')}
              disabled={generating}
            >
              Summary DPR
            </Button>
          </div>
        </div>

        {/* Card 2: 7 Days */}
        <div className="rep-instant-card">
          <div className="rep-card-top">
            <div className="rep-card-icon rep-icon--indigo">
              <Calendar size={20} />
            </div>
            <span className="rep-card-tag">LAST 7 DAYS</span>
          </div>
          <h3 className="rep-card-title">Weekly Progress Review</h3>
          <p className="rep-card-desc">
            7-day rolling view of milestone completions, warehouse outward consumption, vendor GRNs, and muster person-days.
          </p>
          <div className="rep-card-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickReport('detailed', '7days')}
              disabled={generating}
            >
              Detailed 7-Day
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleQuickReport('summary', '7days')}
              disabled={generating}
            >
              Summary 7-Day
            </Button>
          </div>
        </div>

        {/* Card 3: 15 Days Executive */}
        <div className="rep-instant-card">
          <div className="rep-card-top">
            <div className="rep-card-icon rep-icon--emerald">
              <TrendingUp size={20} />
            </div>
            <span className="rep-card-tag">LAST 15 DAYS</span>
          </div>
          <h3 className="rep-card-title">Fortnightly Executive Report</h3>
          <p className="rep-card-desc">
            Executive overview of site petty cash burn, critical path task schedule delays, and current warehouse stock balances.
          </p>
          <div className="rep-card-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickReport('detailed', '15days')}
              disabled={generating}
            >
              Detailed 15-Day
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleQuickReport('summary', '15days')}
              disabled={generating}
            >
              Executive Summary
            </Button>
          </div>
        </div>
      </div>

      {/* Section 2: Connected Operational Reporting Engines */}
      <div className="rep-section-header">
        <div className="rep-section-title">
          <Layers size={14} /> Connected Operational Reporting Engines
        </div>
      </div>

      <div className="rep-grid-4">
        {[
          {
            title: 'Tasks & CPM Schedule',
            desc: 'WBS activities, milestone progress, delay audit, and allocated leads',
            icon: <Clock size={16} color="#2563eb" />,
            status: 'Active',
          },
          {
            title: 'Site Incidents & Issues',
            desc: 'Missing materials, damage reports, investigation logs, and photos',
            icon: <AlertTriangle size={16} color="#f59e0b" />,
            status: 'Active',
          },
          {
            title: 'Inventory Stock Balances',
            desc: 'Live warehouse stock balances, unit thresholds, and reorder alerts',
            icon: <Package size={16} color="#6366f1" />,
            status: 'Active',
          },
          {
            title: 'GRN (Material Inward)',
            desc: 'Vendor invoices, delivery challans, accepted quantities, and damage',
            icon: <Layers size={16} color="#10b981" />,
            status: 'Active',
          },
          {
            title: 'Material Consumption',
            desc: 'Outward issue logs, subcontractor agencies, and returnable tools',
            icon: <Package size={16} color="#06b6d4" />,
            status: 'Active',
          },
          {
            title: 'Store & Site Transfers',
            desc: 'Inter-store transfers, dispatch logs, and transit confirmations',
            icon: <RefreshCw size={16} color="#8b5cf6" />,
            status: 'Active',
          },
          {
            title: 'Manpower & Attendance',
            desc: 'Company labour, contractor labour, and workforce gang person-days',
            icon: <Users size={16} color="#14b8a6" />,
            status: 'Active',
          },
          {
            title: 'Payables & Petty Cash',
            desc: 'Site expenses, cash vouchers, supplier payments, and debit ledgers',
            icon: <Wallet size={16} color="#f43f5e" />,
            status: 'Active',
          },
        ].map((engine, idx) => (
          <div key={idx} className="rep-engine-card">
            <div className="rep-engine-icon-wrap">
              {engine.icon}
            </div>
            <div className="rep-engine-info">
              <div className="rep-engine-top">
                <div className="rep-engine-title">{engine.title}</div>
                <span className="rep-engine-status">{engine.status}</span>
              </div>
              <div className="rep-engine-desc">{engine.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Section 3: Available Excel Extracts */}
      <div className="rep-extract-box">
        <div className="rep-extract-box-header">
          <div>
            <div className="rep-extract-box-title">
              <FileSpreadsheet size={18} color="#10b981" />
              Available Excel Data Workbooks (.xlsx)
            </div>
            <div className="rep-extract-box-subtitle">
              Export raw database extracts with auto-frozen headers, column auto-fit, and calculated totals
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsExcelOpen(true)}
          >
            Open Export Dialog
          </Button>
        </div>

        <div className="rep-extract-grid">
          {EXCEL_REPORT_TYPES.map(type => (
            <div
              key={type.id}
              onClick={() => setIsExcelOpen(true)}
              className="rep-extract-card"
            >
              <div>
                <div className="rep-extract-name">{type.label}</div>
                <div className="rep-extract-desc">{type.desc}</div>
              </div>
              <ArrowRight size={14} className="rep-extract-arrow" />
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <ReportBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        projects={configOptions.projects}
        activeProjectId={projectId}
        onPreview={handlePreview}
        onGeneratePdf={handleGeneratePdf}
        loading={generating}
      />

      <ExcelExportModal
        isOpen={isExcelOpen}
        onClose={() => setIsExcelOpen(false)}
        projects={configOptions.projects}
        activeProjectId={projectId}
        onExport={handleExportExcel}
        loading={generating}
      />

      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        data={previewData}
        onDownloadPdf={() => currentConfig && handleGeneratePdf(currentConfig)}
        downloading={generating}
      />
    </div>
  );
}
