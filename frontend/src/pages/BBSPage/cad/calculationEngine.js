/**
 * RebarOptima Phase 2F — Authoritative Rebar Calculation Engine
 * 
 * Takes:
 * - Rebar Geometry (Centerline, Segments, Bends, Hooks)
 * - Parameters (Dimensions, Diameter, Radii, Hooks)
 * - Bar Diameter
 * - Engineering Rule Set (Centerline, Standard Deduction, Eurocode, IS Practice)
 * 
 * Produces structured, traceable calculation results:
 * - Segments, Bends, Hooks
 * - Geometric Length (pure sum of straight legs & arcs)
 * - Developed Length (centerline geometric path length)
 * - Cutting Length (with traceable engineering rule adjustments)
 * - Bar Unit Weight (kg/m)
 * - Total Steel Weight (kg)
 * - Calculation Trace (step-by-step mathematical derivation)
 * - Engineering Validation Results & Calculation Status
 */

import { generateId } from './geometry';
import { mmToMeters, formatLength, formatWeight, formatUnitWeight, degToRad } from './calculationUnits';
import { engineeringRuleProvider, RULE_SET_CENTERLINE_EXACT } from './engineeringRules';
import { validateRebarEngineering, VALIDATION_SEVERITY } from './validationEngine';

/**
 * Calculation Status Constants
 */
export const CALCULATION_STATUS = {
  NOT_CALCULATED: 'NOT_CALCULATED',
  CALCULATING: 'CALCULATING',
  CALCULATED: 'CALCULATED',
  INVALID: 'INVALID',
  ERROR: 'ERROR'
};

/**
 * Simple calculation cache to prevent redundant recalculations
 */
const calculationCache = new Map();

/**
 * Generates an immutable snapshot of rebar geometry and parameters
 */
export function createRebarSnapshot(rebar) {
  if (!rebar) return null;
  return JSON.parse(JSON.stringify(rebar));
}

/**
 * Generates a deterministic hash signature for cache lookup
 */
