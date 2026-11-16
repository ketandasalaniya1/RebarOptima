import React, { useState } from 'react';
import {
  Settings, Clock, Layers, ShieldCheck, Database,
  CheckCircle2, AlertTriangle, Save
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { Input } from '../../../components/ui';

export default function SettingsView({
  onRefreshData
}) {
  const [holdHours, setHoldHours] = useState(48);
  const [saved, setSaved] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState(null);

  const defaultStages = [
    { key: 'NEW', label: 'New Inbound', color: '#3b82f6' },
    { key: 'CONTACTED', label: 'Contacted', color: '#6366f1' },
    { key: 'REQUIREMENT_GATHERED', label: 'Requirement Defined', color: '#8b5cf6' },
    { key: 'SITE_VISIT_SCHEDULED', label: 'Site Visit Planned', color: '#ec4899' },
    { key: 'SITE_VISIT_CONDUCTED', label: 'Site Visit Done', color: '#f59e0b' },
    { key: 'NEGOTIATION', label: 'Price Negotiation', color: '#f97316' },
    { key: 'UNIT_BLOCKED', label: 'Unit On Hold', color: '#eab308' },
    { key: 'BOOKED', label: 'Booking Confirmed', color: '#16a34a' },
    { key: 'LOST', label: 'Lost / Dropped', color: '#ef4444' }
  ];

  const clpMilestones = [
    { order: 1, name: 'Booking Token Amount', defaultPct: 10 },
    { order: 2, name: 'Agreement Signing (Within 30 Days)', defaultPct: 15 },
    { order: 3, name: 'Plinth / Foundation Level', defaultPct: 15 },
    { order: 4, name: 'Cast 1st Slab', defaultPct: 10 },
    { order: 5, name: 'Cast Mid Slab (5th Floor)', defaultPct: 10 },
    { order: 6, name: 'Cast Top Terrace Slab', defaultPct: 10 },
    { order: 7, name: 'Brickwork & Internal Plaster', defaultPct: 10 },
    { order: 8, name: 'Flooring & Tiling Work', defaultPct: 10 },
    { order: 9, name: 'Plumbing, Electrical & Painting', defaultPct: 5 },
    { order: 10, name: 'Notice of Possession / Key Handover', defaultPct: 5 }
  ];

  const handleSaveHoldHours = (e) => {
    e.preventDefault();
    localStorage.setItem('crm_default_hold_hours', String(holdHours));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSeedData = async () => {
    if (!window.confirm('Seed sample CRM projects, units, and leads? This will only run if ENABLE_CRM_SEED=true on backend.')) return;
    setSeeding(true);
    setSeedStatus(null);
    try {
      const res = await crmApi.seedSampleData();
      setSeedStatus({ success: true, message: res.data?.message || 'Sample data seeded successfully!' });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setSeedStatus({ success: false, message: err.response?.data?.message || err.message || 'Seeding failed. Ensure ENABLE_CRM_SEED=true in backend environment.' });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="crm-settings-view" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
          CRM Settings & Policy Configuration
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #64748b)', fontSize: '0.88rem' }}>
          Manage pipeline stages, reservation timeouts, construction-linked plans, and security roles
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Hold Duration Setting */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="#f59e0b" /> Unit Hold & Reservation Expiry Policy
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-secondary, #64748b)' }}>
            When a sales executive places a unit on hold, it is locked against other agents until the timer expires. The background engine checks every 5 minutes and automatically releases unbooked units back to Available.
          </p>

          <form onSubmit={handleSaveHoldHours} style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 500 }}>Default Hold Duration:</label>
              <Input
                type="number"
                min="1"
                max="168"
                value={holdHours}
                onChange={(e) => setHoldHours(Number(e.target.value))}
                style={{
                  width: '90px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  fontWeight: 600
                }}
              />
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary, #64748b)' }}>hours (48h recommended)</span>
            </div>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'var(--primary-color, #0f172a)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Save size={16} /> Save Policy
            </button>
            {saved && (
              <span style={{ color: '#16a34a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                <CheckCircle2 size={16} /> Saved!
              </span>
            )}
          </form>
        </div>

        {/* Standard Construction-Linked Payment (CLP) Schedule */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#3b82f6" /> Default Construction-Linked Milestone Template (CLP)
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-secondary, #64748b)' }}>
            These 10 standard RERA milestones automatically populate new booking contracts. Milestone percentages must strictly sum up to 100%.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', textAlign: 'left', color: 'var(--text-secondary, #64748b)' }}>
                <th style={{ padding: '8px 0', width: '50px' }}>#</th>
                <th style={{ padding: '8px 0' }}>Milestone Event</th>
                <th style={{ padding: '8px 0', textAlign: 'right', width: '120px' }}>Percentage (%)</th>
              </tr>
            </thead>
            <tbody>
              {clpMilestones.map((m) => (
                <tr key={m.order} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-secondary, #64748b)' }}>{m.order}</td>
                  <td style={{ padding: '10px 0', fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: 'var(--primary-color, #0f172a)' }}>
                    {m.defaultPct}%
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ padding: '12px 0', fontWeight: 700 }}>Total Cumulative Milestone Value</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Roles & Security */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#16a34a" /> Access Control & RBAC Permissions
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-secondary, #64748b)' }}>
            Role-based authorization enforced across backend endpoints:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Sales Executive</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                Create leads, log visits, put units on 48h hold, draft bookings. Masked PAN/Aadhaar.
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Sales Manager</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                All executive actions + reassign leads, apply special discounts, approve bookings, view analytics.
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Accountant</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                Record payments, generate receipts, request payment reversals, view customer billing ledgers.
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>CRM Admin</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                Full system control: reveal unmasked PAN/Aadhaar, block/unblock units, reverse payments, seed data.
              </div>
            </div>
          </div>
        </div>

        {/* Developer & Seed Data Tools */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} color="#6366f1" /> Developer Utilities & Sample Data
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-secondary, #64748b)' }}>
            For staging and testing environments, initialize dummy projects, towers, unit inventories, and demo leads.
          </p>

          <button
            type="button"
            onClick={handleSeedData}
            disabled={seeding}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              cursor: seeding ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            {seeding ? 'Seeding Sample Data...' : 'Seed Sample CRM Data'}
          </button>

          {seedStatus && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              background: seedStatus.success ? '#dcfce7' : '#fee2e2',
              color: seedStatus.success ? '#15803d' : '#b91c1c'
            }}>
              {seedStatus.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

