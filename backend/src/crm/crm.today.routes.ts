import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { requireCrmRole } from './crm.security.service';
import { paiseToRupees } from './crm.calculation.service';

export function createCrmTodayRouter(getDb: () => any, authMiddleware: any, logAudit: any) {
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

  // ── GET /api/crm/today-summary ─────────────────────────────────────────────
  router.get('/today-summary', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep', 'accountant'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.query;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const next7DaysEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

      const isAgent = req.crmRole === 'sales_rep';
      const userId = req.user?.sub;

      // 1. Fetch Appointments & Site Visits
      const appointmentQuery: any = { companyId };
      const visitQuery: any = { companyId };
      if (projectId) {
        const pid = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
        appointmentQuery.projectId = pid;
        visitQuery.projectId = pid;
      }
      if (isAgent && userId) {
        appointmentQuery.assignedTo = userId;
        visitQuery.assignedSalespersonId = userId;
      }

      const [rawAppointments, rawVisits] = await Promise.all([
        db.collection('crm_appointments').find(appointmentQuery).sort({ start: 1 }).toArray(),
        db.collection('crm_site_visits').find(visitQuery).sort({ visitDateTime: 1 }).toArray()
      ]);

      // Normalize today's appointments
      const appointments: any[] = [];
      for (const a of rawAppointments) {
        const startTime = new Date(a.start);
        if (startTime >= todayStart && startTime <= todayEnd) {
          appointments.push({
            id: String(a._id),
            type: a.type || 'meeting',
            title: a.title,
            location: a.location || 'Site Office',
            timeRange: `${startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} - ${new Date(a.end || startTime.getTime() + 3600000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
            customerName: a.customerName || 'Prospect',
            customerPhone: a.customerPhone || '',
            leadId: a.leadId ? String(a.leadId) : null,
            status: a.status || 'scheduled'
          });
        }
      }

      for (const v of rawVisits) {
        const vTime = new Date(v.visitDateTime);
        if (vTime >= todayStart && vTime <= todayEnd) {
          appointments.push({
            id: String(v._id),
            type: 'site_visit',
            title: `Site Walkthrough - ${v.projectName || 'Site'}`,
            location: v.unitCode ? `Unit ${v.unitCode} (${v.projectName})` : (v.projectName || 'Site Experience Centre'),
            timeRange: vTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
            customerName: v.customerName,
            customerPhone: v.customerPhone || '',
            leadId: v.unitInterestId ? String(v.unitInterestId) : null,
            status: v.status || 'Scheduled'
          });
        }
      }

      // 2. Fetch Tasks
      const taskQuery: any = { companyId };
      if (isAgent && userId) {
        taskQuery.$or = [{ assignedTo: userId }, { assignedToId: userId }];
      }
      const rawTasks = await db.collection('crm_follow_ups').find(taskQuery).sort({ dueDateTime: 1 }).toArray();

      let doneTodayCount = 0;
      let tasksOverdueCount = 0;
      let tasksDueTodayCount = 0;

      const tasksForToday: any[] = [];
      for (const t of rawTasks) {
        const dueTime = new Date(t.dueDateTime);
        const isDone = t.status === 'Completed';

        if (isDone) {
          const compTime = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt || t.createdAt);
          if (compTime >= todayStart && compTime <= todayEnd) {
            doneTodayCount++;
          }
          continue;
        }

        const isOverdue = dueTime < todayStart;
        const isToday = dueTime >= todayStart && dueTime <= todayEnd;

        if (isOverdue) tasksOverdueCount++;
        if (isToday) tasksDueTodayCount++;

        if (isOverdue || isToday) {
          const checklist = Array.isArray(t.checklist) ? t.checklist : [];
          tasksForToday.push({
            id: String(t._id),
            title: t.title,
            priority: t.priority || 'Medium',
            status: t.status || 'Pending',
            dueTime: isToday ? dueTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : dueTime.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            reminder: !!t.reminder_at,
            checklistCount: checklist.length,
            checklistDoneCount: checklist.filter((item: any) => item.done).length,
            linkedLead: t.customerName ? { id: t.customerId ? String(t.customerId) : null, name: t.customerName, unitCode: t.unitCode } : null,
            repeatRule: t.repeat_rule && t.repeat_rule !== 'none' ? t.repeat_rule : null,
            isOverdue
          });
        }
      }

      // 3. Fetch Collections Due (Milestone Installments)
      const bookingQuery: any = { companyId, status: { $in: ['Reserved', 'Confirmed'] } };
      if (projectId) {
        bookingQuery.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }
      const rawBookings = await db.collection('crm_bookings').find(bookingQuery).toArray();

      const collectionsDue: any[] = [];
      let totalDueAmount = 0;
      let overdueCollectionsCount = 0;

      for (const b of rawBookings) {
        const schedule = Array.isArray(b.paymentSchedule) ? b.paymentSchedule : [];
        for (const item of schedule) {
          const isPaid = item.status === 'Paid';
          if (isPaid) continue;

          const dueDate = item.dueDate ? new Date(item.dueDate) : todayStart;
          const isOverdue = dueDate < todayStart;
          const isDueSoon = dueDate <= next7DaysEnd;

          if (isOverdue || isDueSoon) {
            const pendingPaise = (item.amountPaise || 0) - (item.paidAmountPaise || 0);
            const pendingAmount = pendingPaise > 0 ? paiseToRupees(pendingPaise) : Math.max(0, (item.amount || 0) - (item.paidAmount || 0));

            if (pendingAmount > 0) {
              const diffMs = todayStart.getTime() - dueDate.getTime();
              const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

              totalDueAmount += pendingAmount;
              if (isOverdue) overdueCollectionsCount++;

              collectionsDue.push({
                bookingId: String(b._id),
                bookingReference: b.bookingReference || 'BK-CONTRACT',
                customerName: b.customerName,
                customerPhone: b.customerPhone || '',
                unitNumber: b.unitNumber || b.unitCode || 'Unit',
                projectName: b.projectName || 'Project',
                milestoneName: item.milestoneName || item.installmentName || 'Installment Milestone',
                pendingAmount,
                pendingAmountPaise: pendingPaise || Math.round(pendingAmount * 100),
                dueDate: dueDate.toISOString().split('T')[0],
                daysOverdue: daysDiff,
                isOverdue
              });
            }
          }
        }
      }

      // Sort collections: most overdue first
      collectionsDue.sort((a, b) => b.daysOverdue - a.daysOverdue);

      // 4. Fetch Holds Expiring Soon
      const unitQuery: any = { companyId, availabilityStatus: 'Hold' };
      if (projectId) {
        unitQuery.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }
      const rawUnits = await db.collection('crm_units').find(unitQuery).toArray();

      const holdsExpiringSoon: any[] = [];
      for (const u of rawUnits) {
        const expiresAt = u.holdExpiresAt ? new Date(u.holdExpiresAt) : null;
        if (expiresAt) {
          const remainingSecs = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 1000));
          holdsExpiringSoon.push({
            unitId: String(u._id),
            unitCode: u.unitCode || `${u.buildingTower}-${u.unitNumber}`,
            buildingTower: u.buildingTower || 'Tower',
            buyerName: u.heldByCustomerName || u.heldByName || 'Interested Prospect',
            buyerPhone: u.heldByCustomerPhone || '',
            holdExpiresAt: expiresAt.toISOString(),
            remainingSeconds: remainingSecs
          });
        }
      }
      holdsExpiringSoon.sort((a, b) => a.remainingSeconds - b.remainingSeconds);

      // 5. Fetch Leads & Group into Follow-up buckets
      const leadQuery: any = { companyId, stage: { $nin: ['Booked', 'Lost'] } };
      if (projectId) {
        leadQuery.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }
      if (isAgent && userId) {
        leadQuery.$or = [{ assignedSalespersonId: userId }, { assigned_to: userId }];
      }
      const rawLeads = await db.collection('crm_unit_interests').find(leadQuery).toArray();

      const overdueLeads: any[] = [];
      const dueTodayLeads: any[] = [];
      const comingUpLeads: any[] = [];

      for (const l of rawLeads) {
        const fDateRaw = l.next_followup_at || l.nextFollowUpDate;
        if (!fDateRaw) continue; // Backlog inquiries without scheduled follow-up are not action items for today
        const fDate = new Date(fDateRaw);

        const isOverdue = fDate < todayStart;
        const isToday = fDate >= todayStart && fDate <= todayEnd;
        const isNext7Days = fDate > todayEnd && fDate <= next7DaysEnd;

        let dueLabel = 'Upcoming';
        if (isToday) {
          dueLabel = 'Due today';
        } else if (isOverdue) {
          const daysAgo = Math.max(1, Math.round((todayStart.getTime() - fDate.getTime()) / (1000 * 60 * 60 * 24)));
          dueLabel = daysAgo === 1 ? 'Overdue: yesterday' : `Overdue: ${daysAgo}d ago`;
        } else if (isNext7Days) {
          const daysAhead = Math.round((fDate.getTime() - todayEnd.getTime()) / (1000 * 60 * 60 * 24));
          dueLabel = daysAhead === 1 ? 'Tomorrow' : `In ${daysAhead} days`;
        }

        const leadItem = {
          id: String(l._id),
          customerId: l.customerId ? String(l.customerId) : null,
          name: l.customerName || 'Inquiry',
          phone: l.customerPhone || '',
          projectName: l.projectName || 'Project',
          projectId: l.projectId ? String(l.projectId) : null,
          stage: l.stage || 'New',
          interest: l.unitCode ? `Unit ${l.unitCode}` : (l.preferredPropertyType || 'Residential Flat'),
          source: l.leadSource || 'Direct Inbound',
          followupCount: l.followup_count || 1,
          dueLabel,
          isOverdue,
          followupDate: fDate.toISOString()
        };

        if (isOverdue) overdueLeads.push(leadItem);
        else if (isToday) dueTodayLeads.push(leadItem);
        else if (isNext7Days) comingUpLeads.push(leadItem);
      }

      // Sort lead groups by follow-up date
      overdueLeads.sort((a, b) => new Date(a.followupDate).getTime() - new Date(b.followupDate).getTime());
      dueTodayLeads.sort((a, b) => new Date(a.followupDate).getTime() - new Date(b.followupDate).getTime());
      comingUpLeads.sort((a, b) => new Date(a.followupDate).getTime() - new Date(b.followupDate).getTime());

      // 4 Hero Stat Cards
      const totalOverdue = overdueLeads.length + tasksOverdueCount;
      const totalDueToday = dueTodayLeads.length + tasksDueTodayCount;
      const totalNext7Days = comingUpLeads.length;
      const waitingFollowupsCount = overdueLeads.length + dueTodayLeads.length;

      // User greeting
      const currentHour = now.getHours();
      const timeGreeting = currentHour < 12 ? 'Good morning' : (currentHour < 17 ? 'Good afternoon' : 'Good evening');
      const userName = req.user?.name || req.user?.email?.split('@')[0] || 'Team';

      return res.json({
        greeting: `${timeGreeting}, ${userName}`,
        dateFormatted: now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
        stats: {
          overdue: totalOverdue,
          dueToday: totalDueToday,
          next7Days: totalNext7Days,
          doneToday: doneTodayCount,
          completedToday: doneTodayCount,
          waitingFollowupsCount
        },
        appointments,
        tasks: tasksForToday,
        collectionsDue: {
          totalDueAmount,
          overdueCount: overdueCollectionsCount,
          items: collectionsDue
        },
        holdsExpiringSoon,
        leadFollowupGroups: {
          overdue: overdueLeads,
          dueToday: dueTodayLeads,
          comingUp: comingUpLeads
        }
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to load Today summary', error: err.message });
    }
  });

  // ── GET /api/crm/followups — Comprehensive Follow-up Queue ───────────────────
  router.get('/followups', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep', 'accountant'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, search, bucket } = req.query;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const next7DaysEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

      const isAgent = req.crmRole === 'sales_rep';
      const userId = req.user?.sub;

      const leadQuery: any = { companyId, stage: { $nin: ['Booked', 'Lost'] } };
      if (projectId) {
        leadQuery.projectId = {
          $in: [projectId, ObjectId.isValid(projectId) ? new ObjectId(projectId) : null].filter(Boolean)
        };
      }
      if (isAgent && userId) {
        leadQuery.$or = [{ assignedSalespersonId: userId }, { assigned_to: userId }];
      }

      const rawLeads = await db.collection('crm_unit_interests').find(leadQuery).toArray();

      const overdueItems: any[] = [];
      const todayItems: any[] = [];
      const upcomingItems: any[] = [];

      for (const l of rawLeads) {
        const fDateRaw = l.next_followup_at || l.nextFollowUpDate;
        if (!fDateRaw) continue; // Backlog inquiries without scheduled follow-up are not action items for today
        const fDate = new Date(fDateRaw);

        const isOverdue = fDate < todayStart;
        const isToday = fDate >= todayStart && fDate <= todayEnd;
        const isNext7Days = fDate > todayEnd && fDate <= next7DaysEnd;

        let statusBucket = 'upcoming';
        let dueLabel = 'Upcoming';
        if (isToday) {
          statusBucket = 'today';
          dueLabel = 'Due today';
        } else if (isOverdue) {
          statusBucket = 'overdue';
          const daysAgo = Math.max(1, Math.round((todayStart.getTime() - fDate.getTime()) / (1000 * 60 * 60 * 24)));
          dueLabel = daysAgo === 1 ? 'Overdue: yesterday' : `Overdue: ${daysAgo}d ago`;
        } else if (isNext7Days) {
          statusBucket = 'next7days';
          const daysAhead = Math.round((fDate.getTime() - todayEnd.getTime()) / (1000 * 60 * 60 * 24));
          dueLabel = daysAhead === 1 ? 'Tomorrow' : `In ${daysAhead} days`;
        }

        const item = {
          id: String(l._id),
          leadId: String(l._id),
          customerId: l.customerId ? String(l.customerId) : null,
          name: l.customerName || 'Inquiry',
          phone: l.customerPhone || '',
          email: l.customerEmail || l.email || '',
          projectName: l.projectName || 'Project',
          projectId: l.projectId ? String(l.projectId) : null,
          stage: l.stage || 'New enquiry',
          interest: l.unitCode ? `Unit ${l.unitCode}` : (l.preferredPropertyType || 'Residential Flat'),
          unitCode: l.unitCode || '',
          budget: l.budget || (l.budgetPaise ? l.budgetPaise / 100 : 0),
          budgetPaise: l.budgetPaise || 0,
          source: l.leadSource || 'Direct Inbound',
          followupCount: l.followup_count || 1,
          dueLabel,
          statusBucket,
          isOverdue,
          isToday,
          followupDate: fDate.toISOString(),
          lastContactDate: l.last_contacted_at || l.lastContactDate || l.createdAt,
          notes: l.notes || '',
          assignedTo: l.assignedSalespersonName || l.assigned_to || 'Sales Team',
          assignedSalespersonId: l.assignedSalespersonId || l.assigned_to || null
        };

        if (isOverdue) overdueItems.push(item);
        else if (isToday) todayItems.push(item);
        else upcomingItems.push(item);
      }

      overdueItems.sort((a, b) => new Date(a.followupDate).getTime() - new Date(b.followupDate).getTime());
      todayItems.sort((a, b) => new Date(a.followupDate).getTime() - new Date(b.followupDate).getTime());
      upcomingItems.sort((a, b) => new Date(a.followupDate).getTime() - new Date(b.followupDate).getTime());

      const completedTodayActivities = await db.collection('crm_activities').find({
        companyId,
        createdAt: { $gte: todayStart, $lte: todayEnd }
      }).sort({ createdAt: -1 }).toArray();

      let allSorted = [...overdueItems, ...todayItems, ...upcomingItems];

      if (search) {
        const term = String(search).toLowerCase().trim();
        allSorted = allSorted.filter(item =>
          (item.name && item.name.toLowerCase().includes(term)) ||
          (item.phone && item.phone.includes(term)) ||
          (item.projectName && item.projectName.toLowerCase().includes(term)) ||
          (item.unitCode && item.unitCode.toLowerCase().includes(term))
        );
      }

      if (bucket === 'overdue') {
        allSorted = overdueItems;
      } else if (bucket === 'today') {
        allSorted = todayItems;
      } else if (bucket === 'next7days') {
        allSorted = upcomingItems.filter(i => i.statusBucket === 'next7days');
      }

      return res.json({
        followups: allSorted,
        stats: {
          overdue: overdueItems.length,
          dueToday: todayItems.length,
          next7Days: upcomingItems.filter(i => i.statusBucket === 'next7days').length,
          completedToday: completedTodayActivities.length,
          totalPending: overdueItems.length + todayItems.length
        }
      });
    } catch (err: any) {
      console.error('Error fetching follow-ups:', err);
      return res.status(500).json({ message: 'Failed to fetch follow-ups', error: err.message });
    }
  });

  // ── POST /api/crm/followups/log — Record Interaction & Progress Follow-up ─────
  router.post('/followups/log', authMiddleware, requireCrmRole('admin', 'sales_manager', 'sales_rep'), async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        leadId,
        customerId,
        interactionDate = new Date(),
        interactionType = 'Phone call',
        notes = '',
        outcome = 'Follow-up completed',
        nextFollowupDate,
        assignedEmployee,
        newStage,
        lostReason,
        appointmentData
      } = req.body;

      if (!leadId && !customerId) {
        return res.status(400).json({ message: 'leadId or customerId is required.' });
      }

      const lId = leadId ? (ObjectId.isValid(leadId) ? new ObjectId(leadId) : leadId) : null;
      let lead: any = null;
      if (lId) {
        lead = await db.collection('crm_unit_interests').findOne({ _id: lId, companyId });
      }

      const custId = customerId
        ? (ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId)
        : (lead?.customerId || null);

      const now = new Date(interactionDate);
      const updateLeadFields: any = {
        updatedAt: new Date(),
        last_contacted_at: now,
        lastContactDate: now
      };

      if (lead) {
        updateLeadFields.followup_count = Number(lead.followup_count || 1) + 1;
      }

      if (newStage) {
        updateLeadFields.stage = newStage;
      }

      if (lostReason) {
        updateLeadFields.lostReason = lostReason;
        updateLeadFields.stage = 'Lost';
      }

      let parsedNextDate: Date | null = null;
      if (nextFollowupDate) {
        parsedNextDate = new Date(nextFollowupDate);
        updateLeadFields.next_followup_at = parsedNextDate;
        updateLeadFields.nextFollowUpDate = parsedNextDate;
      } else if (interactionType === 'No response') {
        parsedNextDate = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
        updateLeadFields.next_followup_at = parsedNextDate;
        updateLeadFields.nextFollowUpDate = parsedNextDate;
      }

      if (assignedEmployee) {
        updateLeadFields.assignedSalespersonName = assignedEmployee;
      }

      if (lId) {
        await db.collection('crm_unit_interests').updateOne(
          { _id: lId, companyId },
          { $set: updateLeadFields }
        );
      }

      // Record interaction document in crm_activities
      const activityDoc: any = {
        companyId,
        customerId: custId,
        unitInterestId: lId,
        lead_id: lId,
        unitCode: lead?.unitCode || '',
        activityType: interactionType,
        interactionType,
        title: `${interactionType}: ${outcome}`,
        description: notes || `Interaction recorded via ${interactionType}. Outcome: ${outcome}`,
        outcome,
        nextFollowupDate: parsedNextDate,
        assignedEmployee: assignedEmployee || req.user?.name || 'Sales Team',
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || assignedEmployee || 'Sales Team',
        createdAt: now,
        timestamp: now
      };

      const actRes = await db.collection('crm_activities').insertOne(activityDoc);
      activityDoc._id = actRes.insertedId;

      // Also persist in crm_follow_ups
      await db.collection('crm_follow_ups').insertOne({
        companyId,
        customerId: custId,
        leadId: lId,
        interactionType,
        notes,
        outcome,
        interactionDate: now,
        nextFollowupDate: parsedNextDate,
        assignedEmployee: assignedEmployee || req.user?.name || 'Sales Team',
        assignedTo: req.user?.sub || 'agent',
        status: 'Completed',
        completedAt: now,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      if (custId) {
        await db.collection('crm_customers').updateOne(
          { _id: custId, companyId },
          { $set: { lastContactDate: now, updatedAt: new Date() } }
        );
      }

      if (appointmentData?.start) {
        await db.collection('crm_appointments').insertOne({
          companyId,
          projectId: lead?.projectId,
          leadId: lId,
          customerId: custId,
          customerName: lead?.customerName,
          customerPhone: lead?.customerPhone,
          type: 'site_visit',
          title: appointmentData.title || `Site Walkthrough - ${lead?.customerName || 'Prospect'}`,
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

      return res.status(201).json({
        success: true,
        message: 'Follow-up interaction recorded successfully.',
        activity: activityDoc,
        updatedLead: lead ? { ...lead, ...updateLeadFields } : null
      });
    } catch (err: any) {
      console.error('Error logging follow-up:', err);
      return res.status(500).json({ message: 'Failed to log follow-up interaction', error: err.message });
    }
  });

  // ── APPOINTMENTS CRUD ────────────────────────────────────────────────────
  router.get('/appointments', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, date } = req.query;

      const query: any = { companyId };
      if (projectId) query.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      if (req.crmRole === 'sales_rep' && req.user?.sub) {
        query.assignedTo = req.user.sub;
      }

      let list = await db.collection('crm_appointments').find(query).sort({ start: 1 }).toArray();
      if (date) {
        const targetDate = String(date).split('T')[0];
        list = list.filter((a: any) => String(a.start).startsWith(targetDate));
      }
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to load appointments', error: err.message });
    }
  });

  router.post('/appointments', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { title, type, start, end, location, leadId, customerId, customerName, customerPhone, projectId } = req.body;

      if (!title || !start) {
        return res.status(400).json({ message: 'Title and start time are required' });
      }

      const doc: any = {
        companyId,
        projectId: projectId && ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId,
        leadId: leadId && ObjectId.isValid(leadId) ? new ObjectId(leadId) : leadId,
        customerId: customerId && ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        type: type || 'meeting',
        title: title.trim(),
        start: new Date(start),
        end: end ? new Date(end) : new Date(new Date(start).getTime() + 3600000),
        location: location || 'Site Office',
        assignedTo: req.user?.sub || 'unassigned',
        assignedToName: req.user?.name || req.user?.email || 'Agent',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const insertRes = await db.collection('crm_appointments').insertOne(doc);
      doc._id = insertRes.insertedId;

      if (logAudit) {
        logAudit(req, 'CRM_APPOINTMENT_CREATE', { appointmentId: doc._id, title: doc.title });
      }

      return res.status(201).json(doc);
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to create appointment', error: err.message });
    }
  });

  // ── QUICK TASK STATUS TOGGLE (WITH RECURRING AUTO-CREATION) ────────────────
  router.put('/tasks/:id/toggle', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const taskId = req.params.id;

      const filter = {
        companyId,
        $or: [{ _id: ObjectId.isValid(taskId) ? new ObjectId(taskId) : taskId }, { _id: taskId }]
      };

      let coll = 'crm_follow_ups';
      let existing = await db.collection(coll).findOne(filter);
      if (!existing) {
        coll = 'crm_follow_up_tasks';
        existing = await db.collection(coll).findOne(filter);
      }

      if (!existing) {
        return res.status(404).json({ message: 'Task not found' });
      }

      const newStatus = existing.status === 'Completed' ? 'Pending' : 'Completed';
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date(),
        completedAt: newStatus === 'Completed' ? new Date() : null,
        completedBy: newStatus === 'Completed' ? req.user?.name || req.user?.email || 'User' : null
      };

      await db.collection(coll).updateOne(filter, { $set: updateData });

      // If recurring task marked completed, auto-create next occurrence
      if (newStatus === 'Completed' && existing.repeat_rule && existing.repeat_rule !== 'none') {
        const curDue = new Date(existing.dueDateTime || Date.now());
        let nextDue = new Date(curDue);
        if (existing.repeat_rule === 'daily') {
          nextDue.setDate(nextDue.getDate() + 1);
        } else if (existing.repeat_rule === 'weekly') {
          nextDue.setDate(nextDue.getDate() + 7);
        } else if (existing.repeat_rule === 'monthly') {
          nextDue.setMonth(nextDue.getMonth() + 1);
        }

        const nextTaskDoc: any = {
          ...existing,
          status: 'Pending',
          dueDateTime: nextDue,
          checklist: Array.isArray(existing.checklist)
            ? existing.checklist.map((item: any) => ({ ...item, done: false }))
            : [],
          completedAt: null,
          completedBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        delete nextTaskDoc._id;
        await db.collection('crm_follow_ups').insertOne(nextTaskDoc);
      }

      return res.json({ id: taskId, status: newStatus });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to toggle task', error: err.message });
    }
  });

  // ── GET /api/crm/calendar-events - Aggregated Event Streams ───────────────
  router.get('/calendar-events', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.query;

      const pFilter: any = { companyId };
      if (projectId) {
        pFilter.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }

      const isAgent = req.crmRole === 'sales_rep';
      const userId = req.user?.sub;

      const [appointments, visits, tasks, bookings, units, leads] = await Promise.all([
        db.collection('crm_appointments').find(pFilter).toArray(),
        db.collection('crm_site_visits').find(pFilter).toArray(),
        db.collection('crm_follow_ups').find(isAgent && userId ? { companyId, $or: [{ assignedTo: userId }, { assignedToId: userId }] } : { companyId }).toArray(),
        db.collection('crm_bookings').find({ ...pFilter, status: { $in: ['Reserved', 'Confirmed'] } }).toArray(),
        db.collection('crm_units').find({ ...pFilter, availabilityStatus: 'Hold' }).toArray(),
        db.collection('crm_unit_interests').find({ ...pFilter, stage: { $nin: ['Booked', 'Lost'] } }).toArray()
      ]);

      const events: any[] = [];

      // 1. Appointments & Visits
      for (const a of appointments) {
        events.push({
          id: String(a._id),
          stream: 'appointments',
          type: a.type || 'meeting',
          title: a.title,
          start: a.start,
          end: a.end || a.start,
          customerName: a.customerName,
          location: a.location,
          status: a.status || 'scheduled'
        });
      }

      for (const v of visits) {
        events.push({
          id: String(v._id),
          stream: 'site_visits',
          type: 'site_visit',
          title: `Site Walkthrough - ${v.customerName || 'Prospect'}`,
          start: v.visitDateTime,
          end: v.visitDateTime,
          customerName: v.customerName,
          location: v.unitCode ? `Unit ${v.unitCode}` : (v.projectName || 'Site'),
          status: v.status || 'Scheduled'
        });
      }

      // 2. Tasks
      for (const t of tasks) {
        if (t.dueDateTime) {
          events.push({
            id: String(t._id),
            stream: 'tasks',
            type: 'task',
            title: t.title,
            start: t.dueDateTime,
            end: t.dueDateTime,
            priority: t.priority || 'Medium',
            status: t.status || 'Pending',
            customerName: t.customerName
          });
        }
      }

      // 3. Follow-ups
      for (const l of leads) {
        const fDate = l.next_followup_at || l.nextFollowUpDate;
        if (fDate) {
          events.push({
            id: String(l._id),
            stream: 'followups',
            type: 'followup',
            title: `Follow-up #${l.followup_count || 1} - ${l.customerName || 'Inquiry'}`,
            start: fDate,
            end: fDate,
            customerName: l.customerName,
            projectName: l.projectName,
            stage: l.stage
          });
        }
      }

      // 4. Collection Dues
      for (const b of bookings) {
        const schedule = Array.isArray(b.paymentSchedule) ? b.paymentSchedule : [];
        for (const item of schedule) {
          if (item.status !== 'Paid' && item.dueDate) {
            events.push({
              id: `${b._id}-${item.milestoneName || 'milestone'}`,
              stream: 'collections',
              type: 'collection',
              title: `Payment Due: ${item.milestoneName || 'Installment'} - ${b.customerName}`,
              start: item.dueDate,
              end: item.dueDate,
              amount: item.amount,
              unitNumber: b.unitNumber,
              customerName: b.customerName
            });
          }
        }
      }

      // 5. Hold Expiries
      for (const u of units) {
        if (u.holdExpiresAt) {
          events.push({
            id: String(u._id),
            stream: 'hold_expiries',
            type: 'hold_expiry',
            title: `Hold Expires: Unit ${u.unitCode || u.unitNumber}`,
            start: u.holdExpiresAt,
            end: u.holdExpiresAt,
            buyerName: u.heldByCustomerName || 'Prospect'
          });
        }
      }

      return res.json(events);
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to load calendar events', error: err.message });
    }
  });

  // ── POST /api/crm/appointments/:id/feedback - Post-visit feedback ─────────
  router.post('/appointments/:id/feedback', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const apptId = req.params.id;
      const { outcomeNotes, rating, nextStep, advanceStageTo } = req.body;

      const filter = {
        companyId,
        $or: [{ _id: ObjectId.isValid(apptId) ? new ObjectId(apptId) : apptId }, { _id: apptId }]
      };

      const appt = await db.collection('crm_appointments').findOne(filter);
      if (!appt) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      const updateData: any = {
        status: 'completed',
        outcomeNotes: outcomeNotes || '',
        rating: rating || 5,
        nextStep: nextStep || '',
        completedAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('crm_appointments').updateOne(filter, { $set: updateData });

      // If tied to lead, advance stage if requested
      if (appt.leadId && advanceStageTo) {
        await db.collection('crm_unit_interests').updateOne(
          { _id: appt.leadId, companyId },
          { $set: { stage: advanceStageTo, lastContactDate: new Date(), updatedAt: new Date() } }
        );
      }

      // Write activity timeline entry
      await db.collection('crm_activities').insertOne({
        companyId,
        customerId: appt.customerId,
        unitInterestId: appt.leadId,
        lead_id: appt.leadId,
        activityType: 'Site Visit',
        title: `Site Visit Completed: ${appt.title}`,
        description: `Feedback: ${outcomeNotes || 'Good meeting'}. Next step: ${nextStep || 'Follow-up'}.`,
        performedBy: req.user?.sub || 'system',
        performedByName: req.user?.name || 'Sales Team',
        createdAt: new Date()
      });

      return res.json({ message: 'Feedback logged and appointment marked completed' });
    } catch (err: any) {
      return res.status(500).json({ message: 'Failed to record feedback', error: err.message });
    }
  });

  return router;
}

