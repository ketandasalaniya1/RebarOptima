// 1D Cutting Stock Problem Solver Engine (Server-side Protected)
export interface StockInputRow {
  diameter: number | string;
  length: number | string;
  quantity: number | string;
  dbId?: string;
  isRemnant?: boolean;
}

export interface PartInputRow {
  diameter: number | string;
  length: number | string;
  quantity: number | string;
  label?: string;
}

export interface OptimizerOptions {
  kerf?: number;
  trimMargin?: number;
}

export interface PartLayoutItem {
  length: number;
  label?: string;
  color?: string;
}

export interface BarLayout {
  id?: string;
  repetition: number;
  diameter: number;
  stockLength: number;
  isVirtual: boolean;
  dbId?: string;
  isRemnant?: boolean;
  parts: PartLayoutItem[];
  cutsCount: number;
  waste: number;
  utilization: number;
}

export interface OptimizationResult {
  layouts: BarLayout[];
  summary: {
    totalPartsLength: number;
    totalUsedStockLength: number;
    totalCutsCount: number;
    totalRemnant: number;
    avgUtilization: number;
  };
}

export function solve1DCSP(
  stockRows: StockInputRow[],
  partsRows: PartInputRow[],
  options: OptimizerOptions = {},
): OptimizationResult {
  const kerf = parseFloat(String(options.kerf || 0)) || 0;
  const trimMargin = parseFloat(String(options.trimMargin || 0)) || 0;

  // Filter valid rows and keep dbId / isRemnant
  const stocks = stockRows
    .map(s => ({
      diameter: Number(s.diameter),
      length: parseFloat(String(s.length)),
      quantity: parseInt(String(s.quantity), 10) || 0,
      dbId: s.dbId,
      isRemnant: !!s.isRemnant,
    }))
    .filter(s => s.length > 0 && s.quantity > 0);

  const parts = partsRows
    .map(p => ({
      diameter: Number(p.diameter),
      length: parseFloat(String(p.length)),
      quantity: parseInt(String(p.quantity), 10) || 0,
      label: p.label || '',
    }))
    .filter(p => p.length > 0 && p.quantity > 0);

  if (parts.length === 0) {
    throw new Error('Please enter at least one valid required part with length and quantity greater than 0.');
  }

  // Physical feasibility checks against stock
  for (const part of parts) {
    const diaStocks = stocks.filter(s => s.diameter === part.diameter);
    const maxStockLength =
      diaStocks.length > 0 ? Math.max(...diaStocks.map(s => s.length)) : 12000;

    const requiredLength = part.length + trimMargin * 2;
    if (requiredLength > maxStockLength) {
      if (diaStocks.length > 0) {
        throw new Error(
          `Required part length (${part.length} mm)${trimMargin > 0 ? ` plus trim margin (${trimMargin * 2} mm)` : ''} cannot be greater than the maximum stock length (${maxStockLength} mm) for diameter ${part.diameter} mm.`,
        );
      } else {
        throw new Error(
          `Required part length (${part.length} mm)${trimMargin > 0 ? ` plus trim margin (${trimMargin * 2} mm)` : ''} cannot be greater than the default virtual stock length (12,000 mm) for diameter ${part.diameter} mm. Please add a stock bar of at least ${requiredLength} mm.`,
        );
      }
    }
  }

  // Group by unique diameters
  const diameters = Array.from(
    new Set([...stocks.map(s => s.diameter), ...parts.map(p => p.diameter)]),
  );

  const allLayouts: BarLayout[] = [];
  let totalPartsLength = 0;

  // Visual color coding
  const colors = [
    '#0d9488', // Teal
    '#4f46e5', // Indigo
    '#e11d48', // Rose
    '#ea580c', // Orange
    '#9333ea', // Purple
    '#d97706', // Amber
    '#0284c7', // Sky Blue
    '#16a34a', // Green
    '#7c3aed', // Violet
    '#db2777', // Pink
    '#0891b2', // Cyan
    '#059669', // Emerald
    '#dc2626', // Red
  ];

  diameters.forEach(dia => {
    const diaStocks = stocks.filter(s => s.diameter === dia);
    const diaParts = parts.filter(p => p.diameter === dia);

    if (diaParts.length === 0) return;

    // Expand parts into flat array
    const sortedUniquePartLengths = Array.from(
      new Set(diaParts.map(p => p.length)),
    ).sort((a, b) => b - a);

    const flatParts: PartLayoutItem[] = [];
    diaParts.forEach(p => {
      totalPartsLength += p.length * p.quantity;
      const lengthIdx = sortedUniquePartLengths.indexOf(p.length);
      const color = colors[lengthIdx % colors.length];
      for (let i = 0; i < p.quantity; i++) {
        flatParts.push({ length: p.length, label: p.label, color });
      }
    });
    flatParts.sort((a, b) => b.length - a.length);

    // Separate available stocks into remnants and standard bars
    const availableRemnants: { length: number; dbId?: string; isRemnant?: boolean }[] = [];
    const availableStandards: { length: number; dbId?: string; isRemnant?: boolean }[] = [];

    diaStocks.forEach(s => {
      for (let i = 0; i < s.quantity; i++) {
        const item = { length: s.length, dbId: s.dbId, isRemnant: s.isRemnant };
        if (s.isRemnant) {
          availableRemnants.push(item);
        } else {
          availableStandards.push(item);
        }
      }
    });

    // Remnants sorted in ASCENDING order (lower to higher length) to consume shortest fitting remnant first
    availableRemnants.sort((a, b) => a.length - b.length);

    // Standard stock bars sorted in DESCENDING order (longest stock first)
    availableStandards.sort((a, b) => b.length - a.length);

    const usedBars: {
      stockLength: number;
      diameter: number;
      isVirtual: boolean;
      dbId?: string;
      isRemnant?: boolean;
      parts: PartLayoutItem[];
      cutsCount?: number;
      waste?: number;
      utilization?: number;
    }[] = [];

    flatParts.forEach(part => {
      let targetBar: (typeof usedBars)[0] | null = null;
      for (const bar of usedBars) {
        const totalUsedLength =
          bar.parts.reduce((sum, p) => sum + p.length + kerf, 0) + trimMargin * 2;
        if (totalUsedLength + part.length <= bar.stockLength) {
          targetBar = bar;
          break;
        }
      }

      if (!targetBar) {
        // Start a new bar from available stocks
        let stockIndex = -1;
        let isFromRemnant = false;

        // 1. Prioritize remnants first in LOWER to HIGHER length order
        for (let i = 0; i < availableRemnants.length; i++) {
          if (availableRemnants[i].length >= part.length + trimMargin * 2) {
            stockIndex = i;
            isFromRemnant = true;
            break;
          }
        }

        // 2. Check standard stock bars (descending order)
        if (stockIndex === -1) {
          for (let i = 0; i < availableStandards.length; i++) {
            if (availableStandards[i].length >= part.length + trimMargin * 2) {
              stockIndex = i;
              isFromRemnant = false;
              break;
            }
          }
        }

        if (stockIndex !== -1) {
          const selectedStock = isFromRemnant
            ? availableRemnants.splice(stockIndex, 1)[0]
            : availableStandards.splice(stockIndex, 1)[0];

          targetBar = {
            stockLength: selectedStock.length,
            diameter: dia,
            isVirtual: false,
            dbId: selectedStock.dbId,
            isRemnant: selectedStock.isRemnant,
            parts: [],
          };
          usedBars.push(targetBar);
        } else {
          // Virtual stock fallback (12000 mm)
          const barLength = 12000;
          targetBar = {
            stockLength: barLength,
            diameter: dia,
            isVirtual: true,
            parts: [],
          };
          usedBars.push(targetBar);
        }
      }

      targetBar.parts.push(part);
    });

    // Calculate remnants / waste metrics per bar
    usedBars.forEach(bar => {
      const cutsLength = bar.parts.reduce((sum, p) => sum + p.length, 0);
      const kerfCount = Math.max(0, bar.parts.length - 1);
      const totalCutAndKerf = cutsLength + kerfCount * kerf;
      const totalUsedWithTrim = totalCutAndKerf + trimMargin * 2;
      const rawWaste = bar.stockLength - totalUsedWithTrim;

      bar.cutsCount =
        bar.parts.length === 0 ? 0 : rawWaste > 0.1 ? bar.parts.length : bar.parts.length - 1;
      bar.waste = rawWaste;
      bar.utilization = (cutsLength / bar.stockLength) * 100;
    });

    // Group identical layouts
    const grouped: BarLayout[] = [];
    usedBars.forEach(bar => {
      const match = grouped.find(
        g =>
          g.diameter === bar.diameter &&
          g.stockLength === bar.stockLength &&
          g.isVirtual === bar.isVirtual &&
          g.dbId === bar.dbId &&
          g.isRemnant === bar.isRemnant &&
          g.parts.length === bar.parts.length &&
          g.parts.every((p, idx) => p.length === bar.parts[idx].length),
      );

      if (match) {
        match.repetition += 1;
      } else {
        grouped.push({
          repetition: 1,
          diameter: bar.diameter,
          stockLength: bar.stockLength,
          isVirtual: bar.isVirtual,
          dbId: bar.dbId,
          isRemnant: bar.isRemnant,
          parts: bar.parts.map(p => ({
            length: p.length,
            color: bar.isVirtual ? '#ffb3b3' : p.color,
            label: p.label,
          })),
          cutsCount: bar.cutsCount || 0,
          waste: bar.waste || 0,
          utilization: bar.utilization || 0,
        });
      }
    });

    allLayouts.push(...grouped);
  });

  // Calculate global summary stats
  const totalUsedLength = allLayouts.reduce(
    (sum, l) => sum + l.stockLength * l.repetition,
    0,
  );
  const totalCuts = allLayouts.reduce((sum, l) => sum + l.cutsCount * l.repetition, 0);
  const totalRemnant = allLayouts.reduce((sum, l) => sum + l.waste * l.repetition, 0);
  const avgUtil = totalUsedLength > 0 ? (totalPartsLength / totalUsedLength) * 100 : 0;

  return {
    layouts: allLayouts.map((l, idx) => ({ ...l, id: String(idx + 1) })),
    summary: {
      totalPartsLength,
      totalUsedStockLength: totalUsedLength,
      totalCutsCount: totalCuts,
      totalRemnant,
      avgUtilization: avgUtil,
    },
  };
}
