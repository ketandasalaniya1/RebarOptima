import { generateColumnBbs } from './frontend/src/pages/BBSPage/workspaces/ColumnWorkspace/columnGenerator.js';
import { generateBeamBbs } from './frontend/src/pages/BBSPage/workspaces/BeamWorkspace/beamGenerator.js';
import { generateSlabBbs } from './frontend/src/pages/BBSPage/workspaces/SlabWorkspace/slabGenerator.js';
import { generateFootingBbs } from './frontend/src/pages/BBSPage/workspaces/FootingWorkspace/footingGenerator.js';
import { generateRetainingWallBbs } from './frontend/src/pages/BBSPage/workspaces/RetainingWallWorkspace/retainingWallGenerator.js';
import { RULE_CLASSIFICATION } from './frontend/src/pages/BBSPage/workspaces/common/ruleConstants.js';

console.log('================================================================');
console.log('REBAROPTIMA BBS — POST-IMPLEMENTATION VERIFICATION TEST SUITE');
console.log('================================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
    passedTests++;
  }
}

// 1. COLUMN WORKSPACE TEST
console.log('\n--- 1. Testing Column Generator ---');
const colResult = generateColumnBbs({
  B: 400,
  D: 400,
  H: 3600,
  cover: 40,
  staggerLaps: true,
  staggerOffsetMm: 750,
  starterEmbedmentDepth: 500,
  starterBendFoot: 300,
  roofAnchorageLeg: 300,
  mainBarDia: 20,
  mainBarCount: 8,
  tieDia: 8,
  ruleSetId: 'RULE_SET_CENTERLINE_EXACT'
});

assert(colResult.validation.isValid, 'Column generated without blocking errors');
assert(colResult.rebarItems.some(i => i.barMark === '01A') && colResult.rebarItems.some(i => i.barMark === '01B'), 'Column successfully split main bars into Mark 01A and 01B for staggered laps');

// Check true centerline tie length: A = B - 2*cover - tieDia = 400 - 80 - 8 = 312
const tieItem = colResult.rebarItems.find(i => i.shapeCode === 'Shape 51');
assert(tieItem !== undefined, 'Tie item found');
assert(tieItem.parameterValues.A === 312 && tieItem.parameterValues.B === 312, 'True centerline tie dimensions calculated accurately (B - 2C - d_tie = 312mm)');

// 2. BEAM WORKSPACE TEST
console.log('\n--- 2. Testing Beam Generator ---');
const beamResult = generateBeamBbs({
  b: 300,
  D: 800, // D > 750 mm triggers side face rebar requirement
  clearSpan: 6000,
  cover: 30,
  topDia: 16,
  topCount: 3,
  curtailmentFraction: 0.33,
  supportAnchorHook: 250,
  sideFaceDia: 12,
  sideFaceCount: 2,
  ruleSetId: 'RULE_SET_CENTERLINE_EXACT'
});

assert(beamResult.validation.isValid, 'Beam generated without blocking errors');
const sideFaceItem = beamResult.rebarItems.find(i => i.barMark === '03');
assert(sideFaceItem !== undefined, 'Side face rebar automatically included for beam depth D = 800mm > 750mm');
assert(sideFaceItem.ruleClassification === RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE, 'Side face rebar properly classified as DESIGNER_PROVIDED_VALUE with code check');

// 3. SLAB WORKSPACE TEST
console.log('\n--- 3. Testing Slab Generator ---');
const slabResult = generateSlabBbs({
  Lx: 3000,
  Ly: 4000,
  t: 150,
  cover: 20,
  useCrankedBars: true,
  crankAngle: 45,
  mainDia: 10,
  mainSpacing: 150,
  distDia: 8,
  distSpacing: 150
});

assert(slabResult.validation.isValid, 'Slab generated successfully');
const slabMainItem = slabResult.rebarItems.find(i => i.barMark === '01');
assert(slabMainItem.shapeCode === 'Shape 41', 'Cranked slab bar marked as Shape 41');
assert(slabMainItem.ruleClassification === RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE, 'Slab main steel classified as DESIGNER_PROVIDED_VALUE');

// 4. FOOTING WORKSPACE TEST
console.log('\n--- 4. Testing Footing Generator ---');
const footingResult = generateFootingBbs({
  L: 2400,
  B: 2400,
  D: 600,
  cover: 50,
  meshXDia: 16,
  meshXSpacing: 150,
  meshXHookLeg: 300,
  meshYDia: 16,
  meshYSpacing: 150,
  meshYHookLeg: 300,
  includeStarterDowels: true,
  dowelDia: 20,
  dowelCount: 8,
  dowelLapExtension: 900
});

assert(footingResult.validation.isValid, 'Footing generated without blocking errors');
const meshX = footingResult.rebarItems.find(i => i.barMark === '01');
assert(meshX.parameterValues.A === 300, 'Footing mesh hook leg set to designer value 300mm');
assert(meshX.ruleClassification === RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE, 'Footing mesh classified as DESIGNER_PROVIDED_VALUE');

// 5. RETAINING WALL WORKSPACE TEST
console.log('\n--- 5. Testing Retaining Wall Generator ---');
const wallResult = generateRetainingWallBbs({
  H_stem: 3500,
  t_top: 250,
  t_bot: 400,
  B_base: 2500,
  t_base: 450,
  L_wall: 15000, // Exceeds 12m stock
  stemMainDia: 16,
  stemMainSpacing: 150,
  heelAnchorLength: 1000
});

assert(wallResult.validation.isValid, 'Retaining wall generated successfully');
assert(wallResult.validation.warnings.some(w => w.includes('12.0m commercial rebar stock')), '12.0m commercial stock limitation warning raised for 15m wall');
const wallOuterVert = wallResult.rebarItems.find(i => i.barMark === '02');
assert(wallOuterVert.ruleClassification === RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE, 'Outer vertical wall steel classified as DESIGNER_PROVIDED_VALUE');

console.log('\n================================================================');
console.log(`ALL ENGINE TESTS PASSED: ${passedTests}/${totalTests} tests successful.`);
console.log('================================================================');
