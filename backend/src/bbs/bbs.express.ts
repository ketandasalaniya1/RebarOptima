import { Router } from 'express';
import mongoose from 'mongoose';
import { BbsService } from './bbs.service';
import { BbsCalculationService } from './bbs-calculation.service';
import { ProjectSchema } from './schemas/project.schema';
import { BlockWingSchema } from './schemas/block-wing.schema';
import { LevelFloorSchema } from './schemas/level-floor.schema';
import { ShapeRegisterSchema } from './schemas/shape-register.schema';
import { ElementTemplateSchema } from './schemas/element-template.schema';
import { StructuralMemberSchema } from './schemas/structural-member.schema';
import { RebarItemSchema } from './schemas/rebar-item.schema';

export async function createBbsRouter() {
  const router = Router();

  // Ensure mongoose is connected
  if (mongoose.connection.readyState !== 1) {
    const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/rebar_optima';
    await mongoose.connect(uri);
    console.log('✅ Mongoose connected for BBS Module');
  }

  // Create models safely to avoid OverwriteModelError on hot reload
  const ProjectModel = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
  const BlockModel = mongoose.models.BlockWing || mongoose.model('BlockWing', BlockWingSchema);
  const LevelModel = mongoose.models.LevelFloor || mongoose.model('LevelFloor', LevelFloorSchema);
  const ShapeModel = mongoose.models.ShapeRegister || mongoose.model('ShapeRegister', ShapeRegisterSchema);
  const TemplateModel = mongoose.models.ElementTemplate || mongoose.model('ElementTemplate', ElementTemplateSchema);
  const MemberModel = mongoose.models.StructuralMember || mongoose.model('StructuralMember', StructuralMemberSchema);
  const RebarModel = mongoose.models.RebarItem || mongoose.model('RebarItem', RebarItemSchema);

  const calcService = new BbsCalculationService();
  const bbsService = new BbsService(
    ProjectModel as any,
    BlockModel as any,
    LevelModel as any,
    ShapeModel as any,
    TemplateModel as any,
    MemberModel as any,
    RebarModel as any,
    calcService
  );

  // Middleware to attach companyId since the JWT payload only has 'sub' (userId)
  router.use(async (req: any, res, next) => {
    try {
      if (!req.user || !req.user.sub) return res.status(401).json({ message: 'Unauthorized' });
      // Fetch user from DB to get their companyId
      const user = await mongoose.connection.db?.collection('users').findOne({ _id: new mongoose.Types.ObjectId(req.user.sub) });
      if (!user || !user.companyId) {
        return res.status(403).json({ message: 'User or company not found' });
      }
      req.user.companyId = user.companyId;
      next();
    } catch (e: any) {
      res.status(500).json({ message: 'Failed to resolve user company' });
    }
  });

  // Projects
  router.get('/test-update', (req, res) => res.json({ message: 'UPDATED SERVER' }));
  
  router.post('/projects', async (req: any, res) => {
    try {
      const result = await bbsService.createProject(req.user.companyId.toString(), req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/projects', async (req: any, res) => {
    try {
      const result = await bbsService.getProjects(req.user.companyId.toString());
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/projects/:projectId', async (req: any, res) => {
    try {
      const result = await bbsService.getProject(req.user.companyId.toString(), req.params.projectId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.put('/projects/:projectId', async (req: any, res) => {
    try {
      const result = await bbsService.updateProject(req.user.companyId.toString(), req.params.projectId, req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.delete('/projects/:projectId', async (req: any, res) => {
    try {
      const result = await bbsService.deleteProject(req.user.companyId.toString(), req.params.projectId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Blocks
  router.post('/projects/:projectId/blocks', async (req: any, res) => {
    try {
      const result = await bbsService.createBlock(req.params.projectId, req.body.name);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/projects/:projectId/blocks', async (req: any, res) => {
    try {
      console.log('API HIT: /projects/:projectId/blocks for', req.params.projectId);
      const result = await bbsService.getBlocks(req.params.projectId);
      console.log('API RESULT LENGTH:', result.length);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.put('/blocks/:blockId', async (req: any, res) => {
    try {
      const result = await bbsService.updateBlock(req.params.blockId, req.body.name);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.delete('/blocks/:blockId', async (req: any, res) => {
    try {
      const result = await bbsService.deleteBlock(req.params.blockId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Levels
  router.post('/projects/:projectId/blocks/:blockId/levels', async (req: any, res) => {
    try {
      const result = await bbsService.createLevel(req.params.projectId, req.params.blockId, req.body.name);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/projects/:projectId/levels', async (req: any, res) => {
    try {
      const result = await bbsService.getLevels(req.params.projectId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.put('/projects/:projectId/blocks/:blockId/levels/reorder', async (req: any, res) => {
    try {
      const result = await bbsService.reorderLevels(req.params.blockId, req.body.orderedLevelIds);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.put('/levels/:levelId', async (req: any, res) => {
    try {
      const result = await bbsService.updateLevel(req.params.levelId, req.body.name);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.delete('/levels/:levelId', async (req: any, res) => {
    try {
      const result = await bbsService.deleteLevel(req.params.levelId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Shapes
  router.post('/shapes', async (req: any, res) => {
    try {
      const result = await bbsService.createShape(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/shapes', async (req: any, res) => {
    try {
      const result = await bbsService.getShapes();
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Members
  router.post('/members', async (req: any, res) => {
    try {
      const result = await bbsService.createMember(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/projects/:projectId/members', async (req: any, res) => {
    try {
      const result = await bbsService.getMembers(req.params.projectId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/projects/:projectId/members/cell', async (req: any, res) => {
    try {
      const result = await bbsService.getMembersByCell(req.params.projectId, req.query.blockId, req.query.levelId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/members/:memberId', async (req: any, res) => {
    try {
      const result = await bbsService.getMember(req.params.memberId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.put('/members/:memberId', async (req: any, res) => {
    try {
      const result = await bbsService.updateMember(req.params.memberId, req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.delete('/members/:memberId', async (req: any, res) => {
    try {
      const result = await bbsService.deleteMember(req.params.memberId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Rebars
  router.post('/rebars', async (req: any, res) => {
    try {
      const result = await bbsService.addRebarItem(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/members/:memberId/rebars', async (req: any, res) => {
    try {
      const result = await bbsService.getRebarItems(req.params.memberId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.put('/rebars/:rebarId', async (req: any, res) => {
    try {
      const result = await bbsService.updateRebarItem(req.params.rebarId, req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.delete('/rebars/:rebarId', async (req: any, res) => {
    try {
      const result = await bbsService.deleteRebarItem(req.params.rebarId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Templates
  router.get('/templates', async (req: any, res) => {
    try {
      const result = await bbsService.getTemplates();
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.post('/templates', async (req: any, res) => {
    try {
      const result = await bbsService.createTemplate(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // MTO Report & Optimizer
  router.get('/projects/:projectId/rebars', async (req: any, res) => {
    try {
      const result = await bbsService.getProjectRebars(req.params.projectId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  router.get('/projects/:projectId/mto', async (req: any, res) => {
    try {
      const result = await bbsService.getMaterialTakeOff(req.params.projectId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Dashboard Matrix
  router.get('/projects/:projectId/matrix', async (req: any, res) => {
    try {
      const result = await bbsService.getDashboardMatrix(req.user.companyId.toString(), req.params.projectId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  return router;
}