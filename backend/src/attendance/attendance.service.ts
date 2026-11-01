import { ObjectId } from 'mongodb';
import { loadContractorMode } from '../manpower/contractor-mode';
import {
  AttendanceShift,
  AttendanceSource,
  AttendanceStatus,
  isValidShift,
  isValidSource,
  isValidStatus,
  summarizeIndividualLines,
  summarizeWorkforceLines,
  workforceAllocatedTotal,
  workedDaysForStatus,
  workedPersonDays,
} from './attendance.calc';

export const COL_SESSIONS = 'attendance_sessions';
export const COL_LINES = 'attendance_lines';
export const COL_WF_LINES = 'attendance_workforce_lines';
export const COL_AUDIT = 'attendance_audit';
export const COL_ASSIGNMENTS = 'project_labour_assignments';

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

function labourIdFilter(labourId: string): any {
  const oid = toObjectId(labourId);
  if (oid) return { $or: [{ labourId: oid }, { labourId: String(labourId) }] };
  return { labourId: String(labourId) };
}

function fail(status: number, message: string, code?: string) {
  const err: any = new Error(message);
  err.status = status;
  if (code) err.code = code;
  throw err;
}

export function normalizeDate(input: string): string {
  const s = String(input || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(400, 'date must be YYYY-MM-DD');
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) fail(400, 'Invalid date');
  if (d.toISOString().slice(0, 10) !== s) fail(400, 'Invalid calendar date');
  return s;
}

export function normalizeShift(input: any): AttendanceShift {
  const shift = String(input || 'day').trim().toLowerCase() || 'day';
  if (!isValidShift(shift)) fail(400, 'shift must be day or night');
  return shift as AttendanceShift;
}

let indexesEnsured = false;
export async function ensureAttendanceIndexes(db: any) {
  if (indexesEnsured) return;
  try {
    // Drop legacy full unique index that blocked remaking after soft-void
    try {
      await db.collection(COL_SESSIONS).dropIndex('uniq_attendance_session_scope');
    } catch {
      /* ignore if missing */
    }
    await db.collection(COL_SESSIONS).createIndex(
      { companyId: 1, projectId: 1, date: 1, shift: 1, source: 1, contractorKey: 1 },
      {
        unique: true,
        name: 'uniq_attendance_session_scope_active',
        partialFilterExpression: { isVoided: { $ne: true } },
      },
    );
    await db.collection(COL_LINES).createIndex(
      { sessionId: 1, subjectId: 1 },
      { unique: true, name: 'uniq_attendance_line_subject' },
    );
    await db.collection(COL_LINES).createIndex(
      { companyId: 1, projectId: 1, subjectId: 1 },
      { name: 'attendance_lines_subject_lookup' },
    );
    await db.collection(COL_SESSIONS).createIndex(
      { companyId: 1, projectId: 1, date: 1, shift: 1 },
      { name: 'attendance_sessions_date_shift' },
    );
    await db.collection(COL_WF_LINES).createIndex(
      { sessionId: 1, labourTypeKey: 1 },
      { unique: true, name: 'uniq_attendance_wf_type' },
    );
    await db.collection(COL_ASSIGNMENTS).createIndex(
      { companyId: 1, projectId: 1, labourId: 1 },
      { unique: true, name: 'uniq_project_labour_assignment' },
    );
    await db.collection(COL_SESSIONS).createIndex({ companyId: 1, projectId: 1, date: 1 });
    indexesEnsured = true;
  } catch (e) {
    console.warn('Attendance index ensure:', (e as any)?.message || e);
  }
}

async function writeAudit(db: any, entry: any) {
  await db.collection(COL_AUDIT).insertOne({ ...entry, at: new Date() });
}

async function loadCompanyLaboursByIds(db: any, companyId: string, labourIds: any[]) {
  const ids = [...new Set((labourIds || []).map((id) => String(id || '')).filter(Boolean))];
  if (ids.length === 0) return new Map<string, any>();
  const orIds = ids.flatMap((id) => {
    const oid = toObjectId(id);
    return oid ? [{ _id: oid }, { _id: id }] : [{ _id: id }];
  });
  const labours = await db
    .collection('labours')
    .find(
      andFilters(companyFilter(companyId), { isActive: { $ne: false } }, { $or: orIds }),
    )
    .toArray();
  const byId = new Map<string, any>();
  for (const l of labours) byId.set(String(l._id), l);
  return byId;
}

