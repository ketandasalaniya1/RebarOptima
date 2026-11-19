import React, { useState, useEffect } from 'react';
import { FileText, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { developerApi } from '../../../utils/api';
import { Input, Textarea } from '../../../components/ui';

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
        <p style={{ margin: 0, fontSize: '13px' }}>Loading notification templates...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>
      {/* Templates List Sidebar */}
      <div style={{ ...cardStyle, padding: '16px' }}>
        <h4 style={{ margin: '0 0 14px 0', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>
          Notification Templates
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map((tpl) => {
            const isSelected = selectedTemplate?.key === tpl.key;
            return (
              <button
                key={tpl.key}
                type="button"
                onClick={() => {
                  setSelectedTemplate(tpl);
                  setStatusMsg(null);
                }}
                style={{
                  textAlign: 'left',
                  background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                  border: isSelected ? '1px solid var(--accent-border)' : '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
                  {tpl.name}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>
                  {tpl.key}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Template Editor */}
      {selectedTemplate ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <FileText size={18} color="var(--accent)" /> {selectedTemplate.name}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', display: 'inline-block', marginTop: '4px' }}>
                Key: {selectedTemplate.key}
              </span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <Input
                type="checkbox"
                checked={selectedTemplate.enabled !== false}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, enabled: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
              />
              <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>Template Active</span>
            </label>
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
            <div>
              <label style={labelStyle}>
                Email Subject
              </label>
              <Input
                type="text"
                value={selectedTemplate.subject || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                HTML Body Content
              </label>
              <Textarea
                rows={6}
                value={selectedTemplate.htmlContent || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, htmlContent: e.target.value })}
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Plain Text Fallback
              </label>
              <Textarea
                rows={4}
                value={selectedTemplate.plainTextContent || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, plainTextContent: e.target.value })}
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              />
            </div>

            {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
              <div style={{ background: 'var(--main-bg)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Available Tokens: </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {selectedTemplate.variables.map((v) => (
                    <span
                      key={v}
                      style={{
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent-text)',
                        border: '1px solid var(--accent-border)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
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
                background: 'var(--accent)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: saving ? 0.7 : 1,
                marginTop: '4px',
              }}
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save Template Changes'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Select a template from the list to view and customize its layout.
        </div>
      )}
    </div>
  );
}
