import React from 'react';
import { Building2, Layers, Scale, TrendingUp } from 'lucide-react';

export default function BbsKpiCards({
  totalMembers = 0,
  totalPieces = 0,
  totalWeightKg = 0,
  totalWeightMT = 0
}) {
  return (
    <div className="bbs-dashboard-kpis-grid">
      {/* CARD 1: Total Calculated Members */}
      <div className="bbs-dashboard-kpi-card">
        <div className="bbs-kpi-header">
          <span className="bbs-kpi-label">Calculated Members</span>
          <div className="bbs-kpi-icon-wrap icon-blue">
            <Building2 size={18} />
          </div>
        </div>
        <div className="bbs-kpi-value">{totalMembers.toLocaleString()}</div>
        <div className="bbs-kpi-footer">
          <span>Distinct structural elements</span>
        </div>
      </div>

      {/* CARD 2: Total Bar Pieces */}
      <div className="bbs-dashboard-kpi-card">
        <div className="bbs-kpi-header">
          <span className="bbs-kpi-label">Total Bar Pieces</span>
          <div className="bbs-kpi-icon-wrap icon-amber">
            <Layers size={18} />
          </div>
        </div>
        <div className="bbs-kpi-value">{totalPieces.toLocaleString()}</div>
        <div className="bbs-kpi-footer">
          <span>Cut & bent pieces scheduled</span>
        </div>
      </div>

      {/* CARD 3: Total Steel Weight in KG */}
      <div className="bbs-dashboard-kpi-card">
        <div className="bbs-kpi-header">
          <span className="bbs-kpi-label">Total Weight (KG)</span>
          <div className="bbs-kpi-icon-wrap icon-emerald">
            <Scale size={18} />
          </div>
        </div>
        <div className="bbs-kpi-value">
          {totalWeightKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          <span className="bbs-kpi-unit">kg</span>
        </div>
        <div className="bbs-kpi-footer">
          <span>Standard steel density 7850 kg/m³</span>
        </div>
      </div>

      {/* CARD 4: Total Steel Tonnage in MT */}
      <div className="bbs-dashboard-kpi-card">
        <div className="bbs-kpi-header">
          <span className="bbs-kpi-label">Total Tonnage (MT)</span>
          <div className="bbs-kpi-icon-wrap icon-purple">
            <TrendingUp size={18} />
          </div>
        </div>
        <div className="bbs-kpi-value">
          {totalWeightMT.toFixed(3)}
          <span className="bbs-kpi-unit">MT</span>
        </div>
        <div className="bbs-kpi-footer">
          <span>Metric tonnes net procurement</span>
        </div>
      </div>
    </div>
  );
}

