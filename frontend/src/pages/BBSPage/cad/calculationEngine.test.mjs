/**
 * RebarOptima Phase 2F — Comprehensive Engineering Calculation & Validation Test Suite (.mjs)
 */

import {
  createStraightBar,
  createLBar,
  createClosedStirrup,
  createCustomRebarPath,
  updateRebarGeometry
} from './rebarEngine.js';
import {
  calculateRebarShape,
  CALCULATION_STATUS,
  createRebarSnapshot
} from './calculationEngine.js';
import {
  engineeringRuleProvider,
  RULE_SET_CENTERLINE_EXACT,
  RULE_SET_STANDARD_BEND_DEDUCTION,
  RULE_SET_EUROCODE_BS8666,
  RULE_SET_IS_PRACTICE
} from './engineeringRules.js';
import { validateRebarEngineering, VALIDATION_SEVERITY } from './validationEngine.js';
import { mmToMeters, formatLength, formatWeight } from './calculationUnits.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
}

console.log('════════════════════════════════════════════════════════════════════════');
console.log('REBAROPTIMA PHASE 2F: CALCULATION & VALIDATION ENGINE VERIFICATION');
console.log('════════════════════════════════════════════════════════════════════════\n');

// ──────────────────────────────────────────────────────────────────────────────
// TEST 1: STRAIGHT BAR (Length = 2000 mm, Diameter = 16 mm)
// ──────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 1: Straight Bar Calculation & Trace ---');
const straightBar = createStraightBar({
  length: 2000,
  diameter: 16
});

const calcStraight = calculateRebarShape(straightBar, 'RULE_SET_CENTERLINE_EXACT');
assert(calcStraight.status === CALCULATION_STATUS.CALCULATED, 'Calculation status is CALCULATED');
assert(calcStraight.isTrusted === true, 'Calculation is trusted');
assert(calcStraight.geometricLength === 2000, `Geometric length is exactly 2000 mm (got ${calcStraight.geometricLength})`);
assert(calcStraight.developedLength === 2000, `Developed length is 2000 mm (got ${calcStraight.developedLength})`);
assert(calcStraight.cuttingLength === 2000, `Cutting length is 2000 mm (got ${calcStraight.cuttingLength})`);
// Steel density 7850 kg/m³, Ø16: theoretical unit wt = (π * 0.008^2) * 7850 ≈ 1.5791 kg/m
assert(calcStraight.unitWeight > 1.55 && calcStraight.unitWeight < 1.60, `Unit weight is ~1.579 kg/m (got ${calcStraight.unitWeight})`);
// 2.0 m * 1.5791 = 3.158 kg
assert(calcStraight.totalWeight > 3.10 && calcStraight.totalWeight < 3.20, `Total weight is ~3.158 kg (got ${calcStraight.totalWeight})`);
assert(calcStraight.trace.length >= 6, `Calculation trace contains ${calcStraight.trace.length} explainable steps`);
assert(calcStraight.segments.length === 1, `1 straight segment detected`);
console.log('');

// ──────────────────────────────────────────────────────────────────────────────
// TEST 2: L-BAR (Leg A = 500, Leg B = 300, Diameter = 16, Bend Radius = 32, 90°)
// ──────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 2: L-Bar Bending & Deductions ---');
const lBar = createLBar({
  legA: 500,
  legB: 300,
  diameter: 16,
  bendRadius: 32,
  bendAngle: 90
});

// Centerline Rule Set (Pure Developed Length)
const calcLBarCenterline = calculateRebarShape(lBar, 'RULE_SET_CENTERLINE_EXACT');
assert(calcLBarCenterline.geometricLength === 800, `L-Bar geometric length is 800 mm (500 + 300)`);
assert(calcLBarCenterline.cuttingLength === 800, `Centerline cutting length is 800 mm`);
assert(calcLBarCenterline.segments.length === 2, `2 segments detected (Leg A, Leg B)`);

