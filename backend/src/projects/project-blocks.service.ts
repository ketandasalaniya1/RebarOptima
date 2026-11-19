import { ObjectId, MongoClient } from 'mongodb';
import { assertProjectAccess, ProjectAccessContext, idQuery } from './project-access';

export const PROJECT_BLOCKS_COLLECTION = 'project_blocks';
export const MAX_BLOCKS_PER_PROJECT = 200;

export type BlockInput = {
  name: string;
  code?: string;
  description?: string;
  floorNumber?: number;
  unitNumber?: string;
  configuration?: string;
  carpetAreaSqFt?: number;
  askingPrice?: number;
};

export function normalizeBlockName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function validateBlocksPayload(blocks: unknown): {
  ok: boolean;
  message?: string;
  code?: string;
  items?: BlockInput[];
} {
  if (blocks === undefined || blocks === null) {
    return { ok: true, items: [] };
  }
  if (!Array.isArray(blocks)) {
    return { ok: false, message: 'blocks must be an array', code: 'BLOCKS_INVALID' };
  }
  if (blocks.length > MAX_BLOCKS_PER_PROJECT) {
    return {
      ok: false,
      message: `A project may have at most ${MAX_BLOCKS_PER_PROJECT} blocks`,
      code: 'BLOCKS_LIMIT',
    };
  }

  const items: BlockInput[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < blocks.length; i++) {
    const raw = blocks[i];
    const name =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object'
          ? String((raw as any).name || (raw as any).buildingTower || '')
          : '';
    const trimmed = name.trim();
    if (!trimmed) {
      return {
        ok: false,
        message: `Block #${i + 1}: Name is required`,
        code: 'BLOCK_NAME_REQUIRED',
      };
    }
    const lower = normalizeBlockName(trimmed);
    if (seen.has(lower)) {
      return {
        ok: false,
        message: `Duplicate block name "${trimmed}" (names must be unique per project)`,
        code: 'BLOCK_NAME_DUPLICATE',
      };
    }
    seen.add(lower);
    const item: BlockInput = { name: trimmed };
    if (raw && typeof raw === 'object') {
      if ((raw as any).code !== undefined) item.code = String((raw as any).code || '').trim();
      if ((raw as any).description !== undefined) {
        item.description = String((raw as any).description || '').trim();
      }
      if ((raw as any).floorNumber !== undefined && (raw as any).floorNumber !== null && (raw as any).floorNumber !== '') {
        const fn = Number((raw as any).floorNumber);
        if (!isNaN(fn)) item.floorNumber = fn;
      }
      if ((raw as any).unitNumber !== undefined && (raw as any).unitNumber !== null) {
        item.unitNumber = String((raw as any).unitNumber || '').trim();
      }
      if ((raw as any).configuration !== undefined && (raw as any).configuration !== null) {
        item.configuration = String((raw as any).configuration || '').trim();
      }
      if ((raw as any).carpetAreaSqFt !== undefined && (raw as any).carpetAreaSqFt !== null && (raw as any).carpetAreaSqFt !== '') {
        const ca = Number((raw as any).carpetAreaSqFt);
        if (!isNaN(ca)) item.carpetAreaSqFt = ca;
      }
      if ((raw as any).askingPrice !== undefined && (raw as any).askingPrice !== null && (raw as any).askingPrice !== '') {
        const ap = Number((raw as any).askingPrice);
        if (!isNaN(ap)) item.askingPrice = ap;
      }
    }
    items.push(item);
  }
  return { ok: true, items };
}

export async function ensureProjectBlocksIndexes(db: any): Promise<void> {
  const coll = db.collection(PROJECT_BLOCKS_COLLECTION);
  try {
    await coll.createIndex({ companyId: 1, projectId: 1, status: 1 });
    await coll.createIndex({ projectId: 1, displayOrder: 1 });
    await coll.createIndex(
      { projectId: 1, nameLower: 1 },
      {
        unique: true,
        partialFilterExpression: { isDeleted: { $ne: true }, status: { $ne: 'inactive' } },
        name: 'projectId_nameLower_active_unique',
      },
    );
  } catch (e: any) {
    // Index creation can race or fail on restricted envs; non-fatal for reads
    console.warn('project_blocks index ensure:', e?.message || e);
  }
}

