import React from 'react';
import { Scale, Box, Layers, Hash } from 'lucide-react';

export default function SummaryCards({
  totalWeight = 0,
  concreteVolume = 0,
  barCount = 0,
  distinctDiameters = []
}) {
  const weightKg = Number(totalWeight) || 0;
  const weightMT = (weightKg / 1000).toFixed(3);
  const volumeM3 = Number(concreteVolume) || 0;
  const rebarRatio = volumeM3 > 0 ? (weightKg / volumeM3).toFixed(1) : '—';

  return (
    <div className="bbs-summary-cards-grid">
      <div className="bbs-summary-card">
        <div className="bbs-summary-card-icon weight">
          <Scale size={20} />
        </div>
        <div className="bbs-summary-card-data">
          <div className="bbs-summary-card-label">Total Steel Weight</div>
          <div className="bbs-summary-card-val">
            {weightKg.toFixed(2)} <span className="bbs-unit">kg</span>
          </div>
          <div className="bbs-summary-card-sub">({weightMT} Metric Tons)</div>
        </div>
      </div>

      <div className="bbs-summary-card">
        <div className="bbs-summary-card-icon volume">
          <Box size={20} />
        </div>
        <div className="bbs-summary-card-data">
          <div className="bbs-summary-card-label">Concrete Volume</div>
          <div className="bbs-summary-card-val">
            {volumeM3.toFixed(3)} <span className="bbs-unit">m³</span>
          </div>
          <div className="bbs-summary-card-sub">Gross Member Profile</div>
        </div>
      </div>

      <div className="bbs-summary-card">
        <div className="bbs-summary-card-icon ratio">
          <Layers size={20} />
        </div>
        <div className="bbs-summary-card-data">
          <div className="bbs-summary-card-label">Steel-to-Concrete Ratio</div>
          <div className="bbs-summary-card-val">
            {rebarRatio} <span className="bbs-unit">{volumeM3 > 0 ? 'kg/m³' : ''}</span>
          </div>
          <div className="bbs-summary-card-sub">Structural Reinforcement Density</div>
        </div>
      </div>

      <div className="bbs-summary-card">
        <div className="bbs-summary-card-icon count">
          <Hash size={20} />
        </div>
        <div className="bbs-summary-card-data">
          <div className="bbs-summary-card-label">Total Rebar Pieces</div>
          <div className="bbs-summary-card-val">
            {barCount} <span className="bbs-unit">pcs</span>
          </div>
          <div className="bbs-summary-card-sub">
            Diameters: {distinctDiameters.length > 0 ? distinctDiameters.map(d => `Ø${d}`).join(', ') : 'None'}
          </div>
        </div>
      </div>
    </div>
  );
}

