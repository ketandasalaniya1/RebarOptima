import React, { useRef, useEffect } from 'react';

export default function RetainingWallCanvas({
  H_stem = 3500,
  t_top = 250,
  t_bot = 400,
  B_base = 2500,
  t_base = 450,
  L_toe = 700,
  L_heel = 1400,
  stemMainDia = 16,
  coverEarth = 45,
  width = 620,
  height = 280
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

    // Calculate bounding box and scale
    const totalW = B_base + 400;
    const totalH = H_stem + t_base + 300;

    const marginX = 40;
    const marginY = 30;
    const availW = width - (2 * marginX);
    const availH = height - (2 * marginY);

    const scale = Math.min(availW / totalW, availH / totalH, 0.55);

    const renderB = B_base * scale;
    const renderTBase = t_base * scale;
    const renderHStem = H_stem * scale;
    const renderTTop = t_top * scale;
    const renderTBot = t_bot * scale;
    const renderToe = L_toe * scale;
    const renderHeel = L_heel * scale;

    const originX = (width - renderB) / 2;
    const baseY = height - marginY - renderTBase;

    // 1. Concrete Retaining Wall Profile (Cross-Section)
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;

    ctx.beginPath();
    // Base bottom: from toe to heel
    ctx.moveTo(originX, baseY + renderTBase);
    ctx.lineTo(originX + renderB, baseY + renderTBase);
    // Heel back vertical face
    ctx.lineTo(originX + renderB, baseY);
    // Heel top horizontal face up to stem back
    ctx.lineTo(originX + renderToe + renderTBot, baseY);
    // Stem back face (inner earth face, vertical or slight slope)
    ctx.lineTo(originX + renderToe + renderTTop, baseY - renderHStem);
    // Stem top horizontal
    ctx.lineTo(originX + renderToe, baseY - renderHStem);
    // Stem front face (tapered) down to toe top
    ctx.lineTo(originX + renderToe, baseY);
    // Toe top horizontal
    ctx.lineTo(originX, baseY);
    // Toe front vertical
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // 2. Soil Hatching behind stem (Heel side)
    ctx.fillStyle = 'rgba(217, 119, 6, 0.08)'; // Amber earth tint
    ctx.beginPath();
    ctx.moveTo(originX + renderToe + renderTBot, baseY);
    ctx.lineTo(originX + renderB, baseY);
    ctx.lineTo(originX + renderB + 30, baseY - renderHStem);
    ctx.lineTo(originX + renderToe + renderTTop, baseY - renderHStem);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b45309';
    ctx.font = '10px sans-serif';
    ctx.fillText('Retained Earth / Backfill', originX + renderB - 40, baseY - (renderHStem / 2));

    // 3. Reinforcement Steel
    // A. Stem Main Tension Steel (Red line along inner earth face + anchored into heel)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;

    const innerCover = coverEarth * scale;
    const stemRebarX = originX + renderToe + renderTBot - innerCover;

    ctx.beginPath();
    // Top of stem hook
    ctx.moveTo(originX + renderToe + renderTTop - innerCover - 15, baseY - renderHStem + 15);
    ctx.lineTo(originX + renderToe + renderTTop - innerCover, baseY - renderHStem + 15);
    // Down inner stem face
    ctx.lineTo(stemRebarX, baseY + renderTBase - 15);
    // Horizontal bend leg anchored into heel base
    ctx.lineTo(originX + renderB - 15, baseY + renderTBase - 15);
    // 90° upturned end hook
    ctx.lineTo(originX + renderB - 15, baseY + renderTBase - 35);
    ctx.stroke();

    // B. Heel Top Tension Steel (Orange line along heel top)
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX + renderToe + 20, baseY + 12);
    ctx.lineTo(originX + renderB - 15, baseY + 12);
    ctx.lineTo(originX + renderB - 15, baseY + renderTBase - 25);
    ctx.stroke();

    // C. Toe Bottom Steel (Blue line along toe bottom)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX + 12, baseY + 15);
    ctx.lineTo(originX + 12, baseY + renderTBase - 12);
    ctx.lineTo(originX + renderToe + renderTBot - 20, baseY + renderTBase - 12);
    ctx.stroke();

    // D. Outer Face Nominal Vertical Steel (Green line)
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(originX + renderToe + 10, baseY - renderHStem + 15);
    ctx.lineTo(originX + renderToe + 10, baseY + 20);
    ctx.stroke();

    // E. Horizontal Distribution Bars (Small dots along stem)
    ctx.fillStyle = '#0f172a';
    for (let y = baseY - 20; y >= baseY - renderHStem + 20; y -= 24) {
      // Inner face dot
      ctx.beginPath();
      ctx.arc(stemRebarX - 4, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Outer face dot
      ctx.beginPath();
      ctx.arc(originX + renderToe + 15, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Dimension Annotations
    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    // Base Width
    ctx.fillText(`Base Slab Width B_base = ${B_base} mm`, originX + (renderB / 2), baseY + renderTBase + 18);

    // Stem Height (Left vertical)
    ctx.save();
    ctx.translate(originX + renderToe - 15, baseY - (renderHStem / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Stem Height H = ${H_stem} mm`, 0, 0);
    ctx.restore();

    // Base Thickness
    ctx.fillText(`t_base = ${t_base}mm`, originX - 25, baseY + (renderTBase / 2) + 4);

  }, [H_stem, t_top, t_bot, B_base, t_base, L_toe, L_heel, stemMainDia, coverEarth, width, height]);

  return (
    <div className="bbs-canvas-container">
      <div className="bbs-canvas-badge">2D Retaining Wall Cross-Section</div>
      <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />
    </div>
  );
}

