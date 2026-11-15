import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Store, Calendar } from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';
import MaterialSearchSelect from '../components/MaterialSearchSelect';

export default function StockVerificationDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  materials = [],
  stores = [],
  selectedStoreId = ''
}) {
  const [storeId, setStoreId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [physicalQuantity, setPhysicalQuantity] = useState('0');
  const [verificationDate, setVerificationDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setStoreId(selectedStoreId || stores[0]?.id || stores[0]?._id || '');
      setMaterialId('');
      setPhysicalQuantity('0');
      setVerificationDate(new Date().toISOString().split('T')[0]);
      setRemarks('');
      setFormErrors({});
    }
  }, [isOpen, selectedStoreId, stores]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!storeId) errors.storeId = 'Store is required';
    if (!materialId) errors.materialId = 'Please select a material';
    const num = parseFloat(physicalQuantity);
    if (isNaN(num) || num < 0) errors.physicalQuantity = 'Physical count must be a non-negative number';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    onSubmit({
      storeId,
      materialId,
      physicalQuantity: num,
      verificationDate,
      remarks: remarks.trim()
    });
  };

  return (
    <InventoryDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Physical Stock Verification Audit"
      subtitle="Count on-site stock and record physical variance against system balance"
      icon={ClipboardCheck}
      width="500px"
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
            {isSubmitting ? 'Recording...' : 'Submit Audit Count'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="gi-drawer-form">
        <div className="gi-form-group">
          <label className="gi-form-label">
            Godown / Store <span className="gi-required">*</span>
          </label>
          <select
            className={`gi-input-field ${formErrors.storeId ? 'has-error' : ''}`}
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">Select Godown...</option>
            {stores.map((s) => (
              <option key={s.id || s._id} value={s.id || s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <MaterialSearchSelect
          materials={materials}
          selectedMaterialId={materialId}
          onSelect={(mat) => setMaterialId(mat ? mat.id || mat._id : '')}
          label="Material Counted"
          required={true}
          error={formErrors.materialId}
        />

        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Physical Count Observed <span className="gi-required">*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              className={`gi-input-field ${formErrors.physicalQuantity ? 'has-error' : ''}`}
              value={physicalQuantity}
              onChange={(e) => setPhysicalQuantity(e.target.value)}
            />
            {formErrors.physicalQuantity && (
              <div className="gi-field-error-msg">{formErrors.physicalQuantity}</div>
            )}
          </div>

          <div className="gi-form-group">
            <label className="gi-form-label">Audit Date</label>
            <input
              type="date"
              className="gi-input-field"
              value={verificationDate}
              onChange={(e) => setVerificationDate(e.target.value)}
            />
          </div>
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">Audit Notes & Observations</label>
          <textarea
            className="gi-textarea-field"
            rows={2}
            placeholder="Visual condition, location within shed, counting method..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </form>
    </InventoryDrawer>
  );
}

