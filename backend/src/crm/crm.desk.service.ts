import { ObjectId } from 'mongodb';
import { extractProjectId, resolveUserAndCompany } from '../projects/project-access';
import { resolveCanonicalProjectId } from '../projects/module-project-adapter';
import {
  checkDuplicateCustomer,
  generateBusinessReference,
  normalizeEmail,
  normalizePhone,
} from './crm.reservation.service';

export const CLOSED_LEAD_STAGES = ['Lost', 'Booked'];

export const LEAD_STAGES = [
  'New', 'Contacted', 'Qualified', 'Visit Scheduled', 'Visited',
  'Negotiation', 'Booked', 'Lost', 'On Hold',
];

const STAGE_RANK: Record<string, number> = {
  New: 1, Contacted: 2, Qualified: 3, 'On Hold': 3,
  'Visit Scheduled': 4, Visited: 5, Negotiation: 6, Booked: 9, Lost: 9,
};

export const DEFAULT_MESSAGE_TEMPLATES = [
  {
    id: 'followup-2',
    name: 'Follow-up 2 — Add value',
    body: 'Hi {{name}}, we have a few good options for {{interest}} at {{project}} that I think you will like. Shall I send them over?',
  },
  {
    id: 'first-hello',
    name: 'First hello',
    body: 'Hi {{name}}, this is a quick note from {{project}}. Is this a good time to talk about {{interest}}?',
  },
  {
    id: 'site-visit',
    name: 'Site visit',
    body: 'Hi {{name}}, shall we lock a site visit at {{project}} this week?',
  },
];

const FOLLOW_UP_OUTCOMES = ['no_reply', 'replied', 'not_interested', 'deal_won'] as const;
export type FollowUpOutcome = (typeof FOLLOW_UP_OUTCOMES)[number];

let phoneIndexReady: Promise<void> | null = null;

export function ensureCrmPhoneIndex(db: any): Promise<void> {
  if (phoneIndexReady) return phoneIndexReady;
  const pending: Promise<void> = db.collection('crm_customers').createIndex(
    { companyId: 1, phoneKey: 1 },
    {
      unique: true,
      name: 'crm_customer_phone_key',
      partialFilterExpression: { phoneKey: { $exists: true, $type: 'string' } },
    },
  ).then(() => undefined).catch((err: any) => {
    console.warn('crm phoneKey index skipped:', err?.message || err);
  });
  phoneIndexReady = pending;
  return pending;
}

export function companyIdForInsert(companyId: any) {
  const s = String(companyId || '');
  if (ObjectId.isValid(s) && s.length === 24) return new ObjectId(s);
  return companyId;
}

export function companyQuery(companyId: any) {
  const s = String(companyId || '');
  if (ObjectId.isValid(s) && s.length === 24) return { $in: [new ObjectId(s), s] };
  return companyId;
}

export function idVariants(id: any): any[] {
  const s = String(id || '');
  if (!s) return [];
  const out: any[] = [s];
  if (ObjectId.isValid(s) && s.length === 24) out.push(new ObjectId(s));
  return out;
}

export function phoneForStorage(phone: string): { phone: string; phoneKey: string } {
  const phoneKey = normalizePhone(phone);
  if (!phoneKey) return { phone: '', phoneKey: '' };
  const digits = phoneKey.length === 10 ? `91${phoneKey}` : phoneKey;
  return { phone: `+${digits}`, phoneKey };
}

export function whatsAppUrl(phone: string, text: string): string {
  const key = normalizePhone(phone);
  const digits = key.length === 10 ? `91${key}` : key;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text || '')}`;
}

export function fillTemplate(body: string, lead: any, projectName?: string): string {
  return String(body || '')
    .replaceAll('{{name}}', lead?.customerName || lead?.fullName || '')
    .replaceAll('{{project}}', projectName || lead?.projectName || '')
    .replaceAll('{{interest}}', lead?.requirement || lead?.unitCode || 'your requirement');
}

export function isValidTimeZone(timeZone?: string): boolean {
  if (!timeZone) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function zonedDateTimeToUtc(dayKey: string, time: string, timeZone: string): Date {
  const utcGuess = new Date(`${dayKey}T${time}Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(utcGuess)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return new Date(utcGuess.getTime() - (asUtc - utcGuess.getTime()));
}

