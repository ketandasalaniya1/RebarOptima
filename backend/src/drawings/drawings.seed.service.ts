import { ObjectId } from 'mongodb';
import {
  ensureDefaultDisciplines,
  ensureDefaultSettings,
  calculateFileChecksum
} from './drawings.service';

export async function seedDrawingsSampleData(db: any, companyId: any, currentUser?: any): Promise<{ message: string; count: number }> {
  await ensureDefaultDisciplines(db, companyId);
  await ensureDefaultSettings(db, companyId);

  // Check if drawings already exist for this company
  const existingDrawingsCount = await db.collection('doc_drawings').countDocuments({ companyId });
  if (existingDrawingsCount > 0) {
    return { message: 'Drawings data already seeded', count: existingDrawingsCount };
  }

  const now = new Date();
  const userName = currentUser?.name || 'Rahul Singh';
  const userId = currentUser?.sub || 'usr-doc-lead';

  // 1. Seed Internal Projects
  const projects = [
    {
      _id: new ObjectId(),
      companyId,
      projectCode: 'AH',
      projectName: 'Alpha Heights',
      location: 'Sector 18, Expressway, Bangalore',
      description: 'Twin 32-storey ultra-luxury residential towers with double basement and podium amenities.',
      status: 'Active',
      drawingCount: 24,
      latestRevisionDate: new Date('2024-10-20T10:30:00Z'),
      createdAt: new Date('2024-08-01T09:00:00Z'),
      updatedAt: now
    },
    {
      _id: new ObjectId(),
      companyId,
      projectCode: 'RVT',
      projectName: 'Riverside Towers',
      location: 'Marina Bay Road, Kochi',
      description: 'Commercial corporate office park featuring LEED Platinum Grade-A office blocks.',
      status: 'Active',
      drawingCount: 38,
      latestRevisionDate: new Date('2024-10-19T16:15:00Z'),
      createdAt: new Date('2024-07-15T09:00:00Z'),
      updatedAt: now
    },
    {
      _id: new ObjectId(),
      companyId,
      projectCode: 'GV',
      projectName: 'Green Valley',
      location: 'Whitefield Hills, Bangalore',
      description: 'Gated villa development encompassing 120 luxury bespoke villas with clubhouse.',
      status: 'Active',
      drawingCount: 19,
      latestRevisionDate: new Date('2024-10-18T18:20:00Z'),
      createdAt: new Date('2024-08-10T09:00:00Z'),
      updatedAt: now
    },
    {
      _id: new ObjectId(),
      companyId,
      projectCode: 'SKY',
      projectName: 'Skyline Residency',
      location: 'Baner Tech Zone, Pune',
      description: 'Mixed-use residential complex with commercial retail boulevard.',
      status: 'Active',
      drawingCount: 41,
      latestRevisionDate: new Date('2024-10-17T11:00:00Z'),
      createdAt: new Date('2024-06-01T09:00:00Z'),
      updatedAt: now
    }
  ];
  await db.collection('doc_projects').insertMany(projects);

  // Fetch discipline records
  const disciplines = await db.collection('doc_disciplines').find({ companyId }).toArray();
  const getDiscipline = (code: string) => disciplines.find((d: any) => d.code === code) || disciplines[0];

  const ah = projects[0];
  const rvt = projects[1];
  const gv = projects[2];

  // Vector SVG mock representation of floor plan blueprint for real previews
  const sampleFloorplanSvg = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" style="background:#0f172a;width:100%;height:100%">
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="800" height="600" fill="url(#grid)" />
    <!-- Outer Walls -->
    <rect x="80" y="60" width="640" height="480" fill="none" stroke="#38bdf8" stroke-width="4" />
    <!-- Grid Reference Lines -->
    <line x1="80" y1="40" x2="80" y2="560" stroke="#64748b" stroke-width="1" stroke-dasharray="4" />
    <line x1="280" y1="40" x2="280" y2="560" stroke="#64748b" stroke-width="1" stroke-dasharray="4" />
    <line x1="520" y1="40" x2="520" y2="560" stroke="#64748b" stroke-width="1" stroke-dasharray="4" />
    <line x1="720" y1="40" x2="720" y2="560" stroke="#64748b" stroke-width="1" stroke-dasharray="4" />
    <!-- Grid Labels -->
    <circle cx="80" cy="30" r="12" fill="#1e293b" stroke="#38bdf8" />
    <text x="80" y="34" font-size="10" fill="#38bdf8" text-anchor="middle" font-family="sans-serif">1</text>
    <circle cx="280" cy="30" r="12" fill="#1e293b" stroke="#38bdf8" />
    <text x="280" y="34" font-size="10" fill="#38bdf8" text-anchor="middle" font-family="sans-serif">2</text>
    <circle cx="520" cy="30" r="12" fill="#1e293b" stroke="#38bdf8" />
    <text x="520" y="34" font-size="10" fill="#38bdf8" text-anchor="middle" font-family="sans-serif">3</text>
    <circle cx="720" cy="30" r="12" fill="#1e293b" stroke="#38bdf8" />
    <text x="720" y="34" font-size="10" fill="#38bdf8" text-anchor="middle" font-family="sans-serif">4</text>
    <!-- Internal Rooms -->
    <!-- Living Area -->
    <rect x="100" y="80" width="300" height="260" fill="rgba(56,189,248,0.04)" stroke="#0284c7" stroke-width="2" />
    <text x="250" y="210" font-size="16" font-weight="bold" fill="#f8fafc" text-anchor="middle" font-family="sans-serif">GRAND LIVING ROOM</text>
    <text x="250" y="235" font-size="12" fill="#94a3b8" text-anchor="middle" font-family="sans-serif">6800 x 5400 mm</text>
    <!-- Balcony Deck -->
    <rect x="100" y="350" width="300" height="170" fill="rgba(16,185,129,0.06)" stroke="#059669" stroke-width="2" stroke-dasharray="6" />
    <text x="250" y="440" font-size="14" font-weight="bold" fill="#34d399" text-anchor="middle" font-family="sans-serif">SUNRISE BALCONY DECK</text>
    <!-- Master Suite -->
    <rect x="420" y="80" width="280" height="280" fill="rgba(168,85,247,0.04)" stroke="#9333ea" stroke-width="2" />
    <text x="560" y="210" font-size="15" font-weight="bold" fill="#f8fafc" text-anchor="middle" font-family="sans-serif">MASTER SUITE 01</text>
    <text x="560" y="235" font-size="12" fill="#94a3b8" text-anchor="middle" font-family="sans-serif">5200 x 4800 mm</text>
    <!-- Kitchen & Utility -->
    <rect x="420" y="375" width="280" height="145" fill="rgba(245,158,11,0.04)" stroke="#d97706" stroke-width="2" />
    <text x="560" y="450" font-size="14" font-weight="bold" fill="#fbbf24" text-anchor="middle" font-family="sans-serif">MODULAR KITCHEN</text>
    <!-- Title Block at bottom-right -->
    <rect x="480" y="525" width="240" height="30" fill="#1e293b" stroke="#38bdf8" />
    <text x="600" y="545" font-size="11" fill="#f8fafc" text-anchor="middle" font-family="monospace">REBAROPTIMA DRAWING REGISTER</text>
  </svg>`;

  // Stored File
  const storedFile = {
    _id: new ObjectId(),
    companyId,
    originalFilename: 'AR-F-001_GroundFloorPlan_R02.svg',
    storagePath: 'private/drawings/AR-F-001_R02.svg',
    mimeType: 'image/svg+xml',
    sizeBytes: 1024 * 342, // 342 KB
    checksumSha256: calculateFileChecksum(sampleFloorplanSvg),
    uploadedById: userId,
    uploadedByName: userName,
    fileData: Buffer.from(sampleFloorplanSvg).toString('base64'),
    createdAt: new Date('2024-10-20T10:00:00Z')
  };
  await db.collection('doc_files').insertOne(storedFile);

  // 2. Primary Drawing: AR-F-001 (Ground Floor Plan) with R00, R01, R02 revisions
  const arDrawingId = new ObjectId();
  const arRev0 = {
    _id: new ObjectId(),
    companyId,
    drawingId: arDrawingId,
    drawingNumber: 'AR-F-001',
    revisionNumber: 'R00',
    sequenceNumber: 0,
    fileId: storedFile._id,
    fileName: 'AR-F-001_R00.svg',
    fileSize: 1024 * 310,
    fileType: 'svg',
    checksumSha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    changeDescription: 'Initial issue for internal architectural review.',
    changeReason: 'Concept finalization and structural coordination.',
    workflowStatus: 'Superseded',
    isPublished: false,
    isSuperseded: true,
    uploadedById: userId,
    uploadedByName: userName,
    uploadedAt: new Date('2024-10-01T11:15:00Z'),
    supersededAt: new Date('2024-10-14T16:20:00Z'),
    createdAt: new Date('2024-10-01T11:15:00Z'),
    updatedAt: new Date('2024-10-14T16:20:00Z')
  };

  const arRev1 = {
    _id: new ObjectId(),
    companyId,
    drawingId: arDrawingId,
    drawingNumber: 'AR-F-001',
    revisionNumber: 'R01',
    sequenceNumber: 1,
    fileId: storedFile._id,
    fileName: 'AR-F-001_R01.svg',
    fileSize: 1024 * 328,
    fileType: 'svg',
    checksumSha256: 'b2c3d4e5f6a17890123456789abcdef0123456789abcdef0123456789abcdef1',
    changeDescription: 'Updated room layouts and dimensions per MEP coordination notes.',
    changeReason: 'Shaft realignment and duct passage clearance.',
    workflowStatus: 'Superseded',
    isPublished: false,
    isSuperseded: true,
    uploadedById: userId,
    uploadedByName: userName,
    uploadedAt: new Date('2024-10-14T16:20:00Z'),
    supersededAt: new Date('2024-10-20T10:30:00Z'),
    createdAt: new Date('2024-10-14T16:20:00Z'),
    updatedAt: new Date('2024-10-20T10:30:00Z')
  };

  const arRev2 = {
    _id: new ObjectId(),
    companyId,
    drawingId: arDrawingId,
    drawingNumber: 'AR-F-001',
    revisionNumber: 'R02',
    sequenceNumber: 2,
    fileId: storedFile._id,
    fileName: 'AR-F-001_R02.svg',
    fileSize: 1024 * 342,
    fileType: 'svg',
    checksumSha256: storedFile.checksumSha256,
    changeDescription: 'Final layout with revised column offsets and approved entrance lobby dimensions.',
    changeReason: 'Approved for construction issue.',
    workflowStatus: 'Approved',
    isPublished: true,
    isSuperseded: false,
    uploadedById: userId,
    uploadedByName: userName,
    uploadedAt: new Date('2024-10-20T10:30:00Z'),
    approvedAt: new Date('2024-10-20T11:45:00Z'),
    approvedById: 'usr-approver-priya',
    approvedByName: 'Priya Mehta (Approver)',
    createdAt: new Date('2024-10-20T10:30:00Z'),
    updatedAt: new Date('2024-10-20T11:45:00Z')
  };

  await db.collection('doc_revisions').insertMany([arRev0, arRev1, arRev2]);

  // Review Assignments for R02
  const reviews = [
    {
      _id: new ObjectId(),
      companyId,
      drawingId: arDrawingId,
      revisionId: arRev2._id,
      drawingNumber: 'AR-F-001',
      revisionNumber: 'R02',
      reviewerId: 'usr-anil-kumar',
      reviewerName: 'Anil Kumar',
      reviewerRole: 'Structural Reviewer',
      isMandatory: true,
      status: 'Reviewed',
      comments: 'Grid layout matches structural model and column locations verified.',
      reviewedAt: new Date('2024-10-20T11:00:00Z'),
      createdAt: new Date('2024-10-20T10:35:00Z')
    },
    {
      _id: new ObjectId(),
      companyId,
      drawingId: arDrawingId,
      revisionId: arRev2._id,
      drawingNumber: 'AR-F-001',
      revisionNumber: 'R02',
      reviewerId: 'usr-priya-desai',
      reviewerName: 'Priya Desai',
      reviewerRole: 'Design Reviewer',
      isMandatory: true,
      status: 'Reviewed',
      comments: 'Minor architectural notes addressed in entrance foyer. Approved.',
      reviewedAt: new Date('2024-10-20T11:30:00Z'),
      createdAt: new Date('2024-10-20T10:35:00Z')
    }
  ];
  await db.collection('doc_review_assignments').insertMany(reviews);

  // Approval Record for R02
  const approvalRecord = {
    _id: new ObjectId(),
    companyId,
    drawingId: arDrawingId,
    revisionId: arRev2._id,
    drawingNumber: 'AR-F-001',
    revisionNumber: 'R02',
    decision: 'Approved',
    approverId: 'usr-approver-priya',
    approverName: 'Priya Mehta',
    approverRole: 'Principal Document Approver',
    comments: 'All mandatory review checks verified. Released for construction transmittal.',
    decidedAt: new Date('2024-10-20T11:45:00Z'),
    createdAt: new Date('2024-10-20T11:45:00Z')
  };
  await db.collection('doc_approval_records').insertOne(approvalRecord);

  // Insert primary drawing
  const primaryDrawing = {
    _id: arDrawingId,
    companyId,
    projectId: ah._id,
    projectCode: ah.projectCode,
    projectName: ah.projectName,
    disciplineId: getDiscipline('ARCH')._id,
    disciplineCode: 'ARCH',
    disciplineName: 'Architectural',
    drawingNumber: 'AR-F-001',
    title: 'Ground Floor Plan',
    description: 'General arrangement architectural plan for ground floor entrance lobby, clubhouse access and towers A & B foyer.',
    drawingType: 'General Arrangement',
    currentRevisionId: arRev2._id,
    currentRevisionNumber: 'R02',
    currentStatus: 'Approved',
    assignedControllerId: userId,
    assignedControllerName: userName,
    tags: ['GA', 'Floor Plan', 'Architectural', 'Ground Floor'],
    isArchived: false,
    createdBy: userName,
    createdById: userId,
    createdAt: new Date('2024-10-01T11:15:00Z'),
    updatedAt: new Date('2024-10-20T11:45:00Z')
  };
  await db.collection('doc_drawings').insertOne(primaryDrawing);

  // 3. Insert Additional Production Drawings matching Screenshot 5
  const additionalDrawings = [
    {
      companyId,
      projectId: ah._id,
      projectCode: ah.projectCode,
      projectName: ah.projectName,
      disciplineId: getDiscipline('STR')._id,
      disciplineCode: 'STR',
      disciplineName: 'Structural',
      drawingNumber: 'ST-S-101',
      title: 'Slab Reinforcement Plan',
      description: 'First floor top and bottom rebar layout with column drop panels and perimeter edge beams.',
      drawingType: 'Reinforcement Plan',
      currentRevisionNumber: 'R01',
      currentStatus: 'Under Review',
      assignedControllerName: 'Priya Mehta',
      tags: ['Slab', 'Rebar', 'Structural'],
      isArchived: false,
      createdBy: 'Neha Iyer',
      createdAt: new Date('2024-10-15T09:00:00Z'),
      updatedAt: new Date('2024-10-19T16:15:00Z')
    },
    {
      companyId,
      projectId: rvt._id,
      projectCode: rvt.projectCode,
      projectName: rvt.projectName,
      disciplineId: getDiscipline('MEPF')._id,
      disciplineCode: 'MEPF',
      disciplineName: 'MEPF',
      drawingNumber: 'MEP-E-104',
      title: 'Lighting Layout',
      description: 'Tower floor typical recessed lighting grid, emergency battery pack circuits and switch boards.',
      drawingType: 'Schematic',
      currentRevisionNumber: 'R00',
      currentStatus: 'Changes Requested',
      assignedControllerName: 'Anil Kumar',
      tags: ['Electrical', 'Lighting', 'MEPF'],
      isArchived: false,
      createdBy: 'Ravi Kumar',
      createdAt: new Date('2024-10-16T11:00:00Z'),
      updatedAt: new Date('2024-10-18T18:20:00Z')
    },
    {
      companyId,
      projectId: rvt._id,
      projectCode: rvt.projectCode,
      projectName: rvt.projectName,
      disciplineId: getDiscipline('PASS')._id,
      disciplineCode: 'PASS',
      disciplineName: 'Passing / Approval',
      drawingNumber: 'PA-001',
      title: 'Site Plan for Approval',
      description: 'Municipal statutory submission site master plan with fire tender turning radius and setbacks.',
      drawingType: 'Statutory Submission',
      currentRevisionNumber: 'R02',
      currentStatus: 'Approved',
      assignedControllerName: 'Amit Verma',
      tags: ['Statutory', 'Approval', 'Passing'],
      isArchived: false,
      createdBy: 'Amit Verma',
      createdAt: new Date('2024-09-20T10:00:00Z'),
      updatedAt: new Date('2024-10-17T14:30:00Z')
    },
    {
      companyId,
      projectId: gv._id,
      projectCode: gv.projectCode,
      projectName: gv.projectName,
      disciplineId: getDiscipline('LAND')._id,
      disciplineCode: 'LAND',
      disciplineName: 'Landscape',
      drawingNumber: 'LP-001',
      title: 'Landscaping Plan',
      description: 'Central park planting schedule, softscape zones, automatic drip irrigation lines and walking trail.',
      drawingType: 'Landscape Plan',
      currentRevisionNumber: 'R00',
      currentStatus: 'Draft',
      assignedControllerName: 'Sneha Patel',
      tags: ['Landscape', 'Irrigation'],
      isArchived: false,
      createdBy: 'Sneha Patel',
      createdAt: new Date('2024-10-16T15:00:00Z'),
      updatedAt: new Date('2024-10-16T15:00:00Z')
    },
    {
      companyId,
      projectId: gv._id,
      projectCode: gv.projectCode,
      projectName: gv.projectName,
      disciplineId: getDiscipline('INT')._id,
      disciplineCode: 'INT',
      disciplineName: 'Interior',
      drawingNumber: 'IN-201',
      title: 'Interior Layout',
      description: 'Model villa type-A interior partitions, false ceiling elevation drops and joinery details.',
      drawingType: 'Interior Detail',
      currentRevisionNumber: 'R01',
      currentStatus: 'Pending Approval',
      assignedControllerName: 'Rahul Singh',
      tags: ['Interior', 'Ceiling', 'Joinery'],
      isArchived: false,
      createdBy: 'Kavita Roy',
      createdAt: new Date('2024-10-12T10:00:00Z'),
      updatedAt: new Date('2024-10-15T12:00:00Z')
    },
    {
      companyId,
      projectId: ah._id,
      projectCode: ah.projectCode,
      projectName: ah.projectName,
      disciplineId: getDiscipline('STR')._id,
      disciplineCode: 'STR',
      disciplineName: 'Structural',
      drawingNumber: 'ST-B-222',
      title: 'Beam Details',
      description: 'Transfer girder longitudinal profile, shear stirrup spacing and curtailment schedule.',
      drawingType: 'Detail',
      currentRevisionNumber: 'R03',
      currentStatus: 'Approved',
      assignedControllerName: 'Priya Mehta',
      tags: ['Beams', 'Structural', 'Transfer Girder'],
      isArchived: false,
      createdBy: 'Neha Iyer',
      createdAt: new Date('2024-09-10T09:00:00Z'),
      updatedAt: new Date('2024-10-14T15:00:00Z')
    },
    {
      companyId,
      projectId: ah._id,
      projectCode: ah.projectCode,
      projectName: ah.projectName,
      disciplineId: getDiscipline('STR')._id,
      disciplineCode: 'STR',
      disciplineName: 'Structural',
      drawingNumber: 'ST-C-105',
      title: 'Column Details',
      description: 'Base column schedule C1 to C32 with splice offsets, link ties and tie bar details.',
      drawingType: 'Detail',
      currentRevisionNumber: 'R02',
      currentStatus: 'Approved',
      assignedControllerName: 'Priya Mehta',
      tags: ['Columns', 'Structural'],
      isArchived: false,
      createdBy: 'Neha Iyer',
      createdAt: new Date('2024-09-15T11:00:00Z'),
      updatedAt: new Date('2024-10-12T10:00:00Z')
    },
    {
      companyId,
      projectId: ah._id,
      projectCode: ah.projectCode,
      projectName: ah.projectName,
      disciplineId: getDiscipline('STR')._id,
      disciplineCode: 'STR',
      disciplineName: 'Structural',
      drawingNumber: 'ST-F-001',
      title: 'Foundation Plan',
      description: 'Raft foundation thickness profile, pile cap layout and basement water barrier detail.',
      drawingType: 'Foundation Plan',
      currentRevisionNumber: 'R00',
      currentStatus: 'Draft',
      assignedControllerName: 'Anil Kumar',
      tags: ['Foundation', 'Raft', 'Piles'],
      isArchived: false,
      createdBy: 'Suresh Patil',
      createdAt: new Date('2024-10-10T14:00:00Z'),
      updatedAt: new Date('2024-10-10T14:00:00Z')
    },
    {
      companyId,
      projectId: ah._id,
      projectCode: ah.projectCode,
      projectName: ah.projectName,
      disciplineId: getDiscipline('STR')._id,
      disciplineCode: 'STR',
      disciplineName: 'Structural',
      drawingNumber: 'ST-S-201',
      title: 'Staircase Details',
      description: 'Fire escape staircase scissor flight reinforcement, mid-landing beams and handrail anchors.',
      drawingType: 'Detail',
      currentRevisionNumber: 'R01',
      currentStatus: 'Pending Approval',
      assignedControllerName: 'Priya Mehta',
      tags: ['Stairs', 'Structural'],
      isArchived: false,
      createdBy: 'Neha Iyer',
      createdAt: new Date('2024-10-05T10:00:00Z'),
      updatedAt: new Date('2024-10-08T16:00:00Z')
    },
    {
      companyId,
      projectId: ah._id,
      projectCode: ah.projectCode,
      projectName: ah.projectName,
      disciplineId: getDiscipline('STR')._id,
      disciplineCode: 'STR',
      disciplineName: 'Structural',
      drawingNumber: 'ST-W-301',
      title: 'Retaining Wall Details',
      description: 'Perimeter diaphragm wall sections, basement level 2 weep holes and drainage filter layers.',
      drawingType: 'Detail',
      currentRevisionNumber: 'R00',
      currentStatus: 'Draft',
      assignedControllerName: 'Anil Kumar',
      tags: ['Retaining Wall', 'Basement'],
      isArchived: false,
      createdBy: 'Suresh Patil',
      createdAt: new Date('2024-10-05T14:00:00Z'),
      updatedAt: new Date('2024-10-05T14:00:00Z')
    }
  ];

  for (const d of additionalDrawings) {
    const drawingId = new ObjectId();
    const revId = new ObjectId();
    const revDoc = {
      _id: revId,
      companyId,
      drawingId,
      drawingNumber: d.drawingNumber,
      revisionNumber: d.currentRevisionNumber,
      sequenceNumber: parseInt(d.currentRevisionNumber.replace(/\D/g, ''), 10) || 0,
      fileId: storedFile._id,
      fileName: `${d.drawingNumber}_${d.currentRevisionNumber}.svg`,
      fileSize: 1024 * 315,
      fileType: 'svg',
      checksumSha256: storedFile.checksumSha256,
      changeDescription: `Revision ${d.currentRevisionNumber} for ${d.title}`,
      workflowStatus: d.currentStatus,
      isPublished: d.currentStatus === 'Approved',
      isSuperseded: false,
      uploadedById: userId,
      uploadedByName: d.createdBy,
      uploadedAt: d.updatedAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    };
    await db.collection('doc_revisions').insertOne(revDoc);

    await db.collection('doc_drawings').insertOne({
      ...d,
      _id: drawingId,
      currentRevisionId: revId,
      createdById: userId
    });
  }

  // 4. Seed Transmittals matching Screenshot 5 Panel 7
  const transmittal = {
    _id: new ObjectId(),
    companyId,
    transmittalNumber: 'TR-2024-010',
    projectId: ah._id,
    projectCode: ah.projectCode,
    projectName: ah.projectName,
    purpose: 'For Construction',
    issueDate: '2024-10-22',
    issuedById: userId,
    issuedByName: 'Rahul Singh',
    recipients: [
      { name: 'Site Team', organization: 'L&T Construction', email: 'site.alpha@rebaroptima.com', role: 'Main Contractor' },
      { name: 'Project Manager', organization: 'Alpha Heights PMO', email: 'pm.alpha@rebaroptima.com', role: 'Client Representative' }
    ],
    notes: 'Issued drawings for podium ground floor construction and column reinforcement works.',
    items: [
      {
        drawingId: arDrawingId,
        drawingNumber: 'AR-F-001',
        title: 'Ground Floor Plan',
        revisionNumber: 'R02',
        status: 'Approved'
      },
      {
        drawingId: new ObjectId(),
        drawingNumber: 'ST-S-101',
        title: 'Slab Reinforcement Plan',
        revisionNumber: 'R01',
        status: 'Under Review'
      },
      {
        drawingId: new ObjectId(),
        drawingNumber: 'MEP-E-104',
        title: 'Lighting Layout',
        revisionNumber: 'R00',
        status: 'Changes Requested'
      }
    ],
    createdAt: new Date('2024-10-22T09:30:00Z'),
    updatedAt: new Date('2024-10-22T09:30:00Z')
  };
  await db.collection('doc_transmittals').insertOne(transmittal);

  // 5. Seed Activity Events matching timeline in Screenshot 5
  const activityEvents = [
    {
      companyId,
      entityType: 'drawing',
      entityId: String(arDrawingId),
      action: 'APPROVED',
      title: 'AR-F-001 Approved',
      description: 'ST-S-101 - Slab Reinforcement Plan approved by Priya Mehta (Approver).',
      drawingNumber: 'ST-S-101',
      revisionNumber: 'R02',
      performedById: 'usr-approver-priya',
      performedByName: 'Priya Mehta',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    },
    {
      companyId,
      entityType: 'revision',
      entityId: String(arRev1._id),
      action: 'SUBMITTED',
      title: 'AR-F-001 Submitted for Review',
      description: 'AR-F-001 - First Floor Plan submitted for review by Rahul Singh.',
      drawingNumber: 'AR-F-001',
      revisionNumber: 'R01',
      performedById: userId,
      performedByName: 'Rahul Singh',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5 hours ago
    },
    {
      companyId,
      entityType: 'review',
      entityId: String(arRev0._id),
      action: 'CHANGES_REQUESTED',
      title: 'MEP-E-104 Changes Requested',
      description: 'MEP-E-104 - Lighting Layout changes requested by Anil Kumar.',
      drawingNumber: 'MEP-E-104',
      revisionNumber: 'R00',
      performedById: 'usr-anil-kumar',
      performedByName: 'Anil Kumar',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    },
    {
      companyId,
      entityType: 'revision',
      entityId: String(arRev0._id),
      action: 'UPLOADED',
      title: 'LP-001 Uploaded',
      description: 'LP-001 - Landscaping Plan uploaded by Sneha Patel.',
      drawingNumber: 'LP-001',
      revisionNumber: 'R03',
      performedById: 'usr-sneha',
      performedByName: 'Sneha Patel',
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000) // 1 day ago
    }
  ];
  await db.collection('doc_activity_events').insertMany(activityEvents);

  // 6. Seed Module Memberships (RBAC)
  const memberships = [
    {
      companyId,
      userId,
      userName: 'Rahul Singh',
      userEmail: 'rahul.singh@rebaroptima.com',
      role: 'admin',
      status: 'Active',
      createdAt: now,
      updatedAt: now
    },
    {
      companyId,
      userId: 'usr-approver-priya',
      userName: 'Priya Mehta',
      userEmail: 'priya.mehta@rebaroptima.com',
      role: 'approver',
      status: 'Active',
      createdAt: now,
      updatedAt: now
    },
    {
      companyId,
      userId: 'usr-anil-kumar',
      userName: 'Anil Kumar',
      userEmail: 'anil.kumar@rebaroptima.com',
      role: 'reviewer',
      status: 'Active',
      createdAt: now,
      updatedAt: now
    },
    {
      companyId,
      userId: 'usr-neha-iyer',
      userName: 'Neha Iyer',
      userEmail: 'neha.iyer@rebaroptima.com',
      role: 'uploader',
      status: 'Active',
      createdAt: now,
      updatedAt: now
    },
    {
      companyId,
      userId: 'usr-site-readonly',
      userName: 'Site Engineer Rohit',
      userEmail: 'site.rohit@rebaroptima.com',
      role: 'readonly',
      status: 'Active',
      createdAt: now,
      updatedAt: now
    }
  ];
  await db.collection('doc_memberships').insertMany(memberships);

  return { message: 'Sample drawings workspace seeded successfully', count: additionalDrawings.length + 1 };
}
