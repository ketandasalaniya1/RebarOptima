import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { STATUS_CODE_LEGEND } from './attendance.reports';

type ExportReport = {
  meta?: any;
  summary?: any;
  columns?: string[];
  rows?: any[];
  rollupRows?: any[];
  dailyRows?: any[];
  matrixRows?: any[];
  sections?: any[];
  metrics?: any[];
  contractorSummary?: any[];
};

/** Shared visual tokens for PDF + Excel (mockup-aligned, construction SaaS). */
const THEME = {
  navy: '#1e3a5f',
  navyDark: '#1e3a8a',
  headerBg: '#dbe4f0',
  brandRed: '#c41e3a',
  brandBlue: '#1e3a8a',
  text: '#1a202c',
  muted: '#64748b',
  line: '#cbd5e1',
  white: '#ffffff',
  kpiBg: '#f8fafc',
  status: {
    present: { fill: '#dcfce7', text: '#166534', hex: '#16a34a', label: 'Present' },
    half_day: { fill: '#fef9c3', text: '#854d0e', hex: '#ca8a04', label: 'Half Day' },
    absent: { fill: '#fee2e2', text: '#991b1b', hex: '#dc2626', label: 'Absent' },
    leave: { fill: '#e0f2fe', text: '#075985', hex: '#0284c7', label: 'Leave' },
    weekly_off: { fill: '#f3e8ff', text: '#6b21a8', hex: '#9333ea', label: 'Weekly Off' },
    holiday: { fill: '#fce7f3', text: '#9d174d', hex: '#db2777', label: 'Holiday' },
    missing: { fill: '#f1f5f9', text: '#64748b', hex: '#94a3b8', label: 'No attendance' },
  } as Record<string, { fill: string; text: string; hex: string; label: string }>,
};

const STATUS_ARGB: Record<string, { bg: string; fg: string }> = {
  present: { bg: 'FFDCFCE7', fg: 'FF166534' },
  half_day: { bg: 'FFFEF9C3', fg: 'FF854D0E' },
  absent: { bg: 'FFFEE2E2', fg: 'FF991B1B' },
  leave: { bg: 'FFE0F2FE', fg: 'FF075985' },
  weekly_off: { bg: 'FFF3E8FF', fg: 'FF6B21A8' },
  holiday: { bg: 'FFFCE7F3', fg: 'FF9D174D' },
  missing: { bg: 'FFF1F5F9', fg: 'FF64748B' },
  P: { bg: 'FFDCFCE7', fg: 'FF166534' },
  HD: { bg: 'FFFEF9C3', fg: 'FF854D0E' },
  A: { bg: 'FFFEE2E2', fg: 'FF991B1B' },
  L: { bg: 'FFE0F2FE', fg: 'FF075985' },
  WO: { bg: 'FFF3E8FF', fg: 'FF6B21A8' },
  H: { bg: 'FFFCE7F3', fg: 'FF9D174D' },
  '—': { bg: 'FFF1F5F9', fg: 'FF64748B' },
};

function fmt(v: any) {
  if (v == null || v === '') return '0';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1);
  return String(v);
}

function fmtWorked(v: any) {
  if (v == null || v === '') return '0.0';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(1);
}

