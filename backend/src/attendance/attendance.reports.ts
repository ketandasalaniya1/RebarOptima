import { ObjectId } from 'mongodb';
import { loadContractorMode } from '../manpower/contractor-mode';
import {
  isValidShift,
  isValidSource,
  isValidStatus,
  workedDaysForStatus,
  workedPersonDays,
} from './attendance.calc';
import {
  COL_LINES,
  COL_SESSIONS,
  COL_WF_LINES,
  listEligibleCompanyLabour,
  normalizeDate,
} from './attendance.service';

export const REPORT_TYPES = [
  'daily',
  'monthly',
  'contractor',
  'labour_only',
  'project_summary',
  'individual',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const STATUS_CODES: Record<string, string> = {
  present: 'P',
  half_day: 'HD',
  absent: 'A',
  leave: 'L',
  weekly_off: 'WO',
  holiday: 'H',
};

export const STATUS_CODE_LEGEND = [
  { code: 'P', status: 'present', label: 'Present' },
  { code: 'HD', status: 'half_day', label: 'Half Day' },
  { code: 'A', status: 'absent', label: 'Absent' },
  { code: 'L', status: 'leave', label: 'Leave' },
  { code: 'WO', status: 'weekly_off', label: 'Weekly Off' },
  { code: 'H', status: 'holiday', label: 'Holiday' },
  { code: '—', status: null, label: 'No attendance recorded' },
];

export const EXCEL_ROW_CAP = 50000;
export const PDF_ROW_CAP = 5000;

function toObjectId(id: any): ObjectId | null {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  const str = String(id).trim();
  if (ObjectId.isValid(str) && str.length === 24) {
    try {
      return new ObjectId(str);
    } catch {
      return null;
    }
  }
  return null;
}

function companyFilter(companyId: any): any {
  if (!companyId) return { companyId: null };
  const objId = toObjectId(companyId);
  if (objId) return { $or: [{ companyId: objId }, { companyId: String(companyId) }] };
  return { companyId: String(companyId) };
}

function projectFilter(projectId: string): any {
  const objId = toObjectId(projectId);
  if (objId) return { $or: [{ projectId: objId }, { projectId: String(projectId) }] };
  return { projectId: String(projectId) };
}

function andFilters(...parts: any[]): any {
  const clauses = parts.filter((p) => p && typeof p === 'object' && Object.keys(p).length > 0);
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

function idQuery(id: string) {
  const oid = toObjectId(id);
  if (oid) return { $or: [{ _id: oid }, { _id: String(id) }] };
  return { _id: String(id) };
}

function contractorIdFilter(contractorId: string): any {
  const oid = toObjectId(contractorId);
  if (oid) return { $or: [{ contractorId: oid }, { contractorId: String(contractorId) }] };
  return { contractorId: String(contractorId) };
}

function fail(status: number, message: string, code?: string) {
  const err: any = new Error(message);
  err.status = status;
  if (code) err.code = code;
  throw err;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00.000Z`).getTime();
  const b = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

function monthBounds(year: number, month: number): { from: string; to: string; daysInMonth: number } {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) fail(400, 'Invalid year');
  if (!Number.isInteger(month) || month < 1 || month > 12) fail(400, 'Invalid month');
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`,
    daysInMonth,
  };
}

function emptySummary(): Record<string, any> {
  return {
    sessions: 0,
    present: 0,
    halfDay: 0,
    absent: 0,
    leave: 0,
    weeklyOff: 0,
    holiday: 0,
    workedDays: 0,
    individualRows: 0,
    workforceRows: 0,
  };
}

function addIndividualToSummary(summary: any, status: string, workedDays: number) {
  if (status === 'present') summary.present = (summary.present || 0) + 1;
  else if (status === 'half_day') summary.halfDay = (summary.halfDay || 0) + 1;
  else if (status === 'absent') summary.absent = (summary.absent || 0) + 1;
  else if (status === 'leave') summary.leave = (summary.leave || 0) + 1;
  else if (status === 'weekly_off') summary.weeklyOff = (summary.weeklyOff || 0) + 1;
  else if (status === 'holiday') summary.holiday = (summary.holiday || 0) + 1;
  summary.workedDays = (summary.workedDays || 0) + workedDays;
  summary.individualRows = (summary.individualRows || 0) + 1;
}

function addWorkforceToSummary(summary: any, row: any) {
  summary.present = (summary.present || 0) + (Number(row.present) || 0);
  summary.halfDay = (summary.halfDay || 0) + (Number(row.halfDay) || 0);
  summary.absent = (summary.absent || 0) + (Number(row.absent) || 0);
  summary.leave = (summary.leave || 0) + (Number(row.leave) || 0);
  summary.weeklyOff = (summary.weeklyOff || 0) + (Number(row.weeklyOff) || 0);
  summary.holiday = (summary.holiday || 0) + (Number(row.holiday) || 0);
  summary.workedDays =
    (summary.workedDays || 0) +
    (row.workedPersonDays != null
      ? Number(row.workedPersonDays)
      : row.workedDays != null
        ? Number(row.workedDays)
        : workedPersonDays(row.present || 0, row.halfDay || 0));
  summary.workforceRows = (summary.workforceRows || 0) + 1;
}

function paginate<T>(rows: T[], page: number, limit: number) {
  const p = Math.max(1, page || 1);
  const l = Math.min(Math.max(1, limit || 50), 200);
  const start = (p - 1) * l;
  return {
    rows: rows.slice(start, start + l),
    pagination: {
      page: p,
      limit: l,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / l)),
    },
  };
}

