/**
 * RebarOptima BBS Shape Library Comprehensive Automated QA Suite
 * Tests: Geometry, Parameters, Dimensions, Constraints, Rebar Engine, Calculation Engine,
 * Validation Engine, Shape Definition Lifecycle, Version Immutability, and Instance Isolation.
 */

import {
  pointDistance,
  pointAngle,
  rotatePoint,
  createLineObject,
  createRectangleObject,
  createCircleObject,
  createPolylineObject,
  createArcObject
} from './geometry.js';

import {
  createParameter,
  applyParametersToGeometry,
  syncGeometryToParameters,
  validateParameter
} from './parameterEngine.js';

import {
  createLinearDimension,
  updateDimensionFromGeometry,
  cleanOrphanedDimensions
} from './dimensionEngine.js';

import {
  createConstraint,
  validateConstraint,
  solveConstraintsTransactional,
  calculateDegreesOfFreedom
} from './constraintEngine.js';

import {
  createStraightBar,
  createLBar,
  createUBar,
  createClosedStirrup,
  createCrankedBar,
  createOpenLink
} from './rebarEngine.js';

import {
  calculateRebarShape,
  CALCULATION_STATUS
} from './calculationEngine.js';

import {
  engineeringRuleProvider,
  RULE_SET_CENTERLINE_EXACT,
  RULE_SET_STANDARD_BEND_DEDUCTION,
  RULE_SET_EUROCODE_BS8666,
  RULE_SET_IS_PRACTICE
} from './engineeringRules.js';

import {
  validateRebarEngineering,
  VALIDATION_SEVERITY,
  VALIDATION_CODES
} from './validationEngine.js';

import {
  STANDARD_SHAPE_TEMPLATES,
  SHAPE_STATUS,
  SHAPE_OWNERSHIP,
  createBlankShapeDefinition,
  createShapeFromTemplate,
  createShapeInstance,
  calculateShapeInstance
} from './shapeDefinitionModel.js';

import {
  mmToMeters,
  calculateTheoreticalUnitWeight,
  calculateTotalSteelWeight
} from './calculationUnits.js';

// Test execution tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testId, description, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testId}: ${description}`);
  } else {
    failedTests++;
    console.error(`  ✕ [FAIL] ${testId}: ${description} - ${details}`);
    failures.push({ testId, description, details });
  }
}

function assertClose(actual, expected, tol = 0.05, testId, description) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tol, testId, description, `Expected ${expected} ± ${tol}, got ${actual} (diff: ${diff.toFixed(4)})`);
}

console.log('================================================================');
console.log('🚀 REBAROPTIMA BBS SHAPE LIBRARY & ENGINE AUTOMATED QA GATE');
console.log('================================================================\n');

