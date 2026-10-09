export type CastingMemberType =
  | 'Slab'
  | 'Beam'
  | 'Column'
  | 'Footing'
  | 'Pedestal'
  | 'Retaining Wall'
  | 'Staircase'
  | 'Grade Slab'
  | 'Plinth Beam'
  | 'Overhead Tank'
  | 'Other';

export const CASTING_MEMBER_TYPES: CastingMemberType[] = [
  'Slab',
  'Beam',
  'Column',
  'Footing',
  'Pedestal',
  'Retaining Wall',
  'Staircase',
  'Grade Slab',
  'Plinth Beam',
  'Overhead Tank',
  'Other'
];

export type VolumeEntryMethod = 'DIMENSIONAL_CALC' | 'DIRECT_ENGINEER_ENTRY';

export type MemberStatus =
  | 'Planned'
  | 'Shuttering_Ready'
  | 'Rebar_Ready'
  | 'Partially_Poured'
  | 'Poured'
  | 'Completed';

export type EventActivityType =
  | 'Slab_Beam'
  | 'Column_Lift'
  | 'Foundation'
  | 'Retaining_Wall'
  | 'Raft'
  | 'Other';

export type EventStatus = 'PLANNED' | 'POURING' | 'POURED' | 'CANCELLED';

export type SegmentStatus = 'PLANNED' | 'POURED' | 'CANCELLED';

export interface ICastingProject {
  _id?: any;
  companyId: string;
  name: string;
  code: string;
  location?: string;
  clientName?: string;
  contractorName?: string;
  status: 'Active' | 'Completed' | 'On Hold';
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deletionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICastingBlock {
  _id?: any;
  companyId: string;
  projectId: string;
  name: string;
  code: string;
  description?: string;
  displayOrder: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICastingLevel {
  _id?: any;
  companyId: string;
  projectId: string;
  blockId: string;
  name: string;
  floorNumber: number;
  displayOrder: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICastingMember {
  _id?: any;
  companyId: string;
  projectId: string;
  blockId: string;
  levelId: string;
  memberType: CastingMemberType;
  displayId: string;
  description?: string;
  volumeEntryMethod: VolumeEntryMethod;
  dimensions?: {
    lengthMm: number;
    widthMm: number;
    depthMm: number;
  };
  basisOfCalculation?: string;
  totalRequiredVolumeM3: number;
  actualPouredM3: number;
  remainingVolumeM3: number;
  status: MemberStatus;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICastingEventSegment {
  segmentId: string;
  memberId: string;
  projectId: string;
  blockId: string;
  levelId: string;
  segmentName: string;
  segmentLiftNumber: number;
  plannedVolumeM3: number;
  actualVolumeM3?: number;
  status: SegmentStatus;
  remarks?: string;
}

export interface ICastingEvent {
  _id?: any;
  companyId: string;
  projectId: string;
  eventNumber: string;
  title: string;
  activityType: EventActivityType;
  plannedDate: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  plannedTotalVolumeM3: number;
  actualPourDate?: string;
  actualPourStartTime?: string;
  actualPourEndTime?: string;
  actualTotalVolumeM3?: number;
  segments: ICastingEventSegment[];
  status: EventStatus;
  notes?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deletionReason?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
