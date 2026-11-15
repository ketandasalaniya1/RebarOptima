import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { requireCrmRole } from './crm.security.service';
import { parsePagination, crmRateLimiter } from './crm.validation';

export function createCrmVisitTaskRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
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

  // ── SITE VISITS ──────────────────────────────────────────────────────────

  // GET /api/crm/visits - List site visits
  router.get('/visits', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { status, salespersonId, projectId, date } = req.query;

      const query: any = { companyId };
      if (status) query.status = status;
      if (salespersonId) query.assignedSalespersonId = salespersonId;
      if (projectId) query.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;

      if (req.crmRole === 'sales_rep' && req.user?.sub) {
        query.assignedSalespersonId = req.user.sub;
      }

      let visits = await db.collection('crm_site_visits').find(query).sort({ visitDateTime: 1 }).toArray();

      if (date) {
        const targetDate = String(date).split('T')[0];
        visits = visits.filter((v: any) => String(v.visitDateTime).startsWith(targetDate));
      }

      res.json(visits);
    } catch (err: any) {
      console.error('Error fetching site visits:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/crm/visits - Schedule a site visit
  router.post('/visits', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        customerId,
        unitInterestId,
        projectId,
        unitId,
        unitCode,
        visitDateTime,
        assignedSalespersonId,
        assignedSalespersonName,
        notes
      } = req.body;

      if (!customerId || !projectId || !visitDateTime) {
        return res.status(400).json({ message: 'Customer, project, and visit date/time are required.' });
      }

      const custId = ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId;
      const prjId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      const customer = await db.collection('crm_customers').findOne({ _id: custId, companyId });
      const project = (await db.collection('projects').findOne({ _id: prjId }))
        || (ObjectId.isValid(prjId) ? await db.collection('projects').findOne({ _id: new ObjectId(prjId) }) : null)
        || (await db.collection('crm_projects').findOne({ _id: prjId, companyId }));

      if (!customer) return res.status(404).json({ message: 'Customer not found.' });

      const newVisit: any = {
        companyId,
        customerId: custId,
        customerName: customer.fullName,
        unitInterestId: unitInterestId ? (ObjectId.isValid(unitInterestId) ? new ObjectId(unitInterestId) : unitInterestId) : null,
        projectId: prjId,
        projectName: project?.name || 'Site Project',
        unitId: unitId ? (ObjectId.isValid(unitId) ? new ObjectId(unitId) : unitId) : null,
        unitCode: unitCode || '',
        visitDateTime: new Date(visitDateTime),
        assignedSalespersonId: assignedSalespersonId || customer.assignedSalespersonId || req.user?.sub,
        assignedSalespersonName: assignedSalespersonName || customer.assignedSalespersonName || req.user?.name || 'Sales Rep',
        status: 'Scheduled',
        notes: notes || '',
        outcome: '',
        nextAction: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('crm_site_visits').insertOne(newVisit);

      // If tied to a unit interest, update stage to 'Visit Scheduled'
      if (unitInterestId) {
        await db.collection('crm_unit_interests').updateOne(
          { _id: ObjectId.isValid(unitInterestId) ? new ObjectId(unitInterestId) : unitInterestId, companyId },
          { $set: { stage: 'Visit Scheduled', updatedAt: new Date() } }
        );
      }

      // Record activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: custId,
        unitInterestId: newVisit.unitInterestId,
        unitCode: unitCode || '',
        activityType: 'Site Visit',
        title: 'Site Visit Scheduled',
        description: `Visit scheduled at ${project?.name} on ${new Date(visitDateTime).toLocaleString()}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      res.status(201).json({ _id: result.insertedId, ...newVisit });
    } catch (err: any) {
      console.error('Error scheduling site visit:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // PUT /api/crm/visits/:id/status - Update site visit status & outcome
  router.put('/visits/:id/status', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const vId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { status, outcome, nextAction, rescheduleDateTime, notes } = req.body;

      if (!status) return res.status(400).json({ message: 'Visit status is required.' });

      const visit = await db.collection('crm_site_visits').findOne({ _id: vId, companyId });
      if (!visit) return res.status(404).json({ message: 'Site visit not found.' });

      const updateData: any = { status, updatedAt: new Date() };
      if (outcome) updateData.outcome = outcome;
      if (nextAction) updateData.nextAction = nextAction;
      if (notes) updateData.notes = notes;
      if (status === 'Rescheduled' && rescheduleDateTime) {
        updateData.visitDateTime = new Date(rescheduleDateTime);
      }

      await db.collection('crm_site_visits').updateOne(
        { _id: vId, companyId },
        { $set: updateData }
      );

      // If visit completed and tied to a unit interest, advance stage to 'Visited'
      if (status === 'Completed' && visit.unitInterestId) {
        await db.collection('crm_unit_interests').updateOne(
          { _id: visit.unitInterestId, companyId },
          { $set: { stage: 'Visited', lastContactDate: new Date(), updatedAt: new Date() } }
        );
      }

      // Record activity
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: visit.customerId,
        unitInterestId: visit.unitInterestId,
        unitCode: visit.unitCode || '',
        activityType: 'Site Visit',
        title: `Site Visit: ${status}`,
        description: `Visit marked as '${status}'. Outcome: ${outcome || 'N/A'}. Next action: ${nextAction || 'None'}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      const updated = await db.collection('crm_site_visits').findOne({ _id: vId });
      res.json(updated);
    } catch (err: any) {
      console.error('Error updating site visit:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // ── FOLLOW-UP TASKS ──────────────────────────────────────────────────────

  // GET /api/crm/tasks - List follow-up tasks with filter for today, overdue, upcoming
  router.get('/tasks', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { filter, assignedTo, priority } = req.query;

      const query: any = { companyId };
      if (assignedTo) {
        query.$or = [{ assignedTo: assignedTo }, { assignedToId: assignedTo }];
      }
      if (priority) query.priority = priority;

      if (req.crmRole === 'sales_rep' && req.user?.sub) {
        query.$or = [{ assignedTo: req.user.sub }, { assignedToId: req.user.sub }];
      }

      const tasks = await db.collection('crm_follow_ups').find(query).sort({ dueDateTime: 1 }).toArray();

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const enriched = tasks.map((t: any) => {
        const dueDate = new Date(t.dueDateTime);
        const isCompleted = t.status === 'Completed';
        const isOverdue = !isCompleted && dueDate < now;
        const isDueToday = !isCompleted && dueDate >= startOfToday && dueDate <= endOfToday;

        return {
          ...t,
          isOverdue,
          isDueToday
        };
      });

      if (filter === 'today') {
        return res.json(enriched.filter(t => t.isDueToday));
      }
      if (filter === 'overdue') {
        return res.json(enriched.filter(t => t.isOverdue));
      }
      if (filter === 'pending') {
        return res.json(enriched.filter(t => t.status !== 'Completed'));
      }
      if (filter === 'completed') {
        return res.json(enriched.filter(t => t.status === 'Completed'));
      }

      res.json(enriched);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/crm/tasks - Create follow-up task
  router.post('/tasks', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        customerId,
        unitInterestId,
        leadId,
        bookingId,
        unitId,
        title,
        dueDateTime,
        priority = 'Medium',
        taskType = 'Phone Call',
        status = 'Pending',
        repeat_rule = 'none',
        reminder_at,
        checklist = [],
        assignedTo,
        assignedToName,
        notes
      } = req.body;

      if (!title || !dueDateTime) {
        return res.status(400).json({ message: 'Task title and due date/time are required.' });
      }

      let customerName = '';
      let custId = null;
      if (customerId) {
        custId = ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId;
        const customer = await db.collection('crm_customers').findOne({ _id: custId, companyId });
        if (customer) customerName = customer.fullName;
      }

      const newTask: any = {
        companyId,
        customerId: custId,
        customerName: customerName || req.body.customerName || '',
        unitInterestId: unitInterestId ? (ObjectId.isValid(unitInterestId) ? new ObjectId(unitInterestId) : unitInterestId) : (leadId ? (ObjectId.isValid(leadId) ? new ObjectId(leadId) : leadId) : null),
        leadId: leadId ? (ObjectId.isValid(leadId) ? new ObjectId(leadId) : leadId) : null,
        bookingId: bookingId ? (ObjectId.isValid(bookingId) ? new ObjectId(bookingId) : bookingId) : null,
        unitId: unitId ? (ObjectId.isValid(unitId) ? new ObjectId(unitId) : unitId) : null,
        title: title.trim(),
        dueDateTime: new Date(dueDateTime),
        priority,
        taskType,
        status,
        repeat_rule,
        reminder_at: reminder_at ? new Date(reminder_at) : null,
        checklist: Array.isArray(checklist) ? checklist : [],
        assignedTo: assignedTo || req.user?.sub,
        assignedToId: assignedTo || req.user?.sub,
        assignedToName: assignedToName || req.user?.name || 'Sales Rep',
        notes: notes || '',
        completedAt: null,
        completedBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('crm_follow_ups').insertOne(newTask);

      // Update nextFollowUpDate on unit interest if applicable
      const targetLeadId = newTask.unitInterestId || newTask.leadId;
      if (targetLeadId) {
        await db.collection('crm_unit_interests').updateOne(
          { _id: ObjectId.isValid(targetLeadId) ? new ObjectId(targetLeadId) : targetLeadId, companyId },
          { $set: { nextFollowUpDate: dueDateTime, next_followup_at: dueDateTime, updatedAt: new Date() } }
        );
      }

      res.status(201).json({ _id: result.insertedId, ...newTask });
    } catch (err: any) {
      console.error('Error creating follow-up task:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // PUT /api/crm/tasks/:id - Full update of task
  router.put('/tasks/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const tId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { title, priority, status, dueDateTime, reminder_at, repeat_rule, checklist, notes } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (title) updateData.title = title.trim();
      if (priority) updateData.priority = priority;
      if (status) {
        updateData.status = status;
        if (status === 'Completed') {
          updateData.completedAt = new Date();
          updateData.completedBy = req.user?.name || 'User';
        }
      }
      if (dueDateTime) updateData.dueDateTime = new Date(dueDateTime);
      if (reminder_at !== undefined) updateData.reminder_at = reminder_at ? new Date(reminder_at) : null;
      if (repeat_rule) updateData.repeat_rule = repeat_rule;
      if (checklist) updateData.checklist = checklist;
      if (notes !== undefined) updateData.notes = notes;

      const filter = {
        companyId,
        $or: [{ _id: tId }, { _id: String(tId) }]
      };

      await db.collection('crm_follow_ups').updateOne(filter, { $set: updateData });
      const updated = await db.collection('crm_follow_ups').findOne(filter);
      res.json(updated);
    } catch (err: any) {
      console.error('Error updating task:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/crm/tasks/:id - Delete task
  router.delete('/tasks/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const tId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      await db.collection('crm_follow_ups').deleteOne({
        companyId,
        $or: [{ _id: tId }, { _id: String(tId) }]
      });
      res.json({ message: 'Task deleted successfully' });
    } catch (err: any) {
      console.error('Error deleting task:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // PUT /api/crm/tasks/:id/complete - Quick mark task as completed (with repeat rule support)
  router.put('/tasks/:id/complete', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const tId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { notes } = req.body;

      const filter = {
        companyId,
        $or: [{ _id: tId }, { _id: String(tId) }]
      };

      const task = await db.collection('crm_follow_ups').findOne(filter);
      if (!task) return res.status(404).json({ message: 'Task not found.' });

      await db.collection('crm_follow_ups').updateOne(
        filter,
        {
          $set: {
            status: 'Completed',
            completedAt: new Date(),
            completedBy: req.user?.sub || 'system',
            notes: notes ? `${task.notes ? task.notes + ' | ' : ''}Completion Note: ${notes}` : task.notes,
            updatedAt: new Date()
          }
        }
      );

      // Auto-schedule next occurrence if repeat_rule is set
      if (task.repeat_rule && task.repeat_rule !== 'none') {
        const curDue = new Date(task.dueDateTime || Date.now());
        let nextDue = new Date(curDue);
        if (task.repeat_rule === 'daily') {
          nextDue.setDate(nextDue.getDate() + 1);
        } else if (task.repeat_rule === 'weekly') {
          nextDue.setDate(nextDue.getDate() + 7);
        } else if (task.repeat_rule === 'monthly') {
          nextDue.setMonth(nextDue.getMonth() + 1);
        }

        const nextTaskDoc: any = {
          ...task,
          status: 'Pending',
          dueDateTime: nextDue,
          checklist: Array.isArray(task.checklist)
            ? task.checklist.map((item: any) => ({ ...item, done: false }))
            : [],
          completedAt: null,
          completedBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        delete nextTaskDoc._id;
        await db.collection('crm_follow_ups').insertOne(nextTaskDoc);
      }

      // Record activity
      if (task.customerId) {
        await db.collection('crm_activities').insertOne({
          companyId,
          customerId: task.customerId,
          unitInterestId: task.unitInterestId,
          activityType: 'Note',
          title: `Task Completed: ${task.title}`,
          description: `Follow-up (${task.taskType}) marked completed by ${req.user?.name || 'Sales Rep'}.${notes ? ` Note: ${notes}` : ''}`,
          performedBy: req.user?.sub || 'system',
          performedByName: req.user?.name || 'Sales Team',
          createdAt: new Date()
        });
      }

      const updated = await db.collection('crm_follow_ups').findOne(filter);
      res.json(updated);
    } catch (err: any) {
      console.error('Error completing task:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}
