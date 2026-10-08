import React, { useState, useMemo } from 'react';
import {
  STANDARD_SHAPE_TEMPLATES,
  SHAPE_CATEGORIES,
  SHAPE_STATUS,
  SHAPE_OWNERSHIP
} from './cad/shapeDefinitionModel';
import ShapeDetailsModal from './ShapeDetailsModal';
import CreateShapeModal from './CreateShapeModal';
import NewVersionModal from './NewVersionModal';
import {
  Plus,
  Search,
  X,
  Eye,
  Pencil,
  Copy,
  GitBranch,
  Archive,
  RotateCcw,
  Trash2,
  Filter,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Layers,
  Sparkles,
  SlidersHorizontal,
  FolderArchive,
  AlertTriangle,
  FileCode,
  Tag,
  Calendar,
  Settings2
} from 'lucide-react';
import './ShapeLibrary.css';

export default function ShapeLibrary({
  customShapes = [],
  onCreateNewShape,
  onOpenInCAD,
  onDuplicateShape,
  onNewVersionShape,
  onStatusChangeShape,
  onArchiveShape,
  onRestoreShape,
  onDeleteShape
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'STANDARD' | 'CUSTOM' | 'DRAFT' | 'DEPRECATED' | 'ARCHIVED'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('updatedAt'); // 'updatedAt' | 'name' | 'code' | 'usage'

  // Modals state
  const [inspectedShape, setInspectedShape] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [versioningShape, setVersioningShape] = useState(null);

  // Convert standard templates to displayable shape definitions
  const standardShapesList = useMemo(() => {
    return STANDARD_SHAPE_TEMPLATES.map(tpl => {
      const model = tpl.createModel();
      return {
        _id: tpl.templateId,
        id: tpl.templateId,
        name: tpl.name,
        code: tpl.shapeCode,
        shapeCode: tpl.shapeCode,
        category: tpl.category,
        description: tpl.description,
        tags: tpl.tags || [],
        ownership: SHAPE_OWNERSHIP.STANDARD,
        isStandard: true,
        status: SHAPE_STATUS.ACTIVE,
        version: '1.0',
        unit: tpl.unit || 'mm',
        geometry: model.geometry,
        parameters: model.parameters,
        dimensions: model.dimensions,
        constraints: model.constraints,
        metadata: { usageCount: 0, favorite: false }
      };
    });
  }, []);

  // Filtered standard shapes
  const filteredStandard = useMemo(() => {
    if (selectedStatusTab === 'CUSTOM' || selectedStatusTab === 'DRAFT' || selectedStatusTab === 'ARCHIVED') {
      return [];
    }
    return standardShapesList.filter(s => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [standardShapesList, searchQuery, selectedCategory, selectedStatusTab]);

  // Filtered & sorted custom shapes
  const filteredCustom = useMemo(() => {
    if (selectedStatusTab === 'STANDARD') {
      return [];
    }
    return customShapes
      .filter(s => {
        const status = (s.status || 'DRAFT').toUpperCase();
        if (selectedStatusTab === 'ACTIVE' && status !== 'ACTIVE') return false;
        if (selectedStatusTab === 'DRAFT' && status !== 'DRAFT') return false;
        if (selectedStatusTab === 'DEPRECATED' && status !== 'DEPRECATED') return false;
        if (selectedStatusTab === 'ARCHIVED' && status !== 'ARCHIVED') return false;
        if (selectedStatusTab === 'ALL' && status === 'ARCHIVED') return false; // Hide archived from ALL by default

        const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
        const matchesSearch =
          (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.code || s.shapeCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'code') return (a.code || a.shapeCode || '').localeCompare(b.code || b.shapeCode || '');
        if (sortBy === 'usage') return (b.metadata?.usageCount || 0) - (a.metadata?.usageCount || 0);
        return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      });
  }, [customShapes, selectedStatusTab, selectedCategory, searchQuery, sortBy]);

  // Stats Counters
  const stats = useMemo(() => {
    const totalCustom = customShapes.length;
    const activeCount = customShapes.filter(s => (s.status || 'DRAFT') === 'ACTIVE').length;
    const draftCount = customShapes.filter(s => (s.status || 'DRAFT') === 'DRAFT').length;
    const archivedCount = customShapes.filter(s => s.status === 'ARCHIVED').length;
    return {
      total: totalCustom + standardShapesList.length,
      active: activeCount + standardShapesList.length,
      drafts: draftCount,
      archived: archivedCount,
      standards: standardShapesList.length,
      customs: totalCustom
    };
  }, [customShapes, standardShapesList]);

  // Dynamic Mini Preview SVG Renderer for Shape Cards
  const renderMiniPreview = (shape) => {
    const objects = shape.geometry?.objects || [];
    if (objects.length === 0) {
      return (
        <div className="shape-preview-empty">
          <FileCode size={20} className="shape-empty-icon" />
          <span>No Geometry Defined</span>
        </div>
      );
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    objects.forEach(obj => {
      if (obj.type === 'line') {
        const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
        const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
        minX = Math.min(minX, p1.x, p2.x);
        maxX = Math.max(maxX, p1.x, p2.x);
        minY = Math.min(minY, -p1.y, -p2.y);
        maxY = Math.max(maxY, -p1.y, -p2.y);
      } else if (obj.type === 'polyline' && Array.isArray(obj.points)) {
        obj.points.forEach(p => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, -p.y);
          maxY = Math.max(maxY, -p.y);
        });
      } else if (obj.type === 'rectangle') {
        const x = obj.x || 0;
        const y = -((obj.y || 0) + (obj.height || 0));
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + (obj.width || 0));
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + (obj.height || 0));
      } else if (obj.type === 'circle') {
        const cx = obj.center?.x || obj.cx || 0;
        const cy = -(obj.center?.y || obj.cy || 0);
        const r = obj.radius || 50;
        minX = Math.min(minX, cx - r);
        maxX = Math.max(maxX, cx + r);
        minY = Math.min(minY, cy - r);
        maxY = Math.max(maxY, cy + r);
      } else if (obj.type === 'rebar') {
        const pts = Array.isArray(obj.points)
          ? obj.points
          : Array.isArray(obj.centerline)
          ? obj.centerline
          : obj.centerline?.points || [];
        pts.forEach(p => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, -p.y);
          maxY = Math.max(maxY, -p.y);
        });
      }
    });

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      minX = -150; maxX = 150; minY = -80; maxY = 80;
    }

    const width = Math.max(40, maxX - minX);
    const height = Math.max(40, maxY - minY);
    const padX = Math.max(24, width * 0.25);
    const padY = Math.max(24, height * 0.25);

    const vbX = minX - padX;
    const vbY = minY - padY;
    const vbW = width + padX * 2;
    const vbH = height + padY * 2;
    const strokeW = Math.max(2.4, Math.min(7, vbW * 0.022));

    return (
      <svg
        className="shape-preview-svg"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id={`cad-grid-${shape.id || shape._id}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56, 189, 248, 0.04)" strokeWidth="1" />
          </pattern>
          <filter id="rebar-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Blueprint Grid & Center Lines */}
        <rect x={vbX} y={vbY} width={vbW} height={vbH} fill={`url(#cad-grid-${shape.id || shape._id})`} />
        <line x1={vbX} y1="0" x2={vbX + vbW} y2="0" stroke="rgba(51, 65, 85, 0.45)" strokeDasharray="3 3" strokeWidth="0.8" />
        <line x1="0" y1={vbY} x2="0" y2={vbY + vbH} stroke="rgba(51, 65, 85, 0.45)" strokeDasharray="3 3" strokeWidth="0.8" />

        {objects.map((obj, i) => {
          if (obj.type === 'line') {
            const p1 = obj.p1 || { x: obj.x1 || 0, y: obj.y1 || 0 };
            const p2 = obj.p2 || { x: obj.x2 || 0, y: obj.y2 || 0 };
            return (
              <line
                key={i}
                x1={p1.x}
                y1={-p1.y}
                x2={p2.x}
                y2={-p2.y}
                stroke="#38bdf8"
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
            );
          }
          if (obj.type === 'rectangle') {
            return (
              <rect
                key={i}
                x={obj.x || 0}
                y={-((obj.y || 0) + (obj.height || 0))}
                width={obj.width || 0}
                height={obj.height || 0}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={strokeW}
                rx="2"
              />
            );
          }
          if (obj.type === 'circle') {
            return (
              <circle
                key={i}
                cx={obj.center?.x || obj.cx || 0}
                cy={-(obj.center?.y || obj.cy || 0)}
                r={obj.radius || 0}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={strokeW}
              />
            );
          }
          if (obj.type === 'rebar') {
            const rawPts = Array.isArray(obj.points)
              ? obj.points
              : Array.isArray(obj.centerline)
              ? obj.centerline
              : obj.centerline?.points || [];
            const pts = rawPts.map(p => `${p.x},${-p.y}`).join(' ');
            return (
              <polyline
                key={i}
                points={pts}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={strokeW * 1.35}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#rebar-glow)"
              />
            );
          }
          return null;
        })}
      </svg>
    );
  };

  const isFiltered = searchQuery !== '' || selectedCategory !== 'All' || selectedStatusTab !== 'ALL';

  return (
    <div className="shape-library-wrapper">
      {/* Header */}
      <header className="shape-library-header">
        <div className="shape-header-content">
          <div className="shape-header-icon-box">
            <Layers size={24} className="shape-header-icon" />
          </div>
          <div className="shape-header-text">
            <div className="shape-header-title-row">
              <h1>BBS Shape Library & Parametric Catalog</h1>
              <span className="shape-compliance-badge">BS 8666 / IS 2502 Compliant</span>
            </div>
            <p>Standard architectural bar catalog and custom parametric rebar blocks with live calculation validation</p>
          </div>
        </div>

        <div className="shape-header-actions">
          <button className="shape-create-btn" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>Create New Shape</span>
          </button>
        </div>
      </header>

      {/* Stats Summary Dashboard Cards */}
      <div className="shape-stats-grid">
        <div
          className={`shape-stat-card ${selectedStatusTab === 'ALL' ? 'selected' : ''}`}
          onClick={() => setSelectedStatusTab('ALL')}
          title="Click to view all shapes"
        >
          <div className="shape-stat-icon-wrapper total">
            <Boxes size={18} />
          </div>
          <div className="shape-stat-details">
            <span className="shape-stat-label">Total Catalog</span>
            <span className="shape-stat-val">{stats.total} Shapes</span>
          </div>
        </div>

        <div
          className={`shape-stat-card ${selectedStatusTab === 'ACTIVE' ? 'selected' : ''}`}
          onClick={() => setSelectedStatusTab('ACTIVE')}
          title="Click to filter active shapes"
        >
          <div className="shape-stat-icon-wrapper active">
            <CheckCircle2 size={18} />
          </div>
          <div className="shape-stat-details">
            <span className="shape-stat-label">Active Library</span>
            <span className="shape-stat-val text-emerald">{stats.active}</span>
          </div>
        </div>

        <div
          className={`shape-stat-card ${selectedStatusTab === 'DRAFT' ? 'selected' : ''}`}
          onClick={() => setSelectedStatusTab('DRAFT')}
          title="Click to filter drafts"
        >
          <div className="shape-stat-icon-wrapper drafts">
            <Clock size={18} />
          </div>
          <div className="shape-stat-details">
            <span className="shape-stat-label">Drafts in Progress</span>
            <span className="shape-stat-val text-amber">{stats.drafts}</span>
          </div>
        </div>

        <div
          className={`shape-stat-card ${selectedStatusTab === 'STANDARD' ? 'selected' : ''}`}
          onClick={() => setSelectedStatusTab('STANDARD')}
          title="Click to view standard BS/IS templates"
        >
          <div className="shape-stat-icon-wrapper standard">
            <ShieldCheck size={18} />
          </div>
          <div className="shape-stat-details">
            <span className="shape-stat-label">Standard Templates</span>
            <span className="shape-stat-val text-cyan">{stats.standards}</span>
          </div>
        </div>

        <div
          className={`shape-stat-card ${selectedStatusTab === 'ARCHIVED' ? 'selected' : ''}`}
          onClick={() => setSelectedStatusTab('ARCHIVED')}
          title="Click to view archived shapes"
        >
          <div className="shape-stat-icon-wrapper archived">
            <FolderArchive size={18} />
          </div>
          <div className="shape-stat-details">
            <span className="shape-stat-label">Archived</span>
            <span className="shape-stat-val text-slate">{stats.archived}</span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="shape-controls-card">
        <div className="shape-filter-tabs">
          {[
            { id: 'ALL', label: 'All Shapes', count: stats.total },
            { id: 'ACTIVE', label: 'Active', count: stats.active },
            { id: 'STANDARD', label: 'Standard Catalog', count: stats.standards },
            { id: 'CUSTOM', label: 'Custom Shapes', count: stats.customs },
            { id: 'DRAFT', label: 'Drafts', count: stats.drafts },
            { id: 'ARCHIVED', label: 'Archived', count: stats.archived }
          ].map(tab => (
            <button
              key={tab.id}
              className={`shape-tab-pill ${selectedStatusTab === tab.id ? 'active' : ''}`}
              onClick={() => setSelectedStatusTab(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="shape-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="shape-filter-selectors">
          {/* Category Dropdown */}
          <div className="shape-select-wrapper">
            <Filter size={14} className="shape-select-icon" />
            <select
              className="shape-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {SHAPE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>Category: {cat}</option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="shape-select-wrapper">
            <ArrowUpDown size={14} className="shape-select-icon" />
            <select
              className="shape-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="updatedAt">Sort: Recently Updated</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="code">Sort: Shape Code</option>
              <option value="usage">Sort: Most Used</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="shape-search-wrapper">
            <Search size={15} className="shape-search-icon" />
            <input
              type="text"
              className="shape-search-input"
              placeholder="Search code, name, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="shape-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {isFiltered && (
            <button
              className="shape-reset-filters-btn"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedStatusTab('ALL');
              }}
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: CUSTOM USER PARAMETRIC SHAPES */}
      {(selectedStatusTab !== 'STANDARD') && (
        <section className="shape-catalog-section">
          <div className="shape-section-header">
            <div className="shape-section-title-wrapper">
              <span className="shape-section-indicator custom"></span>
              <h2>Organization Custom Shapes</h2>
              <span className="shape-section-badge">{filteredCustom.length}</span>
            </div>
            <p className="shape-section-sub">Parametric rebar blocks created and maintained by your team</p>
          </div>

          {filteredCustom.length === 0 ? (
            <div className="shape-empty-state">
              <div className="shape-empty-icon-box">
                <Sparkles size={28} />
              </div>
              <h3>No custom shapes found</h3>
              <p>No shapes match your current filter criteria. Create your first parametric CAD block to expand your library.</p>
              <button className="shape-create-btn" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} />
                <span>Create New Custom Shape</span>
              </button>
            </div>
          ) : (
            <div className="shape-grid">
              {filteredCustom.map(shape => {
                const shapeId = shape._id || shape.id;
                const status = (shape.status || 'DRAFT').toUpperCase();
                const isArchived = status === 'ARCHIVED';

                return (
                  <div key={shapeId} className={`shape-card ${isArchived ? 'archived' : ''}`}>
                    <div className="shape-card-preview" onClick={() => setInspectedShape(shape)}>
                      {renderMiniPreview(shape)}
                      <div className="shape-preview-overlay">
                        <span className="shape-preview-overlay-btn">
                          <Eye size={14} /> Quick Inspect
                        </span>
                      </div>
                    </div>

                    <div className="shape-card-body">
                      <div className="shape-card-top-row">
                        <span className="shape-card-code">{shape.code || shape.shapeCode || 'CUSTOM'}</span>
                        <div className="shape-card-badges">
                          <span className={`shape-badge-status ${status.toLowerCase()}`}>
                            {status === 'ACTIVE' && <span className="status-dot green"></span>}
                            {status === 'DRAFT' && <span className="status-dot amber"></span>}
                            {status}
                          </span>
                          <span className="shape-badge-version">
                            v{shape.version || '1.0'}
                          </span>
                        </div>
                      </div>

                      <h3 className="shape-card-title" title={shape.name}>{shape.name}</h3>
                      <div className="shape-card-category-pill">
                        <Tag size={11} />
                        <span>{shape.category || 'Custom'}</span>
                      </div>

                      <div className="shape-card-meta">
                        <span className="shape-meta-param">
                          <Settings2 size={12} />
                          {shape.parameters?.length || 0} params • {shape.unit || 'mm'}
                        </span>
                        <span className="shape-meta-date">
                          <Calendar size={12} />
                          {new Date(shape.updatedAt || shape.createdAt || Date.now()).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="shape-card-actions">
                        <button
                          className="shape-action-btn primary"
                          onClick={() => setInspectedShape(shape)}
                          title="View detailed calculations, validation & playground"
                        >
                          <Eye size={14} />
                          <span>Details</span>
                        </button>
                        <button
                          className="shape-action-btn cad"
                          onClick={() => onOpenInCAD(shape)}
                          title="Open in parametric CAD Workspace"
                        >
                          <Pencil size={14} />
                          <span>Edit CAD</span>
                        </button>

                        <div className="shape-action-icons-group">
                          {onDuplicateShape && (
                            <button
                              className="shape-action-icon-btn"
                              onClick={() => onDuplicateShape(shape)}
                              title="Duplicate as new shape"
                            >
                              <Copy size={13} />
                            </button>
                          )}
                          {onNewVersionShape && !isArchived && (
                            <button
                              className="shape-action-icon-btn"
                              onClick={() => setVersioningShape(shape)}
                              title="Create new version"
                            >
                              <GitBranch size={13} />
                            </button>
                          )}
                          {isArchived && onRestoreShape && (
                            <button
                              className="shape-action-icon-btn restore"
                              onClick={() => onRestoreShape(shape)}
                              title="Restore shape"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                          {!isArchived && onArchiveShape && (
                            <button
                              className="shape-action-icon-btn"
                              onClick={() => onArchiveShape(shape)}
                              title="Archive shape"
                            >
                              <Archive size={13} />
                            </button>
                          )}
                          {onDeleteShape && (
                            <button
                              className="shape-action-icon-btn danger"
                              onClick={() => onDeleteShape(shape)}
                              title="Delete shape"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: STANDARD BS 8666 / IS 2502 CATALOG */}
      {(selectedStatusTab === 'ALL' || selectedStatusTab === 'ACTIVE' || selectedStatusTab === 'STANDARD') && (
        <section className="shape-catalog-section">
          <div className="shape-section-header">
            <div className="shape-section-title-wrapper">
              <span className="shape-section-indicator standard"></span>
              <h2>Standard Shape Catalog (BS 8666 / IS 2502)</h2>
              <span className="shape-section-badge">{filteredStandard.length}</span>
            </div>
            <p className="shape-section-sub">Standardized engineering shapes with pre-configured bending and calculation formulas</p>
          </div>

          <div className="shape-grid">
            {filteredStandard.map(shape => (
              <div key={shape.id} className="shape-card standard-card">
                <div className="shape-card-preview" onClick={() => setInspectedShape(shape)}>
                  {renderMiniPreview(shape)}
                  <div className="shape-preview-overlay">
                    <span className="shape-preview-overlay-btn">
                      <Eye size={14} /> Quick Inspect
                    </span>
                  </div>
                </div>

                <div className="shape-card-body">
                  <div className="shape-card-top-row">
                    <span className="shape-card-code standard">{shape.code}</span>
                    <span className="shape-badge-standard-pill">
                      <ShieldCheck size={12} /> STANDARD
                    </span>
                  </div>

                  <h3 className="shape-card-title" title={shape.name}>{shape.name}</h3>
                  <div className="shape-card-category-pill">
                    <Tag size={11} />
                    <span>{shape.category}</span>
                  </div>

                  <div className="shape-card-meta">
                    <span className="shape-meta-param">
                      <Settings2 size={12} />
                      {shape.parameters?.length || 0} params • {shape.unit || 'mm'}
                    </span>
                    <span className="shape-meta-protected">
                      <ShieldCheck size={12} /> Protected Master
                    </span>
                  </div>

                  <div className="shape-card-actions">
                    <button
                      className="shape-action-btn primary"
                      onClick={() => setInspectedShape(shape)}
                      title="Inspect engineering formulas & parameters"
                    >
                      <Eye size={14} />
                      <span>Details</span>
                    </button>
                    <button
                      className="shape-action-btn cad-customize"
                      onClick={() => onOpenInCAD(shape)}
                      title="Open and customize in CAD Workspace"
                    >
                      <Pencil size={14} />
                      <span>Customize in CAD</span>
                    </button>
                    {onDuplicateShape && (
                      <button
                        className="shape-action-icon-btn"
                        onClick={() => onDuplicateShape(shape)}
                        title="Duplicate as editable custom shape"
                      >
                        <Copy size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODAL: Shape Inspection & Details (Phase 2G) */}
      {inspectedShape && (
        <ShapeDetailsModal
          shape={inspectedShape}
          onClose={() => setInspectedShape(null)}
          onOpenInCAD={(s) => {
            setInspectedShape(null);
            onOpenInCAD(s);
          }}
          onDuplicate={(s) => {
            setInspectedShape(null);
            if (onDuplicateShape) onDuplicateShape(s);
          }}
          onNewVersion={(s) => {
            setInspectedShape(null);
            setVersioningShape(s);
          }}
          onStatusChange={async (s, newStatus) => {
            if (onStatusChangeShape) {
              await onStatusChangeShape(s, newStatus);
              setInspectedShape(prev => prev ? { ...prev, status: newStatus } : null);
            }
          }}
          onArchive={async (s) => {
            if (onArchiveShape) {
              await onArchiveShape(s);
              setInspectedShape(null);
            }
          }}
          onRestore={async (s) => {
            if (onRestoreShape) {
              await onRestoreShape(s);
              setInspectedShape(null);
            }
          }}
        />
      )}

      {/* MODAL: Create New Shape (Phase 2G) */}
      <CreateShapeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={(newShape) => {
          setShowCreateModal(false);
          onCreateNewShape(newShape);
        }}
      />

      {/* MODAL: Version Bumping (Phase 2G) */}
      <NewVersionModal
        isOpen={Boolean(versioningShape)}
        shape={versioningShape}
        onClose={() => setVersioningShape(null)}
        onCreateVersion={async (versionData) => {
          if (onNewVersionShape && versioningShape) {
            await onNewVersionShape(versioningShape, versionData);
            setVersioningShape(null);
          }
        }}
      />
    </div>
  );
}

