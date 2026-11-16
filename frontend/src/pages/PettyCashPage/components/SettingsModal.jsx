import React, { useState } from 'react';
import { Settings as SettingsIcon, Tag, Users, Plus, Trash2, X } from 'lucide-react';
import { Input } from '../../../components/ui';

export default function SettingsModal({
  isOpen,
  onClose,
  categories = [],
  persons = [],
  onAddCategory,
  onDeleteCategory,
  onAddPerson,
  onDeletePerson
}) {
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'persons'
  const [newCatName, setNewCatName] = useState('');
  const [newSubcatInput, setNewSubcatInput] = useState('');
  const [newPersonForm, setNewPersonForm] = useState({ name: '', roleOrTitle: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsSubmitting(true);
    try {
      const subcats = newSubcatInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      await onAddCategory(newCatName.trim(), subcats);
      setNewCatName('');
      setNewSubcatInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePersonSubmit = async (e) => {
    e.preventDefault();
    if (!newPersonForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddPerson(newPersonForm);
      setNewPersonForm({ name: '', roleOrTitle: '', phone: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pc-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pc-modal-card pc-modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pc-modal-header">
          <div className="pc-modal-title-row">
            <div className="pc-modal-icon-badge">
              <SettingsIcon size={18} />
            </div>
            <div>
              <h3>Petty Cash Settings</h3>
              <p className="pc-modal-subtitle">Configure construction expense categories and money providers</p>
            </div>
          </div>
          <button
            type="button"
            className="pc-btn-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="pc-settings-tabs-bar">
          <button
            type="button"
            className={`pc-settings-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <Tag size={16} />
            <span>Categories & Subcategories ({categories.length})</span>
          </button>
          <button
            type="button"
            className={`pc-settings-tab-btn ${activeTab === 'persons' ? 'active' : ''}`}
            onClick={() => setActiveTab('persons')}
          >
            <Users size={16} />
            <span>Money Providers ({persons.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="pc-settings-body">
          {activeTab === 'categories' ? (
            <div className="pc-settings-pane">
              {/* Add Category Form */}
              <form onSubmit={handleCatSubmit} className="pc-settings-form-box">
                <h4 className="pc-settings-form-title">+ Add New Expense Category</h4>
                <div className="pc-form-row pc-form-grid-2">
                  <div className="pc-form-group">
                    <label>Category Name <span className="pc-req">*</span></label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. Safety & Equipment"
                      className="pc-input"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                    />
                  </div>
                  <div className="pc-form-group">
                    <label>Subcategories (Comma separated)</label>
                    <Input
                      type="text"
                      placeholder="e.g. Helmets, Safety Shoes, Vests"
                      className="pc-input"
                      value={newSubcatInput}
                      onChange={(e) => setNewSubcatInput(e.target.value)}
                    />
                  </div>
                </div>
                <div className="pc-settings-form-actions">
                  <button type="submit" className="pc-btn-primary pc-btn-sm" disabled={isSubmitting}>
                    <Plus size={15} />
                    <span>{isSubmitting ? 'Adding...' : 'Add Category'}</span>
                  </button>
                </div>
              </form>

              {/* Categories List */}
              <div className="pc-settings-list-section">
                <h4 className="pc-settings-list-title">Configured Categories</h4>
                <div className="pc-cat-grid">
                  {categories.map((c) => (
                    <div key={c.id || c.name} className="pc-cat-card">
                      <div className="pc-cat-header">
                        <span className="pc-cat-name">{c.name}</span>
                        <button
                          type="button"
                          className="pc-btn-trash-sm"
                          onClick={() => onDeleteCategory(c.id)}
                          title="Delete category"
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {c.subcategories && c.subcategories.length > 0 ? (
                        <div className="pc-subcat-chips-wrap">
                          {c.subcategories.map((sub, i) => (
                            <span key={i} className="pc-subcat-chip">{sub}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="pc-text-muted pc-text-xs">No subcategories</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="pc-settings-pane">
              {/* Add Person Form */}
              <form onSubmit={handlePersonSubmit} className="pc-settings-form-box">
                <h4 className="pc-settings-form-title">+ Add Money Provider (Person)</h4>
                <div className="pc-form-row pc-form-grid-3">
                  <div className="pc-form-group">
                    <label>Full Name <span className="pc-req">*</span></label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Patel"
                      className="pc-input"
                      value={newPersonForm.name}
                      onChange={(e) => setNewPersonForm({ ...newPersonForm, name: e.target.value })}
                    />
                  </div>
                  <div className="pc-form-group">
                    <label>Role / Title</label>
                    <Input
                      type="text"
                      placeholder="e.g. Managing Director"
                      className="pc-input"
                      value={newPersonForm.roleOrTitle}
                      onChange={(e) => setNewPersonForm({ ...newPersonForm, roleOrTitle: e.target.value })}
                    />
                  </div>
                  <div className="pc-form-group">
                    <label>Phone Number</label>
                    <Input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      className="pc-input"
                      value={newPersonForm.phone}
                      onChange={(e) => setNewPersonForm({ ...newPersonForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pc-settings-form-actions">
                  <button type="submit" className="pc-btn-primary pc-btn-sm" disabled={isSubmitting}>
                    <Plus size={15} />
                    <span>{isSubmitting ? 'Adding...' : 'Add Provider'}</span>
                  </button>
                </div>
              </form>

              {/* Persons List */}
              <div className="pc-settings-list-section">
                <h4 className="pc-settings-list-title">Reusable Money Providers List</h4>
                <div className="pc-persons-list">
                  {persons.map((p) => (
                    <div key={p.id || p.name} className="pc-person-item">
                      <div className="pc-person-item-info">
                        <span className="pc-person-item-name">{p.name}</span>
                        {p.roleOrTitle && (
                          <span className="pc-person-item-role">{p.roleOrTitle}</span>
                        )}
                        {p.phone && (
                          <span className="pc-person-item-phone">{p.phone}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="pc-btn-trash-sm"
                        onClick={() => onDeletePerson(p.id)}
                        title="Remove provider"
                        aria-label={`Remove ${p.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

