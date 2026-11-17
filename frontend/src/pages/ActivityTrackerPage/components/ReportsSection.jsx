import React, { useState, useEffect } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { activityTrackerApi } from '../../../utils/activityTrackerApi';

export default function ReportsSection({
  blockId,
  floors = [],
}) {
  const [preset, setPreset] = useState('dpr'); // 'dpr' | 'wpr' | 'mpr' | 'ypr' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Compute dates when preset changes
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'dpr') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'wpr') {
      const past = new Date(Date.now() - 7 * 86400000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'mpr') {
      const past = new Date(Date.now() - 30 * 86400000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'ypr') {
      const past = new Date(Date.now() - 365 * 86400000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  }, [preset]);

  // Trigger report fetch when dates change
  useEffect(() => {
    if (!blockId || !startDate || !endDate) return;
    loadReportPreview();
  }, [blockId, startDate, endDate, selectedFloorId]);

  const loadReportPreview = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        blockId,
        startDate,
        endDate,
      };
      if (selectedFloorId !== 'ALL') params.floorId = selectedFloorId;
      const res = await activityTrackerApi.previewReport(params);
      setReportData(res);
    } catch (err) {
      setError(err.message || 'Failed to generate report preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!blockId || !startDate || !endDate) return;
    setDownloadingPdf(true);
    try {
      const params = { blockId, startDate, endDate };
      if (selectedFloorId !== 'ALL') params.floorId = selectedFloorId;
      await activityTrackerApi.downloadReportPdf(params);
    } catch (err) {
      alert(`PDF download failed: ${err.message}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!blockId || !startDate || !endDate) return;
    setDownloadingExcel(true);
    try {
      const params = { blockId, startDate, endDate };
      if (selectedFloorId !== 'ALL') params.floorId = selectedFloorId;
      await activityTrackerApi.downloadReportExcel(params);
    } catch (err) {
      alert(`Excel download failed: ${err.message}`);
    } finally {
      setDownloadingExcel(false);
    }
  };

  const getDeltaBadgeClass = (delta) => {
    if (delta > 0) return '#10b981';
    if (delta === 0) return 'var(--text-secondary)';
    return '#ef4444';
  };

  return (
    <div className="ro-reports-grid">
      {/* Sidebar Configuration */}
      <div className="ro-report-sidebar">
        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
          Report Frequency Presets
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'dpr', label: 'DPR — Daily Progress' },
            { id: 'wpr', label: 'WPR — Weekly Progress' },
            { id: 'mpr', label: 'MPR — Monthly Progress' },
            { id: 'ypr', label: 'YPR — Yearly Progress' },
            { id: 'custom', label: 'Custom Date Range' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ro-report-preset-btn ${preset === item.id ? 'active' : ''}`}
              onClick={() => setPreset(item.id)}
            >
              <span>{item.label}</span>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--card-border)', margin: '4px 0' }} />

        {/* Date Controls */}
        <div className="ro-form-group">
          <label className="ro-form-label">Period Start Date *</label>
          <input
            type="date"
            className="ro-form-input"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPreset('custom');
            }}
          />
        </div>

        <div className="ro-form-group">
          <label className="ro-form-label">Period End Date *</label>
          <input
            type="date"
            className="ro-form-input"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPreset('custom');
            }}
          />
        </div>

        {floors.length > 0 && (
          <div className="ro-form-group">
            <label className="ro-form-label">Filter by Floor / Level</label>
            <select
              className="ro-act-select"
              value={selectedFloorId}
              onChange={(e) => setSelectedFloorId(e.target.value)}
            >
              <option value="ALL">All Floors / Levels</option>
              {floors.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Export Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <button
            type="button"
            className="ro-act-btn ro-act-btn-primary"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || !reportData}
          >
            <FileText size={16} />
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}
          </button>

          <button
            type="button"
            className="ro-act-btn ro-act-btn-secondary"
            onClick={handleDownloadExcel}
            disabled={downloadingExcel || !reportData}
          >
            <FileSpreadsheet size={16} />
            {downloadingExcel ? 'Exporting...' : 'Export Excel Spreadsheet'}
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="ro-report-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
              {reportData?.reportType || 'Progress Report'} Preview
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Period: {startDate} to {endDate} • Formula: &Delta;P = P_end &minus; P_start
            </div>
          </div>

          {reportData?.summary && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Period Progress</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>
                  +{reportData.summary.periodProgress}%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Current Block Progress</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent)' }}>
                  {reportData.summary.currentBlockProgress}%
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Calculating delta progress across period...
          </div>
        ) : error ? (
          <div style={{ padding: '24px', color: '#ef4444', textAlign: 'center' }}>
            {error}
          </div>
        ) : !reportData || !reportData.items || reportData.items.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <FileText size={40} style={{ opacity: 0.35, marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
              No activities found in this block for the selected period
            </div>
          </div>
        ) : (
          <div className="ro-act-table-wrap">
            <table className="ro-act-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Activity</th>
                  <th style={{ width: '10%' }}>Level</th>
                  <th style={{ width: '15%' }}>Floor / Level</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Start Prog</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>End Prog</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Period Delta (&Delta;P)</th>
                  <th style={{ width: '9%', textAlign: 'center' }}>Days</th>
                </tr>
              </thead>
              <tbody>
                {reportData.items.map((item) => (
                  <tr key={item.activityId}>
                    <td>
                      <div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                          {item.activityName}
                        </strong>
                        {item.activityCode && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                            [{item.activityCode}]
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className="ro-act-parent-badge"
                        style={{
                          backgroundColor:
                            item.level === 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                          color: item.level === 1 ? '#10b981' : '#0284c7',
                        }}
                      >
                        {item.level === 1 ? 'L1' : 'L2'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                        {item.floorName || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {item.startProgress}%
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {item.endProgress}%
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontSize: '13px',
                        fontWeight: '800',
                        color: getDeltaBadgeClass(item.periodProgress),
                      }}
                    >
                      {item.periodProgress > 0 ? `+${item.periodProgress}%` : `${item.periodProgress}%`}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {item.daysWorked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

