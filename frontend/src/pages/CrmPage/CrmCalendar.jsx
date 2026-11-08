import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { crmApi } from '../../utils/crmApi';
import RoleGate from '../../components/RoleGate';
import { formatClock, formatDay } from './crmFormat';
import { CrmAppointmentModal, CrmFollowUpModal } from './crmDeskModals';

const KIND = { followup: 'Follow-up', visit: 'Visit', task: 'Task', payment: 'Payment due' };

function monthKey(date, timeZone) {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  return `${key.slice(0, 8)}01`;
}

function shiftMonth(dayKey, delta) {
  const [y, m] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

function addDays(dayKey, days) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export default function CrmCalendar({ projectId, projectName, refreshKey, onDealWon }) {
  const [cursor, setCursor] = useState(() => monthKey(new Date(), 'Asia/Kolkata'));
  const [data, setData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [follow, setFollow] = useState(null);
  const [mode, setMode] = useState('month');
  const [presetWhen, setPresetWhen] = useState('');

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    Promise.allSettled([
      crmApi.getCalendar({ projectId, from: cursor }),
      crmApi.getLeads({ projectId }),
    ]).then(([calRes, leadRes]) => {
      if (calRes.status === 'rejected') {
        setError(calRes.reason?.message || 'Could not load the calendar');
        return;
      }
      const cal = calRes.value;
      const rows = leadRes.status === 'fulfilled' && Array.isArray(leadRes.value) ? leadRes.value : [];
      setData(cal);
      setLeads(rows);
      setError('');
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: cal?.timeZone || 'Asia/Kolkata',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      setSelected((current) => (current && current.slice(0, 7) === cursor.slice(0, 7) ? current : (today.slice(0, 7) === cursor.slice(0, 7) ? today : cursor)));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId, refreshKey, cursor]);

  const tz = data?.timeZone || 'Asia/Kolkata';
  const openLeads = leads.filter((l) => l.stage !== 'Lost' && l.stage !== 'Booked');
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const cells = useMemo(() => {
    const [y, m] = cursor.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const startPad = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const list = [];
    for (let i = 0; i < startPad; i += 1) list.push(null);
    for (let d = 1; d <= days; d += 1) list.push(`${cursor.slice(0, 8)}${String(d).padStart(2, '0')}`);
    while (list.length % 7) list.push(null);
    return list;
  }, [cursor]);
  const byDay = useMemo(() => {
    const map = {};
    for (const ev of data?.events || []) {
      const key = formatDay(ev.at, tz);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [data, tz]);

  const label = new Date(`${cursor}T00:00:00Z`).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dayEvents = byDay[selected] || [];
  const openLead = leads.find((l) => String(l._id) === String(follow?.leadId));
  const weekDays = selected ? Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = selected.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const monday = addDays(selected, -((dt.getUTCDay() + 6) % 7));
    return addDays(monday, i);
  }) : [];

  const addOnDay = (day) => {
    setSelected(day);
    setPresetWhen(`${day}T10:00`);
    setOpen(true);
  };

  if (!projectId) {
    return <div className="cx"><h2>Calendar</h2><p className="cx-muted">Pick a project in the header. This calendar shows that project’s follow-ups, visits, and tasks.</p></div>;
  }

  return (
    <div className="cx">
      <div className="cx-head">
        <div className="cx-cal-nav">
          <button type="button" className="cx-icon" onClick={() => setCursor(shiftMonth(cursor, -1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <h2>{label}</h2>
          <button type="button" className="cx-icon" onClick={() => setCursor(shiftMonth(cursor, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
        <div className="cx-head-actions">
          <div className="cx-seg">
            {['month', 'week', 'day'].map((m) => (
              <button key={m} type="button" className={mode === m ? 'is-on' : ''} onClick={() => setMode(m)}>{m[0].toUpperCase() + m.slice(1)}</button>
            ))}
          </div>
          <RoleGate permission="crm.leads">
            <button type="button" className="cx-btn" onClick={() => { setPresetWhen(''); setOpen(true); }} disabled={!openLeads.length}><Plus size={16} /> Add Event</button>
          </RoleGate>
        </div>
      </div>
      {error ? <p className="cx-error">{error}</p> : null}
      {loading && !data ? <p className="cx-muted">Loading the month…</p> : null}
      <div className={mode === 'month' ? 'cx-cal-layout' : ''}>
        {mode === 'month' && (
          <div className="cx-cal-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cx-cal-head">{d}</div>)}
            {cells.map((day, i) => (
              <button
                key={day || `e${i}`}
                type="button"
                className={`cx-cal-cell ${selected === day ? 'is-on' : ''} ${day === todayKey ? 'is-today' : ''}`}
                disabled={!day}
                onClick={() => day && setSelected(day)}
              >
                {day ? <span>{Number(day.slice(8))}</span> : null}
                {(byDay[day] || []).slice(0, 3).map((ev) => (
                  <em key={ev.id} className={`cx-ev ${ev.type}`}>{formatClock(ev.at, tz)} {ev.title}</em>
                ))}
              </button>
            ))}
          </div>
        )}
        {mode === 'week' && (
          <div className="cx-week">
            {weekDays.map((day) => (
              <section key={day} className={selected === day ? 'is-on' : ''}>
                <button type="button" onClick={() => setSelected(day)}><strong>{Number(day.slice(8))}</strong></button>
                {(byDay[day] || []).map((ev) => <em key={ev.id} className={`cx-ev ${ev.type}`}>{ev.title}</em>)}
              </section>
            ))}
          </div>
        )}
        <aside className="cx-card cx-day">
          <header>
            <h3>{selected ? new Date(`${selected}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Pick a day'}</h3>
          </header>
          {dayEvents.map((ev) => (
            <div key={ev.id} className="cx-slot">
              <div>
                <strong>{formatClock(ev.at, tz)} {KIND[ev.type] || ev.type}</strong>
                <small>{ev.title}{ev.detail ? ` · ${ev.detail}` : ''}</small>
              </div>
              {ev.leadId ? <button type="button" className="cx-link" onClick={() => setFollow(ev)}>Log</button> : null}
            </div>
          ))}
          {selected && !dayEvents.length ? <p className="cx-muted">Nothing on this day.</p> : null}
          <RoleGate permission="crm.leads">
            <button type="button" className="cx-btn cx-btn-ghost" disabled={!openLeads.length || !selected} onClick={() => selected && addOnDay(selected)}>+ Add to this day</button>
          </RoleGate>
        </aside>
      </div>
      {!openLeads.length ? <p className="cx-muted">Add a lead first. A visit or task is saved on that person.</p> : null}
      <CrmAppointmentModal open={open} projectId={projectId} leads={openLeads} initialWhen={presetWhen} onClose={() => setOpen(false)} onSaved={load} />
      <CrmFollowUpModal
        open={!!follow && !!openLead}
        lead={openLead}
        queue={openLeads}
        projectName={projectName || data?.projectName}
        templates={data?.messageTemplates}
        onClose={() => setFollow(null)}
        onLogged={load}
        onDealWon={(lead) => { setFollow(null); onDealWon?.(lead); }}
      />
    </div>
  );
}
