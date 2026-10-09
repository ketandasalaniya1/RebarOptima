import { Db, MongoClient, ObjectId } from 'mongodb';
import {
  CanonicalUnit,
  IngredientUnit,
  VarianceClassification,
  ICastingMaterialConsumptionItem,
  ICastingInwardItem,
  ICastingInwardReceipt,
  ICastingPostingReceipt,
  ICastingReversalReceipt,
  ICastingStockTransaction,
  ICastingActualConsumptionRecord
} from './casting.types';

// ══════════════════════════════════════════════════════════════════════════════
// 1. CANONICAL UNIT CONVERSION ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export function convertToCanonicalUnit(
  quantity: number,
  fromUnit: IngredientUnit,
  targetCanonicalUnit: CanonicalUnit,
  specificGravity?: number
): { canonicalQuantity: number; conversionFactor: number } {
  const qty = Number(quantity);
  if (isNaN(qty) || qty < 0) {
    throw new Error(`Invalid non-negative quantity: ${quantity}`);
  }

  // 1. Canonical Mass Target (KG)
  if (targetCanonicalUnit === 'KG') {
    if (fromUnit === 'KG') return { canonicalQuantity: qty, conversionFactor: 1.0 };
    if (fromUnit === 'BAGS_50KG') return { canonicalQuantity: Math.round(qty * 50.0 * 1000) / 1000, conversionFactor: 50.0 };
    if (fromUnit === 'METRIC_TONNE') return { canonicalQuantity: Math.round(qty * 1000.0 * 1000) / 1000, conversionFactor: 1000.0 };
    if (fromUnit === 'LITERS') {
      if (!specificGravity || specificGravity <= 0) {
        throw new Error('UNSUPPORTED_UNIT_CONVERSION: Conversion from LITERS to KG requires verified specificGravity > 0.');
      }
      return { canonicalQuantity: Math.round(qty * specificGravity * 1000) / 1000, conversionFactor: specificGravity };
    }
  }

  // 2. Canonical Volume Target (LITERS)
  if (targetCanonicalUnit === 'LITERS') {
    if (fromUnit === 'LITERS') return { canonicalQuantity: qty, conversionFactor: 1.0 };
    if (fromUnit === 'M3') return { canonicalQuantity: Math.round(qty * 1000.0 * 1000) / 1000, conversionFactor: 1000.0 };
    if (fromUnit === 'KG') {
      if (!specificGravity || specificGravity <= 0) {
        throw new Error('UNSUPPORTED_UNIT_CONVERSION: Conversion from KG to LITERS requires verified specificGravity > 0.');
      }
      return { canonicalQuantity: Math.round((qty / specificGravity) * 1000) / 1000, conversionFactor: 1 / specificGravity };
    }
  }

  throw new Error(`UNSUPPORTED_UNIT_CONVERSION: Conversion from '${fromUnit}' to canonical '${targetCanonicalUnit}' is unsupported or ambiguous.`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. VARIANCE CLASSIFICATION ENGINE (CONTINUOUS NON-OVERLAPPING THRESHOLDS)
// ══════════════════════════════════════════════════════════════════════════════

export function evaluateVariance(
  plannedQty: number,
  actualQty: number
): {
  varianceQuantity: number;
  variancePercentage: number | null;
  varianceClassification: VarianceClassification;
} {
  const p = Math.max(0, Number(plannedQty) || 0);
  const a = Math.max(0, Number(actualQty) || 0);
  const diff = Math.round((a - p) * 1000) / 1000;

  if (p === 0) {
    if (a === 0) {
      return {
        varianceQuantity: 0,
        variancePercentage: 0.0,
        varianceClassification: 'EXACT_MATCH'
      };
    }
    return {
      varianceQuantity: a,
      variancePercentage: null,
      varianceClassification: 'UNBUDGETED'
    };
  }

  const pct = Math.round(((a - p) / p) * 10000) / 100; // 2 decimal precision

  if (pct === 0) {
    return { varianceQuantity: diff, variancePercentage: 0.0, varianceClassification: 'EXACT_MATCH' };
  } else if (pct < 0) {
    if (pct < -2.0) {
      return { varianceQuantity: diff, variancePercentage: pct, varianceClassification: 'UNDER_CONSUMPTION_HIGH' };
    }
    // -2.00% <= pct < 0.00%
    return { varianceQuantity: diff, variancePercentage: pct, varianceClassification: 'UNDER_CONSUMPTION_NORMAL' };
  } else {
    // pct > 0
    if (pct <= 2.0) {
      return { varianceQuantity: diff, variancePercentage: pct, varianceClassification: 'OVER_CONSUMPTION_TOLERABLE' };
    } else if (pct <= 5.0) {
      // +2.00% < pct <= +5.00%
      return { varianceQuantity: diff, variancePercentage: pct, varianceClassification: 'OVER_CONSUMPTION_MODERATE' };
    } else {
      // pct > +5.00%
      return { varianceQuantity: diff, variancePercentage: pct, varianceClassification: 'OVER_CONSUMPTION_HIGH' };
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. MULTI-DOCUMENT TRANSACTION STARTUP HEALTH PROBE
// ══════════════════════════════════════════════════════════════════════════════

export async function verifyMultiDocumentTransactionRollback(
  client: MongoClient,
  db: Db
): Promise<{ success: boolean; message: string }> {
  try {
    const probeId = `probe_${Date.now()}_${process.pid}_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Safe provision probe collections
    try {
      await db.createCollection('_system_tx_health_probe_a');
    } catch (e: any) {
      if (!e.message?.includes('already exists') && e.codeName !== 'NamespaceExists') throw e;
    }
    try {
      await db.createCollection('_system_tx_health_probe_b');
    } catch (e: any) {
      if (!e.message?.includes('already exists') && e.codeName !== 'NamespaceExists') throw e;
    }

    // 2. Execute deliberate aborted multi-collection transaction
    const session = client.startSession();
    try {
      session.startTransaction();
      await db.collection('_system_tx_health_probe_a').insertOne({ _id: probeId as any, target: 'A', createdAt: new Date() }, { session });
      await db.collection('_system_tx_health_probe_b').insertOne({ _id: probeId as any, target: 'B', createdAt: new Date() }, { session });
      await session.abortTransaction();
    } finally {
      await session.endSession();
    }

    // 3. Assert both probe documents do NOT exist outside session
    const [docA, docB] = await Promise.all([
      db.collection('_system_tx_health_probe_a').findOne({ _id: probeId as any }),
      db.collection('_system_tx_health_probe_b').findOne({ _id: probeId as any })
    ]);

    if (docA !== null || docB !== null) {
      throw new Error('CRITICAL_MULTI_DOCUMENT_TX_UNAVAILABLE_ERROR: Aborted transaction write persisted! MongoDB replica set transactions are not isolating writes.');
    }

    return {
      success: true,
      message: 'Multi-document transaction rollback integrity verified successfully.'
    };
  } catch (err: any) {
    console.error('❌ Transaction Health Probe Failed:', err.message);
    throw new Error(`CRITICAL_TRANSACTION_UNAVAILABLE_ERROR: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. ATOMIC STOCK INWARD PROCESSING
// ══════════════════════════════════════════════════════════════════════════════

export async function processStockInward(
  db: Db,
  client: MongoClient,
  params: {
    companyId: string;
    projectId: string;
    challanNumber: string;
    vendorName: string;
    vendorGstin?: string;
    vehicleNumber?: string;
    deliveryDate: string;
    items: {
      materialIdentifier: string;
      specificationStandard: string;
      name: string;
      category: any;
      enteredQuantity: number;
      enteredUnit: IngredientUnit;
      targetCanonicalUnit?: CanonicalUnit;
      unitCost?: number;
      specificGravity?: number;
      remarks?: string;
    }[];
    receivedBy: {
      userId: string;
      name: string;
      email: string;
      role: string;
    };
    remarks?: string;
  }
): Promise<ICastingInwardReceipt> {
  const { companyId, projectId, challanNumber, vendorName, vendorGstin, vehicleNumber, deliveryDate, items, receivedBy, remarks } = params;

  if (!challanNumber || !challanNumber.trim()) {
    throw new Error('Challan/Delivery number is mandatory for stock inward.');
  }
  if (!vendorName || !vendorName.trim()) {
    throw new Error('Vendor name is mandatory for stock inward.');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one inward material item is required.');
  }

  const normChallan = challanNumber.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
  const normVendor = (vendorGstin ? vendorGstin.trim() : vendorName.trim()).toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  const inwardKey = `INWARD__C${companyId}__P${projectId}__V${normVendor}__CH${normChallan}`;

  // Idempotency check before transaction
  const existingReceipt = await db.collection('casting_inward_receipts').findOne({ inwardKey });
  if (existingReceipt) {
    return { ...existingReceipt, isDuplicateReplay: true } as any;
  }

  // Convert items to canonical units
  const processedItems: ICastingInwardItem[] = items.map(item => {
    const canonicalUnit: CanonicalUnit = item.targetCanonicalUnit || (item.category === 'CHEMICAL_ADMIXTURE' || item.category === 'WATER' ? 'LITERS' : 'KG');
    const { canonicalQuantity } = convertToCanonicalUnit(item.enteredQuantity, item.enteredUnit, canonicalUnit, item.specificGravity);
    return {
      materialIdentifier: item.materialIdentifier.trim(),
      specificationStandard: item.specificationStandard.trim(),
      name: item.name.trim(),
      category: item.category,
      enteredQuantity: Number(item.enteredQuantity),
      enteredUnit: item.enteredUnit,
      canonicalQuantity,
      canonicalUnit,
      unitCost: item.unitCost,
      specificGravity: item.specificGravity,
      remarks: item.remarks
    };
  });

  const receiptDoc: ICastingInwardReceipt = {
    inwardKey,
    companyId,
    projectId,
    challanNumber: challanNumber.trim(),
    vendorName: vendorName.trim(),
    vendorGstin: vendorGstin?.trim(),
    vehicleNumber: vehicleNumber?.trim(),
    deliveryDate: deliveryDate || new Date().toISOString().split('T')[0],
    itemsCount: processedItems.length,
    items: processedItems,
    receivedAt: new Date(),
    receivedBy,
    remarks: remarks?.trim()
  };

  // Execute inside transaction with retry for write conflict
  let retryCount = 0;
  while (retryCount < 3) {
    const session = client.startSession();
    try {
      let result: any = null;
      await session.withTransaction(async () => {
        // Double check idempotency in-session
        const inSessionExisting = await db.collection('casting_inward_receipts').findOne({ inwardKey }, { session });
        if (inSessionExisting) {
          result = { ...inSessionExisting, isDuplicateReplay: true };
          return;
        }

        const now = new Date();
        const ledgerEntries: ICastingStockTransaction[] = [];

        // 1. Update stock balances and prepare ledger lines
        for (let i = 0; i < processedItems.length; i++) {
          const it = processedItems[i];
          await db.collection('casting_material_stock').updateOne(
            {
              companyId,
              projectId,
              materialIdentifier: it.materialIdentifier,
              specificationStandard: it.specificationStandard,
              canonicalUnit: it.canonicalUnit
            },
            {
              $inc: { currentBalance: it.canonicalQuantity },
              $setOnInsert: {
                name: it.name,
                category: it.category
              },
              $set: { updatedAt: now }
            },
            { upsert: true, session }
          );

          ledgerEntries.push({
            operationKey: inwardKey,
            lineIndex: i,
            transactionType: 'CASTING_INWARD',
            companyId,
            projectId,
            materialIdentifier: it.materialIdentifier,
            specificationStandard: it.specificationStandard,
            name: it.name,
            category: it.category,
            canonicalQuantity: it.canonicalQuantity,
            canonicalUnit: it.canonicalUnit,
            enteredQuantity: it.enteredQuantity,
            enteredUnit: it.enteredUnit,
            postedBy: receivedBy,
            createdAt: now
          });
        }

        // 2. Insert ledger lines
        await db.collection('casting_stock_transactions').insertMany(ledgerEntries, { session });

        // 3. Insert inward receipt
        const insertRes = await db.collection('casting_inward_receipts').insertOne(receiptDoc, { session });
        result = { ...receiptDoc, _id: insertRes.insertedId };
      });

      return result;
    } catch (err: any) {
      if (err.code === 11000 || err.message?.includes('E11000')) {
        // Check if duplicate was genuinely the inward receipt
        const committed = await db.collection('casting_inward_receipts').findOne({ inwardKey });
        if (committed) {
          return { ...committed, isDuplicateReplay: true } as any;
        }
        // Concurrent stock upsert race -> retry
      }
      retryCount++;
      if (retryCount >= 3) throw err;
      await new Promise(r => setTimeout(r, retryCount * 50));
    } finally {
      await session.endSession();
    }
  }

  throw new Error('Failed to process stock inward after retries.');
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. ATOMIC APPROVE & POST ENGINE
// ══════════════════════════════════════════════════════════════════════════════

function buildIdQuery(id: any, companyId?: string, extra?: any): any {
  const query: any = {};
  if (ObjectId.isValid(id) && String(id).length === 24) {
    query.$or = [{ _id: new ObjectId(String(id)) }, { _id: String(id) }];
  } else {
    query._id = String(id);
  }
  if (companyId) {
    query.companyId = companyId;
  }
  if (extra) {
    Object.assign(query, extra);
  }
  return query;
}

export async function executeApproveAndPost(
  db: Db,
  client: MongoClient,
  companyId: string,
  eventId: string,
  consumptionRecordId: string,
  approver: { userId: string; name: string; email: string; role: string },
  approvalRemarks?: string
): Promise<ICastingPostingReceipt> {
  const postingKey = `POSTING__C${companyId}__E${eventId}__CR${consumptionRecordId}`;

  // Idempotency pre-check
  const existingReceipt = await db.collection('casting_posting_receipts').findOne({ postingKey });
  if (existingReceipt) {
    return { ...existingReceipt, isDuplicateReplay: true } as any;
  }

  const session = client.startSession();
  try {
    let receipt: ICastingPostingReceipt | null = null;

    await session.withTransaction(async () => {
      const now = new Date();

      // 1. In-transaction validation of consumption record
      const recordQuery = buildIdQuery(consumptionRecordId, companyId);
      
      const record = await db.collection('casting_consumption_records').findOne(recordQuery, { session }) as ICastingActualConsumptionRecord | null;
      if (!record) {
        throw new Error('Consumption record not found.');
      }

      if (record.status === 'APPROVED_POSTED') {
        const cached = await db.collection('casting_posting_receipts').findOne({ postingKey }, { session });
        receipt = cached ? { ...cached, isDuplicateReplay: true } as any : { postingKey, status: 'COMMITTED', isDuplicateReplay: true } as any;
        return;
      }

      if (record.status !== 'SUBMITTED') {
        throw new Error(`Cannot approve consumption record in '${record.status}' status. Must be 'SUBMITTED'.`);
      }

      // Maker-Checker authorization check
      if (record.createdBy?.userId === approver.userId) {
        throw new Error('Maker-Checker Violation: Author cannot approve their own consumption record.');
      }

      // 2. Validate casting event and MRS baseline
      const eventQuery = buildIdQuery(eventId, companyId, { isDeleted: { $ne: true } });

      const event = await db.collection('casting_events').findOne(eventQuery, { session });
      if (!event) {
        throw new Error('Casting event not found.');
      }

      if (event.isMrsStale === true) {
        throw new Error('Cannot post consumption: Material Requirement Sheet (MRS) is stale.');
      }

      if (event.activeMrsRevision !== record.mrsRevisionNumber) {
        throw new Error(`MRS baseline mismatch: Record was drafted on R${record.mrsRevisionNumber}, but active event MRS is R${event.activeMrsRevision}.`);
      }

      // 3. Validate & deduct material stock balances (all-or-nothing)
      const ledgerEntries: ICastingStockTransaction[] = [];

      for (let i = 0; i < record.materialsConsumed.length; i++) {
        const item = record.materialsConsumed[i];

        if (item.isUntrackedBulk) {
          // Untracked bulk (e.g. municipal water) logs ledger line without balance decrement
          ledgerEntries.push({
            operationKey: postingKey,
            lineIndex: i,
            transactionType: 'CASTING_CONSUMPTION_OUTWARD',
            companyId,
            projectId: record.projectId,
            materialIdentifier: item.materialIdentifier,
            specificationStandard: item.specificationStandard,
            name: item.name,
            category: item.category,
            canonicalQuantity: item.actualQuantity,
            canonicalUnit: item.canonicalUnit,
            isUntrackedBulk: true,
            postedBy: approver,
            createdAt: now
          });
          continue;
        }

        // Conditional atomic decrement: balance must be >= consumed quantity
        const updateStockRes = await db.collection('casting_material_stock').updateOne(
          {
            companyId,
            projectId: record.projectId,
            materialIdentifier: item.materialIdentifier,
            specificationStandard: item.specificationStandard,
            canonicalUnit: item.canonicalUnit,
            currentBalance: { $gte: item.actualQuantity }
          },
          {
            $inc: { currentBalance: -item.actualQuantity },
            $set: { updatedAt: now }
          },
          { session }
        );

        if (updateStockRes.matchedCount === 0) {
          // Fetch current stock to report exact shortage
          const currentStockDoc = await db.collection('casting_material_stock').findOne(
            {
              companyId,
              projectId: record.projectId,
              materialIdentifier: item.materialIdentifier,
              specificationStandard: item.specificationStandard,
              canonicalUnit: item.canonicalUnit
            },
            { session }
          );
          const avail = currentStockDoc ? currentStockDoc.currentBalance : 0;
          throw new Error(`INSUFFICIENT_STOCK: Material '${item.name}' has only ${avail} ${item.canonicalUnit} available in Project Store, but ${item.actualQuantity} ${item.canonicalUnit} is required.`);
        }

        ledgerEntries.push({
          operationKey: postingKey,
          lineIndex: i,
          transactionType: 'CASTING_CONSUMPTION_OUTWARD',
          companyId,
          projectId: record.projectId,
          materialIdentifier: item.materialIdentifier,
          specificationStandard: item.specificationStandard,
          name: item.name,
          category: item.category,
          canonicalQuantity: item.actualQuantity,
          canonicalUnit: item.canonicalUnit,
          isUntrackedBulk: false,
          postedBy: approver,
          createdAt: now
        });
      }

      // 4. Insert multi-line stock ledger entries
      await db.collection('casting_stock_transactions').insertMany(ledgerEntries, { session });

      // 5. Create immutable posting receipt
      const postingNumber = `PST-${event.eventNumber}-${Date.now().toString().slice(-6)}`;
      const receiptDoc: ICastingPostingReceipt = {
        postingKey,
        companyId,
        projectId: record.projectId,
        eventId,
        consumptionRecordId,
        postingNumber,
        status: 'COMMITTED',
        postedAt: now,
        postedBy: approver,
        itemsCount: ledgerEntries.length,
        totalActualVolumeM3: record.totalActualVolumeM3
      };

      const receiptInsertRes = await db.collection('casting_posting_receipts').insertOne(receiptDoc, { session });
      receipt = { ...receiptDoc, _id: receiptInsertRes.insertedId };

      // 6. Update consumption record status to APPROVED_POSTED
      const updateRecRes = await db.collection('casting_consumption_records').updateOne(
        buildIdQuery(record._id, companyId, { status: 'SUBMITTED' }),
        {
          $set: {
            status: 'APPROVED_POSTED',
            approvedBy: {
              userId: approver.userId,
              name: approver.name,
              email: approver.email,
              role: approver.role,
              date: now,
              remarks: approvalRemarks?.trim()
            },
            postingReceiptId: receiptInsertRes.insertedId,
            postingReceipt: receipt,
            updatedAt: now
          }
        },
        { session }
      );

      if (updateRecRes.matchedCount === 0) {
        throw new Error('CONFLICT_STATE: Consumption record was modified concurrently during posting.');
      }

      // 7. Update structural member cumulative poured volumes
      for (const seg of record.segmentsActual) {
        const mQuery = buildIdQuery(seg.memberId, companyId);

        const member = await db.collection('casting_members').findOne(mQuery, { session });
        if (member) {
          const newPoured = Math.round(((member.actualPouredM3 || 0) + seg.actualVolumeM3) * 1000) / 1000;
          const newRemaining = Math.max(0, Math.round(((member.totalRequiredVolumeM3 || 0) - newPoured) * 1000) / 1000);
          const newStatus = newRemaining === 0 ? 'Poured' : (newPoured > 0 ? 'Partially_Poured' : member.status);

          await db.collection('casting_members').updateOne(
            mQuery,
            {
              $set: {
                actualPouredM3: newPoured,
                remainingVolumeM3: newRemaining,
                status: newStatus,
                updatedAt: now
              }
            },
            { session }
          );
        }
      }

      // 8. Update casting event status to POURED
      await db.collection('casting_events').updateOne(
        eventQuery,
        {
          $set: {
            status: 'POURED',
            actualPourDate: record.actualPourDate,
            actualPourStartTime: record.actualPourStartTime,
            actualPourEndTime: record.actualPourEndTime,
            actualTotalVolumeM3: record.totalActualVolumeM3,
            updatedAt: now
          }
        },
        { session }
      );
    });

    return receipt!;
  } finally {
    await session.endSession();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. ATOMIC 100% REVERSAL ENGINE (DERIVED FROM ORIGINAL IMMUTABLE LEDGER)
// ══════════════════════════════════════════════════════════════════════════════

export async function executeReversal(
  db: Db,
  client: MongoClient,
  companyId: string,
  eventId: string,
  consumptionRecordId: string,
  reversalReason: string,
  authorizer: { userId: string; name: string; email: string; role: string }
): Promise<ICastingReversalReceipt> {
  if (!reversalReason || reversalReason.trim().length < 5) {
    throw new Error('Mandatory reversal reason is required (minimum 5 characters).');
  }

  const postingKey = `POSTING__C${companyId}__E${eventId}__CR${consumptionRecordId}`;
  const reversalKey = `REVERSAL__C${companyId}__PST${postingKey}`;

  // Check if already reversed
  const existingReversal = await db.collection('casting_reversal_receipts').findOne({ originalPostingKey: postingKey });
  if (existingReversal) {
    throw new Error('CONFLICT_ALREADY_REVERSED: This consumption posting has already been reversed.');
  }

  const session = client.startSession();
  try {
    let reversalReceipt: ICastingReversalReceipt | null = null;

    await session.withTransaction(async () => {
      const now = new Date();

      // 1. Verify consumption record status
      const recordQuery = buildIdQuery(consumptionRecordId, companyId);

      const record = await db.collection('casting_consumption_records').findOne(recordQuery, { session }) as ICastingActualConsumptionRecord | null;
      if (!record) throw new Error('Consumption record not found.');
      if (record.status !== 'APPROVED_POSTED') {
        throw new Error(`Cannot reverse record in '${record.status}' status. Must be 'APPROVED_POSTED'.`);
      }

      // 2. Load original immutable outward ledger lines
      const originalLines = await db.collection('casting_stock_transactions')
        .find({ operationKey: postingKey, companyId, transactionType: 'CASTING_CONSUMPTION_OUTWARD' }, { session })
        .sort({ lineIndex: 1 })
        .toArray() as ICastingStockTransaction[];

      if (originalLines.length === 0) {
        throw new Error('No original stock ledger entries found for this posting.');
      }

      // 3. Restore 100% exact canonical quantities and generate compensating reversal lines
      const reversalLedgerEntries: ICastingStockTransaction[] = [];

      for (let i = 0; i < originalLines.length; i++) {
        const orig = originalLines[i];

        if (!orig.isUntrackedBulk) {
          // Increment stock back into project store
          await db.collection('casting_material_stock').updateOne(
            {
              companyId,
              projectId: record.projectId,
              materialIdentifier: orig.materialIdentifier,
              specificationStandard: orig.specificationStandard,
              canonicalUnit: orig.canonicalUnit
            },
            {
              $inc: { currentBalance: orig.canonicalQuantity },
              $set: { updatedAt: now }
            },
            { session }
          );
        }

        reversalLedgerEntries.push({
          operationKey: reversalKey,
          lineIndex: i,
          transactionType: 'CASTING_REVERSAL',
          companyId,
          projectId: record.projectId,
          materialIdentifier: orig.materialIdentifier,
          specificationStandard: orig.specificationStandard,
          name: orig.name,
          category: orig.category,
          canonicalQuantity: orig.canonicalQuantity,
          canonicalUnit: orig.canonicalUnit,
          originalTransactionId: orig._id,
          originalOperationKey: postingKey,
          isUntrackedBulk: orig.isUntrackedBulk,
          postedBy: authorizer,
          createdAt: now
        });
      }

      // 4. Insert reversal ledger entries
      await db.collection('casting_stock_transactions').insertMany(reversalLedgerEntries, { session });

      // 5. Create reversal receipt
      const receiptDoc: ICastingReversalReceipt = {
        reversalKey,
        originalPostingKey: postingKey,
        companyId,
        projectId: record.projectId,
        eventId,
        consumptionRecordId,
        reversalReason: reversalReason.trim(),
        itemsCount: reversalLedgerEntries.length,
        reversedAt: now,
        reversedBy: authorizer
      };

      const receiptInsertRes = await db.collection('casting_reversal_receipts').insertOne(receiptDoc, { session });
      reversalReceipt = { ...receiptDoc, _id: receiptInsertRes.insertedId };

      // 6. Update consumption record status to REVERSED
      await db.collection('casting_consumption_records').updateOne(
        buildIdQuery(record._id, companyId, { status: 'APPROVED_POSTED' }),
        {
          $set: {
            status: 'REVERSED',
            reversalReceiptId: receiptInsertRes.insertedId,
            reversalReceipt,
            updatedAt: now
          }
        },
        { session }
      );

      // 7. Revert member poured volumes with non-negative check
      for (const seg of record.segmentsActual) {
        const mQuery = buildIdQuery(seg.memberId, companyId);

        const member = await db.collection('casting_members').findOne(mQuery, { session });
        if (member) {
          const newPoured = Math.max(0, Math.round(((member.actualPouredM3 || 0) - seg.actualVolumeM3) * 1000) / 1000);
          const newRemaining = Math.round(((member.totalRequiredVolumeM3 || 0) - newPoured) * 1000) / 1000;
          const newStatus = newPoured === 0 ? 'Planned' : (newRemaining === 0 ? 'Poured' : 'Partially_Poured');

          await db.collection('casting_members').updateOne(
            mQuery,
            {
              $set: {
                actualPouredM3: newPoured,
                remainingVolumeM3: newRemaining,
                status: newStatus,
                updatedAt: now
              }
            },
            { session }
          );
        }
      }

      // 8. Revert casting event status to PLANNED or CANCELLED
      const eventQuery = buildIdQuery(eventId, companyId);

      await db.collection('casting_events').updateOne(
        eventQuery,
        {
          $set: {
            status: 'PLANNED',
            actualTotalVolumeM3: 0,
            updatedAt: now
          }
        },
        { session }
      );
    });

    return reversalReceipt!;
  } finally {
    await session.endSession();
  }
}
