import { Router } from 'express';
import { Db } from 'mongodb';
import { AiAssistantService } from './ai-assistant.service';
import { MockAIProvider } from './mock-ai.provider';
import { GeminiAIProvider } from './gemini-ai.provider';
import { ProjectDataGroundingService } from './project-data-grounding.service';
import { resolveUserAndCompany, projectIdQuery } from '../projects/project-access';

export function createAiAssistantRouter(
  getDb: () => any,
  authMiddleware: any,
  logAudit?: any
): Router {
  const router = Router();

  function getAiProvider() {
    const key = process.env.GEMINI_API_KEY;
    if (key && key.trim()) {
      return new GeminiAIProvider(key.trim());
    }
    return new MockAIProvider();
  }

  /**
   * Helper to resolve full user, company and project context
   */
  async function resolveContext(req: any, db: Db) {
    const accessCtx = await resolveUserAndCompany(req, db);
    const userId = accessCtx.userId || String(req.user?.sub || req.user?.id || req.user?._id || '');
    const companyId = accessCtx.companyId || 'default-company';
    const role = accessCtx.role || req.user?.role || 'User';
    const roleNormalized = accessCtx.roleNormalized || 'USER';

    let userName = req.user?.name || req.user?.username || req.user?.email || 'Team Member';
    if (accessCtx.userDoc) {
      const u = accessCtx.userDoc;
      userName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || userName;
    }

    let projectId = req.headers['x-project-id'] || req.query?.projectId || req.body?.projectId;
    if (!projectId || projectId === 'all' || projectId === 'null' || projectId === 'undefined') {
      projectId = accessCtx.assignedProjects?.[0] || 'default';
    }
    projectId = String(projectId);

    let projectName = 'Project Site';
    try {
      if (projectId && projectId !== 'default' && projectId !== 'all') {
        const proj = await db.collection('projects').findOne(projectIdQuery(projectId, companyId));
        if (proj && (proj.name || proj.projectName)) {
          projectName = proj.name || proj.projectName;
        }
      }
    } catch (_) {}

    return {
      userId,
      companyId,
      role,
      roleNormalized,
      userName,
      projectId,
      projectName,
      accessCtx,
    };
  }

  // 1. Get role-based suggested prompt cards
  router.get('/suggested-prompts', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const { roleNormalized } = await resolveContext(req, db);
      const prompts = MockAIProvider.getRolePrompts(roleNormalized);
      res.json({ success: true, data: prompts });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2. List user conversations
  router.get('/conversations', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new AiAssistantService(db, getAiProvider());
      const { userId, companyId, projectId } = await resolveContext(req, db);
      const conversations = await service.listConversations(companyId, userId, projectId);
      res.json({ success: true, data: conversations });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3. Create a new conversation session
  router.post('/conversations', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new AiAssistantService(db, getAiProvider());
      const { userId, companyId, projectId } = await resolveContext(req, db);
      const title = req.body?.title;
      const conversation = await service.createConversation(companyId, userId, projectId, title);
      res.json({ success: true, data: conversation });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. Get a specific conversation
  router.get('/conversations/:id', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new AiAssistantService(db, getAiProvider());
      const { userId, companyId } = await resolveContext(req, db);
      const conversation = await service.getConversation(req.params.id, companyId, userId);
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }
      res.json({ success: true, data: conversation });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. Get messages for a conversation
  router.get('/conversations/:id/messages', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new AiAssistantService(db, getAiProvider());
      const { userId, companyId } = await resolveContext(req, db);
      const messages = await service.getMessages(req.params.id, companyId, userId);
      res.json({ success: true, data: messages });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. Send a message with real database grounding
  router.post('/conversations/:id/messages', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new AiAssistantService(db, getAiProvider());
      const { userId, companyId, role, roleNormalized, userName, projectId, accessCtx } =
        await resolveContext(req, db);

      const prompt = req.body?.prompt || req.body?.content;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ success: false, message: 'Message prompt cannot be empty' });
      }

      // 1. Dynamically resolve target project (match prompt name or active project header)
      let resolvedProject: any = null;
      try {
        const targetRes = await ProjectDataGroundingService.resolveTargetProject(
          db,
          accessCtx,
          projectId,
          prompt
        );
        resolvedProject = targetRes.project;
      } catch (projErr: any) {
        return res.status(projErr.status || 403).json({
          success: false,
          code: projErr.code || 'PROJECT_ACCESS_DENIED',
          message: projErr.message || 'Access to requested project was denied or project does not exist.',
        });
      }

      // 2. Retrieve actual database records & compute deterministic metrics
      const groundedContext = await ProjectDataGroundingService.getGroundedContext(
        db,
        accessCtx,
        resolvedProject,
        prompt,
        req.user?.permissions
      );

      // 3. Generate response grounded strictly in database records
      const targetPid = String(resolvedProject._id || resolvedProject.id);
      const targetPname = resolvedProject.name || resolvedProject.projectName;

      const result = await service.sendMessage({
        conversationId: req.params.id,
        companyId,
        userId,
        userName,
        role,
        roleNormalized,
        projectId: targetPid,
        projectName: targetPname,
        prompt,
        userPermissions: req.user?.permissions,
        groundedContext,
        logAuditFn: logAudit,
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 7. Delete conversation
  router.delete('/conversations/:id', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new AiAssistantService(db, getAiProvider());
      const { userId, companyId } = await resolveContext(req, db);
      await service.deleteConversation(req.params.id, companyId, userId);
      res.json({ success: true, message: 'Conversation deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}
