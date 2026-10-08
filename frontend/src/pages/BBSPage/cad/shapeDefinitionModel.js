/**
 * RebarOptima Phase 2G: Production-Grade Shape Definition, Versioning, and Instance Models
 * 
 * CORE ARCHITECTURAL RULE:
 * Shape Definition ≠ Shape Instance.
 * - Shape Definition: Master reusable parametric template with version history and rules.
 * - Shape Instance: Specific rebar usage on a structural member with parameter overrides & frozen calculation snapshot.
 */

import {
  createStraightBar,
  createLBar,
  createUBar,
  createClosedStirrup,
  createCrankedBar,
  createOpenLink
} from './rebarEngine';
import { createCircleObject } from './geometry';
import { createParameter } from './parameterEngine';
import { createLinearDimension } from './dimensionEngine';
import { CONSTRAINT_TYPES, PARAMETER_TYPES, PARAMETER_CATEGORIES } from './types';
import { calculateRebarShape } from './calculationEngine';

export const SHAPE_CATEGORIES = [
  'All',
  'Straight',
  'L-Bar',
  'U-Bar',
  'Cranked',
  'Hook',
  'Closed Stirrup / Link',
  'Open Link',
  'Custom'
];

export const SHAPE_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  ARCHIVED: 'ARCHIVED'
};

export const SHAPE_OWNERSHIP = {
  STANDARD: 'STANDARD',
  CUSTOM: 'CUSTOM'
};

/**
 * Standard System Rebar Shape Templates
 * Provides structured parametric geometry, default parameters, dimensions & constraints.
 */