function formatDateFormatted(isoOrDate: string): string {
  if (!isoOrDate || isoOrDate === '—') return '—';
  try {
    const raw = String(isoOrDate).slice(0, 10);
    const parts = raw.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${day} ${months[monthIdx]} ${year}`;
      }
    }
    return isoOrDate;
  } catch {
    return isoOrDate;
  }
}

function periodFormattedLabel(meta: any) {
  const from = meta.from || meta.date || '—';
  const to = meta.to || meta.date || from;
  if (from === '—') return '—';
  const f = formatDateFormatted(from);
  const t = formatDateFormatted(to);
  return f === t ? f : `${f} to ${t}`;
}

function formatShiftLabel(shift: any) {
  if (!shift || shift === 'all') return 'All Shifts';
  return String(shift).charAt(0).toUpperCase() + String(shift).slice(1);
}

function generatedFormattedLabel() {
  const d = new Date();
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function statusKey(statusOrCode: any): string {
  if (!statusOrCode) return 'missing';
  const s = String(statusOrCode).toLowerCase().replace(/\s+/g, '_');
  if (THEME.status[s]) return s;
  const map: Record<string, string> = {
    p: 'present',
    hd: 'half_day',
    a: 'absent',
    l: 'leave',
    wo: 'weekly_off',
    h: 'holiday',
    '—': 'missing',
    '-': 'missing',
  };
  return map[s] || map[String(statusOrCode)] || 'missing';
}

function sourceLabel(row: any) {
  if (row.source === 'company_labour') return 'Company Labour';
  if (row.source === 'contractor_named' || row.source === 'contractor_labour') {
    return 'Contractor Labour (Named)';
  }
  if (row.source === 'contractor_workforce' || row.recordKind === 'workforce_aggregate') {
    return 'Contractor Workforce';
  }
  return row.source || '—';
}

function partyLabel(row: any) {
  if (row.source === 'company_labour') return 'Company';
  return row.contractorName || '—';
}

function workerLabel(row: any) {
  if (row.recordKind === 'workforce_aggregate' || row.recordKind === 'workforce') {
    return row.labourType || 'Workforce';
  }
  return row.name ? (row.labourType ? `${row.name} (${row.labourType})` : row.name) : '—';
}

function statusDisplay(row: any) {
  if (row.recordKind === 'workforce_aggregate' || row.recordKind === 'workforce') {
    if (row.status === 'present') return 'Present';
    if (row.status === 'half_day') return 'Half Day';
    if (row.present > 0 && !row.halfDay && !row.absent && !row.leave && !row.weeklyOff && !row.holiday) {
      return 'Present';
    }
    return `P:${row.present ?? 0} HD:${row.halfDay ?? 0} A:${row.absent ?? 0}`;
  }
  const s = row.status || row.statusCode || '—';
  if (s === 'present') return 'Present';
  if (s === 'half_day') return 'Half Day';
  if (s === 'absent') return 'Absent';
  if (s === 'leave') return 'Leave';
  if (s === 'weekly_off') return 'Weekly Off';
  if (s === 'holiday') return 'Holiday';
  return s;
}

/* ───────────────────────── Excel ───────────────────────── */

function applyNavyHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 24;
}

function applyLightHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FF1E3A5F' }, size: 10 };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDBE4F0' },
  };
  row.alignment = { vertical: 'middle' };
  row.height = 20;
}

function paintStatusCell(cell: ExcelJS.Cell, statusOrCode: any) {
  const key = statusKey(statusOrCode);
  const info = STATUS_ARGB[key] || STATUS_ARGB[String(statusOrCode)] || STATUS_ARGB['—'];
  if (info) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: info.bg } };
    cell.font = { bold: true, size: 9, color: { argb: info.fg } };
  }
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function writeExcelBrandAndMeta(sheet: ExcelJS.Worksheet, meta: any) {
  // Row 1: REBAR OPTIMA
  const brandCell = sheet.getCell(1, 1);
  brandCell.value = 'REBAR OPTIMA';
  brandCell.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };

  // Row 2: Tagline
  const tagCell = sheet.getCell(2, 1);
  tagCell.value = 'Construction Management System';
  tagCell.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  // Row 3: Report Title (Merged across cols A to G)
  sheet.mergeCells(3, 1, 3, 7);
  const titleCell = sheet.getCell(3, 1);
  titleCell.value = meta.reportTitle || 'Daily Attendance Report';
  titleCell.font = { bold: true, size: 15, color: { argb: 'FF1E3A5F' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 26;

  // Rows 4-8: Metadata
  const pairs: Array<[string, any]> = [
    ['Company', `: ${meta.companyName || '—'}`],
    ['Project', `: ${meta.projectName || '—'}`],
  ];
  if (meta.contractorName) {
    pairs.push(['Contractor', `: ${meta.contractorName}${meta.mode ? ` (${meta.mode})` : ''}`]);
  }
  if (meta.workerName) {
    pairs.push(['Worker', `: ${meta.workerName}${meta.labourType ? ` (${meta.labourType})` : ''}`]);
  }
  pairs.push(
    ['Period', `: ${periodFormattedLabel(meta)}`],
    ['Shift', `: ${formatShiftLabel(meta.shift)}`],
    ['Generated', `: ${generatedFormattedLabel()}`],
  );

  let r = 4;
  for (const [k, v] of pairs) {
    const lbl = sheet.getCell(r, 1);
    lbl.value = k;
    lbl.font = { bold: true, color: { argb: 'FF1E3A5F' }, size: 9.5 };
    const val = sheet.getCell(r, 2);
    val.value = v;
    val.font = { size: 9.5, color: { argb: 'FF1A202C' } };
    r += 1;
  }
  return r + 1; // leave 1 blank row
}

function writeExcelSummary(sheet: ExcelJS.Worksheet, summary: any, startRow: number) {
  sheet.getCell(startRow, 1).value = 'Summary';
  sheet.getCell(startRow, 1).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };

  const headers = [
    { title: 'Sessions', key: 'sessions', bg: 'FFF1F5F9', fg: 'FF475569' },
    { title: 'Present', key: 'present', bg: 'FFDCFCE7', fg: 'FF166534' },
    { title: 'Half Day', key: 'halfDay', bg: 'FFFEF9C3', fg: 'FF854D0E' },
    { title: 'Absent', key: 'absent', bg: 'FFFEE2E2', fg: 'FF991B1B' },
    { title: 'Leave', key: 'leave', bg: 'FFE0F2FE', fg: 'FF075985' },
    { title: 'Weekly Off', key: 'weeklyOff', bg: 'FFF3E8FF', fg: 'FF6B21A8' },
    { title: 'Holiday', key: 'holiday', bg: 'FFFCE7F3', fg: 'FF9D174D' },
    { title: 'Worked', key: 'workedDays', bg: 'FFF1F5F9', fg: 'FF1E3A5F' },
  ];

  const headerRow = startRow + 1;
  const valueRow = headerRow + 1;

  headers.forEach((h, i) => {
    const colIdx = i + 1;
    const hCell = sheet.getCell(headerRow, colIdx);
    hCell.value = h.title;
    hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.bg } };
    hCell.font = { bold: true, size: 9.5, color: { argb: h.fg } };
    hCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const vCell = sheet.getCell(valueRow, colIdx);
    const val = summary[h.key] ?? 0;
    vCell.value = h.key === 'workedDays' ? Number(fmtWorked(val)) : Number(val);
    vCell.alignment = { horizontal: 'center', vertical: 'middle' };
    vCell.font = { bold: true, size: 11, color: { argb: 'FF1A202C' } };
    vCell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });

  sheet.getRow(headerRow).height = 20;
  sheet.getRow(valueRow).height = 22;

  return valueRow + 2;
}

function writeExcelLegend(sheet: ExcelJS.Worksheet, startRow: number) {
  sheet.getCell(startRow, 1).value = 'Legend';
  sheet.getCell(startRow, 1).font = { bold: true, size: 10, color: { argb: 'FF1E3A5F' } };

  const legendRow = startRow + 1;
  const legendItems = [
    { text: 'P = Present', sk: 'present' },
    { text: 'HD = Half Day', sk: 'half_day' },
    { text: 'A = Absent', sk: 'absent' },
    { text: 'L = Leave', sk: 'leave' },
    { text: 'WO = Weekly Off', sk: 'weekly_off' },
    { text: 'H = Holiday', sk: 'holiday' },
    { text: '— = No attendance recorded', sk: 'missing' },
  ];

  legendItems.forEach((item, idx) => {
    const cell = sheet.getCell(legendRow, idx + 1);
    cell.value = item.text;
    const info = STATUS_ARGB[item.sk];
    if (info) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: info.bg } };
      cell.font = { bold: true, size: 8.5, color: { argb: info.fg } };
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });
  sheet.getRow(legendRow).height = 18;
  return legendRow + 2;
}

export async function buildTypedAttendanceExcel(report: ExportReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rebar Optima';
  wb.created = new Date();
  const meta = report.meta || {};
  const summary = report.summary || {};
  const reportType = meta.reportType || 'daily';

  // Primary sheet named for the report (matches mockup workbook tabs)
  const primaryName =
    reportType === 'daily'
      ? 'Daily Attendance'
      : reportType === 'monthly'
        ? 'Monthly Attendance'
        : reportType === 'contractor'
          ? 'Contractor Report'
          : reportType === 'labour_only'
            ? 'Labour Details'
            : reportType === 'individual'
              ? 'Worker History'
              : reportType === 'project_summary'
                ? 'Project Summary'
                : 'Report';

  const primary = wb.addWorksheet(primaryName);
  primary.getColumn(1).width = 14;
  primary.getColumn(2).width = 12;
  primary.getColumn(3).width = 24;
  primary.getColumn(4).width = 24;
  primary.getColumn(5).width = 26;
  primary.getColumn(6).width = 14;
  primary.getColumn(7).width = 12;
  primary.getColumn(8).width = 12;

  let cursor = writeExcelBrandAndMeta(primary, meta);
  cursor = writeExcelSummary(primary, summary, cursor);

  // If project_summary, write project metrics block
  if (reportType === 'project_summary' && report.metrics?.length) {
    primary.getCell(cursor, 1).value = 'Project Metrics';
    primary.getCell(cursor, 1).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
    cursor += 1;
    primary.getCell(cursor, 1).value = 'Metric';
    primary.getCell(cursor, 2).value = 'Value';
    primary.getCell(cursor, 3).value = 'Note';
    applyLightHeader(primary.getRow(cursor));
    cursor += 1;
    for (const m of report.metrics) {
      primary.getCell(cursor, 1).value = m.label;
      primary.getCell(cursor, 2).value = fmt(m.value);
      primary.getCell(cursor, 3).value = m.note || '';
      cursor += 1;
    }
    cursor += 1;
  }

  // Monthly Matrix Sheet
  const matrixRows = report.matrixRows || (meta.dayKeys ? report.rows : null);
  if (meta.dayKeys && Array.isArray(matrixRows)) {
    const sheet = wb.addWorksheet('Monthly Matrix');
    const dayKeys: string[] = meta.dayKeys;
    const cols: Partial<ExcelJS.Column>[] = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Shift', key: 'shift', width: 8 },
      { header: 'Kind', key: 'recordKind', width: 16 },
      { header: 'Contractor', key: 'contractorName', width: 20 },
      { header: 'Worker / Labour Type', key: 'name', width: 24 },
      ...dayKeys.map((d) => ({ header: d, key: `d${d}`, width: 5 })),
      { header: 'Present', key: 'present', width: 9 },
      { header: 'Half Day', key: 'halfDay', width: 9 },
      { header: 'Absent', key: 'absent', width: 9 },
      { header: 'Worked', key: 'workedDays', width: 9 },
    ];
    sheet.columns = cols as any;
    applyNavyHeader(sheet.getRow(1));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    matrixRows.forEach((r, idx) => {
      const rowData: any = {
        num: idx + 1,
        shift: r.shift,
        recordKind: r.recordKind === 'workforce_aggregate' ? 'Workforce' : 'Individual',
        contractorName: r.contractorName || 'Company',
        name: r.recordKind === 'workforce_aggregate' ? r.labourType : `${r.name || '—'} (${r.labourType || '—'})`,
        present: r.present,
        halfDay: r.halfDay,
        absent: r.absent,
        workedDays: fmtWorked(r.workedDays),
      };
      for (const d of dayKeys) rowData[`d${d}`] = r.days?.[d] ?? '—';
      const excelRow = sheet.addRow(rowData);
      dayKeys.forEach((d, i) => {
        paintStatusCell(excelRow.getCell(6 + i), r.days?.[d] ?? '—');
      });
    });

    primary.getCell(cursor, 1).value = 'Details are available in the "Monthly Matrix" sheet.';
    primary.getCell(cursor, 1).font = { italic: true, color: { argb: 'FF64748B' } };
    cursor += 2;
  } else if (reportType === 'contractor' && (report.rollupRows || report.rows)) {
    // Contractor-wise table: # | Worker / Labour Type | P | HD | A | L | Worked
    primary.getCell(cursor, 1).value = 'Details';
    primary.getCell(cursor, 1).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
    cursor += 1;

    const ctrHeaders = ['#', 'Worker / Labour Type', 'Present', 'Half Day', 'Absent', 'Leave', 'Worked'];
    ctrHeaders.forEach((h, i) => {
      primary.getCell(cursor, i + 1).value = h;
    });
    applyNavyHeader(primary.getRow(cursor));
    cursor += 1;

    const dataRows = report.rollupRows || report.rows || [];
    dataRows.forEach((r: any, idx: number) => {
      const vals = [
        idx + 1,
        r.recordKind === 'workforce_aggregate' ? r.labourType : `${r.name || '—'} (${r.labourType || '—'})`,
        r.present ?? 0,
        r.halfDay ?? 0,
        r.absent ?? 0,
        r.leave ?? 0,
        fmtWorked(r.workedDays),
      ];
      vals.forEach((v, i) => {
        const cell = primary.getCell(cursor, i + 1);
        cell.value = v;
        if (i !== 1) cell.alignment = { horizontal: 'center' };
      });
      cursor += 1;
    });
    cursor += 1;
  } else if (reportType === 'labour_only' && (report.rollupRows || report.rows)) {
    // Labour-Only table: # | Source | Worker / Labour Type | P | HD | A | Worked
    primary.getCell(cursor, 1).value = 'Details';
    primary.getCell(cursor, 1).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
    cursor += 1;

    const loHeaders = ['#', 'Source', 'Worker / Labour Type', 'Present', 'Half Day', 'Absent', 'Worked'];
    loHeaders.forEach((h, i) => {
      primary.getCell(cursor, i + 1).value = h;
    });
    applyNavyHeader(primary.getRow(cursor));
    cursor += 1;

    const dataRows = report.rollupRows || report.rows || [];
    dataRows.forEach((r: any, idx: number) => {
      const vals = [
        idx + 1,
        sourceLabel(r),
        r.recordKind === 'workforce_aggregate' ? r.labourType : `${r.name || '—'} (${r.labourType || '—'})`,
        r.present ?? 0,
        r.halfDay ?? 0,
        r.absent ?? 0,
        fmtWorked(r.workedDays),
      ];
      vals.forEach((v, i) => {
        const cell = primary.getCell(cursor, i + 1);
        cell.value = v;
        if (i === 0 || i >= 3) cell.alignment = { horizontal: 'center' };
      });
      cursor += 1;
    });
    cursor += 1;
  } else {
    // Daily / Default Details table: Date | Shift | Manpower Source | Company / Contractor | Worker / Labour Type | Status | Worked
    primary.getCell(cursor, 1).value = 'Details';
    primary.getCell(cursor, 1).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
    cursor += 1;

    const detailHeaders = [
      'Date',
      'Shift',
      'Manpower Source',
      'Company / Contractor',
      'Worker / Labour Type',
      'Status',
      'Worked',
    ];
    detailHeaders.forEach((h, i) => {
      primary.getCell(cursor, i + 1).value = h;
    });
    applyNavyHeader(primary.getRow(cursor));
    const headerRowNum = cursor;
    cursor += 1;

    const rows = report.dailyRows || report.rows || [];
    for (const r of rows) {
      const vals = [
        r.date || '',
        formatShiftLabel(r.shift),
        sourceLabel(r),
        partyLabel(r),
        workerLabel(r),
        statusDisplay(r),
        fmtWorked(r.workedDays),
      ];
      vals.forEach((v, i) => {
        const cell = primary.getCell(cursor, i + 1);
        cell.value = v;
        if (i === 0 || i === 1 || i === 6) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
      // Paint Status cell with pastel status color
      paintStatusCell(primary.getCell(cursor, 6), r.status || r.statusCode);
      cursor += 1;
    }

    if (rows.length) {
      primary.autoFilter = {
        from: { row: headerRowNum, column: 1 },
        to: { row: headerRowNum, column: detailHeaders.length },
      };
      primary.views = [{ state: 'frozen', ySplit: headerRowNum }];
    }
    cursor += 1;
  }

  // Legend block at the bottom
  writeExcelLegend(primary, cursor);

  // Additional sheets
  // 1. Details Sheet (always present for raw inspection)
  const rawRows = report.dailyRows || report.rows || [];
  if (rawRows.length > 0 && reportType !== 'monthly') {
    const detailSheet = wb.addWorksheet('Details');
    detailSheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Shift', key: 'shift', width: 10 },
      { header: 'Manpower Source', key: 'source', width: 24 },
      { header: 'Company / Contractor', key: 'party', width: 24 },
      { header: 'Worker / Labour Type', key: 'worker', width: 24 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Worked Days', key: 'workedDays', width: 12 },
      { header: 'Remark', key: 'remark', width: 24 },
    ];
    applyNavyHeader(detailSheet.getRow(1));
    detailSheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const r of rawRows) {
      const excelRow = detailSheet.addRow({
        date: r.date || '',
        shift: formatShiftLabel(r.shift),
        source: sourceLabel(r),
        party: partyLabel(r),
        worker: workerLabel(r),
        status: statusDisplay(r),
        workedDays: fmtWorked(r.workedDays),
        remark: r.remark || '',
      });
      paintStatusCell(excelRow.getCell(6), r.status || r.statusCode);
    }
  }

  // 2. Summary Sheet (always present as structured metadata)
  const summarySheet = wb.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 32 },
    { header: 'Value', key: 'value', width: 44 },
  ];
  applyNavyHeader(summarySheet.getRow(1));
  const summaryRows: Array<{ field: string; value: any }> = [
    { field: 'Report Title', value: meta.reportTitle || 'Attendance Report' },
    { field: 'Company', value: meta.companyName || '—' },
    { field: 'Project', value: meta.projectName || '—' },
    { field: 'Period', value: periodFormattedLabel(meta) },
    { field: 'Shift', value: formatShiftLabel(meta.shift) },
    { field: 'Generated At', value: generatedFormattedLabel() },
    { field: 'Sessions', value: summary.sessions ?? 0 },
    { field: 'Present (Headcount/Days)', value: summary.present ?? 0 },
    { field: 'Half Day (Headcount/Days)', value: summary.halfDay ?? 0 },
    { field: 'Absent (Headcount/Days)', value: summary.absent ?? 0 },
    { field: 'Leave (Headcount/Days)', value: summary.leave ?? 0 },
    { field: 'Weekly Off (Headcount/Days)', value: summary.weeklyOff ?? 0 },
    { field: 'Holiday (Headcount/Days)', value: summary.holiday ?? 0 },
    { field: 'Total Worked (Person-Days)', value: fmtWorked(summary.workedDays) },
  ];
  if (meta.contractorName) {
    summaryRows.splice(3, 0, { field: 'Contractor', value: meta.contractorName });
  }
  summarySheet.addRows(summaryRows);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Legacy flat export kept for old detail routes */
export async function buildAttendanceExcel(report: {
  summary: any;
  detail: any[];
  meta?: { projectName?: string; companyName?: string; from?: string; to?: string };
}): Promise<Buffer> {
  return buildTypedAttendanceExcel({
    meta: {
      reportTitle: 'Daily Attendance Report',
      companyName: report.meta?.companyName,
      projectName: report.meta?.projectName,
      from: report.meta?.from,
      to: report.meta?.to,
      shift: 'all',
      reportType: 'daily',
    },
    summary: report.summary,
    rows: (report.detail || []).map((r) => ({
      ...r,
      recordKind: r.recordKind === 'workforce' ? 'workforce_aggregate' : r.recordKind || 'individual',
    })),
  });
}

/* ───────────────────────── PDF Helpers & Drawing ───────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function setFill(doc: PdfDoc, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.fillColor(`rgb(${r},${g},${b})`);
}

function setStroke(doc: PdfDoc, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.strokeColor(`rgb(${r},${g},${b})`);
}

function ensureSpace(doc: PdfDoc, need: number) {
  const bottom = doc.page.height - doc.page.margins.bottom - 24;
  if (doc.y + need > bottom) {
    doc.addPage();
    return true;
  }
  return false;
}

function drawBrandHeader(doc: PdfDoc, title: string) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = doc.page.margins.top;

  // Left Brand: REBAR (Navy) OPTIMA (Red)
  doc.font('Helvetica-Bold').fontSize(14);
  setFill(doc, THEME.navyDark);
  doc.text('REBAR', left, top, { continued: true });
  setFill(doc, THEME.brandRed);
  doc.text(' OPTIMA', { continued: false });

  // Tagline below brand
  doc.font('Helvetica').fontSize(7.5);
  setFill(doc, THEME.muted);
  doc.text('Construction Management System', left, top + 16);

  // Right Title: Daily Attendance Report (or specific report)
  doc.font('Helvetica-Bold').fontSize(15);
  setFill(doc, THEME.navy);
  doc.text(title || 'Daily Attendance Report', left, top + 3, {
    width: right - left,
    align: 'right',
  });

  // Dividing rule
  setStroke(doc, THEME.line);
  doc
    .moveTo(left, top + 32)
    .lineTo(right, top + 32)
    .lineWidth(1)
    .stroke();

  doc.y = top + 40;
}

function drawMetaBlock(doc: PdfDoc, meta: any) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  const pairs: Array<[string, string]> = [
    ['Company', meta.companyName || '—'],
    ['Project', meta.projectName || '—'],
  ];
  if (meta.contractorName) {
    pairs.push(['Contractor', `${meta.contractorName}${meta.mode ? ` (${meta.mode})` : ''}`]);
  }
  if (meta.workerName) {
    pairs.push(['Worker', `${meta.workerName}${meta.labourType ? ` (${meta.labourType})` : ''}`]);
  }
  pairs.push(
    ['Period', periodFormattedLabel(meta)],
    ['Shift', formatShiftLabel(meta.shift)],
    ['Generated', generatedFormattedLabel()],
  );

  const labelW = 70;
  doc.fontSize(8.5);
  for (const [k, v] of pairs) {
    const y = doc.y;
    doc.font('Helvetica-Bold');
    setFill(doc, THEME.navy);
    doc.text(k, left, y, { width: labelW });
    doc.font('Helvetica');
    setFill(doc, THEME.muted);
    doc.text(':', left + labelW, y, { width: 8 });
    doc.font('Helvetica');
    setFill(doc, THEME.text);
    doc.text(v, left + labelW + 10, y, {
      width: right - (left + labelW + 10),
    });
    doc.y = y + 12;
  }

  setStroke(doc, THEME.line);
  doc
    .moveTo(left, doc.y + 4)
    .lineTo(right, doc.y + 4)
    .lineWidth(0.8)
    .stroke();
  doc.y += 10;
}

function drawKpiIcon(doc: PdfDoc, type: string, cx: number, cy: number) {
  const r = 5.5;
  if (type === 'present') {
    setFill(doc, '#16a34a');
    doc.circle(cx, cy, r).fill();
    setStroke(doc, '#ffffff');
    doc.lineWidth(1.2);
    doc.moveTo(cx - 2.5, cy).lineTo(cx - 0.8, cy + 2).lineTo(cx + 2.8, cy - 2).stroke();
  } else if (type === 'half_day') {
    setFill(doc, '#ca8a04');
    doc.circle(cx, cy, r).fill();
    setStroke(doc, '#ffffff');
    doc.lineWidth(1.1);
    doc.moveTo(cx, cy - 3).lineTo(cx, cy).lineTo(cx + 2, cy).stroke();
  } else if (type === 'absent') {
    setFill(doc, '#dc2626');
    doc.circle(cx, cy, r).fill();
    setStroke(doc, '#ffffff');
    doc.lineWidth(1.2);
    doc.moveTo(cx - 2, cy - 2).lineTo(cx + 2, cy + 2).stroke();
    doc.moveTo(cx + 2, cy - 2).lineTo(cx - 2, cy + 2).stroke();
  } else if (type === 'leave') {
    setFill(doc, '#0284c7');
    doc.circle(cx, cy, r).fill();
    setFill(doc, '#ffffff');
    doc.rect(cx - 2.5, cy - 2.5, 5, 5).fill();
    setFill(doc, '#0284c7');
    doc.rect(cx - 1.5, cy - 0.5, 3, 2).fill();
  } else if (type === 'weekly_off') {
    setFill(doc, '#9333ea');
    doc.circle(cx, cy, r).fill();
    setFill(doc, '#ffffff');
    doc.rect(cx - 2.5, cy - 2.5, 5, 5).fill();
    setFill(doc, '#9333ea');
    doc.rect(cx - 1.5, cy - 0.5, 3, 2).fill();
  } else if (type === 'holiday') {
    setFill(doc, '#db2777');
    doc.circle(cx, cy, r).fill();
    setStroke(doc, '#ffffff');
    doc.lineWidth(1);
    doc.moveTo(cx - 2.5, cy).lineTo(cx + 2.5, cy).stroke();
    doc.moveTo(cx, cy - 2.5).lineTo(cx, cy + 2.5).stroke();
  } else if (type === 'worked') {
    setFill(doc, '#1e3a5f');
    doc.circle(cx, cy, r).fill();
    doc.font('Helvetica-Bold').fontSize(6);
    setFill(doc, '#ffffff');
    doc.text('Σ', cx - 2, cy - 3.5, { lineBreak: false });
  } else {
    // sessions
    setFill(doc, '#475569');
    doc.circle(cx, cy, r).fill();
    doc.font('Helvetica-Bold').fontSize(6);
    setFill(doc, '#ffffff');
    doc.text('#', cx - 1.8, cy - 3.5, { lineBreak: false });
  }
}

function drawKpiStrip(doc: PdfDoc, summary: any) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  const items: Array<{ label: string; value: string | number; type: string; bg: string }> = [
    { label: 'Sessions', value: summary.sessions ?? 0, type: 'sessions', bg: '#f8fafc' },
    { label: 'Present', value: summary.present ?? 0, type: 'present', bg: '#f0fdf4' },
    { label: 'Half Day', value: summary.halfDay ?? 0, type: 'half_day', bg: '#fefce8' },
    { label: 'Absent', value: summary.absent ?? 0, type: 'absent', bg: '#fef2f2' },
    { label: 'Leave', value: summary.leave ?? 0, type: 'leave', bg: '#f0f9ff' },
    { label: 'Weekly Off', value: summary.weeklyOff ?? 0, type: 'weekly_off', bg: '#faf5ff' },
    { label: 'Holiday', value: summary.holiday ?? 0, type: 'holiday', bg: '#fdf2f8' },
    { label: 'Worked', value: fmtWorked(summary.workedDays), type: 'worked', bg: '#f8fafc' },
  ];

  doc.font('Helvetica-Bold').fontSize(11);
  setFill(doc, THEME.navy);
  doc.text('Summary', left, doc.y);
  doc.moveDown(0.3);

  const y0 = doc.y;
  const gap = 5;
  const cardW = (width - gap * (items.length - 1)) / items.length;
  const cardH = 46;

  items.forEach((item, i) => {
    const x = left + i * (cardW + gap);

    // Card background
    setFill(doc, item.bg);
    setStroke(doc, THEME.line);
    doc.roundedRect(x, y0, cardW, cardH, 4).fillAndStroke();

    // Top vector icon
    drawKpiIcon(doc, item.type, x + cardW / 2, y0 + 10);

    // Label
    doc.font('Helvetica').fontSize(6.8);
    setFill(doc, THEME.muted);
    doc.text(item.label, x + 2, y0 + 20, { width: cardW - 4, align: 'center' });

    // Value
    doc.font('Helvetica-Bold').fontSize(12);
    setFill(doc, THEME.navy);
    doc.text(String(item.value), x + 2, y0 + 31, { width: cardW - 4, align: 'center' });
  });

  doc.y = y0 + cardH + 10;
}

type PdfCol = { key: string; label: string; width: number; align?: 'left' | 'center' | 'right' };

function drawTableHeader(doc: PdfDoc, cols: PdfCol[], x: number, y: number, rowH: number) {
  let cx = x;
  for (const col of cols) {
    setFill(doc, THEME.headerBg);
    doc.rect(cx, y, col.width, rowH).fill();
    setStroke(doc, THEME.line);
    doc.rect(cx, y, col.width, rowH).lineWidth(0.4).stroke();

    doc.font('Helvetica-Bold').fontSize(7.5);
    setFill(doc, THEME.navy);
    doc.text(col.label, cx + 2, y + 5, {
      width: col.width - 4,
      align: col.align || 'left',
      lineBreak: false,
    });
    cx += col.width;
  }
}

function drawTableRow(
  doc: PdfDoc,
  cols: PdfCol[],
  values: Record<string, string>,
  x: number,
  y: number,
  rowH: number,
  opts?: { statusCol?: string; zebra?: boolean },
) {
  let cx = x;
  if (opts?.zebra) {
    setFill(doc, '#f8fafc');
    doc.rect(x, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill();
  }
  setStroke(doc, THEME.line);
  doc.rect(x, y, cols.reduce((s, c) => s + c.width, 0), rowH).lineWidth(0.4).stroke();

  cols.forEach((col) => {
    const raw = values[col.key] ?? '';
    if (opts?.statusCol === col.key && raw && !String(raw).includes(':')) {
      const sk = statusKey(raw);
      const st = THEME.status[sk] || THEME.status.missing;
      const pillW = Math.min(col.width - 6, 48);
      const pillX = cx + (col.width - pillW) / 2;
      const pillY = y + 3;
      const pillH = rowH - 6;

      setFill(doc, st.fill);
      doc.roundedRect(pillX, pillY, pillW, pillH, 4).fill();

      doc.font('Helvetica-Bold').fontSize(6.8);
      setFill(doc, st.text);
      doc.text(String(raw), pillX, pillY + 2.5, {
        width: pillW,
        align: 'center',
        lineBreak: false,
      });
    } else {
      doc.font('Helvetica').fontSize(7.2);
      setFill(doc, THEME.text);
      doc.text(String(raw), cx + 3, y + 5, {
        width: col.width - 6,
        align: col.align || 'left',
        lineBreak: false,
        ellipsis: true,
      });
    }
    cx += col.width;
  });
}

function drawLegend(doc: PdfDoc) {
  ensureSpace(doc, 32);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const boxW = right - left;
  const boxH = 22;
  const y = doc.y + 4;

  // Outer container box
  setFill(doc, '#f8fafc');
  setStroke(doc, THEME.line);
  doc.roundedRect(left, y, boxW, boxH, 4).fillAndStroke();

  // Label: "Legend:"
  doc.font('Helvetica-Bold').fontSize(7.5);
  setFill(doc, THEME.navy);
  doc.text('Legend:', left + 8, y + 6);

  let cx = left + 48;
  const pillY = y + 4;
  const pillH = 14;

  for (const L of STATUS_CODE_LEGEND) {
    const sk = statusKey(L.code);
    const st = THEME.status[sk] || THEME.status.missing;
    const label = `${L.code} = ${L.label}`;
    const txtW = doc.widthOfString(label) + 8;

    setFill(doc, st.fill);
    doc.roundedRect(cx, pillY, txtW, pillH, 3).fill();

    doc.font('Helvetica-Bold').fontSize(6.5);
    setFill(doc, st.text);
    doc.text(label, cx + 4, pillY + 3.5, { lineBreak: false });

    cx += txtW + 6;
    if (cx > right - 60) break;
  }

  doc.y = y + boxH + 8;
}

function stampPages(doc: PdfDoc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - 20;
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    setStroke(doc, THEME.line);
    doc
      .moveTo(left, bottom - 6)
      .lineTo(left + width, bottom - 6)
      .lineWidth(0.5)
      .stroke();

    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7.5);
    setFill(doc, THEME.muted);
    doc.text(`Page ${i + 1} of ${pages.count}`, left, bottom - 2, {
      align: 'right',
      width,
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
  }
}

function drawDetailTable(doc: PdfDoc, rows: any[]) {
  ensureSpace(doc, 30);
  doc.font('Helvetica-Bold').fontSize(11);
  setFill(doc, THEME.navy);
  doc.text('Details', doc.page.margins.left, doc.y);
  doc.moveDown(0.3);

  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols: PdfCol[] = [
    { key: 'date', label: 'Date', width: Math.floor(usable * 0.13) },
    { key: 'shift', label: 'Shift', width: Math.floor(usable * 0.08), align: 'center' },
    { key: 'source', label: 'Manpower Source', width: Math.floor(usable * 0.21) },
    { key: 'party', label: 'Company / Contractor', width: Math.floor(usable * 0.2) },
    { key: 'worker', label: 'Worker / Labour Type', width: Math.floor(usable * 0.22) },
    { key: 'status', label: 'Status', width: Math.floor(usable * 0.1), align: 'center' },
    { key: 'worked', label: 'Worked', width: usable - Math.floor(usable * 0.13) - Math.floor(usable * 0.08) - Math.floor(usable * 0.21) - Math.floor(usable * 0.2) - Math.floor(usable * 0.22) - Math.floor(usable * 0.1), align: 'center' },
  ];

  const x = doc.page.margins.left;
  const rowH = 17;
  const headerH = 18;

  if (!rows.length) {
    doc.font('Helvetica').fontSize(8.5);
    setFill(doc, THEME.muted);
    doc.text('No attendance records for the selected filters.');
    return;
  }

  const paintHeader = () => {
    ensureSpace(doc, headerH + rowH);
    drawTableHeader(doc, cols, x, doc.y, headerH);
    doc.y += headerH;
  };

  paintHeader();
  rows.forEach((r, idx) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      paintHeader();
    }
    const values = {
      date: String(r.date || ''),
      shift: formatShiftLabel(r.shift),
      source: sourceLabel(r),
      party: partyLabel(r),
      worker: workerLabel(r),
      status: statusDisplay(r),
      worked: fmtWorked(r.workedDays),
    };
    drawTableRow(doc, cols, values, x, doc.y, rowH, {
      statusCol: 'status',
      zebra: idx % 2 === 1,
    });
    doc.y += rowH;
  });
  doc.y += 6;
}

function drawContractorTable(doc: PdfDoc, rows: any[]) {
  ensureSpace(doc, 30);
  doc.font('Helvetica-Bold').fontSize(11);
  setFill(doc, THEME.navy);
  doc.text('Details', doc.page.margins.left, doc.y);
  doc.moveDown(0.3);

  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols: PdfCol[] = [
    { key: 'num', label: '#', width: 24, align: 'center' },
    { key: 'worker', label: 'Worker / Labour Type', width: Math.floor(usable * 0.42) },
    { key: 'present', label: 'P', width: Math.floor(usable * 0.1), align: 'center' },
    { key: 'halfDay', label: 'HD', width: Math.floor(usable * 0.1), align: 'center' },
    { key: 'absent', label: 'A', width: Math.floor(usable * 0.1), align: 'center' },
    { key: 'leave', label: 'L', width: Math.floor(usable * 0.1), align: 'center' },
    { key: 'worked', label: 'Worked', width: usable - 24 - Math.floor(usable * 0.42) - Math.floor(usable * 0.4), align: 'center' },
  ];

  const x = doc.page.margins.left;
  const rowH = 17;
  const headerH = 18;

  const paintHeader = () => {
    ensureSpace(doc, headerH + rowH);
    drawTableHeader(doc, cols, x, doc.y, headerH);
    doc.y += headerH;
  };

  paintHeader();
  rows.forEach((r, idx) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      paintHeader();
    }
    const values = {
      num: String(idx + 1),
      worker: r.recordKind === 'workforce_aggregate' ? (r.labourType || 'Workforce') : `${r.name || '—'} (${r.labourType || '—'})`,
      present: String(r.present ?? 0),
      halfDay: String(r.halfDay ?? 0),
      absent: String(r.absent ?? 0),
      leave: String(r.leave ?? 0),
      worked: fmtWorked(r.workedDays),
    };
    drawTableRow(doc, cols, values, x, doc.y, rowH, { zebra: idx % 2 === 1 });
    doc.y += rowH;
  });
  doc.y += 6;
}

function drawLabourOnlyTable(doc: PdfDoc, rows: any[]) {
  ensureSpace(doc, 30);
  doc.font('Helvetica-Bold').fontSize(11);
  setFill(doc, THEME.navy);
  doc.text('Details', doc.page.margins.left, doc.y);
  doc.moveDown(0.3);

  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols: PdfCol[] = [
    { key: 'num', label: '#', width: 24, align: 'center' },
    { key: 'source', label: 'Source', width: Math.floor(usable * 0.26) },
    { key: 'worker', label: 'Worker / Labour Type', width: Math.floor(usable * 0.34) },
    { key: 'present', label: 'P', width: Math.floor(usable * 0.09), align: 'center' },
    { key: 'halfDay', label: 'HD', width: Math.floor(usable * 0.09), align: 'center' },
    { key: 'absent', label: 'A', width: Math.floor(usable * 0.09), align: 'center' },
    { key: 'worked', label: 'Worked', width: usable - 24 - Math.floor(usable * 0.26) - Math.floor(usable * 0.34) - Math.floor(usable * 0.27), align: 'center' },
  ];

  const x = doc.page.margins.left;
  const rowH = 17;
  const headerH = 18;

  const paintHeader = () => {
    ensureSpace(doc, headerH + rowH);
    drawTableHeader(doc, cols, x, doc.y, headerH);
    doc.y += headerH;
  };

  paintHeader();
  rows.forEach((r, idx) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      paintHeader();
    }
    const values = {
      num: String(idx + 1),
      source: sourceLabel(r),
      worker: r.recordKind === 'workforce_aggregate' ? (r.labourType || 'Workforce') : `${r.name || '—'} (${r.labourType || '—'})`,
      present: String(r.present ?? 0),
      halfDay: String(r.halfDay ?? 0),
      absent: String(r.absent ?? 0),
      worked: fmtWorked(r.workedDays),
    };
    drawTableRow(doc, cols, values, x, doc.y, rowH, { zebra: idx % 2 === 1 });
    doc.y += rowH;
  });
  doc.y += 6;
}

function drawMonthlyMatrix(doc: PdfDoc, report: ExportReport) {
  ensureSpace(doc, 30);
  doc.font('Helvetica-Bold').fontSize(11);
  setFill(doc, THEME.navy);
  doc.text('Monthly Matrix', doc.page.margins.left, doc.y);
  doc.moveDown(0.3);

  const meta = report.meta || {};
  const dayKeys: string[] = meta.dayKeys || [];
  const rows = report.matrixRows || report.rows || [];
  if (!rows.length) {
    doc.font('Helvetica').fontSize(8.5);
    setFill(doc, THEME.muted);
    doc.text('No attendance records for the selected filters.');
    return;
  }

  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const numW = 20;
  const workerW = 150;
  const workedW = 32;
  const dayW = Math.max(14, Math.floor((usable - numW - workerW - workedW) / Math.max(dayKeys.length, 1)));

  const cols: PdfCol[] = [
    { key: 'num', label: '#', width: numW, align: 'center' },
    { key: 'worker', label: 'Worker / Labour Type', width: workerW },
    ...dayKeys.map((d) => ({ key: d, label: d.replace(/^0/, ''), width: dayW, align: 'center' as const })),
    { key: 'worked', label: 'Worked', width: workedW, align: 'center' as const },
  ];

  const rowH = 14;
  const headerH = 16;

  const paintHeader = () => {
    ensureSpace(doc, headerH + rowH);
    drawTableHeader(doc, cols, left, doc.y, headerH);
    doc.y += headerH;
  };

  paintHeader();
  rows.forEach((r, idx) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      paintHeader();
    }
    const label =
      r.recordKind === 'workforce_aggregate'
        ? `[WF] ${r.contractorName ? `${r.contractorName}: ` : ''}${r.labourType || ''}`
        : `${r.name || '—'} (${r.labourType || '—'})`;

    let cx = left;
    const y = doc.y;

    if (idx % 2 === 1) {
      setFill(doc, '#f8fafc');
      doc.rect(left, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill();
    }

    setStroke(doc, THEME.line);
    doc.rect(left, y, cols.reduce((s, c) => s + c.width, 0), rowH).lineWidth(0.3).stroke();

    // Num
    doc.font('Helvetica').fontSize(6);
    setFill(doc, THEME.muted);
    doc.text(String(idx + 1), cx, y + 3, { width: numW, align: 'center' });
    cx += numW;

    // Worker
    doc.font('Helvetica').fontSize(6);
    setFill(doc, THEME.text);
    doc.text(label, cx + 2, y + 3, { width: workerW - 4, lineBreak: false, ellipsis: true });
    cx += workerW;

    // Day cells
    for (const d of dayKeys) {
      const code = r.days?.[d] ?? '—';
      const sk = statusKey(code);
      const st = THEME.status[sk] || THEME.status.missing;
      if (code && code !== '—') {
        setFill(doc, st.fill);
        doc.rect(cx + 0.5, y + 0.5, dayW - 1, rowH - 1).fill();
      }
      doc.font('Helvetica-Bold').fontSize(5.5);
      setFill(doc, st.text);
      doc.text(code, cx, y + 3, { width: dayW, align: 'center', lineBreak: false });
      cx += dayW;
    }

    // Worked
    doc.font('Helvetica-Bold').fontSize(6);
    setFill(doc, THEME.navy);
    doc.text(fmtWorked(r.workedDays), cx, y + 3, { width: workedW, align: 'center', lineBreak: false });

    doc.y += rowH;
  });
  doc.y += 6;
}

function drawProjectSummaryMetrics(doc: PdfDoc, metrics: any[]) {
  ensureSpace(doc, 30);
  doc.font('Helvetica-Bold').fontSize(11);
  setFill(doc, THEME.navy);
  doc.text('Project Metrics', doc.page.margins.left, doc.y);
  doc.moveDown(0.3);

  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols: PdfCol[] = [
    { key: 'label', label: 'Metric', width: Math.floor(usable * 0.6) },
    { key: 'value', label: 'Count / Person-Days', width: Math.floor(usable * 0.25), align: 'center' },
    { key: 'note', label: 'Notes', width: usable - Math.floor(usable * 0.6) - Math.floor(usable * 0.25) },
  ];

  const rowH = 17;
  const headerH = 18;

  ensureSpace(doc, headerH + rowH);
  drawTableHeader(doc, cols, left, doc.y, headerH);
  doc.y += headerH;

  metrics.forEach((m, idx) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      drawTableHeader(doc, cols, left, doc.y, headerH);
      doc.y += headerH;
    }
    drawTableRow(
      doc,
      cols,
      { label: m.label, value: String(fmt(m.value)), note: m.note || '' },
      left,
      doc.y,
      rowH,
      { zebra: idx % 2 === 1 },
    );
    doc.y += rowH;
  });
  doc.y += 6;
}

export async function buildTypedAttendancePdf(report: ExportReport): Promise<Buffer> {
  const meta = report.meta || {};
  const isMonthly = Array.isArray(meta.dayKeys) && meta.dayKeys.length > 0;
  const landscape = isMonthly;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 32,
      size: 'A4',
      layout: landscape ? 'landscape' : 'portrait',
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawBrandHeader(doc, meta.reportTitle || 'Attendance Report');
    drawMetaBlock(doc, meta);
    drawKpiStrip(doc, report.summary || {});

    if (isMonthly) {
      drawMonthlyMatrix(doc, report);
    } else if (meta.reportType === 'contractor') {
      drawContractorTable(doc, report.rollupRows || report.rows || []);
    } else if (meta.reportType === 'labour_only') {
      drawLabourOnlyTable(doc, report.rollupRows || report.rows || []);
    } else if (meta.reportType === 'project_summary' && report.metrics?.length) {
      drawProjectSummaryMetrics(doc, report.metrics);
      if ((report.rows || []).length) {
        drawDetailTable(doc, (report.rows || []).slice(0, 100));
      }
    } else {
      drawDetailTable(doc, report.dailyRows || report.rows || []);
    }

    drawLegend(doc);
    stampPages(doc);
    doc.end();
  });
}

export async function buildAttendancePdf(report: {
  summary: any;
  detail: any[];
  meta?: { projectName?: string; companyName?: string; from?: string; to?: string };
}): Promise<Buffer> {
  return buildTypedAttendancePdf({
    meta: {
      reportTitle: 'Daily Attendance Report',
      companyName: report.meta?.companyName,
      projectName: report.meta?.projectName,
      from: report.meta?.from,
      to: report.meta?.to,
      shift: 'all',
      reportType: 'daily',
    },
    summary: report.summary,
    rows: (report.detail || []).map((r) => ({
      ...r,
      recordKind: r.recordKind === 'workforce' ? 'workforce_aggregate' : r.recordKind || 'individual',
    })),
  });
}
