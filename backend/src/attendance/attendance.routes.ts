import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  resolveUserAndCompany,
  assertProjectAccess,
  extractProjectId,
} from '../projects/project-access';
import {
  ensureAttendanceIndexes,
  listAssignments,
  setAssignments,
  getEligible,
  upsertSession,
  listSessions,
  getSessionDetail,
  voidSession,
  buildReportDetail,
} from './attendance.service';
import {
  buildAttendanceExcel,
  buildAttendancePdf,
  buildTypedAttendanceExcel,
  buildTypedAttendancePdf,
} from './attendance.export';
import {
  buildContractorSummaryFromRows,
  buildTypedReport,
  getReportMeta,
} from './attendance.reports';

function handleErr(res: any, e: any) {
  const status = e.status || 500;
  res.status(status).json({ message: e.message || 'Request failed', code: e.code });
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

async function companyDisplayName(db: any, companyId: any): Promise<string | undefined> {
  if (!companyId) return undefined;
  try {
    const oid =
      companyId instanceof ObjectId
        ? companyId
        : ObjectId.isValid(String(companyId))
          ? new ObjectId(String(companyId))
          : null;
    const company = await db.collection('companies').findOne(
      oid ? { $or: [{ _id: oid }, { _id: String(companyId) }] } : { _id: companyId },
    );
    return company?.name || company?.displayName || undefined;
  } catch {
    return undefined;
  }
}

export function createAttendanceRouter(
  getDb: () => any,
  authMiddleware: any,
  logAudit?: any,
  requirePermission?: (moduleName: string, featureName?: string) => any,
  requireAnyPermission?: (moduleName: string, featureNames: string[]) => any,
): Router {
  const router = Router();
  const perm = (feature: string) =>
    requirePermission ? requirePermission('attendance', feature) : ((_req: any, _res: any, next: any) => next());
  const createOrEdit = requireAnyPermission
    ? requireAnyPermission('attendance', ['create', 'edit'])
    : ((_req: any, _res: any, next: any) => next());

  router.use(authMiddleware);

  router.use(async (_req, _res, next) => {
    try {
      await ensureAttendanceIndexes(getDb());
    } catch {
      /* ignore */
    }
    next();
  });

  // ── Assignments (company labour ↔ project) ──────────────────────────────
  router.get('/assignments', perm('view'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const rows = await listAssignments(db, companyId, projectId);
      res.json({ assignments: rows });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.put('/assignments', createOrEdit, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, ctx } = await resolveProjectContext(req, db);
      const labourIds = Array.isArray(req.body?.labourIds) ? req.body.labourIds : [];
      const rows = await setAssignments(db, companyId, projectId, labourIds, String(ctx.userId || ''));
      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          companyId,
          action: 'ATTENDANCE_ASSIGNMENTS_UPDATED',
          resource: 'project_labour_assignments',
          newValue: { count: rows.length },
        });
      }
      res.json({ assignments: rows });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Eligible + existing marks ───────────────────────────────────────────
  router.get('/eligible', perm('view'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const data = await getEligible(db, companyId, projectId, {
        date: String(req.query.date || ''),
        shift: String(req.query.shift || 'day'),
        source: String(req.query.source || ''),
        contractorId: req.query.contractorId ? String(req.query.contractorId) : undefined,
      });
      res.json(data);
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Sessions CRUD (create or edit permission) ───────────────────────────
  router.put('/sessions', createOrEdit, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, ctx } = await resolveProjectContext(req, db);
      const result = await upsertSession(db, companyId, projectId, String(ctx.userId || ''), req.body || {});
      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          companyId,
          projectId,
          action: 'ATTENDANCE_SESSION_SAVED',
          resource: 'attendance_sessions',
          newValue: {
            date: req.body?.date,
            shift: req.body?.shift,
            source: req.body?.source,
          },
        });
      }
      res.json(result);
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.get('/sessions', perm('view'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const rows = await listSessions(db, companyId, projectId, req.query || {});
      res.json({ sessions: rows });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.get('/sessions/:id', perm('view'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const detail = await getSessionDetail(db, companyId, projectId, req.params.id);
      res.json(detail);
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.delete('/sessions/:id', perm('delete'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, ctx } = await resolveProjectContext(req, db);
      const result = await voidSession(db, companyId, projectId, req.params.id, String(ctx.userId || ''));
      res.json(result);
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  // ── Reports (typed suite + legacy flat detail) ──────────────────────────
  router.get('/reports/meta', perm('view'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const meta = await getReportMeta(db, companyId, projectId);
      res.json(meta);
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.get('/reports/preview', perm('view'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, project } = await resolveProjectContext(req, db);
      const companyName = await companyDisplayName(db, companyId);
      const report = await buildTypedReport(db, companyId, projectId, req.query || {}, {
        paginate: true,
      });
      report.meta = {
        ...report.meta,
        companyName,
        projectName: project?.name,
      };
      res.json(report);
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.get('/reports/summary', perm('view'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const report = await buildReportDetail(db, companyId, projectId, req.query || {});
      res.json({ summary: report.summary, sessions: report.sessions });
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.get('/reports/detail', perm('view'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId } = await resolveProjectContext(req, db);
      const report = await buildReportDetail(db, companyId, projectId, req.query || {});
      res.json(report);
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.get('/reports/export.xlsx', perm('export'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, project } = await resolveProjectContext(req, db);
      const companyName = await companyDisplayName(db, companyId);
      const q = req.query || {};
      if (q.reportType) {
        const report = await buildTypedReport(db, companyId, projectId, q, {
          paginate: false,
          forExport: 'xlsx',
        });
        report.meta = { ...report.meta, companyName, projectName: project?.name };
        const flatRows = report.matrixRows || report.rows || [];
        report.contractorSummary = buildContractorSummaryFromRows(flatRows);
        const buf = await buildTypedAttendanceExcel(report);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.xlsx"');
        return res.send(buf);
      }
      const report = await buildReportDetail(db, companyId, projectId, q);
      const buf = await buildAttendanceExcel({
        ...report,
        meta: {
          projectName: project?.name,
          companyName,
          from: q.from || q.date,
          to: q.to || q.date,
        },
      });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.xlsx"');
      res.send(buf);
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  router.get('/reports/export.pdf', perm('export'), async (req: any, res: any) => {
    try {
      const db = getDb();
      const { companyId, projectId, project } = await resolveProjectContext(req, db);
      const companyName = await companyDisplayName(db, companyId);
      const q = req.query || {};
      if (q.reportType) {
        const report = await buildTypedReport(db, companyId, projectId, q, {
          paginate: false,
          forExport: 'pdf',
        });
        report.meta = { ...report.meta, companyName, projectName: project?.name };
        const buf = await buildTypedAttendancePdf(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.pdf"');
        return res.send(buf);
      }
      const report = await buildReportDetail(db, companyId, projectId, q);
      const buf = await buildAttendancePdf({
        ...report,
        meta: {
          projectName: project?.name,
          companyName,
          from: q.from || q.date,
          to: q.to || q.date,
        },
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.pdf"');
      res.send(buf);
    } catch (e: any) {
      handleErr(res, e);
    }
  });

  return router;
}
