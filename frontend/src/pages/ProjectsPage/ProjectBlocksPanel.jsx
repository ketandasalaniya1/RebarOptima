import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { projectsApi, MAX_BLOCKS_PER_PROJECT } from '../../utils/api';
import './ProjectBlocksPanel.css';

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export default function ProjectBlocksPanel({ project, canEdit = false, onBlocksChanged }) {
  const projectId = project?._id || project?.id;
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Modal State for both Add & Edit Block
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [submittingDetail, setSubmittingDetail] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [detailFormData, setDetailFormData] = useState({
    buildingTower: '',
    floorNumber: 1,
    unitNumber: '',
    configuration: '2 BHK',
    carpetAreaSqFt: '',
    askingPrice: '',
  });

  const loadBlocks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await projectsApi.getBlocks(projectId);
      setBlocks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load blocks');
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const notifyChanged = (nextCount) => {
    if (typeof onBlocksChanged === 'function') {
      onBlocksChanged(nextCount);
    }
  };

  const openAddModal = () => {
    setError('');
    setEditingBlock(null);
    setDetailFormData({
      buildingTower: '',
      floorNumber: 1,
      unitNumber: '',
      configuration: '2 BHK',
      carpetAreaSqFt: '',
      askingPrice: '',
    });
    setShowDetailModal(true);
  };

  const openEditModal = (block) => {
    setError('');
    setEditingBlock(block);
    setDetailFormData({
      buildingTower: block.name || '',
      floorNumber: block.floorNumber != null ? block.floorNumber : 1,
      unitNumber: block.unitNumber || '',
      configuration: block.configuration || '2 BHK',
      carpetAreaSqFt: block.carpetAreaSqFt != null ? block.carpetAreaSqFt : '',
      askingPrice: block.askingPrice != null ? block.askingPrice : '',
    });
    setShowDetailModal(true);
  };

  const handleDetailSubmit = async (e) => {
    e.preventDefault();
    const towerName = detailFormData.buildingTower.trim();
    if (!towerName) {
      setError('Tower / Block Name is required');
      return;
    }

    if (editingBlock) {
      const blockId = editingBlock._id || editingBlock.id;
      const dup = blocks.some(
        (b) => (b._id || b.id) !== blockId && normalizeName(b.name) === normalizeName(towerName),
      );
      if (dup) {
        setError(`A block named "${towerName}" already exists`);
        return;
      }

      setSubmittingDetail(true);
      setError('');
      try {
        const payload = {
          name: towerName,
          floorNumber: detailFormData.floorNumber !== '' ? Number(detailFormData.floorNumber) : 1,
          unitNumber: detailFormData.unitNumber.trim(),
          configuration: detailFormData.configuration,
          carpetAreaSqFt: detailFormData.carpetAreaSqFt !== '' ? Number(detailFormData.carpetAreaSqFt) : undefined,
          askingPrice: detailFormData.askingPrice !== '' ? Number(detailFormData.askingPrice) : undefined,
        };
        const updated = await projectsApi.updateBlock(projectId, blockId, payload);
        setBlocks((prev) =>
          prev.map((b) => ((b._id || b.id) === blockId ? { ...b, ...updated } : b)),
        );
        setShowDetailModal(false);
        setEditingBlock(null);
      } catch (err) {
        setError(err.message || 'Failed to update block');
      } finally {
        setSubmittingDetail(false);
      }
    } else {
      if (blocks.length >= MAX_BLOCKS_PER_PROJECT) {
        setError(`Maximum ${MAX_BLOCKS_PER_PROJECT} blocks per project`);
        return;
      }
      const dup = blocks.some((b) => normalizeName(b.name) === normalizeName(towerName));
      if (dup) {
        setError(`A block named "${towerName}" already exists`);
        return;
      }

      setSubmittingDetail(true);
      setError('');
      try {
        const payload = {
          name: towerName,
          floorNumber: detailFormData.floorNumber !== '' ? Number(detailFormData.floorNumber) : 1,
          unitNumber: detailFormData.unitNumber.trim(),
          configuration: detailFormData.configuration,
          carpetAreaSqFt: detailFormData.carpetAreaSqFt !== '' ? Number(detailFormData.carpetAreaSqFt) : undefined,
          askingPrice: detailFormData.askingPrice !== '' ? Number(detailFormData.askingPrice) : undefined,
        };
        const created = await projectsApi.createBlock(projectId, payload);
        const next = [...blocks, created];
        setBlocks(next);
        setShowDetailModal(false);
        setDetailFormData({
          buildingTower: '',
          floorNumber: 1,
          unitNumber: '',
          configuration: '2 BHK',
          carpetAreaSqFt: '',
          askingPrice: '',
        });
        notifyChanged(next.length);
      } catch (err) {
        setError(err.message || 'Failed to add block');
      } finally {
        setSubmittingDetail(false);
      }
    }
  };

  const handleArchive = async (block) => {
    const blockId = block._id || block.id;
    if (!window.confirm(`Archive block "${block.name}"? It can no longer be selected for new work.`)) {
      return;
    }
    setBusyId(blockId);
    setError('');
    try {
      await projectsApi.archiveBlock(projectId, blockId);
      const next = blocks.filter((b) => (b._id || b.id) !== blockId);
      setBlocks(next);
      notifyChanged(next.length);
    } catch (err) {
      setError(err.message || 'Failed to archive block');
    } finally {
      setBusyId(null);
    }
  };

  if (!projectId) return null;

  return (
    <div className="pbp-panel">
      <div className="pbp-header">
        <div className="pbp-header-left">
          <Building2 size={18} />
          <div>
            <h3 className="pbp-title">Construction Blocks & Units</h3>
            <p className="pbp-subtitle">
              Towers / wings for <strong>{project.name}</strong>
              {blocks.length > 0 ? ` · ${blocks.length} active` : ''}
            </p>
          </div>
        </div>
        <div className="pbp-header-actions">
          {canEdit && (
            <button
              type="button"
              className="pbp-detail-btn"
              onClick={openAddModal}
              title="Add Block with Unit Details"
            >
              <Plus size={14} />
              <span>Add Block</span>
            </button>
          )}
          <button type="button" className="pbp-refresh" onClick={loadBlocks} disabled={loading} title="Refresh">
            {loading ? <Loader2 size={14} className="pbp-spin" /> : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="pbp-alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading && blocks.length === 0 ? (
        <div className="pbp-loading">
          <Loader2 size={20} className="pbp-spin" />
          <span>Loading blocks…</span>
        </div>
      ) : blocks.length === 0 ? (
        <p className="pbp-empty">No blocks yet. Click "Add Block" to create your first block.</p>
      ) : (
        <ul className="pbp-list">
          {blocks.map((block, idx) => {
            const id = block._id || block.id;
            const busy = busyId === id;
            const hasUnitDetails = Boolean(block.unitNumber || block.floorNumber || block.configuration);

            return (
              <li key={id} className="pbp-row">
                <span className="pbp-order">{block.displayOrder ?? idx + 1}</span>
                <div className="pbp-row-content">
                  <span className="pbp-name">{block.name}</span>
                  {hasUnitDetails && (
                    <div className="pbp-unit-badges">
                      {block.floorNumber != null && (
                        <span className="pbp-badge">Floor {block.floorNumber}</span>
                      )}
                      {block.unitNumber && (
                        <span className="pbp-badge pbp-badge-unit">Unit {block.unitNumber}</span>
                      )}
                      {block.configuration && (
                        <span className="pbp-badge pbp-badge-config">{block.configuration}</span>
                      )}
                      {block.carpetAreaSqFt != null && block.carpetAreaSqFt > 0 && (
                        <span className="pbp-badge">{block.carpetAreaSqFt} Sq.Ft</span>
                      )}
                      {block.askingPrice != null && block.askingPrice > 0 && (
                        <span className="pbp-badge pbp-badge-price">₹{Number(block.askingPrice).toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="pbp-row-actions">
                    <button
                      type="button"
                      className="pbp-icon-btn"
                      onClick={() => openEditModal(block)}
                      disabled={busy}
                      title="Edit Block & Unit Details"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="pbp-icon-btn danger"
                      onClick={() => handleArchive(block)}
                      disabled={busy}
                      title="Archive"
                    >
                      {busy ? <Loader2 size={14} className="pbp-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
         MODAL: ADD / EDIT BLOCK (Full Unit Details)
         ══════════════════════════════════════════════════════════════════════════ */}
      {showDetailModal && (
        <div className="pbp-modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="pbp-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="pbp-modal-header">
              <span className="pbp-modal-title">
                {editingBlock ? <Pencil size={18} /> : <Plus size={18} />}
                <span>{editingBlock ? 'Edit Block' : 'Add Block'}</span>
              </span>
              <button
                type="button"
                className="pbp-modal-close-btn"
                onClick={() => setShowDetailModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleDetailSubmit}>
              <div className="pbp-modal-body">
                <div className="pbp-form-grid">
                  <div className="pbp-form-group full-width">
                    <label className="pbp-form-label">Project *</label>
                    <input
                      className="pbp-form-input disabled-project"
                      type="text"
                      readOnly
                      value={project.name || 'Current Project'}
                    />
                  </div>

                  <div className="pbp-form-group">
                    <label className="pbp-form-label">Tower / Block Name *</label>
                    <input
                      className="pbp-form-input"
                      type="text"
                      required
                      placeholder="e.g. TOWER A, BLOCK C"
                      value={detailFormData.buildingTower}
                      onChange={(e) =>
                        setDetailFormData({
                          ...detailFormData,
                          buildingTower: e.target.value.toUpperCase(),
                        })
                      }
                      autoFocus
                    />
                  </div>

                  <div className="pbp-form-group">
                    <label className="pbp-form-label">Floor Number *</label>
                    <input
                      className="pbp-form-input"
                      type="number"
                      required
                      value={detailFormData.floorNumber}
                      onChange={(e) =>
                        setDetailFormData({
                          ...detailFormData,
                          floorNumber: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="pbp-form-group">
                    <label className="pbp-form-label">Unit Number (e.g. 0501) *</label>
                    <input
                      className="pbp-form-input"
                      type="text"
                      required
                      placeholder="e.g. 0501"
                      value={detailFormData.unitNumber}
                      onChange={(e) =>
                        setDetailFormData({
                          ...detailFormData,
                          unitNumber: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="pbp-form-group">
                    <label className="pbp-form-label">Configuration</label>
                    <select
                      className="pbp-form-select"
                      value={detailFormData.configuration}
                      onChange={(e) =>
                        setDetailFormData({
                          ...detailFormData,
                          configuration: e.target.value,
                        })
                      }
                    >
                      <option value="1 BHK">1 BHK</option>
                      <option value="2 BHK">2 BHK</option>
                      <option value="3 BHK">3 BHK</option>
                      <option value="4 BHK">4 BHK</option>
                      <option value="Penthouse">Penthouse</option>
                    </select>
                  </div>

                  <div className="pbp-form-group">
                    <label className="pbp-form-label">Carpet Area (Sq.Ft)</label>
                    <input
                      className="pbp-form-input"
                      type="number"
                      placeholder="1050"
                      value={detailFormData.carpetAreaSqFt}
                      onChange={(e) =>
                        setDetailFormData({
                          ...detailFormData,
                          carpetAreaSqFt: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="pbp-form-group">
                    <label className="pbp-form-label">Asking Price (₹)</label>
                    <input
                      className="pbp-form-input"
                      type="number"
                      placeholder="8200000"
                      value={detailFormData.askingPrice}
                      onChange={(e) =>
                        setDetailFormData({
                          ...detailFormData,
                          askingPrice: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="pbp-modal-footer">
                <button
                  type="button"
                  className="pbp-btn-secondary"
                  onClick={() => setShowDetailModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pbp-btn-primary"
                  disabled={submittingDetail || !detailFormData.buildingTower.trim() || !detailFormData.unitNumber.trim()}
                >
                  {submittingDetail ? (
                    <>
                      <Loader2 size={14} className="pbp-spin" />
                      <span>{editingBlock ? 'Saving...' : 'Adding...'}</span>
                    </>
                  ) : (
                    editingBlock ? 'Save Changes' : 'Add Block'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
