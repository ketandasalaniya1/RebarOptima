import { Injectable } from '@nestjs/common';

/**
 * IS 456 Development Length (Ld) Matrix
 * Cross-references Concrete Grade × Steel Grade → Ld multiplier (in terms of bar diameters)
 * Source: IS 456:2000, Table 26 — Bond stress τbd, and Ld = (0.87 × fy × φ) / (4 × τbd)
 */
const LD_MATRIX: Record<string, Record<string, number>> = {
  // Concrete Grade -> Steel Grade -> Ld in terms of 'd'
  M15: { Fe250: 45, Fe415: 55, Fe500: 67, Fe500D: 67, Fe550: 73 },
  M20: { Fe250: 36, Fe415: 47, Fe500: 57, Fe500D: 57, Fe550: 62 },
  M25: { Fe250: 29, Fe415: 38, Fe500: 46, Fe500D: 46, Fe550: 50 },
  M30: { Fe250: 26, Fe415: 34, Fe500: 41, Fe500D: 41, Fe550: 45 },
  M35: { Fe250: 24, Fe415: 31, Fe500: 37, Fe500D: 37, Fe550: 41 },
  M40: { Fe250: 22, Fe415: 29, Fe500: 35, Fe500D: 35, Fe550: 38 },
  M45: { Fe250: 21, Fe415: 27, Fe500: 33, Fe500D: 33, Fe550: 36 },
  M50: { Fe250: 20, Fe415: 26, Fe500: 31, Fe500D: 31, Fe550: 34 },
};

/**
 * IS code clear cover defaults (mm) by element category
 * Source: IS 456:2000, Table 16
 */
const DEFAULT_CLEAR_COVERS: Record<string, number> = {
  Footing: 50,
  Pile: 50,
  Column: 40,
  Pedestal: 40,
  Beam: 25,
  Slab: 20,
  RetainingWall: 45,
  Staircase: 20,
  Chajja: 20,
  Custom: 25,
};

/**
 * Standard stock bar length (mm)
 */
const STOCK_BAR_LENGTH = 12000;

@Injectable()
export class BbsCalculationService {

  // ─────────────────────────────────────────────────────
  //  UNIVERSAL FORMULAS
  // ─────────────────────────────────────────────────────

  /**
   * Unit Weight of Steel (kg/m)
   * Formula: D² / 162.27
   */
  calculateUnitWeight(diameter: number): number {
    return Math.pow(diameter, 2) / 162.27;
  }

  /**
   * Unit Weight of Steel (kg/mm → for mm-based lengths)
   */
  calculateUnitWeightPerMm(diameter: number): number {
    return this.calculateUnitWeight(diameter) / 1000;
  }

  /**
   * Total Cutting Length (Master Formula from PRD)
   * = Base Run + Hooks/Laps + Cranks − Bend Deductions
   */
  calculateTotalCuttingLength(
    baseRun: number,
    hookAdditions: number,
    lapLength: number,
    crankAdditions: number,
    bendDeductions: number,
  ): number {
    return baseRun + hookAdditions + lapLength + crankAdditions - bendDeductions;
  }

  /**
   * Quantity Calculation (IS 2502)
   * = (Clear Span Length / Center-to-Center Spacing) + 1 (rounded up)
   */
  calculateBarQuantity(clearSpan: number, spacing: number): number {
    if (spacing <= 0) return 1;
    return Math.ceil(clearSpan / spacing) + 1;
  }

  /**
   * Concrete Volume (m³)
   * = L × W × D (all in mm, converted to m³)
   */
  calculateConcreteVolume(lengthMm: number, widthMm: number, depthMm: number): number {
    return (lengthMm * widthMm * depthMm) / 1e9; // mm³ → m³
  }

  // ─────────────────────────────────────────────────────
  //  IS 2502 BEND DEDUCTIONS & HOOKS
  // ─────────────────────────────────────────────────────

  /**
   * IS 2502 Bend Deduction per bend
   * 45° → 1d, 90° → 2d, 135° → 3d, 180° → 4d
   */
  calculateBendDeduction(diameter: number, angle: 45 | 90 | 135 | 180): number {
    const multipliers: Record<number, number> = { 45: 1, 90: 2, 135: 3, 180: 4 };
    return (multipliers[angle] || 0) * diameter;
  }

  /**
   * Total bend deduction given an array of bend angles
   */
  calculateTotalBendDeductions(diameter: number, angles: Array<45 | 90 | 135 | 180>): number {
    return angles.reduce((sum, angle) => sum + this.calculateBendDeduction(diameter, angle), 0);
  }

  /**
   * Seismic Hook Addition (IS 13920)
   * Add 10d per 135° hook
   */
  calculateSeismicHookAddition(diameter: number, hookCount: number): number {
    return 10 * diameter * hookCount;
  }

  // ─────────────────────────────────────────────────────
  //  IS 456 DEVELOPMENT LENGTH (Ld)
  // ─────────────────────────────────────────────────────

  /**
   * Dynamic Development Length (Ld)
   * Cross-references the IS 456 matrix. Falls back to 50d if no match.
   */
  calculateDevelopmentLength(
    diameter: number,
    concreteGrade: string,
    steelGrade: string,
  ): number {
    const gradeRow = LD_MATRIX[concreteGrade];
    if (gradeRow && gradeRow[steelGrade] !== undefined) {
      return gradeRow[steelGrade] * diameter;
    }
    // Fallback: 50d as per PRD bypass rule
    return 50 * diameter;
  }

