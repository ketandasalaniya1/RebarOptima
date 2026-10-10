import { ObjectId } from 'mongodb';

export type CementType = 'OPC' | 'PPC' | 'PSC' | 'GGBS_BLEND' | 'FLY_ASH_BLEND';

export type CuringMethod = 'PONDING' | 'WET_BURLAP_HESSIAN' | 'CURING_COMPOUND' | 'SPRINKLING';

export type EnvironmentalFlag = 'NORMAL' | 'HOT_WEATHER_ARID';

export type CuringScheduleStatus =
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'INTERRUPTED'
  | 'COMPLETED'
  | 'SUSPENDED';

export interface ICuringSchedule {
  _id?: any;
  companyId: string;
  projectId: string;
  scheduleCode: string;                      // e.g. "CUR-SCH-2026-0001"
  eventId: string;                           // References casting_events._id
  consumptionRecordId?: string;              // References casting_consumption_records._id
  memberId: string;                          // References casting_members._id
  segmentId: string;                         // References segment within event
  segmentName: string;
  cementType: CementType;
  curingMethod: CuringMethod;
  environmentalFlag: EnvironmentalFlag;
  requiredDurationDays: number;              // 7, 10, or 14 (or higher engineer-specified)
  sessionsPerDay: number;                    // 1, 2, or 3 inspections daily
  startDate: string;                         // YYYY-MM-DD
  scheduledEndDate: string;                  // YYYY-MM-DD
  status: CuringScheduleStatus;
  createdBy: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  approvedBy?: {
    userId: string;
    name: string;
    email: string;
    role: string;
    approvedAt: Date;
    remarks?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ICuringDailyLog {
  _id?: any;
  companyId: string;
  projectId: string;
  curingScheduleId: string;                  // References curing_schedules._id
  logDate: string;                           // YYYY-MM-DD
  sessionIndex: number;                      // 1..sessionsPerDay
  idempotencyKey: string;                    // "CURLOG__C{cid}__SCH{id}__D{logDate}__S{sessionIndex}"
  isAdequatelyWet: boolean;
  waterCoveragePercent: number;              // 0 to 100%
  methodSpecificChecks: {
    pondingDepthMm?: number;                 // For PONDING (target >= 25mm)
    hessianMoistureState?: 'DRY' | 'DAMP' | 'SATURATED'; // For WET_BURLAP_HESSIAN
    membraneUniformlyIntact?: boolean;       // For CURING_COMPOUND
  };
  interruptionLogged: boolean;
  interruptionReason?: string;
  remedialActionTaken?: string;
  inspector: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  photoKeys: string[];                       // Private object storage keys
  isSuperseded: boolean;                     // Non-destructive compensating correction
  supersededByLogId?: string;
  correctionReason?: string;
  createdAt: Date;
}

export interface ICubeSpecimen {
  specimenIndex: 1 | 2 | 3;
  weightKg: number;
  failureLoadKn: number;
  crossSectionalAreaMm2: number;             // Standard 150x150 mm = 22500 mm²
  compressiveStrengthMpa: number;            // (failureLoadKn * 1000) / area
  testedAt: Date;
}

export interface ICubeTestRegister {
  _id?: any;
  companyId: string;
  projectId: string;
  eventId: string;                           // References casting_events._id
  consumptionRecordId?: string;              // References casting_consumption_records._id
  segmentId?: string;
  sampleCode: string;                        // Unique: "SMP-{year}-{seq}"
  concreteGrade: string;                     // e.g. "M25"
  fck: number;                               // 25.0 N/mm²
  batchTime: Date;
  testAgeDays: 7 | 28;
  specimens: [ICubeSpecimen, ICubeSpecimen, ICubeSpecimen];
  sampleAverageStrengthMpa: number | null;   // Null if invalid
  maxSpecimenDeviationPercent: number;       // IS 456 Cl 15.4 deviation
  specimenValidityStatus: 'VALID_SAMPLE' | 'INVALID_SAMPLE';
  testingMachineId: string;
  calibrationValidUntil?: Date;
  testedBy: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  createdAt: Date;
}

export type Table11Pathway =
  | 'PATHWAY_A' // N >= 4 Consecutive (Table 11 Col 2/3)
  | 'PATHWAY_B' // V <= 30m³, N in {2, 3} (Table 11 Note 2a)
  | 'PATHWAY_C' // V <= 30m³, N = 1 (Table 11 Note 2b)
  | 'PATHWAY_D' // V > 30m³, N < 4 (Out of Note 2 scope)
  | 'PATHWAY_E'; // N < Required samples under Cl 15.2.2 (Deficient Sampling)

export type ComplianceStatus =
  | 'MEETS_CRITERIA'
  | 'DOES_NOT_MEET_CRITERIA'
  | 'INVALID_SAMPLE'
  | 'UNVERIFIED_PENDING_ENGINEER_EVALUATION';

export interface ICubeComplianceEvaluation {
  _id?: any;
  companyId: string;
  projectId: string;
  evaluationCode: string;                    // "EVAL-CUB-{year}-{seq}"
  eventId: string;                           // References casting_events._id
  consumptionRecordId?: string;
  concreteGrade: string;
  fck: number;
  totalVolumeM3: number;
  shiftsCount: number;
  requiredSampleCount: number;
  evaluatedSampleIds: string[];
  validSampleCount: number;
  invalidSampleCount: number;
  pathwayApplied: Table11Pathway;
  standardDeviationSpec: {
    provenance: 'PLANT_ESTABLISHED_30_SAMPLES' | 'IS_456_TABLE_8_ASSUMED';
    siteControlDegree: 'GOOD' | 'FAIR';
    baseSigma: number;
    penaltyApplied: number;
    effectiveSigma: number;
    roundedMargin: number;                   // 0.825 * effectiveSigma rounded to nearest 0.5
    approvedByEngineerId?: string;
  };
  metrics: {
    sampleResults: number[];                 // MPa
    groupMeanMpa?: number;
    requiredMeanMpa?: number;
    meanSatisfied?: boolean;
    lowestSampleMpa?: number;
    requiredIndividualMinMpa?: number;
    individualSatisfied?: boolean;
  };
  complianceStatus: ComplianceStatus;
  deficientSamplingAlert: boolean;
  deficiencyReasons: string[];
  evaluatedAt: Date;
}

export type EngineerReviewDecision =
  | 'ACCEPTED_FOR_CONSTRUCTION'
  | 'REJECTED'
  | 'CONDITIONAL_NON_DESTRUCTIVE_TESTING'
  | 'CORE_TESTING_MANDATED';

export interface ICubeEngineerReview {
  _id?: any;
  companyId: string;
  projectId: string;
  evaluationId: string;                      // References cube_compliance_evaluations._id
  formalDecision: EngineerReviewDecision;
  engineer: {
    userId: string;
    name: string;
    email: string;
    role: string;
    registrationId: string;                  // License / council reg ID
  };
  technicalRationale: string;
  correctiveMeasures?: string;
  signatureSha256: string;                   // Digital audit signature
  reviewedAt: Date;
}

export interface ICastingTrackSheetSignoff {
  _id?: any;
  companyId: string;
  projectId: string;
  eventId: string;                           // References casting_events._id
  consumptionRecordId?: string;              // References casting_consumption_records._id
  segmentId: string;
  memberId: string;
  curingCompletedAndSatisfactory: boolean;
  cubeStrengthAccepted: boolean;
  scopeOfSignoff: 'MATERIAL_AND_CURING_QUALITY_ACCEPTANCE'; // NOT formwork striking
  qualityStatus: 'APPROVED' | 'HOLD' | 'REJECTED';
  signedOffBy: {
    userId: string;
    name: string;
    email: string;
    role: string;
  };
  makerUserId: string;                       // Author of consumption/curing (anti-self-approval)
  signoffNotes: string;
  signedOffAt: Date;
}
