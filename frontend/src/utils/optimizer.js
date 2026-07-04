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

  // Group by diameter
  const diameters = Array.from(new Set([...stocks.map(s => s.diameter), ...parts.map(p => p.diameter)]));
  
  const allLayouts = [];
  const unassignedParts = [];
  let totalPartsLength = 0;

  // Visual color coding colors
  const colors = ['#f28e8e', '#f7e1a1', '#a6e2a6', '#a0e1e1', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6'];

  diameters.forEach(dia => {
    const diaStocks = stocks.filter(s => s.diameter === dia);
    const diaParts = parts.filter(p => p.diameter === dia);

    if (diaParts.length === 0) return;

    // Expand parts into a flat list, sorted by length descending
    const flatParts = [];
    diaParts.forEach((p, partIdx) => {
      totalPartsLength += p.length * p.quantity;
      const color = colors[partIdx % colors.length];
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
            parts: []
          };
          usedBars.push(targetBar);
        } else {
          // If no matching stock could be found or all are used up
          unassignedParts.push({
            diameter: dia,
            length: part.length,
            label: part.label,
            reason: availableStocks.length === 0 ? 'No available stock for this diameter' : 'Part length (with margins) exceeds available stock bars'
          });
          return;
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

      bar.cutsCount = Math.max(0, bar.parts.length - 1);
      bar.waste = rawWaste;
      bar.utilization = (cutsLength / bar.stockLength) * 100;
    });

    // Group identical layouts
    const grouped = [];
    usedBars.forEach(bar => {
      const match = grouped.find(g => 
        g.diameter === bar.diameter &&
        g.stockLength === bar.stockLength &&
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
          parts: bar.parts.map(p => ({ length: p.length, color: p.color, label: p.label })),
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
  const totalCuts = allLayouts.reduce((sum, l) => sum + ((l.parts.length) * l.repetition), 0);
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
    },
    unassigned: unassignedParts
  };
}