export function zonedDayWindow(now: Date, timeZone: string) {
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const start = zonedDateTimeToUtc(dayKey, '00:00:00', timeZone);
  const next = zonedDateTimeToUtc(addDays(dayKey, 1), '00:00:00', timeZone);
  const weekEnd = zonedDateTimeToUtc(addDays(dayKey, 8), '00:00:00', timeZone);
  return { dayKey, start, end: new Date(next.getTime() - 1), next, weekEnd, timeZone };
}

export function parseDueInput(value: any, timeZone: string): Date | null {
  return parseWallClock(value, timeZone);
}

/** A date or datetime-local value is a wall clock in the project timezone, not the server clock. */
export function parseWallClock(value: any, timeZone: string): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  const wall = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (wall) {
    const time = wall[2] ? `${wall[2]}:${wall[3]}:${wall[4] || '00'}` : '09:00:00';
    return zonedDateTimeToUtc(wall[1], time, timeZone || 'Asia/Kolkata');
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    return row;
  });
}

export function rowToLeadInput(row: Record<string, string>) {
  const pick = (...keys: string[]) => keys.map((k) => row[k]).find(Boolean) || '';
  return {
    fullName: pick('name', 'full name', 'fullname', 'customer'),
    phone: pick('phone', 'whatsapp', 'whatsapp number', 'mobile', 'phone number'),
    email: pick('email', 'e-mail'),
    leadSource: pick('source', 'lead source') || 'CSV Import',
    stage: pick('stage') || 'New',
    requirement: pick('interested in', 'interest', 'requirement', 'configuration'),
    budget: pick('deal value', 'budget', 'value'),
    notes: pick('notes', 'note'),
    nextFollowUpDate: pick('next follow-up', 'next follow up', 'follow up', 'follow-up'),
    tags: pick('tags', 'tag'),
  };
}

