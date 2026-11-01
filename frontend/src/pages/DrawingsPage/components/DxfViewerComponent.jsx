import React, { useEffect, useRef, useState } from 'react';
import { DxfViewer } from 'dxf-viewer';
import { Color } from 'three';
import { Maximize2, Layers, Loader2, Download, AlertCircle } from 'lucide-react';

export default function DxfViewerComponent({
  dxfUrl,
  dxfBlob,
  originalFileName,
  onDownloadOriginal
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [progressText, setProgressText] = useState('Loading CAD drawing...');
  const [layers, setLayers] = useState([]);
  const [showLayers, setShowLayers] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let isSubscribed = true;
    let viewer = null;
    let objectUrl = null;

    async function initViewer() {
      setIsLoading(true);
      setLoadError(null);
      setProgressText('Initializing CAD engine...');

      try {
        let fetchUrl = dxfUrl;
        if (dxfBlob) {
          objectUrl = URL.createObjectURL(dxfBlob);
          fetchUrl = objectUrl;
        } else if (fetchUrl && (fetchUrl.startsWith('/api') || fetchUrl.includes('/drawings/'))) {
          setProgressText('Fetching CAD vector stream...');
          const token = sessionStorage.getItem('accessToken');
          const headers = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;

          try {
            let resp = null;
            // 1. Try local proxied relative path first
            try {
              resp = await fetch(fetchUrl, { headers });
            } catch (_) {}

            // 2. Fallback to direct backend port 3000 if needed
            if (!resp || !resp.ok) {
              const fullUrl = fetchUrl.startsWith('http') ? fetchUrl : `http://localhost:3000${fetchUrl}`;
              try {
                resp = await fetch(fullUrl, { headers });
              } catch (_) {}
            }

            if (resp && resp.ok) {
              const blob = await resp.blob();
              objectUrl = URL.createObjectURL(blob);
              fetchUrl = objectUrl;
            } else {
              throw new Error(`Drawing CAD preview is preparing or not found (HTTP ${resp?.status || 404}).`);
            }
          } catch (err) {
            console.warn('[DxfViewer] Fetch error:', err);
            setIsLoading(false);
            setLoadError(err.message || 'Drawing CAD preview could not be loaded.');
            return;
          }
        }

        if (!fetchUrl) {
          setIsLoading(false);
          setLoadError('No DXF CAD URL or file data provided.');
          return;
        }

        viewer = new DxfViewer(containerRef.current, {
          clearColor: new Color('#090d16'),
          autoResize: true,
          blackWhiteInversion: true
        });
        viewerRef.current = viewer;

        setProgressText('Parsing CAD vector geometry...');

        await viewer.Load({
          url: fetchUrl,
          fonts: null, // Zero font parser crash; vector linework renders cleanly with WebGL
          progressCbk: (phase, processed, total) => {
            if (!isSubscribed) return;
            if (total && total > 0) {
              const pct = Math.round((processed / total) * 100);
              setProgressText(`Parsing CAD linework... ${pct}%`);
            } else {
              setProgressText('Building CAD linework & layers...');
            }
          }
        });

        if (!isSubscribed) {
          viewer.Destroy();
          return;
        }

        // Configure controls for smooth CAD pan & zoom without losing coordinates
        if (viewer.controls) {
          viewer.controls.minZoom = 0.02;
          viewer.controls.maxZoom = 100;
          viewer.controls.zoomSpeed = 1.0;
          viewer.controls.enableRotate = false;
          // Left click pans, Middle click zooms, Right click pans
          viewer.controls.mouseButtons = {
            LEFT: 2,
            MIDDLE: 1,
            RIGHT: 2
          };
        }

        // Extract layers
        const layerList = [];
        try {
          const lMap = viewer.GetLayers?.(true);
          if (lMap && typeof lMap[Symbol.iterator] === 'function') {
            for (const [name, lyr] of lMap) {
              layerList.push({
                name,
                displayName: lyr.displayName || name,
                color: lyr.color,
                visible: lyr.visible
              });
            }
          }
        } catch (_) { }

        setLayers(layerList);
        setIsLoading(false);
      } catch (err) {
        console.error('[DxfViewer] Error loading DXF:', err);
        if (isSubscribed) {
          setLoadError(err.message || 'Failed to render DXF drawing');
          setIsLoading(false);
        }
      }
    }

    initViewer();

    const fitDrawing = (v) => {
      if (!v) return;
      try {
        const bounds = v.GetBounds?.();
        const origin = v.GetOrigin?.() || { x: 0, y: 0 };
        if (bounds && isFinite(bounds.minX) && isFinite(bounds.maxX)) {
          v.FitView(
            bounds.minX - origin.x,
            bounds.maxX - origin.x,
            bounds.minY - origin.y,
            bounds.maxY - origin.y
          );
        }
      } catch (e) {
        console.warn('[DxfViewer] FitView calculation notice:', e);
      }
    };

    const handleExternalFit = () => {
      fitDrawing(viewerRef.current);
    };
    window.addEventListener('dxf-fit-view', handleExternalFit);

    return () => {
      window.removeEventListener('dxf-fit-view', handleExternalFit);
      isSubscribed = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      if (viewer) {
        try {
          viewer.Destroy();
        } catch (_) { }
      }
      viewerRef.current = null;
    };
  }, [dxfUrl, dxfBlob]);

  const handleFitView = () => {
    const v = viewerRef.current;
    if (!v) return;
    try {
      const bounds = v.GetBounds?.();
      const origin = v.GetOrigin?.() || { x: 0, y: 0 };
      if (bounds && isFinite(bounds.minX) && isFinite(bounds.maxX)) {
        v.FitView(
          bounds.minX - origin.x,
          bounds.maxX - origin.x,
          bounds.minY - origin.y,
          bounds.maxY - origin.y
        );
      }
    } catch (e) {
      console.warn('[DxfViewer] FitView calculation notice:', e);
    }
  };

  const handleToggleLayer = (name) => {
    if (!viewerRef.current) return;
    try {
      const lyr = viewerRef.current.layers?.get?.(name);
      if (lyr) {
        lyr.visible = !lyr.visible;
        viewerRef.current.Render();
        setLayers((prev) =>
          prev.map((l) => (l.name === name ? { ...l, visible: lyr.visible } : l))
        );
      }
    } catch (err) {
      console.warn('[DxfViewer] Toggle layer notice:', err);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '600px',
        backgroundColor: '#090d16',
        overflow: 'hidden'
      }}
    >
      {/* Loading Overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
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
              {progressText}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
              High-performance WebGL CAD linework & layer rendering
            </span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
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
            >
              <Download size={13} />
              <span>Download Original</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Toolbar (Fit View + Layers) */}
      {!isLoading && !loadError && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '4px 8px',
            borderRadius: '8px',
            border: '1px solid #334155',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
          }}
        >
          <button
            onClick={handleFitView}
            title="Fit Drawing to Screen (Zoom All)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#f8fafc',
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            <Maximize2 size={13} />
            <span>Fit View</span>
          </button>

          {layers.length > 0 && (
            <button
              onClick={() => setShowLayers(!showLayers)}
              title="Toggle Layers Panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: showLayers ? '#38bdf8' : '#94a3b8',
                backgroundColor: showLayers ? '#1e293b' : 'transparent',
                border: '1px solid #334155',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              <Layers size={13} />
              <span>Layers ({layers.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Layers Slide-Over Panel */}
      {showLayers && layers.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            bottom: '64px',
            width: '260px',
            zIndex: 25,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>Drawing Layers</span>
            <button
              onClick={() => setShowLayers(false)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {layers.map((l) => (
              <label
                key={l.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.75rem',
                  color: l.visible ? '#e2e8f0' : '#64748b',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  backgroundColor: l.visible ? 'rgba(51, 65, 85, 0.4)' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={l.visible}
                  onChange={() => handleToggleLayer(l.name)}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.displayName || l.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* WebGL Canvas Mount Node */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0
        }}
      />
    </div>
  );
}