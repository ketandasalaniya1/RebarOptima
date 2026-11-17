import { Db, ObjectId } from 'mongodb';
import { ProjectAccessContext, assertProjectAccess, projectIdQuery } from '../projects/project-access';

export function toObjectId(id: any): ObjectId | null {
  if (!id) return null;
  const str = String(id);
  if (ObjectId.isValid(str) && str.length === 24) {
    try {
      return new ObjectId(str);
    } catch {
      return null;
    }
  }
  return null;
}

export function companyFilter(companyId: any): any {
  if (!companyId) return {};
  const objId = toObjectId(companyId);
  if (objId) {
    return { $or: [{ companyId: objId }, { companyId: String(companyId) }] };
  }
  return { companyId: String(companyId) };
}

export function projectMatcher(projectId: any): any {
  if (!projectId || projectId === 'all') return {};
  const objId = toObjectId(projectId);
  if (objId) {
    return { $or: [{ projectId: objId }, { projectId: String(projectId) }] };
  }
  return { projectId: String(projectId) };
}

export interface IGroundedSource {
  module: string;
  collection: string;
  recordCount: number;
  status: 'grounded' | 'unavailable' | 'unauthorized';
  summary?: string;
}

export interface IGroundedDataContext {
  projectId: string;
  projectName: string;
  projectStatus: string;
  asOf: string;
  currentServerDate: string;
  sources: IGroundedSource[];
  warnings: string[];
  metrics: Record<string, any>;
  groundedFactsText: string;
}

