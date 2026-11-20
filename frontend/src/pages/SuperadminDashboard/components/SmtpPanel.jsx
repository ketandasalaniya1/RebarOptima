import React, { useState, useEffect } from 'react';
import { Mail, ShieldCheck, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { developerApi } from '../../../utils/api';
import { Input } from '../../../components/ui';

export default function SmtpPanel() {
  const [config, setConfig] = useState({
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromName: 'Rebar Optima Notifications',
    fromEmail: 'noreply@cravetobuild.com',
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

  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    padding: '24px',
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--main-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    color: 'var(--text-primary)',
    fontSize: '13px',
  };

  const labelStyle = {
    display: 'block',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '6px',
  };

  if (loading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw className="spin" size={24} style={{ marginBottom: '12px', color: 'var(--accent)' }} />
        <p style={{ margin: 0, fontSize: '13px' }}>Loading SMTP configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
      {/* Settings Form */}
      <div style={cardStyle}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <Mail size={20} color="var(--accent)" /> Global SMTP Email Gateway
          </h3>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
            Configure transactional email delivery for user invitations, password resets, and automated project reports.
          </p>
        </div>

        {statusMsg && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: statusMsg.type === 'success' ? 'var(--success-subtle)' : 'var(--danger-subtle)',
              color: statusMsg.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
              border: `1px solid ${statusMsg.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            }}
          >
            {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <Input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
            />
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '14px' }}>
              Enable SMTP Outgoing Email Globally
            </span>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>
                SMTP Host
              </label>
              <Input
                type="text"
                value={config.host || ''}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                placeholder="smtp.sendgrid.net or smtp.gmail.com"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Port
              </label>
              <Input
                type="number"
                value={config.port ?? 587}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setConfig({ ...config, port: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                onBlur={() => {
                  if (!config.port) setConfig((prev) => ({ ...prev, port: 587 }));
                }}
                required
                style={inputStyle}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <Input
              type="checkbox"
              checked={config.secure}
              onChange={(e) => setConfig({ ...config, secure: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              SSL / TLS Encryption (Port 465). Uncheck for Port 587 / STARTTLS.
            </span>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>
                Username / API Key
              </label>
              <Input
                type="text"
                value={config.username || ''}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="apikey or user@example.com"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Password / API Secret
              </label>
              <Input
                type="password"
                value={config.password || ''}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>
                From Sender Name
              </label>
              <Input
                type="text"
                value={config.fromName || ''}
                onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                placeholder="Rebar Optima Notifications"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                From Email Address
              </label>
              <Input
                type="email"
                value={config.fromEmail || ''}
                onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                placeholder="noreply@cravetobuild.com"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Reply-To Address (Optional)
            </label>
            <Input
              type="email"
              value={config.replyTo || ''}
              onChange={(e) => setConfig({ ...config, replyTo: e.target.value })}
              placeholder="support@cravetobuild.com"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              alignSelf: 'flex-start',
              background: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
              marginTop: '4px',
            }}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>
      </div>

      {/* Diagnostics & Test Email Dispatcher */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
          <ShieldCheck size={18} color="var(--success-text)" /> Live SMTP Connection Tester
        </h3>
        <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
          Perform a socket handshake test with your SMTP host and optionally send a live test message.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px', fontWeight: 600 }}>
              Test Recipient Email (Optional)
            </label>
            <Input
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="developer@yourcompany.com"
              style={inputStyle}
            />
          </div>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !config.host}
            style={{
              background: 'var(--accent-subtle)',
              color: 'var(--accent-text)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius-md)',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: testing || !config.host ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: testing || !config.host ? 0.6 : 1,
            }}
          >
            <Send size={14} /> {testing ? 'Testing Handshake...' : 'Run SMTP Verification Test'}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              background: testResult.success ? 'var(--success-subtle)' : 'var(--danger-subtle)',
              color: testResult.success ? 'var(--success-text)' : 'var(--danger-text)',
              border: `1px solid ${testResult.success ? 'var(--success-border)' : 'var(--danger-border)'}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {testResult.success ? '✓ Verification Succeeded!' : '✗ Verification Failed'}
            </div>
            <p style={{ margin: 0, wordBreak: 'break-word', fontSize: '12px' }}>{testResult.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
