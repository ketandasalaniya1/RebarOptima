import { ObjectId } from 'mongodb';

export type WorkflowStatus =
  | 'Draft'
  | 'Under Review'
  | 'Changes Requested'
  | 'Pending Approval'
  | 'Approved'
  | 'Published'
  | 'Rejected'
  | 'Withdrawn'
  | 'Superseded';

export type TransmittalPurpose =
  | 'For Construction'
  | 'For Approval'
  | 'For Information'
  | 'For Review'
  | 'As-Built'
  | 'Tender';

export type ModuleRole =
  | 'admin'
  | 'controller'
  | 'uploader'
  | 'reviewer'
  | 'approver'
  | 'readonly';

export interface IInternalProject {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  projectCode: string; // e.g. "AH", "RVT", "GV"
  projectName: string; // e.g. "Alpha Heights"
  location: string;
  description?: string;
  status: 'Active' | 'On Hold' | 'Archived';
  drawingCount?: number;
  latestRevisionDate?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IDiscipline {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  code: string; // e.g. "ARCH", "STR", "MEPF", "PASS", "LAND", "INT", "OTH"
  name: string; // e.g. "Architectural", "Structural"
  color: string;
  description?: string;
  order: number;
  isDefault: boolean;
  drawingCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IDrawing {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  projectId: ObjectId | string;
  projectCode: string;
  projectName: string;
  disciplineId: ObjectId | string;
  disciplineCode: string;
  disciplineName: string;
  drawingNumber: string; // Unique within project scope, e.g. "AR-F-001", "ST-S-101"
  title: string; // e.g. "Ground Floor Plan"
  description?: string;
  drawingType: string; // "General Arrangement", "Reinforcement Plan", "Schematic", "Detail"
  currentRevisionId?: ObjectId | string;
  currentRevisionNumber?: string; // e.g. "R02"
  currentStatus: WorkflowStatus;
  assignedControllerId?: string;
  assignedControllerName?: string;
  tags?: string[];
  isArchived: boolean;
  createdBy: string;
  createdById?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IDrawingRevision {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  drawingId: ObjectId | string;
  drawingNumber: string;
  revisionNumber: string; // e.g. "R00", "R01", "R02"
  sequenceNumber: number; // 0, 1, 2...
  fileId?: ObjectId | string;
  fileName: string;
  fileSize: number;
  fileType: string; // "pdf", "dwg", "png", "svg"
  checksumSha256: string;
  changeDescription: string;
  changeReason?: string;
  workflowStatus: WorkflowStatus;
  isPublished: boolean;
  isSuperseded: boolean;
  uploadedById: string;
  uploadedByName: string;
  uploadedAt: Date | string;
  supersededAt?: Date | string;
  supersededByRevisionId?: ObjectId | string;
  approvedAt?: Date | string;
  approvedById?: string;
  approvedByName?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IStoredFile {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedById: string;
  uploadedByName: string;
  fileData?: string; // base64 representation if in-memory or small vector preview
  createdAt: Date | string;
}

export interface IReviewAssignment {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  drawingId: ObjectId | string;
  revisionId: ObjectId | string;
  drawingNumber: string;
  revisionNumber: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string; // e.g. "Structural Reviewer", "Lead Architect"
  isMandatory: boolean;
  status: 'Pending' | 'Reviewed' | 'Changes Requested';
  comments?: string;
  reviewedAt?: Date | string;
  createdAt: Date | string;
}

export interface IApprovalRecord {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  drawingId: ObjectId | string;
  revisionId: ObjectId | string;
  drawingNumber: string;
  revisionNumber: string;
  decision: 'Approved' | 'Rejected' | 'Changes Requested';
  approverId: string;
  approverName: string;
  approverRole: string;
  comments: string;
  decidedAt: Date | string;
  createdAt: Date | string;
}

export interface ITransmittalItem {
  drawingId: ObjectId | string;
  drawingNumber: string;
  title: string;
  revisionNumber: string;
  fileId?: ObjectId | string;
  status: WorkflowStatus;
}

export interface ITransmittalRecipient {
  name: string;
  organization: string;
  email?: string;
  role: string;
}

export interface ITransmittal {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  transmittalNumber: string; // e.g. "TR-2024-010"
  projectId: ObjectId | string;
  projectCode: string;
  projectName: string;
  purpose: TransmittalPurpose;
  issueDate: string; // ISO date or "YYYY-MM-DD"
  issuedById: string;
  issuedByName: string;
  recipients: ITransmittalRecipient[];
  notes?: string;
  items: ITransmittalItem[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IModuleMembership {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  userId: string;
  userName: string;
  userEmail: string;
  role: ModuleRole;
  assignedDisciplines?: string[]; // empty means all
  status: 'Active' | 'Inactive';
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IActivityEvent {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  entityType: 'project' | 'discipline' | 'drawing' | 'revision' | 'review' | 'approval' | 'transmittal' | 'settings';
  entityId: string;
  action: string; // e.g. "DRAWING_CREATED", "REVISION_UPLOADED", "REVIEW_COMPLETED", "APPROVED", "PUBLISHED", "TRANSMITTAL_ISSUED"
  title: string;
  description: string;
  drawingNumber?: string;
  revisionNumber?: string;
  performedById: string;
  performedByName: string;
  metadata?: any;
  createdAt: Date | string;
}

export interface IModuleSettings {
  _id?: ObjectId | string;
  companyId: ObjectId | string;
  numberingConvention: string; // e.g. "{PROJECT}-{DISCIPLINE}-{SEQ}"
  revisionFormat: 'R00' | 'A'; // "R00, R01..." or "A, B, C..."
  allowSelfApproval: boolean;
  mandatoryReviewsRequired: boolean;
  storageQuotaBytes: number;
  allowedExtensions: string[];
  updatedAt: Date | string;
}
