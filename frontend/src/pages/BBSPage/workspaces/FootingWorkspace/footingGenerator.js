/**
 * Footing Detailing Generator (Pure Logic & Geometry Engine)
 * 
 * Takes:
 * - Footing Dimensions: Length (L), Width (B), Depth (D), Clear Cover (default 50mm per IS 456 Table 16)
 * - Pedestal Dimensions: Length (pL), Width (pB)
 * - Bottom Reinforcement:
 *   - Mesh-X (along L): Dia, Spacing, End Upturned Hook Leg (D - 2*cover)
 *   - Mesh-Y (along B): Dia, Spacing, End Upturned Hook Leg
 * - Column Starter Dowels:
 *   - Dowel Dia, Count, Footing Embedment Hook (300mm), Column Lap Extension above pad
 */

import { calculateTheoreticalUnitWeight, calculateNominalTradeUnitWeight } from '../../cad/engineeringRules.js';
import { RULE_CLASSIFICATION } from '../common/ruleConstants.js';

export function generateFootingBbs(config = {}) {
  const {
    L = 2000,                 // Footing Length (mm)
    B = 2000,                 // Footing Width (mm)
    D = 500,                  // Footing Depth (mm)
    cover = 50,               // Clear cover (mm, IS 456 Table 16 default 50mm for footings against earth)
    concreteGrade = 'M25',
    steelGrade = 'Fe500D',

    // Column Pedestal on top of footing
    pL = 400,
    pB = 400,

    // Bottom Mesh-X (along L)
    meshXDia = 12,
    meshXSpacing = 150,       // mm c/c
    meshXHookLeg = null,      // upturned hook (mm, default: D - 2*cover)

    // Bottom Mesh-Y (along B)
    meshYDia = 12,
    meshYSpacing = 150,
    meshYHookLeg = null,

    // Column Starter Dowels
    includeStarterDowels = true,
    dowelDia = 16,
    dowelCount = 8,
    dowelFootingHook = 300,   // 90° horizontal bend on bottom mesh (mm)
    dowelLapExtension = 800,  // Lap projection above footing top (mm)

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

  const clearDepth = Math.max(50, D - (2 * cover));
  const effectiveMeshXHook = (meshXHookLeg !== null && meshXHookLeg !== undefined && meshXHookLeg >= 0)
    ? Number(meshXHookLeg)
    : clearDepth;
  const effectiveMeshYHook = (meshYHookLeg !== null && meshYHookLeg !== undefined && meshYHookLeg >= 0)
    ? Number(meshYHookLeg)
    : clearDepth;

  // Clearance validation
  if (effectiveMeshXHook > clearDepth) {
    warnings.push(`Mesh-X upturned hook leg (${effectiveMeshXHook} mm) exceeds clear depth of footing pad (${clearDepth} mm). Top clear cover will be violated.`);
  }
  if (effectiveMeshYHook > clearDepth) {
    warnings.push(`Mesh-Y upturned hook leg (${effectiveMeshYHook} mm) exceeds clear depth of footing pad (${clearDepth} mm). Top clear cover will be violated.`);
  }

  // Statutory Minimum Reinforcement Check (IS 456:2000 Clause 34.3 & Clause 26.5.2.1)
  // For Fe415/Fe500: 0.12% of gross cross-sectional area
  const isHysd = String(steelGrade).toUpperCase().includes('500') || String(steelGrade).toUpperCase().includes('415');
  const minRatio = isHysd ? 0.0012 : 0.0015;
  const minAreaX = minRatio * B * D; // Across width B
  const minAreaY = minRatio * L * D; // Across length L

  // 1. Bottom Mesh-X (Bars along Length L, distributed across Width B)
  const clearWidthB = B - (2 * cover);
  const meshXCount = Math.max(2, Math.ceil(clearWidthB / meshXSpacing) + 1);
  const provAreaX = meshXCount * (Math.PI * Math.pow(meshXDia, 2) / 4);

  if (provAreaX < minAreaX) {
    warnings.push(`Mesh-X total steel area (${Math.round(provAreaX)} mm²) is less than IS 456 Cl 34.3 minimum (${Math.round(minAreaX)} mm²). Increase bar diameter or reduce spacing.`);
  }

  // U-Bar shape: Straight run = L - 2*cover + two vertical upturned legs
  const meshXRun = L - (2 * cover);
  const meshXCutLength = meshXRun + (2 * effectiveMeshXHook);
  const meshXUnitWt = getUnitWeight(meshXDia);
  const meshXTotWt = ((meshXCutLength * meshXCount) / 1000) * meshXUnitWt;

  rebarItems.push({
    barMark: '01',
    description: `Bottom Reinforcement Mesh-X (Along Length ${L}mm with Upturned Hooks)`,
    shapeCode: 'Shape 21', // U-bar
    diameter: meshXDia,
    barDiameter: meshXDia,
    quantity: meshXCount,
    bar_count: meshXCount,
    spacing: meshXSpacing,
    cut_length: Math.round(meshXCutLength),
    total_length: Math.round(meshXCutLength * meshXCount),
    unit_weight: meshXUnitWt,
    total_weight: meshXTotWt,
    ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
    ruleSource: 'Designer Input: Footing Pad Mesh X (IS 456 Cl 34.3 min area verified)',
    ruleNote: `${meshXCount} bars @ ${meshXSpacing}mm c/c with ${effectiveMeshXHook}mm end hooks`,
    parameterValues: { A: effectiveMeshXHook, B: meshXRun, C: effectiveMeshXHook },
    calculationTrace: {
      formula: 'Cut Length = Run + 2 × Upturned Hooks',
      trace: `Cut Length = ${meshXRun} + 2×${effectiveMeshXHook} = ${Math.round(meshXCutLength)} mm`
    }
  });

  // 2. Bottom Mesh-Y (Bars along Width B, distributed across Length L)
  const clearLengthL = L - (2 * cover);
  const meshYCount = Math.max(2, Math.ceil(clearLengthL / meshYSpacing) + 1);
  const provAreaY = meshYCount * (Math.PI * Math.pow(meshYDia, 2) / 4);

  if (provAreaY < minAreaY) {
    warnings.push(`Mesh-Y total steel area (${Math.round(provAreaY)} mm²) is less than IS 456 Cl 34.3 minimum (${Math.round(minAreaY)} mm²). Increase bar diameter or reduce spacing.`);
  }

  const meshYRun = B - (2 * cover);
  const meshYCutLength = meshYRun + (2 * effectiveMeshYHook);
  const meshYUnitWt = getUnitWeight(meshYDia);
  const meshYTotWt = ((meshYCutLength * meshYCount) / 1000) * meshYUnitWt;

  rebarItems.push({
    barMark: '02',
    description: `Bottom Reinforcement Mesh-Y (Along Width ${B}mm with Upturned Hooks)`,
    shapeCode: 'Shape 21',
    diameter: meshYDia,
    barDiameter: meshYDia,
    quantity: meshYCount,
    bar_count: meshYCount,
    spacing: meshYSpacing,
    cut_length: Math.round(meshYCutLength),
    total_length: Math.round(meshYCutLength * meshYCount),
    unit_weight: meshYUnitWt,
    total_weight: meshYTotWt,
    ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
    ruleSource: 'Designer Input: Footing Pad Mesh Y (IS 456 Cl 34.3 min area verified)',
    ruleNote: `${meshYCount} bars @ ${meshYSpacing}mm c/c with ${effectiveMeshYHook}mm end hooks`,
    parameterValues: { A: effectiveMeshYHook, B: meshYRun, C: effectiveMeshYHook },
    calculationTrace: {
      formula: 'Cut Length = Run + 2 × Upturned Hooks',
      trace: `Cut Length = ${meshYRun} + 2×${effectiveMeshYHook} = ${Math.round(meshYCutLength)} mm`
    }
  });

  // 3. Column Starter Dowels
  if (includeStarterDowels && dowelCount > 0) {
    // Compression lap check (IS 456 Clause 26.2.5.1: min 24d, standard column compression lap ~40d)
    const minLapStandard = 40 * dowelDia;
    if (dowelLapExtension < minLapStandard) {
      warnings.push(`Column starter dowel lap extension (${dowelLapExtension} mm) is less than standard column compression lap (40d = ${minLapStandard} mm per IS 456 Cl 26.2.5.1).`);
    }

    const dowelVerticalLeg = (D - cover) + dowelLapExtension;
    const dowelCutLength = dowelVerticalLeg + dowelFootingHook;
    const dowelUnitWt = getUnitWeight(dowelDia);
    const dowelTotWt = ((dowelCutLength * dowelCount) / 1000) * dowelUnitWt;

    rebarItems.push({
      barMark: '03',
      description: `Column Starter Dowel Bars (Anchored into Footing Base with 90° Hook)`,
      shapeCode: 'Shape 11',
      diameter: dowelDia,
      barDiameter: dowelDia,
      quantity: dowelCount,
      bar_count: dowelCount,
      spacing: 0,
      cut_length: Math.round(dowelCutLength),
      total_length: Math.round(dowelCutLength * dowelCount),
      unit_weight: dowelUnitWt,
      total_weight: dowelTotWt,
      ruleClassification: RULE_CLASSIFICATION.DESIGNER_PROVIDED_VALUE,
      ruleSource: 'Designer Input: Column Starter Dowels',
      ruleNote: `${dowelCount} bars with ${dowelFootingHook}mm footing foot + ${dowelLapExtension}mm lap above pad`,
      parameterValues: { A: Math.round(dowelVerticalLeg), B: dowelFootingHook },
      calculationTrace: {
        formula: 'Cut Length = Vertical Embedment + Lap + Horizontal Foot Hook',
        trace: `Cut Length = ${dowelVerticalLeg} + ${dowelFootingHook} = ${Math.round(dowelCutLength)} mm`
      }
    });
  }

  // Summary Metrics
  const totalSteelWeight = rebarItems.reduce((sum, item) => sum + (Number(item.total_weight) || 0), 0);
  const totalBarCount = rebarItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const concreteVolume = (L * B * D) / 1e9;
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
      warnings
    }
  };
}
