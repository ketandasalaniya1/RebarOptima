import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function CreateCastingEventModal({
  isOpen,
  onClose,
  projects,
  selectedProject,
  onEventCreated
}) {
  if (!isOpen) return null;

  const [projectId, setProjectId] = useState(selectedProject ? (selectedProject.id || selectedProject._id) : (projects[0]?.id || projects[0]?._id || ''));
  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState('Slab_Beam');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [plannedStartTime, setPlannedStartTime] = useState('08:00');
  const [plannedEndTime, setPlannedEndTime] = useState('16:00');
  const [notes, setNotes] = useState('');

  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedSegments, setSelectedSegments] = useState({}); // memberId -> { checked: boolean, plannedVolumeM3, liftNumber, segmentName }
  const [filterBlock, setFilterBlock] = useState('ALL');

  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load project members across all blocks
  useEffect(() => {
    if (!projectId) return;
    setIsLoadingMembers(true);
    castingApi.getProjectMembers(projectId)
      .then(members => {
        setAvailableMembers(members || []);
        // Initialize segments map
        const segMap = {};
        (members || []).forEach(m => {
          segMap[m.id || m._id] = {
            checked: false,
            plannedVolumeM3: m.remainingVolumeM3 > 0 ? m.remainingVolumeM3 : m.totalRequiredVolumeM3,
            liftNumber: 1,
            segmentName: 'Full Pour'
          };
        });
        setSelectedSegments(segMap);
      })
      .catch(err => {
        console.error('Error fetching project members:', err);
      })
      .finally(() => {
        setIsLoadingMembers(false);
      });
  }, [projectId]);

  const handleToggleMember = (mId) => {
    setSelectedSegments(prev => ({
      ...prev,
      [mId]: {
        ...prev[mId],
        checked: !prev[mId]?.checked
      }
    }));
  };

  const handleUpdateSegmentVol = (mId, val) => {
    setSelectedSegments(prev => ({
      ...prev,
      [mId]: {
        ...prev[mId],
        plannedVolumeM3: parseFloat(val) || 0
      }
    }));
  };

  const handleUpdateSegmentLift = (mId, val) => {
    setSelectedSegments(prev => ({
      ...prev,
      [mId]: {
        ...prev[mId],
        liftNumber: parseInt(val, 10) || 1
      }
    }));
  };

  // Compute total planned volume for selected members
  const selectedList = availableMembers.filter(m => selectedSegments[m.id || m._id]?.checked);
  const totalPlannedVol = selectedList.reduce((sum, m) => {
    const s = selectedSegments[m.id || m._id];
    return sum + (Number(s?.plannedVolumeM3) || 0);
  }, 0);

  const distinctBlocks = Array.from(new Set(availableMembers.map(m => m.blockName).filter(Boolean)));

  const filteredMembers = availableMembers.filter(m => {
    if (filterBlock === 'ALL') return true;
    return m.blockName === filterBlock;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Event Title is required');
      return;
    }
    if (selectedList.length === 0) {
      setErrorMsg('Please select at least one structural member to cast');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const segmentsPayload = selectedList.map(m => {
        const seg = selectedSegments[m.id || m._id];
        return {
          memberId: m.id || m._id,
          plannedVolumeM3: seg.plannedVolumeM3,
          segmentLiftNumber: seg.liftNumber || 1,
          segmentName: seg.segmentName || `Lift ${seg.liftNumber || 1}`
        };
      });

      await castingApi.createEvent({
        projectId,
        title: title.trim(),
        activityType,
        plannedDate,
        plannedStartTime,
        plannedEndTime,
        segments: segmentsPayload,
        notes: notes.trim()
      });

      onEventCreated();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create casting event');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="casting-modal-backdrop">
      <div className="casting-modal large">
        <div className="casting-modal-header">
          <div>
            <h3 className="casting-modal-title">Schedule New Casting Event</h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Multi-Member & Multi-Block Planned Pour Register
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

            {/* Event Basic Info */}
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Project *</label>
                <select
                  className="casting-select"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map(p => (
                    <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Event Title / Description *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Tower A & B Podium Combined Pour"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Activity Type</label>
                <select
                  className="casting-select"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                >
                  <option value="Slab_Beam">Slab & Beam Pour</option>
                  <option value="Column_Lift">Column Lift</option>
                  <option value="Foundation">Raft / Foundation</option>
                  <option value="Retaining_Wall">Retaining Wall</option>
                  <option value="Other">Other Elements</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Planned Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Planned Time Window</label>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input
                    type="time"
                    className="form-input"
                    value={plannedStartTime}
                    onChange={(e) => setPlannedStartTime(e.target.value)}
                  />
                  <span style={{ color: '#94a3b8' }}>to</span>
                  <input
                    type="time"
                    className="form-input"
                    value={plannedEndTime}
                    onChange={(e) => setPlannedEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Member Selection Section */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Select Structural Members Across Blocks ({selectedList.length} selected)
                </label>

                {distinctBlocks.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Filter Block:</span>
                    <select
                      className="casting-select"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
                      value={filterBlock}
                      onChange={(e) => setFilterBlock(e.target.value)}
                    >
                      <option value="ALL">All Blocks</option>
                      {distinctBlocks.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {isLoadingMembers ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Loading project members...</div>
              ) : availableMembers.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  No structural members registered in this project yet. Please add members in the Structural Register tab first.
                </div>
              ) : (
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                  <table className="casting-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>Select</th>
                        <th>Member Mark</th>
                        <th>Location</th>
                        <th>Type</th>
                        <th>Target Vol</th>
                        <th>Planned Vol (m³)</th>
                        <th>Lift #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map(m => {
                        const mId = m.id || m._id;
                        const seg = selectedSegments[mId] || {};
                        const isChecked = !!seg.checked;

                        return (
                          <tr key={mId} style={{ background: isChecked ? 'rgba(20, 184, 166, 0.06)' : 'transparent' }}>
                            <td>
                              <button
                                type="button"
                                style={{ background: 'transparent', border: 'none', color: isChecked ? '#2dd4bf' : '#64748b', cursor: 'pointer', padding: 0 }}
                                onClick={() => handleToggleMember(mId)}
                              >
                                {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                              </button>
                            </td>
                            <td style={{ fontWeight: 700, color: '#f8fafc' }}>
                              {m.displayId}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              {m.blockName} • {m.levelName}
                            </td>
                            <td>
                              <span className="member-type-tag">{m.memberType}</span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {(m.totalRequiredVolumeM3 || 0).toFixed(3)} m³
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.001"
                                className="form-input"
                                style={{ width: '90px', padding: '0.3rem 0.5rem', fontSize: '0.825rem' }}
                                value={seg.plannedVolumeM3 ?? ''}
                                onChange={(e) => handleUpdateSegmentVol(mId, e.target.value)}
                                disabled={!isChecked}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-input"
                                style={{ width: '60px', padding: '0.3rem 0.5rem', fontSize: '0.825rem' }}
                                value={seg.liftNumber ?? 1}
                                onChange={(e) => handleUpdateSegmentLift(mId, e.target.value)}
                                disabled={!isChecked}
                                min={1}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Total Planned Volume Preview */}
            <div className="calc-preview-box">
              <span className="calc-preview-lbl">
                Total Planned Concrete Volume:
              </span>
              <span className="calc-preview-val">{totalPlannedVol.toFixed(3)} m³</span>
            </div>

            <div className="form-group">
              <label className="form-label">Notes & Specifications</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Pump #2 deployed, Boom length 36m"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="casting-modal-footer">
            <button type="button" className="btn-secondary-dark" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-teal" disabled={isSubmitting || selectedList.length === 0}>
              {isSubmitting ? 'Scheduling...' : 'Schedule Casting Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
