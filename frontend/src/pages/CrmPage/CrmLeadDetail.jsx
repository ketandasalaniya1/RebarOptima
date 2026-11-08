import React, { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle, Phone } from 'lucide-react';
import { crmApi } from '../../utils/crmApi';
import { formatWhen, stageTone, whatsAppUrl } from './crmFormat';
import { CrmAppointmentModal, CrmFollowUpModal, CrmTaskModal } from './crmDeskModals';

const TABS = ['Overview', 'Activities', 'Tasks', 'Site Visits', 'Bookings'];

export default function CrmLeadDetail({ leadId, projectId, projectName, onBack, onDealWon }) {
  const [detail, setDetail] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState('Overview');
  const [error, setError] = useState('');
  const [follow, setFollow] = useState(false);
  const [visit, setVisit] = useState(false);
  const [task, setTask] = useState(false);

  const load = () => {
    if (!leadId) return;
    crmApi.getLeadDetail(leadId)
      .then((res) => { setDetail(res); setError(''); })
      .catch((err) => setError(err.message || 'Could not open this lead'));
    if (projectId) {
      crmApi.getBookings({ projectId }).then((rows) => setBookings(Array.isArray(rows) ? rows : [])).catch(() => setBookings([]));
    }
  };

  useEffect(() => { load(); }, [leadId, projectId]);

  const lead = detail?.lead;
  const customer = detail?.customer;
  if (error) return <div className="cx"><button type="button" className="cx-back" onClick={onBack}><ArrowLeft size={16} /> Back to Leads</button><p className="cx-error">{error}</p></div>;
  if (!lead) return <div className="cx"><p className="cx-muted">Opening lead…</p></div>;

  const phone = lead.customerPhone || customer?.phone || '';
  const mine = bookings.filter((b) => String(b.customerId) === String(lead.customerId));
  const openLead = lead.stage === 'Lost' || lead.stage === 'Booked' ? [] : [lead];

  const win = async () => {
    try {
      const result = await crmApi.logFollowUp(lead._id, { outcome: 'deal_won', message: 'Deal won' });
      onDealWon?.(result.lead || lead);
    } catch (err) {
      setError(err.message || 'Could not mark this deal');
    }
  };

  return (
    <div className="cx">
      <button type="button" className="cx-back" onClick={onBack}><ArrowLeft size={16} /> Back to Leads</button>
      <div className="cx-profile">
        <span className="cx-avatar lg">{(lead.customerName || '?').slice(0, 2).toUpperCase()}</span>
        <div>
          <h2>{lead.customerName} <span className={`cx-badge ${stageTone(lead.stage)}`}>{lead.stage}</span></h2>
          <p>{phone}{customer?.email ? ` · ${customer.email}` : ''}</p>
        </div>
        <div className="cx-head-actions">
          <a className="cx-btn" href={whatsAppUrl(phone, '')} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
          <a className="cx-btn cx-btn-ghost" href={`tel:${phone}`}><Phone size={16} /> Call</a>
        </div>
      </div>
      <div className="cx-tabs">
        {TABS.map((name) => <button key={name} type="button" className={tab === name ? 'is-on' : ''} onClick={() => setTab(name)}>{name}</button>)}
      </div>
      {tab === 'Overview' && (
        <div className="cx-detail-grid">
          <section className="cx-card">
            <h3>Lead Details</h3>
            <dl>
              <div><dt>Project</dt><dd>{lead.projectName || projectName}</dd></div>
              <div><dt>Interest</dt><dd>{lead.requirement || lead.unitCode || '—'}</dd></div>
              <div><dt>Source</dt><dd>{lead.leadSource || '—'}</dd></div>
              <div><dt>Assigned to</dt><dd>{lead.assignedSalespersonName || 'Unassigned'}</dd></div>
              <div><dt>Next follow-up</dt><dd>{formatWhen(lead.nextFollowUpDate)}</dd></div>
              <div><dt>Stage</dt><dd>{lead.stage}</dd></div>
            </dl>
          </section>
          <section className="cx-card">
            <h3>Timeline / Activity</h3>
            <ul className="cx-timeline">
              {(detail.activities || []).slice(0, 8).map((a) => (
                <li key={a._id}><strong>{a.title}</strong><small>{a.description}</small><time>{formatWhen(a.createdAt)}</time></li>
              ))}
              {!(detail.activities || []).length && <li><small>No activity yet.</small></li>}
            </ul>
          </section>
          <section className="cx-card">
            <h3>Quick Actions</h3>
            <button type="button" disabled={!openLead.length} onClick={() => setFollow(true)}>Log follow-up</button>
            <button type="button" disabled={!openLead.length} onClick={() => setVisit(true)}>Schedule site visit</button>
            <button type="button" disabled={!openLead.length} onClick={() => setTask(true)}>Create task</button>
            <button type="button" disabled={!openLead.length} onClick={win}>Mark as deal won</button>
            <button type="button" onClick={() => onDealWon?.(lead)}>Convert to booking</button>
          </section>
        </div>
      )}
      {tab === 'Activities' && (
        <section className="cx-card">
          <ul className="cx-timeline">
            {(detail.activities || []).map((a) => (
              <li key={a._id}><strong>{a.title}</strong><small>{a.description}</small><time>{formatWhen(a.createdAt)}</time></li>
            ))}
            {!(detail.activities || []).length && <li><small>No activity yet.</small></li>}
          </ul>
        </section>
      )}
      {tab === 'Tasks' && (
        <section className="cx-card">
          {(detail.followUps || []).map((t) => (
            <div key={t._id} className="cx-slot"><div><strong>{t.title}</strong><small>{t.status} · {formatWhen(t.dueDateTime)}</small></div></div>
          ))}
          {!(detail.followUps || []).length && <p className="cx-muted">No tasks for this lead.</p>}
        </section>
      )}
      {tab === 'Site Visits' && (
        <section className="cx-card">
          {(detail.siteVisits || []).map((v) => (
            <div key={v._id} className="cx-slot"><div><strong>{v.status}</strong><small>{formatWhen(v.visitDateTime)}{v.notes ? ` · ${v.notes}` : ''}</small></div></div>
          ))}
          {!(detail.siteVisits || []).length && <p className="cx-muted">No site visits yet.</p>}
        </section>
      )}
      {tab === 'Bookings' && (
        <section className="cx-card">
          {mine.map((b) => (
            <div key={b._id} className="cx-slot"><div><strong>{b.bookingReference}</strong><small>Unit {b.unitCode} · {b.status}</small></div></div>
          ))}
          {!mine.length && <p className="cx-muted">No booking for this customer on this project.</p>}
        </section>
      )}
      <CrmFollowUpModal open={follow} lead={lead} queue={openLead} projectName={projectName} onClose={() => setFollow(false)} onLogged={load} onDealWon={(row) => { setFollow(false); onDealWon?.(row); }} />
      <CrmAppointmentModal open={visit} projectId={projectId} leads={openLead} onClose={() => setVisit(false)} onSaved={() => { setVisit(false); load(); }} />
      <CrmTaskModal open={task} projectId={projectId} leads={openLead} onClose={() => setTask(false)} onSaved={() => { setTask(false); load(); }} />
    </div>
  );
}
