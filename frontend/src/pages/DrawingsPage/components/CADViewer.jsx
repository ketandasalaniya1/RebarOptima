import React, { useEffect, useRef, useState } from 'react';
import { createApp, h, shallowReactive } from 'vue';
import { MlCadViewer, i18n } from '@mlightcad/cad-viewer';
import { AcApDocManager } from '@mlightcad/cad-simple-viewer';
import { AcDbDatabaseConverterManager, AcDbFileType } from '@mlightcad/data-model';
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { AlertCircle } from 'lucide-react';

// ── 1. Safe-Guard AcApDocManager.instance Getter ──────────────────────────────
// Ribbon components inside @mlightcad/cad-viewer (such as MlLineTypeSelect,
// MlRibbonCommands, and sysVar watchers) access `q.instance.curView` and
// `q.instance.curDocument` during mounting and component update cycles.
// When AcApDocManager._instance has not been created yet (or is tearing down),
// returning a safe proxy prevents TypeError crashes (`Cannot read properties of undefined (reading 'curView')`).
// As soon as AcApDocManager creates the real instance, it immediately returns the real singleton.
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
      if (prop === 'curView') return emptyView;
      if (prop === 'curDocument') return emptyDoc;
      if (prop === 'editor') return emptyEditor;
      if (prop === 'events') return emptyEvents;
      if (prop === 'pluginManager') return { unloadAllPlugins: async () => {}, registerLazyAgentPlugin: () => {} };
      if (prop === 'lookupLocalCmd') return () => null;
      if (prop === 'openUrl' || prop === 'openDocument') return async () => true;
      if (prop === 'destroy') return async () => {};
      if (prop === 'setOpenDocumentDefaults') return () => {};
      if (prop === '_instance') return undefined;
      return () => {};
    },
    set() {
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


// ── 2. Register LibreDWG Converter for AutoCAD DWG Files ───────────────────────
// LibreDWG WebAssembly worker handles parsing of binary DWG files into drawing entities.
function ensureDwgConverterRegistered() {
  try {
    const manager = AcDbDatabaseConverterManager.instance;
    if (manager && !manager.get(AcDbFileType.DWG)) {
      manager.register(
        AcDbFileType.DWG,
        new AcDbLibreDwgConverter({
          convertByEntityType: false,
          useWorker: true,
          parserWorkerUrl: '/workers/libredwg-parser-worker.js'
        })
      );
    }
  } catch (err) {
    console.warn('LibreDWG converter registration notice:', err);
  }
}

// ── 3. File Formats Converter ──────────────────────────────────────────────────
// Converts Base64 DataURL, ArrayBuffer, Blob, or File into a valid File object.
function toFileObject(data, filename) {
  if (!data) return null;
  if (data instanceof File) return data;
  if (data instanceof Blob) return new File([data], filename || 'drawing.dwg');
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return new File([data], filename || 'drawing.dwg', { type: 'application/octet-stream' });
  }
  if (typeof data === 'string') {
    try {
      let cleanUrl = data;
      if (!cleanUrl.includes(',')) {
        cleanUrl = 'data:application/octet-stream;base64,' + cleanUrl;
      }
      const arr = cleanUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const base64Data = arr[1].replace(/[\r\n\s]/g, '');
      const bstr = atob(base64Data);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename || 'drawing.dwg', { type: mime });
    } catch (err) {
      console.error('Error converting dataURL to File:', err);
      return null;
    }
  }
  return null;
}

// ── 4. Main CADViewer React Component ─────────────────────────────────────────
export default function CADViewer({ fileData, fileUrl, fileBlob, fileName }) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const vuePropsRef = useRef(null);
  const isCreatedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Register DWG parser once
  useEffect(() => {
    ensureDwgConverterRegistered();
  }, []);

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

  // Mount Vue MlCadViewer app once when container attaches
  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return; // Prevent duplicate initialization on re-renders

    setLoadError(null);
    setIsReady(false);
    isCreatedRef.current = false;

    // Resolve initial file if available
    const initialFile = fileBlob
      ? toFileObject(fileBlob, fileName)
      : fileData
      ? toFileObject(fileData, fileName)
      : undefined;

    // Reactive props passed to MlCadViewer
    const reactiveProps = shallowReactive({
      locale: 'en',
      theme: 'dark',
      background: 0x0b1120,
      disableExport: false,
      baseUrl: '/',
      localFile: initialFile,
      url: initialFile ? undefined : (fileUrl || undefined),

      // Documented 'create' lifecycle event:
      // Fired when MlCadViewer has created AcApDocManager with the canvas container
      onCreate: () => {
        isCreatedRef.current = true;
        setIsReady(true);
      },
      onDestroy: () => {
        isCreatedRef.current = false;
        setIsReady(false);
      }
    });

    vuePropsRef.current = reactiveProps;

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
    } catch (err) {
      console.error('Error mounting CAD Viewer:', err);
      setLoadError(err.message || 'Failed to initialize CAD Viewer');
    }

    // Cleanup: Only unmount when CADViewer is actually removed from DOM
    return () => {
      isCreatedRef.current = false;
      if (appRef.current) {
        try {
          appRef.current.unmount();
        } catch (unmountErr) {
          console.warn('CAD Viewer unmount cleanup notice:', unmountErr);
        }
        appRef.current = null;
        vuePropsRef.current = null;
      }
    };
  }, []); // Run mount once on mount

  // Smoothly update file prop on the already-mounted instance without unmounting
  useEffect(() => {
    if (!vuePropsRef.current) return;

    const targetFile = fileBlob
      ? toFileObject(fileBlob, fileName)
      : fileData
      ? toFileObject(fileData, fileName)
      : undefined;

    if (targetFile) {
      vuePropsRef.current.url = undefined;
      vuePropsRef.current.localFile = targetFile;
    } else if (fileUrl) {
      vuePropsRef.current.localFile = undefined;
      vuePropsRef.current.url = fileUrl;
    }
  }, [fileData, fileUrl, fileBlob, fileName]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '560px', background: '#0b1120', borderRadius: '6px', overflow: 'hidden' }}>
      {loadError && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          background: 'rgba(239, 68, 68, 0.95)',
          color: '#ffffff',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.82rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}>
          <AlertCircle size={16} />
          <span>{loadError}</span>
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '560px'
        }}
      />
    </div>
  );
}
