import React, { useState, useEffect } from 'react';
import {
  Bell,
  Key,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Laptop,
  Flame,
  Globe,
  FileCode,
  ShieldCheck,
  Trash2,
  PlusCircle,
  Info,
} from 'lucide-react';
import { developerApi } from '../../../utils/api';
import { subscribeToPushNotifications, getPushPermission } from '../../../utils/pushNotifications';

export default function WebPushPanel() {
  const [activeTab, setActiveTab] = useState('fcm'); // 'vapid' | 'fcm'

  // VAPID State
  const [vapidConfig, setVapidConfig] = useState({
    enabled: false,
    publicKey: '',
    privateKey: '',
    subject: 'mailto:support@rebaroptima.com',
  });

  // FCM State
  const [fcmConfig, setFcmConfig] = useState({
    enabled: false,
    projectId: '',
    clientEmail: '',
    privateKey: '',
  });
  const [serviceAccountJsonInput, setServiceAccountJsonInput] = useState('');
  const [fcmTargetToken, setFcmTargetToken] = useState('');
  const [fcmTokens, setFcmTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  // Manual token attach state
  const [manualUserId, setManualUserId] = useState('6ade3fe9f9a792482c01f8f9'); // Default to Ketan for quick testing
  const [manualToken, setManualToken] = useState('');
  const [manualPlatform, setManualPlatform] = useState('android');
  const [manualDeviceInfo, setManualDeviceInfo] = useState('Mobile Phone (Test Device)');
  const [registeringManual, setRegisteringManual] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [subscribingDevice, setSubscribingDevice] = useState(false);
  const [devicePermission, setDevicePermission] = useState(getPushPermission());

  const [testPayload, setTestPayload] = useState({
    title: '🔔 Rebar Optima Chat Notification',
    body: 'New live message dispatched from Rebar Optima!',
  });

  const [testResult, setTestResult] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    loadAllConfigs();
    loadFcmTokens();
    setDevicePermission(getPushPermission());
  }, []);

  const loadAllConfigs = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const [vapidRes, fcmRes] = await Promise.all([
        developerApi.getWebPushConfig().catch(() => null),
        developerApi.getFcmConfig().catch(() => null),
      ]);

      if (vapidRes?.success && vapidRes.data) {
        setVapidConfig(vapidRes.data);
      }
      if (fcmRes?.success && fcmRes.data) {
        setFcmConfig(fcmRes.data);
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load push configurations' });
    } finally {
      setLoading(false);
    }
  };

  const loadFcmTokens = async () => {
    setLoadingTokens(true);
    try {
      const res = await developerApi.getFcmTokens();
      if (res?.success && Array.isArray(res.data)) {
        setFcmTokens(res.data);
      }
    } catch (err) {
      console.warn('Could not load registered FCM tokens:', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // VAPID HANDLERS
  // ══════════════════════════════════════════════════════════════════════════════

  const handleGenerateVapidKeys = async () => {
    setGenerating(true);
    setStatusMsg(null);
    try {
      const res = await developerApi.generateVapidKeys();
      if (res.success && res.data) {
        setVapidConfig((prev) => ({
          ...prev,
          publicKey: res.data.publicKey,
          privateKey: res.data.privateKey,
        }));
        setStatusMsg({ type: 'success', text: 'New VAPID keypair generated! Remember to click "Save Configuration".' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to generate keys' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveVapid = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await developerApi.saveWebPushConfig(vapidConfig);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Web Push (VAPID) configuration saved successfully!' });
        loadAllConfigs();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestVapid = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await developerApi.testPushNotification(testPayload);
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, errors: [err.message] });
    } finally {
      setTesting(false);
    }
  };

  const handleSubscribeDevice = async () => {
    setSubscribingDevice(true);
    try {
      await subscribeToPushNotifications();
      setDevicePermission('granted');
      setStatusMsg({ type: 'success', text: 'This browser device is now registered to receive push notifications!' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Failed to subscribe device: ${err.message}` });
    } finally {
      setSubscribingDevice(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // FCM HANDLERS
  // ══════════════════════════════════════════════════════════════════════════════

  const handleParseServiceAccountJson = (raw) => {
    setServiceAccountJsonInput(raw);
    try {
      const parsed = JSON.parse(raw.trim());
      if (parsed.project_id || parsed.client_email) {
        setFcmConfig((prev) => ({
          ...prev,
          projectId: parsed.project_id || prev.projectId,
          clientEmail: parsed.client_email || prev.clientEmail,
          privateKey: parsed.private_key || prev.privateKey,
        }));
        setStatusMsg({
          type: 'success',
          text: `Extracted credentials for Project "${parsed.project_id}"! Click "Save FCM Configuration" below to apply.`,
        });
      }
    } catch {
      // Keep raw input as user types
    }
  };

  const handleSaveFcm = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const payload = {
        ...fcmConfig,
        serviceAccountJson: serviceAccountJsonInput,
      };
      const res = await developerApi.saveFcmConfig(payload);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Firebase Cloud Messaging (FCM) credentials saved and verified!' });
        setServiceAccountJsonInput('');
        loadAllConfigs();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save FCM configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestFcm = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await developerApi.testFcmNotification({
        deviceToken: fcmTargetToken,
        title: testPayload.title,
        body: testPayload.body,
      });
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleRegisterManualToken = async (e) => {
    e.preventDefault();
    if (!manualUserId || !manualToken) {
      setStatusMsg({ type: 'error', text: 'User ID and FCM Device Token are required.' });
      return;
    }
    setRegisteringManual(true);
    setStatusMsg(null);
    try {
      const res = await developerApi.registerFcmTokenForUser({
        userId: manualUserId.trim(),
        token: manualToken.trim(),
        platform: manualPlatform,
        deviceInfo: manualDeviceInfo.trim(),
      });
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Device token registered to user ${manualUserId}! They will now receive FCM messages when chat messages arrive.` });
        setManualToken('');
        loadFcmTokens();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to register token' });
    } finally {
      setRegisteringManual(false);
    }
  };

  const handleDeleteFcmToken = async (id) => {
    try {
      await developerApi.deleteFcmToken(id);
      loadFcmTokens();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete token' });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw className="spin" size={24} style={{ marginBottom: '8px' }} />
        <p>Loading push notification engines...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Engine Selector Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          background: '#0d1117',
          padding: '6px',
          borderRadius: '8px',
          border: '1px solid #30363d',
          alignSelf: 'flex-start',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('fcm');
            setStatusMsg(null);
            setTestResult(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            background: activeTab === 'fcm' ? '#21262d' : 'transparent',
            color: activeTab === 'fcm' ? '#f0883e' : '#8b949e',
            boxShadow: activeTab === 'fcm' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          <Flame size={16} /> Firebase Cloud Messaging (FCM)
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              background: fcmConfig.enabled ? '#0d321d' : '#21262d',
              color: fcmConfig.enabled ? '#3fb950' : '#8b949e',
              border: `1px solid ${fcmConfig.enabled ? '#238636' : '#30363d'}`,
            }}
          >
            {fcmConfig.enabled ? 'ACTIVE' : 'OFF'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('vapid');
            setStatusMsg(null);
            setTestResult(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            background: activeTab === 'vapid' ? '#21262d' : 'transparent',
            color: activeTab === 'vapid' ? '#58a6ff' : '#8b949e',
            boxShadow: activeTab === 'vapid' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          <Globe size={16} /> Web Push (Standard VAPID)
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              background: vapidConfig.enabled ? '#0d321d' : '#21262d',
              color: vapidConfig.enabled ? '#3fb950' : '#8b949e',
              border: `1px solid ${vapidConfig.enabled ? '#238636' : '#30363d'}`,
            }}
          >
            {vapidConfig.enabled ? 'ACTIVE' : 'OFF'}
          </span>
        </button>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: FIREBASE CLOUD MESSAGING (FCM)                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'fcm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Explanation Banner */}
          <div
            style={{
              background: '#0d1117',
              border: '1px solid #388bfd',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <Info size={20} color="#58a6ff" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', color: '#c9d1d9', lineHeight: 1.6 }}>
              <strong style={{ color: '#58a6ff' }}>How FCM Message Delivery Works:</strong>
              <p style={{ margin: '4px 0 0', color: '#8b949e' }}>
                Firebase Cloud Messaging (FCM) requires two parts to deliver notifications to a user:
              </p>
              <ol style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                <li>
                  <strong>Backend Service Account</strong> (below): Allows the server to authenticate with Google FCM.
                </li>
                <li>
                  <strong>Receiver's Device Token</strong> (in the table below): When the receiver opens the mobile app (or web app), their device generates a unique FCM token and sends it to <code>POST /api/notifications/fcm-token</code>.
                  Without a registered token, FCM has no destination device to deliver the message to.
                </li>
              </ol>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
            {/* FCM Config Form */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={20} color="#f0883e" /> 1. Firebase Service Account Credentials
                </h3>
                <p style={{ margin: '4px 0 0', color: '#8b949e', fontSize: '13px' }}>
                  Enables backend server to authenticate with Google FCM and send messages.
                </p>
              </div>

              {/* Quick Import Box */}
              <div
                style={{
                  background: '#0d1117',
                  border: '1px dashed #388bfd',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileCode size={16} color="#58a6ff" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f6fc' }}>
                    Quick Import: Paste Service Account JSON
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={serviceAccountJsonInput}
                  onChange={(e) => handleParseServiceAccountJson(e.target.value)}
                  placeholder='Paste downloaded Firebase service account JSON here...'
                  style={{
                    width: '100%',
                    background: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#58a6ff',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                  }}
                />
              </div>

              <form onSubmit={handleSaveFcm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fcmConfig.enabled}
                    onChange={(e) => setFcmConfig({ ...fcmConfig, enabled: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#238636' }}
                  />
                  <span style={{ color: '#f0f6fc', fontWeight: 500, fontSize: '14px' }}>
                    Enable Firebase Cloud Messaging (FCM) Globally
                  </span>
                </label>

                <div>
                  <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                    Firebase Project ID
                  </label>
                  <input
                    type="text"
                    value={fcmConfig.projectId || ''}
                    onChange={(e) => setFcmConfig({ ...fcmConfig, projectId: e.target.value })}
                    placeholder="e.g. rebar-optima"
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
                    Client Email
                  </label>
                  <input
                    type="email"
                    value={fcmConfig.clientEmail || ''}
                    onChange={(e) => setFcmConfig({ ...fcmConfig, clientEmail: e.target.value })}
                    placeholder="firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com"
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
                    Private Key
                  </label>
                  <textarea
                    rows={3}
                    value={fcmConfig.privateKey || ''}
                    onChange={(e) => setFcmConfig({ ...fcmConfig, privateKey: e.target.value })}
                    placeholder="-----BEGIN PRIVATE KEY-----\n..."
                    style={{
                      width: '100%',
                      background: '#0d1117',
                      border: '1px solid #30363d',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#ff7b72',
                      fontFamily: 'monospace',
                      fontSize: '11px',
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
                  {saving ? 'Saving...' : 'Save FCM Configuration'}
                </button>
              </form>
            </div>

            {/* FCM Test Dispatch Panel */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#3fb950" /> 2. Test Connection & Direct Push
              </h3>
              <p style={{ margin: '0 0 16px 0', color: '#8b949e', fontSize: '13px' }}>
                Verify Firebase authentication or send a test push directly to any device token.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '4px' }}>
                    Target Device Token <span style={{ color: '#8b949e' }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={fcmTargetToken}
                    onChange={(e) => setFcmTargetToken(e.target.value)}
                    placeholder="Paste FCM Device Token here to test sending to a real device"
                    style={{
                      width: '100%',
                      background: '#0d1117',
                      border: '1px solid #30363d',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#7ee787',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '4px' }}>Notification Title</label>
                  <input
                    type="text"
                    value={testPayload.title}
                    onChange={(e) => setTestPayload({ ...testPayload, title: e.target.value })}
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
                  <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '4px' }}>Notification Body</label>
                  <textarea
                    rows={2}
                    value={testPayload.body}
                    onChange={(e) => setTestPayload({ ...testPayload, body: e.target.value })}
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
                  onClick={handleTestFcm}
                  disabled={testing || !fcmConfig.enabled}
                  style={{
                    background: '#f0883e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Send size={14} /> {testing ? 'Testing FCM...' : fcmTargetToken ? 'Send Test Push to Device Token' : 'Verify Firebase Credentials'}
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
                    {testResult.success ? '✓ Verification Successful!' : '✗ Test Failed'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {testResult.message || (testResult.success ? 'Firebase Admin SDK connected.' : 'An error occurred.')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. REGISTERED FCM DEVICES SECTION */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Smartphone size={20} color="#a371f7" /> 3. Active FCM Device Registrations in Database
                </h3>
                <p style={{ margin: '4px 0 0', color: '#8b949e', fontSize: '13px' }}>
                  These are the devices that will receive FCM push notifications when a chat message or event is triggered.
                </p>
              </div>
              <button
                type="button"
                onClick={loadFcmTokens}
                disabled={loadingTokens}
                style={{
                  background: '#21262d',
                  border: '1px solid #30363d',
                  color: '#c9d1d9',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={13} className={loadingTokens ? 'spin' : ''} /> Refresh List
              </button>
            </div>

            {/* Tokens Table */}
            {fcmTokens.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  background: '#0d1117',
                  borderRadius: '6px',
                  border: '1px dashed #30363d',
                  color: '#8b949e',
                  fontSize: '13px',
                }}
              >
                <p style={{ margin: '0 0 8px 0', color: '#e3b341', fontWeight: 600 }}>
                  ⚠️ No FCM device tokens currently registered in the database!
                </p>
                <p style={{ margin: 0, fontSize: '12px' }}>
                  This is why receiver users cannot receive FCM notifications. A phone or browser must first register its token with the server.
                  You can register a test token below to verify chat delivery immediately.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#c9d1d9' }}>
                  <thead>
                    <tr style={{ background: '#0d1117', textAlign: 'left', borderBottom: '1px solid #30363d' }}>
                      <th style={{ padding: '10px 12px' }}>User</th>
                      <th style={{ padding: '10px 12px' }}>Platform</th>
                      <th style={{ padding: '10px 12px' }}>Device Info</th>
                      <th style={{ padding: '10px 12px' }}>Token</th>
                      <th style={{ padding: '10px 12px' }}>Registered At</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fcmTokens.map((t) => (
                      <tr key={t._id} style={{ borderBottom: '1px solid #21262d' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#f0f6fc' }}>{t.userName}</div>
                          <div style={{ fontSize: '11px', color: '#8b949e' }}>{t.userEmail} ({t.userId})</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: t.platform === 'android' ? '#0d321d' : t.platform === 'ios' ? '#1f293d' : '#282210',
                              color: t.platform === 'android' ? '#3fb950' : t.platform === 'ios' ? '#58a6ff' : '#d29922',
                            }}
                          >
                            {t.platform?.toUpperCase() || 'WEB'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#8b949e' }}>{t.deviceInfo || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#7ee787' }}>{t.tokenSnippet}</td>
                        <td style={{ padding: '10px 12px', color: '#8b949e' }}>
                          {t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteFcmToken(t._id)}
                            title="Delete this device token"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#f85149',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Manual Token Registration Box */}
            <div
              style={{
                marginTop: '16px',
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '16px',
              }}
            >
              <h4 style={{ margin: '0 0 12px 0', color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <PlusCircle size={16} color="#3fb950" /> Attach / Register a Device Token to a User (for Instant Testing)
              </h4>
              <form onSubmit={handleRegisterManualToken} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', color: '#8b949e', fontSize: '11px', marginBottom: '4px' }}>User ID</label>
                  <input
                    type="text"
                    value={manualUserId}
                    onChange={(e) => setManualUserId(e.target.value)}
                    placeholder="Receiver User ID"
                    required
                    style={{
                      width: '100%',
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      padding: '7px 10px',
                      color: '#f0f6fc',
                      fontSize: '12px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#8b949e', fontSize: '11px', marginBottom: '4px' }}>FCM Device Token</label>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Paste FCM Device Token from mobile device or web"
                    required
                    style={{
                      width: '100%',
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      padding: '7px 10px',
                      color: '#7ee787',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#8b949e', fontSize: '11px', marginBottom: '4px' }}>Platform</label>
                  <select
                    value={manualPlatform}
                    onChange={(e) => setManualPlatform(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      padding: '7px 10px',
                      color: '#f0f6fc',
                      fontSize: '12px',
                    }}
                  >
                    <option value="android">Android</option>
                    <option value="ios">iOS</option>
                    <option value="web">Web</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#8b949e', fontSize: '11px', marginBottom: '4px' }}>Device Label</label>
                  <input
                    type="text"
                    value={manualDeviceInfo}
                    onChange={(e) => setManualDeviceInfo(e.target.value)}
                    placeholder="e.g. Ketan's Phone"
                    style={{
                      width: '100%',
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      padding: '7px 10px',
                      color: '#f0f6fc',
                      fontSize: '12px',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={registeringManual}
                  style={{
                    background: '#238636',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '7px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {registeringManual ? 'Saving...' : 'Register Device'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: WEB PUSH (VAPID)                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'vapid' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
          {/* Config Form */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={20} color="#58a6ff" /> Web Push & VAPID Configuration
                </h3>
                <p style={{ margin: '4px 0 0', color: '#8b949e', fontSize: '13px' }}>
                  Standard browser Web Push (RFC 8291/8292) without vendor lock-in.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateVapidKeys}
                disabled={generating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#21262d',
                  border: '1px solid #30363d',
                  color: '#58a6ff',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                <Key size={14} /> {generating ? 'Generating...' : 'Generate New VAPID Keys'}
              </button>
            </div>

            <form onSubmit={handleSaveVapid} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={vapidConfig.enabled}
                  onChange={(e) => setVapidConfig({ ...vapidConfig, enabled: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#238636' }}
                />
                <span style={{ color: '#f0f6fc', fontWeight: 500, fontSize: '14px' }}>
                  Enable Web Push Engine Globally
                </span>
              </label>

              <div>
                <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  VAPID Subject (mailto: or URL)
                </label>
                <input
                  type="text"
                  value={vapidConfig.subject || ''}
                  onChange={(e) => setVapidConfig({ ...vapidConfig, subject: e.target.value })}
                  placeholder="mailto:support@rebaroptima.com"
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
                  VAPID Public Key (Safe for client browsers)
                </label>
                <textarea
                  rows={3}
                  value={vapidConfig.publicKey || ''}
                  onChange={(e) => setVapidConfig({ ...vapidConfig, publicKey: e.target.value })}
                  placeholder="BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv..."
                  required
                  style={{
                    width: '100%',
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#7ee787',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  VAPID Private Key (Encrypted Secret)
                </label>
                <input
                  type="text"
                  value={vapidConfig.privateKey || ''}
                  onChange={(e) => setVapidConfig({ ...vapidConfig, privateKey: e.target.value })}
                  placeholder="Leave blank or unchanged to preserve existing secret"
                  style={{
                    width: '100%',
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#ff7b72',
                    fontFamily: 'monospace',
                    fontSize: '12px',
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
                {saving ? 'Saving...' : 'Save VAPID Configuration'}
              </button>
            </form>
          </div>

          {/* Test Push Dispatcher */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={18} color="#a371f7" /> Test Push Dispatcher
            </h3>
            <p style={{ margin: '0 0 16px 0', color: '#8b949e', fontSize: '13px' }}>
              Broadcast a live test push notification to all actively registered browsers.
            </p>

            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Laptop size={14} color="#58a6ff" /> Browser Permission: <strong style={{ color: devicePermission === 'granted' ? '#3fb950' : '#d29922' }}>{devicePermission}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleSubscribeDevice}
                disabled={subscribingDevice || !vapidConfig.enabled}
                style={{
                  width: '100%',
                  background: '#21262d',
                  color: '#58a6ff',
                  border: '1px solid #388bfd',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Bell size={13} /> {subscribingDevice ? 'Registering Device...' : '1. Register This Browser Device'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '4px' }}>Notification Title</label>
                <input
                  type="text"
                  value={testPayload.title}
                  onChange={(e) => setTestPayload({ ...testPayload, title: e.target.value })}
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
                <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '4px' }}>Message Body</label>
                <textarea
                  rows={2}
                  value={testPayload.body}
                  onChange={(e) => setTestPayload({ ...testPayload, body: e.target.value })}
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
                onClick={handleTestVapid}
                disabled={testing || !vapidConfig.enabled}
                style={{
                  background: '#8957e5',
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
                <Send size={14} /> {testing ? 'Sending Push...' : '2. Send Test Notification'}
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
                  {testResult.success ? `✓ Dispatched to ${testResult.sentCount} subscriber(s)!` : '✗ Dispatch failed'}
                </div>
                {testResult.errors && testResult.errors.length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                    {testResult.errors.map((err, i) => (
                      <li key={i}>{typeof err === 'object' ? err.error || JSON.stringify(err) : String(err)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
