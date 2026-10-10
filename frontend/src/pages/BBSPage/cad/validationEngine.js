/**
 * RebarOptima Phase 2F — Engineering & Geometric Validation Engine
 * 
 * Performs deterministic validation on Rebar Geometry, Parameters, Continuity,
 * Closed Loops, Bend Radii, and Self-Intersections.
 * 
 * Severity Levels:
 * - 'error'   : Invalidates the calculation (status = 'INVALID', no trusted cutting length)
 * - 'warning' : Calculation proceeds with advisory notice (e.g. tight bend radius or warning)
 * - 'info'    : Informational engineering metadata (e.g. bend count, hook count)
 */

import { generateId } from './geometry';

export const VALIDATION_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

export const VALIDATION_CODES = {
  // Errors
  MISSING_GEOMETRY: 'MISSING_GEOMETRY',
  INVALID_DIAMETER: 'INVALID_DIAMETER',
  INVALID_LENGTH: 'INVALID_LENGTH',
  INVALID_RADIUS: 'INVALID_RADIUS',
  INVALID_ANGLE: 'INVALID_ANGLE',
  PATH_DISCONTINUOUS: 'PATH_DISCONTINUOUS',
  CLOSED_SHAPE_OPEN: 'CLOSED_SHAPE_OPEN',
  ORPHAN_REFERENCE: 'ORPHAN_REFERENCE',
  
  // Warnings
  TIGHT_BEND_RADIUS: 'TIGHT_BEND_RADIUS',
  LARGE_BEND_RADIUS: 'LARGE_BEND_RADIUS',
  SHORT_HOOK_EXTENSION: 'SHORT_HOOK_EXTENSION',
  POTENTIAL_SELF_INTERSECTION: 'POTENTIAL_SELF_INTERSECTION',
  
  // Info
  SHAPE_METRICS: 'SHAPE_METRICS'
};

/**
 * Creates a structured validation result object
 */
export function createValidationResult({
  id = generateId('val'),
  severity = VALIDATION_SEVERITY.INFO,
  code = VALIDATION_CODES.SHAPE_METRICS,
  message = '',
  geometryReferences = [],
  parameterReferences = [],
  details = null
} = {}) {
  return {
    id,
    severity,
    code,
    message,
    geometryReferences,
    parameterReferences,
    details
  };
}

/**
 * Determines whether two 2D points are coincident within tolerance (mm)
 */
function pointsCoincident(p1, p2, tol = 0.5) {
  if (!p1 || !p2) return false;
  return Math.hypot(p1.x - p2.x, p1.y - p2.y) <= tol;
}

/**
 * Checks for line segment intersection between (p1-p2) and (p3-p4)
 * Returns true if lines cross (excluding endpoints)
 */
