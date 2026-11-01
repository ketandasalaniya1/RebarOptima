import { Router } from 'express';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import zlib from 'zlib';
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
import {
  resolveUserAndCompany,
  listAccessibleGlobalProjects,
  resolveCanonicalProjectId
} from '../projects/module-project-adapter';
import { projectIdQuery } from '../projects/project-access';

export async function convertDwgToDxfGz(fileDataOrB64: string): Promise<{ dxfDataGz: Buffer; dxfSizeBytes: number } | null> {
  if (!fileDataOrB64) return null;
  const tmpDir = path.join('/tmp', `rebar_cad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    const inDwg = path.join(tmpDir, 'input.dwg');
    const outDxf = path.join(tmpDir, 'output.dxf');

    let buf: Buffer;
    if (fileDataOrB64.startsWith('data:')) {
      const b64 = fileDataOrB64.split(',')[1];
      buf = Buffer.from(b64, 'base64');
    } else {
      buf = Buffer.from(fileDataOrB64, 'base64');
    }
    fs.writeFileSync(inDwg, buf);

    const bin = fs.existsSync('/opt/homebrew/bin/dwg2dxf')
      ? '/opt/homebrew/bin/dwg2dxf'
      : (fs.existsSync('/usr/local/bin/dwg2dxf') ? '/usr/local/bin/dwg2dxf' : (fs.existsSync('/usr/bin/dwg2dxf') ? '/usr/bin/dwg2dxf' : 'dwg2dxf'));

    execSync(`${bin} --as r2013 -o "${outDxf}" -y "${inDwg}" 2>&1`, { timeout: 45000 });
    if (fs.existsSync(outDxf)) {
      const dxfRaw = fs.readFileSync(outDxf);
      const dxfGz = zlib.gzipSync(dxfRaw);
      return { dxfDataGz: dxfGz, dxfSizeBytes: dxfRaw.length };
    }
  } catch (err: any) {
    console.warn('[Drawings] DWG to DXF conversion warning:', err?.message || err);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
  }
  return null;
}

export function createDrawingsMasterRouter(getDb: () => any, authMiddleware: any, logAudit?: any) {
  const router = Router();

  // Helper to extract companyId safely
  async function resolveCompanyId(req: any, db: any): Promise<any> {
    const ctx = await resolveUserAndCompany(req, db);
    const companyId = ctx.companyId;
    if (companyId && ObjectId.isValid(companyId)) {
      return new ObjectId(companyId);
    }
    return companyId || 'default-company';
  }

  // Helper to extract real user name safely
  async function resolveUserName(req: any, db: any): Promise<string> {
    if (req.user?.name) return req.user.name;
    if (req.user?.sub && ObjectId.isValid(req.user.sub)) {
      try {
        const u = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
        if (u) {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          if (fullName) return fullName;
          if (u.name) return u.name;
        }
      } catch (_) {}
    }
    return req.user?.email || 'Admin';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. DASHBOARD & KPIS
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/dashboard', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = await resolveCompanyId(req, db);

      // Auto-ensure default disciplines & settings on dashboard hit
      await ensureDefaultDisciplines(db, companyId);
      await ensureDefaultSettings(db, companyId);

      const [projects, drawings, disciplines, recentActivity, transmittalsCount] = await Promise.all([
        listAccessibleGlobalProjects(db, ctx).catch(() => db.collection('doc_projects').find({ companyId }).toArray()),
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
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = await resolveCompanyId(req, db);

      let projects: any[] = [];
      try {
        projects = (await listAccessibleGlobalProjects(db, ctx)) || [];
      } catch (_) {
        projects = [];
      }
      if (!projects || projects.length === 0) {
        projects = (await db.collection('doc_projects').find({ companyId }).toArray().catch(() => [])) || [];
      }
      const drawings = (await db.collection('doc_drawings').find({ companyId }).toArray().catch(() => [])) || [];

      const projectsWithStats = (projects || []).map((p: any) => {
        const pId = String(p._id || p.id);
        const pDrawings = drawings.filter((d: any) => String(d.projectId) === pId);
        return {
          ...p,
          projectName: p.name || p.projectName,
          projectCode: p.code || p.projectCode || '',
          drawingCount: pDrawings.length,
          underReviewCount: pDrawings.filter((d: any) => d.currentStatus === 'Under Review').length,
          approvedCount: pDrawings.filter((d: any) => d.currentStatus === 'Approved').length
        };
      });

      return res.json(projectsWithStats);
    } catch (err: any) {
      return res.status(err.status || 500).json({ message: 'Error fetching projects', error: err.message });
    }
  });

  router.post('/projects', authMiddleware, async (_req: any, res) => {
    return res.status(400).json({
      message: 'Create projects via Company Projects (POST /api/projects).',
      code: 'USE_GLOBAL_PROJECTS',
    });
  });

  router.post('/projects/_legacy_disabled', authMiddleware, async (req: any, res) => {
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
  // 3.5 BLOCKS & MATRIX
  // ══════════════════════════════════════════════════════════════════════════
  router.get(['/blocks', '/drawings/blocks'], authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId } = req.query;

      let blocks: any[] = [];
      if (projectId && projectId !== 'all') {
        const pStr = String(projectId);
        const crmBlocks = await db.collection('crm_blocks').find({
          companyId,
          $or: [
            { projectId: ObjectId.isValid(pStr) && pStr.length === 24 ? new ObjectId(pStr) : pStr },
            { projectId: pStr }
          ]
        }).toArray();
        if (crmBlocks.length > 0) {
          blocks = crmBlocks.map((b: any) => ({
            _id: String(b._id),
            name: b.blockName || b.name || 'Block A',
            code: b.prefix || 'BLK'
          }));
        }
      }
      if (blocks.length === 0) {
        blocks = [
          { _id: 'blk-a', name: 'Block A', code: 'A' },
          { _id: 'blk-b', name: 'Block B', code: 'B' },
          { _id: 'blk-t1', name: 'Tower 1', code: 'T1' }
        ];
      }
      return res.json(blocks);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching blocks', error: err.message });
    }
  });

  router.get(['/matrix', '/drawings/matrix'], authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, blockId, disciplineId } = req.query;

      const query: any = { companyId };
      if (projectId && projectId !== 'all') {
        const pStr = String(projectId);
        query.$or = [
          { projectId: ObjectId.isValid(pStr) && pStr.length === 24 ? new ObjectId(pStr) : pStr },
          { projectId: pStr }
        ];
      }
      if (disciplineId && disciplineId !== 'all') {
        if (ObjectId.isValid(disciplineId)) {
          query.disciplineId = new ObjectId(disciplineId);
        } else {
          query.disciplineCode = String(disciplineId).toUpperCase();
        }
      }
      if (blockId && blockId !== 'all') {
        query.blockName = { $regex: String(blockId), $options: 'i' };
      }

      const drawings = await db.collection('doc_drawings').find(query).toArray();
      const standardLevels = ['B2', 'B1', 'G', 'L1', 'L2', 'L3', 'L4', 'L5', 'Terrace', 'General'];

      const seriesMap = new Map<string, any>();

      for (const dw of drawings) {
        const rawTitle = dw.title || 'Drawing';
        const baseTitle = rawTitle.replace(/\s*-\s*Level\s*\d+/i, '').replace(/\s*-\s*L\d+/i, '').trim();
        const baseNo = dw.drawingNumber ? dw.drawingNumber.replace(/-L\d+-/i, '-') : 'DWG';
        const groupKey = `${dw.disciplineCode || 'GEN'}_${baseTitle.toLowerCase()}`;

        if (!seriesMap.has(groupKey)) {
          seriesMap.set(groupKey, {
            drawingNumber: baseNo,
            title: baseTitle,
            disciplineCode: dw.disciplineCode || 'ARCH',
            cells: {}
          });
        }

        const series = seriesMap.get(groupKey);
        let dwLevel = (dw.level || 'L1').trim();
        const matchedLevel = standardLevels.find(sl => sl.toLowerCase() === dwLevel.toLowerCase()) || dwLevel;
        series.cells[matchedLevel] = {
          _id: String(dw._id),
          drawingNumber: dw.drawingNumber,
          title: dw.title,
          status: dw.currentStatus || 'Draft',
          version: dw.currentRevisionNumber || 'v1',
          fileType: dw.fileType || 'dwg'
        };
      }

      const rows = Array.from(seriesMap.values());

      return res.json({
        levels: standardLevels,
        rows
      });
    } catch (err: any) {
      console.error('Error fetching drawing matrix:', err);
      return res.status(500).json({ message: 'Error fetching drawing matrix', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. DRAWING REGISTER
  // ══════════════════════════════════════════════════════════════════════════
  router.get(['/drawings', '/'], authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const { projectId, blockId, block, disciplineId, level, status, search, page = '1', limit = '50' } = req.query;

      const query: any = { companyId };
      if (projectId && projectId !== 'all') {
        const pStr = String(projectId);
        query.$or = [
          { projectId: ObjectId.isValid(pStr) && pStr.length === 24 ? new ObjectId(pStr) : pStr },
          { projectId: pStr }
        ];
      }
      if (disciplineId && disciplineId !== 'all') {
        if (ObjectId.isValid(disciplineId)) {
          query.disciplineId = new ObjectId(disciplineId);
        } else {
          query.disciplineCode = disciplineId;
        }
      }
      const bVal = blockId || block;
      if (bVal && bVal !== 'all') {
        query.blockName = { $regex: String(bVal), $options: 'i' };
      }
      if (level && level !== 'all') {
        query.level = { $regex: `^${String(level)}$`, $options: 'i' };
      }
      if (status && status !== 'all') {
        const s = String(status).toUpperCase();
        if (s === 'IN_REVIEW' || s === 'UNDER REVIEW') {
          query.currentStatus = { $in: ['Under Review', 'IN_REVIEW', 'Pending Approval', 'Review'] };
        } else if (s === 'CURRENT' || s === 'APPROVED') {
          query.currentStatus = { $in: ['Approved', 'Current', 'CURRENT'] };
        } else if (s === 'REJECTED') {
          query.currentStatus = { $in: ['Rejected', 'REJECTED'] };
        } else {
          query.currentStatus = status;
        }
      }
      if (search && String(search).trim()) {
        const term = String(search).trim();
        const searchOr = [
          { drawingNumber: { $regex: term, $options: 'i' } },
          { title: { $regex: term, $options: 'i' } },
          { projectName: { $regex: term, $options: 'i' } },
          { disciplineName: { $regex: term, $options: 'i' } }
        ];
        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: searchOr }];
          delete query.$or;
        } else {
          query.$or = searchOr;
        }
      }

      const p = Math.max(1, parseInt(String(page), 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));

      const [drawings, total] = await Promise.all([
        db.collection('doc_drawings').find(query).sort({ updatedAt: -1 }).skip((p - 1) * l).limit(l).toArray(),
        db.collection('doc_drawings').countDocuments(query)
      ]);

      // Ensure fileType, fileName & fileData are populated for all drawings in register
      const enrichedDrawings = await Promise.all(drawings.map(async (dw: any) => {
        if ((!dw.fileType || !dw.fileData) && dw.currentRevisionId) {
          const rev = await db.collection('doc_revisions').findOne({ _id: dw.currentRevisionId });
          if (rev) {
            if (!dw.fileType) dw.fileType = rev.fileType;
            if (!dw.fileName) dw.fileName = rev.fileName;
            if (!dw.fileSize) dw.fileSize = rev.fileSize;
            if (!dw.fileData && rev.fileData) dw.fileData = rev.fileData;
          }
        }
        return dw;
      }));

      return res.json({
        drawings: enrichedDrawings,
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

  router.post(['/drawings', '/'], authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = await resolveCompanyId(req, db);
      const {
        projectId,
        blockId,
        blockName,
        disciplineId,
        drawingNumber,
        title,
        level,
        description,
        drawingType,
        tags,
        initialChangeDescription,
        fileData,
        fileName,
        fileSize,
        fileType
      } = req.body;

      if (!projectId || !title) {
        return res.status(400).json({ message: 'Project and drawing title are required.' });
      }

      // 1. Resolve Project (check global projects first, fallback to legacy doc_projects)
      let project: any = null;
      try {
        const canonical = await resolveCanonicalProjectId(db, ctx, String(projectId));
        project = canonical.project;
      } catch (_) { }

      if (!project) {
        project = await db.collection('projects').findOne(projectIdQuery(String(projectId), companyId))
          || await db.collection('projects').findOne(projectIdQuery(String(projectId)))
          || await db.collection('doc_projects').findOne({
            $or: [
              ObjectId.isValid(projectId) && String(projectId).length === 24 ? { _id: new ObjectId(projectId) } : null,
              { _id: String(projectId) }
            ].filter(Boolean)
          });
      }

      if (!project) return res.status(404).json({ message: 'Project not found' });

      const pId = project._id || (ObjectId.isValid(projectId) && String(projectId).length === 24 ? new ObjectId(projectId) : projectId);
      const projectCode = String(project.code || project.projectCode || project.name?.substring(0, 3) || 'PRJ').toUpperCase().trim();
      const projectName = project.name || project.projectName || 'Project';

      // 2. Resolve Discipline (with safe defaults)
      let discipline: any = null;
      if (disciplineId) {
        discipline = await db.collection('doc_disciplines').findOne({
          companyId,
          $or: [
            ObjectId.isValid(disciplineId) && String(disciplineId).length === 24 ? { _id: new ObjectId(disciplineId) } : null,
            { _id: String(disciplineId) },
            { code: String(disciplineId).toUpperCase() }
          ].filter(Boolean)
        });
      }

      if (!discipline) {
        await ensureDefaultDisciplines(db, companyId);
        discipline = await db.collection('doc_disciplines').findOne({ companyId, isDefault: true })
          || await db.collection('doc_disciplines').findOne({ companyId });
      }

      if (!discipline) {
        discipline = {
          _id: new ObjectId(),
          code: 'STR',
          name: 'Structural',
          color: '#10b981'
        };
      }
      const dId = discipline._id;

      // 3. Generate or validate drawing number
      let dwNumber = drawingNumber?.trim();
      if (!dwNumber) {
        dwNumber = await generateDrawingNumber(db, companyId, projectCode, discipline.code, drawingType || 'Drawing');
      }

      // Check unique drawing number within project
      const exists = await db.collection('doc_drawings').findOne({
        companyId,
        $or: [
          { projectId: pId },
          { projectId: String(pId) },
          { projectId: String(projectId) }
        ],
        drawingNumber: dwNumber
      });
      if (exists) {
        if (!drawingNumber?.trim()) {
          dwNumber = `${dwNumber}-${Date.now().toString().slice(-4)}`;
        } else {
          return res.status(400).json({ message: `Drawing number '${dwNumber}' already exists in this project.` });
        }
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
        let dxfDataGz: Buffer | null = null;
        let dxfSizeBytes = 0;
        if (fType === 'dwg' || fileName?.toLowerCase().endsWith('.dwg')) {
          const conv = await convertDwgToDxfGz(fileData);
          if (conv) {
            dxfDataGz = conv.dxfDataGz;
            dxfSizeBytes = conv.dxfSizeBytes;
          }
        }

        await db.collection('doc_files').insertOne({
          _id: fileRecordId,
          companyId,
          originalFilename: fileName || `${dwNumber}_${revisionNumber}.${fType}`,
          fileData,
          dxfDataGz: dxfDataGz || undefined,
          dxfSizeBytes: dxfSizeBytes || undefined,
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
        projectCode,
        projectName,
        blockId: blockId ? String(blockId) : undefined,
        blockName: blockName || 'Block A',
        disciplineId: dId,
        disciplineCode: discipline.code,
        disciplineName: discipline.name,
        drawingNumber: dwNumber,
        title: title.trim(),
        level: level ? String(level).toUpperCase() : 'L1',
        description: description || '',
        drawingType: drawingType || 'General Arrangement',
        currentRevisionId: revId,
        currentRevisionNumber: revisionNumber,
        fileName: fileName || `${dwNumber}_${revisionNumber}.${fType}`,
        fileType: fType,
        fileSize: fSize,
        fileData: fileData || '',
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
      const dId = ObjectId.isValid(req.params.id) && String(req.params.id).length === 24 ? new ObjectId(req.params.id) : req.params.id;

      const drawing = await db.collection('doc_drawings').findOne({
        companyId,
        $or: [
          ObjectId.isValid(req.params.id) && String(req.params.id).length === 24 ? { _id: new ObjectId(req.params.id) } : null,
          { _id: String(req.params.id) }
        ].filter(Boolean)
      });
      if (!drawing) {
        return res.status(404).json({ message: 'Drawing not found' });
      }

      // Fetch revisions, reviews, approvals, transmittals, activity
      const [revisions, reviews, approvals, transmittals, activities] = await Promise.all([
        db.collection('doc_revisions').find({
          companyId,
          $or: [
            ObjectId.isValid(drawing._id) && String(drawing._id).length === 24 ? { drawingId: new ObjectId(drawing._id) } : null,
            { drawingId: String(drawing._id) },
            { drawingId: dId }
          ].filter(Boolean)
        }).sort({ sequenceNumber: -1 }).toArray(),
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

      if (currentRev) {
        if (!drawing.fileData && currentRev.fileData) drawing.fileData = currentRev.fileData;
        if (!drawing.fileType && currentRev.fileType) drawing.fileType = currentRev.fileType;
        if (!drawing.fileName && currentRev.fileName) drawing.fileName = currentRev.fileName;
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

  // ── GET /drawings/:id/dxf (Stream converted DXF as binary gzip) ───────
  router.get(['/drawings/:id/dxf', '/:id/dxf'], authMiddleware, async (req: any, res) => {
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

      let dxfGz: Buffer | null = null;
      if (revision.fileId) {
        const fileDoc = await db.collection('doc_files').findOne({ _id: new ObjectId(revision.fileId) });
        if (fileDoc?.dxfDataGz) {
          dxfGz = fileDoc.dxfDataGz.buffer ? Buffer.from(fileDoc.dxfDataGz.buffer) : Buffer.from(fileDoc.dxfDataGz);
        } else if (fileDoc?.fileData && (revision.fileType === 'dwg' || revision.fileName?.toLowerCase().endsWith('.dwg'))) {
          // On-demand DWG -> DXF conversion fallback
          const conv = await convertDwgToDxfGz(fileDoc.fileData);
          if (conv) {
            dxfGz = conv.dxfDataGz;
            await db.collection('doc_files').updateOne(
              { _id: fileDoc._id },
              { $set: { dxfDataGz: conv.dxfDataGz, dxfSizeBytes: conv.dxfSizeBytes } }
            );
          }
        }
      }

      if (!dxfGz && revision.fileData && (revision.fileType === 'dwg' || revision.fileName?.toLowerCase().endsWith('.dwg'))) {
        const conv = await convertDwgToDxfGz(revision.fileData);
        if (conv) dxfGz = conv.dxfDataGz;
      }

      if (!dxfGz) {
        return res.status(404).json({ message: 'DXF converted file not found for this drawing' });
      }

      res.setHeader('Content-Type', 'application/dxf');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Disposition', `inline; filename="${(revision.fileName || 'drawing').replace(/\.dwg$/i, '.dxf')}"`);
      return res.send(dxfGz);
    } catch (err: any) {
      return res.status(500).json({ message: 'Error retrieving DXF', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 6. REVISION CONTROL & UPLOAD
  // ══════════════════════════════════════════════════════════════════════════
  router.get(['/check-duplicate', '/drawings/check-duplicate'], authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { hash } = req.query;

      if (!hash) {
        return res.json({ isDuplicate: false });
      }

      const matchRev = await db.collection('doc_revisions').findOne({
        companyId,
        checksumSha256: String(hash)
      });

      if (matchRev) {
        const revNum = matchRev.revisionNumber ? `v${matchRev.revisionNumber.replace(/^R0*/i, '') || '1'}` : 'v1';
        return res.json({
          isDuplicate: true,
          existingVersion: {
            revisionNumber: matchRev.revisionNumber,
            version: revNum,
            drawingNumber: matchRev.drawingNumber,
            uploadedByName: matchRev.uploadedByName || 'Rahul Singh',
            uploadedAt: matchRev.uploadedAt || matchRev.createdAt
          }
        });
      }

      return res.json({ isDuplicate: false });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error checking duplicate', error: err.message });
    }
  });

  router.post(['/drawings/:id/revisions', '/:id/revisions'], authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const dId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

      const drawing = await db.collection('doc_drawings').findOne({ _id: dId, companyId });
      if (!drawing) {
        return res.status(404).json({ message: 'Drawing not found' });
      }

      const {
        changeDescription,
        changeReason,
        reason,
        purpose,
        submitForApproval = true,
        checksumSha256,
        fileData,
        fileName,
        fileSize,
        fileType
      } = req.body;

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
      const checksum = checksumSha256 || calculateFileChecksum(fileData || `${drawing.drawingNumber}-${revisionNumber}`);
      const targetStatus = submitForApproval ? 'Under Review' : 'Draft';

      const detectedExt = fileName ? fileName.split('.').pop()?.toLowerCase() : 'pdf';
      const rType = fileType || detectedExt || 'pdf';
      const rSize = fileSize || (fileData ? Math.round(fileData.length * 0.75) : 1024 * 340);

      let fileRecordId: ObjectId | null = null;
      if (fileData) {
        fileRecordId = new ObjectId();
        let dxfDataGz: Buffer | null = null;
        let dxfSizeBytes = 0;
        if (rType === 'dwg' || fileName?.toLowerCase().endsWith('.dwg')) {
          const conv = await convertDwgToDxfGz(fileData);
          if (conv) {
            dxfDataGz = conv.dxfDataGz;
            dxfSizeBytes = conv.dxfSizeBytes;
          }
        }

        await db.collection('doc_files').insertOne({
          _id: fileRecordId,
          companyId,
          originalFilename: fileName || `${drawing.drawingNumber}_${revisionNumber}.${rType}`,
          fileData,
          dxfDataGz: dxfDataGz || undefined,
          dxfSizeBytes: dxfSizeBytes || undefined,
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
        reason: reason || changeReason || 'CLIENT_REQUEST',
        purpose: purpose || 'FOR_APPROVAL',
        workflowStatus: targetStatus,
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
            currentStatus: targetStatus,
            fileName: fileName || `${drawing.drawingNumber}_${revisionNumber}.${rType}`,
            fileType: rType,
            fileSize: rSize,
            fileData: fileData || '',
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
  router.post(['/drawings/:id/revisions/:revId/decision', '/:id/revisions/:revId/decision'], authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const realUserName = await resolveUserName(req, db);
      const dId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
      const rawRevId = req.params.revId;
      let rId = ObjectId.isValid(rawRevId) ? new ObjectId(rawRevId) : rawRevId;

      const { decision, comments } = req.body; // 'Approved' | 'Rejected' | 'Changes Requested'
      if (!decision || !['Approved', 'Rejected', 'Changes Requested'].includes(decision)) {
        return res.status(400).json({ message: "Decision must be 'Approved', 'Rejected', or 'Changes Requested'" });
      }

      let revision = await db.collection('doc_revisions').findOne({ _id: rId });
      if (!revision && dId) {
        revision = await db.collection('doc_revisions').findOne({
          $or: [
            { drawingId: dId },
            { drawingId: String(dId) }
          ]
        });
      }
      if (!revision) {
        const drawingDoc = await db.collection('doc_drawings').findOne({
          $or: [
            { _id: dId },
            { _id: String(dId) }
          ]
        });
        if (drawingDoc?.currentRevisionId) {
          const revOid = ObjectId.isValid(drawingDoc.currentRevisionId) ? new ObjectId(drawingDoc.currentRevisionId) : drawingDoc.currentRevisionId;
          revision = await db.collection('doc_revisions').findOne({ _id: revOid })
            || await db.collection('doc_revisions').findOne({ _id: String(revOid) });
        }
      }
      if (!revision) return res.status(404).json({ message: 'Revision not found' });
      rId = revision._id;

      // Check self-approval rule (exempt admin/developer for testing)
      const userRole = String(req.user?.role || '').toLowerCase();
      const isSuper = req.user?.accountType === 'developer' || userRole === 'admin' || userRole.includes('admin') || userRole.includes('owner') || userRole.includes('manager');
      const compId = revision.companyId || companyId;
      const settings = await ensureDefaultSettings(db, compId);
      if (!isSuper && !settings.allowSelfApproval && revision.uploadedById === req.user?.sub) {
        return res.status(403).json({ message: 'Self-approval is forbidden by module security policy. A different authorized approver is required.' });
      }

      const now = new Date();
      const approverName = req.user?.name || realUserName || req.user?.email || 'Document Approver';
      const approvalDoc = {
        _id: new ObjectId(),
        companyId: compId,
        drawingId: revision.drawingId || dId,
        revisionId: rId,
        drawingNumber: revision.drawingNumber,
        revisionNumber: revision.revisionNumber,
        decision,
        approverId: req.user?.sub || 'usr-approver',
        approverName,
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
            approvedByName: decision === 'Approved' ? approverName : undefined,
            updatedAt: now
          }
        }
      );

      await db.collection('doc_drawings').updateOne(
        {
          $or: [
            { _id: dId },
            { _id: String(dId) }
          ]
        },
        { $set: { currentStatus: targetStatus, updatedAt: now } }
      );

      await logDrawingActivity(db, compId, {
        entityType: 'approval',
        entityId: String(rId),
        action: `DECISION_${decision.toUpperCase().replace(/\s+/g, '_')}`,
        title: `Revision ${revision.revisionNumber} ${decision}`,
        description: `Formal decision: ${decision} by ${approverName}. Notes: ${comments || 'No remarks.'}`,
        drawingNumber: revision.drawingNumber,
        revisionNumber: revision.revisionNumber,
        performedById: req.user?.sub,
        performedByName: approverName
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
      const ctx = await resolveUserAndCompany(req, db);
      const companyId = await resolveCompanyId(req, db);
      const { projectId, purpose, issueDate, recipients, notes, items } = req.body;

      if (!projectId || !items || items.length === 0) {
        return res.status(400).json({ message: 'Project and at least one drawing revision are required for transmittal.' });
      }

      let project: any = null;
      try {
        const canonical = await resolveCanonicalProjectId(db, ctx, String(projectId));
        project = canonical.project;
      } catch (_) { }
      if (!project) {
        project = await db.collection('projects').findOne(projectIdQuery(String(projectId), companyId))
          || await db.collection('projects').findOne(projectIdQuery(String(projectId)))
          || await db.collection('doc_projects').findOne({
            $or: [
              ObjectId.isValid(projectId) && String(projectId).length === 24 ? { _id: new ObjectId(projectId) } : null,
              { _id: String(projectId) }
            ].filter(Boolean)
          });
      }
      if (!project) return res.status(404).json({ message: 'Project not found' });

      const pId = project._id || (ObjectId.isValid(projectId) && String(projectId).length === 24 ? new ObjectId(projectId) : projectId);
      const projectCode = String(project.code || project.projectCode || project.name?.substring(0, 3) || 'PRJ').toUpperCase().trim();
      const projectName = project.name || project.projectName || 'Project';

      const transmittalNumber = await generateTransmittalNumber(db, companyId);
      const now = new Date();

      const newTransmittal = {
        _id: new ObjectId(),
        companyId,
        transmittalNumber,
        projectId: pId,
        projectCode,
        projectName,
        purpose: purpose || 'For Construction',
        issueDate: issueDate || now.toISOString().split('T')[0],
        issuedById: req.user?.sub || 'usr-lead',
        issuedByName: req.user?.name || req.user?.email || 'Rahul Singh',
        recipients: (Array.isArray(recipients) && recipients.length > 0 ? recipients : [
          { email: 'john@abcconstruction.com', name: 'John Doe', organization: 'Client - ABC Constructions', type: 'External' },
          { email: 'ravi@rebaroptima.com', name: 'Ravi Shah', organization: 'Structural Team', type: 'Internal' },
          { email: 'neha@rebaroptima.com', name: 'Neha Patel', organization: 'Internal PM', type: 'Internal' }
        ]).map((r: any) => ({
          ...r,
          token: r.token || Math.random().toString(36).slice(2) + Date.now().toString(36),
          type: r.type || (r.email?.includes('@rebaroptima.com') ? 'Internal' : 'External'),
          status: r.status || 'SENT',
          sentAt: now,
          viewedAt: r.viewedAt || undefined,
          acknowledgedAt: r.acknowledgedAt || undefined
        })),
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

  // Public recipient access (no auth middleware)
  router.get(['/public/t/:token', '/t/:token'], async (req: any, res) => {
    try {
      const db = getDb();
      const token = String(req.params.token).trim();

      const transmittal = await db.collection('doc_transmittals').findOne({
        'recipients.token': token
      });
      if (!transmittal) return res.status(404).json({ message: 'Transmittal not found or invalid link' });

      const rec = transmittal.recipients?.find((r: any) => r.token === token);
      if (rec && rec.status === 'SENT') {
        const now = new Date();
        await db.collection('doc_transmittals').updateOne(
          { _id: transmittal._id, 'recipients.token': token },
          {
            $set: {
              'recipients.$.status': 'VIEWED',
              'recipients.$.viewedAt': now,
              updatedAt: now
            }
          }
        );
        rec.status = 'VIEWED';
        rec.viewedAt = now;
      }

      return res.json({ transmittal, recipient: rec });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error retrieving transmittal', error: err.message });
    }
  });

  router.post(['/public/t/:token/acknowledge', '/t/:token/acknowledge'], async (req: any, res) => {
    try {
      const db = getDb();
      const token = String(req.params.token).trim();

      const transmittal = await db.collection('doc_transmittals').findOne({
        'recipients.token': token
      });
      if (!transmittal) return res.status(404).json({ message: 'Transmittal not found' });

      const now = new Date();
      await db.collection('doc_transmittals').updateOne(
        { _id: transmittal._id, 'recipients.token': token },
        {
          $set: {
            'recipients.$.status': 'ACKNOWLEDGED',
            'recipients.$.acknowledgedAt': now,
            updatedAt: now
          }
        }
      );

      const rec = transmittal.recipients?.find((r: any) => r.token === token);
      await logDrawingActivity(db, transmittal.companyId, {
        entityType: 'transmittal',
        entityId: String(transmittal._id),
        action: 'TRANSMITTAL_ACKNOWLEDGED',
        title: `Transmittal ${transmittal.transmittalNumber} Acknowledged`,
        description: `Receipt acknowledged by recipient ${rec?.email || rec?.name || 'External Contact'}.`,
        performedById: 'public-recipient',
        performedByName: rec?.name || rec?.email || 'Recipient'
      });

      return res.json({ message: 'Receipt acknowledged successfully', acknowledgedAt: now });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error acknowledging receipt', error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 9. AUDIT ACTIVITY LOG
  // ══════════════════════════════════════════════════════════════════════════
  router.get('/activity', authMiddleware, async (req: any, res) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { action, entityId, limit = '200' } = req.query;

      const query: any = { companyId };
      if (action && action !== 'all') {
        query.action = { $regex: String(action), $options: 'i' };
      }
      if (entityId) {
        query.entityId = String(entityId);
      }

      const activities = await db.collection('doc_activity_events')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(Math.min(500, parseInt(String(limit), 10) || 200))
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