function httpError(status: number, message: string, code?: string) {
  const err: any = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

async function runTxn(db: any, fn: (session: any | null) => Promise<any>) {
  const client = db.client;
  if (!client?.startSession) return fn(null);
  const session = client.startSession();
  try {
    let out: any;
    await session.withTransaction(async () => { out = await fn(session); });
    return out;
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (err?.code === 20 || err?.codeName === 'IllegalOperation' || msg.includes('Transaction numbers') || msg.includes('replica set')) {
      return fn(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function resolveTimeZone(db: any, companyId: any, project: any): Promise<string> {
  if (isValidTimeZone(project?.timezone)) return project.timezone;
  if (isValidTimeZone(project?.timeZone)) return project.timeZone;
  try {
    const company = await db.collection('companies').findOne({ $or: idVariants(companyId).map((id) => ({ _id: id })) });
    if (isValidTimeZone(company?.timezone)) return company.timezone;
    if (isValidTimeZone(company?.timeZone)) return company.timeZone;
  } catch { /* company id may be a non-ObjectId legacy token */ }
  const settings = await db.collection('crm_settings').findOne({ companyId: companyQuery(companyId) });
  if (isValidTimeZone(settings?.timezone)) return settings.timezone;
  return 'Asia/Kolkata';
}

export async function loadProjectScope(db: any, req: any, explicitId?: string) {
  const ctx = await resolveUserAndCompany(req, db);
  const raw = explicitId || extractProjectId(req);
  if (!raw) throw httpError(400, 'Choose a project first.', 'PROJECT_REQUIRED');
  const { projectId, project } = await resolveCanonicalProjectId(db, ctx, String(raw));
  const projectIds = idVariants(projectId);
  const legacy = await db.collection('crm_projects').find({
    companyId: companyQuery(ctx.companyId),
    orgProjectId: { $in: projectIds },
  }).project({ _id: 1 }).toArray();
  for (const row of legacy) {
    if (!projectIds.some((id) => String(id) === String(row._id))) projectIds.push(row._id);
  }
  return {
    ctx,
    project,
    projectId,
    projectIds,
    companyId: companyIdForInsert(ctx.companyId),
    companyMatch: companyQuery(ctx.companyId),
    timeZone: await resolveTimeZone(db, ctx.companyId, project),
  };
}

function actor(req: any) {
  return { performedBy: req.user?.sub || 'system', performedByName: req.user?.name || 'Sales Team' };
}

function leadView(lead: any, projectName?: string) {
  return {
    ...lead,
    whatsAppUrl: whatsAppUrl(lead?.customerPhone || '', fillTemplate(DEFAULT_MESSAGE_TEMPLATES[0].body, lead, projectName)),
  };
}

async function findCustomerByPhone(db: any, scope: any, phone: string, email: string | undefined, session: any) {
  const dup = await checkDuplicateCustomer(db, scope.companyId, phone, email);
  if (dup.isDuplicate && dup.matches[0]) return dup.matches[0];
  const phoneKey = normalizePhone(phone);
  if (!phoneKey) return null;
  const opts = session ? { session } : {};
  const byKey = await db.collection('crm_customers').findOne({ companyId: scope.companyMatch, phoneKey }, opts);
  if (byKey) return byKey;
  const all = await db.collection('crm_customers').find({ companyId: scope.companyMatch }, opts).toArray();
  return all.find((c: any) => normalizePhone(c.phone) === phoneKey || normalizePhone(c.altPhone || '') === phoneKey) || null;
}

async function insertLead(db: any, req: any, scope: any, body: any, stored: { phone: string; phoneKey: string }, stage: string, session: any) {
  const opts = session ? { session } : {};
  const email = body.email ? normalizeEmail(body.email) : '';
  let customer = await findCustomerByPhone(db, scope, body.phone || stored.phone, email, session);
  let createdCustomer = false;

  if (!customer) {
    const customerCode = await generateBusinessReference(db, scope.companyId, 'crm_customers', 'CUST', 'customerCode');
    const doc: any = {
      companyId: scope.companyId,
      customerCode,
      fullName: String(body.fullName).trim(),
      phone: stored.phone,
      phoneKey: stored.phoneKey,
      altPhone: '',
      email,
      preferredContactMethod: 'WhatsApp',
      leadSource: body.leadSource || 'Direct Call',
      budgetMin: 0,
      budgetMax: Number(body.budget) || 0,
      preferredPropertyType: body.requirement || '',
      assignedSalespersonId: req.user?.sub || '',
      assignedSalespersonName: req.user?.name || 'Sales Team',
      notes: body.notes || '',
      communicationConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user?.sub || 'system',
    };
    try {
      const result = await db.collection('crm_customers').insertOne(doc, opts);
      customer = { _id: result.insertedId, ...doc };
      createdCustomer = true;
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      customer = await findCustomerByPhone(db, scope, stored.phone, email, session);
      if (!customer) throw err;
    }
  } else if (!customer.phoneKey && stored.phoneKey) {
    await db.collection('crm_customers').updateOne(
      { _id: customer._id },
      { $set: { phoneKey: stored.phoneKey, updatedAt: new Date() } },
      opts,
    ).catch((err: any) => { if (err?.code !== 11000) throw err; });
  }

  const open = await db.collection('crm_unit_interests').findOne({
    companyId: scope.companyMatch,
    customerId: customer._id,
    projectId: { $in: scope.projectIds },
    stage: { $nin: CLOSED_LEAD_STAGES },
  }, opts);

  if (open) return { reused: true, createdCustomer, customer, lead: leadView(open, scope.project?.name) };

  const tags = Array.isArray(body.tags)
    ? body.tags
    : String(body.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
  const interest: any = {
    companyId: scope.companyId,
    customerId: customer._id,
    customerName: customer.fullName,
    customerPhone: customer.phone,
    projectId: ObjectId.isValid(String(scope.projectId)) ? new ObjectId(String(scope.projectId)) : scope.projectId,
    projectName: scope.project?.name || '',
    unitId: null,
    unitCode: '',
    requirement: body.requirement || '',
    stage,
    assignedSalespersonId: req.user?.sub || '',
    assignedSalespersonName: req.user?.name || 'Sales Team',
    leadSource: body.leadSource || customer.leadSource || 'Direct Call',
    budget: Number(body.budget) || 0,
    priority: body.priority || 'Medium',
    tags,
    notes: body.notes || '',
    lastContactDate: new Date(),
    nextFollowUpDate: parseDueInput(body.nextFollowUpDate, scope.timeZone),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const inserted = await db.collection('crm_unit_interests').insertOne(interest, opts);
  const lead = { _id: inserted.insertedId, ...interest };
  await db.collection('crm_activities').insertOne({
    companyId: scope.companyId,
    customerId: customer._id,
    unitInterestId: lead._id,
    activityType: 'Note',
    title: createdCustomer ? 'Lead created' : 'Lead added for existing customer',
    description: `${customer.fullName} · ${scope.project?.name || 'Project'}${interest.requirement ? ` · ${interest.requirement}` : ''}`,
    ...actor(req),
    createdAt: new Date(),
  }, opts);
  return { reused: false, createdCustomer, customer, lead: leadView(lead, scope.project?.name) };
}

export async function createLead(db: any, req: any, body: any) {
  await ensureCrmPhoneIndex(db);
  const scope = await loadProjectScope(db, req, body?.projectId);
  const stored = phoneForStorage(body?.phone || body?.whatsapp || '');
  if (!String(body?.fullName || '').trim() || !stored.phoneKey) throw httpError(400, 'Name and WhatsApp number are required.');
  if (stored.phoneKey.length < 8) throw httpError(400, 'Enter a valid WhatsApp number.');
  const stage = LEAD_STAGES.includes(body?.stage) ? body.stage : 'New';
  return runTxn(db, (session) => insertLead(db, req, scope, body, stored, stage, session));
}

export async function importLeads(db: any, req: any, body: any) {
  const rows = Array.isArray(body?.rows) && body.rows.length
    ? body.rows.map((r: any) => rowToLeadInput(r))
    : parseCsv(body?.csv || '').map(rowToLeadInput);
  if (!rows.length) throw httpError(400, 'The CSV needs a header row and at least one lead.');
  if (rows.length > 500) throw httpError(400, 'Import up to 500 rows at a time.');
  const created: any[] = [];
  const reused: any[] = [];
  const failed: { row: number; message: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.fullName && !row.phone) continue;
    try {
      const result = await createLead(db, req, { ...row, projectId: body?.projectId });
      if (result.reused) reused.push(result.lead);
      else created.push(result.lead);
    } catch (err: any) {
      failed.push({ row: i + 2, message: err.message || 'Could not import row' });
    }
  }
  return { created: created.length, reused: reused.length, failed, leads: created };
}

function inIdList(value: any, ids: any[]) {
  return ids.some((id) => String(id) === String(value));
}

async function projectLeads(db: any, scope: any) {
  return db.collection('crm_unit_interests').find({
    companyId: scope.companyMatch,
    projectId: { $in: scope.projectIds },
  }).toArray();
}

export function taskInProject(task: any, leads: any[], projectIds: any[]) {
  if (task.projectId && inIdList(task.projectId, projectIds)) return true;
  if (task.unitInterestId && leads.some((l) => String(l._id) === String(task.unitInterestId))) return true;
  // ponytail: a task with no project and no lead is shown when that customer already has a lead here
  if (!task.projectId && !task.unitInterestId && leads.some((l) => String(l.customerId) === String(task.customerId))) return true;
  return false;
}

function dueTime(value: any): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export async function buildToday(db: any, req: any, projectId?: string) {
  const scope = await loadProjectScope(db, req, projectId);
  const window = zonedDayWindow(new Date(), scope.timeZone);
  const leads = await projectLeads(db, scope);
  const openLeads = leads.filter((l: any) => !CLOSED_LEAD_STAGES.includes(l.stage));
  const tasks = (await db.collection('crm_follow_ups').find({ companyId: scope.companyMatch }).toArray())
    .filter((t: any) => taskInProject(t, leads, scope.projectIds));
  const visits = (await db.collection('crm_site_visits').find({ companyId: scope.companyMatch }).toArray())
    .filter((v: any) => inIdList(v.projectId, scope.projectIds)
      || leads.some((l: any) => String(l._id) === String(v.unitInterestId)));
  const bookings = await db.collection('crm_bookings').find({
    companyId: scope.companyMatch,
    projectId: { $in: scope.projectIds },
    status: { $ne: 'Cancelled' },
  }).toArray();
  const bookingIds = bookings.map((b: any) => b._id);
  const schedules = bookingIds.length
    ? await db.collection('crm_payment_schedules').find({ companyId: scope.companyMatch, bookingId: { $in: bookingIds } }).toArray()
    : [];

  const overdue: any[] = [];
  const dueToday: any[] = [];
  const upcoming: any[] = [];
  const unscheduled: any[] = [];
  for (const lead of openLeads) {
    const t = dueTime(lead.nextFollowUpDate);
    const view = leadView(lead, scope.project?.name);
    if (t == null) unscheduled.push(view);
    else if (t < window.start.getTime()) overdue.push(view);
    else if (t <= window.end.getTime()) dueToday.push(view);
    else if (t < window.weekEnd.getTime()) upcoming.push(view);
  }
  const byDue = (a: any, b: any) => (dueTime(a.nextFollowUpDate) || 0) - (dueTime(b.nextFollowUpDate) || 0);
  overdue.sort(byDue); dueToday.sort(byDue); upcoming.sort(byDue);

  const openTasks = tasks.filter((t: any) => t.status !== 'Completed' && t.status !== 'Cancelled');
  const tasksToday = openTasks.filter((t: any) => {
    const tms = dueTime(t.dueDateTime);
    return tms != null && tms >= window.start.getTime() && tms <= window.end.getTime();
  });
  const appointmentsToday = visits.filter((v: any) => {
    if (v.status === 'Cancelled') return false;
    const tms = dueTime(v.visitDateTime);
    return tms != null && tms >= window.start.getTime() && tms <= window.end.getTime();
  });
  const doneTasks = tasks.filter((t: any) => {
    const tms = dueTime(t.completedAt);
    return t.status === 'Completed' && tms != null && tms >= window.start.getTime() && tms <= window.end.getTime();
  });
  const leadIds = leads.map((l: any) => l._id);
  const activitiesToday = leadIds.length
    ? await db.collection('crm_activities').find({
      companyId: scope.companyMatch,
      unitInterestId: { $in: leadIds },
      createdAt: { $gte: window.start, $lte: window.end },
    }).toArray()
    : [];

  const paymentsDue = schedules
    .filter((s: any) => s.status !== 'Paid' && s.status !== 'Refunded')
    .map((s: any) => {
      const booking = bookings.find((b: any) => String(b._id) === String(s.bookingId));
      const t = dueTime(s.dueDate);
      return {
        ...s,
        customerName: booking?.customerName || '',
        unitCode: booking?.unitCode || '',
        isOverdue: t != null && t < window.start.getTime(),
        isDueToday: t != null && t >= window.start.getTime() && t <= window.end.getTime(),
      };
    })
    .filter((s: any) => s.isOverdue || s.isDueToday)
    .sort((a: any, b: any) => (dueTime(a.dueDate) || 0) - (dueTime(b.dueDate) || 0));

  const settings = await db.collection('crm_settings').findOne({ companyId: scope.companyMatch });
  return {
    projectId: scope.projectId,
    projectName: scope.project?.name || '',
    timeZone: scope.timeZone,
    dayKey: window.dayKey,
    counts: {
      totalLeads: leads.length,
      followUpsDue: overdue.length + dueToday.length,
      siteVisits: visits.filter((v: any) => v.status !== 'Cancelled').length,
      overdueFollowUps: overdue.length,
      openTasks: openTasks.length,
      appointmentsToday: appointmentsToday.length,
      doneToday: doneTasks.length + activitiesToday.length,
    },
    appointmentsToday,
    tasksToday,
    paymentsDue,
    overdue,
    dueToday,
    upcoming,
    unscheduled,
    messageTemplates: settings?.messageTemplates?.length ? settings.messageTemplates : DEFAULT_MESSAGE_TEMPLATES,
    queue: [...overdue, ...dueToday],
  };
}

export async function buildCalendar(db: any, req: any, query: any) {
  const scope = await loadProjectScope(db, req, query?.projectId);
  const window = zonedDayWindow(new Date(), scope.timeZone);
  const monthStartKey = /^\d{4}-\d{2}-\d{2}$/.test(String(query?.from || ''))
    ? String(query.from)
    : `${window.dayKey.slice(0, 8)}01`;
  const monthEndKey = /^\d{4}-\d{2}-\d{2}$/.test(String(query?.to || ''))
    ? String(query.to)
    : addDays(`${addDays(monthStartKey, 32).slice(0, 8)}01`, -1);
  const from = zonedDateTimeToUtc(monthStartKey, '00:00:00', scope.timeZone);
  const to = zonedDateTimeToUtc(addDays(monthEndKey, 1), '00:00:00', scope.timeZone);
  const leads = await projectLeads(db, scope);
  const visits = (await db.collection('crm_site_visits').find({ companyId: scope.companyMatch }).toArray())
    .filter((v: any) => inIdList(v.projectId, scope.projectIds)
      || leads.some((l: any) => String(l._id) === String(v.unitInterestId)));
  const tasks = (await db.collection('crm_follow_ups').find({ companyId: scope.companyMatch }).toArray())
    .filter((t: any) => taskInProject(t, leads, scope.projectIds));
  const bookings = await db.collection('crm_bookings').find({
    companyId: scope.companyMatch, projectId: { $in: scope.projectIds }, status: { $ne: 'Cancelled' },
  }).toArray();
  const bookingIds = bookings.map((b: any) => b._id);
  const schedules = bookingIds.length
    ? await db.collection('crm_payment_schedules').find({ companyId: scope.companyMatch, bookingId: { $in: bookingIds } }).toArray()
    : [];
  const inRange = (value: any) => {
    const t = dueTime(value);
    return t != null && t >= from.getTime() && t < to.getTime();
  };
  const events = [
    ...leads.filter((l: any) => !CLOSED_LEAD_STAGES.includes(l.stage) && inRange(l.nextFollowUpDate)).map((l: any) => ({
      type: 'followup',
      at: l.nextFollowUpDate,
      title: l.customerName || 'Follow-up',
      detail: [l.stage, l.requirement].filter(Boolean).join(' · '),
      status: l.stage,
      id: `follow-${l._id}`,
      leadId: l._id,
    })),
    ...visits.filter((v: any) => v.status !== 'Cancelled' && inRange(v.visitDateTime)).map((v: any) => ({
      type: 'visit', at: v.visitDateTime, title: v.customerName || 'Site visit', detail: v.notes || v.status, status: v.status, id: `visit-${v._id}`, leadId: v.unitInterestId || null,
    })),
    ...tasks.filter((t: any) => t.status !== 'Cancelled' && inRange(t.dueDateTime)).map((t: any) => ({
      type: 'task', at: t.dueDateTime, title: t.title, detail: t.customerName || '', status: t.status, id: `task-${t._id}`, leadId: t.unitInterestId || null,
    })),
    ...schedules.filter((s: any) => inRange(s.dueDate) && s.status !== 'Paid' && s.status !== 'Refunded').map((s: any) => {
      const booking = bookings.find((b: any) => String(b._id) === String(s.bookingId));
      return {
        type: 'payment',
        at: s.dueDate,
        title: booking?.customerName || 'Payment due',
        detail: s.milestoneName || 'Payment due',
        status: s.status,
        id: `pay-${s._id}`,
      };
    }),
  ];
  const settings = await db.collection('crm_settings').findOne({ companyId: scope.companyMatch });
  return {
    projectId: scope.projectId,
    projectName: scope.project?.name || '',
    timeZone: scope.timeZone,
    from: monthStartKey,
    to: monthEndKey,
    events,
    messageTemplates: settings?.messageTemplates?.length ? settings.messageTemplates : DEFAULT_MESSAGE_TEMPLATES,
  };
}

export async function logFollowUp(db: any, req: any, leadId: string, body: any) {
  const outcome = body?.outcome as FollowUpOutcome;
  if (!FOLLOW_UP_OUTCOMES.includes(outcome)) throw httpError(400, 'Choose a follow-up result.');
  const scope = await loadProjectScope(db, req, body?.projectId);
  const variants = idVariants(leadId);
  const lead = await db.collection('crm_unit_interests').findOne({
    _id: variants.length > 1 ? { $in: variants } : leadId,
    companyId: scope.companyMatch,
    projectId: { $in: scope.projectIds },
  });
  if (!lead) throw httpError(404, 'Lead not found on this project.');
  if (lead.stage === 'Lost' || lead.stage === 'Booked') throw httpError(409, 'This lead is already closed.');

  const window = zonedDayWindow(new Date(), scope.timeZone);
  let nextStage = lead.stage;
  let nextDate: Date | null = lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate) : null;
  let handoff: string | null = null;

  if (outcome === 'no_reply' || outcome === 'replied') {
    if ((STAGE_RANK[lead.stage] || 1) < STAGE_RANK.Contacted) nextStage = 'Contacted';
    const fallbackDay = addDays(window.dayKey, outcome === 'no_reply' ? 3 : 1);
    nextDate = body?.nextFollowUpDate ? parseDueInput(body.nextFollowUpDate, scope.timeZone) : zonedDateTimeToUtc(fallbackDay, '09:00:00', scope.timeZone);
  } else if (outcome === 'not_interested') {
    nextStage = 'Lost';
    nextDate = null;
  } else {
    handoff = 'booking';
    if ((STAGE_RANK[lead.stage] || 1) < STAGE_RANK.Negotiation) nextStage = 'Negotiation';
  }

  const titles: Record<FollowUpOutcome, string> = {
    no_reply: 'No reply yet', replied: 'They replied', not_interested: 'Not interested', deal_won: 'Deal won',
  };
  await runTxn(db, async (session) => {
    const opts = session ? { session } : {};
    const update: any = { stage: nextStage, lastContactDate: new Date(), updatedAt: new Date(), nextFollowUpDate: nextDate };
    if (nextStage === 'Lost') update.lostReason = body?.lostReason || 'Not interested';
    await db.collection('crm_unit_interests').updateOne({ _id: lead._id }, { $set: update }, opts);
    await db.collection('crm_activities').insertOne({
      companyId: scope.companyId,
      customerId: lead.customerId,
      unitInterestId: lead._id,
      activityType: 'WhatsApp',
      title: titles[outcome],
      description: String(body?.message || '').trim() || titles[outcome],
      metadata: { outcome, fromStage: lead.stage, toStage: nextStage },
      ...actor(req),
      createdAt: new Date(),
    }, opts);
  });

  const updated = await db.collection('crm_unit_interests').findOne({ _id: lead._id });
  const activities = await db.collection('crm_activities').find({
    companyId: scope.companyMatch, unitInterestId: lead._id,
  }).sort({ createdAt: -1 }).limit(8).toArray();
  return { lead: leadView(updated, scope.project?.name), activities, handoff, customerId: updated.customerId, projectId: scope.projectId };
}
