import { Router } from 'express';
import { ObjectId } from 'mongodb';

export function createCrmSettingsRouter(getDb: () => any, authMiddleware: any) {
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

  const DEFAULT_SETTINGS = {
    leadSources: [
      'Website', 'Walk-in', 'Referral', 'Channel Partner', 'Social Media',
      'Digital Ads', 'Property Portal', 'Direct Call', 'Exhibition / Expo'
    ],
    pipelineStages: [
      { key: 'New', label: 'New Lead', order: 1 },
      { key: 'Contacted', label: 'Contacted', order: 2 },
      { key: 'Qualified', label: 'Qualified', order: 3 },
      { key: 'Visit Scheduled', label: 'Site Visit Scheduled', order: 4 },
      { key: 'Visited', label: 'Site Visit Completed', order: 5 },
      { key: 'Negotiation', label: 'Negotiation & Pricing', order: 6 },
      { key: 'Booked', label: 'Unit Booked', order: 7, isClosedWon: true },
      { key: 'Lost', label: 'Lost / Closed', order: 8, isClosedLost: true },
      { key: 'On Hold', label: 'Deferred / On Hold', order: 9 }
    ],
    lostReasons: [
      'Budget Out of Range',
      'Preferred Different Location',
      'Unit Layout / Facing Not Approved',
      'Purchased Competitor Project',
      'Loan Eligibility Rejected',
      'Postponed Decision (6+ Months)',
      'Unresponsive / Wrong Number',
      'Other'
    ],
    followUpTypes: [
      'Phone Call', 'WhatsApp Message', 'Email Update', 'Document Collection',
      'Site Visit Prep', 'Contract Review', 'Payment Follow-up'
    ],
    propertyTypes: [
      '1BHK Apartment', '2BHK Apartment', '3BHK Apartment', '4BHK Penthouse',
      'Duplex', 'Commercial Office', 'Retail Shop', 'Villa / Plot'
    ],
    defaultReservationHours: 48,
    milestoneTemplates: [
      { name: 'Booking Token Amount', percentage: 10 },
      { name: 'Agreement Signing (Within 30 Days)', percentage: 15 },
      { name: 'Plinth / Foundation Level', percentage: 15 },
      { name: 'Floor Slab Casting Level', percentage: 25 },
      { name: 'Finishing & Plaster Milestone', percentage: 20 },
      { name: 'Notice of Possession & Handover', percentage: 15 }
    ]
  };

  // GET /api/crm/settings - Get company CRM configurations
  router.get('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      let settings = await db.collection('crm_settings').findOne({ companyId });
      if (!settings) {
        settings = { companyId, ...DEFAULT_SETTINGS, updatedAt: new Date() };
        await db.collection('crm_settings').insertOne(settings);
      }

      res.json(settings);
    } catch (err: any) {
      console.error('Error fetching CRM settings:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // PUT /api/crm/settings - Update company CRM configurations
  router.put('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const updateDoc = {
        ...req.body,
        updatedAt: new Date()
      };
      delete updateDoc._id;
      delete updateDoc.companyId;

      await db.collection('crm_settings').updateOne(
        { companyId },
        { $set: updateDoc },
        { upsert: true }
      );

      const updated = await db.collection('crm_settings').findOne({ companyId });
      res.json(updated);
    } catch (err: any) {
      console.error('Error updating CRM settings:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
