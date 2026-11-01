import React, { useState, useEffect } from 'react';
import { Mail, Bell, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { developerApi } from '../../../utils/api';

export default function DeliveryLogsPanel() {
  const [logType, setLogType] = useState('email'); // 'email' | 'push'
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [logType]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await developerApi.getConsoleLogs(logType, 1, 50);
      if (res.success && res.data) {
        setLogs(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      console.warn('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, color: '#f0f6fc' }}>Notification Delivery Logs</h3>
          <p style={{ margin: '4px 0 0', color: '#8b949e', fontSize: '13px' }}>
            Real-time audit log of all transactional emails and browser push notifications dispatched across the platform.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setLogType('email')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: logType === 'email' ? '#21262d' : 'transparent',
              border: logType === 'email' ? '1px solid #58a6ff' : '1px solid #30363d',
              color: logType === 'email' ? '#58a6ff' : '#8b949e',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <Mail size={14} /> Outgoing Emails
          </button>
          <button
            type="button"
            onClick={() => setLogType('push')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: logType === 'push' ? '#21262d' : 'transparent',
              border: logType === 'push' ? '1px solid #58a6ff' : '1px solid #30363d',
              color: logType === 'push' ? '#58a6ff' : '#8b949e',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <Bell size={14} /> Push Notifications
          </button>
          <button
            type="button"
            onClick={loadLogs}
            title="Refresh logs"
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              color: '#c9d1d9',
              padding: '6px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#8b949e' }}>
          <RefreshCw className="spin" size={20} style={{ marginBottom: '8px' }} />
          <p>Loading {logType} dispatch logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#8b949e', fontSize: '13px' }}>
          No {logType} delivery logs recorded yet. Dispatches will appear here automatically.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d', color: '#8b949e', fontSize: '12px' }}>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Recipient</th>
                <th style={{ padding: '10px 12px' }}>Subject / Title</th>
                <th style={{ padding: '10px 12px' }}>Timestamp</th>
                <th style={{ padding: '10px 12px' }}>Diagnostics</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} style={{ borderBottom: '1px solid #21262d', color: '#c9d1d9' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: log.status === 'SUCCESS' ? '#0d321d' : '#3d1618',
                        color: log.status === 'SUCCESS' ? '#3fb950' : '#f85149',
                      }}
                    >
                      {log.status === 'SUCCESS' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {log.recipientEmail || log.recipientUserId || 'Subscriber'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#f0f6fc', fontWeight: 500 }}>
                    {log.subject || log.title || 'Notification'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#8b949e', fontSize: '12px' }}>
                    {log.sentAt ? new Date(log.sentAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: log.errorMessage ? '#f85149' : '#8b949e', fontSize: '11px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.errorMessage || log.metadata?.messageId || 'Delivered'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
