import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { roundCurrency, calculateBookingFinancials } from './crm.calculation.service';
import { evaluateUnitAvailability } from './crm.reservation.service';

export function createCrmReportRouter(getDb: () => any, authMiddleware: any) {
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

  // 1. GET /api/crm/reports/dashboard - Master Executive KPIs
  router.get('/dashboard', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, salespersonId } = req.query;

      const baseQuery: any = { companyId };
      const prjQuery: any = { companyId };
      if (projectId) {
        prjQuery.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }

      const [customers, leads, units, bookings, visits, tasks, schedules, transactions] = await Promise.all([
        db.collection('crm_customers').find(baseQuery).toArray(),
        db.collection('crm_unit_interests').find(prjQuery).toArray(),
        db.collection('crm_units').find(prjQuery).toArray(),
        db.collection('crm_bookings').find(prjQuery).toArray(),
        db.collection('crm_site_visits').find(prjQuery).toArray(),
        db.collection('crm_follow_ups').find(baseQuery).toArray(),
        db.collection('crm_payment_schedules').find(baseQuery).toArray(),
        db.collection('crm_payment_transactions').find(baseQuery).toArray()
      ]);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      // Tasks
      const pendingTasks = tasks.filter((t: any) => t.status !== 'Completed');
      const dueTodayTasks = pendingTasks.filter((t: any) => {
        const d = new Date(t.dueDateTime);
        return d >= startOfToday && d <= endOfToday;
      }).length;
      const overdueTasks = pendingTasks.filter((t: any) => new Date(t.dueDateTime) < now).length;

      // Visits
      const scheduledVisits = visits.filter((v: any) => ['Scheduled', 'Confirmed'].includes(v.status)).length;

      // Bookings & Financials
      let totalBookingValue = 0;
      let totalCollected = 0;
      let confirmedBookingsCount = 0;
      let activeReservationsCount = 0;

      for (const b of bookings) {
        if (b.status === 'Confirmed') confirmedBookingsCount++;
        if (b.status === 'Reserved') activeReservationsCount++;

        if (b.status !== 'Cancelled') {
          totalBookingValue += roundCurrency(b.netBookingValue || b.agreementPrice);
        }
      }

      for (const t of transactions) {
        if (t.paymentStatus === 'Paid') {
          totalCollected += roundCurrency(t.amount);
        }
      }

      totalBookingValue = roundCurrency(totalBookingValue);
      totalCollected = roundCurrency(totalCollected);
      const outstandingReceivables = roundCurrency(Math.max(0, totalBookingValue - totalCollected));

      // Inventory availability
      let availableUnits = 0;
      let heldUnits = 0;
      let reservedUnits = 0;
      let bookedUnits = 0;
      let blockedUnits = 0;

      for (const u of units) {
        const evalRes = evaluateUnitAvailability(u);
        if (evalRes.status === 'Available') availableUnits++;
        else if (evalRes.status === 'Held') heldUnits++;
        else if (evalRes.status === 'Reserved') reservedUnits++;
        else if (evalRes.status === 'Booked') bookedUnits++;
        else if (evalRes.status === 'Blocked' || evalRes.status === 'Sold') blockedUnits++;
      }

      // Pipeline stages breakdown
      const pipelineBreakdown: Record<string, number> = {};
      for (const l of leads) {
        const s = l.stage || 'New';
        pipelineBreakdown[s] = (pipelineBreakdown[s] || 0) + 1;
      }

      // Lead sources breakdown
      const sourcesBreakdown: Record<string, number> = {};
      for (const c of customers) {
        const src = c.leadSource || 'Website';
        sourcesBreakdown[src] = (sourcesBreakdown[src] || 0) + 1;
      }

      res.json({
        kpis: {
          totalCustomers: customers.length,
          newLeads: pipelineBreakdown['New'] || 0,
          qualifiedLeads: pipelineBreakdown['Qualified'] || 0,
          followUpsDueToday: dueTodayTasks,
          overdueFollowUps: overdueTasks,
          siteVisitsScheduled: scheduledVisits,
          activeReservations: activeReservationsCount,
          confirmedBookings: confirmedBookingsCount,
          totalBookingValue,
          paymentsCollected: totalCollected,
          outstandingReceivables
        },
        inventory: {
          total: units.length,
          available: availableUnits,
          held: heldUnits,
          reserved: reservedUnits,
          booked: bookedUnits,
          blocked: blockedUnits
        },
        pipeline: pipelineBreakdown,
        leadSources: sourcesBreakdown,
        recentBookings: bookings.slice(0, 5),
        recentActivities: (await db.collection('crm_activities').find({ companyId }).sort({ createdAt: -1 }).toArray()).slice(0, 10)
      });
    } catch (err: any) {
      console.error('Error in dashboard analytics:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 2. GET /api/crm/reports/salespersons - Sales team performance metrics
  router.get('/salespersons', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const [leads, bookings, visits] = await Promise.all([
        db.collection('crm_unit_interests').find({ companyId }).toArray(),
        db.collection('crm_bookings').find({ companyId, status: { $ne: 'Cancelled' } }).toArray(),
        db.collection('crm_site_visits').find({ companyId }).toArray()
      ]);

      const repStats: Record<string, any> = {};

      for (const l of leads) {
        const repId = l.assignedSalespersonId || 'unassigned';
        const repName = l.assignedSalespersonName || 'Unassigned';
        if (!repStats[repId]) {
          repStats[repId] = {
            id: repId,
            name: repName,
            leadsAssigned: 0,
            visitsConducted: 0,
            bookingsClosed: 0,
            totalBookingValue: 0
          };
        }
        repStats[repId].leadsAssigned++;
      }

      for (const v of visits) {
        const repId = v.assignedSalespersonId || 'unassigned';
        if (repStats[repId] && v.status === 'Completed') {
          repStats[repId].visitsConducted++;
        }
      }

      for (const b of bookings) {
        const repId = b.salespersonId || 'unassigned';
        if (!repStats[repId]) {
          repStats[repId] = {
            id: repId,
            name: b.salespersonName || 'Sales Rep',
            leadsAssigned: 0,
            visitsConducted: 0,
            bookingsClosed: 0,
            totalBookingValue: 0
          };
        }
        repStats[repId].bookingsClosed++;
        repStats[repId].totalBookingValue += roundCurrency(b.netBookingValue || b.agreementPrice);
      }

      const list = Object.values(repStats).map((r: any) => ({
        ...r,
        totalBookingValue: roundCurrency(r.totalBookingValue),
        conversionRatePercent: r.leadsAssigned > 0 ? roundCurrency((r.bookingsClosed / r.leadsAssigned) * 100) : 0
      }));

      res.json(list);
    } catch (err: any) {
      console.error('Error fetching salesperson stats:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
