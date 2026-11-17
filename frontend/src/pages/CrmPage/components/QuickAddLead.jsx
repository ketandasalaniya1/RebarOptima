import React, { useState, useEffect, useRef } from 'react';
import { X, Users, AlertTriangle, ExternalLink, Camera, Loader2, Check, Tag, Calendar, DollarSign, Home, Phone } from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { Input, Select } from '../../../components/ui';

export default function QuickAddLead({
  projects = [],
  selectedProjectId,
  onClose,
  onLeadCreated,
  onOpenCustomer360
}) {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    projectId: selectedProjectId || (projects[0]?._id || ''),
    stage: 'New enquiry',
    preferredPropertyType: '2BHK',
    budgetMax: '',
    leadSource: 'Direct Walk-in',
    nextFollowUpDate: new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16),
    purpose: 'self_use',
    loanNeeded: false,
    preferredFloor: '',
    preferredFacing: '',
    tags: 'Hot, High Intent',
    notes: ''
  });

  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [cardPhoto, setCardPhoto] = useState(null);

  const debounceTimerRef = useRef(null);

  // Debounced live duplicate check on phone change
  useEffect(() => {
      const rawDigits = formData.phone.replace(/[^\d]/g, '');
      if (rawDigits.length < 7) {
        setDuplicateMatch(null);
        return;
      }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        setCheckingDuplicate(true);
        try {
          const res = await crmApi.checkDuplicate({ phone: formData.phone });
          if (res.isDuplicate && res.existingCustomerSummary) {
            setDuplicateMatch(res.existingCustomerSummary);
          } else {
            setDuplicateMatch(null);
          }
        } catch (err) {
          console.warn('Duplicate check error:', err);
        } finally {
          setCheckingDuplicate(false);
        }
      }, 350);

      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      };
    }, [formData.phone]);

  const handleCardPhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setCardPhoto(uploadEvent.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickBudget = (amount) => {
    setFormData(prev => ({ ...prev, budgetMax: String(amount) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim()) {
      setError('Please provide full name and contact phone number.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const budgetNum = formData.budgetMax ? Number(formData.budgetMax) : 0;
      const tagsArray = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      const payload = {
        name: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email ? formData.email.trim() : undefined,
        leadSource: formData.leadSource,
        projectId: formData.projectId || undefined,
        stage: formData.stage,
        interestedIn: formData.preferredPropertyType,
        budget: budgetNum,
        nextFollowUpDate: formData.nextFollowUpDate ? new Date(formData.nextFollowUpDate).toISOString() : new Date().toISOString(),
        purpose: formData.purpose,
        loan_needed: formData.loanNeeded,
        preferred_floor: formData.preferredFloor.trim(),
        preferred_facing: formData.preferredFacing.trim(),
        tags: tagsArray,
        notes: formData.notes.trim()
      };

      const created = await crmApi.createLead(payload);
      if (onLeadCreated) onLeadCreated(created);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create lead profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
            <div className="crm-modal-overlay" onClick={onClose} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
            }}>
              <div className="crm-modal-container" onClick={e => e.stopPropagation()} style={{
                background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', color: "var(--text-primary)", boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
              }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: "1px solid var(--card-border)", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1.05rem' }}>
                    <Users size={18} color="var(--accent)" />
                    <span>Add New Lead</span>
                  </div>
                  <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>

                    {/* Scrollable Form Body */}
                    <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {error && (
                        <div style={{ background: 'var(--danger-subtle)', border: '1px solid var(--danger)', color: 'var(--danger-text)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertTriangle size={16} /> {error}
                        </div>
                      )}

                              {/* Duplicate Collision Warning */}
                              {duplicateMatch && (
                                <div style={{ background: 'var(--warning-subtle)', border: '1px solid var(--warning)', color: '#fde68a', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                                    <AlertTriangle size={18} color="var(--warning-text)" style={{ flexShrink: 0 }} />
                                    <div>
                                      <strong>Already registered:</strong> {duplicateMatch.fullName} ({duplicateMatch.customerCode})
                                      <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)" }}>
                                        Phone: {duplicateMatch.phone} • Assigned: {duplicateMatch.assignedSalespersonName || 'Sales Team'}
                                      </div>
                                    </div>
                                  </div>
                                  {onOpenCustomer360 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClose();
                                        onOpenCustomer360(duplicateMatch.customerId);
                                      }}
                                      style={{ background: "var(--input-bg)", border: 'none', color: "var(--text-primary)", padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      View <ExternalLink size={12} />
                                    </button>
              )}
                            </div>
          )}

                                {/* 1. Basic Details */}
                                <div>
                                  <div style={{ fontSize: '0.76rem', color: "var(--accent)", fontWeight: 700, textTransform: "none", marginBottom: '8px', letterSpacing: '0.5px' }}>
                                    1. Contact & Lead Source
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                                    <div>
                                      <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Full Name *</label>
                                      <Input
                                        type="text"
                                        required
                                        placeholder="e.g. Vikramaditya Singhania"
                                        value={formData.fullName}
                                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                        style={{ width: '100%', padding: '8px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                      />
                                    </div>

                                        <div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)" }}>WhatsApp / Mobile *</label>
                                            {checkingDuplicate && (
                    <span style={{ fontSize: '0.7rem', color: "var(--accent)", display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Loader2 size={10} className="spin" /> Checking...
                    </span>
                  )}
                </div>
                <Input
                  type="tel"
                  required
                  placeholder="e.g. +91 98201 23456"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                />
              </div>

                                            <div>
                                              <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Email Address</label>
                                              <Input
                                                type="email"
                                                placeholder="vikram@example.com"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                style={{ width: '100%', padding: '8px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                              />
                                            </div>

                                            <div>
                                              <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Lead Source</label>
                                              <Select
                                                value={formData.leadSource}
                                                onChange={e => setFormData({ ...formData, leadSource: e.target.value })}
                                                style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                              >
                                                <option value="Direct Walk-in">Direct Walk-in</option>
                                                <option value="Website">Website Form</option>
                                                <option value="Channel Partner">Channel Partner (Broker)</option>
                                                <option value="Referral">Client Referral</option>
                                                <option value="Social Media">Social Media Ad (Meta/Google)</option>
                                                <option value="Portal: 99acres">Portal: 99acres</option>
                                                <option value="Portal: MagicBricks">Portal: MagicBricks</option>
                                                <option value="Site Hoarding">Site Billboard / Hoarding</option>
                                              </Select>
                                            </div>
                                          </div>
                                        </div>

                                        {/* 2. Property & Typology Requirements */}
                                        <div>
                                          <div style={{ fontSize: '0.76rem', color: "var(--accent)", fontWeight: 700, textTransform: "none", marginBottom: '8px', letterSpacing: '0.5px' }}>
                                            2. Property &amp; Budget Requirements
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                                            <div>
                                              <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Project *</label>
                                              <Select
                                                value={formData.projectId}
                                                onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                                                style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                              >
                                                <option value="">Select Project</option>
                                                {projects.map(p => (
                                                  <option key={p._id || p.id} value={p._id || p.id}>
                                                    {p.name}
                                                  </option>
                                                ))}
                                              </Select>
                                            </div>

                                              <div>
                                                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Initial Stage</label>
                                                <Select
                                                  value={formData.stage}
                                                  onChange={e => setFormData({ ...formData, stage: e.target.value })}
                                                  style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                                >
                                                  <option value="New enquiry">New enquiry</option>
                                                  <option value="Contacted">Contacted</option>
                                                  <option value="Site visit">Site visit</option>
                                                  <option value="Negotiation">Negotiation</option>
                                                </Select>
                                              </div>

                                              <div>
                                                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Interested In (Typology)</label>
                                                <Select
                                                  value={formData.preferredPropertyType}
                                                  onChange={e => setFormData({ ...formData, preferredPropertyType: e.target.value })}
                                                  style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                                >
                                                  <option value="1BHK">1 BHK Apartment</option>
                                                  <option value="2BHK">2 BHK Apartment</option>
                                                  <option value="3BHK">3 BHK Premium</option>
                                                  <option value="4BHK">4 BHK Luxury</option>
                                                  <option value="Penthouse">Sky Penthouse</option>
                                                  <option value="Plot">Residential Villa Plot</option>
                                                  <option value="Commercial">Commercial / Retail Office</option>
                                                </Select>
                                              </div>

                                                <div>
                                                  <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Budget (INR)</label>
                                                  <Input
                                                    type="number"
                                                    placeholder="e.g. 12500000 (1.25 Cr)"
                                                    value={formData.budgetMax}
                                                    onChange={e => setFormData({ ...formData, budgetMax: e.target.value })}
                                                    style={{ width: '100%', padding: '8px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                                  />
                                                  {/* Budget Quick Chips */}
                                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                                                    {[
                                                      { label: '50L', val: 5000000 },
                                                      { label: '75L', val: 7500000 },
                                                      { label: '1 Cr', val: 10000000 },
                                                      { label: '1.5 Cr', val: 15000000 },
                                                      { label: '2.5 Cr+', val: 25000000 }
                                                    ].map(b => (
                                                      <button
                                                        key={b.label}
                                                        type="button"
                                                        onClick={() => handleQuickBudget(b.val)}
                                                        style={{
                                                          padding: '2px 8px',
                                                          background: "var(--input-bg)",
                                                          border: 'none',
                                                          borderRadius: '4px',
                                                          color: "var(--text-secondary)",
                                                          fontSize: '0.7rem',
                                                          cursor: 'pointer'
                                                        }}
                                                      >
                                                        {b.label}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                                  {/* 3. Buying Intent & Preferences */}
                                                  <div>
                                                    <div style={{ fontSize: '0.76rem', color: "var(--accent)", fontWeight: 700, textTransform: "none", marginBottom: '8px', letterSpacing: '0.5px' }}>
                                                      3. Intent &amp; Next Follow-up
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                                                      <div>
                                                        <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Purpose</label>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer' }}>
                                                            <Input
                                                              type="radio"
                                                              name="purpose"
                                                              value="self_use"
                                                              checked={formData.purpose === 'self_use'}
                                                              onChange={() => setFormData({ ...formData, purpose: 'self_use' })}
                                                            />
                                                            Self-use
                                                          </label>
                                                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer' }}>
                                                            <Input
                                                              type="radio"
                                                              name="purpose"
                                                              value="investment"
                                                              checked={formData.purpose === 'investment'}
                                                              onChange={() => setFormData({ ...formData, purpose: 'investment' })}
                                                            />
                                                            Investment / ROI
                                                          </label>
                                                        </div>
                                                      </div>

                                                      <div>
                                                        <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Bank Loan Required?</label>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', cursor: 'pointer' }}>
                                                          <Input
                                                            type="checkbox"
                                                            checked={formData.loanNeeded}
                                                            onChange={e => setFormData({ ...formData, loanNeeded: e.target.checked })}
                                                          />
                                                          <span>Yes, requires Home Loan assistance</span>
                                                        </label>
                                                      </div>

                                                      <div>
                                                        <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Next Follow-up Date *</label>
                                                        <Input
                                                          type="datetime-local"
                                                          required
                                                          value={formData.nextFollowUpDate}
                                                          onChange={e => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                                                          style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                                        />
                                                      </div>

                                                      <div>
                                                        <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Preferred Floor / Facing</label>
                                                        <Input
                                                          type="text"
                                                          placeholder="e.g. Higher floor, East facing, Vastu"
                                                          value={formData.preferredFloor}
                                                          onChange={e => setFormData({ ...formData, preferredFloor: e.target.value })}
                                                          style={{ width: '100%', padding: '8px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                                        />
                                                      </div>

                                                      <div>
                                                        <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Tags (comma-separated)</label>
                                                        <Input
                                                          type="text"
                                                          placeholder="Hot, Investor, Ready to visit"
                                                          value={formData.tags}
                                                          onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                                          style={{ width: '100%', padding: '8px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                                        />
                                                      </div>

                                                      <div>
                                                        <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Notes / Context</label>
                                                        <Input
                                                          type="text"
                                                          placeholder="Looking for possession by Diwali, visits on weekends"
                                                          value={formData.notes}
                                                          onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                                          style={{ width: '100%', padding: '8px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.85rem' }}
                                                        />
                                                      </div>
                                                    </div>
                                                  </div>

                                                      {/* 4. Visiting Card Upload */}
                                                      <div style={{ background: "var(--input-bg)", padding: '12px 14px', borderRadius: '8px', border: '1px dashed var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                                        <div>
                                                          <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Attach Visiting Card / Brochure Note</div>
                                                          <div style={{ fontSize: '0.72rem', color: "var(--text-secondary)" }}>Camera snap or gallery upload for on-site visit records</div>
                                                        </div>
                                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: "var(--input-bg)", color: "var(--text-primary)", borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                                                          <Camera size={14} /> Snap Card
                                                          <Input
                                                            type="file"
                                                            accept="image/*"
                                                            capture="environment"
                                                            style={{ display: 'none' }}
                                                            onChange={handleCardPhotoUpload}
                                                          />
                                                        </label>
                                                        {cardPhoto && (
                                                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <Check size={14} /> Attached
                                                          </span>
                                                        )}
                                                      </div>

                                                      {/* Footer Submit */}
                                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: "1px solid var(--card-border)" }}>
                                                        <button
                                                          type="button"
                                                          onClick={onClose}
                                                          style={{ padding: '8px 16px', background: "var(--input-bg)", border: 'none', borderRadius: '8px', color: "var(--text-primary)", cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                                                        >
                                                          Cancel
                                                        </button>
                                                        <button
                                                          type="submit"
                                                          disabled={submitting || !formData.fullName.trim() || !formData.phone.trim()}
                                                          style={{ padding: '8px 20px', background: "var(--accent)", border: 'none', borderRadius: '8px', color: "var(--accent-contrast)", cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                                                        >
                                                          {submitting ? 'Creating Lead...' : 'Register Lead'}
                                                        </button>
                                                      </div>
                                                    </form>
                                                  </div>
                                              </div>
                                              );
}

