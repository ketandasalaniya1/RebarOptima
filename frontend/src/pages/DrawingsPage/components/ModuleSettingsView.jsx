import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  FileCheck,
  Hash,
  Database,
  Save,
  RefreshCw
} from 'lucide-react';

export default function ModuleSettingsView({
  settings,
  onSaveSettings,
  onSeedWorkspace
}) {
  const [formData, setFormData] = useState({
    numberingConvention: '{PROJECT}-{DISCIPLINE}-{SEQ}',
    revisionFormat: 'R00',
    allowSelfApproval: false,
    mandatoryReviewsRequired: true
  });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        numberingConvention: settings.numberingConvention || '{PROJECT}-{DISCIPLINE}-{SEQ}',
        revisionFormat: settings.revisionFormat || 'R00',
        allowSelfApproval: Boolean(settings.allowSelfApproval),
        mandatoryReviewsRequired: Boolean(settings.mandatoryReviewsRequired)
      });
    }
  }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(formData);
      alert('Module settings updated successfully!');
    } catch (err) {
      alert('Error updating settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm('Populate/refresh demo drawings, projects, and transmittals? (Non-destructive)')) return;
    setSeeding(true);
    try {
      const res = await onSeedWorkspace();
      alert(res.message || 'Workspace seeded successfully!');
      window.location.reload();
    } catch (err) {
      alert('Error seeding workspace: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '840px' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          Module Settings &amp; Governance
        </h2>
        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Configure enterprise numbering conventions, revision formats, and review policies.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Numbering Conventions Card */}
        <div className="drawings-card-box">
          <div className="drawings-card-header">
            <div className="drawings-card-title">
              <Hash size={16} color="#38bdf8" /> Numbering &amp; Identification Conventions
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="dw-form-group">
              <label className="dw-form-label">Drawing Numbering Pattern Template</label>
              <input
                type="text"
                className="dw-form-input"
                value={formData.numberingConvention}
                onChange={(e) => setFormData({ ...formData, numberingConvention: e.target.value })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-label)', marginTop: '0.2rem' }}>
                Tokens: {'{PROJECT}'}, {'{DISCIPLINE}'}, {'{TYPE}'}, {'{SEQ}'}. Example output: <strong>AH-ARCH-F-001</strong>
              </span>
            </div>

            <div className="dw-form-group">
              <label className="dw-form-label">Revision Convention Format</label>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="revisionFormat"
                    value="R00"
                    checked={formData.revisionFormat === 'R00'}
                    onChange={() => setFormData({ ...formData, revisionFormat: 'R00' })}
                  />
                  <span>R00, R01, R02... (Standard Engineering)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="revisionFormat"
                    value="A"
                    checked={formData.revisionFormat === 'A'}
                    onChange={() => setFormData({ ...formData, revisionFormat: 'A' })}
                  />
                  <span>A, B, C... (Architectural Alphabetical)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Approvals Governance Card */}
        <div className="drawings-card-box">
          <div className="drawings-card-header">
            <div className="drawings-card-title">
              <Shield size={16} color="#38bdf8" /> Security, Review &amp; Approval Governance
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                style={{ marginTop: '0.25rem' }}
                checked={!formData.allowSelfApproval}
                onChange={(e) => setFormData({ ...formData, allowSelfApproval: !e.target.checked })}
              />
              <div>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  Enforce Segregation of Duties (Prevent Self-Approval)
                </strong>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  When enabled, drawing uploaders cannot approve their own revisions. A distinct authorized approver is strictly mandated.
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                style={{ marginTop: '0.25rem' }}
                checked={formData.mandatoryReviewsRequired}
                onChange={(e) => setFormData({ ...formData, mandatoryReviewsRequired: e.target.checked })}
              />
              <div>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  Mandate Peer Reviews Prior to Approval
                </strong>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Revisions must complete all assigned mandatory technical reviews before entering Pending Approval.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Save Settings Button */}
        <div>
          <button type="submit" className="dw-btn-primary" disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save Module Settings'}
          </button>
        </div>
      </form>

      {/* Demo Seed Section (Rule 3 Safe) */}
      <div className="drawings-card-box" style={{ marginTop: '1rem' }}>
        <div className="drawings-card-header">
          <div className="drawings-card-title">
            <Database size={16} color="#38bdf8" /> Workspace Initialization &amp; Sample Data
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          Initialize or re-seed high-fidelity sample engineering drawings matching Screenshot 5 (Alpha Heights, Riverside Towers, Ground Floor Plan AR-F-001, Slab Reinforcement Plan ST-S-101, and Transmittal TR-2024-010). Existing data is safely protected.
        </div>

        <div style={{ marginTop: '0.85rem' }}>
          <button className="dw-btn-secondary" onClick={handleSeed} disabled={seeding}>
            <RefreshCw size={14} className={seeding ? 'spin' : ''} />
            {seeding ? 'Seeding...' : 'Populate Sample Engineering Drawings'}
          </button>
        </div>
      </div>
    </div>
  );
}
