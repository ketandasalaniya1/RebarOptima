import { worldToScreen } from './viewport';
import { DIMENSION_TYPES, DEFAULT_DIMENSION_STYLE } from './types';
import { distanceToSegment } from './geometry';

/**
 * RebarOptima Engineering Dimension Engine (Phase 2C)
 * Standard CAD Associative Dimensions (Linear, Aligned, Radius, Diameter, Angular)
 */

export function generateDimId(prefix = 'dim') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// DIMENSION FACTORIES
// ══════════════════════════════════════════════════════════════════════════════

export function createLinearDimension(p1, p2, offset = 25, options = {}) {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return {
    id: options.id || generateDimId('dim_lin'),
    type: DIMENSION_TYPES.LINEAR,
    p1: { x: Number(p1.x), y: Number(p1.y) },
    p2: { x: Number(p2.x), y: Number(p2.y) },
    offset: Number(offset),
    value: Number(dist.toFixed(1)),
    unit: 'mm',
    targetObjectId: options.targetObjectId || null,
    property: options.property || 'length',
    parameterId: options.parameterId || null,
    customLabel: options.customLabel || null,
    style: { ...DEFAULT_DIMENSION_STYLE, ...options.style }
  };
}

export function createRadiusDimension(center, radius, angleRad = Math.PI / 4, options = {}) {
  const edgePt = {
    x: center.x + Math.cos(angleRad) * radius,
    y: center.y + Math.sin(angleRad) * radius
  };
  return {
    id: options.id || generateDimId('dim_rad'),
    type: DIMENSION_TYPES.RADIUS,
    center: { x: Number(center.x), y: Number(center.y) },
    edgePt,
    radius: Number(radius),
    value: Number(radius.toFixed(1)),
    unit: 'mm',
    targetObjectId: options.targetObjectId || null,
    property: 'radius',
    parameterId: options.parameterId || null,
    style: { ...DEFAULT_DIMENSION_STYLE, ...options.style }
  };
}

