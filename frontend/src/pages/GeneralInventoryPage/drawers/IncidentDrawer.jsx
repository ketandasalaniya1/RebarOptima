import React, { useState, useEffect } from 'react';
import { ShieldAlert, Store, Calendar, User } from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';
import MaterialSearchSelect from '../components/MaterialSearchSelect';
import { Input, Select, Textarea } from '../../../components/ui';

export default function IncidentDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  materials = [],
  stores = [],
  selectedStoreId = '',
  currentUser
}) {
  const [storeId, setStoreId] = useState('');
  const [incidentType, setIncidentType] = useState('Missing');
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportedBy, setReportedBy] = useState('');
  const [description, setDescription] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setStoreId(selectedStoreId || stores[0]?.id || stores[0]?._id || '');
      setIncidentType('Missing');
      setMaterialId('');
      setQuantity('1');
      setDate(new Date().toISOString().split('T')[0]);
      setReportedBy(currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : 'Store Incharge');
      setDescription('');
      setFormErrors({});
    }
  }, [isOpen, selectedStoreId, stores, currentUser]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!storeId) errors.storeId = 'Store is required';
    if (!materialId) errors.materialId = 'Please select a material';
    const num = parseFloat(quantity);
    if (!num || num <= 0) errors.quantity = 'Quantity must be greater than 0';
    if (!description.trim()) errors.description = 'Please provide incident details';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    onSubmit({
      storeId,
      incidentType,
      materialId,
      quantity: num,
      date,
      reportedBy: reportedBy.trim(),
      description: description.trim()
    });
  };

  return (
    <InventoryDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Report Stock Incident / Loss"
      subtitle="Log broken, lost, damaged or stolen materials for investigation"
      icon={ShieldAlert}
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
            style={{ background: '#dc2626' }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Reporting...' : 'Submit Incident Report'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="gi-drawer-form">
        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Godown / Store <span className="gi-required">*</span>
            </label>
            <Select
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
            </Select>
          </div>

          <div className="gi-form-group">
            <label className="gi-form-label">Incident Type</label>
            <Select
              className="gi-input-field"
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
            >
              <option value="Missing">Missing / Untraceable</option>
              <option value="Damaged">Damaged / Broken On-site</option>
              <option value="Theft">Suspected Theft</option>
              <option value="Expired">Expired / Spoilage</option>
            </Select>
          </div>
        </div>

        <MaterialSearchSelect
          materials={materials}
          selectedMaterialId={materialId}
          onSelect={(mat) => setMaterialId(mat ? mat.id || mat._id : '')}
          label="Affected Material"
          required={true}
          error={formErrors.materialId}
        />

        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Affected Quantity <span className="gi-required">*</span>
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
            <label className="gi-form-label">Incident Date</label>
            <Input
              type="date"
              className="gi-input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">Reported By</label>
          <Input
            type="text"
            className="gi-input-field"
            value={reportedBy}
            onChange={(e) => setReportedBy(e.target.value)}
          />
        </div>

        <div className="gi-form-group">
          <label className="gi-form-label">
            Incident Description & Circumstances <span className="gi-required">*</span>
          </label>
          <Textarea
            className={`gi-textarea-field ${formErrors.description ? 'has-error' : ''}`}
            rows={3}
            placeholder="Where was the item located? When was it discovered missing or damaged? Any suspects or causes?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {formErrors.description && (
            <div className="gi-field-error-msg">{formErrors.description}</div>
          )}
        </div>
      </form>
    </InventoryDrawer>
  );
}

