export type BBSMemberType =
  | 'Footing'
  | 'Tie Beam'
  | 'Pedestal'
  | 'Retaining Wall'
  | 'Grade Slab'
  | 'Column'
  | 'Staircase'
  | 'Lift Wall'
  | 'Beam'
  | 'Slab'
  | 'Chajja'
  | 'Overhead Water Tank'
  | 'Special Requirement';

export const BBS_MEMBER_TYPES: BBSMemberType[] = [
  'Footing',
  'Tie Beam',
  'Pedestal',
  'Retaining Wall',
  'Grade Slab',
  'Column',
  'Staircase',
  'Lift Wall',
  'Beam',
  'Slab',
  'Chajja',
  'Overhead Water Tank',
  'Special Requirement'
];

export interface IBBSProject {
  _id?: any;
  companyId: string;
  name: string;
  location?: string;
  description?: string;
  status: 'Planning' | 'Active' | 'Completed' | 'On Hold';
  createdAt: Date;
  updatedAt: Date;
}

export interface IBBSBlock {
  _id?: any;
  projectId: string;
  companyId: string;
  name: string;
  code?: string;
  description?: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBBSLevel {
  _id?: any;
  projectId: string;
  blockId: string;
  companyId: string;
  name: string;
  code?: string;
  description?: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBBSMember {
  _id?: any;
  projectId: string;
  blockId: string;
  levelId: string;
  companyId: string;
  memberType: BBSMemberType;
  displayId: string; // e.g. "C1", "B2"
  description?: string;
  completionPercentage: number; // 0 or 100 for Phase 1
  createdAt: Date;
  updatedAt: Date;
}