function blockIdQuery(blockId: string) {
  return idQuery(blockId);
}

export async function listProjectBlocks(
  db: any,
  projectId: string,
  opts: { includeInactive?: boolean } = {},
) {
  const filter: any = {
    projectId: String(projectId),
    isDeleted: { $ne: true },
  };
  if (!opts.includeInactive) {
    filter.status = 'active';
  }
  const blocks = await db
    .collection(PROJECT_BLOCKS_COLLECTION)
    .find(filter)
    .sort({ displayOrder: 1, createdAt: 1 })
    .toArray();

  let targetBlocks = blocks || [];
  if (!targetBlocks || targetBlocks.length === 0) {
    // Safe backward compatibility fallback to legacy module blocks
    try {
      const castingColl = db.collection('casting_blocks');
      if (castingColl && typeof castingColl.find === 'function') {
        const castingBlocks = await castingColl
          .find({ projectId: String(projectId), isDeleted: { $ne: true } })
          .toArray();
        if (castingBlocks && castingBlocks.length > 0) {
          targetBlocks = castingBlocks.map((b: any, idx: number) => ({
            _id: b._id,
            id: String(b._id),
            companyId: b.companyId,
            projectId: String(projectId),
            name: b.name,
            code: b.code || '',
            description: b.description || '',
            displayOrder: b.displayOrder || idx + 1,
            status: b.status || 'active',
            isDeleted: false,
            isLegacyFallback: true,
          }));
        }
      }

      if (!targetBlocks || targetBlocks.length === 0) {
        const bbsColl = db.collection('bbs_blocks');
        if (bbsColl && typeof bbsColl.find === 'function') {
          const bbsBlocks = await bbsColl
            .find({ projectId: String(projectId) })
            .toArray();
          if (bbsBlocks && bbsBlocks.length > 0) {
            targetBlocks = bbsBlocks.map((b: any, idx: number) => ({
              _id: b._id,
              id: String(b._id),
              companyId: b.companyId,
              projectId: String(projectId),
              name: b.name,
              code: b.code || '',
              description: b.description || '',
              displayOrder: b.displayOrder || idx + 1,
              status: 'active',
              isDeleted: false,
              isLegacyFallback: true,
            }));
          }
        }
      }
    } catch (_e) {
      // Non-fatal fallback query error
    }
  }

  // Enrich each block with live floor and unit counts
  const floorsColl = db.collection('project_floors');
  const unitsColl = db.collection('crm_units');

  const enriched = await Promise.all(
    (targetBlocks || []).map(async (b: any) => {
      const bId = String(b._id || b.id);
      const floorCount =
        typeof floorsColl?.countDocuments === 'function'
          ? await floorsColl
              .countDocuments({
                $or: [{ blockId: bId }, { blockId: b._id }],
                isDeleted: { $ne: true },
              })
              .catch(() => 0)
          : 0;

      const unitCount =
        typeof unitsColl?.countDocuments === 'function'
          ? await unitsColl
              .countDocuments({
                $or: [
                  { blockId: bId },
                  { blockId: b._id },
                  { buildingTower: b.name },
                ],
                isDeleted: { $ne: true },
              })
              .catch(() => 0)
          : 0;

      return {
        ...b,
        floorCount,
        unitCount,
      };
    }),
  );

  return enriched;
}

/**
 * Assert block belongs to project + company (via project access).
 */
