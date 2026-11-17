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
    { key: 'NEW', label: 'New Inbound', color: 'var(--info-text)' },
    { key: 'CONTACTED', label: 'Contacted', color: '#6366f1' },
    { key: 'REQUIREMENT_GATHERED', label: 'Requirement Defined', color: '#8b5cf6' },
    { key: 'SITE_VISIT_SCHEDULED', label: 'Site Visit Planned', color: '#ec4899' },
    { key: 'SITE_VISIT_CONDUCTED', label: 'Site Visit Done', color: 'var(--warning-text)' },
    { key: 'NEGOTIATION', label: 'Price Negotiation', color: '#f97316' },
    { key: 'UNIT_BLOCKED', label: 'Unit On Hold', color: 'var(--warning-text)' },
    { key: 'BOOKED', label: 'Booking Confirmed', color: 'var(--accent-text)' },
    { key: 'LOST', label: 'Lost / Dropped', color: 'var(--danger-text)' }
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
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          CRM Settings & Policy Configuration
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Manage pipeline stages, reservation timeouts, construction-linked plans, and security roles
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Hold Duration Setting */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--warning-text)" /> Unit Hold & Reservation Expiry Policy
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
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
                  border: '1px solid var(--border-color)',
                  fontWeight: 600
                }}
              />
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>hours (48h recommended)</span>
            </div>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'var(--primary-color)',
                color: 'var(--text-primary)',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Save size={16} /> Save Policy
            </button>
            {saved && (
              <span style={{ color: 'var(--accent-text)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                <CheckCircle2 size={16} /> Saved!
              </span>
            )}
          </form>
        </div>

        {/* Standard Construction-Linked Payment (CLP) Schedule */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--info-text)" /> Default Construction-Linked Milestone Template (CLP)
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            These 10 standard RERA milestones automatically populate new booking contracts. Milestone percentages must strictly sum up to 100%.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px 0', width: '50px' }}>#</th>
                <th style={{ padding: '8px 0' }}>Milestone Event</th>
                <th style={{ padding: '8px 0', textAlign: 'right', width: '120px' }}>Percentage (%)</th>
              </tr>
            </thead>
            <tbody>
              {clpMilestones.map((m) => (
                <tr key={m.order} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{m.order}</td>
                  <td style={{ padding: '10px 0', fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: 'var(--primary-color)' }}>
                    {m.defaultPct}%
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ padding: '12px 0', fontWeight: 700 }}>Total Cumulative Milestone Value</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 800, color: 'var(--accent-text)' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Roles & Security */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="var(--accent-text)" /> Access Control & RBAC Permissions
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Role-based authorization enforced across backend endpoints:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Sales Executive</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Create leads, log visits, put units on 48h hold, draft bookings. Masked PAN/Aadhaar.
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Sales Manager</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                All executive actions + reassign leads, apply special discounts, approve bookings, view analytics.
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Accountant</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Record payments, generate receipts, request payment reversals, view customer billing ledgers.
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>CRM Admin</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Full system control: reveal unmasked PAN/Aadhaar, block/unblock units, reverse payments, seed data.
              </div>
            </div>
          </div>
        </div>

        {/* Developer & Seed Data Tools */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} color="#6366f1" /> Developer Utilities & Sample Data
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            For staging and testing environments, initialize dummy projects, towers, unit inventories, and demo leads.
          </p>

          <button
            type="button"
            onClick={handleSeedData}
            disabled={seeding}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-primary)',
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
              background: seedStatus.success ? 'var(--success-subtle)' : 'var(--danger-subtle)',
              color: seedStatus.success ? 'var(--accent-text)' : 'var(--danger-text)'
            }}>
              {seedStatus.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

