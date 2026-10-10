import React, { useState, useEffect } from 'react';
import { Droplet, Calendar, Plus, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, X, FileText, Info } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function CuringManagementView({
  events = [],
  selectedProject,
  onRefresh
}) {
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [scheduleLogs, setScheduleLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showCompensateModal, setShowCompensateModal] = useState(false);
  const [selectedLogForCompensation, setSelectedLogForCompensation] = useState(null);

  // Form states
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [cementType, setCementType] = useState('OPC');
  const [curingMethod, setCuringMethod] = useState('PONDING');
  const [environmentalFlag, setEnvironmentalFlag] = useState('NORMAL');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionsPerDay, setSessionsPerDay] = useState(2);
  const [customDays, setCustomDays] = useState('');

  // Daily Log Form
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionIndex, setSessionIndex] = useState(1);
  const [isAdequatelyWet, setIsAdequatelyWet] = useState(true);
  const [waterCoveragePercent, setWaterCoveragePercent] = useState(100);
  const [pondingDepthMm, setPondingDepthMm] = useState(30);
  const [interruptionLogged, setInterruptionLogged] = useState(false);
  const [interruptionReason, setInterruptionReason] = useState('');
  const [remedialActionTaken, setRemedialActionTaken] = useState('');

  // Compensation Form
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    loadSchedules();
  }, [selectedProject]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const pId = selectedProject?.id || selectedProject?._id;
      const res = await castingApi.getCuringSchedules(pId ? { projectId: pId } : {});
      const list = Array.isArray(res) ? res : (res?.data || []);
      setSchedules(list);
      if (list.length > 0 && !selectedSchedule) {
        setSelectedSchedule(list[0]);
        loadLogs(list[0].id || list[0]._id);
      }
    } catch (err) {
      console.error('Failed to load curing schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (scheduleId) => {
    try {
      const res = await castingApi.getCuringLogs(scheduleId);
      setScheduleLogs(Array.isArray(res) ? res : (res?.data || []));
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  const handleSelectSchedule = (sched) => {
    setSelectedSchedule(sched);
    loadLogs(sched.id || sched._id);
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      const event = events.find(ev => (ev.id || ev._id) === selectedEventId);
      const seg = event?.segments?.find(s => s.segmentId === selectedSegmentId);

      await castingApi.createCuringSchedule({
        eventId: selectedEventId,
        projectId: selectedProject?.id || selectedProject?._id,
        memberId: seg?.memberId,
        segmentId: selectedSegmentId,
        segmentName: seg?.segmentName || selectedSegmentId,
        cementType,
        curingMethod,
        environmentalFlag,
        sessionsPerDay: Number(sessionsPerDay),
        customDurationDays: customDays ? Number(customDays) : undefined,
        startDate
      });

      setShowCreateModal(false);
      await loadSchedules();
    } catch (err) {
      alert(err.message || 'Failed to create curing schedule');
    }
  };

  const handleApproveSchedule = async (scheduleId) => {
    const remarks = prompt('Enter Senior Engineer approval remarks (optional):', 'Approved for site curing execution');
    if (remarks === null) return;
    try {
      await castingApi.approveCuringSchedule(scheduleId, remarks);
      await loadSchedules();
    } catch (err) {
      alert(err.message || 'Failed to approve curing schedule');
    }
  };

  const handleRecordLog = async (e) => {
    e.preventDefault();
    if (!selectedSchedule) return;
    try {
      await castingApi.recordCuringLog({
        curingScheduleId: selectedSchedule.id || selectedSchedule._id,
        logDate,
        sessionIndex: Number(sessionIndex),
        isAdequatelyWet,
        waterCoveragePercent: Number(waterCoveragePercent),
        methodSpecificChecks: { pondingDepthMm: Number(pondingDepthMm) },
        interruptionLogged,
        interruptionReason,
        remedialActionTaken
      });

      setShowLogModal(false);
      await loadLogs(selectedSchedule.id || selectedSchedule._id);
      await loadSchedules();
    } catch (err) {
      alert(err.message || 'Failed to record daily inspection log');
    }
  };

  const handleCompensateLog = async (e) => {
    e.preventDefault();
    if (!selectedLogForCompensation) return;
    try {
      await castingApi.compensateCuringLog(selectedLogForCompensation.id || selectedLogForCompensation._id, {
        isAdequatelyWet,
        waterCoveragePercent: Number(waterCoveragePercent),
        correctionReason
      });

      setShowCompensateModal(false);
      setSelectedLogForCompensation(null);
      if (selectedSchedule) {
        await loadLogs(selectedSchedule.id || selectedSchedule._id);
      }
    } catch (err) {
      alert(err.message || 'Failed to submit compensating log');
    }
  };

  const selectedEvent = events.find(ev => (ev.id || ev._id) === selectedEventId);

  return (
    <div className="content-pane">
      <div className="content-pane-header">
        <div className="content-pane-title-wrap">
          <h2 className="content-pane-title">Curing Management & Environmental Regimes</h2>
          <span className="content-pane-subtitle">
            IS 456 Clause 13.5.1 Curing Schedules, Inspection Sessions & Non-Destructive Audit Log
          </span>
        </div>

        <div className="content-pane-actions">
          <button
            className="btn-secondary-dark"
            onClick={loadSchedules}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            className="btn-primary-teal"
            onClick={() => {
              if (events.length > 0) {
                setSelectedEventId(events[0].id || events[0]._id);
                if (events[0].segments?.length > 0) {
                  setSelectedSegmentId(events[0].segments[0].segmentId);
                }
              }
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} /> New Curing Schedule
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1.25rem', marginTop: '1rem' }}>
        {/* Left Pane: Schedules List */}
        <div className="casting-table-container" style={{ border: '1px solid var(--card-border)', borderRadius: '10px' }}>
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Active Curing Schedules ({schedules.length})</h3>
          </div>

          <table className="casting-table">
            <thead>
              <tr>
                <th>Schedule Code</th>
                <th>Segment</th>
                <th>Regime & Cement</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No curing schedules found. Create a schedule to monitor concrete hydration.
                  </td>
                </tr>
              ) : (
                schedules.map(sched => {
                  const isSelected = selectedSchedule && (selectedSchedule.id || selectedSchedule._id) === (sched.id || sched._id);
                  return (
                    <tr
                      key={sched.id || sched._id}
                      style={{ cursor: 'pointer', backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent' }}
                      onClick={() => handleSelectSchedule(sched)}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--accent, #10b981)' }}>{sched.scheduleCode}</td>
                      <td>{sched.segmentName || sched.segmentId}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 600 }}>{sched.cementType} ({sched.curingMethod})</span>
                        {sched.environmentalFlag === 'HOT_WEATHER_ARID' && (
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                            HOT / ARID
                          </span>
                        )}
                      </td>
                      <td>{sched.requiredDurationDays} days</td>
                      <td>
                        <span className={`status-badge ${
                          sched.status === 'ACTIVE' ? 'success' :
                          sched.status === 'INTERRUPTED' ? 'danger' :
                          sched.status === 'COMPLETED' ? 'primary' : 'warning'
                        }`}>
                          {sched.status}
                        </span>
                      </td>
                      <td>
                        {sched.status === 'PENDING_APPROVAL' && (
                          <button
                            className="casting-btn casting-btn-secondary casting-btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveSchedule(sched.id || sched._id);
                            }}
                          >
                            <ShieldCheck size={12} /> Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Pane: Schedule Inspection Logs */}
        <div style={{ border: '1px solid var(--card-border)', borderRadius: '10px', padding: '1.25rem', backgroundColor: 'var(--card-bg)' }}>
          {selectedSchedule ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
                    {selectedSchedule.scheduleCode} — {selectedSchedule.segmentName}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Target: {selectedSchedule.startDate} to {selectedSchedule.scheduledEndDate} ({selectedSchedule.requiredDurationDays} Days)</span>
                    <span style={{ margin: '0 0.5rem' }}>•</span>
                    <span>Method: {selectedSchedule.curingMethod}</span>
                  </div>
                </div>

                <button
                  className="casting-btn casting-btn-primary casting-btn-sm"
                  onClick={() => setShowLogModal(true)}
                  disabled={selectedSchedule.status === 'PENDING_APPROVAL'}
                >
                  <Plus size={14} /> Log Inspection Session
                </button>
              </div>

              {/* Status Banner */}
              {selectedSchedule.status === 'INTERRUPTED' && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem', color: 'var(--danger, #ef4444)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <AlertTriangle size={18} />
                  <span><strong>Curing Interruption Active:</strong> Moisture breach or water supply shortage recorded. Log a compensating remedial inspection once curing is restored.</span>
                </div>
              )}

              {/* Logs Table */}
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Inspection Sessions Log ({scheduleLogs.length})</h4>
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table className="casting-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Date / Session</th>
                      <th>Moisture State</th>
                      <th>Coverage</th>
                      <th>Checks</th>
                      <th>Inspector</th>
                      <th>Audit Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                          No daily inspection sessions logged yet.
                        </td>
                      </tr>
                    ) : (
                      scheduleLogs.map(log => (
                        <tr key={log.id || log._id} style={{ opacity: log.isSuperseded ? 0.5 : 1 }}>
                          <td>
                            <strong>{log.logDate}</strong>
                            <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-secondary)' }}>Session #{log.sessionIndex}</span>
                          </td>
                          <td>
                            <span style={{ color: log.isAdequatelyWet ? 'var(--accent, #10b981)' : 'var(--danger, #ef4444)', fontWeight: 600 }}>
                              {log.isAdequatelyWet ? 'Adequately Wet' : 'DRIED OUT'}
                            </span>
                          </td>
                          <td>{log.waterCoveragePercent}%</td>
                          <td>
                            {log.methodSpecificChecks?.pondingDepthMm && (
                              <span>Ponding: {log.methodSpecificChecks.pondingDepthMm} mm</span>
                            )}
                            {log.interruptionLogged && (
                              <span style={{ color: 'var(--danger, #ef4444)', display: 'block', fontSize: '0.7rem' }}>Interruption: {log.interruptionReason}</span>
                            )}
                          </td>
                          <td>{log.inspector?.name}</td>
                          <td>
                            {log.isSuperseded ? (
                              <span className="status-badge neutral" style={{ fontSize: '0.7rem' }}>SUPERSEDED</span>
                            ) : (
                              <span className="status-badge success" style={{ fontSize: '0.7rem' }}>ACTIVE</span>
                            )}
                          </td>
                          <td>
                            {!log.isSuperseded && (
                              <button
                                className="casting-btn casting-btn-secondary casting-btn-xs"
                                onClick={() => {
                                  setSelectedLogForCompensation(log);
                                  setIsAdequatelyWet(log.isAdequatelyWet);
                                  setWaterCoveragePercent(log.waterCoveragePercent);
                                  setShowCompensateModal(true);
                                }}
                              >
                                Correct
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Droplet size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>Select a curing schedule from the left pane to view inspection history and logs.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Create Curing Schedule */}
      {showCreateModal && (
        <div className="casting-modal-backdrop">
          <div className="casting-modal" style={{ maxWidth: '540px' }}>
            <div className="casting-modal-header">
              <h3 className="casting-modal-title">Create Curing Schedule (IS 456 Cl 13.5.1)</h3>
              <button className="casting-modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSchedule}>
              <div className="casting-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Casting Event</label>
                  <select
                    className="casting-select"
                    value={selectedEventId}
                    onChange={(e) => {
                      setSelectedEventId(e.target.value);
                      const ev = events.find(x => (x.id || x._id) === e.target.value);
                      if (ev?.segments?.length > 0) setSelectedSegmentId(ev.segments[0].segmentId);
                    }}
                    required
                  >
                    {events.map(ev => (
                      <option key={ev.id || ev._id} value={ev.id || ev._id}>{ev.title} ({ev.eventNumber})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Segment Identifier</label>
                  <select
                    className="casting-select"
                    value={selectedSegmentId}
                    onChange={(e) => setSelectedSegmentId(e.target.value)}
                    required
                  >
                    {selectedEvent?.segments?.map(s => (
                      <option key={s.segmentId} value={s.segmentId}>{s.segmentName} ({s.plannedVolumeM3} m³)</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Cement / Blend Type</label>
                    <select className="casting-select" value={cementType} onChange={e => setCementType(e.target.value)}>
                      <option value="OPC">OPC (Ordinary Portland)</option>
                      <option value="PPC">PPC (Portland Pozzolana)</option>
                      <option value="PSC">PSC (Portland Slag)</option>
                      <option value="GGBS_BLEND">GGBS Blend</option>
                      <option value="FLY_ASH_BLEND">Fly Ash Blend</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Curing Method</label>
                    <select className="casting-select" value={curingMethod} onChange={e => setCuringMethod(e.target.value)}>
                      <option value="PONDING">Ponding (Standing Water)</option>
                      <option value="WET_BURLAP_HESSIAN">Wet Burlap / Hessian Cloth</option>
                      <option value="CURING_COMPOUND">Curing Membrane / Compound</option>
                      <option value="SPRINKLING">Continuous Sprinkling</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Environmental Flag</label>
                    <select className="casting-select" value={environmentalFlag} onChange={e => setEnvironmentalFlag(e.target.value)}>
                      <option value="NORMAL">Normal Weather (Standard Regime)</option>
                      <option value="HOT_WEATHER_ARID">Hot-Weather / Arid (Extended Regime)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Start Date</label>
                    <input type="date" className="casting-select" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Daily Inspection Sessions</label>
                    <input type="number" min="1" max="4" className="casting-select" value={sessionsPerDay} onChange={e => setSessionsPerDay(e.target.value)} required />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Custom Duration Days (Optional)</label>
                    <input type="number" placeholder="Default per IS 456" className="casting-select" value={customDays} onChange={e => setCustomDays(e.target.value)} />
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)', color: 'var(--accent, #10b981)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Info size={14} />
                  <span><strong>Calculated Standard Target:</strong> {cementType === 'OPC' ? (environmentalFlag === 'HOT_WEATHER_ARID' ? '10 Days' : '7 Days') : (environmentalFlag === 'HOT_WEATHER_ARID' ? '14 Days' : '10 Days')} minimum curing required under IS 456 Clause 13.5.1.</span>
                </div>
              </div>

              <div className="casting-modal-footer">
                <button type="button" className="btn-secondary-dark" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-teal">Create Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Log Daily Inspection Session */}
      {showLogModal && (
        <div className="casting-modal-backdrop">
          <div className="casting-modal" style={{ maxWidth: '500px' }}>
            <div className="casting-modal-header">
              <h3 className="casting-modal-title">Log Daily Curing Inspection</h3>
              <button className="casting-modal-close" onClick={() => setShowLogModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleRecordLog}>
              <div className="casting-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Inspection Date</label>
                    <input type="date" className="casting-select" value={logDate} onChange={e => setLogDate(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Session Index</label>
                    <input type="number" min="1" max="4" className="casting-select" value={sessionIndex} onChange={e => setSessionIndex(e.target.value)} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Moisture Check</label>
                    <select className="casting-select" value={isAdequatelyWet ? 'YES' : 'NO'} onChange={e => setIsAdequatelyWet(e.target.value === 'YES')}>
                      <option value="YES">Adequately Wet (Saturated)</option>
                      <option value="NO">Inadequately Wet (DRIED OUT)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Water Coverage (%)</label>
                    <input type="number" min="0" max="100" className="casting-select" value={waterCoveragePercent} onChange={e => setWaterCoveragePercent(e.target.value)} required />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Ponding Depth (mm)</label>
                  <input type="number" min="0" className="casting-select" value={pondingDepthMm} onChange={e => setPondingDepthMm(e.target.value)} />
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={interruptionLogged} onChange={e => setInterruptionLogged(e.target.checked)} />
                    Log Interruption / Moisture Defect
                  </label>
                </div>

                {interruptionLogged && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Interruption Reason</label>
                      <input type="text" placeholder="e.g. Ponding bund breached, burlap dried out" className="casting-select" value={interruptionReason} onChange={e => setInterruptionReason(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Remedial Action Taken</label>
                      <input type="text" placeholder="e.g. Bund rebuilt, water tanker re-filled" className="casting-select" value={remedialActionTaken} onChange={e => setRemedialActionTaken(e.target.value)} required />
                    </div>
                  </>
                )}
              </div>

              <div className="casting-modal-footer">
                <button type="button" className="btn-secondary-dark" onClick={() => setShowLogModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-teal">Save Inspection Log</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Non-Destructive Compensating Correction */}
      {showCompensateModal && (
        <div className="casting-modal-backdrop">
          <div className="casting-modal" style={{ maxWidth: '480px' }}>
            <div className="casting-modal-header">
              <h3 className="casting-modal-title">Non-Destructive Log Correction</h3>
              <button className="casting-modal-close" onClick={() => setShowCompensateModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCompensateLog}>
              <div className="casting-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  This creates an immutable compensating record and marks the original session log as superseded. Historical inspection values will remain preserved in the audit trail.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Corrected Water Coverage (%)</label>
                  <input type="number" min="0" max="100" className="casting-select" value={waterCoveragePercent} onChange={e => setWaterCoveragePercent(e.target.value)} required />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Mandatory Correction Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Provide professional rationale for updating inspection values..."
                    className="casting-select"
                    value={correctionReason}
                    onChange={e => setCorrectionReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="casting-modal-footer">
                <button type="button" className="btn-secondary-dark" onClick={() => setShowCompensateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-teal">Submit Compensating Log</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
