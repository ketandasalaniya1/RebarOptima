import { Router } from 'express';
import { Db } from 'mongodb';
import { ReportsService, buildCompanyFilter, toIdQuery } from './reports.service';
import { ReportsPdfBuilder } from './reports.pdf';
import { ReportsExcelBuilder } from './reports.excel';
import { ReportConfig, ExcelExportConfig } from './reports.types';

export function createReportsRouter(
  getDb: () => any,
  authMiddleware: any,
  logAudit?: any
): Router {
  const router = Router();

  // Helper to resolve companyId
  const resolveCompanyId = async (req: any, db: Db): Promise<string> => {
    if (req.user?.companyId) return String(req.user.companyId);
    const header = req.headers['x-company-id'];
    if (header) return String(header);

    const userId = req.user?.sub || req.user?.id;
    if (userId) {
      try {
        const u = await db.collection('users').findOne(toIdQuery(userId));
        if (u && u.companyId) return String(u.companyId);
      } catch {}
    }
    return req.user?.companyId || 'default-company';
  };

  // ─── 1. GET CONFIG OPTIONS (Projects, Blocks, Categories) ─────────────────
  router.get('/config-options', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const compFilter = buildCompanyFilter(companyId);

      const [coreProjects, pmProjects] = await Promise.all([
        db.collection('projects').find({ ...compFilter, isDeleted: { $ne: true } }).project({ name: 1, code: 1 }).toArray().catch(() => []),
        db.collection('pm_projects').find({ ...compFilter }).project({ name: 1, code: 1 }).toArray().catch(() => []),
      ]);

      // Deduplicate projects
      const projectMap = new Map<string, { id: string; name: string; code?: string }>();
      coreProjects.forEach((p: any) => {
        const id = String(p._id || p.id);
        projectMap.set(id, { id, name: p.name, code: p.code });
      });
      pmProjects.forEach((p: any) => {
        const id = String(p._id || p.id);
        if (!projectMap.has(id)) {
          projectMap.set(id, { id, name: p.name, code: p.code });
        }
      });

      // Material categories
      const categories = [
        'Electrical',
        'Plumbing',
        'Chemicals',
        'Fire Safety',
        'Tools & Hardware',
        'Finishing & Paints',
        'Safety & PPE',
        'Mechanical & Machinery',
        'Civil & Construction',
        'Other'
      ];

      return res.json({
        success: true,
        data: {
          projects: Array.from(projectMap.values()),
          categories,
          supportedModules: {
            tasksAndProgress: true,
            issues: true,
            inventory: true,
            grn: true,
            materialIssued: true,
            siteTransfer: true,
            attendance: true,
            payables: true,
            indent: false, // Flagged truthful: not yet implemented
            purchaseOrder: false, // Flagged truthful: not yet implemented
          }
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch report config options' });
    }
  });

  // ─── 2. LIVE REPORT PREVIEW (Aggregated JSON) ─────────────────────────────
  router.post('/preview', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const service = new ReportsService(db);

      const config: ReportConfig = req.body;
      if (!config.startDate || !config.endDate || !config.sections) {
        return res.status(400).json({ success: false, message: 'Invalid report configuration: startDate, endDate, and sections are required.' });
      }

      // Default projectId to X-Project-Id if not specified in filters
      const headerProjId = req.headers['x-project-id'];
      if (!config.filters) config.filters = {};
      if (!config.filters.projectId && headerProjId && headerProjId !== 'all') {
        config.filters.projectId = String(headerProjId);
      }

      const reportData = await service.getAggregatedReportData(companyId, req.user || {}, config);
      return res.json({ success: true, data: reportData });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to aggregate report data' });
    }
  });

  // ─── 3. PDF REPORT GENERATION & DOWNLOAD ─────────────────────────────────
  router.post('/pdf', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const service = new ReportsService(db);

      const config: ReportConfig = req.body;
      if (!config.startDate || !config.endDate || !config.sections) {
        return res.status(400).json({ success: false, message: 'Invalid report configuration: startDate, endDate, and sections are required.' });
      }

      const headerProjId = req.headers['x-project-id'];
      if (!config.filters) config.filters = {};
      if (!config.filters.projectId && headerProjId && headerProjId !== 'all') {
        config.filters.projectId = String(headerProjId);
      }

      const reportData = await service.getAggregatedReportData(companyId, req.user || {}, config);
      const pdfBuffer = await ReportsPdfBuilder.generate(reportData);

      const filename = `RebarOptima_Report_${config.reportMode}_${config.startDate}_to_${config.endDate}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      if (logAudit) {
        try {
          await logAudit({
            action: 'REPORT_PDF_EXPORT',
            companyId,
            userId: req.user?.sub || req.user?.id,
            details: { filename, reportMode: config.reportMode, startDate: config.startDate, endDate: config.endDate },
          });
        } catch {}
      }

      return res.send(pdfBuffer);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to generate PDF report' });
    }
  });

  // ─── 4. EXCEL EXTRACT WORKBOOK EXPORT ─────────────────────────────────────
  router.post('/excel', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const service = new ReportsService(db);

      const config: ExcelExportConfig = req.body;
      if (!config.extractType) {
        return res.status(400).json({ success: false, message: 'extractType is required for Excel export.' });
      }

      const headerProjId = req.headers['x-project-id'];
      if (!config.projectId && headerProjId && headerProjId !== 'all') {
        config.projectId = String(headerProjId);
      }

      let projectName = 'All Projects';
      if (config.projectId && config.projectId !== 'all') {
        const proj = await db.collection('projects').findOne({ ...buildCompanyFilter(companyId), ...toIdQuery(config.projectId) })
          || await db.collection('pm_projects').findOne({ ...buildCompanyFilter(companyId), ...toIdQuery(config.projectId) });
        if (proj) projectName = proj.name || projectName;
      }

      const extractResult = await service.getExcelExtractData(companyId, config);

      const excelBuffer = await ReportsExcelBuilder.generateExtractWorkbook({
        title: extractResult.title,
        sheetName: extractResult.sheetName,
        projectName,
        startDate: config.startDate,
        endDate: config.endDate,
        extractedBy: req.user?.name || 'Authorized User',
        rows: extractResult.rows,
      });

      const cleanType = config.extractType.replace(/_/g, '-');
      const filename = `RebarOptima_Export_${cleanType}_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      if (logAudit) {
        try {
          await logAudit({
            action: 'REPORT_EXCEL_EXPORT',
            companyId,
            userId: req.user?.sub || req.user?.id,
            details: { filename, extractType: config.extractType, rowCount: extractResult.rows.length },
          });
        } catch {}
      }

      return res.send(excelBuffer);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to export Excel workbook' });
    }
  });

  return router;
}
