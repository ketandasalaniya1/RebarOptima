import { Db, ObjectId } from 'mongodb';
import {
  ReportConfig,
  AggregatedReportData,
  ExcelExportConfig,
} from './reports.types';

// Helper to normalize queries for string/ObjectId
export function toIdQuery(id: string | any): any {
  if (!id) return { _id: id };
  if (id instanceof ObjectId) return { _id: id };
  if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: String(id) };
}

export function toObjectId(id: any): ObjectId | null {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  const str = String(id).trim();
  if (ObjectId.isValid(str) && str.length === 24) {
    try {
      return new ObjectId(str);
    } catch {
      return null;
    }
  }
  return null;
}

export function buildCompanyFilter(companyId: any): any {
  if (!companyId) return { companyId: null };
  const objId = toObjectId(companyId);
  if (objId) {
    return { $or: [{ companyId: objId }, { companyId: String(companyId) }] };
  }
  return { companyId: String(companyId) };
}

export function buildProjectFilter(projectId?: string, projectIds?: string[]): any {
  if (projectIds && projectIds.length > 0) {
    const ids: any[] = [];
    projectIds.forEach(p => {
      ids.push(p);
      const o = toObjectId(p);
      if (o) ids.push(o);
    });
    return { $in: ids };
  }
  if (!projectId || projectId === 'all') return undefined;
  const o = toObjectId(projectId);
  return o ? { $in: [projectId, o] } : projectId;
}

export class ReportsService {
  constructor(private db: Db) {}

  /**
   * Aggregate report data for PDF generation or live preview
   */
  async getAggregatedReportData(
    companyId: string,
    user: any,
    config: ReportConfig
  ): Promise<AggregatedReportData> {
    const { reportMode, startDate, endDate, sections, filters, includePhotos } = config;

    // Date range
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const compFilter = buildCompanyFilter(companyId);
    const projFilter = buildProjectFilter(filters.projectId, filters.projectIds);

    // Fetch Project metadata
    let projectName = 'All Projects';
    let projectCode: string | undefined;
    if (filters.projectId && filters.projectId !== 'all') {
      const proj = await this.db.collection('projects').findOne({
        ...compFilter,
        ...toIdQuery(filters.projectId)
      }) || await this.db.collection('pm_projects').findOne({
        ...compFilter,
        ...toIdQuery(filters.projectId)
      });
      if (proj) {
        projectName = proj.name || projectName;
        projectCode = proj.code;
      }
    }

    const aggregated: AggregatedReportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: {
          id: String(user.sub || user.userId || user.id || ''),
          name: String(user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Authorized User'),
          role: user.role,
        },
        companyId,
        projectName,
        projectId: filters.projectId,
        projectCode,
        startDate,
        endDate,
        reportMode,
        includePhotos: !!includePhotos,
      },
      sections: {},
      photos: [],
    };

    // 1. Task and Progress
    if (sections.tasksAndProgress) {
      const query: any = { ...compFilter };
      if (projFilter) query.projectId = projFilter;
      // We look for tasks overlapping or active in the date range or updated
      const tasks = await this.db.collection('pm_tasks').find(query).toArray();

      let completed = 0;
      let inProgress = 0;
      let notStarted = 0;
      let blocked = 0;
      let totalWorkers = 0;
      let totalProgressPct = 0;

      const items: any[] = [];

      tasks.forEach((t: any) => {
        const status = t.status || 'NOT_STARTED';
        if (status === 'COMPLETED') completed++;
        else if (status === 'IN_PROGRESS' || status === 'UNDER_INSPECTION') inProgress++;
        else if (status === 'BLOCKED' || status === 'REWORK_REQUIRED') blocked++;
        else notStarted++;

        const prog = Number(t.progressPercentage) || 0;
        totalProgressPct += prog;

        let workers = 0;
        if (Array.isArray(t.manpowerAllocations)) {
          workers = t.manpowerAllocations.reduce((acc: number, m: any) => acc + (Number(m.headcount) || 0), 0);
        }
        totalWorkers += workers;

        if (reportMode === 'detailed') {
          items.push({
            wbsCode: t.wbsCode || '',
            name: t.name || '',
            status: t.status,
            priority: t.priority,
            progressPercentage: prog,
            plannedStart: t.plannedStart || '',
            plannedFinish: t.plannedFinish || '',
            actualStart: t.actualStart || '',
            actualFinish: t.actualFinish || '',
            plannedQty: t.plannedQty,
            completedQty: t.completedQty,
            unit: t.unit || '',
            assignedUserName: t.assignedUserName || t.assignedRole || '',
            workerCount: workers,
            remarks: t.description || '',
          });
        }
      });

      const avgProgress = tasks.length > 0 ? Math.round(totalProgressPct / tasks.length) : 0;

      aggregated.sections.tasksAndProgress = {
        summary: {
          totalTasks: tasks.length,
          completedTasks: completed,
          inProgressTasks: inProgress,
          notStartedTasks: notStarted,
          blockedTasks: blocked,
          overallProgressPercent: avgProgress,
          totalAllocatedWorkers: totalWorkers,
        },
        items: reportMode === 'detailed' ? items : undefined,
      };
    }

