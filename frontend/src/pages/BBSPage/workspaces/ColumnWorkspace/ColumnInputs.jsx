import React from 'react';
import { Layers, ShieldCheck, Ruler, ArrowDownUp } from 'lucide-react';

const COMMON_DIAMETERS = [8, 10, 12, 16, 20, 25, 32, 40];

export default function ColumnInputs({
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
      {/* CARD 1: Concrete Profile & Dimensions */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Ruler size={16} className="bbs-card-icon" />
          <span>1. Concrete Dimensions & Cover</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Width B (mm)</label>
            <input
              type="number"
              min="150"
              step="25"
              value={config.B || 300}
              onChange={e => updateNumeric('B', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Depth D (mm)</label>
            <input
              type="number"
              min="150"
              step="25"
              value={config.D || 450}
              onChange={e => updateNumeric('D', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Clear Story Height (mm)</label>
            <input
              type="number"
              min="1000"
              step="50"
              value={config.H_clear || 3000}
              onChange={e => updateNumeric('H_clear', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Beam Depth Above (mm)</label>
            <input
              type="number"
              min="0"
              step="25"
              value={config.D_beam || 450}
              onChange={e => updateNumeric('D_beam', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Clear Concrete Cover (mm)</label>
            <input
              type="number"
              min="20"
              max="75"
              step="5"
              value={config.cover || 40}
              onChange={e => updateNumeric('cover', e.target.value)}
              className="bbs-input"
            />
            <span className="bbs-input-hint">IS 456 Table 16 nominal default: 40 mm</span>
          </div>

          <div className="bbs-form-group">
            <label>Calculation Rule Model</label>
            <select
              value={config.ruleSetId || 'RULE_SET_CENTERLINE_EXACT'}
              onChange={e => updateField('ruleSetId', e.target.value)}
              className="bbs-select"
            >
              <option value="RULE_SET_CENTERLINE_EXACT">True Centerline (Exact Geometry)</option>
              <option value="RULE_SET_IS_PRACTICE">IS Practice (Trade Bend Deductions)</option>
            </select>
          </div>
        </div>
      </div>

      {/* CARD 2: Longitudinal Vertical Reinforcement */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Layers size={16} className="bbs-card-icon" />
          <span>2. Longitudinal Rebar Groups</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Corner Bars (Fixed 4 pcs)</label>
            <select
              value={config.cornerDia || 20}
              onChange={e => updateNumeric('cornerDia', e.target.value)}
              className="bbs-select"
            >
              {COMMON_DIAMETERS.filter(d => d >= 12).map(d => (
                <option key={d} value={d}>4 × Ø{d} mm (Corners)</option>
              ))}
            </select>
          </div>

          <div className="bbs-form-group">
            <label>Face-X Bars (Along Depth D)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="0"
                max="8"
                value={config.faceXCount !== undefined ? config.faceXCount : 2}
                onChange={e => updateNumeric('faceXCount', e.target.value)}
                className="bbs-input"
                title="Number of bars per depth face (2 faces = 2x)"
              />
              <select
                value={config.faceXDia || 16}
                onChange={e => updateNumeric('faceXDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.filter(d => d >= 12).map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
            </div>
            <span className="bbs-input-hint">{Number(config.faceXCount || 0) * 2} bars total on 2 depth faces</span>
          </div>

          <div className="bbs-form-group">
            <label>Face-Y Bars (Along Width B)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="0"
                max="8"
                value={config.faceYCount !== undefined ? config.faceYCount : 0}
                onChange={e => updateNumeric('faceYCount', e.target.value)}
                className="bbs-input"
                title="Number of bars per width face (2 faces = 2x)"
              />
              <select
                value={config.faceYDia || 16}
                onChange={e => updateNumeric('faceYDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.filter(d => d >= 12).map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
            </div>
            <span className="bbs-input-hint">{Number(config.faceYCount || 0) * 2} bars total on 2 width faces</span>
          </div>

          <div className="bbs-form-group">
            <label>Boundary Story Condition</label>
            <select
              value={config.boundaryCondition || 'INTERMEDIATE'}
              onChange={e => updateField('boundaryCondition', e.target.value)}
              className="bbs-select"
            >
              <option value="INTERMEDIATE">Intermediate Floor (Story Lift + Lap)</option>
              <option value="STARTER">Foundation Starter Dowel (Footing Hook)</option>
              <option value="ROOF">Roof Terminal Lift (90° Anchorage Hook)</option>
            </select>
          </div>

          {config.boundaryCondition === 'STARTER' && (
            <>
              <div className="bbs-form-group">
                <label>Footing Embedment Depth (mm)</label>
                <input
                  type="number"
                  min="200"
                  step="25"
                  value={config.starterEmbedmentDepth !== undefined ? config.starterEmbedmentDepth : 450}
                  onChange={e => updateNumeric('starterEmbedmentDepth', e.target.value)}
                  className="bbs-input"
                />
                <span className="bbs-input-hint">Designer input: Verify against footing depth & L_d</span>
              </div>
              <div className="bbs-form-group">
                <label>Footing 90° Hook Foot (mm)</label>
                <input
                  type="number"
                  min="200"
                  step="25"
                  placeholder={`Default: ${Math.max(300, 12 * (config.cornerDia || 20))} mm`}
                  value={config.starterBendFoot !== undefined && config.starterBendFoot !== null ? config.starterBendFoot : ''}
                  onChange={e => updateNumeric('starterBendFoot', e.target.value)}
                  className="bbs-input"
                />
                <span className="bbs-input-hint">Horizontal foot anchored onto footing bottom mesh</span>
              </div>
            </>
          )}

          {config.boundaryCondition === 'ROOF' && (
            <div className="bbs-form-group">
              <label>Roof 90° Anchorage Hook (mm)</label>
              <input
                type="number"
                min="200"
                step="25"
                placeholder={`Default: ${Math.max(300, 16 * (config.cornerDia || 20))} mm`}
                value={config.roofAnchorageLeg !== undefined && config.roofAnchorageLeg !== null ? config.roofAnchorageLeg : ''}
                onChange={e => updateNumeric('roofAnchorageLeg', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-hint">Anchorage leg into roof beam/slab node</span>
            </div>
          )}

          {config.boundaryCondition === 'INTERMEDIATE' && (
            <>
              <div className="bbs-form-group">
                <label>Lap Splice Specification</label>
                <div className="bbs-input-inline-pair">
                  <select
                    value={config.lapMode || 'MULTIPLIER'}
                    onChange={e => updateField('lapMode', e.target.value)}
                    className="bbs-select"
                  >
                    <option value="MULTIPLIER">Bar Multiplier (kd)</option>
                    <option value="EXPLICIT">Exact Length (mm)</option>
                  </select>
                  {config.lapMode === 'EXPLICIT' ? (
                    <input
                      type="number"
                      min="300"
                      step="50"
                      value={config.explicitLapLength || 1000}
                      onChange={e => updateNumeric('explicitLapLength', e.target.value)}
                      className="bbs-input"
                    />
                  ) : (
                    <input
                      type="number"
                      min="30"
                      max="75"
                      step="5"
                      value={config.lapMultiplier || 50}
                      onChange={e => updateNumeric('lapMultiplier', e.target.value)}
                      className="bbs-input"
                      title="e.g. 50d"
                    />
                  )}
                </div>
                <span className="bbs-input-hint">Designer-controlled lap value</span>
              </div>

              <div className="bbs-form-group">
                <label>Lap Staggering (IS 13920 Cl. 7.5.1)</label>
                <div className="bbs-checkbox-row">
                  <input
                    type="checkbox"
                    id="staggerLaps"
                    checked={!!config.staggerLaps}
                    onChange={e => updateField('staggerLaps', e.target.checked)}
                  />
                  <label htmlFor="staggerLaps">Stagger 50% splices (+{config.staggerOffsetMm || 750}mm)</label>
                </div>
                {config.staggerLaps && (
                  <input
                    type="number"
                    min="300"
                    step="50"
                    value={config.staggerOffsetMm || 750}
                    onChange={e => updateNumeric('staggerOffsetMm', e.target.value)}
                    className="bbs-input"
                    style={{ marginTop: '6px' }}
                    title="Stagger vertical offset (mm)"
                  />
                )}
                <span className="bbs-input-hint">Alternates splice levels to avoid 100% lap at one section</span>
              </div>
            </>
          )}

          <div className="bbs-form-group">
            <label>Size Reduction Crank</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="0"
                step="25"
                placeholder="Offset Δ (mm)"
                value={config.crankOffset || 0}
                onChange={e => updateNumeric('crankOffset', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">1:6 Slope</span>
            </div>
            <span className="bbs-input-hint">Offset for column reduction at floor above</span>
          </div>
        </div>
      </div>

      {/* CARD 3: Lateral Ties & Confinement Zones */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <ShieldCheck size={16} className="bbs-card-icon" />
          <span>3. Lateral Ties & Confinement Zones</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Tie Diameter (mm)</label>
            <select
              value={config.tieDia || 8}
              onChange={e => updateNumeric('tieDia', e.target.value)}
              className="bbs-select"
            >
              {[8, 10, 12].map(d => (
                <option key={d} value={d}>Ø{d} mm</option>
              ))}
            </select>
          </div>

          <div className="bbs-form-group">
            <label>Confinement Zone Spacing (S_conf)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="50"
                max="200"
                step="25"
                value={config.confinementSpacing || 100}
                onChange={e => updateNumeric('confinementSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">At top & bottom L_o zones (default: 100 mm)</span>
          </div>

          <div className="bbs-form-group">
            <label>Middle Zone Spacing (S_mid)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="100"
                max="300"
                step="25"
                value={config.middleSpacing || 150}
                onChange={e => updateNumeric('middleSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Central story region</span>
          </div>

          <div className="bbs-form-group">
            <label>Confinement Height L_o (mm)</label>
            <input
              type="number"
              min="300"
              step="50"
              placeholder={`Auto: ${validation.Lo || 500} mm`}
              value={config.customConfinementHeight || ''}
              onChange={e => updateNumeric('customConfinementHeight', e.target.value)}
              className="bbs-input"
            />
            <span className="bbs-input-hint">Auto (IS 13920): max(B, D, H/6, 450) = {validation.Lo || 500} mm</span>
          </div>

          <div className="bbs-form-group">
            <label>Internal Link Configuration</label>
            <select
              value={config.linkConfig || 'DIAMOND'}
              onChange={e => updateField('linkConfig', e.target.value)}
              className="bbs-select"
            >
              <option value="OUTER">Outer Perimeter Stirrup Only</option>
              <option value="DIAMOND">Outer Stirrup + Inner Diamond Tie</option>
              <option value="CROSS">Outer Stirrup + Cross-Tie Links</option>
            </select>
          </div>

          <div className="bbs-form-group">
            <label>Beam-Column Joint Ties</label>
            <div className="bbs-checkbox-row">
              <input
                type="checkbox"
                id="jointTies"
                checked={!!config.includeJointTies}
                onChange={e => updateField('includeJointTies', e.target.checked)}
              />
              <label htmlFor="jointTies">Continue ties through beam depth ({config.D_beam || 450} mm)</label>
            </div>
          </div>
        </div>

        {/* Validation Warnings */}
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