export async function listCompanyLabours(db: any, companyId: string) {
  const labours = await db
    .collection('labours')
    .find(andFilters(companyFilter(companyId), { isActive: { $ne: false } }))
    .sort({ name: 1 })
    .toArray();
  return labours.map((labour: any) => ({
    labourId: String(labour._id),
    name: labour.name || '',
    labourType: labour.labourType || '',
    phone: labour.phone || '',
  }));
}

export async function listAssignments(db: any, companyId: string, projectId: string) {
  const rows = await db
    .collection(COL_ASSIGNMENTS)
    .find(
      andFilters(companyFilter(companyId), projectFilter(projectId), {
        isActive: { $ne: false },
      }),
    )
    .toArray();
  const byId = await loadCompanyLaboursByIds(
    db,
    companyId,
    rows.map((r: any) => r.labourId),
  );
  return rows
    .map((r: any) => {
      const labour: any = byId.get(String(r.labourId));
      if (!labour) return null;
      return {
        id: String(r._id),
        labourId: String(r.labourId),
        name: labour.name || '',
        labourType: labour.labourType || '',
        phone: labour.phone || '',
      };
    })
    .filter(Boolean);
}

/** Project-eligible company labour: assigned subset if any, else all company labour. */
export async function listEligibleCompanyLabour(db: any, companyId: string, projectId: string) {
  const assigned = await listAssignments(db, companyId, projectId);
  if (assigned.length > 0) return { subjects: assigned, assignmentMode: 'assigned' as const };
  const all = await listCompanyLabours(db, companyId);
  return { subjects: all, assignmentMode: 'all_company' as const };
}

export async function setAssignments(
  db: any,
  companyId: string,
  projectId: string,
  labourIds: string[],
  userId: string,
) {
  const uniqueIds = [...new Set((labourIds || []).map(String).filter(Boolean))];
  const valid: ObjectId[] = [];
  for (const id of uniqueIds) {
    const oid = toObjectId(id);
    if (!oid) continue;
    const labour = await db.collection('labours').findOne(
      andFilters(idQuery(id), companyFilter(companyId), { isActive: { $ne: false } }),
    );
    if (labour) valid.push(oid);
  }

  const now = new Date();
  const existing = await db
    .collection(COL_ASSIGNMENTS)
    .find(andFilters(companyFilter(companyId), projectFilter(projectId)))
    .toArray();

  const want = new Set(valid.map(String));
  for (const row of existing) {
    const lid = String(row.labourId);
    if (!want.has(lid)) {
      await db.collection(COL_ASSIGNMENTS).updateOne(
        { _id: row._id },
        { $set: { isActive: false, updatedAt: now } },
      );
    } else if (row.isActive === false) {
      await db.collection(COL_ASSIGNMENTS).updateOne(
        { _id: row._id },
        { $set: { isActive: true, updatedAt: now } },
      );
    }
    want.delete(lid);
  }

  for (const oid of valid) {
    if (!want.has(String(oid))) continue;
    await db.collection(COL_ASSIGNMENTS).updateOne(
      andFilters(companyFilter(companyId), projectFilter(projectId), labourIdFilter(String(oid))),
      {
        $set: {
          companyId: toObjectId(companyId) || companyId,
          projectId: toObjectId(projectId) || projectId,
          labourId: oid,
          isActive: true,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now, createdBy: userId },
      },
      { upsert: true },
    );
  }

  return listAssignments(db, companyId, projectId);
}

function contractorKeyOf(contractorId: string | null | undefined) {
  return contractorId ? String(contractorId) : '';
}

function sessionScopeQuery(
  companyId: string,
  projectId: string,
  date: string,
  shift: string,
  source: string,
  contractorId: string | null,
) {
  return andFilters(
    companyFilter(companyId),
    projectFilter(projectId),
    {
      date,
      shift,
      source,
      contractorKey: contractorKeyOf(contractorId),
      isVoided: { $ne: true },
    },
  );
}

