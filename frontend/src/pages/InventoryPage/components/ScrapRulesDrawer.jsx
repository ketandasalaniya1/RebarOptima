import React, { useState, useEffect, useMemo } from 'react';
import { Sliders, Save, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Sparkles, Settings } from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import './ScrapRulesDrawer.css';

/**
 * Slide-over Drawer for Configuring Scrap Classification Threshold Rules
 * CHANGE 2 COMPLIANCE:
 * - One-line explainer: "Offcuts shorter than this are scrap. Longer ones are saved for reuse."
 * - Simple default threshold for all diameters.
 * - "Advanced: set per diameter" toggle.
 * - Instant synchronization upon saving.
 */
export default function ScrapRulesDrawer({
  isOpen,
  onClose,
  scrapRules = [],
  handleRuleChange,
  handleSaveRules,
  actionLoading = false,
  error = '',
  success = '',
  onSaveSuccess,
}) {
  const standardDiameters = [8, 10, 12, 16, 20, 25, 32];

  // Check if saved rules already have distinct per-diameter thresholds
  const hasDistinctPerDiaRules = useMemo(() => {
    if (!scrapRules || scrapRules.length <= 1) return false;
    const firstVal = scrapRules[0]?.scrapLengthThreshold;
    return scrapRules.some(r => r.scrapLengthThreshold !== undefined && Number(r.scrapLengthThreshold) !== Number(firstVal));
  }, [scrapRules]);

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-expand advanced mode if distinct per-diameter rules exist
  useEffect(() => {
    if (hasDistinctPerDiaRules) {
      setShowAdvanced(true);
    }
  }, [hasDistinctPerDiaRules]);

  // Derive initial common threshold from first rule or default 1000
  const initialThreshold = scrapRules.length > 0 && scrapRules[0].scrapLengthThreshold
    ? Number(scrapRules[0].scrapLengthThreshold)
    : 1000;
  const [commonThreshold, setCommonThreshold] = useState(initialThreshold);

  useEffect(() => {
    if (scrapRules.length > 0 && scrapRules[0].scrapLengthThreshold && !hasDistinctPerDiaRules) {
      setCommonThreshold(Number(scrapRules[0].scrapLengthThreshold));
    }
  }, [scrapRules, hasDistinctPerDiaRules]);

  // Map existing rules or provide default 1000mm
  const displayRules = standardDiameters.map((dia, idx) => {
    const existing = scrapRules.find((r) => Number(r.diameter) === dia);
    return {
      diameter: dia,
      idx: existing ? scrapRules.indexOf(existing) : idx,
      scrapLengthThreshold: existing && existing.scrapLengthThreshold !== undefined
        ? existing.scrapLengthThreshold
        : commonThreshold,
    };
  });

  // Explicitly apply common threshold to all diameters only when requested
  const handleApplyCommonThreshold = (val) => {
    const num = val === '' ? '' : Math.max(0, Number(val));
    setCommonThreshold(num);
    if (handleRuleChange && num !== '') {
      displayRules.forEach((rule) => {
        handleRuleChange(rule.idx, num);
      });
    }
  };

  const handleSaveAndClose = async () => {
    if (handleSaveRules) {
      await handleSaveRules();
      if (onSaveSuccess) onSaveSuccess(commonThreshold);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Scrap Classification Rules"
      subtitle="Define offcut thresholds to distinguish reusable remnants from scrap material"
      icon={<Settings size={20} className="text-emerald" />}
      width="520px"
      ariaLabel="Scrap Classification Rules Drawer"
      footer={
        <div className="drawer-footer-row">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={actionLoading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveAndClose}
            disabled={actionLoading}
          >
            {actionLoading ? (
              'Saving Rules...'
            ) : (
              <>
                <Save size={15} /> Save Rules
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="scrap-rules-drawer-content">
        {error && (
          <div className="drawer-alert error">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="drawer-alert success">
            <CheckCircle2 size={15} />
            <span>{success}</span>
          </div>
        )}

        {/* Change 2 Mandatory One-Line Explainer */}
        <div className="rules-explainer-box">
          <Sparkles size={16} className="text-emerald" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
            <strong>Offcuts shorter than this are scrap. Longer ones are saved for reuse.</strong>
          </p>
        </div>

        {/* Simple Mode: Default Threshold for all diameters */}
        <div className="card simple-threshold-card" style={{ padding: '18px 20px', borderRadius: '10px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--card-border, #e2e8f0)', marginTop: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Standard Scrap Threshold (all diameters)
              </label>
              {hasDistinctPerDiaRules && (
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-text)', background: 'var(--accent-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
                  Custom per-diameter thresholds active
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="number"
                min="100"
                max="12000"
                step="50"
                value={commonThreshold}
                onChange={(e) => setCommonThreshold(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--card-border, #cbd5e1)',
                  width: '140px',
                  background: 'var(--input-bg, #f8fafc)',
                  color: 'var(--text-primary)'
                }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>mm</span>
              <button
                type="button"
                onClick={() => handleApplyCommonThreshold(commonThreshold)}
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Apply to All Diameters
              </button>
              <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                {[500, 1000, 1500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleApplyCommonThreshold(preset)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--card-border, #cbd5e1)',
                      background: commonThreshold === preset ? 'var(--accent, #059669)' : 'var(--card-bg, #fff)',
                      color: commonThreshold === preset ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {preset}mm
                  </button>
                ))}
              </div>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
              Applied automatically to Ø 8mm, 10mm, 12mm, 16mm, 20mm, 25mm, and 32mm reinforcement bars.
            </span>
          </div>
        </div>

        {/* Advanced Toggle */}
        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--accent, #059669)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 0'
            }}
          >
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>{showAdvanced ? 'Hide Per-Diameter Overrides' : 'Advanced: Set per diameter'}</span>
          </button>
        </div>

        {/* Per-Diameter Advanced Table */}
        {showAdvanced && (
          <div className="rules-table-container" style={{ marginTop: '10px' }}>
            <table className="rules-config-table">
              <thead>
                <tr>
                  <th>Diameter</th>
                  <th>Min Remnant Length (mm)</th>
                  <th>Classification</th>
                </tr>
              </thead>
              <tbody>
                {displayRules.map((rule) => (
                  <tr key={rule.diameter}>
                    <td>
                      <span className="dia-badge-pill">Ø {rule.diameter} mm</span>
                    </td>
                    <td>
                      <div className="rule-input-wrap">
                        <input
                          type="number"
                          min="100"
                          max="12000"
                          step="50"
                          value={rule.scrapLengthThreshold}
                          onChange={(e) => {
                            if (handleRuleChange) handleRuleChange(rule.idx, e.target.value);
                          }}
                          className="rule-num-input"
                        />
                        <span className="unit-label">mm</span>
                      </div>
                    </td>
                    <td>
                      <span className="rule-status-label">
                        &lt; {rule.scrapLengthThreshold || 1000}mm = Scrap
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Drawer>
  );
}
