import {
  ConcreteGrade,
  IngredientCategory,
  IngredientUnit,
  IIngredientSpecification,
  ICastingRecipeVersion,
  ICastingEventSegment,
  ISegmentMaterialRequirement,
  IGradeMaterialSubtotal,
  IConsolidatedMaterialRequirement
} from './casting.types';

export interface IWaterRatioEvaluation {
  waterCementRatio: {
    value: number | null;
    status: 'CALCULATED' | 'NOT_APPLICABLE' | 'UNAVAILABLE';
    reason: string;
  };
  waterCementitiousRatio: {
    value: number | null;
    status: 'CALCULATED' | 'DERIVED_EQUAL_TO_WC' | 'NOT_APPLICABLE' | 'UNAVAILABLE';
    reason: string;
  };
  engineeringCompliance: {
    status: 'WITHIN_LIMITS' | 'EXCEEDS_LIMITS' | 'CANNOT_VERIFY_MISSING_INPUTS';
    details: string[];
  };
}

/**
 * Validates and converts an ingredient quantity from baseUnit to displayUnit.
 * Throws an explicit error for unsupported unit conversions or missing specific gravity.
 */
export function convertUnit(
  baseQuantity: number,
  baseUnit: IngredientUnit,
  displayUnit: IngredientUnit,
  category: IngredientCategory,
  specificGravity?: number
): number {
  if (baseUnit === displayUnit) {
    return Number(baseQuantity.toFixed(3));
  }

  // Mass (KG) -> 50KG Bags
  if (baseUnit === 'KG' && displayUnit === 'BAGS_50KG') {
    if (category !== 'CEMENT' && category !== 'SUPPLEMENTARY_CEMENTITIOUS') {
      throw new Error(`Unit conversion to BAGS_50KG is only supported for cementitious materials, got category ${category}`);
    }
    return Number((baseQuantity / 50.0).toFixed(2));
  }

  // Mass (KG) -> Metric Tonne (MT)
  if (baseUnit === 'KG' && displayUnit === 'METRIC_TONNE') {
    return Number((baseQuantity / 1000.0).toFixed(3));
  }

  // Mass (KG) -> Liquid Volume (LITERS)
  if (baseUnit === 'KG' && displayUnit === 'LITERS') {
    if (!specificGravity || specificGravity <= 0) {
      throw new Error(`Cannot convert mass (KG) to volume (LITERS) without a verified positive specificGravity factor`);
    }
    return Number((baseQuantity / specificGravity).toFixed(3));
  }

  // Liquid Volume (LITERS) -> Mass (KG)
  if (baseUnit === 'LITERS' && displayUnit === 'KG') {
    if (!specificGravity || specificGravity <= 0) {
      throw new Error(`Cannot convert volume (LITERS) to mass (KG) without a verified positive specificGravity factor`);
    }
    return Number((baseQuantity * specificGravity).toFixed(3));
  }

  // Volumetric identity for bulk RMC
  if (baseUnit === 'M3' && displayUnit === 'M3') {
    return Number(baseQuantity.toFixed(2));
  }

  throw new Error(`Unsupported unit conversion from ${baseUnit} to ${displayUnit} for category ${category}`);
}

/**
 * Calculates w/c and w/cm ratios deterministically and validates against engineering limits.
 */
