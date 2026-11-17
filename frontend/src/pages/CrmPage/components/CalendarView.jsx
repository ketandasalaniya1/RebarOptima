import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus,
  Download, Filter, Clock, MapPin, User, CheckCircle2, Star,
  X, AlertCircle, Building, DollarSign
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { formatINR } from '../../../utils/money';
import { Input, Select, Textarea } from '../../../components/ui';

export default function CalendarView({
  projects = [],
  leads = [],
  onOpenNewAppointment,
  onRefreshData
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('week'); // 'month' | 'week' | 'day' | 'agenda'
  const [currentDate, setCurrentDate] = useState(new Date());

  // Layer filters
  const [layers, setLayers] = useState({
    site_visits: true,
    appointments: true,
    tasks: true,
    followups: true,
    collections: true,
    hold_expiries: true
  });

  // Selected event drawer & Post-visit feedback modal
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackAppt, setFeedbackAppt] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackNextStep, setFeedbackNextStep] = useState('Send official price quote');
  const [advanceStageTo, setAdvanceStageTo] = useState('Negotiation');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Fetch calendar events
  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getCalendarEvents();
      setEvents(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Failed to load calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Toggle layer
  const toggleLayer = (layerKey) => {
    setLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Date Navigation
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Compute Week Dates
  const weekDates = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay(); // 0 is Sunday
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(curr.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Filter events by layer
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (e.stream === 'site_visits' && !layers.site_visits) return false;
      if (e.stream === 'appointments' && !layers.appointments) return false;
      if (e.stream === 'tasks' && !layers.tasks) return false;
      if (e.stream === 'followups' && !layers.followups) return false;
      if (e.stream === 'collections' && !layers.collections) return false;
      if (e.stream === 'hold_expiries' && !layers.hold_expiries) return false;
      return true;
    });
  }, [events, layers]);

  // Export iCalendar (.ics)
  const handleExportIcs = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//RebarOptima Real Estate CRM//EN\n";

    filteredEvents.forEach(e => {
      const start = new Date(e.start || Date.now()).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const end = new Date(e.end || e.start || Date.now()).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `SUMMARY:${e.title || 'CRM Event'}\n`;
      icsContent += `DTSTART:${start}\n`;
      icsContent += `DTEND:${end}\n`;
      icsContent += `DESCRIPTION:${e.customerName ? 'Customer: ' + e.customerName : ''}\n`;
      icsContent += `LOCATION:${e.location || 'Site Office'}\n`;
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `crm-calendar-${new Date().toISOString().split('T')[0]}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit Feedback
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackAppt) return;
    setSubmittingFeedback(true);
    try {
      await crmApi.submitAppointmentFeedback(feedbackAppt.id, {
        outcomeNotes: feedbackNotes.trim(),
        rating: feedbackRating,
        nextStep: feedbackNextStep,
        advanceStageTo
      });
      setShowFeedbackModal(false);
      loadEvents();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert('Failed to log feedback: ' + err.message);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const getEventBadgeColor = (e) => {
    switch (e.type) {
      case 'site_visit':
        return '#8b5cf6'; // Purple
      case 'meeting':
        return '#f59e0b'; // Amber
      case 'call':
        return '#10b981'; // Green
      case 'registration':
        return '#ec4899'; // Pink
      case 'handover':
        return '#06b6d4'; // Cyan
      case 'collection':
        return '#059669'; // Emerald
      case 'hold_expiry':
        return '#eab308'; // Gold
      case 'task':
        return '#3b82f6'; // Blue
      default:
        return '#64748b';
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '20px 16px' }}>
      {/* ── TOP HEADER: CONTROLS & VIEWS ───────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        marginBottom: '18px'
      }}>
        {/* Left: Month/Year Title & Today/Prev/Next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: "var(--text-primary)" }}>
            {viewMode === 'month'
              ? currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
              : `Week of ${weekDates[0].toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '8px' }}>
            <button
              type="button"
              onClick={handlePrev}
              style={{ background: 'none', border: 'none', color: "var(--text-secondary)", padding: '6px 8px', cursor: 'pointer' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleToday}
              style={{ background: 'none', border: 'none', color: "var(--text-primary)", padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', borderLeft: '1px solid var(--card-border)', borderRight: '1px solid var(--card-border)' }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{ background: 'none', border: 'none', color: "var(--text-secondary)", padding: '6px 8px', cursor: 'pointer' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Right: View Mode + Export .ics + New Appointment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: "var(--input-bg)", padding: '3px', borderRadius: '8px', border: "1px solid var(--card-border)" }}>
            {['month', 'week', 'day', 'agenda'].map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === mode ? 'var(--accent)' : 'transparent',
                  color: viewMode === mode ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textTransform: 'capitalize',
                  cursor: 'pointer'
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportIcs}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: "var(--input-bg)",
              border: "1px solid var(--card-border)",
              color: "var(--text-primary)",
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Download .ics Calendar file"
          >
            <Download size={14} /> Export (.ics)
          </button>

          <button
            type="button"
            onClick={onOpenNewAppointment}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: "var(--accent)", color: "var(--accent-contrast)",
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} /> New Appointment
          </button>
        </div>
      </div>

      {/* ── LAYER CHECKBOXES BAR ───────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        background: "var(--input-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: '10px',
        padding: '8px 14px',
        marginBottom: '20px',
        overflowX: 'auto'
      }}>
        <span style={{ fontSize: '0.75rem', color: "var(--text-secondary)", fontWeight: 700, textTransform: "none", whiteSpace: 'nowrap' }}>
          Layers:
        </span>

        {[
          { key: 'site_visits', label: 'Site Visits', color: '#8b5cf6' },
          { key: 'appointments', label: 'Meetings & Calls', color: 'var(--warning-text)' },
          { key: 'tasks', label: 'Tasks', color: 'var(--info-text)' },
          { key: 'followups', label: 'Follow-ups', color: "var(--accent)" },
          { key: 'collections', label: 'Collection Dues', color: 'var(--accent-text)' },
          { key: 'hold_expiries', label: 'Hold Expiries', color: 'var(--warning-text)' }
        ].map(l => (
          <label key={l.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
            <Input
              type="checkbox"
              checked={layers[l.key]}
              onChange={() => toggleLayer(l.key)}
              style={{ accentColor: l.color }}
            />
            <span style={{ color: layers[l.key] ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>
              {l.label}
            </span>
          </label>
        ))}
      </div>

      {/* ── WEEK VIEW (HOURLY GRID & ALL-DAY STRIP) ────────────────────── */}
      {viewMode === 'week' && (
        <div style={{
          background: "var(--input-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          {/* Days Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px repeat(7, 1fr)',
            borderBottom: '1px solid var(--card-border)',
            background: "var(--card-bg)"
          }}>
            <div style={{ padding: '10px 6px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Time</div>
            {weekDates.map(date => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={date.toISOString()}
                  style={{
                    padding: '10px',
                    textAlign: 'center',
                    borderLeft: '1px solid var(--card-border)',
                    background: isToday ? 'var(--info-subtle)' : 'transparent'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", textTransform: "none" }}>
                    {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                  </div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: isToday ? 'var(--info-text)' : 'var(--text-primary)',
                    marginTop: '2px'
                  }}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hourly Body */}
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(hour => {
              const timeStr = `${hour.toString().padStart(2, '0')}:00`;
              return (
                <div
                  key={hour}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px repeat(7, 1fr)',
                    borderBottom: '1px solid var(--card-border)',
                    minHeight: '52px'
                  }}
                >
                  <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    textAlign: 'center',
                    paddingTop: '6px',
                    background: "var(--card-bg)"
                  }}>
                    {timeStr}
                  </div>

                  {weekDates.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const dayEvents = filteredEvents.filter(e => {
                      if (!e.start) return false;
                      const eDate = new Date(e.start);
                      return eDate.toISOString().split('T')[0] === dateStr && eDate.getHours() === hour;
                    });

                    return (
                      <div
                        key={dateStr}
                        style={{
                          borderLeft: '1px solid var(--card-border)',
                          padding: '3px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px'
                        }}
                      >
                        {dayEvents.map(evt => (
                          <div
                            key={evt.id}
                            onClick={() => {
                              setSelectedEvent(evt);
                              if (evt.type === 'site_visit') {
                                setFeedbackAppt(evt);
                                setShowFeedbackModal(true);
                              }
                            }}
                            style={{
                              background: getEventBadgeColor(evt),
                              color: 'var(--text-primary)',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={evt.title}
                          >
                            {evt.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AGENDA VIEW ────────────────────────────────────────────────── */}
      {(viewMode === 'agenda' || viewMode === 'month' || viewMode === 'day') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredEvents.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No events found for this filter.
            </div>
          ) : (
            filteredEvents.map(evt => (
              <div
                key={evt.id}
                onClick={() => {
                  setSelectedEvent(evt);
                  if (evt.type === 'site_visit') {
                    setFeedbackAppt(evt);
                    setShowFeedbackModal(true);
                  }
                }}
                style={{
                  background: "var(--input-bg)",
                  border: `1px solid ${getEventBadgeColor(evt)}`,
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%', background: getEventBadgeColor(evt)
                  }} />
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: "var(--text-primary)" }}>
                      {evt.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)", marginTop: '2px' }}>
                      {evt.customerName && <span>👤 {evt.customerName} • </span>}
                      {evt.location && <span>📍 {evt.location} • </span>}
                      <span>{new Date(evt.start).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {evt.type === 'site_visit' && (
                    <span style={{ fontSize: '0.75rem', background: 'var(--accent)', color: 'var(--accent-contrast)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                      Log Feedback
                    </span>
                  )}
                  {evt.amount && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-text)' }}>
                      {formatINR(evt.amount)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── POST-SITE VISIT FEEDBACK MODAL ─────────────────────────────── */}
      {showFeedbackModal && feedbackAppt && (
        <div className="crm-modal-backdrop" onClick={() => setShowFeedbackModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', width: '100%', maxWidth: '460px', padding: '24px', color: "var(--text-primary)"
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="var(--accent-text)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Site Visit Completed</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: "var(--text-secondary)" }}>
              Walkthrough completed with <strong style={{ color: "var(--text-primary)" }}>{feedbackAppt.customerName || 'Prospect'}</strong>. Record buyer reaction and next sales step:
            </p>

            <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Star Rating */}
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Client Interest Rating
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        color: star <= feedbackRating ? 'var(--warning-text)' : 'var(--text-secondary)'
                      }}
                    >
                      <Star size={24} fill={star <= feedbackRating ? 'var(--warning-text)' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback notes */}
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Client Reaction & Discussion Points *
                </label>
                <Textarea
                  required
                  rows={3}
                  placeholder="e.g. Loved the living room layout & balcony view. Concerned about 5th floor delivery timeline."
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', color: "var(--text-primary)", fontSize: '0.84rem', resize: 'none' }}
                />
              </div>

              {/* Next Step */}
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Next Step Action
                </label>
                <Select
                  value={feedbackNextStep}
                  onChange={(e) => setFeedbackNextStep(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', color: "var(--text-primary)", fontSize: '0.84rem' }}
                >
                  <option value="Send official price quote">Send official price quote</option>
                  <option value="Coordinate 48h unit hold">Coordinate 48h unit hold</option>
                  <option value="Follow-up call in 2 days">Follow-up call in 2 days</option>
                  <option value="Schedule family repeat visit">Schedule family repeat visit</option>
                  <option value="Check home loan eligibility">Check home loan eligibility</option>
                </Select>
              </div>

              {/* Advance Stage */}
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Advance Pipeline Stage To
                </label>
                <Select
                  value={advanceStageTo}
                  onChange={(e) => setAdvanceStageTo(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', color: "var(--text-primary)", fontSize: '0.84rem' }}
                >
                  <option value="Negotiation">Negotiation (Hot Prospect)</option>
                  <option value="Visited">Visited (Evaluating Options)</option>
                  <option value="On Hold">Hold (Blocking Unit)</option>
                </Select>
              </div>

              <button
                type="submit"
                disabled={submittingFeedback}
                style={{
                  marginTop: '6px',
                  padding: '11px',
                  borderRadius: '8px',
                  background: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                {submittingFeedback ? 'Logging Feedback...' : 'Complete Visit & Advance Pipeline'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

