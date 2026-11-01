import React, { useState, useEffect } from 'react';
import { Mail, ShieldCheck, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { developerApi } from '../../../utils/api';

export default function SmtpPanel() {
  const [config, setConfig] = useState({
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromName: 'Rebar Optima Notifications',
    fromEmail: 'noreply@rebaroptima.com',
    replyTo: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await developerApi.getSmtpConfig();
      if (res.success && res.data) {
        setConfig(res.data);
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load SMTP settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await developerApi.saveSmtpConfig(config);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'SMTP configuration saved successfully!' });
        loadConfig();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await developerApi.testSmtpConnection({ testRecipient });
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw className="spin" size={24} style={{ marginBottom: '8px' }} />
        <p>Loading SMTP configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
      {/* Settings Form */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={20} color="#58a6ff" /> Global SMTP Email Gateway
          </h3>
          <p style={{ margin: '4px 0 0', color: '#8b949e', fontSize: '13px' }}>
            Configure transactional email delivery for user invitations, password resets, and automated project reports.
          </p>
        </div>

        {statusMsg && (
          <div
            style={{
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: statusMsg.type === 'success' ? '#0d321d' : '#3d1618',
              color: statusMsg.type === 'success' ? '#3fb950' : '#f85149',
              border: `1px solid ${statusMsg.type === 'success' ? '#238636' : '#da3633'}`,
            }}
          >
            {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: '#238636' }}
            />
            <span style={{ color: '#f0f6fc', fontWeight: 500, fontSize: '14px' }}>
              Enable SMTP Outgoing Email Globally
            </span>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                SMTP Host
              </label>
              <input
                type="text"
                value={config.host || ''}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                placeholder="smtp.sendgrid.net or smtp.gmail.com"
                required
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Port
              </label>
              <input
                type="number"
                value={config.port || 587}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value, 10) || 587 })}
                required
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.secure}
              onChange={(e) => setConfig({ ...config, secure: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: '#238636' }}
            />
            <span style={{ color: '#c9d1d9', fontSize: '13px' }}>
              SSL / TLS Encryption (Port 465). Uncheck for Port 587 / STARTTLS.
            </span>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Username / API Key
              </label>
              <input
                type="text"
                value={config.username || ''}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="apikey or user@example.com"
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Password / API Secret
              </label>
              <input
                type="password"
                value={config.password || ''}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                From Sender Name
              </label>
              <input
                type="text"
                value={config.fromName || ''}
                onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                placeholder="Rebar Optima Notifications"
                required
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                From Email Address
              </label>
              <input
                type="email"
                value={config.fromEmail || ''}
                onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                placeholder="noreply@rebaroptima.com"
                required
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Reply-To Address (Optional)
            </label>
            <input
              type="email"
              value={config.replyTo || ''}
              onChange={(e) => setConfig({ ...config, replyTo: e.target.value })}
              placeholder="support@rebaroptima.com"
              style={{
                width: '100%',
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#f0f6fc',
                fontSize: '13px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              alignSelf: 'flex-start',
              background: '#238636',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>
      </div>

      {/* Diagnostics & Test Email Dispatcher */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} color="#3fb950" /> Live SMTP Connection Tester
        </h3>
        <p style={{ margin: '0 0 16px 0', color: '#8b949e', fontSize: '13px' }}>
          Perform a socket handshake test with your SMTP host and optionally send a live test message.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '4px' }}>
              Test Recipient Email (Optional)
            </label>
            <input
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="developer@yourcompany.com"
              style={{
                width: '100%',
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#f0f6fc',
                fontSize: '13px',
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !config.host}
            style={{
              background: '#1f6feb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Send size={14} /> {testing ? 'Testing Handshake...' : 'Run SMTP Verification Test'}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              background: testResult.success ? '#0d321d' : '#3d1618',
              color: testResult.success ? '#3fb950' : '#f85149',
              border: `1px solid ${testResult.success ? '#238636' : '#da3633'}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {testResult.success ? '✓ Verification Succeeded!' : '✗ Verification Failed'}
            </div>
            <p style={{ margin: 0, wordBreak: 'break-word' }}>{testResult.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