export async function findSession(
  db: any,
  companyId: string,
  projectId: string,
  date: string,
  shift: string,
  source: string,
  contractorId: string | null,
) {
  return db
    .collection(COL_SESSIONS)
    .findOne(sessionScopeQuery(companyId, projectId, date, shift, source, contractorId));
}

/** Includes voided sessions so upsert can revive instead of colliding on unique index. */
async function findSessionAny(
  db: any,
  companyId: string,
  projectId: string,
  date: string,
  shift: string,
  source: string,
  contractorId: string | null,
) {
  return db.collection(COL_SESSIONS).findOne(
    andFilters(companyFilter(companyId), projectFilter(projectId), {
      date,
      shift,
      source,
      contractorKey: contractorKeyOf(contractorId),
    }),
    { sort: { updatedAt: -1, createdAt: -1 } },
  );
}

export async function getEligible(
  db: any,
  companyId: string,
  projectId: string,
  opts: { date: string; shift: string; source: string; contractorId?: string },
) {
  const date = normalizeDate(opts.date);
  const shift = normalizeShift(opts.shift);
  const source = String(opts.source || '');
  if (!isValidSource(source)) fail(400, 'Invalid source');

  if (source === 'company_labour') {
    const { subjects: eligible, assignmentMode } = await listEligibleCompanyLabour(
      db,
      companyId,
      projectId,
    );
    const session = await findSession(db, companyId, projectId, date, shift, source, null);
    let lines: any[] = [];
    if (session) {
      lines = await db
        .collection(COL_LINES)
        .find({ sessionId: session._id })
        .toArray();
    }
    const bySubject = new Map(lines.map((l: any) => [String(l.subjectId), l]));
    return {
      date,
      shift,
      source,
      mode: null,
      assignmentMode,
      session: session ? sanitizeSession(session) : null,
      subjects: eligible.map((a: any) => {
        const line = bySubject.get(String(a.labourId));
        return {
          subjectId: String(a.labourId),
          name: a.name,
          labourType: a.labourType,
          phone: a.phone,
          status: line?.status || null,
          remark: line?.remark || '',
          workedDays: line?.workedDays ?? null,
        };
      }),
    };
  }

  const contractorId = String(opts.contractorId || '');
  if (!contractorId) fail(400, 'contractorId is required');

  const { contractor, departments, mode } = await loadContractorMode(
    db,
    companyId,
    projectId,
    contractorId,
  );

  if (source === 'contractor_named') {
    if (mode !== 'named') {
      fail(400, 'This contractor uses workforce rows, not named workers');
    }
    const workers = await db
      .collection('contractor_labours')
      .find(
        andFilters(
          companyFilter(companyId),
          projectFilter(projectId),
          contractorIdFilter(contractorId),
          { isActive: { $ne: false } },
        ),
      )
      .sort({ name: 1 })
      .toArray();
    const session = await findSession(
      db,
      companyId,
      projectId,
      date,
      shift,
      source,
      contractorId,
    );
    let lines: any[] = [];
    if (session) {
      lines = await db.collection(COL_LINES).find({ sessionId: session._id }).toArray();
    }
    const bySubject = new Map(lines.map((l: any) => [String(l.subjectId), l]));
    return {
      date,
      shift,
      source,
      mode,
      departments,
      contractor: { id: String(contractor._id), name: contractor.name },
      session: session ? sanitizeSession(session) : null,
      subjects: workers.map((w: any) => {
        const id = String(w._id);
        const line = bySubject.get(id);
        return {
          subjectId: id,
          name: w.name || '',
          labourType: w.labourType || '',
          phone: w.phone || '',
          photo: w.photo || null,
          status: line?.status || null,
          remark: line?.remark || '',
          workedDays: line?.workedDays ?? null,
        };
      }),
    };
  }

  // workforce
  if (mode !== 'workforce') {
    fail(400, 'This contractor uses named workers, not workforce rows');
  }
  const workforce = await db.collection('contractor_workforce').findOne(
    andFilters(
      companyFilter(companyId),
      projectFilter(projectId),
      contractorIdFilter(contractorId),
    ),
  );
  const rows = Array.isArray(workforce?.rows) ? workforce.rows : [];
  const session = await findSession(
    db,
    companyId,
    projectId,
    date,
    shift,
    source,
    contractorId,
  );
  let wfLines: any[] = [];
  if (session) {
    wfLines = await db.collection(COL_WF_LINES).find({ sessionId: session._id }).toArray();
  }
  const byType = new Map(
    wfLines.map((l: any) => [String(l.labourTypeKey || l.labourType).toLowerCase(), l]),
  );

  return {
    date,
    shift,
    source,
    mode,
    departments,
    contractor: { id: String(contractor._id), name: contractor.name },
    session: session ? sanitizeSession(session) : null,
    workforceRows: rows.map((r: any) => {
      const key = String(r.labourType || '').toLowerCase();
      const line = byType.get(key);
      return {
        labourType: r.labourType || '',
        eligibleCount: Number(r.count) || 0,
        present: line?.present ?? null,
        halfDay: line?.halfDay ?? null,
        absent: line?.absent ?? null,
        leave: line?.leave ?? null,
        weeklyOff: line?.weeklyOff ?? null,
        holiday: line?.holiday ?? null,
        workedPersonDays: line?.workedPersonDays ?? null,
      };
    }),
  };
}

