import React, { useRef, useEffect } from 'react';

export default function ColumnSectionCanvas({
  B = 300,
  D = 450,
  cover = 40,
  cornerDia = 20,
  faceXCount = 2,
  faceXDia = 16,
  faceYCount = 0,
  faceYDia = 16,
  tieDia = 8,
  linkConfig = 'DIAMOND',
  width = 380,
  height = 300
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Calculate scale and centering to fit within canvas margins (margin 40px)
    const margin = 45;
    const availW = width - (2 * margin);
    const availH = height - (2 * margin);

    const scale = Math.min(availW / B, availH / D, 0.7);

    const renderW = B * scale;
    const renderH = D * scale;
    const originX = (width - renderW) / 2;
    const originY = (height - renderH) / 2;

    // 1. Concrete Outer Outline
    ctx.fillStyle = '#f1f5f9'; // concrete gray
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(originX, originY, renderW, renderH, 4);
    ctx.fill();
    ctx.stroke();

    // 2. Concrete Hatching / Texture dots
    ctx.fillStyle = '#cbd5e1';
    for (let i = 10; i < renderW; i += 25) {
      for (let j = 10; j < renderH; j += 25) {
        ctx.beginPath();
        ctx.arc(originX + i + ((j % 2) * 5), originY + j, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Clear Cover Line (dashed)
    const renderCover = cover * scale;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(originX + renderCover, originY + renderCover, renderW - (2 * renderCover), renderH - (2 * renderCover));
    ctx.setLineDash([]); // reset

    // 4. Outer Rectangular Stirrup
    const renderTieOffset = (cover + (tieDia / 2)) * scale;
    const tieX = originX + renderTieOffset;
    const tieY = originY + renderTieOffset;
    const tieW = renderW - (2 * renderTieOffset);
    const tieH = renderH - (2 * renderTieOffset);

    ctx.strokeStyle = '#0284c7'; // Blue tie
    ctx.lineWidth = Math.max(2, tieDia * scale * 0.8);
    ctx.beginPath();
    ctx.roundRect(tieX, tieY, tieW, tieH, 6);
    ctx.stroke();

    // 135° Seismic Hooks at top-left corner
    ctx.beginPath();
    ctx.moveTo(tieX, tieY + 15);
    ctx.lineTo(tieX + 16, tieY + 16);
    ctx.moveTo(tieX + 15, tieY);
    ctx.lineTo(tieX + 18, tieY + 18);
    ctx.stroke();

    // Calculate longitudinal bar positions
    // Inside the tie corners:
    const cornerOffset = (cover + tieDia + (cornerDia / 2)) * scale;
    const cLeft = originX + cornerOffset;
    const cRight = originX + renderW - cornerOffset;
    const cTop = originY + cornerOffset;
    const cBottom = originY + renderH - cornerOffset;

    const bars = [];

    // 4 Corner Bars
    bars.push({ x: cLeft, y: cTop, d: cornerDia, role: 'corner' });
    bars.push({ x: cRight, y: cTop, d: cornerDia, role: 'corner' });
    bars.push({ x: cLeft, y: cBottom, d: cornerDia, role: 'corner' });
    bars.push({ x: cRight, y: cBottom, d: cornerDia, role: 'corner' });

    // Face-X Bars (Along vertical depth D faces)
    const faceXNum = Number(faceXCount) || 0;
    if (faceXNum > 0) {
      const stepY = (cBottom - cTop) / (faceXNum + 1);
      for (let i = 1; i <= faceXNum; i++) {
        const curY = cTop + (i * stepY);
        bars.push({ x: cLeft, y: curY, d: faceXDia, role: 'faceX' });
        bars.push({ x: cRight, y: curY, d: faceXDia, role: 'faceX' });
      }
    }

    // Face-Y Bars (Along horizontal width B faces)
    const faceYNum = Number(faceYCount) || 0;
    if (faceYNum > 0) {
      const stepX = (cRight - cLeft) / (faceYNum + 1);
      for (let i = 1; i <= faceYNum; i++) {
        const curX = cLeft + (i * stepX);
        bars.push({ x: curX, y: cTop, d: faceYDia, role: 'faceY' });
        bars.push({ x: curX, y: cBottom, d: faceYDia, role: 'faceY' });
      }
    }

    // 5. Inner Diamond Tie (if selected and intermediate bars exist)
    if (linkConfig === 'DIAMOND' && (faceXNum > 0 || faceYNum > 0)) {
      // Find midpoints of intermediate bars
      const midTopX = (cLeft + cRight) / 2;
      const midBotX = (cLeft + cRight) / 2;
      const midLeftY = (cTop + cBottom) / 2;
      const midRightY = (cTop + cBottom) / 2;

      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = Math.max(1.5, tieDia * scale * 0.7);
      ctx.beginPath();
      ctx.moveTo(midTopX, cTop);
      ctx.lineTo(cRight, midRightY);
      ctx.lineTo(midBotX, cBottom);
      ctx.lineTo(cLeft, midLeftY);
      ctx.closePath();
      ctx.stroke();
    }

    // 6. Draw Longitudinal Bars
    bars.forEach((b) => {
      const r = Math.max(3.5, (b.d * scale) / 2);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);

      if (b.role === 'corner') {
        ctx.fillStyle = '#dc2626'; // Red corner bars
        ctx.strokeStyle = '#991b1b';
      } else if (b.role === 'faceX') {
        ctx.fillStyle = '#ea580c'; // Orange faceX bars
        ctx.strokeStyle = '#9a3412';
      } else {
        ctx.fillStyle = '#16a34a'; // Green faceY bars
        ctx.strokeStyle = '#166534';
      }

      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Shiny center pip
      ctx.beginPath();
      ctx.arc(b.x - (r * 0.3), b.y - (r * 0.3), r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    });

    // 7. Dimension Callouts
    ctx.fillStyle = '#475569';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';

    // Top Width (B) Dimension line
    const dimY = originY - 14;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX, dimY);
    ctx.lineTo(originX + renderW, dimY);
    ctx.moveTo(originX, dimY - 4);
    ctx.lineTo(originX, dimY + 4);
    ctx.moveTo(originX + renderW, dimY - 4);
    ctx.lineTo(originX + renderW, dimY + 4);
    ctx.stroke();
    ctx.fillText(`B = ${B} mm`, originX + (renderW / 2), dimY - 5);

    // Left Depth (D) Dimension line
    const dimX = originX - 14;
    ctx.beginPath();
    ctx.moveTo(dimX, originY);
    ctx.lineTo(dimX, originY + renderH);
    ctx.moveTo(dimX - 4, originY);
    ctx.lineTo(dimX + 4, originY);
    ctx.moveTo(dimX - 4, originY + renderH);
    ctx.lineTo(dimX + 4, originY + renderH);
    ctx.stroke();

    ctx.save();
    ctx.translate(dimX - 8, originY + (renderH / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`D = ${D} mm`, 0, 0);
    ctx.restore();

    // Cover note at bottom
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(`Clear Cover = ${cover} mm | Outer Tie = Ø${tieDia} mm`, width / 2, height - 10);

  }, [B, D, cover, cornerDia, faceXCount, faceXDia, faceYCount, faceYDia, tieDia, linkConfig, width, height]);

  return (
    <div className="bbs-canvas-container">
      <div className="bbs-canvas-badge">2D Cross-Section View</div>
      <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />
    </div>
  );
}

