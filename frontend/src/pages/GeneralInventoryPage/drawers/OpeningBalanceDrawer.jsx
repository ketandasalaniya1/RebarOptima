import React, { useState, useEffect } from 'react';
import { Package, Store } from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';

export default function OpeningBalanceDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  openingMaterial = null,
  stores = [],
  selectedStoreId = ''
}) {
  const [storeId, setStoreId] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setStoreId(selectedStoreId || stores[0]?.id || stores[0]?._id || '');
      setQuantity('0');
      setRemarks('Initial site handover balance');
      setFormErrors({});
    }
  }, [isOpen, selectedStoreId, stores]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!storeId) errors.storeId = 'Please select a store';
    const num = parseFloat(quantity);
    if (isNaN(num) || num < 0) errors.quantity = 'Please enter a valid non-negative quantity';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    onSubmit({
      storeId,
      materialId: openingMaterial.id || openingMaterial._id,
      quantity: num,
      remarks: remarks.trim()
    });
  };

  return (
    <InventoryDrawer
      isOpen={isOpen && Boolean(openingMaterial)}
      onClose={onClose}
      title="Set Opening Stock Balance"
      subtitle={`Establish baseline starting stock for "${openingMaterial?.name}"`}
      icon={Package}
      width="480px"
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
            {isSubmitting ? 'Updating...' : 'Set Opening Balance'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="gi-drawer-form">
        {openingMaterial && (
          <div className="gi-selected-material-card" style={{ marginBottom: '1.25rem' }}>
            <div className="gi-selected-material-icon">
              <Package size={20} />
            </div>
            <div className="gi-selected-material-info">
              <div className="gi-selected-material-title">
                <strong>{openingMaterial.name}</strong>
              </div>
              <div className="gi-selected-material-meta">
                <span>{openingMaterial.category}</span>
                <span>•</span>
                <span>Current: {openingMaterial.currentStock ?? 0} {openingMaterial.uom}</span>
              </div>
            </div>
          </div>
        )}

        <div className="gi-form-group">
          <label className="gi-form-label">
            Target Godown / Store <span className="gi-required">*</span>
          </label>
          <div className="gi-select-with-icon">
            <Store size={16} className="gi-input-icon" />
            <select
              className={`gi-input-field with-icon ${formErrors.storeId ? 'has-error' : ''}`}
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              <option value="">Select Godown...</option>
              {stores.map((s) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.name} {s.isDefault ? '(Main)' : ''}
                </option>
              ))}
            </select>
          </div>
          {formErrors.storeId && <div className="gi-field-error-msg">{formErrors.storeId}</div>}
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">
            Opening Quantity ({openingMaterial?.uom || 'units'}) <span className="gi-required">*</span>
          </label>
          <input
            type="number"
            step="any"
            min="0"
            className={`gi-input-field ${formErrors.quantity ? 'has-error' : ''}`}
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {formErrors.quantity && <div className="gi-field-error-msg">{formErrors.quantity}</div>}
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">Reason / Remarks</label>
          <textarea
            className="gi-textarea-field"
            rows={2}
            placeholder="e.g. Audit verification count, site handover stock..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </form>
    </InventoryDrawer>
  );
}

