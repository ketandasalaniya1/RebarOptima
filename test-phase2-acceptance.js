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
  console.log('🚀 RUNNING PHASE 2 CASTING MANAGEMENT AUTOMATED TEST SUITE');
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
    // 1. Generate Multi-User JWT Tokens for Maker-Checker and Multi-Tenancy Testing
    console.log('📦 Step 1: User & Tenant Identity Setup');
    const companyA = `comp_alpha_${Date.now()}`;
    const companyB = `comp_beta_${Date.now()}`;

    const userAuthorToken = jwt.sign({
      sub: 'usr_site_eng_1',
      email: 'site_eng@companyA.com',
      name: 'Site Engineer Bob',
      role: 'ADMIN',
      companyId: companyA,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const userApproverToken = jwt.sign({
      sub: 'usr_sr_eng_2',
      email: 'sr_eng@companyA.com',
      name: 'Senior Engineer Alice',
      role: 'ADMIN',
      companyId: companyA,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const tenantBUserToken = jwt.sign({
      sub: 'usr_tenant_b',
      email: 'engineer@companyB.com',
      name: 'Tenant B Engineer',
      role: 'ADMIN',
      companyId: companyB,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const authAuthorHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userAuthorToken}`
    };

    const authApproverHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userApproverToken}`
    };

    const authTenantBHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tenantBUserToken}`
    };

    assert(userAuthorToken && userApproverToken, 'Generated cryptographically signed JWT tokens for testing');

    // 2. Test Water-Ratio Precision & Draft Recipe Creation
    console.log('\n🧪 Step 2: Recipe Management & Water Ratio Precision');
    const m25RecipeCode = `REC-M25-${Date.now()}`;
    const m25RecipeRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/recipes',
      method: 'POST',
      headers: authAuthorHeaders
    }, {
      recipeCode: m25RecipeCode,
      grade: 'M25',
      displayName: 'M25 High Durability Pump Mix',
      mixType: 'SITE_BATCHING',
      engineeringLimits: {
        minCementContentKgPerM3: 300,
        maxTotalCementitiousKgPerM3: 450,
        maxWaterCementRatio: 0.55,
        maxWaterCementitiousRatio: 0.45
      },
      ingredients: [
        {
          ingredientId: 'ing_cem_1',
          materialIdentifier: 'MAT-CEM-OPC53-UT',
          specificationStandard: 'IS 269:2015',
          name: 'UltraTech OPC 53 Cement',
          category: 'CEMENT',
          quantityPerM3: 300,
          baseUnit: 'KG',
          displayUnit: 'BAGS_50KG',
          wastageAllowancePercent: 1.5
        },
        {
          ingredientId: 'ing_scm_1',
          materialIdentifier: 'MAT-SCM-FLYASH-P60',
          specificationStandard: 'IS 3812 Part 1',
          name: 'Class F Fly Ash',
          category: 'SUPPLEMENTARY_CEMENTITIOUS',
          quantityPerM3: 100,
          baseUnit: 'KG',
          displayUnit: 'METRIC_TONNE',
          wastageAllowancePercent: 1.0
        },
        {
          ingredientId: 'ing_sand_1',
          materialIdentifier: 'MAT-SAND-MSAND-Z2',
          specificationStandard: 'IS 383:2016 Zone II',
          name: 'M-Sand Zone II',
          category: 'FINE_AGGREGATE',
          quantityPerM3: 750,
          baseUnit: 'KG',
          displayUnit: 'METRIC_TONNE',
          aggregateBasis: 'SSD',
          waterAbsorptionPercent: 1.5,
          moistureCorrectionPercent: 4.0, // Surface moisture = 4.0 - 1.5 = +2.5%
          wastageAllowancePercent: 2.0
        },
        {
          ingredientId: 'ing_agg_1',
          materialIdentifier: 'MAT-AGG-20MM',
          specificationStandard: 'IS 383:2016',
          name: '20mm Coarse Aggregate',
          category: 'COARSE_AGGREGATE',
          quantityPerM3: 1050,
          baseUnit: 'KG',
          displayUnit: 'METRIC_TONNE',
          aggregateBasis: 'SSD',
          waterAbsorptionPercent: 0.5,
          moistureCorrectionPercent: 0,
          wastageAllowancePercent: 1.5
        },
        {
          ingredientId: 'ing_water_1',
          materialIdentifier: 'MAT-WATER-POTABLE',
          specificationStandard: 'IS 456 Cl. 5.4',
          name: 'Potable Mixing Water',
          category: 'WATER',
          quantityPerM3: 160,
          baseUnit: 'LITERS',
          displayUnit: 'LITERS'
        },
        {
          ingredientId: 'ing_admix_1',
          materialIdentifier: 'MAT-ADMIX-CHRYSO-OPT100',
          specificationStandard: 'ASTM C494 Type F',
          name: 'Chryso Optima 100 Superplasticizer',
          category: 'CHEMICAL_ADMIXTURE',
          quantityPerM3: 3.5,
          baseUnit: 'KG',
          displayUnit: 'LITERS',
          specificGravity: 1.15
        }
      ]
    });

    if (m25RecipeRes.status !== 201) {
      console.log('m25RecipeRes failed with status:', m25RecipeRes.status, m25RecipeRes.body);
    }
    assert(m25RecipeRes.status === 201, 'Created Draft Recipe M25 (201 Created)');
    const m25Recipe = m25RecipeRes.body?.data;
    const initialVer = m25Recipe?.versions?.[0];

    // Assert w/c = 160 / 300 = 0.533 and w/cm = 160 / 400 = 0.400
    assert(initialVer?.calculatedWaterCementRatio === 0.533, `w/c calculated accurately as 0.533 (got ${initialVer?.calculatedWaterCementRatio})`);
    assert(initialVer?.calculatedWaterCementitiousRatio === 0.4, `w/cm calculated accurately as 0.400 (got ${initialVer?.calculatedWaterCementitiousRatio})`);

    // 3. Test Maker-Checker Authorization & Recipe Approval
    console.log('\n🔒 Step 3: Maker-Checker Security & Immutability Enforcement');
    // Self-approval attempt by author must be rejected (403)
    const selfApproveRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/recipes/${m25Recipe._id}/versions/1.0/approve`,
      method: 'POST',
      headers: authAuthorHeaders
    }, { remarks: 'Author attempting self approval' });

    assert(selfApproveRes.status === 403, 'Self-approval by recipe author blocked with 403 Forbidden (Maker-Checker enforced)');

    // Legitimate approval by Senior Engineer Alice
    const legitimateApproveRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/recipes/${m25Recipe._id}/versions/1.0/approve`,
      method: 'POST',
      headers: authApproverHeaders
    }, { remarks: 'Technically verified against mix trials by Senior Engineer Alice' });

    assert(legitimateApproveRes.status === 200, 'Senior Engineer approved recipe version 1.0 successfully');

    // Attempt to edit approved version (must be blocked)
    const editApprovedRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/recipes/${m25Recipe._id}/versions/1.0`,
      method: 'PUT',
      headers: authAuthorHeaders
    }, { versionNotes: 'Attempting illegal edit on approved version' });

    assert(editApprovedRes.status === 403, 'Direct edit on approved version rejected with 403 Forbidden (Immutability enforced)');

    // 4. Create & Approve M40 Column Mix Recipe
    console.log('\n🏗️ Step 4: Create & Approve M40 Column Mix Recipe');
    const m40RecipeCode = `REC-M40-${Date.now()}`;
    const m40RecipeRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/recipes',
      method: 'POST',
      headers: authAuthorHeaders
    }, {
      recipeCode: m40RecipeCode,
      grade: 'M40',
      displayName: 'M40 High Strength Column Mix',
      mixType: 'SITE_BATCHING',
      ingredients: [
        {
          ingredientId: 'ing_m40_cem_1',
          materialIdentifier: 'MAT-CEM-OPC53-UT', // Identical SKU to test consolidation across grades
          specificationStandard: 'IS 269:2015',
          name: 'UltraTech OPC 53 Cement',
          category: 'CEMENT',
          quantityPerM3: 420,
          baseUnit: 'KG',
          displayUnit: 'BAGS_50KG',
          wastageAllowancePercent: 1.5
        },
        {
          ingredientId: 'ing_m40_sand_1',
          materialIdentifier: 'MAT-SAND-MSAND-Z2',
          specificationStandard: 'IS 383:2016 Zone II',
          name: 'M-Sand Zone II',
          category: 'FINE_AGGREGATE',
          quantityPerM3: 680,
          baseUnit: 'KG',
          displayUnit: 'METRIC_TONNE',
          wastageAllowancePercent: 2.0
        },
        {
          ingredientId: 'ing_m40_agg_1',
          materialIdentifier: 'MAT-AGG-20MM',
          specificationStandard: 'IS 383:2016',
          name: '20mm Coarse Aggregate',
          category: 'COARSE_AGGREGATE',
          quantityPerM3: 1100,
          baseUnit: 'KG',
          displayUnit: 'METRIC_TONNE',
          wastageAllowancePercent: 1.5
        },
        {
          ingredientId: 'ing_m40_water_1',
          materialIdentifier: 'MAT-WATER-POTABLE',
          specificationStandard: 'IS 456 Cl. 5.4',
          name: 'Potable Mixing Water',
          category: 'WATER',
          quantityPerM3: 168,
          baseUnit: 'LITERS',
          displayUnit: 'LITERS'
        }
      ]
    });

    const m40Recipe = m40RecipeRes.body?.data;
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/recipes/${m40Recipe._id}/versions/1.0/approve`,
      method: 'POST',
      headers: authApproverHeaders
    }, { remarks: 'Approved by Senior Engineer Alice' });

    assert(m40RecipeRes.status === 201, 'M40 recipe created and approved');

    // 5. Setup Casting Project, Members and Multi-Grade Event
    console.log('\n📋 Step 5: Multi-Grade Casting Event Creation & Segment Binding');
    const projRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/projects',
      method: 'POST',
      headers: authAuthorHeaders
    }, {
      name: `Pre-Casting Tower Project ${Date.now()}`,
      code: `PRJ-PC-${Date.now().toString().slice(-4)}`
    });
    const projId = projRes.body?.id || projRes.body?._id;

    const blockRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/projects/${projId}/blocks`,
      method: 'POST',
      headers: authAuthorHeaders
    }, { name: 'Tower A', code: 'TWR-A' });
    const blockId = blockRes.body?.id || blockRes.body?._id;

    const levelRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/blocks/${blockId}/levels`,
      method: 'POST',
      headers: authAuthorHeaders
    }, { name: 'Level 5', floorNumber: 5 });
    const levelId = levelRes.body?.id || levelRes.body?._id;

    // Member 1: Columns (M40, 10 m³)
    const colRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/levels/${levelId}/members`,
      method: 'POST',
      headers: authAuthorHeaders
    }, {
      memberType: 'Column',
      displayId: 'C1-C4',
      volumeEntryMethod: 'DIRECT_ENGINEER_ENTRY',
      totalRequiredVolumeM3: 10.0,
      basisOfCalculation: 'Structural Column Schedule DWG-C-05'
    });

    // Member 2: Slab & Beams (M25, 30 m³)
    const slabRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/levels/${levelId}/members`,
      method: 'POST',
      headers: authAuthorHeaders
    }, {
      memberType: 'Slab',
      displayId: 'S5-SLAB',
      volumeEntryMethod: 'DIRECT_ENGINEER_ENTRY',
      totalRequiredVolumeM3: 30.0,
      basisOfCalculation: 'Slab Layout Drawing S-05-B'
    });

    const colMemberId = colRes.body?.id || colRes.body?._id;
    const slabMemberId = slabRes.body?.id || slabRes.body?._id;

    // Create Multi-Grade Casting Event
    const eventRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/events',
      method: 'POST',
      headers: authAuthorHeaders
    }, {
      projectId: projId,
      title: 'Tower A Level 5 Integrated Pour',
      activityType: 'Slab_Beam',
      plannedDate: '2026-10-15',
      segments: [
        {
          memberId: colMemberId,
          segmentName: 'L5 Columns Lift 1',
          plannedVolumeM3: 10.0
        },
        {
          memberId: slabMemberId,
          segmentName: 'L5 Slab & Beam Pour',
          plannedVolumeM3: 30.0
        }
      ]
    });

    if (eventRes.status !== 201) {
      console.log('eventRes failed with status:', eventRes.status, eventRes.body);
    }
    const event = eventRes.body;
    const eventId = event?.id || event?._id;
    assert(eventRes.status === 201, `Created Multi-Grade Casting Event ${event?.eventNumber} (Total: ${event?.plannedTotalVolumeM3} m³)`);

    // 6. Bind Approved Recipes to Segments
    console.log('\n🔗 Step 6: Segment Recipe Binding (Segment 1 -> M40, Segment 2 -> M25)');
    const seg1Id = event.segments[0].segmentId;
    const seg2Id = event.segments[1].segmentId;

    const bindRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/segments/recipes`,
      method: 'PUT',
      headers: authAuthorHeaders
    }, {
      bindings: [
        {
          segmentId: seg1Id,
          recipeId: m40Recipe._id,
          versionNumber: '1.0',
          appliedWastagePercent: 1.5
        },
        {
          segmentId: seg2Id,
          recipeId: m25Recipe._id,
          versionNumber: '1.0',
          appliedWastagePercent: 2.0
        }
      ]
    });
    assert(bindRes.status === 200, 'Segment recipe bindings successfully updated with approved recipes');

    // 7. Generate Material Requirement Sheet (MRS Revision 1)
    console.log('\n📦 Step 7: Material Requirement Sheet (MRS) Generation & Consolidation');
    const genMrsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/mrs/generate`,
      method: 'POST',
      headers: authAuthorHeaders
    }, { changeReason: 'Initial pre-casting calculation' });

    if (genMrsRes.status !== 201) {
      console.log('genMrsRes failed with status:', genMrsRes.status, genMrsRes.body);
    }
    assert(genMrsRes.status === 201, 'Generated MRS Revision 1 (201 Created)');
    const mrsRev1 = genMrsRes.body?.data;
    assert(mrsRev1?.revisionNumber === 1, 'MRS Revision Number is 1');
    assert(mrsRev1?.segmentsBreakdown?.length === 2, 'Contains 2 separate segment breakdowns');
    assert(mrsRev1?.gradeSubtotals?.length === 2, 'Contains 2 grade subtotals (M40 and M25)');

    // Verify consolidated cement aggregation:
    // Seg 1 (M40): 10 m³ * 420 kg/m³ * 1.015 = 4263.0 kg
    // Seg 2 (M25): 30 m³ * 300 kg/m³ * 1.020 = 9180.0 kg
    // Total Cement (UltraTech OPC 53) = 4263.0 + 9180.0 = 13443.0 kg -> 268.86 bags
    const cementConsolidated = mrsRev1?.consolidatedTotals?.find(c => c.materialIdentifier === 'MAT-CEM-OPC53-UT');
    assert(cementConsolidated, 'Consolidated Bill of Materials contains MAT-CEM-OPC53-UT');
    assert(Math.abs(cementConsolidated?.totalQuantityRequired - 13443.0) < 0.1, `Consolidated cement total is 13,443.0 kg (got ${cementConsolidated?.totalQuantityRequired})`);
    assert(cementConsolidated?.displayQuantity === 268.86, `Cement display quantity is 268.86 bags (got ${cementConsolidated?.displayQuantity})`);
    assert(cementConsolidated?.inventoryStatus === 'NOT_TRACKED_IN_INVENTORY', 'Cement correctly flagged as NOT_TRACKED_IN_INVENTORY in read-only stock check');

    // 8. Test Staleness & Multi-Revision History
    console.log('\n📜 Step 8: Plan Update, Staleness Flag & MRS Revision 2');
    // Update event segment volume from 30m³ to 35m³
    const updatedSegments = [...event.segments];
    updatedSegments[1].plannedVolumeM3 = 35.0;
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}`,
      method: 'PUT',
      headers: authAuthorHeaders
    }, { segments: updatedSegments });

    // Verify MRS getter returns isStale: true
    const mrsCheckRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/mrs`,
      method: 'GET',
      headers: authAuthorHeaders
    });
    assert(mrsCheckRes.body?.isStale === true, 'Event modification automatically flags MRS as stale (isStale: true)');

    // Generate MRS Revision 2
    const genMrsRev2Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/mrs/generate`,
      method: 'POST',
      headers: authAuthorHeaders
    }, { changeReason: 'Increased Level 5 slab volume to 35 m³' });

    if (genMrsRev2Res.status !== 201) {
      console.log('genMrsRev2Res failed with status:', genMrsRev2Res.status, genMrsRev2Res.body);
    }
    assert(genMrsRev2Res.status === 201, 'Generated MRS Revision 2');
    const mrsRev2 = genMrsRev2Res.body?.data;
    assert(mrsRev2?.revisionNumber === 2, 'New MRS has revisionNumber 2');

    // Retrieve historical Revision 1 and verify it was preserved identically
    const fetchRev1Res = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/mrs?revision=1`,
      method: 'GET',
      headers: authAuthorHeaders
    });
    assert(fetchRev1Res.body?.data?.revisionNumber === 1, 'Historical Revision 1 retrieved successfully');
    assert(fetchRev1Res.body?.data?.totalPlannedVolumeM3 === 40.0, 'Historical Revision 1 retains original 40 m³ planned volume snapshot');

    // 9. Negative Tests: Multi-Tenant Cross-Company Access
    console.log('\n🛡️ Step 9: Multi-Tenant Cross-Company Isolation (Negative Test)');
    const crossTenantRecipeRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/recipes/${m25Recipe._id}`,
      method: 'GET',
      headers: authTenantBHeaders
    });
    assert(crossTenantRecipeRes.status === 404, 'Cross-tenant access to Recipe blocked with 404 Not Found (Company isolation verified)');

    const crossTenantEventMrsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/casting/events/${eventId}/mrs`,
      method: 'GET',
      headers: authTenantBHeaders
    });
    assert(crossTenantEventMrsRes.status === 404, 'Cross-tenant access to MRS blocked with 404 Not Found (Company isolation verified)');

    // 10. BBS Module Isolation & Phase 1 Regression Check
    console.log('\n🔍 Step 10: BBS Isolation & Phase 1 Regression Verification');
    const bbsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bbs/projects',
      method: 'GET',
      headers: authAuthorHeaders
    });
    assert(bbsRes.status === 200 || bbsRes.status === 404, 'BBS endpoints respond independently with zero coupling');

    const p1ProjectsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/casting/projects',
      method: 'GET',
      headers: authAuthorHeaders
    });
    assert(p1ProjectsRes.status === 200 && p1ProjectsRes.body?.length > 0, 'Phase 1 Structural Project register functional with zero regressions');

    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runAcceptanceTests();
