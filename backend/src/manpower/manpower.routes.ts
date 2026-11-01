import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  resolveUserAndCompany,
  assertProjectAccess,
  extractProjectId,
  idQuery,
} from '../projects/project-access';
import { loadContractorMode } from './contractor-mode';

const SALARY_UNITS = new Set(['per_month', 'per_day', 'per_hour']);

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

/** Combine filters that may each contain `$or` — object spread would overwrite `$or`. */
function andFilters(...parts: any[]): any {
  const clauses = parts.filter((p) => p && typeof p === 'object' && Object.keys(p).length > 0);
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

function contractorIdFilter(contractorId: string): any {
  const oid = toObjectId(contractorId);
  if (oid) return { $or: [{ contractorId: oid }, { contractorId: String(contractorId) }] };
  return { contractorId: String(contractorId) };
}

function handleErr(res: any, e: any) {
  const status = e.status || 500;
  res.status(status).json({ message: e.message || 'Request failed', code: e.code });
}

function parseSalary(body: any): { salaryAmount: number; salaryUnit: string } | { error: string } {
  const salaryAmount = Number(body.salaryAmount);
  const salaryUnit = String(body.salaryUnit || '').trim();
  if (!Number.isFinite(salaryAmount) || salaryAmount < 0) {
    return { error: 'Valid salary amount is required' };
  }
  if (!SALARY_UNITS.has(salaryUnit)) {
    return { error: 'Salary unit must be per_month, per_day, or per_hour' };
  }
  return { salaryAmount, salaryUnit };
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

async function loadContractorWithDepartments(
  db: any,
  companyId: string,
  projectId: string,
  contractorId: string,
) {
  return loadContractorMode(db, companyId, projectId, contractorId);
}

function sanitizeLabour(doc: any) {
  if (!doc) return null;
  const id = String(doc._id);
  return {
    id,
    _id: id,
    companyId: doc.companyId ? String(doc.companyId) : null,
    name: doc.name || '',
    phone: doc.phone || '',
    address: doc.address || '',
    labourType: doc.labourType || '',
    aadharImage: doc.aadharImage || null,
    salaryAmount: doc.salaryAmount ?? 0,
    salaryUnit: doc.salaryUnit || 'per_day',
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function sanitizeNamedWorker(doc: any) {
  if (!doc) return null;
  const id = String(doc._id);
  return {
    id,
    _id: id,
    companyId: doc.companyId ? String(doc.companyId) : null,
    projectId: doc.projectId ? String(doc.projectId) : null,
    contractorId: doc.contractorId ? String(doc.contractorId) : null,
    photo: doc.photo || null,
    name: doc.name || '',
    phone: doc.phone || '',
    address: doc.address || '',
    labourType: doc.labourType || '',
    aadharImage: doc.aadharImage || null,
    salaryAmount: doc.salaryAmount ?? 0,
    salaryUnit: doc.salaryUnit || 'per_day',
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normalizeWorkforceRows(rows: any[]): { rows?: any[]; error?: string } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: 'Add at least one workforce row' };
  }
  const seen = new Set<string>();
  const normalized: any[] = [];
  for (const raw of rows) {
    const labourType = String(raw?.labourType || '').trim();
    const count = Number(raw?.count);
    const salary = parseSalary(raw || {});
    if (!labourType) return { error: 'Labour type is required on each row' };
    const key = labourType.toLowerCase();
    if (seen.has(key)) return { error: `Duplicate labour type: ${labourType}` };
    seen.add(key);
    if (!Number.isFinite(count) || count <= 0) {
      return { error: `Valid labour count is required for ${labourType}` };
    }
    if ('error' in salary) return { error: salary.error };
    normalized.push({
      labourType,
      count,
      salaryAmount: salary.salaryAmount,
      salaryUnit: salary.salaryUnit,
    });
  }
  return { rows: normalized };
}

export function createManpowerRouter(getDb: () => any, authMiddleware: any, logAudit?: any): Router {
  const router = Router();

  // ═══════════════════════════════════════════════════════════════════════════
  // Company labour (no project required)
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/labours', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const rows = await db
        .collection('labours')
        .find(andFilters(companyFilter(ctx.companyId), { isActive: { $ne: false } }))
        .sort({ name: 1 })
        .toArray();
      res.json(rows.map(sanitizeLabour));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.get('/labours/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const doc = await db.collection('labours').findOne(
        andFilters(idQuery(req.params.id), companyFilter(ctx.companyId)),
      );
      if (!doc || doc.isActive === false) return res.status(404).json({ message: 'Labour not found' });
      res.json(sanitizeLabour(doc));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.post('/labours', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const labourType = String(body.labourType || '').trim();
      const salary = parseSalary(body);
      if (!name) return res.status(400).json({ message: 'Labour name is required' });
      if (!labourType) return res.status(400).json({ message: 'Labour type is required' });
      if ('error' in salary) return res.status(400).json({ message: salary.error });

      const now = new Date();
      const doc: any = {
        companyId: toObjectId(ctx.companyId) || ctx.companyId,
        name,
        phone: String(body.phone || '').trim(),
        address: String(body.address || '').trim(),
        labourType,
        aadharImage: body.aadharImage || null,
        salaryAmount: salary.salaryAmount,
        salaryUnit: salary.salaryUnit,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
      };
      const result = await db.collection('labours').insertOne(doc);
      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          companyId: ctx.companyId,
          action: 'LABOUR_CREATED',
          resource: 'labours',
          resourceId: result.insertedId.toString(),
          newValue: { name, labourType },
        });
      }
      res.status(201).json(sanitizeLabour({ ...doc, _id: result.insertedId }));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.put('/labours/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const existing = await db.collection('labours').findOne(
        andFilters(idQuery(req.params.id), companyFilter(ctx.companyId)),
      );
      if (!existing || existing.isActive === false) {
        return res.status(404).json({ message: 'Labour not found' });
      }

      const body = req.body || {};
      const update: any = { updatedAt: new Date() };
      if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) return res.status(400).json({ message: 'Labour name is required' });
        update.name = name;
      }
      if (body.labourType !== undefined) {
        const labourType = String(body.labourType || '').trim();
        if (!labourType) return res.status(400).json({ message: 'Labour type is required' });
        update.labourType = labourType;
      }
      if (body.phone !== undefined) update.phone = String(body.phone || '').trim();
      if (body.address !== undefined) update.address = String(body.address || '').trim();
      if (body.aadharImage !== undefined) update.aadharImage = body.aadharImage || null;
      if (body.salaryAmount !== undefined || body.salaryUnit !== undefined) {
        const salary = parseSalary({
          salaryAmount: body.salaryAmount !== undefined ? body.salaryAmount : existing.salaryAmount,
          salaryUnit: body.salaryUnit !== undefined ? body.salaryUnit : existing.salaryUnit,
        });
        if ('error' in salary) return res.status(400).json({ message: salary.error });
        update.salaryAmount = salary.salaryAmount;
        update.salaryUnit = salary.salaryUnit;
      }

      await db.collection('labours').updateOne({ _id: existing._id }, { $set: update });
      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          companyId: ctx.companyId,
          action: 'LABOUR_UPDATED',
          resource: 'labours',
          resourceId: String(existing._id),
          newValue: update,
        });
      }
      const fresh = await db.collection('labours').findOne({ _id: existing._id });
      res.json(sanitizeLabour(fresh));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.delete('/labours/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const existing = await db.collection('labours').findOne(
        andFilters(idQuery(req.params.id), companyFilter(ctx.companyId)),
      );
      if (!existing || existing.isActive === false) {
        return res.status(404).json({ message: 'Labour not found' });
      }
      await db.collection('labours').updateOne(
        { _id: existing._id },
        { $set: { isActive: false, updatedAt: new Date(), deletedAt: new Date() } },
      );
      res.json({ message: 'Labour deactivated' });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Contractor labour (project-scoped)
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/contractor-labours/mode', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const contractorId = String(req.query.contractorId || '');
      if (!contractorId) return res.status(400).json({ message: 'contractorId is required' });
      const { contractor, departments, mode } = await loadContractorWithDepartments(
        db,
        companyId,
        projectId,
        contractorId,
      );
      res.json({
        mode,
        departments,
        contractor: {
          id: String(contractor._id),
          name: contractor.name,
        },
      });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.get('/contractor-labours', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const contractorId = String(req.query.contractorId || '');
      if (!contractorId) return res.status(400).json({ message: 'contractorId is required' });

      const { contractor, departments, mode } = await loadContractorWithDepartments(
        db,
        companyId,
        projectId,
        contractorId,
      );

      if (mode === 'named') {
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
        return res.json({
          mode,
          departments,
          contractor: { id: String(contractor._id), name: contractor.name },
          workers: workers.map(sanitizeNamedWorker),
        });
      }

      const workforce = await db.collection('contractor_workforce').findOne(
        andFilters(
          companyFilter(companyId),
          projectFilter(projectId),
          contractorIdFilter(contractorId),
        ),
      );

      res.json({
        mode,
        departments,
        contractor: { id: String(contractor._id), name: contractor.name },
        workforce: workforce
          ? {
              id: String(workforce._id),
              rows: workforce.rows || [],
              history: (workforce.history || []).slice().reverse(),
              updatedAt: workforce.updatedAt,
            }
          : { id: null, rows: [], history: [], updatedAt: null },
      });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // Named workers
  router.post('/contractor-labours/workers', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, ctx } = await resolveProjectContext(req, db);
      const body = req.body || {};
      const contractorId = String(body.contractorId || '');
      if (!contractorId) return res.status(400).json({ message: 'contractorId is required' });

      const { mode } = await loadContractorWithDepartments(db, companyId, projectId, contractorId);
      if (mode !== 'named') {
        return res.status(400).json({ message: 'This contractor uses workforce rows, not named workers' });
      }

      const name = String(body.name || '').trim();
      const labourType = String(body.labourType || '').trim();
      const salary = parseSalary(body);
      if (!name) return res.status(400).json({ message: 'Labour name is required' });
      if (!labourType) return res.status(400).json({ message: 'Labour type is required' });
      if ('error' in salary) return res.status(400).json({ message: salary.error });

      const now = new Date();
      const doc: any = {
        companyId: toObjectId(companyId) || companyId,
        projectId: toObjectId(projectId) || projectId,
        contractorId: toObjectId(contractorId) || contractorId,
        photo: body.photo || null,
        name,
        phone: String(body.phone || '').trim(),
        address: String(body.address || '').trim(),
        labourType,
        aadharImage: body.aadharImage || null,
        salaryAmount: salary.salaryAmount,
        salaryUnit: salary.salaryUnit,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
      };
      const result = await db.collection('contractor_labours').insertOne(doc);
      res.status(201).json(sanitizeNamedWorker({ ...doc, _id: result.insertedId }));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.put('/contractor-labours/workers/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const existing = await db.collection('contractor_labours').findOne(
        andFilters(idQuery(req.params.id), companyFilter(companyId), projectFilter(projectId)),
      );
      if (!existing || existing.isActive === false) {
        return res.status(404).json({ message: 'Contractor labour not found' });
      }

      const body = req.body || {};
      const update: any = { updatedAt: new Date() };
      if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) return res.status(400).json({ message: 'Labour name is required' });
        update.name = name;
      }
      if (body.labourType !== undefined) {
        const labourType = String(body.labourType || '').trim();
        if (!labourType) return res.status(400).json({ message: 'Labour type is required' });
        update.labourType = labourType;
      }
      if (body.phone !== undefined) update.phone = String(body.phone || '').trim();
      if (body.address !== undefined) update.address = String(body.address || '').trim();
      if (body.photo !== undefined) update.photo = body.photo || null;
      if (body.aadharImage !== undefined) update.aadharImage = body.aadharImage || null;
      if (body.salaryAmount !== undefined || body.salaryUnit !== undefined) {
        const salary = parseSalary({
          salaryAmount: body.salaryAmount !== undefined ? body.salaryAmount : existing.salaryAmount,
          salaryUnit: body.salaryUnit !== undefined ? body.salaryUnit : existing.salaryUnit,
        });
        if ('error' in salary) return res.status(400).json({ message: salary.error });
        update.salaryAmount = salary.salaryAmount;
        update.salaryUnit = salary.salaryUnit;
      }

      await db.collection('contractor_labours').updateOne({ _id: existing._id }, { $set: update });
      const fresh = await db.collection('contractor_labours').findOne({ _id: existing._id });
      res.json(sanitizeNamedWorker(fresh));
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.delete('/contractor-labours/workers/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const existing = await db.collection('contractor_labours').findOne(
        andFilters(idQuery(req.params.id), companyFilter(companyId), projectFilter(projectId)),
      );
      if (!existing || existing.isActive === false) {
        return res.status(404).json({ message: 'Contractor labour not found' });
      }
      await db.collection('contractor_labours').updateOne(
        { _id: existing._id },
        { $set: { isActive: false, updatedAt: new Date(), deletedAt: new Date() } },
      );
      res.json({ message: 'Contractor labour deactivated' });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // Workforce rows + history
  router.put('/contractor-labours/workforce', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, ctx } = await resolveProjectContext(req, db);
      const body = req.body || {};
      const contractorId = String(body.contractorId || '');
      if (!contractorId) return res.status(400).json({ message: 'contractorId is required' });

      const { mode } = await loadContractorWithDepartments(db, companyId, projectId, contractorId);
      if (mode !== 'workforce') {
        return res.status(400).json({ message: 'This contractor uses named workers, not workforce rows' });
      }

      const normalized = normalizeWorkforceRows(body.rows);
      if (normalized.error) return res.status(400).json({ message: normalized.error });

      const existing = await db.collection('contractor_workforce').findOne(
        andFilters(
          companyFilter(companyId),
          projectFilter(projectId),
          contractorIdFilter(contractorId),
        ),
      );

      const now = new Date();
      if (!existing) {
        const doc = {
          companyId: toObjectId(companyId) || companyId,
          projectId: toObjectId(projectId) || projectId,
          contractorId: toObjectId(contractorId) || contractorId,
          rows: normalized.rows,
          history: [],
          createdAt: now,
          updatedAt: now,
          updatedBy: ctx.userId,
        };
        const result = await db.collection('contractor_workforce').insertOne(doc);
        return res.json({
          id: result.insertedId.toString(),
          rows: doc.rows,
          history: [],
          updatedAt: now,
        });
      }

      const prevRows = Array.isArray(existing.rows) ? existing.rows : [];
      const historyEntry = {
        at: now,
        by: ctx.userId,
        rows: prevRows,
      };
      const history = [...(existing.history || []), historyEntry];

      await db.collection('contractor_workforce').updateOne(
        { _id: existing._id },
        {
          $set: {
            rows: normalized.rows,
            history,
            updatedAt: now,
            updatedBy: ctx.userId,
          },
        },
      );

      res.json({
        id: String(existing._id),
        rows: normalized.rows,
        history: history.slice().reverse(),
        updatedAt: now,
      });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  return router;
}
