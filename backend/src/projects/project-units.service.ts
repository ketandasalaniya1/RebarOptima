import { ObjectId } from 'mongodb';
import { assertProjectAccess, ProjectAccessContext, idQuery } from './project-access';
import { assertBlockInProject } from './project-blocks.service';
import { assertFloorInBlock, PROJECT_FLOORS_COLLECTION } from './project-floors.service';
import { getCompanyUnitMasterData } from './unit-master-data';

export const CRM_UNITS_COLLECTION = 'crm_units';

export type UnitInput = {
  unitNumber: string;
  unitCode?: string;
  propertyType?: string;
  configuration?: string;
  carpetAreaSqFt?: number;
  builtUpAreaSqFt?: number;
  saleableAreaSqFt?: number;
  balconyAreaSqFt?: number;
  areaUnit?: string;
  specifications?: string[];
  features?: string[];
  basePrice?: number;
  askingPrice?: number;
  facing?: string;
  notes?: string;
  availabilityStatus?: string;
};

export async function ensureProjectUnitsIndexes(db: any): Promise<void> {
  const coll = db.collection(CRM_UNITS_COLLECTION);
  try {
    await coll.createIndex({ companyId: 1, projectId: 1, availabilityStatus: 1 });
    await coll.createIndex({ projectId: 1, unitCode: 1 });
    await coll.createIndex({ floorId: 1, unitNumber: 1 });
    await coll.createIndex({ blockId: 1, floorNumber: 1 });
  } catch (e: any) {
    console.warn('crm_units index ensure:', e?.message || e);
  }
}

function unitIdQuery(unitId: string) {
  if (ObjectId.isValid(String(unitId)) && String(unitId).length === 24) {
    return { _id: { $in: [new ObjectId(String(unitId)), String(unitId)] } };
  }
  return { _id: String(unitId) };
}

export async function listUnitsForFloor(
  db: any,
  ctx: ProjectAccessContext,
  projectId: string,
  blockId: string,
  floorId: string,
) {
  const { block, floor } = await assertFloorInBlock(db, ctx, projectId, blockId, floorId, {
    requireActive: false,
  });

  const fId = String(floor._id || floor.id);
  const bId = String(block._id || block.id);
  const pId = String(projectId);

  const filter: any = {
    $or: [
      { floorId: fId },
      { floorId: floor._id },
      {
        projectId: ObjectId.isValid(pId) ? { $in: [pId, new ObjectId(pId)] } : pId,
        floorNumber: Number(floor.floorNumber),
        $or: [
          { blockId: bId },
          { blockId: ObjectId.isValid(bId) ? new ObjectId(bId) : bId },
          { buildingTower: block.name },
        ],
      },
    ],
    isDeleted: { $ne: true },
  };

  const units = await db
    .collection(CRM_UNITS_COLLECTION)
    .find(filter)
    .sort({ unitNumber: 1, createdAt: 1 })
    .toArray();

  const now = new Date();
  return units.map((u: any) => {
    let effectiveStatus = u.availabilityStatus || 'Available';
    let isHoldExpired = false;

    if (effectiveStatus === 'Held' && u.heldUntil) {
      if (new Date(u.heldUntil) <= now) {
        effectiveStatus = 'Available';
        isHoldExpired = true;
      }
    }

    return {
      ...u,
      effectiveStatus,
      isHoldExpired,
    };
  });
}

