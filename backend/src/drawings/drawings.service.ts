import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import {
  IDrawingRevision,
  IActivityEvent,
  IModuleSettings,
  WorkflowStatus
} from './drawings.types';

export function calculateFileChecksum(buffer: Buffer | string): string {
  const hash = crypto.createHash('sha256');
  if (typeof buffer === 'string') {
    hash.update(buffer, 'utf8');
  } else {
    hash.update(buffer);
  }
  return hash.digest('hex');
}

export function getNextRevisionIdentifier(
  existingRevisions: IDrawingRevision[],
  format: 'R00' | 'A' = 'R00'
): { revisionNumber: string; sequenceNumber: number } {
  if (!existingRevisions || existingRevisions.length === 0) {
    return {
      revisionNumber: format === 'A' ? 'A' : 'R00',
      sequenceNumber: 0
    };
  }

  const highestSeq = Math.max(...existingRevisions.map(r => r.sequenceNumber ?? 0), 0);
  const nextSeq = highestSeq + 1;

  if (format === 'A') {
    // A, B, C... Z, AA, AB...
    let revStr = '';
    let num = nextSeq;
    while (num >= 0) {
      revStr = String.fromCharCode(65 + (num % 26)) + revStr;
      num = Math.floor(num / 26) - 1;
    }
    return { revisionNumber: revStr, sequenceNumber: nextSeq };
  } else {
    // R00, R01, R02...
    const pad = nextSeq < 10 ? `0${nextSeq}` : `${nextSeq}`;
    return { revisionNumber: `R${pad}`, sequenceNumber: nextSeq };
  }
}

export async function logDrawingActivity(
  db: any,
  companyId: any,
  event: Partial<IActivityEvent>
): Promise<void> {
  try {
    const activityDoc: IActivityEvent = {
      companyId,
      entityType: event.entityType || 'drawing',
      entityId: String(event.entityId || ''),
      action: event.action || 'ACTIVITY',
      title: event.title || 'Drawing Event',
      description: event.description || '',
      drawingNumber: event.drawingNumber,
      revisionNumber: event.revisionNumber,
      performedById: event.performedById || 'system',
      performedByName: event.performedByName || 'System User',
      metadata: event.metadata || {},
      createdAt: new Date()
    };
    await db.collection('doc_activity_events').insertOne(activityDoc);
  } catch (err) {
    console.error('Failed to append drawing activity event:', err);
  }
}

