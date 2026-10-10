import React, { useState } from 'react';
import { 
  Plus, Calendar, Clock, CheckCircle2, AlertTriangle, Layers, 
  Trash2, Edit3, ChevronRight, Search, PackageCheck, FileSpreadsheet, 
  FlaskConical, ShieldCheck, Filter
} from 'lucide-react';
import { castingApi } from '../castingApi';

export default function CastingEventList({
  events,
  projects,
  selectedProject,
  onOpenCreateModal,
  onRecordActuals,
  onRefreshEvents,
  onAssignRecipes,
  onViewMRS,
  onReviewConsumption,
  onOpenStockRegister
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = events.filter(e => {
    if (statusFilter !== 'ALL' && (e.status || 'PLANNED').toUpperCase() !== statusFilter) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchNum = e.eventNumber?.toLowerCase().includes(term);
      const matchTitle = e.title?.toLowerCase().includes(term);
      const matchType = e.activityType?.toLowerCase().includes(term);
      if (!matchNum && !matchTitle && !matchType) return false;
    }
    return true;
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
          {/* Search Box */}
          <div className="casting-search-box">
            <Search size={14} className="casting-search-icon" />
            <input
              type="text"
              className="casting-search-input"
              placeholder="Search event # or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <select
            className="casting-select casting-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNED">Planned / Scheduled</option>
            <option value="POURED">Poured / Completed</option>
          </select>

          {selectedProject && onOpenStockRegister && (
            <button
              className="casting-btn casting-btn-secondary"
              onClick={onOpenStockRegister}
              title="Open Project Material Stock Register"
            >
              <PackageCheck size={14} /> Material Stock Register
            </button>
          )}

          {selectedProject && (
            <button className="casting-btn casting-btn-primary" onClick={onOpenCreateModal}>
              <Plus size={15} /> Schedule Pour
            </button>
          )}
        </div>
      </div>

      {/* Events Table / List */}
      {filteredEvents.length === 0 ? (
        <div className="casting-empty-state">
          <Calendar size={42} className="casting-empty-icon" />
          <h4>No Casting Events Scheduled</h4>
          <p>
            Click '+ Schedule Pour' above to create planned casting events with multi-member segments.
          </p>
          {selectedProject && (
            <button className="casting-btn casting-btn-primary" onClick={onOpenCreateModal} style={{ marginTop: '0.75rem' }}>
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
                    <td className="casting-event-code">
                      {e.eventNumber}
                    </td>
                    <td>
                      <div className="casting-event-title">
                        {e.title}
                      </div>
                      <div className="casting-event-meta">
                        {e.activityType?.replace('_', ' ')} • {segmentCount} member segment{segmentCount > 1 ? 's' : ''}
                      </div>
                    </td>
                    <td>
                      <div className="casting-date-cell">
                        <Calendar size={13} className="casting-calendar-icon" />
                        <span>{e.plannedDate}</span>
                      </div>
                      {(e.plannedStartTime || e.plannedEndTime) && (
                        <div className="casting-time-sub">
                          <Clock size={11} /> {e.plannedStartTime || '--:--'} - {e.plannedEndTime || '--:--'}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="volume-badge">
                        {(e.plannedTotalVolumeM3 || 0).toFixed(3)} m³
                      </span>
                    </td>
                    <td>
                      {e.actualPourDate ? (
                        <div className="casting-poured-date">
                          <CheckCircle2 size={13} />
                          <span>{e.actualPourDate}</span>
                        </div>
                      ) : (
                        <span className="casting-text-muted">Not recorded</span>
                      )}
                    </td>
                    <td>
                      <span className={`volume-badge ${(e.actualTotalVolumeM3 || 0) > 0 ? 'poured' : 'empty'}`}>
                        {(e.actualTotalVolumeM3 || 0).toFixed(3)} m³
                      </span>
                    </td>
                    <td>
                      <span className={`status-tag ${isPoured ? 'poured' : 'planned'}`}>
                        <span className="status-dot"></span>
                        {isPoured ? 'Poured' : 'Planned'}
                      </span>
                    </td>
                    <td>
                      <div className="casting-row-actions">
                        <button
                          className="casting-action-btn mrs"
                          onClick={() => onViewMRS && onViewMRS(e)}
                          title="View Material Requirement Sheet (MRS)"
                        >
                          <FileSpreadsheet size={13} /> Material Sheet
                        </button>

                        {!isPoured && (
                          <button
                            className="casting-action-btn recipes"
                            onClick={() => onAssignRecipes && onAssignRecipes(e)}
                            title="Assign Mix Recipes to Segments"
                          >
                            <FlaskConical size={13} /> Mix Recipes
                          </button>
                        )}

                        <button
                          className="casting-action-btn actuals"
                          onClick={() => onRecordActuals(e)}
                          title="Record Actual Pour & Material Consumption"
                        >
                          <CheckCircle2 size={13} /> {isPoured ? 'Actuals' : 'Record Actuals'}
                        </button>

                        <button
                          className="casting-action-btn review"
                          onClick={() => onReviewConsumption && onReviewConsumption(e)}
                          title="Maker-Checker Review & Atomic Stock Posting"
                        >
                          <ShieldCheck size={13} /> Review & Post
                        </button>

                        <button
                          className="casting-action-btn-danger"
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

