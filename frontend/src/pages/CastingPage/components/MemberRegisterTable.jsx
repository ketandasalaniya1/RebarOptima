import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Layers, Calculator, Info, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function MemberRegisterTable({
  members,
  selectedProject,
  selectedBlock,
  selectedLevel,
  onOpenCreateModal,
  onRefreshMembers
}) {
  const [editingMember, setEditingMember] = useState(null);
  const [editDisplayId, setEditDisplayId] = useState('');
  const [editTotalVol, setEditTotalVol] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDeleteMember = async (member) => {
    if (!window.confirm(`Are you sure you want to delete member '${member.displayId}'?`)) return;
    try {
      await castingApi.deleteMember(member.id || member._id);
      await onRefreshMembers();
    } catch (err) {
      alert(err.message || 'Cannot delete member: it may be referenced in casting events.');
    }
  };

  const handleStartEdit = (m) => {
    setEditingMember(m);
    setEditDisplayId(m.displayId || '');
    setEditTotalVol(m.totalRequiredVolumeM3 || '');
    setEditDescription(m.description || '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingMember) return;
    setIsUpdating(true);
    try {
      await castingApi.updateMember(editingMember.id || editingMember._id, {
        displayId: editDisplayId.trim().toUpperCase(),
        totalRequiredVolumeM3: parseFloat(editTotalVol),
        description: editDescription.trim()
      });
      setEditingMember(null);
      await onRefreshMembers();
    } catch (err) {
      alert(err.message || 'Failed to update member');
    } finally {
      setIsUpdating(false);
    }
  };

  const totalRequired = members.reduce((sum, m) => sum + (Number(m.totalRequiredVolumeM3) || 0), 0);
  const totalPoured = members.reduce((sum, m) => sum + (Number(m.actualPouredM3) || 0), 0);
  const totalRemaining = members.reduce((sum, m) => sum + (Number(m.remainingVolumeM3) || 0), 0);

  return (
    <div className="content-pane">
      <div className="content-pane-header">
        <div className="content-pane-title-wrap">
          <h2 className="content-pane-title">
            Structural Members Register
          </h2>
          <span className="content-pane-subtitle">
            {selectedProject?.name || 'Project'} • {selectedBlock?.name || 'Block'} • {selectedLevel?.name || 'Level'} ({members.length} elements)
          </span>
        </div>

        <div className="content-pane-actions">
          {selectedLevel && (
            <button className="casting-btn casting-btn-primary" onClick={onOpenCreateModal}>
              <Plus size={15} /> Add Members
            </button>
          )}
        </div>
      </div>

      {/* Member Level Stats Bar */}
      {selectedLevel && members.length > 0 && (
        <div className="casting-member-stats-bar">
          <div className="casting-member-stat-col">
            <span className="casting-member-stat-lbl">Target Volume</span>
            <span className="casting-member-stat-val primary">{totalRequired.toFixed(3)} m³</span>
          </div>
          <div className="casting-member-stat-col">
            <span className="casting-member-stat-lbl">Actual Poured</span>
            <span className="casting-member-stat-val emerald">{totalPoured.toFixed(3)} m³</span>
          </div>
          <div className="casting-member-stat-col">
            <span className="casting-member-stat-lbl">Balance Volume</span>
            <span className="casting-member-stat-val amber">{totalRemaining.toFixed(3)} m³</span>
          </div>
        </div>
      )}

      {/* Members Grid / Table */}
      {!selectedLevel ? (
        <div className="casting-empty-state">
          <Layers size={42} className="casting-empty-icon" />
          <h4>No Level Selected</h4>
          <p>
            Select a block and level from the left panel to manage structural members.
          </p>
        </div>
      ) : members.length === 0 ? (
        <div className="casting-empty-state">
          <Layers size={42} className="casting-empty-icon" />
          <h4>No Structural Members Registered</h4>
          <p>
            Click '+ Add Members' above to register single elements or generate batch series.
          </p>
          <button className="casting-btn casting-btn-primary" onClick={onOpenCreateModal} style={{ marginTop: '0.75rem' }}>
            <Plus size={15} /> Add Member
          </button>
        </div>
      ) : (
        <div className="casting-table-container">
          <table className="casting-table">
            <thead>
              <tr>
                <th>Mark / ID</th>
                <th>Type</th>
                <th>Dimensions / Basis</th>
                <th>Target Vol</th>
                <th>Poured Vol</th>
                <th>Balance Vol</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const isPartially = m.status === 'Partially_Poured';
                const isCompleted = m.status === 'Completed' || (m.actualPouredM3 >= m.totalRequiredVolumeM3 && m.totalRequiredVolumeM3 > 0);

                return (
                  <tr key={m.id || m._id}>
                    <td className="casting-member-id">
                      {m.displayId}
                    </td>
                    <td>
                      <span className="member-type-tag">
                        {m.memberType}
                      </span>
                    </td>
                    <td>
                      {m.volumeEntryMethod === 'DIMENSIONAL_CALC' && m.dimensions ? (
                        <span className="casting-dimension-txt">
                          {m.dimensions.lengthMm} × {m.dimensions.widthMm} × {m.dimensions.depthMm} mm
                        </span>
                      ) : (
                        <span className="casting-basis-txt" title={m.basisOfCalculation}>
                          <Info size={13} /> Direct Entry
                        </span>
                      )}
                      {m.description && (
                        <div className="casting-desc-sub">
                          {m.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="volume-badge">
                        {(m.totalRequiredVolumeM3 || 0).toFixed(3)} m³
                      </span>
                    </td>
                    <td>
                      <span className={`volume-badge ${(m.actualPouredM3 || 0) > 0 ? 'poured' : 'empty'}`}>
                        {(m.actualPouredM3 || 0).toFixed(3)} m³
                      </span>
                    </td>
                    <td>
                      <span className={`volume-badge ${(m.remainingVolumeM3 || 0) > 0 ? 'amber' : 'empty'}`}>
                        {(m.remainingVolumeM3 !== undefined ? m.remainingVolumeM3 : m.totalRequiredVolumeM3).toFixed(3)} m³
                      </span>
                    </td>
                    <td>
                      <span className={`status-tag ${isCompleted ? 'completed' : isPartially ? 'partially' : 'planned'}`}>
                        <span className="status-dot"></span>
                        {isCompleted ? 'Completed' : isPartially ? 'Partially Poured' : 'Planned'}
                      </span>
                    </td>
                    <td>
                      <div className="casting-row-actions">
                        <button
                          className="casting-action-icon-btn"
                          onClick={() => handleStartEdit(m)}
                          title="Edit Member"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          className="casting-action-btn-danger"
                          onClick={() => handleDeleteMember(m)}
                          title="Delete Member"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="casting-modal-backdrop">
          <div className="casting-modal">
            <div className="casting-modal-header">
              <h3 className="casting-modal-title">Edit Member: {editingMember.displayId}</h3>
              <button className="casting-modal-close" onClick={() => setEditingMember(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="casting-modal-body">
                <div className="form-group">
                  <label className="form-label">Display Mark ID *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editDisplayId}
                    onChange={(e) => setEditDisplayId(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Target Concrete Volume (m³) *</label>
                  <input
                    type="number"
                    step="0.001"
                    className="form-input"
                    value={editTotalVol}
                    onChange={(e) => setEditTotalVol(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="casting-modal-footer">
                <button type="button" className="btn-secondary-dark" onClick={() => setEditingMember(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-teal" disabled={isUpdating}>
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
