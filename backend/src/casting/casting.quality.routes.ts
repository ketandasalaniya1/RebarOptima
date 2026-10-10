import { Router } from 'express';
import { Db, MongoClient, ObjectId } from 'mongodb';
import {
  ICuringSchedule,
  ICuringDailyLog,
  ICubeTestRegister,
  ICubeComplianceEvaluation,
  ICubeEngineerReview,
  ICastingTrackSheetSignoff
} from './casting.quality.types';
import {
  evaluateSpecimensValidity,
  calculateCuringDurationDays,
  evaluateCubeCompliance,
  generateReviewSignatureHash
} from './casting.quality.service';

function idQuery(id: string): any {
  if (ObjectId.isValid(id) && id.length === 24) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: id };
}

async function resolveCompanyId(req: any, db: Db): Promise<string> {
  if (req.user?.companyId) return String(req.user.companyId);
  const header = req.headers['x-company-id'];
  if (header) return String(header);

  if (req.user?.sub) {
    const userQuery = ObjectId.isValid(req.user.sub) && req.user.sub.length === 24
      ? { _id: new ObjectId(req.user.sub) }
      : { _id: req.user.sub };
    const u = await db.collection('users').findOne(userQuery);
    if (u?.companyId) return String(u.companyId);
  }
  return 'default-company';
}

