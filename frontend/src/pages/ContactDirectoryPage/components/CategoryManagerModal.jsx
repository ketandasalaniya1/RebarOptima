import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { contactsApi } from '../../../utils/contactsApi';

export default function CategoryManagerModal({
  isOpen,
  onClose,
  onCategoriesChanged,
}) {
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await contactsApi.getCategories();
      setCategories(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setNewCatName('');
      setEditingId(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      setErrorMsg('');
      await contactsApi.createCategory(newCatName.trim());
      setNewCatName('');
      await loadCategories();
      onCategoriesChanged?.();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add category');
    }
  };

  const handleStartEdit = (cat) => {
    setEditingId(cat.id || cat._id);
    setEditName(cat.name);
  };

  const handleSaveEdit = async (catId) => {
    if (!editName.trim()) return;
    try {
      setErrorMsg('');
      await contactsApi.updateCategory(catId, editName.trim());
      setEditingId(null);
      await loadCategories();
      onCategoriesChanged?.();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update category');
    }
  };

  const handleDelete = async (catId) => {
    try {
      setErrorMsg('');
      await contactsApi.deleteCategory(catId);
      await loadCategories();
      onCategoriesChanged?.();
    } catch (err) {
      setErrorMsg(err.message || 'Cannot delete category');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ro-modal-backdrop" onClick={onClose}>
      <div className="ro-modal-container ro-cat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ro-modal-header">
          <div className="ro-modal-title-group">
            <Tag size={18} className="ro-modal-icon" />
            <div>
              <h3 className="ro-modal-title">Manage Contact Categories</h3>
              <p className="ro-modal-subtitle">
                Configure stakeholder categories for contractors, suppliers, staff, and partners
              </p>
            </div>
          </div>
          <button type="button" className="ro-modal-btn-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="ro-modal-body">
          {errorMsg && (
            <div className="ro-form-error-alert">
              <AlertTriangle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Add Category Input */}
          <form onSubmit={handleAddCategory} className="ro-add-cat-bar">
            <input
              type="text"
              placeholder="e.g. Transporter, Electrical Agency, Consultant…"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="ro-input"
            />
            <button type="submit" className="ro-btn ro-btn--primary" disabled={!newCatName.trim()}>
              <Plus size={14} />
              <span>Add Category</span>
            </button>
          </form>

          {/* Categories List */}
          <div className="ro-cat-list-wrapper">
            <h4 className="ro-cat-list-heading">Available Categories ({categories.length})</h4>
            <div className="ro-cat-items-list">
              {categories.map((cat) => {
                const cId = cat.id || cat._id;
                const isItemEditing = editingId === cId;

                return (
                  <div key={cId} className="ro-cat-item-row">
                    {isItemEditing ? (
                      <div className="ro-cat-edit-group">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="ro-input ro-input-sm"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="ro-btn-cat-save"
                          onClick={() => handleSaveEdit(cId)}
                          title="Save changes"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          className="ro-btn-cat-cancel"
                          onClick={() => setEditingId(null)}
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="ro-cat-name-group">
                          <span className="ro-cat-name">{cat.name}</span>
                          {cat.isDefault && <span className="ro-cat-default-badge">System Default</span>}
                        </div>

                        <div className="ro-cat-actions-group">
                          <button
                            type="button"
                            className="ro-btn-cat-act"
                            onClick={() => handleStartEdit(cat)}
                            title="Rename category"
                          >
                            <Edit2 size={13} />
                          </button>

                          {!cat.isDefault && (
                            <button
                              type="button"
                              className="ro-btn-cat-act text-danger"
                              onClick={() => handleDelete(cId)}
                              title="Delete category"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="ro-modal-footer">
          <button type="button" className="ro-btn ro-btn--secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

