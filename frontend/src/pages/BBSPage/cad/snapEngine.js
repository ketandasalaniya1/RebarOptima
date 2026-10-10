import { worldToScreen } from './viewport';
import { distanceToSegment } from './geometry';

/**
 * Precision Snapping Engine for 2D CAD (Phase 2B)
 * Supports Grid, Endpoint, Midpoint, Center, Intersection, and Perpendicular Snapping.
 */

export function getGridInterval(zoom, baseGridSize = 10) {
  const baseTargetPx = 50;
  const rawInterval = baseTargetPx / Math.max(0.01, zoom);
  const exponent = Math.floor(Math.log10(rawInterval));
  const power = Math.pow(10, exponent);
  const fraction = rawInterval / power;

  let multiplier = 1;
  if (fraction >= 5) multiplier = 5;
  else if (fraction >= 2) multiplier = 2;

  return Math.max(1, multiplier * power);
}

// Line-line intersection helper
function getLineIntersection(p1, p2, p3, p4) {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(denom) < 1e-6) return null;

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y)
    };
  }
  return null;
}

export function getObjectSegments(obj) {
  const segments = [];
  if (!obj) return segments;

  switch (obj.type) {
    case 'line':
    case 'dimension': {
      const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
      const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
      segments.push({ p1, p2, objId: obj.id });
      break;
    }
    case 'rectangle': {
      const p1 = { x: obj.x, y: obj.y };
      const p2 = { x: obj.x + obj.width, y: obj.y };
      const p3 = { x: obj.x + obj.width, y: obj.y + obj.height };
      const p4 = { x: obj.x, y: obj.y + obj.height };
      segments.push({ p1, p2, objId: obj.id });
      segments.push({ p1: p2, p2: p3, objId: obj.id });
      segments.push({ p1: p3, p2: p4, objId: obj.id });
      segments.push({ p1: p4, p2: p1, objId: obj.id });
      break;
    }
    case 'polyline': {
      if (obj.points && obj.points.length > 1) {
        for (let i = 0; i < obj.points.length - 1; i++) {
          segments.push({ p1: obj.points[i], p2: obj.points[i + 1], objId: obj.id });
        }
        if (obj.isClosed) {
          segments.push({ p1: obj.points[obj.points.length - 1], p2: obj.points[0], objId: obj.id });
        }
      }
      break;
    }
  }
  return segments;
}

export function getObjectSnapCandidates(obj) {
  const candidates = [];
  if (!obj) return candidates;

  switch (obj.type) {
    case 'line':
    case 'dimension': {
      const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
      const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
      candidates.push({ x: p1.x, y: p1.y, type: 'endpoint' });
      candidates.push({ x: p2.x, y: p2.y, type: 'endpoint' });
      candidates.push({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, type: 'midpoint' });
      break;
    }

    case 'rectangle': {
      const x1 = obj.x;
      const x2 = obj.x + obj.width;
      const y1 = obj.y;
      const y2 = obj.y + obj.height;
      // 4 Corners
      candidates.push({ x: x1, y: y1, type: 'endpoint' });
      candidates.push({ x: x2, y: y1, type: 'endpoint' });
      candidates.push({ x: x2, y: y2, type: 'endpoint' });
      candidates.push({ x: x1, y: y2, type: 'endpoint' });
      // 4 Edge Midpoints
      candidates.push({ x: (x1 + x2) / 2, y: y1, type: 'midpoint' });
      candidates.push({ x: x2, y: (y1 + y2) / 2, type: 'midpoint' });
      candidates.push({ x: (x1 + x2) / 2, y: y2, type: 'midpoint' });
      candidates.push({ x: x1, y: (y1 + y2) / 2, type: 'midpoint' });
      // Center
      candidates.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, type: 'center' });
      break;
    }

    case 'circle': {
      const center = obj.center || { x: obj.cx || 0, y: obj.cy || 0 };
      candidates.push({ x: center.x, y: center.y, type: 'center' });
      break;
    }

    case 'arc': {
      const start = obj.start || { x: 0, y: 0 };
      const end = obj.end || { x: 0, y: 0 };
      const mid = obj.mid || { x: 0, y: 0 };
      candidates.push({ x: start.x, y: start.y, type: 'endpoint' });
      candidates.push({ x: end.x, y: end.y, type: 'endpoint' });
      candidates.push({ x: mid.x, y: mid.y, type: 'midpoint' });
      break;
    }

    case 'polyline': {
      if (obj.points && obj.points.length > 0) {
        for (let i = 0; i < obj.points.length; i++) {
          candidates.push({ x: obj.points[i].x, y: obj.points[i].y, type: 'endpoint' });
          if (i < obj.points.length - 1) {
            candidates.push({
              x: (obj.points[i].x + obj.points[i + 1].x) / 2,
              y: (obj.points[i].y + obj.points[i + 1].y) / 2,
              type: 'midpoint'
            });
          }
        }
      }
      break;
    }
  }

  return candidates;
}

