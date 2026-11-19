import { convertUnit, calculateWaterRatios } from './casting.calculation.service';
import { ICastingRecipeVersion } from './casting.types';

describe('Casting Calculation Service Unit Tests', () => {
  describe('convertUnit', () => {
    it('should return identical value if baseUnit equals displayUnit', () => {
      expect(convertUnit(150.5, 'KG', 'KG', 'CEMENT')).toBe(150.5);
      expect(convertUnit(2.45, 'M3', 'M3', 'READY_MIX_CONCRETE')).toBe(2.45);
    });

    it('should convert KG to 50KG bags for cementitious categories', () => {
      expect(convertUnit(350, 'KG', 'BAGS_50KG', 'CEMENT')).toBe(7.0);
      expect(convertUnit(420, 'KG', 'BAGS_50KG', 'SUPPLEMENTARY_CEMENTITIOUS')).toBe(8.4);
    });

    it('should reject BAGS_50KG conversion for non-cementitious materials', () => {
      expect(() => {
        convertUnit(100, 'KG', 'BAGS_50KG', 'COARSE_AGGREGATE');
      }).toThrow(/only supported for cementitious materials/);
    });

    it('should convert KG to Metric Tonnes (MT)', () => {
      expect(convertUnit(2500, 'KG', 'METRIC_TONNE', 'COARSE_AGGREGATE')).toBe(2.5);
      expect(convertUnit(750, 'KG', 'METRIC_TONNE', 'FINE_AGGREGATE')).toBe(0.75);
    });

    it('should convert mass (KG) to volume (LITERS) using specific gravity', () => {
      // 100 kg with specific gravity 1.25 -> 80 liters
      expect(convertUnit(100, 'KG', 'LITERS', 'ADMIXTURE', 1.25)).toBe(80);
    });

    it('should throw an error when converting KG to LITERS without positive specific gravity', () => {
      expect(() => {
        convertUnit(100, 'KG', 'LITERS', 'ADMIXTURE');
      }).toThrow(/without a verified positive specificGravity/);

      expect(() => {
        convertUnit(100, 'KG', 'LITERS', 'ADMIXTURE', 0);
      }).toThrow(/without a verified positive specificGravity/);
    });
  });

  describe('calculateWaterRatios', () => {
    it('should calculate water-cement ratio and verify compliance within limits', () => {
      const mockRecipe: ICastingRecipeVersion = {
        versionNumber: 1,
        mixType: 'SITE_MIX',
        concreteGrade: 'M25',
        status: 'ACTIVE',
        ingredients: [
          { category: 'CEMENT', materialName: 'OPC 53', quantityPerM3: 350, baseUnit: 'KG', displayUnit: 'BAGS_50KG' },
          { category: 'WATER', materialName: 'Water', quantityPerM3: 160, baseUnit: 'LITERS', displayUnit: 'LITERS' },
        ],
        engineeringLimits: {
          maxWaterCementRatio: 0.50,
        },
      } as any;

      const evalResult = calculateWaterRatios(mockRecipe);
      expect(evalResult.waterCementRatio.status).toBe('CALCULATED');
      // 160 / 350 = ~0.457
      expect(evalResult.waterCementRatio.value).toBeCloseTo(0.457, 3);
      expect(evalResult.engineeringCompliance.status).toBe('WITHIN_LIMITS');
    });

    it('should flag engineering non-compliance when w/c exceeds maximum limit', () => {
      const mockRecipe: ICastingRecipeVersion = {
        versionNumber: 1,
        mixType: 'SITE_MIX',
        concreteGrade: 'M20',
        status: 'ACTIVE',
        ingredients: [
          { category: 'CEMENT', materialName: 'OPC 43', quantityPerM3: 300, baseUnit: 'KG', displayUnit: 'BAGS_50KG' },
          { category: 'WATER', materialName: 'Water', quantityPerM3: 180, baseUnit: 'LITERS', displayUnit: 'LITERS' },
        ],
        engineeringLimits: {
          maxWaterCementRatio: 0.50,
        },
      } as any;

      const evalResult = calculateWaterRatios(mockRecipe);
      // 180 / 300 = 0.60 > 0.50
      expect(evalResult.waterCementRatio.value).toBe(0.6);
      expect(evalResult.engineeringCompliance.status).toBe('EXCEEDS_LIMITS');
      expect(evalResult.engineeringCompliance.details[0]).toContain('exceeds maximum limit');
    });
  });
});
