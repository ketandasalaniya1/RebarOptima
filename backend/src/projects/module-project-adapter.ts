import { ObjectId } from 'mongodb';
import {
  resolveUserAndCompany,
  assertProjectAccess,
  filterProjectsForUser,
  ProjectAccessContext,
} from './project-access';

/**
 * Resolve a module path/query projectId to the canonical global project id.
 * Accepts global IDs or legacy module catalog IDs (via orgProjectId bridge).
 */
export async function resolveCanonicalProjectId(
  db: any,
  ctx: ProjectAccessContext,
  projectId: string,
  legacyCollections: string[] = [
    'bbs_projects',
    'casting_projects',
    'crm_projects',
    'doc_projects',
    'gi_projects',
  ],
): Promise<{ projectId: string; project: any }> {
  // Try global first
  try {
    const project = await assertProjectAccess(db, ctx, projectId, { requireActive: true });
    return { projectId: String(project._id || project.id), project };
  } catch (e: any) {
    if (e.code !== 'PROJECT_NOT_FOUND') throw e;
  }

  // Legacy: module catalog row with orgProjectId or same _id already remapped
  for (const coll of legacyCollections) {
    try {
      const legacy = await db.collection(coll).findOne({
        companyId: ctx.companyId,
        $or: [
          ObjectId.isValid(projectId) && projectId.length === 24 ? { _id: new ObjectId(projectId) } : null,
          { _id: projectId },
        ].filter(Boolean),
      });
      if (legacy?.orgProjectId) {
        const project = await assertProjectAccess(db, ctx, String(legacy.orgProjectId), { requireActive: true });
        return { projectId: String(project._id || project.id), project };
      }
    } catch (_) {}
  }

  const err: any = new Error('Project not found or not authorized');
  err.status = 404;
  err.code = 'PROJECT_NOT_FOUND';
  throw err;
}

export async function listAccessibleGlobalProjects(db: any, ctx: ProjectAccessContext) {
  const query = filterProjectsForUser(ctx, { status: 'active' });
  // Also include inactive for org admins
  if (!ctx.requiresProjectAssignment) {
    delete query.status;
  }
  return db.collection('projects').find(query).sort({ createdAt: -1 }).toArray();
}

export function attachProjectContextMiddleware(getDb: () => any) {
  return async (req: any, _res: any, next: any) => {
    try {
      const db = getDb();
      req.projectContext = await resolveUserAndCompany(req, db);
      next();
    } catch (e) {
      next(e);
    }
  };
}

export { resolveUserAndCompany, assertProjectAccess };
