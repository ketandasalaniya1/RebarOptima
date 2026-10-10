import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Filter, Search, RefreshCw, ChevronLeft, ChevronRight,
  Layers, CheckCircle2, AlertTriangle, AlertOctagon, XCircle, FileText,
  FlaskConical, Droplets, Info, Check, Eye, ArrowRight, BarChart3,
  CalendarDays, GitCommit, SlidersHorizontal, ChevronDown, CheckSquare, Shield
} from 'lucide-react';
import { castingApi } from '../castingApi';

export default function CastingTimelineView({ selectedProject, blocks = [], levels = {}, members = [] }) {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Primary Views: 'timeline' | 'calendar'
  const [viewType, setViewType] = useState('timeline');

  // Timeline Scale / Zoom: 'day' | 'week' | 'month'
  const [timelineZoom, setTimelineZoom] = useState('day');

  // Calendar Controls
  const [calendarMode, setCalendarMode] = useState('month'); // 'month' | 'week'
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Filter State
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('ALL'); // 'ALL' | 'THIS_MONTH' | 'NEXT_MONTH' | 'UPCOMING'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Drawer / Modal for Event Details
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [drawerActiveTab, setDrawerActiveTab] = useState('overview'); // 'overview' | 'segments' | 'quality' | 'consumption'

  const projectId = selectedProject?.id || selectedProject?._id;

  // Load events on mount and when filters change
  useEffect(() => {
    if (projectId) {
      loadTimelineData();
    }
  }, [projectId, selectedBlockId, selectedLevelId, selectedStatus, dateRangePreset, customStartDate, customEndDate]);

  const loadTimelineData = async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const params = { projectId };
      if (selectedBlockId) params.blockId = selectedBlockId;
      if (selectedLevelId) params.levelId = selectedLevelId;
      if (selectedStatus && selectedStatus !== 'ALL') params.status = selectedStatus;

      // Handle Date Presets
      const now = new Date();
      if (dateRangePreset === 'THIS_MONTH') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        params.startDate = start;
        params.endDate = end;
      } else if (dateRangePreset === 'NEXT_MONTH') {
        const start = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];
        params.startDate = start;
        params.endDate = end;
      } else if (dateRangePreset === 'UPCOMING') {
        params.startDate = now.toISOString().split('T')[0];
      } else if (dateRangePreset === 'CUSTOM') {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      }

      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await castingApi.getTimelineEvents(params);
      if (res.success) {
        setEvents(Array.isArray(res.data) ? res.data : []);
        setSummary(res.summary || null);
      } else {
        setErrorMsg(res.message || 'Failed to fetch timeline');
      }
    } catch (err) {
      console.error('Error fetching timeline events:', err);
      setErrorMsg(err.message || 'Error loading timeline events');
    } finally {
      setLoading(false);
    }
  };

  // Filter client-side by live search query if typed
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase().trim();
    return events.filter(e => {
      const titleMatch = e.title?.toLowerCase().includes(q);
      const numMatch = e.eventNumber?.toLowerCase().includes(q);
      const actMatch = e.activityType?.toLowerCase().includes(q);
      const memberMatch = e.segmentsSummary?.membersCovered?.some(m => m.displayId?.toLowerCase().includes(q));
      const blockMatch = e.segmentsSummary?.blocksCovered?.some(b => b.name?.toLowerCase().includes(q));
      return titleMatch || numMatch || actMatch || memberMatch || blockMatch;
    });
  }, [events, searchQuery]);

  // Load single event details for Drawer
  const handleOpenEventDetails = async (eventId) => {
    setSelectedEventId(eventId);
    setDrawerActiveTab('overview');
    setLoadingDetails(true);
    try {
      const res = await castingApi.getTimelineEventDetails(eventId);
      if (res.success) {
        setEventDetails(res.data);
      } else {
        setEventDetails(null);
      }
    } catch (err) {
      console.error('Error loading event details:', err);
      setEventDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Helper for status badge styling
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'POURED': return 'success';
      case 'POURING': return 'warning';
      case 'CANCELLED': return 'danger';
      case 'PLANNED':
      default: return 'neutral';
    }
  };

  // Helper for delay metrics badge styling
  const getDelayBadgeClass = (delayStatus) => {
    switch (delayStatus) {
      case 'ON_SCHEDULE': return 'success';
      case 'DELAYED': return 'danger';
      case 'OVERDUE': return 'warning';
      case 'EARLY': return 'purple';
      case 'CANCELLED': return 'neutral';
      case 'INCOMPLETE_TIMESTAMPS':
      default: return 'neutral';
    }
  };

  // -------------------------------------------------------------
  // CALENDAR CALCULATION HELPERS
  // -------------------------------------------------------------
  const calendarDays = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = lastDayOfMonth.getDate();

    const prevMonthDaysCount = startDayOfWeek;
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];

    // Days from previous month
    for (let i = prevMonthDaysCount - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        dateString: d.toISOString().split('T')[0],
        isCurrentMonth: false,
        isToday: d.toDateString() === new Date().toDateString()
      });
    }

    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        dateString: d.toISOString().split('T')[0],
        isCurrentMonth: true,
        isToday: d.toDateString() === new Date().toDateString()
      });
    }

    // Remaining days to fill 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dateString: d.toISOString().split('T')[0],
        isCurrentMonth: false,
        isToday: d.toDateString() === new Date().toDateString()
      });
    }

    return days;
  }, [currentCalendarDate]);

  // Group events by date for calendar lookup
  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const e of filteredEvents) {
      const d = e.plannedDate;
      if (d) {
        if (!map.has(d)) map.set(d, []);
        map.get(d).push(e);
      }
    }
    return map;
  }, [filteredEvents]);

  const handlePrevCalendar = () => {
    if (calendarMode === 'month') {
      setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
    } else {
      const prev = new Date(currentCalendarDate);
      prev.setDate(prev.getDate() - 7);
      setCurrentCalendarDate(prev);
    }
  };

  const handleNextCalendar = () => {
    if (calendarMode === 'month') {
      setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
    } else {
      const next = new Date(currentCalendarDate);
      next.setDate(next.getDate() + 7);
      setCurrentCalendarDate(next);
    }
  };

  const handleTodayCalendar = () => {
    setCurrentCalendarDate(new Date());
  };

  const currentMonthName = currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // -------------------------------------------------------------
  // TIMELINE GROUPING (Chronological Milestones)
  // -------------------------------------------------------------
  const groupedTimelineEvents = useMemo(() => {
    const groups = [];
    const dateMap = new Map();

    for (const e of filteredEvents) {
      const dateKey = e.plannedDate || 'Undated';
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey).push(e);
    }

    // Sort by dateKey ascending
    const sortedDates = Array.from(dateMap.keys()).sort();
    for (const d of sortedDates) {
      groups.push({
        dateKey: d,
        formattedDate: d !== 'Undated' ? new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        }) : 'Undated Events',
        events: dateMap.get(d)
      });
    }

    return groups;
  }, [filteredEvents]);

  const currentBlockLevels = levels[selectedBlockId] || [];

  return (
    <div className="casting-timeline-container">
      {/* 1. Header & View Controls Bar */}
      <div className="timeline-header-bar">
        <div className="timeline-header-left">
          <div className="view-badge teal">
            <CalendarDays size={16} /> Phase 5 Visual Planning
          </div>
          <h3 className="timeline-title">Casting Timeline & Visual Schedule</h3>
        </div>

        <div className="timeline-header-actions">
          {/* Primary View Switcher */}
          <div className="view-mode-toggle">
            <button
              className={`view-toggle-btn ${viewType === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewType('timeline')}
              title="Horizontal Flowchart Timeline"
            >
              <GitCommit size={15} /> Flowchart Timeline
            </button>
            <button
              className={`view-toggle-btn ${viewType === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewType('calendar')}
              title="Interactive Calendar View"
            >
              <Calendar size={15} /> Calendar Grid
            </button>
          </div>

          <button
            className="btn-secondary btn-sm"
            onClick={loadTimelineData}
            disabled={loading}
            title="Refresh Timeline"
          >
            <RefreshCw size={14} className={loading ? 'spinning-icon' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Bar */}
      {summary && (
        <div className="timeline-kpi-bar">
          <div className="timeline-kpi-card">
            <span className="kpi-label">Total Events</span>
            <span className="kpi-value">{summary.total}</span>
          </div>
          <div className="timeline-kpi-card">
            <span className="kpi-label">Planned / Staged</span>
            <span className="kpi-value text-blue">{summary.planned}</span>
          </div>
          <div className="timeline-kpi-card">
            <span className="kpi-label">Pouring Active</span>
            <span className="kpi-value text-amber">{summary.pouring}</span>
          </div>
          <div className="timeline-kpi-card">
            <span className="kpi-label">Successfully Poured</span>
            <span className="kpi-value text-teal">{summary.poured}</span>
          </div>
          <div className="timeline-kpi-card">
            <span className="kpi-label">Delayed Execution</span>
            <span className="kpi-value text-rose">{summary.delayed}</span>
          </div>
          <div className="timeline-kpi-card">
            <span className="kpi-label">Overdue Schedule</span>
            <span className="kpi-value text-orange">{summary.overdue}</span>
          </div>
        </div>
      )}

      {/* 3. Structural Hierarchy & Date Filter Bar */}
      <div className="timeline-filter-strip">
        <div className="filter-item">
          <Layers size={14} />
          <span className="filter-label">Block:</span>
          <select
            value={selectedBlockId}
            onChange={(e) => {
              setSelectedBlockId(e.target.value);
              setSelectedLevelId('');
            }}
            className="filter-select"
          >
            <option value="">All Blocks</option>
            {blocks.map(b => (
              <option key={b._id || b.id} value={b._id || b.id}>{b.name || b.blockName}</option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <span className="filter-label">Level:</span>
          <select
            value={selectedLevelId}
            onChange={(e) => setSelectedLevelId(e.target.value)}
            className="filter-select"
            disabled={!selectedBlockId && currentBlockLevels.length === 0}
          >
            <option value="">All Levels</option>
            {currentBlockLevels.map(l => (
              <option key={l._id || l.id} value={l._id || l.id}>{l.name || l.levelName}</option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <span className="filter-label">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="POURING">Pouring Active</option>
            <option value="POURED">Poured</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="filter-item">
          <Calendar size={14} />
          <span className="filter-label">Range:</span>
          <select
            value={dateRangePreset}
            onChange={(e) => setDateRangePreset(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Dates</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="NEXT_MONTH">Next Month</option>
            <option value="UPCOMING">Upcoming (Today+)</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
        </div>

        {dateRangePreset === 'CUSTOM' && (
          <div className="custom-range-inputs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="filter-date-input"
            />
            <span className="range-to">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="filter-date-input"
            />
          </div>
        )}

        <div className="search-filter-box">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search title, event #, member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="filter-search-input"
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="alert-banner danger mt-2">
          <AlertOctagon size={16} /> {errorMsg}
        </div>
      )}

      {/* 4. MAIN VIEWPORT */}
      <div className="timeline-main-viewport">
        {loading ? (
          <div className="loading-state-pane">
            <RefreshCw size={28} className="spinning-icon" />
            <span>Compiling Chronological Casting Timeline & Quality Context...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state-pane">
            <Calendar size={40} className="empty-icon" />
            <h4>No Casting Events Found</h4>
            <p className="text-muted">No casting events match the selected filters or date range.</p>
          </div>
        ) : viewType === 'timeline' ? (
          /* ============================================================ */
          /* FLOWCHART / TIMELINE STREAM VIEW                             */
          /* ============================================================ */
          <div className="flowchart-timeline-stream">
            {groupedTimelineEvents.map((group, gIdx) => (
              <div key={group.dateKey} className="timeline-milestone-group">
                {/* Milestone Node */}
                <div className="timeline-date-marker">
                  <div className="milestone-badge">
                    <Calendar size={14} />
                    <span>{group.formattedDate}</span>
                  </div>
                  <div className="milestone-line"></div>
                </div>

                {/* Event Cards in this Date Node */}
                <div className="timeline-events-track">
                  {group.events.map((evt) => {
                    const statusClass = getStatusBadgeClass(evt.status);
                    const delayClass = getDelayBadgeClass(evt.delayMetrics?.delayStatus);
                    const isPoured = evt.status === 'POURED';

                    return (
                      <div
                        key={evt.id}
                        className={`timeline-event-card status-${evt.status.toLowerCase()}`}
                        onClick={() => handleOpenEventDetails(evt.id)}
                      >
                        {/* Card Header */}
                        <div className="event-card-header">
                          <div className="event-identity">
                            <span className="event-number-pill">{evt.eventNumber}</span>
                            <span className="event-activity-tag">{evt.activityType}</span>
                          </div>
                          <div className="event-badges-row">
                            <span className={`status-badge ${statusClass}`}>
                              {evt.status}
                            </span>
                            {evt.delayMetrics?.isDelayCalculable && (
                              <span className={`status-badge ${delayClass}`} title={evt.delayMetrics?.delayStatus}>
                                <Clock size={11} /> {evt.delayMetrics?.delayDurationText}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="event-card-title">{evt.title}</h4>

                        {/* Timestamps: Planned vs Actual Comparison */}
                        <div className="event-timing-grid">
                          <div className="timing-box planned">
                            <span className="timing-label">Scheduled:</span>
                            <span className="timing-val">
                              {evt.plannedDate} {evt.plannedStartTime ? `(${evt.plannedStartTime})` : ''}
                            </span>
                          </div>
                          <div className="timing-box actual">
                            <span className="timing-label">Actual Pour:</span>
                            <span className="timing-val">
                              {evt.actualPourDate ? (
                                <span>{evt.actualPourDate} {evt.actualPourStartTime ? `(${evt.actualPourStartTime})` : ''}</span>
                              ) : isPoured ? (
                                <span className="text-muted">Recorded</span>
                              ) : (
                                <span className="text-muted">Awaiting Pour</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Structural Members & Segments Covered */}
                        <div className="event-structural-summary">
                          <div className="structural-tags-list">
                            {evt.segmentsSummary?.blocksCovered?.map(b => (
                              <span key={b.id} className="hierarchy-pill block-pill">{b.name}</span>
                            ))}
                            {evt.segmentsSummary?.levelsCovered?.map(l => (
                              <span key={l.id} className="hierarchy-pill level-pill">{l.name}</span>
                            ))}
                            {evt.segmentsSummary?.membersCovered?.slice(0, 3).map(m => (
                              <span key={m.id} className="hierarchy-pill member-pill">{m.displayId}</span>
                            ))}
                            {evt.segmentsSummary?.membersCovered?.length > 3 && (
                              <span className="hierarchy-pill more-pill">
                                +{evt.segmentsSummary.membersCovered.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Volume Progress Bar */}
                        <div className="event-volume-bar-section">
                          <div className="volume-labels">
                            <span>Vol: <strong>{evt.plannedTotalVolumeM3.toFixed(2)} m³</strong> planned</span>
                            {evt.actualTotalVolumeM3 !== undefined && (
                              <span>Act: <strong>{evt.actualTotalVolumeM3.toFixed(2)} m³</strong></span>
                            )}
                          </div>
                          <div className="volume-progress-track">
                            <div
                              className={`volume-progress-fill ${isPoured ? 'complete' : ''}`}
                              style={{
                                width: isPoured
                                  ? '100%'
                                  : evt.status === 'POURING' ? '50%' : '15%'
                              }}
                            ></div>
                          </div>
                        </div>

                        {/* Contextual Phase 4 Quality Strip (Curing & Cubes) */}
                        <div className="event-quality-strip">
                          {evt.qualityContext?.curingStatus !== 'NOT_SCHEDULED' ? (
                            <span className={`quality-pill ${evt.qualityContext.curingStatus === 'COMPLETED' ? 'success' : 'warning'}`}>
                              <Droplets size={11} /> Curing: {evt.qualityContext.curingStatus} ({evt.qualityContext.curingDaysCompleted}/{evt.qualityContext.curingTargetDays}d)
                            </span>
                          ) : (
                            <span className="quality-pill neutral">
                              <Droplets size={11} /> Curing: Pending
                            </span>
                          )}

                          {evt.qualityContext?.cubeStatus !== 'NO_SAMPLES' ? (
                            <span className={`quality-pill ${evt.qualityContext.cubeStatus === 'VALID' ? 'success' : evt.qualityContext.cubeStatus === 'INVALID' ? 'danger' : 'warning'}`}>
                              <FlaskConical size={11} /> Cubes: {evt.qualityContext.averageStrengthMpa ? `${evt.qualityContext.averageStrengthMpa} MPa` : evt.qualityContext.cubeStatus}
                            </span>
                          ) : (
                            <span className="quality-pill neutral">
                              <FlaskConical size={11} /> Cubes: No samples
                            </span>
                          )}

                          <button className="card-details-action" title="View Detailed Inspection">
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ============================================================ */
          /* INTERACTIVE CALENDAR GRID VIEW                               */
          /* ============================================================ */
          <div className="interactive-calendar-view">
            {/* Calendar Controls */}
            <div className="calendar-nav-toolbar">
              <div className="calendar-nav-left">
                <button className="btn-secondary btn-xs" onClick={handlePrevCalendar}>
                  <ChevronLeft size={16} />
                </button>
                <button className="btn-outline btn-xs" onClick={handleTodayCalendar}>
                  Today
                </button>
                <button className="btn-secondary btn-xs" onClick={handleNextCalendar}>
                  <ChevronRight size={16} />
                </button>
                <span className="current-month-heading">{currentMonthName}</span>
              </div>
              <div className="calendar-stats-info">
                Showing {filteredEvents.length} events this period
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="calendar-grid-header">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="calendar-header-cell">{day}</div>
              ))}
            </div>

            {/* Calendar Month Grid */}
            <div className="calendar-grid-body">
              {calendarDays.map((cell, idx) => {
                const dayEvents = eventsByDate.get(cell.dateString) || [];
                return (
                  <div
                    key={idx}
                    className={`calendar-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''}`}
                  >
                    <div className="cell-day-number">
                      <span>{cell.date.getDate()}</span>
                      {dayEvents.length > 0 && (
                        <span className="day-events-counter">{dayEvents.length}</span>
                      )}
                    </div>

                    <div className="cell-events-container">
                      {dayEvents.slice(0, 3).map(ev => {
                        const statusClass = getStatusBadgeClass(ev.status);
                        const delayClass = getDelayBadgeClass(ev.delayMetrics?.delayStatus);
                        return (
                          <div
                            key={ev.id}
                            className={`calendar-event-chip status-${ev.status.toLowerCase()}`}
                            onClick={() => handleOpenEventDetails(ev.id)}
                            title={`${ev.eventNumber}: ${ev.title} (${ev.plannedTotalVolumeM3} m³)`}
                          >
                            <span className="chip-code">{ev.eventNumber}</span>
                            <span className="chip-title">{ev.title}</span>
                            {ev.delayMetrics?.delayStatus === 'DELAYED' && (
                              <span className="chip-delay-dot delayed" title="Delayed"></span>
                            )}
                            {ev.delayMetrics?.delayStatus === 'OVERDUE' && (
                              <span className="chip-delay-dot overdue" title="Overdue"></span>
                            )}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="calendar-more-events">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. EVENT DETAILS DRAWER / MODAL */}
      {selectedEventId && (
        <div className="modal-backdrop">
          <div className="modal-content large event-details-drawer">
            <div className="modal-header">
              <div className="drawer-header-left">
                <span className="event-number-badge">{eventDetails?.eventNumber || 'Casting Event'}</span>
                <h3>{eventDetails?.title || 'Event Details'}</h3>
              </div>
              <button className="btn-close" onClick={() => setSelectedEventId(null)}>×</button>
            </div>

            {loadingDetails ? (
              <div className="loading-state-pane p-5">
                <RefreshCw size={24} className="spinning-icon" />
                <span>Fetching Event Specifications & Contextual Quality Records...</span>
              </div>
            ) : eventDetails ? (
              <>
                {/* Drawer Tab Navigation */}
                <div className="drawer-tabs-strip">
                  <button
                    className={`drawer-tab-btn ${drawerActiveTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setDrawerActiveTab('overview')}
                  >
                    <Info size={14} /> Overview & Schedule
                  </button>
                  <button
                    className={`drawer-tab-btn ${drawerActiveTab === 'segments' ? 'active' : ''}`}
                    onClick={() => setDrawerActiveTab('segments')}
                  >
                    <Layers size={14} /> Structural Segments ({eventDetails.segments?.length || 0})
                  </button>
                  <button
                    className={`drawer-tab-btn ${drawerActiveTab === 'quality' ? 'active' : ''}`}
                    onClick={() => setDrawerActiveTab('quality')}
                  >
                    <Shield size={14} /> Quality (Curing & Cubes)
                  </button>
                  <button
                    className={`drawer-tab-btn ${drawerActiveTab === 'consumption' ? 'active' : ''}`}
                    onClick={() => setDrawerActiveTab('consumption')}
                  >
                    <FlaskConical size={14} /> Mix Recipe & Consumption
                  </button>
                </div>

                <div className="modal-body drawer-body">
                  {/* TAB 1: OVERVIEW & TIMING COMPARISON */}
                  {drawerActiveTab === 'overview' && (
                    <div className="drawer-tab-pane">
                      <div className="timing-comparison-card">
                        <div className="comparison-col">
                          <span className="col-header">PLANNED SPECIFICATION</span>
                          <div className="info-row">
                            <span className="info-label">Scheduled Date:</span>
                            <span className="info-val font-semibold">{eventDetails.plannedDate}</span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Planned Time:</span>
                            <span className="info-val">{eventDetails.plannedStartTime || '08:00'} - {eventDetails.plannedEndTime || '17:00'}</span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Planned Volume:</span>
                            <span className="info-val font-semibold">{eventDetails.plannedTotalVolumeM3} m³</span>
                          </div>
                        </div>

                        <div className="comparison-divider">
                          <ArrowRight size={20} />
                        </div>

                        <div className="comparison-col">
                          <span className="col-header">ACTUAL EXECUTION</span>
                          <div className="info-row">
                            <span className="info-label">Actual Pour Date:</span>
                            <span className="info-val font-semibold">
                              {eventDetails.actualPourDate || (
                                eventDetails.status === 'POURED' ? 'Recorded' : 'Awaiting Pour'
                              )}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Actual Pour Time:</span>
                            <span className="info-val">
                              {eventDetails.actualPourStartTime ? `${eventDetails.actualPourStartTime} - ${eventDetails.actualPourEndTime || ''}` : 'Not recorded'}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Actual Volume:</span>
                            <span className="info-val font-semibold">
                              {eventDetails.actualTotalVolumeM3 !== undefined ? `${eventDetails.actualTotalVolumeM3} m³` : 'Pending actuals'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Delay Analysis Box */}
                      {eventDetails.delayMetrics && (
                        <div className={`delay-analysis-banner ${eventDetails.delayMetrics.delayStatus.toLowerCase()}`}>
                          <div className="delay-banner-title">
                            <Clock size={16} />
                            <strong>Delay Status: {eventDetails.delayMetrics.delayStatus}</strong>
                          </div>
                          <p className="delay-banner-desc">
                            {eventDetails.delayMetrics.delayDurationText}.
                            {eventDetails.delayMetrics.isDelayCalculable
                              ? ` Calculated from planned timestamp (${eventDetails.plannedDate}) vs ${eventDetails.actualPourDate ? `actual execution date (${eventDetails.actualPourDate})` : 'current date'}.`
                              : ' Reliable timestamp verification required for delay calculation.'}
                          </p>
                        </div>
                      )}

                      {/* General Attributes */}
                      <div className="form-row-grid mt-3">
                        <div className="info-block">
                          <span className="info-label">Activity Type:</span>
                          <span className="info-val">{eventDetails.activityType}</span>
                        </div>
                        <div className="info-block">
                          <span className="info-label">Lifecycle Status:</span>
                          <span className={`status-badge ${getStatusBadgeClass(eventDetails.status)}`}>
                            {eventDetails.status}
                          </span>
                        </div>
                      </div>

                      {eventDetails.notes && (
                        <div className="info-block mt-3">
                          <span className="info-label">Casting Notes & Instructions:</span>
                          <p className="text-sm bg-muted p-2 rounded mt-1">{eventDetails.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: STRUCTURAL SEGMENTS */}
                  {drawerActiveTab === 'segments' && (
                    <div className="drawer-tab-pane">
                      <table className="quality-table">
                        <thead>
                          <tr>
                            <th>Segment Name</th>
                            <th>Block / Level</th>
                            <th>Concrete Grade</th>
                            <th>Planned Vol (m³)</th>
                            <th>Actual Vol (m³)</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventDetails.segments?.map((seg, idx) => (
                            <tr key={idx}>
                              <td><strong>{seg.segmentName || `Lift ${seg.segmentLiftNumber || 1}`}</strong></td>
                              <td>{seg.blockName || 'Block'} / {seg.levelName || 'Level'}</td>
                              <td><span className="badge-tag grade-tag">{seg.grade || 'M25'}</span></td>
                              <td><strong>{seg.plannedVolumeM3}</strong></td>
                              <td>{seg.actualVolumeM3 !== undefined ? seg.actualVolumeM3 : '-'}</td>
                              <td>
                                <span className={`status-badge ${seg.status === 'POURED' ? 'success' : 'neutral'}`}>
                                  {seg.status || 'PLANNED'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 3: CONTEXTUAL QUALITY (PHASE 4) */}
                  {drawerActiveTab === 'quality' && (
                    <div className="drawer-tab-pane">
                      <div className="section-header">
                        <h4>Phase 4 Curing Management</h4>
                      </div>
                      {eventDetails.contextualDetails?.curingSchedule ? (
                        <div className="card-box p-3 mb-3">
                          <div className="flex-between">
                            <strong>Schedule: {eventDetails.contextualDetails.curingSchedule.method}</strong>
                            <span className={`status-badge ${eventDetails.contextualDetails.curingSchedule.status === 'ACTIVE' ? 'success' : 'warning'}`}>
                              {eventDetails.contextualDetails.curingSchedule.status}
                            </span>
                          </div>
                          <div className="text-sm mt-2 text-muted">
                            Target Duration: {eventDetails.contextualDetails.curingSchedule.targetDurationDays} days | Cement: {eventDetails.contextualDetails.curingSchedule.cementType}
                          </div>
                          <div className="text-sm mt-1 text-muted">
                            Daily Inspection Logs Recorded: <strong>{eventDetails.contextualDetails.curingLogsCount || 0}</strong>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted text-sm">No curing schedule assigned to this casting event yet.</p>
                      )}

                      <div className="section-header mt-4">
                        <h4>Phase 4 Concrete Cube Strength Results (IS 456)</h4>
                      </div>
                      {eventDetails.contextualDetails?.cubeSamples?.length > 0 ? (
                        <table className="quality-table">
                          <thead>
                            <tr>
                              <th>Sample #</th>
                              <th>Grade</th>
                              <th>Age</th>
                              <th>Average (MPa)</th>
                              <th>Cl 15.4 Validity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventDetails.contextualDetails.cubeSamples.map((cb, idx) => (
                              <tr key={idx}>
                                <td><strong>{cb.sampleNumber}</strong></td>
                                <td>{cb.concreteGrade}</td>
                                <td>{cb.testingAgeDays} Days</td>
                                <td><strong>{cb.sampleAverageMpa?.toFixed(2) || '-'} MPa</strong></td>
                                <td>
                                  <span className={`status-badge ${cb.status === 'VALID' ? 'success' : 'danger'}`}>
                                    {cb.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-muted text-sm">No cube specimens registered for this event yet.</p>
                      )}
                    </div>
                  )}

                  {/* TAB 4: MIX RECIPE & CONSUMPTION (PHASE 2 & 3) */}
                  {drawerActiveTab === 'consumption' && (
                    <div className="drawer-tab-pane">
                      <div className="section-header">
                        <h4>Material Requirement Sheet (MRS)</h4>
                      </div>
                      {eventDetails.mrsRevisions?.length > 0 ? (
                        <div className="card-box p-3 mb-3">
                          <div className="flex-between">
                            <strong>Latest MRS Revision #{eventDetails.mrsRevisions[eventDetails.mrsRevisions.length - 1].revisionNumber}</strong>
                            <span className="badge-tag">{eventDetails.mrsRevisions[eventDetails.mrsRevisions.length - 1].mrsCode}</span>
                          </div>
                          <div className="text-sm text-muted mt-1">
                            Total Planned Volume: {eventDetails.mrsRevisions[eventDetails.mrsRevisions.length - 1].totalPlannedVolumeM3} m³
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted text-sm">No MRS generated for this event yet.</p>
                      )}

                      <div className="section-header mt-4">
                        <h4>Phase 3 Material Consumption Status</h4>
                      </div>
                      {eventDetails.contextualDetails?.consumptionRecord ? (
                        <div className="card-box p-3">
                          <div className="flex-between">
                            <strong>Record ID: {eventDetails.contextualDetails.consumptionRecord.consumptionNumber || 'CR-001'}</strong>
                            <span className="status-badge success">
                              {eventDetails.contextualDetails.consumptionRecord.status}
                            </span>
                          </div>
                          <div className="text-sm text-muted mt-2">
                            Total Poured: {eventDetails.contextualDetails.consumptionRecord.actualTotalVolumeM3} m³
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted text-sm">No actual material consumption posted for this event yet.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button className="btn-secondary" onClick={() => setSelectedEventId(null)}>
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
