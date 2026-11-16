import React, { useEffect, useRef, useState, useCallback, Component } from 'react';
import { createApp, h, shallowReactive } from 'vue';
import { MlCadViewer, i18n } from '@mlightcad/cad-viewer';
import '../cad-viewer.css';
import { AcApDocManager, AcApSettingManager, AcTrScene } from '@mlightcad/cad-simple-viewer';
import {
  AcDbDatabaseConverterManager,
  AcDbFileType,
  AcDbLayerTableRecord,
  AcGeBox2d,
  AcGePoint2d
} from '@mlightcad/data-model';
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { AlertCircle, Loader2, Download, Maximize2, RefreshCw } from 'lucide-react';

// ── 1. Configure AcApSettingManager (Hide Ribbons & Command Line for Clean Viewer) ──
if (typeof window !== 'undefined') {
  try {
    AcApSettingManager?.configure?.({
      storageKey: 'rebaroptima.cad.viewer'
    });
    AcApSettingManager?.instance?.apply?.(
      {
        isShowCommandLine: false,
        isShowToolbar: false,
        isShowRibbon: false,
        isShowCoordinate: false,
        isShowEntityInfo: false,
        isShowLanguageSelector: false,
        isShowStats: false
      },
      { persist: false }
    );
  } catch (err) {
    console.warn('[CADViewer] AcApSettingManager setup notice:', err);
  }
}

// ── 2. Guard AcTrScene Layout Creation (Fixes "No layout associated with id") ──
if (typeof window !== 'undefined' && AcTrScene?.prototype) {
  try {
    const origModelDesc = Object.getOwnPropertyDescriptor(AcTrScene.prototype, 'modelSpaceBtrId');
    if (origModelDesc?.set) {
      Object.defineProperty(AcTrScene.prototype, 'modelSpaceBtrId', {
        get: origModelDesc.get,
        set: function (value) {
          this._modelSpaceBtrId = value;
          if (value && !this._layouts.has(value)) {
            this.addEmptyLayout(value);
          }
        },
        enumerable: false,
        configurable: true
      });
    }

    const origActiveDesc = Object.getOwnPropertyDescriptor(AcTrScene.prototype, 'activeLayoutBtrId');
    if (origActiveDesc?.set) {
      Object.defineProperty(AcTrScene.prototype, 'activeLayoutBtrId', {
        get: origActiveDesc.get,
        set: function (value) {
          this._activeLayoutBtrId = value;
          if (value && !this._layouts.has(value)) {
            this.addEmptyLayout(value);
          }
          this._layouts.forEach(function (layout, key) {
            layout.visible = (value == key);
          });
        },
        enumerable: false,
        configurable: true
      });
    }

    // Auto-create missing layers in layouts during batchConvert / addDirectEntity
    const origAddEmpty = AcTrScene.prototype.addEmptyLayout;
    if (typeof origAddEmpty === 'function') {
      AcTrScene.prototype.addEmptyLayout = function (btrId) {
        const layout = origAddEmpty.call(this, btrId);
        if (layout && layout.constructor?.prototype && !layout.constructor.prototype._hasLayerAutoGuard) {
          layout.constructor.prototype._hasLayerAutoGuard = true;
          const proto = layout.constructor.prototype;

          const origAddDirect = proto.addDirectEntity;
          if (typeof origAddDirect === 'function') {
            proto.addDirectEntity = function (entity, extendBbox = true) {
              const layerName = entity?.layerName || '0';
              if (layerName && !this._layers.has(layerName)) {
                try {
                  this.addLayer({
                    name: layerName,
                    color: 0xffffff,
                    isOff: false,
                    isFrozen: false
                  });
                } catch (_) { }
              }
              return origAddDirect.call(this, entity, extendBbox);
            };
          }

          const origAddEntity = proto.addEntity;
          if (typeof origAddEntity === 'function') {
            proto.addEntity = function (entity, extendBbox = true) {
              const layerName = entity?.layerName || '0';
              if (layerName && !this._layers.has(layerName)) {
                try {
                  this.addLayer({
                    name: layerName,
                    color: 0xffffff,
                    isOff: false,
                    isFrozen: false
                  });
                } catch (_) { }
              }
              return origAddEntity.call(this, entity, extendBbox);
            };
          }
        }
        return layout;
      };
    }
  } catch (patchErr) {
    console.warn('[CADViewer] AcTrScene guard notice:', patchErr);
  }
}

