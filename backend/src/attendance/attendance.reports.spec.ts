import {
  STATUS_CODES,
  STATUS_CODE_LEGEND,
  REPORT_TYPES,
  buildContractorSummaryFromRows,
  rollupByWorker,
  EXCEL_ROW_CAP,
  PDF_ROW_CAP,
} from './attendance.reports';
import { buildTypedAttendancePdf, buildTypedAttendanceExcel } from './attendance.export';
import { workedDaysForStatus, workedPersonDays } from './attendance.calc';

describe('attendance.reports helpers', () => {
  it('exposes six report types', () => {
    expect(REPORT_TYPES).toEqual([
      'daily',
      'monthly',
      'contractor',
      'labour_only',
      'project_summary',
      'individual',
    ]);
  });

  it('maps statuses to codes without treating missing as absent', () => {
    expect(STATUS_CODES.present).toBe('P');
    expect(STATUS_CODES.half_day).toBe('HD');
    expect(STATUS_CODES.absent).toBe('A');
    expect(STATUS_CODES.leave).toBe('L');
    expect(STATUS_CODES.weekly_off).toBe('WO');
    expect(STATUS_CODES.holiday).toBe('H');
    expect(STATUS_CODE_LEGEND.some((x) => x.code === '—' && x.status === null)).toBe(true);
  });

  it('keeps half-day math consistent with calc module', () => {
    expect(workedDaysForStatus('present') + workedDaysForStatus('half_day') * 4).toBe(3);
    expect(workedPersonDays(18, 4)).toBe(20);
  });

  it('builds contractor summary without inventing workforce names', () => {
    const rows = [
      {
        date: '2026-01-01',
        shift: 'day',
        source: 'contractor_named',
        contractorId: 'c1',
        contractorName: 'Acme',
        name: 'Ravi',
        labourType: 'Mason',
        status: 'present',
        workedDays: 1,
        recordKind: 'individual' as const,
      },
      {
        date: '2026-01-01',
        shift: 'day',
        source: 'contractor_workforce',
        contractorId: 'c2',
        contractorName: 'Beta',
        name: null,
        labourType: 'Helper',
        status: null,
        present: 6,
        halfDay: 2,
        absent: 0,
        leave: 0,
        weeklyOff: 0,
        holiday: 0,
        workedDays: 7,
        recordKind: 'workforce_aggregate' as const,
      },
    ];
    const summary = buildContractorSummaryFromRows(rows);
    expect(summary).toHaveLength(2);
    const beta = summary.find((s) => s.contractorId === 'c2');
    expect(beta.workedDays).toBe(7);
    expect(beta.present).toBe(6);
    expect(beta.halfDay).toBe(2);
  });

  it('rolls up individual and workforce rows accurately', () => {
    const rows = [
      {
        date: '2026-10-01',
        shift: 'day',
        source: 'contractor_named',
        contractorId: 'c1',
        contractorName: 'Acme',
        name: 'Ravi',
        labourType: 'Mason',
        status: 'present',
        workedDays: 1,
        recordKind: 'individual' as const,
      },
      {
        date: '2026-10-02',
        shift: 'day',
        source: 'contractor_named',
        contractorId: 'c1',
        contractorName: 'Acme',
        name: 'Ravi',
        labourType: 'Mason',
        status: 'half_day',
        workedDays: 0.5,
        recordKind: 'individual' as const,
      },
      {
        date: '2026-10-01',
        shift: 'day',
        source: 'contractor_workforce',
        contractorId: 'c2',
        contractorName: 'Beta',
        name: null,
        labourType: 'Helper',
        status: null,
        present: 10,
        halfDay: 2,
        absent: 1,
        leave: 0,
        weeklyOff: 0,
        holiday: 0,
        workedDays: 11,
        recordKind: 'workforce_aggregate' as const,
      },
    ];

    const rollups = rollupByWorker(rows as any);
    expect(rollups).toHaveLength(2);

    const ravi = rollups.find((r) => r.name === 'Ravi');
    expect(ravi).toBeDefined();
    expect(ravi?.present).toBe(1);
    expect(ravi?.halfDay).toBe(1);
    expect(ravi?.workedDays).toBe(1.5);

    const betaWf = rollups.find((r) => r.recordKind === 'workforce_aggregate');
    expect(betaWf).toBeDefined();
    expect(betaWf?.present).toBe(10);
    expect(betaWf?.halfDay).toBe(2);
    expect(betaWf?.workedDays).toBe(11);
  });

  it('generates valid PDF buffer matching PDF magic bytes (%PDF)', async () => {
    const pdfBuf = await buildTypedAttendancePdf({
      meta: {
        reportTitle: 'Daily Attendance Report',
        companyName: 'ABC Construction Pvt. Ltd.',
        projectName: 'Sky View Residential Tower',
        from: '2026-10-30',
        to: '2026-10-30',
        shift: 'all',
        reportType: 'daily',
      },
      summary: {
        sessions: 3,
        present: 2,
        halfDay: 0,
        absent: 0,
        leave: 0,
        weeklyOff: 0,
        holiday: 0,
        workedDays: 2,
      },
      rows: [
        {
          date: '2026-10-30',
          shift: 'day',
          source: 'company_labour',
          contractorName: 'Company',
          name: 'test emp',
          labourType: 'mason',
          status: 'present',
          workedDays: 1,
          recordKind: 'individual',
        },
        {
          date: '2026-10-30',
          shift: 'day',
          source: 'contractor_named',
          contractorName: 'test count',
          name: 'test',
          labourType: 'unskilled',
          status: 'present',
          workedDays: 1,
          recordKind: 'individual',
        },
        {
          date: '2026-10-30',
          shift: 'day',
          source: 'contractor_workforce',
          contractorName: 'steel agency',
          name: null,
          labourType: 'Mason',
          status: 'present',
          present: 2,
          halfDay: 0,
          absent: 0,
          workedDays: 2,
          recordKind: 'workforce_aggregate',
        },
      ],
    });

    expect(pdfBuf).toBeInstanceOf(Buffer);
    expect(pdfBuf.length).toBeGreaterThan(100);
    expect(pdfBuf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('generates valid Excel buffer matching XLSX zip header (PK)', async () => {
    const xlsxBuf = await buildTypedAttendanceExcel({
      meta: {
        reportTitle: 'Daily Attendance Report',
        companyName: 'ABC Construction Pvt. Ltd.',
        projectName: 'Sky View Residential Tower',
        from: '2026-10-30',
        to: '2026-10-30',
        shift: 'all',
        reportType: 'daily',
      },
      summary: {
        sessions: 3,
        present: 2,
        halfDay: 0,
        absent: 0,
        leave: 0,
        weeklyOff: 0,
        holiday: 0,
        workedDays: 2,
      },
      rows: [
        {
          date: '2026-10-30',
          shift: 'day',
          source: 'company_labour',
          contractorName: 'Company',
          name: 'test emp',
          labourType: 'mason',
          status: 'present',
          workedDays: 1,
          recordKind: 'individual',
        },
      ],
    });

    expect(xlsxBuf).toBeInstanceOf(Buffer);
    expect(xlsxBuf.length).toBeGreaterThan(100);
    // XLSX is a zip package starting with 'PK' (0x50, 0x4B)
    expect(xlsxBuf[0]).toBe(0x50);
    expect(xlsxBuf[1]).toBe(0x4b);
  });
});

