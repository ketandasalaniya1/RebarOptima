import React, { useEffect, useMemo, useState } from 'react';
import { crmApi } from '../../utils/crmApi';
import AppModal from '../../components/ui/AppModal';
import { fillTemplate, whatsAppUrl } from './crmFormat';

const STAGES = ['New', 'Contacted', 'Qualified', 'Visit Scheduled', 'Visited', 'Negotiation', 'On Hold'];

export function CrmAddLeadModal({ open, projectId, onClose, onSaved }) {
  const [sources, setSources] = useState(['Website', 'Walk-in', 'Referral', 'Facebook Ads', 'Instagram', 'Google', 'JustDial', 'Direct Call']);
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', leadSource: 'Direct Call', stage: 'New',
    requirement: '', nextFollowUpDate: '', notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    crmApi.getSettings().then((s) => {
      if (Array.isArray(s?.leadSources) && s.leadSources.length) setSources(s.leadSources);
    }).catch(() => {});
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await crmApi.createLead({ ...form, projectId });
      if (result.reused) {
        setError('This number already has an open lead on this project. No second lead was created.');
        onSaved?.(result);
        return;
      }
      onSaved?.(result);
      onClose?.();
      setForm({ fullName: '', phone: '', email: '', leadSource: 'Direct Call', stage: 'New', requirement: '', nextFollowUpDate: '', notes: '' });
    } catch (err) {
      setError(err.message || 'Could not save this lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} title="Add lead" size="lg">
      <form onSubmit={submit} className="crm-desk-form">
        <label>Name<input required value={form.fullName} onChange={set('fullName')} placeholder="Rahul Sharma" /></label>
        <label>WhatsApp number<input required value={form.phone} onChange={set('phone')} placeholder="98765 43210" /></label>
        <label>Source
          <select value={form.leadSource} onChange={set('leadSource')}>
            {sources.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Stage
          <select value={form.stage} onChange={set('stage')}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Interested in<input value={form.requirement} onChange={set('requirement')} placeholder="3BHK, tower A" /></label>
        <label>Next follow-up<input type="date" value={form.nextFollowUpDate} onChange={set('nextFollowUpDate')} /></label>
        <label>Email<input type="email" value={form.email} onChange={set('email')} /></label>
        <label className="full">Notes<textarea value={form.notes} onChange={set('notes')} rows={3} /></label>
        {error ? <p className="crm-desk-error full">{error}</p> : null}
        <div className="crm-desk-form-actions full">
          <button type="button" className="crm-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="crm-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add lead'}</button>
        </div>
      </form>
    </AppModal>
  );
}

export function CrmFollowUpModal({ open, lead, queue, projectName, templates, timeZone, onClose, onLogged, onDealWon }) {
  const [index, setIndex] = useState(0);
  const current = queue?.length ? queue[Math.min(index, queue.length - 1)] : lead;
  const [templateId, setTemplateId] = useState(templates?.[0]?.id || '');
  const [message, setMessage] = useState('');
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = lead && queue?.length ? Math.max(0, queue.findIndex((l) => String(l._id) === String(lead._id))) : 0;
    setIndex(start === -1 ? 0 : start);
  }, [open, lead, queue]);

  const activeTemplates = templates?.length ? templates : [];
  const chosen = activeTemplates.find((t) => t.id === templateId) || activeTemplates[0];

  useEffect(() => {
    if (!open || !current) return;
    setMessage(fillTemplate(chosen?.body || '', current, projectName));
    setError('');
    crmApi.getLeadDetail(current._id).then((d) => setActivities(d.activities || [])).catch(() => setActivities([]));
  }, [open, current?._id, chosen?.id, projectName]);

  const link = useMemo(() => whatsAppUrl(current?.customerPhone, message), [current?.customerPhone, message]);

  const log = async (outcome) => {
    if (!current) return;
    setSaving(true);
    setError('');
    try {
      const result = await crmApi.logFollowUp(current._id, { outcome, message });
      if (result.handoff === 'booking') {
        onDealWon?.(result.lead || current);
        onClose?.();
        return;
      }
      onLogged?.(result);
      if (queue?.length && index < queue.length - 1) setIndex(index + 1);
      else onClose?.();
    } catch (err) {
      setError(err.message || 'Could not save the follow-up');
    } finally {
      setSaving(false);
    }
  };

  if (!current) return null;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={queue?.length ? `Follow-up · ${index + 1} of ${queue.length}` : 'Follow-up'}
      subtitle={`${current.customerName || ''} · ${current.customerPhone || ''}`}
      size="lg"
    >
      <div className="crm-desk-form">
        <label className="full">Message template
          <select value={chosen?.id || ''} onChange={(e) => setTemplateId(e.target.value)}>
            {activeTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="full">Message
          <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <a className="crm-btn-primary crm-wa-btn full" href={link} target="_blank" rel="noreferrer">Open WhatsApp & send</a>
        {error ? <p className="crm-desk-error full">{error}</p> : null}
        <div className="crm-outcome-grid full">
          <button type="button" disabled={saving} onClick={() => log('no_reply')}>No reply yet</button>
          <button type="button" disabled={saving} onClick={() => log('replied')}>They replied</button>
          <button type="button" disabled={saving} onClick={() => log('not_interested')}>Not interested</button>
          <button type="button" disabled={saving} onClick={() => log('deal_won')}>Deal won</button>
        </div>
        <button type="button" className="crm-btn-secondary" onClick={() => {
          if (queue?.length && index < queue.length - 1) setIndex(index + 1);
          else onClose?.();
        }}>Skip this lead</button>
        {activities.length > 0 && (
          <ul className="crm-activity-list full">
            {activities.slice(0, 5).map((a) => (
              <li key={a._id}><strong>{a.title}</strong><span>{a.description}</span></li>
            ))}
          </ul>
        )}
      </div>
    </AppModal>
  );
}