export async function createUnitForFloor(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  blockId: string;
  floorId: string;
  input: UnitInput;
}): Promise<any> {
  const { db, ctx, projectId, blockId, floorId, input } = params;
  const { project, block, floor } = await assertFloorInBlock(db, ctx, projectId, blockId, floorId, {
    requireActive: true,
  });

  const rawUnitNumber = String(input.unitNumber || '').trim();
  if (!rawUnitNumber) {
    const err: any = new Error('Unit Number is required');
    err.status = 400;
    err.code = 'UNIT_NUMBER_REQUIRED';
    throw err;
  }

  const pId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
  const bId = String(block._id || block.id);
  const fId = String(floor._id || floor.id);

  // Generate canonical unitCode: TOWER A-101
  const blockPrefix = (block.code && block.code.trim()) || block.name.trim();
  const unitCode = input.unitCode
    ? String(input.unitCode).trim().toUpperCase()
    : `${blockPrefix}-${rawUnitNumber}`.toUpperCase();

  // Check collision within same project
  const existing = await db.collection(CRM_UNITS_COLLECTION).findOne({
    projectId: pId,
    unitCode,
    isDeleted: { $ne: true },
  });

  if (existing) {
    const err: any = new Error(
      `Unit ${unitCode} already exists in project "${project.name}"`,
    );
    err.status = 409;
    err.code = 'UNIT_CODE_DUPLICATE';
    throw err;
  }

  // Load and validate against global master data
  const masterData = await getCompanyUnitMasterData(db, ctx.companyId);

  const propertyType = input.propertyType?.trim() || masterData.unitTypes[0] || 'Apartment';
  const configuration = input.configuration?.trim() || masterData.unitConfigurations[0] || '2 BHK';
  const areaUnit = input.areaUnit?.trim() || masterData.areaMeasurementOptions[0] || 'sq.ft';

  const carpetArea = Number(input.carpetAreaSqFt) || 0;
  const builtUpArea =
    input.builtUpAreaSqFt !== undefined && !isNaN(Number(input.builtUpAreaSqFt))
      ? Number(input.builtUpAreaSqFt)
      : carpetArea ? Math.round(carpetArea * 1.2) : 0;

  const saleableArea =
    input.saleableAreaSqFt !== undefined && !isNaN(Number(input.saleableAreaSqFt))
      ? Number(input.saleableAreaSqFt)
      : carpetArea ? Math.round(carpetArea * 1.35) : 0;

  const balconyArea = Number(input.balconyAreaSqFt) || 0;

  const basePrice = Number(input.basePrice) || 0;
  const askingPrice = Number(input.askingPrice) || basePrice;

  // Specifications reuse existing global master data definitions
  const specifications = Array.isArray(input.specifications)
    ? input.specifications
    : Array.isArray(input.features)
      ? input.features
      : [];

  const availabilityStatus = input.availabilityStatus || 'Available';

  const _id = new ObjectId();
  const now = new Date();

  const newUnitDoc: any = {
    _id,
    id: _id.toString(),
    companyId: ctx.companyId,
    projectId: pId,
    projectName: project.name,
    blockId: bId,
    buildingTower: block.name,
    sectionName: block.name,
    floorId: fId,
    floorName: floor.name,
    floorNumber: Number(floor.floorNumber),
    unitNumber: rawUnitNumber,
    unitCode,
    propertyType,
    configuration,
    carpetAreaSqFt: carpetArea,
    builtUpAreaSqFt: builtUpArea,
    saleableAreaSqFt: saleableArea,
    balconyAreaSqFt: balconyArea,
    areaUnit,
    specifications,
    features: specifications, // for backward compatibility
    basePrice,
    basePricePaise: Math.round(basePrice * 100),
    askingPrice,
    askingPricePaise: Math.round(askingPrice * 100),
    facing: input.facing || 'East',
    notes: input.notes || '',
    description: input.notes || '',
    availabilityStatus,
    heldUntil: null,
    heldByCustomerId: null,
    activeBookingId: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.userId || undefined,
  };

  await db.collection(CRM_UNITS_COLLECTION).insertOne(newUnitDoc);

  // Update denormalized unit count on project_floors
  await db.collection(PROJECT_FLOORS_COLLECTION).updateOne(
    { _id: floor._id },
    { $inc: { unitCount: 1 }, $set: { updatedAt: now } },
  );

  return newUnitDoc;
}

