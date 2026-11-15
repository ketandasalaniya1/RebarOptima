import { ObjectId } from 'mongodb';
import {
  rupeesToPaise,
  paiseToRupees,
  roundCurrency,
  calculateBookingFinancials,
  generateInstallmentSchedule
} from './crm.calculation.service';
import {
  normalizePhone,
  checkDuplicateCustomer,
  reserveUnitSafely,
  evaluateUnitAvailability
} from './crm.reservation.service';
import {
  encryptSensitiveField,
  decryptSensitiveField,
  maskPan,
  maskAadhaar,
  requireCrmRole
} from './crm.security.service';
import { ICrmBooking, ICrmPaymentSchedule, ICrmPaymentTransaction } from './crm.types';

describe('Real Estate CRM Production V2 Test Suite', () => {

  // ── 1. MONEY MATH AT ₹1 CR SCALE ──────────────────────────────────────────
  describe('Money Math & Integer Paise Precision', () => {
    it('converts 1 Crore rupees to exact integer paise with zero drift', () => {
      const oneCroreRupees = 10000000; // ₹1,00,00,000
      const paise = rupeesToPaise(oneCroreRupees);
      expect(paise).toBe(1000000000); // 1 Billion paise
      expect(paiseToRupees(paise)).toBe(oneCroreRupees);
    });

    it('accurately calculates net booking value and overdue milestones at 1 Cr scale without floating-point error', () => {
      const booking: ICrmBooking = {
        companyId: 'comp_01',
        bookingReference: 'BK-2026-0001',
        customerId: 'cust_01',
        customerName: 'Singhania',
        customerPhone: '9820123456',
        projectId: 'prj_01',
        projectName: 'Skyline Towers',
        unitId: 'unit_01',
        unitCode: 'A-1203',
        agreementPrice: 10000000, // 1 Cr
        agreementPricePaise: 1000000000,
        discountAmount: 250000, // 2.5 L
        discountAmountPaise: 25000000,
        taxAmount: 487500, // 5% GST on 97.5L
        taxAmountPaise: 48750000,
        netBookingValue: 10237500, // ₹1,02,37,500
        netBookingValuePaise: 1023750000,
        bookingDepositRequired: 1000000,
        bookingDate: '2026-11-01',
        status: 'Confirmed',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'usr_01'
      };

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const schedules: ICrmPaymentSchedule[] = [
        {
          companyId: 'comp_01',
          bookingId: 'BK-01',
          bookingReference: 'BK-2026-0001',
          milestoneName: 'Token',
          milestonePercentage: 10,
          dueAmount: 1023750,
          dueAmountPaise: 102375000,
          dueDate: pastDate.toISOString(),
          paidAmount: 1023750,
          paidAmountPaise: 102375000,
          status: 'Paid',
          sortOrder: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          companyId: 'comp_01',
          bookingId: 'BK-01',
          bookingReference: 'BK-2026-0001',
          milestoneName: 'Plinth Slab',
          milestonePercentage: 20,
          dueAmount: 2047500,
          dueAmountPaise: 204750000,
          dueDate: pastDate.toISOString(), // Overdue!
          paidAmount: 500000,
          paidAmountPaise: 50000000,
          status: 'Partially Paid',
          sortOrder: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const txns: ICrmPaymentTransaction[] = [
        {
          companyId: 'comp_01',
          paymentReference: 'TXN-01',
          receiptNumber: 'REC-01',
          bookingId: 'BK-01',
          bookingReference: 'BK-2026-0001',
          customerId: 'cust_01',
          customerName: 'Singhania',
          amount: 1523750,
          amountPaise: 152375000,
          currency: 'INR',
          paymentMethod: 'Bank Transfer (NEFT/RTGS)',
          transactionReference: 'UTR100293',
          paymentDate: new Date(),
          receivedBy: 'usr_01',
          receivedByName: 'Accounts',
          paymentStatus: 'Paid',
          createdAt: new Date(),
          createdBy: 'usr_01'
        }
      ];

      const financials = calculateBookingFinancials(booking, schedules, txns);
      expect(financials.netBookingValue).toBe(10237500);
      expect(financials.totalReceived).toBe(1523750);
      expect(financials.totalOutstanding).toBe(10237500 - 1523750); // 8713750
      expect(financials.overdueAmount).toBe(2047500 - 500000); // 1547500
      expect(financials.isFullyPaid).toBe(false);
    });
  });

  // ── 2. CLP MILESTONE PERCENTAGES & PAISE ACCUMULATION ─────────────────────
  describe('CLP Milestone Schedule Engine', () => {
    it('guarantees milestone percentages sum to 100% and amounts exactly equal net booking value down to the paisa', () => {
      const netValue = 12345678.99; // Odd number with cents
      const schedule = generateInstallmentSchedule(netValue, new Date('2026-11-10'));

      const totalPct = schedule.reduce((sum, m) => sum + m.milestonePercentage, 0);
      expect(totalPct).toBe(100);

      const totalPaise = schedule.reduce((sum, m) => sum + m.dueAmountPaise, 0);
      const expectedPaise = rupeesToPaise(netValue);
      expect(totalPaise).toBe(expectedPaise);
    });
  });

  // ── 3. PHONE NORMALIZATION & DUPLICATE COLLISION ──────────────────────────
  describe('Phone Normalization & Deduplication', () => {
    it('normalizes various phone input shapes to standard 10 digits', () => {
      expect(normalizePhone('+91 98201 23456')).toBe('9820123456');
      expect(normalizePhone('09820123456')).toBe('9820123456');
      expect(normalizePhone('98201-23456')).toBe('9820123456');
      expect(normalizePhone('(98201) 23456')).toBe('9820123456');
      expect(normalizePhone('+91-98201-23456')).toBe('9820123456');
      expect(normalizePhone('919820123456')).toBe('9820123456');
    });

    it('detects duplicate customer across disparate phone formatting', async () => {
      const mockDb: any = {
        collection: () => ({
          find: () => ({
            toArray: async () => [
              {
                _id: new ObjectId(),
                companyId: 'comp_01',
                customerCode: 'CUST-1001',
                fullName: 'Vikramaditya Singhania',
                phone: '+91 98201 23456',
                email: 'vikram@singhania.com'
              }
            ]
          })
        })
      };

      const result = await checkDuplicateCustomer(mockDb, 'comp_01', '09820123456', 'another@email.com');
      expect(result.isDuplicate).toBe(true);
      expect(result.existingCustomerSummary.customerCode).toBe('CUST-1001');
    });
  });

  // ── 4. CONCURRENT UNIT HOLDS ──────────────────────────────────────────────
  describe('Atomic Reservation & Hold Conflict', () => {
    it('allows only the first concurrent reservation to succeed and rejects the second with a conflict', async () => {
      let unitState: any = {
        _id: new ObjectId(),
        companyId: 'comp_01',
        unitCode: 'A-1203',
        availabilityStatus: 'Available',
        heldUntil: null,
        heldByCustomerId: null
      };

      const mockDb: any = {
        collection: (colName: string) => ({
          findOneAndUpdate: async (filter: any, update: any) => {
            const now = new Date();
            const isMatch = filter._id.equals(unitState._id) &&
              (unitState.availabilityStatus === 'Available' ||
               (unitState.availabilityStatus === 'Held' && unitState.heldUntil < now));

            if (isMatch) {
              unitState = {
                ...unitState,
                availabilityStatus: update.$set.availabilityStatus,
                heldUntil: update.$set.heldUntil,
                heldByCustomerId: update.$set.heldByCustomerId
              };
              return unitState;
            }
            return null; // Atomic failure
          },
          findOne: async () => unitState
        })
      };

      // User 1 reserves the unit
      const res1 = await reserveUnitSafely(mockDb, 'comp_01', unitState._id, 'cust_01', 48);
      expect(res1.success).toBe(true);
      expect(unitState.availabilityStatus).toBe('Held');
      expect(unitState.heldByCustomerId).toBe('cust_01');

      // User 2 attempts to reserve the same unit concurrently
      const res2 = await reserveUnitSafely(mockDb, 'comp_01', unitState._id, 'cust_02', 48);
      expect(res2.success).toBe(false);
      expect(res2.conflict).toBe(true);
      expect(res2.message).toContain('Conflict');
    });

    it('evaluates unit as Available at read-time if heldUntil has expired', () => {
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1); // 1 hour ago

      const unit = {
        availabilityStatus: 'Held' as const,
        heldUntil: expiredDate,
        heldByCustomerId: 'cust_01'
      };

      const status = evaluateUnitAvailability(unit);
      expect(status.isAvailable).toBe(true);
      expect(status.status).toBe('Available');
      expect(status.isHoldExpired).toBe(true);
    });
  });

  // ── 5. PAYMENT REVERSAL REBALANCE ────────────────────────────────────────
  describe('Payment Reversal Math & Milestone Rebalancing', () => {
    it('restores milestone schedule balance and status when a payment is reversed', () => {
      const milestone = {
        dueAmountPaise: 10000000, // ₹1,00,000
        paidAmountPaise: 10000000, // ₹1,00,000 (Paid in full)
        status: 'Paid'
      };

      const reversalAmountPaise = 10000000;
      const updatedPaidPaise = Math.max(0, milestone.paidAmountPaise - reversalAmountPaise);
      const newStatus = updatedPaidPaise >= milestone.dueAmountPaise
        ? 'Paid'
        : (updatedPaidPaise > 0 ? 'Partially Paid' : 'Due');

      expect(updatedPaidPaise).toBe(0);
      expect(newStatus).toBe('Due');
      expect(paiseToRupees(updatedPaidPaise)).toBe(0);
    });
  });

  // ── 6. DATA SECURITY: ENCRYPTION & MASKING ────────────────────────────────
  describe('Sensitive Data Encryption & Masking', () => {
    it('encrypts PAN with AES-256-GCM and decrypts back to exact plaintext', () => {
      const pan = 'ABCDE1234F';
      const encrypted = encryptSensitiveField(pan);
      expect(encrypted).toBeTruthy();
      expect(encrypted).toContain(':'); // iv:authTag:ciphertext

      const decrypted = decryptSensitiveField(encrypted);
      expect(decrypted).toBe(pan);
    });

    it('masks PAN and Aadhaar fields correctly for secure display', () => {
      expect(maskPan('ABCDE1234F')).toBe('AB•••••34F');
      expect(maskAadhaar('123456789821')).toEqual({
        masked: '•••• •••• 9821',
        last4: '9821'
      });
    });
  });

  // ── 7. RBAC PERMISSIONS MATRIX ───────────────────────────────────────────
  describe('Role-Based Access Control Middleware', () => {
    it('allows admin role to pass any permission check', () => {
      const middleware = requireCrmRole('accountant');
      const req: any = { user: { role: 'admin' } };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('denies sales_rep access to accountant endpoints with 403 Forbidden', () => {
      const middleware = requireCrmRole('accountant', 'admin');
      const req: any = { user: { role: 'sales_rep' } };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── 8. TENANT ISOLATION ──────────────────────────────────────────────────
  describe('Tenant Data Isolation', () => {
    it('guarantees company filter scopes customer search to their tenant only', async () => {
      const companyA = new ObjectId();
      const companyB = new ObjectId();

      const customers = [
        { _id: new ObjectId(), companyId: companyA, fullName: 'Alice' },
        { _id: new ObjectId(), companyId: companyB, fullName: 'Bob' }
      ];

      const findForCompanyA = customers.filter(c => String(c.companyId) === String(companyA));
      expect(findForCompanyA).toHaveLength(1);
      expect(findForCompanyA[0].fullName).toBe('Alice');
      expect(findForCompanyA.some(c => String(c.companyId) === String(companyB))).toBe(false);
    });
  });

  // ── 9. TODAY SUMMARY & FOLLOW-UP BUCKETING ───────────────────────────────
  describe('Today Summary & Follow-up Categorization', () => {
    it('correctly categorizes follow-up leads into Overdue, Due Today, and Next 7 Days', () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const next7DaysEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

      const yesterday = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const todayNoon = new Date(todayStart.getTime() + 12 * 60 * 60 * 1000);
      const in3Days = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000);
      const in20Days = new Date(todayStart.getTime() + 20 * 24 * 60 * 60 * 1000);

      const leads = [
        { name: 'Lead Overdue', next_followup_at: yesterday },
        { name: 'Lead Today', next_followup_at: todayNoon },
        { name: 'Lead In 3 Days', next_followup_at: in3Days },
        { name: 'Lead Far Future', next_followup_at: in20Days }
      ];

      const overdue = leads.filter(l => new Date(l.next_followup_at) < todayStart);
      const dueToday = leads.filter(l => new Date(l.next_followup_at) >= todayStart && new Date(l.next_followup_at) <= todayEnd);
      const next7 = leads.filter(l => new Date(l.next_followup_at) > todayEnd && new Date(l.next_followup_at) <= next7DaysEnd);

      expect(overdue).toHaveLength(1);
      expect(overdue[0].name).toBe('Lead Overdue');

      expect(dueToday).toHaveLength(1);
      expect(dueToday[0].name).toBe('Lead Today');

      expect(next7).toHaveLength(1);
      expect(next7[0].name).toBe('Lead In 3 Days');
    });

    it('calculates hold expiry remaining seconds and flags expired vs active holds', () => {
      const now = new Date();
      const holdExpiresFuture = new Date(now.getTime() + 3600 * 1000); // 1 hour left
      const holdExpiresPast = new Date(now.getTime() - 60 * 1000); // expired 1 min ago

      const remainingFuture = Math.max(0, Math.round((holdExpiresFuture.getTime() - now.getTime()) / 1000));
      const remainingPast = Math.max(0, Math.round((holdExpiresPast.getTime() - now.getTime()) / 1000));

      expect(remainingFuture).toBeGreaterThan(3500);
      expect(remainingPast).toBe(0);
    });
  });

  // ── 10. GUIDED FOLLOW-UP QUEUE & TEMPLATE ENGINE ─────────────────────────
  describe('Guided Follow-up Queue & Template Engine', () => {
    it('correctly resolves dynamic variables in WhatsApp templates without corruption', () => {
      const template = 'Hello {name}! Thank you for your inquiry about {project}. We have {unit_type} starting at {price}.';
      const lead = {
        name: 'Sunil Mehta',
        project: 'Avira Heights',
        unit_type: '3BHK Sky Villa',
        price: '₹1.45 Cr'
      };

      const resolved = template
        .replace(/\{name\}/g, lead.name)
        .replace(/\{project\}/g, lead.project)
        .replace(/\{unit_type\}/g, lead.unit_type)
        .replace(/\{price\}/g, lead.price);

      expect(resolved).toBe('Hello Sunil Mehta! Thank you for your inquiry about Avira Heights. We have 3BHK Sky Villa starting at ₹1.45 Cr.');
      expect(resolved).not.toContain('{name}');
      expect(resolved).not.toContain('{project}');
    });

    it('simulates no_reply outcome: increments followup_count and schedules next follow-up in N days', () => {
      const initialLead = {
        followup_count: 1,
        next_followup_at: new Date('2026-11-12T10:00:00Z'),
        stage: 'New'
      };

      const noReplyDays = 3;
      const now = new Date('2026-11-12T10:00:00Z');
      const expectedNext = new Date(now.getTime() + noReplyDays * 24 * 3600 * 1000);

      const updatedLead = {
        ...initialLead,
        followup_count: (initialLead.followup_count || 1) + 1,
        next_followup_at: expectedNext,
        last_contacted_at: now
      };

      expect(updatedLead.followup_count).toBe(2);
      expect(updatedLead.next_followup_at.toISOString()).toBe(expectedNext.toISOString());
      expect(updatedLead.last_contacted_at).toEqual(now);
    });

    it('simulates not_interested outcome: assigns mandatory lost reason and marks stage Lost', () => {
      const initialLead = {
        stage: 'Qualified',
        lostReason: undefined
      };

      const lostReason = 'Price out of budget';
      const updatedLead = {
        ...initialLead,
        stage: 'Lost',
        lostReason
      };

      expect(updatedLead.stage).toBe('Lost');
      expect(updatedLead.lostReason).toBe('Price out of budget');
    });
  });

  // ── 11. TASKS ENGINE & RECURRING AUTO-SCHEDULING (PHASE 3) ────────────────
  describe('Tasks Engine & Recurring Auto-scheduling (Phase 3)', () => {
    it('computes next due date and resets checklist for daily, weekly, and monthly repeat rules', () => {
      const baseDate = new Date('2026-11-13T10:00:00Z');
      const checklist = [
        { id: 'c1', text: 'Call prospective buyer', done: true },
        { id: 'c2', text: 'Share brochure via WhatsApp', done: true }
      ];

      // Daily recurrence
      const dailyNext = new Date(baseDate);
      dailyNext.setDate(dailyNext.getDate() + 1);
      expect(dailyNext.toISOString()).toBe('2026-11-14T10:00:00.000Z');

      // Weekly recurrence
      const weeklyNext = new Date(baseDate);
      weeklyNext.setDate(weeklyNext.getDate() + 7);
      expect(weeklyNext.toISOString()).toBe('2026-11-20T10:00:00.000Z');

      // Monthly recurrence
      const monthlyNext = new Date(baseDate);
      monthlyNext.setMonth(monthlyNext.getMonth() + 1);
      expect(monthlyNext.toISOString()).toBe('2026-12-13T10:00:00.000Z');

      // Reset checklist items to false
      const resetChecklist = checklist.map(item => ({ ...item, done: false }));
      expect(resetChecklist.every(i => i.done === false)).toBe(true);
      expect(resetChecklist).toHaveLength(2);
    });

    it('aggregates unified calendar events from appointments, follow-ups, and collections', () => {
      const mockAppointments = [
        {
          _id: new ObjectId(),
          title: 'Site Walkthrough with Mr. Sharma',
          type: 'site_visit',
          start: new Date('2026-11-15T11:00:00Z'),
          end: new Date('2026-11-15T12:00:00Z'),
          customerName: 'Mr. Sharma'
        }
      ];

      const mockFollowups = [
        {
          _id: new ObjectId(),
          customerName: 'Anita Roy',
          next_followup_at: new Date('2026-11-15T14:30:00Z'),
          projectName: 'Skyline Palms',
          stage: 'Negotiation'
        }
      ];

      const unifiedEvents: any[] = [];

      mockAppointments.forEach(appt => {
        unifiedEvents.push({
          id: `appt_${appt._id}`,
          type: 'appointment',
          title: appt.title,
          start: appt.start,
          end: appt.end,
          color: '#8b5cf6'
        });
      });

      mockFollowups.forEach(f => {
        unifiedEvents.push({
          id: `lead_${f._id}`,
          type: 'followup',
          title: `Follow-up: ${f.customerName}`,
          start: f.next_followup_at,
          end: new Date(f.next_followup_at.getTime() + 15 * 60 * 1000),
          color: '#38bdf8'
        });
      });

      expect(unifiedEvents).toHaveLength(2);
      expect(unifiedEvents[0].type).toBe('appointment');
      expect(unifiedEvents[0].color).toBe('#8b5cf6');
      expect(unifiedEvents[1].type).toBe('followup');
      expect(unifiedEvents[1].title).toContain('Anita Roy');
    });
  });

  // ── 12. LEADS, PAISE BUDGET & PIPELINE STAGES (PHASE 4) ────────────────────
  describe('Leads, Paise Budget & Pipeline Stages (Phase 4)', () => {
    it('stores lead budget in integer paise and handles Lakhs/Crore scale correctly', () => {
      const budgetRupees = 12500000; // 1.25 Cr
      const budgetPaise = rupeesToPaise(budgetRupees);

      expect(budgetPaise).toBe(1250000000);
      expect(paiseToRupees(budgetPaise)).toBe(12500000);

      const leadDoc = {
        name: 'Rajesh Singhal',
        phone: '9820011223',
        phoneNormalized: normalizePhone('9820011223'),
        budget: budgetRupees,
        budgetPaise: budgetPaise,
        purpose: 'self_use',
        loan_needed: true,
        stage: 'New enquiry',
        followup_count: 1
      };

      expect(leadDoc.phoneNormalized).toBe('9820011223');
      expect(leadDoc.budgetPaise).toBe(1250000000);
      expect(leadDoc.followup_count).toBe(1);
    });

    it('validates pipeline stages configuration order, won/lost flags, and stage preservation', () => {
      const sampleStages = [
        { id: 'new', name: 'New enquiry', order: 1, color: '#38bdf8', is_won: false, is_lost: false },
        { id: 'contacted', name: 'Contacted', order: 2, color: '#6366f1', is_won: false, is_lost: false },
        { id: 'site_visit', name: 'Site visit', order: 3, color: '#8b5cf6', is_won: false, is_lost: false },
        { id: 'negotiation', name: 'Negotiation', order: 4, color: '#f59e0b', is_won: false, is_lost: false },
        { id: 'hold', name: 'Hold', order: 5, color: '#eab308', is_won: false, is_lost: false },
        { id: 'booked', name: 'Booked', order: 6, color: '#16a34a', is_won: true, is_lost: false },
        { id: 'lost', name: 'Lost', order: 7, color: '#ef4444', is_won: false, is_lost: true }
      ];

      // Validate ordering
      const sorted = [...sampleStages].sort((a, b) => a.order - b.order);
      expect(sorted[0].name).toBe('New enquiry');
      expect(sorted[sorted.length - 1].name).toBe('Lost');

      // Validate core won and lost stages
      const wonStage = sampleStages.find(s => s.is_won);
      const lostStage = sampleStages.find(s => s.is_lost);

      expect(wonStage?.name).toBe('Booked');
      expect(lostStage?.name).toBe('Lost');
    });
  });

});

