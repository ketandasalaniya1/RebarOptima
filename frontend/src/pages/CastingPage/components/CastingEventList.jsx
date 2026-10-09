import React, { useState } from 'react';
import { Plus, Calendar, Clock, CheckCircle2, AlertTriangle, Layers, Trash2, Edit3, ChevronRight } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function CastingEventList({
  events,
  projects,
  selectedProject,
  onOpenCreateModal,
  onRecordActuals,
  onRefreshEvents,
  onAssignRecipes,
  onViewMRS
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);

  const filteredEvents = events.filter(e => {
    if (statusFilter === 'ALL') return true;
    return (e.status || 'PLANNED').toUpperCase() === statusFilter;
  });

  const handleCancelEvent = async (event) => {
    if (!window.confirm(`Are you sure you want to cancel event '${event.title}' (${event.eventNumber})?`)) return;
    try {
      await castingApi.deleteEvent(event.id || event._id, 'Cancelled by site engineer');
      await onRefreshEvents();
    } catch (err) {
      alert(err.message || 'Failed to cancel casting event');
    }
  };

  return (
    <div className="content-pane">
      <div className="content-pane-header">
        <div className="content-pane-title-wrap">
          <h2 className="content-pane-title">Casting Events & Pour Register</h2>
          <span className="content-pane-subtitle">
            Scheduled & Executed Concrete Pour Log ({filteredEvents.length} events)
          </span>
        </div>

        <div className="content-pane-actions">
          {/* Status Filter */}
          <select
            className="casting-select"
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNED">Planned / Scheduled</option>
            <option value="POURED">Poured / Completed</option>
          </select>

          {selectedProject && (
            <button className="btn-primary-teal" onClick={onOpenCreateModal}>
              <Plus size={16} /> + Schedule Pour
            </button>
          )}
        </div>
      </div>

      {/* Events Table / List */}
      {filteredEvents.length === 0 ? (
        <div className="casting-empty-state">
          <Calendar size={42} className="casting-empty-icon" />
          <h4 style={{ margin: 0, color: '#f8fafc' }}>No Casting Events Scheduled</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Click '+ Schedule Pour' above to create planned casting events with multi-member segments.
          </p>
          {selectedProject && (
            <button className="btn-primary-teal" onClick={onOpenCreateModal} style={{ marginTop: '0.5rem' }}>
              <Plus size={15} /> Schedule Pour
            </button>
          )}
        </div>
      ) : (
        <div className="casting-table-container">
          <table className="casting-table">
            <thead>
              <tr>
                <th>Event #</th>
                <th>Title / Activity</th>
                <th>Planned Date & Time</th>
                <th>Planned Vol</th>
                <th>Actual Pour Date</th>
                <th>Actual Vol</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(e => {
                const isPoured = e.status === 'POURED';
                const segmentCount = (e.segments || []).length;

                return (
                  <tr key={e.id || e._id}>
                    <td style={{ fontWeight: 700, color: '#2dd4bf', fontFamily: 'monospace' }}>
                      {e.eventNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                        {e.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                        {e.activityType?.replace('_', ' ')} • {segmentCount} member segment{segmentCount > 1 ? 's' : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#cbd5e1' }}>
                        <Calendar size={13} className="text-teal-400" />
                        {e.plannedDate}
                      </div>
                      {(e.plannedStartTime || e.plannedEndTime) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                          <Clock size={11} /> {e.plannedStartTime || '--:--'} - {e.plannedEndTime || '--:--'}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="volume-badge" style={{ color: '#f8fafc' }}>
                        {(e.plannedTotalVolumeM3 || 0).toFixed(3)} m³
                      </span>
                    </td>
                    <td>
                      {e.actualPourDate ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399' }}>
                          <CheckCircle2 size={13} />
                          {e.actualPourDate}
                        </div>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Not recorded</span>
                      )}
                    </td>
                    <td>
                      <span className="volume-badge" style={{ color: (e.actualTotalVolumeM3 || 0) > 0 ? '#34d399' : '#64748b' }}>
                        {(e.actualTotalVolumeM3 || 0).toFixed(3)} m³
                      </span>
                    </td>
                    <td>
                      <span className={`status-tag ${isPoured ? 'poured' : 'planned'}`}>
                        {isPoured ? 'Poured' : 'Planned'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn-secondary-dark"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', background: '#3b82f6', borderColor: '#2563eb', color: '#fff' }}
                          onClick={() => onViewMRS && onViewMRS(e)}
                          title="View Material Requirement Sheet"
                        >
                          📦 Material Sheet (MRS)
                        </button>

                        {!isPoured && (
                          <button
                            className="btn-secondary-dark"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => onAssignRecipes && onAssignRecipes(e)}
                            title="Assign Mix Recipes to Segments"
                          >
                            🧪 Mix Recipes
                          </button>
                        )}

                        {!isPoured && (
                          <button
                            className="btn-primary-teal"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => onRecordActuals(e)}
                            title="Record Actual Pour Execution"
                          >
                            <CheckCircle2 size={13} /> Record Actuals
                          </button>
                        )}
                        {isPoured && (
                          <button
                            className="btn-secondary-dark"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => onRecordActuals(e)}
                            title="Update Actual Pour Data"
                          >
                            <Edit3 size={13} /> Edit Actuals
                          </button>
                        )}
                        <button
                          className="btn-icon-danger"
                          onClick={() => handleCancelEvent(e)}
                          title="Cancel Event"
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
    </div>
  );
}
