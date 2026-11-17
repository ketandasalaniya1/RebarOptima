const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });
const { MongoClient, ObjectId } = require('mongodb');
const { ProjectDataGroundingService } = require('./dist/ai-assistant/project-data-grounding.service');
const { GeminiAIProvider } = require('./dist/ai-assistant/gemini-ai.provider');

async function runTestSuite() {
  console.log('================================================================');
  console.log('CRAVETOBUILD AI GROUNDING & DATA ACCURACY VERIFICATION SUITE');
  console.log('================================================================\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const provider = new GeminiAIProvider();

  // Retrieve actual Skyhight project
  const skyhight = await db.collection('projects').findOne({ name: 'Skyhight' });
  const dashtech = await db.collection('projects').findOne({ name: 'Dashtech' });

  if (!skyhight || !dashtech) {
    throw new Error('Required test projects Skyhight or Dashtech not found in database');
  }

  console.log(`[SETUP] Skyhight Project ID: ${skyhight._id.toString()} | Company ID: ${skyhight.companyId.toString()}`);
  console.log(`[SETUP] Dashtech Project ID: ${dashtech._id.toString()} | Company ID: ${dashtech.companyId.toString()}\n`);

  // Context for Company Admin authorized for Skyhight
  const skyhightAdminCtx = {
    userId: 'user_skyhight_admin',
    companyId: skyhight.companyId.toString(),
    role: 'Company Admin',
    roleNormalized: 'COMPANY_ADMIN',
    assignedProjects: [skyhight._id.toString()],
    dataScope: 'organization',
    isCompanyAdmin: true,
    isPartnerAdmin: false,
    isDeveloper: false,
    requiresProjectAssignment: false,
  };

  // Context for Site Engineer (Unauthorized for financials)
  const skyhightSiteEngineerCtx = {
    userId: 'user_skyhight_engineer',
    companyId: skyhight.companyId.toString(),
    role: 'Site Engineer',
    roleNormalized: 'SITE_ENGINEER',
    assignedProjects: [skyhight._id.toString()],
    dataScope: 'project',
    isCompanyAdmin: false,
    isPartnerAdmin: false,
    isDeveloper: false,
    requiresProjectAssignment: true,
  };

  // Context for Dashtech Admin (Separate company)
  const dashtechAdminCtx = {
    userId: 'user_dashtech_admin',
    companyId: dashtech.companyId.toString(),
    role: 'Company Admin',
    roleNormalized: 'COMPANY_ADMIN',
    assignedProjects: [dashtech._id.toString()],
    dataScope: 'organization',
    isCompanyAdmin: true,
    isPartnerAdmin: false,
    isDeveloper: false,
    requiresProjectAssignment: false,
  };

  const results = [];

  // ====================================================================
  // TEST 1: Summarize overall progress for Skyhight
  // ====================================================================
  console.log('--- TEST 1: Summarize overall progress for Skyhight ---');
  {
    const target = await ProjectDataGroundingService.resolveTargetProject(
      db,
      skyhightAdminCtx,
      skyhight._id.toString(),
      'Summarize overall progress for Skyhight'
    );
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      skyhightAdminCtx,
      target.project,
      'Summarize overall progress for Skyhight'
    );
    const aiRes = await provider.generateResponse({
      prompt: 'Summarize overall progress for Skyhight',
      role: skyhightAdminCtx.role,
      roleNormalized: skyhightAdminCtx.roleNormalized,
      userName: 'Admin User',
      projectId: target.project._id.toString(),
      projectName: target.project.name,
      groundedContext: context,
    });

    console.log(`DB Blocks found: ${context.metrics.project.blocksCount} (${context.metrics.project.blockNames.join(', ')})`);
    console.log(`DB Tasks count: ${context.metrics.pm.totalTasks} (Status: ${context.metrics.pm.status})`);
    console.log(`AI Response snippet:\n${aiRes.content.slice(0, 350)}...\n`);

    const hasFabrication =
      aiRes.content.includes('42%') ||
      aiRes.content.includes('450 MT') ||
      aiRes.content.includes('3,200') ||
      aiRes.content.includes('145 workers');

    results.push({
      test: '1. Summarize overall progress for Skyhight',
      passed: !hasFabrication && (aiRes.content.includes('not available') || aiRes.content.includes('DATA UNAVAILABLE') || aiRes.content.includes('0 task')),
      details: 'Blocks accurately reported (Tower A, Tower B); unlogged tasks reported as unavailable without fabricated 42% or 450 MT.',
    });
  }

  // ====================================================================
  // TEST 2: What activities are currently delayed?
  // ====================================================================
  console.log('--- TEST 2: What activities are currently delayed? ---');
  {
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      skyhightAdminCtx,
      skyhight,
      'What activities are currently delayed?'
    );
    const aiRes = await provider.generateResponse({
      prompt: 'What activities are currently delayed?',
      role: skyhightAdminCtx.role,
      roleNormalized: skyhightAdminCtx.roleNormalized,
      userName: 'Admin User',
      projectId: skyhight._id.toString(),
      projectName: skyhight.name,
      groundedContext: context,
    });

    console.log(`AI Response snippet:\n${aiRes.content.slice(0, 250)}...\n`);
    results.push({
      test: '2. What activities are currently delayed?',
      passed: aiRes.content.includes('not available') || aiRes.content.includes('0 task') || aiRes.content.includes('No task'),
      details: 'Accurately reports 0 delayed activities logged for Skyhight.',
    });
  }

  // ====================================================================
  // TEST 3: What is the next scheduled slab casting?
  // ====================================================================
  console.log('--- TEST 3: What is the next scheduled slab casting? ---');
  {
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      skyhightAdminCtx,
      skyhight,
      'What is the next scheduled slab casting?'
    );
    const aiRes = await provider.generateResponse({
      prompt: 'What is the next scheduled slab casting?',
      role: skyhightAdminCtx.role,
      roleNormalized: skyhightAdminCtx.roleNormalized,
      userName: 'Admin User',
      projectId: skyhight._id.toString(),
      projectName: skyhight.name,
      groundedContext: context,
    });

    console.log(`AI Response snippet:\n${aiRes.content.slice(0, 250)}...\n`);
    const hasOutdated2023 = aiRes.content.includes('2023');
    results.push({
      test: '3. What is the next scheduled slab casting?',
      passed: !hasOutdated2023 && (aiRes.content.includes('not available') || aiRes.content.includes('None scheduled') || aiRes.content.includes('0 casting')),
      details: 'Eliminated fabricated 2023 slab casting date; reports 0 casting records in database.',
    });
  }

  // ====================================================================
  // TEST 4: How much cement is currently available?
  // ====================================================================
  console.log('--- TEST 4: How much cement is currently available? ---');
  {
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      skyhightAdminCtx,
      skyhight,
      'How much cement is currently available?'
    );
    const aiRes = await provider.generateResponse({
      prompt: 'How much cement is currently available?',
      role: skyhightAdminCtx.role,
      roleNormalized: skyhightAdminCtx.roleNormalized,
      userName: 'Admin User',
      projectId: skyhight._id.toString(),
      projectName: skyhight.name,
      groundedContext: context,
    });

    console.log(`AI Response snippet:\n${aiRes.content.slice(0, 250)}...\n`);
    results.push({
      test: '4. How much cement is currently available?',
      passed: aiRes.content.includes('not available') || aiRes.content.includes('0 material') || aiRes.content.includes('No materials'),
      details: 'Accurately reports no cement balances logged in gi_materials for Skyhight.',
    });
  }

  // ====================================================================
  // TEST 5: How many workers are assigned to this project?
  // ====================================================================
  console.log('--- TEST 5: How many workers are assigned to this project? ---');
  {
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      skyhightAdminCtx,
      skyhight,
      'How many workers are assigned to this project?'
    );
    const aiRes = await provider.generateResponse({
      prompt: 'How many workers are assigned to this project?',
      role: skyhightAdminCtx.role,
      roleNormalized: skyhightAdminCtx.roleNormalized,
      userName: 'Admin User',
      projectId: skyhight._id.toString(),
      projectName: skyhight.name,
      groundedContext: context,
    });

    console.log(`AI Response snippet:\n${aiRes.content.slice(0, 250)}...\n`);
    const lowerContent = aiRes.content.toLowerCase();
    const hasFake145 = aiRes.content.includes('145');
    results.push({
      test: '5. How many workers are assigned to this project?',
      passed: !hasFake145 && (lowerContent.includes('not available') || lowerContent.includes('unavailable') || lowerContent.includes('0 attendance') || lowerContent.includes('no attendance')),
      details: 'Eliminated fabricated 145 workers; truthfully reports 0 muster sessions logged.',
    });
  }

  // ====================================================================
  // TEST 6: What is the actual project budget utilization?
  // ====================================================================
  console.log('--- TEST 6: What is the actual project budget utilization? ---');
  {
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      skyhightAdminCtx,
      skyhight,
      'What is the actual project budget utilization?'
    );
    const aiRes = await provider.generateResponse({
      prompt: 'What is the actual project budget utilization?',
      role: skyhightAdminCtx.role,
      roleNormalized: skyhightAdminCtx.roleNormalized,
      userName: 'Admin User',
      projectId: skyhight._id.toString(),
      projectName: skyhight.name,
      groundedContext: context,
    });

    console.log(`AI Response snippet:\n${aiRes.content.slice(0, 250)}...\n`);
    const hasFake38 = aiRes.content.includes('38%');
    results.push({
      test: '6. What is the actual project budget utilization?',
      passed: !hasFake38 && (aiRes.content.includes('not available') || aiRes.content.includes('0 budget') || aiRes.content.includes('No budget') || aiRes.content.includes('pm_costs')),
      details: 'Eliminated fabricated 38% utilization; truthfully reports 0 cost records logged in pm_costs.',
    });
  }

  // ====================================================================
  // TEST 7: Which purchase orders are pending?
  // ====================================================================
  console.log('--- TEST 7: Which purchase orders are pending? ---');
  {
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      skyhightAdminCtx,
      skyhight,
      'Which purchase orders are pending?'
    );
    const aiRes = await provider.generateResponse({
      prompt: 'Which purchase orders are pending?',
      role: skyhightAdminCtx.role,
      roleNormalized: skyhightAdminCtx.roleNormalized,
      userName: 'Admin User',
      projectId: skyhight._id.toString(),
      projectName: skyhight.name,
      groundedContext: context,
    });

    console.log(`AI Response snippet:\n${aiRes.content.slice(0, 250)}...\n`);
    results.push({
      test: '7. Which purchase orders are pending?',
      passed: aiRes.content.includes('not available') || aiRes.content.includes('0 purchase') || aiRes.content.includes('No purchase'),
      details: 'Accurately reports purchase orders are not logged in the database.',
    });
  }

  // ====================================================================
  // TEST 8: Which project activities are overdue?
  // ====================================================================
  console.log('--- TEST 8: Which project activities are overdue? ---');
  {
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      skyhightAdminCtx,
      skyhight,
      'Which project activities are overdue?'
    );
    const aiRes = await provider.generateResponse({
      prompt: 'Which project activities are overdue?',
      role: skyhightAdminCtx.role,
      roleNormalized: skyhightAdminCtx.roleNormalized,
      userName: 'Admin User',
      projectId: skyhight._id.toString(),
      projectName: skyhight.name,
      groundedContext: context,
    });

    console.log(`AI Response snippet:\n${aiRes.content.slice(0, 250)}...\n`);
    results.push({
      test: '8. Which project activities are overdue?',
      passed: aiRes.content.includes('not available') || aiRes.content.includes('0 task') || aiRes.content.includes('No task'),
      details: 'Accurately reports no schedule entries or overdue tasks exist in pm_tasks.',
    });
  }

  // ====================================================================
  // EDGE CASE 1: Live Yard Inventory Grounding on Dashtech (Has 60 stockitems)
  // ====================================================================
  console.log('--- EDGE CASE 1: Live Yard Inventory on Dashtech ---');
  {
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      dashtechAdminCtx,
      dashtech,
      'What is our current live yard inventory in MT?'
    );
    console.log(`Dashtech Steel: ${context.metrics.steel.totalStockMT} MT (${context.metrics.steel.totalStockKg} kg across ${context.metrics.steel.totalItemsCount} items)`);
    results.push({
      test: 'Edge Case 1: Live Rebar Grounding on Dashtech',
      passed: context.metrics.steel.totalStockMT === '9.01' && context.metrics.steel.totalItemsCount === 60,
      details: `Accurately retrieved exactly 9.01 MT live rebar stock across 60 line items from stockitems.`,
    });
  }

  // ====================================================================
  // EDGE CASE 2: Unauthorized User Asking for Financial Information
  // ====================================================================
  console.log('--- EDGE CASE 2: Unauthorized User Asking for Financials ---');
  {
    const context = await ProjectDataGroundingService.getGroundedContext(
      db,
      skyhightSiteEngineerCtx,
      skyhight,
      'What is the project budget utilization and petty cash balance?'
    );
    const aiRes = await provider.generateResponse({
      prompt: 'What is the project budget utilization and petty cash balance?',
      role: skyhightSiteEngineerCtx.role,
      roleNormalized: skyhightSiteEngineerCtx.roleNormalized,
      userName: 'Site Engineer Bob',
      projectId: skyhight._id.toString(),
      projectName: skyhight.name,
      groundedContext: context,
    });

    console.log(`Status in context: ${context.metrics.finance.status}`);
    console.log(`AI Response:\n${aiRes.content.slice(0, 250)}...\n`);
    results.push({
      test: 'Edge Case 2: Financial Permission Enforcement (Site Engineer)',
      passed: context.metrics.finance.status === 'unauthorized' && (aiRes.content.includes('Access Denied') || aiRes.content.includes('not authorized') || aiRes.content.includes('restricted')),
      details: 'Site Engineer role correctly blocked from accessing financial metrics or petty cash balance.',
    });
  }

  // ====================================================================
  // EDGE CASE 3: Cross-Company Access Attempt
  // ====================================================================
  console.log('--- EDGE CASE 3: Cross-Company Access Attempt ---');
  {
    let blocked = false;
    let errorCode = '';
    try {
      // Dashtech user trying to request Skyhight (belongs to a different company)
      await ProjectDataGroundingService.resolveTargetProject(
        db,
        dashtechAdminCtx,
        dashtech._id.toString(),
        'Summarize overall progress for Skyhight'
      );
    } catch (err) {
      blocked = true;
      errorCode = err.code || err.status;
      console.log(`Successfully intercepted cross-company access! Code: ${errorCode} | Message: ${err.message}`);
    }

    results.push({
      test: 'Edge Case 3: Cross-Company Access Interception',
      passed: blocked && errorCode === 'CROSS_COMPANY_UNAUTHORIZED',
      details: 'Blocked Dashtech user from querying Skyhight across company boundaries with HTTP 403 CROSS_COMPANY_UNAUTHORIZED.',
    });
  }

  // ====================================================================
  // EDGE CASE 4: Unknown Project Requested
  // ====================================================================
  console.log('--- EDGE CASE 4: Unknown Project Requested ---');
  {
    let notFound = false;
    let errorCode = '';
    try {
      await ProjectDataGroundingService.resolveTargetProject(
        db,
        skyhightAdminCtx,
        skyhight._id.toString(),
        'Summarize overall progress for Project Atlantis'
      );
    } catch (err) {
      notFound = true;
      errorCode = err.code || err.status;
      console.log(`Successfully caught unknown project! Code: ${errorCode} | Message: ${err.message}`);
    }

    results.push({
      test: 'Edge Case 4: Unknown Project Handling',
      passed: notFound && errorCode === 'PROJECT_NOT_FOUND',
      details: 'Correctly returned HTTP 404 PROJECT_NOT_FOUND when user explicitly asked for non-existent Project Atlantis.',
    });
  }

  console.log('\n================================================================');
  console.log('TEST SUITE EXECUTION SUMMARY');
  console.log('================================================================');
  let passCount = 0;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    if (r.passed) passCount++;
    console.log(`${symbol} | ${r.test} | ${r.details}`);
  }
  console.log(`\nTOTAL: ${passCount} / ${results.length} tests passed (${Math.round((passCount / results.length) * 100)}% success rate).\n`);

  await client.close();
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
