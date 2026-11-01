import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setView } from '../../store/slices/routingSlice';
import { useActiveProject } from '../../hooks/useActiveProject';
import { drawingsApi } from '../../utils/drawingsApi';
import RoleGate from '../../components/RoleGate';
import AppModal from '../../components/ui/AppModal';
import SimpleDrawingViewer from './components/SimpleDrawingViewer';
import DrawingViewerScreen from './screens/DrawingViewerScreen';
import DrawingsListScreen from './screens/DrawingsListScreen';
import DrawingMatrixScreen from './screens/DrawingMatrixScreen';
import ApprovalsInboxScreen from './screens/ApprovalsInboxScreen';
import PlanPassScreen from './screens/PlanPassScreen';
import TransmittalsScreen from './screens/TransmittalsScreen';
import DrawingActivityScreen from './screens/DrawingActivityScreen';
import UploadVersionModal from './components/UploadVersionModal';
import { Upload, RefreshCw, AlertCircle, FileText, FolderPlus, Layers } from 'lucide-react';
import './DrawingsPage.css';

export default function DrawingsPage({ subView = 'drawings' }) {
  const dispatch = useDispatch();
  const { projectId: activeProjectId, selectedProject } = useActiveProject();

  // Internal tab state ('drawings' | 'plan-pass' | 'matrix')
  const [activeTab, setActiveTab] = useState(() => {
    if (subView === 'drawings-matrix') return 'matrix';
    if (subView === 'drawings-plan-pass') return 'plan-pass';
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'drawings';
  });

  // Selected Drawing for Viewer (Screen 2)
  const [selectedDrawingDetail, setSelectedDrawingDetail] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  // Upload Modal State (Phase 1 version 1 creation flow)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFileData, setUploadFileData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadMeta, setUploadMeta] = useState({
    title: '',
    drawingNumber: '',
    blockName: 'Block A',
    disciplineCode: 'ARCH',
    level: 'L1'
  });

  // Sync activeTab and clear viewer when subView prop changes from navigation
  useEffect(() => {
    if (subView !== 'drawings-viewer') {
      setSelectedDrawingDetail(null);
    }
    if (subView === 'drawings-matrix') setActiveTab('matrix');
    else if (subView === 'drawings-plan-pass') setActiveTab('plan-pass');
    else if (subView === 'drawings') setActiveTab('drawings');
    else setActiveTab('');
  }, [subView]);

  // Restore drawing if path is /drawings/:id on page load or refresh
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/drawings/') && !selectedDrawingDetail) {
      const parts = path.split('/');
      const dId = parts[2];
      if (dId && !['matrix', 'approvals', 'transmittals', 'activity', 'plan-pass'].includes(dId)) {
        drawingsApi.getDrawingDetail(dId).then((detail) => {
          if (detail && (detail.drawing || detail._id)) {
            setSelectedDrawingDetail(detail);
          }
        }).catch((err) => {
          console.warn('Auto-restore drawing failed:', err);
        });
      }
    }
  }, []);

  // Handle Tab Switch (updates URL and Redux view state)
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    const sp = new URLSearchParams(window.location.search);
    sp.set('tab', newTab);

    if (newTab === 'matrix') {
      dispatch(setView('drawings-matrix'));
    } else if (newTab === 'plan-pass') {
      dispatch(setView('drawings-plan-pass'));
    } else {
      dispatch(setView('drawings'));
    }
  };

  // Open Drawing in Viewer
  const handleViewDrawing = async (dw) => {
    const drawingId = dw._id || dw.id;
    if (!drawingId) return;

    setViewerLoading(true);
    try {
      const detail = await drawingsApi.getDrawingDetail(drawingId);
      setSelectedDrawingDetail(detail);
      dispatch(setView('drawings-viewer'));
      window.history.pushState({ drawingId }, '', `/drawings/${drawingId}`);
    } catch (err) {
      console.error('Failed to load drawing details:', err);
      alert('Could not load drawing details.');
    } finally {
      setViewerLoading(false);
    }
  };

  // Close Viewer and return to List
  const handleCloseViewer = () => {
    setSelectedDrawingDetail(null);
    if (activeTab === 'matrix') {
      dispatch(setView('drawings-matrix'));
    } else {
      dispatch(setView('drawings'));
    }
  };

  // Download drawing
  const handleDownloadDrawing = (dwOrIds) => {
    if (Array.isArray(dwOrIds)) {
      alert(`Downloading ${dwOrIds.length} drawings...`);
      return;
    }
    const dw = dwOrIds;
    if (dw.fileData) {
      const link = document.createElement('a');
      link.href = dw.fileData;
      link.download = dw.fileName || `${dw.drawingNumber || 'drawing'}.${dw.fileType || 'dwg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      drawingsApi.getDrawingDetail(dw._id).then((detail) => {
        const rev = detail.currentRevision || detail.revisions?.[0];
        if (rev?.fileData) {
          const link = document.createElement('a');
          link.href = rev.fileData;
          link.download = rev.fileName || `${dw.drawingNumber || 'drawing'}.${rev.fileType || 'dwg'}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          alert('Drawing file content is not available for download.');
        }
      });
    }
  };

  // Handle New Drawing modal kickoff
  const handleOpenUploadFromInitial = (initialMeta) => {
    setUploadMeta((prev) => ({
      ...prev,
      ...initialMeta,
      projectId: activeProjectId || selectedProject?._id || selectedProject?.id
    }));
    setShowUploadModal(true);
    setUploadFile(null);
    setUploadFileData(null);
    setUploadError('');
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    setUploadFile(file);
    setUploadError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadFileData(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile && !uploadFileData) {
      setUploadError('Please select a DWG, DXF, PDF, or image file to upload.');
      return;
    }
    if (!uploadMeta.title.trim()) {
      setUploadError('Please enter a drawing title.');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const targetProjectId = activeProjectId || selectedProject?._id;
      const fileExt = (uploadFile?.name.split('.').pop() || 'dwg').toLowerCase();

      const payload = {
        projectId: targetProjectId,
        blockName: uploadMeta.blockName || 'Block A',
        disciplineCode: uploadMeta.disciplineCode || 'ARCH',
        level: uploadMeta.level || 'L1',
        title: uploadMeta.title.trim(),
        drawingNumber: uploadMeta.drawingNumber.trim() || undefined,
        drawingType: 'General Arrangement',
        initialChangeDescription: 'Initial drawing version 1 upload',
        fileData: uploadFileData,
        fileName: uploadFile ? uploadFile.name : `drawing.${fileExt}`,
        fileSize: uploadFile ? uploadFile.size : 0,
        fileType: fileExt
      };

      const res = await drawingsApi.createDrawing(payload);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadFileData(null);

      // Open new drawing directly in viewer
      if (res?._id) {
        const detail = await drawingsApi.getDrawingDetail(res._id);
        setSelectedDrawingDetail(detail);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload drawing.');
    } finally {
      setUploading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GUARD 1: Active Project Required
  // ─────────────────────────────────────────────────────────────────────────
  if (!activeProjectId && !selectedProject) {
    return (
      <div className="drawings-module-root" style={{ padding: '2rem' }}>
        <div
          style={{
            maxWidth: '520px',
            margin: '3rem auto',
            textAlign: 'center',
            padding: '2.5rem 2rem',
            backgroundColor: 'var(--card-bg, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
        >
          <Layers size={44} style={{ color: 'var(--accent, #059669)', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: '8px' }}>
            Select an Active Project
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', lineHeight: 1.6 }}>
            The Drawings module and drawing matrices are scoped per project. Please choose or switch an active project using the project selector in the top bar or left sidebar to proceed.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER 1: VIEWER MODE (SCREEN 2)
  // ─────────────────────────────────────────────────────────────────────────
  if (selectedDrawingDetail && (subView === 'drawings-viewer' || subView === 'drawings')) {
    return (
      <DrawingViewerScreen
        drawingData={selectedDrawingDetail}
        onBack={handleCloseViewer}
        onUploadNewVersion={(dw) => {
          handleOpenUploadFromInitial({
            title: dw?.title || '',
            drawingNumber: dw?.drawingNumber || '',
            blockName: dw?.blockName || 'Block A',
            disciplineCode: dw?.disciplineCode || 'ARCH',
            level: dw?.level || 'L1'
          });
        }}
        onCreateTransmittal={(dw) => {
          setSelectedDrawingDetail(null);
          dispatch(setView('drawings-transmittals'));
        }}
        onDownloadDrawing={handleDownloadDrawing}
        onCompareDrawing={(dw) => alert(`Comparing drawing ${dw?.drawingNumber || ''} with previous revision`)}
        onVoidDrawing={(dw) => alert(`Void drawing ${dw?.drawingNumber || ''}`)}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER 2: MAIN SCREENS DISPATCHER (WRAPPED IN ROLE GATE)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <RoleGate permission="drawing:read">
      <div className="drawings-module-root" style={{ padding: '1.25rem 1.5rem', width: '100%' }}>
        {/* Subview Dispatcher */}
        {subView === 'drawings-approvals' ? (
          <ApprovalsInboxScreen
            activeProject={selectedProject}
            onViewDrawing={handleViewDrawing}
          />
        ) : subView === 'drawings-transmittals' ? (
          <TransmittalsScreen
            activeProject={selectedProject}
          />
        ) : subView === 'drawings-activity' ? (
          <DrawingActivityScreen
            activeProject={selectedProject}
          />
        ) : subView === 'drawings-matrix' || (subView === 'drawings' && activeTab === 'matrix') ? (
          <DrawingMatrixScreen
            activeProject={selectedProject}
            onSelectDrawing={(cell) => handleViewDrawing(cell)}
            onEmptyCellClick={(row, level) => {
              handleOpenUploadFromInitial({
                title: `${row.title} - ${level}`,
                level: level,
                disciplineCode: row.disciplineCode || 'ARCH'
              });
            }}
          />
        ) : subView === 'drawings-plan-pass' || (subView === 'drawings' && activeTab === 'plan-pass') ? (
          <PlanPassScreen
            activeProject={selectedProject}
            onViewDrawing={handleViewDrawing}
            onUploadDocument={(initialMeta) => {
              handleOpenUploadFromInitial({
                ...initialMeta,
                title: 'Sanctioned Plan',
                disciplineCode: 'PASS',
                level: 'GENERAL'
              });
            }}
          />
        ) : (
          /* Screen 1: Drawings Register */
          <DrawingsListScreen
            activeProject={selectedProject}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onViewDrawing={handleViewDrawing}
            onUploadNewVersion={(dw) => {
              handleOpenUploadFromInitial({
                _id: dw._id || dw.id,
                title: dw.title,
                drawingNumber: dw.drawingNumber,
                blockName: dw.blockName || 'Block A',
                disciplineCode: dw.disciplineCode || 'ARCH',
                level: dw.level || 'L1'
              });
            }}
            onVersionHistory={(dw) => handleViewDrawing(dw)}
            onCreateTransmittal={(dw) => dispatch(setView('drawings-transmittals'))}
            onDownloadDrawing={handleDownloadDrawing}
            onVoidDrawing={(dw) => alert(`Voiding drawing ${dw.drawingNumber}`)}
            onOpenUploadModal={handleOpenUploadFromInitial}
          />
        )}

        {/* Phase 3 Screen 3 Upload Modal */}
        <UploadVersionModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          drawing={uploadMeta}
          onSuccess={async (res) => {
            const targetId = res?.drawingId || res?._id || uploadMeta?._id;
            if (targetId) {
              try {
                const detail = await drawingsApi.getDrawingDetail(targetId);
                setSelectedDrawingDetail(detail);
                dispatch(setView('drawings-viewer'));
              } catch (err) {
                console.warn('Could not load drawing after upload:', err);
              }
            }
          }}
        />
      </div>
    </RoleGate>
  );
}
