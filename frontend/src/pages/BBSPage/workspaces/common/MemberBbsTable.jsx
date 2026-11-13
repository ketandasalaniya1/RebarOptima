import React, { useState } from 'react';
import ShapeThumbnail from './ShapeThumbnail';
import RuleBadge, { RULE_CLASSIFICATION } from './RuleBadge';
import { Info, Calculator, ChevronDown, ChevronUp } from 'lucide-react';

export default function MemberBbsTable({
  rebarItems = [],
  title = 'Generated Bar Bending Schedule (BBS)',
  subtitle = 'Schedule items dynamically generated from detailing inputs & validated CAD shapes.',
  readOnly = false
}) {
  const [selectedTraceItem, setSelectedTraceItem] = useState(null);

  const totalLengthM = rebarItems.reduce((sum, item) => sum + (Number(item.total_length) || (item.cut_length * item.quantity / 1000) || 0), 0);
  const totalWeightKg = rebarItems.reduce((sum, item) => sum + (Number(item.total_weight) || 0), 0);

  return (
    <div className="bbs-schedule-table-card">
      <div className="bbs-schedule-header">
        <div>
          <h3 className="bbs-schedule-h3">{title}</h3>
          <p className="bbs-schedule-sub">{subtitle}</p>
        </div>
        <div className="bbs-schedule-totals-badge">
          <span>Total: <strong>{rebarItems.length} Marks</strong></span>
          <span className="bbs-bullet">•</span>
          <span><strong>{totalLengthM.toFixed(1)} m</strong></span>
          <span className="bbs-bullet">•</span>
          <span><strong>{totalWeightKg.toFixed(2)} kg</strong></span>
        </div>
      </div>

      {rebarItems.length === 0 ? (
        <div className="bbs-schedule-empty">
          <Calculator size={32} className="bbs-empty-icon" />
          <p>No reinforcement bars generated yet. Enter member dimensions and detailing parameters above.</p>
        </div>
      ) : (
        <div className="bbs-table-responsive">
          <table className="bbs-data-table bbs-bbs-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Mark</th>
                <th>Description / Role</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Shape</th>
                <th>Code</th>
                <th style={{ width: '70px', textAlign: 'right' }}>Dia (mm)</th>
                <th style={{ width: '80px', textAlign: 'right' }}>Spacing</th>
                <th style={{ width: '60px', textAlign: 'right' }}>No.</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Cutting L (mm)</th>
                <th style={{ width: '90px', textAlign: 'right' }}>Total L (m)</th>
                <th style={{ width: '85px', textAlign: 'right' }}>Unit Wt</th>
                <th style={{ width: '95px', textAlign: 'right' }}>Total Wt (kg)</th>
                <th>Rule Verification</th>
                <th style={{ width: '40px' }}>Trace</th>
              </tr>
            </thead>
            <tbody>
              {rebarItems.map((item, index) => {
                const mark = item.barMark || String(index + 1).padStart(2, '0');
                const cutLength = Number(item.cut_length) || 0;
                const qty = Number(item.quantity) || Number(item.bar_count) || 0;
                const totLengthM = Number(item.total_length) ? Number(item.total_length) / 1000 : (cutLength * qty) / 1000;
                const unitWeight = Number(item.unit_weight) || (Math.pow(Number(item.diameter || item.barDiameter || 16), 2) / 162.28);
                const totWeight = Number(item.total_weight) || (totLengthM * unitWeight);

                return (
                  <tr key={item.id || item._id || index}>
                    <td>
                      <span className="bbs-mark-pill">{mark}</span>
                    </td>
                    <td>
                      <div className="bbs-desc-primary">{item.description || item.label || 'Rebar'}</div>
                      {item.note && <div className="bbs-desc-note">{item.note}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <ShapeThumbnail
                        shapeCode={item.shapeCode || item.shape_code || 'Shape 00'}
                        parameters={item.parameterValues || item.part_dimensions || {}}
                      />
                    </td>
                    <td>
                      <code className="bbs-shape-code-tag">{item.shapeCode || item.shape_code || 'Shape 00'}</code>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      Ø{item.diameter || item.barDiameter || 16}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {item.spacing && item.spacing > 0 ? `${item.spacing} mm` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {qty}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                      {Math.round(cutLength)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {totLengthM.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#64748b' }}>
                      {unitWeight.toFixed(3)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {totWeight.toFixed(2)}
                    </td>
                    <td>
                      <RuleBadge
                        classification={item.ruleClassification || RULE_CLASSIFICATION.STATUTORY_CODE}
                        source={item.ruleSource}
                        note={item.ruleNote}
                      />
                    </td>
                    <td>
                      {item.calculationTrace && (
                        <button
                          className="bbs-icon-btn-tiny"
                          title="View calculation mathematical trace"
                          onClick={() => setSelectedTraceItem(selectedTraceItem === item ? null : item)}
                        >
                          <Info size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bbs-table-total-row">
                <td colSpan="6" style={{ fontWeight: 700, textAlign: 'right' }}>
                  Total Scheduled Steel:
                </td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>
                  {rebarItems.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)} pcs
                </td>
                <td></td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>
                  {totalLengthM.toFixed(2)} m
                </td>
                <td></td>
                <td style={{ fontWeight: 700, textAlign: 'right', color: '#1e40af' }}>
                  {totalWeightKg.toFixed(2)} kg
                </td>
                <td colSpan="2">
                  <span className="bbs-total-tonnage-tag">{(totalWeightKg / 1000).toFixed(3)} MT</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Expanded Calculation Trace Modal / Popover */}
      {selectedTraceItem && (
        <div className="bbs-trace-popover">
          <div className="bbs-trace-header">
            <h4>Calculation Trace: Mark {selectedTraceItem.barMark} ({selectedTraceItem.description})</h4>
            <button className="bbs-close-btn-tiny" onClick={() => setSelectedTraceItem(null)}>✕</button>
          </div>
          <div className="bbs-trace-body">
            <p className="bbs-trace-formula">
              <strong>Formula:</strong> {selectedTraceItem.calculationTrace.formula || 'Sum of straight legs + bend adjustments'}
            </p>
            <p className="bbs-trace-derivation">
              <strong>Derivation:</strong> {selectedTraceItem.calculationTrace.trace || 'Computed using neutral axis centerline arc integration'}
            </p>
            {selectedTraceItem.calculationTrace.adjustments && (
              <ul className="bbs-trace-adjustments">
                {selectedTraceItem.calculationTrace.adjustments.map((a, i) => (
                  <li key={i}>{a.explanation || `${a.type}: ${a.adjustmentMm} mm`}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

