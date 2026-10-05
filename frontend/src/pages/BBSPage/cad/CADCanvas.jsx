import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
  panBy
} from './viewport';
import {
  createLineObject,
  createPolylineObject,
  createRectangleObject,
  createCircleObject,
  createArcObject,
  createDimensionObject,
  hitTest,
  renderObject
} from './geometry';
import {
  renderDimension,
  createLinearDimension,
  createRadiusDimension,
  createDiameterDimension,
  hitTestDimension
} from './dimensionEngine';
import { renderConstraintGlyphs } from './constraintEngine';
import { findSnapPoint, renderSnapIndicator, getGridInterval, getObjectSnapCandidates } from './snapEngine';
import {
  applyOrthoConstraint,
  moveObjects,
  rotateObjects,
  copyObjects,
  mirrorObject,
  offsetLine,
  offsetRectangle,
  trimLine,
  extendLine,
  filletLines,
  updateObjectGrip
} from './editEngine';
import { CAD_TOOLS, DIMENSION_TYPES } from './types';

export default function CADCanvas({
  objects = [],
  onObjectsChange,
  dimensions = [],
  onDimensionsChange,
  parameters = [],
  constraints = [],
  showConstraints = true,
  selectedObjectIds = [],
  onSelectObjects,
  selectedDimensionIds = [],
  onSelectDimensions,
  onDimensionDoubleClick,
  activeTool = CAD_TOOLS.SELECT,
  onToolComplete,
  viewport,
  onViewportChange,
  snapSettings,
  onCursorMove,
  gridVisible = true,
  isOrthoEnabled = false,
  filletRadius = 25,
  offsetDistance = 25,
  historyManager,
  onContextMenuOpen,
  onStatusPromptChange
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // In-progress interactive state
  const [interactiveState, setInteractiveState] = useState(null);
  // Current snap point
  const [currentSnap, setCurrentSnap] = useState(null);
  // Pan state for middle-mouse or space drag
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Grip dragging state
  const [activeGripDrag, setActiveGripDrag] = useState(null); // { objId, gripIndex, startPos }
  // Box selection drag state
  const [boxSelection, setBoxSelection] = useState(null); // { startScreen, curScreen, startWorld, curWorld }

  // High-performance viewport ref to avoid re-triggering resize observers
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const rafIdRef = useRef(null);

  // Dynamic Canvas Resize Observer (Only runs on container dimension changes)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const width = rect.width;
      const height = rect.height;
      if (width <= 0 || height <= 0) return;

      canvasRef.current.width = Math.round(width * dpr);
      canvasRef.current.height = Math.round(height * dpr);
      canvasRef.current.style.width = `${width}px`;
      canvasRef.current.style.height = `${height}px`;

      const curVp = viewportRef.current;
      if (curVp.width !== width || curVp.height !== height) {
        onViewportChange({
          ...curVp,
          width,
          height
        });
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [onViewportChange]);

  // High-Performance Native Wheel Zoom (Cursor-Centered, Non-Passive)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheelHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Smooth CAD Zoom Factor (Fast & responsive without lag)
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;

      const curVp = viewportRef.current;
      const newVp = zoomAtPoint(screenX, screenY, zoomFactor, curVp);
      onViewportChange(newVp);
    };

    container.addEventListener('wheel', onWheelHandler, { passive: false });
    return () => container.removeEventListener('wheel', onWheelHandler);
  }, [onViewportChange]);

  // Main Render Loop (Batched with requestAnimationFrame for 60-120fps)
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Background CAD canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // 1. Render Grid
    if (gridVisible) {
      renderGrid(ctx, viewport, width, height);
    }

    // 2. Render Origin (X/Y axes)
    renderOriginAxes(ctx, viewport, width, height);

    // 3. Render Committed Geometry Objects
    objects.forEach(obj => {
      const isSelected = selectedObjectIds.includes(obj.id);
      renderObject(ctx, obj, viewport, isSelected);
    });

    // 4. Render Committed Engineering Dimensions (Phase 2C)
    dimensions.forEach(dim => {
      const isSelected = selectedDimensionIds && selectedDimensionIds.includes(dim.id);
      renderDimension(ctx, dim, viewport, isSelected);
    });

    // 5. Render Active In-Progress Tool / Preview
    if (interactiveState) {
      renderInteractivePreview(ctx, interactiveState, viewport);
    }

    // 6. Render Box Selection Rectangle
    if (boxSelection) {
      renderBoxSelection(ctx, boxSelection);
    }

    // 7. Render Snap Marker
    if (currentSnap) {
      renderSnapIndicator(ctx, currentSnap, viewport);
    }

    // 8. Render Parametric Constraint Glyphs (Phase 2D)
    if (showConstraints && constraints && constraints.length > 0) {
      renderConstraintGlyphs(ctx, constraints, objects, viewport);
    }

    ctx.restore();
  }, [objects, dimensions, constraints, showConstraints, selectedObjectIds, selectedDimensionIds, interactiveState, boxSelection, currentSnap, viewport, gridVisible]);

  useEffect(() => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      renderCanvas();
    });
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [renderCanvas]);

  // Grid Drawing Helper (Clamped for performance)
  const renderGrid = (ctx, vp, w, h) => {
    const interval = getGridInterval(vp.zoom, snapSettings?.gridSize || 10);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';

    const startWorld = screenToWorld(0, h, vp);
    const endWorld = screenToWorld(w, 0, vp);

    const startX = Math.floor(startWorld.x / interval) * interval;
    const endX = Math.ceil(endWorld.x / interval) * interval;
    const startY = Math.floor(startWorld.y / interval) * interval;
    const endY = Math.ceil(endWorld.y / interval) * interval;

    // Safety limit to prevent drawing too many lines on extreme zooms
    const numLinesX = (endX - startX) / interval;
    const numLinesY = (endY - startY) / interval;
    if (numLinesX > 300 || numLinesY > 300) return;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += interval) {
      const screenX = worldToScreen(x, 0, vp).x;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, h);
    }
    for (let y = startY; y <= endY; y += interval) {
      const screenY = worldToScreen(0, y, vp).y;
      ctx.moveTo(0, screenY);
      ctx.lineTo(w, screenY);
    }
    ctx.stroke();

    // Major grid lines (every 5 intervals)
    const majorInterval = interval * 5;
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
    ctx.beginPath();
    const majorStartX = Math.floor(startWorld.x / majorInterval) * majorInterval;
    const majorEndX = Math.ceil(endWorld.x / majorInterval) * majorInterval;
    const majorStartY = Math.floor(startWorld.y / majorInterval) * majorInterval;
    const majorEndY = Math.ceil(endWorld.y / majorInterval) * majorInterval;

    for (let x = majorStartX; x <= majorEndX; x += majorInterval) {
      const screenX = worldToScreen(x, 0, vp).x;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, h);
    }
    for (let y = majorStartY; y <= majorEndY; y += majorInterval) {
      const screenY = worldToScreen(0, y, vp).y;
      ctx.moveTo(0, screenY);
      ctx.lineTo(w, screenY);
    }
    ctx.stroke();
  };

  // Origin Axes Helper
  const renderOriginAxes = (ctx, vp, w, h) => {
    const origin = worldToScreen(0, 0, vp);

    // X Axis (Reddish)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(w, origin.y);
    ctx.stroke();

    // Y Axis (Greenish)
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, h);
    ctx.stroke();

    // Origin symbol
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText('0,0 (mm)', origin.x + 6, origin.y - 6);
  };

  // Box Selection Rectangle Helper
  const renderBoxSelection = (ctx, box) => {
    const { startScreen, curScreen } = box;
    const x = Math.min(startScreen.x, curScreen.x);
    const y = Math.min(startScreen.y, curScreen.y);
    const w = Math.abs(curScreen.x - startScreen.x);
    const h = Math.abs(curScreen.y - startScreen.y);

    const isCrossing = curScreen.x < startScreen.x;

    ctx.save();
    if (isCrossing) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
      ctx.strokeStyle = '#22c55e';
      ctx.setLineDash([5, 5]);
    } else {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([]);
    }
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  };

  // Interactive Live Previews Helper
  const renderInteractivePreview = (ctx, state, vp) => {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    const { tool, points, currentPoint, basePoint } = state;

    if (tool === CAD_TOOLS.LINE && points.length === 1) {
      const p1 = worldToScreen(points[0].x, points[0].y, vp);
      const p2 = worldToScreen(currentPoint.x, currentPoint.y, vp);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      const dist = Math.hypot(currentPoint.x - points[0].x, currentPoint.y - points[0].y);
      const angle = (Math.atan2(currentPoint.y - points[0].y, currentPoint.x - points[0].x) * 180 / Math.PI + 360) % 360;
      drawBadge(ctx, `${dist.toFixed(1)} mm  ∠ ${angle.toFixed(1)}°`, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 12);
    } else if (tool === CAD_TOOLS.POLYLINE && points.length > 0) {
      ctx.beginPath();
      const first = worldToScreen(points[0].x, points[0].y, vp);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < points.length; i++) {
        const p = worldToScreen(points[i].x, points[i].y, vp);
        ctx.lineTo(p.x, p.y);
      }
      const cur = worldToScreen(currentPoint.x, currentPoint.y, vp);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();

      const last = points[points.length - 1];
      const dist = Math.hypot(currentPoint.x - last.x, currentPoint.y - last.y);
      const curScreen = worldToScreen(currentPoint.x, currentPoint.y, vp);
      drawBadge(ctx, `${dist.toFixed(1)} mm`, curScreen.x + 12, curScreen.y - 12);
    } else if (tool === CAD_TOOLS.RECTANGLE && points.length === 1) {
      const p1 = worldToScreen(points[0].x, points[0].y, vp);
      const p2 = worldToScreen(currentPoint.x, currentPoint.y, vp);
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);

      ctx.strokeRect(x, y, w, h);

      const worldW = Math.abs(currentPoint.x - points[0].x);
      const worldH = Math.abs(currentPoint.y - points[0].y);
      drawBadge(ctx, `${worldW.toFixed(0)} × ${worldH.toFixed(0)} mm`, x + w / 2, y + h / 2);
    } else if (tool === CAD_TOOLS.CIRCLE && points.length === 1) {
      const center = worldToScreen(points[0].x, points[0].y, vp);
      const radiusWorld = Math.hypot(currentPoint.x - points[0].x, currentPoint.y - points[0].y);
      const radiusScreen = radiusWorld * vp.zoom;

      ctx.beginPath();
      ctx.arc(center.x, center.y, radiusScreen, 0, Math.PI * 2);
      ctx.stroke();

      const cur = worldToScreen(currentPoint.x, currentPoint.y, vp);
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();

      drawBadge(ctx, `R: ${radiusWorld.toFixed(1)} mm (Ø ${(radiusWorld * 2).toFixed(1)})`, (center.x + cur.x) / 2, (center.y + cur.y) / 2 - 10);
    } else if (tool === CAD_TOOLS.ARC) {
      if (points.length === 1) {
        const p1 = worldToScreen(points[0].x, points[0].y, vp);
        const p2 = worldToScreen(currentPoint.x, currentPoint.y, vp);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (points.length === 2) {
        const arc = createArcObject(points[0], currentPoint, points[1]);
        renderObject(ctx, arc, vp, false);
      }
    } else if ((tool === CAD_TOOLS.DIMENSION || tool === CAD_TOOLS.DIM_LINEAR) && points) {
      if (points.length === 1) {
        const p1 = worldToScreen(points[0].x, points[0].y, vp);
        const p2 = worldToScreen(currentPoint.x, currentPoint.y, vp);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        drawBadge(ctx, 'Select Point 2', p2.x + 12, p2.y);
      } else if (points.length === 2) {
        const previewDim = createLinearDimension(points[0], points[1], currentPoint.y - points[0].y);
        renderDimension(ctx, previewDim, vp, false);
      }
    } else if ((tool === CAD_TOOLS.MOVE || tool === CAD_TOOLS.COPY) && basePoint) {
      const dx = currentPoint.x - basePoint.x;
      const dy = currentPoint.y - basePoint.y;
      const movedObjects = moveObjects(objects, selectedObjectIds, dx, dy);
      movedObjects.forEach(obj => {
        if (selectedObjectIds.includes(obj.id)) {
          renderObject(ctx, obj, vp, true);
        }
      });
      const p1 = worldToScreen(basePoint.x, basePoint.y, vp);
      const p2 = worldToScreen(currentPoint.x, currentPoint.y, vp);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      const dist = Math.hypot(dx, dy);
      drawBadge(ctx, `${tool.toUpperCase()}: Δ (${dx.toFixed(1)}, ${dy.toFixed(1)}) mm [${dist.toFixed(1)} mm]`, p2.x + 12, p2.y - 12);
    } else if (tool === CAD_TOOLS.ROTATE && basePoint) {
      const angleRad = Math.atan2(currentPoint.y - basePoint.y, currentPoint.x - basePoint.x);
      const angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
      const rotated = rotateObjects(objects, selectedObjectIds, basePoint, angleRad);
      rotated.forEach(obj => {
        if (selectedObjectIds.includes(obj.id)) {
          renderObject(ctx, obj, vp, true);
        }
      });
      const centerScreen = worldToScreen(basePoint.x, basePoint.y, vp);
      const curScreen = worldToScreen(currentPoint.x, currentPoint.y, vp);
      ctx.beginPath();
      ctx.moveTo(centerScreen.x, centerScreen.y);
      ctx.lineTo(curScreen.x, curScreen.y);
      ctx.stroke();
      drawBadge(ctx, `ROTATE: ${angleDeg.toFixed(1)}°`, curScreen.x + 12, curScreen.y - 12);
    } else if (tool === CAD_TOOLS.MIRROR && basePoint) {
      const p1 = worldToScreen(basePoint.x, basePoint.y, vp);
      const p2 = worldToScreen(currentPoint.x, currentPoint.y, vp);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      selectedObjectIds.forEach(id => {
        const target = objects.find(o => o.id === id);
        if (target) {
          const mirrored = mirrorObject(target, basePoint, currentPoint);
          renderObject(ctx, mirrored, vp, true);
        }
      });
      drawBadge(ctx, 'MIRROR AXIS', (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 12);
    }

    ctx.restore();
  };

  const drawBadge = (ctx, text, x, y) => {
    ctx.save();
    ctx.setLineDash([]);
    ctx.font = '11px Inter, system-ui, sans-serif';
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - textWidth / 2 - 6, y - 10, textWidth + 12, 20, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // Coordinates with Snap & Ortho Mode
  const getPointerCoordinates = (e, basePointForOrtho = null) => {
    if (!canvasRef.current) return { screen: { x: 0, y: 0 }, rawWorld: { x: 0, y: 0 }, snappedWorld: { x: 0, y: 0 }, snap: null };
    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const rawWorld = screenToWorld(screenX, screenY, viewport);
    let effectiveWorld = rawWorld;

    if (isOrthoEnabled && basePointForOrtho) {
      effectiveWorld = applyOrthoConstraint(basePointForOrtho, rawWorld, true);
    }

    const snap = findSnapPoint(effectiveWorld, objects, snapSettings, viewport);
    const snappedWorld = snap ? { x: snap.x, y: snap.y } : effectiveWorld;

    return {
      screen: { x: screenX, y: screenY },
      rawWorld,
      snappedWorld,
      snap
    };
  };

  // Helper to Hit Test Grip Handles
  const hitTestGrip = (screenPt) => {
    if (selectedObjectIds.length !== 1) return null;
    const obj = objects.find(o => o.id === selectedObjectIds[0]);
    if (!obj) return null;

    const candidates = getObjectSnapCandidates(obj);
    for (let i = 0; i < candidates.length; i++) {
      const screenCand = worldToScreen(candidates[i].x, candidates[i].y, viewport);
      const dist = Math.hypot(screenPt.x - screenCand.x, screenPt.y - screenCand.y);
      if (dist <= 8) {
        return { objId: obj.id, gripIndex: i, worldPos: candidates[i] };
      }
    }
    return null;
  };

  // Pointer Down Handler
  const handlePointerDown = (e) => {
    if (e.button === 1 || e.spaceKey || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button === 2) {
      if (onContextMenuOpen) {
        onContextMenuOpen({
          clientX: e.clientX,
          clientY: e.clientY
        });
      }
      return;
    }

    if (e.button !== 0) return;

    const screenPt = {
      x: e.clientX - canvasRef.current.getBoundingClientRect().left,
      y: e.clientY - canvasRef.current.getBoundingClientRect().top
    };

    // 1. Grip Hit Test
    if (activeTool === CAD_TOOLS.SELECT) {
      const gripHit = hitTestGrip(screenPt);
      if (gripHit) {
        setActiveGripDrag(gripHit);
        historyManager.pushSnapshot(objects);
        return;
      }
    }

    const basePt = interactiveState?.points?.[0] || interactiveState?.basePoint || null;
    const { snappedWorld, rawWorld, screen } = getPointerCoordinates(e, basePt);

    // 2. SELECT TOOL & BOX SELECTION
    if (activeTool === CAD_TOOLS.SELECT) {
      // First hit-test dimensions (Phase 2C)
      let hitDim = null;
      for (let i = dimensions.length - 1; i >= 0; i--) {
        if (hitTestDimension(dimensions[i], rawWorld, viewport.zoom)) {
          hitDim = dimensions[i];
          break;
        }
      }

      if (hitDim) {
        if (onSelectDimensions) onSelectDimensions([hitDim.id]);
        onSelectObjects([]);
        return;
      }

      // Hit-test geometry objects
      let hitObj = null;
      for (let i = objects.length - 1; i >= 0; i--) {
        if (hitTest(objects[i], rawWorld, viewport.zoom)) {
          hitObj = objects[i];
          break;
        }
      }

      if (hitObj) {
        if (onSelectDimensions) onSelectDimensions([]);
        if (e.shiftKey) {
          if (selectedObjectIds.includes(hitObj.id)) {
            onSelectObjects(selectedObjectIds.filter(id => id !== hitObj.id));
          } else {
            onSelectObjects([...selectedObjectIds, hitObj.id]);
          }
        } else {
          onSelectObjects([hitObj.id]);
        }
      } else {
        setBoxSelection({
          startScreen: screen,
          curScreen: screen,
          startWorld: rawWorld,
          curWorld: rawWorld
        });
        if (!e.shiftKey) {
          onSelectObjects([]);
          if (onSelectDimensions) onSelectDimensions([]);
        }
      }
      return;
    }

    // 3. DRAWING TOOLS
    if (activeTool === CAD_TOOLS.LINE) {
      if (!interactiveState) {
        setInteractiveState({
          tool: CAD_TOOLS.LINE,
          points: [snappedWorld],
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('Line: Specify end point (Press Esc to cancel, F8 for Ortho)');
      } else {
        const startPoint = interactiveState.points[0];
        const endPoint = snappedWorld;
        if (startPoint.x !== endPoint.x || startPoint.y !== endPoint.y) {
          const newLine = createLineObject(startPoint, endPoint);
          historyManager.pushSnapshot(objects);
          onObjectsChange([...objects, newLine]);
        }
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    } else if (activeTool === CAD_TOOLS.POLYLINE) {
      if (!interactiveState) {
        setInteractiveState({
          tool: CAD_TOOLS.POLYLINE,
          points: [snappedWorld],
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('Polyline: Click next vertex, double-click or Enter to finish');
      } else {
        const lastPt = interactiveState.points[interactiveState.points.length - 1];
        if (lastPt.x !== snappedWorld.x || lastPt.y !== snappedWorld.y) {
          setInteractiveState({
            ...interactiveState,
            points: [...interactiveState.points, snappedWorld],
            currentPoint: snappedWorld
          });
        }
      }
    } else if (activeTool === CAD_TOOLS.RECTANGLE) {
      if (!interactiveState) {
        setInteractiveState({
          tool: CAD_TOOLS.RECTANGLE,
          points: [snappedWorld],
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('Rectangle: Specify opposite corner');
      } else {
        const corner1 = interactiveState.points[0];
        const corner2 = snappedWorld;
        const newRect = createRectangleObject(corner1, corner2);
        historyManager.pushSnapshot(objects);
        onObjectsChange([...objects, newRect]);
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    } else if (activeTool === CAD_TOOLS.CIRCLE) {
      if (!interactiveState) {
        setInteractiveState({
          tool: CAD_TOOLS.CIRCLE,
          points: [snappedWorld],
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('Circle: Specify radius point');
      } else {
        const center = interactiveState.points[0];
        const radius = Math.hypot(snappedWorld.x - center.x, snappedWorld.y - center.y);
        if (radius > 0) {
          const newCircle = createCircleObject(center, radius);
          historyManager.pushSnapshot(objects);
          onObjectsChange([...objects, newCircle]);
        }
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    } else if (activeTool === CAD_TOOLS.ARC) {
      if (!interactiveState) {
        setInteractiveState({
          tool: CAD_TOOLS.ARC,
          points: [snappedWorld],
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('Arc: Specify end point');
      } else if (interactiveState.points.length === 1) {
        setInteractiveState({
          ...interactiveState,
          points: [interactiveState.points[0], snappedWorld],
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('Arc: Specify bulge/third point');
      } else if (interactiveState.points.length === 2) {
        const newArc = createArcObject(interactiveState.points[0], snappedWorld, interactiveState.points[1]);
        historyManager.pushSnapshot(objects);
        onObjectsChange([...objects, newArc]);
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    }

    // 4. DIMENSION TOOLS (Phase 2C)
    else if (activeTool === CAD_TOOLS.DIMENSION || activeTool === CAD_TOOLS.DIM_LINEAR) {
      if (!interactiveState) {
        setInteractiveState({
          tool: CAD_TOOLS.DIM_LINEAR,
          points: [snappedWorld],
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('Dimension: Select second point for measurement');
      } else if (interactiveState.points.length === 1) {
        setInteractiveState({
          ...interactiveState,
          points: [interactiveState.points[0], snappedWorld],
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('Dimension: Click position to place dimension leader line');
      } else if (interactiveState.points.length === 2) {
        const p1 = interactiveState.points[0];
        const p2 = interactiveState.points[1];
        const offset = Math.abs(snappedWorld.y - p1.y) > 5 ? (snappedWorld.y - p1.y) : 25;

        // Detect if measuring a specific object
        let targetObjectId = null;
        let property = 'length';
        const hitObj = objects.find(o => hitTest(o, p1, viewport.zoom));
        if (hitObj) {
          targetObjectId = hitObj.id;
          if (hitObj.type === 'rectangle') {
            const isHoriz = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x);
            property = isHoriz ? 'width' : 'height';
          }
        }

        const newDim = createLinearDimension(p1, p2, offset, { targetObjectId, property });
        if (onDimensionsChange) {
          onDimensionsChange([...dimensions, newDim]);
        }
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    } else if (activeTool === CAD_TOOLS.DIM_RADIUS || activeTool === CAD_TOOLS.DIM_DIAMETER) {
      // Find circle or arc under click
      let circ = null;
      for (let i = objects.length - 1; i >= 0; i--) {
        if (hitTest(objects[i], rawWorld, viewport.zoom) && (objects[i].type === 'circle' || objects[i].type === 'arc')) {
          circ = objects[i];
          break;
        }
      }
      if (circ) {
        const c = circ.center || { x: circ.cx || 0, y: circ.cy || 0 };
        const newDim = activeTool === CAD_TOOLS.DIM_RADIUS
          ? createRadiusDimension(c, circ.radius, Math.PI / 4, { targetObjectId: circ.id })
          : createDiameterDimension(c, circ.radius, Math.PI / 4, { targetObjectId: circ.id });

        if (onDimensionsChange) {
          onDimensionsChange([...dimensions, newDim]);
        }
      }
      if (onToolComplete) onToolComplete();
    }

    // 5. TRANSFORMATION TOOLS
    else if (activeTool === CAD_TOOLS.MOVE || activeTool === CAD_TOOLS.COPY) {
      if (!interactiveState) {
        setInteractiveState({
          tool: activeTool,
          basePoint: snappedWorld,
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange(`${activeTool.toUpperCase()}: Specify destination point`);
      } else {
        const base = interactiveState.basePoint;
        const dx = snappedWorld.x - base.x;
        const dy = snappedWorld.y - base.y;

        historyManager.pushSnapshot(objects);
        if (activeTool === CAD_TOOLS.MOVE) {
          const moved = moveObjects(objects, selectedObjectIds, dx, dy);
          onObjectsChange(moved);
        } else {
          const copied = copyObjects(objects, selectedObjectIds, dx, dy);
          onObjectsChange([...objects, ...copied]);
          onSelectObjects(copied.map(c => c.id));
        }
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    } else if (activeTool === CAD_TOOLS.ROTATE) {
      if (!interactiveState) {
        setInteractiveState({
          tool: CAD_TOOLS.ROTATE,
          basePoint: snappedWorld,
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('ROTATE: Specify rotation destination angle');
      } else {
        const base = interactiveState.basePoint;
        const angleRad = Math.atan2(snappedWorld.y - base.y, snappedWorld.x - base.x);
        historyManager.pushSnapshot(objects);
        const rotated = rotateObjects(objects, selectedObjectIds, base, angleRad);
        onObjectsChange(rotated);
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    } else if (activeTool === CAD_TOOLS.MIRROR) {
      if (!interactiveState) {
        setInteractiveState({
          tool: CAD_TOOLS.MIRROR,
          basePoint: snappedWorld,
          currentPoint: snappedWorld
        });
        if (onStatusPromptChange) onStatusPromptChange('MIRROR: Specify second point of mirror axis line');
      } else {
        const p1 = interactiveState.basePoint;
        const p2 = snappedWorld;
        historyManager.pushSnapshot(objects);
        const mirroredList = [];
        selectedObjectIds.forEach(id => {
          const obj = objects.find(o => o.id === id);
          if (obj) {
            mirroredList.push(mirrorObject(obj, p1, p2));
          }
        });
        onObjectsChange([...objects, ...mirroredList]);
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    } else if (activeTool === CAD_TOOLS.OFFSET) {
      let targetObj = objects.find(o => selectedObjectIds.includes(o.id));
      if (!targetObj) {
        for (let i = objects.length - 1; i >= 0; i--) {
          if (hitTest(objects[i], rawWorld, viewport.zoom)) {
            targetObj = objects[i];
            break;
          }
        }
      }

      if (targetObj) {
        historyManager.pushSnapshot(objects);
        let offsetResult = null;
        if (targetObj.type === 'line') {
          offsetResult = offsetLine(targetObj, offsetDistance, rawWorld);
        } else if (targetObj.type === 'rectangle') {
          offsetResult = offsetRectangle(targetObj, offsetDistance, rawWorld);
        }

        if (offsetResult) {
          onObjectsChange([...objects, offsetResult]);
          onSelectObjects([offsetResult.id]);
        }
      }
      if (onToolComplete) onToolComplete();
    } else if (activeTool === CAD_TOOLS.TRIM) {
      if (!interactiveState) {
        let cutObj = null;
        for (let i = objects.length - 1; i >= 0; i--) {
          if (hitTest(objects[i], rawWorld, viewport.zoom) && objects[i].type === 'line') {
            cutObj = objects[i];
            break;
          }
        }
        if (cutObj) {
          setInteractiveState({
            tool: CAD_TOOLS.TRIM,
            cuttingObj: cutObj
          });
          if (onStatusPromptChange) onStatusPromptChange('TRIM: Click intersecting line segment to trim');
        }
      } else {
        let targetObj = null;
        for (let i = objects.length - 1; i >= 0; i--) {
          if (hitTest(objects[i], rawWorld, viewport.zoom) && objects[i].id !== interactiveState.cuttingObj.id && objects[i].type === 'line') {
            targetObj = objects[i];
            break;
          }
        }
        if (targetObj) {
          const trimRes = trimLine(targetObj, interactiveState.cuttingObj, rawWorld);
          if (trimRes.success) {
            historyManager.pushSnapshot(objects);
            const updated = objects.map(o => o.id === targetObj.id ? trimRes.result : o);
            onObjectsChange(updated);
          }
        }
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    } else if (activeTool === CAD_TOOLS.EXTEND) {
      if (!interactiveState) {
        let boundaryObj = null;
        for (let i = objects.length - 1; i >= 0; i--) {
          if (hitTest(objects[i], rawWorld, viewport.zoom) && objects[i].type === 'line') {
            boundaryObj = objects[i];
            break;
          }
        }
        if (boundaryObj) {
          setInteractiveState({
            tool: CAD_TOOLS.EXTEND,
            boundaryObj
          });
          if (onStatusPromptChange) onStatusPromptChange('EXTEND: Click line to extend towards boundary');
        }
      } else {
        let targetObj = null;
        for (let i = objects.length - 1; i >= 0; i--) {
          if (hitTest(objects[i], rawWorld, viewport.zoom) && objects[i].id !== interactiveState.boundaryObj.id && objects[i].type === 'line') {
            targetObj = objects[i];
            break;
          }
        }
        if (targetObj) {
          const extendRes = extendLine(targetObj, interactiveState.boundaryObj);
          if (extendRes.success) {
            historyManager.pushSnapshot(objects);
            const updated = objects.map(o => o.id === targetObj.id ? extendRes.result : o);
            onObjectsChange(updated);
          }
        }
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    } else if (activeTool === CAD_TOOLS.FILLET) {
      if (!interactiveState) {
        let line1 = null;
        for (let i = objects.length - 1; i >= 0; i--) {
          if (hitTest(objects[i], rawWorld, viewport.zoom) && objects[i].type === 'line') {
            line1 = objects[i];
            break;
          }
        }
        if (line1) {
          setInteractiveState({
            tool: CAD_TOOLS.FILLET,
            line1
          });
          if (onStatusPromptChange) onStatusPromptChange('FILLET: Select second line to create corner fillet');
        }
      } else {
        let line2 = null;
        for (let i = objects.length - 1; i >= 0; i--) {
          if (hitTest(objects[i], rawWorld, viewport.zoom) && objects[i].id !== interactiveState.line1.id && objects[i].type === 'line') {
            line2 = objects[i];
            break;
          }
        }
        if (line2) {
          const filletRes = filletLines(interactiveState.line1, line2, filletRadius);
          if (filletRes.success) {
            historyManager.pushSnapshot(objects);
            const remaining = objects.filter(o => o.id !== interactiveState.line1.id && o.id !== line2.id);
            onObjectsChange([...remaining, filletRes.result.line1, filletRes.result.line2, filletRes.result.arc]);
          }
        }
        setInteractiveState(null);
        if (onToolComplete) onToolComplete();
      }
    }
  };

  // Pointer Move Handler
  const handlePointerMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      onViewportChange(panBy(dx, dy, viewport));
      return;
    }

    const basePt = interactiveState?.points?.[0] || interactiveState?.basePoint || null;
    const { snappedWorld, rawWorld, screen, snap } = getPointerCoordinates(e, basePt);
    setCurrentSnap(snap);

    if (onCursorMove) {
      onCursorMove({
        x: snappedWorld.x,
        y: snappedWorld.y,
        snapType: snap ? snap.type : null
      });
    }

    if (activeGripDrag) {
      const target = objects.find(o => o.id === activeGripDrag.objId);
      if (target) {
        const updated = updateObjectGrip(target, activeGripDrag.gripIndex, snappedWorld);
        onObjectsChange(objects.map(o => o.id === target.id ? updated : o));
      }
      return;
    }

    if (boxSelection) {
      setBoxSelection(prev => ({
        ...prev,
        curScreen: screen,
        curWorld: rawWorld
      }));
      return;
    }

    if (interactiveState) {
      setInteractiveState(prev => prev ? {
        ...prev,
        currentPoint: snappedWorld
      } : null);
    }
  };

  // Pointer Up Handler
  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (activeGripDrag) {
      setActiveGripDrag(null);
      return;
    }

    if (boxSelection) {
      const { startWorld, curWorld } = boxSelection;
      const minX = Math.min(startWorld.x, curWorld.x);
      const maxX = Math.max(startWorld.x, curWorld.x);
      const minY = Math.min(startWorld.y, curWorld.y);
      const maxY = Math.max(startWorld.y, curWorld.y);

      const isCrossing = boxSelection.curScreen.x < boxSelection.startScreen.x;

      const selected = [];
      objects.forEach(obj => {
        const candidates = getObjectSnapCandidates(obj);
        if (isCrossing) {
          const anyInside = candidates.some(pt => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY);
          if (anyInside) selected.push(obj.id);
        } else {
          const allInside = candidates.length > 0 && candidates.every(pt => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY);
          if (allInside) selected.push(obj.id);
        }
      });

      onSelectObjects(selected);
      setBoxSelection(null);
    }
  };

  // Mouse Wheel (Zoom)
  const handleWheel = (e) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    const newViewport = zoomAtPoint(screenX, screenY, factor, viewport);
    onViewportChange(newViewport);
  };

  // Double Click for Polyline finish or Dimension editing
  const handleDoubleClick = (e) => {
    if (activeTool === CAD_TOOLS.POLYLINE && interactiveState && interactiveState.points.length >= 2) {
      const newPoly = createPolylineObject(interactiveState.points);
      historyManager.pushSnapshot(objects);
      onObjectsChange([...objects, newPoly]);
      setInteractiveState(null);
      if (onToolComplete) onToolComplete();
      return;
    }

    // Check if double-clicked a dimension
    const { rawWorld } = getPointerCoordinates(e);
    for (let i = dimensions.length - 1; i >= 0; i--) {
      if (hitTestDimension(dimensions[i], rawWorld, viewport.zoom)) {
        if (onDimensionDoubleClick) {
          onDimensionDoubleClick(dimensions[i]);
        }
        break;
      }
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;

      if (e.key === 'Escape') {
        if (interactiveState) {
          setInteractiveState(null);
        } else {
          if (selectedObjectIds.length > 0) onSelectObjects([]);
          if (selectedDimensionIds && selectedDimensionIds.length > 0 && onSelectDimensions) onSelectDimensions([]);
        }
      }

      if (e.key === 'Enter') {
        if (activeTool === CAD_TOOLS.POLYLINE && interactiveState && interactiveState.points.length >= 2) {
          const newPoly = createPolylineObject(interactiveState.points);
          historyManager.pushSnapshot(objects);
          onObjectsChange([...objects, newPoly]);
          setInteractiveState(null);
          if (onToolComplete) onToolComplete();
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectIds.length > 0) {
          historyManager.pushSnapshot(objects);
          const remaining = objects.filter(obj => !selectedObjectIds.includes(obj.id));
          onObjectsChange(remaining);
          onSelectObjects([]);
        } else if (selectedDimensionIds && selectedDimensionIds.length > 0) {
          const remainingDims = dimensions.filter(d => !selectedDimensionIds.includes(d.id));
          if (onDimensionsChange) onDimensionsChange(remainingDims);
          if (onSelectDimensions) onSelectDimensions([]);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        const previous = historyManager.undo(objects);
        if (previous !== null) {
          onObjectsChange(previous);
          onSelectObjects([]);
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        const next = historyManager.redo(objects);
        if (next !== null) {
          onObjectsChange(next);
          onSelectObjects([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interactiveState, selectedObjectIds, selectedDimensionIds, objects, dimensions, onObjectsChange, onDimensionsChange, onSelectObjects, onSelectDimensions, activeTool, historyManager, onToolComplete]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: isPanning ? 'grab' : activeTool === CAD_TOOLS.SELECT ? 'default' : 'crosshair',
        backgroundColor: '#0f172a',
        userSelect: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
}
