import React, { useState, useEffect } from 'react';
import { X, Layers, Calendar, User, FileText, Check } from 'lucide-react';
import { activityTrackerApi } from '../../../utils/activityTrackerApi';

export default function ActivityFormModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  blocks = [],
  selectedBlockId,
  floors = [],
  activities = [],
  editingActivity = null,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [blockId, setBlockId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [parentActivityId, setParentActivityId] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [progressMode, setProgressMode] = useState('MANUAL');
  const [assignedUserIds, setAssignedUserIds] = useState([]);
  const [assigneesList, setAssigneesList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load assignees for active project
  useEffect(() => {
    if (projectId) {
      activityTrackerApi
        .getAssignees(projectId)
        .then((res) => setAssigneesList(Array.isArray(res) ? res : []))
        .catch(() => setAssigneesList([]));
    }
  }, [projectId]);

  // Pre-fill fields on modal open
  useEffect(() => {
    if (editingActivity) {
      setName(editingActivity.name || '');
      setDescription(editingActivity.description || '');
      setBlockId(editingActivity.blockId ? String(editingActivity.blockId) : selectedBlockId || '');
      setFloorId(editingActivity.floorId ? String(editingActivity.floorId) : '');
      setParentActivityId(editingActivity.parentActivityId ? String(editingActivity.parentActivityId) : '');
      setPlannedStartDate(editingActivity.plannedStartDate || '');
      setPlannedEndDate(editingActivity.plannedEndDate || '');
      setProgressMode(editingActivity.progressMode || 'MANUAL');
      setAssignedUserIds(
        (editingActivity.assignedUserIds || []).map((id) => String(id)),
      );
    } else {
      setName('');
      setDescription('');
      setBlockId(selectedBlockId && selectedBlockId !== 'ALL' ? selectedBlockId : blocks[0]?._id || '');
      setFloorId('');
      setParentActivityId('');
      const today = new Date().toISOString().split('T')[0];
      setPlannedStartDate(today);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      setPlannedEndDate(nextWeek);
      setProgressMode('MANUAL');
      setAssignedUserIds([]);
    }
    setErrorMsg('');
  }, [editingActivity, selectedBlockId, blocks, isOpen]);

  if (!isOpen) return null;

  // Level 1 eligible parents (activities that have NO parent themselves)
  const eligibleParents = activities.filter(
    (a) => !a.parentActivityId && (!editingActivity || String(a._id || a.id) !== String(editingActivity._id || editingActivity.id)),
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Activity name is required');
      return;
    }
    if (!blockId) {
      setErrorMsg('Block is required');
      return;
    }
    if (!plannedStartDate || !plannedEndDate) {
      setErrorMsg('Planned start and finish dates are required');
      return;
    }
    if (plannedEndDate < plannedStartDate) {
      setErrorMsg('Planned finish date cannot be earlier than planned start date');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        projectId,
        blockId,
        floorId: floorId || null,
        parentActivityId: parentActivityId || null,
        name: name.trim(),
        description: description.trim(),
        plannedStartDate,
        plannedEndDate,
        progressMode,
        assignedUserIds,
      };

      if (editingActivity) {
        await activityTrackerApi.updateActivity(editingActivity._id || editingActivity.id, payload);
      } else {
        await activityTrackerApi.createActivity(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ro-act-modal-overlay" onClick={onClose}>
      <div className="ro-act-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ro-act-modal-header">
          <h3 className="ro-act-modal-title">
            {editingActivity ? 'Edit Construction Activity' : 'Add Construction Activity'}
          </h3>
          <button className="ro-btn ro-btn--ghost ro-btn--sm" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ro-act-modal-body">
            {errorMsg && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', fontSize: '12.5px', fontWeight: 600 }}>
                {errorMsg}
              </div>
            )}

            {/* Activity Name */}
            <div className="ro-form-group">
              <label className="ro-form-label">Activity Name *</label>
              <input
                type="text"
                className="ro-form-input"
                placeholder="e.g. 4th Floor Column Shuttering & Casting"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Block & Floor Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="ro-form-group">
                <label className="ro-form-label">Block / Tower *</label>
                <select className="ro-form-input" value={blockId} onChange={(e) => setBlockId(e.target.value)} required>
                  <option value="">Select Block</option>
                  {blocks.map((b) => (
                    <option key={b._id || b.id} value={b._id || b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ro-form-group">
                <label className="ro-form-label">Level / Floor (Optional)</label>
                <select className="ro-form-input" value={floorId} onChange={(e) => setFloorId(e.target.value)}>
                  <option value="">No Floor Specified</option>
                  {floors.map((f) => (
                    <option key={f._id || f.id} value={f._id || f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* WBS Hierarchy (Level 1 Parent) */}
            <div className="ro-form-group">
              <label className="ro-form-label">Parent Activity (Strict 2-Level WBS)</label>
              <select className="ro-form-input" value={parentActivityId} onChange={(e) => setParentActivityId(e.target.value)}>
                <option value="">None (Top-Level Parent Activity)</option>
                {eligibleParents.map((p) => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    ↳ Child of: {p.name}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {parentActivityId ? 'This will be created as a Level-2 Component Task under the selected parent.' : 'This will be created as a Level-1 Summary Operation.'}
              </span>
            </div>

            {/* Planned Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="ro-form-group">
                <label className="ro-form-label">Planned Start Date *</label>
                <input
                  type="date"
                  className="ro-form-input"
                  value={plannedStartDate}
                  onChange={(e) => setPlannedStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="ro-form-group">
                <label className="ro-form-label">Planned Finish Date *</label>
                <input
                  type="date"
                  className="ro-form-input"
                  value={plannedEndDate}
                  onChange={(e) => setPlannedEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Progress Mode & Assigned Team Members */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="ro-form-group">
                <label className="ro-form-label">Progress Mode</label>
                <select className="ro-form-input" value={progressMode} onChange={(e) => setProgressMode(e.target.value)}>
                  <option value="MANUAL">Manual Progress Entry</option>
                  <option value="AUTOMATIC">Automatic Weighted from Children</option>
                </select>
              </div>

              <div className="ro-form-group">
                <label className="ro-form-label">Assigned Site Incharge</label>
                <select
                  className="ro-form-input"
                  value={assignedUserIds[0] || ''}
                  onChange={(e) => setAssignedUserIds(e.target.value ? [e.target.value] : [])}
                >
                  <option value="">Unassigned</option>
                  {assigneesList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="ro-form-group">
              <label className="ro-form-label">Operational Scope / Description</label>
              <textarea
                className="ro-form-textarea"
                rows={2}
                placeholder="Specify execution notes, specifications, or quality benchmarks..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="ro-act-modal-footer">
            <button type="button" className="ro-btn ro-btn--secondary ro-btn--md" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="ro-btn ro-btn--primary ro-btn--md" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingActivity ? 'Save Changes' : 'Create Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

