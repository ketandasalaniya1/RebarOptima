import React from 'react';
import { Ruler, Layers, ShieldCheck } from 'lucide-react';

const COMMON_DIAMETERS = [8, 10, 12, 16, 20, 25];

export default function RetainingWallInputs({
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
      {/* CARD 1: Wall & Base Geometry */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Ruler size={16} className="bbs-card-icon" />
          <span>1. Retaining Wall Dimensions</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Stem Height H_stem (mm)</label>
            <input
              type="number"
              min="1500"
              step="100"
              value={config.H_stem || 3500}
              onChange={e => updateNumeric('H_stem', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Base Slab Total Width B (mm)</label>
            <input
              type="number"
              min="1200"
              step="100"
              value={config.B_base || 2500}
              onChange={e => updateNumeric('B_base', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Base Slab Thickness (mm)</label>
            <input
              type="number"
              min="250"
              step="50"
              value={config.t_base || 450}
              onChange={e => updateNumeric('t_base', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Stem Thickness (Top / Bottom mm)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="150"
                step="25"
                value={config.t_top || 250}
                onChange={e => updateNumeric('t_top', e.target.value)}
                className="bbs-input"
                title="Stem Top Thickness"
              />
              <input
                type="number"
                min="200"
                step="25"
                value={config.t_bot || 400}
                onChange={e => updateNumeric('t_bot', e.target.value)}
                className="bbs-input"
                title="Stem Bottom Thickness"
              />
            </div>
            <span className="bbs-input-hint">Top thickness / Base thickness of stem</span>
          </div>

          <div className="bbs-form-group">
            <label>Running Wall Segment Length (mm)</label>
            <input
              type="number"
              min="1000"
              step="500"
              value={config.L_wall || 5000}
              onChange={e => updateNumeric('L_wall', e.target.value)}
              className="bbs-input"
            />
            <span className="bbs-input-hint">Length along wall run (Stock bar limit: 12000 mm)</span>
          </div>
        </div>
      </div>

      {/* CARD 2: Stem Reinforcement */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Layers size={16} className="bbs-card-icon" />
          <span>2. Stem Vertical & Horizontal Steel</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Inner Earth Face Main Vertical Steel</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.stemMainDia || 16}
                onChange={e => updateNumeric('stemMainDia', e.target.value)}
                className="bbs-select"
              >
                {[12, 16, 20, 25].map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
              <input
                type="number"
                min="100"
                max="250"
                step="25"
                placeholder="Spacing"
                value={config.stemMainSpacing || 150}
                onChange={e => updateNumeric('stemMainSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Main cantilever tension bars on earth face</span>
          </div>

          <div className="bbs-form-group">
            <label>Heel Anchorage Leg Length (mm)</label>
            <input
              type="number"
              min="500"
              step="50"
              value={config.heelAnchorLength || 1000}
              onChange={e => updateNumeric('heelAnchorLength', e.target.value)}
              className="bbs-input"
            />
            <span className="bbs-input-hint">Horizontal anchorage leg extending into base heel</span>
          </div>

          <div className="bbs-form-group">
            <label>Outer Face Nominal Vertical Steel</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.stemOuterDia || 10}
                onChange={e => updateNumeric('stemOuterDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
              <input
                type="number"
                min="150"
                max="300"
                step="25"
                value={config.stemOuterSpacing || 200}
                onChange={e => updateNumeric('stemOuterSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
          </div>

          <div className="bbs-form-group">
            <label>Horizontal Distribution Steel (Both Faces)</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.stemHorizDia || 8}
                onChange={e => updateNumeric('stemHorizDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
              <input
                type="number"
                min="150"
                max="300"
                step="25"
                value={config.stemHorizSpacing || 200}
                onChange={e => updateNumeric('stemHorizSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Shrinkage & temperature web rebar (IS 456 Cl 26.5.2.2)</span>
          </div>
        </div>
      </div>

      {/* CARD 3: Base Slab Reinforcement */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <ShieldCheck size={16} className="bbs-card-icon" />
          <span>3. Base Slab Reinforcement</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Heel Top Tension Steel</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.heelTopDia || 16}
                onChange={e => updateNumeric('heelTopDia', e.target.value)}
                className="bbs-select"
              >
                {[12, 16, 20, 25].map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
              <input
                type="number"
                min="100"
                max="250"
                step="25"
                value={config.heelTopSpacing || 150}
                onChange={e => updateNumeric('heelTopSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Resisting soil backfill overburden weight</span>
          </div>

          <div className="bbs-form-group">
            <label>Toe Bottom Steel</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.toeBottomDia || 12}
                onChange={e => updateNumeric('toeBottomDia', e.target.value)}
                className="bbs-select"
              >
                {[10, 12, 16, 20].map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
              <input
                type="number"
                min="100"
                max="250"
                step="25"
                value={config.toeBottomSpacing || 150}
                onChange={e => updateNumeric('toeBottomSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Resisting upward soil bearing pressure</span>
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
