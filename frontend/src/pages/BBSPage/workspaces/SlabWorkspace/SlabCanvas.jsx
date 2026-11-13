import React, { useRef, useEffect } from 'react';

export default function SlabCanvas({
  Lx = 3000,
  Ly = 4500,
  t = 150,
  cover = 20,
  mainDia = 10,
  mainSpacing = 150,
  distDia = 8,
  distSpacing = 150,
  includeTopExtras = true,
  width = 620,
  height = 260
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Left 65%: Slab Plan View; Right 35%: Thickness Section
    const planW = width * 0.65;
    const sectW = width * 0.35;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. PLAN VIEW (Left)
    // ──────────────────────────────────────────────────────────────────────────
    const margin = 35;
    const availPlanW = planW - (2 * margin);
    const availPlanH = height - (2 * margin);

    const scale = Math.min(availPlanW / Ly, availPlanH / Lx, 0.45);
    const renderLy = Ly * scale;
    const renderLx = Lx * scale;

    const planX = margin + ((availPlanW - renderLy) / 2);
    const planY = margin + ((availPlanH - renderLx) / 2);

    // Slab Outline (Concrete)
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(planX, planY, renderLy, renderLx);
    ctx.strokeRect(planX, planY, renderLy, renderLx);

    // Cover Boundary (dashed)
    const renderCover = cover * scale;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(planX + renderCover, planY + renderCover, renderLy - (2 * renderCover), renderLx - (2 * renderCover));
    ctx.setLineDash([]);

    // Main Reinforcement Bars (Red lines along Lx, running vertically)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.5;
    const sMain = Math.max(12, mainSpacing * scale * 2);
    for (let x = planX + renderCover + 10; x <= planX + renderLy - renderCover - 10; x += sMain) {
      ctx.beginPath();
      ctx.moveTo(x, planY + renderCover);
      ctx.lineTo(x, planY + renderLx - renderCover);
      ctx.stroke();
    }

    // Distribution Bars (Green lines along Ly, running horizontally)
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.2;
    const sDist = Math.max(12, distSpacing * scale * 2);
    for (let y = planY + renderCover + 10; y <= planY + renderLx - renderCover - 10; y += sDist) {
      ctx.beginPath();
      ctx.moveTo(planX + renderCover, y);
      ctx.lineTo(planX + renderLy - renderCover, y);
      ctx.stroke();
    }

    // Top Negative Extra Bars (Orange bars at Left and Right support edges)
    if (includeTopExtras) {
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 1.5;
      const topExtentW = renderLy * 0.25;
      for (let y = planY + renderCover + 15; y <= planY + renderLx - renderCover - 15; y += sMain * 1.5) {
        // Left support edge
        ctx.beginPath();
        ctx.moveTo(planX + renderCover, y);
        ctx.lineTo(planX + renderCover + topExtentW, y);
        ctx.stroke();
        // Right support edge
        ctx.beginPath();
        ctx.moveTo(planX + renderLy - renderCover - topExtentW, y);
        ctx.lineTo(planX + renderLy - renderCover, y);
        ctx.stroke();
      }
    }

    // Plan Dimensions
    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Longer Span Ly = ${Ly} mm`, planX + (renderLy / 2), planY - 10);

    ctx.save();
    ctx.translate(planX - 12, planY + (renderLx / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Shorter Span Lx = ${Lx} mm`, 0, 0);
    ctx.restore();

    // ──────────────────────────────────────────────────────────────────────────
    // 2. SLAB THICKNESS SECTION (Right)
    // ──────────────────────────────────────────────────────────────────────────
    const sectOriginX = planW + 20;
    const sectAvailW = sectW - 40;
    const sectAvailH = height - 80;

    const scaleSect = Math.min(sectAvailW / 600, sectAvailH / (t * 2), 0.6);
    const renderSectW = 200 * scaleSect * 1.8;
    const renderT = t * scaleSect * 1.8;

    const sX = sectOriginX + ((sectAvailW - renderSectW) / 2);
    const sY = (height - renderT) / 2;

    // Concrete Slab Section
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(sX, sY, renderSectW, renderT);
    ctx.strokeRect(sX, sY, renderSectW, renderT);

    // Bottom Rebar in Section
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sX + 8, sY + renderT - 10);
    ctx.lineTo(sX + renderSectW - 8, sY + renderT - 10);
    ctx.stroke();

    // Top Rebar at supports in Section
    if (includeTopExtras) {
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sX + 8, sY + 10);
      ctx.lineTo(sX + 45, sY + 10);
      ctx.moveTo(sX + renderSectW - 45, sY + 10);
      ctx.lineTo(sX + renderSectW - 8, sY + 10);
      ctx.stroke();
    }

    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Thickness t = ${t} mm`, sX + (renderSectW / 2), sY + renderT + 18);
    ctx.fillText(`Clear Cover = ${cover} mm`, sX + (renderSectW / 2), sY - 8);

  }, [Lx, Ly, t, cover, mainDia, mainSpacing, distDia, distSpacing, includeTopExtras, width, height]);

  return (
    <div className="bbs-canvas-container">
      <div className="bbs-canvas-badge">2D Slab Reinforcement Plan & Section</div>
      <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />
    </div>
  );
}

