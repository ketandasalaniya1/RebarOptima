import React from 'react';
import { Ruler, Layers, ShieldCheck } from 'lucide-react';

const COMMON_DIAMETERS = [8, 10, 12, 16, 20, 25, 32];

export default function BeamInputs({
  config,
  onChange,
  validation = {}
}) {
  const updateField = (field, val) => {
    onChange({ ...config, [field]: val });
  };

  const updateNumeric = (field, val) => {
    const num = parseFloat(val);
    onChange({ ...config, [field]: isNaN(num) ? 0 : num });
  };

  return (
    <div className="bbs-workspace-inputs-grid">
      {/* CARD 1: Beam Geometry */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Ruler size={16} className="bbs-card-icon" />
          <span>1. Beam Dimensions & Supports</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Clear Span L_clear (mm)</label>
            <input
              type="number"
              min="1000"
              step="100"
              value={config.L_clear || 4000}
              onChange={e => updateNumeric('L_clear', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Width b (mm)</label>
            <input
              type="number"
              min="150"
              step="25"
              value={config.b || 250}
              onChange={e => updateNumeric('b', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Total Depth D (mm)</label>
            <input
              type="number"
              min="200"
              step="25"
              value={config.D || 450}
              onChange={e => updateNumeric('D', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Support Columns Width (mm)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="200"
                step="50"
                value={config.W_left || 300}
                onChange={e => updateNumeric('W_left', e.target.value)}
                className="bbs-input"
                title="Left support column width"
              />
              <input
                type="number"
                min="200"
                step="50"
                value={config.W_right || 300}
                onChange={e => updateNumeric('W_right', e.target.value)}
                className="bbs-input"
                title="Right support column width"
              />
            </div>
            <span className="bbs-input-hint">Left & Right support widths</span>
          </div>

          <div className="bbs-form-group">
            <label>Clear Cover (mm)</label>
            <input
              type="number"
              min="20"
              max="50"
              step="5"
              value={config.cover || 25}
              onChange={e => updateNumeric('cover', e.target.value)}
              className="bbs-input"
            />
            <span className="bbs-input-hint">IS 456 Table 16 default: 25 mm</span>
          </div>
        </div>
      </div>

      {/* CARD 2: Main Longitudinal Bars */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Layers size={16} className="bbs-card-icon" />
          <span>2. Main Longitudinal Steel</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Bottom Main Tension Bars</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="2"
                max="8"
                value={config.bottomMainCount || 3}
                onChange={e => updateNumeric('bottomMainCount', e.target.value)}
                className="bbs-input"
                title="Number of bars"
              />
              <select
                value={config.bottomMainDia || 16}
                onChange={e => updateNumeric('bottomMainDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.filter(d => d >= 12).map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
            </div>
            <span className="bbs-input-hint">{config.bottomMainCount || 3} bottom tension bars anchored into columns</span>
          </div>

          <div className="bbs-form-group">
            <label>Bottom 90° Anchorage Hook (mm)</label>
            <input
              type="number"
              min="150"
              step="25"
              placeholder={`Default: ${Math.max(200, 12 * (config.bottomMainDia || 16))} mm`}
              value={config.supportAnchorHook !== undefined && config.supportAnchorHook !== null ? config.supportAnchorHook : ''}
              onChange={e => updateNumeric('supportAnchorHook', e.target.value)}
              className="bbs-input"
            />
            <span className="bbs-input-hint">Anchorage hook leg into column support core</span>
          </div>

          <div className="bbs-form-group">
            <label>Top Continuous Hanger Bars</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="2"
                max="6"
                value={config.topHangerCount || 2}
                onChange={e => updateNumeric('topHangerCount', e.target.value)}
                className="bbs-input"
                title="Number of bars"
              />
              <select
                value={config.topHangerDia || 12}
                onChange={e => updateNumeric('topHangerDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
            </div>
            <span className="bbs-input-hint">Continuous top hanger bars</span>
          </div>

          <div className="bbs-form-group">
            <label>Left Support Extra Top Bars</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="0"
                max="6"
                value={config.topExtraLeftCount !== undefined ? config.topExtraLeftCount : 2}
                onChange={e => updateNumeric('topExtraLeftCount', e.target.value)}
                className="bbs-input"
              />
              <select
                value={config.topExtraLeftDia || 16}
                onChange={e => updateNumeric('topExtraLeftDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.filter(d => d >= 12).map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
            </div>
            <span className="bbs-input-hint">Curtailment L/3 over left column</span>
          </div>

          <div className="bbs-form-group">
            <label>Right Support Extra Top Bars</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="0"
                max="6"
                value={config.topExtraRightCount !== undefined ? config.topExtraRightCount : 2}
                onChange={e => updateNumeric('topExtraRightCount', e.target.value)}
                className="bbs-input"
              />
              <select
                value={config.topExtraRightDia || 16}
                onChange={e => updateNumeric('topExtraRightDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.filter(d => d >= 12).map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
            </div>
            <span className="bbs-input-hint">Curtailment L/3 over right column</span>
          </div>
          <div className="bbs-form-group">
            <label>Support Curtailment Extent</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.curtailmentFraction || 0.33}
                onChange={e => updateNumeric('curtailmentFraction', e.target.value)}
                className="bbs-select"
              >
                <option value={0.33}>L/3 (0.33 × Clear Span)</option>
                <option value={0.25}>L/4 (0.25 × Clear Span)</option>
                <option value={0.30}>0.30 × Clear Span</option>
              </select>
            </div>
            <span className="bbs-input-hint">Designer-controlled negative moment curtailment extent</span>
          </div>
        </div>
      </div>

      {/* CARD 3: Shear Stirrups */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <ShieldCheck size={16} className="bbs-card-icon" />
          <span>3. Shear Stirrups & Crack Control</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Stirrup Diameter</label>
            <select
              value={config.stirrupDia || 8}
              onChange={e => updateNumeric('stirrupDia', e.target.value)}
              className="bbs-select"
            >
              {[8, 10, 12].map(d => (
                <option key={d} value={d}>Ø{d} mm (Two-legged closed tie)</option>
              ))}
            </select>
          </div>

          <div className="bbs-form-group">
            <label>Support Zone Spacing</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="50"
                max="200"
                step="25"
                value={config.supportSpacing || 100}
                onChange={e => updateNumeric('supportSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Dense spacing near column supports (2D zone)</span>
          </div>

          <div className="bbs-form-group">
            <label>Midspan Spacing</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="100"
                max="300"
                step="25"
                value={config.midspanSpacing || 150}
                onChange={e => updateNumeric('midspanSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Central span spacing</span>
          </div>

          <div className="bbs-form-group">
            <label>Side Face Reinforcement (IS 456 Cl. 26.5.1.6)</label>
            <div className="bbs-checkbox-row">
              <input
                type="checkbox"
                id="includeSideFaceBars"
                checked={!!config.includeSideFaceBars}
                onChange={e => updateField('includeSideFaceBars', e.target.checked)}
              />
              <label htmlFor="includeSideFaceBars">Provide Side Face Rebar (Required if D &gt; 750 mm)</label>
            </div>
            {config.includeSideFaceBars && (
              <div className="bbs-input-inline-pair" style={{ marginTop: '8px' }}>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={config.sideFaceCountPerFace || 1}
                  onChange={e => updateNumeric('sideFaceCountPerFace', e.target.value)}
                  className="bbs-input"
                  title="Bars per face"
                />
                <select
                  value={config.sideFaceDia || 12}
                  onChange={e => updateNumeric('sideFaceDia', e.target.value)}
                  className="bbs-select"
                >
                  {[10, 12, 16, 20].map(d => (
                    <option key={d} value={d}>Ø{d} mm</option>
                  ))}
                </select>
              </div>
            )}
            <span className="bbs-input-hint">
              {config.D > 750
                ? `Min 0.1% web area = ${Math.round(0.001 * (config.b || 250) * config.D)} mm² required across two faces`
                : 'Optional crack control steel for beams with depth <= 750mm'}
            </span>
          </div>
        </div>

        {validation.warnings && validation.warnings.length > 0 && (
          <div className="bbs-validation-alert">
            {validation.warnings.map((w, i) => (
              <p key={i}>⚠ {w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

