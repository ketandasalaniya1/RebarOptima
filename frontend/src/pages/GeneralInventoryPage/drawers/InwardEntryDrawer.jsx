import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calendar,
  Store,
  Truck,
  CheckCircle2,
  FileWarning
} from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';
import MaterialSearchSelect from '../components/MaterialSearchSelect';
import { Input, Select, Textarea } from '../../../components/ui';

export default function InwardEntryDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  materials = [],
  stores = [],
  selectedStoreId = '',
  onOpenNewMaterial
}) {
  // Smart defaults from localStorage
  const lastStoreId = localStorage.getItem('gi_last_store_id') || '';
  const lastVendor = localStorage.getItem('gi_last_vendor_name') || '';

  const [storeId, setStoreId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorName, setVendorName] = useState('');
  const [vendorChallanNumber, setVendorChallanNumber] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Multi-item rows
  const [items, setItems] = useState([
    {
      materialId: '',
      materialName: '',
      uom: '',
      receivedQuantity: '',
      acceptedQuantity: '',
      damagedQuantity: 0,
      rejectedQuantity: 0,
      unitPrice: '',
      remarks: ''
    }
  ]);

  const [formErrors, setFormErrors] = useState({});

  // Initialize or reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      const activeStore = selectedStoreId || lastStoreId || stores[0]?.id || stores[0]?._id || '';
      setStoreId(activeStore);
      setReceiptDate(new Date().toISOString().split('T')[0]);
      setVendorName(lastVendor || '');
      setVendorChallanNumber('');
      setVendorContact('');
      setInvoiceNumber('');
      setRemarks('');
      setShowOptionalFields(false);
      setItems([
        {
          materialId: '',
          materialName: '',
          uom: '',
          receivedQuantity: '',
          acceptedQuantity: '',
          damagedQuantity: 0,
          rejectedQuantity: 0,
          unitPrice: '',
          remarks: ''
        }
      ]);
      setFormErrors({});
    }
  }, [isOpen, selectedStoreId, stores]);

  const handleItemSelect = (index, mat) => {
    const updated = [...items];
    if (mat) {
      updated[index].materialId = mat.id || mat._id;
      updated[index].materialName = mat.name;
      updated[index].uom = mat.uom || 'Nos';
    } else {
      updated[index].materialId = '';
      updated[index].materialName = '';
      updated[index].uom = '';
    }
    setItems(updated);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    // Automatically synchronize acceptedQuantity with receivedQuantity if user hasn't explicitly set acceptedQuantity
    if (field === 'receivedQuantity') {
      const numVal = parseFloat(value) || 0;
      if (!updated[index].acceptedQuantity || parseFloat(updated[index].acceptedQuantity) === 0) {
        updated[index].acceptedQuantity = numVal > 0 ? value : '';
      }
    }

    setItems(updated);
  };

  // Quick allocation helper for storekeeper (1-tap assignment of discrepancy)
  const handleQuickAssign = (index, type) => {
    const updated = [...items];
    const it = updated[index];
    const rec = parseFloat(it.receivedQuantity) || 0;
    const acc = parseFloat(it.acceptedQuantity) || 0;
    const diff = Math.max(0, rec - acc);

    if (type === 'damaged') {
      it.damagedQuantity = diff;
      it.rejectedQuantity = 0;
      if (!it.remarks) {
        it.remarks = `${diff} ${it.uom || 'units'} damaged during unloading / transit.`;
      }
    } else if (type === 'rejected') {
      it.rejectedQuantity = diff;
      it.damagedQuantity = 0;
      if (!it.remarks) {
        it.remarks = `${diff} ${it.uom || 'units'} short delivery by vendor / rejected upon inspection.`;
      }
    } else if (type === 'reset') {
      it.acceptedQuantity = rec;
      it.damagedQuantity = 0;
      it.rejectedQuantity = 0;
      it.remarks = '';
    }

    setItems(updated);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      {
        materialId: '',
        materialName: '',
        uom: '',
        receivedQuantity: '',
        acceptedQuantity: '',
        damagedQuantity: 0,
        rejectedQuantity: 0,
        unitPrice: '',
        remarks: ''
      }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!storeId) errors.storeId = 'Please select a receiving store';
    if (!receiptDate) errors.receiptDate = 'Please select receipt date';
    if (!vendorName.trim()) errors.vendorName = 'Please enter vendor/supplier name';
    if (!vendorChallanNumber.trim()) errors.vendorChallanNumber = 'Delivery Challan # or Slip # is required';

    // Validate items
    const validItems = items.filter((it) => it.materialId && (parseFloat(it.receivedQuantity) > 0 || parseFloat(it.acceptedQuantity) > 0));
    if (validItems.length === 0) {
      errors.items = 'Please select at least one material with received quantity';
    }

    // Comprehensive legal & audit discrepancy validation
    validItems.forEach((it, idx) => {
      const rec = parseFloat(it.receivedQuantity) || 0;
      const acc = parseFloat(it.acceptedQuantity) || 0;
      const dam = parseFloat(it.damagedQuantity) || 0;
      const rej = parseFloat(it.rejectedQuantity) || 0;

      if (acc > rec) {
        errors[`item_${idx}_accepted`] = `Accepted quantity (${acc}) cannot exceed received quantity (${rec})`;
      } else if (rec > acc) {
        const diff = Number((rec - acc).toFixed(4));
        const accounted = Number((dam + rej).toFixed(4));

        if (accounted !== diff) {
          const unaccounted = Number((diff - accounted).toFixed(4));
          if (unaccounted > 0) {
            errors[`item_${idx}_discrepancy`] = `Line item #${idx + 1} has an unexplained discrepancy of ${unaccounted} ${it.uom}. Please allocate difference into Damaged or Rejected/Shortage.`;
          } else {
            errors[`item_${idx}_discrepancy`] = `Line item #${idx + 1}: Damaged (${dam}) + Rejected (${rej}) cannot exceed the ${diff} ${it.uom} discrepancy.`;
          }
        }

        // Mandatory legal explanation for any shortage/rejection
        if (!it.remarks || !it.remarks.trim()) {
          errors[`item_${idx}_remarks`] = `Legally required: Please provide an explanation for the ${diff} ${it.uom} difference (e.g. broken blocks, vendor short delivery, QA rejection).`;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Save smart defaults
    localStorage.setItem('gi_last_store_id', storeId);
    if (vendorName.trim()) localStorage.setItem('gi_last_vendor_name', vendorName.trim());

    const payload = {
      storeId,
      receiptDate,
      vendorName: vendorName.trim(),
      vendorContact: vendorContact.trim(),
      vendorChallanNumber: vendorChallanNumber.trim(),
      invoiceNumber: invoiceNumber.trim(),
      remarks: remarks.trim(),
      items: validItems.map((it) => ({
        materialId: it.materialId,
        receivedQuantity: parseFloat(it.receivedQuantity) || 0,
        acceptedQuantity: parseFloat(it.acceptedQuantity) || parseFloat(it.receivedQuantity) || 0,
        damagedQuantity: parseFloat(it.damagedQuantity) || 0,
        rejectedQuantity: parseFloat(it.rejectedQuantity) || 0,
        unitPrice: parseFloat(it.unitPrice) || 0,
        remarks: it.remarks || ''
      }))
    };

    onSubmit(payload);
  };

  return (
    <InventoryDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Inward Goods Entry (GRN)"
      subtitle="Receive delivery from vendor / supplier into site godown"
      icon={ArrowDownLeft}
      width="620px"
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
            {isSubmitting ? 'Posting GRN...' : 'Save & Receive Stock'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="gi-drawer-form">
        {/* Receiving Store & Date */}
        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Store / Godown <span className="gi-required">*</span>
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

          <div className="gi-form-group">
            <label className="gi-form-label">
              Receipt Date <span className="gi-required">*</span>
            </label>
            <div className="gi-select-with-icon">
              <Calendar size={16} className="gi-input-icon" />
              <Input
                type="date"
                className={`gi-input-field with-icon ${formErrors.receiptDate ? 'has-error' : ''}`}
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
            {formErrors.receiptDate && <div className="gi-field-error-msg">{formErrors.receiptDate}</div>}
          </div>
        </div>

        {/* Vendor & Challan # */}
        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Vendor / Supplier <span className="gi-required">*</span>
            </label>
            <div className="gi-select-with-icon">
              <Truck size={16} className="gi-input-icon" />
              <Input
                type="text"
                className={`gi-input-field with-icon ${formErrors.vendorName ? 'has-error' : ''}`}
                placeholder="e.g. UltraTech, Bosch, Schneider..."
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
              />
            </div>
            {formErrors.vendorName && <div className="gi-field-error-msg">{formErrors.vendorName}</div>}
          </div>

          <div className="gi-form-group">
            <label className="gi-form-label">
              Challan / DC / Slip # <span className="gi-required">*</span>
            </label>
            <Input
              type="text"
              className={`gi-input-field ${formErrors.vendorChallanNumber ? 'has-error' : ''}`}
              placeholder="e.g. DC-9842"
              value={vendorChallanNumber}
              onChange={(e) => setVendorChallanNumber(e.target.value)}
            />
            {formErrors.vendorChallanNumber && (
              <div className="gi-field-error-msg">{formErrors.vendorChallanNumber}</div>
            )}
          </div>
        </div>

        {/* Materials Inward List */}
        <div className="gi-form-section">
          <div className="gi-section-header">
            <div className="gi-section-title">
              <span>Items Received ({items.length})</span>
              {formErrors.items && <span className="gi-field-error-tag">{formErrors.items}</span>}
            </div>
            {onOpenNewMaterial && (
              <button
                type="button"
                className="gi-link-btn"
                onClick={onOpenNewMaterial}
                title="Create a new material item if not already in system"
              >
                + Register New Material
              </button>
            )}
          </div>

          <div className="gi-items-list-container">
            {items.map((item, idx) => {
              const rec = parseFloat(item.receivedQuantity) || 0;
              const acc = parseFloat(item.acceptedQuantity) || 0;
              const dam = parseFloat(item.damagedQuantity) || 0;
              const rej = parseFloat(item.rejectedQuantity) || 0;
              const hasDiscrepancy = rec > 0 && acc < rec;
              const diff = hasDiscrepancy ? Number((rec - acc).toFixed(4)) : 0;
              const accounted = Number((dam + rej).toFixed(4));
              const unaccounted = hasDiscrepancy ? Number((diff - accounted).toFixed(4)) : 0;
              const isOverAccepted = rec > 0 && acc > rec;

              return (
                <div key={idx} className="gi-item-card">
                  <div className="gi-item-card-header">
                    <span className="gi-item-card-num">Item #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="gi-btn-remove-item"
                        onClick={() => removeItemRow(idx)}
                        title="Remove this item"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <MaterialSearchSelect
                    materials={materials}
                    selectedMaterialId={item.materialId}
                    onSelect={(mat) => handleItemSelect(idx, mat)}
                    placeholder="Type to search material name or code..."
                    label="Material Item"
                    required={true}
                  />

                  {/* Received & Accepted Quantities */}
                  <div className="gi-form-row two-col" style={{ marginTop: '0.5rem' }}>
                    <div className="gi-form-group">
                      <div className="gi-form-label-row">
                        <label className="gi-form-label">
                          Received Qty {item.uom && `(${item.uom})`} <span className="gi-required">*</span>
                        </label>
                      </div>
                      <Input
                        type="number"
                        step="any"
                        min="0.01"
                        className="gi-input-field"
                        placeholder="e.g. 150"
                        value={item.receivedQuantity}
                        onChange={(e) => handleItemChange(idx, 'receivedQuantity', e.target.value)}
                      />
                    </div>

                    <div className="gi-form-group">
                      <div className="gi-form-label-row">
                        <label className="gi-form-label">
                          Accepted Qty {item.uom && `(${item.uom})`} <span className="gi-required">*</span>
                        </label>
                        {rec > 0 && acc === rec && (
                          <span className="gi-full-delivery-badge">
                            <CheckCircle2 size={12} /> Full Match
                          </span>
                        )}
                        {hasDiscrepancy && (
                          <span className="gi-discrepancy-pill">
                            −{diff} {item.uom || ''} Diff
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        className={`gi-input-field ${isOverAccepted || formErrors[`item_${idx}_accepted`] ? 'has-error' : ''}`}
                        placeholder={item.receivedQuantity || '0'}
                        value={item.acceptedQuantity}
                        onChange={(e) => handleItemChange(idx, 'acceptedQuantity', e.target.value)}
                      />
                      {formErrors[`item_${idx}_accepted`] && (
                        <div className="gi-field-error-msg">{formErrors[`item_${idx}_accepted`]}</div>
                      )}
                    </div>
                  </div>

                  {/* ── MANDATORY DISCREPANCY & REASON SECTION (When Received != Accepted) ── */}
                  {hasDiscrepancy && (
                    <div className="gi-discrepancy-panel">
                      <div className="gi-discrepancy-header">
                        <FileWarning size={17} color="#d97706" />
                        <div style={{ flex: 1 }}>
                          <strong>Discrepancy Detected: {diff} {item.uom || 'units'} missing from Accepted Stock</strong>
                          <div className="gi-discrepancy-subtext">
                            Challan Received ({rec}) − Accepted ({acc}) = <strong>{diff} {item.uom}</strong>. Legally, GRN must account for where this difference went.
                          </div>
                        </div>
                        <span className="gi-discrepancy-tag">Legally Required</span>
                      </div>

                      {/* 1-Tap Quick Assign Bar */}
                      <div className="gi-quick-alloc-bar">
                        <span className="gi-quick-alloc-label">Quick Assign {diff} {item.uom}:</span>
                        <button
                          type="button"
                          className="gi-quick-alloc-btn damaged"
                          onClick={() => handleQuickAssign(idx, 'damaged')}
                        >
                          All {diff} Damaged
                        </button>
                        <button
                          type="button"
                          className="gi-quick-alloc-btn rejected"
                          onClick={() => handleQuickAssign(idx, 'rejected')}
                        >
                          All {diff} Rejected / Shortage
                        </button>
                        <button
                          type="button"
                          className="gi-quick-alloc-btn reset"
                          onClick={() => handleQuickAssign(idx, 'reset')}
                        >
                          Reset (Accept all {rec})
                        </button>
                      </div>

                      {/* Breakdown Inputs: Damaged vs Rejected / Vendor Shortage */}
                      <div className="gi-form-row two-col" style={{ marginTop: '0.25rem' }}>
                        <div className="gi-form-group">
                          <label className="gi-form-label-sub" style={{ color: '#d97706', fontWeight: 600 }}>
                            Damaged in Transit / Broken ({item.uom || 'units'})
                          </label>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            max={diff}
                            className="gi-input-field-sm"
                            placeholder="0"
                            value={item.damagedQuantity || ''}
                            onChange={(e) => handleItemChange(idx, 'damagedQuantity', e.target.value)}
                          />
                        </div>

                        <div className="gi-form-group">
                          <label className="gi-form-label-sub" style={{ color: '#dc2626', fontWeight: 600 }}>
                            Rejected / Vendor Shortage ({item.uom || 'units'})
                          </label>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            max={diff}
                            className="gi-input-field-sm"
                            placeholder="0"
                            value={item.rejectedQuantity || ''}
                            onChange={(e) => handleItemChange(idx, 'rejectedQuantity', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Allocation balance warning if not equal */}
                      {unaccounted !== 0 && (
                        <div className="gi-field-error-msg" style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={13} />
                          <span>Unaccounted difference: {unaccounted > 0 ? `${unaccounted} ${item.uom} still unassigned.` : `Assigned quantities exceed discrepancy by ${Math.abs(unaccounted)} ${item.uom}.`}</span>
                        </div>
                      )}
                      {formErrors[`item_${idx}_discrepancy`] && (
                        <div className="gi-field-error-msg">{formErrors[`item_${idx}_discrepancy`]}</div>
                      )}

                      {/* Mandatory Legal Explanation Input */}
                      <div className="gi-form-group" style={{ marginTop: '0.4rem' }}>
                        <label className="gi-form-label-sub" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          Mandatory Explanation / Discrepancy Reason <span className="gi-required">*</span>
                        </label>
                        <Input
                          type="text"
                          className={`gi-input-field ${formErrors[`item_${idx}_remarks`] ? 'has-error' : ''}`}
                          placeholder="e.g. 10 Cu.Mtr blocks arrived cracked / short delivered on truck by vendor"
                          value={item.remarks}
                          onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                        />
                        {formErrors[`item_${idx}_remarks`] && (
                          <div className="gi-field-error-msg">{formErrors[`item_${idx}_remarks`]}</div>
                        )}
                        <span className="gi-field-hint">
                          This explanation is legally printed on the GRN slip and recorded for vendor debit notes and payment audits.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Standard Unit Price & Optional Item Remarks (when no discrepancy) */}
                  <div className="gi-item-sub-grid">
                    <div className="gi-form-group">
                      <label className="gi-form-label-sub">Unit Price (₹)</label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        className="gi-input-field-sm"
                        placeholder="Optional"
                        value={item.unitPrice || ''}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                      />
                    </div>
                    {!hasDiscrepancy && (
                      <div className="gi-form-group">
                        <label className="gi-form-label-sub">Item Remarks</label>
                        <Input
                          type="text"
                          className="gi-input-field-sm"
                          placeholder="Optional batch/heat #"
                          value={item.remarks || ''}
                          onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              className="gi-btn-add-item-row"
              onClick={addItemRow}
            >
              <Plus size={16} />
              <span>Add Another Material Item</span>
            </button>
          </div>
        </div>

        {/* Optional Collapsible Fields */}
        <div className="gi-optional-accordion">
          <button
            type="button"
            className="gi-accordion-toggle"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
          >
            <span>{showOptionalFields ? '− Hide' : '+ Show'} Optional Details (Invoice, Vendor Phone, Remarks)</span>
            {showOptionalFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showOptionalFields && (
            <div className="gi-accordion-content">
              <div className="gi-form-row two-col">
                <div className="gi-form-group">
                  <label className="gi-form-label">Invoice Number</label>
                  <Input
                    type="text"
                    className="gi-input-field"
                    placeholder="e.g. INV-2026-891"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div className="gi-form-group">
                  <label className="gi-form-label">Vendor Phone / Contact</label>
                  <Input
                    type="text"
                    className="gi-input-field"
                    placeholder="e.g. +91 98765 43210"
                    value={vendorContact}
                    onChange={(e) => setVendorContact(e.target.value)}
                  />
                </div>
              </div>

              <div className="gi-form-group">
                <label className="gi-form-label">Delivery Notes / Remarks</label>
                <Textarea
                  className="gi-textarea-field"
                  rows={2}
                  placeholder="Gate pass number, truck details, condition of materials..."
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
