import { ObjectId } from 'mongodb';
import {
  normalizeFloorName,
  createFloorForBlock,
  updateFloorForBlock,
  deleteFloorForBlock,
  listProjectFloors,
  PROJECT_FLOORS_COLLECTION,
} from './project-floors.service';
import {
  createUnitForFloor,
  updateUnitForFloor,
  deleteUnitForFloor,
  listUnitsForFloor,
  CRM_UNITS_COLLECTION,
} from './project-units.service';
import { getCompanyUnitMasterData, DEFAULT_UNIT_MASTER_DATA } from './unit-master-data';

describe('Project Floors & Units Service Suite', () => {
  const companyId = 'comp_test_123';
  const userId = 'usr_test_456';
  const projectId = new ObjectId().toString();
  const blockId = new ObjectId().toString();

  const ctx = {
    userId,
    companyId,
    role: 'ADMIN',
    isCompanyAdmin: true,
  };

  const mockProject = {
    _id: new ObjectId(projectId),
    id: projectId,
    companyId,
    name: 'Dashtech Tower Project',
    status: 'active',
  };

  const mockBlock = {
    _id: new ObjectId(blockId),
    id: blockId,
    companyId,
    projectId,
    name: 'Tower A',
    status: 'active',
  };

  describe('Global Unit Master Data', () => {
    it('returns default master data when company has no custom settings', async () => {
      const db = {
        collection: () => ({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      };
      const masterData = await getCompanyUnitMasterData(db, companyId);
      expect(masterData.unitTypes).toEqual(DEFAULT_UNIT_MASTER_DATA.unitTypes);
      expect(masterData.unitConfigurations).toContain('2 BHK');
      expect(masterData.unitSpecifications).toContain('Modular Kitchen');
      expect(masterData.areaMeasurementOptions).toContain('sq.ft');
    });

    it('returns custom master data when defined in crm_settings', async () => {
      const db = {
        collection: () => ({
          findOne: jest.fn().mockResolvedValue({
            companyId,
            unitTypes: ['Custom Studio', 'Penthouse'],
            unitConfigurations: ['1 BHK Ultra', '3 BHK Luxury'],
          }),
        }),
      };
      const masterData = await getCompanyUnitMasterData(db, companyId);
      expect(masterData.unitTypes).toEqual(['Custom Studio', 'Penthouse']);
      expect(masterData.unitConfigurations).toEqual(['1 BHK Ultra', '3 BHK Luxury']);
    });
  });

  describe('Project Floors Management', () => {
    it('normalizes floor names cleanly', () => {
      expect(normalizeFloorName('  Ground   Floor ')).toBe('ground floor');
      expect(normalizeFloorName('Basement - 1')).toBe('basement - 1');
    });

    it('creates a new floor in a block', async () => {
      const floorId = new ObjectId();
      const db = {
        collection: (name: string) => {
          if (name === 'projects') return { findOne: jest.fn().mockResolvedValue(mockProject) };
          if (name === 'project_blocks') return { findOne: jest.fn().mockResolvedValue(mockBlock) };
          if (name === PROJECT_FLOORS_COLLECTION) {
            return {
              findOne: jest.fn().mockResolvedValue(null), // no duplicate
              countDocuments: jest.fn().mockResolvedValue(0),
              insertOne: jest.fn().mockResolvedValue({ insertedId: floorId }),
            };
          }
          return {};
        },
      };

      const floor = await createFloorForBlock({
        db,
        ctx: ctx as any,
        projectId,
        blockId,
        input: { name: 'Ground Floor', floorNumber: 0 },
      });

      expect(floor.name).toBe('Ground Floor');
      expect(floor.floorNumber).toBe(0);
      expect(floor.status).toBe('active');
    });

    it('rejects duplicate floor names in the same block', async () => {
      const db = {
        collection: (name: string) => {
          if (name === 'projects') return { findOne: jest.fn().mockResolvedValue(mockProject) };
          if (name === 'project_blocks') return { findOne: jest.fn().mockResolvedValue(mockBlock) };
          if (name === PROJECT_FLOORS_COLLECTION) {
            return {
              findOne: jest.fn().mockResolvedValue({ name: 'Ground Floor' }), // existing
            };
          }
          return {};
        },
      };

      await expect(
        createFloorForBlock({
          db,
          ctx: ctx as any,
          projectId,
          blockId,
          input: { name: 'ground floor' },
        }),
      ).rejects.toMatchObject({ status: 409, code: 'FLOOR_NAME_DUPLICATE' });
    });

    it('blocks floor deletion when active units exist on that floor', async () => {
      const floorId = new ObjectId();
      const mockFloor = {
        _id: floorId,
        name: 'First Floor',
        floorNumber: 1,
        blockId,
        projectId,
        status: 'active',
      };

      const db = {
        collection: (name: string) => {
          if (name === 'projects') return { findOne: jest.fn().mockResolvedValue(mockProject) };
          if (name === 'project_blocks') return { findOne: jest.fn().mockResolvedValue(mockBlock) };
          if (name === PROJECT_FLOORS_COLLECTION) {
            return { findOne: jest.fn().mockResolvedValue(mockFloor) };
          }
          if (name === 'crm_units') {
            return {
              countDocuments: jest.fn().mockResolvedValue(4), // 4 units exist!
            };
          }
          return {};
        },
      };

      await expect(
        deleteFloorForBlock({
          db,
          ctx: ctx as any,
          projectId,
          blockId,
          floorId: floorId.toString(),
        }),
      ).rejects.toMatchObject({ status: 409, code: 'FLOOR_HAS_UNITS' });
    });
  });

  describe('Project Units Management (Reusing crm_units)', () => {
    const floorId = new ObjectId().toString();
    const mockFloor = {
      _id: new ObjectId(floorId),
      id: floorId,
      name: 'First Floor',
      floorNumber: 1,
      blockId,
      projectId,
      status: 'active',
    };

    it('creates a unit with global master data specs and prevents duplicate codes', async () => {
      const unitId = new ObjectId();
      let insertedDoc: any = null;

      const db = {
        collection: (name: string) => {
          if (name === 'projects') return { findOne: jest.fn().mockResolvedValue(mockProject) };
          if (name === 'project_blocks') return { findOne: jest.fn().mockResolvedValue(mockBlock) };
          if (name === PROJECT_FLOORS_COLLECTION) {
            return {
              findOne: jest.fn().mockResolvedValue(mockFloor),
              updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
            };
          }
          if (name === 'crm_settings') return { findOne: jest.fn().mockResolvedValue(null) };
          if (name === CRM_UNITS_COLLECTION) {
            return {
              findOne: jest.fn().mockResolvedValue(null), // no duplicate
              insertOne: jest.fn().mockImplementation((doc) => {
                insertedDoc = doc;
                return { insertedId: unitId };
              }),
            };
          }
          return {};
        },
      };

      const unit = await createUnitForFloor({
        db,
        ctx: ctx as any,
        projectId,
        blockId,
        floorId,
        input: {
          unitNumber: '101',
          propertyType: 'Apartment',
          configuration: '2 BHK',
          carpetAreaSqFt: 1050,
          builtUpAreaSqFt: 1260,
          saleableAreaSqFt: 1420,
          balconyAreaSqFt: 85,
          areaUnit: 'sq.ft',
          specifications: ['Modular Kitchen', 'Vitrified Flooring', 'Balcony Deck'],
          basePrice: 8500000,
          facing: 'East Garden View',
        },
      });

      expect(unit.unitCode).toBe('TOWER A-101');
      expect(unit.buildingTower).toBe('Tower A');
      expect(unit.floorNumber).toBe(1);
      expect(unit.configuration).toBe('2 BHK');
      expect(unit.specifications).toEqual(['Modular Kitchen', 'Vitrified Flooring', 'Balcony Deck']);
      expect(unit.features).toEqual(['Modular Kitchen', 'Vitrified Flooring', 'Balcony Deck']); // backward compatibility
      expect(unit.basePricePaise).toBe(850000000);
      expect(unit.availabilityStatus).toBe('Available');
      expect(insertedDoc).not.toBeNull();
    });

    it('rejects duplicate unit code in the same project', async () => {
      const db = {
        collection: (name: string) => {
          if (name === 'projects') return { findOne: jest.fn().mockResolvedValue(mockProject) };
          if (name === 'project_blocks') return { findOne: jest.fn().mockResolvedValue(mockBlock) };
          if (name === PROJECT_FLOORS_COLLECTION) {
            return { findOne: jest.fn().mockResolvedValue(mockFloor) };
          }
          if (name === CRM_UNITS_COLLECTION) {
            return {
              findOne: jest.fn().mockResolvedValue({ unitCode: 'TOWER A-101' }), // collision!
            };
          }
          return {};
        },
      };

      await expect(
        createUnitForFloor({
          db,
          ctx: ctx as any,
          projectId,
          blockId,
          floorId,
          input: { unitNumber: '101' },
        }),
      ).rejects.toMatchObject({ status: 409, code: 'UNIT_CODE_DUPLICATE' });
    });

    it('blocks unit deletion if unit has an active booking in CRM', async () => {
      const unitId = new ObjectId();
      const mockUnit = {
        _id: unitId,
        unitCode: 'TOWER A-101',
        projectId,
        blockId,
        floorId,
        availabilityStatus: 'Booked',
      };

      const db = {
        collection: (name: string) => {
          if (name === 'projects') return { findOne: jest.fn().mockResolvedValue(mockProject) };
          if (name === 'project_blocks') return { findOne: jest.fn().mockResolvedValue(mockBlock) };
          if (name === PROJECT_FLOORS_COLLECTION) {
            return { findOne: jest.fn().mockResolvedValue(mockFloor) };
          }
          if (name === CRM_UNITS_COLLECTION) {
            return { findOne: jest.fn().mockResolvedValue(mockUnit) };
          }
          if (name === 'crm_bookings') {
            return { countDocuments: jest.fn().mockResolvedValue(1) }; // 1 active booking!
          }
          if (name === 'crm_unit_interests') {
            return { countDocuments: jest.fn().mockResolvedValue(0) };
          }
          return {};
        },
      };

      await expect(
        deleteUnitForFloor({
          db,
          ctx: ctx as any,
          projectId,
          blockId,
          floorId,
          unitId: unitId.toString(),
        }),
      ).rejects.toMatchObject({ status: 409, code: 'UNIT_HAS_BOOKINGS' });
    });
  });
});