export function calculateWaterRatios(version: ICastingRecipeVersion): IWaterRatioEvaluation {
  const limits = version.engineeringLimits || {};
  const complianceDetails: string[] = [];
  let isCompliant = true;
  let hasVerificationBlock = false;

  // RMC Procurement with certified parameters
  if (version.mixType === 'RMC_PROCUREMENT') {
    return {
      waterCementRatio: {
        value: version.calculatedWaterCementRatio ?? null,
        status: version.calculatedWaterCementRatio !== null && version.calculatedWaterCementRatio !== undefined ? 'CALCULATED' : 'UNAVAILABLE',
        reason: 'RMC procurement mix — ratio certified by supplier batch report'
      },
      waterCementitiousRatio: {
        value: version.calculatedWaterCementitiousRatio ?? null,
        status: version.calculatedWaterCementitiousRatio !== null && version.calculatedWaterCementitiousRatio !== undefined ? 'CALCULATED' : 'UNAVAILABLE',
        reason: 'RMC procurement mix — ratio certified by supplier batch report'
      },
      engineeringCompliance: {
        status: 'WITHIN_LIMITS',
        details: ['RMC procurement mix proportions certified by authorized engineer sign-off']
      }
    };
  }

  const pureCement = version.ingredients
    .filter(i => i.category === 'CEMENT')
    .reduce((sum, i) => sum + (Number(i.quantityPerM3) || 0), 0);

  const scmTotal = version.ingredients
    .filter(i => i.category === 'SUPPLEMENTARY_CEMENTITIOUS')
    .reduce((sum, i) => sum + (Number(i.quantityPerM3) || 0), 0);

  const freeWater = version.ingredients
    .filter(i => i.category === 'WATER')
    .reduce((sum, i) => sum + (Number(i.quantityPerM3) || 0), 0);

  const totalBinder = pureCement + scmTotal;

  // 1. Water-Cement Ratio Evaluation
  let wcEvaluation: IWaterRatioEvaluation['waterCementRatio'];
  if (freeWater <= 0) {
    wcEvaluation = {
      value: null,
      status: 'UNAVAILABLE',
      reason: 'Free water quantity is missing or zero'
    };
    hasVerificationBlock = true;
  } else if (pureCement <= 0) {
    wcEvaluation = {
      value: null,
      status: 'NOT_APPLICABLE',
      reason: 'No pure Portland cement specified in recipe'
    };
  } else {
    const wc = Number((freeWater / pureCement).toFixed(3));
    wcEvaluation = {
      value: wc,
      status: 'CALCULATED',
      reason: 'Calculated as Free Water divided by Pure Cement mass'
    };

    if (limits.maxWaterCementRatio && wc > limits.maxWaterCementRatio) {
      isCompliant = false;
      complianceDetails.push(`Calculated w/c ratio (${wc}) exceeds maximum limit of ${limits.maxWaterCementRatio}`);
    }
  }

  // 2. Water-Cementitious Materials Ratio Evaluation
  let wcmEvaluation: IWaterRatioEvaluation['waterCementitiousRatio'];
  if (freeWater <= 0 || totalBinder <= 0) {
    wcmEvaluation = {
      value: null,
      status: 'UNAVAILABLE',
      reason: freeWater <= 0 ? 'Free water quantity is missing or zero' : 'Zero total cementitious binder specified'
    };
    hasVerificationBlock = true;
  } else if (scmTotal <= 0) {
    const wcm = wcEvaluation.value;
    wcmEvaluation = {
      value: wcm,
      status: 'DERIVED_EQUAL_TO_WC',
      reason: 'Equal to w/c as no supplementary cementitious materials (SCMs) are present in mix'
    };

    if (limits.maxWaterCementitiousRatio && wcm !== null && wcm > limits.maxWaterCementitiousRatio) {
      isCompliant = false;
      complianceDetails.push(`Calculated w/cm ratio (${wcm}) exceeds maximum limit of ${limits.maxWaterCementitiousRatio}`);
    }
  } else {
    const wcm = Number((freeWater / totalBinder).toFixed(3));
    wcmEvaluation = {
      value: wcm,
      status: 'CALCULATED',
      reason: 'Calculated based on total cementitious binder (Cement + SCMs)'
    };

    if (limits.maxWaterCementitiousRatio && wcm > limits.maxWaterCementitiousRatio) {
      isCompliant = false;
      complianceDetails.push(`Calculated w/cm ratio (${wcm}) exceeds maximum limit of ${limits.maxWaterCementitiousRatio}`);
    }
  }

  // Minimum cementitious content checks
  if (limits.minCementContentKgPerM3 && pureCement < limits.minCementContentKgPerM3) {
    isCompliant = false;
    complianceDetails.push(`Pure cement content (${pureCement} kg/m³) is below minimum limit of ${limits.minCementContentKgPerM3} kg/m³`);
  }
  if (limits.minTotalCementitiousKgPerM3 && totalBinder < limits.minTotalCementitiousKgPerM3) {
    isCompliant = false;
    complianceDetails.push(`Total cementitious content (${totalBinder} kg/m³) is below minimum limit of ${limits.minTotalCementitiousKgPerM3} kg/m³`);
  }
  if (limits.maxTotalCementitiousKgPerM3 && totalBinder > limits.maxTotalCementitiousKgPerM3) {
    complianceDetails.push(`Total cementitious content (${totalBinder} kg/m³) exceeds guideline maximum of ${limits.maxTotalCementitiousKgPerM3} kg/m³`);
  }

  let complianceStatus: IWaterRatioEvaluation['engineeringCompliance']['status'] = 'WITHIN_LIMITS';
  if (hasVerificationBlock) {
    complianceStatus = 'CANNOT_VERIFY_MISSING_INPUTS';
  } else if (!isCompliant) {
    complianceStatus = 'EXCEEDS_LIMITS';
  }

  return {
    waterCementRatio: wcEvaluation,
    waterCementitiousRatio: wcmEvaluation,
    engineeringCompliance: {
      status: complianceStatus,
      details: complianceDetails.length > 0 ? complianceDetails : ['All specified parameters within configured engineering limits']
    }
  };
}

