import React, { useState, useEffect } from 'react';
import { X, Package, Plus, FileText, ArrowDownLeft, ArrowUpRight, RotateCcw, AlertCircle, CheckCircle2, Truck, Calendar, Layers } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function ProjectStockRegisterModal({
  isOpen,
  onClose,
  projectId,
  projectName
}) {
  if (!isOpen || !projectId) return null;

  const [activeTab, setActiveTab] = useState('balances'); // 'balances' | 'inward' | 'ledger'
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [stockBalances, setStockBalances] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);

  // Inward Form State
  const [inwardSubmitting, setInwardSubmitting] = useState(false);
  const [deliveryChallanNumber, setDeliveryChallanNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  
  // Inward Items (multi-line)
  const [inwardItems, setInwardItems] = useState([
    {
      materialIdentifier: 'OPC_53',
      specificationStandard: 'IS 269:2015',
      name: 'OPC 53 Grade Cement',
      category: 'CEMENT',
      receivedQuantity: 10,
      receivedUnit: 'METRIC_TONNE',
      canonicalTargetUnit: 'KG',
      specificGravity: null,
      batchNumber: ''
    }
  ]);

  useEffect(() => {
    loadData();
  }, [projectId, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      if (activeTab === 'balances') {
        const res = await castingApi.getProjectStock(projectId);
        setStockBalances(res?.data || []);
      } else if (activeTab === 'ledger') {
        const res = await castingApi.getStockLedger(projectId);
        setLedgerEntries(res?.data || []);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInwardLine = () => {
    setInwardItems(prev => [
      ...prev,
      {
        materialIdentifier: 'FINE_AGG_ZONE2',
        specificationStandard: 'IS 383:2016',
        name: 'Manufactured Sand (Zone II)',
        category: 'FINE_AGGREGATE',
        receivedQuantity: 20,
        receivedUnit: 'METRIC_TONNE',
        canonicalTargetUnit: 'KG',
        specificGravity: null,
        batchNumber: ''
      }
    ]);
  };

  const handleRemoveInwardLine = (idx) => {
    if (inwardItems.length <= 1) return;
    setInwardItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateInwardLine = (idx, field, val) => {
    const updated = [...inwardItems];
    updated[idx][field] = val;
    setInwardItems(updated);
  };

  const handleRecordInward = async (e) => {
    e.preventDefault();
    if (!deliveryChallanNumber.trim()) {
      setErrorMsg('Challan / GRN number is required.');
      return;
    }
    if (!supplierName.trim()) {
      setErrorMsg('Supplier name is required.');
      return;
    }

    setInwardSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        deliveryChallanNumber: deliveryChallanNumber.trim(),
        supplierName: supplierName.trim(),
        truckNumber: truckNumber.trim(),
        receivedDate,
        remarks: remarks.trim(),
        items: inwardItems.map(item => ({
          materialIdentifier: item.materialIdentifier,
          specificationStandard: item.specificationStandard,
          name: item.name,
          category: item.category,
          receivedQuantity: Number(item.receivedQuantity),
          receivedUnit: item.receivedUnit,
          canonicalTargetUnit: item.canonicalTargetUnit,
          specificGravity: item.specificGravity ? Number(item.specificGravity) : undefined,
          batchNumber: item.batchNumber
        }))
      };

      const res = await castingApi.recordStockInward(projectId, payload);
      setSuccessMsg(`Material inward recorded successfully! Receipt: ${res?.data?.receiptNumber}`);
      
      // Reset form
      setDeliveryChallanNumber('');
      setSupplierName('');
      setTruckNumber('');
      setRemarks('');
      
      setTimeout(() => {
        setActiveTab('balances');
        loadData();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record stock inward');
    } finally {
      setInwardSubmitting(false);
    }
  };

  return (
    <div className="casting-modal-backdrop">
      <div className="casting-modal" style={{ maxWidth: '960px', width: '95%' }}>
        <div className="casting-modal-header" style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Package size={20} color="#38bdf8" />
              <h3 className="casting-modal-title" style={{ margin: 0 }}>Project Material Stock Register</h3>
            </div>
            <span style={{ fontSize: '0.825rem', color: '#94a3b8', display: 'block', marginTop: '0.25rem' }}>
              Project: <strong style={{ color: '#f8fafc' }}>{projectName || projectId}</strong>
            </span>
          </div>
          <button className="casting-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid #334155', background: '#0f172a' }}>
          <button
            onClick={() => setActiveTab('balances')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: activeTab === 'balances' ? '#38bdf8' : 'transparent',
              color: activeTab === 'balances' ? '#0f172a' : '#94a3b8',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Current Stock Balances
          </button>
          <button
            onClick={() => setActiveTab('inward')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: activeTab === 'inward' ? '#38bdf8' : 'transparent',
              color: activeTab === 'inward' ? '#0f172a' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={14} /> Record Inward (GRN)
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: activeTab === 'ledger' ? '#38bdf8' : 'transparent',
              color: activeTab === 'ledger' ? '#0f172a' : '#94a3b8',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Movement Ledger Timeline
          </button>
        </div>

        <div className="casting-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1.25rem' }}>
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

          {/* TAB 1: Current Balances */}
          {activeTab === 'balances' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading project stock...</div>
            ) : stockBalances.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <Package size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                No material stock has been inwarded for this project yet. Use "Record Inward (GRN)" to add stock.
              </div>
            ) : (
              <div className="casting-table-wrapper" style={{ background: 'var(--main-bg, #0f172a)', borderRadius: '8px', border: '1px solid var(--card-border, #334155)' }}>
                <table className="casting-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--card-bg, #1e293b)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>Material Name</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>Category</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>Specification Standard</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Current Balance</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockBalances.map((st, idx) => (
                      <tr key={st._id || idx} style={{ borderBottom: '1px solid var(--card-border, #1e293b)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>{st.name}</div>
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary, #94a3b8)' }}>{st.materialIdentifier}</div>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary, #cbd5e1)' }}>{st.category}</td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{st.specificationStandard}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem' }}>
                          {st.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {st.canonicalUnit}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem' }}>
                          {st.updatedAt ? new Date(st.updatedAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* TAB 2: Record Material Inward Form */}
          {activeTab === 'inward' && (
            <form onSubmit={handleRecordInward}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--card-bg, #1e293b)', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid var(--card-border, #334155)' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '4px' }}>Challan / GRN # *</label>
                  <input
                    type="text"
                    required
                    className="casting-input"
                    value={deliveryChallanNumber}
                    onChange={(e) => setDeliveryChallanNumber(e.target.value)}
                    placeholder="e.g. DC-2026-9812"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', display: 'block', marginBottom: '4px' }}>Supplier / Vendor Name *</label>
                  <input
                    type="text"
                    required
                    className="casting-input"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. UltraTech Cement Ltd."
                    style={{ width: '100%', background: '#0f172a' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Truck / Vehicle #</label>
                  <input
                    type="text"
                    className="casting-input"
                    value={truckNumber}
                    onChange={(e) => setTruckNumber(e.target.value)}
                    placeholder="e.g. MH-12-AB-1234"
                    style={{ width: '100%', background: '#0f172a' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Receipt Date</label>
                  <input
                    type="date"
                    className="casting-input"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    style={{ width: '100%', background: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc' }}>Delivered Material Items</h4>
                  <button
                    type="button"
                    onClick={handleAddInwardLine}
                    className="casting-btn secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} /> Add Line
                  </button>
                </div>

                <div className="casting-table-wrapper" style={{ background: 'var(--main-bg, #0f172a)', borderRadius: '8px', border: '1px solid var(--card-border, #334155)' }}>
                  <table className="casting-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--card-bg, #1e293b)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Material Identifier</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Standard</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Received Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Delivered Unit</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Batch #</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inwardItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--card-border, #1e293b)' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <select
                              className="casting-input"
                              value={item.materialIdentifier}
                              onChange={(e) => {
                                const id = e.target.value;
                                let name = 'Material';
                                let cat = 'CEMENT';
                                let std = 'IS 269:2015';
                                let unit = 'KG';
                                if (id === 'OPC_53') { name = 'OPC 53 Grade Cement'; cat = 'CEMENT'; std = 'IS 269:2015'; unit = 'KG'; }
                                if (id === 'PPC') { name = 'Portland Pozzolana Cement'; cat = 'CEMENT'; std = 'IS 1489:2015'; unit = 'KG'; }
                                if (id === 'FINE_AGG_ZONE2') { name = 'Manufactured Sand (Zone II)'; cat = 'FINE_AGGREGATE'; std = 'IS 383:2016'; unit = 'KG'; }
                                if (id === 'COARSE_AGG_20MM') { name = 'Crushed Stone 20mm'; cat = 'COARSE_AGGREGATE'; std = 'IS 383:2016'; unit = 'KG'; }
                                if (id === 'COARSE_AGG_10MM') { name = 'Crushed Stone 10mm'; cat = 'COARSE_AGGREGATE'; std = 'IS 383:2016'; unit = 'KG'; }
                                if (id === 'ADMIXTURE_PCE') { name = 'Polycarboxylate Ether Superplasticizer'; cat = 'ADMIXTURE'; std = 'IS 9103:1999'; unit = 'LITERS'; }
                                if (id === 'FLY_ASH_CLASS_F') { name = 'Pulverized Fuel Ash (Fly Ash)'; cat = 'FLY_ASH'; std = 'IS 3812:2013'; unit = 'KG'; }
                                
                                const updated = [...inwardItems];
                                updated[idx].materialIdentifier = id;
                                updated[idx].name = name;
                                updated[idx].category = cat;
                                updated[idx].specificationStandard = std;
                                updated[idx].canonicalTargetUnit = unit;
                                setInwardItems(updated);
                              }}
                              style={{ width: '100%', fontSize: '0.775rem' }}
                            >
                              <option value="OPC_53">OPC 53 Grade Cement</option>
                              <option value="PPC">Portland Pozzolana Cement</option>
                              <option value="FINE_AGG_ZONE2">Manufactured Sand (Zone II)</option>
                              <option value="COARSE_AGG_20MM">Crushed Stone 20mm</option>
                              <option value="COARSE_AGG_10MM">Crushed Stone 10mm</option>
                              <option value="FLY_ASH_CLASS_F">Fly Ash (Class F)</option>
                              <option value="ADMIXTURE_PCE">PCE Superplasticizer</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-secondary, #94a3b8)' }}>
                            {item.specificationStandard}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              className="casting-input"
                              value={item.receivedQuantity}
                              onChange={(e) => handleUpdateInwardLine(idx, 'receivedQuantity', e.target.value)}
                              style={{ width: '90px', textAlign: 'right', fontSize: '0.8rem' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <select
                              className="casting-input"
                              value={item.receivedUnit}
                              onChange={(e) => handleUpdateInwardLine(idx, 'receivedUnit', e.target.value)}
                              style={{ width: '130px', fontSize: '0.775rem' }}
                            >
                              <option value="METRIC_TONNE">METRIC TONNE (MT)</option>
                              <option value="BAGS_50KG">BAGS (50 KG)</option>
                              <option value="KG">KG</option>
                              <option value="LITERS">LITERS</option>
                              <option value="M3">M3</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <input
                              type="text"
                              className="casting-input"
                              value={item.batchNumber}
                              onChange={(e) => handleUpdateInwardLine(idx, 'batchNumber', e.target.value)}
                              placeholder="Batch / Mill #"
                              style={{ width: '110px', fontSize: '0.8rem' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveInwardLine(idx)}
                              disabled={inwardItems.length <= 1}
                              style={{ background: 'transparent', border: 'none', color: inwardItems.length <= 1 ? '#475569' : '#f87171', cursor: inwardItems.length <= 1 ? 'not-allowed' : 'pointer' }}
                            >
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Remarks / Inward Gate Pass Notes</label>
                <input
                  type="text"
                  className="casting-input"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Weighbridge slip verified, test certificate attached"
                  style={{ width: '100%', background: '#0f172a' }}
                />
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="casting-btn primary"
                  disabled={inwardSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Package size={15} /> Post Stock Inward (GRN)
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Stock Movement Ledger */}
          {activeTab === 'ledger' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading ledger transactions...</div>
            ) : ledgerEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No stock transactions recorded yet.</div>
            ) : (
              <div className="casting-table-wrapper" style={{ background: 'var(--main-bg, #0f172a)', borderRadius: '8px', border: '1px solid var(--card-border, #334155)' }}>
                <table className="casting-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--card-bg, #1e293b)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Timestamp</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Material</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantity</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Operation Key / Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((entry, idx) => {
                      const isInward = entry.transactionType === 'STOCK_INWARD' || entry.transactionType === 'CASTING_REVERSAL';
                      return (
                        <tr key={entry._id || idx} style={{ borderBottom: '1px solid var(--card-border, #1e293b)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary, #94a3b8)', whiteSpace: 'nowrap' }}>
                            {new Date(entry.createdAt).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              background: entry.transactionType === 'STOCK_INWARD' ? 'rgba(34, 197, 94, 0.15)' : (entry.transactionType === 'CASTING_REVERSAL' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(56, 189, 248, 0.15)'),
                              color: entry.transactionType === 'STOCK_INWARD' ? '#4ade80' : (entry.transactionType === 'CASTING_REVERSAL' ? '#facc15' : '#38bdf8'),
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {entry.transactionType === 'STOCK_INWARD' && <ArrowDownLeft size={12} />}
                              {entry.transactionType === 'CASTING_REVERSAL' && <RotateCcw size={12} />}
                              {entry.transactionType === 'CASTING_CONSUMPTION_OUTWARD' && <ArrowUpRight size={12} />}
                              {entry.transactionType}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>{entry.name}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{entry.materialIdentifier}</div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: isInward ? '#4ade80' : '#f87171' }}>
                            {isInward ? `+${entry.canonicalQuantity}` : `-${entry.canonicalQuantity}`} {entry.canonicalUnit}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '0.725rem' }}>
                            {entry.operationKey}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        <div className="casting-modal-footer" style={{ borderTop: '1px solid #334155', padding: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="casting-btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
