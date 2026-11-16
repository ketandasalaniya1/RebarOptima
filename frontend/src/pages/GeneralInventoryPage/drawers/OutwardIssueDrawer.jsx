import React, { useState, useEffect, useMemo } from 'react';
import { ArrowUpRight, Store, User, Building, Calendar, MapPin, ChevronDown, ChevronUp, AlertCircle, Clock, Package, RotateCcw, AlertTriangle } from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';
import MaterialSearchSelect from '../components/MaterialSearchSelect';
import { Input, Select, Textarea } from '../../../components/ui';

export default function OutwardIssueDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  materials = [],
  stores = [],
  selectedStoreId = '',
  preselectedMaterialId = ''
}) {
  // Smart defaults from localStorage
  const lastStoreId = localStorage.getItem('gi_last_store_id') || '';
  const lastPerson = localStorage.getItem('gi_last_outward_person') || '';
  const lastAgency = localStorage.getItem('gi_last_outward_agency') || '';

  const [storeId, setStoreId] = useState('');
  const [issueDateTime, setIssueDateTime] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [personReceiving, setPersonReceiving] = useState('');
  const [agency, setAgency] = useState('');
  const [isAgencyNA, setIsAgencyNA] = useState(false);
  const [returnClassification, setReturnClassification] = useState('non-returnable');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [location, setLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Initialize or reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      const activeStore = selectedStoreId || lastStoreId || stores[0]?.id || stores[0]?._id || '';
      setStoreId(activeStore);
      setIssueDateTime(new Date().toISOString().slice(0, 16));
      setMaterialId(preselectedMaterialId || '');
      setQuantity('1');
      setPersonReceiving(lastPerson || '');
      setAgency(lastAgency || '');
      setIsAgencyNA(false);
      setReturnClassification('non-returnable');

      // Default expected return date to +3 days
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      setExpectedReturnDate(threeDaysLater.toISOString().split('T')[0]);

      setLocation('');
      setPurpose('');
      setRemarks('');
      setShowOptionalFields(false);
      setFormErrors({});
    }
  }, [isOpen, selectedStoreId, preselectedMaterialId, stores]);

  const selectedMaterial = useMemo(() => {
    return materials.find((m) => (m.id || m._id) === materialId);
  }, [materials, materialId]);

  const activeStoreObj = useMemo(() => {
    return stores.find((s) => (s.id || s._id) === storeId);
  }, [stores, storeId]);

  // Available stock calculation
  const availableStock = useMemo(() => {
    if (!selectedMaterial) return 0;
    return selectedMaterial.currentStock ?? 0;
  }, [selectedMaterial]);

  // Live stock validation check
  const stockExceeded = useMemo(() => {
    const enteredQty = parseFloat(quantity) || 0;
    return enteredQty > availableStock;
  }, [quantity, availableStock]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!storeId) errors.storeId = 'Please select an issuing store';
    if (!materialId) errors.materialId = 'Please select a material to issue';

    const numQty = parseFloat(quantity);
    if (!numQty || numQty <= 0) {
      errors.quantity = 'Please enter a valid quantity greater than 0';
    } else if (numQty > availableStock) {
      const storeName = activeStoreObj?.name || 'Selected Godown';
      errors.quantity = `Only ${availableStock} ${selectedMaterial?.uom || 'units'} available in ${storeName}`;
    }

    if (!personReceiving.trim()) {
      errors.personReceiving = 'Person receiving / borrower name is required';
    }

    if (!isAgencyNA && !agency.trim()) {
      errors.agency = 'Contractor / Agency is required (or check N/A)';
    }

    if (returnClassification === 'returnable' && !expectedReturnDate) {
      errors.expectedReturnDate = 'Expected return date is required for borrowed tools';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Save smart defaults to localStorage
    localStorage.setItem('gi_last_store_id', storeId);
    if (personReceiving.trim()) localStorage.setItem('gi_last_outward_person', personReceiving.trim());
    if (!isAgencyNA && agency.trim()) localStorage.setItem('gi_last_outward_agency', agency.trim());

    const payload = {
      storeId,
      issueDateTime: issueDateTime || new Date().toISOString().slice(0, 16),
      materialId,
      quantity: numQty,
      personReceiving: personReceiving.trim(),
      agency: isAgencyNA ? 'Not Applicable' : agency.trim(),
      location: location.trim(),
      purpose: purpose.trim(),
      returnClassification,
      expectedReturnDate: returnClassification === 'returnable' ? expectedReturnDate : '',
      remarks: remarks.trim()
    };

    onSubmit(payload);
  };

  return (
    <InventoryDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Issue Material / Tool Outward"
      subtitle="Release stock to site contractor, engineer or worker"
      icon={ArrowUpRight}
      width="560px"
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
            disabled={isSubmitting || stockExceeded}
          >
            {isSubmitting ? 'Issuing Stock...' : 'Confirm & Issue Outward'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="gi-drawer-form">
        {/* Issuing Store */}
        <div className="gi-form-group">
          <label className="gi-form-label">
            Issuing Godown / Store <span className="gi-required">*</span>
          </label>
          <div className="gi-select-with-icon">
            <Store size={16} className="gi-input-icon" />
            <Select
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
            </Select>
          </div>
          {formErrors.storeId && <div className="gi-field-error-msg">{formErrors.storeId}</div>}
        </div>

        {/* Searchable Material Picker */}
        <MaterialSearchSelect
          materials={materials}
          selectedMaterialId={materialId}
          onSelect={(mat) => {
            setMaterialId(mat ? mat.id || mat._id : '');
            if (formErrors.materialId) {
              setFormErrors((prev) => ({ ...prev, materialId: '' }));
            }
          }}
          placeholder="Type to search material name or code..."
          label="Material to Issue"
          required={true}
          error={formErrors.materialId}
        />

        {/* Quantity with live stock indicator and inline check */}
        <div className="gi-form-group">
          <div className="gi-form-label-row">
            <label className="gi-form-label">
              Quantity to Issue {selectedMaterial?.uom && `(${selectedMaterial.uom})`} <span className="gi-required">*</span>
            </label>
            {selectedMaterial && (
              <span className={`gi-live-stock-indicator ${availableStock <= 0 ? 'out' : availableStock < (selectedMaterial.lowStockThreshold || 5) ? 'low' : 'good'}`}>
                Available: <strong>{availableStock} {selectedMaterial.uom}</strong> in {activeStoreObj?.name || 'Store'}
              </span>
            )}
          </div>

          <Input
            type="number"
            step="any"
            min="0.01"
            className={`gi-input-field ${formErrors.quantity || stockExceeded ? 'has-error' : ''}`}
            placeholder="e.g. 2"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          {stockExceeded ? (
            <div className="gi-field-error-msg" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={13} />
              <span>Only {availableStock} {selectedMaterial?.uom || 'units'} in {activeStoreObj?.name || 'Selected Godown'}. You requested {quantity}.</span>
            </div>
          ) : formErrors.quantity ? (
            <div className="gi-field-error-msg">{formErrors.quantity}</div>
          ) : null}
        </div>

        {/* Issued To Person & Agency */}
        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Issued To (Person) <span className="gi-required">*</span>
            </label>
            <div className="gi-select-with-icon">
              <User size={16} className="gi-input-icon" />
              <Input
                type="text"
                className={`gi-input-field with-icon ${formErrors.personReceiving ? 'has-error' : ''}`}
                placeholder="e.g. Ramesh / Site Foreman"
                value={personReceiving}
                onChange={(e) => setPersonReceiving(e.target.value)}
              />
            </div>
            {formErrors.personReceiving && (
              <div className="gi-field-error-msg">{formErrors.personReceiving}</div>
            )}
          </div>

          <div className="gi-form-group">
            <div className="gi-form-label-row">
              <label className="gi-form-label">
                Contractor / Agency {!isAgencyNA && <span className="gi-required">*</span>}
              </label>
              <label className="gi-inline-checkbox-label">
                <Input
                  type="checkbox"
                  checked={isAgencyNA}
                  onChange={(e) => setIsAgencyNA(e.target.checked)}
                />
                <span>N/A</span>
              </label>
            </div>
            <div className="gi-select-with-icon">
              <Building size={16} className="gi-input-icon" />
              <Input
                type="text"
                disabled={isAgencyNA}
                className={`gi-input-field with-icon ${isAgencyNA ? 'disabled' : ''} ${formErrors.agency ? 'has-error' : ''}`}
                placeholder={isAgencyNA ? 'Not Applicable' : 'e.g. Apex Electricals'}
                value={isAgencyNA ? 'Not Applicable' : agency}
                onChange={(e) => setAgency(e.target.value)}
              />
            </div>
            {formErrors.agency && <div className="gi-field-error-msg">{formErrors.agency}</div>}
          </div>
        </div>

        {/* Classification: Non-Returnable (Consumable) vs. Returnable (Tool/Equipment) */}
        <div className="gi-form-group">
          <label className="gi-form-label">Issue Classification</label>
          <div className="gi-radio-pill-group">
            <button
              type="button"
              className={`gi-radio-pill ${returnClassification === 'non-returnable' ? 'active' : ''}`}
              onClick={() => setReturnClassification('non-returnable')}
            >
              <Package size={13} style={{ marginRight: '4px' }} /> Consumable (Non-Returnable)
            </button>
            <button
              type="button"
              className={`gi-radio-pill returnable ${returnClassification === 'returnable' ? 'active' : ''}`}
              onClick={() => setReturnClassification('returnable')}
            >
              <RotateCcw size={13} style={{ marginRight: '4px' }} /> Tool / Borrowed (Returnable)
            </button>
          </div>
        </div>

        {/* If Returnable: Expected Return Date */}
        {returnClassification === 'returnable' && (
          <div className="gi-form-group gi-highlight-box">
            <div className="gi-highlight-header">
              <Clock size={16} color="var(--warning)" />
              <strong>Expected Return Date</strong>
              <span className="gi-required">*</span>
            </div>
            <p className="gi-highlight-desc">
              Tools overdue beyond this date trigger a high-visibility warning on the Daily Hub.
            </p>
            <div className="gi-select-with-icon" style={{ marginTop: '0.4rem' }}>
              <Calendar size={16} className="gi-input-icon" />
              <Input
                type="date"
                className={`gi-input-field with-icon ${formErrors.expectedReturnDate ? 'has-error' : ''}`}
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
              />
            </div>
            {formErrors.expectedReturnDate && (
              <div className="gi-field-error-msg">{formErrors.expectedReturnDate}</div>
            )}
          </div>
        )}

        {/* Optional Collapsible Details */}
        <div className="gi-optional-accordion">
          <button
            type="button"
            className="gi-accordion-toggle"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
          >
            <span>{showOptionalFields ? '− Hide' : '+ Show'} Optional Details (Location, Purpose, Remarks)</span>
            {showOptionalFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showOptionalFields && (
            <div className="gi-accordion-content">
              <div className="gi-form-row two-col">
                <div className="gi-form-group">
                  <label className="gi-form-label">Location / Work Front</label>
                  <div className="gi-select-with-icon">
                    <MapPin size={16} className="gi-input-icon" />
                    <Input
                      type="text"
                      className="gi-input-field with-icon"
                      placeholder="e.g. Tower B - 5th Floor"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="gi-form-group">
                  <label className="gi-form-label">Purpose / Work Description</label>
                  <Input
                    type="text"
                    className="gi-input-field"
                    placeholder="e.g. Plumbing conduit laying"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                </div>
              </div>

              <div className="gi-form-group">
                <label className="gi-form-label">General Remarks</label>
                <Textarea
                  className="gi-textarea-field"
                  rows={2}
                  placeholder="Notes, condition of tool when issued, supervisor sign-off..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </InventoryDrawer>
  );
}