function sanitizeSession(doc: any) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    date: doc.date,
    shift: doc.shift,
    source: doc.source,
    contractorId: doc.contractorId ? String(doc.contractorId) : null,
    blockId: doc.blockId ? String(doc.blockId) : null,
    status: doc.status || 'saved',
    totals: doc.totals || null,
    isVoided: !!doc.isVoided,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function upsertSession(
  db: any,
  companyId: string,
  projectId: string,
  userId: string,
  body: any,
) {
  const date = normalizeDate(body.date);
  const shift = normalizeShift(body.shift);
  const source = String(body.source || '');
  if (!isValidSource(source)) fail(400, 'Invalid source');

  let contractorId: string | null = null;
  if (source !== 'company_labour') {
    contractorId = String(body.contractorId || '');
    if (!contractorId) fail(400, 'contractorId is required');
  }

  const now = new Date();
  // Prefer active session; otherwise revive a voided one for the same scope
  let existing = await findSession(db, companyId, projectId, date, shift, source, contractorId);
  if (!existing) {
    existing = await findSessionAny(db, companyId, projectId, date, shift, source, contractorId);
  }

  let sessionId: ObjectId;
  let isCreate = false;

  if (existing) {
    sessionId = existing._id;
    if (existing.isVoided) {
      await db.collection(COL_SESSIONS).updateOne(
        { _id: sessionId },
        {
          $set: {
            isVoided: false,
            voidedAt: null,
            updatedAt: now,
            updatedBy: userId,
            status: 'saved',
          },
        },
      );
    }
  } else {
    isCreate = true;
    const doc: any = {
      companyId: toObjectId(companyId) || companyId,
      projectId: toObjectId(projectId) || projectId,
      date,
      shift,
      source,
      contractorId: contractorId ? toObjectId(contractorId) || contractorId : null,
      contractorKey: contractorKeyOf(contractorId),
      blockId: body.blockId ? toObjectId(body.blockId) || body.blockId : null,
      status: 'saved',
      totals: {},
      isVoided: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };
    try {
      const ins = await db.collection(COL_SESSIONS).insertOne(doc);
      sessionId = ins.insertedId;
    } catch (e: any) {
      if (e?.code === 11000) {
        const raced = await findSessionAny(
          db,
          companyId,
          projectId,
          date,
          shift,
          source,
          contractorId,
        );
        if (!raced) throw e;
        sessionId = raced._id;
        isCreate = false;
        existing = raced;
        await db.collection(COL_SESSIONS).updateOne(
          { _id: sessionId },
          {
            $set: {
              isVoided: false,
              voidedAt: null,
              updatedAt: now,
              updatedBy: userId,
              status: 'saved',
            },
          },
        );
      } else {
        throw e;
      }
    }
  }

  if (source === 'contractor_workforce') {
    await upsertWorkforceLines(
      db,
      companyId,
      projectId,
      contractorId!,
      sessionId,
      body.rows || [],
      userId,
      existing,
    );
  } else {
    await upsertIndividualLines(
      db,
      companyId,
      projectId,
      source as AttendanceSource,
      contractorId,
      sessionId,
      body.lines || [],
      userId,
      existing,
    );
  }

  // recompute totals
  let totals: any;
  if (source === 'contractor_workforce') {
    const wfLines = await db.collection(COL_WF_LINES).find({ sessionId }).toArray();
    totals = summarizeWorkforceLines(wfLines);
  } else {
    const lines = await db.collection(COL_LINES).find({ sessionId }).toArray();
    totals = summarizeIndividualLines(lines);
  }

  await db.collection(COL_SESSIONS).updateOne(
    { _id: sessionId },
    {
      $set: {
        totals,
        updatedAt: now,
        updatedBy: userId,
        isVoided: false,
        voidedAt: null,
        status: 'saved',
      },
    },
  );

  await writeAudit(db, {
    sessionId,
    by: userId,
    action: isCreate ? 'SESSION_CREATED' : 'SESSION_UPDATED',
    before: existing ? { totals: existing.totals } : null,
    after: { totals, date, shift, source },
  });

  const session = await db.collection(COL_SESSIONS).findOne({ _id: sessionId });
  return getEligible(db, companyId, projectId, {
    date,
    shift,
    source,
    contractorId: contractorId || undefined,
  }).then((eligible) => ({
    ...eligible,
    session: sanitizeSession(session),
  }));
}

