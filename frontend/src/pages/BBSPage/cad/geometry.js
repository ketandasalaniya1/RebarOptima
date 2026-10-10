import { worldToScreen } from './viewport';
import { renderRebarObject, hitTestRebar } from './rebarEngine';

/**
 * RebarOptima 2D Geometry Engine
 * Unified Factories, Hit-Testing, and Canvas Rendering for CAD Primitives
 */

export function generateId(prefix = 'obj') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

export function createLineObject(arg1, arg2, arg3, arg4) {
  let p1, p2;
  if (typeof arg1 === 'object' && typeof arg2 === 'object') {
    p1 = { x: Number(arg1.x), y: Number(arg1.y) };
    p2 = { x: Number(arg2.x), y: Number(arg2.y) };
  } else {
    p1 = { x: Number(arg1), y: Number(arg2) };
    p2 = { x: Number(arg3), y: Number(arg4) };
  }

  return {
    id: generateId('line'),
    type: 'line',
    p1,
    p2,
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    color: '#38bdf8',
    lineWidth: 2.5
  };
}

export function createPolylineObject(points, isClosed = false) {
  const normPoints = (points || []).map(p => ({ x: Number(p.x), y: Number(p.y) }));
  return {
    id: generateId('poly'),
    type: 'polyline',
    points: normPoints,
    isClosed,
    color: '#38bdf8',
    lineWidth: 2.5
  };
}

export function createRectangleObject(arg1, arg2, arg3, arg4) {
  let x, y, width, height;
  if (typeof arg1 === 'object' && typeof arg2 === 'object') {
    x = Math.min(arg1.x, arg2.x);
    y = Math.min(arg1.y, arg2.y);
    width = Math.abs(arg2.x - arg1.x);
    height = Math.abs(arg2.y - arg1.y);
  } else {
    x = Number(arg1);
    y = Number(arg2);
    width = Number(arg3);
    height = Number(arg4);
  }

  return {
    id: generateId('rect'),
    type: 'rectangle',
    x,
    y,
    width,
    height,
    color: '#38bdf8',
    lineWidth: 2.5
  };
}

export function createCircleObject(centerOrCx, radiusOrCy, maybeRadius) {
  let center, radius;
  if (typeof centerOrCx === 'object') {
    center = { x: Number(centerOrCx.x), y: Number(centerOrCx.y) };
    radius = Number(radiusOrCy);
  } else {
    center = { x: Number(centerOrCx), y: Number(radiusOrCy) };
    radius = Number(maybeRadius);
  }

  return {
    id: generateId('circle'),
    type: 'circle',
    center,
    radius,
    cx: center.x,
    cy: center.y,
    color: '#38bdf8',
    lineWidth: 2.5
  };
}

export function createArcObject(p1, p2, p3) {
  // 3-point arc definition (Start, Mid/Bulge, End)
  return {
    id: generateId('arc'),
    type: 'arc',
    start: { x: Number(p1.x), y: Number(p1.y) },
    mid: { x: Number(p2.x), y: Number(p2.y) },
    end: { x: Number(p3.x), y: Number(p3.y) },
    color: '#38bdf8',
    lineWidth: 2.5
  };
}

export function createDimensionObject(arg1, arg2, arg3) {
  let p1, p2, offset;
  if (typeof arg1 === 'object' && typeof arg2 === 'object') {
    p1 = { x: Number(arg1.x), y: Number(arg1.y) };
    p2 = { x: Number(arg2.x), y: Number(arg2.y) };
    offset = Number(arg3 || 20);
  } else {
    p1 = { x: Number(arg1), y: Number(arg2) };
    p2 = { x: Number(arg3), y: Number(arguments[3]) };
    offset = Number(arguments[4] || 20);
  }

  return {
    id: generateId('dim'),
    type: 'dimension',
    p1,
    p2,
    offset,
    color: '#f59e0b',
    lineWidth: 1.5
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// HIT-TESTING MATH
// ══════════════════════════════════════════════════════════════════════════════

export function distanceToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return Math.hypot(px - projX, py - projY);
}

export function hitTest(obj, rawWorld, zoom = 1.0) {
  if (!obj || !rawWorld) return false;
  const toleranceMm = 14 / Math.max(0.1, zoom);
  const wx = rawWorld.x;
  const wy = rawWorld.y;

  switch (obj.type) {
    case 'line': {
      const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
      const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
      return distanceToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y) <= toleranceMm;
    }

    case 'rectangle': {
      const x1 = obj.x;
      const x2 = obj.x + obj.width;
      const y1 = obj.y;
      const y2 = obj.y + obj.height;
      const d1 = distanceToSegment(wx, wy, x1, y1, x2, y1);
      const d2 = distanceToSegment(wx, wy, x2, y1, x2, y2);
      const d3 = distanceToSegment(wx, wy, x2, y2, x1, y2);
      const d4 = distanceToSegment(wx, wy, x1, y2, x1, y1);
      return Math.min(d1, d2, d3, d4) <= toleranceMm;
    }

    case 'circle': {
      const c = obj.center || { x: obj.cx || 0, y: obj.cy || 0 };
      const dist = Math.hypot(wx - c.x, wy - c.y);
      return Math.abs(dist - obj.radius) <= toleranceMm;
    }

    case 'arc': {
      const start = obj.start || { x: 0, y: 0 };
      const end = obj.end || { x: 0, y: 0 };
      const mid = obj.mid || { x: 0, y: 0 };
      const d1 = distanceToSegment(wx, wy, start.x, start.y, mid.x, mid.y);
      const d2 = distanceToSegment(wx, wy, mid.x, mid.y, end.x, end.y);
      return Math.min(d1, d2) <= toleranceMm * 1.5;
    }

    case 'polyline': {
      if (!obj.points || obj.points.length < 2) return false;
      for (let i = 0; i < obj.points.length - 1; i++) {
        const p1 = obj.points[i];
        const p2 = obj.points[i + 1];
        if (distanceToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y) <= toleranceMm) {
          return true;
        }
      }
      return false;
    }

    case 'dimension': {
      const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
      const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
      return distanceToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y) <= toleranceMm * 1.5;
    }

    case 'rebar':
      return hitTestRebar(obj, wx, wy, toleranceMm);

    default:
      return false;
  }
}