export async function assertBlockInProject(
  db: any,
  ctx: ProjectAccessContext,
  projectId: string,
  blockId: string,
  opts: { requireActive?: boolean } = {},
): Promise<{ project: any; block: any }> {
  const project = await assertProjectAccess(db, ctx, projectId, {
    requireActive: opts.requireActive !== false,
  });
  const pId = String(project._id || project.id);

  if (!blockId) {
    const err: any = new Error('Block id is required');
    err.status = 400;
    err.code = 'BLOCK_REQUIRED';
    throw err;
  }

  const block = await db.collection(PROJECT_BLOCKS_COLLECTION).findOne({
    ...blockIdQuery(String(blockId)),
    projectId: pId,
    companyId: ctx.companyId,
    isDeleted: { $ne: true },
  });

  if (!block) {
    // Also accept companyId stored as ObjectId
    const blockAlt = await db.collection(PROJECT_BLOCKS_COLLECTION).findOne({
      ...blockIdQuery(String(blockId)),
      projectId: pId,
      isDeleted: { $ne: true },
    });
    if (
      blockAlt &&
      String(blockAlt.companyId) === String(ctx.companyId)
    ) {
      if (opts.requireActive !== false && blockAlt.status && blockAlt.status !== 'active') {
        const err: any = new Error('Block is inactive');
        err.status = 403;
        err.code = 'BLOCK_INACTIVE';
        throw err;
      }
      return { project, block: blockAlt };
    }

    // Check fallback legacy collections before failing
    try {
      const castingBlock = await db.collection('casting_blocks')?.findOne?.({
        ...blockIdQuery(String(blockId)),
        projectId: pId,
        isDeleted: { $ne: true },
      });
      if (castingBlock) {
        return {
          project,
          block: {
            ...castingBlock,
            id: String(castingBlock._id),
            status: castingBlock.status || 'active',
            isLegacyFallback: true,
          },
        };
      }

      const bbsBlock = await db.collection('bbs_blocks')?.findOne?.({
        ...blockIdQuery(String(blockId)),
        projectId: pId,
      });
      if (bbsBlock) {
        return {
          project,
          block: {
            ...bbsBlock,
            id: String(bbsBlock._id),
            status: bbsBlock.status || 'active',
            isLegacyFallback: true,
          },
        };
      }
    } catch (_e) {
      // Non-fatal check
    }

    const err: any = new Error('Block not found in this project');
    err.status = 404;
    err.code = 'BLOCK_NOT_FOUND';
    throw err;
  }

  if (opts.requireActive !== false && block.status && block.status !== 'active') {
    const err: any = new Error('Block is inactive');
    err.status = 403;
    err.code = 'BLOCK_INACTIVE';
    throw err;
  }

  return { project, block };
}

function buildBlockDocs(
  companyId: string,
  projectId: string,
  items: BlockInput[],
  createdBy: string | null,
  now: Date,
  startOrder = 1,
) {
  return items.map((item, idx) => {
    const _id = new ObjectId();
    return {
      _id,
      id: _id.toString(),
      companyId,
      projectId: String(projectId),
      name: item.name,
      nameLower: normalizeBlockName(item.name),
      code: item.code || '',
      description: item.description || '',
      floorNumber: item.floorNumber !== undefined ? item.floorNumber : null,
      unitNumber: item.unitNumber || '',
      configuration: item.configuration || '',
      carpetAreaSqFt: item.carpetAreaSqFt !== undefined ? item.carpetAreaSqFt : null,
      askingPrice: item.askingPrice !== undefined ? item.askingPrice : null,
      displayOrder: startOrder + idx,
      status: 'active',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy || undefined,
    };
  });
}

async function countActiveBlocks(db: any, projectId: string, session?: any) {
  const opts = session ? { session } : {};
  return db.collection(PROJECT_BLOCKS_COLLECTION).countDocuments(
    {
      projectId: String(projectId),
      isDeleted: { $ne: true },
      status: { $ne: 'inactive' },
    },
    opts,
  );
}

async function nameTaken(
  db: any,
  projectId: string,
  nameLower: string,
  excludeBlockId?: string,
  session?: any,
) {
  const filter: any = {
    projectId: String(projectId),
    nameLower,
    isDeleted: { $ne: true },
    status: { $ne: 'inactive' },
  };
  if (excludeBlockId) {
    filter._id = { $ne: ObjectId.isValid(excludeBlockId) && excludeBlockId.length === 24
      ? new ObjectId(excludeBlockId)
      : excludeBlockId };
  }
  const opts = session ? { session } : {};
  const existing = await db.collection(PROJECT_BLOCKS_COLLECTION).findOne(filter, opts);
  return Boolean(existing);
}

/**
 * Insert project + blocks atomically when MongoClient sessions work;
 * otherwise insert then compensating-delete on failure.
 */