    // 2. Issues & Incidents
    if (sections.issues) {
      const query: any = {
        ...compFilter,
        date: { $gte: start, $lte: end }
      };
      if (projFilter) query.projectId = projFilter;

      const incidents = await this.db.collection('gi_incidents').find(query).sort({ date: -1 }).toArray();

      let reported = 0;
      let investigating = 0;
      let resolved = 0;
      const byType: Record<string, number> = {};
      const items: any[] = [];

      incidents.forEach((inc: any) => {
        const st = inc.status || 'REPORTED';
        if (st === 'REPORTED') reported++;
        else if (st === 'INVESTIGATING') investigating++;
        else if (st === 'RESOLVED') resolved++;

        const type = inc.incidentType || 'Other';
        byType[type] = (byType[type] || 0) + 1;

        if (includePhotos && Array.isArray(inc.attachments)) {
          inc.attachments.forEach((att: any) => {
            if (att?.url && (att.url.endsWith('.jpg') || att.url.endsWith('.jpeg') || att.url.endsWith('.png') || att.url.startsWith('data:image'))) {
              if ((aggregated.photos?.length || 0) < 25) {
                aggregated.photos?.push({
                  source: `Incident ${inc.incidentNumber || ''}`,
                  title: inc.description || 'Incident Photo',
                  url: att.url,
                  date: inc.date ? new Date(inc.date).toISOString().split('T')[0] : undefined,
                });
              }
            }
          });
        }

        if (reportMode === 'detailed') {
          items.push({
            incidentNumber: inc.incidentNumber || '',
            incidentType: inc.incidentType,
            description: inc.description,
            reportedBy: inc.reportedBy,
            status: inc.status,
            materialName: inc.materialName || '',
            quantity: inc.quantity || 0,
            uom: inc.uom || '',
            date: inc.date ? new Date(inc.date).toISOString().split('T')[0] : '',
            remarks: inc.remarks || '',
          });
        }
      });

      aggregated.sections.issues = {
        summary: {
          totalIncidents: incidents.length,
          reported,
          investigating,
          resolved,
          byType,
        },
        items: reportMode === 'detailed' ? items : undefined,
      };
    }

    // 3. Inventory Stock Balances
    if (sections.inventory) {
      const query: any = { ...compFilter, isActive: true };
      if (projFilter) query.projectId = projFilter;

      const materials = await this.db.collection('gi_materials').find(query).toArray();
      const balances = await this.db.collection('gi_stock_balances').find({ ...compFilter }).toArray();

      const balanceMap = new Map<string, number>();
      balances.forEach((b: any) => {
        const key = `${b.materialId}`;
        balanceMap.set(key, (balanceMap.get(key) || 0) + (Number(b.currentBalance) || 0));
      });

      let lowStockCount = 0;
      let outOfStockCount = 0;
      let normalCount = 0;
      const items: any[] = [];

      materials.forEach((m: any) => {
        const matId = m._id.toString();
        const currBal = balanceMap.get(matId) || 0;
        const threshold = Number(m.lowStockThreshold) || 0;

        let status = 'NORMAL';
        if (currBal === 0) {
          outOfStockCount++;
          status = 'OUT_OF_STOCK';
        } else if (currBal <= threshold) {
          lowStockCount++;
          status = 'LOW_STOCK';
        } else {
          normalCount++;
        }

        if (reportMode === 'detailed') {
          items.push({
            materialCode: m.materialCode || '',
            name: m.name,
            category: m.category,
            uom: m.uom,
            currentBalance: currBal,
            lowStockThreshold: threshold,
            status,
            preferredVendor: m.preferredVendor || '',
          });
        }
      });

      aggregated.sections.inventory = {
        summary: {
          totalMaterials: materials.length,
          lowStockCount,
          outOfStockCount,
          normalCount,
        },
        items: reportMode === 'detailed' ? items : undefined,
      };
    }

