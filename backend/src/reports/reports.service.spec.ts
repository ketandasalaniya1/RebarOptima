import { ReportsService } from './reports.service';
import { ReportsPdfBuilder } from './reports.pdf';
import { ReportsExcelBuilder } from './reports.excel';
import { ReportConfig } from './reports.types';

describe('ReportsService & Document Generation', () => {
  let mockDb: any;
  let service: ReportsService;

  beforeEach(() => {
    mockDb = {
      collection: jest.fn((name: string) => {
        return {
          find: jest.fn(() => ({
            toArray: jest.fn().mockImplementation(async () => {
              if (name === 'pm_tasks') {
                return [
                  {
                    wbsCode: '1.1',
                    name: 'Foundation Rebar Fixing',
                    status: 'COMPLETED',
                    progressPercentage: 100,
                    plannedStart: '2026-10-01',
                    plannedFinish: '2026-10-10',
                    manpowerAllocations: [{ headcount: 8 }],
                  },
                  {
                    wbsCode: '1.2',
                    name: 'Column Starter Pouring',
                    status: 'IN_PROGRESS',
                    progressPercentage: 40,
                    plannedStart: '2026-10-11',
                    plannedFinish: '2026-10-20',
                    manpowerAllocations: [{ headcount: 6 }],
                  },
                ];
              }
              if (name === 'gi_incidents') {
                return [
                  {
                    incidentNumber: 'INC-2026-001',
                    incidentType: 'Damaged',
                    description: 'Binding wire damaged during rain',
                    status: 'RESOLVED',
                    reportedBy: 'Ketan D.',
                    date: new Date('2026-10-15'),
                  },
                ];
              }
              if (name === 'gi_materials') {
                return [
                  { _id: 'mat-1', name: 'Rebar 12mm Fe550D', category: 'Civil & Construction', lowStockThreshold: 10, uom: 'MT' },
                  { _id: 'mat-2', name: 'Binding Wire 18G', category: 'Tools & Hardware', lowStockThreshold: 50, uom: 'Kg' },
                ];
              }
              if (name === 'gi_stock_balances') {
                return [
                  { materialId: 'mat-1', currentBalance: 25 },
                  { materialId: 'mat-2', currentBalance: 5 }, // Low stock!
                ];
              }
              if (name === 'gi_inward_entries') {
                return [
                  {
                    inwardNumber: 'INW-2026-001',
                    receiptDate: new Date('2026-10-12'),
                    vendorName: 'Tata Steel Ltd',
                    items: [{ materialName: 'Rebar 12mm', receivedQuantity: 20, acceptedQuantity: 20, damagedQuantity: 0, uom: 'MT' }],
                  },
                ];
              }
              if (name === 'gi_outward_entries') {
                return [
                  {
                    outwardNumber: 'OUT-2026-001',
                    issueDateTime: new Date('2026-10-14'),
                    materialName: 'Rebar 12mm',
                    quantity: 5,
                    uom: 'MT',
                    returnClassification: 'non-returnable',
                    personReceiving: 'Ramesh Singh',
                  },
                ];
              }
              if (name === 'gi_transfers') {
                return [
                  {
                    transferNumber: 'TRF-2026-001',
                    transferDate: new Date('2026-10-16'),
                    sourceStoreName: 'Central Yard',
                    destinationStoreName: 'Tower A Store',
                    materialName: 'Binding Wire',
                    quantity: 10,
                    uom: 'Kg',
                  },
                ];
              }
              if (name === 'attendance_sessions') {
                return [{ _id: 'sess-1', date: '2026-10-15', status: 'CONFIRMED' }];
              }
              if (name === 'attendance_lines') {
                return [
                  { sessionId: 'sess-1', labourName: 'Suresh Kumar', labourType: 'COMPANY', status: 'PRESENT', date: '2026-10-15' },
                  { sessionId: 'sess-1', labourName: 'Mahesh Patil', labourType: 'CONTRACTOR', status: 'HALF_DAY', date: '2026-10-15' },
                ];
              }
              if (name === 'attendance_wf_lines') {
                return [
                  { sessionId: 'sess-1', contractorName: 'Shree Sai Gang', presentCount: 10, halfDayCount: 2, date: '2026-10-15' },
                ];
              }
              if (name === 'petty_cash_transactions') {
                return [
                  { type: 'DEBIT', amount: 3500, category: 'Site Refreshments', date: '2026-10-15' },
                  { type: 'CREDIT', amount: 10000, category: 'Head Office Imprest', date: '2026-10-10' },
                ];
              }
              return [];
            }),
            sort: jest.fn().mockReturnThis(),
            project: jest.fn().mockReturnThis(),
          })),
          findOne: jest.fn().mockImplementation(async (q: any) => {
            if (name === 'projects' || name === 'pm_projects') {
              return { _id: 'proj-1', name: 'Skyline Towers Phase 1', code: 'SKYL-01' };
            }
            return null;
          }),
        };
      }),
    };

    service = new ReportsService(mockDb);
  });

  it('should aggregate summary report data accurately across all modules', async () => {
    const config: ReportConfig = {
      reportMode: 'summary',
      startDate: '2026-10-01',
      endDate: '2026-10-30',
      sections: {
        tasksAndProgress: true,
        issues: true,
        inventory: true,
        grn: true,
        materialIssued: true,
        siteTransfer: true,
        attendance: true,
        payables: true,
      },
      filters: { projectId: 'proj-1' },
      includePhotos: false,
    };

    const user = { sub: 'u-1', name: 'Admin User', role: 'ADMIN' };
    const result = await service.getAggregatedReportData('comp-123', user, config);

    expect(result.metadata.projectName).toBe('Skyline Towers Phase 1');
    expect(result.metadata.reportMode).toBe('summary');

    // Tasks summary: 1 completed, 1 in progress -> 70% avg progress
    expect(result.sections.tasksAndProgress?.summary.totalTasks).toBe(2);
    expect(result.sections.tasksAndProgress?.summary.completedTasks).toBe(1);
    expect(result.sections.tasksAndProgress?.summary.inProgressTasks).toBe(1);
    expect(result.sections.tasksAndProgress?.summary.overallProgressPercent).toBe(70);
    expect(result.sections.tasksAndProgress?.summary.totalAllocatedWorkers).toBe(14);

    // Issues summary
    expect(result.sections.issues?.summary.totalIncidents).toBe(1);
    expect(result.sections.issues?.summary.resolved).toBe(1);

    // Inventory summary: mat-1 normal (25), mat-2 low stock (5 <= 50)
    expect(result.sections.inventory?.summary.totalMaterials).toBe(2);
    expect(result.sections.inventory?.summary.normalCount).toBe(1);
    expect(result.sections.inventory?.summary.lowStockCount).toBe(1);

    // Attendance calculations
    // Company Labour: 1 PRESENT = 1.0 day
    // Contractor Labour: 1 HALF_DAY = 0.5 day
    // Workforce: 10 PRESENT + 2 HALF_DAY*0.5 = 11.0 person-days
    // Total = 1 + 0.5 + 11 = 12.5 person-days
    expect(result.sections.attendance?.summary.companyLabourWorkedDays).toBe(1);
    expect(result.sections.attendance?.summary.contractorLabourWorkedDays).toBe(0.5);
    expect(result.sections.attendance?.summary.workforcePersonDays).toBe(11);
    expect(result.sections.attendance?.summary.totalWorkedPersonDays).toBe(12.5);

    // Payables summary
    expect(result.sections.payables?.summary.totalDebits).toBe(3500);
    expect(result.sections.payables?.summary.totalCredits).toBe(10000);
    expect(result.sections.payables?.summary.netExpenses).toBe(-6500);
  });

  it('should generate valid PDFKit document buffer with %PDF- header', async () => {
    const config: ReportConfig = {
      reportMode: 'detailed',
      startDate: '2026-10-01',
      endDate: '2026-10-30',
      sections: {
        tasksAndProgress: true,
        issues: true,
        inventory: true,
        grn: true,
        attendance: true,
        payables: true,
      },
      filters: { projectId: 'proj-1' },
      includePhotos: false,
    };

    const user = { sub: 'u-1', name: 'Admin User', role: 'ADMIN' };
    const aggregated = await service.getAggregatedReportData('comp-123', user, config);

    const pdfBuffer = await ReportsPdfBuilder.generate(aggregated);

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Standard PDF file header
    const header = pdfBuffer.slice(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('should generate valid ExcelJS workbook buffer with standard zip/xlsx header', async () => {
    const extractResult = await service.getExcelExtractData('comp-123', {
      extractType: 'grn',
      projectId: 'proj-1',
      startDate: '2026-10-01',
      endDate: '2026-10-30',
    });

    const excelBuffer = await ReportsExcelBuilder.generateExtractWorkbook({
      title: extractResult.title,
      sheetName: extractResult.sheetName,
      projectName: 'Skyline Towers Phase 1',
      extractedBy: 'Admin User',
      rows: extractResult.rows,
    });

    expect(excelBuffer).toBeDefined();
    expect(excelBuffer.length).toBeGreaterThan(500);
    // Standard XLSX is a zip file, starting with PK (0x50, 0x4B)
    expect(excelBuffer[0]).toBe(0x50);
    expect(excelBuffer[1]).toBe(0x4b);
  });
});
