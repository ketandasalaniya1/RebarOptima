import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, ArrowLeft, ChevronRight, Layers, LayoutGrid, 
  CheckCircle2, Clock, Trash2, Edit3, MoveUp, MoveDown, Search, 
  FolderPlus, PlusCircle, AlertCircle, Info, Hash, MapPin, 
  ShieldCheck, RefreshCw, MoreVertical, X, Shapes, PenTool
} from 'lucide-react';
import { bbsApi } from './bbsApi';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ShapeLibrary from './ShapeLibrary';
import CADEditor from './cad/CADEditor';
import './BBSPage.css';

const MEMBER_TYPE_OPTIONS = [
  'Footing',
  'Tie Beam',
  'Pedestal',
  'Retaining Wall',
  'Grade Slab',
  'Column',
  'Staircase',
  'Lift Wall',
  'Beam',
  'Slab',
  'Chajja',
  'Overhead Water Tank',
  'Special Requirement'
];

const DEFAULT_PREFIX_MAP = {
  'Column': 'C',
  'Beam': 'B',
  'Footing': 'F',
  'Tie Beam': 'TB',
  'Pedestal': 'P',
  'Retaining Wall': 'RW',
  'Grade Slab': 'GS',
  'Slab': 'S',
  'Staircase': 'ST',
  'Lift Wall': 'LW',
  'Chajja': 'CH',
  'Overhead Water Tank': 'OHT',
  'Special Requirement': 'SR'
};

