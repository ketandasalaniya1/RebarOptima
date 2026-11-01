export type ReportFormat = 'PDF' | 'EXCEL';
export type ReportType = 'detailed' | 'summary';
export type DurationPreset = 'today' | '7days' | '15days' | 'custom';

export interface ReportSectionsSelection {
  tasksAndProgress?: boolean;
  issues?: boolean;
  inventory?: boolean;
  grn?: boolean;
  materialIssued?: boolean;
  siteTransfer?: boolean;
  attendance?: boolean;
  payables?: boolean;
  indent?: boolean; // Reserved / Disabled
  purchaseOrder?: boolean; // Reserved / Disabled
}

export interface ReportFilters {
  projectId?: string;
  projectIds?: string[];
  blockId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  contractorId?: string;
  workCategory?: string;
  userId?: string;
  includePhotos?: boolean;
  selectedPhotoIds?: string[];
}

export interface ReportConfig {
  reportMode: ReportType; // 'detailed' | 'summary'
  preset?: DurationPreset;
  startDate: string;
  endDate: string;
  sections: ReportSectionsSelection;
  filters: ReportFilters;
  includePhotos: boolean;
}

export interface ExcelExportConfig {
  extractType:
    | 'grn'
    | 'material_issued'
    | 'stock_inventory'
    | 'labour_attendance'
    | 'contractor_workforce'
    | 'petty_cash_expenses'
    | 'task_progress'
    | 'site_incidents'
    | 'site_transfers';
  projectId?: string;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, any>;
}

export interface AggregatedReportData {
  metadata: {
    generatedAt: string;
    generatedBy: {
      id: string;
      name: string;
      role?: string;
    };
    companyId: string;
    companyName?: string;
    projectName: string;
    projectId?: string;
    projectCode?: string;
    startDate: string;
    endDate: string;
    reportMode: ReportType;
    includePhotos: boolean;
  };
  sections: {
    tasksAndProgress?: {
      summary: {
        totalTasks: number;
        completedTasks: number;
        inProgressTasks: number;
        notStartedTasks: number;
        blockedTasks: number;
        overallProgressPercent: number;
        totalAllocatedWorkers: number;
      };
      items?: any[];
    };
    issues?: {
      summary: {
        totalIncidents: number;
        reported: number;
        investigating: number;
        resolved: number;
        byType: Record<string, number>;
      };
      items?: any[];
    };
    inventory?: {
      summary: {
        totalMaterials: number;
        lowStockCount: number;
        outOfStockCount: number;
        normalCount: number;
      };
      items?: any[];
    };
    grn?: {
      summary: {
        totalInwardEntries: number;
        totalReceivedItems: number;
        totalAcceptedQuantity: number;
        totalDamagedQuantity: number;
        totalVendorsCount: number;
      };
      items?: any[];
    };
    materialIssued?: {
      summary: {
        totalOutwardEntries: number;
        totalQuantityIssued: number;
        returnableCount: number;
        nonReturnableCount: number;
      };
      items?: any[];
    };
    siteTransfer?: {
      summary: {
        totalTransfers: number;
        totalQuantityTransferred: number;
      };
      items?: any[];
    };
    attendance?: {
      summary: {
        companyLabourWorkedDays: number;
        contractorLabourWorkedDays: number;
        workforcePersonDays: number;
        totalWorkedPersonDays: number;
        presentHeadcountTotal: number;
        halfDayHeadcountTotal: number;
        absentCount: number;
      };
      items?: any[];
    };
    payables?: {
      summary: {
        totalCredits: number;
        totalDebits: number;
        netExpenses: number;
        transactionCount: number;
        topCategories: Array<{ category: string; amount: number }>;
      };
      items?: any[];
    };
  };
  photos?: Array<{
    source: string;
    title: string;
    url: string;
    date?: string;
  }>;
}