export const STANDARD_SHAPE_TEMPLATES = [
  {
    templateId: 'tpl_straight_00',
    shapeCode: 'Shape 00',
    name: 'Straight Bar',
    category: 'Straight',
    description: 'Straight main longitudinal rebar (IS 2502 / BS 8666 Shape 00)',
    tags: ['main-bar', 'longitudinal', 'straight', 'column', 'beam', 'slab'],
    ownership: SHAPE_OWNERSHIP.STANDARD,
    unit: 'mm',
    createModel: () => {
      const rebar = createStraightBar({ length: 1000, diameter: 16, origin: { x: -500, y: 0 } });
      const paramL = createParameter({
        name: 'LENGTH',
        displayName: 'Total Bar Length',
        value: 1000,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'length' }
      });
      const paramD = createParameter({
        name: 'DIAMETER',
        displayName: 'Bar Diameter',
        value: 16,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.REBAR,
        targetRef: { objectId: rebar.id, property: 'diameter' }
      });
      const dimL = createLinearDimension({ x: -500, y: 0 }, { x: 500, y: 0 }, 30, {
        targetObjectId: rebar.id,
        property: 'length',
        parameterId: paramL.id,
        parameterName: 'LENGTH'
      });
      return {
        geometry: { objects: [rebar] },
        parameters: [paramL, paramD],
        dimensions: [dimL],
        constraints: []
      };
    }
  },
  {
    templateId: 'tpl_lbar_11',
    shapeCode: 'Shape 11',
    name: 'L-Bend Bar (90°)',
    category: 'L-Bar',
    description: '90° bent rebar with Leg A and Leg B (BS 8666 / IS 2502 Shape 11)',
    tags: ['l-bar', 'corner', 'beam-anchorage', 'footing'],
    ownership: SHAPE_OWNERSHIP.STANDARD,
    unit: 'mm',
    createModel: () => {
      const rebar = createLBar({ legA: 500, legB: 300, diameter: 16, bendRadius: 32, bendAngle: 90, origin: { x: -250, y: -150 } });
      const paramA = createParameter({
        name: 'LEG_A',
        displayName: 'Leg A Length',
        value: 500,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'legA' }
      });
      const paramB = createParameter({
        name: 'LEG_B',
        displayName: 'Leg B Length',
        value: 300,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'legB' }
      });
      const paramD = createParameter({
        name: 'DIAMETER',
        displayName: 'Bar Diameter',
        value: 16,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.REBAR,
        targetRef: { objectId: rebar.id, property: 'diameter' }
      });
      const paramR = createParameter({
        name: 'BEND_R',
        displayName: 'Mandrel Radius',
        value: 32,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.BENDING,
        targetRef: { objectId: rebar.id, property: 'bendRadius' }
      });
      return {
        geometry: { objects: [rebar] },
        parameters: [paramA, paramB, paramD, paramR],
        dimensions: [],
        constraints: []
      };
    }
  },
  {
    templateId: 'tpl_ubar_21',
    shapeCode: 'Shape 21',
    name: 'U-Hook Bar',
    category: 'U-Bar',
    description: 'Symmetrical U-shaped bar with Base B and dual upright legs (Shape 21)',
    tags: ['u-bar', 'shear-end', 'slab-edge', 'pile-cap'],
    ownership: SHAPE_OWNERSHIP.STANDARD,
    unit: 'mm',
    createModel: () => {
      const rebar = createUBar({ legA: 300, baseB: 500, legC: 300, diameter: 16, bendRadius: 32, origin: { x: -250, y: -150 } });
      const paramA = createParameter({
        name: 'LEG_A',
        displayName: 'Leg A Length',
        value: 300,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'legA' }
      });
      const paramBase = createParameter({
        name: 'BASE_B',
        displayName: 'Base Width',
        value: 500,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'baseB' }
      });
      const paramC = createParameter({
        name: 'LEG_C',
        displayName: 'Leg C Length',
        value: 300,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'legC' }
      });
      const paramD = createParameter({
        name: 'DIAMETER',
        displayName: 'Bar Diameter',
        value: 16,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.REBAR,
        targetRef: { objectId: rebar.id, property: 'diameter' }
      });
      return {
        geometry: { objects: [rebar] },
        parameters: [paramA, paramBase, paramC, paramD],
        dimensions: [],
        constraints: []
      };
    }
  },
  {
    templateId: 'tpl_stirrup_51',
    shapeCode: 'Shape 51',
    name: 'Rectangular Closed Stirrup (135° Hooks)',
    category: 'Closed Stirrup / Link',
    description: 'Seismic closed rectangular tie with dual parallel 135° end hooks and flush outer perimeter (IS 13920 / BS 8666 Shape 51)',
    tags: ['stirrup', 'column-tie', 'beam-link', 'seismic', '135-hook'],
    ownership: SHAPE_OWNERSHIP.STANDARD,
    unit: 'mm',
    createModel: () => {
      const rebar = createClosedStirrup({
        width: 300,
        height: 450,
        diameter: 8,
        bendRadius: 16,
        hookAngle: 135,
        hookExtension: 75,
        origin: { x: -150, y: -225 }
      });
      const paramW = createParameter({
        name: 'WIDTH',
        displayName: 'Stirrup Width (A)',
        value: 300,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'width' }
      });
      const paramH = createParameter({
        name: 'HEIGHT',
        displayName: 'Stirrup Height (B)',
        value: 450,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'height' }
      });
      const paramD = createParameter({
        name: 'DIAMETER',
        displayName: 'Tie Diameter',
        value: 8,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.REBAR,
        targetRef: { objectId: rebar.id, property: 'diameter' }
      });
      const paramHook = createParameter({
        name: 'HOOK_EXT',
        displayName: '135° Hook Tail Length',
        value: 75,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.HOOK,
        targetRef: { objectId: rebar.id, property: 'hookExtension' }
      });
      return {
        geometry: { objects: [rebar] },
        parameters: [paramW, paramH, paramD, paramHook],
        dimensions: [],
        constraints: []
      };
    }
  },
  {
    templateId: 'tpl_crank_41',
    shapeCode: 'Shape 41',
    name: 'Cranked Bar',
    category: 'Cranked',
    description: 'Double bent cranked bar for column step-downs and slab continuity (Shape 41)',
    tags: ['crank', 'column-reduction', 'slab-continuity'],
    ownership: SHAPE_OWNERSHIP.STANDARD,
    unit: 'mm',
    createModel: () => {
      const rebar = createCrankedBar({
        lengthA: 600,
        offset: 80,
        crankAngle: 45,
        lengthC: 600,
        diameter: 16,
        bendRadius: 32,
        origin: { x: -600, y: 0 }
      });
      const paramA = createParameter({
        name: 'LENGTH_A',
        displayName: 'Segment A Length',
        value: 600,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'lengthA' }
      });
      const paramOff = createParameter({
        name: 'OFFSET',
        displayName: 'Crank Offset (h)',
        value: 80,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'offset' }
      });
      const paramC = createParameter({
        name: 'LENGTH_C',
        displayName: 'Segment C Length',
        value: 600,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'lengthC' }
      });
      const paramD = createParameter({
        name: 'DIAMETER',
        displayName: 'Bar Diameter',
        value: 16,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.REBAR,
        targetRef: { objectId: rebar.id, property: 'diameter' }
      });
      return {
        geometry: { objects: [rebar] },
        parameters: [paramA, paramOff, paramC, paramD],
        dimensions: [],
        constraints: []
      };
    }
  },
  {
    templateId: 'tpl_open_link_74',
    shapeCode: 'Shape 74',
    name: 'Open Link / Shear Link',
    category: 'Open Link',
    description: 'Open U-link with opposing hooks for beam web shear and slab ties',
    tags: ['open-link', 'shear-link', 'beam-tie'],
    ownership: SHAPE_OWNERSHIP.STANDARD,
    unit: 'mm',
    createModel: () => {
      const rebar = createOpenLink({
        width: 250,
        height: 350,
        diameter: 10,
        bendRadius: 20,
        hookLength: 80,
        hookAngle: 90,
        origin: { x: -125, y: -175 }
      });
      const paramW = createParameter({
        name: 'WIDTH',
        displayName: 'Link Width',
        value: 250,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'width' }
      });
      const paramH = createParameter({
        name: 'HEIGHT',
        displayName: 'Link Height',
        value: 350,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: rebar.id, property: 'height' }
      });
      const paramD = createParameter({
        name: 'DIAMETER',
        displayName: 'Bar Diameter',
        value: 10,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.REBAR,
        targetRef: { objectId: rebar.id, property: 'diameter' }
      });
      return {
        geometry: { objects: [rebar] },
        parameters: [paramW, paramH, paramD],
        dimensions: [],
        constraints: []
      };
    }
  },
  {
    templateId: 'tpl_circle_77',
    shapeCode: 'Shape 77',
    name: 'Circular Hoop / Spiral',
    category: 'Closed Stirrup / Link',
    description: 'Continuous circular hoop for round columns, piles and piers (Shape 77)',
    tags: ['circular', 'hoop', 'pile', 'round-column', 'spiral'],
    ownership: SHAPE_OWNERSHIP.STANDARD,
    unit: 'mm',
    createModel: () => {
      const circle = createCircleObject({ x: 0, y: 0 }, 150);
      const paramR = createParameter({
        name: 'RADIUS',
        displayName: 'Hoop Radius',
        value: 150,
        unit: 'mm',
        type: PARAMETER_TYPES.LENGTH,
        category: PARAMETER_CATEGORIES.GEOMETRY,
        targetRef: { objectId: circle.id, property: 'radius' }
      });
      return {
        geometry: { objects: [circle] },
        parameters: [paramR],
        dimensions: [],
        constraints: []
      };
    }
  }
];

