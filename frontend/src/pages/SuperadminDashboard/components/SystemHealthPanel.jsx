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
      <div style={{ padding: '32px', textAlign: 'center', color: '#8b949e' }}>
        <RefreshCw className="spin" size={20} style={{ marginBottom: '8px' }} />
        <p>Probing platform runtime health...</p>
      </div>
    );
  }

  if (!health) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#f85149' }}>
        Failed to fetch system diagnostics. Ensure developer credentials are valid.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Core Status */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#8b949e', fontSize: '13px' }}>Platform Status</span>
            <Activity size={16} color="#3fb950" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#3fb950', fontSize: '18px', fontWeight: 700 }}>{health.status}</span>
            <CheckCircle2 size={16} color="#3fb950" />
          </div>
          <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '6px' }}>
            Uptime: {formatUptime(health.uptimeSeconds)}
          </div>
        </div>

        {/* Database */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#8b949e', fontSize: '13px' }}>MongoDB Database</span>
            <Database size={16} color="#58a6ff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: health.database?.connected ? '#3fb950' : '#f85149', fontSize: '18px', fontWeight: 700 }}>
              {health.database?.connected ? 'Connected' : 'Disconnected'}
            </span>
            {health.database?.connected ? <CheckCircle2 size={16} color="#3fb950" /> : <XCircle size={16} color="#f85149" />}
          </div>
          <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '6px' }}>
            Atlas ping responsive
          </div>
        </div>

        {/* Web Push */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#8b949e', fontSize: '13px' }}>Web Push Service</span>
            <Bell size={16} color="#a371f7" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: health.services?.webPush?.configured ? '#3fb950' : '#d29922', fontSize: '18px', fontWeight: 700 }}>
              {health.services?.webPush?.configured ? 'Active' : 'Unconfigured'}
            </span>
          </div>
          <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '6px' }}>
            {health.services?.webPush?.subscribersCount || 0} active subscriber devices
          </div>
        </div>

        {/* SMTP Gateway */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#8b949e', fontSize: '13px' }}>SMTP Email Gateway</span>
            <Mail size={16} color="#f0883e" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: health.services?.smtp?.configured ? '#3fb950' : '#d29922', fontSize: '18px', fontWeight: 700 }}>
              {health.services?.smtp?.configured ? 'Configured' : 'Unconfigured'}
            </span>
          </div>
          <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '6px' }}>
            {health.services?.smtp?.totalEmailsSent || 0} emails dispatched
          </div>
        </div>
      </div>

      {/* Runtime details */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={16} color="#58a6ff" /> Process & Resource Diagnostics
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', fontSize: '13px' }}>
          <div>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>Node.js Engine</div>
            <div style={{ color: '#f0f6fc', fontWeight: 600, fontFamily: 'monospace', marginTop: '2px' }}>
              {health.nodeVersion}
            </div>
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>Resident Memory (RSS)</div>
            <div style={{ color: '#f0f6fc', fontWeight: 600, fontFamily: 'monospace', marginTop: '2px' }}>
              {formatBytes(health.memoryUsage?.rss)}
            </div>
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>Heap Memory Allocated</div>
            <div style={{ color: '#f0f6fc', fontWeight: 600, fontFamily: 'monospace', marginTop: '2px' }}>
              {formatBytes(health.memoryUsage?.heapUsed)} / {formatBytes(health.memoryUsage?.heapTotal)}
            </div>
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>External Memory</div>
            <div style={{ color: '#f0f6fc', fontWeight: 600, fontFamily: 'monospace', marginTop: '2px' }}>
              {formatBytes(health.memoryUsage?.external)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