export class ProjectDataGroundingService {
  /**
   * Resolves the target project requested by the user.
   * If the user mentions a specific project name in their prompt (e.g. "Skyhight", "Himshila"),
   * it verifies that the project belongs to the user's authorized company and user assignment.
   */
  static async resolveTargetProject(
    db: Db,
    ctx: ProjectAccessContext,
    activeProjectId: string,
    prompt: string
  ): Promise<{ project: any; wasMentionedInPrompt: boolean }> {
    const compQuery = companyFilter(ctx.companyId);
    const companyProjects = await db.collection('projects').find(compQuery).toArray();

    // 1. Check if user specifically named a project belonging to their authorized company
    const lowerPrompt = prompt.toLowerCase();
    let matchedProject: any = null;

    for (const p of companyProjects) {
      const pName = (p.name || p.projectName || '').toLowerCase().trim();
      if (pName && pName.length >= 3) {
        // Look for exact word or clean substring match
        const regex = new RegExp(`\\b${pName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(lowerPrompt) || lowerPrompt.includes(pName)) {
          matchedProject = p;
          break;
        }
      }
    }

    if (matchedProject) {
      // Assert user has access to this project (verifies user assignment & active status)
      const pIdStr = String(matchedProject._id || matchedProject.id);
      await assertProjectAccess(db, ctx, pIdStr, { requireActive: false });
      return { project: matchedProject, wasMentionedInPrompt: true };
    }

    // 2. Cross-Company Access Check:
    // Check if the prompt specifically named a project belonging to ANOTHER company
    const allProjects = await db.collection('projects').find({}).toArray();
    for (const otherP of allProjects) {
      const otherCid = String(otherP.companyId || '');
      const userCid = String(ctx.companyId || '');
      if (otherCid !== userCid) {
        const pName = (otherP.name || otherP.projectName || '').toLowerCase().trim();
        if (pName && pName.length >= 3) {
          const regex = new RegExp(`\\b${pName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
          if (regex.test(lowerPrompt) || lowerPrompt.includes(pName)) {
            const forbiddenErr: any = new Error(
              `Access denied: Project "${otherP.name || otherP.projectName}" belongs to another organization and cannot be accessed.`
            );
            forbiddenErr.status = 403;
            forbiddenErr.code = 'CROSS_COMPANY_UNAUTHORIZED';
            throw forbiddenErr;
          }
        }
      }
    }

    // 3. Unknown Project Check:
    // Detect if user explicitly requested a specific unknown project name
    const explicitProjectRegex = /(?:project\s+([A-Za-z0-9_\-]+)|for\s+(?:the\s+)?project\s+([A-Za-z0-9_\-]+)|(?:summarize|progress|status|update)\s+for\s+([A-Za-z0-9_\-]+))/i;
    const match = lowerPrompt.match(explicitProjectRegex);
    if (match) {
      const candidateName = (match[1] || match[2] || match[3] || '').trim();
      const ignoredWords = ['this', 'our', 'the', 'my', 'current', 'all', 'a', 'an', 'overall', 'any'];
      if (candidateName && !ignoredWords.includes(candidateName) && candidateName.length >= 3) {
        const notFoundErr: any = new Error(
          `Project "${candidateName}" was not found in your organization's records.`
        );
        notFoundErr.status = 404;
        notFoundErr.code = 'PROJECT_NOT_FOUND';
        throw notFoundErr;
      }
    }

    // 4. Otherwise use activeProjectId
    let targetPid = activeProjectId;
    if (!targetPid || targetPid === 'all' || targetPid === 'default') {
      targetPid = ctx.assignedProjects?.[0] || '';
    }

    if (!targetPid && companyProjects.length > 0) {
      targetPid = String(companyProjects[0]._id);
    }

    if (targetPid) {
      const project = await assertProjectAccess(db, ctx, String(targetPid), { requireActive: false });
      return { project, wasMentionedInPrompt: false };
    }

    throw new Error('No authorized project context found.');
  }

  /**
   * Securely queries all relevant MongoDB collections for the authorized project
   * and builds a deterministic ground-truth fact context.
   */
  static async getGroundedContext(
    db: Db,
    ctx: ProjectAccessContext,
    project: any,
    prompt: string,
    userPermissions: any = {}
  ): Promise<IGroundedDataContext> {
    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];
    const pidStr = String(project._id || project.id);
    const cidStr = String(ctx.companyId);

    const sources: IGroundedSource[] = [];
    const warnings: string[] = [];
    const metrics: Record<string, any> = {};

    const pMatch = projectMatcher(pidStr);
    const cFilter = companyFilter(cidStr);
    const scopeQuery = { $and: [cFilter, pMatch] };

    // 1. PROJECT OVERVIEW & STRUCTURE
    const [blocks, floors] = await Promise.all([
      db.collection('project_blocks').find({ ...pMatch }).toArray().catch(() => []),
      db.collection('project_floors').find({ ...pMatch }).toArray().catch(() => []),
    ]);

    sources.push({
      module: 'projects',
      collection: 'projects',
      recordCount: 1,
      status: 'grounded',
      summary: `Project "${project.name || project.projectName}" (Status: ${project.status || 'active'}, Type: ${project.projectType || 'N/A'})`,
    });

    sources.push({
      module: 'project_blocks',
      collection: 'project_blocks',
      recordCount: blocks.length,
      status: blocks.length > 0 ? 'grounded' : 'unavailable',
      summary: blocks.length > 0 ? `${blocks.length} blocks (${blocks.map((b: any) => b.name).join(', ')})` : '0 blocks cataloged',
    });

    metrics.project = {
      id: pidStr,
      name: project.name || project.projectName,
      status: project.status || 'active',
      projectType: project.projectType || 'Standard',
      address: project.address || 'N/A',
      startDate: project.startDate || project.plannedStartDate || null,
      targetDate: project.targetDate || project.endDate || null,
      blocksCount: blocks.length,
      blockNames: blocks.map((b: any) => b.name),
      floorsCount: floors.length,
    };

    // 2. PROJECT MANAGEMENT TASKS, PROGRESS & DELAYS
    const tasks = await db.collection('pm_tasks').find(scopeQuery).sort({ sortOrder: 1, createdAt: 1 }).toArray().catch(() => []);
    const delays = await db.collection('pm_delays').find(scopeQuery).toArray().catch(() => []);
    const dprs = await db.collection('pm_dpr').find(scopeQuery).sort({ date: -1 }).limit(5).toArray().catch(() => []);

    if (tasks.length > 0) {
      const completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED' || Number(t.progress) === 100);
      const inProgressTasks = tasks.filter((t: any) => t.status === 'IN_PROGRESS');
      const delayedTasks = tasks.filter((t: any) => t.status === 'DELAYED');

      // Overdue tasks: planned finish date is in the past and task is not completed
      const overdueTasks = tasks.filter((t: any) => {
        if (t.status === 'COMPLETED') return false;
        const finish = t.plannedFinish || t.plannedEndDate;
        return finish && finish < currentDateStr;
      });

      // Deterministic average progress across all tasks
      const totalProgressSum: number = (tasks as any[]).reduce((sum: number, t: any) => sum + (Number(t.progress) || 0), 0);
      const avgProgress = Math.round(totalProgressSum / tasks.length);

      metrics.pm = {
        totalTasks: tasks.length,
        completedTasksCount: completedTasks.length,
        inProgressTasksCount: inProgressTasks.length,
        delayedTasksCount: delayedTasks.length,
        overdueTasksCount: overdueTasks.length,
        calculatedOverallProgress: avgProgress,
        overdueList: overdueTasks.map((t: any) => ({
          name: t.name,
          plannedFinish: t.plannedFinish || t.plannedEndDate,
          progress: t.progress || 0,
          status: t.status,
        })),
        activeTasksList: inProgressTasks.map((t: any) => ({
          name: t.name,
          progress: t.progress || 0,
          plannedFinish: t.plannedFinish,
        })),
      };

      sources.push({
        module: 'pm',
        collection: 'pm_tasks',
        recordCount: tasks.length,
        status: 'grounded',
        summary: `${tasks.length} total tasks (Calculated Completion: ${avgProgress}%, Overdue: ${overdueTasks.length})`,
      });
    } else {
      metrics.pm = {
        totalTasks: 0,
        calculatedOverallProgress: null,
        status: 'unavailable',
        reason: 'No task or progress records found in pm_tasks for this project.',
      };
      warnings.push(`Project "${project.name || project.projectName}" has NO tasks or schedule entries logged in the PM module.`);
      sources.push({
        module: 'pm',
        collection: 'pm_tasks',
        recordCount: 0,
        status: 'unavailable',
        summary: '0 task records found',
      });
    }

    if (delays.length > 0) {
      metrics.delays = delays.map((d: any) => ({
        taskId: d.taskId,
        reason: d.reason,
        impactDays: d.impactDays,
        recordedAt: d.createdAt,
      }));
      sources.push({
        module: 'pm_delays',
        collection: 'pm_delays',
        recordCount: delays.length,
        status: 'grounded',
        summary: `${delays.length} recorded delays logged`,
      });
    }

    // 3. STEEL & REBAR INVENTORY (stockitems & batches)
    const stockItems = await db.collection('stockitems').find({
      ...scopeQuery,
      quantity: { $gt: 0 },
    }).toArray().catch(() => []);

    const batches = await db.collection('batches').find(scopeQuery).sort({ createdAt: -1 }).limit(5).toArray().catch(() => []);

    if (stockItems.length > 0) {
      // Group weight by diameter
      const diameterMap: Record<number, { pieces: number; weightKg: number; standardTons: number; remnantTons: number }> = {};
      let totalLiveKg = 0;

      for (const item of stockItems) {
        const dia = Number(item.diameter) || 0;
        const wt = Number(item.weightInKgs) || 0;
        const qty = Number(item.quantity) || 0;
        const isRemnant = Boolean(item.isRemnant);

        if (!diameterMap[dia]) {
          diameterMap[dia] = { pieces: 0, weightKg: 0, standardTons: 0, remnantTons: 0 };
        }
        diameterMap[dia].pieces += qty;
        diameterMap[dia].weightKg += wt;
        totalLiveKg += wt;
        if (isRemnant) {
          diameterMap[dia].remnantTons += wt / 1000;
        } else {
          diameterMap[dia].standardTons += wt / 1000;
        }
      }

      metrics.steel = {
        totalStockKg: totalLiveKg,
        totalStockMT: (totalLiveKg / 1000).toFixed(2),
        diameterBreakdown: diameterMap,
        totalItemsCount: stockItems.length,
      };

      sources.push({
        module: 'steel',
        collection: 'stockitems',
        recordCount: stockItems.length,
        status: 'grounded',
        summary: `${(totalLiveKg / 1000).toFixed(2)} MT total live rebar across ${stockItems.length} line items`,
      });
    } else {
      metrics.steel = {
        totalStockKg: 0,
        totalStockMT: '0.00',
        status: 'unavailable',
        reason: 'No steel rebar stock entries recorded in stockitems for this project.',
      };
      sources.push({
        module: 'steel',
        collection: 'stockitems',
        recordCount: 0,
        status: 'unavailable',
        summary: '0 rebar stock records found',
      });
    }

    // 4. SITE MATERIALS & CEMENT (gi_materials & gi_stock_balances)
    const [giMaterials, giBalances] = await Promise.all([
      db.collection('gi_materials').find(scopeQuery).toArray().catch(() => []),
      db.collection('gi_stock_balances').find(scopeQuery).toArray().catch(() => []),
    ]);

    if (giMaterials.length > 0) {
      const balanceMap = new Map<string, number>();
      for (const b of giBalances) {
        const mId = String(b.materialId);
        balanceMap.set(mId, (balanceMap.get(mId) || 0) + (Number(b.currentBalance) || 0));
      }

      const materialSummaryList = giMaterials.map((m: any) => {
        const mId = String(m._id);
        const currentQty = balanceMap.get(mId) || 0;
        return {
          name: m.name,
          category: m.category || 'General',
          currentBalance: currentQty,
          unit: m.unit || 'units',
        };
      });

      metrics.materials = materialSummaryList;
      sources.push({
        module: 'general_inventory',
        collection: 'gi_materials',
        recordCount: giMaterials.length,
        status: 'grounded',
        summary: `${giMaterials.length} materials cataloged in site inventory`,
      });
    } else {
      metrics.materials = [];
      sources.push({
        module: 'general_inventory',
        collection: 'gi_materials',
        recordCount: 0,
        status: 'unavailable',
        summary: '0 material records found',
      });
    }

    // 5. CONCRETE CASTING & POUR LOGS (casting_events)
    const castingEvents = await db.collection('casting_events').find({
      ...scopeQuery,
      isDeleted: { $ne: true },
    }).sort({ eventDate: 1 }).toArray().catch(() => []);

    if (castingEvents.length > 0) {
      const pastEvents = castingEvents.filter((e: any) => e.eventDate && e.eventDate < currentDateStr);
      const upcomingEvents = castingEvents.filter((e: any) => !e.eventDate || e.eventDate >= currentDateStr);
      const totalPouredM3 = pastEvents
        .filter((e: any) => e.status === 'COMPLETED' || e.status === 'POURED')
        .reduce((sum: number, e: any) => sum + (Number(e.actualQuantity || e.plannedQuantity) || 0), 0);

      metrics.casting = {
        totalPours: castingEvents.length,
        completedPoursCount: pastEvents.length,
        totalPouredVolumeM3: totalPouredM3.toFixed(1),
        upcomingPours: upcomingEvents.map((e: any) => ({
          castingCode: e.castingCode || 'POUR',
          eventDate: e.eventDate,
          pourLocation: e.pourLocation || 'Site',
          concreteGrade: e.concreteGrade || 'M25',
          plannedQuantityM3: e.plannedQuantity,
          status: e.status,
        })),
      };

      sources.push({
        module: 'casting',
        collection: 'casting_events',
        recordCount: castingEvents.length,
        status: 'grounded',
        summary: `${castingEvents.length} pour events (${totalPouredM3.toFixed(1)} m³ total poured, ${upcomingEvents.length} upcoming)`,
      });
    } else {
      metrics.casting = {
        totalPours: 0,
        totalPouredVolumeM3: '0.0',
        upcomingPours: [],
        status: 'unavailable',
        reason: 'No concrete pour events logged in casting_events for this project.',
      };
      sources.push({
        module: 'casting',
        collection: 'casting_events',
        recordCount: 0,
        status: 'unavailable',
        summary: '0 pour event records found',
      });
    }

    // 6. WORKFORCE & ATTENDANCE (attendance_sessions & attendance_wf_lines)
    const latestAttendanceSession = await db.collection('attendance_sessions').findOne(
      scopeQuery,
      { sort: { date: -1 } }
    ).catch(() => null);

    if (latestAttendanceSession) {
      const sId = latestAttendanceSession._id;
      const wfLines = await db.collection('attendance_wf_lines').find({ sessionId: sId }).toArray().catch(() => []);
      const directLines = await db.collection('attendance_lines').find({ sessionId: sId }).toArray().catch(() => []);

      let contractorLabourCount = 0;
      const contractorBreakdown: Array<{ name: string; count: number; skilled: number; unskilled: number }> = [];

      for (const line of wfLines) {
        const count = Number(line.totalCount) || 0;
        contractorLabourCount += count;
        contractorBreakdown.push({
          name: line.contractorName || 'Contractor',
          count,
          skilled: Number(line.skilled) || 0,
          unskilled: Number(line.unskilled) || 0,
        });
      }

      const directPresentCount = directLines.filter((l: any) => l.status === 'PRESENT').length;
      const totalHeadcount = contractorLabourCount + directPresentCount;

      metrics.workforce = {
        sessionDate: latestAttendanceSession.date,
        totalHeadcount,
        directLabourPresent: directPresentCount,
        contractorLabourCount,
        contractors: contractorBreakdown,
      };

      sources.push({
        module: 'attendance',
        collection: 'attendance_sessions',
        recordCount: 1,
        status: 'grounded',
        summary: `Attendance session for ${latestAttendanceSession.date}: ${totalHeadcount} total workers on site`,
      });
    } else {
      metrics.workforce = {
        totalHeadcount: 0,
        status: 'unavailable',
        reason: 'No attendance sessions recorded in attendance_sessions for this project.',
      };
      sources.push({
        module: 'attendance',
        collection: 'attendance_sessions',
        recordCount: 0,
        status: 'unavailable',
        summary: '0 attendance session records found',
      });
    }

    // 7. FINANCE & PETTY CASH & BUDGET (petty_cash_sites, petty_cash_transactions, pm_costs)
    // Check role-based authorization for financial and budget data
    const isFinanceAuthorized =
      ctx.isCompanyAdmin ||
      ctx.isDeveloper ||
      ctx.roleNormalized === 'ACCOUNTANT' ||
      ctx.roleNormalized === 'FINANCE' ||
      Boolean(userPermissions?.finance || userPermissions?.pettyCash);

    if (!isFinanceAuthorized) {
      metrics.finance = {
        status: 'unauthorized',
        reason: `Access Denied: Your assigned role (${ctx.role}) does not have permission to view project financial records, budgets, or petty cash.`,
      };
      sources.push({
        module: 'finance',
        collection: 'petty_cash_sites / pm_costs',
        recordCount: 0,
        status: 'unauthorized',
        summary: `Financial and budget records restricted for role "${ctx.role}"`,
      });
    } else {
      const [pettySite, costDocs] = await Promise.all([
        db.collection('petty_cash_sites').findOne(scopeQuery).catch(() => null),
        db.collection('pm_costs').find(scopeQuery).toArray().catch(() => []),
      ]);

      let totalPlannedCost = 0;
      let totalActualCost = 0;
      for (const c of costDocs) {
        totalPlannedCost += Number(c.plannedAmount) || 0;
        totalActualCost += Number(c.actualAmount) || 0;
      }

      const budgetUtilizationPct =
        totalPlannedCost > 0 ? Math.round((totalActualCost / totalPlannedCost) * 100) : null;

      if (pettySite || costDocs.length > 0) {
        let pendingAmount = 0;
        let pendingCount = 0;

        if (pettySite) {
          const pendingVouchers = await db
            .collection('petty_cash_transactions')
            .find({
              siteId: String(pettySite._id),
              status: 'PENDING',
            })
            .toArray()
            .catch(() => []);
          pendingCount = pendingVouchers.length;
          pendingAmount = (pendingVouchers as any[]).reduce(
            (sum: number, v: any) => sum + (Number(v.amount) || 0),
            0
          );
        }

        metrics.finance = {
          hasRecords: true,
          totalPlannedCost,
          totalActualCost,
          budgetUtilizationPct,
          pettyCashBalance: pettySite ? Number(pettySite.balance) || 0 : null,
          monthlyLimit: pettySite ? Number(pettySite.monthlyLimit) || 0 : null,
          pendingVouchersCount: pendingCount,
          pendingVouchersTotal: pendingAmount,
        };

        sources.push({
          module: 'finance',
          collection: 'pm_costs / petty_cash',
          recordCount: (costDocs.length || 0) + (pettySite ? 1 : 0),
          status: 'grounded',
          summary: `Finance records: ${costDocs.length} cost items${pettySite ? `, Petty cash ₹${(Number(pettySite.balance) || 0).toLocaleString('en-IN')}` : ''}${budgetUtilizationPct !== null ? `, Budget utilization: ${budgetUtilizationPct}%` : ''}`,
        });
      } else {
        metrics.finance = {
          hasRecords: false,
          totalPlannedCost: 0,
          totalActualCost: 0,
          budgetUtilizationPct: null,
          pettyCashBalance: null,
          status: 'unavailable',
          reason: 'No budget, cost, or petty cash accounts configured in pm_costs or petty_cash_sites for this project.',
        };
        sources.push({
          module: 'finance',
          collection: 'pm_costs / petty_cash',
          recordCount: 0,
          status: 'unavailable',
          summary: '0 financial/cost records found',
        });
      }
    }

    // 8. PROCUREMENT & PURCHASE ORDERS (procurement status)
    // Note: Purchase orders are not yet a separate active collection in DB (flagged truthful in reports)
    metrics.procurement = {
      purchaseOrdersCount: 0,
      pendingOrdersCount: 0,
      status: 'unavailable',
      reason: 'No purchase orders or procurement order records exist in the database for this project.',
    };
    sources.push({
      module: 'procurement',
      collection: 'purchase_orders',
      recordCount: 0,
      status: 'unavailable',
      summary: '0 purchase orders found in database',
    });

    // 8. REAL ESTATE CRM (crm_units & crm_bookings)
    const [crmUnits, crmBookings] = await Promise.all([
      db.collection('crm_units').find(scopeQuery).toArray().catch(() => []),
      db.collection('crm_bookings').find(scopeQuery).toArray().catch(() => []),
    ]);

    if (crmUnits.length > 0) {
      const available = crmUnits.filter((u: any) => u.status === 'AVAILABLE');
      const hold = crmUnits.filter((u: any) => u.status === 'HOLD');
      const booked = crmUnits.filter((u: any) => u.status === 'BOOKED');

      metrics.crm = {
        totalUnits: crmUnits.length,
        availableCount: available.length,
        holdCount: hold.length,
        bookedCount: booked.length,
        confirmedBookingsCount: crmBookings.length,
      };

      sources.push({
        module: 'crm',
        collection: 'crm_units',
        recordCount: crmUnits.length,
        status: 'grounded',
        summary: `${crmUnits.length} total units (${available.length} available, ${booked.length} booked)`,
      });
    } else {
      metrics.crm = {
        totalUnits: 0,
        status: 'unavailable',
        reason: 'No CRM units recorded for this project.',
      };
      sources.push({
        module: 'crm',
        collection: 'crm_units',
        recordCount: 0,
        status: 'unavailable',
        summary: '0 CRM units found',
      });
    }

    // 9. DRAWINGS & DOCUMENTS (doc_drawings)
    const drawings = await db.collection('doc_drawings').find(scopeQuery).toArray().catch(() => []);
    if (drawings.length > 0) {
      metrics.drawings = {
        totalDrawings: drawings.length,
        disciplines: Array.from(new Set(drawings.map((d: any) => d.discipline).filter(Boolean))),
      };
      sources.push({
        module: 'drawings',
        collection: 'doc_drawings',
        recordCount: drawings.length,
        status: 'grounded',
        summary: `${drawings.length} drawings cataloged`,
      });
    } else {
      metrics.drawings = {
        totalDrawings: 0,
        status: 'unavailable',
      };
      sources.push({
        module: 'drawings',
        collection: 'doc_drawings',
        recordCount: 0,
        status: 'unavailable',
        summary: '0 drawing records found',
      });
    }

    // 10. COMPILE GROUND-TRUTH FACTS BRIEF
    let factsBrief = `### GROUND-TRUTH DATABASE AUDIT (As of ${now.toISOString()} | Server Date: ${currentDateStr})
PROJECT DETAILS:
- Name: "${metrics.project.name}" (ID: ${metrics.project.id})
- Status: ${metrics.project.status}
- Project Type: ${metrics.project.projectType}
- Tower/Blocks: ${metrics.project.blocksCount > 0 ? `${metrics.project.blocksCount} Blocks (${metrics.project.blockNames.join(', ')})` : 'DATA UNAVAILABLE: 0 blocks cataloged in database'}
- Floors: ${metrics.project.floorsCount > 0 ? `${metrics.project.floorsCount} Floors` : 'DATA UNAVAILABLE: 0 floors cataloged in database'}

PROJECT SCHEDULE & TASKS:
${metrics.pm.totalTasks > 0
        ? `- Total Tasks in WBS: ${metrics.pm.totalTasks}
- Completed Tasks: ${metrics.pm.completedTasksCount}
- In-Progress Tasks: ${metrics.pm.inProgressTasksCount}
- Overdue Tasks: ${metrics.pm.overdueTasksCount} ${metrics.pm.overdueList.length > 0 ? `(Overdue: ${metrics.pm.overdueList.map((t: any) => `${t.name} due ${t.plannedFinish}`).join('; ')})` : ''}
- Verified Average Progress: ${metrics.pm.calculatedOverallProgress}%`
        : `- Project Completion: DATA UNAVAILABLE IN DATABASE (0 task or schedule entries exist in pm_tasks). DO NOT INVENT A PERCENTAGE.`
      }

STEEL & REBAR INVENTORY:
${metrics.steel.totalStockKg > 0
        ? `- Total Live Steel Stock: ${metrics.steel.totalStockMT} MT (${metrics.steel.totalStockKg.toLocaleString()} kg) across ${metrics.steel.totalItemsCount} line items.
- Breakdown by Diameter: ${Object.entries(metrics.steel.diameterBreakdown).map(([dia, data]: [string, any]) => `${dia}mm: ${(data.weightKg / 1000).toFixed(2)} MT (${data.pieces} bars)`).join(', ')}`
        : `- Steel Inventory: DATA UNAVAILABLE IN DATABASE (0 stock items recorded in stockitems). DO NOT INVENT REBAR TONNAGE.`
      }

CONCRETE & CASTING POURS:
${metrics.casting.totalPours > 0
        ? `- Total Pours Recorded: ${metrics.casting.totalPours}
- Total Poured Volume: ${metrics.casting.totalPouredVolumeM3} m³
- Upcoming Scheduled Pours: ${metrics.casting.upcomingPours.length > 0 ? metrics.casting.upcomingPours.map((p: any) => `${p.castingCode} on ${p.eventDate} (${p.concreteGrade}, ${p.plannedQuantityM3 || '?'} m³, Location: ${p.pourLocation})`).join('; ') : 'None scheduled after ' + currentDateStr}`
        : `- Concrete Pours: DATA UNAVAILABLE IN DATABASE (0 casting events recorded in casting_events). DO NOT INVENT CONCRETE VOLUME OR CASTING DATES.`
      }

WORKFORCE & ATTENDANCE:
${metrics.workforce.totalHeadcount > 0
        ? `- Most Recent Attendance Date: ${metrics.workforce.sessionDate}
- Total Verified Headcount: ${metrics.workforce.totalHeadcount} workers (Direct Labour: ${metrics.workforce.directLabourPresent}, Contractor Labour: ${metrics.workforce.contractorLabourCount})
- Contractors: ${metrics.workforce.contractors.map((c: any) => `${c.name}: ${c.count} workers`).join(', ')}`
        : `- Workforce Attendance: DATA UNAVAILABLE IN DATABASE (0 attendance sessions recorded in attendance_sessions). DO NOT INVENT WORKER HEADCOUNT.`
      }

SITE MATERIALS (CEMENT & GENERAL INVENTORY):
${metrics.materials.length > 0
        ? `- Cataloged Materials: ${metrics.materials.map((m: any) => `${m.name}: ${m.currentBalance} ${m.unit}`).join(', ')}`
        : `- Cement & Site Materials: DATA UNAVAILABLE IN DATABASE (0 materials recorded in gi_materials). DO NOT INVENT MATERIAL QUANTITIES.`
      }

FINANCIAL & BUDGET UTILIZATION:
${metrics.finance.status === 'unauthorized'
        ? `- Access Denied: User role ("${ctx.role}") is NOT AUTHORIZED to view financial records, project budgets, or petty cash. Strictly state that financial information is restricted and requires Accountant or Company Admin privileges. DO NOT DISCLOSE FINANCIAL INFORMATION.`
        : metrics.finance.hasRecords
          ? `- Total Planned Project Cost: ₹${metrics.finance.totalPlannedCost.toLocaleString('en-IN')}
- Total Actual Project Cost: ₹${metrics.finance.totalActualCost.toLocaleString('en-IN')}
- Verified Budget Utilization: ${metrics.finance.budgetUtilizationPct !== null ? `${metrics.finance.budgetUtilizationPct}%` : 'Not calculable (planned cost is zero)'}
${metrics.finance.pettyCashBalance !== null ? `- Site Petty Cash Balance: ₹${metrics.finance.pettyCashBalance.toLocaleString('en-IN')}` : ''}
${metrics.finance.pendingVouchersCount > 0 ? `- Pending Vouchers: ${metrics.finance.pendingVouchersCount} vouchers totaling ₹${metrics.finance.pendingVouchersTotal.toLocaleString('en-IN')}` : ''}`
          : `- Budget & Financials: DATA UNAVAILABLE IN DATABASE (0 budget/cost records logged in pm_costs or petty cash for this project). State: "Information is not available in the connected project records." DO NOT INVENT BUDGET PERCENTAGES.`
      }

PROCUREMENT & PURCHASE ORDERS:
- Purchase Orders: DATA UNAVAILABLE IN DATABASE (0 purchase order or procurement records exist in the database for this project). State: "Information is not available in the connected project records." DO NOT INVENT PURCHASE ORDERS, VENDOR NAMES, OR DATES.

REAL ESTATE CRM:
${metrics.crm.totalUnits > 0
        ? `- Total Units: ${metrics.crm.totalUnits} (Available: ${metrics.crm.availableCount}, Hold: ${metrics.crm.holdCount}, Booked: ${metrics.crm.bookedCount})`
        : `- CRM Units: DATA UNAVAILABLE IN DATABASE (0 units cataloged in crm_units).`
      }
`;

    return {
      projectId: pidStr,
      projectName: project.name || project.projectName,
      projectStatus: project.status || 'active',
      asOf: now.toISOString(),
      currentServerDate: currentDateStr,
      sources,
      warnings,
      metrics,
      groundedFactsText: factsBrief,
    };
  }
}
