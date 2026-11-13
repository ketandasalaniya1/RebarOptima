import React from 'react';
import { Ruler, Layers, ShieldCheck } from 'lucide-react';

const COMMON_DIAMETERS = [8, 10, 12, 16];

export default function SlabInputs({
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
      {/* CARD 1: Slab Geometry */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Ruler size={16} className="bbs-card-icon" />
          <span>1. Slab Panel Dimensions</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Shorter Span Lx (mm)</label>
            <input
              type="number"
              min="1000"
              step="100"
              value={config.Lx || 3000}
              onChange={e => updateNumeric('Lx', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Longer Span Ly (mm)</label>
            <input
              type="number"
              min="1000"
              step="100"
              value={config.Ly || 4500}
              onChange={e => updateNumeric('Ly', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Slab Thickness t (mm)</label>
            <input
              type="number"
              min="100"
              step="10"
              value={config.t || 150}
              onChange={e => updateNumeric('t', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Clear Cover (mm)</label>
            <input
              type="number"
              min="15"
              max="40"
              step="5"
              value={config.cover || 20}
              onChange={e => updateNumeric('cover', e.target.value)}
              className="bbs-input"
            />
            <span className="bbs-input-hint">IS 456 Table 16 default: 20 mm</span>
          </div>

          <div className="bbs-form-group">
            <label>Spanning Condition</label>
            <select
              value={config.spanningType || 'TWO_WAY'}
              onChange={e => updateField('spanningType', e.target.value)}
              className="bbs-select"
            >
              <option value="TWO_WAY">Two-Way Spanning (Ly/Lx ≤ 2.0)</option>
              <option value="ONE_WAY">One-Way Spanning (Ly/Lx &gt; 2.0)</option>
            </select>
          </div>

          <div className="bbs-form-group">
            <label>Support Edge Continuity</label>
            <select
              value={config.supportCondition || 'DISCONTINUOUS'}
              onChange={e => updateField('supportCondition', e.target.value)}
              className="bbs-select"
            >
              <option value="DISCONTINUOUS">Discontinuous (Spandrel Beam / Hooked Ends)</option>
              <option value="CONTINUOUS">Continuous (Interior Panel / Bars run through)</option>
            </select>
          </div>
        </div>
      </div>

      {/* CARD 2: Bottom Reinforcement */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Layers size={16} className="bbs-card-icon" />
          <span>2. Bottom Reinforcement Mesh</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Main Bottom Steel (Along Lx)</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.mainDia || 10}
                onChange={e => updateNumeric('mainDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
              <input
                type="number"
                min="75"
                max="300"
                step="25"
                placeholder="Spacing"
                value={config.mainSpacing || 150}
                onChange={e => updateNumeric('mainSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Main bars along shorter span Lx</span>
          </div>

          <div className="bbs-form-group">
            <label>Distribution / Secondary Steel (Along Ly)</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.distDia || 8}
                onChange={e => updateNumeric('distDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
              <input
                type="number"
                min="75"
                max="300"
                step="25"
                placeholder="Spacing"
                value={config.distSpacing || 150}
                onChange={e => updateNumeric('distSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Transverse bars along longer span Ly</span>
          </div>

          <div className="bbs-form-group">
            <label>Support Hook Legs (mm)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="0"
                step="25"
                placeholder="Main Hook"
                value={config.mainEndHook !== undefined ? config.mainEndHook : 100}
                onChange={e => updateNumeric('mainEndHook', e.target.value)}
                className="bbs-input"
                title="Main Rebar End Hook into Beam"
              />
              <input
                type="number"
                min="0"
                step="25"
                placeholder="Dist Hook"
                value={config.distEndHook !== undefined ? config.distEndHook : 100}
                onChange={e => updateNumeric('distEndHook', e.target.value)}
                className="bbs-input"
                title="Distribution Rebar End Hook into Beam"
              />
              <span className="bbs-input-unit-label">mm</span>
            </div>
            <span className="bbs-input-hint">90° anchorage hook at support edges (Main / Dist)</span>
          </div>

          <div className="bbs-form-group">
            <label>Cranked / Bent-up Bars Option</label>
            <div className="bbs-checkbox-row">
              <input
                type="checkbox"
                id="crankedBars"
                checked={!!config.useCrankedBars}
                onChange={e => updateField('useCrankedBars', e.target.checked)}
              />
              <label htmlFor="crankedBars">Alternate cranked bars into top zone</label>
            </div>
          </div>

          {config.useCrankedBars && (
            <div className="bbs-form-group">
              <label>Crank Angle (Geometry Multiplier)</label>
              <select
                value={config.crankAngle || 45}
                onChange={e => updateNumeric('crankAngle', e.target.value)}
                className="bbs-select"
              >
                <option value={45}>45° Crank (Addition = 0.42 × h)</option>
                <option value={30}>30° Crank (Addition = 0.27 × h)</option>
              </select>
              <span className="bbs-input-hint">h = Slab thickness - 2×Cover - Bar diameter</span>
            </div>
          )}
        </div>
      </div>

      {/* CARD 3: Top Negative Support Steel */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <ShieldCheck size={16} className="bbs-card-icon" />
          <span>3. Top Negative Support Reinforcement</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Support Negative Extra Bars</label>
            <div className="bbs-checkbox-row">
              <input
                type="checkbox"
                id="topExtras"
                checked={config.includeTopExtras !== false}
                onChange={e => updateField('includeTopExtras', e.target.checked)}
              />
              <label htmlFor="topExtras">Include top extra bars at support edges</label>
            </div>
          </div>

          {config.includeTopExtras !== false && (
            <>
              <div className="bbs-form-group">
                <label>Top Extra Bar Diameter</label>
                <select
                  value={config.topExtraDia || 8}
                  onChange={e => updateNumeric('topExtraDia', e.target.value)}
                  className="bbs-select"
                >
                  {COMMON_DIAMETERS.map(d => (
                    <option key={d} value={d}>Ø{d} mm</option>
                  ))}
                </select>
              </div>

              <div className="bbs-form-group">
                <label>Top Extra Bar Spacing</label>
                <div className="bbs-input-inline-pair">
                  <input
                    type="number"
                    min="100"
                    max="300"
                    step="25"
                    value={config.topExtraSpacing || 200}
                    onChange={e => updateNumeric('topExtraSpacing', e.target.value)}
                    className="bbs-input"
                  />
                  <span className="bbs-input-unit-label">mm c/c</span>
                </div>
                <span className="bbs-input-hint">Extends 0.25 × Lx into span</span>
              </div>

              <div className="bbs-form-group">
                <label>Top Support Anchor Hook Leg</label>
                <div className="bbs-input-inline-pair">
                  <input
                    type="number"
                    min="50"
                    max="200"
                    step="25"
                    value={config.topAnchorHook || 100}
                    onChange={e => updateNumeric('topAnchorHook', e.target.value)}
                    className="bbs-input"
                  />
                  <span className="bbs-input-unit-label">mm</span>
                </div>
                <span className="bbs-input-hint">Anchorage into supporting beam</span>
              </div>
            </>
          )}
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
