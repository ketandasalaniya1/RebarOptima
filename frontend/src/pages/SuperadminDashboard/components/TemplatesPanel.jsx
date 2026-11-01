import React, { useState, useEffect } from 'react';
import { FileText, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { developerApi } from '../../../utils/api';

export default function TemplatesPanel() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await developerApi.getNotificationTemplates();
      if (res.success && res.data) {
        setTemplates(res.data);
        if (res.data.length > 0 && !selectedTemplate) {
          setSelectedTemplate(res.data[0]);
        }
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load templates' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await developerApi.saveNotificationTemplate(selectedTemplate);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Template "${selectedTemplate.name}" updated successfully!` });
        loadTemplates();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw className="spin" size={24} style={{ marginBottom: '8px' }} />
        <p>Loading notification templates...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>
      {/* Templates List Sidebar */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#f0f6fc', fontSize: '14px' }}>Notification Templates</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              onClick={() => {
                setSelectedTemplate(tpl);
                setStatusMsg(null);
              }}
              style={{
                textAlign: 'left',
                background: selectedTemplate?.key === tpl.key ? '#21262d' : 'transparent',
                border: selectedTemplate?.key === tpl.key ? '1px solid #58a6ff' : '1px solid #30363d',
                borderRadius: '6px',
                padding: '10px 12px',
                cursor: 'pointer',
              }}
            >
              <div style={{ color: '#f0f6fc', fontWeight: 600, fontSize: '13px' }}>{tpl.name}</div>
              <div style={{ color: '#8b949e', fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>
                {tpl.key}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Template Editor */}
      {selectedTemplate ? (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#58a6ff" /> {selectedTemplate.name}
              </h3>
              <span style={{ fontSize: '12px', color: '#8b949e', fontFamily: 'monospace' }}>
                Key: {selectedTemplate.key}
              </span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedTemplate.enabled !== false}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, enabled: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#238636' }}
              />
              <span style={{ color: '#c9d1d9', fontSize: '13px' }}>Template Active</span>
            </label>
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
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Email Subject
              </label>
              <input
                type="text"
                value={selectedTemplate.subject || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
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
                HTML Body Content
              </label>
              <textarea
                rows={6}
                value={selectedTemplate.htmlContent || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, htmlContent: e.target.value })}
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Plain Text Fallback
              </label>
              <textarea
                rows={4}
                value={selectedTemplate.plainTextContent || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, plainTextContent: e.target.value })}
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f0f6fc',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              />
            </div>

            {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
              <div style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', border: '1px solid #30363d' }}>
                <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 600 }}>Available Tokens: </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {selectedTemplate.variables.map((v) => (
                    <span
                      key={v}
                      style={{
                        background: '#21262d',
                        color: '#58a6ff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save Template Changes'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ padding: '32px', textAlign: 'center', color: '#8b949e' }}>
          Select a template from the list to view and customize its layout.
        </div>
      )}
    </div>
  );
}
