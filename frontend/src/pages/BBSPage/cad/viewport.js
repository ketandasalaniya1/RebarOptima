/**
 * Viewport Coordinate Transformer for 2D CAD Engine
 * World coordinates are in logical engineering units (millimeters, mm).
 * Cartesian convention: +X is Right, +Y is Up.
 */

/**
 * Transforms screen (browser canvas pixel) coordinates to logical World coordinates (mm).
 */
export function screenToWorld(screenX, screenY, vp) {
  const width = vp.width || 800;
  const height = vp.height || 600;
  const zoom = vp.zoom || 1.0;
  const panX = vp.panX || 0;
  const panY = vp.panY || 0;

  const centerX = width / 2;
  const centerY = height / 2;

  const wx = (screenX - centerX - panX) / zoom;
  const wy = (centerY + panY - screenY) / zoom;

  return { x: wx, y: wy };
}

/**
 * Transforms logical World coordinates (mm) to screen (pixel) coordinates.
 */
export function worldToScreen(worldX, worldY, vp) {
  const width = vp.width || 800;
  const height = vp.height || 600;
  const zoom = vp.zoom || 1.0;
  const panX = vp.panX || 0;
  const panY = vp.panY || 0;

  const centerX = width / 2;
  const centerY = height / 2;

  const sx = centerX + panX + worldX * zoom;
  const sy = centerY + panY - worldY * zoom;

  return { x: sx, y: sy };
}

/**
 * Zooms smoothly centered on cursor location.
 */
export function zoomAtPoint(screenX, screenY, zoomFactor, vp) {
  const width = vp.width || 800;
  const height = vp.height || 600;
  const currentZoom = vp.zoom || 1.0;
  const currentPanX = vp.panX || 0;
  const currentPanY = vp.panY || 0;

  const worldBefore = screenToWorld(screenX, screenY, vp);

  const minZoom = 0.05; // 5%
  const maxZoom = 50.0; // 5000%
  const newZoom = Math.min(maxZoom, Math.max(minZoom, currentZoom * zoomFactor));

  const centerX = width / 2;
  const centerY = height / 2;

  const newPanX = screenX - centerX - worldBefore.x * newZoom;
  const newPanY = screenY - centerY + worldBefore.y * newZoom;

  return {
    ...vp,
    zoom: newZoom,
    panX: newPanX,
    panY: newPanY
  };
}

/**
 * Pan viewport by pixel deltas
 */
export function panBy(deltaScreenX, deltaScreenY, vp) {
  return {
    ...vp,
    panX: (vp.panX || 0) + deltaScreenX,
    panY: (vp.panY || 0) + deltaScreenY
  };
}

/**
 * Reset viewport to origin (0,0) at 100% zoom
 */
export function resetViewport(vp) {
  return {
    ...vp,
    zoom: 1.0,
    panX: 0,
    panY: 0
  };
}

/**
 * Fits all geometry objects inside the canvas with padding
 */
export function fitToObjects(objects, vp, padding = 60) {
  if (!objects || objects.length === 0) {
    return resetViewport(vp);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    if (obj.type === 'line' || obj.type === 'dimension') {
      const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
      const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
      minX = Math.min(minX, p1.x, p2.x);
      maxX = Math.max(maxX, p1.x, p2.x);
      minY = Math.min(minY, p1.y, p2.y);
      maxY = Math.max(maxY, p1.y, p2.y);
    } else if (obj.type === 'rectangle') {
      minX = Math.min(minX, obj.x, obj.x + obj.width);
      maxX = Math.max(maxX, obj.x, obj.x + obj.width);
      minY = Math.min(minY, obj.y, obj.y + obj.height);
      maxY = Math.max(maxY, obj.y, obj.y + obj.height);
    } else if (obj.type === 'circle' || obj.type === 'arc') {
      const c = obj.center || { x: obj.cx || 0, y: obj.cy || 0 };
      const r = obj.radius || 0;
      minX = Math.min(minX, c.x - r);
      maxX = Math.max(maxX, c.x + r);
      minY = Math.min(minY, c.y - r);
      maxY = Math.max(maxY, c.y + r);
    } else if (obj.type === 'polyline') {
      if (obj.points) {
        for (const pt of obj.points) {
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y);
          maxY = Math.max(maxY, pt.y);
        }
      }
    }
  }

  if (!isFinite(minX) || !isFinite(maxX)) {
    return resetViewport(vp);
  }

  const geomWidth = Math.max(10, maxX - minX);
  const geomHeight = Math.max(10, maxY - minY);
  const geomCenterX = (minX + maxX) / 2;
  const geomCenterY = (minY + maxY) / 2;

  const canvasWidth = vp.width || 800;
  const canvasHeight = vp.height || 600;

  const availWidth = Math.max(50, canvasWidth - padding * 2);
  const availHeight = Math.max(50, canvasHeight - padding * 2);

  const zoomX = availWidth / geomWidth;
  const zoomY = availHeight / geomHeight;
  const newZoom = Math.min(zoomX, zoomY, 5.0); // max 500%

  return {
    ...vp,
    zoom: newZoom,
    panX: -geomCenterX * newZoom,
    panY: geomCenterY * newZoom
  };
}

export class Viewport {
  constructor(zoom = 1.0, panX = 0, panY = 0, width = 800, height = 600) {
    this.zoom = zoom;
    this.panX = panX;
    this.panY = panY;
    this.width = width;
    this.height = height;
  }

  screenToWorld(screenX, screenY) {
    return screenToWorld(screenX, screenY, this);
  }

  worldToScreen(worldX, worldY) {
    return worldToScreen(worldX, worldY, this);
  }
}
