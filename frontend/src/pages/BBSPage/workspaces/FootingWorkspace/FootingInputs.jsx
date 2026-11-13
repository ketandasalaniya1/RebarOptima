import React from 'react';
import { Ruler, Layers, ShieldCheck } from 'lucide-react';

const COMMON_DIAMETERS = [10, 12, 16, 20, 25];

export default function FootingInputs({
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

  const defaultHook = Math.max(100, (config.D || 500) - (2 * (config.cover || 50)));

  return (
    <div className="bbs-workspace-inputs-grid">
      {/* CARD 1: Footing Pad Geometry */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Ruler size={16} className="bbs-card-icon" />
          <span>1. Footing Pad Dimensions</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Length L (mm)</label>
            <input
              type="number"
              min="1000"
              step="100"
              value={config.L || 2000}
              onChange={e => updateNumeric('L', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Width B (mm)</label>
            <input
              type="number"
              min="1000"
              step="100"
              value={config.B || 2000}
              onChange={e => updateNumeric('B', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Pad Depth D (mm)</label>
            <input
              type="number"
              min="300"
              step="50"
              value={config.D || 500}
              onChange={e => updateNumeric('D', e.target.value)}
              className="bbs-input"
            />
          </div>

          <div className="bbs-form-group">
            <label>Clear Cover (mm)</label>
            <input
              type="number"
              min="40"
              max="75"
              step="5"
              value={config.cover || 50}
              onChange={e => updateNumeric('cover', e.target.value)}
              className="bbs-input"
            />
            <span className="bbs-input-hint">IS 456 Table 16: 50 mm against earth</span>
          </div>

          <div className="bbs-form-group">
            <label>Pedestal Dimensions (mm)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="200"
                step="50"
                value={config.pL || 400}
                onChange={e => updateNumeric('pL', e.target.value)}
                className="bbs-input"
                title="Pedestal Length"
              />
              <input
                type="number"
                min="200"
                step="50"
                value={config.pB || 400}
                onChange={e => updateNumeric('pB', e.target.value)}
                className="bbs-input"
                title="Pedestal Width"
              />
            </div>
            <span className="bbs-input-hint">Pedestal L × B on top of pad</span>
          </div>
        </div>
      </div>

      {/* CARD 2: Bottom Reinforcement Meshes */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <Layers size={16} className="bbs-card-icon" />
          <span>2. Bottom Reinforcement Meshes</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Bottom Mesh-X (Along Length L)</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.meshXDia || 12}
                onChange={e => updateNumeric('meshXDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
              <input
                type="number"
                min="100"
                max="250"
                step="25"
                placeholder="Spacing"
                value={config.meshXSpacing || 150}
                onChange={e => updateNumeric('meshXSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">U-bar mesh along Length L</span>
          </div>

          <div className="bbs-form-group">
            <label>Mesh-X Upturned Hook Leg (mm)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="100"
                step="25"
                value={config.meshXHookLeg !== undefined && config.meshXHookLeg !== null ? config.meshXHookLeg : defaultHook}
                onChange={e => updateNumeric('meshXHookLeg', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm</span>
            </div>
            <span className="bbs-input-hint">Default: D - 2×Cover = {defaultHook} mm (Site std: 150–300 mm)</span>
          </div>

          <div className="bbs-form-group">
            <label>Bottom Mesh-Y (Along Width B)</label>
            <div className="bbs-input-inline-pair">
              <select
                value={config.meshYDia || 12}
                onChange={e => updateNumeric('meshYDia', e.target.value)}
                className="bbs-select"
              >
                {COMMON_DIAMETERS.map(d => (
                  <option key={d} value={d}>Ø{d} mm</option>
                ))}
              </select>
              <input
                type="number"
                min="100"
                max="250"
                step="25"
                placeholder="Spacing"
                value={config.meshYSpacing || 150}
                onChange={e => updateNumeric('meshYSpacing', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm c/c</span>
            </div>
            <span className="bbs-input-hint">Transverse U-bar mesh along Width B</span>
          </div>

          <div className="bbs-form-group">
            <label>Mesh-Y Upturned Hook Leg (mm)</label>
            <div className="bbs-input-inline-pair">
              <input
                type="number"
                min="100"
                step="25"
                value={config.meshYHookLeg !== undefined && config.meshYHookLeg !== null ? config.meshYHookLeg : defaultHook}
                onChange={e => updateNumeric('meshYHookLeg', e.target.value)}
                className="bbs-input"
              />
              <span className="bbs-input-unit-label">mm</span>
            </div>
            <span className="bbs-input-hint">Default: D - 2×Cover = {defaultHook} mm</span>
          </div>
        </div>
      </div>

      {/* CARD 3: Column Starter Dowels */}
      <div className="bbs-input-card">
        <div className="bbs-input-card-title">
          <ShieldCheck size={16} className="bbs-card-icon" />
          <span>3. Column Starter Dowels</span>
        </div>
        <div className="bbs-form-grid">
          <div className="bbs-form-group">
            <label>Include Column Starter Dowels</label>
            <div className="bbs-checkbox-row">
              <input
                type="checkbox"
                id="dowels"
                checked={config.includeStarterDowels !== false}
                onChange={e => updateField('includeStarterDowels', e.target.checked)}
              />
              <label htmlFor="dowels">Anchor starter dowels into footing pad</label>
            </div>
          </div>

          {config.includeStarterDowels !== false && (
            <>
              <div className="bbs-form-group">
                <label>Dowel Bar Diameter & Count</label>
                <div className="bbs-input-inline-pair">
                  <input
                    type="number"
                    min="4"
                    max="16"
                    value={config.dowelCount || 8}
                    onChange={e => updateNumeric('dowelCount', e.target.value)}
                    className="bbs-input"
                    title="Number of dowel bars"
                  />
                  <select
                    value={config.dowelDia || 16}
                    onChange={e => updateNumeric('dowelDia', e.target.value)}
                    className="bbs-select"
                  >
                    {[12, 16, 20, 25, 32].map(d => (
                      <option key={d} value={d}>Ø{d} mm</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bbs-form-group">
                <label>Footing Foot Bend (90° hook)</label>
                <div className="bbs-input-inline-pair">
                  <input
                    type="number"
                    min="200"
                    step="50"
                    value={config.dowelFootingHook || 300}
                    onChange={e => updateNumeric('dowelFootingHook', e.target.value)}
                    className="bbs-input"
                  />
                  <span className="bbs-input-unit-label">mm</span>
                </div>
                <span className="bbs-input-hint">Horizontal anchorage leg on bottom mesh</span>
              </div>

              <div className="bbs-form-group">
                <label>Lap Extension Above Pad</label>
                <div className="bbs-input-inline-pair">
                  <input
                    type="number"
                    min="400"
                    step="50"
                    value={config.dowelLapExtension || 800}
                    onChange={e => updateNumeric('dowelLapExtension', e.target.value)}
                    className="bbs-input"
                  />
                  <span className="bbs-input-unit-label">mm</span>
                </div>
                <span className="bbs-input-hint">Vertical projection for column splice (≥ 40d)</span>
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