function resolveLabourScopeSources(labourScope?: string, source?: string): string[] | null {
  if (source && isValidSource(source)) return [source];
  const scope = String(labourScope || 'all').toLowerCase();
  if (scope === 'company') return ['company_labour'];
  if (scope === 'named') return ['contractor_named'];
  if (scope === 'workforce') return ['contractor_workforce'];
  if (scope === 'all' || !scope) return null;
  fail(400, 'labourScope must be company, named, workforce, or all');
  return null;
}

export type ReportQuery = {
  reportType?: string;
  date?: string;
  from?: string;
  to?: string;
  year?: string | number;
  month?: string | number;
  shift?: string;
  source?: string;
  labourScope?: string;
  contractorId?: string;
  departmentId?: string;
  labourType?: string;
  subjectId?: string;
  subjectType?: string;
  status?: string;
  page?: string | number;
  limit?: string | number;
};

async function loadSessionsRaw(
  db: any,
  companyId: string,
  projectId: string,
  opts: {
    from: string;
    to: string;
    shift?: string;
    sources?: string[] | null;
    contractorId?: string;
    max?: number;
  },
) {
  const filter: any[] = [
    companyFilter(companyId),
    projectFilter(projectId),
    { isVoided: { $ne: true } },
    { date: { $gte: opts.from, $lte: opts.to } },
  ];
  if (opts.shift && isValidShift(opts.shift)) filter.push({ shift: opts.shift });
  if (opts.sources && opts.sources.length === 1) filter.push({ source: opts.sources[0] });
  else if (opts.sources && opts.sources.length > 1) filter.push({ source: { $in: opts.sources } });
  if (opts.contractorId) filter.push(contractorIdFilter(opts.contractorId));

  const max = Math.min(opts.max || 5000, 10000);
  return db
    .collection(COL_SESSIONS)
    .find(andFilters(...filter))
    .sort({ date: 1, shift: 1, source: 1 })
    .limit(max)
    .toArray();
}

async function bulkLoadLines(db: any, sessionIds: ObjectId[]) {
  if (!sessionIds.length) return { lines: [] as any[], wfLines: [] as any[] };
  const [lines, wfLines] = await Promise.all([
    db.collection(COL_LINES).find({ sessionId: { $in: sessionIds } }).toArray(),
    db.collection(COL_WF_LINES).find({ sessionId: { $in: sessionIds } }).toArray(),
  ]);
  return { lines, wfLines };
}

type DetailRow = {
  date: string;
  shift: string;
  source: string;
  contractorId: string | null;
  contractorName: string | null;
  subjectId?: string | null;
  name: string | null;
  labourType: string | null;
  status: string | null;
  statusCode?: string | null;
  present?: number;
  halfDay?: number;
  absent?: number;
  leave?: number;
  weeklyOff?: number;
  holiday?: number;
  eligibleCount?: number;
  workedDays: number;
  remark?: string;
  recordKind: 'individual' | 'workforce_aggregate';
  sessionId?: string;
};

