import { Router } from 'express';
import { ObjectId } from 'mongodb';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { requireCrmRole } from './crm.security.service';
import { validateBody, updateLeadStageSchema, parsePagination } from './crm.validation';
import { normalizePhone, normalizeEmail } from './crm.reservation.service';
import { rupeesToPaise } from './crm.calculation.service';
import { getNextSequence, getNextSequenceBlock } from './crm.sequence.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

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
      } catch { }
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

      const projection = {
        _id: 1,
        customerId: 1,
        customerName: 1,
        customerPhone: 1,
        customerEmail: 1,
        projectId: 1,
        projectName: 1,
        stage: 1,
        leadSource: 1,
        preferredPropertyType: 1,
        interest: 1,
        unitCode: 1,
        budget: 1,
        budgetPaise: 1,
        priority: 1,
        assignedSalespersonId: 1,
        assignedSalespersonName: 1,
        assigned_to: 1,
        notes: 1,
        tags: 1,
        followup_count: 1,
        next_followup_at: 1,
        nextFollowUpDate: 1,
        last_contacted_at: 1,
        lastContactDate: 1,
        updatedAt: 1,
        createdAt: 1
      };

      let leads = await db.collection('crm_unit_interests').find(query, { projection }).sort({ updatedAt: -1 }).toArray();

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

  // 1B. POST /api/crm/leads - Create new lead with full fields & duplicate check
  router.post('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        name,
        phone,
        leadSource = 'Walk-in',
        projectId,
        stage = 'New enquiry',
        interestedIn = '2BHK',
        budget,
        nextFollowUpDate,
        email,
        tags = [],
        notes = '',
        purpose = 'self_use',
        loan_needed = false,
        preferred_floor = '',
        preferred_facing = '',
        assigned_to
      } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ message: 'Lead name and phone number are required.' });
      }

      const phoneNormalized = normalizePhone(phone);
      if (!phoneNormalized) {
        return res.status(400).json({ message: 'Invalid phone number format.' });
      }

      // Check if customer exists
      let customer = await db.collection('crm_customers').findOne({
        companyId,
        $or: [{ phoneNormalized }, { phone: phone.trim() }]
      });

      let custId: any;
      if (!customer) {
        const customerCode = await getNextSequence(db, companyId, 'customerCode');
        const newCustDoc = {
          companyId,
          customerCode,
          fullName: name.trim(),
          phone: phone.trim(),
          phoneNormalized,
          email: email ? email.trim() : '',
          leadSource,
          budgetMin: Number(budget) || 0,
          budgetMinPaise: rupeesToPaise(Number(budget) || 0),
          preferredPropertyType: interestedIn,
          assignedSalespersonId: assigned_to || req.user?.sub,
          assignedSalespersonName: req.user?.name || 'Sales Team',
          notes,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: req.user?.sub || 'system'
        };
        const insRes = await db.collection('crm_customers').insertOne(newCustDoc);
        custId = insRes.insertedId;
      } else {
        custId = customer._id;
      }

      // Get project name if passed
      let projectName = 'Selected Project';
      let projId: any = null;
      if (projectId) {
        projId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
        const prj = await db.collection('crm_projects').findOne({ _id: projId, companyId });
        if (prj) projectName = prj.name;
      }

      const budgetNum = Number(budget) || 0;
      const budgetPaiseNum = rupeesToPaise(budgetNum);
      const followUpDateObj = nextFollowUpDate ? new Date(nextFollowUpDate) : new Date();

      const newLeadDoc: any = {
        companyId,
        customerId: custId,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerPhoneNormalized: phoneNormalized,
        projectId: projId,
        projectName,
        stage: stage || 'New enquiry',
        leadSource,
        preferredPropertyType: interestedIn,
        interest: interestedIn,
        budget: budgetNum,
        budgetPaise: budgetPaiseNum,
        purpose,
        loan_needed: !!loan_needed,
        preferred_floor,
        preferred_facing,
        tags: Array.isArray(tags) ? tags : [],
        assigned_to: assigned_to || req.user?.sub,
        assignedSalespersonId: assigned_to || req.user?.sub,
        assignedSalespersonName: req.user?.name || 'Sales Team',
        notes,
        followup_count: 1,
        next_followup_at: followUpDateObj,
        nextFollowUpDate: followUpDateObj,
        last_contacted_at: new Date(),
        lastContactDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('crm_unit_interests').insertOne(newLeadDoc);
      newLeadDoc._id = result.insertedId;

      // Log activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: custId,
        unitInterestId: newLeadDoc._id,
        lead_id: newLeadDoc._id,
        activityType: 'Note',
        title: 'New Lead Created',
        description: `Lead added for ${projectName} (${interestedIn}) via ${leadSource}. Budget: ₹${budgetNum.toLocaleString('en-IN')}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      return res.status(201).json(newLeadDoc);
    } catch (err: any) {
      console.error('Error creating lead:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  // 1C. GET /api/crm/leads/pipeline/stages - Get configured stages
  router.get('/pipeline/stages', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.query;

      const q: any = { companyId };
      if (projectId) q.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;

      const config = await db.collection('crm_pipeline_stages').findOne(q);

      const DEFAULT_STAGES = [
        { id: 'new', name: 'New enquiry', order: 1, color: '#38bdf8', is_won: false, is_lost: false },
        { id: 'contacted', name: 'Contacted', order: 2, color: '#6366f1', is_won: false, is_lost: false },
        { id: 'site_visit', name: 'Site visit', order: 3, color: '#8b5cf6', is_won: false, is_lost: false },
        { id: 'negotiation', name: 'Negotiation', order: 4, color: '#f59e0b', is_won: false, is_lost: false },
        { id: 'hold', name: 'Hold', order: 5, color: '#eab308', is_won: false, is_lost: false },
        { id: 'booked', name: 'Booked', order: 6, color: '#16a34a', is_won: true, is_lost: false },
        { id: 'lost', name: 'Lost', order: 7, color: '#ef4444', is_won: false, is_lost: true }
      ];

      res.json(config?.stages || DEFAULT_STAGES);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 1D. PUT /api/crm/leads/pipeline/stages - Update stages
  router.put('/pipeline/stages', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, stages } = req.body;

      if (!Array.isArray(stages) || stages.length === 0) {
        return res.status(400).json({ message: 'Valid stages array is required.' });
      }

      const q: any = { companyId };
      if (projectId) q.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;

      await db.collection('crm_pipeline_stages').updateOne(
        q,
        {
          $set: {
            ...q,
            stages,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      res.json({ message: 'Stages updated successfully', stages });
    } catch (err: any) {
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
  router.put(
    '/:id/stage',
    authMiddleware,
    requireCrmRole('admin', 'sales_manager', 'sales_rep'),
    validateBody(updateLeadStageSchema),
    async (req: any, res) => {
      try {
        const db = getDb();
        const companyId = await resolveCompanyId(req, db);
        const leadId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
        const { stage, lostReason, notes } = req.body;

        if (stage === 'Lost' && (!lostReason || String(lostReason).trim().length < 2)) {
          return res.status(400).json({ message: 'A specific lost reason is mandatory when marking a lead as Lost.' });
        }

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

        if (logAudit) {
          await logAudit(db, {
            actorId: req.user?.sub,
            actorType: 'user',
            companyId,
            module: 'crm',
            action: 'LEAD_STAGE_CHANGED',
            resource: 'crm_unit_interests',
            resourceId: String(leadId),
            description: `Moved lead ${lead.customerName} (${lead.unitCode || lead.projectName}) from '${prevStage}' to '${stage}'`,
            before: { stage: prevStage },
            after: { stage, lostReason, notes }
          });
        }

        const updated = await db.collection('crm_unit_interests').findOne({ _id: leadId });
        res.json(updated);
      } catch (err: any) {
        console.error('Error updating lead stage:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );

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

  // 7. POST /api/crm/leads/:id/followup-result - Guided Follow-up Queue Outcome Logger
  router.post('/:id/followup-result', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const leadId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const {
        outcome,
        templateUsed,
        messageSent,
        newStage,
        nextFollowupDate,
        appointmentData,
        lostReason,
        lostReasonId,
        notes,
        noReplyDays = 3
      } = req.body;

      const lead = await db.collection('crm_unit_interests').findOne({ _id: leadId, companyId });
      if (!lead) return res.status(404).json({ message: 'Lead not found.' });

      const currentFollowupCount = Number(lead.followup_count || 1);
      const updateFields: any = {
        updatedAt: new Date(),
        last_contacted_at: new Date(),
        lastContactDate: new Date()
      };

      let activityTitle = 'Follow-up Action';
      let activityDesc = notes || '';
      let activityType = 'WhatsApp';

      if (outcome === 'no_reply') {
        const nextDate = new Date(Date.now() + Number(noReplyDays) * 24 * 3600 * 1000);
        updateFields.followup_count = currentFollowupCount + 1;
        updateFields.next_followup_at = nextDate;
        updateFields.nextFollowUpDate = nextDate;
        activityTitle = `Follow-up #${currentFollowupCount} Sent (No Reply Yet)`;
        activityDesc = `Message sent via WhatsApp. Follow-up #${currentFollowupCount + 1} scheduled for ${nextDate.toLocaleDateString('en-IN')}.${notes ? ` Notes: ${notes}` : ''}`;
      } else if (outcome === 'replied') {
        if (newStage) updateFields.stage = newStage;
        if (nextFollowupDate) {
          const nextDate = new Date(nextFollowupDate);
          updateFields.next_followup_at = nextDate;
          updateFields.nextFollowUpDate = nextDate;
        }
        activityTitle = 'Lead Replied';
        activityDesc = `Lead replied. Stage set to '${newStage || lead.stage}'.${notes ? ` Notes: ${notes}` : ''}`;
      } else if (outcome === 'site_visit') {
        updateFields.stage = 'Visit Scheduled';
        activityType = 'Site Visit';
        activityTitle = 'Site Walkthrough Scheduled';
        activityDesc = `Appointment scheduled for ${appointmentData?.start || 'upcoming date'}.${notes ? ` Notes: ${notes}` : ''}`;

        if (appointmentData?.start) {
          await db.collection('crm_appointments').insertOne({
            companyId,
            projectId: lead.projectId,
            leadId: lead._id,
            customerId: lead.customerId,
            customerName: lead.customerName,
            customerPhone: lead.customerPhone,
            type: 'site_visit',
            title: appointmentData.title || `Site Walkthrough - ${lead.customerName}`,
            start: new Date(appointmentData.start),
            end: appointmentData.end ? new Date(appointmentData.end) : new Date(new Date(appointmentData.start).getTime() + 3600000),
            location: appointmentData.location || 'Site Office',
            assignedTo: req.user?.sub || 'agent',
            assignedToName: req.user?.name || 'Sales Team',
            status: 'scheduled',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } else if (outcome === 'not_interested') {
        updateFields.stage = 'Lost';
        updateFields.lostReason = lostReason || 'Not Interested';
        updateFields.lost_reason_id = lostReasonId;
        activityType = 'Stage Change';
        activityTitle = 'Lead Marked as Lost';
        activityDesc = `Dropped from active pipeline. Reason: ${lostReason || 'Not Interested'}.${notes ? ` Notes: ${notes}` : ''}`;
      } else if (outcome === 'deal_won') {
        updateFields.stage = 'Negotiation';
        activityType = 'Booking Action';
        activityTitle = 'Deal Won - Initiating Booking Contract';
        activityDesc = `Lead accepted terms. Proceeding to unit reservation / booking.${notes ? ` Notes: ${notes}` : ''}`;
      }

      await db.collection('crm_unit_interests').updateOne(
        { _id: leadId, companyId },
        { $set: updateFields }
      );

      // Write activity timeline entry
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: lead.customerId,
        unitInterestId: leadId,
        lead_id: leadId,
        unitCode: lead.unitCode || '',
        activityType,
        title: activityTitle,
        description: activityDesc,
        payload: {
          outcome,
          templateUsed,
          messageSent,
          newStage,
          nextFollowupDate: updateFields.next_followup_at,
          followupCount: updateFields.followup_count || currentFollowupCount,
          appointmentData,
          lostReason
        },
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      const updated = await db.collection('crm_unit_interests').findOne({ _id: leadId });
      return res.json(updated);
    } catch (err: any) {
      console.error('Error logging followup outcome:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  // 8. GET /api/crm/leads/:id/timeline - Chronological timeline feed
  router.get('/:id/timeline', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const leadId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const lead = await db.collection('crm_unit_interests').findOne({ _id: leadId, companyId });
      if (!lead) return res.status(404).json({ message: 'Lead not found.' });

      const query: any = {
        companyId,
        $or: [
          { unitInterestId: leadId },
          { unitInterestId: String(leadId) },
          { lead_id: leadId },
          { lead_id: String(leadId) },
          ...(lead.customerId ? [{ customerId: lead.customerId }, { customerId: String(lead.customerId) }] : [])
        ]
      };

      const activities = await db.collection('crm_activities').find(query).sort({ createdAt: -1 }).toArray();
      return res.json({ timeline: activities });
    } catch (err: any) {
      console.error('Error fetching lead timeline:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 9. IMPORT LEADS PIPELINE (CSV, XLSX, XLS)
  // ══════════════════════════════════════════════════════════════════════════════

  // POST /api/crm/leads/import/upload - Parse uploaded spreadsheet/CSV file
  router.post('/import/upload', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep'), upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Please upload a CSV, XLSX, or XLS file.' });
      }

      const fileName = req.file.originalname || 'leads_import.csv';
      const ext = fileName.toLowerCase().split('.').pop();
      if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
        return res.status(400).json({ message: 'Invalid file format. Only CSV, XLSX, and XLS files are supported.' });
      }

      let headers: string[] = [];
      let rows: Record<string, any>[] = [];

      if (ext === 'xlsx' || ext === 'xls') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet || worksheet.rowCount === 0) {
          return res.status(400).json({ message: 'Uploaded Excel file is empty.' });
        }

        // Find header row (first non-empty row)
        let headerRowIndex = 1;
        worksheet.eachRow((row, rowNumber) => {
          if (headers.length === 0 && row.values && (row.values as any[]).length > 0) {
            headerRowIndex = rowNumber;
            const values = (row.values as any[]).slice(1); // ExcelJS values are 1-indexed
            headers = values.map(v => (v !== null && v !== undefined ? String(v).trim() : ''));
          }
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowIndex) return;
          const values = (row.values as any[]).slice(1);
          const rowObj: Record<string, any> = {};
          let hasContent = false;
          headers.forEach((h, idx) => {
            if (!h) return;
            const val = values[idx] !== undefined && values[idx] !== null ? String(values[idx]).trim() : '';
            rowObj[h] = val;
            if (val) hasContent = true;
          });
          if (hasContent) rows.push(rowObj);
        });
      } else {
        // Parse CSV
        let text = req.file.buffer.toString('utf-8');
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // Strip UTF-8 BOM
        const lines = text.split(/\r\n|\n|\r/).filter((l: string) => l.trim().length > 0);
        if (lines.length === 0) {
          return res.status(400).json({ message: 'Uploaded CSV file is empty.' });
        }

        const parseLine = (line: string): string[] => {
          const res: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              res.push(cur.trim());
              cur = '';
            } else {
              cur += ch;
            }
          }
          res.push(cur.trim());
          return res;
        };

        headers = parseLine(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          const vals = parseLine(lines[i]);
          const rowObj: Record<string, string> = {};
          let hasContent = false;
          headers.forEach((h, idx) => {
            const val = vals[idx] !== undefined ? vals[idx] : '';
            rowObj[h] = val;
            if (val) hasContent = true;
          });
          if (hasContent) rows.push(rowObj);
        }
      }

      // Auto-detect mappings based on header variations
      const detectedMapping: Record<string, string> = {};
      const autoMatch = (header: string): string => {
        const clean = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (['fullname', 'name', 'customername', 'leadname', 'clientname', 'contactname'].includes(clean)) return 'fullName';
        if (['firstname', 'fname', 'first'].includes(clean)) return 'firstName';
        if (['lastname', 'lname', 'surname', 'last'].includes(clean)) return 'lastName';
        if (['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'contactnumber', 'cell', 'tel'].includes(clean)) return 'phone';
        if (['altphone', 'alternatephone', 'altmob', 'alternatemobile', 'otherphone'].includes(clean)) return 'altPhone';
        if (['email', 'emailaddress', 'mail', 'emailid'].includes(clean)) return 'email';
        if (['company', 'companyname', 'organization', 'org'].includes(clean)) return 'companyName';
        if (['source', 'leadsource', 'campaign', 'channel', 'medium', 'sourcegroups', 'groups', 'sourcegroup'].includes(clean)) return 'leadSource';
        if (['totalgroups', 'totalgroup'].includes(clean)) return 'ignore';
        if (['leadid', 'id'].includes(clean)) return 'ignore';
        if (['project', 'projectname', 'property', 'interestedproject'].includes(clean)) return 'projectName';
        if (['unit', 'interestedunit', 'unitcode', 'configuration', 'interest', 'typology'].includes(clean)) return 'interestedUnit';
        if (['budget', 'price', 'investment', 'budgetrange', 'approxbudget'].includes(clean)) return 'budget';
        if (['status', 'leadstatus', 'stage', 'leadstage'].includes(clean)) return 'leadStatus';
        if (['assignedto', 'assignedemployee', 'agent', 'salesrep', 'executive'].includes(clean)) return 'assignedEmployee';
        if (['address', 'street', 'locality'].includes(clean)) return 'address';
        if (['city', 'town'].includes(clean)) return 'city';
        if (['state', 'province'].includes(clean)) return 'state';
        if (['notes', 'remarks', 'comments', 'description'].includes(clean)) return 'notes';
        if (['nextfollowup', 'nextfollowupdate', 'followupdate', 'followup'].includes(clean)) return 'nextFollowupDate';
        return '';
      };

      headers.forEach(h => {
        const matched = autoMatch(h);
        if (matched) detectedMapping[h] = matched;
      });

      return res.json({
        success: true,
        fileName,
        totalRows: rows.length,
        headers,
        previewRows: rows.slice(0, 15),
        rows,
        detectedMapping
      });
    } catch (err: any) {
      console.error('Error parsing import file:', err);
      return res.status(500).json({ message: 'Failed to process import file: ' + err.message });
    }
  });

  // POST /api/crm/leads/import/execute - Execute batch lead import with duplicate handling
  router.post('/import/execute', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        rows = [],
        mapping = {},
        duplicateStrategy = 'skip', // 'skip' | 'update' | 'new_only'
        projectId,
        fileName = 'Import_Batch'
      } = req.body;

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: 'No rows provided for import.' });
      }

      // Resolve target project if passed
      let projId: any = null;
      let projectName = 'General Project';
      if (projectId) {
        projId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
        const prj = await db.collection('crm_projects').findOne({ _id: projId, companyId });
        if (prj) projectName = prj.name;
      }

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let duplicateCount = 0;
      const errors: any[] = [];
      const seenPhonesInBatch = new Set<string>();
      const seenEmailsInBatch = new Set<string>();

      // Pre-extract normalized phones and emails from batch for O(1) in-memory lookup
      const allPhonesInBatch = new Set<string>();
      const allEmailsInBatch = new Set<string>();
      for (const rawRow of rows) {
        let p = '';
        let em = '';
        Object.entries(mapping).forEach(([fileCol, targetField]: [string, any]) => {
          if (targetField === 'phone' && rawRow[fileCol]) p = String(rawRow[fileCol]).trim();
          if (targetField === 'email' && rawRow[fileCol]) em = String(rawRow[fileCol]).trim().toLowerCase();
        });
        const pNorm = normalizePhone(p);
        if (pNorm && pNorm.length >= 10) allPhonesInBatch.add(pNorm);
        if (em) allEmailsInBatch.add(em);
      }

      const phoneArray = Array.from(allPhonesInBatch);
      const emailArray = Array.from(allEmailsInBatch);

      // Pre-fetch matching existing customers & leads in 2 batch queries
      const [existingCustList, existingLeadList] = await Promise.all([
        phoneArray.length > 0 || emailArray.length > 0
          ? db.collection('crm_customers').find({
            companyId,
            $or: [
              ...(phoneArray.length > 0 ? [{ phoneNormalized: { $in: phoneArray } }, { phone: { $in: phoneArray } }] : []),
              ...(emailArray.length > 0 ? [{ email: { $in: emailArray } }] : [])
            ]
          }).toArray()
          : [],
        phoneArray.length > 0
          ? db.collection('crm_unit_interests').find({
            companyId,
            $or: [
              { customerPhoneNormalized: { $in: phoneArray } },
              { customerPhone: { $in: phoneArray } }
            ]
          }).toArray()
          : []
      ]);

      const customerLookup = new Map<string, any>();
      existingCustList.forEach((c: any) => {
        if (c.phoneNormalized) customerLookup.set(c.phoneNormalized, c);
        if (c.phone) customerLookup.set(c.phone, c);
        if (c.email) customerLookup.set(c.email, c);
      });

      const leadLookup = new Map<string, any>();
      existingLeadList.forEach((l: any) => {
        if (l.customerPhoneNormalized) leadLookup.set(l.customerPhoneNormalized, l);
        if (l.customerPhone) leadLookup.set(l.customerPhone, l);
      });

      // Pre-reserve customer sequence numbers in one atomic database call
      const customerSeqBlock = await getNextSequenceBlock(db, companyId, 'customerCode', rows.length);

      // Batch insert containers for high-throughput insertion
      const customersToInsert: any[] = [];
      const leadsToInsert: any[] = [];
      const activitiesToInsert: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i];
        const rowNumber = i + 1;

        // Map fields according to mapping dictionary
        const record: Record<string, string> = {};
        Object.entries(mapping).forEach(([fileCol, targetField]: [string, any]) => {
          if (targetField && targetField !== 'ignore') {
            record[targetField] = rawRow[fileCol] !== undefined ? String(rawRow[fileCol]).trim() : '';
          }
        });

        // Resolve Name (Full Name or First + Last)
        let name = record.fullName || '';
        if (!name && (record.firstName || record.lastName)) {
          name = `${record.firstName || ''} ${record.lastName || ''}`.trim();
        }
        // Clean leading ~ or formatting from WhatsApp exports
        name = name.replace(/^[~\s]+/, '').trim() || name.trim();

        const phone = record.phone || '';
        const altPhone = record.altPhone || '';
        const email = record.email || '';
        const budgetRaw = record.budget || '';
        const leadSource = record.leadSource || 'CSV Import';
        let stage = record.leadStatus || 'New';
        if (stage.toLowerCase() === 'new' || stage.toLowerCase() === 'new enquiry') {
          stage = 'New';
        }
        const interestedUnit = record.interestedUnit || 'Residential Unit';
        const assignedEmployee = record.assignedEmployee || req.user?.name || 'Sales Team';
        const notes = record.notes || '';
        const nextFollowupDate = record.nextFollowupDate ? new Date(record.nextFollowupDate) : new Date();

        // 1. Validate required identity fields
        if (!name) {
          errors.push({
            rowNumber,
            data: rawRow,
            reason: 'Missing required field: Full Name / First Name',
            correction: 'Provide customer name.'
          });
          continue;
        }

        const phoneNormalized = normalizePhone(phone);
        if (!phoneNormalized || phoneNormalized.length < 10) {
          errors.push({
            rowNumber,
            data: rawRow,
            reason: `Invalid phone number format: '${phone}'`,
            correction: 'Provide valid phone number (minimum 10 digits).'
          });
          continue;
        }

        const normEmail = normalizeEmail(email);

        // 2. Intra-file duplicate detection
        if (seenPhonesInBatch.has(phoneNormalized)) {
          duplicateCount++;
          if (duplicateStrategy === 'skip' || duplicateStrategy === 'new_only') {
            skippedCount++;
            errors.push({
              rowNumber,
              data: rawRow,
              reason: `Duplicate phone within the same import file: ${phone}`,
              correction: 'Duplicate phone already processed earlier in this file.'
            });
            continue;
          }
        }
        seenPhonesInBatch.add(phoneNormalized);
        if (normEmail) seenEmailsInBatch.add(normEmail);

        // 3. Database duplicate detection via in-memory lookup
        const existingCustomer = customerLookup.get(phoneNormalized) || customerLookup.get(phone) || (normEmail ? customerLookup.get(normEmail) : null);
        const existingLead = leadLookup.get(phoneNormalized) || leadLookup.get(phone);
        const isExisting = !!(existingCustomer || existingLead);

        if (isExisting) {
          duplicateCount++;
          if (duplicateStrategy === 'skip') {
            skippedCount++;
            errors.push({
              rowNumber,
              data: rawRow,
              reason: `Existing customer / lead already exists in CRM (Phone: ${phone})`,
              correction: 'Skipped according to duplicate strategy.'
            });
            continue;
          } else if (duplicateStrategy === 'new_only') {
            skippedCount++;
            errors.push({
              rowNumber,
              data: rawRow,
              reason: `Existing customer found (Strategy: Import new leads only)`,
              correction: 'Skipped to protect existing lead record.'
            });
            continue;
          } else if (duplicateStrategy === 'update') {
            const updateFields: any = {
              updatedAt: new Date()
            };
            if (notes) updateFields.notes = notes;
            if (budgetRaw) {
              const bNum = Number(budgetRaw.replace(/[^0-9.]/g, '')) || 0;
              updateFields.budget = bNum;
              updateFields.budgetPaise = rupeesToPaise(bNum);
            }
            if (stage && stage !== 'New') updateFields.stage = stage;
            if (interestedUnit) updateFields.interest = interestedUnit;

            if (existingLead) {
              await db.collection('crm_unit_interests').updateOne(
                { _id: existingLead._id },
                { $set: updateFields }
              );
            }
            updatedCount++;
            continue;
          }
        }

        // 4. Create new customer document
        let custId: any;
        if (!existingCustomer) {
          const customerCode = customerSeqBlock.getNext();
          const bNum = Number(budgetRaw.replace(/[^0-9.]/g, '')) || 0;
          const newCustDoc = {
            _id: new ObjectId(),
            companyId,
            customerCode,
            fullName: name.trim(),
            phone: phone.trim(),
            phoneNormalized,
            altPhone: altPhone.trim(),
            altPhoneNormalized: normalizePhone(altPhone),
            email: normEmail,
            companyName: record.companyName || '',
            address: record.address || '',
            city: record.city || '',
            state: record.state || '',
            leadSource,
            budgetMin: bNum,
            budgetMinPaise: rupeesToPaise(bNum),
            preferredPropertyType: interestedUnit,
            assignedSalespersonId: req.user?.sub || 'system',
            assignedSalespersonName: assignedEmployee,
            notes,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: req.user?.sub || 'system'
          };
          customersToInsert.push(newCustDoc);
          customerLookup.set(phoneNormalized, newCustDoc);
          custId = newCustDoc._id;
        } else {
          custId = existingCustomer._id;
        }

        // 5. Create new lead in crm_unit_interests
        const bNum = Number(budgetRaw.replace(/[^0-9.]/g, '')) || 0;
        const newLeadDoc = {
          _id: new ObjectId(),
          companyId,
          customerId: custId,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerPhoneNormalized: phoneNormalized,
          customerEmail: normEmail,
          projectId: projId,
          projectName: record.project || record.projectName || projectName,
          stage,
          leadSource,
          preferredPropertyType: interestedUnit,
          interest: interestedUnit,
          unitCode: record.interestedUnit || '',
          budget: bNum,
          budgetPaise: rupeesToPaise(bNum),
          assigned_to: req.user?.sub,
          assignedSalespersonId: req.user?.sub,
          assignedSalespersonName: assignedEmployee,
          notes,
          followup_count: 1,
          next_followup_at: nextFollowupDate,
          nextFollowUpDate: nextFollowupDate,
          last_contacted_at: new Date(),
          lastContactDate: new Date(),
          importBatch: fileName,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        leadsToInsert.push(newLeadDoc);
        leadLookup.set(phoneNormalized, newLeadDoc);

        // 6. Record activity in crm_activities
        activitiesToInsert.push({
          companyId,
          customerId: custId,
          unitInterestId: newLeadDoc._id,
          lead_id: newLeadDoc._id,
          activityType: 'Note',
          title: 'Lead Imported via File',
          description: `Imported from ${fileName}. Assigned to ${assignedEmployee}. Source: ${leadSource}.`,
          performedBy: req.user?.sub || 'system',
          performedByName: req.user?.name || 'Import Pipeline',
          createdAt: new Date()
        });

        createdCount++;
      }

      // Bulk insert in chunks of 500 for optimal network & MongoDB throughput
      const CHUNK_SIZE = 500;
      for (let c = 0; c < customersToInsert.length; c += CHUNK_SIZE) {
        await db.collection('crm_customers').insertMany(customersToInsert.slice(c, c + CHUNK_SIZE));
      }
      for (let l = 0; l < leadsToInsert.length; l += CHUNK_SIZE) {
        await db.collection('crm_unit_interests').insertMany(leadsToInsert.slice(l, l + CHUNK_SIZE));
      }
      for (let a = 0; a < activitiesToInsert.length; a += CHUNK_SIZE) {
        await db.collection('crm_activities').insertMany(activitiesToInsert.slice(a, a + CHUNK_SIZE));
      }

      // Record batch summary in crm_import_history
      const historyRecord = {
        companyId,
        projectId: projId,
        fileName,
        importedBy: req.user?.name || req.user?.email || 'User',
        importedById: req.user?.sub,
        importedAt: new Date(),
        totalRecords: rows.length,
        successfullyCreated: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        duplicate: duplicateCount,
        failed: errors.length,
        duplicateStrategy,
        errors: errors.slice(0, 100)
      };

      await db.collection('crm_import_history').insertOne(historyRecord);

      return res.json({
        success: true,
        message: `Import completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} errors.`,
        total: rows.length,
        createdCount,
        updatedCount,
        skippedCount,
        duplicateCount,
        failedCount: errors.length,
        errors
      });
    } catch (err: any) {
      console.error('Error executing lead import:', err);
      return res.status(500).json({ message: 'Lead import execution failed: ' + err.message });
    }
  });

  // GET /api/crm/leads/import/history - List past import batches
  router.get('/import/history', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const history = await db.collection('crm_import_history')
        .find({ companyId })
        .sort({ importedAt: -1 })
        .limit(50)
        .toArray();
      return res.json(history);
    } catch (err: any) {
      console.error('Error fetching import history:', err);
      return res.status(500).json({ message: 'Failed to fetch import history', error: err.message });
    }
  });

  // GET /api/crm/leads/import/sample-template - Download standard sample CSV
  router.get('/import/sample-template', (req: any, res) => {
    const csvContent = [
      'Full Name,Phone,Email,Company Name,Lead Source,Project,Interested Unit,Budget,Lead Status,Assigned Employee,City,Notes,Next Follow-up Date',
      'Rajesh Kumar,9876543210,rajesh.kumar@example.com,Kumar Enterprises,MagicBricks,Dashtech,Tower A - 3BHK,8500000,New enquiry,Sales Team,Mumbai,Looking for 3BHK with parking and sea facing view.,2026-11-20',
      'Priya Sharma,9823456789,priya.s@example.com,Tech Solutions,Website Inbound,Dashtech,Tower B - 2BHK,6500000,Qualified,Sales Team,Pune,Requested weekend site visit walkthrough.,2026-11-22'
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="crm_leads_sample_template.csv"');
    return res.send(csvContent);
  });

  return router;
}
