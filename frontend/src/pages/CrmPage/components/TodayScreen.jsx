import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle2, Clock, Phone, MessageSquare, Plus,
  TrendingUp, Users, DollarSign, ChevronRight, AlertCircle, Eye,
  Play, CheckCircle, Circle, Flag, Bell, Repeat, CheckSquare,
  ArrowRight, ShieldAlert, Sparkles, Building2, ExternalLink
} from 'lucide-react';
import { formatINR, formatShortINR } from '../../../utils/money';

export default function TodayScreen({
  summary = null,
  onStartFollowups,
  onAddLead,
  onSelectLead,
  onToggleTask,
  onAddTask,
  onAddAppointment,
  onExtendHold,
  onReleaseHold,
  onSwitchScreen
}) {
  // Live countdown state for holds
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format seconds into HH:MM:SS
  const formatCountdown = (expiresAtStr) => {
    if (!expiresAtStr) return '00:00:00';
    const diffMs = new Date(expiresAtStr).getTime() - now;
    if (diffMs <= 0) return 'Expired';
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const greeting = summary?.greeting || 'Good day, Team';
  const dateFormatted = summary?.dateFormatted || new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const stats = summary?.stats || { overdue: 0, dueToday: 0, next7Days: 0, doneToday: 0, waitingFollowupsCount: 0 };
  const appointments = summary?.appointments || [];
  const tasks = summary?.tasks || [];
  const collections = summary?.collectionsDue || { totalDueAmount: 0, overdueCount: 0, items: [] };
  const holds = summary?.holdsExpiringSoon || [];
  const leadGroups = summary?.leadFollowupGroups || { overdue: [], dueToday: [], comingUp: [] };

  const getPriorityColor = (p) => {
    switch (p?.toLowerCase()) {
      case 'high':
      case 'urgent':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  };

  const getAppointmentDotColor = (type) => {
    switch (type) {
      case 'site_visit':
        return '#8b5cf6'; // Purple
      case 'meeting':
        return '#f59e0b'; // Amber
      case 'call':
        return '#10b981'; // Emerald
      case 'registration':
        return '#ec4899'; // Pink
      case 'handover':
        return '#06b6d4'; // Cyan
      default:
        return '#64748b';
    }
  };

  const getInitials = (name) => {
    if (!name) return 'LD';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleWhatsAppReminder = (item) => {
    const phone = (item.customerPhone || '').replace(/\D/g, '');
    const text = `Dear ${item.customerName},\n\nGreetings from ${item.projectName}.\nThis is a gentle reminder regarding the installment milestone for Unit ${item.unitNumber} (${item.milestoneName}).\nAmount Due: ${formatINR(item.pendingAmount)}.\nDue Date: ${new Date(item.dueDate).toLocaleDateString('en-IN')}.\n\nPlease let us know once payment is initiated so we can issue your official receipt.\n\nThank you!`;
    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsAppLead = (lead) => {
    const phone = (lead.phone || '').replace(/\D/g, '');
    const text = `Hello ${lead.name},\n\nThank you for your interest in ${lead.projectName}. I'm following up regarding your query for ${lead.interest}.\nAre you available for a brief call or a site walkthrough this week?\n\nBest regards,\nSales Team`;
    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="crm-today-rebuild" style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      {/* ── TOP HEADER: GREETING & HERO ACTIONS ─────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--card-border)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {greeting}
            </h1>
            {stats.waitingFollowupsCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={12} /> {stats.waitingFollowupsCount} follow-ups waiting
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {dateFormatted}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onStartFollowups}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              background: "var(--accent)",
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(22, 163, 74, 0.3)'
            }}
          >
            <Play size={16} fill="#ffffff" /> Start follow-ups
          </button>
          <button
            type="button"
            onClick={onAddLead}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              background: "var(--accent)", color: "var(--accent-contrast)",
              border: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} /> Add lead
          </button>
        </div>
      </div>

      {/* ── FOUR STAT CARDS ─────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        marginBottom: '28px'
      }}>
        {/* Overdue */}
        <div style={{
          background: 'var(--card-bg)',
          border: "1px solid var(--card-border)",
          borderRadius: '12px',
          padding: '16px',
          borderLeft: '4px solid #ef4444'
        }}>
          <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, textTransform: "none" }}>Overdue</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
            {stats.overdue}
          </div>
          <div style={{ fontSize: '0.75rem', color: "var(--text-label)", marginTop: '2px' }}>Requires immediate attention</div>
        </div>

        {/* Due Today */}
        <div style={{
          background: 'var(--card-bg)',
          border: "1px solid var(--card-border)",
          borderRadius: '12px',
          padding: '16px',
          borderLeft: '4px solid #f59e0b'
        }}>
          <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, textTransform: "none" }}>Due today</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
            {stats.dueToday}
          </div>
          <div style={{ fontSize: '0.75rem', color: "var(--text-label)", marginTop: '2px' }}>Scheduled for today</div>
        </div>

        {/* Next 7 Days */}
        <div style={{
          background: 'var(--card-bg)',
          border: "1px solid var(--card-border)",
          borderRadius: '12px',
          padding: '16px',
          borderLeft: '4px solid #38bdf8'
        }}>
          <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, textTransform: "none" }}>Next 7 days</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: "var(--accent)", marginTop: '4px' }}>
            {stats.next7Days}
          </div>
          <div style={{ fontSize: '0.75rem', color: "var(--text-label)", marginTop: '2px' }}>Upcoming pipeline</div>
        </div>

        {/* Done Today */}
        <div style={{
          background: 'var(--card-bg)',
          border: "1px solid var(--card-border)",
          borderRadius: '12px',
          padding: '16px',
          borderLeft: '4px solid #10b981'
        }}>
          <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", fontWeight: 600, textTransform: "none" }}>Done today</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            {stats.doneToday}
          </div>
          <div style={{ fontSize: '0.75rem', color: "var(--text-label)", marginTop: '2px' }}>Completed interactions</div>
        </div>
      </div>

      {/* ── 5 SECTIONS STRICTLY IN REQUIRED ORDER ───────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* 1. TODAY'S APPOINTMENTS */}
        <section style={{
          background: 'var(--card-bg)',
          border: "1px solid var(--card-border)",
          borderRadius: '14px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="var(--accent)" />
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Today's appointments ({appointments.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={onAddAppointment}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: "var(--input-bg)",
                border: "1px solid var(--card-border)",
                color: "var(--accent)",
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {appointments.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: "var(--text-label)", fontSize: '0.85rem' }}>
              No appointments scheduled for today.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {appointments.map(apt => (
                <div key={apt.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: "var(--input-bg)",
                  borderRadius: '8px',
                  border: "1px solid var(--card-border)",
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: getAppointmentDotColor(apt.type)
                    }} />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: "var(--text-primary)" }}>
                        {apt.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)" }}>
                        {apt.type} • {apt.location} • <strong style={{ color: "var(--text-primary)" }}>{apt.customerName}</strong>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: "var(--accent)", background: 'rgba(56, 189, 248, 0.1)', padding: '3px 8px', borderRadius: '6px' }}>
                    {apt.timeRange}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. TASKS FOR TODAY */}
        <section style={{
          background: 'var(--card-bg)',
          border: "1px solid var(--card-border)",
          borderRadius: '14px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckSquare size={18} color="#10b981" />
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Tasks for today ({tasks.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={onAddTask}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: "var(--input-bg)",
                border: "1px solid var(--card-border)",
                color: "var(--accent)",
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {tasks.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: "var(--text-label)", fontSize: '0.85rem' }}>
              No tasks due for today. All caught up!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tasks.map(t => (
                <div key={t.id} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: "var(--input-bg)",
                  borderRadius: '8px',
                  border: `1px solid ${t.isOverdue ? '#ef4444' : '#334155'}`,
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => onToggleTask(t.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        marginTop: '2px',
                        color: t.status === 'Completed' ? '#10b981' : getPriorityColor(t.priority)
                      }}
                      title="Toggle task completion"
                    >
                      {t.status === 'Completed' ? (
                        <CheckCircle2 size={18} fill="#10b981" color="#0f172a" />
                      ) : (
                        <Circle size={18} strokeWidth={2.5} />
                      )}
                    </button>

                    <div>
                      <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: t.status === 'Completed' ? '#64748b' : '#f8fafc',
                        textDecoration: t.status === 'Completed' ? 'line-through' : 'none'
                      }}>
                        {t.title}
                      </div>

                      {/* Meta Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap', fontSize: '0.75rem', color: "var(--text-secondary)" }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: getPriorityColor(t.priority), fontWeight: 600 }}>
                          <Flag size={12} /> {t.priority}
                        </span>

                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={12} /> {t.dueTime}
                        </span>

                        {t.reminder && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#fbbf24' }}>
                            <Bell size={12} />
                          </span>
                        )}

                        {t.checklistCount > 0 && (
                          <span style={{ background: "var(--input-bg)", padding: '1px 6px', borderRadius: '4px' }}>
                            {t.checklistDoneCount}/{t.checklistCount}
                          </span>
                        )}

                        {t.linkedLead && (
                          <span
                            onClick={() => onSelectLead({ _id: t.linkedLead.id, fullName: t.linkedLead.name })}
                            style={{
                              background: "var(--input-bg)",
                              color: "var(--accent)",
                              padding: '1px 6px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            👤 {t.linkedLead.name} {t.linkedLead.unitCode ? `(${t.linkedLead.unitCode})` : ''}
                          </span>
                        )}

                        {t.repeatRule && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#a78bfa' }}>
                            <Repeat size={12} /> {t.repeatRule}
                          </span>
                        )}

                        {t.status === 'In Progress' && (
                          <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            In progress
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. COLLECTIONS DUE */}
        <section style={{
          background: 'var(--card-bg)',
          border: "1px solid var(--card-border)",
          borderRadius: '14px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} color="#16a34a" />
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Collections due ({collections.items?.length || 0})
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a' }}>
                Total Due: {formatINR(collections.totalDueAmount || 0)}
              </span>
              {collections.overdueCount > 0 && (
                <span style={{ background: '#ef4444', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                  {collections.overdueCount} Overdue
                </span>
              )}
            </div>
          </div>

          {collections.items?.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: "var(--text-label)", fontSize: '0.85rem' }}>
              No payments or milestone collections due right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {collections.items.map((col, idx) => (
                <div key={`${col.bookingId}-${idx}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: "var(--input-bg)",
                  borderRadius: '8px',
                  border: `1px solid ${col.isOverdue ? '#ef4444' : '#334155'}`,
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: "var(--text-primary)" }}>
                        {col.customerName}
                      </span>
                      <span style={{ fontSize: '0.75rem', background: "var(--input-bg)", color: "var(--accent)", padding: '1px 6px', borderRadius: '4px' }}>
                        Unit {col.unitNumber}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: "var(--text-secondary)" }}>
                        ({col.projectName})
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '3px' }}>
                      Milestone: <strong style={{ color: "var(--text-primary)" }}>{col.milestoneName}</strong> • Due: {new Date(col.dueDate).toLocaleDateString('en-IN')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: "var(--text-primary)" }}>
                        {formatINR(col.pendingAmount)}
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: col.isOverdue ? '#ef4444' : '#f59e0b' }}>
                        {col.isOverdue ? `${col.daysOverdue} days overdue` : 'Due soon'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleWhatsAppReminder(col)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: "var(--accent)",
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.78rem'
                      }}
                      title="Send payment reminder on WhatsApp"
                    >
                      <MessageSquare size={14} /> Remind
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. HOLDS EXPIRING SOON (OUR ADDITION) */}
        <section style={{
          background: 'var(--card-bg)',
          border: "1px solid var(--card-border)",
          borderRadius: '14px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="#f59e0b" />
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Holds expiring soon ({holds.length})
              </h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: "var(--text-secondary)" }}>
              48h auto-release protection active
            </span>
          </div>

          {holds.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: "var(--text-label)", fontSize: '0.85rem' }}>
              No units currently on hold.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {holds.map(h => (
                <div key={h.unitId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: "var(--input-bg)",
                  borderRadius: '8px',
                  border: '1px solid #f59e0b',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: "var(--text-primary)" }}>
                      Unit {h.unitCode} • {h.buildingTower}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)" }}>
                      Held for: <strong style={{ color: "var(--text-primary)" }}>{h.buyerName}</strong> {h.buyerPhone ? `(${h.buyerPhone})` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#f59e0b',
                      background: 'rgba(245, 158, 11, 0.1)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      ⏳ {formatCountdown(h.holdExpiresAt)}
                    </div>

                    <button
                      type="button"
                      onClick={() => onExtendHold(h.unitId, 24)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        background: "var(--input-bg)",
                        color: "var(--accent)",
                        border: "1px solid var(--card-border)",
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}
                    >
                      Extend +24h
                    </button>

                    <button
                      type="button"
                      onClick={() => onReleaseHold(h.unitId)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}
                    >
                      Release
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. LEAD FOLLOW-UP GROUPS (OVERDUE, DUE TODAY, COMING UP) */}
        <section style={{
          background: 'var(--card-bg)',
          border: "1px solid var(--card-border)",
          borderRadius: '14px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="var(--accent)" />
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Lead follow-up queue
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onSwitchScreen('leads')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: "var(--accent)",
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              View all leads <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Group A: Overdue */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#ef4444'
              }}>
                <span>OVERDUE ({leadGroups.overdue?.length || 0})</span>
              </div>

              {leadGroups.overdue?.length === 0 ? (
                <div style={{ padding: '8px 12px', color: "var(--text-label)", fontSize: '0.8rem' }}>No overdue follow-ups.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {leadGroups.overdue.map(lead => (
                    <LeadFollowupRow
                      key={lead.id}
                      lead={lead}
                      onSelectLead={onSelectLead}
                      onWhatsAppLead={handleWhatsAppLead}
                      getInitials={getInitials}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Group B: Due Today */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#f59e0b'
              }}>
                <span>DUE TODAY ({leadGroups.dueToday?.length || 0})</span>
              </div>

              {leadGroups.dueToday?.length === 0 ? (
                <div style={{ padding: '8px 12px', color: "var(--text-label)", fontSize: '0.8rem' }}>No follow-ups due today.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {leadGroups.dueToday.map(lead => (
                    <LeadFollowupRow
                      key={lead.id}
                      lead={lead}
                      onSelectLead={onSelectLead}
                      onWhatsAppLead={handleWhatsAppLead}
                      getInitials={getInitials}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Group C: Coming Up This Week */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: "var(--accent)"
              }}>
                <span>COMING UP THIS WEEK ({leadGroups.comingUp?.length || 0})</span>
              </div>

              {leadGroups.comingUp?.length === 0 ? (
                <div style={{ padding: '8px 12px', color: "var(--text-label)", fontSize: '0.8rem' }}>No upcoming follow-ups this week.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {leadGroups.comingUp.map(lead => (
                    <LeadFollowupRow
                      key={lead.id}
                      lead={lead}
                      onSelectLead={onSelectLead}
                      onWhatsAppLead={handleWhatsAppLead}
                      getInitials={getInitials}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

// ── REUSABLE LEAD FOLLOW-UP ROW ─────────────────────────────────────────────
function LeadFollowupRow({ lead, onSelectLead, onWhatsAppLead, getInitials }) {
  return (
    <div
      onClick={() => onSelectLead(lead)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: "var(--input-bg)",
        borderRadius: '8px',
        border: `1px solid ${lead.isOverdue ? '#ef4444' : '#334155'}`,
        cursor: 'pointer',
        flexWrap: 'wrap',
        gap: '10px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Initials Avatar */}
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: "var(--input-bg)",
          color: "var(--accent)",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '0.82rem',
          flexShrink: 0
        }}>
          {getInitials(lead.name)}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: "var(--text-primary)" }}>
              {lead.name}
            </span>
            <span style={{ fontSize: '0.72rem', background: "var(--input-bg)", color: "var(--accent)", padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
              {lead.projectName}
            </span>
            <span style={{ fontSize: '0.72rem', background: "var(--input-bg)", color: "var(--text-secondary)", padding: '1px 6px', borderRadius: '4px' }}>
              {lead.stage}
            </span>
          </div>

          <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '2px' }}>
            {lead.interest} • Source: <strong style={{ color: "var(--text-primary)" }}>{lead.source}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '0.75rem', background: "var(--input-bg)", color: "var(--text-primary)", padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
          Follow-up #{lead.followupCount}
        </span>

        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: lead.isOverdue ? '#ef4444' : '#f59e0b' }}>
          {lead.dueLabel}
        </span>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                background: "var(--input-bg)",
                color: "var(--accent)",
                textDecoration: 'none'
              }}
              title="Call Lead"
            >
              <Phone size={14} />
            </a>
          )}

          <button
            type="button"
            onClick={() => onWhatsAppLead(lead)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              background: "var(--accent)",
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Chat on WhatsApp"
          >
            <MessageSquare size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