/**
 * Calculates raw material requirements for a specific pour segment.
 */
export function calculateSegmentMaterials(
  segment: ICastingEventSegment,
  recipeVersion: ICastingRecipeVersion
): { segmentRequirement: ISegmentMaterialRequirement; totalWaterContributedLiters: number } {
  const plannedVol = Number(segment.plannedVolumeM3) || 0;
  const appliedWastage = segment.recipeBinding?.appliedWastagePercent ?? (recipeVersion.ingredients[0]?.wastageAllowancePercent ?? 0);
  const wastageMultiplier = 1 + (appliedWastage / 100);

  let totalWaterContributedLiters = 0;

  const ingredientsBreakdown = recipeVersion.ingredients.map(ing => {
    const baseUnitRate = Number(ing.quantityPerM3) || 0;
    const baseQuantityUnadjusted = plannedVol * baseUnitRate * wastageMultiplier;

    let finalBaseQuantity = baseQuantityUnadjusted;
    let moistureAdj: ISegmentMaterialRequirement['ingredients'][0]['moistureAdjustment'] = {
      status: 'NOT_APPLICABLE'
    };

    // Aggregate Moisture Correction
    if (ing.category === 'FINE_AGGREGATE' || ing.category === 'COARSE_AGGREGATE') {
      const hasMoistureInput = ing.moistureCorrectionPercent !== undefined && ing.moistureCorrectionPercent !== null;
      const hasAbsorption = ing.waterAbsorptionPercent !== undefined && ing.waterAbsorptionPercent !== null;
      const basis = ing.aggregateBasis;

      if (hasMoistureInput) {
        if (!basis || !hasAbsorption || ing.moistureCorrectionPercent! < 0 || ing.waterAbsorptionPercent! < 0) {
          // Block correction if basis or absorption is invalid/missing
          moistureAdj = {
            status: 'UNVERIFIED_MOISTURE_BASIS',
            notes: 'Moisture correction blocked: Incomplete moisture/absorption basis. Proportions calculated at base design weights.'
          };
        } else {
          const Mt = Number(ing.moistureCorrectionPercent);
          const A = Number(ing.waterAbsorptionPercent);

          if (basis === 'SSD') {
            const Ms = Mt - A; // Free surface moisture
            finalBaseQuantity = baseQuantityUnadjusted * (1 + (Ms / 100));
            const freeWaterL = baseQuantityUnadjusted * (Ms / 100);
            totalWaterContributedLiters += freeWaterL;
            moistureAdj = {
              status: 'APPLIED',
              surfaceMoisturePercent: Number(Ms.toFixed(2)),
              waterContributedLiters: Number(freeWaterL.toFixed(2)),
              notes: `SSD basis: Free surface moisture ${Ms.toFixed(2)}% applied (${freeWaterL > 0 ? 'reduces' : 'adds'} batch water)`
            };
          } else if (basis === 'OVEN_DRY') {
            finalBaseQuantity = baseQuantityUnadjusted * (1 + (Mt / 100));
            const netFreeWaterL = baseQuantityUnadjusted * ((Mt - A) / 100);
            totalWaterContributedLiters += netFreeWaterL;
            moistureAdj = {
              status: 'APPLIED',
              surfaceMoisturePercent: Number((Mt - A).toFixed(2)),
              waterContributedLiters: Number(netFreeWaterL.toFixed(2)),
              notes: `Oven-dry basis: Total moisture ${Mt}% applied (${netFreeWaterL > 0 ? 'reduces' : 'adds'} batch water)`
            };
          }
        }
      }
    }

    const displayQty = convertUnit(
      finalBaseQuantity,
      ing.baseUnit,
      ing.displayUnit,
      ing.category,
      ing.specificGravity
    );

    return {
      materialIdentifier: ing.materialIdentifier,
      specificationStandard: ing.specificationStandard || 'Standard',
      name: ing.name,
      category: ing.category,
      baseQuantity: Number(finalBaseQuantity.toFixed(3)),
      baseUnit: ing.baseUnit,
      displayQuantity: displayQty,
      displayUnit: ing.displayUnit,
      specificGravity: ing.specificGravity,
      moistureAdjustment: moistureAdj
    };
  });

  const segmentRequirement: ISegmentMaterialRequirement = {
    segmentId: segment.segmentId,
    memberId: segment.memberId,
    memberName: segment.segmentName,
    grade: (segment.grade || (recipeVersion.mixType === 'RMC_PROCUREMENT' ? 'CUSTOM' : 'M25')) as ConcreteGrade,
    plannedVolumeM3: plannedVol,
    recipeCode: segment.recipeBinding?.recipeCode || 'CUSTOM',
    recipeVersion: segment.recipeBinding?.versionNumber || '1.0',
    appliedWastagePercent: appliedWastage,
    ingredients: ingredientsBreakdown
  };

  return { segmentRequirement, totalWaterContributedLiters };
}

