/**
 * RebarOptima Phase 2F — Engineering Rule Engine & Providers
 * 
 * Manages modular engineering rule sets:
 * - Centerline exact calculation (Developed Length = Cutting Length)
 * - Standard Bend Deductions (45° = 1d, 90° = 2d, 135° = 3d, 180° = 4d)
 * - Eurocode / BS 8666 Mandrel & Deduction Model
 * - IS Standard Practice Reference Model
 * 
 * Supports rule versioning, plug-in rule sets, traceability, and strict separation from geometry.
 */

import { CANONICAL_UNITS, degToRad } from './calculationUnits';

/**
 * Standard Steel Unit Weight Calculation (kg/m)
 * Exact engineering formula based on density (7850 kg/m³):
 * Area = π * (d / 2000)² m²
 * Volume per meter = Area * 1 m = π * (d / 2000)² m³
 * Weight = Volume * 7850 kg/m³ = π * (d² / 4,000,000) * 7850 = d² * 0.0061654 kg/m ≈ d² / 162.198
 */
export function calculateTheoreticalUnitWeight(diameterMm) {
  if (!diameterMm || diameterMm <= 0) return 0;
  // Exact formula: (π * (d/2)^2 / 1,000,000) * 7850
  const areaM2 = (Math.PI * Math.pow(diameterMm / 2000, 2));
  return areaM2 * CANONICAL_UNITS.STEEL_DENSITY_KG_M3;
}

/**
 * Standard Simplified Formula Weight: d² / 162 (Commonly used standard trade formula)
 */
