import { ObjectId } from 'mongodb';
import {
  createBlockForProject,
  listProjectBlocks,
  archiveBlockForProject,
  PROJECT_BLOCKS_COLLECTION,
} from './project-blocks.service';
import {
  createFloorForBlock,
  listProjectFloors,
  updateFloorForBlock,
  deleteFloorForBlock,
  PROJECT_FLOORS_COLLECTION,
} from './project-floors.service';
import {
  createUnitForFloor,
  listUnitsForFloor,
  updateUnitForFloor,
  deleteUnitForFloor,
  CRM_UNITS_COLLECTION,
} from './project-units.service';
import { getCompanyUnitMasterData } from './unit-master-data';

describe('End-to-End Complete Hierarchy & Unit Inventory Integration Suite', () => {
  // In-memory mock DB representing MongoDB collections
  class MockDb {
    public collections: Record<string, any[]> = {
      projects: [],
      project_blocks: [],
      project_floors: [],
      crm_units: [],
      crm_bookings: [],
      crm_unit_interests: [],
      crm_settings: [],
    };

    collection(name: string) {
      if (!this.collections[name]) {
        this.collections[name] = [];
      }
      const data = this.collections[name];

      return {
        createIndex: jest.fn().mockResolvedValue('ok'),
        findOne: async (query: any) => {
          return data.find((doc) => this.matchQuery(doc, query)) || null;
        },
        find: (query: any = {}) => {
          let res = data.filter((doc) => this.matchQuery(doc, query));
          return {
            sort: (sortObj: any) => {
              const key = Object.keys(sortObj)[0];
              const dir = sortObj[key];
              res = [...res].sort((a, b) => (a[key] > b[key] ? dir : -dir));
              return { toArray: async () => res };
            },
            toArray: async () => res,
          };
        },
        countDocuments: async (query: any = {}) => {
          return data.filter((doc) => this.matchQuery(doc, query)).length;
        },
        insertOne: async (doc: any) => {
          const _id = doc._id || new ObjectId();
          const item = { ...doc, _id, id: _id.toString() };
          data.push(item);
          return { insertedId: _id, acknowledged: true };
        },
        insertMany: async (docs: any[]) => {
          for (const d of docs) {
            const _id = d._id || new ObjectId();
            data.push({ ...d, _id, id: _id.toString() });
          }
          return { acknowledged: true };
        },
        updateOne: async (query: any, update: any) => {
          const idx = data.findIndex((doc) => this.matchQuery(doc, query));
          if (idx !== -1) {
            if (update.$set) data[idx] = { ...data[idx], ...update.$set };
            if (update.$inc) {
              for (const [k, v] of Object.entries(update.$inc)) {
                data[idx][k] = (data[idx][k] || 0) + (v as number);
              }
            }
            return { modifiedCount: 1 };
          }
          return { modifiedCount: 0 };
        },
        updateMany: async (query: any, update: any) => {
          let count = 0;
          for (let i = 0; i < data.length; i++) {
            if (this.matchQuery(data[i], query)) {
              if (update.$set) data[i] = { ...data[i], ...update.$set };
              count++;
            }
          }
          return { modifiedCount: count };
        },
        deleteOne: async (query: any) => {
          const idx = data.findIndex((doc) => this.matchQuery(doc, query));
          if (idx !== -1) {
            data.splice(idx, 1);
            return { deletedCount: 1 };
          }
          return { deletedCount: 0 };
        },
      };
    }

    private matchQuery(doc: any, query: any): boolean {
      for (const [key, val] of Object.entries(query)) {
        if (key === '$or' && Array.isArray(val)) {
          const matched = val.some((subQ) => this.matchQuery(doc, subQ));
          if (!matched) return false;
          continue;
        }
        if (val && typeof val === 'object' && '$ne' in val) {
          if (doc[key] === (val as any).$ne) return false;
          continue;
        }
        if (val && typeof val === 'object' && '$in' in val) {
          const list = (val as any).$in;
          const docValStr = String(doc[key] || '');
          const inList = list.some((item: any) => String(item) === docValStr);
          if (!inList) return false;
          continue;
        }
        if (String(doc[key]) !== String(val)) {
          return false;
        }
      }
      return true;
    }
  }

  let db: MockDb;
  const companyA = 'comp_alpha';
  const companyB = 'comp_beta';
  const userA = 'user_alice';
  const userB = 'user_bob';

  const ctxA = {
    userId: userA,
    companyId: companyA,
    role: 'ADMIN',
    isCompanyAdmin: true,
  };

  const ctxB = {
    userId: userB,
    companyId: companyB,
    role: 'ADMIN',
    isCompanyAdmin: true,
  };

  beforeEach(() => {
    db = new MockDb();
  });

  it('executes full 10-step lifecycle test', async () => {
    // ── STEP 1: Create a Project ─────────────────────────────────────────────
    const projectIdA = new ObjectId();
    await db.collection('projects').insertOne({
      _id: projectIdA,
      id: projectIdA.toString(),
      companyId: companyA,
      name: 'Skyline Grandeur',
      address: '100 Ring Road',
      pincode: '382418',
      projectType: 'Mixed-use',
      status: 'active',
      blockCount: 0,
      createdAt: new Date(),
    });

    // ── STEP 2: Create Tower A and Tower B in Project ────────────────────────
    const towerA = await createBlockForProject({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      input: { name: 'Tower A', code: 'T-A', description: 'Residential Wing A' },
    });
    expect(towerA.name).toBe('Tower A');

    const towerB = await createBlockForProject({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      input: { name: 'Tower B', code: 'T-B', description: 'Commercial Wing B' },
    });
    expect(towerB.name).toBe('Tower B');

    // Verify blocks list
    const blocksList = await listProjectBlocks(db as any, projectIdA.toString());
    expect(blocksList).toHaveLength(2);
    expect(blocksList[0].name).toBe('Tower A');
    expect(blocksList[1].name).toBe('Tower B');

    // ── STEP 3: Add Floors to Tower A ────────────────────────────────────────
    const towerAId = towerA._id.toString();

    const floorG = await createFloorForBlock({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      blockId: towerAId,
      input: { name: 'Ground Floor', floorNumber: 0, displayOrder: 1 },
    });
    expect(floorG.name).toBe('Ground Floor');

    const floor1 = await createFloorForBlock({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      blockId: towerAId,
      input: { name: 'First Floor', floorNumber: 1, displayOrder: 2 },
    });
    expect(floor1.name).toBe('First Floor');

    const floor2 = await createFloorForBlock({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      blockId: towerAId,
      input: { name: 'Second Floor', floorNumber: 2, displayOrder: 3 },
    });
    expect(floor2.name).toBe('Second Floor');

    const towerAFloors = await listProjectFloors(db as any, projectIdA.toString(), towerAId);
    expect(towerAFloors).toHaveLength(3);

    // ── STEP 4 & 5: Add Multiple Units using Global Master Data Specs ─────────
    const masterData = await getCompanyUnitMasterData(db as any, companyA);
    expect(masterData.unitSpecifications).toContain('Modular Kitchen');
    expect(masterData.unitSpecifications).toContain('Balcony Deck');

    const floor1Id = floor1._id.toString();

    const unit101 = await createUnitForFloor({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      blockId: towerAId,
      floorId: floor1Id,
      input: {
        unitNumber: '101',
        propertyType: masterData.unitTypes[0], // 'Apartment'
        configuration: '2 BHK',
        carpetAreaSqFt: 1000,
        builtUpAreaSqFt: 1200,
        saleableAreaSqFt: 1350,
        balconyAreaSqFt: 75,
        areaUnit: 'sq.ft',
        basePrice: 7500000,
        askingPrice: 7800000,
        facing: 'East Garden View',
        specifications: ['Modular Kitchen', 'Vitrified Flooring', 'Balcony Deck'],
        notes: 'Corner flat with cross ventilation',
      },
    });

    expect(unit101.unitCode).toBe('T-A-101');
    expect(unit101.availabilityStatus).toBe('Available');

    const unit102 = await createUnitForFloor({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      blockId: towerAId,
      floorId: floor1Id,
      input: {
        unitNumber: '102',
        propertyType: 'Apartment',
        configuration: '3 BHK',
        carpetAreaSqFt: 1450,
        builtUpAreaSqFt: 1750,
        saleableAreaSqFt: 1950,
        balconyAreaSqFt: 90,
        areaUnit: 'sq.ft',
        basePrice: 11000000,
        askingPrice: 11500000,
        facing: 'West Skyline View',
        specifications: ['Modular Kitchen', 'Wooden Flooring', 'Smart Home Automation'],
      },
    });

    expect(unit102.unitCode).toBe('T-A-102');

    // ── STEP 6: Verify Units Appear in Unit Inventory (crm_units) ─────────────
    // Query Unit Inventory as CRM would:
    const allCrmUnits = await db.collection('crm_units').find({
      projectId: projectIdA,
      companyId: companyA,
    }).toArray();

    expect(allCrmUnits).toHaveLength(2);
    expect(allCrmUnits[0].unitCode).toBe('T-A-101');
    expect(allCrmUnits[0].floorNumber).toBe(1);
    expect(allCrmUnits[0].configuration).toBe('2 BHK');
    expect(allCrmUnits[0].specifications).toContain('Modular Kitchen');
    expect(allCrmUnits[1].unitCode).toBe('T-A-102');
    expect(allCrmUnits[1].configuration).toBe('3 BHK');

    // Also verify listing through the hierarchy endpoint
    const hierarchyUnits = await listUnitsForFloor(
      db as any,
      ctxA as any,
      projectIdA.toString(),
      towerAId,
      floor1Id,
    );
    expect(hierarchyUnits).toHaveLength(2);
    expect(hierarchyUnits[0].unitCode).toBe('T-A-101');

    // ── STEP 7: Edit a Unit and Verify Synchronized Details ───────────────────
    const unit101Id = unit101._id.toString();
    const updatedUnit101 = await updateUnitForFloor({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      blockId: towerAId,
      floorId: floor1Id,
      unitId: unit101Id,
      patch: {
        basePrice: 8200000,
        carpetAreaSqFt: 1050,
        notes: 'Updated description after site inspection',
      },
    });

    expect(updatedUnit101.basePrice).toBe(8200000);
    expect(updatedUnit101.basePricePaise).toBe(820000000);
    expect(updatedUnit101.carpetAreaSqFt).toBe(1050);

    // Verify it is synchronized in crm_units
    const crmUnitSync = await db.collection('crm_units').findOne({ _id: unit101._id });
    expect(crmUnitSync.basePrice).toBe(8200000);
    expect(crmUnitSync.carpetAreaSqFt).toBe(1050);

    // ── STEP 8: Availability & Booking Status Consistency with CRM ────────────
    // CRM creates a confirmed booking for Unit 101
    const bookingId = new ObjectId();
    await db.collection('crm_bookings').insertOne({
      _id: bookingId,
      companyId: companyA,
      projectId: projectIdA,
      unitId: unit101Id,
      unitCode: unit101.unitCode,
      customerName: 'Darshan Patel',
      status: 'Confirmed',
      agreementPrice: 8200000,
    });

    // Update unit status to 'Booked' in crm_units
    await db.collection('crm_units').updateOne(
      { _id: unit101._id },
      { $set: { availabilityStatus: 'Booked', activeBookingId: bookingId } },
    );

    // Both views now immediately report Booked status
    const verifiedUnitFromHierarchy = await listUnitsForFloor(
      db as any,
      ctxA as any,
      projectIdA.toString(),
      towerAId,
      floor1Id,
    );
    const bookedUnit = verifiedUnitFromHierarchy.find((u) => u.unitCode === 'T-A-101');
    expect(bookedUnit.effectiveStatus).toBe('Booked');

    // ── STEP 9: Dependency Validation on Deletion ─────────────────────────────
    // Attempting to delete Floor 1 which has units -> MUST BE REJECTED
    await expect(
      deleteFloorForBlock({
        db: db as any,
        ctx: ctxA as any,
        projectId: projectIdA.toString(),
        blockId: towerAId,
        floorId: floor1Id,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'FLOOR_HAS_UNITS' });

    // Attempting to delete Unit 101 which has an active booking -> MUST BE REJECTED
    await expect(
      deleteUnitForFloor({
        db: db as any,
        ctx: ctxA as any,
        projectId: projectIdA.toString(),
        blockId: towerAId,
        floorId: floor1Id,
        unitId: unit101Id,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'UNIT_HAS_BOOKINGS' });

    // Attempting to delete Tower A which has floors and units -> MUST BE REJECTED
    await expect(
      archiveBlockForProject({
        db: db as any,
        ctx: ctxA as any,
        projectId: projectIdA.toString(),
        blockId: towerAId,
        hardDelete: true,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'BLOCK_HAS_CHILDREN' });

    // Deleting an empty floor (e.g. Floor 2) works safely
    const floor2Id = floor2._id.toString();
    const deleteFloor2Res = await deleteFloorForBlock({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      blockId: towerAId,
      floorId: floor2Id,
      hardDelete: true,
    });
    expect(deleteFloor2Res.deleted).toBe(true);

    // Deleting unbooked Unit 102 works safely
    const unit102Id = unit102._id.toString();
    const deleteUnit102Res = await deleteUnitForFloor({
      db: db as any,
      ctx: ctxA as any,
      projectId: projectIdA.toString(),
      blockId: towerAId,
      floorId: floor1Id,
      unitId: unit102Id,
    });
    expect(deleteUnit102Res.archived).toBe(true);

    // ── STEP 10: Tenant Isolation ─────────────────────────────────────────────
    // User B from Company B attempts to access or modify Company A's project
    await expect(
      createBlockForProject({
        db: db as any,
        ctx: ctxB as any,
        projectId: projectIdA.toString(),
        input: { name: 'Illegal Block' },
      }),
    ).rejects.toMatchObject({ status: 404 });

    // User B attempts to access Company A's floor
    await expect(
      listUnitsForFloor(
        db as any,
        ctxB as any,
        projectIdA.toString(),
        towerAId,
        floor1Id,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

