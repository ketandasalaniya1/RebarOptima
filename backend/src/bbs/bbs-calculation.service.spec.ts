import { BbsCalculationService } from './bbs-calculation.service';

describe('BbsCalculationService - Civil & Structural Rebar Calculations', () => {
  let service: BbsCalculationService;

  beforeEach(() => {
    service = new BbsCalculationService();
  });

  describe('Universal Weight Formulas', () => {
    it('should calculate rebar unit weight using D^2 / 162.27', () => {
      // 8mm bar: 64 / 162.27 = ~0.394 kg/m
      expect(service.calculateUnitWeight(8)).toBeCloseTo(0.3944, 3);

      // 12mm bar: 144 / 162.27 = ~0.887 kg/m
      expect(service.calculateUnitWeight(12)).toBeCloseTo(0.8874, 3);

      // 16mm bar: 256 / 162.27 = ~1.578 kg/m
      expect(service.calculateUnitWeight(16)).toBeCloseTo(1.5776, 3);

      // 25mm bar: 625 / 162.27 = ~3.852 kg/m
      expect(service.calculateUnitWeight(25)).toBeCloseTo(3.8516, 3);
    });

    it('should calculate unit weight per mm', () => {
      const weightPerM = service.calculateUnitWeight(16);
      expect(service.calculateUnitWeightPerMm(16)).toBe(weightPerM / 1000);
    });
  });

  describe('IS 2502 Bend Deductions & Hooks', () => {
    it('should deduce correct lengths for 45, 90, 135, and 180 degree bends', () => {
      const dia = 16;
      expect(service.calculateBendDeduction(dia, 45)).toBe(1 * dia); // 16mm
      expect(service.calculateBendDeduction(dia, 90)).toBe(2 * dia); // 32mm
      expect(service.calculateBendDeduction(dia, 135)).toBe(3 * dia); // 48mm
      expect(service.calculateBendDeduction(dia, 180)).toBe(4 * dia); // 64mm
    });

    it('should accumulate multiple bend deductions', () => {
      const dia = 12;
      // Two 90 degree bends + one 45 degree bend = 2d + 2d + 1d = 5d = 60mm
      const totalDeduction = service.calculateTotalBendDeductions(dia, [90, 90, 45]);
      expect(totalDeduction).toBe(60);
    });

    it('should calculate seismic hook addition as 10d per hook (IS 13920)', () => {
      const dia = 8;
      // 2 stirrup hooks: 2 * 10 * 8 = 160mm
      expect(service.calculateSeismicHookAddition(dia, 2)).toBe(160);
    });
  });

  describe('IS 456 Development Length (Ld)', () => {
    it('should lookup development length correctly from concrete x steel grade matrix', () => {
      // M25 with Fe500 -> 46d
      expect(service.calculateDevelopmentLength(16, 'M25', 'Fe500')).toBe(46 * 16);

      // M30 with Fe500D -> 41d
      expect(service.calculateDevelopmentLength(20, 'M30', 'Fe500D')).toBe(41 * 20);

      // M20 with Fe415 -> 47d
      expect(service.calculateDevelopmentLength(12, 'M20', 'Fe415')).toBe(47 * 12);
    });

    it('should fallback to 50d if grade combination is missing', () => {
      expect(service.calculateDevelopmentLength(16, 'M60', 'Fe500')).toBe(50 * 16);
    });
  });

  describe('Span & Quantity Math', () => {
    it('should calculate rebar quantity as ceil(span / spacing) + 1', () => {
      // 3000mm clear span, 150mm spacing -> 20 + 1 = 21 bars
      expect(service.calculateBarQuantity(3000, 150)).toBe(21);

      // 3050mm clear span, 150mm spacing -> ceil(20.33) + 1 = 21 + 1 = 22 bars
      expect(service.calculateBarQuantity(3050, 150)).toBe(22);
    });

    it('should calculate concrete volume from mm dimensions to m3', () => {
      // 5000mm x 300mm x 600mm beam = 5m x 0.3m x 0.6m = 0.9 m3
      expect(service.calculateConcreteVolume(5000, 300, 600)).toBeCloseTo(0.9, 4);
    });
  });
});