export async function insertProjectWithBlocks(params: {
  db: any;
  client?: MongoClient | null;
  projectDoc: any;
  blockItems: BlockInput[];
}): Promise<{ project: any; blocks: any[] }> {
  const { db, client, projectDoc, blockItems } = params;
  const now = projectDoc.createdAt || new Date();
  const projectId = String(projectDoc._id);
  const blockDocs = buildBlockDocs(
    projectDoc.companyId,
    projectId,
    blockItems,
    projectDoc.createdBy || null,
    now,
  );

  const projectToInsert = {
    ...projectDoc,
    blockCount: blockDocs.length,
  };

  const useTx = Boolean(client && typeof (client as any).startSession === 'function');

  if (useTx) {
    const session = client!.startSession();
    try {
      let blocks: any[] = [];
      await session.withTransaction(async () => {
        await db.collection('projects').insertOne(projectToInsert, { session });
        if (blockDocs.length > 0) {
          await db.collection(PROJECT_BLOCKS_COLLECTION).insertMany(blockDocs, { session });
        }
        blocks = blockDocs;
      });
      return { project: projectToInsert, blocks };
    } catch (e: any) {
      // Fall through to compensating path if transactions unsupported
      const msg = String(e?.message || e);
      if (
        !/transaction|replica set|mongos|not supported|TransientTransactionError/i.test(msg) &&
        e?.code !== 20
      ) {
        throw e;
      }
      console.warn('project+blocks transaction unavailable, using compensating insert:', msg);
    } finally {
      await session.endSession().catch(() => {});
    }
  }

  // Compensating strategy
  await db.collection('projects').insertOne(projectToInsert);
  try {
    if (blockDocs.length > 0) {
      await db.collection(PROJECT_BLOCKS_COLLECTION).insertMany(blockDocs);
    }
    return { project: projectToInsert, blocks: blockDocs };
  } catch (e) {
    await db.collection(PROJECT_BLOCKS_COLLECTION).deleteMany({ projectId }).catch(() => {});
    await db.collection('projects').deleteOne({ _id: projectToInsert._id }).catch(() => {});
    throw e;
  }
}

export async function createBlockForProject(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  input: BlockInput;
}): Promise<any> {
  const { db, ctx, projectId, input } = params;
  const project = await assertProjectAccess(db, ctx, projectId, { requireActive: true });
  const pId = String(project._id || project.id);

  const validation = validateBlocksPayload([input]);
  if (!validation.ok || !validation.items?.[0]) {
    const err: any = new Error(validation.message || 'Invalid block');
    err.status = 400;
    err.code = validation.code || 'BLOCK_INVALID';
    throw err;
  }
  const item = validation.items[0];
  const lower = normalizeBlockName(item.name);

  if (await nameTaken(db, pId, lower)) {
    const err: any = new Error(`Duplicate block name "${item.name}"`);
    err.status = 409;
    err.code = 'BLOCK_NAME_DUPLICATE';
    throw err;
  }

  const count = await countActiveBlocks(db, pId);
  if (count >= MAX_BLOCKS_PER_PROJECT) {
    const err: any = new Error(`A project may have at most ${MAX_BLOCKS_PER_PROJECT} blocks`);
    err.status = 400;
    err.code = 'BLOCKS_LIMIT';
    throw err;
  }

  const now = new Date();
  const [doc] = buildBlockDocs(ctx.companyId, pId, [item], ctx.userId, now, count + 1);
  await db.collection(PROJECT_BLOCKS_COLLECTION).insertOne(doc);
  await db.collection('projects').updateOne(
    { _id: project._id },
    { $set: { blockCount: count + 1, updatedAt: now } },
  );

  // If unitNumber is specified, safely synchronize/create the unit in crm_units
  if (item.unitNumber) {
    try {
      const cleanTower = item.name.trim().toUpperCase();
      const unitCode = `${cleanTower}-${item.unitNumber.trim()}`.toUpperCase();
      const calculatedBasePrice = Number(item.askingPrice) || ((Number(item.carpetAreaSqFt) || 1000) * 6000);
      const crmUnitDoc = {
        companyId: ctx.companyId,
        projectId: ObjectId.isValid(pId) && pId.length === 24 ? new ObjectId(pId) : pId,
        projectName: project.name,
        blockId: doc._id,
        unitCode,
        buildingTower: cleanTower,
        floorNumber: Number(item.floorNumber) || 1,
        unitNumber: item.unitNumber.trim(),
        configuration: item.configuration || '2BHK',
        propertyType: 'Apartment',
        carpetAreaSqFt: Number(item.carpetAreaSqFt) || 0,
        saleableAreaSqFt: Number(item.carpetAreaSqFt) || 0,
        basePrice: calculatedBasePrice,
        askingPrice: Number(item.askingPrice) || calculatedBasePrice,
        availabilityStatus: 'Available',
        heldUntil: null,
        heldByCustomerId: null,
        activeBookingId: null,
        facing: 'East',
        notes: item.description || '',
        createdAt: now,
        updatedAt: now,
      };
      if (typeof db.collection === 'function') {
        const crmUnits = db.collection('crm_units');
        if (crmUnits && typeof crmUnits.updateOne === 'function') {
          await crmUnits.updateOne(
            { companyId: ctx.companyId, projectId: crmUnitDoc.projectId, unitCode },
            { $setOnInsert: crmUnitDoc },
            { upsert: true }
          );
        }
      }
    } catch (errSync: any) {
      console.warn('Sync to crm_units skipped:', errSync?.message || errSync);
    }
  }

  return doc;
}

