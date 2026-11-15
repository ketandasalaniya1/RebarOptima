import { ObjectId } from 'mongodb';
import { assertProjectAccess, ProjectAccessContext, idQuery } from './project-access';
import { assertBlockInProject, PROJECT_BLOCKS_COLLECTION } from './project-blocks.service';

export const PROJECT_FLOORS_COLLECTION = 'project_floors';
export const MAX_FLOORS_PER_BLOCK = 200;

export type FloorInput = {
  name: string;
  floorNumber?: number;
  displayOrder?: number;
  description?: string;
};

export function normalizeFloorName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export async function ensureProjectFloorsIndexes(db: any): Promise<void> {
  const coll = db.collection(PROJECT_FLOORS_COLLECTION);
  try {
    await coll.createIndex({ companyId: 1, projectId: 1, blockId: 1, status: 1 });
    await coll.createIndex({ blockId: 1, displayOrder: 1 });
    await coll.createIndex({ blockId: 1, floorNumber: 1 });
    await coll.createIndex(
      { blockId: 1, nameLower: 1 },
      {
        unique: true,
        partialFilterExpression: { isDeleted: { $ne: true }, status: { $ne: 'inactive' } },
        name: 'blockId_nameLower_active_unique',
      },
    );
  } catch (e: any) {
    console.warn('project_floors index ensure:', e?.message || e);
  }
}

function floorIdQuery(floorId: string) {
  if (ObjectId.isValid(String(floorId)) && String(floorId).length === 24) {
    return { _id: { $in: [new ObjectId(String(floorId)), String(floorId)] } };
  }
  return { _id: String(floorId) };
}

export async function listProjectFloors(
  db: any,
  projectId: string,
  blockId?: string,
  opts: { includeInactive?: boolean } = {},
) {
  const pId = String(projectId);
  const pMatcher = ObjectId.isValid(pId) && pId.length === 24
    ? { $in: [pId, new ObjectId(pId)] }
    : pId;

  const filter: any = {
    projectId: pMatcher,
    isDeleted: { $ne: true },
  };

  if (blockId && blockId !== 'ALL') {
    const bId = String(blockId);
    filter.$or = [
      { blockId: bId },
      ObjectId.isValid(bId) && bId.length === 24 ? { blockId: new ObjectId(bId) } : null,
    ].filter(Boolean);
  }

  if (!opts.includeInactive) {
    filter.status = 'active';
  }

  const floors = await db
    .collection(PROJECT_FLOORS_COLLECTION)
    .find(filter)
    .sort({ displayOrder: 1, floorNumber: 1, createdAt: 1 })
    .toArray();

  // Look up block names for any floor missing blockName
  const blockIds = Array.from(new Set(floors.map((f: any) => String(f.blockId)).filter(Boolean)));
  const blockMap = new Map<string, string>();
  if (blockIds.length > 0) {
    const blocks = await db.collection(PROJECT_BLOCKS_COLLECTION).find({
      _id: { $in: blockIds.map((id: string) => ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : id) }
    }).toArray();
    blocks.forEach((b: any) => {
      blockMap.set(String(b._id), b.name || b.blockName || '');
    });
  }

  // Enrich each floor with live unit count from crm_units
  const enriched = await Promise.all(
    floors.map(async (floor: any) => {
      const fId = String(floor._id || floor.id);
      const bId = floor.blockId ? String(floor.blockId) : '';
      const bName = floor.blockName || (bId ? blockMap.get(bId) : '') || '';

      const unitCount = await db.collection('crm_units').countDocuments({
        $or: [
          { floorId: fId },
          { floorId: floor._id },
          {
            projectId: pMatcher,
            floorNumber: Number(floor.floorNumber),
            $or: [
              bId ? { blockId: bId } : null,
              bId && ObjectId.isValid(bId) && bId.length === 24 ? { blockId: new ObjectId(bId) } : null,
              bName ? { buildingTower: bName } : null,
            ].filter(Boolean),
          },
        ],
        isDeleted: { $ne: true },
      }).catch(() => 0);

      return {
        ...floor,
        id: String(floor._id || floor.id),
        blockName: bName,
        unitCount,
      };
    }),
  );

  return enriched;
}

