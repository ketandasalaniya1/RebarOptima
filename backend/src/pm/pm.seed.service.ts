import { Db, ObjectId } from 'mongodb';
import { PmService } from './pm.service';

export async function seedSampleProjectData(db: Db, companyId: string, userEmail: string = 'admin@enterprise.com'): Promise<{ success: boolean; projectId: string; taskCount: number }> {
  const pmService = new PmService(() => db);

  // Check if sample project already exists
  const existing = await db.collection('pm_projects').findOne({ companyId, code: 'SKY-TOW-01' });
  if (existing) {
    return { success: true, projectId: existing._id.toString(), taskCount: await db.collection('pm_tasks').countDocuments({ companyId, projectId: existing._id.toString() }) };
  }

  const today = new Date();
  const plannedStart = new Date(today);
  plannedStart.setDate(today.getDate() - 20);
  const startStr = plannedStart.toISOString().split('T')[0];

  // 1. Create Sample Project
  const project = await pmService.createProject(companyId, {
    name: 'Skyline Pinnacle Tower — Substructure & Frame',
    code: 'SKY-TOW-01',
    description: 'High-rise residential tower G+24 with double basement raft foundation and Grade M40 RCC frame.',
    location: 'Sector 62, Business Bay Zone, Site Plot 14',
    projectManager: 'Er. Rajesh Varma (PMP)',
    teamMembers: ['Er. Amit Saxena (Senior Site Engg)', 'Pooja Nair (Planning Lead)', 'Suresh Patel (QA/QC)'],
    plannedStart: startStr,
    approvedBudget: 45000000, // 4.5 Crores INR
    calendar: {
      workingDaysPerWeek: 6, // Mon-Sat
      weeklyOffDays: [0], // Sundays off
      workStartTime: '08:00',
      workEndTime: '17:30',
      lunchBreak: { name: 'Lunch Break', startTime: '12:30', endTime: '13:30', durationMinutes: 60 },
      recessIntervals: [
        { name: 'Morning Tea / Briefing', startTime: '10:15', endTime: '10:30', durationMinutes: 15 },
        { name: 'Afternoon Recess', startTime: '15:30', endTime: '15:45', durationMinutes: 15 }
      ],
      workingHoursPerDay: 8.0,
      holidays: ['2026-08-15', '2026-10-02', '2026-11-08'],
      holidayList: [
        { date: '2026-08-15', name: 'Independence Day', type: 'PUBLIC' },
        { date: '2026-10-02', name: 'Gandhi Jayanti', type: 'PUBLIC' },
        { date: '2026-11-08', name: 'Diwali Site Holiday', type: 'PUBLIC' }
      ]
    },
    status: 'ACTIVE'
  });

  const projectId = String(project._id);

  // 2. Define Work Breakdown Structure (WBS) Tasks
  const taskDefs = [
    // Phase 1: Raft Foundation
    { name: '1.0 Raft Foundation & Substructure', wbs: '1.0', parent: null, duration: 24, isMilestone: false, plannedCost: 8500000, plannedQty: 100, unit: '%' },
    { name: '1.1 Deep Excavation & Soil Dewatering', wbs: '1.1', parent: '1.0', duration: 6, isMilestone: false, plannedCost: 900000, plannedQty: 4500, unit: 'm3', role: 'Excavation Contractor', progress: 100 },
    { name: '1.2 Plain Cement Concrete (PCC) Bedding', wbs: '1.2', parent: '1.0', duration: 3, isMilestone: false, plannedCost: 450000, plannedQty: 320, unit: 'm3', role: 'Civil Contractor', progress: 100 },
    { name: '1.3 Raft Bottom Rebar Mat & Shear Links', wbs: '1.3', parent: '1.0', duration: 7, isMilestone: false, plannedCost: 2800000, plannedQty: 145, unit: 'MT', role: 'Steel Fixer Lead', progress: 100, reqInspection: true },
    { name: '1.4 Raft Top Rebar & Column Starter Dowels', wbs: '1.4', parent: '1.0', duration: 5, isMilestone: false, plannedCost: 2200000, plannedQty: 110, unit: 'MT', role: 'Steel Fixer Lead', progress: 100, reqInspection: true },
    { name: '1.5 Mass Concreting Raft Slab (M40 Self-Compacting)', wbs: '1.5', parent: '1.0', duration: 3, isMilestone: false, plannedCost: 2150000, plannedQty: 1250, unit: 'm3', role: 'RMC Supplier', progress: 100 },
    { name: '★ Milestone: Foundation Sign-off & Handover', wbs: '1.6', parent: '1.0', duration: 1, isMilestone: true, plannedCost: 0, plannedQty: 1, unit: 'Sign', role: 'Chief Structural Consultant', progress: 100 },

    // Phase 2: Basement Columns & Retaining Wall
    { name: '2.0 Basement Columns & Perimeter Wall', wbs: '2.0', parent: null, duration: 18, isMilestone: false, plannedCost: 6500000, plannedQty: 100, unit: '%' },
    { name: '2.1 Perimeter Retaining Wall Reinforcement & Water-stops', wbs: '2.1', parent: '2.0', duration: 6, isMilestone: false, plannedCost: 1950000, plannedQty: 68, unit: 'MT', role: 'Senior Site Engineer', progress: 85, reqInspection: true },
    { name: '2.2 Basement Columns Shuttering & Rebar Cage', wbs: '2.2', parent: '2.0', duration: 5, isMilestone: false, plannedCost: 1800000, plannedQty: 42, unit: 'Columns', role: 'Formwork Foreman', progress: 60 },
    { name: '2.3 Retaining Wall & Column Concreting', wbs: '2.3', parent: '2.0', duration: 4, isMilestone: false, plannedCost: 1600000, plannedQty: 380, unit: 'm3', role: 'RMC Supplier', progress: 20 },
    { name: '2.4 De-shuttering & Membrane Curing', wbs: '2.4', parent: '2.0', duration: 3, isMilestone: false, plannedCost: 350000, plannedQty: 1400, unit: 'm2', role: 'Site Supervisor', progress: 0 },

    // Phase 3: Podium Slab Level 1
    { name: '3.0 Podium Slab & Level 1 RCC Frame', wbs: '3.0', parent: null, duration: 16, isMilestone: false, plannedCost: 7800000, plannedQty: 100, unit: '%' },
    { name: '3.1 Slab Staging & Plywood Formwork', wbs: '3.1', parent: '3.0', duration: 6, isMilestone: false, plannedCost: 1400000, plannedQty: 1600, unit: 'm2', role: 'Scaffolding Team', progress: 0 },
    { name: '3.2 Slab Main Beams & Two-Way Rebar Mesh', wbs: '3.2', parent: '3.0', duration: 5, isMilestone: false, plannedCost: 3100000, plannedQty: 92, unit: 'MT', role: 'Steel Fixer Lead', progress: 0, reqInspection: true },
    { name: '3.3 Electrical & Plumbing Conduit Sleeves Insertion', wbs: '3.3', parent: '3.0', duration: 3, isMilestone: false, plannedCost: 650000, plannedQty: 180, unit: 'Points', role: 'MEP Contractor', progress: 0 },
    { name: '3.4 Level 1 Slab Concreting (M35 Grade)', wbs: '3.4', parent: '3.0', duration: 2, isMilestone: false, plannedCost: 2650000, plannedQty: 620, unit: 'm3', role: 'RMC Supplier', progress: 0 },
    { name: '★ Milestone: Superstructure Podium Complete', wbs: '3.5', parent: '3.0', duration: 1, isMilestone: true, plannedCost: 0, plannedQty: 1, unit: 'Approval', role: 'Project Director', progress: 0 }
  ];

  const createdTasks: Record<string, any> = {};

  for (const t of taskDefs) {
    const parentId = t.parent ? createdTasks[t.parent]?._id : null;
    const task = await pmService.createTask(companyId, projectId, {
      name: t.name,
      wbsCode: t.wbs,
      parentId,
      durationDays: t.duration,
      isMilestone: t.isMilestone,
      plannedCost: t.plannedCost,
      plannedQty: t.plannedQty,
      unit: t.unit,
      assignedRole: t.role,
      assignedUserName: 'Er. Amit Saxena',
      progressPercentage: t.progress || 0,
      requiresInspection: t.reqInspection || false
    });
    createdTasks[t.wbs] = task;
  }

  // 3. Define Predecessor Dependencies
  const depLinks = [
    { from: '1.1', to: '1.2', type: 'FS', lag: 0 },
    { from: '1.2', to: '1.3', type: 'FS', lag: 1 },
    { from: '1.3', to: '1.4', type: 'FS', lag: 0 },
    { from: '1.4', to: '1.5', type: 'FS', lag: 1 },
    { from: '1.5', to: '1.6', type: 'FS', lag: 3 }, // 3 days curing before sign-off
    { from: '1.6', to: '2.1', type: 'FS', lag: 0 },
    { from: '1.6', to: '2.2', type: 'FS', lag: 0 },
    { from: '2.1', to: '2.3', type: 'FS', lag: 0 },
    { from: '2.2', to: '2.3', type: 'FS', lag: 0 },
    { from: '2.3', to: '2.4', type: 'FS', lag: 2 },
    { from: '2.4', to: '3.1', type: 'FS', lag: 0 },
    { from: '3.1', to: '3.2', type: 'FS', lag: 0 },
    { from: '3.2', to: '3.3', type: 'SS', lag: 2 }, // MEP starts 2 days into rebar
    { from: '3.2', to: '3.4', type: 'FS', lag: 1 },
    { from: '3.3', to: '3.4', type: 'FS', lag: 0 },
    { from: '3.4', to: '3.5', type: 'FS', lag: 7 } // 7-day cube strength before milestone
  ];

  for (const link of depLinks) {
    const pred = createdTasks[link.from];
    const succ = createdTasks[link.to];
    if (pred && succ) {
      await pmService.createDependency(companyId, projectId, {
        taskId: String(succ._id),
        predecessorTaskId: String(pred._id),
        type: link.type as any,
        lagDays: link.lag
      });
    }
  }

  // Lock initial baseline
  await pmService.lockBaseline(companyId, projectId, userEmail);

  // 4. Seed DPR (Daily Progress Reports)
  const task1_3 = createdTasks['1.3'];
  if (task1_3) {
    await pmService.submitDpr(companyId, projectId, {
      taskId: String(task1_3._id),
      reportDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
      shift: 'DAY',
      supervisorName: 'Suresh Patel (Site Supervisor)',
      plannedQty: 145,
      completedQty: 145,
      acceptedQty: 145,
      unit: 'MT',
      labourCount: 22,
      actualLabourHours: 176,
      equipmentUsed: ['Tower Crane TC-01', 'Bar Bending Machine #2'],
      materialsConsumed: [
        { materialName: 'TMT 25mm Fe550D', quantity: 95, unit: 'MT' },
        { materialName: 'TMT 16mm Fe550D', quantity: 50, unit: 'MT' }
      ],
      remarks: 'Raft foundation bottom mesh completed with cover blocks 75mm verified.'
    });
  }

  // 5. Seed Quality Inspection
  if (task1_3) {
    await pmService.recordInspection(companyId, projectId, {
      taskId: String(task1_3._id),
      inspectionName: 'Pre-Pouring Raft Reinforcement Inspection',
      inspectorName: 'Er. Rajesh Varma (QA/QC Head)',
      inspectionDate: new Date(Date.now() - 9 * 86400000).toISOString().split('T')[0],
      checklistItems: [
        { item: 'Rebar diameter and spacing as per drawing STR-RFT-01', passed: true },
        { item: 'Lap lengths 50d provided with staggering', passed: true },
        { item: 'Cover blocks (75mm concrete M40) placed at 1m grid', passed: true },
        { item: 'Chairs provided for top mat support (16mm)', passed: true }
      ],
      outcome: 'PASSED'
    });
  }

  // 6. Seed Delay Record on Task 2.1
  const task2_1 = createdTasks['2.1'];
  if (task2_1) {
    await pmService.recordDelayAndReschedule(companyId, projectId, {
      taskId: String(task2_1._id),
      delayDays: 3,
      category: 'MATERIAL_SHORTAGE',
      reason: 'Delayed dispatch of 32mm couplers and water-stops from manufacturer warehouse',
      recordedBy: 'Er. Amit Saxena',
      recoveryAction: 'Mobilized additional steel-fixing shift to recover 1.5 days during column cage assembly'
    });
  }

  // 7. Seed Manpower Workforce
  await pmService.createManpower(companyId, projectId, {
    name: 'Er. Amit Saxena',
    role: 'Senior Site Engineer',
    category: 'STAFF',
    headcount: 1,
    dailyCapacityHours: 8.0,
    contactPhone: '+91 98201 12345',
    skills: ['RCC Execution', 'Bar Bending Inspection', 'Pour Card Signoff']
  });

  await pmService.createManpower(companyId, projectId, {
    name: 'Pooja Nair',
    role: 'Planning Lead',
    category: 'STAFF',
    headcount: 1,
    dailyCapacityHours: 8.0,
    contactPhone: '+91 98202 23456',
    skills: ['Primavera P6', 'CPM Scheduling', 'WBS Management']
  });

  await pmService.createManpower(companyId, projectId, {
    name: 'Suresh Patel',
    role: 'QA/QC Lead Inspector',
    category: 'STAFF',
    headcount: 1,
    dailyCapacityHours: 8.0,
    contactPhone: '+91 98203 34567',
    skills: ['Concrete Slump Tests', 'Rebar Cover Verification', 'Cube Compressive Strength']
  });

  await pmService.createManpower(companyId, projectId, {
    name: 'Gang A — Raft Rebar Bending & Placing Crew',
    role: 'Steel Fixer Lead',
    category: 'LABOUR_GANG',
    headcount: 14,
    dailyCapacityHours: 8.0,
    contactPhone: '+91 98450 88765',
    skills: ['Heavy Bar Bending (32mm)', 'Shear Link Tying', 'Chair Stool Fabrication']
  });

  await pmService.createManpower(companyId, projectId, {
    name: 'Gang B — Formwork & Shuttering Carpentry Team',
    role: 'Formwork Foreman',
    category: 'LABOUR_GANG',
    headcount: 10,
    dailyCapacityHours: 8.0,
    contactPhone: '+91 98450 88766',
    skills: ['Plywood Formwork', 'Column Box Alignment', 'Water-stop Fixing']
  });

  await pmService.createManpower(companyId, projectId, {
    name: 'Apex Earthmovers & Shoring Services',
    role: 'Excavation Contractor',
    category: 'SUBCONTRACTOR',
    headcount: 6,
    dailyCapacityHours: 10.0,
    contactPhone: '+91 98110 55432',
    skills: ['Excavators 20T', 'Dewatering Pumps', 'Muck Haulage Dumpers']
  });

  // 7. Seed Cost Entries
  await pmService.addCostEntry(companyId, projectId, {
    category: 'MATERIAL',
    description: 'Procurement of 255 MT Fe550D TMT Steel for Foundation & Retaining Wall',
    plannedAmount: 14000000,
    actualAmount: 13650000,
    date: startStr
  });

  await pmService.addCostEntry(companyId, projectId, {
    category: 'LABOUR',
    description: 'Foundation rebar bending and placing labour contract',
    plannedAmount: 1250000,
    actualAmount: 1200000,
    date: startStr
  });

  return {
    success: true,
    projectId,
    taskCount: Object.keys(createdTasks).length
  };
}
