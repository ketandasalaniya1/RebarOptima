import React, { useState, useRef, useMemo, useEffect } from 'react';
import CADCanvas from './CADCanvas';
import { HistoryManager } from './history';
import {
  CAD_TOOLS,
  DEFAULT_SNAP_SETTINGS,
  PARAMETER_TYPES,
  PARAMETER_CATEGORIES,
  DIMENSION_TYPES,
  CONSTRAINT_TYPES,
  CONSTRAINT_STATUS
} from './types';
import { fitToObjects, resetViewport, zoomAtPoint } from './viewport';
import { rotateObject, mirrorObject, moveObject } from './editEngine';
import {
  createParameter,
  applyParametersToGeometry,
  syncGeometryToParameters,
  validateParameter
} from './parameterEngine';
import {
  updateDimensionFromGeometry,
  cleanOrphanedDimensions,
  createLinearDimension
} from './dimensionEngine';
import {
  createConstraint,
  validateConstraint,
  solveConstraintsTransactional,
  calculateDegreesOfFreedom,
  cleanOrphanedConstraints
} from './constraintEngine';
import {
  IconCadSelect,
  IconCadLine,
  IconCadPolyline,
  IconCadRectangle,
  IconCadCircle,
  IconCadArc,
  IconCadDimLinear,
  IconCadDimAligned,
  IconCadDimRadius,
  IconCadDimDiameter,
  IconCadDimAngular,
  IconCadMove,
  IconCadRotate,
  IconCadCopy,
  IconCadMirror,
  IconCadOffset,
  IconCadTrim,
  IconCadExtend,
  IconCadFillet,
  IconCadPan,
  IconCadZoomExtents,
  IconCadOrtho,
  IconCadSnap,
  IconCadGrid,
  IconCadParametric,
  IconCadUndo,
  IconCadRedo,
  IconCadRebar,
  IconCadConstraintHorizontal,
  IconCadConstraintVertical,
  IconCadConstraintParallel,
  IconCadConstraintPerpendicular,
  IconCadConstraintEqual,
  IconCadConstraintCoincident,
  IconCadConstraintFixed,
  IconCadConstraintDistance,
  IconCadConstraintAngle
} from './cadIcons';
import './CADEditor.css';

// Smooth local numeric property input component
function CADPropInput({ value, onChange, min = -Infinity, allowZero = true }) {
  const [localVal, setLocalVal] = useState(value !== undefined ? String(value) : '');
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal(value !== undefined ? String(value) : '');
    }
  }, [value]);

  const handleChange = (e) => {
    const text = e.target.value;
    setLocalVal(text);
    if (text.trim() === '') return;
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && (allowZero ? parsed >= min : parsed > min)) {
      onChange(parsed);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const parsed = parseFloat(localVal);
    if (isNaN(parsed) || (!allowZero && parsed <= min) || (allowZero && parsed < min)) {
      const safeVal = value !== undefined ? value : (min > 0 ? min : 0);
      setLocalVal(String(safeVal));
      onChange(safeVal);
    } else {
      setLocalVal(String(parsed));
      onChange(parsed);
    }
  };

  return (
    <input
      type="text"
      className="cad-prop-input"
      value={localVal}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      }}
    />
  );
}

