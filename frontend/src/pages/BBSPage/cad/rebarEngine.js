/**
 * RebarOptima Phase 2E — Rebar Geometry & Bending Engine
 * 
 * Semantic Reinforcement Model:
 * Centerline Path, Mandrel Radii, Tangent Fillet Bends, Hooks, Diameter Thickness & Parameter Binding.
 */

import { generateId } from './geometry';
import { PARAMETER_TYPES, PARAMETER_CATEGORIES, REBAR_SHAPE_TYPES, STANDARD_BAR_DIAMETERS } from './types';
import { createParameter } from './parameterEngine';
import { worldToScreen } from './viewport';

// ══════════════════════════════════════════════════════════════════════════════
// 1. MATHEMATICAL TANGENT FILLET & BEND GEOMETRY
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Computes a true tangent fillet arc between 2 intersecting segments P0-P1 and P1-P2.
 * @param {{x: number, y: number}} p0 Segment 1 Start
 * @param {{x: number, y: number}} p1 Vertex / Corner
 * @param {{x: number, y: number}} p2 Segment 2 End
 * @param {number} radius Bend Radius (mm)
 * @returns {object|null} Bend details with tangent points, arc center, angles, and direction
 */
export function computeFilletBend(p0, p1, p2, radius) {
  const d1x = p0.x - p1.x;
  const d1y = p0.y - p1.y;
  const len1 = Math.hypot(d1x, d1y);

  const d2x = p2.x - p1.x;
  const d2y = p2.y - p1.y;
  const len2 = Math.hypot(d2x, d2y);

  if (len1 < 1e-4 || len2 < 1e-4 || radius <= 0) {
    return null;
  }

  // Unit vectors away from vertex P1
  const u1x = d1x / len1;
  const u1y = d1y / len1;
  const u2x = d2x / len2;
  const u2y = d2y / len2;

  // Dot product and corner interior angle alpha
  const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y));
  const alpha = Math.acos(dot); // Interior angle in radians

  // Collinear or sharp reversal
  if (alpha < 0.05 || alpha > Math.PI - 0.05) {
    return null;
  }

  // Bend angle theta = 180° - alpha
  const bendAngleRad = Math.PI - alpha;
  const bendAngleDeg = (bendAngleRad * 180) / Math.PI;

  // Tangent distance from vertex P1
  const tangentDist = radius * Math.tan(bendAngleRad / 2);

  // Clamp tangent distance to available segment lengths
  const effectiveTangent = Math.min(tangentDist, len1 * 0.9, len2 * 0.9);
  const effectiveRadius = effectiveTangent / Math.tan(bendAngleRad / 2);

  // Tangent points on segments
  const t1 = {
    x: p1.x + u1x * effectiveTangent,
    y: p1.y + u1y * effectiveTangent
  };

  const t2 = {
    x: p1.x + u2x * effectiveTangent,
    y: p1.y + u2y * effectiveTangent
  };

  // Cross product to determine CW / CCW direction
  // (u1.x * u2.y - u1.y * u2.x)
  const cross = u1x * u2y - u1y * u2x;
  const isCCW = cross > 0;

  // Bisector vector
  const bx = u1x + u2x;
  const by = u1y + u2y;
  const bLen = Math.hypot(bx, by);
  if (bLen < 1e-5) return null;

  const bUnitX = bx / bLen;
  const bUnitY = by / bLen;

  // Center distance from vertex
  const centerDist = effectiveRadius / Math.sin(alpha / 2);
  const center = {
    x: p1.x + bUnitX * centerDist,
    y: p1.y + bUnitY * centerDist
  };

  // Arc start and end angles from center
  let startAngle = Math.atan2(t1.y - center.y, t1.x - center.x);
  let endAngle = Math.atan2(t2.y - center.y, t2.x - center.x);

  return {
    vertex: { ...p1 },
    t1,
    t2,
    center,
    radius: effectiveRadius,
    nominalRadius: radius,
    bendAngleDeg: Number(bendAngleDeg.toFixed(1)),
    startAngle,
    endAngle,
    counterClockwise: !isCCW
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. REBAR GEOMETRY FACTORY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 1. Straight Bar Factory
 */
export function createStraightBar({
  id = generateId('rebar_str'),
  length = 1000,
  diameter = 16,
  origin = { x: -500, y: 0 },
  direction = 0, // degrees
  color = '#38bdf8'
} = {}) {
  const rad = (direction * Math.PI) / 180;
  const p1 = { x: Number(origin.x), y: Number(origin.y) };
  const p2 = {
    x: Number((p1.x + Math.cos(rad) * length).toFixed(2)),
    y: Number((p1.y + Math.sin(rad) * length).toFixed(2))
  };

  return {
    id,
    type: 'rebar',
    shapeType: REBAR_SHAPE_TYPES.STRAIGHT,
    name: 'Straight Bar',
    diameter: Number(diameter) || 16,
    bendRadius: 0,
    color,
    origin: { ...p1 },
    direction: Number(direction) || 0,
    parameters: {
      length: Number(length) || 1000,
      diameter: Number(diameter) || 16
    },
    centerline: {
      points: [p1, p2],
      segments: [
        { id: `${id}_seg1`, start: p1, end: p2, length: Number(length) || 1000 }
      ],
      bends: [],
      hooks: []
    }
  };
}

/**
 * 2. L-Bar Factory (Leg A + Bend Radius + Leg B)
 */
export function createLBar({
  id = generateId('rebar_lbar'),
  legA = 500,
  legB = 300,
  diameter = 16,
  bendRadius = 32,
  bendAngle = 90,
  origin = { x: -250, y: -150 },
  color = '#38bdf8'
} = {}) {
  const p0 = { x: Number(origin.x), y: Number(origin.y) };
  const p1 = { x: Number(origin.x) + Number(legA), y: Number(origin.y) };
  const p2 = { x: Number(p1.x), y: Number(p1.y) + Number(legB) };

  return {
    id,
    type: 'rebar',
    shapeType: REBAR_SHAPE_TYPES.L_BAR,
    name: 'L-Bar',
    diameter: Number(diameter) || 16,
    bendRadius: Number(bendRadius) || 32,
    color,
    origin: { ...p0 },
    parameters: {
      legA: Number(legA) || 500,
      legB: Number(legB) || 300,
      diameter: Number(diameter) || 16,
      bendAngle: Number(bendAngle) || 90,
      bendRadius: Number(bendRadius) || 32
    },
    centerline: {
      points: [p0, p1, p2],
      segments: [
        { id: `${id}_segA`, name: 'Leg A', start: p0, end: p1, length: Number(legA) },
        { id: `${id}_segB`, name: 'Leg B', start: p1, end: p2, length: Number(legB) }
      ],
      bends: [],
      hooks: []
    }
  };
}

/**
 * 3. U-Bar Factory (Leg A + Bend + Base B + Bend + Leg C)
 */
export function createUBar({
  id = generateId('rebar_ubar'),
  legA = 300,
  baseB = 500,
  legC = 300,
  diameter = 16,
  bendRadius = 32,
  origin = { x: -250, y: -150 },
  color = '#38bdf8'
} = {}) {
  const p0 = { x: Number(origin.x), y: Number(origin.y) + Number(legA) };
  const p1 = { x: Number(origin.x), y: Number(origin.y) };
  const p2 = { x: Number(origin.x) + Number(baseB), y: Number(origin.y) };
  const p3 = { x: Number(origin.x) + Number(baseB), y: Number(origin.y) + Number(legC) };

  return {
    id,
    type: 'rebar',
    shapeType: REBAR_SHAPE_TYPES.U_BAR,
    name: 'U-Bar',
    diameter: Number(diameter) || 16,
    bendRadius: Number(bendRadius) || 32,
    color,
    origin: { ...origin },
    parameters: {
      legA: Number(legA) || 300,
      baseB: Number(baseB) || 500,
      legC: Number(legC) || 300,
      diameter: Number(diameter) || 16,
      bendRadius: Number(bendRadius) || 32
    },
    centerline: {
      points: [p0, p1, p2, p3],
      segments: [
        { id: `${id}_segA`, name: 'Leg A', start: p0, end: p1, length: Number(legA) },
        { id: `${id}_segB`, name: 'Base B', start: p1, end: p2, length: Number(baseB) },
        { id: `${id}_segC`, name: 'Leg C', start: p2, end: p3, length: Number(legC) }
      ],
      bends: [],
      hooks: []
    }
  };
}

/**
 * 4. Cranked Bar / Joggle Bar Factory (Main A + Crank + Main C)
 */
export function createCrankedBar({
  id = generateId('rebar_crank'),
  lengthA = 600,
  crankLength = 150,
  crankAngle = 45,
  offset = 80,
  lengthC = 600,
  diameter = 16,
  bendRadius = 32,
  origin = { x: -600, y: 0 },
  color = '#38bdf8'
} = {}) {
  const p0 = { x: Number(origin.x), y: Number(origin.y) };
  const p1 = { x: Number(origin.x) + Number(lengthA), y: Number(origin.y) };

  const crankRad = (Number(crankAngle) * Math.PI) / 180;
  const crankDx = Number(offset) / (Math.tan(crankRad) || 1);
  const p2 = { x: p1.x + crankDx, y: p1.y + Number(offset) };
  const p3 = { x: p2.x + Number(lengthC), y: p2.y };

  return {
    id,
    type: 'rebar',
    shapeType: REBAR_SHAPE_TYPES.CRANKED,
    name: 'Cranked Bar',
    diameter: Number(diameter) || 16,
    bendRadius: Number(bendRadius) || 32,
    color,
    origin: { ...origin },
    parameters: {
      lengthA: Number(lengthA) || 600,
      offset: Number(offset) || 80,
      crankAngle: Number(crankAngle) || 45,
      lengthC: Number(lengthC) || 600,
      diameter: Number(diameter) || 16,
      bendRadius: Number(bendRadius) || 32
    },
    centerline: {
      points: [p0, p1, p2, p3],
      segments: [
        { id: `${id}_segA`, name: 'Main A', start: p0, end: p1, length: Number(lengthA) },
        { id: `${id}_segCrank`, name: 'Crank', start: p1, end: p2, length: Math.hypot(p2.x - p1.x, p2.y - p1.y) },
        { id: `${id}_segC`, name: 'Main C', start: p2, end: p3, length: Number(lengthC) }
      ],
      bends: [],
      hooks: []
    }
  };
}

/**
 * 5. Closed Stirrup / Link Factory (Width A × Height B with Dual 135° Seismic Hooks)
 */
export function createClosedStirrup({
  id = generateId('rebar_stirrup'),
  width = 300,
  height = 450,
  diameter = 8,
  bendRadius = 16,
  hookAngle = 135,
  hookExtension = 75,
  origin = { x: -150, y: -225 },
  color = '#38bdf8'
} = {}) {
  const x0 = Number(origin.x);
  const y0 = Number(origin.y);
  const w = Number(width);
  const h = Number(height);
  const r = Number(bendRadius) || 16;
  const hookExt = Number(hookExtension) || 75;
  const dia = Number(diameter) || 8;

  // 4 outer corner vertices:
  // p0 = Top-Left (x0, y0 + h)
  // p1 = Top-Right (x0 + w, y0 + h)
  // p2 = Bottom-Right (x0 + w, y0)
  // p3 = Bottom-Left (x0, y0)
  const p0 = { x: x0, y: y0 + h };
  const p1 = { x: x0 + w, y: y0 + h };
  const p2 = { x: x0 + w, y: y0 };
  const p3 = { x: x0, y: y0 };

  // Realistic parallel spacing between the dual 135° hook tails (perpendicular to 45° angle)
  const hookGap = Math.max(12, dia * 1.6);
  const cos45 = Math.cos(Math.PI / 4); // 0.7071
  const sin45 = Math.sin(Math.PI / 4); // 0.7071

  // Hook 1: Extends inside the core, parallel to Hook 2 (shifted along the normal)
  const pHook1Start = {
    x: Number((p0.x + hookExt * cos45 + hookGap * sin45).toFixed(1)),
    y: Number((p0.y - hookExt * sin45 + hookGap * cos45).toFixed(1))
  };

  // Hook 2: Extends inside the core at 135° from left leg (45° into the interior)
  const pHook2End = {
    x: Number((p0.x + hookExt * cos45).toFixed(1)),
    y: Number((p0.y - hookExt * sin45).toFixed(1))
  };

  return {
    id,
    type: 'rebar',
    shapeType: REBAR_SHAPE_TYPES.CLOSED_STIRRUP,
    name: 'Rectangular Closed Stirrup',
    diameter: dia,
    bendRadius: r,
    color,
    origin: { ...origin },
    parameters: {
      width: w,
      height: h,
      diameter: dia,
      bendRadius: r,
      hookAngle: Number(hookAngle) || 135,
      hookExtension: hookExt
    },
    centerline: {
      // Continuous rebar path: Hook 1 -> Top -> Right -> Bottom -> Left -> Hook 2
      points: [pHook1Start, p0, p1, p2, p3, p0, pHook2End],
      segments: [
        { id: `${id}_hk1`, name: 'Hook 1 (135°)', start: pHook1Start, end: p0, length: hookExt },
        { id: `${id}_top`, name: 'Width (Top)', start: p0, end: p1, length: w },
        { id: `${id}_right`, name: 'Height (Right)', start: p1, end: p2, length: h },
        { id: `${id}_bottom`, name: 'Width (Bottom)', start: p2, end: p3, length: w },
        { id: `${id}_left`, name: 'Height (Left)', start: p3, end: p0, length: h },
        { id: `${id}_hk2`, name: 'Hook 2 (135°)', start: p0, end: pHook2End, length: hookExt }
      ],
      bends: [
        { id: `${id}_b1`, bendAngleDeg: 135, radius: r },
        { id: `${id}_b2`, bendAngleDeg: 90, radius: r },
        { id: `${id}_b3`, bendAngleDeg: 90, radius: r },
        { id: `${id}_b4`, bendAngleDeg: 90, radius: r },
        { id: `${id}_b5`, bendAngleDeg: 135, radius: r }
      ],
      hooks: [
        { id: `${id}_hk1`, angle: Number(hookAngle) || 135, extension: hookExt, tip: pHook1Start },
        { id: `${id}_hk2`, angle: Number(hookAngle) || 135, extension: hookExt, tip: pHook2End }
      ]
    }
  };
}

/**
 * 6. Open Link Factory (U-link with Dual 135° Seismic End Hooks)
 */
export function createOpenLink({
  id = generateId('rebar_openlink'),
  width = 250,
  height = 400,
  diameter = 10,
  bendRadius = 20,
  hookAngle = 135,
  hookExtension = 60,
  origin = { x: -125, y: -200 },
  color = '#38bdf8'
} = {}) {
  const x0 = Number(origin.x);
  const y0 = Number(origin.y);
  const w = Number(width);
  const h = Number(height);
  const r = Number(bendRadius) || 20;
  const hookExt = Number(hookExtension) || 60;

  const p0 = { x: x0, y: y0 + h };     // Top-Left
  const p1 = { x: x0, y: y0 };         // Bottom-Left
  const p2 = { x: x0 + w, y: y0 };     // Bottom-Right
  const p3 = { x: x0 + w, y: y0 + h }; // Top-Right

  // 135° hooks at top-left and top-right pointing into the interior:
  const pHookLeft = {
    x: Number((p0.x + hookExt * 0.707).toFixed(1)),
    y: Number((p0.y - hookExt * 0.707).toFixed(1))
  };
  const pHookRight = {
    x: Number((p3.x - hookExt * 0.707).toFixed(1)),
    y: Number((p3.y - hookExt * 0.707).toFixed(1))
  };

  return {
    id,
    type: 'rebar',
    shapeType: REBAR_SHAPE_TYPES.OPEN_LINK,
    name: 'Open Link',
    diameter: Number(diameter) || 10,
    bendRadius: r,
    color,
    origin: { ...origin },
    parameters: {
      width: w,
      height: h,
      diameter: Number(diameter) || 10,
      bendRadius: r,
      hookAngle: Number(hookAngle) || 135,
      hookExtension: hookExt
    },
    centerline: {
      points: [pHookLeft, p0, p1, p2, p3, pHookRight],
      segments: [
        { id: `${id}_hkL`, name: 'Hook Left', start: pHookLeft, end: p0, length: hookExt },
        { id: `${id}_left`, name: 'Left Leg', start: p0, end: p1, length: h },
        { id: `${id}_bottom`, name: 'Bottom Base', start: p1, end: p2, length: w },
        { id: `${id}_right`, name: 'Right Leg', start: p2, end: p3, length: h },
        { id: `${id}_hkR`, name: 'Hook Right', start: p3, end: pHookRight, length: hookExt }
      ],
      bends: [],
      hooks: [
        { id: `${id}_hkL`, angle: Number(hookAngle) || 135, extension: hookExt, tip: pHookLeft },
        { id: `${id}_hkR`, angle: Number(hookAngle) || 135, extension: hookExt, tip: pHookRight }
      ]
    }
  };
}

/**
 * 7. Hook Object Factory (Dedicated Hook Primitive)
 */
export function createHookObject({
  id = generateId('rebar_hook'),
  stemLength = 300,
  hookAngle = 135,
  hookExtension = 80,
  bendRadius = 24,
  diameter = 16,
  origin = { x: -150, y: 0 },
  color = '#38bdf8'
} = {}) {
  const p0 = { x: Number(origin.x), y: Number(origin.y) };
  const p1 = { x: Number(origin.x) + Number(stemLength), y: Number(origin.y) };

  // Deflection of hookAngle from stem (+X):
  // 135° hook bends 135° from straight line, extending backwards at 45°
  const angleDeg = Number(hookAngle) || 135;
  const angleRad = (angleDeg * Math.PI) / 180;
  const p2 = {
    x: Number((p1.x - Math.cos(Math.PI - angleRad) * Number(hookExtension)).toFixed(1)),
    y: Number((p1.y - Math.sin(Math.PI - angleRad) * Number(hookExtension)).toFixed(1))
  };

  return {
    id,
    type: 'rebar',
    shapeType: REBAR_SHAPE_TYPES.HOOK,
    name: 'Hook Bar',
    diameter: Number(diameter) || 16,
    bendRadius: Number(bendRadius) || 24,
    color,
    origin: { ...origin },
    parameters: {
      stemLength: Number(stemLength) || 300,
      hookAngle: angleDeg,
      hookExtension: Number(hookExtension) || 80,
      bendRadius: Number(bendRadius) || 24,
      diameter: Number(diameter) || 16
    },
    centerline: {
      points: [p0, p1, p2],
      segments: [
        { id: `${id}_stem`, name: 'Stem', start: p0, end: p1, length: Number(stemLength) },
        { id: `${id}_ret`, name: 'Hook Return', start: p1, end: p2, length: Number(hookExtension) }
      ],
      bends: [],
      hooks: [{ id: `${id}_hook`, angle: angleDeg, extension: Number(hookExtension), tip: p2 }]
    }
  };
}

/**
 * 8. Bend Object Factory (Dedicated Bend Transition)
 */
export function createBendObject({
  id = generateId('rebar_bend'),
  bendAngle = 90,
  bendRadius = 40,
  diameter = 16,
  legLength = 250,
  origin = { x: 0, y: 0 },
  color = '#38bdf8'
} = {}) {
  const p0 = { x: Number(origin.x) - Number(legLength), y: Number(origin.y) };
  const p1 = { x: Number(origin.x), y: Number(origin.y) };

  const angRad = ((180 - Number(bendAngle)) * Math.PI) / 180;
  const p2 = {
    x: Number(p1.x + Math.cos(angRad) * Number(legLength)),
    y: Number(p1.y + Math.sin(angRad) * Number(legLength))
  };

  const bend = computeFilletBend(p0, p1, p2, Number(bendRadius) || 40);

  return {
    id,
    type: 'rebar',
    shapeType: REBAR_SHAPE_TYPES.BEND,
    name: 'Curved Bend',
    diameter: Number(diameter) || 16,
    bendRadius: Number(bendRadius) || 40,
    color,
    origin: { ...origin },
    parameters: {
      bendAngle: Number(bendAngle) || 90,
      bendRadius: Number(bendRadius) || 40,
      legLength: Number(legLength) || 250,
      diameter: Number(diameter) || 16
    },
    centerline: {
      points: [p0, p1, p2],
      segments: [
        { id: `${id}_leg1`, start: p0, end: bend ? bend.t1 : p1, length: Number(legLength) },
        { id: `${id}_leg2`, start: bend ? bend.t2 : p1, end: p2, length: Number(legLength) }
      ],
      bends: bend ? [bend] : [],
      hooks: []
    }
  };
}

/**
 * 9. Custom Rebar Path Factory (Multi-vertex polyline with automatic tangent fillet bends)
 */
export function createCustomRebarPath({
  id = generateId('rebar_custom'),
  points = [
    { x: -300, y: 100 },
    { x: 0, y: 100 },
    { x: 150, y: -100 },
    { x: 350, y: -100 }
  ],
  diameter = 16,
  bendRadius = 32,
  color = '#38bdf8'
} = {}) {
  const normPoints = points.map(p => ({ x: Number(p.x), y: Number(p.y) }));
  const bends = [];
  const segments = [];

  for (let i = 1; i < normPoints.length - 1; i++) {
    const b = computeFilletBend(normPoints[i - 1], normPoints[i], normPoints[i + 1], Number(bendRadius) || 32);
    if (b) bends.push(b);
  }

  for (let i = 0; i < normPoints.length - 1; i++) {
    const startBend = i > 0 ? bends[i - 1] : null;
    const endBend = i < bends.length ? bends[i] : null;

    const startPt = startBend ? startBend.t2 : normPoints[i];
    const endPt = endBend ? endBend.t1 : normPoints[i + 1];

    segments.push({
      id: `${id}_seg${i + 1}`,
      name: `Segment ${i + 1}`,
      start: startPt,
      end: endPt,
      length: Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y)
    });
  }

  return {
    id,
    type: 'rebar',
    shapeType: REBAR_SHAPE_TYPES.CUSTOM_REBAR,
    name: 'Custom Rebar Path',
    diameter: Number(diameter) || 16,
    bendRadius: Number(bendRadius) || 32,
    color,
    origin: normPoints[0] ? { ...normPoints[0] } : { x: 0, y: 0 },
    parameters: {
      diameter: Number(diameter) || 16,
      bendRadius: Number(bendRadius) || 32
    },
    centerline: {
      points: normPoints,
      segments,
      bends,
      hooks: []
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. PARAMETRIC REBAR SYNCHRONIZATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Recomputes semantic rebar geometry when any parameter changes
 */
export function updateRebarGeometry(rebarObject, updatedParams) {
  if (!rebarObject || rebarObject.type !== 'rebar') return rebarObject;

  const mergedParams = { ...rebarObject.parameters, ...(updatedParams || {}) };
  const { shapeType, id, origin, color } = rebarObject;

  switch (shapeType) {
    case REBAR_SHAPE_TYPES.STRAIGHT:
      return createStraightBar({
        id,
        length: mergedParams.length,
        diameter: mergedParams.diameter,
        origin,
        color
      });

    case REBAR_SHAPE_TYPES.L_BAR:
      return createLBar({
        id,
        legA: mergedParams.legA,
        legB: mergedParams.legB,
        diameter: mergedParams.diameter,
        bendRadius: mergedParams.bendRadius,
        bendAngle: mergedParams.bendAngle,
        origin,
        color
      });

    case REBAR_SHAPE_TYPES.U_BAR:
      return createUBar({
        id,
        legA: mergedParams.legA,
        baseB: mergedParams.baseB,
        legC: mergedParams.legC,
        diameter: mergedParams.diameter,
        bendRadius: mergedParams.bendRadius,
        origin,
        color
      });

    case REBAR_SHAPE_TYPES.CRANKED:
      return createCrankedBar({
        id,
        lengthA: mergedParams.lengthA,
        offset: mergedParams.offset,
        crankAngle: mergedParams.crankAngle,
        lengthC: mergedParams.lengthC,
        diameter: mergedParams.diameter,
        bendRadius: mergedParams.bendRadius,
        origin,
        color
      });

    case REBAR_SHAPE_TYPES.CLOSED_STIRRUP:
      return createClosedStirrup({
        id,
        width: mergedParams.width,
        height: mergedParams.height,
        diameter: mergedParams.diameter,
        bendRadius: mergedParams.bendRadius,
        hookAngle: mergedParams.hookAngle,
        hookExtension: mergedParams.hookExtension,
        origin,
        color
      });

    case REBAR_SHAPE_TYPES.OPEN_LINK:
      return createOpenLink({
        id,
        width: mergedParams.width,
        height: mergedParams.height,
        diameter: mergedParams.diameter,
        bendRadius: mergedParams.bendRadius,
        hookAngle: mergedParams.hookAngle,
        hookExtension: mergedParams.hookExtension,
        origin,
        color
      });

    case REBAR_SHAPE_TYPES.HOOK:
      return createHookObject({
        id,
        hookAngle: mergedParams.hookAngle,
        hookExtension: mergedParams.hookExtension,
        hookRadius: mergedParams.hookRadius || mergedParams.bendRadius,
        diameter: mergedParams.diameter,
        origin,
        color
      });

    case REBAR_SHAPE_TYPES.BEND:
      return createBendObject({
        id,
        bendAngle: mergedParams.bendAngle,
        bendRadius: mergedParams.bendRadius,
        diameter: mergedParams.diameter,
        legLength: mergedParams.legLength,
        origin,
        color
      });

    case REBAR_SHAPE_TYPES.CUSTOM_REBAR:
      return createCustomRebarPath({
        id,
        points: rebarObject.centerline?.points || [],
        diameter: mergedParams.diameter,
        bendRadius: mergedParams.bendRadius,
        color
      });

    default:
      return rebarObject;
  }
}

/**
 * Generate standard categorized parameters for a rebar shape
 */
export function generateRebarShapeParameters(rebar) {
  if (!rebar || rebar.type !== 'rebar') return [];

  const params = [];
  const p = rebar.parameters || {};

  // 1. REBAR DIAMETER
  if (p.diameter !== undefined) {
    params.push(createParameter({
      name: 'BAR_DIAMETER',
      displayName: 'Bar Diameter (Ø)',
      value: p.diameter,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.REBAR,
      targetRef: { objectId: rebar.id, property: 'diameter' }
    }));
  }

  // 2. GEOMETRIC DIMENSIONS
  if (p.length !== undefined) {
    params.push(createParameter({
      name: 'LENGTH',
      displayName: 'Bar Length',
      value: p.length,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.GEOMETRY,
      targetRef: { objectId: rebar.id, property: 'length' }
    }));
  }
  if (p.legA !== undefined) {
    params.push(createParameter({
      name: 'LEG_A',
      displayName: 'Leg A Length',
      value: p.legA,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.GEOMETRY,
      targetRef: { objectId: rebar.id, property: 'legA' }
    }));
  }
  if (p.legB !== undefined) {
    params.push(createParameter({
      name: 'LEG_B',
      displayName: 'Leg B Length',
      value: p.legB,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.GEOMETRY,
      targetRef: { objectId: rebar.id, property: 'legB' }
    }));
  }
  if (p.baseB !== undefined) {
    params.push(createParameter({
      name: 'BASE_B',
      displayName: 'Base B Length',
      value: p.baseB,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.GEOMETRY,
      targetRef: { objectId: rebar.id, property: 'baseB' }
    }));
  }
  if (p.legC !== undefined) {
    params.push(createParameter({
      name: 'LEG_C',
      displayName: 'Leg C Length',
      value: p.legC,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.GEOMETRY,
      targetRef: { objectId: rebar.id, property: 'legC' }
    }));
  }
  if (p.width !== undefined) {
    params.push(createParameter({
      name: 'WIDTH',
      displayName: 'Stirrup Width',
      value: p.width,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.GEOMETRY,
      targetRef: { objectId: rebar.id, property: 'width' }
    }));
  }
  if (p.height !== undefined) {
    params.push(createParameter({
      name: 'HEIGHT',
      displayName: 'Stirrup Height',
      value: p.height,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.GEOMETRY,
      targetRef: { objectId: rebar.id, property: 'height' }
    }));
  }
  if (p.offset !== undefined) {
    params.push(createParameter({
      name: 'OFFSET',
      displayName: 'Crank Offset',
      value: p.offset,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.GEOMETRY,
      targetRef: { objectId: rebar.id, property: 'offset' }
    }));
  }

  // 3. BENDING PARAMETERS
  if (p.bendRadius !== undefined && p.bendRadius > 0) {
    params.push(createParameter({
      name: 'BEND_RADIUS',
      displayName: 'Bend Radius (R)',
      value: p.bendRadius,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.BENDING,
      targetRef: { objectId: rebar.id, property: 'bendRadius' }
    }));
  }
  if (p.bendAngle !== undefined) {
    params.push(createParameter({
      name: 'BEND_ANGLE',
      displayName: 'Bend Angle',
      value: p.bendAngle,
      unit: '°',
      type: PARAMETER_TYPES.ANGLE,
      category: PARAMETER_CATEGORIES.BENDING,
      targetRef: { objectId: rebar.id, property: 'bendAngle' }
    }));
  }

  // 4. HOOK PARAMETERS
  if (p.hookAngle !== undefined) {
    params.push(createParameter({
      name: 'HOOK_ANGLE',
      displayName: 'Hook Angle',
      value: p.hookAngle,
      unit: '°',
      type: PARAMETER_TYPES.ANGLE,
      category: PARAMETER_CATEGORIES.HOOK,
      targetRef: { objectId: rebar.id, property: 'hookAngle' }
    }));
  }
  if (p.hookExtension !== undefined) {
    params.push(createParameter({
      name: 'HOOK_EXTENSION',
      displayName: 'Hook Extension',
      value: p.hookExtension,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.HOOK,
      targetRef: { objectId: rebar.id, property: 'hookExtension' }
    }));
  }

  return params;
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. REBAR CANVAS RENDERING (Visual Bar Thickness + Centerline + Mandrels)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Render Rebar Geometry on Canvas with actual Bar Diameter Thickness and smooth rounded corners
 */
export function renderRebarObject(ctx, rebar, viewport, isSelected = false, showCenterline = true) {
  if (!rebar || !rebar.centerline) return;

  const dia = rebar.diameter || 16;
  const visualThickness = Math.max(3, dia * viewport.zoom);
  const strokeColor = isSelected ? '#38bdf8' : (rebar.color || '#0284c7');
  const bendRadius = Number(rebar.bendRadius) || 0;
  const rScreen = Math.max(0, bendRadius * viewport.zoom);

  const pts = rebar.centerline.points || [];
  if (pts.length < 2) return;

  const screenPts = pts.map(p => worldToScreen(p.x, p.y, viewport));

  const tracePath = () => {
    ctx.beginPath();
    if (screenPts.length === 2 || rScreen <= 1) {
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y);
      }
    } else {
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length - 1; i++) {
        ctx.arcTo(screenPts[i].x, screenPts[i].y, screenPts[i + 1].x, screenPts[i + 1].y, rScreen);
      }
      ctx.lineTo(screenPts[screenPts.length - 1].x, screenPts[screenPts.length - 1].y);
    }
  };

  ctx.save();

  // 1. DRAW VISUAL REBAR BODY (True Engineering Thickness with Rounded Corners)
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = visualThickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tracePath();
  ctx.stroke();

  // 2. DRAW ENGINEERING CENTERLINE (Amber Core Axis)
  if (showCenterline) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 3]);
    tracePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4. DRAW SELECTION OUTLINE / BADGE
  if (isSelected) {
    const pts = rebar.centerline.points || [];
    if (pts.length > 0) {
      // Draw semantic grips at endpoints
      pts.forEach((pt, i) => {
        const s = worldToScreen(pt.x, pt.y, viewport);
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
        ctx.strokeRect(s.x - 4, s.y - 4, 8, 8);
      });

      // Semantic Label Header Badge
      const firstPt = screenPts[0];
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      const label = `${rebar.name || 'Rebar'} Ø${dia}`;
      ctx.font = 'bold 11px system-ui, sans-serif';
      const textW = ctx.measureText(label).width;
      ctx.fillRect(firstPt.x - 6, firstPt.y - 24, textW + 12, 18);
      ctx.strokeRect(firstPt.x - 6, firstPt.y - 24, textW + 12, 18);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(label, firstPt.x, firstPt.y - 11);
    }
  }

  ctx.restore();
}

/**
 * Hit test for Rebar shapes taking Bar Diameter thickness into account
 */
export function hitTestRebar(rebar, worldX, worldY, tolerance = 10) {
  if (!rebar || !rebar.centerline) return false;
  const dia = rebar.diameter || 16;
  const captureDist = Math.max(tolerance, dia / 2 + 5);

  const pts = rebar.centerline.points || [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    let dist = 0;
    if (lenSq === 0) {
      dist = Math.hypot(worldX - p1.x, worldY - p1.y);
    } else {
      let t = ((worldX - p1.x) * dx + (worldY - p1.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      dist = Math.hypot(worldX - projX, worldY - projY);
    }

    if (dist <= captureDist) {
      return true;
    }
  }

  return false;
}
