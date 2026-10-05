import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { BBS_MEMBER_TYPES } from './bbs.types';

export function createBBSRouter(getDb: () => any, authMiddleware: any) {
  const router = Router();

  // Helper to extract companyId from authenticated user
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

  // ════════════════════════════════════════════════════════════════════════════
  // 1. BBS PROJECTS
  // ════════════════════════════════════════════════════════════════════════════

  // GET all BBS projects with aggregated stats
  router.get('/projects', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const projects = await db.collection('bbs_projects').find({ companyId }).sort({ createdAt: -1 }).toArray();

      // Enrich with blocks, levels, members count & completion %
      const enrichedProjects = await Promise.all(
        projects.map(async (project: any) => {
          const projectId = project._id.toString();

          const [blocks, levels, members] = await Promise.all([
            db.collection('bbs_blocks').find({ projectId }).toArray(),
            db.collection('bbs_levels').find({ projectId }).toArray(),
            db.collection('bbs_members').find({ projectId }).toArray()
          ]);

          let completionPercentage = 0;
          if (members.length > 0) {
            const totalProgress = members.reduce((sum: number, m: any) => sum + (Number(m.completionPercentage) || 0), 0);
            completionPercentage = Math.round(totalProgress / members.length);
          }

          return {
            ...project,
            blockCount: blocks.length,
            levelCount: levels.length,
            memberCount: members.length,
            completionPercentage
          };
        })
      );

      res.json(enrichedProjects);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching BBS projects' });
    }
  });

  // GET single BBS project with stats
  router.get('/projects/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const id = req.params.id;

      const project = await db.collection('bbs_projects').findOne({
        $or: [{ _id: new ObjectId(id) }, { _id: id }],
        companyId
      });

      if (!project) {
        return res.status(404).json({ message: 'BBS Project not found' });
      }

      const projectId = project._id.toString();
      const [blocks, levels, members] = await Promise.all([
        db.collection('bbs_blocks').find({ projectId }).toArray(),
        db.collection('bbs_levels').find({ projectId }).toArray(),
        db.collection('bbs_members').find({ projectId }).toArray()
      ]);

      let completionPercentage = 0;
      if (members.length > 0) {
        const totalProgress = members.reduce((sum: number, m: any) => sum + (Number(m.completionPercentage) || 0), 0);
        completionPercentage = Math.round(totalProgress / members.length);
      }

      res.json({
        ...project,
        blockCount: blocks.length,
        levelCount: levels.length,
        memberCount: members.length,
        completionPercentage
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching BBS project' });
    }
  });

  // POST create new BBS project
  router.post('/projects', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { name, location, description, status } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Project Name is required' });
      }

      const now = new Date();
      const newProject = {
        companyId,
        name: name.trim(),
        location: location ? location.trim() : '',
        description: description ? description.trim() : '',
        status: status || 'Active',
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('bbs_projects').insertOne(newProject);
      const created = await db.collection('bbs_projects').findOne({ _id: result.insertedId });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating BBS project' });
    }
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

  // GET blocks for a project
  router.get('/projects/:projectId/blocks', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const projectId = req.params.projectId;

      const blocks = await db.collection('bbs_blocks').find({ projectId }).sort({ displayOrder: 1, createdAt: 1 }).toArray();

      // Aggregate counts for each block
      const enriched = await Promise.all(
        blocks.map(async (b: any) => {
          const blockId = b._id.toString();
          const [levels, members] = await Promise.all([
            db.collection('bbs_levels').find({ blockId }).toArray(),
            db.collection('bbs_members').find({ blockId }).toArray()
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

  // POST create a block
  router.post('/projects/:projectId/blocks', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const projectId = req.params.projectId;
      const { name, code, description } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Block Name is required' });
      }

      const existingCount = await db.collection('bbs_blocks').countDocuments({ projectId });
      const now = new Date();
      const newBlock = {
        projectId,
        companyId,
        name: name.trim(),
        code: code ? code.trim() : '',
        description: description ? description.trim() : '',
        displayOrder: existingCount + 1,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('bbs_blocks').insertOne(newBlock);
      const created = await db.collection('bbs_blocks').findOne({ _id: result.insertedId });
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

      await db.collection('bbs_blocks').updateOne(
        { $or: [{ _id: new ObjectId(id) }, { _id: id }] },
        { $set: updateData }
      );

      const updated = await db.collection('bbs_blocks').findOne({
        $or: [{ _id: new ObjectId(id) }, { _id: id }]
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating block' });
    }
  });

  // DELETE a block (cascades to levels, members)
  router.delete('/blocks/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;

      const block = await db.collection('bbs_blocks').findOne({
        $or: [{ _id: new ObjectId(id) }, { _id: id }]
      });

      if (!block) return res.status(404).json({ message: 'Block not found' });

      const blockId = block._id.toString();

      await Promise.all([
        db.collection('bbs_blocks').deleteMany({ $or: [{ _id: new ObjectId(id) }, { _id: id }] }),
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
      const { projectId, blockId, memberType, displayId, description, completionPercentage } = req.body;

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
      const { projectId, blockId, memberType, displayIds, description, completionPercentage } = req.body;

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
      const { memberType, displayId, description, completionPercentage } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (memberType !== undefined) {
        if (!BBS_MEMBER_TYPES.includes(memberType)) {
          return res.status(400).json({ message: 'Invalid memberType' });
        }
        updateData.memberType = memberType;
      }
      if (displayId !== undefined) updateData.displayId = displayId.trim().toUpperCase();
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
  // 5. BBS SHAPE LIBRARY & PARAMETRIC BLOCKS (PHASE 2A)
  // ════════════════════════════════════════════════════════════════════════════

  // GET all custom shapes for company
  router.get('/shapes', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const shapes = await db.collection('bbs_shapes').find({ companyId }).sort({ updatedAt: -1 }).toArray();
      res.json(shapes);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error fetching shapes' });
    }
  });

  // POST create / save a new shape
  router.post('/shapes', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { name, code, category, unit, geometry } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Shape name is required' });
      }

      const newShape = {
        companyId,
        name: name.trim(),
        code: (code || 'CUSTOM').trim().toUpperCase(),
        category: category || 'Custom Drafts',
        unit: unit || 'mm',
        geometry: geometry || { objects: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('bbs_shapes').insertOne(newShape);
      res.status(201).json({ ...newShape, _id: result.insertedId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error creating shape' });
    }
  });

  // PUT update existing shape
  router.put('/shapes/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const { name, code, category, unit, geometry } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (code !== undefined) updateData.code = code.trim().toUpperCase();
      if (category !== undefined) updateData.category = category;
      if (unit !== undefined) updateData.unit = unit;
      if (geometry !== undefined) updateData.geometry = geometry;

      await db.collection('bbs_shapes').updateOne(
        { $or: [{ _id: new ObjectId(id) }, { _id: id }] },
        { $set: updateData }
      );

      const updated = await db.collection('bbs_shapes').findOne({
        $or: [{ _id: new ObjectId(id) }, { _id: id }]
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error updating shape' });
    }
  });

  // DELETE a custom shape
  router.delete('/shapes/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const id = req.params.id;

      await db.collection('bbs_shapes').deleteMany({
        $or: [{ _id: new ObjectId(id) }, { _id: id }]
      });

      res.json({ success: true, message: 'Shape deleted' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Error deleting shape' });
    }
  });

  return router;
}

