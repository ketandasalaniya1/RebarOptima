import React, { useState, useEffect } from 'react';
import { Cpu, Database, Bell, Mail, Activity, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { developerApi } from '../../../utils/api';

export default function SystemHealthPanel() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const res = await developerApi.getSystemHealth();
      if (res.success && res.data) {
        setHealth(res.data);
      }
    } catch (err) {
      console.warn('Failed to load system health:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 MB';
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw className="spin" size={24} style={{ marginBottom: '12px', color: 'var(--accent)' }} />
        <p style={{ margin: 0, fontSize: '13px' }}>Probing platform runtime health...</p>
      </div>
    );
  }

  if (!health) {
    return (
      <div style={{ 
        padding: '32px', 
        textAlign: 'center', 
        color: 'var(--danger-text)',
        background: 'var(--danger-subtle)',
        border: '1px solid var(--danger-border)',
        borderRadius: 'var(--radius-lg)'
      }}>
        Failed to fetch system diagnostics. Ensure developer credentials are valid.
      </div>
    );
  }

  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    padding: '20px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Core Status */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>Platform Status</span>
            <Activity size={16} color="var(--success-text)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--success-text)', fontSize: '20px', fontWeight: 700 }}>{health.status}</span>
            <CheckCircle2 size={16} color="var(--success-text)" />
          </div>
          <div style={{ color: 'var(--text-label)', fontSize: '12px', marginTop: '6px' }}>
            Uptime: {formatUptime(health.uptimeSeconds)}
          </div>
        </div>

        {/* Database */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>MongoDB Database</span>
            <Database size={16} color="var(--accent)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              color: health.database?.connected ? 'var(--success-text)' : 'var(--danger-text)', 
              fontSize: '20px', 
              fontWeight: 700 
            }}>
              {health.database?.connected ? 'Connected' : 'Disconnected'}
            </span>
            {health.database?.connected ? (
              <CheckCircle2 size={16} color="var(--success-text)" />
            ) : (
              <XCircle size={16} color="var(--danger-text)" />
            )}
          </div>
          <div style={{ color: 'var(--text-label)', fontSize: '12px', marginTop: '6px' }}>
            Atlas ping responsive
          </div>
        </div>

        {/* Web Push */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>Web Push Service</span>
            <Bell size={16} color="var(--accent)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              color: health.services?.webPush?.configured ? 'var(--success-text)' : 'var(--warning-text)', 
              fontSize: '20px', 
              fontWeight: 700 
            }}>
              {health.services?.webPush?.configured ? 'Active' : 'Unconfigured'}
            </span>
          </div>
          <div style={{ color: 'var(--text-label)', fontSize: '12px', marginTop: '6px' }}>
            {health.services?.webPush?.subscribersCount || 0} active subscriber devices
          </div>
        </div>

        {/* SMTP Gateway */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>SMTP Email Gateway</span>
            <Mail size={16} color="var(--accent)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              color: health.services?.smtp?.configured ? 'var(--success-text)' : 'var(--warning-text)', 
              fontSize: '20px', 
              fontWeight: 700 
            }}>
              {health.services?.smtp?.configured ? 'Configured' : 'Unconfigured'}
            </span>
          </div>
          <div style={{ color: 'var(--text-label)', fontSize: '12px', marginTop: '6px' }}>
            {health.services?.smtp?.totalEmailsSent || 0} emails dispatched
          </div>
        </div>
      </div>

      {/* Runtime details */}
      <div style={{ ...cardStyle, padding: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
          <Cpu size={18} color="var(--accent)" /> Process & Resource Diagnostics
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', fontSize: '13px' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500 }}>Node.js Engine</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace', marginTop: '4px' }}>
              {health.nodeVersion}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500 }}>Resident Memory (RSS)</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace', marginTop: '4px' }}>
              {formatBytes(health.memoryUsage?.rss)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500 }}>Heap Memory Allocated</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace', marginTop: '4px' }}>
              {formatBytes(health.memoryUsage?.heapUsed)} / {formatBytes(health.memoryUsage?.heapTotal)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500 }}>External Memory</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace', marginTop: '4px' }}>
              {formatBytes(health.memoryUsage?.external)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
