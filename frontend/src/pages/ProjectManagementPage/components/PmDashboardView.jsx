import React from 'react';
import { LayoutDashboard, TrendingUp, AlertTriangle, CheckCircle2, Clock, Calendar, ArrowRight, ShieldCheck, Database } from 'lucide-react';

export default function PmDashboardView({ kpis, projects, tasks, onSelectProject, onSeedData, isSeeding }) {
  const activeCount = projects.filter(p => p.status === 'ACTIVE').length;
  const delayedCount = projects.filter(p => p.status === 'DELAYED' || p.status === 'AT_RISK').length;
  const criticalTasks = tasks.filter(t => t.isCritical && t.status !== 'COMPLETED');
  const overdueTasks = tasks.filter(t => {
    const today = new Date().toISOString().split('T')[0];
    return t.status !== 'COMPLETED' && t.forecastFinish < today;
  });

  return (
    <div className="pm-dashboard-container">
      {/* SEED BANNER IF EMPTY */}
      {projects.length === 0 && (
        <div className="pm-seed-banner">
          <div className="pm-seed-banner-text">
            <Database size={24} className="pm-text-accent" />
            <div>
              <h3>Enterprise Construction Sample Database Available</h3>
              <p>Initialize a realistic G+24 high-rise tower project with 18 WBS tasks, Critical Path Method (CPM) calculations, daily progress reports, and delay audit history.</p>
            </div>
          </div>
          <button className="pm-btn pm-btn-primary" onClick={onSeedData} disabled={isSeeding}>
            {isSeeding ? 'Seeding Enterprise Data...' : 'Seed Sample Project'}
          </button>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="pm-kpi-grid">
        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-blue">
            <LayoutDashboard size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Total Projects</span>
            <span className="pm-kpi-value">{kpis?.totalProjects || projects.length}</span>
            <span className="pm-kpi-sub">{activeCount} active on site</span>
          </div>
        </div>

        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-amber">
            <AlertTriangle size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Schedule Health</span>
            <span className={`pm-kpi-value ${delayedCount > 0 ? 'pm-text-danger' : 'pm-text-success'}`}>
              {delayedCount > 0 ? `${delayedCount} Delayed / At Risk` : '100% On Schedule'}
            </span>
            <span className="pm-kpi-sub">{criticalTasks.length} critical path activities</span>
          </div>
        </div>

        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-emerald">
            <TrendingUp size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Portfolio Progress</span>
            <span className="pm-kpi-value">{kpis?.averageProgress || 0}%</span>
            <span className="pm-kpi-sub">Weighted physical progress</span>
          </div>
        </div>

        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-purple">
            <Calendar size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">CPM Working Calendar</span>
            <span className="pm-kpi-value">{projects[0]?.calendar?.workingDaysPerWeek || 6}-Day Week</span>
            <span className="pm-kpi-sub">{projects[0]?.calendar?.workingHoursPerDay || 8}h daily | {projects[0]?.calendar?.holidays?.length || 0} holidays</span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN ROW */}
      <div className="pm-dashboard-row">
        {/* ACTIVE PROJECTS LIST */}
        <div className="pm-card pm-dashboard-projects-card">
          <div className="pm-card-header">
            <h4>Active Projects & Finish Dates</h4>
          </div>
          <div className="pm-projects-compact-list">
            {projects.map(p => (
              <div
                key={p._id}
                className="pm-project-compact-item"
                onClick={() => onSelectProject(p._id)}
              >
                <div className="pm-p-item-left">
                  <div className="pm-p-code-tag">{p.code}</div>
                  <div>
                    <h5 className="pm-p-title">{p.name}</h5>
                    <div className="pm-p-dates">
                      <span>Baseline: <strong>{p.baselineFinish}</strong></span>
                      <ArrowRight size={12} className="pm-mx-1" />
                      <span>Forecast: <strong className={p.forecastFinish > p.baselineFinish ? 'pm-text-danger' : 'pm-text-success'}>{p.forecastFinish}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="pm-p-item-right">
                  <div className="pm-p-progress-wrap">
                    <span className="pm-p-prog-val">{p.progressPercentage || 0}%</span>
                    <div className="pm-p-prog-bar">
                      <div className="pm-p-prog-fill" style={{ width: `${p.progressPercentage || 0}%` }} />
                    </div>
                  </div>
                  <span className={`pm-badge ${p.status === 'ACTIVE' ? 'pm-badge-success' : p.status === 'DELAYED' ? 'pm-badge-danger' : 'pm-badge-subtle'}`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CRITICAL PATH & OVERDUE ACTIVITIES */}
        <div className="pm-card pm-dashboard-critical-card">
          <div className="pm-card-header">
            <h4>Critical Path & Overdue Activities</h4>
            <span className="pm-badge pm-badge-danger">{criticalTasks.length} Critical</span>
          </div>

          <div className="pm-critical-tasks-list">
            {criticalTasks.length === 0 ? (
              <div className="pm-empty-state">
                <CheckCircle2 size={32} className="pm-text-success" />
                <p>No critical path delays detected.</p>
              </div>
            ) : (
              criticalTasks.slice(0, 6).map(t => (
                <div key={t._id} className="pm-critical-item">
                  <div className="pm-crit-badge">Float: 0d</div>
                  <div className="pm-crit-info">
                    <span className="pm-crit-name">{t.wbsCode} - {t.name}</span>
                    <span className="pm-crit-due">Due: {t.forecastFinish} ({t.durationDays} days) • Assigned: {t.assignedRole || 'Site Engineer'}</span>
                  </div>
                  <span className={`pm-badge ${t.status === 'IN_PROGRESS' ? 'pm-badge-primary' : 'pm-badge-subtle'}`}>
                    {t.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