export function CrmTaskModal({ open, projectId, leads, onClose, onSaved }) {
  const [form, setForm] = useState({ leadId: '', title: '', dueDate: '', priority: 'Medium', taskType: 'Phone Call', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const lead = leads.find((l) => String(l._id) === form.leadId);
    if (!lead) { setError('Choose a lead first.'); return; }
    setSaving(true);
    setError('');
    try {
      await crmApi.createTask({
        customerId: lead.customerId,
        unitInterestId: lead._id,
        projectId,
        title: form.title,
        dueDateTime: form.dueDate ? `${form.dueDate}T09:00:00` : undefined,
        priority: form.priority,
        taskType: form.taskType,
        notes: form.notes,
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not add the task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} title="New task">
      <form onSubmit={submit} className="crm-desk-form">
        <label className="full">Lead
          <select required value={form.leadId} onChange={set('leadId')}>
            <option value="">Choose a lead</option>
            {leads.map((l) => <option key={l._id} value={l._id}>{l.customerName} · {l.customerPhone}</option>)}
          </select>
        </label>
        <label className="full">Task<input required value={form.title} onChange={set('title')} placeholder="Send revised quotation" /></label>
        <label>Due date<input required type="date" value={form.dueDate} onChange={set('dueDate')} /></label>
        <label>Priority
          <select value={form.priority} onChange={set('priority')}>
            {['Low', 'Medium', 'High', 'Urgent'].map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="full">Type
          <select value={form.taskType} onChange={set('taskType')}>
            {['Phone Call', 'WhatsApp', 'Email', 'Document Collection', 'Site Visit Prep', 'Payment Follow-up'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="full">Notes<textarea rows={2} value={form.notes} onChange={set('notes')} /></label>
        {error ? <p className="crm-desk-error full">{error}</p> : null}
        <div className="crm-desk-form-actions full">
          <button type="button" className="crm-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="crm-btn-primary" disabled={saving || leads.length === 0}>{saving ? 'Saving…' : 'Add task'}</button>
        </div>
      </form>
    </AppModal>
  );
}

export function CrmAppointmentModal({ open, projectId, leads, initialWhen, onClose, onSaved }) {
  const [form, setForm] = useState({ leadId: '', kind: 'Site visit', when: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!open) return;
    setForm((f) => ({ ...f, when: initialWhen || '', leadId: leads?.length === 1 ? String(leads[0]._id) : f.leadId }));
  }, [open, initialWhen]);

  const submit = async (e) => {
    e.preventDefault();
    const lead = leads.find((l) => String(l._id) === form.leadId);
    if (!lead) { setError('Choose a lead first.'); return; }
    setSaving(true);
    setError('');
    try {
      const visitKinds = ['Meeting', 'Site visit', 'Demo'];
      if (visitKinds.includes(form.kind)) {
        await crmApi.scheduleVisit({
          customerId: lead.customerId,
          unitInterestId: lead._id,
          projectId,
          visitDateTime: form.when,
          notes: `${form.kind}${form.notes ? ` — ${form.notes}` : ''}`,
        });
      } else {
        await crmApi.createTask({
          customerId: lead.customerId,
          unitInterestId: lead._id,
          projectId,
          title: `${form.kind} · ${lead.customerName}`,
          dueDateTime: form.when,
          taskType: form.kind === 'Call' ? 'Phone Call' : 'WhatsApp',
          priority: 'Medium',
          notes: form.notes,
        });
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not save the appointment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} title="New appointment">
      <form onSubmit={submit} className="crm-desk-form">
        <label className="full">Type
          <select value={form.kind} onChange={set('kind')}>
            {['Meeting', 'Call', 'Site visit', 'Demo', 'Follow-up'].map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className="full">Lead
          <select required value={form.leadId} onChange={set('leadId')}>
            <option value="">Choose a lead</option>
            {leads.map((l) => <option key={l._id} value={l._id}>{l.customerName}</option>)}
          </select>
        </label>
        <label className="full">When<input required type="datetime-local" value={form.when} onChange={set('when')} /></label>
        <label className="full">Notes<textarea rows={2} value={form.notes} onChange={set('notes')} /></label>
        {error ? <p className="crm-desk-error full">{error}</p> : null}
        <div className="crm-desk-form-actions full">
          <button type="button" className="crm-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="crm-btn-primary" disabled={saving || leads.length === 0}>{saving ? 'Saving…' : 'Add appointment'}</button>
        </div>
      </form>
    </AppModal>
  );
}
