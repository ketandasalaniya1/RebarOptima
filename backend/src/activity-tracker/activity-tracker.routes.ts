import { Router } from 'express';
import { ObjectId, Db } from 'mongodb';
import {
  resolveUserAndCompany,
  assertProjectAccess,
  idQuery,
} from '../projects/project-access';
import { assertBlockInProject } from '../projects/project-blocks.service';
import {
  ActivityDoc,
  ActivityDailyUpdateDoc,
  ActivityPhotoDoc,
  ActivityWeightagePeriod,
} from './activity-tracker.types';
import { ActivityReportsService } from './activity-reports.service';

export function toObjectId(id: any): ObjectId | null {
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

export function companyFilter(companyId: any): any {
  if (!companyId) return { companyId: null };
  const objId = toObjectId(companyId);
  if (objId) {
    return { $or: [{ companyId: objId }, { companyId: String(companyId) }] };
  }
  return { companyId: String(companyId) };
}

/**
 * Ensures required indexes exist for the Activity Tracker module
 */
let indexesEnsured = false;
async function ensureActivityTrackerIndexes(db: Db) {
  if (indexesEnsured) return;
  try {
    const actColl = db.collection('activities');
    await actColl.createIndex({ companyId: 1, projectId: 1, blockId: 1, isArchived: 1 });
    await actColl.createIndex({ companyId: 1, blockId: 1, floorId: 1 });
    await actColl.createIndex({ companyId: 1, parentActivityId: 1 });
    await actColl.createIndex({ companyId: 1, assignedUserIds: 1 });
    await actColl.createIndex({ companyId: 1, plannedEndDate: 1, status: 1 });

    const updatesColl = db.collection('activity_daily_updates');
    // Unique compound index: One canonical update per activity per date
    await updatesColl.createIndex({ activityId: 1, updateDate: 1 }, { unique: true });
    await updatesColl.createIndex({ companyId: 1, projectId: 1, blockId: 1, updateDate: -1 });
    await updatesColl.createIndex({ companyId: 1, updateDate: 1 });

    const photosColl = db.collection('activity_photos');
    await photosColl.createIndex({ activityId: 1, createdAt: -1 });
    await photosColl.createIndex({ companyId: 1, projectId: 1 });

    indexesEnsured = true;
  } catch (err: any) {
    console.warn('⚠️ Warning ensuring activity tracker indexes:', err?.message || err);
  }
}

/**
 * Recalculates automatic parent progress from its children using the effective weightage version
 */
async function recalculateParentProgress(
  db: Db,
  parentActivityId: ObjectId | string,
  effectiveDateStr?: string,
): Promise<number | null> {
  const pId = toObjectId(parentActivityId);
  if (!pId) return null;

  const parent: ActivityDoc = (await db.collection('activities').findOne({ _id: pId })) as any;
  if (!parent || parent.progressMode !== 'AUTOMATIC') return null;

  const children: ActivityDoc[] = (await db
    .collection('activities')
    .find({ parentActivityId: pId, isArchived: { $ne: true } })
    .toArray()) as any;

  if (children.length === 0) return null;

  const queryDate = effectiveDateStr || new Date().toISOString().split('T')[0];
  const weightagePeriod = ActivityReportsService.getEffectiveWeightage(parent.weightageHistory, queryDate);

  let computedProgress = 0;
  if (weightagePeriod && weightagePeriod.weightages.length > 0) {
    const weightMap = new Map<string, number>();
    weightagePeriod.weightages.forEach((w) => weightMap.set(String(w.childActivityId), Number(w.weightage)));

    let totalWeight = 0;
    children.forEach((c) => {
      const weight = weightMap.get(String(c._id)) || 0;
      totalWeight += weight;
      computedProgress += (Number(c.currentProgress || 0) * weight) / 100;
    });

    if (totalWeight > 0 && Math.abs(totalWeight - 100) > 0.05) {
      // Normalize if weights slightly drifted
      computedProgress = (computedProgress / totalWeight) * 100;
    }
  } else {
    // Equal weights fallback if unconfigured
    const equalWeight = 100 / children.length;
    children.forEach((c) => {
      computedProgress += (Number(c.currentProgress || 0) * equalWeight) / 100;
    });
  }

  computedProgress = Math.round(computedProgress * 100) / 100;
  if (computedProgress > 100) computedProgress = 100;
  if (computedProgress < 0) computedProgress = 0;

  // Evaluate new parent status
  let newStatus = parent.status;
  if (parent.status !== 'ON_HOLD' && parent.status !== 'CANCELLED') {
    if (computedProgress >= 100) newStatus = 'COMPLETED';
    else if (computedProgress > 0) newStatus = 'IN_PROGRESS';
    else newStatus = 'NOT_STARTED';
  }

  const updateFields: any = {
    currentProgress: computedProgress,
    status: newStatus,
    updatedAt: new Date(),
  };

  if (computedProgress > 0 && !parent.actualStartDate) {
    updateFields.actualStartDate = queryDate;
  }
  if (computedProgress >= 100 && !parent.actualCompletionDate) {
    updateFields.actualCompletionDate = queryDate;
  }
  if (computedProgress < 100 && parent.actualCompletionDate) {
    updateFields.actualCompletionDate = null;
  }

  await db.collection('activities').updateOne({ _id: pId }, { $set: updateFields, $inc: { version: 1 } });
  return computedProgress;
}

export function createActivityTrackerRouter(
  getDb: () => any,
  authMiddleware: any,
  logAudit?: any,
): Router {
  const router = Router();
  router.use(authMiddleware);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. DASHBOARD & SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/summary', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      await ensureActivityTrackerIndexes(db);
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const projectId = req.query.projectId ? String(req.query.projectId) : null;
      if (!projectId) {
        return res.status(400).json({ message: 'projectId is required' });
      }

      await assertProjectAccess(db, ctx, projectId);
      const pMatcher = toObjectId(projectId) || projectId;

      const blockId = req.query.blockId ? String(req.query.blockId) : null;
      const bMatcher = blockId && blockId !== 'ALL' ? toObjectId(blockId) || blockId : null;

      const actFilter: any = {
        companyId: toObjectId(companyId) || companyId,
        projectId: pMatcher,
        isArchived: { $ne: true },
      };
      if (bMatcher) actFilter.blockId = bMatcher;

      const activities: ActivityDoc[] = (await db.collection('activities').find(actFilter).toArray()) as any;

      const todayStr = new Date().toISOString().split('T')[0];
      let completed = 0;
      let inProgress = 0;
      let notStarted = 0;
      let onHold = 0;
      let overdue = 0;
      let totalProgress = 0;

      activities.forEach((a) => {
        const prog = Number(a.currentProgress || 0);
        totalProgress += prog;

        if (a.status === 'COMPLETED' || prog >= 100) completed++;
        else if (a.status === 'ON_HOLD') onHold++;
        else if (prog > 0) inProgress++;
        else notStarted++;

        if (todayStr > a.plannedEndDate && a.status !== 'COMPLETED' && a.status !== 'CANCELLED') {
          overdue++;
        }
      });

      const overallProgress =
        activities.length > 0 ? Math.round((totalProgress / activities.length) * 100) / 100 : 0;

      // Count today's updates
      const updateFilter: any = {
        companyId: toObjectId(companyId) || companyId,
        projectId: pMatcher,
        updateDate: todayStr,
      };
      if (bMatcher) updateFilter.blockId = bMatcher;
      const todayUpdatesCount = await db.collection('activity_daily_updates').countDocuments(updateFilter);

      res.json({
        totalActivities: activities.length,
        completed,
        inProgress,
        notStarted,
        onHold,
        overdue,
        overallProgress,
        todayUpdatesCount,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to fetch summary' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PROGRESS OVERVIEW (Actual Progress Trend Over Time)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/overview', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const projectId = String(req.query.projectId || '');
      if (!projectId) return res.status(400).json({ message: 'projectId is required' });

      await assertProjectAccess(db, ctx, projectId);
      const blockId = req.query.blockId ? String(req.query.blockId) : null;

      const filter: any = {
        companyId: toObjectId(ctx.companyId) || ctx.companyId,
        projectId: toObjectId(projectId) || projectId,
      };
      if (blockId && blockId !== 'ALL') {
        filter.blockId = toObjectId(blockId) || blockId;
      }

      // Fetch all daily updates sorted by date
      const updates = await db
        .collection('activity_daily_updates')
        .find(filter)
        .sort({ updateDate: 1 })
        .project({ updateDate: 1, cumulativeProgress: 1, activityId: 1, isDelayed: 1 })
        .toArray();

      // Aggregate cumulative average trend per date
      const dateMap = new Map<string, { total: number; count: number; delayedCount: number }>();
      updates.forEach((u: any) => {
        const d = u.updateDate;
        if (!dateMap.has(d)) dateMap.set(d, { total: 0, count: 0, delayedCount: 0 });
        const entry = dateMap.get(d)!;
        entry.total += Number(u.cumulativeProgress || 0);
        entry.count += 1;
        if (u.isDelayed) entry.delayedCount += 1;
      });

      const trend = Array.from(dateMap.entries()).map(([date, val]) => ({
        date,
        averageProgress: Math.round((val.total / val.count) * 100) / 100,
        updatesLogged: val.count,
        delaysLogged: val.delayedCount,
      }));

      // Key Project / Block milestone markers
      const actFilter = { ...filter, isArchived: { $ne: true } };
      const activities = await db.collection('activities').find(actFilter).project({ plannedStartDate: 1, plannedEndDate: 1 }).toArray();
      let earliestStart: string | null = null;
      let latestEnd: string | null = null;
      activities.forEach((a: any) => {
        if (!earliestStart || a.plannedStartDate < earliestStart) earliestStart = a.plannedStartDate;
        if (!latestEnd || a.plannedEndDate > latestEnd) latestEnd = a.plannedEndDate;
      });

      res.json({
        trend,
        milestones: {
          earliestPlannedStart: earliestStart,
          latestPlannedFinish: latestEnd,
        },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to load progress overview' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ACTIVITIES CRUD & STRICT 2-LEVEL WBS
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/activities', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const projectId = String(req.query.projectId || '');
      if (!projectId) return res.status(400).json({ message: 'projectId is required' });

      await assertProjectAccess(db, ctx, projectId);
      const companyId = ctx.companyId;

      const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 50), 10)));
      const skip = (page - 1) * limit;

      const blockId = req.query.blockId ? String(req.query.blockId) : null;
      const floorId = req.query.floorId ? String(req.query.floorId) : null;
      const status = req.query.status ? String(req.query.status) : null;
      const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';

      const filter: any = {
        companyId: toObjectId(companyId) || companyId,
        projectId: toObjectId(projectId) || projectId,
        isArchived: req.query.archived === 'true' ? true : { $ne: true },
      };

      if (blockId && blockId !== 'ALL') {
        filter.blockId = toObjectId(blockId) || blockId;
      }
      if (floorId && floorId !== 'ALL') {
        filter.floorId = toObjectId(floorId) || floorId;
      }
      if (status && status !== 'ALL') {
        filter.status = status;
      }
      if (search) {
        filter.$or = [
          { nameLower: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      const total = await db.collection('activities').countDocuments(filter);
      const activities: ActivityDoc[] = (await db
        .collection('activities')
        .find(filter)
        .sort({ parentActivityId: 1, plannedStartDate: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .toArray()) as any;

      // Enrich with floor, block, parent names & overdue status
      const todayStr = new Date().toISOString().split('T')[0];
      const floorIds = Array.from(new Set(activities.map((a) => String(a.floorId)).filter(Boolean)));
      const parentIds = Array.from(new Set(activities.map((a) => String(a.parentActivityId)).filter(Boolean)));

      const [floors, parents] = await Promise.all([
        floorIds.length > 0
          ? db.collection('project_floors').find({ _id: { $in: floorIds.map((id) => toObjectId(id) || id) } as any }).toArray()
          : [],
        parentIds.length > 0
          ? db.collection('activities').find({ _id: { $in: parentIds.map((id) => toObjectId(id) || id) } as any }).toArray()
          : [],
      ]);

      const floorMap = new Map<string, string>();
      floors.forEach((f: any) => floorMap.set(String(f._id), f.name));
      const parentMap = new Map<string, string>();
      parents.forEach((p: any) => parentMap.set(String(p._id), p.name));

      // Count children per parent
      const parentActivityIds = activities.map((a) => a._id);
      const childrenCounts = await db
        .collection('activities')
        .aggregate([
          { $match: { parentActivityId: { $in: parentActivityIds }, isArchived: { $ne: true } } },
          { $group: { _id: '$parentActivityId', count: { $sum: 1 } } },
        ])
        .toArray();
      const childrenMap = new Map<string, number>();
      childrenCounts.forEach((c: any) => childrenMap.set(String(c._id), c.count));

      const enriched = activities.map((a) => {
        const isOverdue =
          todayStr > a.plannedEndDate && a.status !== 'COMPLETED' && a.status !== 'CANCELLED';
        return {
          ...a,
          id: String(a._id),
          floorName: a.floorId ? floorMap.get(String(a.floorId)) : undefined,
          parentName: a.parentActivityId ? parentMap.get(String(a.parentActivityId)) : undefined,
          childCount: childrenMap.get(String(a._id)) || 0,
          isOverdue,
        };
      });

      res.json({
        activities: enriched,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to list activities' });
    }
  });

  router.get('/activities/:id', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const actId = toObjectId(req.params.id);
      if (!actId) return res.status(400).json({ message: 'Invalid activity id' });

      const activity: ActivityDoc = (await db.collection('activities').findOne({ _id: actId })) as any;
      if (!activity) return res.status(404).json({ message: 'Activity not found' });

      await assertProjectAccess(db, ctx, String(activity.projectId));

      // Fetch children if parent
      const children = await db
        .collection('activities')
        .find({ parentActivityId: actId, isArchived: { $ne: true } })
        .toArray();

      // Fetch recent daily updates
      const recentUpdates = await db
        .collection('activity_daily_updates')
        .find({ activityId: actId })
        .sort({ updateDate: -1 })
        .limit(20)
        .toArray();

      const todayStr = new Date().toISOString().split('T')[0];
      const isOverdue =
        todayStr > activity.plannedEndDate &&
        activity.status !== 'COMPLETED' &&
        activity.status !== 'CANCELLED';

      res.json({
        ...activity,
        id: String(activity._id),
        isOverdue,
        children: children.map((c: any) => ({ ...c, id: String(c._id) })),
        recentUpdates: recentUpdates.map((u: any) => ({ ...u, id: String(u._id) })),
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to fetch activity details' });
    }
  });

  router.post('/activities', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const {
        projectId,
        blockId,
        floorId,
        name,
        description,
        plannedStartDate,
        plannedEndDate,
        assignedUserIds = [],
        parentActivityId,
        progressMode = 'MANUAL',
      } = req.body;

      if (!projectId) return res.status(400).json({ message: 'Project is required' });
      if (!blockId) return res.status(400).json({ message: 'Block is required' });
      if (!name || !String(name).trim()) return res.status(400).json({ message: 'Activity name is required' });
      if (!plannedStartDate || !plannedEndDate) {
        return res.status(400).json({ message: 'Planned start and finish dates are required' });
      }
      if (plannedEndDate < plannedStartDate) {
        return res.status(400).json({ message: 'Planned finish date cannot be earlier than planned start date' });
      }

      // Assert Project & Block relationship
      await assertBlockInProject(db, ctx, String(projectId), String(blockId));

      // Validate Floor/Level if provided
      let fId: ObjectId | null = null;
      if (floorId) {
        fId = toObjectId(floorId);
        const floorDoc = fId ? await db.collection('project_floors').findOne({ _id: fId } as any) : null;
        if (!floorDoc) return res.status(400).json({ message: 'Selected floor does not exist' });
      }

      // Strict Two-Level WBS Validation
      let pActId: ObjectId | null = null;
      if (parentActivityId) {
        pActId = toObjectId(parentActivityId);
        if (!pActId) return res.status(400).json({ message: 'Invalid parent activity ID' });

        const parent = await db.collection('activities').findOne({ _id: pActId });
        if (!parent) return res.status(404).json({ message: 'Parent activity not found' });

        // Enforce 2-level cap: A child activity CANNOT itself be a parent
        if (parent.parentActivityId) {
          return res.status(400).json({
            message: 'Multi-tier nesting beyond 2 levels (Parent -> Child) is prohibited.',
          });
        }
      }

      const assignedObjIds = (Array.isArray(assignedUserIds) ? assignedUserIds : [])
        .map((id) => toObjectId(id))
        .filter(Boolean) as ObjectId[];

      const now = new Date();
      const doc: ActivityDoc = {
        _id: new ObjectId(),
        companyId: toObjectId(companyId) || (companyId as any),
        projectId: toObjectId(projectId) || (projectId as any),
        blockId: toObjectId(blockId) || (blockId as any),
        floorId: fId,
        name: String(name).trim(),
        nameLower: String(name).trim().toLowerCase(),
        description: description ? String(description).trim() : '',
        parentActivityId: pActId,
        assignedUserIds: assignedObjIds,
        plannedStartDate: String(plannedStartDate),
        plannedEndDate: String(plannedEndDate),
        actualStartDate: null,
        actualCompletionDate: null,
        progressMode: progressMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'MANUAL',
        currentProgress: 0,
        status: 'NOT_STARTED',
        weightageHistory: [],
        version: 1,
        isArchived: false,
        createdBy: toObjectId(ctx.userId) || (ctx.userId as any),
        updatedBy: toObjectId(ctx.userId) || (ctx.userId as any),
        createdAt: now,
        updatedAt: now,
      };

      await db.collection('activities').insertOne(doc);

      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          companyId,
          projectId,
          action: 'ACTIVITY_CREATED',
          resource: 'activities',
          resourceId: String(doc._id),
          details: { name: doc.name, blockId, parentActivityId },
        }).catch(() => { });
      }

      res.status(201).json({ success: true, activity: { ...doc, id: String(doc._id) } });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to create activity' });
    }
  });

  router.put('/activities/:id', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const actId = toObjectId(req.params.id);
      if (!actId) return res.status(400).json({ message: 'Invalid activity id' });

      const existing: ActivityDoc = (await db.collection('activities').findOne({ _id: actId })) as any;
      if (!existing) return res.status(404).json({ message: 'Activity not found' });

      await assertProjectAccess(db, ctx, String(existing.projectId));

      const {
        name,
        description,
        floorId,
        plannedStartDate,
        plannedEndDate,
        assignedUserIds,
        status,
        progressMode,
      } = req.body;

      const updateFields: any = { updatedAt: new Date(), updatedBy: toObjectId(ctx.userId) || ctx.userId };
      if (name) {
        updateFields.name = String(name).trim();
        updateFields.nameLower = String(name).trim().toLowerCase();
      }
      if (description !== undefined) updateFields.description = String(description).trim();
      if (floorId !== undefined) updateFields.floorId = floorId ? toObjectId(floorId) : null;
      if (plannedStartDate) updateFields.plannedStartDate = String(plannedStartDate);
      if (plannedEndDate) updateFields.plannedEndDate = String(plannedEndDate);
      if (assignedUserIds) {
        updateFields.assignedUserIds = (Array.isArray(assignedUserIds) ? assignedUserIds : [])
          .map((id) => toObjectId(id))
          .filter(Boolean);
      }
      if (progressMode && ['MANUAL', 'AUTOMATIC'].includes(progressMode)) {
        updateFields.progressMode = progressMode;
      }
      if (status && ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'].includes(status)) {
        updateFields.status = status;
        if (status === 'COMPLETED' && !existing.actualCompletionDate) {
          updateFields.actualCompletionDate = new Date().toISOString().split('T')[0];
        }
      }

      await db.collection('activities').updateOne({ _id: actId }, { $set: updateFields, $inc: { version: 1 } });

      res.json({ success: true, message: 'Activity updated successfully' });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to update activity' });
    }
  });

  router.delete('/activities/:id', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const actId = toObjectId(req.params.id);
      if (!actId) return res.status(400).json({ message: 'Invalid activity id' });

      const activity: ActivityDoc = (await db.collection('activities').findOne({ _id: actId })) as any;
      if (!activity) return res.status(404).json({ message: 'Activity not found' });

      await assertProjectAccess(db, ctx, String(activity.projectId));

      // Guard: Cannot archive parent if active children exist
      const activeChildrenCount = await db.collection('activities').countDocuments({
        parentActivityId: actId,
        isArchived: { $ne: true },
      });
      if (activeChildrenCount > 0) {
        return res.status(400).json({
          message: `Cannot archive parent activity while it has ${activeChildrenCount} active child activities. Please detach or archive children first.`,
        });
      }

      await db.collection('activities').updateOne(
        { _id: actId },
        { $set: { isArchived: true, archivedAt: new Date(), updatedBy: toObjectId(ctx.userId) || ctx.userId } },
      );

      res.json({ success: true, message: 'Activity archived successfully' });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to archive activity' });
    }
  });

  router.put('/activities/:id/restore', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const actId = toObjectId(req.params.id);
      if (!actId) return res.status(400).json({ message: 'Invalid activity id' });

      const activity: ActivityDoc = (await db.collection('activities').findOne({ _id: actId })) as any;
      if (!activity) return res.status(404).json({ message: 'Activity not found' });

      await assertProjectAccess(db, ctx, String(activity.projectId));

      await db.collection('activities').updateOne(
        { _id: actId },
        { $set: { isArchived: false, archivedAt: null, updatedBy: toObjectId(ctx.userId) || ctx.userId } },
      );

      res.json({ success: true, message: 'Activity restored successfully' });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to restore activity' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. WEIGHTAGE CONFIGURATION WITH HISTORICAL VERSIONING
  // ──────────────────────────────────────────────────────────────────────────
  router.put('/activities/:id/weights', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const parentId = toObjectId(req.params.id);
      if (!parentId) return res.status(400).json({ message: 'Invalid activity id' });

      const parent: ActivityDoc = (await db.collection('activities').findOne({ _id: parentId })) as any;
      if (!parent) return res.status(404).json({ message: 'Parent activity not found' });

      await assertProjectAccess(db, ctx, String(parent.projectId));

      const { weightages = [], effectiveFrom, changeReason = 'Updated weightage distribution' } = req.body;
      if (!Array.isArray(weightages) || weightages.length === 0) {
        return res.status(400).json({ message: 'Weightages array cannot be empty' });
      }

      // Validate positive weights and 100% sum
      let sum = 0;
      const formattedWeights: any[] = [];
      for (const w of weightages) {
        const val = Number(w.weightage);
        if (isNaN(val) || val <= 0) {
          return res.status(400).json({ message: 'Each weightage must be a positive number greater than 0' });
        }
        sum += val;
        formattedWeights.push({
          childActivityId: toObjectId(w.childActivityId),
          weightage: Math.round(val * 100) / 100,
        });
      }

      if (Math.abs(sum - 100.0) > 0.05) {
        return res.status(400).json({ message: `Total weightage must equal exactly 100.00% (currently ${sum.toFixed(2)}%)` });
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const effFrom = effectiveFrom ? String(effectiveFrom) : todayStr;

      const history: ActivityWeightagePeriod[] = parent.weightageHistory || [];
      const newVersion = history.length + 1;

      // Close previous period if open
      if (history.length > 0) {
        const prev = history[history.length - 1];
        if (!prev.effectiveTo) {
          prev.effectiveTo = ActivityReportsService.getDayBefore(effFrom);
        }
      }

      const newPeriod: ActivityWeightagePeriod = {
        version: newVersion,
        effectiveFrom: effFrom,
        effectiveTo: null,
        weightages: formattedWeights,
        configuredBy: toObjectId(ctx.userId) || (ctx.userId as any),
        configuredByName: ctx.userDoc?.name || 'Authorized Engineer',
        configuredAt: new Date(),
        changeReason: String(changeReason).trim(),
      };

      history.push(newPeriod);

      await db.collection('activities').updateOne(
        { _id: parentId },
        {
          $set: {
            progressMode: 'AUTOMATIC',
            weightageHistory: history,
            updatedAt: new Date(),
            updatedBy: toObjectId(ctx.userId) || ctx.userId,
          },
          $inc: { version: 1 },
        },
      );

      // Recalculate parent progress immediately
      await recalculateParentProgress(db, parentId, effFrom);

      res.json({ success: true, message: 'Weightages saved and versioned successfully', version: newVersion });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to configure weightages' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. DAILY PLANNER (Derived Dynamically — Zero Duplicate Collection)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/planner/today', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const projectId = String(req.query.projectId || '');
      if (!projectId) return res.status(400).json({ message: 'projectId is required' });

      await assertProjectAccess(db, ctx, projectId);
      const blockId = req.query.blockId ? String(req.query.blockId) : null;
      const todayStr = new Date().toISOString().split('T')[0];

      const actFilter: any = {
        companyId: toObjectId(ctx.companyId) || ctx.companyId,
        projectId: toObjectId(projectId) || projectId,
        isArchived: { $ne: true },
        $or: [
          // Active today
          { plannedStartDate: { $lte: todayStr }, plannedEndDate: { $gte: todayStr } },
          // Overdue
          { plannedEndDate: { $lt: todayStr }, status: { $nin: ['COMPLETED', 'CANCELLED'] } },
        ],
      };
      if (blockId && blockId !== 'ALL') {
        actFilter.blockId = toObjectId(blockId) || blockId;
      }

      const activities = await db.collection('activities').find(actFilter).sort({ plannedEndDate: 1 }).toArray();

      // Check which ones have an update logged today
      const actIds = activities.map((a: any) => a._id);
      const todayUpdates = await db
        .collection('activity_daily_updates')
        .find({ activityId: { $in: actIds }, updateDate: todayStr })
        .toArray();

      const updatedMap = new Map<string, any>();
      todayUpdates.forEach((u: any) => updatedMap.set(String(u.activityId), u));

      const enriched = activities.map((a: any) => {
        const u = updatedMap.get(String(a._id));
        const isOverdue = todayStr > a.plannedEndDate && a.status !== 'COMPLETED' && a.status !== 'CANCELLED';
        return {
          ...a,
          id: String(a._id),
          isOverdue,
          updatedToday: Boolean(u),
          todayUpdate: u || null,
        };
      });

      res.json({ date: todayStr, activities: enriched });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to fetch planner today' });
    }
  });

  router.get('/planner/upcoming', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const projectId = String(req.query.projectId || '');
      if (!projectId) return res.status(400).json({ message: 'projectId is required' });

      await assertProjectAccess(db, ctx, projectId);
      const blockId = req.query.blockId ? String(req.query.blockId) : null;
      const days = parseInt(String(req.query.days || 7), 10);

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const targetDate = new Date(today.getTime() + days * 86400000);
      const targetStr = targetDate.toISOString().split('T')[0];

      const actFilter: any = {
        companyId: toObjectId(ctx.companyId) || ctx.companyId,
        projectId: toObjectId(projectId) || projectId,
        isArchived: { $ne: true },
        plannedStartDate: { $gt: todayStr, $lte: targetStr },
        status: { $ne: 'CANCELLED' },
      };
      if (blockId && blockId !== 'ALL') {
        actFilter.blockId = toObjectId(blockId) || blockId;
      }

      const activities = await db.collection('activities').find(actFilter).sort({ plannedStartDate: 1 }).toArray();
      res.json({ horizonDays: days, startDate: todayStr, endDate: targetStr, activities: activities.map((a: any) => ({ ...a, id: String(a._id) })) });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to fetch upcoming activities' });
    }
  });

  router.get('/planner/history', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const projectId = String(req.query.projectId || '');
      if (!projectId) return res.status(400).json({ message: 'projectId is required' });

      await assertProjectAccess(db, ctx, projectId);
      const blockId = req.query.blockId ? String(req.query.blockId) : null;
      const targetDate = req.query.date ? String(req.query.date) : ActivityReportsService.getDayBefore(new Date().toISOString().split('T')[0]);

      const filter: any = {
        companyId: toObjectId(ctx.companyId) || ctx.companyId,
        projectId: toObjectId(projectId) || projectId,
        updateDate: targetDate,
      };
      if (blockId && blockId !== 'ALL') {
        filter.blockId = toObjectId(blockId) || blockId;
      }

      const updates = await db.collection('activity_daily_updates').find(filter).toArray();
      const actIds = updates.map((u: any) => u.activityId);
      const activities = await db.collection('activities').find({ _id: { $in: actIds } }).toArray();
      const actMap = new Map<string, any>();
      activities.forEach((a: any) => actMap.set(String(a._id), a));

      const list = updates.map((u: any) => ({
        ...u,
        id: String(u._id),
        activityName: actMap.get(String(u.activityId))?.name || 'Activity',
      }));

      res.json({ date: targetDate, updates: list });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to fetch planner history' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. DAILY PROGRESS UPDATES & HISTORICAL CORRECTIONS
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/daily-updates', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const { activityId, blockId, projectId, startDate, endDate, isDelayed } = req.query;

      const query: any = { companyId: toObjectId(companyId) || (companyId as any) };

      if (activityId) {
        query.activityId = toObjectId(activityId);
      }
      if (blockId && blockId !== 'ALL') {
        query.blockId = toObjectId(blockId);
      }
      if (projectId) {
        query.projectId = toObjectId(projectId);
      }
      if (isDelayed === 'true' || isDelayed === true) {
        query.isDelayed = true;
      }
      if (startDate || endDate) {
        query.updateDate = {};
        if (startDate) query.updateDate.$gte = String(startDate);
        if (endDate) query.updateDate.$lte = String(endDate);
      }

      const rawUpdates = await db
        .collection('activity_daily_updates')
        .find(query)
        .sort({ updateDate: -1, createdAt: -1 })
        .limit(200)
        .toArray();

      const updates = rawUpdates.map((u: any) => ({
        ...u,
        _id: u._id?.toString(),
        activityId: u.activityId?.toString(),
        companyId: u.companyId?.toString(),
        projectId: u.projectId?.toString(),
        blockId: u.blockId?.toString(),
        floorId: u.floorId?.toString(),
        progress: u.cumulativeProgress ?? u.progress ?? 0,
        workDone: u.workDescription ?? u.workDone ?? '',
        photoIds: (u.photoIds || []).map((p: any) => p?.toString?.() || String(p)),
      }));

      res.json({ updates });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to list daily updates' });
    }
  });

  router.post('/daily-updates', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const {
        activityId,
        updateDate,
        workDescription,
        cumulativeProgress,
        isDelayed = false,
        delayReason,
        remarks,
        photoIds = [],
      } = req.body;

      if (!activityId) return res.status(400).json({ message: 'activityId is required' });
      if (!workDescription || !String(workDescription).trim()) {
        return res.status(400).json({ message: "Today's work description is required" });
      }
      const progressNum = Number(cumulativeProgress);
      if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
        return res.status(400).json({ message: 'Cumulative progress must be a number between 0 and 100' });
      }
      if (isDelayed && (!delayReason || !String(delayReason).trim())) {
        return res.status(400).json({ message: 'Delay reason is required when delay is flagged' });
      }

      const aId = toObjectId(activityId);
      if (!aId) return res.status(400).json({ message: 'Invalid activity id' });

      const activity: ActivityDoc = (await db.collection('activities').findOne({ _id: aId })) as any;
      if (!activity) return res.status(404).json({ message: 'Activity not found' });

      await assertProjectAccess(db, ctx, String(activity.projectId));

      const todayStr = new Date().toISOString().split('T')[0];
      const targetDate = updateDate ? String(updateDate) : todayStr;

      // Single Canonical Document per Activity per Date
      const existingUpdate: ActivityDailyUpdateDoc = (await db.collection('activity_daily_updates').findOne({
        activityId: aId,
        updateDate: targetDate,
      })) as any;

      const parsedPhotoIds = (Array.isArray(photoIds) ? photoIds : [])
        .map((id) => toObjectId(id))
        .filter(Boolean) as ObjectId[];

      const now = new Date();
      const previousProgress = Number(activity.currentProgress || 0);
      const progressDelta = Math.round((progressNum - previousProgress) * 100) / 100;

      if (existingUpdate) {
        // Intra-day update: Update canonical values & archive previous check into dayLogHistory
        const dayLogs = existingUpdate.dayLogHistory || [];
        dayLogs.push({
          loggedAt: existingUpdate.updatedAt || existingUpdate.createdAt,
          progress: existingUpdate.cumulativeProgress,
          workDescription: existingUpdate.workDescription,
          loggedBy: existingUpdate.createdBy,
          loggedByName: existingUpdate.createdByName || 'Site Team',
        });

        const combinedPhotos = Array.from(new Set([...(existingUpdate.photoIds || []), ...parsedPhotoIds]));

        await db.collection('activity_daily_updates').updateOne(
          { _id: existingUpdate._id },
          {
            $set: {
              cumulativeProgress: progressNum,
              workDescription: String(workDescription).trim(),
              isDelayed: Boolean(isDelayed),
              delayReason: isDelayed ? String(delayReason).trim() : null,
              remarks: remarks ? String(remarks).trim() : existingUpdate.remarks,
              photoIds: combinedPhotos,
              dayLogHistory: dayLogs,
              updatedAt: now,
            },
          },
        );
      } else {
        // Insert new canonical update
        const newUpdate: ActivityDailyUpdateDoc = {
          _id: new ObjectId(),
          activityId: aId,
          companyId: toObjectId(companyId) || (companyId as any),
          projectId: activity.projectId,
          blockId: activity.blockId,
          floorId: activity.floorId,
          updateDate: targetDate,
          workDescription: String(workDescription).trim(),
          cumulativeProgress: progressNum,
          previousProgress,
          progressDelta,
          isDelayed: Boolean(isDelayed),
          delayReason: isDelayed ? String(delayReason).trim() : null,
          remarks: remarks ? String(remarks).trim() : null,
          photoIds: parsedPhotoIds,
          dayLogHistory: [],
          editHistory: [],
          createdBy: toObjectId(ctx.userId) || (ctx.userId as any),
          createdByName: ctx.userDoc?.name || 'Site Supervisor',
          createdAt: now,
          updatedAt: now,
        };

        await db.collection('activity_daily_updates').insertOne(newUpdate);
      }

      // Update Activity Current Progress & Status
      let newStatus = activity.status;
      if (activity.status !== 'ON_HOLD' && activity.status !== 'CANCELLED') {
        if (progressNum >= 100) newStatus = 'COMPLETED';
        else if (progressNum > 0) newStatus = 'IN_PROGRESS';
        else newStatus = 'NOT_STARTED';
      }

      const actUpdateFields: any = {
        currentProgress: progressNum,
        status: newStatus,
        updatedAt: now,
        updatedBy: toObjectId(ctx.userId) || ctx.userId,
      };

      if (progressNum > 0 && !activity.actualStartDate) {
        actUpdateFields.actualStartDate = targetDate;
      }
      if (progressNum >= 100 && !activity.actualCompletionDate) {
        actUpdateFields.actualCompletionDate = targetDate;
      }
      if (progressNum < 100 && activity.actualCompletionDate) {
        actUpdateFields.actualCompletionDate = null;
      }

      await db.collection('activities').updateOne({ _id: aId }, { $set: actUpdateFields, $inc: { version: 1 } });

      // If this child belongs to a weighted parent, trigger parent recalculation
      if (activity.parentActivityId) {
        await recalculateParentProgress(db, activity.parentActivityId, targetDate);
      }

      res.status(201).json({
        success: true,
        message: 'Daily progress recorded successfully',
        currentProgress: progressNum,
        status: newStatus,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to record daily progress' });
    }
  });

  router.put('/daily-updates/:id/correct', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const updateId = toObjectId(req.params.id);
      if (!updateId) return res.status(400).json({ message: 'Invalid update id' });

      const existing: ActivityDailyUpdateDoc = (await db.collection('activity_daily_updates').findOne({ _id: updateId })) as any;
      if (!existing) return res.status(404).json({ message: 'Update record not found' });

      await assertProjectAccess(db, ctx, String(existing.projectId));

      const { cumulativeProgress, workDescription, isDelayed, delayReason, correctionReason } = req.body;
      if (!correctionReason || !String(correctionReason).trim()) {
        return res.status(400).json({ message: 'Mandatory correction reason is required for audit trail' });
      }

      const newProg = Number(cumulativeProgress);
      if (isNaN(newProg) || newProg < 0 || newProg > 100) {
        return res.status(400).json({ message: 'Cumulative progress must be between 0 and 100' });
      }

      const edits = existing.editHistory || [];
      edits.push({
        editedBy: toObjectId(ctx.userId) || (ctx.userId as any),
        editedByName: ctx.userDoc?.name || 'Authorized Engineer',
        editedAt: new Date(),
        previousCumulativeProgress: existing.cumulativeProgress,
        newCumulativeProgress: newProg,
        previousWorkDescription: existing.workDescription,
        newWorkDescription: String(workDescription || existing.workDescription).trim(),
        previousIsDelayed: existing.isDelayed,
        newIsDelayed: isDelayed !== undefined ? Boolean(isDelayed) : existing.isDelayed,
        previousDelayReason: existing.delayReason,
        newDelayReason: delayReason !== undefined ? delayReason : existing.delayReason,
        correctionReason: String(correctionReason).trim(),
      });

      await db.collection('activity_daily_updates').updateOne(
        { _id: updateId },
        {
          $set: {
            cumulativeProgress: newProg,
            workDescription: workDescription ? String(workDescription).trim() : existing.workDescription,
            isDelayed: isDelayed !== undefined ? Boolean(isDelayed) : existing.isDelayed,
            delayReason: isDelayed ? (delayReason ? String(delayReason).trim() : existing.delayReason) : null,
            editHistory: edits,
            updatedAt: new Date(),
          },
        },
      );

      // Check if this was the latest chronological update for the activity
      const latest = await db
        .collection('activity_daily_updates')
        .find({ activityId: existing.activityId })
        .sort({ updateDate: -1 })
        .limit(1)
        .toArray();

      if (latest.length > 0 && String(latest[0]._id) === String(updateId)) {
        await db.collection('activities').updateOne(
          { _id: existing.activityId },
          { $set: { currentProgress: newProg, updatedAt: new Date() }, $inc: { version: 1 } },
        );
      }

      // Check if activity has parent to recalculate
      const act: ActivityDoc = (await db.collection('activities').findOne({ _id: existing.activityId })) as any;
      if (act && act.parentActivityId) {
        await recalculateParentProgress(db, act.parentActivityId, existing.updateDate);
      }

      res.json({ success: true, message: 'Historical update corrected and audited successfully' });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to correct historical update' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. PHOTOGRAPHS UPLOAD & STREAMING (Canonical Binary Buffer)
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/photos/upload', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      const { projectId, blockId, activityId, fileName, mimeType, dataBase64 } = req.body;
      if (!projectId || !activityId || !dataBase64) {
        return res.status(400).json({ message: 'projectId, activityId, and dataBase64 are required' });
      }

      await assertProjectAccess(db, ctx, String(projectId));

      // Validate MIME type
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(mimeType)) {
        return res.status(400).json({ message: 'Only JPEG, PNG, and WebP images are allowed' });
      }

      // Convert Base64 payload to binary Buffer
      const cleanBase64 = dataBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      // 10MB safety cap (10 * 1024 * 1024 = 10485760 bytes)
      if (buffer.length > 10485760) {
        return res.status(400).json({ message: 'Photograph exceeds the maximum allowed size of 10MB' });
      }

      const photoDoc: ActivityPhotoDoc = {
        _id: new ObjectId(),
        companyId: toObjectId(companyId) || (companyId as any),
        projectId: toObjectId(projectId) || (projectId as any),
        blockId: toObjectId(blockId) || (blockId as any),
        activityId: toObjectId(activityId) || (activityId as any),
        fileName: fileName || 'site_photo.jpg',
        mimeType: mimeType as any,
        sizeBytes: buffer.length,
        buffer,
        uploadedBy: toObjectId(ctx.userId) || (ctx.userId as any),
        uploadedByName: ctx.userDoc?.name || 'Site Team',
        createdAt: new Date(),
      };

      await db.collection('activity_photos').insertOne(photoDoc);

      res.status(201).json({
        success: true,
        photoId: String(photoDoc._id),
        fileName: photoDoc.fileName,
        sizeBytes: photoDoc.sizeBytes,
        url: `/api/activity-tracker/photos/${photoDoc._id}`,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to upload photo' });
    }
  });

  router.get('/photos/:photoId', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const pId = toObjectId(req.params.photoId);
      if (!pId) return res.status(400).json({ message: 'Invalid photo id' });

      const photo: ActivityPhotoDoc = (await db.collection('activity_photos').findOne({ _id: pId })) as any;
      if (!photo) return res.status(404).json({ message: 'Photograph not found' });

      // Strict Authorization Check: Tenant matching & Project Access
      if (String(photo.companyId) !== String(ctx.companyId)) {
        return res.status(403).json({ message: 'Access denied: Photo does not belong to your company' });
      }
      await assertProjectAccess(db, ctx, String(photo.projectId));

      // Revocation Safety Headers (Safe Cache Policy)
      res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('ETag', `"${photo._id}-${photo.createdAt.getTime()}"`);
      res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
      res.setHeader('Content-Length', photo.sizeBytes);

      res.end(photo.buffer);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to stream photograph' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. PROJECT ASSIGNEES (Safe Non-Admin Lookup)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/assignees', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const projectId = String(req.query.projectId || '');
      if (!projectId) return res.status(400).json({ message: 'projectId is required' });

      await assertProjectAccess(db, ctx, projectId);
      const companyId = ctx.companyId;

      const users = await db
        .collection('users')
        .find({
          ...companyFilter(companyId),
          isActive: { $ne: false },
          $or: [
            { assignedProjects: { $in: [projectId, toObjectId(projectId)] } },
            { role: { $in: ['Admin', 'OWNER', 'ADMIN', 'Project Manager'] } },
          ],
        })
        .project({ name: 1, email: 1, role: 1 })
        .toArray();

      res.json(users.map((u: any) => ({ id: String(u._id), name: u.name, role: u.role, email: u.email })));
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to load assignees' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. INDEPENDENT REPORTING ENGINE (DPR, WPR, MPR, YPR, Custom Date)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/reports/preview', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { projectId, blockId, floorId, startDate, endDate, reportType = 'Custom' } = req.query;

      if (!projectId) return res.status(400).json({ message: 'projectId is required' });
      if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate are required' });

      await assertProjectAccess(db, ctx, String(projectId));

      const reportData = await ActivityReportsService.aggregateReportData({
        db,
        companyId: String(ctx.companyId),
        projectId: String(projectId),
        blockId: blockId ? String(blockId) : undefined,
        floorId: floorId ? String(floorId) : undefined,
        startDate: String(startDate),
        endDate: String(endDate),
        reportType: String(reportType),
      });

      res.json(reportData);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to generate report preview' });
    }
  });

  router.get('/reports/pdf', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { projectId, blockId, floorId, startDate, endDate, reportType = 'Custom' } = req.query;

      if (!projectId || !startDate || !endDate) {
        return res.status(400).json({ message: 'projectId, startDate, and endDate are required' });
      }

      await assertProjectAccess(db, ctx, String(projectId));

      const reportData = await ActivityReportsService.aggregateReportData({
        db,
        companyId: String(ctx.companyId),
        projectId: String(projectId),
        blockId: blockId ? String(blockId) : undefined,
        floorId: floorId ? String(floorId) : undefined,
        startDate: String(startDate),
        endDate: String(endDate),
        reportType: String(reportType),
      });

      const pdfBuffer = await ActivityReportsService.generatePdf(reportData);

      const fileName = `RebarOptima_${reportData.metadata.reportType}_${reportData.metadata.startDate}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.end(pdfBuffer);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to generate PDF report' });
    }
  });

  router.get('/reports/excel', async (req: any, res: any) => {
    try {
      const db: Db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { projectId, blockId, floorId, startDate, endDate, reportType = 'Custom' } = req.query;

      if (!projectId || !startDate || !endDate) {
        return res.status(400).json({ message: 'projectId, startDate, and endDate are required' });
      }

      await assertProjectAccess(db, ctx, String(projectId));

      const reportData = await ActivityReportsService.aggregateReportData({
        db,
        companyId: String(ctx.companyId),
        projectId: String(projectId),
        blockId: blockId ? String(blockId) : undefined,
        floorId: floorId ? String(floorId) : undefined,
        startDate: String(startDate),
        endDate: String(endDate),
        reportType: String(reportType),
      });

      const excelBuffer = await ActivityReportsService.generateExcel(reportData);

      const fileName = `RebarOptima_${reportData.metadata.reportType}_${reportData.metadata.startDate}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.end(excelBuffer);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Failed to generate Excel report' });
    }
  });

  return router;
}