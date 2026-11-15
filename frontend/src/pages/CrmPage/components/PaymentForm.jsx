import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Building2, AlertCircle } from 'lucide-react';
import { formatINR } from '../../../utils/money';

export default function PaymentForm({
  bookings = [],
  initialBooking = null,
  onClose,
  onSubmitPayment
}) {
  const [selectedBookingId, setSelectedBookingId] = useState(initialBooking?._id || (bookings[0]?._id || ''));
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer (NEFT/RTGS)');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNotes, setReceiptNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const selectedBooking = bookings.find(b => String(b._id) === String(selectedBookingId)) || initialBooking;
  const financials = selectedBooking?.financials || { totalOutstanding: selectedBooking?.netBookingValue || 0 };
  const outstanding = financials.totalOutstanding || 0;

  const inputAmountNum = Number(amount) || 0;
  const remainingAfterPayment = Math.max(0, outstanding - inputAmountNum);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBookingId || !amount || Number(amount) <= 0 || !transactionReference.trim()) {
      setError('Please provide booking contract, positive amount, and transaction reference.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        bookingId: selectedBookingId,
        amount: Number(amount),
        paymentMethod,
        transactionReference: transactionReference.trim(),
        paymentDate,
        receiptNotes: receiptNotes.trim()
      };

      await onSubmitPayment(payload);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-container" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <span className="crm-modal-title">
            <DollarSign size={18} style={{ color: '#34d399' }} /> Record Inward Customer Payment
          </span>
          <button className="crm-modal-close-btn" onClick={onClose} aria-label="Close payment dialog">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="crm-modal-body">
            {error && (
              <div className="crm-error-banner" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="crm-form-group">
              <label className="crm-form-label">Select Booking Contract *</label>
              <select
                className="crm-form-input"
                value={selectedBookingId}
                onChange={e => setSelectedBookingId(e.target.value)}
              >
                <option value="">Select Contract</option>
                {bookings
                  .filter(b => b.status !== 'Cancelled')
                  .map(b => (
                    <option key={b._id} value={b._id}>
                      {b.bookingReference} — {b.customerName} (Unit {b.unitCode})
                    </option>
                  ))}
              </select>
            </div>

            {selectedBooking && (
              <div className="crm-sheet-price-card" style={{ marginBottom: '1rem' }}>
                <div className="crm-sheet-price-row">
                  <span>Current Outstanding Balance:</span>
                  <strong style={{ color: '#ef4444' }}>{formatINR(outstanding)}</strong>
                </div>
                {inputAmountNum > 0 && (
                  <div className="crm-sheet-price-row total" style={{ marginTop: '0.4rem', borderTop: '1px solid var(--card-border)' }}>
                    <span>Remaining Balance After Payment:</span>
                    <strong style={{ color: '#34d399' }}>{formatINR(remainingAfterPayment)}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="crm-form-grid">
              <div className="crm-form-group">
                <label className="crm-form-label">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  className="crm-form-input"
                  placeholder="e.g. 500000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">Value Date *</label>
                <input
                  type="date"
                  required
                  className="crm-form-input"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">Payment Method *</label>
                <select
                  className="crm-form-input"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="Demand Draft">Demand Draft</option>
                  <option value="Credit/Debit Card">Credit/Debit Card</option>
                  <option value="Cash">Cash Float</option>
                </select>
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">Transaction Reference / UTR / Cheque No *</label>
                <input
                  type="text"
                  required
                  className="crm-form-input"
                  placeholder="e.g. HDFC000192847291"
                  value={transactionReference}
                  onChange={e => setTransactionReference(e.target.value)}
                />
              </div>

              <div className="crm-form-group full-width">
                <label className="crm-form-label">Receipt Remarks (Optional)</label>
                <input
                  type="text"
                  className="crm-form-input"
                  placeholder="e.g. Token payment received via RTGS"
                  value={receiptNotes}
                  onChange={e => setReceiptNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="crm-modal-footer">
            <button type="button" className="crm-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="crm-btn-primary"
              disabled={submitting || !selectedBookingId || !amount || Number(amount) <= 0 || !transactionReference.trim()}
              style={{ minHeight: '44px', minWidth: '150px' }}
            >
              {submitting ? 'Generating...' : 'Issue Official Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

