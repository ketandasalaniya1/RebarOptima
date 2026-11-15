import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { commitUnitBooking, releaseUnitSafely } from './crm.reservation.service';
import { roundCurrency, rupeesToPaise, paiseToRupees, generateInstallmentSchedule, calculateBookingFinancials } from './crm.calculation.service';
import { getNextSequence } from './crm.sequence.service';
import { requireCrmRole } from './crm.security.service';
import { validateBody, createBookingSchema, parsePagination, crmRateLimiter } from './crm.validation';

export function createCrmBookingRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
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

  // 1. GET /api/crm/bookings - List bookings with financial metrics & pagination
  router.get('/', authMiddleware, requireCrmRole('admin', 'sales_manager', 'accountant', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { status, projectId, customerId, search } = req.query;
      const { page, limit, skip } = parsePagination(req.query);

      const query: any = { companyId };
      if (status) query.status = status;
      if (projectId) query.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      if (customerId) query.customerId = ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId;

      // sales_rep can only view their own bookings
      if (req.crmRole === 'sales_rep' && req.user?.sub) {
        query.salespersonId = req.user.sub;
      }

      let bookings = await db.collection('crm_bookings').find(query).sort({ createdAt: -1 }).toArray();

      if (search) {
        const term = String(search).toLowerCase().trim();
        bookings = bookings.filter((b: any) =>
          (b.bookingReference && b.bookingReference.toLowerCase().includes(term)) ||
          (b.customerName && b.customerName.toLowerCase().includes(term)) ||
          (b.unitCode && b.unitCode.toLowerCase().includes(term)) ||
          (b.projectName && b.projectName.toLowerCase().includes(term))
        );
      }

      const total = bookings.length;
      const paginatedBookings = bookings.slice(skip, skip + limit);

      // Populate financial summaries
      const bookingIds = paginatedBookings.map((b: any) => b._id);
      const [allSchedules, allTxns] = await Promise.all([
        db.collection('crm_payment_schedules').find({ companyId, bookingId: { $in: bookingIds } }).toArray(),
        db.collection('crm_payment_transactions').find({ companyId, bookingId: { $in: bookingIds } }).toArray()
      ]);

      const enriched = paginatedBookings.map((b: any) => {
        const bIdStr = String(b._id);
        const schedules = allSchedules.filter((s: any) => String(s.bookingId) === bIdStr);
        const txns = allTxns.filter((t: any) => String(t.bookingId) === bIdStr);
        const financials = calculateBookingFinancials(b, schedules, txns);
        return {
          ...b,
          financials
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
      console.error('Error fetching bookings:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 2. POST /api/crm/bookings - Create and commit a new property booking
  router.post(
    '/',
    authMiddleware,
    requireCrmRole('admin', 'sales_manager', 'sales_rep'),
    crmRateLimiter({ max: 40 }),
    validateBody(createBookingSchema),
    async (req: any, res) => {
      try {
        const db = getDb();
        const companyId = await resolveCompanyId(req, db);
        const {
          customerId,
          projectId,
          unitId,
          unitInterestId,
          agreementPrice,
          discountAmount = 0,
          taxAmount = 0,
          bookingDepositRequired = 0,
          bookingDate,
          salespersonId,
          salespersonName,
          customSchedule,
          notes
        } = req.body;

        const cMatcher = ObjectId.isValid(String(companyId)) && String(companyId).length === 24
          ? { $in: [String(companyId), new ObjectId(String(companyId))] }
          : companyId;

        const custId = ObjectId.isValid(String(customerId)) && String(customerId).length === 24
          ? { $in: [new ObjectId(String(customerId)), String(customerId)] }
          : customerId;

        const uId = ObjectId.isValid(String(unitId)) && String(unitId).length === 24
          ? { $in: [new ObjectId(String(unitId)), String(unitId)] }
          : unitId;

        const prjId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;

        let [customer, unit] = await Promise.all([
          db.collection('crm_customers').findOne({ _id: custId, companyId: cMatcher }),
          db.collection('crm_units').findOne({ _id: uId, companyId: cMatcher })
        ]);

        if (!customer) {
          customer = await db.collection('crm_customers').findOne({ _id: custId });
        }
        if (!unit) {
          unit = await db.collection('crm_units').findOne({ _id: uId });
        }

        if (!customer) return res.status(404).json({ message: 'Customer record not found.' });
        if (!unit) return res.status(404).json({ message: 'Property unit not found.' });

        let project = (await db.collection('projects').findOne({ _id: prjId }))
          || (ObjectId.isValid(prjId) ? await db.collection('projects').findOne({ _id: new ObjectId(prjId) }) : null)
          || (await db.collection('crm_projects').findOne({ _id: prjId, companyId }))
          || (ObjectId.isValid(prjId) ? await db.collection('crm_projects').findOne({ _id: new ObjectId(prjId), companyId }) : null)
          || (unit?.projectName ? { name: unit.projectName, _id: prjId } : null);

        if (!project) return res.status(404).json({ message: 'Project record not found.' });

        // Integer paise money math
        const pricePaise = rupeesToPaise(agreementPrice);
        const discountPaise = rupeesToPaise(discountAmount || 0);
        const taxPaise = rupeesToPaise(taxAmount || 0);
        const netBookingValuePaise = pricePaise - discountPaise + taxPaise;
        const depositPaise = bookingDepositRequired
          ? rupeesToPaise(bookingDepositRequired)
          : Math.round(netBookingValuePaise * 0.1);

        const price = paiseToRupees(pricePaise);
        const discount = paiseToRupees(discountPaise);
        const tax = paiseToRupees(taxPaise);
        const netBookingValue = paiseToRupees(netBookingValuePaise);
        const deposit = paiseToRupees(depositPaise);

        // Atomic sequence counter
        const bookingReference = await getNextSequence(db, companyId, 'bookingReference');
        const bDate = bookingDate ? new Date(bookingDate) : new Date();

        // Atomic commit: reserve/book the unit with conditional findOneAndUpdate
        const commitRes = await commitUnitBooking(db, companyId, uId, null, customer._id);
        if (!commitRes.success) {
          return res.status(409).json({ message: commitRes.message, conflict: true });
        }

        const newBooking: any = {
          companyId,
          bookingReference,
          customerId: customer._id,
          customerName: customer.fullName,
          customerPhone: customer.phone,
          customerEmail: customer.email || '',
          projectId: prjId,
          projectName: project.name,
          unitId: unit._id,
          unitCode: unit.unitCode,
          unitInterestId: unitInterestId ? (ObjectId.isValid(unitInterestId) ? new ObjectId(unitInterestId) : unitInterestId) : null,
          agreementPrice: price,
          agreementPricePaise: pricePaise,
          discountAmount: discount,
          discountAmountPaise: discountPaise,
          taxAmount: tax,
          taxAmountPaise: taxPaise,
          netBookingValue,
          netBookingValuePaise,
          bookingDepositRequired: deposit,
          bookingDepositRequiredPaise: depositPaise,
          bookingDate: bDate,
          status: 'Reserved', // Default active status upon creation
          approvalStatus: discount > 0 ? 'Pending' : 'Approved',
          approvedBy: discount > 0 ? null : (req.user?.sub || 'system'),
          approvedAt: discount > 0 ? null : new Date(),
          salespersonId: salespersonId || customer.assignedSalespersonId || req.user?.sub,
          salespersonName: salespersonName || customer.assignedSalespersonName || req.user?.name || 'Sales Rep',
          notes: notes || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: req.user?.sub || 'system'
        };

        const insertResult = await db.collection('crm_bookings').insertOne(newBooking);
        const bookingId = insertResult.insertedId;

        // Update unit with activeBookingId
        await db.collection('crm_units').updateOne(
          { _id: unit._id },
          { $set: { activeBookingId: bookingId } }
        );

        // Generate Installment Schedule milestones with integer paise precision
        const milestones = customSchedule && customSchedule.length > 0
          ? customSchedule
          : generateInstallmentSchedule(netBookingValue, bDate);

        const scheduleDocs = milestones.map((m: any, idx: number) => {
          const dueAmtPaise = m.dueAmountPaise !== undefined ? m.dueAmountPaise : rupeesToPaise(m.dueAmount);
          return {
            companyId,
            bookingId,
            bookingReference,
            milestoneName: m.milestoneName,
            milestonePercentage: Number(m.milestonePercentage) || 0,
            dueAmount: paiseToRupees(dueAmtPaise),
            dueAmountPaise: dueAmtPaise,
            dueDate: m.dueDate || new Date().toISOString().split('T')[0],
            paidAmount: 0,
            paidAmountPaise: 0,
            status: 'Due',
            sortOrder: idx + 1,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        });

        if (scheduleDocs.length > 0) {
          await db.collection('crm_payment_schedules').insertMany(scheduleDocs);
        }

        // If tied to a specific unit interest, mark that interest as 'Booked'
        if (unitInterestId) {
          await db.collection('crm_unit_interests').updateOne(
            { _id: ObjectId.isValid(unitInterestId) ? new ObjectId(unitInterestId) : unitInterestId, companyId },
            { $set: { stage: 'Booked', bookingId, updatedAt: new Date() } }
          );
        }

        // Log activity
        await db.collection('crm_activities').insertOne({
          companyId,
          customerId: customer._id,
          unitInterestId: newBooking.unitInterestId,
          unitCode: unit.unitCode,
          activityType: 'Booking Action',
          title: `Booking Created: ${bookingReference}`,
          description: `Unit ${unit.unitCode} booked for ${customer.fullName} at Net Value ₹${netBookingValue.toLocaleString()}. Reference: ${bookingReference}.`,
          performedBy: req.user?.sub || 'system',
          performedByName: req.user?.name || 'Sales Team',
          createdAt: new Date()
        });

        if (logAudit) {
          await logAudit(db, {
            actorId: req.user?.sub,
            actorType: 'user',
            companyId,
            module: 'crm',
            action: 'BOOKING_CREATED',
            resource: 'crm_bookings',
            resourceId: String(bookingId),
            description: `Created booking ${bookingReference} for Unit ${unit.unitCode}`,
            newValue: newBooking
          });
        }

        res.status(201).json({ _id: bookingId, ...newBooking, schedules: scheduleDocs });
      } catch (err: any) {
        console.error('Error creating booking:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // 3. GET /api/crm/bookings/:id - Booking detail with schedules & transactions
  router.get('/:id', authMiddleware, requireCrmRole('admin', 'sales_manager', 'accountant', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const bId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const booking = await db.collection('crm_bookings').findOne({ _id: bId, companyId });
      if (!booking) return res.status(404).json({ message: 'Booking not found.' });

      // Ownership check for sales_rep
      if (req.crmRole === 'sales_rep' && req.user?.sub && String(booking.salespersonId) !== String(req.user.sub)) {
        return res.status(403).json({ message: 'Access denied. You can only inspect your assigned bookings.' });
      }

      const cMatcher = ObjectId.isValid(String(companyId)) && String(companyId).length === 24
        ? { $in: [String(companyId), new ObjectId(String(companyId))] }
        : companyId;
      const uIdMatcher = ObjectId.isValid(String(booking.unitId)) && String(booking.unitId).length === 24
        ? { $in: [new ObjectId(String(booking.unitId)), String(booking.unitId)] }
        : booking.unitId;
      const custIdMatcher = ObjectId.isValid(String(booking.customerId)) && String(booking.customerId).length === 24
        ? { $in: [new ObjectId(String(booking.customerId)), String(booking.customerId)] }
        : booking.customerId;

      const [customer, unit, schedules, txns] = await Promise.all([
        db.collection('crm_customers').findOne({ _id: custIdMatcher }),
        db.collection('crm_units').findOne({ _id: uIdMatcher }),
        db.collection('crm_payment_schedules').find({ bookingId: bId }).sort({ sortOrder: 1 }).toArray(),
        db.collection('crm_payment_transactions').find({ bookingId: bId }).sort({ paymentDate: -1 }).toArray()
      ]);

      const financials = calculateBookingFinancials(booking, schedules, txns);

      res.json({
        booking,
        customer,
        unit,
        schedules,
        transactions: txns,
        financials
      });
    } catch (err: any) {
      console.error('Error fetching booking detail:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 4. PUT /api/crm/bookings/:id/confirm - Confirm booking status
  router.put('/:id/confirm', authMiddleware, requireCrmRole('admin', 'sales_manager'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const bId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const booking = await db.collection('crm_bookings').findOne({ _id: bId, companyId });
      if (!booking) return res.status(404).json({ message: 'Booking not found.' });

      const prevBooking = { ...booking };

      await db.collection('crm_bookings').updateOne(
        { _id: bId, companyId },
        {
          $set: {
            status: 'Confirmed',
            approvalStatus: 'Approved',
            approvedBy: req.user?.sub || 'system',
            approvedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      // Unit availability status confirmed
      const uIdMatcher = ObjectId.isValid(String(booking.unitId)) && String(booking.unitId).length === 24
        ? { $in: [new ObjectId(String(booking.unitId)), String(booking.unitId)] }
        : booking.unitId;
      await db.collection('crm_units').updateOne(
        { _id: uIdMatcher },
        { $set: { availabilityStatus: 'Booked', updatedAt: new Date() } }
      );

      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: booking.customerId,
        activityType: 'Booking Action',
        title: `Booking Confirmed: ${booking.bookingReference}`,
        description: `Booking officially confirmed for Unit ${booking.unitCode}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: 'user',
          companyId,
          module: 'crm',
          action: 'BOOKING_CONFIRMED',
          resource: 'crm_bookings',
          resourceId: String(bId),
          description: `Confirmed booking ${booking.bookingReference}`,
          before: { status: prevBooking.status, approvalStatus: prevBooking.approvalStatus },
          after: { status: 'Confirmed', approvalStatus: 'Approved' }
        });
      }

      const updated = await db.collection('crm_bookings').findOne({ _id: bId });
      res.json(updated);
    } catch (err: any) {
      console.error('Error confirming booking:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 5. PUT /api/crm/bookings/:id/cancel - Safe cancellation & Unit Release
  router.put('/:id/cancel', authMiddleware, requireCrmRole('admin', 'sales_manager'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const bId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { cancellationReason } = req.body;

      if (!cancellationReason || String(cancellationReason).trim().length < 3) {
        return res.status(400).json({ message: 'A valid cancellation reason is required.' });
      }

      const booking = await db.collection('crm_bookings').findOne({ _id: bId, companyId });
      if (!booking) return res.status(404).json({ message: 'Booking not found.' });

      if (booking.status === 'Cancelled') {
        return res.status(400).json({ message: 'Booking is already cancelled.' });
      }

      const prevBooking = { ...booking };

      await db.collection('crm_bookings').updateOne(
        { _id: bId, companyId },
        {
          $set: {
            status: 'Cancelled',
            cancellationReason: cancellationReason.trim(),
            cancelledAt: new Date(),
            cancelledBy: req.user?.sub || 'system',
            updatedAt: new Date()
          }
        }
      );

      // Safe unit release: returns unit to Available status while keeping booking history
      await releaseUnitSafely(db, companyId, booking.unitId);

      // Record activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: booking.customerId,
        activityType: 'Booking Action',
        title: `Booking Cancelled: ${booking.bookingReference}`,
        description: `Booking cancelled for Unit ${booking.unitCode}. Reason: ${cancellationReason.trim()}. Unit released back to Available.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: 'user',
          companyId,
          module: 'crm',
          action: 'BOOKING_CANCELLED',
          resource: 'crm_bookings',
          resourceId: String(bId),
          description: `Cancelled booking ${booking.bookingReference}`,
          before: { status: prevBooking.status },
          after: { status: 'Cancelled', cancellationReason: cancellationReason.trim() }
        });
      }

      const updated = await db.collection('crm_bookings').findOne({ _id: bId });
      res.json(updated);
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
