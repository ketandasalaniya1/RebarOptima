import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  CASTING_MEMBER_TYPES,
  ICastingProject,
  ICastingBlock,
  ICastingLevel,
  ICastingMember,
  ICastingEvent,
  IMaterialRequirementSheetRevision,
  ICastingRecipe
} from './casting.types';
import { createCastingRecipeRouter } from './casting.recipe.routes';
import { createCastingConsumptionRouter } from './casting.consumption.routes';
import { createCastingStockRouter } from './casting.stock.routes';
import { createCastingQualityRouter } from './casting.quality.routes';
import { createCastingTimelineRouter } from './casting.timeline.routes';
import {
  calculateSegmentMaterials,
  calculateGradeSubtotals,
  consolidateIngredients,
  checkInventoryAvailability
} from './casting.calculation.service';

export function createCastingRouter(
  getDb: () => any,
  getClientOrAuth: any,
  authMiddlewareOrLog?: any,
  logAuditOrNone?: any
) {
  const router = Router();

  // Normalize arguments for backward compatibility
  let getClient: () => any;
  let authMiddleware: any;
  let logAudit: any;

  if (typeof getClientOrAuth === 'function' && typeof authMiddlewareOrLog === 'function') {
    getClient = getClientOrAuth;
    authMiddleware = authMiddlewareOrLog;
    logAudit = logAuditOrNone;
  } else {
    getClient = () => null;
    authMiddleware = getClientOrAuth;
    logAudit = authMiddlewareOrLog;
  }

  // Mount Recipe Management Router (Phase 2)
  router.use('/recipes', createCastingRecipeRouter(getDb, authMiddleware, logAudit));

  // Mount Consumption & Actuals Router (Phase 3)
  router.use('/', createCastingConsumptionRouter(getDb, getClient, authMiddleware, logAudit));

  // Mount Project Stock & Ledger Router (Phase 3)
  router.use('/', createCastingStockRouter(getDb, getClient, authMiddleware, logAudit));

  // Mount Quality Management Router (Phase 4: Curing, Cubes, Track Sheet)
  router.use('/', createCastingQualityRouter(getDb, getClient, authMiddleware, logAudit));

  // Mount Visual Planning & Casting Timeline Router (Phase 5)
  router.use('/', createCastingTimelineRouter(getDb, authMiddleware, logAudit));

  // Helper to resolve companyId from authenticated user
  const resolveCompanyId = async (req: any, db: any): Promise<string> => {
    if (req.user?.companyId) return String(req.user.companyId);
    const userId = req.user?.sub;
    if (userId) {
      try {
        const u = await db.collection('users').findOne({
          $or: [{ _id: new ObjectId(userId) }, { _id: userId }]
        });
        if (u && u.companyId) return String(u.companyId);
      } catch {}
    }
    return req.user?.companyId || 'default-company';
  };

  const toObjId = (id: any) => {
    if (!id) return null;
    if (id instanceof ObjectId) return id;
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    }
    return null;
  };

  const idQuery = (id: any) => {
    const objId = toObjId(id);
    return objId ? { $or: [{ _id: objId }, { _id: String(id) }] } : { _id: String(id) };
  };

  // Helper to recalculate member cumulative poured & remaining volume
  const recalculateMemberCumulativeVolume = async (db: any, companyId: string, memberId: string) => {
    const memberObjId = toObjId(memberId);
    const mQuery = memberObjId ? { $or: [{ _id: memberObjId }, { _id: String(memberId) }], companyId } : { _id: String(memberId), companyId };
    const member = await db.collection('casting_members').findOne(mQuery);
    if (!member) return;

    // Find all active (non-deleted) casting events that contain a segment for this member with status POURED
    const events = await db.collection('casting_events').find({
      companyId,
      isDeleted: { $ne: true },
      'segments.memberId': String(memberId),
      status: { $in: ['POURED', 'COMPLETED'] }
    }).toArray();

    let totalActualPoured = 0;
    events.forEach((evt: any) => {
      (evt.segments || []).forEach((seg: any) => {
        if (String(seg.memberId) === String(memberId) && seg.status === 'POURED' && typeof seg.actualVolumeM3 === 'number') {
          totalActualPoured += Number(seg.actualVolumeM3);
        }
      });
    });

    totalActualPoured = Math.round(totalActualPoured * 1000) / 1000;
    const totalRequired = Number(member.totalRequiredVolumeM3) || 0;
    const remaining = Math.max(0, Math.round((totalRequired - totalActualPoured) * 1000) / 1000);

    let status: any = member.status || 'Planned';
    if (totalActualPoured >= totalRequired && totalRequired > 0) {
      status = 'Completed';
    } else if (totalActualPoured > 0) {
      status = 'Partially_Poured';
    } else if (member.status === 'Partially_Poured' || member.status === 'Completed') {
      status = 'Planned';
    }

    await db.collection('casting_members').updateOne(mQuery, {
      $set: {
        actualPouredM3: totalActualPoured,
        remainingVolumeM3: remaining,
        status,
        updatedAt: new Date()
      }
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 1. MEMBER TYPES LOOKUP
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/member-types', authMiddleware, (_req: any, res: any) => {
    res.json(CASTING_MEMBER_TYPES);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. CASTING PROJECTS
  // ════════════════════════════════════════════════════════════════════════════

  // GET all projects with aggregated metrics
  router.get('/projects', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const projects = await db.collection('casting_projects')
        .find({ companyId, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .toArray();

      const enriched = await Promise.all(
        projects.map(async (p: any) => {
          const pId = p._id.toString();
          const [blocks, levels, members, events] = await Promise.all([
            db.collection('casting_blocks').find({ projectId: pId, isDeleted: { $ne: true } }).toArray(),
            db.collection('casting_levels').find({ projectId: pId, isDeleted: { $ne: true } }).toArray(),
            db.collection('casting_members').find({ projectId: pId, isDeleted: { $ne: true } }).toArray(),
            db.collection('casting_events').find({ projectId: pId, isDeleted: { $ne: true } }).toArray()
          ]);

          const totalRequiredVolumeM3 = members.reduce((sum: number, m: any) => sum + (Number(m.totalRequiredVolumeM3) || 0), 0);
          const totalPouredVolumeM3 = members.reduce((sum: number, m: any) => sum + (Number(m.actualPouredM3) || 0), 0);

          return {
            ...p,
            id: p._id.toString(),
            blockCount: blocks.length,
            levelCount: levels.length,
            memberCount: members.length,
            eventCount: events.length,
            totalRequiredVolumeM3: Math.round(totalRequiredVolumeM3 * 1000) / 1000,
            totalPouredVolumeM3: Math.round(totalPouredVolumeM3 * 1000) / 1000
          };
        })
      );

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching casting projects' });
    }
  });

  // GET single project
  router.get('/projects/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const project = await db.collection('casting_projects').findOne({
        ...idQuery(req.params.id),
        companyId,
        isDeleted: { $ne: true }
      });

      if (!project) return res.status(404).json({ message: 'Casting Project not found' });
      res.json({ ...project, id: project._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching casting project' });
    }
  });

  // POST create project
  router.post('/projects', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { name, code, location, clientName, contractorName, status } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Project Name is required' });
      }

      const projCode = (code || `PRJ-C-${Date.now().toString().slice(-4)}`).trim().toUpperCase();

      // Check unique code per company
      const existing = await db.collection('casting_projects').findOne({
        companyId,
        code: projCode,
        isDeleted: { $ne: true }
      });
      if (existing) {
        return res.status(409).json({ message: `Project code '${projCode}' is already in use` });
      }

      const now = new Date();
      const newProj: ICastingProject = {
        companyId,
        name: name.trim(),
        code: projCode,
        location: location ? location.trim() : '',
        clientName: clientName ? clientName.trim() : '',
        contractorName: contractorName ? contractorName.trim() : '',
        status: status || 'Active',
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('casting_projects').insertOne(newProj);
      const created = await db.collection('casting_projects').findOne({ _id: result.insertedId });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CASTING_PROJECT_CREATED',
          resource: 'casting_projects',
          resourceId: result.insertedId.toString(),
          description: `Created casting project '${newProj.name}' (${projCode})`,
          newValue: newProj
        });
      }

      res.status(201).json({ ...created, id: created._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating casting project' });
    }
  });

  // PUT update project
  router.put('/projects/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;
      const { name, location, clientName, contractorName, status } = req.body;

      const existing = await db.collection('casting_projects').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!existing) return res.status(404).json({ message: 'Project not found' });

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (location !== undefined) updateData.location = location.trim();
      if (clientName !== undefined) updateData.clientName = clientName.trim();
      if (contractorName !== undefined) updateData.contractorName = contractorName.trim();
      if (status !== undefined) updateData.status = status;

      await db.collection('casting_projects').updateOne({ _id: existing._id }, { $set: updateData });
      const updated = await db.collection('casting_projects').findOne({ _id: existing._id });

      res.json({ ...updated, id: updated._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating casting project' });
    }
  });

  // DELETE project (Soft Delete with safety guard)
  router.delete('/projects/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;
      const { reason } = req.body || {};

      const project = await db.collection('casting_projects').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!project) return res.status(404).json({ message: 'Project not found' });

      const pId = project._id.toString();

      // Guard: Check if any active casting events exist
      const activeEventsCount = await db.collection('casting_events').countDocuments({
        companyId,
        projectId: pId,
        isDeleted: { $ne: true }
      });

      if (activeEventsCount > 0) {
        return res.status(409).json({
          message: `Cannot delete project: ${activeEventsCount} active casting event(s) reference this project. Cancel or remove events first.`
        });
      }

      const now = new Date();
      const deletedBy = req.user.email || req.user.sub;

      // Soft delete project and cascade soft delete to child blocks, levels, members
      await Promise.all([
        db.collection('casting_projects').updateOne({ _id: project._id }, {
          $set: { isDeleted: true, deletedAt: now, deletedBy, deletionReason: reason || 'Deleted by user' }
        }),
        db.collection('casting_blocks').updateMany({ projectId: pId }, {
          $set: { isDeleted: true, deletedAt: now, deletedBy }
        }),
        db.collection('casting_levels').updateMany({ projectId: pId }, {
          $set: { isDeleted: true, deletedAt: now, deletedBy }
        }),
        db.collection('casting_members').updateMany({ projectId: pId }, {
          $set: { isDeleted: true, deletedAt: now, deletedBy }
        })
      ]);

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CASTING_PROJECT_SOFT_DELETED',
          resource: 'casting_projects',
          resourceId: pId,
          description: `Soft-deleted casting project '${project.name}'`
        });
      }

      res.json({ success: true, message: 'Casting project soft-deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting casting project' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. CASTING BLOCKS
  // ════════════════════════════════════════════════════════════════════════════

  // GET blocks for project
  router.get('/projects/:projectId/blocks', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const projectId = req.params.projectId;

      const blocks = await db.collection('casting_blocks')
        .find({ companyId, projectId, isDeleted: { $ne: true } })
        .sort({ displayOrder: 1, createdAt: 1 })
        .toArray();

      const enriched = await Promise.all(
        blocks.map(async (b: any) => {
          const bId = b._id.toString();
          const [levels, members] = await Promise.all([
            db.collection('casting_levels').find({ blockId: bId, isDeleted: { $ne: true } }).toArray(),
            db.collection('casting_members').find({ blockId: bId, isDeleted: { $ne: true } }).toArray()
          ]);
          return {
            ...b,
            id: b._id.toString(),
            levelCount: levels.length,
            memberCount: members.length
          };
        })
      );

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching casting blocks' });
    }
  });

  // POST create block
  router.post('/projects/:projectId/blocks', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const projectId = req.params.projectId;
      const { name, code, description } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Block Name is required' });
      }

      // Verify project exists and belongs to company
      const project = await db.collection('casting_projects').findOne({
        ...idQuery(projectId),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!project) return res.status(404).json({ message: 'Project not found' });

      const blockCode = (code || `BLK-${Date.now().toString().slice(-3)}`).trim().toUpperCase();
      const count = await db.collection('casting_blocks').countDocuments({ projectId, isDeleted: { $ne: true } });

      const now = new Date();
      const newBlock: ICastingBlock = {
        companyId,
        projectId: project._id.toString(),
        name: name.trim(),
        code: blockCode,
        description: description ? description.trim() : '',
        displayOrder: count + 1,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('casting_blocks').insertOne(newBlock);
      const created = await db.collection('casting_blocks').findOne({ _id: result.insertedId });
      res.status(201).json({ ...created, id: created._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating casting block' });
    }
  });

  // PUT update block
  router.put('/blocks/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;
      const { name, code, description, displayOrder } = req.body;

      const block = await db.collection('casting_blocks').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!block) return res.status(404).json({ message: 'Block not found' });

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (code !== undefined) updateData.code = code.trim().toUpperCase();
      if (description !== undefined) updateData.description = description.trim();
      if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);

      await db.collection('casting_blocks').updateOne({ _id: block._id }, { $set: updateData });
      const updated = await db.collection('casting_blocks').findOne({ _id: block._id });
      res.json({ ...updated, id: updated._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating casting block' });
    }
  });

  // DELETE block (Soft delete with safety guard)
  router.delete('/blocks/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;

      const block = await db.collection('casting_blocks').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!block) return res.status(404).json({ message: 'Block not found' });

      const bId = block._id.toString();

      // Guard: Check if active events reference members in this block
      const activeEventsCount = await db.collection('casting_events').countDocuments({
        companyId,
        'segments.blockId': bId,
        isDeleted: { $ne: true }
      });

      if (activeEventsCount > 0) {
        return res.status(409).json({
          message: `Cannot delete block: referenced in ${activeEventsCount} active casting event(s).`
        });
      }

      const now = new Date();
      const deletedBy = req.user.email || req.user.sub;

      await Promise.all([
        db.collection('casting_blocks').updateOne({ _id: block._id }, {
          $set: { isDeleted: true, deletedAt: now, deletedBy }
        }),
        db.collection('casting_levels').updateMany({ blockId: bId }, {
          $set: { isDeleted: true, deletedAt: now, deletedBy }
        }),
        db.collection('casting_members').updateMany({ blockId: bId }, {
          $set: { isDeleted: true, deletedAt: now, deletedBy }
        })
      ]);

      res.json({ success: true, message: 'Block soft-deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting casting block' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. CASTING LEVELS / FLOORS
  // ════════════════════════════════════════════════════════════════════════════

  // GET levels for block
  router.get('/blocks/:blockId/levels', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const blockId = req.params.blockId;

      const levels = await db.collection('casting_levels')
        .find({ companyId, blockId, isDeleted: { $ne: true } })
        .sort({ displayOrder: 1, floorNumber: 1, createdAt: 1 })
        .toArray();

      const enriched = await Promise.all(
        levels.map(async (l: any) => {
          const lId = l._id.toString();
          const members = await db.collection('casting_members').find({ levelId: lId, isDeleted: { $ne: true } }).toArray();
          return {
            ...l,
            id: l._id.toString(),
            memberCount: members.length
          };
        })
      );

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching levels' });
    }
  });

  // POST create level
  router.post('/blocks/:blockId/levels', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const blockId = req.params.blockId;
      const { projectId, name, floorNumber, displayOrder } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Level Name is required' });
      }

      // Verify block exists and get projectId
      const block = await db.collection('casting_blocks').findOne({
        ...idQuery(blockId),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!block) return res.status(404).json({ message: 'Block not found' });

      const targetProjectId = projectId || block.projectId;
      const count = await db.collection('casting_levels').countDocuments({ blockId, isDeleted: { $ne: true } });

      const now = new Date();
      const newLevel: ICastingLevel = {
        companyId,
        projectId: targetProjectId,
        blockId: block._id.toString(),
        name: name.trim(),
        floorNumber: floorNumber !== undefined ? Number(floorNumber) : count,
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : count + 1,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('casting_levels').insertOne(newLevel);
      const created = await db.collection('casting_levels').findOne({ _id: result.insertedId });
      res.status(201).json({ ...created, id: created._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating casting level' });
    }
  });

  // PUT update level
  router.put('/levels/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;
      const { name, floorNumber, displayOrder } = req.body;

      const level = await db.collection('casting_levels').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!level) return res.status(404).json({ message: 'Level not found' });

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (floorNumber !== undefined) updateData.floorNumber = Number(floorNumber);
      if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);

      await db.collection('casting_levels').updateOne({ _id: level._id }, { $set: updateData });
      const updated = await db.collection('casting_levels').findOne({ _id: level._id });
      res.json({ ...updated, id: updated._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating casting level' });
    }
  });

  // DELETE level (Soft delete with safety guard)
  router.delete('/levels/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;

      const level = await db.collection('casting_levels').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!level) return res.status(404).json({ message: 'Level not found' });

      const lId = level._id.toString();

      // Guard: Check if active events reference members in this level
      const activeEventsCount = await db.collection('casting_events').countDocuments({
        companyId,
        'segments.levelId': lId,
        isDeleted: { $ne: true }
      });

      if (activeEventsCount > 0) {
        return res.status(409).json({
          message: `Cannot delete level: referenced in ${activeEventsCount} active casting event(s).`
        });
      }

      const now = new Date();
      const deletedBy = req.user.email || req.user.sub;

      await Promise.all([
        db.collection('casting_levels').updateOne({ _id: level._id }, {
          $set: { isDeleted: true, deletedAt: now, deletedBy }
        }),
        db.collection('casting_members').updateMany({ levelId: lId }, {
          $set: { isDeleted: true, deletedAt: now, deletedBy }
        })
      ]);

      res.json({ success: true, message: 'Level soft-deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting casting level' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. CASTING STRUCTURAL MEMBERS
  // ════════════════════════════════════════════════════════════════════════════

  // GET all members for a level
  router.get('/levels/:levelId/members', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const levelId = req.params.levelId;

      const rawMembers = await db.collection('casting_members')
        .find({ companyId, levelId, isDeleted: { $ne: true } })
        .toArray();

      const members = rawMembers
        .map((m: any) => ({ ...m, id: m._id.toString() }))
        .sort((a: any, b: any) =>
          (a.displayId || '').localeCompare(b.displayId || '', undefined, { numeric: true, sensitivity: 'base' })
        );

      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching members' });
    }
  });

  // GET all members for a project (useful helper for multi-block event creation)
  router.get('/projects/:projectId/all-members', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const projectId = req.params.projectId;

      const [members, blocks, levels] = await Promise.all([
        db.collection('casting_members').find({ companyId, projectId, isDeleted: { $ne: true } }).toArray(),
        db.collection('casting_blocks').find({ companyId, projectId, isDeleted: { $ne: true } }).toArray(),
        db.collection('casting_levels').find({ companyId, projectId, isDeleted: { $ne: true } }).toArray()
      ]);

      const blockMap = new Map(blocks.map((b: any) => [b._id.toString(), b.name]));
      const levelMap = new Map(levels.map((l: any) => [l._id.toString(), l.name]));

      const enriched = members.map((m: any) => ({
        ...m,
        id: m._id.toString(),
        blockName: blockMap.get(String(m.blockId)) || 'Unknown Block',
        levelName: levelMap.get(String(m.levelId)) || 'Unknown Level'
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching project members' });
    }
  });

  // POST create a single member
  router.post('/levels/:levelId/members', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const levelId = req.params.levelId;
      const {
        projectId,
        blockId,
        memberType,
        displayId,
        description,
        volumeEntryMethod,
        dimensions,
        basisOfCalculation,
        totalRequiredVolumeM3
      } = req.body;

      if (!memberType || !CASTING_MEMBER_TYPES.includes(memberType)) {
        return res.status(400).json({ message: `Valid memberType is required (${CASTING_MEMBER_TYPES.join(', ')})` });
      }

      if (!displayId || !displayId.trim()) {
        return res.status(400).json({ message: 'Member Display ID (e.g. C1, B1, SL-1) is required' });
      }

      const level = await db.collection('casting_levels').findOne({
        ...idQuery(levelId),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!level) return res.status(404).json({ message: 'Level not found' });

      const targetProjectId = projectId || level.projectId;
      const targetBlockId = blockId || level.blockId;
      const mark = displayId.trim().toUpperCase();

      // Check unique mark per level
      const existing = await db.collection('casting_members').findOne({
        companyId,
        levelId,
        displayId: mark,
        isDeleted: { $ne: true }
      });
      if (existing) {
        return res.status(409).json({ message: `Member with mark '${mark}' already exists in this level` });
      }

      // Volume calculation engine
      let finalVolumeM3 = 0;
      let finalDimensions: any = null;
      let finalBasis = '';

      if (volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY') {
        const val = Number(totalRequiredVolumeM3);
        if (isNaN(val) || val <= 0) {
          return res.status(400).json({ message: 'Valid positive volume (m³) is required for direct entry' });
        }
        if (!basisOfCalculation || basisOfCalculation.trim().length < 5) {
          return res.status(400).json({ message: 'Mandatory basis of calculation is required (minimum 5 chars) for direct engineer volume entry' });
        }
        finalVolumeM3 = Math.round(val * 1000) / 1000;
        finalBasis = basisOfCalculation.trim();
      } else {
        // DIMENSIONAL_CALC
        if (!dimensions || !dimensions.lengthMm || !dimensions.widthMm || !dimensions.depthMm) {
          return res.status(400).json({ message: 'Length, Width, and Depth (in mm) are required for dimensional volume calculation' });
        }
        const L = Number(dimensions.lengthMm);
        const W = Number(dimensions.widthMm);
        const D = Number(dimensions.depthMm);
        if (L <= 0 || W <= 0 || D <= 0) {
          return res.status(400).json({ message: 'Dimensions must be positive numbers in mm' });
        }
        finalVolumeM3 = Math.round(((L * W * D) / 1e9) * 1000) / 1000;
        finalDimensions = { lengthMm: L, widthMm: W, depthMm: D };
        finalBasis = `(L: ${L}mm × W: ${W}mm × D: ${D}mm) / 1,000,000,000`;
      }

      const now = new Date();
      const newMember: ICastingMember = {
        companyId,
        projectId: targetProjectId,
        blockId: targetBlockId,
        levelId,
        memberType,
        displayId: mark,
        description: description ? description.trim() : '',
        volumeEntryMethod: volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY' ? 'DIRECT_ENGINEER_ENTRY' : 'DIMENSIONAL_CALC',
        dimensions: finalDimensions,
        basisOfCalculation: finalBasis,
        totalRequiredVolumeM3: finalVolumeM3,
        actualPouredM3: 0,
        remainingVolumeM3: finalVolumeM3,
        status: 'Planned',
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('casting_members').insertOne(newMember);
      const created = await db.collection('casting_members').findOne({ _id: result.insertedId });
      res.status(201).json({ ...created, id: created._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating casting member' });
    }
  });

  // POST batch create members in series (e.g. C1 to C12)
  router.post('/levels/:levelId/members/batch', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const levelId = req.params.levelId;
      const {
        projectId,
        blockId,
        memberType,
        displayIds,
        description,
        volumeEntryMethod,
        dimensions,
        basisOfCalculation,
        totalRequiredVolumeM3
      } = req.body;

      if (!memberType || !CASTING_MEMBER_TYPES.includes(memberType)) {
        return res.status(400).json({ message: `Valid memberType is required (${CASTING_MEMBER_TYPES.join(', ')})` });
      }

      if (!Array.isArray(displayIds) || displayIds.length === 0) {
        return res.status(400).json({ message: 'displayIds array is required' });
      }

      const level = await db.collection('casting_levels').findOne({
        ...idQuery(levelId),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!level) return res.status(404).json({ message: 'Level not found' });

      const targetProjectId = projectId || level.projectId;
      const targetBlockId = blockId || level.blockId;

      // Volume calculation engine
      let finalVolumeM3 = 0;
      let finalDimensions: any = null;
      let finalBasis = '';

      if (volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY') {
        const val = Number(totalRequiredVolumeM3);
        if (isNaN(val) || val <= 0) {
          return res.status(400).json({ message: 'Valid positive volume is required for direct entry' });
        }
        if (!basisOfCalculation || basisOfCalculation.trim().length < 5) {
          return res.status(400).json({ message: 'Basis of calculation is required for direct entry' });
        }
        finalVolumeM3 = Math.round(val * 1000) / 1000;
        finalBasis = basisOfCalculation.trim();
      } else {
        if (!dimensions || !dimensions.lengthMm || !dimensions.widthMm || !dimensions.depthMm) {
          return res.status(400).json({ message: 'Length, Width, and Depth (mm) are required' });
        }
        const L = Number(dimensions.lengthMm);
        const W = Number(dimensions.widthMm);
        const D = Number(dimensions.depthMm);
        finalVolumeM3 = Math.round(((L * W * D) / 1e9) * 1000) / 1000;
        finalDimensions = { lengthMm: L, widthMm: W, depthMm: D };
        finalBasis = `(L: ${L}mm × W: ${W}mm × D: ${D}mm) / 1,000,000,000`;
      }

      // Check existing marks in this level
      const existingMembers = await db.collection('casting_members').find({
        companyId,
        levelId,
        isDeleted: { $ne: true }
      }).toArray();
      const existingMarkSet = new Set(existingMembers.map((m: any) => String(m.displayId).toUpperCase()));

      const now = new Date();
      const newDocs: any[] = [];
      const duplicates: string[] = [];

      displayIds.forEach((rawMark: string) => {
        const mark = String(rawMark || '').trim().toUpperCase();
        if (!mark) return;
        if (existingMarkSet.has(mark)) {
          duplicates.push(mark);
        } else {
          existingMarkSet.add(mark);
          newDocs.push({
            companyId,
            projectId: targetProjectId,
            blockId: targetBlockId,
            levelId,
            memberType,
            displayId: mark,
            description: description ? description.trim() : '',
            volumeEntryMethod: volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY' ? 'DIRECT_ENGINEER_ENTRY' : 'DIMENSIONAL_CALC',
            dimensions: finalDimensions,
            basisOfCalculation: finalBasis,
            totalRequiredVolumeM3: finalVolumeM3,
            actualPouredM3: 0,
            remainingVolumeM3: finalVolumeM3,
            status: 'Planned',
            isDeleted: false,
            createdAt: now,
            updatedAt: now
          });
        }
      });

      if (newDocs.length === 0) {
        return res.status(400).json({
          message: `No new members added. ${duplicates.length > 0 ? `Duplicates skipped: ${duplicates.join(', ')}` : ''}`
        });
      }

      await db.collection('casting_members').insertMany(newDocs);

      const allMembers = await db.collection('casting_members')
        .find({ companyId, levelId, isDeleted: { $ne: true } })
        .toArray();

      res.status(201).json({
        createdCount: newDocs.length,
        skippedDuplicates: duplicates,
        members: allMembers.map((m: any) => ({ ...m, id: m._id.toString() }))
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating members in batch' });
    }
  });

  // PUT update a member
  router.put('/members/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;
      const {
        memberType,
        displayId,
        description,
        volumeEntryMethod,
        dimensions,
        basisOfCalculation,
        totalRequiredVolumeM3,
        status
      } = req.body;

      const member = await db.collection('casting_members').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!member) return res.status(404).json({ message: 'Member not found' });

      const updateData: any = { updatedAt: new Date() };
      if (memberType !== undefined && CASTING_MEMBER_TYPES.includes(memberType)) {
        updateData.memberType = memberType;
      }
      if (displayId !== undefined) updateData.displayId = displayId.trim().toUpperCase();
      if (description !== undefined) updateData.description = description.trim();
      if (status !== undefined) updateData.status = status;

      if (volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY' || (volumeEntryMethod === undefined && member.volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY')) {
        if (totalRequiredVolumeM3 !== undefined) {
          const val = Number(totalRequiredVolumeM3);
          updateData.totalRequiredVolumeM3 = Math.round(val * 1000) / 1000;
          updateData.volumeEntryMethod = 'DIRECT_ENGINEER_ENTRY';
          updateData.remainingVolumeM3 = Math.max(0, Math.round((updateData.totalRequiredVolumeM3 - (member.actualPouredM3 || 0)) * 1000) / 1000);
        }
        if (basisOfCalculation !== undefined) updateData.basisOfCalculation = basisOfCalculation.trim();
      } else if (volumeEntryMethod === 'DIMENSIONAL_CALC' || dimensions !== undefined) {
        const dims = dimensions || member.dimensions;
        if (dims && dims.lengthMm && dims.widthMm && dims.depthMm) {
          const L = Number(dims.lengthMm);
          const W = Number(dims.widthMm);
          const D = Number(dims.depthMm);
          const vol = Math.round(((L * W * D) / 1e9) * 1000) / 1000;
          updateData.volumeEntryMethod = 'DIMENSIONAL_CALC';
          updateData.dimensions = { lengthMm: L, widthMm: W, depthMm: D };
          updateData.totalRequiredVolumeM3 = vol;
          updateData.basisOfCalculation = `(L: ${L}mm × W: ${W}mm × D: ${D}mm) / 1,000,000,000`;
          updateData.remainingVolumeM3 = Math.max(0, Math.round((vol - (member.actualPouredM3 || 0)) * 1000) / 1000);
        }
      }

      await db.collection('casting_members').updateOne({ _id: member._id }, { $set: updateData });
      const updated = await db.collection('casting_members').findOne({ _id: member._id });
      res.json({ ...updated, id: updated._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating casting member' });
    }
  });

  // DELETE a member (Soft delete with reference guard)
  router.delete('/members/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;

      const member = await db.collection('casting_members').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!member) return res.status(404).json({ message: 'Member not found' });

      const mId = member._id.toString();

      // Guard: Check if referenced in any active/historical casting event segments
      const activeEventsCount = await db.collection('casting_events').countDocuments({
        companyId,
        'segments.memberId': mId,
        isDeleted: { $ne: true }
      });

      if (activeEventsCount > 0) {
        return res.status(409).json({
          message: `Cannot delete member '${member.displayId}': referenced in ${activeEventsCount} casting event(s).`
        });
      }

      const now = new Date();
      const deletedBy = req.user.email || req.user.sub;

      await db.collection('casting_members').updateOne({ _id: member._id }, {
        $set: { isDeleted: true, deletedAt: now, deletedBy }
      });

      res.json({ success: true, message: 'Member soft-deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting member' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. CASTING EVENTS & POUR SEGMENTS
  // ════════════════════════════════════════════════════════════════════════════

  // GET casting events
  router.get('/events', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, status, startDate, endDate } = req.query;

      const query: any = { companyId, isDeleted: { $ne: true } };
      if (projectId) query.projectId = String(projectId);
      if (status && status !== 'ALL' && status !== 'all') query.status = status.toUpperCase();
      if (startDate || endDate) {
        query.plannedDate = {};
        if (startDate) query.plannedDate.$gte = String(startDate);
        if (endDate) query.plannedDate.$lte = String(endDate);
      }

      const events = await db.collection('casting_events')
        .find(query)
        .sort({ plannedDate: -1, createdAt: -1 })
        .toArray();

      res.json(events.map((e: any) => ({ ...e, id: e._id.toString() })));
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching casting events' });
    }
  });

  // GET single casting event
  router.get('/events/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const event = await db.collection('casting_events').findOne({
        ...idQuery(req.params.id),
        companyId,
        isDeleted: { $ne: true }
      });

      if (!event) return res.status(404).json({ message: 'Casting event not found' });
      res.json({ ...event, id: event._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching casting event' });
    }
  });

  // POST create casting event (Multi-Member & Multi-Block Segments)
  router.post('/events', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        projectId,
        title,
        activityType,
        plannedDate,
        plannedStartTime,
        plannedEndTime,
        segments,
        notes
      } = req.body;

      if (!projectId) return res.status(400).json({ message: 'Project ID is required' });
      if (!title || !title.trim()) return res.status(400).json({ message: 'Event Title is required' });
      if (!plannedDate) return res.status(400).json({ message: 'Planned Date is required (YYYY-MM-DD)' });

      if (!Array.isArray(segments) || segments.length === 0) {
        return res.status(400).json({ message: 'At least one member segment must be selected for casting' });
      }

      // Verify all member IDs belong to this company and project
      const memberIds = segments.map((s: any) => String(s.memberId));
      const members = await db.collection('casting_members').find({
        companyId,
        _id: { $in: memberIds.map((id: string) => toObjId(id) || id) },
        isDeleted: { $ne: true }
      }).toArray();

      const memberMap = new Map<string, any>(members.map((m: any) => [m._id.toString(), m]));

      let plannedTotalVolumeM3 = 0;
      const validatedSegments: any[] = segments.map((s: any, idx: number) => {
        const m = memberMap.get(String(s.memberId));
        if (!m) throw new Error(`Member with ID '${s.memberId}' does not exist or is deleted`);

        const pVol = Number(s.plannedVolumeM3 !== undefined ? s.plannedVolumeM3 : m.totalRequiredVolumeM3);
        if (isNaN(pVol) || pVol <= 0) throw new Error(`Invalid planned volume for member ${m.displayId}`);

        plannedTotalVolumeM3 += pVol;

        return {
          segmentId: `seg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          memberId: m._id.toString(),
          projectId: m.projectId,
          blockId: m.blockId,
          levelId: m.levelId,
          displayId: m.displayId,
          memberType: m.memberType,
          segmentName: s.segmentName ? s.segmentName.trim() : `Pour Segment ${s.segmentLiftNumber || 1}`,
          segmentLiftNumber: s.segmentLiftNumber !== undefined ? Number(s.segmentLiftNumber) : 1,
          plannedVolumeM3: Math.round(pVol * 1000) / 1000,
          actualVolumeM3: s.actualVolumeM3 !== undefined ? Number(s.actualVolumeM3) : undefined,
          status: 'PLANNED' as const,
          remarks: s.remarks || ''
        };
      });

      plannedTotalVolumeM3 = Math.round(plannedTotalVolumeM3 * 1000) / 1000;

      const count = await db.collection('casting_events').countDocuments({ companyId });
      const eventNumber = `CE-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      const now = new Date();

      const newEvent: ICastingEvent = {
        companyId,
        projectId,
        eventNumber,
        title: title.trim(),
        activityType: activityType || 'Slab_Beam',
        plannedDate,
        plannedStartTime: plannedStartTime || '',
        plannedEndTime: plannedEndTime || '',
        plannedTotalVolumeM3,
        segments: validatedSegments,
        status: 'PLANNED',
        notes: notes ? notes.trim() : '',
        isDeleted: false,
        createdBy: req.user.email || req.user.sub,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('casting_events').insertOne(newEvent);
      const created = await db.collection('casting_events').findOne({ _id: result.insertedId });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CASTING_EVENT_CREATED',
          resource: 'casting_events',
          resourceId: result.insertedId.toString(),
          description: `Scheduled casting event '${newEvent.title}' (${eventNumber}, Planned: ${plannedTotalVolumeM3} m³ across ${validatedSegments.length} segments)`,
          newValue: newEvent
        });
      }

      res.status(201).json({ ...created, id: created._id.toString() });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Error creating casting event' });
    }
  });

  // PUT update casting event (Record Actuals / Edit Planned)
  router.put('/events/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;
      const {
        title,
        activityType,
        plannedDate,
        plannedStartTime,
        plannedEndTime,
        actualPourDate,
        actualPourStartTime,
        actualPourEndTime,
        actualTotalVolumeM3,
        segments,
        status,
        notes
      } = req.body;

      const event = await db.collection('casting_events').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!event) return res.status(404).json({ message: 'Casting event not found' });

      const updateData: any = { updatedAt: new Date() };
      if (title !== undefined) updateData.title = title.trim();
      if (activityType !== undefined) updateData.activityType = activityType;
      if (plannedDate !== undefined) updateData.plannedDate = plannedDate;
      if (plannedStartTime !== undefined) updateData.plannedStartTime = plannedStartTime;
      if (plannedEndTime !== undefined) updateData.plannedEndTime = plannedEndTime;
      if (actualPourDate !== undefined) updateData.actualPourDate = actualPourDate;
      if (actualPourStartTime !== undefined) updateData.actualPourStartTime = actualPourStartTime;
      if (actualPourEndTime !== undefined) updateData.actualPourEndTime = actualPourEndTime;
      if (status !== undefined) updateData.status = status.toUpperCase();
      if (notes !== undefined) updateData.notes = notes;

      // Handle segments and cumulative member volume updates
      let affectedMemberIds = new Set<string>();
      (event.segments || []).forEach((s: any) => affectedMemberIds.add(String(s.memberId)));

      if (Array.isArray(segments)) {
        let actualSum = 0;
        let plannedSum = 0;
        const updatedSegments = segments.map((s: any) => {
          affectedMemberIds.add(String(s.memberId));
          const pVol = Number(s.plannedVolumeM3) || 0;
          const aVol = s.actualVolumeM3 !== undefined ? Number(s.actualVolumeM3) : undefined;
          plannedSum += pVol;
          if (typeof aVol === 'number') actualSum += aVol;

          const existingSeg = (event.segments || []).find((oldS: any) => oldS.segmentId === s.segmentId);

          return {
            ...existingSeg,
            ...s,
            plannedVolumeM3: Math.round(pVol * 1000) / 1000,
            actualVolumeM3: typeof aVol === 'number' ? Math.round(aVol * 1000) / 1000 : undefined,
            status: s.status || existingSeg?.status || (updateData.status === 'POURED' ? 'POURED' : 'PLANNED')
          };
        });

        updateData.segments = updatedSegments;
        updateData.plannedTotalVolumeM3 = Math.round(plannedSum * 1000) / 1000;
        updateData.isMrsStale = true;
        if (actualSum > 0 || actualTotalVolumeM3 !== undefined) {
          updateData.actualTotalVolumeM3 = actualTotalVolumeM3 !== undefined
            ? Math.round(Number(actualTotalVolumeM3) * 1000) / 1000
            : Math.round(actualSum * 1000) / 1000;
        }
      }

      await db.collection('casting_events').updateOne({ _id: event._id }, { $set: updateData });

      // Recalculate cumulative poured volume for all affected members
      for (const mId of affectedMemberIds) {
        await recalculateMemberCumulativeVolume(db, companyId, mId);
      }

      const updated = await db.collection('casting_events').findOne({ _id: event._id });
      res.json({ ...updated, id: updated._id.toString() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating casting event' });
    }
  });

  // DELETE casting event (Soft delete and volume reversal)
  router.delete('/events/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;
      const { reason } = req.body || {};

      const event = await db.collection('casting_events').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!event) return res.status(404).json({ message: 'Casting event not found' });

      const now = new Date();
      const deletedBy = req.user.email || req.user.sub;

      await db.collection('casting_events').updateOne({ _id: event._id }, {
        $set: {
          isDeleted: true,
          status: 'CANCELLED',
          deletedAt: now,
          deletedBy,
          deletionReason: reason || 'Cancelled by user'
        }
      });

      // Recalculate member cumulative volumes after cancellation
      const affectedMemberIds = new Set<string>();
      (event.segments || []).forEach((s: any) => affectedMemberIds.add(String(s.memberId)));
      for (const mId of affectedMemberIds) {
        await recalculateMemberCumulativeVolume(db, companyId, mId);
      }

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CASTING_EVENT_CANCELLED',
          resource: 'casting_events',
          resourceId: event._id.toString(),
          description: `Cancelled casting event '${event.title}' (${event.eventNumber})`
        });
      }

      res.json({ success: true, message: 'Casting event cancelled and removed from active schedule' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error cancelling casting event' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. PHASE 2 — PRE-CASTING PLANNING & MATERIAL REQUIREMENT SHEET (MRS)
  // ════════════════════════════════════════════════════════════════════════════

  // PUT /events/:id/segments/recipes — Bind approved recipes to segments in a casting event
  router.put('/events/:id/segments/recipes', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id } = req.params;
      const { bindings } = req.body; // Array of { segmentId, recipeId, versionNumber, appliedWastagePercent }

      if (!Array.isArray(bindings)) {
        return res.status(400).json({ success: false, message: 'bindings array is required' });
      }

      const event = await db.collection('casting_events').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!event) return res.status(404).json({ success: false, message: 'Casting event not found' });

      // Verify each recipe binding
      const updatedSegments = [...(event.segments || [])];
      for (const b of bindings) {
        const segIndex = updatedSegments.findIndex((s: any) => s.segmentId === b.segmentId);
        if (segIndex === -1) {
          return res.status(400).json({ success: false, message: `Segment ID ${b.segmentId} not found in event` });
        }

        const recipe = await db.collection('casting_recipes').findOne({
          ...idQuery(b.recipeId),
          companyId,
          isArchived: { $ne: true }
        });
        if (!recipe) {
          return res.status(400).json({ success: false, message: `Recipe ${b.recipeId} not found` });
        }

        const ver = recipe.versions?.find((v: any) => v.versionNumber === b.versionNumber);
        if (!ver) {
          return res.status(400).json({ success: false, message: `Recipe version ${b.versionNumber} not found for recipe ${recipe.recipeCode}` });
        }

        if (ver.approvalStatus !== 'APPROVED') {
          return res.status(400).json({
            success: false,
            message: `Cannot bind unapproved recipe. Version ${b.versionNumber} is in '${ver.approvalStatus}' status.`
          });
        }

        updatedSegments[segIndex] = {
          ...updatedSegments[segIndex],
          grade: recipe.grade,
          recipeBinding: {
            recipeId: recipe._id.toString(),
            recipeCode: recipe.recipeCode,
            versionNumber: ver.versionNumber,
            grade: recipe.grade,
            appliedWastagePercent: Number(b.appliedWastagePercent ?? ver.ingredients[0]?.wastageAllowancePercent ?? 0),
            isApprovedVersion: true
          }
        };
      }

      await db.collection('casting_events').updateOne(
        { _id: event._id },
        {
          $set: {
            segments: updatedSegments,
            isMrsStale: true, // Flag MRS as stale when recipe bindings change
            updatedAt: new Date()
          }
        }
      );

      return res.json({ success: true, message: 'Segment recipe bindings updated successfully', segments: updatedSegments });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /events/:id/mrs/generate — Atomic MRS revision generation with CAS concurrency control
  router.post('/events/:id/mrs/generate', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id } = req.params;
      const { changeReason } = req.body;
      const userId = req.user?.sub || 'system';
      const userName = req.user?.name || req.user?.email || 'Site Engineer';

      const event = await db.collection('casting_events').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!event) return res.status(404).json({ success: false, message: 'Casting event not found' });

      if (!event.segments || event.segments.length === 0) {
        return res.status(400).json({ success: false, message: 'Cannot generate MRS: Casting event has no structural segments' });
      }

      // Check all segments have recipe bindings and collect recipe snapshots
      const segmentRequirements: any[] = [];
      const recipeSnapshotsMap = new Map<string, any>();
      let totalWaterContributedAcrossEvent = 0;

      for (const seg of event.segments) {
        if (!seg.recipeBinding?.recipeId || !seg.recipeBinding?.versionNumber) {
          return res.status(400).json({
            success: false,
            message: `Segment '${seg.segmentName}' (${seg.segmentId}) lacks an assigned mix recipe. Please assign approved recipes to all segments before generating the Material Requirement Sheet.`
          });
        }

        const recipe = await db.collection('casting_recipes').findOne({
          ...idQuery(seg.recipeBinding.recipeId),
          companyId
        });
        if (!recipe) {
          return res.status(400).json({
            success: false,
            message: `Recipe '${seg.recipeBinding.recipeCode}' for segment '${seg.segmentName}' was not found.`
          });
        }

        const version = recipe.versions?.find((v: any) => v.versionNumber === seg.recipeBinding.versionNumber);
        if (!version) {
          return res.status(400).json({
            success: false,
            message: `Recipe version '${seg.recipeBinding.versionNumber}' for segment '${seg.segmentName}' was not found.`
          });
        }

        // Calculate materials for this segment
        const { segmentRequirement, totalWaterContributedLiters } = calculateSegmentMaterials(seg, version);
        segmentRequirements.push(segmentRequirement);
        totalWaterContributedAcrossEvent += totalWaterContributedLiters;

        // Collect frozen recipe snapshot
        const snapshotKey = `${recipe.recipeCode}__${version.versionNumber}`;
        if (!recipeSnapshotsMap.has(snapshotKey)) {
          recipeSnapshotsMap.set(snapshotKey, {
            recipeId: recipe._id.toString(),
            recipeCode: recipe.recipeCode,
            versionNumber: version.versionNumber,
            grade: recipe.grade,
            calculatedWaterCementRatio: version.calculatedWaterCementRatio,
            calculatedWaterCementitiousRatio: version.calculatedWaterCementitiousRatio,
            engineeringLimits: version.engineeringLimits,
            ingredients: version.ingredients,
            approvedBy: version.approvedBy
          });
        }
      }

      // Calculate grade subtotals and consolidated grand totals
      const gradeSubtotals = calculateGradeSubtotals(segmentRequirements);
      const rawConsolidated = consolidateIngredients(segmentRequirements);

      // Perform read-only inventory availability check
      const consolidatedTotals = await checkInventoryAvailability(rawConsolidated, db, companyId);

      // Calculate new revision number
      const currentCounter = Number(event.mrsRevisionCounter || (event.mrsRevisions?.length ?? 0));
      const nextRevisionNumber = currentCounter + 1;
      const mrsCode = `MRS-${event.eventNumber}-R${nextRevisionNumber}`;

      const newMrsRevision: IMaterialRequirementSheetRevision = {
        revisionNumber: nextRevisionNumber,
        mrsCode,
        generatedAt: new Date(),
        generatedBy: {
          userId: String(userId),
          name: userName
        },
        changeReason: changeReason ? String(changeReason).trim() : (nextRevisionNumber === 1 ? 'Initial Material Requirement Sheet generation' : 'Plan or recipe update'),
        totalPlannedVolumeM3: event.plannedTotalVolumeM3,
        segmentsBreakdown: segmentRequirements,
        gradeSubtotals,
        consolidatedTotals,
        effectiveWaterAdjustmentLiters: Number(totalWaterContributedAcrossEvent.toFixed(2)),
        recipeSnapshots: Array.from(recipeSnapshotsMap.values())
      };

      // Atomic Compare-And-Swap Update to prevent duplicate revisions or race conditions
      const updateResult = await db.collection('casting_events').findOneAndUpdate(
        {
          _id: event._id,
          companyId,
          $or: [
            { mrsRevisionCounter: currentCounter },
            { mrsRevisionCounter: { $exists: false } }
          ]
        },
        {
          $inc: { mrsRevisionCounter: 1 },
          $set: {
            activeMrsRevision: nextRevisionNumber,
            isMrsStale: false,
            updatedAt: new Date()
          },
          $push: {
            mrsRevisions: newMrsRevision
          }
        },
        { returnDocument: 'after' }
      );

      if (!updateResult) {
        return res.status(409).json({
          success: false,
          message: 'CONCURRENT_MRS_MUTATION_CONFLICT: A newer revision of this Material Requirement Sheet was generated concurrently. Please reload the casting event.'
        });
      }

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'MRS_REVISION_GENERATED',
          resource: 'casting_events',
          resourceId: event._id.toString(),
          description: `Generated Material Requirement Sheet ${mrsCode} for event '${event.title}'`
        });
      }

      return res.status(201).json({
        success: true,
        message: `Material Requirement Sheet revision ${nextRevisionNumber} generated successfully`,
        data: newMrsRevision
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /events/:id/mrs — Retrieve active or specified revision of MRS
  router.get('/events/:id/mrs', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id } = req.params;
      const { revision } = req.query;

      const event = await db.collection('casting_events').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!event) return res.status(404).json({ success: false, message: 'Casting event not found' });

      const revisions = event.mrsRevisions || [];
      if (revisions.length === 0) {
        return res.json({
          success: true,
          hasMrs: false,
          isStale: false,
          activeRevision: null,
          data: null
        });
      }

      let selectedRevision: any;
      if (revision) {
        const revNum = parseInt(String(revision), 10);
        selectedRevision = revisions.find((r: any) => r.revisionNumber === revNum);
        if (!selectedRevision) {
          return res.status(404).json({ success: false, message: `Revision R${revision} not found for this event` });
        }
      } else {
        const activeRevNum = event.activeMrsRevision || revisions[revisions.length - 1].revisionNumber;
        selectedRevision = revisions.find((r: any) => r.revisionNumber === activeRevNum) || revisions[revisions.length - 1];
      }

      return res.json({
        success: true,
        hasMrs: true,
        isStale: !!event.isMrsStale,
        activeRevisionNumber: event.activeMrsRevision || selectedRevision.revisionNumber,
        totalRevisions: revisions.length,
        data: selectedRevision
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /events/:id/mrs/revisions — List all revision metadata
  router.get('/events/:id/mrs/revisions', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id } = req.params;

      const event = await db.collection('casting_events').findOne({
        ...idQuery(id),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!event) return res.status(404).json({ success: false, message: 'Casting event not found' });

      const revisions = (event.mrsRevisions || []).map((r: any) => ({
        revisionNumber: r.revisionNumber,
        mrsCode: r.mrsCode,
        generatedAt: r.generatedAt,
        generatedBy: r.generatedBy,
        changeReason: r.changeReason,
        totalPlannedVolumeM3: r.totalPlannedVolumeM3,
        isActive: r.revisionNumber === event.activeMrsRevision
      }));

      return res.json({ success: true, data: revisions, isStale: !!event.isMrsStale });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}
