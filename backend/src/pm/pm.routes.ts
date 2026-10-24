import { Router } from 'express';
import { Db } from 'mongodb';
import { PmService } from './pm.service';
import { seedSampleProjectData } from './pm.seed.service';

export function createPmMasterRouter(
  getDb: () => Db | null,
  authMiddleware: any,
  logAudit?: (db: Db, params: any) => Promise<any>
): Router {
  const router = Router();
  const pmService = new PmService(getDb);

  const getCompanyId = (req: any): string => {
    return req.user?.companyId || 'default-company';
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // SEED SAMPLE DATA
  // ══════════════════════════════════════════════════════════════════════════════
  router.post('/seed-sample-data', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ message: 'Database unavailable' });

      const companyId = getCompanyId(req);
      const result = await seedSampleProjectData(db, companyId, req.user?.email || 'admin@rebaroptima.com');

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: req.user?.accountType || 'user',
          companyId,
          module: 'projectManagement',
          action: 'SEED_SAMPLE_DATA',
          resource: 'pm_projects',
          resourceId: result.projectId,
          description: `Seeded sample project with ${result.taskCount} tasks and full CPM schedule.`
        });
      }

      res.json({
        success: true,
        message: 'Successfully seeded enterprise construction project with tasks, CPM schedule, and DPRs.',
        data: result
      });
    } catch (e: any) {
      console.error('PM seed error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // EXECUTIVE KPIS
  // ══════════════════════════════════════════════════════════════════════════════
  router.get('/dashboard-kpis', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const kpis = await pmService.getExecutiveKPIs(companyId);
      res.json({ success: true, data: kpis });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PROJECTS
  // ══════════════════════════════════════════════════════════════════════════════
  router.get('/projects', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const projects = await pmService.getProjects(companyId);
      res.json({ success: true, data: projects });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/projects', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const project = await pmService.createProject(companyId, req.body);
      res.status(201).json({ success: true, data: project });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/projects/:id', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const project = await pmService.getProjectById(companyId, req.params.id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
      res.json({ success: true, data: project });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.put('/projects/:id', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const updated = await pmService.updateProject(companyId, req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: 'Project not found' });
      res.json({ success: true, data: updated });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.post('/projects/:id/lock-baseline', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const updated = await pmService.lockBaseline(companyId, req.params.id, req.user?.email || 'admin');
      res.json({ success: true, message: 'Approved baseline locked successfully', data: updated });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // TASKS
  // ══════════════════════════════════════════════════════════════════════════════
  router.get('/projects/:id/tasks', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const tasks = await pmService.getTasks(companyId, req.params.id);
      res.json({ success: true, data: tasks });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/projects/:id/tasks', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const task = await pmService.createTask(companyId, req.params.id, req.body);
      res.status(201).json({ success: true, data: task });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.put('/tasks/:id', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const updated = await pmService.updateTask(companyId, req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: 'Task not found' });
      res.json({ success: true, data: updated });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.delete('/tasks/:id', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const success = await pmService.deleteTask(companyId, req.params.id);
      res.json({ success });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // DEPENDENCIES
  // ══════════════════════════════════════════════════════════════════════════════
  router.get('/projects/:id/dependencies', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const deps = await pmService.getDependencies(companyId, req.params.id);
      res.json({ success: true, data: deps });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/projects/:id/dependencies', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const dep = await pmService.createDependency(companyId, req.params.id, req.body);
      res.status(201).json({ success: true, data: dep });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.delete('/dependencies/:id', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const success = await pmService.deleteDependency(companyId, req.params.id);
      res.json({ success });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // DELAY SIMULATION & RESCHEDULING
  // ══════════════════════════════════════════════════════════════════════════════
  router.post('/projects/:id/delay-preview', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { taskId, delayDays } = req.body;
      if (!taskId || !delayDays) {
        return res.status(400).json({ message: 'taskId and delayDays are required' });
      }

      const simulation = await pmService.previewDelaySimulation(companyId, req.params.id, taskId, Number(delayDays));
      res.json({ success: true, data: simulation });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.post('/projects/:id/record-delay', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { taskId, delayDays, category, reason, recoveryAction, delayStartDate } = req.body;
      if (!taskId || !delayDays || !reason) {
        return res.status(400).json({ message: 'taskId, delayDays, and reason are required' });
      }

      const result = await pmService.recordDelayAndReschedule(companyId, req.params.id, {
        taskId,
        delayDays: Number(delayDays),
        category,
        reason,
        delayStartDate,
        recoveryAction,
        recordedBy: req.user?.email || 'User'
      });

      const db = getDb();
      if (db && logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: req.user?.accountType || 'user',
          companyId,
          module: 'projectManagement',
          action: 'RECORD_DELAY',
          resource: 'pm_delays',
          resourceId: String(result.delayRecord._id),
          description: `Recorded delay of ${delayDays} days on task. Schedule slipped by ${result.simulation.projectDelayDays} days.`
        });
      }

      res.json({ success: true, message: 'Delay recorded and schedule rescheduled', data: result });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/projects/:id/delays', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const delays = await pmService.getDelayRecords(companyId, req.params.id);
      res.json({ success: true, data: delays });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // DAILY PROGRESS REPORTS (DPR)
  // ══════════════════════════════════════════════════════════════════════════════
  router.get('/projects/:id/dpr', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const dprs = await pmService.getDprList(companyId, req.params.id);
      res.json({ success: true, data: dprs });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/projects/:id/dpr', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const dpr = await pmService.submitDpr(companyId, req.params.id, req.body);
      res.status(201).json({ success: true, data: dpr });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.put('/dpr/:id/approve', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const approved = await pmService.approveDpr(companyId, req.params.id, req.user?.email || 'Approver');
      if (!approved) return res.status(404).json({ message: 'DPR not found' });
      res.json({ success: true, message: 'DPR approved and task progress updated', data: approved });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // QUALITY INSPECTIONS
  // ══════════════════════════════════════════════════════════════════════════════
  router.get('/projects/:id/inspections', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const list = await pmService.getInspections(companyId, req.params.id);
      res.json({ success: true, data: list });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/projects/:id/inspections', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const inspection = await pmService.recordInspection(companyId, req.params.id, req.body);
      res.status(201).json({ success: true, data: inspection });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // COSTS & BUDGET
  // ══════════════════════════════════════════════════════════════════════════════
  router.get('/projects/:id/costs', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const list = await pmService.getCosts(companyId, req.params.id);
      res.json({ success: true, data: list });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/projects/:id/costs', authMiddleware, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const cost = await pmService.addCostEntry(companyId, req.params.id, req.body);
      res.status(201).json({ success: true, data: cost });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  return router;
}
