import { Router } from 'express';
import { ObjectId } from 'mongodb';

export interface ITimelineDelayMetrics {
  delayStatus: 'ON_SCHEDULE' | 'EARLY' | 'DELAYED' | 'OVERDUE' | 'UPCOMING' | 'CANCELLED' | 'INCOMPLETE_TIMESTAMPS';
  delayDays: number;
  delayHours: number;
  delayDurationText: string;
  isDelayCalculable: boolean;
  plannedDateTimeIso?: string;
  actualDateTimeIso?: string;
}

export interface ITimelineEventEnriched {
  id: string;
  _id: string;
  companyId: string;
  projectId: string;
  eventNumber: string;
  title: string;
  activityType: string;
  status: 'PLANNED' | 'POURING' | 'POURED' | 'CANCELLED';
  plannedDate: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  plannedTotalVolumeM3: number;
  actualPourDate?: string;
  actualPourStartTime?: string;
  actualPourEndTime?: string;
  actualTotalVolumeM3?: number;
  notes?: string;
  delayMetrics: ITimelineDelayMetrics;
  segmentsSummary: {
    totalSegments: number;
    blocksCovered: { id: string; name: string }[];
    levelsCovered: { id: string; name: string }[];
    membersCovered: { id: string; displayId: string; type: string }[];
    grades: string[];
    recipes: string[];
  };
  qualityContext: {
    curingStatus: 'ACTIVE' | 'COMPLETED' | 'INTERRUPTED' | 'NOT_SCHEDULED';
    curingScheduleId?: string;
    curingDaysCompleted?: number;
    curingTargetDays?: number;
    cubeStatus: 'ACCEPTED' | 'VALID' | 'INVALID' | 'TESTING_PENDING' | 'DEFICIENT' | 'NO_SAMPLES';
    sampleCount: number;
    averageStrengthMpa?: number;
    consumptionStatus?: string;
    hasMrs: boolean;
    mrsCode?: string;
  };
  segments: any[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pure calculation helper to evaluate planned vs actual casting timelines.
 * Never fabricates timestamps or infers completion without evidence.
 */
export function calculateTimelineDelay(event: {
  status: string;
  plannedDate?: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  actualPourDate?: string;
  actualPourStartTime?: string;
  actualPourEndTime?: string;
}): ITimelineDelayMetrics {
  if (event.status === 'CANCELLED') {
    return {
      delayStatus: 'CANCELLED',
      delayDays: 0,
      delayHours: 0,
      delayDurationText: 'Event Cancelled',
      isDelayCalculable: false
    };
  }

  if (!event.plannedDate || !/^\d{4}-\d{2}-\d{2}$/.test(event.plannedDate.trim())) {
    return {
      delayStatus: 'INCOMPLETE_TIMESTAMPS',
      delayDays: 0,
      delayHours: 0,
      delayDurationText: 'Missing Planned Date',
      isDelayCalculable: false
    };
  }

  const plannedTimeStr = event.plannedStartTime && /^\d{2}:\d{2}/.test(event.plannedStartTime)
    ? event.plannedStartTime.substring(0, 5)
    : '08:00';
  const plannedDateTime = new Date(`${event.plannedDate}T${plannedTimeStr}:00Z`);

  if (isNaN(plannedDateTime.getTime())) {
    return {
      delayStatus: 'INCOMPLETE_TIMESTAMPS',
      delayDays: 0,
      delayHours: 0,
      delayDurationText: 'Invalid Planned Date/Time',
      isDelayCalculable: false
    };
  }

  const plannedIso = plannedDateTime.toISOString();

  // Case 1: Event has actually been poured with recorded actual date
  if (event.status === 'POURED' && event.actualPourDate && /^\d{4}-\d{2}-\d{2}$/.test(event.actualPourDate.trim())) {
    const actualTimeStr = event.actualPourStartTime && /^\d{2}:\d{2}/.test(event.actualPourStartTime)
      ? event.actualPourStartTime.substring(0, 5)
      : plannedTimeStr;
    const actualDateTime = new Date(`${event.actualPourDate}T${actualTimeStr}:00Z`);

    if (isNaN(actualDateTime.getTime())) {
      return {
        delayStatus: 'INCOMPLETE_TIMESTAMPS',
        delayDays: 0,
        delayHours: 0,
        delayDurationText: 'Invalid Actual Date/Time',
        isDelayCalculable: false,
        plannedDateTimeIso: plannedIso
      };
    }

    const actualIso = actualDateTime.toISOString();
    const diffMs = actualDateTime.getTime() - plannedDateTime.getTime();
    const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    const diffDays = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;

    // Tolerance threshold: ±2 hours or same calendar day is considered ON_SCHEDULE
    if (Math.abs(diffHours) <= 2) {
      return {
        delayStatus: 'ON_SCHEDULE',
        delayDays: 0,
        delayHours: 0,
        delayDurationText: 'Executed on Schedule',
        isDelayCalculable: true,
        plannedDateTimeIso: plannedIso,
        actualDateTimeIso: actualIso
      };
    } else if (diffHours > 2) {
      const daysInt = Math.floor(diffHours / 24);
      const remHours = Math.round(diffHours % 24);
      const text = daysInt > 0 ? `+${daysInt}d ${remHours > 0 ? `${remHours}h` : ''} delayed`.trim() : `+${diffHours}h delayed`;
      return {
        delayStatus: 'DELAYED',
        delayDays: diffDays,
        delayHours: diffHours,
        delayDurationText: text,
        isDelayCalculable: true,
        plannedDateTimeIso: plannedIso,
        actualDateTimeIso: actualIso
      };
    } else {
      const earlyHours = Math.abs(diffHours);
      const daysInt = Math.floor(earlyHours / 24);
      const text = daysInt > 0 ? `${daysInt}d early` : `${earlyHours}h early`;
      return {
        delayStatus: 'EARLY',
        delayDays: diffDays,
        delayHours: diffHours,
        delayDurationText: text,
        isDelayCalculable: true,
        plannedDateTimeIso: plannedIso,
        actualDateTimeIso: actualIso
      };
    }
  }

  // Case 2: Poured status but missing actual date
  if (event.status === 'POURED' && !event.actualPourDate) {
    return {
      delayStatus: 'INCOMPLETE_TIMESTAMPS',
      delayDays: 0,
      delayHours: 0,
      delayDurationText: 'Poured (Date unrecorded)',
      isDelayCalculable: false,
      plannedDateTimeIso: plannedIso
    };
  }

  // Case 3: Still Planned or Currently Pouring
  const now = new Date();
  const diffFromNowMs = now.getTime() - plannedDateTime.getTime();
  const overdueHours = Math.round((diffFromNowMs / (1000 * 60 * 60)) * 10) / 10;
  const overdueDays = Math.round((diffFromNowMs / (1000 * 60 * 60 * 24)) * 10) / 10;

  // If past planned date by more than 12 hours and not marked poured -> OVERDUE
  if (overdueHours > 12) {
    const daysInt = Math.floor(overdueHours / 24);
    const remHours = Math.round(overdueHours % 24);
    const text = daysInt > 0 ? `${daysInt}d ${remHours > 0 ? `${remHours}h` : ''} overdue`.trim() : `${overdueHours}h overdue`;
    return {
      delayStatus: 'OVERDUE',
      delayDays: overdueDays,
      delayHours: overdueHours,
      delayDurationText: text,
      isDelayCalculable: true,
      plannedDateTimeIso: plannedIso
    };
  }

  return {
    delayStatus: 'UPCOMING',
    delayDays: 0,
    delayHours: 0,
    delayDurationText: 'Scheduled',
    isDelayCalculable: true,
    plannedDateTimeIso: plannedIso
  };
}

export function createCastingTimelineRouter(
  getDb: () => any,
  authMiddleware: any,
  logAudit?: any
): Router {
  const router = Router();

  const toObjId = (id: any) => {
    if (!id) return null;
    if (id instanceof ObjectId) return id;
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    }
    return null;
  };

  const idQuery = (id: any) => {
    const objId = toObjId(id);
    return objId ? { $or: [{ _id: objId }, { _id: String(id) }] } : { _id: String(id) };
  };

  const resolveCompanyId = async (req: any, db: any): Promise<string> => {
    if (req.user?.companyId) return String(req.user.companyId);
    const userId = req.user?.sub;
    if (userId) {
      try {
        const u = await db.collection('users').findOne({
          $or: [{ _id: toObjId(userId) || userId }, { _id: String(userId) }]
        });
        if (u && u.companyId) return String(u.companyId);
      } catch {}
    }
    return req.user?.companyId || 'default-company';
  };

  // 1. GET /timeline/events — Aggregated chronological casting events
  router.get('/timeline/events', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const {
        projectId,
        blockId,
        levelId,
        memberId,
        status,
        startDate,
        endDate,
        search
      } = req.query;

      const query: any = { companyId, isDeleted: { $ne: true } };

      if (projectId && projectId !== 'ALL' && projectId !== 'all') {
        query.projectId = String(projectId);
      }

      if (blockId && blockId !== 'ALL' && blockId !== 'all') {
        query['segments.blockId'] = String(blockId);
      }

      if (levelId && levelId !== 'ALL' && levelId !== 'all') {
        query['segments.levelId'] = String(levelId);
      }

      if (memberId && memberId !== 'ALL' && memberId !== 'all') {
        query['segments.memberId'] = String(memberId);
      }

      if (status && status !== 'ALL' && status !== 'all') {
        const statusList = String(status).split(',').map(s => s.trim().toUpperCase());
        query.status = statusList.length === 1 ? statusList[0] : { $in: statusList };
      }

      if (startDate || endDate) {
        query.plannedDate = {};
        if (startDate) query.plannedDate.$gte = String(startDate);
        if (endDate) query.plannedDate.$lte = String(endDate);
      }

      if (search && String(search).trim()) {
        const sRegex = new RegExp(String(search).trim(), 'i');
        query.$or = [
          { title: sRegex },
          { eventNumber: sRegex },
          { activityType: sRegex },
          { 'segments.segmentName': sRegex }
        ];
      }

      // Fetch events with strictly deterministic chronological sorting
      const events = await db.collection('casting_events')
        .find(query)
        .sort({ plannedDate: 1, plannedStartTime: 1, _id: 1 })
        .toArray();

      if (events.length === 0) {
        return res.json({
          success: true,
          count: 0,
          data: [],
          summary: {
            total: 0,
            planned: 0,
            pouring: 0,
            poured: 0,
            delayed: 0,
            overdue: 0,
            cancelled: 0
          }
        });
      }

      const eventIds = events.map((e: any) => e._id.toString());
      const eventObjIds = events.map((e: any) => e._id);

      // Pre-fetch related structural hierarchy names in batch for enrichment
      const distinctBlockIds = Array.from(
        new Set(events.flatMap((e: any) => (e.segments || []).map((s: any) => s.blockId).filter(Boolean)))
      );
      const distinctLevelIds = Array.from(
        new Set(events.flatMap((e: any) => (e.segments || []).map((s: any) => s.levelId).filter(Boolean)))
      );
      const distinctMemberIds = Array.from(
        new Set(events.flatMap((e: any) => (e.segments || []).map((s: any) => s.memberId).filter(Boolean)))
      );

      const [blocks, levels, members, curingSchedules, cubeRegisters, consumptions] = await Promise.all([
        distinctBlockIds.length > 0
          ? db.collection('casting_blocks').find({
              companyId,
              _id: { $in: distinctBlockIds.map(id => toObjId(id) || id) }
            }).toArray()
          : [],
        distinctLevelIds.length > 0
          ? db.collection('casting_levels').find({
              companyId,
              _id: { $in: distinctLevelIds.map(id => toObjId(id) || id) }
            }).toArray()
          : [],
        distinctMemberIds.length > 0
          ? db.collection('casting_members').find({
              companyId,
              _id: { $in: distinctMemberIds.map(id => toObjId(id) || id) }
            }).toArray()
          : [],
        // Phase 4: Curing Schedules for these events
        db.collection('curing_schedules').find({
          companyId,
          $or: [
            { eventId: { $in: [...eventIds, ...eventObjIds.filter(Boolean)] } },
            { castingEventId: { $in: [...eventIds, ...eventObjIds.filter(Boolean)] } }
          ]
        }).toArray(),
        // Phase 4: Cube Registers for these events
        db.collection('cube_test_registers').find({
          companyId,
          $or: [
            { eventId: { $in: [...eventIds, ...eventObjIds.filter(Boolean)] } },
            { castingEventId: { $in: [...eventIds, ...eventObjIds.filter(Boolean)] } }
          ]
        }).toArray(),
        // Phase 3: Actual Consumptions for these events
        db.collection('casting_consumption_records').find({
          companyId,
          eventId: { $in: [...eventIds, ...eventObjIds.filter(Boolean)] }
        }).toArray()
      ]);

      const blockMap = new Map<string, string>(
        blocks.map((b: any) => [b._id.toString(), b.name || b.blockName || 'Block'])
      );
      const levelMap = new Map<string, string>(
        levels.map((l: any) => [l._id.toString(), l.name || l.levelName || 'Level'])
      );
      const memberMap = new Map<string, any>(
        members.map((m: any) => [m._id.toString(), m])
      );

      // Group Phase 4 quality records by eventId
      const curingByEvent = new Map<string, any>();
      for (const cur of curingSchedules) {
        const evId = String(cur.eventId || cur.castingEventId || '');
        if (evId) curingByEvent.set(evId, cur);
      }

      const cubesByEvent = new Map<string, any[]>();
      for (const c of cubeRegisters) {
        const evId = String(c.eventId || c.castingEventId || '');
        if (evId) {
          if (!cubesByEvent.has(evId)) cubesByEvent.set(evId, []);
          cubesByEvent.get(evId)!.push(c);
        }
      }

      const consumptionByEvent = new Map<string, any>();
      for (const cons of consumptions) {
        const evId = String(cons.eventId || '');
        if (evId) consumptionByEvent.set(evId, cons);
      }

      let plannedCount = 0;
      let pouringCount = 0;
      let pouredCount = 0;
      let delayedCount = 0;
      let overdueCount = 0;
      let cancelledCount = 0;

      const enrichedEvents: ITimelineEventEnriched[] = events.map((e: any) => {
        const eventIdStr = e._id.toString();
        const delayMetrics = calculateTimelineDelay(e);

        if (e.status === 'PLANNED') plannedCount++;
        else if (e.status === 'POURING') pouringCount++;
        else if (e.status === 'POURED') pouredCount++;
        else if (e.status === 'CANCELLED') cancelledCount++;

        if (delayMetrics.delayStatus === 'DELAYED') delayedCount++;
        else if (delayMetrics.delayStatus === 'OVERDUE') overdueCount++;

        // Structural Summary
        const segments = Array.isArray(e.segments) ? e.segments : [];
        const blocksCoveredSet = new Map<string, string>();
        const levelsCoveredSet = new Map<string, string>();
        const membersCoveredSet = new Map<string, any>();
        const gradesSet = new Set<string>();
        const recipesSet = new Set<string>();

        for (const seg of segments) {
          if (seg.blockId) {
            blocksCoveredSet.set(String(seg.blockId), blockMap.get(String(seg.blockId)) || 'Block');
          }
          if (seg.levelId) {
            levelsCoveredSet.set(String(seg.levelId), levelMap.get(String(seg.levelId)) || 'Level');
          }
          if (seg.memberId) {
            const m = memberMap.get(String(seg.memberId));
            membersCoveredSet.set(String(seg.memberId), {
              id: String(seg.memberId),
              displayId: m?.displayId || 'M-?',
              type: m?.memberType || 'Member'
            });
          }
          if (seg.grade) gradesSet.add(seg.grade);
          if (seg.recipeBinding?.recipeCode) recipesSet.add(seg.recipeBinding.recipeCode);
        }

        // Quality Context (Phase 4 & 3)
        const curSchedule = curingByEvent.get(eventIdStr);
        let curingStatus: any = 'NOT_SCHEDULED';
        let curingDaysCompleted: number | undefined;
        let curingTargetDays: number | undefined;

        if (curSchedule) {
          curingStatus = curSchedule.status;
          curingDaysCompleted = curSchedule.progress?.completedDays || 0;
          curingTargetDays = curSchedule.targetDurationDays || curSchedule.requiredDurationDays || 7;
        }

        const cubes = cubesByEvent.get(eventIdStr) || [];
        let cubeStatus: any = 'NO_SAMPLES';
        let averageStrengthMpa: number | undefined;

        if (cubes.length > 0) {
          const validCubes = cubes.filter((cb: any) => 
            cb.status === 'VALID' || 
            cb.specimenValidityStatus === 'VALID_SAMPLE' || 
            cb.specimenValidityStatus === 'VALID' || 
            cb.complianceCheck?.isSpecimenValid
          );
          const hasInvalid = cubes.some((cb: any) => 
            cb.status === 'INVALID' || 
            cb.specimenValidityStatus === 'INVALID_SAMPLE' || 
            cb.specimenValidityStatus === 'INVALID' || 
            cb.complianceCheck?.isSpecimenValid === false
          );
          
          if (validCubes.length > 0) {
            const totalAvg = validCubes.reduce((sum: number, cb: any) => sum + (cb.sampleAverageStrengthMpa || cb.sampleAverageMpa || 0), 0);
            averageStrengthMpa = Math.round((totalAvg / validCubes.length) * 100) / 100;
            cubeStatus = 'VALID';
          } else if (hasInvalid) {
            cubeStatus = 'INVALID';
          } else {
            cubeStatus = 'TESTING_PENDING';
          }
        }

        const consRecord = consumptionByEvent.get(eventIdStr);

        return {
          id: eventIdStr,
          _id: eventIdStr,
          companyId: e.companyId,
          projectId: e.projectId,
          eventNumber: e.eventNumber || 'CE-?',
          title: e.title || 'Casting Event',
          activityType: e.activityType || 'Slab_Beam',
          status: e.status || 'PLANNED',
          plannedDate: e.plannedDate,
          plannedStartTime: e.plannedStartTime,
          plannedEndTime: e.plannedEndTime,
          plannedTotalVolumeM3: Number(e.plannedTotalVolumeM3 || 0),
          actualPourDate: e.actualPourDate,
          actualPourStartTime: e.actualPourStartTime,
          actualPourEndTime: e.actualPourEndTime,
          actualTotalVolumeM3: e.actualTotalVolumeM3 ? Number(e.actualTotalVolumeM3) : undefined,
          notes: e.notes,
          delayMetrics,
          segmentsSummary: {
            totalSegments: segments.length,
            blocksCovered: Array.from(blocksCoveredSet.entries()).map(([id, name]) => ({ id, name })),
            levelsCovered: Array.from(levelsCoveredSet.entries()).map(([id, name]) => ({ id, name })),
            membersCovered: Array.from(membersCoveredSet.values()),
            grades: Array.from(gradesSet),
            recipes: Array.from(recipesSet)
          },
          qualityContext: {
            curingStatus,
            curingScheduleId: curSchedule?._id?.toString(),
            curingDaysCompleted,
            curingTargetDays,
            cubeStatus,
            sampleCount: cubes.length,
            averageStrengthMpa,
            consumptionStatus: consRecord?.status,
            hasMrs: Array.isArray(e.mrsRevisions) && e.mrsRevisions.length > 0,
            mrsCode: e.mrsRevisions?.[e.mrsRevisions.length - 1]?.mrsCode
          },
          segments: segments.map((s: any) => ({
            ...s,
            blockName: blockMap.get(String(s.blockId)) || 'Block',
            levelName: levelMap.get(String(s.levelId)) || 'Level',
            memberDisplayId: memberMap.get(String(s.memberId))?.displayId || 'Member'
          })),
          createdAt: e.createdAt,
          updatedAt: e.updatedAt
        };
      });

      return res.json({
        success: true,
        count: enrichedEvents.length,
        data: enrichedEvents,
        summary: {
          total: enrichedEvents.length,
          planned: plannedCount,
          pouring: pouringCount,
          poured: pouredCount,
          delayed: delayedCount,
          overdue: overdueCount,
          cancelled: cancelledCount
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Error generating timeline' });
    }
  });

  // 2. GET /timeline/events/:id — Single event details with deep contextual drilldown
  router.get('/timeline/events/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);

      const event = await db.collection('casting_events').findOne({
        ...idQuery(req.params.id),
        companyId,
        isDeleted: { $ne: true }
      });

      if (!event) {
        return res.status(404).json({ success: false, message: 'Casting event not found' });
      }

      const eventIdStr = event._id.toString();

      // Fetch contextual records: curing, cube samples, consumption
      const [curingSchedule, curingLogs, cubeSamples, cubeEvaluations, consumptionRecord] = await Promise.all([
        db.collection('curing_schedules').findOne({
          companyId,
          $or: [{ eventId: eventIdStr }, { castingEventId: eventIdStr }]
        }),
        db.collection('curing_daily_logs').find({
          companyId,
          $or: [{ eventId: eventIdStr }, { castingEventId: eventIdStr }]
        }).sort({ logDate: 1 }).toArray(),
        db.collection('cube_test_registers').find({
          companyId,
          $or: [{ eventId: eventIdStr }, { castingEventId: eventIdStr }]
        }).sort({ testingAgeDays: 1 }).toArray(),
        db.collection('cube_compliance_evaluations').find({
          companyId,
          $or: [{ eventId: eventIdStr }, { evaluatedSampleIds: eventIdStr }]
        }).toArray(),
        db.collection('casting_consumption_records').findOne({ companyId, eventId: eventIdStr })
      ]);

      const delayMetrics = calculateTimelineDelay(event);

      return res.json({
        success: true,
        data: {
          ...event,
          id: eventIdStr,
          delayMetrics,
          contextualDetails: {
            curingSchedule,
            curingLogsCount: curingLogs.length,
            cubeSamples,
            cubeEvaluations,
            consumptionRecord
          }
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Error fetching event timeline details' });
    }
  });

  return router;
}
