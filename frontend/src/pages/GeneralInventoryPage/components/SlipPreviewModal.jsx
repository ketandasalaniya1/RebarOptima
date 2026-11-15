import React from 'react';
import { Printer, X, FileText, CheckCircle2 } from 'lucide-react';

export default function SlipPreviewModal({
  slipData, // { type: 'INWARD'|'OUTWARD'|'RETURN', data: any }
  projectName = 'Standard Project',
  onClose
}) {
  if (!slipData || !slipData.data) return null;

  const { type, data } = slipData;

  const title =
    type === 'INWARD'
      ? 'Goods Receipt Note (GRN) Slip'
      : type === 'RETURN'
      ? 'Material Return Voucher'
      : 'Material Issue Voucher (Outward)';

  const referenceNumber =
    type === 'INWARD'
      ? data.inwardNumber || 'GRN-SLIP'
      : type === 'RETURN'
      ? data.returnNumber || 'RET-SLIP'
      : data.outwardNumber || 'OUT-SLIP';

  const slipDate =
    type === 'INWARD'
      ? data.receiptDate
        ? new Date(data.receiptDate).toLocaleDateString()
        : '—'
      : type === 'RETURN'
      ? data.returnDate
        ? new Date(data.returnDate).toLocaleDateString()
        : '—'
      : data.issueDateTime
      ? new Date(data.issueDateTime).toLocaleString()
      : '—';

  return (
    <div className="gi-modal-backdrop" onClick={onClose}>
      <div className="gi-modal lg gi-slip-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="gi-modal-header no-print">
          <h2>{title}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="gi-btn-primary"
              onClick={() => window.print()}
            >
              <Printer size={15} /> Print Slip
            </button>
            <button
              type="button"
              className="gi-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="gi-modal-body" style={{ background: '#f8fafc', padding: '1.5rem' }}>
          <div className="gi-slip-container">
            {/* Header banner */}
            <div className="gi-slip-header">
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  REBAROPTIMA
                </h1>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  Site Inventory & Store Management Register
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>
                  {referenceNumber}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Date: {slipDate}
                </div>
              </div>
            </div>

            {/* Meta Information Grid */}
            <div className="gi-slip-meta-grid">
              <div>
                <strong>Project:</strong> {projectName}
              </div>
              <div>
                <strong>Store / Godown:</strong> {data.storeName || 'Main Store'}
              </div>

              {type === 'INWARD' ? (
                <>
                  <div>
                    <strong>Vendor:</strong> {data.vendorName || '—'}
                  </div>
                  <div>
                    <strong>Challan / DC #:</strong> {data.vendorChallanNumber || '—'}
                  </div>
                  <div>
                    <strong>Invoice #:</strong> {data.invoiceNumber || 'N/A'}
                  </div>
                  <div>
                    <strong>Received By:</strong> {data.receivedBy?.name || 'Store Incharge'}
                  </div>
                </>
              ) : type === 'RETURN' ? (
                <>
                  <div>
                    <strong>Returned By:</strong> {data.returnedByPerson || '—'}
                  </div>
                  <div>
                    <strong>Return Type:</strong> {data.returnType || 'BORROWED'}
                  </div>
                  <div>
                    <strong>Original Issue #:</strong> {data.outwardNumber || '—'}
                  </div>
                  <div>
                    <strong>Store Receiver:</strong> {data.receivedBy?.name || 'Store Incharge'}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>Issued To:</strong> {data.personReceiving || '—'}
                  </div>
                  <div>
                    <strong>Agency / Contractor:</strong> {data.agency || 'Not Applicable'}
                  </div>
                  <div>
                    <strong>Location:</strong> {data.location || 'Site General'}
                  </div>
                  <div>
                    <strong>Classification:</strong> {data.returnClassification || 'non-returnable'}
                  </div>
                  {data.expectedReturnDate && (
                    <div>
                      <strong>Expected Return:</strong> {new Date(data.expectedReturnDate).toLocaleDateString()}
                    </div>
                  )}
                  <div>
                    <strong>Issued By:</strong> {data.issuedBy?.name || 'Store Incharge'}
                  </div>
                </>
              )}
            </div>

            {/* Table of Items */}
            <table className="gi-slip-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Material Item</th>
                  <th>Quantity</th>
                  <th>UOM</th>
                  <th>Status / Notes</th>
                </tr>
              </thead>
              <tbody>
                {type === 'INWARD' ? (
                  (data.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{it.materialName}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{it.acceptedQuantity ?? it.receivedQuantity}</div>
                        {it.receivedQuantity && it.receivedQuantity !== it.acceptedQuantity && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Challan: {it.receivedQuantity} {it.uom}
                          </div>
                        )}
                      </td>
                      <td>{it.uom || 'Nos'}</td>
                      <td>
                        <div>Accepted: {it.acceptedQuantity ?? it.receivedQuantity} {it.uom}</div>
                        {it.damagedQuantity > 0 && (
                          <div style={{ color: '#d97706', fontSize: '0.78rem', fontWeight: 600 }}>
                            Damaged in Transit: {it.damagedQuantity} {it.uom}
                          </div>
                        )}
                        {it.rejectedQuantity > 0 && (
                          <div style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: 600 }}>
                            Rejected / Vendor Shortage: {it.rejectedQuantity} {it.uom}
                          </div>
                        )}
                        {it.remarks && (
                          <div style={{ fontSize: '0.75rem', color: '#0f172a', background: '#fef3c7', padding: '0.2rem 0.4rem', borderRadius: '4px', marginTop: '0.25rem', border: '1px solid #fde68a' }}>
                            <strong>Discrepancy Reason:</strong> {it.remarks}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : type === 'RETURN' ? (
                  <tr>
                    <td>1</td>
                    <td>
                      <strong>{data.materialName || 'Returned Item'}</strong>
                    </td>
                    <td>{data.acceptedQuantity ?? 1}</td>
                    <td>{data.uom || 'Nos'}</td>
                    <td>
                      Good: {data.acceptedQuantity ?? 1}
                      {data.damagedQuantity > 0 && ` | Damaged: ${data.damagedQuantity}`}
                      {data.missingQuantity > 0 && ` | Missing: ${data.missingQuantity}`}
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td>1</td>
                    <td>
                      <strong>{data.materialName}</strong>
                    </td>
                    <td>{data.quantity}</td>
                    <td>{data.uom || 'Nos'}</td>
                    <td>
                      {data.returnClassification === 'returnable'
                        ? `Returnable (Due: ${data.expectedReturnDate ? new Date(data.expectedReturnDate).toLocaleDateString() : 'N/A'})`
                        : 'Consumable (Non-Returnable)'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {data.remarks && (
              <div style={{ fontSize: '0.85rem', marginTop: '1rem', padding: '0.5rem 0.75rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong>Remarks / Notes:</strong> {data.remarks}
              </div>
            )}

            {/* Signatures */}
            <div className="gi-slip-signatures">
              <div className="gi-sign-box">
                <div>Issued / Received By</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: '#475569' }}>
                  {type === 'INWARD'
                    ? data.receivedBy?.name || 'Receiver Sign'
                    : type === 'RETURN'
                    ? data.returnedByPerson || 'Returnee Sign'
                    : data.personReceiving || 'Borrower Sign'}
                </div>
              </div>
              <div className="gi-sign-box">
                <div>Store Incharge / Authorized Signatory</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: '#475569' }}>
                  RebarOptima Site Inventory
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

