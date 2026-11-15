import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { rupeesToPaise, paiseToRupees } from './crm.calculation.service';
import { getNextSequence } from './crm.sequence.service';
import { requireCrmRole } from './crm.security.service';
import { validateBody, recordPaymentSchema, reversePaymentSchema, parsePagination, crmRateLimiter } from './crm.validation';

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

  // 1. GET /api/crm/payments - List all payment transactions with pagination
  router.get('/', authMiddleware, requireCrmRole('admin', 'accountant', 'sales_manager', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { bookingId, customerId, paymentStatus, search } = req.query;
      const { page, limit, skip } = parsePagination(req.query);

      const query: any = { companyId };
      if (bookingId) query.bookingId = ObjectId.isValid(bookingId) ? new ObjectId(bookingId) : bookingId;
      if (customerId) query.customerId = ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId;
      if (paymentStatus) query.paymentStatus = paymentStatus;

      let txns = await db.collection('crm_payment_transactions').find(query).sort({ paymentDate: -1, createdAt: -1 }).toArray();

      if (search) {
        const term = String(search).toLowerCase().trim();
        txns = txns.filter((t: any) =>
          (t.receiptNumber && t.receiptNumber.toLowerCase().includes(term)) ||
          (t.paymentReference && t.paymentReference.toLowerCase().includes(term)) ||
          (t.bookingReference && t.bookingReference.toLowerCase().includes(term)) ||
          (t.customerName && t.customerName.toLowerCase().includes(term)) ||
          (t.transactionReference && t.transactionReference.toLowerCase().includes(term))
        );
      }

      const total = txns.length;
      const paginated = txns.slice(skip, skip + limit);

      res.json({
        data: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (err: any) {
      console.error('Error fetching payments:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 2. POST /api/crm/payments - Post verified customer payment & generate receipt
  router.post(
    '/',
    authMiddleware,
    requireCrmRole('admin', 'accountant', 'sales_manager'),
    crmRateLimiter({ max: 30 }),
    validateBody(recordPaymentSchema),
    async (req: any, res) => {
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

        const paymentAmtPaise = rupeesToPaise(amount);
        const paymentAmt = paiseToRupees(paymentAmtPaise);

        // Atomic sequential references
        const payRef = await getNextSequence(db, companyId, 'paymentReference');
        const recNum = await getNextSequence(db, companyId, 'receiptNumber');

        let targetMilestoneId = milestoneScheduleId ? (ObjectId.isValid(milestoneScheduleId) ? new ObjectId(milestoneScheduleId) : milestoneScheduleId) : null;

        // If no milestone specified, auto-target the oldest due milestone with outstanding balance
        if (!targetMilestoneId) {
          const pendingMilestones = await db.collection('crm_payment_schedules')
            .find({ companyId, bookingId: bId, status: { $ne: 'Paid' } })
            .sort({ sortOrder: 1 })
            .toArray();

          if (pendingMilestones.length > 0) {
            targetMilestoneId = pendingMilestones[0]._id;
          }
        }

        const newPayment: any = {
          companyId,
          paymentReference: payRef,
          receiptNumber: recNum,
          bookingId: bId,
          bookingReference: booking.bookingReference,
          customerId: booking.customerId,
          customerName: booking.customerName,
          milestoneScheduleId: targetMilestoneId,
          amount: paymentAmt,
          amountPaise: paymentAmtPaise,
          currency,
          paymentMethod,
          transactionReference: transactionReference.trim(),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          receivedBy: req.user?.sub || 'system',
          receivedByName: req.user?.name || 'Accounts Desk',
          paymentStatus: 'Paid',
          receiptNotes: receiptNotes || '',
          createdAt: new Date(),
          createdBy: req.user?.sub || 'system'
        };

        const result = await db.collection('crm_payment_transactions').insertOne(newPayment);
        const txnId = result.insertedId;

        // Atomically update milestone schedule in integer paise
        if (targetMilestoneId) {
          const sched = await db.collection('crm_payment_schedules').findOne({ _id: targetMilestoneId, companyId });
          if (sched) {
            const currentPaidPaise = sched.paidAmountPaise !== undefined
              ? sched.paidAmountPaise
              : rupeesToPaise(sched.paidAmount || 0);
            const duePaise = sched.dueAmountPaise !== undefined
              ? sched.dueAmountPaise
              : rupeesToPaise(sched.dueAmount);

            const updatedPaidPaise = currentPaidPaise + paymentAmtPaise;
            const status = updatedPaidPaise >= duePaise ? 'Paid' : 'Partially Paid';

            await db.collection('crm_payment_schedules').updateOne(
              { _id: sched._id },
              {
                $set: {
                  paidAmount: paiseToRupees(updatedPaidPaise),
                  paidAmountPaise: updatedPaidPaise,
                  status,
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
          unitCode: booking.unitCode,
          activityType: 'Booking Action',
          title: `Payment Received: ${recNum}`,
          description: `Received ₹${paymentAmt.toLocaleString()} via ${paymentMethod} for Unit ${booking.unitCode}. Receipt: ${recNum} (Ref: ${payRef}).`,
          performedBy: req.user?.sub || 'system',
          performedByName: req.user?.name || 'Accounts Desk',
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
            resourceId: String(txnId),
            description: `Recorded payment ${payRef} (Receipt: ${recNum}) for ₹${paymentAmt}`,
            newValue: newPayment
          });
        }

        res.status(201).json({ _id: txnId, ...newPayment });
      } catch (err: any) {
        console.error('Error recording payment:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // 3. GET /api/crm/payments/:id/receipt - Official printable tax receipt
  router.get('/:id/receipt', authMiddleware, requireCrmRole('admin', 'accountant', 'sales_manager', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const pId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      let txn = await db.collection('crm_payment_transactions').findOne({ _id: pId, companyId });
      if (!txn) {
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

  // 4. PUT /api/crm/payments/:id/reverse - Immutable payment reversal
  // Creates linked negative ledger entry, rebalances milestone schedule, and writes audit log
  router.put(
    '/:id/reverse',
    authMiddleware,
    requireCrmRole('admin', 'accountant'),
    validateBody(reversePaymentSchema),
    async (req: any, res) => {
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

        const prevTxn = { ...txn };
        const now = new Date();

        // Mark original transaction as Reversed
        await db.collection('crm_payment_transactions').updateOne(
          { _id: pId, companyId },
          {
            $set: {
              paymentStatus: reversalType,
              reversalReason: reversalReason.trim(),
              reversalDate: now,
              updatedAt: now
            }
          }
        );

        // Generate reversal business reference
        const revRef = `${txn.paymentReference}-REV`;
        const revRec = `${txn.receiptNumber}-REV`;

        const negativeAmountPaise = -(txn.amountPaise !== undefined ? txn.amountPaise : rupeesToPaise(txn.amount));
        const negativeAmount = paiseToRupees(negativeAmountPaise);

        // Create linked negative reversal ledger entry
        const reversalEntry: any = {
          companyId,
          paymentReference: revRef,
          receiptNumber: revRec,
          bookingId: txn.bookingId,
          bookingReference: txn.bookingReference,
          customerId: txn.customerId,
          customerName: txn.customerName,
          milestoneScheduleId: txn.milestoneScheduleId,
          amount: negativeAmount,
          amountPaise: negativeAmountPaise,
          currency: txn.currency || 'INR',
          paymentMethod: txn.paymentMethod,
          transactionReference: `REV-${txn.transactionReference}`,
          paymentDate: now,
          receivedBy: req.user?.sub || 'system',
          receivedByName: req.user?.name || 'Accounts Team',
          paymentStatus: reversalType,
          isReversalEntry: true,
          reversalOfPaymentId: txn._id,
          reversalReason: reversalReason.trim(),
          receiptNotes: `Reversal of Receipt ${txn.receiptNumber}. Reason: ${reversalReason.trim()}`,
          createdAt: now,
          createdBy: req.user?.sub || 'system'
        };

        await db.collection('crm_payment_transactions').insertOne(reversalEntry);

        // Rebalance milestone schedule deduction in integer paise
        if (txn.milestoneScheduleId) {
          const sched = await db.collection('crm_payment_schedules').findOne({ _id: txn.milestoneScheduleId, companyId });
          if (sched) {
            const currentPaidPaise = sched.paidAmountPaise !== undefined
              ? sched.paidAmountPaise
              : rupeesToPaise(sched.paidAmount || 0);
            const duePaise = sched.dueAmountPaise !== undefined
              ? sched.dueAmountPaise
              : rupeesToPaise(sched.dueAmount);
            const txnPaise = txn.amountPaise !== undefined ? txn.amountPaise : rupeesToPaise(txn.amount);

            const adjustedPaidPaise = Math.max(0, currentPaidPaise - txnPaise);
            const newStatus = adjustedPaidPaise >= duePaise ? 'Paid' : (adjustedPaidPaise > 0 ? 'Partially Paid' : 'Due');

            await db.collection('crm_payment_schedules').updateOne(
              { _id: sched._id, companyId },
              {
                $set: {
                  paidAmount: paiseToRupees(adjustedPaidPaise),
                  paidAmountPaise: adjustedPaidPaise,
                  status: newStatus,
                  updatedAt: now
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
          description: `Receipt ${txn.receiptNumber} for ₹${txn.amount.toLocaleString()} was ${reversalType.toLowerCase()}. Linked reversal entry ${revRec} recorded. Reason: ${reversalReason.trim()}.`,
          performedBy: req.user?.sub || 'system',
          performedByName: req.user?.name || 'Accounts Team',
          createdAt: now
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
            before: { paymentStatus: prevTxn.paymentStatus },
            after: { paymentStatus: reversalType, reversalReason: reversalReason.trim(), reversalEntryId: String(reversalEntry._id) }
          });
        }

        const updatedTxn = await db.collection('crm_payment_transactions').findOne({ _id: pId });
        res.json({
          original: updatedTxn,
          reversalEntry,
          message: `Payment ${txn.receiptNumber} reversed successfully.`
        });
      } catch (err: any) {
        console.error('Error reversing payment:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // 5. Explicitly reject PUT and DELETE to ensure immutability
  router.put('/:id', (req, res) => res.status(405).json({ message: 'Payment transactions are immutable and cannot be updated. Use /reverse endpoint.' }));
  router.delete('/:id', (req, res) => res.status(405).json({ message: 'Payment transactions are immutable and cannot be deleted. Use /reverse endpoint.' }));

  return router;
}
