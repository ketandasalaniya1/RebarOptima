import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PDFViewer({ fileData, fileUrl, fileName }) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Load Document
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        let loadingTask;
        if (fileData) {
          // If Base64 Data URL, convert to Uint8Array
          if (typeof fileData === 'string' && fileData.startsWith('data:')) {
            const base64 = fileData.split(',')[1];
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            loadingTask = pdfjsLib.getDocument({ data: bytes });
          } else if (typeof fileData === 'string') {
            loadingTask = pdfjsLib.getDocument(fileData);
          } else {
            loadingTask = pdfjsLib.getDocument({ data: fileData });
          }
        } else if (fileUrl) {
          loadingTask = pdfjsLib.getDocument(fileUrl);
        } else {
          throw new Error('No PDF data or URL provided');
        }

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('PDF.js document load error:', err);
          setError(err.message || 'Failed to parse PDF document');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [fileData, fileUrl]);

  // 2. Render Page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;

    async function renderPage() {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Handle HiDPI / Retina displays
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform: transform,
          viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale, rotation]);

  const handleZoom = (delta) => {
    setScale((prev) => Math.min(3.5, Math.max(0.4, Number((prev + delta).toFixed(2)))));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#0b1120', borderRadius: '6px', overflow: 'hidden' }}>
      {/* ── PDF Controls Toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.45rem 0.85rem',
        background: '#111a2e',
        borderBottom: '1px solid #1e293b',
        color: '#f8fafc',
        fontSize: '0.8rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>{fileName || 'Document.pdf'}</span>
          <span>•</span>
          <span>
            Page {currentPage} of {numPages || 1}
          </span>
          <div style={{ display: 'flex', gap: '0.2rem', marginLeft: '0.35rem' }}>
            <button
              className="dw-btn-secondary"
              style={{ padding: '0.2rem 0.45rem' }}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              className="dw-btn-secondary"
              style={{ padding: '0.2rem 0.45rem' }}
              disabled={currentPage >= numPages}
              onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button className="dw-btn-secondary" style={{ padding: '0.2rem 0.45rem' }} onClick={() => handleZoom(-0.15)} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <span style={{ minWidth: '45px', textAlign: 'center', fontWeight: 600, fontSize: '0.76rem' }}>
            {Math.round(scale * 100)}%
          </span>
          <button className="dw-btn-secondary" style={{ padding: '0.2rem 0.45rem' }} onClick={() => handleZoom(0.15)} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button className="dw-btn-secondary" style={{ padding: '0.2rem 0.45rem' }} onClick={handleRotate} title="Rotate 90°">
            <RotateCw size={14} />
          </button>
          <button
            className="dw-btn-secondary"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
            onClick={() => { setScale(1.2); setRotation(0); }}
            title="Reset to Fit"
          >
            Fit
          </button>
        </div>
      </div>

      {/* ── Document Viewport ── */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: '#090e17'
      }}>
        {loading && (
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Loading PDF drawing sheet...
          </div>
        )}
        {error && (
          <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>
            Failed to render PDF: {error}
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            display: loading || error ? 'none' : 'block',
            boxShadow: '0 10px 35px rgba(0,0,0,0.6)',
            borderRadius: '4px',
            background: '#ffffff'
          }}
        />
      </div>
    </div>
  );
}
