/**
 * RebarOptima Phase 2F — Engineering Calculation & Validation Sidebar Panel
 * 
 * Embedded directly in the CAD Editor right panel:
 * - Real-time calculation summary (Cutting Length, Developed Length, Weight)
 * - Rule Set Selector
 * - Validation badges (Errors, Warnings)
 * - Fast inspect button to open full Calculation Trace Modal
 */

import React from 'react';
import { formatLength, formatWeight, formatUnitWeight } from './calculationUnits';
import { engineeringRuleProvider } from './engineeringRules';

export default function CalculationPanel({
  calculation,
  currentRuleSetId,
  onRuleSetChange,
  onOpenTraceModal
}) {
  if (!calculation) {
    return (
      <div className="cad-panel-section">
        <div style={{ color: '#94a3b8', fontSize: '12px', padding: '12px 0' }}>
          Select or create a rebar shape to view engineering calculations.
        </div>
      </div>
    );
  }

  const ruleSets = engineeringRuleProvider.getAll();
  const {
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
    status,
    isTrusted
  } = calculation;

  const errorValidations = validations.filter(v => v.severity === 'error');
  const warningValidations = validations.filter(v => v.severity === 'warning');

  return (
    <div className="cad-calc-panel-container">
      {/* 1. Status & Trust Card */}
      <div className={`cad-calc-status-card ${status.toLowerCase()}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Engineering Status
          </span>
          <span className={`cad-calc-badge ${status.toLowerCase()}`}>
            {isTrusted ? '✓ Valid & Trusted' : status === 'INVALID' ? '✕ Invalid' : status}
          </span>
        </div>
        {!isTrusted && errorValidations.length > 0 && (
          <div style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>
            {errorValidations[0].message}
          </div>
        )}
      </div>

      {/* 2. Engineering Rule Set Selector */}
      <div className="cad-calc-field-group">
        <label className="cad-calc-field-label">Engineering Rule Set</label>
        <select
          className="cad-calc-rule-dropdown"
          value={currentRuleSetId}
          onChange={(e) => onRuleSetChange(e.target.value)}
        >
          {ruleSets.map(r => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'block' }}>
          Applies statutory bend deductions and unit weights
        </span>
      </div>

      {/* 3. Primary Engineering Output Metrics */}
      <div className="cad-calc-metrics-stack">
        {/* Cutting Length */}
        <div className="cad-calc-metric-row primary">
          <div>
            <span className="cad-calc-metric-name">Cutting Length</span>
            <span className="cad-calc-metric-sub">Final fabrication length</span>
          </div>
          <span className="cad-calc-metric-number highlight">{formatLength(cuttingLength)}</span>
        </div>

        {/* Developed Centerline Length */}
        <div className="cad-calc-metric-row">
          <div>
            <span className="cad-calc-metric-name">Developed Length</span>
            <span className="cad-calc-metric-sub">Centerline path length</span>
          </div>
          <span className="cad-calc-metric-number">{formatLength(developedLength)}</span>
        </div>

        {/* Geometric Length */}
        <div className="cad-calc-metric-row">
          <div>
            <span className="cad-calc-metric-name">Geometric Length</span>
            <span className="cad-calc-metric-sub">Sum of straight legs</span>
          </div>
          <span className="cad-calc-metric-number">{formatLength(geometricLength)}</span>
        </div>

        {/* Steel Weight */}
        <div className="cad-calc-metric-row primary">
          <div>
            <span className="cad-calc-metric-name">Total Weight</span>
            <span className="cad-calc-metric-sub">Ø{barDiameter} mm • {formatUnitWeight(unitWeight)}</span>
          </div>
          <span className="cad-calc-metric-number highlight-green">{formatWeight(totalWeight)}</span>
        </div>
      </div>

      {/* 4. Geometry Elements Summary */}
      <div className="cad-calc-elements-summary">
        <div className="cad-calc-chip">
          <span className="chip-label">Segments:</span>
          <span className="chip-val">{segments.length}</span>
        </div>
        <div className="cad-calc-chip">
          <span className="chip-label">Bends:</span>
          <span className="chip-val">{bends.length}</span>
        </div>
        <div className="cad-calc-chip">
          <span className="chip-label">Hooks:</span>
          <span className="chip-val">{hooks.length}</span>
        </div>
      </div>

      {/* 5. Warning Notice if any */}
      {warningValidations.length > 0 && (
        <div className="cad-calc-warning-box">
          <span style={{ fontWeight: 700 }}>⚠️ Advisory Notice ({warningValidations.length}):</span>
          <div style={{ fontSize: '11px', marginTop: '2px' }}>{warningValidations[0].message}</div>
        </div>
      )}

      {/* 6. Action Button: View Full Calculation Trace */}
      <button
        type="button"
        className="cad-calc-inspect-btn"
        onClick={onOpenTraceModal}
      >
        <span>🔍 View Calculation Trace & Formulas</span>
      </button>
    </div>
  );
}