function segmentsIntersect(p1, p2, p3, p4) {
  const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  
  // Exclude connected adjacent endpoints
  if (pointsCoincident(p1, p3) || pointsCoincident(p1, p4) ||
      pointsCoincident(p2, p3) || pointsCoincident(p2, p4)) {
    return false;
  }

  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN VALIDATION PIPELINE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Validates rebar geometry, parameters, continuity, closure, and bend properties.
 * 
 * @param {object} rebar Rebar entity with centerline, parameters, etc.
 * @param {object} ruleSet Selected engineering rule set
 * @returns {Array<object>} List of ValidationResult objects
 */
export function validateRebarEngineering(rebar, ruleSet = null) {
  const results = [];

  if (!rebar) {
    results.push(createValidationResult({
      severity: VALIDATION_SEVERITY.ERROR,
      code: VALIDATION_CODES.MISSING_GEOMETRY,
      message: 'No rebar geometry provided for engineering validation.'
    }));
    return results;
  }

  const dia = Number(rebar.diameter);
  const centerline = rebar.centerline || {};
  const points = centerline.points || [];
  const segments = centerline.segments || [];
  const bends = centerline.bends || [];
  const hooks = centerline.hooks || [];
  const params = rebar.parameters || {};

  // 1. DIAMETER VALIDATION
  if (isNaN(dia) || dia <= 0) {
    results.push(createValidationResult({
      severity: VALIDATION_SEVERITY.ERROR,
      code: VALIDATION_CODES.INVALID_DIAMETER,
      message: `Bar diameter must be a positive number greater than 0 (provided: ${dia} mm).`,
      geometryReferences: [rebar.id],
      parameterReferences: ['diameter']
    }));
  } else if (dia > 60) {
    results.push(createValidationResult({
      severity: VALIDATION_SEVERITY.WARNING,
      code: VALIDATION_CODES.INVALID_DIAMETER,
      message: `Large bar diameter (Ø${dia} mm). Standard structural reinforcement is typically ≤ 40 mm.`,
      geometryReferences: [rebar.id],
      parameterReferences: ['diameter']
    }));
  }

  // 2. GEOMETRY & POINTS CHECK
  if (points.length < 2 && segments.length === 0) {
    results.push(createValidationResult({
      severity: VALIDATION_SEVERITY.ERROR,
      code: VALIDATION_CODES.MISSING_GEOMETRY,
      message: 'Rebar path requires at least 2 vertices or 1 segment.',
      geometryReferences: [rebar.id]
    }));
    return results;
  }

  // 3. SEGMENT LENGTH VALIDATION
  segments.forEach((seg, idx) => {
    const len = Number(seg.length);
    if (isNaN(len) || len <= 0) {
      results.push(createValidationResult({
        severity: VALIDATION_SEVERITY.ERROR,
        code: VALIDATION_CODES.INVALID_LENGTH,
        message: `Segment ${seg.name || idx + 1} has invalid length (${len} mm). Must be positive.`,
        geometryReferences: [seg.id || `${rebar.id}_seg${idx}`],
        parameterReferences: seg.name ? [seg.name] : []
      }));
    }
  });

  // 4. BEND RADIUS & ANGLE VALIDATION
  bends.forEach((b, idx) => {
    const radius = Number(b.radius);
    const angle = Number(b.bendAngleDeg);

    if (isNaN(radius) || radius <= 0) {
      results.push(createValidationResult({
        severity: VALIDATION_SEVERITY.ERROR,
        code: VALIDATION_CODES.INVALID_RADIUS,
        message: `Bend ${idx + 1} radius must be greater than 0 (provided: ${radius} mm).`,
        geometryReferences: [b.id || `bend_${idx}`]
      }));
    } else if (dia > 0 && radius < (dia * 1.5)) {
      results.push(createValidationResult({
        severity: VALIDATION_SEVERITY.WARNING,
        code: VALIDATION_CODES.TIGHT_BEND_RADIUS,
        message: `Bend ${idx + 1} radius (${radius.toFixed(1)} mm) is less than minimum standard mandrel radius (1.5 × Ø${dia} = ${(dia * 1.5).toFixed(1)} mm). Risk of bar fracture during bending.`,
        geometryReferences: [b.id || `bend_${idx}`]
      }));
    }

    if (isNaN(angle) || angle <= 0 || angle > 180) {
      results.push(createValidationResult({
        severity: VALIDATION_SEVERITY.ERROR,
        code: VALIDATION_CODES.INVALID_ANGLE,
        message: `Bend ${idx + 1} angle must be between 0° and 180° (provided: ${angle}°).`,
        geometryReferences: [b.id || `bend_${idx}`]
      }));
    }
  });

  // 5. HOOK VALIDATION
  hooks.forEach((hk, idx) => {
    const angle = Number(hk.angle);
    const ext = Number(hk.extension);

    if (isNaN(ext) || ext <= 0) {
      results.push(createValidationResult({
        severity: VALIDATION_SEVERITY.ERROR,
        code: VALIDATION_CODES.INVALID_LENGTH,
        message: `Hook ${idx + 1} extension must be positive (provided: ${ext} mm).`,
        geometryReferences: [hk.id || `hook_${idx}`]
      }));
    } else if (dia > 0 && ext < (4 * dia)) {
      results.push(createValidationResult({
        severity: VALIDATION_SEVERITY.WARNING,
        code: VALIDATION_CODES.SHORT_HOOK_EXTENSION,
        message: `Hook ${idx + 1} straight extension (${ext.toFixed(1)} mm) is less than standard minimum (4d = ${4 * dia} mm for Ø${dia}).`,
        geometryReferences: [hk.id || `hook_${idx}`]
      }));
    }
  });

  // 6. CONTINUITY VALIDATION (Tolerance = 0.5 mm)
  if (segments.length > 1) {
    for (let i = 0; i < segments.length - 1; i++) {
      const seg1 = segments[i];
      const seg2 = segments[i + 1];

      // If there's a bend between them, verify segment1.end connects to bend.t1, and bend.t2 connects to segment2.start
      // Or if direct points, verify seg1.end == seg2.start
      const end1 = seg1.end;
      const start2 = seg2.start;

      // Check if there is an intervening bend
      const intermediateBend = bends[i];
      if (intermediateBend && intermediateBend.t1 && intermediateBend.t2) {
        const conn1 = pointsCoincident(end1, intermediateBend.t1, 1.0);
        const conn2 = pointsCoincident(intermediateBend.t2, start2, 1.0);
        if (!conn1 || !conn2) {
          results.push(createValidationResult({
            severity: VALIDATION_SEVERITY.WARNING,
            code: VALIDATION_CODES.PATH_DISCONTINUOUS,
            message: `Rebar path continuity check: Small gap detected between ${seg1.name || 'Segment ' + (i + 1)} and ${seg2.name || 'Segment ' + (i + 2)}.`,
            geometryReferences: [seg1.id, seg2.id]
          }));
        }
      } else {
        // Direct segment-to-segment continuity
        if (!pointsCoincident(end1, start2, 1.0)) {
          // If shape is stirrup with dual hooks overlapping at vertex, allow hook overlap
          const isStirrupHook = (rebar.shapeType === 'closed_stirrup' && (i === 0 || i === segments.length - 2));
          if (!isStirrupHook) {
            results.push(createValidationResult({
              severity: VALIDATION_SEVERITY.WARNING,
              code: VALIDATION_CODES.PATH_DISCONTINUOUS,
              message: `Rebar path is not continuous between ${seg1.name || 'Segment ' + (i + 1)} and ${seg2.name || 'Segment ' + (i + 2)}.`,
              geometryReferences: [seg1.id, seg2.id]
            }));
          }
        }
      }
    }
  }

  // 7. CLOSED SHAPE VALIDATION
  if (rebar.shapeType === 'closed_stirrup') {
    // For closed stirrups, the perimeter legs (top, right, bottom, left) must form a closed loop
    const perimeterSegs = segments.filter(s => s.id && !s.id.includes('hk'));
    if (perimeterSegs.length >= 4) {
      const firstStart = perimeterSegs[0].start;
      const lastEnd = perimeterSegs[perimeterSegs.length - 1].end;
      if (!pointsCoincident(firstStart, lastEnd, 2.0)) {
        results.push(createValidationResult({
          severity: VALIDATION_SEVERITY.ERROR,
          code: VALIDATION_CODES.CLOSED_SHAPE_OPEN,
          message: 'Closed Stirrup loop is not closed. Start and end vertices do not meet.',
          geometryReferences: [rebar.id]
        }));
      }
    }
  }

  // 8. SELF-INTERSECTION VALIDATION (Except intentional stirrup corner hooks)
  if (segments.length >= 4 && rebar.shapeType !== 'closed_stirrup') {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 2; j < segments.length; j++) {
        if (segmentsIntersect(segments[i].start, segments[i].end, segments[j].start, segments[j].end)) {
          results.push(createValidationResult({
            severity: VALIDATION_SEVERITY.WARNING,
            code: VALIDATION_CODES.POTENTIAL_SELF_INTERSECTION,
            message: `Geometric self-intersection detected between ${segments[i].name || 'Segment ' + (i + 1)} and ${segments[j].name || 'Segment ' + (j + 1)}.`,
            geometryReferences: [segments[i].id, segments[j].id]
          }));
        }
      }
    }
  }

  // 9. SUMMARY INFO METRICS
  results.push(createValidationResult({
    severity: VALIDATION_SEVERITY.INFO,
    code: VALIDATION_CODES.SHAPE_METRICS,
    message: `Shape profile parsed: ${segments.length} segment(s), ${bends.length} bend(s), ${hooks.length} hook(s).`,
    geometryReferences: [rebar.id]
  }));

  return results;
}
