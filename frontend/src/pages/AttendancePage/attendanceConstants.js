export const STATUSES = [
  { value: 'present', label: 'Present' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
  { value: 'weekly_off', label: 'Weekly Off' },
  { value: 'holiday', label: 'Holiday' },
];

export const SOURCES = [
  { value: 'company_labour', label: 'Company Labour' },
  { value: 'contractor_named', label: 'Contractor Named' },
  { value: 'contractor_workforce', label: 'Contractor Workforce' },
];

export function sourceLabel(value) {
  const found = SOURCES.find((s) => s.value === value);
  return found?.label || value || '—';
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function workedDaysForStatus(status) {
  if (status === 'present') return 1;
  if (status === 'half_day') return 0.5;
  return 0;
}

export function summarizeStatuses(rows) {
  const t = {
    present: 0,
    halfDay: 0,
    absent: 0,
    leave: 0,
    weeklyOff: 0,
    holiday: 0,
    workedDays: 0,
  };
  for (const r of rows) {
    const s = r.status;
    if (s === 'present') t.present += 1;
    else if (s === 'half_day') t.halfDay += 1;
    else if (s === 'absent') t.absent += 1;
    else if (s === 'leave') t.leave += 1;
    else if (s === 'weekly_off') t.weeklyOff += 1;
    else if (s === 'holiday') t.holiday += 1;
    if (s) t.workedDays += workedDaysForStatus(s);
  }
  return t;
}