export const hitTestObject = hitTest;

// ══════════════════════════════════════════════════════════════════════════════
// CANVAS RENDERING
// ══════════════════════════════════════════════════════════════════════════════

export function renderObject(ctx, obj, viewport, isSelected = false) {
  if (!obj || !ctx) return;

  const highlightColor = '#22c55e'; // green glow when selected
  const strokeColor = isSelected ? highlightColor : (obj.color || '#38bdf8');
  const strokeWidth = (obj.lineWidth || 2.5) * (isSelected ? 1.3 : 1.0);

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (isSelected) {
    ctx.shadowColor = 'rgba(34, 197, 94, 0.4)';
    ctx.shadowBlur = 6;
  }

  switch (obj.type) {
    case 'line': {
      const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
      const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
      const s1 = worldToScreen(p1.x, p1.y, viewport);
      const s2 = worldToScreen(p2.x, p2.y, viewport);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();

      if (isSelected) {
        renderGripHandle(ctx, s1.x, s1.y);
        renderGripHandle(ctx, s2.x, s2.y);
      }
      break;
    }

    case 'polyline': {
      if (obj.points && obj.points.length > 0) {
        ctx.beginPath();
        const first = worldToScreen(obj.points[0].x, obj.points[0].y, viewport);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < obj.points.length; i++) {
          const pt = worldToScreen(obj.points[i].x, obj.points[i].y, viewport);
          ctx.lineTo(pt.x, pt.y);
        }
        if (obj.isClosed) ctx.closePath();
        ctx.stroke();

        if (isSelected) {
          obj.points.forEach(pt => {
            const s = worldToScreen(pt.x, pt.y, viewport);
            renderGripHandle(ctx, s.x, s.y);
          });
        }
      }
      break;
    }

    case 'rectangle': {
      const sTopLeft = worldToScreen(obj.x, obj.y + obj.height, viewport);
      const screenW = obj.width * viewport.zoom;
      const screenH = obj.height * viewport.zoom;

      ctx.strokeRect(sTopLeft.x, sTopLeft.y, screenW, screenH);

      if (isSelected) {
        renderGripHandle(ctx, sTopLeft.x, sTopLeft.y);
        renderGripHandle(ctx, sTopLeft.x + screenW, sTopLeft.y);
        renderGripHandle(ctx, sTopLeft.x + screenW, sTopLeft.y + screenH);
        renderGripHandle(ctx, sTopLeft.x, sTopLeft.y + screenH);
      }
      break;
    }

    case 'circle': {
      const c = obj.center || { x: obj.cx || 0, y: obj.cy || 0 };
      const sCenter = worldToScreen(c.x, c.y, viewport);
      const sRadius = obj.radius * viewport.zoom;

      ctx.beginPath();
      ctx.arc(sCenter.x, sCenter.y, Math.max(1, sRadius), 0, Math.PI * 2);
      ctx.stroke();

      if (isSelected) {
        renderGripHandle(ctx, sCenter.x, sCenter.y);
        renderGripHandle(ctx, sCenter.x + sRadius, sCenter.y);
      }
      break;
    }

    case 'arc': {
      const start = obj.start || { x: 0, y: 0 };
      const mid = obj.mid || { x: 0, y: 0 };
      const end = obj.end || { x: 0, y: 0 };

      const sStart = worldToScreen(start.x, start.y, viewport);
      const sMid = worldToScreen(mid.x, mid.y, viewport);
      const sEnd = worldToScreen(end.x, end.y, viewport);

      ctx.beginPath();
      ctx.moveTo(sStart.x, sStart.y);
      ctx.quadraticCurveTo(sMid.x, sMid.y, sEnd.x, sEnd.y);
      ctx.stroke();

      if (isSelected) {
        renderGripHandle(ctx, sStart.x, sStart.y);
        renderGripHandle(ctx, sMid.x, sMid.y);
        renderGripHandle(ctx, sEnd.x, sEnd.y);
      }
      break;
    }

    case 'dimension': {
      const p1 = obj.p1 || { x: 0, y: 0 };
      const p2 = obj.p2 || { x: 100, y: 0 };
      const s1 = worldToScreen(p1.x, p1.y, viewport);
      const s2 = worldToScreen(p2.x, p2.y, viewport);

      ctx.save();
      ctx.strokeStyle = isSelected ? highlightColor : '#f59e0b';
      ctx.fillStyle = isSelected ? highlightColor : '#f59e0b';
      ctx.lineWidth = 1.5;

      // Dimension line
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();

      // Dimension text
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const midX = (s1.x + s2.x) / 2;
      const midY = (s1.y + s2.y) / 2;

      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${dist.toFixed(1)} mm`, midX, midY - 6);

      ctx.restore();
      break;
    }

    case 'rebar': {
      renderRebarObject(ctx, obj, viewport, isSelected, true, true);
      break;
    }
  }

  ctx.restore();
}

export const renderGeometryObject = renderObject;

function renderGripHandle(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
  ctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
  ctx.restore();
}
