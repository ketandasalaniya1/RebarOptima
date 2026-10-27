import { Db, ObjectId } from 'mongodb';
import { 
  PmProject, 
  PmTask, 
  PmDependency, 
  PmDelayRecord, 
  PmDailyProgressReport, 
  PmQualityInspection, 
  PmCostEntry, 
  ScheduleSimulationResult,
  ProjectCalendar,
  ManpowerResource,
  ManpowerConflict,
  ProjectReschedulePreviewResult
} from './pm.types';
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

  // ══════════════════════════════════════════════════════════════════════════════
  // CALENDAR & WORKING HOURS
  // ══════════════════════════════════════════════════════════════════════════════
  async updateProjectCalendar(companyId: string, projectId: string, calendarData: Partial<ProjectCalendar>): Promise<PmProject | null> {
    const project = await this.getProjectById(companyId, projectId);
    if (!project) throw new Error('Project not found');

    const workingDaysPerWeek = calendarData.workingDaysPerWeek || project.calendar?.workingDaysPerWeek || 6;
    const weeklyOffDays = calendarData.weeklyOffDays || (workingDaysPerWeek === 5 ? [0, 6] : workingDaysPerWeek === 6 ? [0] : []);
    const workStartTime = calendarData.workStartTime || project.calendar?.workStartTime || '08:00';
    const workEndTime = calendarData.workEndTime || project.calendar?.workEndTime || '17:30';
    const lunchBreak = calendarData.lunchBreak || project.calendar?.lunchBreak || { name: 'Lunch Break', startTime: '12:30', endTime: '13:30', durationMinutes: 60 };
    const recessIntervals = calendarData.recessIntervals || project.calendar?.recessIntervals || [];
    const holidays = calendarData.holidays || project.calendar?.holidays || [];
    const holidayList = calendarData.holidayList || project.calendar?.holidayList || [];

    const totalRecessMins = recessIntervals.reduce((acc, r) => acc + (Number(r.durationMinutes) || 0), 0);
    const netWorkingHours = CpmSchedulingEngine.calculateNetWorkingHours(
      workStartTime,
      workEndTime,
      lunchBreak.durationMinutes || 60,
      totalRecessMins
    );

    const mergedCalendar: ProjectCalendar = {
      workingDaysPerWeek,
      weeklyOffDays,
      workStartTime,
      workEndTime,
      lunchBreak,
      recessIntervals,
      workingHoursPerDay: netWorkingHours > 0 ? netWorkingHours : (calendarData.workingHoursPerDay || 8),
      holidays,
      holidayList
    };

    await this.db().collection('pm_projects').updateOne(
      { _id: new ObjectId(projectId), companyId },
      {
        $set: {
          calendar: mergedCalendar,
          updatedAt: new Date()
        }
      }
    );

    // Recalculate CPM schedule with updated working calendar
    await this.recalculateProjectCPM(companyId, projectId);
    return this.getProjectById(companyId, projectId);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // GANTT START DATE RESCHEDULING & PREVIEW
  // ══════════════════════════════════════════════════════════════════════════════
  async previewRescheduleProjectStartDate(companyId: string, projectId: string, newPlannedStart: string): Promise<ProjectReschedulePreviewResult> {
    const project = await this.getProjectById(companyId, projectId);
    if (!project) throw new Error('Project not found');

    const tasks = await this.getTasks(companyId, projectId);
    const dependencies = await this.getDependencies(companyId, projectId);

    const simulation = CpmSchedulingEngine.calculateSchedule(newPlannedStart, tasks, dependencies, project.calendar);

    const oldStart = project.plannedStart;
    const oldFinish = project.forecastFinish;
    const newFinish = simulation.projectForecastFinish;

    const shiftCalDays = Math.round((new Date(newPlannedStart).getTime() - new Date(oldStart).getTime()) / (1000 * 60 * 60 * 24));
    const shiftWorkDays = shiftCalDays >= 0
      ? CpmSchedulingEngine.countWorkingDays(oldStart, newPlannedStart, project.calendar) - 1
      : -(CpmSchedulingEngine.countWorkingDays(newPlannedStart, oldStart, project.calendar) - 1);

    const affectedTasks = simulation.tasks.map(simTask => {
      const origTask = tasks.find(t => String(t._id) === String(simTask._id))!;
      return {
        taskId: String(simTask._id),
        wbsCode: simTask.wbsCode,
        taskName: simTask.name,
        durationDays: simTask.durationDays,
        originalForecastStart: origTask.forecastStart || origTask.plannedStart,
        originalForecastFinish: origTask.forecastFinish || origTask.plannedFinish,
        revisedForecastStart: simTask.forecastStart,
        revisedForecastFinish: simTask.forecastFinish,
        isMilestone: !!simTask.isMilestone,
        isCritical: !!simTask.isCritical
      };
    });

    return {
      projectId,
      oldPlannedStart: oldStart,
      newPlannedStart,
      shiftWorkingDays: shiftWorkDays,
      shiftCalendarDays: shiftCalDays,
      oldForecastFinish: oldFinish,
      newForecastFinish: newFinish,
      tasksCount: affectedTasks.length,
      affectedTasks
    };
  }

  async confirmRescheduleProjectStartDate(companyId: string, projectId: string, newPlannedStart: string, userEmail: string = 'admin'): Promise<PmProject | null> {
    const project = await this.getProjectById(companyId, projectId);
    if (!project) throw new Error('Project not found');

    const tasks = await this.getTasks(companyId, projectId);
    const dependencies = await this.getDependencies(companyId, projectId);

    // Calculate new schedule strictly preserving durations and dependencies
    const result = CpmSchedulingEngine.calculateSchedule(newPlannedStart, tasks, dependencies, project.calendar);

    // Update all tasks while preserving baseline commitments
    for (const t of result.tasks) {
      await this.db().collection('pm_tasks').updateOne(
        { _id: new ObjectId(String(t._id)) },
        {
          $set: {
            plannedStart: t.forecastStart,
            plannedFinish: t.forecastFinish,
            forecastStart: t.forecastStart,
            forecastFinish: t.forecastFinish,
            earlyStart: t.earlyStart,
            earlyFinish: t.earlyFinish,
            lateStart: t.lateStart,
            lateFinish: t.lateFinish,
            totalFloatDays: t.totalFloatDays,
            isCritical: t.isCritical,
            updatedAt: new Date()
          }
        }
      );
    }

    // Update project dates
    await this.db().collection('pm_projects').updateOne(
      { _id: new ObjectId(projectId), companyId },
      {
        $set: {
          plannedStart: newPlannedStart,
          forecastFinish: result.projectForecastFinish,
          criticalPathLengthDays: result.criticalPathLengthDays,
          updatedAt: new Date()
        }
      }
    );

    // Record audit event
    await this.db().collection('activity_logs').insertOne({
      companyId,
      action: 'RESCHEDULE_PROJECT_START_DATE',
      module: 'projectManagement',
      projectId,
      userEmail,
      details: {
        previousPlannedStart: project.plannedStart,
        newPlannedStart,
        previousForecastFinish: project.forecastFinish,
        newForecastFinish: result.projectForecastFinish
      },
      createdAt: new Date()
    } as any);

    return this.getProjectById(companyId, projectId);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MANPOWER & WORKFORCE MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════════
  async getManpower(companyId: string, projectId?: string): Promise<ManpowerResource[]> {
    const query: any = { companyId };
    if (projectId) {
      query.$or = [{ projectId }, { projectId: { $exists: false } }, { projectId: null }];
    }
    const list = await this.db().collection('pm_manpower').find(query).sort({ category: 1, name: 1 }).toArray();
    return list.map(m => ({ ...m, _id: m._id.toString() })) as any;
  }

  async createManpower(companyId: string, projectId: string, data: Partial<ManpowerResource>): Promise<ManpowerResource> {
    const now = new Date();
    const newResource: ManpowerResource = {
      companyId,
      projectId: data.projectId || projectId,
      name: data.name || 'Untitled Resource',
      role: data.role || 'Site Worker',
      category: data.category || 'LABOUR_GANG',
      headcount: Math.max(1, Number(data.headcount) || 1),
      dailyCapacityHours: Number(data.dailyCapacityHours) || 8.0,
      contactPhone: data.contactPhone || '',
      skills: data.skills || [],
      isActive: data.isActive !== false,
      createdAt: now,
      updatedAt: now
    };

    const res = await this.db().collection('pm_manpower').insertOne(newResource as any);
    return { ...newResource, _id: res.insertedId.toString() };
  }

  async updateManpower(companyId: string, resourceId: string, data: Partial<ManpowerResource>): Promise<ManpowerResource | null> {
    const clean = { ...data, updatedAt: new Date() };
    delete (clean as any)._id;
    delete (clean as any).companyId;

    await this.db().collection('pm_manpower').updateOne(
      { _id: new ObjectId(resourceId), companyId },
      { $set: clean }
    );
    const updated = await this.db().collection('pm_manpower').findOne({ _id: new ObjectId(resourceId), companyId });
    return updated ? ({ ...updated, _id: updated._id.toString() } as any) : null;
  }

  async deleteManpower(companyId: string, resourceId: string): Promise<boolean> {
    const res = await this.db().collection('pm_manpower').deleteOne({ _id: new ObjectId(resourceId), companyId });
    return res.deletedCount > 0;
  }

  async getManpowerConflicts(companyId: string, projectId: string): Promise<ManpowerConflict[]> {
    const resources = await this.getManpower(companyId, projectId);
    const tasks = await this.getTasks(companyId, projectId);
    const conflicts: ManpowerConflict[] = [];

    // Filter active/in-progress/not completed tasks
    const activeTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');

    for (const res of resources) {
      // Find tasks assigned to this resource
      const assignedTasks = activeTasks.filter(t => {
        const matchesName = t.assignedUserName && t.assignedUserName.toLowerCase().includes(res.name.toLowerCase());
        const matchesRole = t.assignedRole && t.assignedRole.toLowerCase() === res.role.toLowerCase();
        const matchesAlloc = t.manpowerAllocations?.some(a => a.resourceId === String(res._id) || a.resourceName === res.name);
        return matchesName || matchesAlloc || (res.category === 'STAFF' && matchesRole);
      });

      if (assignedTasks.length <= 1) continue;

      // Check date overlaps among assigned tasks
      for (let i = 0; i < assignedTasks.length; i++) {
        for (let j = i + 1; j < assignedTasks.length; j++) {
          const t1 = assignedTasks[i];
          const t2 = assignedTasks[j];

          const start1 = t1.forecastStart || t1.plannedStart;
          const finish1 = t1.forecastFinish || t1.plannedFinish;
          const start2 = t2.forecastStart || t2.plannedStart;
          const finish2 = t2.forecastFinish || t2.plannedFinish;

          // Check overlap: max(start1, start2) <= min(finish1, finish2)
          const overlapStart = start1 > start2 ? start1 : start2;
          const overlapFinish = finish1 < finish2 ? finish1 : finish2;

          if (overlapStart <= overlapFinish) {
            const plannedHours1 = t1.manpowerAllocations?.find(a => a.resourceName === res.name)?.plannedDailyHours || (res.dailyCapacityHours / 2);
            const plannedHours2 = t2.manpowerAllocations?.find(a => a.resourceName === res.name)?.plannedDailyHours || (res.dailyCapacityHours / 2);
            const totalHours = plannedHours1 + plannedHours2;

            conflicts.push({
              resourceId: String(res._id),
              resourceName: res.name,
              role: res.role,
              category: res.category,
              headcount: res.headcount,
              dailyCapacityHours: res.dailyCapacityHours,
              conflictDate: `${overlapStart} to ${overlapFinish}`,
              totalAllocatedHours: totalHours,
              tasks: [
                { taskId: String(t1._id), taskName: t1.name, wbsCode: t1.wbsCode, allocatedHours: plannedHours1 },
                { taskId: String(t2._id), taskName: t2.name, wbsCode: t2.wbsCode, allocatedHours: plannedHours2 }
              ],
              severity: totalHours > res.dailyCapacityHours ? 'CRITICAL' : 'WARNING'
            });
          }
        }
      }
    }

    return conflicts;
  }
}
