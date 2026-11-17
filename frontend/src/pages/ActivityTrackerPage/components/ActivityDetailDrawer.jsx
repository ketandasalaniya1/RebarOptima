import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Layers,
  User,
  Clock,
  AlertTriangle,
  Camera,
  History,
  CheckCircle2,
  Scale,
  Edit,
  ArrowRight,
} from 'lucide-react';
import { activityTrackerApi } from '../../../utils/activityTrackerApi';

export default function ActivityDetailDrawer({
  isOpen,
  onClose,
  activity,
  childActivities = [],
  onOpenDailyUpdate,
  onOpenWeightage,
  onOpenCorrection,
  onEditActivity,
}) {
  const [updates, setUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'updates' | 'children'
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    if (!isOpen || !activity) return;
    setActiveTab('overview');
    loadActivityUpdates();
  }, [isOpen, activity]);

  const loadActivityUpdates = async () => {
    if (!activity?._id) return;
    setLoadingUpdates(true);
    try {
      const res = await activityTrackerApi.listDailyUpdates({ activityId: activity._id });
      setUpdates(res?.updates || []);
    } catch (err) {
      console.error('Failed to load activity updates', err);
    } finally {
      setLoadingUpdates(false);
    }
  };

  if (!isOpen || !activity) return null;

  const isLevel1 = (activity.level || 1) === 1;
  const isAuto = activity.progressMode === 'AUTOMATIC';
  const progressVal = activity.currentProgress || 0;

  return (
    <div className="ro-act-drawer-overlay" onClick={onClose}>
      <div className="ro-act-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ro-act-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="ro-act-icon-badge"
              style={{
                width: '38px',
                height: '38px',
                background: isLevel1 ? 'var(--accent)' : '#0284c7',
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: isLevel1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                    color: isLevel1 ? '#10b981' : '#0284c7',
                  }}
                >
                  {isLevel1 ? 'Level 1 Summary Activity' : 'Level 2 Task'}
                </span>
                {activity.code && (
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    [{activity.code}]
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>
                {activity.name}
              </h2>
            </div>
          </div>
          <button type="button" className="ro-act-btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--card-border)',
            backgroundColor: 'var(--main-bg)',
            padding: '0 16px',
          }}
        >
          <button
            type="button"
            className={`ro-act-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ padding: '10px 16px', fontSize: '13px' }}
          >
            Overview
          </button>
          <button
            type="button"
            className={`ro-act-tab-btn ${activeTab === 'updates' ? 'active' : ''}`}
            onClick={() => setActiveTab('updates')}
            style={{ padding: '10px 16px', fontSize: '13px' }}
          >
            Daily Log ({updates.length})
          </button>
          {isLevel1 && (
            <button
              type="button"
              className={`ro-act-tab-btn ${activeTab === 'children' ? 'active' : ''}`}
              onClick={() => setActiveTab('children')}
              style={{ padding: '10px 16px', fontSize: '13px' }}
            >
              Child Tasks ({childActivities.length})
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="ro-act-drawer-body">
          {activeTab === 'overview' && (
            <>
              {/* Progress Card */}
              <div className="ro-detail-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Cumulative Progress
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: isAuto ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: isAuto ? '#6366f1' : '#10b981',
                      fontWeight: '700',
                    }}
                  >
                    {isAuto ? 'AUTOMATIC (Weighted Sum)' : 'MANUAL'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0' }}>
                  <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {progressVal}%
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Status: <strong style={{ textTransform: 'capitalize' }}>{(activity.status || 'not_started').replace('_', ' ')}</strong>
                  </span>
                </div>

                <div className="ro-act-progress-bar-bg" style={{ height: '8px' }}>
                  <div
                    className={`ro-act-progress-bar-fill ${
                      progressVal >= 100 ? 'green' : progressVal > 40 ? 'blue' : 'amber'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, progressVal))}%` }}
                  />
                </div>
              </div>

              {/* Schedule and Floor Details */}
              <div className="ro-detail-card">
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Schedule & Scope
                </div>
                <div className="ro-detail-row">
                  <span className="ro-detail-label">Planned Schedule:</span>
                  <span className="ro-detail-val">
                    {activity.startDate || '—'} &nbsp;→&nbsp; {activity.endDate || '—'}
                  </span>
                </div>
                <div className="ro-detail-row">
                  <span className="ro-detail-label">Actual Schedule:</span>
                  <span className="ro-detail-val">
                    {activity.actualStartDate || 'Not started'} &nbsp;→&nbsp; {activity.actualEndDate || 'In progress'}
                  </span>
                </div>
                <div className="ro-detail-row">
                  <span className="ro-detail-label">Floor / Level:</span>
                  <span className="ro-detail-val">
                    {activity.floorId?.name || (typeof activity.floorId === 'string' ? activity.floorId : '—')}
                  </span>
                </div>
                <div className="ro-detail-row">
                  <span className="ro-detail-label">Weightage in Parent:</span>
                  <span className="ro-detail-val">
                    {typeof activity.weightage === 'number' ? `${activity.weightage}%` : 'N/A (L1)'}
                  </span>
                </div>
              </div>

              {/* Description */}
              {activity.description && (
                <div className="ro-detail-card">
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Description / Scope of Work
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {activity.description}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'updates' && (
            <div>
              {loadingUpdates ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading daily updates...
                </div>
              ) : updates.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No daily updates logged for this activity yet.
                  <div style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      className="ro-act-btn ro-act-btn-primary"
                      onClick={() => onOpenDailyUpdate(activity)}
                    >
                      Log First Update
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ro-timeline-container">
                  {updates.map((up) => (
                    <div key={up._id} className="ro-timeline-item">
                      <div className="ro-timeline-node">
                        {up.progress}%
                      </div>
                      <div className="ro-timeline-content">
                        <div className="ro-timeline-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="ro-timeline-date">{up.updateDate}</span>
                            {up.isDelayed && (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  fontWeight: '700',
                                }}
                              >
                                Delayed
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="ro-act-btn-ghost"
                            style={{ fontSize: '11px', color: '#d97706', padding: '2px 6px' }}
                            onClick={() => onOpenCorrection(up, activity.name)}
                          >
                            Correct
                          </button>
                        </div>

                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          {up.workDone || 'No detailed work description entered.'}
                        </div>

                        {up.isDelayed && up.delayReason && (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                              color: '#ef4444',
                              fontSize: '11.5px',
                            }}
                          >
                            <strong>Obstruction:</strong> {up.delayReason}
                          </div>
                        )}

                        {/* Photos */}
                        {up.photoIds && up.photoIds.length > 0 && (
                          <div className="ro-photo-strip">
                            {up.photoIds.map((pId) => (
                              <img
                                key={pId}
                                src={activityTrackerApi.getPhotoUrl(pId)}
                                alt="Site update"
                                className="ro-photo-thumb"
                                onClick={() => setSelectedPhoto(activityTrackerApi.getPhotoUrl(pId))}
                              />
                            ))}
                          </div>
                        )}

                        {/* Edit History Badge */}
                        {up.editHistory && up.editHistory.length > 0 && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#d97706',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '4px',
                            }}
                          >
                            <History size={12} /> Corrected {up.editHistory.length} time(s). Last: "{up.editHistory[up.editHistory.length - 1].reason}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'children' && isLevel1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Total Children: {childActivities.length}
                </span>
                <button
                  type="button"
                  className="ro-act-btn ro-act-btn-secondary"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => onOpenWeightage(activity, childActivities)}
                >
                  <Scale size={14} /> Adjust Weightages
                </button>
              </div>

              {childActivities.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No Level 2 child tasks created yet.
                </div>
              ) : (
                childActivities.map((child) => (
                  <div
                    key={child._id}
                    className="ro-detail-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (onEditActivity) onEditActivity(child);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {child.name}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--hover-bg, rgba(148, 163, 184, 0.15))',
                          color: 'var(--text-primary)',
                        }}
                      >
                        Weight: {child.weightage || 0}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {child.currentProgress || 0}%
                      </span>
                    </div>

                    <div className="ro-act-progress-bar-bg" style={{ height: '6px' }}>
                      <div
                        className="ro-act-progress-bar-fill green"
                        style={{ width: `${Math.min(100, Math.max(0, child.currentProgress || 0))}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="ro-act-drawer-footer">
          <button
            type="button"
            className="ro-act-btn ro-act-btn-secondary"
            onClick={() => onEditActivity(activity)}
          >
            <Edit size={14} /> Edit Activity
          </button>
          {!isAuto && (
            <button
              type="button"
              className="ro-act-btn ro-act-btn-primary"
              onClick={() => onOpenDailyUpdate(activity)}
            >
              Log Daily Update
            </button>
          )}
        </div>
      </div>

      {/* Lightbox Modal for Photo */}
      {selectedPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <img
            src={selectedPhoto}
            alt="Site photo full"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
}

