import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, ShieldCheck, RotateCcw, Ban, ArrowRight, Scale, Clock, User, FileText } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function ConsumptionApprovalModal({
  isOpen,
  onClose,
  event,
  onActionComplete
}) {
  if (!isOpen || !event) return null;

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [consumptionRecord, setConsumptionRecord] = useState(null);
  const [stockBalances, setStockBalances] = useState({});
  const [approvalRemarks, setApprovalRemarks] = useState('');
  
  // Reversal / Rejection Modal State
  const [showReversalPrompt, setShowReversalPrompt] = useState(false);
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadRecordAndStock();
  }, [event]);

  const loadRecordAndStock = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const eventId = event.id || event._id;
      const recRes = await castingApi.getConsumptionRecords(eventId);
      const records = recRes?.data || [];
      const record = records.find(r => r.status === 'SUBMITTED') || records.find(r => r.status === 'APPROVED_POSTED') || records[records.length - 1];
      setConsumptionRecord(record || null);

      // Load project stock balances if project exists
      if (event.projectId) {
        const stockRes = await castingApi.getProjectStock(event.projectId);
        const map = {};
        (stockRes?.data || []).forEach(st => {
          map[st.materialIdentifier] = st.currentBalance;
        });
        setStockBalances(map);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load consumption details');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndPost = async () => {
    if (!consumptionRecord) return;
    setIsProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const eventId = event.id || event._id;
      const cid = consumptionRecord._id || consumptionRecord.id;
      const res = await castingApi.approveAndPostConsumption(eventId, cid, approvalRemarks);
      
      setSuccessMsg(`Posting committed successfully! Receipt: ${res?.data?.postingNumber || res?.data?.postingKey}`);
      setTimeout(() => {
        if (onActionComplete) onActionComplete();
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to approve and post consumption');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!consumptionRecord || !rejectionReason.trim()) {
      setErrorMsg('Rejection reason is required.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const eventId = event.id || event._id;
      const cid = consumptionRecord._id || consumptionRecord.id;
      await castingApi.rejectConsumption(eventId, cid, rejectionReason);
      
      setSuccessMsg('Consumption record rejected and returned to draft status.');
      setTimeout(() => {
        if (onActionComplete) onActionComplete();
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reject consumption record');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReverse = async () => {
    if (!consumptionRecord || !reversalReason.trim() || reversalReason.trim().length < 5) {
      setErrorMsg('Mandatory reversal reason is required (minimum 5 characters).');
      return;
    }
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const eventId = event.id || event._id;
      const cid = consumptionRecord._id || consumptionRecord.id;
      const res = await castingApi.reverseConsumption(eventId, cid, reversalReason);
      
      setSuccessMsg(`Posting reversed successfully! Compensating Reversal Key: ${res?.data?.reversalKey}`);
      setTimeout(() => {
        if (onActionComplete) onActionComplete();
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to execute stock reversal');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="casting-modal-backdrop">
      <div className="casting-modal" style={{ maxWidth: '850px', width: '95%' }}>
        <div className="casting-modal-header" style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldCheck size={20} color="#38bdf8" />
              <h3 className="casting-modal-title" style={{ margin: 0 }}>Maker-Checker Consumption Review & Inventory Posting</h3>
            </div>
            <span style={{ fontSize: '0.825rem', color: '#94a3b8', display: 'block', marginTop: '0.25rem' }}>
              Event: <strong style={{ color: '#f8fafc' }}>{event.eventNumber}</strong> — {event.title}
            </span>
          </div>
          <button className="casting-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="casting-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '1.25rem' }}>
          {errorMsg && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <CheckCircle2 size={16} />
              {successMsg}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <div className="casting-spinner" style={{ margin: '0 auto 1rem' }} />
              Loading submitted consumption records and project stock balances...
            </div>
          ) : !consumptionRecord ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 1rem', color: '#facc15' }} />
              No consumption record has been drafted or submitted for this casting event yet.
            </div>
          ) : (
            <>
              {/* Record Summary Card */}
              <div style={{ background: 'var(--card-bg, rgba(30, 41, 59, 0.6))', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem', border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary, #94a3b8)' }}>Status</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span className={`status-badge ${consumptionRecord.status === 'APPROVED_POSTED' ? 'success' : (consumptionRecord.status === 'SUBMITTED' ? 'warning' : 'neutral')}`}>
                        {consumptionRecord.status}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                        MRS Baseline: <strong>R{consumptionRecord.mrsRevisionNumber}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Submitted By</span>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary, #f8fafc)' }}>
                      {consumptionRecord.createdBy?.name || 'Site Engineer'} ({consumptionRecord.createdBy?.role || 'Engineer'})
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--card-border, #334155)', fontSize: '0.825rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Actual Pour Date:</span> <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{consumptionRecord.actualPourDate}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Total Actual Volume:</span> <strong style={{ color: 'var(--accent, #38bdf8)' }}>{(consumptionRecord.totalActualVolumeM3 || 0).toFixed(3)} m³</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Batching Plant:</span> <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{consumptionRecord.batchingPlantName || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              {/* Material Lines & Stock Check Table */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Scale size={15} color="var(--accent, #10b981)" /> Material Deductions & Project Store Stock Check
                </h4>

                <div className="casting-table-wrapper" style={{ background: 'var(--main-bg, #0f172a)', borderRadius: '8px', border: '1px solid var(--card-border, #334155)' }}>
                  <table className="casting-table" style={{ width: '100%', fontSize: '0.825rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--card-bg, #1e293b)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Material</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Deduction Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Store Stock</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Stock Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(consumptionRecord.materialsConsumed || []).map((mat, idx) => {
                        const currentStock = stockBalances[mat.materialIdentifier] !== undefined ? stockBalances[mat.materialIdentifier] : 0;
                        const isSufficient = mat.isUntrackedBulk || currentStock >= mat.actualQuantity;

                        return (
                          <tr key={mat.materialIdentifier || idx} style={{ borderBottom: '1px solid var(--card-border, #1e293b)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>{mat.name}</div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary, #94a3b8)' }}>{mat.materialIdentifier}</div>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                              {mat.actualQuantity} {mat.unit}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8' }}>
                              {mat.isUntrackedBulk ? 'Bulk (Unlimited)' : `${currentStock.toFixed(2)} ${mat.unit}`}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {mat.isUntrackedBulk ? (
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Untracked</span>
                              ) : isSufficient ? (
                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>Sufficient</span>
                              ) : (
                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 600 }}>Insufficient Stock</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approval Remarks Input */}
              {consumptionRecord.status === 'SUBMITTED' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Approval Remarks / Sign-off Comments
                  </label>
                  <input
                    type="text"
                    className="casting-input"
                    value={approvalRemarks}
                    onChange={(e) => setApprovalRemarks(e.target.value)}
                    placeholder="e.g. Reviewed batch slips and slump test reports; approved for ledger posting."
                    style={{ width: '100%', background: '#0f172a' }}
                  />
                </div>
              )}

              {/* Reversal Prompt Modal */}
              {showReversalPrompt && (
                <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: 600, marginBottom: '6px' }}>
                    <AlertTriangle size={16} /> Confirm 100% Full Stock Reversal
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0 0 8px' }}>
                    This will restore 100% of the originally deducted materials back into the project store via compensating reversal ledger transactions and reset member poured volumes.
                  </p>
                  <input
                    type="text"
                    className="casting-input"
                    placeholder="Mandatory reversal reason (min. 5 chars)..."
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', marginBottom: '8px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="casting-btn secondary" onClick={() => setShowReversalPrompt(false)}>Cancel</button>
                    <button className="casting-btn danger" onClick={handleReverse} disabled={isProcessing || reversalReason.trim().length < 5}>
                      Confirm Full Reversal
                    </button>
                  </div>
                </div>
              )}

              {/* Reject Prompt Modal */}
              {showRejectPrompt && (
                <div style={{ padding: '1rem', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fb923c', fontWeight: 600, marginBottom: '6px' }}>
                    <Ban size={16} /> Reject Consumption Record
                  </div>
                  <input
                    type="text"
                    className="casting-input"
                    placeholder="Enter reason for rejection (returned to draft)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', marginBottom: '8px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="casting-btn secondary" onClick={() => setShowRejectPrompt(false)}>Cancel</button>
                    <button className="casting-btn danger" onClick={handleReject} disabled={isProcessing || !rejectionReason.trim()}>
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="casting-modal-footer" style={{ borderTop: '1px solid #334155', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="casting-btn secondary" onClick={onClose} disabled={isProcessing}>
            Close
          </button>

          {consumptionRecord && consumptionRecord.status === 'SUBMITTED' && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="casting-btn danger"
                onClick={() => setShowRejectPrompt(true)}
                disabled={isProcessing || showRejectPrompt}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Ban size={15} /> Reject
              </button>
              <button
                className="casting-btn primary"
                onClick={handleApproveAndPost}
                disabled={isProcessing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#22c55e' }}
              >
                <ShieldCheck size={15} /> Approve & Atomic Post to Inventory
              </button>
            </div>
          )}

          {consumptionRecord && consumptionRecord.status === 'APPROVED_POSTED' && !showReversalPrompt && (
            <button
              className="casting-btn danger"
              onClick={() => setShowReversalPrompt(true)}
              disabled={isProcessing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={15} /> Execute Full Reversal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
