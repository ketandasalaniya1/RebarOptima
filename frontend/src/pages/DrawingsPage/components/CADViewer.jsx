import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createApp, h, shallowReactive } from 'vue';
import { MlCadViewer, i18n } from '@mlightcad/cad-viewer';
import '../cad-viewer.css';
import { AcApDocManager, AcApSettingManager } from '@mlightcad/cad-simple-viewer';
import { AcDbDatabaseConverterManager, AcDbFileType } from '@mlightcad/data-model';
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { AlertCircle, Loader2 } from 'lucide-react';

// ── 1. Configure AcApSettingManager (Hide Ribbons & Command Line for Clean Viewer) ──
if (typeof window !== 'undefined') {
  try {
    AcApSettingManager?.configure?.({
      storageKey: 'rebaroptima.cad.viewer'
    });
    AcApSettingManager?.instance?.apply?.({
      isShowCommandLine: false,
      isShowToolbar: false,
      isShowRibbon: false,
      isShowCoordinate: false,
      isShowEntityInfo: false,
      isShowLanguageSelector: false,
      isShowStats: false
    }, { persist: false });
  } catch (err) {
    console.warn('AcApSettingManager setup notice:', err);
  }
}

// ── 2. Register LibreDWG Converter Immediately at Module Load Time ────────────
export function ensureDwgConverterRegistered() {
  try {
    const manager = AcDbDatabaseConverterManager.instance;
    const workerUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/workers/libredwg-parser-worker.js`
      : '/workers/libredwg-parser-worker.js';

    if (manager) {
      const converter = new AcDbLibreDwgConverter({
        convertByEntityType: false,
        useWorker: true,
        parserWorkerUrl: workerUrl
      });
      manager.register(AcDbFileType.DWG, converter);
      manager.register('dwg', converter);
      manager.register('DWG', converter);
      console.log('[CADViewer] Registered LibreDWG converter with workerUrl:', workerUrl);
    }
  } catch (err) {
    console.warn('[CADViewer] LibreDWG converter registration notice:', err);
  }
}

// Execute immediately so converter is available before any file is opened
ensureDwgConverterRegistered();

// ── 3. Safe-Guard AcApDocManager.instance Getter ──────────────────────────────
const createFallbackStub = () => {
  const emptyEvents = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatch: () => {}
  };
  const emptyEditorEvents = {
    commandWillStart: emptyEvents,
    commandEnded: emptyEvents,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatch: () => {}
  };
  const emptyEditor = {
    events: emptyEditorEvents,
    sendStringToExecute: () => {},
    showMessage: () => {},
    selectAll: () => ({ value: { ids: [] } })
  };
  const emptyView = {
    backgroundColor: 0,
    selectionSet: { ids: [], events: emptyEvents },
    events: emptyEvents,
    editor: emptyEditor,
    renderer: { setFontMapping: () => {} },
    zoomToFit: () => {},
    zoomToFitDrawing: () => {},
    zoomToFitLayer: () => {},
    disposeSessionState: () => {},
    updateEntity: () => true
  };
  const emptyDoc = {
    database: {
      tables: {
        blockTable: { getEntityById: () => null }
      }
    }
  };

  return new Proxy({}, {
    get(target, prop) {
      const real = AcApDocManager.tryGetInstance();
      if (real) {
        const val = real[prop];
        return typeof val === 'function' ? val.bind(real) : val;
      }

      if (prop === 'curView') return emptyView;
      if (prop === 'curDocument') return emptyDoc;
      if (prop === 'editor') return emptyEditor;
      if (prop === 'events') return emptyEvents;
      if (prop === 'pluginManager') return { unloadAllPlugins: async () => {}, registerLazyAgentPlugin: () => {} };
      if (prop === 'lookupLocalCmd') return () => null;
      if (prop === 'destroy') return async () => {};
      if (prop === 'setOpenDocumentDefaults') return () => {};
      if (prop === 'openDocument') return async () => false;
      if (prop === '_instance') return undefined;
      return () => {};
    },
    set(target, prop, value) {
      const real = AcApDocManager.tryGetInstance();
      if (real) {
        real[prop] = value;
        return true;
      }
      return true;
    }
  });
};

const safeFallback = createFallbackStub();

if (AcApDocManager) {
  try {
    const desc = Object.getOwnPropertyDescriptor(AcApDocManager, 'instance');
    if (desc && desc.configurable) {
      Object.defineProperty(AcApDocManager, 'instance', {
        configurable: true,
        enumerable: false,
        get() {
          return AcApDocManager.tryGetInstance() || safeFallback;
        }
      });
    }
  } catch (err) {
    console.warn('AcApDocManager safe-guard notice:', err);
  }
}

// ── 4. File Data to ArrayBuffer Converter ──────────────────────────────────────
function dataUrlToArrayBuffer(data) {
  if (!data) return null;
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  if (typeof data === 'string') {
    let clean = data;
    if (clean.includes(',')) {
      clean = clean.split(',')[1];
    }
    const base64Data = clean.replace(/[\r\n\s]/g, '');
    const bstr = atob(base64Data);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
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
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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
    if (!inst) return;
    if (isOpeningRef.current) return;
    isOpeningRef.current = true;

    try {
      setIsLoading(true);
      setLoadError(null);

      // Re-affirm converter is registered
      ensureDwgConverterRegistered();

      // Convert input file to ArrayBuffer
      let buffer = null;
      if (fileBlob) {
        buffer = await fileBlob.arrayBuffer();
      } else if (fileData) {
        if (
          typeof fileData === 'string' &&
          (fileData.startsWith('http://') ||
            fileData.startsWith('https://') ||
            fileData.startsWith('blob:') ||
            fileData.startsWith('/'))
        ) {
          const resp = await fetch(fileData);
          buffer = await resp.arrayBuffer();
        } else {
          buffer = dataUrlToArrayBuffer(fileData);
        }
      } else if (fileUrl) {
        const resp = await fetch(fileUrl);
        buffer = await resp.arrayBuffer();
      }

      if (!buffer || buffer.byteLength === 0) {
        console.warn('[CADViewer] No valid file buffer to open');
        setIsLoading(false);
        isOpeningRef.current = false;
        return;
      }

      let safeName = fileName || 'drawing.dwg';
      if (!safeName.toLowerCase().endsWith('.dwg') && !safeName.toLowerCase().endsWith('.dxf')) {
        safeName += '.dwg';
      }

      console.log(`[CADViewer] Opening drawing "${safeName}", buffer byteLength: ${buffer.byteLength}`);

      const success = await inst.openDocument(safeName, buffer, {
        mode: 0, // Read-only mode
        readOnly: true,
        openViewMode: 2 // Extents
      });

      console.log(`[CADViewer] openDocument completed with success =`, success);

      if (success) {
        setIsReady(true);
        // Force layout repaint and frame drawing vectors
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
          setTimeout(() => {
            try {
              inst.curView?.zoomToFitDrawing?.();
            } catch (zoomErr) {
              console.warn('[CADViewer] zoomToFit notice:', zoomErr);
            }
          }, 300);
        });
      } else {
        const lastErr = inst.curDocument?.database?.lastOpenError;
        const msg = lastErr?.message || 'Unable to parse CAD drawing vectors.';
        console.error('[CADViewer] openDocument failed:', msg);
        setLoadError(msg);
      }
    } catch (err) {
      console.error('[CADViewer] Error opening document:', err);
      setLoadError(err.message || 'Failed to open CAD drawing.');
    } finally {
      setIsLoading(false);
      isOpeningRef.current = false;
    }
  }, [fileData, fileUrl, fileBlob, fileName]);

  // Mount Vue MlCadViewer app once when container attaches
  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return; // Prevent duplicate initialization on re-renders

    setLoadError(null);
    setIsReady(false);
    setIsLoading(true);
    isCreatedRef.current = false;

    // Reactive props passed to MlCadViewer
    // We pass localFile: undefined & url: undefined so MlCadViewer mounts cleanly
    // and we take full control of document opening via openDocument in onCreate.
    const reactiveProps = shallowReactive({
      locale: 'en',
      theme: 'dark',
      background: 0x090d16,
      disableExport: true,
      mode: 0, // Read-only mode
      baseUrl: '/',
      localFile: undefined,
      url: undefined,

      // Documented 'create' lifecycle event:
      // Fired when MlCadViewer has created AcApDocManager with the canvas container
      onCreate: () => {
        isCreatedRef.current = true;
        const inst = AcApDocManager.tryGetInstance();
        if (inst) {
          openDrawing(inst);
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

      // Trigger size calculation
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    } catch (err) {
      console.error('[CADViewer] Error mounting CAD Viewer:', err);
      setLoadError(err.message || 'Failed to initialize CAD Viewer');
      setIsLoading(false);
    }

    // Cleanup: Only unmount when CADViewer is actually removed from DOM
    return () => {
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
  }, []); // Run mount once on mount

  // When fileData/fileName changes while already mounted, reload document
  useEffect(() => {
    const inst = AcApDocManager.tryGetInstance();
    if (isCreatedRef.current && inst) {
      openDrawing(inst);
    }
  }, [fileData, fileUrl, fileBlob, fileName, openDrawing]);

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
      {/* Loading Overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            backgroundColor: 'rgba(9, 13, 22, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.85rem',
            color: '#38bdf8'
          }}
        >
          <Loader2 size={32} className="spin" />
          <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>
            Loading DWG drawing...
          </span>
        </div>
      )}

      {/* Error Alert Overlay */}
      {loadError && (
        <div
          style={{
            position: 'absolute',
            top: '1.25rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'rgba(239, 68, 68, 0.95)',
            color: '#ffffff',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.85rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}
        >
          <AlertCircle size={18} />
          <span>{loadError}</span>
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
