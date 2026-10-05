import React, { useState, useEffect } from 'react';
import { createLineObject, createPolylineObject, createRectangleObject, createCircleObject } from './cad/geometry';
import './ShapeLibrary.css';

// Pre-defined Standard Rebar Shapes (BS 8666 / IS 2502)
const STANDARD_SHAPES = [
  {
    id: 'std_00',
    name: 'Straight Bar',
    code: 'Shape 00',
    category: 'Standard Rebar',
    isStandard: true,
    geometry: {
      objects: [
        createLineObject({ x: -150, y: 0 }, { x: 150, y: 0 })
      ]
    }
  },
  {
    id: 'std_11',
    name: 'L-Bend Bar',
    code: 'Shape 11',
    category: 'Standard Rebar',
    isStandard: true,
    geometry: {
      objects: [
        createPolylineObject([
          { x: -100, y: 100 },
          { x: -100, y: -50 },
          { x: 120, y: -50 }
        ])
      ]
    }
  },
  {
    id: 'std_21',
    name: 'U-Hook Bar',
    code: 'Shape 21',
    category: 'Standard Rebar',
    isStandard: true,
    geometry: {
      objects: [
        createPolylineObject([
          { x: -100, y: 80 },
          { x: -100, y: -50 },
          { x: 100, y: -50 },
          { x: 100, y: 80 }
        ])
      ]
    }
  },
  {
    id: 'std_51',
    name: 'Rectangular Stirrup / Link',
    code: 'Shape 51',
    category: 'Stirrups / Links',
    isStandard: true,
    geometry: {
      objects: [
        createPolylineObject([
          { x: 0, y: 70 },
          { x: -120, y: 70 },
          { x: -120, y: -70 },
          { x: 120, y: -70 },
          { x: 120, y: 70 },
          { x: -20, y: 70 },
          { x: -50, y: 40 }
        ])
      ]
    }
  },
  {
    id: 'std_41',
    name: 'Crank Bar',
    code: 'Shape 41',
    category: 'Standard Rebar',
    isStandard: true,
    geometry: {
      objects: [
        createPolylineObject([
          { x: -140, y: -40 },
          { x: -30, y: -40 },
          { x: 30, y: 40 },
          { x: 140, y: 40 }
        ])
      ]
    }
  },
  {
    id: 'std_77',
    name: 'Circular Hoop / Spiral',
    code: 'Shape 77',
    category: 'Stirrups / Links',
    isStandard: true,
    geometry: {
      objects: [
        createCircleObject({ x: 0, y: 0 }, 75)
      ]
    }
  }
];

export default function ShapeLibrary({
  customShapes = [],
  onCreateNewShape,
  onOpenInCAD,
  onDeleteShape
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Standard Rebar', 'Stirrups / Links', 'Custom Drafts'];

  const filteredStandard = STANDARD_SHAPES.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredCustom = customShapes.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || selectedCategory === 'Custom Drafts' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Simple Mini Preview SVG Renderer for Shape Cards
  const renderMiniPreview = (shape) => {
    const objects = shape.geometry?.objects || [];
    return (
      <svg width="100%" height="100%" viewBox="-180 -100 360 200" style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        <line x1="-160" y1="0" x2="160" y2="0" stroke="rgba(51, 65, 85, 0.4)" strokeDasharray="3 3" />
        <line x1="0" y1="-80" x2="0" y2="80" stroke="rgba(51, 65, 85, 0.4)" strokeDasharray="3 3" />

        {objects.map((obj, i) => {
          if (obj.type === 'line') {
            return (
              <line
                key={i}
                x1={obj.p1.x}
                y1={-obj.p1.y}
                x2={obj.p2.x}
                y2={-obj.p2.y}
                stroke="#38bdf8"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            );
          }
          if (obj.type === 'polyline') {
            const pts = obj.points.map(p => `${p.x},${-p.y}`).join(' ');
            return (
              <polyline
                key={i}
                points={pts}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }
          if (obj.type === 'rectangle') {
            return (
              <rect
                key={i}
                x={obj.x}
                y={-(obj.y + obj.height)}
                width={obj.width}
                height={obj.height}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
            );
          }
          if (obj.type === 'circle') {
            return (
              <circle
                key={i}
                cx={obj.center.x}
                cy={-obj.center.y}
                r={obj.radius}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3.5"
              />
            );
          }
          return null;
        })}
      </svg>
    );
  };

  return (
    <div className="shape-library-container">
      {/* Header */}
      <header className="shape-library-header">
        <div className="shape-header-info">
          <h1>BBS Shape Library</h1>
          <p>Standard BS 8666 / IS 2502 shapes & interactive parametric CAD blocks</p>
        </div>

        <button className="shape-create-btn" onClick={onCreateNewShape}>
          <span>+</span> Create New Shape
        </button>
      </header>

      {/* Filter / Search Bar */}
      <div className="shape-controls-bar">
        <div className="shape-filter-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`shape-tab-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="shape-search-input"
          placeholder="Search shape by name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Custom User Shapes Section */}
      {(selectedCategory === 'All' || selectedCategory === 'Custom Drafts') && (
        <section>
          <div className="shape-section-title">
            <span>Custom Parametric Shapes</span>
            <span className="shape-section-badge">{filteredCustom.length}</span>
          </div>

          {filteredCustom.length === 0 ? (
            <div className="shape-empty-state">
              <p>No custom shapes saved yet. Click <strong>+ Create New Shape</strong> to open the CAD Workspace and draw your first shape.</p>
            </div>
          ) : (
            <div className="shape-grid">
              {filteredCustom.map(shape => (
                <div key={shape.id} className="shape-card">
                  <div className="shape-card-preview">
                    {renderMiniPreview(shape)}
                  </div>
                  <div className="shape-card-body">
                    <div className="shape-card-header">
                      <h3 className="shape-card-title">{shape.name}</h3>
                      <span className="shape-card-code">{shape.code || 'CUSTOM'}</span>
                    </div>
                    <div className="shape-card-meta">
                      {shape.geometry?.objects?.length || 0} geometry elements • {shape.unit || 'mm'}
                    </div>
                    <div className="shape-card-actions">
                      <button className="shape-action-btn" onClick={() => onOpenInCAD(shape)}>
                        ✏️ Open in CAD
                      </button>
                      {onDeleteShape && (
                        <button className="shape-action-delete" onClick={() => onDeleteShape(shape.id)} title="Delete Shape">
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Standard Library Section */}
      {selectedCategory !== 'Custom Drafts' && (
        <section>
          <div className="shape-section-title">
            <span>Standard Shape Catalog</span>
            <span className="shape-section-badge">{filteredStandard.length}</span>
          </div>

          <div className="shape-grid">
            {filteredStandard.map(shape => (
              <div key={shape.id} className="shape-card">
                <div className="shape-card-preview">
                  {renderMiniPreview(shape)}
                </div>
                <div className="shape-card-body">
                  <div className="shape-card-header">
                    <h3 className="shape-card-title">{shape.name}</h3>
                    <span className="shape-card-code">{shape.code}</span>
                  </div>
                  <div className="shape-card-meta">
                    {shape.category} • {shape.geometry?.objects?.length || 0} elements
                  </div>
                  <div className="shape-card-actions">
                    <button className="shape-action-btn" onClick={() => onOpenInCAD(shape)}>
                      📐 Open & Customize in CAD
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
