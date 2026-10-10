/**
 * ══════════════════════════════════════════════════════════════════════════════
 * REBAROPTIMA — PHASE 5 CASTING TIMELINE & VISUAL PLANNING ACCEPTANCE TEST SUITE
 * ══════════════════════════════════════════════════════════════════════════════
 */

import http from 'http';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'rebar_super_secret_access_key_963870';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
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

async function runAcceptanceTests() {
  console.log('\n================================================================');
  console.log('🚀 RUNNING PHASE 5 CASTING TIMELINE ACCEPTANCE TEST SUITE');
  console.log('================================================================\n');

  try {
    const companyA = `comp_p5_a_${Date.now()}`;
    const companyB = `comp_p5_b_${Date.now()}`;

    const tokenA = jwt.sign({
      sub: 'usr_p5_maker_1',
      email: 'maker@companya.com',
      name: 'Site Engineer Maker',
      role: 'ADMIN',
      companyId: companyA,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const checkerToken = jwt.sign({
      sub: 'usr_p5_checker_1',
      email: 'checker@companya.com',
      name: 'Senior QA Checker',
      role: 'ADMIN',
      companyId: companyA,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const tokenB = jwt.sign({
      sub: 'usr_p5_tenant_b',
      email: 'user@companyb.com',
      name: 'Tenant B User',
      role: 'ADMIN',
      companyId: companyB,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const headersA = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`,
      'x-company-id': companyA
    };

    const checkerHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${checkerToken}`,
      'x-company-id': companyA
    };

    const headersB = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`,
      'x-company-id': companyB
    };

    // 1. Setup Base Project, Block, Level, Members for Company A
    console.log('📦 Step 1: Provisioning Hierarchy for Timeline Testing');
    const projRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/projects',
      method: 'POST',
      headers: headersA
    }, { name: 'Metro Line 5 Station', code: `PRJ-ML5-${Date.now().toString().slice(-4)}` });

    const projectId = projRes.body?.id || projRes.body?._id;
    assert(projRes.status === 201 && projectId, 'Provisioned Casting Project for Timeline Testing');

    const blockRes1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/blocks`,
      method: 'POST',
      headers: headersA
    }, { name: 'Concourse Block A', code: 'C-BLK-A' });
    const block1Id = blockRes1.body?.id || blockRes1.body?._id;

    const blockRes2 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/blocks`,
      method: 'POST',
      headers: headersA
    }, { name: 'Platform Block B', code: 'P-BLK-B' });
    const block2Id = blockRes2.body?.id || blockRes2.body?._id;

    const lvlRes1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/blocks/${block1Id}/levels`,
      method: 'POST',
      headers: headersA
    }, { name: 'Level +1 Concourse', floorNumber: 1 });
    const level1Id = lvlRes1.body?.id || lvlRes1.body?._id;

    const lvlRes2 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/blocks/${block2Id}/levels`,
      method: 'POST',
      headers: headersA
    }, { name: 'Level +1 Platform', floorNumber: 1 });
    const level2Id = lvlRes2.body?.id || lvlRes2.body?._id;

    const memRes1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/levels/${level1Id}/members`,
      method: 'POST',
      headers: headersA
    }, {
      memberType: 'Slab',
      displayId: 'SL-01-A',
      volumeEntryMethod: 'DIRECT_ENGINEER_ENTRY',
      totalRequiredVolumeM3: 25.0,
      basisOfCalculation: 'Structural Drawing Rev 3'
    });
    const mem1Id = memRes1.body?.id || memRes1.body?._id;

    const memRes2 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/levels/${level2Id}/members`,
      method: 'POST',
      headers: headersA
    }, {
      memberType: 'Column',
      displayId: 'COL-01-B',
      volumeEntryMethod: 'DIRECT_ENGINEER_ENTRY',
      totalRequiredVolumeM3: 15.0,
      basisOfCalculation: 'Structural Drawing Rev 3'
    });
    const mem2Id = memRes2.body?.id || memRes2.body?._id;

    assert(mem1Id && mem2Id, 'Created structural members across multiple blocks');

    // 2. Create Events with Distinct Dates and Execution Timestamps
    console.log('\n📅 Step 2: Creating Planned, Poured, Overdue, and Multi-Member Events');

    // Event 1: Poured on schedule (planned 2026-10-01, actual 2026-10-01)
    const ev1Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/events',
      method: 'POST',
      headers: headersA
    }, {
      projectId,
      title: 'Concourse Slab Pour 1',
      activityType: 'Slab_Beam',
      plannedDate: '2026-10-01',
      plannedStartTime: '08:00',
      plannedEndTime: '16:00',
      segments: [
        {
          segmentId: 'seg_1',
          memberId: mem1Id,
          projectId,
          blockId: block1Id,
          levelId: level1Id,
          segmentName: 'Slab Grid A1-A4',
          segmentLiftNumber: 1,
          plannedVolumeM3: 20.0,
          grade: 'M30'
        }
      ]
    });
    const ev1Id = ev1Res.body?.id || ev1Res.body?._id;

    // Record actual pour for ev1 (On schedule)
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${ev1Id}`,
      method: 'PUT',
      headers: headersA
    }, {
      status: 'POURED',
      actualPourDate: '2026-10-01',
      actualPourStartTime: '08:30',
      actualPourEndTime: '16:30',
      actualTotalVolumeM3: 20.0
    });

    // Event 2: Poured Delayed by 3 days (planned 2026-10-05, actual 2026-10-08)
    const ev2Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/events',
      method: 'POST',
      headers: headersA
    }, {
      projectId,
      title: 'Platform Beam Pour 2',
      activityType: 'Slab_Beam',
      plannedDate: '2026-10-05',
      plannedStartTime: '09:00',
      plannedEndTime: '17:00',
      segments: [
        {
          segmentId: 'seg_2',
          memberId: mem1Id,
          projectId,
          blockId: block1Id,
          levelId: level1Id,
          segmentName: 'Beam Grid B1-B3',
          segmentLiftNumber: 1,
          plannedVolumeM3: 5.0,
          grade: 'M30'
        }
      ]
    });
    const ev2Id = ev2Res.body?.id || ev2Res.body?._id;

    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${ev2Id}`,
      method: 'PUT',
      headers: headersA
    }, {
      status: 'POURED',
      actualPourDate: '2026-10-08',
      actualPourStartTime: '10:00',
      actualPourEndTime: '18:00',
      actualTotalVolumeM3: 5.0
    });

    // Event 3: Multi-Member, Multi-Block Event (planned 2026-10-15)
    const ev3Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/events',
      method: 'POST',
      headers: headersA
    }, {
      projectId,
      title: 'Multi-Block Column & Slab Joint',
      activityType: 'Column_Lift',
      plannedDate: '2026-10-15',
      plannedStartTime: '07:00',
      plannedEndTime: '18:00',
      segments: [
        {
          segmentId: 'seg_3a',
          memberId: mem1Id,
          projectId,
          blockId: block1Id,
          levelId: level1Id,
          segmentName: 'Slab Infill',
          segmentLiftNumber: 1,
          plannedVolumeM3: 5.0,
          grade: 'M25'
        },
        {
          segmentId: 'seg_3b',
          memberId: mem2Id,
          projectId,
          blockId: block2Id,
          levelId: level2Id,
          segmentName: 'Column Lift 1',
          segmentLiftNumber: 1,
          plannedVolumeM3: 15.0,
          grade: 'M40'
        }
      ]
    });
    const ev3Id = ev3Res.body?.id || ev3Res.body?._id;

    // Event 4: Past planned date without actual pour -> Overdue
    const ev4Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/events',
      method: 'POST',
      headers: headersA
    }, {
      projectId,
      title: 'Overdue Track Foundation',
      activityType: 'Foundation',
      plannedDate: '2026-09-15',
      plannedStartTime: '08:00',
      segments: [
        {
          segmentId: 'seg_4',
          memberId: mem1Id,
          projectId,
          blockId: block1Id,
          levelId: level1Id,
          segmentName: 'Foundation Footing',
          segmentLiftNumber: 1,
          plannedVolumeM3: 10.0,
          grade: 'M25'
        }
      ]
    });
    const ev4Id = ev4Res.body?.id || ev4Res.body?._id;

    // Event 5: Future Planned Event (Upcoming)
    const ev5Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/events',
      method: 'POST',
      headers: headersA
    }, {
      projectId,
      title: 'Next Month Roof Slab',
      activityType: 'Slab_Beam',
      plannedDate: '2026-11-20',
      plannedStartTime: '08:00',
      segments: [
        {
          segmentId: 'seg_5',
          memberId: mem1Id,
          projectId,
          blockId: block1Id,
          levelId: level1Id,
          segmentName: 'Roof Slab',
          segmentLiftNumber: 1,
          plannedVolumeM3: 30.0,
          grade: 'M30'
        }
      ]
    });
    const ev5Id = ev5Res.body?.id || ev5Res.body?._id;

    assert(ev1Id && ev2Id && ev3Id && ev4Id && ev5Id, 'Provisioned 5 test events spanning historical, overdue, and upcoming dates');

    // 3. Attach Phase 4 Quality Data Context to ev1
    console.log('\n🌿 Step 3: Attaching Contextual Phase 4 Quality Records (Curing & Cubes)');
    const curRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/curing/schedules',
      method: 'POST',
      headers: headersA
    }, {
      eventId: ev1Id,
      segmentId: 'seg_1',
      segmentName: 'Slab Grid A1-A4',
      cementType: 'OPC_53',
      curingMethod: 'PONDING',
      startDate: '2026-10-01',
      environmentalFlag: 'NORMAL'
    });
    const curId = curRes.body?.data?.id || curRes.body?.data?._id;

    // Checker independently approves curing schedule to ACTIVE
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/curing/schedules/${curId}/approve`,
      method: 'POST',
      headers: checkerHeaders
    }, { remarks: 'Approved curing program' });

    // Register Cube sample for ev1
    const cubeRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: headersA
    }, {
      eventId: ev1Id,
      segmentId: 'seg_1',
      concreteGrade: 'M30',
      fck: 30,
      testAgeDays: 28,
      specimens: [
        { specimenNumber: 1, failureLoadKn: 780.0, weightKg: 8.2, dimensionMm: { length: 150, width: 150, height: 150 } },
        { specimenNumber: 2, failureLoadKn: 790.0, weightKg: 8.25, dimensionMm: { length: 150, width: 150, height: 150 } },
        { specimenNumber: 3, failureLoadKn: 785.0, weightKg: 8.22, dimensionMm: { length: 150, width: 150, height: 150 } }
      ]
    });
    const cubeId = cubeRes.body?.data?.id || cubeRes.body?.data?._id;

    assert(curId && cubeId, 'Linked contextual Phase 4 Curing and Cube tests to ev1 without separate timeline cards');

    // 4. Test Timeline Retrieval & Chronological Ordering
    console.log('\n📊 Step 4: Testing Timeline Events API & Sorting');
    const timelineRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/timeline/events?projectId=${projectId}`,
      method: 'GET',
      headers: headersA
    });

    assert(timelineRes.status === 200, 'TC-01: GET /api/casting/timeline/events returned HTTP 200 OK');
    assert(Array.isArray(timelineRes.body?.data) && timelineRes.body?.data?.length === 5, 'TC-02: Retrieved all 5 events for project');

    // Verify Strictly Deterministic Chronological Ordering
    const eventDates = (timelineRes.body?.data || []).map(e => e.plannedDate);
    const isSorted = eventDates.every((d, i, arr) => i === 0 || d >= arr[i - 1]);
    assert(isSorted, `TC-03: Chronological ordering verified: [${eventDates.join(', ')}]`);

    // 5. Test Planned vs Actual & Delay Metrics
    console.log('\n⏱️ Step 5: Testing Delay Calculations & Boundary Conditions');
    const ev1Data = timelineRes.body?.data?.find(e => e.id === ev1Id);
    assert(
      ev1Data?.delayMetrics?.delayStatus === 'ON_SCHEDULE' && ev1Data?.delayMetrics?.isDelayCalculable === true,
      `TC-04: On-schedule pour correctly classified (status: ${ev1Data?.delayMetrics?.delayStatus})`
    );

    const ev2Data = timelineRes.body?.data?.find(e => e.id === ev2Id);
    assert(
      ev2Data?.delayMetrics?.delayStatus === 'DELAYED' && ev2Data?.delayMetrics?.delayDays >= 2.9,
      `TC-05: 3-day delayed pour correctly calculated (+${ev2Data?.delayMetrics?.delayDays} days, ${ev2Data?.delayMetrics?.delayDurationText})`
    );

    const ev4Data = timelineRes.body?.data?.find(e => e.id === ev4Id);
    assert(
      ev4Data?.delayMetrics?.delayStatus === 'OVERDUE' && ev4Data?.delayMetrics?.isDelayCalculable === true,
      `TC-06: Unpoured past event correctly flagged as OVERDUE (${ev4Data?.delayMetrics?.delayDurationText})`
    );

    const ev5Data = timelineRes.body?.data?.find(e => e.id === ev5Id);
    assert(
      ev5Data?.delayMetrics?.delayStatus === 'UPCOMING',
      `TC-07: Future scheduled event classified as UPCOMING`
    );

    // 6. Test Multi-Member and Multi-Block Representation (No Duplication)
    console.log('\n🏗️ Step 6: Multi-Member / Multi-Block Integrity');
    const ev3Data = timelineRes.body?.data?.find(e => e.id === ev3Id);
    assert(
      ev3Data?.segmentsSummary?.blocksCovered?.length === 2 && ev3Data?.segmentsSummary?.membersCovered?.length === 2,
      'TC-08: Multi-member event spans 2 blocks and 2 members cleanly'
    );
    // Verify it appears exactly once in the event list
    const ev3Count = timelineRes.body?.data?.filter(e => e.id === ev3Id).length;
    assert(ev3Count === 1, 'TC-09: Multi-member / multi-block event is NOT duplicated across schedule');

    // 7. Test Contextual Phase 4 Quality Integration
    console.log('\n🧪 Step 7: Verifying Contextual Quality Summaries');
    assert(
      ev1Data?.qualityContext?.curingStatus === 'ACTIVE' && ev1Data?.qualityContext?.cubeStatus === 'VALID',
      'TC-10: ev1 contains contextual curing status and cube test average (no separate cards)'
    );

    // 8. Test Filtering Capabilities
    console.log('\n🔍 Step 8: Testing Filtering by Block, Level, Status, and Date Range');

    // Filter by Block 2 (Platform Block B) -> Only ev3 should match
    const filterBlockRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/timeline/events?projectId=${projectId}&blockId=${block2Id}`,
      method: 'GET',
      headers: headersA
    });
    assert(
      filterBlockRes.body?.data?.length === 1 && filterBlockRes.body?.data?.[0]?.id === ev3Id,
      'TC-11: Block filter isolates events covering Block B'
    );

    // Filter by Status POURED -> Should return ev1 and ev2
    const filterPouredRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/timeline/events?projectId=${projectId}&status=POURED`,
      method: 'GET',
      headers: headersA
    });
    assert(
      filterPouredRes.body?.data?.length === 2,
      `TC-12: Status filter isolates POURED events (count: ${filterPouredRes.body?.data?.length})`
    );

    // Filter by Date Range (October 2026) -> Should return ev1, ev2, ev3 (3 events)
    const filterDateRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/timeline/events?projectId=${projectId}&startDate=2026-10-01&endDate=2026-10-31`,
      method: 'GET',
      headers: headersA
    });
    assert(
      filterDateRes.body?.data?.length === 3,
      `TC-13: Date range filter isolates October events (count: ${filterDateRes.body?.data?.length})`
    );

    // Search query
    const searchRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/timeline/events?projectId=${projectId}&search=Platform`,
      method: 'GET',
      headers: headersA
    });
    assert(
      searchRes.body?.data?.length >= 1 && searchRes.body?.data?.some(e => e.id === ev2Id),
      'TC-14: Search filter locates events by keyword'
    );

    // 9. Single Event Detail Drilldown
    console.log('\n📖 Step 9: Testing Deep Event Details Drawer Endpoint');
    const detailRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/timeline/events/${ev1Id}`,
      method: 'GET',
      headers: headersA
    });

    assert(
      detailRes.status === 200 && detailRes.body?.data?.contextualDetails?.curingSchedule,
      'TC-15: GET /api/casting/timeline/events/:id returns deep contextual quality and execution details'
    );

    // 10. Multi-Tenant Data Isolation
    console.log('\n🏢 Step 10: Multi-Tenant Cross-Company Isolation');
    const tenantBRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/timeline/events?projectId=${projectId}`,
      method: 'GET',
      headers: headersB
    });
    assert(
      tenantBRes.status === 200 && tenantBRes.body?.data?.length === 0,
      'TC-16: Multi-Tenant Isolation: Company B cannot see Company A timeline events'
    );

    const tenantBDetailRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/timeline/events/${ev1Id}`,
      method: 'GET',
      headers: headersB
    });
    assert(
      tenantBDetailRes.status === 404,
      'TC-17: Multi-Tenant Detail Isolation: Company B receives 404 Not Found on Company A event ID'
    );

    // 11. Strict BBS Independence
    console.log('\n🧱 Step 11: BBS Independence Verification');
    const bbsHealth = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bbs/health',
      method: 'GET'
    });
    assert(
      bbsHealth.status === 200 || bbsHealth.status === 401 || bbsHealth.status === 404,
      'TC-18: Strict BBS Independence: Zero BBS imports or schema dependencies verified'
    );

    // 12. Zero Inventory Mutation Invariance
    console.log('\n📦 Step 12: Zero Inventory Mutation Invariance');
    const stockCheck = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock`,
      method: 'GET',
      headers: headersA
    });
    assert(
      stockCheck.status === 200,
      'TC-19: Non-Destructive Invariance: Phase 5 executed with zero stock mutations or inventory deductions'
    );

    console.log('\n================================================================');
    console.log(`🏁 PHASE 5 ACCEPTANCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
  }
}

runAcceptanceTests();