async function upsertIndividualLines(
  db: any,
  companyId: string,
  projectId: string,
  source: AttendanceSource,
  contractorId: string | null,
  sessionId: ObjectId,
  lines: any[],
  userId: string,
  existingSession: any,
) {
  if (!Array.isArray(lines) || lines.length === 0) {
    fail(400, 'lines array is required');
  }

  if (source === 'contractor_named') {
    if (!contractorId) fail(400, 'contractorId is required');
    const { mode } = await loadContractorMode(db, companyId, projectId, String(contractorId));
    if (mode !== 'named') {
      fail(400, 'This contractor uses workforce rows, not named workers');
    }
  }

  const subjectType = source === 'company_labour' ? 'company_labour' : 'contractor_labour';
  const seen = new Set<string>();
  const projectHasAssignments =
    subjectType === 'company_labour'
      ? !!(await db.collection(COL_ASSIGNMENTS).findOne(
          andFilters(companyFilter(companyId), projectFilter(projectId), {
            isActive: { $ne: false },
          }),
        ))
      : false;

  for (const raw of lines) {
    const subjectId = String(raw.subjectId || '');
    const status = String(raw.status || '');
    if (!subjectId) fail(400, 'subjectId is required on each line');
    if (!isValidStatus(status)) fail(400, `Invalid status: ${status}`);
    if (seen.has(subjectId)) fail(400, `Duplicate subjectId: ${subjectId}`);
    seen.add(subjectId);

    let nameSnapshot = '';
    let labourTypeSnapshot = '';
    let contractorNameSnapshot = '';

    if (subjectType === 'company_labour') {
      const labour = await db.collection('labours').findOne(
        andFilters(idQuery(subjectId), companyFilter(companyId), { isActive: { $ne: false } }),
      );
      if (!labour) fail(400, `Labour ${subjectId} not found`);
      // If this project has any active assignments, only assigned labour may be marked
      if (projectHasAssignments) {
        const assigned = await db.collection(COL_ASSIGNMENTS).findOne(
          andFilters(
            companyFilter(companyId),
            projectFilter(projectId),
            labourIdFilter(subjectId),
            { isActive: { $ne: false } },
          ),
        );
        if (!assigned) fail(400, `Labour ${subjectId} is not assigned to this project`);
      }
      nameSnapshot = labour.name || '';
      labourTypeSnapshot = labour.labourType || '';
    } else {
      if (!contractorId) fail(400, 'contractorId is required');
      const cid = String(contractorId);
      const worker = await db.collection('contractor_labours').findOne(
        andFilters(
          idQuery(subjectId),
          companyFilter(companyId),
          projectFilter(projectId),
          contractorIdFilter(cid),
          { isActive: { $ne: false } },
        ),
      );
      if (!worker) fail(400, `Worker ${subjectId} not found for contractor`);
      nameSnapshot = worker.name || '';
      labourTypeSnapshot = worker.labourType || '';
      const ctr = await db.collection('contractors').findOne(idQuery(cid));
      contractorNameSnapshot = ctr?.name || '';
    }

    const workedDays = workedDaysForStatus(status as AttendanceStatus);
    const prev = await db.collection(COL_LINES).findOne({
      sessionId,
      subjectId: { $in: [toObjectId(subjectId), subjectId].filter(Boolean) },
    });

    const lineDoc: any = {
      sessionId,
      companyId: toObjectId(companyId) || companyId,
      projectId: toObjectId(projectId) || projectId,
      subjectType,
      subjectId: toObjectId(subjectId) || subjectId,
      labourTypeSnapshot,
      nameSnapshot,
      contractorIdSnapshot: contractorId ? toObjectId(contractorId) || contractorId : null,
      contractorNameSnapshot: contractorNameSnapshot || null,
      status,
      remark: String(raw.remark || '').trim(),
      workedDays,
      updatedAt: new Date(),
    };

    if (prev) {
      await db.collection(COL_LINES).updateOne({ _id: prev._id }, { $set: lineDoc });
      if (prev.status !== status) {
        await writeAudit(db, {
          sessionId,
          lineId: prev._id,
          by: userId,
          action: 'LINE_STATUS_CHANGED',
          before: { status: prev.status, workedDays: prev.workedDays },
          after: { status, workedDays },
        });
      }
    } else {
      lineDoc.createdAt = new Date();
      const ins = await db.collection(COL_LINES).insertOne(lineDoc);
      await writeAudit(db, {
        sessionId,
        lineId: ins.insertedId,
        by: userId,
        action: 'LINE_CREATED',
        before: null,
        after: { status, workedDays, subjectId },
      });
    }
  }

  if (existingSession) {
    const existingLines = await db.collection(COL_LINES).find({ sessionId }).toArray();
    const toDelete = existingLines
      .filter((l: any) => !seen.has(String(l.subjectId)))
      .map((l: any) => l._id);
    if (toDelete.length) {
      await db.collection(COL_LINES).deleteMany({ _id: { $in: toDelete } });
    }
  }
}