export function findSnapPoint(worldPoint, objects = [], snapSettings = {}, viewport) {
  if (!snapSettings || snapSettings.enabled === false) return null;

  const snapToleranceMm = (snapSettings.tolerancePx || 14) / Math.max(0.1, viewport.zoom);
  let bestSnap = null;
  let minDistance = Infinity;

  // 1. Geometry Object Snap (Endpoints, Midpoints, Centers)
  if (snapSettings.endpoint !== false || snapSettings.midpoint !== false || snapSettings.center !== false) {
    for (const obj of objects) {
      const candidates = getObjectSnapCandidates(obj);
      for (const cand of candidates) {
        if (snapSettings[cand.type] === false) continue;
        const dist = Math.hypot(worldPoint.x - cand.x, worldPoint.y - cand.y);
        if (dist <= snapToleranceMm && dist < minDistance) {
          minDistance = dist;
          bestSnap = {
            x: cand.x,
            y: cand.y,
            type: cand.type,
            targetObjectId: obj.id
          };
        }
      }
    }
  }

  // 2. Intersection Snap
  if (snapSettings.intersection !== false && objects.length >= 2) {
    const allSegments = [];
    objects.forEach(obj => {
      allSegments.push(...getObjectSegments(obj));
    });

    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        if (allSegments[i].objId === allSegments[j].objId) continue;
        const inter = getLineIntersection(allSegments[i].p1, allSegments[i].p2, allSegments[j].p1, allSegments[j].p2);
        if (inter) {
          const dist = Math.hypot(worldPoint.x - inter.x, worldPoint.y - inter.y);
          if (dist <= snapToleranceMm && dist < minDistance) {
            minDistance = dist;
            bestSnap = {
              x: inter.x,
              y: inter.y,
              type: 'intersection'
            };
          }
        }
      }
    }
  }

  if (bestSnap) return bestSnap;

  // 3. Grid Snap
  if (snapSettings.grid !== false) {
    const gridInterval = getGridInterval(viewport.zoom, snapSettings.gridSize || 10);
    const gx = Math.round(worldPoint.x / gridInterval) * gridInterval;
    const gy = Math.round(worldPoint.y / gridInterval) * gridInterval;
    const dist = Math.hypot(worldPoint.x - gx, worldPoint.y - gy);

    if (dist <= snapToleranceMm * 1.5) {
      return {
        x: gx,
        y: gy,
        type: 'grid'
      };
    }
  }

  return null;
}

export function renderSnapIndicator(ctx, snap, viewport) {
  if (!snap) return;

  const s = worldToScreen(snap.x, snap.y, viewport);
  ctx.save();
  ctx.lineWidth = 2;

  switch (snap.type) {
    case 'endpoint':
      // Green square
      ctx.strokeStyle = '#22c55e';
      ctx.strokeRect(s.x - 6, s.y - 6, 12, 12);
      break;

    case 'midpoint':
      // Cyan triangle
      ctx.strokeStyle = '#06b6d4';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 7);
      ctx.lineTo(s.x + 7, s.y + 6);
      ctx.lineTo(s.x - 7, s.y + 6);
      ctx.closePath();
      ctx.stroke();
      break;

    case 'center':
      // Amber circle
      ctx.strokeStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'intersection':
      // Purple / Magenta 'X'
      ctx.strokeStyle = '#c084fc';
      ctx.beginPath();
      ctx.moveTo(s.x - 6, s.y - 6);
      ctx.lineTo(s.x + 6, s.y + 6);
      ctx.moveTo(s.x + 6, s.y - 6);
      ctx.lineTo(s.x - 6, s.y + 6);
      ctx.stroke();
      break;

    case 'grid':
      // Sky blue cross
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(s.x - 5, s.y);
      ctx.lineTo(s.x + 5, s.y);
      ctx.moveTo(s.x, s.y - 5);
      ctx.lineTo(s.x, s.y + 5);
      ctx.stroke();
      break;
  }

  ctx.restore();
}