    // 4. GRN (Material Inward)
    if (sections.grn) {
      const query: any = {
        ...compFilter,
        receiptDate: { $gte: start, $lte: end }
      };
      if (projFilter) query.projectId = projFilter;

      const inwards = await this.db.collection('gi_inward_entries').find(query).sort({ receiptDate: -1 }).toArray();

      let totalReceivedItems = 0;
      let totalAccepted = 0;
      let totalDamaged = 0;
      const vendorSet = new Set<string>();
      const items: any[] = [];

      inwards.forEach((inw: any) => {
        if (inw.vendorName) vendorSet.add(inw.vendorName);
        if (Array.isArray(inw.items)) {
          totalReceivedItems += inw.items.length;
          inw.items.forEach((it: any) => {
            totalAccepted += Number(it.acceptedQuantity) || 0;
            totalDamaged += Number(it.damagedQuantity) || 0;
          });
        }

        if (reportMode === 'detailed') {
          items.push({
            inwardNumber: inw.inwardNumber,
            receiptDate: inw.receiptDate ? new Date(inw.receiptDate).toISOString().split('T')[0] : '',
            vendorName: inw.vendorName,
            vendorChallanNumber: inw.vendorChallanNumber || '',
            invoiceNumber: inw.invoiceNumber || '',
            itemCount: Array.isArray(inw.items) ? inw.items.length : 0,
            items: (inw.items || []).map((it: any) => ({
              materialName: it.materialName,
              receivedQuantity: it.receivedQuantity,
              acceptedQuantity: it.acceptedQuantity,
              damagedQuantity: it.damagedQuantity,
              uom: it.uom,
              unitPrice: it.unitPrice || 0,
            })),
            receivedBy: inw.receivedBy?.name || '',
            remarks: inw.remarks || '',
          });
        }
      });

      aggregated.sections.grn = {
        summary: {
          totalInwardEntries: inwards.length,
          totalReceivedItems,
          totalAcceptedQuantity: Math.round(totalAccepted * 100) / 100,
          totalDamagedQuantity: Math.round(totalDamaged * 100) / 100,
          totalVendorsCount: vendorSet.size,
        },
        items: reportMode === 'detailed' ? items : undefined,
      };
    }

    // 5. Material Issued (Outward)
    if (sections.materialIssued) {
      const query: any = {
        ...compFilter,
        issueDateTime: { $gte: start, $lte: end }
      };
      if (projFilter) query.projectId = projFilter;

      const outwards = await this.db.collection('gi_outward_entries').find(query).sort({ issueDateTime: -1 }).toArray();

      let totalQty = 0;
      let returnable = 0;
      let nonReturnable = 0;
      const items: any[] = [];

      outwards.forEach((out: any) => {
        const qty = Number(out.quantity) || 0;
        totalQty += qty;
        if (out.returnClassification === 'returnable') returnable++;
        else nonReturnable++;

        if (reportMode === 'detailed') {
          items.push({
            outwardNumber: out.outwardNumber,
            issueDateTime: out.issueDateTime ? new Date(out.issueDateTime).toISOString().split('T')[0] : '',
            materialName: out.materialName,
            quantity: qty,
            uom: out.uom,
            personReceiving: out.personReceiving,
            agency: out.agency || '',
            location: out.location || '',
            purpose: out.purpose || '',
            returnClassification: out.returnClassification,
            status: out.status,
            issuedBy: out.issuedBy?.name || '',
          });
        }
      });

      aggregated.sections.materialIssued = {
        summary: {
          totalOutwardEntries: outwards.length,
          totalQuantityIssued: Math.round(totalQty * 100) / 100,
          returnableCount: returnable,
          nonReturnableCount: nonReturnable,
        },
        items: reportMode === 'detailed' ? items : undefined,
      };
    }

