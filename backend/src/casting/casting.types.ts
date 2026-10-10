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

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — ACTUAL CASTING, MATERIAL CONSUMPTION, APPROVAL & INVENTORY POSTING
// ══════════════════════════════════════════════════════════════════════════════

export type CanonicalUnit = 'KG' | 'LITERS';

export type VarianceClassification =
  | 'EXACT_MATCH'
  | 'UNDER_CONSUMPTION_NORMAL'
  | 'UNDER_CONSUMPTION_HIGH'
  | 'OVER_CONSUMPTION_TOLERABLE'
  | 'OVER_CONSUMPTION_MODERATE'
  | 'OVER_CONSUMPTION_HIGH'
  | 'UNBUDGETED';

export type ConsumptionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REJECTED'
  | 'APPROVED_POSTED'
  | 'REVERSED';

export type CastingStockTransactionType =
  | 'CASTING_INWARD'
  | 'CASTING_CONSUMPTION_OUTWARD'
  | 'CASTING_REVERSAL'
  | 'CASTING_ADJUSTMENT';

export interface ICastingMaterialConsumptionItem {
  materialIdentifier: string;
  specificationStandard: string;
  name: string;
  category: IngredientCategory;
  plannedQuantity: number;
  actualQuantity: number;
  canonicalUnit: CanonicalUnit;
  enteredQuantity?: number;
  enteredUnit?: IngredientUnit;
  varianceQuantity: number; // actualQuantity - plannedQuantity
  variancePercentage: number | null; // null if plannedQuantity === 0
  varianceClassification: VarianceClassification;
  wastageReasonCode?: string;
  remarks?: string;
  isUntrackedBulk?: boolean;
}

export interface ICastingSegmentActual {
  segmentId: string;
  memberId: string;
  segmentName: string;
  grade: ConcreteGrade;
  recipeCode: string;
  recipeVersion: string;
  plannedVolumeM3: number;
  actualVolumeM3: number;
  varianceVolumeM3: number;
  pourStartTime?: string;
  pourEndTime?: string;
  transitMixerChallans?: string[];
  testCubeBatchIds?: string[];
  status: 'POURED' | 'PARTIAL' | 'ABORTED';
}

export interface ICastingPostingReceipt {
  _id?: any;
  postingKey: string;
  companyId: string;
  projectId: string;
  eventId: string;
  consumptionRecordId: string;
  postingNumber: string;
  status: 'COMMITTED';
  postedAt: Date;
  postedBy: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  itemsCount: number;
  totalActualVolumeM3: number;
  isDuplicateReplay?: boolean;
}

export interface ICastingInwardItem {
  materialIdentifier: string;
  specificationStandard: string;
  name: string;
  category: IngredientCategory;
  enteredQuantity: number;
  enteredUnit: IngredientUnit;
  canonicalQuantity: number;
  canonicalUnit: CanonicalUnit;
  unitCost?: number;
  specificGravity?: number;
  remarks?: string;
}

export interface ICastingInwardReceipt {
  _id?: any;
  inwardKey: string;
  companyId: string;
  projectId: string;
  challanNumber: string;
  vendorName: string;
  vendorGstin?: string;
  vehicleNumber?: string;
  deliveryDate: string;
  itemsCount: number;
  items: ICastingInwardItem[];
  receivedAt: Date;
  receivedBy: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  remarks?: string;
  isDuplicateReplay?: boolean;
}

export interface ICastingReversalReceipt {
  _id?: any;
  reversalKey: string;
  originalPostingKey: string;
  companyId: string;
  projectId: string;
  eventId: string;
  consumptionRecordId: string;
  reversalReason: string;
  itemsCount: number;
  reversedAt: Date;
  reversedBy: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  isDuplicateReplay?: boolean;
}

export interface ICastingStockTransaction {
  _id?: any;
  operationKey: string; // postingKey | inwardKey | reversalKey
  lineIndex: number;
  transactionType: CastingStockTransactionType;
  companyId: string;
  projectId: string;
  materialIdentifier: string;
  specificationStandard: string;
  name: string;
  category: IngredientCategory;
  canonicalQuantity: number; // strictly positive magnitude
  canonicalUnit: CanonicalUnit;
  enteredQuantity?: number;
  enteredUnit?: IngredientUnit;
  conversionFactor?: number;
  originalTransactionId?: any; // populated for CASTING_REVERSAL
  originalOperationKey?: string;
  isUntrackedBulk?: boolean;
  postedBy: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  createdAt: Date;
}

export interface ICastingMaterialStock {
  _id?: any;
  companyId: string;
  projectId: string;
  materialIdentifier: string;
  specificationStandard: string;
  name: string;
  category: IngredientCategory;
  canonicalUnit: CanonicalUnit;
  currentBalance: number;
  minimumThreshold?: number;
  updatedAt: Date;
}

export interface ICastingActualConsumptionRecord {
  _id?: any;
  companyId: string;
  projectId: string;
  eventId: string;
  eventNumber: string;
  consumptionCode: string;
  mrsRevisionNumber: number;
  mrsCode: string;
  actualPourDate: string;
  actualPourStartTime?: string;
  actualPourEndTime?: string;
  totalPlannedVolumeM3: number;
  totalActualVolumeM3: number;
  varianceVolumeM3: number;
  segmentsActual: ICastingSegmentActual[];
  materialsConsumed: ICastingMaterialConsumptionItem[];
  status: ConsumptionStatus;
  
  // Maker-Checker & Approvals
  createdBy: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  submittedBy?: {
    userId: string;
    name: string;
    email: string;
    role: string;
    date: Date;
  };
  approvedBy?: {
    userId: string;
    name: string;
    email: string;
    role: string;
    date: Date;
    remarks?: string;
  };
  rejectedBy?: {
    userId: string;
    name: string;
    email: string;
    role: string;
    date: Date;
    reason: string;
  };
  
  // Posting & Reversal References
  postingReceiptId?: any;
  postingReceipt?: ICastingPostingReceipt;
  reversalReceiptId?: any;
  reversalReceipt?: ICastingReversalReceipt;
  
  weatherConditions?: string;
  batchingPlantName?: string;
  generalNotes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

