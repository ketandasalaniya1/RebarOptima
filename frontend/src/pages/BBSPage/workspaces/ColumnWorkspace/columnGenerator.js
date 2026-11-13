/**
 * Column Detailing Generator (Pure Logic & Geometry Engine)
 * 
 * Takes:
 * - Concrete Dimensions: Width (B), Depth (D), Clear Height (H_clear), Beam Depth (D_beam), Slab Thickness (t_slab), Clear Cover (C)
 * - Longitudinal Bars: Corner Bars (dia, count=4), Face-X Bars (dia, count), Face-Y Bars (dia, count)
 * - Boundary Condition: 'INTERMEDIATE' | 'STARTER' | 'ROOF'
 * - Lap & Splice: Lap Mode ('MULTIPLIER' | 'EXPLICIT'), Lap Value (e.g. 50d or 1000mm), Staggering (false | true), Crank Offset (0 or mm)
 * - Lateral Ties: Tie Diameter (d_tie), Confinement Zone Height (L_o), Confinement Spacing (S_conf), Middle Spacing (S_mid), First Tie Offset (50mm), Joint Ties (boolean), Link Config ('OUTER' | 'DIAMOND' | 'CROSS')
 * - Selected Engineering Rule Set: 'RULE_SET_CENTERLINE_EXACT' | 'RULE_SET_IS_PRACTICE'
 * 
 * Returns:
 * - rebarItems: Array of structured schedule rows with shape codes, parameters, cutting lengths, weights, calculation trace, and rule classifications.
 * - summary: { totalSteelWeight, concreteVolume, rebarRatio, barCount, distinctDiameters }
 * - validation: { isValid, warnings, errors, clearSpacingX, clearSpacingY }
 */

import { calculateTheoreticalUnitWeight, calculateNominalTradeUnitWeight } from '../../cad/engineeringRules.js';
import { RULE_CLASSIFICATION } from '../common/ruleConstants.js';

