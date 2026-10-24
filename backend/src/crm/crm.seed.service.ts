import { Db, ObjectId } from 'mongodb';
import { roundCurrency, generateInstallmentSchedule } from './crm.calculation.service';

export async function seedCrmSampleData(db: Db, companyId: any, userId: string = 'system') {
  // If data already exists, clear existing CRM test data for this company to allow clean re-seed
  await Promise.all([
    db.collection('crm_projects').deleteMany({ companyId }),
    db.collection('crm_units').deleteMany({ companyId }),
    db.collection('crm_customers').deleteMany({ companyId }),
    db.collection('crm_unit_interests').deleteMany({ companyId }),
    db.collection('crm_bookings').deleteMany({ companyId }),
    db.collection('crm_payment_schedules').deleteMany({ companyId }),
    db.collection('crm_payment_transactions').deleteMany({ companyId }),
    db.collection('crm_site_visits').deleteMany({ companyId }),
    db.collection('crm_follow_ups').deleteMany({ companyId }),
    db.collection('crm_activities').deleteMany({ companyId }),
    db.collection('crm_settings').deleteMany({ companyId }),
  ]);

  // 1. Projects
  const prjA: any = {
    companyId,
    projectCode: 'PRJ-SKY-01',
    name: 'Skyline Heights Towers',
    developerName: 'Prestige Metro Developers',
    address: 'Plot 42, Sector 18, Golf Course Extension Road',
    location: 'Sector 18',
    city: 'Mumbai',
    description: 'Ultra-luxury high-rise residential towers with panoramic skyline views, infinity pool, and club amenities.',
    propertyCategory: 'Residential',
    configurations: ['1BHK', '2BHK', '3BHK', '4BHK Penthouse'],
    salesStartDate: '2025-06-01',
    projectStatus: 'Under Construction',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const prjB: any = {
    companyId,
    projectCode: 'PRJ-EME-02',
    name: 'Emerald Oasis Green Living',
    developerName: 'EcoHabitat Developers',
    address: 'Ring Road 5, Green Park Corridor',
    location: 'Green Park',
    city: 'Bengaluru',
    description: 'Eco-conscious green community featuring sustainable architecture, rainwater harvesting, and terrace gardens.',
    propertyCategory: 'Residential',
    configurations: ['1BHK', '2BHK', '3BHK', 'Villa'],
    salesStartDate: '2025-01-15',
    projectStatus: 'Under Construction',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const resA = await db.collection('crm_projects').insertOne(prjA);
  const resB = await db.collection('crm_projects').insertOne(prjB);
  const prjAId = resA.insertedId;
  const prjBId = resB.insertedId;

  // 2. Generate Full Architectural Chessboard Units (Floors 1 to 14, Towers A & B)
  const unitDocs: any[] = [];
  const towers = [
    { tower: 'TOWER A', section: 'Section 1', prefix: 'A', projectId: prjAId, prjName: prjA.name },
    { tower: 'TOWER B', section: 'Section 2', prefix: 'B', projectId: prjAId, prjName: prjA.name }
  ];

  // Specific statuses pattern for visual realism matching Profitbase screenshots
  const statusPattern = ['Available', 'Available', 'Held', 'Available', 'Booked', 'Available', 'Reserved', 'Sold'];

  for (const t of towers) {
    for (let floor = 14; floor >= 1; floor--) {
      // 4 units per floor: 01, 02, 03, 04
      for (let pos = 1; pos <= 4; pos++) {
        const unitNo = `${floor < 10 ? '0' : ''}${floor}0${pos}`;
        const unitCode = `${t.prefix}-${unitNo}`;

        let config = '2BHK';
        let carpet = 1050;
        let saleable = 1350;
        let basePrice = 8500000;
        let askingPrice = 9200000;
        let facing = pos % 2 === 0 ? 'East Garden View' : 'West Skyline View';

        if (pos === 1) {
          config = '1BHK';
          carpet = 680;
          saleable = 880;
          basePrice = 5500000;
          askingPrice = 6100000;
        } else if (pos === 2) {
          config = '2BHK';
          carpet = 1080;
          saleable = 1400;
          basePrice = 8800000;
          askingPrice = 9500000;
        } else if (pos === 3) {
          config = '3BHK';
          carpet = 1480;
          saleable = 1920;
          basePrice = 12000000;
          askingPrice = 13200000;
        } else if (pos === 4) {
          if (floor >= 12) {
            config = '4BHK Penthouse';
            carpet = 2200;
            saleable = 2850;
            basePrice = 18500000;
            askingPrice = 20500000;
            facing = 'North-East Panoramic Sky Deck';
          } else {
            config = '3BHK';
            carpet = 1520;
            saleable = 1950;
            basePrice = 12500000;
            askingPrice = 13500000;
          }
        }

        // Determine realistic status
        let status = statusPattern[(floor * 4 + pos) % statusPattern.length];

        // Specific overrides for key units from the scenario
        if (unitCode === 'A-1203') {
          status = 'Available'; // In negotiation with Rahul Shah
        } else if (unitCode === 'A-1402') {
          status = 'Held'; // Held for Rahul Shah
        } else if (unitCode === 'B-0304') {
          status = 'Booked'; // Booked by Rahul Shah
        }

        unitDocs.push({
          companyId,
          projectId: t.projectId,
          projectName: t.prjName,
          unitCode,
          buildingTower: t.tower,
          sectionName: t.section,
          floorNumber: floor,
          unitNumber: unitNo,
          configuration: config,
          propertyType: 'Apartment',
          carpetAreaSqFt: carpet,
          saleableAreaSqFt: saleable,
          basePrice,
          askingPrice,
          availabilityStatus: status,
          heldUntil: status === 'Held' ? new Date(Date.now() + 48 * 3600 * 1000) : null,
          facing,
          features: ['Modular Kitchen', 'Walk-in Wardrobe', 'Balcony Deck', 'Covered Parking'],
          notes: `Floor ${floor} luxury apartment with premium vitrified tiles and cross ventilation.`,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }

  const insertUnitsRes = await db.collection('crm_units').insertMany(unitDocs);
  const createdUnits = await db.collection('crm_units').find({ companyId }).toArray();

  const unitA1203 = createdUnits.find(u => u.unitCode === 'A-1203');
  const unitA1402 = createdUnits.find(u => u.unitCode === 'A-1402');
  const unitB0304 = createdUnits.find(u => u.unitCode === 'B-0304');

  // 3. Customer: Rahul Shah (Full Master Profile matching Screenshot 4)
  const rahulCustomer: any = {
    companyId,
    customerCode: 'CUST-2026-1001',
    fullName: 'Rahul Shah',
    phone: '9820011223',
    altPhone: '9820099887',
    email: 'rahul.shah@enterprise-example.com',
    address: '402, Sea Crest Apartments, Worli Sea Face, Mumbai 400018',
    city: 'Mumbai',
    preferredContactMethod: 'WhatsApp',
    leadSource: 'Channel Partner',
    campaign: 'Q1 Premium Living Expo',
    stage: 'Hot Prospect / In Negotiation',
    budgetMin: 8500000,
    budgetMax: 14000000,
    preferredLocation: 'Worli, Bandra & Green Park Corridor',
    preferredPropertyType: '3BHK & Luxury Villa',
    assignedSalespersonId: 'sales_vikram',
    assignedSalespersonName: 'Vikram Mehta (Senior VP Sales)',
    relationships: [
      { name: 'Sunita Shah', relation: 'Spouse / Co-Applicant', phone: '9820055443' },
      { name: 'Karan Shah', relation: 'Son / Beneficiary', phone: '9820077889' }
    ],
    customFields: {
      occupation: 'Managing Director, Horizon FinTech Solutions',
      closingAnniversary: 'November 2026',
      loanEligibility: 'Pre-Approved ₹1.5 Cr (HDFC Bank)',
      tags: ['Investor', 'High-Net-Worth', 'Ready Decision Maker']
    },
    background: 'Rahul is an established tech entrepreneur and high-net-worth investor looking to acquire a 3BHK self-use home at Skyline Heights in Mumbai and a modern green investment apartment at Emerald Oasis in Bengaluru. Very responsive via WhatsApp; prefers weekend morning site inspections.',
    communicationConsent: true,
    lastCommunicationAt: new Date(Date.now() - 1 * 86400 * 1000),
    createdAt: new Date(Date.now() - 30 * 86400 * 1000),
    updatedAt: new Date(),
    createdBy: userId
  };

  const resRahul = await db.collection('crm_customers').insertOne(rahulCustomer);
  const rahulId = resRahul.insertedId;

  // 4. Three separate Unit Interests for Rahul Shah
  const interest1: any = {
    companyId,
    customerId: rahulId,
    customerName: rahulCustomer.fullName,
    customerPhone: rahulCustomer.phone,
    projectId: prjAId,
    projectName: prjA.name,
    unitId: unitA1203?._id,
    unitCode: 'A-1203',
    stage: 'Negotiation',
    assignedSalespersonId: 'sales_vikram',
    assignedSalespersonName: 'Vikram Mehta',
    leadSource: 'Channel Partner',
    budget: 12500000,
    priority: 'High',
    lastContactDate: new Date(Date.now() - 1 * 86400 * 1000),
    nextFollowUpDate: new Date(Date.now() + 1 * 86400 * 1000).toISOString().split('T')[0],
    notes: 'Customer offered ₹1.25 Cr inclusive of premium stilt car parking. Management approval for 2% concession pending.',
    createdAt: new Date(Date.now() - 25 * 86400 * 1000),
    updatedAt: new Date(Date.now() - 1 * 86400 * 1000)
  };

  const interest2: any = {
    companyId,
    customerId: rahulId,
    customerName: rahulCustomer.fullName,
    customerPhone: rahulCustomer.phone,
    projectId: prjAId,
    projectName: prjA.name,
    unitId: unitA1402?._id,
    unitCode: 'A-1402',
    stage: 'Visited',
    assignedSalespersonId: 'sales_vikram',
    assignedSalespersonName: 'Vikram Mehta',
    leadSource: 'Channel Partner',
    budget: 13500000,
    priority: 'Medium',
    lastContactDate: new Date(Date.now() - 3 * 86400 * 1000),
    nextFollowUpDate: new Date(Date.now() + 2 * 86400 * 1000).toISOString().split('T')[0],
    notes: 'Visited 14th floor with family. Praised natural ventilation and master balcony view; unit on 48h temporary hold.',
    createdAt: new Date(Date.now() - 18 * 86400 * 1000),
    updatedAt: new Date(Date.now() - 3 * 86400 * 1000)
  };

  const interest3: any = {
    companyId,
    customerId: rahulId,
    customerName: rahulCustomer.fullName,
    customerPhone: rahulCustomer.phone,
    projectId: prjAId, // or prjBId
    projectName: prjB.name,
    unitId: unitB0304?._id,
    unitCode: 'B-0304',
    stage: 'Booked',
    assignedSalespersonId: 'sales_vikram',
    assignedSalespersonName: 'Vikram Mehta',
    leadSource: 'Channel Partner',
    budget: 9200000,
    priority: 'High',
    lastContactDate: new Date(Date.now() - 7 * 86400 * 1000),
    notes: 'Commercial booking confirmed and agreement signed. Token amount received.',
    createdAt: new Date(Date.now() - 28 * 86400 * 1000),
    updatedAt: new Date(Date.now() - 7 * 86400 * 1000)
  };

  const resInt1 = await db.collection('crm_unit_interests').insertOne(interest1);
  const resInt2 = await db.collection('crm_unit_interests').insertOne(interest2);
  const resInt3 = await db.collection('crm_unit_interests').insertOne(interest3);

  // 5. Booking for Unit B-0304
  const bookingVal = 9200000;
  const discountVal = 200000;
  const taxVal = 450000;
  const netBookingVal = bookingVal - discountVal + taxVal; // 9450000

  const bookingB: any = {
    companyId,
    bookingReference: 'BK-2026-0001',
    customerId: rahulId,
    customerName: rahulCustomer.fullName,
    customerPhone: rahulCustomer.phone,
    customerEmail: rahulCustomer.email,
    projectId: prjBId,
    projectName: prjB.name,
    unitId: unitB0304?._id,
    unitCode: 'B-0304',
    unitInterestId: resInt3.insertedId,
    agreementPrice: bookingVal,
    discountAmount: discountVal,
    taxAmount: taxVal,
    netBookingValue: netBookingVal,
    bookingDepositRequired: 945000,
    bookingDate: new Date(Date.now() - 14 * 86400 * 1000),
    status: 'Confirmed',
    approvalStatus: 'Approved',
    approvedBy: 'mgmt_admin',
    approvedAt: new Date(Date.now() - 13 * 86400 * 1000),
    salespersonId: 'sales_vikram',
    salespersonName: 'Vikram Mehta',
    notes: 'Special early bird price with covered stilt parking included.',
    createdAt: new Date(Date.now() - 14 * 86400 * 1000),
    updatedAt: new Date(),
    createdBy: userId
  };

  const resBook = await db.collection('crm_bookings').insertOne(bookingB);
  const bookingId = resBook.insertedId;

  if (unitB0304) {
    await db.collection('crm_units').updateOne(
      { _id: unitB0304._id },
      { $set: { activeBookingId: String(bookingId), heldByCustomerId: String(rahulId), availabilityStatus: 'Booked' } }
    );
  }

  // 6. Payment Milestones
  const scheduleMilestones = generateInstallmentSchedule(netBookingVal, bookingB.bookingDate);
  const scheduleDocs = scheduleMilestones.map((m, idx) => ({
    companyId,
    bookingId,
    bookingReference: bookingB.bookingReference,
    milestoneName: m.milestoneName,
    milestonePercentage: m.milestonePercentage,
    dueAmount: m.dueAmount,
    dueDate: m.dueDate,
    paidAmount: idx === 0 ? m.dueAmount : 0,
    status: idx === 0 ? 'Paid' : 'Due',
    sortOrder: idx + 1,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  await db.collection('crm_payment_schedules').insertMany(scheduleDocs);

  // 7. Payment Transaction (Token Paid)
  const firstMilestoneAmount = scheduleDocs[0].dueAmount; // 945000
  const paymentTxn: any = {
    companyId,
    paymentReference: 'TXN-2026-0001',
    receiptNumber: 'REC-2026-0001',
    bookingId,
    bookingReference: bookingB.bookingReference,
    customerId: rahulId,
    customerName: rahulCustomer.fullName,
    milestoneScheduleId: null,
    amount: firstMilestoneAmount,
    currency: 'INR',
    paymentMethod: 'Bank Transfer (NEFT/RTGS)',
    transactionReference: 'HDFC9876543210',
    paymentDate: new Date(Date.now() - 14 * 86400 * 1000),
    receivedBy: userId,
    receivedByName: 'Accounts Desk',
    paymentStatus: 'Paid',
    receiptNotes: 'Full payment received for Booking Token Amount against unit B-0304.',
    createdAt: new Date(Date.now() - 14 * 86400 * 1000),
    createdBy: userId
  };

  await db.collection('crm_payment_transactions').insertOne(paymentTxn);

  // 8. Site Visits & Follow-up Tasks
  await db.collection('crm_site_visits').insertOne({
    companyId,
    customerId: rahulId,
    customerName: rahulCustomer.fullName,
    unitInterestId: resInt2.insertedId,
    projectId: prjAId,
    projectName: prjA.name,
    unitId: unitA1402?._id,
    unitCode: 'A-1402',
    visitDateTime: new Date(Date.now() - 4 * 86400 * 1000),
    assignedSalespersonId: 'sales_vikram',
    assignedSalespersonName: 'Vikram Mehta',
    status: 'Completed',
    notes: 'Family attended site visit. Examined 14th floor natural light and floor plan layout.',
    outcome: 'Very interested in Tower A east view, requested unit hold for 48h.',
    nextAction: 'Follow-up on booking token by Friday.',
    createdAt: new Date(Date.now() - 6 * 86400 * 1000),
    updatedAt: new Date()
  });

  await db.collection('crm_follow_ups').insertMany([
    {
      companyId,
      customerId: rahulId,
      customerName: rahulCustomer.fullName,
      unitInterestId: resInt1.insertedId,
      title: 'Discuss pricing concession on Unit A-1203 with Rahul Shah',
      dueDateTime: new Date(Date.now() + 4 * 3600 * 1000),
      priority: 'High',
      taskType: 'Phone Call',
      status: 'Pending',
      assignedTo: 'sales_vikram',
      assignedToName: 'Vikram Mehta',
      notes: 'Present approved 2% concession and finalize token payment.',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      companyId,
      customerId: rahulId,
      customerName: rahulCustomer.fullName,
      unitInterestId: resInt3.insertedId,
      title: 'Collect KYC PAN & Aadhar for Unit B-0304 Stamp Registration',
      dueDateTime: new Date(Date.now() - 24 * 3600 * 1000),
      priority: 'Urgent',
      taskType: 'Document Collection',
      status: 'Pending',
      assignedTo: 'sales_vikram',
      assignedToName: 'Vikram Mehta',
      notes: 'Registration advocate requires notarized IDs.',
      createdAt: new Date(Date.now() - 3 * 86400 * 1000),
      updatedAt: new Date()
    }
  ]);

  // 9. Threaded Activity Timeline matching Screenshot 4
  await db.collection('crm_activities').insertMany([
    {
      companyId,
      customerId: rahulId,
      activityType: 'Note',
      title: 'Client Profile Onboarded',
      description: 'Rahul Shah registered via Q1 Premium Living Expo (Channel Partner channel). Looking for 3BHK high-rise in Mumbai and 2BHK green home in Bengaluru.',
      performedBy: userId,
      performedByName: 'Vikram Mehta',
      createdAt: new Date(Date.now() - 30 * 86400 * 1000)
    },
    {
      companyId,
      customerId: rahulId,
      unitInterestId: resInt3.insertedId,
      unitCode: 'B-0304',
      activityType: 'Booking Action',
      title: 'Unit B-0304 Confirmed & Booked (BK-2026-0001)',
      description: 'Unit B-0304 committed. Token payment ₹9,45,000 received via NEFT transfer (Receipt REC-2026-0001).',
      performedBy: userId,
      performedByName: 'Accounts Desk',
      createdAt: new Date(Date.now() - 14 * 86400 * 1000)
    },
    {
      companyId,
      customerId: rahulId,
      unitInterestId: resInt2.insertedId,
      unitCode: 'A-1402',
      activityType: 'Site Visit',
      title: 'Site Visit Completed — Tower A 14th Floor',
      description: 'Client and spouse Sunita Shah inspected Unit A-1402. Praised east-facing terrace view; requested 48-hour temporary hold.',
      performedBy: userId,
      performedByName: 'Vikram Mehta',
      createdAt: new Date(Date.now() - 4 * 86400 * 1000)
    },
    {
      companyId,
      customerId: rahulId,
      unitInterestId: resInt1.insertedId,
      unitCode: 'A-1203',
      activityType: 'Call',
      title: 'Pricing Negotiation Call',
      description: 'Spoke with Rahul regarding Unit A-1203. Agreed to review 2% concession with management. Client ready to sign token by Friday.',
      performedBy: userId,
      performedByName: 'Vikram Mehta',
      createdAt: new Date(Date.now() - 1 * 86400 * 1000)
    }
  ]);

  // 10. Default Settings
  await db.collection('crm_settings').insertOne({
    companyId,
    leadSources: ['Website', 'Walk-in', 'Referral', 'Channel Partner', 'Social Media', 'Digital Ads', 'Direct Call'],
    pipelineStages: [
      { key: 'New', label: 'New Lead', order: 1 },
      { key: 'Contacted', label: 'Contacted', order: 2 },
      { key: 'Qualified', label: 'Qualified', order: 3 },
      { key: 'Visit Scheduled', label: 'Site Visit Scheduled', order: 4 },
      { key: 'Visited', label: 'Site Visit Completed', order: 5 },
      { key: 'Negotiation', label: 'Negotiation & Pricing', order: 6 },
      { key: 'Booked', label: 'Unit Booked', order: 7, isClosedWon: true },
      { key: 'Lost', label: 'Lost / Closed', order: 8, isClosedLost: true },
      { key: 'On Hold', label: 'Deferred / On Hold', order: 9 }
    ],
    lostReasons: ['Budget Out of Range', 'Preferred Different Location', 'Purchased Competitor Project', 'Loan Rejected'],
    followUpTypes: ['Phone Call', 'WhatsApp Message', 'Email Update', 'Document Collection', 'Site Visit Prep', 'Payment Follow-up'],
    propertyTypes: ['1BHK', '2BHK', '3BHK', '4BHK Penthouse', 'Villa'],
    defaultReservationHours: 48,
    milestoneTemplates: [
      { name: 'Booking Token Amount', percentage: 10 },
      { name: 'Agreement Signing (Within 30 Days)', percentage: 15 },
      { name: 'Plinth / Foundation Level', percentage: 15 },
      { name: 'Floor Slab Casting Level', percentage: 25 },
      { name: 'Finishing & Plaster Milestone', percentage: 20 },
      { name: 'Notice of Possession & Handover', percentage: 15 }
    ],
    updatedAt: new Date()
  });

  return {
    success: true,
    message: 'Seeded full building chessboard inventory (112 units across Towers A & B) and Rahul Shah master profile.'
  };
}
