import { solve1DCSP, StockInputRow, PartInputRow } from './optimizer.engine';

describe('solve1DCSP - 1D Cutting Stock Optimizer Engine', () => {
  it('should throw an error if no valid required parts are provided', () => {
    expect(() => {
      solve1DCSP([], []);
    }).toThrow('Please enter at least one valid required part');

    expect(() => {
      solve1DCSP([], [{ diameter: 12, length: 0, quantity: 10 }]);
    }).toThrow('Please enter at least one valid required part');
  });

  it('should throw when required part exceeds maximum stock length', () => {
    const stock: StockInputRow[] = [{ diameter: 16, length: 10000, quantity: 5 }];
    const parts: PartInputRow[] = [{ diameter: 16, length: 11000, quantity: 1 }];

    expect(() => {
      solve1DCSP(stock, parts);
    }).toThrow(/cannot be greater than the maximum stock length/);
  });

  it('should allocate parts into virtual 12m stock when no physical stock is provided', () => {
    const parts: PartInputRow[] = [
      { diameter: 12, length: 4000, quantity: 3, label: 'Beam Top' },
    ];

    const result = solve1DCSP([], parts, { kerf: 0, trimMargin: 0 });

    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0].stockLength).toBe(12000);
    expect(result.layouts[0].isVirtual).toBe(true);
    expect(result.layouts[0].parts).toHaveLength(3);
    expect(result.layouts[0].waste).toBe(0);
    expect(result.layouts[0].utilization).toBe(100);
    expect(result.summary.totalPartsLength).toBe(12000);
    expect(result.summary.totalUsedStockLength).toBe(12000);
    expect(result.summary.avgUtilization).toBe(100);
  });

  it('should prioritize remnants over standard stock bars', () => {
    const stock: StockInputRow[] = [
      { diameter: 20, length: 12000, quantity: 5, isRemnant: false, dbId: 'std-1' },
      { diameter: 20, length: 5000, quantity: 1, isRemnant: true, dbId: 'rem-1' },
      { diameter: 20, length: 8000, quantity: 1, isRemnant: true, dbId: 'rem-2' },
    ];
    const parts: PartInputRow[] = [
      { diameter: 20, length: 4500, quantity: 1, label: 'Column Rebar' },
    ];

    const result = solve1DCSP(stock, parts, { kerf: 0, trimMargin: 0 });

    expect(result.layouts).toHaveLength(1);
    // Should choose the 5000mm remnant (shortest fitting remnant)
    expect(result.layouts[0].isRemnant).toBe(true);
    expect(result.layouts[0].dbId).toBe('rem-1');
    expect(result.layouts[0].stockLength).toBe(5000);
    expect(result.layouts[0].waste).toBe(500);
  });

  it('should separate optimizations by rebar diameter', () => {
    const stock: StockInputRow[] = [
      { diameter: 10, length: 12000, quantity: 2 },
      { diameter: 16, length: 12000, quantity: 2 },
    ];
    const parts: PartInputRow[] = [
      { diameter: 10, length: 5000, quantity: 2 },
      { diameter: 16, length: 6000, quantity: 2 },
    ];

    const result = solve1DCSP(stock, parts, { kerf: 0, trimMargin: 0 });

    const d10Layouts = result.layouts.filter(l => l.diameter === 10);
    const d16Layouts = result.layouts.filter(l => l.diameter === 16);

    expect(d10Layouts.length).toBeGreaterThan(0);
    expect(d16Layouts.length).toBeGreaterThan(0);
    expect(d10Layouts[0].parts.every(p => p.length === 5000)).toBe(true);
    expect(d16Layouts[0].parts.every(p => p.length === 6000)).toBe(true);
  });

  it('should calculate cuts count and waste correctly with kerf and trim margin', () => {
    const stock: StockInputRow[] = [
      { diameter: 12, length: 10000, quantity: 1 },
    ];
    const parts: PartInputRow[] = [
      { diameter: 12, length: 3000, quantity: 2 },
    ];

    // trimMargin: 25mm on each end (50mm total), kerf: 3mm
    const result = solve1DCSP(stock, parts, { kerf: 3, trimMargin: 25 });

    expect(result.layouts).toHaveLength(1);
    const layout = result.layouts[0];
    expect(layout.parts).toHaveLength(2);
    // Cut 1: 3000mm, Cut 2: 3000mm, 2 physical cuts (between parts + detach remnant = 6mm kerf), trim: 50mm -> total used = 6056mm
    // waste = 10000 - 6056 = 3944mm
    expect(layout.waste).toBe(3944);
    // cutsCount: because there is remnant waste, 2 parts require 2 physical cuts from the master bar
    expect(layout.cutsCount).toBe(2);
  });

  it('should not deduct trimMargin again when cutting from a reusable remnant', () => {
    const stock: StockInputRow[] = [
      { diameter: 16, length: 5000, quantity: 1, isRemnant: true, dbId: 'rem-5000' },
    ];
    const parts: PartInputRow[] = [
      { diameter: 16, length: 4500, quantity: 1 },
    ];

    // trimMargin: 25mm on master bars (50mm total), kerf: 3mm
    const result = solve1DCSP(stock, parts, { kerf: 3, trimMargin: 25 });

    expect(result.layouts).toHaveLength(1);
    const layout = result.layouts[0];
    expect(layout.isRemnant).toBe(true);
    // 1 part cut from remnant: 1 cut = 3mm kerf. No 50mm trim deducted!
    // waste = 5000 - (4500 + 3) = 497mm
    expect(layout.waste).toBe(497);
    expect(layout.cutsCount).toBe(1);
  });
});