  /**
   * Get default clear cover for an element category
   */
  getDefaultClearCover(category: string): number {
    return DEFAULT_CLEAR_COVERS[category] ?? 25;
  }

  // ─────────────────────────────────────────────────────
  //  ZERO-DEDUCTION RULES
  // ─────────────────────────────────────────────────────

  /**
   * Straight bars, top support bars (0.3L), and vertical column lifts
   * running floor-to-floor without hooks receive 0 bend deductions.
   */
  isZeroDeduction(shapeCode: string): boolean {
    const zeroDeductionShapes = [
      'Straight',
      'StraightDistribution',
      'TopSupportBar',
      'ColumnLift',
    ];
    return zeroDeductionShapes.includes(shapeCode);
  }

  // ─────────────────────────────────────────────────────
  //  SHAPE-SPECIFIC CUTTING LOGIC
  // ─────────────────────────────────────────────────────

  /**
   * Closed Rectangular Stirrup
   * 2(A + B) + 20d − 12d
   * A, B = inner width/height
   * +20d = two 135° hooks (10d each)
   * −12d = three 90° bends (2d each = 6d) + two 135° bends (3d each = 6d) = 12d
   */
  calculateClosedStirrup(A: number, B: number, diameter: number): number {
    return 2 * (A + B) + (20 * diameter) - (12 * diameter);
  }

  /**
   * Diamond Stirrup
   * 4 × √(sx² + sy²) + 20d − 12d
   * sx, sy = horizontal/vertical spacing segments between main bars
   */
  calculateDiamondStirrup(sx: number, sy: number, diameter: number): number {
    const diagonal = Math.sqrt(Math.pow(sx, 2) + Math.pow(sy, 2));
    return (4 * diagonal) + (20 * diameter) - (12 * diameter);
  }

  /**
   * Helical / Spiral Ring
   * C = √((π × Ds)² + Pitch²)
   * Total Length = (Turns × C) + Lap Allowances
   * Ds = diameter of spiral (center-to-center)
   */
  calculateHelicalRing(
    spiralDiameter: number,
    pitch: number,
    turns: number,
    lapAllowance: number,
  ): number {
    const circumference = Math.sqrt(
      Math.pow(Math.PI * spiralDiameter, 2) + Math.pow(pitch, 2),
    );
    return (turns * circumference) + lapAllowance;
  }

  /**
   * One-Way Cranked Slab
   * Adds 0.42 × h per 45° crank
   * h = inner vertical core = Thickness − Top Cover − Bottom Cover − Bar Dia
   */
  calculateCrankAddition(
    thickness: number,
    topCover: number,
    bottomCover: number,
    barDia: number,
    numberOfCranks: number = 1,
  ): number {
    const h = thickness - topCover - bottomCover - barDia;
    return 0.42 * h * numberOfCranks;
  }

  /**
   * Staircase Incline
   * Slope Length per step = √(Riser² + Tread²)
   * Total flight length = steps × slopePerStep
   */
  calculateStaircaseSlopeLength(riser: number, tread: number): number {
    return Math.sqrt(Math.pow(riser, 2) + Math.pow(tread, 2));
  }

  calculateStaircaseFlightLength(riser: number, tread: number, numberOfSteps: number): number {
    return this.calculateStaircaseSlopeLength(riser, tread) * numberOfSteps;
  }

  /**
   * Cantilever Chajja
   * Main bars span top face with 90° nose-hook leg drop at free end:
   * Leg drop = Free End Thickness − Top Cover − Bottom Cover
   */
  calculateChajjaLegDrop(
    freeEndThickness: number,
    topCover: number,
    bottomCover: number,
  ): number {
    return freeEndThickness - topCover - bottomCover;
  }

  // ─────────────────────────────────────────────────────
  //  STOCK BAR CAPPING & AUTO LAP INJECTION
  // ─────────────────────────────────────────────────────

  /**
   * For continuous theoretical lengths exceeding 12,000 mm,
   * auto-inject lap joints (Ld) and return the number of bars needed.
   */
  calculateStockBarSplits(
    theoreticalLength: number,
    diameter: number,
    concreteGrade: string,
    steelGrade: string,
  ): { numberOfBars: number; effectiveLengthPerBar: number; totalLapLength: number } {
    if (theoreticalLength <= STOCK_BAR_LENGTH) {
      return {
        numberOfBars: 1,
        effectiveLengthPerBar: theoreticalLength,
        totalLapLength: 0,
      };
    }

    const ld = this.calculateDevelopmentLength(diameter, concreteGrade, steelGrade);
    // Effective usable length per stock bar after deducting one lap zone
    const effectivePerBar = STOCK_BAR_LENGTH - ld;
    const numberOfBars = Math.ceil(theoreticalLength / effectivePerBar);
    const totalLapLength = (numberOfBars - 1) * ld;

    return {
      numberOfBars,
      effectiveLengthPerBar: effectivePerBar,
      totalLapLength,
    };
  }

  // ─────────────────────────────────────────────────────
  //  WEIGHT CALCULATIONS
  // ─────────────────────────────────────────────────────

  /**
   * Total weight for a rebar item
   * total_length = cut_length × bar_count
   * total_weight = total_length (in m) × unit_weight (kg/m)
   */
  calculateRebarWeight(cutLength: number, barCount: number, diameter: number): {
    totalLength: number;
    totalWeight: number;
  } {
    const totalLength = cutLength * barCount; // mm
    const unitWeight = this.calculateUnitWeight(diameter); // kg/m
    const totalWeight = (totalLength / 1000) * unitWeight; // convert mm→m, then × kg/m
    return { totalLength, totalWeight };
  }
}
