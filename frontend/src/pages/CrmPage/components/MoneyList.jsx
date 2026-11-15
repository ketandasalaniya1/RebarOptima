import React, { useState } from 'react';
import {
  DollarSign, Plus, Printer, RotateCcw, AlertTriangle,
  ChevronDown, ChevronUp, CheckCircle2, Clock, X
} from 'lucide-react';
import { formatINR, formatShortINR } from '../../../utils/money';

export default function MoneyList({
  bookings = [],
  payments = [],
  onOpenRecordPayment,
  onOpenReceipt,
  onCancelBooking,
  onReversePayment
}) {
  const [expandedBookingId, setExpandedBookingId] = useState(null);
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reverseModalPayment, setReverseModalPayment] = useState(null);
  const [reverseReason, setReverseReason] = useState('');

  const toggleExpand = (bId) => {
    setExpandedBookingId(expandedBookingId === bId ? null : bId);
  };

  const handleConfirmCancel = () => {
    if (!cancelModalBooking || !cancelReason.trim()) return;
    onCancelBooking(cancelModalBooking._id, cancelReason.trim());
    setCancelModalBooking(null);
    setCancelReason('');
  };

  const handleConfirmReverse = () => {
    if (!reverseModalPayment || !reverseReason.trim()) return;
    onReversePayment(reverseModalPayment._id, reverseReason.trim());
    setReverseModalPayment(null);
    setReverseReason('');
  };

  return (
    <div className="crm-money-screen">
      {/* ── Sub-header Bar with Record Payment CTA ──────────────────────────── */}
      <div className="crm-card-header" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <span className="crm-card-title">
            <DollarSign size={20} style={{ color: '#34d399' }} /> Bookings Ledger &amp; Inward Payments
          </span>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Track construction-linked milestone collections, overdue demands, and official tax receipts.
          </div>
        </div>

        <button
          className="crm-btn-primary"
          onClick={() => onOpenRecordPayment()}
          style={{ minHeight: '44px', padding: '0.65rem 1.25rem' }}
        >
          <Plus size={16} /> Record Inward Payment
        </button>
      </div>

      {/* ── Bookings Financial Cards List ───────────────────────────────────── */}
      <div className="crm-bookings-money-grid">
        {bookings.length === 0 ? (
          <div className="crm-card">
            <div className="crm-empty-state" style={{ padding: '3.5rem 1rem' }}>
              <DollarSign size={42} style={{ color: 'var(--text-label)', marginBottom: '0.75rem' }} />
              <p style={{ fontWeight: 600 }}>No bookings recorded yet</p>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Convert interested buyers to bookings from the Inventory or Leads tab.
              </span>
            </div>
          </div>
        ) : (
          bookings.map(booking => {
            const financials = booking.financials || {
              netBookingValue: booking.netBookingValue || booking.agreementPrice,
              totalReceived: 0,
              totalOutstanding: booking.netBookingValue || booking.agreementPrice,
              overdueAmount: 0,
              collectionProgressPercent: 0
            };

            const isExpanded = expandedBookingId === booking._id;
            const progress = financials.collectionProgressPercent || 0;
            const hasOverdue = (financials.overdueAmount || 0) > 0;

            const bookingPayments = payments.filter(p => String(p.bookingId) === String(booking._id));

            return (
              <div key={booking._id} className="crm-booking-money-card">
                <div className="crm-booking-money-header" onClick={() => toggleExpand(booking._id)}>
                  <div className="crm-booking-money-title-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: 'var(--accent)', fontSize: '0.95rem' }}>
                        {booking.bookingReference}
                      </strong>
                      <span className={`crm-badge crm-badge-stage-${booking.status === 'Confirmed' ? 'booked' : (booking.status === 'Cancelled' ? 'lost' : 'qualified')}`}>
                        {booking.status}
                      </span>
                      {hasOverdue && (
                        <span className="crm-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                          Overdue: {formatShortINR(financials.overdueAmount)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                      <strong>{booking.customerName}</strong> ({booking.customerPhone}) • Unit <strong>{booking.unitCode}</strong> ({booking.projectName})
                    </div>
                  </div>

                  <div className="crm-booking-money-values">
                    <div className="val-box">
                      <span>Net Value</span>
                      <strong>{formatShortINR(financials.netBookingValue)}</strong>
                    </div>
                    <div className="val-box">
                      <span>Collected</span>
                      <strong style={{ color: '#34d399' }}>{formatShortINR(financials.totalReceived)}</strong>
                    </div>
                    <div className="val-box">
                      <span>Balance</span>
                      <strong>{formatShortINR(financials.totalOutstanding)}</strong>
                    </div>
                    <button className="crm-btn-icon-subtle" aria-label="Expand booking ledger">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Collection Progress Bar */}
                <div className="crm-booking-progress-rail">
                  <div
                    className="crm-booking-progress-fill"
                    style={{
                      width: `${progress}%`,
                      background: progress >= 100 ? '#34d399' : (progress > 30 ? 'var(--accent)' : '#f59e0b')
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-label)', padding: '0.25rem 0' }}>
                  <span>Collection Progress: {progress}%</span>
                  <span>{financials.isFullyPaid ? 'Fully Paid 🎉' : `Remaining: ${formatINR(financials.totalOutstanding)}`}</span>
                </div>

                {/* ── Expanded Ledger & Milestone Drawer ─────────────────────── */}
                {isExpanded && (
                  <div className="crm-booking-expanded-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span className="crm-sheet-section-title" style={{ margin: 0 }}>
                        Payments Received ({bookingPayments.length})
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="crm-btn-primary"
                          style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
                          onClick={() => onOpenRecordPayment(booking)}
                        >
                          + Record Payment
                        </button>
                        {booking.status !== 'Cancelled' && (
                          <button
                            className="crm-btn-secondary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', color: '#ef4444' }}
                            onClick={() => setCancelModalBooking(booking)}
                          >
                            Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>

                    {bookingPayments.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-label)', padding: '0.5rem 0' }}>
                        No payments received yet for this contract.
                      </div>
                    ) : (
                      <div className="crm-table-container">
                        <table className="crm-table" style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>Receipt No</th>
                              <th>Date</th>
                              <th>Method</th>
                              <th>UTR / Reference</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookingPayments.map(p => (
                              <tr key={p._id}>
                                <td><strong style={{ color: 'var(--accent)' }}>{p.receiptNumber}</strong></td>
                                <td>{new Date(p.paymentDate).toLocaleDateString()}</td>
                                <td>{p.paymentMethod}</td>
                                <td><code>{p.transactionReference}</code></td>
                                <td><strong style={{ color: p.paymentStatus === 'Paid' ? '#34d399' : 'inherit' }}>{formatINR(p.amount)}</strong></td>
                                <td>
                                  <span className={`crm-badge ${p.paymentStatus === 'Paid' ? 'status-booked' : 'status-blocked'}`}>
                                    {p.paymentStatus}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    <button
                                      className="crm-btn-secondary"
                                      style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                                      onClick={() => onOpenReceipt(p._id)}
                                      title="Print Tax Receipt"
                                    >
                                      <Printer size={12} /> Receipt
                                    </button>
                                    {p.paymentStatus === 'Paid' && (
                                      <button
                                        className="crm-btn-secondary"
                                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#ef4444' }}
                                        onClick={() => setReverseModalPayment(p)}
                                        title="Reverse Payment"
                                      >
                                        <RotateCcw size={12} /> Reverse
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Cancel Booking Confirmation Dialog ──────────────────────────────── */}
      {cancelModalBooking && (
        <div className="crm-modal-overlay" onClick={() => setCancelModalBooking(null)}>
          <div className="crm-modal-container" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="crm-modal-header">
              <span className="crm-modal-title" style={{ color: '#ef4444' }}>
                <AlertTriangle size={18} /> Cancel Booking {cancelModalBooking.bookingReference}
              </span>
              <button className="crm-modal-close-btn" onClick={() => setCancelModalBooking(null)}>×</button>
            </div>
            <div className="crm-modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                Cancelling this booking will automatically release <strong>Unit {cancelModalBooking.unitCode}</strong> back to Available inventory.
              </p>
              <label className="crm-form-label">Mandatory Cancellation Reason *</label>
              <textarea
                rows={2}
                required
                className="crm-form-input"
                placeholder="e.g. Bank loan rejected, customer opted for mutual refund"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
            </div>
            <div className="crm-modal-footer">
              <button className="crm-btn-secondary" onClick={() => setCancelModalBooking(null)}>Dismiss</button>
              <button
                className="crm-btn-primary"
                style={{ background: '#ef4444' }}
                disabled={!cancelReason.trim()}
                onClick={handleConfirmCancel}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reverse Payment Confirmation Dialog ─────────────────────────────── */}
      {reverseModalPayment && (
        <div className="crm-modal-overlay" onClick={() => setReverseModalPayment(null)}>
          <div className="crm-modal-container" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="crm-modal-header">
              <span className="crm-modal-title" style={{ color: '#ef4444' }}>
                <RotateCcw size={18} /> Reverse Payment {reverseModalPayment.receiptNumber}
              </span>
              <button className="crm-modal-close-btn" onClick={() => setReverseModalPayment(null)}>×</button>
            </div>
            <div className="crm-modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                Reversing will create a linked negative ledger entry for <strong>{formatINR(reverseModalPayment.amount)}</strong> and restore milestone balances.
              </p>
              <label className="crm-form-label">Mandatory Reversal Reason *</label>
              <input
                type="text"
                required
                className="crm-form-input"
                placeholder="e.g. Cheque returned / signature mismatch"
                value={reverseReason}
                onChange={e => setReverseReason(e.target.value)}
              />
            </div>
            <div className="crm-modal-footer">
              <button className="crm-btn-secondary" onClick={() => setReverseModalPayment(null)}>Dismiss</button>
              <button
                className="crm-btn-primary"
                style={{ background: '#ef4444' }}
                disabled={!reverseReason.trim()}
                onClick={handleConfirmReverse}
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