export async function updateUnitForFloor(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  blockId: string;
  floorId: string;
  unitId: string;
  patch: Partial<UnitInput>;
}): Promise<any> {
  const { db, ctx, projectId, blockId, floorId, unitId, patch } = params;
  const { project, block, floor } = await assertFloorInBlock(db, ctx, projectId, blockId, floorId, {
    requireActive: false,
  });

  const uId = unitIdQuery(unitId);
  const existing = await db.collection(CRM_UNITS_COLLECTION).findOne({
    ...uId,
    isDeleted: { $ne: true },
  });

  if (!existing) {
    const err: any = new Error('Unit not found in inventory');
    err.status = 404;
    err.code = 'UNIT_NOT_FOUND';
    throw err;
  }

  const pId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
  const updateData: any = { updatedAt: new Date(), updatedBy: ctx.userId || undefined };

  if (patch.unitNumber !== undefined) {
    const rawUnitNumber = String(patch.unitNumber).trim();
    if (!rawUnitNumber) {
      const err: any = new Error('Unit Number is required');
      err.status = 400;
      err.code = 'UNIT_NUMBER_REQUIRED';
      throw err;
    }
    const blockPrefix = (block.code && block.code.trim()) || block.name.trim();
    const newCode = patch.unitCode
      ? String(patch.unitCode).trim().toUpperCase()
      : `${blockPrefix}-${rawUnitNumber}`.toUpperCase();

    // Check collision if changed
    if (newCode !== existing.unitCode) {
      const dup = await db.collection(CRM_UNITS_COLLECTION).findOne({
        projectId: pId,
        unitCode: newCode,
        _id: { $ne: existing._id },
        isDeleted: { $ne: true },
      });
      if (dup) {
        const err: any = new Error(`Unit ${newCode} already exists in project`);
        err.status = 409;
        err.code = 'UNIT_CODE_DUPLICATE';
        throw err;
      }
    }

    updateData.unitNumber = rawUnitNumber;
    updateData.unitCode = newCode;
  }

  if (patch.propertyType !== undefined) updateData.propertyType = String(patch.propertyType).trim();
  if (patch.configuration !== undefined) updateData.configuration = String(patch.configuration).trim();
  if (patch.areaUnit !== undefined) updateData.areaUnit = String(patch.areaUnit).trim();

  if (patch.carpetAreaSqFt !== undefined && !isNaN(Number(patch.carpetAreaSqFt))) {
    updateData.carpetAreaSqFt = Number(patch.carpetAreaSqFt);
  }
  if (patch.builtUpAreaSqFt !== undefined && !isNaN(Number(patch.builtUpAreaSqFt))) {
    updateData.builtUpAreaSqFt = Number(patch.builtUpAreaSqFt);
  }
  if (patch.saleableAreaSqFt !== undefined && !isNaN(Number(patch.saleableAreaSqFt))) {
    updateData.saleableAreaSqFt = Number(patch.saleableAreaSqFt);
  }
  if (patch.balconyAreaSqFt !== undefined && !isNaN(Number(patch.balconyAreaSqFt))) {
    updateData.balconyAreaSqFt = Number(patch.balconyAreaSqFt);
  }

  if (patch.basePrice !== undefined && !isNaN(Number(patch.basePrice))) {
    const bp = Number(patch.basePrice);
    updateData.basePrice = bp;
    updateData.basePricePaise = Math.round(bp * 100);
  }
  if (patch.askingPrice !== undefined && !isNaN(Number(patch.askingPrice))) {
    const ap = Number(patch.askingPrice);
    updateData.askingPrice = ap;
    updateData.askingPricePaise = Math.round(ap * 100);
  }

  if (patch.facing !== undefined) updateData.facing = String(patch.facing).trim();
  if (patch.notes !== undefined) {
    updateData.notes = String(patch.notes).trim();
    updateData.description = updateData.notes;
  }

  if (patch.specifications !== undefined && Array.isArray(patch.specifications)) {
    updateData.specifications = patch.specifications;
    updateData.features = patch.specifications;
  }

  if (patch.availabilityStatus !== undefined) {
    // Prevent setting to Available if unit has an active non-cancelled booking in CRM
    if (patch.availabilityStatus === 'Available' && existing.availabilityStatus !== 'Available') {
      const activeBookings = await db.collection('crm_bookings').countDocuments({
        $or: [{ unitId: String(existing._id) }, { unitId: existing._id }],
        status: { $ne: 'Cancelled' },
      });
      if (activeBookings > 0) {
        const err: any = new Error(
          'Cannot mark unit Available while active customer bookings exist in CRM. Cancel booking first.',
        );
        err.status = 409;
        err.code = 'UNIT_HAS_ACTIVE_BOOKING';
        throw err;
      }
    }
    updateData.availabilityStatus = patch.availabilityStatus;
  }

  // Ensure floor and block links remain updated
  updateData.floorId = String(floor._id || floor.id);
  updateData.floorName = floor.name;
  updateData.floorNumber = Number(floor.floorNumber);
  updateData.blockId = String(block._id || block.id);
  updateData.buildingTower = block.name;

  await db.collection(CRM_UNITS_COLLECTION).updateOne({ _id: existing._id }, { $set: updateData });
  const updated = await db.collection(CRM_UNITS_COLLECTION).findOne({ _id: existing._id });
  return updated;
}

