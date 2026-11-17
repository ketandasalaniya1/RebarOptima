import { ObjectId } from 'mongodb';

export type ActivityProgressMode = 'MANUAL' | 'AUTOMATIC';

export type ActivityStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED';

export interface ActivityWeightageItem {
  childActivityId: ObjectId;
  weightage: number; // Positive number, e.g. 25.0 (0 < weightage <= 100)
}

export interface ActivityWeightagePeriod {
  version: number;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null; // YYYY-MM-DD or null if currently active
  weightages: ActivityWeightageItem[];
  configuredBy: ObjectId;
  configuredByName: string;
  configuredAt: Date;
  changeReason: string;
}

export interface ActivityDoc {
  _id: ObjectId;
  companyId: ObjectId;
  projectId: ObjectId;
  blockId: ObjectId;
  floorId?: ObjectId | null;
  name: string;
  nameLower: string;
  description?: string;
  parentActivityId?: ObjectId | null; // Level 2 child points to Level 1 parent
  assignedUserIds: ObjectId[];
  plannedStartDate: string; // YYYY-MM-DD in IST
  plannedEndDate: string; // YYYY-MM-DD in IST
  actualStartDate?: string | null; // YYYY-MM-DD (auto-stamped when progress > 0%)
  actualCompletionDate?: string | null; // YYYY-MM-DD (auto-stamped when progress == 100%)
  progressMode: ActivityProgressMode;
  currentProgress: number; // 0.00 to 100.00
  status: ActivityStatus;
  weightageHistory?: ActivityWeightagePeriod[];
  version: number; // Optimistic locking
  isArchived: boolean;
  archivedAt?: Date | null;
  createdBy: ObjectId;
  updatedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityDailyUpdateDoc {
  _id: ObjectId;
  activityId: ObjectId;
  companyId: ObjectId;
  projectId: ObjectId;
  blockId: ObjectId;
  floorId?: ObjectId | null;
  updateDate: string; // YYYY-MM-DD (Unique per activity)
  workDescription: string;
  cumulativeProgress: number; // 0.00 to 100.00
  previousProgress: number;
  progressDelta: number;
  isDelayed: boolean;
  delayReason?: string | null;
  remarks?: string | null;
  photoIds: ObjectId[];
  dayLogHistory?: Array<{
    loggedAt: Date;
    progress: number;
    workDescription: string;
    loggedBy: ObjectId;
    loggedByName: string;
  }>;
  editHistory?: Array<{
    editedBy: ObjectId;
    editedByName: string;
    editedAt: Date;
    previousCumulativeProgress: number;
    newCumulativeProgress: number;
    previousWorkDescription: string;
    newWorkDescription: string;
    previousIsDelayed: boolean;
    newIsDelayed: boolean;
    previousDelayReason?: string | null;
    newDelayReason?: string | null;
    correctionReason: string;
  }>;
  createdBy: ObjectId;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityPhotoDoc {
  _id: ObjectId;
  companyId: ObjectId;
  projectId: ObjectId;
  blockId: ObjectId;
  activityId: ObjectId;
  dailyUpdateId?: ObjectId | null;
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number; // Max 10MB (10,485,760 bytes)
  buffer: Buffer; // Raw BSON Binary — Single Canonical Storage
  uploadedBy: ObjectId;
  uploadedByName: string;
  createdAt: Date;
}

export interface ActivityReportItem {
  activityId: string;
  name: string;
  blockName: string;
  floorName?: string;
  parentName?: string;
  isParent: boolean;
  progressMode: ActivityProgressMode;
  status: ActivityStatus;
  isOverdue: boolean;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string | null;
  actualCompletionDate?: string | null;
  startingProgress: number; // As of (startDate - 1)
  endingProgress: number; // As of endDate
  periodProgressDelta: number; // endingProgress - startingProgress
  isDelayed: boolean;
  delayReason?: string | null;
  workDescription?: string;
  photoCount: number;
  hasCorrections: boolean;
  correctionFootnotes: string[];
}