export async function assertFloorInBlock(
  db: any,
  ctx: ProjectAccessContext,
  projectId: string,
  blockId: string,
  floorId: string,
  opts: { requireActive?: boolean } = {},
): Promise<{ project: any; block: any; floor: any }> {
  const { project, block } = await assertBlockInProject(db, ctx, projectId, blockId, {
    requireActive: opts.requireActive !== false,
  });

  if (!floorId) {
    const err: any = new Error('Floor id is required');
    err.status = 400;
    err.code = 'FLOOR_REQUIRED';
    throw err;
  }

  const bId = String(block._id || block.id);
  const floor = await db.collection(PROJECT_FLOORS_COLLECTION).findOne({
    ...floorIdQuery(String(floorId)),
    blockId: { $in: [bId, block._id] },
    isDeleted: { $ne: true },
  });

  if (!floor) {
    const err: any = new Error('Floor not found in this block');
    err.status = 404;
    err.code = 'FLOOR_NOT_FOUND';
    throw err;
  }

  if (opts.requireActive !== false && floor.status && floor.status !== 'active') {
    const err: any = new Error('Floor is inactive');
    err.status = 403;
    err.code = 'FLOOR_INACTIVE';
    throw err;
  }

  return { project, block, floor };
}

async function floorNameTaken(
  db: any,
  blockId: string,
  nameLower: string,
  excludeFloorId?: string,
) {
  const filter: any = {
    $or: [{ blockId: String(blockId) }, { blockId: ObjectId.isValid(blockId) ? new ObjectId(blockId) : blockId }],
    nameLower,
    isDeleted: { $ne: true },
    status: { $ne: 'inactive' },
  };
  if (excludeFloorId) {
    filter._id = {
      $ne:
        ObjectId.isValid(excludeFloorId) && excludeFloorId.length === 24
          ? new ObjectId(excludeFloorId)
          : excludeFloorId,
    };
  }
  const existing = await db.collection(PROJECT_FLOORS_COLLECTION).findOne(filter);
  return Boolean(existing);
}

export async function createFloorForBlock(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  blockId: string;
  input: FloorInput;
}): Promise<any> {
  const { db, ctx, projectId, blockId, input } = params;
  const { project, block } = await assertBlockInProject(db, ctx, projectId, blockId, {
    requireActive: true,
  });

  const rawName = String(input.name || '').trim();
  if (!rawName) {
    const err: any = new Error('Floor Name is required');
    err.status = 400;
    err.code = 'FLOOR_NAME_REQUIRED';
    throw err;
  }

  const lower = normalizeFloorName(rawName);
  const bId = String(block._id || block.id);

  if (await floorNameTaken(db, bId, lower)) {
    const err: any = new Error(`Duplicate floor name "${rawName}" in this block`);
    err.status = 409;
    err.code = 'FLOOR_NAME_DUPLICATE';
    throw err;
  }

  const existingFloorsCount = await db.collection(PROJECT_FLOORS_COLLECTION).countDocuments({
    $or: [{ blockId: bId }, { blockId: block._id }],
    isDeleted: { $ne: true },
    status: { $ne: 'inactive' },
  });

  if (existingFloorsCount >= MAX_FLOORS_PER_BLOCK) {
    const err: any = new Error(`A block may have at most ${MAX_FLOORS_PER_BLOCK} floors`);
    err.status = 400;
    err.code = 'FLOORS_LIMIT';
    throw err;
  }

  const now = new Date();
  const _id = new ObjectId();
  const floorNumber =
    input.floorNumber !== undefined && input.floorNumber !== null && !isNaN(Number(input.floorNumber))
      ? Number(input.floorNumber)
      : existingFloorsCount + 1;

  const displayOrder =
    input.displayOrder !== undefined && !isNaN(Number(input.displayOrder))
      ? Number(input.displayOrder)
      : existingFloorsCount + 1;

  const floorDoc = {
    _id,
    id: _id.toString(),
    companyId: ctx.companyId,
    projectId: String(project._id || project.id),
    blockId: bId,
    blockName: block.name,
    name: rawName,
    nameLower: lower,
    floorNumber,
    displayOrder,
    description: String(input.description || '').trim(),
    status: 'active',
    isDeleted: false,
    unitCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.userId || undefined,
  };

  await db.collection(PROJECT_FLOORS_COLLECTION).insertOne(floorDoc);
  return floorDoc;
}

