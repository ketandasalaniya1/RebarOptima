import React, { useState } from 'react';
import { Building2, X } from 'lucide-react';
import { Input } from '../../../components/ui';

export default function NewSiteModal({ isOpen, onClose, onCreateSite }) {
  const [siteForm, setSiteForm] = useState({ name: '', code: '', location: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!siteForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateSite(siteForm);
      setSiteForm({ name: '', code: '', location: '' });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pc-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pc-modal-card pc-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="pc-modal-header">
          <div className="pc-modal-title-row">
            <div className="pc-modal-icon-badge">
              <Building2 size={18} />
            </div>
            <div>
              <h3>Add Construction Site</h3>
              <p className="pc-modal-subtitle">Create a dedicated petty cash float for this site</p>
            </div>
          </div>
          <button type="button" className="pc-btn-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pc-modal-body pc-form-stack">
          <div className="pc-form-group">
            <label>Site / Project Name <span className="pc-req">*</span></label>
            <Input
              type="text"
              required
              placeholder="e.g. Skyrise Commercial Tower"
              className="pc-input"
              value={siteForm.name}
              onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="pc-form-group">
            <label>Site Code (Optional)</label>
            <Input
              type="text"
              placeholder="e.g. SK-01"
              className="pc-input"
              value={siteForm.code}
              onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })}
            />
          </div>

          <div className="pc-form-group">
            <label>Location / Address (Optional)</label>
            <Input
              type="text"
              placeholder="e.g. Sector 26, Gandhinagar"
              className="pc-input"
              value={siteForm.location}
              onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })}
            />
          </div>

          <div className="pc-modal-footer">
            <button type="button" className="pc-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="pc-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

