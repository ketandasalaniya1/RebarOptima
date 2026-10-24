export type MaterialCategory =
  | 'Electrical'
  | 'Plumbing'
  | 'Chemicals'
  | 'Fire Safety'
  | 'Tools & Hardware'
  | 'Stationery'
  | 'Finishing & Paints'
  | 'Safety & PPE'
  | 'Mechanical & Machinery'
  | 'Other';

export type ReturnClassification = 'returnable' | 'non-returnable';

export type IncidentType = 'Missing' | 'Suspected Theft' | 'Damaged' | 'Other Loss';

export type TransactionType =
  | 'OPENING_BALANCE'
  | 'INWARD'
  | 'OUTWARD'
  | 'RETURN_UNUSED'
  | 'RETURN_BORROWED'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT_ADD'
  | 'ADJUSTMENT_DEDUCT';

export type StockStatus = 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface IGeneralProject {
  _id?: any;
  companyId: string;
  name: string;
  code?: string;
  description?: string;
  address?: string;
  status?: 'active' | 'archived';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGeneralStore {
  _id?: any;
  companyId: string;
  projectId: string;
  name: string;
  code?: string;
  location?: string;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGeneralMaterial {
  _id?: any;
  companyId: string;
  projectId: string;
  materialCode?: string;
  name: string;
  category: string;
  subcategory?: string;
  uom: string;
  lowStockThreshold: number;
  brandOrModel?: string;
  sizeOrSpec?: string;
  description?: string;
  preferredVendor?: string;
  remarks?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGeneralStockBalance {
  _id?: any;
  companyId: string;
  projectId: string;
  storeId: string;
  materialId: string;
  currentBalance: number;
  updatedAt?: Date;
}

export interface IGeneralTransaction {
  _id?: any;
  companyId: string;
  projectId: string;
  storeId: string;
  materialId: string;
  materialName?: string;
  uom?: string;
  transactionType: TransactionType;
  quantity: number;
  balanceAfter: number;
  referenceType: 'INWARD' | 'OUTWARD' | 'RETURN' | 'TRANSFER' | 'ADJUSTMENT' | 'OPENING';
  referenceId?: string;
  referenceNumber: string;
  date: Date;
  performedBy: {
    userId: string;
    name: string;
    email?: string;
    role?: string;
  };
  remarks?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface IInwardItem {
  materialId: string;
  materialName: string;
  uom: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  damagedQuantity: number;
  rejectedQuantity: number;
  unitPrice?: number;
  remarks?: string;
}

export interface IInwardEntry {
  _id?: any;
  companyId: string;
  projectId: string;
  storeId: string;
  inwardNumber: string;
  receiptDate: Date;
  vendorName: string;
  vendorContact?: string;
  vendorChallanNumber: string;
  invoiceNumber?: string;
  items: IInwardItem[];
  receivedBy: {
    userId: string;
    name: string;
    email?: string;
    role?: string;
  };
  remarks?: string;
  attachments?: Array<{ name: string; url: string; size?: number }>;
  createdAt: Date;
}

export interface IOutwardEntry {
  _id?: any;
  companyId: string;
  projectId: string;
  storeId: string;
  outwardNumber: string;
  issueDateTime: Date;
  materialId: string;
  materialName: string;
  uom: string;
  quantity: number;
  personReceiving: string;
  issuedBy: {
    userId: string;
    name: string;
    email?: string;
    role?: string;
  };
  agency: string;
  location: string;
  purpose: string;
  returnClassification: ReturnClassification;
  expectedReturnDate?: Date;
  status: 'ISSUED' | 'PARTIALLY_RETURNED' | 'FULLY_RETURNED' | 'CLOSED';
  returnedQuantity: number;
  damagedReturnedQuantity: number;
  missingReturnedQuantity: number;
  outstandingQuantity: number;
  remarks?: string;
  attachments?: Array<{ name: string; url: string; size?: number }>;
  createdAt: Date;
}

export interface IMaterialReturnEntry {
  _id?: any;
  companyId: string;
  projectId: string;
  storeId: string;
  returnNumber: string;
  returnDate: Date;
  returnType: 'UNUSED' | 'BORROWED';
  outwardId: string;
  outwardNumber: string;
  materialId: string;
  materialName: string;
  uom: string;
  returnedByPerson: string;
  receivedBy: {
    userId: string;
    name: string;
    email?: string;
    role?: string;
  };
  acceptedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  remarks?: string;
  createdAt: Date;
}

export interface IStoreTransfer {
  _id?: any;
  companyId: string;
  projectId: string;
  transferNumber: string;
  transferDate: Date;
  sourceStoreId: string;
  sourceStoreName: string;
  destinationStoreId: string;
  destinationStoreName: string;
  materialId: string;
  materialName: string;
  uom: string;
  quantity: number;
  responsibleUser: {
    userId: string;
    name: string;
    email?: string;
    role?: string;
  };
  reference?: string;
  remarks?: string;
  createdAt: Date;
}

export interface IStockVerification {
  _id?: any;
  companyId: string;
  projectId: string;
  storeId: string;
  verificationDate: Date;
  materialId: string;
  materialName: string;
  uom: string;
  systemQuantity: number;
  physicalQuantity: number;
  difference: number;
  responsibleUser: {
    userId: string;
    name: string;
    email?: string;
    role?: string;
  };
  remarks?: string;
  adjustmentCreated?: boolean;
  adjustmentId?: string;
  createdAt: Date;
}

export interface IStockAdjustment {
  _id?: any;
  companyId: string;
  projectId: string;
  storeId: string;
  adjustmentNumber: string;
  adjustmentDate: Date;
  materialId: string;
  materialName: string;
  uom: string;
  adjustmentType: 'ADD' | 'DEDUCT';
  quantity: number;
  reason: string;
  authorizedBy: {
    userId: string;
    name: string;
    email?: string;
    role?: string;
  };
  verificationId?: string;
  createdAt: Date;
}

export interface IIncidentReport {
  _id?: any;
  companyId: string;
  projectId: string;
  storeId: string;
  incidentNumber: string;
  incidentType: IncidentType;
  materialId?: string;
  materialName?: string;
  uom?: string;
  quantity?: number;
  date: Date;
  description: string;
  reportedBy: string;
  status: 'REPORTED' | 'INVESTIGATING' | 'RESOLVED';
  remarks?: string;
  attachments?: Array<{ name: string; url: string; size?: number }>;
  createdAt: Date;
}
