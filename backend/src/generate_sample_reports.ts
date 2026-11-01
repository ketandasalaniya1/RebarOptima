import * as fs from 'fs';
import * as path from 'path';
import { ReportsService } from './reports/reports.service';
import { ReportsPdfBuilder } from './reports/reports.pdf';
import { ReportsExcelBuilder } from './reports/reports.excel';
import { ReportConfig } from './reports/reports.types';

async function generateSampleFiles() {
  const outputDir = path.resolve(__dirname, '../../test-reports-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sampleData: any = {
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: { id: 'usr-1', name: 'Ketan Dasalaniya (Project Director)', role: 'ADMIN' },
      companyId: 'comp-rebar-01',
      projectName: 'Skyline Metropolis - Tower C & Commercial Wing',
      projectCode: 'SKYL-TWR-C',
      startDate: '2026-10-01',
      endDate: '2026-10-30',
      reportMode: 'detailed',
      includePhotos: true,
    },
    sections: {
      tasksAndProgress: {
        summary: {
          totalTasks: 18,
          completedTasks: 11,
          inProgressTasks: 5,
          notStartedTasks: 1,
          blockedTasks: 1,
          overallProgressPercent: 78,
          totalAllocatedWorkers: 42,
        },
        items: [
          { wbsCode: '1.1.2', name: 'Substructure Footing Rebar Tie', status: 'COMPLETED', progressPercentage: 100, plannedFinish: '2026-10-08', assignedUserName: 'Ramesh Steel Works', workerCount: 14, completedQty: 85, plannedQty: 85, unit: 'MT' },
          { wbsCode: '1.2.1', name: 'Basement-1 Retaining Wall Shuttering', status: 'IN_PROGRESS', progressPercentage: 65, plannedFinish: '2026-10-24', assignedUserName: 'Pravin Formwork Gang', workerCount: 18, completedQty: 420, plannedQty: 650, unit: 'm2' },
          { wbsCode: '1.3.4', name: 'Plinth Beam Casting Inspection', status: 'BLOCKED', progressPercentage: 30, plannedFinish: '2026-10-18', assignedUserName: 'Quality Inspector', workerCount: 10, completedQty: 15, plannedQty: 50, unit: 'm3' },
        ],
      },
      issues: {
        summary: {
          totalIncidents: 3,
          reported: 1,
          investigating: 1,
          resolved: 1,
          byType: { Damaged: 2, Missing: 1 },
        },
        items: [
          { incidentNumber: 'INC-2026-0041', date: '2026-10-14', incidentType: 'Damaged', description: 'Rebar coupler threading damage during mechanical unloading', status: 'RESOLVED', reportedBy: 'Pawan K.' },
          { incidentNumber: 'INC-2026-0045', date: '2026-10-22', incidentType: 'Suspected Theft', description: 'Missing 18-gauge binding wire coils from Store 2', status: 'INVESTIGATING', reportedBy: 'Harish Yard Sup.' },
        ],
      },
      inventory: {
        summary: {
          totalMaterials: 8,
          lowStockCount: 2,
          outOfStockCount: 0,
          normalCount: 6,
        },
        items: [
          { materialCode: 'MAT-ST-01', name: 'TMT 12mm Fe550D Rebar', category: 'Civil & Construction', uom: 'MT', currentBalance: 32.5, lowStockThreshold: 10, status: 'NORMAL' },
          { materialCode: 'MAT-ST-02', name: 'TMT 16mm Fe550D Rebar', category: 'Civil & Construction', uom: 'MT', currentBalance: 8.2, lowStockThreshold: 15, status: 'LOW_STOCK' },
          { materialCode: 'MAT-HW-05', name: '18 Gauge Annealed Binding Wire', category: 'Tools & Hardware', uom: 'Kg', currentBalance: 45, lowStockThreshold: 100, status: 'LOW_STOCK' },
        ],
      },
      grn: {
        summary: {
          totalInwardEntries: 4,
          totalReceivedItems: 9,
          totalAcceptedQuantity: 124.5,
          totalDamagedQuantity: 0.8,
          totalVendorsCount: 2,
        },
        items: [
          { inwardNumber: 'INW-2026-0102', receiptDate: '2026-10-11', vendorName: 'Jindal Steel & Power Ltd', vendorChallanNumber: 'JSPL/CH/8821', items: [{ materialName: '16mm TMT Rebar', acceptedQuantity: 45, uom: 'MT' }], receivedBy: 'S. Sharma' },
          { inwardNumber: 'INW-2026-0108', receiptDate: '2026-10-19', vendorName: 'Sail Rebar Stockyard', vendorChallanNumber: 'SAIL-YARD-901', items: [{ materialName: '12mm TMT Rebar', acceptedQuantity: 79.5, uom: 'MT' }], receivedBy: 'S. Sharma' },
        ],
      },
      materialIssued: {
        summary: {
          totalOutwardEntries: 6,
          totalQuantityIssued: 68.2,
          returnableCount: 2,
          nonReturnableCount: 4,
        },
        items: [
          { outwardNumber: 'OUT-2026-0211', issueDateTime: '2026-10-15', materialName: '12mm TMT Rebar', quantity: 24.5, uom: 'MT', personReceiving: 'Ramesh Singh', agency: 'Apex Fixers Gang', location: 'Tower C Raft', purpose: 'Raft Bottom Mat Reinforcement' },
          { outwardNumber: 'OUT-2026-0219', issueDateTime: '2026-10-21', materialName: 'Bar Bending Machine Key', quantity: 1, uom: 'Nos', personReceiving: 'Jagdish Mistri', agency: 'In-house Fab Yard', location: 'Cutting Yard', purpose: 'Machine Adjustment' },
        ],
      },
      siteTransfer: {
        summary: {
          totalTransfers: 2,
          totalQuantityTransferred: 15,
        },
        items: [
          { transferNumber: 'TRF-2026-0012', transferDate: '2026-10-18', sourceStoreName: 'Central Rebar Yard', destinationStoreName: 'Tower C Staging', materialName: '12mm Cut Pieces', quantity: 15, uom: 'MT', responsibleUser: 'N. Verma' },
        ],
      },
      attendance: {
        summary: {
          companyLabourWorkedDays: 142.5,
          contractorLabourWorkedDays: 285.0,
          workforcePersonDays: 614.0,
          totalWorkedPersonDays: 1041.5,
          presentHeadcountTotal: 980,
          halfDayHeadcountTotal: 123,
          absentCount: 38,
        },
        items: [
          { workerName: 'Suresh Patil', category: 'Company Labour', contractorName: 'Self', date: '2026-10-15', status: 'PRESENT', workedDays: 1.0 },
          { workerName: 'Anil Yadav', category: 'Contractor Labour', contractorName: 'Shree Balaji Infra', date: '2026-10-15', status: 'HALF_DAY', workedDays: 0.5 },
          { workerName: 'Shree Sai Fixers Gang (Steel Fixing)', category: 'Contractor Workforce', contractorName: 'Shree Sai Constr.', date: '2026-10-15', status: 'P:24 | H:4', workedDays: 26.0 },
        ],
      },
      payables: {
        summary: {
          totalCredits: 150000,
          totalDebits: 84600,
          netExpenses: 65400,
          transactionCount: 14,
          topCategories: [
            { category: 'Contractor Daily Advance', amount: 45000 },
            { category: 'Machine Diesel & Oil', amount: 22400 },
            { category: 'Crane Rental Unloading', amount: 12000 },
            { category: 'Site Safety Equipment', amount: 5200 },
          ],
        },
        items: [
          { date: '2026-10-14', type: 'DEBIT', category: 'Machine Diesel', amount: 12500, paidTo: 'HP Fuel Station', paymentMode: 'UPI', billNumber: 'HP-4412' },
          { date: '2026-10-18', type: 'DEBIT', category: 'Crane Rental', amount: 12000, paidTo: 'Mahalaxmi Cranes', paymentMode: 'IMPS', billNumber: 'ML-091' },
          { date: '2026-10-10', type: 'CREDIT', category: 'Imprest Refill', amount: 150000, paidTo: 'Site Cash Box', paymentMode: 'Bank Transfer', billNumber: 'HO-881' },
        ],
      },
    },
    photos: [
      { source: 'Incident INC-2026-0041', title: 'Damaged Rebar Coupler Threading', url: 'https://example.com/coupler.jpg', date: '2026-10-14' },
      { source: 'Progress Log 1.1.2', title: 'Foundation Rebar Fixing Completed Inspection', url: 'https://example.com/raft.jpg', date: '2026-10-08' },
    ],
  };

  // 1. Generate Detailed PDF
  console.log('Generating Detailed PDF...');
  const detailedPdfBuf = await ReportsPdfBuilder.generate(sampleData);
  const detailedPdfPath = path.join(outputDir, 'Sample_Detailed_Operational_Report.pdf');
  fs.writeFileSync(detailedPdfPath, detailedPdfBuf);
  console.log(`Saved: ${detailedPdfPath} (${detailedPdfBuf.length} bytes)`);

  // 2. Generate Summary PDF
  console.log('Generating Summary PDF...');
  sampleData.metadata.reportMode = 'summary';
  const summaryPdfBuf = await ReportsPdfBuilder.generate(sampleData);
  const summaryPdfPath = path.join(outputDir, 'Sample_Summary_Executive_Report.pdf');
  fs.writeFileSync(summaryPdfPath, summaryPdfBuf);
  console.log(`Saved: ${summaryPdfPath} (${summaryPdfBuf.length} bytes)`);

  // 3. Generate Excel Extracts
  console.log('Generating Excel Workbook...');
  const excelBuf = await ReportsExcelBuilder.generateExtractWorkbook({
    title: 'Goods Receipt Note (GRN) Extract',
    sheetName: 'GRN Extract',
    projectName: 'Skyline Metropolis',
    startDate: '2026-10-01',
    endDate: '2026-10-30',
    extractedBy: 'Ketan Dasalaniya',
    rows: [
      { inwardNumber: 'INW-2026-0102', receiptDate: '2026-10-11', vendorName: 'Jindal Steel & Power Ltd', vendorChallanNumber: 'JSPL/CH/8821', invoiceNumber: 'INV-9901', materialName: '16mm TMT Rebar', receivedQty: 45, acceptedQty: 45, damagedQty: 0, uom: 'MT', unitPrice: 58000, totalValue: 2610000, receivedBy: 'S. Sharma' },
      { inwardNumber: 'INW-2026-0108', receiptDate: '2026-10-19', vendorName: 'Sail Rebar Stockyard', vendorChallanNumber: 'SAIL-YARD-901', invoiceNumber: 'SAIL-884', materialName: '12mm TMT Rebar', receivedQty: 80, acceptedQty: 79.5, damagedQty: 0.5, uom: 'MT', unitPrice: 59500, totalValue: 4730250, receivedBy: 'S. Sharma' },
    ],
  });
  const excelPath = path.join(outputDir, 'Sample_GRN_Extract_Report.xlsx');
  fs.writeFileSync(excelPath, excelBuf);
  console.log(`Saved: ${excelPath} (${excelBuf.length} bytes)`);

  console.log('ALL SAMPLE REPORTS GENERATED SUCCESSFULLY!');
}

generateSampleFiles().catch(err => {
  console.error('Error generating sample files:', err);
  process.exit(1);
});
