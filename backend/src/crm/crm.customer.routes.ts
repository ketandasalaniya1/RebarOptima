import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { checkDuplicateCustomer, generateBusinessReference } from './crm.reservation.service';
import { calculateBookingFinancials } from './crm.calculation.service';

export function createCrmCustomerRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
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

  // 1. GET /api/crm/customers - List customers with summary counts
  router.get('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { search, salespersonId, leadSource, limit = 100, page = 1 } = req.query;

      const query: any = { companyId };
      if (salespersonId) {
        query.assignedSalespersonId = salespersonId;
      }
      if (leadSource) {
        query.leadSource = leadSource;
      }

      let customers = await db.collection('crm_customers').find(query).sort({ createdAt: -1 }).toArray();

      if (search) {
        const term = String(search).toLowerCase().trim();
        customers = customers.filter((c: any) => 
          (c.fullName && c.fullName.toLowerCase().includes(term)) ||
          (c.phone && c.phone.includes(term)) ||
          (c.email && c.email.toLowerCase().includes(term)) ||
          (c.customerCode && c.customerCode.toLowerCase().includes(term))
        );
      }

      // Populate summary counts (unit interests, bookings, financials)
      const customerIds = customers.map((c: any) => c._id);
      
      const allInterests = await db.collection('crm_unit_interests').find({
        companyId,
        customerId: { $in: customerIds }
      }).toArray();

      const allBookings = await db.collection('crm_bookings').find({
        companyId,
        customerId: { $in: customerIds }
      }).toArray();

      const allTasks = await db.collection('crm_follow_ups').find({
        companyId,
        customerId: { $in: customerIds },
        status: { $ne: 'Completed' }
      }).sort({ dueDateTime: 1 }).toArray();

      const enriched = customers.map((cust: any) => {
        const custIdStr = String(cust._id);
        const myInterests = allInterests.filter((i: any) => String(i.customerId) === custIdStr);
        const myBookings = allBookings.filter((b: any) => String(b.customerId) === custIdStr);
        const myTasks = allTasks.filter((t: any) => String(t.customerId) === custIdStr);

        const totalBookingValue = myBookings.reduce((sum: number, b: any) => sum + (Number(b.netBookingValue) || 0), 0);

        return {
          ...cust,
          activeInterestsCount: myInterests.filter((i: any) => !['Lost', 'Booked'].includes(i.stage)).length,
          totalInterestsCount: myInterests.length,
          bookingsCount: myBookings.length,
          totalBookingValue,
          nextFollowUp: myTasks[0] ? myTasks[0].dueDateTime : null,
          recentStage: myInterests[0] ? myInterests[0].stage : 'New'
        };
      });

      res.json({
        total: enriched.length,
        page: Number(page),
        limit: Number(limit),
        data: enriched
      });
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 2. POST /api/crm/customers/check-duplicate - Check duplicate before creation
  router.post('/check-duplicate', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { phone, email, excludeCustomerId } = req.body;

      const dupResult = await checkDuplicateCustomer(db, companyId, phone, email, excludeCustomerId);
      res.json(dupResult);
    } catch (err: any) {
      console.error('Error in duplicate check:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 3. POST /api/crm/customers - Create new master customer profile
  router.post('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        fullName,
        phone,
        altPhone,
        email,
        address,
        city,
        preferredContactMethod = 'Phone',
        leadSource = 'Website',
        campaign,
        budgetMin,
        budgetMax,
        preferredLocation,
        preferredPropertyType,
        assignedSalespersonId,
        assignedSalespersonName,
        notes,
        communicationConsent = true,
        initialInterest // Optional initial unit/project interest
      } = req.body;

      if (!fullName || !phone) {
        return res.status(400).json({ message: 'Customer full name and primary phone number are required.' });
      }

      // Check duplicates
      const dup = await checkDuplicateCustomer(db, companyId, phone, email);
      if (dup.isDuplicate && !req.body.forceCreate) {
        return res.status(409).json({
          message: dup.reason,
          isDuplicate: true,
          matches: dup.matches
        });
      }

      const customerCode = await generateBusinessReference(db, companyId, 'crm_customers', 'CUST', 'customerCode');

      const newCustomer: any = {
        companyId,
        customerCode,
        fullName: fullName.trim(),
        phone: phone.trim(),
        altPhone: altPhone ? altPhone.trim() : '',
        email: email ? email.trim().toLowerCase() : '',
        address: address || '',
        city: city || '',
        preferredContactMethod,
        leadSource,
        campaign: campaign || '',
        budgetMin: Number(budgetMin) || 0,
        budgetMax: Number(budgetMax) || 0,
        preferredLocation: preferredLocation || '',
        preferredPropertyType: preferredPropertyType || '2BHK',
        assignedSalespersonId: assignedSalespersonId || req.user?.sub,
        assignedSalespersonName: assignedSalespersonName || req.user?.name || 'Sales Team',
        notes: notes || '',
        communicationConsent: !!communicationConsent,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: req.user?.sub || 'system'
      };

      const result = await db.collection('crm_customers').insertOne(newCustomer);
      const createdId = result.insertedId;

      // Log activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: createdId,
        activityType: 'Note',
        title: 'Customer Profile Created',
        description: `Customer ${fullName} (${customerCode}) registered via ${leadSource}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      // If initial project/unit interest was provided in registration modal
      if (initialInterest && initialInterest.projectId) {
        const prjId = ObjectId.isValid(initialInterest.projectId) ? new ObjectId(initialInterest.projectId) : initialInterest.projectId;
        const project = await db.collection('crm_projects').findOne({ _id: prjId });
        let unitDoc: any = null;
        if (initialInterest.unitId) {
          const uId = ObjectId.isValid(initialInterest.unitId) ? new ObjectId(initialInterest.unitId) : initialInterest.unitId;
          unitDoc = await db.collection('crm_units').findOne({ _id: uId });
        }

        const newInterest: any = {
          companyId,
          customerId: createdId,
          customerName: fullName,
          customerPhone: phone,
          projectId: prjId,
          projectName: project?.name || initialInterest.projectName || 'Default Project',
          unitId: unitDoc ? unitDoc._id : null,
          unitCode: unitDoc ? unitDoc.unitCode : initialInterest.unitCode || '',
          stage: initialInterest.stage || 'New',
          assignedSalespersonId: assignedSalespersonId || req.user?.sub,
          assignedSalespersonName: assignedSalespersonName || req.user?.name || 'Sales Team',
          leadSource: initialInterest.leadSource || leadSource,
          budget: Number(initialInterest.budget) || Number(budgetMax) || 0,
          expectedDecisionDate: initialInterest.expectedDecisionDate || '',
          priority: initialInterest.priority || 'Medium',
          lastContactDate: new Date(),
          nextFollowUpDate: initialInterest.nextFollowUpDate || '',
          notes: initialInterest.notes || 'Initial enquiry',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const intResult = await db.collection('crm_unit_interests').insertOne(newInterest);
        newCustomer.initialInterestId = intResult.insertedId;
      }

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: 'user',
          companyId,
          module: 'crm',
          action: 'CUSTOMER_CREATED',
          resource: 'crm_customers',
          resourceId: String(createdId),
          description: `Created customer ${fullName} (${customerCode})`,
          newValue: newCustomer
        });
      }

      res.status(201).json({ _id: createdId, ...newCustomer });
    } catch (err: any) {
      console.error('Error creating customer:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 4. GET /api/crm/customers/:id - Customer 360 Full Profile
  router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const custId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const customer = await db.collection('crm_customers').findOne({
        _id: custId,
        companyId
      });

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found.' });
      }

      // Fetch all customer-related records
      const [interests, activities, visits, followUps, bookings, transactions] = await Promise.all([
        db.collection('crm_unit_interests').find({ customerId: custId, companyId }).sort({ createdAt: -1 }).toArray(),
        db.collection('crm_activities').find({ customerId: custId, companyId }).sort({ createdAt: -1 }).toArray(),
        db.collection('crm_site_visits').find({ customerId: custId, companyId }).sort({ visitDateTime: -1 }).toArray(),
        db.collection('crm_follow_ups').find({ customerId: custId, companyId }).sort({ dueDateTime: 1 }).toArray(),
        db.collection('crm_bookings').find({ customerId: custId, companyId }).sort({ createdAt: -1 }).toArray(),
        db.collection('crm_payment_transactions').find({ customerId: custId, companyId }).sort({ paymentDate: -1 }).toArray()
      ]);

      // Enrich bookings with financials
      const enrichedBookings = await Promise.all(
        bookings.map(async (b: any) => {
          const schedules = await db.collection('crm_payment_schedules').find({ bookingId: b._id, companyId }).toArray();
          const txns = transactions.filter((t: any) => String(t.bookingId) === String(b._id));
          const financials = calculateBookingFinancials(b, schedules, txns);
          return {
            ...b,
            financials,
            schedules
          };
        })
      );

      const totalBookingValue = enrichedBookings.reduce((sum, b) => sum + (b.financials?.netBookingValue || 0), 0);
      const totalCollected = enrichedBookings.reduce((sum, b) => sum + (b.financials?.totalReceived || 0), 0);
      const totalOutstanding = enrichedBookings.reduce((sum, b) => sum + (b.financials?.totalOutstanding || 0), 0);

      res.json({
        customer,
        summary: {
          activeInterestsCount: interests.filter((i: any) => !['Lost', 'Booked'].includes(i.stage)).length,
          totalInterestsCount: interests.length,
          bookingsCount: bookings.length,
          totalBookingValue,
          totalCollected,
          totalOutstanding,
          pendingVisitsCount: visits.filter((v: any) => ['Scheduled', 'Confirmed'].includes(v.status)).length,
          pendingFollowUpsCount: followUps.filter((f: any) => f.status === 'Pending').length
        },
        interests,
        activities,
        siteVisits: visits,
        followUps,
        bookings: enrichedBookings,
        transactions
      });
    } catch (err: any) {
      console.error('Error fetching customer 360:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 5. PUT /api/crm/customers/:id - Update customer profile
  router.put('/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const custId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const existing = await db.collection('crm_customers').findOne({ _id: custId, companyId });
      if (!existing) return res.status(404).json({ message: 'Customer not found.' });

      const allowedFields = [
        'fullName', 'phone', 'altPhone', 'email', 'address', 'city',
        'preferredContactMethod', 'leadSource', 'campaign', 'budgetMin', 'budgetMax',
        'preferredLocation', 'preferredPropertyType', 'assignedSalespersonId',
        'assignedSalespersonName', 'notes', 'communicationConsent'
      ];

      const updateData: any = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      await db.collection('crm_customers').updateOne(
        { _id: custId, companyId },
        { $set: updateData }
      );

      const updated = await db.collection('crm_customers').findOne({ _id: custId });

      res.json(updated);
    } catch (err: any) {
      console.error('Error updating customer:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 6. POST /api/crm/customers/:id/interests - Link another unit/project interest to customer
  router.post('/:id/interests', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const custId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const customer = await db.collection('crm_customers').findOne({ _id: custId, companyId });
      if (!customer) return res.status(404).json({ message: 'Customer not found.' });

      const {
        projectId,
        unitId,
        stage = 'New',
        assignedSalespersonId,
        assignedSalespersonName,
        leadSource,
        budget,
        expectedDecisionDate,
        priority = 'Medium',
        nextFollowUpDate,
        notes
      } = req.body;

      if (!projectId) {
        return res.status(400).json({ message: 'Project reference is required for a unit interest.' });
      }

      const prjId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      const project = await db.collection('crm_projects').findOne({ _id: prjId, companyId });

      let unitDoc: any = null;
      if (unitId) {
        const uId = ObjectId.isValid(unitId) ? new ObjectId(unitId) : unitId;
        unitDoc = await db.collection('crm_units').findOne({ _id: uId, companyId });
      }

      const newInterest: any = {
        companyId,
        customerId: custId,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        projectId: prjId,
        projectName: project?.name || 'Selected Project',
        unitId: unitDoc ? unitDoc._id : null,
        unitCode: unitDoc ? unitDoc.unitCode : '',
        stage,
        assignedSalespersonId: assignedSalespersonId || customer.assignedSalespersonId,
        assignedSalespersonName: assignedSalespersonName || customer.assignedSalespersonName,
        leadSource: leadSource || customer.leadSource || 'Direct',
        budget: Number(budget) || customer.budgetMax || 0,
        expectedDecisionDate: expectedDecisionDate || '',
        priority,
        lastContactDate: new Date(),
        nextFollowUpDate: nextFollowUpDate || '',
        notes: notes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('crm_unit_interests').insertOne(newInterest);

      // Record activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: custId,
        unitInterestId: result.insertedId,
        unitCode: unitDoc ? unitDoc.unitCode : '',
        activityType: 'Note',
        title: 'New Property Interest Added',
        description: `Enquiry logged for ${project?.name || 'Project'} ${unitDoc ? `— Unit ${unitDoc.unitCode}` : ''} at stage '${stage}'.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      res.status(201).json({ _id: result.insertedId, ...newInterest });
    } catch (err: any) {
      console.error('Error adding unit interest:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 7. POST /api/crm/customers/:id/activities - Record note, call, email, or meeting on customer timeline
  router.post('/:id/activities', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const custId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { activityType = 'Note', title, description } = req.body;

      if (!description && !title) {
        return res.status(400).json({ message: 'Note or activity description is required.' });
      }

      const actDoc = {
        companyId,
        customerId: custId,
        activityType,
        title: title || `${activityType} logged`,
        description: description || title,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      };

      const result = await db.collection('crm_activities').insertOne(actDoc);
      await db.collection('crm_customers').updateOne(
        { _id: custId, companyId },
        { $set: { lastContactDate: new Date() } }
      );

      res.status(201).json({ _id: result.insertedId, ...actDoc });
    } catch (err: any) {
      console.error('Error adding customer activity:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
