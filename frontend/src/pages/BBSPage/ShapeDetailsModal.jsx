import React, { useState, useMemo } from 'react';
import { calculateRebarShape } from './cad/calculationEngine';
import { engineeringRuleProvider } from './cad/engineeringRules';
import { validateRebarEngineering, VALIDATION_SEVERITY } from './cad/validationEngine';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Ruler,
  Info,
  Sliders,
  Calculator,
  ShieldCheck,
  History,
  Download,
  Copy,
  Archive,
  RotateCcw,
  Check,
  Pencil,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Shield,
  Tag,
  Calendar,
  User,
  Layers,
  Hash,
  Scale,
  GitBranch,
  RefreshCw,
  Clock
} from 'lucide-react';
import './ShapeDetailsModal.css';

export default function ShapeDetailsModal({
  shape,
  onClose,
  onOpenInCAD,
  onDuplicate,
  onNewVersion,
  onStatusChange,
  onArchive,
  onRestore
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'parameters' | 'calculation' | 'validation' | 'versions'
  const [showDimensions, setShowDimensions] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Interactive Parameter Playground (Local copy for live testing without mutating master definition)
  const initialParamValues = useMemo(() => {
    const vals = {};
    (shape.parameters || []).forEach(p => {
      vals[p.name] = p.value;
    });
    return vals;
  }, [shape]);

  const [playgroundParams, setPlaygroundParams] = useState(initialParamValues);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState(
    shape.calculationRules?.ruleSet || 'RULE_SET_CENTERLINE_EXACT'
  );

  const objects = shape.geometry?.objects || [];
  const primaryRebar = objects.find(o => o.type === 'rebar') || null;

  // Live calculation for playground parameters
  const liveCalculation = useMemo(() => {
    if (!primaryRebar) return null;
    const clonedParams = (shape.parameters || []).map(p => ({
      ...p,
      value: playgroundParams[p.name] !== undefined ? playgroundParams[p.name] : p.value
    }));
    return calculateRebarShape(primaryRebar, selectedRuleSetId, {
      unitSystem: 'METRIC_MM_KG'
    });
  }, [primaryRebar, shape.parameters, playgroundParams, selectedRuleSetId]);

  // Validation results
  const validationResult = useMemo(() => {
    if (!primaryRebar) return { isValid: true, errors: [], warnings: [] };
    const ruleSet = engineeringRuleProvider.getRuleSet(selectedRuleSetId);
    const results = validateRebarEngineering(primaryRebar, ruleSet);
    const errors = results.filter(r => r.severity === VALIDATION_SEVERITY.ERROR);
    const warnings = results.filter(r => r.severity === VALIDATION_SEVERITY.WARNING);
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      all: results
    };
  }, [primaryRebar, selectedRuleSetId]);

  // SVG dynamic bounding box calculation
  const bbox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(obj => {
      if (obj.type === 'line') {
        const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
        const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
        minX = Math.min(minX, p1.x, p2.x);
        maxX = Math.max(maxX, p1.x, p2.x);
        minY = Math.min(minY, -p1.y, -p2.y);
        maxY = Math.max(maxY, -p1.y, -p2.y);
      } else if (obj.type === 'rectangle') {
        const x = obj.x || 0;
        const y = -((obj.y || 0) + (obj.height || 0));
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + (obj.width || 0));
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + (obj.height || 0));
      } else if (obj.type === 'circle') {
        const cx = obj.center?.x || obj.cx || 0;
        const cy = -(obj.center?.y || obj.cy || 0);
        const r = obj.radius || 50;
        minX = Math.min(minX, cx - r);
        maxX = Math.max(maxX, cx + r);
        minY = Math.min(minY, cy - r);
        maxY = Math.max(maxY, cy + r);
      } else if (obj.type === 'rebar') {
        const pts = Array.isArray(obj.points)
          ? obj.points
          : Array.isArray(obj.centerline)
          ? obj.centerline
          : obj.centerline?.points || [];
        pts.forEach(p => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, -p.y);
          maxY = Math.max(maxY, -p.y);
        });
      }
    });

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      minX = -200; maxX = 200; minY = -150; maxY = 150;
    }

    const w = Math.max(80, maxX - minX);
    const h = Math.max(80, maxY - minY);
    const pad = Math.max(40, Math.max(w, h) * 0.25);

    return {
      x: minX - pad,
      y: minY - pad,
      w: w + pad * 2,
      h: h + pad * 2
    };
  }, [objects]);

  // Pan / Zoom handlers
  const handleMouseDown = (e) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPanOffset({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleZoom = (delta) => {
    setZoomLevel(prev => Math.max(0.3, Math.min(5.0, prev + delta)));
  };

  const handleResetView = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Export structured JSON
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(shape, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shape.code || shape.shapeCode || 'shape'}_${shape.name.replace(/\s+/g, '_')}_v${shape.version || '1.0'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isStandard = shape.ownership === 'STANDARD' || shape.isStandard;
  const isArchived = shape.status === 'ARCHIVED';
  const isDraft = shape.status === 'DRAFT';
  const isActive = shape.status === 'ACTIVE';

  return (
    <div className="shape-details-backdrop" onClick={onClose}>
      <div className="shape-details-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="shape-details-header">
          <div className="shape-header-main">
            <h2 className="shape-header-title">{shape.name}</h2>
            <div className="shape-header-badges-wrap">
              <span className={`shape-badge-code ${isStandard ? 'standard' : 'custom'}`}>
                {shape.code || shape.shapeCode || 'CUSTOM'}
              </span>
              <span className={`shape-badge-ownership ${isStandard ? 'standard' : 'custom'}`}>
                {isStandard ? 'STANDARD MASTER' : 'CUSTOM SHAPE'}
              </span>
              <span className={`shape-badge-status ${(shape.status || 'DRAFT').toLowerCase()}`}>
                <span className={`status-dot ${(shape.status || 'DRAFT').toLowerCase() === 'active' ? 'green' : 'amber'}`}></span>
                {shape.status || 'DRAFT'} (v{shape.version || '1.0'})
              </span>
            </div>
          </div>

          <button className="shape-header-close" onClick={onClose} title="Close (Esc)">
            <X size={20} />
          </button>
        </header>

        {/* Main Body (Left CAD Area + Right Tabbed Sidebar) */}
        <div className="shape-details-body">
          {/* Left Canvas Preview Area */}
          <div className="shape-details-canvas-area">
            {/* Blueprint Grid & Toolbar Controls */}
            <div className="shape-canvas-controls">
              <button className="shape-canvas-btn" onClick={() => handleZoom(0.2)} title="Zoom In">
                <ZoomIn size={14} />
                <span>Zoom</span>
              </button>
              <button className="shape-canvas-btn" onClick={() => handleZoom(-0.2)} title="Zoom Out">
                <ZoomOut size={14} />
                <span>Zoom</span>
              </button>
              <button className="shape-canvas-btn" onClick={handleResetView} title="Fit to View">
                <Maximize2 size={14} />
                <span>Fit</span>
              </button>
              <button
                className={`shape-canvas-btn ${showDimensions ? 'active' : ''}`}
                onClick={() => setShowDimensions(!showDimensions)}
                title="Toggle Dimensions Overlay"
              >
                <Ruler size={14} />
                <span>Dims</span>
              </button>
            </div>

            {/* SVG Render */}
            <svg
              className="shape-svg-viewport"
              viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`
              }}
            >
              <defs>
                <pattern id="cad-grid-pattern-modal" width="25" height="25" patternUnits="userSpaceOnUse">
                  <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(56, 189, 248, 0.05)" strokeWidth="1" />
                </pattern>
                <filter id="modal-rebar-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.4" />
                </filter>
              </defs>

              <rect x={bbox.x} y={bbox.y} width={bbox.w} height={bbox.h} fill="url(#cad-grid-pattern-modal)" />
              {/* Origin Grid axes */}
              <line x1={bbox.x} y1="0" x2={bbox.x + bbox.w} y2="0" stroke="rgba(51, 65, 85, 0.45)" strokeDasharray="4 4" strokeWidth="0.9" />
              <line x1="0" y1={bbox.y} x2="0" y2={bbox.y + bbox.h} stroke="rgba(51, 65, 85, 0.45)" strokeDasharray="4 4" strokeWidth="0.9" />

              {objects.map((obj, idx) => {
                if (obj.type === 'line') {
                  const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
                  const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
                  return (
                    <line
                      key={idx}
                      x1={p1.x}
                      y1={-p1.y}
                      x2={p2.x}
                      y2={-p2.y}
                      stroke="#38bdf8"
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                  );
                }
                if (obj.type === 'rectangle') {
                  return (
                    <rect
                      key={idx}
                      x={obj.x || 0}
                      y={-((obj.y || 0) + (obj.height || 0))}
                      width={obj.width || 0}
                      height={obj.height || 0}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={4}
                      rx="3"
                    />
                  );
                }
                if (obj.type === 'circle') {
                  return (
                    <circle
                      key={idx}
                      cx={obj.center?.x || obj.cx || 0}
                      cy={-(obj.center?.y || obj.cy || 0)}
                      r={obj.radius || 0}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={4}
                    />
                  );
                }
                if (obj.type === 'rebar') {
                  const pts = Array.isArray(obj.points)
                    ? obj.points
                    : Array.isArray(obj.centerline)
                    ? obj.centerline
                    : obj.centerline?.points || [];
                  const ptsStr = pts.map(p => `${p.x},${-p.y}`).join(' ');
                  const dia = playgroundParams.DIAMETER || obj.diameter || 16;
                  const strokeWidth = Math.max(4, Math.min(14, dia * 0.7));

                  return (
                    <g key={idx}>
                      <polyline
                        points={ptsStr}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#modal-rebar-glow)"
                      />
                      {/* Vertex indicators */}
                      {pts.map((p, pIdx) => (
                        <circle
                          key={pIdx}
                          cx={p.x}
                          cy={-p.y}
                          r={strokeWidth * 0.55}
                          fill="#ffffff"
                          stroke="#d97706"
                          strokeWidth={2}
                        />
                      ))}
                    </g>
                  );
                }
                return null;
              })}

              {/* Associative dimensions overlay */}
              {showDimensions && (shape.dimensions || []).map((dim, dIdx) => {
                if (!dim.p1 || !dim.p2) return null;
                const p1 = dim.p1;
                const p2 = dim.p2;
                const midX = (p1.x + p2.x) / 2;
                const midY = (-p1.y + -p2.y) / 2 - (dim.offset || 25);
                const displayVal = playgroundParams[dim.parameterName] || dim.value || '0';

                return (
                  <g key={`dim_${dIdx}`} opacity={0.9}>
                    <line x1={p1.x} y1={-p1.y} x2={p2.x} y2={-p2.y} stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="3 3" />
                    <rect x={midX - 25} y={midY - 10} width={50} height={20} fill="#090d16" stroke="#38bdf8" rx={4} />
                    <text x={midX} y={midY + 4} fill="#38bdf8" fontSize={11} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                      {displayVal}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right Tabbed Information & Inspection Panel */}
          <aside className="shape-details-sidebar">
            <div className="shape-details-tabs">
              <button
                className={`shape-details-tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <Info size={14} />
                <span>Overview</span>
              </button>
              <button
                className={`shape-details-tab ${activeTab === 'parameters' ? 'active' : ''}`}
                onClick={() => setActiveTab('parameters')}
              >
                <Sliders size={14} />
                <span>Parameters ({shape.parameters?.length || 0})</span>
              </button>
              <button
                className={`shape-details-tab ${activeTab === 'calculation' ? 'active' : ''}`}
                onClick={() => setActiveTab('calculation')}
              >
                <Calculator size={14} />
                <span>Calculation</span>
              </button>
              <button
                className={`shape-details-tab ${activeTab === 'validation' ? 'active' : ''}`}
                onClick={() => setActiveTab('validation')}
              >
                <ShieldCheck size={14} />
                <span>Validation</span>
                {validationResult.errors.length > 0 && <span className="tab-pill-badge error">{validationResult.errors.length}</span>}
              </button>
              <button
                className={`shape-details-tab ${activeTab === 'versions' ? 'active' : ''}`}
                onClick={() => setActiveTab('versions')}
              >
                <History size={14} />
                <span>Versions</span>
              </button>
            </div>

            <div className="shape-tab-content">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="tab-pane-content">
                  <div className="shape-desc-box">
                    <div className="shape-info-label">Description</div>
                    <p className="shape-desc-text">
                      {shape.description || 'Standard compliant parametric rebar shape definition with automated developed length & bend deductions.'}
                    </p>
                    <div className="shape-tags-list">
                      {(shape.tags || ['rebar', 'parametric']).map((tag, tIdx) => (
                        <span key={tIdx} className="shape-tag-pill">#{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div className="shape-info-grid">
                    <div className="shape-info-card">
                      <div className="shape-info-label">Category</div>
                      <div className="shape-info-val">{shape.category || 'Custom'}</div>
                    </div>
                    <div className="shape-info-card">
                      <div className="shape-info-label">Unit System</div>
                      <div className="shape-info-val">{shape.unit || 'mm'} (Metric)</div>
                    </div>
                    <div className="shape-info-card">
                      <div className="shape-info-label">Current Version</div>
                      <div className="shape-info-val font-mono">v{shape.version || '1.0'}</div>
                    </div>
                    <div className="shape-info-card">
                      <div className="shape-info-label">Usage Count</div>
                      <div className="shape-info-val">{shape.metadata?.usageCount || 0} members</div>
                    </div>
                    <div className="shape-info-card">
                      <div className="shape-info-label">Created By</div>
                      <div className="shape-info-val text-muted">{shape.createdBy || 'System'}</div>
                    </div>
                    <div className="shape-info-card">
                      <div className="shape-info-label">Last Updated</div>
                      <div className="shape-info-val text-muted">
                        {new Date(shape.updatedAt || shape.createdAt || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {liveCalculation && (
                    <div className="shape-calc-summary-card">
                      <div className="shape-calc-summary-title">
                        <Calculator size={14} />
                        <span>Nominal Engineering Output</span>
                      </div>
                      <div className="shape-calc-summary-rows">
                        <div className="shape-calc-row">
                          <span className="label">Developed Length:</span>
                          <strong className="val font-mono">{liveCalculation.developedLength} mm</strong>
                        </div>
                        <div className="shape-calc-row">
                          <span className="label">Cutting Length:</span>
                          <strong className="val font-mono text-cyan">{liveCalculation.cuttingLength} mm</strong>
                        </div>
                        <div className="shape-calc-row">
                          <span className="label">Unit Steel Weight:</span>
                          <strong className="val font-mono text-emerald">{liveCalculation.totalWeight.toFixed(3)} kg</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PARAMETERS PLAYGROUND */}
              {activeTab === 'parameters' && (
                <div className="tab-pane-content">
                  <div className="shape-helper-notice">
                    <Sparkles size={14} className="text-amber" />
                    <span><strong>Parameter Playground:</strong> Adjust parameter values below to test geometry and live calculations in real time without modifying the master shape.</span>
                  </div>

                  {(shape.parameters || []).length === 0 ? (
                    <div className="shape-pane-empty">
                      No parametric variables defined on this shape.
                    </div>
                  ) : (
                    <div className="shape-params-list">
                      {(shape.parameters || []).map((param, pIdx) => {
                        const curVal = playgroundParams[param.name] !== undefined ? playgroundParams[param.name] : param.value;
                        return (
                          <div key={pIdx} className="shape-param-row">
                            <div className="shape-param-meta">
                              <span className="shape-param-name">{param.name}</span>
                              <span className="shape-param-display">{param.displayName || param.name} ({param.unit || 'mm'})</span>
                            </div>
                            <input
                              type="number"
                              className="shape-param-input"
                              value={curVal}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setPlaygroundParams(prev => ({ ...prev, [param.name]: val }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    className="shape-btn shape-btn-secondary w-full"
                    style={{ marginTop: '12px' }}
                    onClick={() => setPlaygroundParams(initialParamValues)}
                  >
                    <RefreshCw size={13} />
                    <span>Reset Playground Values</span>
                  </button>
                </div>
              )}

              {/* TAB 3: CALCULATION ENGINE */}
              {activeTab === 'calculation' && (
                <div className="tab-pane-content">
                  <div className="shape-form-group">
                    <label className="shape-info-label">Engineering Calculation Standard</label>
                    <select
                      className="cad-rule-select"
                      value={selectedRuleSetId}
                      onChange={(e) => setSelectedRuleSetId(e.target.value)}
                    >
                      {engineeringRuleProvider.getAllRuleSets().map(rs => (
                        <option key={rs.id} value={rs.id}>{rs.name} ({rs.standardCode})</option>
                      ))}
                    </select>
                  </div>

                  {liveCalculation ? (
                    <div className="shape-calc-details-wrap">
                      <div className="shape-info-grid">
                        <div className="shape-info-card">
                          <div className="shape-info-label">Cutting Length</div>
                          <div className="shape-info-val text-cyan font-mono">{liveCalculation.cuttingLength} mm</div>
                        </div>
                        <div className="shape-info-card">
                          <div className="shape-info-label">Developed Length</div>
                          <div className="shape-info-val font-mono">{liveCalculation.developedLength} mm</div>
                        </div>
                        <div className="shape-info-card">
                          <div className="shape-info-label">Unit Weight</div>
                          <div className="shape-info-val font-mono">{liveCalculation.unitWeight.toFixed(3)} kg/m</div>
                        </div>
                        <div className="shape-info-card">
                          <div className="shape-info-label">Total Weight</div>
                          <div className="shape-info-val text-emerald font-mono">{liveCalculation.totalWeight.toFixed(3)} kg</div>
                        </div>
                      </div>

                      <div className="shape-desc-box">
                        <div className="shape-info-label">Bend Deductions & Hook Breakdown</div>
                        <div className="shape-breakdown-list">
                          <div className="shape-breakdown-row">
                            <span>Total Bends:</span>
                            <strong>{liveCalculation.breakdown?.bends?.length || 0}</strong>
                          </div>
                          <div className="shape-breakdown-row">
                            <span>Total Deductions:</span>
                            <strong className="font-mono">{liveCalculation.breakdown?.totalBendDeduction || 0} mm</strong>
                          </div>
                          <div className="shape-breakdown-row">
                            <span>Hooks Total Extension:</span>
                            <strong className="font-mono">{liveCalculation.breakdown?.totalHookExtension || 0} mm</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="shape-pane-empty">
                      No active rebar calculation available for this shape.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: VALIDATION CHECKLIST */}
              {activeTab === 'validation' && (
                <div className="tab-pane-content">
                  <div className="shape-validation-banner">
                    <span className={`shape-badge-status ${validationResult.errors.length === 0 ? 'active' : 'draft'}`}>
                      {validationResult.errors.length === 0 ? (
                        <>
                          <CheckCircle2 size={13} />
                          <span>ENGINEERING VALIDATION PASSED</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={13} />
                          <span>VALIDATION WARNINGS / ERRORS</span>
                        </>
                      )}
                    </span>
                  </div>

                  {validationResult.errors.length === 0 && validationResult.warnings.length === 0 ? (
                    <div className="shape-val-item pass">
                      <div className="shape-val-info">
                        <div className="shape-val-title">All Geometry & Standard Rules Valid</div>
                        <div className="shape-val-sub">Bend radii, diameters, angle limits, and segment continuity comply with standard code.</div>
                      </div>
                      <span className="shape-val-badge pass">PASS</span>
                    </div>
                  ) : null}

                  {validationResult.errors.map((err, eIdx) => (
                    <div key={`err_${eIdx}`} className="shape-val-item fail">
                      <div className="shape-val-info">
                        <div className="shape-val-title text-danger">{err.message}</div>
                        <div className="shape-val-sub">Code: {err.code}</div>
                      </div>
                      <span className="shape-val-badge fail">FAIL</span>
                    </div>
                  ))}

                  {validationResult.warnings.map((warn, wIdx) => (
                    <div key={`warn_${wIdx}`} className="shape-val-item warn">
                      <div className="shape-val-info">
                        <div className="shape-val-title text-amber">{warn.message}</div>
                        <div className="shape-val-sub">Code: {warn.code}</div>
                      </div>
                      <span className="shape-val-badge warn">WARN</span>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: VERSION HISTORY */}
              {activeTab === 'versions' && (
                <div className="tab-pane-content">
                  <div className="shape-helper-notice">
                    <Shield size={14} className="text-cyan" />
                    <span><strong>Immutable Version History:</strong> Historical calculation runs performed with older versions remain pinned to their respective snapshot.</span>
                  </div>

                  <div className="shape-version-timeline">
                    {(shape.versions && shape.versions.length > 0 ? shape.versions : [
                      {
                        version: shape.version || '1.0',
                        status: shape.status || 'DRAFT',
                        createdAt: shape.createdAt || new Date().toISOString(),
                        createdBy: shape.createdBy || 'User',
                        changeSummary: 'Initial release'
                      }
                    ]).map((v, vIdx) => (
                      <div key={vIdx} className="shape-version-item">
                        <div className="shape-version-header">
                          <span className="shape-version-tag">v{v.version}</span>
                          <span className={`shape-badge-status ${(v.status || 'DRAFT').toLowerCase()}`}>
                            {v.status || 'DRAFT'}
                          </span>
                        </div>
                        <div className="shape-version-summary">
                          {v.changeSummary || 'No change description.'}
                        </div>
                        <div className="shape-version-meta">
                          <Clock size={11} />
                          <span>Created {new Date(v.createdAt).toLocaleString()} by {v.createdBy || 'User'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Global Modal Footer Across Entire Width */}
        <footer className="shape-details-footer">
          <div className="shape-footer-left">
            <button className="shape-btn shape-btn-secondary" onClick={handleExportJSON} title="Download structured JSON definition">
              <Download size={14} />
              <span>Export JSON</span>
            </button>
            {!isStandard && onDuplicate && (
              <button className="shape-btn shape-btn-secondary" onClick={() => onDuplicate(shape)} title="Duplicate Shape">
                <Copy size={14} />
                <span>Duplicate</span>
              </button>
            )}
            {!isStandard && isArchived && onRestore && (
              <button className="shape-btn shape-btn-success" onClick={() => onRestore(shape)}>
                <RotateCcw size={14} />
                <span>Restore to Active</span>
              </button>
            )}
            {!isStandard && !isArchived && onArchive && (
              <button className="shape-btn shape-btn-secondary" onClick={() => onArchive(shape)} title="Archive Shape">
                <Archive size={14} />
                <span>Archive</span>
              </button>
            )}
          </div>

          <div className="shape-footer-right">
            {!isStandard && isDraft && onStatusChange && (
              <button
                className="shape-btn shape-btn-success"
                onClick={() => onStatusChange(shape, 'ACTIVE')}
                disabled={validationResult.errors.length > 0}
                title={validationResult.errors.length > 0 ? 'Fix validation errors before activating' : 'Publish as Active'}
              >
                <Check size={14} />
                <span>Activate Shape</span>
              </button>
            )}

            {!isStandard && isActive && onStatusChange && (
              <button className="shape-btn shape-btn-secondary" onClick={() => onStatusChange(shape, 'DEPRECATED')}>
                <AlertTriangle size={14} />
                <span>Mark Deprecated</span>
              </button>
            )}

            {!isStandard && onNewVersion && (
              <button className="shape-btn shape-btn-secondary" onClick={() => onNewVersion(shape)}>
                <GitBranch size={14} />
                <span>New Version</span>
              </button>
            )}

            <button
              className="shape-btn shape-btn-primary"
              onClick={() => onOpenInCAD(shape)}
            >
              <Pencil size={14} />
              <span>{isStandard ? 'Customize in CAD' : isDraft ? 'Open in CAD Editor' : 'View in CAD Editor'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

