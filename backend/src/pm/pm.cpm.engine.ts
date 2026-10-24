import { PmTask, PmDependency, ProjectCalendar, ScheduleSimulationResult } from './pm.types';

export class CpmSchedulingEngine {
  /**
   * Checks if a given date is a working day based on project calendar.
   */
  public static isWorkingDay(date: Date, calendar: ProjectCalendar): boolean {
    const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
    
    // Check days per week
    if (calendar.workingDaysPerWeek === 5) {
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    } else if (calendar.workingDaysPerWeek === 6) {
      if (dayOfWeek === 0) return false; // Sunday off, Saturday is working
    }
    
    // Check holiday list
    const ymd = date.toISOString().split('T')[0];
    if (calendar.holidays && calendar.holidays.includes(ymd)) {
      return false;
    }
    
    return true;
  }

  /**
   * Adds working days to a start date.
   */
  public static addWorkingDays(startDateStr: string, workingDays: number, calendar: ProjectCalendar): string {
    if (!startDateStr) startDateStr = new Date().toISOString().split('T')[0];
    if (workingDays <= 0) return startDateStr;

    const current = new Date(startDateStr);
    let added = 0;

    // Advance until we've added the required working days
    while (added < workingDays) {
      current.setDate(current.getDate() + 1);
      if (this.isWorkingDay(current, calendar)) {
        added++;
      }
    }

    return current.toISOString().split('T')[0];
  }

  /**
   * Calculates the number of working days between two dates inclusive.
   */
  public static countWorkingDays(startDateStr: string, endDateStr: string, calendar: ProjectCalendar): number {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      if (this.isWorkingDay(cur, calendar)) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  /**
   * Detects circular dependencies in the task graph using DFS.
   */
  public static detectCycle(taskIds: string[], dependencies: PmDependency[]): string[] | null {
    const adj = new Map<string, string[]>();
    taskIds.forEach(id => adj.set(id, []));
    dependencies.forEach(dep => {
      const preds = adj.get(dep.predecessorTaskId) || [];
      preds.push(dep.taskId);
      adj.set(dep.predecessorTaskId, preds);
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          path.push(neighbor);
          return true; // Cycle detected
        }
      }

      recStack.delete(node);
      path.pop();
      return false;
    };

    for (const taskId of taskIds) {
      if (!visited.has(taskId)) {
        if (dfs(taskId)) return path;
      }
    }

    return null;
  }