async function flattenSessions(
  db: any,
  sessions: any[],
  filters: { labourType?: string; status?: string },
): Promise<{ rows: DetailRow[]; summary: any; contractorNames: Map<string, string> }> {
  const sessionIds = sessions.map((s) => s._id);
  const { lines, wfLines } = await bulkLoadLines(db, sessionIds);
  const linesBySession = new Map<string, any[]>();
  for (const l of lines) {
    const k = String(l.sessionId);
    if (!linesBySession.has(k)) linesBySession.set(k, []);
    linesBySession.get(k)!.push(l);
  }
  const wfBySession = new Map<string, any[]>();
  for (const w of wfLines) {
    const k = String(w.sessionId);
    if (!wfBySession.has(k)) wfBySession.set(k, []);
    wfBySession.get(k)!.push(w);
  }

  const contractorNames = new Map<string, string>();
  const needNames = [
    ...new Set(
      sessions
        .filter((s) => s.contractorId)
        .map((s) => String(s.contractorId)),
    ),
  ];
  if (needNames.length) {
    const orIds = needNames.flatMap((id) => {
      const oid = toObjectId(id);
      return oid ? [{ _id: oid }, { _id: id }] : [{ _id: id }];
    });
    const ctrs = await db.collection('contractors').find({ $or: orIds }).toArray();
    for (const c of ctrs) contractorNames.set(String(c._id), c.name || '');
  }

  const labourTypeQ = filters.labourType
    ? String(filters.labourType).toLowerCase().trim()
    : '';
  const statusQ = filters.status && isValidStatus(filters.status) ? filters.status : '';

  const rows: DetailRow[] = [];
  const summary = emptySummary();
  summary.sessions = sessions.length;

  for (const s of sessions) {
    const sid = String(s._id);
    const cid = s.contractorId ? String(s.contractorId) : null;
    const cname =
      (cid && contractorNames.get(cid)) ||
      null;

    if (s.source === 'contractor_workforce') {
      for (const w of wfBySession.get(sid) || []) {
        if (labourTypeQ && String(w.labourType || '').toLowerCase() !== labourTypeQ) continue;
        const wfStatus =
          w.present > 0 && !w.halfDay && !w.absent && !w.leave && !w.weeklyOff && !w.holiday
            ? 'present'
            : w.halfDay > 0 && !w.present && !w.absent && !w.leave && !w.weeklyOff && !w.holiday
              ? 'half_day'
              : null;
        const row: DetailRow = {
          date: s.date,
          shift: s.shift,
          source: s.source,
          contractorId: cid,
          contractorName: cname,
          name: null,
          labourType: w.labourType || null,
          status: wfStatus,
          statusCode: wfStatus ? STATUS_CODES[wfStatus] : undefined,
          present: Number(w.present) || 0,
          halfDay: Number(w.halfDay) || 0,
          absent: Number(w.absent) || 0,
          leave: Number(w.leave) || 0,
          weeklyOff: Number(w.weeklyOff) || 0,
          holiday: Number(w.holiday) || 0,
          eligibleCount: Number(w.eligibleCount) || 0,
          workedDays:
            w.workedPersonDays != null
              ? Number(w.workedPersonDays)
              : workedPersonDays(w.present || 0, w.halfDay || 0),
          recordKind: 'workforce_aggregate',
          sessionId: sid,
        };
        rows.push(row);
        addWorkforceToSummary(summary, row);
      }
    } else {
      for (const l of linesBySession.get(sid) || []) {
        if (labourTypeQ && String(l.labourTypeSnapshot || '').toLowerCase() !== labourTypeQ) {
          continue;
        }
        if (statusQ && l.status !== statusQ) continue;
        const worked =
          l.workedDays != null ? Number(l.workedDays) : workedDaysForStatus(l.status);
        const row: DetailRow = {
          date: s.date,
          shift: s.shift,
          source: s.source,
          contractorId: cid,
          contractorName: l.contractorNameSnapshot || cname,
          subjectId: l.subjectId ? String(l.subjectId) : null,
          name: l.nameSnapshot || null,
          labourType: l.labourTypeSnapshot || null,
          status: l.status || null,
          statusCode: STATUS_CODES[l.status] || '—',
          workedDays: worked,
          remark: l.remark || '',
          recordKind: 'individual',
          sessionId: sid,
        };
        rows.push(row);
        addIndividualToSummary(summary, l.status, worked);
      }
    }
  }

  return { rows, summary, contractorNames };
}

function assertRange(from: string, to: string) {
  if (from > to) fail(400, 'from must be on or before to');
  if (daysBetween(from, to) > 366) fail(400, 'Date range cannot exceed 366 days');
}

export async function getReportMeta(db: any, companyId: string, projectId: string) {
  const contractors = await db
    .collection('contractors')
    .find(
      andFilters(companyFilter(companyId), projectFilter(projectId), {
        isActive: { $ne: false },
      }),
    )
    .sort({ name: 1 })
    .toArray();

  const { subjects: companyLabour } = await listEligibleCompanyLabour(db, companyId, projectId);

  const namedWorkers = await db
    .collection('contractor_labours')
    .find(
      andFilters(companyFilter(companyId), projectFilter(projectId), {
        isActive: { $ne: false },
      }),
    )
    .sort({ name: 1 })
    .limit(2000)
    .toArray();

  const labourTypes = new Set<string>();
  for (const l of companyLabour) if (l.labourType) labourTypes.add(l.labourType);
  for (const w of namedWorkers) if (w.labourType) labourTypes.add(w.labourType);

  const wfDocs = await db
    .collection('contractor_workforce')
    .find(andFilters(companyFilter(companyId), projectFilter(projectId)))
    .toArray();
  for (const doc of wfDocs) {
    for (const r of doc.rows || []) if (r.labourType) labourTypes.add(r.labourType);
  }

  return {
    reportTypes: REPORT_TYPES.map((t) => ({ value: t, label: reportTypeLabel(t) })),
    shifts: [
      { value: '', label: 'All shifts' },
      { value: 'day', label: 'Day' },
      { value: 'night', label: 'Night' },
    ],
    sources: [
      { value: '', label: 'All sources' },
      { value: 'company_labour', label: 'Company Labour' },
      { value: 'contractor_named', label: 'Contractor Named' },
      { value: 'contractor_workforce', label: 'Contractor Workforce' },
    ],
    labourScopes: [
      { value: 'all', label: 'All labour sources' },
      { value: 'company', label: 'Company Labour only' },
      { value: 'named', label: 'Named Contractor Labour only' },
      { value: 'workforce', label: 'Contractor Workforce only' },
    ],
    statuses: [
      { value: '', label: 'All statuses' },
      ...STATUS_CODE_LEGEND.filter((x) => x.status).map((x) => ({
        value: x.status!,
        label: x.label,
      })),
    ],
    contractors: contractors.map((c: any) => ({
      id: String(c._id),
      name: c.name || '',
      attendanceMethod: c.attendanceMethod || 'count_of_workers',
    })),
    labourTypes: [...labourTypes].sort().map((t) => ({ value: t, label: t })),
    workers: [
      ...companyLabour.map((l: any) => ({
        id: String(l.labourId),
        name: l.name,
        labourType: l.labourType,
        subjectType: 'company_labour',
        contractorId: null,
      })),
      ...namedWorkers.map((w: any) => ({
        id: String(w._id),
        name: w.name || '',
        labourType: w.labourType || '',
        subjectType: 'contractor_labour',
        contractorId: w.contractorId ? String(w.contractorId) : null,
      })),
    ],
    legend: STATUS_CODE_LEGEND,
  };
}

