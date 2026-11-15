import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setView } from '../../store/slices/routingSlice';
import { useActiveProject } from '../../hooks/useActiveProject';
import { drawingsApi } from '../../utils/drawingsApi';
import RoleGate from '../../components/RoleGate';
import DrawingViewerScreen from './screens/DrawingViewerScreen';
import StickyHeader from './components/StickyHeader';
import DrawingsHub from './hubs/DrawingsHub';
import MatrixHub from './hubs/MatrixHub';
import VersionsHub from './hubs/VersionsHub';
import UploadDrawingDrawer from './drawers/UploadDrawingDrawer';
import CompareDrawingsModal from './components/CompareDrawingsModal';
import { Layers } from 'lucide-react';
import './DrawingsRedesign.css';

export default function DrawingsPage({ subView = 'drawings' }) {
  const dispatch = useDispatch();
  const { projectId: activeProjectId, selectedProject } = useActiveProject();

  // Active Tab: 'drawings' | 'matrix' | 'versions'
  const [activeTab, setActiveTab] = useState(() => {
    if (subView === 'drawings-matrix') return 'matrix';
    if (subView === 'drawings-versions') return 'versions';
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'drawings';
  });

  // URL Filters State
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      discipline: params.get('discipline') || 'all',
      block: params.get('block') || 'all',
      level: params.get('level') || 'all',
      status: params.get('status') || 'all',
      search: params.get('q') || params.get('search') || '',
    };
  });

  // Selected drawing for Versions Hub or CAD Viewer
  const [selectedDrawingId, setSelectedDrawingId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('drawing') || null;
  });
  const [selectedDrawingDetail, setSelectedDrawingDetail] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  // Data & Facets State
  const [drawings, setDrawings] = useState([]);
  const [facets, setFacets] = useState({ kpi: { total: 0, gfc: 0, draft: 0, updatedThisWeek: 0 }, disciplines: [], blocks: [] });
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedText, setLastSyncedText] = useState('Synced just now');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Upload Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerInitialData, setDrawerInitialData] = useState(null);

  // Compare Modal State
  const [compareState, setCompareState] = useState({
    isOpen: false,
    drawing: null,
    revisions: [],
    leftRevId: null,
    rightRevId: null,
  });

  // Synchronize URL query params whenever filters, activeTab, or selectedDrawingId changes
  const updateUrlParams = useCallback(
    (newFilters, newTab, newDrawingId) => {
      const sp = new URLSearchParams(window.location.search);
      const tabToUse = newTab !== undefined ? newTab : activeTab;
      const filtersToUse = newFilters !== undefined ? newFilters : filters;
      const dwIdToUse = newDrawingId !== undefined ? newDrawingId : selectedDrawingId;

      sp.set('tab', tabToUse);
      if (filtersToUse.discipline && filtersToUse.discipline !== 'all') sp.set('discipline', filtersToUse.discipline);
      else sp.delete('discipline');

      if (filtersToUse.block && filtersToUse.block !== 'all') sp.set('block', filtersToUse.block);
      else sp.delete('block');

      if (filtersToUse.level && filtersToUse.level !== 'all') sp.set('level', filtersToUse.level);
      else sp.delete('level');

      if (filtersToUse.status && filtersToUse.status !== 'all') sp.set('status', filtersToUse.status);
      else sp.delete('status');

      if (filtersToUse.search && filtersToUse.search.trim()) sp.set('q', filtersToUse.search.trim());
      else sp.delete('q');

      if (dwIdToUse) sp.set('drawing', dwIdToUse);
      else sp.delete('drawing');

      const newUrl = `${window.location.pathname}?${sp.toString()}`;
      window.history.replaceState({}, '', newUrl);
    },
    [activeTab, filters, selectedDrawingId]
  );

  // Fetch Drawings from API
  const fetchDrawingsData = useCallback(
    async (currentPage = 1, append = false) => {
      const pId = activeProjectId || selectedProject?._id || selectedProject?.id;
      if (!pId) return;

      if (currentPage === 1 && !append) setLoading(true);

      try {
        const params = {
          projectId: pId,
          page: currentPage,
          limit: 50,
        };
        if (filters.discipline && filters.discipline !== 'all') params.disciplineId = filters.discipline;
        if (filters.block && filters.block !== 'all') params.block = filters.block;
        if (filters.level && filters.level !== 'all') params.level = filters.level;
        if (filters.status && filters.status !== 'all') params.status = filters.status;
        if (filters.search && filters.search.trim()) params.search = filters.search.trim();

        const res = await drawingsApi.getDrawings(params);

        const dwList = res.drawings || (Array.isArray(res) ? res : []);
        if (append) {
          setDrawings((prev) => [...prev, ...dwList]);
        } else {
          setDrawings(dwList);
        }

        if (res.pagination) {
          setTotalCount(res.pagination.total || dwList.length);
          setHasMore(res.pagination.page < res.pagination.totalPages);
        } else {
          setTotalCount(dwList.length);
          setHasMore(false);
        }

        if (res.facets) {
          setFacets(res.facets);
        }

        setLastSyncedText('Synced just now');
      } catch (err) {
        console.error('Failed to fetch drawings:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeProjectId, selectedProject, filters]
  );

  // Load drawings on mount and whenever activeProjectId or filters change
  useEffect(() => {
    setPage(1);
    fetchDrawingsData(1, false);
  }, [fetchDrawingsData]);

  // Sync subView prop from router
  useEffect(() => {
    if (subView === 'drawings-matrix') setActiveTab('matrix');
    else if (subView === 'drawings-versions') setActiveTab('versions');
    else if (subView === 'drawings') setActiveTab('drawings');
    else if (subView !== 'drawings-viewer') setSelectedDrawingDetail(null);
  }, [subView]);

  // Restore drawing if path is /drawings/:id
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/drawings/') && !selectedDrawingDetail) {
      const parts = path.split('/');
      const dId = parts[2];
      if (dId && !['matrix', 'versions', 'approvals', 'transmittals', 'activity', 'plan-pass'].includes(dId)) {
        drawingsApi
          .getDrawingDetail(dId)
          .then((detail) => {
            if (detail && (detail.drawing || detail._id)) {
              setSelectedDrawingDetail(detail);
            }
          })
          .catch((err) => console.warn('Auto-restore drawing failed:', err));
      }
    }
  }, [selectedDrawingDetail]);

  // Handle Tab Switch
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    updateUrlParams(undefined, newTab, undefined);

    if (newTab === 'matrix') {
      dispatch(setView('drawings-matrix'));
    } else if (newTab === 'versions') {
      dispatch(setView('drawings-versions'));
    } else {
      dispatch(setView('drawings'));
    }
  };

  // Handle Filter Change
  const handleFilterChange = (updates) => {
    const nextFilters = { ...filters, ...updates };
    setFilters(nextFilters);
    updateUrlParams(nextFilters, undefined, undefined);
  };

  // Handle Refresh / Sync
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDrawingsData(1, false);
  };

  // Handle Load More
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDrawingsData(nextPage, true);
  };

  // View Drawing in CAD/PDF viewer
  const handleViewDrawing = async (dw, targetRev = null) => {
    const drawingId = dw?.drawingId || dw?._id || dw?.id;
    if (!drawingId) return;

    setViewerLoading(true);
    try {
      const detail = await drawingsApi.getDrawingDetail(drawingId);
      if (detail) {
        // If viewing a specific revision, set it as currentRevision
        const specificRev =
          targetRev ||
          (dw?.revisionNumber && detail.revisions?.find((r) => r.revisionNumber === dw.revisionNumber));
        if (specificRev) {
          detail.currentRevision = specificRev;
        }
        setSelectedDrawingDetail(detail);
        dispatch(setView('drawings-viewer'));
        window.history.pushState({ drawingId }, '', `/drawings/${drawingId}`);
      }
    } catch (err) {
      console.error('Failed to load drawing details:', err);
    } finally {
      setViewerLoading(false);
    }
  };

  // Compare versions side by side
  const handleCompareVersions = (revA, revB, dw = null, allRevisions = []) => {
    const targetDrawing =
      dw ||
      selectedDrawingDetail?.drawing ||
      drawings.find((d) => (d._id || d.id) === selectedDrawingId) ||
      drawings[0];
    const revList = allRevisions.length > 0 ? allRevisions : [revA, revB].filter(Boolean);
    setCompareState({
      isOpen: true,
      drawing: targetDrawing,
      revisions: revList,
      leftRevId: revB?._id || revB?.id, // older version on left
      rightRevId: revA?._id || revA?.id, // newer version on right
    });
  };

  // Close CAD Viewer
  const handleCloseViewer = () => {
    setSelectedDrawingDetail(null);
    if (activeTab === 'matrix') {
      dispatch(setView('drawings-matrix'));
    } else if (activeTab === 'versions') {
      dispatch(setView('drawings-versions'));
    } else {
      dispatch(setView('drawings'));
    }
  };

  // Download Drawing file
  const handleDownloadDrawing = (dw) => {
    if (!dw) return;
    if (dw.fileData) {
      const link = document.createElement('a');
      link.href = dw.fileData;
      link.download = dw.fileName || `${dw.drawingNumber || 'drawing'}.${dw.fileType || 'dwg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const dwId = dw._id || dw.id;
      drawingsApi.getDrawingDetail(dwId).then((detail) => {
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

  // Open Drawer in New Drawing Mode
  const handleOpenUpload = (initial = null) => {
    setDrawerInitialData(initial);
    setIsDrawerOpen(true);
  };

  // Open Drawer in New Revision Mode
  const handleOpenNewRevision = (dw = null) => {
    if (dw) {
      setDrawerInitialData({
        drawingNumber: dw.drawingNumber,
        title: dw.title,
        disciplineCode: dw.disciplineCode,
        blockName: dw.blockName,
        level: dw.level,
        existingDrawing: dw,
      });
      setIsDrawerOpen(true);
    } else if (drawings.length > 0) {
      // Pick first drawing or active selected
      const target = drawings[0];
      setDrawerInitialData({
        drawingNumber: target.drawingNumber,
        title: target.title,
        disciplineCode: target.disciplineCode,
        blockName: target.blockName,
        level: target.level,
        existingDrawing: target,
      });
      setIsDrawerOpen(true);
    } else {
      handleOpenUpload();
    }
  };

  // Navigate to Versions Hub with selected drawing
  const handleGoToVersions = (dwId) => {
    setSelectedDrawingId(dwId);
    handleTabChange('versions');
    updateUrlParams(undefined, 'versions', dwId);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GUARD: Active Project Required
  // ─────────────────────────────────────────────────────────────────────────
  if (!activeProjectId && !selectedProject) {
    return (
      <div className="drawings-redesign-root" style={{ padding: '2rem' }}>
        <div
          style={{
            maxWidth: '520px',
            margin: '3rem auto',
            textAlign: 'center',
            padding: '2.5rem 2rem',
            backgroundColor: 'var(--card-bg)',
            borderRadius: '12px',
            border: '1px solid var(--card-border)',
          }}
        >
          <Layers size={44} style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Select an active project
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            The drawings module and drawing matrices are scoped per project. Please choose an active project using the project selector in the top bar to proceed.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER 1: FULLSCREEN CAD / PDF VIEWER MODE
  // ─────────────────────────────────────────────────────────────────────────
  if (selectedDrawingDetail && (subView === 'drawings-viewer' || subView === 'drawings')) {
    return (
      <DrawingViewerScreen
        drawingData={selectedDrawingDetail}
        onBack={handleCloseViewer}
        onUploadNewVersion={(dw) => {
          handleOpenNewRevision(dw);
        }}
        onDownloadDrawing={handleDownloadDrawing}
        onCompareDrawing={(dw) => {
          if (selectedDrawingDetail?.revisions?.length > 1) {
            handleCompareVersions(
              selectedDrawingDetail.revisions[0],
              selectedDrawingDetail.revisions[1],
              selectedDrawingDetail.drawing || dw,
              selectedDrawingDetail.revisions
            );
          } else {
            handleCompareVersions(
              selectedDrawingDetail?.currentRevision,
              selectedDrawingDetail?.currentRevision,
              selectedDrawingDetail?.drawing || dw,
              selectedDrawingDetail?.revisions || []
            );
          }
        }}
        onVoidDrawing={(dw) => alert(`Void drawing ${dw?.drawingNumber || ''}`)}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER 2: DRAWINGS REDESIGN - 3 HUBS WITH SHARED STICKY HEADER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <RoleGate permission="drawing:read">
      <div className="drawings-redesign-root">
        {/* Sticky Context Header (Shared across all 3 hubs) */}
        <StickyHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          filters={filters}
          onFilterChange={handleFilterChange}
          facets={facets}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          lastSyncedText={lastSyncedText}
        />

        {/* Hub 1: Drawings Register */}
        {activeTab === 'drawings' && (
          <DrawingsHub
            drawings={drawings}
            totalCount={totalCount}
            facets={facets}
            filters={filters}
            onFilterChange={handleFilterChange}
            onOpenUpload={handleOpenUpload}
            onOpenNewRevision={handleOpenNewRevision}
            onGoToVersions={handleGoToVersions}
            onViewDrawing={handleViewDrawing}
            onDownloadDrawing={handleDownloadDrawing}
            onStartFromMatrix={() => handleTabChange('matrix')}
            loading={loading}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
          />
        )}

        {/* Hub 2: Matrix View */}
        {activeTab === 'matrix' && (
          <MatrixHub
            drawings={drawings}
            activeBlock={filters.block || 'All blocks'}
            onCellClick={(dw) => handleGoToVersions(dw._id || dw.id)}
            onEmptyCellClick={(lvl, disc, blk) => {
              handleOpenUpload({
                level: lvl,
                discipline: disc,
                blockName: blk !== 'All blocks' ? blk : 'Block A',
              });
            }}
          />
        )}

        {/* Hub 3: Versions History */}
        {activeTab === 'versions' && (
          <VersionsHub
            drawings={drawings}
            selectedDrawingId={selectedDrawingId}
            onSelectDrawing={(dwId) => {
              setSelectedDrawingId(dwId);
              updateUrlParams(undefined, 'versions', dwId);
            }}
            onOpenNewRevision={handleOpenNewRevision}
            onViewDrawing={handleViewDrawing}
            onDownloadDrawing={handleDownloadDrawing}
            onCompareVersions={handleCompareVersions}
            onRefresh={handleRefresh}
          />
        )}

        {/* Shared Slide-Over Upload Drawer (~520px) */}
        <UploadDrawingDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          activeProjectId={activeProjectId || selectedProject?._id || selectedProject?.id}
          initialData={drawerInitialData}
          onSuccess={() => {
            fetchDrawingsData(1, false);
          }}
        />

        {/* Side-by-side Revision Compare Modal */}
        {compareState.isOpen && (
          <CompareDrawingsModal
            isOpen={compareState.isOpen}
            open={compareState.isOpen}
            onClose={() => setCompareState((prev) => ({ ...prev, isOpen: false }))}
            drawing={compareState.drawing}
            revisions={compareState.revisions}
            initialLeftRevId={compareState.leftRevId}
            initialRightRevId={compareState.rightRevId}
          />
        )}
      </div>
    </RoleGate>
  );
}
