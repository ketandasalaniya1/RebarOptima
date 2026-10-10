import React, { useState } from 'react';
import { X, CheckCircle2, Clock, Calendar, AlertCircle } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function RecordActualPourModal({
  isOpen,
  onClose,
  event,
  onActualRecorded
}) {
  if (!isOpen || !event) return null;

  const [actualPourDate, setActualPourDate] = useState(
    event.actualPourDate || event.plannedDate || new Date().toISOString().split('T')[0]
  );
  const [actualPourStartTime, setActualPourStartTime] = useState(
    event.actualPourStartTime || event.plannedStartTime || '08:30'
  );
  const [actualPourEndTime, setActualPourEndTime] = useState(
    event.actualPourEndTime || event.plannedEndTime || '16:30'
  );

  // Per-segment actual volumes
  const [segmentActuals, setSegmentActuals] = useState(() => {
    const map = {};
    (event.segments || []).forEach((seg) => {
      map[seg.segmentId] = seg.actualVolumeM3 !== undefined ? seg.actualVolumeM3 : seg.plannedVolumeM3;
    });
    return map;
  });

  const [notes, setNotes] = useState(event.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleUpdateSegActual = (segId, val) => {
    setSegmentActuals(prev => ({
      ...prev,
      [segId]: parseFloat(val) || 0
    }));
  };

  const totalActual = Object.values(segmentActuals).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const variance = totalActual - (event.plannedTotalVolumeM3 || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const updatedSegments = (event.segments || []).map(seg => ({
        ...seg,
        actualVolumeM3: Number(segmentActuals[seg.segmentId]) || 0,
        status: 'POURED'
      }));

      await castingApi.updateEvent(event.id || event._id, {
        actualPourDate,
        actualPourStartTime,
        actualPourEndTime,
        actualTotalVolumeM3: totalActual,
        segments: updatedSegments,
        status: 'POURED',
        notes: notes.trim()
      });

      onActualRecorded();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record actual pour');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="casting-modal-backdrop">
      <div className="casting-modal large">
        <div className="casting-modal-header">
          <div>
            <h3 className="casting-modal-title">Record Actual Pour Execution</h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Event: {event.eventNumber} — {event.title}
            </span>
          </div>
          <button className="casting-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="casting-modal-body">
            {errorMsg && (
              <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '8px', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={15} />
                {errorMsg}
              </div>
            )}

            {/* Actual Timing Inputs */}
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Actual Pour Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={actualPourDate}
                  onChange={(e) => setActualPourDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Actual Start Time</label>
                <input
                  type="time"
                  className="form-input"
                  value={actualPourStartTime}
                  onChange={(e) => setActualPourStartTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Actual End Time</label>
                <input
                  type="time"
                  className="form-input"
                  value={actualPourEndTime}
                  onChange={(e) => setActualPourEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Per-Segment Actual Volume Entry */}
            <div style={{ marginTop: '0.5rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                Record Poured Volume per Structural Member Segment
              </label>

              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                <table className="casting-table">
                  <thead>
                    <tr>
                      <th>Member Mark</th>
                      <th>Segment / Lift</th>
                      <th>Planned Vol (m³)</th>
                      <th>Actual Poured Vol (m³)</th>
                      <th>Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(event.segments || []).map((seg) => {
                      const actualVal = segmentActuals[seg.segmentId] ?? seg.plannedVolumeM3;
                      const segVariance = Number(actualVal) - Number(seg.plannedVolumeM3);

                      return (
                        <tr key={seg.segmentId}>
                          <td style={{ fontWeight: 700, color: '#f8fafc' }}>
                            {seg.displayId || 'Member'}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            {seg.segmentName} (Lift {seg.segmentLiftNumber || 1})
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {(seg.plannedVolumeM3 || 0).toFixed(3)} m³
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.001"
                              className="form-input"
                              style={{ width: '110px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              value={actualVal}
                              onChange={(e) => handleUpdateSegActual(seg.segmentId, e.target.value)}
                              min={0}
                              required
                            />
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: segVariance > 0 ? '#f87171' : segVariance < 0 ? '#38bdf8' : '#34d399'
                              }}
                            >
                              {segVariance > 0 ? `+${segVariance.toFixed(3)}` : segVariance.toFixed(3)} m³
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Comparison Box */}
            <div className="calc-preview-box">
              <div>
                <span className="calc-preview-lbl" style={{ display: 'block' }}>Total Planned: {(event.plannedTotalVolumeM3 || 0).toFixed(3)} m³</span>
                <span style={{ fontSize: '0.8rem', color: variance > 0 ? '#f87171' : variance < 0 ? '#38bdf8' : '#34d399', fontWeight: 600 }}>
                  Variance: {variance > 0 ? `+${variance.toFixed(3)}` : variance.toFixed(3)} m³ ({((variance / (event.plannedTotalVolumeM3 || 1)) * 100).toFixed(1)}%)
                </span>
              </div>
              <div>
                <span className="calc-preview-lbl">Actual Poured Volume:</span>
                <span className="calc-preview-val" style={{ display: 'block', textAlign: 'right' }}>
                  {totalActual.toFixed(3)} m³
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Site Notes / Observations</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="e.g. Slump checked at 130mm, ambient temperature 28°C, no cold joints observed."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="casting-modal-footer">
            <button type="button" className="casting-btn casting-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="casting-btn casting-btn-primary" disabled={isSubmitting}>
              <CheckCircle2 size={16} />
              {isSubmitting ? 'Saving...' : 'Save Actual Pour Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
