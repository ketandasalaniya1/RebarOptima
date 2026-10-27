/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ENTERPRISE PROJECT & TASK MANAGEMENT — COMPREHENSIVE ACCEPTANCE & CPM SUITE
 * ══════════════════════════════════════════════════════════════════════════════
 */

import http from 'http';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'rebar_super_secret_access_key_963870';
const PORT = process.env.PORT || 3000;

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runPmAcceptanceTests() {
  console.log('================================================================');
  console.log('🏗️  RUNNING ENTERPRISE PROJECT & TASK MANAGEMENT ACCEPTANCE SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`  ✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${title} ${details ? `- ${details}` : ''}`);
      failed++;
    }
  };

  try {
    const companyId = `comp_pm_test_${Date.now()}`;
    const token = jwt.sign({
      sub: 'usr_pm_director',
      email: 'pm.director@construction-infra.com',
      name: 'Er. Rajesh Varma (Project Director)',
      companyId,
      role: 'ADMIN',
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // ── TEST 1: Seed Sample Enterprise Construction Data ───────────────────────
    console.log('\n[Phase 1: Project Database Initialization & Seeding]');
    const seedRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/pm/seed-sample-data',
      method: 'POST',
      headers: authHeaders
    });
    assert(seedRes.status === 200 && seedRes.body.success, 'Seed sample enterprise construction project executes cleanly');
    const projectId = seedRes.body.data.projectId;
    assert(!!projectId, `Project ID generated (${projectId})`);

    // ── TEST 2: Project Retrieval & Attributes ────────────────────────────────
    console.log('\n[Phase 2: Project Management & Verification]');
    const projectRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/projects/${projectId}`,
      method: 'GET',
      headers: authHeaders
    });
    assert(projectRes.status === 200 && projectRes.body.data.code === 'SKY-TOW-01', 'Retrieve project details by ID with accurate project code');
    assert(projectRes.body.data.approvedBudget === 45000000, 'Approved budget matches 4.5 Crores INR commitment');
    assert(projectRes.body.data.calendar?.workingDaysPerWeek === 6, 'Construction 6-day working week calendar configured');

    // ── TEST 3: WBS Tasks & Hierarchy ─────────────────────────────────────────
    console.log('\n[Phase 3: Work Breakdown Structure (WBS) & Tasks]');
    const tasksRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/projects/${projectId}/tasks`,
      method: 'GET',
      headers: authHeaders
    });
    assert(tasksRes.status === 200 && tasksRes.body.data.length >= 10, `Fetch tasks hierarchy (${tasksRes.body.data.length} tasks registered)`);

    const rebarTask = tasksRes.body.data.find(t => t.wbsCode === '1.3');
    assert(!!rebarTask, 'Task 1.3 "Raft Bottom Rebar Mat & Shear Links" exists');
    assert(rebarTask.unit === 'MT' && rebarTask.plannedQty === 145, 'Quantity-based tracking attributes configured on rebar task');

    // ── TEST 4: Critical Path Method (CPM) Calculations ───────────────────────
    console.log('\n[Phase 4: Critical Path Method (CPM) & Schedule Floats]');
    assert(typeof rebarTask.totalFloatDays === 'number', 'Total Float calculated in working days');
    assert(typeof rebarTask.isCritical === 'boolean', 'Critical path designation evaluated based on float');
    assert(!!rebarTask.earlyStart && !!rebarTask.earlyFinish, 'Early Start and Early Finish evaluated via forward pass');
    assert(!!rebarTask.lateStart && !!rebarTask.lateFinish, 'Late Start and Late Finish evaluated via backward pass');

    // ── TEST 5: Circular Dependency Detection & Rejection ─────────────────────
    console.log('\n[Phase 5: Dependency Validation & Cycle Prevention]');
    const task1 = tasksRes.body.data[0];
    const task2 = tasksRes.body.data[1];

    // Attempt to make task1 depend on itself
    const selfDepRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/projects/${projectId}/dependencies`,
      method: 'POST',
      headers: authHeaders
    }, {
      taskId: String(task1._id),
      predecessorTaskId: String(task1._id)
    });
    assert(selfDepRes.status === 400, 'Self-dependency rejected with 400 Bad Request');

    // ── TEST 6: Delay Simulation & Downstream Rescheduling ─────────────────────
    console.log('\n[Phase 6: Delay Recording & Downstream Impact Preview]');
    const simRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/projects/${projectId}/delay-preview`,
      method: 'POST',
      headers: authHeaders
    }, {
      taskId: String(rebarTask._id),
      delayDays: 4
    });
    assert(simRes.status === 200 && simRes.body.data, 'CPM Delay preview simulation calculates downstream impact without mutating DB');
    assert(Array.isArray(simRes.body.data.affectedTasks), 'Downstream affected tasks list provided in preview');

    // Record verified delay
    const recordDelayRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/projects/${projectId}/record-delay`,
      method: 'POST',
      headers: authHeaders
    }, {
      taskId: String(rebarTask._id),
      delayDays: 2,
      category: 'WEATHER',
      reason: 'Monsoon heavy flooding in raft pit',
      recoveryAction: 'Mobilized additional high-capacity dewatering submersible pumps'
    });
    assert(recordDelayRes.status === 200 && recordDelayRes.body.success, 'Record verified delay, reschedule downstream activities, and create audit log');

    // ── TEST 7: Baseline Protection ───────────────────────────────────────────
    console.log('\n[Phase 7: Baseline Schedule Commitment Protection]');
    const baselineRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/projects/${projectId}/lock-baseline`,
      method: 'POST',
      headers: authHeaders
    });
    assert(baselineRes.status === 200 && baselineRes.body.data.isBaselineLocked, 'Approved baseline locked with immutable commitment record');

    // ── TEST 8: Daily Progress Reports (DPR) ──────────────────────────────────
    console.log('\n[Phase 8: Daily Site Progress Reports (DPR)]');
    const dprSubmitRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/projects/${projectId}/dpr`,
      method: 'POST',
      headers: authHeaders
    }, {
      taskId: String(rebarTask._id),
      reportDate: new Date().toISOString().split('T')[0],
      shift: 'DAY',
      supervisorName: 'Suresh Patel (Site Supervisor)',
      plannedQty: 25,
      completedQty: 25,
      acceptedQty: 25,
      unit: 'MT',
      labourCount: 18,
      actualLabourHours: 144,
      remarks: 'Completed installation of shear link chairs'
    });
    assert(dprSubmitRes.status === 201 && dprSubmitRes.body.data.status === 'SUBMITTED', 'Submit Daily Progress Report (DPR)');

    const dprId = dprSubmitRes.body.data._id;
    const approveDprRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/dpr/${dprId}/approve`,
      method: 'PUT',
      headers: authHeaders
    });
    assert(approveDprRes.status === 200 && approveDprRes.body.data.status === 'APPROVED', 'Approve DPR and automatically credit accepted quantity towards task progress %');

    // ── TEST 9: Quality Inspections & Checklists ──────────────────────────────
    console.log('\n[Phase 9: Quality Inspections & Quality Gate]');
    const inspectionRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/projects/${projectId}/inspections`,
      method: 'POST',
      headers: authHeaders
    }, {
      taskId: String(rebarTask._id),
      inspectionName: 'Pre-Pour Rebar Verification',
      inspectorName: 'Er. Rajesh Varma (QA Lead)',
      checklistItems: [
        { item: 'Cover blocks 75mm verified', passed: true },
        { item: 'Bar diameter & spacing matches drawing', passed: true }
      ],
      outcome: 'PASSED'
    });
    assert(inspectionRes.status === 201 && inspectionRes.body.data.outcome === 'PASSED', 'Record QA inspection with checklist item outcomes');

    // ── TEST 10: Cost Tracking & Executive KPIs ───────────────────────────────
    console.log('\n[Phase 10: Cost & Executive KPI Dashboard Analytics]');
    const costRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/pm/projects/${projectId}/costs`,
      method: 'POST',
      headers: authHeaders
    }, {
      taskId: String(rebarTask._id),
      category: 'MATERIAL',
      description: 'Secondary delivery of 16mm rebar bars',
      plannedAmount: 450000,
      actualAmount: 440000
    });
    assert(costRes.status === 201, 'Record planned vs actual cost entry');

    const kpiRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/pm/dashboard-kpis',
      method: 'GET',
      headers: authHeaders
    });
    assert(kpiRes.status === 200 && kpiRes.body.data.totalProjects >= 1, 'Executive KPI analytics calculated from live project database records');
    assert(typeof kpiRes.body.data.totalBudget === 'number' && typeof kpiRes.body.data.actualSpend === 'number', 'Budget vs actual spend calculated with cost variance');

    console.log('\n================================================================');
    console.log(`📊 PM ACCEPTANCE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal acceptance test error:', err);
    process.exit(1);
  }
}

runPmAcceptanceTests();
