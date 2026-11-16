import React, { useState, useEffect } from 'react';
import { Store, MapPin } from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';
import { Input } from '../../../components/ui';

export default function StoreFormDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  defaultLocation = ''
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCode('');
      setLocation(defaultLocation || '');
      setFormErrors({});
    }
  }, [isOpen, defaultLocation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!name.trim()) errors.name = 'Store/godown name is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    onSubmit({
      name: name.trim(),
      code: code.trim(),
      location: location.trim()
    });
  };

  return (
    <InventoryDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Store / Godown"
      subtitle="Register an on-site storage area, yard, container or shed"
      icon={Store}
      width="460px"
      footer={
        <div className="gi-drawer-footer-actions">
          <button
            type="button"
            className="gi-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="gi-btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Store'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="gi-drawer-form">
        <div className="gi-form-group">
          <label className="gi-form-label">
            Store Name <span className="gi-required">*</span>
          </label>
          <Input
            type="text"
            className={`gi-input-field ${formErrors.name ? 'has-error' : ''}`}
            placeholder="e.g. Main Godown, Shed B, North Yard..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {formErrors.name && <div className="gi-field-error-msg">{formErrors.name}</div>}
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">Store Code</label>
          <Input
            type="text"
            className="gi-input-field"
            placeholder="e.g. GDN-01, SHED-A"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">Location on Site</label>
          <div className="gi-select-with-icon">
            <MapPin size={16} className="gi-input-icon" />
            <Input
              type="text"
              className="gi-input-field with-icon"
              placeholder="e.g. Gate 2 near Batching Plant, Basement 1"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
      </form>
    </InventoryDrawer>
  );
}

