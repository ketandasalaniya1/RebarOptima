import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { reserveUnitSafely, releaseUnitSafely, evaluateUnitAvailability, generateBusinessReference } from './crm.reservation.service';
import { calculateBookingFinancials } from './crm.calculation.service';

export function createCrmProjectUnitRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
  const router = Router();

  const resolveCompanyId = async (req: any, db: any): Promise<ObjectId | string> => {
    if (req.user?.companyId) {
      return ObjectId.isValid(req.user.companyId) ? new ObjectId(req.user.companyId) : req.user.companyId;
    }
    const userId = req.user?.sub;
    if (userId) {
      try {
        const u = await db.collection('users').findOne({
          $or: [{ _id: ObjectId.isValid(userId) ? new ObjectId(userId) : userId }, { _id: userId }]
        });
        if (u && u.companyId) {
          return ObjectId.isValid(u.companyId) ? new ObjectId(u.companyId) : u.companyId;
        }
      } catch {}
    }
    return 'default-company';
  };

  // ── PROJECTS ─────────────────────────────────────────────────────────────

  // GET /api/crm/projects - List all projects with unit availability summary
  router.get('/projects', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const projects = await db.collection('crm_projects').find({ companyId }).sort({ createdAt: -1 }).toArray();
      const allUnits = await db.collection('crm_units').find({ companyId }).toArray();
      const allInterests = await db.collection('crm_unit_interests').find({ companyId }).toArray();

      const enriched = projects.map((p: any) => {
        const pIdStr = String(p._id);
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

  // POST /api/crm/projects - Create project
  router.post('/projects', authMiddleware, async (req: any, res) => {
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

      const project = await db.collection('crm_projects').findOne({ _id: pId, companyId });
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
      const { projectId, status, tower, configuration, minFloor, maxFloor, search } = req.query;

      const query: any = { companyId };
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
      const uId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const unit = await db.collection('crm_units').findOne({ _id: uId, companyId });
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
        floorNumber,
        unitNumber,
        configuration = '2BHK',
        propertyType = 'Apartment',
        carpetAreaSqFt,
        saleableAreaSqFt,
        basePrice,
        askingPrice,
        facing = 'East',
        notes
      } = req.body;

      if (!projectId || !buildingTower || floorNumber === undefined || !unitNumber) {
        return res.status(400).json({ message: 'Project, tower, floor, and unit number are required.' });
      }

      const prjId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      const project = await db.collection('crm_projects').findOne({ _id: prjId, companyId });
      if (!project) return res.status(404).json({ message: 'Parent project not found.' });

      const unitCode = `${buildingTower}-${unitNumber}`.toUpperCase();

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

      const newUnit: any = {
        companyId,
        projectId: prjId,
        projectName: project.name,
        unitCode,
        buildingTower: String(buildingTower).trim().toUpperCase(),
        floorNumber: Number(floorNumber),
        unitNumber: String(unitNumber).trim(),
        configuration,
        propertyType,
        carpetAreaSqFt: Number(carpetAreaSqFt) || 0,
        saleableAreaSqFt: Number(saleableAreaSqFt) || Number(carpetAreaSqFt) || 0,
        basePrice: calculatedBasePrice,
        askingPrice: calculatedAskingPrice,
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
  router.post('/units/:id/reserve', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { customerId, durationHours = 48 } = req.body;

      if (!customerId) return res.status(400).json({ message: 'Customer ID is required to reserve a unit.' });

      const reservationResult = await reserveUnitSafely(
        db,
        companyId,
        req.params.id,
        customerId,
        Number(durationHours)
      );

      if (!reservationResult.success) {
        return res.status(409).json({ message: reservationResult.message });
      }

      res.json(reservationResult);
    } catch (err: any) {
      console.error('Error reserving unit:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/crm/units/:id/release - Safe unit release back to Available
  router.post('/units/:id/release', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const releaseResult = await releaseUnitSafely(db, companyId, req.params.id);
      if (!releaseResult.success) {
        return res.status(400).json({ message: releaseResult.message });
      }

      res.json(releaseResult);
    } catch (err: any) {
      console.error('Error releasing unit:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // PUT /api/crm/units/:id - Update unit details or block/unblock status
  router.put('/units/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const uId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const allowedFields = [
        'askingPrice', 'basePrice', 'carpetAreaSqFt', 'saleableAreaSqFt',
        'configuration', 'facing', 'notes', 'availabilityStatus'
      ];

      const updateData: any = { updatedAt: new Date() };
      for (const f of allowedFields) {
        if (req.body[f] !== undefined) updateData[f] = req.body[f];
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

  return router;
}
