import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { generateBusinessReference, commitUnitBooking, releaseUnitSafely } from './crm.reservation.service';
import { roundCurrency, generateInstallmentSchedule, calculateBookingFinancials } from './crm.calculation.service';

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

  // 1. GET /api/crm/bookings - List bookings with financial metrics
  router.get('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { status, projectId, customerId, search } = req.query;

      const query: any = { companyId };
      if (status) query.status = status;
      if (projectId) query.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      if (customerId) query.customerId = ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId;

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

      // Populate financial summaries
      const bookingIds = bookings.map((b: any) => b._id);
      const [allSchedules, allTxns] = await Promise.all([
        db.collection('crm_payment_schedules').find({ companyId, bookingId: { $in: bookingIds } }).toArray(),
        db.collection('crm_payment_transactions').find({ companyId, bookingId: { $in: bookingIds } }).toArray()
      ]);

      const enriched = bookings.map((b: any) => {
        const bIdStr = String(b._id);
        const schedules = allSchedules.filter((s: any) => String(s.bookingId) === bIdStr);
        const txns = allTxns.filter((t: any) => String(t.bookingId) === bIdStr);
        const financials = calculateBookingFinancials(b, schedules, txns);
        return {
          ...b,
          financials
        };
      });

      res.json(enriched);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 2. POST /api/crm/bookings - Create and commit a new property booking
  router.post('/', authMiddleware, async (req: any, res) => {
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

      if (!customerId || !projectId || !unitId || !agreementPrice) {
        return res.status(400).json({ message: 'Customer, project, unit, and agreement price are required.' });
      }

      const custId = ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId;
      const prjId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      const uId = ObjectId.isValid(unitId) ? new ObjectId(unitId) : unitId;

      const [customer, project, unit] = await Promise.all([
        db.collection('crm_customers').findOne({ _id: custId, companyId }),
        db.collection('crm_projects').findOne({ _id: prjId, companyId }),
        db.collection('crm_units').findOne({ _id: uId, companyId })
      ]);

      if (!customer) return res.status(404).json({ message: 'Customer record not found.' });
      if (!project) return res.status(404).json({ message: 'Project record not found.' });
      if (!unit) return res.status(404).json({ message: 'Property unit not found.' });

      // Financial calculations with exact decimal rounding
      const price = roundCurrency(Number(agreementPrice));
      const discount = roundCurrency(Number(discountAmount) || 0);
      const tax = roundCurrency(Number(taxAmount) || 0);
      const netBookingValue = roundCurrency(price - discount + tax);
      const deposit = roundCurrency(Number(bookingDepositRequired) || roundCurrency(netBookingValue * 0.1));

      // Generate collision-safe booking reference
      const bookingReference = await generateBusinessReference(db, companyId, 'crm_bookings', 'BK', 'bookingReference');

      const bDate = bookingDate ? new Date(bookingDate) : new Date();

      const newBooking: any = {
        companyId,
        bookingReference,
        customerId: custId,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        customerEmail: customer.email || '',
        projectId: prjId,
        projectName: project.name,
        unitId: uId,
        unitCode: unit.unitCode,
        unitInterestId: unitInterestId ? (ObjectId.isValid(unitInterestId) ? new ObjectId(unitInterestId) : unitInterestId) : null,
        agreementPrice: price,
        discountAmount: discount,
        taxAmount: tax,
        netBookingValue,
        bookingDepositRequired: deposit,
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

      // Atomic commit: reserve/book the unit
      const commitRes = await commitUnitBooking(db, companyId, uId, null, custId);
      if (!commitRes.success) {
        return res.status(409).json({ message: commitRes.message });
      }

      const insertResult = await db.collection('crm_bookings').insertOne(newBooking);
      const bookingId = insertResult.insertedId;

      // Update unit with activeBookingId
      await db.collection('crm_units').updateOne(
        { _id: uId, companyId },
        { $set: { activeBookingId: String(bookingId) } }
      );

      // Generate Installment Schedule milestones
      const milestones = customSchedule && customSchedule.length > 0
        ? customSchedule
        : generateInstallmentSchedule(netBookingValue, bDate);

      const scheduleDocs = milestones.map((m: any, idx: number) => ({
        companyId,
        bookingId,
        bookingReference,
        milestoneName: m.milestoneName,
        milestonePercentage: Number(m.milestonePercentage) || 0,
        dueAmount: roundCurrency(m.dueAmount),
        dueDate: m.dueDate || new Date().toISOString().split('T')[0],
        paidAmount: 0,
        status: 'Due',
        sortOrder: idx + 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      if (scheduleDocs.length > 0) {
        await db.collection('crm_payment_schedules').insertMany(scheduleDocs);
      }

      // If tied to a specific unit interest, mark that interest as 'Booked'
      // Note: ONLY this interest is updated; any other interests for the same customer remain untouched!
      if (unitInterestId) {
        await db.collection('crm_unit_interests').updateOne(
          { _id: ObjectId.isValid(unitInterestId) ? new ObjectId(unitInterestId) : unitInterestId, companyId },
          { $set: { stage: 'Booked', bookingId, updatedAt: new Date() } }
        );
      }

      // Log activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: custId,
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
  });

  // 3. GET /api/crm/bookings/:id - Booking detail with schedules & transactions
  router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const bId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const booking = await db.collection('crm_bookings').findOne({ _id: bId, companyId });
      if (!booking) return res.status(404).json({ message: 'Booking not found.' });

      const [customer, unit, schedules, txns] = await Promise.all([
        db.collection('crm_customers').findOne({ _id: booking.customerId, companyId }),
        db.collection('crm_units').findOne({ _id: booking.unitId, companyId }),
        db.collection('crm_payment_schedules').find({ bookingId: bId, companyId }).sort({ sortOrder: 1 }).toArray(),
        db.collection('crm_payment_transactions').find({ bookingId: bId, companyId }).sort({ paymentDate: -1 }).toArray()
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
  router.put('/:id/confirm', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const bId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const booking = await db.collection('crm_bookings').findOne({ _id: bId, companyId });
      if (!booking) return res.status(404).json({ message: 'Booking not found.' });

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
      await db.collection('crm_units').updateOne(
        { _id: booking.unitId, companyId },
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

      const updated = await db.collection('crm_bookings').findOne({ _id: bId });
      res.json(updated);
    } catch (err: any) {
      console.error('Error confirming booking:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 5. PUT /api/crm/bookings/:id/cancel - Safe cancellation & Unit Release
  router.put('/:id/cancel', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const bId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { cancellationReason } = req.body;

      const booking = await db.collection('crm_bookings').findOne({ _id: bId, companyId });
      if (!booking) return res.status(404).json({ message: 'Booking not found.' });

      if (booking.status === 'Cancelled') {
        return res.status(400).json({ message: 'Booking is already cancelled.' });
      }

      await db.collection('crm_bookings').updateOne(
        { _id: bId, companyId },
        {
          $set: {
            status: 'Cancelled',
            cancellationReason: cancellationReason || 'Customer requested cancellation',
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
        description: `Booking cancelled for Unit ${booking.unitCode}. Reason: ${cancellationReason || 'N/A'}. Unit has been safely released back to Available inventory.`,
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
          description: `Cancelled booking ${booking.bookingReference} and released unit ${booking.unitCode}`,
          newValue: { cancellationReason }
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
