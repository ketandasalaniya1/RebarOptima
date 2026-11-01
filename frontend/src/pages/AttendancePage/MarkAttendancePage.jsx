import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { attendanceApi, contractorsApi, manpowerApi } from '../../utils/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import { PageHeader, Button, EmptyState } from '../../components/ui';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { SOURCES, STATUSES, summarizeStatuses, todayISO } from './attendanceConstants';
import './AttendancePage.css';

function isDepartLabourDeptName(name) {
  const normalized = String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const compacted = normalized.replace(/\s/g, '');
  return (
    normalized.includes('depart labour') ||
    compacted.includes('departlabour') ||
    compacted.includes('departlabor')
  );
}

function resolveLabourMode(contractor) {
  if (!contractor) return null;
  const hasDepart = (contractor.departments || []).some((d) => isDepartLabourDeptName(d.name));
  if (hasDepart || contractor.attendanceMethod === 'each_worker_separately') return 'named';
  return 'workforce';
}

function contractorMatchesSource(contractor, source) {
  const mode = resolveLabourMode(contractor);
  if (source === 'contractor_named') return mode === 'named';
  if (source === 'contractor_workforce') return mode === 'workforce';
  return true;
}

export default function MarkAttendancePage() {
  const { projectId, projectEpoch, selectedProject } = useActiveProject();
  const [date, setDate] = useState(todayISO());
  const [shift, setShift] = useState('day');
  const [source, setSource] = useState('company_labour');
  const [contractorId, setContractorId] = useState('');
  const [contractors, setContractors] = useState([]);
  const [allLabours, setAllLabours] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedAssign, setSelectedAssign] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [subjects, setSubjects] = useState([]);
  const [workforceRows, setWorkforceRows] = useState([]);
  const [search, setSearch] = useState('');

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  };

  const compatibleContractors = useMemo(() => {
    if (source === 'company_labour') return [];
    return contractors.filter((c) => contractorMatchesSource(c, source));
  }, [contractors, source]);

  const loadContractors = useCallback(async () => {
    if (!projectId) return;
    try {
      const list = await contractorsApi.list();
      setContractors(Array.isArray(list) ? list : []);
    } catch (err) {
      setContractors([]);
      setError(err.message || 'Failed to load contractors');
    }
  }, [projectId]);

  const loadAssignmentsPanel = useCallback(async () => {
    if (!projectId) return;
    try {
      const [asg, labours] = await Promise.all([
        attendanceApi.getAssignments(),
        manpowerApi.listLabours(),
      ]);
      setAssignments(asg?.assignments || []);
      setAllLabours(Array.isArray(labours) ? labours : []);
      setSelectedAssign((asg?.assignments || []).map((a) => String(a.labourId)));
    } catch (err) {
      setAllLabours([]);
      setAssignments([]);
      setError(err.message || 'Failed to load company labour assignments');
    }
  }, [projectId]);

  const loadEligible = useCallback(async () => {
    if (!projectId || !date || !source) return;
    if (source !== 'company_labour' && !contractorId) {
      setSubjects([]);
      setWorkforceRows([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await attendanceApi.getEligible({
        date,
        shift,
        source,
        contractorId: source === 'company_labour' ? undefined : contractorId,
      });
      if (source === 'contractor_workforce') {
        setWorkforceRows(
          (data.workforceRows || []).map((r) => ({
            labourType: r.labourType,
            eligibleCount: r.eligibleCount || 0,
            present: r.present ?? 0,
            halfDay: r.halfDay ?? 0,
            absent: r.absent ?? 0,
            leave: r.leave ?? 0,
            weeklyOff: r.weeklyOff ?? 0,
            holiday: r.holiday ?? 0,
          })),
        );
        setSubjects([]);
      } else {
        setSubjects(
          (data.subjects || []).map((s) => ({
            ...s,
            // Keep unmarked as empty — never coerce to present
            status: s.status || '',
            remark: s.remark || '',
          })),
        );
        setWorkforceRows([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load eligible manpower');
      setSubjects([]);
      setWorkforceRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, date, shift, source, contractorId]);

  // Reset contractor + rows when project changes
  useEffect(() => {
    setContractorId('');
    setSubjects([]);
    setWorkforceRows([]);
    setError('');
  }, [projectId, projectEpoch]);

  useEffect(() => {
    loadContractors();
    loadAssignmentsPanel();
  }, [loadContractors, loadAssignmentsPanel, projectEpoch]);

  // Filter contractor by tab mode; clear or auto-pick compatible
  useEffect(() => {
    if (source === 'company_labour') {
      setContractorId('');
      return;
    }
    const stillValid =
      contractorId &&
      compatibleContractors.some((c) => String(c.id || c._id) === String(contractorId));
    if (stillValid) return;
    const first = compatibleContractors[0];
    setContractorId(first ? String(first.id || first._id) : '');
    setSubjects([]);
    setWorkforceRows([]);
  }, [source, compatibleContractors, contractorId]);

  useEffect(() => {
    loadEligible();
  }, [loadEligible]);

  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) =>
      `${s.name} ${s.labourType} ${s.phone}`.toLowerCase().includes(q),
    );
  }, [subjects, search]);

  const markedSubjects = useMemo(
    () => subjects.filter((s) => s.status),
    [subjects],
  );

  const summary = useMemo(() => {
    if (source === 'contractor_workforce') {
      return workforceRows.reduce(
        (acc, r) => {
          acc.present += Number(r.present) || 0;
          acc.halfDay += Number(r.halfDay) || 0;
          acc.absent += Number(r.absent) || 0;
          acc.leave += Number(r.leave) || 0;
          acc.weeklyOff += Number(r.weeklyOff) || 0;
          acc.holiday += Number(r.holiday) || 0;
          acc.workedDays += (Number(r.present) || 0) + (Number(r.halfDay) || 0) * 0.5;
          return acc;
        },
        { present: 0, halfDay: 0, absent: 0, leave: 0, weeklyOff: 0, holiday: 0, workedDays: 0 },
      );
    }
    return summarizeStatuses(filteredSubjects.filter((s) => s.status));
  }, [source, workforceRows, filteredSubjects]);

  const workforceReconcileOk = useMemo(() => {
    if (source !== 'contractor_workforce') return true;
    if (workforceRows.length === 0) return false;
    return workforceRows.every((r) => {
      const sum =
        Number(r.present) +
        Number(r.halfDay) +
        Number(r.absent) +
        Number(r.leave) +
        Number(r.weeklyOff) +
        Number(r.holiday);
      return sum === Number(r.eligibleCount);
    });
  }, [source, workforceRows]);

  const canSave = useMemo(() => {
    if (saving || loading) return false;
    if (source !== 'company_labour' && !contractorId) return false;
    if (source === 'contractor_workforce') return workforceReconcileOk;
    return markedSubjects.length > 0;
  }, [saving, loading, source, contractorId, workforceReconcileOk, markedSubjects.length]);

  const bulkStatus = (status) => {
    setSubjects((prev) => prev.map((s) => ({ ...s, status })));
  };

  const saveAssignments = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await attendanceApi.setAssignments(selectedAssign);
      setAssignments(res?.assignments || []);
      setAssignOpen(false);
      flash('Company labour assignments saved');
      if (source === 'company_labour') await loadEligible();
    } catch (err) {
      setError(err.message || 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        date,
        shift,
        source,
        contractorId: source === 'company_labour' ? undefined : contractorId,
      };
      if (source === 'contractor_workforce') {
        for (const r of workforceRows) {
          const sum =
            Number(r.present) +
            Number(r.halfDay) +
            Number(r.absent) +
            Number(r.leave) +
            Number(r.weeklyOff) +
            Number(r.holiday);
          if (sum !== Number(r.eligibleCount)) {
            throw new Error(
              `${r.labourType}: counts (${sum}) must equal eligible (${r.eligibleCount})`,
            );
          }
        }
        payload.rows = workforceRows;
      } else {
        const lines = markedSubjects.map((s) => ({
          subjectId: s.subjectId,
          status: s.status,
          remark: s.remark || '',
        }));
        if (lines.length === 0) {
          throw new Error('Select a status for at least one worker before saving');
        }
        payload.lines = lines;
      }
      await attendanceApi.saveSession(payload);
      flash('Attendance saved');
      await loadEligible();
    } catch (err) {
      setError(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return (
      <div className="att-page">
        <EmptyState title="Select a project" description="Attendance is project-scoped." />
      </div>
    );
  }

  return (
    <div className="att-page">
      <PageHeader
        title="Mark Attendance"
        subtitle={`Record day/night attendance for ${selectedProject?.name || 'this project'}.`}
      />

      {error && (
        <div className="att-banner att-banner--error">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {success && <div className="att-banner att-banner--ok">{success}</div>}

      <div className="att-toolbar">
        <div className="att-field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="att-field">
          <label>Shift</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </div>
        {source !== 'company_labour' && (
          <div className="att-field">
            <label>Contractor</label>
            <select
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
              disabled={compatibleContractors.length === 0}
            >
              {compatibleContractors.length === 0 ? (
                <option value="">No compatible contractors</option>
              ) : (
                compatibleContractors.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
        <div className="att-field">
          <label>Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name / type…"
          />
        </div>
        {source === 'company_labour' && (
          <Button variant="secondary" onClick={() => setAssignOpen((v) => !v)}>
            Assign company labour
          </Button>
        )}
      </div>

      <div className="att-tabs">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`att-tab ${source === s.value ? 'active' : ''}`}
            onClick={() => setSource(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {assignOpen && (
        <div className="att-card">
          <h3 style={{ marginTop: 0 }}>Assign company labour to this project</h3>
          <div className="att-chip-row">
            {allLabours.map((l) => {
              const id = String(l.id || l._id);
              const checked = selectedAssign.includes(id);
              return (
                <label key={id} className="att-chip" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedAssign((prev) =>
                        checked ? prev.filter((x) => x !== id) : [...prev, id],
                      )
                    }
                  />
                  {l.name} ({l.labourType})
                </label>
              );
            })}
            {allLabours.length === 0 && <span className="att-muted">No company labour yet.</span>}
          </div>
          <div className="att-actions">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveAssignments} disabled={saving}>
              Save assignments
            </Button>
          </div>
        </div>
      )}

      <div className="att-summary">
        {[
          ['Present', summary.present],
          ['Half Day', summary.halfDay],
          ['Absent', summary.absent],
          ['Leave', summary.leave],
          ['Weekly Off', summary.weeklyOff],
          ['Holiday', summary.holiday],
          ['Worked', summary.workedDays],
        ].map(([lbl, val]) => (
          <div key={lbl} className="att-kpi">
            <div className="lbl">{lbl}</div>
            <div className="val">{val}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading…" minHeight="30vh" />
      ) : source === 'contractor_workforce' ? (
        <div className="att-card att-table-wrap">
          {workforceRows.length === 0 ? (
            <EmptyState
              title="No workforce rows"
              description="Configure workforce under Contractor Labour, or pick a workforce-mode contractor."
            />
          ) : (
            <table className="att-table">
              <thead>
                <tr>
                  <th>Labour type</th>
                  <th>Eligible</th>
                  <th>Present</th>
                  <th>Half Day</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Weekly Off</th>
                  <th>Holiday</th>
                </tr>
              </thead>
              <tbody>
                {workforceRows.map((r, idx) => (
                  <tr key={r.labourType}>
                    <td>{r.labourType}</td>
                    <td>{r.eligibleCount}</td>
                    {['present', 'halfDay', 'absent', 'leave', 'weeklyOff', 'holiday'].map((k) => (
                      <td key={k}>
                        <input
                          type="number"
                          min="0"
                          value={r[k]}
                          onChange={(e) => {
                            const v = e.target.value;
                            setWorkforceRows((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, [k]: v } : row)),
                            );
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="att-card att-table-wrap">
          {filteredSubjects.length === 0 ? (
            <EmptyState
              title={source === 'company_labour' ? 'No company labour' : 'No workers'}
              description={
                source === 'company_labour'
                  ? 'Add company labour under Manpower, or assign a subset to this project.'
                  : 'Nothing to mark for this selection.'
              }
            />
          ) : (
            <>
              <div className="att-actions" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
                <Button variant="secondary" onClick={() => bulkStatus('present')}>
                  All Present
                </Button>
                <Button variant="secondary" onClick={() => bulkStatus('absent')}>
                  All Absent
                </Button>
                <Button variant="secondary" onClick={() => bulkStatus('half_day')}>
                  All Half Day
                </Button>
              </div>
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((s) => (
                    <tr key={s.subjectId}>
                      <td>{s.name}</td>
                      <td>{s.labourType || '—'}</td>
                      <td>
                        <select
                          value={s.status || ''}
                          onChange={(e) =>
                            setSubjects((prev) =>
                              prev.map((row) =>
                                row.subjectId === s.subjectId
                                  ? { ...row, status: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        >
                          <option value="">—</option>
                          {STATUSES.map((st) => (
                            <option key={st.value} value={st.value}>
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={s.remark || ''}
                          onChange={(e) =>
                            setSubjects((prev) =>
                              prev.map((row) =>
                                row.subjectId === s.subjectId
                                  ? { ...row, remark: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      <div className="att-actions">
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save attendance'}
        </Button>
      </div>
    </div>
  );
}
