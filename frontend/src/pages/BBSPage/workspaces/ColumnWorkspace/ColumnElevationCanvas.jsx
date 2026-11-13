import React, { useRef, useEffect } from 'react';

export default function ColumnElevationCanvas({
  H_clear = 3000,
  D_beam = 450,
  Lo = 500,
  confinementSpacing = 100,
  middleSpacing = 150,
  boundaryCondition = 'INTERMEDIATE',
  lapLength = 1000,
  staggerLaps = false,
  staggerOffsetMm = 750,
  width = 240,
  height = 300
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

    // Clear
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const totalPhysicalH = H_clear + D_beam + (boundaryCondition === 'INTERMEDIATE' ? lapLength : 300);
    const marginY = 30;
    const availH = height - (2 * marginY);
    const scale = availH / totalPhysicalH;

    const colW = 50;
    const colX = (width - colW) / 2;

    // Floor lines
    const beamRenderH = D_beam * scale;
    const clearRenderH = H_clear * scale;
    const lapRenderH = (boundaryCondition === 'INTERMEDIATE' ? lapLength : 250) * scale;

    const topLapY = marginY;
    const slabTopY = topLapY + lapRenderH;
    const beamBotY = slabTopY + beamRenderH;
    const floorSlabY = beamBotY + clearRenderH;

    // 1. Column Concrete Body
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(colX, slabTopY, colW, beamRenderH + clearRenderH);
    ctx.strokeRect(colX, slabTopY, colW, beamRenderH + clearRenderH);

    // 2. Floor Beam and Slabs
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(10, slabTopY, width - 20, beamRenderH); // upper beam
    ctx.strokeRect(10, slabTopY, width - 20, beamRenderH);

    ctx.fillRect(10, floorSlabY, width - 20, 20); // bottom floor slab
    ctx.strokeRect(10, floorSlabY, width - 20, 20);

    // 3. Confinement Zones
    const loRenderH = Lo * scale;
    const lowerConfY = floorSlabY - loRenderH;
    const upperConfY = beamBotY + loRenderH;

    // Shade Confinement Zones
    ctx.fillStyle = 'rgba(2, 132, 199, 0.08)'; // Light blue
    ctx.fillRect(colX, floorSlabY - loRenderH, colW, loRenderH); // Lower zone
    ctx.fillRect(colX, beamBotY, colW, loRenderH); // Upper zone

    // 4. Draw Ties
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;

    // Lower confinement ties
    const sConfRender = Math.max(4, confinementSpacing * scale);
    for (let y = floorSlabY - (50 * scale); y >= lowerConfY; y -= sConfRender) {
      ctx.beginPath();
      ctx.moveTo(colX + 3, y);
      ctx.lineTo(colX + colW - 3, y);
      ctx.stroke();
    }

    // Upper confinement ties
    for (let y = beamBotY + (50 * scale); y <= upperConfY; y += sConfRender) {
      ctx.beginPath();
      ctx.moveTo(colX + 3, y);
      ctx.lineTo(colX + colW - 3, y);
      ctx.stroke();
    }

    // Middle zone ties (wider spacing)
    const sMidRender = Math.max(7, middleSpacing * scale);
    for (let y = lowerConfY - sMidRender; y > upperConfY; y -= sMidRender) {
      ctx.beginPath();
      ctx.moveTo(colX + 3, y);
      ctx.lineTo(colX + colW - 3, y);
      ctx.stroke();
    }

    // 5. Draw Longitudinal Rebar (Vertical Red lines)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;

    // Stagger offset in render scale
    const renderStagger = (staggerLaps && boundaryCondition === 'INTERMEDIATE') ? (staggerOffsetMm * scale) : 0;

    // Left bar line (Standard height or staggered lower)
    const leftTopY = topLapY + renderStagger;
    ctx.beginPath();
    ctx.moveTo(colX + 8, leftTopY);
    ctx.lineTo(colX + 8, floorSlabY + 15);
    ctx.stroke();

    // Right bar line (Higher staggered level or standard)
    const rightTopY = topLapY;
    ctx.beginPath();
    ctx.moveTo(colX + colW - 8, rightTopY);
    ctx.lineTo(colX + colW - 8, floorSlabY + 15);
    ctx.stroke();

    if (staggerLaps && boundaryCondition === 'INTERMEDIATE') {
      ctx.fillStyle = '#dc2626';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('50% Stagger', colX + (colW / 2), topLapY - 8);
    }

    if (boundaryCondition === 'STARTER') {
      // 90° Footing bend hook
      ctx.beginPath();
      ctx.moveTo(colX + 8, floorSlabY + 15);
      ctx.lineTo(colX + 8 + 20, floorSlabY + 15);
      ctx.moveTo(colX + colW - 8, floorSlabY + 15);
      ctx.lineTo(colX + colW - 8 - 20, floorSlabY + 15);
      ctx.stroke();
    }

    // 6. Zone Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';

    ctx.fillText(`Lap: ${lapLength}mm`, colX - 6, topLapY + 12);
    ctx.fillText(`Beam: ${D_beam}mm`, colX - 6, slabTopY + (beamRenderH / 2) + 3);
    ctx.fillText(`L_o: ${Lo}mm`, colX - 6, beamBotY + (loRenderH / 2) + 3);
    ctx.fillText(`Clear H: ${H_clear}mm`, colX - 6, beamBotY + (clearRenderH / 2) + 3);
    ctx.fillText(`L_o: ${Lo}mm`, colX - 6, floorSlabY - (loRenderH / 2) + 3);

  }, [H_clear, D_beam, Lo, confinementSpacing, middleSpacing, boundaryCondition, lapLength, width, height]);

  return (
    <div className="bbs-canvas-container">
      <div className="bbs-canvas-badge">2D Elevation & Zones</div>
      <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />
    </div>
  );
}