export function getCalculationSignature(rebar, ruleSetId) {
  if (!rebar) return '';
  const d = rebar.diameter || 16;
  const r = rebar.bendRadius || 0;
  const p = JSON.stringify(rebar.parameters || {});
  const pts = JSON.stringify(rebar.centerline?.points || []);
  return `${rebar.id || 'rebar'}_${ruleSetId || 'default'}_d${d}_r${r}_${p}_${pts}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// CORE CALCULATION PIPELINE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calculates complete engineering results for a rebar shape.
 * 
 * @param {object} rebarInput Rebar entity (or geometry snapshot)
 * @param {string|object} ruleSetInput Rule set ID or RuleSet object
 * @param {object} options Optional flags (bypassCache: boolean)
 * @returns {object} Structured CalculationResult
 */
export function calculateRebarShape(rebarInput, ruleSetInput = 'RULE_SET_CENTERLINE_EXACT', options = {}) {
  const startTime = performance.now();

  // 1. Resolve Rule Set
  const ruleSet = typeof ruleSetInput === 'string'
    ? engineeringRuleProvider.get(ruleSetInput)
    : (ruleSetInput || engineeringRuleProvider.getDefault());

  const ruleSetId = ruleSet.id || 'RULE_SET_CENTERLINE_EXACT';

  // 2. Cache Check
  const signature = getCalculationSignature(rebarInput, ruleSetId);
  if (!options.bypassCache && calculationCache.has(signature)) {
    return calculationCache.get(signature);
  }

  // 3. Create Immutable Snapshot
  const snapshot = createRebarSnapshot(rebarInput);

  if (!snapshot) {
    return {
      status: CALCULATION_STATUS.INVALID,
      isTrusted: false,
      message: 'No rebar geometry available',
      geometricLength: 0,
      developedLength: 0,
      cuttingLength: 0,
      unitWeight: 0,
      totalWeight: 0,
      segments: [],
      bends: [],
      hooks: [],
      adjustments: [],
      validations: [],
      trace: [],
      ruleSet: { id: ruleSetId, name: ruleSet.name, version: ruleSet.version }
    };
  }

  // 4. Run Geometric & Engineering Validation
  const validations = validateRebarEngineering(snapshot, ruleSet);
  const hasErrors = validations.some(v => v.severity === VALIDATION_SEVERITY.ERROR);

  const dia = Number(snapshot.diameter) || 16;
  const centerline = snapshot.centerline || {};
  const rawSegments = centerline.segments || [];
  const rawBends = centerline.bends || [];
  const rawHooks = centerline.hooks || [];

  const trace = [];
  trace.push({
    step: 1,
    title: 'Shape & Engineering Setup',
    description: `Shape: "${snapshot.name || 'Custom Rebar'}" (Ø${dia} mm). Engineering Rule Set: "${ruleSet.name}" v${ruleSet.version}.`,
    data: { diameter: dia, ruleSet: ruleSet.name, version: ruleSet.version }
  });

  // 5. Calculate Straight Segments (World mm)
  const segments = rawSegments.map((seg, idx) => {
    const p1 = seg.start || { x: 0, y: 0 };
    const p2 = seg.end || { x: 0, y: 0 };
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const calcLen = Math.hypot(dx, dy);
    const length = Number(seg.length) || calcLen;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    return {
      id: seg.id || `seg_${idx + 1}`,
      name: seg.name || `Segment ${idx + 1}`,
      start: { x: Number(p1.x.toFixed(2)), y: Number(p1.y.toFixed(2)) },
      end: { x: Number(p2.x.toFixed(2)), y: Number(p2.y.toFixed(2)) },
      length: Number(length.toFixed(2)),
      directionDeg: Number(angleDeg.toFixed(1))
    };
  });

  const straightSegmentsSum = segments.reduce((sum, s) => sum + s.length, 0);

  trace.push({
    step: 2,
    title: 'Straight Segments Measurement',
    description: `Measured ${segments.length} straight segment(s) total = ${straightSegmentsSum.toFixed(2)} mm.`,
    data: segments.map(s => `${s.name}: ${s.length} mm (direction: ${s.directionDeg}°)`),
    subtotalMm: straightSegmentsSum
  });

  // 6. Calculate Bends & Bend Treatments
  const bends = [];
  const bendAdjustments = [];

  rawBends.forEach((b, idx) => {
    const angleDeg = Number(b.bendAngleDeg) || 90;
    const radius = Number(b.radius) || (dia * 2);
    const rad = degToRad(angleDeg);
    const arcLength = radius * rad;

    const treatment = ruleSet.calculateBendTreatment({
      id: b.id || `bend_${idx + 1}`,
      bendAngleDeg: angleDeg,
      radius: radius
    }, dia);

    const bendObj = {
      id: b.id || `bend_${idx + 1}`,
      angleDeg: angleDeg,
      radius: radius,
      arcLength: Number(arcLength.toFixed(2)),
      adjustmentMm: Number(treatment.adjustmentMm.toFixed(2)),
      formula: treatment.formula,
      explanation: treatment.explanation
    };

    bends.push(bendObj);
    bendAdjustments.push(treatment);
  });

  const totalBendArcLength = bends.reduce((sum, b) => sum + b.arcLength, 0);
  const totalBendAdjustments = bendAdjustments.reduce((sum, a) => sum + a.adjustmentMm, 0);

  trace.push({
    step: 3,
    title: 'Bending & Arc Analysis',
    description: bends.length > 0
      ? `Analyzed ${bends.length} bend(s). Total Centerline Arc Length = ${totalBendArcLength.toFixed(2)} mm. Rule Adjustments = ${totalBendAdjustments.toFixed(2)} mm.`
      : 'No intermediate bends found in this shape profile.',
    data: bends.map(b => `${b.angleDeg}° Bend (R=${b.radius}mm): Arc=${b.arcLength}mm | Adjustment=${b.adjustmentMm}mm [${b.formula}]`),
    subtotalMm: totalBendArcLength,
    totalAdjustmentMm: totalBendAdjustments
  });

  // 7. Calculate Hooks & Hook Treatments
  const hooks = [];
  const hookAdjustments = [];

  rawHooks.forEach((hk, idx) => {
    const angle = Number(hk.angle) || 135;
    const ext = Number(hk.extension) || (angle === 135 ? Math.max(75, 6 * dia) : Math.max(75, 4 * dia));

    const treatment = ruleSet.calculateHookTreatment({
      id: hk.id || `hook_${idx + 1}`,
      angle: angle,
      extension: ext
    }, dia);

    const hookObj = {
      id: hk.id || `hook_${idx + 1}`,
      angleDeg: angle,
      extensionMm: ext,
      adjustmentMm: Number(treatment.adjustmentMm.toFixed(2)),
      formula: treatment.formula,
      explanation: treatment.explanation,
      tip: hk.tip || null
    };

    hooks.push(hookObj);
    hookAdjustments.push(treatment);
  });

  const totalHookLength = hooks.reduce((sum, h) => sum + h.extensionMm, 0);

  if (hooks.length > 0) {
    trace.push({
      step: 4,
      title: 'Hook Allowances',
      description: `Analyzed ${hooks.length} anchorage/seismic hook(s). Total Hook Extensions = ${totalHookLength.toFixed(2)} mm.`,
      data: hooks.map(h => `${h.angleDeg}° Hook: Extension=${h.extensionMm}mm [${h.formula}]`),
      subtotalMm: totalHookLength
    });
  }

  // 8. Geometric Length (Pure sum of all straight segments and arc lengths without any deductions)
  // For shapes with explicit segment lengths that already represent outer dimensions or pure centerline legs:
  let geometricLength = straightSegmentsSum;
  // If bends are separate arc entities not embedded in straight segments, add them:
  if (rawBends.length > 0 && snapshot.shapeType === 'custom_rebar') {
    geometricLength = straightSegmentsSum + totalBendArcLength;
  }

  // 9. Developed Length (Continuous centerline path)
  const developedLength = geometricLength;

  trace.push({
    step: 5,
    title: 'Developed Length Calculation',
    description: `Developed Centerline Length = ${developedLength.toFixed(2)} mm.`,
    formula: 'Developed Length = Sum of Centerline Segments & Arcs',
    valueMm: developedLength
  });

  // 10. Cutting Length (Rule Evaluation)
  const cuttingResult = ruleSet.calculateCuttingLength(developedLength, bendAdjustments, hookAdjustments);
  const cuttingLength = Math.max(0, cuttingResult.cuttingLengthMm);

  trace.push({
    step: 6,
    title: 'Cutting Length Determination',
    description: `Applied Engineering Rule Set "${ruleSet.name}". ${cuttingResult.trace}`,
    formula: cuttingResult.formula,
    adjustments: [...bendAdjustments, ...hookAdjustments].map(a => `${a.type} ${a.id}: ${a.adjustmentMm >= 0 ? '+' : ''}${a.adjustmentMm.toFixed(1)} mm`),
    valueMm: cuttingLength
  });

  // 11. Unit Weight Calculation (kg/m)
  const unitWeight = ruleSet.calculateUnitWeight(dia);

  trace.push({
    step: 7,
    title: 'Unit Weight Derivation',
    description: `Steel Unit Weight for Ø${dia} mm = ${unitWeight.toFixed(4)} kg/m.`,
    formula: ruleSet.unitWeightFormula || 'Weight = d² / 162 kg/m',
    valueKgPerM: unitWeight
  });

  // 12. Total Bar Weight Calculation (kg)
  const cuttingLengthM = mmToMeters(cuttingLength);
  const totalWeight = cuttingLengthM * unitWeight;

  trace.push({
    step: 8,
    title: 'Total Steel Weight',
    description: `Weight = Cutting Length (${cuttingLengthM.toFixed(3)} m) × Unit Weight (${unitWeight.toFixed(3)} kg/m) = ${totalWeight.toFixed(3)} kg.`,
    formula: 'Weight (kg) = (Cutting Length mm / 1000) × Unit Weight (kg/m)',
    valueKg: totalWeight
  });

  // 13. Assemble Final Structured Calculation Result
  const calculationStatus = hasErrors ? CALCULATION_STATUS.INVALID : CALCULATION_STATUS.CALCULATED;
  const isTrusted = !hasErrors && cuttingLength > 0;

  const result = {
    shapeId: snapshot.id || 'shape',
    shapeName: snapshot.name || 'Rebar Shape',
    status: calculationStatus,
    isTrusted: isTrusted,
    barDiameter: dia,
    geometricLength: Number(geometricLength.toFixed(2)),
    developedLength: Number(developedLength.toFixed(2)),
    cuttingLength: Number(cuttingLength.toFixed(2)),
    unitWeight: Number(unitWeight.toFixed(4)),
    totalWeight: Number(totalWeight.toFixed(4)),
    segments,
    bends,
    hooks,
    adjustments: [...bendAdjustments, ...hookAdjustments],
    validations,
    trace,
    ruleSet: {
      id: ruleSet.id,
      name: ruleSet.name,
      version: ruleSet.version,
      standard: ruleSet.standard,
      jurisdiction: ruleSet.jurisdiction,
      description: ruleSet.description
    },
    meta: {
      calculatedAt: new Date().toISOString(),
      executionTimeMs: Number((performance.now() - startTime).toFixed(2))
    }
  };

  // 14. Save to Cache
  calculationCache.set(signature, result);

  return result;
}

/**
 * Clear Calculation Cache
 */
export function clearCalculationCache() {
  calculationCache.clear();
}