function reportTypeLabel(t: string) {
  switch (t) {
    case 'daily':
      return 'Daily Attendance Report';
    case 'monthly':
      return 'Monthly Attendance Report';
    case 'contractor':
      return 'Contractor-Wise Attendance Report';
    case 'labour_only':
      return 'Labour-Only Attendance Report';
    case 'project_summary':
      return 'Project-Wise Attendance Summary';
    case 'individual':
      return 'Individual Worker Attendance History';
    default:
      return t;
  }
}

function parseReportType(q: ReportQuery): ReportType {
  const t = String(q.reportType || 'daily');
  if (!(REPORT_TYPES as readonly string[]).includes(t)) {
    fail(400, `reportType must be one of: ${REPORT_TYPES.join(', ')}`);
  }
  return t as ReportType;
}

export async function buildTypedReport(
  db: any,
  companyId: string,
  projectId: string,
  query: ReportQuery,
  opts: { paginate?: boolean; forExport?: 'xlsx' | 'pdf' | null } = {},
) {
  const reportType = parseReportType(query);
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;
  const doPage = opts.paginate !== false && !opts.forExport;

  let result: any;
  switch (reportType) {
    case 'daily':
      result = await buildDailyReport(db, companyId, projectId, query);
      break;
    case 'monthly':
      result = await buildMonthlyReport(db, companyId, projectId, query);
      break;
    case 'contractor':
      result = await buildContractorReport(db, companyId, projectId, query);
      break;
    case 'labour_only':
      result = await buildLabourOnlyReport(db, companyId, projectId, query);
      break;
    case 'project_summary':
      result = await buildProjectSummaryReport(db, companyId, projectId, query);
      break;
    case 'individual':
      result = await buildIndividualHistoryReport(db, companyId, projectId, query);
      break;
    default:
      fail(400, 'Unknown reportType');
  }

  result.meta = {
    ...(result.meta || {}),
    reportType,
    reportTitle: reportTypeLabel(reportType),
    legend: STATUS_CODE_LEGEND,
  };

  const rowCount =
    (result.rows?.length || 0) +
    (result.individualRows?.length || 0) +
    (result.workforceRows?.length || 0) +
    (result.matrixRows?.length || 0);

  if (opts.forExport === 'xlsx' && rowCount > EXCEL_ROW_CAP) {
    fail(413, `Report has ${rowCount} rows; narrow filters (Excel cap ${EXCEL_ROW_CAP})`, 'TOO_LARGE');
  }
  if (opts.forExport === 'pdf' && rowCount > PDF_ROW_CAP) {
    fail(413, `Report has ${rowCount} rows; narrow filters or use Excel (PDF cap ${PDF_ROW_CAP})`, 'TOO_LARGE');
  }

  if (doPage && Array.isArray(result.rows)) {
    const paged = paginate(result.rows, page, limit);
    result.rows = paged.rows;
    result.pagination = paged.pagination;
  } else if (doPage && Array.isArray(result.matrixRows)) {
    const paged = paginate(result.matrixRows, page, limit);
    result.matrixRows = paged.rows;
    result.pagination = paged.pagination;
  } else if (!result.pagination) {
    result.pagination = {
      page: 1,
      limit: rowCount || 50,
      total: rowCount,
      totalPages: 1,
    };
  }

  return result;
}

async function buildDailyReport(db: any, companyId: string, projectId: string, query: ReportQuery) {
  const date = normalizeDate(String(query.date || query.from || ''));
  const sources = resolveLabourScopeSources(query.labourScope, query.source);
  const sessions = await loadSessionsRaw(db, companyId, projectId, {
    from: date,
    to: date,
    shift: query.shift,
    sources,
    contractorId: query.contractorId,
  });
  const { rows, summary } = await flattenSessions(db, sessions, {
    labourType: query.labourType,
    status: query.status,
  });
  return {
    meta: { from: date, to: date, date, shift: query.shift || 'all' },
    summary,
    columns: [
      'date',
      'shift',
      'source',
      'contractorName',
      'name',
      'labourType',
      'recordKind',
      'status',
      'present',
      'halfDay',
      'absent',
      'workedDays',
      'remark',
    ],
    rows,
  };
}

