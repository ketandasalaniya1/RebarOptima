import React from 'react';
import { X, Printer, Share2, CheckCircle2 } from 'lucide-react';
import { formatINR } from '../../../utils/money';

export default function ReceiptView({
  receipt = null,
  payment = null,
  booking = null,
  onClose
}) {
  if (!payment && !receipt) return null;

  const receiptData = receipt || {
    receiptNumber: payment?.receiptNumber || 'REC-TEMP',
    paymentReference: payment?.paymentReference || 'TXN-TEMP',
    receiptDate: payment?.paymentDate || new Date().toISOString().split('T')[0],
    customerName: booking?.customerName || payment?.customerName || 'Valued Customer',
    customerPhone: booking?.customerPhone || payment?.customerPhone || '',
    unitNumber: booking?.unitNumber || payment?.unitNumber || 'Unit -',
    projectName: booking?.projectName || payment?.projectName || 'Project',
    amount: payment?.amount || 0,
    paymentMethod: payment?.paymentMethod || 'Bank Transfer',
    transactionReference: payment?.transactionReference || 'N/A',
    notes: payment?.receiptNotes || ''
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const text = `*OFFICIAL PAYMENT RECEIPT*
Receipt No: ${receiptData.receiptNumber}
Date: ${new Date(receiptData.receiptDate).toLocaleDateString('en-IN')}
Received From: ${receiptData.customerName}
Project: ${receiptData.projectName}
Unit: ${receiptData.unitNumber}
Amount Paid: ${formatINR(receiptData.amount)}
Payment Mode: ${receiptData.paymentMethod}
Ref/UTR: ${receiptData.transactionReference}

Thank you for your payment!`;

    const encoded = encodeURIComponent(text);
    const phone = receiptData.customerPhone ? receiptData.customerPhone.replace(/\D/g, '') : '';
    const url = phone ? `https://wa.me/91${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div
        className="crm-receipt-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary, #ffffff)',
          color: 'var(--text-primary, #1e293b)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header Actions (hidden in print) */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-secondary, #f8fafc)'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Payment Receipt</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.85rem'
              }}
            >
              <Printer size={16} /> Print
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#25D366',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.85rem'
              }}
            >
              <Share2 size={16} /> WhatsApp
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: '6px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div id="crm-printable-receipt" style={{ padding: '32px 36px' }}>
          {/* Top Brand & RERA Info */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '20px',
            marginBottom: '24px'
          }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#0f172a' }}>
                {receiptData.projectName || 'RebarOptima Realty'}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                RERA Registered Real Estate Development
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-block',
                background: '#dcfce7',
                color: '#15803d',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                marginBottom: '6px'
              }}>
                PAYMENT CONFIRMED
              </span>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Receipt #: <strong style={{ color: '#0f172a' }}>{receiptData.receiptNumber}</strong>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Date: {new Date(receiptData.receiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Customer & Unit Details */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            background: '#f8fafc',
            padding: '16px 20px',
            borderRadius: '10px',
            marginBottom: '24px'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: "none", color: '#64748b', fontWeight: 600 }}>Received From</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                {receiptData.customerName}
              </div>
              {receiptData.customerPhone && (
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  Phone: {receiptData.customerPhone}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: "none", color: '#64748b', fontWeight: 600 }}>Property / Unit</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                Unit {receiptData.unitNumber}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                {receiptData.projectName}
              </div>
            </div>
          </div>

          {/* Amount Paid Box */}
          <div style={{
            border: '1.5px solid #0f172a',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            background: '#ffffff',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: "none" }}>Amount Received</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
              {formatINR(receiptData.amount)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>
              Received via {receiptData.paymentMethod} (Ref / UTR: {receiptData.transactionReference})
            </div>
          </div>

          {/* Payment Breakdown Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#64748b' }}>
                <th style={{ padding: '8px 0', fontWeight: 600 }}>Particulars</th>
                <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 0' }}>Installment / Milestone Inward Payment</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>{formatINR(receiptData.amount)}</td>
              </tr>
              {booking && (
                <>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 0', color: '#64748b' }}>Total Contract Value (Inclusive of GST)</td>
                    <td style={{ padding: '10px 0', textAlign: 'right', color: '#64748b' }}>{formatINR(booking.netBookingValue || 0)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 0', color: '#64748b' }}>Cumulative Received Till Date</td>
                    <td style={{ padding: '10px 0', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                      {formatINR((booking.financials?.totalPaid || 0) + (payment ? 0 : receiptData.amount))}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {receiptData.notes && (
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '24px' }}>
              <strong>Remarks:</strong> {receiptData.notes}
            </div>
          )}

          {/* Footer Signature */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: '32px',
            borderTop: '1px dashed #cbd5e1',
            marginTop: '20px'
          }}>
            <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", maxWidth: '320px', lineHeight: 1.4 }}>
              * This is a computer-generated receipt valid subject to realization of cheque / UTR clearance.
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ height: '40px' }}></div>
              <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontSize: '0.82rem', fontWeight: 600 }}>
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