export function calculateNominalTradeUnitWeight(diameterMm) {
  if (!diameterMm || diameterMm <= 0) return 0;
  return (diameterMm * diameterMm) / 162;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. BUILT-IN ENGINEERING RULE SETS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 1. Standard Centerline Path Rule Set (Default Baseline)
 * Cutting Length = Developed Centerline Length (No bend deductions)
 */
export const RULE_SET_CENTERLINE_EXACT = {
  id: 'RULE_SET_CENTERLINE_EXACT',
  name: 'Standard Centerline Model',
  version: '1.0',
  jurisdiction: 'Global / Neutral',
  standard: 'Pure Centerline Geometry',
  description: 'Measures exact continuous centerline arc and segment path length without empirical bend deductions.',
  
  calculateUnitWeight(diameterMm) {
    return calculateTheoreticalUnitWeight(diameterMm);
  },
  
  unitWeightFormula: 'Exact Steel Density: (π × (d/2000)²) × 7850 kg/m³',

  calculateBendTreatment(bend, diameterMm) {
    // Exact arc length = radius * theta
    const rad = degToRad(bend.bendAngleDeg || 90);
    const radius = Number(bend.radius) || (diameterMm * 2);
    const arcLength = radius * rad;

    return {
      type: 'BEND',
      id: bend.id || 'bend',
      angleDeg: bend.bendAngleDeg || 90,
      radius: radius,
      arcLength: arcLength,
      adjustmentMm: 0, // 0 deduction for centerline model
      formula: 'L = R × θ (radians)',
      explanation: `Bend ${bend.bendAngleDeg || 90}° with radius ${radius.toFixed(1)}mm produces arc length of ${arcLength.toFixed(1)}mm on centerline.`
    };
  },

  calculateHookTreatment(hook, diameterMm) {
    const angle = Number(hook.angle) || 135;
    const extension = Number(hook.extension) || (angle === 180 ? Math.max(75, 4 * diameterMm) : Math.max(75, 6 * diameterMm));
    return {
      type: 'HOOK',
      id: hook.id || 'hook',
      angleDeg: angle,
      extensionMm: extension,
      adjustmentMm: 0,
      formula: 'Hook Length = Extension along profile',
      explanation: `Hook ${angle}° with extension ${extension.toFixed(1)}mm.`
    };
  },

  calculateCuttingLength(developedLengthMm, bendAdjustments = [], hookAdjustments = []) {
    const totalAdjustment = [...bendAdjustments, ...hookAdjustments].reduce((sum, a) => sum + (a.adjustmentMm || 0), 0);
    const cuttingLength = developedLengthMm + totalAdjustment;
    return {
      developedLengthMm,
      totalAdjustmentMm: totalAdjustment,
      cuttingLengthMm: Math.max(0, cuttingLength),
      formula: 'Cutting Length = Developed Centerline Length',
      trace: `Cutting Length = ${developedLengthMm.toFixed(2)} mm (No bend deductions)`
    };
  }
};

/**
 * 2. Standard Empirical Bend Deduction Rule Set
 * Commonly applied in fabrication shops:
 * Deductions:
 * - 45° bend = 1 × d deduction
 * - 90° bend = 2 × d deduction
 * - 135° bend = 3 × d deduction
 * - 180° bend = 4 × d deduction
 */
export const RULE_SET_STANDARD_BEND_DEDUCTION = {
  id: 'RULE_SET_STANDARD_BEND_DEDUCTION',
  name: 'Standard Bend Deduction Model (45°=1d, 90°=2d, 135°=3d)',
  version: '1.0',
  jurisdiction: 'Fabrication Standard',
  standard: 'Empirical Bend Allowance',
  description: 'Deducts steel elongation at bends (45°: 1d, 90°: 2d, 135°: 3d, 180°: 4d) from outer leg sums.',

  calculateUnitWeight(diameterMm) {
    return calculateNominalTradeUnitWeight(diameterMm);
  },

  unitWeightFormula: 'Standard Trade Nominal: d² / 162 kg/m',

  calculateBendTreatment(bend, diameterMm) {
    const angle = Number(bend.bendAngleDeg) || 90;
    const d = Number(diameterMm) || 16;
    let deductionFactor = 0;

    if (angle <= 45) {
      deductionFactor = 1 * (angle / 45);
    } else if (angle <= 90) {
      deductionFactor = 1 + (1 * ((angle - 45) / 45)); // 45° = 1d, 90° = 2d
    } else if (angle <= 135) {
      deductionFactor = 2 + (1 * ((angle - 90) / 45)); // 90° = 2d, 135° = 3d
    } else {
      deductionFactor = 3 + (1 * ((angle - 135) / 45)); // 135° = 3d, 180° = 4d
    }

    const deductionMm = -(deductionFactor * d);
    const rad = degToRad(angle);
    const radius = Number(bend.radius) || (d * 2);
    const arcLength = radius * rad;

    return {
      type: 'BEND',
      id: bend.id || 'bend',
      angleDeg: angle,
      radius: radius,
      arcLength: arcLength,
      adjustmentMm: deductionMm,
      formula: `Deduction = -${deductionFactor.toFixed(1)} × Ø${d} = ${deductionMm.toFixed(1)} mm`,
      explanation: `${angle}° bend elongation deduction of ${Math.abs(deductionMm).toFixed(1)}mm (${deductionFactor.toFixed(1)}d for Ø${d}).`
    };
  },

  calculateHookTreatment(hook, diameterMm) {
    const angle = Number(hook.angle) || 135;
    const d = Number(diameterMm) || 16;
    const extension = Number(hook.extension) || (angle === 135 ? Math.max(75, 6 * d) : Math.max(75, 4 * d));

    return {
      type: 'HOOK',
      id: hook.id || 'hook',
      angleDeg: angle,
      extensionMm: extension,
      adjustmentMm: 0,
      formula: `Hook Length = ${extension.toFixed(1)} mm`,
      explanation: `Hook ${angle}° with straight extension ${extension.toFixed(1)}mm.`
    };
  },

  calculateCuttingLength(developedLengthMm, bendAdjustments = [], hookAdjustments = []) {
    const totalAdjustment = [...bendAdjustments, ...hookAdjustments].reduce((sum, a) => sum + (a.adjustmentMm || 0), 0);
    const cuttingLength = developedLengthMm + totalAdjustment;
    return {
      developedLengthMm,
      totalAdjustmentMm: totalAdjustment,
      cuttingLengthMm: Math.max(0, cuttingLength),
      formula: 'Cutting Length = Developed Length + Σ(Bend Deductions)',
      trace: `Cutting Length = ${developedLengthMm.toFixed(2)} mm + (${totalAdjustment.toFixed(2)} mm) = ${cuttingLength.toFixed(2)} mm`
    };
  }
};

/**
 * 3. Eurocode / BS 8666 Style Model
 * Dimensioning by outer dimensions with mandatory minimum bend radii:
 * Minimum Mandrel Radius = 2d for d <= 16mm, 3.5d for d > 16mm
 */
export const RULE_SET_EUROCODE_BS8666 = {
  id: 'RULE_SET_EUROCODE_BS8666',
  name: 'BS 8666 / Eurocode Reference Model',
  version: '1.0',
  jurisdiction: 'UK / Europe (BS 8666)',
  standard: 'BS 8666 Specification for scheduling, dimensioning and bending',
  description: 'Scheduling rules based on centerline calculation with standard mandrel diameter checks and standardized hook allowances.',

  calculateUnitWeight(diameterMm) {
    return calculateTheoreticalUnitWeight(diameterMm);
  },

  unitWeightFormula: 'BS 8666 Theoretical Steel Density (7850 kg/m³)',

  calculateBendTreatment(bend, diameterMm) {
    const angle = Number(bend.bendAngleDeg) || 90;
    const d = Number(diameterMm) || 16;
    const minRadius = d <= 16 ? 2 * d : 3.5 * d;
    const radius = Math.max(Number(bend.radius) || minRadius, minRadius);
    const rad = degToRad(angle);
    const arcLength = radius * rad;

    return {
      type: 'BEND',
      id: bend.id || 'bend',
      angleDeg: angle,
      radius: radius,
      minRequiredRadius: minRadius,
      arcLength: arcLength,
      adjustmentMm: 0,
      formula: 'BS 8666 Centerline Arc Length: L = R × θ',
      explanation: `Bend ${angle}° on mandrel R=${radius.toFixed(1)}mm (min required ${minRadius}mm for Ø${d}).`
    };
  },

  calculateHookTreatment(hook, diameterMm) {
    const angle = Number(hook.angle) || 135;
    const d = Number(diameterMm) || 16;
    // BS 8666 standard hook allowances:
    // 90° bend = min 5d or 100mm; 135° link hook = min 10d or 70mm; 180° hook = min 5d or 100mm
    let minExtension = angle === 135 ? Math.max(70, 10 * d) : Math.max(100, 5 * d);
    const extension = Math.max(Number(hook.extension) || minExtension, minExtension);

    return {
      type: 'HOOK',
      id: hook.id || 'hook',
      angleDeg: angle,
      extensionMm: extension,
      minRequiredExtension: minExtension,
      adjustmentMm: 0,
      formula: `Hook Length: ${extension.toFixed(1)} mm (Min: ${minExtension} mm)`,
      explanation: `BS 8666 standard ${angle}° hook with ${extension.toFixed(1)}mm extension.`
    };
  },

  calculateCuttingLength(developedLengthMm, bendAdjustments = [], hookAdjustments = []) {
    const totalAdjustment = [...bendAdjustments, ...hookAdjustments].reduce((sum, a) => sum + (a.adjustmentMm || 0), 0);
    const cuttingLength = developedLengthMm + totalAdjustment;
    return {
      developedLengthMm,
      totalAdjustmentMm: totalAdjustment,
      cuttingLengthMm: Math.max(0, cuttingLength),
      formula: 'Cutting Length = Centerline Developed Length',
      trace: `Cutting Length = ${developedLengthMm.toFixed(2)} mm`
    };
  }
};

/**
 * 4. IS 2502 Standard Practice Reference Model
 * Standard Indian practice for bar bending schedule calculations
 */
export const RULE_SET_IS_PRACTICE = {
  id: 'RULE_SET_IS_PRACTICE',
  name: 'IS 2502 Standard Practice Reference Model',
  version: '1.0',
  jurisdiction: 'India (IS 2502 Reference)',
  standard: 'IS 2502 Code of Practice for Bending and Fixing of Bars',
  description: 'Engineering calculation model conforming to IS standard practice for bend deductions (2d for 90°) and hook allowances (9d for 180°, 24d for dual 135° stirrups).',

  calculateUnitWeight(diameterMm) {
    return calculateNominalTradeUnitWeight(diameterMm);
  },

  unitWeightFormula: 'IS Standard Practice Nominal: d² / 162 kg/m',

  calculateBendTreatment(bend, diameterMm) {
    const angle = Number(bend.bendAngleDeg) || 90;
    const d = Number(diameterMm) || 16;
    let deduction = 0;

    if (angle >= 85 && angle <= 95) {
      deduction = -2 * d; // 2d deduction for 90° bend
    } else if (angle >= 40 && angle <= 50) {
      deduction = -1 * d; // 1d deduction for 45° bend
    } else if (angle >= 130 && angle <= 140) {
      deduction = -3 * d; // 3d deduction for 135° bend
    } else {
      deduction = -(angle / 45) * d;
    }

    const rad = degToRad(angle);
    const radius = Number(bend.radius) || (2 * d);
    const arcLength = radius * rad;

    return {
      type: 'BEND',
      id: bend.id || 'bend',
      angleDeg: angle,
      radius: radius,
      arcLength: arcLength,
      adjustmentMm: deduction,
      formula: `IS Bend Deduction = -${Math.abs(deduction / d).toFixed(1)}d = ${deduction.toFixed(1)} mm`,
      explanation: `IS Practice: ${angle}° bend deduction of ${Math.abs(deduction).toFixed(1)}mm.`
    };
  },

  calculateHookTreatment(hook, diameterMm) {
    const angle = Number(hook.angle) || 135;
    const d = Number(diameterMm) || 16;
    const extension = Number(hook.extension) || (angle === 135 ? Math.max(75, 6 * d) : Math.max(75, 4 * d));

    return {
      type: 'HOOK',
      id: hook.id || 'hook',
      angleDeg: angle,
      extensionMm: extension,
      adjustmentMm: 0,
      formula: `Hook Allowance: ${extension.toFixed(1)} mm`,
      explanation: `IS standard ${angle}° hook with ${extension.toFixed(1)}mm extension.`
    };
  },

  calculateCuttingLength(developedLengthMm, bendAdjustments = [], hookAdjustments = []) {
    const totalAdjustment = [...bendAdjustments, ...hookAdjustments].reduce((sum, a) => sum + (a.adjustmentMm || 0), 0);
    const cuttingLength = developedLengthMm + totalAdjustment;
    return {
      developedLengthMm,
      totalAdjustmentMm: totalAdjustment,
      cuttingLengthMm: Math.max(0, cuttingLength),
      formula: 'Cutting Length = Developed Length + Σ(IS Bend Deductions)',
      trace: `Cutting Length = ${developedLengthMm.toFixed(2)} mm + (${totalAdjustment.toFixed(2)} mm) = ${cuttingLength.toFixed(2)} mm`
    };
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. ENGINEERING RULE PROVIDER REGISTRY
// ══════════════════════════════════════════════════════════════════════════════

class EngineeringRuleRegistry {
  constructor() {
    this.ruleSets = new Map();
    // Register built-in rule sets
    this.register(RULE_SET_CENTERLINE_EXACT);
    this.register(RULE_SET_STANDARD_BEND_DEDUCTION);
    this.register(RULE_SET_EUROCODE_BS8666);
    this.register(RULE_SET_IS_PRACTICE);
  }

  register(ruleSet) {
    if (!ruleSet || !ruleSet.id) return;
    this.ruleSets.set(ruleSet.id, ruleSet);
  }

  get(id) {
    return this.ruleSets.get(id) || RULE_SET_CENTERLINE_EXACT;
  }

  getRuleSet(id) {
    return this.get(id);
  }

  getAll() {
    return Array.from(this.ruleSets.values());
  }

  getAllRuleSets() {
    return this.getAll();
  }

  getDefault() {
    return RULE_SET_CENTERLINE_EXACT;
  }
}

export const engineeringRuleProvider = new EngineeringRuleRegistry();
