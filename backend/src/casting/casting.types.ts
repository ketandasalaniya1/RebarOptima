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

export interface ICastingSegmentRecipeBinding {
  recipeId: string;
  recipeCode: string;
  versionNumber: string;
  grade: ConcreteGrade;
  appliedWastagePercent: number;
  isApprovedVersion: boolean;
}

export interface ICastingEventSegment {
  segmentId: string;
  memberId: string;
  projectId: string;
  blockId: string;
  levelId: string;
  segmentName: string;
  segmentLiftNumber: number;
  grade?: ConcreteGrade;
  recipeBinding?: ICastingSegmentRecipeBinding;
  plannedVolumeM3: number;
  actualVolumeM3?: number;
  status: SegmentStatus;
  remarks?: string;
}

export type ConcreteGrade =
  | 'M10'
  | 'M15'
  | 'M20'
  | 'M25'
  | 'M30'
  | 'M35'
  | 'M40'
  | 'M45'
  | 'M50'
  | 'M60'
  | 'M70'
  | 'M80'
  | 'CUSTOM';

export type IngredientCategory =
  | 'CEMENT'
  | 'SUPPLEMENTARY_CEMENTITIOUS'
  | 'FINE_AGGREGATE'
  | 'COARSE_AGGREGATE'
  | 'WATER'
  | 'CHEMICAL_ADMIXTURE'
  | 'READY_MIX_CONCRETE'
  | 'FIBER_OR_SPECIAL';

export type IngredientUnit = 'KG' | 'BAGS_50KG' | 'METRIC_TONNE' | 'LITERS' | 'M3';

export type AggregateMoistureBasis = 'SSD' | 'OVEN_DRY';

export interface IIngredientSpecification {
  ingredientId: string;
  materialIdentifier: string;
  specificationStandard: string;
  name: string;
  category: IngredientCategory;
  quantityPerM3: number;
  baseUnit: IngredientUnit;
  displayUnit: IngredientUnit;
  specificGravity?: number;
  aggregateBasis?: AggregateMoistureBasis;
  waterAbsorptionPercent?: number;
  moistureCorrectionPercent?: number;
  wastageAllowancePercent?: number;
  inventorySkuCode?: string;
}

export interface IEngineeringLimits {
  minCementContentKgPerM3?: number;
  minTotalCementitiousKgPerM3?: number;
  maxTotalCementitiousKgPerM3?: number;
  maxWaterCementRatio?: number;
  maxWaterCementitiousRatio?: number;
  targetSlumpMinMm?: number;
  targetSlumpMaxMm?: number;
  maxNominalAggregateSizeMm?: number;
  designStandardRef?: string;
}

export interface ICastingRecipeVersion {
  versionNumber: string;
  versionNotes?: string;
  mixType: 'SITE_BATCHING' | 'RMC_PROCUREMENT';
  rmcVendorName?: string;
  rmcPlantLocation?: string;
  rmcMixCode?: string;
  engineeringLimits: IEngineeringLimits;
  calculatedWaterCementRatio?: number | null;
  calculatedWaterCementitiousRatio?: number | null;
  waterRatioNotes?: string;
  ingredients: IIngredientSpecification[];
  approvalStatus: 'DRAFT' | 'SUBMITTED_FOR_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED' | 'ARCHIVED';
  submittedBy?: { userId: string; name: string; date: Date };
  approvedBy?: { userId: string; name: string; date: Date; remarks?: string };
  effectiveFrom?: Date;
  effectiveTo?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICastingRecipe {
  _id?: any;
  companyId: string;
  recipeCode: string;
  grade: ConcreteGrade;
  displayName: string;
  description?: string;
  activeApprovedVersion?: string;
  versions: ICastingRecipeVersion[];
  isArchived: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISegmentMaterialRequirement {
  segmentId: string;
  memberId: string;
  memberName: string;
  grade: ConcreteGrade;
  plannedVolumeM3: number;
  recipeCode: string;
  recipeVersion: string;
  appliedWastagePercent: number;
  ingredients: {
    materialIdentifier: string;
    specificationStandard: string;
    name: string;
    category: IngredientCategory;
    baseQuantity: number;
    baseUnit: IngredientUnit;
    displayQuantity: number;
    displayUnit: IngredientUnit;
    specificGravity?: number;
    moistureAdjustment?: {
      status: 'APPLIED' | 'UNVERIFIED_MOISTURE_BASIS' | 'NOT_APPLICABLE';
      surfaceMoisturePercent?: number;
      waterContributedLiters?: number;
      notes?: string;
    };
  }[];
}

export interface IGradeMaterialSubtotal {
  grade: ConcreteGrade;
  totalVolumeM3: number;
  recipeCode: string;
  recipeVersion: string;
  ingredients: {
    materialIdentifier: string;
    specificationStandard: string;
    name: string;
    category: IngredientCategory;
    totalBaseQuantity: number;
    baseUnit: IngredientUnit;
    totalDisplayQuantity: number;
    displayUnit: IngredientUnit;
  }[];
}

export interface IConsolidatedMaterialRequirement {
  materialIdentifier: string;
  specificationStandard: string;
  name: string;
  category: IngredientCategory;
  totalQuantityRequired: number;
  baseUnit: IngredientUnit;
  displayQuantity: number;
  displayUnit: IngredientUnit;
  inventoryStatus: 'SUFFICIENT' | 'SHORTAGE' | 'NOT_TRACKED_IN_INVENTORY';
  availableStock?: number;
  shortageQuantity?: number;
  stockUnit?: string;
}

export interface IMaterialRequirementSheetRevision {
  revisionNumber: number;
  mrsCode: string;
  generatedAt: Date;
  generatedBy: { userId: string; name: string };
  changeReason?: string;
  totalPlannedVolumeM3: number;
  segmentsBreakdown: ISegmentMaterialRequirement[];
  gradeSubtotals: IGradeMaterialSubtotal[];
  consolidatedTotals: IConsolidatedMaterialRequirement[];
  effectiveWaterAdjustmentLiters: number;
  recipeSnapshots: {
    recipeId: string;
    recipeCode: string;
    versionNumber: string;
    grade: ConcreteGrade;
    calculatedWaterCementRatio?: number | null;
    calculatedWaterCementitiousRatio?: number | null;
    engineeringLimits: IEngineeringLimits;
    ingredients: IIngredientSpecification[];
    approvedBy?: { userId: string; name: string; date: Date };
  }[];
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
  
  // Phase 2 MRS Revision Ledger & Concurrency
  mrsRevisionCounter?: number;
  activeMrsRevision?: number;
  isMrsStale?: boolean;
  mrsRevisions?: IMaterialRequirementSheetRevision[];

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
