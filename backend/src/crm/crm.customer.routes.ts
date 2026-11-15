import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { checkDuplicateCustomer, normalizePhone } from './crm.reservation.service';
import { calculateBookingFinancials, rupeesToPaise, paiseToRupees } from './crm.calculation.service';
import { getNextSequence } from './crm.sequence.service';
import { encryptSensitiveField, decryptSensitiveField, maskPan, maskAadhaar, requireCrmRole } from './crm.security.service';
import { validateBody, createCustomerSchema, updateCustomerSchema, parsePagination, crmRateLimiter } from './crm.validation';

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

  // 1. GET /api/crm/customers - List customers with summary counts & pagination
  router.get('/', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep', 'accountant'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { search, salespersonId, leadSource } = req.query;
      const { page, limit, skip } = parsePagination(req.query);

      const query: any = { companyId };
      if (salespersonId) {
        query.assignedSalespersonId = salespersonId;
      }
      if (leadSource) {
        query.leadSource = leadSource;
      }

      // sales_rep can only view customers assigned to them
      if (req.crmRole === 'sales_rep' && req.user?.sub) {
        query.assignedSalespersonId = req.user.sub;
      }

      let customers = await db.collection('crm_customers').find(query).sort({ createdAt: -1 }).toArray();

      if (search) {
        const term = String(search).toLowerCase().trim();
        customers = customers.filter((c: any) => 
          (c.fullName && c.fullName.toLowerCase().includes(term)) ||
          (c.phone && c.phone.includes(term)) ||
          (c.phoneNormalized && c.phoneNormalized.includes(term)) ||
          (c.email && c.email.toLowerCase().includes(term)) ||
          (c.customerCode && c.customerCode.toLowerCase().includes(term))
        );
      }

      const total = customers.length;
      const paginatedCustomers = customers.slice(skip, skip + limit);

      // Populate summary counts (unit interests, bookings, tasks)
      const customerIds = paginatedCustomers.map((c: any) => c._id);
      
      const [allInterests, allBookings, allTasks] = await Promise.all([
        db.collection('crm_unit_interests').find({ companyId, customerId: { $in: customerIds } }).toArray(),
        db.collection('crm_bookings').find({ companyId, customerId: { $in: customerIds } }).toArray(),
        db.collection('crm_follow_ups').find({ companyId, customerId: { $in: customerIds }, status: { $ne: 'Completed' } }).sort({ dueDateTime: 1 }).toArray()
      ]);

      const enriched = paginatedCustomers.map((cust: any) => {
        const custIdStr = String(cust._id);
        const myInterests = allInterests.filter((i: any) => String(i.customerId) === custIdStr);
        const myBookings = allBookings.filter((b: any) => String(b.customerId) === custIdStr);
        const myTasks = allTasks.filter((t: any) => String(t.customerId) === custIdStr);

        const totalBookingValue = myBookings.reduce((sum: number, b: any) => sum + (Number(b.netBookingValue) || 0), 0);

        // Never expose raw encrypted secrets in list
        const { encryptedPan, encryptedAadhaar, ...safeCust } = cust;

        return {
          ...safeCust,
          maskedPan: cust.maskedPan || maskPan(cust.panNumber),
          maskedAadhaar: cust.aadhaarLast4 ? `•••• •••• ${cust.aadhaarLast4}` : maskAadhaar(cust.aadhaarNumber).masked,
          activeInterestsCount: myInterests.filter((i: any) => !['Lost', 'Booked'].includes(i.stage)).length,
          totalInterestsCount: myInterests.length,
          bookingsCount: myBookings.length,
          totalBookingValue,
          nextFollowUp: myTasks[0] ? myTasks[0].dueDateTime : null,
          recentStage: myInterests[0] ? myInterests[0].stage : 'New'
        };
      });

      res.json({
        data: enriched,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 2. POST /api/crm/customers/check-duplicate - Live debounce collision check
  router.post('/check-duplicate', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { phone, email, excludeCustomerId } = req.body;

      if (!phone && !email) {
        return res.json({ isDuplicate: false, matches: [] });
      }

      const dup = await checkDuplicateCustomer(db, companyId, phone, email, excludeCustomerId);
      res.json(dup);
    } catch (err: any) {
      console.error('Error checking customer duplicate:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 3. GET /api/crm/customers/:id - Customer 360 Full Dossier
  router.get('/:id', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep', 'accountant'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const cId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const customer = await db.collection('crm_customers').findOne({ _id: cId, companyId });
      if (!customer) return res.status(404).json({ message: 'Customer not found.' });

      // sales_rep ownership check
      if (req.crmRole === 'sales_rep' && req.user?.sub && String(customer.assignedSalespersonId) !== String(req.user.sub)) {
        return res.status(403).json({ message: 'Access denied. You can only view your assigned customers.' });
      }

      const [interests, bookings, activities, visits, tasks] = await Promise.all([
        db.collection('crm_unit_interests').find({ customerId: cId, companyId }).sort({ createdAt: -1 }).toArray(),
        db.collection('crm_bookings').find({ customerId: cId, companyId }).sort({ createdAt: -1 }).toArray(),
        db.collection('crm_activities').find({ customerId: cId, companyId }).sort({ createdAt: -1 }).limit(100).toArray(),
        db.collection('crm_site_visits').find({ customerId: cId, companyId }).sort({ visitDateTime: -1 }).toArray(),
        db.collection('crm_follow_ups').find({ customerId: cId, companyId }).sort({ dueDateTime: 1 }).toArray()
      ]);

      // Enrich bookings with financials
      const bookingIds = bookings.map((b: any) => b._id);
      const [allSchedules, allTxns] = await Promise.all([
        db.collection('crm_payment_schedules').find({ bookingId: { $in: bookingIds } }).toArray(),
        db.collection('crm_payment_transactions').find({ bookingId: { $in: bookingIds } }).toArray()
      ]);

      const enrichedBookings = bookings.map((b: any) => {
        const bIdStr = String(b._id);
        const scheds = allSchedules.filter((s: any) => String(s.bookingId) === bIdStr);
        const txs = allTxns.filter((t: any) => String(t.bookingId) === bIdStr);
        return {
          ...b,
          financials: calculateBookingFinancials(b, scheds, txs)
        };
      });

      const { encryptedPan, encryptedAadhaar, ...safeCustomer } = customer;

      res.json({
        customer: {
          ...safeCustomer,
          maskedPan: customer.maskedPan || maskPan(customer.panNumber),
          maskedAadhaar: customer.aadhaarLast4 ? `•••• •••• ${customer.aadhaarLast4}` : maskAadhaar(customer.aadhaarNumber).masked
        },
        interests,
        bookings: enrichedBookings,
        activities,
        siteVisits: visits,
        tasks
      });
    } catch (err: any) {
      console.error('Error fetching Customer 360:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 4. GET /api/crm/customers/:id/sensitive-fields - Permission-gated PAN/Aadhaar reveal with audit trail
  router.get('/:id/sensitive-fields', authMiddleware, requireCrmRole('admin', 'sales_manager'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const cId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const customer = await db.collection('crm_customers').findOne({ _id: cId, companyId });
      if (!customer) return res.status(404).json({ message: 'Customer not found.' });

      const revealedPan = customer.encryptedPan ? decryptSensitiveField(customer.encryptedPan) : customer.panNumber || '';
      const revealedAadhaar = customer.encryptedAadhaar ? decryptSensitiveField(customer.encryptedAadhaar) : customer.aadhaarNumber || '';

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: 'user',
          companyId,
          module: 'crm',
          action: 'SENSITIVE_DATA_REVEAL',
          resource: 'crm_customers',
          resourceId: String(cId),
          description: `User revealed sensitive identity fields for customer ${customer.customerCode} (${customer.fullName})`
        });
      }

      res.json({
        customerId: cId,
        customerCode: customer.customerCode,
        panNumber: revealedPan,
        aadhaarNumber: revealedAadhaar
      });
    } catch (err: any) {
      console.error('Error revealing sensitive customer fields:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 5. POST /api/crm/customers - Register new customer profile with duplicate guard & encryption
  router.post(
    '/',
    authMiddleware,
    requireCrmRole('admin', 'sales_manager', 'sales_rep'),
    crmRateLimiter({ max: 30 }),
    validateBody(createCustomerSchema),
    async (req: any, res) => {
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
          preferredContactMethod,
          leadSource,
          campaign,
          budgetMin = 0,
          budgetMax = 0,
          preferredLocation,
          preferredPropertyType,
          assignedSalespersonId,
          assignedSalespersonName,
          notes,
          communicationConsent = true,
          panNumber,
          aadhaarNumber,
          initialInterest,
          forceCreate = false
        } = req.body;

        const phoneNormalized = normalizePhone(phone);
        const altPhoneNormalized = altPhone ? normalizePhone(altPhone) : '';

        // Duplicate Collision Check
        const dup = await checkDuplicateCustomer(db, companyId, phone, email);
        if (dup.isDuplicate && !forceCreate) {
          return res.status(409).json({
            message: dup.reason,
            isDuplicate: true,
            existingCustomerSummary: dup.existingCustomerSummary,
            matches: dup.matches
          });
        }

        // Atomic sequential customer code
        const customerCode = await getNextSequence(db, companyId, 'customerCode');

        // Sensitive field encryption
        const encryptedPan = panNumber ? encryptSensitiveField(panNumber) : null;
        const maskedPanValue = panNumber ? maskPan(panNumber) : '';

        const aadhaarInfo = aadhaarNumber ? maskAadhaar(aadhaarNumber) : { masked: '', last4: '' };
        const encryptedAadhaar = aadhaarNumber ? encryptSensitiveField(aadhaarNumber) : null;

        const newCustomer: any = {
          companyId,
          customerCode,
          fullName: fullName.trim(),
          phone: phone.trim(),
          phoneNormalized,
          altPhone: altPhone ? altPhone.trim() : '',
          altPhoneNormalized,
          email: email ? email.trim().toLowerCase() : '',
          address: address || '',
          city: city || '',
          preferredContactMethod: preferredContactMethod || 'Phone',
          leadSource: leadSource || 'Direct Walk-in',
          campaign: campaign || '',
          budgetMin: Number(budgetMin) || 0,
          budgetMinPaise: rupeesToPaise(budgetMin),
          budgetMax: Number(budgetMax) || 0,
          budgetMaxPaise: rupeesToPaise(budgetMax),
          preferredLocation: preferredLocation || '',
          preferredPropertyType: preferredPropertyType || '2BHK',
          assignedSalespersonId: assignedSalespersonId || req.user?.sub,
          assignedSalespersonName: assignedSalespersonName || req.user?.name || 'Sales Team',
          notes: notes || '',
          communicationConsent: !!communicationConsent,
          encryptedPan,
          maskedPan: maskedPanValue,
          encryptedAadhaar,
          aadhaarLast4: aadhaarInfo.last4,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: req.user?.sub || 'system'
        };

        const result = await db.collection('crm_customers').insertOne(newCustomer);
        const createdId = result.insertedId;

        // Log initial activity
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

        // If initial interest specified, link it automatically
        if (initialInterest?.projectId) {
          const prjId = ObjectId.isValid(initialInterest.projectId) ? new ObjectId(initialInterest.projectId) : initialInterest.projectId;
          const project = await db.collection('projects').findOne({ _id: prjId }) || await db.collection('crm_projects').findOne({ _id: prjId });
          const prjName = project?.name || 'Property Project';

          await db.collection('crm_unit_interests').insertOne({
            companyId,
            customerId: createdId,
            customerName: fullName.trim(),
            customerPhone: phone.trim(),
            projectId: prjId,
            projectName: prjName,
            unitId: initialInterest.unitId ? (ObjectId.isValid(initialInterest.unitId) ? new ObjectId(initialInterest.unitId) : initialInterest.unitId) : null,
            unitCode: initialInterest.unitCode || '',
            stage: 'New',
            assignedSalespersonId: newCustomer.assignedSalespersonId,
            assignedSalespersonName: newCustomer.assignedSalespersonName,
            leadSource,
            budget: Number(initialInterest.budget || budgetMax || 0),
            budgetPaise: rupeesToPaise(initialInterest.budget || budgetMax || 0),
            priority: 'Medium',
            createdAt: new Date(),
            updatedAt: new Date()
          });
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
            description: `Created customer ${customerCode} (${fullName})`
          });
        }

        const { encryptedPan: ep, encryptedAadhaar: ea, ...safeCreated } = newCustomer;
        res.status(201).json({ _id: createdId, ...safeCreated });
      } catch (err: any) {
        console.error('Error creating customer:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // 6. PUT /api/crm/customers/:id - Update customer profile
  router.put(
    '/:id',
    authMiddleware,
    requireCrmRole('admin', 'sales_manager', 'sales_rep'),
    validateBody(updateCustomerSchema),
    async (req: any, res) => {
      try {
        const db = getDb();
        const companyId = await resolveCompanyId(req, db);
        const cId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

        const customer = await db.collection('crm_customers').findOne({ _id: cId, companyId });
        if (!customer) return res.status(404).json({ message: 'Customer not found.' });

        const prevCustomer = { ...customer };
        const updates: any = { updatedAt: new Date() };

        const allowedFields = [
          'fullName', 'phone', 'altPhone', 'email', 'address', 'city',
          'preferredContactMethod', 'leadSource', 'budgetMin', 'budgetMax',
          'preferredLocation', 'preferredPropertyType', 'assignedSalespersonId',
          'assignedSalespersonName', 'notes'
        ];

        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
          }
        }

        if (req.body.phone) {
          updates.phoneNormalized = normalizePhone(req.body.phone);
        }
        if (req.body.altPhone) {
          updates.altPhoneNormalized = normalizePhone(req.body.altPhone);
        }
        if (req.body.budgetMin !== undefined) {
          updates.budgetMinPaise = rupeesToPaise(req.body.budgetMin);
        }
        if (req.body.budgetMax !== undefined) {
          updates.budgetMaxPaise = rupeesToPaise(req.body.budgetMax);
        }

        // PAN encryption update
        if (req.body.panNumber) {
          updates.encryptedPan = encryptSensitiveField(req.body.panNumber);
          updates.maskedPan = maskPan(req.body.panNumber);
        }

        // Aadhaar encryption update
        if (req.body.aadhaarNumber) {
          const aInfo = maskAadhaar(req.body.aadhaarNumber);
          updates.encryptedAadhaar = encryptSensitiveField(req.body.aadhaarNumber);
          updates.aadhaarLast4 = aInfo.last4;
        }

        await db.collection('crm_customers').updateOne(
          { _id: cId, companyId },
          { $set: updates }
        );

        if (logAudit) {
          await logAudit(db, {
            actorId: req.user?.sub,
            actorType: 'user',
            companyId,
            module: 'crm',
            action: 'CUSTOMER_UPDATED',
            resource: 'crm_customers',
            resourceId: String(cId),
            description: `Updated customer profile ${customer.customerCode}`,
            before: { fullName: prevCustomer.fullName, phone: prevCustomer.phone },
            after: { fullName: updates.fullName || prevCustomer.fullName, phone: updates.phone || prevCustomer.phone }
          });
        }

        const updated = await db.collection('crm_customers').findOne({ _id: cId });
        const { encryptedPan, encryptedAadhaar, ...safeUpdated } = updated;
        res.json(safeUpdated);
      } catch (err: any) {
        console.error('Error updating customer:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // 7. POST /api/crm/customers/:id/interests - Link a property interest to customer
  router.post('/:id/interests', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const cId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const customer = await db.collection('crm_customers').findOne({ _id: cId, companyId });
      if (!customer) return res.status(404).json({ message: 'Customer not found.' });

      const {
        projectId,
        unitId,
        unitCode,
        stage = 'New',
        budget,
        priority = 'Medium',
        notes
      } = req.body;

      if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required.' });
      }

      const prjId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      const project = await db.collection('projects').findOne({ _id: prjId }) || await db.collection('crm_projects').findOne({ _id: prjId });
      const prjName = project?.name || 'Property Project';

      const budgetAmount = Number(budget || customer.budgetMax || 0);

      const newInterest: any = {
        companyId,
        customerId: cId,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        projectId: prjId,
        projectName: prjName,
        unitId: unitId ? (ObjectId.isValid(unitId) ? new ObjectId(unitId) : unitId) : null,
        unitCode: unitCode || '',
        stage,
        assignedSalespersonId: customer.assignedSalespersonId || req.user?.sub,
        assignedSalespersonName: customer.assignedSalespersonName || req.user?.name || 'Sales Team',
        leadSource: customer.leadSource,
        budget: budgetAmount,
        budgetPaise: rupeesToPaise(budgetAmount),
        priority,
        notes: notes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('crm_unit_interests').insertOne(newInterest);

      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: cId,
        unitInterestId: result.insertedId,
        unitCode: unitCode || '',
        activityType: 'Note',
        title: 'Property Interest Added',
        description: `Linked interest in ${prjName}${unitCode ? ` (Unit ${unitCode})` : ''} at Stage: ${stage}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      res.status(201).json({ _id: result.insertedId, ...newInterest });
    } catch (err: any) {
      console.error('Error adding customer interest:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 8. POST /api/crm/customers/:id/activities - Log activity / note / call / WhatsApp
  router.post('/:id/activities', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep', 'accountant'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const cId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const customer = await db.collection('crm_customers').findOne({ _id: cId, companyId });
      if (!customer) return res.status(404).json({ message: 'Customer not found.' });

      const {
        activityType = 'Note',
        title,
        description,
        unitInterestId,
        unitCode,
        metadata
      } = req.body;

      if (!title || !description) {
        return res.status(400).json({ message: 'Activity title and description are required.' });
      }

      const activity: any = {
        companyId,
        customerId: cId,
        unitInterestId: unitInterestId ? (ObjectId.isValid(unitInterestId) ? new ObjectId(unitInterestId) : unitInterestId) : null,
        unitCode: unitCode || '',
        activityType,
        title: title.trim(),
        description: description.trim(),
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        metadata: metadata || {},
        createdAt: new Date()
      };

      const result = await db.collection('crm_activities').insertOne(activity);
      res.status(201).json({ _id: result.insertedId, ...activity });
    } catch (err: any) {
      console.error('Error logging customer activity:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