export async function updateBlockForProject(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  blockId: string;
  patch: {
    name?: string;
    code?: string;
    description?: string;
    displayOrder?: number;
    status?: string;
    floorNumber?: number;
    unitNumber?: string;
    configuration?: string;
    carpetAreaSqFt?: number;
    askingPrice?: number;
  };
}): Promise<any> {
  const { db, ctx, projectId, blockId, patch } = params;
  const { project, block } = await assertBlockInProject(db, ctx, projectId, blockId, {
    requireActive: false,
  });

  const update: any = { updatedAt: new Date(), updatedBy: ctx.userId || undefined };

  if (patch.name !== undefined) {
    const trimmed = String(patch.name).trim();
    if (!trimmed) {
      const err: any = new Error('Block Name is required');
      err.status = 400;
      err.code = 'BLOCK_NAME_REQUIRED';
      throw err;
    }
    const lower = normalizeBlockName(trimmed);
    if (await nameTaken(db, String(project._id || project.id), lower, String(block._id))) {
      const err: any = new Error(`Duplicate block name "${trimmed}"`);
      err.status = 409;
      err.code = 'BLOCK_NAME_DUPLICATE';
      throw err;
    }
    update.name = trimmed;
    update.nameLower = lower;
  }
  if (patch.code !== undefined) update.code = String(patch.code || '').trim();
  if (patch.description !== undefined) update.description = String(patch.description || '').trim();
  if (patch.displayOrder !== undefined) update.displayOrder = Number(patch.displayOrder);
  if (patch.floorNumber !== undefined) update.floorNumber = Number(patch.floorNumber);
  if (patch.unitNumber !== undefined) update.unitNumber = String(patch.unitNumber).trim();
  if (patch.configuration !== undefined) update.configuration = String(patch.configuration).trim();
  if (patch.carpetAreaSqFt !== undefined) update.carpetAreaSqFt = Number(patch.carpetAreaSqFt);
  if (patch.askingPrice !== undefined) update.askingPrice = Number(patch.askingPrice);
  if (patch.status !== undefined) {
    if (!['active', 'inactive'].includes(patch.status)) {
      const err: any = new Error('Block status must be "active" or "inactive"');
      err.status = 400;
      err.code = 'BLOCK_STATUS_INVALID';
      throw err;
    }
    update.status = patch.status;
  }

  await db.collection(PROJECT_BLOCKS_COLLECTION).updateOne({ _id: block._id }, { $set: update });
  const updated = await db.collection(PROJECT_BLOCKS_COLLECTION).findOne({ _id: block._id });

  // Synchronize updated block and unit fields to crm_units
  if (
    patch.unitNumber !== undefined ||
    patch.name !== undefined ||
    patch.floorNumber !== undefined ||
    patch.configuration !== undefined ||
    patch.carpetAreaSqFt !== undefined ||
    patch.askingPrice !== undefined
  ) {
    try {
      const targetUnitNumber = (patch.unitNumber !== undefined ? patch.unitNumber : block.unitNumber || '').trim();
      const targetTower = (patch.name !== undefined ? patch.name : block.name || '').trim().toUpperCase();
      if (targetUnitNumber && typeof db.collection === 'function') {
        const unitCode = `${targetTower}-${targetUnitNumber}`.toUpperCase();
        const crmUnits = db.collection('crm_units');
        if (crmUnits && typeof crmUnits.updateOne === 'function') {
          await crmUnits.updateOne(
            { blockId: block._id },
            {
              $set: {
                buildingTower: targetTower,
                unitNumber: targetUnitNumber,
                unitCode,
                floorNumber: patch.floorNumber !== undefined ? Number(patch.floorNumber) : (block.floorNumber ?? 1),
                configuration: patch.configuration !== undefined ? patch.configuration : (block.configuration || '2BHK'),
                carpetAreaSqFt: patch.carpetAreaSqFt !== undefined ? Number(patch.carpetAreaSqFt) : (block.carpetAreaSqFt ?? 0),
                askingPrice: patch.askingPrice !== undefined ? Number(patch.askingPrice) : (block.askingPrice ?? 0),
                updatedAt: new Date(),
              },
            },
          );
        }
      }
    } catch (eCrm: any) {
      console.warn('Sync updated block to crm_units skipped:', eCrm?.message || eCrm);
    }
  }

  if (patch.status !== undefined) {
    const count = await countActiveBlocks(db, String(project._id || project.id));
    await db.collection('projects').updateOne(
      { _id: project._id },
      { $set: { blockCount: count, updatedAt: new Date() } },
    );
  }

  return updated;
}

