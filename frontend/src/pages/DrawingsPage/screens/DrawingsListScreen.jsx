import React, { useState, useEffect } from 'react';
import './DrawingsListScreen.css';
import FilterBar from '../../../components/Drawings/FilterBar';
import DataTable from '../../../components/Drawings/DataTable';
import AppModal from '../../../components/ui/AppModal';
import ReviewApprovalModal from '../components/ReviewApprovalModal';
import { useGetDrawingsQuery, useGetBlocksQuery, useCreateDrawingMutation } from '../../../store/api/drawingsApi';
import { Search } from 'lucide-react';

export default function DrawingsListScreen({
  activeProject,
  activeTab = 'drawings',
  onTabChange,
  onViewDrawing,
  onUploadNewVersion,
  onVersionHistory,
  onCreateTransmittal,
  onDownloadDrawing,
  onVoidDrawing,
  onOpenUploadModal
}) {
  const projectId = activeProject?._id || activeProject?.id;
  const projectName = activeProject?.name || activeProject?.projectName || 'Select Project';

  // Filters
  const [selectedBlock, setSelectedBlock] = useState('all');
  const [selectedDiscipline, setSelectedDiscipline] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedReviewDrawing, setSelectedReviewDrawing] = useState(null);

  // Debounce search by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch blocks
  const { data: blocks = [] } = useGetBlocksQuery(projectId, { skip: !projectId });

  // Fetch drawings query
  const { data, isLoading, refetch } = useGetDrawingsQuery({
    projectId: projectId || undefined,
    blockId: selectedBlock !== 'all' ? selectedBlock : undefined,
    disciplineId: selectedDiscipline !== 'all' ? selectedDiscipline : undefined,
    level: selectedLevel !== 'all' ? selectedLevel : undefined,
    search: debouncedSearch || undefined,
    page,
    limit: 50
  }, {
    skip: !projectId
  });

  const drawings = data?.drawings || [];
  const pagination = data?.pagination || { page: 1, total: drawings.length, totalPages: 1 };

  // New Drawing Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    blockName: 'Block A',
    disciplineCode: 'ARCH',
    level: 'L1',
    drawingNumber: '',
    title: ''
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newForm.title.trim()) return;

    setShowNewModal(false);
    if (onOpenUploadModal) {
      onOpenUploadModal(newForm);
    }
  };

  return (
    <div className="ro-drawings-list-screen">
      {/* Screen Title */}
      <div className="ro-screen-header">
        <h1 className="ro-screen-title">Drawings</h1>
      </div>

      {/* Filter Bar matching Screen 1 */}
      <FilterBar
        projectName={projectName}
        blocks={blocks}
        selectedBlock={selectedBlock}
        onBlockChange={(val) => { setSelectedBlock(val); setPage(1); }}
        selectedDiscipline={selectedDiscipline}
        onDisciplineChange={(val) => { setSelectedDiscipline(val); setPage(1); }}
        selectedLevel={selectedLevel}
        onLevelChange={(val) => { setSelectedLevel(val); setPage(1); }}
        onNewDrawingClick={() => setShowNewModal(true)}
      />

      {/* Tabs & Search Row */}
      <div className="ro-tabs-search-row">
        <div className="ro-nav-tabs">
          <button
            type="button"
            className={`ro-nav-tab-btn ${activeTab === 'drawings' ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange('drawings')}
          >
            Drawings
          </button>
          <button
            type="button"
            className={`ro-nav-tab-btn ${activeTab === 'plan-pass' ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange('plan-pass')}
          >
            Plan Pass
          </button>
          <button
            type="button"
            className={`ro-nav-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange('matrix')}
          >
            Matrix View
          </button>
        </div>

        {/* Debounced Search */}
        <div className="ro-search-box">
          <Search size={16} className="ro-search-icon" />
          <input
            type="text"
            className="ro-search-input"
            placeholder="Search drawing number or title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {/* Table Screen 1 */}
      <DataTable
        drawings={drawings}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={(newPage) => setPage(newPage)}
        onViewDrawing={onViewDrawing}
        onUploadVersion={onUploadNewVersion}
        onVersionHistory={onVersionHistory}
        onReviewDrawing={(dw) => setSelectedReviewDrawing(dw)}
        onCreateTransmittal={onCreateTransmittal}
        onDownloadDrawing={onDownloadDrawing}
        onVoidDrawing={onVoidDrawing}
        onBulkTransmittal={(ids) => onCreateTransmittal && onCreateTransmittal(ids)}
        onBulkDownload={(ids) => onDownloadDrawing && onDownloadDrawing(ids)}
      />

      {/* "+ New Drawing" Initial Info Modal */}
      <AppModal
        open={showNewModal}
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Create New Drawing Entry"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="ro-modal-form">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="ro-form-field">
              <label className="ro-form-label">Block / Tower</label>
              <select
                className="ro-form-select"
                value={newForm.blockName}
                onChange={(e) => setNewForm({ ...newForm, blockName: e.target.value })}
              >
                <option value="Block A">Block A</option>
                <option value="Block B">Block B</option>
                <option value="Tower 1">Tower 1</option>
              </select>
            </div>

            <div className="ro-form-field">
              <label className="ro-form-label">Discipline</label>
              <select
                className="ro-form-select"
                value={newForm.disciplineCode}
                onChange={(e) => setNewForm({ ...newForm, disciplineCode: e.target.value })}
              >
                <option value="ARCH">Architectural</option>
                <option value="STR">Structural</option>
                <option value="MEPF">MEPF</option>
                <option value="ELEC">Electrical</option>
                <option value="PLUMB">Plumbing</option>
                <option value="FIRE">Fire Fighting</option>
                <option value="LAND">Landscape</option>
                <option value="INT">Interior</option>
                <option value="CIVIL">Civil</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="ro-form-field">
              <label className="ro-form-label">Level / Floor</label>
              <select
                className="ro-form-select"
                value={newForm.level}
                onChange={(e) => setNewForm({ ...newForm, level: e.target.value })}
              >
                <option value="B2">B2 (Basement 2)</option>
                <option value="B1">B1 (Basement 1)</option>
                <option value="G">Ground Floor</option>
                <option value="L1">L1 (Level 1)</option>
                <option value="L2">L2 (Level 2)</option>
                <option value="L3">L3 (Level 3)</option>
                <option value="L4">L4 (Level 4)</option>
                <option value="L5">L5 (Level 5)</option>
                <option value="TERRACE">Terrace</option>
                <option value="GENERAL">General</option>
              </select>
            </div>

            <div className="ro-form-field">
              <label className="ro-form-label">Drawing Number (Optional)</label>
              <input
                type="text"
                className="ro-form-input"
                placeholder="e.g. AR-L1-001 (auto if empty)"
                value={newForm.drawingNumber}
                onChange={(e) => setNewForm({ ...newForm, drawingNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="ro-form-field">
            <label className="ro-form-label">Drawing Title *</label>
            <input
              type="text"
              required
              className="ro-form-input"
              placeholder="e.g. Floor Plan - Level 1"
              value={newForm.title}
              onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
            />
          </div>

          <div className="ro-modal-footer-actions">
            <button
              type="button"
              className="ro-bulk-btn"
              style={{ color: 'var(--text-secondary, #475569)', borderColor: 'var(--border-color, #cbd5e1)' }}
              onClick={() => setShowNewModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ro-btn-primary-action"
            >
              Continue to Upload
            </button>
          </div>
        </form>
      </AppModal>
      {/* Screen 4 Review / Approval Modal */}
      {selectedReviewDrawing && (
        <ReviewApprovalModal
          isOpen={Boolean(selectedReviewDrawing)}
          onClose={() => setSelectedReviewDrawing(null)}
          drawing={selectedReviewDrawing}
          onViewFile={(dw) => onViewDrawing && onViewDrawing(dw)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

