import { CONSTRAINT_TYPES, CONSTRAINT_STATUS, SOLVER_CONFIG } from './types';

/**
 * RebarOptima Parametric Constraint Engine (Phase 2D)
 * Pure, deterministic 2D geometric constraint solver specifically designed for Rebar/BBS shape creation.
 */

export function generateConstraintId(prefix = 'cst') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Constraint Factory
 */
export function createConstraint(options = {}) {
  const type = options.type || CONSTRAINT_TYPES.HORIZONTAL;
  return {
    id: options.id || generateConstraintId(),
    type,
    references: options.references || [], // [{ objectId, subTarget: 'p1'|'p2'|'center'|'start'|'end'|'line'|'whole', pointIndex }]
    value: options.value !== undefined ? options.value : null,
    parameterId: options.parameterId || null,
    parameterName: options.parameterName || null,
    enabled: options.enabled !== undefined ? options.enabled : true,
    status: CONSTRAINT_STATUS.VALID,
    message: '',
    metadata: options.metadata || {}
  };
}

/**
 * Constraint Validation & Conflict Checking
 */
export function validateConstraint(newConstraint, existingConstraints = [], objects = []) {
  if (!newConstraint.references || newConstraint.references.length === 0) {
    return { valid: false, message: 'Constraint must reference at least one geometric entity.' };
  }

  // Ensure all referenced objects exist
  for (const ref of newConstraint.references) {
    const exists = objects.some(o => o.id === ref.objectId);
    if (!exists) {
      return { valid: false, message: `Referenced object ${ref.objectId} does not exist.` };
    }
  }

  // Conflict Check: Horizontal + Vertical on the same line
  if (newConstraint.type === CONSTRAINT_TYPES.HORIZONTAL || newConstraint.type === CONSTRAINT_TYPES.VERTICAL) {
    const targetId = newConstraint.references[0].objectId;
    const opposingType = newConstraint.type === CONSTRAINT_TYPES.HORIZONTAL
      ? CONSTRAINT_TYPES.VERTICAL
      : CONSTRAINT_TYPES.HORIZONTAL;

    const conflict = existingConstraints.find(c =>
      c.enabled &&
      c.id !== newConstraint.id &&
      c.type === opposingType &&
      c.references.some(r => r.objectId === targetId)
    );

    if (conflict) {
      return {
        valid: false,
        conflict: true,
        message: `Constraint conflict: A line cannot be both Horizontal and Vertical.`
      };
    }
  }

  // Conflict Check: Parallel + Perpendicular on the same pair of lines
  if (newConstraint.type === CONSTRAINT_TYPES.PARALLEL || newConstraint.type === CONSTRAINT_TYPES.PERPENDICULAR) {
    if (newConstraint.references.length >= 2) {
      const id1 = newConstraint.references[0].objectId;
      const id2 = newConstraint.references[1].objectId;
      const opposingType = newConstraint.type === CONSTRAINT_TYPES.PARALLEL
        ? CONSTRAINT_TYPES.PERPENDICULAR
        : CONSTRAINT_TYPES.PARALLEL;

      const conflict = existingConstraints.find(c =>
        c.enabled &&
        c.id !== newConstraint.id &&
        c.type === opposingType &&
        c.references.some(r => r.objectId === id1) &&
        c.references.some(r => r.objectId === id2)
      );

      if (conflict) {
        return {
          valid: false,
          conflict: true,
          message: `Constraint conflict: Two lines cannot be both Parallel and Perpendicular.`
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Degrees of Freedom (DOF) Estimator
 */
export function calculateDegreesOfFreedom(objects, constraints) {
  if (!objects || objects.length === 0) {
    return { totalDOF: 0, status: 'empty', activeConstraints: 0 };
  }

  let totalVariables = 0;
  objects.forEach(obj => {
    switch (obj.type) {
      case 'line':
        totalVariables += 4; // x1, y1, x2, y2
        break;
      case 'rectangle':
        totalVariables += 4; // x, y, width, height
        break;
      case 'circle':
        totalVariables += 3; // cx, cy, radius
        break;
      case 'arc':
        totalVariables += 6; // start(x,y), mid(x,y), end(x,y)
        break;
      case 'polyline':
        totalVariables += (obj.points || []).length * 2;
        break;
      default:
        totalVariables += 2;
    }
  });

  const activeConstraints = (constraints || []).filter(c => c.enabled && c.status !== CONSTRAINT_STATUS.SUPPRESSED);

  let removedDOF = 0;
  activeConstraints.forEach(c => {
    switch (c.type) {
      case CONSTRAINT_TYPES.FIXED:
        removedDOF += 2; // Locks X and Y
        break;
      case CONSTRAINT_TYPES.COINCIDENT:
        removedDOF += 2; // Eliminates dx and dy
        break;
      case CONSTRAINT_TYPES.HORIZONTAL:
      case CONSTRAINT_TYPES.VERTICAL:
      case CONSTRAINT_TYPES.PARALLEL:
      case CONSTRAINT_TYPES.PERPENDICULAR:
      case CONSTRAINT_TYPES.EQUAL:
      case CONSTRAINT_TYPES.DISTANCE:
      case CONSTRAINT_TYPES.ANGLE:
      case CONSTRAINT_TYPES.RADIUS:
      case CONSTRAINT_TYPES.DIAMETER:
        removedDOF += 1;
        break;
      default:
        removedDOF += 1;
    }
  });

  const remainingDOF = Math.max(0, totalVariables - removedDOF);
  let status = 'under-constrained';
  if (remainingDOF === 0) status = 'fully-constrained';
  if (totalVariables - removedDOF < 0) status = 'over-constrained';

  return {
    totalDOF: remainingDOF,
    totalVariables,
    removedDOF,
    activeConstraints: activeConstraints.length,
    status
  };
}

/**
 * Core Parametric Constraint Solver (Relaxation & Projection Method)
 */
export function solveConstraints(objects, constraints = [], parameters = []) {
  if (!objects || objects.length === 0) {
    return { success: true, objects: [], constraints: [] };
  }

  // Deep clone geometry objects for safe solving
  const solved = JSON.parse(JSON.stringify(objects));
  const updatedConstraints = JSON.parse(JSON.stringify(constraints || []));

  // 1. Sync Parameter values into bound constraints
  if (parameters && parameters.length > 0) {
    updatedConstraints.forEach(c => {
      if (c.parameterId) {
        const param = parameters.find(p => p.id === c.parameterId || p.name === c.parameterName);
        if (param) {
          c.value = param.value;
        }
      }
    });
  }

  const active = updatedConstraints.filter(c => c.enabled && c.status !== CONSTRAINT_STATUS.SUPPRESSED);
  if (active.length === 0) {
    return { success: true, objects: solved, constraints: updatedConstraints };
  }

  const maxIter = SOLVER_CONFIG.maxIterations || 40;
  const tol = SOLVER_CONFIG.linearTolerance || 1e-3;

  let converged = false;
  let iteration = 0;

  while (iteration < maxIter && !converged) {
    let maxDelta = 0;

    for (const c of active) {
      const delta = applySingleConstraint(c, solved);
      if (delta > maxDelta) maxDelta = delta;
    }

    if (maxDelta < tol) {
      converged = true;
    }
    iteration++;
  }

  // 2. Normalize and validate solved geometry entities
  let allValid = true;
  for (const obj of solved) {
    if (obj.type === 'line') {
      if (isNaN(obj.p1.x) || isNaN(obj.p1.y) || isNaN(obj.p2.x) || isNaN(obj.p2.y)) allValid = false;
      obj.x1 = obj.p1.x;
      obj.y1 = obj.p1.y;
      obj.x2 = obj.p2.x;
      obj.y2 = obj.p2.y;
    } else if (obj.type === 'rectangle') {
      if (isNaN(obj.x) || isNaN(obj.y) || isNaN(obj.width) || isNaN(obj.height)) allValid = false;
      obj.width = Math.max(0.1, obj.width);
      obj.height = Math.max(0.1, obj.height);
    } else if (obj.type === 'circle') {
      if (isNaN(obj.center.x) || isNaN(obj.center.y) || isNaN(obj.radius)) allValid = false;
      obj.cx = obj.center.x;
      obj.cy = obj.center.y;
      obj.radius = Math.max(0.1, obj.radius);
    }
  }

  return {
    success: allValid,
    objects: solved,
    constraints: updatedConstraints,
    iterations: iteration,
    converged
  };
}

/**
 * Single Constraint Projection Step
 */
function applySingleConstraint(constraint, objects) {
  let delta = 0;
  const refs = constraint.references || [];
  if (refs.length === 0) return 0;

  const obj1 = objects.find(o => o.id === refs[0]?.objectId);
  const obj2 = refs.length > 1 ? objects.find(o => o.id === refs[1]?.objectId) : null;

  if (!obj1) {
    constraint.status = CONSTRAINT_STATUS.UNRESOLVED;
    return 0;
  }

  constraint.status = CONSTRAINT_STATUS.VALID;

  switch (constraint.type) {
    case CONSTRAINT_TYPES.HORIZONTAL: {
      if (obj1.type === 'line') {
        const dy = obj1.p2.y - obj1.p1.y;
        delta = Math.abs(dy);
        const yAvg = (obj1.p1.y + obj1.p2.y) / 2;
        obj1.p1.y = yAvg;
        obj1.p2.y = yAvg;
      }
      break;
    }

    case CONSTRAINT_TYPES.VERTICAL: {
      if (obj1.type === 'line') {
        const dx = obj1.p2.x - obj1.p1.x;
        delta = Math.abs(dx);
        const xAvg = (obj1.p1.x + obj1.p2.x) / 2;
        obj1.p1.x = xAvg;
        obj1.p2.x = xAvg;
      }
      break;
    }

    case CONSTRAINT_TYPES.COINCIDENT: {
      if (refs.length >= 2 && obj2) {
        const pt1 = getPointFromRef(obj1, refs[0]);
        const pt2 = getPointFromRef(obj2, refs[1]);
        if (pt1 && pt2) {
          const dx = pt2.x - pt1.x;
          const dy = pt2.y - pt1.y;
          delta = Math.hypot(dx, dy);
          const midX = (pt1.x + pt2.x) / 2;
          const midY = (pt1.y + pt2.y) / 2;
          pt1.x = midX;
          pt1.y = midY;
          pt2.x = midX;
          pt2.y = midY;
        }
      }
      break;
    }

    case CONSTRAINT_TYPES.DISTANCE: {
      const targetDist = typeof constraint.value === 'number' ? Math.max(0.1, constraint.value) : 100;
      if (obj1.type === 'line') {
        const currentDist = Math.hypot(obj1.p2.x - obj1.p1.x, obj1.p2.y - obj1.p1.y);
        delta = Math.abs(currentDist - targetDist);
        if (currentDist > 1e-6) {
          const ratio = targetDist / currentDist;
          const midX = (obj1.p1.x + obj1.p2.x) / 2;
          const midY = (obj1.p1.y + obj1.p2.y) / 2;
          const halfDx = ((obj1.p2.x - obj1.p1.x) * ratio) / 2;
          const halfDy = ((obj1.p2.y - obj1.p1.y) * ratio) / 2;
          obj1.p1.x = midX - halfDx;
          obj1.p1.y = midY - halfDy;
          obj1.p2.x = midX + halfDx;
          obj1.p2.y = midY + halfDy;
        }
      } else if (obj1.type === 'rectangle') {
        const sub = refs[0].subTarget;
        if (sub === 'width') {
          delta = Math.abs(obj1.width - targetDist);
          obj1.width = targetDist;
        } else if (sub === 'height') {
          delta = Math.abs(obj1.height - targetDist);
          obj1.height = targetDist;
        }
      }
      break;
    }

    case CONSTRAINT_TYPES.EQUAL: {
      if (obj1 && obj2) {
        if (obj1.type === 'line' && obj2.type === 'line') {
          const len1 = Math.hypot(obj1.p2.x - obj1.p1.x, obj1.p2.y - obj1.p1.y);
          const len2 = Math.hypot(obj2.p2.x - obj2.p1.x, obj2.p2.y - obj2.p1.y);
          delta = Math.abs(len1 - len2);
          const targetLen = (len1 + len2) / 2;

          if (len2 > 1e-6) {
            const ratio2 = targetLen / len2;
            const midX2 = (obj2.p1.x + obj2.p2.x) / 2;
            const midY2 = (obj2.p1.y + obj2.p2.y) / 2;
            const halfDx2 = ((obj2.p2.x - obj2.p1.x) * ratio2) / 2;
            const halfDy2 = ((obj2.p2.y - obj2.p1.y) * ratio2) / 2;
            obj2.p1.x = midX2 - halfDx2;
            obj2.p1.y = midY2 - halfDy2;
            obj2.p2.x = midX2 + halfDx2;
            obj2.p2.y = midY2 + halfDy2;
          }
        } else if (obj1.type === 'circle' && obj2.type === 'circle') {
          delta = Math.abs(obj1.radius - obj2.radius);
          obj2.radius = obj1.radius;
        }
      }
      break;
    }

    case CONSTRAINT_TYPES.PARALLEL: {
      if (obj1.type === 'line' && obj2 && obj2.type === 'line') {
        const angle1 = Math.atan2(obj1.p2.y - obj1.p1.y, obj1.p2.x - obj1.p1.x);
        const len2 = Math.hypot(obj2.p2.x - obj2.p1.x, obj2.p2.y - obj2.p1.y);
        const midX2 = (obj2.p1.x + obj2.p2.x) / 2;
        const midY2 = (obj2.p1.y + obj2.p2.y) / 2;

        const halfDx = (Math.cos(angle1) * len2) / 2;
        const halfDy = (Math.sin(angle1) * len2) / 2;

        delta = Math.hypot(obj2.p2.x - (midX2 + halfDx), obj2.p2.y - (midY2 + halfDy));
        obj2.p1.x = midX2 - halfDx;
        obj2.p1.y = midY2 - halfDy;
        obj2.p2.x = midX2 + halfDx;
        obj2.p2.y = midY2 + halfDy;
      }
      break;
    }

    case CONSTRAINT_TYPES.PERPENDICULAR: {
      if (obj1.type === 'line' && obj2 && obj2.type === 'line') {
        const angle1 = Math.atan2(obj1.p2.y - obj1.p1.y, obj1.p2.x - obj1.p1.x);
        const targetAngle2 = angle1 + Math.PI / 2;
        const len2 = Math.hypot(obj2.p2.x - obj2.p1.x, obj2.p2.y - obj2.p1.y);
        const midX2 = (obj2.p1.x + obj2.p2.x) / 2;
        const midY2 = (obj2.p1.y + obj2.p2.y) / 2;

        const halfDx = (Math.cos(targetAngle2) * len2) / 2;
        const halfDy = (Math.sin(targetAngle2) * len2) / 2;

        delta = Math.hypot(obj2.p2.x - (midX2 + halfDx), obj2.p2.y - (midY2 + halfDy));
        obj2.p1.x = midX2 - halfDx;
        obj2.p1.y = midY2 - halfDy;
        obj2.p2.x = midX2 + halfDx;
        obj2.p2.y = midY2 + halfDy;
      }
      break;
    }

    case CONSTRAINT_TYPES.FIXED: {
      if (constraint.value && typeof constraint.value === 'object') {
        const fixedX = constraint.value.x;
        const fixedY = constraint.value.y;
        if (obj1.type === 'line') {
          const sub = refs[0].subTarget || 'p1';
          if (sub === 'p1') {
            delta = Math.hypot(obj1.p1.x - fixedX, obj1.p1.y - fixedY);
            obj1.p1.x = fixedX;
            obj1.p1.y = fixedY;
          } else {
            delta = Math.hypot(obj1.p2.x - fixedX, obj1.p2.y - fixedY);
            obj1.p2.x = fixedX;
            obj1.p2.y = fixedY;
          }
        } else if (obj1.type === 'circle') {
          delta = Math.hypot(obj1.center.x - fixedX, obj1.center.y - fixedY);
          obj1.center.x = fixedX;
          obj1.center.y = fixedY;
        }
      }
      break;
    }

    case CONSTRAINT_TYPES.RADIUS: {
      if (obj1.type === 'circle') {
        const targetR = typeof constraint.value === 'number' ? Math.max(0.1, constraint.value) : 50;
        delta = Math.abs(obj1.radius - targetR);
        obj1.radius = targetR;
      }
      break;
    }

    case CONSTRAINT_TYPES.DIAMETER: {
      if (obj1.type === 'circle') {
        const targetDia = typeof constraint.value === 'number' ? Math.max(0.2, constraint.value) : 100;
        const targetR = targetDia / 2;
        delta = Math.abs(obj1.radius - targetR);
        obj1.radius = targetR;
      }
      break;
    }

    case CONSTRAINT_TYPES.ANGLE: {
      if (obj1.type === 'line' && obj2 && obj2.type === 'line') {
        const targetAngleDeg = typeof constraint.value === 'number' ? constraint.value : 90;
        const targetAngleRad = (targetAngleDeg * Math.PI) / 180;
        const angle1 = Math.atan2(obj1.p2.y - obj1.p1.y, obj1.p2.x - obj1.p1.x);
        const targetAngle2 = angle1 + targetAngleRad;

        const len2 = Math.hypot(obj2.p2.x - obj2.p1.x, obj2.p2.y - obj2.p1.y);
        const midX2 = (obj2.p1.x + obj2.p2.x) / 2;
        const midY2 = (obj2.p1.y + obj2.p2.y) / 2;

        const halfDx = (Math.cos(targetAngle2) * len2) / 2;
        const halfDy = (Math.sin(targetAngle2) * len2) / 2;

        delta = Math.hypot(obj2.p2.x - (midX2 + halfDx), obj2.p2.y - (midY2 + halfDy));
        obj2.p1.x = midX2 - halfDx;
        obj2.p1.y = midY2 - halfDy;
        obj2.p2.x = midX2 + halfDx;
        obj2.p2.y = midY2 + halfDy;
      }
      break;
    }

    default:
      break;
  }

  return delta;
}

/**
 * Point reference extraction helper
 */
function getPointFromRef(obj, ref) {
  if (!obj) return null;
  const sub = ref.subTarget || 'p1';
  if (obj.type === 'line') {
    return sub === 'p2' ? obj.p2 : obj.p1;
  }
  if (obj.type === 'circle') {
    return obj.center;
  }
  if (obj.type === 'polyline') {
    const idx = ref.pointIndex || 0;
    return obj.points ? obj.points[idx] : null;
  }
  return null;
}

/**
 * Transactional Solving Wrapper (Validate -> Solve -> Commit OR Rollback)
 */
export function solveConstraintsTransactional(objects, constraints = [], parameters = []) {
  const result = solveConstraints(objects, constraints, parameters);
  if (result.success) {
    const dof = calculateDegreesOfFreedom(result.objects, result.constraints);
    return {
      success: true,
      solvedObjects: result.objects,
      updatedConstraints: result.constraints,
      dof,
      diagnostics: 'Constraints solved successfully.'
    };
  } else {
    return {
      success: false,
      originalObjects: objects,
      updatedConstraints: constraints,
      message: 'Failed to solve constraints without corrupting geometry. Reverted to previous valid state.'
    };
  }
}

/**
 * Cleanup orphaned constraints when geometry is deleted
 */
export function cleanOrphanedConstraints(constraints, objects) {
  if (!constraints || constraints.length === 0) return [];
  const validObjIds = new Set(objects.map(o => o.id));

  return constraints.filter(c => {
    if (!c.references || c.references.length === 0) return false;
    return c.references.every(ref => validObjIds.has(ref.objectId));
  });
}

/**
 * Canvas 2D Constraint Glyphs Renderer
 */
export function renderConstraintGlyphs(ctx, constraints, objects, viewport) {
  if (!constraints || constraints.length === 0 || !objects) return;

  const worldToScreenLocal = (x, y) => {
    const centerX = (viewport.width || 800) / 2;
    const centerY = (viewport.height || 600) / 2;
    const zoom = viewport.zoom || 1.0;
    const panX = viewport.panX || 0;
    const panY = viewport.panY || 0;
    return {
      x: centerX + panX + x * zoom,
      y: centerY + panY - y * zoom
    };
  };

  ctx.save();
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  constraints.forEach(c => {
    if (!c.enabled || c.status === CONSTRAINT_STATUS.SUPPRESSED) return;

    const ref = c.references?.[0];
    if (!ref) return;

    const targetObj = objects.find(o => o.id === ref.objectId);
    if (!targetObj) return;

    let glyph = '';
    let badgeColor = '#38bdf8';
    let anchorWorld = { x: 0, y: 0 };

    switch (c.type) {
      case CONSTRAINT_TYPES.HORIZONTAL:
        glyph = '— H —';
        badgeColor = '#38bdf8';
        if (targetObj.type === 'line') {
          anchorWorld = { x: (targetObj.p1.x + targetObj.p2.x) / 2, y: (targetObj.p1.y + targetObj.p2.y) / 2 + 10 };
        }
        break;

      case CONSTRAINT_TYPES.VERTICAL:
        glyph = '│ V │';
        badgeColor = '#38bdf8';
        if (targetObj.type === 'line') {
          anchorWorld = { x: (targetObj.p1.x + targetObj.p2.x) / 2 + 10, y: (targetObj.p1.y + targetObj.p2.y) / 2 };
        }
        break;

      case CONSTRAINT_TYPES.PARALLEL:
        glyph = '//';
        badgeColor = '#22c55e';
        if (targetObj.type === 'line') {
          anchorWorld = { x: (targetObj.p1.x + targetObj.p2.x) / 2, y: (targetObj.p1.y + targetObj.p2.y) / 2 - 10 };
        }
        break;

      case CONSTRAINT_TYPES.PERPENDICULAR:
        glyph = '⊥';
        badgeColor = '#a855f7';
        if (targetObj.type === 'line') {
          anchorWorld = { x: (targetObj.p1.x + targetObj.p2.x) / 2, y: (targetObj.p1.y + targetObj.p2.y) / 2 - 10 };
        }
        break;

      case CONSTRAINT_TYPES.EQUAL:
        glyph = '=';
        badgeColor = '#f59e0b';
        if (targetObj.type === 'line') {
          anchorWorld = { x: (targetObj.p1.x + targetObj.p2.x) / 2, y: (targetObj.p1.y + targetObj.p2.y) / 2 + 12 };
        }
        break;

      case CONSTRAINT_TYPES.FIXED:
        glyph = '🔒';
        badgeColor = '#ef4444';
        if (targetObj.type === 'line') {
          anchorWorld = targetObj.p1;
        } else if (targetObj.type === 'circle') {
          anchorWorld = targetObj.center;
        }
        break;

      case CONSTRAINT_TYPES.COINCIDENT:
        glyph = '●';
        badgeColor = '#10b981';
        if (targetObj.type === 'line') {
          anchorWorld = ref.subTarget === 'p2' ? targetObj.p2 : targetObj.p1;
        }
        break;

      case CONSTRAINT_TYPES.DISTANCE:
        glyph = `↔ ${c.value ? Math.round(c.value) : ''}`;
        badgeColor = '#38bdf8';
        if (targetObj.type === 'line') {
          anchorWorld = { x: (targetObj.p1.x + targetObj.p2.x) / 2, y: (targetObj.p1.y + targetObj.p2.y) / 2 };
        }
        break;

      default:
        glyph = c.type.slice(0, 3).toUpperCase();
        break;
    }

    if (!glyph) return;

    const screenPos = worldToScreenLocal(anchorWorld.x, anchorWorld.y);
    const textWidth = ctx.measureText(glyph).width;
    const badgeW = textWidth + 8;
    const badgeH = 15;

    // Draw background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(screenPos.x - badgeW / 2, screenPos.y - badgeH / 2, badgeW, badgeH, 3);
    ctx.fill();
    ctx.stroke();

    // Draw text glyph
    ctx.fillStyle = badgeColor;
    ctx.fillText(glyph, screenPos.x, screenPos.y);
  });

  ctx.restore();
}
