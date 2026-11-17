import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { activityTrackerApi } from '../../../utils/activityTrackerApi';

export default function ProgressOverviewSection({
  blockId,
  activities = [],
  floors = [],
  summary = null,
  onOpenDetail,
}) {
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!blockId) return;
    loadOverview();
  }, [blockId]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await activityTrackerApi.getProgressOverview(blockId);
      setOverviewData(res);
    } catch (err) {
      console.error('Failed to load progress overview', err);
    } finally {
      setLoading(false);
    }
  };

  const level1Activities = activities.filter((a) => (a.level || 1) === 1);
  const overdueActivities = activities.filter(
    (a) =>
      a.status !== 'completed' &&
      a.endDate &&
      new Date(a.endDate) < new Date(new Date().toISOString().split('T')[0])
  );

  const blockProgress = summary?.overallProgress || overviewData?.blockProgress || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Main Block Progress */}
        <div className="ro-act-section-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Overall Block Completion
            </span>
            <div className="ro-act-icon-badge" style={{ width: '36px', height: '36px' }}>
              <TrendingUp size={18} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '38px', fontWeight: '800', color: 'var(--accent)' }}>
              {blockProgress}%
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Cumulative Actual Progress
            </span>
          </div>

          <div className="ro-act-progress-bar-bg" style={{ height: '10px' }}>
            <div
              className="ro-act-progress-bar-fill green"
              style={{ width: `${Math.min(100, Math.max(0, blockProgress))}%` }}
            />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Scope: {activities.length} Activities</span>
            <span>Completed: {summary?.statusCounts?.completed || 0}</span>
          </div>
        </div>

        {/* Status Distribution Summary */}
        <div className="ro-act-section-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Execution Status Distribution
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--main-bg)',
                border: '1px solid var(--card-border)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>In Progress</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0284c7' }}>
                {summary?.statusCounts?.in_progress || 0}
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--main-bg)',
                border: '1px solid var(--card-border)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Not Started</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-secondary)' }}>
                {summary?.statusCounts?.not_started || 0}
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--main-bg)',
                border: '1px solid var(--card-border)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Completed</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981' }}>
                {summary?.statusCounts?.completed || 0}
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--main-bg)',
                border: '1px solid var(--card-border)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: '#ef4444' }}>Overdue</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#ef4444' }}>
                {summary?.statusCounts?.overdue || overdueActivities.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Level 1 Parent Breakdown */}
      <div className="ro-act-section-card">
        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
          Major Work Packages (Level 1 Summary)
        </div>

        {level1Activities.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No summary activities defined.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {level1Activities.map((l1) => {
              const prog = l1.currentProgress || 0;
              return (
                <div
                  key={l1._id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--main-bg)',
                    border: '1px solid var(--card-border)',
                    cursor: 'pointer',
                  }}
                  onClick={() => onOpenDetail(l1, [])}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {l1.name}
                      </span>
                      {l1.code && (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          [{l1.code}]
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {prog}%
                    </span>
                  </div>

                  <div className="ro-act-progress-bar-bg" style={{ height: '7px' }}>
                    <div
                      className={`ro-act-progress-bar-fill ${prog >= 100 ? 'green' : prog > 30 ? 'blue' : 'amber'}`}
                      style={{ width: `${Math.min(100, Math.max(0, prog))}%` }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    <span>Target: {l1.endDate || 'No target date'}</span>
                    <span style={{ textTransform: 'capitalize' }}>{(l1.status || 'not_started').replace('_', ' ')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Critical Path Alerts & Overdue Items */}
      {overdueActivities.length > 0 && (
        <div
          className="ro-act-section-card"
          style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#ef4444' }}>
              Schedule Overdue Alert ({overdueActivities.length} Activities)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {overdueActivities.map((act) => (
              <div
                key={act._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: '13px',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{act.name}</strong>
                  <div style={{ fontSize: '11px', color: '#ef4444' }}>
                    Target Completion: {act.endDate} • Progress: {act.currentProgress || 0}%
                  </div>
                </div>
                <button
                  type="button"
                  className="ro-act-btn ro-act-btn-secondary"
                  style={{ fontSize: '11.5px', padding: '4px 10px' }}
                  onClick={() => onOpenDetail(act, [])}
                >
                  Inspect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

