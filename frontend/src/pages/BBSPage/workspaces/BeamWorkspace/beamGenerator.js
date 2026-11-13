/**
 * Beam Detailing Generator (Pure Logic & Geometry Engine)
 * 
 * Takes:
 * - Concrete Profile: Span (L_clear), Width (b), Depth (D), Left Support (W_left), Right Support (W_right), Cover (default 25mm)
 * - Longitudinal Bars: Top Hanger Bars (dia, count), Bottom Tension Bars (dia, count), Support Top Extras (dia, count, extent e.g. L/3)
 * - Side Face Bars: auto-suggested if D > 750 mm (IS 456 Clause 26.5.1.6)
 * - Shear Stirrups: Tie Dia, Support Zone Spacing (S_support), Midspan Spacing (S_mid), Support Zone Length (2*D)
 * - Selected Engineering Rule Set: 'RULE_SET_CENTERLINE_EXACT' | 'RULE_SET_IS_PRACTICE'
 */

import { calculateTheoreticalUnitWeight, calculateNominalTradeUnitWeight } from '../../cad/engineeringRules.js';
import { RULE_CLASSIFICATION } from '../common/ruleConstants.js';

export function generateBeamBbs(config = {}) {
  const {
    // 1. Concrete Geometry
    L_clear = 4000,          // Clear span (mm)
    b = 250,                 // Width (mm)
    D = 450,                 // Total Depth (mm)
    W_left = 300,            // Left column support width (mm)
    W_right = 300,           // Right column support width (mm)
    cover = 25,              // Clear cover (mm, IS 456 Table 16 default 25mm)
    concreteGrade = 'M25',
    steelGrade = 'Fe500D',

    // 2. Top & Bottom Main Steel
    topHangerDia = 12,       // Top continuous bars
    topHangerCount = 2,
    bottomMainDia = 16,      // Bottom continuous tension bars
    bottomMainCount = 3,
    supportAnchorHook = null, // Designer input for 90° anchorage leg into column (mm)

    // 3. Support Extra Bars (Curtailment over supports)
    topExtraLeftCount = 2,
    topExtraLeftDia = 16,
    topExtraRightCount = 2,
    topExtraRightDia = 16,
    curtailmentFraction = 0.33, // Designer input: fraction of clear span (e.g. 0.33 = L/3, 0.25 = L/4)

    // 4. Side Face Bars (Crack control)
    includeSideFaceBars = D > 750,
    sideFaceDia = 12,
    sideFaceCountPerFace = 1,

    // 5. Shear Stirrups
    stirrupDia = 8,
    supportSpacing = 100,    // mm c/c near supports
    midspanSpacing = 150,    // mm c/c at midspan
    supportZoneLength = 2 * D, // 2*D from column face (IS 13920 Clause 6.3.5)

    // 6. Engineering Rule Set
    ruleSetId = 'RULE_SET_CENTERLINE_EXACT'
  } = config;

  const rebarItems = [];
  const warnings = [];
  const errors = [];

  const getUnitWeight = (d) => {
    return ruleSetId === 'RULE_SET_IS_PRACTICE'
      ? calculateNominalTradeUnitWeight(d)
      : calculateTheoreticalUnitWeight(d);
  };

  // 1. Validation Checks
  if (D > 750 && !includeSideFaceBars) {
    warnings.push(`Beam depth (${D} mm) exceeds 750 mm. IS 456 Clause 26.5.1.6 requires side face reinforcement for crack control.`);
  }

  // 2. Bottom Main Tension Bars (Shape 11 with 90° anchorage hooks at supports)
  // Length = L_clear + (W_left - cover) + (W_right - cover) + 2 * (anchorage leg into column)
  const anchorLeg = Number(supportAnchorHook) > 0 ? Number(supportAnchorHook) : Math.max(200, 12 * bottomMainDia);
  const bottomCutLength = L_clear + (W_left - cover) + (W_right - cover) + (2 * anchorLeg);
  const bottomUnitWt = getUnitWeight(bottomMainDia);
  const bottomTotWt = ((bottomCutLength * bottomMainCount) / 1000) * bottomUnitWt;

  rebarItems.push({
    barMark: '01',
    description: `Bottom Main Tension Bars (Full Span with 90° Column Anchorage)`,
    shapeCode: 'Shape 11',
    diameter: bottomMainDia,
    barDiameter: bottomMainDia,
    quantity: bottomMainCount,
    bar_count: bottomMainCount,
    spacing: 0,
    cut_length: Math.round(bottomCutLength),
    total_length: Math.round(bottomCutLength * bottomMainCount),
    unit_weight: bottomUnitWt,
    total_weight: bottomTotWt,
    ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
    ruleSource: 'Designer Input: Clear Span + Support Embedment',
    ruleNote: `Span (${L_clear}mm) + Supports (${W_left}+${W_right}mm) + 2×90° Hooks (${anchorLeg}mm)`,
    parameterValues: { L: Math.round(bottomCutLength) },
    calculationTrace: {
      formula: 'Cutting Length = Span + Embedment + Hooks',
      trace: `Cutting Length = ${L_clear} + ${(W_left - cover) + (W_right - cover)} + ${2 * anchorLeg} = ${Math.round(bottomCutLength)} mm`
    }
  });

  // 3. Top Continuous Hanger Bars (Shape 11 or Shape 00)
  const topCutLength = L_clear + (W_left - cover) + (W_right - cover) + (2 * anchorLeg);
  const topUnitWt = getUnitWeight(topHangerDia);
  const topTotWt = ((topCutLength * topHangerCount) / 1000) * topUnitWt;

  rebarItems.push({
    barMark: '02',
    description: `Top Continuous Hanger Bars`,
    shapeCode: 'Shape 11',
    diameter: topHangerDia,
    barDiameter: topHangerDia,
    quantity: topHangerCount,
    bar_count: topHangerCount,
    spacing: 0,
    cut_length: Math.round(topCutLength),
    total_length: Math.round(topCutLength * topHangerCount),
    unit_weight: topUnitWt,
    total_weight: topTotWt,
    ruleClassification: RULE_CLASSIFICATION.DESIGNER_INPUT,
    ruleSource: 'Designer Input: Continuous Hanger Steel',
    ruleNote: `Anchored into end columns`,
    parameterValues: { L: Math.round(topCutLength) },
    calculationTrace: {
      formula: 'Cutting Length = Span + Embedment + Hooks',
      trace: `Cutting Length = ${Math.round(topCutLength)} mm. Total Wt = ${topTotWt.toFixed(2)} kg`
    }
  });

  // 4. Support Extra Top Negative Bars (Curtailment at supports)
  // Left support extra
  if (topExtraLeftCount > 0) {
    const leftCurtailLength = Math.round((L_clear * curtailmentFraction) + (W_left - cover) + anchorLeg);
    const leftExtraUnitWt = getUnitWeight(topExtraLeftDia);
    const leftExtraTotWt = ((leftCurtailLength * topExtraLeftCount) / 1000) * leftExtraUnitWt;

    rebarItems.push({
      barMark: String(rebarItems.length + 1).padStart(2, '0'),
      description: `Top Extra Negative Bars (Left Support Curtailment at L/3)`,
      shapeCode: 'Shape 11',
      diameter: topExtraLeftDia,
      barDiameter: topExtraLeftDia,
      quantity: topExtraLeftCount,
      bar_count: topExtraLeftCount,
      spacing: 0,
      cut_length: leftCurtailLength,
      total_length: leftCurtailLength * topExtraLeftCount,
      unit_weight: leftExtraUnitWt,
      total_weight: leftExtraTotWt,
      ruleClassification: RULE_CLASSIFICATION.DESIGNER_INPUT,
      ruleSource: 'Designer Input: Negative Support Curtailment',
      ruleNote: `Extends ${Math.round(L_clear * curtailmentFraction)}mm into span + Column anchorage`,
      parameterValues: { L: leftCurtailLength }
    });
  }

  // Right support extra
  if (topExtraRightCount > 0) {
    const rightCurtailLength = Math.round((L_clear * curtailmentFraction) + (W_right - cover) + anchorLeg);
    const rightExtraUnitWt = getUnitWeight(topExtraRightDia);
    const rightExtraTotWt = ((rightCurtailLength * topExtraRightCount) / 1000) * rightExtraUnitWt;

    rebarItems.push({
      barMark: String(rebarItems.length + 1).padStart(2, '0'),
      description: `Top Extra Negative Bars (Right Support Curtailment at L/3)`,
      shapeCode: 'Shape 11',
      diameter: topExtraRightDia,
      barDiameter: topExtraRightDia,
      quantity: topExtraRightCount,
      bar_count: topExtraRightCount,
      spacing: 0,
      cut_length: rightCurtailLength,
      total_length: rightCurtailLength * topExtraRightCount,
      unit_weight: rightExtraUnitWt,
      total_weight: rightExtraTotWt,
      ruleClassification: RULE_CLASSIFICATION.DESIGNER_INPUT,
      ruleSource: 'Designer Input: Negative Support Curtailment',
      ruleNote: `Extends ${Math.round(L_clear * curtailmentFraction)}mm into span + Column anchorage`,
      parameterValues: { L: rightCurtailLength }
    });
  }

  // 5. Side Face Bars (Crack control per IS 456 Clause 26.5.1.6 when D > 750 mm)
  if (includeSideFaceBars && sideFaceCountPerFace > 0) {
    const totalSideBars = sideFaceCountPerFace * 2;
    const sideCutLength = L_clear + (W_left - cover) + (W_right - cover);
    const sideUnitWt = getUnitWeight(sideFaceDia);
    const sideTotWt = ((sideCutLength * totalSideBars) / 1000) * sideUnitWt;

    // IS 456 Cl. 26.5.1.6 Statutory Verification:
    // Required area = 0.1% web area = 0.001 * b * D
    // Provided area = totalSideBars * (π * d² / 4)
    const reqSideArea = 0.001 * b * D;
    const provSideArea = totalSideBars * (Math.PI * Math.pow(sideFaceDia / 2, 2));
    const maxAllowedSideSpacing = Math.min(300, b);
    const actualSideSpacing = Math.round((D - (2 * cover)) / (Number(sideFaceCountPerFace) + 1));

    const isAreaCompliant = provSideArea >= reqSideArea;
    const isSpacingCompliant = actualSideSpacing <= maxAllowedSideSpacing;
    const isStatutoryCompliant = isAreaCompliant && isSpacingCompliant;

    if (!isAreaCompliant) {
      warnings.push(`Side-face steel provided (${Math.round(provSideArea)} mm²) is less than IS 456 Cl. 26.5.1.6 mandate of 0.1% web area (${Math.round(reqSideArea)} mm²). Increase bar diameter or count per face.`);
    }
    if (!isSpacingCompliant) {
      warnings.push(`Side-face bar spacing (${actualSideSpacing} mm) exceeds maximum code limit min(300, b) = ${maxAllowedSideSpacing} mm.`);
    }

    rebarItems.push({
      barMark: String(rebarItems.length + 1).padStart(2, '0'),
      description: `Side Face Reinforcement (IS 456 Clause 26.5.1.6 Crack Control)`,
      shapeCode: 'Shape 00',
      diameter: sideFaceDia,
      barDiameter: sideFaceDia,
      quantity: totalSideBars,
      bar_count: totalSideBars,
      spacing: actualSideSpacing,
      cut_length: Math.round(sideCutLength),
      total_length: Math.round(sideCutLength * totalSideBars),
      unit_weight: sideUnitWt,
      total_weight: sideTotWt,
      ruleClassification: isStatutoryCompliant
        ? RULE_CLASSIFICATION.VERIFIED_STATUTORY_RULE
        : RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
      ruleSource: isStatutoryCompliant
        ? 'IS 456:2000 Clause 26.5.1.6 (Area >= 0.1% web area, spacing <= min(300, b))'
        : 'Designer Provided: Area Below Statutory Minimum (Review Required)',
      ruleNote: `${sideFaceCountPerFace} bar(s) per face (Total ${Math.round(provSideArea)}mm² prov vs ${Math.round(reqSideArea)}mm² req)`,
      parameterValues: { L: Math.round(sideCutLength) }
    });
  }

  // 6. Shear Stirrups (Two-legged closed stirrup Shape 51)
  const stirrupLegA = Math.max(50, b - (2 * cover));
  const stirrupLegB = Math.max(50, D - (2 * cover));
  const stirrupCenterA = Math.max(40, stirrupLegA - stirrupDia);
  const stirrupCenterB = Math.max(40, stirrupLegB - stirrupDia);
  const hookExt = Math.max(75, 10 * stirrupDia); // 135° seismic hook per IS 13920

  let stirrupCutLength = 0;
  let stirrupTrace = '';
  if (ruleSetId === 'RULE_SET_IS_PRACTICE') {
    const deduction = 12 * stirrupDia;
    stirrupCutLength = (2 * (stirrupLegA + stirrupLegB)) + (2 * hookExt) - deduction;
    stirrupTrace = `2×(${stirrupLegA} + ${stirrupLegB}) + 2×${hookExt}mm - ${deduction}mm (IS 12d Bend Deductions)`;
  } else {
    stirrupCutLength = (2 * (stirrupCenterA + stirrupCenterB)) + (2 * hookExt);
    stirrupTrace = `2×(${stirrupCenterA} + ${stirrupCenterB}) [Centerline] + 2×${hookExt}mm (10d seismic hooks)`;
  }

  // Stirrup Zones:
  // Support zones at both ends: length = 2 * D from column face (IS 13920 Clause 6.3.5)
  const zoneL = Math.min(supportZoneLength, L_clear / 3);
  const nSupportEach = Math.max(1, Math.ceil(zoneL / supportSpacing));
  const nSupportTotal = nSupportEach * 2;

  const midspanLength = Math.max(0, L_clear - (2 * zoneL));
  const nMidspan = midspanLength > 0 ? Math.max(1, Math.floor(midspanLength / midspanSpacing)) : 0;
  const totalStirrups = nSupportTotal + nMidspan;

  const stirrupUnitWt = getUnitWeight(stirrupDia);
  const stirrupTotWt = ((stirrupCutLength * totalStirrups) / 1000) * stirrupUnitWt;

  rebarItems.push({
    barMark: String(rebarItems.length + 1).padStart(2, '0'),
    description: `Shear Stirrups (${nSupportTotal} support zone @ ${supportSpacing}mm + ${nMidspan} midspan @ ${midspanSpacing}mm)`,
    shapeCode: 'Shape 51',
    diameter: stirrupDia,
    barDiameter: stirrupDia,
    quantity: totalStirrups,
    bar_count: totalStirrups,
    spacing: supportSpacing,
    cut_length: Math.round(stirrupCutLength),
    total_length: Math.round(stirrupCutLength * totalStirrups),
    unit_weight: stirrupUnitWt,
    total_weight: stirrupTotWt,
    ruleClassification: RULE_CLASSIFICATION.VERIFIED_STATUTORY_RULE,
    ruleSource: 'IS 13920:2016 Clause 6.3.5 & Clause 5.2.2 (Seismic Stirrups)',
    ruleNote: `Outer tie: ${stirrupLegA} × ${stirrupLegB} mm with 135° hooks`,
    parameterValues: {
      A: Math.round(ruleSetId === 'RULE_SET_CENTERLINE_EXACT' ? stirrupCenterA : stirrupLegA),
      B: Math.round(ruleSetId === 'RULE_SET_CENTERLINE_EXACT' ? stirrupCenterB : stirrupLegB),
      HOOK: Math.round(hookExt)
    },
    calculationTrace: {
      formula: 'Cutting Length = 2(A + B) + 2(Hook Allowance) - Bend Deductions',
      trace: `Cutting Length = ${stirrupTrace} = ${Math.round(stirrupCutLength)} mm. Total Wt = ${stirrupTotWt.toFixed(2)} kg`
    }
  });

  // Summary Metrics
  const totalSteelWeight = rebarItems.reduce((sum, item) => sum + (Number(item.total_weight) || 0), 0);
  const totalBarCount = rebarItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const concreteVolume = (b * D * L_clear) / 1e9;
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
      stirrupLegA,
      stirrupLegB
    }
  };
}
