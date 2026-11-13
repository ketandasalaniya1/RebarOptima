/**
 * Slab Detailing Generator (Pure Logic & Geometry Engine)
 * 
 * Takes:
 * - Dimensions: Shorter Span (Lx), Longer Span (Ly), Thickness (t), Clear Cover (default 20mm per IS 456)
 * - Spanning Type: Auto-detected (One-Way if Ly/Lx > 2, Two-Way if Ly/Lx <= 2) or Designer Selected
 * - Main Reinforcement (Along Lx): Dia, Spacing (c/c)
 * - Distribution / Transverse Reinforcement (Along Ly): Dia, Spacing (c/c)
 * - Support Negative Extra Bars: Dia, Spacing, Extent (e.g. 0.25*Lx or 0.3*Lx)
 * - Crank Options: Bent-up alternate bars (45° = 0.42h, 30° = 0.27h)
 */

import { calculateTheoreticalUnitWeight, calculateNominalTradeUnitWeight } from '../../cad/engineeringRules.js';
import { RULE_CLASSIFICATION } from '../common/ruleConstants.js';

export function generateSlabBbs(config = {}) {
  const {
    Lx = 3000,                // Shorter clear span (mm)
    Ly = 4500,                // Longer clear span (mm)
    t = 150,                  // Slab thickness (mm)
    cover = 20,               // Clear cover (mm, IS 456 Table 16 default 20mm)
    concreteGrade = 'M20',
    steelGrade = 'Fe500D',

    spanningType = Ly / Lx > 2 ? 'ONE_WAY' : 'TWO_WAY', // 'ONE_WAY' | 'TWO_WAY'

    // Bottom Main Steel (Shorter span Lx)
    mainDia = 10,
    mainSpacing = 150,        // mm c/c
    mainEndHook = 100,        // 90° hook at beam supports (mm)

    // Distribution / Secondary Steel (Longer span Ly)
    distDia = 8,
    distSpacing = 150,        // mm c/c
    distEndHook = 100,

    // Top Negative Support Extra Bars
    includeTopExtras = true,
    topExtraDia = 8,
    topExtraSpacing = 200,    // mm c/c
    topExtraFraction = 0.25,  // 0.25*Lx into span
    topAnchorHook = 100,      // mm

    // Cranked Bar Option
    useCrankedBars = false,
    crankAngle = 45,          // 45° (0.42h) or 30° (0.27h)
    supportCondition = 'DISCONTINUOUS', // 'DISCONTINUOUS' | 'CONTINUOUS'

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

  // Check Spanning Ratio
  const spanRatio = (Ly / Lx).toFixed(2);
  if (spanRatio > 2 && spanningType === 'TWO_WAY') {
    warnings.push(`Aspect ratio Ly/Lx = ${spanRatio} > 2.0. By IS 456 Clause 24.1, slabs with aspect ratio > 2 normally act as One-Way slabs.`);
  }

  // Statutory Minimum Reinforcement Check (IS 456:2000 Clause 26.5.2.1)
  // For Fe415/Fe500 HYSD: 0.12% of total cross-sectional area (b * D); for Mild Steel: 0.15%
  const isHysd = String(steelGrade).toUpperCase().includes('500') || String(steelGrade).toUpperCase().includes('415');
  const minPercent = isHysd ? 0.0012 : 0.0015;
  const minAreaPerMeter = minPercent * 1000 * t; // mm²/m

  const mainAreaPerMeter = (1000 / mainSpacing) * (Math.PI * Math.pow(mainDia, 2) / 4);
  const distAreaPerMeter = (1000 / distSpacing) * (Math.PI * Math.pow(distDia, 2) / 4);

  if (mainAreaPerMeter < minAreaPerMeter) {
    warnings.push(`Main reinforcement area (${Math.round(mainAreaPerMeter)} mm²/m) is less than IS 456 Cl 26.5.2.1 minimum (${Math.round(minAreaPerMeter)} mm²/m for ${steelGrade}). Increase diameter or reduce spacing.`);
  }

  if (distAreaPerMeter < minAreaPerMeter) {
    warnings.push(`Distribution reinforcement area (${Math.round(distAreaPerMeter)} mm²/m) is less than IS 456 Cl 26.5.2.1 minimum (${Math.round(minAreaPerMeter)} mm²/m for ${steelGrade}). Increase diameter or reduce spacing.`);
  }

  // Maximum Bar Spacing Check (IS 456:2000 Clause 26.5.2.2)
  const d_eff = Math.max(50, t - cover - (mainDia / 2));
  const maxMainSpacing = Math.min(3 * d_eff, 300);
  if (mainSpacing > maxMainSpacing) {
    warnings.push(`Main bar spacing (${mainSpacing} mm) exceeds IS 456 Cl 26.5.2.2 limit of min(3d, 300mm) = ${Math.round(maxMainSpacing)} mm.`);
  }

  const maxDistSpacing = Math.min(5 * d_eff, 450);
  if (distSpacing > maxDistSpacing) {
    warnings.push(`Distribution bar spacing (${distSpacing} mm) exceeds IS 456 Cl 26.5.2.2 limit of min(5d, 450mm) = ${Math.round(maxDistSpacing)} mm.`);
  }

  // 1. Bottom Main Bars (Parallel to shorter span Lx, distributed across Ly)
  const mainClearWidth = Ly - (2 * cover);
  const mainBarCount = Math.max(2, Math.ceil(mainClearWidth / mainSpacing) + 1);

  // Core internal depth for cranks: h = t - 2*cover - mainDia
  const crankH = Math.max(20, t - (2 * cover) - mainDia);
  // Pure geometric math: crank addition = (sec(theta) - 1)*h. For 45°: 0.414h ~ 0.42h; for 30°: 0.268h ~ 0.27h
  const crankMultiplier = Number(crankAngle) === 30 ? 0.27 : 0.42;
  const crankAddition = useCrankedBars ? (crankMultiplier * crankH) : 0;

  const actualMainHook = supportCondition === 'CONTINUOUS' ? 0 : mainEndHook;
  const mainCutLength = (Lx - (2 * cover)) + (2 * actualMainHook) + crankAddition;
  const mainUnitWt = getUnitWeight(mainDia);
  const mainTotWt = ((mainCutLength * mainBarCount) / 1000) * mainUnitWt;

  rebarItems.push({
    barMark: '01',
    description: `Bottom Main Reinforcement (Along Shorter Span ${Lx} mm)${useCrankedBars ? ` [Cranked ${crankAngle}° (${crankMultiplier}h)]` : ''}`,
    shapeCode: useCrankedBars ? 'Shape 41' : (actualMainHook > 0 ? 'Shape 11' : 'Shape 00'),
    diameter: mainDia,
    barDiameter: mainDia,
    quantity: mainBarCount,
    bar_count: mainBarCount,
    spacing: mainSpacing,
    cut_length: Math.round(mainCutLength),
    total_length: Math.round(mainCutLength * mainBarCount),
    unit_weight: mainUnitWt,
    total_weight: mainTotWt,
    ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
    ruleSource: 'Designer Input: Span, Diameter & Spacing (IS 456 Cl 26.5.2.2 limit verified)',
    ruleNote: `${mainBarCount} bars @ ${mainSpacing}mm c/c across width ${Ly}mm${useCrankedBars ? ` (crank +${Math.round(crankAddition)}mm)` : ''}`,
    parameterValues: { L: Math.round(mainCutLength) },
    calculationTrace: {
      formula: 'Cut Length = Span - 2*Cover + 2*EndHooks' + (useCrankedBars ? ` + ${crankMultiplier}*h` : ''),
      trace: `Cut Length = ${Lx} - ${2 * cover} + ${2 * actualMainHook}${useCrankedBars ? ` + ${Math.round(crankAddition)}` : ''} = ${Math.round(mainCutLength)} mm`
    }
  });

  // 2. Bottom Distribution / Secondary Steel (Parallel to longer span Ly, distributed across Lx)
  const distClearWidth = Lx - (2 * cover);
  const distBarCount = Math.max(2, Math.ceil(distClearWidth / distSpacing) + 1);

  const actualDistHook = supportCondition === 'CONTINUOUS' ? 0 : distEndHook;
  const distCutLength = (Ly - (2 * cover)) + (2 * actualDistHook);
  const distUnitWt = getUnitWeight(distDia);
  const distTotWt = ((distCutLength * distBarCount) / 1000) * distUnitWt;

  rebarItems.push({
    barMark: '02',
    description: spanningType === 'TWO_WAY'
      ? `Bottom Transverse Main Bars (Two-Way Span ${Ly} mm)`
      : `Distribution Steel (IS 456 Clause 26.5.2.1 Shrinkage & Temperature)`,
    shapeCode: actualDistHook > 0 ? 'Shape 11' : 'Shape 00',
    diameter: distDia,
    barDiameter: distDia,
    quantity: distBarCount,
    bar_count: distBarCount,
    spacing: distSpacing,
    cut_length: Math.round(distCutLength),
    total_length: Math.round(distCutLength * distBarCount),
    unit_weight: distUnitWt,
    total_weight: distTotWt,
    ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
    ruleSource: spanningType === 'TWO_WAY'
      ? 'Designer Input: Two-Way Secondary Mesh (Verified ≥ min code area)'
      : 'Designer Input: Distribution Mesh (IS 456:2000 Cl 26.5.2.1 check)',
    ruleNote: `${distBarCount} bars @ ${distSpacing}mm c/c (Provided: ${Math.round(distAreaPerMeter)} mm²/m vs Min: ${Math.round(minAreaPerMeter)} mm²/m)`,
    parameterValues: { L: Math.round(distCutLength) },
    calculationTrace: {
      formula: 'Cut Length = Ly - 2*Cover + 2*EndHooks',
      trace: `Cut Length = ${Ly} - ${2 * cover} + ${2 * actualDistHook} = ${Math.round(distCutLength)} mm`
    }
  });

  // 3. Top Negative Extra Bars Over Supports (Edges)
  if (includeTopExtras) {
    const topLegDrop = Math.max(50, t - (2 * cover));
    const topProj = Math.round(Lx * topExtraFraction);
    const topExtraCutLength = topProj + topLegDrop + topAnchorHook; // projection + leg drop + support hook

    // Two support edges (Left & Right along Ly)
    const topBarsPerEdge = Math.max(2, Math.ceil(mainClearWidth / topExtraSpacing) + 1);
    const totalTopExtraCount = topBarsPerEdge * 2;

    const topExtraUnitWt = getUnitWeight(topExtraDia);
    const topExtraTotWt = ((topExtraCutLength * totalTopExtraCount) / 1000) * topExtraUnitWt;

    rebarItems.push({
      barMark: '03',
      description: `Top Negative Support Bars (Hogging Moment Reinforcement at Support Edges)`,
      shapeCode: 'Shape 11',
      diameter: topExtraDia,
      barDiameter: topExtraDia,
      quantity: totalTopExtraCount,
      bar_count: totalTopExtraCount,
      spacing: topExtraSpacing,
      cut_length: Math.round(topExtraCutLength),
      total_length: Math.round(topExtraCutLength * totalTopExtraCount),
      unit_weight: topExtraUnitWt,
      total_weight: topExtraTotWt,
      ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
      ruleSource: 'Designer Input: Support Negative Steel Curtailment Extent',
      ruleNote: `2 edges × ${topBarsPerEdge} bars @ ${topExtraSpacing}mm c/c (extent ${topExtraFraction}Lx = ${topProj}mm)`,
      parameterValues: { L: Math.round(topExtraCutLength) },
      calculationTrace: {
        formula: 'Cut Length = Curtailment Proj + Leg Drop + Support Hook',
        trace: `Cut Length = ${topProj} + ${topLegDrop} + ${topAnchorHook} = ${Math.round(topExtraCutLength)} mm`
      }
    });
  }

  // Summary Metrics
  const totalSteelWeight = rebarItems.reduce((sum, item) => sum + (Number(item.total_weight) || 0), 0);
  const totalBarCount = rebarItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const concreteVolume = (Lx * Ly * t) / 1e9;
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
      spanRatio
    }
  };
}
