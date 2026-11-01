import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createApp, h, shallowReactive } from 'vue';
import { MlCadViewer, i18n } from '@mlightcad/cad-viewer';
import '../cad-viewer.css';
import { AcApDocManager, AcApSettingManager, AcTrScene } from '@mlightcad/cad-simple-viewer';
import { AcDbDatabaseConverterManager, AcDbFileType } from '@mlightcad/data-model';
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { AlertCircle, Loader2, Download, Maximize2 } from 'lucide-react';

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

// ── 2. Guard AcTrScene Layout Creation (Fixes "No layout associated with id '1F'") ──
if (typeof window !== 'undefined' && AcTrScene?.prototype) {
  try {
    const origModelDesc = Object.getOwnPropertyDescriptor(AcTrScene.prototype, 'modelSpaceBtrId');
    if (origModelDesc?.set) {
      Object.defineProperty(AcTrScene.prototype, 'modelSpaceBtrId', {
        get: origModelDesc.get,
        set: function (value) {
          this._modelSpaceBtrId = value;
          if (value && !this._layouts.has(value)) {
            console.log(`[CADViewer] Auto-creating missing layout container for block table record '${value}'`);
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
  } catch (patchErr) {
    console.warn('[CADViewer] AcTrScene guard notice:', patchErr);
  }
}

// ── 3. Register LibreDWG Converter with Absolute Worker URLs ─────────────────
export function ensureDwgConverterRegistered() {
  try {
    const manager = AcDbDatabaseConverterManager.instance;
    if (!manager) return;

    // Use absolute origin path so web worker resolves cleanly from anywhere
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
    console.log('[CADViewer] LibreDWG converter registered with worker:', workerUrl);
  } catch (err) {
    console.warn('[CADViewer] LibreDWG converter registration notice:', err);
  }
}

// Execute immediately so converter is available before any file is opened
ensureDwgConverterRegistered();

// ── 4. High-Performance In-Memory Base64 to ArrayBuffer Converter ──────────────
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

// ── 5. Main CADViewer React Component ─────────────────────────────────────────
export default function CADViewer({ fileData, fileUrl, fileBlob, fileName }) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const isCreatedRef = useRef(false);
  const isOpeningRef = useRef(false);
  const lastOpenedDataRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Initializing CAD viewer...');
  const [loadError, setLoadError] = useState(null);
  const [layouts, setLayouts] = useState([]);
  const [activeLayoutId, setActiveLayoutId] = useState(null);

  // Suppress harmless 'Renderer terminated' worker cancellations during component cleanup
  useEffect(() => {
    const handleRejection = (e) => {
      if (e?.reason?.message?.includes('Renderer terminated')) {
        e.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Direct, controlled open document execution
  const openDrawing = useCallback(async (inst) => {
    const manager = inst || AcApDocManager.tryGetInstance();
    if (!manager) return;
    if (isOpeningRef.current) return;

    const currentData = fileData || fileUrl || fileBlob;
    if (!currentData) {
      setIsLoading(false);
      return;
    }

    const currentKey = typeof currentData === 'string'
      ? currentData.slice(0, 80)
      : (currentData.size || currentData.byteLength || fileName || 'file');

    if (lastOpenedDataRef.current === currentKey && isReady) {
      setIsLoading(false);
      return;
    }

    isOpeningRef.current = true;
    setIsLoading(true);
    setLoadingText('Decoding CAD drawing data...');
    setLoadError(null);

    // Safety watchdog: ensure UI is never permanently frozen on spinner (25s max)
    const watchdog = setTimeout(() => {
      if (isOpeningRef.current) {
        console.warn('[CADViewer] Document parse taking long, releasing UI lock');
        setIsLoading(false);
        setLoadError('CAD preview is taking longer than expected. You can still interact with the viewer or download the original DWG file.');
      }
    }, 25000);

    try {
      ensureDwgConverterRegistered();

      // Convert input file to ArrayBuffer using direct synchronous in-memory decoding for base64 / data: URLs
      let buffer = null;
      if (fileBlob) {
        setLoadingText('Reading CAD file...');
        buffer = await fileBlob.arrayBuffer();
      } else if (fileData) {
        if (
          typeof fileData === 'string' &&
          (fileData.startsWith('data:') ||
            (!fileData.startsWith('http://') && !fileData.startsWith('https://') && !fileData.startsWith('blob:') && !fileData.startsWith('/')))
        ) {
          setLoadingText('Decoding CAD data in-memory...');
          buffer = dataUrlToArrayBuffer(fileData);
        } else if (
          typeof fileData === 'string' &&
          (fileData.startsWith('http://') ||
            fileData.startsWith('https://') ||
            fileData.startsWith('blob:') ||
            fileData.startsWith('/'))
        ) {
          setLoadingText('Fetching CAD file...');
          const resp = await fetch(fileData);
          buffer = await resp.arrayBuffer();
        } else {
          buffer = dataUrlToArrayBuffer(fileData);
        }
      } else if (fileUrl) {
        setLoadingText('Fetching CAD file...');
        const resp = await fetch(fileUrl);
        buffer = await resp.arrayBuffer();
      }

      if (!buffer || buffer.byteLength === 0) {
        console.warn('[CADViewer] No valid file buffer to open');
        setIsLoading(false);
        setLoadError('The CAD file data is empty or invalid.');
        isOpeningRef.current = false;
        clearTimeout(watchdog);
        return;
      }

      let safeName = fileName || 'drawing.dwg';
      if (!safeName.toLowerCase().endsWith('.dwg') && !safeName.toLowerCase().endsWith('.dxf')) {
        safeName += '.dwg';
      }

      console.log(`[CADViewer] Opening drawing "${safeName}", buffer byteLength: ${buffer.byteLength}`);
      setLoadingText('Parsing AutoCAD entities & layers...');

      // Listen for progressive parse events on database if available
      const db = manager.curDocument?.database;
      const progressListener = (args) => {
        if (args && typeof args.percentage === 'number') {
          const pct = Math.round(args.percentage);
          setLoadingText(`Parsing CAD drawing vectors... ${pct}%`);
        }
      };

      if (db?.events?.openProgress) {
        try {
          db.events.openProgress.addEventListener(progressListener);
        } catch (_) { }
      }

      let documentReady = false;
      const onDocActivated = () => {
        documentReady = true;
      };
      manager.events?.documentActivated?.addEventListener?.(onDocActivated);

      let success = false;
      try {
        success = await manager.openDocument(safeName, buffer, {
          mode: 0, // Read-only mode
          readOnly: true,
          openViewMode: 'extents',
          drawNoPlotLayers: true,
          convertInvisibleLayers: true,
          convertAllLayouts: true,
          progressiveRendering: false
        });
      } finally {
        clearTimeout(watchdog);
        if (db?.events?.openProgress) {
          try {
            db.events.openProgress.removeEventListener(progressListener);
          } catch (_) { }
        }
        manager.events?.documentActivated?.removeEventListener?.(onDocActivated);
      }

      console.log(`[CADViewer] openDocument completed with success =`, success);

      if (success || documentReady || manager.curDocument) {
        lastOpenedDataRef.current = currentKey;
        const view = manager.curView;
        const curDb = manager.curDocument?.database;

        if (view && curDb) {
          setLoadingText('Rendering AutoCAD vectors & layers...');

          // 1. Identify Model Space & Paper Layouts
          const modelSpace = curDb.tables?.blockTable?.modelSpace;
          const modelSpaceId = modelSpace?.objectId;

          let modelEntityCount = 0;
          try {
            modelEntityCount = modelSpace?.newIterator?.()?.count ?? 0;
          } catch (_) { }

          let bestBtrId = modelSpaceId;
          let maxCount = modelEntityCount;

          const detectedLayouts = [];
          if (modelSpaceId) {
            detectedLayouts.push({
              name: 'Model',
              btrId: modelSpaceId,
              count: modelEntityCount
            });
          }

          if (curDb.tables?.blockTable?.newIterator) {
            try {
              for (const btr of curDb.tables.blockTable.newIterator()) {
                const count = btr.newIterator?.()?.count ?? 0;
                if (btr.objectId !== modelSpaceId) {
                  const cleanName = (btr.name || 'Layout').replace(/^\*/, '').replace(/_/g, ' ');
                  detectedLayouts.push({
                    name: cleanName,
                    btrId: btr.objectId,
                    count
                  });
                }
                if (count > maxCount) {
                  maxCount = count;
                  bestBtrId = btr.objectId;
                }
              }
            } catch (_) { }
          }

          setLayouts(detectedLayouts);
          setActiveLayoutId(bestBtrId);

          console.log(`[CADViewer] Primary layout: ${bestBtrId} (${maxCount} entities, total layouts: ${detectedLayouts.length})`);

          // 2. Ensure layout container exists in Three.js scene
          if (bestBtrId && !view._scene?.layouts?.has(bestBtrId)) {
            view._scene?.addEmptyLayout?.(bestBtrId);
          }

          // 3. Create viewports & camera for this layout
          if (bestBtrId) {
            view.createLayoutViewIfNeeded?.(bestBtrId);
            view.activeLayoutBtrId = bestBtrId;
            curDb.currentSpaceId = bestBtrId;
            if (view._scene?.layouts) {
              view._scene.layouts.forEach((layout, id) => {
                layout.visible = (id === bestBtrId);
              });
            }
          }

          // 4. CRITICAL: Trigger entity geometry batch conversion into Three.js WebGL
          const currentLayout = view._scene?.layouts?.get(bestBtrId);
          if (!currentLayout || currentLayout.entityCount === 0) {
            console.log('[CADViewer] Triggering loadLayoutEntitiesIfNeeded for layout:', bestBtrId);
            view.loadLayoutEntitiesIfNeeded?.(bestBtrId);
          }

          // 5. Ensure all drawing layers are visible
          if (curDb.tables?.layerTable?.newIterator) {
            try {
              for (const layer of curDb.tables.layerTable.newIterator()) {
                layer.isOff = false;
                layer.isFrozen = false;
              }
            } catch (_) { }
          }

          // 6. Clear external frame locks and apply background
          view._externallyFramedLayouts?.clear?.();
          view.refreshCanvasBackgroundForActiveLayout?.();
          view._isDirty = true;

          // 7. Wait until Three.js geometry batching finishes (up to 12s)
          try {
            if (typeof view.waitUntilIdle === 'function') {
              console.log('[CADViewer] Waiting for CAD vector linework to finalize...');
              await view.waitUntilIdle(12000);
            }
          } catch (idleErr) {
            console.warn('[CADViewer] waitUntilIdle notice:', idleErr);
          }

          // 8. Multi-stage framing so drawing fits canvas perfectly
          const fitCamera = () => {
            try {
              window.dispatchEvent(new Event('resize'));
              const extents = view.getDrawingExtents?.();
              if (extents && !extents.isEmpty?.()) {
                console.log('[CADViewer] Framing drawing bounds:', extents);
                view.zoomTo?.(extents, 1.15);
              } else {
                view.zoomToFitDrawing?.();
              }
              view._isDirty = true;
            } catch (zoomErr) {
              view.zoomToFitDrawing?.();
            }
          };

          fitCamera();
          requestAnimationFrame(fitCamera);
          setTimeout(fitCamera, 200);
          setTimeout(fitCamera, 600);
          setTimeout(fitCamera, 1500);
        }

        setIsReady(true);
        setIsLoading(false);
        setLoadError(null);
      } else {
        const lastErr = manager.curDocument?.database?.lastOpenError;
        const msg = lastErr?.message || 'Unable to render vector preview for this CAD file. You can download the original DWG file.';
        console.error('[CADViewer] openDocument failed:', msg);
        setLoadError(msg);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('[CADViewer] Error opening document:', err);
      setLoadError(err.message || 'Failed to open CAD drawing.');
      setIsLoading(false);
    } finally {
      isOpeningRef.current = false;
    }
  }, [fileData, fileUrl, fileBlob, fileName, isReady]);

  // Keep latest reference to openDrawing for effect callbacks
  const openDrawingRef = useRef(openDrawing);
  useEffect(() => {
    openDrawingRef.current = openDrawing;
  }, [openDrawing]);

  // Mount Vue MlCadViewer app once when container attaches
  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return; // Prevent duplicate initialization on re-renders

    setLoadError(null);
    setIsReady(false);
    setIsLoading(true);
    setLoadingText('Initializing CAD viewer...');
    isCreatedRef.current = false;

    // Reactive props passed to MlCadViewer
    const reactiveProps = shallowReactive({
      locale: 'en',
      theme: 'dark',
      background: 0x090d16,
      disableExport: true,
      mode: 0, // Read-only mode
      baseUrl: '/',
      localFile: undefined,
      url: undefined,

      onCreate: () => {
        isCreatedRef.current = true;
        const inst = AcApDocManager.tryGetInstance();
        if (inst) {
          openDrawingRef.current(inst);
        }
      },
      onDestroy: () => {
        isCreatedRef.current = false;
        setIsReady(false);
      }
    });

    const app = createApp({
      render() {
        return h(MlCadViewer, reactiveProps);
      }
    });

    if (i18n) {
      app.use(i18n);
    }
    if (ElementPlus) {
      app.use(ElementPlus);
    }

    try {
      app.mount(containerRef.current);
      appRef.current = app;

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    } catch (err) {
      console.error('[CADViewer] Error mounting CAD Viewer:', err);
      setLoadError(err.message || 'Failed to initialize CAD Viewer');
      setIsLoading(false);
    }

    // Polling watchdog: as soon as the instance is available, trigger openDrawing
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      pollCount++;
      const inst = AcApDocManager.tryGetInstance();
      if (inst) {
        clearInterval(pollInterval);
        isCreatedRef.current = true;
        openDrawingRef.current(inst);
      } else if (pollCount > 80) { // 8 seconds max
        clearInterval(pollInterval);
        setIsLoading(false);
      }
    }, 100);

    // Cleanup: Only unmount when CADViewer is actually removed from DOM
    return () => {
      clearInterval(pollInterval);
      isCreatedRef.current = false;
      if (appRef.current) {
        try {
          appRef.current.unmount();
        } catch (unmountErr) {
          console.warn('[CADViewer] unmount cleanup notice:', unmountErr);
        }
        appRef.current = null;
      }
    };
  }, []);

  // When fileData/fileName changes while already mounted, reload document
  useEffect(() => {
    const inst = AcApDocManager.tryGetInstance();
    if (inst && (fileData || fileUrl || fileBlob)) {
      openDrawing(inst);
    }
  }, [fileData, fileUrl, fileBlob, fileName, openDrawing]);

  // Download handler for fallback
  const handleDownloadOriginal = () => {
    if (!fileData) return;
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName || 'drawing.dwg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Switch active CAD layout (Model Space vs Paper Sheets)
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
        view._scene.layouts.forEach((layout, id) => {
          layout.visible = (id === targetBtrId);
        });
      }

      view.loadLayoutEntitiesIfNeeded?.(targetBtrId);
      view._externallyFramedLayouts?.clear?.();
      view.refreshCanvasBackgroundForActiveLayout?.();
      view._isDirty = true;
      setActiveLayoutId(targetBtrId);

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        const extents = view.getDrawingExtents?.();
        if (extents && !extents.isEmpty?.()) {
          view.zoomTo?.(extents, 1.15);
        } else {
          view.zoomToFitDrawing?.();
        }
        view._isDirty = true;
      }, 250);
    } catch (err) {
      console.warn('[CADViewer] Error switching layout:', err);
    }
  }, []);

  // Zoom to fit handler
  const handleZoomFit = () => {
    const inst = AcApDocManager.tryGetInstance();
    const view = inst?.curView;
    if (view) {
      window.dispatchEvent(new Event('resize'));
      const extents = view.getDrawingExtents?.();
      if (extents && !extents.isEmpty?.()) {
        view.zoomTo?.(extents, 1.15);
      } else {
        view.zoomToFitDrawing?.();
      }
      view._isDirty = true;
    }
  };

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
      {/* Dynamic Loading Overlay with Real-time Progress */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            backgroundColor: 'rgba(9, 13, 22, 0.85)',
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
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
              AutoCAD drawings parse vectors and layers directly in your browser.
            </span>
          </div>
        </div>
      )}

      {/* Error Alert Overlay with Direct Download Option */}
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
          {fileData && (
            <button
              onClick={handleDownloadOriginal}
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
                    color: activeLayoutId === l.btrId ? '#ffffff' : '#94a3b8',
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

      {/* Vue mount container */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
}
