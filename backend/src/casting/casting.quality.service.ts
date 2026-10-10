import crypto from 'crypto';
import {
  CementType,
  EnvironmentalFlag,
  ICubeSpecimen,
  ICubeTestRegister,
  ICubeComplianceEvaluation,
  Table11Pathway,
  ComplianceStatus
} from './casting.quality.types';

// ══════════════════════════════════════════════════════════════════════════════
// 1. SPECIMEN CRUSH & VALIDITY EVALUATION (IS 456:2000 Clause 15.4)
// ══════════════════════════════════════════════════════════════════════════════

export interface ISpecimenValidationResult {
  isValid: boolean;
  status: 'VALID_SAMPLE' | 'INVALID_SAMPLE';
  sampleAverageStrengthMpa: number | null;
  maxSpecimenDeviationPercent: number;
  individualDeviations: number[];
  specimenStrengths: number[];
  rejectionReason?: string;
}

export function evaluateSpecimensValidity(
  specimens: ICubeSpecimen[]
): ISpecimenValidationResult {
  if (!Array.isArray(specimens) || specimens.length !== 3) {
    throw new Error('A standard concrete test sample must contain exactly 3 test specimens (IS 456 Clause 15.3).');
  }

  // Calculate compressive strength for each cube: Failure load (N) / Area (mm²)
  const specimenStrengths = specimens.map(s => {
    const area = Number(s.crossSectionalAreaMm2) || 22500; // standard 150x150 mm
    const loadN = Number(s.failureLoadKn) * 1000;
    const strength = Math.round((loadN / area) * 100) / 100; // 2 decimal precision
    return strength;
  });

  const sum = specimenStrengths.reduce((acc, str) => acc + str, 0);
  const average = Math.round((sum / 3) * 100) / 100;

  if (average <= 0) {
    return {
      isValid: false,
      status: 'INVALID_SAMPLE',
      sampleAverageStrengthMpa: null,
      maxSpecimenDeviationPercent: 100,
      individualDeviations: [100, 100, 100],
      specimenStrengths,
      rejectionReason: 'Average sample strength must be greater than zero.'
    };
  }

  // Calculate individual variations from the average in percentage: |x_i - avg| / avg * 100
  const individualDeviations = specimenStrengths.map(str => {
    const dev = (Math.abs(str - average) / average) * 100;
    return Math.round(dev * 100) / 100;
  });

  const maxSpecimenDeviationPercent = Math.max(...individualDeviations);

  // IS 456 Clause 15.4: "The individual variation should not be more than ±15 percent of the average.
  // If more, the test results of the sample are invalid."
  // Note: Two-cube averaging is strictly forbidden. The entire sample is invalid.
  if (maxSpecimenDeviationPercent > 15.0) {
    return {
      isValid: false,
      status: 'INVALID_SAMPLE',
      sampleAverageStrengthMpa: null,
      maxSpecimenDeviationPercent,
      individualDeviations,
      specimenStrengths,
      rejectionReason: `Individual specimen variation (${maxSpecimenDeviationPercent.toFixed(1)}%) exceeds maximum permissible ±15% of average (IS 456 Cl 15.4). Sample is invalid; averaging two cubes is prohibited.`
    };
  }

  return {
    isValid: true,
    status: 'VALID_SAMPLE',
    sampleAverageStrengthMpa: average,
    maxSpecimenDeviationPercent,
    individualDeviations,
    specimenStrengths
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. SAMPLING FREQUENCY CALCULATOR (IS 456:2000 Clause 15.2.2 & Shift Rule)
// ══════════════════════════════════════════════════════════════════════════════

export function calculateRequiredSamples(volumeM3: number, shiftsCount: number = 1): number {
  const vol = Number(volumeM3) || 0;
  const shifts = Math.max(1, Number(shiftsCount) || 1);

  let scaleRequired = 1;
  if (vol <= 0) {
    scaleRequired = 1;
  } else if (vol <= 5.0) {
    scaleRequired = 1;
  } else if (vol <= 15.0) {
    scaleRequired = 2;
  } else if (vol <= 30.0) {
    scaleRequired = 3;
  } else if (vol <= 50.0) {
    scaleRequired = 4;
  } else {
    // 51 and above: 4 plus one additional sample for each additional 50 m³ or part thereof
    scaleRequired = 4 + Math.ceil((vol - 50.0) / 50.0);
  }

  // Shift Rule: "At least one sample shall be taken from each shift."
  return Math.max(scaleRequired, shifts);
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. STANDARD DEVIATION & MARGIN GOVERNANCE (IS 456 Table 8 & Table 9 & Cl 9.2.4.2)
// ══════════════════════════════════════════════════════════════════════════════

export interface IStandardDeviationEvaluation {
  baseSigma: number;
  penaltyApplied: number;
  effectiveSigma: number;
  roundedMargin: number; // 0.825 * effectiveSigma rounded to nearest 0.5 N/mm²
}

export function evaluateStandardDeviation(
  grade: string,
  spec: {
    provenance: 'PLANT_ESTABLISHED_30_SAMPLES' | 'IS_456_TABLE_8_ASSUMED';
    siteControlDegree: 'GOOD' | 'FAIR';
    customSigma?: number;
  },
  historicalSamplesCount: number = 0
): IStandardDeviationEvaluation {
  const upperGrade = (grade || 'M25').toUpperCase();

  // Table 8 Base Assumed Standard Deviation
  let table8Base = 4.0;
  if (upperGrade === 'M10' || upperGrade === 'M15') {
    table8Base = 3.5;
  } else if (upperGrade === 'M20' || upperGrade === 'M25') {
    table8Base = 4.0;
  } else {
    // M30, M35, M40, M45, M50, M60+
    table8Base = 5.0;
  }

  if (spec.provenance === 'PLANT_ESTABLISHED_30_SAMPLES') {
    // IS 456 Cl 9.2.4.2.1(a): Requires at least 30 consecutive samples taken over not less than 40 days
    if (historicalSamplesCount < 30) {
      throw new Error(
        `INSUFFICIENT_HISTORICAL_POPULATION_FOR_SD: Plant-established standard deviation requires minimum 30 historical samples (IS 456 Cl 9.2.4.2.1). Found only ${historicalSamplesCount}.`
      );
    }
    const effSigma = Number(spec.customSigma) > 0 ? Number(spec.customSigma) : table8Base;
    const rawMargin = 0.825 * effSigma;
    const roundedMargin = Math.round(rawMargin * 2) / 2; // round to nearest 0.5

    return {
      baseSigma: effSigma,
      penaltyApplied: 0,
      effectiveSigma: effSigma,
      roundedMargin
    };
  }

  // IS 456 Table 8 Assumed Standard Deviation
  // Note: "When site control is 'fair' (see Table 9), the values given in Table 8 shall be increased by 1 N/mm²."
  const penaltyApplied = spec.siteControlDegree === 'FAIR' ? 1.0 : 0.0;
  const effectiveSigma = table8Base + penaltyApplied;
  const rawMargin = 0.825 * effectiveSigma;
  const roundedMargin = Math.round(rawMargin * 2) / 2; // round to nearest 0.5 N/mm²

  return {
    baseSigma: table8Base,
    penaltyApplied,
    effectiveSigma,
    roundedMargin
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. OBJECTIVE COMPLIANCE ENGINE (IS 456:2000 Amd 4 Table 11 & Note 2)
// ══════════════════════════════════════════════════════════════════════════════

export interface IComplianceEngineInput {
  fck: number;
  totalVolumeM3: number;
  shiftsCount: number;
  sampleRegisters: ICubeTestRegister[];
  standardDeviationSpec: {
    provenance: 'PLANT_ESTABLISHED_30_SAMPLES' | 'IS_456_TABLE_8_ASSUMED';
    siteControlDegree: 'GOOD' | 'FAIR';
    customSigma?: number;
  };
  historicalSamplesCount?: number;
}

export interface IComplianceEngineOutput {
  pathwayApplied: Table11Pathway;
  complianceStatus: ComplianceStatus;
  deficientSamplingAlert: boolean;
  deficiencyReasons: string[];
  requiredSampleCount: number;
  validSampleCount: number;
  invalidSampleCount: number;
  standardDeviationSpec: {
    provenance: 'PLANT_ESTABLISHED_30_SAMPLES' | 'IS_456_TABLE_8_ASSUMED';
    siteControlDegree: 'GOOD' | 'FAIR';
    baseSigma: number;
    penaltyApplied: number;
    effectiveSigma: number;
    roundedMargin: number;
  };
  metrics: {
    sampleResults: number[];
    groupMeanMpa?: number;
    requiredMeanMpa?: number;
    meanSatisfied?: boolean;
    lowestSampleMpa?: number;
    requiredIndividualMinMpa?: number;
    individualSatisfied?: boolean;
  };
}

export function evaluateCubeCompliance(
  input: IComplianceEngineInput
): IComplianceEngineOutput {
  const {
    fck,
    totalVolumeM3,
    shiftsCount,
    sampleRegisters,
    standardDeviationSpec,
    historicalSamplesCount = 0
  } = input;

  const requiredSampleCount = calculateRequiredSamples(totalVolumeM3, shiftsCount);
  const sdEvaluation = evaluateStandardDeviation(
    `M${fck}`,
    standardDeviationSpec,
    historicalSamplesCount
  );

  const validSamples = sampleRegisters.filter(
    s => s.specimenValidityStatus === 'VALID_SAMPLE' && typeof s.sampleAverageStrengthMpa === 'number'
  );
  const invalidSamples = sampleRegisters.filter(
    s => s.specimenValidityStatus === 'INVALID_SAMPLE' || s.sampleAverageStrengthMpa === null
  );

  const validSampleCount = validSamples.length;
  const invalidSampleCount = invalidSamples.length;
  const sampleResults = validSamples.map(s => s.sampleAverageStrengthMpa as number);

  const deficiencyReasons: string[] = [];
  let deficientSamplingAlert = false;

  if (validSampleCount < requiredSampleCount) {
    deficientSamplingAlert = true;
    deficiencyReasons.push(
      `Sampling deficiency: Only ${validSampleCount} valid sample(s) collected for ${totalVolumeM3} m³ concrete volume spanning ${shiftsCount} shift(s). IS 456 Cl 15.2.2 requires at least ${requiredSampleCount} sample(s).`
    );
  }

  // 1. If any invalid samples exist and valid sample count is zero
  if (validSampleCount === 0) {
    return {
      pathwayApplied: 'PATHWAY_E',
      complianceStatus: 'INVALID_SAMPLE',
      deficientSamplingAlert: true,
      deficiencyReasons: [
        'No valid concrete samples available. All tested specimens failed the IS 456 Clause 15.4 validity criteria (deviation > 15%).'
      ],
      requiredSampleCount,
      validSampleCount: 0,
      invalidSampleCount,
      standardDeviationSpec: {
        ...standardDeviationSpec,
        ...sdEvaluation
      },
      metrics: {
        sampleResults: []
      }
    };
  }

  // Determine applicable Table 11 Pathway
  // Pathway A: Group of 4 or more consecutive test results (Table 11 Normal)
  if (validSampleCount >= 4 && !deficientSamplingAlert) {
    // Group of 4 (evaluating the block of 4)
    const block4 = sampleResults.slice(0, 4);
    const groupMean = Math.round((block4.reduce((a, b) => a + b, 0) / 4) * 100) / 100;
    const lowestSample = Math.min(...block4);

    // Table 11 Column 2: >= fck + 0.825*sigma (rounded to 0.5) OR fck + 3.0, whichever is greater
    const requiredMean = Math.max(fck + sdEvaluation.roundedMargin, fck + 3.0);
    const meanSatisfied = groupMean >= requiredMean;

    // Table 11 Column 3: Individual test results >= fck - 3.0 N/mm²
    const requiredIndividualMin = fck - 3.0;
    const individualSatisfied = lowestSample >= requiredIndividualMin;

    const complianceStatus: ComplianceStatus =
      meanSatisfied && individualSatisfied ? 'MEETS_CRITERIA' : 'DOES_NOT_MEET_CRITERIA';

    return {
      pathwayApplied: 'PATHWAY_A',
      complianceStatus,
      deficientSamplingAlert: false,
      deficiencyReasons: [],
      requiredSampleCount,
      validSampleCount,
      invalidSampleCount,
      standardDeviationSpec: { ...standardDeviationSpec, ...sdEvaluation },
      metrics: {
        sampleResults,
        groupMeanMpa: groupMean,
        requiredMeanMpa: requiredMean,
        meanSatisfied,
        lowestSampleMpa: lowestSample,
        requiredIndividualMinMpa: requiredIndividualMin,
        individualSatisfied
      }
    };
  }

  // Pathway B: Concrete quantity up to 30 m³ with 2 or 3 samples (Table 11 Note 2a)
  if (totalVolumeM3 <= 30.0 && (validSampleCount === 2 || validSampleCount === 3) && !deficientSamplingAlert) {
    const mean = Math.round((sampleResults.reduce((a, b) => a + b, 0) / validSampleCount) * 100) / 100;
    const lowestSample = Math.min(...sampleResults);

    // Table 11 Note 2(a):
    // Mean >= fck + 4 N/mm²
    // Individual >= fck - 2 N/mm²
    const requiredMean = fck + 4.0;
    const meanSatisfied = mean >= requiredMean;

    const requiredIndividualMin = fck - 2.0;
    const individualSatisfied = lowestSample >= requiredIndividualMin;

    const complianceStatus: ComplianceStatus =
      meanSatisfied && individualSatisfied ? 'MEETS_CRITERIA' : 'DOES_NOT_MEET_CRITERIA';

    return {
      pathwayApplied: 'PATHWAY_B',
      complianceStatus,
      deficientSamplingAlert: false,
      deficiencyReasons: [],
      requiredSampleCount,
      validSampleCount,
      invalidSampleCount,
      standardDeviationSpec: { ...standardDeviationSpec, ...sdEvaluation },
      metrics: {
        sampleResults,
        groupMeanMpa: mean,
        requiredMeanMpa: requiredMean,
        meanSatisfied,
        lowestSampleMpa: lowestSample,
        requiredIndividualMinMpa: requiredIndividualMin,
        individualSatisfied
      }
    };
  }

  // Pathway C: Concrete quantity up to 30 m³ with exactly 1 sample where 1 is required (Table 11 Note 2b)
  if (totalVolumeM3 <= 30.0 && validSampleCount === 1 && requiredSampleCount === 1) {
    const singleResult = sampleResults[0];

    // Table 11 Note 2(b): Individual test result >= fck + 4 N/mm²
    const requiredMin = fck + 4.0;
    const satisfied = singleResult >= requiredMin;

    const complianceStatus: ComplianceStatus = satisfied ? 'MEETS_CRITERIA' : 'DOES_NOT_MEET_CRITERIA';

    return {
      pathwayApplied: 'PATHWAY_C',
      complianceStatus,
      deficientSamplingAlert: false,
      deficiencyReasons: [],
      requiredSampleCount,
      validSampleCount,
      invalidSampleCount,
      standardDeviationSpec: { ...standardDeviationSpec, ...sdEvaluation },
      metrics: {
        sampleResults,
        lowestSampleMpa: singleResult,
        requiredIndividualMinMpa: requiredMin,
        individualSatisfied: satisfied
      }
    };
  }

  // Pathway D: Pour volume > 30 m³ with fewer than 4 samples (Outside Note 2 scope)
  if (totalVolumeM3 > 30.0 && validSampleCount < 4) {
    const mean = Math.round((sampleResults.reduce((a, b) => a + b, 0) / validSampleCount) * 100) / 100;
    const lowestSample = Math.min(...sampleResults);

    deficiencyReasons.push(
      `Pour quantity (${totalVolumeM3} m³) exceeds small-quantity limit of 30 m³ (IS 456 Table 11 Note 2). Pours > 30 m³ require a minimum group of 4 consecutive samples. Automatic standards-based evaluation cannot be applied.`
    );

    return {
      pathwayApplied: 'PATHWAY_D',
      complianceStatus: 'UNVERIFIED_PENDING_ENGINEER_EVALUATION',
      deficientSamplingAlert: true,
      deficiencyReasons,
      requiredSampleCount,
      validSampleCount,
      invalidSampleCount,
      standardDeviationSpec: { ...standardDeviationSpec, ...sdEvaluation },
      metrics: {
        sampleResults,
        groupMeanMpa: mean,
        lowestSampleMpa: lowestSample
      }
    };
  }

  // Pathway E: Deficient sampling (e.g. fewer samples than required under Cl 15.2.2)
  const mean = Math.round((sampleResults.reduce((a, b) => a + b, 0) / validSampleCount) * 100) / 100;
  const lowestSample = Math.min(...sampleResults);

  return {
    pathwayApplied: 'PATHWAY_E',
    complianceStatus: 'UNVERIFIED_PENDING_ENGINEER_EVALUATION',
    deficientSamplingAlert: true,
    deficiencyReasons,
    requiredSampleCount,
    validSampleCount,
    invalidSampleCount,
    standardDeviationSpec: { ...standardDeviationSpec, ...sdEvaluation },
    metrics: {
      sampleResults,
      groupMeanMpa: mean,
      lowestSampleMpa: lowestSample
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. CURING SCHEDULE SPECIFICATION ENGINE (IS 456:2000 Clause 13.5.1)
// ══════════════════════════════════════════════════════════════════════════════

export function calculateCuringDurationDays(
  cementType: CementType,
  environmentalFlag: EnvironmentalFlag
): number {
  const isHotWeather = environmentalFlag === 'HOT_WEATHER_ARID';

  if (cementType === 'OPC') {
    // IS 456 Cl 13.5.1: Minimum 7 days for OPC; extended to 10 days for hot-weather/arid
    return isHotWeather ? 10 : 7;
  }

  // Mineral admixtures / blended cements (PPC, PSC, GGBS, Fly Ash)
  // IS 456 Cl 13.5.1: Minimum 10 days; extended to 14 days for hot-weather/arid
  return isHotWeather ? 14 : 10;
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. CRYPTOGRAPHIC REVIEW AUDIT SIGNATURE
// ══════════════════════════════════════════════════════════════════════════════

export function generateReviewSignatureHash(
  evaluationId: string,
  decision: string,
  rationale: string,
  engineerUserId: string,
  timestamp: string | Date
): string {
  const tsStr = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);
  const payload = `${evaluationId}|${decision}|${rationale.trim()}|${engineerUserId}|${tsStr}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
