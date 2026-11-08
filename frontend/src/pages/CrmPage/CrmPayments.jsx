import React from 'react';
import { formatWhen } from './crmFormat';

export default function CrmPayments({ payments, onOpenReceipt }) {
  return (
    <div className="crm-desk">
      <div className="crm-desk-hello">
        <h2>Payments</h2>
      </div>
      <div className="crm-desk-table-wrap">
        <table className="crm-desk-table">
          <thead><tr><th>Receipt</th><th>Customer</th><th>Booking</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(payments || []).map((p) => (
              <tr key={p._id}>
                <td>{p.receiptNumber || p.paymentReference}</td>
                <td>{p.customerName}</td>
                <td>{p.bookingReference}</td>
                <td>{formatWhen(p.paymentDate)}</td>
                <td>{p.paymentStatus}</td>
                <td><button type="button" className="crm-btn-secondary" onClick={() => onOpenReceipt(p._id)}>Receipt</button></td>
              </tr>
            ))}
            {!payments?.length && <tr><td colSpan={6}>No payments recorded for this project.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
