import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { generateBusinessReference } from './crm.reservation.service';
import { roundCurrency } from './crm.calculation.service';

export function createCrmPaymentRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
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

  // 1. GET /api/crm/payments - List all payment transactions
  router.get('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { bookingId, customerId, paymentStatus, search } = req.query;

      const query: any = { companyId };
      if (bookingId) query.bookingId = ObjectId.isValid(bookingId) ? new ObjectId(bookingId) : bookingId;
      if (customerId) query.customerId = ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId;
      if (paymentStatus) query.paymentStatus = paymentStatus;

      let txns = await db.collection('crm_payment_transactions').find(query).sort({ paymentDate: -1 }).toArray();

      if (search) {
        const term = String(search).toLowerCase().trim();
        txns = txns.filter((t: any) =>
          (t.receiptNumber && t.receiptNumber.toLowerCase().includes(term)) ||
          (t.bookingReference && t.bookingReference.toLowerCase().includes(term)) ||
          (t.customerName && t.customerName.toLowerCase().includes(term)) ||
          (t.transactionReference && t.transactionReference.toLowerCase().includes(term))
        );
      }

      res.json(txns);
    } catch (err: any) {
      console.error('Error fetching payments:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 2. POST /api/crm/payments - Post verified customer payment & generate receipt
  router.post('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        bookingId,
        milestoneScheduleId,
        amount,
        currency = 'INR',
        paymentMethod = 'Bank Transfer (NEFT/RTGS)',
        transactionReference,
        paymentDate,
        receiptNotes
      } = req.body;

      if (!bookingId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ message: 'Valid booking ID and positive payment amount are required.' });
      }

      const bId = ObjectId.isValid(bookingId) ? new ObjectId(bookingId) : bookingId;
      const booking = await db.collection('crm_bookings').findOne({ _id: bId, companyId });
      if (!booking) return res.status(404).json({ message: 'Booking not found.' });

      // Duplicate payment check: check if the same transaction reference / UTR was already recorded
      if (transactionReference && transactionReference.trim() !== '') {
        const existingTxn = await db.collection('crm_payment_transactions').findOne({
          companyId,
          bookingId: bId,
          transactionReference: transactionReference.trim(),
          paymentStatus: 'Paid'
        });

        if (existingTxn) {
          return res.status(409).json({
            message: `A payment with transaction reference '${transactionReference}' has already been posted on ${new Date(existingTxn.paymentDate).toLocaleDateString()}. Duplicate posting rejected.`
          });
        }
      }

      const paymentAmt = roundCurrency(Number(amount));
      const payRef = await generateBusinessReference(db, companyId, 'crm_payment_transactions', 'TXN', 'paymentReference');
      const recNum = await generateBusinessReference(db, companyId, 'crm_payment_transactions', 'REC', 'receiptNumber');

      const pDate = paymentDate ? new Date(paymentDate) : new Date();

      const newTxn: any = {
        companyId,
        paymentReference: payRef,
        receiptNumber: recNum,
        bookingId: bId,
        bookingReference: booking.bookingReference,
        customerId: booking.customerId,
        customerName: booking.customerName,
        milestoneScheduleId: milestoneScheduleId ? (ObjectId.isValid(milestoneScheduleId) ? new ObjectId(milestoneScheduleId) : milestoneScheduleId) : null,
        amount: paymentAmt,
        currency,
        paymentMethod,
        transactionReference: transactionReference || 'REF-' + Date.now(),
        paymentDate: pDate,
        receivedBy: req.user?.sub || 'system',
        receivedByName: req.user?.name || 'Accounts Desk',
        paymentStatus: 'Paid',
        receiptNotes: receiptNotes || '',
        createdAt: new Date(),
        createdBy: req.user?.sub || 'system'
      };

      const result = await db.collection('crm_payment_transactions').insertOne(newTxn);

      // Milestone allocation: update milestone schedule paidAmount if specified or find oldest unpaid milestone
      let targetScheduleId = newTxn.milestoneScheduleId;
      if (!targetScheduleId) {
        const oldestDue = await db.collection('crm_payment_schedules').findOne(
          { bookingId: bId, status: { $ne: 'Paid' }, companyId },
          { sort: { sortOrder: 1 } }
        );
        if (oldestDue) targetScheduleId = oldestDue._id;
      }

      if (targetScheduleId) {
        const sched = await db.collection('crm_payment_schedules').findOne({ _id: targetScheduleId, companyId });
        if (sched) {
          const newPaid = roundCurrency((Number(sched.paidAmount) || 0) + paymentAmt);
          const isFullyCovered = newPaid >= sched.dueAmount;
          await db.collection('crm_payment_schedules').updateOne(
            { _id: sched._id, companyId },
            {
              $set: {
                paidAmount: newPaid,
                status: isFullyCovered ? 'Paid' : 'Partially Paid',
                updatedAt: new Date()
              }
            }
          );
        }
      }

      // Record activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: booking.customerId,
        activityType: 'Booking Action',
        title: `Payment Received: ₹${paymentAmt.toLocaleString()}`,
        description: `Payment of ₹${paymentAmt.toLocaleString()} posted via ${paymentMethod} for booking ${booking.bookingReference}. Receipt #${recNum}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Accounts Team',
        createdAt: new Date()
      });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: 'user',
          companyId,
          module: 'crm',
          action: 'PAYMENT_RECORDED',
          resource: 'crm_payment_transactions',
          resourceId: String(result.insertedId),
          description: `Recorded payment of ₹${paymentAmt.toLocaleString()} for booking ${booking.bookingReference} (Receipt: ${recNum})`,
          newValue: newTxn
        });
      }

      res.status(201).json({ _id: result.insertedId, ...newTxn });
    } catch (err: any) {
      console.error('Error recording payment:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 3. GET /api/crm/payments/:id/receipt - Fetch complete printable receipt data
  router.get('/:id/receipt', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const pId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      let txn = await db.collection('crm_payment_transactions').findOne({ _id: pId, companyId });
      if (!txn) {
        // Fallback search by receiptNumber
        txn = await db.collection('crm_payment_transactions').findOne({ receiptNumber: req.params.id, companyId });
      }

      if (!txn) return res.status(404).json({ message: 'Payment transaction not found.' });

      const [booking, customer, company] = await Promise.all([
        db.collection('crm_bookings').findOne({ _id: txn.bookingId, companyId }),
        db.collection('crm_customers').findOne({ _id: txn.customerId, companyId }),
        db.collection('companies').findOne({ _id: companyId })
      ]);

      res.json({
        transaction: txn,
        booking,
        customer,
        company: company ? {
          name: company.name || 'Real Estate Developer',
          address: company.address || '',
          gstin: company.gstin || '',
          phone: company.phone || '',
          email: company.email || ''
        } : {
          name: 'Real Estate Developer Organization',
          address: 'Corporate Headquarters',
          gstin: '24AAAAA0000A1Z5'
        }
      });
    } catch (err: any) {
      console.error('Error generating receipt:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 4. PUT /api/crm/payments/:id/reverse - Safe payment reversal or refund (never hard-deletes!)
  router.put('/:id/reverse', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const pId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { reversalReason, reversalType = 'Reversed' } = req.body;

      const txn = await db.collection('crm_payment_transactions').findOne({ _id: pId, companyId });
      if (!txn) return res.status(404).json({ message: 'Transaction not found.' });

      if (txn.paymentStatus !== 'Paid') {
        return res.status(400).json({ message: `Transaction is already in '${txn.paymentStatus}' state.` });
      }

      await db.collection('crm_payment_transactions').updateOne(
        { _id: pId, companyId },
        {
          $set: {
            paymentStatus: reversalType,
            reversalReason: reversalReason || 'Manual accounting reversal',
            reversalDate: new Date(),
            updatedAt: new Date()
          }
        }
      );

      // Reverse milestone schedule deduction if applicable
      if (txn.milestoneScheduleId) {
        const sched = await db.collection('crm_payment_schedules').findOne({ _id: txn.milestoneScheduleId, companyId });
        if (sched) {
          const adjustedPaid = roundCurrency(Math.max(0, (Number(sched.paidAmount) || 0) - txn.amount));
          await db.collection('crm_payment_schedules').updateOne(
            { _id: sched._id, companyId },
            {
              $set: {
                paidAmount: adjustedPaid,
                status: adjustedPaid >= sched.dueAmount ? 'Paid' : (adjustedPaid > 0 ? 'Partially Paid' : 'Due'),
                updatedAt: new Date()
              }
            }
          );
        }
      }

      // Record activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: txn.customerId,
        activityType: 'Booking Action',
        title: `Payment ${reversalType}: ${txn.receiptNumber}`,
        description: `Receipt ${txn.receiptNumber} for ₹${txn.amount.toLocaleString()} was ${reversalType.toLowerCase()}. Reason: ${reversalReason || 'N/A'}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Accounts Team',
        createdAt: new Date()
      });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user?.sub,
          actorType: 'user',
          companyId,
          module: 'crm',
          action: 'PAYMENT_REVERSED',
          resource: 'crm_payment_transactions',
          resourceId: String(pId),
          description: `Reversed payment transaction ${txn.paymentReference} (Receipt: ${txn.receiptNumber})`,
          newValue: { reversalReason, reversalType }
        });
      }

      const updated = await db.collection('crm_payment_transactions').findOne({ _id: pId });
      res.json(updated);
    } catch (err: any) {
      console.error('Error reversing payment:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