    // 6. Site Transfer
    if (sections.siteTransfer) {
      const query: any = {
        ...compFilter,
        transferDate: { $gte: start, $lte: end }
      };
      if (projFilter) query.projectId = projFilter;

      const transfers = await this.db.collection('gi_transfers').find(query).sort({ transferDate: -1 }).toArray();

      let totalTransferred = 0;
      const items: any[] = [];

      transfers.forEach((tr: any) => {
        const qty = Number(tr.quantity) || 0;
        totalTransferred += qty;

        if (reportMode === 'detailed') {
          items.push({
            transferNumber: tr.transferNumber,
            transferDate: tr.transferDate ? new Date(tr.transferDate).toISOString().split('T')[0] : '',
            sourceStoreName: tr.sourceStoreName,
            destinationStoreName: tr.destinationStoreName,
            materialName: tr.materialName,
            quantity: qty,
            uom: tr.uom,
            responsibleUser: tr.responsibleUser?.name || '',
            reference: tr.reference || '',
            remarks: tr.remarks || '',
          });
        }
      });

      aggregated.sections.siteTransfer = {
        summary: {
          totalTransfers: transfers.length,
          totalQuantityTransferred: Math.round(totalTransferred * 100) / 100,
        },
        items: reportMode === 'detailed' ? items : undefined,
      };
    }

    // 7. Attendance (All 3 manpower categories)
    if (sections.attendance) {
      const startStr = startDate;
      const endStr = endDate;

      const sessQuery: any = {
        ...compFilter,
        date: { $gte: startStr, $lte: endStr },
        status: { $ne: 'VOIDED' }
      };
      if (projFilter) sessQuery.projectId = projFilter;

      const sessions = await this.db.collection('attendance_sessions').find(sessQuery).toArray();
      const sessionIds = sessions.map(s => s._id.toString());

      let compLabourDays = 0;
      let contLabourDays = 0;
      let wfPersonDays = 0;
      let presentHeadcount = 0;
      let halfDayHeadcount = 0;
      let absentCount = 0;

      const items: any[] = [];

      if (sessionIds.length > 0) {
        // Individual lines (Company Labour & Named Contractor Labour)
        const lines = await this.db.collection('attendance_lines').find({
          sessionId: { $in: sessionIds }
        }).toArray();

        lines.forEach((l: any) => {
          const st = l.status;
          let workedVal = 0;
          if (st === 'PRESENT') {
            workedVal = 1;
            presentHeadcount++;
          } else if (st === 'HALF_DAY') {
            workedVal = 0.5;
            halfDayHeadcount++;
          } else if (st === 'ABSENT') {
            absentCount++;
          }

          if (l.labourType === 'CONTRACTOR') {
            contLabourDays += workedVal;
          } else {
            compLabourDays += workedVal;
          }

          if (reportMode === 'detailed') {
            items.push({
              workerName: l.labourName || 'Unnamed Worker',
              category: l.labourType === 'CONTRACTOR' ? 'Contractor Labour' : 'Company Labour',
              contractorName: l.contractorName || '-',
              date: l.date,
              status: l.status,
              overtimeHours: l.overtimeHours || 0,
              workedDays: workedVal,
              remarks: l.remarks || '',
            });
          }
        });

        // Workforce lines (Contractor Workforce headcounts)
        const wfLines = await this.db.collection('attendance_wf_lines').find({
          sessionId: { $in: sessionIds }
        }).toArray();

        wfLines.forEach((wf: any) => {
          const p = Number(wf.presentCount) || 0;
          const h = Number(wf.halfDayCount) || 0;
          const calculatedPersonDays = p + (h * 0.5);

          wfPersonDays += calculatedPersonDays;
          presentHeadcount += p;
          halfDayHeadcount += h;

          if (reportMode === 'detailed') {
            items.push({
              workerName: `${wf.contractorName || 'Workforce'} Gang (${wf.trade || 'General'})`,
              category: 'Contractor Workforce',
              contractorName: wf.contractorName || '-',
              date: wf.date,
              status: `P:${p} | H:${h}`,
              overtimeHours: wf.totalOtHours || 0,
              workedDays: calculatedPersonDays,
              remarks: wf.remarks || '',
            });
          }
        });
      }

      const totalWorked = compLabourDays + contLabourDays + wfPersonDays;

      aggregated.sections.attendance = {
        summary: {
          companyLabourWorkedDays: Math.round(compLabourDays * 10) / 10,
          contractorLabourWorkedDays: Math.round(contLabourDays * 10) / 10,
          workforcePersonDays: Math.round(wfPersonDays * 10) / 10,
          totalWorkedPersonDays: Math.round(totalWorked * 10) / 10,
          presentHeadcountTotal: presentHeadcount,
          halfDayHeadcountTotal: halfDayHeadcount,
          absentCount,
        },
        items: reportMode === 'detailed' ? items : undefined,
      };
    }

