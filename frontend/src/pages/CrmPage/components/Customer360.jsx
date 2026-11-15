import React, { useState, useEffect } from 'react';
import {
  X, Phone, MessageSquare, Mail, Calendar, Plus, Shield,
  FileText, Check, ChevronLeft, ChevronRight, Eye, AlertCircle
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { formatShortINR, formatINR } from '../../../utils/money';

export default function Customer360({
  customer: customerProp,
  customer360Data,
  onClose,
  onBrowseCustomer,
  currentCustomerIndex = 1,
  totalCustomersCount = 1,
  onLinkPropertyInterest,
  onScheduleVisit
}) {
  const initialCustomer = customerProp?.customer || customerProp;
  const normalizedInitial = initialCustomer ? {
    ...initialCustomer,
    fullName: initialCustomer.fullName || initialCustomer.customerName || 'Customer',
    phone: initialCustomer.phone || initialCustomer.customerPhone || ''
  } : null;

  const [data, setData] = useState(() => {
    if (customer360Data?.customer) return customer360Data;
    if (normalizedInitial) {
      return {
        customer: normalizedInitial,
        interests: customerProp?.interests || [],
        bookings: customerProp?.bookings || [],
        activities: customerProp?.activities || [],
        siteVisits: customerProp?.siteVisits || [],
        tasks: customerProp?.tasks || []
      };
    }
    return null;
  });

  const [mobileTab, setMobileTab] = useState('activity'); // 'activity' | 'interests' | 'details'
  const [activityFilter, setActivityFilter] = useState('all');

  // Composer state
  const [composerType, setComposerType] = useState('Note'); // 'Note' | 'Email' | 'WhatsApp' | 'Call'
  const [composerText, setComposerText] = useState('');
  const [submittingActivity, setSubmittingActivity] = useState(false);

  // Sensitive reveal state
  const [revealedPan, setRevealedPan] = useState(null);
  const [revealedAadhaar, setRevealedAadhaar] = useState(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (customer360Data?.customer) {
      setData(customer360Data);
      return;
    }
    const target = customerProp?.customer || customerProp;
    if (!target) return;

    const cid = target.customerId || target._id || target.id;
    if (!cid) return;

    let isMounted = true;
    crmApi.getCustomer360(cid)
      .then(res => {
        if (isMounted && res && res.customer) {
          setData(res);
        }
      })
      .catch(err => {
        console.warn('Failed to fetch full customer 360 data:', err);
      });

    return () => { isMounted = false; };
  }, [customerProp, customer360Data]);

  useEffect(() => {
    setRevealedPan(null);
    setRevealedAadhaar(null);
}, [customerProp, customer360Data]);

if (!data?.customer) return null;

const { customer, interests = [], bookings = [], activities = [], siteVisits = [], tasks = [] } = data;

const handleComposerSubmit = async (e) => {
  e.preventDefault();
  if (!composerText.trim()) return;

  setSubmittingActivity(true);
  try {
    const res = await crmApi.addCustomerActivity(customer._id, {
      activityType: composerType,
      title: `${composerType} Logged`,
      description: composerText.trim()
    });

    // Update local activities feed
    setData(prev => ({
      ...prev,
      activities: [res, ...(prev.activities || [])]
    }));
    setComposerText('');
  } catch (err) {
    alert(err?.message || 'Failed to save activity log.');
  } finally {
    setSubmittingActivity(false);
  }
};

const handleRevealSensitive = async () => {
  setRevealing(true);
  try {
    const res = await crmApi.revealSensitiveFields(customer._id);
    setRevealedPan(res.panNumber || 'Not provided');
    setRevealedAadhaar(res.aadhaarNumber || 'Not provided');
  } catch (err) {
    alert(err?.message || 'Access denied: Requires administrator or sales manager privileges.');
  } finally {
    setRevealing(false);
  }
};

const cleanPhone = String(customer.phone || '').replace(/[^\d]/g, '');

const filteredActivities = activities.filter(act => {
  if (activityFilter === 'all') return true;
  if (activityFilter === 'notes') return act.activityType === 'Note';
  if (activityFilter === 'emails') return act.activityType === 'Email';
  if (activityFilter === 'texts') return act.activityType === 'WhatsApp' || act.activityType === 'SMS';
  if (activityFilter === 'calls') return act.activityType === 'Call';
  return true;
});

return (
  <div className="crm-modal-overlay" onClick={onClose}>
    <div className="crm-modal-container fullscreen" onClick={e => e.stopPropagation()}>
      {/* ── Top Dossier Bar ──────────────────────────────────────────────── */}
      <div className="crm-modal-header" style={{ padding: '0.65rem 1.25rem', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            👤 Clients &gt;
          </span>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {customer.fullName}
          </strong>
          <span className="crm-badge" style={{ background: 'rgba(255,255,255,0.08)', fontSize: '0.72rem' }}>
            {customer.customerCode}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {onBrowseCustomer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <button
                className="crm-btn-secondary"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => onBrowseCustomer(-1)}
                aria-label="Previous Customer"
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                {currentCustomerIndex} of {totalCustomersCount}
              </span>
              <button
                className="crm-btn-secondary"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => onBrowseCustomer(1)}
                aria-label="Next Customer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <button className="crm-modal-close-btn" onClick={onClose} aria-label="Close dossier">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── Mobile Tab Switcher Strip (Visible on mobile only) ────────────── */}
      <div className="crm-mobile-360-tabs">
        <button
          className={`crm-mobile-360-tab ${mobileTab === 'activity' ? 'active' : ''}`}
          onClick={() => setMobileTab('activity')}
        >
          Activity Stream ({activities.length})
        </button>
        <button
          className={`crm-mobile-360-tab ${mobileTab === 'interests' ? 'active' : ''}`}
          onClick={() => setMobileTab('interests')}
        >
          Interests &amp; Units ({interests.length})
        </button>
        <button
          className={`crm-mobile-360-tab ${mobileTab === 'details' ? 'active' : ''}`}
          onClick={() => setMobileTab('details')}
        >
          Profile &amp; KYC
        </button>
      </div>

      {/* ── Main Body ────────────────────────────────────────────────────── */}
      <div className="crm-modal-body" style={{ padding: '1rem 1.25rem', overflowY: 'auto' }}>
        <div className="crm-client-3col-wrapper">

          {/* ══════════════════════════════════════════════════════════════════
               COLUMN 1: IDENTITY, CONTACT & SECURE KYC FIELDS
               ══════════════════════════════════════════════════════════════════ */}
          <div className={`crm-col-identity ${mobileTab !== 'details' ? 'hide-on-mobile' : ''}`}>
            <div className="crm-client-avatar-row">
              <div className="crm-client-avatar-circle">
                {customer.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CU'}
              </div>
              <div>
                <div className="crm-client-name-title">{customer.fullName}</div>
                <div className="crm-client-comm-tag">
                  Rep: {customer.assignedSalespersonName || 'Sales Team'}
                </div>
              </div>
            </div>

            {/* Direct Communication Strip */}
            <div className="crm-client-contact-list">
              <div className="crm-client-contact-item">
                <Phone size={15} style={{ color: 'var(--accent)' }} />
                <a href={`tel:${customer.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                  {customer.phone}
                </a>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-label)', marginLeft: 'auto' }}>(primary)</span>
              </div>
              {customer.email && (
                <div className="crm-client-contact-item">
                  <Mail size={15} style={{ color: 'var(--text-secondary)' }} />
                  <a href={`mailto:${customer.email}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.address && (
                <div className="crm-client-contact-item" style={{ color: 'var(--text-secondary)' }}>
                  <span>🏠</span>
                  <span>{customer.address}{customer.city ? `, ${customer.city}` : ''}</span>
                </div>
              )}
            </div>

            {/* Secure Identity & KYC Section */}
            <div className="crm-client-section-card">
              <div className="crm-client-section-heading">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Shield size={14} style={{ color: 'var(--accent)' }} /> Secure Identity &amp; KYC
                </span>
                <button
                  className="crm-btn-secondary"
                  style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem', gap: '0.25rem' }}
                  onClick={handleRevealSensitive}
                  disabled={revealing}
                  title="Reveal PAN & Aadhaar (Audited)"
                >
                  <Eye size={12} /> {revealing ? '...' : (revealedPan ? 'Hide' : 'Reveal')}
                </button>
              </div>

              <div className="crm-client-details-grid" style={{ marginTop: '0.5rem' }}>
                <div className="crm-client-detail-row">
                  <span>PAN Card</span>
                  <strong>{revealedPan || customer.maskedPan || '•••• ••••'}</strong>
                </div>
                <div className="crm-client-detail-row">
                  <span>Aadhaar</span>
                  <strong>{revealedAadhaar || customer.maskedAadhaar || (customer.aadhaarLast4 ? `•••• •••• ${customer.aadhaarLast4}` : '•••• ••••')}</strong>
                </div>
                <div className="crm-client-detail-row">
                  <span>Customer ID</span>
                  <span>{customer.customerCode}</span>
                </div>
              </div>
            </div>

            {/* Buying Preferences */}
            <div className="crm-client-section-card">
              <div className="crm-client-section-heading">
                <span>Buying Capacity</span>
              </div>
              <div className="crm-client-details-grid" style={{ marginTop: '0.5rem' }}>
                <div className="crm-client-detail-row">
                  <span>Max Budget</span>
                  <strong style={{ color: '#34d399' }}>{formatShortINR(customer.budgetMax || 0)}</strong>
                </div>
                <div className="crm-client-detail-row">
                  <span>Preferred Type</span>
                  <span>{customer.preferredPropertyType || '2BHK'}</span>
                </div>
                <div className="crm-client-detail-row">
                  <span>Lead Source</span>
                  <span>{customer.leadSource || 'Direct Walk-in'}</span>
                </div>
              </div>
            </div>

            {customer.notes && (
              <div className="crm-client-section-card">
                <div className="crm-client-section-heading">
                  <span>Background Notes</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '0.4rem', margin: 0 }}>
                  {customer.notes}
                </p>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
               COLUMN 2: LIVE ACTIVITY COMPOSER & THREADED FEED
               ══════════════════════════════════════════════════════════════════ */}
          <div className={`crm-col-center ${mobileTab !== 'activity' ? 'hide-on-mobile' : ''}`}>
            {/* Activity Composer Box */}
            <form onSubmit={handleComposerSubmit} className="crm-composer-card">
              <div className="crm-composer-nav">
                <button
                  type="button"
                  className={`crm-composer-btn ${composerType === 'Note' ? 'active' : ''}`}
                  onClick={() => setComposerType('Note')}
                >
                  📝 Note
                </button>
                <button
                  type="button"
                  className={`crm-composer-btn ${composerType === 'Call' ? 'active' : ''}`}
                  onClick={() => setComposerType('Call')}
                >
                  📞 Log Call
                </button>
                <button
                  type="button"
                  className={`crm-composer-btn ${composerType === 'WhatsApp' ? 'active' : ''}`}
                  onClick={() => setComposerType('WhatsApp')}
                >
                  💬 WhatsApp
                </button>
                <button
                  type="button"
                  className={`crm-composer-btn ${composerType === 'Email' ? 'active' : ''}`}
                  onClick={() => setComposerType('Email')}
                >
                  ✉️ Email
                </button>
              </div>

              <textarea
                rows={3}
                className="crm-composer-textarea"
                placeholder={
                  composerType === 'Note'
                    ? 'Add internal note or mention team members...'
                    : composerType === 'Call'
                      ? 'Log phone discussion, objections, and agreed next steps...'
                      : composerType === 'WhatsApp'
                        ? 'Log WhatsApp message or share quote...'
                        : 'Compose client email note...'
                }
                value={composerText}
                onChange={e => setComposerText(e.target.value)}
              />

              <div className="crm-composer-footer">
                <span style={{ fontSize: '0.72rem', color: 'var(--text-label)' }}>
                  Auto-saved to chronological audit trail
                </span>
                <button
                  type="submit"
                  className="crm-btn-primary"
                  disabled={submittingActivity || !composerText.trim()}
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                >
                  {submittingActivity ? 'Saving...' : `Log ${composerType}`}
                </button>
              </div>
            </form>

            {/* Feed Filter Bar */}
            <div className="crm-activity-filter-bar">
              <button
                className={`crm-activity-filter-pill ${activityFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActivityFilter('all')}
              >
                All ({activities.length})
              </button>
              <button
                className={`crm-activity-filter-pill ${activityFilter === 'notes' ? 'active' : ''}`}
                onClick={() => setActivityFilter('notes')}
              >
                📝 Notes ({activities.filter(a => a.activityType === 'Note').length})
              </button>
              <button
                className={`crm-activity-filter-pill ${activityFilter === 'calls' ? 'active' : ''}`}
                onClick={() => setActivityFilter('calls')}
              >
                📞 Calls ({activities.filter(a => a.activityType === 'Call').length})
              </button>
              <button
                className={`crm-activity-filter-pill ${activityFilter === 'texts' ? 'active' : ''}`}
                onClick={() => setActivityFilter('texts')}
              >
                💬 Texts ({activities.filter(a => a.activityType === 'WhatsApp' || a.activityType === 'SMS').length})
              </button>
            </div>

            {/* Feed List */}
            <div className="crm-feed-stream">
              {filteredActivities.length === 0 ? (
                <div className="crm-empty-state" style={{ padding: '2.5rem 1rem' }}>
                  <p>No activity entries found for this filter.</p>
                </div>
              ) : (
                filteredActivities.map((act, idx) => (
                  <div key={idx} className="crm-feed-card">
                    <div className={`crm-feed-icon-circle ${act.activityType?.toLowerCase() || 'note'}`}>
                      {act.activityType === 'Call' ? '📞' : act.activityType === 'WhatsApp' ? '💬' : act.activityType === 'Email' ? '✉️' : '📝'}
                    </div>
                    <div className="crm-feed-content">
                      <div className="crm-feed-top">
                        <div>
                          <span className="crm-feed-author">{act.performedByName || 'Sales Rep'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-label)', marginLeft: '0.5rem' }}>
                            {act.activityType} • {act.title}
                          </span>
                        </div>
                        <span className="crm-feed-date">
                          {new Date(act.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="crm-feed-body">
                        {act.description}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
               COLUMN 3: PROPERTY INTERESTS, UNITS WIDGET & AGENT SYNC
               ══════════════════════════════════════════════════════════════════ */}
          <div className={`crm-col-widgets ${mobileTab !== 'interests' ? 'hide-on-mobile' : ''}`}>
            {/* Linked Property Interests Widget */}
            <div className="crm-widget-card">
              <div className="crm-widget-header">
                <div className="crm-widget-title">
                  🏢 Property Interests ({interests.length})
                </div>
                {onLinkPropertyInterest && (
                  <button
                    className="crm-btn-secondary"
                    style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={() => onLinkPropertyInterest(customer._id)}
                  >
                    <Plus size={12} /> Link Unit
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {interests.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-label)', padding: '0.5rem 0' }}>
                    No properties linked yet.
                  </div>
                ) : (
                  interests.map(item => (
                    <div key={item._id} className="crm-interest-card-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
                          {item.unitCode || 'General Interest'}
                        </strong>
                        <span className={`crm-badge crm-badge-stage-${(item.stage || 'new').toLowerCase().replace(/\s+/g, '')}`}>
                          {item.stage}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {item.projectName}
                      </div>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Budget:</span>
                        <strong style={{ color: '#34d399' }}>{formatShortINR(item.budget || 0)}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bookings & Contract Summary */}
            {bookings.length > 0 && (
              <div className="crm-widget-card">
                <div className="crm-widget-header">
                  <div className="crm-widget-title">
                    📄 Confirmed Bookings ({bookings.length})
                  </div>
                </div>
                {bookings.map(b => (
                  <div key={b._id} className="crm-interest-card-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: 'var(--accent)' }}>{b.bookingReference}</strong>
                      <span className="crm-badge" style={{ background: '#34d399', color: '#064e3b' }}>
                        {b.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Unit {b.unitCode} • {formatINR(b.netBookingValue || b.agreementPrice)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Site Visits Widget */}
            <div className="crm-widget-card">
              <div className="crm-widget-header">
                <div className="crm-widget-title">
                  📍 Site Walkthroughs ({siteVisits.length})
                </div>
                {onScheduleVisit && (
                  <button
                    className="crm-btn-secondary"
                    style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={() => onScheduleVisit(customer._id)}
                  >
                    <Plus size={12} /> Schedule
                  </button>
                )}
              </div>
              {siteVisits.length === 0 ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-label)' }}>No visits logged</span>
              ) : (
                siteVisits.slice(0, 3).map(v => (
                  <div key={v._id} style={{ fontSize: '0.78rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.4rem' }}>
                    <div style={{ fontWeight: 600 }}>{v.projectName}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{new Date(v.visitDateTime).toLocaleDateString()} • {v.status}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Sticky Mobile Action Bar (Call & WhatsApp) ─────────────────────── */}
      <div className="crm-mobile-sticky-action-bar">
        <a
          href={`tel:${customer.phone}`}
          className="crm-mobile-call-btn"
          aria-label={`Call ${customer.fullName}`}
        >
          <Phone size={18} /> Call Buyer
        </a>
        <a
          href={`https://wa.me/${cleanPhone}`}
          target="_blank"
          rel="noreferrer"
          className="crm-mobile-wa-btn"
          aria-label={`WhatsApp ${customer.fullName}`}
        >
          <MessageSquare size={18} /> WhatsApp
        </a>
      </div>
    </div>
  </div>
);
}

