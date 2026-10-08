/**
 * RebarOptima Phase 2F — Interactive Calculation Trace & Engineering Breakdown Modal
 * 
 * Provides transparent, audit-ready engineering calculations:
 * - Mathematical formulas & step-by-step trace
 * - Segments, Bends, and Hooks breakdown
 * - Rule Set details & versioning
 * - Validation results & warnings
 * - Total weight derivation
 */

import React, { useState } from 'react';
import { formatLength, formatWeight, formatUnitWeight, formatAngle } from './calculationUnits';
import { engineeringRuleProvider } from './engineeringRules';

export default function CalculationTraceModal({
  calculation,
  onClose,
  onRuleSetChange,
  currentRuleSetId
}) {
  const [activeTab, setActiveTab] = useState('trace'); // 'trace' | 'breakdown' | 'validations' | 'rules'

  if (!calculation) return null;

  const ruleSets = engineeringRuleProvider.getAll();
  const {
    shapeName,
    barDiameter,
    geometricLength,
    developedLength,
    cuttingLength,
    unitWeight,
    totalWeight,
    segments = [],
    bends = [],
    hooks = [],
    adjustments = [],
    validations = [],
    trace = [],
    ruleSet = {},
    status,
    isTrusted
  } = calculation;

  const errorCount = validations.filter(v => v.severity === 'error').length;
  const warningCount = validations.filter(v => v.severity === 'warning').length;

  return (
    <div className="cad-calc-modal-backdrop" onClick={onClose}>
      <div className="cad-calc-modal-container" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="cad-calc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📐</span>
            <div>
              <h2 className="cad-calc-modal-title">
                Engineering Calculation & Validation Trace
              </h2>
              <div className="cad-calc-modal-subtitle">
                {shapeName} • Bar Diameter: Ø{barDiameter} mm • Status:{' '}
                <span className={`cad-calc-status-badge ${status.toLowerCase()}`}>
                  {isTrusted ? '✓ Valid & Trusted' : '✕ Invalid / Non-Compliant'}
                </span>
              </div>
            </div>
          </div>
          <button className="cad-calc-close-btn" onClick={onClose} title="Close Modal">
            ✕
          </button>
        </div>

        {/* Top Key Engineering Metrics Card */}
        <div className="cad-calc-summary-grid">
          <div className="cad-calc-metric-box">
            <span className="cad-calc-metric-label">Geometric Length</span>
            <span className="cad-calc-metric-value">{formatLength(geometricLength)}</span>
            <span className="cad-calc-metric-hint">Pure segment & arc sum</span>
          </div>

          <div className="cad-calc-metric-box">
            <span className="cad-calc-metric-label">Developed Length</span>
            <span className="cad-calc-metric-value">{formatLength(developedLength)}</span>
            <span className="cad-calc-metric-hint">Centerline path</span>
          </div>

          <div className="cad-calc-metric-box primary">
            <span className="cad-calc-metric-label">Cutting Length</span>
            <span className="cad-calc-metric-value highlight">{formatLength(cuttingLength)}</span>
            <span className="cad-calc-metric-hint">{ruleSet.name || 'Selected Rule'}</span>
          </div>

          <div className="cad-calc-metric-box">
            <span className="cad-calc-metric-label">Steel Unit Weight</span>
            <span className="cad-calc-metric-value">{formatUnitWeight(unitWeight)}</span>
            <span className="cad-calc-metric-hint">Ø{barDiameter} mm standard</span>
          </div>

          <div className="cad-calc-metric-box primary">
            <span className="cad-calc-metric-label">Total Bar Weight</span>
            <span className="cad-calc-metric-value highlight-green">{formatWeight(totalWeight)}</span>
            <span className="cad-calc-metric-hint">Cutting Length × Unit Wt</span>
          </div>
        </div>

        {/* Rule Selector Bar */}
        <div className="cad-calc-rule-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Engineering Rule Set:</span>
            <select
              className="cad-calc-rule-select"
              value={currentRuleSetId || ruleSet.id}
              onChange={e => onRuleSetChange(e.target.value)}
            >
              {ruleSets.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} (v{r.version}) — {r.jurisdiction}
                </option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Switching rules recalculates without changing geometry
          </span>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="cad-calc-modal-tabs">
          <button
            className={`cad-calc-tab-btn ${activeTab === 'trace' ? 'active' : ''}`}
            onClick={() => setActiveTab('trace')}
          >
            📋 Calculation Trace ({trace.length} Steps)
          </button>
          <button
            className={`cad-calc-tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
            onClick={() => setActiveTab('breakdown')}
          >
            📊 Geometry Breakdown ({segments.length} Segs, {bends.length} Bends, {hooks.length} Hooks)
          </button>
          <button
            className={`cad-calc-tab-btn ${activeTab === 'validations' ? 'active' : ''}`}
            onClick={() => setActiveTab('validations')}
          >
            🛡️ Engineering Validations ({errorCount} Errors, {warningCount} Warnings)
          </button>
          <button
            className={`cad-calc-tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            ⚖️ Rule Provider Specifications
          </button>
        </div>

        {/* Tab Body */}
        <div className="cad-calc-modal-body">
          {/* 1. CALCULATION TRACE TAB */}
          {activeTab === 'trace' && (
            <div className="cad-calc-trace-container">
              {trace.map((step, idx) => (
                <div key={idx} className="cad-calc-trace-card">
                  <div className="cad-calc-trace-header">
                    <span className="cad-calc-step-number">Step {step.step}</span>
                    <h4 className="cad-calc-step-title">{step.title}</h4>
                  </div>
                  <p className="cad-calc-step-desc">{step.description}</p>

                  {step.formula && (
                    <div className="cad-calc-formula-box">
                      <span className="cad-calc-formula-label">Formula:</span>
                      <code>{step.formula}</code>
                    </div>
                  )}

                  {Array.isArray(step.data) && step.data.length > 0 && (
                    <ul className="cad-calc-data-list">
                      {step.data.map((item, dIdx) => (
                        <li key={dIdx}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 2. GEOMETRY BREAKDOWN TAB */}
          {activeTab === 'breakdown' && (
            <div className="cad-calc-breakdown-container">
              {/* Segments */}
              <div className="cad-calc-sub-section">
                <h4 className="cad-calc-section-heading">Straight Segments ({segments.length})</h4>
                <div className="cad-calc-table-wrap">
                  <table className="cad-calc-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Start (mm)</th>
                        <th>End (mm)</th>
                        <th>Direction</th>
                        <th>Length</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segments.map((s, idx) => (
                        <tr key={s.id || idx}>
                          <td><code>{s.id}</code></td>
                          <td><strong>{s.name}</strong></td>
                          <td>({s.start?.x}, {s.start?.y})</td>
                          <td>({s.end?.x}, {s.end?.y})</td>
                          <td>{formatAngle(s.directionDeg)}</td>
                          <td style={{ color: '#38bdf8', fontWeight: 700 }}>{formatLength(s.length)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bends */}
              {bends.length > 0 && (
                <div className="cad-calc-sub-section">
                  <h4 className="cad-calc-section-heading">Bends & Fillets ({bends.length})</h4>
                  <div className="cad-calc-table-wrap">
                    <table className="cad-calc-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Angle</th>
                          <th>Radius</th>
                          <th>Arc Length (R × θ)</th>
                          <th>Rule Adjustment</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bends.map((b, idx) => (
                          <tr key={b.id || idx}>
                            <td><code>{b.id}</code></td>
                            <td>{formatAngle(b.angleDeg)}</td>
                            <td>R{b.radius} mm</td>
                            <td style={{ color: '#fbbf24' }}>{formatLength(b.arcLength)}</td>
                            <td style={{ color: b.adjustmentMm < 0 ? '#f87171' : '#cbd5e1' }}>
                              {b.adjustmentMm >= 0 ? '+' : ''}{b.adjustmentMm} mm
                            </td>
                            <td style={{ fontSize: '11px', color: '#94a3b8' }}>{b.explanation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Hooks */}
              {hooks.length > 0 && (
                <div className="cad-calc-sub-section">
                  <h4 className="cad-calc-section-heading">Anchorage Hooks ({hooks.length})</h4>
                  <div className="cad-calc-table-wrap">
                    <table className="cad-calc-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Hook Angle</th>
                          <th>Extension Length</th>
                          <th>Rule Adjustment</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hooks.map((h, idx) => (
                          <tr key={h.id || idx}>
                            <td><code>{h.id}</code></td>
                            <td>{formatAngle(h.angleDeg)}</td>
                            <td style={{ color: '#38bdf8', fontWeight: 700 }}>{formatLength(h.extensionMm)}</td>
                            <td>{h.adjustmentMm} mm</td>
                            <td style={{ fontSize: '11px', color: '#94a3b8' }}>{h.explanation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. ENGINEERING VALIDATIONS TAB */}
          {activeTab === 'validations' && (
            <div className="cad-calc-validations-container">
              {validations.length === 0 ? (
                <div style={{ color: '#22c55e', padding: '20px', textAlign: 'center' }}>
                  ✓ All engineering and geometric validations passed with 0 errors or warnings.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {validations.map((v, idx) => (
                    <div key={v.id || idx} className={`cad-validation-card ${v.severity}`}>
                      <div className="cad-val-card-header">
                        <span className={`cad-val-severity-badge ${v.severity}`}>
                          {v.severity.toUpperCase()}
                        </span>
                        <code className="cad-val-code">{v.code}</code>
                      </div>
                      <p className="cad-val-message">{v.message}</p>
                      {v.geometryReferences?.length > 0 && (
                        <div className="cad-val-refs">
                          References: {v.geometryReferences.map(r => <code key={r}>{r}</code>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. RULE PROVIDER SPECIFICATIONS TAB */}
          {activeTab === 'rules' && (
            <div className="cad-calc-rules-container">
              <div className="cad-rule-spec-card">
                <h3 style={{ color: '#38bdf8', margin: '0 0 6px 0' }}>{ruleSet.name}</h3>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
                  Standard: <strong>{ruleSet.standard}</strong> • Version: <strong>{ruleSet.version}</strong> • Jurisdiction: <strong>{ruleSet.jurisdiction}</strong>
                </div>
                <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
                  {ruleSet.description}
                </p>

                <div style={{ marginTop: '16px', background: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#fbbf24', fontSize: '12px' }}>Calculation Invariants</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#94a3b8', lineHeight: '1.6' }}>
                    <li>Geometric Engine provides pure 2D/3D world coordinates (mm).</li>
                    <li>Calculation Engine computes centerline developed length without mutating geometry.</li>
                    <li>Engineering Rule Set applies statutory or shop deductions at the cutting-length stage.</li>
                    <li>Unit weight derived from steel density (7,850 kg/m³) or standard trade table.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="cad-calc-modal-footer">
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Calculation Snapshot Signature ID: <code>{calculation.shapeId}</code>
          </div>
          <button className="cad-quick-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
