import {
  workedDaysForStatus,
  workedPersonDays,
  workforceAllocatedTotal,
  summarizeIndividualLines,
  summarizeWorkforceLines,
  isValidStatus,
  isValidShift,
} from './attendance.calc';
import { normalizeDate } from './attendance.service';

describe('attendance.calc', () => {
  it('maps individual statuses to worked days', () => {
    expect(workedDaysForStatus('present')).toBe(1);
    expect(workedDaysForStatus('half_day')).toBe(0.5);
    expect(workedDaysForStatus('absent')).toBe(0);
    expect(workedDaysForStatus('leave')).toBe(0);
    expect(workedDaysForStatus('weekly_off')).toBe(0);
    expect(workedDaysForStatus('holiday')).toBe(0);
  });

  it('computes workforce person-days', () => {
    expect(workedPersonDays(6, 2)).toBe(7);
    expect(workedPersonDays(0, 0)).toBe(0);
  });

  it('reconciles workforce allocated total', () => {
    expect(
      workforceAllocatedTotal({
        present: 6,
        halfDay: 2,
        absent: 2,
        leave: 0,
        weeklyOff: 0,
        holiday: 0,
      }),
    ).toBe(10);
  });

  it('summarizes individual lines including half days', () => {
    const totals = summarizeIndividualLines([
      { status: 'present' },
      { status: 'present' },
      { status: 'half_day' },
      { status: 'absent' },
    ]);
    expect(totals.present).toBe(2);
    expect(totals.halfDay).toBe(1);
    expect(totals.absent).toBe(1);
    expect(totals.workedDays).toBe(2.5);
  });

  it('summarizes workforce lines', () => {
    const totals = summarizeWorkforceLines([
      { present: 6, halfDay: 2, absent: 2, eligibleCount: 10, workedPersonDays: 7 },
      { present: 10, halfDay: 0, absent: 0, leave: 5, eligibleCount: 15, workedPersonDays: 10 },
    ]);
    expect(totals.present).toBe(16);
    expect(totals.halfDay).toBe(2);
    expect(totals.workedDays).toBe(17);
    expect(totals.eligibleCount).toBe(25);
  });

  it('validates status and shift enums', () => {
    expect(isValidStatus('present')).toBe(true);
    expect(isValidStatus('nope')).toBe(false);
    expect(isValidShift('day')).toBe(true);
    expect(isValidShift('night')).toBe(true);
    expect(isValidShift('evening')).toBe(false);
  });

  it('normalizeDate rejects invalid calendar dates', () => {
    expect(normalizeDate('2024-02-29')).toBe('2024-02-29');
    expect(() => normalizeDate('2024-02-31')).toThrow(/Invalid calendar date|Invalid date/);
    expect(() => normalizeDate('2023-02-29')).toThrow(/Invalid calendar date|Invalid date/);
  });
});
