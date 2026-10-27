import { ObjectId } from 'mongodb';

export type TaskStatus = 'NOT_STARTED' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'UNDER_INSPECTION' | 'REWORK_REQUIRED' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'AT_RISK' | 'DELAYED' | 'COMPLETED' | 'CANCELLED';
export type DelayCategory = 'LABOUR_SHORTAGE' | 'MATERIAL_SHORTAGE' | 'EQUIPMENT_FAILURE' | 'WEATHER' | 'DESIGN_CLARIFICATION' | 'QUALITY_REWORK' | 'SITE_ACCESS' | 'DEPENDENCY_DELAY' | 'CLIENT_APPROVAL' | 'OTHER';

export interface BreakInterval {
  name: string; // e.g. "Lunch Break", "Morning Tea / Recess", "Afternoon Recess"
  startTime: string; // "12:30"
  endTime: string; // "13:30"
  durationMinutes: number; // 60
}

export interface HolidayItem {
  date: string; // YYYY-MM-DD
  name: string; // e.g. "Republic Day", "Monsoon Site Shutdown"
  type: 'PUBLIC' | 'PROJECT_SPECIFIC' | 'WEEKLY_OFF';
}

export interface ProjectCalendar {
  workingDaysPerWeek: 5 | 6 | 7; // 6 is standard in construction (Mon-Sat)
  weeklyOffDays?: number[]; // [0] for Sunday, [0, 6] for Sat-Sun. Default is derived from workingDaysPerWeek
  workStartTime?: string; // "08:00"
  workEndTime?: string; // "17:30"
  lunchBreak?: BreakInterval;
  recessIntervals?: BreakInterval[];
  workingHoursPerDay: number;
  holidays: string[]; // YYYY-MM-DD
  holidayList?: HolidayItem[];
}

