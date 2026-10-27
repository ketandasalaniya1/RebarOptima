import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Coffee,
  Sun,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info
} from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

export default function PmCalendarView({ project, onRefreshProject }) {
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState(6);
  const [weeklyOffDays, setWeeklyOffDays] = useState([0]); // 0 = Sunday
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('17:30');
  const [lunchStartTime, setLunchStartTime] = useState('12:30');
  const [lunchEndTime, setLunchEndTime] = useState('13:30');
  const [lunchDuration, setLunchDuration] = useState(60);
  const [recessIntervals, setRecessIntervals] = useState([
    { name: 'Morning Tea / Site Briefing', startTime: '10:15', endTime: '10:30', durationMinutes: 15 },
    { name: 'Afternoon Recess', startTime: '15:30', endTime: '15:45', durationMinutes: 15 }
  ]);
  const [holidayList, setHolidayList] = useState([]);

  // New Holiday Input State
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayType, setNewHolidayType] = useState('PUBLIC');

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (project?.calendar) {
      const cal = project.calendar;
      setWorkingDaysPerWeek(cal.workingDaysPerWeek || 6);
      setWeeklyOffDays(cal.weeklyOffDays || (cal.workingDaysPerWeek === 5 ? [0, 6] : [0]));
      setWorkStartTime(cal.workStartTime || '08:00');
      setWorkEndTime(cal.workEndTime || '17:30');
      if (cal.lunchBreak) {
        setLunchStartTime(cal.lunchBreak.startTime || '12:30');
        setLunchEndTime(cal.lunchBreak.endTime || '13:30');
        setLunchDuration(cal.lunchBreak.durationMinutes || 60);
      }
      setRecessIntervals(cal.recessIntervals || [
        { name: 'Morning Tea', startTime: '10:15', endTime: '10:30', durationMinutes: 15 },
        { name: 'Afternoon Recess', startTime: '15:30', endTime: '15:45', durationMinutes: 15 }
      ]);
      setHolidayList(cal.holidayList || (cal.holidays || []).map(d => ({ date: d, name: 'Site Holiday', type: 'PUBLIC' })));
    }
  }, [project]);

  // Compute Net Working Hours
  const calculateNetHours = () => {
    const parseMins = (t) => {
      const [h, m] = (t || '00:00').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const totalMins = Math.max(0, parseMins(workEndTime) - parseMins(workStartTime));
    const recessMins = recessIntervals.reduce((acc, r) => acc + (Number(r.durationMinutes) || 0), 0);
    const netMins = Math.max(0, totalMins - Number(lunchDuration) - recessMins);
    return Math.round((netMins / 60) * 10) / 10;
  };

  const netHours = calculateNetHours();

  const handleToggleWeeklyOff = (dayIndex) => {
    if (weeklyOffDays.includes(dayIndex)) {
      setWeeklyOffDays(weeklyOffDays.filter(d => d !== dayIndex));
    } else {
      setWeeklyOffDays([...weeklyOffDays, dayIndex]);
    }
  };

  const handleAddRecess = () => {
    setRecessIntervals([
      ...recessIntervals,
      { name: 'Tea Break', startTime: '15:00', endTime: '15:15', durationMinutes: 15 }
    ]);
  };

  const handleRemoveRecess = (idx) => {
    setRecessIntervals(recessIntervals.filter((_, i) => i !== idx));
  };

  const handleUpdateRecess = (idx, field, value) => {
    const updated = [...recessIntervals];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'startTime' || field === 'endTime') {
      const [sh, sm] = (updated[idx].startTime || '00:00').split(':').map(Number);
      const [eh, em] = (updated[idx].endTime || '00:00').split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) updated[idx].durationMinutes = diff;
    }
    setRecessIntervals(updated);
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName) {
      setError('Please provide both holiday date and description.');
      return;
    }
    if (holidayList.some(h => h.date === newHolidayDate)) {
      setError('A holiday on this date already exists.');
      return;
    }
    setHolidayList([...holidayList, { date: newHolidayDate, name: newHolidayName, type: newHolidayType }]);
    setNewHolidayDate('');
    setNewHolidayName('');
    setError(null);
  };

  const handleRemoveHoliday = (date) => {
    setHolidayList(holidayList.filter(h => h.date !== date));
  };

  const handleSaveCalendar = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setMessage(null);

      const payload = {
        workingDaysPerWeek,
        weeklyOffDays,
        workStartTime,
        workEndTime,
        lunchBreak: {
          name: 'Lunch Break',
          startTime: lunchStartTime,
          endTime: lunchEndTime,
          durationMinutes: Number(lunchDuration)
        },
        recessIntervals,
        workingHoursPerDay: netHours,
        holidays: holidayList.map(h => h.date),
        holidayList
      };

      await pmApi.updateCalendar(project._id, payload);
      setMessage('Project calendar and working hours updated. CPM schedule automatically recalculated!');
      if (onRefreshProject) onRefreshProject();
    } catch (err) {
      setError(err.message || 'Failed to update calendar');
    } finally {
      setIsSaving(false);
    }
  };

  const DAYS_OF_WEEK = [
    { idx: 0, label: 'Sunday' },
    { idx: 1, label: 'Monday' },
    { idx: 2, label: 'Tuesday' },
    { idx: 3, label: 'Wednesday' },
    { idx: 4, label: 'Thursday' },
    { idx: 5, label: 'Friday' },
    { idx: 6, label: 'Saturday' }
  ];

  return (
    <div className="pm-calendar-view">
      {/* HEADER BAR */}
      <div className="pm-view-header">
        <div>
          <h3>Project Working Calendar & Hours</h3>
          <p className="pm-view-subtitle">
            Configure working days, shift hours, lunch and recess intervals, and public/site holidays. Schedules and completion dates automatically recalculate.
          </p>
        </div>
        <button
          className="pm-btn pm-btn-primary"
          onClick={handleSaveCalendar}
          disabled={isSaving}
        >
          {isSaving ? <RefreshCw size={14} className="pm-spin" /> : <Save size={14} />}
          <span>{isSaving ? 'Recalculating Schedule...' : 'Save & Recalculate CPM'}</span>
        </button>
      </div>

      {/* FEEDBACK BANNERS */}
      {message && (
        <div className="pm-success-banner">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="pm-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* THREE COLUMN GRID */}
      <div className="pm-calendar-grid">
        {/* COLUMN 1: WORKING DAYS & WEEKLY OFFS */}
        <div className="pm-card">
          <div className="pm-card-header">
            <h4><CalendarIcon size={16} className="pm-text-accent" /> Working Days per Week</h4>
          </div>
          <div className="pm-card-body">
            <div className="pm-form-group">
              <label>Standard Work Week Model</label>
              <select
                value={workingDaysPerWeek}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setWorkingDaysPerWeek(val);
                  if (val === 5) setWeeklyOffDays([0, 6]);
                  else if (val === 6) setWeeklyOffDays([0]);
                  else setWeeklyOffDays([]);
                }}
              >
                <option value={6}>6-Day Construction Week (Mon – Sat) — Standard</option>
                <option value={5}>5-Day Engineering Week (Mon – Fri)</option>
                <option value={7}>7-Day Continuous Site Shifts (No Weekly Off)</option>
              </select>
            </div>

            <div className="pm-form-group">
              <label>Weekly Off Days (Non-Working)</label>
              <div className="pm-days-checkbox-list">
                {DAYS_OF_WEEK.map(d => {
                  const isOff = weeklyOffDays.includes(d.idx);
                  return (
                    <label key={d.idx} className={`pm-day-chip ${isOff ? 'pm-chip-off' : 'pm-chip-work'}`}>
                      <input
                        type="checkbox"
                        checked={isOff}
                        onChange={() => handleToggleWeeklyOff(d.idx)}
                      />
                      <span>{d.label}</span>
                      <small>{isOff ? '(Off)' : '(Working)'}</small>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pm-info-box">
              <Info size={16} />
              <span>
                Critical Path Method (CPM) counts only working days when deriving early finish, total float, and completion dates.
              </span>
            </div>
          </div>
        </div>

        {/* COLUMN 2: DAILY SHIFT, LUNCH & RECESS */}
        <div className="pm-card">
          <div className="pm-card-header">
            <h4><Clock size={16} className="pm-text-accent" /> Daily Working Hours & Breaks</h4>
          </div>
          <div className="pm-card-body">
            <div className="pm-form-row-2">
              <div className="pm-form-group">
                <label>Shift Start Time</label>
                <input
                  type="time"
                  value={workStartTime}
                  onChange={(e) => setWorkStartTime(e.target.value)}
                />
              </div>
              <div className="pm-form-group">
                <label>Shift End Time</label>
                <input
                  type="time"
                  value={workEndTime}
                  onChange={(e) => setWorkEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* LUNCH BREAK */}
            <div className="pm-subsection-title">
              <Sun size={14} className="pm-text-amber" /> Lunch Break Interval
            </div>
            <div className="pm-form-row-3">
              <div className="pm-form-group">
                <label>Start</label>
                <input
                  type="time"
                  value={lunchStartTime}
                  onChange={(e) => setLunchStartTime(e.target.value)}
                />
              </div>
              <div className="pm-form-group">
                <label>End</label>
                <input
                  type="time"
                  value={lunchEndTime}
                  onChange={(e) => setLunchEndTime(e.target.value)}
                />
              </div>
              <div className="pm-form-group">
                <label>Duration (mins)</label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={lunchDuration}
                  onChange={(e) => setLunchDuration(e.target.value)}
                />
              </div>
            </div>

            {/* RECESS INTERVALS */}
            <div className="pm-subsection-title-row">
              <div className="pm-subsection-title">
                <Coffee size={14} className="pm-text-accent" /> Recess & Tea Intervals
              </div>
              <button className="pm-btn pm-btn-xs pm-btn-secondary" onClick={handleAddRecess}>
                <Plus size={12} /> Add Interval
              </button>
            </div>

            <div className="pm-recess-list">
              {recessIntervals.map((rec, idx) => (
                <div key={idx} className="pm-recess-item-row">
                  <input
                    type="text"
                    className="pm-input-sm pm-recess-name"
                    value={rec.name}
                    placeholder="Break Name"
                    onChange={(e) => handleUpdateRecess(idx, 'name', e.target.value)}
                  />
                  <input
                    type="time"
                    className="pm-input-sm"
                    value={rec.startTime}
                    onChange={(e) => handleUpdateRecess(idx, 'startTime', e.target.value)}
                  />
                  <input
                    type="time"
                    className="pm-input-sm"
                    value={rec.endTime}
                    onChange={(e) => handleUpdateRecess(idx, 'endTime', e.target.value)}
                  />
                  <span className="pm-badge pm-badge-subtle">{rec.durationMinutes || 15}m</span>
                  <button
                    className="pm-icon-btn pm-text-danger"
                    onClick={() => handleRemoveRecess(idx)}
                    title="Remove break"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* NET HOURS DISPLAY */}
            <div className="pm-net-hours-card">
              <span className="pm-net-lbl">Effective Net Working Hours / Day</span>
              <span className="pm-net-val">{netHours} Hours</span>
              <small className="pm-net-sub">Used for labour-hours and manpower planning calculations</small>
            </div>
          </div>
        </div>

        {/* COLUMN 3: HOLIDAYS & SITE SHUTDOWNS */}
        <div className="pm-card">
          <div className="pm-card-header">
            <h4><Sun size={16} className="pm-text-accent" /> Public Holidays & Site Shutdowns</h4>
          </div>
          <div className="pm-card-body">
            {/* ADD HOLIDAY FORM */}
            <div className="pm-add-holiday-box">
              <label>Add Holiday / Project Shutdown</label>
              <div className="pm-form-row-2">
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                />
                <select
                  value={newHolidayType}
                  onChange={(e) => setNewHolidayType(e.target.value)}
                >
                  <option value="PUBLIC">Public Holiday</option>
                  <option value="PROJECT_SPECIFIC">Site Shutdown / Weather</option>
                </select>
              </div>
              <div className="pm-form-row-action">
                <input
                  type="text"
                  placeholder="Holiday Description (e.g. Independence Day, Heavy Rain)"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                />
                <button className="pm-btn pm-btn-sm pm-btn-secondary" onClick={handleAddHoliday}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* HOLIDAY LIST */}
            <div className="pm-holiday-list-wrap">
              <div className="pm-holiday-count">
                <strong>{holidayList.length} Holidays Configured</strong>
              </div>
              {holidayList.length === 0 ? (
                <div className="pm-empty-text">No holidays configured for this project.</div>
              ) : (
                <table className="pm-mini-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Holiday</th>
                      <th>Type</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidayList.map(h => (
                      <tr key={h.date}>
                        <td><strong>{h.date}</strong></td>
                        <td>{h.name}</td>
                        <td>
                          <span className={`pm-badge ${h.type === 'PUBLIC' ? 'pm-badge-accent' : 'pm-badge-warning'}`}>
                            {h.type === 'PUBLIC' ? 'Public' : 'Site Specific'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="pm-icon-btn pm-text-danger"
                            onClick={() => handleRemoveHoliday(h.date)}
                            title="Remove holiday"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
