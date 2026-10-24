import React from 'react';
import {
  History,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Send,
  ShieldCheck,
  User
} from 'lucide-react';

export default function ActivityLogView({ activities }) {
  const list = activities || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          Audit Trail &amp; Activity Log
        </h2>
        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Append-only cryptographically verifiable activity log. Modifications and deletions of historical records are strictly prevented.
        </p>
      </div>

      <div className="drawings-table-container">
        <table className="drawings-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Drawing / Entity</th>
              <th>Description</th>
              <th>Performed By</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  No activity records logged yet.
                </td>
              </tr>
            ) : (
              list.map((act, idx) => (
                <tr key={act._id || idx}>
                  <td style={{ fontSize: '0.74rem', color: 'var(--text-label)', whiteSpace: 'nowrap' }}>
                    {new Date(act.createdAt).toLocaleString([], {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </td>
                  <td>
                    <span className="drawings-badge-tag" style={{ fontSize: '0.68rem' }}>
                      {act.action}
                    </span>
                  </td>
                  <td>
                    {act.drawingNumber ? (
                      <span className="dw-rev-badge">
                        {act.drawingNumber} {act.revisionNumber ? `(${act.revisionNumber})` : ''}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{act.entityType}</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <div><strong>{act.title}</strong></div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{act.description}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.68rem',
                          color: '#38bdf8',
                          fontWeight: 700
                        }}
                      >
                        {act.performedByName?.charAt(0) || 'U'}
                      </div>
                      <span>{act.performedByName}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
