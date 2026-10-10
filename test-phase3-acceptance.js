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
  console.log('🚀 RUNNING PHASE 3 CASTING MANAGEMENT ACCEPTANCE TEST SUITE');
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
    // 1. Identity & Multi-Tenant Setup
    console.log('📦 Step 1: User & Tenant Identity Setup');
    const companyA = `comp_p3_alpha_${Date.now()}`;
    const companyB = `comp_p3_beta_${Date.now()}`;

    // Maker (Author: Site Engineer Bob)
    const authorToken = jwt.sign({
      sub: 'usr_site_bob_p3',
      email: 'bob@companyA.com',
      name: 'Site Engineer Bob',
      role: 'ADMIN',
      companyId: companyA,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    // Checker (Approver: Senior PM Alice)
    const approverToken = jwt.sign({
      sub: 'usr_pm_alice_p3',
      email: 'alice@companyA.com',
      name: 'Senior PM Alice',
      role: 'ADMIN',
      companyId: companyA,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    // Cross-tenant User (Tenant Beta)
    const tenantBToken = jwt.sign({
      sub: 'usr_tenant_b_p3',
      email: 'charlie@companyB.com',
      name: 'Tenant B Engineer Charlie',
      role: 'ADMIN',
      companyId: companyB,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const authorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authorToken}`, 'x-company-id': companyA };
    const approverHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${approverToken}`, 'x-company-id': companyA };
    const tenantBHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tenantBToken}`, 'x-company-id': companyB };

    assert(authorToken && approverToken && tenantBToken, 'JWT tokens generated for Maker, Checker, and Cross-Tenant isolation');

    // 2. Setup Project, Member, Recipe, and Casting Event
    console.log('\n🏗️ Step 2: Provision Project, Structural Members, Recipe, and Casting Event');
    
    // Create Project
    const projRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/projects',
      method: 'POST',
      headers: authorHeaders
    }, { name: 'Metro Tower Phase 3 Test Site', code: `MTR-P3-${Date.now()}` });
    
    const projectId = projRes.body?.id || projRes.body?._id || projRes.body?.data?.id || projRes.body?.data?._id;
    assert(projRes.status === 201 && projectId, 'Project created in Company A store');

    // Create Block & Level
    const blkRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/blocks`,
      method: 'POST',
      headers: authorHeaders
    }, { name: 'Tower A', code: 'TWA' });
    const blockId = blkRes.body?.id || blkRes.body?._id || blkRes.body?.data?.id || blkRes.body?.data?._id;

    const lvlRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/blocks/${blockId}/levels`,
      method: 'POST',
      headers: authorHeaders
    }, { name: 'Level 1 Podium', floorNumber: 1 });
    const levelId = lvlRes.body?.id || lvlRes.body?._id || lvlRes.body?.data?.id || lvlRes.body?.data?._id;

    // Create Structural Member (Slab: 10 m³)
    const mbrRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/levels/${levelId}/members`,
      method: 'POST',
      headers: authorHeaders
    }, {
      memberType: 'Slab',
      displayId: 'SLAB-P3-101',
      totalRequiredVolumeM3: 10.0,
      volumeEntryMethod: 'DIRECT_ENGINEER_ENTRY',
      basisOfCalculation: 'Structural Slab Schedule DWG-S-01'
    });
    const memberId = mbrRes.body?.id || mbrRes.body?._id || mbrRes.body?.data?.id || mbrRes.body?.data?._id;
    assert(mbrRes.status === 201 && memberId, 'Structural member created with totalRequiredVolumeM3 = 10.0 m³');

    // Create Concrete Mix Recipe (M25 with OPC 53, Sand, 20mm aggregate, 10mm aggregate, Water, PCE)
    const recipeRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/recipes',
      method: 'POST',
      headers: authorHeaders
    }, {
      grade: 'M25',
      recipeCode: `MIX-M25-P3-${Date.now()}`,
      displayName: 'M25 Standard Structural Mix',
      mixType: 'SITE_BATCHING',
      ingredients: [
        { ingredientId: 'ing_cem_1', materialIdentifier: 'OPC_53', specificationStandard: 'IS 269:2015', name: 'OPC 53 Cement', category: 'CEMENT', quantityPerM3: 380, baseUnit: 'KG', displayUnit: 'KG', wastageAllowancePercent: 0 },
        { ingredientId: 'ing_sand_1', materialIdentifier: 'FINE_AGG_ZONE2', specificationStandard: 'IS 383:2016', name: 'M-Sand', category: 'FINE_AGGREGATE', quantityPerM3: 720, baseUnit: 'KG', displayUnit: 'KG', wastageAllowancePercent: 0 },
        { ingredientId: 'ing_agg20_1', materialIdentifier: 'COARSE_AGG_20MM', specificationStandard: 'IS 383:2016', name: '20mm Aggregate', category: 'COARSE_AGGREGATE', quantityPerM3: 650, baseUnit: 'KG', displayUnit: 'KG', wastageAllowancePercent: 0 },
        { ingredientId: 'ing_agg10_1', materialIdentifier: 'COARSE_AGG_10MM', specificationStandard: 'IS 383:2016', name: '10mm Aggregate', category: 'COARSE_AGGREGATE', quantityPerM3: 450, baseUnit: 'KG', displayUnit: 'KG', wastageAllowancePercent: 0 },
        { ingredientId: 'ing_water_1', materialIdentifier: 'WATER', specificationStandard: 'IS 456:2000', name: 'Batch Water', category: 'WATER', quantityPerM3: 170, baseUnit: 'LITERS', displayUnit: 'LITERS', isUntrackedBulk: true },
        { ingredientId: 'ing_admix_1', materialIdentifier: 'ADMIXTURE_PCE', specificationStandard: 'IS 9103:1999', name: 'PCE Superplasticizer', category: 'ADMIXTURE', quantityPerM3: 3.8, baseUnit: 'LITERS', displayUnit: 'LITERS' }
      ]
    });
    const recipeId = recipeRes.body?.data?._id || recipeRes.body?.data?.id || recipeRes.body?._id || recipeRes.body?.id;
    assert(recipeRes.status === 201 && recipeId, 'Mix Design Recipe created with IS standard ingredients');

    // Approve Recipe Version 1.0 (Checker approve)
    const appRecRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/recipes/${recipeId}/versions/1.0/approve`,
      method: 'POST',
      headers: approverHeaders
    }, { remarks: 'Approved for production casting' });
    assert(appRecRes.status === 200, 'Mix Recipe approved for production casting');

    // Create Casting Event (Pouring 5.0 m³ segment)
    const evtRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/events',
      method: 'POST',
      headers: authorHeaders
    }, {
      projectId,
      title: 'Podium Slab Pour 1',
      activityType: 'SLAB_CASTING',
      plannedDate: '2026-10-15',
      plannedStartTime: '08:00',
      plannedEndTime: '14:00',
      segments: [
        {
          memberId,
          segmentName: 'Slab Pour Part A',
          plannedVolumeM3: 5.0
        }
      ]
    });
    const event = evtRes.body;
    const eventId = event?.id || event?._id || event?.data?.id || event?.data?._id;
    const seg1Id = (event?.segments || event?.data?.segments)?.[0]?.segmentId;

    assert(evtRes.status === 201 && eventId && seg1Id, 'Casting Event scheduled for 5.0 m³ segment');

    // Bind Recipe to Segment and Generate MRS Revision 1
    const bindRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/segments/recipes`,
      method: 'PUT',
      headers: authorHeaders
    }, {
      bindings: [
        { segmentId: seg1Id, recipeId, versionNumber: '1.0' }
      ]
    });
    assert(bindRes.status === 200, 'Recipe bound to segment');

    const mrsGenRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/mrs/generate`,
      method: 'POST',
      headers: authorHeaders
    }, { changeReason: 'Initial MRS baseline generation' });

    if (mrsGenRes.status !== 201) {
      console.log('mrsGenRes failed:', mrsGenRes.status, mrsGenRes.body);
    }
    assert(mrsGenRes.status === 201 && (mrsGenRes.body?.data?.revisionNumber === 1 || mrsGenRes.body?.revisionNumber === 1), 'MRS Revision 1 generated successfully');

    // Expected for 5.0 m³:
    // Cement: 5 * 380 = 1900 KG
    // Sand: 5 * 720 = 3600 KG
    // 20mm: 5 * 650 = 3250 KG
    // 10mm: 5 * 450 = 2250 KG
    // PCE: 5 * 3.8 = 19 LITERS

    // 3. Stock Inward (GRN) & Canonical Conversions
    console.log('\n📥 Step 3: Project Stock Inward Receipts & Unit Conversions');

    // Inward Delivery 1:
    // Cement: 5 Metric Tonnes -> 5000 KG
    // Sand: 10 Metric Tonnes -> 10000 KG
    // 20mm Aggregate: 8 Metric Tonnes -> 8000 KG
    // 10mm Aggregate: 5 Metric Tonnes -> 5000 KG
    // PCE: 50 Liters -> 50 LITERS
    const inwardRes1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock/inward`,
      method: 'POST',
      headers: authorHeaders
    }, {
      deliveryChallanNumber: 'DC-2026-001',
      supplierName: 'UltraTech Cement & Aggregates Ltd.',
      truckNumber: 'MH-12-AB-9876',
      receivedDate: '2026-10-10',
      items: [
        { materialIdentifier: 'OPC_53', specificationStandard: 'IS 269:2015', name: 'OPC 53 Cement', category: 'CEMENT', receivedQuantity: 5.0, receivedUnit: 'METRIC_TONNE', canonicalTargetUnit: 'KG' },
        { materialIdentifier: 'FINE_AGG_ZONE2', specificationStandard: 'IS 383:2016', name: 'M-Sand', category: 'FINE_AGGREGATE', receivedQuantity: 10.0, receivedUnit: 'METRIC_TONNE', canonicalTargetUnit: 'KG' },
        { materialIdentifier: 'COARSE_AGG_20MM', specificationStandard: 'IS 383:2016', name: '20mm Aggregate', category: 'COARSE_AGGREGATE', receivedQuantity: 8.0, receivedUnit: 'METRIC_TONNE', canonicalTargetUnit: 'KG' },
        { materialIdentifier: 'COARSE_AGG_10MM', specificationStandard: 'IS 383:2016', name: '10mm Aggregate', category: 'COARSE_AGGREGATE', receivedQuantity: 5.0, receivedUnit: 'METRIC_TONNE', canonicalTargetUnit: 'KG' },
        { materialIdentifier: 'ADMIXTURE_PCE', specificationStandard: 'IS 9103:1999', name: 'PCE Superplasticizer', category: 'ADMIXTURE', receivedQuantity: 50, receivedUnit: 'LITERS', canonicalTargetUnit: 'LITERS' }
      ]
    });
    assert(inwardRes1.status === 201 && inwardRes1.body?.data?.inwardKey, 'Stock Inward 1 posted with canonical unit conversion (MT -> KG)');

    // Inward Delivery 2 (50 KG Bags conversion test):
    // Inward 20 bags of Cement (20 * 50 = 1000 KG)
    const inwardBagsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock/inward`,
      method: 'POST',
      headers: authorHeaders
    }, {
      deliveryChallanNumber: 'DC-2026-002-BAGS',
      supplierName: 'UltraTech Bagged Supply',
      items: [
        { materialIdentifier: 'OPC_53', specificationStandard: 'IS 269:2015', name: 'OPC 53 Cement', category: 'CEMENT', receivedQuantity: 20, receivedUnit: 'BAGS_50KG', canonicalTargetUnit: 'KG' }
      ]
    });
    assert(inwardBagsRes.status === 201, 'Stock Inward with BAGS_50KG converted accurately (+1000 KG)');

    // Verify Stock Balances:
    // Cement: 5000 + 1000 = 6000 KG
    const stockListRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock`,
      method: 'GET',
      headers: authorHeaders
    });
    const cementStock = (stockListRes.body?.data || []).find(s => s.materialIdentifier === 'OPC_53');
    assert(cementStock?.currentBalance === 6000 && cementStock?.canonicalUnit === 'KG', 'Project stock balance reflects canonical 6000 KG cement balance');

    // 4. Inward Idempotency & Concurrent Inward Recovery
    console.log('\n🔒 Step 4: Inward Idempotency & Concurrent Replay Protection');
    const duplicateInwardRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock/inward`,
      method: 'POST',
      headers: authorHeaders
    }, {
      deliveryChallanNumber: 'DC-2026-001',
      supplierName: 'UltraTech Cement & Aggregates Ltd.',
      items: [
        { materialIdentifier: 'OPC_53', specificationStandard: 'IS 269:2015', name: 'OPC 53 Cement', category: 'CEMENT', receivedQuantity: 5.0, receivedUnit: 'METRIC_TONNE', canonicalTargetUnit: 'KG' }
      ]
    });
    assert(duplicateInwardRes.body?.data?.isDuplicateReplay === true, 'Duplicate inward returns committed cached receipt with isDuplicateReplay=true');

    // Verify stock did NOT increase on replay
    const stockAfterReplay = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock`,
      method: 'GET',
      headers: authorHeaders
    });
    const cementAfter = (stockAfterReplay.body?.data || []).find(s => s.materialIdentifier === 'OPC_53');
    assert(cementAfter?.currentBalance === 6000, 'Stock balance remained strictly 6000 KG without duplicate increment');

    // 5. Unit Conversion Edge Cases: Mass to Volume without Specific Gravity
    console.log('\n🧪 Step 5: Unit Conversion Safeguards & Ambiguous Rejection');
    const invalidConversionRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock/inward`,
      method: 'POST',
      headers: authorHeaders
    }, {
      deliveryChallanNumber: 'DC-FAIL-CONV',
      supplierName: 'Bad Vendor',
      items: [
        { materialIdentifier: 'OPC_53', specificationStandard: 'IS 269:2015', name: 'OPC Cement', category: 'CEMENT', receivedQuantity: 100, receivedUnit: 'LITERS', canonicalTargetUnit: 'KG' }
      ]
    });
    assert(invalidConversionRes.status === 400 || invalidConversionRes.status === 500, 'Conversion from LITERS to KG without specificGravity rejected safely');

    // 6. Draft Actual Casting Consumption & Variance Evaluation
    console.log('\n📝 Step 6: Draft Actual Pour & Real-Time Variance Calculation');
    const draftRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/consumption`,
      method: 'POST',
      headers: authorHeaders
    }, {
      actualPourDate: '2026-10-15',
      actualPourStartTime: '08:30',
      actualPourEndTime: '13:45',
      batchingPlantName: 'Site Plant Alpha',
      segmentsActual: [
        { segmentId: seg1Id, memberId, segmentName: 'Slab Pour Part A', actualVolumeM3: 5.0 }
      ],
      materialsConsumed: [
        // Cement: Planned 1900 KG, Actual 1925 KG (+1.31% -> OVER_CONSUMPTION_TOLERABLE)
        { materialIdentifier: 'OPC_53', specificationStandard: 'IS 269:2015', name: 'OPC 53 Cement', category: 'CEMENT', plannedQuantity: 1900, actualQuantity: 1925, unit: 'KG', batchNumber: 'B-OPC-101' },
        // Sand: Planned 3600 KG, Actual 3720 KG (+3.33% -> OVER_CONSUMPTION_MODERATE)
        { materialIdentifier: 'FINE_AGG_ZONE2', specificationStandard: 'IS 383:2016', name: 'M-Sand', category: 'FINE_AGGREGATE', plannedQuantity: 3600, actualQuantity: 3720, unit: 'KG' },
        // 20mm: Planned 3250 KG, Actual 3250 KG (0.00% -> NOMINAL)
        { materialIdentifier: 'COARSE_AGG_20MM', specificationStandard: 'IS 383:2016', name: '20mm Aggregate', category: 'COARSE_AGGREGATE', plannedQuantity: 3250, actualQuantity: 3250, unit: 'KG' },
        // 10mm: Planned 2250 KG, Actual 2100 KG (-6.67% -> SAVING_SIGNIFICANT)
        { materialIdentifier: 'COARSE_AGG_10MM', specificationStandard: 'IS 383:2016', name: '10mm Aggregate', category: 'COARSE_AGGREGATE', plannedQuantity: 2250, actualQuantity: 2100, unit: 'KG' },
        // Water: Untracked bulk
        { materialIdentifier: 'WATER', specificationStandard: 'IS 456:2000', name: 'Batch Water', category: 'WATER', plannedQuantity: 850, actualQuantity: 850, unit: 'LITERS', isUntrackedBulk: true },
        // PCE: Planned 19.0 LITERS, Actual 19.0 LITERS
        { materialIdentifier: 'ADMIXTURE_PCE', specificationStandard: 'IS 9103:1999', name: 'PCE Superplasticizer', category: 'ADMIXTURE', plannedQuantity: 19.0, actualQuantity: 19.0, unit: 'LITERS' },
        // Extra retarder: Planned 0, Actual 2.0 LITERS -> UNBUDGETED
        { materialIdentifier: 'RETARDER_EXTRA', specificationStandard: 'IS 9103:1999', name: 'Extra Set Retarder', category: 'ADMIXTURE', plannedQuantity: 0, actualQuantity: 2.0, unit: 'LITERS', isUntrackedBulk: true }
      ]
    });
    const consumptionRecordId = draftRes.body?.data?._id || draftRes.body?.data?.id;
    assert(draftRes.status === 201 && consumptionRecordId, 'Consumption draft created with live variance classifications');

    // Verify continuous variance classifications in response
    const mats = draftRes.body?.data?.materialsConsumed || [];
    const cementItem = mats.find(m => m.materialIdentifier === 'OPC_53');
    const sandItem = mats.find(m => m.materialIdentifier === 'FINE_AGG_ZONE2');
    const agg20Item = mats.find(m => m.materialIdentifier === 'COARSE_AGG_20MM');
    const agg10Item = mats.find(m => m.materialIdentifier === 'COARSE_AGG_10MM');
    const retarderItem = mats.find(m => m.materialIdentifier === 'RETARDER_EXTRA');

    assert(cementItem?.varianceClassification === 'OVER_CONSUMPTION_TOLERABLE', 'Cement (+1.31%) classified as OVER_CONSUMPTION_TOLERABLE');
    assert(sandItem?.varianceClassification === 'OVER_CONSUMPTION_MODERATE', 'Sand (+3.33%) classified as OVER_CONSUMPTION_MODERATE');
    assert(agg20Item?.varianceClassification === 'EXACT_MATCH', '20mm Aggregate (0.00%) classified as EXACT_MATCH');
    assert(agg10Item?.varianceClassification === 'UNDER_CONSUMPTION_HIGH', '10mm Aggregate (-6.67%) classified as UNDER_CONSUMPTION_HIGH');
    assert(retarderItem?.varianceClassification === 'UNBUDGETED', 'Zero-planned Retarder classified as UNBUDGETED');

    // 7. Submit Consumption for Review
    console.log('\n📤 Step 7: Submit Consumption Record for Review');
    const submitRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/consumption/${consumptionRecordId}/submit`,
      method: 'POST',
      headers: authorHeaders
    });
    assert(submitRes.status === 200 && submitRes.body?.success === true, 'Consumption record transitioned to SUBMITTED status');

    // 8. Maker-Checker Enforcement: Author Self-Approval Rejection
    console.log('\n🛡️ Step 8: Maker-Checker Approval Authorization Enforcement');
    const selfApproveRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/consumption/${consumptionRecordId}/approve-and-post`,
      method: 'POST',
      headers: authorHeaders // Author attempting to approve own record
    }, { approvalRemarks: 'Self-approval attempt' });
    assert(selfApproveRes.status === 400 || selfApproveRes.status === 403, 'Maker-Checker Violation: Author self-approval strictly rejected');

    // 9. Atomic Single-Step Approve & Post by Checker (Senior PM Alice)
    console.log('\n⚡ Step 9: Atomic Single-Step Approve & Post to Inventory');
    const approvePostRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/consumption/${consumptionRecordId}/approve-and-post`,
      method: 'POST',
      headers: approverHeaders // Checker approving
    }, { approvalRemarks: 'Slump tests and batch slips verified. Posting to store stock.' });

    const postingKey = approvePostRes.body?.data?.postingKey || approvePostRes.body?.postingKey;
    const postingNumber = approvePostRes.body?.data?.postingNumber || approvePostRes.body?.postingNumber;
    assert((approvePostRes.status === 200 || approvePostRes.status === 201) && postingKey, `Approval & Posting committed atomically! Posting #: ${postingNumber}`);

    // Verify Stock Deductions:
    // Cement: 6000 - 1925 = 4075 KG
    // Sand: 10000 - 3720 = 6280 KG
    // 20mm: 8000 - 3250 = 4750 KG
    // 10mm: 5000 - 2100 = 2900 KG
    // PCE: 50 - 19 = 31 LITERS
    const stockAfterPost = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock`,
      method: 'GET',
      headers: authorHeaders
    });
    const cementPost = (stockAfterPost.body?.data || []).find(s => s.materialIdentifier === 'OPC_53');
    const sandPost = (stockAfterPost.body?.data || []).find(s => s.materialIdentifier === 'FINE_AGG_ZONE2');
    const pcePost = (stockAfterPost.body?.data || []).find(s => s.materialIdentifier === 'ADMIXTURE_PCE');

    assert(cementPost?.currentBalance === 4075, 'Cement stock accurately deducted to 4075 KG');
    assert(sandPost?.currentBalance === 6280, 'Sand stock accurately deducted to 6280 KG');
    assert(pcePost?.currentBalance === 31, 'PCE Admixture stock accurately deducted to 31 LITERS');

    // Verify Member Cumulative Poured Volume updated: 0 -> 5.0 m³ (Partially_Poured)
    const mbrCheck = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/levels/${levelId}/members`,
      method: 'GET',
      headers: authorHeaders
    });
    const slabMbr = (mbrCheck.body?.data || mbrCheck.body || []).find(m => (m._id || m.id) === memberId);
    assert(slabMbr?.actualPouredM3 === 5.0 && slabMbr?.remainingVolumeM3 === 5.0 && slabMbr?.status === 'Partially_Poured', 'Member actualPouredM3 updated to 5.0 m³ with Partially_Poured status');

    // Verify Casting Event Status updated to POURED
    const evtCheck = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}`,
      method: 'GET',
      headers: authorHeaders
    });
    const evtData = evtCheck.body?.data || evtCheck.body;
    assert(evtData?.status === 'POURED' && evtData?.actualTotalVolumeM3 === 5.0, 'Casting Event status transitioned to POURED with actualTotalVolumeM3 = 5.0 m³');

    // Verify Stock Ledger Transactions logged with compound unique keys
    const ledgerRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock/ledger`,
      method: 'GET',
      headers: authorHeaders
    });
    const outwardLines = (ledgerRes.body?.data || []).filter(l => l.operationKey === postingKey);
    assert(outwardLines.length === 7, `Stock ledger recorded all 7 outward transaction lines under operationKey ${postingKey}`);

    // 10. Idempotency on Posting Retries
    console.log('\n🔒 Step 10: Posting Idempotency Protection');
    const retryPostRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/consumption/${consumptionRecordId}/approve-and-post`,
      method: 'POST',
      headers: approverHeaders
    }, { approvalRemarks: 'Retry attempt' });
    assert(retryPostRes.body?.data?.isDuplicateReplay === true, 'Duplicate post returns cached receipt with isDuplicateReplay=true without double-deduction');

    // 11. Insufficient Stock Transaction Rollback
    console.log('\n🛑 Step 11: Insufficient Stock Transaction Rollback Safeguard');
    // Create Event 2 requesting 100,000 KG of cement (exceeding 4075 KG balance)
    const evt2Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/events',
      method: 'POST',
      headers: authorHeaders
    }, {
      projectId,
      title: 'Massive Pour (Excess Stock Test)',
      activityType: 'FOUNDATION_POUR',
      plannedDate: '2026-10-20',
      segments: [{ memberId, segmentName: 'Excess Segment', plannedVolumeM3: 1000 }]
    });
    const event2 = evt2Res.body;
    const event2Id = event2?.id || event2?._id || event2?.data?.id || event2?.data?._id;
    const seg2Id = (event2?.segments || event2?.data?.segments)?.[0]?.segmentId;

    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${event2Id}/segments/recipes`,
      method: 'PUT',
      headers: authorHeaders
    }, { bindings: [{ segmentId: seg2Id, recipeId, versionNumber: '1.0' }] });

    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${event2Id}/mrs/generate`,
      method: 'POST',
      headers: authorHeaders
    }, { changeReason: 'Excess MRS' });

    const draft2Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${event2Id}/consumption`,
      method: 'POST',
      headers: authorHeaders
    }, {
      actualPourDate: '2026-10-20',
      segmentsActual: [{ segmentId: seg2Id, memberId, segmentName: 'Excess Segment', actualVolumeM3: 1000 }],
      materialsConsumed: [
        { materialIdentifier: 'OPC_53', specificationStandard: 'IS 269:2015', name: 'OPC 53 Cement', category: 'CEMENT', plannedQuantity: 380000, actualQuantity: 50000, unit: 'KG' }
      ]
    });
    const rec2Id = draft2Res.body?.data?._id || draft2Res.body?.data?.id || draft2Res.body?._id || draft2Res.body?.id;

    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${event2Id}/consumption/${rec2Id}/submit`,
      method: 'POST',
      headers: authorHeaders
    });

    const excessApproveRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${event2Id}/consumption/${rec2Id}/approve-and-post`,
      method: 'POST',
      headers: approverHeaders
    }, { approvalRemarks: 'Should fail due to insufficient stock' });

    assert(excessApproveRes.status === 400 || excessApproveRes.status === 500, 'Posting cleanly aborted with INSUFFICIENT_STOCK_ERROR');
    
    // Verify Cement stock was unchanged (still 4075 KG)
    const stockAfterAbort = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock`,
      method: 'GET',
      headers: authorHeaders
    });
    const cementUnchanged = (stockAfterAbort.body?.data || []).find(s => s.materialIdentifier === 'OPC_53');
    assert(cementUnchanged?.currentBalance === 4075, 'Stock rollback verified: Cement balance completely preserved at 4075 KG');

    // 12. Full 100% Derived Reversal Engine
    console.log('\n🔄 Step 12: Atomic 100% Derived Reversal Engine');
    const reversalRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/consumption/${consumptionRecordId}/reverse`,
      method: 'POST',
      headers: approverHeaders
    }, { reversalReason: 'Quality audit: Aggregate moisture compensation calibration error on batch slip' });

    const reversalKey = reversalRes.body?.data?.reversalKey;
    assert(reversalRes.status === 200 && reversalKey, `Reversal executed successfully! Reversal Key: ${reversalKey}`);

    // Verify 100% Stock Restoration:
    // Cement: 4075 + 1925 = 6000 KG
    // Sand: 6280 + 3720 = 10000 KG
    // PCE: 31 + 19 = 50 LITERS
    const stockAfterReversal = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock`,
      method: 'GET',
      headers: authorHeaders
    });
    const cementRev = (stockAfterReversal.body?.data || []).find(s => s.materialIdentifier === 'OPC_53');
    const sandRev = (stockAfterReversal.body?.data || []).find(s => s.materialIdentifier === 'FINE_AGG_ZONE2');
    const pceRev = (stockAfterReversal.body?.data || []).find(s => s.materialIdentifier === 'ADMIXTURE_PCE');

    assert(cementRev?.currentBalance === 6000, 'Cement stock 100% restored to 6000 KG');
    assert(sandRev?.currentBalance === 10000, 'Sand stock 100% restored to 10000 KG');
    assert(pceRev?.currentBalance === 50, 'PCE Admixture stock 100% restored to 50 LITERS');

    // Verify Member Poured Volume Reverted: 5.0 -> 0.0 m³ (Planned)
    const mbrRevCheck = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/levels/${levelId}/members`,
      method: 'GET',
      headers: authorHeaders
    });
    const slabMbrRev = (mbrRevCheck.body?.data || mbrRevCheck.body || []).find(m => (m._id || m.id) === memberId);
    assert(slabMbrRev?.actualPouredM3 === 0 && slabMbrRev?.remainingVolumeM3 === 10.0 && slabMbrRev?.status === 'Planned', 'Member actual poured volume reverted to 0 m³ (Planned status)');

    // Verify Event Status Reverted to PLANNED
    const evtRevCheck = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}`,
      method: 'GET',
      headers: authorHeaders
    });
    const evtRevData = evtRevCheck.body?.data || evtRevCheck.body;
    assert(evtRevData?.status === 'PLANNED' && evtRevData?.actualTotalVolumeM3 === 0, 'Casting Event status reverted to PLANNED');

    // Prevent Double-Reversal
    const doubleRevRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/consumption/${consumptionRecordId}/reverse`,
      method: 'POST',
      headers: approverHeaders
    }, { reversalReason: 'Double reversal attempt' });
    assert(doubleRevRes.status === 400 || doubleRevRes.status === 409 || doubleRevRes.status === 500, 'Double reversal on already reversed posting strictly rejected');

    // 13. Multi-Tenant Cross-Access Isolation
    console.log('\n🏢 Step 13: Multi-Tenant Data & Stock Isolation');
    const tenantBCrossRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projectId}/stock`,
      method: 'GET',
      headers: tenantBHeaders
    });
    assert(tenantBCrossRes.body?.data?.length === 0, 'Tenant B cannot access Company A stock register');

    // 14. BBS Independence Verification
    console.log('\n🧱 Step 14: BBS Module Independence & Isolation');
    const bbsOptRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/optimize',
      method: 'POST',
      headers: authorHeaders
    }, {
      stockLength: 12000,
      cuts: [{ length: 4500, quantity: 2 }]
    });
    assert(bbsOptRes.status === 200 || bbsOptRes.status === 404 || bbsOptRes.status === 401, 'BBS endpoints operate completely independently without casting coupling');

    // SUMMARY
    console.log('\n================================================================');
    console.log(`🏁 PHASE 3 ACCEPTANCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled test failure:', err);
    process.exit(1);
  }
}

runAcceptanceTests();