async function upsertWorkforceLines(
  db: any,
  companyId: string,
  projectId: string,
  contractorId: string,
  sessionId: ObjectId,
  rows: any[],
  userId: string,
  existingSession: any,
) {
  if (!Array.isArray(rows) || rows.length === 0) fail(400, 'rows array is required');

  const { mode } = await loadContractorMode(db, companyId, projectId, contractorId);
  if (mode !== 'workforce') fail(400, 'This contractor uses named workers, not workforce rows');

  const workforce = await db.collection('contractor_workforce').findOne(
    andFilters(
      companyFilter(companyId),
      projectFilter(projectId),
      contractorIdFilter(contractorId),
    ),
  );
  const masterRows = Array.isArray(workforce?.rows) ? workforce.rows : [];
  const eligibleByType = new Map<string, { labourType: string; count: number }>(
    masterRows.map((r: any) => [
      String(r.labourType || '')
        .toLowerCase()
        .trim(),
      { labourType: r.labourType || '', count: Number(r.count) || 0 },
    ]),
  );

  const seen = new Set<string>();
  for (const raw of rows) {
    const labourType = String(raw.labourType || '').trim();
    if (!labourType) fail(400, 'labourType is required on each row');
    const key = labourType.toLowerCase();
    if (seen.has(key)) fail(400, `Duplicate labour type: ${labourType}`);
    seen.add(key);

    const master = eligibleByType.get(key);
    if (!master) fail(400, `Labour type ${labourType} is not in current workforce config`);

    const eligibleCount = master!.count;
    const counts = {
      present: Number(raw.present) || 0,
      halfDay: Number(raw.halfDay) || 0,
      absent: Number(raw.absent) || 0,
      leave: Number(raw.leave) || 0,
      weeklyOff: Number(raw.weeklyOff) || 0,
      holiday: Number(raw.holiday) || 0,
    };
    for (const [k, v] of Object.entries(counts)) {
      if (!Number.isFinite(v) || v < 0) fail(400, `Invalid ${k} count`);
    }
    const allocated = workforceAllocatedTotal(counts);
    if (allocated !== eligibleCount) {
      fail(
        400,
        `${labourType}: status counts (${allocated}) must equal eligible count (${eligibleCount})`,
      );
    }

    const wp = workedPersonDays(counts.present, counts.halfDay);
    const prev = await db.collection(COL_WF_LINES).findOne({ sessionId, labourTypeKey: key });
    const lineDoc: any = {
      sessionId,
      companyId: toObjectId(companyId) || companyId,
      projectId: toObjectId(projectId) || projectId,
      labourType,
      labourTypeKey: key,
      eligibleCount,
      ...counts,
      workedPersonDays: wp,
      updatedAt: new Date(),
    };

    if (prev) {
      await db.collection(COL_WF_LINES).updateOne({ _id: prev._id }, { $set: lineDoc });
      await writeAudit(db, {
        sessionId,
        lineId: prev._id,
        by: userId,
        action: 'WF_LINE_UPDATED',
        before: {
          present: prev.present,
          halfDay: prev.halfDay,
          absent: prev.absent,
        },
        after: counts,
      });
    } else {
      lineDoc.createdAt = new Date();
      const ins = await db.collection(COL_WF_LINES).insertOne(lineDoc);
      await writeAudit(db, {
        sessionId,
        lineId: ins.insertedId,
        by: userId,
        action: 'WF_LINE_CREATED',
        before: null,
        after: { labourType, ...counts },
      });
    }
  }

  if (existingSession) {
    await db.collection(COL_WF_LINES).deleteMany({
      sessionId,
      labourTypeKey: { $nin: [...seen] },
    });
  }
}

