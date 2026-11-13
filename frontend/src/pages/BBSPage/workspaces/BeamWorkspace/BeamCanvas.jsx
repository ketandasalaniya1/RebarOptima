import React, { useRef, useEffect } from 'react';

export default function BeamCanvas({
  L_clear = 4000,
  b = 250,
  D = 450,
  cover = 25,
  topHangerCount = 2,
  topHangerDia = 12,
  bottomMainCount = 3,
  bottomMainDia = 16,
  stirrupDia = 8,
  supportSpacing = 100,
  midspanSpacing = 150,
  includeSideFaceBars = false,
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

    // Layout: Left 65% for Elevation, Right 35% for Cross-Section
    const elevW = width * 0.65;
    const sectW = width * 0.35;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. ELEVATION VIEW (Left)
    // ──────────────────────────────────────────────────────────────────────────
    const elevMarginX = 35;
    const elevMarginY = 40;
    const availElevW = elevW - (2 * elevMarginX);
    const availElevH = height - (2 * elevMarginY);

    const scaleX = availElevW / (L_clear + 600);
    const scaleY = Math.min(scaleX * 1.5, availElevH / D);

    const renderSpan = L_clear * scaleX;
    const renderD = D * scaleY;
    const colW = 40 * scaleX * 10; // column support width
    const startX = elevMarginX + 30;
    const startY = (height - renderD) / 2;

    // Support Columns (Left & Right)
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;

    ctx.fillRect(startX - 35, startY - 30, 35, renderD + 60);
    ctx.strokeRect(startX - 35, startY - 30, 35, renderD + 60);

    ctx.fillRect(startX + renderSpan, startY - 30, 35, renderD + 60);
    ctx.strokeRect(startX + renderSpan, startY - 30, 35, renderD + 60);

    // Beam Body
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(startX, startY, renderSpan, renderD);
    ctx.strokeRect(startX, startY, renderSpan, renderD);

    // Support zone boundary (2*D)
    const zoneLW = Math.min((2 * D) * scaleX, renderSpan / 3);
    ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
    ctx.fillRect(startX, startY, zoneLW, renderD);
    ctx.fillRect(startX + renderSpan - zoneLW, startY, zoneLW, renderD);

    // Stirrups (vertical blue ticks)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;

    // Left support stirrups
    const sSuppRender = Math.max(5, supportSpacing * scaleX);
    for (let x = startX + 10; x <= startX + zoneLW; x += sSuppRender) {
      ctx.beginPath();
      ctx.moveTo(x, startY + 4);
      ctx.lineTo(x, startY + renderD - 4);
      ctx.stroke();
    }

    // Right support stirrups
    for (let x = startX + renderSpan - 10; x >= startX + renderSpan - zoneLW; x -= sSuppRender) {
      ctx.beginPath();
      ctx.moveTo(x, startY + 4);
      ctx.lineTo(x, startY + renderD - 4);
      ctx.stroke();
    }

    // Midspan stirrups
    const sMidRender = Math.max(8, midspanSpacing * scaleX);
    for (let x = startX + zoneLW + sMidRender; x < startX + renderSpan - zoneLW; x += sMidRender) {
      ctx.beginPath();
      ctx.moveTo(x, startY + 4);
      ctx.lineTo(x, startY + renderD - 4);
      ctx.stroke();
    }

    // Top Hanger Bars (continuous red line)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX - 20, startY + 12);
    ctx.lineTo(startX + renderSpan + 20, startY + 12);
    // 90° hooks into columns
    ctx.lineTo(startX + renderSpan + 20, startY + 12 + 25);
    ctx.moveTo(startX - 20, startY + 12);
    ctx.lineTo(startX - 20, startY + 12 + 25);
    ctx.stroke();

    // Bottom Main Tension Bars (continuous red line)
    ctx.beginPath();
    ctx.moveTo(startX - 20, startY + renderD - 12);
    ctx.lineTo(startX + renderSpan + 20, startY + renderD - 12);
    // 90° hooks up into columns
    ctx.lineTo(startX + renderSpan + 20, startY + renderD - 12 - 25);
    ctx.moveTo(startX - 20, startY + renderD - 12);
    ctx.lineTo(startX - 20, startY + renderD - 12 - 25);
    ctx.stroke();

    // Curtailment extra bars over support (top orange line L/3)
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX - 15, startY + 20);
    ctx.lineTo(startX + (renderSpan / 3), startY + 20);
    ctx.moveTo(startX + renderSpan + 15, startY + 20);
    ctx.lineTo(startX + renderSpan - (renderSpan / 3), startY + 20);
    ctx.stroke();

    // Dimension: Span L_clear
    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Clear Span L = ${L_clear} mm`, startX + (renderSpan / 2), startY + renderD + 18);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. CROSS-SECTION VIEW (Right)
    // ──────────────────────────────────────────────────────────────────────────
    const sectOriginX = elevW + 30;
    const sectAvailW = sectW - 60;
    const sectAvailH = height - 70;
    const scaleSect = Math.min(sectAvailW / b, sectAvailH / D, 0.55);

    const renderB = b * scaleSect;
    const renderSectD = D * scaleSect;
    const sectX = sectOriginX + ((sectAvailW - renderB) / 2);
    const sectY = (height - renderSectD) / 2;

    // Concrete Box
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(sectX, sectY, renderB, renderSectD);
    ctx.strokeRect(sectX, sectY, renderB, renderSectD);

    // Stirrup
    const sectCover = cover * scaleSect;
    const sTieX = sectX + sectCover;
    const sTieY = sectY + sectCover;
    const sTieW = renderB - (2 * sectCover);
    const sTieH = renderSectD - (2 * sectCover);

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.strokeRect(sTieX, sTieY, sTieW, sTieH);

    // Rebar Circles
    // Top Bars
    const topBarR = 4;
    ctx.fillStyle = '#dc2626';
    for (let i = 0; i < topHangerCount; i++) {
      const x = topHangerCount > 1 ? sTieX + 6 + (i * ((sTieW - 12) / (topHangerCount - 1))) : sTieX + (sTieW / 2);
      ctx.beginPath();
      ctx.arc(x, sTieY + 6, topBarR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bottom Bars
    const botBarR = 5;
    for (let i = 0; i < bottomMainCount; i++) {
      const x = bottomMainCount > 1 ? sTieX + 6 + (i * ((sTieW - 12) / (bottomMainCount - 1))) : sTieX + (sTieW / 2);
      ctx.beginPath();
      ctx.arc(x, sTieY + sTieH - 6, botBarR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Side face bars if present
    if (includeSideFaceBars) {
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(sTieX + 6, sTieY + (sTieH / 2), 3.5, 0, Math.PI * 2);
      ctx.arc(sTieX + sTieW - 6, sTieY + (sTieH / 2), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Section Dimensions
    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${b} × ${D} mm`, sectX + (renderB / 2), sectY + renderSectD + 16);
    ctx.fillText(`Cover = ${cover} mm`, sectX + (renderB / 2), sectY - 8);

  }, [L_clear, b, D, cover, topHangerCount, topHangerDia, bottomMainCount, bottomMainDia, stirrupDia, supportSpacing, midspanSpacing, includeSideFaceBars, width, height]);

  return (
    <div className="bbs-canvas-container">
      <div className="bbs-canvas-badge">2D Beam Elevation & Cross-Section View</div>
      <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />
    </div>
  );
}

