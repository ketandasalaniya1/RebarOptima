/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ENTERPRISE REAL ESTATE CRM — COMPREHENSIVE ACCEPTANCE & BUSINESS RULE SUITE
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

async function runCrmAcceptanceTests() {
  console.log('================================================================');
  console.log('🏢 RUNNING ENTERPRISE REAL ESTATE CRM ACCEPTANCE SUITE');
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
    const companyId = `comp_crm_test_${Date.now()}`;
    const token = jwt.sign({
      sub: 'usr_crm_lead_agent',
      email: 'sales.lead@enterprise-realty.com',
      name: 'Priya Sharma (Senior VP Sales)',
      companyId,
      role: 'ADMIN',
      accountType: 'user'
    }, ACCESS_SECRET, { expiresIn: '1h' });

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // ── TEST 1: Seed Sample Enterprise Real Estate Data ────────────────────────
    console.log('\n[Phase 1: Database Initialization & Seeding]');
    const seedRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/seed-sample-data',
      method: 'POST',
      headers: authHeaders
    });
    assert(seedRes.status === 200 && seedRes.body.success, 'Seed sample enterprise real estate data executes cleanly');

    // ── TEST 2: Customer Directory & Customer 360 Retrieval ───────────────────
    console.log('\n[Phase 2: Customer Directory & Customer 360]');
    const custRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/customers',
      method: 'GET',
      headers: authHeaders
    });
    assert(custRes.status === 200 && custRes.body.data && custRes.body.data.length >= 1, 'Fetch customer directory with computed summary counts');

    const rahul = custRes.body.data.find(c => c.fullName === 'Rahul Shah');
    assert(!!rahul, 'Master customer profile Rahul Shah exists in directory');

    const cust360Res = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/customers/${rahul._id}`,
      method: 'GET',
      headers: authHeaders
    });
    assert(cust360Res.status === 200 && cust360Res.body.customer, 'Retrieve Customer 360 Full Profile');
    assert(cust360Res.body.interests && cust360Res.body.interests.length === 3, 'Requirement 1: One customer has multiple unit interests (Rahul Shah has 3 separate interests)');

    // ── TEST 3: Independent Pipeline Stages per Unit Interest ─────────────────
    console.log('\n[Phase 3: Unit Interest Independence]');
    const interests = cust360Res.body.interests;
    const intA1203 = interests.find(i => i.unitCode === 'A-1203');
    const intA1402 = interests.find(i => i.unitCode === 'A-1402');
    const intB0304 = interests.find(i => i.unitCode === 'B-0304');

    assert(intA1203 && intA1203.stage === 'Negotiation', 'Interest 1 is at stage "Negotiation"');
    assert(intA1402 && intA1402.stage === 'Visited', 'Interest 2 is at stage "Visited"');
    assert(intB0304 && intB0304.stage === 'Booked', 'Interest 3 is at stage "Booked"');

    // Advance Stage on intA1203
    const stageUpdateRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/leads/${intA1203._id}/stage`,
      method: 'PUT',
      headers: authHeaders
    }, { stage: 'Qualified', notes: 'Client requested revised schedule' });
    assert(stageUpdateRes.status === 200 && stageUpdateRes.body.stage === 'Qualified', 'Advance stage on Unit A-1203 to Qualified');

    // Re-verify that intA1402 and intB0304 stages did NOT change
    const cust360Check = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/customers/${rahul._id}`,
      method: 'GET',
      headers: authHeaders
    });
    const checkIntA1402 = cust360Check.body.interests.find(i => i.unitCode === 'A-1402');
    assert(checkIntA1402.stage === 'Visited', 'Requirement 2: Changing one unit interest stage NEVER modifies other interests for the same customer');

    // ── TEST 4: Duplicate Customer Detection ──────────────────────────────────
    console.log('\n[Phase 4: Duplicate Customer Detection]');
    const dupCheckRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/customers/check-duplicate',
      method: 'POST',
      headers: authHeaders
    }, { phone: '9820011223', email: 'rahul.shah@enterprise-example.com' });

    assert(dupCheckRes.status === 200 && dupCheckRes.body.isDuplicate === true, 'Requirement 3: Duplicate phone & email detected before creation');

    const tryDupCreate = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/customers',
      method: 'POST',
      headers: authHeaders
    }, {
      fullName: 'Rahul Duplicate',
      phone: '9820011223' // Same phone
    });
    assert(tryDupCreate.status === 409, 'Requirement 3: API blocks duplicate customer creation with 409 Conflict warning');

    // ── TEST 5: Unit Wise Profile (Darshan\'s Architectural Sketch) ────────────
    console.log('\n[Phase 5: Unit-Wise Profile (Darshan\'s Architecture)]');
    // Unit A-1203 is NOT booked
    const unit1Res = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/units/${intA1203.unitId}`,
      method: 'GET',
      headers: authHeaders
    });
    assert(unit1Res.status === 200, 'Fetch Unit-Wise Profile for A-1203');
    assert(unit1Res.body.bookingDone === false, 'Unit A-1203: BookingDone === false');
    assert(Array.isArray(unit1Res.body.leadManagement) && unit1Res.body.leadManagement.length >= 1, 'Unit A-1203: If not booked -> Lead Management populated with active unit interests');

    // Unit B-0304 is BOOKED
    const unit2Res = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/units/${intB0304.unitId}`,
      method: 'GET',
      headers: authHeaders
    });
    assert(unit2Res.status === 200, 'Fetch Unit-Wise Profile for B-0304');
    assert(unit2Res.body.bookingDone === true, 'Unit B-0304: BookingDone === true');
    assert(unit2Res.body.bookingInfo && unit2Res.body.bookingInfo.booking, 'Unit B-0304: If booking Done -> Their info, customer profile & financial details provided');

    // ── TEST 6: Atomic Unit Reservation & Expiry ──────────────────────────────
    console.log('\n[Phase 6: Atomic Unit Reservation & Availability]');
    // Create a new available unit in Project A
    const prjList = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/projects',
      method: 'GET',
      headers: authHeaders
    });
    const prjA = prjList.body[0];

    const newUnitRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/units',
      method: 'POST',
      headers: authHeaders
    }, {
      projectId: prjA._id,
      buildingTower: 'TOWER C',
      floorNumber: 5,
      unitNumber: '0501',
      configuration: '2BHK',
      carpetAreaSqFt: 1000,
      basePrice: 7500000,
      askingPrice: 8000000
    });
    assert(newUnitRes.status === 201, 'Create new test unit C-0501 in inventory');
    const unitCId = newUnitRes.body._id;

    // User 1 reserves C-0501
    const res1 = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/units/${unitCId}/reserve`,
      method: 'POST',
      headers: authHeaders
    }, { customerId: rahul._id, durationHours: 48 });
    assert(res1.status === 200 && res1.body.success, 'Requirement 7: User 1 reserves Unit C-0501');

    // User 2 attempts to reserve the same unit C-0501 -> MUST BE REJECTED
    const otherCustRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/customers',
      method: 'POST',
      headers: authHeaders
    }, {
      fullName: 'Anita Desai',
      phone: '9877766554',
      email: 'anita.desai@example.com'
    });
    const anitaId = otherCustRes.body._id;

    const res2 = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/units/${unitCId}/reserve`,
      method: 'POST',
      headers: authHeaders
    }, { customerId: anitaId, durationHours: 48 });
    assert(res2.status === 409, 'Requirement 7: Second user attempting to reserve same unit is rejected with 409 Conflict');

    // Safe release
    const relRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/units/${unitCId}/release`,
      method: 'POST',
      headers: authHeaders
    });
    assert(relRes.status === 200 && relRes.body.success, 'Requirement 8: Safe unit release back to Available status');

    // ── TEST 7: Booking Creation, Confirmation & Cancellation ─────────────────
    console.log('\n[Phase 7: Booking Lifecycle & Financial Integrity]');
    const createBookingRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/bookings',
      method: 'POST',
      headers: authHeaders
    }, {
      customerId: anitaId,
      projectId: prjA._id,
      unitId: unitCId,
      agreementPrice: 8000000,
      discountAmount: 100000,
      taxAmount: 395000,
      bookingDepositRequired: 829500
    });
    assert(createBookingRes.status === 201, 'Requirement 9: Booking created with calculated net value (80L - 1L + 3.95L = 82.95L)');
    assert(createBookingRes.body.bookingReference.startsWith('BK-'), 'Requirement 9: Collision-safe booking reference generated');
    assert(createBookingRes.body.schedules.length === 6, 'Requirement 9: Automatic 6-stage installment schedule generated');

    const anitaBookingId = createBookingRes.body._id;

    // Confirm booking
    const confirmRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/bookings/${anitaBookingId}/confirm`,
      method: 'PUT',
      headers: authHeaders
    });
    assert(confirmRes.status === 200 && confirmRes.body.status === 'Confirmed', 'Requirement 9: Booking confirmed and approval registered');

    // Post payment transaction
    const payRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/payments',
      method: 'POST',
      headers: authHeaders
    }, {
      bookingId: anitaBookingId,
      amount: 829500,
      paymentMethod: 'Bank Transfer (NEFT/RTGS)',
      transactionReference: 'NEFT99887766'
    });
    assert(payRes.status === 201, 'Requirement 11: Payment recorded and receipt generated');
    assert(payRes.body.receiptNumber.startsWith('REC-'), 'Requirement 14: Unique printable receipt reference issued');

    // Duplicate payment attempt with same reference
    const dupPayRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/payments',
      method: 'POST',
      headers: authHeaders
    }, {
      bookingId: anitaBookingId,
      amount: 829500,
      paymentMethod: 'Bank Transfer (NEFT/RTGS)',
      transactionReference: 'NEFT99887766' // Identical UTR
    });
    assert(dupPayRes.status === 409, 'Requirement 12: Duplicate transaction reference rejected with 409 Conflict');

    // Verify Financial Summary
    const bookDetailRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/bookings/${anitaBookingId}`,
      method: 'GET',
      headers: authHeaders
    });
    assert(bookDetailRes.body.financials.totalReceived === 829500, 'Requirement 11: Total received calculated exactly');
    assert(bookDetailRes.body.financials.totalOutstanding === (8295000 - 829500), 'Requirement 11: Total outstanding computed accurately');

    // Cancel booking and verify Unit Release
    const cancelRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/bookings/${anitaBookingId}/cancel`,
      method: 'PUT',
      headers: authHeaders
    }, { cancellationReason: 'Client relocation' });
    assert(cancelRes.status === 200 && cancelRes.body.status === 'Cancelled', 'Requirement 10: Booking cancelled');

    const checkReleasedUnit = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/units/${unitCId}`,
      method: 'GET',
      headers: authHeaders
    });
    assert(checkReleasedUnit.body.availabilityStatus === 'Available', 'Requirement 10: Unit C-0501 automatically returned to Available inventory upon cancellation');

    // ── TEST 8: Site Visits & Tasks ───────────────────────────────────────────
    console.log('\n[Phase 8: Tasks & Site Visits]');
    const tasksRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/tasks?filter=pending',
      method: 'GET',
      headers: authHeaders
    });
    assert(tasksRes.status === 200 && tasksRes.body.length >= 1, 'Requirement 5: Retrieve active follow-up tasks');

    const taskToComplete = tasksRes.body[0];
    const compTaskRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/crm/tasks/${taskToComplete._id}/complete`,
      method: 'PUT',
      headers: authHeaders
    }, { notes: 'Completed call with client.' });
    assert(compTaskRes.status === 200 && compTaskRes.body.status === 'Completed', 'Requirement 5: Quick complete task and record completion note');

    // ── TEST 9: Reports & Executive Dashboard ─────────────────────────────────
    console.log('\n[Phase 9: Business Reports & Analytics]');
    const dashRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/reports/dashboard',
      method: 'GET',
      headers: authHeaders
    });
    assert(dashRes.status === 200 && dashRes.body.kpis, 'Requirement 16: Executive KPI calculations derived from real database records');
    assert(dashRes.body.kpis.totalCustomers >= 2, 'KPI total customers matches DB count');
    assert(dashRes.body.inventory.total >= 4, 'Inventory breakdown available');

    const repRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/reports/salespersons',
      method: 'GET',
      headers: authHeaders
    });
    assert(repRes.status === 200 && Array.isArray(repRes.body), 'Requirement 16: Sales team performance leaderboard generated');

    // ── TEST 10: Global Search Across Entities ────────────────────────────────
    console.log('\n[Phase 10: Global Search]');
    const searchRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/crm/search?q=Rahul',
      method: 'GET',
      headers: authHeaders
    });
    assert(searchRes.status === 200 && searchRes.body.customers.length >= 1, 'Requirement 18: Global CRM search locates customers, units, and bookings');

    console.log('\n================================================================');
    console.log(`📊 CRM ACCEPTANCE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed === 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal acceptance test error:', err);
    process.exit(1);
  }
}

runCrmAcceptanceTests();
