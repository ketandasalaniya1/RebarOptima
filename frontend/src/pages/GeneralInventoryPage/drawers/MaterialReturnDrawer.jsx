import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcw, Calendar, User, Package, AlertCircle, ShieldAlert, CheckCircle2, Check, AlertTriangle, X } from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';

export default function MaterialReturnDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  eligibleOutward = [],
  stores = [],
  selectedStoreId = '',
  preselectedOutwardId = ''
}) {
  const [storeId, setStoreId] = useState('');
  const [outwardId, setOutwardId] = useState('');
  const [returnType, setReturnType] = useState('BORROWED');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnedByPerson, setReturnedByPerson] = useState('');
  const [acceptedQuantity, setAcceptedQuantity] = useState('1');
  const [damagedQuantity, setDamagedQuantity] = useState('0');
  const [missingQuantity, setMissingQuantity] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Active selected outward entry
  const selectedOutward = useMemo(() => {
    return eligibleOutward.find((o) => (o.id || o._id) === outwardId);
  }, [eligibleOutward, outwardId]);

  useEffect(() => {
    if (isOpen) {
      const activeOutwardId = preselectedOutwardId || (eligibleOutward.length > 0 ? (eligibleOutward[0].id || eligibleOutward[0]._id) : '');
      const activeEntry = eligibleOutward.find((o) => (o.id || o._id) === activeOutwardId);

      setOutwardId(activeOutwardId);
      setStoreId(activeEntry?.storeId || selectedStoreId || stores[0]?.id || stores[0]?._id || '');
      setReturnType(activeEntry?.returnClassification === 'returnable' ? 'BORROWED' : 'UNUSED');
      setReturnDate(new Date().toISOString().split('T')[0]);
      setReturnedByPerson(activeEntry?.personReceiving || '');

      const initialOutstanding = activeEntry?.outstandingQuantity ?? 1;
      setAcceptedQuantity(String(initialOutstanding));
      setDamagedQuantity('0');
      setMissingQuantity('0');
      setRemarks('');
      setFormErrors({});
    }
  }, [isOpen, preselectedOutwardId, eligibleOutward, selectedStoreId, stores]);

  // When selected outward item changes, update the default fields
  const handleOutwardChange = (newId) => {
    setOutwardId(newId);
    const entry = eligibleOutward.find((o) => (o.id || o._id) === newId);
    if (entry) {
      if (entry.storeId) setStoreId(entry.storeId);
      setReturnType(entry.returnClassification === 'returnable' ? 'BORROWED' : 'UNUSED');
      setReturnedByPerson(entry.personReceiving || '');
      setAcceptedQuantity(String(entry.outstandingQuantity ?? 1));
      setDamagedQuantity('0');
      setMissingQuantity('0');
    }
  };

  const outstanding = selectedOutward?.outstandingQuantity ?? 0;
  const totalReturning = (parseFloat(acceptedQuantity) || 0) + (parseFloat(damagedQuantity) || 0) + (parseFloat(missingQuantity) || 0);
  const exceedsOutstanding = totalReturning > outstanding;

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!outwardId) {
      errors.outwardId = 'Please select an outward issue to record return against';
    }

    if (!returnedByPerson.trim()) {
      errors.returnedByPerson = 'Person returning the item is required';
    }

    const accepted = parseFloat(acceptedQuantity) || 0;
    const damaged = parseFloat(damagedQuantity) || 0;
    const missing = parseFloat(missingQuantity) || 0;

    if (accepted + damaged + missing <= 0) {
      errors.quantities = 'Total returned quantity must be greater than 0';
    } else if (accepted + damaged + missing > outstanding) {
      errors.quantities = `Total return (${accepted + damaged + missing}) cannot exceed outstanding issued quantity (${outstanding})`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      storeId: storeId || selectedOutward?.storeId || stores[0]?.id || stores[0]?._id,
      outwardId,
      returnType,
      returnDate: returnDate || new Date().toISOString().split('T')[0],
      returnedByPerson: returnedByPerson.trim(),
      acceptedQuantity: accepted,
      damagedQuantity: damaged,
      missingQuantity: missing,
      remarks: remarks.trim()
    };

    onSubmit(payload);
  };

  return (
    <InventoryDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Record Material / Tool Return"
      subtitle="Receive borrowed tool or unused consumable back into store"
      icon={RotateCcw}
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
            disabled={isSubmitting || exceedsOutstanding || eligibleOutward.length === 0}
          >
            {isSubmitting ? 'Recording Return...' : 'Accept Return & Update Stock'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="gi-drawer-form">
        {eligibleOutward.length === 0 ? (
          <div className="gi-alert-banner warning">
            <AlertCircle size={20} />
            <div>
              <strong>No Outstanding Items:</strong> There are currently no borrowed tools or returnable materials waiting for return.
            </div>
          </div>
        ) : (
          <>
            {/* Outward Issue Selector */}
            <div className="gi-form-group">
              <label className="gi-form-label">
                Select Issued Item to Return <span className="gi-required">*</span>
              </label>
              <select
                className={`gi-input-field ${formErrors.outwardId ? 'has-error' : ''}`}
                value={outwardId}
                onChange={(e) => handleOutwardChange(e.target.value)}
              >
                {eligibleOutward.map((o) => {
                  const isOverdue = o.expectedReturnDate && new Date(o.expectedReturnDate) < new Date();
                  return (
                    <option key={o.id || o._id} value={o.id || o._id}>
                      {o.materialName} ({o.outstandingQuantity} {o.uom}) — Issued to {o.personReceiving} [{o.outwardNumber}] {isOverdue ? '[OVERDUE]' : ''}
                    </option>
                  );
                })}
              </select>
              {formErrors.outwardId && <div className="gi-field-error-msg">{formErrors.outwardId}</div>}
            </div>

            {/* Selected Item Summary Card */}
            {selectedOutward && (
              <div className="gi-item-summary-card">
                <div className="gi-summary-header">
                  <div className="gi-summary-title">
                    <Package size={18} />
                    <strong>{selectedOutward.materialName}</strong>
                  </div>
                  <span className="gi-code-tag">{selectedOutward.outwardNumber}</span>
                </div>
                <div className="gi-summary-grid">
                  <div>
                    <span className="gi-summary-label">Borrower:</span>
                    <span>{selectedOutward.personReceiving} {selectedOutward.agency ? `(${selectedOutward.agency})` : ''}</span>
                  </div>
                  <div>
                    <span className="gi-summary-label">Issued On:</span>
                    <span>{new Date(selectedOutward.issueDateTime).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="gi-summary-label">Outstanding:</span>
                    <strong style={{ color: 'var(--accent)' }}>
                      {selectedOutward.outstandingQuantity} {selectedOutward.uom}
                    </strong>
                  </div>
                  {selectedOutward.expectedReturnDate && (
                    <div>
                      <span className="gi-summary-label">Due Date:</span>
                      <span style={{ color: new Date(selectedOutward.expectedReturnDate) < new Date() ? '#ef4444' : 'inherit', fontWeight: 600 }}>
                        {new Date(selectedOutward.expectedReturnDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Return Date & Person Returning */}
            <div className="gi-form-row two-col">
              <div className="gi-form-group">
                <label className="gi-form-label">
                  Return Date <span className="gi-required">*</span>
                </label>
                <div className="gi-select-with-icon">
                  <Calendar size={16} className="gi-input-icon" />
                  <input
                    type="date"
                    className="gi-input-field with-icon"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="gi-form-group">
                <label className="gi-form-label">
                  Returned By (Person) <span className="gi-required">*</span>
                </label>
                <div className="gi-select-with-icon">
                  <User size={16} className="gi-input-icon" />
                  <input
                    type="text"
                    className={`gi-input-field with-icon ${formErrors.returnedByPerson ? 'has-error' : ''}`}
                    placeholder="Person handing over item"
                    value={returnedByPerson}
                    onChange={(e) => setReturnedByPerson(e.target.value)}
                  />
                </div>
                {formErrors.returnedByPerson && (
                  <div className="gi-field-error-msg">{formErrors.returnedByPerson}</div>
                )}
              </div>
            </div>

            {/* Quantity Breakdown (Accepted / Damaged / Missing) */}
            <div className="gi-form-section">
              <div className="gi-section-header">
                <div className="gi-section-title">
                  <span>Return Quantity Breakdown</span>
                  <span className="gi-stock-pill normal">
                    Max: {outstanding} {selectedOutward?.uom || 'units'}
                  </span>
                </div>
              </div>

              <div className="gi-return-qty-grid">
                <div className="gi-form-group">
                  <label className="gi-form-label-sub" style={{ color: 'var(--success-text, #059669)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={12} /> Accepted (Good Condition)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={outstanding}
                    className="gi-input-field"
                    value={acceptedQuantity}
                    onChange={(e) => setAcceptedQuantity(e.target.value)}
                  />
                </div>

                <div className="gi-form-group">
                  <label className="gi-form-label-sub" style={{ color: 'var(--warning-text, #d97706)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> Damaged / Defective
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="gi-input-field"
                    value={damagedQuantity}
                    onChange={(e) => setDamagedQuantity(e.target.value)}
                  />
                </div>

                <div className="gi-form-group">
                  <label className="gi-form-label-sub" style={{ color: 'var(--danger-text, #dc2626)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <X size={12} /> Missing / Lost
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="gi-input-field"
                    value={missingQuantity}
                    onChange={(e) => setMissingQuantity(e.target.value)}
                  />
                </div>
              </div>

              {exceedsOutstanding ? (
                <div className="gi-field-error-msg" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={13} />
                  <span>Total returning ({totalReturning}) exceeds outstanding issued balance ({outstanding} {selectedOutward?.uom}).</span>
                </div>
              ) : formErrors.quantities ? (
                <div className="gi-field-error-msg">{formErrors.quantities}</div>
              ) : null}
            </div>

            {/* Remarks / Condition Notes */}
            <div className="gi-form-group">
              <label className="gi-form-label">Return Notes & Condition</label>
              <textarea
                className="gi-textarea-field"
                rows={2}
                placeholder="Physical condition, cleanliness, reason for any damaged or missing quantity..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </>
        )}
      </form>
    </InventoryDrawer>
  );
}

