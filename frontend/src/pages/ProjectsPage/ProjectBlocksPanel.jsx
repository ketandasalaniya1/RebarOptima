import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Trash2, X, Check, AlertCircle } from 'lucide-react';
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
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [busyId, setBusyId] = useState(null);

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
    setEditingId(null);
  }, [loadBlocks]);

  const notifyChanged = (nextCount) => {
    if (typeof onBlocksChanged === 'function') {
      onBlocksChanged(nextCount);
    }
  };

  const handleAdd = async (e) => {
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
      const next = [...blocks, created];
      setBlocks(next);
      setNewName('');
      notifyChanged(next.length);
    } catch (err) {
      setError(err.message || 'Failed to add block');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (block) => {
    setEditingId(block._id || block.id);
    setEditName(block.name || '');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (block) => {
    const blockId = block._id || block.id;
    const name = editName.trim();
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
    setBusyId(blockId);
    setError('');
    try {
      const updated = await projectsApi.updateBlock(projectId, blockId, { name });
      setBlocks((prev) => prev.map((b) => ((b._id || b.id) === blockId ? updated : b)));
      cancelEdit();
    } catch (err) {
      setError(err.message || 'Failed to rename block');
    } finally {
      setBusyId(null);
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
      cancelEdit();
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
            <h3 className="pbp-title">Construction Blocks</h3>
            <p className="pbp-subtitle">
              Towers / wings for <strong>{project.name}</strong>
              {blocks.length > 0 ? ` · ${blocks.length} active` : ''}
            </p>
          </div>
        </div>
        <button type="button" className="pbp-refresh" onClick={loadBlocks} disabled={loading} title="Refresh">
          {loading ? <Loader2 size={14} className="pbp-spin" /> : 'Refresh'}
        </button>
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
        <p className="pbp-empty">No blocks yet. Sites can start with zero blocks and add them later.</p>
      ) : (
        <ul className="pbp-list">
          {blocks.map((block, idx) => {
            const id = block._id || block.id;
            const isEditing = editingId === id;
            const busy = busyId === id;
            return (
              <li key={id} className="pbp-row">
                <span className="pbp-order">{block.displayOrder ?? idx + 1}</span>
                {isEditing ? (
                  <input
                    className="pbp-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={busy}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveEdit(block);
                      }
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                ) : (
                  <span className="pbp-name">{block.name}</span>
                )}
                {canEdit && (
                  <div className="pbp-row-actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="pbp-icon-btn success"
                          onClick={() => saveEdit(block)}
                          disabled={busy}
                          title="Save"
                        >
                          {busy ? <Loader2 size={14} className="pbp-spin" /> : <Check size={14} />}
                        </button>
                        <button type="button" className="pbp-icon-btn" onClick={cancelEdit} disabled={busy} title="Cancel">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="pbp-icon-btn" onClick={() => startEdit(block)} disabled={busy} title="Rename">
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
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form className="pbp-add-form" onSubmit={handleAdd}>
          <input
            className="pbp-input"
            placeholder="New block name (e.g. Tower A)"
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
    </div>
  );
}
