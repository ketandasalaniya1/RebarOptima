import React, { useState, useEffect } from 'react';
import { X, Camera, AlertTriangle, Upload, Check } from 'lucide-react';
import { activityTrackerApi } from '../../../utils/activityTrackerApi';

export default function DailyUpdateModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  activity = null,
  activities = [],
}) {
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [updateDate, setUpdateDate] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [cumulativeProgress, setCumulativeProgress] = useState(0);
  const [isDelayed, setIsDelayed] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [photoIds, setPhotoIds] = useState([]);
  const [photoNames, setPhotoNames] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showRegressionWarning, setShowRegressionWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const targetActivity = activity || activities.find((a) => String(a._id || a.id) === String(selectedActivityId));

  useEffect(() => {
    if (activity) {
      setSelectedActivityId(String(activity._id || activity.id));
      setCumulativeProgress(Number(activity.currentProgress || 0));
    } else {
      setSelectedActivityId(activities[0] ? String(activities[0]._id || activities[0].id) : '');
      setCumulativeProgress(activities[0] ? Number(activities[0].currentProgress || 0) : 0);
    }
    const today = new Date().toISOString().split('T')[0];
    setUpdateDate(today);
    setWorkDescription('');
    setIsDelayed(false);
    setDelayReason('');
    setRemarks('');
    setPhotoIds([]);
    setPhotoNames([]);
    setShowRegressionWarning(false);
    setErrorMsg('');
  }, [activity, activities, isOpen]);

  if (!isOpen) return null;

  const currentActivityProgress = Number(targetActivity?.currentProgress || 0);

  // File / Photo upload handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 10MB limit.');
      return;
    }

    setIsUploadingPhoto(true);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        const res = await activityTrackerApi.uploadPhoto({
          projectId: targetActivity?.projectId || projectId,
          blockId: targetActivity?.blockId,
          activityId: targetActivity?._id || targetActivity?.id,
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          dataBase64: base64Data,
        });

        if (res.photoId) {
          setPhotoIds((prev) => [...prev, res.photoId]);
          setPhotoNames((prev) => [...prev, file.name]);
        }
      } catch (err) {
        setErrorMsg(err?.message || 'Failed to upload photo');
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const executeSubmission = async () => {
    if (!workDescription.trim()) {
      setErrorMsg("Today's work description is required.");
      return;
    }
    if (isDelayed && !delayReason.trim()) {
      setErrorMsg('Reason for delay is mandatory when work is delayed.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await activityTrackerApi.submitDailyUpdate({
        activityId: targetActivity?._id || targetActivity?.id,
        updateDate,
        workDescription: workDescription.trim(),
        cumulativeProgress: Number(cumulativeProgress),
        isDelayed,
        delayReason: isDelayed ? delayReason.trim() : null,
        remarks: remarks.trim() || null,
        photoIds,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to submit daily update');
    } finally {
      setIsSubmitting(false);
      setShowRegressionWarning(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const newProg = Number(cumulativeProgress);
    // Check if progress is reduced compared to current value
    if (newProg < currentActivityProgress && !showRegressionWarning) {
      setShowRegressionWarning(true);
      return;
    }
    executeSubmission();
  };

  return (
    <div className="ro-act-modal-overlay" onClick={onClose}>
      <div className="ro-act-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="ro-act-modal-header">
          <div>
            <h3 className="ro-act-modal-title">Record Daily Progress</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Quick 1–2 minute operational update
            </span>
          </div>
          <button className="ro-btn ro-btn--ghost ro-btn--sm" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ro-act-modal-body">
            {errorMsg && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', fontSize: '12.5px', fontWeight: 600 }}>
                {errorMsg}
              </div>
            )}

            {/* Regression Confirmation Dialog */}
            {showRegressionWarning && (
              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
                  <AlertTriangle size={18} /> Progress Reduction Notice
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                  You entered <strong>{cumulativeProgress}%</strong>, which is lower than the previously recorded progress of <strong>{currentActivityProgress}%</strong>. Are you reporting a progress reversal, rework, or correction?
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button type="button" className="ro-btn ro-btn--secondary ro-btn--sm" onClick={() => setShowRegressionWarning(false)}>
                    Cancel
                  </button>
                  <button type="button" className="ro-btn ro-btn--primary ro-btn--sm" onClick={executeSubmission}>
                    Confirm & Submit
                  </button>
                </div>
              </div>
            )}

            {/* Activity Selection */}
            {!activity && (
              <div className="ro-form-group">
                <label className="ro-form-label">Select Activity *</label>
                <select
                  className="ro-form-input"
                  value={selectedActivityId}
                  onChange={(e) => {
                    setSelectedActivityId(e.target.value);
                    const act = activities.find((a) => String(a._id || a.id) === e.target.value);
                    if (act) setCumulativeProgress(Number(act.currentProgress || 0));
                  }}
                  required
                >
                  {activities.map((a) => (
                    <option key={a._id || a.id} value={a._id || a.id}>
                      {a.name} ({a.currentProgress || 0}%)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activity && (
              <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'var(--main-bg)', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{activity.name}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Current Progress: {activity.currentProgress || 0}%</div>
                </div>
                <span className="ro-act-status-pill in_progress">{activity.status}</span>
              </div>
            )}

            {/* Date Selection */}
            <div className="ro-form-group">
              <label className="ro-form-label">Update Date *</label>
              <input
                type="date"
                className="ro-form-input"
                value={updateDate}
                onChange={(e) => setUpdateDate(e.target.value)}
                required
              />
            </div>

            {/* Work Completed Today */}
            <div className="ro-form-group">
              <label className="ro-form-label">Today's Work Description *</label>
              <textarea
                className="ro-form-textarea"
                rows={3}
                placeholder="e.g. Completed shuttering for columns C1-C8 on 4th floor slab. Reinforcement tying in progress..."
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                required
              />
            </div>

            {/* Cumulative Progress */}
            <div className="ro-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="ro-form-label">Current Cumulative Progress (%) *</label>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>{cumulativeProgress}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={cumulativeProgress}
                  onChange={(e) => setCumulativeProgress(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="ro-form-input"
                  style={{ width: '80px', textAlign: 'center' }}
                  value={cumulativeProgress}
                  onChange={(e) => setCumulativeProgress(Number(e.target.value))}
                  required
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                * Total completion to date, not work done today alone.
              </span>
            </div>

            {/* Delay Reporting Toggle */}
            <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: isDelayed ? 'rgba(220, 38, 38, 0.04)' : 'var(--main-bg)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Is Work Delayed Today?</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`ro-btn ro-btn--sm ${!isDelayed ? 'ro-btn--primary' : 'ro-btn--secondary'}`}
                    onClick={() => setIsDelayed(false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`ro-btn ro-btn--sm ${isDelayed ? 'ro-btn--primary' : 'ro-btn--secondary'}`}
                    style={isDelayed ? { background: '#dc2626', borderColor: '#dc2626' } : {}}
                    onClick={() => setIsDelayed(true)}
                  >
                    Yes, Delayed
                  </button>
                </div>
              </div>

              {isDelayed && (
                <div className="ro-form-group">
                  <label className="ro-form-label" style={{ color: '#dc2626' }}>Reason for Delay *</label>
                  <input
                    type="text"
                    className="ro-form-input"
                    placeholder="e.g. Concrete ready-mix transit delay, labor shortage, rain..."
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value)}
                    required={isDelayed}
                  />
                </div>
              )}
            </div>

            {/* Remarks (Optional) */}
            <div className="ro-form-group">
              <label className="ro-form-label">General Site Remarks (Optional)</label>
              <input
                type="text"
                className="ro-form-input"
                placeholder="Any special equipment, safety observations, or notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            {/* Photograph Capture */}
            <div className="ro-form-group">
              <label className="ro-form-label">Site Photographs (Optional, Max 10MB)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label className="ro-btn ro-btn--secondary ro-btn--sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Camera size={16} /> Attach Photo
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                </label>
                {isUploadingPhoto && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Uploading...</span>}
              </div>
              {photoNames.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {photoNames.map((name, i) => (
                    <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 600 }}>
                      ✓ {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ro-act-modal-footer">
            <button type="button" className="ro-btn ro-btn--secondary ro-btn--md" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="ro-btn ro-btn--primary ro-btn--md" disabled={isSubmitting || isUploadingPhoto}>
              {isSubmitting ? 'Submitting...' : 'Submit Progress (1-Min)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

