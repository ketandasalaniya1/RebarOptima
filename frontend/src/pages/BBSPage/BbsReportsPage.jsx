import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ChevronLeft, FileText, Download, Scissors, AlertCircle } from 'lucide-react';
import { bbsApi } from '../../utils/api';
import { setView } from '../../store/slices/routingSlice';
import { setMTO, setLoading, setError } from '../../store/slices/bbsSlice';
import './BbsReportsPage.css';

export default function BbsReportsPage() {
  const dispatch = useDispatch();
  const { activeProjectId, activeProject, mto, loading } = useSelector(s => s.bbs);

  useEffect(() => {
    if (activeProjectId) {
      loadMTO();
    }
  }, [activeProjectId]);

  const loadMTO = async () => {
    try {
      dispatch(setLoading(true));
      const data = await bbsApi.getMTO(activeProjectId);
      dispatch(setMTO(data));
    } catch (err) {
      dispatch(setError(err.message));
      dispatch(setLoading(false));
    }
  };

  const handleExportPDF = () => {
    window.print(); // Simple fallback for now
  };

  const handleExportExcel = () => {
    if (!mto) return;
    
    // Simple CSV generator
    const headers = ['Diameter (mm)', 'Total Pieces', 'Total Cut Length (m)', 'Total Weight (kg)'];
    const rows = mto.mto.map(r => [
      r.diameter,
      r.barCount,
      (r.totalLength / 1000).toFixed(2),
      r.totalWeight.toFixed(2)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MTO_${activeProject?.name || 'Project'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePushToOptimizer = async () => {
    try {
      dispatch(setLoading(true));
      const rebars = await bbsApi.getProjectRebars(activeProjectId);
      
      const requiredParts = rebars.map((r, index) => ({
        id: index + 1,
        diameter: String(r.diameter),
        length: String(r.cut_length),
        quantity: String(r.bar_count),
        label: r.description || `Shape ${r.shape_id}`
      }));
      
      const payload = {
        batchName: `Optima Batch - ${activeProject?.name || 'Project'}`,
        requiredParts,
        inputStock: []
      };
      
      sessionStorage.setItem('bbs_optimizer_payload', JSON.stringify(payload));
      dispatch(setView('inputs'));
    } catch (err) {
      dispatch(setError(err.message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  if (!activeProjectId) {
    return (
      <div className="bbs-reports-page">
        <div className="bbs-mto-empty">
          <h2>No Project Selected</h2>
          <p>Please select a project from the Configurator first.</p>
          <button className="bbs-action-btn primary" onClick={() => dispatch(setView('bbs-projects'))}>
            Go to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bbs-reports-page">
      <div className="bbs-reports-header">
        <div className="bbs-reports-title">
          <button className="bbs-reports-back-btn" onClick={() => dispatch(setView('bbs-dashboard'))}>
            <ChevronLeft size={16} /> Back to Matrix
          </button>
          <h1>Material Take-Off (MTO)</h1>
          <p>Consolidated quantities for {activeProject?.name}</p>
        </div>
        <div className="bbs-reports-toolbar">
          <button className="bbs-action-btn" onClick={handleExportExcel}>
            <Download size={16} /> Export Excel
          </button>
          <button className="bbs-action-btn" onClick={handleExportPDF}>
            <FileText size={16} /> Export PDF
          </button>
          <button className="bbs-action-btn primary" onClick={handlePushToOptimizer}>
            <Scissors size={16} /> Push to Optimizer
          </button>
        </div>
      </div>

      {loading && !mto ? (
        <div className="bbs-mto-empty">Loading MTO data...</div>
      ) : mto ? (
        <>
          {/* Summary Cards */}
          <div className="bbs-mto-summary">
            <div className="bbs-mto-summary-card">
              <h3>Total Steel Weight (MT)</h3>
              <div className="value">
                {mto.grandTotalMT} <span className="unit">MT</span>
              </div>
            </div>
            <div className="bbs-mto-summary-card">
              <h3>Total Steel Weight (kg)</h3>
              <div className="value">
                {mto.grandTotalKg} <span className="unit">kg</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bbs-mto-section">
            <h2><FileText size={18} /> Diameter-wise Summary</h2>
            <table className="bbs-mto-table">
              <thead>
                <tr>
                  <th>Diameter (mm)</th>
                  <th className="right">Total Pieces</th>
                  <th className="right">Total Cut Length (m)</th>
                  <th className="right">Total Weight (kg)</th>
                </tr>
              </thead>
              <tbody>
                {mto.mto.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      <AlertCircle size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      <br/>
                      No rebars calculated in this project yet.
                    </td>
                  </tr>
                ) : (
                  mto.mto.map(row => (
                    <tr key={row.diameter}>
                      <td><strong>{row.diameter} mm</strong></td>
                      <td className="right">{row.barCount}</td>
                      <td className="right">{(row.totalLength / 1000).toFixed(2)}</td>
                      <td className="right">{row.totalWeight.toFixed(2)}</td>
                    </tr>
                  ))
                )}
                {mto.mto.length > 0 && (
                  <tr className="total-row">
                    <td>Grand Total</td>
                    <td className="right">
                      {mto.mto.reduce((sum, r) => sum + r.barCount, 0)}
                    </td>
                    <td className="right">
                      {(mto.mto.reduce((sum, r) => sum + r.totalLength, 0) / 1000).toFixed(2)}
                    </td>
                    <td className="right">{mto.grandTotalKg.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bbs-mto-empty">Failed to load MTO.</div>
      )}
    </div>
  );
}
