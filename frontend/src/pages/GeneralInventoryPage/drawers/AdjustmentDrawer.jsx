import React, { useState, useEffect } from 'react';
import { RefreshCw, Store } from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';
import MaterialSearchSelect from '../components/MaterialSearchSelect';
import { Input, Select, Textarea } from '../../../components/ui';

export default function AdjustmentDrawer({
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
  const [adjustmentType, setAdjustmentType] = useState('ADD');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setStoreId(selectedStoreId || stores[0]?.id || stores[0]?._id || '');
      setMaterialId('');
      setAdjustmentType('ADD');
      setQuantity('1');
      setReason('');
      setFormErrors({});
    }
  }, [isOpen, selectedStoreId, stores]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!storeId) errors.storeId = 'Store is required';
    if (!materialId) errors.materialId = 'Please select a material';
    const num = parseFloat(quantity);
    if (!num || num <= 0) errors.quantity = 'Quantity must be greater than 0';
    if (!reason.trim()) errors.reason = 'Adjustment reason is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    onSubmit({
      storeId,
      materialId,
      adjustmentType,
      quantity: num,
      reason: reason.trim()
    });
  };

  return (
    <InventoryDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Authorized Stock Adjustment"
      subtitle="Reconcile system inventory with authorized write-off or found stock"
      icon={RefreshCw}
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
            {isSubmitting ? 'Adjusting...' : 'Confirm Adjustment'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="gi-drawer-form">
        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Store <span className="gi-required">*</span>
            </label>
            <Select
              className={`gi-input-field ${formErrors.storeId ? 'has-error' : ''}`}
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              <option value="">Select Store...</option>
              {stores.map((s) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="gi-form-group">
            <label className="gi-form-label">Adjustment Type</label>
            <Select
              className="gi-input-field"
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value)}
            >
              <option value="ADD">+ Increase System Stock (Found / Excess)</option>
              <option value="SUBTRACT">− Decrease System Stock (Write-off / Scrap)</option>
            </Select>
          </div>
        </div>

        <MaterialSearchSelect
          materials={materials}
          selectedMaterialId={materialId}
          onSelect={(mat) => setMaterialId(mat ? mat.id || mat._id : '')}
          label="Material to Adjust"
          required={true}
          error={formErrors.materialId}
        />

        <div className="gi-form-group">
          <label className="gi-form-label">
            Adjustment Quantity <span className="gi-required">*</span>
          </label>
          <Input
            type="number"
            step="any"
            min="0.01"
            className={`gi-input-field ${formErrors.quantity ? 'has-error' : ''}`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {formErrors.quantity && <div className="gi-field-error-msg">{formErrors.quantity}</div>}
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">
            Authorization Reason & Reference <span className="gi-required">*</span>
          </label>
          <Textarea
            className={`gi-textarea-field ${formErrors.reason ? 'has-error' : ''}`}
            rows={2}
            placeholder="e.g. Approved physical audit reconciliation by PM, Scrap write-off..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {formErrors.reason && <div className="gi-field-error-msg">{formErrors.reason}</div>}
        </div>
      </form>
    </InventoryDrawer>
  );
}