export type WorkerRollupRow = {
  key: string;
  source: string;
  contractorId: string | null;
  contractorName: string | null;
  subjectId?: string | null;
  name: string | null;
  labourType: string | null;
  recordKind: 'individual' | 'workforce_aggregate';
  present: number;
  halfDay: number;
  absent: number;
  leave: number;
  weeklyOff: number;
  holiday: number;
  totalDays: number;
  workedDays: number;
};

export function rollupByWorker(rows: DetailRow[]): WorkerRollupRow[] {
  const map = new Map<string, WorkerRollupRow>();
  for (const r of rows) {
    const isWf = r.recordKind === 'workforce_aggregate';
    const key = isWf
      ? `wf|${r.contractorId || ''}|${String(r.labourType || '').toLowerCase()}`
      : `ind|${r.source}|${r.contractorId || ''}|${r.subjectId || r.name || ''}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        source: r.source,
        contractorId: r.contractorId,
        contractorName: r.contractorName,
        subjectId: r.subjectId,
        name: r.name,
        labourType: r.labourType,
        recordKind: r.recordKind,
        present: 0,
        halfDay: 0,
        absent: 0,
        leave: 0,
        weeklyOff: 0,
        holiday: 0,
        totalDays: 0,
        workedDays: 0,
      });
    }

    const item = map.get(key)!;
    if (isWf) {
      item.present += Number(r.present) || 0;
      item.halfDay += Number(r.halfDay) || 0;
      item.absent += Number(r.absent) || 0;
      item.leave += Number(r.leave) || 0;
      item.weeklyOff += Number(r.weeklyOff) || 0;
      item.holiday += Number(r.holiday) || 0;
      item.workedDays += Number(r.workedDays) || 0;
    } else {
      if (r.status === 'present') item.present += 1;
      else if (r.status === 'half_day') item.halfDay += 1;
      else if (r.status === 'absent') item.absent += 1;
      else if (r.status === 'leave') item.leave += 1;
      else if (r.status === 'weekly_off') item.weeklyOff += 1;
      else if (r.status === 'holiday') item.holiday += 1;
      item.workedDays += Number(r.workedDays) || 0;
    }
  }

  for (const item of map.values()) {
    item.totalDays =
      item.present + item.halfDay + item.absent + item.leave + item.weeklyOff + item.holiday;
    item.workedDays = Math.round(item.workedDays * 10) / 10;
  }

  return [...map.values()];
}

async function buildLabourOnlyReport(
  db: any,
  companyId: string,
  projectId: string,
  query: ReportQuery,
) {
  const from = normalizeDate(String(query.from || query.date || ''));
  const to = normalizeDate(String(query.to || query.date || from));
  assertRange(from, to);
  const sources = resolveLabourScopeSources(query.labourScope || 'all', query.source);
  const sessions = await loadSessionsRaw(db, companyId, projectId, {
    from,
    to,
    shift: query.shift,
    sources,
    contractorId: query.contractorId,
  });
  const { rows, summary } = await flattenSessions(db, sessions, {
    labourType: query.labourType,
    status: query.status,
  });

  const rollupRows = rollupByWorker(rows);
  const companyLabourCount = new Set(
    rows
      .filter((r) => r.source === 'company_labour' && (r.subjectId || r.name))
      .map((r) => r.subjectId || r.name),
  ).size;
  const contractorNamedCount = new Set(
    rows
      .filter(
        (r) =>
          (r.source === 'contractor_named' || r.source === 'contractor_labour') &&
          (r.subjectId || r.name),
      )
      .map((r) => r.subjectId || r.name),
  ).size;
  let workforceHeadcount = 0;
  for (const r of rows) {
    if (r.recordKind === 'workforce_aggregate') {
      workforceHeadcount +=
        (r.present || 0) +
        (r.halfDay || 0) +
        (r.absent || 0) +
        (r.leave || 0) +
        (r.weeklyOff || 0) +
        (r.holiday || 0);
    }
  }
  summary.companyLabourCount = companyLabourCount;
  summary.contractorLabourCount = contractorNamedCount;
  summary.workforceHeadcount = workforceHeadcount;
  summary.totalWorkers = rollupRows.length;

  return {
    meta: { from, to, shift: query.shift || 'all', labourScope: query.labourScope || 'all' },
    summary,
    columns: [
      'source',
      'name',
      'labourType',
      'present',
      'halfDay',
      'absent',
      'workedDays',
    ],
    rollupRows,
    rows: rollupRows,
    dailyRows: rows,
  };
}

async function buildContractorReport(
  db: any,
  companyId: string,
  projectId: string,
  query: ReportQuery,
) {
  const contractorId = String(query.contractorId || '');
  if (!contractorId) fail(400, 'contractorId is required');
  const from = normalizeDate(String(query.from || query.date || ''));
  const to = normalizeDate(String(query.to || query.date || from));
  assertRange(from, to);

  const { contractor, departments, mode } = await loadContractorMode(
    db,
    companyId,
    projectId,
    contractorId,
  );

  const sources =
    mode === 'named' ? ['contractor_named'] : ['contractor_workforce'];
  const sessions = await loadSessionsRaw(db, companyId, projectId, {
    from,
    to,
    shift: query.shift,
    sources,
    contractorId,
  });
  const { rows, summary } = await flattenSessions(db, sessions, {
    labourType: query.labourType,
    status: query.status,
  });

  const rollupRows = rollupByWorker(rows);
  summary.totalWorkers = rollupRows.length;

  return {
    meta: {
      from,
      to,
      shift: query.shift || 'all',
      contractorId,
      contractorName: contractor?.name || '',
      attendanceMethod: contractor?.attendanceMethod || '',
      mode,
      departments: (departments || []).map((d: any) => ({ id: d.id, name: d.name })),
    },
    summary,
    columns: [
      'name',
      'labourType',
      'present',
      'halfDay',
      'absent',
      'leave',
      'workedDays',
    ],
    rollupRows,
    rows: rollupRows,
    dailyRows: rows,
  };
}

async function buildMonthlyReport(db: any, companyId: string, projectId: string, query: ReportQuery) {
  const year = Number(query.year);
  const month = Number(query.month);
  const { from, to, daysInMonth } = monthBounds(year, month);
  const sources = resolveLabourScopeSources(query.labourScope, query.source);
  const shiftFilter = query.shift && isValidShift(query.shift) ? query.shift : '';

  const shiftsToBuild: string[] =
    shiftFilter === 'day' || shiftFilter === 'night'
      ? [shiftFilter]
      : ['day', 'night'];

  const dayKeys = Array.from({ length: daysInMonth }, (_, i) =>
    String(i + 1).padStart(2, '0'),
  );

  const sections: any[] = [];
  const allMatrixRows: any[] = [];
  const summary = emptySummary();

  for (const shift of shiftsToBuild) {
    const sessions = await loadSessionsRaw(db, companyId, projectId, {
      from,
      to,
      shift,
      sources,
      contractorId: query.contractorId,
    });
    const { rows, summary: partSummary, contractorNames } = await flattenSessions(db, sessions, {
      labourType: query.labourType,
      status: undefined,
    });

    summary.sessions += partSummary.sessions;
    summary.present += partSummary.present;
    summary.halfDay += partSummary.halfDay;
    summary.absent += partSummary.absent;
    summary.leave += partSummary.leave;
    summary.weeklyOff += partSummary.weeklyOff;
    summary.holiday += partSummary.holiday;
    summary.workedDays += partSummary.workedDays;
    summary.individualRows += partSummary.individualRows;
    summary.workforceRows += partSummary.workforceRows;

    // Individual matrix
    const individualMap = new Map<string, any>();
    for (const r of rows.filter((x) => x.recordKind === 'individual')) {
      if (query.status && r.status !== query.status) continue;
      const key = `${r.source}|${r.contractorId || ''}|${r.subjectId || r.name}`;
      if (!individualMap.has(key)) {
        individualMap.set(key, {
          shift,
          recordKind: 'individual',
          source: r.source,
          contractorId: r.contractorId,
          contractorName: r.contractorName,
          subjectId: r.subjectId,
          name: r.name,
          labourType: r.labourType,
          days: Object.fromEntries(dayKeys.map((d) => [d, '—'])),
          present: 0,
          halfDay: 0,
          absent: 0,
          leave: 0,
          weeklyOff: 0,
          holiday: 0,
          workedDays: 0,
        });
      }
      const row = individualMap.get(key)!;
      const day = String(Number(r.date.slice(8, 10))).padStart(2, '0');
      row.days[day] = STATUS_CODES[r.status || ''] || '—';
      addIndividualToSummary(row, r.status || '', r.workedDays);
    }

    // Workforce matrix
    const wfMap = new Map<string, any>();
    for (const r of rows.filter((x) => x.recordKind === 'workforce_aggregate')) {
      const key = `${r.contractorId || ''}|${String(r.labourType || '').toLowerCase()}`;
      if (!wfMap.has(key)) {
        wfMap.set(key, {
          shift,
          recordKind: 'workforce_aggregate',
          source: 'contractor_workforce',
          contractorId: r.contractorId,
          contractorName: r.contractorName || contractorNames.get(String(r.contractorId || '')) || null,
          name: null,
          labourType: r.labourType,
          days: Object.fromEntries(dayKeys.map((d) => [d, '—'])),
          present: 0,
          halfDay: 0,
          absent: 0,
          leave: 0,
          weeklyOff: 0,
          holiday: 0,
          workedDays: 0,
          eligibleCountSum: 0,
        });
      }
      const row = wfMap.get(key)!;
      const day = String(Number(r.date.slice(8, 10))).padStart(2, '0');
      row.days[day] = `P${r.present}/HD${r.halfDay}`;
      row.present += Number(r.present) || 0;
      row.halfDay += Number(r.halfDay) || 0;
      row.absent += Number(r.absent) || 0;
      row.leave += Number(r.leave) || 0;
      row.weeklyOff += Number(r.weeklyOff) || 0;
      row.holiday += Number(r.holiday) || 0;
      row.workedDays += Number(r.workedDays) || 0;
      row.eligibleCountSum += Number(r.eligibleCount) || 0;
    }

    const individualRows = [...individualMap.values()];
    const workforceRows = [...wfMap.values()];
    const matrixRows = [...individualRows, ...workforceRows];
    allMatrixRows.push(...matrixRows);
    sections.push({
      shift,
      individualRows,
      workforceRows,
      matrixRows,
    });
  }

  summary.totalWorkers = allMatrixRows.length;

  return {
    meta: {
      from,
      to,
      year,
      month,
      daysInMonth,
      dayKeys,
      shift: shiftFilter || 'all',
      sections: sections.map((s) => s.shift),
    },
    summary,
    columns: ['name', 'labourType', 'contractorName', 'recordKind', 'shift', ...dayKeys, 'workedDays'],
    matrixRows: allMatrixRows,
    sections,
    rows: allMatrixRows,
  };
}

async function buildProjectSummaryReport(
  db: any,
  companyId: string,
  projectId: string,
  query: ReportQuery,
) {
  const from = normalizeDate(String(query.from || query.date || ''));
  const to = normalizeDate(String(query.to || query.date || from));
  assertRange(from, to);

  const { subjects: eligibleCompany, assignmentMode } = await listEligibleCompanyLabour(
    db,
    companyId,
    projectId,
  );

  const namedWorkers = await db
    .collection('contractor_labours')
    .countDocuments(
      andFilters(companyFilter(companyId), projectFilter(projectId), {
        isActive: { $ne: false },
      }),
    );

  const wfDocs = await db
    .collection('contractor_workforce')
    .find(andFilters(companyFilter(companyId), projectFilter(projectId)))
    .toArray();
  let currentWorkforceHeadcount = 0;
  for (const doc of wfDocs) {
    for (const r of doc.rows || []) currentWorkforceHeadcount += Number(r.count) || 0;
  }

  const sessions = await loadSessionsRaw(db, companyId, projectId, {
    from,
    to,
    shift: query.shift,
    sources: null,
    contractorId: query.contractorId,
  });
  const { rows, summary } = await flattenSessions(db, sessions, {
    labourType: query.labourType,
    status: query.status,
  });

  let recordedEligibleSum = 0;
  for (const r of rows) {
    if (r.recordKind === 'workforce_aggregate') recordedEligibleSum += Number(r.eligibleCount) || 0;
  }

  const dayCount = daysBetween(from, to);
  const shifts = query.shift && isValidShift(query.shift) ? 1 : 2;
  const expectedSlots = dayCount * shifts;
  const sessionDates = new Set(sessions.map((s: any) => `${s.date}|${s.shift}`));
  const missingSlots = Math.max(0, expectedSlots - sessionDates.size);

  const uniqueIndividuals = new Set(
    rows
      .filter((r) => r.recordKind === 'individual' && r.subjectId)
      .map((r) => `${r.source}|${r.subjectId}`),
  );

  return {
    meta: { from, to, shift: query.shift || 'all' },
    summary: {
      ...summary,
      eligibleCompanyLabour: eligibleCompany.length,
      companyLabourAssignmentMode: assignmentMode,
      namedContractorWorkers: namedWorkers,
      currentWorkforceConfigHeadcount: currentWorkforceHeadcount,
      recordedWorkforceEligibleSum: recordedEligibleSum,
      uniqueIndividualsRecorded: uniqueIndividuals.size,
      expectedShiftSlots: expectedSlots,
      recordedShiftSlots: sessionDates.size,
      missingShiftSlots: missingSlots,
    },
    metrics: [
      {
        key: 'eligibleCompanyLabour',
        label: 'Eligible Company Labour (people)',
        value: eligibleCompany.length,
        note: assignmentMode === 'assigned' ? 'Project assignments' : 'All company labour',
      },
      {
        key: 'namedContractorWorkers',
        label: 'Named contractor workers (active roster)',
        value: namedWorkers,
      },
      {
        key: 'currentWorkforceConfigHeadcount',
        label: 'Current workforce config headcount (not unique people)',
        value: currentWorkforceHeadcount,
      },
      {
        key: 'recordedWorkforceEligibleSum',
        label: 'Recorded session eligible headcount sum (not unique people)',
        value: recordedEligibleSum,
      },
      {
        key: 'uniqueIndividualsRecorded',
        label: 'Unique individuals with recorded attendance',
        value: uniqueIndividuals.size,
      },
      { key: 'sessions', label: 'Attendance sessions', value: summary.sessions },
      { key: 'workedDays', label: 'Worked person-days (recorded)', value: summary.workedDays },
      { key: 'missingShiftSlots', label: 'Missing date×shift slots', value: missingSlots },
    ],
    columns: ['date', 'shift', 'source', 'contractorName', 'name', 'labourType', 'recordKind', 'status', 'workedDays'],
    rows,
  };
}

async function buildIndividualHistoryReport(
  db: any,
  companyId: string,
  projectId: string,
  query: ReportQuery,
) {
  const subjectId = String(query.subjectId || '');
  const subjectType = String(query.subjectType || '');
  if (!subjectId) fail(400, 'subjectId is required');
  if (subjectType !== 'company_labour' && subjectType !== 'contractor_labour') {
    fail(400, 'subjectType must be company_labour or contractor_labour');
  }

  const from = normalizeDate(String(query.from || query.date || ''));
  const to = normalizeDate(String(query.to || query.date || from));
  assertRange(from, to);

  const oid = toObjectId(subjectId);
  const subjectFilter = oid
    ? { $or: [{ subjectId: oid }, { subjectId }] }
    : { subjectId };

  const lines = await db
    .collection(COL_LINES)
    .find(
      andFilters(
        companyFilter(companyId),
        projectFilter(projectId),
        subjectFilter,
        { subjectType },
      ),
    )
    .toArray();

  const sessionIds = [...new Set(lines.map((l: any) => String(l.sessionId)))].map((id) => {
    const o = toObjectId(id);
    return o || id;
  });

  const sessions =
    sessionIds.length === 0
      ? []
      : await db
          .collection(COL_SESSIONS)
          .find(
            andFilters(
              companyFilter(companyId),
              projectFilter(projectId),
              {
                _id: { $in: sessionIds.filter((x) => x instanceof ObjectId) as ObjectId[] },
                isVoided: { $ne: true },
                date: { $gte: from, $lte: to },
              },
              query.shift && isValidShift(query.shift) ? { shift: query.shift } : {},
            ),
          )
          .toArray();

  // Also match string session ids if any
  const sessionById = new Map<string, any>(sessions.map((s: any) => [String(s._id), s]));
  if (sessions.length < sessionIds.length) {
    const missing = sessionIds.filter((id) => !(id instanceof ObjectId));
    if (missing.length) {
      const more = await db
        .collection(COL_SESSIONS)
        .find({
          _id: { $in: missing },
          isVoided: { $ne: true },
          date: { $gte: from, $lte: to },
        })
        .toArray();
      for (const s of more) sessionById.set(String(s._id), s);
    }
  }

  const summary = emptySummary();
  const rows: DetailRow[] = [];
  let workerName = '';
  let labourType = '';
  let contractorName: string | null = null;
  let contractorId: string | null = null;

  for (const l of lines) {
    const session = sessionById.get(String(l.sessionId));
    if (!session) continue;
    if (query.status && isValidStatus(query.status) && l.status !== query.status) continue;
    workerName = l.nameSnapshot || workerName;
    labourType = l.labourTypeSnapshot || labourType;
    contractorName = l.contractorNameSnapshot || contractorName;
    if (l.contractorIdSnapshot) contractorId = String(l.contractorIdSnapshot);

    const worked =
      l.workedDays != null ? Number(l.workedDays) : workedDaysForStatus(l.status);
    const row: DetailRow = {
      date: session.date,
      shift: session.shift,
      source: session.source,
      contractorId: session.contractorId ? String(session.contractorId) : contractorId,
      contractorName,
      subjectId: String(l.subjectId),
      name: l.nameSnapshot || null,
      labourType: l.labourTypeSnapshot || null,
      status: l.status,
      statusCode: STATUS_CODES[l.status] || '—',
      workedDays: worked,
      remark: l.remark || '',
      recordKind: 'individual',
      sessionId: String(session._id),
    };
    rows.push(row);
    addIndividualToSummary(summary, l.status, worked);
  }

  rows.sort((a, b) => (a.date + a.shift).localeCompare(b.date + b.shift));
  summary.sessions = new Set(rows.map((r) => r.sessionId)).size;

  // Enrich live profile
  if (subjectType === 'company_labour') {
    const labour = await db
      .collection('labours')
      .findOne(andFilters(idQuery(subjectId), companyFilter(companyId)));
    if (labour) {
      workerName = labour.name || workerName;
      labourType = labour.labourType || labourType;
    }
  } else {
    const worker = await db
      .collection('contractor_labours')
      .findOne(
        andFilters(idQuery(subjectId), companyFilter(companyId), projectFilter(projectId)),
      );
    if (worker) {
      workerName = worker.name || workerName;
      labourType = worker.labourType || labourType;
      if (worker.contractorId) contractorId = String(worker.contractorId);
    }
  }

  return {
    meta: {
      from,
      to,
      shift: query.shift || 'all',
      subjectId,
      subjectType,
      workerName,
      labourType,
      contractorId,
      contractorName,
    },
    summary,
    columns: ['date', 'shift', 'source', 'status', 'statusCode', 'workedDays', 'remark'],
    rows,
  };
}

/** Contractor rollup for Excel extra sheet */
export function buildContractorSummaryFromRows(rows: DetailRow[]) {
  const map = new Map<string, any>();
  for (const r of rows) {
    const key = r.contractorId || (r.source === 'company_labour' ? '__company__' : '__unknown__');
    if (!map.has(key)) {
      map.set(key, {
        contractorId: r.contractorId,
        contractorName:
          r.source === 'company_labour' ? 'Company Labour' : r.contractorName || '—',
        present: 0,
        halfDay: 0,
        absent: 0,
        leave: 0,
        weeklyOff: 0,
        holiday: 0,
        workedDays: 0,
        individualRows: 0,
        workforceRows: 0,
      });
    }
    const agg = map.get(key)!;
    if (r.recordKind === 'individual') {
      addIndividualToSummary(agg, r.status || '', r.workedDays);
    } else {
      addWorkforceToSummary(agg, r);
    }
  }
  return [...map.values()];
}
