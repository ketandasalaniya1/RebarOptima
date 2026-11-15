import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  reserveUnitSafely,
  releaseUnitSafely,
  blockUnitSafely,
  unblockUnitSafely,
  evaluateUnitAvailability,
  generateBusinessReference
} from './crm.reservation.service';
import { calculateBookingFinancials, rupeesToPaise } from './crm.calculation.service';
import { resolveUserAndCompany, listAccessibleGlobalProjects } from '../projects/module-project-adapter';
import { requireCrmRole } from './crm.security.service';
import { crmRateLimiter } from './crm.validation';

export function createCrmProjectUnitRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
  const router = Router();

  const resolveCompanyId = async (req: any, db: any): Promise<ObjectId | string> => {
    const ctx = await resolveUserAndCompany(req, db);
    return ctx.companyId;
  };

  // ── PROJECTS ─────────────────────────────────────────────────────────────

  // GET /api/crm/projects - List global projects with unit availability summary
  router.get('/projects', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = ctx.companyId;

      let projects = await listAccessibleGlobalProjects(db, ctx);
      if (!projects || projects.length === 0) {
        projects = await db.collection('crm_projects').find({ companyId }).toArray();
      }
      const allUnits = await db.collection('crm_units').find({ companyId }).toArray();
      const allInterests = await db.collection('crm_unit_interests').find({ companyId }).toArray();

      const enriched = projects.map((p: any) => {
        const pIdStr = String(p._id || p.id);
        const pUnits = allUnits.filter((u: any) => String(u.projectId) === pIdStr);
        const pInterests = allInterests.filter((i: any) => String(i.projectId) === pIdStr);

        const available = pUnits.filter((u: any) => evaluateUnitAvailability(u).status === 'Available').length;
        const held = pUnits.filter((u: any) => u.availabilityStatus === 'Held' && !evaluateUnitAvailability(u).isHoldExpired).length;
        const reserved = pUnits.filter((u: any) => u.availabilityStatus === 'Reserved').length;
        const booked = pUnits.filter((u: any) => u.availabilityStatus === 'Booked').length;
        const blocked = pUnits.filter((u: any) => u.availabilityStatus === 'Blocked').length;
        const sold = pUnits.filter((u: any) => u.availabilityStatus === 'Sold').length;

        return {
          ...p,
          totalUnits: pUnits.length,
          stats: {
            available,
            held,
            reserved,
            booked,
            blocked,
            sold,
            leadsCount: pInterests.length
          }
        };
      });

      res.json(enriched);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/crm/projects - Create via global catalog
  router.post('/projects', authMiddleware, async (_req: any, res) => {
    return res.status(400).json({
      message: 'Create projects via Company Projects (POST /api/projects).',
      code: 'USE_GLOBAL_PROJECTS',
    });
  });

  router.post('/projects/_legacy_disabled', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        name,
        projectCode,
        developerName,
        address,
        location,
        city,
        description,
        propertyCategory = 'Residential',
        configurations = ['2BHK', '3BHK'],
        salesStartDate,
        projectStatus = 'Under Construction',
        bannerUrl
      } = req.body;

      if (!name) return res.status(400).json({ message: 'Project name is required.' });

      const code = projectCode || await generateBusinessReference(db, companyId, 'crm_projects', 'PRJ', 'projectCode');

      const newProject: any = {
        companyId,
        projectCode: code,
        name: name.trim(),
        developerName: developerName || 'Primary Developer',
        address: address || '',
        location: location || '',
        city: city || '',
        description: description || '',
        propertyCategory,
        configurations: Array.isArray(configurations) ? configurations : [configurations],
        salesStartDate: salesStartDate || new Date().toISOString().split('T')[0],
        projectStatus,
        bannerUrl: bannerUrl || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('crm_projects').insertOne(newProject);
      res.status(201).json({ _id: result.insertedId, ...newProject });
    } catch (err: any) {
      console.error('Error creating project:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/crm/projects/:id - Project details with units matrix
  router.get('/projects/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const pId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      let project = (await db.collection('projects').findOne({ _id: pId }))
        || (await db.collection('crm_projects').findOne({ _id: pId, companyId }));
      if (!project) return res.status(404).json({ message: 'Project not found.' });

      const units = await db.collection('crm_units').find({ projectId: pId, companyId }).sort({ floorNumber: 1, unitNumber: 1 }).toArray();

      res.json({ project, units });
    } catch (err: any) {
      console.error('Error fetching project detail:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // ── UNITS ────────────────────────────────────────────────────────────────

  // GET /api/crm/units - Search and filter units across projects or within a project
  router.get('/units', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const cMatcher = ObjectId.isValid(String(companyId)) && String(companyId).length === 24
        ? { $in: [String(companyId), new ObjectId(String(companyId))] }
        : companyId;
      const { projectId, status, tower, configuration, minFloor, maxFloor, search } = req.query;

      const query: any = { companyId: cMatcher };
      if (projectId) {
        query.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }
      if (tower) {
        query.buildingTower = tower;
      }
      if (configuration) {
        query.configuration = configuration;
      }
      if (status) {
        query.availabilityStatus = status;
      }

      let units = await db.collection('crm_units').find(query).sort({ floorNumber: 1, unitNumber: 1 }).toArray();

      if (search) {
        const term = String(search).toLowerCase().trim();
        units = units.filter((u: any) =>
          (u.unitCode && u.unitCode.toLowerCase().includes(term)) ||
          (u.buildingTower && u.buildingTower.toLowerCase().includes(term)) ||
          (u.projectName && u.projectName.toLowerCase().includes(term))
        );
      }

      // Check and update any expired holds
      const enrichedUnits = units.map((u: any) => {
        const evalRes = evaluateUnitAvailability(u);
        return {
          ...u,
          effectiveStatus: evalRes.status,
          isHoldExpired: evalRes.isHoldExpired
        };
      });

      res.json(enrichedUnits);
    } catch (err: any) {
      console.error('Error fetching units:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/crm/units/:id - UNIT WISE PROFILE (Directly satisfies Darshan's handwritten architectural diagram!)
  // Diagram:
  // Unit Wise Profile
  //   1. Unit No
  //   2. Booking Status
  //   3. If booking Done then their info (customer, booking financial details)
  //   4. If not Done then Lead Management (unit interest leads pipeline for this specific unit)
  router.get('/units/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const cMatcher = ObjectId.isValid(String(companyId)) && String(companyId).length === 24
        ? { $in: [String(companyId), new ObjectId(String(companyId))] }
        : companyId;
      const uId = ObjectId.isValid(String(req.params.id)) && String(req.params.id).length === 24
        ? { $in: [new ObjectId(String(req.params.id)), String(req.params.id)] }
        : req.params.id;

      let unit = await db.collection('crm_units').findOne({ _id: uId, companyId: cMatcher });
      if (!unit) {
        unit = await db.collection('crm_units').findOne({ _id: uId });
      }
      if (!unit) return res.status(404).json({ message: 'Property unit not found.' });

      const evalRes = evaluateUnitAvailability(unit);

      // 1 & 2: Unit No & Effective Booking/Availability Status
      const response: any = {
        unit: {
          ...unit,
          effectiveStatus: evalRes.status,
          isHoldExpired: evalRes.isHoldExpired
        },
        unitNumber: unit.unitNumber,
        unitCode: unit.unitCode,
        availabilityStatus: evalRes.status,
        bookingDone: ['Booked', 'Sold'].includes(evalRes.status),
        bookingInfo: null,
        leadManagement: []
      };

      // 3: If booking Done -> include Customer & Booking info + Financials
      if (['Booked', 'Sold'].includes(unit.availabilityStatus) || unit.activeBookingId) {
        let booking: any = null;
        if (unit.activeBookingId) {
          const bId = ObjectId.isValid(unit.activeBookingId) ? new ObjectId(unit.activeBookingId) : unit.activeBookingId;
          booking = await db.collection('crm_bookings').findOne({ _id: bId, companyId });
        } else {
          booking = await db.collection('crm_bookings').findOne({ unitId: uId, status: { $ne: 'Cancelled' }, companyId });
        }

        if (booking) {
          const [customer, schedules, txns] = await Promise.all([
            db.collection('crm_customers').findOne({ _id: booking.customerId, companyId }),
            db.collection('crm_payment_schedules').find({ bookingId: booking._id, companyId }).toArray(),
            db.collection('crm_payment_transactions').find({ bookingId: booking._id, companyId }).toArray()
          ]);

          const financials = calculateBookingFinancials(booking, schedules, txns);

          response.bookingInfo = {
            booking,
            customer,
            financials,
            schedules,
            transactions: txns
          };
        }
      }

      // 4: If not Done (or parallel enquiry history) -> Lead Management for this specific unit
      const unitInterests = await db.collection('crm_unit_interests').find({
        $or: [{ unitId: uId }, { unitCode: unit.unitCode }],
        companyId
      }).sort({ updatedAt: -1 }).toArray();

      // Enrich interests with customer phone and latest activity
      response.leadManagement = unitInterests;

      res.json(response);
    } catch (err: any) {
      console.error('Error fetching unit-wise profile:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/crm/units - Add new unit to project inventory
  router.post('/units', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        projectId,
        buildingTower,
        blockId,
        floorId,
        floorName,
        floorNumber,
        unitNumber,
        unitCode: customUnitCode,
        configuration = '2BHK',
        propertyType = 'Apartment',
        carpetAreaSqFt,
        builtUpAreaSqFt,
        saleableAreaSqFt,
        balconyAreaSqFt,
        areaUnit = 'sq.ft',
        specifications,
        features,
        basePrice,
        askingPrice,
        facing = 'East',
        notes
      } = req.body;

      if (!projectId || !buildingTower || floorNumber === undefined || !unitNumber) {
        return res.status(400).json({ message: 'Project, tower, floor, and unit number are required.' });
      }

      const prjId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      const project = (await db.collection('projects').findOne({ _id: prjId }))
        || (await db.collection('crm_projects').findOne({ _id: prjId, companyId }));
      if (!project) return res.status(404).json({ message: 'Parent project not found.' });

      const unitCode = customUnitCode ? String(customUnitCode).trim().toUpperCase() : `${buildingTower}-${unitNumber}`.toUpperCase();

      // Check collision within same project
      const exists = await db.collection('crm_units').findOne({
        projectId: prjId,
        unitCode,
        companyId
      });

      if (exists) {
        return res.status(409).json({ message: `Unit ${unitCode} already exists in project ${project.name}.` });
      }

      const calculatedBasePrice = Number(basePrice) || (Number(carpetAreaSqFt || 1000) * 6000);
      const calculatedAskingPrice = Number(askingPrice) || calculatedBasePrice;

      const specsList = Array.isArray(specifications) ? specifications : (Array.isArray(features) ? features : []);

      const newUnit: any = {
        companyId,
        projectId: prjId,
        projectName: project.name,
        unitCode,
        buildingTower: String(buildingTower).trim().toUpperCase(),
        sectionName: String(buildingTower).trim().toUpperCase(),
        blockId: blockId ? String(blockId) : undefined,
        floorId: floorId ? String(floorId) : undefined,
        floorName: floorName ? String(floorName) : undefined,
        floorNumber: Number(floorNumber),
        unitNumber: String(unitNumber).trim(),
        configuration,
        propertyType,
        carpetAreaSqFt: Number(carpetAreaSqFt) || 0,
        builtUpAreaSqFt: Number(builtUpAreaSqFt) || 0,
        saleableAreaSqFt: Number(saleableAreaSqFt) || Number(carpetAreaSqFt) || 0,
        balconyAreaSqFt: Number(balconyAreaSqFt) || 0,
        areaUnit,
        specifications: specsList,
        features: specsList,
        basePrice: calculatedBasePrice,
        basePricePaise: rupeesToPaise(calculatedBasePrice),
        askingPrice: calculatedAskingPrice,
        askingPricePaise: rupeesToPaise(calculatedAskingPrice),
        availabilityStatus: 'Available',
        heldUntil: null,
        heldByCustomerId: null,
        activeBookingId: null,
        facing,
        notes: notes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('crm_units').insertOne(newUnit);
      res.status(201).json({ _id: result.insertedId, ...newUnit });
    } catch (err: any) {
      console.error('Error creating unit:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/crm/units/:id/reserve - Atomic unit reservation
  router.post(
    '/units/:id/reserve',
    authMiddleware,
    requireCrmRole('admin', 'sales_manager', 'sales_rep'),
    crmRateLimiter({ max: 30 }),
    async (req: any, res) => {
      try {
        const db = getDb();
        const companyId = await resolveCompanyId(req, db);
        const { customerId, durationHours, holdDurationHours } = req.body;

        if (!customerId) return res.status(400).json({ message: 'Customer ID is required to reserve a unit.' });

        const hours = Number(holdDurationHours || durationHours || 48);

        const reservationResult = await reserveUnitSafely(
          db,
          companyId,
          req.params.id,
          customerId,
          hours
        );

        if (!reservationResult.success) {
          return res.status(409).json({ message: reservationResult.message, conflict: true });
        }

        res.json(reservationResult);
      } catch (err: any) {
        console.error('Error reserving unit:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // POST /api/crm/units/:id/release - Safe unit release back to Available
  router.post(
    '/units/:id/release',
    authMiddleware,
    requireCrmRole('admin', 'sales_manager', 'sales_rep'),
    crmRateLimiter({ max: 30 }),
    async (req: any, res) => {
      try {
        const db = getDb();
        const companyId = await resolveCompanyId(req, db);

        const releaseResult = await releaseUnitSafely(db, companyId, req.params.id);
        if (!releaseResult.success) {
          return res.status(409).json({ message: releaseResult.message, conflict: true });
        }

        res.json(releaseResult);
      } catch (err: any) {
        console.error('Error releasing unit:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // PUT /api/crm/units/:id - Update unit details or block/unblock status
  router.put('/units/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const uId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const allowedFields = [
        'askingPrice', 'basePrice', 'carpetAreaSqFt', 'builtUpAreaSqFt',
        'saleableAreaSqFt', 'balconyAreaSqFt', 'areaUnit', 'configuration',
        'propertyType', 'facing', 'notes', 'availabilityStatus',
        'specifications', 'features', 'unitNumber', 'unitCode', 'floorId', 'floorName', 'blockId'
      ];

      const updateData: any = { updatedAt: new Date() };
      for (const f of allowedFields) {
        if (req.body[f] !== undefined) updateData[f] = req.body[f];
      }
      if (req.body.basePrice !== undefined) {
        updateData.basePricePaise = rupeesToPaise(Number(req.body.basePrice));
      }
      if (req.body.askingPrice !== undefined) {
        updateData.askingPricePaise = rupeesToPaise(Number(req.body.askingPrice));
      }
      if (req.body.specifications !== undefined && Array.isArray(req.body.specifications)) {
        updateData.features = req.body.specifications;
      }

      await db.collection('crm_units').updateOne(
        { _id: uId, companyId },
        { $set: updateData }
      );

      const updated = await db.collection('crm_units').findOne({ _id: uId });
      res.json(updated);
    } catch (err: any) {
      console.error('Error updating unit:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // ── BLOCKS & TOWERS ──────────────────────────────────────────────────────

  // GET /api/crm/blocks - List distinct blocks/towers for a project
  router.get('/blocks', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.query;

      const query: any = { companyId };
      if (projectId) {
        query.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }

      // 1. Canonical blocks from project_blocks
      const pIdStr = projectId ? String(projectId) : null;
      let canonicalBlocks: any[] = [];
      if (pIdStr) {
        canonicalBlocks = await db.collection('project_blocks').find({
          projectId: { $in: [pIdStr, ObjectId.isValid(pIdStr) && pIdStr.length === 24 ? new ObjectId(pIdStr) : null].filter(Boolean) },
          isDeleted: { $ne: true },
          status: { $ne: 'inactive' }
        }).sort({ displayOrder: 1, createdAt: 1 }).toArray();

        // Enrich canonical blocks with live floorCount and unitCount
        await Promise.all(canonicalBlocks.map(async (b: any) => {
          const bId = String(b._id || b.id);
          const bName = b.name || b.blockName;
          const [floorCount, unitCount] = await Promise.all([
            db.collection('project_floors').countDocuments({
              $or: [{ blockId: bId }, ObjectId.isValid(bId) ? { blockId: new ObjectId(bId) } : null].filter(Boolean),
              isDeleted: { $ne: true }
            }).catch(() => 0),
            db.collection('crm_units').countDocuments({
              $or: [
                { blockId: bId },
                ObjectId.isValid(bId) ? { blockId: new ObjectId(bId) } : null,
                bName ? { buildingTower: bName } : null
              ].filter(Boolean),
              isDeleted: { $ne: true }
            }).catch(() => 0)
          ]);
          b.floorCount = floorCount;
          b.unitCount = unitCount;
        }));
      }

      // 2. Explicit blocks in crm_blocks
      const explicitBlocks = await db.collection('crm_blocks').find(query).sort({ blockName: 1 }).toArray();

      // 3. Distinct towers inferred from crm_units
      const unitTowers = await db.collection('crm_units').distinct('buildingTower', query);

      const map = new Map<string, any>();

      canonicalBlocks.forEach((b: any) => {
        const name = b.name || b.blockName;
        if (name) {
          map.set(name.toUpperCase(), {
            ...b,
            _id: b._id,
            id: (b._id || b.id).toString(),
            blockName: name,
            source: 'project_blocks'
          });
        }
      });

      explicitBlocks.forEach((b: any) => {
        const name = b.blockName || b.name;
        if (name && !map.has(name.toUpperCase())) {
          map.set(name.toUpperCase(), { ...b, blockName: name, source: 'crm_blocks' });
        }
      });

      for (const t of unitTowers) {
        if (t && !map.has(t.toUpperCase())) {
          map.set(t.toUpperCase(), {
            blockName: t,
            projectId: query.projectId,
            source: 'inferred'
          });
        }
      }

      res.json(Array.from(map.values()));
    } catch (err: any) {
      console.error('Error fetching blocks:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/crm/floors - List canonical floors from project_floors for a project / block
  router.get('/floors', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, blockId } = req.query;

      if (!projectId) {
        return res.status(400).json({ message: 'projectId query parameter is required.' });
      }

      const pIdStr = String(projectId);
      const pMatcher = ObjectId.isValid(pIdStr) && pIdStr.length === 24
        ? { $in: [pIdStr, new ObjectId(pIdStr)] }
        : pIdStr;

      const filter: any = {
        projectId: pMatcher,
        isDeleted: { $ne: true },
        status: { $ne: 'inactive' }
      };

      if (blockId && blockId !== 'ALL') {
        const bIdStr = String(blockId);
        filter.$or = [
          { blockId: bIdStr },
          ObjectId.isValid(bIdStr) && bIdStr.length === 24 ? { blockId: new ObjectId(bIdStr) } : null
        ].filter(Boolean);
      }

      const floors = await db.collection('project_floors')
        .find(filter)
        .sort({ displayOrder: 1, floorNumber: 1, createdAt: 1 })
        .toArray();

      // Look up block names for any floor missing blockName
      const blockIds = Array.from(new Set(floors.map((f: any) => String(f.blockId)).filter(Boolean)));
      const blockMap = new Map<string, string>();
      if (blockIds.length > 0) {
        const blocks = await db.collection('project_blocks').find({
          _id: { $in: blockIds.map((id: string) => ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : id) }
        }).toArray();
        blocks.forEach((b: any) => {
          blockMap.set(String(b._id), b.name || b.blockName || '');
        });
      }

      // Enrich with live unit count
      const enriched = await Promise.all(floors.map(async (f: any) => {
        const fId = String(f._id);
        const bName = f.blockName || blockMap.get(String(f.blockId)) || '';
        const unitCount = await db.collection('crm_units').countDocuments({
          $or: [
            { floorId: fId },
            { floorId: f._id },
            {
              projectId: pMatcher,
              floorNumber: Number(f.floorNumber),
              buildingTower: bName || undefined
            }
          ],
          isDeleted: { $ne: true }
        }).catch(() => 0);

        return {
          ...f,
          id: String(f._id),
          blockName: bName,
          unitCount
        };
      }));

      res.json(enriched);
    } catch (err: any) {
      console.error('Error fetching CRM floors:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/crm/projects/:id/clear-seed-units - Safely purge unlinked seed/mock units
  router.post('/projects/:id/clear-seed-units', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const pId = String(req.params.id);
      const pMatcher = ObjectId.isValid(pId) && pId.length === 24
        ? { $in: [pId, new ObjectId(pId)] }
        : pId;
      const cMatcher = ObjectId.isValid(String(companyId)) && String(companyId).length === 24
        ? { $in: [String(companyId), new ObjectId(String(companyId))] }
        : companyId;

      // Match ONLY seed units that have NO valid floorId or match seed note templates
      const seedFilter: any = {
        projectId: pMatcher,
        $or: [
          { floorId: { $exists: false } },
          { floorId: null },
          { notes: { $regex: /luxury apartment with premium vitrified tiles/i } }
        ]
      };
      if (companyId) {
        seedFilter.companyId = cMatcher;
      }

      const seedUnits = await db.collection('crm_units').find(seedFilter, { projection: { _id: 1, unitCode: 1 } }).toArray();
      const seedIds = seedUnits.map((u: any) => u._id);
      const seedIdStrs = seedUnits.map((u: any) => String(u._id));

      if (seedUnits.length === 0) {
        return res.json({
          success: true,
          deletedCount: 0,
          message: 'No seed units found to clear for this project.'
        });
      }

      // Clean up any unlinked interests/bookings on these specific units
      if (seedIds.length > 0) {
        await Promise.all([
          db.collection('crm_unit_interests').deleteMany({
            $or: [{ unitId: { $in: seedIds } }, { unitId: { $in: seedIdStrs } }]
          }).catch(() => { }),
          db.collection('crm_bookings').deleteMany({
            $or: [{ unitId: { $in: seedIds } }, { unitId: { $in: seedIdStrs } }]
          }).catch(() => { })
        ]);
      }

      const delRes = await db.collection('crm_units').deleteMany({ _id: { $in: seedIds } });

      if (typeof logAudit === 'function') {
        await logAudit({
          action: 'CLEAR_SEED_UNITS',
          resource: 'crm_units',
          performedBy: req.user?.sub,
          companyId,
          projectId: pId,
          details: { deletedCount: delRes.deletedCount, deletedCodes: seedUnits.slice(0, 10).map((u: any) => u.unitCode) }
        });
      }

      res.json({
        success: true,
        deletedCount: delRes.deletedCount,
        message: `Successfully cleared ${delRes.deletedCount} seed units.`
      });
    } catch (err: any) {
      console.error('Error clearing seed units:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/crm/blocks - Create new Block / Tower and batch-generate units
  router.post('/blocks', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        projectId,
        blockName,
        floorsCount = 10,
        startFloor = 1,
        unitsPerFloor = 4,
        configurations = ['1BHK', '2BHK', '3BHK', '2BHK'],
        basePrice = 6500000,
        askingPrice = 7200000,
        carpetAreaSqFt = 950,
        saleableAreaSqFt = 1250,
        facing = 'East',
        prefix,
        notes = ''
      } = req.body;

      if (!projectId || !blockName) {
        return res.status(400).json({ message: 'Project ID and Block/Tower Name are required.' });
      }

      const prjId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      const project = (await db.collection('projects').findOne({ _id: prjId }))
        || (await db.collection('crm_projects').findOne({ _id: prjId, companyId }));
      if (!project) return res.status(404).json({ message: 'Parent project not found.' });

      const cleanBlockName = String(blockName).trim().toUpperCase();
      const blockPrefix = prefix ? String(prefix).trim().toUpperCase() : cleanBlockName.replace(/[^A-Z0-9]/gi, '').slice(0, 3) || 'BLK';

      // 1. Create or upsert Block record
      const blockDoc: any = {
        companyId,
        projectId: prjId,
        projectName: project.name,
        blockName: cleanBlockName,
        prefix: blockPrefix,
        startFloor: Number(startFloor) || 1,
        floorsCount: Number(floorsCount) || 1,
        unitsPerFloor: Number(unitsPerFloor) || 1,
        notes,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const blockResult = await db.collection('crm_blocks').insertOne(blockDoc);

      // 2. Batch generate units
      const unitsToInsert: any[] = [];
      const numFloors = Math.max(1, Math.min(Number(floorsCount) || 10, 100));
      const startF = Math.max(1, Number(startFloor) || 1);
      const numUnitsPerF = Math.max(1, Math.min(Number(unitsPerFloor) || 4, 30));
      const configList = Array.isArray(configurations) && configurations.length > 0
        ? configurations
        : ['1BHK', '2BHK', '3BHK', '2BHK'];

      // Get existing unit codes in this project to prevent duplicates
      const existingUnits = await db.collection('crm_units').find(
        { projectId: prjId, companyId },
        { projection: { unitCode: 1 } }
      ).toArray();
      const existingCodeSet = new Set(existingUnits.map((u: any) => u.unitCode));

      for (let f = startF; f < startF + numFloors; f++) {
        for (let u = 1; u <= numUnitsPerF; u++) {
          const unitNumber = `${f < 10 ? '0' : ''}${f}0${u}`;
          const unitCode = `${blockPrefix}-${unitNumber}`.toUpperCase();

          if (existingCodeSet.has(unitCode)) continue; // skip already existing

          const config = configList[(u - 1) % configList.length] || '2BHK';
          const uFacing = u % 2 === 0 ? 'East Garden View' : 'West Skyline View';

          unitsToInsert.push({
            companyId,
            projectId: prjId,
            projectName: project.name,
            blockId: blockResult.insertedId,
            buildingTower: cleanBlockName,
            sectionName: cleanBlockName,
            floorNumber: f,
            unitNumber,
            unitCode,
            configuration: config,
            propertyType: 'Apartment',
            carpetAreaSqFt: Number(carpetAreaSqFt) || 950,
            saleableAreaSqFt: Number(saleableAreaSqFt) || Number(carpetAreaSqFt) || 1250,
            basePrice: Number(basePrice) || 6500000,
            askingPrice: Number(askingPrice) || Number(basePrice) || 7200000,
            availabilityStatus: 'Available',
            heldUntil: null,
            heldByCustomerId: null,
            activeBookingId: null,
            facing: facing || uFacing,
            notes,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      if (unitsToInsert.length > 0) {
        await db.collection('crm_units').insertMany(unitsToInsert);
      }

      res.status(201).json({
        success: true,
        message: `Block ${cleanBlockName} created with ${unitsToInsert.length} units.`,
        block: { _id: blockResult.insertedId, ...blockDoc },
        createdUnitsCount: unitsToInsert.length,
        units: unitsToInsert
      });
    } catch (err: any) {
      console.error('Error creating block and units:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/crm/units/:id/block - Put unit on Management Hold / Blocked status
  router.post(
    '/units/:id/block',
    authMiddleware,
    requireCrmRole('admin', 'sales_manager'),
    crmRateLimiter({ max: 30 }),
    async (req: any, res) => {
      try {
        const db = getDb();
        const companyId = await resolveCompanyId(req, db);
        const { reason = 'Management Hold', notes = '' } = req.body;

        const blockResult = await blockUnitSafely(db, companyId, req.params.id, reason || notes);
        if (!blockResult.success) {
          return res.status(409).json({ message: blockResult.message, conflict: true });
        }

        if (logAudit) {
          await logAudit(db, {
            actorId: req.user?.sub,
            actorType: 'user',
            companyId,
            module: 'crm',
            action: 'UNIT_BLOCKED',
            resource: 'crm_units',
            resourceId: String(req.params.id),
            description: `Blocked unit ${blockResult.unit?.unitCode}: ${reason}`,
            newValue: { reason }
          });
        }

        res.json(blockResult);
      } catch (err: any) {
        console.error('Error blocking unit:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // POST /api/crm/units/:id/unblock - Release unit from Blocked back to Available
  router.post(
    '/units/:id/unblock',
    authMiddleware,
    requireCrmRole('admin', 'sales_manager'),
    crmRateLimiter({ max: 30 }),
    async (req: any, res) => {
      try {
        const db = getDb();
        const companyId = await resolveCompanyId(req, db);

        const unblockResult = await unblockUnitSafely(db, companyId, req.params.id);
        if (!unblockResult.success) {
          return res.status(409).json({ message: unblockResult.message, conflict: true });
        }

        if (logAudit) {
          await logAudit(db, {
            actorId: req.user?.sub,
            actorType: 'user',
            companyId,
            module: 'crm',
            action: 'UNIT_UNBLOCKED',
            resource: 'crm_units',
            resourceId: String(req.params.id),
            description: `Unblocked unit ${unblockResult.unit?.unitCode}`
          });
        }

        res.json(unblockResult);
      } catch (err: any) {
        console.error('Error unblocking unit:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  return router;
}
