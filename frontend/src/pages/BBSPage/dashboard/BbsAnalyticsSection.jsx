import React, { useState } from 'react';
import { CircleDot, LayoutGrid, Layers, Cpu, Hash, ExternalLink, BarChart2 } from 'lucide-react';

export default function BbsAnalyticsSection({
  diameterSummary = [],
  blockSummary = [],
  floorSummary = [],
  memberTypeSummary = [],
  memberSummary = [],
  totalWeightKg = 0,
  onNavigateToMember
}) {
  const [activeTab, setActiveTab] = useState('diameter'); // 'diameter' | 'block' | 'floor' | 'type' | 'member'

  const maxDiaWeight = Math.max(...diameterSummary.map(d => d.weightKg), 1);
  const maxBlockWeight = Math.max(...blockSummary.map(b => b.weightKg), 1);
  const maxFloorWeight = Math.max(...floorSummary.map(f => f.weightKg), 1);
  const maxTypeWeight = Math.max(...memberTypeSummary.map(t => t.weightKg), 1);

  return (
    <div className="bbs-analytics-card">
      <div className="bbs-analytics-header">
        <div className="bbs-analytics-tabs">
          <button
            className={`bbs-analytics-tab-btn ${activeTab === 'diameter' ? 'active' : ''}`}
            onClick={() => setActiveTab('diameter')}
          >
            <CircleDot size={14} />
            <span>Diameter-wise ({diameterSummary.length})</span>
          </button>
          <button
            className={`bbs-analytics-tab-btn ${activeTab === 'block' ? 'active' : ''}`}
            onClick={() => setActiveTab('block')}
          >
            <LayoutGrid size={14} />
            <span>Block-wise ({blockSummary.length})</span>
          </button>
          <button
            className={`bbs-analytics-tab-btn ${activeTab === 'floor' ? 'active' : ''}`}
            onClick={() => setActiveTab('floor')}
          >
            <Layers size={14} />
            <span>Floor-wise ({floorSummary.length})</span>
          </button>
          <button
            className={`bbs-analytics-tab-btn ${activeTab === 'type' ? 'active' : ''}`}
            onClick={() => setActiveTab('type')}
          >
            <Cpu size={14} />
            <span>Member Type ({memberTypeSummary.length})</span>
          </button>
          <button
            className={`bbs-analytics-tab-btn ${activeTab === 'member' ? 'active' : ''}`}
            onClick={() => setActiveTab('member')}
          >
            <Hash size={14} />
            <span>Member-wise ({memberSummary.length})</span>
          </button>
        </div>
      </div>

      <div className="bbs-analytics-body">
        {/* VIEW 1: DIAMETER-WISE SUMMARY */}
        {activeTab === 'diameter' && (
          <div className="bbs-analytics-view-grid">
            <div className="bbs-analytics-chart-panel">
              <h4 className="bbs-panel-subheading">Weight Distribution by Rebar Diameter</h4>
              <div className="bbs-dia-bars-container">
                {diameterSummary.map(row => {
                  const barPercent = Math.min(100, (row.weightKg / maxDiaWeight) * 100);
                  return (
                    <div key={row.diameter} className="bbs-dia-bar-row">
                      <div className="bbs-dia-bar-meta">
                        <span className="bbs-dia-tag font-bold">Ø{row.diameter} mm</span>
                        <span className="bbs-dia-weight-val">
                          {row.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg ({row.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="bbs-dia-bar-track">
                        <div
                          className="bbs-dia-bar-fill fill-blue"
                          style={{ width: `${barPercent}%` }}
                          title={`Ø${row.diameter} mm: ${row.weightKg.toFixed(1)} kg`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bbs-analytics-table-panel">
              <table className="bbs-summary-mini-table">
                <thead>
                  <tr>
                    <th className="text-center">Dia</th>
                    <th className="text-right">Pieces</th>
                    <th className="text-right">Cut Length (m)</th>
                    <th className="text-right">Unit Wt (kg/m)</th>
                    <th className="text-right">Total Wt (kg)</th>
                    <th className="text-right">Tonnage (MT)</th>
                  </tr>
                </thead>
                <tbody>
                  {diameterSummary.map(row => (
                    <tr key={row.diameter}>
                      <td className="text-center font-bold">Ø{row.diameter}</td>
                      <td className="text-right">{row.pieces.toLocaleString()}</td>
                      <td className="text-right">{row.lengthM.toFixed(2)}</td>
                      <td className="text-right">{row.unitWeight.toFixed(3)}</td>
                      <td className="text-right font-bold">{row.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                      <td className="text-right font-bold text-accent">{row.weightMT.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: BLOCK-WISE SUMMARY */}
        {activeTab === 'block' && (
          <div className="bbs-analytics-view-grid">
            <div className="bbs-analytics-chart-panel">
              <h4 className="bbs-panel-subheading">Steel Weight by Block / Building</h4>
              <div className="bbs-dia-bars-container">
                {blockSummary.map(row => {
                  const barPercent = Math.min(100, (row.weightKg / maxBlockWeight) * 100);
                  return (
                    <div key={row.id} className="bbs-dia-bar-row">
                      <div className="bbs-dia-bar-meta">
                        <span className="bbs-dia-tag font-bold">{row.name}</span>
                        <span className="bbs-dia-weight-val">
                          {row.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg ({row.weightMT.toFixed(3)} MT)
                        </span>
                      </div>
                      <div className="bbs-dia-bar-track">
                        <div
                          className="bbs-dia-bar-fill fill-emerald"
                          style={{ width: `${barPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bbs-analytics-table-panel">
              <table className="bbs-summary-mini-table">
                <thead>
                  <tr>
                    <th>Block Name</th>
                    <th className="text-center">Members</th>
                    <th className="text-right">Bar Pieces</th>
                    <th className="text-right">Cut Length (m)</th>
                    <th className="text-right">Total Wt (kg)</th>
                    <th className="text-right">Tonnage (MT)</th>
                  </tr>
                </thead>
                <tbody>
                  {blockSummary.map(row => (
                    <tr key={row.id}>
                      <td className="font-bold">{row.name}</td>
                      <td className="text-center">{row.memberCount}</td>
                      <td className="text-right">{row.pieces.toLocaleString()}</td>
                      <td className="text-right">{row.lengthM.toFixed(2)}</td>
                      <td className="text-right font-bold">{row.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                      <td className="text-right font-bold text-accent">{row.weightMT.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: FLOOR-WISE SUMMARY */}
        {activeTab === 'floor' && (
          <div className="bbs-analytics-view-grid">
            <div className="bbs-analytics-chart-panel">
              <h4 className="bbs-panel-subheading">Elevation Profile (Steel Weight by Floor)</h4>
              <div className="bbs-dia-bars-container">
                {floorSummary.map(row => {
                  const barPercent = Math.min(100, (row.weightKg / maxFloorWeight) * 100);
                  return (
                    <div key={row.id} className="bbs-dia-bar-row">
                      <div className="bbs-dia-bar-meta">
                        <span className="bbs-dia-tag font-bold">{row.name} ({row.blockName})</span>
                        <span className="bbs-dia-weight-val">
                          {row.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg
                        </span>
                      </div>
                      <div className="bbs-dia-bar-track">
                        <div
                          className="bbs-dia-bar-fill fill-purple"
                          style={{ width: `${barPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bbs-analytics-table-panel">
              <table className="bbs-summary-mini-table">
                <thead>
                  <tr>
                    <th>Floor / Level</th>
                    <th>Block</th>
                    <th className="text-center">Members</th>
                    <th className="text-right">Bar Pieces</th>
                    <th className="text-right">Cut Length (m)</th>
                    <th className="text-right">Total Wt (kg)</th>
                    <th className="text-right">Tonnage (MT)</th>
                  </tr>
                </thead>
                <tbody>
                  {floorSummary.map(row => (
                    <tr key={row.id}>
                      <td className="font-bold">{row.name}</td>
                      <td>{row.blockName}</td>
                      <td className="text-center">{row.memberCount}</td>
                      <td className="text-right">{row.pieces.toLocaleString()}</td>
                      <td className="text-right">{row.lengthM.toFixed(2)}</td>
                      <td className="text-right font-bold">{row.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                      <td className="text-right font-bold text-accent">{row.weightMT.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 4: MEMBER TYPE-WISE SUMMARY */}
        {activeTab === 'type' && (
          <div className="bbs-analytics-view-grid">
            <div className="bbs-analytics-chart-panel">
              <h4 className="bbs-panel-subheading">Steel Consumption by Member Type</h4>
              <div className="bbs-dia-bars-container">
                {memberTypeSummary.map(row => {
                  const barPercent = Math.min(100, (row.weightKg / maxTypeWeight) * 100);
                  return (
                    <div key={row.id} className="bbs-dia-bar-row">
                      <div className="bbs-dia-bar-meta">
                        <span className="bbs-dia-tag font-bold">{row.name}</span>
                        <span className="bbs-dia-weight-val">
                          {row.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg ({row.weightMT.toFixed(3)} MT)
                        </span>
                      </div>
                      <div className="bbs-dia-bar-track">
                        <div
                          className="bbs-dia-bar-fill fill-amber"
                          style={{ width: `${barPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bbs-analytics-table-panel">
              <table className="bbs-summary-mini-table">
                <thead>
                  <tr>
                    <th>Member Type</th>
                    <th className="text-center">Members</th>
                    <th className="text-right">Bar Pieces</th>
                    <th className="text-right">Cut Length (m)</th>
                    <th className="text-right">Total Wt (kg)</th>
                    <th className="text-right">Tonnage (MT)</th>
                  </tr>
                </thead>
                <tbody>
                  {memberTypeSummary.map(row => (
                    <tr key={row.id}>
                      <td className="font-bold">{row.name}</td>
                      <td className="text-center">{row.memberCount}</td>
                      <td className="text-right">{row.pieces.toLocaleString()}</td>
                      <td className="text-right">{row.lengthM.toFixed(2)}</td>
                      <td className="text-right font-bold">{row.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                      <td className="text-right font-bold text-accent">{row.weightMT.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 5: MEMBER-WISE SUMMARY */}
        {activeTab === 'member' && (
          <div className="bbs-member-summary-panel">
            <table className="bbs-summary-mini-table">
              <thead>
                <tr>
                  <th>Member ID</th>
                  <th>Type</th>
                  <th>Block</th>
                  <th>Floor</th>
                  <th className="text-right">Bar Pieces</th>
                  <th className="text-right">Cut Length (m)</th>
                  <th className="text-right">Total Wt (kg)</th>
                  <th className="text-right">Tonnage (MT)</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {memberSummary.map(m => (
                  <tr key={m.id}>
                    <td className="font-bold">{m.memberMark}</td>
                    <td><span className="bbs-badge-type">{m.memberType}</span></td>
                    <td>{m.blockName}</td>
                    <td>{m.floorName}</td>
                    <td className="text-right">{m.pieces.toLocaleString()}</td>
                    <td className="text-right">{m.lengthM.toFixed(2)}</td>
                    <td className="text-right font-bold">{m.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                    <td className="text-right font-bold text-accent">{m.weightMT.toFixed(3)}</td>
                    <td className="text-center">
                      <button
                        className="bbs-btn-link-action"
                        onClick={() => onNavigateToMember(m.rawMember)}
                        title="Open in dedicated detailing workspace"
                      >
                        <span>Workspace</span>
                        <ExternalLink size={12} />
                      </button>
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

