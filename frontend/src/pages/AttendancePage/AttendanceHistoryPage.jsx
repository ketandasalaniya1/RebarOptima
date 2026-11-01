import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { AlertTriangle } from 'lucide-react';
import { attendanceApi } from '../../utils/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import { PageHeader, Button, EmptyState } from '../../components/ui';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { selectHasFeature } from '../../store/slices/permissionsSlice';
import { SOURCES, sourceLabel, todayISO } from './attendanceConstants';
import './AttendancePage.css';

export default function AttendanceHistoryPage() {
  const { projectId, projectEpoch, selectedProject } = useActiveProject();
  const canVoid = useSelector((state) => selectHasFeature(state, 'attendance', 'delete'));
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [shift, setShift] = useState('');
  const [source, setSource] = useState('');
  const [sessions, setSessions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await attendanceApi.listSessions({
        from,
        to,
        shift: shift || undefined,
        source: source || undefined,
      });
      setSessions(res?.sessions || []);
    } catch (err) {
      setError(err.message || 'Failed to load history');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, from, to, shift, source]);

  useEffect(() => {
    load();
  }, [load, projectEpoch]);

  const openDetail = async (id) => {
    setError('');
    try {
      const d = await attendanceApi.getSession(id);
      setDetail(d);
    } catch (err) {
      setError(err.message || 'Failed to load session');
    }
  };

  const voidSession = async (id) => {
    if (!confirm('Void this attendance session? History is preserved as voided.')) return;
    try {
      await attendanceApi.voidSession(id);
      setSuccess('Session voided');
      setTimeout(() => setSuccess(''), 3000);
      setDetail(null);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to void');
    }
  };

  if (!projectId) {
    return (
      <div className="att-page">
        <EmptyState title="Select a project" description="Attendance history is project-scoped." />
      </div>
    );
  }

  return (
    <div className="att-page">
      <PageHeader
        title="Attendance History"
        subtitle={`Saved sessions for ${selectedProject?.name || 'this project'}.`}
      />

      {error && (
        <div className="att-banner att-banner--error">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {success && <div className="att-banner att-banner--ok">{success}</div>}

      <div className="att-toolbar">
        <div className="att-field">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="att-field">
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="att-field">
          <label>Shift</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="">All</option>
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </div>
        <div className="att-field">
          <label>Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" onClick={load}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading history…" minHeight="30vh" />
      ) : (
        <div className="att-card att-table-wrap">
          {sessions.length === 0 ? (
            <EmptyState title="No sessions" description="No saved attendance in this range." />
          ) : (
            <table className="att-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift</th>
                  <th>Source</th>
                  <th>Worked</th>
                  <th>Present</th>
                  <th>Half Day</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td>{s.shift}</td>
                    <td>{sourceLabel(s.source)}</td>
                    <td>{s.totals?.workedDays ?? '—'}</td>
                    <td>{s.totals?.present ?? '—'}</td>
                    <td>{s.totals?.halfDay ?? '—'}</td>
                    <td>
                      <Button variant="secondary" onClick={() => openDetail(s.id)}>
                        View
                      </Button>{' '}
                      {canVoid && (
                        <Button variant="danger" onClick={() => voidSession(s.id)}>
                          Void
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {detail && (
        <div className="att-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>
              {detail.session?.date} · {detail.session?.shift} ·{' '}
              {sourceLabel(detail.session?.source)}
            </h3>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Close
            </Button>
          </div>
          <div className="att-table-wrap" style={{ marginTop: 12 }}>
            {detail.lines ? (
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Worked</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td>{l.labourType}</td>
                      <td>{l.status}</td>
                      <td>{l.workedDays}</td>
                      <td>{l.remark || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Eligible</th>
                    <th>P</th>
                    <th>H</th>
                    <th>A</th>
                    <th>Leave</th>
                    <th>WO</th>
                    <th>Hol</th>
                    <th>Worked</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.workforceRows || []).map((r) => (
                    <tr key={r.labourType}>
                      <td>{r.labourType}</td>
                      <td>{r.eligibleCount}</td>
                      <td>{r.present}</td>
                      <td>{r.halfDay}</td>
                      <td>{r.absent}</td>
                      <td>{r.leave}</td>
                      <td>{r.weeklyOff}</td>
                      <td>{r.holiday}</td>
                      <td>{r.workedPersonDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