export async function generateTransmittalNumber(db: any, companyId: any): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `TR-${currentYear}-`;
  const count = await db.collection('doc_transmittals').countDocuments({
    companyId,
    transmittalNumber: { $regex: `^${prefix}` }
  });
  const seq = String(count + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

export async function generateDrawingNumber(
  db: any,
  companyId: any,
  projectCode: string,
  disciplineCode: string,
  drawingType: string = 'Drawing'
): Promise<string> {
  // Pattern: <PRJ>-<DISC>-<TYPE_CODE>-<SEQ> e.g. "AH-ARCH-F-001" or "ST-S-101"
  const typeLetter = drawingType.toLowerCase().includes('plan')
    ? 'F'
    : drawingType.toLowerCase().includes('section')
    ? 'S'
    : drawingType.toLowerCase().includes('detail')
    ? 'D'
    : drawingType.toLowerCase().includes('schematic')
    ? 'M'
    : 'D';

  const prefix = `${projectCode}-${disciplineCode.substring(0, 3).toUpperCase()}-${typeLetter}-`;
  const count = await db.collection('doc_drawings').countDocuments({
    companyId,
    drawingNumber: { $regex: `^${prefix}` }
  });
  const seq = String(count + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

export async function ensureDefaultDisciplines(db: any, companyId: any): Promise<void> {
  const defaults = [
    { code: 'ARCH', name: 'Architectural', color: '#3b82f6', order: 1, isDefault: true },
    { code: 'STR', name: 'Structural', color: '#10b981', order: 2, isDefault: true },
    { code: 'MEPF', name: 'MEPF', color: '#8b5cf6', order: 3, isDefault: true },
    { code: 'PASS', name: 'Passing / Approval', color: '#06b6d4', order: 4, isDefault: true },
    { code: 'LAND', name: 'Landscape', color: '#ec4899', order: 5, isDefault: true },
    { code: 'INT', name: 'Interior', color: '#f59e0b', order: 6, isDefault: true },
    { code: 'OTH', name: 'Other', color: '#64748b', order: 7, isDefault: true }
  ];

  for (const d of defaults) {
    const existing = await db.collection('doc_disciplines').findOne({ companyId, code: d.code });
    if (!existing) {
      await db.collection('doc_disciplines').insertOne({
        ...d,
        companyId,
        description: `${d.name} Engineering & Construction Drawings`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
}

export async function ensureDefaultSettings(db: any, companyId: any): Promise<IModuleSettings> {
  let settings = await db.collection('doc_settings').findOne({ companyId });
  if (!settings) {
    settings = {
      companyId,
      numberingConvention: '{PROJECT}-{DISCIPLINE}-{SEQ}',
      revisionFormat: 'R00',
      allowSelfApproval: false,
      mandatoryReviewsRequired: true,
      storageQuotaBytes: 500 * 1024 * 1024 * 1024, // 500 GB
      allowedExtensions: ['pdf', 'dwg', 'dxf', 'png', 'jpg', 'svg', 'ifc'],
      updatedAt: new Date()
    };
    await db.collection('doc_settings').insertOne(settings);
  }
  return settings;
}

export function validateWorkflowTransition(
  currentStatus: WorkflowStatus,
  targetStatus: WorkflowStatus
): { valid: boolean; reason?: string } {
  // Permitted transitions:
  // Draft -> Under Review, Withdrawn
  // Under Review -> Changes Requested, Pending Approval, Rejected, Withdrawn
  // Changes Requested -> Draft, Under Review, Withdrawn
  // Pending Approval -> Approved, Changes Requested, Rejected, Withdrawn
  // Approved -> Published, Withdrawn
  // Published -> Superseded (triggered automatically on newer revision publication)

  const allowedTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
    'Draft': ['Under Review', 'Withdrawn'],
    'Under Review': ['Changes Requested', 'Pending Approval', 'Rejected', 'Withdrawn'],
    'Changes Requested': ['Draft', 'Under Review', 'Withdrawn'],
    'Pending Approval': ['Approved', 'Changes Requested', 'Rejected', 'Withdrawn'],
    'Approved': ['Published', 'Withdrawn'],
    'Published': ['Superseded'],
    'Rejected': ['Draft'],
    'Withdrawn': ['Draft'],
    'Superseded': []
  };

  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      reason: `Cannot transition from '${currentStatus}' to '${targetStatus}'. Permitted targets are: ${allowed.join(', ') || 'None'}`
    };
  }

  return { valid: true };
}

export async function publishRevisionSafely(
  db: any,
  companyId: any,
  drawingId: any,
  revisionId: any,
  user: any
): Promise<{ success: boolean; drawing: any; revision: any }> {
  const dId = ObjectId.isValid(drawingId) ? new ObjectId(drawingId) : drawingId;
  const rId = ObjectId.isValid(revisionId) ? new ObjectId(revisionId) : revisionId;

  const revision = await db.collection('doc_revisions').findOne({ _id: rId, drawingId: dId, companyId });
  if (!revision) {
    throw new Error('Revision not found for this drawing');
  }

  if (revision.workflowStatus !== 'Approved' && revision.workflowStatus !== 'Pending Approval') {
    throw new Error(`Only an Approved revision can be Published. Current status is '${revision.workflowStatus}'`);
  }

  // 1. Mark existing published revision as superseded
  await db.collection('doc_revisions').updateMany(
    {
      drawingId: dId,
      companyId,
      isPublished: true,
      _id: { $ne: rId }
    },
    {
      $set: {
        isPublished: false,
        isSuperseded: true,
        workflowStatus: 'Superseded',
        supersededAt: new Date(),
        supersededByRevisionId: rId,
        updatedAt: new Date()
      }
    }
  );

  // 2. Mark this revision as Published
  const now = new Date();
  await db.collection('doc_revisions').updateOne(
    { _id: rId },
    {
      $set: {
        workflowStatus: 'Published',
        isPublished: true,
        isSuperseded: false,
        approvedAt: revision.approvedAt || now,
        approvedById: revision.approvedById || user.sub,
        approvedByName: revision.approvedByName || user.name || 'Document Approver',
        updatedAt: now
      }
    }
  );

  // 3. Update parent drawing record
  await db.collection('doc_drawings').updateOne(
    { _id: dId },
    {
      $set: {
        currentRevisionId: rId,
        currentRevisionNumber: revision.revisionNumber,
        currentStatus: 'Approved',
        updatedAt: now
      }
    }
  );

  // 4. Log immutable audit activity
  await logDrawingActivity(db, companyId, {
    entityType: 'revision',
    entityId: String(rId),
    action: 'PUBLISHED',
    title: `Revision ${revision.revisionNumber} Published`,
    description: `Published revision ${revision.revisionNumber} of drawing ${revision.drawingNumber}. Prior published revisions superseded.`,
    drawingNumber: revision.drawingNumber,
    revisionNumber: revision.revisionNumber,
    performedById: user.sub,
    performedByName: user.name || user.email || 'Document Controller'
  });

  const updatedDrawing = await db.collection('doc_drawings').findOne({ _id: dId });
  const updatedRev = await db.collection('doc_revisions').findOne({ _id: rId });

  return { success: true, drawing: updatedDrawing, revision: updatedRev };
}
