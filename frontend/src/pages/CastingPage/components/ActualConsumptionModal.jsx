import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, Calendar, AlertCircle, Sparkles, Scale, FileText, Send, Save, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function ActualConsumptionModal({
  isOpen,
  onClose,
  event,
  onSaved
}) {
  if (!isOpen || !event) return null;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [mrsData, setMrsData] = useState(null);
  const [existingRecord, setExistingRecord] = useState(null);

  // Form State
  const [actualPourDate, setActualPourDate] = useState(
    event.actualPourDate || event.plannedDate || new Date().toISOString().split('T')[0]
  );
  const [actualPourStartTime, setActualPourStartTime] = useState(
    event.actualPourStartTime || event.plannedStartTime || '08:30'
  );
  const [actualPourEndTime, setActualPourEndTime] = useState(
    event.actualPourEndTime || event.plannedEndTime || '17:00'
  );
  const [batchingPlantName, setBatchingPlantName] = useState(event.batchingPlantName || 'Site Batching Plant #1');
  const [weatherConditions, setWeatherConditions] = useState('Clear, 28°C');
  const [generalNotes, setGeneralNotes] = useState('');

  // Per-segment actual volumes
  const [segmentsActual, setSegmentsActual] = useState([]);
  
  // Materials Consumed
  const [materialsConsumed, setMaterialsConsumed] = useState([]);

  useEffect(() => {
    loadData();
  }, [event]);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      
      const eventId = event.id || event._id;

      // 1. Fetch active MRS
      const mrsRes = await castingApi.getMRS(eventId);
      const activeMrs = mrsRes?.data?.activeMrs;
      setMrsData(activeMrs);

      // 2. Fetch existing consumption records if any
      const recRes = await castingApi.getConsumptionRecords(eventId);
      const records = recRes?.data || [];
      const draft = records.find(r => r.status === 'DRAFT') || records[records.length - 1];

      if (draft && draft.status === 'DRAFT') {
        setExistingRecord(draft);
        setActualPourDate(draft.actualPourDate || actualPourDate);
        setActualPourStartTime(draft.actualPourStartTime || actualPourStartTime);
        setActualPourEndTime(draft.actualPourEndTime || actualPourEndTime);
        setBatchingPlantName(draft.batchingPlantName || batchingPlantName);
        setWeatherConditions(draft.weatherConditions || weatherConditions);
        setGeneralNotes(draft.generalNotes || '');
        setSegmentsActual(draft.segmentsActual || []);
        setMaterialsConsumed(draft.materialsConsumed || []);
      } else {
        // Initialize from event segments and MRS materials
        const initSegments = (event.segments || []).map(seg => ({
          segmentId: seg.segmentId,
          memberId: seg.memberId,
          segmentName: seg.segmentName,
          grade: seg.grade || 'M25',
          recipeCode: seg.recipeBinding?.recipeCode || 'MIX',
          plannedVolumeM3: seg.plannedVolumeM3 || 0,
          actualVolumeM3: seg.actualVolumeM3 !== undefined ? seg.actualVolumeM3 : seg.plannedVolumeM3,
          batchSlipNumbers: []
        }));
        setSegmentsActual(initSegments);

        if (activeMrs?.mrsItems) {
          const initMats = activeMrs.mrsItems.map(item => {
            const planned = item.adjustedBatchQuantity !== undefined ? item.adjustedBatchQuantity : item.totalRequiredQuantity;
            return {
              materialIdentifier: item.materialIdentifier,
              specificationStandard: item.specificationStandard || 'Standard',
              name: item.name,
              category: item.category,
              unit: item.unit,
              plannedQuantity: planned,
              actualQuantity: planned,
              varianceQuantity: 0,
              variancePercentage: 0,
              varianceClassification: 'NOMINAL',
              isUntrackedBulk: item.isUntrackedBulk || false,
              batchNumber: '',
              invoiceOrDeliveryChallanNumber: ''
            };
          });
          setMaterialsConsumed(initMats);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load casting requirement data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSegmentActual = (index, val) => {
    const updated = [...segmentsActual];
    updated[index].actualVolumeM3 = parseFloat(val) || 0;
    setSegmentsActual(updated);
  };

  const handleUpdateMaterialActual = (index, val) => {
    const updated = [...materialsConsumed];
    const actualQty = parseFloat(val) || 0;
    const item = updated[index];
    item.actualQuantity = actualQty;

    // Live variance calculation
    const planned = Number(item.plannedQuantity) || 0;
    const diff = Math.round((actualQty - planned) * 1000) / 1000;
    item.varianceQuantity = diff;

    if (planned <= 0) {
      item.variancePercentage = null;
      item.varianceClassification = actualQty > 0 ? 'UNBUDGETED' : 'NOMINAL';
    } else {
      const pct = Math.round(((actualQty - planned) / planned) * 10000) / 100;
      item.variancePercentage = pct;
      if (pct === 0) item.varianceClassification = 'NOMINAL';
      else if (pct < -5.0) item.varianceClassification = 'SAVING_SIGNIFICANT';
      else if (pct < 0) item.varianceClassification = 'UNDER_CONSUMPTION_MODERATE';
      else if (pct <= 2.0) item.varianceClassification = 'OVER_CONSUMPTION_TOLERABLE';
      else if (pct <= 5.0) item.varianceClassification = 'OVER_CONSUMPTION_MODERATE';
      else item.varianceClassification = 'OVER_CONSUMPTION_HIGH';
    }

    setMaterialsConsumed(updated);
  };

  const handleUpdateMaterialMeta = (index, field, val) => {
    const updated = [...materialsConsumed];
    updated[index][field] = val;
    setMaterialsConsumed(updated);
  };

  const totalPlannedVol = segmentsActual.reduce((sum, s) => sum + (Number(s.plannedVolumeM3) || 0), 0);
  const totalActualVol = segmentsActual.reduce((sum, s) => sum + (Number(s.actualVolumeM3) || 0), 0);
  const volVariance = Math.round((totalActualVol - totalPlannedVol) * 1000) / 1000;
  const volVariancePct = totalPlannedVol > 0 ? Math.round(((totalActualVol - totalPlannedVol) / totalPlannedVol) * 10000) / 100 : 0;

  const getVarianceBadge = (classification, pct) => {
    switch (classification) {
      case 'UNBUDGETED':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>Unbudgeted</span>;
      case 'SAVING_SIGNIFICANT':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ArrowDownRight size={13} /> {pct}% (Saving)</span>;
      case 'UNDER_CONSUMPTION_MODERATE':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ArrowDownRight size={13} /> {pct}%</span>;
      case 'NOMINAL':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)' }}>0.00% (On Spec)</span>;
      case 'OVER_CONSUMPTION_TOLERABLE':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ArrowUpRight size={13} /> +{pct}% (Tolerable)</span>;
      case 'OVER_CONSUMPTION_MODERATE':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ArrowUpRight size={13} /> +{pct}% (Warning)</span>;
      case 'OVER_CONSUMPTION_HIGH':
        return <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ArrowUpRight size={13} /> +{pct}% (Excessive)</span>;
      default:
        return <span style={{ color: '#94a3b8' }}>-</span>;
    }
  };

  const handleSave = async (submitAfter = false) => {
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const eventId = event.id || event._id;
      const payload = {
        actualPourDate,
        actualPourStartTime,
        actualPourEndTime,
        segmentsActual,
        materialsConsumed,
        weatherConditions,
        batchingPlantName,
        generalNotes
      };

      let recId = existingRecord?._id || existingRecord?.id;
      if (recId) {
        await castingApi.updateConsumption(eventId, recId, payload);
      } else {
        const res = await castingApi.draftConsumption(eventId, payload);
        recId = res?.data?._id || res?.data?.id;
      }

      if (submitAfter && recId) {
        await castingApi.submitConsumption(eventId, recId);
        setSuccessMsg('Actual consumption submitted successfully for Maker-Checker approval!');
      } else {
        setSuccessMsg('Actual consumption draft saved successfully.');
      }

      setTimeout(() => {
        if (onSaved) onSaved();
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save actual consumption');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="casting-modal-backdrop">
      <div className="casting-modal" style={{ maxWidth: '980px', width: '95%' }}>
        <div className="casting-modal-header" style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Scale size={20} color="#38bdf8" />
              <h3 className="casting-modal-title" style={{ margin: 0 }}>Actual Casting & Material Consumption Record</h3>
            </div>
            <span style={{ fontSize: '0.825rem', color: '#94a3b8', display: 'block', marginTop: '0.25rem' }}>
              Event: <strong style={{ color: '#f8fafc' }}>{event.eventNumber}</strong> — {event.title} (MRS Active: <strong style={{ color: '#38bdf8' }}>R{mrsData?.revisionNumber || event.activeMrsRevision || 1}</strong>)
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
              Loading Material Requirement Sheet and planned parameters...
            </div>
          ) : (
            <>
              {/* Execution Metadata Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#1e293b', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid #334155' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Actual Pour Date</label>
                  <input
                    type="date"
                    className="casting-input"
                    value={actualPourDate}
                    onChange={(e) => setActualPourDate(e.target.value)}
                    style={{ width: '100%', background: '#0f172a' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Start Time</label>
                  <input
                    type="time"
                    className="casting-input"
                    value={actualPourStartTime}
                    onChange={(e) => setActualPourStartTime(e.target.value)}
                    style={{ width: '100%', background: '#0f172a' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>End Time</label>
                  <input
                    type="time"
                    className="casting-input"
                    value={actualPourEndTime}
                    onChange={(e) => setActualPourEndTime(e.target.value)}
                    style={{ width: '100%', background: '#0f172a' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Batching Plant</label>
                  <input
                    type="text"
                    className="casting-input"
                    value={batchingPlantName}
                    onChange={(e) => setBatchingPlantName(e.target.value)}
                    style={{ width: '100%', background: '#0f172a' }}
                    placeholder="Plant name/location"
                  />
                </div>
              </div>

              {/* Section 1: Structural Members & Segments Actuals */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={16} color="#38bdf8" /> Structural Segments Volume Breakdown
                  </h4>
                  <div style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                    Total Planned: <strong style={{ color: '#f8fafc' }}>{totalPlannedVol.toFixed(3)} m³</strong> | Total Actual: <strong style={{ color: '#38bdf8' }}>{totalActualVol.toFixed(3)} m³</strong> ({volVariance >= 0 ? `+${volVariance.toFixed(3)}` : volVariance.toFixed(3)} m³, {volVariancePct >= 0 ? `+${volVariancePct}%` : `${volVariancePct}%`})
                  </div>
                </div>

                <div className="casting-table-wrapper" style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                  <table className="casting-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#1e293b' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Segment Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Grade / Recipe</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Planned (m³)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actual Poured (m³)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segmentsActual.map((seg, idx) => {
                        const sDiff = Math.round(((seg.actualVolumeM3 || 0) - (seg.plannedVolumeM3 || 0)) * 1000) / 1000;
                        return (
                          <tr key={seg.segmentId || idx} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 500, color: '#f8fafc' }}>{seg.segmentName}</td>
                            <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{seg.grade} ({seg.recipeCode})</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8' }}>{(seg.plannedVolumeM3 || 0).toFixed(3)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                className="casting-input"
                                value={seg.actualVolumeM3}
                                onChange={(e) => handleUpdateSegmentActual(idx, e.target.value)}
                                style={{ width: '100px', textAlign: 'right', padding: '4px 8px', background: '#1e293b' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: sDiff > 0 ? '#fb923c' : (sDiff < 0 ? '#4ade80' : '#94a3b8') }}>
                              {sDiff >= 0 ? `+${sDiff.toFixed(3)}` : sDiff.toFixed(3)} m³
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Material Consumption Breakdown & Variance */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Scale size={16} color="#38bdf8" /> Actual Material Consumption vs. MRS Planned
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Canonical Inventory Base: Dry items in <strong>KG</strong>, Liquids in <strong>LITERS</strong>
                  </span>
                </div>

                <div className="casting-table-wrapper" style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                  <table className="casting-table" style={{ width: '100%', fontSize: '0.825rem' }}>
                    <thead>
                      <tr style={{ background: '#1e293b' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Material / Category</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Batch / Slip Ref</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Planned (MRS)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actual Consumed</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Variance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialsConsumed.map((mat, idx) => (
                        <tr key={mat.materialIdentifier || idx} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>{mat.name}</div>
                            <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>{mat.category} | {mat.materialIdentifier}</div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              className="casting-input"
                              placeholder="Batch # / Slip ref"
                              value={mat.batchNumber || ''}
                              onChange={(e) => handleUpdateMaterialMeta(idx, 'batchNumber', e.target.value)}
                              style={{ width: '130px', padding: '4px 8px', fontSize: '0.775rem', background: '#1e293b' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {Number(mat.plannedQuantity).toFixed(2)} {mat.unit}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="casting-input"
                                value={mat.actualQuantity}
                                onChange={(e) => handleUpdateMaterialActual(idx, e.target.value)}
                                style={{ width: '100px', textAlign: 'right', padding: '4px 8px', background: '#1e293b' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{mat.unit}</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {getVarianceBadge(mat.varianceClassification, mat.variancePercentage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* General Notes */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Execution Remarks & Field Notes
                </label>
                <textarea
                  className="casting-input"
                  rows="2"
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Slump test results, weather variations, pour delays or pumping observations..."
                  style={{ width: '100%', background: '#0f172a' }}
                />
              </div>
            </>
          )}
        </div>

        <div className="casting-modal-footer" style={{ borderTop: '1px solid #334155', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="casting-btn secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="casting-btn secondary"
              onClick={() => handleSave(false)}
              disabled={isSubmitting || loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={15} /> Save Draft
            </button>
            <button
              className="casting-btn primary"
              onClick={() => handleSave(true)}
              disabled={isSubmitting || loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={15} /> Submit for Approval
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
