import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Store, Calendar } from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';
import MaterialSearchSelect from '../components/MaterialSearchSelect';

export default function TransferDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  materials = [],
  stores = [],
  selectedStoreId = ''
}) {
  const [sourceStoreId, setSourceStoreId] = useState('');
  const [destinationStoreId, setDestinationStoreId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      const src = selectedStoreId || stores[0]?.id || stores[0]?._id || '';
      setSourceStoreId(src);
      const dest = stores.find((s) => (s.id || s._id) !== src);
      setDestinationStoreId(dest ? dest.id || dest._id : '');
      setMaterialId('');
      setQuantity('1');
      setTransferDate(new Date().toISOString().split('T')[0]);
      setReference('');
      setRemarks('');
      setFormErrors({});
    }
  }, [isOpen, selectedStoreId, stores]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!sourceStoreId) errors.sourceStoreId = 'Source store is required';
    if (!destinationStoreId) errors.destinationStoreId = 'Destination store is required';
    if (sourceStoreId === destinationStoreId) {
      errors.destinationStoreId = 'Source and destination cannot be the same';
    }
    if (!materialId) errors.materialId = 'Please select a material';
    const num = parseFloat(quantity);
    if (!num || num <= 0) errors.quantity = 'Quantity must be greater than 0';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    onSubmit({
      sourceStoreId,
      destinationStoreId,
      materialId,
      quantity: num,
      transferDate,
      reference: reference.trim(),
      remarks: remarks.trim()
    });
  };

  return (
    <InventoryDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Inter-Store Stock Transfer"
      subtitle="Relocate stock between site godowns, yards, or storage sheds"
      icon={ArrowRightLeft}
      width="520px"
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
            {isSubmitting ? 'Transferring...' : 'Execute Transfer'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="gi-drawer-form">
        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Source Store <span className="gi-required">*</span>
            </label>
            <select
              className={`gi-input-field ${formErrors.sourceStoreId ? 'has-error' : ''}`}
              value={sourceStoreId}
              onChange={(e) => setSourceStoreId(e.target.value)}
            >
              <option value="">Select Source...</option>
              {stores.map((s) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            {formErrors.sourceStoreId && <div className="gi-field-error-msg">{formErrors.sourceStoreId}</div>}
          </div>

          <div className="gi-form-group">
            <label className="gi-form-label">
              Destination Store <span className="gi-required">*</span>
            </label>
            <select
              className={`gi-input-field ${formErrors.destinationStoreId ? 'has-error' : ''}`}
              value={destinationStoreId}
              onChange={(e) => setDestinationStoreId(e.target.value)}
            >
              <option value="">Select Destination...</option>
              {stores.map((s) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            {formErrors.destinationStoreId && <div className="gi-field-error-msg">{formErrors.destinationStoreId}</div>}
          </div>
        </div>

        <MaterialSearchSelect
          materials={materials}
          selectedMaterialId={materialId}
          onSelect={(mat) => setMaterialId(mat ? mat.id || mat._id : '')}
          label="Material to Transfer"
          required={true}
          error={formErrors.materialId}
        />

        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Quantity to Transfer <span className="gi-required">*</span>
            </label>
            <input
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
            <label className="gi-form-label">Transfer Date</label>
            <input
              type="date"
              className="gi-input-field"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
            />
          </div>
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">Transfer Note / Reference #</label>
          <input
            type="text"
            className="gi-input-field"
            placeholder="e.g. TR-2026-081"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">Remarks</label>
          <textarea
            className="gi-textarea-field"
            rows={2}
            placeholder="Reason for transfer, vehicle number, handler..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </form>
    </InventoryDrawer>
  );
}

