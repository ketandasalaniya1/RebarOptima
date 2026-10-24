import { Db, ObjectId } from 'mongodb';
import { PmProject, PmTask, PmDependency, PmDelayRecord, PmDailyProgressReport, PmQualityInspection, PmCostEntry, ScheduleSimulationResult } from './pm.types';
import { CpmSchedulingEngine } from './pm.cpm.engine';

export class PmService {
  constructor(private getDb: () => Db | null) {}

  private db(): Db {
    const database = this.getDb();
    if (!database) throw new Error('Database connection unavailable');
    return database;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PROJECTS
  // ══════════════════════════════════════════════════════════════════════════════
  async getProjects(companyId: string): Promise<PmProject[]> {
    const list = await this.db().collection('pm_projects').find({ companyId }).sort({ createdAt: -1 }).toArray();
    return list.map(p => ({ ...p, _id: p._id.toString() })) as any;
  }

  async getProjectById(companyId: string, projectId: string): Promise<PmProject | null> {
    const p = await this.db().collection('pm_projects').findOne({ _id: new ObjectId(projectId), companyId });
    return p ? ({ ...p, _id: p._id.toString() } as any) : null;
  }

  async createProject(companyId: string, data: Partial<PmProject>): Promise<PmProject> {
    const now = new Date();
    const plannedStart = data.plannedStart || now.toISOString().split('T')[0];
    const baselineFinish = data.baselineFinish || CpmSchedulingEngine.addWorkingDays(plannedStart, 30, data.calendar || { workingDaysPerWeek: 6, workingHoursPerDay: 8, holidays: [] });

    const newProject: PmProject = {
      companyId,
      name: data.name || 'Untitled Project',
      code: data.code || `PRJ-${Date.now().toString().slice(-4)}`,
      description: data.description || '',
      location: data.location || '',
      projectManager: data.projectManager || 'Project Manager',
      teamMembers: data.teamMembers || [],
      plannedStart,
      baselineFinish,
      forecastFinish: baselineFinish,
      approvedBudget: Number(data.approvedBudget) || 0,
      calendar: data.calendar || { workingDaysPerWeek: 6, workingHoursPerDay: 8, holidays: [] },
      status: data.status || 'PLANNING',
      progressPercentage: 0,
      isBaselineLocked: false,
      createdAt: now,
      updatedAt: now
    };

    const result = await this.db().collection('pm_projects').insertOne(newProject as any);
    return { ...newProject, _id: result.insertedId.toString() };
  }

  async updateProject(companyId: string, projectId: string, updateData: Partial<PmProject>): Promise<PmProject | null> {
    const now = new Date();
    const cleanUpdates = { ...updateData, updatedAt: now };
    delete (cleanUpdates as any)._id;
    delete (cleanUpdates as any).companyId;

    await this.db().collection('pm_projects').updateOne(
      { _id: new ObjectId(projectId), companyId },
      { $set: cleanUpdates }
    );
    return this.getProjectById(companyId, projectId);
  }

  async lockBaseline(companyId: string, projectId: string, userEmail: string): Promise<PmProject | null> {
    const project = await this.getProjectById(companyId, projectId);
    if (!project) throw new Error('Project not found');

    const tasks = await this.getTasks(companyId, projectId);
    const now = new Date().toISOString();

    // Lock baseline on project and copy forecast to baseline on all tasks
    await this.db().collection('pm_projects').updateOne(
      { _id: new ObjectId(projectId), companyId },
      {
        $set: {
          isBaselineLocked: true,
          baselineLockedAt: now,
          baselineLockedBy: userEmail,
          baselineFinish: project.forecastFinish,
          updatedAt: new Date()
        }
      }
    );

    for (const t of tasks) {
      await this.db().collection('pm_tasks').updateOne(
        { _id: new ObjectId(String(t._id)) },
        {
          $set: {
            baselineStart: t.forecastStart,
            baselineFinish: t.forecastFinish,
            updatedAt: new Date()
          }
        }
      );
    }

    return this.getProjectById(companyId, projectId);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TASKS
  // ══════════════════════════════════════════════════════════════════════════════
  async getTasks(companyId: string, projectId: string): Promise<PmTask[]> {
    const list = await this.db().collection('pm_tasks').find({ companyId, projectId }).sort({ sortOrder: 1, createdAt: 1 }).toArray();
    return list.map(t => ({ ...t, _id: t._id.toString() })) as any;
  }

  async createTask(companyId: string, projectId: string, data: Partial<PmTask>): Promise<PmTask> {
    const now = new Date();
    const project = await this.getProjectById(companyId, projectId);
    if (!project) throw new Error('Project not found');

    const plannedStart = data.plannedStart || project.plannedStart;
    const duration = Math.max(1, Number(data.durationDays) || 1);
    const plannedFinish = data.plannedFinish || CpmSchedulingEngine.addWorkingDays(plannedStart, duration - 1, project.calendar);

    const taskCount = await this.db().collection('pm_tasks').countDocuments({ companyId, projectId });

    const newTask: PmTask = {
      companyId,
      projectId,
      parentId: data.parentId || null,
      wbsCode: data.wbsCode || `1.${taskCount + 1}`,
      name: data.name || 'New Task',
      description: data.description || '',
      status: data.status || 'NOT_STARTED',
      priority: data.priority || 'MEDIUM',
      isMilestone: !!data.isMilestone,
      plannedStart,
      plannedFinish,
      baselineStart: plannedStart,
      baselineFinish: plannedFinish,
      forecastStart: plannedStart,
      forecastFinish: plannedFinish,
      durationDays: duration,
      remainingDurationDays: duration,
      progressPercentage: Number(data.progressPercentage) || 0,
      plannedQty: Number(data.plannedQty) || 0,
      completedQty: 0,
      acceptedQty: 0,
      unit: data.unit || 'Units',
      plannedCost: Number(data.plannedCost) || 0,
      actualCost: 0,
      assignedRole: data.assignedRole || 'Site Engineer',
      assignedUserName: data.assignedUserName || '',
      assignedUserId: data.assignedUserId || '',
      requiresInspection: !!data.requiresInspection,
      inspectionPassed: false,
      sortOrder: taskCount + 1,
      createdAt: now,
      updatedAt: now
    };

    const res = await this.db().collection('pm_tasks').insertOne(newTask as any);
    const created = { ...newTask, _id: res.insertedId.toString() };

    // Trigger CPM recalculation
    await this.recalculateProjectCPM(companyId, projectId);

    return created;
  }

  async updateTask(companyId: string, taskId: string, data: Partial<PmTask>): Promise<PmTask | null> {
    const task = await this.db().collection('pm_tasks').findOne({ _id: new ObjectId(taskId), companyId });
    if (!task) return null;

    const cleanUpdates = { ...data, updatedAt: new Date() };
    delete (cleanUpdates as any)._id;
    delete (cleanUpdates as any).companyId;
    delete (cleanUpdates as any).projectId;

    await this.db().collection('pm_tasks').updateOne(
      { _id: new ObjectId(taskId), companyId },
      { $set: cleanUpdates }
    );

    // If duration, dates, or progress changed, recalculate schedule and project overall progress
    await this.recalculateProjectCPM(companyId, task.projectId);

    const updated = await this.db().collection('pm_tasks').findOne({ _id: new ObjectId(taskId) });
    return updated ? ({ ...updated, _id: updated._id.toString() } as any) : null;
  }

  async deleteTask(companyId: string, taskId: string): Promise<boolean> {
    const task = await this.db().collection('pm_tasks').findOne({ _id: new ObjectId(taskId), companyId });
    if (!task) return false;

    // Delete task and its dependencies
    await this.db().collection('pm_tasks').deleteOne({ _id: new ObjectId(taskId) });
    await this.db().collection('pm_dependencies').deleteMany({
      companyId,
      $or: [{ taskId }, { predecessorTaskId: taskId }]
    });

    await this.recalculateProjectCPM(companyId, task.projectId);
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DEPENDENCIES
  // ══════════════════════════════════════════════════════════════════════════════
  async getDependencies(companyId: string, projectId: string): Promise<PmDependency[]> {
    const list = await this.db().collection('pm_dependencies').find({ companyId, projectId }).toArray();
    return list.map(d => ({ ...d, _id: d._id.toString() })) as any;
  }

  async createDependency(companyId: string, projectId: string, dep: { taskId: string; predecessorTaskId: string; type?: 'FS' | 'SS' | 'FF' | 'SF'; lagDays?: number }): Promise<PmDependency> {
    if (dep.taskId === dep.predecessorTaskId) {
      throw new Error('A task cannot depend on itself');
    }

    const currentDeps = await this.getDependencies(companyId, projectId);
    const tasks = await this.getTasks(companyId, projectId);

    const testDeps = [...currentDeps, {
      companyId,
      projectId,
      taskId: dep.taskId,
      predecessorTaskId: dep.predecessorTaskId,
      type: dep.type || 'FS',
      lagDays: Number(dep.lagDays) || 0,
      createdAt: new Date()
    }];

    // Check for circular dependency
    const cycle = CpmSchedulingEngine.detectCycle(tasks.map(t => String(t._id)), testDeps);
    if (cycle) {
      throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
    }

    const newDep: PmDependency = {
      companyId,
      projectId,
      taskId: dep.taskId,
      predecessorTaskId: dep.predecessorTaskId,
      type: dep.type || 'FS',
      lagDays: Number(dep.lagDays) || 0,
      createdAt: new Date()
    };

    const res = await this.db().collection('pm_dependencies').insertOne(newDep as any);
    await this.recalculateProjectCPM(companyId, projectId);

    return { ...newDep, _id: res.insertedId.toString() };
  }

  async deleteDependency(companyId: string, dependencyId: string): Promise<boolean> {
    const dep = await this.db().collection('pm_dependencies').findOne({ _id: new ObjectId(dependencyId), companyId });
    if (!dep) return false;

    await this.db().collection('pm_dependencies').deleteOne({ _id: new ObjectId(dependencyId) });
    await this.recalculateProjectCPM(companyId, dep.projectId);
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // CPM & DELAY MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════════
  async recalculateProjectCPM(companyId: string, projectId: string): Promise<void> {
    const project = await this.getProjectById(companyId, projectId);
    if (!project) return;

    const tasks = await this.getTasks(companyId, projectId);
    const dependencies = await this.getDependencies(companyId, projectId);

    if (tasks.length === 0) return;

    const result = CpmSchedulingEngine.calculateSchedule(project.plannedStart, tasks, dependencies, project.calendar);

    // Batch update tasks with CPM dates & floats
    for (const t of result.tasks) {
      await this.db().collection('pm_tasks').updateOne(
        { _id: new ObjectId(String(t._id)) },
        {
          $set: {
            earlyStart: t.earlyStart,
            earlyFinish: t.earlyFinish,
            lateStart: t.lateStart,
            lateFinish: t.lateFinish,
            forecastStart: t.forecastStart,
            forecastFinish: t.forecastFinish,
            totalFloatDays: t.totalFloatDays,
            isCritical: t.isCritical,
            updatedAt: new Date()
          }
        }
      );
    }

    // Calculate overall project progress
    const totalPlannedCost = tasks.reduce((sum, t) => sum + (t.plannedCost || 1), 0);
    const weightedProgress = tasks.reduce((sum, t) => sum + ((t.progressPercentage || 0) * (t.plannedCost || 1)), 0);
    const overallProgress = totalPlannedCost > 0 ? Math.round(weightedProgress / totalPlannedCost) : 0;

    // Check project status health
    let status = project.status;
    if (result.projectForecastFinish > project.baselineFinish && project.isBaselineLocked) {
      status = 'DELAYED';
    } else if (overallProgress > 0 && overallProgress < 100) {
      status = 'ACTIVE';
    } else if (overallProgress >= 100) {
      status = 'COMPLETED';
    }

    await this.db().collection('pm_projects').updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          forecastFinish: result.projectForecastFinish,
          criticalPathLengthDays: result.criticalPathLengthDays,
          progressPercentage: overallProgress,
          status,
          updatedAt: new Date()
        }
      }
    );
  }

  async previewDelaySimulation(companyId: string, projectId: string, taskId: string, delayDays: number): Promise<ScheduleSimulationResult> {
    const project = await this.getProjectById(companyId, projectId);
    if (!project) throw new Error('Project not found');

    const tasks = await this.getTasks(companyId, projectId);
    const dependencies = await this.getDependencies(companyId, projectId);

    return CpmSchedulingEngine.simulateDelay(project.plannedStart, tasks, dependencies, project.calendar, taskId, delayDays);
  }

  async recordDelayAndReschedule(companyId: string, projectId: string, payload: {
    taskId: string;
    delayDays: number;
    delayUnit?: 'working_days' | 'calendar_days';
    category: any;
    reason: string;
    delayStartDate?: string;
    recordedBy: string;
    recoveryAction?: string;
  }): Promise<{ delayRecord: PmDelayRecord; simulation: ScheduleSimulationResult }> {
    const simulation = await this.previewDelaySimulation(companyId, projectId, payload.taskId, payload.delayDays);
    const project = await this.getProjectById(companyId, projectId);
    if (!project) throw new Error('Project not found');

    const task = await this.db().collection('pm_tasks').findOne({ _id: new ObjectId(payload.taskId), companyId });
    if (!task) throw new Error('Task not found');

    // 1. Update task duration
    const newDuration = task.durationDays + payload.delayDays;
    const newRemaining = (task.remainingDurationDays || task.durationDays) + payload.delayDays;
    await this.db().collection('pm_tasks').updateOne(
      { _id: new ObjectId(payload.taskId) },
      {
        $set: {
          durationDays: newDuration,
          remainingDurationDays: newRemaining,
          status: 'BLOCKED',
          updatedAt: new Date()
        }
      }
    );

    // 2. Recalculate schedule
    await this.recalculateProjectCPM(companyId, projectId);

    // 3. Create delay audit record
    const delayRecord: PmDelayRecord = {
      companyId,
      projectId,
      taskId: payload.taskId,
      delayDurationDays: payload.delayDays,
      delayUnit: payload.delayUnit || 'working_days',
      category: payload.category || 'OTHER',
      reason: payload.reason,
      delayStartDate: payload.delayStartDate || new Date().toISOString().split('T')[0],
      recordedBy: payload.recordedBy,
      recoveryAction: payload.recoveryAction || '',
      previousForecastFinish: simulation.originalProjectForecastFinish,
      newForecastFinish: simulation.revisedProjectForecastFinish,
      scheduleSlipDays: simulation.projectDelayDays,
      affectedTaskIds: simulation.affectedTasks.map(t => t.taskId),
      downstreamSummary: `${simulation.tasksAffectedCount} downstream tasks affected. Project finish slipped by ${simulation.projectDelayDays} working days.`,
      createdAt: new Date()
    };

    const res = await this.db().collection('pm_delays').insertOne(delayRecord as any);
    return {
      delayRecord: { ...delayRecord, _id: res.insertedId.toString() },
      simulation
    };
  }

  async getDelayRecords(companyId: string, projectId: string): Promise<PmDelayRecord[]> {
    const list = await this.db().collection('pm_delays').find({ companyId, projectId }).sort({ createdAt: -1 }).toArray();
    return list.map(d => ({ ...d, _id: d._id.toString() })) as any;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DAILY PROGRESS REPORTS (DPR)
  // ══════════════════════════════════════════════════════════════════════════════
  async getDprList(companyId: string, projectId: string): Promise<PmDailyProgressReport[]> {
    const list = await this.db().collection('pm_dpr').find({ companyId, projectId }).sort({ reportDate: -1, createdAt: -1 }).toArray();
    return list.map(r => ({ ...r, _id: r._id.toString() })) as any;
  }

  async submitDpr(companyId: string, projectId: string, data: Partial<PmDailyProgressReport>): Promise<PmDailyProgressReport> {
    const task = await this.db().collection('pm_tasks').findOne({ _id: new ObjectId(data.taskId), companyId });
    if (!task) throw new Error('Task not found for this progress report');

    const dpr: PmDailyProgressReport = {
      companyId,
      projectId,
      taskId: data.taskId!,
      reportDate: data.reportDate || new Date().toISOString().split('T')[0],
      shift: data.shift || 'DAY',
      supervisorName: data.supervisorName || 'Site Supervisor',
      plannedQty: Number(data.plannedQty) || 0,
      completedQty: Number(data.completedQty) || 0,
      acceptedQty: Number(data.acceptedQty) || Number(data.completedQty) || 0,
      unit: data.unit || task.unit || 'Units',
      labourCount: Number(data.labourCount) || 1,
      actualLabourHours: Number(data.actualLabourHours) || 8,
      equipmentUsed: data.equipmentUsed || [],
      materialsConsumed: data.materialsConsumed || [],
      remarks: data.remarks || '',
      photos: data.photos || [],
      workRestrictions: data.workRestrictions || '',
      status: 'SUBMITTED',
      createdAt: new Date()
    };

    const res = await this.db().collection('pm_dpr').insertOne(dpr as any);
    return { ...dpr, _id: res.insertedId.toString() };
  }

  async approveDpr(companyId: string, dprId: string, approvedBy: string): Promise<PmDailyProgressReport | null> {
    const dpr = await this.db().collection('pm_dpr').findOne({ _id: new ObjectId(dprId), companyId });
    if (!dpr) return null;

    const now = new Date().toISOString();
    await this.db().collection('pm_dpr').updateOne(
      { _id: new ObjectId(dprId) },
      { $set: { status: 'APPROVED', reviewedBy: approvedBy, reviewedAt: now } }
    );

    // Update accepted quantity on task and recalculate task progress %
    const task = await this.db().collection('pm_tasks').findOne({ _id: new ObjectId(dpr.taskId) });
    if (task) {
      const newAccepted = (task.acceptedQty || 0) + dpr.acceptedQty;
      const planned = task.plannedQty || 1;
      const progress = Math.min(100, Math.round((newAccepted / planned) * 100));
      const status = progress >= 100 ? 'COMPLETED' : 'IN_PROGRESS';

      await this.db().collection('pm_tasks').updateOne(
        { _id: new ObjectId(dpr.taskId) },
        {
          $set: {
            acceptedQty: newAccepted,
            completedQty: (task.completedQty || 0) + dpr.completedQty,
            progressPercentage: progress,
            status,
            actualStart: task.actualStart || dpr.reportDate,
            actualFinish: progress >= 100 ? dpr.reportDate : undefined,
            updatedAt: new Date()
          }
        }
      );

      await this.recalculateProjectCPM(companyId, dpr.projectId);
    }

    const updated = await this.db().collection('pm_dpr').findOne({ _id: new ObjectId(dprId) });
    return updated ? ({ ...updated, _id: updated._id.toString() } as any) : null;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // QUALITY INSPECTIONS
  // ══════════════════════════════════════════════════════════════════════════════
  async getInspections(companyId: string, projectId: string): Promise<PmQualityInspection[]> {
    const list = await this.db().collection('pm_inspections').find({ companyId, projectId }).sort({ inspectionDate: -1 }).toArray();
    return list.map(i => ({ ...i, _id: i._id.toString() })) as any;
  }

  async recordInspection(companyId: string, projectId: string, data: Partial<PmQualityInspection>): Promise<PmQualityInspection> {
    const inspection: PmQualityInspection = {
      companyId,
      projectId,
      taskId: data.taskId!,
      inspectionName: data.inspectionName || 'Quality Check',
      inspectorName: data.inspectorName || 'QA Engineer',
      inspectionDate: data.inspectionDate || new Date().toISOString().split('T')[0],
      checklistItems: data.checklistItems || [],
      outcome: data.outcome || 'PASSED',
      defectDescription: data.defectDescription || '',
      reworkAssignedTo: data.reworkAssignedTo || '',
      reworkDueDate: data.reworkDueDate || '',
      status: data.outcome === 'PASSED' ? 'RESOLVED' : 'OPEN',
      createdAt: new Date()
    };

    const res = await this.db().collection('pm_inspections').insertOne(inspection as any);

    // Update task quality state
    if (data.outcome === 'PASSED') {
      await this.db().collection('pm_tasks').updateOne(
        { _id: new ObjectId(data.taskId) },
        { $set: { inspectionPassed: true, updatedAt: new Date() } }
      );
    } else if (data.outcome === 'FAILED' || data.outcome === 'REWORK_REQUIRED') {
      await this.db().collection('pm_tasks').updateOne(
        { _id: new ObjectId(data.taskId) },
        { $set: { inspectionPassed: false, status: 'REWORK_REQUIRED', updatedAt: new Date() } }
      );
    }

    return { ...inspection, _id: res.insertedId.toString() };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // COSTS & PRODUCTIVITY
  // ══════════════════════════════════════════════════════════════════════════════
  async getCosts(companyId: string, projectId: string): Promise<PmCostEntry[]> {
    const list = await this.db().collection('pm_costs').find({ companyId, projectId }).sort({ date: -1 }).toArray();
    return list.map(c => ({ ...c, _id: c._id.toString() })) as any;
  }

  async addCostEntry(companyId: string, projectId: string, data: Partial<PmCostEntry>): Promise<PmCostEntry> {
    const cost: PmCostEntry = {
      companyId,
      projectId,
      taskId: data.taskId,
      category: data.category || 'LABOUR',
      description: data.description || '',
      plannedAmount: Number(data.plannedAmount) || 0,
      actualAmount: Number(data.actualAmount) || 0,
      currency: 'INR',
      date: data.date || new Date().toISOString().split('T')[0],
      createdAt: new Date()
    };

    const res = await this.db().collection('pm_costs').insertOne(cost as any);
    return { ...cost, _id: res.insertedId.toString() };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // EXECUTIVE KPI ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════════
  async getExecutiveKPIs(companyId: string): Promise<any> {
    const projects = await this.getProjects(companyId);
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
    const delayedProjects = projects.filter(p => p.status === 'DELAYED' || p.status === 'AT_RISK').length;
    const completedProjects = projects.filter(p => p.status === 'COMPLETED').length;

    const allTasks = await this.db().collection('pm_tasks').find({ companyId }).toArray();
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'COMPLETED').length;
    const criticalTasks = allTasks.filter(t => t.isCritical).length;
    const overdueTasks = allTasks.filter(t => {
      const today = new Date().toISOString().split('T')[0];
      return t.status !== 'COMPLETED' && t.forecastFinish < today;
    }).length;

    const totalBudget = projects.reduce((sum, p) => sum + (p.approvedBudget || 0), 0);
    const allCosts = await this.db().collection('pm_costs').find({ companyId }).toArray();
    const actualSpend = allCosts.reduce((sum, c) => sum + (c.actualAmount || 0), 0);

    return {
      totalProjects,
      activeProjects,
      delayedProjects,
      completedProjects,
      totalTasks,
      completedTasks,
      criticalTasks,
      overdueTasks,
      totalBudget,
      actualSpend,
      costVariance: totalBudget - actualSpend,
      averageProgress: totalProjects > 0 ? Math.round(projects.reduce((sum, p) => sum + (p.progressPercentage || 0), 0) / totalProjects) : 0
    };
  }
}