/**
 * Calculates grade-level subtotals for an array of segment requirements.
 */
export function calculateGradeSubtotals(
  segmentRequirements: ISegmentMaterialRequirement[]
): IGradeMaterialSubtotal[] {
  const gradeMap = new Map<string, {
    grade: ConcreteGrade;
    totalVolumeM3: number;
    recipeCode: string;
    recipeVersion: string;
    ingredientsMap: Map<string, {
      materialIdentifier: string;
      specificationStandard: string;
      name: string;
      category: IngredientCategory;
      totalBaseQuantity: number;
      baseUnit: IngredientUnit;
      displayUnit: IngredientUnit;
      specificGravity?: number;
    }>;
  }>();

  for (const seg of segmentRequirements) {
    const key = `${seg.grade}__${seg.recipeCode}__${seg.recipeVersion}`;
    if (!gradeMap.has(key)) {
      gradeMap.set(key, {
        grade: seg.grade,
        totalVolumeM3: 0,
        recipeCode: seg.recipeCode,
        recipeVersion: seg.recipeVersion,
        ingredientsMap: new Map()
      });
    }

    const entry = gradeMap.get(key)!;
    entry.totalVolumeM3 += seg.plannedVolumeM3;

    for (const ing of seg.ingredients) {
      const ingKey = `${ing.materialIdentifier}__${ing.specificationStandard}__${ing.baseUnit}`;
      if (!entry.ingredientsMap.has(ingKey)) {
        entry.ingredientsMap.set(ingKey, {
          materialIdentifier: ing.materialIdentifier,
          specificationStandard: ing.specificationStandard,
          name: ing.name,
          category: ing.category,
          totalBaseQuantity: 0,
          baseUnit: ing.baseUnit,
          displayUnit: ing.displayUnit,
          specificGravity: ing.specificGravity
        });
      }
      entry.ingredientsMap.get(ingKey)!.totalBaseQuantity += ing.baseQuantity;
    }
  }

  const subtotals: IGradeMaterialSubtotal[] = [];
  for (const item of gradeMap.values()) {
    const ingredients = Array.from(item.ingredientsMap.values()).map(ing => {
      const displayQty = convertUnit(
        ing.totalBaseQuantity,
        ing.baseUnit,
        ing.displayUnit,
        ing.category,
        ing.specificGravity
      );
      return {
        materialIdentifier: ing.materialIdentifier,
        specificationStandard: ing.specificationStandard,
        name: ing.name,
        category: ing.category,
        totalBaseQuantity: Number(ing.totalBaseQuantity.toFixed(3)),
        baseUnit: ing.baseUnit,
        totalDisplayQuantity: displayQty,
        displayUnit: ing.displayUnit
      };
    });

    subtotals.push({
      grade: item.grade,
      totalVolumeM3: Number(item.totalVolumeM3.toFixed(3)),
      recipeCode: item.recipeCode,
      recipeVersion: item.recipeVersion,
      ingredients
    });
  }

  return subtotals;
}