export async function updateFloorForBlock(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  blockId: string;
  floorId: string;
  patch: {
    name?: string;
    floorNumber?: number;
    displayOrder?: number;
    description?: string;
    status?: string;
  };
}): Promise<any> {
  const { db, ctx, projectId, blockId, floorId, patch } = params;
  const { block, floor } = await assertFloorInBlock(db, ctx, projectId, blockId, floorId, {
    requireActive: false,
  });

  const update: any = { updatedAt: new Date(), updatedBy: ctx.userId || undefined };
  const bId = String(block._id || block.id);

  if (patch.name !== undefined) {
    const trimmed = String(patch.name).trim();
    if (!trimmed) {
      const err: any = new Error('Floor Name is required');
      err.status = 400;
      err.code = 'FLOOR_NAME_REQUIRED';
      throw err;
    }
    const lower = normalizeFloorName(trimmed);
    if (await floorNameTaken(db, bId, lower, String(floor._id))) {
      const err: any = new Error(`Duplicate floor name "${trimmed}" in this block`);
      err.status = 409;
      err.code = 'FLOOR_NAME_DUPLICATE';
      throw err;
    }
    update.name = trimmed;
    update.nameLower = lower;
  }

  if (patch.floorNumber !== undefined && !isNaN(Number(patch.floorNumber))) {
    update.floorNumber = Number(patch.floorNumber);
  }

  if (patch.displayOrder !== undefined && !isNaN(Number(patch.displayOrder))) {
    update.displayOrder = Number(patch.displayOrder);
  }

  if (patch.description !== undefined) {
    update.description = String(patch.description || '').trim();
  }

  if (patch.status !== undefined) {
    if (!['active', 'inactive'].includes(patch.status)) {
      const err: any = new Error('Floor status must be "active" or "inactive"');
      err.status = 400;
      err.code = 'FLOOR_STATUS_INVALID';
      throw err;
    }
    update.status = patch.status;
  }

  await db.collection(PROJECT_FLOORS_COLLECTION).updateOne({ _id: floor._id }, { $set: update });

  // If floorName or floorNumber changed, sync denormalized fields on crm_units
  if (update.name || update.floorNumber !== undefined) {
    const unitPatch: any = {};
    if (update.name) unitPatch.floorName = update.name;
    if (update.floorNumber !== undefined) unitPatch.floorNumber = update.floorNumber;

    const fId = String(floor._id || floor.id);
    await db.collection('crm_units').updateMany(
      { $or: [{ floorId: fId }, { floorId: floor._id }] },
      { $set: unitPatch },
    );
  }

  const updated = await db.collection(PROJECT_FLOORS_COLLECTION).findOne({ _id: floor._id });
  return updated;
}

export async function deleteFloorForBlock(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  blockId: string;
  floorId: string;
  hardDelete?: boolean;
}): Promise<{ deleted: boolean; archived?: boolean }> {
  const { db, ctx, projectId, blockId, floorId, hardDelete } = params;
  const { floor } = await assertFloorInBlock(db, ctx, projectId, blockId, floorId, {
    requireActive: false,
  });

  const fId = String(floor._id || floor.id);

  // Dependency Check: count active units on this floor
  const unitCount = await db.collection('crm_units').countDocuments({
    $or: [{ floorId: fId }, { floorId: floor._id }],
    isDeleted: { $ne: true },
  });

  if (unitCount > 0) {
    const err: any = new Error(
      `Cannot delete floor "${floor.name}" because ${unitCount} unit(s) exist on it. Delete or reassign the units first.`,
    );
    err.status = 409;
    err.code = 'FLOOR_HAS_UNITS';
    throw err;
  }

  if (hardDelete) {
    await db.collection(PROJECT_FLOORS_COLLECTION).deleteOne({ _id: floor._id });
    return { deleted: true };
  } else {
    await db.collection(PROJECT_FLOORS_COLLECTION).updateOne(
      { _id: floor._id },
      {
        $set: {
          status: 'inactive',
          isDeleted: true,
          updatedAt: new Date(),
          updatedBy: ctx.userId || undefined,
        },
      },
    );
    return { deleted: false, archived: true };
  }
}

export async function reorderFloorsForBlock(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  blockId: string;
  floorIds: string[];
}): Promise<{ success: boolean; count: number }> {
  const { db, ctx, projectId, blockId, floorIds } = params;
  await assertBlockInProject(db, ctx, projectId, blockId, { requireActive: false });

  if (!Array.isArray(floorIds) || floorIds.length === 0) {
    const err: any = new Error('floorIds array is required');
    err.status = 400;
    err.code = 'FLOOR_IDS_REQUIRED';
    throw err;
  }

  let count = 0;
  for (let idx = 0; idx < floorIds.length; idx++) {
    const fId = floorIds[idx];
    const q = floorIdQuery(fId);
    const res = await db.collection(PROJECT_FLOORS_COLLECTION).updateOne(q, {
      $set: { displayOrder: idx + 1, updatedAt: new Date(), updatedBy: ctx.userId || undefined },
    });
    if (res.modifiedCount) count++;
  }

  return { success: true, count };
}
