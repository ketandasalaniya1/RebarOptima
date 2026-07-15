// 1D Cutting Stock Problem Solver using First Fit Decreasing (FFD) heuristic
export function solve1DCSP(stockRows, partsRows, options = {}) {
  const kerf = parseFloat(options.kerf || 0) || 0;
  const trimMargin = parseFloat(options.trimMargin || 0) || 0;

  // Filter valid rows and keep dbId / isRemnant
  const stocks = stockRows
    .map(s => ({
      diameter: s.diameter,
      length: parseFloat(s.length),
      quantity: parseInt(s.quantity) || 0,
      dbId: s.dbId,
      isRemnant: !!s.isRemnant
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
    '#dc2626'  // Red
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

    // Expand available stocks and preserve their dbId and isRemnant status
    const availableStocks = [];
    diaStocks.forEach(s => {
      for (let i = 0; i < s.quantity; i++) {
        availableStocks.push({ length: s.length, dbId: s.dbId, isRemnant: s.isRemnant });
      }
    });
    
    // Sort available stocks by length descending, but we will scan remnants first inside the loop!
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
        
        // ponytail: prioritize remnants first as requested: "for Remanant use first in next Batch of Optimisation"
        for (let i = 0; i < availableStocks.length; i++) {
          if (availableStocks[i].isRemnant && availableStocks[i].length >= part.length + trimMargin * 2) {
            stockIndex = i;
            break;
          }
        }
        
        // If no remnant was found that fits, check the standard stock bars
        if (stockIndex === -1) {
          for (let i = 0; i < availableStocks.length; i++) {
            if (!availableStocks[i].isRemnant && availableStocks[i].length >= part.length + trimMargin * 2) {
              stockIndex = i;
              break;
            }
          }
        }

        if (stockIndex !== -1) {
          const selectedStock = availableStocks[stockIndex];
          availableStocks.splice(stockIndex, 1);
          targetBar = {
            stockLength: selectedStock.length,
            diameter: dia,
            isVirtual: false,
            dbId: selectedStock.dbId,
            isRemnant: selectedStock.isRemnant,
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

    // Group identical layouts, keeping tracking of dbId and isRemnant
    const grouped = [];
    usedBars.forEach(bar => {
      const match = grouped.find(g => 
        g.diameter === bar.diameter &&
        g.stockLength === bar.stockLength &&
        g.isVirtual === bar.isVirtual &&
        g.dbId === bar.dbId &&
        g.isRemnant === bar.isRemnant &&
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
          dbId: bar.dbId,
          isRemnant: bar.isRemnant,
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
    layouts: allLayouts.map((l, idx) => ({ ...l, id: String(idx + 1) })),
    summary: {
      totalPartsLength,
      totalUsedStockLength: totalUsedLength,
      totalCutsCount: totalCuts,
      totalRemnant,
      avgUtilization: avgUtil
    }
  };
}
