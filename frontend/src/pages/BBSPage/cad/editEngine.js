import { generateId, createLineObject, createPolylineObject, createRectangleObject, createCircleObject, createArcObject } from './geometry';

/**
 * RebarOptima 2D CAD Editing Engine (Phase 2B)
 * Pure Mathematical Transformations: Move, Rotate, Copy, Mirror, Offset, Trim, Extend, Fillet, and Grips.
 */

// ══════════════════════════════════════════════════════════════════════════════
// ORTHO MODE CONSTRAINT
// ══════════════════════════════════════════════════════════════════════════════

export function applyOrthoConstraint(basePt, curPt, isOrthoEnabled) {
  if (!isOrthoEnabled || !basePt) return curPt;

  const dx = Math.abs(curPt.x - basePt.x);
  const dy = Math.abs(curPt.y - basePt.y);

  if (dx >= dy) {
    // Snap horizontally (y stays same as base)
    return { x: curPt.x, y: basePt.y };
  } else {
    // Snap vertically (x stays same as base)
    return { x: basePt.x, y: curPt.y };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. MOVE TRANSFORMATION
// ══════════════════════════════════════════════════════════════════════════════

export function moveObject(obj, dx, dy) {
  if (!obj) return obj;
  const clone = JSON.parse(JSON.stringify(obj));

  switch (clone.type) {
    case 'line':
    case 'dimension':
      clone.p1.x += dx;
      clone.p1.y += dy;
      clone.p2.x += dx;
      clone.p2.y += dy;
      if (clone.x1 !== undefined) { clone.x1 += dx; clone.y1 += dy; clone.x2 += dx; clone.y2 += dy; }
      break;

    case 'rectangle':
      clone.x += dx;
      clone.y += dy;
      break;

    case 'circle':
      clone.center.x += dx;
      clone.center.y += dy;
      if (clone.cx !== undefined) { clone.cx += dx; clone.cy += dy; }
      break;

    case 'arc':
      clone.start.x += dx;
      clone.start.y += dy;
      clone.mid.x += dx;
      clone.mid.y += dy;
      clone.end.x += dx;
      clone.end.y += dy;
      break;

    case 'polyline':
      if (clone.points) {
        clone.points.forEach(p => {
          p.x += dx;
          p.y += dy;
        });
      }
      break;

    case 'rebar':
      if (clone.origin) { clone.origin.x += dx; clone.origin.y += dy; }
      if (clone.centerline?.points) {
        clone.centerline.points.forEach(p => { p.x += dx; p.y += dy; });
      }
      if (clone.centerline?.segments) {
        clone.centerline.segments.forEach(seg => {
          seg.start.x += dx; seg.start.y += dy;
          seg.end.x += dx; seg.end.y += dy;
        });
      }
      if (clone.centerline?.bends) {
        clone.centerline.bends.forEach(b => {
          if (b.center) { b.center.x += dx; b.center.y += dy; }
          if (b.vertex) { b.vertex.x += dx; b.vertex.y += dy; }
          if (b.t1) { b.t1.x += dx; b.t1.y += dy; }
          if (b.t2) { b.t2.x += dx; b.t2.y += dy; }
        });
      }
      break;
  }

  return clone;
}

export function moveObjects(objects, selectedIds, dx, dy) {
  return objects.map(obj => {
    if (selectedIds.includes(obj.id)) {
      return moveObject(obj, dx, dy);
    }
    return obj;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. ROTATE TRANSFORMATION
// ══════════════════════════════════════════════════════════════════════════════

export function rotatePoint(pt, center, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;

  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos)
  };
}

export function rotateObject(obj, center, angleRad) {
  if (!obj) return obj;
  const clone = JSON.parse(JSON.stringify(obj));

  switch (clone.type) {
    case 'line':
    case 'dimension':
      clone.p1 = rotatePoint(clone.p1, center, angleRad);
      clone.p2 = rotatePoint(clone.p2, center, angleRad);
      if (clone.x1 !== undefined) {
        clone.x1 = clone.p1.x; clone.y1 = clone.p1.y;
        clone.x2 = clone.p2.x; clone.y2 = clone.p2.y;
      }
      break;

    case 'rectangle': {
      // Rotate rectangle into a 4-point polyline to preserve non-axis aligned geometric fidelity
      const c1 = { x: clone.x, y: clone.y };
      const c2 = { x: clone.x + clone.width, y: clone.y };
      const c3 = { x: clone.x + clone.width, y: clone.y + clone.height };
      const c4 = { x: clone.x, y: clone.y + clone.height };

      const r1 = rotatePoint(c1, center, angleRad);
      const r2 = rotatePoint(c2, center, angleRad);
      const r3 = rotatePoint(c3, center, angleRad);
      const r4 = rotatePoint(c4, center, angleRad);

      return {
        id: clone.id,
        type: 'polyline',
        points: [r1, r2, r3, r4, { ...r1 }],
        isClosed: true,
        color: clone.color,
        lineWidth: clone.lineWidth
      };
    }

    case 'circle':
      clone.center = rotatePoint(clone.center, center, angleRad);
      if (clone.cx !== undefined) { clone.cx = clone.center.x; clone.cy = clone.center.y; }
      break;

    case 'arc':
      clone.start = rotatePoint(clone.start, center, angleRad);
      clone.mid = rotatePoint(clone.mid, center, angleRad);
      clone.end = rotatePoint(clone.end, center, angleRad);
      break;

    case 'polyline':
      if (clone.points) {
        clone.points = clone.points.map(p => rotatePoint(p, center, angleRad));
      }
      break;

    case 'rebar':
      if (clone.origin) clone.origin = rotatePoint(clone.origin, center, angleRad);
      if (clone.centerline?.points) {
        clone.centerline.points = clone.centerline.points.map(p => rotatePoint(p, center, angleRad));
      }
      if (clone.centerline?.segments) {
        clone.centerline.segments.forEach(seg => {
          seg.start = rotatePoint(seg.start, center, angleRad);
          seg.end = rotatePoint(seg.end, center, angleRad);
        });
      }
      if (clone.centerline?.bends) {
        clone.centerline.bends.forEach(b => {
          if (b.center) b.center = rotatePoint(b.center, center, angleRad);
          if (b.vertex) b.vertex = rotatePoint(b.vertex, center, angleRad);
          if (b.t1) b.t1 = rotatePoint(b.t1, center, angleRad);
          if (b.t2) b.t2 = rotatePoint(b.t2, center, angleRad);
          b.startAngle += angleRad;
          b.endAngle += angleRad;
        });
      }
      break;
  }

  return clone;
}

export function rotateObjects(objects, selectedIds, center, angleRad) {
  return objects.map(obj => {
    if (selectedIds.includes(obj.id)) {
      return rotateObject(obj, center, angleRad);
    }
    return obj;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. COPY TRANSFORMATION
// ══════════════════════════════════════════════════════════════════════════════

export function copyObjects(objects, selectedIds, dx, dy) {
  const newObjects = [];
  objects.forEach(obj => {
    if (selectedIds.includes(obj.id)) {
      const moved = moveObject(obj, dx, dy);
      moved.id = generateId(moved.type);
      newObjects.push(moved);
    }
  });
  return newObjects;
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. MIRROR TRANSFORMATION
// ══════════════════════════════════════════════════════════════════════════════

export function mirrorPoint(pt, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return { ...pt };

  const t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / l2;
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;

  return {
    x: 2 * projX - pt.x,
    y: 2 * projY - pt.y
  };
}

export function mirrorObject(obj, p1, p2) {
  if (!obj) return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  clone.id = generateId(clone.type);

  switch (clone.type) {
    case 'line':
    case 'dimension':
      clone.p1 = mirrorPoint(clone.p1, p1, p2);
      clone.p2 = mirrorPoint(clone.p2, p1, p2);
      if (clone.x1 !== undefined) {
        clone.x1 = clone.p1.x; clone.y1 = clone.p1.y;
        clone.x2 = clone.p2.x; clone.y2 = clone.p2.y;
      }
      break;

    case 'rectangle': {
      const c1 = mirrorPoint({ x: clone.x, y: clone.y }, p1, p2);
      const c2 = mirrorPoint({ x: clone.x + clone.width, y: clone.y }, p1, p2);
      const c3 = mirrorPoint({ x: clone.x + clone.width, y: clone.y + clone.height }, p1, p2);
      const c4 = mirrorPoint({ x: clone.x, y: clone.y + clone.height }, p1, p2);
      return {
        id: generateId('poly'),
        type: 'polyline',
        points: [c1, c2, c3, c4, { ...c1 }],
        isClosed: true,
        color: clone.color,
        lineWidth: clone.lineWidth
      };
    }

    case 'circle':
      clone.center = mirrorPoint(clone.center, p1, p2);
      if (clone.cx !== undefined) { clone.cx = clone.center.x; clone.cy = clone.center.y; }
      break;

    case 'arc':
      clone.start = mirrorPoint(clone.start, p1, p2);
      clone.mid = mirrorPoint(clone.mid, p1, p2);
      clone.end = mirrorPoint(clone.end, p1, p2);
      break;

    case 'polyline':
      if (clone.points) {
        clone.points = clone.points.map(p => mirrorPoint(p, p1, p2));
      }
      break;

    case 'rebar':
      if (clone.origin) clone.origin = mirrorPoint(clone.origin, p1, p2);
      if (clone.centerline?.points) {
        clone.centerline.points = clone.centerline.points.map(p => mirrorPoint(p, p1, p2));
      }
      if (clone.centerline?.segments) {
        clone.centerline.segments.forEach(seg => {
          seg.start = mirrorPoint(seg.start, p1, p2);
          seg.end = mirrorPoint(seg.end, p1, p2);
        });
      }
      if (clone.centerline?.bends) {
        clone.centerline.bends.forEach(b => {
          if (b.center) b.center = mirrorPoint(b.center, p1, p2);
          if (b.vertex) b.vertex = mirrorPoint(b.vertex, p1, p2);
          if (b.t1) b.t1 = mirrorPoint(b.t1, p1, p2);
          if (b.t2) b.t2 = mirrorPoint(b.t2, p1, p2);
          b.counterClockwise = !b.counterClockwise;
        });
      }
      break;
  }

  return clone;
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. OFFSET TRANSFORMATION
// ══════════════════════════════════════════════════════════════════════════════

export function offsetLine(line, offsetDist, clickSidePt) {
  const p1 = line.p1 || { x: line.x1, y: line.y1 };
  const p2 = line.p2 || { x: line.x2, y: line.y2 };
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;

  // Normal vectors
  const nx = -dy / len;
  const ny = dx / len;

  // Candidate 1 (+ normal)
  const c1_p1 = { x: p1.x + nx * offsetDist, y: p1.y + ny * offsetDist };
  const c1_p2 = { x: p2.x + nx * offsetDist, y: p2.y + ny * offsetDist };

  // Candidate 2 (- normal)
  const c2_p1 = { x: p1.x - nx * offsetDist, y: p1.y - ny * offsetDist };
  const c2_p2 = { x: p2.x - nx * offsetDist, y: p2.y - ny * offsetDist };

  // Determine which side is closer to clickSidePt
  const dist1 = Math.hypot(clickSidePt.x - (c1_p1.x + c1_p2.x) / 2, clickSidePt.y - (c1_p1.y + c1_p2.y) / 2);
  const dist2 = Math.hypot(clickSidePt.x - (c2_p1.x + c2_p2.x) / 2, clickSidePt.y - (c2_p1.y + c2_p2.y) / 2);

  const chosen = dist1 < dist2 ? { p1: c1_p1, p2: c1_p2 } : { p1: c2_p1, p2: c2_p2 };
  return createLineObject(chosen.p1, chosen.p2);
}

export function offsetRectangle(rect, offsetDist, clickSidePt) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const clickDistFromCenter = Math.hypot(clickSidePt.x - centerX, clickSidePt.y - centerY);
  const cornerDist = Math.hypot(rect.width / 2, rect.height / 2);

  // If clicked outside -> expand, if inside -> contract
  const isOutward = clickDistFromCenter >= cornerDist * 0.8;
  const delta = isOutward ? offsetDist : -offsetDist;

  const newW = Math.max(10, rect.width + 2 * delta);
  const newH = Math.max(10, rect.height + 2 * delta);
  const newX = centerX - newW / 2;
  const newY = centerY - newH / 2;

  return createRectangleObject(newX, newY, newW, newH);
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. INTERSECTIONS, TRIM & EXTEND
// ══════════════════════════════════════════════════════════════════════════════

export function lineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 1e-9) return null; // Parallel or collinear

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  return {
    x: x1 + ua * (x2 - x1),
    y: y1 + ua * (y2 - y1),
    ua,
    ub,
    onSegmentA: ua >= 0 && ua <= 1,
    onSegmentB: ub >= 0 && ub <= 1
  };
}

export function trimLine(targetLine, cuttingLine, clickPt) {
  const inter = lineLineIntersection(
    targetLine.p1.x, targetLine.p1.y, targetLine.p2.x, targetLine.p2.y,
    cuttingLine.p1.x, cuttingLine.p1.y, cuttingLine.p2.x, cuttingLine.p2.y
  );

  if (!inter || !inter.onSegmentA) {
    return { success: false, message: 'No valid intersection found to trim.' };
  }

  // Determine which side of targetLine was clicked
  const distToP1 = Math.hypot(clickPt.x - targetLine.p1.x, clickPt.y - targetLine.p1.y);
  const distToP2 = Math.hypot(clickPt.x - targetLine.p2.x, clickPt.y - targetLine.p2.y);

  let newP1 = { ...targetLine.p1 };
  let newP2 = { ...targetLine.p2 };

  if (distToP1 < distToP2) {
    // Trim from p1 to intersection point
    newP1 = { x: inter.x, y: inter.y };
  } else {
    // Trim from p2 to intersection point
    newP2 = { x: inter.x, y: inter.y };
  }

  const trimmed = createLineObject(newP1, newP2);
  trimmed.id = targetLine.id;
  return { success: true, result: trimmed };
}

export function extendLine(targetLine, boundaryLine) {
  const inter = lineLineIntersection(
    targetLine.p1.x, targetLine.p1.y, targetLine.p2.x, targetLine.p2.y,
    boundaryLine.p1.x, boundaryLine.p1.y, boundaryLine.p2.x, boundaryLine.p2.y
  );

  if (!inter || !inter.onSegmentB) {
    return { success: false, message: 'Line does not intersect boundary.' };
  }

  const distToP1 = Math.hypot(inter.x - targetLine.p1.x, inter.y - targetLine.p1.y);
  const distToP2 = Math.hypot(inter.x - targetLine.p2.x, inter.y - targetLine.p2.y);

  let newP1 = { ...targetLine.p1 };
  let newP2 = { ...targetLine.p2 };

  if (distToP2 < distToP1) {
    newP2 = { x: inter.x, y: inter.y };
  } else {
    newP1 = { x: inter.x, y: inter.y };
  }

  const extended = createLineObject(newP1, newP2);
  extended.id = targetLine.id;
  return { success: true, result: extended };
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. FILLET / CORNER BEND FOUNDATION
// ══════════════════════════════════════════════════════════════════════════════

export function filletLines(line1, line2, radius = 25) {
  const inter = lineLineIntersection(
    line1.p1.x, line1.p1.y, line1.p2.x, line1.p2.y,
    line2.p1.x, line2.p1.y, line2.p2.x, line2.p2.y
  );

  if (!inter) {
    return { success: false, message: 'Lines are parallel; cannot fillet.' };
  }

  // Vectors from intersection towards furthest endpoints
  const v1 = { x: line1.p2.x - inter.x, y: line1.p2.y - inter.y };
  const v2 = { x: line2.p2.x - inter.x, y: line2.p2.y - inter.y };
  const len1 = Math.hypot(v1.x, v1.y);
  const len2 = Math.hypot(v2.x, v2.y);

  if (len1 < radius || len2 < radius) {
    return { success: false, message: `Lines too short for fillet radius ${radius}mm.` };
  }

  const u1 = { x: v1.x / len1, y: v1.y / len1 };
  const u2 = { x: v2.x / len2, y: v2.y / len2 };

  const tanPt1 = { x: inter.x + u1.x * radius, y: inter.y + u1.y * radius };
  const tanPt2 = { x: inter.x + u2.x * radius, y: inter.y + u2.y * radius };
  const midArcPt = {
    x: inter.x + (u1.x + u2.x) * radius * 0.707,
    y: inter.y + (u1.y + u2.y) * radius * 0.707
  };

  const filletArc = createArcObject(tanPt1, midArcPt, tanPt2);

  // Trim lines to tangent points
  const newLine1 = createLineObject(tanPt1, line1.p2);
  newLine1.id = line1.id;
  const newLine2 = createLineObject(tanPt2, line2.p2);
  newLine2.id = line2.id;

  return {
    success: true,
    result: {
      arc: filletArc,
      line1: newLine1,
      line2: newLine2
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. GRIP DRAGGING ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export function updateObjectGrip(obj, gripIndex, newWorldPos) {
  if (!obj) return obj;
  const clone = JSON.parse(JSON.stringify(obj));

  switch (clone.type) {
    case 'line':
    case 'dimension':
      if (gripIndex === 0) {
        clone.p1 = { x: newWorldPos.x, y: newWorldPos.y };
        if (clone.x1 !== undefined) { clone.x1 = newWorldPos.x; clone.y1 = newWorldPos.y; }
      } else if (gripIndex === 1) {
        clone.p2 = { x: newWorldPos.x, y: newWorldPos.y };
        if (clone.x2 !== undefined) { clone.x2 = newWorldPos.x; clone.y2 = newWorldPos.y; }
      }
      break;

    case 'rectangle': {
      // 4 corners: 0=TopLeft, 1=TopRight, 2=BottomRight, 3=BottomLeft
      const right = clone.x + clone.width;
      const top = clone.y + clone.height;
      if (gripIndex === 0) {
        clone.x = Math.min(newWorldPos.x, right);
        clone.width = Math.abs(right - newWorldPos.x);
        clone.height = Math.abs(newWorldPos.y - clone.y);
      } else if (gripIndex === 1) {
        clone.width = Math.abs(newWorldPos.x - clone.x);
        clone.height = Math.abs(newWorldPos.y - clone.y);
      } else if (gripIndex === 2) {
        clone.width = Math.abs(newWorldPos.x - clone.x);
        clone.y = Math.min(newWorldPos.y, top);
        clone.height = Math.abs(top - newWorldPos.y);
      } else if (gripIndex === 3) {
        clone.x = Math.min(newWorldPos.x, right);
        clone.width = Math.abs(right - newWorldPos.x);
        clone.y = Math.min(newWorldPos.y, top);
        clone.height = Math.abs(top - newWorldPos.y);
      }
      break;
    }

    case 'circle':
      if (gripIndex === 0) {
        // Drag center
        clone.center = { x: newWorldPos.x, y: newWorldPos.y };
        if (clone.cx !== undefined) { clone.cx = newWorldPos.x; clone.cy = newWorldPos.y; }
      } else if (gripIndex === 1) {
        // Drag radius
        clone.radius = Math.max(1, Math.hypot(newWorldPos.x - clone.center.x, newWorldPos.y - clone.center.y));
      }
      break;

    case 'arc':
      if (gripIndex === 0) clone.start = { x: newWorldPos.x, y: newWorldPos.y };
      else if (gripIndex === 1) clone.mid = { x: newWorldPos.x, y: newWorldPos.y };
      else if (gripIndex === 2) clone.end = { x: newWorldPos.x, y: newWorldPos.y };
      break;

    case 'polyline':
      if (clone.points && gripIndex >= 0 && gripIndex < clone.points.length) {
        clone.points[gripIndex] = { x: newWorldPos.x, y: newWorldPos.y };
      }
      break;
  }

  return clone;
}