// ── 3. Guard AcApDocManager.instance to never throw during async layout conversion ──
if (typeof window !== 'undefined' && AcApDocManager) {
  try {
    let fallbackInstance = null;
    const origInstanceDesc = Object.getOwnPropertyDescriptor(AcApDocManager, 'instance');
    const origGetter = origInstanceDesc?.get;

    const safeStub = new Proxy({}, {
      get(target, prop) {
        if (prop === 'destroy') return () => { };
        if (prop === 'events') return {};
        if (prop === 'withBusyIndicator') return async (fn) => (typeof fn === 'function' ? fn() : undefined);
        return undefined;
      }
    });

    Object.defineProperty(AcApDocManager, 'instance', {
      get: function () {
        const inst = AcApDocManager.tryGetInstance() || fallbackInstance;
        if (inst) {
          fallbackInstance = inst;
          return inst;
        }
        if (typeof origGetter === 'function') {
          try {
            const res = origGetter.call(AcApDocManager);
            if (res) {
              fallbackInstance = res;
              return res;
            }
          } catch (_) { }
        }
        return fallbackInstance || safeStub;
      },
      set: function (val) {
        fallbackInstance = val;
      },
      enumerable: true,
      configurable: true
    });
  } catch (err) {
    console.warn('[CADViewer] AcApDocManager guard notice:', err);
  }
}

