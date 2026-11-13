import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { BBS_MEMBER_TYPES } from './bbs.types';
import {
  resolveUserAndCompany,
  listAccessibleGlobalProjects,
  resolveCanonicalProjectId,
} from '../projects/module-project-adapter';

export function createBBSRouter(getDb: () => any, authMiddleware: any) {
  const router = Router();

  // Helper to extract companyId from authenticated user
  const resolveCompanyId = async (req: any, db: any): Promise<string> => {
    const ctx = await resolveUserAndCompany(req, db);
    return ctx.companyId;
  };

  const toObjId = (id: any): ObjectId | null => {
    if (!id) return null;
    if (id instanceof ObjectId) return id;
    const str = String(id).trim();
    if (ObjectId.isValid(str) && str.length === 24) {
      try { return new ObjectId(str); } catch { return null; }
    }
    return null;
  };

  const normalizeBlockName = (name: string) => (name || '').trim().toLowerCase();

  const syncAndListBbsBlocks = async (db: any, companyId: string, projectId: string) => {
    const pIdStr = String(projectId);
    const pIdObj = toObjId(projectId);
    const pIdFilter = pIdObj
      ? { $or: [{ projectId: pIdStr }, { projectId: pIdObj }] }
      : { projectId: pIdStr };

    // 1. Fetch active blocks from project_blocks (canonical)
    const pBlocks = await db.collection('project_blocks').find({
      ...pIdFilter,
      isDeleted: { $ne: true },
      status: { $ne: 'inactive' }
    }).sort({ displayOrder: 1, createdAt: 1 }).toArray().catch(() => []);

    // 2. Fetch active blocks from bbs_blocks
    const bBlocks = await db.collection('bbs_blocks').find({
      ...pIdFilter,
      isDeleted: { $ne: true }
    }).sort({ displayOrder: 1, createdAt: 1 }).toArray().catch(() => []);

    const now = new Date();
    const bBlockIdMap = new Map<string, any>(bBlocks.map((b: any) => [String(b._id), b]));
    const bBlockNameMap = new Map<string, any>(bBlocks.map((b: any) => [normalizeBlockName(b.name), b]));

    // 3. For any block in project_blocks that isn't in bbs_blocks (or differs), upsert into bbs_blocks
    for (const pb of pBlocks) {
      const pbIdStr = String(pb._id);
      const existing = bBlockIdMap.get(pbIdStr) || bBlockNameMap.get(normalizeBlockName(pb.name));

      if (!existing) {
        const newBbsBlock = {
          _id: pb._id,
          companyId: String(pb.companyId || companyId),
          projectId: pIdStr,
          name: pb.name,
          code: pb.code || `BLK-${pb.displayOrder || 1}`,
          description: pb.description || '',
          displayOrder: pb.displayOrder || 1,
          isDeleted: false,
          createdAt: pb.createdAt || now,
          updatedAt: pb.updatedAt || now
        };
        await db.collection('bbs_blocks').updateOne(
          { _id: pb._id },
          { $set: newBbsBlock },
          { upsert: true }
        ).catch(() => { });
        bBlocks.push(newBbsBlock);
        bBlockIdMap.set(pbIdStr, newBbsBlock);
        bBlockNameMap.set(normalizeBlockName(pb.name), newBbsBlock);
      } else if (existing.name !== pb.name || existing.code !== pb.code || existing.displayOrder !== pb.displayOrder) {
        await db.collection('bbs_blocks').updateOne(
          { _id: existing._id },
          {
            $set: {
              name: pb.name,
              code: pb.code || existing.code,
              displayOrder: pb.displayOrder || existing.displayOrder,
              description: pb.description !== undefined ? pb.description : existing.description,
              updatedAt: now
            }
          }
        ).catch(() => { });
        existing.name = pb.name;
        existing.code = pb.code || existing.code;
        existing.displayOrder = pb.displayOrder || existing.displayOrder;
      }
    }

    return bBlocks.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
  };

  const enrichBbsStats = async (db: any, project: any) => {
    const projectId = String(project._id || project.id);
    // Include legacy module id if bridged
    const legacy = await db.collection('bbs_projects').findOne({
      companyId: String(project.companyId),
      $or: [{ orgProjectId: projectId }, { _id: project._id }],
    }).catch(() => null);
    const ids = [projectId];
    if (legacy) ids.push(String(legacy._id));

    const [blocks, levels, members, pBlocks] = await Promise.all([
      db.collection('bbs_blocks').find({ projectId: { $in: ids }, isDeleted: { $ne: true } }).toArray().catch(() => []),
      db.collection('bbs_levels').find({ projectId: { $in: ids } }).toArray().catch(() => []),
      db.collection('bbs_members').find({ projectId: { $in: ids } }).toArray().catch(() => []),
      db.collection('project_blocks').find({ projectId: { $in: ids }, isDeleted: { $ne: true }, status: { $ne: 'inactive' } }).toArray().catch(() => []),
    ]);

    let completionPercentage = 0;
    if (members.length > 0) {
      const totalProgress = members.reduce((sum: number, m: any) => sum + (Number(m.completionPercentage) || 0), 0);
      completionPercentage = Math.round(totalProgress / members.length);
    }

    const blockCount = Math.max(blocks.length, pBlocks.length);

    return {
      ...project,
      id: projectId,
      blockCount,
      levelCount: levels.length,
      memberCount: members.length,
      completionPercentage,
    };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 1. BBS PROJECTS — adapters over global /api/projects
  // ════════════════════════════════════════════════════════════════════════════

  // GET all BBS projects with aggregated stats (global catalog)
  router.get('/projects', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const projects = await listAccessibleGlobalProjects(db, ctx);
      const enrichedProjects = await Promise.all(projects.map((p: any) => enrichBbsStats(db, p)));
      res.json(enrichedProjects);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Error fetching BBS projects' });
    }
  });

  // GET single BBS project with stats
  router.get('/projects/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { project } = await resolveCanonicalProjectId(db, ctx, req.params.id);
      res.json(await enrichBbsStats(db, project));
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Error fetching BBS project', code: err.code });
    }
  });

  // POST create — deprecated; use POST /api/projects. Kept as thin proxy for compatibility.
  router.post('/projects', authMiddleware, async (req: any, res: any) => {
    return res.status(400).json({
      message: 'Create projects via Company Projects (POST /api/projects). Module-specific project catalogs are unified.',
      code: 'USE_GLOBAL_PROJECTS',
    });
  });

  // PUT update BBS project
  router.put('/projects/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;
      const { name, location, description, status } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (location !== undefined) updateData.location = location.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (status !== undefined) updateData.status = status;

      await db.collection('bbs_projects').updateOne(
        { $or: [{ _id: new ObjectId(id) }, { _id: id }], companyId },
        { $set: updateData }
      );

      const updated = await db.collection('bbs_projects').findOne({
        $or: [{ _id: new ObjectId(id) }, { _id: id }],
        companyId
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating BBS project' });
    }
  });

  // DELETE BBS project (cascades to blocks, levels, members)
  router.delete('/projects/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;

      const project = await db.collection('bbs_projects').findOne({
        $or: [{ _id: new ObjectId(id) }, { _id: id }],
        companyId
      });

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const projectId = project._id.toString();

      await Promise.all([
        db.collection('bbs_projects').deleteMany({ $or: [{ _id: new ObjectId(id) }, { _id: id }] }),
        db.collection('bbs_blocks').deleteMany({ projectId }),
        db.collection('bbs_levels').deleteMany({ projectId }),
        db.collection('bbs_members').deleteMany({ projectId })
      ]);

      res.json({ success: true, message: 'BBS Project and all underlying hierarchy removed' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting BBS project' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. BBS BLOCKS
  // ════════════════════════════════════════════════════════════════════════════

  // GET blocks for a project (synced with canonical project_blocks)
  router.get('/projects/:projectId/blocks', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { projectId } = await resolveCanonicalProjectId(db, ctx, req.params.projectId);

      const blocks = await syncAndListBbsBlocks(db, ctx.companyId, projectId);

      // Aggregate counts for each block
      const enriched = await Promise.all(
        blocks.map(async (b: any) => {
          const blockId = b._id.toString();
          const [levels, members] = await Promise.all([
            db.collection('bbs_levels').find({ blockId }).toArray().catch(() => []),
            db.collection('bbs_members').find({ blockId }).toArray().catch(() => [])
          ]);
          let completionPercentage = 0;
          if (members.length > 0) {
            const total = members.reduce((sum: number, m: any) => sum + (Number(m.completionPercentage) || 0), 0);
            completionPercentage = Math.round(total / members.length);
          }
          return {
            ...b,
            levelCount: levels.length,
            memberCount: members.length,
            completionPercentage
          };
        })
      );

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching blocks' });
    }
  });

  // POST create a block (persisted in bbs_blocks and synchronized to project_blocks)
  router.post('/projects/:projectId/blocks', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;
      const { projectId } = await resolveCanonicalProjectId(db, ctx, req.params.projectId);
      const { name, code, description, displayOrder } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Block Name is required' });
      }

      const existingCount = await db.collection('bbs_blocks').countDocuments({ projectId }).catch(() => 0);
      const nextOrder = displayOrder !== undefined ? Number(displayOrder) : existingCount + 1;
      const now = new Date();
      const blockId = new ObjectId();
      const newBlock = {
        _id: blockId,
        projectId,
        companyId,
        name: name.trim(),
        code: code ? code.trim() : `BLK-${nextOrder}`,
        description: description ? description.trim() : '',
        displayOrder: nextOrder,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      };

      await db.collection('bbs_blocks').insertOne(newBlock);

      // Also synchronize into canonical project_blocks
      const projectBlockDoc = {
        _id: blockId,
        companyId,
        projectId,
        name: name.trim(),
        code: newBlock.code,
        description: newBlock.description,
        displayOrder: nextOrder,
        isDeleted: false,
        status: 'active',
        createdAt: now,
        updatedAt: now
      };
      await db.collection('project_blocks').updateOne(
        { _id: blockId },
        { $set: projectBlockDoc },
        { upsert: true }
      ).catch(() => { });

      const created = await db.collection('bbs_blocks').findOne({ _id: blockId });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating block' });
    }
  });

  // PUT update a block
  router.put('/blocks/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const { name, code, description, displayOrder } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (code !== undefined) updateData.code = code.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);

      const blockOid = toObjId(id);
      const idFilter = blockOid ? { $or: [{ _id: blockOid }, { _id: id }] } : { _id: id };

      await Promise.all([
        db.collection('bbs_blocks').updateOne(idFilter, { $set: updateData }),
        db.collection('project_blocks').updateOne(idFilter, { $set: updateData }).catch(() => { })
      ]);

      const updated = await db.collection('bbs_blocks').findOne(idFilter);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating block' });
    }
  });

  // DELETE a block (cascades to levels, members, and soft-deletes in project_blocks)
  router.delete('/blocks/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;

      const blockOid = toObjId(id);
      const idFilter = blockOid ? { $or: [{ _id: blockOid }, { _id: id }] } : { _id: id };

      const block = await db.collection('bbs_blocks').findOne(idFilter);

      if (!block) return res.status(404).json({ message: 'Block not found' });

      const blockId = block._id.toString();

      await Promise.all([
        db.collection('bbs_blocks').deleteMany(idFilter),
        db.collection('project_blocks').updateOne(idFilter, { $set: { isDeleted: true, status: 'inactive', updatedAt: new Date() } }).catch(() => { }),
        db.collection('bbs_levels').deleteMany({ blockId }),
        db.collection('bbs_members').deleteMany({ blockId })
      ]);

      res.json({ success: true, message: 'Block and associated levels and members removed' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting block' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. BBS LEVELS
  // ════════════════════════════════════════════════════════════════════════════

  // GET levels for a block
  router.get('/blocks/:blockId/levels', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const blockId = req.params.blockId;

      const levels = await db.collection('bbs_levels').find({ blockId }).sort({ displayOrder: 1, createdAt: 1 }).toArray();

      const enriched = await Promise.all(
        levels.map(async (l: any) => {
          const levelId = l._id.toString();
          const members = await db.collection('bbs_members').find({ levelId }).toArray();
          let completionPercentage = 0;
          if (members.length > 0) {
            const total = members.reduce((sum: number, m: any) => sum + (Number(m.completionPercentage) || 0), 0);
            completionPercentage = Math.round(total / members.length);
          }
          return {
            ...l,
            memberCount: members.length,
            completionPercentage
          };
        })
      );

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching levels' });
    }
  });

  // POST create a level
  router.post('/blocks/:blockId/levels', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const blockId = req.params.blockId;
      const { projectId, name, code, description } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Level Name is required' });
      }

      // If projectId not supplied in body, lookup from block
      let targetProjectId = projectId;
      if (!targetProjectId) {
        const block = await db.collection('bbs_blocks').findOne({
          $or: [{ _id: new ObjectId(blockId) }, { _id: blockId }]
        });
        targetProjectId = block?.projectId;
      }

      const existingCount = await db.collection('bbs_levels').countDocuments({ blockId });
      const now = new Date();
      const newLevel = {
        projectId: targetProjectId,
        blockId,
        companyId,
        name: name.trim(),
        code: code ? code.trim() : '',
        description: description ? description.trim() : '',
        displayOrder: existingCount + 1,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('bbs_levels').insertOne(newLevel);
      const created = await db.collection('bbs_levels').findOne({ _id: result.insertedId });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating level' });
    }
  });

  // PUT update a level
  router.put('/levels/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const { name, code, description, displayOrder } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (code !== undefined) updateData.code = code.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);

      await db.collection('bbs_levels').updateOne(
        { $or: [{ _id: new ObjectId(id) }, { _id: id }] },
        { $set: updateData }
      );

      const updated = await db.collection('bbs_levels').findOne({
        $or: [{ _id: new ObjectId(id) }, { _id: id }]
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating level' });
    }
  });

  // PUT reorder levels in a block
  router.put('/blocks/:blockId/levels/reorder', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { levelIds } = req.body; // array of string level IDs in desired order

      if (!Array.isArray(levelIds)) {
        return res.status(400).json({ message: 'levelIds array is required' });
      }

      await Promise.all(
        levelIds.map((lvlId: string, index: number) => {
          return db.collection('bbs_levels').updateOne(
            { $or: [{ _id: new ObjectId(lvlId) }, { _id: lvlId }] },
            { $set: { displayOrder: index + 1, updatedAt: new Date() } }
          );
        })
      );

      res.json({ success: true, message: 'Levels reordered successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error reordering levels' });
    }
  });

  // DELETE a level (cascades to members)
  router.delete('/levels/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;

      const level = await db.collection('bbs_levels').findOne({
        $or: [{ _id: new ObjectId(id) }, { _id: id }]
      });

      if (!level) return res.status(404).json({ message: 'Level not found' });

      const levelId = level._id.toString();

      await Promise.all([
        db.collection('bbs_levels').deleteMany({ $or: [{ _id: new ObjectId(id) }, { _id: id }] }),
        db.collection('bbs_members').deleteMany({ levelId })
      ]);

      res.json({ success: true, message: 'Level and associated members removed' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting level' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. BBS STRUCTURAL MEMBERS
  // ════════════════════════════════════════════════════════════════════════════

  // GET member types list
  router.get('/member-types', authMiddleware, (_req: any, res: any) => {
    res.json(BBS_MEMBER_TYPES);
  });

  // GET structural members for a level
  router.get('/levels/:levelId/members', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const levelId = req.params.levelId;

      const rawMembers = await db.collection('bbs_members').find({ levelId }).toArray();
      const members = rawMembers.sort((a: any, b: any) =>
        (a.displayId || '').localeCompare(b.displayId || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching structural members' });
    }
  });

  // POST create a structural member
  router.post('/levels/:levelId/members', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const levelId = req.params.levelId;
      const { projectId, blockId, memberType, displayId, concrete_grade, concreteGrade, description, completionPercentage } = req.body;

      if (!memberType || !BBS_MEMBER_TYPES.includes(memberType)) {
        return res.status(400).json({ message: `Valid memberType is required (${BBS_MEMBER_TYPES.join(', ')})` });
      }

      if (!displayId || !displayId.trim()) {
        return res.status(400).json({ message: 'Member Display ID / Mark (e.g. C1, B1) is required' });
      }

      // Lookup missing hierarchy IDs if needed
      let targetProjectId = projectId;
      let targetBlockId = blockId;
      if (!targetProjectId || !targetBlockId) {
        const level = await db.collection('bbs_levels').findOne({
          $or: [{ _id: new ObjectId(levelId) }, { _id: levelId }]
        });
        if (level) {
          targetProjectId = targetProjectId || level.projectId;
          targetBlockId = targetBlockId || level.blockId;
        }
      }

      const now = new Date();
      const newMember = {
        projectId: targetProjectId,
        blockId: targetBlockId,
        levelId,
        companyId,
        memberType,
        displayId: displayId.trim().toUpperCase(),
        concrete_grade: String(concrete_grade || concreteGrade || 'M25').trim(),
        description: description ? description.trim() : '',
        completionPercentage: completionPercentage !== undefined ? Number(completionPercentage) : 0,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('bbs_members').insertOne(newMember);
      const created = await db.collection('bbs_members').findOne({ _id: result.insertedId });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating member' });
    }
  });

  // POST batch create structural members in series / range
  router.post('/levels/:levelId/members/batch', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const levelId = req.params.levelId;
      const { projectId, blockId, memberType, displayIds, concrete_grade, concreteGrade, description, completionPercentage } = req.body;

      if (!memberType || !BBS_MEMBER_TYPES.includes(memberType)) {
        return res.status(400).json({ message: `Valid memberType is required (${BBS_MEMBER_TYPES.join(', ')})` });
      }

      if (!Array.isArray(displayIds) || displayIds.length === 0) {
        return res.status(400).json({ message: 'displayIds array is required' });
      }

      let targetProjectId = projectId;
      let targetBlockId = blockId;
      if (!targetProjectId || !targetBlockId) {
        const level = await db.collection('bbs_levels').findOne({
          $or: [{ _id: new ObjectId(levelId) }, { _id: levelId }]
        });
        if (level) {
          targetProjectId = targetProjectId || level.projectId;
          targetBlockId = targetBlockId || level.blockId;
        }
      }

      const now = new Date();
      const newDocs = displayIds
        .filter((d: string) => d && String(d).trim().length > 0)
        .map((mark: string) => ({
          projectId: targetProjectId,
          blockId: targetBlockId,
          levelId,
          companyId,
          memberType,
          displayId: String(mark).trim().toUpperCase(),
          concrete_grade: String(concrete_grade || concreteGrade || 'M25').trim(),
          description: description ? description.trim() : '',
          completionPercentage: completionPercentage !== undefined ? Number(completionPercentage) : 0,
          createdAt: now,
          updatedAt: now
        }));

      if (newDocs.length === 0) {
        return res.status(400).json({ message: 'No valid member marks provided' });
      }

      await db.collection('bbs_members').insertMany(newDocs);

      const rawAll = await db.collection('bbs_members').find({ levelId }).toArray();
      const allLevelMembers = rawAll.sort((a: any, b: any) =>
        (a.displayId || '').localeCompare(b.displayId || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      res.status(201).json(allLevelMembers);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating members in batch' });
    }
  });

  // PUT update a structural member
  router.put('/members/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const { memberType, displayId, concrete_grade, concreteGrade, description, completionPercentage } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (memberType !== undefined) {
        if (!BBS_MEMBER_TYPES.includes(memberType)) {
          return res.status(400).json({ message: 'Invalid memberType' });
        }
        updateData.memberType = memberType;
      }
      if (displayId !== undefined) updateData.displayId = displayId.trim().toUpperCase();
      if (concrete_grade !== undefined || concreteGrade !== undefined) {
        updateData.concrete_grade = String(concrete_grade || concreteGrade).trim();
      }
      if (description !== undefined) updateData.description = description.trim();
      if (completionPercentage !== undefined) updateData.completionPercentage = Number(completionPercentage);

      await db.collection('bbs_members').updateOne(
        { $or: [{ _id: new ObjectId(id) }, { _id: id }] },
        { $set: updateData }
      );

      const updated = await db.collection('bbs_members').findOne({
        $or: [{ _id: new ObjectId(id) }, { _id: id }]
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating member' });
    }
  });

  // DELETE a structural member
  router.delete('/members/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;

      await db.collection('bbs_members').deleteMany({
        $or: [{ _id: new ObjectId(id) }, { _id: id }]
      });

      res.json({ success: true, message: 'Structural member deleted' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting member' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. BBS SHAPE LIBRARY & PARAMETRIC BLOCK MANAGEMENT (PHASE 2G)
  // ════════════════════════════════════════════════════════════════════════════

  // GET shapes with filtering, search, sort, and status lifecycle
  router.get('/shapes', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { status, category, ownership, search, sort } = req.query;

      const query: any = { companyId };

      // Status filter (by default show all except ARCHIVED unless specifically requested)
      if (status && status !== 'ALL' && status !== 'all') {
        query.status = status.toUpperCase();
      } else if (!status) {
        query.status = { $ne: 'ARCHIVED' };
      }

      // Category filter
      if (category && category !== 'All' && category !== 'ALL') {
        query.category = category;
      }

      // Ownership filter (STANDARD / CUSTOM)
      if (ownership && ownership !== 'ALL' && ownership !== 'all') {
        query.ownership = ownership.toUpperCase();
      }

      // Search across name, code, description, tags
      if (search && typeof search === 'string' && search.trim() !== '') {
        const s = search.trim();
        query.$or = [
          { name: { $regex: s, $options: 'i' } },
          { code: { $regex: s, $options: 'i' } },
          { shapeCode: { $regex: s, $options: 'i' } },
          { description: { $regex: s, $options: 'i' } },
          { tags: { $in: [new RegExp(s, 'i')] } }
        ];
      }

      let sortOptions: any = { updatedAt: -1 };
      if (sort === 'name') sortOptions = { name: 1 };
      else if (sort === 'code') sortOptions = { code: 1, shapeCode: 1 };
      else if (sort === 'createdAt') sortOptions = { createdAt: -1 };
      else if (sort === 'usage') sortOptions = { 'metadata.usageCount': -1, updatedAt: -1 };

      const shapes = await db.collection('bbs_shapes').find(query).sort(sortOptions).toArray();
      res.json(shapes);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching shapes' });
    }
  });

  // GET single shape details by ID
  router.get('/shapes/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const idFilter = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
        : { $or: [{ _id: id }, { id: id }] };

      const shape = await db.collection('bbs_shapes').findOne(idFilter);
      if (!shape) {
        return res.status(404).json({ message: 'Shape not found' });
      }
      res.json(shape);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching shape' });
    }
  });

  // POST create a new shape definition
  router.post('/shapes', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        name,
        code,
        shapeCode,
        description,
        category,
        subCategory,
        ownership,
        status,
        version,
        unit,
        tags,
        geometry,
        parameters,
        dimensions,
        constraints,
        calculationRules,
        validationRules,
        metadata
      } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Shape name is required' });
      }

      const initialVersion = version || '1.0';
      const versionId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const creator = req.user?.email || req.user?.name || 'User';

      const initialVersionSnapshot = {
        versionId,
        version: initialVersion,
        status: (status || 'DRAFT').toUpperCase(),
        createdAt: new Date(),
        createdBy: creator,
        changeSummary: 'Initial shape definition creation',
        geometry: geometry || { objects: [] },
        parameters: parameters || [],
        dimensions: dimensions || [],
        constraints: constraints || [],
        calculationRules: calculationRules || { ruleSet: 'RULE_SET_CENTERLINE_EXACT' },
        validationRules: validationRules || {}
      };

      const newShape = {
        companyId,
        name: name.trim(),
        code: (code || shapeCode || `SH-${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase(),
        shapeCode: (code || shapeCode || `SH-${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase(),
        description: description || '',
        category: category || 'Custom',
        subCategory: subCategory || '',
        ownership: (ownership || 'CUSTOM').toUpperCase(),
        status: (status || 'DRAFT').toUpperCase(),
        version: initialVersion,
        versionId,
        tags: Array.isArray(tags) ? tags : [],
        unit: unit || 'mm',
        geometry: geometry || { objects: [] },
        parameters: parameters || [],
        dimensions: dimensions || [],
        constraints: constraints || [],
        calculationRules: calculationRules || { ruleSet: 'RULE_SET_CENTERLINE_EXACT' },
        validationRules: validationRules || {},
        versions: [initialVersionSnapshot],
        metadata: {
          ...(metadata || {}),
          unit: unit || 'mm',
          usageCount: 0,
          favorite: false,
          author: creator
        },
        createdAt: new Date(),
        createdBy: creator,
        updatedAt: new Date(),
        updatedBy: creator
      };

      const result = await db.collection('bbs_shapes').insertOne(newShape);
      res.status(201).json({ ...newShape, _id: result.insertedId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating shape' });
    }
  });

  // PUT update existing shape definition
  router.put('/shapes/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const user = req.user?.email || req.user?.name || 'User';

      const {
        name,
        code,
        shapeCode,
        description,
        category,
        subCategory,
        ownership,
        status,
        version,
        unit,
        tags,
        geometry,
        parameters,
        dimensions,
        constraints,
        calculationRules,
        validationRules,
        metadata
      } = req.body;

      const idFilter = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
        : { $or: [{ _id: id }, { id: id }] };

      const existing = await db.collection('bbs_shapes').findOne(idFilter);
      if (!existing) {
        return res.status(404).json({ message: 'Shape not found' });
      }

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: user
      };

      if (name !== undefined) updateData.name = name.trim();
      if (code !== undefined || shapeCode !== undefined) {
        updateData.code = (code || shapeCode).trim().toUpperCase();
        updateData.shapeCode = (code || shapeCode).trim().toUpperCase();
      }
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (subCategory !== undefined) updateData.subCategory = subCategory;
      if (ownership !== undefined) updateData.ownership = ownership.toUpperCase();
      if (status !== undefined) updateData.status = status.toUpperCase();
      if (version !== undefined) updateData.version = version;
      if (unit !== undefined) updateData.unit = unit;
      if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
      if (geometry !== undefined) updateData.geometry = geometry;
      if (parameters !== undefined) updateData.parameters = parameters;
      if (dimensions !== undefined) updateData.dimensions = dimensions;
      if (constraints !== undefined) updateData.constraints = constraints;
      if (calculationRules !== undefined) updateData.calculationRules = calculationRules;
      if (validationRules !== undefined) updateData.validationRules = validationRules;
      if (metadata !== undefined) updateData.metadata = { ...(existing.metadata || {}), ...metadata };

      // Update current version snapshot in the versions array
      const currentVersionStr = existing.version || '1.0';
      const versions = Array.isArray(existing.versions) ? [...existing.versions] : [];
      const currentVersionIndex = versions.findIndex(v => v.version === currentVersionStr);

      const updatedSnapshot = {
        versionId: existing.versionId || `v_${Date.now()}`,
        version: currentVersionStr,
        status: updateData.status || existing.status || 'DRAFT',
        createdAt: existing.createdAt || new Date(),
        createdBy: existing.createdBy || user,
        updatedAt: new Date(),
        updatedBy: user,
        changeSummary: versions[currentVersionIndex]?.changeSummary || 'Updated active draft',
        geometry: updateData.geometry || existing.geometry || { objects: [] },
        parameters: updateData.parameters || existing.parameters || [],
        dimensions: updateData.dimensions || existing.dimensions || [],
        constraints: updateData.constraints || existing.constraints || [],
        calculationRules: updateData.calculationRules || existing.calculationRules || {},
        validationRules: updateData.validationRules || existing.validationRules || {}
      };

      if (currentVersionIndex >= 0) {
        versions[currentVersionIndex] = updatedSnapshot;
      } else {
        versions.push(updatedSnapshot);
      }
      updateData.versions = versions;

      await db.collection('bbs_shapes').updateOne(idFilter, { $set: updateData });
      const updated = await db.collection('bbs_shapes').findOne(idFilter);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating shape' });
    }
  });

  // POST create a new version of an existing shape (Shape Versioning)
  router.post('/shapes/:id/version', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const user = req.user?.email || req.user?.name || 'User';
      const { bumpType, newVersion, changeSummary, geometry, parameters, dimensions, constraints } = req.body;

      const idFilter = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
        : { $or: [{ _id: id }, { id: id }] };

      const existing = await db.collection('bbs_shapes').findOne(idFilter);
      if (!existing) {
        return res.status(404).json({ message: 'Shape not found' });
      }

      // Calculate new version string
      let nextVersionStr = newVersion;
      if (!nextVersionStr) {
        const curVer = parseFloat(existing.version || '1.0') || 1.0;
        if (bumpType === 'major') {
          nextVersionStr = `${Math.floor(curVer) + 1}.0`;
        } else {
          // minor
          nextVersionStr = (curVer + 0.1).toFixed(1);
        }
      }

      const versionId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newVersionSnapshot = {
        versionId,
        version: nextVersionStr,
        status: 'DRAFT',
        createdAt: new Date(),
        createdBy: user,
        changeSummary: changeSummary || `Version ${nextVersionStr} created from ${existing.version}`,
        geometry: geometry || existing.geometry || { objects: [] },
        parameters: parameters || existing.parameters || [],
        dimensions: dimensions || existing.dimensions || [],
        constraints: constraints || existing.constraints || [],
        calculationRules: existing.calculationRules || {},
        validationRules: existing.validationRules || {}
      };

      const versions = Array.isArray(existing.versions) ? [...existing.versions] : [];
      // Mark previous version as DEPRECATED if it was active
      const updatedVersions = versions.map(v => {
        if (v.version === existing.version && v.status === 'ACTIVE') {
          return { ...v, status: 'DEPRECATED' };
        }
        return v;
      });
      updatedVersions.push(newVersionSnapshot);

      const updateData = {
        version: nextVersionStr,
        versionId,
        status: 'DRAFT',
        geometry: newVersionSnapshot.geometry,
        parameters: newVersionSnapshot.parameters,
        dimensions: newVersionSnapshot.dimensions,
        constraints: newVersionSnapshot.constraints,
        versions: updatedVersions,
        updatedAt: new Date(),
        updatedBy: user
      };

      await db.collection('bbs_shapes').updateOne(idFilter, { $set: updateData });
      const updated = await db.collection('bbs_shapes').findOne(idFilter);
      res.json({ success: true, message: `Version ${nextVersionStr} created successfully`, shape: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating shape version' });
    }
  });

  // POST duplicate shape to a new custom shape definition
  router.post('/shapes/:id/duplicate', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const companyId = await resolveCompanyId(req, db);
      const user = req.user?.email || req.user?.name || 'User';

      const idFilter = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
        : { $or: [{ _id: id }, { id: id }] };

      const existing = await db.collection('bbs_shapes').findOne(idFilter);
      if (!existing) {
        return res.status(404).json({ message: 'Source shape not found' });
      }

      const newShapeCode = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
      const newVersionId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const duplicatedShape = {
        companyId,
        name: `${existing.name} (Copy)`,
        code: newShapeCode,
        shapeCode: newShapeCode,
        description: `Duplicated from ${existing.name} (${existing.code || existing.shapeCode})`,
        category: existing.category || 'Custom',
        subCategory: existing.subCategory || '',
        ownership: 'CUSTOM',
        status: 'DRAFT',
        version: '1.0',
        versionId: newVersionId,
        tags: Array.isArray(existing.tags) ? [...existing.tags, 'duplicate'] : ['duplicate'],
        unit: existing.unit || 'mm',
        geometry: JSON.parse(JSON.stringify(existing.geometry || { objects: [] })),
        parameters: JSON.parse(JSON.stringify(existing.parameters || [])),
        dimensions: JSON.parse(JSON.stringify(existing.dimensions || [])),
        constraints: JSON.parse(JSON.stringify(existing.constraints || [])),
        calculationRules: JSON.parse(JSON.stringify(existing.calculationRules || {})),
        validationRules: JSON.parse(JSON.stringify(existing.validationRules || {})),
        versions: [
          {
            versionId: newVersionId,
            version: '1.0',
            status: 'DRAFT',
            createdAt: new Date(),
            createdBy: user,
            changeSummary: `Initial duplicated copy from ${existing.code || existing.name}`,
            geometry: JSON.parse(JSON.stringify(existing.geometry || { objects: [] })),
            parameters: JSON.parse(JSON.stringify(existing.parameters || [])),
            dimensions: JSON.parse(JSON.stringify(existing.dimensions || [])),
            constraints: JSON.parse(JSON.stringify(existing.constraints || []))
          }
        ],
        metadata: {
          unit: existing.unit || 'mm',
          usageCount: 0,
          favorite: false,
          sourceShapeId: String(existing._id || existing.id)
        },
        createdAt: new Date(),
        createdBy: user,
        updatedAt: new Date(),
        updatedBy: user
      };

      const result = await db.collection('bbs_shapes').insertOne(duplicatedShape);
      res.status(201).json({ ...duplicatedShape, _id: result.insertedId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error duplicating shape' });
    }
  });

  // PUT update shape lifecycle status (DRAFT | ACTIVE | DEPRECATED | ARCHIVED)
  router.put('/shapes/:id/status', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const user = req.user?.email || req.user?.name || 'User';
      const { status } = req.body;

      if (!status || !['DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED'].includes(status.toUpperCase())) {
        return res.status(400).json({ message: 'Valid status required: DRAFT, ACTIVE, DEPRECATED, or ARCHIVED' });
      }

      const idFilter = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
        : { $or: [{ _id: id }, { id: id }] };

      const existing = await db.collection('bbs_shapes').findOne(idFilter);
      if (!existing) {
        return res.status(404).json({ message: 'Shape not found' });
      }

      const newStatus = status.toUpperCase();
      const versions = Array.isArray(existing.versions) ? [...existing.versions] : [];
      const currentVersionIndex = versions.findIndex(v => v.version === existing.version);
      if (currentVersionIndex >= 0) {
        versions[currentVersionIndex].status = newStatus;
      }

      await db.collection('bbs_shapes').updateOne(
        idFilter,
        {
          $set: {
            status: newStatus,
            versions,
            updatedAt: new Date(),
            updatedBy: user
          }
        }
      );

      const updated = await db.collection('bbs_shapes').findOne(idFilter);
      res.json({ success: true, status: newStatus, shape: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating shape status' });
    }
  });

  // POST archive shape (safe soft-archive)
  router.post('/shapes/:id/archive', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const user = req.user?.email || req.user?.name || 'User';

      const idFilter = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
        : { $or: [{ _id: id }, { id: id }] };

      await db.collection('bbs_shapes').updateOne(
        idFilter,
        { $set: { status: 'ARCHIVED', updatedAt: new Date(), updatedBy: user } }
      );

      res.json({ success: true, message: 'Shape archived' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error archiving shape' });
    }
  });

  // POST restore shape from archive
  router.post('/shapes/:id/restore', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const user = req.user?.email || req.user?.name || 'User';

      const idFilter = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
        : { $or: [{ _id: id }, { id: id }] };

      await db.collection('bbs_shapes').updateOne(
        idFilter,
        { $set: { status: 'ACTIVE', updatedAt: new Date(), updatedBy: user } }
      );

      res.json({ success: true, message: 'Shape restored to active library' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error restoring shape' });
    }
  });

  // DELETE a custom shape (Safe Delete Policy: preferred for drafts/unreferenced)
  router.delete('/shapes/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;

      if (!id || id === 'undefined' || id === 'null') {
        return res.status(400).json({ message: 'Valid Shape ID is required' });
      }

      const idFilter = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
        : { $or: [{ _id: id }, { id: id }] };

      await db.collection('bbs_shapes').deleteMany(idFilter);

      res.json({ success: true, message: 'Shape deleted' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting shape' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. BBS SHAPE INSTANCES (REBAR USAGES ON STRUCTURAL MEMBERS)
  // ════════════════════════════════════════════════════════════════════════════

  // GET instances for a member
  router.get('/shapes/instances/member/:memberId', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const { memberId } = req.params;
      const instances = await db.collection('bbs_shape_instances').find({ memberId }).toArray();
      res.json(instances);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching shape instances' });
    }
  });

  // POST create a shape instance (Independent instance with parameter overrides & frozen calculation)
  router.post('/shapes/instances', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        shapeId,
        shapeVersionId,
        shapeVersion,
        memberId,
        projectId,
        blockId,
        levelId,
        label,
        barMark,
        barDiameter,
        parameterValues,
        calculationSnapshot
      } = req.body;

      if (!shapeId) {
        return res.status(400).json({ message: 'shapeId is required' });
      }

      const newInstance = {
        companyId,
        shapeId,
        shapeVersionId: shapeVersionId || 'v1.0',
        shapeVersion: shapeVersion || '1.0',
        memberId: memberId || null,
        projectId: projectId || null,
        blockId: blockId || null,
        levelId: levelId || null,
        label: label || 'Rebar',
        barMark: barMark || '',
        barDiameter: Number(barDiameter) || 16,
        parameterValues: parameterValues || {},
        calculationSnapshot: calculationSnapshot || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('bbs_shape_instances').insertOne(newInstance);

      // Increment usageCount in master shape definition metadata
      const idFilter = ObjectId.isValid(shapeId)
        ? { $or: [{ _id: new ObjectId(shapeId) }, { _id: shapeId }, { id: shapeId }] }
        : { $or: [{ _id: shapeId }, { id: shapeId }] };
      await db.collection('bbs_shapes').updateOne(idFilter, { $inc: { 'metadata.usageCount': 1 } });

      res.status(201).json({ ...newInstance, _id: result.insertedId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating shape instance' });
    }
  });

  // GET member detailing configuration & active schedule instances
  router.get('/members/:memberId/detailing', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const memberId = req.params.memberId;
      const memFilter = ObjectId.isValid(memberId) && memberId.length === 24
        ? { $or: [{ _id: new ObjectId(memberId) }, { _id: memberId }] }
        : { _id: memberId };
      const member = await db.collection('bbs_members').findOne(memFilter);
      if (!member) {
        return res.status(404).json({ message: 'Structural member not found' });
      }

      // STRICT REVISION FILTERING: Return only instances matching the committed activeRevision
      const activeRevision = member.activeRevision;
      let instances: any[] = [];
      if (activeRevision) {
        instances = await db.collection('bbs_shape_instances').find({
          memberId: String(memberId),
          revisionId: activeRevision
        }).toArray();
      }

      res.json({
        member,
        detailingConfig: member.detailingConfig || {},
        instances: instances || [],
        activeRevision: activeRevision || null
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error loading member detailing' });
    }
  });

  // POST save member schedule atomically (Staged revision write protocol)
  router.post('/members/:memberId/schedule', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const memberId = req.params.memberId;
      const { detailingConfig, dimensions, rebarItems, summary } = req.body;

      const memFilter = ObjectId.isValid(memberId) && memberId.length === 24
        ? { $or: [{ _id: new ObjectId(memberId) }, { _id: memberId }] }
        : { _id: memberId };
      const member = await db.collection('bbs_members').findOne(memFilter);
      if (!member) {
        return res.status(404).json({ message: 'Structural member not found' });
      }

      const revisionId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();

      // Prepare instances with explicit revisionId
      const instanceDocs = Array.isArray(rebarItems) ? rebarItems.map((item: any, idx: number) => ({
        companyId,
        memberId: String(memberId),
        projectId: String(member.projectId || ''),
        blockId: String(member.blockId || ''),
        levelId: String(member.levelId || ''),
        revisionId,
        barMark: item.barMark || String(idx + 1).padStart(2, '0'),
        label: item.description || item.label || 'Rebar',
        description: item.description || item.label || 'Rebar',
        shapeCode: item.shapeCode || 'Shape 00',
        shapeId: item.shapeId || item.shapeCode || 'Shape 00',
        shapeVersion: '1.0',
        barDiameter: Number(item.diameter || item.barDiameter || 16),
        quantity: Number(item.quantity || item.bar_count || 1),
        spacing: Number(item.spacing || 0),
        cut_length: Number(item.cut_length || 0),
        total_length: Number(item.total_length || 0),
        unit_weight: Number(item.unit_weight || 0),
        total_weight: Number(item.total_weight || 0),
        parameterValues: item.parameterValues || item.part_dimensions || {},
        calculationSnapshot: item.calculationTrace || item.calculationSnapshot || {},
        ruleClassification: item.ruleClassification || 'DESIGNER_PROVIDED_VALUE',
        createdAt: now,
        updatedAt: now
      })) : [];

      // 1. Stage new instances under unique revisionId
      if (instanceDocs.length > 0) {
        await db.collection('bbs_shape_instances').insertMany(instanceDocs);
      }

      // 2. Commit member update with activeRevision
      const totalWeight = summary?.totalSteelWeight !== undefined
        ? Number(summary.totalSteelWeight)
        : instanceDocs.reduce((sum: number, doc: any) => sum + (doc.total_weight || 0), 0);

      const concVolume = summary?.concreteVolume !== undefined
        ? Number(summary.concreteVolume)
        : (member.concrete_volume || 0);

      const updatePayload: any = {
        detailingConfig: detailingConfig || {},
        total_steel_weight: Math.round(totalWeight * 100) / 100,
        concrete_volume: Math.round(concVolume * 1000) / 1000,
        completionPercentage: 100,
        status: 'Calculated',
        activeRevision: revisionId,
        updatedAt: now
      };
      if (dimensions) {
        updatePayload.dimensions = dimensions;
      }

      await db.collection('bbs_members').updateOne(memFilter, { $set: updatePayload });

      // 3. Clean up prior superseded revisions safely
      await db.collection('bbs_shape_instances').deleteMany({
        memberId: String(memberId),
        revisionId: { $ne: revisionId }
      }).catch((cleanErr: any) => {
        console.warn('Non-fatal cleanup note:', cleanErr?.message);
      });

      const updatedMember = await db.collection('bbs_members').findOne(memFilter);

      res.status(200).json({
        success: true,
        member: updatedMember,
        revisionId,
        instancesCount: instanceDocs.length,
        totalSteelWeight: updatePayload.total_steel_weight
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error saving member schedule' });
    }
  });

  // GET Project Material Take-Off (MTO) Roll-Up
  router.get('/projects/:projectId/mto', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { projectId, project } = await resolveCanonicalProjectId(db, ctx, req.params.projectId);

      // Fetch active members
      const members = await db.collection('bbs_members').find({ projectId }).toArray();

      // STRICT MTO ISOLATION: Build exact pairs of { memberId, revisionId: member.activeRevision }
      const activeMemberRevisions = members
        .filter((m: any) => m.activeRevision && String(m.activeRevision).trim() !== '')
        .map((m: any) => ({
          memberId: String(m._id || m.id),
          revisionId: String(m.activeRevision)
        }));

      let instances: any[] = [];
      if (activeMemberRevisions.length > 0) {
        instances = await db.collection('bbs_shape_instances').find({
          $or: activeMemberRevisions
        }).toArray();
      }

      // Aggregate by diameter
      const diameterMap: Record<number, { diameter: number; totalPieces: number; totalLengthM: number; totalWeightKg: number }> = {};
      const STANDARD_DIAMETERS = [8, 10, 12, 16, 20, 25, 32, 40];
      STANDARD_DIAMETERS.forEach(d => {
        diameterMap[d] = { diameter: d, totalPieces: 0, totalLengthM: 0, totalWeightKg: 0 };
      });

      let grandTotalPieces = 0;
      let grandTotalLengthM = 0;
      let grandTotalWeightKg = 0;

      instances.forEach((inst: any) => {
        const d = Number(inst.barDiameter || inst.diameter || 16);
        const pcs = Number(inst.quantity || inst.bar_count || 0);
        const cutMm = Number(inst.cut_length || 0);
        const lenM = (pcs * cutMm) / 1000;
        const wtKg = Number(inst.total_weight || 0) || (lenM * (Math.pow(d, 2) / 162.28));

        if (!diameterMap[d]) {
          diameterMap[d] = { diameter: d, totalPieces: 0, totalLengthM: 0, totalWeightKg: 0 };
        }
        diameterMap[d].totalPieces += pcs;
        diameterMap[d].totalLengthM += lenM;
        diameterMap[d].totalWeightKg += wtKg;

        grandTotalPieces += pcs;
        grandTotalLengthM += lenM;
        grandTotalWeightKg += wtKg;
      });

      const mtoSummary = Object.values(diameterMap)
        .filter((row: any) => row.totalPieces > 0 || STANDARD_DIAMETERS.slice(0, 6).includes(row.diameter))
        .map((row: any) => ({
          ...row,
          totalLengthM: Math.round(row.totalLengthM * 100) / 100,
          totalWeightKg: Math.round(row.totalWeightKg * 100) / 100,
          totalWeightMT: Math.round((row.totalWeightKg / 1000) * 1000) / 1000
        }));

      res.json({
        project,
        mto: mtoSummary,
        summary: {
          totalMembers: members.length,
          calculatedMembers: members.filter((m: any) => m.completionPercentage === 100 || m.status === 'Calculated').length,
          totalPieces: grandTotalPieces,
          totalLengthM: Math.round(grandTotalLengthM * 100) / 100,
          totalWeightKg: Math.round(grandTotalWeightKg * 100) / 100,
          totalTonnageMT: Math.round((grandTotalWeightKg / 1000) * 1000) / 1000
        }
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error generating project MTO' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 7. COMPATIBILITY & DASHBOARD MATRIX ENDPOINTS
  // ════════════════════════════════════════════════════════════════════════════

  // Compatibility: GET all levels for a project
  router.get('/projects/:projectId/levels', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { projectId } = await resolveCanonicalProjectId(db, ctx, req.params.projectId);
      const blocks = await syncAndListBbsBlocks(db, ctx.companyId, projectId);
      const blockIds = blocks.map((b: any) => String(b._id));
      const levels = await db.collection('bbs_levels').find({
        $or: [{ projectId }, { blockId: { $in: blockIds } }]
      }).toArray().catch(() => []);
      res.json(levels);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching project levels' });
    }
  });

  // Compatibility: GET dashboard matrix for a project
  router.get('/projects/:projectId/matrix', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { projectId, project } = await resolveCanonicalProjectId(db, ctx, req.params.projectId);
      const blocks = await syncAndListBbsBlocks(db, ctx.companyId, projectId);
      const blockIds = blocks.map((b: any) => String(b._id));
      const [levels, members] = await Promise.all([
        db.collection('bbs_levels').find({
          $or: [{ projectId }, { blockId: { $in: blockIds } }]
        }).toArray().catch(() => []),
        db.collection('bbs_members').find({
          $or: [{ projectId }, { blockId: { $in: blockIds } }]
        }).toArray().catch(() => [])
      ]);

      const totalSteelWeight = members.reduce((sum: number, m: any) => sum + (Number(m.total_steel_weight) || 0), 0);
      const totalConcreteVolume = members.reduce((sum: number, m: any) => sum + (Number(m.concrete_volume) || 0), 0);
      const totalMembers = members.length;
      const calculatedMembers = members.filter((m: any) => m.completionPercentage === 100 || m.status === 'Calculated').length;

      res.json({
        project,
        blocks,
        levels,
        members,
        kpis: {
          totalSteelWeight: Math.round(totalSteelWeight * 100) / 100,
          totalSteelWeightMT: Math.round((totalSteelWeight / 1000) * 100) / 100,
          totalConcreteVolume: Math.round(totalConcreteVolume * 100) / 100,
          totalMembers,
          calculatedMembers,
          remainingMembers: totalMembers - calculatedMembers,
          progressPercent: totalMembers > 0 ? Math.round((calculatedMembers / totalMembers) * 100) : 0,
        }
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching dashboard matrix' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DYNAMIC BBS SUMMARY DASHBOARD ENDPOINT
  // Returns synchronized blocks, levels, calculated members and strictly active revision shape instances
  // ════════════════════════════════════════════════════════════════════════════
  router.get('/projects/:projectId/summary-dashboard', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { projectId, project } = await resolveCanonicalProjectId(db, ctx, req.params.projectId);
      const blocks = await syncAndListBbsBlocks(db, ctx.companyId, projectId);
      const blockIds = blocks.map((b: any) => String(b._id));

      const [levels, members] = await Promise.all([
        db.collection('bbs_levels').find({
          $or: [{ projectId }, { blockId: { $in: blockIds } }]
        }).sort({ order: 1, createdAt: 1 }).toArray().catch(() => []),
        db.collection('bbs_members').find({
          $or: [{ projectId }, { blockId: { $in: blockIds } }]
        }).toArray().catch(() => [])
      ]);

      // Strict activeRevision resolution
      const memberMap = new Map();
      members.forEach((m: any) => {
        memberMap.set(String(m._id || m.id), m);
      });

      const activeMemberRevisions = members
        .filter((m: any) => m.activeRevision && String(m.activeRevision).trim() !== '')
        .map((m: any) => ({
          memberId: String(m._id || m.id),
          revisionId: String(m.activeRevision)
        }));

      let rawInstances: any[] = [];
      if (activeMemberRevisions.length > 0) {
        rawInstances = await db.collection('bbs_shape_instances').find({
          $or: activeMemberRevisions
        }).toArray();
      }

      // Format and enrich instances with blockId and levelId from member if missing
      const instances = rawInstances.map((inst: any) => {
        const mem = memberMap.get(String(inst.memberId));
        return {
          _id: String(inst._id),
          memberId: String(inst.memberId),
          blockId: String(inst.blockId || mem?.blockId || ''),
          levelId: String(inst.levelId || mem?.levelId || ''),
          revisionId: String(inst.revisionId),
          barMark: inst.barMark || '',
          description: inst.description || inst.label || 'Rebar',
          shapeCode: inst.shapeCode || 'Shape 00',
          shapeId: inst.shapeId || '',
          diameter: Number(inst.barDiameter || inst.diameter || 16),
          quantity: Number(inst.quantity || inst.bar_count || 1),
          spacing: Number(inst.spacing || 0),
          cut_length: Number(inst.cut_length || 0),
          total_length: Number(inst.total_length || 0),
          unit_weight: Number(inst.unit_weight || 0),
          total_weight: Number(inst.total_weight || 0),
          ruleClassification: inst.ruleClassification || 'DESIGNER_PROVIDED_VALUE',
          ruleSource: inst.ruleSource || '',
          parameterValues: inst.parameterValues || {}
        };
      });

      res.json({
        project,
        blocks: blocks.map((b: any) => ({
          _id: String(b._id),
          id: String(b._id),
          name: b.name,
          description: b.description || ''
        })),
        levels: levels.map((l: any) => ({
          _id: String(l._id),
          id: String(l._id),
          blockId: String(l.blockId),
          name: l.name,
          floorNumber: l.floorNumber,
          order: l.order ?? 0
        })),
        members: members.map((m: any) => ({
          _id: String(m._id || m.id),
          id: String(m._id || m.id),
          blockId: String(m.blockId || ''),
          levelId: String(m.levelId || ''),
          displayId: m.displayId || m.member_id || 'M1',
          memberType: m.memberType || 'Member',
          status: m.status || 'Pending',
          completionPercentage: m.completionPercentage || 0,
          activeRevision: m.activeRevision || null,
          total_steel_weight: Number(m.total_steel_weight) || 0,
          concrete_volume: Number(m.concrete_volume) || 0,
          dimensions: m.dimensions || {}
        })),
        instances
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching BBS Summary Dashboard data' });
    }
  });

  // Compatibility: GET templates
  router.get('/templates', authMiddleware, async (_req: any, res: any) => {
    try {
      const db = getDb();
      const templates = await db.collection('bbs_templates').find({}).toArray().catch(() => []);
      res.json(templates);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching templates' });
    }
  });

  return router;
}

