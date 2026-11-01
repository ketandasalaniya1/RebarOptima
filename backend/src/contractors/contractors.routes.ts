import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  resolveUserAndCompany,
  assertProjectAccess,
  extractProjectId,
  idQuery,
} from '../projects/project-access';

const DEFAULT_DEPARTMENTS = [
  'Steel agency',
  'Shutring agency',
  'Casting agency',
  'Depart labour agency',
];

const ATTENDANCE_METHODS = new Set(['count_of_workers', 'each_worker_separately']);

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
  if (objId) {
    return { $or: [{ companyId: objId }, { companyId: String(companyId) }] };
  }
  return { companyId: String(companyId) };
}

function projectFilter(projectId: string): any {
  const objId = toObjectId(projectId);
  if (objId) {
    return { $or: [{ projectId: objId }, { projectId: String(projectId) }] };
  }
  return { projectId: String(projectId) };
}

function sanitizeContractor(doc: any, departmentsById?: Map<string, string>) {
  if (!doc) return null;
  const id = String(doc._id);
  const deptIds = (doc.departmentIds || []).map((d: any) => String(d));
  const departments = deptIds.map((did: string) => ({
    id: did,
    name: departmentsById?.get(did) || '',
  }));
  return {
    id,
    _id: id,
    companyId: doc.companyId ? String(doc.companyId) : null,
    projectId: doc.projectId ? String(doc.projectId) : null,
    name: doc.name || '',
    email: doc.email || '',
    address: doc.address || '',
    phone: doc.phone || '',
    businessName: doc.businessName || '',
    businessGst: doc.businessGst || '',
    aadharNumber: doc.aadharNumber || '',
    aadharImage: doc.aadharImage || null,
    attendanceMethod: doc.attendanceMethod || 'count_of_workers',
    departmentIds: deptIds,
    departments,
    sourceContractorId: doc.sourceContractorId ? String(doc.sourceContractorId) : null,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function ensureDefaultDepartments(db: any, companyId: string, projectId: string) {
  const coll = db.collection('contractor_departments');
  const now = new Date();
  for (const name of DEFAULT_DEPARTMENTS) {
    const nameLower = name.toLowerCase().trim();
    const existing = await coll.findOne({
      ...companyFilter(companyId),
      ...projectFilter(projectId),
      nameLower,
      isActive: { $ne: false },
    });
    if (!existing) {
      await coll.insertOne({
        companyId: toObjectId(companyId) || companyId,
        projectId: toObjectId(projectId) || projectId,
        name,
        nameLower,
        isDefault: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

async function loadDepartmentsMap(db: any, companyId: string, projectId: string) {
  const rows = await db
    .collection('contractor_departments')
    .find({
      ...companyFilter(companyId),
      ...projectFilter(projectId),
      isActive: { $ne: false },
    })
    .toArray();
  const map = new Map<string, string>();
  for (const r of rows) map.set(String(r._id), r.name);
  return map;
}

async function resolveProjectContext(req: any, db: any) {
  const ctx = await resolveUserAndCompany(req, db);
  const projectId = extractProjectId(req);
  if (!projectId) {
    const err: any = new Error('Project context is required (X-Project-Id)');
    err.status = 400;
    err.code = 'PROJECT_REQUIRED';
    throw err;
  }
  const project = await assertProjectAccess(db, ctx, String(projectId), { requireActive: true });
  return {
    ctx,
    project,
    projectId: String(project._id || project.id),
    companyId: ctx.companyId,
  };
}

function handleErr(res: any, e: any) {
  const status = e.status || 500;
  res.status(status).json({ message: e.message || 'Request failed', code: e.code });
}

export function createContractorsRouter(
  getDb: () => any,
  authMiddleware: any,
  logAudit?: any,
): Router {
  const router = Router();

  // ── Departments: list (+ ensure defaults) ─────────────────────────────────
  router.get('/departments', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      await ensureDefaultDepartments(db, companyId, projectId);

      const local = await db
        .collection('contractor_departments')
        .find({
          ...companyFilter(companyId),
          ...projectFilter(projectId),
          isActive: { $ne: false },
        })
        .sort({ name: 1 })
        .toArray();

      const localNames = new Set(local.map((d: any) => String(d.nameLower || d.name).toLowerCase()));

      const otherDepts = await db
        .collection('contractor_departments')
        .find({
          ...companyFilter(companyId),
          isActive: { $ne: false },
          $nor: [projectFilter(projectId)],
        })
        .project({ name: 1, nameLower: 1, projectId: 1 })
        .toArray();

      const companySuggestions: { name: string; nameLower: string }[] = [];
      const seen = new Set<string>();
      for (const d of otherDepts) {
        const key = String(d.nameLower || d.name || '')
          .toLowerCase()
          .trim();
        if (!key || localNames.has(key) || seen.has(key)) continue;
        seen.add(key);
        companySuggestions.push({ name: d.name, nameLower: key });
      }
      companySuggestions.sort((a, b) => a.name.localeCompare(b.name));

      res.json({
        departments: local.map((d: any) => ({
          id: String(d._id),
          _id: String(d._id),
          name: d.name,
          isDefault: !!d.isDefault,
          projectId: String(d.projectId),
        })),
        companySuggestions,
      });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Departments: suggest across company ───────────────────────────────────
  router.get('/departments/suggest', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      await ensureDefaultDepartments(db, companyId, projectId);
      const q = String(req.query.q || '')
        .trim()
        .toLowerCase();

      const all = await db
        .collection('contractor_departments')
        .find({
          ...companyFilter(companyId),
          isActive: { $ne: false },
          ...(q
            ? {
                $or: [
                  { nameLower: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
                  { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
                ],
              }
            : {}),
        })
        .project({ name: 1, nameLower: 1, projectId: 1, isDefault: 1 })
        .limit(80)
        .toArray();

      const local: any[] = [];
      const otherNames = new Map<string, string>();
      for (const d of all) {
        const pid = String(d.projectId);
        const key = String(d.nameLower || d.name)
          .toLowerCase()
          .trim();
        if (pid === projectId) {
          local.push({
            id: String(d._id),
            name: d.name,
            source: 'local',
            isDefault: !!d.isDefault,
          });
        } else if (key && !otherNames.has(key)) {
          otherNames.set(key, d.name);
        }
      }

      const localKeys = new Set(
        local.map((d) =>
          String(d.name)
            .toLowerCase()
            .trim(),
        ),
      );
      const company: any[] = [];
      for (const [key, name] of otherNames) {
        if (localKeys.has(key)) continue;
        company.push({ name, nameLower: key, source: 'company' });
      }

      res.json({ local, company });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Departments: create on active project ─────────────────────────────────
  router.post('/departments', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, ctx } = await resolveProjectContext(req, db);
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ message: 'Department name is required' });
      const nameLower = name.toLowerCase();

      await ensureDefaultDepartments(db, companyId, projectId);

      const existing = await db.collection('contractor_departments').findOne({
        ...companyFilter(companyId),
        ...projectFilter(projectId),
        nameLower,
        isActive: { $ne: false },
      });
      if (existing) {
        return res.json({
          id: String(existing._id),
          _id: String(existing._id),
          name: existing.name,
          isDefault: !!existing.isDefault,
          alreadyExists: true,
        });
      }

      const now = new Date();
      const doc = {
        companyId: toObjectId(companyId) || companyId,
        projectId: toObjectId(projectId) || projectId,
        name,
        nameLower,
        isDefault: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
      };
      const result = await db.collection('contractor_departments').insertOne(doc);
      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          companyId,
          projectId,
          action: 'CONTRACTOR_DEPARTMENT_CREATED',
          resource: 'contractor_departments',
          resourceId: result.insertedId.toString(),
          newValue: { name },
        });
      }
      res.status(201).json({
        id: result.insertedId.toString(),
        _id: result.insertedId.toString(),
        name,
        isDefault: false,
      });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Contractors: company-wide suggest (other projects) ────────────────────
  router.get('/suggest', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const q = String(req.query.q || '')
        .trim()
        .toLowerCase();
      if (q.length < 1) return res.json({ suggestions: [] });

      const local = await db
        .collection('contractors')
        .find({
          ...companyFilter(companyId),
          ...projectFilter(projectId),
          isActive: { $ne: false },
        })
        .project({ email: 1, sourceContractorId: 1 })
        .toArray();

      const localEmails = new Set(
        local.map((c: any) => String(c.email || '').toLowerCase()).filter(Boolean),
      );
      const localSources = new Set(
        local.map((c: any) => (c.sourceContractorId ? String(c.sourceContractorId) : '')).filter(Boolean),
      );

      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const candidates = await db
        .collection('contractors')
        .find({
          ...companyFilter(companyId),
          isActive: { $ne: false },
          $nor: [projectFilter(projectId)],
          $or: [
            { name: { $regex: escaped, $options: 'i' } },
            { email: { $regex: escaped, $options: 'i' } },
            { phone: { $regex: escaped, $options: 'i' } },
            { businessName: { $regex: escaped, $options: 'i' } },
          ],
        })
        .project({ passwordHash: 0 })
        .limit(40)
        .toArray();

      const suggestions = candidates
        .filter((c: any) => {
          const email = String(c.email || '').toLowerCase();
          const id = String(c._id);
          if (email && localEmails.has(email)) return false;
          if (localSources.has(id)) return false;
          return true;
        })
        .slice(0, 15)
        .map((c: any) => ({
          id: String(c._id),
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          businessName: c.businessName || '',
          businessGst: c.businessGst || '',
          aadharNumber: c.aadharNumber || '',
          aadharImage: c.aadharImage || null,
          attendanceMethod: c.attendanceMethod || 'count_of_workers',
          projectId: c.projectId ? String(c.projectId) : null,
        }));

      res.json({ suggestions });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Contractors: list ─────────────────────────────────────────────────────
  router.get('/', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const deptMap = await loadDepartmentsMap(db, companyId, projectId);
      const rows = await db
        .collection('contractors')
        .find({
          ...companyFilter(companyId),
          ...projectFilter(projectId),
          isActive: { $ne: false },
        })
        .sort({ name: 1 })
        .toArray();
      res.json(rows.map((r: any) => sanitizeContractor(r, deptMap)));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Contractors: detail ───────────────────────────────────────────────────
  router.get('/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const doc = await db.collection('contractors').findOne({
        ...idQuery(req.params.id),
        ...companyFilter(companyId),
        ...projectFilter(projectId),
      });
      if (!doc || doc.isActive === false) {
        return res.status(404).json({ message: 'Contractor not found' });
      }
      const deptMap = await loadDepartmentsMap(db, companyId, projectId);
      res.json(sanitizeContractor(doc, deptMap));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Contractors: create ───────────────────────────────────────────────────
  router.post('/', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, ctx } = await resolveProjectContext(req, db);
      await ensureDefaultDepartments(db, companyId, projectId);

      const body = req.body || {};
      const name = String(body.name || '').trim();
      const emailRaw = body.email == null ? '' : String(body.email).trim().toLowerCase();
      const email = emailRaw || null;
      const phone = String(body.phone || '').trim();
      const attendanceMethod = String(body.attendanceMethod || '').trim();

      if (!name) return res.status(400).json({ message: 'Contractor name is required' });
      if (!phone) return res.status(400).json({ message: 'Phone number is required' });
      if (!ATTENDANCE_METHODS.has(attendanceMethod)) {
        return res.status(400).json({ message: 'Invalid attendance method' });
      }

      if (email) {
        const dup = await db.collection('contractors').findOne({
          ...companyFilter(companyId),
          ...projectFilter(projectId),
          email,
          isActive: { $ne: false },
        });
        if (dup) {
          return res.status(409).json({ message: 'A contractor with this email already exists on this project' });
        }
      }

      let departmentIds: ObjectId[] = [];
      const rawDeptIds = Array.isArray(body.departmentIds) ? body.departmentIds : [];
      for (const raw of rawDeptIds) {
        const oid = toObjectId(raw);
        if (!oid) continue;
        const dept = await db.collection('contractor_departments').findOne({
          _id: oid,
          ...companyFilter(companyId),
          ...projectFilter(projectId),
          isActive: { $ne: false },
        });
        if (dept) departmentIds.push(oid);
      }
      if (departmentIds.length === 0) {
        return res.status(400).json({ message: 'Select at least one department' });
      }

      let sourceContractorId: ObjectId | null = null;
      if (body.sourceContractorId) {
        const srcId = toObjectId(body.sourceContractorId);
        if (srcId) {
          const src = await db.collection('contractors').findOne({
            _id: srcId,
            ...companyFilter(companyId),
            isActive: { $ne: false },
          });
          if (src) sourceContractorId = srcId;
        }
      }

      const now = new Date();
      const doc: any = {
        companyId: toObjectId(companyId) || companyId,
        projectId: toObjectId(projectId) || projectId,
        name,
        email,
        address: String(body.address || '').trim(),
        phone,
        businessName: String(body.businessName || '').trim(),
        businessGst: String(body.businessGst || '').trim(),
        aadharNumber: String(body.aadharNumber || '').trim(),
        aadharImage: body.aadharImage || null,
        attendanceMethod,
        departmentIds,
        sourceContractorId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
      };

      const result = await db.collection('contractors').insertOne(doc);
      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          companyId,
          projectId,
          action: 'CONTRACTOR_CREATED',
          resource: 'contractors',
          resourceId: result.insertedId.toString(),
          newValue: { name, email },
        });
      }

      const deptMap = await loadDepartmentsMap(db, companyId, projectId);
      res.status(201).json(sanitizeContractor({ ...doc, _id: result.insertedId }, deptMap));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Contractors: update ───────────────────────────────────────────────────
  router.put('/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, ctx } = await resolveProjectContext(req, db);
      const existing = await db.collection('contractors').findOne({
        ...idQuery(req.params.id),
        ...companyFilter(companyId),
        ...projectFilter(projectId),
      });
      if (!existing || existing.isActive === false) {
        return res.status(404).json({ message: 'Contractor not found' });
      }

      const body = req.body || {};
      const update: any = { updatedAt: new Date() };

      if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) return res.status(400).json({ message: 'Contractor name is required' });
        update.name = name;
      }
      if (body.email !== undefined) {
        const emailRaw = body.email == null ? '' : String(body.email).trim().toLowerCase();
        const email = emailRaw || null;
        if (email) {
          const dup = await db.collection('contractors').findOne({
            ...companyFilter(companyId),
            ...projectFilter(projectId),
            email,
            isActive: { $ne: false },
            _id: { $ne: existing._id },
          });
          if (dup) {
            return res.status(409).json({ message: 'A contractor with this email already exists on this project' });
          }
        }
        update.email = email;
      }
      if (body.phone !== undefined) {
        const phone = String(body.phone || '').trim();
        if (!phone) return res.status(400).json({ message: 'Phone number is required' });
        update.phone = phone;
      }
      if (body.address !== undefined) update.address = String(body.address || '').trim();
      if (body.businessName !== undefined) update.businessName = String(body.businessName || '').trim();
      if (body.businessGst !== undefined) update.businessGst = String(body.businessGst || '').trim();
      if (body.aadharNumber !== undefined) update.aadharNumber = String(body.aadharNumber || '').trim();
      if (body.aadharImage !== undefined) update.aadharImage = body.aadharImage || null;
      if (body.attendanceMethod !== undefined) {
        const attendanceMethod = String(body.attendanceMethod || '').trim();
        if (!ATTENDANCE_METHODS.has(attendanceMethod)) {
          return res.status(400).json({ message: 'Invalid attendance method' });
        }
        update.attendanceMethod = attendanceMethod;
      }
      if (Array.isArray(body.departmentIds)) {
        const departmentIds: ObjectId[] = [];
        for (const raw of body.departmentIds) {
          const oid = toObjectId(raw);
          if (!oid) continue;
          const dept = await db.collection('contractor_departments').findOne({
            _id: oid,
            ...companyFilter(companyId),
            ...projectFilter(projectId),
            isActive: { $ne: false },
          });
          if (dept) departmentIds.push(oid);
        }
        if (departmentIds.length === 0) {
          return res.status(400).json({ message: 'Select at least one department' });
        }
        update.departmentIds = departmentIds;
      }
      await db.collection('contractors').updateOne({ _id: existing._id }, { $set: update });
      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          companyId,
          projectId,
          action: 'CONTRACTOR_UPDATED',
          resource: 'contractors',
          resourceId: String(existing._id),
          newValue: update,
        });
      }

      const fresh = await db.collection('contractors').findOne({ _id: existing._id });
      const deptMap = await loadDepartmentsMap(db, companyId, projectId);
      res.json(sanitizeContractor(fresh, deptMap));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Contractors: soft delete ─────────────────────────────────────────────
  router.delete('/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, ctx } = await resolveProjectContext(req, db);
      const existing = await db.collection('contractors').findOne({
        ...idQuery(req.params.id),
        ...companyFilter(companyId),
        ...projectFilter(projectId),
      });
      if (!existing || existing.isActive === false) {
        return res.status(404).json({ message: 'Contractor not found' });
      }
      await db.collection('contractors').updateOne(
        { _id: existing._id },
        { $set: { isActive: false, updatedAt: new Date(), deletedAt: new Date() } },
      );
      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          companyId,
          projectId,
          action: 'CONTRACTOR_DEACTIVATED',
          resource: 'contractors',
          resourceId: String(existing._id),
          previousValue: { name: existing.name },
        });
      }
      res.json({ message: 'Contractor deactivated' });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  return router;
}
