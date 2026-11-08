import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Phone, Plus } from 'lucide-react';
import { crmApi } from '../../utils/crmApi';
import RoleGate from '../../components/RoleGate';
import { formatWhen, stageTone, whatsAppUrl } from './crmFormat';
import { CrmFollowUpModal } from './crmDeskModals';

const PAGE = 10;
const STAGES = ['all', 'New', 'Contacted', 'Qualified', 'Visit Scheduled', 'Visited', 'Negotiation', 'Booked', 'Lost', 'On Hold'];

export default function CrmLeads({ projectId, projectName, refreshKey, onAddLead, onDealWon, onOpenLead }) {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [source, setSource] = useState('all');
  const [interest, setInterest] = useState('all');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [follow, setFollow] = useState(null);
  const [templates, setTemplates] = useState([]);

  const load = () => {
    if (!projectId) return;
    crmApi.getLeads({ projectId })
      .then((rows) => { setLeads(Array.isArray(rows) ? rows : []); setError(''); })
      .catch((err) => setError(err.message || 'Could not load leads'));
  };

  useEffect(() => { load(); }, [projectId, refreshKey]);
  useEffect(() => {
    crmApi.getSettings().then((s) => setTemplates(s.messageTemplates || [])).catch(() => {});
  }, []);

  const sources = useMemo(() => ['all', ...new Set(leads.map((l) => l.leadSource).filter(Boolean))], [leads]);
  const interests = useMemo(() => ['all', ...new Set(leads.map((l) => l.requirement).filter(Boolean))], [leads]);
  const filtered = leads.filter((l) => {
    if (stage !== 'all' && l.stage !== stage) return false;
    if (source !== 'all' && l.leadSource !== source) return false;
    if (interest !== 'all' && l.requirement !== interest) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${l.customerName} ${l.customerPhone}`.toLowerCase().includes(q);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  useEffect(() => { setPage(1); }, [search, stage, source, interest, projectId]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const csv = await file.text();
    try {
      const result = await crmApi.importLeads({ csv, projectId });
      const fail = result.failed?.length ? ` ${result.failed.length} rows failed.` : '';
      setNotice(`Imported ${result.created} new, ${result.reused} already open.${fail}`);
      load();
    } catch (err) {
      setError(err.message || 'Import failed');
    }
  };

  return (
    <div className="cx">
      <div className="cx-head">
        <h2>Leads ({filtered.length})</h2>
        <div className="cx-head-actions">
          <RoleGate permission="crm.leads">
            <label className="cx-btn cx-btn-ghost">Import CSV<input type="file" accept=".csv,text/csv" hidden onChange={onFile} /></label>
            <button type="button" className="cx-btn" onClick={onAddLead}><Plus size={16} /> New Lead</button>
          </RoleGate>
        </div>
      </div>
      <div className="cx-filters">
        <input value={search} placeholder="Search by name, phone…" onChange={(e) => setSearch(e.target.value)} />
        <select value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Stages' : s}</option>)}</select>
        <select value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Sources' : s}</option>)}</select>
        <select value={interest} onChange={(e) => setInterest(e.target.value)}>{interests.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Interests' : s}</option>)}</select>
      </div>
      {notice ? <p className="cx-note">{notice}</p> : null}
      {error ? <p className="cx-error">{error}</p> : null}
      <div className="cx-table-wrap">
        <table className="cx-table">
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Stage</th><th>Interest</th><th>Source</th><th>Next Follow-up</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((lead) => (
              <tr key={lead._id} onClick={() => onOpenLead?.(lead)}>
                <td><strong>{lead.customerName}</strong></td>
                <td>{lead.customerPhone}</td>
                <td><span className={`cx-badge ${stageTone(lead.stage)}`}>{lead.stage}</span></td>
                <td>{lead.requirement || lead.unitCode || '—'}</td>
                <td>{lead.leadSource || '—'}</td>
                <td>{lead.nextFollowUpDate ? formatWhen(lead.nextFollowUpDate) : '—'}</td>
                <td className="cx-actions" onClick={(e) => e.stopPropagation()}>
                  <a href={lead.whatsAppUrl || whatsAppUrl(lead.customerPhone, '')} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={16} /></a>
                  <a href={`tel:${lead.customerPhone || ''}`} aria-label="Call"><Phone size={16} /></a>
                  {lead.stage !== 'Lost' && lead.stage !== 'Booked' && (
                    <button type="button" onClick={() => setFollow(lead)}>Log</button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7}>No leads on this project yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="cx-pager">
        <span>Showing {filtered.length ? (page - 1) * PAGE + 1 : 0}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}</span>
        <div>
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 8).map((n) => (
            <button key={n} type="button" className={n === page ? 'is-on' : ''} onClick={() => setPage(n)}>{n}</button>
          ))}
        </div>
      </div>
      <CrmFollowUpModal
        open={!!follow}
        lead={follow}
        queue={filtered.filter((l) => l.stage !== 'Lost' && l.stage !== 'Booked')}
        projectName={projectName}
        templates={templates}
        onClose={() => setFollow(null)}
        onLogged={load}
        onDealWon={(lead) => { setFollow(null); onDealWon?.(lead); }}
      />
    </div>
  );
}
