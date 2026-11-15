import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Layers,
  Home,
  Tag,
  Maximize2,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { projectsApi, MAX_BLOCKS_PER_PROJECT } from '../../utils/api';
import { formatINR } from '../../utils/money';
import UnitFormModal from './UnitFormModal';
import './ProjectBlocksPanel.css';

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Quick presets for common floor names
const FLOOR_PRESETS = [
  { name: 'Basement 2', floorNumber: -2 },
  { name: 'Basement 1', floorNumber: -1 },
  { name: 'Ground Floor', floorNumber: 0 },
  { name: 'First Floor', floorNumber: 1 },
  { name: 'Second Floor', floorNumber: 2 },
  { name: 'Third Floor', floorNumber: 3 },
  { name: 'Terrace', floorNumber: 4 },
];

export default function ProjectBlocksPanel({ project, canEdit = false, onBlocksChanged }) {
  const projectId = project?._id || project?.id;

  // Blocks state
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [editBlockName, setEditBlockName] = useState('');
  const [busyBlockId, setBusyBlockId] = useState(null);

  // Hierarchy expand / collapse states
  const [expandedBlockIds, setExpandedBlockIds] = useState(new Set());
  const [expandedFloorIds, setExpandedFloorIds] = useState(new Set());

  // Floors state per block: { [blockId]: Floor[] }
  const [blockFloors, setBlockFloors] = useState({});
  const [loadingFloors, setLoadingFloors] = useState({});

  // Floor create form state per block: { [blockId]: { name: string, floorNumber: number } }
  const [newFloorInput, setNewFloorInput] = useState({});
  const [addingFloorBlockId, setAddingFloorBlockId] = useState(null);

  // Floor inline editing state
  const [editingFloorId, setEditingFloorId] = useState(null);
  const [editFloorName, setEditFloorName] = useState('');
  const [editFloorNumber, setEditFloorNumber] = useState(0);
  const [busyFloorId, setBusyFloorId] = useState(null);

  // Units state per floor: { [floorId]: Unit[] }
  const [floorUnits, setFloorUnits] = useState({});
  const [loadingUnits, setLoadingUnits] = useState({});

  // Global Unit Master Data (single source of truth)
  const [masterData, setMasterData] = useState(null);

  // Unit Modal state (Add / Edit)
  const [unitModalConfig, setUnitModalConfig] = useState({
    isOpen: false,
    unit: null,
    block: null,
    floor: null,
  });

  // Load Unit Master Data
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const data = await projectsApi.getUnitMasterData();
        setMasterData(data);
      } catch (err) {
        console.warn('Failed to load unit master data:', err);
      }
    };
    fetchMasterData();
  }, []);

  // Load Blocks
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
    setNewName('');
    setEditingBlockId(null);
  }, [loadBlocks]);

  const notifyChanged = (nextCount) => {
    if (typeof onBlocksChanged === 'function') {
      onBlocksChanged(nextCount);
    }
  };

  // ── BLOCK ACTIONS ─────────────────────────────────────────────────────────

  const handleAddBlock = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (blocks.length >= MAX_BLOCKS_PER_PROJECT) {
      setError(`Maximum ${MAX_BLOCKS_PER_PROJECT} blocks per project`);
      return;
    }
    const dup = blocks.some((b) => normalizeName(b.name) === normalizeName(name));
    if (dup) {
      setError('A block with this name already exists');
      return;
    }
    setAdding(true);
    setError('');
    try {
      const created = await projectsApi.createBlock(projectId, { name });
      const next = [...blocks, { ...created, floorCount: 0, unitCount: 0 }];
      setBlocks(next);
      setNewName('');
      notifyChanged(next.length);
      // Auto-expand the newly created block
      const createdId = created._id || created.id;
      setExpandedBlockIds((prev) => new Set([...prev, createdId]));
    } catch (err) {
      setError(err.message || 'Failed to add block');
    } finally {
      setAdding(false);
    }
  };

  const startEditBlock = (block) => {
    setEditingBlockId(block._id || block.id);
    setEditBlockName(block.name || '');
    setError('');
  };

  const cancelEditBlock = () => {
    setEditingBlockId(null);
    setEditBlockName('');
  };

  const saveEditBlock = async (block) => {
    const blockId = block._id || block.id;
    const name = editBlockName.trim();
    if (!name) {
      setError('Block name is required');
      return;
    }
    const dup = blocks.some(
      (b) => (b._id || b.id) !== blockId && normalizeName(b.name) === normalizeName(name),
    );
    if (dup) {
      setError('A block with this name already exists');
      return;
    }
    setBusyBlockId(blockId);
    setError('');
    try {
      const updated = await projectsApi.updateBlock(projectId, blockId, { name });
      setBlocks((prev) =>
        prev.map((b) =>
          (b._id || b.id) === blockId ? { ...b, ...updated } : b,
        ),
      );
      cancelEditBlock();
    } catch (err) {
      setError(err.message || 'Failed to rename block');
    } finally {
      setBusyBlockId(null);
    }
  };

  const handleArchiveBlock = async (block) => {
    const blockId = block._id || block.id;
    if (
      !window.confirm(
        `Archive block "${block.name}"? It can no longer be selected for new work.`,
      )
    ) {
      return;
    }
    setBusyBlockId(blockId);
    setError('');
    try {
      await projectsApi.archiveBlock(projectId, blockId);
      const next = blocks.filter((b) => (b._id || b.id) !== blockId);
      setBlocks(next);
      notifyChanged(next.length);
      cancelEditBlock();
    } catch (err) {
      setError(err.message || 'Failed to archive block');
    } finally {
      setBusyBlockId(null);
    }
  };

  // Toggle expand block & load floors
  const toggleExpandBlock = async (blockId) => {
    setExpandedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
        loadFloorsForBlock(blockId);
      }
      return next;
    });
  };

  // ── FLOOR ACTIONS ─────────────────────────────────────────────────────────

  const loadFloorsForBlock = async (blockId) => {
    setLoadingFloors((prev) => ({ ...prev, [blockId]: true }));
    try {
      const floors = await projectsApi.getFloors(projectId, blockId);
      setBlockFloors((prev) => ({ ...prev, [blockId]: Array.isArray(floors) ? floors : [] }));
    } catch (err) {
      console.warn(`Failed to load floors for block ${blockId}:`, err);
    } finally {
      setLoadingFloors((prev) => ({ ...prev, [blockId]: false }));
    }
  };

  const handleAddFloor = async (block) => {
    const blockId = block._id || block.id;
    const input = newFloorInput[blockId] || {};
    const name = String(input.name || '').trim();
    if (!name) return;

    setAddingFloorBlockId(blockId);
    setError('');

    const existing = blockFloors[blockId] || [];
    const floorNumber =
      input.floorNumber !== undefined && input.floorNumber !== ''
        ? Number(input.floorNumber)
        : existing.length;

    try {
      const created = await projectsApi.createFloor(projectId, blockId, {
        name,
        floorNumber,
        displayOrder: existing.length + 1,
      });

      const nextFloors = [...existing, { ...created, unitCount: 0 }];
      setBlockFloors((prev) => ({ ...prev, [blockId]: nextFloors }));

      // Clear input
      setNewFloorInput((prev) => ({ ...prev, [blockId]: { name: '', floorNumber: '' } }));

      // Update block floor count in UI
      setBlocks((prev) =>
        prev.map((b) =>
          (b._id || b.id) === blockId
            ? { ...b, floorCount: (b.floorCount || 0) + 1 }
            : b,
        ),
      );

      // Auto expand newly created floor
      const createdFloorId = created._id || created.id;
      setExpandedFloorIds((prev) => new Set([...prev, createdFloorId]));
    } catch (err) {
      setError(err.message || 'Failed to add floor');
    } finally {
      setAddingFloorBlockId(null);
    }
  };

  const startEditFloor = (floor) => {
    setEditingFloorId(floor._id || floor.id);
    setEditFloorName(floor.name || '');
    setEditFloorNumber(floor.floorNumber ?? 0);
  };

  const cancelEditFloor = () => {
    setEditingFloorId(null);
    setEditFloorName('');
  };

  const saveEditFloor = async (block, floor) => {
    const blockId = block._id || block.id;
    const floorId = floor._id || floor.id;
    const name = editFloorName.trim();
    if (!name) return;

    setBusyFloorId(floorId);
    setError('');

    try {
      const updated = await projectsApi.updateFloor(projectId, blockId, floorId, {
        name,
        floorNumber: Number(editFloorNumber),
      });

      setBlockFloors((prev) => ({
        ...prev,
        [blockId]: (prev[blockId] || []).map((f) =>
          (f._id || f.id) === floorId ? { ...f, ...updated } : f,
        ),
      }));

      cancelEditFloor();
    } catch (err) {
      setError(err.message || 'Failed to update floor');
    } finally {
      setBusyFloorId(null);
    }
  };

  const handleDeleteFloor = async (block, floor) => {
    const blockId = block._id || block.id;
    const floorId = floor._id || floor.id;
    if (!window.confirm(`Delete floor "${floor.name}" from ${block.name}?`)) return;

    setBusyFloorId(floorId);
    setError('');

    try {
      await projectsApi.deleteFloor(projectId, blockId, floorId);

      setBlockFloors((prev) => ({
        ...prev,
        [blockId]: (prev[blockId] || []).filter((f) => (f._id || f.id) !== floorId),
      }));

      // Update block floor count in UI
      setBlocks((prev) =>
        prev.map((b) =>
          (b._id || b.id) === blockId
            ? { ...b, floorCount: Math.max(0, (b.floorCount || 1) - 1) }
            : b,
        ),
      );
    } catch (err) {
      setError(err.message || 'Failed to delete floor');
    } finally {
      setBusyFloorId(null);
    }
  };

  // Toggle expand floor & load units
  const toggleExpandFloor = async (blockId, floorId) => {
    setExpandedFloorIds((prev) => {
      const next = new Set(prev);
      if (next.has(floorId)) {
        next.delete(floorId);
      } else {
        next.add(floorId);
        loadUnitsForFloor(blockId, floorId);
      }
      return next;
    });
  };

  // ── UNIT ACTIONS ──────────────────────────────────────────────────────────

  const loadUnitsForFloor = async (blockId, floorId) => {
    setLoadingUnits((prev) => ({ ...prev, [floorId]: true }));
    try {
      const units = await projectsApi.getUnits(projectId, blockId, floorId);
      setFloorUnits((prev) => ({ ...prev, [floorId]: Array.isArray(units) ? units : [] }));
    } catch (err) {
      console.warn(`Failed to load units for floor ${floorId}:`, err);
    } finally {
      setLoadingUnits((prev) => ({ ...prev, [floorId]: false }));
    }
  };

  const openAddUnitModal = (block, floor) => {
    setUnitModalConfig({
      isOpen: true,
      unit: null,
      block,
      floor,
    });
  };

  const openEditUnitModal = (block, floor, unit) => {
    setUnitModalConfig({
      isOpen: true,
      unit,
      block,
      floor,
    });
  };

  const handleSaveUnitFromModal = async (unitPayload) => {
    const { block, floor, unit } = unitModalConfig;
    const blockId = block._id || block.id;
    const floorId = floor._id || floor.id;

    if (unit && (unit._id || unit.id)) {
      // Edit unit
      const unitId = unit._id || unit.id;
      const updated = await projectsApi.updateUnit(
        projectId,
        blockId,
        floorId,
        unitId,
        unitPayload,
      );

      setFloorUnits((prev) => ({
        ...prev,
        [floorId]: (prev[floorId] || []).map((u) =>
          (u._id || u.id) === unitId ? { ...u, ...updated } : u,
        ),
      }));
    } else {
      // Create unit
      const created = await projectsApi.createUnit(
        projectId,
        blockId,
        floorId,
        unitPayload,
      );

      setFloorUnits((prev) => ({
        ...prev,
        [floorId]: [...(prev[floorId] || []), created],
      }));

      // Update unit count on floor in UI
      setBlockFloors((prev) => ({
        ...prev,
        [blockId]: (prev[blockId] || []).map((f) =>
          (f._id || f.id) === floorId
            ? { ...f, unitCount: (f.unitCount || 0) + 1 }
            : f,
        ),
      }));

      // Update unit count on block in UI
      setBlocks((prev) =>
        prev.map((b) =>
          (b._id || b.id) === blockId
            ? { ...b, unitCount: (b.unitCount || 0) + 1 }
            : b,
        ),
      );
    }
  };

  const handleDeleteUnit = async (block, floor, unit) => {
    const blockId = block._id || block.id;
    const floorId = floor._id || floor.id;
    const unitId = unit._id || unit.id;

    if (!window.confirm(`Delete unit "${unit.unitCode || unit.unitNumber}"?`)) return;

    try {
      await projectsApi.deleteUnit(projectId, blockId, floorId, unitId);

      setFloorUnits((prev) => ({
        ...prev,
        [floorId]: (prev[floorId] || []).filter((u) => (u._id || u.id) !== unitId),
      }));

      // Decrement counts in UI
      setBlockFloors((prev) => ({
        ...prev,
        [blockId]: (prev[blockId] || []).map((f) =>
          (f._id || f.id) === floorId
            ? { ...f, unitCount: Math.max(0, (f.unitCount || 1) - 1) }
            : f,
        ),
      }));

      setBlocks((prev) =>
        prev.map((b) =>
          (b._id || b.id) === blockId
            ? { ...b, unitCount: Math.max(0, (b.unitCount || 1) - 1) }
            : b,
        ),
      );
    } catch (err) {
      setError(err.message || 'Failed to delete unit');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Available':
        return 'pbp-status-available';
      case 'Held':
      case 'Hold':
        return 'pbp-status-held';
      case 'Booked':
      case 'Sold':
        return 'pbp-status-booked';
      case 'Blocked':
      default:
        return 'pbp-status-blocked';
    }
  };

  if (!projectId) return null;

  return (
    <div className="pbp-panel">
      {/* Panel Header */}
      <div className="pbp-header">
        <div className="pbp-header-left">
          <Building2 size={20} />
          <div>
            <h3 className="pbp-title">Construction Blocks &amp; Inventory Structure</h3>
            <p className="pbp-subtitle">
              Hierarchy: <strong>Project → Construction Block → Floor/Level → Unit</strong>
              {blocks.length > 0 ? ` · ${blocks.length} active blocks` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="pbp-refresh"
          onClick={loadBlocks}
          disabled={loading}
          title="Refresh Hierarchy"
        >
          {loading ? <Loader2 size={14} className="pbp-spin" /> : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="pbp-alert">
          <AlertCircle size={15} />
          <span>{error}</span>
          <button
            type="button"
            className="pbp-alert-dismiss"
            onClick={() => setError('')}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Blocks List */}
      {loading && blocks.length === 0 ? (
        <div className="pbp-loading">
          <Loader2 size={20} className="pbp-spin" />
          <span>Loading structure hierarchy…</span>
        </div>
      ) : blocks.length === 0 ? (
        <div className="pbp-empty-box">
          <Layers size={28} className="pbp-empty-icon" />
          <p className="pbp-empty">No construction blocks added yet.</p>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
            Start by adding a block (e.g. Tower A, Wing B) below.
          </span>
        </div>
      ) : (
        <div className="pbp-blocks-tree">
          {blocks.map((block, idx) => {
            const blockId = block._id || block.id;
            const isExpanded = expandedBlockIds.has(blockId);
            const isEditing = editingBlockId === blockId;
            const busy = busyBlockId === blockId;
            const floors = blockFloors[blockId] || [];
            const floorsLoading = loadingFloors[blockId];

            return (
              <div key={blockId} className="pbp-block-item">
                {/* Block Bar */}
                <div className={`pbp-block-row ${isExpanded ? 'expanded' : ''}`}>
                  <button
                    type="button"
                    className="pbp-expand-btn"
                    onClick={() => toggleExpandBlock(blockId)}
                    title={isExpanded ? 'Collapse Block' : 'Expand Block'}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <span className="pbp-order">{block.displayOrder ?? idx + 1}</span>

                  {isEditing ? (
                    <input
                      className="pbp-input pbp-input-inline"
                      value={editBlockName}
                      onChange={(e) => setEditBlockName(e.target.value)}
                      disabled={busy}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEditBlock(block);
                        }
                        if (e.key === 'Escape') cancelEditBlock();
                      }}
                    />
                  ) : (
                    <div
                      className="pbp-block-main"
                      onClick={() => toggleExpandBlock(blockId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="pbp-name">{block.name}</span>
                      <div className="pbp-block-badges">
                        <span className="pbp-badge-floors">
                          <Layers size={11} />
                          {block.floorCount !== undefined
                            ? `${block.floorCount} Floors`
                            : `${floors.length} Floors`}
                        </span>
                        <span className="pbp-badge-units">
                          <Home size={11} />
                          {block.unitCount !== undefined
                            ? `${block.unitCount} Units`
                            : '0 Units'}
                        </span>
                      </div>
                    </div>
                  )}

                  {canEdit && (
                    <div className="pbp-row-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="pbp-icon-btn success"
                            onClick={() => saveEditBlock(block)}
                            disabled={busy}
                            title="Save"
                          >
                            {busy ? <Loader2 size={14} className="pbp-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            type="button"
                            className="pbp-icon-btn"
                            onClick={cancelEditBlock}
                            disabled={busy}
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="pbp-icon-btn"
                            onClick={() => startEditBlock(block)}
                            disabled={busy}
                            title="Rename Block"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="pbp-icon-btn danger"
                            onClick={() => handleArchiveBlock(block)}
                            disabled={busy}
                            title="Archive Block"
                          >
                            {busy ? <Loader2 size={13} className="pbp-spin" /> : <Trash2 size={13} />}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded Block Area: Floors / Levels inside this Block */}
                {isExpanded && (
                  <div className="pbp-block-children">
                    <div className="pbp-section-subhead">
                      <Layers size={13} />
                      <span>Floors / Levels in {block.name}</span>
                    </div>

                    {floorsLoading && floors.length === 0 ? (
                      <div className="pbp-nested-loading">
                        <Loader2 size={14} className="pbp-spin" />
                        <span>Loading floors…</span>
                      </div>
                    ) : floors.length === 0 ? (
                      <p className="pbp-empty-nested">
                        No floors added yet. Add floors/levels using the form below.
                      </p>
                    ) : (
                      <div className="pbp-floors-list">
                        {floors.map((floor) => {
                          const floorId = floor._id || floor.id;
                          const isFloorExpanded = expandedFloorIds.has(floorId);
                          const isEditingFloor = editingFloorId === floorId;
                          const floorBusy = busyFloorId === floorId;
                          const units = floorUnits[floorId] || [];
                          const unitsLoading = loadingUnits[floorId];

                          return (
                            <div key={floorId} className="pbp-floor-item">
                              {/* Floor Bar */}
                              <div
                                className={`pbp-floor-row ${isFloorExpanded ? 'expanded' : ''}`}
                              >
                                <button
                                  type="button"
                                  className="pbp-expand-btn small"
                                  onClick={() => toggleExpandFloor(blockId, floorId)}
                                  title={isFloorExpanded ? 'Collapse Floor' : 'Expand Floor'}
                                >
                                  {isFloorExpanded ? (
                                    <ChevronDown size={14} />
                                  ) : (
                                    <ChevronRight size={14} />
                                  )}
                                </button>

                                <span className="pbp-level-badge">
                                  {floor.floorNumber !== undefined
                                    ? `Lvl ${floor.floorNumber}`
                                    : 'Lvl'}
                                </span>

                                {isEditingFloor ? (
                                  <div className="pbp-floor-edit-group">
                                    <input
                                      className="pbp-input pbp-input-sm"
                                      value={editFloorName}
                                      onChange={(e) => setEditFloorName(e.target.value)}
                                      disabled={floorBusy}
                                      placeholder="Floor name"
                                      autoFocus
                                    />
                                    <input
                                      type="number"
                                      className="pbp-input pbp-input-sm pbp-input-number"
                                      value={editFloorNumber}
                                      onChange={(e) => setEditFloorNumber(e.target.value)}
                                      disabled={floorBusy}
                                      placeholder="No."
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className="pbp-floor-main"
                                    onClick={() => toggleExpandFloor(blockId, floorId)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <span className="pbp-floor-name">{floor.name}</span>
                                    <span className="pbp-badge-units small">
                                      {floor.unitCount !== undefined
                                        ? `${floor.unitCount} Units`
                                        : `${units.length} Units`}
                                    </span>
                                  </div>
                                )}

                                {canEdit && (
                                  <div className="pbp-row-actions">
                                    {isEditingFloor ? (
                                      <>
                                        <button
                                          type="button"
                                          className="pbp-icon-btn success small"
                                          onClick={() => saveEditFloor(block, floor)}
                                          disabled={floorBusy}
                                          title="Save Floor"
                                        >
                                          {floorBusy ? (
                                            <Loader2 size={12} className="pbp-spin" />
                                          ) : (
                                            <Check size={12} />
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          className="pbp-icon-btn small"
                                          onClick={cancelEditFloor}
                                          disabled={floorBusy}
                                          title="Cancel"
                                        >
                                          <X size={12} />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          className="pbp-icon-btn small"
                                          onClick={() => startEditFloor(floor)}
                                          disabled={floorBusy}
                                          title="Edit Floor"
                                        >
                                          <Pencil size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          className="pbp-icon-btn danger small"
                                          onClick={() => handleDeleteFloor(block, floor)}
                                          disabled={floorBusy}
                                          title="Delete Floor"
                                        >
                                          {floorBusy ? (
                                            <Loader2 size={12} className="pbp-spin" />
                                          ) : (
                                            <Trash2 size={12} />
                                          )}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Expanded Floor Area: Units on this Floor */}
                              {isFloorExpanded && (
                                <div className="pbp-floor-children">
                                  <div className="pbp-units-header">
                                    <span className="pbp-units-title">
                                      <Home size={12} />
                                      Units on {floor.name} ({units.length})
                                    </span>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        className="pbp-btn-add-unit"
                                        onClick={() => openAddUnitModal(block, floor)}
                                      >
                                        <Plus size={13} />
                                        <span>Add Unit</span>
                                      </button>
                                    )}
                                  </div>

                                  {unitsLoading && units.length === 0 ? (
                                    <div className="pbp-nested-loading">
                                      <Loader2 size={13} className="pbp-spin" />
                                      <span>Loading units…</span>
                                    </div>
                                  ) : units.length === 0 ? (
                                    <p className="pbp-empty-nested">
                                      No units on this floor. Click '+ Add Unit' above to configure inventory.
                                    </p>
                                  ) : (
                                    <div className="pbp-units-grid">
                                      {units.map((unit) => {
                                        const unitId = unit._id || unit.id;
                                        const status =
                                          unit.effectiveStatus || unit.availabilityStatus || 'Available';
                                        const specs =
                                          Array.isArray(unit.specifications) && unit.specifications.length > 0
                                            ? unit.specifications
                                            : Array.isArray(unit.features)
                                              ? unit.features
                                              : [];

                                        return (
                                          <div key={unitId} className="pbp-unit-card">
                                            <div className="pbp-unit-card-header">
                                              <div>
                                                <div className="pbp-unit-code">
                                                  {unit.unitCode || unit.unitNumber}
                                                </div>
                                                <div className="pbp-unit-type-label">
                                                  {unit.configuration || '2 BHK'} • {unit.propertyType || 'Apartment'}
                                                </div>
                                              </div>
                                              <span
                                                className={`pbp-status-badge ${getStatusBadgeClass(status)}`}
                                              >
                                                {status}
                                              </span>
                                            </div>

                                            <div className="pbp-unit-card-body">
                                              <div className="pbp-unit-stat">
                                                <Maximize2 size={11} />
                                                <span>
                                                  {unit.carpetAreaSqFt || 0} {unit.areaUnit || 'sq.ft'} Carpet
                                                  {unit.saleableAreaSqFt
                                                    ? ` (${unit.saleableAreaSqFt} Super)`
                                                    : ''}
                                                </span>
                                              </div>

                                              {unit.basePrice > 0 && (
                                                <div className="pbp-unit-stat pbp-unit-price">
                                                  <DollarSign size={11} />
                                                  <span>{formatINR(unit.basePrice)}</span>
                                                </div>
                                              )}

                                              {unit.facing && (
                                                <div className="pbp-unit-facing">
                                                  Facing: <strong>{unit.facing}</strong>
                                                </div>
                                              )}

                                              {specs.length > 0 && (
                                                <div className="pbp-unit-specs">
                                                  {specs.slice(0, 3).map((sp) => (
                                                    <span key={sp} className="pbp-unit-spec-tag">
                                                      {sp}
                                                    </span>
                                                  ))}
                                                  {specs.length > 3 && (
                                                    <span className="pbp-unit-spec-tag more">
                                                      +{specs.length - 3} more
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>

                                            {canEdit && (
                                              <div className="pbp-unit-card-actions">
                                                <button
                                                  type="button"
                                                  className="pbp-icon-btn small"
                                                  onClick={() => openEditUnitModal(block, floor, unit)}
                                                  title="Edit Unit"
                                                >
                                                  <Pencil size={11} />
                                                </button>
                                                <button
                                                  type="button"
                                                  className="pbp-icon-btn danger small"
                                                  onClick={() => handleDeleteUnit(block, floor, unit)}
                                                  title="Delete Unit"
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Floor Form inside Block */}
                    {canEdit && (
                      <div className="pbp-add-floor-box">
                        <div className="pbp-add-floor-form">
                          <input
                            className="pbp-input pbp-input-sm"
                            placeholder="Floor name (e.g. Ground Floor, 1st Floor)"
                            value={(newFloorInput[blockId] || {}).name || ''}
                            onChange={(e) =>
                              setNewFloorInput((prev) => ({
                                ...prev,
                                [blockId]: {
                                  ...(prev[blockId] || {}),
                                  name: e.target.value,
                                },
                              }))
                            }
                            maxLength={80}
                          />
                          <input
                            type="number"
                            className="pbp-input pbp-input-sm pbp-input-number"
                            placeholder="Level No."
                            value={
                              (newFloorInput[blockId] || {}).floorNumber !== undefined
                                ? (newFloorInput[blockId] || {}).floorNumber
                                : ''
                            }
                            onChange={(e) =>
                              setNewFloorInput((prev) => ({
                                ...prev,
                                [blockId]: {
                                  ...(prev[blockId] || {}),
                                  floorNumber: e.target.value,
                                },
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="pbp-btn-add-floor"
                            onClick={() => handleAddFloor(block)}
                            disabled={
                              addingFloorBlockId === blockId ||
                              !((newFloorInput[blockId] || {}).name || '').trim()
                            }
                          >
                            {addingFloorBlockId === blockId ? (
                              <Loader2 size={13} className="pbp-spin" />
                            ) : (
                              <Plus size={13} />
                            )}
                            <span>Add Floor</span>
                          </button>
                        </div>

                        {/* Quick preset chips */}
                        <div className="pbp-presets-row">
                          <span className="pbp-presets-label">Presets:</span>
                          {FLOOR_PRESETS.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              className="pbp-preset-chip"
                              onClick={() =>
                                setNewFloorInput((prev) => ({
                                  ...prev,
                                  [blockId]: {
                                    name: p.name,
                                    floorNumber: p.floorNumber,
                                  },
                                }))
                              }
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Block Form */}
      {canEdit && (
        <form className="pbp-add-form" onSubmit={handleAddBlock}>
          <input
            className="pbp-input"
            placeholder="New block name (e.g. Tower A, Wing B)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={adding || blocks.length >= MAX_BLOCKS_PER_PROJECT}
            maxLength={120}
          />
          <button
            type="submit"
            className="pbp-add-btn"
            disabled={adding || !newName.trim() || blocks.length >= MAX_BLOCKS_PER_PROJECT}
          >
            {adding ? <Loader2 size={14} className="pbp-spin" /> : <Plus size={14} />}
            <span>Add Block</span>
          </button>
        </form>
      )}

      {/* Unit Form Modal (Single Source of Truth) */}
      <UnitFormModal
        isOpen={unitModalConfig.isOpen}
        onClose={() =>
          setUnitModalConfig({ isOpen: false, unit: null, block: null, floor: null })
        }
        onSave={handleSaveUnitFromModal}
        unit={unitModalConfig.unit}
        block={unitModalConfig.block}
        floor={unitModalConfig.floor}
        masterData={masterData}
      />
    </div>
  );
}