export async function listSessions(
  db: any,
  companyId: string,
  projectId: string,
  query: any,
) {
  const filter: any[] = [
    companyFilter(companyId),
    projectFilter(projectId),
    { isVoided: { $ne: true } },
  ];
  if (query.from || query.to) {
    const dateQ: any = {};
    if (query.from) dateQ.$gte = normalizeDate(query.from);
    if (query.to) dateQ.$lte = normalizeDate(query.to);
    filter.push({ date: dateQ });
  }
  if (query.shift && isValidShift(query.shift)) filter.push({ shift: query.shift });
  if (query.source && isValidSource(query.source)) filter.push({ source: query.source });
  if (query.contractorId) filter.push(contractorIdFilter(String(query.contractorId)));

  const rows = await db
    .collection(COL_SESSIONS)
    .find(andFilters(...filter))
    .sort({ date: -1, shift: 1 })
    .limit(Math.min(Number(query.limit) || 100, 500))
    .toArray();

  return rows.map(sanitizeSession);
}

export async function getSessionDetail(
  db: any,
  companyId: string,
  projectId: string,
  sessionId: string,
) {
  const session = await db.collection(COL_SESSIONS).findOne(
    andFilters(idQuery(sessionId), companyFilter(companyId), projectFilter(projectId)),
  );
  if (!session || session.isVoided) fail(404, 'Session not found');

  if (session.source === 'contractor_workforce') {
    const rows = await db.collection(COL_WF_LINES).find({ sessionId: session._id }).toArray();
    return {
      session: sanitizeSession(session),
      workforceRows: rows.map((r: any) => ({
        labourType: r.labourType,
        eligibleCount: r.eligibleCount,
        present: r.present,
        halfDay: r.halfDay,
        absent: r.absent,
        leave: r.leave,
        weeklyOff: r.weeklyOff,
        holiday: r.holiday,
        workedPersonDays: r.workedPersonDays,
      })),
    };
  }

  const lines = await db.collection(COL_LINES).find({ sessionId: session._id }).toArray();
  return {
    session: sanitizeSession(session),
    lines: lines.map((l: any) => ({
      id: String(l._id),
      subjectId: String(l.subjectId),
      subjectType: l.subjectType,
      name: l.nameSnapshot,
      labourType: l.labourTypeSnapshot,
      contractorName: l.contractorNameSnapshot,
      status: l.status,
      remark: l.remark || '',
      workedDays: l.workedDays,
    })),
  };
}

