import { PARAMETER_TYPES, PARAMETER_CATEGORIES } from './types';
import { updateRebarGeometry } from './rebarEngine';

/**
 * RebarOptima Parameter Engine (Phase 2C)
 * Generic Parametric Engine for Rebar Shapes and Parametric Blocks.
 */

export function generateParamId(prefix = 'param') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

export function sanitizeParamName(name) {
  if (!name) return 'PARAM';
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Parameter Factory
 */
export function createParameter(options = {}) {
  const name = sanitizeParamName(options.name || 'PARAM_1');
  const type = options.type || PARAMETER_TYPES.LENGTH;
  const unit = options.unit || (type === PARAMETER_TYPES.ANGLE ? 'deg' : 'mm');
  const category = options.category || PARAMETER_CATEGORIES.GEOMETRY;

  return {
    id: options.id || generateParamId(),
    name,
    displayName: options.displayName || options.name || name,
    value: typeof options.value === 'number' ? options.value : 100,
    unit,
    type,
    category,
    description: options.description || '',
    targetRef: options.targetRef || null, // { objectId: string, property: 'width' | 'height' | 'radius' | 'length' | 'angle' }
    expression: options.expression || null // Future formula foundation (Phase 2D)
  };
}

/**
 * Parameter Validation
 */
export function validateParameter(param, existingParams = []) {
  if (!param.name || param.name.trim().length === 0) {
    return { valid: false, message: 'Parameter name cannot be empty.' };
  }

  // Check duplicate names
  const isDuplicate = existingParams.some(p => p.id !== param.id && p.name.toUpperCase() === param.name.toUpperCase());
  if (isDuplicate) {
    return { valid: false, message: `Parameter name "${param.name}" already exists.` };
  }

  if (typeof param.value !== 'number' || isNaN(param.value)) {
    return { valid: false, message: 'Parameter value must be a valid number.' };
  }

  if (param.type === PARAMETER_TYPES.LENGTH && param.value <= 0) {
    return { valid: false, message: 'Length parameter must be greater than 0 mm.' };
  }

  if (param.type === PARAMETER_TYPES.ANGLE && (param.value < 0 || param.value > 360)) {
    return { valid: false, message: 'Angle parameter must be between 0° and 360°.' };
  }

  return { valid: true };
}

/**
 * Apply Parameter values directly to linked Geometry Objects (Parameter -> Geometry)
 */
export function applyParametersToGeometry(objects, parameters) {
  if (!parameters || parameters.length === 0 || !objects || objects.length === 0) {
    return objects;
  }

  const updatedObjects = JSON.parse(JSON.stringify(objects));

  parameters.forEach(param => {
    if (!param.targetRef || !param.targetRef.objectId) return;

    const targetObj = updatedObjects.find(o => o.id === param.targetRef.objectId);
    if (!targetObj) return;

    const prop = param.targetRef.property;
    const val = param.value;

    switch (targetObj.type) {
      case 'rectangle':
        if (prop === 'width') targetObj.width = Math.max(1, val);
        else if (prop === 'height') targetObj.height = Math.max(1, val);
        break;

      case 'circle':
        if (prop === 'radius') {
          targetObj.radius = Math.max(1, val);
        } else if (prop === 'diameter') {
          targetObj.radius = Math.max(1, val / 2);
        }
        break;

      case 'line':
        if (prop === 'length') {
          const p1 = targetObj.p1 || { x: targetObj.x1, y: targetObj.y1 };
          const p2 = targetObj.p2 || { x: targetObj.x2, y: targetObj.y2 };
          const currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const newLen = Math.max(1, val);
          targetObj.p2 = {
            x: p1.x + Math.cos(currentAngle) * newLen,
            y: p1.y + Math.sin(currentAngle) * newLen
          };
          if (targetObj.x2 !== undefined) {
            targetObj.x2 = targetObj.p2.x;
            targetObj.y2 = targetObj.p2.y;
          }
        } else if (prop === 'angle') {
          const p1 = targetObj.p1 || { x: targetObj.x1, y: targetObj.y1 };
          const p2 = targetObj.p2 || { x: targetObj.x2, y: targetObj.y2 };
          const currentLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const angleRad = (val * Math.PI) / 180;
          targetObj.p2 = {
            x: p1.x + Math.cos(angleRad) * currentLen,
            y: p1.y + Math.sin(angleRad) * currentLen
          };
          if (targetObj.x2 !== undefined) {
            targetObj.x2 = targetObj.p2.x;
            targetObj.y2 = targetObj.p2.y;
          }
        }
        break;

      case 'rebar': {
        const recomputed = updateRebarGeometry(targetObj, { [prop]: val });
        Object.assign(targetObj, recomputed);
        break;
      }
    }
  });

  return updatedObjects;
}

/**
 * Synchronize Geometry changes back to linked Parameters (Geometry -> Parameter)
 */
export function syncGeometryToParameters(updatedObject, parameters) {
  if (!updatedObject || !parameters || parameters.length === 0) {
    return parameters;
  }

  let hasChanges = false;
  const updatedParams = parameters.map(param => {
    if (!param.targetRef || param.targetRef.objectId !== updatedObject.id) {
      return param;
    }

    const prop = param.targetRef.property;
    let newVal = param.value;

    if (updatedObject.type === 'rectangle') {
      if (prop === 'width' && updatedObject.width !== undefined) newVal = updatedObject.width;
      else if (prop === 'height' && updatedObject.height !== undefined) newVal = updatedObject.height;
    } else if (updatedObject.type === 'circle') {
      if (prop === 'radius' && updatedObject.radius !== undefined) newVal = updatedObject.radius;
      else if (prop === 'diameter' && updatedObject.radius !== undefined) newVal = updatedObject.radius * 2;
    } else if (updatedObject.type === 'line') {
      const p1 = updatedObject.p1 || { x: updatedObject.x1, y: updatedObject.y1 };
      const p2 = updatedObject.p2 || { x: updatedObject.x2, y: updatedObject.y2 };
      if (prop === 'length') newVal = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      else if (prop === 'angle') newVal = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI + 360) % 360;
    } else if (updatedObject.type === 'rebar') {
      if (updatedObject.parameters && updatedObject.parameters[prop] !== undefined) {
        newVal = updatedObject.parameters[prop];
      }
    }

    if (newVal !== param.value) {
      hasChanges = true;
      return { ...param, value: Number(newVal.toFixed(2)) };
    }
    return param;
  });

  return hasChanges ? updatedParams : parameters;
}
