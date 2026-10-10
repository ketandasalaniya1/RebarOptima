import { Router } from 'express';
import { Db, MongoClient, ObjectId } from 'mongodb';
import {
  evaluateVariance,
  executeApproveAndPost,
  executeReversal
} from './casting.inventory.service';
import {
  ICastingActualConsumptionRecord,
  ICastingSegmentActual,
  ICastingMaterialConsumptionItem
} from './casting.types';

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

export function createCastingConsumptionRouter(
  getDb: () => Db,
  getClient: () => MongoClient,
  authMiddleware: any,
  logAudit?: any
): Router {
  const router = Router();

  // 1. POST /events/:id/consumption — Draft actual pour and material consumption
  router.post('/events/:id/consumption', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id: eventId } = req.params;
      const {
        actualPourDate,
        actualPourStartTime,
        actualPourEndTime,
        segmentsActual,
        materialsConsumed,
        weatherConditions,
        batchingPlantName,
        generalNotes
      } = req.body;

      const event = await db.collection('casting_events').findOne({
        ...idQuery(eventId),
        companyId,
        isDeleted: { $ne: true }
      });
      if (!event) return res.status(404).json({ success: false, message: 'Casting event not found' });

      // Load active MRS snapshot
      const activeMrs = (event.mrsRevisions || []).find((r: any) => r.revisionNumber === event.activeMrsRevision)
        || (event.mrsRevisions && event.mrsRevisions[event.mrsRevisions.length - 1]);

      if (!activeMrs) {
        return res.status(400).json({
          success: false,
          message: 'Cannot record consumption: No Material Requirement Sheet (MRS) has been generated for this casting event.'
        });
      }

      // Check if MRS is flagged as stale
      if (event.isMrsStale === true) {
        return res.status(400).json({
          success: false,
          message: 'Cannot record consumption: Material Requirement Sheet (MRS) is stale. Please regenerate MRS first.'
        });
      }

      // Process segments actual
      let totalActualVol = 0;
      const processedSegments: ICastingSegmentActual[] = (segmentsActual || event.segments || []).map((seg: any) => {
        const plannedSeg = event.segments.find((s: any) => s.segmentId === seg.segmentId) || seg;
        const pVol = Number(plannedSeg.plannedVolumeM3) || 0;
        const aVol = Number(seg.actualVolumeM3 !== undefined ? seg.actualVolumeM3 : pVol);
        totalActualVol += aVol;

        return {
          segmentId: plannedSeg.segmentId,
          memberId: plannedSeg.memberId,
          segmentName: plannedSeg.segmentName,
          grade: plannedSeg.grade || 'M25',
          recipeCode: plannedSeg.recipeBinding?.recipeCode || 'MIX',
          recipeVersion: plannedSeg.recipeBinding?.versionNumber || '1.0',
          plannedVolumeM3: Math.round(pVol * 1000) / 1000,
          actualVolumeM3: Math.round(aVol * 1000) / 1000,
          varianceVolumeM3: Math.round((aVol - pVol) * 1000) / 1000,
          pourStartTime: seg.pourStartTime || actualPourStartTime,
          pourEndTime: seg.pourEndTime || actualPourEndTime,
          transitMixerChallans: seg.transitMixerChallans || [],
          testCubeBatchIds: seg.testCubeBatchIds || [],
          status: seg.status || (aVol >= pVol ? 'POURED' : 'PARTIAL')
        };
      });

      // Process materials consumed & evaluate variances against planned baseline
      const processedMaterials: ICastingMaterialConsumptionItem[] = (activeMrs.consolidatedTotals || []).map((plannedMat: any) => {
        const actualInput = (materialsConsumed || []).find((m: any) => m.materialIdentifier === plannedMat.materialIdentifier);
        const plannedQty = Number(plannedMat.totalQuantityRequired) || 0;
        const actualQty = actualInput && actualInput.actualQuantity !== undefined ? Number(actualInput.actualQuantity) : plannedQty;

        const { varianceQuantity, variancePercentage, varianceClassification } = evaluateVariance(plannedQty, actualQty);

        return {
          materialIdentifier: plannedMat.materialIdentifier,
          specificationStandard: plannedMat.specificationStandard,
          name: plannedMat.name,
          category: plannedMat.category,
          plannedQuantity: plannedQty,
          actualQuantity: actualQty,
          canonicalUnit: plannedMat.baseUnit === 'LITERS' ? 'LITERS' : 'KG',
          varianceQuantity,
          variancePercentage,
          varianceClassification,
          wastageReasonCode: actualInput?.wastageReasonCode,
          remarks: actualInput?.remarks,
          isUntrackedBulk: plannedMat.category === 'WATER' || actualInput?.isUntrackedBulk === true
        };
      });

      // Include any additional materials consumed on site that were not in planned MRS (Unbudgeted)
      if (Array.isArray(materialsConsumed)) {
        materialsConsumed.forEach((extraMat: any) => {
          if (!processedMaterials.some(m => m.materialIdentifier === extraMat.materialIdentifier)) {
            const aQty = Number(extraMat.actualQuantity) || 0;
            const { varianceQuantity, variancePercentage, varianceClassification } = evaluateVariance(0, aQty);
            processedMaterials.push({
              materialIdentifier: extraMat.materialIdentifier,
              specificationStandard: extraMat.specificationStandard || 'IS Specification',
              name: extraMat.name || extraMat.materialIdentifier,
              category: extraMat.category || 'CHEMICAL_ADMIXTURE',
              plannedQuantity: 0,
              actualQuantity: aQty,
              canonicalUnit: extraMat.canonicalUnit || 'KG',
              varianceQuantity,
              variancePercentage,
              varianceClassification,
              wastageReasonCode: extraMat.wastageReasonCode || 'UNBUDGETED_SITE_ADDITION',
              remarks: extraMat.remarks,
              isUntrackedBulk: extraMat.isUntrackedBulk === true
            });
          }
        });
      }

      const now = new Date();
      const count = await db.collection('casting_consumption_records').countDocuments({ companyId, eventId });
      const consumptionCode = `ACT-${event.eventNumber}-${count + 1}`;

      const consumptionDoc: ICastingActualConsumptionRecord = {
        companyId,
        projectId: event.projectId,
        eventId,
        eventNumber: event.eventNumber,
        consumptionCode,
        mrsRevisionNumber: activeMrs.revisionNumber,
        mrsCode: activeMrs.mrsCode,
        actualPourDate: actualPourDate || new Date().toISOString().split('T')[0],
        actualPourStartTime,
        actualPourEndTime,
        totalPlannedVolumeM3: event.plannedTotalVolumeM3,
        totalActualVolumeM3: Math.round(totalActualVol * 1000) / 1000,
        varianceVolumeM3: Math.round((totalActualVol - event.plannedTotalVolumeM3) * 1000) / 1000,
        segmentsActual: processedSegments,
        materialsConsumed: processedMaterials,
        status: 'DRAFT',
        createdBy: {
          userId: req.user?.sub || 'system',
          name: req.user?.name || req.user?.email || 'Site Engineer',
          email: req.user?.email || '',
          role: req.user?.role || 'Junior Site Engineer'
        },
        weatherConditions,
        batchingPlantName,
        generalNotes,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('casting_consumption_records').insertOne(consumptionDoc);
      const created = await db.collection('casting_consumption_records').findOne({ _id: result.insertedId });

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CASTING_CONSUMPTION_DRAFTED',
          resource: 'casting_consumption_records',
          resourceId: result.insertedId.toString(),
          description: `Drafted actual consumption record ${consumptionCode} for event '${event.title}'`
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Actual casting consumption drafted successfully',
        data: created ? { ...created, id: created._id.toString() } : null
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2. GET /events/:id/consumption — Get consumption records for event
  router.get('/events/:id/consumption', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id: eventId } = req.params;

      const records = await db.collection('casting_consumption_records')
        .find({ companyId, eventId })
        .sort({ createdAt: -1 })
        .toArray();

      return res.json({
        success: true,
        data: records.map((r: any) => ({ ...r, id: r._id.toString() }))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3. GET /events/:id/consumption/:cid — Get single consumption record
  router.get('/events/:id/consumption/:cid', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id: eventId, cid } = req.params;

      const record = await db.collection('casting_consumption_records').findOne({
        ...idQuery(cid),
        companyId,
        eventId
      });
      if (!record) return res.status(404).json({ success: false, message: 'Consumption record not found' });

      return res.json({
        success: true,
        data: { ...record, id: record._id.toString() }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. PUT /events/:id/consumption/:cid — Update draft consumption record
  router.put('/events/:id/consumption/:cid', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id: eventId, cid } = req.params;
      const {
        actualPourDate,
        actualPourStartTime,
        actualPourEndTime,
        segmentsActual,
        materialsConsumed,
        weatherConditions,
        batchingPlantName,
        generalNotes
      } = req.body;

      const record = await db.collection('casting_consumption_records').findOne({
        ...idQuery(cid),
        companyId,
        eventId
      });
      if (!record) return res.status(404).json({ success: false, message: 'Consumption record not found' });
      if (record.status !== 'DRAFT' && record.status !== 'REJECTED') {
        return res.status(400).json({ success: false, message: `Cannot edit consumption record in '${record.status}' status.` });
      }

      const updateData: any = { updatedAt: new Date() };
      if (actualPourDate) updateData.actualPourDate = actualPourDate;
      if (actualPourStartTime !== undefined) updateData.actualPourStartTime = actualPourStartTime;
      if (actualPourEndTime !== undefined) updateData.actualPourEndTime = actualPourEndTime;
      if (weatherConditions !== undefined) updateData.weatherConditions = weatherConditions;
      if (batchingPlantName !== undefined) updateData.batchingPlantName = batchingPlantName;
      if (generalNotes !== undefined) updateData.generalNotes = generalNotes;

      if (Array.isArray(segmentsActual)) {
        let totalVol = 0;
        updateData.segmentsActual = segmentsActual.map((seg: any) => {
          const aVol = Number(seg.actualVolumeM3) || 0;
          const pVol = Number(seg.plannedVolumeM3) || 0;
          totalVol += aVol;
          return {
            ...seg,
            actualVolumeM3: aVol,
            varianceVolumeM3: Math.round((aVol - pVol) * 1000) / 1000
          };
        });
        updateData.totalActualVolumeM3 = Math.round(totalVol * 1000) / 1000;
        updateData.varianceVolumeM3 = Math.round((totalVol - record.totalPlannedVolumeM3) * 1000) / 1000;
      }

      if (Array.isArray(materialsConsumed)) {
        updateData.materialsConsumed = materialsConsumed.map((mat: any) => {
          const pQty = Number(mat.plannedQuantity) || 0;
          const aQty = Number(mat.actualQuantity) || 0;
          const { varianceQuantity, variancePercentage, varianceClassification } = evaluateVariance(pQty, aQty);
          return {
            ...mat,
            actualQuantity: aQty,
            varianceQuantity,
            variancePercentage,
            varianceClassification
          };
        });
      }

      await db.collection('casting_consumption_records').updateOne(
        { _id: record._id },
        { $set: updateData }
      );

      const updated = await db.collection('casting_consumption_records').findOne({ _id: record._id });
      return res.json({ success: true, message: 'Consumption record updated', data: updated ? { ...updated, id: updated._id.toString() } : null });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. POST /events/:id/consumption/:cid/submit — Submit consumption record for review
  router.post('/events/:id/consumption/:cid/submit', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id: eventId, cid } = req.params;

      const record = await db.collection('casting_consumption_records').findOne({
        ...idQuery(cid),
        companyId,
        eventId
      });
      if (!record) return res.status(404).json({ success: false, message: 'Consumption record not found' });
      if (record.status !== 'DRAFT' && record.status !== 'REJECTED') {
        return res.status(400).json({ success: false, message: `Cannot submit record in '${record.status}' status.` });
      }

      const event = await db.collection('casting_events').findOne({ ...idQuery(eventId), companyId });
      if (event?.isMrsStale === true) {
        return res.status(400).json({
          success: false,
          message: 'Cannot submit consumption: Material Requirement Sheet (MRS) is stale. Please regenerate MRS first.'
        });
      }

      const now = new Date();
      await db.collection('casting_consumption_records').updateOne(
        { _id: record._id },
        {
          $set: {
            status: 'SUBMITTED',
            submittedBy: {
              userId: req.user.sub,
              name: req.user.name || req.user.email || 'Site Engineer',
              email: req.user.email || '',
              role: req.user.role || 'Junior Site Engineer',
              date: now
            },
            updatedAt: now
          }
        }
      );

      return res.json({ success: true, message: 'Consumption record submitted for Maker-Checker review.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. POST /events/:id/consumption/:cid/approve-and-post — Maker-Checker Approve & Atomic Stock Post
  router.post('/events/:id/consumption/:cid/approve-and-post', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const client = getClient();
      const companyId = await resolveCompanyId(req, db);
      const { id: eventId, cid } = req.params;
      const { remarks } = req.body || {};

      const approver = {
        userId: req.user.sub,
        name: req.user.name || req.user.email || 'Senior Engineer',
        email: req.user.email || '',
        role: req.user.role || 'Senior Site Engineer'
      };

      const receipt = await executeApproveAndPost(db, client, companyId, eventId, cid, approver, remarks);

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CASTING_CONSUMPTION_APPROVED_POSTED',
          resource: 'casting_consumption_records',
          resourceId: cid,
          description: `Approved & posted stock deduction for consumption receipt ${receipt.postingNumber}`
        });
      }

      return res.status(receipt.isDuplicateReplay ? 200 : 201).json({
        success: true,
        message: receipt.isDuplicateReplay ? 'Posting already completed (Idempotent Replay).' : 'Consumption approved and material inventory posted successfully.',
        data: receipt
      });
    } catch (err: any) {
      if (err.message?.includes('Maker-Checker Violation')) {
        return res.status(403).json({ success: false, message: err.message });
      }
      if (err.message?.includes('INSUFFICIENT_STOCK')) {
        return res.status(400).json({ success: false, code: 'INSUFFICIENT_STOCK', message: err.message });
      }
      if (err.message?.includes('CONFLICT_STATE')) {
        return res.status(409).json({ success: false, message: err.message });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // 7. POST /events/:id/consumption/:cid/reject — Reject consumption record back to draft
  router.post('/events/:id/consumption/:cid/reject', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { id: eventId, cid } = req.params;
      const { reason } = req.body || {};

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ success: false, message: 'Mandatory rejection reason is required (minimum 5 characters).' });
      }

      const record = await db.collection('casting_consumption_records').findOne({
        ...idQuery(cid),
        companyId,
        eventId
      });
      if (!record) return res.status(404).json({ success: false, message: 'Consumption record not found' });
      if (record.status !== 'SUBMITTED') {
        return res.status(400).json({ success: false, message: `Cannot reject record in '${record.status}' status. Must be 'SUBMITTED'.` });
      }

      const now = new Date();
      await db.collection('casting_consumption_records').updateOne(
        { _id: record._id },
        {
          $set: {
            status: 'REJECTED',
            rejectedBy: {
              userId: req.user.sub,
              name: req.user.name || req.user.email || 'Senior Engineer',
              email: req.user.email || '',
              role: req.user.role || 'Senior Site Engineer',
              date: now,
              reason: reason.trim()
            },
            updatedAt: now
          }
        }
      );

      return res.json({ success: true, message: 'Consumption record rejected and returned to draft.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 8. POST /events/:id/consumption/:cid/reverse — Authorized PM Reversal
  router.post('/events/:id/consumption/:cid/reverse', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const client = getClient();
      const companyId = await resolveCompanyId(req, db);
      const { id: eventId, cid } = req.params;
      const reason = req.body?.reason || req.body?.reversalReason;

      const authorizer = {
        userId: req.user.sub,
        name: req.user.name || req.user.email || 'Project Manager',
        email: req.user.email || '',
        role: req.user.role || 'Project Manager'
      };

      const reversalReceipt = await executeReversal(db, client, companyId, eventId, cid, reason, authorizer);

      if (logAudit) {
        await logAudit(db, {
          actorId: req.user.sub,
          actorType: req.user.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CASTING_CONSUMPTION_REVERSED',
          resource: 'casting_consumption_records',
          resourceId: cid,
          description: `Reversed stock posting for consumption record ${cid}. Reason: ${reason}`
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Consumption record reversed and stock balances restored successfully.',
        data: reversalReceipt
      });
    } catch (err: any) {
      if (err.message?.includes('CONFLICT_ALREADY_REVERSED')) {
        return res.status(409).json({ success: false, message: err.message });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  return router;
}