export default function CADEditor({
  shape = null,
  onSave,
  onBack
}) {
  // Shape Metadata
  const [shapeName, setShapeName] = useState(shape?.name || 'Untitled Shape');
  const [shapeCode, setShapeCode] = useState(shape?.code || 'SH-001');
  const [shapeCategory, setShapeCategory] = useState(shape?.category || 'Stirrup');

  // Geometry Objects
  const [objects, setObjects] = useState(shape?.geometry?.objects || []);
  const [selectedObjectIds, setSelectedObjectIds] = useState([]);

  // Associative Dimensions (Phase 2C)
  const [dimensions, setDimensions] = useState(shape?.dimensions || []);
  const [selectedDimensionIds, setSelectedDimensionIds] = useState([]);

  // Parametric Block Variables / Parameters (Phase 2C)
  const [parameters, setParameters] = useState(shape?.parameters || []);

  // Parametric Constraints (Phase 2D)
  const [constraints, setConstraints] = useState(shape?.constraints || []);
  const [showConstraints, setShowConstraints] = useState(true);

  // Right Panel Active Tab ('properties' | 'parameters' | 'constraints')
  const [rightPanelTab, setRightPanelTab] = useState('properties');

  // Custom Rotation Angle state
  const [customRotateAngle, setCustomRotateAngle] = useState(45);

  // New Parameter Form State
  const [showAddParamModal, setShowAddParamModal] = useState(false);
  const [newParamForm, setNewParamForm] = useState({
    name: '',
    value: 100,
    unit: 'mm',
    type: PARAMETER_TYPES.LENGTH,
    category: PARAMETER_CATEGORIES.GEOMETRY
  });

  // Active Tool
  const [activeTool, setActiveTool] = useState(CAD_TOOLS.SELECT);

  // Viewport
  const [viewport, setViewport] = useState({
    panX: 0,
    panY: 0,
    zoom: 1.0,
    width: 800,
    height: 600
  });

  // Snap, Grid & Ortho Settings
  const [snapSettings, setSnapSettings] = useState(DEFAULT_SNAP_SETTINGS);
  const [gridVisible, setGridVisible] = useState(true);
  const [isOrthoEnabled, setIsOrthoEnabled] = useState(false);

  // Quick CAD Parameters
  const [filletRadius, setFilletRadius] = useState(25);
  const [offsetDistance, setOffsetDistance] = useState(25);

  // Live Cursor Coordinates & Prompt
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0, snapType: null });
  const [statusPrompt, setStatusPrompt] = useState('Ready. Select a tool, click an object, or apply constraints.');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null);

  // History Manager (Undo / Redo)
  const historyManagerRef = useRef(new HistoryManager());
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const updateHistoryFlags = () => {
    setHistoryState({
      canUndo: historyManagerRef.current.canUndo(),
      canRedo: historyManagerRef.current.canRedo()
    });
  };

  // Helper: Synchronize dimensions with current geometry
  const syncDimensionsWithGeometry = (currentObjects, currentDims, currentParams) => {
    const cleaned = cleanOrphanedDimensions(currentDims, currentObjects);
    return cleaned.map(d => updateDimensionFromGeometry(d, currentObjects, currentParams));
  };

  // Degrees of Freedom info (Phase 2D)
  const dofInfo = useMemo(() => {
    return calculateDegreesOfFreedom(objects, constraints);
  }, [objects, constraints]);

  // Transactional Constraint Solver Orchestrator
  const runSolver = (targetObjects, targetConstraints, targetParams, pushToHistory = false) => {
    if (pushToHistory) {
      historyManagerRef.current.pushSnapshot({
        objects,
        constraints,
        dimensions,
        parameters
      });
    }

    const res = solveConstraintsTransactional(targetObjects, targetConstraints, targetParams);
    if (res.success) {
      setObjects(res.solvedObjects);
      setConstraints(res.updatedConstraints);
      setDimensions(syncDimensionsWithGeometry(res.solvedObjects, dimensions, targetParams));
      updateHistoryFlags();
      return { success: true, solvedObjects: res.solvedObjects, dof: res.dof };
    } else {
      setStatusPrompt(res.message || 'Constraint conflict detected.');
      return { success: false, message: res.message };
    }
  };

  // Handle Geometry Object Changes (e.g. from Canvas tools or Grips)
  const handleObjectsChange = (newObjects) => {
    // 1. Sync Geometry -> Parameters
    let updatedParams = parameters;
    if (newObjects.length > 0) {
      newObjects.forEach(obj => {
        updatedParams = syncGeometryToParameters(obj, updatedParams);
      });
      setParameters(updatedParams);
    }

    // 2. Clean orphaned constraints if any object was deleted
    const cleanedConstraints = cleanOrphanedConstraints(constraints, newObjects);
    setConstraints(cleanedConstraints);

    // 3. Sync Dimensions with new geometry
    const updatedDims = syncDimensionsWithGeometry(newObjects, dimensions, updatedParams);
    setDimensions(updatedDims);

    setObjects(newObjects);
    updateHistoryFlags();
  };

  // Handle Dimensions Change
  const handleDimensionsChange = (newDims) => {
    const resolved = newDims.map(d => updateDimensionFromGeometry(d, objects, parameters));
    setDimensions(resolved);
    updateHistoryFlags();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PARAMETER ENGINE ACTIONS (Phase 2C & 2D)
  // ════════════════════════════════════════════════════════════════════════════

  // Parameter -> Geometry: Changing a parameter value updates geometry and constraints in real-time
  const handleParameterValueChange = (paramId, newValue) => {
    const num = typeof newValue === 'number' ? newValue : parseFloat(newValue);
    if (isNaN(num) || num <= 0) return;

    historyManagerRef.current.pushSnapshot({
      objects,
      constraints,
      dimensions,
      parameters
    });

    const updatedParams = parameters.map(p => p.id === paramId ? { ...p, value: num } : p);
    setParameters(updatedParams);

    // 1. Run Constraint Solver with updated parameter
    const solveRes = solveConstraintsTransactional(objects, constraints, updatedParams);
    let finalObjects = solveRes.success ? solveRes.solvedObjects : objects;

    // 2. Fallback apply to direct properties if no constraints bound
    if (!solveRes.success || constraints.length === 0) {
      finalObjects = applyParametersToGeometry(finalObjects, updatedParams);
    }

    setObjects(finalObjects);

    // 3. Update dimensions associatively
    const updatedDims = syncDimensionsWithGeometry(finalObjects, dimensions, updatedParams);
    setDimensions(updatedDims);

    updateHistoryFlags();
  };

  // Create Parameter from Scratch
  const handleCreateParameterSubmit = (e) => {
    e.preventDefault();
    const newParam = createParameter({
      name: newParamForm.name,
      value: Number(newParamForm.value) || 100,
      unit: newParamForm.unit,
      type: newParamForm.type,
      category: newParamForm.category
    });

    const validation = validateParameter(newParam, parameters);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    setParameters([...parameters, newParam]);
    setShowAddParamModal(false);
    setNewParamForm({
      name: '',
      value: 100,
      unit: 'mm',
      type: PARAMETER_TYPES.LENGTH,
      category: PARAMETER_CATEGORIES.GEOMETRY
    });
    updateHistoryFlags();
  };

  // Quick Action: Create and Link Parameter directly from an Object Property (e.g. Rectangle Width -> WIDTH, Line Angle -> LINE_ANG)
  const handleCreateParamFromProperty = (obj, propName, currentValue, defaultName) => {
    const paramName = defaultName || `${obj.type.toUpperCase()}_${propName.toUpperCase()}`;
    const isAngle = propName === 'angle';
    const newParam = createParameter({
      name: paramName,
      displayName: paramName,
      value: Number(currentValue.toFixed(1)),
      unit: isAngle ? '°' : 'mm',
      type: isAngle ? PARAMETER_TYPES.ANGLE : PARAMETER_TYPES.LENGTH,
      targetRef: {
        objectId: obj.id,
        property: propName
      }
    });

    const validation = validateParameter(newParam, parameters);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    // Also create an associative linear dimension if not already existing
    let newDims = [...dimensions];
    if (obj.type === 'rectangle') {
      const isWidth = propName === 'width';
      const p1 = isWidth ? { x: obj.x, y: obj.y + obj.height } : { x: obj.x + obj.width, y: obj.y };
      const p2 = isWidth ? { x: obj.x + obj.width, y: obj.y + obj.height } : { x: obj.x + obj.width, y: obj.y + obj.height };
      const dim = createLinearDimension(p1, p2, 25, {
        targetObjectId: obj.id,
        property: propName,
        parameterId: newParam.id
      });
      newDims.push(dim);
      setDimensions(newDims);
    }

    setParameters([...parameters, newParam]);
    setRightPanelTab('parameters');
    updateHistoryFlags();
  };

  // Delete Parameter
  const handleDeleteParameter = (paramId) => {
    historyManagerRef.current.pushSnapshot({
      objects,
      constraints,
      dimensions,
      parameters
    });
    const updated = parameters.filter(p => p.id !== paramId);
    setParameters(updated);
    const updatedDims = dimensions.map(d => d.parameterId === paramId ? { ...d, parameterId: null, parameterName: null } : d);
    setDimensions(updatedDims);
    updateHistoryFlags();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PARAMETRIC CONSTRAINT ENGINE ACTIONS (Phase 2D)
  // ════════════════════════════════════════════════════════════════════════════

  // Apply a new geometric constraint to current selection
  const handleApplyConstraint = (type, customValue = null) => {
    if (selectedObjectIds.length === 0) {
      setStatusPrompt('Select geometry entities to apply constraints.');
      return;
    }

    const selectedObjs = objects.filter(o => selectedObjectIds.includes(o.id));
    let references = [];

    if (type === CONSTRAINT_TYPES.HORIZONTAL || type === CONSTRAINT_TYPES.VERTICAL) {
      references = [{ objectId: selectedObjs[0].id, subTarget: 'line' }];
    } else if (type === CONSTRAINT_TYPES.PARALLEL || type === CONSTRAINT_TYPES.PERPENDICULAR || type === CONSTRAINT_TYPES.EQUAL) {
      if (selectedObjs.length < 2) {
        setStatusPrompt(`Select 2 geometry entities to apply ${type.toUpperCase()} constraint.`);
        return;
      }
      references = [
        { objectId: selectedObjs[0].id, subTarget: 'line' },
        { objectId: selectedObjs[1].id, subTarget: 'line' }
      ];
    } else if (type === CONSTRAINT_TYPES.COINCIDENT) {
      if (selectedObjs.length < 2) {
        setStatusPrompt('Select 2 entities to constrain coincident endpoints.');
        return;
      }
      references = [
        { objectId: selectedObjs[0].id, subTarget: 'p2' },
        { objectId: selectedObjs[1].id, subTarget: 'p1' }
      ];
    } else if (type === CONSTRAINT_TYPES.FIXED) {
      references = [{ objectId: selectedObjs[0].id, subTarget: 'p1' }];
      customValue = selectedObjs[0].type === 'line'
        ? { x: selectedObjs[0].p1.x, y: selectedObjs[0].p1.y }
        : { x: selectedObjs[0].center?.x || 0, y: selectedObjs[0].center?.y || 0 };
    } else if (type === CONSTRAINT_TYPES.DISTANCE) {
      references = [{ objectId: selectedObjs[0].id, subTarget: selectedObjs[0].type === 'rectangle' ? 'width' : 'line' }];
      customValue = customValue || (selectedObjs[0].type === 'rectangle' ? selectedObjs[0].width : Math.hypot(selectedObjs[0].p2.x - selectedObjs[0].p1.x, selectedObjs[0].p2.y - selectedObjs[0].p1.y));
    } else if (type === CONSTRAINT_TYPES.RADIUS || type === CONSTRAINT_TYPES.DIAMETER) {
      references = [{ objectId: selectedObjs[0].id, subTarget: 'center' }];
      customValue = customValue || (selectedObjs[0].radius || 50);
    } else if (type === CONSTRAINT_TYPES.ANGLE) {
      if (selectedObjs.length >= 2) {
        references = [
          { objectId: selectedObjs[0].id, subTarget: 'line' },
          { objectId: selectedObjs[1].id, subTarget: 'line' }
        ];
        customValue = customValue !== null ? customValue : 90;
      } else if (selectedObjs.length === 1 && selectedObjs[0].type === 'line') {
        references = [{ objectId: selectedObjs[0].id, subTarget: 'line' }];
        const p1 = selectedObjs[0].p1 || { x: selectedObjs[0].x1, y: selectedObjs[0].y1 };
        const p2 = selectedObjs[0].p2 || { x: selectedObjs[0].x2, y: selectedObjs[0].y2 };
        const curDeg = ((Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI + 360) % 360);
        customValue = customValue !== null ? customValue : Math.round(curDeg);
      }
    }

    const newConstraint = createConstraint({
      type,
      references,
      value: customValue
    });

    const validation = validateConstraint(newConstraint, constraints, objects);
    if (!validation.valid) {
      setStatusPrompt(validation.message || 'Cannot apply constraint.');
      return;
    }

    const updatedConstraints = [...constraints, newConstraint];
    const solveRes = runSolver(objects, updatedConstraints, parameters, true);
    if (solveRes.success) {
      setStatusPrompt(`✓ ${type.toUpperCase()} constraint applied successfully.`);
      setRightPanelTab('constraints');
    }
  };

  // Toggle Suppress Constraint
  const handleToggleConstraint = (constraintId) => {
    const updatedConstraints = constraints.map(c => {
      if (c.id === constraintId) {
        return {
          ...c,
          enabled: !c.enabled,
          status: !c.enabled ? CONSTRAINT_STATUS.VALID : CONSTRAINT_STATUS.SUPPRESSED
        };
      }
      return c;
    });
    setConstraints(updatedConstraints);
    runSolver(objects, updatedConstraints, parameters, true);
  };

  // Delete Constraint
  const handleDeleteConstraint = (constraintId) => {
    historyManagerRef.current.pushSnapshot({
      objects,
      constraints,
      dimensions,
      parameters
    });
    const updatedConstraints = constraints.filter(c => c.id !== constraintId);
    setConstraints(updatedConstraints);
    runSolver(objects, updatedConstraints, parameters, false);
    updateHistoryFlags();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DIRECT GEOMETRY & PROPERTY EDITING
  // ════════════════════════════════════════════════════════════════════════════

  // Selected Object details for Live Properties Panel Editing
  const selectedObject = useMemo(() => {
    if (selectedObjectIds.length === 1) {
      return objects.find(obj => obj.id === selectedObjectIds[0]);
    }
    return null;
  }, [selectedObjectIds, objects]);

  // Selected Dimension details for Properties Panel Editing
  const selectedDimension = useMemo(() => {
    if (selectedDimensionIds && selectedDimensionIds.length === 1) {
      return dimensions.find(d => d.id === selectedDimensionIds[0]);
    }
    return null;
  }, [selectedDimensionIds, dimensions]);

  // Live Property Field Change Handler
  const handlePropertyChange = (key, num) => {
    if (!selectedObject) return;
    if (typeof num !== 'number' || isNaN(num)) return;

    historyManagerRef.current.pushSnapshot({
      objects,
      constraints,
      dimensions,
      parameters
    });

    const updated = JSON.parse(JSON.stringify(selectedObject));

    if (updated.type === 'rectangle') {
      if (key === 'width') updated.width = Math.max(1, num);
      if (key === 'height') updated.height = Math.max(1, num);
      if (key === 'x') updated.x = num;
      if (key === 'y') updated.y = num;
    } else if (updated.type === 'circle') {
      if (key === 'radius') updated.radius = Math.max(1, num);
      if (key === 'cx') { updated.center.x = num; if (updated.cx !== undefined) updated.cx = num; }
      if (key === 'cy') { updated.center.y = num; if (updated.cy !== undefined) updated.cy = num; }
    } else if (updated.type === 'line') {
      if (key === 'x1') { updated.p1.x = num; if (updated.x1 !== undefined) updated.x1 = num; }
      if (key === 'y1') { updated.p1.y = num; if (updated.y1 !== undefined) updated.y1 = num; }
      if (key === 'x2') { updated.p2.x = num; if (updated.x2 !== undefined) updated.x2 = num; }
      if (key === 'y2') { updated.p2.y = num; if (updated.y2 !== undefined) updated.y2 = num; }
      if (key === 'length') {
        const p1 = updated.p1 || { x: updated.x1, y: updated.y1 };
        const p2 = updated.p2 || { x: updated.x2, y: updated.y2 };
        const currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const newLen = Math.max(0.1, num);
        updated.p2 = {
          x: Number((p1.x + Math.cos(currentAngle) * newLen).toFixed(2)),
          y: Number((p1.y + Math.sin(currentAngle) * newLen).toFixed(2))
        };
        if (updated.x2 !== undefined) updated.x2 = updated.p2.x;
        if (updated.y2 !== undefined) updated.y2 = updated.p2.y;
      }
      if (key === 'angle') {
        const p1 = updated.p1 || { x: updated.x1, y: updated.y1 };
        const p2 = updated.p2 || { x: updated.x2, y: updated.y2 };
        const currentLen = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 100;
        const angleRad = (num * Math.PI) / 180;
        updated.p2 = {
          x: Number((p1.x + Math.cos(angleRad) * currentLen).toFixed(2)),
          y: Number((p1.y + Math.sin(angleRad) * currentLen).toFixed(2))
        };
        if (updated.x2 !== undefined) updated.x2 = updated.p2.x;
        if (updated.y2 !== undefined) updated.y2 = updated.p2.y;
      }
    }

    // Sync Geometry -> Parameters & Constraints
    const newObjects = objects.map(o => o.id === updated.id ? updated : o);
    const updatedParams = syncGeometryToParameters(updated, parameters);

    // Solve constraints if active
    const solveRes = solveConstraintsTransactional(newObjects, constraints, updatedParams);
    const finalObjs = solveRes.success ? solveRes.solvedObjects : newObjects;
    const updatedDims = syncDimensionsWithGeometry(finalObjs, dimensions, updatedParams);

    setObjects(finalObjs);
    setParameters(updatedParams);
    setDimensions(updatedDims);
    updateHistoryFlags();
  };

  // Edit Dimension Value directly (updates underlying geometry!)
  const handleDimensionValueDirectEdit = (dim, newNum) => {
    if (!dim || typeof newNum !== 'number' || isNaN(newNum) || newNum <= 0) return;

    if (dim.parameterId) {
      handleParameterValueChange(dim.parameterId, newNum);
      return;
    }

    if (dim.targetObjectId) {
      const targetObj = objects.find(o => o.id === dim.targetObjectId);
      if (targetObj) {
        handlePropertyChange(dim.property || 'width', newNum);
      }
    }
  };

  // Undo / Redo (Full Compound State Support)
  const handleUndo = () => {
    const prev = historyManagerRef.current.undo({
      objects,
      constraints,
      dimensions,
      parameters
    });
    if (prev !== null) {
      if (Array.isArray(prev)) {
        setObjects(prev);
        setDimensions(syncDimensionsWithGeometry(prev, dimensions, parameters));
      } else {
        if (prev.objects) setObjects(prev.objects);
        if (prev.constraints) setConstraints(prev.constraints);
        if (prev.parameters) setParameters(prev.parameters);
        if (prev.dimensions) setDimensions(prev.dimensions);
        else if (prev.objects) setDimensions(syncDimensionsWithGeometry(prev.objects, dimensions, prev.parameters || parameters));
      }
      setSelectedObjectIds([]);
      updateHistoryFlags();
    }
  };

  const handleRedo = () => {
    const next = historyManagerRef.current.redo({
      objects,
      constraints,
      dimensions,
      parameters
    });
    if (next !== null) {
      if (Array.isArray(next)) {
        setObjects(next);
        setDimensions(syncDimensionsWithGeometry(next, dimensions, parameters));
      } else {
        if (next.objects) setObjects(next.objects);
        if (next.constraints) setConstraints(next.constraints);
        if (next.parameters) setParameters(next.parameters);
        if (next.dimensions) setDimensions(next.dimensions);
        else if (next.objects) setDimensions(syncDimensionsWithGeometry(next.objects, dimensions, next.parameters || parameters));
      }
      setSelectedObjectIds([]);
      updateHistoryFlags();
    }
  };

  const handleFitView = () => {
    setViewport(prev => fitToObjects(objects, prev));
  };

  const handleResetView = () => {
    setViewport(prev => resetViewport(prev));
  };

  const handleZoomIn = () => {
    setViewport(prev => zoomAtPoint(prev.width / 2, prev.height / 2, 1.25, prev));
  };

  const handleZoomOut = () => {
    setViewport(prev => zoomAtPoint(prev.width / 2, prev.height / 2, 0.8, prev));
  };

  const handleDeleteSelected = () => {
    if (selectedObjectIds.length === 0 && selectedDimensionIds.length === 0) return;
    historyManagerRef.current.pushSnapshot({
      objects,
      constraints,
      dimensions,
      parameters
    });

    if (selectedObjectIds.length > 0) {
      const remainingObjects = objects.filter(obj => !selectedObjectIds.includes(obj.id));
      const remainingDims = cleanOrphanedDimensions(dimensions, remainingObjects);
      const remainingConstraints = cleanOrphanedConstraints(constraints, remainingObjects);
      setObjects(remainingObjects);
      setDimensions(remainingDims);
      setConstraints(remainingConstraints);
      setSelectedObjectIds([]);
    } else if (selectedDimensionIds.length > 0) {
      const remainingDims = dimensions.filter(d => !selectedDimensionIds.includes(d.id));
      setDimensions(remainingDims);
      setSelectedDimensionIds([]);
    }
    updateHistoryFlags();
  };

  const handleSaveShape = () => {
    const shapePayload = {
      id: shape?.id || `shape_${Date.now()}`,
      name: shapeName,
      code: shapeCode,
      category: shapeCategory,
      unit: 'mm',
      geometry: {
        objects: objects
      },
      dimensions: dimensions,
      parameters: parameters,
      constraints: constraints,
      updatedAt: new Date().toISOString()
    };
    if (onSave) onSave(shapePayload);
  };

  // Quick Transformations for Selected Objects
  const handleRotate90 = () => {
    handleRotateAngle(90);
  };

  const handleRotateAngle = (angleInDegrees) => {
    if (selectedObjectIds.length === 0 || isNaN(angleInDegrees)) return;
    historyManagerRef.current.pushSnapshot({
      objects,
      constraints,
      dimensions,
      parameters
    });
    // Calculate selection centroid
    const selectedObjs = objects.filter(o => selectedObjectIds.includes(o.id));
    let cx = 0, cy = 0, count = 0;
    selectedObjs.forEach(o => {
      if (o.type === 'line') {
        const p1 = o.p1 || { x: o.x1, y: o.y1 };
        const p2 = o.p2 || { x: o.x2, y: o.y2 };
        cx += (p1.x + p2.x) / 2;
        cy += (p1.y + p2.y) / 2;
        count++;
      } else if (o.type === 'rectangle') {
        cx += o.x + o.width / 2;
        cy += o.y + o.height / 2;
        count++;
      } else if (o.type === 'circle') {
        cx += o.center?.x || o.cx || 0;
        cy += o.center?.y || o.cy || 0;
        count++;
      }
    });
    const center = count > 0 ? { x: cx / count, y: cy / count } : { x: 0, y: 0 };
    const rad = (angleInDegrees * Math.PI) / 180;
    const updated = objects.map(o => selectedObjectIds.includes(o.id) ? rotateObject(o, center, rad) : o);
    setObjects(updated);
    setDimensions(syncDimensionsWithGeometry(updated, dimensions, parameters));
    updateHistoryFlags();
  };

  const handleMirrorHorizontal = () => {
    if (selectedObjectIds.length === 0) return;
    historyManagerRef.current.pushSnapshot({
      objects,
      constraints,
      dimensions,
      parameters
    });
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 0 };
    const updated = objects.map(o => selectedObjectIds.includes(o.id) ? mirrorObject(o, p1, p2) : o);
    setObjects(updated);
    setDimensions(syncDimensionsWithGeometry(updated, dimensions, parameters));
    updateHistoryFlags();
  };

  const handleMirrorVertical = () => {
    if (selectedObjectIds.length === 0) return;
    historyManagerRef.current.pushSnapshot({
      objects,
      constraints,
      dimensions,
      parameters
    });
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 0, y: 100 };
    const updated = objects.map(o => selectedObjectIds.includes(o.id) ? mirrorObject(o, p1, p2) : o);
    setObjects(updated);
    setDimensions(syncDimensionsWithGeometry(updated, dimensions, parameters));
    updateHistoryFlags();
  };

  const handleDuplicateSelected = () => {
    if (selectedObjectIds.length === 0) return;
    historyManagerRef.current.pushSnapshot({
      objects,
      constraints,
      dimensions,
      parameters
    });
    const clones = [];
    selectedObjectIds.forEach(id => {
      const target = objects.find(o => o.id === id);
      if (target) {
        const cl = moveObject(target, 20, 20);
        cl.id = `copy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        clones.push(cl);
      }
    });
    setObjects([...objects, ...clones]);
    setSelectedObjectIds(clones.map(c => c.id));
    updateHistoryFlags();
  };

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  return (
    <div className="cad-editor-container">
      {/* TOP BAR */}
      <header className="cad-topbar">
        <div className="cad-topbar-left">
          <button className="cad-back-btn" onClick={onBack} title="Return to Shape Library">
            ← Back to Library
          </button>

          <div className="cad-divider" />

          <div className="cad-shape-title-wrapper">
            <input
              type="text"
              className="cad-shape-name-input"
              value={shapeName}
              onChange={(e) => setShapeName(e.target.value)}
              placeholder="Shape Name"
            />
            <span className="cad-shape-badge">{shapeCode}</span>
          </div>
        </div>

        <div className="cad-topbar-actions">
          {/* Undo / Redo */}
          <button
            className="cad-btn-icon"
            onClick={handleUndo}
            disabled={!historyState.canUndo}
            title="Undo (Ctrl+Z)"
          >
            <IconCadUndo size={16} />
          </button>
          <button
            className="cad-btn-icon"
            onClick={handleRedo}
            disabled={!historyState.canRedo}
            title="Redo (Ctrl+Y)"
          >
            <IconCadRedo size={16} />
          </button>

          <div className="cad-divider" />

          {/* Quick Config: Fillet & Offset */}
          <div className="cad-param-quick" title="Corner Fillet Radius (mm)">
            <span>Fillet R:</span>
            <input
              type="number"
              className="cad-param-input"
              value={filletRadius}
              onChange={(e) => setFilletRadius(Math.max(1, parseFloat(e.target.value) || 25))}
            />
            <span>mm</span>
          </div>

          <div className="cad-param-quick" title="Offset Distance (mm)">
            <span>Offset:</span>
            <input
              type="number"
              className="cad-param-input"
              value={offsetDistance}
              onChange={(e) => setOffsetDistance(Math.max(1, parseFloat(e.target.value) || 25))}
            />
            <span>mm</span>
          </div>

          <div className="cad-divider" />

          {/* Constraints Visualization Toggle (Phase 2D) */}
          <button
            className={`cad-btn-icon ${showConstraints ? 'active' : ''}`}
            onClick={() => setShowConstraints(!showConstraints)}
            title="Toggle Constraints Overlay (X)"
          >
            <IconCadConstraintParallel size={16} />
          </button>

          {/* Ortho Mode Toggle */}
          <button
            className={`cad-btn-icon ${isOrthoEnabled ? 'active' : ''}`}
            onClick={() => setIsOrthoEnabled(!isOrthoEnabled)}
            title="Toggle Ortho Mode (F8)"
          >
            <IconCadOrtho size={16} />
          </button>

          {/* Grid & Snap Toggles */}
          <button
            className={`cad-btn-icon ${gridVisible ? 'active' : ''}`}
            onClick={() => setGridVisible(!gridVisible)}
            title="Toggle Grid (G)"
          >
            <IconCadGrid size={16} />
          </button>
          <button
            className={`cad-btn-icon ${snapSettings.enabled ? 'active' : ''}`}
            onClick={() => setSnapSettings({ ...snapSettings, enabled: !snapSettings.enabled })}
            title="Toggle Snap (S)"
          >
            <IconCadSnap size={16} />
          </button>

          <div className="cad-divider" />

          {/* Save Shape */}
          <button className="cad-save-btn" onClick={handleSaveShape}>
            💾 Save Shape
          </button>
        </div>
      </header>

      {/* WORKSPACE (TOOLBAR + CANVAS + PROPERTIES) */}
      <div className="cad-workspace">
        {/* LEFT TOOLBAR */}
        <aside className="cad-toolbar">
          {/* DRAW PALETTE */}
          <div className="cad-tool-group-label">DRAW</div>
          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.SELECT ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.SELECT); setStatusPrompt('Select: Click an object or drag box to select'); }}
            title="Select [V]"
          >
            <IconCadSelect size={18} />
            <span className="tooltip">Select <em>[V]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.LINE ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.LINE); setStatusPrompt('Line: Specify first point'); }}
            title="Line [L]"
          >
            <IconCadLine size={18} />
            <span className="tooltip">Line <em>[L]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.POLYLINE ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.POLYLINE); setStatusPrompt('Polyline: Specify first vertex'); }}
            title="Polyline [PL]"
          >
            <IconCadPolyline size={18} />
            <span className="tooltip">Polyline <em>[PL]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.RECTANGLE ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.RECTANGLE); setStatusPrompt('Rectangle: Specify first corner'); }}
            title="Rectangle [REC]"
          >
            <IconCadRectangle size={18} />
            <span className="tooltip">Rectangle <em>[REC]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.ARC ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.ARC); setStatusPrompt('3-Point Arc: Specify start point'); }}
            title="3-Point Arc [A]"
          >
            <IconCadArc size={18} />
            <span className="tooltip">3-Point Arc <em>[A]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.CIRCLE ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.CIRCLE); setStatusPrompt('Circle: Specify center point'); }}
            title="Circle [C]"
          >
            <IconCadCircle size={18} />
            <span className="tooltip">Circle <em>[C]</em></span>
          </button>

          {/* DIMENSIONS / ANNOTATIONS PALETTE (PHASE 2C) */}
          <div className="cad-toolbar-divider" />
          <div className="cad-tool-group-label">DIM</div>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.DIM_LINEAR || activeTool === CAD_TOOLS.DIMENSION ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.DIM_LINEAR); setStatusPrompt('Linear Dimension: Click Point 1 -> Point 2 -> Offset'); }}
            title="Linear Dimension [D]"
          >
            <IconCadDimLinear size={18} />
            <span className="tooltip">Linear Dimension <em>[D]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.DIM_ALIGNED ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.DIM_ALIGNED); setStatusPrompt('Aligned Dimension: Click Point 1 -> Point 2 -> Offset'); }}
            title="Aligned Dimension [DAL]"
          >
            <IconCadDimAligned size={18} />
            <span className="tooltip">Aligned Dimension <em>[DAL]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.DIM_RADIUS ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.DIM_RADIUS); setStatusPrompt('Radius Dimension: Click circle or arc'); }}
            title="Radius Dimension [DRA]"
          >
            <IconCadDimRadius size={18} />
            <span className="tooltip">Radius Dimension <em>[DRA]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.DIM_DIAMETER ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.DIM_DIAMETER); setStatusPrompt('Diameter Dimension: Click circle'); }}
            title="Diameter Dimension [DDI]"
          >
            <IconCadDimDiameter size={18} />
            <span className="tooltip">Diameter Dimension <em>[DDI]</em></span>
          </button>

          {/* MODIFY PALETTE */}
          <div className="cad-toolbar-divider" />
          <div className="cad-tool-group-label">MOD</div>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.MOVE ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.MOVE); setStatusPrompt('Move: Select base point for transformation'); }}
            title="Move [M]"
          >
            <IconCadMove size={18} />
            <span className="tooltip">Move <em>[M]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.ROTATE ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.ROTATE); setStatusPrompt('Rotate: Select center of rotation'); }}
            title="Rotate [RO]"
          >
            <IconCadRotate size={18} />
            <span className="tooltip">Rotate <em>[RO]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.COPY ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.COPY); setStatusPrompt('Copy: Select base point to duplicate'); }}
            title="Copy [CO]"
          >
            <IconCadCopy size={18} />
            <span className="tooltip">Copy <em>[CO]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.MIRROR ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.MIRROR); setStatusPrompt('Mirror: Specify first point of mirror axis line'); }}
            title="Mirror [MI]"
          >
            <IconCadMirror size={18} />
            <span className="tooltip">Mirror <em>[MI]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.OFFSET ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.OFFSET); setStatusPrompt(`Offset: Click side or object to offset by ${offsetDistance}mm`); }}
            title="Offset [O]"
          >
            <IconCadOffset size={18} />
            <span className="tooltip">Offset <em>[O]</em></span>
          </button>

          <button
            className={`cad-tool-btn ${activeTool === CAD_TOOLS.FILLET ? 'active' : ''}`}
            onClick={() => { setActiveTool(CAD_TOOLS.FILLET); setStatusPrompt(`Fillet: Select first line (Radius: ${filletRadius}mm)`); }}
            title="Corner Fillet [F]"
          >
            <IconCadFillet size={18} />
            <span className="tooltip">Corner Fillet <em>[F]</em></span>
          </button>
        </aside>

        {/* CENTER INTERACTIVE CANVAS */}
        <main className="cad-canvas-wrapper">
          <CADCanvas
            objects={objects}
            onObjectsChange={handleObjectsChange}
            dimensions={dimensions}
            onDimensionsChange={handleDimensionsChange}
            parameters={parameters}
            constraints={constraints}
            showConstraints={showConstraints}
            selectedObjectIds={selectedObjectIds}
            onSelectObjects={(ids) => { setSelectedObjectIds(ids); if (ids.length > 0) setRightPanelTab('properties'); }}
            selectedDimensionIds={selectedDimensionIds}
            onSelectDimensions={(ids) => { setSelectedDimensionIds(ids); if (ids.length > 0) setRightPanelTab('properties'); }}
            onDimensionDoubleClick={(dim) => {
              setSelectedDimensionIds([dim.id]);
              setRightPanelTab('properties');
            }}
            activeTool={activeTool}
            onToolComplete={() => {}}
            viewport={viewport}
            onViewportChange={setViewport}
            snapSettings={snapSettings}
            onCursorMove={setCursorPos}
            gridVisible={gridVisible}
            isOrthoEnabled={isOrthoEnabled}
            filletRadius={filletRadius}
            offsetDistance={offsetDistance}
            historyManager={historyManagerRef.current}
            onContextMenuOpen={setContextMenu}
            onStatusPromptChange={setStatusPrompt}
          />

          {/* Floating Zoom / View Controls */}
          <div className="cad-floating-controls">
            <button className="cad-float-btn" onClick={handleZoomIn} title="Zoom In (+)">+</button>
            <button className="cad-float-btn" onClick={handleZoomOut} title="Zoom Out (-)">−</button>
            <button className="cad-float-btn" onClick={handleFitView} title="Fit View (Extents)">
              <IconCadZoomExtents size={16} />
            </button>
            <button className="cad-float-btn" onClick={handleResetView} title="Reset View (1:1)">1:1</button>
          </div>

          {/* FLOATING CAD CONTEXT MENU */}
          {contextMenu && (
            <div
              className="cad-context-menu"
              style={{ top: contextMenu.clientY, left: contextMenu.clientX }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="cad-context-item" onClick={() => { setActiveTool(CAD_TOOLS.MOVE); setContextMenu(null); }}>
                ↔ Move
              </button>
              <button className="cad-context-item" onClick={() => { setActiveTool(CAD_TOOLS.ROTATE); setContextMenu(null); }}>
                ↻ Rotate
              </button>
              <button className="cad-context-item" onClick={() => { handleDuplicateSelected(); setContextMenu(null); }}>
                ❐ Duplicate
              </button>
              <button className="cad-context-item" onClick={() => { setActiveTool(CAD_TOOLS.MIRROR); setContextMenu(null); }}>
                ⮂ Mirror
              </button>
              <button className="cad-context-item" onClick={() => { setActiveTool(CAD_TOOLS.OFFSET); setContextMenu(null); }}>
                ⇲ Offset
              </button>
              <div className="cad-context-divider" />
              <button className="cad-context-item cad-context-danger" onClick={() => { handleDeleteSelected(); setContextMenu(null); }}>
                🗑 Delete
              </button>
            </div>
          )}
        </main>

        {/* RIGHT PANEL: PROPERTIES, PARAMETERS & CONSTRAINTS (PHASE 2D) */}
        <aside className="cad-properties-panel">
          {/* TABS */}
          <div className="cad-panel-tabs">
            <button
              className={`cad-panel-tab ${rightPanelTab === 'properties' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('properties')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              <IconCadSelect size={13} /> Props
            </button>
            <button
              className={`cad-panel-tab ${rightPanelTab === 'parameters' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('parameters')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              <IconCadParametric size={13} /> Params ({parameters.length})
            </button>
            <button
              className={`cad-panel-tab ${rightPanelTab === 'constraints' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('constraints')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              <IconCadConstraintParallel size={13} /> Rules ({constraints.length})
            </button>
          </div>

          {rightPanelTab === 'properties' ? (
            // PROPERTIES TAB
            <>
              <div className="cad-panel-header">
                <span>{selectedObject ? 'Object Properties' : selectedDimension ? 'Dimension Inspector' : 'Shape Details'}</span>
                {selectedObject && <span className="cad-shape-badge">{selectedObject.type}</span>}
                {selectedDimension && <span className="cad-shape-badge" style={{ color: '#f59e0b', borderColor: '#f59e0b' }}>{selectedDimension.type}</span>}
              </div>

              {selectedDimension ? (
                // DIMENSION INSPECTOR
                <div className="cad-panel-section">
                  <div className="cad-section-title">Dimension Properties</div>

                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Dimension Type</span>
                    <span className="cad-prop-value">{selectedDimension.type}</span>
                  </div>

                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Measured Value (mm)</span>
                    <CADPropInput
                      value={selectedDimension.value}
                      min={1}
                      allowZero={false}
                      onChange={(newVal) => handleDimensionValueDirectEdit(selectedDimension, newVal)}
                    />
                  </div>

                  {selectedDimension.parameterId ? (
                    <div className="cad-prop-row">
                      <span className="cad-prop-label">Linked Parameter</span>
                      <span className="cad-link-badge">
                        🔗 {selectedDimension.parameterName || 'LINKED'}
                      </span>
                    </div>
                  ) : selectedDimension.targetObjectId ? (
                    <div style={{ marginTop: '12px' }}>
                      <button
                        className="cad-create-param-btn"
                        style={{ width: '100%', padding: '6px' }}
                        onClick={() => {
                          const targetObj = objects.find(o => o.id === selectedDimension.targetObjectId);
                          if (targetObj) {
                            handleCreateParamFromProperty(targetObj, selectedDimension.property || 'length', selectedDimension.value);
                          }
                        }}
                      >
                        ⚡ Convert to Named Parameter
                      </button>
                    </div>
                  ) : null}

                  <button className="cad-delete-btn" onClick={handleDeleteSelected}>
                    🗑 Delete Dimension
                  </button>
                </div>
              ) : selectedObject ? (
                // OBJECT PROPERTIES
                <div className="cad-panel-section">
                  <div className="cad-section-title">Geometric Data</div>

                  <div className="cad-prop-row">
                    <span className="cad-prop-label">ID</span>
                    <span className="cad-prop-value">{selectedObject.id.slice(0, 10)}...</span>
                  </div>
                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Type</span>
                    <span className="cad-prop-value">{selectedObject.type}</span>
                  </div>

                  {selectedObject.type === 'line' && (() => {
                    const p1 = selectedObject.p1 || { x: selectedObject.x1, y: selectedObject.y1 };
                    const p2 = selectedObject.p2 || { x: selectedObject.x2, y: selectedObject.y2 };
                    const lineLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                    const lineAngle = Number((((Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI + 360) % 360).toFixed(1));

                    return (
                      <>
                        <div className="cad-prop-row">
                          <span className="cad-prop-label">Start X (mm)</span>
                          <CADPropInput
                            value={p1.x || 0}
                            onChange={(num) => handlePropertyChange('x1', num)}
                          />
                        </div>
                        <div className="cad-prop-row">
                          <span className="cad-prop-label">Start Y (mm)</span>
                          <CADPropInput
                            value={p1.y || 0}
                            onChange={(num) => handlePropertyChange('y1', num)}
                          />
                        </div>
                        <div className="cad-prop-row">
                          <span className="cad-prop-label">End X (mm)</span>
                          <CADPropInput
                            value={p2.x || 0}
                            onChange={(num) => handlePropertyChange('x2', num)}
                          />
                        </div>
                        <div className="cad-prop-row">
                          <span className="cad-prop-label">End Y (mm)</span>
                          <CADPropInput
                            value={p2.y || 0}
                            onChange={(num) => handlePropertyChange('y2', num)}
                          />
                        </div>

                        {/* Direct Editable Length */}
                        <div className="cad-prop-row">
                          <span className="cad-prop-label">Length (mm)</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CADPropInput
                              value={Number(lineLen.toFixed(1))}
                              min={0.1}
                              allowZero={false}
                              onChange={(num) => handlePropertyChange('length', num)}
                            />
                            <button
                              className="cad-create-param-btn"
                              title="Convert length to named parameter"
                              onClick={() => handleCreateParamFromProperty(selectedObject, 'length', lineLen, 'LINE_LEN')}
                            >
                              Param
                            </button>
                          </div>
                        </div>

                        {/* Direct Editable Angle (Manual Angle Setting) */}
                        <div className="cad-prop-row">
                          <span className="cad-prop-label">Angle (°)</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CADPropInput
                              value={lineAngle}
                              onChange={(num) => handlePropertyChange('angle', num)}
                            />
                            <button
                              className="cad-create-param-btn"
                              title="Convert angle to named parameter"
                              onClick={() => handleCreateParamFromProperty(selectedObject, 'angle', lineAngle, 'LINE_ANG')}
                            >
                              Param
                            </button>
                          </div>
                        </div>

                        {/* Quick Preset Angles */}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', color: '#94a3b8', marginRight: '2px' }}>Presets:</span>
                          {[0, 30, 45, 60, 90, 135, 180, 270].map(deg => (
                            <button
                              key={deg}
                              className="cad-quick-btn"
                              style={{ padding: '2px 5px', fontSize: '10.5px', minWidth: '32px' }}
                              onClick={() => handlePropertyChange('angle', deg)}
                              title={`Set angle to ${deg}°`}
                            >
                              {deg}°
                            </button>
                          ))}
                        </div>

                        {/* CONTEXT-SENSITIVE CONSTRAINT ACTIONS (PHASE 2D) */}
                        <div className="cad-section-title" style={{ marginTop: '14px' }}>Apply Constraint</div>
                        <div className="cad-quick-actions">
                          <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.HORIZONTAL)} title="Constrain line horizontal (0°)">
                            — Horizontal
                          </button>
                          <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.VERTICAL)} title="Constrain line vertical (90°)">
                            │ Vertical
                          </button>
                          <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.FIXED)} title="Lock line start position">
                            🔒 Fix Pos
                          </button>
                          <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.DISTANCE, lineLen)} title="Constrain length">
                            ↔ Distance
                          </button>
                          <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.ANGLE, lineAngle)} title="Lock angle constraint">
                            ∡ Angle ({lineAngle}°)
                          </button>
                        </div>
                      </>
                    );
                  })()}

                  {selectedObject.type === 'rectangle' && (
                    <>
                      <div className="cad-prop-row">
                        <span className="cad-prop-label">Width (mm)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CADPropInput
                            value={selectedObject.width || 0}
                            min={1}
                            allowZero={false}
                            onChange={(num) => handlePropertyChange('width', num)}
                          />
                          <button
                            className="cad-create-param-btn"
                            title="Convert width to named parameter"
                            onClick={() => handleCreateParamFromProperty(selectedObject, 'width', selectedObject.width, 'WIDTH')}
                          >
                            Param
                          </button>
                        </div>
                      </div>
                      <div className="cad-prop-row">
                        <span className="cad-prop-label">Height (mm)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CADPropInput
                            value={selectedObject.height || 0}
                            min={1}
                            allowZero={false}
                            onChange={(num) => handlePropertyChange('height', num)}
                          />
                          <button
                            className="cad-create-param-btn"
                            title="Convert height to named parameter"
                            onClick={() => handleCreateParamFromProperty(selectedObject, 'height', selectedObject.height, 'HEIGHT')}
                          >
                            Param
                          </button>
                        </div>
                      </div>
                      <div className="cad-prop-row">
                        <span className="cad-prop-label">Perimeter</span>
                        <span className="cad-prop-value">{(2 * (selectedObject.width + selectedObject.height)).toFixed(1)} mm</span>
                      </div>
                      <div className="cad-prop-row">
                        <span className="cad-prop-label">Area</span>
                        <span className="cad-prop-value">{((selectedObject.width * selectedObject.height) / 100).toFixed(1)} cm²</span>
                      </div>

                      <div className="cad-section-title" style={{ marginTop: '14px' }}>Apply Constraint</div>
                      <div className="cad-quick-actions">
                        <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.FIXED)} title="Lock corner position">
                          🔒 Fix Corner
                        </button>
                        <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.DISTANCE, selectedObject.width)} title="Lock width constraint">
                          ↔ Fix Width
                        </button>
                      </div>
                    </>
                  )}

                  {selectedObject.type === 'circle' && (
                    <>
                      <div className="cad-prop-row">
                        <span className="cad-prop-label">Radius (mm)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CADPropInput
                            value={selectedObject.radius || 0}
                            min={1}
                            allowZero={false}
                            onChange={(num) => handlePropertyChange('radius', num)}
                          />
                          <button
                            className="cad-create-param-btn"
                            title="Convert radius to named parameter"
                            onClick={() => handleCreateParamFromProperty(selectedObject, 'radius', selectedObject.radius, 'RADIUS')}
                          >
                            Param
                          </button>
                        </div>
                      </div>
                      <div className="cad-prop-row">
                        <span className="cad-prop-label">Diameter</span>
                        <span className="cad-prop-value">{(selectedObject.radius * 2).toFixed(1)} mm</span>
                      </div>
                      <div className="cad-prop-row">
                        <span className="cad-prop-label">Circumference</span>
                        <span className="cad-prop-value">{(2 * Math.PI * selectedObject.radius).toFixed(1)} mm</span>
                      </div>
                      <div className="cad-prop-row">
                        <span className="cad-prop-label">Area</span>
                        <span className="cad-prop-value">{((Math.PI * selectedObject.radius ** 2) / 100).toFixed(1)} cm²</span>
                      </div>

                      <div className="cad-section-title" style={{ marginTop: '14px' }}>Apply Constraint</div>
                      <div className="cad-quick-actions">
                        <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.RADIUS, selectedObject.radius)} title="Radius Constraint">
                          R Radius
                        </button>
                        <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.DIAMETER, selectedObject.radius * 2)} title="Diameter Constraint">
                          Ø Diameter
                        </button>
                        <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.FIXED)} title="Lock center point">
                          🔒 Fix Center
                        </button>
                      </div>
                    </>
                  )}

                  {/* QUICK TRANSFORMATIONS BAR */}
                  <div className="cad-quick-actions">
                    <button className="cad-quick-btn" onClick={handleRotate90} title="Rotate 90 degrees">
                      ↻ Rotate 90°
                    </button>
                    <button className="cad-quick-btn" onClick={handleDuplicateSelected} title="Duplicate selection">
                      ❐ Duplicate
                    </button>
                    <button className="cad-quick-btn" onClick={handleMirrorHorizontal} title="Mirror Horizontally">
                      ⮂ Mirror H
                    </button>
                    <button className="cad-quick-btn" onClick={handleMirrorVertical} title="Mirror Vertically">
                      ⮃ Mirror V
                    </button>
                  </div>

                  {/* Manual Rotation Angle Control */}
                  <div style={{ marginTop: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Rotate by Angle</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CADPropInput
                        value={customRotateAngle}
                        onChange={(num) => setCustomRotateAngle(num)}
                      />
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>°</span>
                      <button
                        className="cad-quick-btn"
                        style={{ padding: '4px 10px', fontSize: '11px', background: '#0284c7', color: '#ffffff', borderColor: '#0369a1' }}
                        onClick={() => handleRotateAngle(customRotateAngle)}
                        title="Rotate selection by specified angle"
                      >
                        Rotate
                      </button>
                    </div>
                  </div>

                  <button className="cad-delete-btn" onClick={handleDeleteSelected}>
                    🗑 Delete Selected Object
                  </button>
                </div>
              ) : selectedObjectIds.length >= 2 ? (
                // MULTI-SELECTION PAIR CONSTRAINTS
                <div className="cad-panel-section">
                  <div className="cad-section-title">Multi-Selection ({selectedObjectIds.length} Objects)</div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '10px' }}>
                    Apply geometric relationship rules between selected entities:
                  </div>

                  <div className="cad-quick-actions">
                    <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.PARALLEL)} title="Keep lines parallel">
                      // Parallel
                    </button>
                    <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.PERPENDICULAR)} title="Keep lines 90°">
                      ⊥ Perpendicular
                    </button>
                    <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.EQUAL)} title="Equal lengths or radii">
                      = Equal
                    </button>
                    <button className="cad-quick-btn" onClick={() => handleApplyConstraint(CONSTRAINT_TYPES.COINCIDENT)} title="Connect endpoints">
                      ● Coincident
                    </button>
                  </div>

                  <button className="cad-delete-btn" onClick={handleDeleteSelected}>
                    🗑 Delete Selected Objects
                  </button>
                </div>
              ) : (
                // SHAPE DETAILS OVERVIEW
                <div className="cad-panel-section">
                  <div className="cad-section-title">Shape Metadata</div>
                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Name</span>
                    <span className="cad-prop-value">{shapeName}</span>
                  </div>
                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Code</span>
                    <span className="cad-prop-value">{shapeCode}</span>
                  </div>
                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Units</span>
                    <span className="cad-prop-value">Millimeters (mm)</span>
                  </div>
                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Total Elements</span>
                    <span className="cad-prop-value">{objects.length}</span>
                  </div>
                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Dimensions</span>
                    <span className="cad-prop-value">{dimensions.length}</span>
                  </div>
                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Parameters</span>
                    <span className="cad-prop-value">{parameters.length}</span>
                  </div>
                  <div className="cad-prop-row">
                    <span className="cad-prop-label">Active Rules</span>
                    <span className="cad-prop-value">{constraints.length}</span>
                  </div>
                </div>
              )}
            </>
          ) : rightPanelTab === 'parameters' ? (
            // PARAMETERS TAB (PHASE 2C)
            <div className="cad-panel-section">
              <div className="cad-section-title">
                <span>Shape Variables</span>
                <span className="cad-shape-badge">{parameters.length}</span>
              </div>

              {parameters.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '12px', padding: '12px 0' }}>
                  No parameters defined. Create parameters to drive geometry dynamically (e.g. WIDTH, HEIGHT, RADIUS).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {parameters.map(param => (
                    <div key={param.id} className="cad-param-item">
                      <div className="cad-param-header">
                        <span className="cad-param-name">{param.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="cad-param-badge">{param.category || 'Geometry'}</span>
                          <button
                            className="cad-param-delete-btn"
                            onClick={() => handleDeleteParameter(param.id)}
                            title="Delete Parameter"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="cad-param-controls">
                        <CADPropInput
                          value={param.value}
                          min={0.1}
                          allowZero={false}
                          onChange={(newVal) => handleParameterValueChange(param.id, newVal)}
                        />
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{param.unit || 'mm'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Parameter Button */}
              <button
                className="cad-add-param-btn"
                onClick={() => setShowAddParamModal(true)}
              >
                + Add Parameter
              </button>

              {showAddParamModal && (
                <form
                  onSubmit={handleCreateParameterSubmit}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '12px',
                    marginTop: '10px'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                    New Parameter
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Name</label>
                    <input
                      type="text"
                      className="cad-shape-name-input"
                      style={{ width: '100%', minWidth: 'unset', fontSize: '12px' }}
                      placeholder="e.g. WIDTH, HOOK_LEN"
                      value={newParamForm.name}
                      onChange={(e) => setNewParamForm({ ...newParamForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Value</label>
                    <input
                      type="text"
                      className="cad-shape-name-input"
                      style={{ width: '100%', minWidth: 'unset', fontSize: '12px' }}
                      value={newParamForm.value}
                      onChange={(e) => setNewParamForm({ ...newParamForm, value: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                    <button
                      type="submit"
                      className="cad-quick-btn"
                      style={{ flex: 1, background: '#0284c7', color: '#fff' }}
                    >
                      Save Parameter
                    </button>
                    <button
                      type="button"
                      className="cad-quick-btn"
                      style={{ flex: 1 }}
                      onClick={() => setShowAddParamModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            // CONSTRAINTS TAB (PHASE 2D)
            <div className="cad-panel-section">
              <div className="cad-section-title">
                <span>Parametric Rules</span>
                <span className="cad-shape-badge">{constraints.length}</span>
              </div>

              {/* Degrees of Freedom (DOF) Summary Card */}
              <div className="cad-dof-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>System State:</span>
                  <span className={`cad-dof-badge ${dofInfo.status}`}>
                    {dofInfo.status.replace('-', ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Remaining Freedom (DOF):</span>
                  <strong style={{ color: '#38bdf8' }}>{dofInfo.totalDOF}</strong>
                </div>
              </div>

              {/* Constraints List */}
              {constraints.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '12px', padding: '12px 0' }}>
                  No constraints applied yet. Select lines or shapes in the canvas and apply Horizontal, Vertical, Parallel, Perpendicular, Equal, or Fixed rules.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {constraints.map(c => (
                    <div key={c.id} className="cad-constraint-card">
                      <div className="cad-constraint-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="cad-constraint-type-badge">{c.type}</span>
                          <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>({c.references?.length || 1} ref)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            className="cad-param-delete-btn"
                            onClick={() => handleToggleConstraint(c.id)}
                            title={c.enabled ? "Suppress constraint" : "Enable constraint"}
                          >
                            {c.enabled ? "✓" : "⏸"}
                          </button>
                          <button
                            className="cad-param-delete-btn"
                            onClick={() => handleDeleteConstraint(c.id)}
                            title="Delete constraint"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {c.value !== null && typeof c.value !== 'object' && (
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                          Target: <strong>{c.value} mm</strong> {c.parameterName ? `(${c.parameterName})` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                className="cad-add-param-btn"
                style={{ marginTop: '14px' }}
                onClick={() => {
                  const res = runSolver(objects, constraints, parameters, true);
                  if (res.success) setStatusPrompt('✓ Constraints re-evaluated and solved.');
                }}
              >
                ⚡ Re-Solve Constraints
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* BOTTOM STATUS BAR */}
      <footer className="cad-statusbar">
        <div className="cad-status-group">
          <div className="cad-status-item">
            <span>X:</span>
            <strong>{cursorPos.x.toFixed(2)} mm</strong>
          </div>
          <div className="cad-status-item">
            <span>Y:</span>
            <strong>{cursorPos.y.toFixed(2)} mm</strong>
          </div>
          <div className="cad-status-item">
            <span>Zoom:</span>
            <strong>{Math.round(viewport.zoom * 100)}%</strong>
          </div>
        </div>

        <div className="cad-status-hint">
          {statusPrompt}
        </div>

        <div className="cad-status-group">
          <div
            className={`cad-status-toggle ${isOrthoEnabled ? 'active' : ''}`}
            onClick={() => setIsOrthoEnabled(!isOrthoEnabled)}
          >
            ORTHO: {isOrthoEnabled ? 'ON' : 'OFF'}
          </div>
          <div
            className={`cad-status-toggle ${gridVisible ? 'active' : ''}`}
            onClick={() => setGridVisible(!gridVisible)}
          >
            GRID: {gridVisible ? 'ON' : 'OFF'}
          </div>
          <div
            className={`cad-status-toggle ${snapSettings.enabled ? 'active' : ''}`}
            onClick={() => setSnapSettings({ ...snapSettings, enabled: !snapSettings.enabled })}
          >
            SNAP: {snapSettings.enabled ? (cursorPos.snapType ? cursorPos.snapType.toUpperCase() : 'ON') : 'OFF'}
          </div>
          <div className="cad-status-item">
            <span>DOF:</span>
            <strong style={{ color: dofInfo.status === 'fully-constrained' ? '#22c55e' : '#38bdf8' }}>{dofInfo.totalDOF}</strong>
          </div>
        </div>
      </footer>
    </div>
  );
}
