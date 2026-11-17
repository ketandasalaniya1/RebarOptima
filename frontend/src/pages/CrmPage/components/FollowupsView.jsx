import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock, Play, Phone, MessageSquare, Mail, Calendar, CheckCircle2,
  AlertCircle, Search, Filter, RefreshCw, UserCheck, ChevronRight,
  ArrowRight, Shield, Building2, User
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { formatINR, formatShortINR } from '../../../utils/money';
import { Input, Select, Textarea } from '../../../components/ui';

export default function FollowupsView({
  selectedProjectId,
  onStartFollowups,
  onSelectLead,
  onRefreshData
}) {
  const [followups, setFollowups] = useState([]);
  const [stats, setStats] = useState({ overdue: 0, dueToday: 0, next7Days: 0, completedToday: 0, totalPending: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'overdue' | 'today' | 'next7days' | 'completed'

  // Single lead interaction modal state
  const [selectedLeadForLog, setSelectedLeadForLog] = useState(null);
  const [interactionType, setInteractionType] = useState('Phone call');
  const [interactionNotes, setInteractionNotes] = useState('');
  const [interactionOutcome, setInteractionOutcome] = useState('Connected & Interested');
  const [nextFollowupDate, setNextFollowupDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchFollowups = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getFollowups({
        projectId: selectedProjectId || undefined,
        search: searchQuery || undefined,
        bucket: activeTab !== 'all' ? activeTab : undefined
      });
      setFollowups(res.followups || []);
      setStats(res.stats || { overdue: 0, dueToday: 0, next7Days: 0, completedToday: 0, totalPending: 0 });
    } catch (err) {
      console.warn('Failed to load follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
  }, [selectedProjectId, activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchFollowups();
  };

  const handleLogSingleInteraction = async (e) => {
    e.preventDefault();
    if (!selectedLeadForLog || submitting) return;
    setSubmitting(true);
    try {
      await crmApi.logFollowupInteraction({
        leadId: selectedLeadForLog.leadId || selectedLeadForLog.id,
        customerId: selectedLeadForLog.customerId,
        interactionType,
        notes: interactionNotes,
        outcome: interactionOutcome,
        nextFollowupDate: nextFollowupDate ? `${nextFollowupDate}T12:00:00` : undefined,
        assignedEmployee: assignedEmployee || selectedLeadForLog.assignedTo || 'Sales Team'
      });
      setSelectedLeadForLog(null);
      setInteractionNotes('');
      fetchFollowups();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert('Failed to record follow-up: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return followups;
    const q = searchQuery.toLowerCase().trim();
    return followups.filter(f =>
      (f.name && f.name.toLowerCase().includes(q)) ||
      (f.phone && f.phone.includes(q)) ||
      (f.projectName && f.projectName.toLowerCase().includes(q)) ||
      (f.unitCode && f.unitCode.toLowerCase().includes(q))
    );
  }, [followups, searchQuery]);

  return (
    <div className="crm-followups-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: "var(--text-primary)" }}>
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={28} color="var(--accent)" /> Follow-ups Queue
          </h1>
          <div style={{ fontSize: '0.88rem', color: "var(--text-secondary)" }}>
            Multi-channel follow-up management with chronological overdue prioritization.
          </div>
        </div>

        <button
          type="button"
          onClick={onStartFollowups}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '10px',
            background: 'var(--accent)',
            color: 'var(--accent-contrast)',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)'
          }}
        >
          <Play size={18} fill="currentColor" /> Start Follow-ups ({stats.totalPending || 0})
        </button>
      </div>

      {/* ── 4 STAT CARDS ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '16px', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", fontWeight: 700, textTransform: "none" }}>Overdue</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger-text)', marginTop: '4px' }}>{stats.overdue}</div>
          <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '4px' }}>Requires immediate response</div>
        </div>
        <div style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '16px', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", fontWeight: 700, textTransform: "none" }}>Due Today</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--warning-text)', marginTop: '4px' }}>{stats.dueToday}</div>
          <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '4px' }}>Scheduled for today</div>
        </div>
        <div style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '16px', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", fontWeight: 700, textTransform: "none" }}>Next 7 Days</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: "var(--accent)", marginTop: '4px' }}>{stats.next7Days}</div>
          <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '4px' }}>Upcoming scheduled pipeline</div>
        </div>
        <div style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '16px', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", fontWeight: 700, textTransform: "none" }}>Completed Today</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-text)', marginTop: '4px' }}>{stats.completedToday}</div>
          <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '4px' }}>Interactions recorded</div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Pending (${stats.totalPending})` },
            { id: 'overdue', label: `Overdue (${stats.overdue})`, badge: '#ef4444' },
            { id: 'today', label: `Due Today (${stats.dueToday})`, badge: '#f59e0b' },
            { id: 'next7days', label: `Next 7 Days (${stats.next7Days})`, badge: '#38bdf8' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeTab === tab.id ? '1px solid var(--accent)' : '1px solid var(--card-border)',
                background: activeTab === tab.id ? 'var(--info-subtle)' : 'var(--input-bg)',
                color: activeTab === tab.id ? 'var(--info-text)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: "var(--text-secondary)" }} />
            <Input
              type="text"
              placeholder="Search buyer, phone, unit…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: "1px solid var(--card-border)",
                background: "var(--card-bg)",
                color: "var(--text-primary)",
                fontSize: '0.84rem'
              }}
            />
          </div>
          <button
            type="button"
            onClick={fetchFollowups}
            style={{ padding: '8px 12px', borderRadius: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-secondary)", cursor: 'pointer' }}
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
          </button>
        </form>
      </div>

      {/* ── FOLLOW-UPS TABLE ────────────────────────────────────────────────── */}
      <div style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: "var(--text-secondary)" }}>
            <RefreshCw size={32} className="spin-icon" style={{ margin: '0 auto 12px' }} />
            <div>Loading follow-ups queue…</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '56px 20px', textAlign: 'center', color: "var(--text-secondary)" }}>
            <CheckCircle2 size={44} color="var(--accent-text)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: "var(--text-primary)", marginBottom: '6px' }}>All caught up!</div>
            <div style={{ fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto' }}>
              No follow-ups waiting in this category. Use the "Start Follow-ups" button to launch queued sessions or add new leads.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: "var(--card-bg)", borderBottom: '1px solid var(--card-border)', color: "var(--text-secondary)" }}>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Lead / Customer</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Project & Interest</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Due Status</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Stage</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Assigned To</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div
                        onClick={() => onSelectLead && onSelectLead(item)}
                        style={{ fontWeight: 700, color: "var(--text-primary)", cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '2px' }}>
                        {item.phone} {item.email ? `• ${item.email}` : ''}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{item.projectName}</div>
                      <div style={{ fontSize: '0.78rem', color: "var(--accent)" }}>{item.interest || 'Property Inquiry'}</div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: item.isOverdue ? 'var(--danger-subtle)' : (item.isToday ? 'var(--warning-subtle)' : 'var(--info-subtle)'),
                        color: item.isOverdue ? 'var(--danger-text)' : (item.isToday ? 'var(--warning-text)' : 'var(--info-text)')
                      }}>
                        {item.dueLabel}
                      </span>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        Attempt #{item.followupCount || 1}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {item.stage}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', color: "var(--text-secondary)", fontSize: '0.82rem' }}>
                      {item.assignedTo || 'Sales Team'}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedLeadForLog(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: "var(--accent)", color: "var(--accent-contrast)",
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: 'pointer'
                          }}
                        >
                          Log Interaction
                        </button>

                        {item.phone && (
                          <a
                            href={`https://wa.me/91${item.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hello ${item.name}, following up on your property inquiry for ${item.projectName}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              background: 'var(--accent)',
                              color: 'var(--accent-contrast)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare size={14} />
                          </a>
                        )}

                        {item.phone && (
                          <a
                            href={`tel:${item.phone}`}
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              background: "var(--input-bg)",
                              color: "var(--accent)",
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Call Phone"
                          >
                            <Phone size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SINGLE LEAD INTERACTION MODAL ───────────────────────────────────── */}
      {selectedLeadForLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', color: "var(--text-primary)" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Record Interaction</h3>
                <div style={{ fontSize: '0.82rem', color: "var(--text-secondary)" }}>
                  {selectedLeadForLog.name} • {selectedLeadForLog.phone}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadForLog(null)}
                style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLogSingleInteraction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Interaction Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {['Phone call', 'WhatsApp', 'Email', 'Meeting', 'No response', 'Rescheduled', 'Completed'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setInteractionType(type)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '6px',
                        border: interactionType === type ? '1px solid var(--accent)' : '1px solid var(--card-border)',
                        background: interactionType === type ? 'var(--info-subtle)' : 'var(--input-bg)',
                        color: interactionType === type ? 'var(--info-text)' : 'var(--text-secondary)',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Outcome
                </label>
                <Select
                  value={interactionOutcome}
                  onChange={(e) => setInteractionOutcome(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.86rem' }}
                >
                  <option value="Connected & Interested">Connected & Interested</option>
                  <option value="Requested Callback">Requested Callback</option>
                  <option value="Site Visit Planned">Site Visit Planned</option>
                  <option value="Price Negotiation">Price Negotiation</option>
                  <option value="No Response / Ringing">No Response / Ringing</option>
                  <option value="Not Interested / Lost">Not Interested / Lost</option>
                  <option value="Deal Won / Ready to Book">Deal Won / Ready to Book</option>
                </Select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Interaction Notes
                </label>
                <Textarea
                  rows={3}
                  value={interactionNotes}
                  onChange={(e) => setInteractionNotes(e.target.value)}
                  placeholder="Summarize buyer requirements, objections, or feedback…"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Next Follow-up Date
                  </label>
                  <Input
                    type="date"
                    value={nextFollowupDate}
                    onChange={(e) => setNextFollowupDate(e.target.value)}
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.84rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Assigned Salesperson
                  </label>
                  <Input
                    type="text"
                    value={assignedEmployee || selectedLeadForLog.assignedTo || ''}
                    onChange={(e) => setAssignedEmployee(e.target.value)}
                    placeholder="Sales Executive"
                    style={{ width: '100%', padding: '9px', borderRadius: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.84rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedLeadForLog(null)}
                  style={{ padding: '9px 16px', borderRadius: '8px', background: "var(--input-bg)", border: 'none', color: "var(--text-primary)", fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '9px 20px', borderRadius: '8px', background: "var(--accent)", border: 'none', color: 'var(--accent-contrast)', fontWeight: 700, cursor: 'pointer' }}
                >
                  {submitting ? 'Saving...' : 'Save Interaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

