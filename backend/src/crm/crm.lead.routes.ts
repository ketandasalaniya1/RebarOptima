import { Router } from 'express';
import { ObjectId } from 'mongodb';

export function createCrmLeadRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
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

  // 1. GET /api/crm/leads - Search & filter unit-interest pipeline
  router.get('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { stage, projectId, salespersonId, priority, search } = req.query;

      const query: any = { companyId };
      if (stage && stage !== 'all') {
        query.stage = stage;
      }
      if (projectId) {
        query.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }
      if (salespersonId) {
        query.assignedSalespersonId = salespersonId;
      }
      if (priority) {
        query.priority = priority;
      }

      let leads = await db.collection('crm_unit_interests').find(query).sort({ updatedAt: -1 }).toArray();

      if (search) {
        const term = String(search).toLowerCase().trim();
        leads = leads.filter((l: any) =>
          (l.customerName && l.customerName.toLowerCase().includes(term)) ||
          (l.customerPhone && l.customerPhone.includes(term)) ||
          (l.projectName && l.projectName.toLowerCase().includes(term)) ||
          (l.unitCode && l.unitCode.toLowerCase().includes(term))
        );
      }

      res.json(leads);
    } catch (err: any) {
      console.error('Error fetching leads:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 2. GET /api/crm/leads/pipeline-stats - Aggregate lead counts by pipeline stage
  router.get('/pipeline-stats', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.query;

      const query: any = { companyId };
      if (projectId) {
        query.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }

      const allLeads = await db.collection('crm_unit_interests').find(query).toArray();

      const STAGES = [
        'New',
        'Contacted',
        'Qualified',
        'Visit Scheduled',
        'Visited',
        'Negotiation',
        'Booked',
        'Lost',
        'On Hold'
      ];

      const stageCounts: Record<string, { count: number; totalBudget: number; leads: any[] }> = {};
      STAGES.forEach(s => {
        stageCounts[s] = { count: 0, totalBudget: 0, leads: [] };
      });

      for (const lead of allLeads) {
        const st = lead.stage || 'New';
        if (!stageCounts[st]) {
          stageCounts[st] = { count: 0, totalBudget: 0, leads: [] };
        }
        stageCounts[st].count++;
        stageCounts[st].totalBudget += Number(lead.budget) || 0;
        stageCounts[st].leads.push(lead);
      }

      res.json({
        totalLeads: allLeads.length,
        stages: stageCounts
      });
    } catch (err: any) {
      console.error('Error fetching pipeline stats:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 3. GET /api/crm/leads/:id - Single lead detail with customer timeline
  router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const leadId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const lead = await db.collection('crm_unit_interests').findOne({ _id: leadId, companyId });
      if (!lead) return res.status(404).json({ message: 'Lead interest not found.' });

      const [customer, activities, followUps, visits] = await Promise.all([
        db.collection('crm_customers').findOne({ _id: lead.customerId, companyId }),
        db.collection('crm_activities').find({
          $or: [{ unitInterestId: leadId }, { customerId: lead.customerId }],
          companyId
        }).sort({ createdAt: -1 }).toArray(),
        db.collection('crm_follow_ups').find({
          $or: [{ unitInterestId: leadId }, { customerId: lead.customerId }],
          companyId
        }).sort({ dueDateTime: 1 }).toArray(),
        db.collection('crm_site_visits').find({
          $or: [{ unitInterestId: leadId }, { customerId: lead.customerId }],
          companyId
        }).sort({ visitDateTime: -1 }).toArray()
      ]);

      res.json({
        lead,
        customer,
        activities,
        followUps,
        siteVisits: visits
      });
    } catch (err: any) {
      console.error('Error fetching lead detail:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 4. PUT /api/crm/leads/:id/stage - Update stage of specific lead interest
  // IMPORTANT: Changes only this interest, never modifies other customer interests!
  router.put('/:id/stage', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const leadId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { stage, lostReason, notes } = req.body;

      if (!stage) return res.status(400).json({ message: 'Target stage is required.' });

      const lead = await db.collection('crm_unit_interests').findOne({ _id: leadId, companyId });
      if (!lead) return res.status(404).json({ message: 'Lead not found.' });

      const prevStage = lead.stage;
      const updateData: any = {
        stage,
        updatedAt: new Date(),
        lastContactDate: new Date()
      };

      if (stage === 'Lost' && lostReason) {
        updateData.lostReason = lostReason;
      }
      if (notes) {
        updateData.notes = notes;
      }

      await db.collection('crm_unit_interests').updateOne(
        { _id: leadId, companyId },
        { $set: updateData }
      );

      // Record stage transition activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: lead.customerId,
        unitInterestId: leadId,
        unitCode: lead.unitCode || '',
        activityType: 'Stage Change',
        title: `Pipeline Stage Changed to ${stage}`,
        description: `Stage moved from '${prevStage}' to '${stage}' for ${lead.projectName}${lead.unitCode ? ` (Unit ${lead.unitCode})` : ''}.${notes ? ` Notes: ${notes}` : ''}`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        metadata: { fromStage: prevStage, toStage: stage, lostReason },
        createdAt: new Date()
      });

      const updated = await db.collection('crm_unit_interests').findOne({ _id: leadId });
      res.json(updated);
    } catch (err: any) {
      console.error('Error updating lead stage:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 5. POST /api/crm/leads/:id/activities - Record call, email, WhatsApp or note
  router.post('/:id/activities', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const leadId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { activityType = 'Call', title, description } = req.body;

      if (!title) return res.status(400).json({ message: 'Activity title is required.' });

      const lead = await db.collection('crm_unit_interests').findOne({ _id: leadId, companyId });
      if (!lead) return res.status(404).json({ message: 'Lead not found.' });

      const newActivity = {
        companyId,
        customerId: lead.customerId,
        unitInterestId: leadId,
        unitCode: lead.unitCode || '',
        activityType,
        title,
        description: description || '',
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      };

      const result = await db.collection('crm_activities').insertOne(newActivity);

      // Also update lastContactDate on lead
      await db.collection('crm_unit_interests').updateOne(
        { _id: leadId, companyId },
        { $set: { lastContactDate: new Date(), updatedAt: new Date() } }
      );

      res.status(201).json({ _id: result.insertedId, ...newActivity });
    } catch (err: any) {
      console.error('Error adding activity:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // 6. PUT /api/crm/leads/:id/assign - Reassign lead to another salesperson
  router.put('/:id/assign', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const leadId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { salespersonId, salespersonName } = req.body;

      if (!salespersonId) return res.status(400).json({ message: 'Salesperson ID is required.' });

      const lead = await db.collection('crm_unit_interests').findOne({ _id: leadId, companyId });
      if (!lead) return res.status(404).json({ message: 'Lead not found.' });

      await db.collection('crm_unit_interests').updateOne(
        { _id: leadId, companyId },
        {
          $set: {
            assignedSalespersonId: salespersonId,
            assignedSalespersonName: salespersonName || 'Sales Executive',
            updatedAt: new Date()
          }
        }
      );

      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: lead.customerId,
        unitInterestId: leadId,
        activityType: 'Note',
        title: 'Lead Reassigned',
        description: `Lead reassigned to ${salespersonName || 'new salesperson'}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      const updated = await db.collection('crm_unit_interests').findOne({ _id: leadId });
      res.json(updated);
    } catch (err: any) {
      console.error('Error reassigning lead:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
