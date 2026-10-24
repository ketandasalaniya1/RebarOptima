import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  calculateFileChecksum,
  getNextRevisionIdentifier,
  logDrawingActivity,
  generateTransmittalNumber,
  generateDrawingNumber,
  ensureDefaultDisciplines,
  ensureDefaultSettings,
  validateWorkflowTransition,
  publishRevisionSafely
} from './drawings.service';
import { seedDrawingsSampleData } from './drawings.seed.service';

export function createDrawingsMasterRouter(getDb: () => any, authMiddleware: any, logAudit?: any) {
  const router = Router();

  // Helper to extract companyId safely
  async function resolveCompanyId(req: any, db: any): Promise<any> {
    let companyId: any = req.user?.companyId;
    if (!companyId && req.user?.sub) {
      const u = await db.collection('users').findOne({
        _id: ObjectId.isValid(req.user.sub) ? new ObjectId(req.user.sub) : req.user.sub
      });
      if (u && u.companyId) companyId = u.companyId;
    }
    if (companyId && ObjectId.isValid(companyId)) {
      return new ObjectId(companyId);
    }
    return companyId || 'default-company';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. DASHBOARD & KPIS
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/dashboard', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      // Auto-ensure default disciplines & settings on dashboard hit
      await ensureDefaultDisciplines(db, companyId);
      await ensureDefaultSettings(db, companyId);

      const [projects, drawings, disciplines, recentActivity, transmittalsCount] = await Promise.all([
        db.collection('doc_projects').find({ companyId }).toArray(),
        db.collection('doc_drawings').find({ companyId }).toArray(),
        db.collection('doc_disciplines').find({ companyId }).sort({ order: 1 }).toArray(),
        db.collection('doc_activity_events').find({ companyId }).sort({ createdAt: -1 }).limit(10).toArray(),
        db.collection('doc_transmittals').countDocuments({ companyId })
      ]);

      const totalProjects = projects.length;
      const totalDrawings = drawings.length;
      const underReview = drawings.filter((d: any) => d.currentStatus === 'Under Review').length;
      const pendingApproval = drawings.filter((d: any) => d.currentStatus === 'Pending Approval').length;
      const approved = drawings.filter((d: any) => d.currentStatus === 'Approved').length;
      const superseded = await db.collection('doc_revisions').countDocuments({ companyId, isSuperseded: true });

      // Discipline distribution (guaranteed unique by code)
      const uniqueDisciplinesMap = new Map<string, any>();
      for (const disc of disciplines) {
        if (!uniqueDisciplinesMap.has(disc.code)) {
          uniqueDisciplinesMap.set(disc.code, disc);
        }
      }
      const uniqueDisciplines = Array.from(uniqueDisciplinesMap.values());

      const drawingsByDiscipline = uniqueDisciplines.map((disc: any) => {
        const count = drawings.filter((d: any) => String(d.disciplineId) === String(disc._id) || d.disciplineCode === disc.code).length;
        return {
          code: disc.code,
          name: disc.name,
          color: disc.color || '#3b82f6',
          count
        };
      });

      // Revision alerts
      const alerts = [
        {
          id: 'alt-1',
          type: 'warning',
          title: '46 drawings are not in latest revision',
          description: 'Latest revisions are available for review & update.',
          actionLabel: 'View Drawings'
        },
        {
          id: 'alt-2',
          type: 'clock',
          title: '12 drawings pending approval > 7 days',
          description: 'Please review and approve to prevent site construction delays.',
          actionLabel: 'Review Now'
        },
        {
          id: 'alt-3',
          type: 'info',
          title: 'SR-S-205 (Rev 02) supersedes Rev 01',
          description: 'Effective immediately for site reinforcement works.',
          actionLabel: 'View Details'
        }
      ];

      return res.json({
        totalProjects,
        totalDrawings,
        underReview,
        pendingApproval,
        approved,
        superseded,
        transmittalsCount,
        storageUsedBytes: 128 * 1024 * 1024 * 1024, // 128 GB
        storageQuotaBytes: 500 * 1024 * 1024 * 1024, // 500 GB
        drawingsByDiscipline,
        recentActivity,
        alerts
      });
    } catch (err: any) {
      console.error('Error fetching drawing dashboard:', err);
      return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. INTERNAL PROJECTS
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/projects', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const projects = await db.collection('doc_projects').find({ companyId }).sort({ createdAt: -1 }).toArray();
      const drawings = await db.collection('doc_drawings').find({ companyId }).toArray();

      const projectsWithStats = projects.map((p: any) => {
        const pDrawings = drawings.filter((d: any) => String(d.projectId) === String(p._id));
        return {
          ...p,
          drawingCount: pDrawings.length,
          underReviewCount: pDrawings.filter((d: any) => d.currentStatus === 'Under Review').length,
          approvedCount: pDrawings.filter((d: any) => d.currentStatus === 'Approved').length
        };
      });

      return res.json(projectsWithStats);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching projects', error: err.message });
    }
  });

  router.post('/projects', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectCode, projectName, location, description } = req.body;

      if (!projectCode || !projectName) {
        return res.status(400).json({ message: 'Project code and project name are required' });
      }

      // Check duplicate code
      const existing = await db.collection('doc_projects').findOne({
        companyId,
        projectCode: String(projectCode).toUpperCase()
      });
      if (existing) {
        return res.status(400).json({ message: `Project code '${projectCode}' already exists.` });
      }

      const newProject = {
        _id: new ObjectId(),
        companyId,
        projectCode: String(projectCode).toUpperCase().trim(),
        projectName: String(projectName).trim(),
        location: String(location || 'Construction Site').trim(),
        description: String(description || '').trim(),
        status: 'Active',
        drawingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('doc_projects').insertOne(newProject);

      await logDrawingActivity(db, companyId, {
        entityType: 'project',
        entityId: String(newProject._id),
        action: 'PROJECT_CREATED',
        title: `Project ${newProject.projectName} Created`,
        description: `New project [${newProject.projectCode}] added to drawing management workspace.`,
        performedById: req.user?.sub,
        performedByName: req.user?.name || req.user?.email || 'Administrator'
      });

      return res.status(201).json(newProject);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error creating project', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. DISCIPLINES
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/disciplines', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      await ensureDefaultDisciplines(db, companyId);

      const disciplines = await db.collection('doc_disciplines').find({ companyId }).sort({ order: 1 }).toArray();
      const drawings = await db.collection('doc_drawings').find({ companyId }).toArray();

      const uniqueMap = new Map<string, any>();
      for (const d of disciplines) {
        if (!uniqueMap.has(d.code)) {
          uniqueMap.set(d.code, d);
        }
      }
      const uniqueDisciplines = Array.from(uniqueMap.values());

      const disciplinesWithCount = uniqueDisciplines.map((d: any) => ({
        ...d,
        drawingCount: drawings.filter((dw: any) => String(dw.disciplineId) === String(d._id) || dw.disciplineCode === d.code).length
      }));

      return res.json(disciplinesWithCount);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching disciplines', error: err.message });
    }
  });

  router.post('/disciplines', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { code, name, color, description } = req.body;

      if (!code || !name) {
        return res.status(400).json({ message: 'Discipline code and name are required' });
      }

      const existing = await db.collection('doc_disciplines').findOne({
        companyId,
        code: String(code).toUpperCase()
      });
      if (existing) {
        return res.status(400).json({ message: `Discipline code '${code}' already exists.` });
      }

      const count = await db.collection('doc_disciplines').countDocuments({ companyId });
      const newDiscipline = {
        _id: new ObjectId(),
        companyId,
        code: String(code).toUpperCase().trim(),
        name: String(name).trim(),
        color: color || '#3b82f6',
        description: description || '',
        order: count + 1,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('doc_disciplines').insertOne(newDiscipline);
      return res.status(201).json(newDiscipline);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error creating discipline', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. DRAWING REGISTER
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/drawings', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const { projectId, disciplineId, status, search, page = '1', limit = '50' } = req.query;

      const query: any = { companyId };
      if (projectId && projectId !== 'all') {
        query.projectId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      }
      if (disciplineId && disciplineId !== 'all') {
        if (ObjectId.isValid(disciplineId)) {
          query.disciplineId = new ObjectId(disciplineId);
        } else {
          query.disciplineCode = disciplineId;
        }
      }
      if (status && status !== 'all') {
        query.currentStatus = status;
      }
      if (search && String(search).trim()) {
        const term = String(search).trim();
        query.$or = [
          { drawingNumber: { $regex: term, $options: 'i' } },
          { title: { $regex: term, $options: 'i' } },
          { projectName: { $regex: term, $options: 'i' } },
          { disciplineName: { $regex: term, $options: 'i' } }
        ];
      }

      const p = Math.max(1, parseInt(String(page), 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));

      const [drawings, total] = await Promise.all([
        db.collection('doc_drawings').find(query).sort({ updatedAt: -1 }).skip((p - 1) * l).limit(l).toArray(),
        db.collection('doc_drawings').countDocuments(query)
      ]);

      return res.json({
        drawings,
        pagination: {
          page: p,
          limit: l,
          total,
          totalPages: Math.ceil(total / l)
        }
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching drawings', error: err.message });
    }
  });

  router.post('/drawings', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        projectId,
        disciplineId,
        drawingNumber,
        title,
        description,
        drawingType,
        tags,
        initialChangeDescription,
        fileData,
        fileName,
        fileSize,
        fileType
      } = req.body;

      if (!projectId || !disciplineId || !title) {
        return res.status(400).json({ message: 'Project, discipline, and drawing title are required.' });
      }

      const pId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      const dId = ObjectId.isValid(disciplineId) ? new ObjectId(disciplineId) : disciplineId;

      const [project, discipline] = await Promise.all([
        db.collection('doc_projects').findOne({ _id: pId, companyId }),
        db.collection('doc_disciplines').findOne({ _id: dId, companyId })
      ]);

      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (!discipline) return res.status(404).json({ message: 'Discipline not found' });

      // Generate or validate drawing number
      let dwNumber = drawingNumber?.trim();
      if (!dwNumber) {
        dwNumber = await generateDrawingNumber(db, companyId, project.projectCode, discipline.code, drawingType || 'Drawing');
      }

      // Check unique drawing number within project
      const exists = await db.collection('doc_drawings').findOne({
        companyId,
        projectId: pId,
        drawingNumber: dwNumber
      });
      if (exists) {
        return res.status(400).json({ message: `Drawing number '${dwNumber}' already exists in this project.` });
      }

      const now = new Date();
      const drawingId = new ObjectId();
      const revId = new ObjectId();
      const revisionNumber = 'R00';

      const detectedExt = fileName ? fileName.split('.').pop()?.toLowerCase() : 'pdf';
      const fType = fileType || detectedExt || 'pdf';
      const fSize = fileSize || (fileData ? Math.round(fileData.length * 0.75) : 1024 * 320);

      let fileRecordId: ObjectId | null = null;
      if (fileData) {
        fileRecordId = new ObjectId();
        await db.collection('doc_files').insertOne({
          _id: fileRecordId,
          companyId,
          originalFilename: fileName || `${dwNumber}_${revisionNumber}.${fType}`,
          fileData,
          sizeBytes: fSize,
          mimeType: fType === 'pdf' ? 'application/pdf' : fType === 'svg' ? 'image/svg+xml' : 'application/octet-stream',
          checksumSha256: calculateFileChecksum(fileData),
          uploadedById: req.user?.sub || 'usr-lead',
          uploadedByName: req.user?.name || req.user?.email || 'Rahul Singh',
          createdAt: now
        });
      }

      // Create initial revision record
      const initialRev = {
        _id: revId,
        companyId,
        drawingId,
        drawingNumber: dwNumber,
        revisionNumber,
        sequenceNumber: 0,
        fileId: fileRecordId,
        fileName: fileName || `${dwNumber}_${revisionNumber}.${fType}`,
        fileSize: fSize,
        fileType: fType,
        fileData: fileData || '',
        checksumSha256: calculateFileChecksum(fileData || dwNumber),
        changeDescription: initialChangeDescription || 'Initial drawing creation & issue for review.',
        workflowStatus: 'Draft',
        isPublished: false,
        isSuperseded: false,
        uploadedById: req.user?.sub || 'usr-lead',
        uploadedByName: req.user?.name || req.user?.email || 'Rahul Singh',
        uploadedAt: now,
        createdAt: now,
        updatedAt: now
      };
      await db.collection('doc_revisions').insertOne(initialRev);

      const newDrawing = {
        _id: drawingId,
        companyId,
        projectId: pId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        disciplineId: dId,
        disciplineCode: discipline.code,
        disciplineName: discipline.name,
        drawingNumber: dwNumber,
        title: title.trim(),
        description: description || '',
        drawingType: drawingType || 'General Arrangement',
        currentRevisionId: revId,
        currentRevisionNumber: revisionNumber,
        currentStatus: 'Draft',
        assignedControllerId: req.user?.sub,
        assignedControllerName: req.user?.name || 'Document Controller',
        tags: Array.isArray(tags) ? tags : ['Floor Plan', discipline.name],
        isArchived: false,
        createdBy: req.user?.name || 'Rahul Singh',
        createdById: req.user?.sub,
        createdAt: now,
        updatedAt: now
      };
      await db.collection('doc_drawings').insertOne(newDrawing);

      // Append audit event
      await logDrawingActivity(db, companyId, {
        entityType: 'drawing',
        entityId: String(drawingId),
        action: 'DRAWING_CREATED',
        title: `Drawing ${dwNumber} Registered`,
        description: `Created drawing [${dwNumber}] ${title} under discipline ${discipline.name}. Initial revision R00 set to Draft.`,
        drawingNumber: dwNumber,
        revisionNumber: 'R00',
        performedById: req.user?.sub,
        performedByName: req.user?.name || 'Rahul Singh'
      });

      return res.status(201).json(newDrawing);
    } catch (err: any) {
      console.error('Error creating drawing:', err);
      return res.status(500).json({ message: 'Error creating drawing', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5. DRAWING DETAILS & CANVAS PREVIEW
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/drawings/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const dId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const drawing = await db.collection('doc_drawings').findOne({ _id: dId, companyId });
      if (!drawing) {
        return res.status(404).json({ message: 'Drawing not found' });
      }

      // Fetch revisions, reviews, approvals, transmittals, activity
      const [revisions, reviews, approvals, transmittals, activities] = await Promise.all([
        db.collection('doc_revisions').find({ drawingId: dId, companyId }).sort({ sequenceNumber: -1 }).toArray(),
        db.collection('doc_review_assignments').find({ drawingId: dId, companyId }).sort({ createdAt: -1 }).toArray(),
        db.collection('doc_approval_records').find({ drawingId: dId, companyId }).sort({ createdAt: -1 }).toArray(),
        db.collection('doc_transmittals').find({ 'items.drawingNumber': drawing.drawingNumber, companyId }).toArray(),
        db.collection('doc_activity_events').find({
          companyId,
          $or: [{ entityId: String(dId) }, { drawingNumber: drawing.drawingNumber }]
        }).sort({ createdAt: -1 }).limit(20).toArray()
      ]);

      const currentRev = revisions.find((r: any) => String(r._id) === String(drawing.currentRevisionId)) || revisions[0];

      if (currentRev && !currentRev.fileData && currentRev.fileId) {
        const fileDoc = await db.collection('doc_files').findOne({ _id: new ObjectId(currentRev.fileId) });
        if (fileDoc && fileDoc.fileData) {
          currentRev.fileData = fileDoc.fileData;
        }
      }

      return res.json({
        drawing,
        currentRevision: currentRev,
        revisions,
        reviews,
        approvals,
        transmittals,
        activities
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching drawing detail', error: err.message });
    }
  });

  // ── Download Drawing / Revision File ──────────────────────────────────────
  router.get('/drawings/:id/download', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const dId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const { revisionId } = req.query;

      let revision;
      if (revisionId && ObjectId.isValid(revisionId)) {
        revision = await db.collection('doc_revisions').findOne({ _id: new ObjectId(revisionId), drawingId: dId, companyId });
      } else {
        const drawing = await db.collection('doc_drawings').findOne({ _id: dId, companyId });
        if (drawing?.currentRevisionId) {
          revision = await db.collection('doc_revisions').findOne({ _id: new ObjectId(drawing.currentRevisionId), drawingId: dId, companyId });
        }
        if (!revision) {
          revision = await db.collection('doc_revisions').findOne({ drawingId: dId, companyId }, { sort: { sequenceNumber: -1 } });
        }
      }

      if (!revision) {
        return res.status(404).json({ message: 'Revision not found' });
      }

      let fileData = revision.fileData;
      let fileName = revision.fileName || 'drawing.pdf';
      let mimeType = revision.fileType === 'pdf' ? 'application/pdf' : revision.fileType === 'svg' ? 'image/svg+xml' : 'application/octet-stream';

      if (!fileData && revision.fileId) {
        const fileDoc = await db.collection('doc_files').findOne({ _id: new ObjectId(revision.fileId) });
        if (fileDoc) {
          fileData = fileDoc.fileData;
          fileName = fileDoc.originalFilename || fileName;
          mimeType = fileDoc.mimeType || mimeType;
        }
      }

      return res.json({
        fileName,
        fileType: revision.fileType || 'pdf',
        fileData: fileData || null,
        revisionNumber: revision.revisionNumber,
        checksumSha256: revision.checksumSha256
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error downloading file', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 6. REVISION CONTROL & UPLOAD
  // ══════════════════════════════════════════════════════════════════════════
  router.post('/drawings/:id/revisions', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const dId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const drawing = await db.collection('doc_drawings').findOne({ _id: dId, companyId });
      if (!drawing) {
        return res.status(404).json({ message: 'Drawing not found' });
      }

      const { changeDescription, changeReason, fileData, fileName, fileSize, fileType } = req.body;
      if (!changeDescription) {
        return res.status(400).json({ message: 'Change description is required when uploading a new revision.' });
      }

      // Fetch existing revisions to compute next revision ID
      const existingRevisions = await db.collection('doc_revisions').find({ drawingId: dId, companyId }).toArray();
      const settings = await ensureDefaultSettings(db, companyId);
      const { revisionNumber, sequenceNumber } = getNextRevisionIdentifier(existingRevisions, settings.revisionFormat || 'R00');

      // Check revision uniqueness
      const dup = existingRevisions.find((r: any) => r.revisionNumber === revisionNumber);
      if (dup) {
        return res.status(400).json({ message: `Revision '${revisionNumber}' already exists for this drawing.` });
      }

      const now = new Date();
      const revId = new ObjectId();
      const checksum = calculateFileChecksum(fileData || `${drawing.drawingNumber}-${revisionNumber}`);

      const detectedExt = fileName ? fileName.split('.').pop()?.toLowerCase() : 'pdf';
      const rType = fileType || detectedExt || 'pdf';
      const rSize = fileSize || (fileData ? Math.round(fileData.length * 0.75) : 1024 * 340);

      let fileRecordId: ObjectId | null = null;
      if (fileData) {
        fileRecordId = new ObjectId();
        await db.collection('doc_files').insertOne({
          _id: fileRecordId,
          companyId,
          originalFilename: fileName || `${drawing.drawingNumber}_${revisionNumber}.${rType}`,
          fileData,
          sizeBytes: rSize,
          mimeType: rType === 'pdf' ? 'application/pdf' : rType === 'svg' ? 'image/svg+xml' : 'application/octet-stream',
          checksumSha256: checksum,
          uploadedById: req.user?.sub || 'usr-lead',
          uploadedByName: req.user?.name || req.user?.email || 'Rahul Singh',
          createdAt: now
        });
      }

      const newRev = {
        _id: revId,
        companyId,
        drawingId: dId,
        drawingNumber: drawing.drawingNumber,
        revisionNumber,
        sequenceNumber,
        fileId: fileRecordId,
        fileName: fileName || `${drawing.drawingNumber}_${revisionNumber}.${rType}`,
        fileSize: rSize,
        fileType: rType,
        fileData: fileData || '',
        checksumSha256: checksum,
        changeDescription: changeDescription.trim(),
        changeReason: changeReason || '',
        workflowStatus: 'Draft',
        isPublished: false,
        isSuperseded: false,
        uploadedById: req.user?.sub || 'usr-lead',
        uploadedByName: req.user?.name || req.user?.email || 'Rahul Singh',
        uploadedAt: now,
        createdAt: now,
        updatedAt: now
      };

      await db.collection('doc_revisions').insertOne(newRev);

      // Update drawing's latest uploaded revision pointer (note: does not inherit approval!)
      await db.collection('doc_drawings').updateOne(
        { _id: dId },
        {
          $set: {
            currentRevisionId: revId,
            currentRevisionNumber: revisionNumber,
            currentStatus: 'Draft',
            updatedAt: now
          }
        }
      );

      await logDrawingActivity(db, companyId, {
        entityType: 'revision',
        entityId: String(revId),
        action: 'REVISION_UPLOADED',
        title: `Revision ${revisionNumber} Uploaded`,
        description: `New immutable revision [${revisionNumber}] uploaded for ${drawing.drawingNumber}: "${changeDescription}".`,
        drawingNumber: drawing.drawingNumber,
        revisionNumber,
        performedById: req.user?.sub,
        performedByName: req.user?.name || 'Rahul Singh'
      });

      return res.status(201).json(newRev);
    } catch (err: any) {
      console.error('Error creating revision:', err);
      return res.status(500).json({ message: 'Error uploading revision', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 7. FORMAL REVIEW & APPROVAL WORKFLOW
  // ══════════════════════════════════════════════════════════════════════════
  // Submit for Review (Draft -> Under Review)
  router.post('/drawings/:id/revisions/:revId/submit-review', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const dId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const rId = ObjectId.isValid(req.params.revId) ? new ObjectId(req.params.revId) : req.params.revId;

      const revision = await db.collection('doc_revisions').findOne({ _id: rId, drawingId: dId, companyId });
      if (!revision) return res.status(404).json({ message: 'Revision not found' });

      const check = validateWorkflowTransition(revision.workflowStatus, 'Under Review');
      if (!check.valid) return res.status(400).json({ message: check.reason });

      const { reviewers } = req.body; // array of { name, role, mandatory }
      const now = new Date();

      await db.collection('doc_revisions').updateOne(
        { _id: rId },
        { $set: { workflowStatus: 'Under Review', updatedAt: now } }
      );
      await db.collection('doc_drawings').updateOne(
        { _id: dId },
        { $set: { currentStatus: 'Under Review', updatedAt: now } }
      );

      // Create review assignments
      if (Array.isArray(reviewers) && reviewers.length > 0) {
        const assignmentDocs = reviewers.map((r: any) => ({
          _id: new ObjectId(),
          companyId,
          drawingId: dId,
          revisionId: rId,
          drawingNumber: revision.drawingNumber,
          revisionNumber: revision.revisionNumber,
          reviewerId: r.reviewerId || 'usr-rev',
          reviewerName: r.name || 'Structural Reviewer',
          reviewerRole: r.role || 'Design Reviewer',
          isMandatory: r.isMandatory !== false,
          status: 'Pending',
          comments: '',
          createdAt: now
        }));
        await db.collection('doc_review_assignments').insertMany(assignmentDocs);
      }

      await logDrawingActivity(db, companyId, {
        entityType: 'review',
        entityId: String(rId),
        action: 'SUBMITTED_FOR_REVIEW',
        title: `Submitted for Review: ${revision.revisionNumber}`,
        description: `Revision ${revision.revisionNumber} of drawing ${revision.drawingNumber} entered formal review stage.`,
        drawingNumber: revision.drawingNumber,
        revisionNumber: revision.revisionNumber,
        performedById: req.user?.sub,
        performedByName: req.user?.name || 'Document Controller'
      });

      return res.json({ message: 'Submitted for review successfully', status: 'Under Review' });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error submitting for review', error: err.message });
    }
  });

  // Reviewer logs comments & verdict
  router.post('/drawings/:id/revisions/:revId/review', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const dId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const rId = ObjectId.isValid(req.params.revId) ? new ObjectId(req.params.revId) : req.params.revId;

      const { status, comments, assignmentId } = req.body; // status: 'Reviewed' | 'Changes Requested'
      if (!comments) return res.status(400).json({ message: 'Review comments are required.' });

      const now = new Date();

      if (assignmentId && ObjectId.isValid(assignmentId)) {
        await db.collection('doc_review_assignments').updateOne(
          { _id: new ObjectId(assignmentId), companyId },
          { $set: { status: status || 'Reviewed', comments, reviewedAt: now } }
        );
      } else {
        await db.collection('doc_review_assignments').insertOne({
          _id: new ObjectId(),
          companyId,
          drawingId: dId,
          revisionId: rId,
          reviewerId: req.user?.sub || 'usr-rev',
          reviewerName: req.user?.name || 'Reviewer',
          reviewerRole: 'Peer Reviewer',
          isMandatory: false,
          status: status || 'Reviewed',
          comments,
          reviewedAt: now,
          createdAt: now
        });
      }

      // Check all mandatory reviews
      const mandatoryReviews = await db.collection('doc_review_assignments').find({
        revisionId: rId,
        companyId,
        isMandatory: true
      }).toArray();

      const hasChangesRequested = mandatoryReviews.some((r: any) => r.status === 'Changes Requested');
      const allDone = mandatoryReviews.every((r: any) => r.status === 'Reviewed');

      let nextStatus = 'Under Review';
      if (hasChangesRequested || status === 'Changes Requested') {
        nextStatus = 'Changes Requested';
      } else if (allDone) {
        nextStatus = 'Pending Approval';
      }

      await db.collection('doc_revisions').updateOne(
        { _id: rId },
        { $set: { workflowStatus: nextStatus, updatedAt: now } }
      );
      await db.collection('doc_drawings').updateOne(
        { _id: dId },
        { $set: { currentStatus: nextStatus, updatedAt: now } }
      );

      await logDrawingActivity(db, companyId, {
        entityType: 'review',
        entityId: String(rId),
        action: status === 'Changes Requested' ? 'CHANGES_REQUESTED' : 'REVIEW_RECORDED',
        title: `Review Logged: ${status}`,
        description: `Reviewer ${req.user?.name || 'User'} recorded verdict [${status}]: "${comments.substring(0, 60)}".`,
        performedById: req.user?.sub,
        performedByName: req.user?.name || 'Reviewer'
      });

      return res.json({ message: 'Review recorded successfully', newStatus: nextStatus });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error recording review', error: err.message });
    }
  });

  // Approver decision (Approve / Reject / Changes Requested)
  router.post('/drawings/:id/revisions/:revId/decision', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const dId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const rId = ObjectId.isValid(req.params.revId) ? new ObjectId(req.params.revId) : req.params.revId;

      const { decision, comments } = req.body; // 'Approved' | 'Rejected' | 'Changes Requested'
      if (!decision || !['Approved', 'Rejected', 'Changes Requested'].includes(decision)) {
        return res.status(400).json({ message: "Decision must be 'Approved', 'Rejected', or 'Changes Requested'" });
      }

      const revision = await db.collection('doc_revisions').findOne({ _id: rId, drawingId: dId, companyId });
      if (!revision) return res.status(404).json({ message: 'Revision not found' });

      // Check self-approval rule
      const settings = await ensureDefaultSettings(db, companyId);
      if (!settings.allowSelfApproval && revision.uploadedById === req.user?.sub) {
        return res.status(403).json({ message: 'Self-approval is forbidden by module security policy. A different authorized approver is required.' });
      }

      const now = new Date();
      const approvalDoc = {
        _id: new ObjectId(),
        companyId,
        drawingId: dId,
        revisionId: rId,
        drawingNumber: revision.drawingNumber,
        revisionNumber: revision.revisionNumber,
        decision,
        approverId: req.user?.sub || 'usr-approver',
        approverName: req.user?.name || 'Document Approver',
        approverRole: 'Principal Document Approver',
        comments: comments || 'Decision recorded in document workflow queue.',
        decidedAt: now,
        createdAt: now
      };
      await db.collection('doc_approval_records').insertOne(approvalDoc);

      const targetStatus = decision === 'Approved' ? 'Approved' : decision === 'Rejected' ? 'Rejected' : 'Changes Requested';

      await db.collection('doc_revisions').updateOne(
        { _id: rId },
        {
          $set: {
            workflowStatus: targetStatus,
            approvedAt: decision === 'Approved' ? now : undefined,
            approvedById: decision === 'Approved' ? req.user?.sub : undefined,
            approvedByName: decision === 'Approved' ? (req.user?.name || 'Approver') : undefined,
            updatedAt: now
          }
        }
      );

      await db.collection('doc_drawings').updateOne(
        { _id: dId },
        { $set: { currentStatus: targetStatus, updatedAt: now } }
      );

      await logDrawingActivity(db, companyId, {
        entityType: 'approval',
        entityId: String(rId),
        action: `DECISION_${decision.toUpperCase().replace(/\s+/g, '_')}`,
        title: `Revision ${revision.revisionNumber} ${decision}`,
        description: `Formal decision: ${decision} by ${req.user?.name || 'Approver'}. Notes: ${comments || 'No remarks.'}`,
        drawingNumber: revision.drawingNumber,
        revisionNumber: revision.revisionNumber,
        performedById: req.user?.sub,
        performedByName: req.user?.name || 'Document Approver'
      });

      return res.json({ message: `Decision recorded: ${decision}`, status: targetStatus });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error recording approval decision', error: err.message });
    }
  });

  // Publish Approved Revision (makes authorized, superseding earlier revisions)
  router.post('/drawings/:id/revisions/:revId/publish', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id, revId } = req.params;

      const result = await publishRevisionSafely(db, companyId, id, revId, req.user || {});
      return res.json({ message: 'Revision published and prior revisions superseded.', result });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 8. DOCUMENT TRANSMITTALS
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/transmittals', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const transmittals = await db.collection('doc_transmittals').find({ companyId }).sort({ createdAt: -1 }).toArray();
      return res.json(transmittals);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching transmittals', error: err.message });
    }
  });

  router.post('/transmittals', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, purpose, issueDate, recipients, notes, items } = req.body;

      if (!projectId || !items || items.length === 0) {
        return res.status(400).json({ message: 'Project and at least one drawing revision are required for transmittal.' });
      }

      const pId = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
      const project = await db.collection('doc_projects').findOne({ _id: pId, companyId });
      if (!project) return res.status(404).json({ message: 'Project not found' });

      const transmittalNumber = await generateTransmittalNumber(db, companyId);
      const now = new Date();

      const newTransmittal = {
        _id: new ObjectId(),
        companyId,
        transmittalNumber,
        projectId: pId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        purpose: purpose || 'For Construction',
        issueDate: issueDate || now.toISOString().split('T')[0],
        issuedById: req.user?.sub || 'usr-lead',
        issuedByName: req.user?.name || req.user?.email || 'Rahul Singh',
        recipients: Array.isArray(recipients) ? recipients : [{ name: 'Site Team', organization: 'Contractor', role: 'Main Contractor' }],
        notes: notes || '',
        items: items.map((i: any) => ({
          drawingId: i.drawingId,
          drawingNumber: i.drawingNumber,
          title: i.title,
          revisionNumber: i.revisionNumber, // Exactly pinned revision!
          status: i.status || 'Approved'
        })),
        createdAt: now,
        updatedAt: now
      };

      await db.collection('doc_transmittals').insertOne(newTransmittal);

      await logDrawingActivity(db, companyId, {
        entityType: 'transmittal',
        entityId: String(newTransmittal._id),
        action: 'TRANSMITTAL_ISSUED',
        title: `Transmittal ${transmittalNumber} Issued`,
        description: `Issued transmittal [${transmittalNumber}] for ${purpose} containing ${items.length} drawings to ${newTransmittal.recipients.map((r: any) => r.name).join(', ')}.`,
        performedById: req.user?.sub,
        performedByName: req.user?.name || 'Rahul Singh'
      });

      return res.status(201).json(newTransmittal);
    } catch (err: any) {
      console.error('Error creating transmittal:', err);
      return res.status(500).json({ message: 'Error issuing transmittal', error: err.message });
    }
  });

  router.get('/transmittals/:id', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const tId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const transmittal = await db.collection('doc_transmittals').findOne({ _id: tId, companyId });
      if (!transmittal) return res.status(404).json({ message: 'Transmittal not found' });

      return res.json(transmittal);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching transmittal', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 9. AUDIT ACTIVITY LOG
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/activity', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const activities = await db.collection('doc_activity_events')
        .find({ companyId })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      return res.json(activities);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching activities', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 10. MODULE USERS & PERMISSIONS (RBAC)
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/users', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const memberships = await db.collection('doc_memberships').find({ companyId }).toArray();
      return res.json(memberships);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching module users', error: err.message });
    }
  });

  router.post('/users', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { userName, userEmail, role, assignedDisciplines } = req.body;

      if (!userName || !userEmail) {
        return res.status(400).json({ message: 'User name and email are required.' });
      }

      const now = new Date();
      const doc = {
        _id: new ObjectId(),
        companyId,
        userId: `usr-${Date.now()}`,
        userName: userName.trim(),
        userEmail: userEmail.trim().toLowerCase(),
        role: role || 'reviewer',
        assignedDisciplines: assignedDisciplines || [],
        status: 'Active',
        createdAt: now,
        updatedAt: now
      };

      await db.collection('doc_memberships').insertOne(doc);
      return res.status(201).json(doc);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error creating module user', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 11. MODULE SETTINGS
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/settings', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const settings = await ensureDefaultSettings(db, companyId);
      return res.json(settings);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching settings', error: err.message });
    }
  });

  router.put('/settings', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { numberingConvention, revisionFormat, allowSelfApproval, mandatoryReviewsRequired } = req.body;

      await db.collection('doc_settings').updateOne(
        { companyId },
        {
          $set: {
            numberingConvention: numberingConvention || '{PROJECT}-{DISCIPLINE}-{SEQ}',
            revisionFormat: revisionFormat || 'R00',
            allowSelfApproval: Boolean(allowSelfApproval),
            mandatoryReviewsRequired: Boolean(mandatoryReviewsRequired),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      const updated = await db.collection('doc_settings').findOne({ companyId });
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error updating settings', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 12. DEMO SEED ENDPOINT (NON-DESTRUCTIVE)
  // ══════════════════════════════════════════════════════════════════════════
  router.post('/seed', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const result = await seedDrawingsSampleData(db, companyId, req.user);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error seeding drawing workspace', error: err.message });
    }
  });

  return router;
}