export function createCastingQualityRouter(
  getDb: () => Db,
  getClient: () => MongoClient,
  authMiddleware: any,
  logAudit?: any
): Router {
  const router = Router();

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 1: CURING MANAGEMENT APIS
  // ══════════════════════════════════════════════════════════════════════════════

  // 1.1 POST /curing/schedules — Create a Curing Schedule (Maker)
  router.post('/curing/schedules', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        eventId,
        consumptionRecordId,
        memberId,
        segmentId,
        segmentName,
        cementType,
        curingMethod,
        environmentalFlag = 'NORMAL',
        customDurationDays,
        sessionsPerDay = 2,
        startDate
      } = req.body;

      if (!eventId || !segmentId || !cementType || !curingMethod || !startDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing mandatory fields: eventId, segmentId, cementType, curingMethod, startDate are required.'
        });
      }

      // Check for active schedule on the same segment (anti-collision)
      const existingActive = await db.collection('curing_schedules').findOne({
        companyId,
        eventId,
        segmentId,
        status: { $in: ['PENDING_APPROVAL', 'ACTIVE', 'INTERRUPTED'] }
      });

      if (existingActive) {
        return res.status(400).json({
          success: false,
          message: `Active or pending curing schedule '${existingActive.scheduleCode}' already exists for segment '${segmentId}'.`
        });
      }

      // Calculate required duration days per IS 456 Clause 13.5.1
      const standardDays = calculateCuringDurationDays(cementType, environmentalFlag);
      const requiredDurationDays = Math.max(standardDays, Number(customDurationDays) || standardDays);

      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + requiredDurationDays);
      const scheduledEndDate = end.toISOString().split('T')[0];

      const count = await db.collection('curing_schedules').countDocuments({ companyId });
      const scheduleCode = `CUR-SCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // Load event to get projectId if not supplied
      const event = await db.collection('casting_events').findOne({
        ...idQuery(eventId),
        companyId
      });
      const projectId = event?.projectId || req.body.projectId || 'default-project';

      const scheduleDoc: ICuringSchedule = {
        companyId,
        projectId,
        scheduleCode,
        eventId,
        consumptionRecordId,
        memberId: memberId || event?.segments?.find((s: any) => s.segmentId === segmentId)?.memberId || '',
        segmentId,
        segmentName: segmentName || event?.segments?.find((s: any) => s.segmentId === segmentId)?.segmentName || segmentId,
        cementType,
        curingMethod,
        environmentalFlag,
        requiredDurationDays,
        sessionsPerDay: Number(sessionsPerDay) || 2,
        startDate,
        scheduledEndDate,
        status: 'PENDING_APPROVAL',
        createdBy: {
          userId: req.user.sub,
          name: req.user.name || req.user.email || 'Site Engineer',
          email: req.user.email || '',
          role: req.user.role || 'Site Engineer'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('curing_schedules').insertOne(scheduleDoc);
      const created = await db.collection('curing_schedules').findOne({ _id: result.insertedId });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CURING_SCHEDULE_CREATED',
          resource: 'curing_schedules',
          resourceId: result.insertedId.toString(),
          description: `Created curing schedule ${scheduleCode} for segment ${segmentId}`
        });
      }

      return res.status(201).json({ success: true, data: { ...created, id: result.insertedId.toString() } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 1.2 GET /curing/schedules — List Curing Schedules
  router.get('/curing/schedules', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { projectId, eventId, segmentId, status } = req.query;

      const query: any = { companyId };
      if (projectId) query.projectId = projectId;
      if (eventId) query.eventId = eventId;
      if (segmentId) query.segmentId = segmentId;
      if (status) query.status = status;

      const list = await db.collection('curing_schedules').find(query).sort({ createdAt: -1 }).toArray();
      const mapped = list.map(item => ({ ...item, id: item._id.toString() }));

      return res.json({ success: true, data: mapped });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 1.3 POST /curing/schedules/:id/approve — Approve Curing Schedule (Checker)
  router.post('/curing/schedules/:id/approve', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id } = req.params;
      const { remarks } = req.body || {};

      const schedule = await db.collection('curing_schedules').findOne({
        ...idQuery(id),
        companyId
      });

      if (!schedule) {
        return res.status(404).json({ success: false, message: 'Curing schedule not found.' });
      }

      // Maker-Checker Authorization Check: Creator cannot approve their own schedule
      if (schedule.createdBy?.userId === req.user.sub) {
        return res.status(400).json({
          success: false,
          code: 'MAKER_CHECKER_SELF_APPROVAL_FORBIDDEN',
          message: 'Maker-Checker Violation: Author cannot approve their own curing schedule.'
        });
      }

      const now = new Date();
      await db.collection('curing_schedules').updateOne(
        { _id: schedule._id },
        {
          $set: {
            status: 'ACTIVE',
            approvedBy: {
              userId: req.user.sub,
              name: req.user.name || req.user.email || 'Senior Engineer',
              email: req.user.email || '',
              role: req.user.role || 'Senior Engineer',
              approvedAt: now,
              remarks: remarks || 'Approved for site curing execution'
            },
            updatedAt: now
          }
        }
      );

      const updated = await db.collection('curing_schedules').findOne({ _id: schedule._id });
      return res.json({
        success: true,
        message: 'Curing schedule approved successfully.',
        data: { ...(updated || schedule), id: schedule._id.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 1.4 POST /curing/logs — Submit Daily Session Inspection Log (Idempotent)
  router.post('/curing/logs', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        curingScheduleId,
        logDate,
        sessionIndex,
        isAdequatelyWet,
        waterCoveragePercent,
        methodSpecificChecks = {},
        interruptionLogged = false,
        interruptionReason,
        remedialActionTaken,
        photoKeys = []
      } = req.body;

      if (!curingScheduleId || !logDate || sessionIndex === undefined) {
        return res.status(400).json({
          success: false,
          message: 'curingScheduleId, logDate, and sessionIndex are mandatory.'
        });
      }

      const schedule = await db.collection('curing_schedules').findOne({
        ...idQuery(curingScheduleId),
        companyId
      });

      if (!schedule) {
        return res.status(404).json({ success: false, message: 'Curing schedule not found.' });
      }

      const idempotencyKey = `CURLOG__C${companyId}__SCH${schedule._id.toString()}__D${logDate}__S${sessionIndex}`;

      // Pre-check for duplicate submission
      const existing = await db.collection('curing_daily_logs').findOne({ idempotencyKey });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Inspection log already recorded for this session (Idempotent Rejection).',
          data: { ...existing, id: existing._id.toString() }
        });
      }

      const now = new Date();
      const logDoc: ICuringDailyLog = {
        companyId,
        projectId: schedule.projectId,
        curingScheduleId: schedule._id.toString(),
        logDate,
        sessionIndex: Number(sessionIndex),
        idempotencyKey,
        isAdequatelyWet: Boolean(isAdequatelyWet),
        waterCoveragePercent: Number(waterCoveragePercent) || 0,
        methodSpecificChecks,
        interruptionLogged: Boolean(interruptionLogged),
        interruptionReason: interruptionReason || '',
        remedialActionTaken: remedialActionTaken || '',
        inspector: {
          userId: req.user.sub,
          name: req.user.name || req.user.email || 'Inspector',
          email: req.user.email || '',
          role: req.user.role || 'QC Inspector'
        },
        photoKeys: Array.isArray(photoKeys) ? photoKeys : [],
        isSuperseded: false,
        createdAt: now
      };

      const result = await db.collection('curing_daily_logs').insertOne(logDoc);

      // If interruption is logged, update curing schedule status to INTERRUPTED
      if (interruptionLogged) {
        await db.collection('curing_schedules').updateOne(
          { _id: schedule._id },
          { $set: { status: 'INTERRUPTED', updatedAt: now } }
        );
      }

      const created = await db.collection('curing_daily_logs').findOne({ _id: result.insertedId });
      return res.status(201).json({
        success: true,
        message: 'Curing daily inspection logged successfully.',
        data: { ...created, id: result.insertedId.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 1.5 GET /curing/logs — List Curing Daily Logs
  router.get('/curing/logs', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { curingScheduleId } = req.query;

      if (!curingScheduleId) {
        return res.status(400).json({ success: false, message: 'curingScheduleId query parameter is required.' });
      }

      const logs = await db.collection('curing_daily_logs')
        .find({ companyId, curingScheduleId: String(curingScheduleId) })
        .sort({ logDate: 1, sessionIndex: 1 })
        .toArray();

      return res.json({ success: true, data: logs.map(l => ({ ...l, id: l._id.toString() })) });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 1.6 POST /curing/logs/:id/compensate — Immutable Compensating Correction
  router.post('/curing/logs/:id/compensate', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id } = req.params;
      const {
        isAdequatelyWet,
        waterCoveragePercent,
        methodSpecificChecks,
        correctionReason,
        interruptionLogged,
        interruptionReason
      } = req.body;

      if (!correctionReason || !correctionReason.trim()) {
        return res.status(400).json({ success: false, message: 'Mandatory correctionReason is required.' });
      }

      const original = await db.collection('curing_daily_logs').findOne({
        ...idQuery(id),
        companyId
      });

      if (!original) {
        return res.status(404).json({ success: false, message: 'Original log not found.' });
      }

      const now = new Date();
      // Insert new compensating log
      const compensatingLog: ICuringDailyLog = {
        companyId,
        projectId: original.projectId,
        curingScheduleId: original.curingScheduleId,
        logDate: original.logDate,
        sessionIndex: original.sessionIndex,
        idempotencyKey: `${original.idempotencyKey}__CORR_${Date.now()}`,
        isAdequatelyWet: isAdequatelyWet !== undefined ? Boolean(isAdequatelyWet) : original.isAdequatelyWet,
        waterCoveragePercent: waterCoveragePercent !== undefined ? Number(waterCoveragePercent) : original.waterCoveragePercent,
        methodSpecificChecks: methodSpecificChecks || original.methodSpecificChecks,
        interruptionLogged: interruptionLogged !== undefined ? Boolean(interruptionLogged) : original.interruptionLogged,
        interruptionReason: interruptionReason || original.interruptionReason,
        remedialActionTaken: original.remedialActionTaken,
        inspector: {
          userId: req.user.sub,
          name: req.user.name || req.user.email || 'Inspector',
          email: req.user.email || '',
          role: req.user.role || 'QC Inspector'
        },
        photoKeys: original.photoKeys || [],
        isSuperseded: false,
        correctionReason: correctionReason.trim(),
        createdAt: now
      };

      const result = await db.collection('curing_daily_logs').insertOne(compensatingLog);

      // Mark original as superseded
      await db.collection('curing_daily_logs').updateOne(
        { _id: original._id },
        {
          $set: {
            isSuperseded: true,
            supersededByLogId: result.insertedId.toString()
          }
        }
      );

      return res.status(201).json({
        success: true,
        message: 'Compensating log inserted; original preserved as superseded.',
        data: { ...compensatingLog, id: result.insertedId.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 2: CONCRETE CUBE STRENGTH TESTING & EVALUATION APIS
  // ══════════════════════════════════════════════════════════════════════════════

  // 2.1 POST /cubes/samples — Register 3-Specimen Test Set
  router.post('/cubes/samples', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        eventId,
        consumptionRecordId,
        segmentId,
        sampleCode,
        concreteGrade = 'M25',
        fck = 25,
        batchTime,
        testAgeDays = 28,
        specimens,
        testingMachineId = 'CTM-CAL-01'
      } = req.body;

      if (!eventId || !specimens || !Array.isArray(specimens) || specimens.length !== 3) {
        return res.status(400).json({
          success: false,
          message: 'eventId and exactly 3 test specimens are mandatory (IS 456 Cl 15.3).'
        });
      }

      // Evaluate specimen variation & validity per IS 456 Cl 15.4
      const validation = evaluateSpecimensValidity(specimens);

      const count = await db.collection('cube_test_registers').countDocuments({ companyId });
      const finalSampleCode = sampleCode || `SMP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // Check unique sample code
      const existing = await db.collection('cube_test_registers').findOne({ companyId, sampleCode: finalSampleCode });
      if (existing) {
        return res.status(400).json({ success: false, message: `Sample code '${finalSampleCode}' already exists.` });
      }

      const event = await db.collection('casting_events').findOne({ ...idQuery(eventId), companyId });
      const projectId = event?.projectId || req.body.projectId || 'default-project';

      // Attach calculated strengths to specimens
      const processedSpecimens: any = specimens.map((s: any, idx: number) => ({
        specimenIndex: idx + 1,
        weightKg: Number(s.weightKg) || 8.1,
        failureLoadKn: Number(s.failureLoadKn),
        crossSectionalAreaMm2: Number(s.crossSectionalAreaMm2) || 22500,
        compressiveStrengthMpa: validation.specimenStrengths[idx],
        testedAt: s.testedAt ? new Date(s.testedAt) : new Date()
      }));

      const doc: ICubeTestRegister = {
        companyId,
        projectId,
        eventId,
        consumptionRecordId,
        segmentId,
        sampleCode: finalSampleCode,
        concreteGrade,
        fck: Number(fck),
        batchTime: batchTime ? new Date(batchTime) : new Date(),
        testAgeDays: Number(testAgeDays) === 7 ? 7 : 28,
        specimens: processedSpecimens,
        sampleAverageStrengthMpa: validation.sampleAverageStrengthMpa,
        maxSpecimenDeviationPercent: validation.maxSpecimenDeviationPercent,
        specimenValidityStatus: validation.status,
        testingMachineId,
        calibrationValidUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        testedBy: {
          userId: req.user.sub,
          name: req.user.name || req.user.email || 'Lab Tech',
          email: req.user.email || '',
          role: req.user.role || 'QC Lab Technician'
        },
        createdAt: new Date()
      };

      const result = await db.collection('cube_test_registers').insertOne(doc);
      const created = await db.collection('cube_test_registers').findOne({ _id: result.insertedId });

      return res.status(201).json({
        success: true,
        message: validation.isValid
          ? 'Cube test sample registered successfully (Valid Sample).'
          : `Cube test sample registered as INVALID_SAMPLE: ${validation.rejectionReason}`,
        data: { ...created, id: result.insertedId.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2.2 GET /cubes/samples — List Registered Cube Samples
  router.get('/cubes/samples', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { eventId, concreteGrade, testAgeDays } = req.query;

      const query: any = { companyId };
      if (eventId) query.eventId = eventId;
      if (concreteGrade) query.concreteGrade = concreteGrade;
      if (testAgeDays) query.testAgeDays = Number(testAgeDays);

      const list = await db.collection('cube_test_registers').find(query).sort({ createdAt: -1 }).toArray();
      return res.json({ success: true, data: list.map(s => ({ ...s, id: s._id.toString() })) });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2.3 POST /cubes/evaluations/run — Execute Objective Table 11 Evaluation
  router.post('/cubes/evaluations/run', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const {
        eventId,
        concreteGrade = 'M25',
        fck = 25,
        totalVolumeM3,
        shiftsCount = 1,
        standardDeviationSpec = {
          provenance: 'IS_456_TABLE_8_ASSUMED',
          siteControlDegree: 'GOOD'
        }
      } = req.body;

      if (!eventId) {
        return res.status(400).json({ success: false, message: 'eventId is mandatory.' });
      }

      const event = await db.collection('casting_events').findOne({ ...idQuery(eventId), companyId });
      const vol = totalVolumeM3 !== undefined
        ? Number(totalVolumeM3)
        : (event?.actualTotalVolumeM3 || event?.plannedTotalVolumeM3 || 10.0);

      // Load 28-day samples for this event and concrete grade
      const sampleRegisters: ICubeTestRegister[] = await db.collection('cube_test_registers').find({
        companyId,
        eventId,
        concreteGrade,
        testAgeDays: 28
      }).toArray() as any;

      // Count historical samples for grade across project (for plant-established SD validation)
      const historicalSamplesCount = await db.collection('cube_test_registers').countDocuments({
        companyId,
        concreteGrade,
        testAgeDays: 28,
        specimenValidityStatus: 'VALID_SAMPLE'
      });

      // Execute compliance evaluation
      const evalResult = evaluateCubeCompliance({
        fck: Number(fck),
        totalVolumeM3: vol,
        shiftsCount: Number(shiftsCount) || 1,
        sampleRegisters,
        standardDeviationSpec,
        historicalSamplesCount
      });

      const count = await db.collection('cube_compliance_evaluations').countDocuments({ companyId });
      const evaluationCode = `EVAL-CUB-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const evalDoc: ICubeComplianceEvaluation = {
        companyId,
        projectId: event?.projectId || 'default-project',
        evaluationCode,
        eventId,
        concreteGrade,
        fck: Number(fck),
        totalVolumeM3: vol,
        shiftsCount: Number(shiftsCount) || 1,
        requiredSampleCount: evalResult.requiredSampleCount,
        evaluatedSampleIds: sampleRegisters.map((s: any) => s._id.toString()),
        validSampleCount: evalResult.validSampleCount,
        invalidSampleCount: evalResult.invalidSampleCount,
        pathwayApplied: evalResult.pathwayApplied,
        standardDeviationSpec: evalResult.standardDeviationSpec,
        metrics: evalResult.metrics,
        complianceStatus: evalResult.complianceStatus,
        deficientSamplingAlert: evalResult.deficientSamplingAlert,
        deficiencyReasons: evalResult.deficiencyReasons,
        evaluatedAt: new Date()
      };

      const insertResult = await db.collection('cube_compliance_evaluations').insertOne(evalDoc);
      const created = await db.collection('cube_compliance_evaluations').findOne({ _id: insertResult.insertedId });

      return res.status(201).json({
        success: true,
        message: `Evaluation completed under ${evalResult.pathwayApplied}: ${evalResult.complianceStatus}`,
        data: { ...created, id: insertResult.insertedId.toString() }
      });
    } catch (err: any) {
      if (err.message?.includes('INSUFFICIENT_HISTORICAL_POPULATION_FOR_SD')) {
        return res.status(400).json({ success: false, code: 'INSUFFICIENT_HISTORICAL_POPULATION_FOR_SD', message: err.message });
      }
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2.4 GET /cubes/evaluations — List Evaluations
  router.get('/cubes/evaluations', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { eventId } = req.query;

      const query: any = { companyId };
      if (eventId) query.eventId = eventId;

      const list = await db.collection('cube_compliance_evaluations').find(query).sort({ evaluatedAt: -1 }).toArray();
      return res.json({ success: true, data: list.map(e => ({ ...e, id: e._id.toString() })) });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2.5 POST /cubes/evaluations/:id/approve — Maker-Checker Formal Engineer Review
  router.post('/cubes/evaluations/:id/approve', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id } = req.params;
      const {
        formalDecision,
        technicalRationale,
        registrationId,
        correctiveMeasures
      } = req.body;

      if (!formalDecision || !technicalRationale || !technicalRationale.trim()) {
        return res.status(400).json({
          success: false,
          message: 'formalDecision and technicalRationale are mandatory for engineer sign-off.'
        });
      }

      const evaluation = await db.collection('cube_compliance_evaluations').findOne({
        ...idQuery(id),
        companyId
      });

      if (!evaluation) {
        return res.status(404).json({ success: false, message: 'Evaluation record not found.' });
      }

      // Maker-Checker Authorization Check: Lab tech who tested the cubes cannot sign off as checker
      const sampleIds = Array.isArray(evaluation.evaluatedSampleIds) ? evaluation.evaluatedSampleIds : [];
      const objIds = sampleIds.map((sId: string) => (ObjectId.isValid(sId) && sId.length === 24 ? new ObjectId(sId) : sId));
      const testedSamples = await db.collection('cube_test_registers').find({
        companyId,
        $or: [
          { _id: { $in: objIds } },
          { _id: { $in: sampleIds } }
        ]
      }).toArray();

      const wasTester = testedSamples.some((s: any) => s.testedBy?.userId === req.user.sub);
      if (wasTester) {
        return res.status(400).json({
          success: false,
          code: 'MAKER_CHECKER_SELF_APPROVAL_FORBIDDEN',
          message: 'Maker-Checker Violation: The technician who tested the specimens cannot approve the formal engineering compliance decision.'
        });
      }

      // Check if already reviewed
      const existingReview = await db.collection('cube_engineer_reviews').findOne({
        companyId,
        evaluationId: evaluation._id.toString()
      });
      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'This evaluation has already received a formal engineering decision.'
        });
      }

      const now = new Date();
      const signatureSha256 = generateReviewSignatureHash(
        evaluation._id.toString(),
        formalDecision,
        technicalRationale,
        req.user.sub,
        now
      );

      const reviewDoc: ICubeEngineerReview = {
        companyId,
        projectId: evaluation.projectId,
        evaluationId: evaluation._id.toString(),
        formalDecision,
        engineer: {
          userId: req.user.sub,
          name: req.user.name || req.user.email || 'Qualified Engineer',
          email: req.user.email || '',
          role: req.user.role || 'Senior Structural Engineer',
          registrationId: registrationId || 'ER-LIC-VALID'
        },
        technicalRationale: technicalRationale.trim(),
        correctiveMeasures: correctiveMeasures || '',
        signatureSha256,
        reviewedAt: now
      };

      const result = await db.collection('cube_engineer_reviews').insertOne(reviewDoc);
      const created = await db.collection('cube_engineer_reviews').findOne({ _id: result.insertedId });

      return res.status(201).json({
        success: true,
        message: 'Formal engineering decision recorded with cryptographic audit signature.',
        data: { ...created, id: result.insertedId.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 3: SLAB CASTING TRACK SHEET APIS (STRICT BBS INDEPENDENCE)
  // ══════════════════════════════════════════════════════════════════════════════

  // 3.1 GET /track-sheet/:eventId — Read-Only Aggregated Operational Dashboard
  router.get('/track-sheet/:eventId', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { eventId } = req.params;

      const event = await db.collection('casting_events').findOne({ ...idQuery(eventId), companyId });
      if (!event) {
        return res.status(404).json({ success: false, message: 'Casting event not found.' });
      }

      // Aggregations from Casting Management only (Zero BBS calls)
      const [consumptionRecords, curingSchedules, cubeSamples, evaluations, signoffs] = await Promise.all([
        db.collection('casting_consumption_records').find({ companyId, eventId }).toArray(),
        db.collection('curing_schedules').find({ companyId, eventId }).toArray(),
        db.collection('cube_test_registers').find({ companyId, eventId }).toArray(),
        db.collection('cube_compliance_evaluations').find({ companyId, eventId }).toArray(),
        db.collection('casting_track_sheet_signoffs').find({ companyId, eventId }).toArray()
      ]);

      // Map segments with their curing and cube status
      const segmentsDetailed = (event.segments || []).map((seg: any) => {
        const schedule = curingSchedules.find((s: any) => s.segmentId === seg.segmentId);
        const segmentSamples = cubeSamples.filter((c: any) => c.segmentId === seg.segmentId || !c.segmentId);
        const signoff = signoffs.find((so: any) => so.segmentId === seg.segmentId);

        return {
          segmentId: seg.segmentId,
          memberId: seg.memberId,
          segmentName: seg.segmentName,
          plannedVolumeM3: seg.plannedVolumeM3,
          actualVolumeM3: seg.actualVolumeM3 || 0,
          status: seg.status,
          grade: seg.grade,
          curing: schedule ? {
            scheduleCode: schedule.scheduleCode,
            cementType: schedule.cementType,
            curingMethod: schedule.curingMethod,
            requiredDurationDays: schedule.requiredDurationDays,
            startDate: schedule.startDate,
            scheduledEndDate: schedule.scheduledEndDate,
            status: schedule.status
          } : null,
          cubes: {
            samplesCount: segmentSamples.length,
            sevenDayTested: segmentSamples.some((s: any) => s.testAgeDays === 7),
            twentyEightDayTested: segmentSamples.some((s: any) => s.testAgeDays === 28)
          },
          signoff: signoff ? {
            qualityStatus: signoff.qualityStatus,
            signedOffAt: signoff.signedOffAt,
            signedOffBy: signoff.signedOffBy?.name
          } : null
        };
      });

      return res.json({
        success: true,
        data: {
          eventId: event._id.toString(),
          eventNumber: event.eventNumber,
          title: event.title,
          plannedDate: event.plannedDate,
          actualPourDate: event.actualPourDate,
          plannedTotalVolumeM3: event.plannedTotalVolumeM3,
          actualTotalVolumeM3: event.actualTotalVolumeM3 || 0,
          status: event.status,
          consumptionRecordsCount: consumptionRecords.length,
          segments: segmentsDetailed,
          cubeEvaluations: evaluations.map(e => ({
            evaluationCode: e.evaluationCode,
            concreteGrade: e.concreteGrade,
            pathwayApplied: e.pathwayApplied,
            complianceStatus: e.complianceStatus,
            deficientSamplingAlert: e.deficientSamplingAlert
          }))
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3.2 POST /track-sheet/:eventId/signoff — Quality Stage-Gate Sign-Off (Checker)
  router.post('/track-sheet/:eventId/signoff', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { eventId } = req.params;
      const {
        segmentId,
        memberId,
        curingCompletedAndSatisfactory,
        cubeStrengthAccepted,
        qualityStatus = 'APPROVED',
        signoffNotes
      } = req.body;

      if (!segmentId) {
        return res.status(400).json({ success: false, message: 'segmentId is required for track sheet sign-off.' });
      }

      // Check RBAC permission: Must be Senior Engineer / PM (Role check)
      const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'SENIOR_ENGINEER', 'PROJECT_MANAGER', 'QUALITY_MANAGER'];
      const userRole = String(req.user.role || '').toUpperCase();
      if (!allowedRoles.includes(userRole) && req.user.accountType !== 'developer') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_SIGN_OFF_ROLE',
          message: 'Only Senior Project Engineers, Project Managers, or Admins are authorized to execute stage-gate quality sign-offs.'
        });
      }

      // Maker-Checker Authorization Check:
      // Author of the pour / consumption record cannot sign off on the quality release
      const consumptionRecord = await db.collection('casting_consumption_records').findOne({
        companyId,
        eventId
      });

      if (consumptionRecord && consumptionRecord.createdBy?.userId === req.user.sub) {
        return res.status(400).json({
          success: false,
          code: 'MAKER_CHECKER_SELF_APPROVAL_FORBIDDEN',
          message: 'Maker-Checker Violation: The engineer who recorded the actual pour cannot sign off on stage-gate quality acceptance.'
        });
      }

      const now = new Date();
      const signoffDoc: ICastingTrackSheetSignoff = {
        companyId,
        projectId: req.body.projectId || 'default-project',
        eventId,
        consumptionRecordId: consumptionRecord?._id?.toString(),
        segmentId,
        memberId: memberId || '',
        curingCompletedAndSatisfactory: Boolean(curingCompletedAndSatisfactory),
        cubeStrengthAccepted: Boolean(cubeStrengthAccepted),
        scopeOfSignoff: 'MATERIAL_AND_CURING_QUALITY_ACCEPTANCE',
        qualityStatus,
        signedOffBy: {
          userId: req.user.sub,
          name: req.user.name || req.user.email || 'Project Manager',
          email: req.user.email || '',
          role: req.user.role || 'Project Manager'
        },
        makerUserId: consumptionRecord?.createdBy?.userId || 'unknown',
        signoffNotes: signoffNotes || '',
        signedOffAt: now
      };

      const result = await db.collection('casting_track_sheet_signoffs').insertOne(signoffDoc);
      return res.status(201).json({
        success: true,
        message: 'Track sheet quality stage-gate sign-off recorded successfully.',
        data: { ...signoffDoc, id: result.insertedId.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}
