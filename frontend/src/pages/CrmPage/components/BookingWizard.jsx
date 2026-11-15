import React, { useState } from 'react';
import { X, Check, ArrowRight, ArrowLeft, DollarSign, FileText, Calendar, Building2 } from 'lucide-react';
import { formatINR, formatShortINR } from '../../../utils/money';

export default function BookingWizard({
  projects = [],
  units = [],
  customers = [],
  initialUnit = null,
  initialCustomer = null,
  onClose,
  onSubmitBooking
}) {
  const [step, setStep] = useState(1); // 1 | 2 | 3
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomer?._id || '');
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnit?._id || '');

  const [agreementPrice, setAgreementPrice] = useState(initialUnit?.askingPrice || initialUnit?.basePrice || 10000000);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(5); // 5% GST

  const basePriceAfterDiscount = Math.max(0, Number(agreementPrice) - Number(discountAmount || 0));
  const taxAmount = Math.round(basePriceAfterDiscount * (taxRate / 100));
  const netBookingValue = basePriceAfterDiscount + taxAmount;
  const recommendedToken = Math.round(netBookingValue * 0.1);

  const [bookingDepositRequired, setBookingDepositRequired] = useState(recommendedToken);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const selectedUnit = units.find(u => String(u._id) === String(selectedUnitId)) || initialUnit;
  const selectedCustomer = customers.find(c => String(c._id) === String(selectedCustomerId)) || initialCustomer;

  // Milestone schedule preview
  const defaultMilestones = [
    { name: 'Booking Token Amount', pct: 10, amount: Math.round(netBookingValue * 0.1) },
    { name: 'Agreement Signing (Within 30 Days)', pct: 15, amount: Math.round(netBookingValue * 0.15) },
    { name: 'Plinth / Foundation Level', pct: 15, amount: Math.round(netBookingValue * 0.15) },
    { name: 'Floor Slab Level', pct: 25, amount: Math.round(netBookingValue * 0.25) },
    { name: 'Finishing & Plaster', pct: 20, amount: Math.round(netBookingValue * 0.2) },
    { name: 'Possession & Handover', pct: 15, amount: netBookingValue - Math.round(netBookingValue * 0.85) }
  ];

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!selectedCustomerId || !selectedUnitId) {
        setError('Please select both a buyer and a property unit.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (netBookingValue <= 0) {
        setError('Net booking value must be greater than zero.');
        return;
      }
      setBookingDepositRequired(recommendedToken);
      setStep(3);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        customerId: selectedCustomerId,
        projectId: selectedUnit.projectId,
        unitId: selectedUnitId,
        agreementPrice: Number(agreementPrice),
        discountAmount: Number(discountAmount || 0),
        taxAmount,
        netBookingValue,
        bookingDepositRequired: Number(bookingDepositRequired || recommendedToken),
        bookingDate,
        notes: notes.trim()
      };

      await onSubmitBooking(payload);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to commit booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-container" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        {/* ── Wizard Header ─────────────────────────────────────────────────── */}
        <div className="crm-modal-header">
          <span className="crm-modal-title">
            <FileText size={18} /> Property Booking Wizard
          </span>
          <button className="crm-modal-close-btn" onClick={onClose} aria-label="Close booking wizard">
            <X size={20} />
          </button>
        </div>

        {/* ── Wizard Step Indicator Bar ──────────────────────────────────────── */}
        <div className="crm-wizard-step-bar">
          <div className={`crm-wizard-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <span className="step-num">{step > 1 ? <Check size={14} /> : '1'}</span>
            <span className="step-label">Buyer &amp; Unit</span>
          </div>
          <div className="crm-wizard-step-line" />
          <div className={`crm-wizard-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <span className="step-num">{step > 2 ? <Check size={14} /> : '2'}</span>
            <span className="step-label">Pricing &amp; CLP</span>
          </div>
          <div className="crm-wizard-step-line" />
          <div className={`crm-wizard-step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-num">3</span>
            <span className="step-label">Token &amp; Confirm</span>
          </div>
        </div>

        <div className="crm-modal-body">
          {error && (
            <div className="crm-error-banner" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {/* ── STEP 1: Buyer & Unit Selection ───────────────────────────────── */}
          {step === 1 && (
            <div className="crm-wizard-step-content">
              <div className="crm-form-group">
                <label className="crm-form-label">Select Registered Buyer *</label>
                <select
                  className="crm-form-input"
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">Select Buyer</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.fullName} ({c.phone}) - {c.customerCode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">Select Inventory Unit *</label>
                <select
                  className="crm-form-input"
                  value={selectedUnitId}
                  onChange={e => {
                    setSelectedUnitId(e.target.value);
                    const u = units.find(unitItem => String(unitItem._id) === String(e.target.value));
                    if (u) {
                      setAgreementPrice(u.askingPrice || u.basePrice || 10000000);
                    }
                  }}
                >
                  <option value="">Select Unit</option>
                  {units
                    .filter(u => ['Available', 'Held'].includes(u.effectiveStatus || u.availabilityStatus) || String(u._id) === String(selectedUnitId))
                    .map(u => (
                      <option key={u._id} value={u._id}>
                        Unit {u.unitCode} ({u.configuration}, Floor {u.floorNumber}) - {formatShortINR(u.askingPrice || u.basePrice)}
                      </option>
                    ))}
                </select>
              </div>

              {selectedUnit && (
                <div className="crm-wizard-selection-card">
                  <div style={{ fontWeight: 600, color: 'var(--accent)' }}>Selected Unit {selectedUnit.unitCode}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {selectedUnit.projectName} • {selectedUnit.configuration} • {selectedUnit.carpetAreaSqFt} sq.ft
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Commercial Pricing & Construction-Linked Schedule ─────── */}
          {step === 2 && (
            <div className="crm-wizard-step-content">
              <div className="crm-form-grid">
                <div className="crm-form-group">
                  <label className="crm-form-label">Agreement Base Price (₹) *</label>
                  <input
                    type="number"
                    className="crm-form-input"
                    value={agreementPrice}
                    onChange={e => setAgreementPrice(e.target.value)}
                  />
                </div>

                <div className="crm-form-group">
                  <label className="crm-form-label">Developer Discount (₹)</label>
                  <input
                    type="number"
                    className="crm-form-input"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* Real-time Summary Card */}
              <div className="crm-sheet-price-card" style={{ margin: '1rem 0' }}>
                <div className="crm-sheet-price-row">
                  <span>Agreement Price:</span>
                  <strong>{formatINR(agreementPrice)}</strong>
                </div>
                {Number(discountAmount) > 0 && (
                  <div className="crm-sheet-price-row">
                    <span>Discount:</span>
                    <span style={{ color: '#34d399' }}>-{formatINR(discountAmount)}</span>
                  </div>
                )}
                <div className="crm-sheet-price-row">
                  <span>Statutory GST (5%):</span>
                  <span>+{formatINR(taxAmount)}</span>
                </div>
                <div className="crm-sheet-price-row total">
                  <span>Net Booking Value:</span>
                  <strong style={{ color: '#34d399', fontSize: '1.05rem' }}>{formatINR(netBookingValue)}</strong>
                </div>
              </div>

              {/* CLP Milestones Preview Strip */}
              <span className="crm-sheet-section-title">Milestone Payment Schedule Preview</span>
              <div className="crm-wizard-clp-preview">
                {defaultMilestones.map((m, idx) => (
                  <div key={idx} className="crm-clp-preview-row">
                    <span>{m.name} ({m.pct}%)</span>
                    <strong>{formatINR(m.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: Token Deposit & Final Confirmation ───────────────────── */}
          {step === 3 && (
            <div className="crm-wizard-step-content">
              <div className="crm-form-grid">
                <div className="crm-form-group">
                  <label className="crm-form-label">Booking Token Deposit Required (₹) *</label>
                  <input
                    type="number"
                    className="crm-form-input"
                    value={bookingDepositRequired}
                    onChange={e => setBookingDepositRequired(e.target.value)}
                  />
                </div>

                <div className="crm-form-group">
                  <label className="crm-form-label">Booking Agreement Date *</label>
                  <input
                    type="date"
                    className="crm-form-input"
                    value={bookingDate}
                    onChange={e => setBookingDate(e.target.value)}
                  />
                </div>

                <div className="crm-form-group full-width">
                  <label className="crm-form-label">Booking Remarks / Special Terms</label>
                  <textarea
                    rows={2}
                    className="crm-form-input"
                    placeholder="e.g. Includes 1 covered podium car park."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="crm-wizard-summary-box">
                <div style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                  <strong>Buyer:</strong> {selectedCustomer?.fullName} ({selectedCustomer?.phone})
                </div>
                <div style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                  <strong>Unit:</strong> {selectedUnit?.unitCode} ({selectedUnit?.projectName})
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399' }}>
                  Total Package: {formatINR(netBookingValue)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Wizard Navigation Footer ──────────────────────────────────────── */}
        <div className="crm-modal-footer">
          {step > 1 && (
            <button className="crm-btn-secondary" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <button className="crm-btn-secondary" onClick={onClose} style={{ marginLeft: step === 1 ? '0' : 'auto' }}>
            Cancel
          </button>
          {step < 3 ? (
            <button className="crm-btn-primary" onClick={handleNext} style={{ marginLeft: step === 1 ? 'auto' : '0' }}>
              Next Step <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="crm-btn-primary"
              disabled={submitting}
              onClick={handleFinish}
              style={{ minWidth: '140px' }}
            >
              {submitting ? 'Committing...' : 'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