export async function voidSession(
  db: any,
  companyId: string,
  projectId: string,
  sessionId: string,
  userId: string,
) {
  const session = await db.collection(COL_SESSIONS).findOne(
    andFilters(idQuery(sessionId), companyFilter(companyId), projectFilter(projectId)),
  );
  if (!session || session.isVoided) fail(404, 'Session not found');
  const now = new Date();
  await db.collection(COL_SESSIONS).updateOne(
    { _id: session._id },
    { $set: { isVoided: true, voidedAt: now, updatedAt: now, updatedBy: userId } },
  );
  await writeAudit(db, {
    sessionId: session._id,
    by: userId,
    action: 'SESSION_VOIDED',
    before: { isVoided: false },
    after: { isVoided: true },
  });
  return { message: 'Attendance session voided' };
}

export async function buildReportDetail(
  db: any,
  companyId: string,
  projectId: string,
  query: any,
) {
  const sessions = await listSessions(db, companyId, projectId, {
    ...query,
    limit: 500,
  });
  const detail: any[] = [];
  const contractorNameCache = new Map<string, string | null>();
  async function contractorNameFor(cid: string | null | undefined) {
    if (!cid) return null;
    const key = String(cid);
    if (contractorNameCache.has(key)) return contractorNameCache.get(key) ?? null;
    const ctr = await db.collection('contractors').findOne(idQuery(key));
    const name = ctr?.name || null;
    contractorNameCache.set(key, name);
    return name;
  }

  for (const s of sessions) {
    const sessionContractorId = s.contractorId ? String(s.contractorId) : null;
    const sessionContractorName = await contractorNameFor(sessionContractorId);
    const full = await getSessionDetail(db, companyId, projectId, s.id);
    if (full.lines) {
      for (const line of full.lines) {
        detail.push({
          date: s.date,
          shift: s.shift,
          source: s.source,
          contractorId: sessionContractorId || line.contractorId || null,
          contractorName: line.contractorName || sessionContractorName,
          name: line.name,
          labourType: line.labourType,
          status: line.status,
          workedDays: line.workedDays,
          remark: line.remark,
          recordKind: 'individual',
        });
      }
    } else if (full.workforceRows) {
      for (const row of full.workforceRows) {
        detail.push({
          date: s.date,
          shift: s.shift,
          source: s.source,
          contractorId: sessionContractorId,
          contractorName: sessionContractorName,
          name: null,
          labourType: row.labourType,
          status: null,
          present: row.present,
          halfDay: row.halfDay,
          absent: row.absent,
          leave: row.leave,
          weeklyOff: row.weeklyOff,
          holiday: row.holiday,
          eligibleCount: row.eligibleCount,
          workedDays: row.workedPersonDays,
          recordKind: 'workforce',
        });
      }
    }
  }

  const summary = {
    sessions: sessions.length,
    present: 0,
    halfDay: 0,
    absent: 0,
    leave: 0,
    weeklyOff: 0,
    holiday: 0,
    workedDays: 0,
  };
  for (const s of sessions) {
    const t = s.totals || {};
    summary.present += t.present || 0;
    summary.halfDay += t.halfDay || 0;
    summary.absent += t.absent || 0;
    summary.leave += t.leave || 0;
    summary.weeklyOff += t.weeklyOff || 0;
    summary.holiday += t.holiday || 0;
    summary.workedDays += t.workedDays || 0;
  }

  return { summary, sessions, detail };
}
