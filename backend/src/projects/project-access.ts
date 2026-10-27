import { ObjectId } from 'mongodb';

export type ProjectAccessContext = {
  userId: string | null;
  companyId: string;
  role: string;
  roleNormalized: string;
  userDoc: any;
  assignedProjects: string[];
  dataScope: 'organization' | 'project' | 'own' | string;
  isCompanyAdmin: boolean;
  isPartnerAdmin: boolean;
  isDeveloper: boolean;
  requiresProjectAssignment: boolean;
};

export function normalizeRole(role: any): string {
  return String(role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export function isPartnerAdminRole(role: any): boolean {
  const n = normalizeRole(role);
  return n === 'PROJECT_PARTNER_ADMIN' || n === 'PROJECTPARTNERADMIN';
}

export function isCompanyAdminRole(role: any, accountType?: string): boolean {
  if (accountType === 'developer') return true;
  const n = normalizeRole(role);
  return n === 'ADMIN' || n === 'OWNER' || n === 'COMPANY_ADMIN';
}

export function idQuery(id: string) {
  if (ObjectId.isValid(String(id)) && String(id).length === 24) {
    return { $or: [{ _id: new ObjectId(String(id)) }, { _id: String(id) }] };
  }
  return { _id: String(id) };
}

export function projectIdQuery(projectId: string, companyId?: string) {
  const or: any[] = [
    ObjectId.isValid(projectId) && projectId.length === 24 ? { _id: new ObjectId(projectId) } : null,
    { _id: projectId },
    { id: projectId },
  ].filter(Boolean);
  const q: any = { $or: or };
  if (companyId) q.companyId = companyId;
  return q;
}

export function extractProjectId(req: any): string | null {
  const header = req.headers?.['x-project-id'] || req.headers?.['X-Project-Id'];
  if (header) return String(header);
  if (req.params?.projectId) return String(req.params.projectId);
  if (req.query?.projectId) return String(req.query.projectId);
  if (req.body?.projectId) return String(req.body.projectId);
  return null;
}

export async function resolveUserAndCompany(req: any, db: any): Promise<ProjectAccessContext> {
  let companyId = req.user?.companyId ? String(req.user.companyId) : null;
  let userDoc: any = null;
  const userId = req.user?.sub || req.user?._id;

  if (userId) {
    try {
      userDoc = await db.collection('users').findOne(idQuery(String(userId)));
      if (userDoc?.companyId) companyId = String(userDoc.companyId);
    } catch (err) {
      console.warn('resolveUserAndCompany error:', err);
    }
  }

  const roleRaw = userDoc?.role || req.user?.role || '';
  const roleNormalized = normalizeRole(roleRaw);
  const assignedProjects = (userDoc?.assignedProjects || req.user?.assignedProjects || []).map((id: any) =>
    String(id),
  );

  let dataScope = 'organization';
  if (userDoc?.roleId) {
    try {
      const roleDoc = await db.collection('roles').findOne(idQuery(String(userDoc.roleId)));
      if (roleDoc?.dataScope) dataScope = String(roleDoc.dataScope);
    } catch (_) {}
  }
  if (isPartnerAdminRole(roleRaw)) dataScope = 'project';

  const isDeveloper = req.user?.accountType === 'developer';
  const isCompanyAdmin = isCompanyAdminRole(roleRaw, req.user?.accountType);
  const isPartnerAdmin = isPartnerAdminRole(roleRaw);
  const requiresProjectAssignment =
    !isDeveloper && !isCompanyAdmin && (dataScope === 'project' || isPartnerAdmin);

  return {
    userId: userId ? String(userId) : null,
    companyId: companyId || 'default-company',
    role: String(roleRaw),
    roleNormalized,
    userDoc,
    assignedProjects,
    dataScope,
    isCompanyAdmin,
    isPartnerAdmin,
    isDeveloper,
    requiresProjectAssignment,
  };
}

export function userHasProjectAssignment(ctx: ProjectAccessContext, projectId: string): boolean {
  if (!ctx.requiresProjectAssignment) return true;
  const pid = String(projectId);
  return ctx.assignedProjects.includes(pid);
}

/**
 * Load project and assert company + assignment access.
 * Throws { status, message } on failure.
 */
export async function assertProjectAccess(
  db: any,
  ctx: ProjectAccessContext,
  projectId: string,
  opts: { requireActive?: boolean } = {},
): Promise<any> {
  if (!projectId) {
    const err: any = new Error('Project context is required');
    err.status = 400;
    err.code = 'PROJECT_REQUIRED';
    throw err;
  }

  const project = await db.collection('projects').findOne(projectIdQuery(String(projectId), ctx.companyId));
  if (!project) {
    const err: any = new Error('Project not found or not authorized for your company');
    err.status = 404;
    err.code = 'PROJECT_NOT_FOUND';
    throw err;
  }

  const pIdStr = String(project._id || project.id);
  if (!userHasProjectAssignment(ctx, pIdStr)) {
    const err: any = new Error('Access denied: You are not assigned to this project');
    err.status = 403;
    err.code = 'PROJECT_ACCESS_DENIED';
    throw err;
  }

  if (opts.requireActive !== false && project.status && project.status !== 'active') {
    // Allow inactive for admins managing lifecycle; deny for project-scoped operators on data reads
    if (ctx.requiresProjectAssignment) {
      const err: any = new Error('Project is inactive');
      err.status = 403;
      err.code = 'PROJECT_INACTIVE';
      throw err;
    }
  }

  return project;
}

/** Express middleware: attach req.projectContext and optionally require X-Project-Id */
export function createProjectAccessMiddleware(getDb: () => any, options: { required?: boolean } = {}) {
  const required = options.required !== false;
  return async (req: any, res: any, next: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      req.projectContext = ctx;

      const projectId = extractProjectId(req);
      if (!projectId) {
        if (required) {
          return res.status(400).json({ message: 'Project context is required (X-Project-Id)', code: 'PROJECT_REQUIRED' });
        }
        return next();
      }

      const project = await assertProjectAccess(db, ctx, projectId, { requireActive: true });
      req.activeProject = project;
      req.activeProjectId = String(project._id || project.id);
      next();
    } catch (e: any) {
      const status = e.status || 500;
      res.status(status).json({ message: e.message || 'Project access check failed', code: e.code });
    }
  };
}

export function filterProjectsForUser(ctx: ProjectAccessContext, baseQuery: any = {}) {
  const query: any = { ...baseQuery, companyId: ctx.companyId };
  if (ctx.requiresProjectAssignment) {
    query.status = query.status || 'active';
    const ids = ctx.assignedProjects;
    query.$or = [
      { _id: { $in: ids.filter((id) => ObjectId.isValid(id) && id.length === 24).map((id) => new ObjectId(id)) } },
      { id: { $in: ids } },
    ];
  }
  return query;
}
