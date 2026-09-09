import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Plus, Trash2, Edit3, Check, X, ArrowRight,
  Building2, Layers, FolderOpen, Settings2, AlertTriangle
} from 'lucide-react';
import { bbsApi, authApi } from '../../utils/api';
import {
  setProjects, setActiveProject, clearActiveProject,
  setBlocks, setLevels, setLoading, setError,
} from '../../store/slices/bbsSlice';
import { setView } from '../../store/slices/routingSlice';
import './BbsProjectsPage.css';

const CONCRETE_GRADES = ['M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'];
const STEEL_GRADES = ['Fe250', 'Fe415', 'Fe500', 'Fe500D', 'Fe550'];

export default function BbsProjectsPage() {
  const dispatch = useDispatch();
  const { projects, activeProject, blocks, levels, loading } = useSelector(s => s.bbs);

  // Local UI states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [addingBlock, setAddingBlock] = useState(false);
  const [addingLevel, setAddingLevel] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [newLevelName, setNewLevelName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [editingLevelId, setEditingLevelId] = useState(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editBlockName, setEditBlockName] = useState('');
  const [editLevelName, setEditLevelName] = useState('');
  const [passwordPrompt, setPasswordPrompt] = useState({ show: false, actionType: null, data: null, error: '' });
  const [actionPassword, setActionPassword] = useState('');

  const [activeBlockId, setActiveBlockId] = useState(null);

  const { user } = useSelector(s => s.auth);

  // Defaults form state
  const [defaults, setDefaults] = useState({
    concreteGrades: { footing: 'M25', column: 'M25', beam: 'M25', slab: 'M25' },
    steelGrade: 'Fe500',
    covers: { footing: 50, column: 40, beam: 25, slab: 20 },
  });

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // When active project changes, load blocks/levels and sync defaults
  useEffect(() => {
    if (activeProject) {
      loadBlocks(activeProject._id);
      loadLevels(activeProject._id);
      setDefaults({
        concreteGrades: activeProject.defaultConcreteGrades || { footing: 'M25', column: 'M25', beam: 'M25', slab: 'M25' },
        steelGrade: activeProject.defaultSteelGrade || 'Fe500',
        covers: activeProject.defaultClearCovers || { footing: 50, column: 40, beam: 25, slab: 20 },
      });
      setActiveBlockId(null);
    }
  }, [activeProject?._id]);

  const loadProjects = async () => {
    try {
      dispatch(setLoading(true));
      const data = await bbsApi.getProjects();
      dispatch(setProjects(data));
    } catch (err) {
      dispatch(setError(err.message));
    }
  };

  const loadBlocks = async (projectId) => {
    try {
      const data = await bbsApi.getBlocks(projectId);
      dispatch(setBlocks(data));
    } catch (err) {
      console.error('Failed to load blocks:', err);
    }
  };

  const loadLevels = async (projectId) => {
    try {
      const data = await bbsApi.getLevels(projectId);
      dispatch(setLevels(data));
    } catch (err) {
      console.error('Failed to load levels:', err);
    }
  };

  // ── Project CRUD ──────────────────────────
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      await bbsApi.createProject({ name: newProjectName.trim() });
      setNewProjectName('');
      setShowCreateForm(false);
      loadProjects();
    } catch (err) {
      alert(`Error creating project: ${err.message}`);
      dispatch(setError(err.message));
    }
  };

  const handleEditProject = (e, projectId) => {
    e.stopPropagation();
    if (!editProjectName.trim()) return;
    setPasswordPrompt({ show: true, actionType: 'editProject', data: projectId, error: '' });
  };

  const handleDeleteProject = (e, projectId) => {
    e.stopPropagation();
    setPasswordPrompt({ show: true, actionType: 'deleteProject', data: projectId, error: '' });
  };

  const handleSelectProject = (project) => {
    dispatch(setActiveProject(project));
  };

  // ── Block CRUD ────────────────────────────
  const handleAddBlock = async () => {
    if (!newBlockName.trim() || !activeProject) return;
    try {
      await bbsApi.createBlock(activeProject._id, newBlockName.trim());
      setNewBlockName('');
      setAddingBlock(false);
      loadBlocks(activeProject._id);
    } catch (err) {
      dispatch(setError(err.message));
    }
  };

  const handleEditBlock = (blockId) => {
    if (!editBlockName.trim()) return;
    setPasswordPrompt({ show: true, actionType: 'editBlock', data: blockId, error: '' });
  };

  const handleDeleteBlock = (blockId) => {
    setPasswordPrompt({ show: true, actionType: 'deleteBlock', data: blockId, error: '' });
  };

  // ── Level CRUD ────────────────────────────
  const handleAddLevel = async () => {
    if (!newLevelName.trim() || !activeProject || !activeBlockId) return;
    try {
      await bbsApi.createLevel(activeProject._id, activeBlockId, newLevelName.trim());
      setNewLevelName('');
      setAddingLevel(false);
      loadLevels(activeProject._id);
    } catch (err) {
      dispatch(setError(err.message));
    }
  };

  const handleEditLevel = (levelId) => {
    if (!editLevelName.trim()) return;
    setPasswordPrompt({ show: true, actionType: 'editLevel', data: levelId, error: '' });
  };

  const handleDeleteLevel = (levelId) => {
    setPasswordPrompt({ show: true, actionType: 'deleteLevel', data: levelId, error: '' });
  };

  const executePendingAction = async () => {
    if (!actionPassword) {
      setPasswordPrompt(prev => ({ ...prev, error: 'Password is required' }));
      return;
    }
    try {
      await authApi.signin(user.email, actionPassword);
      
      if (passwordPrompt.actionType === 'deleteProject') {
        await bbsApi.deleteProject(passwordPrompt.data);
        if (activeProject?._id === passwordPrompt.data) dispatch(clearActiveProject());
        loadProjects();
      } else if (passwordPrompt.actionType === 'editProject') {
        await bbsApi.updateProject(passwordPrompt.data, { name: editProjectName.trim() });
        setEditingProjectId(null);
        loadProjects();
      } else if (passwordPrompt.actionType === 'deleteBlock') {
        await bbsApi.deleteBlock(passwordPrompt.data);
        loadBlocks(activeProject._id);
      } else if (passwordPrompt.actionType === 'editBlock') {
        await bbsApi.updateBlock(passwordPrompt.data, editBlockName.trim());
        setEditingBlockId(null);
        loadBlocks(activeProject._id);
      } else if (passwordPrompt.actionType === 'deleteLevel') {
        await bbsApi.deleteLevel(passwordPrompt.data);
        loadLevels(activeProject._id);
      } else if (passwordPrompt.actionType === 'editLevel') {
        await bbsApi.updateLevel(passwordPrompt.data, editLevelName.trim());
        setEditingLevelId(null);
        loadLevels(activeProject._id);
      }
      
      setPasswordPrompt({ show: false, actionType: null, data: null, error: '' });
      setActionPassword('');
    } catch (err) {
      setPasswordPrompt(prev => ({ ...prev, error: 'Incorrect password or authentication failed' }));
    }
  };

  // ── Save Defaults ─────────────────────────
  const handleSaveDefaults = async () => {
    if (!activeProject) return;
    try {
      const updated = await bbsApi.updateProject(activeProject._id, {
        defaultConcreteGrades: defaults.concreteGrades,
        defaultSteelGrade: defaults.steelGrade,
        defaultClearCovers: defaults.covers,
      });
      dispatch(setActiveProject(updated));
    } catch (err) {
      dispatch(setError(err.message));
    }
  };

  // ── Open Dashboard ────────────────────────
  const handleOpenMatrix = () => {
    dispatch(setView('bbs-dashboard'));
  };

  return (
    <div className="bbs-projects-page">
      {/* Header */}
      <div className="bbs-page-header">
        <h1>BBS — Project Configurator</h1>
        <p>Create a project, define its spatial hierarchy (Blocks & Levels), and set global defaults.</p>
      </div>

      {/* Projects Grid */}
      <div className="bbs-projects-grid">
        {projects.map(p => (
          <div
            key={p._id}
            className={`bbs-project-card ${activeProject?._id === p._id ? 'active' : ''}`}
            onClick={() => handleSelectProject(p)}
          >
            <div className="bbs-project-card-actions">
              <button 
                className="bbs-card-action-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingProjectId(p._id);
                  setEditProjectName(p.name);
                }} 
                title="Edit Project"
              >
                <Edit3 size={14} />
              </button>
              <button className="bbs-card-action-btn" onClick={(e) => handleDeleteProject(e, p._id)} title="Delete Project">
                <Trash2 size={14} />
              </button>
            </div>
            
            {editingProjectId === p._id ? (
              <div className="bbs-project-card-name" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditProject(e, p._id);
                    if (e.key === 'Escape') setEditingProjectId(null);
                  }}
                  autoFocus
                  style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
            ) : (
              <div className="bbs-project-card-name">{p.name}</div>
            )}
            
            <div className="bbs-project-card-meta">
              <span><Building2 size={13} /> {p.defaultConcreteGrade || 'M25'}</span>
              <span><Layers size={13} /> {p.defaultSteelGrade || 'Fe500'}</span>
              <span><FolderOpen size={13} /> {new Date(p.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}

        {/* Create New Card */}
        {!showCreateForm ? (
          <div className="bbs-new-project-card" onClick={() => setShowCreateForm(true)}>
            <Plus size={28} />
            <span>Create New Project</span>
          </div>
        ) : (
          <div className="bbs-create-project-form">
            <div className="bbs-form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                placeholder="e.g. Skyline Towers — Phase 1"
                autoFocus
              />
            </div>
            <button className="bbs-create-btn" onClick={handleCreateProject}>Create</button>
            <button className="bbs-cancel-btn" onClick={() => { setShowCreateForm(false); setNewProjectName(''); }}>Cancel</button>
          </div>
        )}
      </div>

      {/* ── Configurator Panel (visible when project is selected) ── */}
      {activeProject && (
        <div className="bbs-configurator">
          <div className="bbs-configurator-header">
            <h2>
              <Settings2 size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              {activeProject.name} — Configuration
            </h2>
            <button className="bbs-open-matrix-btn" onClick={handleOpenMatrix}>
              Open BBS Matrix <ArrowRight size={16} />
            </button>
          </div>

          {/* Blocks & Levels side-by-side */}
          <div className="bbs-hierarchy-row">
            {/* Blocks / Wings */}
            <div className="bbs-hierarchy-column">
              <div className="bbs-hierarchy-column-header">
                <h3>
                  <Building2 size={16} /> Blocks / Wings
                  <span className="bbs-hierarchy-count">{blocks.length}</span>
                </h3>
                <button className="bbs-add-item-btn" onClick={() => setAddingBlock(true)}>
                  <Plus size={14} /> Add
                </button>
              </div>
              <div className="bbs-hierarchy-list">
                {blocks.length === 0 && !addingBlock && (
                  <div className="bbs-hierarchy-empty">No blocks defined yet. Click "Add" to start.</div>
                )}
                {blocks.map(block => (
                  <div 
                    key={block._id} 
                    className={`bbs-hierarchy-item ${activeBlockId === block._id ? 'active' : ''}`}
                    onClick={() => setActiveBlockId(block._id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {editingBlockId === block._id ? (
                      <div className="bbs-add-item-row" style={{ flex: 1 }}>
                        <input
                          className="bbs-add-item-input"
                          value={editBlockName}
                          onChange={(e) => setEditBlockName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEditBlock(block._id)}
                          autoFocus
                        />
                        <button className="bbs-add-item-confirm" onClick={() => handleEditBlock(block._id)}><Check size={14} /></button>
                        <button className="bbs-add-item-cancel" onClick={() => setEditingBlockId(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <span className="bbs-hierarchy-item-name">{block.name}</span>
                        <div className="bbs-hierarchy-item-actions">
                          <button className="bbs-item-action-btn" onClick={() => { setEditingBlockId(block._id); setEditBlockName(block.name); }} title="Rename"><Edit3 size={13} /></button>
                          <button className="bbs-item-action-btn danger" onClick={() => handleDeleteBlock(block._id)} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {addingBlock && (
                  <div className="bbs-add-item-row">
                    <input
                      className="bbs-add-item-input"
                      value={newBlockName}
                      onChange={(e) => setNewBlockName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddBlock()}
                      placeholder="e.g. Tower A, Wing 1, Block B"
                      autoFocus
                    />
                    <button className="bbs-add-item-confirm" onClick={handleAddBlock}><Check size={14} /></button>
                    <button className="bbs-add-item-cancel" onClick={() => { setAddingBlock(false); setNewBlockName(''); }}><X size={14} /></button>
                  </div>
                )}
              </div>
            </div>

            {/* Levels / Floors */}
            <div className={`bbs-hierarchy-column ${!activeBlockId ? 'disabled' : ''}`}>
              <div className="bbs-hierarchy-column-header">
                <h3>
                  <Layers size={16} /> Levels / Floors
                  {activeBlockId && <span className="bbs-hierarchy-count">{levels.filter(l => l.block_id === activeBlockId).length}</span>}
                </h3>
                <button 
                  className="bbs-add-item-btn" 
                  onClick={() => setAddingLevel(true)}
                  disabled={!activeBlockId}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
              <div className="bbs-hierarchy-list">
                {!activeBlockId ? (
                  <div className="bbs-hierarchy-empty">Select a block to manage its levels.</div>
                ) : levels.filter(l => l.block_id === activeBlockId).length === 0 && !addingLevel ? (
                  <div className="bbs-hierarchy-empty">No levels defined for this block. Click "Add" to start.</div>
                ) : (
                  levels.filter(l => l.block_id === activeBlockId).map(level => (
                  <div key={level._id} className="bbs-hierarchy-item">
                    {editingLevelId === level._id ? (
                      <div className="bbs-add-item-row" style={{ flex: 1 }}>
                        <input
                          className="bbs-add-item-input"
                          value={editLevelName}
                          onChange={(e) => setEditLevelName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEditLevel(level._id)}
                          autoFocus
                        />
                        <button className="bbs-add-item-confirm" onClick={() => handleEditLevel(level._id)}><Check size={14} /></button>
                        <button className="bbs-add-item-cancel" onClick={() => setEditingLevelId(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <span className="bbs-hierarchy-item-name">{level.name}</span>
                        <div className="bbs-hierarchy-item-actions">
                          <button className="bbs-item-action-btn" onClick={() => { setEditingLevelId(level._id); setEditLevelName(level.name); }} title="Rename"><Edit3 size={13} /></button>
                          <button className="bbs-item-action-btn danger" onClick={() => handleDeleteLevel(level._id)} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </>
                    )}
                  </div>
                )))}
                {addingLevel && activeBlockId && (
                  <div className="bbs-add-item-row">
                    <input
                      className="bbs-add-item-input"
                      value={newLevelName}
                      onChange={(e) => setNewLevelName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddLevel()}
                      placeholder="e.g. Basement, Ground Floor, 1st Floor"
                      autoFocus
                    />
                    <button className="bbs-add-item-confirm" onClick={handleAddLevel}><Check size={14} /></button>
                    <button className="bbs-add-item-cancel" onClick={() => { setAddingLevel(false); setNewLevelName(''); }}><X size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Global Defaults Section */}
          <div className="bbs-defaults-section">
            <h3>
              <Settings2 size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
              Global Project Defaults
            </h3>
            <div className="bbs-defaults-grid">
              <div className="bbs-form-group">
                <label>Steel Grade (Global)</label>
                <select value={defaults.steelGrade} onChange={(e) => setDefaults(d => ({ ...d, steelGrade: e.target.value }))}>
                  {STEEL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="bbs-defaults-covers">
              <h4>Concrete Grades</h4>
              {[
                { key: 'footing', label: 'Footing' },
                { key: 'column', label: 'Column' },
                { key: 'beam', label: 'Beam' },
                { key: 'slab', label: 'Slab' },
              ].map(item => (
                <div className="bbs-cover-item" key={item.key}>
                  <label>{item.label}</label>
                  <select 
                    value={defaults.concreteGrades?.[item.key] || 'M25'}
                    onChange={(e) => setDefaults(d => ({ ...d, concreteGrades: { ...d.concreteGrades, [item.key]: e.target.value } }))}
                  >
                    {CONCRETE_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="bbs-defaults-covers">
              <h4>Clear Covers</h4>
              {[
                { key: 'footing', label: 'Footing (mm)' },
                { key: 'column', label: 'Column (mm)' },
                { key: 'beam', label: 'Beam (mm)' },
                { key: 'slab', label: 'Slab (mm)' },
              ].map(item => (
                <div className="bbs-cover-item" key={item.key}>
                  <label>{item.label}</label>
                  <input
                    type="number"
                    value={defaults.covers[item.key]}
                    onChange={(e) => setDefaults(d => ({
                      ...d,
                      covers: { ...d.covers, [item.key]: parseInt(e.target.value) || 0 },
                    }))}
                  />
                </div>
              ))}
            </div>

            <button className="bbs-save-defaults-btn" onClick={handleSaveDefaults}>
              Save Defaults
            </button>
          </div>
        </div>
      )}

      {/* Password Prompt Modal */}
      {passwordPrompt.show && (
        <div className="bbs-modal-overlay">
          <div className="bbs-modal">
            <div className="bbs-modal-header">
              <h3 className="danger-text"><AlertTriangle size={18} /> Authentication Required</h3>
              <button className="bbs-modal-close" onClick={() => { setPasswordPrompt({ show: false, actionType: null, data: null, error: '' }); setActionPassword(''); }}>×</button>
            </div>
            <div className="bbs-modal-body">
              <p>Please enter your password to authorize this action.</p>
              {passwordPrompt.error && (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertTriangle size={14} /> {passwordPrompt.error}
                </div>
              )}
              <div className="bbs-form-group" style={{ marginBottom: 0 }}>
                <label>Your Password</label>
                <input 
                  type="password" 
                  value={actionPassword} 
                  onChange={(e) => setActionPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && executePendingAction()}
                  placeholder="Enter password"
                  autoFocus
                />
              </div>
            </div>
            <div className="bbs-modal-footer">
              <button className="bbs-modal-btn cancel" onClick={() => { setPasswordPrompt({ show: false, actionType: null, data: null, error: '' }); setActionPassword(''); }}>Cancel</button>
              <button className="bbs-modal-btn danger" onClick={executePendingAction}>Confirm Action</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