/**
 * Soft-archive a block. Hard delete only when no children reference it in module trees
 * (checked via optional child probe). Prefer archive.
 */
export async function archiveBlockForProject(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  blockId: string;
  hardDelete?: boolean;
}): Promise<{ archived: boolean; deleted?: boolean; block?: any }> {
  const { db, ctx, projectId, blockId, hardDelete } = params;
  const { project, block } = await assertBlockInProject(db, ctx, projectId, blockId, {
    requireActive: false,
  });

  const bId = String(block._id);
  const safeCount = async (collName: string, query: any) => {
    const c = db.collection(collName);
    return typeof c?.countDocuments === 'function' ? c.countDocuments(query).catch(() => 0) : 0;
  };
  const childRefs = await Promise.all([
    safeCount('project_floors', { blockId: { $in: [bId, block._id] }, isDeleted: { $ne: true } }),
    safeCount('bbs_levels', { blockId: { $in: [bId, block._id] } }),
    safeCount('bbs_members', { blockId: { $in: [bId, block._id] } }),
    safeCount('casting_levels', { blockId: { $in: [bId, block._id] } }),
    safeCount('casting_members', { blockId: { $in: [bId, block._id] } }),
    safeCount('crm_units', {
      $or: [{ blockId: { $in: [bId, block._id] } }, { buildingTower: block.name }],
      isDeleted: { $ne: true },
    }),
  ]);
  const childCount = childRefs.reduce((a, b) => a + b, 0);

  if (hardDelete) {
    if (childCount > 0) {
      const err: any = new Error(
        'Cannot hard-delete block while floors, levels, members, or units reference it; archive instead',
      );
      err.status = 409;
      err.code = 'BLOCK_HAS_CHILDREN';
      throw err;
    }
    await db.collection(PROJECT_BLOCKS_COLLECTION).deleteOne({ _id: block._id });
  } else {
    await db.collection(PROJECT_BLOCKS_COLLECTION).updateOne(
      { _id: block._id },
      {
        $set: {
          status: 'inactive',
          isDeleted: true,
          updatedAt: new Date(),
          updatedBy: ctx.userId || undefined,
        },
      },
    );
  }

  const count = await countActiveBlocks(db, String(project._id || project.id));
  await db.collection('projects').updateOne(
    { _id: project._id },
    { $set: { blockCount: count, updatedAt: new Date() } },
  );

  if (hardDelete) return { archived: false, deleted: true };
  const updated = await db.collection(PROJECT_BLOCKS_COLLECTION).findOne({ _id: block._id });
  return { archived: true, block: updated };
}