export function createDiameterDimension(center, radius, angleRad = Math.PI / 4, options = {}) {
  return {
    id: options.id || generateDimId('dim_dia'),
    type: DIMENSION_TYPES.DIAMETER,
    center: { x: Number(center.x), y: Number(center.y) },
    radius: Number(radius),
    value: Number((radius * 2).toFixed(1)),
    unit: 'mm',
    targetObjectId: options.targetObjectId || null,
    property: 'diameter',
    parameterId: options.parameterId || null,
    style: { ...DEFAULT_DIMENSION_STYLE, ...options.style }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ASSOCIATIVE VALUE RECALCULATION
// ══════════════════════════════════════════════════════════════════════════════

export function updateDimensionFromGeometry(dim, objects, parameters = []) {
  const clone = JSON.parse(JSON.stringify(dim));

  // 1. If linked to an object, update measurement endpoints directly from the object
  if (clone.targetObjectId) {
    const targetObj = objects.find(o => o.id === clone.targetObjectId);
    if (targetObj) {
      if (targetObj.type === 'rectangle') {
        if (clone.property === 'width') {
          clone.p1 = { x: targetObj.x, y: targetObj.y + targetObj.height };
          clone.p2 = { x: targetObj.x + targetObj.width, y: targetObj.y + targetObj.height };
          clone.value = Number(targetObj.width.toFixed(1));
        } else if (clone.property === 'height') {
          clone.p1 = { x: targetObj.x + targetObj.width, y: targetObj.y };
          clone.p2 = { x: targetObj.x + targetObj.width, y: targetObj.y + targetObj.height };
          clone.value = Number(targetObj.height.toFixed(1));
        }
      } else if (targetObj.type === 'line') {
        const p1 = targetObj.p1 || { x: targetObj.x1, y: targetObj.y1 };
        const p2 = targetObj.p2 || { x: targetObj.x2, y: targetObj.y2 };
        clone.p1 = { ...p1 };
        clone.p2 = { ...p2 };
        clone.value = Number(Math.hypot(p2.x - p1.x, p2.y - p1.y).toFixed(1));
      } else if (targetObj.type === 'circle') {
        const c = targetObj.center || { x: targetObj.cx || 0, y: targetObj.cy || 0 };
        clone.center = { ...c };
        clone.radius = targetObj.radius;
        clone.value = clone.type === DIMENSION_TYPES.DIAMETER
          ? Number((targetObj.radius * 2).toFixed(1))
          : Number(targetObj.radius.toFixed(1));
      }
    }
  } else if (clone.p1 && clone.p2) {
    clone.value = Number(Math.hypot(clone.p2.x - clone.p1.x, clone.p2.y - clone.p1.y).toFixed(1));
  }

  // 2. If associated with a parameter, retrieve parameter name
  if (clone.parameterId) {
    const param = parameters.find(p => p.id === clone.parameterId);
    if (param) {
      clone.parameterName = param.name;
    }
  }

  return clone;
}

export function cleanOrphanedDimensions(dimensions = [], objects = []) {
  const objectIds = new Set(objects.map(o => o.id));
  return dimensions.filter(dim => {
    if (!dim.targetObjectId) return true; // Standalone dimension stays
    return objectIds.has(dim.targetObjectId);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// HIT-TESTING FOR SELECTION & DOUBLE CLICK
// ══════════════════════════════════════════════════════════════════════════════

export function hitTestDimension(dim, worldPt, zoom = 1.0) {
  if (!dim || !worldPt) return false;
  const tolerance = 14 / Math.max(0.1, zoom);

  if (dim.type === DIMENSION_TYPES.LINEAR || dim.type === DIMENSION_TYPES.ALIGNED) {
    const { p1, p2, offset } = dim;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return false;

    // Normal vector
    const nx = -dy / len;
    const ny = dx / len;

    // Dimension line points
    const d1 = { x: p1.x + nx * offset, y: p1.y + ny * offset };
    const d2 = { x: p2.x + nx * offset, y: p2.y + ny * offset };

    return distanceToSegment(worldPt.x, worldPt.y, d1.x, d1.y, d2.x, d2.y) <= tolerance;
  } else if (dim.type === DIMENSION_TYPES.RADIUS || dim.type === DIMENSION_TYPES.DIAMETER) {
    const center = dim.center || { x: 0, y: 0 };
    const dist = Math.hypot(worldPt.x - center.x, worldPt.y - center.y);
    return Math.abs(dist - dim.radius) <= tolerance;
  }

  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2D CANVAS RENDERING
// ══════════════════════════════════════════════════════════════════════════════

export function renderDimension(ctx, dim, viewport, isSelected = false) {
  if (!dim || !ctx) return;

  const style = dim.style || DEFAULT_DIMENSION_STYLE;
  const strokeColor = isSelected ? '#22c55e' : (style.color || '#f59e0b');
  const textColor = isSelected ? '#22c55e' : (style.textColor || '#fbbf24');

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = strokeColor;
  ctx.lineWidth = isSelected ? 2 : 1.5;

  if (isSelected) {
    ctx.shadowColor = 'rgba(34, 197, 94, 0.4)';
    ctx.shadowBlur = 6;
  }

  if (dim.type === DIMENSION_TYPES.LINEAR || dim.type === DIMENSION_TYPES.ALIGNED) {
    const { p1, p2, offset } = dim;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) { ctx.restore(); return; }

    const nx = -dy / len;
    const ny = dx / len;

    // Dimension Line endpoints
    const dim1 = { x: p1.x + nx * offset, y: p1.y + ny * offset };
    const dim2 = { x: p2.x + nx * offset, y: p2.y + ny * offset };

    // Extension Witness Lines
    const ext1_start = { x: p1.x + nx * 4, y: p1.y + ny * 4 };
    const ext1_end = { x: p1.x + nx * (offset + 5), y: p1.y + ny * (offset + 5) };
    const ext2_start = { x: p2.x + nx * 4, y: p2.y + ny * 4 };
    const ext2_end = { x: p2.x + nx * (offset + 5), y: p2.y + ny * (offset + 5) };

    const sExt1_start = worldToScreen(ext1_start.x, ext1_start.y, viewport);
    const sExt1_end = worldToScreen(ext1_end.x, ext1_end.y, viewport);
    const sExt2_start = worldToScreen(ext2_start.x, ext2_start.y, viewport);
    const sExt2_end = worldToScreen(ext2_end.x, ext2_end.y, viewport);

    const sDim1 = worldToScreen(dim1.x, dim1.y, viewport);
    const sDim2 = worldToScreen(dim2.x, dim2.y, viewport);

    // Draw Extension Lines
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(sExt1_start.x, sExt1_start.y);
    ctx.lineTo(sExt1_end.x, sExt1_end.y);
    ctx.moveTo(sExt2_start.x, sExt2_start.y);
    ctx.lineTo(sExt2_end.x, sExt2_end.y);
    ctx.stroke();

    // Draw Dimension Line
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(sDim1.x, sDim1.y);
    ctx.lineTo(sDim2.x, sDim2.y);
    ctx.stroke();

    // Draw CAD Arrowheads / Ticks
    drawCADTick(ctx, sDim1.x, sDim1.y, sDim2.x, sDim2.y);
    drawCADTick(ctx, sDim2.x, sDim2.y, sDim1.x, sDim1.y);

    // Dimension Label Text
    const midX = (sDim1.x + sDim2.x) / 2;
    const midY = (sDim1.y + sDim2.y) / 2;
    let labelText = `${dim.value.toFixed(1)} mm`;
    if (dim.parameterName) {
      labelText = `${dim.parameterName} = ${dim.value.toFixed(1)} mm`;
    }

    drawDimensionBadge(ctx, labelText, midX, midY, textColor, strokeColor);
  } else if (dim.type === DIMENSION_TYPES.RADIUS) {
    const center = dim.center || { x: 0, y: 0 };
    const sCenter = worldToScreen(center.x, center.y, viewport);
    const edge = dim.edgePt || { x: center.x + dim.radius, y: center.y };
    const sEdge = worldToScreen(edge.x, edge.y, viewport);

    // Leader Line
    ctx.beginPath();
    ctx.moveTo(sCenter.x, sCenter.y);
    ctx.lineTo(sEdge.x, sEdge.y);
    ctx.stroke();

    drawCADTick(ctx, sEdge.x, sEdge.y, sCenter.x, sCenter.y);

    let labelText = `R ${dim.value.toFixed(1)} mm`;
    if (dim.parameterName) {
      labelText = `${dim.parameterName} = R ${dim.value.toFixed(1)}`;
    }
    drawDimensionBadge(ctx, labelText, (sCenter.x + sEdge.x) / 2, (sCenter.y + sEdge.y) / 2 - 12, textColor, strokeColor);
  } else if (dim.type === DIMENSION_TYPES.DIAMETER) {
    const center = dim.center || { x: 0, y: 0 };
    const sCenter = worldToScreen(center.x, center.y, viewport);
    const rScreen = dim.radius * viewport.zoom;

    ctx.beginPath();
    ctx.moveTo(sCenter.x - rScreen, sCenter.y);
    ctx.lineTo(sCenter.x + rScreen, sCenter.y);
    ctx.stroke();

    drawCADTick(ctx, sCenter.x - rScreen, sCenter.y, sCenter.x + rScreen, sCenter.y);
    drawCADTick(ctx, sCenter.x + rScreen, sCenter.y, sCenter.x - rScreen, sCenter.y);

    let labelText = `Ø ${dim.value.toFixed(1)} mm`;
    if (dim.parameterName) {
      labelText = `${dim.parameterName} = Ø ${dim.value.toFixed(1)}`;
    }
    drawDimensionBadge(ctx, labelText, sCenter.x, sCenter.y - 12, textColor, strokeColor);
  }

  ctx.restore();
}

function drawCADTick(ctx, x, y, targetX, targetY) {
  const angle = Math.atan2(targetY - y, targetX - x);
  const arrowLen = 7;
  const arrowAngle = Math.PI / 6;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle + arrowAngle) * arrowLen, y + Math.sin(angle + arrowAngle) * arrowLen);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle - arrowAngle) * arrowLen, y + Math.sin(angle - arrowAngle) * arrowLen);
  ctx.stroke();
  ctx.restore();
}

function drawDimensionBadge(ctx, text, x, y, textColor, borderColor) {
  ctx.save();
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  const textWidth = ctx.measureText(text).width;
  const paddingX = 7;
  const paddingY = 4;
  const badgeW = textWidth + paddingX * 2;
  const badgeH = 18;

  // Background pill
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - badgeW / 2, y - badgeH / 2, badgeW, badgeH, 4);
  ctx.fill();
  ctx.stroke();

  // Text
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}
