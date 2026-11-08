import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { crmApi } from '../../utils/crmApi';
import RoleGate from '../../components/RoleGate';
import { formatWhen } from './crmFormat';
import { CrmTaskModal } from './crmDeskModals';

const COLUMNS = [
  { status: 'Pending', label: 'To Do', tone: 'todo' },
  { status: 'In Progress', label: 'In Progress', tone: 'doing' },
  { status: 'Completed', label: 'Done', tone: 'done' },
];

export default function CrmTasks({ projectId, refreshKey }) {
  const [tasks, setTasks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [view, setView] = useState('board');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = () => {
    if (!projectId) return;
    Promise.all([
      crmApi.getTasks({ projectId }),
      crmApi.getLeads({ projectId }),
    ]).then(([taskRows, leadRows]) => {
      setTasks(Array.isArray(taskRows) ? taskRows : []);
      setLeads(Array.isArray(leadRows) ? leadRows.filter((l) => l.stage !== 'Lost' && l.stage !== 'Booked') : []);
      setError('');
    }).catch((err) => setError(err.message || 'Could not load tasks'));
  };

  useEffect(() => { load(); }, [projectId, refreshKey]);

  const move = async (task, status) => {
    try {
      await crmApi.updateTaskStatus(task._id, status);
      load();
    } catch (err) {
      setError(err.message || 'Could not update the task');
    }
  };

  const shown = tasks.filter((t) => t.status !== 'Cancelled');

  return (
    <div className="cx">
      <div className="cx-head">
        <h2>Tasks ({shown.length})</h2>
        <div className="cx-head-actions">
          <div className="cx-seg">
            <button type="button" className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>List</button>
            <button type="button" className={view === 'board' ? 'is-on' : ''} onClick={() => setView('board')}>Board</button>
          </div>
          <RoleGate permission="crm.leads">
            <button type="button" className="cx-btn" onClick={() => setOpen(true)} disabled={!leads.length}><Plus size={16} /> New Task</button>
          </RoleGate>
        </div>
      </div>
      {error ? <p className="cx-error">{error}</p> : null}
      {!leads.length && <p className="cx-muted">Add a lead before creating a task. Tasks stay attached to that person.</p>}
      {view === 'list' ? (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Task</th><th>Customer</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t._id}>
                  <td>{t.title}</td>
                  <td>{t.customerName}</td>
                  <td>{formatWhen(t.dueDateTime)}{t.isOverdue ? ' · Overdue' : ''}</td>
                  <td><span className={`cx-pri ${String(t.priority || '').toLowerCase()}`}>{t.priority}</span></td>
                  <td>
                    <select value={COLUMNS.some((c) => c.status === t.status) ? t.status : 'Pending'} onChange={(e) => move(t, e.target.value)}>
                      {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={5}>No tasks on this project.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cx-board">
          {COLUMNS.map((col) => {
            const rows = shown.filter((t) => (t.status || 'Pending') === col.status);
            return (
              <section key={col.status} className={`cx-col ${col.tone}`}>
                <h3>{col.label} ({rows.length})</h3>
                {rows.map((t) => (
                  <article key={t._id} className="cx-task">
                    <strong>{t.title}</strong>
                    <small>{t.customerName}</small>
                    <div>
                      <span>{formatWhen(t.dueDateTime)}</span>
                      <span className={`cx-pri ${String(t.priority || '').toLowerCase()}`}>{t.priority || 'Medium'}</span>
                    </div>
                    <div className="cx-task-move">
                      {COLUMNS.filter((c) => c.status !== t.status).map((c) => (
                        <button key={c.status} type="button" onClick={() => move(t, c.status)}>{c.label}</button>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
      <CrmTaskModal open={open} projectId={projectId} leads={leads} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  );
}
