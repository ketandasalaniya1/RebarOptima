import React, { useRef, useEffect } from 'react';

export default function FootingCanvas({
  L = 2000,
  B = 2000,
  D = 500,
  cover = 50,
  pL = 400,
  pB = 400,
  meshXDia = 12,
  meshXSpacing = 150,
  meshYDia = 12,
  meshYSpacing = 150,
  includeStarterDowels = true,
  dowelCount = 8,
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

    const planW = width * 0.65;
    const sectW = width * 0.35;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. PLAN VIEW (Left)
    // ──────────────────────────────────────────────────────────────────────────
    const margin = 35;
    const availPlanW = planW - (2 * margin);
    const availPlanH = height - (2 * margin);

    const scale = Math.min(availPlanW / L, availPlanH / B, 0.45);
    const renderL = L * scale;
    const renderB = B * scale;

    const planX = margin + ((availPlanW - renderL) / 2);
    const planY = margin + ((availPlanH - renderB) / 2);

    // Footing Pad
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(planX, planY, renderL, renderB);
    ctx.strokeRect(planX, planY, renderL, renderB);

    // Cover Boundary
    const renderCover = cover * scale;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(planX + renderCover, planY + renderCover, renderL - (2 * renderCover), renderB - (2 * renderCover));
    ctx.setLineDash([]);

    // Mesh X (lines along L)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;
    const sX = Math.max(10, meshXSpacing * scale * 2);
    for (let y = planY + renderCover + 10; y <= planY + renderB - renderCover - 10; y += sX) {
      ctx.beginPath();
      ctx.moveTo(planX + renderCover, y);
      ctx.lineTo(planX + renderL - renderCover, y);
      ctx.stroke();
    }

    // Mesh Y (lines along B)
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.2;
    const sY = Math.max(10, meshYSpacing * scale * 2);
    for (let x = planX + renderCover + 10; x <= planX + renderL - renderCover - 10; x += sY) {
      ctx.beginPath();
      ctx.moveTo(x, planY + renderCover);
      ctx.lineTo(x, planY + renderB - renderCover);
      ctx.stroke();
    }

    // Centered Pedestal
    const pedL = pL * scale;
    const pedB = pB * scale;
    const pedX = planX + ((renderL - pedL) / 2);
    const pedY = planY + ((renderB - pedB) / 2);

    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.fillRect(pedX, pedY, pedL, pedB);
    ctx.strokeRect(pedX, pedY, pedL, pedB);

    // Starter Dowel Dots
    if (includeStarterDowels) {
      ctx.fillStyle = '#dc2626';
      const corners = [
        [pedX + 6, pedY + 6],
        [pedX + pedL - 6, pedY + 6],
        [pedX + 6, pedY + pedB - 6],
        [pedX + pedL - 6, pedY + pedB - 6]
      ];
      corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Plan Dimensions
    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Length L = ${L} mm`, planX + (renderL / 2), planY - 10);

    ctx.save();
    ctx.translate(planX - 12, planY + (renderB / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Width B = ${B} mm`, 0, 0);
    ctx.restore();

    // ──────────────────────────────────────────────────────────────────────────
    // 2. DEPTH SECTION (Right)
    // ──────────────────────────────────────────────────────────────────────────
    const sectOriginX = planW + 20;
    const sectAvailW = sectW - 40;
    const sectAvailH = height - 80;

    const scaleSect = Math.min(sectAvailW / 500, sectAvailH / (D * 1.5), 0.5);
    const renderPadW = 200 * scaleSect * 1.5;
    const renderD = D * scaleSect * 1.5;

    const padOriginX = sectOriginX + ((sectAvailW - renderPadW) / 2);
    const padOriginY = (height - renderD) / 2;

    // Footing Pad Section
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(padOriginX, padOriginY, renderPadW, renderD);
    ctx.strokeRect(padOriginX, padOriginY, renderPadW, renderD);

    // Pedestal on top
    const renderPedH = 35;
    const renderPedW = renderPadW * 0.45;
    const pX = padOriginX + ((renderPadW - renderPedW) / 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(pX, padOriginY - renderPedH, renderPedW, renderPedH);
    ctx.strokeRect(pX, padOriginY - renderPedH, renderPedW, renderPedH);

    // Bottom Mesh with Upturned Hooks
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(padOriginX + 8, padOriginY + 12);
    ctx.lineTo(padOriginX + 8, padOriginY + renderD - 12);
    ctx.lineTo(padOriginX + renderPadW - 8, padOriginY + renderD - 12);
    ctx.lineTo(padOriginX + renderPadW - 8, padOriginY + 12);
    ctx.stroke();

    // Starter Dowels
    if (includeStarterDowels) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      // Left dowel
      ctx.beginPath();
      ctx.moveTo(pX + 6, padOriginY - renderPedH - 25);
      ctx.lineTo(pX + 6, padOriginY + renderD - 16);
      ctx.lineTo(pX + 6 + 25, padOriginY + renderD - 16); // 90° footing bend
      ctx.stroke();

      // Right dowel
      ctx.beginPath();
      ctx.moveTo(pX + renderPedW - 6, padOriginY - renderPedH - 25);
      ctx.lineTo(pX + renderPedW - 6, padOriginY + renderD - 16);
      ctx.lineTo(pX + renderPedW - 6 - 25, padOriginY + renderD - 16);
      ctx.stroke();
    }

    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Depth D = ${D} mm`, padOriginX + (renderPadW / 2), padOriginY + renderD + 18);
    ctx.fillText(`Cover = ${cover} mm`, padOriginX + (renderPadW / 2), padOriginY - renderPedH - 8);

  }, [L, B, D, cover, pL, pB, meshXDia, meshXSpacing, meshYDia, meshYSpacing, includeStarterDowels, dowelCount, width, height]);

  return (
    <div className="bbs-canvas-container">
      <div className="bbs-canvas-badge">2D Footing Plan & Section</div>
      <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />
    </div>
  );
}