export function generateColumnBbs(config = {}) {
  const {
    // 1. Concrete Profile
    B = 300,                  // Width (mm)
    D = 450,                  // Depth (mm)
    H_clear = 3000,           // Clear story height (mm)
    D_beam = 450,             // Depth of beam above (mm)
    t_slab = 150,             // Floor slab thickness (mm)
    cover = 40,               // Clear cover (mm)
    concreteGrade = 'M25',
    steelGrade = 'Fe500D',

    // 2. Longitudinal Rebar
    cornerDia = 20,           // 4 Corner Bars
    faceXCount = 2,           // Number of bars on each depth face (total = 2 * count)
    faceXDia = 16,
    faceYCount = 0,           // Number of bars on each width face (total = 2 * count)
    faceYDia = 16,

    // 3. Boundary & Laps
    boundaryCondition = 'INTERMEDIATE', // 'INTERMEDIATE' | 'STARTER' | 'ROOF'
    lapMode = 'MULTIPLIER',   // 'MULTIPLIER' (e.g. 50d) | 'EXPLICIT' (mm)
    lapMultiplier = 50,
    explicitLapLength = 1000,
    staggerLaps = false,
    staggerOffsetMm = 750,
    crankOffset = 0,          // For column size reduction at upper floor
    starterEmbedmentDepth = 450, // Designer input for footing pad embedment (mm)
    starterBendFoot = null,      // Designer input for 90° footing anchor foot (mm)
    roofAnchorageLeg = null,     // Designer input for 90° roof node anchorage hook (mm)

    // 4. Lateral Ties
    tieDia = 8,
    customConfinementHeight = null, // null for auto L_o
    confinementSpacing = 100, // mm c/c
    middleSpacing = 150,      // mm c/c
    includeJointTies = false,
    linkConfig = 'DIAMOND',   // 'OUTER' | 'DIAMOND' | 'CROSS'

    // 5. Engineering Rule Model
    ruleSetId = 'RULE_SET_CENTERLINE_EXACT' // 'RULE_SET_CENTERLINE_EXACT' | 'RULE_SET_IS_PRACTICE'
  } = config;

  const rebarItems = [];
  const warnings = [];
  const errors = [];

  // Helper unit weight
  const getUnitWeight = (d) => {
    return ruleSetId === 'RULE_SET_IS_PRACTICE'
      ? calculateNominalTradeUnitWeight(d)
      : calculateTheoreticalUnitWeight(d);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CLEAR SPACING VALIDATION (IS 456 Clause 26.3.2)
  // ──────────────────────────────────────────────────────────────────────────
  const totalBarsX = 2 + (Number(faceXCount) || 0); // Along Depth face D
  const totalBarsY = 2 + (Number(faceYCount) || 0); // Along Width face B

  // Available width between ties inside core:
  const coreWidth = B - (2 * cover) - (2 * tieDia);
  const coreDepth = D - (2 * cover) - (2 * tieDia);

  const clearSpacingX = totalBarsX > 1 ? (coreDepth - (totalBarsX * cornerDia)) / (totalBarsX - 1) : coreDepth;
  const clearSpacingY = totalBarsY > 1 ? (coreWidth - (totalBarsY * cornerDia)) / (totalBarsY - 1) : coreWidth;

  const minAllowableSpacing = Math.max(20, cornerDia, 25); // 20mm or bar dia or agg size + 5mm
  if (clearSpacingX < minAllowableSpacing) {
    warnings.push(`Vertical bar clear spacing along depth (${Math.round(clearSpacingX)} mm) is less than code minimum (${minAllowableSpacing} mm). Risk of concrete honeycombing.`);
  }
  if (clearSpacingY < minAllowableSpacing) {
    warnings.push(`Vertical bar clear spacing along width (${Math.round(clearSpacingY)} mm) is less than code minimum (${minAllowableSpacing} mm).`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. LONGITUDINAL VERTICAL BARS
  // ──────────────────────────────────────────────────────────────────────────
  // Calculate Lap Length for Corner and Face bars
  const getLapLength = (d) => {
    if (lapMode === 'EXPLICIT') return Number(explicitLapLength) || 1000;
    return (Number(lapMultiplier) || 50) * d;
  };

  const cornerLap = getLapLength(cornerDia);
  const faceXLap = getLapLength(faceXDia);
  const faceYLap = getLapLength(faceYDia);

  // Compute Vertical Cut Length based on Boundary Condition
  // Intermediate Lift: H_clear + D_beam + Lap + Crank addition
  // Crank addition per IS 456 Clause 26.5.3.1: 1:6 slope addition = 0.083 * crankOffset
  const crankAddition = crankOffset > 0 ? (0.083 * crankOffset) : 0;

  let cornerCutLength = 0;
  let cornerShapeCode = 'Shape 00';
  let cornerDescription = 'Main Corner Bars';
  let cornerRuleNote = '';

  const actualFootingHook = Number(starterBendFoot) > 0 ? Number(starterBendFoot) : Math.max(300, 12 * cornerDia);
  const actualEmbedment = Number(starterEmbedmentDepth) > 0 ? Number(starterEmbedmentDepth) : 450;
  const actualRoofHook = Number(roofAnchorageLeg) > 0 ? Number(roofAnchorageLeg) : Math.max(300, 16 * cornerDia);

  if (boundaryCondition === 'INTERMEDIATE') {
    cornerCutLength = H_clear + D_beam + cornerLap + crankAddition;
    cornerShapeCode = crankOffset > 0 ? 'Shape 41' : 'Shape 00';
    cornerDescription = 'Main Corner Bars (Intermediate Lift)';
    cornerRuleNote = `H_clear (${H_clear}mm) + D_beam (${D_beam}mm) + Lap (${cornerLap}mm)${crankAddition > 0 ? ` + Crank (${Math.round(crankAddition)}mm)` : ''}`;
  } else if (boundaryCondition === 'STARTER') {
    // Starts in footing with 90° horizontal leg
    cornerCutLength = actualFootingHook + actualEmbedment + cornerLap;
    cornerShapeCode = 'Shape 11'; // L-bar
    cornerDescription = 'Main Corner Starter Dowels (Footing Lift)';
    cornerRuleNote = `Footing 90° Hook (${actualFootingHook}mm) + Embedment (${actualEmbedment}mm) + Lap (${cornerLap}mm)`;
  } else if (boundaryCondition === 'ROOF') {
    // Terminating at roof level with 90° anchorage leg into roof beam/slab
    cornerCutLength = H_clear + D_beam + actualRoofHook;
    cornerShapeCode = 'Shape 11'; // L-bar
    cornerDescription = 'Main Corner Bars (Roof Termination Lift)';
    cornerRuleNote = `H_clear (${H_clear}mm) + D_beam (${D_beam}mm) + 90° Anchorage (${actualRoofHook}mm)`;
  }

  // Corner Bars: Handle Staggered Laps if selected
  const cornerUnitWt = getUnitWeight(cornerDia);
  if (staggerLaps && boundaryCondition === 'INTERMEDIATE') {
    const cutA = Math.round(cornerCutLength);
    const cutB = Math.round(cornerCutLength + staggerOffsetMm);
    const wtA = ((cutA * 2) / 1000) * cornerUnitWt;
    const wtB = ((cutB * 2) / 1000) * cornerUnitWt;

    rebarItems.push({
      barMark: '01A',
      description: `${cornerDescription} [Stagger Group A]`,
      shapeCode: cornerShapeCode,
      diameter: cornerDia,
      barDiameter: cornerDia,
      quantity: 2,
      bar_count: 2,
      spacing: 0,
      cut_length: cutA,
      total_length: cutA * 2,
      unit_weight: cornerUnitWt,
      total_weight: wtA,
      ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
      ruleSource: 'Designer Input: Clear Height + Lap (50% Staggered)',
      ruleNote: `${cornerRuleNote} — Standard height`,
      parameterValues: { L: cutA },
      calculationTrace: {
        formula: 'Cutting Length = Segment Lengths',
        trace: `Cut Length = ${cutA} mm (2 bars). Weight = ${wtA.toFixed(2)} kg`
      }
    });

    rebarItems.push({
      barMark: '01B',
      description: `${cornerDescription} [Stagger Group B: +${staggerOffsetMm}mm]`,
      shapeCode: cornerShapeCode,
      diameter: cornerDia,
      barDiameter: cornerDia,
      quantity: 2,
      bar_count: 2,
      spacing: 0,
      cut_length: cutB,
      total_length: cutB * 2,
      unit_weight: cornerUnitWt,
      total_weight: wtB,
      ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
      ruleSource: 'Designer Input: Clear Height + Lap + Stagger Offset',
      ruleNote: `${cornerRuleNote} + ${staggerOffsetMm}mm splice stagger`,
      parameterValues: { L: cutB },
      calculationTrace: {
        formula: 'Cutting Length = Base Length + Stagger Offset',
        trace: `Cut Length = ${cutB} mm (2 bars). Weight = ${wtB.toFixed(2)} kg`
      }
    });
  } else {
    const cornerQty = 4;
    const cornerTotWt = ((cornerCutLength * cornerQty) / 1000) * cornerUnitWt;

    rebarItems.push({
      barMark: '01',
      description: cornerDescription,
      shapeCode: cornerShapeCode,
      diameter: cornerDia,
      barDiameter: cornerDia,
      quantity: cornerQty,
      bar_count: cornerQty,
      spacing: 0,
      cut_length: Math.round(cornerCutLength),
      total_length: Math.round(cornerCutLength * cornerQty),
      unit_weight: cornerUnitWt,
      total_weight: cornerTotWt,
      ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
      ruleSource: 'Designer Input: Clear Height + Lap Allowance',
      ruleNote: cornerRuleNote,
      parameterValues: { L: Math.round(cornerCutLength), A: Math.round(cornerCutLength) },
      calculationTrace: {
        formula: 'Cutting Length = Segment Lengths along Profile',
        trace: `Cutting Length = ${Math.round(cornerCutLength)} mm. Total Weight = ${(cornerCutLength * cornerQty / 1000).toFixed(2)}m × ${cornerUnitWt.toFixed(3)} kg/m = ${cornerTotWt.toFixed(2)} kg`
      }
    });
  }

  // Face-X Intermediate Bars (Along Depth D)
  const totalFaceXQty = (Number(faceXCount) || 0) * 2;
  if (totalFaceXQty > 0) {
    let faceXCutLength = 0;
    let faceXShapeCode = 'Shape 00';
    if (boundaryCondition === 'INTERMEDIATE') {
      faceXCutLength = H_clear + D_beam + faceXLap + crankAddition;
      faceXShapeCode = crankOffset > 0 ? 'Shape 41' : 'Shape 00';
    } else if (boundaryCondition === 'STARTER') {
      const faceFoot = Number(starterBendFoot) > 0 ? Number(starterBendFoot) : Math.max(300, 12 * faceXDia);
      faceXCutLength = faceFoot + actualEmbedment + faceXLap;
      faceXShapeCode = 'Shape 11';
    } else {
      const faceRoof = Number(roofAnchorageLeg) > 0 ? Number(roofAnchorageLeg) : Math.max(300, 16 * faceXDia);
      faceXCutLength = H_clear + D_beam + faceRoof;
      faceXShapeCode = 'Shape 11';
    }

    const faceXUnitWt = getUnitWeight(faceXDia);
    const faceXTotWt = ((faceXCutLength * totalFaceXQty) / 1000) * faceXUnitWt;

    rebarItems.push({
      barMark: String(rebarItems.length + 1).padStart(2, '0'),
      description: `Face-X Longitudinal Bars (Along Depth ${D}mm)`,
      shapeCode: faceXShapeCode,
      diameter: faceXDia,
      barDiameter: faceXDia,
      quantity: totalFaceXQty,
      bar_count: totalFaceXQty,
      spacing: Math.round(clearSpacingX),
      cut_length: Math.round(faceXCutLength),
      total_length: Math.round(faceXCutLength * totalFaceXQty),
      unit_weight: faceXUnitWt,
      total_weight: faceXTotWt,
      ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
      ruleSource: 'Designer Input: Clear Height + Face Lap Allowance',
      ruleNote: `Face-X Intermediate bars (${faceXCount} per face = ${totalFaceXQty} total)`,
      parameterValues: { L: Math.round(faceXCutLength) },
      calculationTrace: {
        formula: 'Cutting Length = Segment Lengths',
        trace: `Cutting Length = ${Math.round(faceXCutLength)} mm. Total Wt = ${faceXTotWt.toFixed(2)} kg`
      }
    });
  }

  // Face-Y Intermediate Bars (Along Width B)
  const totalFaceYQty = (Number(faceYCount) || 0) * 2;
  if (totalFaceYQty > 0) {
    let faceYCutLength = 0;
    let faceYShapeCode = 'Shape 00';
    if (boundaryCondition === 'INTERMEDIATE') {
      faceYCutLength = H_clear + D_beam + faceYLap + crankAddition;
      faceYShapeCode = crankOffset > 0 ? 'Shape 41' : 'Shape 00';
    } else if (boundaryCondition === 'STARTER') {
      const faceFoot = Number(starterBendFoot) > 0 ? Number(starterBendFoot) : Math.max(300, 12 * faceYDia);
      faceYCutLength = faceFoot + actualEmbedment + faceYLap;
      faceYShapeCode = 'Shape 11';
    } else {
      const faceRoof = Number(roofAnchorageLeg) > 0 ? Number(roofAnchorageLeg) : Math.max(300, 16 * faceYDia);
      faceYCutLength = H_clear + D_beam + faceRoof;
      faceYShapeCode = 'Shape 11';
    }

    const faceYUnitWt = getUnitWeight(faceYDia);
    const faceYTotWt = ((faceYCutLength * totalFaceYQty) / 1000) * faceYUnitWt;

    rebarItems.push({
      barMark: String(rebarItems.length + 1).padStart(2, '0'),
      description: `Face-Y Longitudinal Bars (Along Width ${B}mm)`,
      shapeCode: faceYShapeCode,
      diameter: faceYDia,
      barDiameter: faceYDia,
      quantity: totalFaceYQty,
      bar_count: totalFaceYQty,
      spacing: Math.round(clearSpacingY),
      cut_length: Math.round(faceYCutLength),
      total_length: Math.round(faceYCutLength * totalFaceYQty),
      unit_weight: faceYUnitWt,
      total_weight: faceYTotWt,
      ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
      ruleSource: 'Designer Input: Clear Height + Face Lap Allowance',
      ruleNote: `Face-Y Intermediate bars (${faceYCount} per face = ${totalFaceYQty} total)`,
      parameterValues: { L: Math.round(faceYCutLength) },
      calculationTrace: {
        formula: 'Cutting Length = Segment Lengths',
        trace: `Cutting Length = ${Math.round(faceYCutLength)} mm. Total Wt = ${faceYTotWt.toFixed(2)} kg`
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. LATERAL TIES & REINFORCEMENT ZONES (IS 13920 Clause 7.6.1)
  // ──────────────────────────────────────────────────────────────────────────
  // Confinement zone length L_o = max(B, D, H_clear / 6, 450 mm)
  const defaultLo = Math.max(B, D, Math.round(H_clear / 6), 450);
  const Lo = Number(customConfinementHeight) > 0 ? Number(customConfinementHeight) : defaultLo;

  // First tie offset = 50 mm (IS 13920 Clause 7.6.1.3)
  const firstTieOffset = 50;

  // Quantity in Lower Confinement Zone: (Lo - 50) / S_conf + 1
  const nLower = Math.max(1, Math.ceil((Lo - firstTieOffset) / confinementSpacing) + 1);

  // Quantity in Upper Confinement Zone: Lo / S_conf
  const nUpper = Math.max(1, Math.ceil(Lo / confinementSpacing));

  // Quantity in Middle Zone: (H_clear - 2 * Lo) / S_mid
  const middleHeight = Math.max(0, H_clear - (2 * Lo));
  const nMiddle = middleHeight > 0 ? Math.max(1, Math.floor(middleHeight / middleSpacing)) : 0;

  // Quantity in Beam-Column Joint (if selected):
  const nJoint = includeJointTies ? Math.max(1, Math.ceil(D_beam / confinementSpacing)) : 0;

  const totalTieCount = nLower + nUpper + nMiddle + nJoint;

  // Stirrup Dimensions:
  // Out-to-out of tie (for fabrication forming):
  const tieLegA = Math.max(50, B - (2 * cover));
  const tieLegB = Math.max(50, D - (2 * cover));

  // True neutral axis centerline dimensions:
  const tieCenterA = Math.max(40, tieLegA - tieDia);
  const tieCenterB = Math.max(40, tieLegB - tieDia);

  // Hook extension for 135° seismic hook: 10 * tieDia (min 75 mm) per IS 13920 Clause 5.2.2
  const hookExtension = Math.max(75, 10 * tieDia);

  let tieCuttingLength = 0;
  let tieFormulaTrace = '';

  if (ruleSetId === 'RULE_SET_IS_PRACTICE') {
    // IS Practice: 2*(A_out + B_out) + 2*Hook - 12d bend deductions
    const bendDeduction = 12 * tieDia;
    tieCuttingLength = (2 * (tieLegA + tieLegB)) + (2 * hookExtension) - bendDeduction;
    tieFormulaTrace = `2×(${tieLegA} + ${tieLegB}) + 2×${hookExtension}mm (135° hooks) - ${bendDeduction}mm (IS 12d Bend Deductions)`;
  } else {
    // RULE_SET_CENTERLINE_EXACT: Exact neutral axis centerline perimeter
    tieCuttingLength = (2 * (tieCenterA + tieCenterB)) + (2 * hookExtension);
    tieFormulaTrace = `2×(${tieCenterA} + ${tieCenterB}) [Centerline] + 2×${hookExtension}mm (10d seismic hook extensions)`;
  }

  const tieUnitWt = getUnitWeight(tieDia);
  const outerTieTotWt = ((tieCuttingLength * totalTieCount) / 1000) * tieUnitWt;

  // Item: Outer Rectangular Stirrup
  rebarItems.push({
    barMark: String(rebarItems.length + 1).padStart(2, '0'),
    description: `Outer Rectangular Stirrups (${nLower} lower + ${nMiddle} mid + ${nUpper} upper${nJoint > 0 ? ` + ${nJoint} joint` : ''})`,
    shapeCode: 'Shape 51',
    diameter: tieDia,
    barDiameter: tieDia,
    quantity: totalTieCount,
    bar_count: totalTieCount,
    spacing: confinementSpacing, // primary confinement spacing
    cut_length: Math.round(tieCuttingLength),
    total_length: Math.round(tieCuttingLength * totalTieCount),
    unit_weight: tieUnitWt,
    total_weight: outerTieTotWt,
    ruleClassification: RULE_CLASSIFICATION.VERIFIED_STATUTORY_RULE,
    ruleSource: 'IS 13920:2016 Clause 5.2.2 & 7.6.1 (135° Hooks, Confinement Zones)',
    ruleNote: `Lower (${nLower} pcs @ ${confinementSpacing}mm), Middle (${nMiddle} pcs @ ${middleSpacing}mm), Upper (${nUpper} pcs @ ${confinementSpacing}mm)`,
    parameterValues: {
      A: Math.round(ruleSetId === 'RULE_SET_CENTERLINE_EXACT' ? tieCenterA : tieLegA),
      B: Math.round(ruleSetId === 'RULE_SET_CENTERLINE_EXACT' ? tieCenterB : tieLegB),
      HOOK: Math.round(hookExtension)
    },
    calculationTrace: {
      formula: 'Cutting Length = 2(A + B) + 2(Hook Allowance) - Bend Deductions',
      trace: `Cutting Length = ${tieFormulaTrace} = ${Math.round(tieCuttingLength)} mm. Total Wt = ${outerTieTotWt.toFixed(2)} kg`
    }
  });

  // Inner Diamond Stirrup (Shape 61) if selected or if 8 bars are present
  if (linkConfig === 'DIAMOND' && (totalBarsX > 2 || totalBarsY > 2)) {
    // Diamond link connects intermediate face bars:
    // Diagonal sides = 4 * sqrt((tieLegA/2)^2 + (tieLegB/2)^2)
    const diagSide = Math.sqrt(Math.pow(tieLegA / 2, 2) + Math.pow(tieLegB / 2, 2));
    const diamondPerimeter = 4 * diagSide;
    const diamondCutLength = Math.round(diamondPerimeter + (2 * hookExtension));
    const diamondTotWt = ((diamondCutLength * totalTieCount) / 1000) * tieUnitWt;

    rebarItems.push({
      barMark: String(rebarItems.length + 1).padStart(2, '0'),
      description: `Inner Diamond Stirrup Links (Binds 4 Intermediate Face Bars)`,
      shapeCode: 'Shape 61',
      diameter: tieDia,
      barDiameter: tieDia,
      quantity: totalTieCount,
      bar_count: totalTieCount,
      spacing: confinementSpacing,
      cut_length: diamondCutLength,
      total_length: Math.round(diamondCutLength * totalTieCount),
      unit_weight: tieUnitWt,
      total_weight: diamondTotWt,
      ruleClassification: RULE_CLASSIFICATION.PURE_GEOMETRIC_MATH,
      ruleSource: 'Pure Geometric Euclidean Calculation (IS 13920 Cl. 7.6.2 allows internal links)',
      ruleNote: `4 legs × ${Math.round(diagSide)}mm + 2×${hookExtension}mm seismic hooks`,
      parameterValues: {
        A: Math.round(diagSide),
        B: Math.round(diagSide),
        HOOK: Math.round(hookExtension)
      },
      calculationTrace: {
        formula: 'Cutting Length = 4 × Diagonal Side + 2 × Hook',
        trace: `Cutting Length = 4 × ${Math.round(diagSide)}mm + 2×${hookExtension}mm = ${diamondCutLength} mm`
      }
    });
  }

  // Cross-Ties (Shape 31 / J-Hooks) if selected
  if (linkConfig === 'CROSS') {
    const crossLeg = tieLegB; // across depth
    const crossCutLength = Math.round(crossLeg + (2 * hookExtension));
    const crossTotWt = ((crossCutLength * totalTieCount) / 1000) * tieUnitWt;

    rebarItems.push({
      barMark: String(rebarItems.length + 1).padStart(2, '0'),
      description: `Cross-Tie Links (Restrains Intermediate Bars Across Depth)`,
      shapeCode: 'Shape 31',
      diameter: tieDia,
      barDiameter: tieDia,
      quantity: totalTieCount,
      bar_count: totalTieCount,
      spacing: confinementSpacing,
      cut_length: crossCutLength,
      total_length: Math.round(crossCutLength * totalTieCount),
      unit_weight: tieUnitWt,
      total_weight: crossTotWt,
      ruleClassification: RULE_CLASSIFICATION.PURE_GEOMETRIC_MATH,
      ruleSource: 'Pure Geometric Euclidean Calculation (IS 13920 Cl. 7.6.2 allows cross-ties)',
      ruleNote: `Single leg ${crossLeg}mm with 135° and 90° hooks`,
      parameterValues: { A: Math.round(crossLeg) },
      calculationTrace: {
        formula: 'Cutting Length = Leg + 2 × Hooks',
        trace: `Cutting Length = ${crossLeg} + 2×${hookExtension} = ${crossCutLength} mm`
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. SUMMARY METRICS
  // ──────────────────────────────────────────────────────────────────────────
  const totalSteelWeight = rebarItems.reduce((sum, item) => sum + (Number(item.total_weight) || 0), 0);
  const totalBarCount = rebarItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const concreteVolume = (B * D * (H_clear + D_beam)) / 1e9; // mm³ → m³
  const rebarRatio = concreteVolume > 0 ? (totalSteelWeight / concreteVolume) : 0;

  const distinctDiameters = Array.from(new Set(rebarItems.map(item => item.diameter))).sort((a, b) => a - b);

  return {
    rebarItems,
    summary: {
      totalSteelWeight: Math.round(totalSteelWeight * 100) / 100,
      concreteVolume: Math.round(concreteVolume * 1000) / 1000,
      rebarRatio: Math.round(rebarRatio * 10) / 10,
      barCount: totalBarCount,
      distinctDiameters
    },
    validation: {
      isValid: errors.length === 0,
      errors,
      warnings,
      clearSpacingX: Math.round(clearSpacingX),
      clearSpacingY: Math.round(clearSpacingY),
      Lo: Math.round(Lo)
    }
  };
}
