import { Db, ObjectId } from 'mongodb';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import {
  ActivityDoc,
  ActivityDailyUpdateDoc,
  ActivityReportItem,
  ActivityWeightagePeriod,
} from './activity-tracker.types';

export class ActivityReportsService {
  /**
   * Computes the day before a given YYYY-MM-DD date string
   */
  static getDayBefore(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
  }

  /**
   * Finds the weightage period effective for a specific date
   */
  static getEffectiveWeightage(
    weightageHistory: ActivityWeightagePeriod[] | undefined,
    dateStr: string,
  ): ActivityWeightagePeriod | null {
    if (!weightageHistory || weightageHistory.length === 0) return null;
    // Find version where effectiveFrom <= dateStr and (effectiveTo is null or effectiveTo >= dateStr)
    const match = weightageHistory.find((w) => {
      const fromOk = w.effectiveFrom <= dateStr;
      const toOk = !w.effectiveTo || w.effectiveTo >= dateStr;
      return fromOk && toOk;
    });
    return match || weightageHistory[weightageHistory.length - 1]; // Fallback to latest
  }

  /**
   * Core mathematical aggregation engine for Activity Progress Reports
   */
  static async aggregateReportData(params: {
    db: Db;
    companyId: string;
    projectId: string;
    blockId?: string;
    floorId?: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    reportType?: string; // DPR, WPR, MPR, YPR, Custom
  }): Promise<{
    metadata: {
      reportType: string;
      startDate: string;
      endDate: string;
      dayBeforeStart: string;
      projectName: string;
      blockName: string;
      companyName?: string;
      generatedAt: string;
    };
    summary: {
      totalActivities: number;
      completedCount: number;
      inProgressCount: number;
      notStartedCount: number;
      overdueCount: number;
      delayedCount: number;
      averagePeriodProgress: number;
    };
    items: ActivityReportItem[];
  }> {
    const { db, companyId, projectId, blockId, floorId, startDate, endDate, reportType = 'Custom' } = params;

    const cMatcher =
      ObjectId.isValid(companyId) && companyId.length === 24
        ? { $in: [companyId, new ObjectId(companyId)] }
        : companyId;
    const pMatcher =
      ObjectId.isValid(projectId) && projectId.length === 24
        ? { $in: [projectId, new ObjectId(projectId)] }
        : projectId;

    // Load Project & Block metadata
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) }).catch(() => null);
    let blockName = 'All Blocks';
    if (blockId && blockId !== 'ALL') {
      const bQuery: any = {
        _id: ObjectId.isValid(blockId) && blockId.length === 24 ? new ObjectId(blockId) : blockId,
      };
      const block = await db.collection('project_blocks').findOne(bQuery).catch(() => null);
      if (block) blockName = block.name || blockName;
    }

    // Build Activity Filter
    const actFilter: any = {
      companyId: cMatcher,
      projectId: pMatcher,
      isArchived: { $ne: true },
    };
    if (blockId && blockId !== 'ALL') {
      actFilter.blockId = ObjectId.isValid(blockId) && blockId.length === 24 ? new ObjectId(blockId) : blockId;
    }
    if (floorId && floorId !== 'ALL') {
      actFilter.floorId = ObjectId.isValid(floorId) && floorId.length === 24 ? new ObjectId(floorId) : floorId;
    }

    const activities: ActivityDoc[] = (await db
      .collection('activities')
      .find(actFilter)
      .sort({ parentActivityId: 1, plannedStartDate: 1, createdAt: 1 })
      .toArray()) as any;

    const dayBeforeStart = ActivityReportsService.getDayBefore(startDate);
    const todayStr = new Date().toISOString().split('T')[0];

    // Load all floors and blocks for name enrichment
    const blockDocs = await db.collection('project_blocks').find({ companyId: cMatcher, projectId: pMatcher }).toArray().catch(() => []);
    const floorDocs = await db.collection('project_floors').find({ companyId: cMatcher, projectId: pMatcher }).toArray().catch(() => []);
    const blockMap = new Map<string, string>();
    const floorMap = new Map<string, string>();
    blockDocs.forEach((b: any) => blockMap.set(String(b._id), b.name));
    floorDocs.forEach((f: any) => floorMap.set(String(f._id), f.name));

    // Map parent activity names
    const activityMap = new Map<string, ActivityDoc>();
    activities.forEach((a) => activityMap.set(String(a._id), a));

    // Load Daily Updates on or before endDate
    const actIds = activities.map((a) => a._id);
    const updates: ActivityDailyUpdateDoc[] = (await db
      .collection('activity_daily_updates')
      .find({
        activityId: { $in: actIds },
        updateDate: { $lte: endDate },
      })
      .sort({ updateDate: 1, createdAt: 1 })
      .toArray()) as any;

    // Group updates by activityId
    const updatesByAct = new Map<string, ActivityDailyUpdateDoc[]>();
    updates.forEach((u) => {
      const key = String(u.activityId);
      if (!updatesByAct.has(key)) updatesByAct.set(key, []);
      updatesByAct.get(key)!.push(u);
    });

    const reportItems: ActivityReportItem[] = [];
    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    let overdueCount = 0;
    let delayedCount = 0;
    let totalDelta = 0;

    for (const act of activities) {
      const aId = String(act._id);
      const actUpdates = updatesByAct.get(aId) || [];

      // 1. Compute Starting Progress (Latest on or before dayBeforeStart)
      const updatesOnOrBeforeStart = actUpdates.filter((u) => u.updateDate <= dayBeforeStart);
      const startingUpdate = updatesOnOrBeforeStart[updatesOnOrBeforeStart.length - 1];
      const startingProgress = startingUpdate ? Number(startingUpdate.cumulativeProgress || 0) : 0;

      // 2. Compute Ending Progress (Latest on or before endDate)
      const endingUpdate = actUpdates[actUpdates.length - 1]; // Already filtered to <= endDate
      const endingProgress = endingUpdate
        ? Number(endingUpdate.cumulativeProgress || 0)
        : act.plannedStartDate <= endDate && act.currentProgress !== undefined
          ? Number(act.currentProgress)
          : 0;

      // 3. Period Progress Achieved (ΔP = Ending - Starting)
      const periodProgressDelta = Math.round((endingProgress - startingProgress) * 100) / 100;
      totalDelta += periodProgressDelta;

      // 4. Overdue logic
      const isOverdue =
        todayStr > act.plannedEndDate && act.status !== 'COMPLETED' && act.status !== 'CANCELLED';
      if (isOverdue) overdueCount++;

      // 5. Delay and work description in period
      const periodUpdates = actUpdates.filter((u) => u.updateDate >= startDate && u.updateDate <= endDate);
      const latestPeriodUpdate = periodUpdates[periodUpdates.length - 1];

      let isDelayed = false;
      let delayReason: string | null = null;
      let workDescription: string | undefined = undefined;
      let photoCount = 0;
      const correctionFootnotes: string[] = [];

      periodUpdates.forEach((pu) => {
        if (pu.isDelayed) {
          isDelayed = true;
          if (pu.delayReason) delayReason = pu.delayReason;
        }
        if (pu.photoIds && pu.photoIds.length > 0) {
          photoCount += pu.photoIds.length;
        }
        if (pu.editHistory && pu.editHistory.length > 0) {
          pu.editHistory.forEach((eh) => {
            correctionFootnotes.push(
              `Entry for ${pu.updateDate} corrected by ${eh.editedByName} on ${new Date(eh.editedAt).toLocaleDateString()}: "${eh.correctionReason}"`,
            );
          });
        }
      });

      if (latestPeriodUpdate) {
        workDescription = latestPeriodUpdate.workDescription;
      }

      if (isDelayed) delayedCount++;

      if (endingProgress >= 100 || act.status === 'COMPLETED') completedCount++;
      else if (endingProgress > 0) inProgressCount++;
      else notStartedCount++;

      const parentDoc = act.parentActivityId ? activityMap.get(String(act.parentActivityId)) : null;

      reportItems.push({
        activityId: aId,
        name: act.name,
        blockName: blockMap.get(String(act.blockId)) || 'Default Block',
        floorName: act.floorId ? floorMap.get(String(act.floorId)) : undefined,
        parentName: parentDoc ? parentDoc.name : undefined,
        isParent: !act.parentActivityId,
        progressMode: act.progressMode,
        status: act.status,
        isOverdue,
        plannedStartDate: act.plannedStartDate,
        plannedEndDate: act.plannedEndDate,
        actualStartDate: act.actualStartDate || null,
        actualCompletionDate: act.actualCompletionDate || null,
        startingProgress: Math.round(startingProgress * 100) / 100,
        endingProgress: Math.round(endingProgress * 100) / 100,
        periodProgressDelta,
        isDelayed,
        delayReason,
        workDescription,
        photoCount,
        hasCorrections: correctionFootnotes.length > 0,
        correctionFootnotes,
      });
    }

    const averagePeriodProgress =
      reportItems.length > 0 ? Math.round((totalDelta / reportItems.length) * 100) / 100 : 0;

    return {
      metadata: {
        reportType: reportType.toUpperCase(),
        startDate,
        endDate,
        dayBeforeStart,
        projectName: project?.name || 'Authorized Project',
        blockName,
        companyName: 'CraveToBuild Construction',
        generatedAt: new Date().toISOString(),
      },
      summary: {
        totalActivities: reportItems.length,
        completedCount,
        inProgressCount,
        notStartedCount,
        overdueCount,
        delayedCount,
        averagePeriodProgress,
      },
      items: reportItems,
    };
  }

  /**
   * Generates a high-quality PDF document stream using pdfkit
   */
  static async generatePdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `CraveToBuild - ${data.metadata.reportType} Report`,
          Author: 'CraveToBuild Progress Tracking System',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const primaryColor = '#047857'; // CraveToBuild Brand Emerald
      const darkNavy = '#0f172a';
      const slateGrey = '#475569';
      const lightBorder = '#e2e8f0';

      // ── Header Block ──
      doc.rect(36, 36, 523, 60).fill('#f8fafc');
      doc.rect(36, 36, 523, 60).stroke(lightBorder);

      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text(`CRAVETOBUILD — ${data.metadata.reportType} REPORT`, 50, 48);
      doc.fillColor(darkNavy).fontSize(10).font('Helvetica-Bold').text(`Project: ${data.metadata.projectName}  |  Block: ${data.metadata.blockName}`, 50, 68);
      doc.fillColor(slateGrey).fontSize(9).font('Helvetica').text(`Reporting Period: ${data.metadata.startDate} to ${data.metadata.endDate}  (Baseline date: ${data.metadata.dayBeforeStart})`, 50, 80);

      // ── KPI Summary Cards ──
      const kpis = [
        { label: 'Total Activities', val: String(data.summary.totalActivities), color: darkNavy },
        { label: 'Completed', val: String(data.summary.completedCount), color: '#10b981' },
        { label: 'In Progress', val: String(data.summary.inProgressCount), color: '#2563eb' },
        { label: 'Overdue', val: String(data.summary.overdueCount), color: '#dc2626' },
        { label: 'Avg Period Gain', val: `${data.summary.averagePeriodProgress}%`, color: primaryColor },
      ];

      const cardWidth = 100;
      kpis.forEach((kpi, idx) => {
        const x = 36 + idx * 105;
        doc.rect(x, 108, cardWidth, 42).fill('#ffffff').stroke(lightBorder);
        doc.fillColor(slateGrey).fontSize(7.5).font('Helvetica').text(kpi.label, x + 8, 114);
        doc.fillColor(kpi.color).fontSize(14).font('Helvetica-Bold').text(kpi.val, x + 8, 126);
      });

      // ── Activities Table ──
      let y = 165;
      doc.fillColor(darkNavy).fontSize(11).font('Helvetica-Bold').text('Operational Progress Details', 36, y);
      y += 18;

      // Table Header Row
      doc.rect(36, y, 523, 20).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Activity Name', 42, y + 6, { width: 150 });
      doc.text('Start %', 200, y + 6, { width: 45, align: 'right' });
      doc.text('End %', 255, y + 6, { width: 45, align: 'right' });
      doc.text('Period Δ', 310, y + 6, { width: 45, align: 'right' });
      doc.text('Planned Finish', 365, y + 6, { width: 65 });
      doc.text('Status', 440, y + 6, { width: 55 });
      doc.text('Delays / Notes', 500, y + 6, { width: 55 });
      y += 20;

      // Data Rows
      doc.font('Helvetica').fontSize(8);
      data.items.forEach((it: ActivityReportItem, rIdx: number) => {
        if (y > 740) {
          doc.addPage();
          y = 40;
        }

        const isEven = rIdx % 2 === 0;
        if (!isEven) {
          doc.rect(36, y, 523, 18).fill('#f8fafc');
        }

        doc.fillColor(darkNavy);
        const displayName = it.parentName ? `  ↳ ${it.name}` : it.name;
        doc.text(displayName.substring(0, 32), 42, y + 4, { width: 150 });
        doc.text(`${it.startingProgress}%`, 200, y + 4, { width: 45, align: 'right' });
        doc.text(`${it.endingProgress}%`, 255, y + 4, { width: 45, align: 'right' });

        const deltaColor = it.periodProgressDelta > 0 ? '#047857' : it.periodProgressDelta < 0 ? '#dc2626' : slateGrey;
        doc.fillColor(deltaColor).text(`${it.periodProgressDelta > 0 ? '+' : ''}${it.periodProgressDelta}%`, 310, y + 4, { width: 45, align: 'right' });

        doc.fillColor(darkNavy);
        doc.text(it.plannedEndDate, 365, y + 4, { width: 65 });

        const statusColor = it.status === 'COMPLETED' ? '#10b981' : it.isOverdue ? '#dc2626' : '#2563eb';
        doc.fillColor(statusColor).text(it.isOverdue ? 'OVERDUE' : it.status, 440, y + 4, { width: 55 });

        doc.fillColor(it.isDelayed ? '#dc2626' : slateGrey);
        doc.text(it.isDelayed ? (it.delayReason || 'Delayed').substring(0, 14) : 'On track', 500, y + 4, { width: 55 });

        y += 18;
      });

      // ── Footnotes Section ──
      const allCorrections = data.items.flatMap((it: ActivityReportItem) => it.correctionFootnotes);
      if (allCorrections.length > 0) {
        if (y > 700) {
          doc.addPage();
          y = 40;
        }
        y += 15;
        doc.fillColor(darkNavy).fontSize(9).font('Helvetica-Bold').text('Audited Progress Corrections in Period:', 36, y);
        y += 12;
        doc.fillColor(slateGrey).fontSize(7.5).font('Helvetica');
        allCorrections.forEach((fn: string) => {
          doc.text(`• ${fn}`, 42, y, { width: 510 });
          y += 11;
        });
      }

      // Page footer
      doc.fillColor(slateGrey).fontSize(7).font('Helvetica').text(
        `Generated on ${new Date().toLocaleString()} by CraveToBuild Progress Tracker. Starting progress reflects status as of close of day prior to period.`,
        36,
        780,
        { align: 'center', width: 523 },
      );

      doc.end();
    });
  }

  /**
   * Generates a professionally styled Excel workbook buffer using exceljs
   */
  static async generateExcel(data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CraveToBuild Activity Tracker';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`${data.metadata.reportType} Report`.substring(0, 31), {
      views: [{ state: 'frozen', ySplit: 5 }],
    });

    const primaryColor = '047857'; // CraveToBuild Emerald

    // Title Row
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `CRAVETOBUILD — ${data.metadata.reportType} REPORT (${data.metadata.startDate} to ${data.metadata.endDate})`;
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } };
    titleCell.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(1).height = 28;

    // Metadata Rows
    sheet.getCell('A2').value = 'Project:';
    sheet.getCell('B2').value = data.metadata.projectName;
    sheet.getCell('D2').value = 'Block:';
    sheet.getCell('E2').value = data.metadata.blockName;

    sheet.getCell('A3').value = 'Baseline Date:';
    sheet.getCell('B3').value = `${data.metadata.dayBeforeStart} (Close of business prior to start)`;
    sheet.getCell('D3').value = 'Generated:';
    sheet.getCell('E3').value = new Date().toLocaleString();

    sheet.getRow(2).font = { name: 'Calibri', size: 9.5, bold: true };
    sheet.getRow(3).font = { name: 'Calibri', size: 9.5 };

    // Column Headers
    const headers = [
      'Activity Name',
      'Level / Floor',
      'Parent Activity',
      'Planned Start',
      'Planned Finish',
      'Starting %',
      'Ending %',
      'Period Delta (Δ%)',
      'Status / Overdue',
      'Delay Flag',
      'Delay Reason',
      'Work Description',
    ];

    const headerRow = sheet.getRow(5);
    headerRow.values = headers;
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Populate Data
    data.items.forEach((it: ActivityReportItem, idx: number) => {
      const row = sheet.addRow([
        it.parentName ? `  ↳ ${it.name}` : it.name,
        it.floorName || '-',
        it.parentName || 'Self / Top-Level',
        it.plannedStartDate,
        it.plannedEndDate,
        it.startingProgress / 100,
        it.endingProgress / 100,
        it.periodProgressDelta / 100,
        it.isOverdue ? 'OVERDUE' : it.status,
        it.isDelayed ? 'YES' : 'NO',
        it.delayReason || '-',
        it.workDescription || '-',
      ]);

      row.height = 20;
      row.font = { name: 'Calibri', size: 9.5 };
      row.alignment = { vertical: 'middle' };

      // Format percentages
      row.getCell(6).numFmt = '0.0%';
      row.getCell(7).numFmt = '0.0%';
      row.getCell(8).numFmt = '0.0%';

      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
        });
      }
    });

    // Auto-fit column widths
    sheet.columns.forEach((col, idx) => {
      if (idx === 0) col.width = 30;
      else if (idx === 10 || idx === 11) col.width = 35;
      else col.width = 16;
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