    // 8. Payables & Expenses (Petty cash & site transactions)
    if (sections.payables) {
      const hasPettyCashPerm = user.role === 'ADMIN' || user.role === 'OWNER' || user.accountType === 'developer' || (user.permissions?.pettyCash !== false);
      if (hasPettyCashPerm) {
        const query: any = {
          ...compFilter,
          date: { $gte: startDate, $lte: endDate }
        };
        // site matching if project is selected
        if (projectName && projectName !== 'All Projects') {
          query.siteName = { $regex: new RegExp(projectName, 'i') };
        }

        const txs = await this.db.collection('petty_cash_transactions').find(query).sort({ date: -1 }).toArray();

        let totalCredits = 0;
        let totalDebits = 0;
        const categoryMap = new Map<string, number>();
        const items: any[] = [];

        txs.forEach((tx: any) => {
          const amt = Number(tx.amount) || 0;
          if (tx.type === 'CREDIT') {
            totalCredits += amt;
          } else if (tx.type === 'DEBIT') {
            totalDebits += amt;
            const cat = tx.category || 'General';
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + amt);
          }

          if (reportMode === 'detailed') {
            items.push({
              date: tx.date,
              type: tx.type,
              amount: amt,
              category: tx.category || '',
              subcategory: tx.subcategory || '',
              paidTo: tx.personName || tx.paidTo || '',
              paymentMode: tx.paymentMode || '',
              billNumber: tx.billNumber || '',
              remarks: tx.description || tx.remarks || '',
            });
          }
        });

        const topCategories = Array.from(categoryMap.entries())
          .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        aggregated.sections.payables = {
          summary: {
            totalCredits: Math.round(totalCredits),
            totalDebits: Math.round(totalDebits),
            netExpenses: Math.round(totalDebits - totalCredits),
            transactionCount: txs.length,
            topCategories,
          },
          items: reportMode === 'detailed' ? items : undefined,
        };
      }
    }

    return aggregated;
  }

  /**
   * Fetch extract data for Excel export
   */
  async getExcelExtractData(
    companyId: string,
    config: ExcelExportConfig
  ): Promise<{ rows: any[]; title: string; sheetName: string; summary?: any }> {
    const { extractType, projectId, startDate, endDate } = config;
    const compFilter = buildCompanyFilter(companyId);
    const projFilter = buildProjectFilter(projectId);

    const start = startDate ? new Date(startDate) : undefined;
    if (start) start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : undefined;
    if (end) end.setHours(23, 59, 59, 999);

    switch (extractType) {
      case 'grn': {
        const query: any = { ...compFilter };
        if (projFilter) query.projectId = projFilter;
        if (start && end) query.receiptDate = { $gte: start, $lte: end };

        const inwards = await this.db.collection('gi_inward_entries').find(query).sort({ receiptDate: -1 }).toArray();
        const rows: any[] = [];
        inwards.forEach(inw => {
          (inw.items || []).forEach((it: any) => {
            rows.push({
              inwardNumber: inw.inwardNumber,
              receiptDate: inw.receiptDate ? new Date(inw.receiptDate).toISOString().split('T')[0] : '',
              vendorName: inw.vendorName,
              vendorChallanNumber: inw.vendorChallanNumber || '',
              invoiceNumber: inw.invoiceNumber || '',
              materialName: it.materialName,
              receivedQty: it.receivedQuantity,
              acceptedQty: it.acceptedQuantity,
              damagedQty: it.damagedQuantity,
              uom: it.uom,
              unitPrice: it.unitPrice || 0,
              totalValue: (Number(it.acceptedQuantity) || 0) * (Number(it.unitPrice) || 0),
              receivedBy: inw.receivedBy?.name || '',
              remarks: inw.remarks || it.remarks || '',
            });
          });
        });
        return { rows, title: 'Goods Receipt Note (GRN) Extract', sheetName: 'GRN Extract' };
      }

      case 'material_issued': {
        const query: any = { ...compFilter };
        if (projFilter) query.projectId = projFilter;
        if (start && end) query.issueDateTime = { $gte: start, $lte: end };

        const outwards = await this.db.collection('gi_outward_entries').find(query).sort({ issueDateTime: -1 }).toArray();
        const rows = outwards.map(out => ({
          outwardNumber: out.outwardNumber,
          issueDate: out.issueDateTime ? new Date(out.issueDateTime).toISOString().split('T')[0] : '',
          materialName: out.materialName,
          quantity: out.quantity,
          uom: out.uom,
          personReceiving: out.personReceiving,
          agency: out.agency || '',
          location: out.location || '',
          purpose: out.purpose || '',
          classification: out.returnClassification,
          status: out.status,
          issuedBy: out.issuedBy?.name || '',
          remarks: out.remarks || '',
        }));
        return { rows, title: 'Material Issued / Consumption Extract', sheetName: 'Material Issues' };
      }

      case 'stock_inventory': {
        const query: any = { ...compFilter, isActive: true };
        if (projFilter) query.projectId = projFilter;

        const materials = await this.db.collection('gi_materials').find(query).toArray();
        const balances = await this.db.collection('gi_stock_balances').find({ ...compFilter }).toArray();

        const balanceMap = new Map<string, number>();
        balances.forEach((b: any) => {
          const key = `${b.materialId}`;
          balanceMap.set(key, (balanceMap.get(key) || 0) + (Number(b.currentBalance) || 0));
        });

        const rows = materials.map(m => {
          const currBal = balanceMap.get(m._id.toString()) || 0;
          const thresh = Number(m.lowStockThreshold) || 0;
          let status = 'NORMAL';
          if (currBal === 0) status = 'OUT_OF_STOCK';
          else if (currBal <= thresh) status = 'LOW_STOCK';

          return {
            materialCode: m.materialCode || '',
            name: m.name,
            category: m.category,
            subcategory: m.subcategory || '',
            uom: m.uom,
            currentBalance: currBal,
            lowStockThreshold: thresh,
            status,
            preferredVendor: m.preferredVendor || '',
            brandOrModel: m.brandOrModel || '',
          };
        });
        return { rows, title: 'Current Stock & Inventory Balance', sheetName: 'Stock Inventory' };
      }

      case 'labour_attendance': {
        const sessQuery: any = { ...compFilter, status: { $ne: 'VOIDED' } };
        if (projFilter) sessQuery.projectId = projFilter;
        if (startDate && endDate) sessQuery.date = { $gte: startDate, $lte: endDate };

        const sessions = await this.db.collection('attendance_sessions').find(sessQuery).toArray();
        const sessionIds = sessions.map(s => s._id.toString());

        const rows: any[] = [];
        if (sessionIds.length > 0) {
          const lines = await this.db.collection('attendance_lines').find({ sessionId: { $in: sessionIds } }).toArray();
          lines.forEach(l => {
            rows.push({
              date: l.date,
              labourName: l.labourName,
              labourType: l.labourType === 'CONTRACTOR' ? 'Contractor Labour' : 'Company Labour',
              contractorName: l.contractorName || 'Self',
              status: l.status,
              overtimeHours: l.overtimeHours || 0,
              workedDays: l.status === 'PRESENT' ? 1 : l.status === 'HALF_DAY' ? 0.5 : 0,
              remarks: l.remarks || '',
            });
          });
        }
        return { rows, title: 'Labour Attendance Extract', sheetName: 'Labour Attendance' };
      }

      case 'contractor_workforce': {
        const sessQuery: any = { ...compFilter, status: { $ne: 'VOIDED' } };
        if (projFilter) sessQuery.projectId = projFilter;
        if (startDate && endDate) sessQuery.date = { $gte: startDate, $lte: endDate };

        const sessions = await this.db.collection('attendance_sessions').find(sessQuery).toArray();
        const sessionIds = sessions.map(s => s._id.toString());

        const rows: any[] = [];
        if (sessionIds.length > 0) {
          const wfLines = await this.db.collection('attendance_wf_lines').find({ sessionId: { $in: sessionIds } }).toArray();
          wfLines.forEach(wf => {
            const p = Number(wf.presentCount) || 0;
            const h = Number(wf.halfDayCount) || 0;
            rows.push({
              date: wf.date,
              contractorName: wf.contractorName,
              trade: wf.trade || 'General Construction',
              presentHeadcount: p,
              halfDayHeadcount: h,
              totalPersonDays: p + (h * 0.5),
              overtimeHours: wf.totalOtHours || 0,
              remarks: wf.remarks || '',
            });
          });
        }
        return { rows, title: 'Contractor Workforce Attendance Extract', sheetName: 'Workforce Attendance' };
      }

      case 'petty_cash_expenses': {
        const query: any = { ...compFilter };
        if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };

        const txs = await this.db.collection('petty_cash_transactions').find(query).sort({ date: -1 }).toArray();
        const rows = txs.map(tx => ({
          date: tx.date,
          siteName: tx.siteName || '',
          type: tx.type,
          amount: tx.amount,
          category: tx.category || '',
          subcategory: tx.subcategory || '',
          personPaid: tx.personName || tx.paidTo || '',
          paymentMode: tx.paymentMode || '',
          billNumber: tx.billNumber || '',
          description: tx.description || tx.remarks || '',
        }));
        return { rows, title: 'Petty Cash & Site Expenses Extract', sheetName: 'Expenses Extract' };
      }

      case 'task_progress': {
        const query: any = { ...compFilter };
        if (projFilter) query.projectId = projFilter;

        const tasks = await this.db.collection('pm_tasks').find(query).sort({ sortOrder: 1, wbsCode: 1 }).toArray();
        const rows = tasks.map(t => ({
          wbsCode: t.wbsCode,
          name: t.name,
          status: t.status,
          priority: t.priority,
          progressPercentage: t.progressPercentage || 0,
          plannedStart: t.plannedStart || '',
          plannedFinish: t.plannedFinish || '',
          actualStart: t.actualStart || '',
          actualFinish: t.actualFinish || '',
          plannedQty: t.plannedQty || 0,
          completedQty: t.completedQty || 0,
          unit: t.unit || '',
          assignedTo: t.assignedUserName || t.assignedRole || '',
        }));
        return { rows, title: 'Tasks and Schedule Progress Extract', sheetName: 'Task Progress' };
      }

      case 'site_incidents': {
        const query: any = { ...compFilter };
        if (projFilter) query.projectId = projFilter;
        if (start && end) query.date = { $gte: start, $lte: end };

        const incidents = await this.db.collection('gi_incidents').find(query).sort({ date: -1 }).toArray();
        const rows = incidents.map(inc => ({
          incidentNumber: inc.incidentNumber,
          date: inc.date ? new Date(inc.date).toISOString().split('T')[0] : '',
          incidentType: inc.incidentType,
          status: inc.status,
          materialName: inc.materialName || '',
          quantity: inc.quantity || 0,
          uom: inc.uom || '',
          reportedBy: inc.reportedBy,
          description: inc.description,
          remarks: inc.remarks || '',
        }));
        return { rows, title: 'Site Incidents and Issues Extract', sheetName: 'Incidents Extract' };
      }

      case 'site_transfers': {
        const query: any = { ...compFilter };
        if (projFilter) query.projectId = projFilter;
        if (start && end) query.transferDate = { $gte: start, $lte: end };

        const transfers = await this.db.collection('gi_transfers').find(query).sort({ transferDate: -1 }).toArray();
        const rows = transfers.map(tr => ({
          transferNumber: tr.transferNumber,
          date: tr.transferDate ? new Date(tr.transferDate).toISOString().split('T')[0] : '',
          sourceStore: tr.sourceStoreName,
          destinationStore: tr.destinationStoreName,
          materialName: tr.materialName,
          quantity: tr.quantity,
          uom: tr.uom,
          responsibleUser: tr.responsibleUser?.name || '',
          reference: tr.reference || '',
          remarks: tr.remarks || '',
        }));
        return { rows, title: 'Store and Site Transfers Extract', sheetName: 'Transfers Extract' };
      }

      default:
        throw new Error(`Unsupported extract type: ${extractType}`);
    }
  }
}
