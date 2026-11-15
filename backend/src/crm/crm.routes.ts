import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { createCrmCustomerRouter } from './crm.customer.routes';
import { createCrmProjectUnitRouter } from './crm.project-unit.routes';
import { createCrmLeadRouter } from './crm.lead.routes';
import { createCrmVisitTaskRouter } from './crm.visit-task.routes';
import { createCrmBookingRouter } from './crm.booking.routes';
import { createCrmPaymentRouter } from './crm.payment.routes';
import { createCrmReportRouter } from './crm.report.routes';
import { createCrmSettingsRouter } from './crm.settings.routes';
import { createCrmTodayRouter } from './crm.today.routes';
import { createCrmTemplateRouter } from './crm.template.routes';
import { seedCrmSampleData } from './crm.seed.service';
import { ensureCrmIndexes } from './crm.sequence.service';
import { startCrmScheduler } from './crm.scheduler';

let crmInitialized = false;

export function createCrmMasterRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
  const router = Router();

  // Lazy startup initialization (Indexes & Hold-expiry background worker)
  setTimeout(() => {
    try {
      if (!crmInitialized) {
        const db = getDb();
        if (db) {
          ensureCrmIndexes(db).catch(() => {});
          startCrmScheduler(getDb);
          crmInitialized = true;
        }
      }
    } catch {}
  }, 1000);

  // Sub-routers mounted under master /api/crm
  router.use('/customers', createCrmCustomerRouter(getDb, authMiddleware, logAudit));
  router.use('/', createCrmProjectUnitRouter(getDb, authMiddleware, logAudit));
  router.use('/leads', createCrmLeadRouter(getDb, authMiddleware, logAudit));
  router.use('/', createCrmVisitTaskRouter(getDb, authMiddleware, logAudit));
  router.use('/bookings', createCrmBookingRouter(getDb, authMiddleware, logAudit));
  router.use('/payments', createCrmPaymentRouter(getDb, authMiddleware, logAudit));
  router.use('/reports', createCrmReportRouter(getDb, authMiddleware));
  router.use('/settings', createCrmSettingsRouter(getDb, authMiddleware));
  router.use('/templates', createCrmTemplateRouter(getDb, authMiddleware, logAudit));
  router.use('/', createCrmTodayRouter(getDb, authMiddleware, logAudit));

  // Global search across CRM (Customers, Units, Projects, Bookings)
  router.get('/search', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const term = String(req.query.q || '').trim().toLowerCase();
      if (!term || term.length < 2) {
        return res.json({ customers: [], units: [], bookings: [], projects: [] });
      }

      let companyId: any = req.user?.companyId;
      if (!companyId && req.user?.sub) {
        const u = await db.collection('users').findOne({ _id: ObjectId.isValid(req.user.sub) ? new ObjectId(req.user.sub) : req.user.sub });
        if (u) companyId = u.companyId;
      }
      companyId = companyId && ObjectId.isValid(companyId) ? new ObjectId(companyId) : (companyId || 'default-company');

      const [customers, units, bookings, projects] = await Promise.all([
        db.collection('crm_customers').find({ companyId }).toArray(),
        db.collection('crm_units').find({ companyId }).toArray(),
        db.collection('crm_bookings').find({ companyId }).toArray(),
        db.collection('crm_projects').find({ companyId }).toArray()
      ]);

      const matchedCust = customers.filter((c: any) =>
        (c.fullName && c.fullName.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term)) ||
        (c.phoneNormalized && c.phoneNormalized.includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.customerCode && c.customerCode.toLowerCase().includes(term))
      ).slice(0, 5).map(({ encryptedPan, encryptedAadhaar, ...safe }: any) => safe);

      const matchedUnits = units.filter((u: any) =>
        (u.unitCode && u.unitCode.toLowerCase().includes(term)) ||
        (u.projectName && u.projectName.toLowerCase().includes(term))
      ).slice(0, 5);

      const matchedBookings = bookings.filter((b: any) =>
        (b.bookingReference && b.bookingReference.toLowerCase().includes(term)) ||
        (b.customerName && b.customerName.toLowerCase().includes(term)) ||
        (b.unitCode && b.unitCode.toLowerCase().includes(term))
      ).slice(0, 5);

      const matchedProjects = projects.filter((p: any) =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.projectCode && p.projectCode.toLowerCase().includes(term))
      ).slice(0, 5);

      res.json({
        customers: matchedCust,
        units: matchedUnits,
        bookings: matchedBookings,
        projects: matchedProjects
      });
    } catch (err: any) {
      console.error('Error in global CRM search:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // Seed sample enterprise CRM data (guarded by ENABLE_CRM_SEED and admin role)
  router.post('/seed-sample-data', authMiddleware, async (req: any, res) => {
    try {
      if (process.env.ENABLE_CRM_SEED !== 'true') {
        return res.status(403).json({
          message: 'Sample CRM data seeding is disabled in production. Set ENABLE_CRM_SEED=true in backend environment to enable.'
        });
      }

      const userRole = (req.user?.role || req.user?.crmRole || '').toLowerCase();
      if (userRole !== 'admin' && !req.user?.isAdmin && userRole !== 'superadmin') {
        return res.status(403).json({
          message: 'Access denied: Only administrators are authorized to run sample data seeding.'
        });
      }

      const db = getDb();
      let companyId: any = req.user?.companyId;
      if (!companyId && req.user?.sub) {
        const u = await db.collection('users').findOne({ _id: ObjectId.isValid(req.user.sub) ? new ObjectId(req.user.sub) : req.user.sub });
        if (u) companyId = u.companyId;
      }
      companyId = companyId && ObjectId.isValid(companyId) ? new ObjectId(companyId) : (companyId || 'default-company');

      const seedResult = await seedCrmSampleData(db, companyId, req.user?.sub);
      res.json(seedResult);
    } catch (err: any) {
      console.error('Error seeding CRM sample data:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
