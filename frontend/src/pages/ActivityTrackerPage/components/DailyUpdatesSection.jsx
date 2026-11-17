import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Filter,
  Search,
  AlertTriangle,
  History,
  Camera,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { activityTrackerApi } from '../../../utils/activityTrackerApi';

export default function DailyUpdatesSection({
  blockId,
  activities = [],
  onOpenCorrection,
  onOpenDailyUpdate,
}) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState('ALL');
  const [onlyDelayed, setOnlyDelayed] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    if (!blockId) return;
    loadUpdates();
  }, [blockId, selectedActivityId, dateFilter]);

  const loadUpdates = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { blockId };
      if (selectedActivityId !== 'ALL') params.activityId = selectedActivityId;
      if (dateFilter) {
        params.startDate = dateFilter;
        params.endDate = dateFilter;
      }
      const res = await activityTrackerApi.listDailyUpdates(params);
      setUpdates(res?.updates || []);
    } catch (err) {
      setError(err.message || 'Failed to load daily updates');
    } finally {
      setLoading(false);
    }
  };

  const activityMap = {};
  activities.forEach((a) => {
    activityMap[a._id] = a;
  });

  const filteredUpdates = updates.filter((u) => {
    if (onlyDelayed && !u.isDelayed) return false;
    return true;
  });

  return (
    <div className="ro-act-section-card">
      {/* Filter toolbar */}
      <div className="ro-act-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Activity:</span>
            <select
              className="ro-act-select"
              style={{ width: 'auto', minWidth: '180px' }}
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
            >
              <option value="ALL">All Activities</option>
              {activities.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.code ? `[${a.code}] ` : ''}{a.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date:</span>
            <input
              type="date"
              className="ro-form-input"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            {dateFilter && (
              <button
                type="button"
                className="ro-act-btn-ghost"
                style={{ fontSize: '11px', padding: '4px' }}
                onClick={() => setDateFilter('')}
              >
                Clear
              </button>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onlyDelayed}
              onChange={(e) => setOnlyDelayed(e.target.checked)}
              style={{ accentColor: '#ef4444' }}
            />
            Show Obstructions Only
          </label>
        </div>
      </div>

      {/* Updates Stream */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading daily updates log...
        </div>
      ) : error ? (
        <div style={{ padding: '24px', color: '#ef4444', textAlign: 'center' }}>
          {error}
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Calendar size={36} style={{ opacity: 0.35, marginBottom: '10px' }} />
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            No daily updates recorded
          </div>
          <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
            Daily progress updates submitted by supervisors will be chronologically logged here.
          </div>
        </div>
      ) : (
        <div className="ro-timeline-container" style={{ padding: '8px 4px' }}>
          {filteredUpdates.map((u) => {
            const act = activityMap[u.activityId] || { name: 'Activity', code: '' };
            return (
              <div key={u._id} className="ro-timeline-item">
                <div className="ro-timeline-node">
                  {u.progress}%
                </div>
                <div className="ro-timeline-content">
                  <div className="ro-timeline-header">
                    <div>
                      <span className="ro-timeline-date">{u.updateDate}</span>
                      <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>•</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}>
                        {act.name} {act.code && `[${act.code}]`}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {u.isDelayed && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                          }}
                        >
                          Obstruction
                        </span>
                      )}
                      <button
                        type="button"
                        className="ro-act-btn-ghost"
                        style={{ fontSize: '11.5px', color: '#d97706', padding: '2px 8px' }}
                        onClick={() => onOpenCorrection(u, act.name)}
                      >
                        Correct Entry
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {u.workDone || 'No work description entered.'}
                  </div>

                  {u.isDelayed && u.delayReason && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        color: '#ef4444',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span><strong>Site Obstruction:</strong> {u.delayReason}</span>
                    </div>
                  )}

                  {/* Photo Thumbnails */}
                  {u.photoIds && u.photoIds.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Site Photographs ({u.photoIds.length})
                      </div>
                      <div className="ro-photo-strip">
                        {u.photoIds.map((pId) => (
                          <img
                            key={pId}
                            src={activityTrackerApi.getPhotoUrl(pId)}
                            alt="Site evidence"
                            className="ro-photo-thumb"
                            onClick={() => setSelectedPhoto(activityTrackerApi.getPhotoUrl(pId))}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audit Trail Badge */}
                  {u.editHistory && u.editHistory.length > 0 && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '2px',
                      }}
                    >
                      <History size={12} /> Corrected on record. Last reason: "{u.editHistory[u.editHistory.length - 1].reason}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
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