export async function deleteUnitForFloor(params: {
  db: any;
  ctx: ProjectAccessContext;
  projectId: string;
  blockId: string;
  floorId: string;
  unitId: string;
  hardDelete?: boolean;
}): Promise<{ deleted: boolean; archived?: boolean }> {
  const { db, ctx, projectId, blockId, floorId, unitId, hardDelete } = params;
  const { floor } = await assertFloorInBlock(db, ctx, projectId, blockId, floorId, {
    requireActive: false,
  });

  const uId = unitIdQuery(unitId);
  const unit = await db.collection(CRM_UNITS_COLLECTION).findOne({
    ...uId,
    isDeleted: { $ne: true },
  });

  if (!unit) {
    const err: any = new Error('Unit not found');
    err.status = 404;
    err.code = 'UNIT_NOT_FOUND';
    throw err;
  }

  // Dependency Check: Cannot delete unit if booked in CRM or associated with active booking
  const [activeBookings, bookedInterests] = await Promise.all([
    db.collection('crm_bookings').countDocuments({
      $or: [{ unitId: String(unit._id) }, { unitId: unit._id }, { unitCode: unit.unitCode }],
      status: { $ne: 'Cancelled' },
    }),
    db.collection('crm_unit_interests').countDocuments({
      $or: [{ unitId: String(unit._id) }, { unitId: unit._id }, { unitCode: unit.unitCode }],
      stage: 'Booked',
    }),
  ]);

  if (activeBookings > 0 || bookedInterests > 0) {
    const err: any = new Error(
      `Cannot delete unit "${unit.unitCode}" because it is booked in Real Estate CRM. Cancel the customer booking first.`,
    );
    err.status = 409;
    err.code = 'UNIT_HAS_BOOKINGS';
    throw err;
  }

  if (hardDelete) {
    await db.collection(CRM_UNITS_COLLECTION).deleteOne({ _id: unit._id });
  } else {
    await db.collection(CRM_UNITS_COLLECTION).updateOne(
      { _id: unit._id },
      {
        $set: {
          status: 'inactive',
          availabilityStatus: 'Blocked',
          isDeleted: true,
          updatedAt: new Date(),
          updatedBy: ctx.userId || undefined,
        },
      },
    );
  }

  // Decrement unit count on project_floors
  await db.collection(PROJECT_FLOORS_COLLECTION).updateOne(
    { _id: floor._id },
    { $inc: { unitCount: -1 }, $set: { updatedAt: new Date() } },
  );

  return { deleted: Boolean(hardDelete), archived: !hardDelete };
}
