import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Package, Check, X, AlertCircle } from 'lucide-react';
import { Input } from '../../../components/ui';

export default function MaterialSearchSelect({
  materials = [],
  selectedMaterialId = '',
  onSelect,
  placeholder = 'Search material by name or code...',
  label = 'Material',
  required = true,
  error = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selectedMaterial = useMemo(() => {
    return materials.find((m) => (m.id || m._id) === selectedMaterialId);
  }, [materials, selectedMaterialId]);

  // Filter materials based on search query
  const filteredMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return materials.slice(0, 50); // show top 50 if no search
    return materials.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const code = (m.materialCode || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      const spec = (m.sizeOrSpec || '').toLowerCase();
      return name.includes(query) || code.includes(query) || cat.includes(query) || spec.includes(query);
    });
  }, [materials, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (mat) => {
    onSelect(mat);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onSelect(null);
    setSearchQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="gi-form-group" ref={wrapperRef} style={{ position: 'relative' }}>
      <label className="gi-form-label">
        {label} {required && <span className="gi-required">*</span>}
      </label>

      {/* Selected Material Chip View */}
      {selectedMaterial ? (
        <div className="gi-selected-material-card">
          <div className="gi-selected-material-icon">
            <Package size={18} />
          </div>
          <div className="gi-selected-material-info">
            <div className="gi-selected-material-title">
              <strong>{selectedMaterial.name}</strong>
              {selectedMaterial.materialCode && (
                <span className="gi-code-tag">{selectedMaterial.materialCode}</span>
              )}
            </div>
            <div className="gi-selected-material-meta">
              <span>{selectedMaterial.category || 'General'}</span>
              <span>•</span>
              <span className={`gi-stock-pill ${selectedMaterial.currentStock <= 0 ? 'out' : selectedMaterial.status === 'LOW_STOCK' ? 'low' : 'normal'}`}>
                Stock: {selectedMaterial.currentStock ?? 0} {selectedMaterial.uom}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="gi-btn-change-material"
            onClick={handleClear}
            title="Change material"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        /* Search Input */
        <div className="gi-material-search-input-wrapper">
          <Search size={18} className="gi-search-icon-inside" />
          <Input
            ref={inputRef}
            type="text"
            className={`gi-input-field search-input ${error ? 'has-error' : ''}`}
            placeholder={placeholder}
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
          />
        </div>
      )}

      {/* Search dropdown list */}
      {isOpen && !selectedMaterial && (
        <div className="gi-material-dropdown-list">
          {filteredMaterials.length === 0 ? (
            <div className="gi-dropdown-empty">
              <AlertCircle size={16} />
              <span>No materials matching "{searchQuery}"</span>
            </div>
          ) : (
            filteredMaterials.map((m) => {
              const isOut = (m.currentStock ?? 0) <= 0;
              const isLow = m.status === 'LOW_STOCK';
              return (
                <div
                  key={m.id || m._id}
                  className="gi-dropdown-item"
                  onClick={() => handleSelect(m)}
                >
                  <div className="gi-dropdown-item-main">
                    <span className="gi-dropdown-item-name">{m.name}</span>
                    {m.materialCode && (
                      <span className="gi-dropdown-item-code">({m.materialCode})</span>
                    )}
                    <span className="gi-dropdown-item-cat">{m.category}</span>
                  </div>
                  <div className="gi-dropdown-item-stock">
                    <span
                      className={`gi-stock-pill ${isOut ? 'out' : isLow ? 'low' : 'normal'}`}
                    >
                      {m.currentStock ?? 0} {m.uom}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {error && <div className="gi-field-error-msg">{error}</div>}
    </div>
  );
}

