import React, { useState } from 'react';
import { Plus, ChevronRight, ChevronDown, Layers, Building, FolderPlus, Trash2, Edit3, X } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function ProjectHierarchyManager({
  projects,
  selectedProject,
  onSelectProject,
  blocks,
  selectedBlock,
  onSelectBlock,
  levels,
  selectedLevel,
  onSelectLevel,
  onRefreshHierarchy
}) {
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);

  // Form states
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [clientName, setClientName] = useState('');

  const [blockName, setBlockName] = useState('');
  const [blockCode, setBlockCode] = useState('');

  const [levelName, setLevelName] = useState('');
  const [floorNumber, setFloorNumber] = useState(0);

  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleBlockExpand = (blockId) => {
    setExpandedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const created = await castingApi.createProject({
        name: projectName.trim(),
        code: projectCode.trim() || undefined,
        location: projectLocation.trim(),
        clientName: clientName.trim()
      });
      setShowProjectModal(false);
      setProjectName('');
      setProjectCode('');
      setProjectLocation('');
      setClientName('');
      await onRefreshHierarchy();
      if (created) onSelectProject(created);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBlock = async (e) => {
    e.preventDefault();
    if (!blockName.trim() || !selectedProject) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const created = await castingApi.createBlock(selectedProject.id || selectedProject._id, {
        name: blockName.trim(),
        code: blockCode.trim() || undefined
      });
      setShowBlockModal(false);
      setBlockName('');
      setBlockCode('');
      await onRefreshHierarchy();
      if (created) {
        onSelectBlock(created);
        setExpandedBlocks(prev => ({ ...prev, [created.id || created._id]: true }));
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create block');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLevel = async (e) => {
    e.preventDefault();
    if (!levelName.trim() || !selectedBlock) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const created = await castingApi.createLevel(selectedBlock.id || selectedBlock._id, {
        name: levelName.trim(),
        floorNumber: Number(floorNumber) || 0
      });
      setShowLevelModal(false);
      setLevelName('');
      setFloorNumber(0);
      await onRefreshHierarchy();
      if (created) onSelectLevel(created);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create level');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLevel = async (lvl, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete level '${lvl.name}'?`)) return;
    try {
      await castingApi.deleteLevel(lvl.id || lvl._id);
      await onRefreshHierarchy();
    } catch (err) {
      alert(err.message || 'Failed to delete level');
    }
  };

  const handleDeleteBlock = async (blk, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete block '${blk.name}' and all its levels?`)) return;
    try {
      await castingApi.deleteBlock(blk.id || blk._id);
      await onRefreshHierarchy();
    } catch (err) {
      alert(err.message || 'Failed to delete block');
    }
  };

  return (
    <div className="hierarchy-pane">
      <div className="hierarchy-pane-header">
        <span className="hierarchy-pane-title">
          <Building size={18} className="casting-accent-icon" />
          Project & Hierarchy
        </span>
        <button
          className="casting-btn casting-btn-secondary casting-btn-sm"
          onClick={() => {
            setErrorMsg('');
            setShowProjectModal(true);
          }}
          title="Create New Project"
        >
          <FolderPlus size={14} /> + New Project
        </button>
      </div>

      {/* Project Selector */}
      <div className="project-select-row">
        <label className="project-select-lbl">Active Project</label>
        <select
          className="casting-select"
          value={selectedProject ? (selectedProject.id || selectedProject._id) : ''}
          onChange={(e) => {
            const p = projects.find(item => (item.id || item._id) === e.target.value);
            if (p) onSelectProject(p);
          }}
        >
          {projects.length === 0 && <option value="">No projects available</option>}
          {projects.map(p => (
            <option key={p.id || p._id} value={p.id || p._id}>
              {p.name} ({p.code || 'PRJ'})
            </option>
          ))}
        </select>
      </div>

      {/* Blocks & Levels Tree */}
      <div className="tree-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <span className="project-select-lbl">Blocks & Floors</span>
          {selectedProject && (
            <button
              className="casting-btn casting-btn-secondary casting-btn-xs"
              onClick={() => {
                setErrorMsg('');
                setShowBlockModal(true);
              }}
            >
              <Plus size={12} /> Add Block
            </button>
          )}
        </div>

        {blocks.length === 0 ? (
          <div className="casting-tree-empty">
            No blocks found in this project. Click '+ Add Block' above.
          </div>
        ) : (
          blocks.map(block => {
            const bId = block.id || block._id;
            const isExpanded = expandedBlocks[bId] ?? true;
            const isSelected = selectedBlock && (selectedBlock.id || selectedBlock._id) === bId;

            return (
              <div key={bId} className="tree-block-card">
                <div
                  className="tree-block-header"
                  onClick={() => {
                    onSelectBlock(block);
                    toggleBlockExpand(bId);
                  }}
                >
                  <span className="tree-block-name">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {block.name} ({block.code || 'BLK'})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      className="casting-btn casting-btn-secondary casting-btn-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBlock(block);
                        setShowLevelModal(true);
                      }}
                      title="Add Floor / Level"
                    >
                      <Plus size={11} /> Floor
                    </button>
                    <button
                      className="casting-action-btn-danger"
                      onClick={(e) => handleDeleteBlock(block, e)}
                      title="Delete Block"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="tree-level-list">
                    {(levels[bId] || []).length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.25rem' }}>
                        No floors yet
                      </span>
                    ) : (
                      (levels[bId] || []).map(level => {
                        const lId = level.id || level._id;
                        const isLvlSelected = selectedLevel && (selectedLevel.id || selectedLevel._id) === lId;

                        return (
                          <div
                            key={lId}
                            className={`tree-level-item ${isLvlSelected ? 'active' : ''}`}
                            onClick={() => {
                              onSelectBlock(block);
                              onSelectLevel(level);
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Layers size={13} />
                              {level.name}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.7rem', color: isLvlSelected ? '#2dd4bf' : '#64748b' }}>
                                {level.memberCount || 0} mbrs
                              </span>
                              <button
                                className="btn-icon-danger"
                                style={{ padding: '0.15rem 0.25rem' }}
                                onClick={(e) => handleDeleteLevel(level, e)}
                                title="Delete Level"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal 1: Create Project */}
      {showProjectModal && (
        <div className="casting-modal-backdrop">
          <div className="casting-modal">
            <div className="casting-modal-header">
              <h3 className="casting-modal-title">Create Casting Project</h3>
              <button className="casting-modal-close" onClick={() => setShowProjectModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="casting-modal-body">
                {errorMsg && (
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '8px', fontSize: '0.825rem' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Skyline Heights Tower"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Project Code</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. SHT-01"
                      value={projectCode}
                      onChange={(e) => setProjectCode(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Mumbai, Sector 4"
                      value={projectLocation}
                      onChange={(e) => setProjectLocation(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Client / Developer Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Godrej Properties"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
              </div>
              <div className="casting-modal-footer">
                <button type="button" className="btn-secondary-dark" onClick={() => setShowProjectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-teal" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Block */}
      {showBlockModal && (
        <div className="casting-modal-backdrop">
          <div className="casting-modal">
            <div className="casting-modal-header">
              <h3 className="casting-modal-title">Add Block / Building</h3>
              <button className="casting-modal-close" onClick={() => setShowBlockModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateBlock}>
              <div className="casting-modal-body">
                {errorMsg && (
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '8px', fontSize: '0.825rem' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Block Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Tower A, Podium Block, Wing 1"
                    value={blockName}
                    onChange={(e) => setBlockName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Block Code</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. BLK-A"
                    value={blockCode}
                    onChange={(e) => setBlockCode(e.target.value)}
                  />
                </div>
              </div>
              <div className="casting-modal-footer">
                <button type="button" className="btn-secondary-dark" onClick={() => setShowBlockModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-teal" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Level */}
      {showLevelModal && (
        <div className="casting-modal-backdrop">
          <div className="casting-modal">
            <div className="casting-modal-header">
              <h3 className="casting-modal-title">Add Floor / Level</h3>
              <button className="casting-modal-close" onClick={() => setShowLevelModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateLevel}>
              <div className="casting-modal-body">
                {errorMsg && (
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '8px', fontSize: '0.825rem' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Floor / Level Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Ground Floor, Level 1 Slab, Basement 2"
                    value={levelName}
                    onChange={(e) => setLevelName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Floor Index Number</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 1"
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(e.target.value)}
                  />
                </div>
              </div>
              <div className="casting-modal-footer">
                <button type="button" className="btn-secondary-dark" onClick={() => setShowLevelModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-teal" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
