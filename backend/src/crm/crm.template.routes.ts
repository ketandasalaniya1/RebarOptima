import { Router } from 'express';
import { ObjectId } from 'mongodb';

export function createCrmTemplateRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
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

  const DEFAULT_TEMPLATES = [
    {
      name: 'Follow-up #1: Warm Introduction',
      category: 'follow_up_1',
      body: 'Hello {name}! Thank you for your inquiry about {project}. We have exciting {unit_type} options starting at {price}. When is a good time for a quick 2-minute chat?',
      variables: ['name', 'project', 'unit_type', 'price', 'agent_name']
    },
    {
      name: 'Follow-up #2: Adding Value & Floor Plan',
      category: 'follow_up_2',
      body: "Hi {name}, following up on your interest in {project}. I've set aside our architectural floor plans and latest construction milestones for {unit_type}. Would you like me to share the brochure here?",
      variables: ['name', 'project', 'unit_type', 'agent_name']
    },
    {
      name: 'Follow-up #3: Site Visit Nudge',
      category: 'follow_up_3',
      body: 'Hello {name}, our show flat at {project} is open for walkthroughs this weekend. Can I reserve a priority slot for you and your family on Saturday or Sunday?',
      variables: ['name', 'project', 'agent_name']
    },
    {
      name: 'Site Visit Confirmation',
      category: 'site_visit_confirmation',
      body: 'Dear {name}, your site visit for {project} is confirmed for {visit_date} at {location}. Our site manager {agent_name} will welcome you at the experience centre. See you soon!',
      variables: ['name', 'project', 'visit_date', 'location', 'agent_name']
    },
    {
      name: 'Official Unit Price Quote',
      category: 'unit_quote',
      body: "Dear {name},\n\nOfficial Price Quote for {project} - Unit {unit_code} ({unit_type}):\nCarpet Area: {carpet_area} sq.ft\nBase Price: {base_price}\nGST & Stat: {tax_amount}\nNet Value: {price}\n\nValid for 48h hold. Let me know if you would like to block this unit!",
      variables: ['name', 'project', 'unit_code', 'unit_type', 'carpet_area', 'base_price', 'tax_amount', 'price']
    },
    {
      name: 'Booking Confirmation',
      category: 'booking_confirmation',
      body: 'Congratulations {name}! Unit {unit_code} at {project} is officially reserved for you under Booking Ref {booking_ref}. Total Value: {price}. Welcome to the family!',
      variables: ['name', 'project', 'unit_code', 'booking_ref', 'price']
    },
    {
      name: 'Payment Reminder',
      category: 'payment_reminder',
      body: 'Dear {name}, this is a gentle reminder regarding the installment milestone for {project} Unit {unit_code} ({milestone_name}). Amount Due: {price}. Due Date: {due_date}. Thank you!',
      variables: ['name', 'project', 'unit_code', 'milestone_name', 'price', 'due_date']
    },
    {
      name: 'Possession & Handover Notice',
      category: 'handover',
      body: 'Dear {name}, we are delighted to invite you for the key handover of your new home Unit {unit_code} at {project}! Please contact {agent_name} to schedule your registration & possession date.',
      variables: ['name', 'project', 'unit_code', 'agent_name']
    }
  ];

  // 1. GET /api/crm/templates - List templates (auto-seeds defaults if empty)
  router.get('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      let templates = await db.collection('crm_templates').find({ companyId }).toArray();

      if (templates.length === 0) {
        // Seed default templates for company
        const toInsert = DEFAULT_TEMPLATES.map(t => ({
          ...t,
          companyId,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        await db.collection('crm_templates').insertMany(toInsert);
        templates = await db.collection('crm_templates').find({ companyId }).toArray();
      }

      return res.json(templates);
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to load templates', error: err.message });
    }
  });

  // 2. POST /api/crm/templates - Create template
  router.post('/', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { name, category, body, variables } = req.body;

      if (!name || !body) {
        return res.status(400).json({ message: 'Template name and body are required' });
      }

      const doc = {
        companyId,
        name: name.trim(),
        category: category || 'general',
        body: body.trim(),
        variables: Array.isArray(variables) ? variables : [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('crm_templates').insertOne(doc);
      return res.status(201).json({ _id: result.insertedId, ...doc });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to create template', error: err.message });
    }
  });

  // 3. PUT /api/crm/templates/:id - Update template
  router.put('/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const templateId = req.params.id;
      const { name, category, body, variables } = req.body;

      const filter = {
        companyId,
        $or: [{ _id: ObjectId.isValid(templateId) ? new ObjectId(templateId) : templateId }, { _id: templateId }]
      };

      const updateData: any = { updatedAt: new Date() };
      if (name) updateData.name = name.trim();
      if (category) updateData.category = category;
      if (body) updateData.body = body.trim();
      if (variables) updateData.variables = variables;

      await db.collection('crm_templates').updateOne(filter, { $set: updateData });
      const updated = await db.collection('crm_templates').findOne(filter);
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to update template', error: err.message });
    }
  });

  // 4. DELETE /api/crm/templates/:id - Delete template
  router.delete('/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const templateId = req.params.id;

      const filter = {
        companyId,
        $or: [{ _id: ObjectId.isValid(templateId) ? new ObjectId(templateId) : templateId }, { _id: templateId }]
      };

      await db.collection('crm_templates').deleteOne(filter);
      return res.json({ message: 'Template deleted successfully' });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to delete template', error: err.message });
    }
  });

  return router;
}

