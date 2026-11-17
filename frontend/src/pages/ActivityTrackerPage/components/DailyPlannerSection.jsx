import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  User,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { activityTrackerApi } from '../../../utils/activityTrackerApi';

export default function DailyPlannerSection({
  blockId,
  onOpenDailyUpdate,
  onOpenDetail,
}) {
  const [activeSubTab, setActiveSubTab] = useState('today'); // 'today' | 'upcoming' | 'history'
  const [upcomingDays, setUpcomingDays] = useState(7);
  const [historyDate, setHistoryDate] = useState(
    new Date(Date.now() - 86400000).toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!blockId) return;
    loadPlanner();
  }, [blockId, activeSubTab, upcomingDays, historyDate]);

  const loadPlanner = async () => {
    setLoading(true);
    setError('');
    try {
      let res;
      if (activeSubTab === 'today') {
        res = await activityTrackerApi.getPlannerToday(blockId);
      } else if (activeSubTab === 'upcoming') {
        res = await activityTrackerApi.getPlannerUpcoming(blockId, upcomingDays);
      } else {
        res = await activityTrackerApi.getPlannerHistory(blockId, historyDate);
      }
      setActivities(res?.activities || []);
    } catch (err) {
      setError(err.message || 'Failed to load daily planner');
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="ro-act-section-card">
      {/* Subtab Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--card-border)',
          paddingBottom: '14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={`ro-act-tab-btn ${activeSubTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('today')}
          >
            Today's Planner
          </button>
          <button
            type="button"
            className={`ro-act-tab-btn ${activeSubTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('upcoming')}
          >
            Upcoming Lookahead
          </button>
          <button
            type="button"
            className={`ro-act-tab-btn ${activeSubTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('history')}
          >
            Historical Schedule
          </button>
        </div>

        {/* Dynamic Controls based on Subtab */}
        {activeSubTab === 'upcoming' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Horizon:</span>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                className={`ro-act-btn ${upcomingDays === d ? 'ro-act-btn-primary' : 'ro-act-btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => setUpcomingDays(d)}
              >
                {d} Days
              </button>
            ))}
          </div>
        )}

        {activeSubTab === 'history' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date:</span>
            <input
              type="date"
              className="ro-form-input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '12.5px' }}
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading scheduled activities...
        </div>
      ) : error ? (
        <div style={{ padding: '24px', color: '#ef4444', textAlign: 'center' }}>
          {error}
        </div>
      ) : activities.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Clock size={36} style={{ opacity: 0.35, marginBottom: '10px' }} />
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            No activities scheduled for this timeframe
          </div>
          <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
            All activities planned for this period are either finished or scheduled elsewhere.
          </div>
        </div>
      ) : (
        <div className="ro-planner-grid">
          {activities.map((act) => {
            const isLoggedToday = act.todayUpdated;
            const isLevel1 = (act.level || 1) === 1;

            return (
              <div key={act._id} className="ro-planner-card">
                <div className="ro-planner-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span
                        className="ro-act-parent-badge"
                        style={{
                          backgroundColor: isLevel1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                          color: isLevel1 ? '#10b981' : '#0284c7',
                        }}
                      >
                        {isLevel1 ? 'L1 Summary' : 'L2 Task'}
                      </span>
                      {act.code && (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          [{act.code}]
                        </span>
                      )}
                    </div>
                    <div
                      className="ro-planner-act-name"
                      onClick={() => onOpenDetail(act, [])}
                      style={{ cursor: 'pointer' }}
                    >
                      {act.name}
                    </div>
                  </div>

                  {/* Logged status badge */}
                  {isLoggedToday ? (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <CheckCircle2 size={13} /> Updated Today
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        color: '#d97706',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <AlertTriangle size={13} /> Pending
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Current Progress</span>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                      {act.currentProgress || 0}%
                    </span>
                  </div>
                  <div className="ro-act-progress-bar-bg" style={{ height: '6px' }}>
                    <div
                      className="ro-act-progress-bar-fill green"
                      style={{ width: `${Math.min(100, Math.max(0, act.currentProgress || 0))}%` }}
                    />
                  </div>
                </div>

                {/* Metadata */}
                <div className="ro-planner-meta-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span>{act.startDate || '—'} → {act.endDate || '—'}</span>
                  </div>
                  {act.floorId?.name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={13} style={{ color: 'var(--text-secondary)' }} />
                      <span>{act.floorId.name}</span>
                    </div>
                  )}
                </div>

                {/* Action Row */}
                <div className="ro-planner-actions">
                  <button
                    type="button"
                    className="ro-act-btn ro-act-btn-secondary"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
                    onClick={() => onOpenDetail(act, [])}
                  >
                    View History
                  </button>
                  {act.progressMode !== 'AUTOMATIC' && (
                    <button
                      type="button"
                      className="ro-act-btn ro-act-btn-primary"
                      style={{ flex: 1.2, padding: '6px 10px', fontSize: '12px' }}
                      onClick={() => onOpenDailyUpdate(act)}
                    >
                      Log Update
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

