import React, { useState, useEffect } from 'react';
import { bbsApi } from '../../bbsApi';
import { Scale, Box, Layers, Hash, Download, FileText, Scissors, ArrowLeft, RefreshCw } from 'lucide-react';
import { exportBbsToPrintPdf } from './pdfExport';
import { exportBbsToExcelCsv } from './excelExport';
import { pushBbsToCuttingOptimizer } from './optimizerBridge';

export default function ProjectMtoView({
  project,
  onClose,
  showToast,
  onNavigate
}) {
  const [loading, setLoading] = useState(true);
  const [mtoData, setMtoData] = useState(null);

  useEffect(() => {
    if (project?._id || project?.id) {
      loadMto();
    }
  }, [project]);

  const loadMto = async () => {
    setLoading(true);
    try {
      const projId = project?._id || project?.id;
      const data = await bbsApi.getProjectMTO(projId);
      setMtoData(data);
    } catch (err) {
      console.error('Failed to load project MTO:', err);
      if (showToast) showToast(err.message || 'Error loading Project MTO', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!mtoData || !mtoData.mto) return;
    const headers = ['Diameter (mm)', 'Total Pieces', 'Total Cut Length (m)', 'Total Weight (kg)', 'Tonnage (MT)'];
    const rows = mtoData.mto.map(r => [
      r.diameter,
      r.totalPieces,
      r.totalLengthM,
      r.totalWeightKg,
      r.totalWeightMT
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Project_MTO_${project?.name || 'Project'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePushAllToOptimizer = () => {
    if (!mtoData || !mtoData.mto || mtoData.mto.length === 0) return;
    // Synthesize items for optimizer
    const items = mtoData.mto.map((row, idx) => ({
      barMark: String(idx + 1).padStart(2, '0'),
      description: `Consolidated Ø${row.diameter} mm Rebar`,
      diameter: row.diameter,
      quantity: row.totalPieces,
      cut_length: row.totalPieces > 0 ? (row.totalLengthM * 1000) / row.totalPieces : 0
    }));

    pushBbsToCuttingOptimizer({
      rebarItems: items,
      project,
      onNavigate
    });
  };

  return (
    <div className="bbs-workspace-container">
      <div className="bbs-workspace-header">
        <div className="bbs-workspace-header-left">
          <button className="bbs-btn bbs-btn-secondary bbs-btn-sm" onClick={onClose}>
            <ArrowLeft size={16} />
            <span>Back to Members</span>
          </button>
          <div>
            <h2 className="bbs-workspace-h2">Project Material Take-Off (MTO)</h2>
            <span className="bbs-breadcrumb-part">{project?.name} • Consolidated Reinforcement Totals</span>
          </div>
        </div>

        <div className="bbs-workspace-header-actions">
          <button className="bbs-btn bbs-btn-secondary bbs-btn-sm" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="bbs-btn bbs-btn-primary" onClick={handlePushAllToOptimizer}>
            <Scissors size={15} />
            <span>Optimize Entire Project BBS</span>
          </button>
        </div>
      </div>

      <div className="bbs-workspace-body">
        {loading ? (
          <div className="bbs-schedule-empty">
            <RefreshCw size={32} className="bbs-spin" />
            <p>Aggregating project-wide reinforcement schedules...</p>
          </div>
        ) : !mtoData || mtoData.mto.length === 0 ? (
          <div className="bbs-schedule-empty">
            <Scale size={36} className="bbs-empty-icon" />
            <h4>No Calculated Member Schedules Yet</h4>
            <p>Open individual structural members and click "Save Schedule" to build the Project MTO.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="bbs-summary-cards-grid">
              <div className="bbs-summary-card">
                <div className="bbs-summary-card-icon weight"><Scale size={20} /></div>
                <div className="bbs-summary-card-data">
                  <div className="bbs-summary-card-label">Total Steel Tonnage</div>
                  <div className="bbs-summary-card-val">
                    {mtoData.summary.totalTonnageMT} <span className="bbs-unit">MT</span>
                  </div>
                  <div className="bbs-summary-card-sub">({mtoData.summary.totalWeightKg.toLocaleString()} kg)</div>
                </div>
              </div>

              <div className="bbs-summary-card">
                <div className="bbs-summary-card-icon count"><Hash size={20} /></div>
                <div className="bbs-summary-card-data">
                  <div className="bbs-summary-card-label">Total Rebar Pieces</div>
                  <div className="bbs-summary-card-val">{mtoData.summary.totalPieces.toLocaleString()} <span className="bbs-unit">pcs</span></div>
                  <div className="bbs-summary-card-sub">{mtoData.summary.totalLengthM.toLocaleString()} meters linear steel</div>
                </div>
              </div>

              <div className="bbs-summary-card">
                <div className="bbs-summary-card-icon volume"><Layers size={20} /></div>
                <div className="bbs-summary-card-data">
                  <div className="bbs-summary-card-label">Calculated Members</div>
                  <div className="bbs-summary-card-val">
                    {mtoData.summary.calculatedMembers} / {mtoData.summary.totalMembers}
                  </div>
                  <div className="bbs-summary-card-sub">
                    {mtoData.summary.totalMembers > 0
                      ? `${Math.round((mtoData.summary.calculatedMembers / mtoData.summary.totalMembers) * 100)}% Progress`
                      : '0%'}
                  </div>
                </div>
              </div>
            </div>

            {/* MTO Diameter Breakdown Table */}
            <div className="bbs-schedule-table-card">
              <div className="bbs-schedule-header">
                <div>
                  <h3 className="bbs-schedule-h3">Diameter-wise Steel Take-Off</h3>
                  <p className="bbs-schedule-sub">Consolidated bill of quantities aggregated across all completed structural members.</p>
                </div>
              </div>

              <div className="bbs-table-responsive">
                <table className="bbs-data-table bbs-bbs-table">
                  <thead>
                    <tr>
                      <th>Bar Diameter</th>
                      <th style={{ textAlign: 'right' }}>Total Pieces</th>
                      <th style={{ textAlign: 'right' }}>Total Cut Length (m)</th>
                      <th style={{ textAlign: 'right' }}>Unit Weight (kg/m)</th>
                      <th style={{ textAlign: 'right' }}>Total Weight (kg)</th>
                      <th style={{ textAlign: 'right' }}>Total Tonnage (MT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mtoData.mto.map(row => {
                      const unitW = Math.pow(row.diameter, 2) / 162.28;
                      return (
                        <tr key={row.diameter}>
                          <td><strong>Ø{row.diameter} mm</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.totalPieces.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{row.totalLengthM.toLocaleString()} m</td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>{unitW.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.totalWeightKg.toLocaleString()} kg</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>{row.totalWeightMT} MT</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bbs-table-total-row">
                      <td><strong>PROJECT TOTALS:</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{mtoData.summary.totalPieces.toLocaleString()} pcs</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{mtoData.summary.totalLengthM.toLocaleString()} m</td>
                      <td></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{mtoData.summary.totalWeightKg.toLocaleString()} kg</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{mtoData.summary.totalTonnageMT} MT</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