// Standard Bend Deduction Rule Set (90° = 2d deduction for Ø16 -> deduction = -32 mm)
const calcLBarDeduction = calculateRebarShape(lBar, 'RULE_SET_STANDARD_BEND_DEDUCTION');
assert(calcLBarDeduction.status === CALCULATION_STATUS.CALCULATED, `L-Bar calculated with bend deduction`);
assert(calcLBarDeduction.cuttingLength < calcLBarCenterline.cuttingLength, `Cutting length with bend deduction (${calcLBarDeduction.cuttingLength} mm) is less than centerline (${calcLBarCenterline.cuttingLength} mm)`);
assert(calcLBarDeduction.adjustments.length > 0, `Bend adjustment logged in adjustments trace`);
console.log('');

// ──────────────────────────────────────────────────────────────────────────────
// TEST 3: CLOSED STIRRUP (300 × 450 mm, Diameter = 8, 135° Hooks)
// ──────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 3: Closed Stirrup & Closure Validation ---');
const stirrup = createClosedStirrup({
  width: 300,
  height: 450,
  diameter: 8,
  bendRadius: 16,
  hookAngle: 135,
  hookExtension: 75
});

const calcStirrup = calculateRebarShape(stirrup, 'RULE_SET_CENTERLINE_EXACT');
assert(calcStirrup.status === CALCULATION_STATUS.CALCULATED, 'Stirrup calculation succeeded');
assert(calcStirrup.isTrusted === true, 'Stirrup validation passed with 0 errors');
// Perimeter = 2 * (300 + 450) = 1500 mm. Dual hooks = 2 * 75 = 150 mm. Total = 1650 mm.
assert(calcStirrup.geometricLength === 1650, `Stirrup developed length is 1650 mm (got ${calcStirrup.geometricLength})`);
assert(calcStirrup.hooks.length === 2, `2 seismic hooks (135°) detected`);
assert(calcStirrup.segments.length === 6, `6 segments detected (4 legs + 2 hook extensions)`);
// Unit weight for Ø8 mm ≈ 8^2 / 162 ≈ 0.395 kg/m
assert(calcStirrup.unitWeight > 0.38 && calcStirrup.unitWeight < 0.42, `Ø8 unit weight is ~0.395 kg/m (got ${calcStirrup.unitWeight})`);
// Total weight = 1.65 m * 0.395 kg/m ≈ 0.65 kg
assert(calcStirrup.totalWeight > 0.60 && calcStirrup.totalWeight < 0.70, `Stirrup total weight is ~0.65 kg (got ${calcStirrup.totalWeight})`);
console.log('');

// ──────────────────────────────────────────────────────────────────────────────
// TEST 4: INVALID SHAPE VALIDATIONS
// ──────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 4: Invalid Shape Engineering Validations ---');

// 4A: Zero Bar Diameter
const invalidDiaBar = {
  id: 'bad_dia',
  type: 'rebar',
  shapeType: 'straight',
  diameter: 0,
  centerline: {
    points: [{ x: 0, y: 0 }, { x: 500, y: 0 }],
    segments: [{ id: 's1', length: 500, start: { x: 0, y: 0 }, end: { x: 500, y: 0 } }]
  }
};
const calcBadDia = calculateRebarShape(invalidDiaBar);
assert(calcBadDia.status === CALCULATION_STATUS.INVALID, 'Zero diameter flagged as INVALID');
assert(calcBadDia.isTrusted === false, 'Zero diameter marked isTrusted = false');
assert(calcBadDia.validations.some(v => v.severity === 'error' && v.code === 'INVALID_DIAMETER'), 'INVALID_DIAMETER error reported');

// 4B: Negative Segment Length
const invalidLenBar = {
  id: 'bad_len',
  type: 'rebar',
  shapeType: 'straight',
  diameter: 16,
  centerline: {
    points: [{ x: 0, y: 0 }, { x: -100, y: 0 }],
    segments: [{ id: 's1', length: -100, start: { x: 0, y: 0 }, end: { x: -100, y: 0 } }]
  }
};
const calcBadLen = calculateRebarShape(invalidLenBar);
assert(calcBadLen.status === CALCULATION_STATUS.INVALID, 'Negative length flagged as INVALID');