  /**
   * Topologically sorts task IDs.
   */
  public static topologicalSort(taskIds: string[], dependencies: PmDependency[]): string[] {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    taskIds.forEach(id => {
      inDegree.set(id, 0);
      adj.set(id, []);
    });

    dependencies.forEach(dep => {
      if (inDegree.has(dep.taskId)) {
        inDegree.set(dep.taskId, (inDegree.get(dep.taskId) || 0) + 1);
      }
      const successors = adj.get(dep.predecessorTaskId) || [];
      successors.push(dep.taskId);
      adj.set(dep.predecessorTaskId, successors);
    });

    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const order: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      order.push(u);

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        const newDeg = (inDegree.get(v) || 1) - 1;
        inDegree.set(v, newDeg);
        if (newDeg === 0) queue.push(v);
      }
    }

    // Append any unvisited tasks (isolated or fallback)
    taskIds.forEach(id => {
      if (!order.includes(id)) order.push(id);
    });

    return order;
  }

  /**
   * Recalculates Critical Path Method (CPM) for a project.
   * Updates earlyStart, earlyFinish, lateStart, lateFinish, totalFloatDays, isCritical, forecastStart, forecastFinish.
   */
  public static calculateSchedule(
    projectPlannedStart: string,
    tasks: PmTask[],
    dependencies: PmDependency[],
    calendar: ProjectCalendar
  ): { tasks: PmTask[]; projectForecastFinish: string; criticalPathLengthDays: number } {
    if (!tasks || tasks.length === 0) {
      return { tasks: [], projectForecastFinish: projectPlannedStart, criticalPathLengthDays: 0 };
    }

    const taskMap = new Map<string, PmTask>();
    tasks.forEach(t => taskMap.set(String(t._id), { ...t }));
    const taskIds = Array.from(taskMap.keys());

    // 1. Verify acyclic graph
    const cycle = this.detectCycle(taskIds, dependencies);
    if (cycle) {
      throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
    }

    // 2. Topological sort for forward pass
    const sortedIds = this.topologicalSort(taskIds, dependencies);

    // Group predecessor and successor mappings
    const predMap = new Map<string, PmDependency[]>();
    const succMap = new Map<string, PmDependency[]>();
    taskIds.forEach(id => {
      predMap.set(id, []);
      succMap.set(id, []);
    });
    dependencies.forEach(d => {
      if (predMap.has(d.taskId)) predMap.get(d.taskId)!.push(d);
      if (succMap.has(d.predecessorTaskId)) succMap.get(d.predecessorTaskId)!.push(d);
    });

    // 3. Forward Pass: Calculate Early Start (ES) and Early Finish (EF)
    let maxProjectEF = projectPlannedStart;

    for (const taskId of sortedIds) {
      const task = taskMap.get(taskId)!;
      const preds = predMap.get(taskId) || [];

      let es = projectPlannedStart;
      if (task.plannedStart && task.plannedStart > es) {
        es = task.plannedStart;
      }

      for (const dep of preds) {
        const predTask = taskMap.get(dep.predecessorTaskId);
        if (!predTask) continue;

        let candidateES = es;
        const lag = dep.lagDays || 0;

        if (dep.type === 'FS') {
          // Finish-to-Start: starts after predecessor finishes + lag
          candidateES = this.addWorkingDays(predTask.earlyFinish || predTask.plannedFinish, lag + 1, calendar);
        } else if (dep.type === 'SS') {
          // Start-to-Start: starts with predecessor + lag
          candidateES = this.addWorkingDays(predTask.earlyStart || predTask.plannedStart, lag, calendar);
        } else if (dep.type === 'FF') {
          // Finish-to-Finish: finishes with predecessor finish + lag
          const predEF = predTask.earlyFinish || predTask.plannedFinish;
          const targetEF = this.addWorkingDays(predEF, lag, calendar);
          candidateES = this.addWorkingDays(targetEF, -(task.durationDays - 1), calendar);
        }

        if (candidateES > es) {
          es = candidateES;
        }
      }

      const duration = Math.max(1, task.durationDays || 1);
      const ef = this.addWorkingDays(es, duration - 1, calendar);

      task.earlyStart = es;
      task.earlyFinish = ef;
      task.forecastStart = es;
      task.forecastFinish = ef;

      if (ef > maxProjectEF) {
        maxProjectEF = ef;
      }
    }

    // 4. Backward Pass: Calculate Late Finish (LF) and Late Start (LS)
    const reversedIds = [...sortedIds].reverse();

    for (const taskId of reversedIds) {
      const task = taskMap.get(taskId)!;
      const succs = succMap.get(taskId) || [];

      let lf = maxProjectEF;

      if (succs.length > 0) {
        for (const dep of succs) {
          const succTask = taskMap.get(dep.taskId);
          if (!succTask) continue;

          let candidateLF = lf;
          const lag = dep.lagDays || 0;

          if (dep.type === 'FS') {
            // LF must be before successor's late start minus lag
            candidateLF = this.addWorkingDays(succTask.lateStart || succTask.earlyStart!, -(lag + 1), calendar);
          } else if (dep.type === 'FF') {
            candidateLF = this.addWorkingDays(succTask.lateFinish || succTask.earlyFinish!, -lag, calendar);
          }

          if (candidateLF < lf) {
            lf = candidateLF;
          }
        }
      }

      const duration = Math.max(1, task.durationDays || 1);
      const ls = this.addWorkingDays(lf, -(duration - 1), calendar);

      task.lateStart = ls;
      task.lateFinish = lf;

      // 5. Total Float: LF - EF (in working days)
      const totalFloat = this.countWorkingDays(task.earlyFinish!, task.lateFinish!, calendar) - 1;
      task.totalFloatDays = Math.max(0, totalFloat);
      
      // Critical path is tasks with 0 or minimum float
      task.isCritical = task.totalFloatDays === 0;
    }

    const calculatedTasks = Array.from(taskMap.values());
    const criticalLength = this.countWorkingDays(projectPlannedStart, maxProjectEF, calendar);

    return {
      tasks: calculatedTasks,
      projectForecastFinish: maxProjectEF,
      criticalPathLengthDays: criticalLength
    };
  }

  /**
   * Simulates the exact schedule impact of a delay on a task without saving to database.
   * Returns affected tasks, float consumption, and whether project completion slips.
   */
  public static simulateDelay(
    projectPlannedStart: string,
    tasks: PmTask[],
    dependencies: PmDependency[],
    calendar: ProjectCalendar,
    delayedTaskId: string,
    delayDays: number
  ): ScheduleSimulationResult {
    // 1. Calculate baseline current schedule
    const current = this.calculateSchedule(projectPlannedStart, tasks, dependencies, calendar);
    const delayedTask = current.tasks.find(t => String(t._id) === String(delayedTaskId));
    if (!delayedTask) {
      throw new Error(`Delayed task ${delayedTaskId} not found in project`);
    }

    // 2. Clone tasks and apply delay to targeted task
    const modifiedTasks = current.tasks.map(t => {
      const copy = { ...t };
      if (String(copy._id) === String(delayedTaskId)) {
        copy.durationDays += delayDays;
        copy.remainingDurationDays = (copy.remainingDurationDays || copy.durationDays) + delayDays;
      }
      return copy;
    });

    // 3. Recalculate full CPM with modified task
    const simulated = this.calculateSchedule(projectPlannedStart, modifiedTasks, dependencies, calendar);

    // 4. Trace affected downstream tasks and float consumption
    const affectedTasks: ScheduleSimulationResult['affectedTasks'] = [];

    simulated.tasks.forEach(simTask => {
      const origTask = current.tasks.find(t => String(t._id) === String(simTask._id))!;
      const startShifted = origTask.forecastStart !== simTask.forecastStart;
      const finishShifted = origTask.forecastFinish !== simTask.forecastFinish;

      if (startShifted || finishShifted || String(simTask._id) === String(delayedTaskId)) {
        const slip = this.countWorkingDays(origTask.forecastFinish!, simTask.forecastFinish!, calendar) - 1;
        const origFloat = origTask.totalFloatDays || 0;
        const newFloat = simTask.totalFloatDays || 0;
        const floatConsumed = Math.max(0, origFloat - newFloat);

        affectedTasks.push({
          taskId: String(simTask._id),
          taskName: simTask.name,
          originalForecastStart: origTask.forecastStart!,
          originalForecastFinish: origTask.forecastFinish!,
          revisedForecastStart: simTask.forecastStart!,
          revisedForecastFinish: simTask.forecastFinish!,
          slipDays: Math.max(0, slip),
          floatConsumedDays: floatConsumed,
          becameCritical: !origTask.isCritical && !!simTask.isCritical
        });
      }
    });

    const origProjectFinish = current.projectForecastFinish;
    const newProjectFinish = simulated.projectForecastFinish;
    const projectDelayDays = Math.max(0, this.countWorkingDays(origProjectFinish, newProjectFinish, calendar) - 1);

    return {
      delayedTaskId,
      delayDays,
      originalProjectForecastFinish: origProjectFinish,
      revisedProjectForecastFinish: newProjectFinish,
      projectDelayDays,
      criticalPathAffected: projectDelayDays > 0 || delayedTask.isCritical || false,
      tasksAffectedCount: affectedTasks.length,
      affectedTasks
    };
  }
}
