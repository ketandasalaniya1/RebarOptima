/**
 * ══════════════════════════════════════════════════════════════════════════════
 * REBAROPTIMA — GENERAL INVENTORY MODULE ACCEPTANCE & INTEGRATION TEST SUITE
 * Complete Verification of Acceptance Criteria 1 to 21
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

async function runGeneralInventoryAcceptanceSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING GENERAL INVENTORY ACCEPTANCE & REGRESSION SUITE');
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
    const companyId = `comp_gi_test_${Date.now()}`;
    const companyIdTenantB = `comp_gi_tenant_b_${Date.now()}`;

    // Admin Token (Tenant A)
    const adminToken = jwt.sign({
      sub: '65f1a2b3c4d5e6f7a8b9c0d1',
      email: 'admin@rebaroptima.com',
      name: 'Project Admin',
      role: 'ADMIN',
      companyId,
      accountType: 'developer'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    // Storekeeper Token (Tenant A)
    const storeKeeperToken = jwt.sign({
      sub: '65f1a2b3c4d5e6f7a8b9c0d2',
      email: 'storekeeper@rebaroptima.com',
      name: 'Suresh Storekeeper',
      role: 'STORE_KEEPER',
      companyId,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    // Tenant B Token
    const tenantBToken = jwt.sign({
      sub: '65f1a2b3c4d5e6f7a8b9c0d3',
      email: 'user@tenantb.com',
      name: 'Tenant B User',
      role: 'ADMIN',
      companyId: companyIdTenantB,
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const authAdmin = { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    const authStoreKeeper = { 'Authorization': `Bearer ${storeKeeperToken}`, 'Content-Type': 'application/json' };
    const authTenantB = { 'Authorization': `Bearer ${tenantBToken}`, 'Content-Type': 'application/json' };

    // ── CRITERION 1 & 2: PROJECT CREATION & NO PREDEFINED MATERIALS ──────────
    console.log('\n--- 1. Project & Store Structure Verification ---');
    const createProjRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/general-inventory/projects',
      method: 'POST',
      headers: authAdmin
    }, {
      name: 'Skyline Heights Phase 1',
      code: 'SKY-P1',
      description: 'Residential Highrise Towers A & B',
      address: 'Expressway Sector 10'
    });
    assert(createProjRes.status === 201, 'TC-01: Created new General Inventory project');
    const projId = createProjRes.body?.data?.id || createProjRes.body?.data?._id;

    // Check stores for new project (auto-creates default Main Store)
    const storesRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stores`,
      method: 'GET',
      headers: authStoreKeeper
    });
    assert(storesRes.status === 200 && storesRes.body?.data?.length === 1, 'TC-02: Default "Main Store" initialized for new project');
    const mainStoreId = storesRes.body?.data?.[0]?.id;

    // Create a second store for inter-store transfer testing
    const createStore2Res = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stores`,
      method: 'POST',
      headers: authAdmin
    }, {
      name: 'Tower B Site Store',
      code: 'STR-B',
      location: 'Tower B Basement Level 1'
    });
    assert(createStore2Res.status === 201, 'TC-03: Created second project store "Tower B Site Store"');
    const siteStoreId = createStore2Res.body?.data?.id;

    // Verify NO predefined material catalog is seeded automatically
    const emptyMatRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/materials`,
      method: 'GET',
      headers: authStoreKeeper
    });
    assert(emptyMatRes.status === 200 && emptyMatRes.body?.data?.length === 0, 'TC-04: Strict Verification: Zero predefined materials seeded automatically');

    // ── CRITERION 3: USER-DEFINED MATERIAL REGISTER & DUPLICATE WARNING ───────
    console.log('\n--- 2. Material Register & Duplicate Warning Verification ---');
    const createMatRes1 = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/materials`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      name: 'PVC Conduit Pipe 25mm',
      category: 'Electrical',
      subcategory: 'Conduits & Fittings',
      uom: 'Mtr',
      lowStockThreshold: 30,
      materialCode: 'ELE-CND-25',
      brandOrModel: 'Polycab',
      sizeOrSpec: '25mm Heavy Duty',
      preferredVendor: 'Apex Electricals'
    });
    assert(createMatRes1.status === 201, 'TC-05: User created custom material "PVC Conduit Pipe 25mm"');
    const matPipeId = createMatRes1.body?.data?.id;

    // Duplicate check test
    const dupMatRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/materials`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      name: 'PVC Conduit Pipe 25mm',
      category: 'Electrical',
      uom: 'Mtr',
      lowStockThreshold: 30,
      sizeOrSpec: '25mm Heavy Duty'
    });
    assert(dupMatRes.body?.isDuplicateWarning === true, 'TC-06: Duplicate material warning triggered without blocking');

    // Create a tool material for returnable testing
    const createMatRes2 = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/materials`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      name: 'Rotary Hammer Drill Machine',
      category: 'Tools & Hardware',
      uom: 'Nos',
      lowStockThreshold: 2,
      materialCode: 'TLS-DRL-01',
      brandOrModel: 'Bosch GBH 2-26',
      sizeOrSpec: '800W 26mm'
    });
    assert(createMatRes2.status === 201, 'TC-07: Created returnable tool material "Rotary Hammer Drill Machine"');
    const matDrillId = createMatRes2.body?.data?.id;

    // ── CRITERION 4: EXPLICIT OPENING BALANCE (NEVER AUTOMATIC) ───────────────
    console.log('\n--- 3. Opening Stock & Stock Balances ---');
    const openRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock/opening-balance`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      storeId: mainStoreId,
      materialId: matPipeId,
      quantity: 50,
      remarks: 'Initial project takeover physical balance'
    });
    assert(openRes.status === 200 && openRes.body?.data?.balance === 50, 'TC-08: Explicit opening stock of 50 Mtr set for Main Store');

    // Check stock for drill has not been set automatically
    const drillStockRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const drillStock = drillStockRes.body?.data?.find(m => m.id === matDrillId)?.currentStock;
    assert(drillStock === 0, `TC-09: Uninitialized material stock is strictly 0 (got ${drillStock})`);

    // ── CRITERION 5 & 6: INWARD RECEIPTS & ACCEPTED VS DAMAGED QUARANTINE ─────
    console.log('\n--- 4. Inward Goods Receipt (GRN) Verification ---');
    const inwardRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/inward`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      storeId: mainStoreId,
      receiptDate: new Date().toISOString().split('T')[0],
      vendorName: 'Apex Electrical Supplies Ltd',
      vendorChallanNumber: 'CH-2026-9901',
      invoiceNumber: 'INV-APX-440',
      items: [
        {
          materialId: matPipeId,
          receivedQuantity: 100,
          acceptedQuantity: 80,
          damagedQuantity: 15,
          rejectedQuantity: 5,
          unitPrice: 45
        },
        {
          materialId: matDrillId,
          receivedQuantity: 10,
          acceptedQuantity: 10,
          damagedQuantity: 0,
          rejectedQuantity: 0,
          unitPrice: 6500
        }
      ],
      remarks: 'Delivery inspected at gate; 15 damaged pipes quarantined, 5 cracked rejected'
    });
    assert(inwardRes.status === 201, 'TC-10: Inward goods receipt successfully recorded');

    // Verify available stock: pipe had 50 + accepted 80 = 130 (Damaged 15 & Rejected 5 MUST NOT be counted!)
    const pipeStockAfterInward = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const pipeBal = pipeStockAfterInward.body?.data?.find(m => m.id === matPipeId)?.currentStock;
    const drillBal = pipeStockAfterInward.body?.data?.find(m => m.id === matDrillId)?.currentStock;
    assert(pipeBal === 130, `TC-11: Stock Integrity: Only accepted inward quantity added to stock (Expected 130, got ${pipeBal})`);
    assert(drillBal === 10, `TC-12: Drill machines stock updated to 10 Nos (got ${drillBal})`);

    // ── CRITERION 7 & 8: OUTWARD ISSUES & BACKEND OVERDRAW BLOCKING ───────────
    console.log('\n--- 5. Outward Issue & Overdraw Protection Verification ---');
    // Issue 30 Mtr of Pipe
    const outwardRes1 = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/outward`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      storeId: mainStoreId,
      issueDateTime: new Date().toISOString(),
      materialId: matPipeId,
      quantity: 30,
      personReceiving: 'Ramesh Kumar',
      agency: 'Shiva Electricals',
      location: 'Tower A - 3rd Floor Slab',
      purpose: 'Conduit laying for slab casting',
      returnClassification: 'non-returnable'
    });
    assert(outwardRes1.status === 201, 'TC-13: Outward issue of 30 Mtr posted successfully');

    // Verify stock is now 100
    const pipeStockAfterIssue = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const pipeBalAfterIssue = pipeStockAfterIssue.body?.data?.find(m => m.id === matPipeId)?.currentStock;
    assert(pipeBalAfterIssue === 100, `TC-14: Stock balance reduced to 100 Mtr (got ${pipeBalAfterIssue})`);

    // Attempt to issue 150 Mtr (Exceeds available 100 Mtr) -> MUST BE BLOCKED BY BACKEND
    const overdrawRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/outward`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      storeId: mainStoreId,
      issueDateTime: new Date().toISOString(),
      materialId: matPipeId,
      quantity: 150,
      personReceiving: 'Vikas Sharma',
      agency: 'Shiva Electricals',
      location: 'Tower A - 4th Floor',
      purpose: 'Attempting excessive draw',
      returnClassification: 'non-returnable'
    });
    assert(overdrawRes.status === 400, 'TC-15: Outward issue exceeding available stock strictly rejected with 400 error');
    assert(overdrawRes.body?.message?.includes('Insufficient available stock'), 'TC-16: Descriptive error message returned for insufficient stock');

    // ── CRITERION 9: CONCURRENCY RACE-CONDITION SAFETY ───────────────────────
    console.log('\n--- 6. Concurrency Safety: Atomic Race-Condition Protection ---');
    // Current stock is 100 Mtr. Fire two simultaneous requests for 60 Mtr each (Total 120 Mtr).
    // Exactly one must succeed and one must be rejected. Stock must NEVER become negative (-20)!
    const [concurrent1, concurrent2] = await Promise.all([
      request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/general-inventory/projects/${projId}/outward`,
        method: 'POST',
        headers: authStoreKeeper
      }, {
        storeId: mainStoreId,
        materialId: matPipeId,
        quantity: 60,
        personReceiving: 'Worker Alpha',
        agency: 'Agency 1',
        location: 'Zone 1',
        purpose: 'Concurrent test 1',
        returnClassification: 'non-returnable'
      }),
      request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/general-inventory/projects/${projId}/outward`,
        method: 'POST',
        headers: authStoreKeeper
      }, {
        storeId: mainStoreId,
        materialId: matPipeId,
        quantity: 60,
        personReceiving: 'Worker Beta',
        agency: 'Agency 2',
        location: 'Zone 2',
        purpose: 'Concurrent test 2',
        returnClassification: 'non-returnable'
      })
    ]);

    const oneSucceeded = (concurrent1.status === 201 && concurrent2.status === 400) || (concurrent2.status === 201 && concurrent1.status === 400);
    assert(oneSucceeded, `TC-17: Atomic concurrency control: Exactly one concurrent request succeeded (Status: ${concurrent1.status}, ${concurrent2.status})`);

    const stockAfterRace = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const balAfterRace = stockAfterRace.body?.data?.find(m => m.id === matPipeId)?.currentStock;
    assert(balAfterRace === 40, `TC-18: Stock balance after race is exactly 40 Mtr (100 - 60 = 40), non-negative (got ${balAfterRace})`);

    // ── CRITERION 10 & 11: RETURNABLE ASSETS, PARTIAL RETURNS & OVER-RETURN BLOCKING
    console.log('\n--- 7. Returnable Tools & Material Returns Verification ---');
    // Issue 5 Drills as returnable
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const issueDrillRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/outward`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      storeId: mainStoreId,
      materialId: matDrillId,
      quantity: 5,
      personReceiving: 'Sunil Operator',
      agency: 'Pinnacle MEP Contractors',
      location: 'Tower A Core Wall',
      purpose: 'Core cutting and drilling',
      returnClassification: 'returnable',
      expectedReturnDate: tomorrow.toISOString().split('T')[0]
    });
    assert(issueDrillRes.status === 201, 'TC-19: Issued 5 returnable drill machines with expected return date');
    const drillOutwardId = issueDrillRes.body?.data?.id;

    // Partial Return: 2 Drills accepted usable, 1 damaged returned
    const returnRes1 = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/returns`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      storeId: mainStoreId,
      outwardId: drillOutwardId,
      returnType: 'BORROWED',
      returnedByPerson: 'Sunil Operator',
      acceptedQuantity: 2,
      damagedQuantity: 1,
      missingQuantity: 0,
      remarks: '2 in working order, 1 damaged chuck'
    });
    assert(returnRes1.status === 201, 'TC-20: Recorded partial return (2 usable, 1 damaged)');

    // Verify drill stock: started with 10 - 5 issued = 5 + 2 accepted returned = 7!
    const drillStockAfterReturn = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const drillBalAfterReturn = drillStockAfterReturn.body?.data?.find(m => m.id === matDrillId)?.currentStock;
    assert(drillBalAfterReturn === 7, `TC-21: Only accepted returned quantity (2) increased stock balance to 7 (got ${drillBalAfterReturn})`);

    // Verify outward outstanding quantity is now 2 (5 issued - 3 returned)
    const outwardCheck = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/outward/${drillOutwardId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const outstanding = outwardCheck.body?.data?.outstandingQuantity;
    assert(outstanding === 2, `TC-22: Outward record tracks remaining outstanding borrowed quantity = 2 (got ${outstanding})`);

    // Attempt to over-return: Try returning 5 more when outstanding is only 2 -> MUST BE BLOCKED
    const overReturnRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/returns`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      storeId: mainStoreId,
      outwardId: drillOutwardId,
      returnType: 'BORROWED',
      returnedByPerson: 'Sunil Operator',
      acceptedQuantity: 5
    });
    assert(overReturnRes.status === 400, 'TC-23: Over-returning beyond outstanding quantity blocked with 400 error');

    // ── CRITERION 12: INTER-STORE TRANSFERS (ATOMIC DUAL BALANCE UPDATE) ──────
    console.log('\n--- 8. Inter-Store Transfers Verification ---');
    // Pipe stock in Main Store is currently 40 Mtr. Tower B Site Store has 0 Mtr.
    // Transfer 15 Mtr from Main Store to Tower B Site Store
    const transferRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/transfers`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      sourceStoreId: mainStoreId,
      destinationStoreId: siteStoreId,
      materialId: matPipeId,
      quantity: 15,
      reference: 'GATE-PASS-882',
      remarks: 'Site replenishment for Tower B work'
    });
    assert(transferRes.status === 201, 'TC-24: Inter-store transfer of 15 Mtr processed successfully');

    // Check balances in both stores
    const [sourceStock, destStock] = await Promise.all([
      request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
        method: 'GET',
        headers: authStoreKeeper
      }),
      request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/general-inventory/projects/${projId}/stock?storeId=${siteStoreId}`,
        method: 'GET',
        headers: authStoreKeeper
      })
    ]);

    const sourceBal = sourceStock.body?.data?.find(m => m.id === matPipeId)?.currentStock;
    const destBal = destStock.body?.data?.find(m => m.id === matPipeId)?.currentStock;
    assert(sourceBal === 25, `TC-25: Source store balance deducted to 25 Mtr (40 - 15 = 25, got ${sourceBal})`);
    assert(destBal === 15, `TC-26: Destination store balance credited to 15 Mtr (0 + 15 = 15, got ${destBal})`);

    // Attempt transfer exceeding available stock in source store (Try 100 Mtr when source has 25 Mtr)
    const overTransferRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/transfers`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      sourceStoreId: mainStoreId,
      destinationStoreId: siteStoreId,
      materialId: matPipeId,
      quantity: 100
    });
    assert(overTransferRes.status === 400, 'TC-27: Transfer exceeding available source stock blocked with 400 error');

    // ── CRITERION 13: PHYSICAL STOCK VERIFICATION (AUDIT DOES NOT ALTER STOCK)
    console.log('\n--- 9. Physical Stock Verification & Traceable Adjustment ---');
    // Main Store Pipe book stock is 25 Mtr. Suppose physical count finds 20 Mtr (difference of -5).
    const verifRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/verifications`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      storeId: mainStoreId,
      materialId: matPipeId,
      physicalQuantity: 20,
      remarks: 'Quarterly physical stock audit count'
    });
    assert(verifRes.status === 201 && verifRes.body?.data?.difference === -5, 'TC-28: Physical stock audit recorded discrepancy (-5 difference)');
    const verifId = verifRes.body?.data?.id;

    // Verify stock balance has NOT changed yet (audit must not silently overwrite ledger)
    const stockAfterAudit = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const balAfterAudit = stockAfterAudit.body?.data?.find(m => m.id === matPipeId)?.currentStock;
    assert(balAfterAudit === 25, `TC-29: Verification audit did NOT silently overwrite stock balance (still 25 Mtr, got ${balAfterAudit})`);

    // ── CRITERION 15: AUTHORIZED TRACEABLE ADJUSTMENT ─────────────────────────
    const adjustRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/adjustments`,
      method: 'POST',
      headers: authAdmin
    }, {
      storeId: mainStoreId,
      materialId: matPipeId,
      adjustmentType: 'DEDUCT',
      quantity: 5,
      reason: 'Confirmed cutting waste and transit shrinkage from physical audit',
      verificationId: verifId
    });
    assert(adjustRes.status === 201, 'TC-30: Authorized user posted traceable stock adjustment');

    // Stock balance is now 20
    const stockAfterAdj = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const balAfterAdj = stockAfterAdj.body?.data?.find(m => m.id === matPipeId)?.currentStock;
    assert(balAfterAdj === 20, `TC-31: Stock balance correctly adjusted to 20 Mtr (got ${balAfterAdj})`);

    // ── CRITERION 14: INCIDENT REPORTING DOES NOT DEDUCT STOCK ───────────────
    console.log('\n--- 10. Incident Reporting (Theft, Damage, Loss) ---');
    const incidentRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/incidents`,
      method: 'POST',
      headers: authStoreKeeper
    }, {
      storeId: mainStoreId,
      incidentType: 'Suspected Theft',
      materialId: matPipeId,
      quantity: 5,
      date: new Date().toISOString().split('T')[0],
      description: 'Break-in discovered at store gate; 5 pipes missing from rack 2',
      reportedBy: 'Night Watchman'
    });
    assert(incidentRes.status === 201, 'TC-32: Incident report logged with incident reference number');

    // Verify stock was NOT automatically deducted by reporting incident
    const stockAfterIncident = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const balAfterIncident = stockAfterIncident.body?.data?.find(m => m.id === matPipeId)?.currentStock;
    assert(balAfterIncident === 20, `TC-33: Strict Safety: Incident report did NOT automatically deduct stock (still 20 Mtr, got ${balAfterIncident})`);

    // ── CRITERION 16: LOW-STOCK & OUT-OF-STOCK CLASSIFICATION ────────────────
    console.log('\n--- 11. Low-Stock & Out-of-Stock Classification ---');
    // matPipeId has current stock 20 Mtr in Main Store, threshold is 30 Mtr.
    // 20 <= 30 and > 0 => MUST BE LOW_STOCK!
    const lowStockCheck = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/stock?storeId=${mainStoreId}`,
      method: 'GET',
      headers: authStoreKeeper
    });
    const pipeStatus = lowStockCheck.body?.data?.find(m => m.id === matPipeId)?.status;
    assert(pipeStatus === 'LOW_STOCK', `TC-34: Material correctly classified as LOW_STOCK (threshold 30, stock 20, got ${pipeStatus})`);

    // ── CRITERION 17: REPORTS & MATERIAL LEDGER GENERATION ───────────────────
    console.log('\n--- 12. Reports & Ledger Verification ---');
    const [reportStock, reportInward, reportOutward, reportLedger, reportOverdue] = await Promise.all([
      request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/general-inventory/projects/${projId}/reports/store-wise-stock`,
        method: 'GET',
        headers: authStoreKeeper
      }),
      request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/general-inventory/projects/${projId}/reports/inward-register`,
        method: 'GET',
        headers: authStoreKeeper
      }),
      request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/general-inventory/projects/${projId}/reports/outward-register`,
        method: 'GET',
        headers: authStoreKeeper
      }),
      request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/general-inventory/projects/${projId}/reports/material-ledger`,
        method: 'GET',
        headers: authStoreKeeper
      }),
      request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/general-inventory/projects/${projId}/reports/overdue-borrowed`,
        method: 'GET',
        headers: authStoreKeeper
      })
    ]);

    assert(reportStock.status === 200 && reportStock.body?.data?.rows?.length > 0, 'TC-35: Report 1: Store-wise stock report generated');
    assert(reportInward.status === 200 && reportInward.body?.data?.rows?.length > 0, 'TC-36: Report 2: Inward register report generated');
    assert(reportOutward.status === 200 && reportOutward.body?.data?.rows?.length > 0, 'TC-37: Report 3: Outward issue register report generated');
    assert(reportLedger.status === 200 && reportLedger.body?.data?.rows?.length >= 5, 'TC-38: Report 4: Material ledger contains complete traceable audit history');
    assert(reportOverdue.status === 200, 'TC-39: Report 6: Outstanding borrowed items report generated');

    // ── CRITERION 18: MULTI-TENANT ISOLATION & PROJECT ACCESS RESTRICTION ────
    console.log('\n--- 13. Tenant & Project Security Isolation ---');
    const tenantBAccess = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/general-inventory/projects/${projId}/materials`,
      method: 'GET',
      headers: authTenantB
    });
    assert(tenantBAccess.body?.data?.length === 0, 'TC-40: Tenant B cannot access Tenant A project materials (Tenant isolation verified)');

    // ── CRITERION 20: REGRESSION TESTING ON EXISTING MODULES ─────────────────
    console.log('\n--- 14. Existing Modules Regression Checks ---');
    // Check Health
    const healthRes = await request({ hostname: 'localhost', port: PORT, path: '/api/health', method: 'GET' });
    assert(healthRes.status === 200, 'TC-41: Regression Check: Core Health Endpoint intact');

    // Check Steel Inventory
    const steelRes = await request({ hostname: 'localhost', port: PORT, path: '/api/inventory', method: 'GET', headers: authAdmin });
    assert(steelRes.status === 200, 'TC-42: Regression Check: Steel Inventory endpoint intact');

    // Check BBS Module
    const bbsRes = await request({ hostname: 'localhost', port: PORT, path: '/api/bbs/projects', method: 'GET', headers: authAdmin });
    assert(bbsRes.status === 200, 'TC-43: Regression Check: BBS Projects endpoint intact');

    // Check Casting Module
    const castingRes = await request({ hostname: 'localhost', port: PORT, path: '/api/casting/projects', method: 'GET', headers: authAdmin });
    assert(castingRes.status === 200, 'TC-44: Regression Check: Casting Management endpoint intact');

    console.log('\n================================================================');
    console.log(`🏁 GENERAL INVENTORY ACCEPTANCE SUITE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runGeneralInventoryAcceptanceSuite();
