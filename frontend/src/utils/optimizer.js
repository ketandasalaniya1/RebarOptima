// 1D Cutting Stock Problem Solver using First Fit Decreasing (FFD) heuristic
export function solve1DCSP(stockRows, partsRows, options = {}) {
  const kerf = parseFloat(options.kerf || 0) || 0;
  const trimMargin = parseFloat(options.trimMargin || 0) || 0;
  const minRemnant = parseFloat(options.minRemnant || 0) || 0;

  // Filter valid rows
  const stocks = stockRows
    .map(s => ({
      diameter: s.diameter,
      length: parseFloat(s.length),
      quantity: parseInt(s.quantity) || 0
    }))
    .filter(s => s.length > 0 && s.quantity > 0);

  const parts = partsRows
    .map(p => ({
      diameter: p.diameter,
      length: parseFloat(p.length),
      quantity: parseInt(p.quantity) || 0,
      label: p.label || ''
    }))
    .filter(p => p.length > 0 && p.quantity > 0);

  if (parts.length === 0) {
    throw new Error("Please enter at least one valid required part with length and quantity greater than 0.");
  }

  // ponytail: input validation at trust boundary - prevent physically impossible part lengths that exceed stock. O(N*M) check, works fast for small browser input sheets.
  for (const part of parts) {
    const diaStocks = stocks.filter(s => s.diameter === part.diameter);
    const maxStockLength = diaStocks.length > 0
      ? Math.max(...diaStocks.map(s => s.length))
      : 12000;

    const requiredLength = part.length + trimMargin * 2;
    if (requiredLength > maxStockLength) {
      if (diaStocks.length > 0) {
        throw new Error(`Required part length (${part.length} mm)${trimMargin > 0 ? ` plus trim margin (${trimMargin * 2} mm)` : ''} cannot be greater than the maximum stock length (${maxStockLength} mm) for diameter ${part.diameter} mm.`);
      } else {
        throw new Error(`Required part length (${part.length} mm)${trimMargin > 0 ? ` plus trim margin (${trimMargin * 2} mm)` : ''} cannot be greater than the default virtual stock length (12,000 mm) for diameter ${part.diameter} mm. Please add a stock bar of at least ${requiredLength} mm.`);
      }
    }
  }

  // Group by diameter
  const diameters = Array.from(new Set([...stocks.map(s => s.diameter), ...parts.map(p => p.diameter)]));
  
  const allLayouts = [];
  let totalPartsLength = 0;

  // Visual color coding colors - shades of gray sorted from darker to lighter
  const colors = [
    '#36454F', // Charcoal
    '#71797E', // Steel Gray
    '#708090', // Slate Gray
    '#808080', // Gray
    '#818589', // Gunmetal Gray
    '#848884', // Smoke
    '#7393B3', // Blue Gray
    '#899499', // Pewter
    '#A9A9A9', // Dark Gray
    '#B2BEB5', // Ash Gray
    '#C0C0C0', // Silver
    '#D3D3D3', // Light Gray
    '#E5E4E2'  // Platinum
  ];

  diameters.forEach(dia => {
    const diaStocks = stocks.filter(s => s.diameter === dia);
    const diaParts = parts.filter(p => p.diameter === dia);

    if (diaParts.length === 0) return;

    // Expand parts into a flat list. Sort unique part lengths descending to assign colors from darker to lighter.
    const sortedUniquePartLengths = Array.from(new Set(diaParts.map(p => p.length))).sort((a, b) => b - a);
    const flatParts = [];
    diaParts.forEach((p) => {
      totalPartsLength += p.length * p.quantity;
      const lengthIdx = sortedUniquePartLengths.indexOf(p.length);
      const color = colors[lengthIdx % colors.length];
      for (let i = 0; i < p.quantity; i++) {
        flatParts.push({ length: p.length, label: p.label, color });
      }
    });
    flatParts.sort((a, b) => b.length - a.length);

    // Expand available stocks
    const availableStocks = [];
    diaStocks.forEach(s => {
      for (let i = 0; i < s.quantity; i++) {
        availableStocks.push({ length: s.length });
      }
    });
    availableStocks.sort((a, b) => b.length - a.length);

    const usedBars = [];

    flatParts.forEach(part => {
      let targetBar = null;
      for (let bar of usedBars) {
        const totalUsedLength = bar.parts.reduce((sum, p) => sum + p.length + kerf, 0) + trimMargin * 2;
        if (totalUsedLength + part.length <= bar.stockLength) {
          targetBar = bar;
          break;
        }
      }

      if (!targetBar) {
        // Start a new bar from available stocks
        let stockIndex = -1;
        for (let i = 0; i < availableStocks.length; i++) {
          if (availableStocks[i].length >= part.length + trimMargin * 2) {
            stockIndex = i;
            break;
          }
        }

        if (stockIndex !== -1) {
          const barLength = availableStocks[stockIndex].length;
          availableStocks.splice(stockIndex, 1);
          targetBar = {
            stockLength: barLength,
            diameter: dia,
            isVirtual: false,
            parts: []
          };
          usedBars.push(targetBar);
        } else {
          // If no matching stock could be found or all are used up, create a virtual stock bar (default 12000 mm)
          const barLength = 12000;
          targetBar = {
            stockLength: barLength,
            diameter: dia,
            isVirtual: true,
            parts: []
          };
          usedBars.push(targetBar);
        }
      }

      targetBar.parts.push(part);
    });

    // Calculate remnants/waste
    usedBars.forEach(bar => {
      const cutsLength = bar.parts.reduce((sum, p) => sum + p.length, 0);
      const kerfCount = Math.max(0, bar.parts.length - 1);
      const totalCutAndKerf = cutsLength + kerfCount * kerf;
      const totalUsedWithTrim = totalCutAndKerf + trimMargin * 2;
      const rawWaste = bar.stockLength - totalUsedWithTrim;

      bar.cutsCount = bar.parts.length === 0 ? 0 : (rawWaste > 0.1 ? bar.parts.length : bar.parts.length - 1);
      bar.waste = rawWaste;
      bar.utilization = (cutsLength / bar.stockLength) * 100;
    });

    // Group identical layouts
    const grouped = [];
    usedBars.forEach(bar => {
      const match = grouped.find(g => 
        g.diameter === bar.diameter &&
        g.stockLength === bar.stockLength &&
        g.isVirtual === bar.isVirtual &&
        g.parts.length === bar.parts.length &&
        g.parts.every((p, idx) => p.length === bar.parts[idx].length)
      );

      if (match) {
        match.repetition += 1;
      } else {
        grouped.push({
          repetition: 1,
          diameter: bar.diameter,
          stockLength: bar.stockLength,
          isVirtual: bar.isVirtual,
          parts: bar.parts.map(p => ({ 
            length: p.length, 
            color: bar.isVirtual ? '#ffb3b3' : p.color, // Muted red if virtual
            label: p.label 
          })),
          cutsCount: bar.cutsCount,
          waste: bar.waste,
          utilization: bar.utilization
        });
      }
    });

    allLayouts.push(...grouped);
  });

  // Calculate global summary stats
  const totalUsedLength = allLayouts.reduce((sum, l) => sum + (l.stockLength * l.repetition), 0);
  const totalCuts = allLayouts.reduce((sum, l) => sum + (l.cutsCount * l.repetition), 0);
  const totalRemnant = allLayouts.reduce((sum, l) => sum + (l.waste * l.repetition), 0);
  const avgUtil = totalUsedLength > 0 ? ((totalPartsLength / totalUsedLength) * 100) : 0;

  return {
    layouts: allLayouts.map((l, idx) => ({ ...l, id: String.fromCharCode(65 + (idx % 26)) })),
    summary: {
      totalPartsLength,
      totalUsedStockLength: totalUsedLength,
      totalCutsCount: totalCuts,
      totalRemnant,
      avgUtilization: avgUtil
    }
  };
}
