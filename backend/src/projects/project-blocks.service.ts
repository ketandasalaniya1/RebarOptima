import { ObjectId, MongoClient } from 'mongodb';
import { assertProjectAccess, ProjectAccessContext, idQuery } from './project-access';

export const PROJECT_BLOCKS_COLLECTION = 'project_blocks';
export const MAX_BLOCKS_PER_PROJECT = 200;

export type BlockInput = {
  name: string;
  code?: string;
  description?: string;
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
          ? String((raw as any).name || '')
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
  return db
    .collection(PROJECT_BLOCKS_COLLECTION)
    .find(filter)
    .sort({ displayOrder: 1, createdAt: 1 })
    .toArray();
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
  const childRefs = await Promise.all([
    db.collection('bbs_levels').countDocuments({ blockId: { $in: [bId, block._id] } }).catch(() => 0),
    db.collection('bbs_members').countDocuments({ blockId: { $in: [bId, block._id] } }).catch(() => 0),
    db.collection('casting_levels').countDocuments({ blockId: { $in: [bId, block._id] } }).catch(() => 0),
    db.collection('casting_members').countDocuments({ blockId: { $in: [bId, block._id] } }).catch(() => 0),
    db.collection('crm_units').countDocuments({ blockId: { $in: [bId, block._id] } }).catch(() => 0),
  ]);
  const childCount = childRefs.reduce((a, b) => a + b, 0);

  if (hardDelete) {
    if (childCount > 0) {
      const err: any = new Error(
        'Cannot hard-delete block while levels, members, or units reference it; archive instead',
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
