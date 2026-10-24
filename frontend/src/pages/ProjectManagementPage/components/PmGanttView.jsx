import React, { useState, useMemo } from 'react';
import { Clock, ShieldCheck, ZoomIn, ZoomOut, AlertCircle, Calendar, Flag, ArrowRight } from 'lucide-react';

export default function PmGanttView({ project, tasks, dependencies, onOpenDelayModal, onLockBaseline }) {
  const [zoomLevel, setZoomLevel] = useState('DAYS'); // 'DAYS' | 'WEEKS'
  const [filterCriticalOnly, setFilterCriticalOnly] = useState(false);

  // Filter tasks if critical path filter is active
  const displayedTasks = useMemo(() => {
    if (!tasks) return [];
    if (filterCriticalOnly) {
      return tasks.filter(t => t.isCritical);
    }
    return tasks;
  }, [tasks, filterCriticalOnly]);

  // Compute overall timeline bounds
  const { minDate, maxDate, totalDays, datesList } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      const now = new Date();
      return { minDate: now, maxDate: now, totalDays: 30, datesList: [] };
    }

    let minTimestamp = Infinity;
    let maxTimestamp = -Infinity;

    tasks.forEach(t => {
      const s = new Date(t.forecastStart || t.plannedStart).getTime();
      const f = new Date(t.forecastFinish || t.plannedFinish).getTime();
      if (!isNaN(s) && s < minTimestamp) minTimestamp = s;
      if (!isNaN(f) && f > maxTimestamp) maxTimestamp = f;
    });

    if (minTimestamp === Infinity) minTimestamp = Date.now();
    if (maxTimestamp === -Infinity) maxTimestamp = minTimestamp + 30 * 86400000;

    // Pad 3 days on each side
    const start = new Date(minTimestamp - 3 * 86400000);
    const end = new Date(maxTimestamp + 7 * 86400000);

    const dates = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    return {
      minDate: start,
      maxDate: end,
      totalDays: dates.length,
      datesList: dates
    };
  }, [tasks]);

  const dayWidth = zoomLevel === 'DAYS' ? 36 : 18;
  const rowHeight = 44;
  const headerHeight = 50;

  // Convert date string to X coordinate on Gantt canvas
  const getXForDate = (dateStr) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const diffTime = d.getTime() - minDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    return diffDays * dayWidth;
  };

  const getWidthForDuration = (durationDays) => {
    return Math.max(dayWidth, (durationDays || 1) * dayWidth);
  };

  return (
    <div className="pm-gantt-container">
      {/* TOOLBAR */}
      <div className="pm-gantt-toolbar">
        <div className="pm-gantt-legend">
          <div className="pm-legend-item">
            <span className="pm-legend-dot pm-dot-critical"></span>
            <span>Critical Path (Float = 0)</span>
          </div>
          <div className="pm-legend-item">
            <span className="pm-legend-dot pm-dot-planned"></span>
            <span>Planned / Forecast</span>
          </div>
          <div className="pm-legend-item">
            <span className="pm-legend-dot pm-dot-actual"></span>
            <span>Actual Progress</span>
          </div>
          <div className="pm-legend-item">
            <span className="pm-legend-bar pm-bar-baseline-legend"></span>
            <span>Approved Baseline</span>
          </div>
        </div>

        <div className="pm-gantt-controls">
          <label className="pm-checkbox-label">
            <input
              type="checkbox"
              checked={filterCriticalOnly}
              onChange={(e) => setFilterCriticalOnly(e.target.checked)}
            />
            <span>Critical Path Only</span>
          </label>

          <div className="pm-zoom-btn-group">
            <button
              className={`pm-btn pm-btn-sm ${zoomLevel === 'DAYS' ? 'pm-btn-active' : 'pm-btn-secondary'}`}
              onClick={() => setZoomLevel('DAYS')}
            >
              Days
            </button>
            <button
              className={`pm-btn pm-btn-sm ${zoomLevel === 'WEEKS' ? 'pm-btn-active' : 'pm-btn-secondary'}`}
              onClick={() => setZoomLevel('WEEKS')}
            >
              Compact
            </button>
          </div>

          <button className="pm-btn pm-btn-sm pm-btn-warning" onClick={onOpenDelayModal}>
            <Clock size={14} />
            <span>Simulate / Record Delay</span>
          </button>

          {!project?.isBaselineLocked && (
            <button className="pm-btn pm-btn-sm pm-btn-secondary" onClick={onLockBaseline}>
              <ShieldCheck size={14} />
              <span>Lock Baseline</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN GANTT SPLIT VIEW */}
      <div className="pm-gantt-layout">
        {/* LEFT TASK LIST TABLE */}
        <div className="pm-gantt-tasklist">
          <div className="pm-gantt-tasklist-header" style={{ height: headerHeight }}>
            <div className="pm-col-wbs">WBS</div>
            <div className="pm-col-name">Activity Description</div>
            <div className="pm-col-dur">Dur</div>
            <div className="pm-col-float">Float</div>
            <div className="pm-col-prog">%</div>
          </div>

          <div className="pm-gantt-tasklist-body">
            {displayedTasks.map((t, idx) => (
              <div
                key={t._id}
                className={`pm-gantt-task-row ${t.isCritical ? 'pm-row-critical' : ''} ${t.isMilestone ? 'pm-row-milestone' : ''}`}
                style={{ height: rowHeight }}
              >
                <div className="pm-col-wbs">{t.wbsCode}</div>
                <div className="pm-col-name" title={t.name}>
                  {t.isMilestone ? <Flag size={13} className="pm-milestone-flag" /> : null}
                  <span>{t.name}</span>
                </div>
                <div className="pm-col-dur">{t.durationDays}d</div>
                <div className="pm-col-float">
                  {t.isCritical ? (
                    <span className="pm-badge pm-badge-danger">0d</span>
                  ) : (
                    <span className="pm-badge pm-badge-subtle">{t.totalFloatDays ?? 0}d</span>
                  )}
                </div>
                <div className="pm-col-prog">{t.progressPercentage || 0}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT INTERACTIVE TIMELINE */}
        <div className="pm-gantt-timeline-scroll">
          <div
            className="pm-gantt-timeline-canvas"
            style={{
              width: datesList.length * dayWidth,
              height: headerHeight + displayedTasks.length * rowHeight
            }}
          >
            {/* TIMELINE HEADER */}
            <div className="pm-gantt-timeline-header" style={{ height: headerHeight }}>
              {datesList.map((d, i) => {
                const day = d.getDate();
                const isSunday = d.getDay() === 0;
                const isFirstOfMonth = day === 1;

                return (
                  <div
                    key={i}
                    className={`pm-timeline-cell ${isSunday ? 'pm-cell-weekend' : ''}`}
                    style={{ left: i * dayWidth, width: dayWidth }}
                  >
                    {isFirstOfMonth || i === 0 ? (
                      <span className="pm-month-label">
                        {d.toLocaleString('default', { month: 'short' })}
                      </span>
                    ) : null}
                    <span className="pm-day-number">{day}</span>
                  </div>
                );
              })}
            </div>

            {/* TIMELINE GRID BACKGROUND & BARS */}
            <div className="pm-gantt-bars-container" style={{ top: headerHeight }}>
              {/* Weekend vertical highlight columns */}
              {datesList.map((d, i) => {
                if (d.getDay() !== 0) return null;
                return (
                  <div
                    key={`wk-${i}`}
                    className="pm-timeline-weekend-band"
                    style={{ left: i * dayWidth, width: dayWidth }}
                  />
                );
              })}

              {/* TASK BARS */}
              {displayedTasks.map((t, idx) => {
                const top = idx * rowHeight;
                const startX = getXForDate(t.forecastStart || t.plannedStart);
                const width = getWidthForDuration(t.durationDays);
                const progressWidth = (width * (t.progressPercentage || 0)) / 100;

                // Baseline coordinates
                const baseStartX = t.baselineStart ? getXForDate(t.baselineStart) : startX;
                const baseDuration = t.baselineStart && t.baselineFinish
                  ? Math.max(1, Math.round((new Date(t.baselineFinish) - new Date(t.baselineStart)) / 86400000))
                  : t.durationDays;
                const baseWidth = getWidthForDuration(baseDuration);

                return (
                  <div
                    key={t._id}
                    className="pm-gantt-row-track"
                    style={{ top, height: rowHeight }}
                  >
                    {/* BASELINE OUTLINE BAR */}
                    {project?.isBaselineLocked && (
                      <div
                        className="pm-bar-baseline"
                        style={{
                          left: baseStartX,
                          width: baseWidth
                        }}
                        title={`Baseline: ${t.baselineStart} to ${t.baselineFinish}`}
                      />
                    )}

                    {/* FORECAST / ACTIVE BAR */}
                    {t.isMilestone ? (
                      <div
                        className={`pm-gantt-milestone-diamond ${t.isCritical ? 'pm-diamond-critical' : ''}`}
                        style={{ left: startX + 8 }}
                        title={`Milestone: ${t.name} (${t.forecastStart})`}
                      />
                    ) : (
                      <div
                        className={`pm-gantt-task-bar ${t.isCritical ? 'pm-bar-critical' : 'pm-bar-normal'}`}
                        style={{
                          left: startX,
                          width: Math.max(16, width)
                        }}
                      >
                        {/* ACTUAL PROGRESS FILL */}
                        {progressWidth > 0 && (
                          <div
                            className="pm-gantt-progress-fill"
                            style={{ width: `${Math.min(100, t.progressPercentage || 0)}%` }}
                          />
                        )}
                        <span className="pm-bar-inner-label">
                          {t.progressPercentage > 0 ? `${t.progressPercentage}%` : `${t.durationDays}d`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* SVG DEPENDENCY CONNECTOR ARROWS */}
              <svg
                className="pm-gantt-dependency-svg"
                style={{
                  width: datesList.length * dayWidth,
                  height: displayedTasks.length * rowHeight
                }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 6 3, 0 6" fill="var(--text-label)" />
                  </marker>
                  <marker
                    id="arrowhead-critical"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 6 3, 0 6" fill="var(--danger)" />
                  </marker>
                </defs>

                {dependencies && dependencies.map((dep, depIdx) => {
                  const predIndex = displayedTasks.findIndex(t => String(t._id) === String(dep.predecessorTaskId));
                  const succIndex = displayedTasks.findIndex(t => String(t._id) === String(dep.taskId));
                  if (predIndex === -1 || succIndex === -1) return null;

                  const pred = displayedTasks[predIndex];
                  const succ = displayedTasks[succIndex];

                  const x1 = getXForDate(pred.forecastFinish || pred.plannedFinish) + getWidthForDuration(pred.durationDays);
                  const y1 = predIndex * rowHeight + rowHeight / 2;
                  const x2 = getXForDate(succ.forecastStart || succ.plannedStart);
                  const y2 = succIndex * rowHeight + rowHeight / 2;

                  const isCriticalDep = pred.isCritical && succ.isCritical;
                  const strokeColor = isCriticalDep ? 'var(--danger)' : 'var(--card-border)';
                  const markerEnd = isCriticalDep ? 'url(#arrowhead-critical)' : 'url(#arrowhead)';

                  // Draw clean stepped path
                  const midX = x1 + 12;
                  const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

                  return (
                    <path
                      key={depIdx}
                      d={path}
                      stroke={strokeColor}
                      strokeWidth={isCriticalDep ? 2 : 1.5}
                      fill="none"
                      markerEnd={markerEnd}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
