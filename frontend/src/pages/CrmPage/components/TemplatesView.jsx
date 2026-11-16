import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Edit2, Trash2, Check, Copy, MessageSquare,
  Sparkles, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { Input, Select, Textarea } from '../../../components/ui';

export default function TemplatesView() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingTemplate, setEditingTemplate] = useState(null); // null or template object
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Form states for Create/Edit
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('follow_up_1');
  const [formBody, setFormBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availableVariables = [
    { tag: '{name}', label: 'Buyer Name' },
    { tag: '{project}', label: 'Project Name' },
    { tag: '{unit_type}', label: 'Unit Type' },
    { tag: '{unit_code}', label: 'Unit Code' },
    { tag: '{price}', label: 'Price / Net Value' },
    { tag: '{carpet_area}', label: 'Carpet Area' },
    { tag: '{base_price}', label: 'Base Price' },
    { tag: '{tax_amount}', label: 'GST Amount' },
    { tag: '{booking_ref}', label: 'Booking Ref' },
    { tag: '{milestone_name}', label: 'Milestone Name' },
    { tag: '{due_date}', label: 'Due Date' },
    { tag: '{visit_date}', label: 'Visit Date & Time' },
    { tag: '{location}', label: 'Site Location' },
    { tag: '{agent_name}', label: 'Sales Agent' }
  ];

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getTemplates();
      setTemplates(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleOpenCreate = () => {
    setFormName('');
    setFormCategory('follow_up_1');
    setFormBody('Hello {name}! Thank you for your inquiry about {project}. We have exciting {unit_type} options starting at {price}. When is a good time for a quick 2-minute chat?');
    setEditingTemplate(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (t) => {
    setEditingTemplate(t);
    setFormName(t.name || '');
    setFormCategory(t.category || 'general');
    setFormBody(t.body || '');
    setShowCreateModal(true);
  };

  const handleInsertVariable = (tag) => {
    setFormBody(prev => `${prev} ${tag}`);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formBody.trim()) return;
    setSubmitting(true);
    try {
      const extractedVariables = availableVariables
        .map(v => v.tag.replace(/[{}]/g, ''))
        .filter(vName => formBody.includes(`{${vName}}`));

      const payload = {
        name: formName.trim(),
        category: formCategory,
        body: formBody.trim(),
        variables: extractedVariables
      };

      if (editingTemplate && editingTemplate._id) {
        await crmApi.updateTemplate(editingTemplate._id, payload);
      } else {
        await crmApi.createTemplate(payload);
      }

      setShowCreateModal(false);
      loadTemplates();
    } catch (err) {
      alert('Failed to save template: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await crmApi.deleteTemplate(id);
      loadTemplates();
    } catch (err) {
      alert('Failed to delete template: ' + err.message);
    }
  };

  const handleCopyText = (t) => {
    navigator.clipboard.writeText(t.body);
    setCopiedId(t._id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categories = [
    { key: 'all', label: 'All Templates' },
    { key: 'follow_up_1', label: 'Follow-up #1 (Intro)' },
    { key: 'follow_up_2', label: 'Follow-up #2 (Value)' },
    { key: 'follow_up_3', label: 'Follow-up #3 (Nudge)' },
    { key: 'site_visit_confirmation', label: 'Site Visit' },
    { key: 'unit_quote', label: 'Unit Quote' },
    { key: 'booking_confirmation', label: 'Booking' },
    { key: 'payment_reminder', label: 'Payment Reminder' },
    { key: 'handover', label: 'Handover' }
  ];

  const filteredTemplates = templates.filter(t =>
    selectedCategory === 'all' ? true : t.category === selectedCategory
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: "var(--text-primary)" }}>
            WhatsApp Communication Templates
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: "var(--text-secondary)" }}>
            Standard messaging templates with auto-resolved variables for follow-ups, quotes, and payment collections
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 16px',
            borderRadius: '8px',
            background: '#10b981',
            color: '#ffffff',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* Category Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px' }}>
        {categories.map(c => {
          const isActive = selectedCategory === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setSelectedCategory(c.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: isActive ? '#38bdf8' : '#334155',
                background: isActive ? '#38bdf8' : '#1e293b',
                color: isActive ? '#0f172a' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Template Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '16px'
      }}>
        {filteredTemplates.map(t => (
          <div
            key={t._id}
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: "var(--text-primary)" }}>
                  {t.name}
                </span>
                <span style={{
                  fontSize: '0.7rem',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: "var(--accent)",
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  textTransform: "none"
                }}>
                  {t.category}
                </span>
              </div>

              {/* WhatsApp Message Preview Bubble */}
              <div style={{
                background: '#075E54',
                color: '#ffffff',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                margin: '10px 0 14px',
                position: 'relative'
              }}>
                <div style={{
                  background: '#054c44',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  color: '#25D366',
                  fontWeight: 700,
                  marginBottom: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <MessageSquare size={12} /> WhatsApp Preview
                </div>
                <div>{t.body}</div>
              </div>

              {/* Variables Used */}
              {t.variables?.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {t.variables.map(v => (
                    <span
                      key={v}
                      style={{
                        background: "var(--card-bg)",
                        color: "var(--accent)",
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600
                      }}
                    >
                      {`{${v}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid #334155',
              paddingTop: '12px'
            }}>
              <button
                type="button"
                onClick={() => handleCopyText(t)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  color: copiedId === t._id ? '#10b981' : 'var(--text-secondary)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {copiedId === t._id ? <Check size={12} /> : <Copy size={12} />}
                {copiedId === t._id ? 'Copied' : 'Copy'}
              </button>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                    color: "var(--accent)",
                    cursor: 'pointer'
                  }}
                  title="Edit Template"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(t._id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    cursor: 'pointer'
                  }}
                  title="Delete Template"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CREATE / EDIT TEMPLATE MODAL ──────────────────────────────────── */}
      {showCreateModal && (
        <div className="crm-modal-backdrop" onClick={() => setShowCreateModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', width: '100%', maxWidth: '540px', padding: '24px', color: "var(--text-primary)"
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                {editingTemplate ? 'Edit WhatsApp Template' : '+ Create WhatsApp Template'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Template Name *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Follow-up #1: Warm Introduction"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Category
                </label>
                <Select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                >
                  <option value="follow_up_1">Follow-up #1 (Intro)</option>
                  <option value="follow_up_2">Follow-up #2 (Value)</option>
                  <option value="follow_up_3">Follow-up #3 (Nudge)</option>
                  <option value="site_visit_confirmation">Site Visit Confirmation</option>
                  <option value="unit_quote">Official Unit Quote</option>
                  <option value="booking_confirmation">Booking Confirmation</option>
                  <option value="payment_reminder">Payment Reminder</option>
                  <option value="handover">Possession & Handover</option>
                  <option value="general">General Broadcast</option>
                </Select>
              </div>

              {/* Variable Insertion Pills */}
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Insert Dynamic Variables (click to add into message):
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {availableVariables.map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => handleInsertVariable(v.tag)}
                      style={{
                        padding: '3px 8px',
                        background: "var(--input-bg)",
                        border: "1px solid var(--card-border)",
                        color: "var(--accent)",
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      title={v.label}
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Message Body *
                </label>
                <Textarea
                  required
                  rows={4}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem', lineHeight: 1.45, resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: '8px',
                  padding: '11px',
                  borderRadius: '8px',
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                {submitting ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Create Template')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

