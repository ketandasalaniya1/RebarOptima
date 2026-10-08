import React, { useState } from 'react';
import {
  STANDARD_SHAPE_TEMPLATES,
  SHAPE_CATEGORIES,
  createBlankShapeDefinition,
  createShapeFromTemplate
} from './cad/shapeDefinitionModel';
import { Sparkles, Layers, Pencil, Plus, X, Check, BookOpen } from 'lucide-react';
import './ShapeDetailsModal.css';

export default function CreateShapeModal({
  isOpen,
  onClose,
  onCreate
}) {
  const [creationMode, setCreationMode] = useState('template'); // 'template' | 'blank'
  const [selectedTemplateId, setSelectedTemplateId] = useState(STANDARD_SHAPE_TEMPLATES[3]?.templateId || 'tpl_stirrup_51');
  const [shapeName, setShapeName] = useState('Rectangular Closed Stirrup');
  const [category, setCategory] = useState('Closed Stirrup / Link');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('stirrup, seismic, 135-hook');

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplateId(tpl.templateId);
    setShapeName(tpl.name);
    setCategory(tpl.category);
    setDescription(tpl.description || '');
    setTagsInput((tpl.tags || []).join(', '));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let newShape;
    if (creationMode === 'blank') {
      newShape = createBlankShapeDefinition(shapeName, category);
      newShape.description = description;
      newShape.tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    } else {
      newShape = createShapeFromTemplate(selectedTemplateId, shapeName);
      newShape.category = category;
      newShape.description = description;
      newShape.tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    }
    onCreate(newShape);
  };

  return (
    <div className="shape-details-backdrop" onClick={onClose}>
      <div
        className="shape-details-modal"
        style={{ maxWidth: '820px', height: 'auto', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <header className="shape-details-header">
          <div className="shape-header-main">
            <h2 className="shape-header-title">
              <Sparkles size={18} className="text-emerald" />
              <span>Create New Parametric Shape</span>
            </h2>
          </div>
          <button className="shape-header-close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            {/* Mode Selector */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                type="button"
                className={`shape-btn ${creationMode === 'template' ? 'shape-btn-primary' : 'shape-btn-secondary'}`}
                style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => setCreationMode('template')}
              >
                <BookOpen size={16} />
                <span>Start from Standard Template</span>
              </button>
              <button
                type="button"
                className={`shape-btn ${creationMode === 'blank' ? 'shape-btn-primary' : 'shape-btn-secondary'}`}
                style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  setCreationMode('blank');
                  setShapeName('Untitled Custom Shape');
                  setCategory('Custom');
                  setDescription('Custom parametric CAD block');
                  setTagsInput('custom, cad');
                }}
              >
                <Pencil size={16} />
                <span>Start Blank CAD Workspace</span>
              </button>
            </div>

            {/* Template Selection Grid */}
            {creationMode === 'template' && (
              <div style={{ marginBottom: '20px' }}>
                <label className="shape-info-label" style={{ marginBottom: '8px', display: 'block' }}>
                  Select Standard Rebar Template:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                  {STANDARD_SHAPE_TEMPLATES.map(tpl => {
                    const isSelected = selectedTemplateId === tpl.templateId;
                    return (
                      <div
                        key={tpl.templateId}
                        onClick={() => handleSelectTemplate(tpl)}
                        style={{
                          background: isSelected ? 'rgba(56, 189, 248, 0.12)' : '#0f172a',
                          border: `1px solid ${isSelected ? '#38bdf8' : '#1e293b'}`,
                          borderRadius: '8px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
                            {tpl.shapeCode}
                          </span>
                          {isSelected && <Check size={14} color="#38bdf8" />}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                          {tpl.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {tpl.category}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Metadata inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="shape-info-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Shape Name *
                </label>
                <input
                  type="text"
                  required
                  className="shape-param-input"
                  style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px' }}
                  value={shapeName}
                  onChange={(e) => setShapeName(e.target.value)}
                  placeholder="e.g. Column Stirrup 135°"
                />
              </div>

              <div>
                <label className="shape-info-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Category *
                </label>
                <select
                  className="cad-rule-select"
                  style={{ width: '100%', padding: '8px 12px', background: '#030712', border: '1px solid #334155', color: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {SHAPE_CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="shape-info-label" style={{ display: 'block', marginBottom: '4px' }}>
                Engineering Description
              </label>
              <textarea
                className="shape-param-input"
                style={{ width: '100%', height: '60px', textAlign: 'left', padding: '8px 12px', fontSize: '13px', resize: 'none' }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes regarding standard code, bar placement, or hooks..."
              />
            </div>

            <div>
              <label className="shape-info-label" style={{ display: 'block', marginBottom: '4px' }}>
                Tags (comma separated)
              </label>
              <input
                type="text"
                className="shape-param-input"
                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px' }}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. stirrup, beam, 135-hook"
              />
            </div>
          </div>

          <footer className="shape-details-footer">
            <button type="button" className="shape-btn shape-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="shape-btn shape-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} />
              <span>Create & Open in CAD Workspace</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

