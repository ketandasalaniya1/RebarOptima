import React, { useState } from 'react';
import {
  ClipboardCheck,
  ArrowRightLeft,
  RefreshCw,
  ShieldAlert,
  Plus,
  Calendar,
  User,
  AlertTriangle
} from 'lucide-react';

export default function AuditHub({
  transfers = [],
  verifications = [],
  adjustments = [],
  incidents = [],
  stores = [],
  onOpenTransfer,
  onOpenVerification,
  onOpenAdjustment,
  onOpenIncident
}) {
  const [subTab, setSubTab] = useState('transfers'); // 'transfers' | 'verification' | 'adjustments' | 'incidents'

  return (
    <div className="gi-workspace">
      {/* Sub-navigation bar inside Audit */}
      <div className="gi-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="gi-toolbar-left" style={{ gap: '0.5rem' }}>
          <button
            type="button"
            className={`gi-sub-pill ${subTab === 'transfers' ? 'active' : ''}`}
            onClick={() => setSubTab('transfers')}
          >
            <ArrowRightLeft size={15} />
            <span>Store Transfers ({transfers.length})</span>
          </button>
          <button
            type="button"
            className={`gi-sub-pill ${subTab === 'verification' ? 'active' : ''}`}
            onClick={() => setSubTab('verification')}
          >
            <ClipboardCheck size={15} />
            <span>Physical Counts ({verifications.length})</span>
          </button>
          <button
            type="button"
            className={`gi-sub-pill ${subTab === 'adjustments' ? 'active' : ''}`}
            onClick={() => setSubTab('adjustments')}
          >
            <RefreshCw size={15} />
            <span>Adjustments ({adjustments.length})</span>
          </button>
          <button
            type="button"
            className={`gi-sub-pill ${subTab === 'incidents' ? 'active' : ''}`}
            onClick={() => setSubTab('incidents')}
          >
            <ShieldAlert size={15} />
            <span>Incident Reports ({incidents.length})</span>
          </button>
        </div>

        <div className="gi-toolbar-right">
          {subTab === 'transfers' && (
            <button type="button" className="gi-btn-primary" onClick={onOpenTransfer}>
              <Plus size={16} /> <span>New Store Transfer</span>
            </button>
          )}
          {subTab === 'verification' && (
            <button type="button" className="gi-btn-primary" onClick={onOpenVerification}>
              <Plus size={16} /> <span>Record Audit Count</span>
            </button>
          )}
          {subTab === 'adjustments' && (
            <button type="button" className="gi-btn-primary" onClick={onOpenAdjustment}>
              <Plus size={16} /> <span>New Stock Adjustment</span>
            </button>
          )}
          {subTab === 'incidents' && (
            <button type="button" className="gi-btn-primary" style={{ background: '#dc2626' }} onClick={onOpenIncident}>
              <Plus size={16} /> <span>Report Incident</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab 1: Transfers */}
      {subTab === 'transfers' && (
        <div className="gi-table-card">
          <div className="gi-table-wrapper">
            <table className="gi-table">
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Date</th>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Source Store</th>
                  <th>Destination Store</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem' }}>
                      No inter-store transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id || t._id}>
                      <td>
                        <strong style={{ color: 'var(--accent)' }}>{t.transferNumber}</strong>
                      </td>
                      <td>{t.transferDate ? new Date(t.transferDate).toLocaleDateString() : '—'}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.materialName}</div>
                      </td>
                      <td>
                        <strong>{t.quantity}</strong> {t.uom}
                      </td>
                      <td>{t.sourceStoreName || 'Source'}</td>
                      <td>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                          {t.destinationStoreName || 'Destination'}
                        </span>
                      </td>
                      <td>{t.reference || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Verifications */}
      {subTab === 'verification' && (
        <div className="gi-table-card">
          <div className="gi-table-wrapper">
            <table className="gi-table">
              <thead>
                <tr>
                  <th>Audit Ref</th>
                  <th>Date</th>
                  <th>Material</th>
                  <th>System Count</th>
                  <th>Physical Count</th>
                  <th>Variance</th>
                  <th>Verified By</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {verifications.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem' }}>
                      No physical count audits recorded.
                    </td>
                  </tr>
                ) : (
                  verifications.map((v) => {
                    const variance = v.variance ?? 0;
                    return (
                      <tr key={v.id || v._id}>
                        <td>
                          <strong style={{ color: 'var(--accent)' }}>{v.verificationNumber}</strong>
                        </td>
                        <td>{v.verificationDate ? new Date(v.verificationDate).toLocaleDateString() : '—'}</td>
                        <td>
                          <strong>{v.materialName}</strong>
                        </td>
                        <td>{v.systemQuantity} {v.uom}</td>
                        <td>
                          <strong>{v.physicalQuantity}</strong> {v.uom}
                        </td>
                        <td>
                          <span
                            className={`gi-badge ${variance === 0 ? 'normal' : variance < 0 ? 'out' : 'low'}`}
                          >
                            {variance > 0 ? `+${variance}` : variance} {v.uom}
                          </span>
                        </td>
                        <td>{v.verifiedBy?.name || 'Store Incharge'}</td>
                        <td>{v.remarks || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 3: Adjustments */}
      {subTab === 'adjustments' && (
        <div className="gi-table-card">
          <div className="gi-table-wrapper">
            <table className="gi-table">
              <thead>
                <tr>
                  <th>Adjustment #</th>
                  <th>Date</th>
                  <th>Material</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Reason</th>
                  <th>Authorized By</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem' }}>
                      No stock adjustments authorized yet.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((a) => (
                    <tr key={a.id || a._id}>
                      <td>
                        <strong style={{ color: 'var(--accent)' }}>{a.adjustmentNumber}</strong>
                      </td>
                      <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}</td>
                      <td>
                        <strong>{a.materialName}</strong>
                      </td>
                      <td>
                        <span className={`gi-badge ${a.adjustmentType === 'ADD' ? 'normal' : 'out'}`}>
                          {a.adjustmentType === 'ADD' ? '+ ADD STOCK' : '− DEDUCT STOCK'}
                        </span>
                      </td>
                      <td>
                        <strong>{a.quantity}</strong> {a.uom}
                      </td>
                      <td>{a.reason}</td>
                      <td>{a.authorizedBy?.name || 'Project Manager'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 4: Incidents */}
      {subTab === 'incidents' && (
        <div className="gi-table-card">
          <div className="gi-table-wrapper">
            <table className="gi-table">
              <thead>
                <tr>
                  <th>Incident #</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Reported By</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem' }}>
                      No loss or damage incidents recorded.
                    </td>
                  </tr>
                ) : (
                  incidents.map((inc) => (
                    <tr key={inc.id || inc._id}>
                      <td>
                        <strong style={{ color: '#dc2626' }}>{inc.incidentNumber}</strong>
                      </td>
                      <td>{inc.date ? new Date(inc.date).toLocaleDateString() : '—'}</td>
                      <td>
                        <span className="gi-badge out">{inc.incidentType}</span>
                      </td>
                      <td>
                        <strong>{inc.materialName}</strong>
                      </td>
                      <td>
                        <strong>{inc.quantity}</strong> {inc.uom}
                      </td>
                      <td>{inc.reportedBy}</td>
                      <td>{inc.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

