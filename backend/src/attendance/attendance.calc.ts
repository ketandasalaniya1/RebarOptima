export const ATTENDANCE_STATUSES = [
  'present',
  'half_day',
  'absent',
  'leave',
  'weekly_off',
  'holiday',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const SHIFTS = ['day', 'night'] as const;
export type AttendanceShift = (typeof SHIFTS)[number];

export const SOURCES = ['company_labour', 'contractor_named', 'contractor_workforce'] as const;
export type AttendanceSource = (typeof SOURCES)[number];

export function workedDaysForStatus(status: string): number {
  if (status === 'present') return 1;
  if (status === 'half_day') return 0.5;
  return 0;
}

export function workedPersonDays(present: number, halfDay: number): number {
  const p = Number(present) || 0;
  const h = Number(halfDay) || 0;
  return p + h * 0.5;
}

export function isValidStatus(status: string): status is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(status);
}

export function isValidShift(shift: string): shift is AttendanceShift {
  return (SHIFTS as readonly string[]).includes(shift);
}

export function isValidSource(source: string): source is AttendanceSource {
  return (SOURCES as readonly string[]).includes(source);
}

/** Sum status counts for workforce reconciliation. */
export function workforceAllocatedTotal(counts: {
  present?: number;
  halfDay?: number;
  absent?: number;
  leave?: number;
  weeklyOff?: number;
  holiday?: number;
}): number {
  return (
    (Number(counts.present) || 0) +
    (Number(counts.halfDay) || 0) +
    (Number(counts.absent) || 0) +
    (Number(counts.leave) || 0) +
    (Number(counts.weeklyOff) || 0) +
    (Number(counts.holiday) || 0)
  );
}

export function summarizeIndividualLines(
  lines: Array<{ status: string; workedDays?: number }>,
) {
  const totals = {
    present: 0,
    halfDay: 0,
    absent: 0,
    leave: 0,
    weeklyOff: 0,
    holiday: 0,
    workedDays: 0,
    headcount: lines.length,
  };
  for (const line of lines) {
    const s = line.status;
    if (s === 'present') totals.present += 1;
    else if (s === 'half_day') totals.halfDay += 1;
    else if (s === 'absent') totals.absent += 1;
    else if (s === 'leave') totals.leave += 1;
    else if (s === 'weekly_off') totals.weeklyOff += 1;
    else if (s === 'holiday') totals.holiday += 1;
    totals.workedDays +=
      line.workedDays != null ? Number(line.workedDays) : workedDaysForStatus(s);
  }
  return totals;
}

export function summarizeWorkforceLines(
  lines: Array<{
    present?: number;
    halfDay?: number;
    absent?: number;
    leave?: number;
    weeklyOff?: number;
    holiday?: number;
    workedPersonDays?: number;
    eligibleCount?: number;
  }>,
) {
  const totals = {
    present: 0,
    halfDay: 0,
    absent: 0,
    leave: 0,
    weeklyOff: 0,
    holiday: 0,
    workedDays: 0,
    eligibleCount: 0,
  };
  for (const line of lines) {
    totals.present += Number(line.present) || 0;
    totals.halfDay += Number(line.halfDay) || 0;
    totals.absent += Number(line.absent) || 0;
    totals.leave += Number(line.leave) || 0;
    totals.weeklyOff += Number(line.weeklyOff) || 0;
    totals.holiday += Number(line.holiday) || 0;
    totals.eligibleCount += Number(line.eligibleCount) || 0;
    totals.workedDays +=
      line.workedPersonDays != null
        ? Number(line.workedPersonDays)
        : workedPersonDays(line.present || 0, line.halfDay || 0);
  }
  return totals;
}