export default function BBSPage() {
  // Main Module Tab State ('projects' | 'shapes' | 'cad')
  const [activeMainTab, setActiveMainTab] = useState('projects');
  const [customShapes, setCustomShapes] = useState([]);
  const [editingShape, setEditingShape] = useState(null);

  // Navigation & Drilldown State
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedLevelId, setSelectedLevelId] = useState(null);

  // Data State
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [levels, setLevels] = useState([]);
  const [members, setMembers] = useState([]);


  // UI State
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [memberTypeFilter, setMemberTypeFilter] = useState('ALL');
  const [toast, setToast] = useState(null);

  // Modal States
  const [modalType, setModalType] = useState(null); // 'project' | 'block' | 'level' | 'member' | 'confirmDelete'
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type, id, name }

  // Form States
  const [projectForm, setProjectForm] = useState({ name: '', location: '', description: '', status: 'Active' });
  const [blockForm, setBlockForm] = useState({ name: '', code: '', description: '' });
  const [levelForm, setLevelForm] = useState({ name: '', code: '', description: '' });
  const [memberModalTab, setMemberModalTab] = useState('single'); // 'single' | 'series'
  const [memberForm, setMemberForm] = useState({ memberType: 'Column', displayId: '', description: '', completionPercentage: 0 });
  const [seriesForm, setSeriesForm] = useState({
    memberType: 'Column',
    prefix: DEFAULT_PREFIX_MAP['Column'] || 'C',
    startNum: '',
    endNum: '',
    description: '',
    completionPercentage: 0
  });

  // Show temporary toast message
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Projects and Custom Shapes on mount
  useEffect(() => {
    if (!selectedProjectId) {
      loadProjects();
    }
    loadShapes();
  }, [selectedProjectId]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await bbsApi.getProjects();
      setProjects(data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load BBS projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadShapes = async () => {
    try {
      const data = await bbsApi.getShapes();
      setCustomShapes(data || []);
    } catch (err) {
      // Fallback gracefully
      console.warn('Could not load custom shapes:', err.message);
    }
  };

  const handleSaveShape = async (shapeData) => {
    try {
      if (shapeData._id || (editingShape && (editingShape._id || editingShape.id))) {
        const id = shapeData._id || editingShape._id || editingShape.id;
        await bbsApi.updateShape(id, shapeData);
        showToast(`Shape "${shapeData.name}" updated successfully!`);
      } else {
        await bbsApi.createShape(shapeData);
        showToast(`Shape "${shapeData.name}" saved to library!`);
      }
      await loadShapes();
      setEditingShape(null);
      setActiveMainTab('shapes');
    } catch (err) {
      showToast(err.message || 'Error saving shape', 'error');
    }
  };

  const handleDuplicateShape = async (shape) => {
    try {
      const id = shape._id || shape.id;
      if (shape.isStandard || shape.ownership === 'STANDARD') {
        // Standard template duplication -> create new custom shape
        const duplicatePayload = {
          name: `${shape.name} (Custom)`,
          code: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
          shapeCode: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
          description: `Customized from standard ${shape.name}`,
          category: shape.category || 'Custom',
          ownership: 'CUSTOM',
          status: 'DRAFT',
          version: '1.0',
          unit: shape.unit || 'mm',
          geometry: shape.geometry || { objects: [] },
          parameters: shape.parameters || [],
          dimensions: shape.dimensions || [],
          constraints: shape.constraints || [],
          calculationRules: shape.calculationRules || { ruleSet: 'RULE_SET_CENTERLINE_EXACT' },
          tags: [...(shape.tags || []), 'custom']
        };
        await bbsApi.createShape(duplicatePayload);
        showToast(`Duplicated "${shape.name}" as new custom shape`);
      } else {
        await bbsApi.duplicateShape(id);
        showToast(`Duplicated "${shape.name}" successfully`);
      }
      await loadShapes();
    } catch (err) {
      showToast(err.message || 'Error duplicating shape', 'error');
    }
  };

  const handleNewVersionShape = async (shape, versionData) => {
    try {
      const id = shape._id || shape.id;
      await bbsApi.createShapeVersion(id, versionData);
      showToast(`Version ${versionData.newVersion} created for "${shape.name}"`);
      await loadShapes();
    } catch (err) {
      showToast(err.message || 'Error creating shape version', 'error');
    }
  };

  const handleStatusChangeShape = async (shape, newStatus) => {
    try {
      const id = shape._id || shape.id;
      await bbsApi.updateShapeStatus(id, newStatus);
      showToast(`Shape "${shape.name}" status updated to ${newStatus}`);
      await loadShapes();
    } catch (err) {
      showToast(err.message || 'Error updating status', 'error');
    }
  };

  const handleArchiveShape = async (shape) => {
    try {
      const id = shape._id || shape.id;
      await bbsApi.archiveShape(id);
      showToast(`Shape "${shape.name}" archived`);
      await loadShapes();
    } catch (err) {
      showToast(err.message || 'Error archiving shape', 'error');
    }
  };

  const handleRestoreShape = async (shape) => {
    try {
      const id = shape._id || shape.id;
      await bbsApi.restoreShape(id);
      showToast(`Shape "${shape.name}" restored to active library`);
      await loadShapes();
    } catch (err) {
      showToast(err.message || 'Error restoring shape', 'error');
    }
  };

  const handleDeleteShape = (shapeOrId) => {
    let targetId = shapeOrId;
    let shapeName = '';
    if (typeof shapeOrId === 'object' && shapeOrId !== null) {
      targetId = shapeOrId._id || shapeOrId.id;
      shapeName = shapeOrId.name || '';
    }
    if (typeof targetId === 'object' && targetId !== null && targetId.toString) {
      targetId = targetId.toString();
    }

    if (!targetId || targetId === 'undefined' || targetId === 'null') {
      showToast('Invalid shape identifier', 'error');
      return;
    }

    confirmDelete('shape', targetId, shapeName || 'this shape');
  };


  // Load Project Details, Blocks when a project is selected
  useEffect(() => {
    if (selectedProjectId) {
      loadProjectWorkspace(selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadProjectWorkspace = async (projId) => {
    setSubLoading(true);
    try {
      const [proj, blks] = await Promise.all([
        bbsApi.getProjectById(projId),
        bbsApi.getBlocks(projId)
      ]);
      setActiveProject(proj);
      setBlocks(blks || []);

      if (blks && blks.length > 0) {
        // Auto-select first block or keep current if valid
        const targetBlock = blks.find(b => (b._id || b.id) === selectedBlockId) || blks[0];
        const blockId = targetBlock._id || targetBlock.id;
        setSelectedBlockId(blockId);
        await loadLevels(blockId);
      } else {
        setSelectedBlockId(null);
        setLevels([]);
        setSelectedLevelId(null);
        setMembers([]);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load project workspace', 'error');
    } finally {
      setSubLoading(false);
    }
  };

  // Load Levels when block changes
  const loadLevels = async (blockId) => {
    try {
      const lvls = await bbsApi.getLevels(blockId);
      setLevels(lvls || []);
      if (lvls && lvls.length > 0) {
        const targetLevel = lvls.find(l => (l._id || l.id) === selectedLevelId) || lvls[0];
        const levelId = targetLevel._id || targetLevel.id;
        setSelectedLevelId(levelId);
        await loadMembers(levelId);
      } else {
        setSelectedLevelId(null);
        setMembers([]);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load levels', 'error');
    }
  };

  // Load Members when level changes
  const loadMembers = async (levelId) => {
    try {
      const mbrs = await bbsApi.getMembers(levelId);
      setMembers(mbrs || []);
    } catch (err) {
      showToast(err.message || 'Failed to load structural members', 'error');
    }
  };

  const handleSelectBlock = async (blockId) => {
    setSelectedBlockId(blockId);
    await loadLevels(blockId);
  };

  const handleSelectLevel = async (levelId) => {
    setSelectedLevelId(levelId);
    await loadMembers(levelId);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CRUD HANDLERS — PROJECT
  // ════════════════════════════════════════════════════════════════════════════
  const openProjectModal = (mode = 'create', project = null) => {
    setModalMode(mode);
    setEditingItem(project);
    if (mode === 'edit' && project) {
      setProjectForm({
        name: project.name || '',
        location: project.location || '',
        description: project.description || '',
        status: project.status || 'Active'
      });
    } else {
      setProjectForm({ name: '', location: '', description: '', status: 'Active' });
    }
    setModalType('project');
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!projectForm.name.trim()) return;
    try {
      if (modalMode === 'create') {
        const created = await bbsApi.createProject(projectForm);
        showToast(`Project "${created.name}" created successfully!`);
        setModalType(null);
        // Navigate directly to project workspace
        setSelectedProjectId(created._id || created.id);
      } else {
        const updated = await bbsApi.updateProject(editingItem._id || editingItem.id, projectForm);
        showToast(`Project updated successfully!`);
        setModalType(null);
        if (selectedProjectId) {
          setActiveProject(prev => ({ ...prev, ...updated }));
        } else {
          loadProjects();
        }
      }
    } catch (err) {
      showToast(err.message || 'Error saving project', 'error');
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CRUD HANDLERS — BLOCK
  // ════════════════════════════════════════════════════════════════════════════
  const openBlockModal = (mode = 'create', block = null) => {
    setModalMode(mode);
    setEditingItem(block);
    if (mode === 'edit' && block) {
      setBlockForm({
        name: block.name || '',
        code: block.code || '',
        description: block.description || ''
      });
    } else {
      setBlockForm({ name: '', code: '', description: '' });
    }
    setModalType('block');
  };

  const handleSaveBlock = async (e) => {
    e.preventDefault();
    if (!blockForm.name.trim()) return;
    try {
      if (modalMode === 'create') {
        const created = await bbsApi.createBlock(selectedProjectId, blockForm);
        showToast(`Block "${created.name}" created!`);
        setModalType(null);
        const updatedBlocks = [...blocks, created];
        setBlocks(updatedBlocks);
        setSelectedBlockId(created._id || created.id);
        await loadLevels(created._id || created.id);
      } else {
        const updated = await bbsApi.updateBlock(editingItem._id || editingItem.id, blockForm);
        showToast(`Block updated!`);
        setModalType(null);
        setBlocks(blocks.map(b => (b._id || b.id) === (editingItem._id || editingItem.id) ? { ...b, ...updated } : b));
      }
    } catch (err) {
      showToast(err.message || 'Error saving block', 'error');
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CRUD HANDLERS — LEVEL
  // ════════════════════════════════════════════════════════════════════════════
  const openLevelModal = (mode = 'create', level = null) => {
    setModalMode(mode);
    setEditingItem(level);
    if (mode === 'edit' && level) {
      setLevelForm({
        name: level.name || '',
        code: level.code || '',
        description: level.description || ''
      });
    } else {
      setLevelForm({ name: '', code: '', description: '' });
    }
    setModalType('level');
  };

  const handleSaveLevel = async (e) => {
    e.preventDefault();
    if (!levelForm.name.trim()) return;
    try {
      if (modalMode === 'create') {
        const created = await bbsApi.createLevel(selectedBlockId, {
          ...levelForm,
          projectId: selectedProjectId
        });
        showToast(`Level "${created.name}" added!`);
        setModalType(null);
        const updatedLevels = [...levels, created];
        setLevels(updatedLevels);
        setSelectedLevelId(created._id || created.id);
        await loadMembers(created._id || created.id);
      } else {
        const updated = await bbsApi.updateLevel(editingItem._id || editingItem.id, levelForm);
        showToast(`Level updated!`);
        setModalType(null);
        setLevels(levels.map(l => (l._id || l.id) === (editingItem._id || editingItem.id) ? { ...l, ...updated } : l));
      }
    } catch (err) {
      showToast(err.message || 'Error saving level', 'error');
    }
  };

  const handleReorderLevel = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= levels.length) return;

    const reordered = [...levels];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    setLevels(reordered);
    const levelIds = reordered.map(l => l._id || l.id);
    try {
      await bbsApi.reorderLevels(selectedBlockId, levelIds);
    } catch (err) {
      showToast('Failed to save level order', 'error');
      await loadLevels(selectedBlockId);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CRUD HANDLERS — STRUCTURAL MEMBER
  // ════════════════════════════════════════════════════════════════════════════
  const openMemberModal = (mode = 'create', member = null) => {
    setModalMode(mode);
    setEditingItem(member);
    if (mode === 'edit' && member) {
      setMemberModalTab('single');
      setMemberForm({
        memberType: member.memberType || 'Column',
        displayId: member.displayId || '',
        description: member.description || '',
        completionPercentage: member.completionPercentage || 0
      });
    } else {
      setMemberModalTab('single');
      setMemberForm({
        memberType: 'Column',
        displayId: '',
        description: '',
        completionPercentage: 0
      });
      setSeriesForm({
        memberType: 'Column',
        prefix: DEFAULT_PREFIX_MAP['Column'] || 'C',
        startNum: '',
        endNum: '',
        description: '',
        completionPercentage: 0
      });
    }
    setModalType('member');
  };

  const handleSeriesMemberTypeChange = (newType) => {
    const suggestedPrefix = DEFAULT_PREFIX_MAP[newType] || newType.slice(0, 2).toUpperCase();
    setSeriesForm(prev => ({
      ...prev,
      memberType: newType,
      prefix: suggestedPrefix
    }));
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (!memberForm.displayId.trim()) return;
    try {
      if (modalMode === 'create') {
        const created = await bbsApi.createMember(selectedLevelId, {
          ...memberForm,
          projectId: selectedProjectId,
          blockId: selectedBlockId
        });
        showToast(`Member "${created.displayId}" registered!`);
        setModalType(null);
        setMembers([...members, created]);
        // Update level count in state
        setLevels(levels.map(l => (l._id || l.id) === selectedLevelId ? { ...l, memberCount: (l.memberCount || 0) + 1 } : l));
      } else {
        const updated = await bbsApi.updateMember(editingItem._id || editingItem.id, memberForm);
        showToast(`Member updated!`);
        setModalType(null);
        setMembers(members.map(m => (m._id || m.id) === (editingItem._id || editingItem.id) ? { ...m, ...updated } : m));
      }
    } catch (err) {
      showToast(err.message || 'Error saving member', 'error');
    }
  };

  const handleSaveSeriesMembers = async (e) => {
    e.preventDefault();
    const start = Math.max(1, parseInt(seriesForm.startNum, 10) || 1);
    const end = Math.max(start, parseInt(seriesForm.endNum, 10) || start);
    const prefix = (seriesForm.prefix || '').trim();

    if (end - start + 1 > 200) {
      showToast('Maximum 200 members can be generated at once.', 'error');
      return;
    }

    const marks = [];
    for (let i = start; i <= end; i++) {
      marks.push(`${prefix}${i}`);
    }

    if (marks.length === 0) {
      showToast('Please specify a valid start and end range.', 'error');
      return;
    }

    try {
      const allUpdated = await bbsApi.createMembersBatch(selectedLevelId, {
        projectId: selectedProjectId,
        blockId: selectedBlockId,
        memberType: seriesForm.memberType,
        displayIds: marks,
        description: seriesForm.description,
        completionPercentage: seriesForm.completionPercentage
      });

      showToast(`🎉 Generated ${marks.length} ${seriesForm.memberType} members (${marks[0]} to ${marks[marks.length - 1]})!`);
      setModalType(null);
      setMembers(allUpdated || []);
      // Update level count in state
      setLevels(levels.map(l => (l._id || l.id) === selectedLevelId ? { ...l, memberCount: (allUpdated || []).length } : l));
    } catch (err) {
      showToast(err.message || 'Error generating members series', 'error');
    }
  };

  const handleToggleMemberCompletion = async (member) => {
    const memberId = member._id || member.id;
    const nextPercentage = member.completionPercentage === 100 ? 0 : 100;
    try {
      const updated = await bbsApi.updateMember(memberId, { completionPercentage: nextPercentage });
      setMembers(members.map(m => (m._id || m.id) === memberId ? { ...m, completionPercentage: nextPercentage } : m));
      showToast(`Status updated to ${nextPercentage}% completed`);
    } catch (err) {
      showToast(err.message || 'Error updating status', 'error');
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE CONFIRMATION HANDLER
  // ════════════════════════════════════════════════════════════════════════════
  const confirmDelete = (type, id, name) => {
    setDeleteTarget({ type, id, name });
    setModalType('confirmDelete');
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const { type, id, name } = deleteTarget;
    try {
      if (type === 'project') {
        await bbsApi.deleteProject(id);
        showToast(`Project "${name}" deleted`);
        setModalType(null);
        setSelectedProjectId(null);
        loadProjects();
      } else if (type === 'block') {
        await bbsApi.deleteBlock(id);
        showToast(`Block "${name}" deleted`);
        setModalType(null);
        const remaining = blocks.filter(b => (b._id || b.id) !== id);
        setBlocks(remaining);
        if (remaining.length > 0) {
          const first = remaining[0];
          setSelectedBlockId(first._id || first.id);
          await loadLevels(first._id || first.id);
        } else {
          setSelectedBlockId(null);
          setLevels([]);
          setSelectedLevelId(null);
          setMembers([]);
        }
      } else if (type === 'level') {
        await bbsApi.deleteLevel(id);
        showToast(`Level "${name}" deleted`);
        setModalType(null);
        const remaining = levels.filter(l => (l._id || l.id) !== id);
        setLevels(remaining);
        if (remaining.length > 0) {
          const first = remaining[0];
          setSelectedLevelId(first._id || first.id);
          await loadMembers(first._id || first.id);
        } else {
          setSelectedLevelId(null);
          setMembers([]);
        }
      } else if (type === 'member') {
        await bbsApi.deleteMember(id);
        showToast(`Member "${name}" deleted`);
        setModalType(null);
        setMembers(members.filter(m => (m._id || m.id) !== id));
        setLevels(levels.map(l => (l._id || l.id) === selectedLevelId ? { ...l, memberCount: Math.max(0, (l.memberCount || 1) - 1) } : l));
      } else if (type === 'shape') {
        setCustomShapes(prev => prev.filter(s => {
          const sid = (s._id || s.id || '').toString();
          return sid !== String(id);
        }));
        await bbsApi.deleteShape(String(id));
        showToast(`Shape "${name}" deleted from library`);
        setModalType(null);
        await loadShapes();
      }
    } catch (err) {
      showToast(err.message || 'Error executing delete', 'error');
    }
  };

  // Helper getters
  const currentBlock = blocks.find(b => (b._id || b.id) === selectedBlockId);
  const currentLevel = levels.find(l => (l._id || l.id) === selectedLevelId);

  // Filtered and naturally sorted members (C1, C2, C3, ..., C15)
  const filteredMembers = [...members]
    .filter(m => {
      if (memberTypeFilter === 'ALL') return true;
      return m.memberType === memberTypeFilter;
    })
    .sort((a, b) => (a.displayId || '').localeCompare(b.displayId || '', undefined, { numeric: true, sensitivity: 'base' }));

  // Filtered projects
  const filteredProjects = projects.filter(p => {
    const q = searchQuery.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q);
  });

  // Computed summary metrics
  const totalCompletedMembers = members.filter(m => m.completionPercentage === 100).length;
  const currentLevelProgress = members.length > 0 ? Math.round((totalCompletedMembers / members.length) * 100) : 0;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: CAD WORKSPACE VIEW (PHASE 2A)
  // ════════════════════════════════════════════════════════════════════════════
  if (activeMainTab === 'cad') {
    return (
      <div style={{ width: '100%', height: 'calc(100vh - 40px)', position: 'relative' }}>
        {toast && <div className={`bbs-toast bbs-toast-${toast.type}`}>{toast.message}</div>}
        <CADEditor
          shape={editingShape}
          onSave={handleSaveShape}
          onBack={() => {
            setEditingShape(null);
            setActiveMainTab('shapes');
          }}
        />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: SHAPE LIBRARY VIEW (PHASE 2A)
  // ════════════════════════════════════════════════════════════════════════════
  if (activeMainTab === 'shapes') {
    return (
      <div className="bbs-container">
        {toast && <div className={`bbs-toast bbs-toast-${toast.type}`}>{toast.message}</div>}

        {/* Main BBS Tabs */}
        <div className="bbs-nav-tabs">
          <button
            className={`bbs-nav-tab ${activeMainTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('projects')}
          >
            <Building2 size={16} />
            <span>Projects & Members</span>
          </button>
          <button
            className={`bbs-nav-tab ${activeMainTab === 'shapes' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('shapes')}
          >
            <Shapes size={16} />
            <span>Shape Library & CAD</span>
          </button>
        </div>

        <ShapeLibrary
          customShapes={customShapes}
          onCreateNewShape={(newShapeDef) => {
            setEditingShape(newShapeDef || null);
            setActiveMainTab('cad');
          }}
          onOpenInCAD={(shape) => {
            setEditingShape(shape);
            setActiveMainTab('cad');
          }}
          onDuplicateShape={handleDuplicateShape}
          onNewVersionShape={handleNewVersionShape}
          onStatusChangeShape={handleStatusChangeShape}
          onArchiveShape={handleArchiveShape}
          onRestoreShape={handleRestoreShape}
          onDeleteShape={handleDeleteShape}
        />

        {/* MODAL: Delete Confirmation */}
        {modalType === 'confirmDelete' && (
          <div className="bbs-modal-backdrop" onClick={() => setModalType(null)}>
            <div className="bbs-modal bbs-modal-sm" onClick={e => e.stopPropagation()}>
              <div className="bbs-modal-header bbs-modal-header-danger">
                <h3>Confirm Deletion</h3>
                <button className="bbs-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
              </div>
              <div className="bbs-modal-body">
                <div className="bbs-delete-warning">
                  <AlertCircle size={28} className="bbs-danger-icon" />
                  <div>
                    <p>Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>?</p>
                    <p className="bbs-danger-subtext">
                      {deleteTarget?.type === 'shape' && 'This custom shape will be permanently removed from your library.'}
                      {deleteTarget?.type === 'project' && 'This will remove all blocks, levels, and structural members contained in this project.'}
                      {deleteTarget?.type === 'block' && 'This will remove all levels and structural members contained in this block.'}
                      {deleteTarget?.type === 'level' && 'This will remove all structural members registered under this level.'}
                      {deleteTarget?.type === 'member' && 'This structural member record will be removed.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bbs-modal-footer">
                <button type="button" className="bbs-btn bbs-btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="button" className="bbs-btn bbs-btn-danger" onClick={executeDelete}>Delete Permanently</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: PROJECTS DASHBOARD VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (!selectedProjectId) {
    return (
      <div className="bbs-container">
        {/* Toast alert */}
        {toast && <div className={`bbs-toast bbs-toast-${toast.type}`}>{toast.message}</div>}

        {/* Main BBS Tabs */}
        <div className="bbs-nav-tabs">
          <button
            className={`bbs-nav-tab ${activeMainTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('projects')}
          >
            <Building2 size={16} />
            <span>Projects & Members</span>
          </button>
          <button
            className={`bbs-nav-tab ${activeMainTab === 'shapes' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('shapes')}
          >
            <Shapes size={16} />
            <span>Shape Library & CAD</span>
          </button>
        </div>

        {/* Header */}
        <div className="bbs-header-row">
          <div>
            <div className="bbs-title-with-badge">
              <Building2 className="bbs-main-icon" size={28} />
              <h1 className="bbs-main-title">Bar Bending Schedule (BBS)</h1>
              <span className="bbs-badge bbs-badge-accent">Phase 1 & 2A Foundation</span>
            </div>
            <p className="bbs-subtitle">
              Manage multi-tier construction hierarchy (Project → Block → Level → Structural Members) with automated BBS completion tracking and Parametric Shape CAD.
            </p>
          </div>
          <button className="bbs-btn bbs-btn-primary" onClick={() => openProjectModal('create')}>
            <Plus size={18} />
            <span>New Project</span>
          </button>
        </div>


        {/* Toolbar */}
        <div className="bbs-toolbar-card">
          <div className="bbs-search-box">
            <Search size={18} className="bbs-search-icon" />
            <input 
              type="text" 
              placeholder="Search BBS projects by name or location..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bbs-search-input"
            />
            {searchQuery && (
              <button className="bbs-clear-btn" onClick={() => setSearchQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>
          <div className="bbs-toolbar-stats">
            <span className="bbs-toolbar-pill">
              <strong>{projects.length}</strong> Total Projects
            </span>
          </div>
        </div>

        {/* Project Cards Grid */}
        {loading ? (
          <div className="bbs-loading-state">
            <LoadingSpinner />
            <p>Loading BBS Projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bbs-empty-state">
            <Building2 size={48} className="bbs-empty-icon" />
            <h3>No BBS Projects Found</h3>
            <p>{searchQuery ? 'No projects match your search query.' : 'Get started by creating your first structural BBS project profile.'}</p>
            <button className="bbs-btn bbs-btn-primary" onClick={() => openProjectModal('create')}>
              <Plus size={18} />
              <span>Create First Project</span>
            </button>
          </div>
        ) : (
          <div className="bbs-projects-grid">
            {filteredProjects.map((project) => {
              const projId = project._id || project.id;
              const progress = project.completionPercentage || 0;
              return (
                <div key={projId} className="bbs-project-card">
                  <div className="bbs-card-header">
                    <div>
                      <div className="bbs-card-title-row">
                        <h2 className="bbs-card-title">{project.name}</h2>
                        <span className={`bbs-status-pill bbs-status-${(project.status || 'Active').toLowerCase()}`}>
                          {project.status || 'Active'}
                        </span>
                      </div>
                      {project.location ? (
                        <div className="bbs-card-location">
                          <MapPin size={14} />
                          <span>{project.location}</span>
                        </div>
                      ) : (
                        <div className="bbs-card-location bbs-card-location-muted">
                          <span>Location not specified</span>
                        </div>
                      )}
                    </div>
                    <div className="bbs-card-actions">
                      <button 
                        className="bbs-icon-btn" 
                        title="Edit Project"
                        onClick={(e) => { e.stopPropagation(); openProjectModal('edit', project); }}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        className="bbs-icon-btn bbs-icon-btn-danger" 
                        title="Delete Project"
                        onClick={(e) => { e.stopPropagation(); confirmDelete('project', projId, project.name); }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {project.description && (
                    <p className="bbs-card-description">{project.description}</p>
                  )}

                  {/* Progress Section */}
                  <div className="bbs-card-progress-section">
                    <div className="bbs-progress-header">
                      <span className="bbs-progress-label">BBS Progress</span>
                      <span className="bbs-progress-value">{progress}%</span>
                    </div>
                    <div className="bbs-progress-bar-bg">
                      <div 
                        className="bbs-progress-bar-fill" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="bbs-card-metrics-grid">
                    <div className="bbs-metric-box">
                      <span className="bbs-metric-val">{project.blockCount || 0}</span>
                      <span className="bbs-metric-lbl">Blocks</span>
                    </div>
                    <div className="bbs-metric-box">
                      <span className="bbs-metric-val">{project.levelCount || 0}</span>
                      <span className="bbs-metric-lbl">Levels</span>
                    </div>
                    <div className="bbs-metric-box">
                      <span className="bbs-metric-val">{project.memberCount || 0}</span>
                      <span className="bbs-metric-lbl">Members</span>
                    </div>
                  </div>

                  {/* Open Project CTA */}
                  <div className="bbs-card-footer">
                    <button 
                      className="bbs-btn bbs-btn-secondary bbs-btn-block"
                      onClick={() => setSelectedProjectId(projId)}
                    >
                      <span>Open Workspace</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL: Project Create / Edit */}
        {modalType === 'project' && (
          <div className="bbs-modal-backdrop" onClick={() => setModalType(null)}>
            <div className="bbs-modal" onClick={e => e.stopPropagation()}>
              <div className="bbs-modal-header">
                <h3>{modalMode === 'create' ? 'Create New BBS Project' : 'Edit Project Details'}</h3>
                <button className="bbs-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
              </div>
              <form onSubmit={handleSaveProject}>
                <div className="bbs-modal-body">
                  <div className="bbs-form-group">
                    <label>Project Name <span className="bbs-required">*</span></label>
                    <input 
                      type="text" 
                      placeholder="e.g. ABC Residency, Skyline Towers" 
                      value={projectForm.name} 
                      onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="bbs-form-group">
                    <label>Location / Site Address</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Sector 44, Bengaluru" 
                      value={projectForm.location} 
                      onChange={e => setProjectForm({ ...projectForm, location: e.target.value })}
                    />
                  </div>
                  <div className="bbs-form-group">
                    <label>Project Status</label>
                    <select 
                      value={projectForm.status} 
                      onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Planning">Planning</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  </div>
                  <div className="bbs-form-group">
                    <label>Remarks / Description</label>
                    <textarea 
                      placeholder="Optional details, site notes, or structural overview..." 
                      rows={3}
                      value={projectForm.description} 
                      onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="bbs-modal-footer">
                  <button type="button" className="bbs-btn bbs-btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="submit" className="bbs-btn bbs-btn-primary">
                    {modalMode === 'create' ? 'Create & Open Workspace' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Delete Confirmation */}
        {modalType === 'confirmDelete' && (
          <div className="bbs-modal-backdrop" onClick={() => setModalType(null)}>
            <div className="bbs-modal bbs-modal-sm" onClick={e => e.stopPropagation()}>
              <div className="bbs-modal-header bbs-modal-header-danger">
                <h3>Confirm Deletion</h3>
                <button className="bbs-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
              </div>
              <div className="bbs-modal-body">
                <div className="bbs-delete-warning">
                  <AlertCircle size={28} className="bbs-danger-icon" />
                  <div>
                    <p>Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>?</p>
                    <p className="bbs-danger-subtext">
                      {deleteTarget?.type === 'shape' && 'This custom shape will be permanently removed from your library.'}
                      {deleteTarget?.type === 'project' && 'This will remove all blocks, levels, and structural members contained in this project.'}
                      {deleteTarget?.type === 'block' && 'This will remove all levels and structural members contained in this block.'}
                      {deleteTarget?.type === 'level' && 'This will remove all structural members registered under this level.'}
                      {deleteTarget?.type === 'member' && 'This structural member record will be removed.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bbs-modal-footer">
                <button type="button" className="bbs-btn bbs-btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="button" className="bbs-btn bbs-btn-danger" onClick={executeDelete}>Delete Permanently</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: PROJECT PROFILE & HIERARCHY WORKSPACE
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="bbs-container">
      {/* Toast alert */}
      {toast && <div className={`bbs-toast bbs-toast-${toast.type}`}>{toast.message}</div>}

      {/* Breadcrumbs Navigation */}
      <div className="bbs-breadcrumbs">
        <button className="bbs-breadcrumb-link" onClick={() => setSelectedProjectId(null)}>
          <Building2 size={16} />
          <span>BBS Projects</span>
        </button>
        <ChevronRight size={14} className="bbs-breadcrumb-separator" />
        <span className="bbs-breadcrumb-current">{activeProject?.name || 'Project'}</span>
        {currentBlock && (
          <>
            <ChevronRight size={14} className="bbs-breadcrumb-separator" />
            <span className="bbs-breadcrumb-segment">{currentBlock.name}</span>
          </>
        )}
        {currentLevel && (
          <>
            <ChevronRight size={14} className="bbs-breadcrumb-separator" />
            <span className="bbs-breadcrumb-segment bbs-breadcrumb-level">{currentLevel.name}</span>
          </>
        )}
      </div>

      {/* Project Overview Banner */}
      <div className="bbs-project-banner">
        <div className="bbs-banner-left">
          <button className="bbs-back-btn" onClick={() => setSelectedProjectId(null)} title="Back to Projects">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="bbs-banner-title-row">
              <h1 className="bbs-banner-title">{activeProject?.name}</h1>
              <span className={`bbs-status-pill bbs-status-${(activeProject?.status || 'Active').toLowerCase()}`}>
                {activeProject?.status || 'Active'}
              </span>
            </div>
            {activeProject?.location && (
              <div className="bbs-banner-meta">
                <MapPin size={14} />
                <span>{activeProject.location}</span>
                {activeProject?.description && (
                  <>
                    <span className="bbs-banner-dot">•</span>
                    <span>{activeProject.description}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bbs-banner-right">
          <div className="bbs-banner-stat-box">
            <span className="bbs-banner-stat-num">{blocks.length}</span>
            <span className="bbs-banner-stat-lbl">Blocks</span>
          </div>
          <div className="bbs-banner-stat-box">
            <span className="bbs-banner-stat-num">{levels.length}</span>
            <span className="bbs-banner-stat-lbl">Levels (Active Block)</span>
          </div>
          <div className="bbs-banner-stat-box">
            <span className="bbs-banner-stat-num">{members.length}</span>
            <span className="bbs-banner-stat-lbl">Members (Active Level)</span>
          </div>
          <button 
            className="bbs-btn bbs-btn-outline-secondary" 
            onClick={() => openProjectModal('edit', activeProject)}
          >
            <Edit3 size={16} />
            <span>Edit Project</span>
          </button>
        </div>
      </div>

      {/* Block Selector Tabs */}
      <div className="bbs-blocks-section">
        <div className="bbs-blocks-header">
          <div className="bbs-blocks-label">
            <LayoutGrid size={16} />
            <span>Blocks / Buildings:</span>
          </div>
          <button className="bbs-btn bbs-btn-sm bbs-btn-secondary" onClick={() => openBlockModal('create')}>
            <Plus size={15} />
            <span>Add Block</span>
          </button>
        </div>

        <div className="bbs-block-tabs-row">
          {blocks.length === 0 ? (
            <div className="bbs-no-blocks-alert">
              <Info size={16} />
              <span>No blocks created yet. Click <strong>"Add Block"</strong> (e.g. Block A, Tower 1) to start structuring this project.</span>
            </div>
          ) : (
            blocks.map((block) => {
              const blkId = block._id || block.id;
              const isSelected = blkId === selectedBlockId;
              return (
                <div key={blkId} className={`bbs-block-tab ${isSelected ? 'active' : ''}`}>
                  <button 
                    className="bbs-block-tab-btn" 
                    onClick={() => handleSelectBlock(blkId)}
                  >
                    <span className="bbs-block-name">{block.name}</span>
                    {block.code && <span className="bbs-block-code-tag">{block.code}</span>}
                    <span className="bbs-block-badge">{block.levelCount || 0} lvls</span>
                  </button>
                  {isSelected && (
                    <div className="bbs-block-tab-actions">
                      <button 
                        className="bbs-tab-action-btn" 
                        title="Edit Block" 
                        onClick={() => openBlockModal('edit', block)}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button 
                        className="bbs-tab-action-btn bbs-tab-action-danger" 
                        title="Delete Block" 
                        onClick={() => confirmDelete('block', blkId, block.name)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Workspace Body: Levels (Left) & Structural Members (Right) */}
      {selectedBlockId ? (
        <div className="bbs-hierarchy-grid">
          {/* LEFT COLUMN: LEVELS OF SELECTED BLOCK */}
          <div className="bbs-levels-panel">
            <div className="bbs-panel-header">
              <div className="bbs-panel-title-group">
                <Layers size={18} />
                <h3>Levels</h3>
                <span className="bbs-count-pill">{levels.length}</span>
              </div>
              <button className="bbs-btn bbs-btn-sm bbs-btn-primary" onClick={() => openLevelModal('create')}>
                <Plus size={15} />
                <span>Add Level</span>
              </button>
            </div>

            <div className="bbs-levels-list">
              {levels.length === 0 ? (
                <div className="bbs-empty-substate">
                  <p>No levels in <strong>{currentBlock?.name}</strong>.</p>
                  <button className="bbs-btn bbs-btn-sm bbs-btn-secondary" onClick={() => openLevelModal('create')}>
                    <Plus size={14} />
                    <span>Create Level (e.g. Footing, Ground Floor)</span>
                  </button>
                </div>
              ) : (
                levels.map((lvl, index) => {
                  const lvlId = lvl._id || lvl.id;
                  const isSelected = lvlId === selectedLevelId;
                  return (
                    <div 
                      key={lvlId} 
                      className={`bbs-level-item ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectLevel(lvlId)}
                    >
                      <div className="bbs-level-info">
                        <div className="bbs-level-name-row">
                          <span className="bbs-level-name">{lvl.name}</span>
                          {lvl.code && <span className="bbs-code-pill">{lvl.code}</span>}
                        </div>
                        <span className="bbs-level-meta">
                          {lvl.memberCount || 0} members
                          {lvl.completionPercentage > 0 && ` • ${lvl.completionPercentage}% BBS`}
                        </span>
                      </div>

                      <div className="bbs-level-actions" onClick={e => e.stopPropagation()}>
                        {/* Reorder Up/Down buttons */}
                        <div className="bbs-reorder-group">
                          <button 
                            className="bbs-icon-btn-tiny" 
                            title="Move Level Up" 
                            disabled={index === 0}
                            onClick={() => handleReorderLevel(index, 'up')}
                          >
                            <MoveUp size={12} />
                          </button>
                          <button 
                            className="bbs-icon-btn-tiny" 
                            title="Move Level Down" 
                            disabled={index === levels.length - 1}
                            onClick={() => handleReorderLevel(index, 'down')}
                          >
                            <MoveDown size={12} />
                          </button>
                        </div>
                        <button 
                          className="bbs-icon-btn-tiny" 
                          title="Edit Level" 
                          onClick={() => openLevelModal('edit', lvl)}
                        >
                          <Edit3 size={12} />
                        </button>
                        <button 
                          className="bbs-icon-btn-tiny bbs-icon-btn-danger" 
                          title="Delete Level" 
                          onClick={() => confirmDelete('level', lvlId, lvl.name)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: STRUCTURAL MEMBERS OF SELECTED LEVEL */}
          <div className="bbs-members-panel">
            <div className="bbs-panel-header">
              <div>
                <div className="bbs-panel-title-group">
                  <h3>Structural Members</h3>
                  {currentLevel && <span className="bbs-current-level-tag">Level: {currentLevel.name}</span>}
                </div>
                <p className="bbs-panel-sub">
                  Register columns, beams, slabs, footings and track BBS progress (Phase 1).
                </p>
              </div>

              {selectedLevelId && (
                <button className="bbs-btn bbs-btn-primary" onClick={() => openMemberModal('create')}>
                  <Plus size={16} />
                  <span>Add Structural Member</span>
                </button>
              )}
            </div>

            {/* Filter Pills */}
            {members.length > 0 && (
              <div className="bbs-member-filter-row">
                <button 
                  className={`bbs-filter-pill ${memberTypeFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setMemberTypeFilter('ALL')}
                >
                  All Types ({members.length})
                </button>
                {MEMBER_TYPE_OPTIONS.filter(type => members.some(m => m.memberType === type)).map(type => {
                  const count = members.filter(m => m.memberType === type).length;
                  return (
                    <button 
                      key={type}
                      className={`bbs-filter-pill ${memberTypeFilter === type ? 'active' : ''}`}
                      onClick={() => setMemberTypeFilter(type)}
                    >
                      {type} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Members List / Table */}
            {!selectedLevelId ? (
              <div className="bbs-empty-substate">
                <p>Please select or create a Level on the left to manage structural members.</p>
              </div>
            ) : members.length === 0 ? (
              <div className="bbs-empty-substate">
                <Hash size={36} className="bbs-empty-icon" />
                <h4>No Structural Members Registered</h4>
                <p>Add columns, beams, footings, or slabs for <strong>{currentLevel?.name}</strong>.</p>
                <button className="bbs-btn bbs-btn-primary" onClick={() => openMemberModal('create')}>
                  <Plus size={16} />
                  <span>Register First Member</span>
                </button>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="bbs-empty-substate">
                <p>No members match the selected filter (<strong>{memberTypeFilter}</strong>).</p>
                <button className="bbs-btn bbs-btn-sm bbs-btn-secondary" onClick={() => setMemberTypeFilter('ALL')}>
                  Show All Members
                </button>
              </div>
            ) : (
              <div className="bbs-table-wrapper">
                <table className="bbs-members-table">
                  <thead>
                    <tr>
                      <th>Display ID / Mark</th>
                      <th>Structural Type</th>
                      <th>Description / Notes</th>
                      <th>Backend Unique ID</th>
                      <th>BBS Status</th>
                      <th className="bbs-th-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map(member => {
                      const memberId = member._id || member.id;
                      const isComplete = member.completionPercentage === 100;
                      return (
                        <tr key={memberId}>
                          <td>
                            <div className="bbs-member-mark-badge">
                              <span className="bbs-mark-text">{member.displayId}</span>
                            </div>
                          </td>
                          <td>
                            <span className="bbs-type-badge">{member.memberType}</span>
                          </td>
                          <td>
                            <span className="bbs-desc-cell">{member.description || '—'}</span>
                          </td>
                          <td>
                            <code className="bbs-backend-id" title={`System UUID: ${memberId}`}>
                              {String(memberId).slice(-8)}
                            </code>
                          </td>
                          <td>
                            <button 
                              className={`bbs-status-toggle-btn ${isComplete ? 'complete' : 'not-started'}`}
                              onClick={() => handleToggleMemberCompletion(member)}
                              title="Click to toggle BBS completion (0% / 100%)"
                            >
                              {isComplete ? (
                                <>
                                  <CheckCircle2 size={14} />
                                  <span>100% Completed</span>
                                </>
                              ) : (
                                <>
                                  <Clock size={14} />
                                  <span>0% Not Started</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="bbs-td-actions">
                            <button 
                              className="bbs-icon-btn" 
                              title="Edit Member"
                              onClick={() => openMemberModal('edit', member)}
                            >
                              <Edit3 size={15} />
                            </button>
                            <button 
                              className="bbs-icon-btn bbs-icon-btn-danger" 
                              title="Delete Member"
                              onClick={() => confirmDelete('member', memberId, `${member.memberType} ${member.displayId}`)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bbs-empty-state">
          <LayoutGrid size={40} className="bbs-empty-icon" />
          <h3>No Block Selected</h3>
          <p>Please select a block above or create a new block to view levels and structural members.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Block Create / Edit */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalType === 'block' && (
        <div className="bbs-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="bbs-modal" onClick={e => e.stopPropagation()}>
            <div className="bbs-modal-header">
              <h3>{modalMode === 'create' ? 'Add Block to Project' : 'Edit Block'}</h3>
              <button className="bbs-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveBlock}>
              <div className="bbs-modal-body">
                <div className="bbs-form-group">
                  <label>Block Display Name <span className="bbs-required">*</span></label>
                  <input 
                    type="text" 
                    placeholder="e.g. Block A, Tower 1, Commercial Wing" 
                    value={blockForm.name} 
                    onChange={e => setBlockForm({ ...blockForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="bbs-form-group">
                  <label>Optional Block Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. BLK-A, T1" 
                    value={blockForm.code} 
                    onChange={e => setBlockForm({ ...blockForm, code: e.target.value })}
                  />
                </div>
                <div className="bbs-form-group">
                  <label>Optional Description</label>
                  <textarea 
                    placeholder="Notes about this block..." 
                    rows={2}
                    value={blockForm.description} 
                    onChange={e => setBlockForm({ ...blockForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="bbs-modal-footer">
                <button type="button" className="bbs-btn bbs-btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="bbs-btn bbs-btn-primary">
                  {modalMode === 'create' ? 'Create Block' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Level Create / Edit */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalType === 'level' && (
        <div className="bbs-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="bbs-modal" onClick={e => e.stopPropagation()}>
            <div className="bbs-modal-header">
              <h3>{modalMode === 'create' ? `Add Level to ${currentBlock?.name}` : 'Edit Level'}</h3>
              <button className="bbs-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveLevel}>
              <div className="bbs-modal-body">
                <div className="bbs-form-group">
                  <label>Level Name <span className="bbs-required">*</span></label>
                  <input 
                    type="text" 
                    placeholder="e.g. Footing, Basement 1, Ground Floor, First Floor, Terrace" 
                    value={levelForm.name} 
                    onChange={e => setLevelForm({ ...levelForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="bbs-form-group">
                  <label>Optional Level Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. GF, 1F, B1, RF" 
                    value={levelForm.code} 
                    onChange={e => setLevelForm({ ...levelForm, code: e.target.value })}
                  />
                </div>
                <div className="bbs-form-group">
                  <label>Optional Description</label>
                  <textarea 
                    placeholder="Level notes or structural elevation info..." 
                    rows={2}
                    value={levelForm.description} 
                    onChange={e => setLevelForm({ ...levelForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="bbs-modal-footer">
                <button type="button" className="bbs-btn bbs-btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="bbs-btn bbs-btn-primary">
                  {modalMode === 'create' ? 'Add Level' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Structural Member Create / Edit */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalType === 'member' && (
        <div className="bbs-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="bbs-modal" onClick={e => e.stopPropagation()}>
            <div className="bbs-modal-header">
              <h3>{modalMode === 'create' ? `Add Structural Members (${currentLevel?.name})` : 'Edit Structural Member'}</h3>
              <button className="bbs-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
            </div>

            {modalMode === 'create' && (
              <div className="bbs-modal-tab-bar">
                <button 
                  type="button" 
                  className={`bbs-modal-tab-btn ${memberModalTab === 'single' ? 'active' : ''}`}
                  onClick={() => setMemberModalTab('single')}
                >
                  Single Member
                </button>
                <button 
                  type="button" 
                  className={`bbs-modal-tab-btn ${memberModalTab === 'series' ? 'active' : ''}`}
                  onClick={() => setMemberModalTab('series')}
                >
                  ⚡ Multi Member
                </button>
              </div>
            )}

            {modalMode === 'create' && memberModalTab === 'series' ? (
              <form onSubmit={handleSaveSeriesMembers}>
                <div className="bbs-modal-body">
                  <div className="bbs-form-group">
                    <label>Structural Category <span className="bbs-required">*</span></label>
                    <select 
                      value={seriesForm.memberType} 
                      onChange={e => handleSeriesMemberTypeChange(e.target.value)}
                      required
                    >
                      {MEMBER_TYPE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bbs-form-row-3">
                    <div className="bbs-form-group">
                      <label>Mark Prefix <span className="bbs-required">*</span></label>
                      <input 
                        type="text" 
                        placeholder={`e.g. ${DEFAULT_PREFIX_MAP[seriesForm.memberType] || 'C'}`}
                        value={seriesForm.prefix} 
                        onChange={e => setSeriesForm({ ...seriesForm, prefix: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="bbs-form-group">
                      <label>From No. <span className="bbs-required">*</span></label>
                      <input 
                        type="number" 
                        min="1"
                        max="999"
                        placeholder="e.g. 1"
                        value={seriesForm.startNum} 
                        onChange={e => setSeriesForm({ ...seriesForm, startNum: e.target.value })}
                        required
                      />
                    </div>
                    <div className="bbs-form-group">
                      <label>To No. <span className="bbs-required">*</span></label>
                      <input 
                        type="number" 
                        min="1"
                        max="999"
                        placeholder="e.g. 15"
                        value={seriesForm.endNum} 
                        onChange={e => setSeriesForm({ ...seriesForm, endNum: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Live Series Preview */}
                  {(() => {
                    const hasRange = seriesForm.startNum !== '' && seriesForm.endNum !== '';
                    const start = parseInt(seriesForm.startNum, 10);
                    const end = parseInt(seriesForm.endNum, 10);
                    const prefix = (seriesForm.prefix || '').trim();

                    if (!hasRange || isNaN(start) || isNaN(end) || end < start) {
                      return (
                        <div className="bbs-series-preview-card bbs-series-preview-empty">
                          <span className="bbs-series-preview-hint">
                            💡 Enter Mark Prefix (e.g. <strong>{DEFAULT_PREFIX_MAP[seriesForm.memberType] || 'C'}</strong>) and Range (e.g. <strong>1</strong> to <strong>15</strong>) to preview generated marks.
                          </span>
                        </div>
                      );
                    }

                    const count = Math.min(200, end - start + 1);
                    const previewList = [];
                    for (let i = start; i <= end && previewList.length < 16; i++) {
                      previewList.push(`${prefix}${i}`);
                    }
                    return (
                      <div className="bbs-series-preview-card">
                        <div className="bbs-series-preview-header">
                          <span className="bbs-series-preview-title">Series Preview ({count} Members)</span>
                          <span className="bbs-series-preview-badge">1-Click Batch Creation</span>
                        </div>
                        <div className="bbs-series-preview-pills">
                          {previewList.map(mark => (
                            <span key={mark} className="bbs-preview-pill">{mark}</span>
                          ))}
                          {count > 16 && <span className="bbs-preview-pill-more">+{count - 16} more</span>}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="bbs-form-group">
                    <label>Optional Description / Notes (applied to all)</label>
                    <input 
                      type="text"
                      placeholder="e.g. Main framing elements, standard reinforcement" 
                      value={seriesForm.description} 
                      onChange={e => setSeriesForm({ ...seriesForm, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="bbs-modal-footer">
                  <button type="button" className="bbs-btn bbs-btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button 
                    type="submit" 
                    className="bbs-btn bbs-btn-primary"
                    disabled={!seriesForm.prefix.trim() || seriesForm.startNum === '' || seriesForm.endNum === ''}
                  >
                    ⚡ Generate {seriesForm.startNum !== '' && seriesForm.endNum !== '' && parseInt(seriesForm.endNum, 10) >= parseInt(seriesForm.startNum, 10) ? `${parseInt(seriesForm.endNum, 10) - parseInt(seriesForm.startNum, 10) + 1} ` : ''}{seriesForm.memberType} Members
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveMember}>
                <div className="bbs-modal-body">
                  <div className="bbs-form-group">
                    <label>Structural Category <span className="bbs-required">*</span></label>
                    <select 
                      value={memberForm.memberType} 
                      onChange={e => setMemberForm({ ...memberForm, memberType: e.target.value })}
                      required
                    >
                      {MEMBER_TYPE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bbs-form-group">
                    <label>Member Display ID / Mark <span className="bbs-required">*</span></label>
                    <input 
                      type="text" 
                      placeholder={`e.g. ${DEFAULT_PREFIX_MAP[memberForm.memberType] || 'C'}1`}
                      value={memberForm.displayId} 
                      onChange={e => setMemberForm({ ...memberForm, displayId: e.target.value })}
                      required
                      autoFocus
                    />
                    <span className="bbs-input-helper">
                      Engineering mark on drawing (e.g. {DEFAULT_PREFIX_MAP[memberForm.memberType] || 'C'}1). Unique backend ID is auto-assigned.
                    </span>
                  </div>
                  <div className="bbs-form-group">
                    <label>BBS Completion State</label>
                    <select 
                      value={memberForm.completionPercentage} 
                      onChange={e => setMemberForm({ ...memberForm, completionPercentage: Number(e.target.value) })}
                    >
                      <option value={0}>0% — Not Started</option>
                      <option value={25}>25% — Draft</option>
                      <option value={50}>50% — In Progress</option>
                      <option value={75}>75% — Verification</option>
                      <option value={100}>100% — Completed</option>
                    </select>
                  </div>
                  <div className="bbs-form-group">
                    <label>Optional Description / Drawing Grid Location</label>
                    <textarea 
                      placeholder="e.g. Grid A-4 to B-6, Main framing beam, 400x600mm" 
                      rows={2}
                      value={memberForm.description} 
                      onChange={e => setMemberForm({ ...memberForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="bbs-modal-footer">
                  <button type="button" className="bbs-btn bbs-btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="submit" className="bbs-btn bbs-btn-primary">
                    {modalMode === 'create' ? 'Register Member' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Project Edit from Workspace */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalType === 'project' && (
        <div className="bbs-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="bbs-modal" onClick={e => e.stopPropagation()}>
            <div className="bbs-modal-header">
              <h3>Edit Project Details</h3>
              <button className="bbs-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveProject}>
              <div className="bbs-modal-body">
                <div className="bbs-form-group">
                  <label>Project Name <span className="bbs-required">*</span></label>
                  <input 
                    type="text" 
                    value={projectForm.name} 
                    onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="bbs-form-group">
                  <label>Location / Site Address</label>
                  <input 
                    type="text" 
                    value={projectForm.location} 
                    onChange={e => setProjectForm({ ...projectForm, location: e.target.value })}
                  />
                </div>
                <div className="bbs-form-group">
                  <label>Project Status</label>
                  <select 
                    value={projectForm.status} 
                    onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Planning">Planning</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
                <div className="bbs-form-group">
                  <label>Remarks / Description</label>
                  <textarea 
                    rows={3}
                    value={projectForm.description} 
                    onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="bbs-modal-footer">
                <button type="button" className="bbs-btn bbs-btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="bbs-btn bbs-btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Delete Confirmation */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalType === 'confirmDelete' && (
        <div className="bbs-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="bbs-modal bbs-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="bbs-modal-header bbs-modal-header-danger">
              <h3>Confirm Deletion</h3>
              <button className="bbs-close-btn" onClick={() => setModalType(null)}><X size={20} /></button>
            </div>
            <div className="bbs-modal-body">
              <div className="bbs-delete-warning">
                <AlertCircle size={28} className="bbs-danger-icon" />
                <div>
                  <p>Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>?</p>
                  <p className="bbs-danger-subtext">
                    {deleteTarget?.type === 'shape' && 'This custom shape will be permanently removed from your library.'}
                    {deleteTarget?.type === 'project' && 'This will remove all blocks, levels, and structural members contained in this project.'}
                    {deleteTarget?.type === 'block' && 'This will remove all levels and structural members contained in this block.'}
                    {deleteTarget?.type === 'level' && 'This will remove all structural members registered under this level.'}
                    {deleteTarget?.type === 'member' && 'This structural member record will be removed.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bbs-modal-footer">
              <button type="button" className="bbs-btn bbs-btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
              <button type="button" className="bbs-btn bbs-btn-danger" onClick={executeDelete}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
