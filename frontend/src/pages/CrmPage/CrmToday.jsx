import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Phone, MessageCircle, Plus, UserPlus, Users, Bell, MapPin, CheckSquare } from 'lucide-react';
import { crmApi } from '../../utils/crmApi';
import RoleGate from '../../components/RoleGate';
import { formatClock, stageTone, whatsAppUrl } from './crmFormat';
import { CrmFollowUpModal } from './crmDeskModals';

function greeting(timeZone) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CrmToday({ projectId, projectName, refreshKey, onDealWon, onAddLead, onAddCustomer, onOpenLead, onOpenLeads, onOpenCalendar }) {
  const user = useSelector((state) => state.auth?.user);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [follow, setFollow] = useState(null);

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    crmApi.getToday(projectId)
      .then((res) => { setData(res); setError(''); })
      .catch((err) => setError(err.message || 'Could not load today'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId, refreshKey]);

  const name = user?.fullName || user?.name || 'there';
  const counts = data?.counts || {};
  const followUps = [...(data?.overdue || []), ...(data?.dueToday || [])];
  const schedule = [
    ...(data?.appointmentsToday || []).map((v) => ({ id: v._id, at: v.visitDateTime, title: 'Site Visit', who: v.customerName, where: v.notes || v.projectName || '' })),
    ...(data?.tasksToday || []).map((t) => ({ id: t._id, at: t.dueDateTime, title: t.taskType || 'Follow-up', who: t.customerName, where: t.title })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <div className="cx">
      <div className="cx-head">
        <div>
          <h2>{greeting(data?.timeZone)}, {name.split(' ')[0]}</h2>
          <p>Here is your sales activity for {projectName || data?.projectName || 'this project'}.</p>
        </div>
        <div className="cx-head-actions">
          <RoleGate permission="crm.leads">
            <button type="button" className="cx-btn" onClick={onAddLead}><Plus size={16} /> New Lead</button>
            <button type="button" className="cx-btn cx-btn-ghost" onClick={onAddCustomer}><UserPlus size={16} /> New Customer</button>
          </RoleGate>
        </div>
      </div>
      {error ? <p className="cx-error">{error}</p> : null}
      {loading && !data ? <p className="cx-muted">Loading today’s work…</p> : null}
      {data && (
        <>
          <div className="cx-stats">
            <article><span className="cx-stat-ic"><Users size={18} /></span><div><strong>{counts.totalLeads || 0}</strong><small>Total Leads</small></div></article>
            <article><span className="cx-stat-ic warn"><Bell size={18} /></span><div><strong>{counts.followUpsDue || 0}</strong><small>Follow-ups Due</small></div></article>
            <article><span className="cx-stat-ic"><MapPin size={18} /></span><div><strong>{counts.siteVisits || 0}</strong><small>Site Visits</small></div></article>
            <article><span className="cx-stat-ic"><CheckSquare size={18} /></span><div><strong>{counts.openTasks || 0}</strong><small>Open Tasks</small></div></article>
          </div>
          <div className="cx-split">
            <section className="cx-card">
              <header>
                <h3>Today’s Follow-ups ({followUps.length})</h3>
                <button type="button" onClick={onOpenLeads}>View all</button>
              </header>
              {followUps.map((lead) => {
                const overdue = (data.overdue || []).some((row) => String(row._id) === String(lead._id));
                return (
                  <div key={lead._id} className="cx-person">
                    <button type="button" className="cx-person-hit" onClick={() => onOpenLead?.(lead)}>
                      <span className="cx-avatar">{(lead.customerName || '?').slice(0, 2).toUpperCase()}</span>
                      <span>
                        <strong>{lead.customerName}</strong>
                        <small>{lead.requirement || lead.stage}{lead.projectName ? ` · ${lead.projectName}` : ''}</small>
                      </span>
                    </button>
                    <span className={`cx-pill ${overdue ? 'is-late' : 'is-today'}`}>{overdue ? 'Overdue' : 'Today'}</span>
                    <a className="cx-icon" href={lead.whatsAppUrl || whatsAppUrl(lead.customerPhone, '')} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={16} /></a>
                    <a className="cx-icon" href={`tel:${lead.customerPhone || ''}`} aria-label="Call"><Phone size={16} /></a>
                    <button type="button" className="cx-link" onClick={() => setFollow({ lead, rows: followUps })}>Log</button>
                  </div>
                );
              })}
              {!followUps.length && <p className="cx-muted">No follow-ups due. Add a lead to start the day.</p>}
            </section>
            <section className="cx-card">
              <header>
                <h3>Today’s Schedule</h3>
                <button type="button" onClick={onOpenCalendar}>View calendar</button>
              </header>
              {schedule.map((item) => (
                <div key={item.id} className="cx-slot">
                  <div>
                    <strong>{formatClock(item.at, data.timeZone)} {item.title}</strong>
                    <small>{item.who}{item.where ? ` · ${item.where}` : ''}</small>
                  </div>
                  <span className={`cx-badge ${stageTone(item.title)}`}>{item.title}</span>
                </div>
              ))}
              {!schedule.length && <p className="cx-muted">Nothing scheduled today.</p>}
            </section>
          </div>
        </>
      )}
      <CrmFollowUpModal
        open={!!follow}
        lead={follow?.lead}
        queue={follow?.rows || []}
        projectName={projectName || data?.projectName}
        templates={data?.messageTemplates}
        timeZone={data?.timeZone}
        onClose={() => setFollow(null)}
        onLogged={load}
        onDealWon={(lead) => { setFollow(null); onDealWon?.(lead); }}
      />
    </div>
  );
}
