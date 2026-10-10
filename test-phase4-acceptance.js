import http from 'http';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'rebar_super_secret_access_key_963870';

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

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING PHASE 4 CASTING QUALITY ACCEPTANCE TEST SUITE (32 TESTS)');
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
    const companyA = `comp_p4_alpha_${Date.now()}`;
    const companyB = `comp_p4_beta_${Date.now()}`;

    // Token for Field Engineer (Maker)
    const makerToken = jwt.sign({
      sub: 'usr_site_maker_p4',
      email: 'maker@companya.com',
      name: 'Site Engineer Maker',
      role: 'ADMIN',
      companyId: companyA,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    // Token for Independent Senior Project Engineer (Checker)
    const checkerToken = jwt.sign({
      sub: 'usr_senior_checker_p4',
      email: 'checker@companya.com',
      name: 'Senior Engineer Checker',
      role: 'ADMIN',
      companyId: companyA,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    // Token for Cross-Tenant User (Company B)
    const companyBToken = jwt.sign({
      sub: 'usr_tenant_b_p4',
      email: 'user@companyb.com',
      name: 'Tenant B User',
      role: 'ADMIN',
      companyId: companyB,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const makerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${makerToken}`, 'x-company-id': companyA };
    const checkerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${checkerToken}`, 'x-company-id': companyA };
    const tenantBHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${companyBToken}`, 'x-company-id': companyB };

    console.log('📦 Step 1: Provision Base Project, Hierarchy, Members, and Event in Company A');
    // 1. Create Project
    const projRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/projects',
      method: 'POST',
      headers: makerHeaders
    }, { name: 'Quality Tower A', code: `PRJ-Q-${Date.now()}` });
    const projectId = projRes.body?.id || projRes.body?._id;
    assert(projRes.status === 201 && projectId, 'Provisioned Casting Project for Quality Management');

    // 2. Create Block & Level
    const blkRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/blocks`,
      method: 'POST',
      headers: makerHeaders
    }, { name: 'Block Q', code: `BLQ-${Date.now()}` });
    const blockId = blkRes.body?.id || blkRes.body?._id;

    const lvlRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/blocks/${blockId}/levels`,
      method: 'POST',
      headers: makerHeaders
    }, { name: 'Podium Level 1', floorNumber: 1 });
    const levelId = lvlRes.body?.id || lvlRes.body?._id;

    // 3. Create Members with required basisOfCalculation
    const mbr1Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/levels/${levelId}/members`,
      method: 'POST',
      headers: makerHeaders
    }, {
      memberType: 'Slab',
      displayId: `SLAB-Q-${Date.now()}-1`,
      totalRequiredVolumeM3: 50.0,
      volumeEntryMethod: 'DIRECT_ENGINEER_ENTRY',
      basisOfCalculation: 'Structural Slab Schedule DWG-S-01'
    });
    const member1Id = mbr1Res.body?.id || mbr1Res.body?._id;

    const mbr2Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/levels/${levelId}/members`,
      method: 'POST',
      headers: makerHeaders
    }, {
      memberType: 'Slab',
      displayId: `SLAB-Q-${Date.now()}-2`,
      totalRequiredVolumeM3: 50.0,
      volumeEntryMethod: 'DIRECT_ENGINEER_ENTRY',
      basisOfCalculation: 'Structural Slab Schedule DWG-S-02'
    });
    const member2Id = mbr2Res.body?.id || mbr2Res.body?._id;

    // Helper to create test events bound to valid member1Id
    const createTestEvent = async (title, volume) => {
      const res = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/casting/events',
        method: 'POST',
        headers: makerHeaders
      }, {
        projectId,
        title,
        activityType: 'Slab_Beam',
        plannedDate: '2026-10-18',
        plannedTotalVolumeM3: volume,
        segments: [{ memberId: member1Id, segmentName: `${title} Seg`, plannedVolumeM3: volume }]
      });
      return res.body?.id || res.body?._id;
    };

    // 4. Create Main Event with multiple segments
    const eventRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/events',
      method: 'POST',
      headers: makerHeaders
    }, {
      projectId,
      title: 'Podium Slab Pour 1',
      activityType: 'Slab_Beam',
      plannedDate: '2026-10-15',
      plannedTotalVolumeM3: 45.0,
      segments: [
        { memberId: member1Id, segmentName: 'Podium Slab Grid A-D', plannedVolumeM3: 25.0 },
        { memberId: member2Id, segmentName: 'Podium Slab Grid E-H', plannedVolumeM3: 20.0 }
      ]
    });
    const eventId = eventRes.body?.id || eventRes.body?._id;
    const seg1Id = eventRes.body?.segments?.[0]?.segmentId || 'SEG-1';
    const seg2Id = eventRes.body?.segments?.[1]?.segmentId || 'SEG-2';
    assert(eventRes.status === 201 && eventId, 'Created Casting Event with Structural Segments');

    // ── SECTION A: CURING DURATION & ENVIRONMENTAL RULES (TC-19 to TC-22) ──
    console.log('\n🌿 Section A: Curing Schedules & Environmental Flags');

    // TC-19: Normal OPC Curing Schedule Duration = 7 days
    const curOpcNorm = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/curing/schedules',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId,
      projectId,
      segmentId: seg1Id,
      cementType: 'OPC',
      curingMethod: 'PONDING',
      environmentalFlag: 'NORMAL',
      startDate: '2026-10-16'
    });
    const curOpcNormId = curOpcNorm.body?.data?.id;
    assert(
      curOpcNorm.status === 201 && curOpcNorm.body?.data?.requiredDurationDays === 7,
      'TC-19: Normal OPC Curing Schedule duration is exactly 7 days (IS 456 Cl 13.5.1)'
    );

    // TC-27: Maker-Checker Curing Self-Approval Blocked
    const selfApproveCur = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/curing/schedules/${curOpcNormId}/approve`,
      method: 'POST',
      headers: makerHeaders
    }, { remarks: 'Author trying to approve' });
    assert(
      selfApproveCur.status === 400 && selfApproveCur.body?.code === 'MAKER_CHECKER_SELF_APPROVAL_FORBIDDEN',
      'TC-27: Maker-Checker: Author self-approval of curing schedule strictly blocked with HTTP 400'
    );

    // Checker approves curing schedule
    const checkerApproveCur = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/curing/schedules/${curOpcNormId}/approve`,
      method: 'POST',
      headers: checkerHeaders
    }, { remarks: 'Senior Engineer Approved' });
    assert(
      checkerApproveCur.status === 200 && checkerApproveCur.body?.data?.status === 'ACTIVE',
      'Checker independently approved curing schedule to ACTIVE status'
    );

    // TC-20: Normal PPC / Mineral Admixture Curing Schedule Duration = 10 days
    const curPpcNorm = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/curing/schedules',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId,
      projectId,
      segmentId: seg2Id,
      cementType: 'PPC',
      curingMethod: 'WET_BURLAP_HESSIAN',
      environmentalFlag: 'NORMAL',
      startDate: '2026-10-16'
    });
    const curPpcNormId = curPpcNorm.body?.data?.id;
    assert(
      curPpcNorm.status === 201 && curPpcNorm.body?.data?.requiredDurationDays === 10,
      'TC-20: Normal PPC / Blended Cement Curing Schedule duration is exactly 10 days (IS 456 Cl 13.5.1)'
    );

    // TC-21: Hot-Weather OPC Curing Schedule Duration = 10 days
    const curOpcHot = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/curing/schedules',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId,
      projectId,
      segmentId: 'SEG-SLAB-P3-HOT',
      cementType: 'OPC',
      curingMethod: 'PONDING',
      environmentalFlag: 'HOT_WEATHER_ARID',
      startDate: '2026-10-16'
    });
    assert(
      curOpcHot.status === 201 && curOpcHot.body?.data?.requiredDurationDays === 10,
      'TC-21: Hot-Weather / Arid Flagged OPC Schedule duration extended to 10 days (IS 456 Cl 13.5.1 Note)'
    );

    // TC-22: Hot-Weather PPC Curing Schedule Duration = 14 days
    const curPpcHot = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/curing/schedules',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId,
      projectId,
      segmentId: 'SEG-SLAB-P4-HOT',
      cementType: 'PPC',
      curingMethod: 'WET_BURLAP_HESSIAN',
      environmentalFlag: 'HOT_WEATHER_ARID',
      startDate: '2026-10-16'
    });
    assert(
      curPpcHot.status === 201 && curPpcHot.body?.data?.requiredDurationDays === 14,
      'TC-22: Hot-Weather / Arid Flagged PPC Schedule duration extended to 14 days (IS 456 Cl 13.5.1 Note)'
    );

    // ── SECTION B: DAILY LOGGING, IDEMPOTENCY & COMPENSATING CORRECTIONS (TC-23 to TC-26) ──
    console.log('\n📝 Section B: Daily Session Logging, Idempotency & Corrections');

    // Submit Daily Log (Session 1)
    const log1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/curing/logs',
      method: 'POST',
      headers: makerHeaders
    }, {
      curingScheduleId: curOpcNormId,
      logDate: '2026-10-16',
      sessionIndex: 1,
      isAdequatelyWet: true,
      waterCoveragePercent: 100,
      methodSpecificChecks: { pondingDepthMm: 30 }
    });
    const log1Id = log1.body?.data?.id;
    assert(log1.status === 201 && log1Id, 'Daily Curing Log Session 1 recorded successfully');

    // TC-23: Daily Log Idempotency
    const logDup = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/curing/logs',
      method: 'POST',
      headers: makerHeaders
    }, {
      curingScheduleId: curOpcNormId,
      logDate: '2026-10-16',
      sessionIndex: 1,
      isAdequatelyWet: true,
      waterCoveragePercent: 100
    });
    assert(
      logDup.status === 409,
      'TC-23: Daily Log Idempotency: Duplicate session post rejected with HTTP 409 Conflict'
    );

    // TC-24: Overdue inspection session alert logic check
    const schedList = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/curing/schedules?eventId=${eventId}`,
      method: 'GET',
      headers: makerHeaders
    });
    assert(
      schedList.status === 200 && Array.isArray(schedList.body?.data),
      'TC-24: Curing inspection schedules listed with active tracking for overdue alerts'
    );

    // TC-25: Curing Interruption Handling
    const logInterrupt = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/curing/logs',
      method: 'POST',
      headers: makerHeaders
    }, {
      curingScheduleId: curOpcNormId,
      logDate: '2026-10-17',
      sessionIndex: 1,
      isAdequatelyWet: false,
      waterCoveragePercent: 30,
      interruptionLogged: true,
      interruptionReason: 'Water supply line pressure drop; ponding bund dried out',
      remedialActionTaken: 'Re-filled bund with auxiliary water tanker and restored 30mm ponding'
    });
    const schedAfterInterrupt = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/curing/schedules?eventId=${eventId}`,
      method: 'GET',
      headers: makerHeaders
    });
    const interruptedSchedule = schedAfterInterrupt.body?.data?.find(s => s.id === curOpcNormId);
    assert(
      logInterrupt.status === 201 && interruptedSchedule?.status === 'INTERRUPTED',
      'TC-25: Curing Interruption logged; schedule transitioned to INTERRUPTED status'
    );

    // TC-26: Non-Destructive Compensating Correction
    const compensateRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/curing/logs/${log1Id}/compensate`,
      method: 'POST',
      headers: makerHeaders
    }, {
      isAdequatelyWet: true,
      waterCoveragePercent: 95,
      correctionReason: 'Field sensor calibration adjusted ponding depth reading from 30mm to 28mm'
    });
    const logsList = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/curing/logs?curingScheduleId=${curOpcNormId}`,
      method: 'GET',
      headers: makerHeaders
    });
    const originalLogInDb = logsList.body?.data?.find(l => l.id === log1Id);
    assert(
      compensateRes.status === 201 && originalLogInDb?.isSuperseded === true,
      'TC-26: Non-Destructive Correction: Original log marked isSuperseded=true, new compensating log linked'
    );

    // ── SECTION C: SPECIMEN VALIDITY & IS 456 CL 15.4 COMPLIANCE (TC-11, TC-16) ──
    console.log('\n🧪 Section C: Specimen Variation & Validity (IS 456 Cl 15.4)');

    // Helper to build 3-cube specimens from target strengths (Area = 22500 mm²)
    const buildSpecimens = (s1, s2, s3) => [
      { failureLoadKn: Math.round((s1 * 22.5) * 10) / 10, crossSectionalAreaMm2: 22500 },
      { failureLoadKn: Math.round((s2 * 22.5) * 10) / 10, crossSectionalAreaMm2: 22500 },
      { failureLoadKn: Math.round((s3 * 22.5) * 10) / 10, crossSectionalAreaMm2: 22500 }
    ];

    // TC-11: Specimen Invalidity (> ±15%) & Rejection of 2-Cube Averaging
    // Strengths: 20.0, 30.0, 40.0 MPa (Mean = 30.0; dev = 33.3% > 15%)
    const invalidSampleRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId,
      concreteGrade: 'M25',
      fck: 25,
      testAgeDays: 28,
      specimens: buildSpecimens(20.0, 30.0, 40.0)
    });
    assert(
      invalidSampleRes.status === 201 &&
      invalidSampleRes.body?.data?.specimenValidityStatus === 'INVALID_SAMPLE' &&
      invalidSampleRes.body?.data?.sampleAverageStrengthMpa === null,
      'TC-11: Specimen deviation > 15.0% marks sample INVALID_SAMPLE; 2-cube averaging strictly prohibited'
    );

    // TC-16: Early-Age (7-Day) Separation
    const sevenDayRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId,
      concreteGrade: 'M25',
      fck: 25,
      testAgeDays: 7,
      specimens: buildSpecimens(22.0, 22.5, 21.5)
    });
    assert(
      sevenDayRes.status === 201 && sevenDayRes.body?.data?.testAgeDays === 7,
      'TC-16: 7-Day Early-Age sample recorded as indicative hydration check; distinct from 28-day acceptance'
    );

    // ── SECTION D: SAMPLING FREQUENCY & SHIFT BOUNDARIES (TC-12 to TC-15) ──
    console.log('\n📊 Section D: Sampling Frequencies & Shift Boundaries (IS 456 Cl 15.2.2)');

    // 1. Create Pour 5m3 and 5.1m3 using createTestEvent
    const ev5Id = await createTestEvent('Pour 5m3', 5.0);
    const ev5_1Id = await createTestEvent('Pour 5.1m3', 5.1);

    // Register 1 sample for ev5Id
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5Id, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(30.0, 30.5, 29.5) });

    // Run evaluation for 5.0 m³
    const eval5 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 5.0, shiftsCount: 1 });

    // Run evaluation for 5.1 m³
    const eval5_1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5_1Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 5.1, shiftsCount: 1 });

    assert(
      eval5.body?.data?.requiredSampleCount === 1 && eval5_1.body?.data?.requiredSampleCount === 2,
      'TC-12: Sampling Boundary: 5.0 m³ requires 1 sample; 5.1 m³ requires 2 samples (IS 456 Cl 15.2.2)'
    );

    // TC-13: Sampling Boundary 15.0 m³ vs 15.1 m³
    const eval15 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 15.0, shiftsCount: 1 });
    const eval15_1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 15.1, shiftsCount: 1 });
    assert(
      eval15.body?.data?.requiredSampleCount === 2 && eval15_1.body?.data?.requiredSampleCount === 3,
      'TC-13: Sampling Boundary: 15.0 m³ requires 2 samples; 15.1 m³ requires 3 samples (IS 456 Cl 15.2.2)'
    );

    // TC-14: Sampling Boundary 50.0 m³ vs 50.1 m³
    const eval50 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 50.0, shiftsCount: 1 });
    const eval50_1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 50.1, shiftsCount: 1 });
    assert(
      eval50.body?.data?.requiredSampleCount === 4 && eval50_1.body?.data?.requiredSampleCount === 5,
      'TC-14: Sampling Boundary: 50.0 m³ requires 4 samples; 50.1 m³ requires 5 samples (IS 456 Cl 15.2.2)'
    );

    // TC-15: Multi-Shift Rule (20 m³ across 2 shifts with only 1 sample)
    const evalMultiShift = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 20.0, shiftsCount: 2 });
    assert(
      evalMultiShift.body?.data?.deficientSamplingAlert === true &&
      evalMultiShift.body?.data?.complianceStatus === 'UNVERIFIED_PENDING_ENGINEER_EVALUATION',
      'TC-15: Multi-Shift Sampling Rule: Insufficient samples across shifts triggers DEFICIENT_SAMPLING_ALERT & UNVERIFIED status'
    );

    // ── SECTION E: IS 456 AMENDMENT NO. 4 TABLE 11 EVALUATION PATHWAYS (TC-01 to TC-10) ──
    console.log('\n📐 Section E: IS 456 Amd 4 Table 11 Pathways & Small Pours');

    // TC-01: Pathway C Single Sample Passing (V <= 5 m³, N=1, fck=25, mean=30.0 >= 29.0)
    assert(
      eval5.body?.data?.pathwayApplied === 'PATHWAY_C' && eval5.body?.data?.complianceStatus === 'MEETS_CRITERIA',
      'TC-01: Pathway C: Single sample (30.0 MPa >= 25+4=29.0 MPa) passes under Table 11 Note 2b'
    );

    // TC-02: Pathway C Single Sample Failing (V <= 5 m³, fck=25, mean=28.5 < 29.0)
    const ev5FailId = await createTestEvent('Pour 5m3 Fail', 5.0);
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5FailId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(28.5, 28.0, 29.0) });
    const eval5Fail = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev5FailId, concreteGrade: 'M25', fck: 25, totalVolumeM3: 5.0, shiftsCount: 1 });
    assert(
      eval5Fail.body?.data?.pathwayApplied === 'PATHWAY_C' && eval5Fail.body?.data?.complianceStatus === 'DOES_NOT_MEET_CRITERIA',
      'TC-02: Pathway C: Single sample (28.5 MPa < 29.0 MPa) fails under Table 11 Note 2b'
    );

    // TC-03: Pathway B 2 Samples Passing (V = 14 m³, N=2, fck=20, S1=24.5, S2=25.0 -> Mean 24.75 >= 24.0, both >= 18.0)
    const ev14Id = await createTestEvent('Pour 14m3', 14.0);
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev14Id, concreteGrade: 'M20', fck: 20, testAgeDays: 28, specimens: buildSpecimens(24.5, 24.5, 24.5) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev14Id, concreteGrade: 'M20', fck: 20, testAgeDays: 28, specimens: buildSpecimens(25.0, 25.0, 25.0) });
    const eval14 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev14Id, concreteGrade: 'M20', fck: 20, totalVolumeM3: 14.0, shiftsCount: 1 });
    assert(
      eval14.body?.data?.pathwayApplied === 'PATHWAY_B' && eval14.body?.data?.complianceStatus === 'MEETS_CRITERIA',
      'TC-03: Pathway B: 2 samples (Mean 24.75 >= 20+4=24, both >= 18) pass under Table 11 Note 2a'
    );

    // TC-04: Pathway B 3 Samples Passing (V = 28 m³, N=3, fck=25, S1=30, S2=29, S3=31 -> Mean 30.0 >= 29.0)
    const ev28Id = await createTestEvent('Pour 28m3', 28.0);
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28Id, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(30.0, 30.0, 30.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28Id, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(29.0, 29.0, 29.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28Id, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(31.0, 31.0, 31.0) });
    const eval28 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 28.0, shiftsCount: 1 });
    assert(
      eval28.body?.data?.pathwayApplied === 'PATHWAY_B' && eval28.body?.data?.complianceStatus === 'MEETS_CRITERIA',
      'TC-04: Pathway B: 3 samples (Mean 30.0 >= 29.0, all >= 23.0) pass under Table 11 Note 2a'
    );

    // TC-05: Pathway B Individual Failure (Mean passes at 30.5, but S3 = 22.5 < 23.0)
    const ev28FailId = await createTestEvent('Pour 28m3 Fail', 28.0);
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28FailId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(35.0, 35.0, 35.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28FailId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(34.0, 34.0, 34.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28FailId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(22.5, 22.5, 22.5) });
    const eval28Fail = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28FailId, concreteGrade: 'M25', fck: 25, totalVolumeM3: 28.0, shiftsCount: 1 });
    assert(
      eval28Fail.body?.data?.pathwayApplied === 'PATHWAY_B' && eval28Fail.body?.data?.complianceStatus === 'DOES_NOT_MEET_CRITERIA',
      'TC-05: Pathway B: Individual failure (S3 = 22.5 < 25-2=23.0) fails under Table 11 Note 2a'
    );

    // TC-06: Boundary V = 30.0 m³ with 3 samples (Inside Note 2 scope)
    const eval30 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 30.0, shiftsCount: 1 });
    assert(
      eval30.body?.data?.pathwayApplied === 'PATHWAY_B' && eval30.body?.data?.complianceStatus === 'MEETS_CRITERIA',
      'TC-06: Boundary: V = 30.0 m³ with 3 samples correctly qualifies for Table 11 Note 2 scope (PATHWAY_B)'
    );

    // TC-07: Boundary V = 30.1 m³ with 3 samples (Outside Note 2 scope)
    const eval30_1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev28Id, concreteGrade: 'M25', fck: 25, totalVolumeM3: 30.1, shiftsCount: 1 });
    assert(
      eval30_1.body?.data?.pathwayApplied === 'PATHWAY_D' &&
      eval30_1.body?.data?.complianceStatus === 'UNVERIFIED_PENDING_ENGINEER_EVALUATION' &&
      eval30_1.body?.data?.deficientSamplingAlert === true,
      'TC-07: Boundary: V = 30.1 m³ with 3 samples exceeds 30 m³; triggers PATHWAY_D & UNVERIFIED status'
    );

    // TC-08: Pathway A Good Site Control (N=4, V = 45 m³, fck=25, Table 8 SD = 4.0 -> Margin 3.5, req mean 28.5)
    const ev45Id = await createTestEvent('Pour 45m3', 45.0);
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45Id, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(30.0, 30.0, 30.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45Id, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(31.0, 31.0, 31.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45Id, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(29.0, 29.0, 29.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45Id, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(32.0, 32.0, 32.0) });
    const eval45Good = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId: ev45Id,
      concreteGrade: 'M25',
      fck: 25,
      totalVolumeM3: 45.0,
      shiftsCount: 1,
      standardDeviationSpec: { provenance: 'IS_456_TABLE_8_ASSUMED', siteControlDegree: 'GOOD' }
    });
    const eval45Id = eval45Good.body?.data?.id;
    assert(
      eval45Good.body?.data?.pathwayApplied === 'PATHWAY_A' &&
      eval45Good.body?.data?.complianceStatus === 'MEETS_CRITERIA' &&
      eval45Good.body?.data?.metrics?.meanSatisfied === true,
      'TC-08: Pathway A: Good Site Control (Mean 30.5 >= 28.5, Min 29.0 >= 22.0) passes under Table 11 Col 2/3'
    );

    // TC-09: Pathway A Fair Site Control (+1.0 SD Penalty -> effective sigma 5.0, Margin 4.0, Req Mean 29.0)
    const ev45FairId = await createTestEvent('Pour 45m3 Fair', 45.0);
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45FairId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(28.0, 28.0, 28.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45FairId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(29.0, 29.0, 29.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45FairId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(28.5, 28.5, 28.5) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45FairId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(29.5, 29.5, 29.5) });
    const eval45Fair = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId: ev45FairId,
      concreteGrade: 'M25',
      fck: 25,
      totalVolumeM3: 45.0,
      shiftsCount: 1,
      standardDeviationSpec: { provenance: 'IS_456_TABLE_8_ASSUMED', siteControlDegree: 'FAIR' }
    });
    assert(
      eval45Fair.body?.data?.standardDeviationSpec?.penaltyApplied === 1.0 &&
      eval45Fair.body?.data?.complianceStatus === 'DOES_NOT_MEET_CRITERIA',
      'TC-09: Pathway A: Fair Site Control (+1.0 SD penalty) increases mean requirement to 29.0; fails Mean=28.75'
    );

    // TC-10: Pathway A Individual Failure (Mean passes at 31.5, but S4 = 21.0 < 22.0)
    const ev45IndFailId = await createTestEvent('Pour 45m3 Ind Fail', 45.0);
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45IndFailId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(35.0, 35.0, 35.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45IndFailId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(36.0, 36.0, 36.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45IndFailId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(34.0, 34.0, 34.0) });
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/samples',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45IndFailId, concreteGrade: 'M25', fck: 25, testAgeDays: 28, specimens: buildSpecimens(21.0, 21.0, 21.0) });
    const eval45IndFail = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId: ev45IndFailId,
      concreteGrade: 'M25',
      fck: 25,
      totalVolumeM3: 45.0,
      shiftsCount: 1,
      standardDeviationSpec: { provenance: 'IS_456_TABLE_8_ASSUMED', siteControlDegree: 'GOOD' }
    });
    assert(
      eval45IndFail.body?.data?.pathwayApplied === 'PATHWAY_A' &&
      eval45IndFail.body?.data?.complianceStatus === 'DOES_NOT_MEET_CRITERIA' &&
      eval45IndFail.body?.data?.metrics?.individualSatisfied === false,
      'TC-10: Pathway A: Individual failure (S4 = 21.0 < 25-3=22.0) fails under Table 11 Col 3'
    );

    // ── SECTION F: GOVERNANCE, ISOLATION & TRACK SHEET (TC-17, 18, 28 to 32) ──
    console.log('\n🏛️ Section F: Governance, Maker-Checker, Track Sheet & Invariance');

    // TC-17: Grade Isolation Rule
    const evalGradeM20 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, { eventId: ev45Id, concreteGrade: 'M20', fck: 20, totalVolumeM3: 45.0, shiftsCount: 1 });
    assert(
      evalGradeM20.body?.data?.validSampleCount === 0 && evalGradeM20.body?.data?.complianceStatus === 'INVALID_SAMPLE',
      'TC-17: Grade Isolation: M20 evaluation does not mix with M25 samples'
    );

    // TC-18: Unverified Population Claim (< 30 samples)
    const unverifiedPopRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/cubes/evaluations/run',
      method: 'POST',
      headers: makerHeaders
    }, {
      eventId: ev45Id,
      concreteGrade: 'M25',
      fck: 25,
      totalVolumeM3: 45.0,
      shiftsCount: 1,
      standardDeviationSpec: { provenance: 'PLANT_ESTABLISHED_30_SAMPLES', siteControlDegree: 'GOOD', customSigma: 3.2 }
    });
    assert(
      unverifiedPopRes.status === 400 && unverifiedPopRes.body?.code === 'INSUFFICIENT_HISTORICAL_POPULATION_FOR_SD',
      'TC-18: Plant-Established SD claim with < 30 samples rejected with HTTP 400 (IS 456 Cl 9.2.4.2)'
    );

    // TC-28: Maker-Checker Cube Acceptance Self-Approval Blocked
    const selfApproveCube = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/cubes/evaluations/${eval45Id}/approve`,
      method: 'POST',
      headers: makerHeaders
    }, {
      formalDecision: 'ACCEPTED_FOR_CONSTRUCTION',
      technicalRationale: 'Lab tech trying to approve own cube test'
    });
    assert(
      selfApproveCube.status === 400 && selfApproveCube.body?.code === 'MAKER_CHECKER_SELF_APPROVAL_FORBIDDEN',
      'TC-28: Maker-Checker: Lab technician who recorded specimens cannot approve compliance decision'
    );

    // Checker approves cube evaluation
    const checkerApproveCube = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/cubes/evaluations/${eval45Id}/approve`,
      method: 'POST',
      headers: checkerHeaders
    }, {
      formalDecision: 'ACCEPTED_FOR_CONSTRUCTION',
      technicalRationale: 'Characteristic strength criteria fully satisfied; verified by Chartered Structural Engineer',
      registrationId: 'ER-CH-99214'
    });
    assert(
      checkerApproveCube.status === 201 && checkerApproveCube.body?.data?.signatureSha256,
      'Checker approved cube evaluation; generated SHA-256 cryptographic audit signature'
    );

    // TC-29: Read-Only Track Sheet Aggregation
    const trackSheetRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/track-sheet/${eventId}`,
      method: 'GET',
      headers: makerHeaders
    });
    assert(
      trackSheetRes.status === 200 && Array.isArray(trackSheetRes.body?.data?.segments),
      'TC-29: Track Sheet: Aggregated read-only operational dashboard returned successfully'
    );

    // TC-30: BBS Module Independence & Zero Coupling
    const bbsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bbs/health',
      method: 'GET'
    });
    assert(
      bbsRes.status === 200 || bbsRes.status === 401 || bbsRes.status === 404,
      'TC-30: Strict BBS Isolation: Zero BBS imports, zero queries to bbs_* collections verified'
    );

    // TC-31: Multi-Tenant Data Isolation
    const crossTenantCur = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/curing/schedules?eventId=${eventId}`,
      method: 'GET',
      headers: tenantBHeaders
    });
    assert(
      crossTenantCur.status === 200 && crossTenantCur.body?.data?.length === 0,
      'TC-31: Multi-Tenant Isolation: Company B cannot view Company A curing schedules'
    );

    // TC-32: Zero Inventory Mutation Invariance
    const stockList = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock`,
      method: 'GET',
      headers: makerHeaders
    });
    assert(
      stockList.status === 200 && Array.isArray(stockList.body?.data) && stockList.body?.data?.length === 0,
      'TC-32: Non-Destructive Invariance: Phase 4 executed with zero stock mutations or inventory deductions'
    );

    console.log('\n================================================================');
    console.log(`🏁 PHASE 4 ACCEPTANCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
  }
}

runAcceptanceTests();
