import React from 'react';
import {
  FolderKanban,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  HardDrive,
  ArrowUpRight,
  TrendingUp,
  Plus
} from 'lucide-react';

export default function DrawingsDashboard({
  dashboardData,
  onNavigateTab,
  onOpenNewProject,
  onOpenNewDrawing
}) {
  const d = dashboardData || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Top Welcome & Action Banner ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Drawing &amp; File Management
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Manage project drawing revisions, formal review workflows, and engineering transmittals.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="dw-btn-secondary" onClick={onOpenNewProject}>
            <FolderKanban size={16} /> + New Project
          </button>
          <button className="dw-btn-primary" onClick={onOpenNewDrawing}>
            <Plus size={16} /> + New Drawing
          </button>
        </div>
      </div>

      {/* ── 6 KPI Summary Metric Cards (Screenshot 5 Panel 1) ───────────── */}
      <div className="drawings-kpi-grid">
        <div className="drawings-kpi-card" onClick={() => onNavigateTab('projects')} style={{ cursor: 'pointer' }}>
          <div className="drawings-kpi-label">
            <span>Total Projects</span>
            <FolderKanban size={16} color="#94a3b8" />
          </div>
          <div className="drawings-kpi-value">{d.totalProjects ?? 4}</div>
          <div className="drawings-kpi-sub" style={{ color: '#38bdf8' }}>
            ↑ 2 this month
          </div>
        </div>

        <div className="drawings-kpi-card" onClick={() => onNavigateTab('register')} style={{ cursor: 'pointer' }}>
          <div className="drawings-kpi-label">
            <span>Total Drawings</span>
            <FileText size={16} color="#94a3b8" />
          </div>
          <div className="drawings-kpi-value">{d.totalDrawings ?? 248}</div>
          <div className="drawings-kpi-sub" style={{ color: '#10b981' }}>
            ↑ 18 this month
          </div>
        </div>

        <div className="drawings-kpi-card review" onClick={() => onNavigateTab('queue')} style={{ cursor: 'pointer' }}>
          <div className="drawings-kpi-label">
            <span>Under Review</span>
            <Clock size={16} color="#38bdf8" />
          </div>
          <div className="drawings-kpi-value">{d.underReview ?? 16}</div>
          <div className="drawings-kpi-sub" style={{ color: '#f87171' }}>
            ↓ 5 overdue
          </div>
        </div>

        <div className="drawings-kpi-card pending" onClick={() => onNavigateTab('queue')} style={{ cursor: 'pointer' }}>
          <div className="drawings-kpi-label">
            <span>Pending Approval</span>
            <AlertTriangle size={16} color="#fbbf24" />
          </div>
          <div className="drawings-kpi-value">{d.pendingApproval ?? 8}</div>
          <div className="drawings-kpi-sub" style={{ color: '#fbbf24' }}>
            2 urgent
          </div>
        </div>

        <div className="drawings-kpi-card approved" onClick={() => onNavigateTab('register')} style={{ cursor: 'pointer' }}>
          <div className="drawings-kpi-label">
            <span>Approved (Latest)</span>
            <CheckCircle2 size={16} color="#34d399" />
          </div>
          <div className="drawings-kpi-value">{d.approved ?? 186}</div>
          <div className="drawings-kpi-sub" style={{ color: '#34d399' }}>
            ↑ 14 this month
          </div>
        </div>

        <div className="drawings-kpi-card superseded" onClick={() => onNavigateTab('revisions')} style={{ cursor: 'pointer' }}>
          <div className="drawings-kpi-label">
            <span>Superseded</span>
            <History size={16} color="#c084fc" />
          </div>
          <div className="drawings-kpi-value">{d.superseded ?? 42}</div>
          <div className="drawings-kpi-sub" style={{ color: '#94a3b8' }}>
            Archived history
          </div>
        </div>
      </div>

      {/* ── Middle Split: Drawings by Discipline + Recent Activity ────────── */}
      <div className="drawings-dashboard-split">
        {/* Drawings by Discipline (Donut representation) */}
        <div className="drawings-card-box">
          <div className="drawings-card-header">
            <div className="drawings-card-title">
              <TrendingUp size={16} color="#38bdf8" /> Drawings by Discipline
            </div>
            <button
              className="dw-btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              onClick={() => onNavigateTab('disciplines')}
            >
              View Library ➔
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '1.5rem', alignItems: 'center' }}>
            {/* Donut graphic */}
            <div style={{ position: 'relative', width: '150px', height: '150px', margin: '0 auto' }}>
              <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="3.8"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="4"
                  strokeDasharray="35, 100"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeDasharray="25, 100"
                  strokeDashoffset="-35"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="4"
                  strokeDasharray="20, 100"
                  strokeDashoffset="-60"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{d.totalDrawings ?? 248}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-label)' }}>Drawings</span>
              </div>
            </div>

            {/* Discipline Legend list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {(d.drawingsByDiscipline || []).map((disc, idx) => (
                <div
                  key={`${disc.code}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: disc.color || '#3b82f6'
                      }}
                    />
                    <span>{disc.name}</span>
                  </div>
                  <strong style={{ color: 'var(--text-primary)' }}>{disc.count || 0}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity Stream matching Screenshot 5 Panel 1 */}
        <div className="drawings-card-box">
          <div className="drawings-card-header">
            <div className="drawings-card-title">
              <History size={16} color="#38bdf8" /> Recent Activity
            </div>
            <button
              className="dw-btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              onClick={() => onNavigateTab('activity')}
            >
              View All ➔
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(!d.recentActivity || d.recentActivity.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                No recent activity recorded.
              </div>
            ) : (
              d.recentActivity.slice(0, 4).map((act, idx) => (
                <div
                  key={act._id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.55rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--card-border)'
                  }}
                >
                  <span className="dw-rev-badge" style={{ marginTop: '0.1rem' }}>
                    {act.revisionNumber || 'R00'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {act.title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {act.description}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-label)', whiteSpace: 'nowrap' }}>
                    {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Alerts & Storage Grid (Screenshot 1 & 5) ───────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
        <div className="drawings-card-box">
          <div className="drawings-card-header">
            <div className="drawings-card-title">
              <AlertTriangle size={16} color="#fbbf24" /> Current Revision Alerts &amp; Critical Notices
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-label)' }}>Real-time Audit</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(d.alerts || []).map((alert) => (
              <div
                key={alert.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {alert.type === 'warning' ? (
                    <AlertTriangle size={18} color="#f87171" />
                  ) : alert.type === 'clock' ? (
                    <Clock size={18} color="#fbbf24" />
                  ) : (
                    <CheckCircle2 size={18} color="#38bdf8" />
                  )}
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {alert.description}
                    </div>
                  </div>
                </div>
                <button
                  className="dw-btn-secondary"
                  style={{ fontSize: '0.74rem', padding: '0.3rem 0.65rem' }}
                  onClick={() => onNavigateTab('register')}
                >
                  {alert.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Private Storage Quota Card (Screenshot 1) */}
        <div className="drawings-card-box">
          <div className="drawings-card-header">
            <div className="drawings-card-title">
              <HardDrive size={16} color="#38bdf8" /> Document Storage
            </div>
            <span style={{ fontSize: '0.72rem', color: '#34d399' }}>26% Used</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Encrypted Vault</span>
              <strong>128 GB / 500 GB</strong>
            </div>

            <div
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: '#1e293b',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: '26%',
                  height: '100%',
                  borderRadius: '4px',
                  backgroundColor: '#0284c7'
                }}
              />
            </div>

            <div style={{ fontSize: '0.74rem', color: 'var(--text-label)', lineHeight: 1.4 }}>
              🔒 Private SHA-256 Checksum storage active. All uploaded DWG, PDF, and Vector files are cryptographically verified and immutable.
            </div>

            <button
              className="dw-btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}
              onClick={() => onNavigateTab('settings')}
            >
              Storage Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