/**
 * Consolidates total materials strictly by materialIdentifier, specificationStandard, and baseUnit.
 */
export function consolidateIngredients(
  segmentRequirements: ISegmentMaterialRequirement[]
): IConsolidatedMaterialRequirement[] {
  const map = new Map<string, {
    materialIdentifier: string;
    specificationStandard: string;
    name: string;
    category: IngredientCategory;
    totalQuantityRequired: number;
    baseUnit: IngredientUnit;
    displayUnit: IngredientUnit;
    specificGravity?: number;
  }>();

  for (const seg of segmentRequirements) {
    for (const ing of seg.ingredients) {
      const key = `${ing.materialIdentifier}__${ing.specificationStandard}__${ing.baseUnit}`;
      if (!map.has(key)) {
        map.set(key, {
          materialIdentifier: ing.materialIdentifier,
          specificationStandard: ing.specificationStandard,
          name: ing.name,
          category: ing.category,
          totalQuantityRequired: 0,
          baseUnit: ing.baseUnit,
          displayUnit: ing.displayUnit,
          specificGravity: ing.specificGravity
        });
      }
      map.get(key)!.totalQuantityRequired += ing.baseQuantity;
    }
  }

  const consolidated: IConsolidatedMaterialRequirement[] = Array.from(map.values()).map(item => {
    const displayQty = convertUnit(
      item.totalQuantityRequired,
      item.baseUnit,
      item.displayUnit,
      item.category,
      item.specificGravity
    );

    return {
      materialIdentifier: item.materialIdentifier,
      specificationStandard: item.specificationStandard,
      name: item.name,
      category: item.category,
      totalQuantityRequired: Number(item.totalQuantityRequired.toFixed(3)),
      baseUnit: item.baseUnit,
      displayQuantity: displayQty,
      displayUnit: item.displayUnit,
      inventoryStatus: 'NOT_TRACKED_IN_INVENTORY'
    };
  });

  return consolidated;
}

/**
 * Checks stock availability strictly in read-only mode against existing inventory.
 */
export async function checkInventoryAvailability(
  consolidated: IConsolidatedMaterialRequirement[],
  db: any,
  companyId: string
): Promise<IConsolidatedMaterialRequirement[]> {
  try {
    const stockItems = await db.collection('stockitems').find({
      companyId,
      isDeleted: { $ne: true }
    }).toArray();

    return consolidated.map(item => {
      // Find matching stock item only if SKU or compatible code matches
      const match = stockItems.find((s: any) => 
        (s.materialSku === item.materialIdentifier || s.itemCode === item.materialIdentifier) &&
        s.unit === item.baseUnit
      );

      if (match) {
        const available = Number(match.availableQuantity ?? match.quantity ?? 0);
        const required = item.totalQuantityRequired;
        const shortage = Math.max(0, required - available);
        return {
          ...item,
          availableStock: available,
          shortageQuantity: shortage,
          stockUnit: match.unit || item.baseUnit,
          inventoryStatus: shortage > 0 ? 'SHORTAGE' : 'SUFFICIENT'
        };
      }

      // Default: material is not tracked in digital inventory
      return {
        ...item,
        inventoryStatus: 'NOT_TRACKED_IN_INVENTORY'
      };
    });
  } catch {
    // If inventory query fails, gracefully return default status without failing MRS generation
    return consolidated.map(item => ({
      ...item,
      inventoryStatus: 'NOT_TRACKED_IN_INVENTORY'
    }));
  }
}
