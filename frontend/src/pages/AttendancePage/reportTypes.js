export const REPORT_TYPES = [
  { value: 'daily', label: 'Daily Attendance Report' },
  { value: 'monthly', label: 'Monthly Attendance Report' },
  { value: 'contractor', label: 'Contractor-Wise Attendance Report' },
  { value: 'labour_only', label: 'Labour-Only Attendance Report' },
  { value: 'project_summary', label: 'Project-Wise Attendance Summary' },
  { value: 'individual', label: 'Individual Worker History' },
];

export const STATUS_CODE_LEGEND = [
  { code: 'P', label: 'Present' },
  { code: 'HD', label: 'Half Day' },
  { code: 'A', label: 'Absent' },
  { code: 'L', label: 'Leave' },
  { code: 'WO', label: 'Weekly Off' },
  { code: 'H', label: 'Holiday' },
  { code: '—', label: 'No attendance recorded' },
];

/** Which filters are visible for each report type */
export function filtersForReportType(reportType) {
  const base = { shift: true, labourType: true };
  switch (reportType) {
    case 'daily':
      return { ...base, date: true, source: true, contractorId: true, status: true };
    case 'monthly':
      return { ...base, monthYear: true, source: true, contractorId: true, labourScope: true };
    case 'contractor':
      return { ...base, from: true, to: true, contractorId: true, status: true };
    case 'labour_only':
      return { ...base, from: true, to: true, labourScope: true, contractorId: true, status: true };
    case 'project_summary':
      return { from: true, to: true, shift: true };
    case 'individual':
      return { from: true, to: true, shift: true, worker: true, status: true };
    default:
      return { ...base, from: true, to: true };
  }
}

export function defaultFilters() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${d}`;
  return {
    reportType: 'daily',
    date: today,
    from: today,
    to: today,
    year: String(y),
    month: String(now.getMonth() + 1),
    shift: '',
    source: '',
    labourScope: 'all',
    contractorId: '',
    labourType: '',
    subjectId: '',
    subjectType: '',
    status: '',
    page: 1,
    limit: 50,
  };
}

export function buildReportQuery(filters) {
  const q = {
    reportType: filters.reportType,
    page: filters.page || 1,
    limit: filters.limit || 50,
  };
  const vis = filtersForReportType(filters.reportType);
  if (vis.date) q.date = filters.date;
  if (vis.from) q.from = filters.from;
  if (vis.to) q.to = filters.to;
  if (vis.monthYear) {
    q.year = filters.year;
    q.month = filters.month;
  }
  if (vis.shift && filters.shift) q.shift = filters.shift;
  if (vis.source && filters.source) q.source = filters.source;
  if (vis.labourScope && filters.labourScope) q.labourScope = filters.labourScope;
  if (vis.contractorId && filters.contractorId) q.contractorId = filters.contractorId;
  if (vis.labourType && filters.labourType) q.labourType = filters.labourType;
  if (vis.status && filters.status) q.status = filters.status;
  if (vis.worker && filters.subjectId) {
    q.subjectId = filters.subjectId;
    q.subjectType = filters.subjectType;
  }
  return q;
}

export function recordKindLabel(kind) {
  if (kind === 'workforce_aggregate' || kind === 'workforce') return 'Workforce aggregate';
  return 'Individual';
}
