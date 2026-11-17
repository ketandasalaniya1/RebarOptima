import React, { useState, useEffect } from 'react';
import {
  X, Phone, MessageSquare, Send, CheckCircle2, ChevronRight,
  Clock, Calendar, UserX, Award, SkipForward, AlertCircle,
  HelpCircle, ChevronDown, Check, Sparkles, Building2
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { formatINR } from '../../../utils/money';
import { Input, Select, Textarea } from '../../../components/ui';

export default function GuidedFollowupModal({
  leads = [],
  templates = [],
  onClose,
  onFollowupLogged,
  onOpenHoldOrBooking
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Directly and synchronously derive active lead from leads array
  const activeLead = (Array.isArray(leads) && leads.length > currentIndex) ? leads[currentIndex] : null;

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loggingOutcome, setLoggingOutcome] = useState(null); // 'no_reply' | 'replied' | 'site_visit' | 'not_interested' | 'deal_won'
  const [submitting, setSubmitting] = useState(false);

  // Form states for outcome tiles
  const [repliedStage, setRepliedStage] = useState('Qualified');
  const [repliedNextDate, setRepliedNextDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });

  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return `${d.toISOString().split('T')[0]}T11:00`;
  });
  const [visitLocation, setVisitLocation] = useState('Site Experience Centre');

  const [lostReason, setLostReason] = useState('Price out of budget');
  const [lostNotes, setLostNotes] = useState('');

  const [noReplyDays, setNoReplyDays] = useState(3);
  const [agentName] = useState(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || '{}');
      return u.name || u.email?.split('@')[0] || 'Sales Executive';
    } catch {
      return 'Sales Executive';
    }
  });

  // Resolve template placeholders
  const resolveTemplateVariables = (text, lead) => {
    if (!text || !lead) return '';
    const lName = lead.name || lead.customerName || 'Valued Customer';
    const lProject = lead.projectName || 'our project';
    const lType = lead.interest || lead.preferredPropertyType || 'Residential Flat';
    const lUnit = lead.unitCode || 'Available Unit';
    const lPrice = lead.budget ? formatINR(lead.budget) : (lead.budgetPaise ? formatINR(lead.budgetPaise / 100) : 'attractive rates');

    return text
      .replace(/\{name\}|\{\{customerName\}\}/gi, lName)
      .replace(/\{project\}|\{\{projectName\}\}/gi, lProject)
      .replace(/\{unit_type\}|\{\{configuration\}\}/gi, lType)
      .replace(/\{unit_code\}|\{\{unitCode\}\}/gi, lUnit)
      .replace(/\{price\}|\{\{price\}\}/gi, lPrice)
      .replace(/\{carpet_area\}|\{\{carpetArea\}\}/gi, '1,050')
      .replace(/\{base_price\}/gi, 'Starting from ₹75 Lakh')
      .replace(/\{tax_amount\}/gi, '5% GST')
      .replace(/\{booking_ref\}/gi, 'BK-CONFIRMED')
      .replace(/\{milestone_name\}|\{\{milestoneName\}\}/gi, 'Installment Milestone')
      .replace(/\{due_date\}|\{\{dueDate\}\}/gi, new Date().toLocaleDateString('en-IN'))
      .replace(/\{visit_date\}|\{\{visitDate\}\}/gi, 'this upcoming weekend')
      .replace(/\{visit_time\}|\{\{visitTime\}\}/gi, '11:00 AM')
      .replace(/\{location\}|\{\{location\}\}/gi, 'Site Experience Centre')
      .replace(/\{expiry_time\}|\{\{expiryTime\}\}/gi, '48 hours from issuance')
      .replace(/\{agent_name\}/gi, agentName);
  };

  // Sync template and messageText whenever activeLead or templates change
  useEffect(() => {
    if (activeLead) {
      const count = Number(activeLead.followupCount || activeLead.followup_count || 1);
      let targetCategory = 'follow_up_1';
      if (count === 2) targetCategory = 'follow_up_2';
      else if (count >= 3) targetCategory = 'follow_up_3';

      const match = templates.find(t => (t.category === targetCategory || t.trigger === 'new_lead')) || templates[0];
      if (match) {
        setSelectedTemplateId(match._id || match.category);
        setMessageText(resolveTemplateVariables(match.body, activeLead));
      } else {
        const leadDisplayName = activeLead.name || activeLead.customerName || 'there';
        const leadDisplayProj = activeLead.projectName || 'our project';
        setMessageText(`Hello ${leadDisplayName}, following up regarding your query for ${leadDisplayProj}. When is a good time to connect?`);
      }

      setLoggingOutcome(null);
    }
  }, [currentIndex, activeLead, templates]);

  // Handle template selection change
  const handleSelectTemplate = (tmplId) => {
    setSelectedTemplateId(tmplId);
    const tmpl = templates.find(t => (t._id || t.category) === tmplId);
    if (tmpl && activeLead) {
      setMessageText(resolveTemplateVariables(tmpl.body, activeLead));
    }
  };

  // Open WhatsApp Link
  const handleOpenWhatsApp = () => {
    if (!activeLead) return;
    const rawPhone = (activeLead.phone || activeLead.customerPhone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('91') && rawPhone.length === 12 ? rawPhone : (rawPhone.length === 10 ? `91${rawPhone}` : rawPhone);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Skip lead
  const handleSkipLead = () => {
    if (currentIndex + 1 < leads.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(leads.length);
    }
  };

  // Log follow-up outcome
  const [interactionChannel, setInteractionChannel] = useState('Phone call');
  const [generalNotes, setGeneralNotes] = useState('');

  const handleConfirmOutcome = async (outcomeType) => {
    if (!activeLead || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        outcome: outcomeType,
        templateUsed: selectedTemplateId,
        messageSent: messageText,
        noReplyDays
      };

      let computedNextDate = undefined;
      if (outcomeType === 'no_reply') {
        const d = new Date();
        d.setDate(d.getDate() + Number(noReplyDays || 3));
        computedNextDate = d.toISOString();
      } else if (outcomeType === 'replied') {
        payload.newStage = repliedStage;
        payload.nextFollowupDate = repliedNextDate;
        computedNextDate = repliedNextDate;
      } else if (outcomeType === 'site_visit') {
        payload.appointmentData = {
          start: visitDate,
          location: visitLocation,
          title: `Site Walkthrough - ${activeLead.name}`
        };
      } else if (outcomeType === 'not_interested') {
        payload.lostReason = lostReason;
        payload.notes = lostNotes || generalNotes;
      } else if (outcomeType === 'deal_won') {
        payload.notes = 'Deal Won! Customer ready to reserve unit.';
      }

      // Persist in MongoDB via backend interaction & followup logging endpoint
      await crmApi.logFollowupInteraction({
        leadId: activeLead.id || activeLead._id,
        customerId: activeLead.customerId,
        interactionType: interactionChannel,
        interactionDate: new Date(),
        notes: generalNotes || payload.notes || messageText || outcomeType,
        outcome: outcomeType,
        nextFollowupDate: computedNextDate,
        assignedEmployee: agentName,
        newStage: payload.newStage,
        lostReason: payload.lostReason,
        appointmentData: payload.appointmentData
      });

      // Backward compatible call to update lead stage
      await crmApi.logFollowupResult(activeLead.id || activeLead._id, payload);

      if (outcomeType === 'deal_won' && onOpenHoldOrBooking) {
        onOpenHoldOrBooking(activeLead);
      }

      if (onFollowupLogged) {
        onFollowupLogged(activeLead, outcomeType);
      }

      // Move to next lead
      if (currentIndex + 1 < leads.length) {
        setCurrentIndex(prev => prev + 1);
        setGeneralNotes('');
      } else {
        setCurrentIndex(leads.length);
      }
    } catch (err) {
      alert('Failed to log follow-up result: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // All followups done state
  if (!leads || leads.length === 0 || currentIndex >= leads.length || !activeLead) {
    return (
      <div className="crm-modal-backdrop" onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '32px 24px', textAlign: 'center', color: "var(--text-primary)"
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', background: 'var(--success-subtle)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
          }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px' }}>All caught up!</h2>
          <p style={{ fontSize: '0.88rem', color: "var(--text-secondary)", margin: '0 0 24px', lineHeight: 1.5 }}>
            You have completed all scheduled follow-ups for today. Great job keeping the sales pipeline warm!
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px', background: "var(--accent)", color: "var(--accent-contrast)", border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
            }}
          >
            Close Follow-up Queue
          </button>
        </div>
      </div>
    );
  }

  const remainingAfterThis = leads.length - currentIndex - 1;
  const leadName = activeLead?.name || activeLead?.customerName || 'Lead';
  const leadPhone = activeLead?.phone || activeLead?.customerPhone || '';
  const leadProject = activeLead?.projectName || 'Project';
  const leadStage = activeLead?.stage || 'New';
  const leadInterest = activeLead?.interest || activeLead?.preferredPropertyType || 'Residential Flat';
  const initials = leadName.slice(0, 2).toUpperCase() || 'LD';

  return (
    <div className="crm-modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
    }}>
      <div
        className="crm-guided-followup-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          color: "var(--text-primary)"
        }}
      >
        {/* ── HEADER WITH PROGRESS ───────────────────────────────────────── */}
        <div style={{
          padding: '14px 20px',
          borderBottom: "1px solid var(--card-border)",
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--main-bg)'
        }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Follow-up</span>
              <span style={{ fontSize: '0.78rem', color: "var(--accent)", background: 'var(--info-subtle)', padding: '2px 8px', borderRadius: '10px' }}>
                {remainingAfterThis > 0 ? `${remainingAfterThis} more after this` : 'Final lead'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", marginTop: '2px' }}>
              Lead {currentIndex + 1} of {leads.length}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleSkipLead}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: "var(--input-bg)",
                border: "1px solid var(--card-border)",
                color: "var(--text-secondary)",
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Skip <SkipForward size={13} />
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer', padding: '4px' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ────────────────────────────────────────────── */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* 1. Lead Card */}
          <div style={{
            background: "var(--input-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '50%', background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem'
              }}>
                {initials}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: "var(--text-primary)" }}>{leadName}</span>
                  <span style={{ fontSize: '0.72rem', background: "var(--card-bg)", color: "var(--accent)", padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    {leadProject}
                  </span>
                  <span style={{ fontSize: '0.72rem', background: "var(--card-bg)", color: "var(--text-secondary)", padding: '1px 6px', borderRadius: '4px' }}>
                    {leadStage}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '3px' }}>
                  {leadInterest} • <strong style={{ color: "var(--text-secondary)" }}>Follow-up #{activeLead?.followupCount || activeLead?.followup_count || 1}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {leadPhone && (
                <a
                  href={`tel:${leadPhone}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                    color: "var(--accent)",
                    textDecoration: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  <Phone size={14} /> Call
                </a>
              )}
            </div>
          </div>

          {/* Interaction Channel Selector */}
          <div>
            <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Select Interaction Channel
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '6px' }}>
              {['Phone call', 'WhatsApp', 'Email', 'Meeting', 'No response', 'Rescheduled', 'Completed'].map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setInteractionChannel(ch)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '8px',
                    border: interactionChannel === ch ? '1px solid var(--accent)' : '1px solid var(--card-border)',
                    background: interactionChannel === ch ? 'var(--info-subtle)' : 'var(--input-bg)',
                    color: interactionChannel === ch ? 'var(--info-text)' : 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Message Template Picker + Textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, textTransform: "none" }}>
                WhatsApp Template
              </label>
              <span style={{ fontSize: '0.72rem', color: "var(--accent)" }}>Variables auto-resolved</span>
            </div>

            <Select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                border: "1px solid var(--card-border)",
                color: "var(--text-primary)",
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {templates.length === 0 && (
                <option value="">Default Quick Follow-up Message</option>
              )}
              {templates.map(t => (
                <option key={t._id || t.category || t.title} value={t._id || t.category || t.title}>
                  {t.title || t.name || t.category || 'Message Template'}
                </option>
              ))}
            </Select>

            <div style={{ position: 'relative' }}>
              <Textarea
                rows={4}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  background: "var(--input-bg)",
                  border: "1px solid var(--card-border)",
                  color: "var(--text-primary)",
                  fontSize: '0.86rem',
                  lineHeight: 1.45,
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {messageText.length} characters
              </div>
            </div>

            {/* Big WhatsApp Send Button */}
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                background: '#25D366',
                color: 'var(--text-primary)',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
              }}
            >
              <Send size={16} /> Open WhatsApp & send
            </button>
          </div>

          {/* 3. Outcome Logger Section */}
          <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: '16px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--text-secondary)", textTransform: "none", marginBottom: '10px' }}>
              Already messaged? Log the result
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '14px' }}>
              {/* Tile A: No reply yet */}
              <button
                type="button"
                onClick={() => setLoggingOutcome(loggingOutcome === 'no_reply' ? null : 'no_reply')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: `1px solid ${loggingOutcome === 'no_reply' ? 'var(--accent)' : 'var(--card-border)'}`,
                  background: loggingOutcome === 'no_reply' ? 'var(--info-subtle)' : 'var(--input-bg)',
                  color: "var(--text-primary)",
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Clock size={18} color="var(--accent)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>No reply yet</span>
                <span style={{ fontSize: '0.68rem', color: "var(--text-secondary)" }}>Remind in 3d</span>
              </button>

              {/* Tile B: They replied */}
              <button
                type="button"
                onClick={() => setLoggingOutcome(loggingOutcome === 'replied' ? null : 'replied')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: `1px solid ${loggingOutcome === 'replied' ? 'var(--accent)' : 'var(--card-border)'}`,
                  background: loggingOutcome === 'replied' ? 'var(--success-subtle)' : 'var(--input-bg)',
                  color: "var(--text-primary)",
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <MessageSquare size={18} color="var(--accent-text)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>They replied</span>
                <span style={{ fontSize: '0.68rem', color: "var(--text-secondary)" }}>Update stage</span>
              </button>

              {/* Tile C: Site visit booked */}
              <button
                type="button"
                onClick={() => setLoggingOutcome(loggingOutcome === 'site_visit' ? null : 'site_visit')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: `1px solid ${loggingOutcome === 'site_visit' ? '#a78bfa' : 'var(--card-border)'}`,
                  background: loggingOutcome === 'site_visit' ? 'var(--accent-subtle)' : 'var(--input-bg)',
                  color: "var(--text-primary)",
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Calendar size={18} color="#a78bfa" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Site visit</span>
                <span style={{ fontSize: '0.68rem', color: "var(--text-secondary)" }}>Book tour</span>
              </button>

              {/* Tile D: Not interested */}
              <button
                type="button"
                onClick={() => setLoggingOutcome(loggingOutcome === 'not_interested' ? null : 'not_interested')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: `1px solid ${loggingOutcome === 'not_interested' ? 'var(--danger)' : 'var(--card-border)'}`,
                  background: loggingOutcome === 'not_interested' ? 'var(--danger-subtle)' : 'var(--input-bg)',
                  color: "var(--text-primary)",
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <UserX size={18} color="var(--danger-text)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Not interested</span>
                <span style={{ fontSize: '0.68rem', color: "var(--text-secondary)" }}>Mark lost</span>
              </button>

              {/* Tile E: Deal won */}
              <button
                type="button"
                onClick={() => setLoggingOutcome(loggingOutcome === 'deal_won' ? null : 'deal_won')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: `1px solid ${loggingOutcome === 'deal_won' ? 'var(--warning)' : 'var(--card-border)'}`,
                  background: loggingOutcome === 'deal_won' ? 'var(--warning-subtle)' : 'var(--input-bg)',
                  color: "var(--text-primary)",
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Award size={18} color="var(--warning-text)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Deal won</span>
                <span style={{ fontSize: '0.68rem', color: "var(--text-secondary)" }}>Hold / Book</span>
              </button>
            </div>

            {/* ── EXPANDED OUTCOME FORMS ────────────────────────────────────── */}
            {loggingOutcome === 'no_reply' && (
              <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '8px', border: "1px solid var(--card-border)", display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.84rem', color: "var(--text-secondary)" }}>
                  Schedule automatic next follow-up:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: "var(--text-secondary)" }}>Remind me in:</label>
                  <Select
                    value={noReplyDays}
                    onChange={(e) => setNoReplyDays(Number(e.target.value))}
                    style={{ padding: '6px 10px', borderRadius: '6px', background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.82rem' }}
                  >
                    <option value={1}>1 day</option>
                    <option value={2}>2 days</option>
                    <option value={3}>3 days (Standard)</option>
                    <option value={5}>5 days</option>
                    <option value={7}>7 days</option>
                  </Select>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleConfirmOutcome('no_reply')}
                  style={{
                    padding: '9px', borderRadius: '6px', background: "var(--accent)", color: "var(--accent-contrast)", border: 'none', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Saving...' : `Confirm (Increment to Follow-up #${(activeLead?.followupCount || activeLead?.followup_count || 1) + 1})`}
                </button>
              </div>
            )}

            {loggingOutcome === 'replied' && (
              <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '8px', border: "1px solid var(--card-border)", display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Move to Stage</label>
                    <Select
                      value={repliedStage}
                      onChange={(e) => setRepliedStage(e.target.value)}
                      style={{ width: '100%', padding: '7px', borderRadius: '6px', background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.82rem' }}
                    >
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Visit Scheduled">Visit Scheduled</option>
                      <option value="Negotiation">Negotiation</option>
                    </Select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Next Follow-up Date</label>
                    <Input
                      type="date"
                      value={repliedNextDate}
                      onChange={(e) => setRepliedNextDate(e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleConfirmOutcome('replied')}
                  style={{
                    padding: '9px', borderRadius: '6px', background: 'var(--accent)', color: 'var(--accent-contrast)', border: 'none', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Saving...' : 'Save Reply & Advance Stage'}
                </button>
              </div>
            )}

            {loggingOutcome === 'site_visit' && (
              <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '8px', border: "1px solid var(--card-border)", display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Visit Date & Time *</label>
                    <Input
                      type="datetime-local"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Location</label>
                    <Input
                      type="text"
                      value={visitLocation}
                      onChange={(e) => setVisitLocation(e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleConfirmOutcome('site_visit')}
                  style={{
                    padding: '9px', borderRadius: '6px', background: 'var(--accent)', color: 'var(--accent-contrast)', border: 'none', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Scheduling...' : 'Schedule Site Visit & Move to Visit Scheduled'}
                </button>
              </div>
            )}

            {loggingOutcome === 'not_interested' && (
              <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '8px', border: '1px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--danger-text)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Mandatory Lost Reason *
                  </label>
                  <Select
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    style={{ width: '100%', padding: '7px', borderRadius: '6px', background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.82rem' }}
                  >
                    <option value="Price out of budget">Price out of budget</option>
                    <option value="Location not preferred">Location not preferred</option>
                    <option value="Bought competitor project">Bought competitor project</option>
                    <option value="Looking for ready possession">Looking for ready possession</option>
                    <option value="Unit size / floor plan mismatch">Unit size / floor plan mismatch</option>
                    <option value="Home loan rejected">Home loan rejected</option>
                    <option value="Just exploring / Invalid lead">Just exploring / Invalid lead</option>
                    <option value="Other">Other reason</option>
                  </Select>
                </div>
                <Textarea
                  placeholder="Optional detail on why the prospect dropped..."
                  rows={2}
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  style={{ width: '100%', padding: '6px', borderRadius: '6px', background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.82rem', resize: 'none' }}
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleConfirmOutcome('not_interested')}
                  style={{
                    padding: '9px', borderRadius: '6px', background: 'var(--danger)', color: 'var(--accent-contrast)', border: 'none', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Saving...' : 'Confirm Drop & Mark Lost'}
                </button>
              </div>
            )}

            {loggingOutcome === 'deal_won' && (
              <div style={{ background: "var(--input-bg)", padding: '14px', borderRadius: '8px', border: '1px solid var(--warning)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--warning-text)', fontWeight: 600 }}>
                  🎉 Deal Won! The customer is ready to proceed.
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: "var(--text-secondary)" }}>
                  This will log the successful follow-up and open the unit picker to place a 48-hour hold or draft a booking contract with CLP milestone schedule.
                </p>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleConfirmOutcome('deal_won')}
                  style={{
                    padding: '9px', borderRadius: '6px', background: 'var(--warning)', color: 'var(--accent-contrast)', border: 'none', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Saving...' : 'Log Deal Won & Open Unit Hold / Booking'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