/**
 * Creates a blank shape definition draft
 */
export function createBlankShapeDefinition(name = 'Untitled Shape', category = 'Custom') {
  const code = `CUSTOM-${Math.floor(100 + Math.random() * 900)}`;
  const versionId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    name,
    code,
    shapeCode: code,
    description: '',
    category,
    subCategory: '',
    ownership: SHAPE_OWNERSHIP.CUSTOM,
    status: SHAPE_STATUS.DRAFT,
    version: '1.0',
    versionId,
    tags: ['custom'],
    unit: 'mm',
    geometry: { objects: [] },
    parameters: [],
    dimensions: [],
    constraints: [],
    calculationRules: { ruleSet: 'RULE_SET_CENTERLINE_EXACT' },
    validationRules: {},
    versions: [
      {
        versionId,
        version: '1.0',
        status: SHAPE_STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        createdBy: 'User',
        changeSummary: 'Initial blank draft',
        geometry: { objects: [] },
        parameters: [],
        dimensions: [],
        constraints: []
      }
    ],
    metadata: {
      unit: 'mm',
      usageCount: 0,
      favorite: false,
      author: 'User'
    }
  };
}

/**
 * Create a Shape Definition from a Standard Template
 */
export function createShapeFromTemplate(templateId, customName = null) {
  const tpl = STANDARD_SHAPE_TEMPLATES.find(t => t.templateId === templateId) || STANDARD_SHAPE_TEMPLATES[0];
  const model = tpl.createModel();
  const code = `CUST-${tpl.shapeCode.replace(/\s+/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
  const versionId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    name: customName || tpl.name,
    code,
    shapeCode: code,
    description: tpl.description,
    category: tpl.category,
    subCategory: '',
    ownership: SHAPE_OWNERSHIP.CUSTOM,
    status: SHAPE_STATUS.DRAFT,
    version: '1.0',
    versionId,
    tags: [...(tpl.tags || []), 'template'],
    unit: tpl.unit || 'mm',
    geometry: model.geometry,
    parameters: model.parameters,
    dimensions: model.dimensions,
    constraints: model.constraints,
    calculationRules: { ruleSet: 'RULE_SET_CENTERLINE_EXACT' },
    validationRules: {},
    versions: [
      {
        versionId,
        version: '1.0',
        status: SHAPE_STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        createdBy: 'User',
        changeSummary: `Created from template ${tpl.name}`,
        geometry: JSON.parse(JSON.stringify(model.geometry)),
        parameters: JSON.parse(JSON.stringify(model.parameters)),
        dimensions: JSON.parse(JSON.stringify(model.dimensions)),
        constraints: JSON.parse(JSON.stringify(model.constraints))
      }
    ],
    metadata: {
      unit: tpl.unit || 'mm',
      usageCount: 0,
      favorite: false,
      templateSource: tpl.templateId
    }
  };
}

/**
 * Create an independent Shape Instance with parameter overrides
 * Shape Definition is NEVER mutated when instance parameters change.
 */
export function createShapeInstance(shapeDef, parameterValues = {}, context = {}) {
  const shapeId = shapeDef._id || shapeDef.id;
  const shapeVersionId = shapeDef.versionId || `v_${shapeDef.version || '1.0'}`;
  const shapeVersion = shapeDef.version || '1.0';

  // Merge default parameters from definition with instance overrides
  const effectiveParams = {};
  (shapeDef.parameters || []).forEach(p => {
    effectiveParams[p.name] = parameterValues[p.name] !== undefined ? parameterValues[p.name] : p.value;
  });

  // Calculate live snapshot using centralized Phase 2F engine
  const calculationSnapshot = calculateShapeInstance(shapeDef, effectiveParams, shapeDef.calculationRules?.ruleSet);

  return {
    instanceId: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    shapeId,
    shapeVersionId,
    shapeVersion,
    shapeName: shapeDef.name,
    shapeCode: shapeDef.shapeCode || shapeDef.code,
    memberId: context.memberId || null,
    projectId: context.projectId || null,
    blockId: context.blockId || null,
    levelId: context.levelId || null,
    label: context.label || 'Rebar Instance',
    barMark: context.barMark || '',
    barDiameter: effectiveParams.DIAMETER || effectiveParams.diameter || 16,
    parameterValues: effectiveParams,
    calculationSnapshot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Executes a calculation on a Shape Definition using instance parameter values
 * without modifying the master shape definition.
 */
export function calculateShapeInstance(shapeDef, parameterValues = {}, ruleSetId = 'RULE_SET_CENTERLINE_EXACT') {
  // Deep clone geometry so we do not mutate master definition
  const clonedGeometry = JSON.parse(JSON.stringify(shapeDef.geometry || { objects: [] }));
  const clonedParams = (shapeDef.parameters || []).map(p => ({
    ...p,
    value: parameterValues[p.name] !== undefined ? parameterValues[p.name] : p.value
  }));

  // Find rebar object
  const rebarObj = clonedGeometry.objects?.find(o => o.type === 'rebar');
  if (!rebarObj) {
    return {
      cuttingLength: 0,
      developedLength: 0,
      unitWeight: 0,
      totalWeight: 0,
      isTrusted: false,
      status: 'EMPTY'
    };
  }

  return calculateRebarShape(rebarObj, clonedParams, { ruleSet: ruleSetId, unitSystem: 'METRIC_MM_KG' });
}