export interface ManpowerResource {
  _id?: ObjectId | string;
  companyId: string;
  projectId?: string;
  name: string;
  role: string;
  category: 'STAFF' | 'LABOUR_GANG' | 'SUBCONTRACTOR' | 'SPECIALIST';
  headcount: number;
  dailyCapacityHours: number;
  contactPhone?: string;
  skills?: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TaskManpowerAllocation {
  resourceId: string;
  resourceName: string;
  role: string;
  headcount: number;
  plannedDailyHours: number;
}

export interface ManpowerConflict {
  resourceId: string;
  resourceName: string;
  role: string;
  category: string;
  headcount: number;
  dailyCapacityHours: number;
  conflictDate: string;
  totalAllocatedHours: number;
  tasks: Array<{
    taskId: string;
    taskName: string;
    wbsCode: string;
    allocatedHours: number;
  }>;
  severity: 'CRITICAL' | 'WARNING';
}

export interface ProjectReschedulePreviewResult {
  projectId: string;
  oldPlannedStart: string;
  newPlannedStart: string;
  shiftWorkingDays: number;
  shiftCalendarDays: number;
  oldForecastFinish: string;
  newForecastFinish: string;
  tasksCount: number;
  affectedTasks: Array<{
    taskId: string;
    wbsCode: string;
    taskName: string;
    durationDays: number;
    originalForecastStart: string;
    originalForecastFinish: string;
    revisedForecastStart: string;
    revisedForecastFinish: string;
    isMilestone: boolean;
    isCritical: boolean;
  }>;
}

export interface PmProject {
  _id?: ObjectId | string;
  companyId: string;
  name: string;
  code: string;
  description?: string;
  location?: string;
  projectManager?: string;
  teamMembers?: string[];
  plannedStart: string; // YYYY-MM-DD
  baselineFinish: string; // YYYY-MM-DD
  forecastFinish: string; // YYYY-MM-DD (calculated by CPM)
  actualStart?: string;
  actualFinish?: string;
  approvedBudget: number;
  calendar: ProjectCalendar;
  status: ProjectStatus;
  progressPercentage: number;
  criticalPathLengthDays?: number;
  isBaselineLocked?: boolean;
  baselineLockedAt?: string;
  baselineLockedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PmTask {
  _id?: ObjectId | string;
  companyId: string;
  projectId: string;
  parentId?: string | null; // For recursive WBS hierarchy: Phase -> Work Package -> Task -> Subtask
  wbsCode: string; // e.g. "1.1", "1.2.1"
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  isMilestone: boolean;
  
  // Scheduling & CPM
  plannedStart: string; // YYYY-MM-DD
  plannedFinish: string; // YYYY-MM-DD
  baselineStart?: string;
  baselineFinish?: string;
  forecastStart: string; // YYYY-MM-DD
  forecastFinish: string; // YYYY-MM-DD
  actualStart?: string;
  actualFinish?: string;
  durationDays: number; // working days
  remainingDurationDays: number;
  
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  totalFloatDays?: number;
  freeFloatDays?: number;
  isCritical?: boolean;
  
  // Assignment
  assignedRole?: string; // e.g. 'Site Engineer', 'Steel Fixer Lead', 'Contractor'
  assignedUserName?: string;
  assignedUserId?: string;
  manpowerAllocations?: TaskManpowerAllocation[];
  
  // Progress & Quantities
  plannedQty?: number;
  completedQty?: number;
  acceptedQty?: number;
  unit?: string; // e.g. "MT", "m3", "m2", "Rmt"
  progressPercentage: number;
  
  // Cost
  plannedCost?: number;
  actualCost?: number;
  
  // Inspection gate
  requiresInspection?: boolean;
  inspectionPassed?: boolean;
  
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PmDependency {
  _id?: ObjectId | string;
  companyId: string;
  projectId: string;
  taskId: string; // successor
  predecessorTaskId: string; // predecessor
  type: DependencyType; // Default 'FS' (Finish-to-Start)
  lagDays: number; // working days lag
  createdAt: Date;
}

export interface PmDelayRecord {
  _id?: ObjectId | string;
  companyId: string;
  projectId: string;
  taskId: string;
  delayDurationDays: number;
  delayUnit: 'working_days' | 'calendar_days';
  category: DelayCategory;
  reason: string;
  delayStartDate: string;
  recordedBy: string;
  recoveryAction?: string;
  expectedResolutionDate?: string;
  
  // Downstream impact audit snapshot
  previousForecastFinish: string;
  newForecastFinish: string;
  scheduleSlipDays: number;
  affectedTaskIds: string[];
  downstreamSummary?: string;
  createdAt: Date;
}

export interface PmDailyProgressReport {
  _id?: ObjectId | string;
  companyId: string;
  projectId: string;
  taskId: string;
  reportDate: string; // YYYY-MM-DD
  shift: 'DAY' | 'NIGHT' | 'GENERAL';
  supervisorName: string;
  plannedQty: number;
  completedQty: number;
  acceptedQty: number;
  unit: string;
  labourCount: number;
  actualLabourHours: number;
  equipmentUsed?: string[];
  materialsConsumed?: Array<{ materialName: string; quantity: number; unit: string }>;
  remarks?: string;
  photos?: string[];
  workRestrictions?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: Date;
}

export interface PmQualityInspection {
  _id?: ObjectId | string;
  companyId: string;
  projectId: string;
  taskId: string;
  inspectionName: string;
  inspectorName: string;
  inspectionDate: string;
  checklistItems: Array<{
    item: string;
    passed: boolean;
    remarks?: string;
  }>;
  outcome: 'PASSED' | 'FAILED' | 'REWORK_REQUIRED';
  defectDescription?: string;
  reworkAssignedTo?: string;
  reworkDueDate?: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: Date;
}

export interface PmCostEntry {
  _id?: ObjectId | string;
  companyId: string;
  projectId: string;
  taskId?: string;
  category: 'LABOUR' | 'MATERIAL' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'OVERHEAD';
  description: string;
  plannedAmount: number;
  actualAmount: number;
  currency: string;
  date: string;
  createdAt: Date;
}

export interface ScheduleSimulationResult {
  delayedTaskId: string;
  delayDays: number;
  originalProjectForecastFinish: string;
  revisedProjectForecastFinish: string;
  projectDelayDays: number;
  criticalPathAffected: boolean;
  tasksAffectedCount: number;
  affectedTasks: Array<{
    taskId: string;
    taskName: string;
    originalForecastStart: string;
    originalForecastFinish: string;
    revisedForecastStart: string;
    revisedForecastFinish: string;
    slipDays: number;
    floatConsumedDays: number;
    becameCritical: boolean;
  }>;
}