// 4C: Invalid Bend Radius
const invalidRadiusBar = {
  id: 'bad_radius',
  type: 'rebar',
  shapeType: 'bend',
  diameter: 16,
  centerline: {
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
    segments: [{ id: 's1', length: 100 }, { id: 's2', length: 100 }],
    bends: [{ id: 'b1', radius: -10, bendAngleDeg: 90 }]
  }
};
const calcBadRadius = calculateRebarShape(invalidRadiusBar);
assert(calcBadRadius.status === CALCULATION_STATUS.INVALID, 'Negative bend radius flagged as INVALID');
console.log('');

// ──────────────────────────────────────────────────────────────────────────────
// TEST 5: RULE CHANGE ISOLATION (Geometry != Engineering Rules)
// ──────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 5: Rule Change Isolation (Same Geometry, Multiple Standards) ---');

const testRebar = createLBar({ legA: 1000, legB: 600, diameter: 20, bendRadius: 40, bendAngle: 90 });

const resCenterline = calculateRebarShape(testRebar, 'RULE_SET_CENTERLINE_EXACT');
const resStandard = calculateRebarShape(testRebar, 'RULE_SET_STANDARD_BEND_DEDUCTION');
const resIS = calculateRebarShape(testRebar, 'RULE_SET_IS_PRACTICE');
const resBS = calculateRebarShape(testRebar, 'RULE_SET_EUROCODE_BS8666');

// Geometry must be IDENTICAL across all calculations
assert(resCenterline.geometricLength === 1600, 'Geometry is 1600 mm for Centerline rule');
assert(resStandard.geometricLength === 1600, 'Geometry is 1600 mm for Standard Deduction rule');
assert(resIS.geometricLength === 1600, 'Geometry is 1600 mm for IS rule');
assert(resBS.geometricLength === 1600, 'Geometry is 1600 mm for BS rule');

// Cutting lengths and weights differ based on rules
assert(resCenterline.cuttingLength === 1600, `Centerline cutting length: ${resCenterline.cuttingLength} mm`);
assert(resStandard.cuttingLength < 1600, `Standard deduction cutting length (${resStandard.cuttingLength} mm) includes 2d deduction`);
assert(resIS.cuttingLength < 1600, `IS practice cutting length (${resIS.cuttingLength} mm) includes 2d deduction`);
console.log('');

// ──────────────────────────────────────────────────────────────────────────────
// TEST 6: PARAMETER MUTATION & RECALCULATION
// ──────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 6: Parameter Mutation & Dynamic Recalculation ---');

const dynamicBar = createStraightBar({ length: 1000, diameter: 12 });
const initialCalc = calculateRebarShape(dynamicBar);
assert(initialCalc.cuttingLength === 1000, 'Initial cutting length = 1000 mm');
assert(initialCalc.barDiameter === 12, 'Initial diameter = 12 mm');

// Mutate diameter from 12 mm -> 20 mm
const updatedBar = updateRebarGeometry(dynamicBar, { diameter: 20 });
const updatedCalc = calculateRebarShape(updatedBar, 'RULE_SET_CENTERLINE_EXACT', { bypassCache: true });
assert(updatedCalc.barDiameter === 20, 'Updated diameter is 20 mm');
assert(updatedCalc.unitWeight > initialCalc.unitWeight * 2, `Unit weight increased from ${initialCalc.unitWeight} to ${updatedCalc.unitWeight} kg/m`);
assert(updatedCalc.totalWeight > initialCalc.totalWeight * 2, `Total weight increased proportionally from ${initialCalc.totalWeight} to ${updatedCalc.totalWeight} kg`);
console.log('');

// ──────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────────────────────────────────────
console.log('════════════════════════════════════════════════════════════════════════');
console.log(`TEST SUITE COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
console.log('════════════════════════════════════════════════════════════════════════');