// ── 4. Register LibreDWG Converter with Absolute Worker URLs ─────────────────
export function ensureDwgConverterRegistered() {
  try {
    const manager = AcDbDatabaseConverterManager.instance;
    if (!manager) return;

    const workerUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/workers/libredwg-parser-worker.js`
      : '/workers/libredwg-parser-worker.js';

    const converter = new AcDbLibreDwgConverter({
      convertByEntityType: false,
      useWorker: true,
      parserWorkerUrl: workerUrl
    });

    manager.register(AcDbFileType.DWG, converter);
    manager.register('dwg', converter);
    manager.register('DWG', converter);
    manager.register(AcDbFileType.DXF, converter);
    manager.register('dxf', converter);
    manager.register('DXF', converter);
  } catch (err) {
    console.warn('[CADViewer] LibreDWG converter registration notice:', err);
  }
}

ensureDwgConverterRegistered();

// ── 5. Base64 to ArrayBuffer Helper ───────────────────────────────────────────
function dataUrlToArrayBuffer(data) {
  if (!data) return null;
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  if (typeof data === 'string') {
    let clean = data;
    const commaIdx = clean.indexOf(',');
    if (commaIdx !== -1) {
      clean = clean.slice(commaIdx + 1);
    }
    const base64Data = clean.replace(/[\r\n\s]/g, '');
    const bstr = atob(base64Data);
    const len = bstr.length;
    const u8arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return u8arr.buffer;
  }
  return null;
}

// ── 6. Layer Reference Repair (Ensures PDF_Geometry, etc. exist before rendering) ─
export function repairDrawingLayerReferences(database) {
  if (!database?.tables?.layerTable) return [];
  const layerTable = database.tables.layerTable;
  const missingLayers = new Set();

  for (const stdLayer of ['0', 'PDF_Geometry', 'PDF_Text']) {
    if (!layerTable.has(stdLayer)) {
      missingLayers.add(stdLayer);
    }
  }

  const checkBtrEntities = (btr) => {
    if (!btr?.newIterator) return;
    try {
      for (const entity of btr.newIterator()) {
        const layerName = entity.layer || entity.layerName || entity._layer || '0';
        if (layerName && !layerTable.has(layerName)) {
          missingLayers.add(layerName);
        }
      }
    } catch (_) { }
  };

  if (database.tables.blockTable?.modelSpace) {
    checkBtrEntities(database.tables.blockTable.modelSpace);
  }
  if (database.tables.blockTable?.newIterator) {
    try {
      for (const btr of database.tables.blockTable.newIterator()) {
        checkBtrEntities(btr);
      }
    } catch (_) { }
  }

  if (missingLayers.size > 0) {
    for (const missingName of missingLayers) {
      try {
        if (!layerTable.has(missingName)) {
          const newLayer = new AcDbLayerTableRecord({ name: missingName });
          newLayer.isOff = false;
          newLayer.isFrozen = false;
          layerTable.add(newLayer);
        }
      } catch (_) { }
    }
  }

  return [...missingLayers];
}

// ── 7. Percentile Bounding Box (0.2% - 99.8%) to Exclude Outlier Stray Objects ──
export function computePercentileBounds(curDb, btrId, lowerPct = 0.002, upperPct = 0.998) {
  if (!curDb?.tables?.blockTable) return null;

  let targetBtr = null;
  if (btrId) {
    try {
      targetBtr = curDb.tables.blockTable.getIdAt(btrId);
    } catch (_) { }
  }
  if (!targetBtr) {
    targetBtr = curDb.tables.blockTable.modelSpace;
  }
  if (!targetBtr?.newIterator) return null;

  const xs = [];
  const ys = [];

  const addPoint = (x, y) => {
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  };

  try {
    for (const entity of targetBtr.newIterator()) {
      if (!entity) continue;

      let hasExt = false;
      try {
        const ext = entity.geometricExtents;
        if (ext && !ext.isEmpty?.()) {
          addPoint(ext.min.x, ext.min.y);
          addPoint(ext.max.x, ext.max.y);
          hasExt = true;
        }
      } catch (_) { }

      if (hasExt) continue;

      try {
        if (entity.startPoint && entity.endPoint) {
          addPoint(entity.startPoint.x, entity.startPoint.y);
          addPoint(entity.endPoint.x, entity.endPoint.y);
        } else if (entity.center) {
          addPoint(entity.center.x, entity.center.y);
          const r = entity.radius;
          if (typeof r === 'number' && r > 0) {
            addPoint(entity.center.x - r, entity.center.y - r);
            addPoint(entity.center.x + r, entity.center.y + r);
          }
        } else if (entity.position) {
          addPoint(entity.position.x, entity.position.y);
        } else if (typeof entity.numberOfVertices === 'number') {
          const count = Math.min(entity.numberOfVertices, 50);
          for (let i = 0; i < count; i++) {
            const pt = entity.getPoint2dAt?.(i) || entity.getPoint3dAt?.(i);
            if (pt) addPoint(pt.x, pt.y);
          }
        }
      } catch (_) { }
    }
  } catch (iterErr) {
    console.warn('[CADViewer] Error iterating entities for percentile bounds:', iterErr);
  }

  if (xs.length < 4) {
    return null;
  }

  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);

  const lowXIdx = Math.max(0, Math.floor(xs.length * lowerPct));
  const highXIdx = Math.min(xs.length - 1, Math.ceil(xs.length * upperPct));
  const lowYIdx = Math.max(0, Math.floor(ys.length * lowerPct));
  const highYIdx = Math.min(ys.length - 1, Math.ceil(ys.length * upperPct));

  const minX = xs[lowXIdx];
  const maxX = xs[highXIdx];
  const minY = ys[lowYIdx];
  const maxY = ys[highYIdx];

  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  return new AcGeBox2d(
    new AcGePoint2d(minX, minY),
    new AcGePoint2d(maxX, maxY)
  );
}

// ── 8. Error Boundary to protect React tree and offer Download Fallback ──────────
class CADErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CADErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="cad-error-boundary-fallback"
          style={{
            width: '100%',
            height: '100%',
            minHeight: '500px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#090d16',
            color: '#f8fafc',
            padding: '24px',
            textAlign: 'center',
            boxSizing: 'border-box'
          }}
        >
          <AlertCircle size={44} style={{ color: '#ef4444', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px 0', color: '#f8fafc' }}>
            Unable to Display CAD Drawing
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            {this.state.error?.message || 'A WebGL or CAD rendering exception occurred while preparing this drawing.'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleRetry}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              Try Again
            </button>
            {this.props.onDownload && (
              <button
                onClick={this.props.onDownload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                Download Original DWG
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 9. Inner CADViewer Component with Bulletproof StrictMode Lifecycle ───────────
function CADViewerInner({ fileData, fileUrl, fileBlob, fileName, onDownloadOriginal }) {
  console.log('[CADViewerInner] render called:', {
    hasFileData: !!fileData,
    fileDataLen: typeof fileData === 'string' ? fileData.length : null,
    fileUrl,
    fileName
  });
  const containerRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing CAD viewer...');
  const [loadError, setLoadError] = useState(null);
  const [isSlow, setIsSlow] = useState(false);
  const [isContextLost, setIsContextLost] = useState(false);
  const [contextLostText, setContextLostText] = useState('Reloading viewer...');
  const [layouts, setLayouts] = useState([]);
  const [activeLayoutId, setActiveLayoutId] = useState(null);

  const activeLayoutIdRef = useRef(activeLayoutId);
  activeLayoutIdRef.current = activeLayoutId;

  // Single mount effect safely handling React StrictMode double mounts
  useEffect(() => {
    console.log('[CADViewerInner] useEffect running:', {
      hasFileData: !!fileData,
      fileDataLen: typeof fileData === 'string' ? fileData.length : null,
      fileUrl,
      fileName
    });
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let hasRunOpen = false;
    let currentApp = null;
    let currentHost = null;
    let resizeObserver = null;
    let slowTimer = null;
    let hasFramed = false;

    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingText('Initializing CAD engine...');
    setLoadError(null);
    setIsSlow(false);
    setIsContextLost(false);
    setLayouts([]);
    setActiveLayoutId(null);

    // Clean existing children completely to ensure pristine container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Create fresh host element for this mount
    currentHost = document.createElement('div');
    currentHost.className = 'cad-host-element';
    currentHost.style.position = 'absolute';
    currentHost.style.inset = '0';
    currentHost.style.width = '100%';
    currentHost.style.height = '100%';
    container.appendChild(currentHost);

    // 20-second timeout to display non-blocking slow loading fallback banner
    slowTimer = setTimeout(() => {
      if (!cancelled) {
        setIsSlow(true);
      }
    }, 20000);

    // Listen for WebGL context loss & restoration
    const handleContextLost = (e) => {
      e.preventDefault();
      if (cancelled) return;
      console.warn('[CADViewer] WebGL context lost caught, reloading...');
      setIsContextLost(true);
      setContextLostText('Reloading viewer...');
    };

    const handleContextRestored = () => {
      if (cancelled) return;
      console.log('[CADViewer] WebGL context restored, re-opening drawing...');
      setIsContextLost(false);
      hasRunOpen = false;
      const inst = AcApDocManager.tryGetInstance();
      if (inst && !cancelled) {
        runOpenDocument(inst);
      }
    };

    window.addEventListener('webglcontextlost', handleContextLost, false);
    window.addEventListener('webglcontextrestored', handleContextRestored, false);

    // Async document loader
    const runOpenDocument = async (manager) => {
      console.log('[CADViewer] runOpenDocument entered, manager:', !!manager, 'cancelled:', cancelled, 'hasRunOpen:', hasRunOpen, 'hasCurrentData:', !!(fileData || fileUrl || fileBlob));
      if (cancelled || hasRunOpen) return;
      hasRunOpen = true;

      const currentData = fileData || fileUrl || fileBlob;
      if (!currentData) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      if (!cancelled) {
        setIsLoading(true);
        setLoadingText('Decoding CAD drawing data...');
        setLoadError(null);
      }

      try {
        ensureDwgConverterRegistered();

        // 1. Resolve buffer safely
        let buffer = null;
        if (fileBlob) {
          if (!cancelled) setLoadingText('Reading CAD file...');
          buffer = await fileBlob.arrayBuffer();
        } else if (fileData) {
          if (
            typeof fileData === 'string' &&
            (fileData.startsWith('data:') ||
              (!fileData.startsWith('http://') &&
                !fileData.startsWith('https://') &&
                !fileData.startsWith('blob:') &&
                !fileData.startsWith('/')))
          ) {
            if (!cancelled) setLoadingText('Decoding CAD data in-memory...');
            buffer = dataUrlToArrayBuffer(fileData);
          } else if (typeof fileData === 'string') {
            if (!cancelled) setLoadingText('Fetching CAD file...');
            const resp = await fetch(fileData);
            buffer = await resp.arrayBuffer();
          } else {
            buffer = dataUrlToArrayBuffer(fileData);
          }
        } else if (fileUrl) {
          if (!cancelled) setLoadingText('Fetching CAD file...');
          const resp = await fetch(fileUrl);
          buffer = await resp.arrayBuffer();
        }

        if (cancelled) return;

        console.log('[CADViewer] Buffer resolved, byteLength:', buffer?.byteLength);
        if (!buffer || buffer.byteLength === 0) {
          if (!cancelled) {
            setIsLoading(false);
            setLoadError('The CAD file data is empty or invalid.');
          }
          return;
        }

        let safeName = fileName || 'drawing.dwg';
        if (!safeName.toLowerCase().endsWith('.dwg') && !safeName.toLowerCase().endsWith('.dxf')) {
          safeName += '.dwg';
        }

        if (!cancelled) setLoadingText('Parsing AutoCAD entities & layers...');
        console.log('[CADViewer] Calling manager.openDocument for:', safeName);

        // Track open progress on database
        const db = manager.curDocument?.database;
        const progressListener = (args) => {
          if (args && typeof args.percentage === 'number' && !cancelled) {
            const pct = Math.round(args.percentage);
            setLoadingProgress(pct);
            setLoadingText(`Parsing CAD drawing vectors... ${pct}%`);
          }
        };

        if (db?.events?.openProgress) {
          try {
            db.events.openProgress.addEventListener(progressListener);
          } catch (_) { }
        }

        let success = false;
        try {
          success = await manager.openDocument(safeName, buffer, {
            mode: 0,
            readOnly: true,
            openViewMode: 'extents',
            drawNoPlotLayers: true,
            convertInvisibleLayers: true,
            convertAllLayouts: false,
            progressiveRendering: false
          });
          console.log('[CADViewer] openDocument result:', success, 'manager.curDocument:', !!manager.curDocument);
        } catch (openErr) {
          console.error('[CADViewer] manager.openDocument threw error:', openErr);
        } finally {
          if (db?.events?.openProgress) {
            try {
              db.events.openProgress.removeEventListener(progressListener);
            } catch (_) { }
          }
        }

        if (cancelled) return;

        const view = manager.curView;
        const curDb = manager.curDocument?.database;

        if ((success || manager.curDocument) && view && curDb) {
          if (!cancelled) setLoadingText('Rendering AutoCAD vectors & layers...');

          // Pre-render Drawing Layer Validation & Repair
          repairDrawingLayerReferences(curDb);

          // Find Model Space
          const modelSpace = curDb.tables?.blockTable?.modelSpace;
          const modelSpaceId = modelSpace?.objectId;

          let modelCount = 0;
          try {
            modelCount = modelSpace?.newIterator?.()?.count ?? 0;
          } catch (_) { }

          // Rule 4: Default is ALWAYS Model layout
          const defaultLayoutId = modelSpaceId;

          const detectedLayouts = [];
          if (modelSpaceId) {
            detectedLayouts.push({
              name: 'Model',
              btrId: modelSpaceId,
              isModel: true,
              count: modelCount
            });
          }

          if (curDb.tables?.blockTable?.newIterator) {
            try {
              for (const btr of curDb.tables.blockTable.newIterator()) {
                if (btr.objectId !== modelSpaceId && btr.name !== '*Model_Space') {
                  const count = btr.newIterator?.()?.count ?? 0;
                  const cleanName = (btr.name || 'Layout').replace(/^\*/, '').replace(/_/g, ' ');
                  detectedLayouts.push({
                    name: cleanName,
                    btrId: btr.objectId,
                    isModel: false,
                    count
                  });
                }
              }
            } catch (_) { }
          }

          console.log('[CADViewer] detectedLayouts:', detectedLayouts.map(l => `${l.name} (${l.count})`));
          if (!cancelled) {
            setLayouts(detectedLayouts);
            setActiveLayoutId(defaultLayoutId);
          }

          // Ensure Model Space layout container exists in Three.js scene
          if (defaultLayoutId && !view._scene?.layouts?.has(defaultLayoutId)) {
            try {
              view._scene?.addEmptyLayout?.(defaultLayoutId);
            } catch (_) { }
          }

          // Create layout view for Model Space
          if (defaultLayoutId) {
            try {
              view.createLayoutViewIfNeeded?.(defaultLayoutId);
              view.activeLayoutBtrId = defaultLayoutId;
              curDb.currentSpaceId = defaultLayoutId;
              if (view._scene?.layouts) {
                view._scene.layouts.forEach((layout) => {
                  layout.visible = true;
                  if (layout.layers) {
                    layout.layers.forEach((lg) => {
                      lg.visible = true;
                    });
                  }
                });
              }
            } catch (vpErr) {
              console.warn('[CADViewer] viewport init notice:', vpErr);
            }
          }

          // Sync all database layers to Three.js scene
          if (curDb.tables?.layerTable?.newIterator) {
            try {
              for (const layer of curDb.tables.layerTable.newIterator()) {
                layer.isOff = false;
                layer.isFrozen = false;
                const layerInfo = {
                  name: layer.name,
                  color: layer.color || 0xffffff,
                  isOff: false,
                  isFrozen: false
                };
                try { view.addLayer?.(layer); } catch (_) { }
                try { view._scene?.addLayer?.(layerInfo); } catch (_) { }
                if (view._scene?.layouts) {
                  view._scene.layouts.forEach((l) => {
                    try { l.addLayer?.(layerInfo); } catch (_) { }
                  });
                }
              }
            } catch (syncErr) {
              console.warn('[CADViewer] Layer sync notice:', syncErr);
            }
          }

          // Trigger entity geometry batch conversion into Three.js WebGL
          const currentLayout = view._scene?.layouts?.get(defaultLayoutId);
          if (!currentLayout || currentLayout.entityCount === 0) {
            try {
              view.loadLayoutEntitiesIfNeeded?.(defaultLayoutId);
            } catch (layoutErr) {
              console.warn('[CADViewer] loadLayoutEntitiesIfNeeded notice:', layoutErr);
            }
          }

          // Wait until Three.js geometry batching finishes
          try {
            if (typeof view.waitUntilIdle === 'function') {
              await view.waitUntilIdle(15000);
            }
          } catch (idleErr) {
            console.warn('[CADViewer] waitUntilIdle notice:', idleErr);
          }

          if (cancelled) return;

          // Enforce strictly ONE canvas element in the host container
          const canvases = container.querySelectorAll('canvas');
          if (canvases.length > 1) {
            console.warn(`[CADViewer] Found multiple canvases (${canvases.length}), deduplicating`);
            for (let i = 1; i < canvases.length; i++) {
              canvases[i].remove();
            }
          }

          // Rule 3 & 5: Frame once via ResizeObserver ignoring outliers
          const performFit = () => {
            if (cancelled || hasFramed) return;
            hasFramed = true;

            try {
              view.onWindowResize?.();
              view.refreshCanvasBackgroundForActiveLayout?.();

              // Compute fit bounds ignoring outliers (0.2 to 99.8 percentile of entity points)
              const fitBox = computePercentileBounds(curDb, defaultLayoutId, 0.002, 0.998);
              if (fitBox && !fitBox.isEmpty?.()) {
                try {
                  view.zoomTo?.(fitBox, 1.15);
                } catch (_) {
                  view.zoomToFitDrawing?.();
                }
              } else {
                view.zoomToFitDrawing?.();
              }
              view._isDirty = true;
            } catch (fitErr) {
              console.warn('[CADViewer] Framing error:', fitErr);
            }
          };

          const rect = container.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            performFit();
          } else {
            resizeObserver = new ResizeObserver((entries) => {
              for (const entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                  if (resizeObserver) {
                    resizeObserver.disconnect();
                    resizeObserver = null;
                  }
                  performFit();
                  break;
                }
              }
            });
            resizeObserver.observe(container);
          }

          if (!cancelled) {
            setIsReady(true);
            setIsLoading(false);
            setLoadError(null);
          }
        } else {
          if (!cancelled) {
            const lastErr = manager.curDocument?.database?.lastOpenError;
            const msg = lastErr?.message || 'Unable to render vector preview for this CAD file.';
            setLoadError(msg);
            setIsLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[CADViewer] Error opening document:', err);
          setLoadError(err.message || 'Failed to open CAD drawing.');
          setIsLoading(false);
        }
      }
    };

    // Prepare File object for MlCadViewer if not already provided
    let localFileObj = fileBlob || null;
    if (!localFileObj && fileData) {
      if (typeof fileData === 'string' && (fileData.startsWith('blob:') || fileData.startsWith('http://') || fileData.startsWith('https://'))) {
        // Handled via url prop
      } else {
        try {
          const buffer = dataUrlToArrayBuffer(fileData);
          if (buffer) {
            let safeName = fileName || 'drawing.dwg';
            if (!safeName.toLowerCase().endsWith('.dwg') && !safeName.toLowerCase().endsWith('.dxf')) {
              safeName += '.dwg';
            }
            localFileObj = new File([buffer], safeName, { type: 'application/octet-stream' });
            console.log('[CADViewer] Created localFileObj for MlCadViewer:', safeName, localFileObj.size);
          }
        } catch (fileErr) {
          console.warn('[CADViewer] Error creating File object:', fileErr);
        }
      }
    }

    // Mount Vue MlCadViewer app on fresh host element
    const reactiveProps = shallowReactive({
      locale: 'en',
      theme: 'dark',
      background: 0x090d16,
      disableExport: true,
      mode: 0,
      baseUrl: '/',
      localFile: localFileObj || undefined,
      url: typeof fileData === 'string' && (fileData.startsWith('blob:') || fileData.startsWith('http://') || fileData.startsWith('https://')) ? fileData : (fileUrl || undefined),
      onCreate: () => {
        console.log('[CADViewer] onCreate fired! cancelled:', cancelled);
        if (cancelled) return;
        const inst = AcApDocManager.tryGetInstance();
        console.log('[CADViewer] onCreate inst:', !!inst);
        if (inst && !cancelled) {
          runOpenDocument(inst);
        }
      },
      onDestroy: () => { }
    });

    const app = createApp({
      render() {
        return h(MlCadViewer, reactiveProps);
      }
    });

    if (i18n) app.use(i18n);
    if (ElementPlus) app.use(ElementPlus);

    try {
      app.mount(currentHost);
      currentApp = app;
    } catch (mountErr) {
      if (!cancelled) {
        setLoadError(mountErr.message || 'Failed to initialize CAD Viewer.');
        setIsLoading(false);
      }
      return;
    }

    // Polling fallback to ensure runOpenDocument is triggered
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      pollCount++;
      if (cancelled) {
        clearInterval(pollInterval);
        return;
      }
      const inst = AcApDocManager.tryGetInstance();
      if (inst) {
        console.log('[CADViewer] pollInterval found inst on count:', pollCount);
        clearInterval(pollInterval);
        if (!cancelled) {
          runOpenDocument(inst);
        }
      } else if (pollCount > 60) {
        console.warn('[CADViewer] pollInterval timed out waiting for inst');
        clearInterval(pollInterval);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 100);

    // Bulletproof Effect Cleanup
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      if (slowTimer) clearTimeout(slowTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      window.removeEventListener('webglcontextlost', handleContextLost, false);
      window.removeEventListener('webglcontextrestored', handleContextRestored, false);

      // 1. Release document and destroy AcApDocManager instance
      try {
        const inst = AcApDocManager.tryGetInstance();
        if (inst) {
          // Release document/database
          if (inst.curDocument) {
            try { inst.curDocument.destroy?.(); } catch (_) { }
          }
          // Safely destroy manager instance (disposes Three.js renderer, forces WebGL context loss, clears listeners)
          try {
            inst.destroy?.()?.catch?.(() => {});
          } catch (_) { }
          // Ensure singleton is reset so next mount starts with a clean WebGL instance
          try {
            AcApDocManager._instance = undefined;
          } catch (_) { }
        }
      } catch (_) { }

      // 2. Unmount the Vue app synchronously
      if (currentApp) {
        try {
          currentApp.unmount();
        } catch (_) { }
        currentApp = null;
      }

      // 3. Remove host element from container
      if (currentHost) {
        try {
          currentHost.remove();
        } catch (_) { }
        currentHost = null;
      }
    };
  }, [fileData, fileUrl, fileBlob, fileName]);

  // Layout switcher
  const handleSwitchLayout = useCallback((targetBtrId) => {
    const inst = AcApDocManager.tryGetInstance();
    const view = inst?.curView;
    const curDb = inst?.curDocument?.database;
    if (!view || !curDb || !targetBtrId) return;

    try {
      if (!view._scene?.layouts?.has(targetBtrId)) {
        view._scene?.addEmptyLayout?.(targetBtrId);
      }
      view.createLayoutViewIfNeeded?.(targetBtrId);
      view.activeLayoutBtrId = targetBtrId;
      curDb.currentSpaceId = targetBtrId;

      if (view._scene?.layouts) {
        view._scene.layouts.forEach((layout) => {
          layout.visible = true;
          if (layout.layers) {
            layout.layers.forEach((lg) => {
              lg.visible = true;
            });
          }
        });
      }

      view.loadLayoutEntitiesIfNeeded?.(targetBtrId);
      view._externallyFramedLayouts?.clear?.();
      view.onWindowResize?.();
      view.refreshCanvasBackgroundForActiveLayout?.();

      const modelSpaceId = curDb.tables?.blockTable?.modelSpace?.objectId;
      const isModel = (targetBtrId === modelSpaceId);

      view.onWindowResize?.();
      view.refreshCanvasBackgroundForActiveLayout?.();

      if (isModel) {
        const fitBox = computePercentileBounds(curDb, targetBtrId, 0.002, 0.998);
        if (fitBox && !fitBox.isEmpty?.()) {
          try {
            view.zoomTo?.(fitBox, 1.15);
          } catch (_) {
            view.zoomToFitDrawing?.();
          }
        } else {
          view.zoomToFitDrawing?.();
        }
      } else {
        view.zoomToFitDrawing?.();
      }

      view._isDirty = true;
      setActiveLayoutId(targetBtrId);
    } catch (err) {
      console.warn('[CADViewer] Error switching layout:', err);
    }
  }, []);

  // Zoom to fit handler
  const handleZoomFit = useCallback(() => {
    const inst = AcApDocManager.tryGetInstance();
    const view = inst?.curView;
    const curDb = inst?.curDocument?.database;
    if (!view || !curDb) return;

    view.onWindowResize?.();
    view.refreshCanvasBackgroundForActiveLayout?.();

    const modelSpaceId = curDb.tables?.blockTable?.modelSpace?.objectId;
    const isModel = (activeLayoutIdRef.current === modelSpaceId || !activeLayoutIdRef.current);

    if (isModel) {
      const fitBox = computePercentileBounds(curDb, modelSpaceId, 0.002, 0.998);
      if (fitBox && !fitBox.isEmpty?.()) {
        try {
          view.zoomTo?.(fitBox, 1.15);
        } catch (_) {
          view.zoomToFitDrawing?.();
        }
      } else {
        view.zoomToFitDrawing?.();
      }
    } else {
      view.zoomToFitDrawing?.();
    }
    view._isDirty = true;
  }, []);

  return (
    <div
      className="simple-cad-canvas-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '600px',
        background: '#090d16',
        overflow: 'hidden'
      }}
    >
      {/* Loading Overlay with Progress Percentage */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 40,
            backgroundColor: 'rgba(9, 13, 22, 0.88)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            color: '#38bdf8'
          }}
        >
          <Loader2 size={36} className="spin" />
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 600, display: 'block' }}>
              {loadingText}
            </span>
            {loadingProgress > 0 && (
              <div
                style={{
                  width: '200px',
                  height: '4px',
                  backgroundColor: '#334155',
                  borderRadius: '2px',
                  margin: '8px auto 0 auto',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${loadingProgress}%`,
                    height: '100%',
                    backgroundColor: '#10b981',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            )}
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem', display: 'block' }}>
              AutoCAD drawings parse vectors and layers directly in your browser.
            </span>
          </div>
        </div>
      )}

      {/* WebGL Context Lost Warning Overlay */}
      {isContextLost && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 45,
            backgroundColor: 'rgba(9, 13, 22, 0.92)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            color: '#38bdf8'
          }}
        >
          <Loader2 size={36} className="spin" />
          <span style={{ fontSize: '1rem', color: '#f8fafc', fontWeight: 600 }}>
            {contextLostText}
          </span>
        </div>
      )}

      {/* Heavy file slow loading notice */}
      {isSlow && isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid #eab308',
            color: '#fef08a',
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            maxWidth: '90%'
          }}
        >
          <AlertCircle size={18} style={{ color: '#eab308', flexShrink: 0 }} />
          <span>Heavy CAD drawing (93,828 entities). Parsing is taking longer than expected...</span>
          {onDownloadOriginal && (
            <button
              onClick={onDownloadOriginal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                backgroundColor: '#334155',
                color: '#ffffff',
                border: '1px solid #64748b',
                borderRadius: '5px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Download size={13} />
              <span>Download Original</span>
            </button>
          )}
        </div>
      )}

      {/* Error Alert Overlay */}
      {loadError && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid #ef4444',
            color: '#f8fafc',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            maxWidth: '90%'
          }}
        >
          <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{loadError}</span>
          <button
            onClick={handleZoomFit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '5px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Try to fit drawing in view"
          >
            <Maximize2 size={13} />
            <span>Fit Drawing</span>
          </button>
          {onDownloadOriginal && (
            <button
              onClick={onDownloadOriginal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                backgroundColor: '#334155',
                color: '#ffffff',
                border: '1px solid #475569',
                borderRadius: '5px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Download original DWG file"
            >
              <Download size={13} />
              <span>Download DWG</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Drawing Control Overlay (Layout tabs & Fit view) */}
      {isReady && !isLoading && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            padding: '4px 8px',
            borderRadius: '8px',
            border: '1px solid #334155',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
          }}
        >
          {layouts.length > 0 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {layouts.map((l) => (
                <button
                  key={l.btrId}
                  onClick={() => handleSwitchLayout(l.btrId)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: activeLayoutId === l.btrId ? 700 : 500,
                    color: activeLayoutId === l.btrId ? '#ffffff' : 'var(--text-secondary)',
                    backgroundColor: activeLayoutId === l.btrId ? '#0284c7' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {l.name} {l.count > 0 ? `(${l.count.toLocaleString()})` : ''}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleZoomFit}
            title="Fit drawing to view (Zoom All)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#e2e8f0',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <Maximize2 size={12} />
            <span>Fit View</span>
          </button>
        </div>
      )}

      {/* Host Mount Shell */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      />
    </div>
  );
}

// ── 10. Default Export with Outer ErrorBoundary ──────────────────────────────────
export default function CADViewer(props) {
  const handleDownload = useCallback(() => {
    const src = props.fileData || props.fileUrl;
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = props.fileName || 'drawing.dwg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [props.fileData, props.fileUrl, props.fileName]);

  return (
    <CADErrorBoundary onDownload={handleDownload}>
      <CADViewerInner {...props} onDownloadOriginal={handleDownload} />
    </CADErrorBoundary>
  );
}