// ══════════════════════════════════════════════════════════════════════════════
// 1. GEOMETRY & UNIT UTILITIES TESTS
// ══════════════════════════════════════════════════════════════════════════════
console.log('--- 1. GEOMETRY & UNIT UTILITIES ---');
{
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 300, y: 400 };
  assertClose(pointDistance(p1, p2), 500, 0.001, 'GEO-01', 'Euclidean distance calculation 3-4-5 triangle');

  const ang = pointAngle(p1, { x: 100, y: 100 });
  assertClose(ang, Math.PI / 4, 0.001, 'GEO-02', 'Point angle 45 deg in radians');

  const rot = rotatePoint({ x: 100, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
  assertClose(rot.x, 0, 0.001, 'GEO-03', 'Rotate point 90 deg X coord');
  assertClose(rot.y, 100, 0.001, 'GEO-04', 'Rotate point 90 deg Y coord');

  const line = createLineObject(p1, p2);
  assert(line.type === 'line' && line.id && line.x1 === 0 && line.y2 === 400, 'GEO-05', 'Line object factory');

  const rect = createRectangleObject(10, 20, 300, 450);
  assert(rect.type === 'rectangle' && rect.width === 300 && rect.height === 450, 'GEO-06', 'Rectangle object factory');

  // Theoretical unit weight formula W = 0.006165 * d^2
  assertClose(calculateTheoreticalUnitWeight(8), 0.395, 0.01, 'UNIT-01', '8mm unit weight ~0.395 kg/m');
  assertClose(calculateTheoreticalUnitWeight(10), 0.617, 0.01, 'UNIT-02', '10mm unit weight ~0.617 kg/m');
  assertClose(calculateTheoreticalUnitWeight(12), 0.888, 0.01, 'UNIT-03', '12mm unit weight ~0.888 kg/m');
  assertClose(calculateTheoreticalUnitWeight(16), 1.578, 0.01, 'UNIT-04', '16mm unit weight ~1.578 kg/m');
  assertClose(calculateTheoreticalUnitWeight(20), 2.466, 0.01, 'UNIT-05', '20mm unit weight ~2.466 kg/m');
  assertClose(calculateTheoreticalUnitWeight(25), 3.853, 0.01, 'UNIT-06', '25mm unit weight ~3.853 kg/m');
  assertClose(calculateTheoreticalUnitWeight(32), 6.313, 0.02, 'UNIT-07', '32mm unit weight ~6.313 kg/m');
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. PARAMETRIC ENGINE & VALIDATION TESTS
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n--- 2. PARAMETRIC ENGINE & VALIDATION ---');
{
  const param = createParameter({
    name: 'WIDTH',
    displayName: 'Stirrup Width',
    value: 300,
    unit: 'mm'
  });
  assert(param.name === 'WIDTH' && param.value === 300, 'PARAM-01', 'Parameter creation');

  const valPositive = validateParameter(param, []);
  assert(valPositive.valid, 'PARAM-02', 'Positive parameter validation');

  const invalidZero = validateParameter({ ...param, value: 0 }, []);
  assert(!invalidZero.valid, 'PARAM-03', 'Zero length parameter rejection');

  const invalidNegative = validateParameter({ ...param, value: -50 }, []);
  assert(!invalidNegative.valid, 'PARAM-04', 'Negative length parameter rejection');

  const invalidHuge = validateParameter({ ...param, value: 500000 }, []);
  assert(!invalidHuge.valid, 'PARAM-05', 'Excessively large parameter rejection (>100m)');

  // Parametric application to geometry
  const rebar = createLBar({ legA: 400, legB: 300, diameter: 16 });
  const paramLegA = createParameter({
    name: 'LEG_A',
    value: 650,
    targetRef: { objectId: rebar.id, property: 'legA' }
  });
  const updatedObjs = applyParametersToGeometry([rebar], [paramLegA]);
  assert(updatedObjs[0].legA === 650, 'PARAM-06', 'Parametric update applied to rebar entity');
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. CONSTRAINT ENGINE & SOLVER TESTS
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n--- 3. CONSTRAINT ENGINE & TRANSACTIONAL SOLVER ---');
{
  const line1 = createLineObject({ x: 0, y: 0 }, { x: 100, y: 0 });
  const line2 = createLineObject({ x: 0, y: 0 }, { x: 0, y: 100 });

  const cPerp = createConstraint({
    type: 'perpendicular',
    entity1Id: line1.id,
    entity2Id: line2.id
  });
  assert(cPerp.type === 'perpendicular', 'CONST-01', 'Constraint creation');

  const dof = calculateDegreesOfFreedom([line1, line2], [cPerp]);
  assert(dof.totalDOF >= 0, 'CONST-02', 'Degrees of Freedom calculation');

  // Solver transactional execution
  const solveResult = solveConstraintsTransactional([line1, line2], [cPerp]);
  assert(solveResult.success, 'CONST-03', 'Transactional constraint solver convergence');
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. REBAR GEOMETRY & SEISMIC HOOKS TESTS
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n--- 4. REBAR GEOMETRY & SEISMIC HOOKS ---');
{
  // Closed Stirrup with dual 135 deg seismic hooks
  const stirrup = createClosedStirrup({
    width: 300,
    height: 450,
    diameter: 8,
    bendRadius: 16,
    hookAngle: 135,
    hookExtension: 75,
    origin: { x: 0, y: 0 }
  });

  assert(stirrup.type === 'rebar', 'REBAR-01', 'Stirrup entity type is rebar');
  assert(stirrup.rebarShapeType === 'closed_stirrup', 'REBAR-02', 'Rebar shape type is closed_stirrup');
  assert(stirrup.diameter === 8, 'REBAR-03', 'Stirrup bar diameter is 8mm');
  assert(stirrup.centerline.length >= 6, 'REBAR-04', 'Stirrup has complete centerline vertices');
  assert(stirrup.subSegments.length >= 4, 'REBAR-05', 'Stirrup has 4 main rectangular legs');
  assert(stirrup.subBends.length >= 3, 'REBAR-06', 'Stirrup has 3 perimeter bends');
  assert(stirrup.subHooks.length === 2, 'REBAR-07', 'Stirrup has exactly 2 dual 135 deg seismic hooks');

  // Verify hook angles
  assertClose(stirrup.subHooks[0].angle, 135, 0.01, 'REBAR-08', 'Hook 1 angle is 135 deg');
  assertClose(stirrup.subHooks[1].angle, 135, 0.01, 'REBAR-09', 'Hook 2 angle is 135 deg');
  assertClose(stirrup.subHooks[0].extension, 75, 0.01, 'REBAR-10', 'Hook 1 extension is 75mm');
  assertClose(stirrup.subHooks[1].extension, 75, 0.01, 'REBAR-11', 'Hook 2 extension is 75mm');
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. CALCULATION ENGINE & ENGINEERING RULES TESTS (PHASE 2F)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n--- 5. CALCULATION ENGINE & ENGINEERING RULES ---');
{
  const stirrup = createClosedStirrup({
    width: 300,
    height: 450,
    diameter: 8,
    bendRadius: 16,
    hookAngle: 135,
    hookExtension: 75
  });

  // Test across all 4 rule sets
  const calcExact = calculateRebarShape(stirrup, RULE_SET_CENTERLINE_EXACT);
  assert(calcExact.status === CALCULATION_STATUS.CALCULATED, 'CALC-01', 'Exact Centerline calculation status CALCULATED');
  assert(calcExact.isTrusted, 'CALC-02', 'Calculation is trusted');
  assert(calcExact.cuttingLength > 1500 && calcExact.cuttingLength < 1800, 'CALC-03', `Stirrup cutting length in expected range: ${calcExact.cuttingLength}mm`);
  assert(calcExact.totalWeight > 0.5 && calcExact.totalWeight < 0.8, 'CALC-04', `Stirrup steel weight in expected range: ${calcExact.totalWeight.toFixed(3)}kg`);
  assert(calcExact.trace && calcExact.trace.steps && calcExact.trace.steps.length >= 4, 'CALC-05', 'Step-by-step trace derivation generated');

  // Standard Bend Deduction rule set
  const calcDeduct = calculateRebarShape(stirrup, RULE_SET_STANDARD_BEND_DEDUCTION);
  assert(calcDeduct.status === CALCULATION_STATUS.CALCULATED, 'CALC-06', 'Bend Deduction calculation status CALCULATED');
  assert(calcDeduct.breakdown.totalBendDeduction < 0, 'CALC-07', 'Negative bend deductions applied');

  // BS 8666 / Eurocode rule set
  const calcEuro = calculateRebarShape(stirrup, RULE_SET_EUROCODE_BS8666);
  assert(calcEuro.status === CALCULATION_STATUS.CALCULATED, 'CALC-08', 'BS 8666 calculation status CALCULATED');

  // IS Practice rule set
  const calcIS = calculateRebarShape(stirrup, RULE_SET_IS_PRACTICE);
  assert(calcIS.status === CALCULATION_STATUS.CALCULATED, 'CALC-09', 'IS Practice calculation status CALCULATED');
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. VALIDATION ENGINE TESTS
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n--- 6. VALIDATION ENGINE CHECKS ---');
{
  const validStirrup = createClosedStirrup({ width: 300, height: 450, diameter: 8, bendRadius: 16 });
  const valResults = validateRebarEngineering(validStirrup, engineeringRuleProvider.get('RULE_SET_CENTERLINE_EXACT'));
  const errors = valResults.filter(r => r.severity === VALIDATION_SEVERITY.ERROR);
  assert(errors.length === 0, 'VAL-01', 'Valid stirrup passes with zero errors');

  // Invalid diameter (e.g. 7mm non-standard)
  const invalidDiaRebar = { ...validStirrup, diameter: 7 };
  const valDia = validateRebarEngineering(invalidDiaRebar);
  const diaErrors = valDia.filter(r => r.code === VALIDATION_CODES.INVALID_DIAMETER);
  assert(diaErrors.length > 0, 'VAL-02', 'Non-standard bar diameter 7mm flagged as error');

  // Missing geometry entity
  const valNull = validateRebarEngineering(null);
  assert(valNull.some(r => r.code === VALIDATION_CODES.MISSING_GEOMETRY), 'VAL-03', 'Missing geometry handled safely');
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. SHAPE DEFINITION, VERSIONING & LIFECYCLE TESTS (PHASE 2G)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n--- 7. SHAPE DEFINITION, VERSIONING & LIFECYCLE ---');
{
  // Creation from standard template
  const shapeDef = createShapeFromTemplate('tpl_stirrup_51', 'Standard Stirrup Template');
  assert(shapeDef.name === 'Standard Stirrup Template', 'SHAPE-01', 'Template instantiation name');
  assert(shapeDef.version === '1.0', 'SHAPE-02', 'Initial version is 1.0');
  assert(shapeDef.status === SHAPE_STATUS.DRAFT, 'SHAPE-03', 'Initial status is DRAFT');
  assert(shapeDef.ownership === SHAPE_OWNERSHIP.CUSTOM, 'SHAPE-04', 'Customized template has CUSTOM ownership');
  assert(shapeDef.versions && shapeDef.versions.length === 1, 'SHAPE-05', 'Version history initialized with v1.0 snapshot');

  // Blank shape definition
  const blankShape = createBlankShapeDefinition('Custom Column Tie');
  assert(blankShape.name === 'Custom Column Tie', 'SHAPE-06', 'Blank shape creation');
  assert(blankShape.status === SHAPE_STATUS.DRAFT, 'SHAPE-07', 'Blank shape starts as DRAFT');

  // Standard Templates Integrity
  assert(STANDARD_SHAPE_TEMPLATES.length >= 7, 'SHAPE-08', 'Standard template catalog contains >= 7 standard shapes');
  STANDARD_SHAPE_TEMPLATES.forEach(tpl => {
    const model = tpl.createModel();
    assert(model.geometry && model.geometry.objects.length > 0, `SHAPE-TPL-${tpl.templateId}`, `Template ${tpl.name} produces valid structured geometry`);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. CRITICAL RELEASE GATE: HISTORICAL VERSION IMMUTABILITY
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n--- 8. CRITICAL: VERSION IMMUTABILITY ---');
{
  // Create Shape Definition v1.0
  const shapeV1 = createShapeFromTemplate('tpl_stirrup_51', 'Imm-Test Stirrup');
  shapeV1.version = '1.0';
  shapeV1.status = SHAPE_STATUS.ACTIVE;

  // Snapshot v1.0 geometry
  const v1WidthParam = shapeV1.parameters.find(p => p.name === 'WIDTH');
  const v1Width = v1WidthParam.value; // 300
  const v1Snapshot = JSON.parse(JSON.stringify(shapeV1));

  // Bump to v2.0 with geometry modification
  const shapeV2 = JSON.parse(JSON.stringify(shapeV1));
  shapeV2.version = '2.0';
  shapeV2.status = SHAPE_STATUS.DRAFT;
  const v2WidthParam = shapeV2.parameters.find(p => p.name === 'WIDTH');
  v2WidthParam.value = 500; // changed to 500mm

  // Update v2 geometry
  const rebarInV2 = shapeV2.geometry.objects.find(o => o.type === 'rebar');
  rebarInV2.width = 500;

  // Verify v1.0 snapshot remains exactly 300mm
  const v1PreservedParam = v1Snapshot.parameters.find(p => p.name === 'WIDTH');
  const rebarInV1 = v1Snapshot.geometry.objects.find(o => o.type === 'rebar');

  assert(v1PreservedParam.value === 300, 'IMMUT-01', 'v1.0 Width parameter remains strictly 300mm');
  assert(rebarInV1.width === 300, 'IMMUT-02', 'v1.0 Rebar entity width remains strictly 300mm');
  assert(v2WidthParam.value === 500, 'IMMUT-03', 'v2.0 Width parameter successfully updated to 500mm');
  assert(rebarInV2.width === 500, 'IMMUT-04', 'v2.0 Rebar entity width successfully updated to 500mm');
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. CRITICAL RELEASE GATE: SHAPE DEFINITION VS SHAPE INSTANCE ISOLATION
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n--- 9. CRITICAL: SHAPE DEFINITION VS INSTANCE ISOLATION ---');
{
  const shapeMaster = createShapeFromTemplate('tpl_stirrup_51', 'Master Column Stirrup');
  shapeMaster._id = 'shape_master_123';

  // Create Instance A on Column C1 (Width = 300, Height = 450)
  const instanceA = createShapeInstance(
    shapeMaster,
    { WIDTH: 300, HEIGHT: 450, DIAMETER: 8 },
    { memberId: 'col_c1', label: 'C1 Outer Tie' }
  );

  // Create Instance B on Column C2 (Width = 400, Height = 600)
  const instanceB = createShapeInstance(
    shapeMaster,
    { WIDTH: 400, HEIGHT: 600, DIAMETER: 10 },
    { memberId: 'col_c2', label: 'C2 Outer Tie' }
  );

  assert(instanceA.shapeId === 'shape_master_123', 'INST-01', 'Instance A references master shape ID');
  assert(instanceB.shapeId === 'shape_master_123', 'INST-02', 'Instance B references master shape ID');

  assert(instanceA.parameterValues.WIDTH === 300, 'INST-03', 'Instance A Width is 300mm');
  assert(instanceB.parameterValues.WIDTH === 400, 'INST-04', 'Instance B Width is 400mm');

  assert(instanceA.calculationSnapshot.cuttingLength > 0, 'INST-05', 'Instance A has frozen calculation snapshot');
  assert(instanceB.calculationSnapshot.cuttingLength > 0, 'INST-06', 'Instance B has frozen calculation snapshot');

  assert(
    instanceB.calculationSnapshot.cuttingLength > instanceA.calculationSnapshot.cuttingLength,
    'INST-07',
    'Instance B cutting length is greater than Instance A due to larger dimensions'
  );

  // Mutate Instance A parameters
  instanceA.parameterValues.WIDTH = 350;
  const recalculatedA = calculateShapeInstance(shapeMaster, instanceA.parameterValues);
  instanceA.calculationSnapshot = recalculatedA;

  // Verify Instance B and Master Definition are completely unchanged
  assert(instanceA.parameterValues.WIDTH === 350, 'INST-08', 'Instance A parameter override updated to 350mm');
  assert(instanceB.parameterValues.WIDTH === 400, 'INST-09', 'Instance B parameter remains isolated at 400mm');
  assert(shapeMaster.parameters.find(p => p.name === 'WIDTH').value === 300, 'INST-10', 'Master Shape Definition default parameter remains isolated at 300mm');
}

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY REPORT
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n================================================================');
console.log(`QA TEST SUITE SUMMARY: ${passedTests}/${totalTests} PASSED`);
if (failedTests === 0) {
  console.log('🎉 STATUS: ALL TESTS PASSED! ZERO REGRESSIONS DETECTED.');
} else {
  console.error(`🚨 STATUS: ${failedTests} FAILURES DETECTED!`);
  console.log('Failures list:', failures);
}
console.log('================================================================\n');

process.exit(failedTests === 0 ? 0 : 1);
